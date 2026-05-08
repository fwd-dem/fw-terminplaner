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
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var events = store.events
    .filter(function(e) {
      if (!e.date) return false;
      var d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    })
    .sort(function(a, b) { return a.date.localeCompare(b.date); });

  if (events.length === 0) {
    showModal({ title: 'Keine Termine', text: 'Es gibt keine zukuenftigen Termine.', onConfirm: function() {} });
    return;
  }

  var ics  = buildLocalICS(events);
  var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var date = new Date().toISOString().slice(0, 10);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'FW-Demling-Termine-' + date + '.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   🔧 ICS BUILDER
========================= */

function buildLocalICS(events) {
  var lines = [];
  var now   = icsDateNow();
  var CRLF  = '\r\n';

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

  for (var i = 0; i < events.length; i++) {
    var e       = events[i];
    var uid     = e.id + '@fw-terminplaner';
    var summary = icsEscape(e.title    || '(kein Titel)');
    var desc    = icsEscape(e.desc     || '');
    var loc     = icsEscape(e.location || '');
    var dtstart, dtend;

    if (e.allday) {
      var startStr = e.date.replace(/-/g, '');
      var endDate;
      if (e.date_end && e.date_end !== e.date) {
        var d = new Date(e.date_end); d.setDate(d.getDate() + 1);
        endDate = d.toISOString().slice(0, 10).replace(/-/g, '');
      } else {
        var d2 = new Date(e.date); d2.setDate(d2.getDate() + 1);
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
        var parts = e.start.split(':');
        var eh = String(parseInt(parts[0]) + 1).padStart(2, '0');
        dtend = ';TZID=Europe/Berlin:' + icsLocalDT(e.date, eh + ':' + parts[1]);
      } else {
        var d3 = new Date(e.date); d3.setDate(d3.getDate() + 1);
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
    lines.push('SEQUENCE:0');
    if (desc) lines.push('DESCRIPTION:' + desc);
    if (loc)  lines.push('LOCATION:' + loc);

    var validR = ['60','120','240','720','960','1200','1440'];
    [e.reminder1, e.reminder2].forEach(function(r) {
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

  lines.push('END:VCALENDAR');
  return lines.join(CRLF);
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
  var p = date.split('-'), t = time.split(':');
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
