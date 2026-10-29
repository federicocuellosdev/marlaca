/* Consentimiento de cookies y carga condicionada del seguimiento (Marlaca Real Estate).
 *
 * Sin consentimiento NO se carga nada de googletagmanager.com ni de connect.facebook.net,
 * no se llama a gtag/fbq y no se escribe ninguna cookie de analítica o publicidad.
 *  - Analítica   -> Google Analytics 4 (gtag.js)
 *  - Publicidad  -> Meta Pixel + API de conversiones (break-api /marlaca/capi) + evento Engagement
 * La decisión se guarda en localStorage (clave mrl_consent) 13 meses y se vuelve a pedir si cambia VERSION.
 * Los textos llegan en <script type="application/json" id="mrl-consent-txt"> (los inyecta fuente/generar.py).
 * Expone window.MRL = { consent(), abrir(), cookie(nombre), capi(cuerpo) } para el resto de scripts.
 */
(function () {
  'use strict';

  var GA_ID = 'G-CHY8EL3KB8';
  var PX_ID = '1072809952125181';
  var CAPI_URL = 'https://break-api.onrender.com/marlaca/capi';
  var KEY = 'mrl_consent';
  var VERSION = 1;            // subir este número obliga a volver a pedir el consentimiento
  var MESES = 13;             // caducidad de la decisión
  var ENG_UMBRAL = 40;        // segundos de tiempo activo para el evento Engagement
  var ENG_T = 'mrl_eng_s', ENG_F = 'mrl_eng_fired';

  var doc = document, root = doc.documentElement;
  var pagina = root.getAttribute('data-pagina') || '';
  var T = {};
  try { T = JSON.parse(doc.getElementById('mrl-consent-txt').textContent); } catch (e) { T = {}; }

  /* ---------- almacenamiento de la decisión ---------- */
  function caduca(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return true;
    d.setMonth(d.getMonth() + MESES);
    return Date.now() > d.getTime();
  }
  function leer() {
    try {
      var r = localStorage.getItem(KEY);
      if (!r) return null;
      var o = JSON.parse(r);
      if (!o || o.v !== VERSION || typeof o.a !== 'boolean' || typeof o.m !== 'boolean' || caduca(o.t)) return null;
      return o;
    } catch (e) { return null; }
  }
  function escribir(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sin almacenamiento: vale solo para esta página */ } }

  var estado = leer();                                  // null = sin decisión vigente
  function perm() { return { a: !!(estado && estado.a), m: !!(estado && estado.m) }; }

  /* ---------- cookies ---------- */
  function cookie(nombre) {
    var m = doc.cookie.match(new RegExp('(?:^|; )' + nombre + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  function dominios() {
    var h = location.hostname, out = [undefined, h, '.' + h], p = h.split('.');
    if (/^\d+(\.\d+){3}$/.test(h) || p.length < 2) return out;
    for (var i = 1; i < p.length - 1; i++) out.push('.' + p.slice(i).join('.'));
    return out;
  }
  function borrar(re) {
    var nombres = doc.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); }).filter(function (n) { return re.test(n); });
    var ds = dominios();
    nombres.forEach(function (n) {
      ds.forEach(function (d) {
        doc.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }
  var RE_GA = /^(_ga(_.+)?|_gid|_gat(_.+)?)$/, RE_FB = /^(_fbp|_fbc)$/;

  /* ---------- Google Analytics 4 (solo con consentimiento de analítica) ---------- */
  var gaCargado = false;
  function gaActivar() {
    window['ga-disable-' + GA_ID] = false;
    if (gaCargado) { if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    gaCargado = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', GA_ID);
    var s = doc.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    doc.head.appendChild(s);
  }
  function gaDesactivar() {
    window['ga-disable-' + GA_ID] = true;
    if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    borrar(RE_GA);
  }

  /* ---------- Meta Pixel (solo con consentimiento de publicidad) ---------- */
  var pxCargado = false;
  function pxActivar() {
    if (pxCargado) { if (window.fbq) window.fbq('consent', 'grant'); return; }
    pxCargado = true;
    /* Fragmento oficial de Meta Pixel */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, doc, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PX_ID);
    window.fbq('track', 'PageView');
    if (pagina === 'agendar') window.fbq('track', 'ViewContent', { content_name: 'agendar-llamada', content_category: 'lead-form' });
  }
  function pxDesactivar() {
    if (window.fbq) window.fbq('consent', 'revoke');
    borrar(RE_FB);
  }

  /* ---------- Engagement: 40 s de tiempo activo (Pixel + CAPI), solo con publicidad ---------- */
  var eng = { iv: null, total: 0, start: 0, parado: false, on: false, vis: false };
  function engTotal() { return eng.parado ? eng.total : eng.total + Math.floor((Date.now() - eng.start) / 1000); }
  function engDisparar() {
    try { if (sessionStorage.getItem(ENG_F) === '1') return; sessionStorage.setItem(ENG_F, '1'); } catch (e) { return; }
    var eventId = 'eng_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    var custom = { threshold_seconds: ENG_UMBRAL, page: location.pathname };
    if (window.fbq) { window.fbq('trackCustom', 'Engagement', custom, { eventID: eventId }); }
    capi({
      event_name: 'Engagement', event_id: eventId, event_source_url: location.href,
      user_data: { fbp: cookie('_fbp'), fbc: cookie('_fbc') },
      custom_data: custom
    });
  }
  function engTick() {
    if (!perm().m) { engParar(true); return; }
    var c = engTotal();
    try { sessionStorage.setItem(ENG_T, String(c)); } catch (e) { /* ignorar */ }
    if (c >= ENG_UMBRAL) { engDisparar(); engParar(false); }
  }
  function engIniciar() {
    if (eng.on) return;
    try { if (sessionStorage.getItem(ENG_F) === '1') return; eng.total = parseInt(sessionStorage.getItem(ENG_T) || '0', 10) || 0; } catch (e) { return; }
    eng.start = Date.now(); eng.parado = doc.hidden; eng.on = true;
    eng.iv = setInterval(engTick, 1000);
    if (!eng.vis) {
      eng.vis = true;
      doc.addEventListener('visibilitychange', function () {
        if (!eng.on) return;
        if (doc.hidden) { eng.total = engTotal(); try { sessionStorage.setItem(ENG_T, String(eng.total)); } catch (e) { /* ignorar */ } eng.parado = true; }
        else { eng.start = Date.now(); eng.parado = false; }
      });
    }
  }
  function engParar(limpiar) {
    if (eng.iv) { clearInterval(eng.iv); eng.iv = null; }
    eng.on = false;
    if (limpiar) { try { sessionStorage.removeItem(ENG_T); sessionStorage.removeItem(ENG_F); } catch (e) { /* ignorar */ } }
  }

  /* ---------- API de conversiones: solo con consentimiento de publicidad ---------- */
  function capi(cuerpo) {
    if (!perm().m) return false;
    try {
      fetch(CAPI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(cuerpo) }).catch(function () {});
    } catch (e) { return false; }
    return true;
  }

  /* ---------- aplicar el estado vigente (idempotente; sirve también si el consentimiento llega más tarde) ---------- */
  function aplicar() {
    var p = perm();
    if (p.a) gaActivar(); else gaDesactivar();          // sin analítica: bloquea gtag y borra _ga*
    if (p.m) { pxActivar(); engIniciar(); }
    else { engParar(true); pxDesactivar(); }             // sin publicidad: revoca el Pixel y borra _fbp/_fbc
    try { doc.dispatchEvent(new CustomEvent('mrl:consent', { detail: p })); } catch (e) { /* IE */ }
  }
  function decidir(a, m) {
    estado = { v: VERSION, t: new Date().toISOString(), a: !!a, m: !!m };
    escribir(estado);
    aplicar();
    cerrarTodo();
  }

  /* ---------- interfaz ---------- */
  var banner = null, panel = null, ultimoFoco = null;
  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function boton(cls, texto, fn) {
    var b = el('button', 'mrl-btn ' + cls); b.type = 'button'; b.textContent = texto; b.addEventListener('click', fn); return b;
  }
  function enlacePolitica() { return '<a href="' + (T.politica_url || '#') + '">' + T.politica_enlace + '</a>'; }

  function crearBanner() {
    banner = el('div', 'mrl-cb');
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'mrl-cb-t');
    banner.setAttribute('aria-describedby', 'mrl-cb-d');
    banner.setAttribute('aria-label', T.titulo);
    banner.hidden = true;
    var txt = el('div', 'mrl-cb__txt');
    txt.appendChild(el('h2', 'mrl-cb__t', T.titulo)).id = 'mrl-cb-t';
    var p = el('p', 'mrl-cb__d', T.texto + ' ' + enlacePolitica());
    p.id = 'mrl-cb-d';
    txt.appendChild(p);
    var bs = el('div', 'mrl-cb__bs');
    /* Aceptar y Rechazar: misma clase, mismo tamaño, mismo peso visual */
    bs.appendChild(boton('mrl-btn--pri', T.aceptar, function () { decidir(true, true); }));
    bs.appendChild(boton('mrl-btn--pri', T.rechazar, function () { decidir(false, false); }));
    bs.appendChild(boton('mrl-btn--sec', T.configurar, function () { abrirPanel(); }));
    banner.appendChild(txt); banner.appendChild(bs);
    doc.body.appendChild(banner);
  }
  function mostrarBanner() { if (!banner) crearBanner(); banner.hidden = false; root.classList.add('mrl-cb-abierto'); }
  function ocultarBanner() { if (banner) banner.hidden = true; root.classList.remove('mrl-cb-abierto'); }

  function fila(id, titulo, desc, marcado, fijo, etiquetaFija) {
    var f = el('div', 'mrl-cat');
    var cab = el('div', 'mrl-cat__cab');
    var lab = el(fijo ? 'span' : 'label', 'mrl-cat__t');
    if (!fijo) lab.setAttribute('for', id);
    lab.appendChild(doc.createTextNode(titulo));
    cab.appendChild(lab);
    if (fijo) {
      cab.appendChild(el('span', 'mrl-cat__fijo', etiquetaFija));
    } else {
      var sw = el('span', 'mrl-sw');
      var inp = el('input'); inp.type = 'checkbox'; inp.id = id; inp.checked = !!marcado;
      sw.appendChild(inp); sw.appendChild(el('span', 'mrl-sw__pista'));
      cab.appendChild(sw);
    }
    f.appendChild(cab);
    f.appendChild(el('p', 'mrl-cat__d', desc));
    return f;
  }
  function abrirPanel() {
    if (panel) return;
    ultimoFoco = doc.activeElement;
    var p = perm();
    panel = el('div', 'mrl-ov');
    var d = el('div', 'mrl-pn');
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'mrl-pn-t');
    d.appendChild(el('h2', 'mrl-pn__t', T.panel_titulo)).id = 'mrl-pn-t';
    d.appendChild(el('p', 'mrl-pn__i', T.panel_intro + ' ' + enlacePolitica()));
    var cats = el('div', 'mrl-cats');
    cats.appendChild(fila('mrl-c-t', T.cat_tecnicas, T.cat_tecnicas_desc, true, true, T.siempre_activas));
    cats.appendChild(fila('mrl-c-a', T.cat_analitica, T.cat_analitica_desc, p.a, false));
    cats.appendChild(fila('mrl-c-m', T.cat_publicidad, T.cat_publicidad_desc, p.m, false));
    d.appendChild(cats);
    var bs = el('div', 'mrl-pn__bs');
    bs.appendChild(boton('mrl-btn--pri', T.guardar, function () {
      decidir(doc.getElementById('mrl-c-a').checked, doc.getElementById('mrl-c-m').checked);
    }));
    bs.appendChild(boton('mrl-btn--pri', T.rechazar, function () { decidir(false, false); }));
    bs.appendChild(boton('mrl-btn--pri', T.aceptar, function () { decidir(true, true); }));
    d.appendChild(bs);
    panel.appendChild(d);
    doc.body.appendChild(panel);
    root.classList.add('mrl-pn-abierto');
    if (banner) banner.hidden = true;
    doc.addEventListener('keydown', teclas, true);
    var primero = doc.getElementById('mrl-c-a'); if (primero) primero.focus();
  }
  function cerrarPanel(devolverFoco) {
    if (!panel) return;
    panel.parentNode.removeChild(panel); panel = null;
    root.classList.remove('mrl-pn-abierto');
    doc.removeEventListener('keydown', teclas, true);
    if (estado === null && banner) banner.hidden = false;      // sin decisión: vuelve el banner
    if (devolverFoco && ultimoFoco && ultimoFoco.focus && doc.body.contains(ultimoFoco)) ultimoFoco.focus();
  }
  function cerrarTodo() { ocultarBanner(); cerrarPanel(true); }
  function teclas(e) {
    if (!panel) return;
    if (e.key === 'Escape') { e.preventDefault(); cerrarPanel(true); return; }
    if (e.key !== 'Tab') return;
    var f = [].slice.call(panel.querySelectorAll('button,input:not([disabled]),a[href]')).filter(function (n) { return n.offsetParent !== null || n === doc.activeElement; });
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && (doc.activeElement === a || !panel.contains(doc.activeElement))) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && (doc.activeElement === z || !panel.contains(doc.activeElement))) { e.preventDefault(); a.focus(); }
  }
  function abrir() { if (banner) banner.hidden = true; abrirPanel(); }

  /* ---------- arranque ---------- */
  window.MRL = { consent: perm, abrir: abrir, cookie: cookie, capi: capi };

  function iniciar() {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-mrl-consent]') : null;
      if (a) { e.preventDefault(); abrir(); }
    });
    if (estado) aplicar(); else mostrarBanner();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
