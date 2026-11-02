'use strict';
// Cada cifra conserva el slider y sus mismos eventos de edición.
for(const output of document.querySelectorAll('output')){
 const slider=output.closest('label')?.querySelector('input[type=range]');if(!slider)continue;
 output.tabIndex=0;output.setAttribute('role','button');output.title='Clic para escribir un valor';
 const open=()=>{if(output.querySelector('input'))return;const original=output.value,input=document.createElement('input');input.type='number';input.className='numeric-entry';input.value=slider.value;input.min=slider.min;input.max=slider.max;input.step=slider.step||'1';input.setAttribute('aria-label',slider.closest('label').textContent.trim());output.replaceChildren(input);let done=false;
 const finish=cancel=>{if(done)return;done=true;const number=Number(input.value);if(!cancel&&input.value.trim()!==''&&Number.isFinite(number)){slider.value=String(Math.max(Number(slider.min),Math.min(Number(slider.max),number)));slider.dispatchEvent(new Event('input',{bubbles:true}));}else output.value=original;};
 input.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();finish(event.key==='Escape');output.focus()}});input.addEventListener('blur',()=>finish(false));input.addEventListener('click',e=>e.stopPropagation());input.focus();input.select();};
 output.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open()});output.addEventListener('keydown',event=>{if(event.target===output&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open()}});
}
// Una edición directa inicia una nueva referencia para los controles generales.
for(const eventName of ['input','change'])document.addEventListener(eventName,event=>{if(!event.target.closest('#compositionTools')||event.target.id==='format')pieceBaseline=null;},{capture:true});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&(button.dataset.preset||['duplicate','delete','addText','addAxis','addRadial','ungroup','reset'].includes(button.id)))pieceBaseline=null;},{capture:true});

