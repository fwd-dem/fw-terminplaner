// ============================================================
//  🚒 FW Terminplaner – events-render.js
//
//  Render-Logik: Liste aufbauen, Karten erstellen,
//  Hilfs- und Badge-Funktionen.
//
//  Abhängigkeiten: config.js (store, activeFilters, hidePast),
//                  ui.js (showModal)
// ============================================================

/* =========================
   🧠 LOGIC HELPERS
========================= */

function isPast(date) {
  if (!date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(date); d.setHours(0, 0, 0, 0);
  return d < today;
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("de-DE");
}

function formatEventDate(e) {
  if (!e.allday) return formatDate(e.date);
  if (!e.date_end || e.date_end === e.date) return formatDate(e.date) + " · Ganztägig";
  return formatDate(e.date) + " – " + formatDate(e.date_end);
}

function getCategoryMeta(category) {
  switch (category) {
    case "active": return { text: "Aktive",        color: "#ff4d4d" };
    case "group":  return { text: "Gruppenführer", color: "#4d79ff" };
    case "resp":   return { text: "Atemschutz",    color: "#ffcc00" };
    case "club":   return { text: "Verein",        color: "#33cc66" };
    default:       return { text: "Sonstiges",     color: "#999"    };
  }
}

function getCategoryBg(category, past) {
  if (past) return "#e6e6e6";
  switch (category) {
    case "active": return "#ffcccc";
    case "group":  return "#cce0ff";
    case "resp":   return "#fff5cc";
    case "club":   return "#ccffcc";
    default:       return "#fff";
  }
}

/* =========================
   🏷️ BADGE HELPERS
========================= */

function setActiveCategory(context, cat) {
  const selector  = context === "form" ? ".form-category" : ".tpl-category";
  const container = document.querySelector(selector);
  if (!container) return;
  container.querySelectorAll(".badge").forEach(b => b.classList.remove("selected"));
  if (!cat) return;
  container.querySelector(`.badge[data-cat="${cat}"]`)?.classList.add("selected");
}

function clearBadges(context) {
  setActiveCategory(context, null);
}

/* =========================
   📅 EVENTS – RENDER
========================= */

function render() {
  const list = document.getElementById("eventList");
  list.innerHTML = "";

  const filterPlanned   = activeFilters.includes("planned");
  const filterCancelled = activeFilters.includes("cancelled");
  const catFilters      = activeFilters.filter(f => f !== "planned" && f !== "cancelled");

  // Default: beide anzeigen. Filter "Geplant" oder "Abgesagt" schränken ein.
  const showActive    = !filterCancelled || filterPlanned;
  const showCancelled = !filterPlanned   || filterCancelled;

  // Aktive Termine
  let events = showActive ? [...store.events] : [];
  if (catFilters.length > 0) events = events.filter(e => catFilters.includes(e.category));
  if (hidePast) events = events.filter(e => !isPast(e.date));

  // Abgesagte Termine
  let cancelled = showCancelled ? [...(store.geloeschte || [])] : [];
  if (catFilters.length > 0) cancelled = cancelled.filter(e => catFilters.includes(e.category));
  if (hidePast) cancelled = cancelled.filter(e => !isPast(e.date));

  // Zusammenführen und chronologisch sortieren
  const allCards = [
    ...events.map(e => ({ ...e, _cancelled: false })),
    ...cancelled.map(e => ({ ...e, _cancelled: true }))
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (allCards.length === 0) {
    list.innerHTML = store.events.length === 0 && (store.geloeschte || []).length === 0
      ? "<p>Keine Termine vorhanden</p>"
      : `<div class="card" style="text-align:center; color:#777; padding:20px;">🔍 nichts gefunden</div>`;
    return;
  }

  allCards.forEach(e => list.appendChild(
    e._cancelled ? createCancelledCard(e) : createEventCard(e)
  ));

  list.style.marginTop = "20px";
}

function createEventCard(e) {
  const card      = document.createElement("div");
  card.className  = "card";
  const past      = isPast(e.date);
  const meta      = getCategoryMeta(e.category);
  const bg        = getCategoryBg(e.category, past);
  const textColor = past ? "#888" : "#000";
  const subColor  = past ? "#888" : "#777";

  card.dataset.id         = e.id;
  card.style.background   = bg;
  card.style.marginBottom = "12px";
  card.style.padding      = "16px";

  card.innerHTML = `
    <div style="font-size:13px; color:${subColor};">📅 ${formatEventDate(e)}</div>
    <div style="font-size:18px; font-weight:bold; margin-top:6px; color:${textColor};">
      ${e.important ? '<img src="star.png" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;">' : ""}${e.title || "(kein Titel)"}
    </div>
    <div style="font-size:13px; margin-top:4px; color:${textColor};">
      ${e.allday ? "Ganztägig" : "⏰ " + (e.start || "-") + " – " + (e.end || "-")}
    </div>
    <div style="font-size:13px; margin-top:4px; color:${subColor};">
      📍 ${e.location || "kein Ort"}
    </div>
    <div style="
      display:inline-block;
      background:${meta.color};
      color:${e.category === 'resp' ? '#333' : 'white'};
      padding:3px 8px; border-radius:12px; font-size:11px; margin-top:8px;">
      ${meta.text}
    </div>
    <div style="margin-top:10px;">
      <button onclick="editEvent('${e.id}')">✏️ Bearbeiten</button>
      <button onclick="deleteEvent('${e.id}')">🗑️ Löschen</button>
    </div>`;

  return card;
}

function createCancelledCard(e) {
  const card     = document.createElement("div");
  card.className = "card";
  card.dataset.id         = e.id;
  card.style.background   = "#f0f0f0";
  card.style.marginBottom = "12px";
  card.style.padding      = "16px";
  card.style.opacity      = "0.8";

  const meta = getCategoryMeta(e.category);

  card.innerHTML = `
    <div style="font-size:13px; color:#999;">📅 ${formatEventDate(e)}</div>
    <div style="font-size:18px; font-weight:bold; margin-top:6px; color:#888; text-decoration:line-through;">
      ${e.title || "(kein Titel)"}
    </div>
    <div style="font-size:13px; margin-top:4px; color:#999; text-decoration:line-through;">
      ${e.allday ? "Ganztägig" : "⏰ " + (e.start || "-") + " – " + (e.end || "-")}
    </div>
    <div style="font-size:13px; margin-top:4px; color:#999; text-decoration:line-through;">
      📍 ${e.location || "kein Ort"}
    </div>
    <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
      <div style="
        background:${meta.color};
        color:${e.category === 'resp' ? '#333' : 'white'};
        padding:3px 8px; border-radius:12px; font-size:11px;">
        ${meta.text}
      </div>
      <div style="
        background:#888; color:white;
        padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">
        🚫 ABGESAGT
      </div>
    </div>
    <div style="margin-top:10px;">
      <button onclick="reactivateEvent('${e.id}')">♻️ Reaktivieren</button>
      <button onclick="deleteCancelledEvent('${e.id}')">🗑️ Löschen</button>
    </div>`;

  return card;
}
