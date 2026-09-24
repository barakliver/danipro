const $ = (s) => document.querySelector(s);
const state = { files: [], styles: [], styleId: null, editing: null, providers: {} };
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
    `<div class="thumb"><img src="${f.url}" alt=""><button data-i="${i}" title="הסרה">×</button></div>`).join("");
  updateGo();
}
$("#queue").addEventListener("click", (e) => {
  const i = e.target.dataset.i;
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
    <button type="button" class="style-card ${s.id === state.styleId ? "active" : ""}" data-id="${esc(s.id)}">
      <span class="edit" data-edit="${esc(s.id)}">עריכה</span>
      <h4>${esc(s.name)}</h4>
      <p>${esc(s.lighting || s.mood || s.surface)}</p>
    </button>`).join("");
  updateGo();
  refreshPrompt();
}
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
  dlg.showModal();
}
$("#newStyle").addEventListener("click", () => openEditor(null));
$("#cancelStyle").addEventListener("click", () => dlg.close());
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const opts = { method: state.editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  try {
    const saved = await api(state.editing ? `/api/styles/${state.editing.id}` : "/api/styles", opts);
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
      body: JSON.stringify({ style_id: state.styleId, notes: $("#notes").value }),
    }).catch(() => null);
    if (r) $("#promptText").textContent = r.prompt;
  }, 250);
}
$("#notes").addEventListener("input", refreshPrompt);

/* ---------- engines ---------- */
async function loadConfig() {
  const cfg = await api("/api/config");
  state.providers = cfg.providers;
  const order = ["gemini", "openai", "local"].filter((p) => cfg.providers[p]);
  $("#provider").innerHTML = order.map((p) => `<option value="${p}">${PROVIDER_LABELS[p]}</option>`).join("");
  showEngineHint();
}
function showEngineHint() {
  const p = $("#provider").value;
  $("#engineHint").textContent =
    !state.providers.gemini && !state.providers.openai
      ? "לא הוגדר מפתח API למודל AI, ולכן זמין רק שיפור מקומי (תאורה וצבע). להחלפת רקע וסט מלא — ראו README."
      : p === "local" ? "שיפור מקומי משפר תאורה, צבע וחדות, אבל לא מחליף רקע או מוסיף אביזרים." : "";
  updateGo();
}
$("#provider").addEventListener("change", showEngineHint);

/* ---------- processing ---------- */
$("#go").addEventListener("click", async () => {
  const jobs = state.files.splice(0);
  renderQueue();
  const params = { style_id: state.styleId, provider: $("#provider").value, aspect: $("#aspect").value, notes: $("#notes").value };
  const cards = jobs.map((j) => {
    const card = document.createElement("div");
    card.className = "result pending";
    card.innerHTML = `<div class="compare"><div><div class="spinner"></div>מצלמים בסטודיו…</div></div>
      <div class="meta"><b>${esc(j.file.name)}</b></div>`;
    $("#gallery").prepend(card);
    return card;
  });
  $("#empty").hidden = true;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      const fd = new FormData();
      fd.append("image", jobs[i].file);
      for (const [k, v] of Object.entries(params)) fd.append(k, v);
      try {
        const entry = await api("/api/process", { method: "POST", body: fd });
        cards[i].replaceWith(resultCard(entry));
      } catch (err) {
        cards[i].className = "result error";
        cards[i].querySelector(".compare").textContent = err.message;
      }
      URL.revokeObjectURL(jobs[i].url);
    }
  };
  await Promise.all([worker(), worker()]);
});

function resultCard(h) {
  const card = document.createElement("div");
  card.className = "result";
  card.innerHTML = `
    <div class="compare">
      <img class="after" src="${h.result}" alt="אחרי">
      <img class="before" src="${h.original}" alt="לפני">
      <div class="bar"></div>
      <span class="tag l">אחרי</span><span class="tag r">לפני</span>
    </div>
    <div class="meta">
      <b>${esc(h.style_name)}</b>
      <a class="ghost" href="${h.result}" download="studio-${h.id}.jpg">הורדה</a>
      <button class="ghost" data-del="${h.id}">מחיקה</button>
    </div>`;
  const cmp = card.querySelector(".compare");
  const move = (x) => {
    const r = cmp.getBoundingClientRect();
    cmp.style.setProperty("--pos", `${Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100))}%`);
  };
  cmp.addEventListener("pointerdown", (e) => { cmp.setPointerCapture(e.pointerId); move(e.clientX); });
  cmp.addEventListener("pointermove", (e) => { if (e.buttons) move(e.clientX); });
  card.querySelector("[data-del]").addEventListener("click", async () => {
    if (!confirm("למחוק את התוצאה?")) return;
    await api(`/api/history/${h.id}`, { method: "DELETE" });
    card.remove();
    $("#empty").hidden = !!$("#gallery").children.length;
  });
  return card;
}

async function loadHistory() {
  const hist = await api("/api/history");
  $("#gallery").replaceChildren(...hist.map(resultCard));
  $("#empty").hidden = hist.length > 0;
}

loadConfig().then(loadStyles).then(loadHistory);
