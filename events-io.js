// ============================================================
//  🚒 FW Terminplaner – events-io.js
//
//  Termine Export / Import (JSON).
//
//  Abhängigkeiten: config.js (store), api.js (saveEvents),
//                  ui.js (showModal, showLoading),
//                  events-render.js (render)
// ============================================================

/* =========================
   📤 EXPORT
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

/* =========================
   📥 IMPORT
========================= */

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

        newEvents.forEach(ev => {
          store.events.push({
            id:        ev.id        || crypto.randomUUID(),
            title:     ev.title     || "",
            date:      ev.date      || "",
            date_end:  ev.date_end  || "",
            allday:    ev.allday    || false,
            start:     ev.start     || "",
            end:       ev.end       || "",
            location:  ev.location  || "",
            desc:      ev.desc      || "",
            category:  ev.category  || "other",
            important: ev.important || false,
            reminder1: ev.reminder1 || "",
            reminder2: ev.reminder2 || ""
          });
        });

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
