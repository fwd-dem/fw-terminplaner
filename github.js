// ============================================================
//  🚒 FW Terminplaner – github.js
//
//  GitHub API-Schicht: Token verwalten, JSON-Daten lesen/
//  schreiben (privates Repo), ICS pushen (öffentliches Repo),
//  Status prüfen.
//
//  Abhängigkeiten: config.js, ui.js (showModal, showToastMsg,
//                  setStatusDot, showLoading)
// ============================================================

/* =========================
   🔑 TOKEN VERWALTUNG
========================= */

function loadGithubToken() {
  return localStorage.getItem("gh_token") || "";
}

function saveGithubToken() {
  const input = document.getElementById("gh-token");
  const token = input?.value.trim();

  if (!token) {
    showModal({ title: "Kein Token", text: "Bitte Token eingeben.", onConfirm: () => {} });
    return;
  }

  localStorage.setItem("gh_token", token);
  input.value = "";

  // Direkt testen ob der Token funktioniert
  testGithubToken(token);
}

async function testGithubToken(token) {
  showLoading(true);
  try {
    // Versuche termine.json aus privatem Repo zu lesen
    const res = await ghGet(CONFIG.FILE_EVENTS, token);
    if (res.ok) {
      showModal({
        title: "✅ Token gültig",
        text: "Verbindung zu GitHub erfolgreich. Token wurde gespeichert.",
        onConfirm: () => {}
      });
      setStatusDot("online");
      // Daten neu laden mit neuem Token
      await loadAllData();
    } else if (res.status === 401) {
      showModal({
        title: "❌ Token ungültig",
        text: "Der Token wurde nicht akzeptiert. Bitte prüfe ob er korrekt ist und die nötigen Berechtigungen hat.",
        onConfirm: () => {}
      });
      localStorage.removeItem("gh_token");
    } else if (res.status === 404) {
      showModal({
        title: "❌ Repo nicht gefunden",
        text: "Token ist gültig, aber das Daten-Repo wurde nicht gefunden. Bitte Repo-Namen in config.js prüfen.",
        onConfirm: () => {}
      });
    } else {
      showModal({
        title: "⚠️ Unbekannter Fehler",
        text: `GitHub antwortete mit Status ${res.status}.`,
        onConfirm: () => {}
      });
    }
  } catch(e) {
    showModal({
      title: "⚠️ Verbindungsfehler",
      text: "GitHub konnte nicht erreicht werden. Bitte Internetverbindung prüfen.",
      onConfirm: () => {}
    });
  } finally {
    showLoading(false);
  }
}

/* =========================
   🌐 GITHUB API HELPER
========================= */

// GET: Datei aus einem Repo lesen (gibt Response zurück)
async function ghGet(filename, tokenOverride) {
  const token = tokenOverride || loadGithubToken();
  const url   = `https://api.github.com/repos/${CONFIG.DATA_OWNER}/${CONFIG.DATA_REPO}/contents/${filename}?ref=${CONFIG.DATA_BRANCH}`;

  return fetch(url, {
    headers: {
      "Authorization": "token " + token,
      "Accept":        "application/vnd.github.v3+json"
    }
  });
}

// JSON-Datei aus privatem Repo laden → gibt geparsten Inhalt zurück
async function ghReadJSON(filename) {
  const token = loadGithubToken();
  if (!token) return { ok: false, reason: "kein_token", data: [] };

  try {
    const res = await ghGet(filename);

    if (res.status === 401) return { ok: false, reason: "token_ungueltig", data: [] };
    if (res.status === 404) return { ok: false, reason: "nicht_gefunden",  data: [] };
    if (!res.ok)            return { ok: false, reason: `fehler_${res.status}`, data: [] };

    const file    = await res.json();
    const content = decodeBase64UTF8(file.content);
    const data    = JSON.parse(content);

    return { ok: true, data, sha: file.sha };

  } catch(e) {
    console.error(`ghReadJSON(${filename}):`, e);
    return { ok: false, reason: "parse_fehler", data: [] };
  }
}

// JSON-Datei ins private Repo schreiben (create oder update)
async function ghWriteJSON(filename, data, sha) {
  const token = loadGithubToken();
  if (!token) return { ok: false, reason: "kein_token" };

  const content = encodeBase64UTF8(JSON.stringify(data, null, 2));
  const url     = `https://api.github.com/repos/${CONFIG.DATA_OWNER}/${CONFIG.DATA_REPO}/contents/${filename}`;

  const body = {
    message: `Update ${filename} – ${new Date().toISOString().slice(0, 10)}`,
    content,
    branch: CONFIG.DATA_BRANCH
  };
  if (sha) body.sha = sha;  // Pflicht bei Update, weglassen bei Create

  try {
    const res = await fetch(url, {
      method:  "PUT",
      headers: {
        "Authorization": "token " + token,
        "Accept":        "application/vnd.github.v3+json",
        "Content-Type":  "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 401) return { ok: false, reason: "token_ungueltig" };
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, reason: err.message || `fehler_${res.status}` };
    }

    const result = await res.json();
    // Neue SHA zurückgeben (nötig für nächsten Write)
    return { ok: true, sha: result.content?.sha };

  } catch(e) {
    return { ok: false, reason: e.message };
  }
}

/* =========================
   📅 ICS ZU GITHUB PUSHEN
========================= */

// Hilfsfunktion: eine einzelne ICS-Datei pushen
async function pushSingleICS(icsContent, filename, token) {
  const url = `https://api.github.com/repos/${CONFIG.ICS_OWNER}/${CONFIG.ICS_REPO}/contents/${filename}`;

  // Bestehende SHA holen (nötig für Update)
  let sha = null;
  try {
    const getRes = await fetch(url, {
      headers: {
        "Authorization": "token " + token,
        "Accept":        "application/vnd.github.v3+json"
      }
    });
    if (getRes.ok) {
      const file = await getRes.json();
      sha = file.sha;
    }
  } catch { /* Datei existiert noch nicht – sha bleibt null */ }

  const body = {
    message: `ICS Update – ${new Date().toISOString().slice(0, 10)}`,
    content: encodeBase64UTF8(icsContent),
    branch:  CONFIG.ICS_BRANCH
  };
  if (sha) body.sha = sha;

  try {
    const putRes = await fetch(url, {
      method:  "PUT",
      headers: {
        "Authorization": "token " + token,
        "Accept":        "application/vnd.github.v3+json",
        "Content-Type":  "application/json"
      },
      body: JSON.stringify(body)
    });

    if (putRes.ok) return { ok: true };
    const err = await putRes.json().catch(() => ({}));
    return { ok: false, reason: err.message || "unbekannt" };
  } catch(e) {
    return { ok: false, reason: e.message };
  }
}

// Beide ICS-Dateien sequenziell pushen (nicht parallel — SHA-Konflikt vermeiden)
async function pushICSToGitHub(feedContent, downloadContent) {
  const token = loadGithubToken();
  if (!token) {
    console.warn("Kein GitHub Token — ICS wird nicht hochgeladen.");
    return { ok: false, reason: "kein_token" };
  }

  // Feed zuerst
  const feedResult = await pushSingleICS(feedContent, CONFIG.ICS_FILE, token);
  if (!feedResult.ok) return { ok: false, reason: `Feed: ${feedResult.reason}` };

  // Dann Download
  const downloadResult = await pushSingleICS(downloadContent, CONFIG.ICS_FILE_DOWNLOAD, token);
  if (!downloadResult.ok) return { ok: false, reason: `Download: ${downloadResult.reason}` };

  return { ok: true };
}

/* =========================
   🟢 GITHUB STATUS CHECK
========================= */

async function checkGitHubStatus() {
  setStatusDot("checking");
  const token = loadGithubToken();

  if (!token) {
    setStatusDot("offline");
    return;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${CONFIG.DATA_OWNER}/${CONFIG.DATA_REPO}`,
      {
        headers: { "Authorization": "token " + token },
        signal: AbortSignal.timeout(5000)
      }
    );
    setStatusDot(res.ok ? "online" : "offline");
  } catch {
    setStatusDot("offline");
  }
}

/* =========================
   📥 ALLE DATEN LADEN
========================= */

async function loadAllData() {
  const token = loadGithubToken();

  if (!token) {
    // Kein Token → Modal anzeigen, App bleibt lesend (leere Listen)
    showModal({
      title: "⚙️ Kein Token hinterlegt",
      text: "Bitte hinterlege deinen GitHub Token in den Git Einstellungen um Daten zu laden und zu speichern.",
      onConfirm: () => showScreen("git-einstellungen")
    });
    render();
    renderTemplates();
    renderGeburtstage();
    return;
  }

  // Alle vier Dateien parallel laden
  const [termine, vorlagen, geburtstage, geloeschte] = await Promise.all([
    ghReadJSON(CONFIG.FILE_EVENTS),
    ghReadJSON(CONFIG.FILE_TEMPLATES),
    ghReadJSON(CONFIG.FILE_GEBURTSTAGE),
    ghReadJSON(CONFIG.FILE_GELOESCHTE)
  ]);

  // Token ungültig → einmal melden, nicht dreifach
  if (termine.reason === "token_ungueltig") {
    showModal({
      title: "❌ Token ungültig",
      text: "Der gespeicherte Token wurde von GitHub abgelehnt. Bitte hinterlege einen neuen Token in den Git Einstellungen.",
      onConfirm: () => showScreen("git-einstellungen")
    });
    return;
  }

  store.events      = termine.data      || [];
  store.templates   = vorlagen.data     || [];
  store.geburtstage = geburtstage.data  || [];

  // geloeschte_termine.json existiert bei Neuinstallation noch nicht → 404 ist kein Fehler
  if (geloeschte.reason === "nicht_gefunden") {
    console.info("geloeschte_termine.json noch nicht vorhanden — wird beim ersten Löschen angelegt.");
    store.geloeschte = [];
  } else {
    store.geloeschte = geloeschte.data || [];
  }

  // SHAs merken – werden beim nächsten Schreiben benötigt
  // geloeschte.sha ist undefined wenn Datei noch nicht existiert → ghWriteJSON legt sie neu an
  store._sha = {
    events:      termine.sha,
    templates:   vorlagen.sha,
    geburtstage: geburtstage.sha,
    geloeschte:  geloeschte.sha  // undefined = neue Datei, sha = Update
  };

  // ── Vergangene gelöschte Termine beim App-Start bereinigen ──
  // Verhindert unbegrenztes Wachstum von geloeschte_termine.json
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const geloeschteVorher = store.geloeschte.length;
  store.geloeschte = store.geloeschte.filter(g => {
    if (!g.date) return false;
    const d = new Date(g.date); d.setHours(0, 0, 0, 0);
    return d >= todayStart;
  });

  // Nur speichern wenn sich etwas geändert hat (kein unnötiger GitHub-Write)
  if (store.geloeschte.length < geloeschteVorher) {
    console.info(`${geloeschteVorher - store.geloeschte.length} vergangene Einträge aus geloeschte_termine.json bereinigt.`);
    saveGeloeschteGH();  // bewusst ohne await — läuft im Hintergrund, kein SHA-Konflikt möglich
  }                       // (keine andere Schreiboperation läuft beim App-Start)

  render();
  renderTemplates();
  renderGeburtstage();
}

/* =========================
   💾 EINZELNE LISTEN SPEICHERN
========================= */

async function saveEvents() {
  const result = await ghWriteJSON(
    CONFIG.FILE_EVENTS,
    store.events,
    store._sha?.events
  );
  if (result.ok) store._sha.events = result.sha;
  return result;
}

async function saveTemplatesGH() {
  const result = await ghWriteJSON(
    CONFIG.FILE_TEMPLATES,
    store.templates,
    store._sha?.templates
  );
  if (result.ok) store._sha.templates = result.sha;
  return result;
}

async function saveGeburtstageGH() {
  const result = await ghWriteJSON(
    CONFIG.FILE_GEBURTSTAGE,
    store.geburtstage,
    store._sha?.geburtstage
  );
  if (result.ok) store._sha.geburtstage = result.sha;
  return result;
}

async function saveGeloeschteGH() {
  const result = await ghWriteJSON(
    CONFIG.FILE_GELOESCHTE,
    store.geloeschte,
    store._sha?.geloeschte
  );
  if (result.ok) store._sha.geloeschte = result.sha;
  return result;
}

/* =========================
   🔧 BASE64 HELPER (UTF-8 sicher)
========================= */

// Für Umlaute (ä/ö/ü/ß) muss Base64 UTF-8-kodiert werden
function encodeBase64UTF8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64UTF8(b64) {
  // GitHub liefert den Inhalt mit Zeilenumbrüchen – erst entfernen
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}
