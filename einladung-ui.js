// ============================================================
//  🚒 FW Terminplaner – einladung-ui.js
//
//  Einladungs-Vorschau: Monatsauswahl und Formular befüllen.
//
//  Abhängigkeiten: config.js (store), ui.js (showModal, showScreen),
//                  geburtstage.js (getNachname)
// ============================================================

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
  const lastDayOfMonth = new Date(year, month + 1, 0);
  lastDayOfMonth.setHours(23, 59, 59, 999);

  const infoEventIds   = new Set(infoEvents.map(e => e.id));
  const activeEventIds = new Set(activeEvents.map(e => e.id));

  const importantFutureEvents = store.events
    .filter(e => {
      if (!e.important) return false;
      if (!e.date) return false;
      const d = new Date(e.date);
      if (d <= lastDayOfMonth) return false;
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

        const label = document.createElement("div");
        label.className = "einladung-wann-row";
        label.style.fontWeight = "600";
        label.textContent = `📅 ${datStr}${time}`;
        wrapper.appendChild(label);

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

      const label = document.createElement("div");
      label.style.cssText   = "font-weight:600; font-size:14px; margin-bottom:4px;";
      label.textContent     = `📅 ${datStr}${time}${titel}`;
      wrapper.appendChild(label);

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
