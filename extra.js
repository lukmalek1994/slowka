(function () {
'use strict';
var APP = window.APP = window.APP || {};
var D = null; // aktywne ćwiczenie (drill)

function db() { return APP.db(); }
function esc(s) { return APP.esc(s); }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function shuffle(a) { return APP.shuffle(a); }
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[rnd(a.length)]; }
function cname(c) { return APP.COURSES[c].flag + ' ' + APP.COURSES[c].name; }

/* ================= statystyki, cel dzienny ================= */
function record(ok, course) {
  var d = db(), k = dayKey(), s = d.st[k] || (d.st[k] = { c: 0, w: 0 });
  if (ok) s.c++; else s.w++;
  var cs = s[course] || (s[course] = [0, 0]); cs[ok ? 0 : 1]++;
  var goal = d.s.goal || 30;
  if (ok && s.c >= goal && !s.goalHit) { s.goalHit = 1; toast('🎯 Cel dzienny osiągnięty!'); }
  APP.save();
}
APP.todayCorrect = function () { var s = db().st[dayKey()]; return s ? s.c : 0; };
APP.onAnswer = function (ok, course) { record(ok, course); check(); };
function recordDrill(ok, course, kind) {
  var d = db(), k = dayKey();
  d.days[k] = (d.days[k] || 0) + 1;
  d.dr = d.dr || {};
  if (ok) d.dr[kind] = (d.dr[kind] || 0) + 1;
  record(ok, course); check();
}

var toastQ = [], toastBusy = false;
function toast(msg) { toastQ.push(msg); if (!toastBusy) nextToast(); }
function nextToast() {
  var m = toastQ.shift(); if (!m) { toastBusy = false; return; }
  toastBusy = true;
  var el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = m; el.className = 'show';
  setTimeout(function () { el.className = ''; setTimeout(nextToast, 350); }, 2600);
}

/* ================= odznaki ================= */
function bestStreak() {
  var keys = Object.keys(db().days).map(function (k) { var p = k.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }).sort(function (a, b) { return a - b; });
  var best = 0, cur = 0, prev = null;
  keys.forEach(function (n) { cur = prev !== null && n === prev + 1 ? cur + 1 : 1; if (cur > best) best = cur; prev = n; });
  return best;
}
function metrics() {
  var d = db(), m = { correct: 0, goalDays: 0, learnedW: 0, learnedP: 0, mastered: 0, perCourse: {}, reads: Object.keys(d.read).length, best: bestStreak(), bestRound: 0, dr: d.dr || {} };
  Object.keys(d.st).forEach(function (k) { m.correct += d.st[k].c || 0; if (d.st[k].goalHit) m.goalDays++; });
  Object.keys(APP.COURSES).forEach(function (c) {
    var sw = APP.stats(c, 'w'), sp = APP.stats(c, 'p');
    m.learnedW += sw.learned; m.learnedP += sp.learned; m.mastered += sw.mastered + sp.mastered; m.perCourse[c] = sw.learned;
    m.bestRound = Math.max(m.bestRound, d.best[c] || 0);
  });
  return m;
}
var BADGES = [
  { id: 'first', i: '🌱', t: 'Pierwszy krok', d: 'Pierwsza poprawna odpowiedź', f: function (m) { return m.correct >= 1; } },
  { id: 'c100', i: '💯', t: 'Setka', d: '100 poprawnych odpowiedzi', f: function (m) { return m.correct >= 100; } },
  { id: 'c500', i: '🚀', t: 'Pięćset', d: '500 poprawnych odpowiedzi', f: function (m) { return m.correct >= 500; } },
  { id: 'c2000', i: '🏅', t: 'Maszyna', d: '2000 poprawnych odpowiedzi', f: function (m) { return m.correct >= 2000; } },
  { id: 'st3', i: '🔥', t: 'Trzy dni', d: '3 dni nauki z rzędu', f: function (m) { return m.best >= 3; } },
  { id: 'st7', i: '🔥', t: 'Tydzień', d: '7 dni nauki z rzędu', f: function (m) { return m.best >= 7; } },
  { id: 'st30', i: '🌋', t: 'Miesiąc', d: '30 dni nauki z rzędu', f: function (m) { return m.best >= 30; } },
  { id: 'w100', i: '📘', t: '100 słówek', d: 'Poznaj 100 słówek', f: function (m) { return m.learnedW >= 100; } },
  { id: 'w500', i: '📚', t: '500 słówek', d: 'Poznaj 500 słówek', f: function (m) { return m.learnedW >= 500; } },
  { id: 'm50', i: '🏆', t: 'Opanowane', d: '50 opanowanych pozycji', f: function (m) { return m.mastered >= 50; } },
  { id: 'p100', i: '💬', t: '100 zwrotów', d: 'Poznaj 100 zwrotów', f: function (m) { return m.learnedP >= 100; } },
  { id: 'r1', i: '📖', t: 'Czytelnik', d: 'Przeczytaj pierwszą czytankę', f: function (m) { return m.reads >= 1; } },
  { id: 'r5', i: '📕', t: 'Mól książkowy', d: 'Przeczytaj 5 czytanek', f: function (m) { return m.reads >= 5; } },
  { id: 'goal', i: '🎯', t: 'Cel osiągnięty', d: 'Osiągnij cel dzienny', f: function (m) { return m.goalDays >= 1; } },
  { id: 'goal7', i: '🎯', t: 'Systematyczny', d: 'Cel dzienny 7 razy', f: function (m) { return m.goalDays >= 7; } },
  { id: 'rd15', i: '⏱', t: 'Szybki', d: 'Runda na czas: 15 punktów', f: function (m) { return m.bestRound >= 15; } },
  { id: 'rd30', i: '⚡', t: 'Błyskawica', d: 'Runda na czas: 30 punktów', f: function (m) { return m.bestRound >= 30; } },
  { id: 'poly', i: '🌍', t: 'Poliglota', d: '20 słówek w każdym z 3 języków', f: function (m) { return Object.keys(m.perCourse).every(function (c) { return m.perCourse[c] >= 20; }); } },
  { id: 'gap50', i: '✍️', t: 'Mistrz luk', d: '50 poprawnych luk', f: function (m) { return (m.dr.gap || 0) >= 50; } },
  { id: 'dict50', i: '🎧', t: 'Uważny słuchacz', d: '50 poprawnych dyktand', f: function (m) { return (m.dr.dict || 0) >= 50; } },
  { id: 'num50', i: '🔢', t: 'Mistrz liczb', d: '50 poprawnych odpowiedzi z liczb i czasu', f: function (m) { return (m.dr.num || 0) >= 50; } }
];
function check() {
  var d = db(), m = metrics(), changed = false;
  BADGES.forEach(function (b) {
    if (!d.badges[b.id] && b.f(m)) { d.badges[b.id] = Date.now(); changed = true; toast('🏅 Nowa odznaka: ' + b.t); }
  });
  if (changed) APP.save();
}
APP.check = check;

function vBadges() {
  var d = db(), got = BADGES.filter(function (b) { return d.badges[b.id]; }).length;
  var h = '<button class="back" data-act="home">‹ Wróć</button><h1>Odznaki</h1><div class="mute" style="margin-bottom:12px">Zdobyte: ' + got + ' / ' + BADGES.length + '</div><div class="badges">';
  BADGES.forEach(function (b) {
    var on = !!d.badges[b.id];
    h += '<div class="badge' + (on ? ' on' : '') + '"><div class="bi">' + b.i + '</div><b>' + esc(b.t) + '</b><div class="mute">' + esc(b.d) + '</div></div>';
  });
  return h + '</div>';
}

/* ================= statystyki (widok) ================= */
var DAYS_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
function vStats() {
  var d = db(), now = new Date(), days = [], max = 1, i;
  for (i = 6; i >= 0; i--) {
    var x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i), s = d.st[dayKey(x)] || { c: 0, w: 0 };
    days.push({ l: DAYS_PL[x.getDay()], c: s.c || 0, w: s.w || 0 }); max = Math.max(max, (s.c || 0) + (s.w || 0));
  }
  var w7 = days.reduce(function (a, x) { return { c: a.c + x.c, w: a.w + x.w }; }, { c: 0, w: 0 });
  var tot = { c: 0, w: 0 }, w30 = { c: 0, w: 0 }, per = {};
  Object.keys(d.st).forEach(function (k) {
    var s = d.st[k], p = k.split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]), age = (now - dt) / 86400000;
    tot.c += s.c || 0; tot.w += s.w || 0;
    if (age <= 30) { w30.c += s.c || 0; w30.w += s.w || 0; }
    Object.keys(APP.COURSES).forEach(function (c) { if (s[c]) { var a = per[c] || (per[c] = [0, 0]); a[0] += s[c][0]; a[1] += s[c][1]; } });
  });
  var h = '<button class="back" data-act="home">‹ Wróć</button><h1>Statystyki</h1>';
  h += '<div class="card"><h2>Ostatnie 7 dni</h2><div class="chart">';
  days.forEach(function (x) {
    h += '<div class="col"><div class="stack"><i class="bw" style="height:' + Math.round(x.w / max * 100) + 'px"></i><i class="bc" style="height:' + Math.round(x.c / max * 100) + 'px"></i></div><span>' + x.l + '</span><small>' + (x.c + x.w) + '</small></div>';
  });
  h += '</div><div class="chips"><span class="chip" style="background:var(--ok-bg);color:#0a6a2b">poprawne</span><span class="chip" style="background:var(--bad-bg);color:#a8221a">błędne</span></div></div>';
  function box(t, a) { return '<div><b>' + (a.c + a.w) + '</b>' + t + ' · ' + APP.pct(a.c, a.c + a.w) + '% trafnych</div>'; }
  h += '<div class="card"><h2>Podsumowanie</h2><div class="statg">' + box('odpowiedzi (7 dni)', w7) + box('odpowiedzi (30 dni)', w30) + box('odpowiedzi łącznie', tot) + '<div><b>' + APP.streak() + '</b>dni serii</div></div></div>';
  h += '<div class="card"><h2>Języki</h2>';
  Object.keys(APP.COURSES).forEach(function (c) {
    var a = per[c] || [0, 0], sw = APP.stats(c, 'w'), sp = APP.stats(c, 'p');
    h += '<div class="wrow" style="cursor:default"><div class="grow" style="flex:1"><div class="w">' + cname(c) + '</div><div class="t">Słówka ' + sw.learned + '/' + sw.total + ' · Zwroty ' + sp.learned + '/' + sp.total + ' · opanowane ' + (sw.mastered + sp.mastered) + '</div></div><span class="mute">' + APP.pct(a[0], a[0] + a[1]) + '%</span></div>';
  });
  return h + '</div>';
}

/* ================= ekran główny, ustawienia ================= */
APP.homeTop = function () {
  var t = APP.todayCorrect(), g = db().s.goal || 30, pc = Math.min(100, Math.round(t / g * 100));
  var gotB = BADGES.filter(function (b) { return db().badges[b.id]; }).length;
  return '<div class="card"><div class="row2" style="justify-content:space-between"><b>🎯 Cel dzienny</b><span class="mute">' + t + ' / ' + g + '</span></div>' +
    '<div class="bar"><i style="width:' + pc + '%;background:var(--ok)"></i></div><div class="mute">' + (t >= g ? 'Cel osiągnięty, brawo!' : 'Jeszcze ' + (g - t) + ' poprawnych odpowiedzi') + '</div></div>' +
    '<div class="row2" style="margin-bottom:16px"><button class="btn sec" data-act="xstats" style="margin:0;flex:1">📊 Statystyki</button><button class="btn sec" data-act="xbadges" style="margin:0;flex:1">🏅 Odznaki ' + gotB + '/' + BADGES.length + '</button></div>';
};
APP.courseTop = function (c) {
  var due = APP.mixCount(c);
  return '<button class="btn blue" data-act="mix" data-c="' + c + '"' + (due ? '' : ' disabled') + '>Powtórka mix<small>' + (due ? Math.min(due, 20) + (due > 20 ? ' z ' + due : '') + ' pozycji: słówka, zwroty i moje słówka' : 'Nic na dziś w tym języku') + '</small></button>';
};
APP.settingsExtra = function () {
  var s = db().s;
  return '<div class="card"><h2>Nauka</h2><label>Cel dzienny (poprawne odpowiedzi)</label><select data-act="goal">' +
    [10, 20, 30, 50, 100].map(function (n) { return '<option value="' + n + '"' + (s.goal === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
    '<label>Uzupełnianie luk</label><select data-act="gaptype"><option value="choice"' + (s.gapType === 'type' ? '' : ' selected') + '>Wybór z 4 opcji</option><option value="type"' + (s.gapType === 'type' ? ' selected' : '') + '>Wpisywanie słowa</option></select></div>';
};
APP.courseExtras = function (c) {
  var best = db().best[c] || 0;
  return '<h2 style="margin:22px 0 8px">Ćwiczenia dodatkowe</h2>' +
    '<button class="btn sec" data-act="xround" data-c="' + c + '">⏱ Runda na czas<small>60 sekund' + (best ? ' · rekord ' + best : '') + '</small></button>' +
    '<button class="btn sec" data-act="xgap" data-c="' + c + '">✍️ Uzupełnianie luk<small>Wstaw brakujące słowo w zdaniu</small></button>' +
    '<button class="btn sec" data-act="xdict" data-c="' + c + '">🎧 Dyktando<small>Posłuchaj i wpisz zdanie</small></button>' +
    '<button class="btn sec" data-act="xnumbers" data-c="' + c + '">🔢 Liczby, daty, godziny<small>Słuchaj i rozpoznawaj</small></button>';
};

/* ================= liczby, daty, godziny ================= */
var ES_U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
var ES_T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
var ES_H = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function esW(n) {
  if (n < 30) return ES_U[n];
  if (n < 100) { var u = n % 10; return ES_T[Math.floor(n / 10)] + (u ? ' y ' + ES_U[u] : ''); }
  if (n === 100) return 'cien';
  if (n < 1000) return ES_H[Math.floor(n / 100)] + (n % 100 ? ' ' + esW(n % 100) : '');
  var th = Math.floor(n / 1000), r = n % 1000;
  return (th === 1 ? 'mil' : esW(th) + ' mil') + (r ? ' ' + esW(r) : '');
}
var IT_U = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
var IT_T = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
function itW(n) {
  if (n < 20) return IT_U[n];
  if (n < 100) {
    var u = n % 10, w = IT_T[Math.floor(n / 10)];
    if (!u) return w;
    if (u === 1 || u === 8) w = w.slice(0, -1);
    return w + (u === 3 ? 'tré' : IT_U[u]);
  }
  if (n < 1000) {
    var h = Math.floor(n / 100), r = n % 100, hw = h === 1 ? 'cento' : IT_U[h] + 'cento';
    if (!r) return hw;
    if (r >= 80 && r < 90) hw = hw.slice(0, -1);
    return hw + itW(r);
  }
  var th = Math.floor(n / 1000), rr = n % 1000;
  return (th === 1 ? 'mille' : IT_U[th] + 'mila') + (rr ? ' ' + itW(rr) : '');
}
var EN_U = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
var EN_T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function enW(n) {
  if (n < 20) return EN_U[n];
  if (n < 100) return EN_T[Math.floor(n / 10)] + (n % 10 ? '-' + EN_U[n % 10] : '');
  if (n < 1000) return EN_U[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + enW(n % 100) : '');
  return enW(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + enW(n % 1000) : '');
}
var ORD_U = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
function enOrd(n) {
  if (n < 20) return ORD_U[n];
  if (n === 20) return 'twentieth';
  if (n === 30) return 'thirtieth';
  return EN_T[Math.floor(n / 10)] + '-' + ORD_U[n % 10];
}
var NW = { es: esW, it: itW, en: enW };

var MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
var WEEK = {
  es: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
};
var MONTHS_PL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
var WEEK_PL = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];

function timeWords(c, h, m) {
  var nh = h % 12 + 1, hh;
  if (c === 'es') {
    var HW = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'];
    function hp(x) { return (x === 1 ? 'Es la ' : 'Son las ') + HW[x]; }
    if (m === 0) return hp(h) + ' en punto';
    if (m <= 30) return hp(h) + ' y ' + (m === 15 ? 'cuarto' : m === 30 ? 'media' : esW(m));
    return hp(nh) + ' menos ' + (m === 45 ? 'cuarto' : esW(60 - m));
  }
  if (c === 'it') {
    var IW = ['', "l'una", 'le due', 'le tre', 'le quattro', 'le cinque', 'le sei', 'le sette', 'le otto', 'le nove', 'le dieci', 'le undici', 'le dodici'];
    function ip(x) { return (x === 1 ? 'È ' : 'Sono ') + IW[x]; }
    if (m === 0) return ip(h) + ' in punto';
    if (m <= 30) return ip(h) + ' e ' + (m === 15 ? 'un quarto' : m === 30 ? 'mezza' : itW(m));
    return ip(nh) + ' meno ' + (m === 45 ? 'un quarto' : itW(60 - m));
  }
  hh = enW(h);
  if (m === 0) return "It's " + hh + " o'clock";
  if (m === 15) return "It's a quarter past " + hh;
  if (m === 30) return "It's half past " + hh;
  if (m === 45) return "It's a quarter to " + enW(nh);
  return "It's " + (m < 30 ? enW(m) + ' past ' + hh : enW(60 - m) + ' to ' + enW(nh));
}
function timeDigits(h, m) { return h + ':' + (m < 10 ? '0' + m : m); }
function dateWords(c, d, mo) {
  if (c === 'es') return 'el ' + esW(d) + ' de ' + MONTHS.es[mo - 1];
  if (c === 'it') return 'il ' + (d === 1 ? 'primo' : itW(d)) + ' ' + MONTHS.it[mo - 1];
  return MONTHS.en[mo - 1] + ' ' + enOrd(d);
}
function dateDigits(c, d, mo) { return c === 'en' ? mo + '/' + d : (d < 10 ? '0' + d : d) + '.' + (mo < 10 ? '0' + mo : mo); }
function priceWords(c, eur, ct) {
  if (c === 'es') return (eur === 1 ? 'un euro' : esW(eur).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un') + ' euros') + (ct ? ' con ' + esW(ct) : '');
  if (c === 'it') return (eur === 1 ? 'un euro' : itW(eur) + ' euro') + (ct ? ' e ' + itW(ct) : '');
  return enW(eur) + (eur === 1 ? ' dollar' : ' dollars') + (ct ? ' and ' + enW(ct) + ' cents' : '');
}
function priceDigits(c, eur, ct) {
  var cc = ct < 10 ? '0' + ct : ct;
  return c === 'en' ? '$' + eur + '.' + cc : eur + ',' + cc + ' €';
}

function uniqueOpts(correct, makers, fmt) {
  var set = {}, out = [correct]; set[fmt(correct)] = 1;
  var tries = 0;
  while (out.length < 4 && tries++ < 80) {
    var v = pick(makers)(); if (v === null || v === undefined) continue;
    var key = fmt(v); if (set[key]) continue; set[key] = 1; out.push(v);
  }
  return out;
}
function mkChoice(opts, correct, fmt) {
  return shuffle(opts).map(function (o) { return { t: fmt(o), ok: o === correct }; });
}

// zakres liczb dla poziomów
var LEVELS = [
  { id: 'n20', t: 'Liczby 0–20', lo: 0, hi: 20 },
  { id: 'n100', t: 'Liczby 21–100', lo: 21, hi: 100 },
  { id: 'n1000', t: 'Liczby 101–1000', lo: 101, hi: 1000 },
  { id: 'n9999', t: 'Liczby 1000–9999', lo: 1000, hi: 9999 },
  { id: 'time', t: 'Godziny' },
  { id: 'date', t: 'Daty' },
  { id: 'price', t: 'Ceny' },
  { id: 'dm', t: 'Dni tygodnia i miesiące' }
];

function numQuestion(c, lv) {
  var n = lv.lo + rnd(lv.hi - lv.lo + 1);
  if (lv.id === 'n1000' && rnd(3)) n = 100 * (1 + rnd(9)) + (rnd(2) ? rnd(100) : 0);
  var words = NW[c](n), t = rnd(3);
  function near() {
    var kind = rnd(4), v;
    if (kind === 0) v = n + (rnd(2) ? 1 : -1) * (1 + rnd(3));
    else if (kind === 1) v = n + (rnd(2) ? 10 : -10) * (1 + rnd(2));
    else if (kind === 2) v = Number(String(n).split('').reverse().join(''));
    else v = n + (rnd(2) ? 100 : -100);
    return v >= lv.lo - 5 && v <= lv.hi + 5 && v >= 0 && v !== n ? v : null;
  }
  var q = { course: c, tag: 'num', ans: String(n) };
  if (t === 0) { // słuchasz → wpisujesz cyfry
    q.kind = 'type'; q.html = '<div class="mute">Posłuchaj i wpisz liczbę cyframi</div>'; q.say = words; q.numeric = true; q.answers = [String(n)];
    q.show = String(n) + ' — ' + words;
  } else if (t === 1) { // widzisz cyfry → wybierasz zapis
    q.kind = 'choice'; q.html = '<div class="big">' + n + '</div><div class="mute" style="margin-top:6px">Wybierz zapis słowny</div>';
    var o = uniqueOpts(n, [near, near, near], function (x) { return NW[c](x); });
    q.options = mkChoice(o, n, function (x) { return NW[c](x); }); q.show = String(n) + ' — ' + words; q.after = words;
  } else { // słuchasz → wybierasz cyfry
    q.kind = 'choice'; q.html = '<div class="mute">Posłuchaj i wybierz liczbę</div>'; q.say = words;
    var o2 = uniqueOpts(n, [near, near, near], function (x) { return String(x); });
    q.options = mkChoice(o2, n, function (x) { return String(x); }); q.show = String(n) + ' — ' + words;
  }
  return q;
}
function timeQuestion(c) {
  var h = 1 + rnd(12), m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]), words = timeWords(c, h, m), digits = timeDigits(h, m);
  function near() { var hh = h, mm = m; if (rnd(2)) mm = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]); else hh = 1 + rnd(12); return { h: hh, m: mm }; }
  var correct = { h: h, m: m }, set = {}, opts = [correct]; set[digits] = 1;
  var guard = 0; while (opts.length < 4 && guard++ < 60) { var v = near(), k = timeDigits(v.h, v.m); if (!set[k]) { set[k] = 1; opts.push(v); } }
  var q = { course: c, tag: 'num', kind: 'choice', show: digits + ' — ' + words };
  if (rnd(2)) {
    q.html = '<div class="mute">Posłuchaj i wybierz godzinę</div>'; q.say = words;
    q.options = shuffle(opts).map(function (o) { return { t: timeDigits(o.h, o.m), ok: o === correct }; });
  } else {
    q.html = '<div class="big">' + digits + '</div><div class="mute" style="margin-top:6px">Wybierz zapis słowny</div>'; q.after = words;
    q.options = shuffle(opts).map(function (o) { return { t: timeWords(c, o.h, o.m), ok: o === correct }; });
  }
  return q;
}
function dateQuestion(c) {
  var mo = 1 + rnd(12), d = 1 + rnd(28), words = dateWords(c, d, mo), digits = dateDigits(c, d, mo);
  var correct = { d: d, mo: mo }, set = {}, opts = [correct]; set[digits] = 1; var guard = 0;
  while (opts.length < 4 && guard++ < 60) { var v = rnd(2) ? { d: 1 + rnd(28), mo: mo } : { d: d, mo: 1 + rnd(12) }, k = dateDigits(c, v.d, v.mo); if (!set[k]) { set[k] = 1; opts.push(v); } }
  var q = { course: c, tag: 'num', kind: 'choice', show: digits + ' — ' + words };
  if (rnd(2)) {
    q.html = '<div class="mute">Posłuchaj i wybierz datę' + (c === 'en' ? ' (miesiąc/dzień)' : ' (dzień.miesiąc)') + '</div>'; q.say = words;
    q.options = shuffle(opts).map(function (o) { return { t: dateDigits(c, o.d, o.mo), ok: o === correct }; });
  } else {
    q.html = '<div class="big">' + digits + '</div><div class="mute" style="margin-top:6px">Wybierz zapis słowny</div>'; q.after = words;
    q.options = shuffle(opts).map(function (o) { return { t: dateWords(c, o.d, o.mo), ok: o === correct }; });
  }
  return q;
}
function priceQuestion(c) {
  var eur = 1 + rnd(c === 'en' ? 99 : 99), ct = pick([0, 0, 50, 20, 90, 99, 75, 25]), words = priceWords(c, eur, ct), digits = priceDigits(c, eur, ct);
  var correct = { e: eur, c: ct }, set = {}, opts = [correct]; set[digits] = 1; var guard = 0;
  while (opts.length < 4 && guard++ < 60) { var v = rnd(2) ? { e: Math.max(1, eur + pick([-10, -1, 1, 10])), c: ct } : { e: eur, c: pick([0, 50, 20, 90, 99, 75, 25]) }, k = priceDigits(c, v.e, v.c); if (!set[k]) { set[k] = 1; opts.push(v); } }
  var q = { course: c, tag: 'num', kind: 'choice', show: digits + ' — ' + words, html: '<div class="mute">Posłuchaj i wybierz cenę</div>', say: words };
  q.options = shuffle(opts).map(function (o) { return { t: priceDigits(c, o.e, o.c), ok: o === correct }; });
  return q;
}
function dmQuestion(c) {
  var isM = rnd(2), names = isM ? MONTHS[c] : WEEK[c], pl = isM ? MONTHS_PL : WEEK_PL, i = rnd(names.length);
  var idx = [i], guard = 0; while (idx.length < 4 && guard++ < 40) { var j = rnd(names.length); if (idx.indexOf(j) < 0) idx.push(j); }
  var q = { course: c, tag: 'num', kind: 'choice', show: names[i] + ' — ' + pl[i] };
  if (rnd(2)) {
    q.html = '<div class="mute">Posłuchaj i wybierz znaczenie</div>'; q.say = names[i];
    q.options = shuffle(idx).map(function (j) { return { t: pl[j], ok: j === i }; });
  } else {
    q.html = '<div class="big">' + esc(pl[i]) + '</div><div class="mute" style="margin-top:6px">Wybierz nazwę po: ' + cname(c) + '</div>'; q.after = names[i];
    q.options = shuffle(idx).map(function (j) { return { t: names[j], ok: j === i }; });
  }
  return q;
}
function numQuestions(c, lv, n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push(lv.id === 'time' ? timeQuestion(c) : lv.id === 'date' ? dateQuestion(c) : lv.id === 'price' ? priceQuestion(c) : lv.id === 'dm' ? dmQuestion(c) : numQuestion(c, lv));
  }
  return out;
}
function vNumbers() {
  var c = view().c;
  var h = '<button class="back" data-act="course" data-c="' + c + '">‹ ' + cname(c) + '</button><h1>Liczby, daty, godziny</h1><div class="card">';
  LEVELS.forEach(function (lv) {
    h += '<button class="lesson" data-act="xnumgo" data-c="' + c + '" data-lv="' + lv.id + '"><div class="grow"><b>' + lv.t + '</b></div></button>';
  });
  return h + '</div><p class="mute">Dźwięk pochodzi z głosu iPhone\'a, więc przy wyciszonym telefonie nie będzie go słychać.</p>';
}
function view() { return APP.view(); }

/* ================= uzupełnianie luk ================= */
var gapCache = {};
function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function baseOf(w) {
  return APP.norm(w.w.split('/')[0].replace(/\(.*?\)/g, '')).replace(/^(el|la|los|las|un|una|il|lo|i|gli|le|uno)\s+/, '').replace(/^(l'|un')/, '').replace(/^to\s+/, '').trim();
}
function findForm(w) {
  var base = baseOf(w); if (!base || base.indexOf(' ') >= 0 || !w.ex) return null;
  var re = /[\p{L}'’]+/gu, m, toks = [];
  while ((m = re.exec(w.ex))) toks.push({ t: m[0], i: m.index, n: APP.norm(m[0].replace(/’/g, "'")) });
  var found = toks.filter(function (x) { return x.n === base; })[0];
  if (!found) {
    var stem = base;
    if (/(ar|er|ir)$/.test(base) && base.length >= 6) stem = base.slice(0, -2);
    else if (/(are|ere|ire)$/.test(base) && base.length >= 7) stem = base.slice(0, -3);
    else if (/[aeiou]$/.test(base) && base.length >= 5) stem = base.slice(0, -1);
    if (stem.length >= 4) found = toks.filter(function (x) { return x.n.indexOf(stem) === 0 && x.n.length <= stem.length + 4; })[0];
  }
  return found || null;
}
function gapList(c) {
  if (!gapCache[c]) {
    gapCache[c] = [];
    APP.words(c).forEach(function (w) { var f = findForm(w); if (f) gapCache[c].push({ w: w, f: f }); });
  }
  return gapCache[c];
}
function gapQuestions(c, n) {
  var all = gapList(c), pr = db().p;
  var learned = shuffle(all.filter(function (x) { return pr[x.w.id]; })), rest = shuffle(all.filter(function (x) { return !pr[x.w.id]; }));
  var chosen = learned.concat(rest).slice(0, n), forms = all.map(function (x) { return x.f.t; });
  var type = db().s.gapType === 'type';
  return chosen.map(function (x) {
    var s = x.w.ex, f = x.f, blank = s.slice(0, f.i) + '＿＿＿＿' + s.slice(f.i + f.t.length);
    var q = { course: c, tag: 'gap', kind: type ? 'type' : 'choice', html: '<div class="big ph" style="font-size:24px">' + esc(blank) + '</div><div class="mute" style="margin-top:8px">Wstaw brakujące słowo</div><div class="mute" style="margin-top:4px">' + esc(x.w.p) + '</div>', answers: [f.t], show: f.t, expl: esc(s), tr: x.w.tr, after: s };
    if (!type) {
      var want = f.t.length, others = shuffle(forms.filter(function (t) { return APP.norm(t) !== APP.norm(f.t); })).sort(function (a, b) { return Math.abs(a.length - want) - Math.abs(b.length - want); });
      var seen = {}, opts = [];
      others.forEach(function (t) { var k = APP.norm(t); if (opts.length < 3 && !seen[k]) { seen[k] = 1; opts.push(t); } });
      var start = f.i === 0, cap = function (t) { return start ? t.charAt(0).toUpperCase() + t.slice(1) : t.charAt(0).toLowerCase() + t.slice(1); };
      q.options = shuffle(opts.concat([f.t])).map(function (t) { return { t: cap(t), ok: t === f.t }; });
    }
    return q;
  });
}

/* ================= dyktando ================= */
function dictQuestions(c, n) {
  var pr = db().p, list = APP.words(c).filter(function (w) { return w.ex && w.ex.split(/\s+/).length <= 9; });
  var learned = shuffle(list.filter(function (w) { return pr[w.id]; })), rest = shuffle(list.filter(function (w) { return !pr[w.id]; }));
  return learned.concat(rest).slice(0, n).map(function (w) {
    return { course: c, tag: 'dict', kind: 'type', say: w.ex, slow: true, long: true, html: '<div class="mute">Posłuchaj i wpisz zdanie</div>', answers: [w.ex], show: w.ex, tr: w.tr, expl: '<b>' + esc(w.w) + '</b> — ' + esc(w.p), dict: true };
  });
}

/* ================= runda na czas ================= */
function roundPool(c) {
  var pr = db().p, out = [];
  ['w', 'p', 'r'].forEach(function (k) { APP.items(c, k).forEach(function (w) { if (pr[w.id]) out.push(w); }); });
  return out;
}
function roundQuestion(c, pool) {
  var w = pick(pool), kk = w.k === 'p' ? 'p' : 'w', c1 = rnd(2) === 0;
  var all = (kk === 'p' ? APP.phrases(c) : APP.words(c)), key = c1 ? 'p' : 'w';
  var others = shuffle(all.filter(function (x) { return x.id !== w.id && x[key] !== w[key]; })), seen = {}, opts = [];
  others.forEach(function (x) { if (opts.length < 3 && !seen[x[key]]) { seen[x[key]] = 1; opts.push(x); } });
  var all4 = shuffle(opts.concat([w]));
  return { course: c, tag: 'round', kind: 'choice', fast: true,
    html: '<div class="' + (w.k === 'p' ? 'big ph' : 'big') + '">' + esc(c1 ? w.w : w.p) + '</div>', say: c1 ? w.w : null,
    options: all4.map(function (x) { return { t: x[key], ok: x.id === w.id }; }), show: w.w + ' — ' + w.p, auto: c1 };
}

/* ================= silnik ćwiczeń ================= */
function startDrill(spec) {
  D = spec; D.i = 0; D.ok = 0; D.bad = 0;
  if (D.timed) { D.end = Date.now() + 60000; D.timer = null; D.qs = [D.gen()]; }
  APP.go({ name: 'drill' });
  autoSpeak();
}
function curQ() { return D && D.qs[D.i]; }
function autoSpeak() { var q = curQ(); if (q && q.say && q.auto !== false) APP.speak(q.say, q.course); }
function normDict(s) { return APP.norm(s).replace(/['’]/g, '').replace(/\s+/g, ' ').trim(); }

function vDrill() {
  var q = curQ(); if (!D || !q) return '';
  var st = q.state, h = '<div class="top"><button class="back" data-act="dquit">✕ Zamknij</button>';
  if (D.timed) h += '<div class="sbar"><i id="tbar" style="width:100%;background:var(--orange)"></i></div><span class="mute" id="tleft">60</span></div><div class="mute" style="text-align:center;margin:-6px 0 8px">Wynik: <b>' + D.ok + '</b></div>';
  else h += '<div class="sbar"><i style="width:' + APP.pct(D.i, D.qs.length) + '%"></i></div><span class="mute">' + D.i + '/' + D.qs.length + '</span></div>';
  h += '<div class="card stage">' + (q.say ? '<button class="spk" data-act="dsay" aria-label="Odtwórz">🔊</button>' : '') + q.html + (q.say && !D.timed ? '<div style="margin-top:10px"><button class="icon" data-act="dslow">🐢 Wolniej</button></div>' : '') + '</div>';
  if (q.kind === 'choice') {
    h += '<div class="opts">';
    q.options.forEach(function (o, i) {
      var cls = ''; if (st) { if (o.ok) cls = ' ok'; else if (st.pick === i) cls = ' bad'; }
      h += '<button class="opt' + cls + '" data-act="dpick" data-i="' + i + '"' + (st ? ' disabled' : '') + '>' + esc(o.t) + '</button>';
    });
    h += '</div>';
  } else {
    h += '<input class="inp' + (st ? (st.ok ? ' ok' : ' bad') : '') + '" id="dans" type="text" ' + (q.numeric ? 'inputmode="numeric" ' : '') + 'autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" value="' + (st ? esc(st.text) : '') + '"' + (st ? ' readonly' : '') + ' placeholder="…">';
    if (!st) h += '<button class="btn" data-act="dcheck">Sprawdź</button><button class="btn sec" data-act="didk">Nie wiem</button>';
  }
  if (st && !q.fast) {
    h += '<div class="fb ' + (st.ok ? 'ok' : 'bad') + '">' + (st.ok ? '✓ Dobrze! ' : '✗ Poprawnie: ') + '<b>' + esc(q.show) + '</b>' + (q.expl ? '<div style="margin-top:6px">' + q.expl + '</div>' : '') +
      (q.tr ? (q.trOpen ? '<div class="trtext">🇵🇱 ' + esc(q.tr) + '</div>' : '<button class="trbtn" data-act="dtr">🇵🇱 Pokaż po polsku</button>') : '') + '</div>';
    h += '<button class="btn" data-act="dnext">Dalej</button>';
  }
  return h;
}
function finish(ok, text, pickIdx) {
  var q = curQ(); if (!q || q.state) return;
  q.state = { ok: ok, text: text || '', pick: pickIdx };
  if (ok) D.ok++; else D.bad++;
  recordDrill(ok, q.course, q.tag === 'num' ? 'num' : q.tag === 'gap' ? 'gap' : q.tag === 'dict' ? 'dict' : 'round');
  APP.render();
  if (q.after && !q.fast) APP.speak(q.after, q.course);
  else if (q.fast && q.say === null) APP.speak(q.show.split(' — ')[0], q.course);
  if (D.timed) setTimeout(function () { if (D && D.timed && curQ() === q) nextDrill(); }, 450);
}
function nextDrill() {
  if (!D) return;
  if (D.timed) {
    if (Date.now() >= D.end) return endDrill();
    D.qs.push(D.gen()); D.i++; APP.render(); autoSpeak(); return;
  }
  D.i++;
  if (D.i >= D.qs.length) return endDrill();
  APP.render(); autoSpeak();
}
function endDrill() {
  if (D.timer) { clearInterval(D.timer); D.timer = null; }
  if (D.timed) {
    var d = db(), prev = d.best[D.c] || 0;
    D.record = D.ok > prev; if (D.record) d.best[D.c] = D.ok;
    APP.save(); check();
  }
  APP.go({ name: 'dsum' });
}
function vDsum() {
  var tot = D.ok + D.bad, acc = APP.pct(D.ok, tot), icon = D.timed ? (D.record ? '🏆' : '⏱') : acc >= 80 ? '🎉' : acc >= 50 ? '👍' : '💪';
  var h = '<div class="card stage"><div class="sum">' + icon + '</div><h1>' + esc(D.title) + '</h1>';
  if (D.timed) h += '<div class="mute">' + (D.record ? 'Nowy rekord!' : 'Rekord: ' + (db().best[D.c] || 0)) + '</div><div class="statg"><div><b>' + D.ok + '</b>punktów</div><div><b>' + acc + '%</b>trafnych</div></div>';
  else h += '<div class="statg"><div><b>' + acc + '%</b>trafnych odpowiedzi</div><div><b>' + D.bad + '</b>pomyłek</div></div>';
  h += '</div><button class="btn" data-act="dagain">Jeszcze raz</button><button class="btn sec" data-act="dquit">Gotowe</button>';
  return h;
}
function tick() {
  if (!D || !D.timed || !D.timer) return;
  var left = Math.max(0, D.end - Date.now()), bar = document.getElementById('tbar'), t = document.getElementById('tleft');
  if (bar) bar.style.width = (left / 600) + '%';
  if (t) t.textContent = Math.ceil(left / 1000);
  if (left <= 0) { var q = curQ(); if (!q || !q.state) endDrill(); }
}

APP.after = function (v) {
  if (v.name === 'drill' && D) {
    if (D.timed && !D.timer) D.timer = setInterval(tick, 200);
    var inp = document.getElementById('dans'); if (inp && !curQ().state) { try { inp.focus(); } catch (e) {} }
  }
};
APP.leave = function (from, to) {
  if (from && (from.name === 'drill') && to.name !== 'drill' && D && D.timer) { clearInterval(D.timer); D.timer = null; }
};

function launch(kind, c, lv) {
  var title, spec;
  if (kind === 'round') {
    var pool = roundPool(c);
    if (pool.length < 5) { alert('Najpierw poznaj co najmniej 5 słówek lub zwrotów w tym języku.'); return; }
    spec = { kind: 'round', c: c, title: 'Runda na czas', timed: true, gen: function () { return roundQuestion(c, pool); } };
  } else if (kind === 'gap') {
    if (gapList(c).length < 8) { alert('Za mało zdań z lukami w tym języku.'); return; }
    spec = { kind: 'gap', c: c, title: 'Uzupełnianie luk', gen2: function () { return gapQuestions(c, 10); } };
  } else if (kind === 'dict') {
    spec = { kind: 'dict', c: c, title: 'Dyktando', gen2: function () { return dictQuestions(c, 8); } };
  } else {
    var level = LEVELS.filter(function (x) { return x.id === lv; })[0];
    spec = { kind: 'num', c: c, title: level.t, gen2: function () { return numQuestions(c, level, 10); } };
  }
  spec.restart = function () { launch(kind, c, lv); };
  if (spec.gen2) { spec.qs = spec.gen2(); }
  startDrill(spec);
}

APP.views = { xstats: vStats, xbadges: vBadges, xnumbers: vNumbers, drill: vDrill, dsum: vDsum };
APP.actions = {
  xstats: function () { APP.go({ name: 'xstats' }); },
  xbadges: function () { APP.go({ name: 'xbadges' }); },
  xnumbers: function (el) { APP.go({ name: 'xnumbers', c: el.getAttribute('data-c') }); },
  xnumgo: function (el) { launch('num', el.getAttribute('data-c'), el.getAttribute('data-lv')); },
  xround: function (el) { launch('round', el.getAttribute('data-c')); },
  xgap: function (el) { launch('gap', el.getAttribute('data-c')); },
  xdict: function (el) { launch('dict', el.getAttribute('data-c')); },
  dsay: function () { var q = curQ(); if (q) APP.speak(q.say, q.course); },
  dslow: function () { var q = curQ(); if (q) APP.speak(q.say, q.course, true); },
  dpick: function (el) { var q = curQ(); if (!q || q.state) return; var i = +el.getAttribute('data-i'); finish(q.options[i].ok, '', i); },
  dcheck: function () {
    var q = curQ(), inp = document.getElementById('dans'); if (!q || q.state || !inp || !inp.value.trim()) return;
    var v = inp.value, ok;
    if (q.numeric) ok = v.replace(/\D/g, '') === q.answers[0];
    else if (q.dict) ok = normDict(v) === normDict(q.answers[0]);
    else ok = q.answers.some(function (a) { return APP.norm(v) === APP.norm(a); });
    finish(ok, v);
  },
  didk: function () { var q = curQ(); if (q && !q.state) finish(false, ''); },
  dnext: function () { nextDrill(); },
  dtr: function () { var q = curQ(); if (q) { q.trOpen = true; APP.render(); } },
  dquit: function () { if (D && D.timer) { clearInterval(D.timer); D.timer = null; } var c = D && D.c; D = null; APP.go(c ? { name: 'course', c: c } : { name: 'home' }); },
  dagain: function () { if (D && D.restart) D.restart(); }
};
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' || view().name !== 'drill' || !D) return;
  var q = curQ(); if (!q) return;
  if (q.state) { if (!D.timed) nextDrill(); } else if (q.kind === 'type') APP.actions.dcheck();
});
})();
