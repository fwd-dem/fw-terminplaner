// ============================================================
//  🚒 FW Terminplaner – api.js
//
//  Daten-Operationen für Termine, Vorlagen und Geburtstage.
//  Alle Lese-/Schreibzugriffe laufen über github.js.
//  Railway wurde vollständig entfernt.
//
//  Abhängigkeiten: config.js, github.js, ui.js
//                  (showModal, showLoading, setSaveButtonState,
//                   render, renderTemplates, renderGeburtstage)
// ============================================================

/* =========================
   🔒 SAVE LOCK
========================= */

let _eventSaving = false;  // verhindert gleichzeitige GitHub-Writes bei Terminen

/* =========================
   🟢 STATUS DOT
========================= */

function setStatusDot(state) {
  const dot = document.getElementById("status-dot");
  if (!dot) return;

  dot.classList.remove("status-checking", "status-online", "status-offline");

  if (state === "online") {
    dot.classList.add("status-online");
    dot.title = "✅ GitHub erreichbar";
  } else if (state === "offline") {
    dot.classList.add("status-offline");
    dot.title = "❌ GitHub nicht erreichbar";
  } else {
    dot.classList.add("status-checking");
    dot.title = "Verbindung wird geprüft…";
  }
}

/* =========================
   📅 TERMINE
========================= */

// Neuen Termin anlegen oder bestehenden aktualisieren
async function saveEventToGitHub(eventData, existingId) {
  if (_eventSaving) {
    showModal({
      title: "⏳ Bitte warten",
      text: "Ein Speichervorgang läuft bereits. Bitte kurz warten und erneut versuchen.",
      onConfirm: () => {}
    });
    return false;
  }
  _eventSaving = true;
  setSaveButtonState(true);

  try {
    if (existingId) {
      // Update: Termin im Array ersetzen
      const index = store.events.findIndex(e => e.id === existingId);
      if (index !== -1) store.events[index] = { ...eventData, id: existingId };
    } else {
      // Neu: ID generieren und anhängen
      const newEvent = { ...eventData, id: crypto.randomUUID() };
      store.events.push(newEvent);
    }

    const result = await saveEvents();

    if (!result.ok) {
      // Lokale Änderung rückgängig machen
      await loadAllData();
      showModal({
        title: "⚠️ Speichern fehlgeschlagen",
        text: `Fehler: ${result.reason}\n\nBitte versuche es erneut.`,
        onConfirm: () => {}
      });
      return false;
    }

    return true;

  } catch(e) {
    showModal({
      title: "⚠️ Fehler",
      text: e.message,
      onConfirm: () => {}
    });
    return false;
  } finally {
    _eventSaving = false;
    setSaveButtonState(false);
  }
}

// Termin löschen — Dialog nur bei zukünftigen Terminen
function deleteEventFromGitHub(id) {
  const event = store.events.find(e => e.id === id);
  if (!event) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(event.date); d.setHours(0, 0, 0, 0);
  const isFuture = d >= today;

  if (isFuture) {
    // Zukünftiger Termin → Dialog: Absagen oder Still löschen
    _showDeleteDialog(event);
  } else {
    // Vergangener Termin → direkt still löschen
    showModal({
      title: "Termin löschen",
      text: "Diesen vergangenen Termin wirklich löschen?",
      onConfirm: () => _silentDeleteEvent(id)
    });
  }
}

// Dialog: Absagen (CANCELLED im ICS) oder Still löschen
function _showDeleteDialog(event) {
  const overlay    = document.getElementById("modal-overlay");
  const titleEl    = document.getElementById("modal-title");
  const textEl     = document.getElementById("modal-text");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn  = document.getElementById("modal-cancel");
  const actions    = document.querySelector(".modal-actions");

  titleEl.textContent = "Termin entfernen";
  textEl.textContent  = `Was soll mit "${event.title}" passieren?`;
  overlay.classList.remove("hidden");

  // Dritten Button (Absagen) einmalig anlegen
  let abortBtn = document.getElementById("modal-abort");
  if (!abortBtn) {
    abortBtn = document.createElement("button");
    abortBtn.id = "modal-abort";
    abortBtn.style.cssText = "flex:1; padding:10px; border:none; border-radius:12px; cursor:pointer; font-weight:bold;";
    actions.appendChild(abortBtn);
  }
  abortBtn.textContent        = "🚫 Absagen";
  abortBtn.style.background   = "#ff9800";
  abortBtn.style.color        = "white";
  abortBtn.style.display      = "block";

  confirmBtn.textContent      = "🗑️ Löschen";
  confirmBtn.style.background = "#d32f2f";
  confirmBtn.style.color      = "white";
  cancelBtn.textContent       = "Abbrechen";

  confirmBtn.onclick = () => { _resetDeleteDialog(); _silentDeleteEvent(event.id); };
  abortBtn.onclick   = () => { _resetDeleteDialog(); _cancelEvent(event); };
  cancelBtn.onclick  = () => { _resetDeleteDialog(); };
}

function _resetDeleteDialog() {
  hideModal();
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn  = document.getElementById("modal-cancel");
  const abortBtn   = document.getElementById("modal-abort");
  if (confirmBtn) { confirmBtn.textContent = "OK"; confirmBtn.style.background = ""; confirmBtn.style.color = ""; }
  if (cancelBtn)  { cancelBtn.textContent  = "Abbrechen"; }
  if (abortBtn)   { abortBtn.style.display = "none"; }
}

// Termin still löschen (kein CANCELLED)
async function _silentDeleteEvent(id) {
  if (_eventSaving) {
    showModal({ title: "⏳ Bitte warten", text: "Ein Speichervorgang läuft bereits.", onConfirm: () => {} });
    return;
  }
  _eventSaving = true;
  const backup = [...store.events];

  store.events = store.events.filter(e => e.id !== id);
  render();

  const result = await saveEvents();
  if (!result.ok) {
    store.events = backup;
    render();
    showModal({
      title: "⚠️ Löschen fehlgeschlagen",
      text: `Fehler: ${result.reason}\n\nBitte versuche es erneut.`,
      onConfirm: () => {}
    });
  }
  _eventSaving = false;
}

// Termin absagen — vollständige Daten in geloeschte_termine.json
async function _cancelEvent(event) {
  if (_eventSaving) {
    showModal({ title: "⏳ Bitte warten", text: "Ein Speichervorgang läuft bereits.", onConfirm: () => {} });
    return;
  }
  _eventSaving = true;
  const backupEvents    = [...store.events];
  const backupGeloeschte = [...store.geloeschte];

  // Aus aktiven Terminen entfernen
  store.events = store.events.filter(e => e.id !== event.id);

  // Vollständige Daten in geloeschte speichern
  if (!store.geloeschte.find(g => g.id === event.id)) {
    store.geloeschte.push({
      ...event,
      cancelledAt: new Date().toISOString()
    });
  }

  render();

  // Sequenziell speichern — bei SHA-Konflikt (409) einmal neu laden und retry
  let resultEvents = await saveEvents();
  if (!resultEvents.ok && resultEvents.reason?.includes("does not match")) {
    console.warn("SHA-Konflikt bei termine.json — lade SHAs neu und versuche erneut…");
    const fresh = await ghReadJSON(CONFIG.FILE_EVENTS);
    if (fresh.ok) store._sha.events = fresh.sha;
    resultEvents = await saveEvents();
  }

  if (!resultEvents.ok) {
    store.events      = backupEvents;
    store.geloeschte  = backupGeloeschte;
    render();
    showModal({
      title: "⚠️ Absagen fehlgeschlagen",
      text: `Fehler: ${resultEvents.reason}\n\nBitte versuche es erneut.`,
      onConfirm: () => {}
    });
    _eventSaving = false;
    return;
  }

  const resultGel = await saveGeloeschteGH();
  if (!resultGel.ok) {
    console.warn("geloeschte_termine.json konnte nicht gespeichert werden:", resultGel.reason);
  }
  _eventSaving = false;
}

// Abgesagten Termin reaktivieren — zurück nach store.events
async function reactivateEventFromGitHub(id, updatedData) {
  if (_eventSaving) {
    showModal({ title: "⏳ Bitte warten", text: "Ein Speichervorgang läuft bereits.", onConfirm: () => {} });
    return false;
  }
  _eventSaving = true;
  const backupEvents     = [...store.events];
  const backupGeloeschte = [...store.geloeschte];

  // Aus geloeschte entfernen, in events einfügen
  store.geloeschte = store.geloeschte.filter(g => g.id !== id);
  store.events.push({ ...updatedData, id });
  render();

  // Sequenziell speichern — bei SHA-Konflikt (409) einmal neu laden und retry
  let resultEvents = await saveEvents();
  if (!resultEvents.ok && resultEvents.reason?.includes("does not match")) {
    console.warn("SHA-Konflikt bei termine.json — lade SHAs neu und versuche erneut…");
    const fresh = await ghReadJSON(CONFIG.FILE_EVENTS);
    if (fresh.ok) store._sha.events = fresh.sha;
    resultEvents = await saveEvents();
  }

  if (!resultEvents.ok) {
    store.events      = backupEvents;
    store.geloeschte  = backupGeloeschte;
    render();
    showModal({
      title: "⚠️ Reaktivieren fehlgeschlagen",
      text: `Fehler: ${resultEvents.reason}\n\nBitte versuche es erneut.`,
      onConfirm: () => {}
    });
    _eventSaving = false;
    return false;
  }

  const resultGel = await saveGeloeschteGH();
  if (!resultGel.ok) {
    console.warn("geloeschte_termine.json konnte nicht gespeichert werden:", resultGel.reason);
  }

  _eventSaving = false;
  return true;
}

// Abgesagten Termin endgültig löschen (kein CANCELLED mehr im ICS)
async function deleteCancelledEventFromGitHub(id) {
  if (_eventSaving) {
    showModal({ title: "⏳ Bitte warten", text: "Ein Speichervorgang läuft bereits.", onConfirm: () => {} });
    return;
  }
  _eventSaving = true;
  const backup = [...store.geloeschte];

  store.geloeschte = store.geloeschte.filter(g => g.id !== id);
  render();

  const result = await saveGeloeschteGH();
  if (!result.ok) {
    store.geloeschte = backup;
    render();
    showModal({
      title: "⚠️ Löschen fehlgeschlagen",
      text: `Fehler: ${result.reason}\n\nBitte versuche es erneut.`,
      onConfirm: () => {}
    });
  }
  _eventSaving = false;
}

// Mehrere vergangene Termine auf einmal löschen
// (vergangene Termine kommen nicht in CANCELLED — sie sind bereits vorbei)
async function deletePastEventsFromGitHub(pastEvents) {
  const backup  = [...store.events];
  const pastIds = new Set(pastEvents.map(e => e.id));

  store.events = store.events.filter(e => !pastIds.has(e.id));
  render();

  const result = await saveEvents();

  if (!result.ok) {
    store.events = backup;
    render();
    showModal({
      title: "⚠️ Löschen fehlgeschlagen",
      text: `Fehler: ${result.reason}\n\nBitte versuche es erneut.`,
      onConfirm: () => {}
    });
  }
}

/* =========================
   📚 VORLAGEN
========================= */

async function saveTemplatesToGitHub() {
  const result = await saveTemplatesGH();

  if (!result.ok) {
    showModal({
      title: "⚠️ Speichern fehlgeschlagen",
      text: `Vorlage konnte nicht gespeichert werden.\nFehler: ${result.reason}`,
      onConfirm: () => {}
    });
    return false;
  }
  return true;
}

/* =========================
   🎂 GEBURTSTAGE
========================= */

async function saveGeburtstageToGitHub() {
  const result = await saveGeburtstageGH();

  if (!result.ok) {
    showModal({
      title: "⚠️ Speichern fehlgeschlagen",
      text: `Geburtstage konnten nicht gespeichert werden.\nFehler: ${result.reason}`,
      onConfirm: () => {}
    });
    return false;
  }
  return true;
}
