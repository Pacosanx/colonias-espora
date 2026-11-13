'use strict';
// Paquete sin dependencias: componente ES module, escena y ejemplo de integración.
function webModule(scene){
 const functions=[hash,noiseField,render,fontStack,textWidth,texturePaddingFraction,sprite,bounds,paintScene].map(fn=>fn.toString()).join('\n');
 return `export const recipe = ${JSON.stringify(scene,null,2)};
export function mountColonias(canvas, options = {}) {
 const scene=structuredClone(options.recipe||recipe),items=scene.items,paper=scene.paper;
 const ratio=()=>scene.customRatio,cache=new Map(),textMeasure=document.createElement('canvas').getContext('2d');
 const fontFamilies=${JSON.stringify(fontFamilies)};
 let state={},inlineEditingId=null;const active=()=>null;
 const clamp=${clamp.toString()},smooth=${smooth.toString()},rgb=${rgb.toString()};
 ${functions}
 const singleRender=render;
 let progress=1,playing=false,raf=0,destroyed=false;
 canvas.style.width='100%';canvas.style.height='auto';canvas.style.aspectRatio=String(1/ratio());
 function draw(){if(destroyed)return;const width=Math.max(64,Math.min(1600,Math.round(canvas.getBoundingClientRect().width*(devicePixelRatio||1))));paintScene(canvas,width,false,progress)}
 function setProgress(value){progress=clamp(Number(value)||0);draw()}
 function pause(){playing=false;cancelAnimationFrame(raf)}
 function play({duration=9000,loop=false}={}){pause();playing=true;const start=performance.now();function tick(now){if(!playing||destroyed)return;const t=(now-start)/Math.max(100,duration);setProgress(loop?t%1:Math.min(1,t));if(t<1||loop)raf=requestAnimationFrame(tick);else playing=false}raf=requestAnimationFrame(tick)}
 function hit(event){const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*canvas.width,y=(event.clientY-rect.top)/rect.height*canvas.height;for(let n=items.length-1;n>=0;n--){const item=items[n],phase=clamp((progress-n*.82/Math.max(1,items.length))/.18),growth=.04+.96*(phase*phase*(3-2*phase));if(!phase)continue;const b=bounds(item,canvas.width,canvas.height),px=(x-item.x*canvas.width)/growth+b.w/2,py=(y-item.y*canvas.height)/growth+b.h/2;if(item.type==='text'){if(px>=0&&py>=0&&px<=b.w&&py<=b.h)return item;continue}if(item.style.opacity<=0)continue;const res=Math.max(64,Math.ceil(b.w)),image=sprite(item,res),pad=image.texturePadding||0,ix=Math.floor(px/b.w*res)+pad,iy=Math.floor(py/b.h*res)+pad;if(ix>=0&&iy>=0&&ix<image.width&&iy<image.height&&image.getContext('2d').getImageData(ix,iy,1,1).data[3]>10)return item}return null}
 const click=event=>options.onClick?.(hit(event),event);
 const move=event=>{const item=hit(event);canvas.style.cursor=item?'pointer':'default';options.onHover?.(item,event)};
 const leave=event=>options.onHover?.(null,event);
 canvas.addEventListener('click',click);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);
 const observer=new ResizeObserver(draw);observer.observe(canvas);draw();document.fonts?.ready.then(draw);
 return {setProgress,play,pause,draw,getRecipe:()=>structuredClone(scene),destroy(){destroyed=true;pause();observer.disconnect();canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave)}};
}
`;
}
function webZip(files){
 const encoder=new TextEncoder(),chunks=[],entries=[];let offset=0;
 function crc(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
 function header(size){const bytes=new Uint8Array(size);return [bytes,new DataView(bytes.buffer)]}
 for(const [name,content]of Object.entries(files)){const path=encoder.encode(name),data=encoder.encode(content),sum=crc(data),[local,v]=header(30);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,path.length,true);chunks.push(local,path,data);entries.push({path,data,sum,offset});offset+=30+path.length+data.length}
 const start=offset;
 for(const e of entries){const [central,v]=header(46);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,e.sum,true);v.setUint32(20,e.data.length,true);v.setUint32(24,e.data.length,true);v.setUint16(28,e.path.length,true);v.setUint32(42,e.offset,true);chunks.push(central,e.path);offset+=46+e.path.length}
 const [end,v]=header(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,offset-start,true);v.setUint32(16,start,true);chunks.push(end);return new Blob(chunks,{type:'application/zip'});
}
function exportForWeb(){
 const scene={version:2,mode:'piece',state,current,paper:mode==='piece'?paper:{background:state.background,transparent:state.transparent},format:'custom',customRatio:mode==='piece'?ratio():1,density,sceneSeed,compositionLogic,groups:mode==='piece'?groups:[],items:mode==='piece'?items:[{id:1,type:'shape',name:current,x:.5,y:.5,w:1,style:{...state}}]};
 const demo=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Colonias · ejemplo web</title><link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=sentient@400&display=swap"><style>body{margin:24px;background:#151716;color:#e4e5e2;font:16px Arial}main{max-width:800px;margin:auto}canvas{display:block}button,input{margin:12px 8px 12px 0}p{min-height:24px}</style><main><canvas id="art" role="img" aria-label="Composición de colonias"></canvas><button id="play">Reproducir</button><label>Crecimiento <input id="time" type="range" min="0" max="100" value="100"></label><p id="info">Seleccioná una colonia.</p></main><script type="module">import {mountColonias} from './colonias.js';const info=document.getElementById('info');const artwork=mountColonias(document.getElementById('art'),{onClick:item=>{info.textContent=item?(item.text||item.name)+' · ID '+item.id:'Seleccioná una colonia.'}});document.getElementById('play').onclick=()=>artwork.play();document.getElementById('time').oninput=e=>{artwork.pause();artwork.setProgress(e.target.value/100)};</script></html>`;
 const readme=`# Colonias · exportación web\n\nEntregá este paquete completo a Codex para integrarlo en tu web.\n\n- colonias.js: componente Canvas autónomo con receta incorporada.\n- receta.json: datos editables; también se puede abrir en la herramienta Colonias.\n- index.html: demostración con animación y clic por elemento. Abrir desde un servidor web local; los módulos ES requieren HTTP/HTTPS.\n\n## Integración\n\nimport { mountColonias } from './colonias.js';\nconst artwork = mountColonias(canvas, { onClick: (item, event) => {}, onHover: (item, event) => {} });\nartwork.play({ duration: 9000, loop: false });\nartwork.setProgress(0.5);\nartwork.pause();\nartwork.destroy(); // al desmontar un componente\n\noptions.recipe permite pasar otra receta; getRecipe() devuelve sus parámetros. Cada elemento conserva un ID para asociar información o acciones. El render conserva el orden de capas y recalcula su resolución según el contenedor. Las interacciones se conectan mediante los callbacks; la accesibilidad de enlaces y controles se implementa con HTML en la web final.\n\nLa imagen se dibuja por código Canvas y continúa siendo rasterizada. El crecimiento es una traducción gráfica, no una simulación biológica.\n\n## Fuentes\n\nSentient se carga desde Fontshare en el ejemplo y necesita conexión. Para otra integración, cargar su CSS antes de dibujar. Las fuentes del sistema dependen del dispositivo.\n`;
 download(webZip({'colonias.js':webModule(scene),'receta.json':JSON.stringify(scene,null,2),'index.html':demo,'LEEME.md':readme}),'colonias-web.zip');status('Paquete web descargado · código, receta y ejemplo.');
}
$('exportWeb').onclick=exportForWeb;
