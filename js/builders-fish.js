/* NominalCAD: fish tank rack engine and the single aquarium stand */
'use strict';
/* Fish tank rack engine.
   Auto mode fits as many tanks as it can and sizes the lumber for the water weight; every choice can also be
   forced by hand (rows, tank per row, tanks per row, rail size, upright size), and the load check then reports
   how hard the wood is working. Rule-of-thumb numbers for construction-grade 2x lumber under long-term load,
   deliberately conservative. Long walls are split into sections so every rail comes from a board you can haul. */
const RAILS=[['2x4',3.06,5.36,60],['2x6',7.56,20.8,84],['2x8',13.14,47.6,96],['2x10',21.39,98.9,96]]; // name, section modulus, inertia, max span
const UPS=[['2x4',1.5,1340],['4x4',3.5,3100]]; // name, width, safe load per upright (lb)
const railOf=n=>RAILS.find(r=>r[0]===n),upOf=n=>UPS.find(u=>u[0]===n);
/* What sits under the bottom row of tanks: nothing, an open storage shelf, or a closed cabinet with doors.
   A base is simply an extra storage row added at the bottom; every row the user set moves up one. */
function rackBase(p){
  if(!p.base||p.base==='open')return p;
  const a={...p,r1:'store'};for(let i=2;i<=7;i++)a['r'+i]=p['r'+(i-1)]||'';
  if(+p.levels)a.levels=''+(+p.levels+1);return a;}
const doorCount=W=>Math.max(1,Math.round(W/20));
function cabinetSkin(P,ox,W,D,H,o){ // thin plywood sides and back, and overlay doors across the front, up to height H
  if(o.left)P.push(mk('Side panel','ply14',[.25,H,D],[ox-.25,0,0]));
  if(o.right)P.push(mk('Side panel','ply14',[.25,H,D],[ox+W,0,0]));
  if(o.back){const nb=Math.ceil(W/96-1e-6);for(let i=0;i<nb;i++)P.push(mk('Back panel','ply14',[W/nb,H,.25],[ox+i*W/nb,0,-.25]));}
  if(o.doors){const n=doorCount(W),dw=(W-(n+1)*.125)/n;for(let i=0;i<n;i++)P.push(mk('Door','ply34',[dw,H-1,.75],[ox+.125+i*(dw+.125),.5,D]));}
}
function rackHw(p){const pl=rackPlan(p);if(!pl||p.base!=='cabinet')return[];
  const n=pl.mods.reduce((a,m)=>a+doorCount(m.W),0);return[['Cabinet hinges, full overlay',2*n],['Door pulls',n],['Magnetic door catches',n]];}
function rackPlan(p){
  p=rackBase(p);
  const above=p.light+p.clr,board=+p.board||96,fixedN=+p.levels||0,capN=+p.perRow||0;
  const main={tl:p.tl,td:p.td,th:p.th,gal:p.gal,name:TANKS[p.size]?TANKS[p.size][4]:`${p.gal} gallon tank`};
  const spec=i=>{const v=p['r'+(i+1)];
    if(v==='store')return{store:true,tl:0,td:0,th:p.storeH||16,gal:0,name:'storage shelf'};
    if(v&&TANKS[v]){const t=TANKS[v];return{tl:t[0],td:t[1],th:t[2],gal:t[3],name:t[4]};}
    return main;};
  const railList=railOf(p.rail)?[railOf(p.rail)]:RAILS,upList=upOf(p.up)?[upOf(p.up)]:UPS,manual=railList.length===1||upList.length===1||fixedN>0;
  let best=null;
  const tryO=(end,o)=>{for(const[rail,Sx,I,capSpan]of railList)for(const[up,su,bear]of upList){
    const rh=M[rail].w,rb=rh+.5,y0=Math.max(0,p.low-rb),rows=[];let y=y0,bad=false;
    for(let i=0;i<(fixedN||12);i++){const s=spec(i),tx=s.store?0:(end?s.td:s.tl),tz=s.store?0:(end?s.tl:s.td);
      const th=s.store&&p.standH?p.standH-2*rb:s.th,ab=s.store?0:above,pitch=rb+th+ab;
      if(th<(s.store?6:.5)||(!s.store&&(tx<=0||tz<=0))){bad=true;break;}
      if(!fixedN&&y+pitch>p.H+1e-6)break;
      rows.push({...s,th,tx,tz,sl:tx+1,wt:s.gal*11.25,w:s.store?0:s.gal*11.25/(tx+1)/2,y,ab,pitch});y+=pitch;}
    if(bad)continue;
    const trim=()=>{while(!fixedN&&rows.length&&rows[rows.length-1].store)rows.pop();}; // never end on an empty shelf
    trim();
    for(;;){
      const tr=rows.filter(r=>!r.store);if(!tr.length)break;
      const D=Math.max(7.5,Math.ceil((Math.max(...tr.map(r=>r.tz))+1)*4)/4);if(D>p.maxD+1e-6)break;
      const wmax=Math.max(...tr.map(r=>r.w)),wsum=tr.reduce((a,r)=>a+r.w,0);
      const lim=Math.min(capSpan,Math.sqrt(8*Sx*700/wmax),Math.cbrt(.16*1.2e6*I/wmax),bear/wsum);
      const Bs=new Set();for(const r of tr)for(let k=1;k<=10;k++)Bs.add(r.sl*k);
      const geo=[...Bs].filter(B=>tr.every(r=>Math.floor(B/r.sl+1e-6)>=1)).sort((a,b)=>a-b);
      let ok=geo.filter(B=>B+su<=lim+1e-6);
      if(!ok.length){
        if(manual)ok=geo.slice(0,1);                                   // forced by hand: build it anyway and flag it
        else if(rows.length>1){rows.pop();trim();continue;}            // auto: drop the top row and try again
        else break;}
      const oh=3+2*su;
      for(const B of ok){
        const cmax=Math.max(...tr.map(r=>Math.floor(B/r.sl+1e-6)));let budget=capN?Math.ceil(capN/cmax):1e9;
        const mods=[];let rem=p.W,bays=0,Wt=0;
        while(mods.length<200&&budget>0){const nb=Math.min(budget,Math.floor((Math.min(board+3,rem)-oh+su)/(B+su)+1e-6));if(nb<1)break;
          const W=oh+nb*B+(nb-1)*su;mods.push({nb,W});rem-=W;bays+=nb;Wt+=W;budget-=nb;}
        if(!bays)continue;
        const rr=rows.map(r=>{const c=r.store?0:Math.floor(B/r.sl+1e-6);return{...r,c,cnt:Math.min(capN||1e9,c*bays)};});
        const count=rr.reduce((a,r)=>a+r.cnt,0),span=B+su,last=rr[rr.length-1];
        const util={rail:Math.max(wmax*span*span/8/Sx/700,5*wmax*span**4/(384*1.2e6*I)/(span/480)),up:wsum*span/bear};
        const pl={o,end,rows:rr,n:rr.length,D,y0,B,su,rail,rh,rb,up,mods,bays,W:Wt,board,count,manual,span,util,
          gallons:rr.reduce((a,r)=>a+r.cnt*r.gal,0),total:rr.reduce((a,r)=>a+r.cnt*r.wt,0),
          over:util.rail>1.005||util.up>1.005||span>capSpan+1e-6,top:last.y+rb+last.th,need:last.y+last.pitch,postH:last.y+rh};
        if(!best||(best.over&&!pl.over)||(best.over===pl.over&&(pl.count>best.count||(pl.count===best.count&&pl.rail===best.rail&&pl.up===best.up&&pl.bays<best.bays))))best=pl;
      }
      break;
    }
  }};
  if(p.orient!=='end')tryO(false,'long side facing out');
  if(p.orient!=='long')tryO(true,'short end facing out');
  return best;
}
function rackLayout(pl,m){
  const{B,su}=pl,sup=[],cross=[],bay=[];
  for(let j=0;j<=m.nb;j++){const s=1.5+j*(B+su);sup.push(s);cross.push(s);if(su>1.5)cross.push(s+su-1.5);
    if(j<m.nb){const b0=s+su,nc=Math.ceil(B/16-1e-6)-1;bay.push(b0);for(let q=1;q<=nc;q++)cross.push(r16(b0+q*B/(nc+1)-.75));}}
  return{sup,bay,cross:cross.sort((a,b)=>a-b),bx:[1.5,...sup.slice(1,-1).map(s=>s+su/2),m.W-1.5]};
}
const pct=v=>Math.round(v*100)+'%';
function rackNotes(p){
  const pl=rackPlan(p);if(!pl)return['No tanks fit. Make the wall wider or taller, allow more depth from the wall, or reduce the room above the tanks.'];
  const psf=Math.round(pl.total/(pl.W*pl.D/144)),M0=pl.mods.length,kinds=new Set(pl.rows.map(r=>r.name));
  const N=[`Holds ${pl.count} tank${pl.count===1?'':'s'} (${Math.round(pl.gallons).toLocaleString()} gallons) on ${pl.n} row${pl.n>1?'s':''}, ${pl.o}.`+
    (kinds.size>1?' Bottom to top: '+pl.rows.map(r=>r.store?'storage shelf':`${r.cnt} × ${r.name}`).join(', ')+'.':` That is ${pl.rows[0].cnt} per row.`)];
  if(pl.over)N.push(`OVERLOADED. With the sizes you forced, the rails are at ${pct(pl.util.rail)} and the uprights at ${pct(pl.util.up)} of the rule-of-thumb limit. Pick a bigger rail or upright, or set them back to Auto.`);
  if(p.base==='shelf')N.push('The bottom level is an open storage shelf for filters, food and buckets. It is not counted as holding water.');
  if(p.base==='cabinet')N.push('The bottom level is a closed cabinet with doors for filters, food and buckets. It is not counted as holding water.');
  if(pl.need>p.H+.01)N.push(`Your rows need ${fmtFt(pl.need)} of height, which is more than the ${fmtFt(p.H)} available. Remove a row or reduce the room above the tanks.`);
  N.push(`Rack is ${fmtFt(pl.W)} wide × ${fmtFt(pl.D)} deep`+(M0>1?`, built as ${M0} separate sections side by side so no rail is longer than a ${pl.board/12} ft board`:'')+`. Top of the highest tank is ${fmtFt(pl.top)} off the floor.`,
   `Filled weight: about ${Math.round(pl.total).toLocaleString()} lb of tanks plus lumber, roughly ${psf} lb per square foot of floor.`,
   `Above every tank there is ${fmt(p.light)} for the light plus ${fmt(p.clr)} of open hand room for feeding, netting and cleaning.`+(pl.top>66?' The top row is above eye level, so plan on a step stool to service it.':''));
  if(!pl.over)N.push(`Load check: ${pl.rail} rails at ${pct(pl.util.rail)} and ${pl.up} uprights at ${pct(pl.util.up)} of the rule-of-thumb limit, with uprights ${fmt(pl.span)} apart. The weight goes straight down through wood, not through screws.`);
  if(!pl.manual&&!(+p.perRow)&&pl.board<192){const big=rackPlan({...p,board:192});if(big&&big.count>pl.count)N.push(`Tip: if you can haul boards up to 16 ft, the same wall holds ${big.count} tanks. Change "Longest board you can haul".`);}
  if(pl.postH>192)N.push('This rack is taller than 16 ft. Boards that long are not sold as single pieces, and a structure this size is beyond rule-of-thumb sizing: treat this as a concept drawing and have an engineer design the real thing.');
  N.push('Safety: this is a rule-of-thumb estimate, not an engineer\'s certification. Use straight, dry lumber, glue and screw every joint, screw the back posts to wall studs so it cannot tip, and put it on a concrete slab or across floor joists against a load-bearing wall. Keep power strips above tank level with a drip loop on every cord.');
  return N;
}
function buildRack(p){
  const pl=rackPlan(p);if(!pl)return[];
  const{D,y0,rows,mods,rail,rh,rb,up,su,B}=pl,P=[],placed=rows.map(()=>0);let ox=0;
  for(const m of mods){const lay=rackLayout(pl,m),W=m.W;
    for(const x of[0,W-1.5])for(const z of[0,D-3.5])P.push(mk('Post','2x4',[1.5,pl.postH,3.5],[ox+x,0,z]));
    rows.forEach((row,i)=>{const y=row.y;
      P.push(mk('Rail',rail,[W-3,rh,1.5],[ox+1.5,y,0]),mk('Rail',rail,[W-3,rh,1.5],[ox+1.5,y,D-1.5]));
      for(const cx of lay.cross)P.push(mk('Cross piece',rail,[1.5,rh,D-3],[ox+cx,y,1.5]));
      const bx=i===rows.length-1?[0,...lay.bx.slice(1,-1),W]:lay.bx; // the top deck runs over the post tops so the top is one clean surface
      for(let j=0;j<bx.length-1;j++){const len=bx[j+1]-bx[j],pc=Math.ceil(len/96-1e-6);
        for(let q=0;q<pc;q++)P.push(mk('Shelf deck','ply12',[len/pc,.5,D],[ox+bx[j]+q*len/pc,y+rh,0]));}
      for(const sx of lay.sup)for(const z of[0,D-3.5]){
        if(i>0){const lo=rows[i-1];P.push(mk('Upright',up,[su,lo.th+lo.ab,3.5],[ox+sx,lo.y+rb,z]));}
        else if(y0>0)P.push(mk('Foot',up,[su,y0,3.5],[ox+sx,0,z]));}
      if(!row.store)for(const b0 of lay.bay)for(let q=0;q<row.c&&placed[i]<row.cnt;q++,placed[i]++){
        const x=b0+q*B/row.c+(B/row.c-row.tx)/2,t=mk('Tank','tank',[row.tx,row.th,row.tz],[ox+x,y+rb,(D-row.tz)/2]);t.gal=row.gal;P.push(t);
        if(p.light>=1){const lz=Math.min(3,row.tz);P.push(mk('Light','light',[Math.max(4,row.tx-4),1,lz],[ox+x+Math.min(2,(row.tx-4)/2),y+rb+row.th+p.clr,(D-lz)/2]));}}
    });
    if(p.brace&&rows.length>=2){ // diagonal 1x4 across the back of the section so it cannot lean sideways
      const bw=W-3.5,bh=pl.postH-3.5,len=r16(Math.hypot(bw,bh)),br=mk('Back brace','1x4',[len,3.5,.75],[ox+W/2-len/2,pl.postH/2-1.75,-.75]);
      br.rot={k:2,deg:Math.round(Math.atan2(bh,bw)*1800/Math.PI)/10};P.push(br);}
    if(p.base==='cabinet')cabinetSkin(P,ox,W,D,rows[1].y+rb,{doors:true,left:m===mods[0],right:m===mods[mods.length-1],back:!p.brace});
    ox+=W;}
  return P;
}
function rackSteps(p){
  const pl=rackPlan(p);if(!pl)return[];const{rail,up,n,y0,mods,rows}=pl,M0=mods.length,kinds=[];
  for(const m of mods)if(!kinds.some(k=>k.W===m.W))kinds.push(m);
  const pos=kinds.map(m=>(kinds.length>1?`${fmt(m.W)} wide section: `:'')+rackLayout(pl,m).cross.map(c=>fmt(c-1.5)).join(', ')).join('; ');
  const ups=[...new Set(rows.slice(0,-1).map(r=>fmt(r.th+r.ab)))];
  return[CUT,
   {t:`Build ${n*M0} shelf frames (${n} for ${M0>1?'each of the '+M0+' sections':'the rack'}). Each one is two ${rail} rails on edge with cross pieces between them. Left edge of each cross piece, measured from the left end of the rail: ${pos}. Glue each joint and drive two 3" screws through the rail into each cross-piece end.`,add:['Rail','Cross piece']},
   {t:'Glue and screw a plywood deck onto the top of each frame. The deck spreads the weight of the tanks and keeps the frame square.',add:['Shelf deck']},
   {t:(M0>1?'Build each section as its own rack. ':'')+(y0>0?`Screw a ${up} foot (${fmt(y0)} long) under the bottom frame wherever an upright will stand above it, front and back. `:'')+'Stand the bottom frame up, then clamp the four tall posts to the outside of its ends and screw them on. Check the posts are plumb.',add:['Foot','Post']},
   ...(n>1?[{t:`Stack upward one row at a time. Stand the ${up} uprights (${ups.length>1?'lengths, bottom row first: '+rows.slice(0,-1).map(r=>fmt(r.th+r.ab)).join(', '):ups[0]+' long'}) on the deck directly above the feet, screw the end ones to the posts, set the next frame on top of them, and screw it down into the uprights and sideways into the posts. Every upright must sit directly above the one below it so the weight goes straight to the floor.`,add:['Upright']}]:[]),
   ...(p.brace&&n>=2?[{t:'Screw a diagonal 1x4 brace across the back of each section, from a bottom corner to the opposite top corner. Hold the board in place, mark where it crosses the posts, trim the ends flush, then drive two screws into every post and rail it crosses. This is what stops the rack from leaning sideways.',add:['Back brace']}]:[]),
   ...(p.base==='cabinet'?[{t:'Close in the cabinet base. Glue and nail the thin plywood panels onto the outer ends'+(p.brace?'':' and the back')+', then hang the doors across the front with two overlay hinges each, leaving a 1/8" gap between doors. Add the pulls and a magnetic catch for each door. Paint or seal every plywood edge so splashed water cannot soak in.',add:['Side panel','Back panel','Door']}]:[]),
   {t:'Level the rack with shims and screw the back posts to wall studs so it cannot tip.'+(M0>1?' Stand the sections side by side and screw or bolt the neighboring posts together.':'')+` Mount each light under the shelf above its tank, leaving the ${fmt(p.clr)} of hand room below it. Put a foam mat under any rimless tank. Fill one tank at a time, bottom row first, and watch for sag or wobble before filling the next.`,add:['Tank','Light']}];
}
/* Single stand = a two-row rack: a storage shelf below and one tank on top. */
function standArgs(p){
  const a=p.under==='tank'?{...p,W:p.tl+12,H:999,maxD:p.td+2,light:3,clr:Math.max(8,Math.ceil(p.th/2)),low:6,board:192,orient:'long',levels:2,r1:'',r2:'',perRow:1,brace:false}
    :{...p,W:p.tl+12,H:999,maxD:p.td+2,light:0,clr:0,low:0,board:192,orient:'long',levels:2,r1:'store',r2:'',perRow:1,brace:false};
  return rackPlan(a)?a:null;
}
function standNotes(p){const a=standArgs(p);if(!a)return['That combination does not work. Make the stand taller (it needs at least 6" of storage space under the top frame) or pick a smaller rail size.'];
  const pl=rackPlan(a),N=[`Stand is ${fmtFt(pl.W)} wide × ${fmtFt(pl.D)} deep × ${fmtFt(p.under==='tank'?pl.top:p.standH)} tall, with ${pl.rail} rails and ${pl.up} uprights.`,
   `The filled tank is about ${Math.round(pl.total).toLocaleString()} lb (water, glass, gravel). The weight goes straight down through the uprights, not through screws.`];
  N.push(pl.over?`OVERLOADED. With the sizes you forced, the rails are at ${pct(pl.util.rail)} and the uprights at ${pct(pl.util.up)} of the rule-of-thumb limit. Pick a bigger size or set them back to Auto.`
    :`Load check: rails at ${pct(pl.util.rail)} and uprights at ${pct(pl.util.up)} of the rule-of-thumb limit.`);
  N.push(p.under==='tank'?'Both tanks are counted in the weight above. Leave room to reach into the lower one.':'The lower shelf is for storage (filter, food, buckets), not a second tank.',
   'Safety: this is a rule-of-thumb estimate, not an engineer\'s certification. Use straight, dry lumber, glue and screw every joint, level the stand with shims, and keep power strips above the floor with a drip loop on every cord.');
  return N;}
/* Cabinet stand = a rack with a closed cabinet base, laid out long side forward and sitting on the floor. */
const cabArgs=p=>({...p,H:999,maxD:60,light:3,low:0,board:'96',orient:'long',brace:false,base:'cabinet'});
