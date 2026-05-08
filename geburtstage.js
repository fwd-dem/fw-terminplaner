// ============================================================
//  🚒 FW Terminplaner – geburtstage.js
//
//  Geburtstagsverwaltung: Mitglieder mit Geburtsmonat,
//  Render, Export/Import als JSON.
//  Abhängigkeiten: ui.js (showModal)
// ============================================================

const MONATE = ["Januar","Februar","März","April","Mai","Juni",
                "Juli","August","September","Oktober","November","Dezember"];

// Geburtstage aus localStorage laden
function loadGeburtstage() {
  return JSON.parse(localStorage.getItem("geburtstage") || "[]");
}

function saveGeburtstage(list) {
  localStorage.setItem("geburtstage", JSON.stringify(list));
}

// Nachname extrahieren (letztes Wort) – für Sortierung
function getNachname(name) {
  const parts = name.trim().split(" ");
  return parts[parts.length - 1].toLowerCase();
}

// Mitglied hinzufügen
function addGeburtstag() {
  const name  = document.getElementById("gb-name")?.value.trim();
  const monat = parseInt(document.getElementById("gb-monat")?.value);

  if (!name) {
    showModal({ title: "Fehlende Eingabe", text: "Bitte Namen eingeben.", onConfirm: () => {} });
    return;
  }
  if (!monat || monat < 1 || monat > 12) {
    showModal({ title: "Fehlende Eingabe", text: "Bitte Monat auswählen.", onConfirm: () => {} });
    return;
  }

  const list = loadGeburtstage();
  list.push({ id: crypto.randomUUID(), name, monat });
  saveGeburtstage(list);

  document.getElementById("gb-name").value  = "";
  document.getElementById("gb-monat").value = "";

  renderGeburtstage();
}

// Mitglied löschen
function deleteGeburtstag(id) {
  showModal({
    title: "Mitglied löschen",
    text: "Diesen Eintrag wirklich löschen?",
    onConfirm: () => {
      const list = loadGeburtstage().filter(g => g.id !== id);
      saveGeburtstage(list);
      renderGeburtstage();
    }
  });
}

// Liste rendern — sortiert nach Nachname
function renderGeburtstage() {
  const container = document.getElementById("geburtstag-list");
  if (!container) return;

  const list = loadGeburtstage().sort((a, b) =>
    getNachname(a.name).localeCompare(getNachname(b.name), "de")
  );

  if (list.length === 0) {
    container.innerHTML = '<p style="color:#aaa;font-size:13px;">Noch keine Mitglieder eingetragen.</p>';
    return;
  }

  container.innerHTML = list.map(g => `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:8px 0;border-bottom:1px solid #f0f0f0;">
      <div>
        <span style="font-size:14px;font-weight:500;">${g.name}</span>
        <span style="font-size:12px;color:#888;margin-left:8px;">${MONATE[g.monat-1]}</span>
      </div>
      <button onclick="deleteGeburtstag('${g.id}')"
              style="width:auto;padding:4px 10px;font-size:12px;
                     background:#f0f0f0;color:#d32f2f;border-radius:8px;margin-top:0;">
        🗑️
      </button>
    </div>
  `).join("");
}

// Export als JSON
function exportGeburtstage() {
  const list = loadGeburtstage();
  if (list.length === 0) {
    showModal({ title: "Keine Einträge", text: "Es sind keine Geburtstage vorhanden.", onConfirm: () => {} });
    return;
  }
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fw-geburtstage-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import aus JSON
function importGeburtstage(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = "";

  const reader = new FileReader();
  reader.onload = (e) => {
    let imported;
    try {
      imported = JSON.parse(e.target.result);
    } catch {
      showModal({ title: "Ungültige Datei", text: "Die Datei konnte nicht gelesen werden.", onConfirm: () => {} });
      return;
    }

    if (!Array.isArray(imported)) {
      showModal({ title: "Ungültiges Format", text: "Die Datei enthält keine gültige Geburtstagsliste.", onConfirm: () => {} });
      return;
    }

    const valid = imported.filter(g => g && g.name && g.monat);
    if (valid.length === 0) {
      showModal({ title: "Keine Einträge", text: "Die Datei enthält keine lesbaren Einträge.", onConfirm: () => {} });
      return;
    }

    const existing    = loadGeburtstage();
    const existingIds = new Set(existing.map(g => g.id));
    const newOnes     = valid.filter(g => !existingIds.has(g.id));
    const merged      = [...existing, ...newOnes];
    saveGeburtstage(merged);
    renderGeburtstage();

    const skipped = valid.length - newOnes.length;
    const msg = skipped > 0
      ? `${newOnes.length} hinzugefügt, ${skipped} bereits vorhanden (übersprungen).`
      : `${newOnes.length} Einträge erfolgreich importiert.`;
    showModal({ title: "Import abgeschlossen", text: msg, onConfirm: () => {} });
  };
  reader.readAsText(file);
}
