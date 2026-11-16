/* WoodShop Designer: shed framing builder */
'use strict';
/* Shed: simplified stick framing (floor on skids, four stud walls, single-slope roof). Not engineered plans. */
function tile(P,name,mat,t,x0,z0,W,D,y){ // flat panels no bigger than 8 ft x 4 ft
  const nx=Math.ceil(W/96-1e-6),nz=Math.ceil(D/48-1e-6);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)P.push(mk(name,mat,[W/nx,t,D/nz],[x0+i*W/nx,y,z0+j*D/nz]));}
function shedWall(P,alongX,ox,oz,len,y,h,sp,ops,outer){
  // ops: openings in wall coordinates {u0,u1,bot,top}; bot = 0 is a door. outer = which face is outside (0 or 1)
  const put=(name,mat,u,ul,yy,yl,n0,nl)=>{const q=alongX?mk(name,mat,[ul,yl,nl],[ox+u,yy,oz+n0]):mk(name,mat,[nl,yl,ul],[ox+n0,yy,oz+u]);P.push(q);return q;};
  const acc=[];
  for(let o of ops){const w=Math.min(o.u1-o.u0,len-9),u0=Math.max(4.5,Math.min(o.u0,len-4.5-w));o={...o,u0,u1:u0+w,top:Math.min(o.top,h-8.5)};
    if(w>=6&&o.top-o.bot>=6&&acc.every(a=>o.u1+3<=a.u0||o.u0>=a.u1+3))acc.push(o);}
  ops=acc;
  let segs=[[0,len]];for(const o of ops)if(o.bot<=0)segs=segs.flatMap(([a,b])=>o.u0>a&&o.u1<b?[[a,o.u0],[o.u1,b]]:[[a,b]]);
  for(const[a,b]of segs)put('Bottom plate','2x4',a,b-a,y,1.5,0,3.5);
  put('Top plate','2x4',0,len,y+h-1.5,1.5,0,3.5);
  const reg=[0];for(let c=sp;c<len-2.25;c+=sp)reg.push(c-.75);reg.push(len-1.5);
  let us=reg.slice();
  for(const o of ops){us=us.filter(u=>u+1.5<=o.u0-1.5+1e-6||u>=o.u1+1.5-1e-6);us.push(o.u0-1.5,o.u1);}
  us=[...new Set(us.map(r16))].sort((a,b)=>a-b);const keep=[];
  for(const u of us)if(!keep.length||u>=keep[keep.length-1]+1.5-1e-6)keep.push(u);
  for(const u of keep)put('Stud','2x4',u,1.5,y+1.5,h-3,0,3.5);
  for(const o of ops){const w=o.u1-o.u0;
    put('Header','2x6',o.u0,w,y+o.top,5.5,0,1.5);put('Header','2x6',o.u0,w,y+o.top,5.5,1.5,1.5);
    if(o.bot>0)put('Sill','2x4',o.u0,w,y+o.bot-1.5,1.5,0,3.5);
    for(const u of reg){if(u<o.u0+1e-6||u+1.5>o.u1-1e-6)continue;
      const hi=h-1.5-(o.top+5.5);if(hi>=2)put('Cripple','2x4',u,1.5,y+o.top+5.5,hi,0,3.5);
      const lo=o.bot-3;if(o.bot>0&&lo>=2)put('Cripple','2x4',u,1.5,y+1.5,lo,0,3.5);}
    if(o.bot<=0)put('Shed door','ply34',o.u0+.25,w-.5,y+.25,o.top-.5,outer?2.75:0,.75);
    else put('Window','glass',o.u0,w,y+o.bot,o.top-o.bot,1.25,1);
  }
  return ops;
}
function shedPlan(p){const W=Math.max(p.W,48),D=Math.max(p.D,48),Hb=Math.max(p.Hb,60),rise=r16(Math.max(0,p.pitch)/12*(D-3.5));
  return{W,D,Hb,Hf:Hb+rise,F:9.75,rise,ang:Math.atan2(rise,D-3.5),rm:D>100?'2x6':'2x4'};}
function buildShed(p){
  const{W,D,Hb,Hf,F,ang,rm}=shedPlan(p),P=[],sp=+p.sp||16;
  const nsk=D>100?3:2;for(let i=0;i<nsk;i++)P.push(mk('Skid','4x4',[W,3.5,3.5],[0,0,r16(8+i*(D-19.5)/(nsk-1))]));
  P.push(mk('Rim joist','2x6',[W,5.5,1.5],[0,3.5,0]),mk('Rim joist','2x6',[W,5.5,1.5],[0,3.5,D-1.5]));
  const xs=[0];for(let c=16;c<W-2.25;c+=16)xs.push(c-.75);xs.push(W-1.5);
  for(const x of xs)P.push(mk('Floor joist','2x6',[1.5,5.5,D-3],[x,3.5,1.5]));
  tile(P,'Floor deck','ply34',.75,0,0,W,D,9);
  const walls={back:{len:W,ops:[]},front:{len:W,ops:[]},left:{len:D-7,ops:[]},right:{len:D-7,ops:[]}};
  const dW=walls[p.dwall]||walls.front,du=p.doff>0?p.doff:(dW.len-p.dw)/2;
  dW.ops.push({u0:du,u1:du+p.dw,bot:0,top:p.dh});
  const wl=p.wwall==='both'?['left','right']:[p.wwall],cnt={};
  for(let i=0;i<Math.min(p.wn,8);i++){const k=wl[i%wl.length];cnt[k]=(cnt[k]||0)+1;}
  for(const k in cnt){const w=walls[k],d=w.ops[0],segs=d?[[0,d.u0],[d.u1,w.len]]:[[0,w.len]],per=segs.map(()=>0); // windows go either side of a door on the same wall
    for(let i=0;i<cnt[k];i++)per[i%segs.length]++;
    segs.forEach(([a,b],si)=>{for(let i=0;i<per[si];i++){const c=a+(b-a)*(i+1)/(per[si]+1);w.ops.push({u0:c-p.ww/2,u1:c+p.ww/2,bot:p.sill,top:p.sill+p.wh});}});}
  shedWall(P,true,0,0,W,F,Hb,sp,walls.back.ops,0);
  shedWall(P,true,0,D-3.5,W,F,Hf,sp,walls.front.ops,1);
  shedWall(P,false,0,3.5,D-7,F,Hb,sp,walls.left.ops,0);
  shedWall(P,false,W-3.5,3.5,D-7,F,Hb,sp,walls.right.ops,1);
  // roof: rafters and plywood lie on the slope from the back wall up to the front wall
  const rh=M[rm].w,ca=Math.cos(ang),sa=Math.sin(ang),Lr=r16((D+12)/ca),deg=-Math.round(ang*1800/Math.PI)/10,cy=F+(Hb+Hf)/2+rh/2/ca,cz=D/2;
  const rx=[0];for(let c=24;c<W-2.25;c+=24)rx.push(c-.75);rx.push(W-1.5);
  for(const x of rx){const r=mk('Rafter',rm,[1.5,rh,Lr],[x,cy-rh/2,cz-Lr/2]);r.rot={k:0,deg};P.push(r);}
  const nx=Math.ceil(W/96-1e-6),ns=Math.ceil(Lr/48-1e-6),pl=Lr/ns,off=rh/2+.25;
  for(let i=0;i<nx;i++)for(let j=0;j<ns;j++){const s=-Lr/2+(j+.5)*pl,q=mk('Roof deck','ply12',[W/nx,.5,pl],[i*W/nx,cy+s*sa+off*ca-.25,cz+s*ca-off*sa-pl/2]);q.rot={k:0,deg};P.push(q);}
  return P;
}
function shedNotes(p){const s=shedPlan(p),Lr=(s.D+12)/Math.cos(s.ang);
  return['BUILD AT YOUR OWN RISK. This is a simplified framing layout to help you plan and price a shed. It is not an engineered plan. Sheds usually need a permit and must meet local rules for wind, anchoring, size and distance from property lines, so check with your city or county building department before you buy lumber.',
   `Shed is ${fmtFt(s.W)} wide × ${fmtFt(s.D)} deep (${Math.round(s.W*s.D/144)} sq ft of floor). Walls are ${fmtFt(s.Hb)} tall at the back and ${fmtFt(s.Hf)} at the front, so the roof drains to the back.`,
   `Not in the cut list: siding (about ${Math.ceil(2*(s.W+s.D)/48)+1} sheets of 4 ft × 8 ft exterior siding such as T1-11), roofing for about ${Math.ceil(s.W*Lr/144*1.1)} sq ft (drip edge, felt, and shingles or metal panels), trim, and paint.`,
   'Set the skids on solid concrete blocks or a compacted gravel pad, level in both directions, and anchor the shed to the ground. Use pressure-treated lumber for the skids and floor frame.',
   'The triangle above each side wall is left open in the drawing. Fill it with short studs cut to fit before you put the siding on.'];}
const num=(k,label,v)=>({k,label,v});
