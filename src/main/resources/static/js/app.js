"use strict";

/* ================================================================== */
/*  Texts (French / English)                                          */
/* ================================================================== */
const I18N = {
  fr: {
    subtitle: "Supervision industrielle · Station de pompage",
    connecting: "Connexion…",
    online: "En ligne",
    offline: "Hors ligne · reconnexion…",
    demo: "Mode démonstration · données locales",
    paused: "En pause",
    logout: "Déconnexion",
    role_ADMIN: "Administrateur",
    role_OPERATEUR: "Opérateur",
    tt_pause: "Mettre en pause",
    tt_resume: "Reprendre",
    tt_theme: "Changer de thème",
    tt_fullscreen: "Plein écran",
    sum_status: "Statut global",
    sum_alarms: "Alarmes actives",
    sum_update: "Dernière mise à jour",
    synoptic: "Synoptique du procédé",
    trends: "Tendances",
    events: "Journal des événements",
    export_csv: "Exporter CSV",
    footer: "Données simulées · mise à jour toutes les 2 secondes",
    tank_label: "Réservoir R1",
    pump_label: "Pompe P1",
    distribution: "Distribution",
    pump_on: "En marche",
    pump_off: "Arrêt",
    temperature: "Température",
    pression: "Pression",
    niveau: "Niveau réservoir",
    debit: "Débit",
    stat_min: "Min",
    stat_avg: "Moy.",
    stat_max: "Max",
    NORMAL: "Normal",
    AVERTISSEMENT: "Avertissement",
    CRITIQUE: "Critique",
    global_NORMAL: "Système normal",
    global_AVERTISSEMENT: "Avertissement",
    global_CRITIQUE: "Alarme critique",
    col_time: "Heure",
    col_equipment: "Équipement",
    col_severity: "Gravité",
    col_value: "Valeur",
    no_events: "Aucun événement",
    back_normal: "Retour à la normale",
    lg_value: "Valeur",
    thr_warn: "Seuil d'avertissement",
    thr_crit: "Seuil critique",
    now: "maintenant"
  },
  en: {
    subtitle: "Industrial supervision · Pumping station",
    connecting: "Connecting…",
    online: "Online",
    offline: "Offline · reconnecting…",
    demo: "Demo mode · local data",
    paused: "Paused",
    logout: "Log out",
    role_ADMIN: "Administrator",
    role_OPERATEUR: "Operator",
    tt_pause: "Pause",
    tt_resume: "Resume",
    tt_theme: "Switch theme",
    tt_fullscreen: "Fullscreen",
    sum_status: "Overall status",
    sum_alarms: "Active alarms",
    sum_update: "Last update",
    synoptic: "Process diagram",
    trends: "Trends",
    events: "Event log",
    export_csv: "Export CSV",
    footer: "Simulated data · updated every 2 seconds",
    tank_label: "Tank R1",
    pump_label: "Pump P1",
    distribution: "Distribution",
    pump_on: "Running",
    pump_off: "Stopped",
    temperature: "Temperature",
    pression: "Pressure",
    niveau: "Tank level",
    debit: "Flow rate",
    stat_min: "Min",
    stat_avg: "Avg",
    stat_max: "Max",
    NORMAL: "Normal",
    AVERTISSEMENT: "Warning",
    CRITIQUE: "Critical",
    global_NORMAL: "System normal",
    global_AVERTISSEMENT: "Warning",
    global_CRITIQUE: "Critical alarm",
    col_time: "Time",
    col_equipment: "Equipment",
    col_severity: "Severity",
    col_value: "Value",
    no_events: "No events",
    back_normal: "Back to normal",
    lg_value: "Value",
    thr_warn: "Warning threshold",
    thr_crit: "Critical threshold",
    now: "now"
  }
};

const KEYS = ["temperature", "pression", "niveau", "debit"];
const UNITS = { temperature: "°C", pression: "bar", niveau: "%", debit: "m³/h" };
const RANGE = { temperature: [0, 120], pression: [0, 10], niveau: [0, 100], debit: [0, 200] };
const DECIMALS = { temperature: 1, pression: 1, niveau: 1, debit: 0 };
const FIELD = {
  temperature: "temperature_celsius",
  pression: "pression_bar",
  niveau: "niveau_pourcent",
  debit: "debit_m3h"
};
const CHART = { W: 640, H: 250, L: 48, R: 16, T: 16, B: 30 };

let lang = "fr";
let metric = "temperature";
let last = null;          // last snapshot received
let currentUser = null;
let paused = false;
let hoverX = null;        // mouse position (chart units) while hovering

/* ================================================================== */
/*  Helpers                                                           */
/* ================================================================== */
const $ = (id) => document.getElementById(id);
const t = (key) => (I18N[lang] && I18N[lang][key]) || key;
const locale = () => (lang === "fr" ? "fr-FR" : "en-GB");
const num = (v, decimals) =>
  Number(v).toLocaleString(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmt = (key, v) => num(v, DECIMALS[key]);
const timeOf = (iso) => new Date(iso).toLocaleTimeString(locale());

function readCookie(name) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function storedValue(name, allowed, fallback) {
  const fromUrl = new URLSearchParams(window.location.search).get(name);
  if (allowed.includes(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem("scadasec-" + name);
    if (allowed.includes(saved)) return saved;
  } catch (e) { /* storage not available */ }
  return fallback;
}

function store(name, value) {
  try { window.localStorage.setItem("scadasec-" + name, value); } catch (e) { /* ignore */ }
}

/* ================================================================== */
/*  Language and theme                                                */
/* ================================================================== */
function applyLang(newLang) {
  lang = newLang;
  store("lang", lang);
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  updatePauseButton();
  renderUser();
  if (last) render(last);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store("theme", theme);
}

/* ================================================================== */
/*  Logged-in user and logout                                         */
/* ================================================================== */
function renderUser() {
  if (!currentUser) return;
  $("userName").textContent = currentUser.utilisateur;
  $("userRole").textContent = "· " + t("role_" + currentUser.role);
  $("user").classList.remove("hidden");
}

async function loadUser() {
  try {
    const r = await fetch("/moi", { cache: "no-store" });
    if (!r.ok) return;
    currentUser = await r.json();
    renderUser();
  } catch (e) { /* not logged in (demo mode) */ }
}

async function logout() {
  try {
    await fetch("/logout", { method: "POST", headers: { "X-XSRF-TOKEN": readCookie("XSRF-TOKEN") } });
  } catch (e) { /* ignore */ }
  window.location.href = "/login.html";
}

/* ================================================================== */
/*  Static parts                                                      */
/* ================================================================== */
function buildKpis() {
  $("kpis").innerHTML = KEYS.map((k) => `
    <article class="card">
      <div class="card-head"><h2 data-i18n="${k}"></h2><span class="chip s-NORMAL" id="chip-${k}">--</span></div>
      <svg class="gauge" viewBox="0 0 200 120">
        <path class="track" d="M20 100 A80 80 0 0 1 180 100" pathLength="100"/>
        <g id="ticks-${k}"></g>
        <path class="fill s-NORMAL" id="g-${k}" d="M20 100 A80 80 0 0 1 180 100" pathLength="100" stroke-dasharray="0 100"/>
        <text class="val" id="v-${k}" x="100" y="90">--</text>
        <text class="unit" x="100" y="112">${UNITS[k]}</text>
      </svg>
      <svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline id="sp-${k}" points=""/></svg>
      <div class="stats">
        <span><em data-i18n="stat_min"></em><b id="min-${k}">--</b></span>
        <span><em data-i18n="stat_avg"></em><b id="avg-${k}">--</b></span>
        <span><em data-i18n="stat_max"></em><b id="max-${k}">--</b></span>
      </div>
    </article>`).join("");
}

function buildTabs() {
  $("tabs").innerHTML = KEYS.map((k) =>
    `<button type="button" data-metric="${k}" data-i18n="${k}"></button>`).join("");
  $("tabs").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-metric]");
    if (!b) return;
    metric = b.dataset.metric;
    markTabs();
    drawChart();
  });
}

function markTabs() {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.metric === metric));
}

/* ================================================================== */
/*  Rendering                                                         */
/* ================================================================== */
function seriesOf(snap, key) {
  return snap.historique.map((h) => h[FIELD[key]]);
}

function drawTicks(key, seuils) {
  const g = $("ticks-" + key);
  const thr = seuils ? seuils[key] : null;
  if (!thr) { g.innerHTML = ""; return; }
  const [min, max] = RANGE[key];
  const tick = (value, cls) => {
    const p = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const a = Math.PI * (1 - p);
    const x1 = 100 + 69 * Math.cos(a), y1 = 100 - 69 * Math.sin(a);
    const x2 = 100 + 93 * Math.cos(a), y2 = 100 - 93 * Math.sin(a);
    return `<line class="${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  };
  g.innerHTML = tick(thr.avertissement, "tick-warn") + tick(thr.critique, "tick-crit");
}

function drawSpark(key, values) {
  if (values.length < 2) return;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => {
    const x = (i * 100) / (values.length - 1);
    const y = hi === lo ? 15 : 27 - ((v - lo) / span) * 24;
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  $("sp-" + key).setAttribute("points", pts.join(" "));
}

function setKpi(snap, key) {
  const value = snap.donnees[FIELD[key]];
  const status = snap.statuts[key];
  const [min, max] = RANGE[key];
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const g = $("g-" + key);
  g.setAttribute("stroke-dasharray", pct + " 100");
  g.setAttribute("class", "fill s-" + status);
  $("v-" + key).textContent = fmt(key, value);
  const chip = $("chip-" + key);
  chip.className = "chip s-" + status;
  chip.textContent = t(status);

  const vals = seriesOf(snap, key);
  drawSpark(key, vals);
  const sum = vals.reduce((a, b) => a + b, 0);
  $("min-" + key).textContent = fmt(key, Math.min(...vals));
  $("avg-" + key).textContent = fmt(key, sum / vals.length);
  $("max-" + key).textContent = fmt(key, Math.max(...vals));
  drawTicks(key, snap.seuils);
}

function renderSummary(snap) {
  const d = snap.donnees;
  const badge = $("globalStatus");
  badge.className = "badge s-" + snap.statut_global;
  badge.textContent = t("global_" + snap.statut_global);
  $("sumPump").textContent = t(d.pompe_active ? "pump_on" : "pump_off");
  $("sumLamp").className = "mini-lamp" + (d.pompe_active ? " on" : "");
  $("sumAlarms").textContent = KEYS.filter((k) => snap.statuts[k] !== "NORMAL").length;
  $("sumUpdate").textContent = timeOf(d.horodatage);
}

function renderSynoptic(d) {
  const on = d.pompe_active;
  $("impeller").setAttribute("class", "impeller" + (on ? " on" : ""));
  $("pumpBody").setAttribute("class", "pump-body" + (on ? " on" : ""));
  $("pumpLamp").setAttribute("class", "lamp" + (on ? " on" : ""));
  $("flowIn").setAttribute("class", "flow" + (on ? " on" : ""));
  const st = $("pumpState");
  st.setAttribute("class", "pump-state" + (on ? " on" : ""));
  st.textContent = t(on ? "pump_on" : "pump_off");

  const h = (Math.max(0, Math.min(100, d.niveau_pourcent)) / 100) * 166;
  $("water").setAttribute("y", 198 - h);
  $("water").setAttribute("height", h);
  $("levelText").textContent = fmt("niveau", d.niveau_pourcent) + " %";
  $("roTemp").textContent = fmt("temperature", d.temperature_celsius) + " °C";
  $("roPres").textContent = fmt("pression", d.pression_bar) + " bar · " + fmt("debit", d.debit_m3h) + " m³/h";
}

function renderBanner(snap) {
  const banner = $("banner");
  const d = snap.donnees;
  const active = KEYS.filter((k) => snap.statuts[k] !== "NORMAL");
  if (active.length === 0) {
    banner.className = "banner hidden";
    banner.textContent = "";
    return;
  }
  banner.className = "banner s-" + snap.statut_global;
  banner.textContent = "⚠ " + active.map((k) =>
    `${t(k)} : ${t(snap.statuts[k])} (${fmt(k, d[FIELD[k]])} ${UNITS[k]})`).join("   ·   ");
}

function renderEvents(snap) {
  const rows = snap.evenements.map((e) => `<tr>
      <td>${timeOf(e.horodatage)}</td>
      <td>${t(e.capteur)}</td>
      <td><span class="chip s-${e.gravite}">${e.gravite === "NORMAL" ? t("back_normal") : t(e.gravite)}</span></td>
      <td>${fmt(e.capteur, e.valeur)} ${UNITS[e.capteur]}</td>
    </tr>`);
  $("eventsBody").innerHTML = rows.length
    ? rows.join("")
    : `<tr><td class="empty" colspan="4">${t("no_events")}</td></tr>`;
}

/* ---------- trend chart ---------- */
let geo = null;   // geometry of the last drawn chart (used by the hover)

function drawChart() {
  const base = $("chartBase");
  const hist = last ? last.historique : [];
  const { W, H, L, R, T, B } = CHART;
  const f = FIELD[metric];
  const vals = hist.map((h) => h[f]);
  if (vals.length < 2) { base.innerHTML = ""; geo = null; return; }

  const thr = last.seuils ? last.seuils[metric] : null;
  const extra = thr ? [thr.avertissement, thr.critique] : [];
  let lo = Math.min(...vals, ...extra);
  let hi = Math.max(...vals, ...extra);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;

  const x = (i) => L + (i * (W - L - R)) / (vals.length - 1);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  geo = { x, y, vals, hist, n: vals.length };

  let out = "";
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    out += `<line class="grid-line" x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}"/>`;
    out += `<text class="axis-text" x="${L - 7}" y="${y(v) + 4}" text-anchor="end">${num(v, metric === "pression" ? 1 : 0)}</text>`;
  }
  if (thr) {
    out += `<line class="thr-warn" x1="${L}" y1="${y(thr.avertissement)}" x2="${W - R}" y2="${y(thr.avertissement)}"/>`;
    out += `<line class="thr-crit" x1="${L}" y1="${y(thr.critique)}" x2="${W - R}" y2="${y(thr.critique)}"/>`;
  }
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  out += `<polygon class="series-area" points="${L},${H - B} ${pts.join(" ")} ${W - R},${H - B}"/>`;
  out += `<polyline class="series" points="${pts.join(" ")}"/>`;

  const spanMin = Math.max(1, Math.round(((vals.length - 1) * 2) / 60));
  out += `<text class="axis-text" x="${L}" y="${H - 8}" text-anchor="start">-${spanMin} min</text>`;
  out += `<text class="axis-text" x="${W - R}" y="${H - 8}" text-anchor="end">${t("now")}</text>`;
  out += `<text class="axis-text" x="${L + 4}" y="9" text-anchor="start">${UNITS[metric]}</text>`;
  base.innerHTML = out;
  updateHover();
}

function updateHover() {
  const group = $("chartHover");
  if (!geo || hoverX === null) { group.classList.add("hidden"); return; }
  const { L, R, W, T } = CHART;
  const idx = Math.max(0, Math.min(geo.n - 1, Math.round(((hoverX - L) / (W - L - R)) * (geo.n - 1))));
  const px = geo.x(idx), py = geo.y(geo.vals[idx]);
  group.classList.remove("hidden");
  $("hoverLine").setAttribute("x1", px);
  $("hoverLine").setAttribute("x2", px);
  $("hoverDot").setAttribute("cx", px);
  $("hoverDot").setAttribute("cy", py);
  const tipX = px > W / 2 ? px - 142 : px + 10;
  const tipY = Math.max(T, py - 52);
  $("tipBg").setAttribute("x", tipX);
  $("tipBg").setAttribute("y", tipY);
  $("tipTime").setAttribute("x", tipX + 10);
  $("tipTime").setAttribute("y", tipY + 16);
  $("tipTime").textContent = timeOf(geo.hist[idx].horodatage);
  $("tipVal").setAttribute("x", tipX + 10);
  $("tipVal").setAttribute("y", tipY + 34);
  $("tipVal").textContent = fmt(metric, geo.vals[idx]) + " " + UNITS[metric];
}

function setupChartHover() {
  const svg = $("chart");
  svg.addEventListener("mousemove", (ev) => {
    const rect = svg.getBoundingClientRect();
    hoverX = ((ev.clientX - rect.left) / rect.width) * CHART.W;
    updateHover();
  });
  svg.addEventListener("mouseleave", () => { hoverX = null; updateHover(); });
}

/* ---------- CSV export ---------- */
function exportCsv() {
  if (!last) return;
  const header = "timestamp,temperature_celsius,pression_bar,niveau_pourcent,debit_m3h,pompe_active";
  const lines = last.historique.map((h) =>
    [h.horodatage, h.temperature_celsius, h.pression_bar, h.niveau_pourcent, h.debit_m3h, h.pompe_active].join(","));
  const blob = new Blob([header + "\n" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "scadasec-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function render(snap) {
  last = snap;
  KEYS.forEach((k) => setKpi(snap, k));
  renderSummary(snap);
  renderBanner(snap);
  renderSynoptic(snap.donnees);
  drawChart();
  renderEvents(snap);
}

/* ================================================================== */
/*  Demo mode: same simulation as the Java server, run in the browser  */
/*  (used when the server is not reachable, e.g. index.html opened     */
/*  directly from the disk)                                            */
/* ================================================================== */
function createDemo() {
  const THRESHOLDS = {
    temperature: { avertissement: 75, critique: 90 },
    pression: { avertissement: 7, critique: 8.5 }
  };
  let temp = 55, pres = 4, niv = 60, deb = 0, pump = false, surge = 0;
  const history = [];
  const events = [];
  const status = { temperature: "NORMAL", pression: "NORMAL", niveau: "NORMAL", debit: "NORMAL" };

  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  const high = (v, w, c) => (v >= c ? "CRITIQUE" : v >= w ? "AVERTISSEMENT" : "NORMAL");
  const levelStatus = (v) =>
    v <= 10 || v >= 95 ? "CRITIQUE" : v <= 20 || v >= 85 ? "AVERTISSEMENT" : "NORMAL";

  function step(date) {
    if (niv < 40) pump = true; else if (niv > 80) pump = false;
    if (surge > 0) surge--; else if (Math.random() < 0.01) surge = 8;
    const hot = surge > 0;

    temp = clamp(temp + ((pump ? 62 : 55) + (hot ? 45 : 0) - temp) * 0.15 + gauss() * 0.6, 15, 120);
    pres = clamp(pres + ((pump ? 6 : 3.5) + (hot ? 3 : 0) - pres) * 0.2 + gauss() * 0.12, 0, 10);
    niv = clamp(niv + (pump ? 1.2 : -0.7) + gauss() * 0.15, 0, 100);
    deb = clamp(deb + ((pump ? 120 : 0) - deb) * 0.4 + (pump ? gauss() * 2 : 0), 0, 200);

    const d = {
      temperature_celsius: r1(temp),
      pression_bar: r1(pres),
      niveau_pourcent: r1(niv),
      debit_m3h: r1(deb),
      pompe_active: pump,
      horodatage: date.toISOString()
    };
    const now = {
      temperature: high(d.temperature_celsius, 75, 90),
      pression: high(d.pression_bar, 7, 8.5),
      niveau: levelStatus(d.niveau_pourcent),
      debit: "NORMAL"
    };
    KEYS.forEach((k) => {
      if (now[k] !== status[k]) {
        events.unshift({ horodatage: d.horodatage, capteur: k, gravite: now[k], valeur: d[FIELD[k]] });
      }
      status[k] = now[k];
    });
    if (events.length > 30) events.length = 30;
    history.push(d);
    if (history.length > 60) history.shift();
    return d;
  }

  for (let i = 30; i >= 1; i--) step(new Date(Date.now() - i * 2000));

  return function snapshot() {
    const d = step(new Date());
    const order = ["NORMAL", "AVERTISSEMENT", "CRITIQUE"];
    const worst = KEYS.reduce((w, k) => (order.indexOf(status[k]) > order.indexOf(w) ? status[k] : w), "NORMAL");
    return {
      donnees: d,
      statuts: { ...status },
      statut_global: worst,
      historique: history.slice(),
      evenements: events.slice(),
      seuils: THRESHOLDS
    };
  };
}

let demoSnapshot = null;

/* ================================================================== */
/*  Data refresh                                                      */
/* ================================================================== */
function setConnection(cls, key) {
  $("dot").className = "dot " + cls;
  const txt = $("connText");
  txt.dataset.i18n = key;
  txt.textContent = t(key);
}

async function refresh() {
  if (paused) return;
  try {
    if (window.location.protocol === "file:") throw new Error("opened from disk");
    const r = await fetch("/etat", { cache: "no-store" });
    if (r.redirected || r.status === 401) {   // session expired: back to the login page
      window.location.href = "/login.html";
      return;
    }
    if (!r.ok) throw new Error(r.status);
    render(await r.json());
    setConnection("on", "online");
    if (!currentUser) loadUser();
  } catch (e) {
    // Server not reachable: keep the dashboard alive with local demo data
    if (!demoSnapshot) demoSnapshot = createDemo();
    render(demoSnapshot());
    setConnection("demo", "demo");
  }
}

function updatePauseButton() {
  $("btnPause").title = t(paused ? "tt_resume" : "tt_pause");
  $("btnPause").classList.toggle("active", paused);
  document.querySelector("#btnPause .i-pause").classList.toggle("hidden", paused);
  document.querySelector("#btnPause .i-play").classList.toggle("hidden", !paused);
}

function togglePause() {
  paused = !paused;
  updatePauseButton();
  if (paused) setConnection("paused", "paused");
  else refresh();
}

function tickClock() {
  $("clock").textContent = new Date().toLocaleTimeString(locale());
}

/* ================================================================== */
/*  Start                                                             */
/* ================================================================== */
buildKpis();
buildTabs();
markTabs();
setupChartHover();

document.querySelectorAll(".lang button").forEach((b) => {
  b.addEventListener("click", () => applyLang(b.dataset.lang));
});
$("btnPause").addEventListener("click", togglePause);
$("btnTheme").addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
$("btnFull").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
});
$("btnCsv").addEventListener("click", exportCsv);
$("logoutBtn").addEventListener("click", logout);

applyTheme(storedValue("theme", ["dark", "light"], "dark"));
applyLang(storedValue("lang", ["fr", "en"], "fr"));
tickClock();
setInterval(tickClock, 1000);
refresh();
setInterval(refresh, 2000);
