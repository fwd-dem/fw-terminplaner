// ============================================================
//  🚒 FW Terminplaner – geburtstage.js
//
//  Geburtstagsverwaltung: Mitglieder mit Geburtsmonat,
//  Render, Export/Import als JSON.
//  Daten liegen in store.geburtstage (GitHub, privates Repo).
//  Abhängigkeiten: config.js, api.js, github.js, ui.js
// ============================================================

const MONATE = ["Januar","Februar","März","April","Mai","Juni",
                "Juli","August","September","Oktober","November","Dezember"];

// Nachname extrahieren (letztes Wort) – für Sortierung
function getNachname(name) {
  const parts = name.trim().split(" ");
  return parts[parts.length - 1].toLowerCase();
}

/* =========================
   ➕ MITGLIED HINZUFÜGEN
========================= */

async function addGeburtstag() {
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

  const eintrag = { id: crypto.randomUUID(), name, monat };
  store.geburtstage.push(eintrag);

  document.getElementById("gb-name").value  = "";
  document.getElementById("gb-monat").value = "";

  renderGeburtstage();

  showLoading(true);
  const ok = await saveGeburtstageToGitHub();
  showLoading(false);

  if (!ok) {
    // Rollback
    store.geburtstage = store.geburtstage.filter(g => g.id !== eintrag.id);
    renderGeburtstage();
  }
}

/* =========================
   🗑️ MITGLIED LÖSCHEN
========================= */

function deleteGeburtstag(id) {
  showModal({
    title: "Mitglied löschen",
    text: "Diesen Eintrag wirklich löschen?",
    onConfirm: async () => {
      const backup = [...store.geburtstage];
      store.geburtstage = store.geburtstage.filter(g => g.id !== id);
      renderGeburtstage();

      showLoading(true);
      const ok = await saveGeburtstageToGitHub();
      showLoading(false);

      if (!ok) {
        store.geburtstage = backup;
        renderGeburtstage();
      }
    }
  });
}

/* =========================
   📋 RENDER
========================= */

function renderGeburtstage() {
  const container = document.getElementById("geburtstag-list");
  if (!container) return;

  const list = [...store.geburtstage].sort((a, b) =>
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
        <span style="font-size:12px;color:#888;margin-left:8px;">${MONATE[g.monat - 1]}</span>
      </div>
      <button onclick="deleteGeburtstag('${g.id}')"
              style="width:auto;padding:4px 10px;font-size:12px;
                     background:#f0f0f0;color:#d32f2f;border-radius:8px;margin-top:0;">
        🗑️
      </button>
    </div>
  `).join("");
}

/* =========================
   📤 EXPORT
========================= */

function exportGeburtstage() {
  if (store.geburtstage.length === 0) {
    showModal({ title: "Keine Einträge", text: "Es sind keine Geburtstage vorhanden.", onConfirm: () => {} });
    return;
  }
  const blob = new Blob([JSON.stringify(store.geburtstage, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fw-geburtstage-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   📥 IMPORT
========================= */

function importGeburtstage(event) {
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
      showModal({ title: "Ungültiges Format", text: "Die Datei enthält keine gültige Geburtstagsliste.", onConfirm: () => {} });
      return;
    }

    const valid = imported.filter(g => g && g.name && g.monat);
    if (valid.length === 0) {
      showModal({ title: "Keine Einträge", text: "Die Datei enthält keine lesbaren Einträge.", onConfirm: () => {} });
      return;
    }

    const existingIds = new Set(store.geburtstage.map(g => g.id));
    const newOnes     = valid.filter(g => !existingIds.has(g.id));

    if (newOnes.length === 0) {
      showModal({ title: "Nichts Neues", text: "Alle Einträge sind bereits vorhanden.", onConfirm: () => {} });
      return;
    }

    showModal({
      title: "Geburtstage importieren",
      text: `${newOnes.length} neue Einträge werden importiert (${valid.length - newOnes.length} bereits vorhanden).`,
      onConfirm: async () => {
        const backup = [...store.geburtstage];

        // Neue Einträge in den Store einfügen
        newOnes.forEach(g => {
          store.geburtstage.push({
            id:    g.id || crypto.randomUUID(),
            name:  g.name,
            monat: g.monat
          });
        });

        renderGeburtstage();

        showLoading(true);
        const ok = await saveGeburtstageToGitHub();
        showLoading(false);

        if (ok) {
          const skipped = valid.length - newOnes.length;
          const msg = skipped > 0
            ? `${newOnes.length} hinzugefügt, ${skipped} bereits vorhanden (übersprungen).`
            : `${newOnes.length} Einträge erfolgreich importiert.`;
          showModal({ title: "Import abgeschlossen", text: msg, onConfirm: () => {} });
        } else {
          // Rollback
          store.geburtstage = backup;
          renderGeburtstage();
        }
      }
    });
  };
  reader.readAsText(file);
}
