import "server-only";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { Cell, WorkbookData } from "./plan-parser";

// Minimal, tolerant .xlsx reader. It reads values only, which is all the importer
// needs. It handles files written by Excel, Google Sheets and OpenXML-SDK generators
// (namespace-prefixed tags like <x:c>, absolute relationship targets, inline strings).
// exceljs could not parse the generated workbook this studio ships with.

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
  isArray: (name) => ["sheet", "Relationship", "row", "c", "si", "r"].includes(name),
});

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Text of <t> / <r><t> runs, used by both shared strings and inline strings. */
function richText(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  const n = node as XmlNode;
  if ("t" in n) return textOf(n.t);
  if ("r" in n) return asArray(n.r as XmlNode[]).map((run) => textOf(run.t)).join("");
  return "";
}

function textOf(t: unknown): string {
  if (t === undefined || t === null) return "";
  if (typeof t === "string" || typeof t === "number") return String(t);
  const n = t as XmlNode;
  return typeof n["#text"] === "string" || typeof n["#text"] === "number" ? String(n["#text"]) : "";
}

function resolveTarget(target: string): string {
  const clean = target.replace(/^\//, "");
  return clean.startsWith("xl/") ? clean : `xl/${clean}`;
}

/** "AB12" → 27 (0-based column index) */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readWorkbook(data: ArrayBuffer | Uint8Array): Promise<WorkbookData> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => {
    const file = zip.file(path);
    return file ? parser.parse(await file.async("string")) : null;
  };

  const workbookXml = await read("xl/workbook.xml");
  if (!workbookXml) throw new Error("הקובץ לא נראה כמו קובץ Excel תקין (חסר workbook.xml).");
  const relsXml = await read("xl/_rels/workbook.xml.rels");

  const rels = new Map<string, string>();
  for (const rel of asArray((relsXml?.Relationships as XmlNode | undefined)?.Relationship as XmlNode[])) {
    rels.set(String(rel["@Id"]), resolveTarget(String(rel["@Target"])));
  }

  const sharedStrings: string[] = [];
  const sstPath = [...rels.values()].find((p) => p.endsWith("sharedStrings.xml")) ?? "xl/sharedStrings.xml";
  const sst = await read(sstPath);
  for (const si of asArray((sst?.sst as XmlNode | undefined)?.si as XmlNode[])) sharedStrings.push(richText(si));

  const out: WorkbookData = {};
  const sheets = asArray(((workbookXml.workbook as XmlNode).sheets as XmlNode).sheet as XmlNode[]);
  for (const sheet of sheets) {
    const name = String(sheet["@name"]).trim();
    const relId = String(sheet["@id"] ?? "");
    const path = rels.get(relId);
    if (!path) continue;
    const sheetXml = await read(path);
    const sheetData = ((sheetXml?.worksheet as XmlNode | undefined)?.sheetData ?? {}) as XmlNode;
    const rows: Cell[][] = [];
    for (const row of asArray(sheetData.row as XmlNode[])) {
      const values: Cell[] = [];
      for (const cell of asArray(row.c as XmlNode[])) {
        const ref = String(cell["@r"] ?? "");
        const index = ref ? columnIndex(ref) : values.length;
        const type = String(cell["@t"] ?? "n");
        const raw = textOf(cell.v);
        let value: Cell = null;
        if (type === "s") value = sharedStrings[Number(raw)] ?? null;
        else if (type === "inlineStr") value = richText(cell.is);
        else if (type === "b") value = raw === "1";
        else if (type === "str" || type === "e") value = raw || null;
        else value = raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : raw;
        values[index] = value;
      }
      for (let i = 0; i < values.length; i += 1) if (values[i] === undefined) values[i] = null;
      rows.push(values);
    }
    out[name] = rows;
  }
  return out;
}
