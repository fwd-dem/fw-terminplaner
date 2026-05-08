// ============================================================
//  🚒 FW Terminplaner – events.js
//
//  Terminverwaltung: Render, CRUD, Formular, Filter,
//  Export/Import (JSON).
//  Abhängigkeiten: config.js, api.js, github.js, ui.js, timepicker.js
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

  if (store.events.length === 0) {
    list.innerHTML = "<p>Keine Termine vorhanden</p>";
    return;
  }

  let events = [...store.events];

  if (activeFilters.length > 0) {
    events = events.filter(e => activeFilters.includes(e.category));
  }
  if (hidePast) {
    events = events.filter(e => !isPast(e.date));
  }

  if (events.length === 0) {
    list.innerHTML = `
      <div class="card" style="text-align:center; color:#777; padding:20px;">
        🔍 nichts gefunden
      </div>`;
    return;
  }

  events
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(e => list.appendChild(createEventCard(e)));

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
      ${e.title || "(kein Titel)"}
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

/* =========================
   📅 EVENTS – CRUD
========================= */

function saveEvent() {
  const titleEl = document.getElementById("title");
  const dateEl  = document.getElementById("date");
  const startEl = document.getElementById("start");
  const endEl   = document.getElementById("end");

  if (!titleEl.value.trim()) {
    showModal({ title: "Fehlende Eingabe", text: "Bitte einen Titel eingeben.", onConfirm: () => {} });
    return;
  }

  const isAllDay  = getCurrentEventType() === "allday";
  const dateValue = isAllDay
    ? (document.getElementById("date_start")?.value || "")
    : dateEl.value;

  if (!dateValue) {
    showModal({ title: "Fehlende Eingabe", text: "Bitte ein Datum eingeben.", onConfirm: () => {} });
    return;
  }

  if (!isAllDay && startEl.value && endEl.value && endEl.value <= startEl.value) {
    showModal({ title: "Ungültige Uhrzeit", text: "Die Endzeit muss nach der Startzeit liegen.", onConfirm: () => {} });
    return;
  }

  if (isAllDay) {
    const dateEnd   = document.getElementById("date_end")?.value || "";
    const dateStart = document.getElementById("date_start")?.value || "";
    if (dateEnd && dateStart && dateEnd < dateStart) {
      showModal({ title: "Ungültiges Datum", text: "Das Bis-Datum muss gleich oder nach dem Von-Datum liegen.", onConfirm: () => {} });
      return;
    }
  }

  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const inputDate = new Date(dateValue); inputDate.setHours(0, 0, 0, 0);

  if (inputDate < today) {
    showModal({
      title: "Termin in der Vergangenheit",
      text: "Trotzdem speichern?",
      onConfirm: () => saveEventForce()
    });
    return;
  }

  saveEventForce();
}

async function saveEventForce() {
  const isAllDay = getCurrentEventType() === "allday";
  const dateVal  = isAllDay
    ? (document.getElementById("date_start")?.value || "")
    : document.getElementById("date").value;

  const eventData = {
    title:     document.getElementById("title").value,
    date:      dateVal,
    date_end:  isAllDay ? (document.getElementById("date_end")?.value || "") : "",
    allday:    isAllDay,
    start:     isAllDay ? "" : document.getElementById("start").value,
    end:       isAllDay ? "" : document.getElementById("end").value,
    location:  document.getElementById("location").value,
    desc:      document.getElementById("desc").value,
    category:  document.getElementById("category").value || "other",
    reminder1: document.getElementById("reminder1").value,
    reminder2: document.getElementById("reminder2").value
  };

  const ok = await saveEventToGitHub(eventData, editEventIndex);

  if (ok) {
    editEventIndex = null;
    document.getElementById("formTitle").textContent = "➕ Termin";
    render();
    showToast();
    // Datumsfelder zurücksetzen
    document.getElementById("date").value = "";
    const dsEl = document.getElementById("date_start");
    if (dsEl) dsEl.value = "";
    const deEl = document.getElementById("date_end");
    if (deEl) deEl.value = "";
  }
}

function editEvent(id) {
  const e = store.events.find(ev => ev.id === id);
  if (!e) return;

  editEventIndex = id;
  showScreen("form");

  document.getElementById("formTitle").textContent = "✏️ Termin bearbeiten";
  document.getElementById("title").value    = e.title;
  document.getElementById("desc").value     = e.desc;
  document.getElementById("location").value = e.location;

  setEventType(e.allday ? "allday" : "normal");
  if (e.allday) {
    const dsEl = document.getElementById("date_start");
    if (dsEl) dsEl.value = e.date || "";
    const deEl = document.getElementById("date_end");
    if (deEl) deEl.value = e.date_end || "";
  } else {
    document.getElementById("date").value = e.date;
    setTimeDisplay("start", e.start);
    setTimeDisplay("end",   e.end);
  }

  document.getElementById("category").value  = e.category;
  document.getElementById("reminder1").value = e.reminder1 || "";
  document.getElementById("reminder2").value = e.reminder2 || "";
  setActiveCategory("form", e.category);
}

function deleteEvent(id) {
  showModal({
    title: "Termin löschen",
    text: "Diesen Termin wirklich löschen?",
    onConfirm: async () => {
      const card = document.querySelector(`[data-id="${id}"]`);
      if (card) card.style.opacity = "0.4";
      await deleteEventFromGitHub(id);
    }
  });
}

function resetForm() {
  editEventIndex = null;
  document.getElementById("formTitle").textContent = "➕ Termin";
  setEventType("normal");
  document.getElementById("date").value = "";
  const dsEl = document.getElementById("date_start");
  if (dsEl) dsEl.value = "";
  const deEl = document.getElementById("date_end");
  if (deEl) deEl.value = "";
  setTimeDisplay("start", "");
  setTimeDisplay("end",   "");
  document.getElementById("title").value          = "";
  document.getElementById("desc").value           = "";
  document.getElementById("location").value       = DEFAULT_LOCATION;
  document.getElementById("category").value       = "";
  document.getElementById("templateSelect").value = "";
  document.getElementById("reminder1").value      = "";
  document.getElementById("reminder2").value      = "";
  clearBadges("form");
}

/* =========================
   📅 GANZTÄGIG / MEHRTÄGIG TOGGLE
========================= */

function getCurrentEventType() {
  const btn = document.getElementById("btn-allday");
  return btn && btn.classList.contains("active") ? "allday" : "normal";
}

function setEventType(type) {
  const btnNormal = document.getElementById("btn-normal");
  const btnAllday = document.getElementById("btn-allday");
  const blockNorm = document.getElementById("block-normal");
  const blockAll  = document.getElementById("block-allday");
  if (!btnNormal) return;

  if (type === "allday") {
    btnNormal.classList.remove("active");
    btnAllday.classList.add("active");
    blockNorm.style.display = "none";
    blockAll.style.display  = "block";
    setTimeDisplay("start", "");
    setTimeDisplay("end",   "");
  } else {
    btnAllday.classList.remove("active");
    btnNormal.classList.add("active");
    blockNorm.style.display = "block";
    blockAll.style.display  = "none";
    const deEl = document.getElementById("date_end");
    if (deEl) deEl.value = "";
  }
}

/* =========================
   📤📥 TERMINE EXPORT / IMPORT
========================= */

function exportEvents() {
  if (store.events.length === 0) {
    showModal({ title: "Keine Termine", text: "Es sind keine Termine vorhanden.", onConfirm: () => {} });
    return;
  }

  const blob = new Blob([JSON.stringify(store.events, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fw-termine-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importEvents(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = "";

  const reader = new FileReader();
  reader.onload = async (e) => {
    let imported;
    try {
      imported = JSON.parse(e.target.result);
    } catch {
      showModal({ title: "Ungültige Datei", text: "Die Datei konnte nicht gelesen werden.", onConfirm: () => {} });
      return;
    }

    if (!Array.isArray(imported)) {
      showModal({ title: "Ungültiges Format", text: "Die Datei enthält keine gültige Terminliste.", onConfirm: () => {} });
      return;
    }

    const valid = imported.filter(e => e && typeof e === "object" && e.id && e.date);

    if (valid.length === 0) {
      showModal({ title: "Keine Termine gefunden", text: "Die Datei enthält keine lesbaren Termine.", onConfirm: () => {} });
      return;
    }

    const existingIds = new Set(store.events.map(e => e.id));
    const newEvents   = valid.filter(e => !existingIds.has(e.id));

    if (newEvents.length === 0) {
      showModal({ title: "Nichts Neues", text: "Alle Termine sind bereits vorhanden.", onConfirm: () => {} });
      return;
    }

    showModal({
      title: "Termine importieren",
      text: `${newEvents.length} neue Termine werden importiert (${valid.length - newEvents.length} bereits vorhanden).`,
      onConfirm: async () => {
        showLoading(true);

        // Alle neuen Termine in den Store einfügen
        newEvents.forEach(ev => {
          store.events.push({
            id:        ev.id || crypto.randomUUID(),
            title:     ev.title     || "",
            date:      ev.date      || "",
            date_end:  ev.date_end  || "",
            allday:    ev.allday    || false,
            start:     ev.start     || "",
            end:       ev.end       || "",
            location:  ev.location  || "",
            desc:      ev.desc      || "",
            category:  ev.category  || "other",
            reminder1: ev.reminder1 || "",
            reminder2: ev.reminder2 || ""
          });
        });

        // Einmal als gesamte Liste zu GitHub schreiben
        const result = await saveEvents();
        showLoading(false);

        if (result.ok) {
          render();
          showModal({
            title: "Import abgeschlossen",
            text: `${newEvents.length} Termin(e) erfolgreich importiert.`,
            onConfirm: () => {}
          });
        } else {
          // Rollback
          const importedIds = new Set(newEvents.map(e => e.id));
          store.events = store.events.filter(e => !importedIds.has(e.id));
          showModal({
            title: "Import fehlgeschlagen",
            text: `Fehler: ${result.reason}\n\nBitte versuche es erneut.`,
            onConfirm: () => {}
          });
        }
      }
    });
  };

  reader.readAsText(file);
}
