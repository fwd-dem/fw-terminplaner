// ============================================================
//  🚒 FW Terminplaner – config.js
//
//  Zentrale Konfiguration, globaler State und Store.
//  Wird als erstes geladen (vor allen anderen Modulen).
// ============================================================

/* =========================
   ⚙️ GITHUB KONFIGURATION
========================= */

const CONFIG = {
  // 📦 Privates Repo: Termine, Vorlagen, Geburtstage
  DATA_OWNER:  "fwd-dem",
  DATA_REPO:   "fw-terminplaner-data",
  DATA_BRANCH: "main",

  // 📅 Öffentliches Repo: ICS-Datei
  ICS_OWNER:   "fwd-dem",
  ICS_REPO:    "fw-demling-termine",
  ICS_BRANCH:  "main",
  ICS_FILE:    "fw_demling_termine.ics",

  // 🌐 App-Repo (GitHub Pages)
  APP_OWNER:   "fwd-dem",
  APP_REPO:    "fw-terminplaner",

  // 📄 Dateinamen im privaten Repo
  FILE_EVENTS:      "termine.json",
  FILE_TEMPLATES:   "vorlagen.json",
  FILE_GEBURTSTAGE: "geburtstage.json"
};

/* =========================
   📦 STORE (DATA LAYER)
========================= */

const store = {
  events:      [],
  templates:   [],
  geburtstage: []
  // Alle Daten kommen von GitHub – nichts mehr lokal im localStorage
};

/* =========================
   🔧 GLOBALER STATE
========================= */

let editEventIndex = null;   // null = neu, sonst ID des Termins
let editTplIndex   = null;   // null = neu, sonst Index der Vorlage
let activeFilters  = [];
let hidePast       = false;

const DEFAULT_LOCATION = "Feuerwehrgerätehaus Demling - Gradhofstraße 3 85098 Demling";

/* =========================
   🚀 INIT
========================= */

window.addEventListener("load", async () => {
  setBottomBar("home");

  // 🟡 GitHub-Status sofort prüfen und danach alle 60 Sekunden
  checkGitHubStatus();
  setInterval(checkGitHubStatus, 60000);

  // Daten von GitHub laden
  showLoading(true);
  await loadAllData();
  showLoading(false);
});
