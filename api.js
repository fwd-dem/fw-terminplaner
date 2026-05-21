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
    setSaveButtonState(false);
  }
}

// Termin löschen
async function deleteEventFromGitHub(id) {
  const backup        = [...store.events];
  const backupGel     = [...store.geloeschte];

  // Zu löschenden Termin merken (für CANCELLED in ICS)
  const deletedEvent  = store.events.find(e => e.id === id);

  // Optimistisch entfernen (UI sofort aktualisieren)
  store.events = store.events.filter(e => e.id !== id);
  render();

  // UID in geloeschte_termine.json speichern (nur wenn in der Zukunft)
  if (deletedEvent) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d     = new Date(deletedEvent.date); d.setHours(0, 0, 0, 0);

    if (d >= today) {
      // Noch nicht in der Liste → hinzufügen
      if (!store.geloeschte.find(g => g.uid === id)) {
        store.geloeschte.push({
          uid:       id,
          title:     deletedEvent.title || "",
          date:      deletedEvent.date,
          deletedAt: new Date().toISOString()
        });
      }
    }
  }

  // Sequenziell speichern (nicht parallel — SHA-Konflikt vermeiden)
  const resultEvents = await saveEvents();
  if (!resultEvents.ok) {
    store.events     = backup;
    store.geloeschte = backupGel;
    render();
    showModal({
      title: "⚠️ Löschen fehlgeschlagen",
      text: `Fehler: ${resultEvents.reason}\n\nBitte versuche es erneut.`,
      onConfirm: () => {}
    });
    return;
  }

  // Dann geloeschte_termine.json
  const resultGel = await saveGeloeschteGH();
  if (!resultGel.ok) {
    // termine.json wurde gespeichert, geloeschte nicht — kein Rollback nötig
    // Termin ist gelöscht, nur CANCELLED fehlt — akzeptabler Zustand
    console.warn("geloeschte_termine.json konnte nicht gespeichert werden:", resultGel.reason);
  }
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
