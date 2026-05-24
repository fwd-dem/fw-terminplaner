// ============================================================
//  🚒 FW Terminplaner – ics.js
//
//  ICS-Kalender: Aufbau der .ics-Datei und lokaler Export.
//  Abhängigkeiten: config.js (store), ui.js (showModal)
// ============================================================

/* =========================
   📅 LOKALER ICS EXPORT
========================= */

function exportICS() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = store.events
    .filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) {
    showModal({ title: 'Keine Termine', text: 'Es gibt keine zukünftigen Termine.', onConfirm: () => {} });
    return;
  }

  // Download-Version: ohne CANCELLED
  const ics  = buildDownloadICS(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'FW-Demling-Termine-' + date + '.ics';
  a.click();
  URL.revokeObjectURL(url);
  showToastMsg('📅 ICS-Datei wird heruntergeladen');
}

/* =========================
   🔧 ICS BUILDER – BASIS (gemeinsamer Teil)
========================= */

// Baut den gemeinsamen ICS-Rumpf auf (Header, Termine, Footer).
// includeCancelled=true  → Feed-Version (mit CANCELLED für gelöschte Termine)
// includeCancelled=false → Download-Version (nur aktive Termine)
function buildICSBase(events, includeCancelled) {
  const lines = [];
  const now   = icsDateNow();
  const CRLF  = '\r\n';

  // ── Vergangene gelöschte Termine bereinigen (nur im Speicher) ─
  // Das Speichern auf GitHub übernimmt deleteEventFromGitHub in api.js,
  // damit kein SHA-Konflikt mit laufenden Schreiboperationen entsteht.
  if (includeCancelled) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    store.geloeschte = (store.geloeschte || []).filter(g => {
      if (!g.date) return false;
      const d = new Date(g.date); d.setHours(0, 0, 0, 0);
      return d >= today;
    });
  }

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//FwDemling//DE Kalender//DE');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('X-WR-CALNAME:FW Termine Demling');
  lines.push('X-WR-TIMEZONE:Europe/Berlin');
  lines.push('BEGIN:VTIMEZONE');
  lines.push('TZID:Europe/Berlin');
  lines.push('X-LIC-LOCATION:Europe/Berlin');
  lines.push('BEGIN:DAYLIGHT');
  lines.push('TZOFFSETFROM:+0100');
  lines.push('TZOFFSETTO:+0200');
  lines.push('TZNAME:CEST');
  lines.push('DTSTART:19700329T020000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
  lines.push('END:DAYLIGHT');
  lines.push('BEGIN:STANDARD');
  lines.push('TZOFFSETFROM:+0200');
  lines.push('TZOFFSETTO:+0100');
  lines.push('TZNAME:CET');
  lines.push('DTSTART:19701025T030000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  lines.push('END:STANDARD');
  lines.push('END:VTIMEZONE');

  // ── Aktive Termine ────────────────────────────────────────────
  for (let i = 0; i < events.length; i++) {
    const e       = events[i];
    const uid     = e.id + '@fw-terminplaner';
    const summary = icsEscape(e.title    || '(kein Titel)');
    const desc    = icsEscape(e.desc     || '');
    const loc     = icsEscape(e.location || '');
    let dtstart, dtend;

    if (e.allday) {
      const startStr = e.date.replace(/-/g, '');
      let endDate;
      if (e.date_end && e.date_end !== e.date) {
        const d = new Date(e.date_end); d.setDate(d.getDate() + 1);
        endDate = d.toISOString().slice(0, 10).replace(/-/g, '');
      } else {
        const d2 = new Date(e.date); d2.setDate(d2.getDate() + 1);
        endDate = d2.toISOString().slice(0, 10).replace(/-/g, '');
      }
      dtstart = ';VALUE=DATE:' + startStr;
      dtend   = ';VALUE=DATE:' + endDate;
    } else {
      dtstart = e.start
        ? ';TZID=Europe/Berlin:' + icsLocalDT(e.date, e.start)
        : ';VALUE=DATE:' + e.date.replace(/-/g, '');
      if (e.end) {
        dtend = ';TZID=Europe/Berlin:' + icsLocalDT(e.date, e.end);
      } else if (e.start) {
        const parts = e.start.split(':');
        const eh = String(parseInt(parts[0]) + 1).padStart(2, '0');
        dtend = ';TZID=Europe/Berlin:' + icsLocalDT(e.date, eh + ':' + parts[1]);
      } else {
        const d3 = new Date(e.date); d3.setDate(d3.getDate() + 1);
        dtend = ';VALUE=DATE:' + d3.toISOString().slice(0, 10).replace(/-/g, '');
      }
    }

    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + uid);
    lines.push('DTSTAMP:' + now);
    lines.push('DTSTART' + dtstart);
    lines.push('DTEND'   + dtend);
    lines.push('SUMMARY:' + summary);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('SEQUENCE:' + Math.floor(Date.now() / 1000));
    if (desc) lines.push('DESCRIPTION:' + desc);
    if (loc)  lines.push('LOCATION:' + loc);

    const validR = ['60','120','240','720','960','1200','1440'];
    [e.reminder1, e.reminder2].forEach(r => {
      if (r && validR.indexOf(String(r)) !== -1) {
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + icsEscape(e.title || 'Termin'));
        lines.push('TRIGGER:' + icsMinutesToDuration(parseInt(r)));
        lines.push('END:VALARM');
      }
    });

    lines.push('END:VEVENT');
  }

  // ── Abgesagte Termine (CANCELLED) — nur im Feed ───────────────
  if (includeCancelled) {
    for (let j = 0; j < store.geloeschte.length; j++) {
      const g        = store.geloeschte[j];
      const gUid     = (g.id || g.uid) + '@fw-terminplaner';  // g.id = neues Format, g.uid = Fallback altes Format
      const gSummary = icsEscape('[ABGESAGT] ' + (g.title || '(kein Titel)'));
      const gDate    = g.date ? g.date.replace(/-/g, '') : icsDateNow().slice(0, 8);
      const gDateEnd = g.date
        ? (() => { const gd = new Date(g.date); gd.setDate(gd.getDate() + 1); return gd.toISOString().slice(0, 10).replace(/-/g, ''); })()
        : gDate;

      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + gUid);
      lines.push('DTSTAMP:' + now);
      lines.push('DTSTART;VALUE=DATE:' + gDate);
      lines.push('DTEND;VALUE=DATE:' + gDateEnd);
      lines.push('SUMMARY:' + gSummary);
      lines.push('STATUS:CANCELLED');
      lines.push('TRANSP:TRANSPARENT');
      lines.push('SEQUENCE:' + Math.floor(Date.now() / 1000));
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF);
}

/* =========================
   🔧 ICS BUILDER – ÖFFENTLICHE API
========================= */

// Feed-Version: mit CANCELLED (für iPhone-Abo)
function buildLocalICS(events) {
  return buildICSBase(events, true);
}

// Download-Version: ohne CANCELLED (für direkten Download)
function buildDownloadICS(events) {
  return buildICSBase(events, false);
}

/* =========================
   🔧 ICS HILFSFUNKTIONEN
========================= */

function icsEscape(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g,  '\\;')
    .replace(/,/g,  '\\,')
    .replace(/\n/g, '\\n');
}

function icsLocalDT(date, time) {
  const p = date.split('-'), t = time.split(':');
  return p[0] + p[1] + p[2] + 'T' + t[0] + t[1] + '00';
}

function icsDateNow() {
  return new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function icsMinutesToDuration(minutes) {
  if (minutes >= 1440 && minutes % 1440 === 0) return '-P' + (minutes / 1440) + 'D';
  if (minutes >= 60   && minutes % 60   === 0) return '-PT' + (minutes / 60) + 'H';
  return '-PT' + minutes + 'M';
}
