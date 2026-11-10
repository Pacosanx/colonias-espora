'use strict';
// Color → blur → núcleo definido → textura de color y transparencia.
function noiseField(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return (hash(ix,iy,seed)*(1-u)+hash(ix+1,iy,seed)*u)*(1-v)+(hash(ix,iy+1,seed)*(1-u)+hash(ix+1,iy+1,seed)*u)*v}
function render(target,n,padding=0){
 const full=n+padding*2,out=target.getContext('2d');target.width=target.height=full;
 out.clearRect(0,0,full,full);if(!state.transparent){out.fillStyle=state.background;out.fillRect(0,0,full,full)}
 const colors=[rgb(state.c1),rgb(state.c2),rgb(state.c3)],rot=state.rotation*Math.PI/180,ang=state.angle*Math.PI/180,scale=n/760;
 function element(cx,cy,r,aspect=1,phase=0,palette=colors){
  cx+=padding;cy+=padding;const layer=document.createElement('canvas');layer.width=layer.height=full;
  const focusCount=Math.max(1,Math.min(6,Math.round(state.focusCount??1))),focusSpread=(state.focusSpread??45)/100,focusX=(state.focusX??0)/100,focusY=(state.focusY??0)/100,focusSize=(state.focusSize??24)/100;
  const foci=Array.from({length:focusCount},(_,k)=>{const a=k*2.399963+state.seed*.013,dist=k===0?0:focusSpread*(.7+.3*hash(k,73,state.seed));return{x:focusX+Math.cos(a)*dist,y:focusY+Math.sin(a)*dist}});
  const lc=layer.getContext('2d'),im=lc.createImageData(full,full),data=im.data;
  const bound=r*Math.max(['cotton','hairy','branching','fan'].includes(state.shape)?1.7:1,aspect)+n*(state.halo/100*.5+Math.max(state.blur,state.edgeBlur??0)/760*3)+4;
  const x0=Math.max(0,Math.floor(cx-bound)),x1=Math.min(full,Math.ceil(cx+bound)),y0=Math.max(0,Math.floor(cy-bound)),y1=Math.min(full,Math.ceil(cy+bound));
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const dx=(x-cx)/r,dy=(y-cy)/r,xx=dx*Math.cos(rot)+dy*Math.sin(rot),yy=-dx*Math.sin(rot)+dy*Math.cos(rot),theta=Math.atan2(yy,xx);
   let d=aspect>1?Math.hypot(Math.max(Math.abs(xx)-(aspect-1),0),yy):Math.hypot(xx,yy);
   const baseIrregular=(Math.sin(theta*7+phase+state.seed)+.46*Math.sin(theta*13+phase)+.23*Math.sin(theta*29))*state.irregularity/100*.10;
   const lobeIrregular=state.studyLobes ? state.studyDepth/100*.22*(Math.cos(theta*state.studyLobes)+state.studyUneven/100*(.65*Math.sin(theta*(state.studyLobes-1)+state.seed)+.35*Math.sin(theta*(state.studyLobes+2)+state.seed*.7))) : 0;
   const figurative=['smoothcol','wrinkled','zoned','cotton','hairy','rimmed','spotted','branching','granular','fan','patchy'].includes(state.shape);
   const irregular=state.studyLobes ? lobeIrregular+(figurative?baseIrregular:0) : baseIrregular;
   d/=1+irregular;
   if(state.shape==='fan'){const forward=Math.pow(Math.max(0,Math.cos(theta)),2),strength=(state.detail??70)/100;d/=1+forward*strength*.65;}
   const edgeWidth=.03+(state.edgeSoft??0)/100*.25;
   let alpha=1-smooth((d-(.985-(state.edgeSoft??0)/100*.125))/edgeWidth);
   if(d>1)alpha+=state.halo/100*.25*Math.exp(-(d-1)*16/(.2+state.halo/100));
   const detail=(state.detail??55)/100,zones=state.zones??4;
   if(state.shape==='cotton'||state.shape==='hairy'){
    const patch=noiseField(x/(18*scale+1),y/(18*scale+1),state.seed+191);
    const fil=Math.pow(.5+.5*Math.sin(theta*97+Math.sin(theta*13)*2+d*8),12);
    const soft=(state.edgeSoft??0)/100;alpha=Math.exp(-d*d*(state.shape==='hairy'?1.15:1.75))*(1-smooth((d-(1.04-soft*.1))/(.24+soft*.3)))*(.4+.45*patch+detail*.28*fil);
   }
   if(state.shape==='branching'){
    const soft=(state.edgeSoft??0)/100;alpha=.24*Math.exp(-d*d*3.6)*(1-smooth((d-(1.08-soft*.1))/(.2+soft*.3)));
   }
   if(state.shape==='ring'||state.shape==='arc')alpha*=smooth((d-(1-state.ringWidth/100))/.014);
   if(state.shape==='arc'||state.shape==='fragment'){
    const angle=((theta*180/Math.PI+360)%360),end=state.arc;
    alpha*=end>=360?1:1-smooth((angle-end+1.5)/3);
   }
   // Rayos que atraviesan el cuerpo, con distintas longitudes y una envolvente suave.
   if(state.filaments>0&&d<1.12&&!['cotton','hairy','branching'].includes(state.shape)){const rays=Math.pow(.5+.5*Math.sin(theta*103+Math.sin(theta*17)*2+d*7),12);const amount=state.filaments/100*smooth((d-.14)/.6);alpha*=1-amount+amount*(.10+.9*rays)}
   if(alpha<.001)continue;
   let t=state.gradient==='linear'?clamp((xx*Math.cos(ang)+yy*Math.sin(ang)+aspect)/(2*aspect)):clamp(Math.hypot(xx-state.offset/100,yy));
   if(state.shape==='cotton'&&(focusCount>1||focusX||focusY)){let nearest=Infinity;for(const focus of foci)nearest=Math.min(nearest,Math.hypot(xx-focus.x,yy-focus.y));t=clamp(nearest/Math.max(.05,focusSize)*.55)}
   if(state.gradient==='rings')t=clamp(.5+.5*Math.sin(t*9-1));
   const featureX=(state.featureX??0)/100,featureY=(state.featureY??0)/100,featureScale=(state.featureSize??100)/100,featureD=featureX||featureY?Math.hypot(xx-featureX,yy-featureY):d;
   if(state.shape==='zoned'){const wave=featureD/featureScale+.025*Math.sin(theta*5+state.seed)+.025*Math.sin(theta*9+d*4),rings=.5+.5*Math.cos(wave*zones*Math.PI*2);t=clamp(d*(1-detail)+rings*detail)}
   if(state.shape==='rimmed'){const rim=Math.exp(-Math.pow((featureD-.76*featureScale+.035*Math.sin(theta*6+state.seed))/.075,2));t=clamp(d*.55+rim*.45*detail)}
   if(state.shape==='spotted')t=clamp(d*state.midpoint/100*.95);
   if(state.shape==='patchy'){const patch=noiseField(xx*3.4+state.seed*.01,yy*3.4,state.seed+131);t=clamp(.12+patch*.85+(xx*.24+yy*.12)*(state.detail??75)/100);}
   const mid=state.midpoint/100,idx=t<mid?0:1,u=smooth(idx===0?t/mid:(t-mid)/(1-mid)),i=(y*full+x)*4;
   let relief=0;
   if(state.shape==='wrinkled'){
    const w1=xx*18+Math.sin(yy*5+state.seed)*1.6,w2=yy*18+Math.sin(xx*6-state.seed)*1.4;
    const mix=.5+.5*Math.sin(xx*3+yy*4+state.seed),foldWidth=(state.foldWidth??100)/100,lines=Math.exp(-Math.pow(Math.sin(w1)*4/foldWidth,2))*mix+Math.exp(-Math.pow(Math.sin(w2)*4/foldWidth,2))*(1-mix);
    const broken=1-(state.foldBreak??0)/100*smooth((noiseField(xx*3.8+state.seed*.01,yy*3.8,state.seed+955)-.3)/.4);
    relief=(lines-.22)*detail*58*broken*(1-smooth((d-.55)/.4));
   }
   if(state.shape==='granular'){const coarse=noiseField(x/(8*scale+1),y/(8*scale+1),state.seed+392),fine=hash(Math.floor(x/Math.max(1,scale*2)),Math.floor(y/Math.max(1,scale*2)),state.seed+42);relief=(coarse-.5)*detail*45+(fine-.5)*detail*85}
   if(state.shape==='smoothcol')relief=Math.exp(-Math.hypot(xx+.23,yy+.22)*4)*detail*40;
   let spots=0;
   if(state.shape==='spotted'&&d<.93){const grid=3+zones,px=(xx-featureX+1)*grid,py=(yy-featureY+1)*grid,ix=Math.floor(px),iy=Math.floor(py);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const gx=ix+ox,gy=iy+oy;if(hash(gx,gy,state.seed+510)<.48)continue;const sx=gx+.15+hash(gx,gy,state.seed+511)*.7,sy=gy+.15+hash(gx,gy,state.seed+512)*.7,rad=(.13+hash(gx,gy,state.seed+513)*.22)*featureScale;spots=Math.max(spots,1-smooth((Math.hypot(px-sx,py-sy)-rad)/.18))}}
   const cottonTint=state.shape==='cotton'?smooth((d-.2)/.45)*detail*(.08+.26*noiseField(x/(35*scale+1),y/(35*scale+1),state.seed+271)):0;
   for(let k=0;k<3;k++){const value=palette[idx][k]*(1-u)+palette[idx+1][k]*u+relief,mixed=value*(1-spots*detail)+palette[2][k]*spots*detail;data[i+k]=clamp(mixed*(1-cottonTint)+palette[0][k]*cottonTint,0,255)}
   data[i+3]=clamp(alpha)*255;
  }
  lc.putImageData(im,0,0);let finished=layer;
  if(state.blur){finished=document.createElement('canvas');finished.width=finished.height=full;const bc=finished.getContext('2d');bc.filter=`blur(${state.blur*scale}px)`;bc.drawImage(layer,0,0);bc.filter='none'}
  let coreData=data,edgeData=null;
  if(state.blur&&state.core&&(state.coreBlur??0)>0){const c=document.createElement('canvas');c.width=c.height=full;const cc=c.getContext('2d');cc.filter=`blur(${state.coreBlur*scale}px)`;cc.drawImage(layer,0,0);cc.filter='none';coreData=cc.getImageData(0,0,full,full).data}
  if((state.edgeBlur??0)>0){const c=document.createElement('canvas');c.width=c.height=full;const cc=c.getContext('2d');cc.filter=`blur(${state.edgeBlur*scale}px)`;cc.drawImage(layer,0,0);cc.filter='none';edgeData=cc.getImageData(0,0,full,full).data}
  if(state.grain||state.porosity||state.blur&&state.core||edgeData||['cotton','hairy','branching','rimmed'].includes(state.shape)){
   const fc=finished.getContext('2d'),pixels=fc.getImageData(0,0,full,full),rgba=pixels.data;
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*full+x)*4;
    if(edgeData){const edge=smooth((Math.hypot(x-cx,y-cy)/r-.5)/.5),a=rgba[i+3]/255,b=edgeData[i+3]/255,alpha=a*(1-edge)+b*edge;if(alpha>0){for(let k=0;k<3;k++)rgba[i+k]=(rgba[i+k]*a*(1-edge)+edgeData[i+k]*b*edge)/alpha;rgba[i+3]=alpha*255}else rgba[i+3]=0}
    if(state.blur&&state.core){const radius=Math.hypot((x-cx)/r-focusX,(y-cy)/r-focusY),src=coreData[i+3]/255*state.core/100*(1-smooth((radius-.1)/Math.max(.05,(state.coreRadius??36)/100))),dst=rgba[i+3]/255,alpha=src+dst*(1-src);if(alpha>0){for(let k=0;k<3;k++)rgba[i+k]=(coreData[i+k]*src+rgba[i+k]*dst*(1-src))/alpha;rgba[i+3]=alpha*255}}
    if(!rgba[i+3])continue;
    // El relieve fino se dibuja después del blur para no perder la estructura.
    if(state.shape==='wrinkled'){
     const xx=(x-cx)/r,yy=(y-cy)/r,dd=Math.hypot(xx,yy),mask=1-smooth((dd-.64)/.31);
     const a=xx*12+Math.sin(yy*4.5+state.seed)*1.8,b=yy*11+Math.sin(xx*5-state.seed)*1.4;
     const mix=.5+.5*Math.sin(xx*2.7+yy*3.5+state.seed),broken=1-(state.foldBreak??0)/100*smooth((noiseField(xx*3.8+state.seed*.01,yy*3.8,state.seed+955)-.3)/.4),fw=(state.foldWidth??100)/100,wrinkle=(Math.exp(-Math.pow(Math.sin(a)*3.8/fw,2))*mix+Math.exp(-Math.pow(Math.sin(b)*3.8/fw,2))*(1-mix)-.18)*(state.detail??55)/100*65*mask*broken;
     for(let k=0;k<3;k++)rgba[i+k]=clamp(rgba[i+k]+wrinkle*(k===2?.7:1),0,255);
    }
    if(state.shape==='granular'){
     const micro=hash(Math.floor(x/Math.max(1,scale*2)),Math.floor(y/Math.max(1,scale*2)),state.seed+402);
     const amount=(micro-.5)*(state.detail??55)/100*64;for(let k=0;k<3;k++)rgba[i+k]=clamp(rgba[i+k]+amount,0,255);
    }
    if(state.shape==='cotton'){
     const dx=(x-cx)/r,dy=(y-cy)/r,dd=Math.hypot(dx,dy),patch=noiseField(dx*5.5+state.seed*.01,dy*5.5,state.seed+721),strength=(state.detail??55)/100;
     const tint=smooth((dd-.18)/.4)*(1-smooth((dd-1)/.27))*strength*(.12+patch*.4);
     for(let k=0;k<3;k++)rgba[i+k]=clamp(rgba[i+k]*(1-tint)+colors[0][k]*tint,0,255);
     if(focusCount>1){const xx=dx*Math.cos(rot)+dy*Math.sin(rot),yy=-dx*Math.sin(rot)+dy*Math.cos(rot);let spot=0;for(const focus of foci){const dist=Math.hypot(xx-focus.x,yy-focus.y)/Math.max(.05,focusSize);spot=Math.max(spot,Math.exp(-dist*dist*1.6))}spot*=.8;for(let k=0;k<3;k++)rgba[i+k]=rgba[i+k]*(1-spot)+colors[0][k]*spot}
     rgba[i+3]*=.78+patch*.22;
    }
    if(state.shape==='rimmed'){
     const xx=(x-cx)/r-(state.featureX??0)/100,yy=(y-cy)/r-(state.featureY??0)/100,theta=Math.atan2(yy,xx),dd=Math.hypot(xx,yy),rim=Math.exp(-Math.pow((dd-.76*(state.featureSize??100)/100+.035*Math.sin(theta*6+state.seed))/.075,2))*(state.detail??55)/100*.72;
     for(let k=0;k<3;k++)rgba[i+k]=clamp(rgba[i+k]*(1-rim)+colors[2][k]*rim,0,255);
    }
    const gx=Math.floor((x-padding)/Math.max(.5,state.grainSize*scale)),gy=Math.floor((y-padding)/Math.max(.5,state.grainSize*scale));
    const radius=Math.min(1,Math.hypot(x-cx,y-cy)/r),distribution=clamp(1+(state.grainCenter??0)/100*(radius*2-1),0,2),fine=hash(gx,gy,state.seed),grain=(fine-.5)*state.grain/100*175*distribution;
    for(let k=0;k<3;k++)rgba[i+k]=clamp(rgba[i+k]+grain,0,255);
    if(state.porosity){const cell=Math.max(2,scale*22),patch=noiseField((x-padding)/cell,(y-padding)/cell,state.seed+91);const coverage=clamp((fine-.25)*1.8)*(.25+patch*.9),radius=Math.hypot(x-cx,y-cy)/r,distribution=state.studyDensity===undefined?1:clamp(1+(state.studyDensity/100)*(radius*2-1),0,2),p=clamp(state.porosity/100*distribution);rgba[i+3]*=(1-p)+p*coverage}
   }
   fc.putImageData(pixels,0,0);
   if(['cotton','hairy','branching'].includes(state.shape)){
    const strength=clamp((state.detail??55)/100*.55+(state.filaments??0)/100*.65,0,1);
    fc.save();fc.lineCap='round';fc.strokeStyle=state.c1;
    if(state.shape==='cotton'||state.shape==='hairy'){
     const hairy=state.shape==='hairy';
     for(let j=0;j<(hairy?1900:1500);j++){
      const a=hash(j,3,state.seed)*Math.PI*2+rot,dist=hairy?.50+hash(j,7,state.seed)*.53:Math.sqrt(hash(j,7,state.seed)),deform=1+(state.irregularity??0)/100*.15*(Math.sin((a-rot)*7+state.seed)+.4*Math.sin((a-rot)*13));
      const x=cx+Math.cos(a)*r*dist*deform,y=cy+Math.sin(a)*r*dist*deform;
      const dir=a+(hash(j,11,state.seed)-.5)*(hairy?.75:1.7),len=r*((hairy?.035:.015)+hash(j,13,state.seed)*(hairy?.19:.09)),bend=(hash(j,17,state.seed)-.5)*len;
      fc.globalAlpha=(.05+hash(j,19,state.seed)*(hairy?.26:.28))*strength*(1-Math.min(dist,1)*.4);fc.lineWidth=Math.max(.25,scale*(.18+hash(j,23,state.seed)*.6));
      fc.beginPath();fc.moveTo(x,y);fc.quadraticCurveTo(x+Math.cos(dir)*len*.5-Math.sin(dir)*bend,y+Math.sin(dir)*len*.5+Math.cos(dir)*bend,x+Math.cos(dir)*len,y+Math.sin(dir)*len);fc.stroke();
     }
    }else{
     const variation=.15+(state.irregularity??0)/100*.55,spread=(state.branchSpread??100)/100,extension=(state.branchLength??100)/100;
     function twig(x,y,a,len,depth,key){
      const bend=(hash(key,51,state.seed)-.5)*len*variation,ex=x+Math.cos(a)*len,ey=y+Math.sin(a)*len,mx=x+Math.cos(a)*len*.5-Math.sin(a)*bend,my=y+Math.sin(a)*len*.5+Math.cos(a)*bend;
      fc.globalAlpha=(.24+hash(key,53,state.seed)*.25)*strength;fc.lineWidth=Math.max(.25,scale*(.32+depth*.22));fc.beginPath();fc.moveTo(x,y);fc.quadraticCurveTo(mx,my,ex,ey);fc.stroke();
      if(depth<=0)return;const t=.52+hash(key,55,state.seed)*.15,bx=(1-t)*(1-t)*x+2*(1-t)*t*mx+t*t*ex,by=(1-t)*(1-t)*y+2*(1-t)*t*my+t*t*ey,turn=.23+hash(key,57,state.seed)*(.35+variation*.2);
      twig(bx,by,a-turn*spread,len*(.42+hash(key,59,state.seed)*.12),depth-1,key*2+1);twig(ex,ey,a+turn*.65*spread,len*(.43+hash(key,61,state.seed)*.10),depth-1,key*2+2);
     }
     for(let j=0;j<(state.branchDensity??7);j++){const a=Math.PI/2+rot+(hash(j,41,state.seed)-.5)*1.1*spread,len=r*(.28+hash(j,43,state.seed)*.14)*extension;twig(cx,cy,a,len,state.branchForks??4,j+1)}
    }
    fc.restore();
   }
  }
  out.save();out.globalAlpha=state.opacity/100;out.globalCompositeOperation=state.blend;out.drawImage(finished,0,0);out.restore();
 }
 const r=n*state.size/200;
 if(state.shape==='pair'){const sep=r*state.separation/100*1.8;element(n/2-sep/2,n/2,r*.7);element(n/2+sep/2,n/2,r*.7,1,2,[colors[2],colors[2],colors[0]])}
 else if(state.shape==='band'){for(let i=0;i<19;i++)element(n*(.04+i*.051),n*(.5+(hash(i,12,state.seed)-.5)*.10),r*(.08+hash(i,7,state.seed)*.24),i%5===0?1.7:1,i,[colors[i%3],colors[(i+1)%3],colors[(i+2)%3]])}
 else {const aspect=1+state.elongation/50,fit=padding?1:Math.max(1,state.size/100*.53*aspect);element(n/2,n/2,state.shape==='capsule'?r*.53/fit:r,state.shape==='capsule'?aspect:1);}
}

