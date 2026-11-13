// Invariantes del campo: contacto local, reversibilidad y paridad con la exportación.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/relations-renderer.js', 'utf8');
function canvas() {
  let image;
  return { width: 0, height: 0, style: {}, getBoundingClientRect: () => ({ width: 160 }), getContext: () => ({
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(im) { image = im; }, beginPath() {}, arc() {}, stroke() {}, fillRect() {}, drawImage() {}, fillText() {}
  }), pixels: () => image.data };
}
const document = { createElement: canvas };
const R = new Function('document', source + ';return ColonyRelations')(document);
const settings = R.normalize({ transparent: true, plate: false, grain: 0, irregularity: 0, intensity: 100 });
function pixels(type, overrides = {}) { const c = canvas(); R.drawPlate(c, 160, { ...settings, type, ...overrides }); return c.pixels(); }
const area = p => { let sum = 0; for (let k = 3; k < p.length; k += 4) sum += p[k]; return sum; };
const neutral = pixels('neutral'), symbiosis = pixels('symbiosis'), rejection = pixels('rejection'), barrier = pixels('barrier');
const alpha = p => Array.from(p.filter((_, i) => i % 4 === 3));
assert.deepEqual(alpha(symbiosis), alpha(neutral), 'Simbiosis comparte el material existente sin agrandar la mancha');
assert.notDeepEqual(symbiosis, neutral, 'El intercambio de color se distingue de multiplicar dos colonias');
for (const distance of [0, .04, .09, .2, .3]) for (const width of [0, 39, 100]) {
  const pair = { a: { x: .5 - distance / 2, y: .5 }, b: { x: .5 + distance / 2, y: .5 }, width };
  assert.deepEqual(alpha(pixels('symbiosis', pair)), alpha(pixels('neutral', pair)), 'Mucha superposición o ancho máximo no generan un tercer cuerpo');
}
assert.ok(area(rejection) < area(neutral) * .97, 'El rechazo retira B de la zona de exclusión');
assert.ok(area(barrier) < area(neutral) * .97, 'La barrera separa ambos frentes');
assert.notDeepEqual(barrier, rejection, 'La frontera bilateral difiere del recorte unilateral');
for (const type of Object.keys(R.types)) {
  assert.deepEqual(pixels(type, { enabled: false }), neutral, 'Sin efecto conserva la misma superposición: ' + type);
  assert.deepEqual(pixels(type, { intensity: 0 }), neutral, 'Intensidad cero conserva la referencia: ' + type);
  const apart = { a: { x: .24, y: .5 }, b: { x: .76, y: .5 } };
  assert.deepEqual(pixels(type, apart), pixels('neutral', apart), 'No aparece relación lejos del contacto: ' + type);
  assert.deepEqual(pixels(type), pixels(type), 'La semilla reproduce el mismo estado: ' + type);
  pixels(type, { progress: 0 });
  assert.deepEqual(pixels(type), pixels(type, { progress: 100 }), 'Volver al instante final recupera el mismo material: ' + type);
}
// El recorte no afecta el centro de A ni el extremo libre de B.
const at = (p, x, y) => Array.from(p.slice((Math.floor(y * 160) * 160 + Math.floor(x * 160)) * 4, (Math.floor(y * 160) * 160 + Math.floor(x * 160)) * 4 + 4));
assert.deepEqual(at(rejection, .32, .5), at(neutral, .32, .5));
assert.deepEqual(at(rejection, .72, .5), at(neutral, .72, .5));
assert.equal(at(neutral, .05, .05)[3], 0, 'El PNG transparente no incorpora un fondo opaco');
function transitionCount(p) { let count = 0; for (let x = 88; x < 104; x++) { const value = p[(80 * 160 + x) * 4 + 3]; if (value > 8 && value < 245) count++; } return count; }
assert.ok(transitionCount(pixels('rejection', { blur: 70 })) > transitionCount(pixels('rejection', { blur: 10 })), 'La suavidad abre una transición más amplia en el recorte');
for (const type of ['rejection', 'barrier']) assert.notDeepEqual(alpha(pixels(type, { grain: 40 })), alpha(pixels(type, { grain: 0 })), 'El grano también afecta el frente, no solo su color: ' + type);
for (const type of Object.keys(R.types)) {
  const p = pixels(type, { a: { x: .5, y: .5 }, b: { x: .5, y: .5 } });
  assert.ok(area(p) > 0, 'Centros coincidentes siguen siendo renderizables');
}
const bad = R.normalize({ radiusA: NaN, radiusB: 800, intensity: Infinity, familyA: '__proto__', type: 'constructor', a: { x: 999, y: -999 } });
assert.equal(bad.radiusA, R.defaults.radiusA); assert.equal(bad.radiusB, .24); assert.equal(bad.familyA, 'rose'); assert.equal(bad.type, 'symbiosis');
assert.ok(Math.hypot(bad.a.x - .5, bad.a.y - .5) < .3);
// Mismo campo en el módulo autónomo, incluyendo cambio y retroceso de progreso.
(async () => {
  const recipe = { version: 3, mode: 'relations', relation: settings }, module = R.moduleSource(recipe);
  const context = vm.createContext({ document, structuredClone, devicePixelRatio: 1, ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  vm.runInContext(module.replace(/^export /gm, ''), context);
  const target = canvas(); context.target = target;
  vm.runInContext('var artwork=mountColonias(target)', context);
  assert.deepEqual(target.pixels(), symbiosis, 'La exportación web dibuja los mismos píxeles');
  vm.runInContext('artwork.setProgress(.3);artwork.setProgress(1)', context);
  assert.deepEqual(target.pixels(), symbiosis);
  vm.runInContext('artwork.destroy()', context);
  console.log('PASS: cuatro relaciones, simbiosis acotada incluso con superposición máxima, frentes suaves y granulados, efecto desactivado, contacto local, PNG alfa, semilla, retroceso, centros coincidentes, validación y módulo web equivalente.');
})().catch(e => { console.error(e); process.exitCode = 1; });
