// Trousseau — téléphone (lecture seule). Même synchronisation que Boussole, Atelier et Révisions :
// lit les fichiers sync/<appareil>.json du dépôt de données privé ; pour chaque rubrique, la plus récente gagne.
// Tout est chiffré (AES-256-GCM, clé du coffre reçue par le QR code, lui-même chiffré par un code à 8 caractères).
// Sur le téléphone, l'accès (dépôt, jeton, clé du coffre) est rangé chiffré par TON code à 4-6 chiffres.
'use strict';
const VERSION = '1.2.0';
const API = (() => { try { return localStorage.getItem('ghapi') || 'https://api.github.com'; } catch (_) { return 'https://api.github.com'; } })();
const ITER = 300000;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cl = '') => `<svg class="i ${cl}"><use href="#i-${n}"/></svg>`;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('trousseau.' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('trousseau.' + k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem('trousseau.' + k); } catch (_) {} }
};

// ------------------------------------------------------------------ chiffrement (WebCrypto)
const enc = new TextEncoder(), dec = new TextDecoder();
function b64u(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function deb64u(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = atob(s), o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; }
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function cleMotDePasse(secret, sel) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function dechiffrer(cle, { iv, c }) { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64u(iv) }, cle, deb64u(c)))); }
async function chiffrer(cle, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv: b64u(iv), c: b64u(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, enc.encode(JSON.stringify(obj)))) }; }
async function empreinte(t) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(t))).slice(0, 22); }

// ------------------------------------------------------------------ état
let ACCES = null;        // { d, t, k, n } en mémoire seulement, après le code
let CLE = null;          // CryptoKey du coffre
let DON = { comptes: [], cles: [], appareils: [], maj: 0 };
const U = { onglet: 'cles', recherche: '', filtre: '', pile: [], fiche: null, voir: false, etag: null, sync: { ok: true, msg: '', en: false } };
let lienEnAttente = (location.hash.match(/#a=([A-Za-z0-9_-]+)/) || [])[1] || null;
let derniereActivite = Date.now(), cacheA = 0;

const serv = id => CAT.service(id);
const compte = id => DON.comptes.find(c => c.id === id);
const pluriel = (n, m) => n + ' ' + m + (n > 1 ? 's' : '');
function depuis(t) {
  if (!t) return 'jamais'; const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'à l’instant'; if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min'; if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return 'le ' + new Date(t).toLocaleDateString('fr-FR');
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.m); toast.m = setTimeout(() => el.classList.remove('on'), 2200); }
const vibrer = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };
const estIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const autonome = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

// ------------------------------------------------------------------ démarrage
async function demarrer() {
  if (!window.crypto || !crypto.subtle) { $('#app').innerHTML = `<div class="plein"><h1>Navigateur non compatible</h1><p>Ouvre cette page dans Safari (iPhone) ou Chrome (Android).</p></div>`; return; }
  const stocke = LS.get('acces', null);
  if (!lienEnAttente && !stocke) { const m = document.cookie.match(/(?:^|; )trousseau_a=([A-Za-z0-9_-]+)/); if (m) lienEnAttente = m[1]; }
  if (lienEnAttente && estIOS && !autonome) {
    // garder le lien pour l'icône de l'écran d'accueil (iOS copie les cookies ; sans manifeste, l'icône garde l'adresse)
    try { document.cookie = 'trousseau_a=' + lienEnAttente + '; max-age=3600; path=/; secure; samesite=strict'; } catch (_) {}
    const man = document.querySelector('link[rel=manifest]'); if (man) man.remove();
  }
  if (lienEnAttente) {
    const e = await empreinte(lienEnAttente);
    if (!stocke || stocke.lien !== e) return ecranAssociation(stocke);
  }
  if (!stocke) return ecranAccueil();
  ecranVerrou();
}

function ecranAccueil() {
  $('#feuille').innerHTML = '';
  $('#app').innerHTML = `<div class="plein"><img src="icon-192.png" alt=""><h1>Trousseau</h1>
    <p>Tes clés API et tes adresses, sur ton téléphone.</p>
    <div class="etapes"><div>1. Sur ton PC, ouvre <b>Trousseau › Réglages › Synchro</b>.</div><div>2. Clique sur <b>Associer</b> (Téléphone).</div><div>3. Touche <b>Scanner le QR code</b> ci-dessous et vise l’écran du PC.</div></div>
    <button class="btn prim" id="scanner" style="width:100%;max-width:330px;flex:none">${ic('appareil')} Scanner le QR code</button>
    <button class="lien-bas" id="coller">Coller le lien d’association</button></div>`;
  $('#scanner').onclick = scanner;
  $('#coller').onclick = collerLien;
}

// Reçoit un lien d'association (scanné, collé ou ouvert) et passe à l'écran du code.
function recevoirLien(texte) {
  const a = (String(texte || '').match(/#a=([A-Za-z0-9_-]{40,})/) || [])[1];
  if (!a) return false;
  lienEnAttente = a; LS.set('ignoreEcran', true);
  try { history.replaceState(null, '', location.pathname + '#a=' + a); } catch (_) {}
  demarrer(); return true;
}

function collerLien() {
  $('#app').innerHTML = `<div class="plein"><img src="icon-192.png" alt=""><h1>Coller le lien</h1>
    <p>Sur ton PC, clique sur <b>Copier le lien</b> sous le QR code, envoie-le sur ton téléphone, puis colle-le ici.</p>
    <textarea class="champ" id="lien" rows="4" placeholder="https://oiriaure.github.io/trousseau-mobile/#a=…" autocomplete="off" autocapitalize="off" spellcheck="false" style="font-size:14px;letter-spacing:0;text-transform:none;text-align:left"></textarea>
    <div class="erreur" id="err"></div>
    <button class="btn prim" id="ok" style="width:100%;max-width:330px;flex:none">Continuer</button>
    <button class="lien-bas" id="retour">Retour</button></div>`;
  $('#ok').onclick = () => { if (!recevoirLien($('#lien').value)) { $('#err').textContent = 'Ce n’est pas un lien d’association Trousseau.'; vibrer(80); } };
  $('#retour').onclick = demarrer;
}

// ---- lecture du QR code avec l'appareil photo (jsQR, tout se passe sur le téléphone)
let flux = null;
function arreterCamera() { if (flux) { flux.getTracks().forEach(t => t.stop()); flux = null; } }
async function scanner() {
  $('#app').innerHTML = `<div class="plein scan"><h1>Vise le QR code</h1><p>Celui affiché sur ton PC, dans Associer un téléphone.</p>
    <div class="cadre"><video id="video" playsinline muted autoplay></video><span></span></div>
    <div class="erreur" id="err"></div>
    <button class="lien-bas" id="coller">Coller le lien à la place</button><button class="lien-bas" id="annuler">Annuler</button></div>`;
  $('#annuler').onclick = () => { arreterCamera(); demarrer(); };
  $('#coller').onclick = () => { arreterCamera(); collerLien(); };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('#err').textContent = 'Appareil photo indisponible ici : colle le lien à la place.'; return; }
  try { flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
  catch (_) { $('#err').textContent = 'Accès à l’appareil photo refusé. Autorise-le dans les réglages du téléphone, ou colle le lien.'; return; }
  const v = $('#video'); if (!v) return arreterCamera();
  v.srcObject = flux; try { await v.play(); } catch (_) {}
  const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
  const tour = () => {
    if (!flux || !document.body.contains(v)) return arreterCamera();
    if (v.videoWidth) {
      const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      x.drawImage(v, 0, 0, c.width, c.height);
      const im = x.getImageData(0, 0, c.width, c.height);
      const r = window.jsQR && jsQR(im.data, im.width, im.height, { inversionAttempts: 'attemptBoth' });
      if (r && r.data) {
        if (/#a=/.test(r.data)) { vibrer(40); arreterCamera(); recevoirLien(r.data); return; }
        $('#err').textContent = 'Ce QR code n’est pas celui de Trousseau.';
      }
    }
    setTimeout(tour, 200);
  };
  tour();
}

// ---- association : code à 8 caractères, puis choix du code du téléphone
function ecranAssociation(stocke) {
  if (estIOS && !autonome && !LS.get('ignoreEcran', false)) {
    $('#app').innerHTML = `<div class="plein"><img src="icon-192.png" alt=""><h1>Installe d’abord Trousseau</h1>
      <p>Sur iPhone, l’app de l’écran d’accueil a sa propre mémoire : fais l’association depuis l’icône.</p>
      <div class="etapes"><div>1. Touche le bouton <b>Partager</b> (le carré avec la flèche) en bas de Safari.</div><div>2. Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</div><div>3. Ouvre <b>Trousseau</b> depuis l’icône, touche <b>Scanner le QR code</b> et vise de nouveau l’écran du PC.</div></div>
      <button class="lien-bas" id="continuer">Continuer dans Safari quand même</button></div>`;
    $('#continuer').onclick = () => { LS.set('ignoreEcran', true); ecranAssociation(stocke); };
    return;
  }
  $('#app').innerHTML = `<div class="plein"><img src="icon-192.png" alt=""><h1>Associer ce téléphone</h1>
    <p>Tape le code d’association affiché sur ton PC, sous le QR code.</p>
    <input class="champ mono" id="code" maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text">
    <div class="erreur" id="err"></div>
    <button class="btn prim" id="ok" style="width:100%;max-width:330px;flex:none">Associer</button>
    ${stocke ? '<button class="lien-bas" id="garder">Garder l’association actuelle</button>' : ''}</div>`;
  const champ = $('#code');
  champ.oninput = () => { let v = normCode(champ.value).slice(0, 8); if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4); champ.value = v; $('#err').textContent = ''; };
  const ok = async () => {
    if (normCode(champ.value).length !== 8) { $('#err').textContent = 'Le code fait 8 caractères.'; return; }
    $('#ok').textContent = 'Vérification…'; $('#ok').disabled = true;
    try {
      const b = deb64u(lienEnAttente), code = normCode(champ.value);
      const acces = b[0] === 1
        ? await dechiffrer(await cleMotDePasse(code, b.slice(1, 17)), { iv: b64u(b.slice(17, 29)), c: b64u(b.slice(29)) })
        : await (async () => { const env = JSON.parse(dec.decode(b)); return dechiffrer(await cleMotDePasse(code, deb64u(env.s)), env); })();
      choisirCode(acces);
    } catch (_) { $('#err').textContent = 'Code incorrect, ou lien abîmé. Recommence le scan si besoin.'; vibrer(80); $('#ok').textContent = 'Associer'; $('#ok').disabled = false; }
  };
  $('#ok').onclick = ok; champ.onkeydown = e => { if (e.key === 'Enter') ok(); };
  if ($('#garder')) $('#garder').onclick = () => { lienEnAttente = null; history.replaceState(null, '', location.pathname); ecranVerrou(); };
  setTimeout(() => champ.focus(), 200);
}

function choisirCode(acces, changement) {
  let premier = null;
  pave(changement ? 'Nouveau code' : 'Choisis le code du téléphone', changement ? 'De 4 à 6 chiffres.' : 'Il protège tes clés sur ce téléphone. De 4 à 6 chiffres, valide avec ✓.', async (code, refaire) => {
    if (code.length < 4) return refaire('Au moins 4 chiffres.');
    if (premier === null) { premier = code; return refaire('', 'Confirme ce code'); }
    if (code !== premier) { premier = null; return refaire('Les deux codes ne sont pas identiques. Recommence.', changement ? 'Nouveau code' : 'Choisis le code du téléphone'); }
    const sel = crypto.getRandomValues(new Uint8Array(16));
    const boite = await chiffrer(await cleMotDePasse(code, sel), acces);
    const ancien = LS.get('acces', {});
    LS.set('acces', { v: 1, s: b64u(sel), iv: boite.iv, c: boite.c, lien: changement ? ancien.lien : (lienEnAttente ? await empreinte(lienEnAttente) : ancien.lien), associe: changement ? ancien.associe : Date.now(), n: acces.n });
    LS.set('essais', 0);
    if (!changement) { LS.del('fichiers'); U.etag = null; try { document.cookie = 'trousseau_a=; max-age=0; path=/'; history.replaceState(null, '', location.pathname); } catch (_) {} }
    lienEnAttente = null;
    await ouvrir(acces);
    toast(changement ? 'Code changé' : 'Téléphone associé');
  }, true);
}

// ---- pavé numérique (verrou et choix du code)
function pave(titre, sous, fini, avecValider) {
  let code = '';
  $('#feuille').innerHTML = '';
  $('#app').innerHTML = `<div class="plein"><div style="color:var(--bleu)">${ic('cadenas')}</div><h1 id="p-titre">${esc(titre)}</h1><p id="p-sous">${esc(sous)}</p>
    <div class="points" id="pts">${'<i></i>'.repeat(avecValider ? 6 : 6)}</div><div class="erreur" id="p-err"></div>
    <div class="pave">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button class="vide-t" data-n="eff">Effacer</button><button data-n="0">0</button><button class="vide-t" data-n="ok">✓</button></div>
    <div id="p-bas"></div></div>`;
  const maj = () => $$('#pts i').forEach((p, i) => p.classList.toggle('on', i < code.length));
  const refaire = (err, nouveauTitre) => {
    code = ''; maj(); $('#p-err').textContent = err || '';
    if (err) { $('#pts').classList.remove('secoue'); void $('#pts').offsetWidth; $('#pts').classList.add('secoue'); vibrer(120); }
    if (nouveauTitre) $('#p-titre').textContent = nouveauTitre;
  };
  const valider = () => { const c = code; fini(c, refaire); };
  $$('.pave button').forEach(b => b.onclick = () => {
    const n = b.dataset.n;
    if (n === 'eff') code = code.slice(0, -1);
    else if (n === 'ok') return valider();
    else if (code.length < 6) code += n;
    maj();
  });
  document.onkeydown = e => { if (!$('.pave')) return; if (/^\d$/.test(e.key) && code.length < 6) { code += e.key; maj(); } else if (e.key === 'Backspace') { code = code.slice(0, -1); maj(); } else if (e.key === 'Enter') valider(); };
  return { bas: html => { $('#p-bas').innerHTML = html; } };
}

function ecranVerrou() {
  const st = LS.get('acces', null); if (!st) return ecranAccueil();
  ACCES = null; CLE = null; DON = { comptes: [], cles: [], appareils: [], maj: 0 };
  const p = pave('Trousseau', 'Tape le code du téléphone.', async (code, refaire) => {
    if (code.length < 4) return refaire('Au moins 4 chiffres.');
    try {
      const acces = await dechiffrer(await cleMotDePasse(code, deb64u(st.s)), st);
      LS.set('essais', 0); await ouvrir(acces);
    } catch (_) {
      const n = (LS.get('essais', 0) || 0) + 1; LS.set('essais', n);
      if (n >= 10) { oublier(); toast('10 codes faux : association effacée'); return; }
      refaire('Code incorrect' + (n >= 5 ? ' (' + (10 - n) + ' essai' + (10 - n > 1 ? 's' : '') + ' avant effacement)' : '') + '.');
    }
  });
  p.bas('<button class="lien-bas" id="oubli">Code oublié ?</button>');
  $('#oubli').onclick = () => { if (confirm('Effacer l’association de ce téléphone ? Tu pourras la refaire en scannant le QR code sur ton PC.')) { oublier(); } };
}
function oublier() { LS.del('acces'); LS.del('fichiers'); LS.del('essais'); ACCES = null; CLE = null; ecranAccueil(); }

// ------------------------------------------------------------------ données
async function ouvrir(acces) {
  ACCES = acces;
  CLE = await crypto.subtle.importKey('raw', deb64u(acces.k), 'AES-GCM', false, ['decrypt']);
  derniereActivite = Date.now();
  document.onkeydown = null;
  await calculer();
  U.onglet = U.onglet || 'cles'; U.pile = [];
  rendre();
  if (ACCES.t) actualiser(true);
}

// Fusion de tous les appareils : pour chaque rubrique, la plus récente gagne.
async function calculer() {
  const fichiers = LS.get('fichiers', {}), R = {}, appareils = [];
  for (const [chemin, f] of Object.entries(fichiers)) {
    if (!f || !f.contenu || !f.contenu.chiffre) continue;
    let rub; try { rub = await dechiffrer(CLE, f.contenu.chiffre); } catch (_) { continue; }
    appareils.push({ nom: f.contenu.nom, platform: f.contenu.platform, updated: f.contenu.updated, version: f.contenu.version, fichier: chemin.startsWith('fichier:') });
    for (const [rk, x] of Object.entries(rub)) if (x && (!R[rk] || x.t > R[rk].t)) R[rk] = x;
  }
  const comptes = [], cles = [];
  for (const [rk, x] of Object.entries(R)) {
    if (!x.v) continue;
    if (rk[0] === 'c') comptes.push(Object.assign({ id: rk.slice(2) }, x.v));
    else if (rk[0] === 'k') cles.push(Object.assign({ id: rk.slice(2) }, x.v));
  }
  comptes.sort((a, b) => (b.epingle - a.epingle) || (a.nom || a.email).localeCompare(b.nom || b.email, 'fr'));
  cles.sort((a, b) => (b.favori - a.favori) || a.nom.localeCompare(b.nom, 'fr'));
  DON = { comptes, cles, appareils, maj: Math.max(0, ...appareils.map(a => a.updated || 0)) };
}

async function gh(chemin, brut, entetes) {
  return fetch(API + chemin, { cache: 'no-store', headers: Object.assign({ Authorization: 'Bearer ' + ACCES.t, 'X-GitHub-Api-Version': '2022-11-28', Accept: brut ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' }, entetes || {}) });
}
async function actualiser(discret) {
  if (!ACCES || !ACCES.t || U.sync.en) { if (!discret && ACCES && !ACCES.t) toast('Mode fichiers : ouvre un fichier de synchronisation'); return; }
  U.sync.en = true; majEtatSync();
  try {
    const ref = await gh('/repos/' + ACCES.d + '/git/ref/heads/main', false, U.etag ? { 'If-None-Match': U.etag } : {});
    if (ref.status === 304) { U.sync = { ok: true, msg: '', en: false, quand: Date.now() }; majEtatSync(); if (!discret) toast('À jour'); return; }
    if (ref.status === 401) throw new Error('Accès GitHub refusé : associe de nouveau ce téléphone.');
    if (ref.status === 409) throw new Error('Aucun appareil n’a encore envoyé de données.');
    if (!ref.ok) throw new Error('GitHub ne répond pas (' + ref.status + ').');
    U.etag = ref.headers.get('etag');
    const a = await gh('/repos/' + ACCES.d + '/git/trees/main?recursive=1');
    if (!a.ok) throw new Error('GitHub ne répond pas (' + a.status + ').');
    const { tree } = await a.json();
    const fichiers = LS.get('fichiers', {}); let change = false;
    const presents = new Set();
    for (const f of tree || []) {
      if (f.type !== 'blob' || !/^sync\/[A-Za-z0-9_-]+\.json$/.test(f.path)) continue;
      presents.add(f.path);
      if (fichiers[f.path] && fichiers[f.path].sha === f.sha) continue;
      const b = await gh('/repos/' + ACCES.d + '/git/blobs/' + f.sha, true);
      if (!b.ok) continue;
      try { fichiers[f.path] = { sha: f.sha, contenu: JSON.parse(await b.text()) }; change = true; } catch (_) {}
    }
    for (const p of Object.keys(fichiers)) if (!p.startsWith('fichier:') && !presents.has(p)) { delete fichiers[p]; change = true; }
    LS.set('fichiers', fichiers);
    if (change) { await calculer(); rendre(); }
    U.sync = { ok: true, msg: '', en: false, quand: Date.now() };
    if (!discret) toast(change ? 'Mis à jour' : 'À jour');
  } catch (e) {
    U.sync = { ok: false, msg: e.message || 'Hors ligne', en: false, quand: U.sync.quand };
    if (!discret) toast(navigator.onLine ? 'Synchronisation impossible' : 'Hors ligne');
  }
  majEtatSync();
}
function majEtatSync() { const el = $('#etat-sync'); if (el) el.outerHTML = etatSync(); }
function etatSync() {
  const s = U.sync;
  if (s.en) return `<div class="etat-sync" id="etat-sync"><span class="p" style="background:var(--bleu)"></span>Actualisation…</div>`;
  if (!s.ok) return `<div class="etat-sync err" id="etat-sync"><span class="p"></span>${esc(navigator.onLine ? s.msg : 'Hors ligne — dernières données gardées')}</div>`;
  return `<div class="etat-sync" id="etat-sync"><span class="p"></span>${ACCES && ACCES.t ? 'Synchronisé' : 'Fichier'} · données du ${esc(DON.maj ? new Date(DON.maj).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—')}</div>`;
}

// ------------------------------------------------------------------ écrans principaux
function rendre() {
  if (!ACCES) return;
  if (U.pile.length) return rendrePile();
  const vues = { cles: vueCles, favoris: vueFavoris, adresses: vueAdresses, reglages: vueReglages };
  $('#app').innerHTML = `<div class="ecran" id="ecran">${vues[U.onglet]()}</div>${barreOnglets()}`;
  brancher();
}
function barreOnglets() {
  const o = [['cles', 'cle', 'Clés'], ['favoris', 'etoile', 'Favorites'], ['adresses', 'mail', 'Adresses'], ['reglages', 'reglages', 'Réglages']];
  return `<nav class="onglets">${o.map(([id, i, t]) => `<button data-onglet="${id}" class="${U.onglet === id ? 'on' : ''}" aria-label="${t}">${ic(i)}${t}</button>`).join('')}</nav>`;
}
function ligneCle(k, avecAdresse = true) {
  const s = serv(k.service), c = compte(k.compteId);
  return `<button class="l" data-cle="${esc(k.id)}"><div class="badge" style="background:${s.couleur}">${esc(s.lettre)}</div>
    <div class="txt"><div class="n">${k.favori ? `<svg class="i etoile"><use href="#i-etoile"/></svg> ` : ''}${esc(k.nom)}</div><div class="s">${esc(avecAdresse ? (c ? (c.nom || c.email) : s.court) : s.nom)}${k.usage ? ' · ' + esc(k.usage) : ''}</div></div>
    <div class="fin"><span class="point ${esc(k.etat ? k.etat.code : '')}"></span>${ic('chevron')}</div></button>`;
}
function filtrer(l) {
  const t = U.recherche.trim().toLowerCase();
  return l.filter(k => (!U.filtre || k.service === U.filtre) && (!t || [k.nom, k.usage, k.notes, serv(k.service).nom, (compte(k.compteId) || {}).email, (compte(k.compteId) || {}).nom].join(' ').toLowerCase().includes(t)));
}
function vueCles() {
  if (!DON.cles.length) return `<div class="entete"><h1>Clés</h1><button class="act" data-act="actualiser" aria-label="Actualiser">${ic('actualiser')}</button></div>${etatSync()}
    <div class="vide"><b>Aucune clé pour l’instant</b>${ACCES.t ? 'Les clés de ton PC arrivent dès qu’il a synchronisé. Tire vers le bas pour actualiser.' : 'Ouvre un fichier de synchronisation dans les Réglages.'}</div>`;
  const services = [...new Set(DON.cles.map(k => k.service))];
  const l = filtrer(DON.cles);
  return `<div class="entete"><h1>Clés</h1><button class="act" data-act="actualiser" aria-label="Actualiser">${ic('actualiser')}</button></div>${etatSync()}
    <div class="recherche">${ic('chercher')}<input id="recherche" type="search" placeholder="Rechercher" value="${esc(U.recherche)}" autocomplete="off"></div>
    ${services.length > 1 ? `<div class="puces"><button class="puce ${!U.filtre ? 'on' : ''}" data-filtre="">Toutes</button>${services.map(id => `<button class="puce ${U.filtre === id ? 'on' : ''}" data-filtre="${id}">${esc(serv(id).court)}</button>`).join('')}</div>` : ''}
    <div id="liste">${listeCles(l)}</div>`;
}
function listeCles(l) { return l.length ? `<div class="groupe">${l.map(k => ligneCle(k)).join('')}</div><div class="titre-groupe" style="text-align:center;text-transform:none">${pluriel(l.length, 'clé')}</div>` : `<div class="vide"><b>Aucun résultat</b>Change ta recherche.</div>`; }
function vueFavoris() {
  const l = DON.cles.filter(k => k.favori);
  return `<div class="entete"><h1>Favorites</h1></div>${etatSync()}${l.length ? `<div class="groupe">${l.map(k => ligneCle(k)).join('')}</div>` : `<div class="vide"><b>Aucune favorite</b>Sur ton PC, touche l’étoile ☆ d’une clé : elle apparaît ici en premier.</div>`}`;
}
function vueAdresses() {
  const l = DON.comptes;
  return `<div class="entete"><h1>Adresses</h1></div>${etatSync()}${l.length ? `<div class="groupe">${l.map(c => {
    const n = DON.cles.filter(k => k.compteId === c.id).length;
    return `<button class="l" data-compte="${esc(c.id)}"><div class="av" style="background:${esc(c.couleur || '#5B8CFF')}">${esc(((c.nom || c.email)[0] || '?').toUpperCase())}</div>
      <div class="txt"><div class="n">${esc(c.nom || c.email)}</div><div class="s">${c.nom ? esc(c.email) : esc((CAT.messagerie(c.email) || {}).nom || 'Messagerie')}</div></div><div class="fin">${n}${ic('chevron')}</div></button>`;
  }).join('')}</div>` : `<div class="vide"><b>Aucune adresse</b>Ajoute tes adresses dans Trousseau sur ton PC.</div>`}`;
}
function vueReglages() {
  const st = LS.get('acces', {}), verrou = LS.get('verrou', 5);
  return `<div class="entete"><h1>Réglages</h1></div>
    <div class="titre-groupe">Synchronisation</div>
    <div class="groupe">
      <div class="info"><span>Source</span><span>${ACCES.t ? esc(ACCES.d) : 'Fichiers'}</span></div>
      <div class="info"><span>Associé à</span><span>${esc(ACCES.n || 'ton PC')} · ${esc(depuis(st.associe))}</span></div>
      <div class="info"><span>Dernières données</span><span>${esc(DON.maj ? depuis(DON.maj) : '—')}</span></div>
      ${DON.appareils.map(a => `<div class="info"><span>${esc(a.nom || 'Appareil')}</span><span>${esc(a.fichier ? 'fichier' : ({ windows: 'PC Windows', darwin: 'Mac', linux: 'Linux' }[a.platform] || a.platform || ''))} · ${esc(depuis(a.updated))}</span></div>`).join('')}
    </div>
    <div class="boutons" style="margin-top:10px">${ACCES.t ? `<button class="btn" data-act="actualiser">${ic('actualiser')} Actualiser</button>` : ''}<button class="btn" data-act="fichier">Ouvrir un fichier…</button></div>
    <input type="file" id="f-fichier" accept=".trousseau-sync,application/json" class="cache">
    <div class="titre-groupe">Sécurité</div>
    <div class="groupe">
      <label class="info"><span>Verrouiller après</span><span><select class="choix" id="r-verrou">${[[1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes']].map(([v, t]) => `<option value="${v}" ${v === verrou ? 'selected' : ''}>${t}</option>`).join('')}</select></span></label>
      <button class="l" data-act="changer-code" style="min-height:46px"><div class="txt">Changer le code</div>${ic('chevron')}</button>
      <button class="l" data-act="verrouiller" style="min-height:46px"><div class="txt">Verrouiller maintenant</div>${ic('cadenas')}</button>
    </div>
    <div class="titre-groupe" style="text-transform:none">Ton téléphone ne fait que lire : il ne modifie jamais tes clés. Pour en ajouter ou en changer, utilise Trousseau sur ton PC.</div>
    <div class="groupe" style="margin-top:14px"><button class="l" data-act="dissocier" style="min-height:46px"><div class="txt" style="color:var(--rouge)">Dissocier ce téléphone</div></button></div>
    <div class="titre-groupe" style="text-align:center;text-transform:none">Trousseau téléphone ${VERSION}</div>`;
}

// ---- écrans poussés (une adresse)
function rendrePile() {
  const h = U.pile[U.pile.length - 1];
  if (h.type === 'compte') {
    const c = compte(h.id); if (!c) { U.pile.pop(); return rendre(); }
    const l = DON.cles.filter(k => k.compteId === c.id), m = CAT.messagerie(c.email);
    const boite = m && m.id === 'gmail' ? 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(c.email) : (c.urlMail || (m && m.boite));
    $('#app').innerHTML = `<div class="ecran" id="ecran"><div class="nav"><button class="retour" data-act="retour">${ic('retour')} Adresses</button></div>
      <div class="tete"><div class="av grand" style="background:${esc(c.couleur || '#5B8CFF')}">${esc(((c.nom || c.email)[0] || '?').toUpperCase())}</div><h2>${esc(c.nom || c.email)}</h2><div class="s">${c.nom ? esc(c.email) + ' · ' : ''}${esc((m || {}).nom || 'Messagerie')}</div></div>
      ${boite ? `<div class="boutons"><a class="btn" href="${esc(boite)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">${ic('mail')} Ouvrir la boîte mail</a></div>` : ''}
      <div class="titre-groupe">${pluriel(l.length, 'clé')}</div>
      ${l.length ? `<div class="groupe">${l.map(k => ligneCle(k, false)).join('')}</div>` : '<div class="vide" style="padding-top:20px">Aucune clé pour cette adresse.</div>'}</div>${barreOnglets()}`;
    brancher();
  }
}

// ---- fiche d'une clé (feuille du bas)
async function fiche(id) {
  const k = DON.cles.find(x => x.id === id); if (!k) return;
  U.fiche = id; U.voir = false;
  const s = serv(k.service), c = compte(k.compteId);
  const etats = { ok: 'Fonctionne', quota: 'Quota atteint', invalide: 'Refusée', reseau: 'Hors ligne', erreur: 'Erreur du service', inconnu: 'Non vérifiable' };
  const apercu = k.s.length <= 12 ? '••••' + k.s.slice(-2) : k.s.slice(0, Math.min(7, k.s.length - 6)) + '••••' + k.s.slice(-4);
  $('#feuille').innerHTML = `<div class="voile" data-act="fermer"></div><div class="sheet" role="dialog" aria-label="${esc(k.nom)}"><div class="poignee"></div><button class="ferme" data-act="fermer">OK</button>
    <div class="tete"><div class="badge grand" style="background:${s.couleur}">${esc(s.lettre)}</div><h2>${esc(k.nom)}</h2><div class="s">${esc(s.nom)}</div></div>
    <div class="secret mono" id="secret">${esc(apercu)}</div>
    <div class="boutons" style="margin-top:12px"><button class="btn prim" data-act="copier">${ic('copier')} Copier</button><button class="btn" data-act="voir">${ic('oeil')} <span id="voir-t">Afficher</span></button></div>
    <div class="boutons"><button class="btn" data-act="copier-env" style="font-size:15px">Copier ${esc(s.env)}=…</button></div>
    <div class="groupe" style="margin-top:14px">
      <div class="info"><span>État</span><span><span class="point ${esc(k.etat ? k.etat.code : '')}" style="display:inline-block;margin-right:6px"></span>${esc(k.etat ? (etats[k.etat.code] || k.etat.texte) : 'Pas encore vérifiée')}</span></div>
      <div class="info"><span>Adresse</span><span>${esc(c ? c.email : 'Sans adresse')}</span></div>
      ${k.usage ? `<div class="info"><span>Utilisée pour</span><span>${esc(k.usage)}</span></div>` : ''}
      ${k.notes ? `<div class="info"><span>Notes</span><span>${esc(k.notes)}</span></div>` : ''}
      <div class="info"><span>Ajoutée</span><span>${esc(k.cree ? new Date(k.cree).toLocaleDateString('fr-FR') : '—')}</span></div>
    </div>
    ${s.page ? `<div class="groupe" style="margin-top:14px"><a class="l" href="${esc(s.page)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:var(--bleu);min-height:46px"><div class="txt">Gérer sur le site ${esc(s.court)}</div>${ic('lien')}</a></div>` : ''}
  </div>`;
  const F = $('#feuille');
  $$('[data-act=fermer]', F).forEach(b => b.onclick = fermerFiche);
  $('[data-act=copier]', F).onclick = () => copier(k.s, 'Clé copiée');
  $('[data-act=copier-env]', F).onclick = () => copier(s.env + '=' + k.s, s.env + ' copié');
  $('[data-act=voir]', F).onclick = () => { U.voir = !U.voir; $('#secret').textContent = U.voir ? k.s : apercu; $('#voir-t').textContent = U.voir ? 'Masquer' : 'Afficher'; };
}
function fermerFiche() { U.fiche = null; $('#feuille').innerHTML = ''; }
async function copier(texte, msg) {
  let fait = false;
  try { await navigator.clipboard.writeText(texte); fait = true; } catch (_) {}
  if (!fait) {   // repli (anciens navigateurs, page sans focus)
    const t = document.createElement('textarea'); t.value = texte; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, texte.length);
    try { fait = document.execCommand('copy'); } catch (_) {}
    t.remove();
  }
  if (fait) { vibrer(15); toast(msg); } else toast('Copie refusée par le navigateur');
}

// ------------------------------------------------------------------ évènements
function brancher() {
  const a = $('#app');
  $$('[data-onglet]', a).forEach(b => b.onclick = () => { U.onglet = b.dataset.onglet; U.pile = []; rendre(); $('#ecran').scrollTop = 0; });
  $$('[data-cle]', a).forEach(b => b.onclick = () => fiche(b.dataset.cle));
  $$('[data-compte]', a).forEach(b => b.onclick = () => { U.pile.push({ type: 'compte', id: b.dataset.compte }); rendre(); });
  $$('[data-filtre]', a).forEach(b => b.onclick = () => { U.filtre = b.dataset.filtre; rendre(); });
  const r = $('#recherche', a); if (r) r.oninput = () => { U.recherche = r.value; $('#liste').innerHTML = listeCles(filtrer(DON.cles)); $$('#liste [data-cle]').forEach(b => b.onclick = () => fiche(b.dataset.cle)); };
  const act = (n, fn) => $$(`[data-act=${n}]`, a).forEach(b => b.onclick = fn);
  act('actualiser', () => { U.etag = null; actualiser(false); });
  act('retour', () => { U.pile.pop(); rendre(); });
  act('verrouiller', () => ecranVerrou());
  act('changer-code', () => {
    const p = pave('Code actuel', 'Pour changer le code du téléphone.', async (code, refaire) => {
      const st = LS.get('acces', null);
      try { const acces = await dechiffrer(await cleMotDePasse(code, deb64u(st.s)), st); choisirCode(acces, true); } catch (_) { refaire('Code incorrect.'); }
    });
    p.bas('<button class="lien-bas" id="annuler">Annuler</button>'); $('#annuler').onclick = () => rendre();
  });
  act('dissocier', () => { if (confirm('Dissocier ce téléphone ? Les clés seront effacées de ce téléphone (elles restent sur ton PC).')) oublier(); });
  act('fichier', () => $('#f-fichier').click());
  const f = $('#f-fichier', a);
  if (f) f.onchange = async () => {
    const x = f.files[0]; if (!x) return;
    try {
      const contenu = JSON.parse(await x.text());
      await dechiffrer(CLE, contenu.chiffre);   // vérifie que c'est bien notre coffre
      const fichiers = LS.get('fichiers', {}); fichiers['fichier:' + (contenu.device || 'pc')] = { sha: null, contenu }; LS.set('fichiers', fichiers);
      await calculer(); rendre(); toast('Fichier ouvert');
    } catch (_) { toast('Fichier illisible ou d’un autre coffre'); }
  };
  const v = $('#r-verrou', a); if (v) v.onchange = () => LS.set('verrou', +v.value);
  tirerPourActualiser();
}

// tirer vers le bas pour actualiser
function tirerPourActualiser() {
  const e = $('#ecran'); if (!e) return;
  let y0 = null;
  e.addEventListener('touchstart', ev => { y0 = e.scrollTop <= 0 ? ev.touches[0].clientY : null; }, { passive: true });
  e.addEventListener('touchend', ev => { if (y0 !== null && ev.changedTouches[0].clientY - y0 > 90) { U.etag = null; actualiser(false); } y0 = null; }, { passive: true });
}

// verrouillage automatique (inactivité, ou application quittée)
['touchstart', 'keydown', 'mousedown'].forEach(t => document.addEventListener(t, () => { derniereActivite = Date.now(); }, { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cacheA = Date.now(); return; }
  if (ACCES && Date.now() - (cacheA || Date.now()) > LS.get('verrou', 5) * 60000) return ecranVerrou();
  if (ACCES && ACCES.t) actualiser(true);
});
setInterval(() => { if (ACCES && Date.now() - derniereActivite > LS.get('verrou', 5) * 60000) ecranVerrou(); }, 15000);
setInterval(() => { if (ACCES && ACCES.t && !document.hidden) actualiser(true); }, 60000);
window.addEventListener('online', () => { if (ACCES && ACCES.t) actualiser(true); });

// lien d'association ouvert alors que la page est déjà ouverte
window.addEventListener('hashchange', () => {
  const a = (location.hash.match(/#a=([A-Za-z0-9_-]+)/) || [])[1];
  if (a && a !== lienEnAttente) { lienEnAttente = a; ACCES = null; CLE = null; fermerFiche(); demarrer(); }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
demarrer();
