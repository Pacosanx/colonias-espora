'use strict';
let frameDrag=null,inlineOriginal='';

function resizeDimensions(start,edge,dx,dy,maxW,maxH){
 let w=start.width,h=start.height;
 // El lienzo se presenta centrado: ambos extremos se desplazan respecto del centro.
 if(edge.includes('e'))w+=dx*2;if(edge.includes('w'))w-=dx*2;
 if(edge.includes('s'))h+=dy*2;if(edge.includes('n'))h-=dy*2;
 w=clamp(w,Math.min(120,maxW),maxW);h=clamp(h,Math.min(120,maxH),maxH);
 if(h/w>3){if(edge==='e'||edge==='w')w=h/3;else h=w*3}
 const minRatio=Math.max(1/3,minimumContentRatio());
 if(h/w<minRatio){if(edge==='e'||edge==='w')w=h/minRatio;else h=w*minRatio}
 return {width:w,height:h};
}
function applyCustomFormat(w,h){
 customRatio=clamp(h/w,Math.max(1/3,minimumContentRatio()),3);format='custom';manualViewWidth=w;$('format').value='custom';
 fit();schedule();
 status(`Formato libre · proporción ${Math.round(w)} : ${Math.round(h)}`);
}
function updateDirectUI(){
 $('resizeHandles').hidden=mode!=='piece';
 const input=$('inlineText');if(inlineEditingId===null){input.hidden=true;return}
 const item=items.find(i=>i.id===inlineEditingId);if(!item||mode!=='piece'){finishInlineEdit();return}
 const rect=canvas.getBoundingClientRect(),b=bounds(item,rect.width,rect.height);let fontSize=item.fontSize*rect.width/760;

 Object.assign(input.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px',fontSize:fontSize+'px',padding:'0 2px',fontFamily:'Clamofte, Arial, sans-serif',fontWeight:'normal',color:item.container?'#fffbee':'#202c2e'});
 input.hidden=false;
}
function beginInlineEdit(id){
 const item=items.find(i=>i.id===id);if(!item||item.type!=='text')return;
 if(inlineEditingId!==null)finishInlineEdit();select(id);drag=null;inlineEditingId=id;inlineOriginal=item.text;
 $('inlineText').value=item.text;updateDirectUI();$('inlineText').focus();$('inlineText').select();schedule();
 status('Escribí directamente. Enter confirma; Escape cancela.');
}
function finishInlineEdit(cancel=false){
 if(inlineEditingId===null)return;
 const item=items.find(i=>i.id===inlineEditingId);if(item&&cancel)item.text=inlineOriginal;
 inlineEditingId=null;$('inlineText').hidden=true;if(item)$('textContent').value=item.text;list();schedule();
}
for(const edge of ['n','ne','e','se','s','sw','w','nw']){
 const handle=document.createElement('button');handle.type='button';handle.className='resize-handle';handle.dataset.edge=edge;
 handle.setAttribute('aria-label','Redimensionar lienzo · '+({n:'arriba',ne:'arriba derecha',e:'derecha',se:'abajo derecha',s:'abajo',sw:'abajo izquierda',w:'izquierda',nw:'arriba izquierda'})[edge]);
 handle.title='Arrastrá para cambiar el formato';$('resizeHandles').append(handle);
 handle.addEventListener('pointerdown',e=>{if(mode!=='piece'||e.button!==0)return;e.preventDefault();e.stopPropagation();finishInlineEdit();const rect=$('art').getBoundingClientRect(),space=document.querySelector('.workspace').getBoundingClientRect();frameDrag={edge,x:e.clientX,y:e.clientY,width:rect.width,height:rect.height,maxW:Math.max(120,space.width-60),maxH:Math.max(120,space.height-40)};handle.setPointerCapture(e.pointerId)});
 handle.addEventListener('pointermove',e=>{if(!frameDrag)return;const d=resizeDimensions(frameDrag,frameDrag.edge,e.clientX-frameDrag.x,e.clientY-frameDrag.y,frameDrag.maxW,frameDrag.maxH);applyCustomFormat(d.width,d.height)});
 const end=()=>{frameDrag=null};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
 handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const rect=$('art').getBoundingClientRect(),space=document.querySelector('.workspace').getBoundingClientRect(),step=e.shiftKey?10:2;const d=resizeDimensions(rect,edge,e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0,Math.max(120,space.width-60),Math.max(120,space.height-40));applyCustomFormat(d.width,d.height)});
}
canvas.addEventListener('dblclick',e=>{if(mode!=='piece')return;const text=hitsAt(point(e)).find(i=>i.type==='text');if(text){e.preventDefault();beginInlineEdit(text.id)}});
canvas.addEventListener('keydown',e=>{if(e.key==='Enter'&&active()?.type==='text'){e.preventDefault();beginInlineEdit(selected)}});
canvas.addEventListener('pointerdown',()=>finishInlineEdit(),{capture:true});
$('editTextOnCanvas').onclick=()=>beginInlineEdit(selected);
$('inlineText').addEventListener('input',()=>{const item=items.find(i=>i.id===inlineEditingId);if(!item)return;item.text=$('inlineText').value.slice(0,100);$('textContent').value=item.text;list();updateDirectUI();schedule()});
$('inlineText').addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();finishInlineEdit(e.key==='Escape');canvas.focus()}});
$('inlineText').addEventListener('blur',()=>finishInlineEdit());
updateDirectUI();

document.fonts.load('28px Clamofte').then(()=>{schedule();updateDirectUI()}).catch(()=>status('No se pudo cargar Clamofte.'));

