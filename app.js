/* =====================================================================
   CONTROL DE CALIDAD · JARABES · PWA
   Embol · Aseguramiento de Calidad
   Metodología de la planilla J2:
   1) Producto y unidades  →  especificaciones
   2) °Brix del jarabe simple (meta 60)  →  agua a agregar (col. Q)
   3) °Brix real y volumen real  →  verificación contra VOLUMEN MÁX Y MÍN
   ===================================================================== */
'use strict';

/* ══════════════════ 1 · MOTOR DE CÁLCULO ══════════════════ */

/** Densidad del jarabe según °Brix (polinomio del libro, cols. K/W/Y de J2) */
function densidad(brix) {
  const b = Number(brix);
  if (!isFinite(b)) return NaN;
  return 0.99732
       + 3.84785e-3  * b
       + 1.29732e-5  * b * b
       + 6.29838e-8  * b * b * b
       - 2.36716e-10 * b * b * b * b;
}

/**
 * AGUA A AGREGAR — fórmula de la columna Q de la planilla J2:
 *   Q = L·(100−V)/V·0,9982 − L·(100−P)/P·0,9982
 *   L = azúcar teórico del lote [Kg] · V = °Brix estándar del producto
 *   P = °Brix medido del jarabe simple
 */
function aguaAAgregar(azucar, brixStd, brixJS) {
  if (!isFinite(azucar) || !isFinite(brixJS) || brixJS <= 0 || brixStd <= 0) return NaN;
  return (azucar * (100 - brixStd) / brixStd * RHO_AGUA)
       - (azucar * (100 - brixJS) / brixJS * RHO_AGUA);
}

/** Volumen de jarabe simple al °Brix medido (col. O):  O = L·100/(P·ρ(P)) */
function volumenJS(azucar, brixJS) {
  if (!isFinite(azucar) || !isFinite(brixJS) || brixJS <= 0) return NaN;
  return azucar * 100 / (brixJS * densidad(brixJS));
}

/** Rango de volumen (hoja VOLUMEN MÁX Y MÍN):  teórico ±0,5 % */
function rangoVolumen(p, un) {
  const teo = p.volUnidad * un;
  return { teo, min: teo * (1 - TOL.volumen / 100), max: teo * (1 + TOL.volumen / 100) };
}

/** Evaluación de la verificación final */
function verificar(p, un, volReal, brixReal) {
  const rg = rangoVolumen(p, un);
  const out = { rg, nivel: null, msg: '', det: [] };
  const hayVol = isFinite(volReal) && volReal > 0;
  const hayBrix = isFinite(brixReal) && brixReal > 0;
  if (!hayVol && !hayBrix) return out;

  let volOk = true, brixOk = true;

  if (hayVol) {
    out.difVol = (volReal - rg.teo) / rg.teo * 100;
    if (volReal < rg.min) { volOk = false; out.det.push(`Volumen ${fmt(rg.min - volReal, 0)} L por debajo del mínimo`); }
    else if (volReal > rg.max) { volOk = false; out.det.push(`Volumen ${fmt(volReal - rg.max, 0)} L por encima del máximo`); }
    else out.det.push(`Volumen dentro de rango (${out.difVol >= 0 ? '+' : ''}${fmt(out.difVol, 2)} %)`);
  }
  if (hayBrix) {
    out.difBrix = brixReal - p.brix;
    if (Math.abs(out.difBrix) > TOL.brix) { brixOk = false; out.det.push(`°Brix fuera de rango (${out.difBrix > 0 ? '+' : ''}${fmt(out.difBrix, 2)} °Bx)`); }
    else out.det.push(`°Brix dentro de rango (${out.difBrix >= 0 ? '+' : ''}${fmt(out.difBrix, 2)} °Bx)`);
  }

  if (volOk && brixOk) { out.nivel = 'ok'; out.msg = 'LOTE CONFORME'; }
  else if (!volOk && hayBrix && brixOk) { out.nivel = 'bad'; out.msg = 'VOLUMEN FUERA DE RANGO'; }
  else if (volOk && !brixOk) { out.nivel = 'bad'; out.msg = '°BRIX FUERA DE RANGO'; }
  else { out.nivel = 'bad'; out.msg = 'FUERA DE ESPECIFICACIÓN'; }
  return out;
}

/* ══════════════════ 1b · VENCIMIENTOS ══════════════════ */

/** Vencimiento = elaboración + días del producto (3,5 días = 84 h) */
function calcVencimiento(elaborado, p) {
  if (!elaborado || !p) return null;
  const d = new Date(elaborado);
  if (isNaN(d)) return null;
  return new Date(d.getTime() + p.dias * 86400000);
}

/** Estado según cuánto falta.  ba = crítico · wa = por vencer · ve = vencido */
function estadoVencimiento(vence, horasAviso = 12) {
  if (!vence) return { cod: null };
  const ms = new Date(vence).getTime() - Date.now();
  const h = ms / 3600000;
  if (ms <= 0)              return { cod: 've', txt: 'VENCIDO',    ms, h, restante: textoRestante(ms) };
  if (h <= horasAviso / 2)  return { cod: 'ba', txt: 'POR VENCER', ms, h, restante: textoRestante(ms) };
  if (h <= horasAviso)      return { cod: 'wa', txt: 'PRÓXIMO',    ms, h, restante: textoRestante(ms) };
  return { cod: 'ok', txt: 'VIGENTE', ms, h, restante: textoRestante(ms) };
}

function textoRestante(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms % 86400000 / 3600000);
  const m = Math.floor(ms % 3600000 / 60000);
  let t;
  if (d > 0)      t = `${d} d ${h} h`;
  else if (h > 0) t = `${h} h ${m} min`;
  else            t = `${m} min`;
  return neg ? `hace ${t}` : `en ${t}`;
}

/* ---------- Archivo de calendario (.ics) ---------- */

/** Fecha en formato UTC del estándar iCalendar */
const icsFecha = d => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

/** El estándar exige líneas de máximo 75 octetos */
function plegar(linea) {
  const b = [...linea];
  if (b.length <= 74) return linea;
  let out = b.slice(0, 74).join(''), i = 74;
  while (i < b.length) { out += '\r\n ' + b.slice(i, i + 73).join(''); i += 73; }
  return out;
}
const esc = t => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * Genera el archivo .ics con un evento por lote y una alarma nativa
 * (VALARM) que dispara el recordatorio en el calendario del celular.
 */
function generarICS(registros, horasAviso) {
  const L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Embol Procesos//Correccion de Jarabes//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Vencimientos de jarabes',
    'X-WR-TIMEZONE:UTC'
  ];
  const ahora = icsFecha(new Date());

  registros.forEach(r => {
    const p = prod(r.abrev);
    const vence = r.vence || (r.elaborado && p ? calcVencimiento(r.elaborado, p) : null);
    if (!vence) return;
    const ini = new Date(vence);
    const fin = new Date(ini.getTime() + 1800000);   // media hora de duración

    L.push('BEGIN:VEVENT');
    L.push(`UID:jarabe-${r.id}-${r.ts}@embol-procesos`);
    L.push(`DTSTAMP:${ahora}`);
    L.push(`DTSTART:${icsFecha(ini)}`);
    L.push(`DTEND:${icsFecha(fin)}`);
    L.push(plegar(`SUMMARY:${esc('Vence ' + r.producto + (r.tanque ? ' · Tanque ' + r.tanque : ''))}`));
    L.push(plegar('DESCRIPTION:' + esc(
      `Producto: ${r.producto} (${r.abrev})\n` +
      `Unidades: ${fmt(r.unidades, 0)}\n` +
      (r.tanque ? `Tanque: ${r.tanque}\n` : '') +
      (r.elaborado ? `Elaborado: ${new Date(r.elaborado).toLocaleString('es-BO')}\n` : '') +
      `Vida útil: ${p ? p.dias : '—'} días\n` +
      (r.volReal != null ? `Volumen real: ${fmt(r.volReal, 0)} L\n` : '') +
      (r.brixReal != null ? `°Brix real: ${fmt(r.brixReal, 2)}\n` : '') +
      (r.operador ? `Operador: ${r.operador}` : '')
    )));
    if (r.tanque) L.push(plegar(`LOCATION:${esc('Tanque ' + r.tanque)}`));
    L.push('CATEGORIES:JARABES,VENCIMIENTO');
    L.push('STATUS:CONFIRMED');
    L.push('BEGIN:VALARM');
    L.push(`TRIGGER:-PT${horasAviso}H`);
    L.push('ACTION:DISPLAY');
    L.push(plegar(`DESCRIPTION:${esc(r.producto + (r.tanque ? ' (Tanque ' + r.tanque + ')' : '') + ' vence en ' + horasAviso + ' horas')}`));
    L.push('END:VALARM');
    L.push('BEGIN:VALARM');
    L.push('TRIGGER:-PT30M');
    L.push('ACTION:DISPLAY');
    L.push(plegar(`DESCRIPTION:${esc(r.producto + ' vence en 30 minutos')}`));
    L.push('END:VALARM');
    L.push('END:VEVENT');
  });

  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

/* ══════════════════ 2 · UTILIDADES ══════════════════ */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
/**
 * Lee un número escrito de cualquier forma.
 * Acepta coma o punto como decimal — necesario porque en iPhone el teclado
 * entrega el separador según la región del equipo y no siempre es el mismo.
 *   "54,85" · "54.85" · "1.234,5" · "1,234.5" · " 54,85 L "
 */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  let s = String(v ?? '').trim().replace(/[\s ]/g, '');
  if (!s) return NaN;
  s = s.replace(/[^0-9.,\-]/g, '');
  const c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c > -1 && p > -1) {
    // El separador que aparece último es el decimal
    s = c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (c > -1) {
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

function fmt(v, dec = 2) {
  if (!isFinite(v)) return '—';
  // Sin separador de miles: 24000 y no 24.000, para que el punto no se
  // confunda con el decimal. Los decimales siguen con coma: 54,85
  return Number(v).toLocaleString('es-BO', {
    minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false
  });
}
function fecha(d) { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function hoyISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }

let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast ' + tipo, 2600);
}

const prod = a => PRODUCTOS.find(p => p.abrev === a);

/* ══════════════════ 3 · ALMACENAMIENTO ══════════════════ */

/**
 * Capa de almacenamiento con dos motores:
 *   1) IndexedDB  — preferido
 *   2) localStorage — respaldo automático si IndexedDB no está disponible
 *      (modo incógnito, archivo abierto con file://, permisos bloqueados,
 *       o una pestaña vieja que bloquea la actualización de la base)
 * Nunca falla en silencio: si algo sale mal se avisa en pantalla.
 */
const DB = (() => {
  const NAME = 'calidad-jarabes-db';
  const LS_REG = 'calidad:analisis', LS_CFG = 'calidad:config';
  let db = null, modo = null, abriendo = null;

  /* ---------- respaldo en localStorage ---------- */
  const ls = {
    leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    escribir(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    all()  { return this.leer(LS_REG, []); },
    put(r) {
      const l = this.all();
      if (r.id == null) r.id = (l.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
      const i = l.findIndex(x => x.id === r.id);
      i >= 0 ? l[i] = r : l.push(r);
      this.escribir(LS_REG, l); return r.id;
    },
    del(id) { this.escribir(LS_REG, this.all().filter(x => x.id !== id)); },
    clear() { this.escribir(LS_REG, []); },
    get(k)  { const c = this.leer(LS_CFG, {}); return k in c ? { k, v: c[k] } : undefined; },
    set(k, v) { const c = this.leer(LS_CFG, {}); c[k] = v; this.escribir(LS_CFG, c); }
  };

  const crearStores = d => {
    if (!d.objectStoreNames.contains('planillas'))
      d.createObjectStore('planillas', { keyPath: 'id', autoIncrement: true });
    if (!d.objectStoreNames.contains('config'))
      d.createObjectStore('config', { keyPath: 'k' });
  };

  /** Abre pidiendo una versión concreta */
  function abrirVersion(ver) {
    return new Promise((res, rej) => {
      let rq;
      try { rq = ver ? indexedDB.open(NAME, ver) : indexedDB.open(NAME); }
      catch (e) { return rej(e); }
      // Si otra pestaña tiene la base abierta en una versión anterior
      rq.onblocked = () => rej(new Error('bloqueada'));
      rq.onupgradeneeded = e => crearStores(e.target.result);
      rq.onsuccess = e => res(e.target.result);
      rq.onerror = () => rej(rq.error || new Error('error al abrir'));
      // Si no responde en 4 s, no dejamos la promesa colgada
      setTimeout(() => rej(new Error('sin respuesta')), 4000);
    });
  }

  /** Abre la base y garantiza que existan los almacenes que necesitamos */
  async function abrir() {
    if (db) return db;
    if (!('indexedDB' in self) || !self.indexedDB) throw new Error('sin indexedDB');

    let d = await abrirVersion(null);                 // versión actual, sea cual sea
    if (!d.objectStoreNames.contains('planillas') || !d.objectStoreNames.contains('config')) {
      const siguiente = d.version + 1;                // faltan almacenes → subimos versión
      d.close();
      d = await abrirVersion(siguiente);
    }
    d.onversionchange = () => { d.close(); db = null; };
    db = d;
    return db;
  }

  /** Decide el motor una sola vez */
  function listo() {
    if (abriendo) return abriendo;
    abriendo = abrir()
      .then(() => { modo = 'idb'; })
      .catch(e => {
        modo = 'ls';
        console.warn('IndexedDB no disponible, se usa localStorage:', e && e.message);
      });
    return abriendo;
  }

  const w = rq => new Promise((res, rej) => {
    rq.onsuccess = e => res(e.target.result);
    rq.onerror = () => rej(rq.error);
  });
  const store = (s, m) => db.transaction(s, m).objectStore(s);

  /** Ejecuta contra IndexedDB; si algo falla, cae a localStorage */
  async function op(idbFn, lsFn) {
    await listo();
    if (modo === 'idb') {
      try { return await idbFn(); }
      catch (e) {
        console.warn('Fallo en IndexedDB, se pasa a localStorage:', e && e.message);
        modo = 'ls';
      }
    }
    return lsFn();
  }

  return {
    get motor() { return modo; },
    all()     { return op(() => w(store('planillas', 'readonly').getAll()), () => ls.all()); },
    put(r)    { return op(() => w(store('planillas', 'readwrite').put(r)),  () => ls.put(r)); },
    del(id)   { return op(() => w(store('planillas', 'readwrite').delete(id)), () => ls.del(id)); },
    clear()   { return op(() => w(store('planillas', 'readwrite').clear()), () => ls.clear()); },
    get(k)    { return op(() => w(store('config', 'readonly').get(k)),      () => ls.get(k)); },
    set(k, v) { return op(() => w(store('config', 'readwrite').put({ k, v })), () => ls.set(k, v)); }
  };
})();

let REGISTROS = [];

/* ══════════════════ 4 · NAVEGACIÓN ══════════════════ */

$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.view').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('#view-' + t.dataset.view).classList.add('active');
  window.scrollTo(0, 0);
  if (t.dataset.view === 'registros') { renderRegistros(); contarExport(); }
}));

/* ══════════════════ 5 · ARRANQUE DE SELECTS ══════════════════ */

const UNIDADES_RAPIDAS = [16, 24, 32, 48, 64, 80, 96, 128];

function llenarSelects() {
  const opts = PRODUCTOS.map(p => `<option value="${p.abrev}">${p.producto}</option>`).join('');
  ['#f_prod', '#p_prod'].forEach(s => {
    const el = $(s), v = el.value;
    el.innerHTML = '<option value="">Seleccionar producto…</option>' + opts;
    if (v) el.value = v;
  });
  $('#dl_op').innerHTML = OPERADORES.map(o => `<option value="${o}">`).join('');
  $('#f_quick').innerHTML = UNIDADES_RAPIDAS.map(n => `<button type="button" data-u="${n}">${n}</button>`).join('');
}
$('#f_quick').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $('#f_un').value = b.dataset.u;
  $$('#f_quick button').forEach(x => x.classList.toggle('sel', x === b));
  calc();
});

/* ══════════════════ 6 · FLUJO PRINCIPAL ══════════════════ */

let ULTIMO = null;

function calc() {
  const p  = prod($('#f_prod').value);
  const un = num($('#f_un').value);
  const hayLote = p && isFinite(un) && un > 0;

  /* ── Paso 1: especificaciones ── */
  $('#f_specs').innerHTML = p ? `
    <div class="spec hi"><span>°Brix estándar</span><b>${fmt(p.brix, 2)}</b><i>°Bx</i></div>
    <div class="spec"><span>Volumen/unidad</span><b>${fmt(p.volUnidad, 2)}</b><i>L</i></div>
    <div class="spec"><span>Azúcar/unidad</span><b>${fmt(p.azReal, 2)}</b><i>Kg</i></div>
    <div class="spec"><span>Vencimiento</span><b>${p.dias}</b><i>días</i></div>` : '';

  $('#paso2').hidden = !hayLote;
  $('#paso3').hidden = !hayLote;
  $('#pasoBrix').hidden = !hayLote;
  if (!hayLote) $('#pasoDictamen').hidden = true;
  if (!hayLote) { ULTIMO = null; return; }

  const azucar = un * p.azTeorico;              // L de la fórmula (azúcar teórico)
  const rg = rangoVolumen(p, un);

  /* ── Paso 2: agua según °Brix del jarabe simple ── */
  const brixJS = num($('#f_brixJS').value);
  const jsEstado = $('#js_estado');
  const aguaCard = $('#aguaCard');
  const datos = $('#datosJS');

  if (isFinite(brixJS) && brixJS > 0) {
    const agua = aguaAAgregar(azucar, p.brix, brixJS);
    const vjs  = volumenJS(azucar, brixJS);
    const d60  = brixJS - BRIX_JS_DEFAULT;

    jsEstado.className = 'under ' + (Math.abs(d60) < 0.005 ? 'ok' : (brixJS < BRIX_JS_DEFAULT ? 'warn' : ''));
    jsEstado.innerHTML = Math.abs(d60) < 0.005
      ? 'En la meta de 60,00 °Bx.'
      : `${fmt(Math.abs(d60), 2)} °Bx ${d60 < 0 ? 'por debajo' : 'por encima'} de la meta de 60,00.`;

    aguaCard.hidden = false;
    datos.hidden = false;

    if (agua > 0.5) {
      aguaCard.className = 'agua-card';
      $('#r_agua').innerHTML = fmt(agua, 0) + ' <small style="font-size:17px">L</small>';
      $('#r_agua_sub').textContent = `Para llevar el jarabe de ${fmt(brixJS, 2)} °Bx al estándar de ${fmt(p.brix, 2)} °Bx`;
    } else if (agua >= -0.5) {
      aguaCard.className = 'agua-card cero';
      $('#r_agua').textContent = '0 L';
      $('#r_agua_sub').textContent = 'El jarabe simple ya está al °Brix del producto';
    } else {
      aguaCard.className = 'agua-card neg';
      $('#r_agua').textContent = 'Sin agua';
      $('#r_agua_sub').textContent = `El °Brix medido (${fmt(brixJS, 2)}) está por debajo del estándar del producto (${fmt(p.brix, 2)}). No agregar agua.`;
    }

    $('#r_az').textContent  = fmt(azucar, 0);
    $('#r_vjs').textContent = fmt(vjs, 0);
    $('#r_bstd').textContent = fmt(p.brix, 2);

    ULTIMO = { p, un, azucar, brixJS, agua: Math.max(0, agua), vjs, rg };
  } else {
    jsEstado.textContent = '';
    jsEstado.className = 'under';
    aguaCard.hidden = true;
    datos.hidden = true;
    ULTIMO = { p, un, azucar, brixJS: NaN, agua: NaN, vjs: NaN, rg };
  }

  /* ── Verificación de VOLUMEN ── */
  // (rg ya se calculó arriba en esta misma función)
  $('#v_min').textContent = fmt(rg.min, 0);
  $('#v_teo').textContent = fmt(rg.teo, 0);
  $('#v_max').textContent = fmt(rg.max, 0);

  const volReal  = num($('#f_volReal').value);
  const brixReal = num($('#f_brixReal').value);

  medidor('#gauge', '#g_mark', ['#g_min', '#g_teo', '#g_max'],
          volReal, rg.min, rg.teo, rg.max, 0, ' L');
  parametro('#tagVol', volReal, rg.min, rg.max, rg.teo, 0, 'L',
            v => `${v > rg.teo ? '+' : ''}${fmt((v - rg.teo) / rg.teo * 100, 2)} % del teórico`);

  /* ── Verificación de °BRIX ── */
  const bMin = p.brix - TOL.brix, bMax = p.brix + TOL.brix;
  $('#b_min').textContent = fmt(bMin, 2);
  $('#b_std').textContent = fmt(p.brix, 2);
  $('#b_max').textContent = fmt(bMax, 2);

  medidor('#gaugeB', '#gb_mark', ['#gb_min', '#gb_std', '#gb_max'],
          brixReal, bMin, p.brix, bMax, 2, ' °Bx');
  parametro('#tagBrix', brixReal, bMin, bMax, p.brix, 2, '°Bx',
            v => `${v > p.brix ? '+' : ''}${fmt(v - p.brix, 2)} °Bx respecto al estándar`);

  /* ── Sólidos ── */
  const sol = $('#solidos');
  if (isFinite(volReal) && volReal > 0 && isFinite(brixReal) && brixReal > 0) {
    const sReal = volReal * densidad(brixReal) * brixReal / 100;
    const sTeo  = rg.teo  * densidad(p.brix)  * p.brix  / 100;
    const dif   = (sReal - sTeo) / sTeo * 100;
    sol.hidden = false;
    $('#s_real').textContent = fmt(sReal, 0);
    $('#s_teo').textContent  = fmt(sTeo, 0);
    $('#s_dif').textContent  = (dif > 0 ? '+' : '') + fmt(dif, 2);
  } else sol.hidden = true;

  /* ── Dictamen global ── */
  $('#pasoDictamen').hidden = !(isFinite(volReal) || isFinite(brixReal));
  const ver = verificar(p, un, volReal, brixReal);
  const vv = $('#veredicto');
  if (ver.nivel) {
    vv.hidden = false;
    vv.className = 'veredicto ' + ver.nivel;
    $('#v_msg').textContent = ver.msg;
    $('#v_det').textContent = ver.det.join(' · ');
    sugerirDictamen(ver.nivel);
  } else vv.hidden = true;

  /* ── Vencimiento ── */
  const elab = $('#f_elab').value;
  const vence = calcVencimiento(elab, p);
  const vc = $('#vencCard');
  if (vence) {
    const st = estadoVencimiento(vence, AJUSTES.antelacion);
    vc.hidden = false;
    vc.className = 'venc-card' + (st.cod === 've' ? ' vencido' : st.cod === 'ba' ? ' critico' : st.cod === 'wa' ? ' pronto' : '');
    $('#venc_fecha').textContent = vence.toLocaleString('es-BO',
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    $('#venc_resta').textContent = `Vida útil ${p.dias} días · vence ${st.restante}`;
  } else vc.hidden = true;

  if (ULTIMO) Object.assign(ULTIMO, { volReal, brixReal, ver, elaborado: elab || null, vence });
}

['#f_prod', '#f_un', '#f_tanque', '#f_brixJS', '#f_volReal', '#f_brixReal', '#f_elab'].forEach(s => {
  $(s).addEventListener('input', calc);
  $(s).addEventListener('change', calc);
});
$('#f_operador').addEventListener('change', () => DB.set('operador', $('#f_operador').value).catch(() => {}));

/* ── Dictamen del analista ── */
let DICTAMEN = 'liberado';
$('#f_dictamen').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#f_dictamen button').forEach(x => x.classList.toggle('on', x === b));
  DICTAMEN = b.dataset.d;
});

/** Propone el dictamen a partir del resultado del análisis */
function sugerirDictamen(nivel) {
  const d = nivel === 'ok' ? 'liberado' : nivel ? 'retenido' : 'liberado';
  if (d === DICTAMEN) return;
  DICTAMEN = d;
  $$('#f_dictamen button').forEach(x => x.classList.toggle('on', x.dataset.d === d));
}

$('#btnLimpiar').addEventListener('click', () => {
  ['#f_un', '#f_tanque', '#f_brixJS', '#f_volReal', '#f_brixReal', '#f_obs'].forEach(s => $(s).value = '');
  $$('#f_quick button').forEach(x => x.classList.remove('sel'));
  $('#f_elab').value = ahoraLocal();
  calc();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Guardar ── */
$('#btnGuardar').addEventListener('click', async () => {
  if (!ULTIMO) return toast('Elige el producto y las unidades', 'bad');
  const btn = $('#btnGuardar');
  const u = ULTIMO;
  btn.disabled = true;
  const txt = btn.textContent;
  btn.textContent = 'Guardando…';
  try {
    await DB.put({
      ts: Date.now(), fecha: hoyISO(),
      abrev: u.p.abrev, producto: u.p.producto,
      tanque: $('#f_tanque').value, operador: $('#f_operador').value,
      unidades: u.un, azucar: u.azucar,
      brixJS: isFinite(u.brixJS) ? u.brixJS : null,
      agua: isFinite(u.agua) ? u.agua : null,
      volMin: u.rg.min, volTeo: u.rg.teo, volMax: u.rg.max,
      volReal: isFinite(u.volReal) ? u.volReal : null,
      brixReal: isFinite(u.brixReal) ? u.brixReal : null,
      estado: u.ver && u.ver.nivel ? u.ver.nivel : null,
      estadoMsg: u.ver && u.ver.msg ? u.ver.msg : null,
      elaborado: u.elaborado || null,
      vence: u.vence ? u.vence.toISOString() : null,
      dictamen: DICTAMEN,
      obs: $('#f_obs').value || null
    });
    REGISTROS = await DB.all();
    renderRegistros();
    contarExport();
    programarAlarmas();
    toast(`Análisis registrado · ${REGISTROS.length} en total`, 'ok');
  } catch (e) {
    console.error(e);
    toast('No se pudo registrar: ' + (e && e.message ? e.message : 'error desconocido'), 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = txt;
  }
});

/* ── Imagen ── */
$('#btnImg').addEventListener('click', async () => {
  if (!ULTIMO) return toast('Completa el producto y las unidades', 'bad');
  const u = ULTIMO;
  const agua = isFinite(u.agua) && u.agua > 0.5;
  const ver = u.ver && u.ver.nivel;
  const colores = { ok: ['#EAF8F0', '#0E8F4E'], warn: ['#FFF6E5', '#B26A00'], bad: ['#FFEDED', '#C2000B'] };

  const d = document.createElement('div');
  d.className = 'shot';
  d.innerHTML = `
    <div class="shot-hd">
      <h2>${u.p.producto}</h2>
      <p>Certificado de análisis · ${fmt(u.un, 0)} unidades · Tanque ${$('#f_tanque').value || '—'} · ${new Date().toLocaleString('es-BO')}</p>
    </div>
    <div class="shot-bd">
      <div class="shot-row"><span>°Brix estándar del producto</span><b>${fmt(u.p.brix, 2)} °Bx</b></div>
      <div class="shot-row"><span>Azúcar del lote</span><b>${fmt(u.azucar, 0)} Kg</b></div>
      ${isFinite(u.brixJS) ? `<div class="shot-row"><span>°Brix jarabe simple medido</span><b>${fmt(u.brixJS, 2)} °Bx</b></div>` : ''}
      ${agua ? `<div class="shot-big" style="background:linear-gradient(135deg,#0A6FCB,#1391E8)"><em>Agua a agregar</em><b>${fmt(u.agua, 0)} L</b></div>` : ''}
      <div class="shot-3col">
        <div><span>Volumen mínimo</span><b>${fmt(u.rg.min, 0)}</b></div>
        <div class="hi"><span>Volumen teórico</span><b>${fmt(u.rg.teo, 0)}</b></div>
        <div><span>Volumen máximo</span><b>${fmt(u.rg.max, 0)}</b></div>
      </div>
      ${isFinite(u.volReal) && u.volReal > 0 ? `<div class="shot-row"><span>Volumen real medido</span><b>${fmt(u.volReal, 0)} L</b></div>` : ''}
      ${isFinite(u.brixReal) && u.brixReal > 0 ? `<div class="shot-row"><span>°Brix real medido</span><b>${fmt(u.brixReal, 2)} °Bx</b></div>` : ''}
      ${ver ? `<div class="shot-badge" style="background:${colores[u.ver.nivel][0]};color:${colores[u.ver.nivel][1]}">${u.ver.msg}</div>` : ''}
      ${u.vence ? `<div class="shot-row"><span>Elaborado</span><b>${new Date(u.elaborado).toLocaleString('es-BO')}</b></div>
      <div class="shot-row" style="border-bottom:0"><span>Vence</span><b style="color:#C2000B">${u.vence.toLocaleString('es-BO')}</b></div>` : ''}
      <div class="shot-badge" style="margin-top:14px;background:${DICTAMEN==='liberado'?'#EAF8F0;color:#0E8F4E':DICTAMEN==='retenido'?'#FFF6E5;color:#B26A00':'#FFEDED;color:#C2000B'}">DICTAMEN: ${DICTAMEN.toUpperCase()}</div>
      ${$('#f_obs').value ? `<div class="shot-row" style="border-bottom:0"><span>Observaciones</span><b>${$('#f_obs').value}</b></div>` : ''}
      <div class="shot-foot">Tolerancias: volumen ±${TOL.volumen} % · °Brix ±${TOL.brix}${u.vence ? ' · Vida útil ' + u.p.dias + ' días' : ''}${$('#f_operador').value ? ' · Analista: ' + $('#f_operador').value : ''}</div>
    </div>`;
  document.body.appendChild(d);
  await capturar(d, `Certificado_${u.p.abrev}_${hoyISO()}.png`);
  d.remove();
});

/**
 * Pinta un medidor: la banda verde ocupa del 25 % al 75 % del recorrido,
 * o sea que la escala visible es el doble del rango aceptado.
 */
function medidor(cajaSel, marcaSel, lblSel, valor, min, centro, max, dec, unidad) {
  const caja = $(cajaSel);
  if (!isFinite(valor) || valor <= 0) { caja.hidden = true; return; }
  const semi = max - centro;
  const pos = Math.max(2, Math.min(98, ((valor - (centro - semi * 2)) / (semi * 4)) * 100));
  caja.hidden = false;
  const marca = $(marcaSel);
  marca.style.left = pos + '%';
  marca.className = 'g-mark' + (valor < min || valor > max ? ' fuera'
                    : (Math.abs(valor - centro) > semi * 0.75 ? ' limite' : ''));
  $(lblSel[0]).textContent = fmt(min, dec);
  $(lblSel[1]).textContent = fmt(centro, dec) + unidad;
  $(lblSel[2]).textContent = fmt(max, dec);
}

/** Resultado de un parámetro contra su rango */
function parametro(sel, valor, min, max, centro, dec, unidad, detalle) {
  const e = $(sel);
  if (!isFinite(valor) || valor <= 0) { e.hidden = true; return; }
  const semi = max - centro;
  let cod, txt;
  if (valor < min)      { cod = 'bad'; txt = `POR DEBAJO DEL MÍNIMO · faltan ${fmt(min - valor, dec)} ${unidad}`; }
  else if (valor > max) { cod = 'bad'; txt = `POR ENCIMA DEL MÁXIMO · sobran ${fmt(valor - max, dec)} ${unidad}`; }
  else if (Math.abs(valor - centro) > semi * 0.75) { cod = 'wa'; txt = 'EN EL LÍMITE'; }
  else                  { cod = 'ok'; txt = 'DENTRO DE RANGO'; }
  e.hidden = false;
  e.className = 'dictamen-par ' + cod;
  e.innerHTML = `<span class="dp-dot"></span><span>${txt}<small>${detalle(valor)}</small></span>`;
}

/* ══════════════════ 7 · VISTA PRODUCTOS ══════════════════ */

function renderFicha() {
  const p = prod($('#p_prod').value);
  $('#p_ficha').innerHTML = p ? `<div class="ficha">
    <div class="fr key"><span>°Brix estándar</span><b>${fmt(p.brix, 2)}<em>°Bx</em></b></div>
    <div class="fr key"><span>Volumen por unidad</span><b>${fmt(p.volUnidad, 2)}<em>L</em></b></div>
    <div class="fr"><span>Rango de °Brix aceptado</span><b>${fmt(p.brix - TOL.brix, 2)} – ${fmt(p.brix + TOL.brix, 2)}<em>°Bx</em></b></div>
    <div class="fr"><span>Azúcar teórico</span><b>${fmt(p.azTeorico, 3)}<em>Kg/un</em></b></div>
    <div class="fr"><span>Azúcar real (SAP)</span><b>${fmt(p.azReal, 3)}<em>Kg/un</em></b></div>
    <div class="fr"><span>Días de vencimiento</span><b>${p.dias}<em>días</em></b></div>
    <div class="fr"><span>Densidad al estándar</span><b>${fmt(densidad(p.brix), 5)}<em>g/mL</em></b></div>
    <div class="fr"><span>Fórmula (MMI)</span><b style="font-size:13px">${p.mmi}</b></div>
  </div>` : '';
}
$('#p_prod').addEventListener('change', renderFicha);

function renderTabla() {
  const q = $('#p_buscar').value.trim().toLowerCase();
  const l = PRODUCTOS.filter(p => !q || (p.abrev + ' ' + p.producto).toLowerCase().includes(q));
  $('#p_tabla').innerHTML = `
    <thead><tr><th>Producto</th><th>Abrev.</th><th>°Brix</th><th>L / un</th><th>Az. Kg/un</th><th>Días</th></tr></thead>
    <tbody>${l.map(p => `<tr>
      <td>${p.producto}</td><td><span class="ab">${p.abrev}</span></td>
      <td>${fmt(p.brix, 2)}</td><td>${fmt(p.volUnidad, 2)}</td>
      <td>${fmt(p.azReal, 2)}</td><td>${p.dias}</td></tr>`).join('')}</tbody>`;
}
$('#p_buscar').addEventListener('input', renderTabla);

/* ══════════════════ 8 · REGISTROS ══════════════════ */

function listaFiltrada() {
  const q = $('#r_buscar').value.trim().toLowerCase();
  let l = [...REGISTROS].sort((a, b) => b.ts - a.ts);
  if (q) l = l.filter(r => [r.abrev, r.producto, r.tanque, r.operador, r.fecha].join(' ').toLowerCase().includes(q));
  return l;
}

/** Devuelve el vencimiento de un registro, aunque sea de una versión anterior */
function vencimientoDe(r) {
  if (r.vence) return new Date(r.vence);
  const p = prod(r.abrev);
  if (r.elaborado && p) return calcVencimiento(r.elaborado, p);
  if (r.fecha && p) return calcVencimiento(r.fecha + 'T08:00', p);   // estimado
  return null;
}

function renderRegistros() {
  const l = listaFiltrada();
  $('#r_count').textContent = REGISTROS.length;
  const c = $('#r_lista');
  if (!l.length) { c.innerHTML = '<div class="empty">Sin registros todavía.<br>Guarda una planilla para verla aquí.</div>'; return; }

  c.innerHTML = l.map(r => {
    const dic = r.dictamen || (r.estado === 'ok' ? 'liberado' : r.estado ? 'retenido' : null);
    const pill = dic
      ? `<span class="pill ${dic}">${dic.toUpperCase()}</span>`
      : '<span class="pill warn">SIN DICTAMEN</span>';
    const v = vencimientoDe(r);
    const st = v ? estadoVencimiento(v, AJUSTES.antelacion) : { cod: null };
    const clase = (st.cod && st.cod !== 'ok') ? ' ' + st.cod : '';
    const tagV = v
      ? `<span class="tag ${st.cod === 'ok' ? '' : st.cod}">${st.cod === 've' ? 'Venció' : 'Vence'} ${st.restante}</span>`
      : '';
    return `<div class="item${clase}">
      <div class="item-top">
        <div><div class="item-t">${r.producto}</div>
        <div class="item-s">${fecha(r.fecha)} · ${fmt(r.unidades, 0)} un · Tanque ${r.tanque || '—'}${r.operador ? ' · ' + r.operador : ''}</div></div>
        ${pill}
      </div>
      <div class="item-tags">
        ${tagV}
        ${r.agua != null && r.agua > 0.5 ? `<span class="tag agua">+${fmt(r.agua, 0)} L agua</span>` : ''}
        ${r.brixJS != null ? `<span class="tag">JS ${fmt(r.brixJS, 2)} °Bx</span>` : ''}
        <span class="tag">Teórico ${fmt(r.volTeo, 0)} L</span>
        ${r.volReal != null ? `<span class="tag">Real ${fmt(r.volReal, 0)} L</span>` : ''}
        ${r.brixReal != null ? `<span class="tag">${fmt(r.brixReal, 2)} °Bx</span>` : ''}
      </div>
      <div class="item-acts">
        <button onclick="cargar(${r.id})">Cargar</button>
        <button class="del" onclick="borrar(${r.id})">Borrar</button>
      </div>
    </div>`;
  }).join('');
  renderVencimientos();
}
$('#r_buscar').addEventListener('input', renderRegistros);

/* ══════════════════ 8b · VENCIMIENTOS Y ALARMAS ══════════════════ */

const AJUSTES = { alarmas: false, antelacion: 12 };
let TIMERS = [], AVISADOS = new Set();

/** Lotes con vencimiento, ordenados por urgencia */
function conVencimiento() {
  return REGISTROS
    .map(r => ({ r, v: vencimientoDe(r) }))
    .filter(x => x.v)
    .map(x => ({ ...x, st: estadoVencimiento(x.v, AJUSTES.antelacion) }))
    .sort((a, b) => a.v - b.v);
}

function renderVencimientos() {
  const l = conVencimiento();
  const vig = l.filter(x => x.st.cod === 'ok').length;
  const pro = l.filter(x => x.st.cod === 'wa' || x.st.cod === 'ba').length;
  const ven = l.filter(x => x.st.cod === 've').length;

  $('#v_resumen').innerHTML = `
    <div class="rs ok"><b>${vig}</b><span>Vigentes</span></div>
    <div class="rs wa"><b>${pro}</b><span>Por vencer</span></div>
    <div class="rs ba"><b>${ven}</b><span>Vencidos</span></div>`;

  const prox = l.filter(x => x.st.cod !== 've').slice(0, 6);
  $('#v_proximos').innerHTML = prox.length
    ? `<h3 style="margin:4px 0 0">Próximos vencimientos</h3>` + prox.map(x => `
        <div class="px ${x.st.cod}">
          <span class="px-bar"></span>
          <div class="px-in">
            <strong>${x.r.producto}</strong>
            <span>${x.r.tanque ? 'Tanque ' + x.r.tanque + ' · ' : ''}${x.v.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="px-t">${x.st.restante.replace('en ', '')}</div>
        </div>`).join('')
    : (l.length ? '<p class="under">No hay lotes vigentes por vencer.</p>' : '');
}

/* ---------- Switch de alarmas ---------- */

$('#sw_alarmas').addEventListener('change', async e => {
  if (e.target.checked) {
    if (!('Notification' in window)) {
      e.target.checked = false;
      return toast('Este navegador no permite notificaciones', 'bad');
    }
    let permiso = Notification.permission;
    if (permiso === 'default') permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      e.target.checked = false;
      $('#sw_estado').textContent = 'Permiso denegado. Actívalo en los ajustes del navegador.';
      return toast('No se dieron permisos de notificación', 'bad');
    }
    AJUSTES.alarmas = true;
    toast('Alarmas activadas', 'ok');
  } else {
    AJUSTES.alarmas = false;
    toast('Alarmas desactivadas');
  }
  $('#alarmaOpts').hidden = !AJUSTES.alarmas;
  actualizarTextoSwitch();
  DB.set('ajustes', AJUSTES).catch(() => {});
  programarAlarmas();
});

$('#a_antelacion').addEventListener('change', e => {
  AJUSTES.antelacion = Number(e.target.value) || 12;
  DB.set('ajustes', AJUSTES).catch(() => {});
  actualizarTextoSwitch();
  renderRegistros();
  programarAlarmas();
  calc();
});

function actualizarTextoSwitch() {
  $('#sw_estado').textContent = AJUSTES.alarmas
    ? `Avisará ${AJUSTES.antelacion} h antes de cada vencimiento`
    : 'Avisa antes de que venza un lote';
}

/** Envía una notificación usando el service worker si está disponible */
async function notificar(titulo, cuerpo, tag) {
  const opts = {
    body: cuerpo,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag, renotify: true, requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200]
  };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return reg.showNotification(titulo, opts);
  } catch {}
  try { new Notification(titulo, opts); } catch {}
}

/**
 * Programa las alarmas.
 * · Avisa de inmediato lo que ya entró en la ventana de antelación.
 * · Deja temporizadores para lo que caiga dentro de las próximas 24 h
 *   mientras la app siga abierta.
 */
function programarAlarmas() {
  TIMERS.forEach(clearTimeout); TIMERS = [];
  if (!AJUSTES.alarmas || Notification.permission !== 'granted') return;

  const aviso = AJUSTES.antelacion * 3600000;
  conVencimiento().forEach(({ r, v, st }) => {
    const clave = `${r.id}:${AJUSTES.antelacion}`;
    const falta = v.getTime() - Date.now();
    const detalle = `${r.producto}${r.tanque ? ' · Tanque ' + r.tanque : ''} — vence ${st.restante}`;

    if (falta <= 0) return;                                   // ya venció
    if (falta <= aviso) {                                     // ya toca avisar
      if (!AVISADOS.has(clave)) {
        AVISADOS.add(clave);
        notificar('Lote por vencer', detalle, 'venc-' + r.id);
      }
    } else if (falta - aviso < 86400000) {                    // dentro de 24 h
      TIMERS.push(setTimeout(() => {
        AVISADOS.add(clave);
        notificar('Lote por vencer', `${r.producto}${r.tanque ? ' · Tanque ' + r.tanque : ''} — vence en ${AJUSTES.antelacion} h`, 'venc-' + r.id);
      }, falta - aviso));
    }
    // Aviso adicional justo al vencer, si ocurre con la app abierta
    if (falta < 86400000) {
      TIMERS.push(setTimeout(() => {
        notificar('Lote VENCIDO', `${r.producto}${r.tanque ? ' · Tanque ' + r.tanque : ''} acaba de vencer`, 'venc0-' + r.id);
      }, falta));
    }
  });
}

$('#a_probar').addEventListener('click', () => {
  if (Notification.permission !== 'granted') return toast('Primero activa las alarmas', 'bad');
  notificar('Alarma de prueba', `Así se verá el aviso ${AJUSTES.antelacion} h antes de que venza un lote.`, 'prueba');
  toast('Notificación enviada', 'ok');
});

/* ---------- Exportar al calendario ---------- */

$('#a_ics').addEventListener('click', () => {
  const l = conVencimiento().filter(x => x.st.cod !== 've').map(x => x.r);
  if (!l.length) return toast('No hay lotes vigentes para agendar', 'bad');
  const ics = generarICS(l, AJUSTES.antelacion);
  const b = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `Vencimientos_Calidad_${hoyISO()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`${l.length} vencimiento${l.length === 1 ? '' : 's'} exportado${l.length === 1 ? '' : 's'}`, 'ok');
});

/* Refresca los tiempos restantes cada minuto */
setInterval(() => {
  if ($('#view-registros').classList.contains('active')) renderRegistros();
  if ($('#view-planilla').classList.contains('active') && !$('#vencCard').hidden) calc();
}, 60000);

async function borrar(id) {
  if (!confirm('¿Borrar este registro?')) return;
  try {
    await DB.del(id);
    REGISTROS = await DB.all();
    renderRegistros(); contarExport(); toast('Registro borrado');
  } catch (e) { console.error(e); toast('No se pudo borrar', 'bad'); }
}
function cargar(id) {
  const r = REGISTROS.find(x => x.id === id); if (!r) return;
  $('#f_prod').value = r.abrev;
  $('#f_un').value = r.unidades;
  $('#f_tanque').value = r.tanque || '';
  $('#f_brixJS').value = r.brixJS ?? '';
  $('#f_volReal').value = r.volReal ?? '';
  $('#f_brixReal').value = r.brixReal ?? '';
  $('#f_operador').value = r.operador || '';
  $('#f_elab').value = r.elaborado ? String(r.elaborado).slice(0, 16) : ahoraLocal();
  $('#f_obs').value = r.obs || '';
  if (r.dictamen) { DICTAMEN = r.dictamen; $$('#f_dictamen button').forEach(x => x.classList.toggle('on', x.dataset.d === r.dictamen)); }
  document.querySelector('.tab[data-view="planilla"]').click();
  calc();
}

/* ══════════════════ 9 · EXPORTACIÓN ══════════════════ */

const COLS = ['N°','FECHA','PRODUCTO','ABREV.','N° TANQUE','UNIDADES','AZÚCAR [Kg]',
  '°BRIX JARABE SIMPLE','AGUA AGREGADA [L]','VOLUMEN MÍNIMO [L]','VOLUMEN TEÓRICO [L]',
  'VOLUMEN MÁXIMO [L]','VOLUMEN REAL [L]','°BRIX REAL','°BRIX ESTÁNDAR','RESULTADO','DICTAMEN',
  'ELABORADO','VENCE','DÍAS VIDA ÚTIL','ANALISTA','OBSERVACIONES'];

const r2 = (v, d = 2) => (v == null || !isFinite(v)) ? '' : Number(Number(v).toFixed(d));
const fh = d => d ? new Date(d).toLocaleString('es-BO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';

function fila(r, i) {
  const p = prod(r.abrev);
  const v = vencimientoDe(r);
  return [i + 1, r.fecha, r.producto, r.abrev, r.tanque || '', r2(r.unidades, 0), r2(r.azucar, 1),
    r2(r.brixJS), r2(r.agua, 1), r2(r.volMin, 0), r2(r.volTeo, 0), r2(r.volMax, 0),
    r2(r.volReal, 0), r2(r.brixReal), p ? p.brix : '',
    r.estadoMsg || '', (r.dictamen || '').toUpperCase(),
    fh(r.elaborado), fh(v), p ? p.dias : '', r.operador || '', r.obs || ''];
}

function enRango() {
  const d = $('#x_desde').value, h = $('#x_hasta').value;
  return [...REGISTROS].filter(r => (!d || r.fecha >= d) && (!h || r.fecha <= h)).sort((a, b) => a.ts - b.ts);
}
function contarExport() {
  const n = enRango().length;
  $('#x_conteo').textContent = `${n} registro${n === 1 ? '' : 's'} en el rango (vacío = todos).`;
}
['#x_desde', '#x_hasta'].forEach(s => $(s).addEventListener('change', contarExport));

$('#x_xlsx').addEventListener('click', () => {
  const l = enRango(); if (!l.length) return toast('No hay registros', 'bad');
  const ws = XLSX.utils.aoa_to_sheet([
    ['CONTROL DE CALIDAD — ANÁLISIS DE JARABES'], ['Generado: ' + new Date().toLocaleString('es-BO')], [],
    COLS, ...l.map(fila)]);
  ws['!cols'] = COLS.map(c => ({ wch: Math.max(11, Math.min(c.length + 3, 26)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analisis');
  const e = XLSX.utils.aoa_to_sheet([
    ['PRODUCTO','ABREV.','FÓRMULA (MMI)','°BRIX ESTÁNDAR','VOLUMEN L/UNIDAD','DÍAS VENC.','AZÚCAR REAL Kg/un','AZÚCAR TEÓRICO Kg/un'],
    ...PRODUCTOS.map(p => [p.producto, p.abrev, p.mmi, p.brix, p.volUnidad, p.dias, p.azReal, p.azTeorico])]);
  e['!cols'] = [{wch:34},{wch:11},{wch:24},{wch:16},{wch:17},{wch:11},{wch:18},{wch:20}];
  XLSX.utils.book_append_sheet(wb, e, 'Especificaciones');
  XLSX.writeFile(wb, `Analisis_Calidad_${hoyISO()}.xlsx`);
  toast('Excel generado', 'ok');
});

$('#x_pdf').addEventListener('click', () => {
  const l = enRango(); if (!l.length) return toast('No hay registros', 'bad');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(244, 0, 9); doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255).setFontSize(14).setFont(undefined, 'bold');
  doc.text('CONTROL DE CALIDAD — ANÁLISIS DE JARABES', 10, 12);
  doc.setFontSize(8).setFont(undefined, 'normal');
  doc.text(new Date().toLocaleString('es-BO'), 287, 12, { align: 'right' });

  doc.autoTable({
    head: [['N°','Fecha','Producto','Tanque','Un.','Azúcar\n[Kg]','°Bx\nJS','Agua\n[L]',
            'Vol. mín\n[L]','Vol. teór.\n[L]','Vol. máx\n[L]','Vol. real\n[L]','°Bx\nreal','Dictamen','Analista']],
    body: l.map((r, i) => [i + 1, fecha(r.fecha), r.producto, r.tanque || '', fmt(r.unidades, 0),
      fmt(r.azucar, 0), r.brixJS != null ? fmt(r.brixJS, 2) : '—',
      r.agua != null && r.agua > 0.5 ? fmt(r.agua, 0) : '—',
      fmt(r.volMin, 0), fmt(r.volTeo, 0), fmt(r.volMax, 0),
      r.volReal != null ? fmt(r.volReal, 0) : '—',
      r.brixReal != null ? fmt(r.brixReal, 2) : '—',
      (r.dictamen || '').toUpperCase() || '—', r.operador || '']),
    startY: 23,
    styles: { fontSize: 7.4, cellPadding: 1.8, halign: 'center', lineColor: [222,226,230], lineWidth: .1, font: 'helvetica' },
    headStyles: { fillColor: [244,0,9], textColor: 255, fontSize: 6.8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248,249,250] },
    columnStyles: { 2: { halign: 'left', cellWidth: 40 } },
    margin: { left: 7, right: 7 },
    didParseCell: d => {
      if (d.section !== 'body') return;
      if (d.column.index === 13) {
        const m = { LIBERADO: [14,143,78], RETENIDO: [178,106,0], RECHAZADO: [194,0,11] }[d.cell.raw];
        if (m) { d.cell.styles.textColor = m; d.cell.styles.fontStyle = 'bold'; }
      }
      if (d.column.index === 7 && d.cell.raw !== '—') d.cell.styles.textColor = [10,111,203];
    },
    didDrawPage: () => {
      doc.setFontSize(7).setTextColor(130);
      doc.text(`Página ${doc.internal.getNumberOfPages()} · Tolerancias: volumen ±${TOL.volumen} % · °Brix ±${TOL.brix}`,
        10, doc.internal.pageSize.getHeight() - 6);
    }
  });
  doc.save(`Analisis_Calidad_${hoyISO()}.pdf`);
  toast('PDF generado', 'ok');
});

$('#x_png').addEventListener('click', async () => {
  const l = enRango(); if (!l.length) return toast('No hay registros', 'bad');
  const head = ['N°','Fecha','Producto','Tanque','Un.','Azúcar [Kg]','°Bx JS','Agua [L]',
    'Vol. mín','Vol. teórico','Vol. máx','Vol. real','°Bx real','Dictamen','Analista'];
  const a = $('#printArea');
  a.innerHTML = `<h2>CONTROL DE CALIDAD — ANÁLISIS DE JARABES</h2>
    <div class="meta">${l.length} registros · ${new Date().toLocaleString('es-BO')}</div>
    <table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
    ${l.map((r, i) => `<tr>
      <td>${i+1}</td><td>${fecha(r.fecha)}</td><td style="text-align:left"><b>${r.producto}</b></td>
      <td>${r.tanque||''}</td><td>${fmt(r.unidades,0)}</td><td>${fmt(r.azucar,0)}</td>
      <td>${r.brixJS!=null?fmt(r.brixJS,2):'—'}</td>
      <td style="color:#0A6FCB;font-weight:800">${r.agua!=null&&r.agua>0.5?fmt(r.agua,0):'—'}</td>
      <td>${fmt(r.volMin,0)}</td><td style="font-weight:800">${fmt(r.volTeo,0)}</td><td>${fmt(r.volMax,0)}</td>
      <td>${r.volReal!=null?fmt(r.volReal,0):'—'}</td>
      <td>${r.brixReal!=null?fmt(r.brixReal,2):'—'}</td>
      <td style="font-weight:800;color:${r.dictamen==='liberado'?'#0E8F4E':r.dictamen==='retenido'?'#B26A00':r.dictamen?'#C2000B':'#98A1AE'}">${(r.dictamen||'—').toUpperCase()}</td>
      <td>${r.operador||''}</td></tr>`).join('')}
    </tbody></table>`;
  await capturar(a, `Analisis_Calidad_${hoyISO()}.png`);
  a.innerHTML = '';
});

async function capturar(el, nombre) {
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, logging: false });
    canvas.toBlob(b => {
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = nombre; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      toast('Imagen generada', 'ok');
    }, 'image/png');
  } catch (e) { console.error(e); toast('No se pudo generar la imagen', 'bad'); }
}

/* ── Respaldo ── */
$('#x_backup').addEventListener('click', () => {
  const b = new Blob([JSON.stringify({ version: 3, exportado: new Date().toISOString(), registros: REGISTROS }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `respaldo_calidad_${hoyISO()}.json`; a.click();
  toast('Respaldo generado', 'ok');
});
$('#x_restore').addEventListener('click', () => $('#x_file').click());
$('#x_file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.registros)) throw 0;
    if (!confirm(`Se importarán ${d.registros.length} registros. ¿Continuar?`)) return;
    for (const r of d.registros) { const c = { ...r }; delete c.id; await DB.put(c); }
    REGISTROS = await DB.all(); renderRegistros(); contarExport();
    toast('Respaldo importado', 'ok');
  } catch { toast('Archivo inválido', 'bad'); }
  e.target.value = '';
});
$('#x_borrar').addEventListener('click', async () => {
  if (!confirm('Esto borrará TODOS los registros. ¿Continuar?')) return;
  await DB.clear(); REGISTROS = [];
  renderRegistros(); contarExport(); toast('Registros borrados');
});

/* ══════════════════ 10 · PWA ══════════════════ */

let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#btnInstall').hidden = false; });
$('#btnInstall').addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt(); await deferred.userChoice;
  deferred = null; $('#btnInstall').hidden = true;
});
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* ══════════════════ 11 · INICIO ══════════════════ */

/** Fecha y hora actual en el formato de <input type="datetime-local"> */
function ahoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

(async function init() {
  llenarSelects();
  renderTabla();
  $('#f_elab').value = ahoraLocal();

  try {
    REGISTROS = await DB.all();
    const op = await DB.get('operador');
    if (op && op.v) $('#f_operador').value = op.v;
    const aj = await DB.get('ajustes');
    if (aj && aj.v) Object.assign(AJUSTES, aj.v);
  } catch (e) { console.warn('Almacenamiento no disponible', e); }

  // Las alarmas solo siguen activas si el permiso sigue concedido
  if (AJUSTES.alarmas && (!('Notification' in window) || Notification.permission !== 'granted'))
    AJUSTES.alarmas = false;

  $('#sw_alarmas').checked = AJUSTES.alarmas;
  $('#alarmaOpts').hidden = !AJUSTES.alarmas;
  $('#a_antelacion').value = String(AJUSTES.antelacion);
  actualizarTextoSwitch();

  contarExport();
  calc();
  renderVencimientos();
  programarAlarmas();

  const v = new URLSearchParams(location.search).get('v');
  const t = v && document.querySelector(`.tab[data-view="${v}"]`);
  if (t) t.click();
})();

window.borrar = borrar;
window.cargar = cargar;
