'use strict';
// Adaptador aditivo: conserva los datos y los contratos de Elemento y Composición.
(() => {
  const R = ColonyRelations, el = id => document.getElementById(id);
  let study = R.normalize(), selectedColony = 'a', dragging = null, frame = 0, playing = false, playFrame = 0;
  try { study = R.normalize(JSON.parse(localStorage.getItem('colonias-relations-v1') || '{}')); } catch {}
  const oldSetMode = setMode, oldSchedule = schedule, oldFileChange = el('file').onchange;
  const oldCanvasLabel = canvas.getAttribute('aria-label');
  const modeButton = document.createElement('button'); modeButton.id = 'relationsMode'; modeButton.setAttribute('aria-pressed', 'false');
  modeButton.innerHTML = '<span>Relaciones</span><small>CONTACTO</small>'; (el('microMode') || el('pieceMode')).after(modeButton);
  function section(id, html, parent, before = null) {
    const node = document.createElement('section'); node.id = id; node.innerHTML = html; node.hidden = true; parent.insertBefore(node, before); return node;
  }
  function slider(key, title, min, max, step = 1, unit = '%') {
    return `<label><span>${title}<output id="rel-${key}-value" class="relation-static"></output></span><input id="rel-${key}" type="range" min="${min}" max="${max}" step="${step}" data-relation-unit="${unit}"></label>`;
  }
  function colorSelect(key, label) {
    return `<label>${label}<select id="rel-${key}">${Object.entries(R.families).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('')}</select></label>`;
  }
  const left = el('creationPanel'), right = el('editPanel');
  section('relationTypes', `<h2>Relación en el encuentro</h2><div class="relation-options">${Object.entries(R.types).map(([key, t], i) => `<button data-relation="${key}" aria-pressed="false"><span>0${i + 1} / ${t.name}</span><small>${t.cue}</small></button>`).join('')}</div><p id="relationDescription"></p><label class="check"><input id="rel-enabled" type="checkbox">Aplicar la relación</label><label class="check"><input id="rel-compare" type="checkbox">Comparar las cuatro</label><p class="helper">La comparación conserva el mismo par, tamaño e instante.</p>`, left, el('compositionTools'));
  section('relationEncounter', `<h2>Encuentro</h2>${slider('separation', 'Distancia entre centros', 0, 58, 1, '% de placa')}${slider('intensity', 'Intensidad del efecto', 0, 100)}${slider('width', 'Ancho de la zona', 0, 100)}<div class="presets"><button id="rel-apart">Separar</button><button id="rel-contact">Encontrar</button></div><label class="check"><input id="rel-guides" type="checkbox">Identificar A y B</label><p class="helper">Arrastrá cualquiera de las colonias sobre la placa. Seleccionada una colonia, las flechas también la mueven.</p><button id="rel-scheme" class="wide">Usar el par del esquema</button><p class="helper">Toma los colores de tu referencia de Figma para esta relación.</p>`, left, el('compositionTools'));
  section('relationAppearance', `<h2>Las dos colonias</h2>${colorSelect('familyA', 'Colonia A')}${slider('radiusA', 'Tamaño A · radio', 8, 24, .5)}${colorSelect('familyB', 'Colonia B')}${slider('radiusB', 'Tamaño B · radio', 8, 24, .5)}<details><summary>Materia y borde</summary>${slider('blur', 'Suavidad del borde', 0, 100)}${slider('irregularity', 'Irregularidad', 0, 100)}${slider('grain', 'Grano', 0, 70)}<button id="rel-variation" class="wide">Otra variación ↻</button></details>`, right, el('layerTools'));
  section('relationReadings', '<h2>Lectura del contacto</h2><p id="rel-state" class="relation-caption" role="status"></p><dl class="relation-readout"><dt>Colonia seleccionada</dt><dd id="rel-selected"></dd><dt>Relación elegida</dt><dd id="rel-type"></dd></dl><p class="note">Estudio gráfico. La relación se elige para explorar su representación; los colores no identifican especies ni predicen su comportamiento.</p>', right, el('layerTools'));
  section('relationOutput', '<h2>Fondo y exportación</h2><label class="check"><input id="rel-plate" type="checkbox">Borde de la placa</label><label class="check"><input id="rel-transparent" type="checkbox">Fondo transparente</label><label>Color de fondo<select id="rel-background"><option value="#fffbee">Crema</option><option value="#202c2e">Carbón</option></select></label><label>Tamaño PNG<select id="rel-resolution"><option value="1024">1024 px</option><option value="2048" selected>2048 px</option><option value="3072">3072 px</option></select></label><p class="relation-output-note">Exporta el instante actual, sin las guías A/B. La receta conserva posiciones, relación y ajustes. También podés exportar el módulo para web.</p><button id="rel-reset" class="wide">Restablecer relaciones</button>', right, el('layerTools'));
  const timeline = document.createElement('div'); timeline.id = 'relationTimeline'; timeline.className = 'relation-timeline'; timeline.hidden = true;
  timeline.innerHTML = '<label for="rel-progress">Desarrollo del encuentro</label><button id="rel-play" aria-label="Reproducir encuentro">▶</button><input id="rel-progress" type="range" min="0" max="100" step="1"><output id="rel-progress-value"></output><small>Recorrido visual reversible · sin equivalencia en días</small>';
  el('timeline').after(timeline);
  const sections = ['relationTypes', 'relationEncounter', 'relationAppearance', 'relationReadings', 'relationOutput', 'relationTimeline'];
  function activeStudy() { return mode === 'relations'; }
  function pause() { playing = false; cancelAnimationFrame(playFrame); el('rel-play').textContent = '▶'; el('rel-play').setAttribute('aria-label', 'Reproducir encuentro'); }
  function syncUI() {
    for (const key of ['intensity', 'width', 'radiusA', 'radiusB', 'blur', 'grain', 'irregularity', 'progress']) {
      const value = key.startsWith('radius') ? Math.round(study[key] * 1000) / 10 : Math.round(study[key]);
      el('rel-' + key).value = value; el('rel-' + key + '-value').value = value + '%';
    }
    const distance = Math.round(Math.hypot(study.b.x - study.a.x, study.b.y - study.a.y) * 100);
    el('rel-separation').value = distance; el('rel-separation-value').value = distance + '%';
    for (const key of ['enabled', 'compare', 'guides', 'plate', 'transparent']) el('rel-' + key).checked = study[key];
    for (const key of ['familyA', 'familyB', 'background']) el('rel-' + key).value = study[key];
    document.querySelectorAll('[data-relation]').forEach(b => b.setAttribute('aria-pressed', b.dataset.relation === study.type));
    el('relationDescription').textContent = R.types[study.type].description;
    el('rel-selected').textContent = selectedColony.toUpperCase(); el('rel-type').textContent = R.types[study.type].name;
    const g = R.geometry(study), effect = study.enabled && study.intensity > 0;
    el('rel-state').textContent = !effect ? 'Sin efecto · superposición de referencia' : study.type === 'rejection' && g.overlap > -g.gap ? 'B alcanza el halo de exclusión de A' : g.overlap > 0 ? R.types[study.type].cue : 'Todavía sin contacto';
    el('name').textContent = study.compare ? 'Mismo par / cuatro relaciones' : `Relaciones / ${R.types[study.type].name}`;
    el('modeTag').textContent = 'Estudio de contacto';
    canvas.setAttribute('aria-label', `Placa de relaciones: ${R.types[study.type].name}. Colonia ${selectedColony.toUpperCase()} seleccionada. Arrastrá las colonias o usá las flechas para mover la seleccionada.`);
  }
  function guides() {
    if (!study.guides || study.compare) return;
    const c = canvas.getContext('2d'), n = canvas.width;
    for (const key of ['a', 'b']) {
      const p = study[key]; c.fillStyle = selectedColony === key ? '#202c2e' : '#8a8e5c';
      c.beginPath(); c.arc(p.x * n, p.y * n, n * (selectedColony === key ? .006 : .0035), 0, Math.PI * 2); c.fill();
      c.font = `${n * .02}px Arial`; c.textAlign = 'center'; c.fillText(key.toUpperCase(), p.x * n, (p.y - study[key === 'a' ? 'radiusA' : 'radiusB'] - .045) * n);
    }
  }
  function draw() {
    frame = 0; if (!activeStudy()) return;
    const moving = playing || dragging;
    R.draw(canvas, study.compare ? (moving ? 600 : 840) : (moving ? 480 : 760), study); guides(); syncUI();
    el('art').classList.toggle('checker', study.transparent); el('art').style.backgroundColor = study.background;
    try { localStorage.setItem('colonias-relations-v1', JSON.stringify(study)); } catch {}
  }
  function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  schedule = function () { if (activeStudy()) requestDraw(); else oldSchedule(); };
  setMode = function (next) {
    pause();
    if (next === 'relations') {
      // Micro conserva su propio estado interno. Su salida pública restaura los
      // paneles antes de activar Relaciones y evita interceptar sus exportaciones.
      if (el('microMode')?.getAttribute('aria-pressed') === 'true') el('singleMode').click();
      if (typeof finishInlineEdit === 'function') finishInlineEdit();
      timelinePlaying = false; cancelAnimationFrame(timelineRaf); mode = 'relations'; document.body.dataset.relations = '';
      sections.forEach(id => { el(id).hidden = false; });
      el('singleMode').setAttribute('aria-pressed', 'false'); el('pieceMode').setAttribute('aria-pressed', 'false'); modeButton.setAttribute('aria-pressed', 'true');
      el('canvasHelp').textContent = 'Acercá las colonias para explorar el encuentro · Compará las cuatro con el mismo par · Flechas para mover A/B';
      status(''); syncUI(); fit(); requestDraw();
    } else {
      delete document.body.dataset.relations; sections.forEach(id => { el(id).hidden = true; }); modeButton.setAttribute('aria-pressed', 'false'); canvas.setAttribute('aria-label', oldCanvasLabel);
      oldSetMode(next);
    }
  };
  modeButton.onclick = () => setMode('relations');
  function update() { pause(); requestDraw(); }
  document.querySelectorAll('[data-relation]').forEach(b => { b.onclick = () => { study.type = b.dataset.relation; update(); }; });
  for (const key of ['intensity', 'width', 'blur', 'grain', 'irregularity', 'progress', 'radiusA', 'radiusB']) {
    el('rel-' + key).addEventListener('input', e => { study[key] = +e.target.value / (key.startsWith('radius') ? 100 : 1); R.contain(study, 'a'); R.contain(study, 'b'); update(); });
  }
  for (const key of ['enabled', 'compare', 'guides', 'plate', 'transparent']) el('rel-' + key).oninput = e => { study[key] = e.target.checked; update(); };
  for (const key of ['familyA', 'familyB', 'background']) el('rel-' + key).oninput = e => { study[key] = e.target.value; update(); };
  function setDistance(distance) {
    const g = R.geometry(study), mid = { x: (study.a.x + study.b.x) / 2, y: (study.a.y + study.b.y) / 2 };
    study.a = { x: mid.x - g.ux * distance / 2, y: mid.y - g.uy * distance / 2 }; study.b = { x: mid.x + g.ux * distance / 2, y: mid.y + g.uy * distance / 2 };
    R.contain(study, 'a'); R.contain(study, 'b'); update();
  }
  el('rel-separation').oninput = e => setDistance(+e.target.value / 100);
  el('rel-apart').onclick = () => { study.progress = 100; setDistance(.52); };
  el('rel-contact').onclick = () => { study.progress = 100; setDistance((study.radiusA + study.radiusB) * .74); };
  el('rel-scheme').onclick = () => { [study.familyA, study.familyB] = R.types[study.type].pair; update(); };
  el('rel-variation').onclick = () => { study.seed = Math.floor(Math.random() * 100000); update(); };
  el('rel-reset').onclick = () => { study = R.normalize(); selectedColony = 'a'; update(); };
  el('rel-play').onclick = () => {
    if (playing) { pause(); return; }
    if (study.progress >= 100) study.progress = 0;
    playing = true; el('rel-play').textContent = 'Ⅱ'; el('rel-play').setAttribute('aria-label', 'Pausar encuentro');
    const start = performance.now() - study.progress * 90;
    const tick = now => { if (!playing || !activeStudy()) return; study.progress = Math.min(100, (now - start) / 90); requestDraw(); if (study.progress >= 100) pause(); else playFrame = requestAnimationFrame(tick); };
    playFrame = requestAnimationFrame(tick);
  };
  function pointer(e) {
    const rect = canvas.getBoundingClientRect(); let x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
    if (study.compare) { const col = dragging?.col ?? Math.min(1, Math.floor(x * 2)), row = dragging?.row ?? Math.min(1, Math.floor(y * 2)); x = (x - .027 - col * .5) / .46; y = (y - .027 - row * .5) / .46; }
    return { x, y };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!activeStudy() || e.button !== 0) return;
    const p = pointer(e), g = R.geometry(study), distances = ['a', 'b'].map(key => ({ key, d: Math.hypot(p.x - study[key].x, p.y - study[key].y) }));
    const hit = distances.filter(v => v.d < g[v.key === 'a' ? 'ra' : 'rb'] + .035).sort((a, b) => a.d - b.d)[0]; if (!hit) return;
    const rect = canvas.getBoundingClientRect();
    pause(); selectedColony = hit.key; dragging = { key: hit.key, x: p.x - study[hit.key].x, y: p.y - study[hit.key].y, col: Math.min(1, Math.floor((e.clientX - rect.left) / rect.width * 2)), row: Math.min(1, Math.floor((e.clientY - rect.top) / rect.height * 2)) }; canvas.setPointerCapture(e.pointerId); canvas.focus(); requestDraw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!activeStudy() || !dragging) return; const p = pointer(e); study[dragging.key] = { x: p.x - dragging.x, y: p.y - dragging.y }; R.contain(study, dragging.key); requestDraw();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => { const wasDragging = !!dragging; dragging = null; if (wasDragging && activeStudy()) requestDraw(); });
  canvas.addEventListener('keydown', e => {
    if (!activeStudy()) return;
    if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'b') { selectedColony = e.key.toLowerCase(); requestDraw(); return; }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!delta) return;
    e.preventDefault(); const step = e.shiftKey ? .025 : .005; study[selectedColony].x += delta[0] * step; study[selectedColony].y += delta[1] * step; R.contain(study, selectedColony); update();
  });
  function recipe() { return { version: 3, mode: 'relations', relation: structuredClone(study) }; }
  const oldSave = el('save').onclick; el('save').onclick = () => activeStudy() ? download(new Blob([JSON.stringify(recipe(), null, 2)], { type: 'application/json' }), 'colonias-relaciones.json') : oldSave();
  el('file').onchange = async function (event) {
    const file = el('file').files[0]; if (!file) return;
    let raw; try { raw = JSON.parse(await file.text()); } catch { status('No se pudo leer la receta JSON.'); el('file').value = ''; return; }
    if (raw.version === 3 && raw.mode === 'relations') {
      if (!raw.relation || typeof raw.relation !== 'object' || Array.isArray(raw.relation)) { status('Receta de relaciones inválida.'); el('file').value = ''; return; }
      study = R.normalize(raw.relation); setMode('relations'); status('Relaciones restauradas.'); el('file').value = ''; return;
    }
    // El adaptador anterior sigue validando las recetas de Elemento y Composición.
    await oldFileChange.call(this, event);
  };
  const oldExport = el('export').onclick;
  el('export').onclick = () => {
    if (!activeStudy()) { oldExport(); return; }
    status('Preparando PNG de relaciones…'); const snapshot = structuredClone(study), size = +el('rel-resolution').value;
    setTimeout(() => {
      try { const out = document.createElement('canvas'); R.draw(out, size, snapshot, true); out.toBlob(blob => { if (!blob) { status('No se pudo crear el PNG.'); return; } download(blob, `colonias-relaciones-${snapshot.compare ? 'comparacion' : snapshot.type}.png`); status(`PNG de ${size} × ${size} descargado.`); }, 'image/png'); }
      catch (error) { status('No se pudo exportar: ' + error.message); }
    }, 30);
  };
  const oldWebExport = el('exportWeb').onclick;
  el('exportWeb').onclick = () => {
    if (!activeStudy()) { oldWebExport(); return; }
    const data = recipe();
    const demo = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Colonias · relaciones</title><style>body{margin:24px;background:#151716;color:#e4e5e2;font:14px Arial}main{max-width:760px;margin:auto}canvas{display:block;width:100%}button,input{margin:12px}</style><main><canvas id="art" role="img" aria-label="Estudio abstracto de relaciones entre dos colonias"></canvas><button id="play">Reproducir encuentro</button><label>Desarrollo<input id="time" type="range" min="0" max="100" value="100"></label><p>Exploración gráfica, sin equivalencia biológica.</p></main><script type="module">import{mountColonias}from"./colonias.js";const art=mountColonias(document.getElementById("art"));document.getElementById("play").onclick=()=>art.play();document.getElementById("time").oninput=e=>{art.pause();art.setProgress(e.target.value/100)};</script></html>';
    const readme = '# Colonias · relaciones\n\nAbrir index.html desde un servidor HTTP. colonias.js contiene el mismo campo de contacto de la herramienta, sin dependencias. receta.json se vuelve a abrir con Abrir receta en COLONIAS.\n\nimport { mountColonias } from "./colonias.js";\nconst artwork = mountColonias(canvas);\nartwork.play({ duration: 9000 });\nartwork.pause();\nartwork.setProgress(0.5);\nartwork.getRecipe();\nartwork.destroy();\n\nLa relación es una elección gráfica. No predice interacciones entre especies. La exportación no incluye las guías A/B.\n';
    download(webZip({ 'colonias.js': R.moduleSource(data), 'receta.json': JSON.stringify(data, null, 2), 'index.html': demo, 'LEEME.md': readme }), 'colonias-relaciones-web.zip'); status('Módulo web de relaciones descargado.');
  };
  if (location.hash === '#relaciones') setMode('relations');
  window.addEventListener('hashchange', () => { if (location.hash === '#relaciones') setMode('relations'); });
})();
