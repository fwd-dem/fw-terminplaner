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

  // Alle Nicht-Aktive Termine chronologisch
  const infoEvents = monthEvents
    .filter(e => e.category !== "active")
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

  // ── Weitere Informationen: alle Nicht-Aktive Termine ─────────
  const infoEl = document.getElementById("einladung-info");
  if (infoEl) {
    if (infoEvents.length === 0) {
      infoEl.value = "";
    } else {
      infoEl.value = infoEvents.map(e => {
        const datStr = new Date(e.date).toLocaleDateString("de-DE", {
          weekday: "long", day: "numeric", month: "long"
        });
        const time  = e.start ? ` ${e.start} Uhr` : "";
        const titel = e.title ? ` ${e.title}` : "";
        const desc  = e.desc && e.desc.trim() ? ` – ${e.desc.trim()}` : "";
        return `• ${datStr}${time}${titel}${desc}`;
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
  const PAD_BOTTOM   = 2;
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
    const { size = CONTENT_SIZE, color = DARK, indent = 0, paraAfter = 4, bullets = false } = opts;
    const paragraphs = clean(text).split("\n").filter(p => p.trim() !== "");
    const useBullets = bullets && paragraphs.length > 1;
    const bulletW    = useBullets ? 5 : 0;  // 3.5mm Flamme + 1.5mm Abstand

    paragraphs.forEach((para, i) => {
      doc.setFontSize(size);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...color);

      if (useBullets) {
        // Flammen-Bullet via icons.js
        const lines = doc.splitTextToSize(para.trim(), usable - indent - bulletW);
        if (!measureOnly) {
          drawIcon(doc, "flame", margin + indent, y - 2.5, color);
          doc.setFontSize(size);
          doc.setFont(FONT, "normal");
          doc.setTextColor(...color);
          doc.text(lines, margin + indent + bulletW, y);
        }
        y += lines.length * (size * 0.38) + (i < paragraphs.length - 1 ? paraAfter : 2);
      } else {
        const lines = doc.splitTextToSize(para.trim(), usable - indent);
        if (!measureOnly) doc.text(lines, margin + indent, y);
        y += lines.length * (size * 0.38) + (i < paragraphs.length - 1 ? paraAfter : 2);
      }
    });
  }

  function drawSection(iconType, iconColor, labelText, contentFn) {
    // Höhe messen — temporär measureOnly aktivieren
    const wasMeasuring = measureOnly;
    measureOnly = true;
    const savedY = y;
    contentFn();
    const contentH = y - savedY;
    y = savedY;
    measureOnly = wasMeasuring;

    const totalH = PAD_TOP + LABEL_H + contentH + PAD_BOTTOM;
    const startY = y;

    if (!measureOnly) {
      const bgColor = zebraIdx % 2 === 0 ? BOX_W : BOX_A;
      doc.setFillColor(...bgColor);
      doc.rect(0, startY, W, totalH, "F");
      zebraIdx++;
    }

    y = startY + PAD_TOP;

    if (!measureOnly) {
      if (iconType) drawIcon(doc, iconType, margin, y - 0.5, iconColor || RED);
      doc.setFontSize(LABEL_SIZE);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...(iconColor || RED));
      doc.text(clean(labelText), margin + (iconType ? 6 : 0), y + 3.5);
    }

    y = startY + PAD_TOP + LABEL_H;

    if (!measureOnly) doc.setTextColor(...DARK);
    contentFn();

    // y exakt auf Ende der Box setzen — ignoriert was contentFn mit y gemacht hat
    y = startY + totalH;
  }

  // ── HEADER ───────────────────────────────────────────────────
  const HEADER_H = 36;
  const LOGO_H   = 36;
  const LOGO_Y   = 0;

  if (!measureOnly) {
    doc.setFillColor(...RED);
    doc.rect(0, 0, W, HEADER_H, "F");

    // Textbreite messen um Textränder zu kennen
    doc.setFontSize(24);
    doc.setFont(FONT, "bold");
    const titleW     = doc.getTextWidth("Blaulicht-Bladl");
    const textLeft   = W / 2 - titleW / 2;
    const textRight  = W / 2 + titleW / 2;

    // Linkes Logo: Mitte zwischen x=0 und linkem Textrand
    const L1_CX = textLeft / 2;
    const L1_X  = L1_CX - LOGO_H / 2;

    // Rechtes Logo: Mitte zwischen rechtem Textrand und x=W
    const L2_CX = textRight + (W - textRight) / 2;
    const L2_X  = L2_CX - LOGO_H / 2;

    if (LOGO_FW)  doc.addImage(LOGO_FW,  "PNG", L1_X, LOGO_Y, LOGO_H, LOGO_H);
    if (LOGO_FFW) doc.addImage(LOGO_FFW, "PNG", L2_X, LOGO_Y, LOGO_H, LOGO_H);

    // Text mittig auf der Seite
    doc.setTextColor(255, 255, 255);
    doc.text("Blaulicht-Bladl", W / 2, HEADER_H / 2 - 1, { align: "center" });

    doc.setFontSize(11);
    doc.setFont(FONT, "normal");
    doc.setTextColor(255, 210, 210);
    doc.text("Monatsinfo der FW Demling", W / 2, HEADER_H / 2 + 7, { align: "center" });
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
      addParagraphs(info, { indent: 9, bullets: true });
    });
  }

  // ── HINWEIS ───────────────────────────────────────────────────
  const hinweis = document.getElementById("einladung-hinweis")?.value.trim();
  if (hinweis) {
    drawSection("star", RED, "Hinweis", () => {
      addParagraphs(hinweis, { indent: 9, bullets: true });
    });
  }

  // ── GEBURTSTAGSKINDER ─────────────────────────────────────────
  const geburtstag = document.getElementById("einladung-geburtstag")?.value.trim();
  const gbBlockEl  = document.getElementById("einladung-geburtstag-block");
  if (geburtstag && gbBlockEl && gbBlockEl.style.display !== "none") {
    const activeMonthBtn = document.querySelector("#month-selector .allday-btn.active");
    const monatsname     = activeMonthBtn ? activeMonthBtn.textContent.split(" ")[0] : "";
    drawSection("cake", RED, "Geburtstage im " + monatsname, () => {
      // Namen kommagetrennt, aber nie einen Namen umbrechen
      const indent    = 9;
      const maxW      = usable - indent;
      const names     = geburtstag.split(",").map(n => n.trim()).filter(Boolean);
      doc.setFontSize(CONTENT_SIZE);
      doc.setFont(FONT, "normal");

      let currentLine = "";
      names.forEach((name, i) => {
        const isLast   = i === names.length - 1;
        const part     = isLast ? name : name + ",";
        const testLine = currentLine ? currentLine + " " + part : part;
        const testW    = doc.getTextWidth(testLine);

        if (testW > maxW && currentLine !== "") {
          // Aktuelle Zeile ausgeben, Name in neue Zeile
          if (!measureOnly) {
            doc.setTextColor(...DARK);
            doc.text(clean(currentLine), margin + indent, y);
          }
          y += CONTENT_SIZE * 0.38 + 2;
          currentLine = part;
        } else {
          currentLine = testLine;
        }
      });

      // Letzte Zeile ausgeben
      if (currentLine) {
        if (!measureOnly) {
          doc.setTextColor(...DARK);
          doc.text(clean(currentLine), margin + indent, y);
        }
        y += CONTENT_SIZE * 0.38 + 4;
      }
    });
  }

  // ── KALENDER HERUNTERLADEN (blauer Block, klickbar) ──────────
  const icsUrl    = `https://raw.githubusercontent.com/${CONFIG.ICS_OWNER}/${CONFIG.ICS_REPO}/${CONFIG.ICS_BRANCH}/${CONFIG.ICS_FILE}`;
  const icsBlockH = 18;
  if (!measureOnly) {
    doc.setFillColor(...BLUE);
    doc.rect(0, y, W, icsBlockH, "F");

    // Download-Icon via icons.js (weiß)
    const ix = margin;
    const iy = y + (icsBlockH / 2) - 2.5;
    drawIcon(doc, "download", ix, iy, WHITE);

    // Unsichtbarer Link über den gesamten Block → Icon + Text klickbar
    doc.link(0, y, W, icsBlockH, { url: icsUrl });

    // Sichtbarer Text (nicht als Link — Link kommt vom Overlay oben)
    doc.setFontSize(LABEL_SIZE);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...WHITE);
    doc.text("Termine herunterladen", margin + 6, y + icsBlockH / 2 + 2);
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
