// ============================================================
//  🚒 FW Terminplaner – icons.js
//
//  Icon-Zeichenfunktion für jsPDF.
//  Alle Icons werden als PNG-Bild gerendert.
//
//  Aufruf: drawIcon(doc, type, ix, iy, size, icons)
//    doc   → jsPDF-Instanz
//    type  → Icon-Name (string)
//    ix    → x-Position (mm)
//    iy    → y-Position (mm)
//    size  → Breite und Höhe in mm
//    icons → Objekt mit geladenen Base64-PNG-Strings
//
//  Icon-Dateinamen im Repo:
//    calendar.png, bulletlist.png, location.png, info.png,
//    hint.png, birthday.png, download.png, fireengine.png
// ============================================================

const ICON_FILES = {
  calendar_lines: "calendar.png",
  bullet_list:    "bulletlist.png",
  pin:            "location.png",
  info:           "info.png",
  star:           "hint.png",
  cake:           "birthday.png",
  download:       "download.png",
  flame:          "fireengine.png"
};

function drawIcon(doc, type, ix, iy, size, icons) {
  const b64 = icons?.[type];
  if (!b64) return;  // Icon nicht geladen → still überspringen
  doc.addImage(b64, "PNG", ix, iy, size, size, "", "FAST");
}
