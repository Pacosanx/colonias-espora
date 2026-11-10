'use strict';
// Paleta cerrada a partir de la referencia de Paco.
const palette=[['Coral','#ff4c52'],['Rosa','#f58bc3'],['Rosa suave','#dfb5ab'],['Ámbar','#ffc21c'],['Naranja','#ff9c20'],['Arena','#dec9a3'],['Hueso','#eee4cf'],['Lima','#dce642'],['Salvia','#b6c6a6'],['Oliva','#8a8e5c'],['Verde','#6a983a'],['Verde profundo','#27633f'],['Tierra','#80664d'],['Carbón','#202c2e'],['Crema','#fffbee'],['Marfil','#f3ead1'],['Oro pálido','#efcc6d'],['Oro','#e8ae2f'],['Ocre','#c28a37'],['Cobre','#e66620'],['Rojo óxido','#bd351d'],['Pardo','#462817'],['Pardo oscuro','#28180f']];
const allowed=new Set(palette.map(p=>p[1]));
for(const key of ['c1','c2','c3']){for(const [name,hex]of palette){const o=document.createElement('option');o.value=hex;o.textContent=name;$(key).append(o)}}
for(const [name,hex]of palette){const dot=document.createElement('i');dot.title=name;dot.style.background=hex;$('paletteSwatches').append(dot)}
let mode='single',items=[],selected=null,format='square',density=55,sceneSeed=351,idCounter=0;
let paper={background:'#fffbee',transparent:false};
let bandAngle=0,bandPosition=0;
let structureScale=100,structureAir=100,compositionLogic='petri',pieceBaseline=null;
let colorWeights={green:33,yellow:33,rose:34};
const colorFamilies={green:['#27633f','#6a983a','#dce642'],yellow:['#ff9c20','#ffc21c','#dce642'],rose:['#ff4c52','#f58bc3','#ff4c52']};
function normalizeColorMix(){const keys=['green','yellow','rose'],sum=keys.reduce((n,k)=>n+Math.max(0,Number(colorWeights[k])||0),0);if(!sum){colorWeights={green:33,yellow:33,rose:34};return}const parts=keys.map(key=>{const exact=100*Math.max(0,Number(colorWeights[key])||0)/sum;return{key,value:Math.floor(exact),fraction:exact-Math.floor(exact)}});let extra=100-parts.reduce((n,p)=>n+p.value,0);for(const p of [...parts].sort((a,b)=>b.fraction-a.fraction).slice(0,extra))p.value++;colorWeights=Object.fromEntries(parts.map(p=>[p.key,p.value]))}
function syncColorMixInputs(){normalizeColorMix();for(const [key,id]of [['green','mixGreen'],['yellow','mixYellow'],['rose','mixRose']]){$(id).value=colorWeights[key];$(id+'Value').value=colorWeights[key]+'%'}}
function setColorMix(key,value){const remainder=100-value,keepKey=key==='green'?'yellow':'green',adjustKey=['green','yellow','rose'].find(k=>k!==key&&k!==keepKey),keep=Math.min(colorWeights[keepKey],remainder);colorWeights={...colorWeights,[key]:value,[keepKey]:keep,[adjustKey]:remainder-keep}}
function applyColorMix(){
 const targets=items.filter(i=>i.type==='shape'&&i.role!=='petri-rim');if(!targets.length)return;
 const keys=['green','yellow','rose'],sum=keys.reduce((n,k)=>n+Math.max(0,Number(colorWeights[k])||0),0);if(!sum)return;
 const quotas=keys.map(k=>{const exact=targets.length*Math.max(0,Number(colorWeights[k])||0)/sum;return{key:k,count:Math.floor(exact),fraction:exact-Math.floor(exact)}});
 let remainder=targets.length-quotas.reduce((n,q)=>n+q.count,0);for(const q of [...quotas].sort((a,b)=>b.fraction-a.fraction).slice(0,remainder))q.count++;
 const order=[...targets].sort((a,b)=>hash(a.id,510,sceneSeed)-hash(b.id,510,sceneSeed));let cursor=0;
 for(const q of quotas){const colors=colorFamilies[q.key];for(let n=0;n<q.count;n++){const item=order[cursor++];item.style.c1=colors[0];item.style.c2=colors[1];item.style.c3=colors[2]}}
}
syncColorMixInputs();
let customRatio=1,manualViewWidth=null,inlineEditingId=null;
let groups=[],groupCounter=0,boxSelectionIds=[];
let timelineProgress=1,timelinePlaying=false,timelineRaf=0;
const cache=new Map(),singleRender=render,singleChoose=choose;
const ratio=()=>format==='custom'?customRatio:({portrait:1.25,square:1,landscape:2/3})[format];
const active=()=>items.find(i=>i.id===selected);
const textMeasure=document.createElement('canvas').getContext('2d');
const fontFamilies=['Clamofte','Sentient','Arial','Verdana','Trebuchet MS','Georgia','Times New Roman','Courier New'];
function fontStack(i){return `"${fontFamilies.includes(i.fontFamily)?i.fontFamily:'Clamofte'}", Arial, sans-serif`}
function textWidth(i){textMeasure.font=`normal ${i.fontSize}px ${fontStack(i)}`;const metrics=textMeasure.measureText?.(i.text||'');const width=metrics?Math.max(metrics.width,(metrics.actualBoundingBoxLeft||0)+(metrics.actualBoundingBoxRight||0)):(i.text||'').length*i.fontSize*.53;return Math.max(4,width+(i.container?i.fontSize*(i.containerPadding??45)/50:4))}

function texturePaddingFraction(i){const s=i.style,size=(s.size??70)/200;let reach=1;if(s.shape==='capsule')reach=1+(s.elongation??0)/50;else if(s.shape==='pair')reach=.7+.9*(s.separation??50)/100;else if(s.shape==='band')reach=.5;else if(s.shape==='hairy')reach=1.5;else if(s.shape==='fan')reach=1.7;else if(s.shape==='branching')reach=1.3*Math.max(1,(s.branchLength??100)/100);else if(s.shape==='cotton')reach=1.3;return Math.max(0,size*reach-.5)+(s.halo??0)/200+Math.max(s.blur??10,s.edgeBlur??0)*3/760+4/64}
function footprint(i){if(i.type==='text')return{x:textWidth(i)/1520+3*(i.blur??0)/760,y:((i.fontSize*1.25+8)/1520+3*(i.blur??0)/760)/ratio()};const margin=i.w*(.5+texturePaddingFraction(i));return{x:margin,y:margin/ratio()}}
function containItem(i){
 if(i.type==='shape'&&i.role==='reference-agar'){
  const scale=i.style.size/200,r=ratio();
  i.w=Math.min(i.w,.5*Math.min(1,r)/scale);
  const radius=i.w*scale;
  i.x=clamp(i.x,radius,1-radius);
  i.y=clamp(i.y,radius/r,1-radius/r);
  return;
 }
 if(i.type==='shape'&&i.petriExampleRim){i.w=Math.min(i.w,.98);const m=Math.min(.49,i.w*((i.style.size??85)/200+3*(i.style.blur??0)/760));i.x=clamp(i.x,m,1-m);i.y=clamp(i.y,m/ratio(),1-m/ratio());return}
 if(i.type==='shape'){const factor=.5+texturePaddingFraction(i),maxWidth=.48*Math.min(1,ratio())/factor;i.w=Math.min(i.w,maxWidth)}

 const m=footprint(i);i.x=clamp(i.x,m.x,1-m.x);i.y=clamp(i.y,m.y,1-m.y);
}
function groupMembers(g){return g.type==='manual'?items.filter(i=>g.memberIds?.includes(i.id)):items.filter(i=>i.groupId===g.id||i.id===g.anchorId)}
function containGroup(g){
 const members=groupMembers(g);if(!members.length)return;
 const extent=()=>members.reduce((v,i)=>{const m=footprint(i);return {l:Math.min(v.l,i.x-m.x),r:Math.max(v.r,i.x+m.x),t:Math.min(v.t,i.y-m.y),b:Math.max(v.b,i.y+m.y)}},{l:Infinity,r:-Infinity,t:Infinity,b:-Infinity});
 let box=extent(),scale=Math.min(1,.96/(box.r-box.l),.96/(box.b-box.t));
 if(scale<1){for(const i of members){i.x=g.cx+(i.x-g.cx)*scale;i.y=g.cy+(i.y-g.cy)*scale;i.w*=scale}g.spacing*=scale;g.memberSize=(g.memberSize??.025)*scale;box=extent()}
 const dx=clamp(0,.02-box.l,.98-box.r),dy=clamp(0,.02-box.t,.98-box.b);g.cx+=dx;g.cy+=dy;for(const i of members){i.x+=dx;i.y+=dy}
}
function fitWholeScene(keepOffset=false){
 if(!items.length)return;
 const box=items.reduce((v,i)=>{const m=footprint(i);return {l:Math.min(v.l,i.x-m.x),r:Math.max(v.r,i.x+m.x),t:Math.min(v.t,i.y-m.y),b:Math.max(v.b,i.y+m.y)}},{l:Infinity,r:-Infinity,t:Infinity,b:-Infinity});
 const cx=keepOffset?.5:(box.l+box.r)/2,cy=keepOffset?.5:(box.t+box.b)/2,k=keepOffset?Math.min(1,.46/Math.max(Math.abs(box.l-.5),Math.abs(box.r-.5)),.46/Math.max(Math.abs(box.t-.5),Math.abs(box.b-.5))):Math.min(1,.92/(box.r-box.l),.92/(box.b-box.t));
 for(const i of items){i.x=.5+(i.x-cx)*k;i.y=.5+(i.y-cy)*k;if(i.type==='text')i.fontSize*=k;else i.w*=k}
 for(const g of groups){g.cx=.5+(g.cx-cx)*k;g.cy=.5+(g.cy-cy)*k;g.spacing*=k;g.memberSize=(g.memberSize??.025)*k}
}
function fitPositionsKeepSizes(){
 if(!items.length)return;
 let reach=0;for(const i of items){const f=footprint(i);reach=Math.max(reach,Math.abs(i.x-.5)+f.x,Math.abs(i.y-.5)+f.y)}
 const k=Math.min(1,.48/Math.max(.001,reach));if(k>=1)return;
 for(const i of items){i.x=.5+(i.x-.5)*k;i.y=.5+(i.y-.5)*k}
 for(const g of groups){g.cx=.5+(g.cx-.5)*k;g.cy=.5+(g.cy-.5)*k;g.spacing*=k}
}
function capturePieceBaseline(){pieceBaseline={items:structuredClone(items),groups:structuredClone(groups),scale:structureScale,air:structureAir,angle:bandAngle,position:bandPosition}}
function editStructure(){
 if(!pieceBaseline)capturePieceBaseline();const b=pieceBaseline;
 const scale=+$('structureScale').value,air=+$('structureAir').value,angle=+$('bandAngle').value,position=+$('bandPosition').value;
 const k=scale/b.scale,size=clamp(Math.pow(b.air/air,.45),.78,1.22),a=(angle-b.angle)*Math.PI/180,r=ratio();
 items=structuredClone(b.items);groups=structuredClone(b.groups);
 const move=(i,xkey,ykey)=>{const x=i[xkey]-.5,y=(i[ykey]-.5)*r;i[xkey]=.5+k*(x*Math.cos(a)-y*Math.sin(a));i[ykey]=.5+(k*(x*Math.sin(a)+y*Math.cos(a))+(position-b.position)/100)/r};
 for(const i of items){move(i,'x','y');if(i.type==='text')i.fontSize*=size;else{i.w*=size;i.style.rotation+=angle-b.angle}}
 for(const g of groups){move(g,'cx','cy');g.spacing*=k;g.memberSize=(g.memberSize??.025)*size;g.angle+=angle-b.angle}
  if(scale!==b.scale||air!==b.air||angle!==b.angle||position!==b.position)fitPositionsKeepSizes();
 structureScale=scale;structureAir=air;bandAngle=angle;bandPosition=position;
 $('structureScaleValue').value=scale+'%';$('structureAirValue').value=air+'%';syncBand();if(active()?.type==='shape')state=active().style;schedule();
}
function arrangeComposition(logic){
 if(logic==='grid'){
  // Retícula proporcional: cruces para cuerpos principales y ejes ortogonales para secuencias.
  const cols=ratio()>1.05?4:6,rows=Math.max(4,Math.round(cols*ratio())),stepX=.72/(cols-1),stepY=.72/(rows-1),grouped=new Set();
  const cells=[];for(let row=1;row<rows-1;row++)for(let col=1;col<cols-1;col++)cells.push({col,row});
  cells.sort((a,b)=>hash(a.col,a.row,sceneSeed)-hash(b.col,b.row,sceneSeed));
  const firstVertical=hash(23,79,sceneSeed)<.5;
  for(const [n,g]of groups.filter(g=>g.type!=='manual').entries()){
   const cell=cells[n%cells.length];g.type='axis';g.angle=(n%2===0)===firstVertical?90:0;g.breaks=0;g.scatter=0;
   g.cx=.14+cell.col*stepX;g.cy=.14+cell.row*stepY;
   const room=g.angle===0?Math.min(g.cx,1-g.cx):Math.min(g.cy,1-g.cy)*ratio();
   g.spacing=Math.min(Math.min(stepX,stepY*ratio())*100*(.16+hash(n,83,sceneSeed)*.16),Math.max(.25,(room-.08)*200/Math.max(1,g.count-1)));
   if(g.anchorId){const anchor=items.find(i=>i.id===g.anchorId);if(anchor){anchor.x=g.cx;anchor.y=g.cy;grouped.add(anchor.id)}}
   layoutGroup(g);for(const i of items.filter(i=>i.groupId===g.id))grouped.add(i.id);
  }
  let n=0;for(const i of items){if(grouped.has(i.id))continue;if(i.type==='text'){i.x=.5;i.y=.14+Math.round((rows-1)/2)*stepY;continue}
   const col=Math.floor(hash(n,63,sceneSeed)*cols),row=Math.floor(hash(n++,71,sceneSeed)*rows);i.x=.14+col*stepX;i.y=.14+row*stepY;
  }
  return;
 }

 const r=ratio(),seed=sceneSeed,centers=logic==='constellation'?[[.22,.23],[.72,.30],[.40,.70],[.80,.80]]:[[.25,.28],[.73,.40],[.42,.76]];
 const locate=(n,spread=.12)=>{const a=hash(n,31,seed)*Math.PI*2,t=Math.sqrt(hash(n,39,seed));if(logic==='radial')return [.5+Math.cos(a)*(.15+t*.24),.5+Math.sin(a)*(.15+t*.24)];if(logic==='field')return [.09+hash(n,43,seed)*.82,.09+hash(n,47,seed)*.82];const c=centers[n%centers.length];return [c[0]+Math.cos(a)*t*spread,c[1]+Math.sin(a)*t*spread]};
 const grouped=new Set();for(const [n,g]of groups.filter(g=>g.type!=='manual').entries()){const [x,y]=locate(n,0);const dx=x-g.cx,dy=y-g.cy;g.cx=x;g.cy=y;for(const i of items.filter(i=>i.groupId===g.id||i.id===g.anchorId)){i.x+=dx;i.y+=dy;grouped.add(i.id)}}
 let n=0;for(const i of items){if(grouped.has(i.id))continue;if(i.type==='text'){i.x=.5;i.y=logic==='radial'?.5:.53;continue}const [x,y]=locate(n++,i.role==='mass'?.03:logic==='constellation'?.08:.18);i.x=x;i.y=y;}
}
function containScene(){const grouped=new Set();for(const g of groups){if(g.type==='manual'){g.cx=groupMembers(g).reduce((a,i)=>a+i.x,0)/Math.max(1,groupMembers(g).length);g.cy=groupMembers(g).reduce((a,i)=>a+i.y,0)/Math.max(1,groupMembers(g).length)}containGroup(g);for(const i of groupMembers(g))grouped.add(i.id)}for(const i of items)if(!grouped.has(i.id))containItem(i)}
function minimumContentRatio(){let min=1/3;for(const i of items){const room=1-2*Math.abs(i.y-.5);if(room<=0)continue;const height=i.type==='text'?(i.fontSize*1.25+8)/1520:i.w*(.5+texturePaddingFraction(i));min=Math.max(min,height/room)}return clamp(min,1/3,3)}
function status(s){$('status').textContent=s}
function groupFor(item){return item?groups.find(g=>g.type==='manual'&&g.memberIds?.includes(item.id))??groups.find(g=>g.id===item.groupId||g.anchorId===item.id):null}
function syncGroup(){const g=groupFor(active());$('groupTools').hidden=!g;if(!g)return;const manual=g.type==='manual';if(g.colonyText)syncColonyControls(g.colonyText);$('groupName').textContent=manual?(g.colonyText?`Texto de colonias · ${g.colonyText.word}`:`Grupo manual · ${groupMembers(g).length} capas`):g.type==='axis'?'Secuencia sobre un eje':'Satélites alrededor de un centro';for(const id of ['groupCount','groupSpacing','groupScatter','groupAngle','groupBreaks','groupSweep'])$(id).closest('label').hidden=manual;$('ungroup').textContent=manual?'Desagrupar capas':'Desvincular grupo';if(!manual)for(const [key,value,unit]of [['Count',g.count,''],['Spacing',g.spacing,'%'],['Scatter',g.scatter,'%'],['Angle',g.angle,'°'],['Breaks',g.breaks??50,'%'],['Sweep',g.sweep??245,'°']]){$('group'+key).value=value;$('group'+key+'Value').value=Math.round(value*10)/10+unit}}
function makeManualGroup(){const chosen=[...$('layers').selectedOptions].map(o=>items.find(i=>i.id===+o.value)).filter(Boolean);if(chosen.length<2){status('Seleccioná al menos dos capas con Ctrl o Shift.');return}if(chosen.some(i=>groupFor(i))){status('Desvinculá primero las capas que ya pertenecen a un grupo.');return}const g={id:++groupCounter,type:'manual',angle:0,spacing:0,count:chosen.length,scatter:0,cx:chosen.reduce((s,i)=>s+i.x,0)/chosen.length,cy:chosen.reduce((s,i)=>s+i.y,0)/chosen.length,memberIds:chosen.map(i=>i.id)};groups.push(g);select(chosen.some(i=>i.id===selected)?selected:chosen[0].id);status(`${chosen.length} capas agrupadas. Podés editar cada capa y mover el grupo.`)}
function layoutGroup(g){
 const members=items.filter(i=>i.groupId===g.id),a=g.angle*Math.PI/180,r=ratio(),seed=g.seed??g.id,breaks=(g.breaks??50)/100;
 let offsets=[0];for(let k=1;k<members.length;k++){const h=hash(k,37,seed),gap=h>.7?1+breaks*(1.5+h*2):1-breaks*.45;offsets.push(offsets.at(-1)+gap)}
 const total=offsets.at(-1)||1;
 members.forEach((item,k)=>{const u=offsets[k]/total,jitter=(hash(k,9,seed)-.5)*g.scatter/100;let dx,dy;
 if(g.type==='axis'){dx=(offsets[k]-total/2)*g.spacing/100;dy=0;item.w=(g.memberSize??.028)*(.38+.62*(1-u))*(.72+.45*hash(k,5,seed))}
 else{const angle=u*(g.sweep??250)*Math.PI/180,radius=g.spacing/100*(1+jitter*.85);dx=Math.cos(angle)*radius;dy=Math.sin(angle)*radius;item.w=(g.memberSize??.025)*(.28+.72*hash(k,5,seed))}
 item.x=g.cx+dx*Math.cos(a)-dy*Math.sin(a);item.y=g.cy+(dx*Math.sin(a)+dy*Math.cos(a))/r;
 });containGroup(g)
}
function addGroup(type,cx=.5,cy=.5,count=9,spacing=type==='axis'?2.4:7){
 const g={id:++groupCounter,type,cx,cy,count,spacing,scatter:type==='axis'?20:38,angle:0,breaks:55,sweep:245,seed:sceneSeed+groupCounter*47,anchorId:null};
 if(type==='radial'){const anchor=newItem('mold',cx,cy,.15);Object.assign(anchor.style,{blur:48,porosity:40,core:75,filaments:38});items.push(anchor);g.anchorId=anchor.id}
 groups.push(g);const colors=type==='axis'?['#ff4c52','#ff9c20','#ffc21c']:['#27633f','#6a983a','#dce642'];
 for(let k=0;k<count;k++){const item=newItem(k%7===0?'ring':'halo');item.groupId=g.id;const col=colors[Math.floor(hash(k,4,g.seed)*colors.length)];Object.assign(item.style,{c1:col,c2:col,c3:col,size:82,blur:k%6===0?35:10,core:0,halo:0,grain:22,porosity:k%3===0?38:8,opacity:72+hash(k,3,g.seed)*24});items.push(item)}
 layoutGroup(g);return g;
}
function editGroup(){const g=groupFor(active());if(!g)return;g.count=+$('groupCount').value;g.spacing=+$('groupSpacing').value;g.scatter=+$('groupScatter').value;g.angle=+$('groupAngle').value;g.breaks=+$('groupBreaks').value;g.sweep=+$('groupSweep').value;let members=items.filter(i=>i.groupId===g.id);while(members.length<g.count){const item=newItem('halo');item.groupId=g.id;item.style={...members[0].style,seed:++idCounter};items.push(item);members.push(item)}if(members.length>g.count){const remove=new Set(members.slice(g.count).map(i=>i.id));items=items.filter(i=>!remove.has(i.id));if(remove.has(selected)){selected=members[0].id;state=members[0].style;sync()}}layoutGroup(g);list();syncGroup();schedule()}
function newItem(preset,x=.5,y=.5,w=.28){return {id:++idCounter,type:'shape',name:({halo:'Halo',capsule:'Cápsula',pair:'Pareja',ring:'Anillo',arc:'Arco',fragment:'Fragmento',mold:'Filamentos',band:'Banda',smoothcol:'Colonia lisa',wrinkled:'Colonia plegada',zoned:'Colonia zonada',cotton:'Cobertura algodonosa',hairy:'Colonia peluda',rimmed:'Colonia aureolada',spotted:'Colonia con manchas',branching:'Expansión ramificada',granular:'Colonia granular',fan:'Crecimiento unilateral',patchy:'Pigmentos irregulares'})[preset],x,y,w,style:{...base,...presets[preset],seed:Math.floor(Math.random()*100000),blur:Math.max(10,presets[preset]?.blur??base.blur),transparent:true,blend:'source-over'}}}
function textItem(text,x,y){return{id:++idCounter,type:'text',name:'Texto',text,x,y,fontSize:28,blur:0,container:false,containerOpacity:88,opacity:100}}
function dockElementControls(){const target=$(mode==='piece'?'elementInspectorAnchor':'elementToolsAnchor');for(const id of ['constructionSection','colorSection','materialSection'])target.append($(id))}
function updateModeHelp(){const single=mode==='single';$('addHeading').textContent=single?'Forma base':'Añadir elementos';$('addHelp').textContent=single?'Elegí una forma y ajustá sus propiedades en este panel.':'Elegí una forma para sumar a la composición. Después podés moverla y editarla.';$('groupAddTools').hidden=single;$('addText').hidden=single;$('colonyTextPanel').hidden=single;$('canvasHelp').textContent=single?'Ajustá la forma desde el panel izquierdo · Exportá el resultado como PNG':'Seleccioná y arrastrá elementos para moverlos · Doble clic sobre un texto para editarlo · Arrastrá los bordes para cambiar el formato'}
function list(){const sel=$('layers'),counts=new Map();sel.replaceChildren();for(const [index,item]of [...items].reverse().entries()){const label=item.type==='text'?`Texto: ${item.text}`:item.name,count=(counts.get(label)||0)+1;counts.set(label,count);let opt=document.createElement('option');opt.value=item.id;opt.textContent=`${String(index+1).padStart(2,'0')} · ${label}${item.type==='text'?'':` ${String(count).padStart(2,'0')}`}`;sel.append(opt);opt.selected=boxSelectionIds.includes(item.id)}if(!boxSelectionIds.length)sel.value=selected??''}
function select(id,preserveMulti=false){if(!preserveMulti)boxSelectionIds=[];if(inlineEditingId!==null&&inlineEditingId!==id&&typeof finishInlineEdit==='function')finishInlineEdit();selected=id;const item=active();if(item?.type==='shape')state=item.style;else state={...base,...paper};state.background=paper.background;state.transparent=paper.transparent;sync();$('selectedControls').hidden=mode!=='piece'||!item;$('selectionHint').hidden=mode!=='piece'||!!item;$('textTools').hidden=item?.type!=='text';$('itemWidthLabel').hidden=item?.type==='text';$('itemWidth').disabled=!item||item.type==='text';$('itemWidth').value=(item?.w??.28)*100;$('widthValue').value=Math.round((item?.w??0)*100)+'%';for(const id of ['constructionSection','colorSection','materialSection'])$(id).hidden=mode==='piece'&&item?.type!=='shape';if(item?.type==='text'){$('textContent').value=item.text;$('fontSize').value=item.fontSize;$('fontValue').value=Math.round(item.fontSize*10)/10+' px';$('textContainer').checked=!!item.container;$('fontFamily').value=fontFamilies.includes(item.fontFamily)?item.fontFamily:'Clamofte';$('containerControls').hidden=!item.container;$('containerColor').value=item.containerColor??'#202c2e';$('textColor').value=item.textColor??'#fffbee';for(const key of ['containerPadding','containerRadius','containerBlur']){const v=item[key]??({containerPadding:45,containerRadius:100,containerBlur:0})[key];$(key).value=v;$(key+'Value').value=v+(key==='containerBlur'?' px':'%')}$('textBlur').value=item.blur??0;$('textBlurValue').value=(item.blur??0)+' px';$('textOpacityLabel').textContent=item.container?'Opacidad de cápsula':'Opacidad de texto';const opacity=item.container?(item.containerOpacity??88):(item.opacity??100);$('textOpacity').value=opacity;$('textOpacityValue').value=opacity+'%'}for(const key of ['shape','gradient','c1','c2','c3','blend',...ranges.map(r=>r[1])])$(key).disabled=mode==='piece'&&item?.type!=='shape';$('modeTag').textContent=mode==='piece'?(item?`Editando · ${item.type==='text'?item.text:item.name}`:'Composición'):'Elemento';list();syncGroup();schedule()}
function setMode(next){mode=next;dockElementControls();$('compositionTools').hidden=mode!=='piece';$('layerTools').hidden=mode!=='piece';$('singleMode').setAttribute('aria-pressed',mode==='single');$('pieceMode').setAttribute('aria-pressed',mode==='piece');updateModeHelp();$('modeTag').textContent=mode==='piece'?'Composición':'Elemento';if(mode==='piece'){if(!items.length)generate();else select(selected)}else{state={...base,...presets[current],...paper,blur:Math.max(10,presets[current]?.blur??base.blur)};sync();for(const key of ['shape','gradient','c1','c2','c3','blend',...ranges.map(r=>r[1])])$(key).disabled=false;for(const id of ['constructionSection','colorSection','materialSection'])$(id).hidden=false;$('selectedControls').hidden=true;$('selectionHint').hidden=true;schedule()}fit();}
function fit(){const box=document.querySelector('.workspace');const r=mode==='piece'?ratio():1;const rect=box.getBoundingClientRect();const available=Math.max(100,Math.min(rect.width-60,(rect.height-40)/r)),w=mode==='piece'&&manualViewWidth?Math.min(manualViewWidth,available):available;$('art').style.width=w+'px';$('art').style.height=(w*r)+'px';$('art').style.aspectRatio='1 / '+r;if(typeof updateDirectUI==='function')updateDirectUI();}
window.addEventListener('resize',fit);
function syncTimeline(){if(!$('timelinePosition'))return;$('timelinePosition').value=Math.round(timelineProgress*1000);$('timelineValue').value=Math.round(timelineProgress*100)+'%';$('playTimeline').textContent=timelinePlaying?'Ⅱ':'▶';$('playTimeline').setAttribute('aria-label',timelinePlaying?'Pausar animación':'Reproducir animación')}
function setTimeline(value){timelineProgress=clamp(value,0,1);syncTimeline();schedule()}
function playTimeline(){timelinePlaying=!timelinePlaying;const start=performance.now()-timelineProgress*9000;syncTimeline();if(!timelinePlaying)return;const tick=now=>{if(!timelinePlaying)return;timelineProgress=Math.min(1,(now-start)/9000);syncTimeline();schedule();if(timelineProgress>=1){timelinePlaying=false;syncTimeline();return}timelineRaf=requestAnimationFrame(tick)};timelineRaf=requestAnimationFrame(tick)}
async function exportTimelineMp4(){if(mode!=='piece'||!items.length){status('Generá una composición antes de exportar el MP4.');return}const button=$('exportMp4');button.disabled=true;timelinePlaying=false;syncTimeline();status('Preparando exportación MP4…');try{const {Output,Mp4OutputFormat,BufferTarget,CanvasSource,Quality}=await import('https://esm.sh/mediabunny');const width=640,height=Math.round(width*ratio()),fps=24,duration=9,frames=fps*duration,frame=document.createElement('canvas');frame.width=width;frame.height=height;const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat(),target}),source=new CanvasSource(frame,{codec:'avc',quality:new Quality('high'),latencyMode:'quality',transform:{frameRate:fps}});output.addVideoTrack(source,{frameRate:fps});await output.start();for(let n=0;n<frames;n++){paintScene(frame,width,false,n/(frames-1));await source.add(n/fps,1/fps);if(n%24===0)status(`Generando MP4 · ${Math.round(n/frames*100)}%`)}await source.close();await output.finalize();const blob=new Blob([target.buffer],{type:'video/mp4'});download(blob,`colonias-crecimiento-${Date.now()}.mp4`);setTimeline(1);status(`MP4 listo · ${(blob.size/1048576).toFixed(1)} MB.`)}catch(error){status('No se pudo exportar MP4: '+(error.message||'revisá tu conexión e intentá otra vez.'))}finally{button.disabled=false}}
$('timelinePosition').oninput=()=>{timelinePlaying=false;setTimeline(+$('timelinePosition').value/1000)};$('playTimeline').onclick=playTimeline;$('exportMp4').onclick=exportTimelineMp4;
function generatePetri(){
 items=[];groups=[];cache.clear();sceneSeed=Math.floor(Math.random()*1000000000);const rnd=k=>hash(k,sceneSeed,sceneSeed),r=ratio(),diameter=.76*Math.min(1,r);
 const colors=[['#ff4c52','#f58bc3','#fffbee'],['#ff9c20','#ffc21c','#fffbee'],['#27633f','#6a983a','#dce642'],['#f58bc3','#ff4c52','#ffc21c']];
 const edge=newItem('ring',.5,.5,diameter);edge.role='petri-rim';Object.assign(edge.style,{size:85,ringWidth:2,blur:10,halo:0,grain:18,opacity:48,c1:'#27633f',c2:'#6a983a',c3:'#dce642'});items.push(edge);
 const rotation=rnd(10)*Math.PI*2,turn=rnd(11)<.5?1:-1;
 let serial=0;
 function colony(x,y,w,preset,family,kind){
  const k=serial++,limit=Math.max(0,diameter*.38-w*.48),dist=Math.hypot(x,y);if(dist>limit){x*=limit/dist;y*=limit/dist}
  const item=newItem(preset,.5+x,.5+y/r,w),c=colors[family%colors.length];
  Object.assign(item.style,{c1:c[0],c2:c[1],c3:c[2],size:kind==='fine'?68:78,blur:kind==='soft'?32+rnd(k+90)*20:10+rnd(k+90)*8,halo:kind==='soft'?12:2,core:kind==='soft'?25:65+rnd(k+180)*25,grain:18+rnd(k+280)*25,porosity:kind==='rough'?35+rnd(k+380)*30:5+rnd(k+380)*18,irregularity:kind==='rough'?22:3,opacity:65+rnd(k+480)*30,seed:Math.floor(rnd(k+580)*100000)});items.push(item);return item;
 }
 const family0=Math.floor(rnd(32)*colors.length),anchors=[];
 // Veladuras editables conectan el fondo sin cubrir toda la placa.
 for(let j=0;j<3;j++){const angle=rotation+j*2.1,rad=diameter*.12;const wash=colony(Math.cos(angle)*rad,Math.sin(angle)*rad,diameter*(.38+rnd(40+j)*.1),'halo',(family0+j)%colors.length,'soft');Object.assign(wash.style,{opacity:30,core:0,blur:55,porosity:20})}
 // Cada masa parte de la anterior y la invade parcialmente.
 for(let j=0;j<4;j++){
  const w=diameter*(.29+rnd(60+j)*.09),angle=rotation+turn*(j*1.8+.2),prev=anchors[j-1];
  let x=j===0?Math.cos(angle)*diameter*.10:prev.x+Math.cos(angle)*(prev.w+w)*.26;
  let y=j===0?Math.sin(angle)*diameter*.10:prev.y+Math.sin(angle)*(prev.w+w)*.26;
  const limit=diameter*.38-w*.48,d=Math.hypot(x,y);if(d>limit){x*=limit/d;y*=limit/d}
  const item=colony(x,y,w,j%2?'halo':'mold',(family0+j)%colors.length,j%2?'smooth':'rough');
  anchors.push({x,y,w,family:(family0+j)%colors.length,item});
 }
 // Algunas colonias dejan un borde concéntrico visible sobre su centro.
 for(let j=0;j<anchors.length;j++)if(rnd(850+j)>.35){const a=anchors[j],rim=colony(a.x,a.y,a.w*(.70+rnd(860+j)*.16),'ring',a.family,'smooth');Object.assign(rim.style,{ringWidth:3+rnd(870+j)*4,blur:10,opacity:48,core:0})}
 // Formas medianas se apoyan sobre bordes existentes; algunas quedan más encima.
 const medium=12+Math.round(density*.13);
 for(let j=0;j<medium;j++){const a=anchors[j%anchors.length],angle=rotation+turn*(j*2.4+rnd(100+j)*.6),w=diameter*(.075+rnd(200+j)*.075),rad=(a.w+w)*(.25+rnd(300+j)*.12);colony(a.x+Math.cos(angle)*rad,a.y+Math.sin(angle)*rad,w,j%6===0?'ring':'halo',j%3===0?(a.family+1)%colors.length:a.family,j%5===0?'rough':'smooth')}
 // Un arco de microcolonias sigue el borde hacia el encuentro entre dos masas.
 const first=anchors[Math.floor(rnd(880)*anchors.length)],second=anchors[(anchors.indexOf(first)+1)%anchors.length],trail=9+Math.round(density/12);
 const joinAngle=Math.atan2(second.y-first.y,second.x-first.x);
 // Cada placa elige una relación: borde, superposición libre o mezcla.
 const smallLogic=Math.min(2,Math.floor(rnd(1200)*3));
 function behind(item,anchor){const pos=items.indexOf(item),before=items.indexOf(anchor.item);if(pos>=0&&before>=0&&pos>before){items.splice(pos,1);items.splice(before,0,item)}}
 if(smallLogic!==1)for(let j=0;j<trail;j++){const angle=joinAngle+(j/(trail-1)-.5)*1.35,rad=first.w*(.39+(rnd(900+j)-.5)*.10),w=diameter*(.014+rnd(930+j)*.024),item=colony(first.x+Math.cos(angle)*rad,first.y+Math.sin(angle)*rad,w,'halo',j%3===0?second.family:first.family,'fine');if(j%3!==0)behind(item,first)}
 // La mezcla asigna cada punto a un borde o a la superficie de una colonia.
 const small=18+Math.round(density*.32);
 for(let j=0;j<small;j++){const n=Math.floor(rnd(1250+j)*anchors.length),a=anchors[n],next=anchors[(n+1)%anchors.length],onEdge=smallLogic===0||(smallLogic===2&&rnd(1350+j)<.5),base=Math.atan2(next.y-a.y,next.x-a.x),angle=onEdge?base+(rnd(500+j)-.5)*2.3:rnd(500+j)*Math.PI*2,rad=onEdge?a.w*(.39+(rnd(600+j)-.5)*.17):a.w*.32*Math.sqrt(rnd(600+j)),w=diameter*(.012+Math.pow(rnd(700+j),2)*.028),item=colony(a.x+Math.cos(angle)*rad,a.y+Math.sin(angle)*rad,w,j%11===0?'pair':'halo',j%4===0?(a.family+1)%colors.length:a.family,'fine');if(onEdge&&j%4!==0)behind(item,a)}
  compositionLogic='petri';structureScale=100;structureAir=100;bandAngle=0;bandPosition=0;for(const id of ['structureScale','structureAir']){$(id).value=100;$(id+'Value').value='100%'}applyColorMix();syncBand();fitWholeScene();pieceBaseline=null;selected=null;timelineProgress=1;select(null);syncTimeline();status('Placa generada · colonias editables.');
}
function generateFigurativeExample(){
 items=[];groups=[];cache.clear();sceneSeed=20261109;timelineProgress=1;format='square';$('format').value='square';paper={background:'#fffbee',transparent:false};
 const put=(preset,x,y,w,extra={})=>{const item=newItem(preset,x,y,w);item.style={...item.style,...extra,seed:1000+items.length*173};items.push(item);return item};
 const rim=put('ring',.5,.5,.98,{size:85,ringWidth:4,blur:12,halo:0,grain:9,opacity:52,c1:'#6a983a',c2:'#6a983a',c3:'#6a983a'});rim.role='petri-rim';rim.petriExampleRim=true;
 // Veladuras compartidas: conectan los grupos sin ocultar sus capas editables.
 for(const [x,y,w,c1,c2] of [[.38,.46,.30,'#b6c6a6','#eee4cf'],[.48,.51,.34,'#dec9a3','#eee4cf'],[.57,.56,.29,'#dfb5ab','#eee4cf'],[.66,.48,.31,'#b6c6a6','#eee4cf'],[.42,.65,.30,'#dec9a3','#dfb5ab'],[.62,.66,.27,'#b6c6a6','#dec9a3']]){const veil=put('halo',x,y,w,{size:80,blur:75,halo:20,grain:12,core:0,opacity:32,c1,c2,c3:'#fffbee'});veil.role='transition'}
 put('cotton',.70,.38,.40,{opacity:72,detail:82,filaments:60,grain:17,focusCount:4,focusSize:18,focusSpread:48,c1:'#202c2e',c2:'#fffbee',c3:'#b6c6a6'});put('hairy',.30,.41,.25,{opacity:55,detail:70,filaments:65,grain:17,c2:'#b6c6a6'});
 put('branching',.70,.63,.38,{opacity:76,detail:86,branchLength:125,branchSpread:115,branchDensity:10});
 put('smoothcol',.49,.22,.18,{c1:'#dec9a3',c2:'#eee4cf',c3:'#fffbee',detail:22});
 put('smoothcol',.58,.29,.14,{c1:'#dec9a3',c2:'#eee4cf',c3:'#fffbee'});
 put('wrinkled',.44,.38,.18,{detail:82,c1:'#dec9a3',c2:'#eee4cf',c3:'#fffbee'});put('smoothcol',.35,.48,.15,{c1:'#dec9a3',c2:'#eee4cf',c3:'#fffbee'});
 put('wrinkled',.42,.62,.21,{detail:76,c1:'#dfb5ab',c2:'#eee4cf',c3:'#fffbee'});
 put('rimmed',.57,.47,.13,{c1:'#ff4c52',c2:'#f58bc3',c3:'#ff9c20'});
 put('zoned',.53,.59,.18,{zones:4,detail:72});
 put('granular',.43,.80,.14,{c1:'#202c2e',c2:'#ff4c52',c3:'#f58bc3'});put('spotted',.43,.80,.10,{opacity:65,zones:4});put('zoned',.51,.82,.12,{zones:3,detail:80});
 const anchors=[[.38,.47],[.40,.59],[.52,.55],[.61,.62],[.68,.66],[.31,.60],[.44,.38],[.55,.48],[.35,.70]];
 for(let i=0;i<150;i++){const a=anchors[i%anchors.length],u=hash(i,7,sceneSeed),angle=hash(i,8,sceneSeed)*Math.PI*2,rad=.012+Math.sqrt(hash(i,9,sceneSeed))*.083,w=.006+u*u*.027,green=i%4===0,item=put('halo',a[0]+Math.cos(angle)*rad,a[1]+Math.sin(angle)*rad,w,{size:80,blur:27,halo:10,grain:10,core:20,opacity:52+Math.round(u*30),c1:green?'#8a8e5c':'#ffc21c',c2:green?'#b6c6a6':'#ff9c20',c3:green?'#dec9a3':'#dec9a3'});item.role='satellite'}
 for(const i of items)if(i!==rim){i.x=.5+(i.x-.5)*1.12;i.y=.5+(i.y-.5)*1.12;i.w*=1.08}
 compositionLogic='petri';$('compositionLogic').value='petri';structureScale=100;structureAir=100;bandAngle=0;bandPosition=0;for(const id of ['structureScale','structureAir']){$(id).value=100;$(id+'Value').value='100%'}syncBand();pieceBaseline=null;selected=null;containScene();
 // La circunferencia visible depende de la escala interna del anillo, no de su caja.
 rim.w=.98;const radius=rim.w*rim.style.size/200-.015;
 for(const i of items){if(i===rim)continue;const s=i.style,reach=s.shape==='branching'?1.45:s.shape==='hairy'?1.18:s.shape==='cotton'?1.1:1,extent=i.w*((s.size/200)*reach+Math.min(.08,s.blur/760*1.5)+s.halo/200),distance=Math.hypot(i.x-.5,i.y-.5),room=Math.max(0,radius-extent);if(distance>room&&distance){i.x=.5+(i.x-.5)*room/distance;i.y=.5+(i.y-.5)*room/distance}}
 setMode('piece');select(null);syncTimeline();fit();status('Placa figurativa editable · seleccioná una forma para ajustarla.');
}
$('figureExample').onclick=generateFigurativeExample;
function recreateReferencePlate(){
 items=[];groups=[];cache.clear();sceneSeed=38271;format='square';manualViewWidth=null;
 $('format').value=format;compositionLogic='petri';$('compositionLogic').value='petri';
 paper={background:'#fffbee',transparent:false};

 // Medidas sobre la referencia anotada (696 × 690). El diámetro es el visible.
 function layer(x,y,diameter,preset,style){
  const size=style.size??80;
  const item=newItem(preset,x/696,y/690,diameter/696*100/size);
  Object.assign(item.style,{size,halo:0,blur:8,grain:22,porosity:0,opacity:100,seed:38271+items.length*173,...style});
  items.push(item);
  return item;
 }
 const agar=layer(364,352,659,'halo',{size:85,c1:'#f3ead1',c2:'#f3ead1',c3:'#eee4cf',irregularity:0,core:0,blur:3,grain:8});
 agar.role='reference-agar';
 const dust={c1:'#462817',c2:'#80664d',c3:'#dec9a3',detail:100,blur:30,edgeSoft:75,grain:70,porosity:90,core:0};
 const upper=layer(414,235,333,'granular',{...dust,rotation:-25,irregularity:48,opacity:91});
 const right=layer(436,343,292,'granular',{...dust,irregularity:45,opacity:94});
 const lower=layer(393,434,247,'granular',{...dust,rotation:35,irregularity:40,opacity:97});
 for(const [cloud,contacts] of [[upper,[[449,156,-1.05,15],[482,199,-.6,18]]],[right,[[482,199,-.6,18],[532,381,.15,23]]],[lower,[[407,462,1.45,19],[532,381,.15,20]]]]){
  cloud.softNotches=contacts.map(([x,y,angle,radius])=>[(x/696-cloud.x)/cloud.w,(y/690-cloud.y)/cloud.w,angle,radius/696/cloud.w]);
 }
 layer(356,314,142,'patchy',{c1:'#28180f',c2:'#28180f',c3:'#462817',irregularity:69,detail:90,blur:12,core:85,grain:45,porosity:24});
 layer(358,310,110,'granular',{c1:'#28180f',c2:'#28180f',c3:'#462817',irregularity:82,detail:90,blur:12,core:70,grain:52,porosity:19});

 const warm={
  gold:['#ff9c20','#e8ae2f','#efcc6d'],
  ochre:['#80664d','#c28a37','#efcc6d'],
  pale:['#c28a37','#dec9a3','#eee4cf'],
  rust:['#bd351d','#e66620','#efcc6d']
 };
 function colony(x,y,d,tone,shape='smoothcol',extra={}){
  const [c1,c2,c3]=warm[tone];
  return layer(x,y,d,shape,{c1,c2,c3,detail:55,blur:9,edgeSoft:16,core:50,...extra});
 }
 const main=[
  [255,115,46,'ochre'],[303,127,34,'gold'],[340,140,39,'ochre'],[382,140,41,'ochre','patchy'],
  [449,158,33,'ochre'],[485,198,41,'ochre','granular'],[573,296,69,'ochre'],[541,431,48,'ochre'],
  [409,533,59,'ochre'],[408,460,44,'ochre','granular'],[296,488,39,'ochre'],[295,445,30,'ochre'],
  [283,199,39,'ochre','granular'],[325,192,32,'ochre','patchy'],[233,212,26,'gold'],[218,237,28,'gold'],
  [175,245,51,'gold'],[147,242,28,'pale'],[57,292,42,'ochre'],[85,368,38,'pale'],
  [99,307,26,'rust','patchy'],[73,326,18,'rust'],[200,491,48,'rust','patchy'],[230,485,18,'ochre'],
  [234,502,18,'pale'],[342,410,20,'rust'],[411,349,15,'rust']
 ];
 main.forEach(([x,y,d,tone,kind])=>colony(x,y,d,tone,kind,{irregularity:kind==='patchy'?59:18,studyLobes:kind==='patchy'?3:0,studyDepth:24}));
 colony(531,382,48,'pale','rimmed',{c1:'#462817',c2:'#80664d',c3:'#eee4cf',detail:93,core:62});

 const bands=[
  [ [150,308,24],[163,297,24],[187,286,20],[199,274,18],[211,281,17],[222,253,23],[209,313,13],[213,331,14],[191,322,18],[175,332,17],[231,315,15],[240,337,12] ],
  [ [105,340,27],[115,358,32],[135,351,37],[146,372,25],[158,380,20],[166,355,16],[181,361,18],[194,348,14],[209,350,18],[224,358,13],[215,373,14],[231,381,12],[211,389,16],[222,403,17],[244,389,12],[241,412,13] ],
  [ [223,425,23],[215,443,29],[239,443,25],[253,446,27],[230,454,16],[252,425,14],[267,418,13],[282,426,17],[299,414,24],[320,443,24],[321,423,18],[301,467,28],[284,472,19],[263,459,19],[276,452,15] ],
  [ [253,365,11],[263,354,9],[271,372,14],[285,361,11],[293,375,12],[306,360,9],[321,376,12],[264,391,15],[277,386,13],[286,404,17],[256,403,11],[303,398,16],[314,388,12],[329,396,14],[337,380,13],[346,393,11],[365,387,12] ],
  [ [280,224,11],[286,235,14],[298,252,17],[310,248,13],[326,251,14],[336,263,10],[350,271,9],[368,233,17],[386,232,19],[398,248,14],[422,269,27],[451,258,24],[465,247,29],[471,285,21],[458,300,21],[468,304,19],[451,322,24],[448,340,20],[411,392,19],[368,452,25],[382,445,20] ]
 ];
 bands.forEach((band,i)=>band.forEach(([x,y,d],j)=>colony(x,y,d,i===4||j%4===1?'ochre':'gold',i>=3?'granular':'smoothcol',{opacity:i===3?86:96,blur:i===4?7:9})));
 const flecks=[
  [114,285,6],[119,289,4],[123,298,4],[253,345,5],[266,339,5],[278,351,7],
  [288,327,5],[297,340,6],[303,352,5],[245,383,6],[259,379,5],[273,410,6],
  [297,387,5],[315,372,6],[327,362,6],[319,292,6],[352,261,6],[371,272,5],
  [224,487,6],[219,501,6]
 ];
 flecks.forEach(([x,y,d],i)=>colony(x,y,d,i<3?'rust':'gold','granular',{blur:3,opacity:83}));
 const crowded=[
  [137,427,40],[151,410,28],[167,421,36],[182,407,31],[170,392,27],[190,387,24],[199,399,25]
 ].map(([x,y,d],i)=>colony(x,y,d,i===0||i===2?'ochre':'gold','smoothcol',{blur:5,edgeBlur:7,irregularity:23,studyLobes:4,studyDepth:14,rotation:i*37}));
 for(const item of crowded){
  item.softContacts=crowded.filter(other=>other!==item).flatMap(other=>{
   const dx=other.x-item.x,dy=other.y-item.y,distance=Math.hypot(dx,dy);
   if(distance>(item.w+other.w)*.40)return [];
   return [[dx/distance,dy/distance,distance/(2*item.w)]];
  });
 }

 structureScale=100;structureAir=100;bandAngle=0;bandPosition=0;
 for(const id of ['structureScale','structureAir']){$(id).value=100;$(id+'Value').value='100%'}
 syncBand();pieceBaseline=null;selected=null;timelinePlaying=false;timelineProgress=1;
 state={...base,...paper};select(null);syncTimeline();fit();
 status('Placa de referencia recreada · elementos editables.');
}
function generate(){
 if(Object.values(colorWeights).every(v=>v===0)){status('Elegí al menos un porcentaje de color para generar.');return}
 if($('compositionLogic').value==='petri'){generatePetri();return}
 items=[];groups=[];cache.clear();timelineProgress=1;sceneSeed=Math.floor(Math.random()*1000000000);const rnd=k=>hash(k,sceneSeed,sceneSeed),r=ratio();
 // Tres concentraciones desiguales dentro de una sola banda; sus extremos se disuelven.
 const centers=[{x:.16+rnd(1)*.07,y:.5+(rnd(2)-.5)*.06/r},{x:.48+rnd(3)*.10,y:.5+(rnd(4)-.5)*.1/r},{x:.87+rnd(5)*.05,y:.5+(rnd(6)-.5)*.07/r}];
 const families={rose:['#ff4c52','#f58bc3','#f58bc3'],amber:['#ff9c20','#ffc21c','#ffc21c'],green:['#27633f','#6a983a','#dce642']};
 let variationIndex=0;
 function put(preset,x,y,w,family,extra={}){const n=variationIndex++,v=k=>rnd(3000+n*17+k);if(w>.035&&preset==='halo'&&v(1)<.28)preset=v(2)<.5?'pair':'capsule';if(w>.035&&families[family]&&v(3)<.38)family=['rose','amber','green'][Math.floor(v(4)*3)];w*=w>.035?.65+v(5)*.75:.75+v(5)*.5;x+=(v(6)-.5)*.09;y+=(v(7)-.5)*.12/r;const item=newItem(preset,x,y,w),cs=families[family]??[family,family,family];Object.assign(item.style,{c1:cs[0],c2:cs[1],c3:cs[2],seed:Math.floor(v(8)*100000),size:78,blur:10,core:0,grain:28,porosity:20,halo:0,opacity:75,irregularity:2},extra);item.role=w>.16?'mass':w>.035?'body':'satellite';items.push(item);return item}
 // Pocas masas amplias, tratadas de modo distinto y separadas por aperturas.
 put('halo',centers[0].x-.045,centers[0].y-.035/r,.24,'rose',{opacity:62,porosity:42,blur:13});
 put('halo',centers[1].x+.01,centers[1].y+.035/r,.20,'amber',{opacity:53,porosity:45});
 put('halo',centers[2].x+.065,centers[2].y-.065/r,.28,'rose',{opacity:52,porosity:64,blur:15});
 // Cuerpos que conectan las concentraciones, alternando por encima y debajo del eje.
 const bridges=[{x:.32,y:-.035,w:.13,f:'rose'},{x:.43,y:.065,w:.115,f:'amber'},{x:.49,y:-.060,w:.16,f:'rose'},{x:.66,y:.025,w:.12,f:'green'},{x:.77,y:-.010,w:.105,f:'rose'}];
 bridges.forEach((b,k)=>{if(rnd(k+710)<.72)put('halo',b.x+(rnd(k+700)-.5)*.10,.5+b.y/r,b.w,b.f,{opacity:k===2?57:72,porosity:k%2?12:28,blur:10,blend:k===3?'multiply':'source-over'})});
 // Cuerpos medianos y cápsulas que atraviesan la dirección principal.
 centers.forEach((center,k)=>{
  for(let j=0;j<3+Math.floor(rnd(k+820)*4);j++){const u=k*100+j,x=center.x+(rnd(u+120)-.5)*.24,y=center.y+(rnd(u+150)-.5)*.24/r;
   const family=['rose','amber','green'][(j+k)%3],preset=j===3?'capsule':j===4?'pair':'halo';
   put(preset,x,y,.055+rnd(u+180)*.075,family,{opacity:62+rnd(u+220)*28,blur:j===1?40:10,porosity:j===2?46:10,blend:j%3===0?'multiply':'source-over'});
  }
  put('capsule',center.x+.04,center.y+.045/r,.18,'green',{size:48,opacity:80,elongation:92,porosity:27,gradient:'linear'});
 });
 // Anillos finos, fragmentos y arcos: acentos discretos que dejan ver el fondo.
 put('ring',.70,.5-.105/r,.105,'#ff9c20',{ringWidth:2,porosity:22,opacity:90});
 put('arc',.32,.5+.11/r,.085,'#dce642',{arc:265,ringWidth:4,rotation:22,porosity:32});
 put('fragment',.81,.5+.06/r,.09,'rose',{arc:115,rotation:40,porosity:45,opacity:58});
 // Puntos y pequeños pares que se acumulan en núcleos y se dispersan hacia los extremos.
 const count=Math.round((45+density*1.1)*(.7+rnd(870)*.6));
 for(let j=0;j<count;j++){const k=1000+j,cluster=Math.floor(rnd(k)*3),center=centers[cluster];const a=rnd(k+300)*Math.PI*2,dist=Math.pow(rnd(k+600),.8),x=center.x+Math.cos(a)*dist*.17,y=center.y+Math.sin(a)*dist*.125/r;
  const w=.0025+Math.pow(rnd(k+900),2.3)*.025,family=['#ff4c52','#f58bc3','#ffc21c','#dce642','#27633f'][Math.floor(rnd(k+1500)*5)];
  put(j%19===0?'pair':'halo',x,y,w,family,{porosity:j%6===0?50:5,opacity:55+rnd(k+1200)*40,grain:18});
 }
 // Secuencias pequeñas con pausas; arcos radiales incompletos alrededor de dos centros.
 const axis1=addGroup('axis',.12+rnd(881)*.2,.5-.095/r,7+Math.floor(rnd(882)*9),1.1+rnd(883));axis1.angle=0;axis1.memberSize=.016+rnd(884)*.015;axis1.breaks=72;layoutGroup(axis1);
 if(rnd(885)>.3){const axis2=addGroup('axis',.65+rnd(886)*.2,.5+.10/r,7+Math.floor(rnd(887)*9),1+rnd(888));axis2.angle=0;axis2.memberSize=.018+rnd(889)*.015;axis2.breaks=60;layoutGroup(axis2)}
 const radial1=addGroup('radial',.25+rnd(890)*.2,.5+.045/r,7+Math.floor(rnd(891)*9),4+rnd(892)*4);radial1.sweep=150+rnd(893)*130;radial1.angle=18;radial1.memberSize=.021;layoutGroup(radial1);
 if(rnd(894)>.3){const radial2=addGroup('radial',.7+rnd(895)*.2,.5-.025/r,7+Math.floor(rnd(896)*9),4+rnd(897)*3);radial2.sweep=130+rnd(898)*120;radial2.angle=-125;radial2.memberSize=.018;layoutGroup(radial2)}
 // Envolventes desenfocadas con núcleo independiente, por detrás del texto.
 put('mold',.35,.5+.045/r,.15,'green',{filaments:70,core:72,blur:38,porosity:35,opacity:88});
 put('halo',.63,.5-.08/r,.14,'rose',{core:80,blur:90,porosity:14,opacity:84});
 const title=textItem('Mohos y levaduras',.47,.5,.46);items.push(title);
 // Unos pocos elementos cruzan los extremos de la cápsula y mantienen el texto despejado.
 put('halo',title.x-textWidth(title)/1520+.008,.5-.019/r,.036,'#f58bc3',{opacity:65,porosity:12});
 put('ring',title.x+textWidth(title)/1520-.005,.5+.017/r,.027,'#dce642',{ringWidth:8,opacity:60});
  structureScale=100;structureAir=100;for(const id of ['structureScale','structureAir']){$(id).value=100;$(id+'Value').value='100%'}compositionLogic=$('compositionLogic').value||'field';if(compositionLogic!=='band')arrangeComposition(compositionLogic);const angle=compositionLogic==='band'?(r>1.05?90:r<.95?0:35):0,position=0;bandAngle=0;bandPosition=0;placeBand(angle,position);applyColorMix();fitWholeScene();pieceBaseline=null;selected=title.id;select(selected);status('Composición lista · elementos editables.');
}
function sprite(item,res){const key=JSON.stringify([item.style,res,item.softNotches,item.softContacts]);if(cache.has(key))return cache.get(key);const old=state;state={...item.style,transparent:true,opacity:100,blend:'source-over'};const c=document.createElement('canvas');const pad=Math.ceil(res*texturePaddingFraction(item));c.texturePadding=pad;try{singleRender(c,res,pad)}finally{state=old}
 if(item.softNotches?.length||item.softContacts?.length){const ctx=c.getContext('2d'),image=ctx.getImageData(0,0,c.width,c.height),data=image.data;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(!data[i+3])continue;const px=(x-pad)/res-.5,py=(y-pad)/res-.5;let alpha=1;for(const [nx,ny,angle,r] of item.softNotches||[]){const ux=Math.cos(angle),uy=Math.sin(angle),dx=px-nx,dy=py-ny,along=dx*ux+dy*uy,side=Math.abs(-dx*uy+dy*ux),distance=Math.hypot(Math.max(-along,0),side)-r;const grain=(hash(x,y,item.style.seed+931)-.5)*.045;alpha*=smooth((distance+grain+.035)/.085)}for(const [nx,ny,offset] of item.softContacts||[]){const distance=offset-(px*nx+py*ny);alpha*=smooth((distance+.012)/.028)}data[i+3]*=alpha}ctx.putImageData(image,0,0)}if(cache.size>350)cache.clear();cache.set(key,c);return c;}
function bounds(i,w,h){const width=i.type==='text'?textWidth(i)*w/760:i.w*w,height=i.type==='text'?(i.fontSize*1.25+8)*w/760:i.w*w;return{x:i.x*w-width/2,y:i.y*h-height/2,w:width,h:height}}
function paintScene(target,width,guide=false,progress=1){const h=Math.round(width*ratio()),c=target.getContext('2d');target.width=width;target.height=h;if(!paper.transparent){c.fillStyle=paper.background;c.fillRect(0,0,width,h)}const step=.82/Math.max(1,items.length);for(const [index,item]of items.entries()){const phase=clamp((progress-index*step)/.18,0,1);if(phase<=0)continue;const growth=.04+.96*(phase*phase*(3-2*phase));let b=bounds(item,width,h);c.save();c.globalAlpha*=phase;c.translate(item.x*width,item.y*h);c.scale(growth,growth);c.translate(-item.x*width,-item.y*h);if(item.type==='shape'){c.globalAlpha*=item.style.opacity/100;c.globalCompositeOperation=item.style.blend;const res=Math.max(64,Math.ceil(b.w));const image=sprite(item,res),pad=(image.texturePadding||0)*b.w/res;if(Array.isArray(item.cutouts)&&item.cutouts.length){c.beginPath();c.rect(b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2);for(const hole of item.cutouts){const x=item.x*width+hole[0]*b.w,y=item.y*h+hole[1]*b.w,r=hole[2]*b.w;c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2)}c.clip('evenodd')}if(Array.isArray(item.edgeNotches)){c.beginPath();c.rect(b.x-pad,b.y-pad,b.w+2*pad,b.h+2*pad);for(const [nx,ny,angle,rad] of item.edgeNotches){const x=item.x*width+nx*b.w,y=item.y*h+ny*b.w,ux=Math.cos(angle),uy=Math.sin(angle),tx=-uy,ty=ux,r=rad*b.w,L=b.w*2;c.moveTo(x+tx*r+ux*L,y+ty*r+uy*L);c.lineTo(x+tx*r,y+ty*r);c.quadraticCurveTo(x-ux*r,y-uy*r,x-tx*r,y-ty*r);c.lineTo(x-tx*r+ux*L,y-ty*r+uy*L);c.closePath()}c.clip('evenodd')}if(Array.isArray(item.contactPlanes)){for(const [nx,ny,offset] of item.contactPlanes){const cx=item.x*width+nx*offset*b.w,cy=item.y*h+ny*offset*b.w,tx=-ny,ty=nx,L=b.w*4;c.beginPath();c.moveTo(cx+tx*L,cy+ty*L);c.lineTo(cx-tx*L,cy-ty*L);c.lineTo(cx-tx*L-nx*L,cy-ty*L-ny*L);c.lineTo(cx+tx*L-nx*L,cy+ty*L-ny*L);c.closePath();c.clip()}}c.drawImage(image,b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2)}else{if(item.container){c.fillStyle=item.containerColor??'#202c2e';c.globalAlpha=(item.containerOpacity??88)/100*phase;c.filter='blur('+((item.containerBlur??0)*width/760)+'px)';c.beginPath();c.roundRect(b.x,b.y,b.w,b.h,b.h/2*(item.containerRadius??100)/100);c.fill();c.filter='none'}c.globalAlpha=(item.opacity??100)/100*phase;c.filter='blur('+((item.blur??0)*width/760)+'px)';const px=item.fontSize*width/760;c.font=`normal ${px}px ${fontStack(item)}`;c.fillStyle=item.container?(item.textColor??'#fffbee'):'#202c2e';c.textAlign='center';c.textBaseline='middle';if(!guide||item.id!==inlineEditingId)c.fillText(item.text,item.x*width,item.y*h)}c.restore()}
 if(guide&&active()){const targets=boxSelectionIds.length?items.filter(i=>boxSelectionIds.includes(i.id)):[active()];c.save();c.strokeStyle='#668947';c.lineWidth=1;c.setLineDash([4,5]);for(const item of targets){const b=bounds(item,width,h);c.strokeRect(b.x,b.y,b.w,b.h)}c.restore()}}
schedule=function(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;if(mode==='piece'){paper.background=state.background;paper.transparent=state.transparent;paintScene(canvas,640,true,timelineProgress);$('name').textContent=`Pieza / ${items.length} elementos`;$('timeline').hidden=false}else{singleRender(canvas,760);$('timeline').hidden=true} $('art').classList.toggle('checker',state.transparent);$('art').style.backgroundColor=state.background;if(typeof updateDirectUI==='function')updateDirectUI();})};
choose=function(name){if(mode==='single'){singleChoose(name);return}current=name;const item=newItem(name);containItem(item);items.push(item);select(item.id)};
$('singleMode').onclick=()=>setMode('single');$('pieceMode').onclick=()=>setMode('piece');$('format').onchange=()=>{format=$('format').value;manualViewWidth=null;if(format==='custom')customRatio=Math.max(customRatio,minimumContentRatio());fit();schedule()};$('density').oninput=()=>{density=+$('density').value;$('densityValue').value=density};$('newPiece').onclick=generate;$('clearCanvas').onclick=()=>{if(!items.length)return;if(!confirm('¿Vaciar el lienzo? Guardá la receta antes si querés conservar la composición.'))return;items=[];groups=[];selected=null;pieceBaseline=null;cache.clear();timelinePlaying=false;timelineProgress=1;syncTimeline();select(null);status('Lienzo vacío.')};$('referencePlate').onclick=recreateReferencePlate;
for(const [key,id]of [['green','mixGreen'],['yellow','mixYellow'],['rose','mixRose']])$(id).oninput=()=>{setColorMix(key,clamp(Math.round(Number($(id).value)||0),0,100));syncColorMixInputs()};
 $('layers').onchange=()=>{const chosen=[...$('layers').selectedOptions].map(o=>+o.value);boxSelectionIds=chosen;if(chosen.length>1){select(chosen.includes(selected)?selected:chosen[0]);for(const o of $('layers').options)o.selected=chosen.includes(+o.value)}else select(chosen[0]??null)};$('makeGroup').onclick=makeManualGroup;
$('itemWidth').oninput=()=>{if(active()?.type==='shape'){active().w=+$('itemWidth').value/100;/* El recorte se conserva al cambiar el tamaño. */$('itemWidth').value=active().w*100}$('widthValue').value=Math.round(+$('itemWidth').value)+'%';schedule()};

const ctKeys=['Scale','Dot','Spacing','Variation','Blur','Grain','Opacity'];
function syncColonyControls(o){$('colonyWord').value=o.word;$('ctColor').value=o.color;$('ctModule').value=o.module||'halo';$('ctColorMode').value=o.colorMode||'gradient';for(const k of ctKeys){$('ct'+k).value=o[k];$('ct'+k+'Value').value=o[k]+(k==='Blur'?' px':'%')}}
function colonySettings(){const o={word:$('colonyWord').value.trim().toUpperCase().slice(0,8),color:$('ctColor').value,module:$('ctModule').value,colorMode:$('ctColorMode').value};for(const k of ctKeys)o[k]=Number($('ct'+k).value);return o}
const colonyAlphabet={
 A:['00100','01110','11011','11111','10001'], B:['11110','11011','11110','11011','11110'], C:['01110','11011','10000','11011','01110'], D:['11110','11011','11011','11011','11110'], E:['11111','11000','11111','11000','11111'],
 F:['11111','11000','11110','11000','11000'], G:['01110','11011','10000','11011','01111'], H:['11011','11011','11111','11011','11011'], I:['11111','00100','00100','00100','11111'], J:['00111','00011','00011','11011','01110'],
 K:['11011','11110','11100','11110','11011'], L:['11000','11000','11000','11000','11111'], M:['10001','11011','10101','10001','10001'], N:['10001','11001','10101','10011','10001'], Ñ:['01010','11011','11111','11111','11011'], O:['01110','11011','11011','11011','01110'],
 P:['11111','10001','11111','10000','10000'], Q:['01110','11011','11011','01110','00011'], R:['11111','10001','11111','10010','10001'], S:['01111','11000','01110','00011','11110'], T:['11111','00100','00100','00100','00100'],
 U:['11011','11011','11011','11011','01110'], V:['10001','10001','11011','01110','00100'], W:['10001','10001','10101','11011','01010'], X:['11011','01110','00100','01110','11011'], Y:['11011','01110','00100','00100','00100'], Z:['11111','00011','00100','11000','11111'], ' ':['00000','00000','00000','00000','00000']
};
function colonyLetters(word){return [...word].map(ch=>{const key=ch==='Ñ'?ch:ch.normalize('NFD').replace(/[\u0300-\u036f]/g,'');const pattern=colonyAlphabet[key];if(!pattern)throw Error('Usá letras y espacios en el texto con colonias.');const dots=[];pattern.forEach((row,y)=>[...row].forEach((cell,x)=>{if(cell==='1')dots.push([x,y])}));return dots})}
function buildColonyText(replace=false){const cfg=colonySettings();if(!cfg.word){status('Escribí una palabra.');return}let g=replace?groupFor(active()):null;if(!g?.colonyText)g=null;let letters;try{letters=colonyLetters(cfg.word)}catch(e){status(e.message);return}const count=letters.reduce((n,a)=>n+a.length,0);if(!count){status('Usá letras o números.');return}if(items.length-(g?.memberIds.length??0)+count>500){status('La composición admite hasta 500 elementos.');return}const cx=g?.cx??.5,cy=g?.cy??.5;if(g){const remove=new Set(g.memberIds);items=items.filter(i=>!remove.has(i.id));g.memberIds=[]}else{g={id:++groupCounter,type:'manual',cx,cy,angle:0,spacing:0,count:0,scatter:0,memberIds:[]};groups.push(g)}g.colonyText=cfg;const step=cfg.Scale/100*.8/Math.max(5,cfg.word.length*6-1),space=cfg.Spacing/100,seed=g.id*319;let n=0;for(const [letter,dots] of letters.entries())for(const [x,y] of dots){const jitter=cfg.Variation/100,dx=(hash(n,12,seed)-.5)*jitter,dy=(hash(n,13,seed)-.5)*jitter;const px=(letter*6+x-(cfg.word.length*6-2)/2)*step*space,py=(y-2)*step*space;const kinds=['halo','smoothcol','zoned','granular','ring'];const kind=cfg.module==='mixed'?kinds[Math.floor(hash(n,89,seed)*kinds.length)]:cfg.module;const item=newItem(kind,cx+px+dx*step,cy+(py+dy*step)/ratio(),step*cfg.Dot/100);let family=cfg.color;if(family==='mix'){const v=hash(n,71,seed)*100;family=v<colorWeights.green?'green':v<colorWeights.green+colorWeights.yellow?'yellow':'rose'}const palettes={rose:['#ff4c52','#f58bc3','#dfb5ab','#bd351d'],green:['#27633f','#6a983a','#dce642','#8a8e5c'],yellow:['#ffc21c','#ff9c20','#e8ae2f','#efcc6d']};const colors=colorFamilies[family]||colorFamilies.rose,tones=palettes[family]||palettes.rose,k=Math.floor(hash(n,53,seed)*tones.length),stops=cfg.colorMode==='solid'?[tones[k],tones[k],tones[k]]:cfg.colorMode==='varied'?[tones[k],tones[(k+1)%tones.length],tones[(k+2)%tones.length]]:colors;Object.assign(item.style,{size:100,c1:stops[0],c2:stops[1],c3:stops[2],blur:cfg.Blur,grain:cfg.Grain,opacity:cfg.Opacity,seed:seed+n});item.name='Colonia tipográfica';items.push(item);g.memberIds.push(item.id);n++}g.count=n;pieceBaseline=null;select(g.memberIds[0]);status('Palabra creada con '+n+' colonias editables.')}
$('createColonyText').onclick=()=>buildColonyText(false);
for(const id of ['colonyWord','ctColor','ctModule','ctColorMode',...ctKeys.map(k=>'ct'+k)])$(id).addEventListener('input',()=>{for(const k of ctKeys)$('ct'+k+'Value').value=$('ct'+k).value+(k==='Blur'?' px':'%');if(groupFor(active())?.colonyText)buildColonyText(true)});

$('addText').onclick=()=>{let i=textItem('Nuevo texto',.5,.5);containItem(i);items.push(i);select(i.id)};
$('textContent').oninput=()=>{if(active()?.type==='text'){active().text=$('textContent').value;list();schedule()}};
 for(const id of ['containerColor','textColor'])for(const [name,hex] of palette){const o=document.createElement('option');o.value=hex;o.textContent=name;$(id).append(o)}
 $('fontFamily').onchange=async()=>{if(active()?.type==='text'){active().fontFamily=$('fontFamily').value;if(active().fontFamily==='Sentient'){status('Cargando Sentient…');try{await document.fonts.load(`normal ${active().fontSize}px Sentient`)}catch{status('Sentient no está disponible; se usará la fuente de respaldo.')}}schedule()}};
for(const id of ['containerColor','textColor','containerPadding','containerRadius','containerBlur'])$(id).oninput=()=>{if(active()?.type==='text'){active()[id]=id.includes('Color')?$(id).value:+$(id).value;if($(id+'Value'))$(id+'Value').value=$(id).value+(id==='containerBlur'?' px':'%');schedule()}};
$('textContainer').onchange=()=>{if(active()?.type==='text'){active().container=$('textContainer').checked;select(active().id)}};
 $('textOpacity').oninput=()=>{if(active()?.type==='text'){const i=active(),value=+$('textOpacity').value;if(i.container)i.containerOpacity=value;else i.opacity=value;$('textOpacityValue').value=value+'%';schedule()}};
$('textBlur').oninput=()=>{if(active()?.type==='text'){active().blur=clamp(+$('textBlur').value,0,4);$('textBlurValue').value=active().blur+' px';schedule()}};
$('structureScale').oninput=editStructure;$('structureAir').oninput=editStructure;
$('fontSize').oninput=()=>{if(active()?.type==='text'){active().fontSize=+$('fontSize').value;$('fontValue').value=active().fontSize+' px';schedule()}};
$('duplicate').onclick=()=>{if(!active())return;const copy=JSON.parse(JSON.stringify(active()));copy.id=++idCounter;delete copy.groupId;copy.x+=.035;copy.y+=.025;items.push(copy);select(copy.id)};
$('delete').onclick=()=>{const gone=new Set(boxSelectionIds.length?boxSelectionIds:[selected]);items=items.filter(i=>!gone.has(i.id));for(const g of groups){if(g.type==='manual')g.memberIds=g.memberIds.filter(id=>!gone.has(id));if(g.anchorId&&gone.has(g.anchorId))g.anchorId=null}groups=groups.filter(g=>g.type==='manual'?g.memberIds.length>1:items.some(i=>i.groupId===g.id)||g.anchorId);pieceBaseline=null;select(null);status(gone.size+' elementos eliminados.')};
function reorder(delta){let k=items.findIndex(i=>i.id===selected),j=clamp(k+delta,0,items.length-1);if(k<0)return;[items[k],items[j]]=[items[j],items[k]];list();schedule()}
$('front').onclick=()=>reorder(1);$('back').onclick=()=>reorder(-1);
let drag=null,marquee=null;function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
function hitsAt(p){return [...items].reverse().filter(item=>{const b=bounds(item,canvas.width,canvas.height),x=p.x*canvas.width-b.x,y=p.y*canvas.height-b.y;if(item.type==='text'){const pad=Math.max(6,(item.blur??0)*canvas.width/760*3);return x>=-pad&&y>=-pad&&x<=b.w+pad&&y<=b.h+pad}if(item.style.opacity<=0)return false;const res=Math.max(64,Math.ceil(b.w)),image=sprite(item,res),pad=image.texturePadding||0,px=Math.floor(x/b.w*res)+pad,py=Math.floor(y/b.h*res)+pad;if(px<0||py<0||px>=res+pad*2||py>=res+pad*2)return false;const alpha=image.getContext('2d').getImageData(px,py,1,1).data[3];return alpha*item.style.opacity/100>=6})}
const marqueeEl=$('selectionMarquee');
function paintMarquee(p){const x=Math.min(p.x,marquee.x)*canvas.clientWidth,y=Math.min(p.y,marquee.y)*canvas.clientHeight,w=Math.abs(p.x-marquee.x)*canvas.clientWidth,h=Math.abs(p.y-marquee.y)*canvas.clientHeight;Object.assign(marqueeEl.style,{display:'block',left:x+'px',top:y+'px',width:w+'px',height:h+'px'})}
function finishMarquee(p){marqueeEl.style.display='none';const l=Math.min(p.x,marquee.x),r=Math.max(p.x,marquee.x),t=Math.min(p.y,marquee.y)*ratio(),b=Math.max(p.y,marquee.y)*ratio();const ids=items.filter(i=>{const q=bounds(i,1,ratio());return q.x+q.w>=l&&q.x<=r&&q.y+q.h>=t&&q.y<=b}).map(i=>i.id);marquee=null;boxSelectionIds=ids;select(ids[0]??null,true);for(const o of $('layers').options)o.selected=ids.includes(+o.value);status(ids.length?ids.length+' elementos seleccionados.':'No hay elementos dentro del marco.')}
canvas.addEventListener('pointerdown',e=>{if(mode!=='piece')return;const p=point(e),hits=hitsAt(p);let hit=hits.find(i=>i.type==='text')??hits[0];if(e.altKey&&hits.length){const index=hits.findIndex(i=>i.id===selected);hit=hits[(index+1)%hits.length]}if(!hit){drag=null;marquee={x:p.x,y:p.y};select(null);canvas.setPointerCapture(e.pointerId);return}const multi=boxSelectionIds.length>1&&boxSelectionIds.includes(hit.id);select(hit.id,multi);status(multi?boxSelectionIds.length+' elementos seleccionados. Arrastrá para moverlos.':(hit.type==='text'?'Texto':hit.name)+' seleccionado. Arrastralo para moverlo.');drag={x:p.x-hit.x,y:p.y-hit.y,multi};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const p=point(e);if(marquee){paintMarquee(p);return}if(!drag||!active())return;pieceBaseline=null;const x=p.x-drag.x,y=p.y-drag.y,item=active(),g=groupFor(item);if(drag.multi){const dx=x-item.x,dy=y-item.y,chosen=new Set(boxSelectionIds);for(const member of items)if(chosen.has(member.id)){member.x+=dx;member.y+=dy}for(const group of groups){const members=groupMembers(group);if(members.length&&members.every(m=>chosen.has(m.id))){group.cx+=dx;group.cy+=dy}}}else if(g&&$('moveGroup').checked){const dx=x-item.x,dy=y-item.y;g.cx+=dx;g.cy+=dy;for(const member of groupMembers(g)){member.x+=dx;member.y+=dy}}else{item.x=x;item.y=y}schedule()});canvas.addEventListener('pointerup',e=>{if(marquee)finishMarquee(point(e));drag=null});canvas.addEventListener('pointercancel',()=>{marquee=null;marqueeEl.style.display='none';drag=null});
$('random').onclick=()=>{if(mode==='piece'){if(active()?.type==='shape')active().style.seed=Math.floor(Math.random()*100000);schedule()}else{state.seed=Math.floor(Math.random()*100000);schedule()}};
$('reset').onclick=()=>{if(mode==='piece'){if(active()?.type==='shape'){active().style={...base,...presets[current],...paper,blur:Math.max(10,presets[current]?.blur??base.blur)};select(selected)}}else choose(current)};
$('export').onclick=()=>{status('Preparando PNG…');setTimeout(()=>{try{const n=+$('resolution').value,c=document.createElement('canvas');mode==='piece'?paintScene(c,n):singleRender(c,n);c.toBlob(blob=>{if(!blob){status('No se pudo generar el PNG.');return}download(blob,`colonias-${mode}-${Date.now()}.png`);status(`PNG ${c.width} × ${c.height} descargado.`)},'image/png')}catch(e){status('Error al exportar: '+e.message)}},50)};
$('save').onclick=()=>download(new Blob([JSON.stringify({version:2,mode,state,current,paper,format,customRatio,density,sceneSeed,bandAngle,bandPosition,structureScale,structureAir,compositionLogic,colorWeights,selected,groups,items},null,2)],{type:'application/json'}),'colonias-composicion.json');
function checkedStyle(input){if(!input||typeof input!=='object')throw Error('Receta inválida');let s={...base};for(const k in base){const v=input[k];if(v===undefined)continue;if(typeof v!==typeof base[k]||typeof v==='number'&&!Number.isFinite(v))throw Error('Valor inválido: '+k);s[k]=v}for(const [,k,,min,max]of ranges)s[k]=clamp(s[k],min,max);for(const k of ['c1','c2','c3'])if(!allowed.has(s[k]))throw Error('La receta usa colores fuera de la paleta.');if(!['#fffbee','#202c2e'].includes(s.background))s.background='#fffbee';if(!['disk','capsule','pair','ring','arc','fragment','band','smoothcol','wrinkled','zoned','cotton','hairy','rimmed','spotted','branching','granular','fan','patchy'].includes(s.shape)||!['radial','linear','rings'].includes(s.gradient)||!['source-over','multiply','screen'].includes(s.blend))throw Error('Receta inválida');return s;}
$('file').onchange=async()=>{try{const r=JSON.parse(await $('file').files[0].text());const s=checkedStyle(r.state);if(r.version===1){mode='single';state=s;setMode('single');state=s;sync();schedule();return}if(r.version!==2||!Array.isArray(r.items)||r.items.length>500)throw Error('Receta no reconocida');const idMap=new Map();const clean=r.items.map(i=>{if(!i||!['shape','text'].includes(i.type)||![i.x,i.y].every(Number.isFinite)||(i.type==='shape'&&(!Number.isFinite(i.w)||i.w<.001||i.w>2)))throw Error('Elemento inválido');let item={...i,id:++idCounter};idMap.set(i.id,item.id);if(i.type==='shape')item.style=checkedStyle(i.style);else{delete item.w;item.text=String(i.text).slice(0,100);item.fontFamily=fontFamilies.includes(i.fontFamily)?i.fontFamily:'Clamofte';item.containerColor=allowed.has(i.containerColor)?i.containerColor:'#202c2e';item.textColor=allowed.has(i.textColor)?i.textColor:'#fffbee';item.containerPadding=clamp(Number.isFinite(i.containerPadding)?i.containerPadding:45,0,200);item.containerRadius=clamp(Number.isFinite(i.containerRadius)?i.containerRadius:100,0,100);item.containerBlur=clamp(Number(i.containerBlur)||0,0,20);item.blur=clamp(Number(i.blur)||0,0,4);item.fontSize=clamp(Number(i.fontSize)||28,10,56);item.container=typeof i.container==='boolean'?i.container:true;item.containerOpacity=clamp(Number.isFinite(i.containerOpacity)?i.containerOpacity:(Number.isFinite(i.opacity)?i.opacity:88),20,100);item.opacity=typeof i.container==='boolean'?clamp(Number.isFinite(i.opacity)?i.opacity:100,0,100):100}return item});items=clean;pieceBaseline=null;compositionLogic=['band','nuclei','constellation','radial','field','grid','petri'].includes(r.compositionLogic)?r.compositionLogic:'field';$('compositionLogic').value=compositionLogic;colorWeights={green:clamp(Number(r.colorWeights?.green??33),0,100),yellow:clamp(Number(r.colorWeights?.yellow??33),0,100),rose:clamp(Number(r.colorWeights?.rose??34),0,100)};syncColorMixInputs();groups=Array.isArray(r.groups)?r.groups.filter(g=>g&&['axis','radial','manual'].includes(g.type)&&Number.isFinite(g.cx)&&Number.isFinite(g.cy)&&(g.type==='manual'?Array.isArray(g.memberIds)&&g.memberIds.length>1:[g.count,g.spacing,g.scatter,g.angle].every(Number.isFinite))).map(g=>({...g,count:clamp(Math.round(Number.isFinite(g.count)?g.count:3),3,24),spacing:clamp(Number.isFinite(g.spacing)?g.spacing:0,0,18),scatter:clamp(Number.isFinite(g.scatter)?g.scatter:0,0,100),angle:clamp(Number.isFinite(g.angle)?g.angle:0,-180,180),breaks:clamp(Number.isFinite(g.breaks)?g.breaks:50,0,100),sweep:clamp(Number.isFinite(g.sweep)?g.sweep:245,30,360),memberSize:clamp(Number.isFinite(g.memberSize)?g.memberSize:.025,.002,.1),seed:Number.isFinite(g.seed)?g.seed:g.id,anchorId:idMap.get(g.anchorId)??null,memberIds:g.type==='manual'?g.memberIds.map(id=>idMap.get(id)).filter(Boolean):undefined})):[];groupCounter=Math.max(0,...groups.map(g=>Number(g.id)||0));paper={background:['#fffbee','#202c2e'].includes(r.paper?.background)?r.paper.background:'#fffbee',transparent:!!r.paper?.transparent};customRatio=Number.isFinite(r.customRatio)?clamp(r.customRatio,1/3,3):1;format=['portrait','square','landscape','custom'].includes(r.format)?r.format:'portrait';manualViewWidth=null;bandAngle=Number.isFinite(r.bandAngle)?clamp(r.bandAngle,-90,90):0;bandPosition=Number.isFinite(r.bandPosition)?clamp(r.bandPosition,-40,40):0;structureScale=clamp(Number(r.structureScale)||100,50,150);structureAir=clamp(Number(r.structureAir)||100,40,180);for(const [id,value]of [['structureScale',structureScale],['structureAir',structureAir]]){$(id).value=value;$(id+'Value').value=value+'%'}syncBand();$('format').value=format;density=clamp(Number(r.density)||55,15,100);$('density').value=density;$('densityValue').value=density;current=r.current in presets?r.current:'halo';state=s;selected=idMap.get(r.selected)??items.at(-1)?.id??null;sceneSeed=Number.isFinite(r.sceneSeed)?r.sceneSeed:sceneSeed;cache.clear();setMode(r.mode==='piece'?'piece':'single');if(mode==='single'){state=s;sync();schedule()}status('Composición restaurada.')}catch(e){status(e.message)}$('file').value=''};
function syncBand(){$('bandAngle').value=bandAngle;$('bandAngleValue').value=bandAngle+'°';$('bandPosition').value=bandPosition;$('bandPositionValue').value=bandPosition+'%'}
function placeBand(angle,position){const r=ratio(),a=bandAngle*Math.PI/180,b=angle*Math.PI/180,d=b-a;const oldOffset=bandPosition/100,newOffset=position/100;for(const item of items){const x=item.x-.5+Math.sin(a)*oldOffset,y=(item.y-.5)*r-Math.cos(a)*oldOffset;item.x=.5+x*Math.cos(d)-y*Math.sin(d)-Math.sin(b)*newOffset;item.y=.5+(x*Math.sin(d)+y*Math.cos(d)+Math.cos(b)*newOffset)/r;if(item.type==='shape')item.style.rotation=((item.style.rotation+angle-bandAngle+540)%360)-180;}for(const g of groups){const x=g.cx-.5+Math.sin(a)*oldOffset,y=(g.cy-.5)*r-Math.cos(a)*oldOffset;g.cx=.5+x*Math.cos(d)-y*Math.sin(d)-Math.sin(b)*newOffset;g.cy=.5+(x*Math.sin(d)+y*Math.cos(d)+Math.cos(b)*newOffset)/r;g.angle=((g.angle+angle-bandAngle+540)%360)-180;}bandAngle=angle;bandPosition=position;syncBand();fitWholeScene();schedule()}
$('bandAngle').oninput=editStructure;
$('bandPosition').oninput=editStructure;
for(const key of ['groupCount','groupSpacing','groupScatter','groupAngle','groupBreaks','groupSweep'])$(key).oninput=editGroup;
$('addAxis').onclick=()=>{const i=active(),g=addGroup('axis',i?.x??.5,i?.y??.5);select(items.find(i=>i.groupId===g.id).id)};
$('addRadial').onclick=()=>{const i=active(),g=addGroup('radial',i?.x??.5,i?.y??.5);select(g.anchorId)};
$('ungroup').onclick=()=>{const g=groupFor(active());if(!g)return;if(g.type!=='manual')for(const i of items)if(i.groupId===g.id)delete i.groupId;groups=groups.filter(v=>v!==g);select(selected);schedule()};
$('format').value=format;$('compositionLogic').value=compositionLogic;syncBand();sync();setMode('piece');

