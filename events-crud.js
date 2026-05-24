// ============================================================
//  🚒 FW Terminplaner – events-crud.js
//
//  Termin CRUD: Speichern, Bearbeiten, Löschen, Reaktivieren,
//  Formular-Reset, Ganztägig-Toggle.
//
//  Abhängigkeiten: config.js (store, editEventIndex, DEFAULT_LOCATION),
//                  api.js (saveEventToGitHub, deleteEventFromGitHub,
//                          reactivateEventFromGitHub,
//                          deleteCancelledEventFromGitHub),
//                  ui.js (showModal, showScreen, showToast),
//                  timepicker.js (setTimeDisplay),
//                  events-render.js (render, setActiveCategory, clearBadges)
// ============================================================

// Globale Variable: wird bei Reaktivierung gesetzt
let _reactivatingId = null;

/* =========================
   💾 SPEICHERN
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
    important: document.getElementById("important").checked,
    reminder1: document.getElementById("reminder1").value,
    reminder2: document.getElementById("reminder2").value
  };

  let ok;
  if (_reactivatingId) {
    // Reaktivierung: abgesagten Termin zurück nach termine.json
    ok = await reactivateEventFromGitHub(_reactivatingId, eventData);
    if (ok) _reactivatingId = null;
  } else {
    ok = await saveEventToGitHub(eventData, editEventIndex);
  }

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

/* =========================
   ✏️ BEARBEITEN
========================= */

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

  const importantEl    = document.getElementById("important");
  const importantLabel = document.getElementById("important-label");
  importantEl.checked        = !!e.important;
  importantLabel.textContent = e.important ? "Ja" : "Nein";
  importantLabel.style.color = e.important ? "#d32f2f" : "#888";

  setActiveCategory("form", e.category);
}

/* =========================
   🗑️ LÖSCHEN
========================= */

function deleteEvent(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) card.style.opacity = "0.4";
  deleteEventFromGitHub(id);  // Dialog (Absagen/Löschen) ist in api.js
}

function deleteCancelledEvent(id) {
  showModal({
    title: "Abgesagten Termin löschen",
    text: "Diesen Termin endgültig löschen? Er verschwindet auch aus dem Kalender-Abo.",
    onConfirm: () => deleteCancelledEventFromGitHub(id)
  });
}

/* =========================
   ♻️ REAKTIVIEREN
========================= */

function reactivateEvent(id) {
  const e = (store.geloeschte || []).find(g => g.id === id);
  if (!e) return;

  _reactivatingId = id;
  showScreen("form");

  document.getElementById("formTitle").textContent = "♻️ Termin reaktivieren";
  document.getElementById("title").value    = e.title;
  document.getElementById("desc").value     = e.desc    || "";
  document.getElementById("location").value = e.location || DEFAULT_LOCATION;

  setEventType(e.allday ? "allday" : "normal");
  if (e.allday) {
    const dsEl = document.getElementById("date_start");
    if (dsEl) dsEl.value = e.date || "";
    const deEl = document.getElementById("date_end");
    if (deEl) deEl.value = e.date_end || "";
  } else {
    document.getElementById("date").value = e.date || "";
    setTimeDisplay("start", e.start);
    setTimeDisplay("end",   e.end);
  }

  document.getElementById("category").value  = e.category  || "other";
  document.getElementById("reminder1").value = e.reminder1 || "";
  document.getElementById("reminder2").value = e.reminder2 || "";

  const importantEl    = document.getElementById("important");
  const importantLabel = document.getElementById("important-label");
  importantEl.checked        = !!e.important;
  importantLabel.textContent = e.important ? "Ja" : "Nein";
  importantLabel.style.color = e.important ? "#d32f2f" : "#888";

  setActiveCategory("form", e.category);
}

/* =========================
   🔄 FORMULAR RESET
========================= */

function resetForm() {
  editEventIndex  = null;
  _reactivatingId = null;
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
  document.getElementById("important").checked   = false;
  const impLabel = document.getElementById("important-label");
  if (impLabel) { impLabel.textContent = "Nein"; impLabel.style.color = "#888"; }
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
