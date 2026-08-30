const FOLDER_ID = '1iirCgUmHlFblIHv4Jhyw8sIbMFC7F_fG';
const SHEET_NAME = 'research_database';

function doPost(e) {
  if (e.parameter.action === 'sheet') return updateSheet(e);
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const name = e.parameter.name;
  const existing = folder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(e.parameter.data),
    e.parameter.type || 'video/mp4',
    name);
  const file = folder.createFile(blob);
  return ContentService
    .createTextOutput(JSON.stringify({ok: true, name: file.getName()}))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateSheet(e) {
  const rows = JSON.parse(e.parameter.rows);   // rows[0] = headers
  const folder = DriveApp.getFolderById(FOLDER_ID);

  let ss = null;
  const files = folder.getFilesByName(SHEET_NAME);
  while (files.hasNext()) {
    const f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      ss = SpreadsheetApp.openById(f.getId());
      break;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    const sh0 = ss.getSheets()[0];
    sh0.setRightToLeft(true);
    sh0.setFrozenRows(1);
  }
  const sh = ss.getSheets()[0];
  sh.getRange('A:A').setNumberFormat('@');
  // header row follows whatever width the sender declares (e.g. added notes column)
  sh.getRange(1, 1, 1, rows[0].length).setValues([rows[0]]).setFontWeight('bold');

  const last = sh.getLastRow();
  const serials = last > 1
    ? sh.getRange(2, 1, last - 1, 1).getDisplayValues().map(function (r) { return String(r[0]); })
    : [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const at = serials.indexOf(String(row[0]));
    const target = at >= 0 ? at + 2 : sh.getLastRow() + 1;
    sh.getRange(target, 1, 1, row.length).setValues([row]);
    // צבע לפי עמודת ההערות: כפילות = צהוב, חסום/לא ירד = אדום בהיר
    const note = String(row[row.length - 1] || '');
    let color = null;
    if (note.indexOf('כפילות') !== -1) color = '#fff2cc';
    else if (note.indexOf('חסום') !== -1 || note.indexOf('לא ירד') !== -1) color = '#f4cccc';
    sh.getRange(target, 1, 1, rows[0].length).setBackground(color);
    if (at < 0) serials.push(String(row[0]));
  }

  const stale = folder.getFilesByName('research_database.csv');
  while (stale.hasNext()) stale.next().setTrashed(true);

  return ContentService
    .createTextOutput(JSON.stringify({ok: true, sheet: ss.getUrl()}))
    .setMimeType(ContentService.MimeType.JSON);
}
