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
      const freiEl    = document.getElementById("einladung-info-frei");
      const hinweisEl = document.getElementById("einladung-hinweis");
      const hatInhalt = (freiEl?.value.trim() || "") || (hinweisEl?.value.trim() || "");

      const doSwitch = () => {
        selector.querySelectorAll(".allday-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        fillEinladung(m.year, m.month);
      };

      if (hatInhalt) {
        showModal({
          title: "Monat wechseln?",
          text: "Das Freifeld oder der Hinweis enthält Text, der beim Wechsel verloren geht. Trotzdem wechseln?",
          onConfirm: doSwitch
        });
      } else {
        doSwitch();
      }
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

  // Alle Nicht-Aktive Termine des Monats chronologisch
  const infoEvents = monthEvents
    .filter(e => e.category !== "active")
    .sort((a, b) => a.date.localeCompare(b.date));

  // Wichtige zukünftige Termine NACH dem Einladungsmonat
  // Letzter Tag des Einladungsmonats als Grenze
  const lastDayOfMonth = new Date(year, month + 1, 0);
  lastDayOfMonth.setHours(23, 59, 59, 999);

  // IDs der bereits in infoEvents enthaltenen Termine (Doppel vermeiden)
  const infoEventIds = new Set(infoEvents.map(e => e.id));
  // IDs der Aktive-Termine des Monats (auch diese nicht doppeln)
  const activeEventIds = new Set(activeEvents.map(e => e.id));

  const importantFutureEvents = store.events
    .filter(e => {
      if (!e.important) return false;
      if (!e.date) return false;
      const d = new Date(e.date);
      // Nur Termine nach dem Einladungsmonat
      if (d <= lastDayOfMonth) return false;
      // Nicht bereits in infoEvents oder activeEvents
      if (infoEventIds.has(e.id)) return false;
      if (activeEventIds.has(e.id)) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Wann: dynamisch pro Termin mit editierbarem Beschreibungsfeld ──
  const wannEl = document.getElementById("einladung-wann");
  if (wannEl) {
    if (activeEvents.length === 0) {
      wannEl.innerHTML = '<span style="color:#aaa;font-size:13px;">Keine Aktive-Termine in diesem Monat</span>';
    } else {
      wannEl.innerHTML = "";
      activeEvents.forEach((e, i) => {
        const datStr = new Date(e.date).toLocaleDateString("de-DE", {
          weekday: "long", day: "numeric", month: "long"
        });
        const time = e.start ? ` ${e.start} Uhr` : "";

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "margin-bottom:10px;";

        // Datum-Zeile
        const label = document.createElement("div");
        label.className = "einladung-wann-row";
        label.style.fontWeight = "600";
        label.textContent = `📅 ${datStr}${time}`;
        wrapper.appendChild(label);

        // Beschreibungs-Textfeld
        const ta = document.createElement("textarea");
        ta.className       = "einladung-textarea";
        ta.id              = `einladung-thema-${i}`;
        ta.dataset.eventId = e.id;
        ta.placeholder     = "Thema / Beschreibung…";
        ta.rows            = 2;
        ta.value           = e.desc ? e.desc.trim() : "";
        ta.style.marginTop = "4px";
        wrapper.appendChild(ta);

        wannEl.appendChild(wrapper);
      });
    }
  }

  // ── Weitere Informationen: dynamisch pro Termin + Freifeld ────
  const infoTermineEl = document.getElementById("einladung-info-termine");
  const infoFreiEl    = document.getElementById("einladung-info-frei");

  if (infoTermineEl) {
    const allInfoEvents = [...infoEvents, ...importantFutureEvents];
    infoTermineEl.innerHTML = "";

    allInfoEvents.forEach((e, i) => {
      const datStr = new Date(e.date).toLocaleDateString("de-DE", {
        weekday: "long", day: "numeric", month: "long"
      });
      const time  = e.start ? ` ${e.start} Uhr` : "";
      const titel = e.title ? ` - ${e.title}` : "";

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "margin-bottom:10px;";

      // Datum + Titel Zeile
      const label = document.createElement("div");
      label.style.cssText   = "font-weight:600; font-size:14px; margin-bottom:4px;";
      label.textContent     = `📅 ${datStr}${time}${titel}`;
      wrapper.appendChild(label);

      // Beschreibungs-Textfeld
      const ta           = document.createElement("textarea");
      ta.className       = "einladung-textarea";
      ta.id              = `einladung-info-desc-${i}`;
      ta.dataset.eventId = e.id;
      ta.placeholder     = "Beschreibung…";
      ta.rows            = 2;
      ta.value           = e.desc ? e.desc.trim() : "";
      wrapper.appendChild(ta);

      infoTermineEl.appendChild(wrapper);
    });
  }

  // Freifeld leeren beim Monatswechsel
  if (infoFreiEl) infoFreiEl.value = "";

  // Hinweis leeren
  const hinweisEl = document.getElementById("einladung-hinweis");
  if (hinweisEl) hinweisEl.value = "";

  // Ort auf Default zurücksetzen
  const ortEl = document.getElementById("einladung-ort");
  if (ortEl) ortEl.value = "Feuerwehrgerätehaus (FWGH)";

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
  showLoading(true);

  // ── 1. ICS ZUERST PUSHEN (direkt am Button-Klick → iOS-kompatibel) ──
  const icsToday = new Date(); icsToday.setHours(0, 0, 0, 0);
  const icsEvents = store.events
    .filter(e => { if (!e.date) return false; const d = new Date(e.date); d.setHours(0,0,0,0); return d >= icsToday; })
    .sort((a, b) => a.date.localeCompare(b.date));

  window._icsStatus = null;  // wird nach PDF-Download im Modal angezeigt
  if (icsEvents.length > 0) {
    const feedContent     = buildLocalICS(icsEvents);      // Feed: mit CANCELLED
    const downloadContent = buildDownloadICS(icsEvents);   // Download: ohne CANCELLED
    const icsResult       = await pushICSToGitHub(feedContent, downloadContent);
    window._icsStatus = icsResult;
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

  // ── Icons laden ───────────────────────────────────────────────
  const icons = {};
  await Promise.all(
    Object.entries(ICON_FILES).map(async ([key, filename]) => {
      try { icons[key] = await fileToBase64(filename); }
      catch { console.warn(`Icon nicht gefunden: ${filename}`); }
    })
  );

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
  const measuredH = buildPDF(dummy, fontName, LOGO_FW, LOGO_FFW, true, icons);

  // ── SCHRITT 2: Echtes Dokument mit gemessener Höhe ────────────
  const finalH = measuredH + 10;
  const real   = new jsPDF({ unit: "mm", format: [160, finalH] });
  loadFonts(real);
  buildPDF(real, fontName, LOGO_FW, LOGO_FFW, false, icons);

  const activeBtn  = document.querySelector("#month-selector .allday-btn.active");
  const monthLabel = activeBtn ? activeBtn.textContent.replace(/\s+/g, "_") : "Einladung";
  real.save("FW_Einladung_" + monthLabel + ".pdf");
  showLoading(false);

  // ── Erfolgsmeldung: PDF + ICS-Status zusammen ─────────────────
  let statusText = "📄 PDF wurde heruntergeladen.";
  if (window._icsStatus === null) {
    statusText += "\n\n📅 Kein ICS-Update (keine zukünftigen Termine).";
  } else if (window._icsStatus.ok) {
    statusText += "\n\n✅ Kalender (ICS) wurde erfolgreich aktualisiert.";
  } else if (window._icsStatus.reason === "kein_token") {
    statusText += "\n\n⚠️ Kein GitHub Token — Kalender wurde nicht aktualisiert.";
  } else {
    statusText += "\n\n❌ Kalender-Update fehlgeschlagen: " + window._icsStatus.reason;
  }
  window._icsStatus = null;

  showModal({ title: "✅ Einladung erstellt", text: statusText, onConfirm: () => {} });
}

/* =========================
   🏗️ PDF INHALT AUFBAUEN
========================= */

function buildPDF(doc, FONT, LOGO_FW, LOGO_FFW, measureOnly, icons) {
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
    const paragraphs = clean(text).split("\n")
      .map(p => p.trim().replace(/^•\s*/, ""))  // • am Zeilenanfang entfernen
      .filter(p => p !== "");
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
          drawIcon(doc, "flame", margin + indent, y - 3, 4, icons);
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
      if (iconType) drawIcon(doc, iconType, margin, y - 0.5, 4, icons);
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

    if (LOGO_FW)  doc.addImage(LOGO_FW,  "PNG", L1_X, LOGO_Y, LOGO_H, LOGO_H, "", "SLOW");
    if (LOGO_FFW) doc.addImage(LOGO_FFW, "PNG", L2_X, LOGO_Y, LOGO_H, LOGO_H, "", "SLOW");

    // Text mittig auf der Seite
    doc.setTextColor(255, 255, 255);
    doc.text("Blaulicht-Bladl", W / 2, HEADER_H / 2 - 1, { align: "center" });

    doc.setFontSize(11);
    doc.setFont(FONT, "normal");
    doc.setTextColor(255, 210, 210);
    doc.text("Monatsinfo der FW Demling", W / 2, HEADER_H / 2 + 7, { align: "center" });
  }

  y = HEADER_H + 6;

  // ── ÜBUNGSTERMINE (mit Beschreibung aus den Textfeldern) ──────
  const wannContainer = document.getElementById("einladung-wann");
  const wannItems     = wannContainer ? wannContainer.querySelectorAll("[id^='einladung-thema-']") : [];
  const wannLabels    = wannContainer ? wannContainer.querySelectorAll(".einladung-wann-row") : [];

  drawSection("calendar_lines", RED, "Übungstermine", () => {
    if (wannLabels.length === 0) {
      addText("Keine Termine eingetragen", { color: GREY, indent: 9, after: 1 });
    } else {
      const iconW      = wannLabels.length > 1 ? 5 : 0;
      const textIndent = margin + 9 + iconW;
      const textW      = usable - 9 - iconW;

      wannLabels.forEach((label, i) => {
        const isLast  = i === wannLabels.length - 1;
        const datStr  = label.textContent.replace("📅 ", "").trim();
        const descVal = wannItems[i] ? wannItems[i].value.trim() : "";

        // Bullet-Icon
        if (wannLabels.length > 1 && !measureOnly) {
          drawIcon(doc, "flame", margin + 9, y - 3, 4, icons);
        }

        // Datum in fett
        doc.setFontSize(CONTENT_SIZE);
        doc.setFont(FONT, "bold");
        doc.setTextColor(...DARK);
        const datLines = doc.splitTextToSize(clean(datStr), textW);
        if (!measureOnly) doc.text(datLines, textIndent, y);
        y += datLines.length * (CONTENT_SIZE * 0.38);

        // Beschreibung in normal
        if (descVal) {
          doc.setFont(FONT, "normal");
          const descLines = doc.splitTextToSize(clean(descVal), textW);
          if (!measureOnly) doc.text(descLines, textIndent, y + 1);
          y += descLines.length * (CONTENT_SIZE * 0.38) + 1;
          y += isLast ? 2 : 4;
        } else {
          y += isLast ? 2 : 4;
        }
      });
    }
  });

  // ── ORT ───────────────────────────────────────────────────────
  const ortWert = document.getElementById("einladung-ort")?.value.trim() || "Feuerwehrgerätehaus (FWGH)";
  drawSection("pin", RED, "Ort", () => {
    addText(ortWert, { indent: 9 });
  });

  // ── WEITERE INFORMATIONEN ─────────────────────────────────────
  // Termin-Blöcke aus dynamischen Textfeldern
  const infoTermineContainer = document.getElementById("einladung-info-termine");
  const infoTermineItems     = infoTermineContainer
    ? infoTermineContainer.querySelectorAll("[id^='einladung-info-desc-']")
    : [];
  const infoTermineLabels    = infoTermineContainer
    ? infoTermineContainer.querySelectorAll("div[style*='font-weight']")
    : [];

  // Freifeld
  const infoFrei = document.getElementById("einladung-info-frei")?.value.trim() || "";

  const hasInfoTermine = infoTermineLabels.length > 0;
  const hasInfoFrei    = infoFrei.length > 0;

  if (hasInfoTermine || hasInfoFrei) {
    drawSection("info", RED, "Weitere Termine", () => {
      const totalItems  = infoTermineLabels.length +
        (hasInfoFrei ? infoFrei.split("\n").filter(l => l.trim()).length : 0);
      const useBullets  = totalItems > 1;
      const iconW       = useBullets ? 5 : 0;
      const textIndent  = margin + 9 + iconW;
      const textW       = usable - 9 - iconW;

      // ── Termin-Blöcke ───────────────────────────────────────
      Array.from(infoTermineLabels).forEach((label, i) => {
        const isLastBlock = !hasInfoFrei && i === infoTermineLabels.length - 1;
        const titelStr    = label.textContent.trim();
        const descVal     = infoTermineItems[i] ? infoTermineItems[i].value.trim() : "";

        // Bullet-Icon
        if (useBullets && !measureOnly) {
          drawIcon(doc, "flame", margin + 9, y - 3, 4, icons);
        }

        // Titel fett
        doc.setFontSize(CONTENT_SIZE);
        doc.setFont(FONT, "bold");
        doc.setTextColor(...DARK);
        const titelLines = doc.splitTextToSize(clean(titelStr), textW);
        if (!measureOnly) doc.text(titelLines, textIndent, y);
        y += titelLines.length * (CONTENT_SIZE * 0.38);

        // Beschreibung normal
        if (descVal) {
          doc.setFont(FONT, "normal");
          const descLines = doc.splitTextToSize(clean(descVal), textW);
          if (!measureOnly) doc.text(descLines, textIndent, y + 1);
          y += descLines.length * (CONTENT_SIZE * 0.38) + 1;
        }
        y += isLastBlock ? 2 : 4;
      });

      // ── Freifeld ─────────────────────────────────────────────
      if (hasInfoFrei) {
        const freiLines = infoFrei.split("\n")
          .map(l => l.trim().replace(/^•\s*/, ""))
          .filter(l => l !== "");

        freiLines.forEach((line, i) => {
          const isLast = i === freiLines.length - 1;

          if (useBullets && !measureOnly) {
            drawIcon(doc, "flame", margin + 9, y - 3, 4, icons);
          }

          doc.setFontSize(CONTENT_SIZE);
          doc.setFont(FONT, "normal");
          doc.setTextColor(...DARK);
          const lines = doc.splitTextToSize(clean(line), textW);
          if (!measureOnly) doc.text(lines, textIndent, y);
          y += lines.length * (CONTENT_SIZE * 0.38) + (isLast ? 2 : 4);
        });
      }
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
  const icsUrl    = "https://fwd-dem.github.io/fw-demling-termine/index.html";
  const icsBlockH = 18;
  if (!measureOnly) {
    doc.setFillColor(...BLUE);
    doc.rect(0, y, W, icsBlockH, "F");

    // Download-Icon via icons.js (weiß)
    const ix = margin;
    const iy = y + (icsBlockH / 2) - 2.5;
    drawIcon(doc, "download", ix, iy, 4, icons);

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
