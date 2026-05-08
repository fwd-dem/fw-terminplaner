// ============================================================
//  🚒 FW Terminplaner – timepicker.js
//
//  Scroll-Picker für Uhrzeiten (Stunden / Minuten).
//  Abhängigkeiten: keine (eigenständig)
// ============================================================

let _tpFieldId = null;   // welches Feld wird gerade bearbeitet
let _tpHour    = 0;
let _tpMinute  = 0;

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function openTimePicker(fieldId) {
  _tpFieldId = fieldId;

  // Aktuellen Wert des Feldes lesen
  const current = document.getElementById(fieldId)?.value || "";
  if (current && current.includes(":")) {
    const [h, m] = current.split(":").map(Number);
    _tpHour   = h;
    _tpMinute = MINUTES.includes(m) ? m : 0;
  } else {
    // Standardwert: 19:00
    _tpHour   = 19;
    _tpMinute = 0;
  }

  // Label setzen
  const labels = {
    "start":     "Startzeit wählen",
    "end":       "Endzeit wählen",
    "tpl_start": "Startzeit wählen",
    "tpl_end":   "Endzeit wählen"
  };
  document.getElementById("tp-label").textContent = labels[fieldId] || "Uhrzeit wählen";

  // Listen aufbauen
  buildPickerList("tp-hours",   HOURS,   _tpHour,   "h");
  buildPickerList("tp-minutes", MINUTES, _tpMinute, "m");

  // Modal öffnen
  document.getElementById("time-picker-modal").classList.add("open");

  // Scroll zu aktuellem Wert (nach kurzem Delay damit DOM fertig ist)
  setTimeout(() => {
    scrollToSelected("tp-hours");
    scrollToSelected("tp-minutes");
  }, 50);
}

function buildPickerList(containerId, values, selectedVal, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  // Padding oben
  const padTop = document.createElement("div");
  padTop.className = "tp-scroll-pad";
  container.appendChild(padTop);

  values.forEach(val => {
    const item = document.createElement("div");
    item.className  = "tp-scroll-item" + (val === selectedVal ? " selected" : "");
    item.dataset.val = val;
    item.textContent = String(val).padStart(2, "0");

    item.addEventListener("click", () => {
      container.querySelectorAll(".tp-scroll-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");

      if (type === "h") _tpHour   = val;
      else              _tpMinute = val;

      item.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    container.appendChild(item);
  });

  // Padding unten
  const padBot = document.createElement("div");
  padBot.className = "tp-scroll-pad";
  container.appendChild(padBot);

  // Scroll-Snap: bei Scrollende das zentrierte Item selektieren
  container.addEventListener("scrollend", () => syncScrollSelection(container, type), { passive: true });
  // Fallback für Safari (kein scrollend)
  container.addEventListener("scroll", debounce(() => syncScrollSelection(container, type), 150), { passive: true });
}

function syncScrollSelection(container, type) {
  const containerRect = container.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;

  let closest     = null;
  let closestDist = Infinity;

  container.querySelectorAll(".tp-scroll-item").forEach(item => {
    const rect = item.getBoundingClientRect();
    const dist = Math.abs(rect.top + rect.height / 2 - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      closest     = item;
    }
  });

  if (!closest) return;

  container.querySelectorAll(".tp-scroll-item").forEach(i => i.classList.remove("selected"));
  closest.classList.add("selected");

  const val = parseInt(closest.dataset.val);
  if (type === "h") _tpHour   = val;
  else              _tpMinute = val;
}

function scrollToSelected(containerId) {
  const container = document.getElementById(containerId);
  const selected  = container.querySelector(".tp-scroll-item.selected");
  if (selected) {
    selected.scrollIntoView({ block: "center", behavior: "instant" });
  }
}

function confirmTimePicker() {
  const hh  = String(_tpHour).padStart(2, "0");
  const mm  = String(_tpMinute).padStart(2, "0");
  const val = `${hh}:${mm}`;

  // Verstecktes Input-Feld setzen
  const hiddenField = document.getElementById(_tpFieldId);
  if (hiddenField) hiddenField.value = val;

  // Anzeige-Button aktualisieren
  const displayBtn = document.getElementById(_tpFieldId + "-display");
  if (displayBtn) {
    displayBtn.textContent = val;
    displayBtn.classList.remove("empty");
  }

  closeTimePicker();
}

function clearTimePicker() {
  const hiddenField = document.getElementById(_tpFieldId);
  if (hiddenField) hiddenField.value = "";

  const displayBtn = document.getElementById(_tpFieldId + "-display");
  if (displayBtn) {
    displayBtn.textContent = "– : –";
    displayBtn.classList.add("empty");
  }

  closeTimePicker();
}

function closeTimePicker() {
  document.getElementById("time-picker-modal").classList.remove("open");
  _tpFieldId = null;
}

// Hilfsfunktion: verhindert zu häufige Scroll-Events
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Zeit-Display-Button nach Laden/Reset befüllen
function setTimeDisplay(fieldId, value) {
  const displayBtn  = document.getElementById(fieldId + "-display");
  const hiddenField = document.getElementById(fieldId);
  if (!displayBtn || !hiddenField) return;

  if (value) {
    hiddenField.value      = value;
    displayBtn.textContent = value;
    displayBtn.classList.remove("empty");
  } else {
    hiddenField.value      = "";
    displayBtn.textContent = "– : –";
    displayBtn.classList.add("empty");
  }
}
