/* NominalCAD: shared builders for tables, benches and boxes, plus the tank size list */
'use strict';
/* ---------- presets ---------- */
function buildTable(o){
  const P=[],lm=M[o.leg],am=M[o.apron],tm=M[o.top],s=lm.w,tt=tm.t,ov=o.over;
  const L=Math.max(o.L,2*ov+2*s+4);let W=Math.max(o.W,2*ov+2*s+2);const H=Math.max(o.H,am.w+tt+2);
  if(tm.kind==='board'){const n=Math.max(1,Math.round(W/tm.w));W=n*tm.w;
    for(let i=0;i<n;i++)P.push(mk('Top board',o.top,[L,tt,tm.w],[0,H-tt,i*tm.w]));}
  else P.push(mk('Top',o.top,[L,tt,W],[0,H-tt,0]));
  const lh=H-tt;
  for(const x of[ov,L-ov-s])for(const z of[ov,W-ov-s])P.push(mk('Leg',o.leg,[s,lh,s],[x,0,z]));
  const aw=am.w,at=am.t,al=L-2*ov-2*s,sl=W-2*ov-2*s;
  const frame=(y,nm,ends)=>{
    P.push(mk('Long '+nm,o.apron,[al,aw,at],[ov+s,y,ov]),mk('Long '+nm,o.apron,[al,aw,at],[ov+s,y,W-ov-at]));
    if(ends)P.push(mk('Short '+nm,o.apron,[at,aw,sl],[ov,y,ov+s]),mk('Short '+nm,o.apron,[at,aw,sl],[L-ov-at,y,ov+s]));
  };
  frame(lh-aw,'apron',true);
  if(o.shelf&&lh-aw>o.lowY+aw+2){
    frame(o.lowY,'stretcher',!!o.endStretch);
    const sm=M[o.shelf],y=o.lowY+aw;
    if(sm.kind==='sheet')P.push(mk('Lower shelf',o.shelf,[al,sm.t,W-2*ov],[ov+s,y,ov]));
    else{const n=Math.max(1,Math.floor(al/(sm.w+.25))),gap=(al-n*sm.w)/(n+1);
      for(let i=0;i<n;i++)P.push(mk('Shelf slat',o.shelf,[sm.w,sm.t,W-2*ov],[ov+s+gap+i*(sm.w+gap),y,ov]));}
  }
  return P;
}
function buildBox(o){ // planter / raised bed
  const P=[],bm=M[o.board],pm=M[o.post],bt=bm.t,bw=bm.w,ps=pm.w,rows=Math.max(1,Math.round(o.rows)),H=rows*bw;
  const L=Math.max(o.L,2*bt+2*ps+2),D=Math.max(o.D,2*bt+2*ps+1);
  for(let r=0;r<rows;r++){
    P.push(mk('Long side',o.board,[L,bw,bt],[0,r*bw,0]),mk('Long side',o.board,[L,bw,bt],[0,r*bw,D-bt]));
    P.push(mk('End',o.board,[bt,bw,D-2*bt],[0,r*bw,bt]),mk('End',o.board,[bt,bw,D-2*bt],[L-bt,r*bw,bt]));
  }
  for(const x of[bt,L-bt-ps])for(const z of[bt,D-bt-ps])P.push(mk('Corner post',o.post,[ps,H,ps],[x,0,z]));
  if(o.bottom){const span=L-2*bt-2*ps,n=Math.max(1,Math.floor(span/(bw+.25))),gap=(span-n*bw)/(n+1);
    for(let i=0;i<n;i++)P.push(mk('Bottom slat',o.board,[bw,bt,D-2*bt],[bt+ps+gap+i*(bw+gap),0,bt]));}
  return P;
}
const TANKS={g5:[16,8,10,5.5,'5.5 gallon'],g10:[20,10,12,10,'10 gallon'],g15:[24,12,12,15,'15 gallon'],g20h:[24,12,16,20,'20 gallon high (tall)'],g20l:[30,12,12,20,'20 gallon long'],
 g29:[30,12,18,29,'29 gallon'],g30b:[36,18,12,30,'30 gallon breeder'],g40b:[36,18,16,40,'40 gallon breeder'],g40l:[48,12,16,40,'40 gallon long'],g55:[48,13,21,55,'55 gallon'],
 g65:[36,18,24,65,'65 gallon (tall)'],g75:[48,18,21,75,'75 gallon'],g90:[48,18,24,90,'90 gallon (tall)'],g100:[72,18,18,100,'100 gallon'],g120:[48,24,24,120,'120 gallon'],g125:[72,18,21,125,'125 gallon']};
const TANK_OPTS=Object.entries(TANKS).map(([k,v])=>[k,v[4]]);
