/* Mon Temps — module « Mon cap » (Hub D'Or Blanc, 19/11/2026)
 * Ajouté à la fin de index.html, après l'appli. Il ne modifie rien de l'appli existante :
 * il ajoute une carte « Mon cap du jour » sur l'écran Aujourd'hui (profils Tous et Bilal)
 * et un panneau « Ma semaine » (semaine, offres, rythme, plan à coller).
 * Données : localStorage « cap:v1 », et, si la synchro de l'appli est réglée,
 * une ligne à part dans la table tm_state (id = <code>::cap) : les données de l'appli ne sont jamais touchées.
 */
(function () {
  'use strict';
  if (window.__capLoaded) return;
  window.__capLoaded = true;

  var KEY = 'cap:v1';
  var MAX_P = 3;
  var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];

  /* ---------- dates ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function jourCourt(s) {
    var d = parseISO(s);
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') + ' ' + d.getDate();
  }
  function jourLong(s) {
    var d = parseISO(s);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function dateLisible(s) {
    var d = parseISO(s);
    return d.getDate() + '/' + pad(d.getMonth() + 1);
  }
  /* « 2026-11-23 », « 23/11 », « 23/11/2026 » */
  function lireDate(txt) {
    txt = (txt || '').trim();
    var m = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    m = txt.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      var an = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
      var res = an + '-' + pad(+m[2]) + '-' + pad(+m[1]);
      if (!m[3] && diffDays(res, today()) > 60) res = (an + 1) + '-' + pad(+m[2]) + '-' + pad(+m[1]);
      return res;
    }
    return null;
  }

  /* ---------- état ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function vide() {
    return {
      v: 1, updatedAt: 0, items: [], offres: [], idees: [],
      rythme: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    };
  }
  function graine() {
    var s = vide();
    s.rythme = {
      1: ['Tournée Sud'],
      2: ['Tournée Nord · Ouest · Est'],
      3: ['Tournée Sud', 'Soir : le site (1 h, pas plus)'],
      4: ['Tournée Sud'],
      5: [],
      6: [],
      0: ['Tournée Nord · Ouest · Est', '20 min : le plan de la semaine avec le Hub']
    };
    if (today() <= '2026-11-29') {
      var plan = [
        ['P', '2026-11-19', 'Monter un coffret de chaque et le photographier de jour'],
        ['P', '2026-11-19', 'Caisse : mettre en tournée les packs déjà commandés'],
        ['P', '2026-11-20', 'Statut + story : mes coffrets sont là'],
        ['P', '2026-11-20', 'Diffusion WhatsApp des coffrets'],
        ['L', '2026-11-21', 'Carte bancaire chez OVH (5 min)'],
        ['P', '2026-11-22', '20 min avec le Hub : le plan de la semaine'],
        ['P', '2026-11-23', 'Ouverture de la semaine des offres : carrousel + diffusion'],
        ['P', '2026-11-25', 'Créneau site : oui ou non à la mise en ligne de la refonte'],
        ['P', '2026-11-27', 'Black Friday : statut, story, diffusion']
      ];
      plan.forEach(function (l) {
        s.items.push({ id: uid(), type: l[0], date: l[1], text: l[2], done: false, maj: Date.now() });
      });
      s.offres = [
        { id: uid(), titre: 'Coffrets des fêtes', debut: '2026-11-20', fin: '2026-12-24' },
        { id: uid(), titre: 'Semaine des offres', debut: '2026-11-23', fin: '2026-11-29' },
        { id: uid(), titre: 'Black Friday · Gold I à IV : 2 pour 99 €', debut: '2026-11-27', fin: '2026-11-30' }
      ];
    }
    s.updatedAt = Date.now();
    return s;
  }

  var etat = (function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.v === 1) return s; }
    } catch (e) {}
    return null;
  })();
  var premierLancement = !etat;
  if (!etat) etat = graine();
  if (!etat.idees) etat.idees = [];

  function sauver(sansSynchro) {
    etat.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch (e) {}
    if (!sansSynchro) pousserBientot();
    rendre();
  }

  /* Ce qui n'est pas fait glisse au jour même ; on garde le jour d'origine. Ménage des vieux « faits ». */
  function normaliser() {
    var t = today(), change = false;
    etat.items.forEach(function (it) {
      if (!it.done && it.date < t) { if (!it.orig) it.orig = it.date; it.date = t; change = true; }
    });
    var avant = etat.items.length;
    etat.items = etat.items.filter(function (it) { return !(it.done && diffDays(it.date, t) > 60); });
    if (etat.items.length !== avant) change = true;
    if (change) { try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch (e) {} }
  }

  function itemsDuJour(date, type) {
    return etat.items.filter(function (it) { return it.date === date && it.type === type; })
      .sort(function (a, b) { return (a.done - b.done) || ((a.ordre || 0) - (b.ordre || 0)); });
  }
  function nbP(date) { return etat.items.filter(function (it) { return it.date === date && it.type === 'P'; }).length; }

  function ajouter(type, date, text) {
    text = (text || '').trim();
    if (!text) return 'vide';
    if (type === 'P' && nbP(date) >= MAX_P) return 'plein';
    etat.items.push({ id: uid(), type: type, date: date, text: text, done: false, maj: Date.now(), ordre: Date.now() });
    sauver();
    return 'ok';
  }
  function trouver(id) { for (var i = 0; i < etat.items.length; i++) if (etat.items[i].id === id) return etat.items[i]; return null; }
  function deplacer(id, date) {
    var it = trouver(id); if (!it) return 'ok';
    if (it.type === 'P' && it.date !== date && nbP(date) >= MAX_P) return 'plein';
    it.date = date; it.orig = null; it.maj = Date.now(); sauver(); return 'ok';
  }

  function offresActives() {
    var t = today();
    return etat.offres.filter(function (o) { return o.fin >= t && diffDays(t, o.debut) <= 3; })
      .sort(function (a, b) { return a.debut < b.debut ? -1 : 1; });
  }

  /* ---------- synchro (même Supabase que l'appli, ligne à part) ---------- */
  function cfg() {
    try {
      var url = localStorage.getItem('tm:sb_url'), key = localStorage.getItem('tm:sb_key'), code = localStorage.getItem('tm:sb_code');
      if (url && key && code && /^https:\/\//.test(url)) return { url: url.replace(/\/+$/, ''), key: key, id: code + '::cap' };
    } catch (e) {}
    return null;
  }
  var synchro = 'local';
  function entetes(c) {
    return { 'apikey': c.key, 'Authorization': 'Bearer ' + c.key, 'Content-Type': 'application/json' };
  }
  function tirer() {
    var c = cfg(); if (!c || !window.fetch) { synchro = 'local'; return Promise.resolve(); }
    return fetch(c.url + '/rest/v1/tm_state?select=data&id=eq.' + encodeURIComponent(c.id), { headers: entetes(c) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (rows) {
        synchro = 'ok';
        if (!rows || !rows.length) { if (!premierLancement || etat.items.length) pousser(); return; }
        var d = rows[0].data; if (typeof d === 'string') d = JSON.parse(d);
        if (d && d.v === 1 && (premierLancement || d.updatedAt > etat.updatedAt)) {
          etat = d; premierLancement = false; if (!etat.idees) etat.idees = [];
          try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch (e) {}
          rendre();
        } else if (d && d.updatedAt < etat.updatedAt) { pousser(); }
        premierLancement = false;
      })
      .catch(function () { synchro = 'erreur'; });
  }
  function pousser() {
    var c = cfg(); if (!c || !window.fetch) return;
    var h = entetes(c); h['Prefer'] = 'resolution=merge-duplicates';
    fetch(c.url + '/rest/v1/tm_state', {
      method: 'POST', headers: h,
      body: JSON.stringify({ id: c.id, data: JSON.stringify(etat), updated_at: new Date().toISOString() })
    }).then(function (r) { synchro = r.ok ? 'ok' : 'erreur'; }).catch(function () { synchro = 'erreur'; });
  }
  var minuteur = null;
  function pousserBientot() { clearTimeout(minuteur); minuteur = setTimeout(pousser, 1200); }

  /* ---------- styles ---------- */
  var CSS = [
    '.cap-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px 16px 12px;margin:0 0 26px;box-shadow:0 1px 0 var(--shadow);}',
    '.cap-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}',
    '.cap-head h2{margin:0;font-size:17px;font-weight:750;}',
    '.cap-offre{display:flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border-radius:12px;padding:9px 12px;font-size:14px;margin-bottom:8px;}',
    '.cap-offre.avenir{background:var(--surface-2);color:var(--text);}',
    '.cap-offre b{font-weight:750;}',
    '.cap-offre .cap-reste{margin-left:auto;font-weight:700;white-space:nowrap;}',
    '.cap-rythme{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px;}',
    '.cap-chip{font-size:12.5px;font-weight:650;background:var(--surface-2);color:var(--text-soft);border-radius:999px;padding:4px 10px;}',
    '.cap-label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:750;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent-d);margin:10px 0 6px;}',
    '.cap-label .cap-count{color:var(--text-soft);letter-spacing:0;text-transform:none;font-weight:650;}',
    '.cap-row{display:flex;align-items:flex-start;gap:10px;padding:8px 2px;border-top:1px solid var(--border);}',
    '.cap-row:first-of-type{border-top:0;}',
    '.cap-row .cap-text{flex:1;font-size:15px;line-height:1.35;word-break:break-word;}',
    '.cap-row.fait .cap-text{text-decoration:line-through;color:var(--text-soft);}',
    '.cap-tag{font-size:11px;font-weight:700;color:var(--accent-d);background:var(--surface-2);border-radius:6px;padding:2px 6px;margin-left:6px;white-space:nowrap;}',
    '.cap-more{border:0;background:transparent;color:var(--text-soft);font-size:18px;line-height:1;padding:0 4px;cursor:pointer;}',
    '.cap-vide{font-size:14px;color:var(--text-soft);padding:6px 2px;}',
    '.cap-add{border:1px dashed var(--border);background:transparent;color:var(--text-soft);border-radius:10px;padding:7px 12px;font-size:13.5px;font-weight:650;cursor:pointer;margin-top:4px;}',
    '.cap-form{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}',
    '.cap-form input[type=text]{flex:1 1 180px;min-width:0;border:1px solid var(--border);border-radius:10px;padding:9px 11px;font-size:15px;background:var(--bg);color:var(--text);}',
    '.cap-form input[type=date],.cap-form select{border:1px solid var(--border);border-radius:10px;padding:8px;font-size:14px;background:var(--bg);color:var(--text);}',
    '.cap-msg{font-size:13px;color:var(--accent-d);margin-top:6px;font-weight:650;}',
    '.cap-week{display:flex;gap:6px;margin-top:14px;overflow-x:auto;padding-bottom:2px;}',
    '.cap-day{flex:1 0 42px;text-align:center;border:1px solid var(--border);border-radius:12px;padding:6px 2px;cursor:pointer;background:var(--bg);color:var(--text);}',
    '.cap-day.auj{border-color:var(--accent);}',
    '.cap-day .cap-dn{font-size:11.5px;font-weight:700;color:var(--text-soft);text-transform:capitalize;}',
    '.cap-dots{display:flex;justify-content:center;gap:3px;margin-top:4px;height:7px;}',
    '.cap-dot{width:7px;height:7px;border-radius:50%;background:var(--border);}',
    '.cap-dot.p{background:var(--accent);opacity:.45;}',
    '.cap-dot.ok{background:var(--accent);opacity:1;}',
    '.cap-overlay{position:fixed;inset:0;z-index:9999;background:rgba(20,16,12,.45);display:flex;align-items:flex-end;justify-content:center;}',
    '.cap-sheet{background:var(--bg);color:var(--text);width:100%;max-width:760px;max-height:92vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;font-family:inherit;}',
    '@media(min-width:761px){.cap-overlay{align-items:center;}.cap-sheet{border-radius:22px;max-height:88vh;}}',
    '.cap-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px;flex-shrink:0;}',
    '.cap-sheet-head h2{margin:0;font-size:21px;font-weight:800;}',
    '.cap-x{border:0;background:var(--surface-2);color:var(--text);width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;}',
    '.cap-tabs{display:flex;gap:6px;padding:4px 18px 10px;overflow-x:auto;flex-shrink:0;}',
    '.cap-tab{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:999px;padding:7px 13px;font-size:13.5px;font-weight:650;cursor:pointer;white-space:nowrap;}',
    '.cap-tab.on{background:var(--accent);border-color:var(--accent);color:#fff;}',
    '.cap-body{flex:1;min-height:0;overflow-y:auto;padding:4px 18px 28px;-webkit-overflow-scrolling:touch;}',
    '.cap-jour{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px 14px;margin-bottom:12px;}',
    '.cap-jour.auj{border-color:var(--accent);}',
    '.cap-jour h3{margin:0 0 4px;font-size:15.5px;font-weight:750;}',
    '.cap-offre-l{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:11px 13px;margin-bottom:10px;}',
    '.cap-offre-l .cap-o-t{flex:1;}',
    '.cap-offre-l b{display:block;font-size:15px;}',
    '.cap-offre-l small{color:var(--text-soft);font-size:13px;}',
    '.cap-etat{font-size:12px;font-weight:700;border-radius:999px;padding:3px 9px;background:var(--surface-2);color:var(--text-soft);white-space:nowrap;}',
    '.cap-etat.encours{background:var(--accent);color:#fff;}',
    '.cap-rj{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;}',
    '.cap-rj label{width:92px;flex-shrink:0;font-weight:700;font-size:14px;padding-top:9px;}',
    '.cap-rj textarea,.cap-plan textarea{flex:1;width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:8px 10px;font-size:14px;font-family:inherit;background:var(--surface);color:var(--text);resize:vertical;}',
    '.cap-plan textarea{min-height:170px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;}',
    '.cap-aide{font-size:13px;color:var(--text-soft);line-height:1.5;margin:6px 0 10px;}',
    '.cap-aide code{background:var(--surface-2);border-radius:5px;padding:1px 5px;}',
    '.cap-prev{margin-top:10px;font-size:14px;}',
    '.cap-prev div{padding:5px 0;border-top:1px solid var(--border);}',
    '.cap-prev .err{color:#C0392B;}',
    '.cap-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}',
    '.cap-head-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}',
    '.cap-text.a-detail{cursor:pointer;}',
    '.cap-i{font-size:12px;font-weight:700;color:var(--accent-d);margin-left:6px;white-space:nowrap;}',
    '.cap-detail{margin:-2px 0 10px 31px;padding:10px 12px;background:var(--surface-2);border-radius:12px;font-size:14px;line-height:1.5;color:var(--text);}',
    '.cap-detail > div + div{margin-top:8px;}',
    '.cap-copie{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 10px;}',
    '.cap-copie pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:13.5px;margin:8px 0 0;}',
    '.cap-note{color:var(--text-soft);font-size:13.5px;margin:0 0 6px;}',
    '.cap-etape{display:flex;align-items:flex-start;gap:9px;padding:5px 0;}',
    '.cap-etape .tm-check.petit{width:18px;height:18px;font-size:11px;margin-top:0;}',
    '.cap-etape.fait .cap-et-t{text-decoration:line-through;color:var(--text-soft);}',
    '.cap-et-t{flex:1;font-size:14px;line-height:1.35;}',
    '.cap-et-t[data-cap-plie]{cursor:pointer;}',
    '.cap-chev{color:var(--accent-d);font-size:12px;}',
    '.cap-sous{margin:-2px 0 6px 27px;font-size:13.5px;color:var(--text-soft);line-height:1.45;}',
    '.cap-sec + .cap-sec{border-top:1px solid var(--border);}',
    '.cap-sec-t{display:flex;justify-content:space-between;align-items:center;width:100%;background:transparent;border:0;padding:8px 0;font-size:14px;font-weight:700;color:var(--text);cursor:pointer;text-align:left;font-family:inherit;}',
    '.cap-sec-n{color:var(--accent-d);font-weight:700;font-size:13px;white-space:nowrap;}',
    '.cap-sec-c{padding:0 0 6px;}',
    '.cap-lien{border:0;background:transparent;color:var(--accent-d);font-weight:700;font-size:13px;cursor:pointer;margin-left:6px;font-family:inherit;}',
    '.cap-idee textarea{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-size:16px;font-family:inherit;background:var(--surface);color:var(--text);min-height:96px;resize:vertical;}',
    '.cap-menu{position:fixed;inset:0;z-index:10000;background:rgba(20,16,12,.35);display:flex;align-items:flex-end;justify-content:center;}',
    '.cap-menu-box{background:var(--surface);color:var(--text);width:100%;max-width:420px;border-radius:18px 18px 0 0;padding:10px 12px 22px;}',
    '.cap-menu-box button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--text);font-size:16px;padding:13px 10px;border-radius:10px;cursor:pointer;}',
    '.cap-menu-box button:hover{background:var(--surface-2);}',
    '.cap-menu-box .danger{color:#C0392B;}',
    '.cap-menu-box .cap-menu-t{font-size:13px;color:var(--text-soft);padding:6px 10px 8px;}'
  ].join('\n');

  /* ---------- rendu ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(type) { return type === 'P' ? '' : ' round'; }

  function htmlLigne(it) {
    var tag = it.orig ? '<span class="cap-tag">reporté</span>' : '';
    var ouvert = !!(it.detail && ouverts[it.id]);
    var lien = it.detail ? ' data-cap-detail="' + it.id + '"' : '';
    var pr = it.detail ? etapesDe(it) : { n: 0, f: 0 };
    var marque = it.detail ? '<span class="cap-i">' + (pr.n ? pr.f + '/' + pr.n + ' · ' : '') + (ouvert ? 'fermer ▴' : 'détails ▾') + '</span>' : '';
    return '<div class="cap-row' + (it.done ? ' fait' : '') + '">' +
      '<button class="tm-check' + ico(it.type) + (it.done ? ' on' : '') + '" data-cap-toggle="' + it.id + '" aria-label="Fait">' + (it.done ? '✓' : '') + '</button>' +
      '<span class="cap-text' + (it.detail ? ' a-detail' : '') + '"' + lien + '>' + esc(it.text) + tag + marque + '</span>' +
      '<button class="cap-more" data-cap-menu="' + it.id + '" aria-label="Plus">⋯</button></div>' +
      (ouvert ? htmlDetail(it) : '');
  }
  /* le détail d'une ligne, en étages : une phrase, des étapes à cocher (chacune s'ouvre d'un toucher),
     des parties repliées (# titre), des textes à copier ([[ … ]]). Format d'une étape : « - titre :: précision ». */
  function lireDetail(txt) {
    var copies = [];
    txt = String(txt || '').replace(/\[\[([\s\S]*?)\]\]/g, function (m, c) { copies.push(c.trim()); return '\n§' + (copies.length - 1) + '§\n'; });
    var racine = { titre: '', notes: [], etapes: [] }, parts = [racine], cur = racine;
    txt.split('\n').forEach(function (l) {
      l = l.trim(); if (!l) return;
      var m = l.match(/^§(\d+)§$/);
      if (m) { cur.etapes.push({ copie: copies[+m[1]] }); return; }
      if (l.charAt(0) === '#') { cur = { titre: l.replace(/^#+\s*/, ''), notes: [], etapes: [] }; parts.push(cur); return; }
      if (l.slice(0, 2) === '- ') { var x = l.slice(2).split(' :: '); cur.etapes.push({ titre: x[0].trim(), sous: x.slice(1).join(' :: ').trim() }); return; }
      cur.notes.push(l);
    });
    return parts;
  }
  function etapesDe(it) {
    var n = 0, f = 0, fait = it.etapes || {};
    lireDetail(it.detail).forEach(function (p, s) { p.etapes.forEach(function (e) { if (e.copie) return; n++; if (fait[s + ':' + e.titre]) f++; }); });
    return { n: n, f: f };
  }
  function htmlDetail(it) {
    var h = '<div class="cap-detail">', fait = it.etapes || {};
    lireDetail(it.detail).forEach(function (p, s) {
      var corps = '';
      p.notes.forEach(function (n) { corps += '<div class="cap-note">' + esc(n) + '</div>'; });
      p.etapes.forEach(function (e, j) {
        if (e.copie) {
          var k = it.id + ':' + s + ':' + j, vu = ouverts['c' + k]; copieBlocs[k] = e.copie;
          corps += '<div class="cap-copie"><button class="tm-btn small primary" data-cap-copier="' + k + '">Copier le texte</button><button class="cap-lien" data-cap-plie="c' + esc(k) + '">' + (vu ? 'cacher' : 'voir le texte') + '</button>' + (vu ? '<pre>' + esc(e.copie) + '</pre>' : '') + '</div>';
          return;
        }
        var ke = s + ':' + e.titre, ok = !!fait[ke], ko = 'e' + it.id + ':' + ke, ouv = !!ouverts[ko];
        corps += '<div class="cap-etape' + (ok ? ' fait' : '') + '"><button class="tm-check round petit' + (ok ? ' on' : '') + '" data-cap-etape="' + it.id + '" data-cap-cle="' + esc(ke) + '" aria-label="Fait">' + (ok ? '✓' : '') + '</button>' +
          '<span class="cap-et-t"' + (e.sous ? ' data-cap-plie="' + esc(ko) + '"' : '') + '>' + esc(e.titre) + (e.sous ? ' <span class="cap-chev">' + (ouv ? '▴' : '▸') + '</span>' : '') + '</span></div>' +
          (e.sous && ouv ? '<div class="cap-sous">' + esc(e.sous) + '</div>' : '');
      });
      if (p.titre) {
        var ks = 's' + it.id + ':' + s, ouvs = !!ouverts[ks];
        var tot = p.etapes.filter(function (e) { return !e.copie; }), nf = tot.filter(function (e) { return fait[s + ':' + e.titre]; }).length;
        h += '<div class="cap-sec"><button class="cap-sec-t" data-cap-plie="' + esc(ks) + '"><span>' + esc(p.titre) + '</span><span class="cap-sec-n">' + (tot.length ? nf + '/' + tot.length + ' ' : '') + (ouvs ? '▴' : '▸') + '</span></button>' + (ouvs ? '<div class="cap-sec-c">' + corps + '</div>' : '') + '</div>';
      } else h += corps;
    });
    return h + '</div>';
  }
  function htmlBloc(type, date, compact) {
    var list = itemsDuJour(date, type);
    var titre = type === 'P' ? 'Mes 3 priorités' : 'Ma petite liste';
    var count = type === 'P' ? '<span class="cap-count">' + list.filter(function (i) { return i.done; }).length + '/' + list.length + '</span>' : '';
    var h = '<div class="cap-label">' + titre + count + '</div>';
    if (!list.length) h += '<div class="cap-vide">' + (type === 'P' ? 'Rien de prévu. Choisis tes trois choses.' : 'Rien de plus.') + '</div>';
    list.forEach(function (it) { h += htmlLigne(it); });
    var plein = type === 'P' && list.length >= MAX_P;
    if (!plein) h += '<div data-cap-formzone="' + type + date + '"><button class="cap-add" data-cap-add="' + type + '" data-cap-date="' + date + '">+ ' + (type === 'P' ? 'Une priorité' : 'Ajouter') + '</button></div>';
    return h;
  }
  function htmlRythme(date) {
    var lignes = (etat.rythme[parseISO(date).getDay()] || []).filter(Boolean);
    if (!lignes.length) return '';
    return '<div class="cap-rythme">' + lignes.map(function (l) { return '<span class="cap-chip">' + esc(l) + '</span>'; }).join('') + '</div>';
  }
  function htmlOffres() {
    var t = today();
    return offresActives().slice(0, 2).map(function (o) {
      var enCours = o.debut <= t;
      var reste = enCours ? diffDays(t, o.fin) : diffDays(t, o.debut);
      var txt = enCours ? (reste === 0 ? 'dernier jour' : 'encore ' + (reste + 1) + ' j') : (reste === 1 ? 'demain' : 'dans ' + reste + ' j');
      return '<div class="cap-offre' + (enCours ? '' : ' avenir') + '">🎁 <span><b>' + esc(o.titre) + '</b></span><span class="cap-reste">' + txt + '</span></div>';
    }).join('');
  }
  function htmlSemaineMini() {
    var t = today(), h = '<div class="cap-week">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(t, i), ps = itemsDuJour(d, 'P'), dots = '';
      for (var k = 0; k < MAX_P; k++) dots += '<span class="cap-dot' + (ps[k] ? (ps[k].done ? ' ok' : ' p') : '') + '"></span>';
      h += '<div class="cap-day' + (i === 0 ? ' auj' : '') + '" data-cap-open="semaine" data-cap-jour="' + d + '"><div class="cap-dn">' + esc(jourCourt(d)) + '</div><div class="cap-dots">' + dots + '</div></div>';
    }
    return h + '</div>';
  }
  function htmlCarte() {
    var t = today();
    return htmlOffres() +
      '<div class="cap-head"><h2>Mon cap du jour</h2><div class="cap-head-btns"><button class="tm-btn small" data-cap-open="idees">💡 ' + (nbIdees() ? nbIdees() : 'Idée') + '</button><button class="tm-btn small" data-cap-open="semaine">Ma semaine →</button></div></div>' +
      htmlRythme(t) + htmlBloc('P', t) + htmlBloc('L', t) + htmlSemaineMini();
  }

  var onglet = 'semaine', jourCible = null, apercu = null;
  var ouverts = {}, copieBlocs = {};
  function htmlPanneau() {
    var tabs = [['semaine', 'Semaine'], ['idees', 'Idées'], ['offres', 'Offres'], ['rythme', 'Mon rythme'], ['plan', 'Plan à coller']];
    var h = '<div class="cap-sheet" role="dialog" aria-label="Ma semaine"><div class="cap-sheet-head"><h2>Ma semaine</h2><button class="cap-x" data-cap-close aria-label="Fermer">✕</button></div>';
    h += '<div class="cap-tabs">' + tabs.map(function (x) { return '<button class="cap-tab' + (onglet === x[0] ? ' on' : '') + '" data-cap-tab="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="cap-body">';
    if (onglet === 'semaine') h += htmlOngletSemaine();
    else if (onglet === 'offres') h += htmlOngletOffres();
    else if (onglet === 'idees') h += htmlOngletIdees();
    else if (onglet === 'rythme') h += htmlOngletRythme();
    else h += htmlOngletPlan();
    return h + '</div></div>';
  }
  function htmlOngletSemaine() {
    var t = today(), h = htmlOffres();
    for (var i = 0; i < 7; i++) {
      var d = addDays(t, i);
      var nomJour = jourLong(d);
      if (i > 1) nomJour = nomJour.charAt(0).toUpperCase() + nomJour.slice(1);
      h += '<div class="cap-jour' + (i === 0 ? ' auj' : '') + '" id="cap-j-' + d + '"><h3>' + (i === 0 ? 'Aujourd\'hui · ' : i === 1 ? 'Demain · ' : '') + esc(nomJour) + '</h3>' +
        htmlRythme(d) + htmlBloc('P', d) + htmlBloc('L', d) + '</div>';
    }
    var plusTard = etat.items.filter(function (it) { return !it.done && it.date > addDays(t, 6); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (plusTard.length) {
      h += '<div class="cap-jour"><h3>Plus tard</h3>' + plusTard.map(function (it) {
        return htmlLigne(it).replace(/<span class="cap-text([^"]*)"([^>]*)>/, '<span class="cap-text$1"$2><span class="cap-tag">' + dateLisible(it.date) + '</span> ');
      }).join('') + '</div>';
    }
    return h;
  }
  function htmlOngletOffres() {
    var t = today();
    var list = etat.offres.slice().sort(function (a, b) { return a.debut < b.debut ? -1 : 1; });
    var h = '<p class="cap-aide">Tes offres et tes temps forts : celle en cours s\'affiche en haut de ta journée, et celle qui arrive trois jours avant.</p>';
    if (!list.length) h += '<div class="cap-vide">Aucune offre pour l\'instant.</div>';
    list.forEach(function (o) {
      var etiquette = o.fin < t ? ['fini', 'Fini'] : o.debut <= t ? ['encours', 'En cours'] : ['', 'Dans ' + diffDays(t, o.debut) + ' j'];
      h += '<div class="cap-offre-l"><div class="cap-o-t"><b>' + esc(o.titre) + '</b><small>du ' + dateLisible(o.debut) + ' au ' + dateLisible(o.fin) + '</small></div>' +
        '<span class="cap-etat ' + etiquette[0] + '">' + etiquette[1] + '</span><button class="cap-more" data-cap-offre-suppr="' + o.id + '" aria-label="Supprimer">✕</button></div>';
    });
    h += '<div class="cap-label">Nouvelle offre</div><div class="cap-form" id="cap-offre-form">' +
      '<input type="text" id="cap-o-titre" placeholder="Ex. Semaine des offres">' +
      '<input type="date" id="cap-o-debut" value="' + t + '"><input type="date" id="cap-o-fin" value="' + addDays(t, 6) + '">' +
      '<button class="tm-btn small primary" data-cap-offre-ajout>Ajouter</button></div><div class="cap-msg" id="cap-o-msg"></div>';
    return h;
  }
  function htmlOngletRythme() {
    var h = '<p class="cap-aide">Ce qui revient chaque semaine : tes tournées, ton créneau site, tes vidéos, ton rendez-vous du dimanche. Une ligne par créneau. Ça s\'affiche en petit en haut de chaque jour.</p>';
    ORDRE_JOURS.forEach(function (j) {
      h += '<div class="cap-rj"><label for="cap-r-' + j + '">' + JOURS[j] + '</label><textarea rows="2" id="cap-r-' + j + '" data-cap-rythme="' + j + '">' + esc((etat.rythme[j] || []).join('\n')) + '</textarea></div>';
    });
    return h;
  }
  function htmlOngletPlan() {
    var h = '<div class="cap-plan"><p class="cap-aide">Le dimanche, le Hub te donne ton plan de la semaine : colle-le ici, tout se range tout seul. Une ligne par chose :<br>' +
      '<code>P | 2026-11-23 | Publier le carrousel des coffrets</code> (priorité)<br>' +
      '<code>L | 24/11 | Récupérer les boîtes</code> (petite liste)<br>' +
      '<code>OFFRE | 23/11 | 29/11 | Semaine des offres</code></p>' +
      '<textarea id="cap-plan-txt" placeholder="Colle ton plan ici"></textarea>' +
      '<div class="cap-btns"><button class="tm-btn small" data-cap-plan-lire>Lire le plan</button>' +
      (apercu && apercu.ok.length ? '<button class="tm-btn small primary" data-cap-plan-ok>Ajouter ' + apercu.ok.length + ' ligne' + (apercu.ok.length > 1 ? 's' : '') + '</button>' : '') +
      '<button class="tm-btn small" data-cap-plan-export>Copier ma semaine</button></div><div class="cap-prev" id="cap-plan-prev">';
    if (apercu) {
      apercu.ok.forEach(function (l) { h += '<div>✓ ' + esc(l.resume) + '</div>'; });
      apercu.err.forEach(function (l) { h += '<div class="err">✗ ' + esc(l) + '</div>'; });
    }
    return h + '</div></div>';
  }

  /* ---------- idées en vrac ---------- */
  function nbIdees() { return (etat.idees || []).filter(function (x) { return !x.faite; }).length; }
  function htmlOngletIdees() {
    var micro = (window.SpeechRecognition || window.webkitSpeechRecognition) ? '<button class="tm-btn small" data-cap-micro>🎙 Parler</button>' : '';
    var h = '<p class="cap-aide">Tout ce qui te passe par la tête, en vrac : écris-le, ou touche le micro du clavier de ton téléphone pour le dicter. Le dimanche, on fait le point ensemble : chaque idée devient une chose de ta semaine, ou elle attend.</p>' +
      '<div class="cap-idee"><textarea id="cap-idee-txt" placeholder="Mon idée…"></textarea></div>' +
      '<div class="cap-btns"><button class="tm-btn small primary" data-cap-idee-ajout>Garder l\'idée</button>' + micro +
      '<button class="tm-btn small" data-cap-idees-export>Copier mes idées</button></div><div class="cap-msg" id="cap-idee-msg"></div>';
    var list = (etat.idees || []).filter(function (x) { return !x.faite; }).sort(function (a, b) { return b.ts - a.ts; });
    h += '<div class="cap-label">Mes idées <span class="cap-count">' + list.length + '</span></div>';
    if (!list.length) h += '<div class="cap-vide">Aucune idée en attente.</div>';
    list.forEach(function (x) {
      h += '<div class="cap-row"><span class="cap-text">' + esc(x.text) + '<span class="cap-tag">' + dateLisible(x.date) + '</span></span>' +
        '<button class="cap-more" data-cap-idee-menu="' + x.id + '" aria-label="Plus">⋯</button></div>';
    });
    return h;
  }
  function ajouterIdee() {
    var ta = document.getElementById('cap-idee-txt'), t = ((ta && ta.value) || '').trim();
    if (!t) return;
    if (reco) reco.stop();
    etat.idees.push({ id: uid(), text: t, date: today(), ts: Date.now() });
    ta.value = ''; sauver();
  }
  function exporterIdees() {
    return ['# Mes idées au ' + dateLisible(today())].concat((etat.idees || []).filter(function (x) { return !x.faite; })
      .map(function (x) { return 'IDEE | ' + x.date + ' | ' + x.text; })).join('\n');
  }
  var reco = null;
  function micro(btn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (reco) { reco.stop(); return; }
    var ta = document.getElementById('cap-idee-txt'), base = ta.value ? ta.value + ' ' : '';
    reco = new SR(); reco.lang = 'fr-FR'; reco.interimResults = true; reco.continuous = true;
    reco.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; ta.value = base + t; };
    reco.onend = function () { reco = null; btn.textContent = '🎙 Parler'; };
    reco.onerror = function () { var m = document.getElementById('cap-idee-msg'); if (m) m.textContent = 'Le micro ne marche pas ici : utilise le micro du clavier.'; };
    btn.textContent = '■ Arrêter'; reco.start();
  }
  function copier(btn, txt, label) {
    var fini = function () { btn.textContent = 'Copié ✓'; setTimeout(function () { btn.textContent = label; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(fini, function () { window.prompt('Copie ce texte', txt); });
    else window.prompt('Copie ce texte', txt);
  }
  function menuIdee(id) {
    var x = null; (etat.idees || []).forEach(function (y) { if (y.id === id) x = y; }); if (!x) return;
    var m = document.createElement('div'); m.className = 'cap-menu';
    m.innerHTML = '<div class="cap-menu-box"><div class="cap-menu-t">' + esc(x.text) + '</div>' +
      '<button data-m="L">Dans ma petite liste, un jour…</button><button data-m="P">En faire une priorité, un jour…</button>' +
      '<button data-m="faite">C\'est traité</button><button data-m="suppr" class="danger">Supprimer</button><button data-m="x">Annuler</button></div>';
    (document.querySelector('.tm-app') || document.body).appendChild(m);
    function fin() { if (m.parentNode) m.parentNode.removeChild(m); }
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]');
      if (!b) { if (e.target === m) fin(); return; }
      var a = b.getAttribute('data-m'); fin();
      if (a === 'L' || a === 'P') {
        var d = lireDate(window.prompt('Quel jour ? (ex. 24/11)', dateLisible(addDays(today(), 1))));
        if (!d) return;
        if (ajouter(a, d, x.text) === 'plein') { window.alert('Trois priorités, ça suffit pour ce jour-là : choisis un autre jour.'); return; }
        x.faite = true; sauver();
      }
      else if (a === 'faite') { x.faite = true; sauver(); }
      else if (a === 'suppr') { etat.idees = etat.idees.filter(function (y) { return y.id !== id; }); sauver(); }
    });
  }

  /* ---------- plan du Hub, chargé tout seul (plan-hub.txt du dépôt) ---------- */
  var PLAN_URL = 'https://raw.githubusercontent.com/laadissabilalpro-ui/gestion-du-temps/main/plan-hub.txt';
  function cle(type, a, b, c) { return [type, a, b, c || ''].join('|').toLowerCase(); }
  function chargerPlanHub() {
    if (!window.fetch) return;
    fetch(PLAN_URL + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (txt) {
      if (!txt) return;
      if (!etat.importes) etat.importes = [];
      var t = today(), ajout = 0;
      txt.split(/\r?\n/).forEach(function (brut) {
        var ligne = brut.trim(); if (!ligne || ligne.charAt(0) === '#') return;
        var p = ligne.split('|').map(function (x) { return x.trim(); });
        var type = (p[0] || '').toUpperCase();
        if (type === 'OFFRE' || type === 'O') {
          var d1 = lireDate(p[1]), d2 = lireDate(p[2]), titre = p.slice(3).join(' | ');
          if (!d1 || !d2 || !titre || d2 < t) return;
          var k = cle('O', d1, d2, titre); if (etat.importes.indexOf(k) >= 0) return;
          etat.importes.push(k);
          if (!etat.offres.some(function (o) { return o.titre.toLowerCase() === titre.toLowerCase() && o.debut === d1; })) { etat.offres.push({ id: uid(), titre: titre, debut: d1, fin: d2 }); ajout++; }
          return;
        }
        if (type !== 'P' && type !== 'L') return;
        var d = lireDate(p[1]), texte = p[2] || '', detail = p.slice(3).join(' | ').replace(/\\n/g, '\n');
        if (!d || !texte || d < t) return;
        var k2 = cle(type, d, texte), existant = null;
        etat.items.forEach(function (it) { if (it.text.toLowerCase() === texte.toLowerCase() && (it.date === d || it.orig === d)) existant = it; });
        if (existant) { if (detail && existant.detail !== detail) { existant.detail = detail; ajout++; } if (etat.importes.indexOf(k2) < 0) etat.importes.push(k2); return; }
        if (etat.importes.indexOf(k2) >= 0) return;
        etat.importes.push(k2);
        var ty = (type === 'P' && nbP(d) >= MAX_P) ? 'L' : type;
        etat.items.push({ id: uid(), type: ty, date: d, text: texte, detail: detail, done: false, maj: Date.now(), ordre: Date.now(), hub: true });
        ajout++;
      });
      if (etat.importes.length > 400) etat.importes = etat.importes.slice(-400);
      if (ajout) sauver(); else { try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch (e) {} }
    }).catch(function () {});
  }

  /* ---------- plan collé ---------- */
  function lirePlan(txt) {
    var ok = [], err = [], compte = {};
    (txt || '').split(/\r?\n/).forEach(function (brut, n) {
      var ligne = brut.trim(); if (!ligne || ligne.charAt(0) === '#') return;
      var p = ligne.split('|').map(function (x) { return x.trim(); });
      var type = (p[0] || '').toUpperCase();
      if (type === 'OFFRE' || type === 'O') {
        var d1 = lireDate(p[1]), d2 = lireDate(p[2]), titre = p.slice(3).join(' | ');
        if (!d1 || !d2 || !titre) { err.push('Ligne ' + (n + 1) + ' : offre incomplète (OFFRE | début | fin | titre)'); return; }
        if (d2 < d1) { err.push('Ligne ' + (n + 1) + ' : la fin est avant le début'); return; }
        ok.push({ kind: 'offre', titre: titre, debut: d1, fin: d2, resume: 'Offre « ' + titre + ' » du ' + dateLisible(d1) + ' au ' + dateLisible(d2) });
        return;
      }
      if (type !== 'P' && type !== 'L') { err.push('Ligne ' + (n + 1) + ' : je ne comprends pas « ' + ligne.slice(0, 40) + ' »'); return; }
      var d = lireDate(p[1]), texte = p[2] || '', detail = p.slice(3).join(' | ').replace(/\\n/g, '\n');
      if (!d || !texte) { err.push('Ligne ' + (n + 1) + ' : il manque la date ou le texte'); return; }
      if (type === 'P') {
        compte[d] = (compte[d] || nbP(d)) + 1;
        if (compte[d] > MAX_P) { err.push('Ligne ' + (n + 1) + ' : déjà 3 priorités le ' + dateLisible(d) + ' (« ' + texte + ' »)'); return; }
      }
      ok.push({ kind: type, date: d, text: texte, detail: detail, resume: (type === 'P' ? 'Priorité' : 'Petite liste') + ' · ' + jourCourt(d) + ' · ' + texte });
    });
    return { ok: ok, err: err };
  }
  function appliquerPlan() {
    if (!apercu) return;
    apercu.ok.forEach(function (l) {
      if (l.kind === 'offre') etat.offres.push({ id: uid(), titre: l.titre, debut: l.debut, fin: l.fin });
      else etat.items.push({ id: uid(), type: l.kind, date: l.date, text: l.text, detail: l.detail || '', done: false, maj: Date.now(), ordre: Date.now() });
    });
    apercu = null; onglet = 'semaine'; sauver();
  }
  function exporterSemaine() {
    var t = today(), lignes = ['# Ma semaine au ' + dateLisible(t)];
    etat.offres.filter(function (o) { return o.fin >= t; }).forEach(function (o) { lignes.push('OFFRE | ' + o.debut + ' | ' + o.fin + ' | ' + o.titre); });
    etat.items.filter(function (it) { return it.date >= t; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .forEach(function (it) { lignes.push(it.type + ' | ' + it.date + ' | ' + it.text + (it.done ? '  (fait)' : '')); });
    return lignes.join('\n');
  }

  /* ---------- montage dans l'appli ---------- */
  function styleOk() {
    if (document.getElementById('cap-style')) return;
    var s = document.createElement('style'); s.id = 'cap-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function profilNelly() {
    var on = document.querySelector('.tm-pf.on');
    return !!(on && /nelly/i.test(on.textContent || ''));
  }
  var rendering = false;
  function carteOk() {
    var head = document.querySelector('.tm-today-head');
    var carte = document.getElementById('cap-card');
    if (!head || profilNelly()) { if (carte && carte.parentNode) carte.parentNode.removeChild(carte); return; }
    if (!carte) {
      carte = document.createElement('section');
      carte.id = 'cap-card'; carte.className = 'cap-card';
      /* juste sous la date et les boutons : les trois priorités se voient sans faire défiler */
      head.parentNode.insertBefore(carte, head.nextSibling);
      remplirCarte(carte);
    }
  }
  function remplirCarte(carte) {
    carte = carte || document.getElementById('cap-card');
    if (!carte) return;
    rendering = true; carte.innerHTML = htmlCarte(); rendering = false;
  }
  function panneau() { return document.getElementById('cap-overlay'); }
  function ouvrir(o, jour) {
    onglet = o || 'semaine'; jourCible = jour || null;
    var ov = panneau();
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'cap-overlay'; ov.className = 'cap-overlay';
      (document.querySelector('.tm-app') || document.body).appendChild(ov);
      document.documentElement.style.overflow = 'hidden';
    }
    remplirPanneau();
    if (jourCible) { var el = document.getElementById('cap-j-' + jourCible); if (el) el.scrollIntoView({ block: 'start' }); }
    if (onglet === 'idees') { var ta = document.getElementById('cap-idee-txt'); if (ta) ta.focus(); }
  }
  function fermer() {
    var ov = panneau(); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    document.documentElement.style.overflow = ''; apercu = null;
  }
  function remplirPanneau() {
    var ov = panneau(); if (!ov) return;
    var body = ov.querySelector('.cap-body'), pos = body ? body.scrollTop : 0;
    var txt = ov.querySelector('#cap-plan-txt'), garde = txt ? txt.value : null;
    var tid = ov.querySelector('#cap-idee-txt'), gardeIdee = tid ? tid.value : null;
    ov.innerHTML = htmlPanneau();
    body = ov.querySelector('.cap-body'); if (body) body.scrollTop = pos;
    txt = ov.querySelector('#cap-plan-txt'); if (txt && garde !== null) txt.value = garde;
    tid = ov.querySelector('#cap-idee-txt'); if (tid && gardeIdee !== null) tid.value = gardeIdee;
  }
  function rendre() {
    normaliser();
    remplirCarte();
    remplirPanneau();
  }

  /* ---------- formulaires et menus ---------- */
  function ouvrirForm(zone, type, date) {
    zone.innerHTML = '<div class="cap-form"><input type="text" placeholder="' + (type === 'P' ? 'Ma priorité' : 'À faire') + '" maxlength="140">' +
      '<input type="date" value="' + date + '"><button class="tm-btn small primary" data-cap-valider="' + type + '">OK</button></div><div class="cap-msg"></div>';
    var input = zone.querySelector('input[type=text]'); input.focus();
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); valider(zone, type); } if (e.key === 'Escape') rendre(); });
  }
  function valider(zone, type) {
    var text = zone.querySelector('input[type=text]').value, date = zone.querySelector('input[type=date]').value || today();
    var r = ajouter(type, date, text);
    if (r === 'plein') zone.querySelector('.cap-msg').textContent = 'Trois priorités, ça suffit pour ce jour-là : mets-la un autre jour.';
  }
  function menu(id) {
    var it = trouver(id); if (!it) return;
    var m = document.createElement('div'); m.className = 'cap-menu';
    m.innerHTML = '<div class="cap-menu-box"><div class="cap-menu-t">' + esc(it.text) + '</div>' +
      '<button data-m="demain">Demain</button><button data-m="jour">Un autre jour…</button>' +
      '<button data-m="type">' + (it.type === 'P' ? 'Passer en petite liste' : 'En faire une priorité') + '</button>' +
      '<button data-m="modif">Modifier le texte</button><button data-m="suppr" class="danger">Supprimer</button>' +
      '<button data-m="x">Annuler</button><input type="date" style="position:absolute;opacity:0;pointer-events:none" value="' + it.date + '"></div>';
    (document.querySelector('.tm-app') || document.body).appendChild(m);
    function fin() { if (m.parentNode) m.parentNode.removeChild(m); }
    function alerte(r) { if (r === 'plein') window.alert('Trois priorités, ça suffit pour ce jour-là : choisis un autre jour.'); }
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]');
      if (!b) { if (e.target === m) fin(); return; }
      var a = b.getAttribute('data-m');
      if (a === 'demain') { fin(); alerte(deplacer(id, addDays(today(), 1))); }
      else if (a === 'jour') {
        var d = window.prompt('Quel jour ? (ex. 24/11)', dateLisible(addDays(today(), 1)));
        fin(); var iso2 = lireDate(d); if (iso2) alerte(deplacer(id, iso2));
      }
      else if (a === 'type') {
        fin();
        if (it.type === 'L' && nbP(it.date) >= MAX_P) { alerte('plein'); return; }
        it.type = it.type === 'P' ? 'L' : 'P'; it.maj = Date.now(); sauver();
      }
      else if (a === 'modif') { var t2 = window.prompt('Modifier', it.text); fin(); if (t2 && t2.trim()) { it.text = t2.trim(); it.maj = Date.now(); sauver(); } }
      else if (a === 'suppr') { fin(); etat.items = etat.items.filter(function (x) { return x.id !== id; }); sauver(); }
      else fin();
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cap-toggle],[data-cap-menu],[data-cap-add],[data-cap-valider],[data-cap-open],[data-cap-close],[data-cap-tab],[data-cap-offre-ajout],[data-cap-offre-suppr],[data-cap-plan-lire],[data-cap-plan-ok],[data-cap-plan-export],[data-cap-idee-ajout],[data-cap-idees-export],[data-cap-micro],[data-cap-idee-menu],[data-cap-detail],[data-cap-copier],[data-cap-plie],[data-cap-etape]');
    if (!t) { if (e.target && e.target.id === 'cap-overlay') fermer(); return; }
    e.preventDefault();
    if (t.hasAttribute('data-cap-toggle')) {
      var it = trouver(t.getAttribute('data-cap-toggle'));
      if (it) { it.done = !it.done; it.maj = Date.now(); if (it.done) it.orig = null; sauver(); }
    } else if (t.hasAttribute('data-cap-menu')) menu(t.getAttribute('data-cap-menu'));
    else if (t.hasAttribute('data-cap-add')) ouvrirForm(t.parentNode, t.getAttribute('data-cap-add'), t.getAttribute('data-cap-date'));
    else if (t.hasAttribute('data-cap-valider')) valider(t.closest('[data-cap-formzone]'), t.getAttribute('data-cap-valider'));
    else if (t.hasAttribute('data-cap-open')) ouvrir(t.getAttribute('data-cap-open'), t.getAttribute('data-cap-jour'));
    else if (t.hasAttribute('data-cap-close')) fermer();
    else if (t.hasAttribute('data-cap-tab')) { onglet = t.getAttribute('data-cap-tab'); apercu = null; remplirPanneau(); var b = panneau().querySelector('.cap-body'); if (b) b.scrollTop = 0; }
    else if (t.hasAttribute('data-cap-offre-ajout')) {
      var titre = document.getElementById('cap-o-titre').value.trim(), d1 = document.getElementById('cap-o-debut').value, d2 = document.getElementById('cap-o-fin').value;
      var msg = document.getElementById('cap-o-msg');
      if (!titre || !d1 || !d2) { msg.textContent = 'Il faut un titre, un début et une fin.'; return; }
      if (d2 < d1) { msg.textContent = 'La fin est avant le début.'; return; }
      etat.offres.push({ id: uid(), titre: titre, debut: d1, fin: d2 }); sauver();
    }
    else if (t.hasAttribute('data-cap-offre-suppr')) {
      var id = t.getAttribute('data-cap-offre-suppr');
      if (window.confirm('Supprimer cette offre ?')) { etat.offres = etat.offres.filter(function (o) { return o.id !== id; }); sauver(); }
    }
    else if (t.hasAttribute('data-cap-plan-lire')) { apercu = lirePlan(document.getElementById('cap-plan-txt').value); remplirPanneau(); }
    else if (t.hasAttribute('data-cap-plan-ok')) appliquerPlan();
    else if (t.hasAttribute('data-cap-idee-ajout')) ajouterIdee();
    else if (t.hasAttribute('data-cap-idees-export')) copier(t, exporterIdees(), 'Copier mes idées');
    else if (t.hasAttribute('data-cap-micro')) micro(t);
    else if (t.hasAttribute('data-cap-idee-menu')) menuIdee(t.getAttribute('data-cap-idee-menu'));
    else if (t.hasAttribute('data-cap-detail')) { var idd = t.getAttribute('data-cap-detail'); ouverts[idd] = !ouverts[idd]; rendre(); }
    else if (t.hasAttribute('data-cap-copier')) copier(t, copieBlocs[t.getAttribute('data-cap-copier')] || '', 'Copier le texte');
    else if (t.hasAttribute('data-cap-plie')) { var kp = t.getAttribute('data-cap-plie'); ouverts[kp] = !ouverts[kp]; rendre(); }
    else if (t.hasAttribute('data-cap-etape')) {
      var ie = trouver(t.getAttribute('data-cap-etape')), ce = t.getAttribute('data-cap-cle');
      if (ie) { ie.etapes = ie.etapes || {}; if (ie.etapes[ce]) delete ie.etapes[ce]; else ie.etapes[ce] = true; ie.maj = Date.now(); sauver(); }
    }
    else if (t.hasAttribute('data-cap-plan-export')) {
      var txt = exporterSemaine();
      var fini = function () { t.textContent = 'Copié ✓'; setTimeout(function () { t.textContent = 'Copier ma semaine'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(fini, function () { window.prompt('Copie ce texte', txt); });
      else window.prompt('Copie ce texte', txt);
    }
  }, true);

  document.addEventListener('change', function (e) {
    var r = e.target && e.target.getAttribute && e.target.getAttribute('data-cap-rythme');
    if (r === null || r === undefined) return;
    etat.rythme[r] = e.target.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    sauver();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panneau()) fermer(); });

  /* Re-pose la carte quand l'appli redessine l'écran (changement d'onglet, de profil…). */
  function demarrer() {
    styleOk(); normaliser(); carteOk();
    var root = document.getElementById('root') || document.body;
    var prevu = false;
    new MutationObserver(function () {
      if (rendering || prevu) return;
      prevu = true;
      requestAnimationFrame(function () { prevu = false; carteOk(); });
    }).observe(root, { childList: true, subtree: true });
    tirer().then(chargerPlanHub);
    /* lien direct : …/gestion-du-temps/#ma-semaine ouvre le panneau */
    if (/ma-semaine/.test(location.hash)) setTimeout(function () { ouvrir(/plan/.test(location.hash) ? 'plan' : 'semaine'); }, 300);
    else if (/idee/.test(location.hash)) setTimeout(function () { ouvrir('idees'); }, 300);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { tirer().then(chargerPlanHub); rendre(); } });
    var jour = today();
    setInterval(function () { if (today() !== jour) { jour = today(); rendre(); } }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
