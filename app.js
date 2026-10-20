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
  d.s = Object.assign({ rate: 0.9, auto: true, ves: '', ven: '', vit: '' }, d.s || {});
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
    }).slice(0, COURSES[c].max || 9999).map(function (r, i) { return { id: c + ':' + r[0], c: c, w: r[0], p: r[1], ex: r[2] || '', tr: r[3] || '', i: i }; });
  }
  return cache[c];
}
function isHard(r) { return r.l >= 2 && r.b <= 4; }
function stats(c) {
  var ws = words(c), now = Date.now(), s = { total: ws.length, learned: 0, due: 0, hard: 0, mastered: 0 };
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
function speak(text, c, slow) {
  if (!hasTTS) return;
  try {
    var u = new SpeechSynthesisUtterance(clean(text));
    u.lang = COURSES[c].lang;
    var v = voiceFor(c); if (v) u.voice = v;
    u.rate = slow ? 0.55 : db.s.rate;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) {}
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

function go(v) { view = v; render(); window.scrollTo(0, 0); }

function render() {
  var fn = { home: vHome, course: vCourse, lessons: vLessons, lesson: vLesson, intro: vIntro, quiz: vQuiz, summary: vSummary, settings: vSettings }[view.name] || vHome;
  $app.innerHTML = fn();
  if (view.name === 'quiz') afterQuiz();
}

function vHome() {
  var st = streak();
  var h = '<div class="top"><div class="grow"><h1>Słówka</h1><div class="mute">Wybierz kurs</div></div>' +
    (st ? '<span class="streak">🔥 ' + st + ' ' + plural(st, 'dzień', 'dni', 'dni') + '</span>' : '') +
    '<button class="icon" data-act="settings" aria-label="Ustawienia">⚙️</button></div>';
  Object.keys(COURSES).forEach(function (c) {
    var s = stats(c), co = COURSES[c];
    h += '<button class="card course" data-act="course" data-c="' + c + '"><div class="row"><div class="flag">' + co.flag + '</div>' +
      '<div><h2>' + co.name + '</h2><div class="mute">' + co.sub + '</div></div></div>' +
      '<div class="bar"><i style="width:' + pct(s.learned, s.total) + '%"></i></div><div class="chips">' +
      '<span class="chip">Poznane ' + s.learned + ' / ' + s.total + '</span>' +
      (s.due ? '<span class="chip hot">Do powtórki: ' + s.due + '</span>' : '') +
      (s.hard ? '<span class="chip hot">Trudne: ' + s.hard + '</span>' : '') + '</div></button>';
  });
  return h;
}

function vCourse() {
  var c = view.c, co = COURSES[c], s = stats(c), fresh = s.total - s.learned;
  var h = '<button class="back" data-act="home">‹ Kursy</button><div class="top"><div class="grow"><h1>' + co.flag + ' ' + co.name + '</h1><div class="mute">' + co.sub + '</div></div></div>';
  h += '<div class="card"><div class="bar"><i style="width:' + pct(s.learned, s.total) + '%"></i></div><div class="chips">' +
    '<span class="chip">Poznane ' + s.learned + ' / ' + s.total + '</span><span class="chip">Opanowane ' + s.mastered + '</span></div></div>';
  h += '<button class="btn" data-act="learn" data-c="' + c + '"' + (fresh ? '' : ' disabled') + '>Ucz się nowych słów<small>' + (fresh ? 'Kolejne 10 słówek' : 'Wszystko poznane!') + '</small></button>';
  h += '<button class="btn blue" data-act="review" data-c="' + c + '"' + (s.due ? '' : ' disabled') + '>Powtórka<small>' + (s.due ? s.due + ' ' + plural(s.due, 'słówko czeka', 'słówka czekają', 'słówek czeka') : 'Nic na dziś') + '</small></button>';
  h += '<button class="btn sec" data-act="hard" data-c="' + c + '"' + (s.hard ? '' : ' disabled') + '>Trudne słówka<small>' + (s.hard ? s.hard + ' do przećwiczenia' : 'Brak trudnych słówek') + '</small></button>';
  h += '<button class="btn sec" data-act="lessons" data-c="' + c + '">Lista słówek<small>Kliknij słowo, aby usłyszeć wymowę</small></button>';
  return h;
}

function vLessons() {
  var c = view.c, ws = words(c), h = '<button class="back" data-act="course" data-c="' + c + '">‹ ' + COURSES[c].name + '</button><h1>Lista słówek</h1><div class="card">';
  for (var g = 0; g * GROUP < ws.length; g++) {
    var part = ws.slice(g * GROUP, (g + 1) * GROUP), known = part.filter(function (w) { return db.p[w.id]; }).length;
    h += '<button class="lesson" data-act="lesson" data-c="' + c + '" data-g="' + g + '"><div class="grow"><b>Zestaw ' + (g + 1) + '</b> <span class="mute">· ' + (g * GROUP + 1) + '–' + (g * GROUP + part.length) + '</span>' +
      '<div class="mini"><i style="width:' + pct(known, part.length) + '%"></i></div></div><span class="mute">' + known + '/' + part.length + '</span></button>';
  }
  return h + '</div>';
}

function dotClass(r) { if (!r) return ''; if (isHard(r)) return 'hard'; return 'l' + Math.min(4, Math.max(1, Math.ceil(r.b * 4 / 6))); }

function vLesson() {
  var c = view.c, g = view.g, part = words(c).slice(g * GROUP, (g + 1) * GROUP);
  var h = '<button class="back" data-act="lessons" data-c="' + c + '">‹ Lista</button><h1>Zestaw ' + (g + 1) + '</h1><div class="card">';
  part.forEach(function (w) {
    h += '<div class="wrow" data-act="word" data-id="' + esc(w.id) + '"><button class="spk sm" aria-label="Odtwórz">🔊</button><div class="grow" style="flex:1"><div class="w">' + esc(w.w) + '</div><div class="t">' + esc(w.p) + '</div></div><span class="dot ' + dotClass(db.p[w.id]) + '"></span></div>';
    if (view.open === w.id && w.ex) h += '<div class="wex"><div data-act="say-ex" data-id="' + esc(w.id) + '">' + esc(w.ex) + ' 🔊</div>' + trBlock(w, view.trOpen === w.id, 'list') + '</div>';
  });
  return h + '</div>';
}

/* ---------- sesja ---------- */
function wordById(id) { var c = id.slice(0, 2); return words(c).filter(function (w) { return w.id === id; })[0]; }

function startSession(c, mode) {
  var ws = words(c), now = Date.now(), list = [];
  if (mode === 'learn') list = ws.filter(function (w) { return !db.p[w.id]; }).slice(0, 10);
  else if (mode === 'review') list = ws.filter(function (w) { var r = db.p[w.id]; return r && r.d <= now; }).sort(function (a, b) { return db.p[a.id].d - db.p[b.id].d; }).slice(0, 20);
  else list = shuffle(ws.filter(function (w) { var r = db.p[w.id]; return r && isHard(r); })).slice(0, 15);
  if (!list.length) return go({ name: 'course', c: c });
  S = { c: c, mode: mode, words: list, queue: [], done: 0, ok: 0, bad: 0, intro: mode === 'learn' ? list.slice() : [], ii: 0, q: null };
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
    '<div class="big">' + esc(w.w) + '</div><div class="trans">' + esc(w.p) + '</div>' +
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
  return opts[Math.floor(Math.random() * opts.length)];
}
function makeOptions(q) {
  var pool = words(S.c).filter(function (w) { return w.id !== q.w.id; });
  var others = shuffle(pool).slice(0, 3);
  var key = q.type === 'c1' ? 'p' : 'w';
  var arr = shuffle(others.concat([q.w])).map(function (w) { return { t: w[key], ok: w.id === q.w.id }; });
  return arr;
}
function nextQ() {
  if (!S.queue.length) return go({ name: 'summary' });
  var q = S.queue[0];
  q.type = pickType(q);
  q.state = null; q.trOpen = false;
  if (q.type === 'c1' || q.type === 'c2') q.options = makeOptions(q);
  S.q = q;
  go({ name: 'quiz' });
}
function head() {
  return '<div class="top"><button class="back" data-act="quit">✕ Zamknij</button><div class="sbar"><i style="width:' + pct(S.done, S.words.length) + '%"></i></div><span class="mute">' + S.done + '/' + S.words.length + '</span></div>';
}
function vQuiz() {
  var q = S.q, w = q.w, st = q.state, h = head();
  if (q.type === 'c1' || q.type === 'c2') {
    var prompt = q.type === 'c1'
      ? '<button class="spk" data-act="say" data-t="' + esc(w.w) + '">🔊</button><div class="big">' + esc(w.w) + '</div><div class="mute" style="margin-top:6px">Wybierz tłumaczenie</div>'
      : '<div class="big">' + esc(w.p) + '</div><div class="mute" style="margin-top:6px">Wybierz słowo w języku: ' + COURSES[S.c].name + '</div>';
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
    h += '<div class="fb ' + (st.ok ? 'ok' : 'bad') + '">' + (st.ok ? '✓ Dobrze! ' : '✗ Poprawnie: ') + '<b>' + esc(w.w) + '</b> — ' + esc(w.p) +
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
    if (q.type === 'listen') speak(q.w.w, S.c);
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
  var s = stats(S.c);
  return '<div class="card stage"><div class="sum">' + icon + '</div><h1>Sesja zakończona</h1><div class="mute">' + S.words.length + ' ' + plural(S.words.length, 'słówko', 'słówka', 'słówek') + '</div>' +
    '<div class="statg"><div><b>' + acc + '%</b>trafnych odpowiedzi</div><div><b>' + S.bad + '</b>pomyłek</div><div><b>' + s.learned + '</b>poznanych razem</div><div><b>' + s.due + '</b>do powtórki</div></div></div>' +
    '<button class="btn" data-act="course" data-c="' + S.c + '">Gotowe</button>';
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

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el) return;
  var a = el.getAttribute('data-act'), c = el.getAttribute('data-c');
  if (el.tagName === 'SELECT') return;
  switch (a) {
    case 'home': S = null; return go({ name: 'home' });
    case 'settings': return go({ name: 'settings' });
    case 'course': return go({ name: 'course', c: c });
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
function loadDbFix() { db.p = db.p || {}; db.days = db.days || {}; db.s = Object.assign({ rate: 0.9, auto: true, ves: '', ven: '', vit: '' }, db.s || {}); }

document.addEventListener('change', function (e) {
  var el = e.target; if (el.tagName !== 'SELECT') return;
  var a = el.getAttribute('data-act');
  if (a === 'voice') db.s['v' + el.getAttribute('data-c')] = el.value;
  else if (a === 'rate') db.s.rate = parseFloat(el.value);
  else if (a === 'auto') db.s.auto = el.value === '1';
  save();
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' || view.name !== 'quiz' || !S) return;
  if (e.target.tagName === 'TEXTAREA') return;
  if (S.q.state) advance(); else checkTyped();
});
// iOS: pierwsze dotknięcie odblokowuje syntezę mowy
document.addEventListener('touchstart', function unlock() {
  document.removeEventListener('touchstart', unlock);
  if (hasTTS) { try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
}, { passive: true });

render();
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
})();
