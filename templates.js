// ============================================================
//  🚒 FW Terminplaner – templates.js
//
//  Vorlagenverwaltung: CRUD, Render, Anwenden, Export/Import.
//  Abhängigkeiten: config.js, api.js, github.js, ui.js, events.js
// ============================================================

/* =========================
   📚 TEMPLATES
========================= */

function openTemplateForm() {
  editTplIndex = null;
  showScreen("template-form");
  resetTplForm();
}

async function saveTemplate() {
  const tplIsAllDay = getCurrentTplEventType() === "allday";
  const tpl = {
    title:     document.getElementById("tpl_title").value,
    allday:    tplIsAllDay,
    start:     tplIsAllDay ? "" : document.getElementById("tpl_start").value,
    end:       tplIsAllDay ? "" : document.getElementById("tpl_end").value,
    desc:      document.getElementById("tpl_desc").value,
    location:  document.getElementById("tpl_location").value,
    category:  document.getElementById("tpl_category").value,
    reminder1: document.getElementById("tpl_reminder1").value,
    reminder2: document.getElementById("tpl_reminder2").value
  };

  if (!tpl.title.trim()) {
    showModal({ title: "Fehlende Eingabe", text: "Bitte einen Titel eingeben.", onConfirm: () => {} });
    return;
  }

  if (editTplIndex !== null) {
    store.templates[editTplIndex] = tpl;
    editTplIndex = null;
  } else {
    store.templates.push(tpl);
  }

  showLoading(true);
  const ok = await saveTemplatesToGitHub();
  showLoading(false);

  if (ok) {
    showScreen("template-list");
  } else {
    // Rollback
    if (editTplIndex !== null) {
      store.templates[editTplIndex] = tpl;
    } else {
      store.templates.pop();
    }
  }
}

function editTemplate(i) {
  editTplIndex = i;
  const t = store.templates[i];

  showScreen("template-form");
  document.getElementById("tplFormTitle").textContent = "✏️ Vorlage bearbeiten";
  document.getElementById("tpl_title").value          = t.title;
  setTimeDisplay("tpl_start", t.start);
  setTimeDisplay("tpl_end",   t.end);
  document.getElementById("tpl_desc").value           = t.desc;
  document.getElementById("tpl_location").value       = t.location;
  document.getElementById("tpl_category").value       = t.category;
  document.getElementById("tpl_reminder1").value      = t.reminder1 || "";
  document.getElementById("tpl_reminder2").value      = t.reminder2 || "";

  setTplEventType(t.allday ? "allday" : "normal");
  setActiveCategory("template", t.category);
}

function deleteTemplate(i) {
  showModal({
    title: "Vorlage löschen",
    text: "Diese Vorlage wirklich löschen?",
    onConfirm: async () => {
      const backup = [...store.templates];
      store.templates.splice(i, 1);
      renderTemplates();

      showLoading(true);
      const ok = await saveTemplatesToGitHub();
      showLoading(false);

      if (!ok) {
        store.templates = backup;
        renderTemplates();
      }
    }
  });
}

function resetTplForm() {
  document.getElementById("tplFormTitle").textContent = "➕ Vorlage";
  document.getElementById("tpl_title").value          = "";
  setTimeDisplay("tpl_start", "");
  setTimeDisplay("tpl_end",   "");
  document.getElementById("tpl_desc").value           = "";
  document.getElementById("tpl_location").value       = DEFAULT_LOCATION;
  setTplEventType("normal");
  document.getElementById("tpl_category").value  = "";
  document.getElementById("tpl_reminder1").value = "";
  document.getElementById("tpl_reminder2").value = "";
  clearBadges("template");
}

function renderTemplates() {
  const list = document.getElementById("templateList");
  list.innerHTML = "";

  if (store.templates.length === 0) {
    list.innerHTML = "<p>Keine Vorlagen vorhanden</p>";
    return;
  }

  store.templates.forEach((t, i) => {
    const meta = getCategoryMeta(t.category);
    const card = document.createElement("div");
    card.className = "card";

    let bg = "#fff";
    if (t.category === "active") bg = "#ffe5e5";
    if (t.category === "group")  bg = "#e6f0ff";
    if (t.category === "resp")   bg = "#fff9e6";
    if (t.category === "club")   bg = "#e6ffe9";

    card.style.background   = bg;
    card.style.marginBottom = "12px";
    card.style.padding      = "16px";

    card.innerHTML = `
      <div style="font-size:18px; font-weight:bold;">${t.title}</div>
      <div style="font-size:13px; margin-top:4px;">⏰ ${t.start || "-"} – ${t.end || "-"}</div>
      <div style="font-size:13px; color:#777; margin-top:4px;">📍 ${t.location || "kein Ort"}</div>
      <div style="
        display:inline-block; background:${meta.color};
        color:${t.category === 'resp' ? '#333' : 'white'};
        padding:3px 8px; border-radius:12px; font-size:11px; margin-top:8px;">
        ${meta.text}
      </div>
      <div style="margin-top:10px;">
        <button onclick="applyTemplate(${i})">▶ Anwenden</button>
        <button onclick="editTemplate(${i})">✏️ Bearbeiten</button>
        <button onclick="deleteTemplate(${i})">🗑️ Löschen</button>
      </div>`;

    list.appendChild(card);
  });
}

/* =========================
   📥 TEMPLATE APPLY
========================= */

function applyTemplate(i) {
  const t = store.templates[i];
  showScreen("form");
  fillTemplateDropdown();

  document.getElementById("title").value    = t.title;
  document.getElementById("desc").value     = t.desc;
  document.getElementById("location").value = t.location;
  setEventType(t.allday ? "allday" : "normal");
  if (!t.allday) {
    setTimeDisplay("start", t.start);
    setTimeDisplay("end",   t.end);
  }
  document.getElementById("category").value  = t.category;
  document.getElementById("date").value      = "";
  const dsEl = document.getElementById("date_start");
  if (dsEl) dsEl.value = "";
  const deEl = document.getElementById("date_end");
  if (deEl) deEl.value = "";
  document.getElementById("reminder1").value = t.reminder1 || "";
  document.getElementById("reminder2").value = t.reminder2 || "";

  setActiveCategory("form", t.category);
}

function fillTemplateDropdown() {
  const sel = document.getElementById("templateSelect");
  sel.innerHTML = `<option value="">-- Vorlage wählen --</option>`;
  store.templates.forEach((t, i) => {
    sel.innerHTML += `<option value="${i}">${t.title}</option>`;
  });
}

function applyTemplateFromDropdown() {
  const i = document.getElementById("templateSelect").value;
  if (i === "") return;

  const t = store.templates[parseInt(i)];
  document.getElementById("title").value    = t.title;
  document.getElementById("desc").value     = t.desc;
  document.getElementById("location").value = t.location;
  setEventType(t.allday ? "allday" : "normal");
  if (!t.allday) {
    setTimeDisplay("start", t.start);
    setTimeDisplay("end",   t.end);
  }
  document.getElementById("category").value  = t.category;
  document.getElementById("date").value      = "";
  const deEl = document.getElementById("date_end");
  if (deEl) deEl.value = "";
  document.getElementById("reminder1").value = t.reminder1 || "";
  document.getElementById("reminder2").value = t.reminder2 || "";

  setActiveCategory("form", t.category);
}

/* =========================
   🔄 TEMPLATE ALLDAY TOGGLE
========================= */

function getCurrentTplEventType() {
  const btn = document.getElementById("tpl-btn-allday");
  return btn && btn.classList.contains("active") ? "allday" : "normal";
}

function setTplEventType(type) {
  const btnNormal = document.getElementById("tpl-btn-normal");
  const btnAllday = document.getElementById("tpl-btn-allday");
  const blockNorm = document.getElementById("tpl-block-normal");
  const blockAll  = document.getElementById("tpl-block-allday");
  if (!btnNormal) return;

  if (type === "allday") {
    btnNormal.classList.remove("active");
    btnAllday.classList.add("active");
    blockNorm.style.display = "none";
    blockAll.style.display  = "block";
    setTimeDisplay("tpl_start", "");
    setTimeDisplay("tpl_end",   "");
  } else {
    btnAllday.classList.remove("active");
    btnNormal.classList.add("active");
    blockNorm.style.display = "block";
    blockAll.style.display  = "none";
  }
}

/* =========================
   📤📥 VORLAGEN EXPORT / IMPORT
========================= */

function exportTemplates() {
  if (store.templates.length === 0) {
    showModal({ title: "Keine Vorlagen", text: "Es sind keine Vorlagen vorhanden.", onConfirm: () => {} });
    return;
  }

  const blob = new Blob([JSON.stringify(store.templates, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fw-vorlagen-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importTemplates(event) {
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
      showModal({ title: "Ungültiges Format", text: "Die Datei enthält keine gültige Vorlagenliste.", onConfirm: () => {} });
      return;
    }

    const valid = imported.filter(t => t && typeof t === "object" && typeof t.title === "string");

    if (valid.length === 0) {
      showModal({ title: "Keine Vorlagen gefunden", text: "Die Datei enthält keine lesbaren Vorlagen.", onConfirm: () => {} });
      return;
    }

    if (store.templates.length > 0) {
      showImportChoiceModal(valid);
    } else {
      applyImport(valid, "replace");
    }
  };

  reader.readAsText(file);
}

function showImportChoiceModal(imported) {
  const overlay    = document.getElementById("modal-overlay");
  const titleEl    = document.getElementById("modal-title");
  const textEl     = document.getElementById("modal-text");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn  = document.getElementById("modal-cancel");
  const actions    = document.querySelector(".modal-actions");

  titleEl.textContent = "Vorlagen importieren";
  textEl.textContent  = `${imported.length} Vorlage(n) gefunden. Bestehende ${store.templates.length} Vorlage(n) ersetzen oder zusammenführen?`;
  overlay.classList.remove("hidden");

  let abortBtn = document.getElementById("modal-abort");
  if (!abortBtn) {
    abortBtn = document.createElement("button");
    abortBtn.id = "modal-abort";
    abortBtn.style.cssText = "flex:1; padding:10px; border:none; border-radius:12px; cursor:pointer; font-weight:bold; background:#eee; color:#333;";
    actions.appendChild(abortBtn);
  }
  abortBtn.textContent   = "Abbrechen";
  abortBtn.style.display = "block";

  confirmBtn.textContent = "Ersetzen";
  confirmBtn.onclick = () => { resetImportModal(); applyImport(imported, "replace"); };

  cancelBtn.textContent = "Zusammenführen";
  cancelBtn.onclick = () => { resetImportModal(); applyImport(imported, "merge"); };

  abortBtn.onclick = () => { resetImportModal(); };
}

function resetImportModal() {
  hideModal();
  document.getElementById("modal-confirm").textContent = "OK";
  document.getElementById("modal-cancel").textContent  = "Abbrechen";
  const abortBtn = document.getElementById("modal-abort");
  if (abortBtn) abortBtn.style.display = "none";
}

async function applyImport(imported, mode) {
  const backup = [...store.templates];

  if (mode === "replace") {
    store.templates = imported;
  } else {
    const existingTitles = new Set(store.templates.map(t => t.title));
    const newOnes        = imported.filter(t => !existingTitles.has(t.title));
    store.templates      = [...store.templates, ...newOnes];
    const skipped        = imported.length - newOnes.length;
    if (skipped > 0) {
      showModal({
        title: "Import abgeschlossen",
        text: `${newOnes.length} Vorlage(n) hinzugefügt. ${skipped} übersprungen (Titel bereits vorhanden).`,
        onConfirm: () => {}
      });
    }
  }

  showLoading(true);
  const ok = await saveTemplatesToGitHub();
  showLoading(false);

  if (ok) {
    renderTemplates();
    if (mode === "replace") {
      showModal({
        title: "Import abgeschlossen",
        text: `${imported.length} Vorlage(n) erfolgreich importiert.`,
        onConfirm: () => {}
      });
    }
  } else {
    // Rollback
    store.templates = backup;
    renderTemplates();
  }
}
