// ============================================================
//  🚒 FW Terminplaner – einladung-actions.js
//
//  PDF-Erstellung auslösen: ICS pushen, jsPDF lazy laden,
//  Erfolgsmeldung anzeigen.
//
//  Abhängigkeiten: config.js (store), ui.js (showModal, showLoading),
//                  ics.js (buildLocalICS, buildDownloadICS),
//                  github.js (pushICSToGitHub),
//                  einladung-pdf.js (startPDFGeneration)
// ============================================================

async function generateEinladungPDF() {
  showLoading(true);

  // ── 1. ICS ZUERST PUSHEN (direkt am Button-Klick → iOS-kompatibel) ──
  const icsToday = new Date(); icsToday.setHours(0, 0, 0, 0);
  const icsEvents = store.events
    .filter(e => { if (!e.date) return false; const d = new Date(e.date); d.setHours(0,0,0,0); return d >= icsToday; })
    .sort((a, b) => a.date.localeCompare(b.date));

  window._icsStatus = null;
  if (icsEvents.length > 0) {
    const feedContent     = buildLocalICS(icsEvents);
    const downloadContent = buildDownloadICS(icsEvents);
    const icsResult       = await pushICSToGitHub(feedContent, downloadContent);
    window._icsStatus     = icsResult;
  }

  // ── 2. jsPDF LAZY LADEN ───────────────────────────────────────
  if (!window.jspdf) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload  = () => startPDFGeneration();
    script.onerror = () => {
      showLoading(false);
      showModal({
        title: "Fehler",
        text: "PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.",
        onConfirm: () => {}
      });
    };
    document.head.appendChild(script);
    return;
  }

  startPDFGeneration();
}
