'use strict';
// Campo de contacto compartido por vista previa, comparación, PNG y módulo web.
const ColonyRelations = (function createColonyRelations() {
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const families = {
    rose: { name: 'Coral / rosa', colors: ['#ff4c52', '#f58bc3', '#f06779'] },
    amber: { name: 'Ámbar / naranja', colors: ['#ff9c20', '#ffc21c', '#efcc6d'] },
    green: { name: 'Verde / lima', colors: ['#27633f', '#6a983a', '#dce642'] }
  };
  const types = {
    symbiosis: { name: 'Simbiosis', cue: 'Un encuentro compartido', description: 'Las dos colonias conservan su cuerpo. En el contacto sus colores se intercambian suavemente, sin agregar una tercera mancha.', pair: ['rose', 'amber'] },
    rejection: { name: 'Rechazo', cue: 'Un vacío alrededor de A', description: 'A conserva su forma. B se recorta alrededor de su halo de exclusión: el espacio vacío también cuenta la relación.', pair: ['green', 'rose'] },
    barrier: { name: 'Barrera', cue: 'Una frontera entre ambas', description: 'Los dos frentes se detienen a cada lado de una franja difusa. La frontera se lee en el borde y su textura, sin una línea dibujada encima.', pair: ['green', 'green'] },
    neutral: { name: 'Neutro', cue: 'Solo superposición', description: 'Los colores se superponen y cada colonia conserva su contorno. No aparece una tercera zona ni se recorta el encuentro.', pair: ['rose', 'rose'] }
  };
  const defaults = { type: 'symbiosis', a: { x: .37, y: .5 }, b: { x: .63, y: .5 }, radiusA: .175, radiusB: .155, familyA: 'rose', familyB: 'amber', intensity: 80, width: 45, blur: 35, grain: 24, irregularity: 25, progress: 100, enabled: true, compare: false, guides: false, plate: true, background: '#fffbee', transparent: false, seed: 125 };
  function normalize(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    const s = { ...defaults };
    for (const [key, lo, hi] of [['radiusA', .08, .24], ['radiusB', .08, .24], ['intensity', 0, 100], ['width', 0, 100], ['blur', 0, 100], ['grain', 0, 70], ['irregularity', 0, 100], ['progress', 0, 100], ['seed', 0, 1000000]]) {
      if (Number.isFinite(raw[key])) s[key] = clamp(raw[key], lo, hi);
    }
    for (const key of ['enabled', 'compare', 'guides', 'plate', 'transparent']) if (typeof raw[key] === 'boolean') s[key] = raw[key];
    if (Object.hasOwn(types, raw.type)) s.type = raw.type;
    for (const key of ['familyA', 'familyB']) if (Object.hasOwn(families, raw[key])) s[key] = raw[key];
    if (['#fffbee', '#202c2e'].includes(raw.background)) s.background = raw.background;
    for (const key of ['a', 'b']) {
      s[key] = { ...defaults[key] };
      if (Number.isFinite(raw[key]?.x) && Number.isFinite(raw[key]?.y)) s[key] = { x: clamp(raw[key].x, .12, .88), y: clamp(raw[key].y, .12, .88) };
      contain(s, key);
    }
    return s;
  }
  function contain(s, key) {
    const p = s[key], reach = Math.max(.02, .435 - s[key === 'a' ? 'radiusA' : 'radiusB'] * 1.12);
    const d = Math.hypot(p.x - .5, p.y - .5);
    if (d > reach) { p.x = .5 + (p.x - .5) * reach / d; p.y = .5 + (p.y - .5) * reach / d; }
  }
  function geometry(s) {
    const growth = .12 + .88 * smooth(s.progress / 100), ra = s.radiusA * growth, rb = s.radiusB * growth;
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, distance = Math.hypot(dx, dy), safe = Math.max(.00001, distance);
    const ux = distance > .00001 ? dx / safe : 1, uy = distance > .00001 ? dy / safe : 0;
    const plane = clamp((distance * distance + ra * ra - rb * rb) / (2 * safe), 0, distance);
    const overlap = ra + rb - distance, contact = smooth(overlap / .025);
    const sharedHalf = Math.sqrt(Math.max(0, ra * ra - plane * plane));
    return { ra, rb, distance, ux, uy, plane, overlap, contact, sharedHalf, gap: (.012 + s.width * .00065) * s.intensity / 100 };
  }
  function hash(x, y, seed) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function contactTexture(x, y, seed) {
    const px = x * 170, py = y * 170, ix = Math.floor(px), iy = Math.floor(py);
    const u = smooth(px - ix), v = smooth(py - iy);
    const top = hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u;
    const bottom = hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u;
    return (top * (1 - v) + bottom * v) - .5;
  }
  function softFront(distance, edge, x, y, s) {
    let t = distance / edge + .5;
    if (t <= -.4) return 0;
    if (t >= 1.4) return 1;
    const fine = hash(Math.floor(x * 1520), Math.floor(y * 1520), s.seed + 917) - .5;
    t += (contactTexture(x, y, s.seed + 239) * .42 + fine * .18) * s.grain / 24;
    return smooth(t);
  }
  function field(x, y, p, radius, s, phase) {
    const dx = x - p.x, dy = y - p.y, angle = Math.atan2(dy, dx);
    const wave = (Math.sin(angle * 7 + s.seed + phase) + .46 * Math.sin(angle * 13 + phase)) * s.irregularity * .00035;
    const d = Math.hypot(dx, dy) / (1 + wave);
    const edge = .003 + s.blur * .00030;
    const body = 1 - smooth((d - radius + edge * .6) / (edge * 1.6));
    const halo = .18 * Math.exp(-Math.max(0, d - radius) / (edge * 1.8)) * (1 - smooth((d - radius) / (edge * 5)));
    return { distance: d - radius, t: clamp(d / radius), alpha: clamp(body + halo) };
  }
  function sample(x, y, s, g, palettes) {
    const a = field(x, y, s.a, g.ra, s, 0), b = field(x, y, s.b, g.rb, s, 2.7);
    let aa = a.alpha, ab = b.alpha, seam = 0, shared = 0;
    const strength = s.enabled ? s.intensity / 100 : 0;
    const contactSoftness = .009 + s.blur * .0005;
    if (strength && s.type === 'rejection') {
      ab *= softFront(a.distance - g.gap, contactSoftness, x, y, s);
    } else if (strength && s.type === 'barrier' && g.contact > 0) {
      const along = (x - s.a.x) * g.ux + (y - s.a.y) * g.uy - g.plane;
      const across = -(x - s.a.x) * g.uy + (y - s.a.y) * g.ux;
      const wobble = .0015 * Math.sin(across * 26 + s.seed);
      const halfGap = g.gap * .30, edge = contactSoftness * .85;
      const cutA = 1 - softFront(along - wobble + halfGap, edge, x, y, s);
      const cutB = softFront(along - wobble - halfGap, edge, x, y, s);
      aa *= 1 - strength * g.contact * (1 - cutA); ab *= 1 - strength * g.contact * (1 - cutB);
      // Solo una densidad tenue dentro de la franja: sin trazo superpuesto.
      const band = Math.exp(-Math.pow((along - wobble) / (edge * .8), 2) * 2);
      const ends = 1 - smooth((Math.abs(across) - g.sharedHalf * .72) / .04);
      seam = band * ends * g.contact * strength * .085;
      if (seam > .001) seam *= clamp(.6 + contactTexture(x, y, s.seed + 821) * s.grain / 18);
    } else if (strength && s.type === 'symbiosis' && g.contact > 0) {
      // Intercambio limitado al material ya presente. No se agrega área ni una
      // elipse cuyo tamaño pueda dispararse cuando los centros se acercan.
      const reach = .28 + s.width * .0055;
      const facing = 1 - smooth(Math.abs(a.t - b.t) / reach);
      shared = Math.min(aa, ab) * facing * g.contact * strength;
    }
    // Multiplicar conserva la mezcla cromática del laboratorio, incluso sin efecto.
    let color = s.transparent ? [255, 255, 255] : palettes.background.slice();
    const ca = mix(palettes.a[0], palettes.a[1], smooth(a.t));
    const cb = mix(palettes.b[0], palettes.b[1], smooth(b.t));
    const multiply = (c, alpha) => { for (let k = 0; k < 3; k++) color[k] *= (1 - alpha + alpha * c[k] / 255); };
    multiply(ca, aa * .92); multiply(cb, ab * .92);
    if (shared) {
      const wa = Math.exp(-a.t * a.t * 3), wb = Math.exp(-b.t * b.t * 3);
      const common = mix(ca, cb, wb / (wa + wb));
      color = mix(color, common, shared * .85);
    }
    if (seam) color = mix(color, palettes.ink, seam);
    const alpha = 1 - (1 - aa) * (1 - ab) * (1 - seam);
    // Convertir la mezcla sobre blanco a RGB recto para PNG con alfa.
    if (s.transparent && alpha > .0001) color = color.map(v => clamp((v - 255 * (1 - alpha)) / alpha, 0, 255));
    const noise = (hash(Math.floor(x * 1520), Math.floor(y * 1520), s.seed) - .5) * s.grain * .8;
    if (alpha > .015) color = color.map(v => clamp(v + noise, 0, 255));
    return { color, alpha: s.transparent ? alpha : 1 };
  }
  function drawPlate(target, n, raw) {
    const s = normalize(raw), g = geometry(s); target.width = target.height = n;
    const c = target.getContext('2d'), im = c.createImageData(n, n), data = im.data;
    const palettes = { a: families[s.familyA].colors.map(rgb), b: families[s.familyB].colors.map(rgb), background: rgb(s.background), ink: rgb(s.background === '#202c2e' ? '#eee4cf' : '#202c2e') };
    // En fondo oscuro se dibuja una base clara de agar, sin convertirla en un halo.
    const dark = s.background === '#202c2e' && !s.transparent;
    const agarPalette = { ...palettes, background: rgb('#fffbee'), ink: rgb('#202c2e') };
    const edge = (.003 + s.blur * .00030) * 5;
    const x0 = Math.min(s.a.x - g.ra - edge, s.b.x - g.rb - edge), x1 = Math.max(s.a.x + g.ra + edge, s.b.x + g.rb + edge);
    const y0 = Math.min(s.a.y - g.ra - edge, s.b.y - g.rb - edge), y1 = Math.max(s.a.y + g.ra + edge, s.b.y + g.rb + edge);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const nx = (x + .5) / n, ny = (y + .5) / n, k = (y * n + x) * 4;
      const local = dark && (nx - .5) ** 2 + (ny - .5) ** 2 < .445 ** 2 ? agarPalette : palettes;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) {
        if (!s.transparent) { data[k] = local.background[0]; data[k + 1] = local.background[1]; data[k + 2] = local.background[2]; data[k + 3] = 255; }
        continue;
      }
      const p = sample(nx, ny, s, g, local);
      data[k] = p.color[0]; data[k + 1] = p.color[1]; data[k + 2] = p.color[2]; data[k + 3] = Math.round(p.alpha * 255);
    }
    c.putImageData(im, 0, 0);
    if (s.plate) {
      c.strokeStyle = s.background === '#202c2e' && !s.transparent ? '#b6c6a6' : '#8a8e5c'; c.globalAlpha = .3; c.lineWidth = n / 1100;
      c.beginPath(); c.arc(n * .5, n * .5, n * .445, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
  }
  function draw(target, n, raw, clean = false) {
    const s = normalize(raw);
    if (!s.compare) { drawPlate(target, n, s); return; }
    target.width = target.height = n;
    const c = target.getContext('2d');
    if (!s.transparent) { c.fillStyle = s.background; c.fillRect(0, 0, n, n); }
    const cell = Math.round(n * .46), margin = n * .027, plate = document.createElement('canvas');
    Object.keys(types).forEach((type, i) => {
      const x = margin + (i % 2) * n * .5, y = margin + Math.floor(i / 2) * n * .5;
      drawPlate(plate, cell, { ...s, type, compare: false }); c.drawImage(plate, x, y);
      c.fillStyle = s.background === '#202c2e' ? '#eee4cf' : '#202c2e'; c.font = `${n * .019}px Arial`; c.textAlign = 'center';
      c.fillText(types[type].name, x + cell / 2, y + cell - n * .006);
    });
  }
  function moduleSource(recipe) {
    return `const ColonyRelations = (${createColonyRelations.toString()})();\nexport const recipe = ${JSON.stringify(recipe, null, 2)};\nexport function mountColonias(canvas, options = {}) {\n let state=ColonyRelations.normalize(options.recipe?.relation || recipe.relation),raf=0,playing=false,destroyed=false;\n const draw=()=>{if(!destroyed)ColonyRelations.draw(canvas,Math.max(64,Math.min(1800,Math.round(canvas.getBoundingClientRect().width*(devicePixelRatio||1)))),state,true)};\n const pause=()=>{playing=false;cancelAnimationFrame(raf)};\n const setProgress=value=>{state.progress=Math.max(0,Math.min(1,Number(value)||0))*100;draw()};\n const play=({duration=9000,loop=false}={})=>{pause();playing=true;const start=performance.now();const tick=now=>{if(!playing||destroyed)return;const t=(now-start)/Math.max(100,duration);setProgress(loop?t%1:Math.min(1,t));if(t<1||loop)raf=requestAnimationFrame(tick);else playing=false};raf=requestAnimationFrame(tick)};\n canvas.style.width='100%';canvas.style.height='auto';const observer=new ResizeObserver(draw);observer.observe(canvas);draw();\n return {draw,pause,play,setProgress,getRecipe:()=>({...recipe,relation:structuredClone(state)}),destroy(){destroyed=true;pause();observer.disconnect()}};\n}\n`;
  }
  return { defaults, families, types, normalize, contain, geometry, draw, drawPlate, moduleSource };
})();
