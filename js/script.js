(function () {
  "use strict";

  /* ---------- 基本の道具 ---------- */
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var ymd = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var todayStr = function () { return ymd(new Date()); };
  var monthOf = function (date) { return date.slice(0, 7); };
  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var yen = function (n) { return n.toLocaleString("ja-JP") + "円"; };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function schoolYearOfMonth(mk) {
    var p = mk.split("-").map(Number);
    return p[1] >= 4 ? p[0] : p[0] - 1;
  }
  function fmtDate(s) {
    var p = s.split("-").map(Number);
    return p[1] + "月" + p[2] + "日(" + WEEK[new Date(p[0], p[1] - 1, p[2]).getDay()] + ")";
  }
  function shortDate(s) {
    var p = s.split("-").map(Number);
    return p[2] + "日(" + WEEK[new Date(p[0], p[1] - 1, p[2]).getDay()] + ")";
  }
  function monthLabel(mk) { var p = mk.split("-").map(Number); return p[0] + "年" + p[1] + "月"; }
  function shiftMonth(mk, d) {
    var p = mk.split("-").map(Number);
    var dt = new Date(p[0], p[1] - 1 + d, 1);
    return dt.getFullYear() + "-" + pad(dt.getMonth() + 1);
  }
  function lastDay(mk) {
    var p = mk.split("-").map(Number);
    return mk + "-" + pad(new Date(p[0], p[1], 0).getDate());
  }
  function gradeLabel(g) {
    if (g <= 0) return "未就学";
    if (g <= 6) return "小" + g;
    if (g <= 9) return "中" + (g - 6);
    return g + "年";
  }

  var ICONS = {
    bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18v1.5A5.5 5.5 0 0 1 15.5 19h-7A5.5 5.5 0 0 1 3 13.5z"/><path d="M6 12V6.5a2.5 2.5 0 0 1 5 0"/><path d="M7 19l-1 2M17 19l1 2"/></svg>',
    laundry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4L3.5 7l2 4L8 10v10h8V10l2.5 1 2-4L16 4a4 4 0 0 1-8 0z"/></svg>',
    study: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.2-5L16 4.2l3.8 3.8L9 18.8z"/><path d="M13.5 6.7l3.8 3.8"/></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/></svg>',
    bottle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5z"/><path d="M8.5 12h7"/></svg>'
  };

  var SUBJECTS = ["国語", "算数", "理科", "社会"];
  var SEASONS = [
    { id: "summer", name: "夏", hint: "夏休みごろ" },
    { id: "winter", name: "冬", hint: "冬休みごろ" },
    { id: "spring", name: "春", hint: "春休みごろ" }
  ];

  /* ---------- 状態 ---------- */
  /* state：保存するデータ（設定と、月ごとの記録）
     months は { "2026-10": { entries: [...], paid: true, paidOn: "2026-10-31" } } の形 */
  var state = { settings: null, months: {}, loading: true };
  /* ui：画面の表示状態（保存しない） */
  var ui = { month: monthOf(todayStr()), selDate: todayStr(), payConfirm: false, year: null };

  function cfg() {
    var s = state.settings || {};
    var c = s.chores || {};
    return {
      childName: s.childName || "",
      baseGrade: typeof s.baseGrade === "number" ? s.baseGrade : 5,
      baseYear: typeof s.baseYear === "number" ? s.baseYear : schoolYearOfMonth(monthOf(todayStr())),
      fixedPerGrade: typeof s.fixedPerGrade === "number" ? s.fixedPerGrade : 100,
      chores: [
        { id: "bath", name: "お風呂掃除", yen: typeof c.bath === "number" ? c.bath : 30 },
        { id: "laundry", name: "洗濯物をたたむ", yen: typeof c.laundry === "number" ? c.laundry : 30 },
        { id: "study", name: "朝学習", yen: typeof c.study === "number" ? c.study : 10 }
      ],
      bottlePer: typeof s.bottlePer === "number" && s.bottlePer > 0 ? s.bottlePer : 10,
      bottleYen: typeof s.bottleYen === "number" ? s.bottleYen : 30,
      otherYen: typeof s.otherYen === "number" ? s.otherYen : 30,
      testYen: typeof s.testYen === "number" ? s.testYen : 100,
      test50Yen: typeof s.test50Yen === "number" ? s.test50Yen : 50,
      drillYen: typeof s.drillYen === "number" ? s.drillYen : 100
    };
  }
  function gradeFor(mk) { var c = cfg(); return c.baseGrade + (schoolYearOfMonth(mk) - c.baseYear); }
  function monthData(mk) { return state.months[mk] || { entries: [], paid: false }; }
  function entriesOf(mk) { return monthData(mk).entries || []; }

  function countBottles(mk) {
    return entriesOf(mk).filter(function (e) { return e.kind === "bottle"; })
      .reduce(function (a, e) { return a + (e.n || 0); }, 0);
  }
  /* ペットボトルは月をまたいで本数を持ち越す（9本で月が終わっても、翌月1本で30円） */
  function bottleInfo(mk) {
    var c = cfg();
    var before = Object.keys(state.months).filter(function (k) { return k < mk; })
      .reduce(function (a, k) { return a + countBottles(k); }, 0);
    var cnt = countBottles(mk);
    var sets = Math.floor((before + cnt) / c.bottlePer) - Math.floor(before / c.bottlePer);
    return { cnt: cnt, yen: sets * c.bottleYen, rem: (before + cnt) % c.bottlePer, carry: before % c.bottlePer };
  }
  function sumKind(mk, kind) {
    return entriesOf(mk).filter(function (e) { return e.kind === kind; })
      .reduce(function (a, e) { return a + (e.yen || 0); }, 0);
  }
  function summary(mk) {
    var g = gradeFor(mk);
    var fixed = Math.max(0, g) * cfg().fixedPerGrade;
    var b = bottleInfo(mk);
    /* 朝学習はお手伝いと分けて集計する */
    var studies = entriesOf(mk).filter(function (e) { return e.kind === "chore" && e.choreId === "study"; });
    var study = studies.reduce(function (a, e) { return a + (e.yen || 0); }, 0);
    var chore = sumKind(mk, "chore") - study + b.yen;
    var test = sumKind(mk, "test");
    var smile = sumKind(mk, "smile");
    var drill = sumKind(mk, "drill");
    var advance = sumKind(mk, "advance");
    var earned = fixed + chore + study + test + smile + drill;
    return {
      g: g, fixed: fixed, chore: chore, bottle: b, study: study, studyCount: studies.length,
      test: test, smile: smile, drill: drill, drillCount: entriesOf(mk).filter(function (e) { return e.kind === "drill"; }).length,
      advance: advance, earned: earned, total: earned - advance
    };
  }
  /* ペットボトルの30円は、10本目に届いた日についたことにする */
  function bottleYenByDate() {
    var c = cfg(), all = [];
    Object.keys(state.months).sort().forEach(function (k) {
      entriesOf(k).forEach(function (e, i) { if (e.kind === "bottle") all.push({ date: e.date, n: e.n || 0, i: i }); });
    });
    all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i; });
    var cum = 0, map = {};
    all.forEach(function (b) {
      var sets = Math.floor((cum + b.n) / c.bottlePer) - Math.floor(cum / c.bottlePer);
      cum += b.n;
      if (sets) map[b.date] = (map[b.date] || 0) + sets * c.bottleYen;
    });
    return map;
  }
  /* 1日ごとにかせいだ金額（固定給と前借りはふくまない） */
  function dayYenMap(mk) {
    var map = {}, bm = bottleYenByDate();
    entriesOf(mk).forEach(function (e) {
      if (e.kind === "chore" || e.kind === "test" || e.kind === "smile" || e.kind === "drill") map[e.date] = (map[e.date] || 0) + (e.yen || 0);
    });
    Object.keys(bm).forEach(function (d) { if (monthOf(d) === mk) map[d] = (map[d] || 0) + bm[d]; });
    return map;
  }
  /* 使い始めた月から今月までの全部の月（記録がない月も固定給はつく） */
  function activeMonths() {
    var cur = monthOf(todayStr());
    var keys = Object.keys(state.months).filter(function (k) { return k <= cur; }).sort();
    var out = [];
    for (var k = keys.length ? keys[0] : cur; k <= cur; k = shiftMonth(k, 1)) out.push(k);
    return out;
  }
  function findSmile(schoolYear, season) {
    var hit = null;
    Object.keys(state.months).forEach(function (mk) {
      entriesOf(mk).forEach(function (e) {
        if (e.kind === "smile" && e.schoolYear === schoolYear && e.season === season) hit = { mk: mk, e: e };
      });
    });
    return hit;
  }

  /* ---------- 保存（このブラウザの localStorage） ---------- */
  var LS_KEY = "otetsudai-board-v1";
  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { var d = JSON.parse(raw); state.settings = d.settings || null; state.months = d.months || {}; }
    } catch (e) { /* 読めない環境（プライベートモード等）でも画面は表示する */ }
  }
  var saveWarned = false;
  function saveLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ settings: state.settings, months: state.months }));
    } catch (e) {
      if (!saveWarned) { saveWarned = true; toast("このブラウザでは保存できません。プライベートモードを解除してください"); }
    }
  }
  /* 月の記録を書き換える共通の入口：コピーを編集 → state に戻す → 保存 → 再描画 */
  function mutateMonth(mk, fn) {
    var cur = clone(monthData(mk));
    if (!cur.entries) cur.entries = [];
    fn(cur);
    state.months[mk] = cur;
    saveLocal();
    render();
  }

  /* ---------- 記録の追加・取り消し ---------- */
  function addEntry(entry, msg) {
    entry.id = uid();
    var mk = monthOf(entry.date);
    mutateMonth(mk, function (m) { m.entries.push(entry); });
    toast(msg, function () { removeEntry(mk, entry.id, true); });
  }
  function removeEntry(mk, id, silent) {
    var removed = null;
    mutateMonth(mk, function (m) {
      m.entries = m.entries.filter(function (e) { if (e.id === id) { removed = e; return false; } return true; });
    });
    if (!silent && removed) {
      toast("「" + entryLabel(removed) + "」を消しました", function () {
        mutateMonth(mk, function (m) { m.entries.push(removed); });
      });
    }
  }
  function entryLabel(e) {
    if (e.kind === "chore") return e.label;
    if (e.kind === "bottle") return "ペットボトル " + e.n + "本";
    if (e.kind === "test") return e.subject + (e.max === 50 ? " 50点満点" : " 100点");
    if (e.kind === "smile") return "スマイルゼミ " + seasonName(e.season) + "のテスト " + e.score + "点";
    if (e.kind === "drill") return "ドリル制覇：" + e.label;
    if (e.kind === "advance") return "前借り：" + e.label;
    return "";
  }
  function seasonName(id) { var s = SEASONS.filter(function (x) { return x.id === id; })[0]; return s ? s.name : ""; }
  function markClass(e) {
    if (e.kind === "chore") return "mk--" + e.choreId;
    return "mk--" + e.kind;
  }

  /* ---------- 画面 ---------- */
  function heroHTML() {
    var mk = ui.month, s = summary(mk), c = cfg(), m = monthData(mk);
    var who = c.childName ? esc(c.childName) + "さんの " : "";
    var parts = [
      { k: "fixed", name: "固定給", v: s.fixed, note: gradeLabel(s.g) + " × " + yen(c.fixedPerGrade) },
      { k: "chore", name: "お手伝い", v: s.chore, note: "ボトル " + s.bottle.cnt + "本ふくむ" },
      { k: "study", name: "朝学習", v: s.study, note: s.studyCount + "回" },
      { k: "test", name: "テスト満点", v: s.test, note: "100点・50点満点" },
      { k: "smile", name: "スマイルゼミ", v: s.smile, note: "点数＝金額" },
      { k: "drill", name: "ドリル制覇", v: s.drill, note: s.drillCount + "冊" }
    ];
    var bar = s.earned > 0 ? parts.map(function (p) {
      return p.v > 0 ? '<span class="c-' + p.k + '" style="width:' + (p.v / s.earned * 100).toFixed(2) + '%"></span>' : "";
    }).join("") : "";
    parts.push({ k: "adv", name: "前借り", v: -s.advance, note: "先にもらった分" });
    var pay;
    if (m.paid) {
      pay = '<span class="chip">' + fmtDate(m.paidOn || todayStr()) + 'にもらいました</span>' +
        '<button class="btn--text btn" type="button" data-action="unpay" id="btn-unpay">取り消す</button>';
    } else if (ui.payConfirm) {
      pay = '<p class="pay__q">' + yen(s.total) + 'をわたしましたか？</p><div class="pay__row">' +
        '<button class="btn btn--main" type="button" data-action="pay-yes" id="btn-pay-yes">はい、わたした</button>' +
        '<button class="btn" type="button" data-action="pay-no" id="btn-pay-no">まだ</button></div>';
    } else {
      pay = '<span class="chip chip--wait">まだもらっていない</span>' +
        '<button class="btn btn--small" type="button" data-action="pay" id="btn-pay">おうちの人：わたした</button>';
    }
    var setup = state.settings ? "" :
      '<div class="setup"><p>はじめに、おうちの人が名前と学年を設定してください。学年は毎年4月に自動で上がります。</p>' +
      '<button class="btn btn--main" type="button" data-action="open-settings" id="btn-setup">設定をひらく</button></div>';
    return '<header class="top"><p class="brand">おてつだいボード</p>' +
      '<nav class="monthnav" aria-label="月をえらぶ">' +
      '<button class="iconbtn" type="button" data-action="prev" id="btn-prev" aria-label="前の月">‹</button>' +
      '<span class="monthnav__label">' + monthLabel(mk) + '</span>' +
      '<button class="iconbtn" type="button" data-action="next" id="btn-next" aria-label="次の月"' +
      (mk >= monthOf(todayStr()) ? " disabled" : "") + '>›</button></nav></header>' +
      '<section class="hero" aria-label="この月のおこづかい">' +
      '<div><p class="hero__label">' + who + parseInt(mk.slice(5), 10) + '月にもらえるおこづかい</p>' +
      '<p class="hero__total num">' + s.total.toLocaleString("ja-JP") + '<small>円</small></p>' +
      (s.advance ? '<p class="hero__sub num">かせいだ ' + yen(s.earned) + ' − 前借り ' + yen(s.advance) + '</p>' : "") + '</div>' +
      '<div class="pay">' + pay + '</div>' +
      '<div class="hero__bar" aria-hidden="true">' + bar + '</div>' +
      '<div class="legend">' + parts.map(function (p) {
        return '<div class="legend__item"><span class="legend__name"><span class="sw c-' + p.k + '"></span>' + p.name + '</span>' +
          '<span class="legend__yen num">' + yen(p.v) + '</span><span class="legend__note">' + p.note + '</span></div>';
      }).join("") + '</div>' + setup + '</section>';
  }

  function dayBarHTML() {
    var isToday = ui.selDate === todayStr();
    return '<div class="daybar"><span>記録する日</span><strong>' + fmtDate(ui.selDate) + '</strong>' +
      (isToday ? '<span class="hint">（きょう）カレンダーで日にちを変えられます</span>'
        : '<button class="btn btn--small" type="button" data-action="today" id="btn-today">きょうにもどす</button>') + '</div>';
  }

  function choresHTML() {
    var c = cfg(), sel = ui.selDate;
    var dayEntries = entriesOf(monthOf(sel)).filter(function (e) { return e.date === sel; });
    var btns = c.chores.map(function (ch) {
      var n = dayEntries.filter(function (e) { return e.kind === "chore" && e.choreId === ch.id; }).length;
      return '<button class="chore chore--' + ch.id + '" type="button" data-action="chore" data-id="' + ch.id + '" id="btn-chore-' + ch.id + '">' +
        '<span class="chore__icon">' + ICONS[ch.id] + '</span><span class="chore__name">' + esc(ch.name) + '</span>' +
        '<span class="chore__yen num">+' + yen(ch.yen) + '</span>' +
        '<span class="chore__count">' + (n ? "この日 " + n + "回 できた" : "この日はまだ") + '</span></button>';
    }).join("");
    var nOther = dayEntries.filter(function (e) { return e.kind === "chore" && e.choreId === "other"; }).length;
    var other = '<form class="other" data-form="other"><span class="chore__icon">' + ICONS.other + '</span>' +
      '<label class="field">その他のお手伝い' + (nOther ? '<span class="other__count">この日 ' + nOther + '回</span>' : "") +
      '<input id="other-label" data-keep type="text" maxlength="30" placeholder="内容（書かなくてもOK）"></label>' +
      '<button class="btn" type="submit" id="btn-other">+' + yen(c.otherYen) + '</button></form>';
    var b = summary(ui.month).bottle;
    var slots = "";
    for (var i = 0; i < c.bottlePer; i++) slots += '<span class="slot' + (i < b.rem ? " is-on" : "") + '"></span>';
    var slotsCols = Math.min(c.bottlePer, 10);
    return '<section class="card" aria-labelledby="h-chore"><div class="card__head"><h2 id="h-chore">お手伝い</h2>' +
      '<p class="card__sub">ボタンをおすと、記録する日に1回ぶん記録されます</p></div>' +
      '<div class="chores">' + btns + '</div>' + other +
      '<div class="bottle"><div class="bottle__head"><span class="bottle__title">' + ICONS.bottle + 'ペットボトルを洗って捨てる</span>' +
      '<span class="card__sub num">' + c.bottlePer + '本で' + yen(c.bottleYen) + '</span></div>' +
      '<div class="slots" style="grid-template-columns:repeat(' + slotsCols + ',minmax(0,1fr))" aria-label="' + b.rem + '本 / ' + c.bottlePer + '本">' + slots + '</div>' +
      '<div class="bottle__foot"><p class="bottle__msg">あと<b class="num">' + (c.bottlePer - b.rem) + '本</b>で +' + yen(c.bottleYen) +
      '<br><span class="card__sub">この月 ' + b.cnt + '本 → ' + yen(b.yen) + (b.carry ? '（前の月から' + b.carry + '本くりこし）' : "") + '</span></p>' +
      '<div class="bottle__btns"><button class="btn" type="button" data-action="bottle" data-n="1" id="btn-bottle-1">+1本</button>' +
      '<button class="btn" type="button" data-action="bottle" data-n="5" id="btn-bottle-5">+5本</button></div></div></div></section>';
  }

  function testsHTML() {
    var c = cfg(), es = entriesOf(ui.month);
    return '<section class="card" aria-labelledby="h-test"><div class="card__head"><h2 id="h-test">テスト満点ボーナス</h2>' +
      '<p class="card__sub">100点満点のテストで100点、50点満点のテストで50点をとったらおす</p></div><div class="tests">' +
      SUBJECTS.map(function (sub, i) {
        var t = es.filter(function (e) { return e.kind === "test" && e.subject === sub; });
        var n50 = t.filter(function (e) { return e.max === 50; }).length;
        return '<div class="test"><span class="test__subj">' + sub + '</span>' +
          '<button class="test__btn" type="button" data-action="test" data-subject="' + sub + '" data-max="100" id="btn-test-' + i + '-100">' +
          '100点<b class="num">+' + yen(c.testYen) + '</b></button>' +
          '<button class="test__btn test__btn--50" type="button" data-action="test" data-subject="' + sub + '" data-max="50" id="btn-test-' + i + '-50">' +
          '50点満点<b class="num">+' + yen(c.test50Yen) + '</b></button>' +
          '<span class="test__count num">この月 100点×' + (t.length - n50) + ' ／ 50点×' + n50 + '</span></div>';
      }).join("") + '</div></section>';
  }

  function smileHTML() {
    var sy = schoolYearOfMonth(ui.month);
    return '<section class="card" aria-labelledby="h-smile"><div class="card__head"><h2 id="h-smile">スマイルゼミ ボーナス</h2>' +
      '<p class="card__sub">' + sy + '年度 ・ 点数がそのまま金額（小数点以下は切り捨て）</p></div><div class="seasons">' +
      SEASONS.map(function (se) {
        var hit = findSmile(sy, se.id);
        if (hit) {
          return '<div class="season is-done"><div class="season__name"><b>' + se.name + '</b><span>' + fmtDate(hit.e.date) + '</span></div>' +
            '<div class="season__done"><span class="season__score num">' + hit.e.score + '点</span>' +
            '<div class="season__row"><span class="season__yen num">+' + yen(hit.e.yen) + '</span>' +
            '<button class="btn btn--text" type="button" data-action="del" data-mk="' + hit.mk + '" data-id="' + hit.e.id + '" id="btn-smile-del-' + se.id + '">消す</button></div></div></div>';
        }
        return '<div class="season"><div class="season__name"><b>' + se.name + '</b><span>' + se.hint + '</span></div>' +
          '<form data-form="smile" data-season="' + se.id + '"><label class="sr" for="smile-' + se.id + '" hidden>' + se.name + 'の点数</label>' +
          '<input id="smile-' + se.id + '" data-keep type="number" min="0" max="1000" step="0.1" inputmode="decimal" placeholder="点数" aria-label="' + se.name + 'のテストの点数">' +
          '<button class="btn" type="submit" id="btn-smile-' + se.id + '">登録</button></form></div>';
      }).join("") + '</div></section>';
  }

  function calendarHTML() {
    var mk = ui.month, p = mk.split("-").map(Number);
    var first = new Date(p[0], p[1] - 1, 1).getDay();
    var days = new Date(p[0], p[1], 0).getDate();
    var today = todayStr(), es = entriesOf(mk), dym = dayYenMap(mk);
    var cells = WEEK.map(function (w) { return '<span class="cal__wd">' + w + '</span>'; }).join("");
    for (var i = 0; i < first; i++) cells += "<span></span>";
    for (var d = 1; d <= days; d++) {
      var date = mk + "-" + pad(d);
      var de = es.filter(function (e) { return e.date === date; });
      var marks = de.slice(0, 7).map(function (e) { return '<span class="mk ' + markClass(e) + '"></span>'; }).join("");
      if (de.length > 7) marks += '<span class="mk-more">+' + (de.length - 7) + '</span>';
      var dy = dym[date] || 0;
      var cls = "day" + (date === today ? " is-today" : "") + (date === ui.selDate ? " is-sel" : "");
      cells += '<button class="' + cls + '" type="button" data-action="day" data-date="' + date + '" id="day-' + date + '"' +
        (date > today ? " disabled" : "") + ' aria-label="' + fmtDate(date) + ' ' + yen(dy) + ' 記録' + de.length + 'こ"' +
        (date === ui.selDate ? ' aria-pressed="true"' : "") + '><span class="day__n num">' + d + '</span>' +
        (dy ? '<span class="day__yen num">+' + dy.toLocaleString("ja-JP") + '</span>' : "") +
        '<span class="marks">' + marks + '</span></button>';
    }
    var monthEarn = Object.keys(dym).reduce(function (a, k) { return a + dym[k]; }, 0);
    var c = cfg();
    return '<section class="card" aria-labelledby="h-cal"><div class="card__head"><h2 id="h-cal">スタンプカレンダー</h2>' +
      '<p class="card__sub">日にちの下の数字は、その日にかせいだ金額</p></div><div class="cal">' + cells + '</div>' +
      '<p class="calsum">日ごとの合計 <b class="num">' + yen(monthEarn) + '</b><span>（固定給・前借りは入りません）</span></p>' +
      '<div class="callegend">' +
      c.chores.map(function (ch) { return '<span><i class="mk mk--' + ch.id + '"></i>' + esc(ch.name) + '</span>'; }).join("") +
      '<span><i class="mk mk--other"></i>その他</span><span><i class="mk mk--bottle"></i>ペットボトル</span><span><i class="mk mk--test"></i>テスト</span><span><i class="mk mk--smile"></i>スマイルゼミ</span><span><i class="mk mk--drill"></i>ドリル</span>' +
      '<span><i class="mk mk--advance"></i>前借り</span></div></section>';
  }

  function logHTML() {
    var mk = ui.month, s = summary(mk);
    var es = entriesOf(mk).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var rows = es.map(function (e) {
      var amount = e.kind === "bottle" ? '<span class="card__sub">+' + e.n + '本</span>'
        : e.kind === "advance" ? "−" + yen(e.yen || 0) : "+" + yen(e.yen || 0);
      return '<li><span class="log__date num">' + shortDate(e.date) + '</span><i class="mk ' + markClass(e) + '"></i>' +
        '<span class="log__label">' + esc(entryLabel(e)) + '</span><span class="log__yen num">' + amount + '</span>' +
        '<button class="log__del" type="button" data-action="del" data-mk="' + mk + '" data-id="' + e.id + '" id="del-' + e.id + '" aria-label="' + esc(entryLabel(e)) + 'を消す">×</button></li>';
    }).join("");
    if (s.bottle.yen) {
      rows += '<li class="is-fixed"><span class="log__date">この月</span><i class="mk mk--bottle"></i><span class="log__label">ペットボトル ' +
        s.bottle.cnt + '本ぶん</span><span class="log__yen num">+' + yen(s.bottle.yen) + '</span><span></span></li>';
    }
    rows += '<li class="is-fixed"><span class="log__date">毎月</span><i class="sw c-fixed"></i><span class="log__label">固定給（' +
      gradeLabel(s.g) + '）</span><span class="log__yen num">+' + yen(s.fixed) + '</span><span></span></li>';
    return '<section class="card" aria-labelledby="h-log"><div class="card__head"><h2 id="h-log">この月の記録</h2>' +
      '<p class="card__sub">まちがえたら × で消せます</p></div>' +
      (es.length ? "" : '<p class="empty">まだ記録がありません。お手伝いをしたらボタンをおそう！</p>') +
      '<ul class="log">' + rows + '</ul></section>';
  }

  /* ドリル制覇：ドリル名を書いて記録。1冊ごとにボーナス */
  function drillHTML() {
    var c = cfg();
    var done = entriesOf(ui.month).filter(function (e) { return e.kind === "drill"; });
    return '<section class="card" aria-labelledby="h-drill"><div class="card__head"><h2 id="h-drill">ドリル全ページ制覇ボーナス</h2>' +
      '<p class="card__sub">1冊ぜんぶ終わったら +' + yen(c.drillYen) + '</p></div>' +
      '<form class="adv" data-form="drill">' +
      '<label class="field">ドリル名<input id="drill-label" data-keep type="text" maxlength="30" placeholder="例：計算ドリル5年"></label>' +
      '<button class="btn btn--main" type="submit" id="btn-drill">制覇した！ +' + yen(c.drillYen) + '</button></form>' +
      (done.length
        ? '<ul class="drills">' + done.map(function (e) {
            return '<li><i class="mk mk--drill"></i><span class="drills__name">' + esc(e.label) + '</span>' +
              '<span class="card__sub num">' + shortDate(e.date) + '</span></li>';
          }).join("") + '</ul>'
        : '<p class="card__sub">この月に制覇したドリルはまだありません</p>') + '</section>';
  }

  function advanceHTML() {
    var s = summary(ui.month);
    return '<section class="card" aria-labelledby="h-adv"><div class="card__head"><h2 id="h-adv">前借り</h2>' +
      '<p class="card__sub">先にもらった分は、この月のおこづかいから引かれます</p></div>' +
      '<form class="adv" data-form="advance">' +
      '<label class="field">内容<input id="adv-label" data-keep type="text" maxlength="30" placeholder="例：ほしい本を買う"></label>' +
      '<label class="field">金額<span class="inline"><input id="adv-yen" data-keep type="number" min="1" step="1" inputmode="numeric" placeholder="0"> 円</span></label>' +
      '<button class="btn btn--main" type="submit" id="btn-adv">記入する</button></form>' +
      '<p class="card__sub">' + fmtDate(ui.selDate) + 'の記録になります' +
      (s.advance ? ' ・ この月の前借り 合計 <b class="num">' + yen(s.advance) + '</b>' : "") + '</p></section>';
  }

  function yearHTML() {
    var cur = monthOf(todayStr()), curSY = schoolYearOfMonth(cur);
    var sy = ui.year !== null ? ui.year : schoolYearOfMonth(ui.month);
    var start = activeMonths()[0];
    var rows = [];
    for (var i = 0; i < 12; i++) {
      var k = shiftMonth(sy + "-04", i), on = k >= start && k <= cur;
      rows.push({ k: k, on: on, s: on ? summary(k) : null, paid: on && !!monthData(k).paid });
    }
    var t = { got: 0, notyet: 0, earned: 0, adv: 0, fixed: 0, chore: 0, study: 0, test: 0, smile: 0, drill: 0 };
    rows.forEach(function (r) {
      if (!r.on) return;
      if (r.paid) t.got += r.s.total; else t.notyet += r.s.total;
      t.earned += r.s.earned; t.adv += r.s.advance;
      t.fixed += r.s.fixed; t.chore += r.s.chore; t.study += r.s.study;
      t.test += r.s.test; t.smile += r.s.smile; t.drill += r.s.drill;
    });
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.on ? r.s.total : 0; })));
    var tile = function (cls, k, v) {
      return '<div class="ytile' + cls + '"><span class="ytile__k">' + k + '</span><span class="ytile__v num">' + yen(v) + '</span></div>';
    };
    return '<section class="card" aria-labelledby="h-year"><div class="card__head"><h2 id="h-year">' + sy + '年度のまとめ</h2>' +
      '<div class="monthnav"><button class="iconbtn" type="button" data-action="year-prev" id="btn-year-prev" aria-label="前の年度">‹</button>' +
      '<span class="card__sub">' + sy + '年4月〜' + (sy + 1) + '年3月</span>' +
      '<button class="iconbtn" type="button" data-action="year-next" id="btn-year-next" aria-label="次の年度"' + (sy >= curSY ? " disabled" : "") + '>›</button></div></div>' +
      '<div class="yearsum">' + tile(" ytile--main", "1年でもらった", t.got) + tile("", "まだもらっていない", t.notyet) +
      tile("", "1年でかせいだ", t.earned) + tile("", "前借りの合計", t.adv) + '</div>' +
      '<p class="ybreak"><span>固定給 <b class="num">' + yen(t.fixed) + '</b></span><span>お手伝い <b class="num">' + yen(t.chore) + '</b></span>' +
      '<span>朝学習 <b class="num">' + yen(t.study) + '</b></span>' +
      '<span>テスト満点 <b class="num">' + yen(t.test) + '</b></span><span>スマイルゼミ <b class="num">' + yen(t.smile) + '</b></span>' +
      '<span>ドリル制覇 <b class="num">' + yen(t.drill) + '</b></span></p>' +
      '<div class="yrows">' + rows.map(function (r) {
        var m = parseInt(r.k.slice(5), 10) + "月";
        if (!r.on) return '<div class="yrow is-off"><span>' + m + '</span><span class="ytrack"></span><span class="yrow__yen">—</span><span class="ystat"></span></div>';
        var w = Math.max(0, r.s.total) / max * 100;
        return '<button class="yrow' + (r.paid ? " is-paid" : "") + '" type="button" data-action="goto" data-mk="' + r.k + '" id="year-' + r.k + '">' +
          '<span>' + m + '</span><span class="ytrack"><span style="width:' + w.toFixed(2) + '%"></span></span>' +
          '<span class="yrow__yen num">' + yen(r.s.total) + '</span><span class="ystat">' + (r.paid ? "もらった" : "まだ") + '</span></button>';
      }).join("") + '</div>' +
      '<div class="callegend"><span><i class="sw c-test"></i>もらった月</span><span><i class="sw c-study"></i>まだの月</span><span>月をおすと、その月を見られます</span></div></section>';
  }

  function historyHTML() {
    var keys = activeMonths().slice().reverse();
    return '<section class="card" aria-labelledby="h-hist"><div class="card__head"><h2 id="h-hist">月ごとのおこづかい</h2>' +
      '<p class="card__sub">おすとその月を見られます</p></div><div class="history">' +
      keys.map(function (k) {
        var s = summary(k), m = monthData(k);
        return '<button class="hmonth' + (k === ui.month ? " is-view" : "") + '" type="button" data-action="goto" data-mk="' + k + '" id="hist-' + k + '">' +
          '<span class="hmonth__m">' + monthLabel(k) + '</span><span class="hmonth__yen num">' + yen(s.total) + '</span>' +
          '<span class="hmonth__st">' + (m.paid ? "もらった" : "まだ") + '</span></button>';
      }).join("") + '</div></section>';
  }

  function render() {
    var app = document.getElementById("app");
    if (state.loading) { app.innerHTML = '<p class="loading">よみこみ中…</p>'; return; }
    var kept = {};
    app.querySelectorAll("[data-keep]").forEach(function (i) { kept[i.id] = i.value; });
    var focusId = app.contains(document.activeElement) ? document.activeElement.id : null;
    app.innerHTML = '<div class="wrap">' + heroHTML() + dayBarHTML() +
      '<div class="main"><div class="col">' + choresHTML() + testsHTML() + smileHTML() + drillHTML() + advanceHTML() + '</div>' +
      '<div class="col">' + calendarHTML() + logHTML() + '</div></div>' + yearHTML() + historyHTML() + '</div>';
    Object.keys(kept).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = kept[id]; });
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); }
    fillSettings(false);
  }

  /* ---------- 設定フォーム ---------- */
  var gradeSel = document.getElementById("set-grade");
  for (var g = 1; g <= 9; g++) {
    var o = document.createElement("option"); o.value = g; o.textContent = gradeLabel(g) + "（" + g + "年生）";
    gradeSel.appendChild(o);
  }
  var settingsForm = document.getElementById("settings-form");
  function fillSettings(force) {
    if (!force && settingsForm.contains(document.activeElement)) return;
    var c = cfg();
    document.getElementById("set-name").value = c.childName;
    gradeSel.value = String(Math.min(9, Math.max(1, gradeFor(monthOf(todayStr())))));
    document.getElementById("set-fixed").value = c.fixedPerGrade;
    c.chores.forEach(function (ch) { document.getElementById("set-chore-" + ch.id).value = ch.yen; });
    document.getElementById("set-bottle-per").value = c.bottlePer;
    document.getElementById("set-bottle-yen").value = c.bottleYen;
    document.getElementById("set-test").value = c.testYen;
    document.getElementById("set-test50").value = c.test50Yen;
    document.getElementById("set-drill").value = c.drillYen;
    document.getElementById("set-other").value = c.otherYen;
  }
  function numVal(id, fallback) {
    var v = parseFloat(document.getElementById(id).value);
    return isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  }
  settingsForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var c = cfg();
    state.settings = {
      childName: document.getElementById("set-name").value.trim(),
      baseGrade: parseInt(gradeSel.value, 10),
      baseYear: schoolYearOfMonth(monthOf(todayStr())),
      fixedPerGrade: numVal("set-fixed", c.fixedPerGrade),
      chores: {
        bath: numVal("set-chore-bath", c.chores[0].yen),
        laundry: numVal("set-chore-laundry", c.chores[1].yen),
        study: numVal("set-chore-study", c.chores[2].yen)
      },
      bottlePer: Math.max(1, numVal("set-bottle-per", c.bottlePer)),
      bottleYen: numVal("set-bottle-yen", c.bottleYen),
      otherYen: numVal("set-other", c.otherYen),
      testYen: numVal("set-test", c.testYen),
      test50Yen: numVal("set-test50", c.test50Yen),
      drillYen: numVal("set-drill", c.drillYen)
    };
    saveLocal();
    document.activeElement && document.activeElement.blur();
    render();
    fillSettings(true);
    toast("設定を保存しました");
  });
  document.getElementById("settings").addEventListener("toggle", function () { fillSettings(true); });

  /* ---------- バックアップ（JSONファイルで保存・読み込み） ---------- */
  document.getElementById("backup-save").addEventListener("click", function () {
    var data = { app: "otetsudai-board", version: 1, exportedAt: new Date().toISOString(), settings: state.settings, months: state.months };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "otetsudai-backup-" + todayStr() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("バックアップを保存しました");
  });
  var backupFile = document.getElementById("backup-file");
  document.getElementById("backup-load").addEventListener("click", function () { backupFile.click(); });
  backupFile.addEventListener("change", function () {
    var file = backupFile.files[0];
    backupFile.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var d;
      try { d = JSON.parse(reader.result); } catch (e) { d = null; }
      if (!d || d.app !== "otetsudai-board" || typeof d.months !== "object") {
        toast("おてつだいボードのバックアップファイルではないようです");
        return;
      }
      if (!window.confirm("今の記録をバックアップの内容に置きかえます。よろしいですか？")) return;
      state.settings = d.settings || null;
      state.months = d.months || {};
      saveLocal();
      render();
      fillSettings(true);
      toast("バックアップから戻しました");
    };
    reader.readAsText(file);
  });

  /* ---------- 操作 ---------- */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-action]");
    if (!b || b.disabled) return;
    var a = b.dataset.action, c = cfg();
    if (a === "chore") {
      var ch = c.chores.filter(function (x) { return x.id === b.dataset.id; })[0];
      addEntry({ kind: "chore", choreId: ch.id, label: ch.name, yen: ch.yen, date: ui.selDate }, ch.name + " +" + yen(ch.yen));
    } else if (a === "bottle") {
      var n = parseInt(b.dataset.n, 10);
      addEntry({ kind: "bottle", n: n, date: ui.selDate }, "ペットボトル +" + n + "本");
    } else if (a === "test") {
      var max = b.dataset.max === "50" ? 50 : 100;
      var ty = max === 50 ? c.test50Yen : c.testYen;
      var te = { kind: "test", subject: b.dataset.subject, max: max, yen: ty, date: ui.selDate };
      addEntry(te, entryLabel(te) + " +" + yen(ty));
    } else if (a === "del") {
      removeEntry(b.dataset.mk, b.dataset.id, false);
    } else if (a === "day") {
      ui.selDate = b.dataset.date; render();
    } else if (a === "today") {
      ui.month = monthOf(todayStr()); ui.selDate = todayStr(); render();
    } else if (a === "prev" || a === "next" || a === "goto") {
      var mk = a === "goto" ? b.dataset.mk : shiftMonth(ui.month, a === "prev" ? -1 : 1);
      var cur = monthOf(todayStr());
      if (mk > cur) mk = cur;
      ui.month = mk; ui.payConfirm = false; ui.year = null;
      ui.selDate = mk === cur ? todayStr() : lastDay(mk);
      render();
      if (a === "goto") window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (a === "year-prev" || a === "year-next") {
      var base = ui.year !== null ? ui.year : schoolYearOfMonth(ui.month);
      ui.year = Math.min(schoolYearOfMonth(monthOf(todayStr())), base + (a === "year-prev" ? -1 : 1));
      render();
    } else if (a === "pay") {
      ui.payConfirm = true; render();
    } else if (a === "pay-no") {
      ui.payConfirm = false; render();
    } else if (a === "pay-yes") {
      ui.payConfirm = false;
      mutateMonth(ui.month, function (m) { m.paid = true; m.paidOn = todayStr(); });
      toast(monthLabel(ui.month) + "のおこづかいを、わたした記録にしました");
    } else if (a === "unpay") {
      mutateMonth(ui.month, function (m) { m.paid = false; delete m.paidOn; });
    } else if (a === "open-settings") {
      var d = document.getElementById("settings"); d.open = true;
      d.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("set-name").focus({ preventScroll: true });
    }
  });
  document.addEventListener("submit", function (ev) {
    var of = ev.target.closest("[data-form='other']");
    if (of) {
      ev.preventDefault();
      var oi = document.getElementById("other-label"), txt = oi.value.trim(), oy = cfg().otherYen;
      oi.value = "";
      var oe = { kind: "chore", choreId: "other", label: txt ? "その他：" + txt : "その他のお手伝い", yen: oy, date: ui.selDate };
      addEntry(oe, oe.label + " +" + yen(oy));
      return;
    }
    var df = ev.target.closest("[data-form='drill']");
    if (df) {
      ev.preventDefault();
      var di = document.getElementById("drill-label"), dname = di.value.trim() || "ドリル", dy = cfg().drillYen;
      di.value = "";
      var de = { kind: "drill", label: dname, yen: dy, date: ui.selDate };
      addEntry(de, entryLabel(de) + " +" + yen(dy));
      return;
    }
    var af = ev.target.closest("[data-form='advance']");
    if (af) {
      ev.preventDefault();
      var lab = document.getElementById("adv-label"), amt = document.getElementById("adv-yen");
      var v = Math.floor(parseFloat(amt.value));
      if (!isFinite(v) || v < 1) { toast("金額を1円以上の数字で入れてください"); amt.focus(); return; }
      var what = lab.value.trim() || "前借り";
      lab.value = ""; amt.value = "";
      addEntry({ kind: "advance", label: what, yen: v, date: ui.selDate }, "前借り「" + what + "」 −" + yen(v));
      return;
    }
    var f = ev.target.closest("[data-form='smile']");
    if (!f) return;
    ev.preventDefault();
    var input = f.querySelector("input");
    var score = parseFloat(input.value);
    if (!isFinite(score) || score < 0 || score > 1000) { toast("点数を数字で入れてください（0〜1000）"); input.focus(); return; }
    score = Math.round(score * 10) / 10;
    var season = f.dataset.season;
    input.value = "";
    addEntry({ kind: "smile", season: season, schoolYear: schoolYearOfMonth(ui.month), score: score, yen: Math.floor(score), date: ui.selDate },
      "スマイルゼミ " + seasonName(season) + " " + score + "点 → +" + yen(Math.floor(score)));
  });

  /* ---------- トースト ---------- */
  var toastEl = document.getElementById("toast"), toastTimer = null;
  function toast(msg, undo) {
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button type="button" id="toast-undo">とりけす</button>' : "");
    toastEl.hidden = false;
    if (undo) {
      document.getElementById("toast-undo").onclick = function () { toastEl.hidden = true; undo(); };
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, undo ? 6000 : 3500);
  }

  /* ---------- 起動 ---------- */
  loadLocal();
  state.loading = false;
  render();
})();
