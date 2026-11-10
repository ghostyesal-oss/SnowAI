const DEFAULTS = {
  supabaseUrl: "http://127.0.0.1:8787",
  anonKey: "local-demo",
};

const ticketSelect = document.getElementById("ticket");
const ticketCard = document.getElementById("ticket-card");
const btnAsk = document.getElementById("btn-ask");
const btnOptions = document.getElementById("btn-options");
const btnRetry = document.getElementById("btn-retry");
const resultEl = document.getElementById("result");
const banner = document.getElementById("banner");
const bannerAction = document.getElementById("banner-action");
const hubStatus = document.getElementById("hub-status");

let tickets = [];
let cfg = { ...DEFAULTS };
let lastRequestId = null;
let busy = false;

function showBanner(text, retry = false) {
  banner.textContent = text;
  banner.classList.toggle("hidden", !text);
  bannerAction.classList.toggle("hidden", !retry);
}

async function loadCfg() {
  const stored = await chrome.storage.local.get({ ...DEFAULTS, lastTicketId: "" });
  cfg = {
    supabaseUrl: (stored.supabaseUrl || DEFAULTS.supabaseUrl).replace(/\/$/, ""),
    anonKey: stored.anonKey || DEFAULTS.anonKey,
    lastTicketId: stored.lastTicketId || "",
  };
}

function restHeaders() {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    "Content-Type": "application/json",
  };
}

async function api(path, options = {}) {
  const url = `${cfg.supabaseUrl}/rest/v1/${path}`;
  const res = await fetch(url, { ...options, headers: { ...restHeaders(), ...(options.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : null;
}

async function rpc(name, body) {
  const url = `${cfg.supabaseUrl}/rest/v1/rpc/${name}`;
  const res = await fetch(url, { method: "POST", headers: restHeaders(), body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : null;
}

function currentTicket() {
  return tickets.find((t) => t.id === ticketSelect.value) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMd(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    html += `<ol>${list.map((item) => `<li>${item}</li>`).join("")}</ol>`;
    list = [];
  };
  const inline = (s) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,3}|\*\*)\s*(.+?)(\*\*)?$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);
    const note = line.match(/^_\((.+)\)_$/);
    if (numbered) {
      list.push(inline(numbered[1]));
      continue;
    }
    flushList();
    if (note) {
      html += `<p class="note">${inline(note[1])}</p>`;
    } else if (heading && (line.startsWith("#") || (line.startsWith("**") && line.endsWith("**")))) {
      const title = line.replace(/^#+\s*/, "").replace(/^\*\*/, "").replace(/\*\*$/, "");
      html += `<h4>${inline(title)}</h4>`;
    } else {
      html += `<p>${inline(line)}</p>`;
    }
  }
  flushList();
  return html;
}

function renderTicket() {
  const t = currentTicket();
  if (!t) {
    ticketCard.classList.add("hidden");
    btnAsk.disabled = true;
    return;
  }
  ticketCard.classList.remove("hidden");
  const pClass = t.priority === "2" || t.priority === "1" ? "p2" : "p3";
  ticketCard.innerHTML = `
    <h2>${escapeHtml(t.short_description)}</h2>
    <div class="meta">
      <span class="pill num">${escapeHtml(t.number)}</span>
      <span class="pill">${escapeHtml(t.category)}</span>
      <span class="pill ${pClass}">P${escapeHtml(t.priority)}</span>
      <span class="pill">${escapeHtml(t.caller)}</span>
      <span class="pill">${escapeHtml(t.assignment_group || "N1")}</span>
    </div>
    <p class="desc">${escapeHtml(t.description)}</p>
  `;
  btnAsk.disabled = busy;
}

function setHub(ok, extra = "") {
  hubStatus.classList.toggle("ok", ok);
  hubStatus.classList.toggle("bad", !ok);
  hubStatus.textContent = ok ? (extra || "Hub OK") : "Hors ligne";
}

async function pingHub() {
  try {
    const res = await fetch(`${cfg.supabaseUrl}/health`);
    if (!res.ok) {
      setHub(false);
      return false;
    }
    const data = await res.json();
    const pending = data.pending != null ? ` · ${data.pending} job` : "";
    setHub(true, `Hub OK${pending}`);
    return true;
  } catch {
    setHub(false);
    return false;
  }
}

async function loadTickets() {
  tickets = await api("tickets?select=*&order=number.asc");
  const selected = tickets.some((t) => t.id === cfg.lastTicketId) ? cfg.lastTicketId : tickets[0]?.id;
  ticketSelect.innerHTML = tickets
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${escapeHtml(t.number)} — ${escapeHtml(t.short_description)}</option>`
    )
    .join("");
  renderTicket();
  await loadLatestForTicket();
}

async function loadLatestForTicket() {
  const t = currentTicket();
  if (!t) return;
  const rows = await api(`resolution_ready?ticket_id=eq.${t.id}&order=created_at.desc&limit=1`);
  const row = rows[0];
  if (row && (row.status === "done" || row.status === "error" || row.status === "processing" || row.status === "pending")) {
    renderResult(row);
    btnAsk.textContent = row.status === "done" ? "Relancer l’analyse" : "Proposer une résolution";
    if (row.status === "pending" || row.status === "processing") poll(row.request_id);
  } else {
    resultEl.classList.add("hidden");
    btnAsk.textContent = "Proposer une résolution";
  }
}

function renderResult(row) {
  resultEl.classList.remove("hidden");
  if (row.status === "pending" || row.status === "processing") {
    const label = row.status === "pending" ? "Job en file…" : "Analyse en cours…";
    resultEl.innerHTML = `<p class="status-wait"><span class="spinner"></span>${label}</p>`;
    return;
  }
  if (row.status === "error") {
    resultEl.innerHTML = `<h3>Erreur worker</h3><p>${escapeHtml(row.error_message || "échec")}</p>`;
    return;
  }
  const sources = Array.isArray(row.sources) ? row.sources : [];
  const conf = (row.confidence || "moyenne").toLowerCase();
  resultEl.innerHTML = `
    <div class="result-head">
      <h3>Résolution</h3>
      <span class="badge ${escapeHtml(conf)}">${escapeHtml(row.confidence || "—")}</span>
    </div>
    <div class="answer">${formatMd(row.answer_md || "")}</div>
    <div class="sources">${sources.map((s) => `<span class="src" title="${escapeHtml(s.title || "")}">${escapeHtml(s.code)}</span>`).join("") || "<span class='src'>—</span>"}</div>
    <div class="actions">
      <button type="button" id="btn-copy">Copier</button>
      <button type="button" data-helpful="true">Utile</button>
      <button type="button" data-helpful="false">Pas utile</button>
    </div>
  `;
  resultEl.querySelector("#btn-copy")?.addEventListener("click", async (ev) => {
    await navigator.clipboard.writeText(row.answer_md || "");
    ev.target.textContent = "Copié";
    setTimeout(() => {
      ev.target.textContent = "Copier";
    }, 1500);
  });
  resultEl.querySelectorAll("[data-helpful]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("feedback", {
        method: "POST",
        body: JSON.stringify({
          request_id: row.request_id,
          helpful: btn.dataset.helpful === "true",
        }),
      });
      btn.closest(".actions").innerHTML = "<span class='note'>Feedback enregistré.</span>";
    });
  });
}

async function poll(requestId) {
  lastRequestId = requestId;
  const started = Date.now();
  while (Date.now() - started < 90000 && lastRequestId === requestId) {
    const rows = await api(`resolution_ready?request_id=eq.${requestId}`);
    const row = rows[0];
    if (row) renderResult(row);
    if (row && (row.status === "done" || row.status === "error")) {
      btnAsk.textContent = "Relancer l’analyse";
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  if (lastRequestId === requestId) {
    showBanner("Toujours en attente : lancez le worker (lancer.bat).", true);
  }
}

async function ask() {
  const t = currentTicket();
  if (!t || busy) return;
  showBanner("");
  busy = true;
  btnAsk.disabled = true;
  try {
    const requestId = await rpc("request_resolution", { p_ticket_id: t.id });
    renderResult({ status: "pending", request_id: requestId });
    await poll(requestId);
  } catch (err) {
    showBanner(String(err.message || err), true);
  } finally {
    busy = false;
    btnAsk.disabled = false;
  }
}

async function boot() {
  await loadCfg();
  const up = await pingHub();
  if (!up) {
    showBanner("Hub injoignable. Double-cliquez lancer.bat puis réessayez.", true);
    return;
  }
  showBanner("");
  try {
    await loadTickets();
  } catch (err) {
    showBanner("Impossible de lire les tickets : " + (err.message || err), true);
  }
}

btnOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
btnRetry.addEventListener("click", boot);
ticketSelect.addEventListener("change", () => {
  showBanner("");
  lastRequestId = null;
  cfg.lastTicketId = ticketSelect.value;
  chrome.storage.local.set({ lastTicketId: ticketSelect.value });
  renderTicket();
  loadLatestForTicket().catch(() => {});
});
btnAsk.addEventListener("click", ask);
setInterval(() => pingHub(), 5000);
boot();
