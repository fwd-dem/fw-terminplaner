// ============================================================
//  🚒 FW Terminplaner – einladung.js
//
//  Einladungs-PDF ("Blaulicht-Bladl"): Monatsauswahl,
//  Formular befüllen, PDF mit jsPDF generieren.
//  Nach PDF-Erstellung: ICS zu GitHub pushen.
//
//  Abhängigkeiten: config.js (store), ui.js (showModal, showToastMsg),
//                  ics.js (buildLocalICS), github.js (pushICSToGitHub),
//                  geburtstage.js (loadGeburtstage, getNachname)
//
//  ⚠️  LOGOS & FONTS:
//      LOGO_FW, LOGO_FFW → Base64-PNG hier eintragen (oder per fetch laden)
//      DejaVuSans → Base64-TTF hier eintragen
//      Diese wurden bewusst ausgelagert / leer gelassen.
// ============================================================

// ℹ️ ICS-URL kommt aus CONFIG (config.js) – kein hardcoded URL nötig

function openEinladung() {
  showScreen("einladung");
  buildMonthSelector();
}

function openEinladungMenu() {
  showScreen("einladung-menu");
}

/* =========================
   📅 MONATSAUSWAHL
========================= */

function buildMonthSelector() {
  const selector = document.getElementById("month-selector");
  if (!selector) return;

  const now    = new Date();
  const months = [];

  for (let i = 0; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      label: d.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
      year:  d.getFullYear(),
      month: d.getMonth()   // 0-based
    });
  }

  selector.innerHTML = "";
  months.forEach((m, i) => {
    const btn = document.createElement("button");
    btn.type      = "button";
    btn.className = "allday-btn" + (i === 0 ? " active" : "");
    btn.textContent = m.label;
    btn.dataset.year  = m.year;
    btn.dataset.month = m.month;
    btn.onclick = () => {
      selector.querySelectorAll(".allday-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      fillEinladung(m.year, m.month);
    };
    selector.appendChild(btn);
  });

  // Direkt mit aktuellem Monat befüllen
  fillEinladung(months[0].year, months[0].month);
}

/* =========================
   📝 EINLADUNG BEFÜLLEN
========================= */

function fillEinladung(year, month) {
  // Termine des Monats filtern
  const monthEvents = store.events.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Aktive Termine chronologisch
  const activeEvents = monthEvents
    .filter(e => e.category === "active")
    .sort((a, b) => a.date.localeCompare(b.date));

  // Verein-Termine chronologisch
  const clubEvents = monthEvents
    .filter(e => e.category === "club")
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Wann ──────────────────────────────────────────────────────
  const wannEl = document.getElementById("einladung-wann");
  if (wannEl) {
    if (activeEvents.length === 0) {
      wannEl.innerHTML = '<span style="color:#aaa;">Keine Aktive-Termine in diesem Monat</span>';
    } else {
      wannEl.innerHTML = activeEvents.map(e => {
        const datStr = new Date(e.date).toLocaleDateString("de-DE", {
          weekday: "long", day: "numeric", month: "long"
        });
        const time = e.start ? ` ${e.start} Uhr` : "";
        return `<div class="einladung-wann-row">📅 ${datStr}${time}</div>`;
      }).join("");
    }
  }

  // ── Thema ─────────────────────────────────────────────────────
  const themaEl = document.getElementById("einladung-thema");
  if (themaEl) {
    const themen = activeEvents
      .filter(e => e.desc && e.desc.trim())
      .map(e => e.desc.trim());
    themaEl.value = themen.join("\n") || "";
  }

  // ── Weitere Informationen: Verein-Termine ────────────────────
  const infoEl = document.getElementById("einladung-info");
  if (infoEl) {
    if (clubEvents.length === 0) {
      infoEl.value = "";
    } else {
      infoEl.value = clubEvents.map(e => {
        const datStr = new Date(e.date).toLocaleDateString("de-DE", {
          weekday: "long", day: "numeric", month: "long"
        });
        const time  = e.start ? ` ${e.start} Uhr` : "";
        const titel = e.title ? ` – ${e.title}` : "";
        return `• ${datStr}${time}${titel}`;
      }).join("\n");
    }
  }

  // Hinweis leeren
  const hinweisEl = document.getElementById("einladung-hinweis");
  if (hinweisEl) hinweisEl.value = "";

  // ── Geburtstagskinder des Monats ──────────────────────────────
  const gbEl    = document.getElementById("einladung-geburtstag");
  const gbBlock = document.getElementById("einladung-geburtstag-block");
  if (gbEl && gbBlock) {
    const geburtstage = store.geburtstage.filter(g => g.monat === month + 1);
    if (geburtstage.length === 0) {
      gbBlock.style.display = "none";
      gbEl.value = "";
    } else {
      gbBlock.style.display = "block";
      const namen = geburtstage
        .sort((a, b) => getNachname(a.name).localeCompare(getNachname(b.name), "de"))
        .map(g => g.name)
        .join(", ");
      gbEl.value = namen;
    }
  }
}

/* =========================
   📄 PDF GENERIEREN
========================= */

async function generateEinladungPDF() {
  // ── 1. ICS ZUERST PUSHEN (direkt am Button-Klick → iOS-kompatibel) ──
  const icsToday = new Date(); icsToday.setHours(0, 0, 0, 0);
  const icsEvents = store.events
    .filter(e => { if (!e.date) return false; const d = new Date(e.date); d.setHours(0,0,0,0); return d >= icsToday; })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (icsEvents.length > 0) {
    const icsContent = buildLocalICS(icsEvents);
    const icsResult  = await pushICSToGitHub(icsContent);
    if (icsResult.ok) {
      showToastMsg("✅ Kalender aktualisiert");
    } else if (icsResult.reason !== "kein_token") {
      showToastMsg("⚠️ ICS Upload fehlgeschlagen: " + icsResult.reason);
    }
  }

  // ── 2. jsPDF LAZY LADEN ───────────────────────────────────────
  if (!window.jspdf) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload  = () => startPDFGeneration();
    script.onerror = () => showModal({
      title: "Fehler",
      text: "PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.",
      onConfirm: () => {}
    });
    document.head.appendChild(script);
    return;
  }

  startPDFGeneration();
}

async function startPDFGeneration() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    showModal({ title: "Fehler", text: "PDF-Bibliothek nicht verfügbar.", onConfirm: () => {} });
    return;
  }

  async function fileToBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} nicht gefunden (${res.status})`);
    const blob = await res.blob();
    if (blob.size === 0) throw new Error(`${url} ist leer`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  let LOGO_FW = "", LOGO_FFW = "";
  try { LOGO_FW  = await fileToBase64("logo_fw.png");  } catch { console.warn("logo_fw.png nicht gefunden");  }
  try { LOGO_FFW = await fileToBase64("logo_ffw.png"); } catch { console.warn("logo_ffw.png nicht gefunden"); }

  let fontName = "helvetica";
  let fontR = "", fontB = "";
  try {
    fontR = await fileToBase64("DejaVuSans.ttf");
    fontB = await fileToBase64("DejaVuSans-Bold.ttf");
    fontName = "DejaVuSans";
  } catch { console.warn("DejaVuSans nicht gefunden, Fallback: helvetica"); }

  function loadFonts(doc) {
    if (fontName === "DejaVuSans") {
      doc.addFileToVFS("DejaVuSans.ttf",      fontR);
      doc.addFont("DejaVuSans.ttf",      "DejaVuSans", "normal");
      doc.addFileToVFS("DejaVuSans-Bold.ttf", fontB);
      doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
    }
  }

  // ── SCHRITT 1: Höhe messen auf Dummy-Dokument ─────────────────
  const dummy = new jsPDF({ unit: "mm", format: [160, 500] });
  loadFonts(dummy);
  const measuredH = buildPDF(dummy, fontName, LOGO_FW, LOGO_FFW, true);

  // ── SCHRITT 2: Echtes Dokument mit gemessener Höhe ────────────
  const finalH = measuredH + 10;
  const real   = new jsPDF({ unit: "mm", format: [160, finalH] });
  loadFonts(real);
  buildPDF(real, fontName, LOGO_FW, LOGO_FFW, false);

  const activeBtn  = document.querySelector("#month-selector .allday-btn.active");
  const monthLabel = activeBtn ? activeBtn.textContent.replace(/\s+/g, "_") : "Einladung";
  real.save("FW_Einladung_" + monthLabel + ".pdf");
}

/* =========================
   🏗️ PDF INHALT AUFBAUEN
========================= */

function buildPDF(doc, FONT, LOGO_FW, LOGO_FFW, measureOnly) {
  const W      = 160;
  const margin = 10;
  const usable = W - margin * 2;
  let   y      = 0;
  const RED    = [211, 47, 47];
  const BLUE   = [26, 80, 180];
  const DARK   = [30, 30, 30];
  const GREY   = [130, 130, 130];
  const WHITE  = [255, 255, 255];
  const BOX_A  = [245, 245, 245];
  const BOX_W  = [255, 255, 255];
  let   zebraIdx = 0;

  const PAD_TOP      = 8;
  const PAD_BOTTOM   = 5;
  const LABEL_H      = 13;
  const CONTENT_SIZE = 13;
  const LABEL_SIZE   = 14;

  function clean(text) {
    return (text || "").replace(/[^\x00-\xFF]/g, "").trim();
  }

  function addText(text, opts = {}) {
    const { size = CONTENT_SIZE, bold = false, color = DARK, indent = 0, after = 4 } = opts;
    doc.setFontSize(size);
    doc.setFont(FONT, bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(text), usable - indent);
    if (!measureOnly) doc.text(lines, margin + indent, y);
    y += lines.length * (size * 0.38) + after;
  }

  function addParagraphs(text, opts = {}) {
    const { size = CONTENT_SIZE, color = DARK, indent = 0, paraAfter = 4 } = opts;
    const paragraphs = clean(text).split("\n").filter(p => p.trim() !== "");
    paragraphs.forEach((para, i) => {
      doc.setFontSize(size);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(para.trim(), usable - indent);
      if (!measureOnly) doc.text(lines, margin + indent, y);
      y += lines.length * (size * 0.38) + (i < paragraphs.length - 1 ? paraAfter : 2);
    });
  }

  function drawSection(iconType, iconColor, labelText, contentFn) {
    const savedY = y;
    contentFn();
    const contentH = y - savedY;
    y = savedY;

    const totalH = PAD_TOP + LABEL_H + contentH + PAD_BOTTOM;

    if (!measureOnly) {
      const bgColor = zebraIdx % 2 === 0 ? BOX_W : BOX_A;
      doc.setFillColor(...bgColor);
      doc.rect(0, y, W, totalH, "F");
    }
    zebraIdx++;
    y += PAD_TOP;

    if (!measureOnly) {
      if (iconType) drawIcon(iconType, margin, y - 0.5, iconColor || RED);
      doc.setFontSize(LABEL_SIZE);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...(iconColor || RED));
      doc.text(clean(labelText), margin + (iconType ? 6 : 0), y + 3.5);
    }
    y += LABEL_H;

    if (!measureOnly) doc.setTextColor(...DARK);
    contentFn();
    y += PAD_BOTTOM;
  }

  function drawIcon(type, ix, iy, color) {
    const [r,g,b] = color;
    doc.setDrawColor(r,g,b);
    doc.setFillColor(r,g,b);
    doc.setLineWidth(0.45);
    switch(type) {
      case "calendar_lines":
        doc.roundedRect(ix, iy+0.3, 3.5, 3.2, 0.25, 0.25, "S");
        doc.setLineWidth(0.3);
        doc.line(ix+0.7,iy+0,  ix+0.7,iy+0.9);
        doc.line(ix+2.8,iy+0,  ix+2.8,iy+0.9);
        doc.line(ix,    iy+1.2,ix+3.5,iy+1.2);
        doc.line(ix+0.4,iy+1.9,ix+3.1,iy+1.9);
        doc.line(ix+0.4,iy+2.6,ix+2.2,iy+2.6);
        doc.setLineWidth(0.45); break;
      case "pin":
        doc.circle(ix+1.75,iy+1.4,1.3,"S");
        doc.circle(ix+1.75,iy+1.4,0.45,"F");
        doc.lines([[0.6,0.8],[0.0,0.8],[-0.6,0.8],[-0.6,-0.8],[-0.5,-0.5]],ix+1.15,iy+1.9,[1,1],"S"); break;
      case "bullet_list":
        doc.circle(ix+0.4,iy+0.8,0.35,"F");
        doc.circle(ix+0.4,iy+2.1,0.35,"F");
        doc.circle(ix+0.4,iy+3.2,0.35,"F");
        doc.setLineWidth(0.35);
        doc.line(ix+1.0,iy+0.8,ix+3.5,iy+0.8);
        doc.line(ix+1.0,iy+2.1,ix+3.0,iy+2.1);
        doc.line(ix+1.0,iy+3.2,ix+2.5,iy+3.2);
        doc.setLineWidth(0.45); break;
      case "info":
        doc.circle(ix+1.75,iy+1.75,1.75,"S");
        doc.setLineWidth(0.5);
        doc.line(ix+1.75,iy+1.7,ix+1.75,iy+2.9);
        doc.circle(ix+1.75,iy+1.15,0.28,"F");
        doc.setLineWidth(0.45); break;
      case "star":
        const cx=ix+1.75,cy=iy+1.9,or=1.7,ir=0.75,sp=[];
        for(let k=0;k<10;k++){const a=(k*Math.PI/5)-Math.PI/2;sp.push([cx+Math.cos(a)*(k%2===0?or:ir),cy+Math.sin(a)*(k%2===0?or:ir)]);}
        doc.moveTo(sp[0][0],sp[0][1]);sp.slice(1).forEach(p=>doc.lineTo(p[0],p[1]));doc.lineTo(sp[0][0],sp[0][1]);doc.stroke(); break;
      case "cake":
        doc.setLineWidth(0.3);
        doc.rect(ix+1.45, iy+0.0, 0.6, 1.4, "F");
        doc.setFillColor(255, 200, 0);
        doc.ellipse(ix+1.75, iy-0.2, 0.35, 0.5, "F");
        doc.setFillColor(r,g,b);
        doc.roundedRect(ix+0.3, iy+1.4, 3.0, 1.1, 0.2, 0.2, "F");
        doc.roundedRect(ix+0.0, iy+2.5, 3.5, 1.3, 0.2, 0.2, "F");
        doc.setDrawColor(255,255,255);
        doc.setLineWidth(0.35);
        doc.line(ix+0.5, iy+1.95, ix+3.1, iy+1.95);
        doc.line(ix+0.3, iy+3.1,  ix+3.2, iy+3.1);
        doc.setDrawColor(r,g,b);
        doc.setLineWidth(0.45); break;
    }
  }

  // ── HEADER ───────────────────────────────────────────────────
  const HEADER_H = 36;
  const LOGO_H   = 28;
  const LOGO_Y   = (HEADER_H - LOGO_H) / 2;

  if (!measureOnly) {
    doc.setFillColor(...RED);
    doc.rect(0, 0, W, HEADER_H, "F");

    if (LOGO_FW) {
      const L1_CX = margin + LOGO_H / 2;
      const L1_CY = HEADER_H / 2;
      doc.setFillColor(255, 255, 255);
      doc.circle(L1_CX, L1_CY, LOGO_H / 2 + 1, "F");
      doc.addImage(LOGO_FW, "PNG", margin, LOGO_Y, LOGO_H, LOGO_H);
    }

    if (LOGO_FFW) {
      const L2_W = LOGO_H * 0.72;
      const L2_X = W - margin - L2_W;
      doc.setFillColor(255, 255, 255);
      doc.rect(L2_X - 1, LOGO_Y - 0.5, L2_W + 2, LOGO_H + 1, "F");
      doc.addImage(LOGO_FFW, "PNG", L2_X, LOGO_Y, L2_W, LOGO_H);
    }

    const textAreaLeft  = margin + (LOGO_FW ? LOGO_H + 3 : 0);
    const textAreaRight = LOGO_FFW ? W - margin - LOGO_H * 0.72 - 3 : W - margin;
    const textCenterX   = (textAreaLeft + textAreaRight) / 2;

    doc.setFontSize(24);
    doc.setFont(FONT, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Blaulicht-Bladl", textCenterX, HEADER_H / 2 - 1, { align: "center" });

    doc.setFontSize(11);
    doc.setFont(FONT, "normal");
    doc.setTextColor(255, 210, 210);
    doc.text("Monatsinfo der FW Demling", textCenterX, HEADER_H / 2 + 7, { align: "center" });
  }

  y = HEADER_H + 6;

  // ── ÜBUNGSTERMINE ─────────────────────────────────────────────
  const wannEl   = document.getElementById("einladung-wann");
  const wannRows = wannEl ? wannEl.querySelectorAll(".einladung-wann-row") : [];
  drawSection("calendar_lines", RED, "Übungstermine", () => {
    if (wannRows.length === 0) {
      addText("Keine Termine eingetragen", { color: GREY, indent: 9, after: 1 });
    } else {
      wannRows.forEach(row => addText(row.textContent.trim(), { indent: 9 }));
    }
  });

  // ── ÜBUNGSTHEMEN ──────────────────────────────────────────────
  const thema = document.getElementById("einladung-thema")?.value.trim();
  if (thema) {
    drawSection("bullet_list", RED, "Übungsthemen", () => {
      addParagraphs(thema, { indent: 9 });
    });
  }

  // ── ORT ───────────────────────────────────────────────────────
  drawSection("pin", RED, "Ort", () => {
    addText("Feuerwehrgerätehaus (FWGH)", { indent: 9 });
  });

  // ── WEITERE INFORMATIONEN ─────────────────────────────────────
  const info = document.getElementById("einladung-info")?.value.trim();
  if (info) {
    drawSection("info", RED, "Weitere Informationen", () => {
      addParagraphs(info, { indent: 9 });
    });
  }

  // ── HINWEIS ───────────────────────────────────────────────────
  const hinweis = document.getElementById("einladung-hinweis")?.value.trim();
  if (hinweis) {
    drawSection("star", RED, "Hinweis", () => {
      addParagraphs(hinweis, { indent: 9 });
    });
  }

  // ── GEBURTSTAGSKINDER ─────────────────────────────────────────
  const geburtstag = document.getElementById("einladung-geburtstag")?.value.trim();
  const gbBlockEl  = document.getElementById("einladung-geburtstag-block");
  if (geburtstag && gbBlockEl && gbBlockEl.style.display !== "none") {
    const activeMonthBtn = document.querySelector("#month-selector .allday-btn.active");
    const monatsname     = activeMonthBtn ? activeMonthBtn.textContent.split(" ")[0] : "";
    drawSection("cake", RED, "Geburtstage im " + monatsname, () => {
      addParagraphs(geburtstag, { indent: 9 });
    });
  }

  // ── KALENDER ABONNIEREN (auffälliger blauer Block) ────────────
  const icsUrl    = `https://raw.githubusercontent.com/${CONFIG.ICS_OWNER}/${CONFIG.ICS_REPO}/${CONFIG.ICS_BRANCH}/${CONFIG.ICS_FILE}`;
  const icsBlockH = 22;
  if (!measureOnly) {
    doc.setFillColor(...BLUE);
    doc.rect(0, y, W, icsBlockH, "F");
    doc.setFontSize(13);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...WHITE);
    doc.text("Termine herunterladen", W / 2, y + 8, { align: "center" });
    doc.setFontSize(10);
    doc.setFont(FONT, "normal");
    doc.setTextColor(200, 220, 255);
    doc.textWithLink(icsUrl, W / 2, y + 15, { align: "center", url: icsUrl });
  }
  y += icsBlockH;

  // ── FOOTER ────────────────────────────────────────────────────
  y += 8;
  if (!measureOnly) {
    doc.setFontSize(12);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...DARK);
    doc.text("1. Kommandant / 1. Vorstand", margin, y);
  }
  y += 8;

  return y;
}
