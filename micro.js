'use strict';
// ─────────────────────────────────────────────────────────────
// Modo MICRO · campo microscópico
// Células interpretativas (no identifican especies) en planos de foco:
// lo lejano se ve más desenfocado y lo cercano, nítido.
// Bacterias = familia rosa · Levaduras = familia amarilla · Mohos = familia verde.
// ─────────────────────────────────────────────────────────────

// Dibuja un campo micro completo en un canvas. No depende de la página:
// se copia tal cual en "Exportar para web".
function microRender(target, W, H, P) {
  W = Math.max(16, Math.round(W)); H = Math.max(16, Math.round(H));
  target.width = W; target.height = H;
  const ctx = target.getContext('2d');
  const FAM = {
    bacterias: ['#ff4c52', '#f06779', '#ed74a0', '#f58bc3', '#dfb5ab'],
    levaduras: ['#ffc21c', '#ff9c20', '#e8ae2f', '#efcc6d', '#eee4cf'],
    mohos: ['#27633f', '#6a983a', '#dce642', '#8a8e5c', '#b6c6a6']
  };
  // Generador al azar con semilla: la misma receta da siempre el mismo campo.
  let s = (P.seed >>> 0) || 1;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + (b - a) * rnd();
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v * (1 - t) + B[i] * t)); };
  const lum = h => { const [r, g, b] = hex(h); return (r * .299 + g * .587 + b * .114) / 255; };

  const transparent = P.background === 'transparent';
  const bg = transparent ? '#202c2e' : P.background;
  const dark = lum(bg) < .45;
  const U = Math.sqrt(W * H) / 100;            // unidad relativa al tamaño del campo
  const base = U * 2.6 * P.size / 100;         // radio base de una célula

  const groups = Object.keys(FAM).filter(g => P.groups[g]);
  if (!groups.length) groups.push('bacterias');
  const FORMS = {
    bacterias: ['baston', 'coco', 'cadena', 'racimo', 'espiral'],
    levaduras: ['levadura', 'pseudohifa'],
    mohos: ['hifa', 'esporas']
  };

  // 1 · Fondo
  ctx.clearRect(0, 0, W, H);
  if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }

  // 2 · Manchas de fondo: el campo fuera de foco
  if (P.washes > 0) {
    const wash = document.createElement('canvas'); wash.width = W; wash.height = H;
    const wc = wash.getContext('2d');
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const g = pick(groups), col = i % 3 === 2 ? pick(['#8a8e5c', '#80664d', '#b6c6a6', '#462817']) : pick(FAM[g]);
      const rx = W * between(.16, .42), ry = H * between(.3, .75);
      wc.globalAlpha = P.washes / 100 * (dark ? .5 : .42) * between(.5, 1);
      wc.fillStyle = col; wc.beginPath();
      wc.ellipse(W * between(-.05, 1.05), H * between(-.1, 1.1), rx, ry, between(-1, 1), 0, Math.PI * 2); wc.fill();
    }
    ctx.save(); ctx.filter = `blur(${U * 9}px)`; ctx.drawImage(wash, 0, 0); ctx.restore();
  }

  // 3 · Células: cada una es una lista de piezas simples
  const enabled = [];
  for (const g of groups) for (const f of FORMS[g]) if (P.forms[f]) enabled.push([g, f]);
  if (!enabled.length) enabled.push([groups[0], FORMS[groups[0]][0]]);
  const planes = Math.max(1, Math.min(3, Math.round(P.planes)));
  const cells = [];

  function colorsFor(g) {
    const fam = FAM[g], rimIdx = Math.floor(rnd() * 4), rim = fam[rimIdx];
    let fill = null;
    if (P.fill === 'vecino') { let j = Math.floor(rnd() * fam.length); if (j === rimIdx) j = (j + 2) % fam.length; fill = fam[j]; }
    else if (P.fill === 'claro') fill = mix(rim, '#fffbee', .62);
    else if (P.fill === 'fondo') fill = mix(rim, bg, .72);
    else if (P.fill === 'oscuro') fill = mix(rim, '#202c2e', .72);
    return { rim, fill, alt: fam[(rimIdx + 1 + Math.floor(rnd() * 3)) % fam.length] };
  }
  function chainOfDots(x, y, a, n, r, gap, curve) {
    const out = [];
    for (let i = 0; i < n; i++) { out.push({ k: 'ell', x, y, rx: r, ry: r, a: 0 }); a += curve; x += Math.cos(a) * r * gap; y += Math.sin(a) * r * gap; }
    return out;
  }
  function makeCell(g, f, x, y, sz) {
    const a = rnd() * Math.PI * 2, p = [], c = colorsFor(g);
    let width = sz * .26;
    if (f === 'baston') p.push({ k: 'cap', x, y, len: sz * between(1.4, 3), r: sz * between(.42, .6), a });
    else if (f === 'coco') p.push({ k: 'ell', x, y, rx: sz * between(.5, .75), ry: 0, a: 0 });
    else if (f === 'cadena') p.push(...chainOfDots(x, y, a, rnd() < .2 ? 2 : 3 + Math.floor(rnd() * 7), sz * .4, 1.95, between(-.25, .25)));
    else if (f === 'racimo') {
      const n = 6 + Math.floor(rnd() * 8), r = sz * .4;
      for (let i = 0; i < n; i++) { const t = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * sz * 1.3; p.push({ k: 'ell', x: x + Math.cos(t) * d, y: y + Math.sin(t) * d, rx: r, ry: r, a: 0 }); }
    } else if (f === 'espiral') {
      const len = sz * between(4.5, 9), amp = sz * between(.32, .6), wl = sz * between(1.2, 2), pts = [];
      for (let t = 0; t <= len; t += sz * .12) { const o = Math.sin(t / wl * Math.PI * 2) * amp; pts.push([x + Math.cos(a) * t - Math.sin(a) * o, y + Math.sin(a) * t + Math.cos(a) * o]); }
      width = sz * between(.14, .24); p.push({ k: 'line', pts, w: width });
    } else if (f === 'levadura') {
      const rx = sz * between(.85, 1.2), ry = rx * between(.72, .86), rb = rx * between(.32, .55);
      const d = rx * .98 + rb * .55;
      p.push({ k: 'ell', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, rx: rb, ry: rb * .86, a });   // brote (gemación)
      p.push({ k: 'ell', x, y, rx, ry, a });
    } else if (f === 'pseudohifa') {
      let dir = a, cx = x, cy = y; const n = 3 + Math.floor(rnd() * 3), rx = sz * .95, ry = sz * .52;
      for (let i = 0; i < n; i++) { p.push({ k: 'ell', x: cx, y: cy, rx: rx * between(.85, 1.05), ry, a: dir }); dir += between(-.35, .35); cx += Math.cos(dir) * rx * 1.75; cy += Math.sin(dir) * rx * 1.75; }
      p.reverse();
    } else if (f === 'hifa') {
      width = sz * between(.3, .42);
      const grow = (x0, y0, dir, steps, depth) => {
        const pts = [[x0, y0]]; let px = x0, py = y0;
        for (let i = 0; i < steps; i++) {
          dir += between(-.22, .22); px += Math.cos(dir) * sz * .8; py += Math.sin(dir) * sz * .8; pts.push([px, py]);
          if (i % 4 === 3 && i < steps - 1) {           // septos: tabiques dentro del filamento
            const nx = -Math.sin(dir), ny = Math.cos(dir), h = width * .5;
            p.push({ k: 'septo', pts: [[px + nx * h, py + ny * h], [px - nx * h, py - ny * h]] });
          }
          if (depth > 0 && i > 1 && rnd() < .2) grow(px, py, dir + (rnd() < .5 ? -1 : 1) * between(.5, .95), Math.max(3, Math.floor(steps * between(.35, .6))), depth - 1);
        }
        p.unshift({ k: 'line', pts, w: width });
        if (P.forms.esporas && rnd() < .55) p.push(...chainOfDots(px + Math.cos(dir) * width, py + Math.sin(dir) * width, dir, 3 + Math.floor(rnd() * 5), sz * .26, 2.05, between(-.2, .2)).map(q => ({ ...q, spore: true })));
      };
      grow(x, y, a, 6 + Math.floor(rnd() * 7), 1);
    } else if (f === 'esporas') {
      p.push(...chainOfDots(x, y, a, 5 + Math.floor(rnd() * 6), sz * .3, 2.2, between(-.18, .18)).map(q => ({ ...q, spore: true })));
    }
    for (const q of p) if (q.k === 'ell' && !q.ry) q.ry = q.rx;
    return { g, f, p, c, w: width };
  }

  const weights = planes === 1 ? [1] : planes === 2 ? [.55, .45] : [.42, .33, .25];   // lejos → cerca
  for (let i = 0; i < Math.round(P.count); i++) {
    let r = rnd(), plane = 0; for (; plane < planes - 1; plane++) { r -= weights[plane]; if (r < 0) break; }
    const [g, f] = pick(enabled);
    const depth = planes === 1 ? 1 : plane / (planes - 1);           // 0 lejos · 1 cerca
    const sz = base * (1 + (rnd() - .5) * P.sizeVar / 50) * (1.25 - depth * .25);
    const cell = makeCell(g, f, between(-.04, 1.04) * W, between(-.06, 1.06) * H, sz);
    cell.plane = plane; cell.depth = depth;
    cell.ringed = depth < .99 && rnd() < P.rings / 100;
    cells.push(cell);
  }

  // Piezas → trazos
  function pathOf(q) {
    const path = new Path2D();
    if (q.k === 'ell') path.ellipse(q.x, q.y, q.rx, q.ry, q.a, 0, Math.PI * 2);
    else if (q.k === 'cap') {
      const h = q.len / 2, ux = Math.cos(q.a), uy = Math.sin(q.a);
      path.arc(q.x + ux * h, q.y + uy * h, q.r, q.a - Math.PI / 2, q.a + Math.PI / 2);
      path.arc(q.x - ux * h, q.y - uy * h, q.r, q.a + Math.PI / 2, q.a + Math.PI * 1.5);
      path.closePath();
    } else { q.pts.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); }
    return path;
  }
  function drawCell(c2, cell) {
    const rimW = Math.max(1, base * P.rim / 100);
    c2.lineCap = 'round'; c2.lineJoin = 'round';
    for (const q of cell.p) {
      const path = pathOf(q), rim = q.spore ? cell.c.alt : cell.c.rim;
      if (q.k === 'septo') { c2.strokeStyle = rim; c2.lineWidth = rimW * .7; c2.stroke(path); continue; }
      if (q.k === 'line') {
        c2.strokeStyle = rim; c2.lineWidth = q.w; c2.stroke(path);
        if (cell.c.fill && q.w > rimW * 2.2) { c2.strokeStyle = cell.c.fill; c2.lineWidth = q.w - rimW * 2; c2.stroke(path); }
        continue;
      }
      if (cell.c.fill) { c2.fillStyle = q.spore ? mix(cell.c.alt, cell.c.fill, .5) : cell.c.fill; c2.fill(path); }
      c2.strokeStyle = rim; c2.lineWidth = rimW; c2.stroke(path);
      if (cell.ringed && q.k === 'ell' && !q.spore) {   // anillos de desenfoque, como al girar el foco
        const ring = new Path2D(); ring.ellipse(q.x, q.y, q.rx * 1.5, q.ry * 1.5, q.a, 0, Math.PI * 2);
        c2.save(); c2.globalAlpha = .55; c2.lineWidth = rimW * 2.2; c2.strokeStyle = cell.c.alt; c2.stroke(ring);
        const core = new Path2D(); core.ellipse(q.x, q.y, q.rx * .45, q.ry * .45, q.a, 0, Math.PI * 2);
        c2.globalAlpha = .8; c2.fillStyle = mix(cell.c.alt, bg, .45); c2.fill(core); c2.restore();
      }
    }
  }

  // 4 · Planos de foco: de lejos (más blur) a cerca (nítido)
  for (let plane = 0; plane < planes; plane++) {
    const list = cells.filter(c => c.plane === plane); if (!list.length) continue;
    const depth = planes === 1 ? 1 : plane / (planes - 1);
    const blur = (P.frontBlur + (P.farBlur - P.frontBlur) * (1 - depth)) * U / 30;
    const layer = document.createElement('canvas'); layer.width = W; layer.height = H; const lc = layer.getContext('2d');
    for (const c of list) drawCell(lc, c, 'body');
    ctx.save(); ctx.globalAlpha = .7 + .3 * depth; if (blur > .2) ctx.filter = `blur(${blur}px)`; ctx.drawImage(layer, 0, 0); ctx.restore();
  }

  // 5 · Grano: unifica todos los planos
  if (P.grain > 0) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data, amount = P.grain / 100 * 95;
    const cell = Math.max(1, Math.round(W / 1400)), cols = Math.ceil(W / cell);
    let gs = ((P.seed * 2654435761) >>> 0) || 7, noise = new Float32Array(cols * Math.ceil(H / cell));
    for (let i = 0; i < noise.length; i++) { gs ^= gs << 13; gs ^= gs >>> 17; gs ^= gs << 5; noise[i] = ((gs >>> 0) / 4294967296 - .5) * amount; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; if (!d[i + 3]) continue;
      const n = noise[Math.floor(y / cell) * cols + Math.floor(x / cell)];
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  // 6 · Lente: recorte circular con borde suave
  if (P.lens) {
    const r = Math.min(W, H) / 2, g = ctx.createRadialGradient(W / 2, H / 2, r * .9, W / 2, H / 2, r);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  return target;
}

// ─────────────────────────────────────────────────────────────
// Panel y conexión con la herramienta
// ─────────────────────────────────────────────────────────────
(function () {
  const MICRO_BASE = {
    version: 1, kind: 'micro', seed: 2611,
    groups: { bacterias: true, levaduras: true, mohos: true },
    forms: { baston: true, coco: true, cadena: true, racimo: false, espiral: true, levadura: true, pseudohifa: false, hifa: true, esporas: true },
    count: 36, size: 100, sizeVar: 45, planes: 3, farBlur: 34, frontBlur: 8, rings: 25,
    rim: 28, fill: 'fondo', background: '#202c2e', washes: 65, grain: 24, format: 'landscape', lens: false
  };
  const RATIOS = { landscape: 9 / 16, strip: 1 / 3, square: 1, portrait: 5 / 4 };
  const RANGES = [
    ['count', 'Cantidad de células', 4, 140, 1, ''],
    ['size', 'Tamaño', 30, 250, 1, '%'],
    ['sizeVar', 'Variación de tamaño', 0, 100, 1, '%'],
    ['planes', 'Planos de foco', 1, 3, 1, ''],
    ['farBlur', 'Blur del plano lejano', 0, 90, 1, ' px'],
    ['frontBlur', 'Blur del plano cercano', 0, 30, 1, ' px'],
    ['rings', 'Anillos de desenfoque', 0, 100, 1, '%'],
    ['rim', 'Grosor del borde', 6, 60, 1, '%'],
    ['washes', 'Manchas de fondo', 0, 100, 1, '%'],
    ['grain', 'Grano', 0, 70, 1, '%']
  ];
  const FORM_LABELS = {
    bacterias: [['baston', 'Bastones'], ['coco', 'Esferas sueltas'], ['cadena', 'Esferas en cadena'], ['racimo', 'Esferas en racimo'], ['espiral', 'Espirales']],
    levaduras: [['levadura', 'Con brote'], ['pseudohifa', 'En cadena']],
    mohos: [['hifa', 'Filamentos (hifas)'], ['esporas', 'Esporas']]
  };
  const GROUP_LABELS = { bacterias: 'Bacterias · rosa', levaduras: 'Levaduras · amarillo', mohos: 'Mohos · verde' };
  let P = structuredClone(MICRO_BASE), on = false, queued = false;
  try { const saved = JSON.parse(localStorage.getItem('colonias-micro-v1')); if (saved?.kind === 'micro') P = clean(saved); } catch {}

  function clean(raw) {
    const out = structuredClone(MICRO_BASE);
    for (const k of Object.keys(MICRO_BASE)) {
      if (raw[k] === undefined) continue;
      if (typeof MICRO_BASE[k] === 'object') { for (const j of Object.keys(MICRO_BASE[k])) if (typeof raw[k]?.[j] === 'boolean') out[k][j] = raw[k][j]; }
      else if (typeof raw[k] === typeof MICRO_BASE[k]) out[k] = raw[k];
    }
    for (const [k, , min, max] of RANGES) out[k] = Math.min(max, Math.max(min, out[k]));
    if (!(out.format in RATIOS)) out.format = 'landscape';
    if (!['fondo', 'oscuro', 'vecino', 'claro', 'vacio'].includes(out.fill)) out.fill = 'fondo';
    if (out.background !== 'transparent' && !/^#[0-9a-f]{6}$/i.test(out.background)) out.background = MICRO_BASE.background;
    return out;
  }

  const css=document.createElement('style');css.textContent='.micro-group .color-mix-fields label.check{display:flex;justify-content:flex-start;gap:8px;margin:6px 0;font-size:12px}.micro-group legend label.check{display:flex;gap:8px;align-items:center}.micro-group input[type=checkbox]{width:auto;flex:none;margin:0}';document.head.append(css);

  // Botón de modo
  const sw = $('singleMode').parentElement; sw.style.gridTemplateColumns = '1fr 1fr 1fr';
  const btn = document.createElement('button'); btn.id = 'microMode'; btn.textContent = 'Micro'; btn.setAttribute('aria-pressed', 'false');
  btn.title = 'Campo microscópico: células en planos de foco'; sw.append(btn);

  // Panel izquierdo · células
  const left = document.createElement('section'); left.id = 'microTools'; left.hidden = true;
  let html = '<h2>Campo micro</h2><p class="helper">Lo que no se ve a simple vista. Formas interpretativas: no identifican especies ni representan escala.</p>';
  for (const g of Object.keys(GROUP_LABELS)) {
    html += `<fieldset class="color-mix micro-group"><legend><label class="check" style="margin:0"><input type="checkbox" data-group="${g}"> ${GROUP_LABELS[g]}</label></legend><div class="color-mix-fields">`;
    for (const [f, label] of FORM_LABELS[g]) html += `<label class="check"><input type="checkbox" data-form="${f}"> ${label}</label>`;
    html += '</div></fieldset>';
  }
  html += '<div id="microRangesA"></div><button id="microNew" class="wide primary">Nuevo campo micro ↻</button>';
  html += '<p class="helper">Mismo campo, distinta disposición. Guardá la receta para volver a este resultado.</p>';
  left.innerHTML = html;
  $('creationPanel').children[0].after(left);

  // Panel derecho · foco, materia, fondo
  const right = document.createElement('section'); right.id = 'microOutput'; right.hidden = true;
  right.innerHTML = `<h2>Foco y materia</h2><div id="microRangesB"></div>
    <label>Interior de la célula<select id="microFill">
      <option value="fondo">Hacia el fondo</option><option value="oscuro">Hacia oscuro · Carbón</option><option value="vecino">Tono vecino de la familia</option>
      <option value="claro">Hacia crema</option><option value="vacio">Vacío · solo borde</option></select></label>
    <h2 style="margin-top:24px">Fondo y exportación</h2>
    <label>Fondo<select id="microBg">
      <option value="#202c2e">Carbón</option><option value="#28180f">Pardo oscuro</option>
      <option value="#27633f">Verde profundo</option><option value="#6a983a">Verde</option><option value="#dce642">Lima</option><option value="#bd351d">Rojo óxido</option><option value="#ff4c52">Coral</option><option value="#e8ae2f">Oro</option><option value="#ffc21c">Ámbar</option><option value="#efcc6d">Oro pálido</option><option value="#f2f0e8">Papel</option>
      <option value="#fffbee">Crema</option><option value="#eee4cf">Hueso</option>
      <option value="transparent">Transparente</option></select></label>
    <label>Formato<select id="microFormat">
      <option value="landscape">Horizontal · 16:9 (pantalla)</option><option value="strip">Franja · 3:1</option>
      <option value="square">Cuadrado · 1:1</option><option value="portrait">Vertical · 4:5</option></select></label>
    <label class="check"><input id="microLens" type="checkbox"> Recorte circular (lente)</label>
    <p class="note">Usá "Exportar PNG" arriba (toma el tamaño de "Tamaño PNG"). Con fondo transparente o lente, el PNG queda listo para superponer en el prototipo.</p>`;
  $('editPanel').prepend(right);

  function addRanges(host, keys) {
    for (const [k, title, min, max, step, unit] of RANGES.filter(r => keys.includes(r[0]))) {
      const l = document.createElement('label');
      l.innerHTML = `<span>${title}<output id="mi_${k}Value"></output></span><input id="mi_${k}" type="range" min="${min}" max="${max}" step="${step}">`;
      host.append(l);
      $('mi_' + k).addEventListener('input', () => { P[k] = +$('mi_' + k).value; $('mi_' + k + 'Value').value = P[k] + unit; draw(); });
    }
  }
  addRanges($('microRangesA'), ['count', 'size', 'sizeVar']);
  addRanges($('microRangesB'), ['planes', 'farBlur', 'frontBlur', 'rings', 'rim', 'washes', 'grain']);
  left.querySelectorAll('[data-group]').forEach(i => i.addEventListener('change', () => { P.groups[i.dataset.group] = i.checked; syncDisabled(); draw(); }));
  left.querySelectorAll('[data-form]').forEach(i => i.addEventListener('change', () => { P.forms[i.dataset.form] = i.checked; draw(); }));
  $('microFill').onchange = () => { P.fill = $('microFill').value; draw(); };
  $('microBg').onchange = () => { P.background = $('microBg').value; draw(); };
  $('microFormat').onchange = () => { P.format = $('microFormat').value; microFit(); draw(); };
  $('microLens').onchange = () => { P.lens = $('microLens').checked; draw(); };
  $('microNew').onclick = () => { P.seed = Math.floor(Math.random() * 100000); draw(); };

  function syncDisabled() {
    for (const g of Object.keys(FORM_LABELS)) for (const [f] of FORM_LABELS[g]) left.querySelector(`[data-form="${f}"]`).disabled = !P.groups[g];
  }
  function syncUI() {
    for (const [k, , , , , unit] of RANGES) { $('mi_' + k).value = P[k]; $('mi_' + k + 'Value').value = P[k] + unit; }
    left.querySelectorAll('[data-group]').forEach(i => i.checked = P.groups[i.dataset.group]);
    left.querySelectorAll('[data-form]').forEach(i => i.checked = P.forms[i.dataset.form]);
    $('microFill').value = P.fill; $('microBg').value = P.background; $('microFormat').value = P.format; $('microLens').checked = P.lens;
    syncDisabled();
  }

  function microFit() {
    const box = document.querySelector('.workspace').getBoundingClientRect(), r = RATIOS[P.format];
    const w = Math.max(100, Math.min(box.width - 60, (box.height - 40) / r));
    $('art').style.width = w + 'px'; $('art').style.height = (w * r) + 'px'; $('art').style.aspectRatio = '1 / ' + r;
  }
  function draw() {
    if (!on || queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false; if (!on) return;
      const w = Math.min(1600, Math.round($('art').getBoundingClientRect().width * Math.min(2, devicePixelRatio || 1)) || 1200);
      microRender($('canvas'), w, w * RATIOS[P.format], P);
      const clear = P.background === 'transparent' || P.lens;
      $('art').classList.toggle('checker', clear); $('art').style.backgroundColor = clear ? '' : P.background;
      $('name').textContent = `Micro / ${Math.round(P.count)} células · semilla ${P.seed}`;
      try { localStorage.setItem('colonias-micro-v1', JSON.stringify(P)); } catch {}
    });
  }

  const HIDE = ['addTools', 'constructionSection', 'colorSection', 'materialSection', 'outputTools', 'compositionTools', 'layerTools', 'timeline', 'resizeHandles'];
  function enter() {
    if (on) return;
    setMode('single');
    on = true;
    for (const id of HIDE) if ($(id)) $(id).hidden = true;
    left.hidden = right.hidden = false;
    $('singleMode').setAttribute('aria-pressed', 'false'); $('pieceMode').setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-pressed', 'true');
    $('modeTag').textContent = 'Micro'; status('');
    $('canvasHelp').textContent = 'Campo micro · lo lejano más desenfocado, lo cercano nítido · Exportá PNG, receta o código para web';
    syncUI(); microFit(); draw();
  }
  function leave() {
    if (!on) return; on = false;
    left.hidden = right.hidden = true; btn.setAttribute('aria-pressed', 'false');
    for (const id of ['addTools', 'constructionSection', 'colorSection', 'materialSection', 'outputTools']) $(id).hidden = false;
    $('art').style.backgroundColor = ''; $('art').classList.remove('checker');
  }
  btn.addEventListener('click', enter);

  // Mientras el modo Micro está activo, el lienzo y los botones de arriba trabajan con el campo micro.
  const prevSchedule = schedule; schedule = function () { if (on) draw(); else prevSchedule(); };
  const prevFit = fit; fit = function () { if (on) microFit(); else prevFit(); };
  window.addEventListener('resize', () => { if (on) { microFit(); draw(); } });

  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.hidden = true; document.body.append(fileInput);
  fileInput.onchange = async () => {
    try { const raw = JSON.parse(await fileInput.files[0].text()); if (raw.kind !== 'micro') throw Error('Esta receta no es de un campo micro.'); P = clean(raw); syncUI(); microFit(); draw(); status('Receta micro restaurada.'); }
    catch (e) { status(e.message); }
    fileInput.value = '';
  };

  function exportPNG() {
    const n = +$('resolution').value; $('status').textContent = 'Preparando PNG…';
    setTimeout(() => {
      try {
        const c = microRender(document.createElement('canvas'), n, n * RATIOS[P.format], P);
        c.toBlob(b => { if (!b) { status('No se pudo generar el PNG.'); return; } download(b, `micro-${P.seed}.png`); status(`PNG de ${c.width} × ${c.height} descargado.`); }, 'image/png');
      } catch (e) { status('No se pudo exportar: ' + e.message); }
    }, 40);
  }
  function exportWeb() {
    const recipe = JSON.stringify(P, null, 2);
    const page = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Campo micro ${P.seed}</title>
<style>html,body{margin:0;height:100%;background:${P.background === 'transparent' ? '#f2f0e8' : P.background}}canvas{display:block;width:100%;height:100%;object-fit:cover}</style></head>
<body><canvas id="micro"></canvas>
<script>
// Campo micro generado con Colonias · laboratorio gráfico.
// Para cambiarlo, editá la receta (RECETA) o pegá otra exportada desde la herramienta.
const RECETA = ${recipe};
${microRender.toString()}
function dibujar(){ const c=document.getElementById('micro'); microRender(c, innerWidth*Math.min(2,devicePixelRatio||1), innerHeight*Math.min(2,devicePixelRatio||1), RECETA); }
dibujar(); addEventListener('resize', dibujar);
<\/script></body></html>`;
    download(new Blob([page], { type: 'text/html' }), `campo-micro-${P.seed}.html`);
    status('Página web del campo micro descargada.');
  }

  window.addEventListener('click', e => {
    const t = e.target.closest?.('#export,#save,#open,#exportWeb,#singleMode,#pieceMode');
    if (!t || !on) return;
    if (t.id === 'singleMode' || t.id === 'pieceMode') { leave(); return; }   // sigue hacia el cambio de modo normal
    e.stopImmediatePropagation(); e.preventDefault();
    if (t.id === 'export') exportPNG();
    else if (t.id === 'save') { download(new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' }), `micro-receta-${P.seed}.json`); status('Receta micro descargada.'); }
    else if (t.id === 'open') fileInput.click();
    else if (t.id === 'exportWeb') exportWeb();
  }, true);
})();
