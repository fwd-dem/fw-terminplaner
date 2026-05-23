// ============================================================
//  🚒 FW Terminplaner – ui.js
//
//  UI-Infrastruktur: Modal, Toast, Lade-Overlay, Bottom Bar,
//  Screen-System und globaler Click-Handler.
//  Abhängigkeiten: config.js, events.js, templates.js,
//                  geburtstage.js, github.js, api.js
// ============================================================

/* =========================
   🧭 SCREEN SYSTEM
========================= */

function showScreen(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + screen).classList.add("active");

  setHeaderTitle("FW Terminplaner");

  if (screen === "events")        render();
  if (screen === "templates")     renderTemplates();
  if (screen === "geburtstage")   renderGeburtstage();
  if (screen === "git-einstellungen") {
    const tokenEl = document.getElementById("gh-token");
    if (tokenEl) {
      const hasToken = !!loadGithubToken();
      tokenEl.value       = "";
      tokenEl.placeholder = hasToken
        ? "●●●●●●●●●●●● (gespeichert)"
        : "ghp_xxxxxxxxxxxx";
      tokenEl.style.background = hasToken ? "#d4f5d4" : "#ffd6d6";
      tokenEl.oninput = () => { tokenEl.style.background = "#eaeaea"; };
    }
    const feedEl = document.getElementById("ics-url-feed");
    if (feedEl) {
      feedEl.textContent = `https://raw.githubusercontent.com/${CONFIG.ICS_OWNER}/${CONFIG.ICS_REPO}/${CONFIG.ICS_BRANCH}/${CONFIG.ICS_FILE}`;
    }
    const downloadEl = document.getElementById("ics-url-download");
    if (downloadEl) {
      downloadEl.textContent = `https://raw.githubusercontent.com/${CONFIG.ICS_OWNER}/${CONFIG.ICS_REPO}/${CONFIG.ICS_BRANCH}/${CONFIG.ICS_FILE_DOWNLOAD}`;
    }
  }

  setBottomBar(screen);

  if (screen === "form") {
    fillTemplateDropdown();
    if (editEventIndex === null) {
      document.getElementById("location").value = DEFAULT_LOCATION;
    }
  }
}

/* =========================
   ⏳ LADEZUSTAND
========================= */

function showLoading(visible) {
  let overlay = document.getElementById("loading-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(255,255,255,0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-size: 16px;
      color: #666;
      flex-direction: column;
      gap: 12px;
    `;
    overlay.innerHTML = `
      <div style="font-size:32px;">⏳</div>
      <div>Wird geladen …</div>
    `;
    document.body.appendChild(overlay);
  }

  overlay.style.display = visible ? "flex" : "none";
}

function setSaveButtonState(loading) {
  const bar = document.getElementById("bottom-bar");
  if (!bar) return;

  bar.querySelectorAll("button").forEach(btn => {
    const label = btn.querySelector("span:last-child");
    if (label && (label.textContent === "Speichern" || label.textContent === "Speichert…")) {
      btn.disabled      = loading;
      btn.style.opacity = loading ? "0.5" : "1";
      label.textContent = loading ? "Speichert…" : "Speichern";
    }
  });
}

// Sperrt einen beliebigen Button per ID während eines async Saves
function setButtonLoading(btnId, loading, loadingText = "Wird gespeichert…") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled      = loading;
  btn.style.opacity = loading ? "0.5" : "1";
  if (loading) {
    btn._originalText  = btn.textContent;
    btn.textContent    = loadingText;
  } else {
    btn.textContent    = btn._originalText || btn.textContent;
  }
}

/* =========================
   🪟 MODAL
========================= */

function showModal({ title, text, onConfirm }) {
  const overlay    = document.getElementById("modal-overlay");
  const titleEl    = document.getElementById("modal-title");
  const textEl     = document.getElementById("modal-text");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn  = document.getElementById("modal-cancel");

  titleEl.textContent = title || "Bestätigung";
  textEl.textContent  = text  || "";
  overlay.classList.remove("hidden");

  confirmBtn.onclick = () => { hideModal(); onConfirm?.(); };
  cancelBtn.onclick  = hideModal;
}

function hideModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function setHeaderTitle(text) {
  document.getElementById("header-text").textContent = text;
}

/* =========================
   🔔 TOAST
========================= */

function showToast() {
  const toast = document.getElementById("toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function showToastMsg(msg) {
  const toast    = document.getElementById("toast");
  const orig     = toast.textContent;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    toast.textContent = orig;
  }, 3000);
}

/* =========================
   📱 BOTTOM BAR SYSTEM
========================= */

function setBottomBar(screen) {
  const bar = document.getElementById("bottom-bar");
  if (!bar) return;

  let buttons = [];

  if (screen === "home") {
    buttons = [];
  }

  if (screen === "events") {
    buttons = [
      { icon: "🏠", text: "Home", action: () => showScreen("home") },
      { icon: "➕", text: "Neu",  action: () => showScreen("form") }
    ];
  }

  if (screen === "form") {
    buttons = [
      { icon: "🏠", text: "Home",      action: () => showScreen("home")   },
      { icon: "📋", text: "Liste",     action: () => showScreen("events") },
      { icon: "💾", text: "Speichern", action: () => saveEvent()          },
      { icon: "🔄", text: "Reset",     action: () => resetForm()          }
    ];
  }

  if (screen === "templates") {
    buttons = [
      { icon: "🏠", text: "Home", action: () => showScreen("home") }
    ];
  }

  if (screen === "template-form") {
    buttons = [
      { icon: "🏠", text: "Home",      action: () => showScreen("home")      },
      { icon: "💾", text: "Speichern", action: () => saveTemplate()          },
      { icon: "↩️", text: "Zurück",    action: () => showScreen("templates") }
    ];
  }

  if (screen === "einladung") {
    buttons = [
      { icon: "🏠", text: "Home", action: () => showScreen("home") }
    ];
  }

  if (screen === "geburtstage") {
    buttons = [
      { icon: "🏠", text: "Home",   action: () => showScreen("home")         },
      { icon: "↩️", text: "Zurück", action: () => showScreen("einstellungen") }
    ];
  }

  if (screen === "einstellungen") {
    buttons = [
      { icon: "🏠", text: "Home", action: () => showScreen("home") }
    ];
  }

  if (screen === "git-einstellungen") {
    buttons = [
      { icon: "🏠", text: "Home",      action: () => showScreen("home")          },
      { icon: "↩️", text: "Zurück",    action: () => showScreen("einstellungen") },
      { icon: "🔄", text: "Neu laden", action: () => {
          showLoading(true);
          loadAllData().finally(() => showLoading(false));
        }
      }
    ];
  }

  bar.innerHTML = "";
  buttons.forEach(b => {
    const btn     = document.createElement("button");
    btn.innerHTML = `<span class="icon">${b.icon}</span><span>${b.text}</span>`;
    btn.onclick   = b.action;
    bar.appendChild(btn);
  });
}

/* =========================
   🖱️ GLOBAL CLICK HANDLER
========================= */

document.addEventListener("click", (e) => {

  // 🏠 Header-Logo → Home
  if (e.target.id === "header-home") {
    showScreen("home");
    return;
  }

  // 🗑️ Vergangene löschen (nur aktive, keine abgesagten)
  if (e.target.closest("#deletePast")) {
    const past = store.events.filter(ev => isPast(ev.date));
    if (past.length === 0) return;

    showModal({
      title: "Vergangene Termine löschen",
      text: `${past.length} vergangene Termine wirklich löschen? Abgesagte Termine bleiben erhalten.`,
      onConfirm: async () => {
        await deletePastEventsFromGitHub(past);
      }
    });
    return;
  }

  // 👁️ Vergangene ausblenden
  if (e.target.closest("#togglePast")) {
    hidePast = !hidePast;
    document.getElementById("togglePast").classList.toggle("selected", hidePast);
    render();
    return;
  }

  // 🔍 Filter-Badges (Terminliste)
  const filterBadge = e.target.closest("#eventFilters .filter-badge");
  if (filterBadge) {
    const cat = filterBadge.dataset.cat;
    if (activeFilters.includes(cat)) {
      activeFilters = activeFilters.filter(c => c !== cat);
      filterBadge.classList.remove("selected");
    } else {
      activeFilters.push(cat);
      filterBadge.classList.add("selected");
    }
    render();
    return;
  }

  // 🏷️ Formular-Kategorie-Badges
  const formBadge = e.target.closest(".form-category .badge");
  if (formBadge) {
    setActiveCategory("form", formBadge.dataset.cat);
    document.getElementById("category").value = formBadge.dataset.cat;
    return;
  }

  // 🏷️ Vorlagen-Kategorie-Badges
  const tplBadge = e.target.closest(".tpl-category .badge");
  if (tplBadge) {
    setActiveCategory("template", tplBadge.dataset.cat);
    document.getElementById("tpl_category").value = tplBadge.dataset.cat;
    return;
  }
});
