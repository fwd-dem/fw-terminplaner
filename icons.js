// ============================================================
//  🚒 FW Terminplaner – icons.js
//
//  Zeichenfunktionen für jsPDF-Icons.
//  Alle Icons sind ca. 3.5×3.5mm groß (Sektions-Icons)
//  bzw. 2.5×3.5mm (Bullet-Icons).
//
//  Aufruf: drawIcon(doc, type, ix, iy, color)
//    doc   → jsPDF-Instanz
//    type  → Icon-Name (string)
//    ix    → x-Position (mm)
//    iy    → y-Position (mm)
//    color → [r, g, b]
// ============================================================

function drawIcon(doc, type, ix, iy, color) {
  const [r, g, b] = color;
  doc.setDrawColor(r, g, b);
  doc.setFillColor(r, g, b);
  doc.setLineWidth(0.45);

  switch (type) {

    // 📅 Kalender
    case "calendar_lines":
      doc.roundedRect(ix, iy+0.3, 3.5, 3.2, 0.25, 0.25, "S");
      doc.setLineWidth(0.3);
      doc.line(ix+0.7, iy+0,   ix+0.7, iy+0.9);
      doc.line(ix+2.8, iy+0,   ix+2.8, iy+0.9);
      doc.line(ix,     iy+1.2, ix+3.5, iy+1.2);
      doc.line(ix+0.4, iy+1.9, ix+3.1, iy+1.9);
      doc.line(ix+0.4, iy+2.6, ix+2.2, iy+2.6);
      doc.setLineWidth(0.45);
      break;

    // 📍 Pin / Ort
    case "pin":
      doc.circle(ix+1.75, iy+1.4, 1.3, "S");
      doc.circle(ix+1.75, iy+1.4, 0.45, "F");
      doc.lines(
        [[0.6,0.8],[0.0,0.8],[-0.6,0.8],[-0.6,-0.8],[-0.5,-0.5]],
        ix+1.15, iy+1.9, [1,1], "S"
      );
      break;

    // ☰ Aufzählung / Themen
    case "bullet_list":
      doc.circle(ix+0.4, iy+0.8, 0.35, "F");
      doc.circle(ix+0.4, iy+2.1, 0.35, "F");
      doc.circle(ix+0.4, iy+3.2, 0.35, "F");
      doc.setLineWidth(0.35);
      doc.line(ix+1.0, iy+0.8, ix+3.5, iy+0.8);
      doc.line(ix+1.0, iy+2.1, ix+3.0, iy+2.1);
      doc.line(ix+1.0, iy+3.2, ix+2.5, iy+3.2);
      doc.setLineWidth(0.45);
      break;

    // ℹ️ Info
    case "info":
      doc.circle(ix+1.75, iy+1.75, 1.75, "S");
      doc.setLineWidth(0.5);
      doc.line(ix+1.75, iy+1.7, ix+1.75, iy+2.9);
      doc.circle(ix+1.75, iy+1.15, 0.28, "F");
      doc.setLineWidth(0.45);
      break;

    // ★ Stern / Hinweis
    case "star": {
      const cx = ix+1.75, cy = iy+1.9, or = 1.7, ir = 0.75, sp = [];
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI / 5) - Math.PI / 2;
        sp.push([cx + Math.cos(a) * (k % 2 === 0 ? or : ir),
                 cy + Math.sin(a) * (k % 2 === 0 ? or : ir)]);
      }
      doc.moveTo(sp[0][0], sp[0][1]);
      sp.slice(1).forEach(p => doc.lineTo(p[0], p[1]));
      doc.lineTo(sp[0][0], sp[0][1]);
      doc.stroke();
      break;
    }

    // 🎂 Torte / Geburtstag
    case "cake":
      doc.setLineWidth(0.3);
      doc.rect(ix+1.45, iy+0.0, 0.6, 1.4, "F");
      doc.setFillColor(255, 200, 0);
      doc.ellipse(ix+1.75, iy-0.2, 0.35, 0.5, "F");
      doc.setFillColor(r, g, b);
      doc.roundedRect(ix+0.3, iy+1.4, 3.0, 1.1, 0.2, 0.2, "F");
      doc.roundedRect(ix+0.0, iy+2.5, 3.5, 1.3, 0.2, 0.2, "F");
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.35);
      doc.line(ix+0.5, iy+1.95, ix+3.1, iy+1.95);
      doc.line(ix+0.3, iy+3.1,  ix+3.2, iy+3.1);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.45);
      break;

    // ⬇ Download
    case "download":
      doc.line(ix+1.75, iy+0.3, ix+1.75, iy+2.3);
      doc.line(ix+0.85, iy+1.5, ix+1.75, iy+2.3);
      doc.line(ix+2.65, iy+1.5, ix+1.75, iy+2.3);
      doc.line(ix+0.3,  iy+3.2, ix+3.2,  iy+3.2);
      doc.setLineWidth(0.35);
      doc.line(ix+0.3, iy+2.6, ix+0.3, iy+3.2);
      doc.line(ix+3.2, iy+2.6, ix+3.2, iy+3.2);
      doc.setLineWidth(0.45);
      break;

    // 🔥 Flamme — Bullet-Icon für Weitere Infos / Hinweis
    // Gezeichnet als gefüllte Bézier-Kurve, ca. 2.5×3.5mm
    case "flame": {
      const fx = ix + 1.25;  // horizontale Mitte
      const fy = iy + 0.2;   // oberer Startpunkt

      // Äußere Flammenform mit Bézierkurven
      // doc.lines: [[dx1,dy1, dx2,dy2, dx,dy], ...]  (kubische Béziersegmente)
      doc.lines([
        // Linke Seite: nach unten-links schwingen
        [-0.6, 0.8,  -0.9, 1.6,  -0.7, 2.4],
        // Boden: nach rechts runden
        [ 0.3, 0.6,   0.9, 0.6,   1.4, 0.0],
        // Rechte Seite: nach oben-rechts schwingen
        [ 0.3,-0.8,   0.1,-1.6,  -0.2,-2.4],
        // Innere Spitze: nach links zurück zur Mitte
        [-0.2,-0.4,  -0.5, 0.2,  -0.5, 0.4],
        // Innere linke Kurve zurück zum Start
        [-0.1,-0.4,  -0.4,-0.6,  -0.7,-1.0],
      ], fx, fy, [1, 1], "F");

      // Kleine innere Flamme (hellerer Kern — weiß für Kontrast)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(255, 255, 255);
      doc.lines([
        [-0.15, 0.4,  -0.3, 0.8,  -0.2, 1.3],
        [ 0.15, 0.3,   0.4, 0.3,   0.6, 0.0],
        [ 0.1, -0.4,   0.0,-0.8,  -0.2,-1.3],
        [-0.1, -0.2,  -0.2, 0.1,  -0.3, 0.3],
      ], fx + 0.1, fy + 0.8, [1, 1], "F");

      // Farben zurücksetzen
      doc.setFillColor(r, g, b);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.45);
      break;
    }
  }
}
