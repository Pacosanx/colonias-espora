'use strict';
// Color → blur → núcleo definido → textura de color y transparencia.
function noiseField(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return (hash(ix,iy,seed)*(1-u)+hash(ix+1,iy,seed)*u)*(1-v)+(hash(ix,iy+1,seed)*(1-u)+hash(ix+1,iy+1,seed)*u)*v}
function render(target,n,padding=0){
 const full=n+padding*2,out=target.getContext('2d');target.width=target.height=full;
 out.clearRect(0,0,full,full);if(!state.transparent){out.fillStyle=state.background;out.fillRect(0,0,full,full)}
 const colors=[rgb(state.c1),rgb(state.c2),rgb(state.c3)],rot=state.rotation*Math.PI/180,ang=state.angle*Math.PI/180,scale=n/760;
 function element(cx,cy,r,aspect=1,phase=0,palette=colors){
  cx+=padding;cy+=padding;const layer=document.createElement('canvas');layer.width=layer.height=full;
  const lc=layer.getContext('2d'),im=lc.createImageData(full,full),data=im.data;
  const bound=r*Math.max(1,aspect)+n*(state.halo/100*.5+state.blur/760*3)+4;
  const x0=Math.max(0,Math.floor(cx-bound)),x1=Math.min(full,Math.ceil(cx+bound)),y0=Math.max(0,Math.floor(cy-bound)),y1=Math.min(full,Math.ceil(cy+bound));
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const dx=(x-cx)/r,dy=(y-cy)/r,xx=dx*Math.cos(rot)+dy*Math.sin(rot),yy=-dx*Math.sin(rot)+dy*Math.cos(rot),theta=Math.atan2(yy,xx);
   let d=aspect>1?Math.hypot(Math.max(Math.abs(xx)-(aspect-1),0),yy):Math.hypot(xx,yy);
   const irregular=(Math.sin(theta*7+phase+state.seed)+.46*Math.sin(theta*13+phase)+.23*Math.sin(theta*29))*state.irregularity/100*.10;
   d/=1+irregular;
   let alpha=1-smooth((d-.985)/.03);
   if(d>1)alpha+=state.halo/100*.25*Math.exp(-(d-1)*16/(.2+state.halo/100));
   if(state.shape==='ring'||state.shape==='arc')alpha*=smooth((d-(1-state.ringWidth/100))/.014);
   if(state.shape==='arc'||state.shape==='fragment'){
    const angle=((theta*180/Math.PI+360)%360),end=state.arc;
    alpha*=end>=360?1:1-smooth((angle-end+1.5)/3);
   }
   // Rayos que atraviesan el cuerpo, con distintas longitudes y una envolvente suave.
   if(state.filaments>0&&d<1.12){const rays=Math.pow(.5+.5*Math.sin(theta*103+Math.sin(theta*17)*2+d*7),12);const amount=state.filaments/100*smooth((d-.14)/.6);alpha*=1-amount+amount*(.10+.9*rays)}
   if(alpha<.001)continue;
   let t=state.gradient==='linear'?clamp((xx*Math.cos(ang)+yy*Math.sin(ang)+aspect)/(2*aspect)):clamp(Math.hypot(xx-state.offset/100,yy));
   if(state.gradient==='rings')t=clamp(.5+.5*Math.sin(t*9-1));
   const mid=state.midpoint/100,idx=t<mid?0:1,u=smooth(idx===0?t/mid:(t-mid)/(1-mid)),i=(y*full+x)*4;
   for(let k=0;k<3;k++)data[i+k]=palette[idx][k]*(1-u)+palette[idx+1][k]*u;
   data[i+3]=clamp(alpha)*255;
  }
  lc.putImageData(im,0,0);let finished=layer;
  if(state.blur){finished=document.createElement('canvas');finished.width=finished.height=full;const bc=finished.getContext('2d');bc.filter=`blur(${state.blur*scale}px)`;bc.drawImage(layer,0,0);bc.filter='none'}
  if(state.grain||state.porosity||state.blur&&state.core){
   const fc=finished.getContext('2d'),pixels=fc.getImageData(0,0,full,full),rgba=pixels.data;
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*full+x)*4;
    if(state.blur&&state.core){const radius=Math.hypot(x-cx,y-cy)/r,src=data[i+3]/255*state.core/100*(1-smooth((radius-.1)/.36)),dst=rgba[i+3]/255,alpha=src+dst*(1-src);if(alpha>0){for(let k=0;k<3;k++)rgba[i+k]=(data[i+k]*src+rgba[i+k]*dst*(1-src))/alpha;rgba[i+3]=alpha*255}}
    if(!rgba[i+3])continue;
    const gx=Math.floor((x-padding)/Math.max(.5,state.grainSize*scale)),gy=Math.floor((y-padding)/Math.max(.5,state.grainSize*scale));
    const fine=hash(gx,gy,state.seed),grain=(fine-.5)*state.grain/100*175;
    for(let k=0;k<3;k++)rgba[i+k]=clamp(rgba[i+k]+grain,0,255);
    if(state.porosity){const cell=Math.max(2,scale*22),patch=noiseField((x-padding)/cell,(y-padding)/cell,state.seed+91);const coverage=clamp((fine-.25)*1.8)*(.25+patch*.9),p=state.porosity/100;rgba[i+3]*=(1-p)+p*coverage}
   }
   fc.putImageData(pixels,0,0);
  }
  out.save();out.globalAlpha=state.opacity/100;out.globalCompositeOperation=state.blend;out.drawImage(finished,0,0);out.restore();
 }
 const r=n*state.size/200;
 if(state.shape==='pair'){const sep=r*state.separation/100*1.8;element(n/2-sep/2,n/2,r*.7);element(n/2+sep/2,n/2,r*.7,1,2,[colors[2],colors[2],colors[0]])}
 else if(state.shape==='band'){for(let i=0;i<19;i++)element(n*(.04+i*.051),n*(.5+(hash(i,12,state.seed)-.5)*.10),r*(.08+hash(i,7,state.seed)*.24),i%5===0?1.7:1,i,[colors[i%3],colors[(i+1)%3],colors[(i+2)%3]])}
 else element(n/2,n/2,state.shape==='capsule'?r*.53:r,state.shape==='capsule'?1+state.elongation/50:1);
}

