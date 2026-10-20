(function () {
'use strict';

var DAY = 86400000;
var INT = [0, 1, 3, 7, 14, 30, 60]; // dni do powtórki dla pudełka 0..6
var KEY = 'slowka_v1';
var GROUP = 20;

var COURSES = {
  es: { name: 'Español', flag: '🇪🇸', lang: 'es-ES', sub: '1000 najczęstszych słów · Hiszpania',
        raw: function () { return [].concat(join(window.WORDS_ES_1, window.TR_ES_1), join(window.WORDS_ES_2, window.TR_ES_2), join(window.WORDS_ES_3, window.TR_ES_3)); }, max: 1000 },
  it: { name: 'Italiano', flag: '🇮🇹', lang: 'it-IT', sub: '1000 najczęstszych słów · Włochy',
        raw: function () { return [].concat(join(window.WORDS_IT_1, window.TR_IT_1), join(window.WORDS_IT_2, window.TR_IT_2)); }, max: 1000 },
  en: { name: 'English', flag: '🇺🇸', lang: 'en-US', sub: 'Trudniejsze słownictwo B2 → C1 · USA',
        raw: function () { return join(window.WORDS_EN_1, window.TR_EN_1); } }
};
function join(rows, tr) {
  return (rows || []).map(function (r, i) { return [r[0], r[1], r[2], (tr && tr.length === rows.length && tr[i]) || '']; });
}

/* ---------- dane i zapis ---------- */
var db = loadDb();
function loadDb() {
  var d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!d || typeof d !== 'object') d = {};
  d.p = d.p || {};
  d.days = d.days || {};
  d.rw = d.rw || {};
  d.read = d.read || {};
  d.s = Object.assign({ rate: 0.9, vol: 1, loud: true, auto: true, ves: '', ven: '', vit: '' }, d.s || {});
  if (d.s.vEs && !d.s.ves) d.s.ves = d.s.vEs;
  if (d.s.vEn && !d.s.ven) d.s.ven = d.s.vEn;
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

var cache = {};
function words(c) {
  if (!cache[c]) {
    var seen = {};
    cache[c] = COURSES[c].raw().filter(function (r) {
      if (!r || !r[0] || seen[r[0]]) return false; seen[r[0]] = 1; return true;
    }).slice(0, COURSES[c].max || 9999).map(function (r, i) { return { id: c + ':' + r[0], c: c, w: r[0], p: r[1], ex: r[2] || '', tr: r[3] || '', k: 'w', i: i }; });
  }
  return cache[c];
}
var pcache = {};
function phrases(c) {
  if (!pcache[c]) {
    var seen = {};
    var up = c.toUpperCase();
    pcache[c] = [].concat(window['PH_' + up] || [], window['PH_' + up + '_2'] || [], window['PH_' + up + '_3'] || []).filter(function (r) {
      if (!r || !r[0] || seen[r[0]]) return false; seen[r[0]] = 1; return true;
    }).map(function (r, i) { return { id: 'p:' + c + ':' + r[0], c: c, k: 'p', w: r[0], p: r[1], theme: r[2] || '', note: r[3] || '', ex: r[4] || '', tr: r[5] || '', i: i }; });
  }
  return pcache[c];
}
function savedItems(c) {
  var m = db.rw[c] || {};
  return Object.keys(m).map(function (key, i) { var r = m[key]; return { id: 'r:' + c + ':' + key, c: c, k: 'r', w: key, p: r.p || '', ex: r.ex || '', tr: '', i: i }; });
}
function items(c, k) { return k === 'p' ? phrases(c) : k === 'r' ? savedItems(c) : words(c); }
function stories(c) { return window['RD_' + c.toUpperCase()] || []; }
function storyById(c, id) { return stories(c).filter(function (s) { return s.id === id; })[0]; }
var wmaps = {};
function wmap(c) {
  if (!wmaps[c]) {
    var m = {};
    words(c).forEach(function (w) { m[w.w.toLowerCase().replace(/\(.*?\)/g, '').replace(/^(el|la|los|las|un|una|il|lo|i|gli|le|uno)\s+/, '').replace(/^(l'|un')/, '').trim()] = w.p; });
    wmaps[c] = m;
  }
  return wmaps[c];
}
function groups(c, k) {
  var list = items(c, k), out = [];
  if (k === 'p') {
    var byLabel = {};
    list.forEach(function (w) {
      var label = w.theme || 'Zwroty', g = byLabel[label];
      if (!g) { g = byLabel[label] = { label: label, list: [] }; out.push(g); }
      g.list.push(w);
    });
  } else {
    for (var g = 0; g * GROUP < list.length; g++) {
      var part = list.slice(g * GROUP, (g + 1) * GROUP);
      out.push({ label: 'Zestaw ' + (g + 1), sub: (g * GROUP + 1) + '–' + (g * GROUP + part.length), list: part });
    }
  }
  return out;
}
var curK = 'w'; // aktywna zakładka: w = słówka, p = zwroty
var curTheme = null; // indeks kategorii zwrotów (null = nie wybrano)
function isHard(r) { return r.l >= 2 && r.b <= 4; }
function stats(c, k, list) {
  var ws = list || items(c, k || 'w'), now = Date.now(), s = { total: ws.length, learned: 0, due: 0, hard: 0, mastered: 0 };
  ws.forEach(function (w) {
    var r = db.p[w.id]; if (!r) return;
    s.learned++; if (r.d <= now) s.due++; if (r.b >= 5) s.mastered++; if (isHard(r)) s.hard++;
  });
  return s;
}
function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function streak() {
  var n = 0, d = new Date();
  function key(x) { return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); }
  if (!db.days[key(d)]) d.setDate(d.getDate() - 1);
  while (db.days[key(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- głos ---------- */
var voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
var hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
if (hasTTS) {
  loadVoices();
  try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { speechSynthesis.onvoiceschanged = loadVoices; }
}
function langVoices(c) {
  var pre = COURSES[c].lang.slice(0, 2);
  return voices.filter(function (v) { return v.lang.replace('_', '-').toLowerCase().indexOf(pre) === 0; });
}
function voiceFor(c) {
  var lang = COURSES[c].lang.toLowerCase();
  var list = langVoices(c);
  var saved = db.s['v' + c];
  if (saved) { for (var i = 0; i < list.length; i++) if (list[i].voiceURI === saved) return list[i]; }
  var exact = list.filter(function (v) { return v.lang.replace('_', '-').toLowerCase() === lang; });
  if (exact.length) list = exact;
  function score(v) { return /premium/i.test(v.name) ? 3 : /enhanced|improved|siri/i.test(v.name) ? 2 : v.localService ? 1 : 0; }
  list = list.slice().sort(function (a, b) { return score(b) - score(a); });
  return list[0] || null;
}
function clean(t) { return String(t).replace(/\(.*?\)/g, ' ').replace(/\//g, ' ').replace(/\s+/g, ' ').trim(); }
// iOS: cichy dźwięk w tle przełącza sesję audio na „odtwarzanie”, dzięki czemu mowa bywa słyszalna mimo trybu cichego
var silent = null;
function makeSilent() {
  var n = 8000, buf = new ArrayBuffer(44 + n), v = new DataView(buf), i;
  function s(o, t) { for (var j = 0; j < t.length; j++) v.setUint8(o + j, t.charCodeAt(j)); }
  s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  s(36, 'data'); v.setUint32(40, n, true);
  for (i = 0; i < n; i++) v.setUint8(44 + i, 128);
  var a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  a.loop = true; return a;
}
function ensurePlayback() {
  if (!db.s.loud) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  try {
    if (!silent) silent = makeSilent();
    if (silent.paused) { var p = silent.play(); if (p && p.catch) p.catch(function () {}); }
  } catch (e) {}
}
document.addEventListener('visibilitychange', function () { if (document.hidden && silent) { try { silent.pause(); } catch (e) {} } });

function speak(text, c, slow, onend) {
  if (!hasTTS) { if (onend) onend(); return; }
  ensurePlayback();
  try {
    var u = new SpeechSynthesisUtterance(clean(text));
    u.lang = COURSES[c].lang;
    var v = voiceFor(c); if (v) u.voice = v;
    u.rate = slow ? 0.55 : db.s.rate;
    u.volume = typeof db.s.vol === 'number' ? db.s.vol : 1;
    if (onend) {
      var done = false;
      u.onend = u.onerror = function () { if (!done) { done = true; onend(); } };
    } else speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { if (onend) onend(); }
}

/* ---------- pomocnicze ---------- */
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function norm(s) {
  s = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, ' ').replace(/[.,!?;:¿¡]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}
function core(s) {
  return norm(s).replace(/[’‘`]/g, "'").replace(/^(el|la|los|las|un|una|il|lo|i|gli|le|uno)(\/(el|la))?\s+/, '').replace(/^(l'|un')\s*/, '').replace(/^to\s+/, '');
}
function targets(w) { return w.split('/').length > 1 && !/^(el|la)\//.test(w) ? [w] : [w]; }
function matches(input, w) {
  var a = core(input); if (!a) return false;
  if (a === core(w)) return true;
  // warianty typu "el/la artista" lub "bonito/a"
  var v = norm(w).replace(/^(el|la)\/(el|la)\s+/, '');
  return a === core(v) || a === norm(v);
}
function trBlock(w, open, k) {
  if (!w.tr) return '';
  return open ? '<div class="trtext">🇵🇱 ' + esc(w.tr) + '</div>' : '<button class="trbtn" data-act="tr" data-k="' + k + '">🇵🇱 Pokaż po polsku</button>';
}
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function plural(n, one, few, many) { var m10 = n % 10, m100 = n % 100; if (n === 1) return one; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few; return many; }

/* ---------- widoki ---------- */
var $app = document.getElementById('app');
var view = { name: 'home' };
var S = null; // sesja nauki

function go(v) {
  if (view && view.name === 'story' && v.name !== 'story') stopRead();
  closeSheet();
  view = v; render(); window.scrollTo(0, 0);
}

function render() {
  var fn = { home: vHome, course: vCourse, cat: vCat, story: vStory, myw: vMyw, lessons: vLessons, lesson: vLesson, intro: vIntro, quiz: vQuiz, summary: vSummary, settings: vSettings }[view.name] || vHome;
  $app.innerHTML = fn();
  if (view.name === 'quiz') afterQuiz();
}

function vHome() {
  var st = streak();
  var h = '<div class="top"><div class="grow"><h1>Słówka</h1><div class="mute">Wybierz kurs</div></div>' +
    (st ? '<span class="streak">🔥 ' + st + ' ' + plural(st, 'dzień', 'dni', 'dni') + '</span>' : '') +
    '<button class="icon" data-act="settings" aria-label="Ustawienia">⚙️</button></div>';
  Object.keys(COURSES).forEach(function (c) {
    var s = stats(c, 'w'), ps = stats(c, 'p'), co = COURSES[c], due = s.due + ps.due, hard = s.hard + ps.hard;
    h += '<button class="card course" data-act="course" data-c="' + c + '"><div class="row"><div class="flag">' + co.flag + '</div>' +
      '<div><h2>' + co.name + '</h2><div class="mute">' + co.sub + '</div></div></div>' +
      '<div class="bar"><i style="width:' + pct(s.learned + ps.learned, s.total + ps.total) + '%"></i></div><div class="chips">' +
      '<span class="chip">Słówka ' + s.learned + ' / ' + s.total + '</span>' +
      (ps.total ? '<span class="chip">Zwroty ' + ps.learned + ' / ' + ps.total + '</span>' : '') +
      (stories(c).length ? '<span class="chip">Czytanki ' + stories(c).filter(function (x) { return db.read[x.id]; }).length + ' / ' + stories(c).length + '</span>' : '') +
      (due ? '<span class="chip hot">Do powtórki: ' + due + '</span>' : '') +
      (hard ? '<span class="chip hot">Trudne: ' + hard + '</span>' : '') + '</div></button>';
  });
  return h;
}

function vCourse() {
  var c = view.c, co = COURSES[c], k = curK, isP = k === 'p', s = stats(c, k === 'c' ? 'w' : k), fresh = s.total - s.learned;
  var h = '<button class="back" data-act="home">‹ Kursy</button><div class="top"><div class="grow"><h1>' + co.flag + ' ' + co.name + '</h1><div class="mute">' + co.sub + '</div></div></div>';
  h += '<div class="tabs">' + [['w', 'Słówka'], ['p', 'Zwroty'], ['c', 'Czytanki']].map(function (t) {
    return '<button class="tab' + (k === t[0] ? ' on' : '') + '" data-act="tab" data-k="' + t[0] + '" data-c="' + c + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if (k === 'c') return h + vReads(c);
  h += '<div class="card"><div class="bar"><i style="width:' + pct(s.learned, s.total) + '%"></i></div><div class="chips">' +
    '<span class="chip">Poznane ' + s.learned + ' / ' + s.total + '</span><span class="chip">Opanowane ' + s.mastered + '</span></div></div>';
  if (isP) {
    if (s.due) h += '<button class="btn blue" data-act="review" data-c="' + c + '">Powtórka ze wszystkich kategorii<small>' + s.due + ' ' + plural(s.due, 'zwrot czeka', 'zwroty czekają', 'zwrotów czeka') + '</small></button>';
    if (s.hard) h += '<button class="btn sec" data-act="hard" data-c="' + c + '">Trudne zwroty<small>' + s.hard + ' do przećwiczenia</small></button>';
    h += '<h2 style="margin:16px 0 8px">Wybierz kategorię</h2><div class="card">';
    groups(c, 'p').forEach(function (gr, g) {
      var gs = stats(c, 'p', gr.list);
      h += '<button class="lesson" data-act="cat" data-c="' + c + '" data-g="' + g + '"><div class="grow"><b>' + esc(gr.label) + '</b>' + (gs.due ? ' <span class="chip hot">do powtórki ' + gs.due + '</span>' : '') +
        '<div class="mini"><i style="width:' + pct(gs.learned, gs.total) + '%"></i></div></div><span class="mute">' + gs.learned + '/' + gs.total + '</span></button>';
    });
    return h + '</div>';
  }
  h += '<button class="btn" data-act="learn" data-c="' + c + '"' + (fresh ? '' : ' disabled') + '>' + (isP ? 'Ucz się nowych zwrotów' : 'Ucz się nowych słów') + '<small>' + (fresh ? 'Kolejne ' + (isP ? 8 : 10) + (isP ? ' zwrotów' : ' słówek') : (s.total ? 'Wszystko poznane!' : 'Brak treści')) + '</small></button>';
  h += '<button class="btn blue" data-act="review" data-c="' + c + '"' + (s.due ? '' : ' disabled') + '>Powtórka<small>' + (s.due ? s.due + ' ' + (isP ? plural(s.due, 'zwrot czeka', 'zwroty czekają', 'zwrotów czeka') : plural(s.due, 'słówko czeka', 'słówka czekają', 'słówek czeka')) : 'Nic na dziś') + '</small></button>';
  h += '<button class="btn sec" data-act="hard" data-c="' + c + '"' + (s.hard ? '' : ' disabled') + '>' + (isP ? 'Trudne zwroty' : 'Trudne słówka') + '<small>' + (s.hard ? s.hard + ' do przećwiczenia' : (isP ? 'Brak trudnych zwrotów' : 'Brak trudnych słówek')) + '</small></button>';
  h += '<button class="btn sec" data-act="lessons" data-c="' + c + '">' + (isP ? 'Zwroty według tematów' : 'Lista słówek') + '<small>Kliknij, aby usłyszeć wymowę</small></button>';
  return h;
}

/* ---------- czytanki ---------- */
function vReads(c) {
  var sts = stories(c), h = '<h2 style="margin:6px 0 8px">Historie</h2>';
  if (!sts.length) h += '<div class="card mute">Brak czytanek dla tego języka.</div>';
  sts.forEach(function (st) {
    var words = st.pages.reduce(function (n, pg) { return n + pg.reduce(function (m, p) { return m + p.t.split(/\s+/).length; }, 0); }, 0);
    h += '<button class="card course" data-act="story" data-c="' + c + '" data-id="' + esc(st.id) + '"><div class="row"><div class="grow" style="flex:1"><h2>' + esc(st.title) + '</h2><div class="mute">' + esc(st.titlePl || '') + '</div></div>' +
      (db.read[st.id] ? '<span class="chip" style="background:var(--ok-bg);color:#0d6e43">✓ przeczytane</span>' : '') + '</div>' +
      '<div class="mute" style="margin-top:8px">' + esc(st.blurb || '') + '</div><div class="chips" style="margin-top:10px"><span class="chip">' + esc(st.level) + '</span><span class="chip">' + esc(st.kind || '') + '</span><span class="chip">' + st.pages.length + ' ' + plural(st.pages.length, 'strona', 'strony', 'stron') + ' · ~' + words + ' słów</span></div></button>';
  });
  var sv = savedItems(c), ss = stats(c, 'r');
  h += '<h2 style="margin:18px 0 8px">Moje słówka z czytanek</h2><div class="card"><div class="chips"><span class="chip">Zapisane: ' + sv.length + '</span><span class="chip">Poznane ' + ss.learned + ' / ' + ss.total + '</span></div>' +
    '<p class="mute" style="margin:10px 0 0">Kliknij słowo w tekście i wybierz „Zapisz”, a pojawi się tutaj.</p></div>';
  h += '<button class="btn" data-act="rlearn" data-c="' + c + '"' + (ss.total - ss.learned ? '' : ' disabled') + '>Ucz się zapisanych słów<small>' + (ss.total - ss.learned ? 'Nowe słowa z czytanek' : 'Brak nowych') + '</small></button>';
  h += '<button class="btn blue" data-act="rreview" data-c="' + c + '"' + (ss.due ? '' : ' disabled') + '>Powtórka zapisanych<small>' + (ss.due ? ss.due + ' do powtórki' : 'Nic na dziś') + '</small></button>';
  h += '<button class="btn sec" data-act="myw" data-c="' + c + '"' + (sv.length ? '' : ' disabled') + '>Lista moich słówek</button>';
  return h;
}

function vMyw() {
  var c = view.c, sv = savedItems(c);
  var h = '<button class="back" data-act="course" data-c="' + c + '">‹ Czytanki</button><h1>Moje słówka</h1><div class="card">';
  if (!sv.length) h += '<div class="mute">Brak zapisanych słów.</div>';
  sv.forEach(function (w) {
    h += '<div class="wrow" data-act="say" data-t="' + esc(w.w) + '" data-c="' + c + '"><button class="spk sm" aria-label="Odtwórz">🔊</button><div class="grow" style="flex:1"><div class="w">' + esc(w.w) + '</div><div class="t">' + esc(w.p) + '</div></div>' +
      '<button class="icon" data-act="mywdel" data-key="' + esc(w.w) + '" data-c="' + c + '" aria-label="Usuń">✕</button></div>';
  });
  return h + '</div>';
}

var TOK = { es: /\p{L}+/gu, it: /\p{L}+['’]?/gu, en: /\p{L}+(?:['’]\p{L}+)*/gu };
function splitSentences(t) {
  var m = t.match(/[^.!?…]+(?:[.!?…]+["'»”’)\]]*|$)\s*/g);
  return (m && m.length ? m : [t]).filter(function (s) { return s.trim(); });
}
function sentenceHtml(c, s) {
  var re = new RegExp(TOK[c].source, 'gu'), out = '', last = 0, m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index));
    out += '<span class="wd" data-key="' + esc(m[0].toLowerCase().replace(/’/g, "'")) + '">' + esc(m[0]) + '</span>';
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}
var RD = { token: 0, playing: false, slow: false, sheet: null };
function vStory() {
  var c = view.c, st = storyById(c, view.id), pg = view.page || 0;
  if (!st) return '<button class="back" data-act="course" data-c="' + c + '">‹ Czytanki</button><p>Nie znaleziono historii.</p>';
  var last = pg === st.pages.length - 1;
  var h = '<div class="top"><button class="back" data-act="course" data-c="' + c + '">‹ Czytanki</button><span class="mute">Strona ' + (pg + 1) + ' / ' + st.pages.length + '</span></div><h1 style="font-size:22px">' + esc(st.title) + '</h1>';
  h += '<div class="rtool"><button class="btn" id="rplay" data-act="rplay" style="margin:0;flex:1">▶ Czytaj stronę</button><button class="icon' + (RD.slow ? ' on' : '') + '" data-act="rslow" id="rslow">🐢</button></div>';
  h += '<div class="card reader">';
  st.pages[pg].forEach(function (p, pi) {
    h += '<div class="para">' + splitSentences(p.t).map(function (s, si) { return '<span class="snt" data-i="' + pi + '-' + si + '">' + sentenceHtml(c, s) + '</span>'; }).join('') + '</div>';
    if (p.pl) h += '<button class="trbtn" data-act="ptr" data-p="' + pi + '">🇵🇱 Pokaż po polsku</button><div class="trtext" id="ptr-' + pi + '" hidden>' + esc(p.pl) + '</div>';
  });
  h += '</div><div class="row2" style="margin-top:6px">' + (pg ? '<button class="btn sec" data-act="rpage" data-d="-1" style="flex:1;margin:0">‹ Wstecz</button>' : '') +
    (last ? '<button class="btn" data-act="rdone" style="flex:1;margin:0">Zakończ ✓</button>' : '<button class="btn" data-act="rpage" data-d="1" style="flex:1;margin:0">Dalej ›</button>') + '</div>';
  return h;
}
function setPlayBtn() {
  var b = document.getElementById('rplay'); if (b) b.textContent = RD.playing ? '⏹ Stop' : '▶ Czytaj stronę';
}
function clearHL() { [].forEach.call(document.querySelectorAll('.snt.on'), function (e) { e.classList.remove('on'); }); }
function stopRead() {
  RD.token++; RD.playing = false;
  if (hasTTS) { try { speechSynthesis.cancel(); } catch (e) {} }
  clearHL(); setPlayBtn();
}
function startRead(from) {
  var els = [].slice.call(document.querySelectorAll('.snt'));
  if (!els.length) return;
  var tok = ++RD.token, c = view.c;
  RD.playing = true; setPlayBtn();
  if (hasTTS) { try { speechSynthesis.cancel(); } catch (e) {} }
  (function next(i) {
    if (tok !== RD.token) return;
    clearHL();
    if (i >= els.length) {
      RD.playing = false; setPlayBtn();
      var st = storyById(c, view.id);
      if (st && (view.page || 0) + 1 < st.pages.length) { view.page = (view.page || 0) + 1; render(); startRead(0); }
      return;
    }
    els[i].classList.add('on');
    try { els[i].scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    speak(els[i].textContent, c, RD.slow, function () { next(i + 1); });
  })(from || 0);
}
function closeSheet() { var s = document.getElementById('sheet'); if (s) s.remove(); RD.sheet = null; }
function openWord(el) {
  var c = view.c, st = storyById(c, view.id), key = el.getAttribute('data-key');
  var gl = (st && st.gloss && st.gloss[key]) || wmap(c)[key] || '';
  var snt = el.closest('.snt');
  RD.sheet = { key: key, gloss: gl, sentence: snt ? snt.textContent.trim() : '', idx: snt ? [].indexOf.call(document.querySelectorAll('.snt'), snt) : 0 };
  speak(el.textContent, c);
  drawSheet();
}
function drawSheet() {
  var d = RD.sheet, c = view.c, sv = !!(db.rw[c] && db.rw[c][d.key]);
  var s = document.getElementById('sheet');
  if (!s) { s = document.createElement('div'); s.id = 'sheet'; document.body.appendChild(s); }
  s.innerHTML = '<div class="sheet-in"><button class="icon sx" data-act="sclose" aria-label="Zamknij">✕</button><div class="sw">' + esc(d.key) + '</div><div class="sg">' + (d.gloss ? esc(d.gloss) : '<span class="mute">Brak tłumaczenia tego słowa</span>') + '</div>' +
    '<div class="sb"><button class="icon" data-act="sword">🔊 Słowo</button><button class="icon" data-act="ssent">🔊 Zdanie</button><button class="icon" data-act="sfrom">▶ Czytaj stąd</button><button class="icon' + (sv ? ' on' : '') + '" data-act="ssave">' + (sv ? '✓ Zapisano' : '＋ Zapisz') + '</button></div></div>';
}

function vCat() {
  var c = view.c, gr = groups(c, 'p')[view.g] || { label: '', list: [] }, s = stats(c, 'p', gr.list), fresh = s.total - s.learned;
  var h = '<button class="back" data-act="course" data-c="' + c + '">‹ Kategorie</button><div class="top"><div class="grow"><h1>' + esc(gr.label) + '</h1><div class="mute">' + COURSES[c].flag + ' ' + COURSES[c].name + '</div></div></div>';
  h += '<div class="card"><div class="bar"><i style="width:' + pct(s.learned, s.total) + '%"></i></div><div class="chips"><span class="chip">Poznane ' + s.learned + ' / ' + s.total + '</span><span class="chip">Opanowane ' + s.mastered + '</span></div></div>';
  h += '<button class="btn" data-act="learn" data-c="' + c + '"' + (fresh ? '' : ' disabled') + '>Ucz się nowych zwrotów<small>' + (fresh ? 'Kolejne ' + Math.min(8, fresh) + ' zwrotów z tej kategorii' : 'Wszystko poznane!') + '</small></button>';
  h += '<button class="btn blue" data-act="review" data-c="' + c + '"' + (s.due ? '' : ' disabled') + '>Powtórka<small>' + (s.due ? s.due + ' ' + plural(s.due, 'zwrot czeka', 'zwroty czekają', 'zwrotów czeka') : 'Nic na dziś') + '</small></button>';
  h += '<button class="btn sec" data-act="hard" data-c="' + c + '"' + (s.hard ? '' : ' disabled') + '>Trudne zwroty<small>' + (s.hard ? s.hard + ' do przećwiczenia' : 'Brak trudnych zwrotów') + '</small></button>';
  h += '<button class="btn sec" data-act="lesson" data-c="' + c + '" data-g="' + view.g + '">Lista zwrotów<small>Kliknij, aby usłyszeć wymowę</small></button>';
  return h;
}

function vLessons() {
  var c = view.c, gs = groups(c, curK), h = '<button class="back" data-act="course" data-c="' + c + '">‹ ' + COURSES[c].name + '</button><h1>' + (curK === 'p' ? 'Zwroty' : 'Lista słówek') + '</h1><div class="card">';
  gs.forEach(function (gr, g) {
    var part = gr.list, known = part.filter(function (w) { return db.p[w.id]; }).length;
    h += '<button class="lesson" data-act="lesson" data-c="' + c + '" data-g="' + g + '"><div class="grow"><b>' + esc(gr.label) + '</b>' + (gr.sub ? ' <span class="mute">· ' + gr.sub + '</span>' : '') +
      '<div class="mini"><i style="width:' + pct(known, part.length) + '%"></i></div></div><span class="mute">' + known + '/' + part.length + '</span></button>';
  });
  return h + '</div>';
}

function dotClass(r) { if (!r) return ''; if (isHard(r)) return 'hard'; return 'l' + Math.min(4, Math.max(1, Math.ceil(r.b * 4 / 6))); }

function vLesson() {
  var c = view.c, gr = groups(c, curK)[view.g] || { label: '', list: [] }, part = gr.list;
  var h = (curK === 'p' ? '<button class="back" data-act="cat" data-c="' + c + '" data-g="' + view.g + '">‹ Kategoria</button>' : '<button class="back" data-act="lessons" data-c="' + c + '">‹ Lista</button>') + '<h1>' + esc(gr.label) + '</h1><div class="card">';
  part.forEach(function (w) {
    h += '<div class="wrow" data-act="word" data-id="' + esc(w.id) + '"><button class="spk sm" aria-label="Odtwórz">🔊</button><div class="grow" style="flex:1"><div class="w">' + esc(w.w) + '</div><div class="t">' + esc(w.p) + '</div></div><span class="dot ' + dotClass(db.p[w.id]) + '"></span></div>';
    if (view.open === w.id) h += '<div class="wex">' + (w.note ? '<div>' + esc(w.note) + '</div>' : '') + (w.ex ? '<div data-act="say-ex" data-id="' + esc(w.id) + '">' + esc(w.ex) + ' 🔊</div>' + trBlock(w, view.trOpen === w.id, 'list') : '') + '</div>';
  });
  return h + '</div>';
}

/* ---------- sesja ---------- */
function wordById(id) {
  var p = id.indexOf('p:') === 0, c = p ? id.slice(2, 4) : id.slice(0, 2);
  return items(c, p ? 'p' : 'w').filter(function (w) { return w.id === id; })[0];
}
function meta(w) {
  if (w.k !== 'p') return '';
  var t = [w.theme, w.note].filter(Boolean).map(esc).join(' · ');
  return t ? '<div class="meta">' + t + '</div>' : '';
}

function startSession(c, mode, kk) {
  var k = kk || curK, ws = items(c, k), now = Date.now(), list = [], theme = null;
  if (k === 'p' && curTheme !== null) { var gr = groups(c, 'p')[curTheme]; if (gr) { ws = gr.list; theme = curTheme; } }
  if (mode === 'learn') list = ws.filter(function (w) { return !db.p[w.id]; }).slice(0, k === 'p' ? 8 : 10);
  else if (mode === 'review') list = ws.filter(function (w) { var r = db.p[w.id]; return r && r.d <= now; }).sort(function (a, b) { return db.p[a.id].d - db.p[b.id].d; }).slice(0, 20);
  else list = shuffle(ws.filter(function (w) { var r = db.p[w.id]; return r && isHard(r); })).slice(0, 15);
  if (!list.length) return go(theme !== null ? { name: 'cat', c: c, g: theme } : { name: 'course', c: c });
  S = { c: c, k: k, theme: theme, mode: mode, words: list, queue: [], done: 0, ok: 0, bad: 0, intro: mode === 'learn' ? list.slice() : [], ii: 0, q: null };
  if (S.intro.length) { go({ name: 'intro' }); speakIntro(); }
  else beginQuiz();
}
function beginQuiz() {
  S.queue = shuffle(S.words).map(function (w) { return { w: w, need: S.mode === 'learn' ? 2 : 1, failed: false, step: 0 }; });
  nextQ();
}
function speakIntro() { if (db.s.auto) speak(S.intro[S.ii].w, S.c); }

function vIntro() {
  var w = S.intro[S.ii];
  return '<div class="top"><button class="back" data-act="quit">✕ Zamknij</button><div class="sbar"><i style="width:' + pct(S.ii, S.intro.length) + '%"></i></div><span class="mute">' + (S.ii + 1) + '/' + S.intro.length + '</span></div>' +
    '<div class="card stage"><button class="spk" data-act="say" data-t="' + esc(w.w) + '" aria-label="Odtwórz">🔊</button>' +
    '<div class="big' + (w.k === 'p' ? ' ph' : '') + '">' + esc(w.w) + '</div><div class="trans">' + esc(w.p) + '</div>' + meta(w) +
    (w.ex ? '<div class="ex" data-act="say" data-t="' + esc(w.ex) + '">' + esc(w.ex) + ' 🔊</div>' + trBlock(w, S.trOpen, 'intro') : '') + '</div>' +
    '<button class="btn sec" data-act="slow" data-t="' + esc(w.w) + '">🐢 Wolniej</button>' +
    '<button class="btn" data-act="introNext">' + (S.ii + 1 < S.intro.length ? 'Dalej' : 'Zaczynamy ćwiczenia') + '</button>';
}

function pickType(q) {
  var r = db.p[q.w.id], b = r ? r.b : 0, opts;
  if (q.failed) opts = ['c1'];
  else if (S.mode === 'learn') opts = q.step === 0 ? ['c1'] : ['c2'];
  else if (b <= 1) opts = ['c1'];
  else if (b === 2) opts = ['c1', 'c2'];
  else if (b === 3) opts = ['c2', 'listen'];
  else opts = ['listen', 'type'];
  if (S.k === 'p') opts = opts.map(function (o) { return o === 'listen' ? 'lc' : o === 'type' ? 'order' : o; });
  return opts[Math.floor(Math.random() * opts.length)];
}
function makeOptions(q) {
  var key = (q.type === 'c1' || q.type === 'lc') ? 'p' : 'w';
  var pool = shuffle((S.k === 'r' ? words(S.c) : items(S.c, S.k)).filter(function (w) { return w.id !== q.w.id && w[key] !== q.w[key]; }));
  if (S.k === 'p') pool = pool.filter(function (w) { return w.theme === q.w.theme; }).concat(pool.filter(function (w) { return w.theme !== q.w.theme; }));
  var others = [], seen = {};
  pool.forEach(function (w) { if (others.length < 3 && !seen[w[key]]) { seen[w[key]] = 1; others.push(w); } });
  return shuffle(others.concat([q.w])).map(function (w) { return { t: w[key], ok: w.id === q.w.id }; });
}
function tokensOf(w) { return w.w.split(/\s+/).filter(Boolean); }
function nextQ() {
  if (!S.queue.length) return go({ name: 'summary' });
  var q = S.queue[0];
  q.type = pickType(q);
  if (q.type === 'order' && tokensOf(q.w).length < 3) q.type = 'c2';
  q.state = null; q.trOpen = false;
  if (q.type === 'order') {
    var n = tokensOf(q.w).length, idx = [], tries = 0;
    for (var t = 0; t < n; t++) idx.push(t);
    do { q.deck = shuffle(idx); tries++; } while (tries < 8 && q.deck.join() === idx.join());
    q.built = [];
  }
  if (q.type === 'c1' || q.type === 'c2' || q.type === 'lc') q.options = makeOptions(q);
  S.q = q;
  go({ name: 'quiz' });
}
function head() {
  return '<div class="top"><button class="back" data-act="quit">✕ Zamknij</button><div class="sbar"><i style="width:' + pct(S.done, S.words.length) + '%"></i></div><span class="mute">' + S.done + '/' + S.words.length + '</span></div>';
}
function vQuiz() {
  var q = S.q, w = q.w, st = q.state, h = head();
  var cls0 = w.k === 'p' ? 'big ph' : 'big';
  if (q.type === 'order') {
    var toks = tokensOf(w);
    h += '<div class="card stage"><div class="' + cls0 + '">' + esc(w.p) + '</div><div class="mute" style="margin-top:6px">Ułóż zwrot po: ' + COURSES[S.c].name + '</div></div><div class="built' + (st ? (st.ok ? ' ok' : ' bad') : '') + '">';
    q.built.forEach(function (ti, pos) { h += '<button class="tok on"' + (st ? ' disabled' : ' data-act="tdel" data-i="' + pos + '"') + '>' + esc(toks[ti]) + '</button>'; });
    h += '</div><div class="deck">';
    q.deck.forEach(function (ti) { if (q.built.indexOf(ti) < 0) h += '<button class="tok"' + (st ? ' disabled' : ' data-act="tadd" data-i="' + ti + '"') + '>' + esc(toks[ti]) + '</button>'; });
    h += '</div>';
    if (!st) h += '<button class="btn" data-act="ocheck"' + (q.built.length === toks.length ? '' : ' disabled') + '>Sprawdź</button><button class="btn sec" data-act="idk">Nie wiem</button>';
  } else if (q.type === 'c1' || q.type === 'c2' || q.type === 'lc') {
    var prompt = q.type === 'c1'
      ? '<button class="spk" data-act="say" data-t="' + esc(w.w) + '">🔊</button><div class="' + cls0 + '">' + esc(w.w) + '</div><div class="mute" style="margin-top:6px">Wybierz tłumaczenie</div>'
      : q.type === 'lc'
      ? '<button class="spk" data-act="say" data-t="' + esc(w.w) + '">🔊</button><div class="mute">Posłuchaj i wybierz tłumaczenie</div><button class="icon" style="margin-top:10px" data-act="slow" data-t="' + esc(w.w) + '">🐢 Wolniej</button>'
      : '<div class="' + cls0 + '">' + esc(w.p) + '</div><div class="mute" style="margin-top:6px">Wybierz ' + (w.k === 'p' ? 'zwrot' : 'słowo') + ' w języku: ' + COURSES[S.c].name + '</div>';
    h += '<div class="card stage">' + prompt + '</div><div class="opts">';
    q.options.forEach(function (o, i) {
      var cls = '';
      if (st) { if (o.ok) cls = ' ok'; else if (st.pick === i) cls = ' bad'; }
      h += '<button class="opt' + cls + '" data-act="pick" data-i="' + i + '"' + (st ? ' disabled' : '') + '>' + esc(o.t) + '</button>';
    });
    h += '</div>';
  } else {
    var listen = q.type === 'listen';
    h += '<div class="card stage">' + (listen
      ? '<button class="spk" data-act="say" data-t="' + esc(w.w) + '">🔊</button><div class="mute">Wpisz to, co słyszysz</div><button class="icon" style="margin-top:10px" data-act="slow" data-t="' + esc(w.w) + '">🐢 Wolniej</button>'
      : '<div class="big">' + esc(w.p) + '</div><div class="mute" style="margin-top:6px">Wpisz po: ' + COURSES[S.c].name + '</div>') + '</div>';
    h += '<input class="inp' + (st ? (st.ok ? ' ok' : ' bad') : '') + '" id="ans" type="text" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" value="' + (st ? esc(st.text) : '') + '"' + (st ? ' readonly' : '') + ' placeholder="…">';
    if (!st) h += '<button class="btn" data-act="check">Sprawdź</button><button class="btn sec" data-act="idk">Nie wiem</button>';
  }
  if (st) {
    h += '<div class="fb ' + (st.ok ? 'ok' : 'bad') + '">' + (st.ok ? '✓ Dobrze! ' : '✗ Poprawnie: ') + '<b>' + esc(w.w) + '</b> — ' + esc(w.p) + meta(w) +
      (st.note ? '<div style="margin-top:4px">' + esc(st.note) + '</div>' : '') +
      (w.ex ? '<div style="margin-top:8px;cursor:pointer" data-act="say" data-t="' + esc(w.ex) + '">' + esc(w.ex) + ' 🔊</div>' + trBlock(w, q.trOpen, 'quiz') : '') + '</div>';
    h += '<button class="btn" data-act="next">Dalej</button>';
  }
  return h;
}
function afterQuiz() {
  var q = S.q, inp = document.getElementById('ans');
  if (!q.state) {
    if (q.type === 'c1' && db.s.auto) speak(q.w.w, S.c);
    if (q.type === 'listen' || q.type === 'lc') speak(q.w.w, S.c);
    if (inp) { try { inp.focus(); } catch (e) {} }
  }
}

function touchDay() { var k = today(); db.days[k] = (db.days[k] || 0) + 1; }
function answer(ok, text, note) {
  var q = S.q, w = q.w, r = db.p[w.id] || (db.p[w.id] = { b: 0, d: 0, l: 0, n: 0 }), now = Date.now();
  q.state = { ok: ok, text: text || '', note: note || '', pick: q.state ? q.state.pick : -1 };
  r.n++;
  touchDay();
  if (ok) {
    S.ok++;
    q.need--;
    if (q.need <= 0) {
      if (q.failed) r.b = 1; else r.b = Math.min((r.b || 0) + 1, 6);
      r.d = now + INT[r.b] * DAY;
    } else { r.d = now; if (!r.b) r.b = 0; }
  } else {
    S.bad++;
    r.l++; r.b = 0; r.d = now;
    q.failed = true; q.need = 1;
  }
  save();
  speak(w.w, S.c);
}
function advance() {
  var q = S.queue.shift();
  if (q.state.ok && q.need <= 0) { S.done++; }
  else {
    q.step++;
    var pos = Math.min(q.state.ok ? 4 : 3, S.queue.length);
    S.queue.splice(pos, 0, q);
  }
  nextQ();
}

function vSummary() {
  var total = S.ok + S.bad, acc = pct(S.ok, total), icon = acc >= 80 ? '🎉' : acc >= 50 ? '👍' : '💪';
  var s = stats(S.c, S.k);
  return '<div class="card stage"><div class="sum">' + icon + '</div><h1>Sesja zakończona</h1><div class="mute">' + S.words.length + ' ' + (S.k === 'p' ? plural(S.words.length, 'zwrot', 'zwroty', 'zwrotów') : plural(S.words.length, 'słówko', 'słówka', 'słówek')) + '</div>' +
    '<div class="statg"><div><b>' + acc + '%</b>trafnych odpowiedzi</div><div><b>' + S.bad + '</b>pomyłek</div><div><b>' + s.learned + '</b>poznanych razem</div><div><b>' + s.due + '</b>do powtórki</div></div></div>' +
    (S.theme !== null && S.theme !== undefined ? '<button class="btn" data-act="cat" data-c="' + S.c + '" data-g="' + S.theme + '">Gotowe</button>' : '<button class="btn" data-act="course" data-c="' + S.c + '">Gotowe</button>');
}

/* ---------- ustawienia ---------- */
function voiceSelect(c, label) {
  var list = langVoices(c), cur = voiceFor(c), h = '<label>' + label + '</label><div class="row2"><select data-act="voice" data-c="' + c + '">';
  if (!list.length) h += '<option>Brak głosów na tym urządzeniu</option>';
  list.forEach(function (v) { h += '<option value="' + esc(v.voiceURI) + '"' + (cur && cur.voiceURI === v.voiceURI ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>'; });
  return h + '</select><button class="icon" data-act="say" data-t="' + ({ es: 'Hola, ¿cómo estás?', it: 'Ciao, come stai?', en: 'Hello, how are you?' }[c]) + '" data-c="' + c + '">🔊</button></div>';
}
function vSettings() {
  var h = '<button class="back" data-act="home">‹ Wróć</button><h1>Ustawienia</h1><div class="card"><h2>Głos</h2>';
  if (!hasTTS) h += '<p class="mute">Ta przeglądarka nie obsługuje syntezy mowy.</p>';
  h += voiceSelect('es', 'Hiszpański') + voiceSelect('it', 'Włoski') + voiceSelect('en', 'Angielski');
  h += '<label>Głośność wymowy: <span id="volv">' + Math.round(db.s.vol * 100) + '%</span></label><div class="row2"><input type="range" id="vol" min="0" max="100" step="5" value="' + Math.round(db.s.vol * 100) + '" style="flex:1"><button class="icon" data-act="say" data-t="Hola, hello, ciao" data-c="es">🔊</button></div>';
  h += '<label>Odtwarzaj mimo trybu cichego</label><select data-act="loud"><option value="1"' + (db.s.loud ? ' selected' : '') + '>Włączone</option><option value="0"' + (db.s.loud ? '' : ' selected') + '>Wyłączone</option></select>';
  h += '<p class="mute">Jeśli nadal nic nie słychać, sprawdź przełącznik dzwonka z boku iPhone\'a i głośność multimediów (przyciski głośności).</p>';
  h += '<label>Tempo wymowy</label><select data-act="rate">' + [[0.7, 'Wolno'], [0.9, 'Normalnie'], [1.05, 'Szybko']].map(function (o) { return '<option value="' + o[0] + '"' + (db.s.rate === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  h += '<label>Automatyczne odtwarzanie</label><select data-act="auto"><option value="1"' + (db.s.auto ? ' selected' : '') + '>Włączone</option><option value="0"' + (db.s.auto ? '' : ' selected') + '>Wyłączone</option></select>';
  h += '<p class="mute">Lepsze głosy pobierzesz na iPhonie w: Ustawienia → Dostępność → Treści czytane na głos → Głosy.</p></div>';
  h += '<div class="card"><h2>Kopia postępów</h2><p class="mute">Postępy są zapisane na tym urządzeniu. Aby przenieść je na inne urządzenie, skopiuj kod i wklej go tam.</p>' +
    '<button class="btn sec" data-act="export">Pokaż kod do skopiowania</button><textarea id="xfer" placeholder="Tutaj pojawi się kod lub wklej kod z innego urządzenia"></textarea><div style="height:10px"></div>' +
    '<button class="btn sec" data-act="copy">Kopiuj</button><button class="btn blue" data-act="import">Wczytaj postępy z kodu</button></div>';
  h += '<div class="card"><h2>Reset</h2><button class="btn sec" data-act="reset" style="color:var(--bad)">Usuń wszystkie postępy</button></div>';
  return h;
}

/* ---------- zdarzenia ---------- */
function checkTyped() {
  var inp = document.getElementById('ans'), q = S.q;
  if (!inp || q.state || !inp.value.trim()) return;
  var v = inp.value, ok = matches(v, q.w.w), note = '';
  function art(s) { return s.trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/^(el|la|los|las|un|una|il|lo|i|gli|le|uno)\s+/, '').replace(/^(l'|un')\s*/, ''); }
  if (ok && art(v) !== art(q.w.w) && v.trim().toLowerCase() !== q.w.w.toLowerCase()) note = 'Zwróć uwagę na akcenty / pisownię: ' + q.w.w;
  answer(ok, v, note); render();
}

function checkOrder() {
  var q = S.q;
  if (q.state) return;
  var toks = tokensOf(q.w);
  if (q.built.length !== toks.length) return;
  var got = q.built.map(function (i) { return toks[i]; }).join(' ');
  answer(norm(got) === norm(q.w.w), got, ''); render();
}

document.addEventListener('click', function (e) {
  var wd = e.target.closest('.wd'); if (wd && view.name === 'story') return openWord(wd);
  var el = e.target.closest('[data-act]'); if (!el) return;
  var a = el.getAttribute('data-act'), c = el.getAttribute('data-c');
  if (el.tagName === 'SELECT') return;
  switch (a) {
    case 'story': curK = 'c'; return go({ name: 'story', c: c, id: el.getAttribute('data-id'), page: 0 });
    case 'rplay': if (RD.playing) stopRead(); else startRead(0); return;
    case 'rslow': RD.slow = !RD.slow; el.classList.toggle('on', RD.slow); return;
    case 'ptr': {
      var pt = document.getElementById('ptr-' + el.getAttribute('data-p'));
      pt.hidden = !pt.hidden; el.textContent = pt.hidden ? '🇵🇱 Pokaż po polsku' : '🇵🇱 Ukryj tłumaczenie'; return;
    }
    case 'rpage': stopRead(); return go({ name: 'story', c: view.c, id: view.id, page: (view.page || 0) + (+el.getAttribute('data-d')) });
    case 'rdone': stopRead(); db.read[view.id] = true; save(); curK = 'c'; return go({ name: 'course', c: view.c });
    case 'sclose': return closeSheet();
    case 'sword': return speak(RD.sheet.key, view.c);
    case 'ssent': stopRead(); return speak(RD.sheet.sentence, view.c, RD.slow);
    case 'sfrom': { var from = RD.sheet.idx; closeSheet(); return startRead(from); }
    case 'ssave': {
      var sh = RD.sheet, rc = view.c; if (!sh.gloss) return;
      db.rw[rc] = db.rw[rc] || {};
      if (db.rw[rc][sh.key]) delete db.rw[rc][sh.key]; else db.rw[rc][sh.key] = { p: sh.gloss, ex: sh.sentence };
      save(); return drawSheet();
    }
    case 'rlearn': return startSession(c, 'learn', 'r');
    case 'rreview': return startSession(c, 'review', 'r');
    case 'myw': return go({ name: 'myw', c: c });
    case 'mywdel': e.stopPropagation(); if (db.rw[c]) delete db.rw[c][el.getAttribute('data-key')]; save(); return render();
    case 'home': S = null; return go({ name: 'home' });
    case 'settings': return go({ name: 'settings' });
    case 'course': curTheme = null; return go({ name: 'course', c: c });
    case 'tab': curK = el.getAttribute('data-k'); curTheme = null; return go({ name: 'course', c: c });
    case 'cat': curK = 'p'; curTheme = +el.getAttribute('data-g'); return go({ name: 'cat', c: c, g: curTheme });
    case 'tadd': { var qa = S.q; if (qa.state) return; qa.built.push(+el.getAttribute('data-i')); return render(); }
    case 'tdel': { var qd = S.q; if (qd.state) return; qd.built.splice(+el.getAttribute('data-i'), 1); return render(); }
    case 'ocheck': return checkOrder();
    case 'learn': return startSession(c, 'learn');
    case 'review': return startSession(c, 'review');
    case 'hard': return startSession(c, 'hard');
    case 'lessons': return go({ name: 'lessons', c: c });
    case 'lesson': return go({ name: 'lesson', c: c, g: +el.getAttribute('data-g') });
    case 'word': {
      var id = el.getAttribute('data-id'), w = wordById(id);
      view.open = view.open === id ? null : id;
      speak(w.w, w.c); return render();
    }
    case 'say-ex': { var w2 = wordById(el.getAttribute('data-id')); return speak(w2.ex, w2.c); }
    case 'say': return speak(el.getAttribute('data-t'), c || (S ? S.c : view.c));
    case 'slow': return speak(el.getAttribute('data-t'), S ? S.c : view.c, true);
    case 'quit': S = null; return go({ name: 'home' });
    case 'tr': {
      var k = el.getAttribute('data-k');
      if (k === 'intro') S.trOpen = true; else if (k === 'quiz') S.q.trOpen = true; else view.trOpen = view.open;
      return render();
    }
    case 'introNext':
      if (S.ii + 1 < S.intro.length) { S.ii++; S.trOpen = false; render(); speakIntro(); } else beginQuiz();
      return;
    case 'pick': {
      var q = S.q; if (q.state) return;
      var i = +el.getAttribute('data-i'); q.state = { pick: i };
      answer(q.options[i].ok, '', ''); q.state.pick = i; return render();
    }
    case 'check': return checkTyped();
    case 'idk': { if (!S.q.state) { answer(false, '', ''); render(); } return; }
    case 'next': return advance();
    case 'export': document.getElementById('xfer').value = btoa(unescape(encodeURIComponent(JSON.stringify(db)))); return;
    case 'copy': {
      var ta = document.getElementById('xfer');
      if (!ta.value) ta.value = btoa(unescape(encodeURIComponent(JSON.stringify(db))));
      ta.focus(); ta.select();
      try { navigator.clipboard.writeText(ta.value); } catch (er) { document.execCommand('copy'); }
      return alert('Skopiowano kod.');
    }
    case 'import': {
      var val = document.getElementById('xfer').value.trim(); if (!val) return alert('Najpierw wklej kod.');
      try {
        var d = JSON.parse(decodeURIComponent(escape(atob(val))));
        if (!d || !d.p) throw 0;
        if (!confirm('Zastąpić obecne postępy wczytanymi?')) return;
        db = d; loadDbFix(); save(); alert('Wczytano postępy.'); go({ name: 'home' });
      } catch (er) { alert('Nieprawidłowy kod.'); }
      return;
    }
    case 'reset':
      if (confirm('Na pewno usunąć wszystkie postępy? Tego nie da się cofnąć.')) { db.p = {}; db.days = {}; save(); go({ name: 'home' }); }
      return;
  }
});
function loadDbFix() { db.p = db.p || {}; db.days = db.days || {}; db.rw = db.rw || {}; db.read = db.read || {}; db.s = Object.assign({ rate: 0.9, vol: 1, loud: true, auto: true, ves: '', ven: '', vit: '' }, db.s || {}); }

document.addEventListener('change', function (e) {
  var el = e.target; if (el.tagName !== 'SELECT') return;
  var a = el.getAttribute('data-act');
  if (a === 'voice') db.s['v' + el.getAttribute('data-c')] = el.value;
  else if (a === 'rate') db.s.rate = parseFloat(el.value);
  else if (a === 'auto') db.s.auto = el.value === '1';
  else if (a === 'loud') db.s.loud = el.value === '1';
  save();
});
document.addEventListener('input', function (e) {
  if (e.target.id !== 'vol') return;
  db.s.vol = e.target.value / 100;
  var l = document.getElementById('volv'); if (l) l.textContent = e.target.value + '%';
  save();
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' || view.name !== 'quiz' || !S) return;
  if (e.target.tagName === 'TEXTAREA') return;
  if (S.q.state) advance(); else if (S.q.type === 'order') checkOrder(); else checkTyped();
});
// iOS: pierwsze dotknięcie odblokowuje syntezę mowy
document.addEventListener('touchstart', function unlock() {
  document.removeEventListener('touchstart', unlock);
  ensurePlayback();
  if (hasTTS) { try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
}, { passive: true });

render();
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
})();
