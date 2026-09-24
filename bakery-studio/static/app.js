const $ = (s) => document.querySelector(s);
const state = {
  files: [], styles: [], styleId: null, editing: null, providers: {}, fixes: {},
  history: [], pending: [], runIds: [], view: "groups",
};
const PROVIDER_LABELS = {
  gemini: "Google Gemini · צילום מחדש בסט",
  openai: "OpenAI · צילום מחדש בסט",
  local: "שיפור מקומי · תאורה וצבע בלבד (ללא AI)",
};

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `שגיאה ${res.status}`);
  return body;
}
const X_ICON = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- upload queue ---------- */
const drop = $("#drop");
$("#files").addEventListener("change", (e) => addFiles(e.target.files));
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

function addFiles(list) {
  for (const f of list) if (f.type.startsWith("image/")) state.files.push({ file: f, url: URL.createObjectURL(f) });
  $("#files").value = "";
  renderQueue();
}
function renderQueue() {
  $("#queue").innerHTML = state.files.map((f, i) =>
    `<div class="thumb"><img src="${f.url}" alt="${esc(f.file.name)}"><button data-i="${i}" aria-label="הסרת ${esc(f.file.name)}">${X_ICON}</button></div>`).join("");
  updateGo();
}
$("#queue").addEventListener("click", (e) => {
  const i = e.target.closest("[data-i]")?.dataset.i;
  if (i === undefined) return;
  URL.revokeObjectURL(state.files[i].url);
  state.files.splice(i, 1);
  renderQueue();
});
function updateGo() { $("#go").disabled = !(state.files.length && state.styleId && $("#provider").value); }

/* ---------- styles ---------- */
async function loadStyles() {
  state.styles = await api("/api/styles");
  if (!state.styles.some((s) => s.id === state.styleId)) state.styleId = state.styles[0]?.id ?? null;
  renderStyles();
}
function renderStyles() {
  $("#styles").innerHTML = state.styles.map((s) => `
    <div class="style-card ${s.id === state.styleId ? "active" : ""}" data-id="${esc(s.id)}">
      <button type="button" class="pick" aria-pressed="${s.id === state.styleId}">
        <h4>${esc(s.name)}</h4>
        <p>${esc(s.lighting || s.mood || s.surface)}</p>
        ${s.reference ? `<img class="ref" src="${esc(s.reference)}" alt="">` : ""}
      </button>
      <button type="button" class="edit" data-edit="${esc(s.id)}" aria-label="עריכת ${esc(s.name)}">עריכה</button>
    </div>`).join("");
  const ref = currentStyle()?.reference;
  $("#useRefRow").hidden = !ref;
  if (ref) $("#useRefThumb").src = ref;
  updateGo();
  refreshPrompt();
  if (state.view === "series") render();
}
const currentStyle = () => state.styles.find((s) => s.id === state.styleId);
$("#styles").addEventListener("click", (e) => {
  const edit = e.target.closest("[data-edit]");
  if (edit) return openEditor(state.styles.find((s) => s.id === edit.dataset.edit));
  const card = e.target.closest(".style-card");
  if (card) { state.styleId = card.dataset.id; renderStyles(); }
});

const dlg = $("#styleDialog"), form = $("#styleForm");
function openEditor(style) {
  state.editing = style || null;
  $("#dialogTitle").textContent = style ? `עריכת "${style.name}"` : "סגנון חדש";
  $("#deleteStyle").hidden = !style;
  for (const el of form.elements) if (el.name) el.value = style?.[el.name] ?? "";
  $("#refFile").value = "";
  showRefPreview(style?.reference);
  dlg.showModal();
}
function showRefPreview(src) {
  $("#refPreview").hidden = !src;
  if (src) $("#refPreview").src = src;
  $("#removeRef").hidden = !(src && state.editing?.reference);
}
$("#refFile").addEventListener("change", (e) => {
  const f = e.target.files[0];
  showRefPreview(f ? URL.createObjectURL(f) : state.editing?.reference);
});
$("#removeRef").addEventListener("click", async () => {
  if (!state.editing || !confirm("להסיר את תמונת ההשראה מהסגנון?")) return;
  await api(`/api/styles/${state.editing.id}/reference`, { method: "DELETE" });
  state.editing.reference = null;
  $("#refFile").value = "";
  showRefPreview(null);
  loadStyles();
});
$("#newStyle").addEventListener("click", () => openEditor(null));
$("#cancelStyle").addEventListener("click", () => dlg.close());
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const opts = { method: state.editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  try {
    const saved = await api(state.editing ? `/api/styles/${state.editing.id}` : "/api/styles", opts);
    const refFile = $("#refFile").files[0];
    if (refFile) {
      const fd = new FormData();
      fd.append("image", refFile);
      await api(`/api/styles/${saved.id}/reference`, { method: "POST", body: fd });
    }
    state.styleId = saved.id;
    dlg.close();
    loadStyles();
  } catch (err) { alert(err.message); }
});
$("#deleteStyle").addEventListener("click", async () => {
  if (!state.editing || !confirm(`למחוק את הסגנון "${state.editing.name}"?`)) return;
  await api(`/api/styles/${state.editing.id}`, { method: "DELETE" });
  dlg.close();
  loadStyles();
});

let promptTimer;
function refreshPrompt() {
  clearTimeout(promptTimer);
  promptTimer = setTimeout(async () => {
    if (!state.styleId) return;
    const r = await api("/api/preview-prompt", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        style_id: state.styleId, notes: $("#notes").value,
        product_type: $("#productType").value, use_reference: $("#useRef").checked,
      }),
    }).catch(() => null);
    if (r) $("#promptText").textContent = r.prompt;
  }, 250);
}
$("#notes").addEventListener("input", refreshPrompt);
$("#productType").addEventListener("change", refreshPrompt);
$("#useRef").addEventListener("change", refreshPrompt);

/* ---------- engines ---------- */
async function loadConfig() {
  const cfg = await api("/api/config");
  state.providers = cfg.providers;
  const order = ["gemini", "openai", "local"].filter((p) => cfg.providers[p]);
  $("#provider").innerHTML = order.map((p) => `<option value="${p}">${PROVIDER_LABELS[p]}</option>`).join("");
  state.fixes = cfg.fixes;
  $("#productType").innerHTML = Object.entries(cfg.product_types)
    .map(([k, label]) => `<option value="${esc(k)}">${esc(label)}</option>`).join("");
  showEngineHint();
}
function showEngineHint() {
  const p = $("#provider").value;
  $("#engineHint").textContent =
    !state.providers.gemini && !state.providers.openai
      ? "לא הוגדר מפתח API למודל AI, ולכן זמין רק שיפור מקומי (תאורה וצבע). להחלפת רקע וסט מלא — ראו README."
      : p === "local" ? "שיפור מקומי משפר תאורה, צבע וחדות, אבל לא מחליף רקע, לא משתמש בתמונת ההשראה ולא מייצר גרסאות שונות." : "";
  updateGo();
}
$("#provider").addEventListener("change", showEngineHint);

/* ---------- processing ---------- */
const ICONS = {
  star: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8Z"/></svg>`,
  wand: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 11-11M14 4v2M18 8h2M17 5l1.5-1.5M9.5 4.5 10 6M18 12.5l1.5.5"/></svg>`,
};
const newId = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");
let pendingSeq = 0;

// Run jobs two at a time; each job is { pending, run: () => Promise<entry> }.
async function runJobs(jobs) {
  let next = 0, done = 0, failed = 0;
  const progress = () => {
    $("#progress").textContent = `הושלמו ${done} מתוך ${jobs.length}` + (failed ? ` · ${failed} נכשלו` : "");
  };
  progress();
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const entry = await job.run();
        state.pending = state.pending.filter((p) => p !== job.pending);
        state.history.unshift(entry);
        state.runIds.push(entry.id);
      } catch (err) {
        failed++;
        job.pending.error = err.message;
      }
      done++;
      progress();
      render();
    }
  };
  await Promise.all([worker(), worker()]);
}

$("#go").addEventListener("click", async () => {
  const files = state.files.splice(0);
  renderQueue();
  const params = {
    style_id: state.styleId, provider: $("#provider").value, aspect: $("#aspect").value,
    notes: $("#notes").value, product_type: $("#productType").value, use_reference: $("#useRef").checked,
  };
  // Local enhancement is deterministic, so extra variants would be identical.
  const n = params.provider === "local" ? 1 : Number($("#variants").value);
  state.runIds = [];
  const jobs = files.flatMap((f) => {
    const group = newId();
    return Array.from({ length: n }, (_, v) => {
      const pending = { key: ++pendingSeq, group, name: f.file.name, preview: f.url, label: n > 1 ? `גרסה ${v + 1}` : "" };
      state.pending.push(pending);
      return {
        pending,
        run: () => {
          const fd = new FormData();
          fd.append("image", f.file);
          fd.append("variant", v + 1);
          fd.append("group", group);
          for (const [k, val] of Object.entries(params)) fd.append(k, val);
          return api("/api/process", { method: "POST", body: fd });
        },
      };
    });
  });
  setView("groups");
  render();
  await runJobs(jobs);
});

function refine(h, body) {
  const pending = { key: ++pendingSeq, group: h.group || h.id, name: h.filename, label: `תיקון: ${body.fix ? state.fixes[body.fix] : body.custom}` };
  state.pending.push(pending);
  render();
  runJobs([{
    pending,
    run: () => api("/api/refine", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job: h.id, ...body }),
    }),
  }]);
}

async function toggleStar(h) {
  const entry = await api(`/api/history/${h.id}/star`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starred: !h.starred }),
  });
  h.starred = entry.starred;
  render();
}

async function removeJob(h) {
  if (!confirm("למחוק את התוצאה?")) return;
  await api(`/api/history/${h.id}`, { method: "DELETE" });
  state.history = state.history.filter((x) => x !== h);
  render();
}

/* ---------- rendering ---------- */
function groupsOf() {
  const groups = new Map();
  const get = (key, name) => {
    if (!groups.has(key)) groups.set(key, { key, name, items: [], pending: [] });
    return groups.get(key);
  };
  for (const p of state.pending) get(p.group, p.name).pending.push(p);
  for (const h of state.history) get(h.group || h.id, h.filename).items.push(h);
  return [...groups.values()];
}

function render() {
  const groups = groupsOf();
  const starred = state.history.filter((h) => h.starred);
  $("#empty").hidden = groups.length > 0;
  $("#downloadStarred").hidden = !starred.length;
  $("#downloadStarred span").textContent = `הורדת המסומנות (${starred.length})`;
  $("#downloadAll").hidden = !state.runIds.length || state.pending.length > 0;
  $("#gallery").hidden = state.view !== "groups";
  $("#series").hidden = state.view !== "series" || !groups.length;
  if (state.view === "groups") $("#gallery").replaceChildren(...groups.map(groupBlock));
  else renderSeries(groups);
}

function groupBlock(g) {
  const el = document.createElement("section");
  el.className = "group";
  const nStar = g.items.filter((h) => h.starred).length;
  const thumb = g.items[0]?.original || g.pending[0]?.preview;
  el.innerHTML = `
    <header class="group-head">
      ${thumb ? `<img src="${esc(thumb)}" alt="">` : ""}
      <div>
        <h3>${esc(g.name || "תמונה")}</h3>
        <span class="hint">${g.items.length} תוצאות${nStar ? ` · ${nStar} מסומנות` : ""}${g.pending.length ? ` · ${g.pending.length} בעבודה` : ""}</span>
      </div>
    </header>
    <div class="group-row"></div>`;
  el.querySelector(".group-row").append(...g.pending.map(pendingCard), ...g.items.map(resultCard));
  return el;
}

function pendingCard(p) {
  const card = document.createElement("div");
  card.className = `result ${p.error ? "error" : "pending"}`;
  card.innerHTML = `
    <div class="compare">${p.error ? esc(p.error) : `<div><div class="spinner"></div>מצלמים בסטודיו…</div>`}</div>
    <div class="meta"><b>${esc(p.name)}<span class="sub">${esc(p.label || (p.error ? "נכשל" : "בעבודה"))}</span></b>
      ${p.error ? `<button class="ghost" data-dismiss>סגירה</button>` : ""}</div>`;
  card.querySelector("[data-dismiss]")?.addEventListener("click", () => {
    state.pending = state.pending.filter((x) => x !== p);
    render();
  });
  return card;
}

function resultCard(h) {
  const card = document.createElement("div");
  card.className = `result${h.starred ? " starred" : ""}`;
  const canFix = h.provider !== "local";
  const sub = [h.variant > 1 && `גרסה ${h.variant}`, h.fix && `תיקון: ${h.fix}`, h.used_reference && "עם השראה"].filter(Boolean);
  card.innerHTML = `
    <div class="compare">
      <img class="after" src="${h.result}" alt="אחרי">
      <img class="before" src="${h.original}" alt="לפני">
      <div class="bar"></div>
      <span class="tag l">אחרי</span><span class="tag r">לפני</span>
    </div>
    <button type="button" class="star" aria-pressed="${!!h.starred}" aria-label="${h.starred ? "ביטול סימון" : "סימון כגרסה הנבחרת"}">${ICONS.star}</button>
    <div class="meta">
      <b>${esc(h.style_name)}<span class="sub">${sub.map(esc).join(" · ") || "&nbsp;"}</span></b>
      <a class="ghost" href="${h.result}" download="studio-${h.id}.jpg">הורדה</a>
      <button class="ghost" data-del>מחיקה</button>
    </div>
    ${canFix ? `
    <div class="fixes">
      <span class="fixes-label">${ICONS.wand} תיקון מהיר</span>
      <div class="chips">${Object.entries(state.fixes).map(([k, label]) => `<button type="button" class="chip" data-fix="${esc(k)}">${esc(label)}</button>`).join("")}</div>
      <form class="custom-fix">
        <input name="custom" maxlength="500" placeholder="תיקון אחר, באנגלית עדיף" aria-label="תיקון חופשי">
        <button class="ghost" type="submit">שליחה</button>
      </form>
    </div>` : `<p class="hint fixes-off">תיקון מהיר זמין רק עם מנוע AI.</p>`}`;
  const cmp = card.querySelector(".compare");
  let pos = 50;
  const setPos = (v) => {
    pos = Math.min(100, Math.max(0, v));
    cmp.style.setProperty("--pos", `${pos}%`);
    cmp.setAttribute("aria-valuenow", Math.round(pos));
  };
  const move = (x) => {
    const r = cmp.getBoundingClientRect();
    setPos(((x - r.left) / r.width) * 100);
  };
  cmp.tabIndex = 0;
  cmp.setAttribute("role", "slider");
  cmp.setAttribute("aria-label", "השוואת לפני ואחרי");
  cmp.setAttribute("aria-valuemin", "0");
  cmp.setAttribute("aria-valuemax", "100");
  setPos(50);
  cmp.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === "ArrowLeft") setPos(pos - step);
    else if (e.key === "ArrowRight") setPos(pos + step);
    else return;
    e.preventDefault();
  });
  cmp.addEventListener("pointerdown", (e) => { cmp.setPointerCapture(e.pointerId); move(e.clientX); });
  cmp.addEventListener("pointermove", (e) => { if (e.buttons) move(e.clientX); });
  card.querySelector(".star").addEventListener("click", () => toggleStar(h).catch((err) => alert(err.message)));
  card.querySelector("[data-del]").addEventListener("click", () => removeJob(h).catch((err) => alert(err.message)));
  card.querySelectorAll("[data-fix]").forEach((b) => b.addEventListener("click", () => refine(h, { fix: b.dataset.fix })));
  card.querySelector(".custom-fix")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const custom = e.target.custom.value.trim();
    if (custom) refine(h, { custom });
  });
  return card;
}

/* ---------- series view ---------- */
// Average color of the top 15% of an image: in a studio shot that strip is
// pure backdrop, so it shows whether the background tone drifts between shots.
const toneCache = new Map();
function backdropTone(src) {
  if (!toneCache.has(src)) {
    toneCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = 40, h = 50, c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, Math.ceil(h * 0.15)).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
        resolve(sum.map((s) => Math.round(s / (d.length / 4))));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return toneCache.get(src);
}
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

let seriesToken = 0;
async function renderSeries(groups) {
  const token = ++seriesToken;
  const picks = groups.flatMap((g) => {
    const starred = g.items.filter((h) => h.starred);
    return starred.length ? starred : g.items.slice(0, 1);
  });
  const ref = currentStyle()?.reference;
  const tiles = [
    ...(ref ? [{ src: ref, title: "תמונת ההשראה", isRef: true }] : []),
    ...picks.map((h) => ({ src: h.result, title: h.filename, sub: h.starred ? "מסומנת" : "אחרונה", h })),
  ];
  const tones = await Promise.all(tiles.map((t) => backdropTone(t.src)));
  if (token !== seriesToken) return;
  // Compare each shot to the reference tone when there is one, else to the median shot.
  const shots = tones.filter((t, i) => t && !tiles[i].isRef);
  const anchor = ref && tones[0] ? tones[0] : shots.length ? [0, 1, 2].map((c) => median(shots.map((t) => t[c]))) : null;
  $("#seriesGrid").innerHTML = tiles.map((t, i) => {
    const tone = tones[i];
    const dist = tone && anchor ? Math.hypot(...tone.map((v, c) => v - anchor[c])) : 0;
    const off = !t.isRef && dist > 22;
    return `
      <figure class="tile${t.isRef ? " ref" : ""}${off ? " off" : ""}">
        <div class="tile-img"><img src="${esc(t.src)}" alt="${esc(t.title)}" loading="lazy"></div>
        <figcaption>
          <span>${esc(t.title)}${t.sub ? `<small>${esc(t.sub)}</small>` : ""}</span>
          ${tone ? `<span class="swatch" title="גוון הרקע"><i style="background:${hex(tone)}"></i>${hex(tone)}</span>` : ""}
        </figcaption>
        ${off ? `<span class="flag">גוון רקע שונה מ${ref ? "ההשראה" : "שאר הסדרה"}</span>` : ""}
      </figure>`;
  }).join("");
}

function setView(v) {
  state.view = v;
  $("#viewGroups").setAttribute("aria-selected", v === "groups");
  $("#viewSeries").setAttribute("aria-selected", v === "series");
  render();
}
$("#viewGroups").addEventListener("click", () => setView("groups"));
$("#viewSeries").addEventListener("click", () => setView("series"));

$("#downloadAll").addEventListener("click", () => {
  location.href = `/api/download?ids=${state.runIds.join(",")}`;
});
$("#downloadStarred").addEventListener("click", () => {
  location.href = `/api/download?ids=${state.history.filter((h) => h.starred).map((h) => h.id).join(",")}`;
});

async function loadHistory() {
  state.history = await api("/api/history");
  render();
}

loadConfig().then(loadStyles).then(loadHistory);
