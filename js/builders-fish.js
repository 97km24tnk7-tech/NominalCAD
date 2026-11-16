/* NominalCAD: fish tank rack engine and the single aquarium stand */
'use strict';
/* Fish tank rack engine.
   Auto mode fits as many tanks as it can and sizes the lumber for the water weight; every choice can also be
   forced by hand (rows, tank per row, tanks per row, rail size, upright size), and the load check then reports
   how hard the wood is working. Rule-of-thumb numbers for construction-grade 2x lumber under long-term load,
   deliberately conservative. Long walls are split into sections so every rail comes from a board you can haul.

   How a rack is put together (and why it stands):
     - Every row is a frame: two rails on edge, cross pieces between them, a plywood deck on top.
     - The front and back edges of every tank sit over a rail. On a rack with tanks of different depths, a row of
       slightly shallower tanks gets doubled rails; for a row of much shallower tanks the rails move in under the
       tank's edges, the uprights are made deep enough (2x6 or 2x8) that those rails still sit fully on them, and
       filler blocks outside the rails put wood under the uprights of the row above.
     - Every rail sits on an upright, and every upright stands directly above the one below, down to the floor,
       so the water weight goes straight down through wood and never through screws.
     - A rack taller than 4 times its depth must be screwed to the wall studs; one taller than 8 times its depth
       is refused (RACK_RULES). The rack presets say so in their notes, steps and warning box (rackCheck). */
/* The limits themselves live in js/verify.js (WOOD_RULES, TANK_RAIL_MAX_SPAN, POST_SAFE_LOAD, beamCheck) so that
   this engine and the structural check can never disagree: both work out bending with the same helper. */
const RAILS=Object.entries(TANK_RAIL_MAX_SPAN).map(([name,maxSpan])=>{const s=sectionOf(M[name].t,M[name].w);return[name,s.S,s.I,maxSpan];}); // name, section modulus, inertia, max span
/* Uprights: name, width across the rack, safe load per short upright (lb; postSafeLoad in js/verify.js lowers it
   for a long one), depth front to back.
   Auto tries them in this order and keeps the first that holds the most tanks. The deeper ones (2x6, 2x8) are
   for racks whose rows have tanks of different depths: see "How a rack is put together" above. */
const UPS=[['2x4',1.5,3.5],['4x4',3.5,3.5],['2x6',1.5,5.5],['2x8',1.5,7.25]].map(([name,across,deep])=>[name,across,postSafeLoad(name,0),deep]);
const TANK_LB=WOOD_RULES.TANK_LB_PER_GAL; // weight of a filled tank for each gallon
/* what the structural check should take each piece of a rack or stand for (keys of USES in js/verify.js) */
const RACK_USES={'Rail':'tankRail','Shelf deck':'tankDeck','Cross piece':'tankDeck','Post':'none','Back brace':'none','Side panel':'none','Back panel':'none','Door':'door','Filler block':'none','Panel stud':'none'};
const railOf=n=>RAILS.find(r=>r[0]===n),upOf=n=>UPS.find(u=>u[0]===n);
/* The rules of thumb that are the rack's own (the wood limits are in js/verify.js). */
const RACK_RULES={
  WALL_RATIO:TIP_RULES.narrow, // taller than this many times its depth: it must be screwed to the wall studs
  MAX_RATIO:8,                 // taller than this many times its depth: refused, even screwed to the wall
  RIM_INSET:.5,                // the outside of a tank's glass sits this far in from the outside face of its rail
  DOUBLE_RAIL_GAP:2,           // a tank up to this much shallower, front and back, than the rack sits on doubled rails (3" of wood)
  MIN_STORAGE:6,               // the least height worth calling a storage space
  MIN_REACH:3,                 // less room than this above a tank that has a shelf over it: it cannot be fed or cleaned (a warning)
  GALLONS_SHARE:.75,           // the gallons typed must be at least this share of what a tank that size holds
  MAX_GALLONS:400,             // the biggest tank the forms take; nothing heavier can be carried by these designs anyway
  WALL_SCREWS_PER_POST:4       // two near the top and two at mid height, into a stud
};
const up16=v=>Math.ceil(v*16-1e-6)/16,down16=v=>Math.floor(v*16+1e-6)/16; // to the next / the last 1/16"
/* What sits under the bottom row of tanks: nothing, an open storage shelf, or a closed cabinet with doors.
   A base is simply an extra storage row added at the bottom; every row the user set moves up one. */
function rackBase(p){
  if(!p.base||p.base==='open')return p;
  const a={...p,r1:'store'};for(let i=2;i<=7;i++)a['r'+i]=p['r'+(i-1)]||'';
  if(+p.levels)a.levels=''+(+p.levels+1);return a;}
/* The doors across the front of one section (m) of a cabinet base, and the stiles they hinge on.
   A door has to hinge on wood, so the doors follow the bays: a bay up to DOOR_SINGLE_MAX wide gets one door hinged
   on an upright, a wider one gets pairs of doors that meet in the middle, each pair no wider than DOOR_PAIR_MAX
   (a 3/4" plywood door much wider than 2 ft sags on its hinges).
   Where two pairs meet inside a bay there is no upright, so a door stile is stood there, under the front rail.
   Returns { doors:[{x, w}], stiles:[x] } with x measured from the left end of the section. */
const DOOR_SINGLE_MAX=20,DOOR_PAIR_MAX=54,DOOR_GAP=.125;
function cabinetDoors(pl,m){
  const lay=rackLayout(pl,m),doors=[],stiles=[];
  lay.bay.forEach((b0,j)=>{
    // the stretch of front this bay's doors cover: to the middle of the upright it shares with the next bay
    const from=j===0?0:b0-pl.su/2,to=j===m.nb-1?m.W:b0+pl.B+pl.su/2;
    const pairs=pl.B<=DOOR_SINGLE_MAX?0:Math.ceil(pl.B/DOOR_PAIR_MAX-1e-6),count=pairs?2*pairs:1,wide=(to-from-DOOR_GAP*count)/count;
    for(let i=0;i<count;i++)doors.push({x:from+DOOR_GAP/2+i*(wide+DOOR_GAP),w:wide});
    for(let q=1;q<pairs;q++)stiles.push(r16(from+q*(to-from)/pairs-.75));
  });
  return{doors,stiles};
}
const doorTotal=pl=>pl.mods.reduce((sum,m)=>sum+cabinetDoors(pl,m).doors.length,0);
/* a plywood door taller than 40" wants a third hinge in the middle or it bows away from the frame */
const hingesFor=doorHeight=>doorHeight>40?3:2;
const doorHardware=(n,doorHeight)=>[['Cabinet hinges, overlay type for face frames',hingesFor(doorHeight)*n],['Door pulls',n],['Magnetic door catches',n]];
/* Thin plywood sides and back, and overlay doors across the front, up to height H, for the section m that starts
   at x = ox. o says which of them: {left, right, back, doors}. The storage space is the bottom row of the plan. */
function cabinetSkin(P,ox,m,pl,H,o){
  const W=m.W,D=pl.D;
  // A side panel too big for one sheet (deeper and taller than 4 ft) is made in two halves that meet on a stud
  // stood between the two posts, so the seam has wood behind it.
  const sideHalves=fitsSheet(H,D)?1:2;
  const side=(panelX,studX)=>{
    for(let i=0;i<sideHalves;i++)P.push(mk('Side panel','ply14',[.25,H,D/sideHalves],[panelX,0,i*D/sideHalves]));
    if(sideHalves>1)P.push(mk('Panel stud','2x4',[1.5,H-.5,3.5],[studX,0,r16(D/2-1.75)])); // up to the underside of the deck above
  };
  if(o.left)side(ox-.25,ox);
  if(o.right)side(ox+W,ox+W-1.5);
  // the back: as few pieces as one sheet allows (a back taller than 4 ft uses its sheets standing up)
  if(o.back){
    const nb=Math.ceil(W/(H>SHEET_W?SHEET_W:SHEET_L)-1e-6),seam=i=>r16(i*W/nb); // seams on the 1/16" so the pieces meet exactly
    for(let i=0;i<nb;i++)P.push(mk('Back panel','ply14',[seam(i+1)-seam(i),H,.25],[ox+seam(i),0,-.25]));
  }
  if(!o.doors)return;
  const front=cabinetDoors(pl,m),storage=pl.rows[0];
  for(const door of front.doors)P.push(mk('Door','ply34',[door.w,H-1,.75],[ox+door.x,.5,D]));
  // a stile stands on the bottom deck over the front rail and reaches the underside of the frame above, like an upright
  const stileMat=pl.su>1.5?'2x4':pl.up,stileDeep=pl.su>1.5?3.5:pl.ud;
  for(const x of front.stiles)P.push(mk('Door stile',stileMat,[1.5,storage.th+storage.ab,stileDeep],[ox+x,storage.y+pl.rb,D-stileDeep]));
}
/* Hardware that is not wood: door hardware for a cabinet base, and the screws that hold the rack to the wall.
   alwaysOnWall: the rack preset is screwed to the wall whatever its height; the others only when they must be. */
function rackHw(p,alwaysOnWall){
  const pl=rackPlan(p),list=[];
  if(!pl)return list;
  if(p.base==='cabinet')list.push(...doorHardware(doorTotal(pl),pl.rows[1].y+pl.rb-1));
  if(alwaysOnWall||pl.wall)list.push(wallScrews(pl));
  return list;
}
const wallScrews=pl=>['Screws for the wall studs, 3" or longer',RACK_RULES.WALL_SCREWS_PER_POST*2*pl.mods.length];

/* The plan of a rack: which rail and upright, how many rows, how wide the bays, how many sections.
   Returns null when nothing fits, otherwise
     { o, end, rows, n, D, y0, B, su, ud, rail, rh, rb, up, postMat, mods, bays, W, board, count, manual, span,
       util:{rail, up}, gallons, total, top, need, postH,
       over      a rail or an upright is past its limit (only when sizes or rows were forced by hand)
       shallow   [row numbers, from 1] whose tanks are so much shallower than the rack that their edges miss the rails
       flawed    over, or some row is shallow
       tall, ratio   the height of the highest thing on it, and that height divided by the depth D
       narrow    the smaller of its depth and its whole width: the way it would fall over
       wall      it must be screwed to the wall studs (taller than RACK_RULES.WALL_RATIO times narrow)
       pastCap, capSpan   the rails span further than a rail of that size ever may under tanks (capSpan)
       tooTall   ratio above RACK_RULES.MAX_RATIO
       postLong  the end posts are longer than the longest board }
   Each row: { store, name, tl, td, th, gal, tx, tz (the tank as it is turned), sl, wt, w (lb per inch on each rail),
               y (underside of its frame), ab (room above the tank), pitch, doubled (its rails are doubled on the inside), inset (how far its rails sit in from
               the front and the back of the rack), c (tanks per bay), cnt (tanks on the row) }.
   Plans are worked out often (notes, steps, the check, the picture), so the last few are remembered. */
const rackPlanMemo=new Map();
function rackPlan(p){
  const key=JSON.stringify(p);
  if(rackPlanMemo.has(key))return rackPlanMemo.get(key);
  const plan=rackPlanFresh(p);
  if(rackPlanMemo.size>=24)rackPlanMemo.delete(rackPlanMemo.keys().next().value);
  rackPlanMemo.set(key,plan);
  return plan;
}
function rackPlanFresh(p){
  p=rackBase(p);
  // every size is taken to the 1/16" the pieces are cut to, so that parts meet exactly
  const above=r16(p.light+p.clr),board=+p.board||96,fixedRows=+p.levels||0,capTanks=+p.perRow||0;
  const main={tl:r16(p.tl),td:r16(p.td),th:up16(p.th),gal:p.gal,name:TANKS[p.size]?TANKS[p.size][4]:`${p.gal} gallon tank`};
  const rowSpec=i=>{
    const v=p['r'+(i+1)];
    if(v==='store')return{store:true,tl:0,td:0,th:r16(p.storeH||16),gal:0,name:'storage shelf'};
    if(v&&TANKS[v]){const t=TANKS[v];return{tl:t[0],td:t[1],th:t[2],gal:t[3],name:t[4]};}
    return main;
  };
  const railList=railOf(p.rail)?[railOf(p.rail)]:RAILS,upList=upOf(p.up)?[upOf(p.up)]:UPS;
  const manual=railList.length===1||upList.length===1||fixedRows>0;
  let best=null;
  // A sound plan beats a flawed one, then more tanks, then (same lumber) fewer bays. Of two flawed plans (sizes
  // or rows forced by hand that nothing can carry) the one that misses by least wins, so the warning box
  // reports the best that can be done.
  const better=pl=>{
    if(!best)return true;
    if(best.flawed!==pl.flawed)return best.flawed;
    if(pl.flawed&&Math.abs(pl.worst-best.worst)>1e-6)return pl.worst<best.worst;
    return pl.count>best.count||(pl.count===best.count&&pl.rail===best.rail&&pl.up===best.up&&pl.bays<best.bays);
  };

  const tryOrientation=(end,words)=>{
    for(const[rail,Sx,I,capSpan]of railList)for(const[up,su,bear,ud]of upList){
      const rh=M[rail].w,rb=rh+.5,rows=[];
      // "Lowest tank off floor" is about the lowest TANK: storage rows under it (a base, or a bottom row set to
      // storage) already lift it, so the feet only make up what is still missing.
      let underTanks=0;
      for(let i=0;i<12&&rowSpec(i).store;i++)underTanks+=rb+(p.standH?down16(p.standH-2*rb):rowSpec(i).th);
      const y0=r16(Math.max(0,p.low-rb-underTanks));
      // stack the rows from the floor up
      let y=y0,bad=false;
      for(let i=0;i<(fixedRows||12);i++){
        const s=rowSpec(i),tx=s.store?0:(end?s.td:s.tl),tz=s.store?0:(end?s.tl:s.td);
        const th=s.store&&p.standH?down16(p.standH-2*rb):s.th,ab=s.store?0:above,pitch=rb+th+ab;
        if(th<(s.store?RACK_RULES.MIN_STORAGE:.5)||(!s.store&&(tx<=0||tz<=0))){bad=true;break;}
        if(!fixedRows&&y+pitch>p.H+1e-6)break;
        rows.push({...s,th,tx,tz,sl:tx+1,wt:s.gal*TANK_LB,w:s.store?0:s.gal*TANK_LB/(tx+1)/2,y,ab,pitch});
        y+=pitch;
      }
      if(bad)continue;
      const trim=()=>{while(!fixedRows&&rows.length&&rows[rows.length-1].store)rows.pop();}; // never end on an empty shelf
      trim();
      for(;;){
        const tanks=rows.filter(r=>!r.store);
        if(!tanks.length)break;
        const D=Math.max(7.5,Math.ceil((Math.max(...tanks.map(r=>r.tz))+1)*4)/4);
        if(D>p.maxD+1e-6||2*ud>D+1e-6)break;           // too deep for the room, or the uprights would run into each other
        const last=rows[rows.length-1],top=last.y+rb+last.th,postH=last.y+rh,tall=Math.max(top,postH),ratio=tall/D;
        // Auto never builds taller than a rack that deep may be, nor taller than the longest board (an end post
        // is one piece): it leaves the top row off instead. Rows forced by hand are built and flagged.
        if(!fixedRows&&rows.length>1&&(ratio>RACK_RULES.MAX_RATIO+1e-6||postH>board+1e-6)){rows.pop();trim();continue;}
        // A bottom frame that lies on the floor is carried by the floor all the way along: its tanks bend no
        // rail and load no upright. (The structural check sees it the same way.)
        const carried=tanks.filter(r=>!(y0===0&&r===rows[0]));
        const wmax=Math.max(0,...carried.map(r=>r.w));
        // The uprights, level by level: the feet carry every row, the uprights under row i carry row i and all
        // above it. A long thin upright may carry less than a short one (postSafeLoad), so each level is weighed
        // against the safe load for its own length. upNeed is the worst level's lb per inch of span for each lb
        // it may carry: span * upNeed is how hard the hardest-working upright works (1 = at its limit).
        let upNeed=0,upWorst={load:0,safe:bear,length:0};
        const upLevel=(length,firstRow)=>{
          const load=carried.filter(r=>rows.indexOf(r)>=firstRow).reduce((sum,r)=>sum+r.w,0),safe=postSafeLoad(up,length);
          if(load/safe>upNeed){upNeed=load/safe;upWorst={load,safe,length};}
        };
        if(y0>0)upLevel(y0,0);
        for(let i=1;i<rows.length;i++)upLevel(rows[i-1].th+rows[i-1].ab,i);
        // (the span cap is for rails that carry tanks in the air: a frame lying on the floor spans nothing)
        const lim=Math.min(carried.length?capSpan:Infinity,maxSpanFor({S:Sx,I},wmax,'tankRail'),upNeed>0?1/upNeed:Infinity); // longest span the rail (bending, sag) and the uprights allow
        const Bs=new Set();for(const r of tanks)for(let k=1;k<=10;k++)Bs.add(r.sl*k);
        const geo=[...Bs].filter(B=>tanks.every(r=>Math.floor(B/r.sl+1e-6)>=1)).sort((a,b)=>a-b);
        let ok=geo.filter(B=>B+su<=lim+1e-6);
        if(!ok.length){
          if(manual)ok=geo.slice(0,1);                                   // forced by hand: build it anyway and flag it
          else if(rows.length>1){rows.pop();trim();continue;}            // auto: drop the top row and try again
          else break;}
        // Where the rails of each row go. A tank as deep as the rack has its edges over rails that run along the
        // very front and back. A shallower tank sits centered, `gap` in from the front and the back:
        //   up to DOUBLE_RAIL_GAP   the frame stays full depth and each rail is doubled on its inside, so the
        //                           tank's edges still sit over wood (no slivers of filler to cut);
        //   further in              the rails move in under the tank's edges, as far as they can while still
        //                           sitting fully on the uprights (ud deep). Further in than that, the tank's edges
        //                           would sit on bare plywood: the row is "shallow" and the plan is flawed.
        const shallow=[];
        rows.forEach((r,i)=>{
          const gap=r.store?0:(D-(r.tz+2*RACK_RULES.RIM_INSET))/2,moved=gap>RACK_RULES.DOUBLE_RAIL_GAP+1e-6;
          r.doubled=gap>=.5&&!moved;
          r.inset=moved?down16(Math.min(gap,ud-1.5)):0;
          if(moved&&gap>ud-1.5+1e-6)shallow.push(i+1);
        });
        const oh=3+2*su;
        for(const B of ok){
          const cmax=Math.max(...tanks.map(r=>Math.floor(B/r.sl+1e-6)));let budget=capTanks?Math.ceil(capTanks/cmax):1e9;
          const mods=[];let rem=p.W,bays=0,Wt=0;
          while(mods.length<200&&budget>0){const nb=Math.min(budget,Math.floor((Math.min(board+3,rem)-oh+su)/(B+su)+1e-6));if(nb<1)break;
            const W=oh+nb*B+(nb-1)*su;mods.push({nb,W});rem-=W;bays+=nb;Wt+=W;budget-=nb;}
          if(!bays)continue;
          const rr=rows.map(r=>{const c=r.store?0:Math.floor(B/r.sl+1e-6);return{...r,c,cnt:Math.min(capTanks||1e9,c*bays)};});
          const count=rr.reduce((a,r)=>a+r.cnt,0),span=B+su;
          const util={rail:beamCheck({S:Sx,I},span,wmax,'tankRail').ratio,up:upNeed*span};
          const pastCap=carried.length>0&&span>capSpan+1e-6;   // a rail may never span further than its size allows, unless the floor carries it
          const over=util.rail>VERIFY_OVER||util.up>VERIFY_OVER||pastCap;
          const worst=Math.max(util.rail,util.up,pastCap?span/capSpan:0)+shallow.length;
          // It can fall over the way it is narrowest: front to back, or sideways when it is narrower than it is deep
          // (one tall tank turned end-out, or a stand for a tank that is short but deep).
          const narrow=Math.min(D,Wt);
          const pl={worst,narrow,pastCap,capSpan,o:words,end,rows:rr,n:rr.length,D,y0,B,su,ud,rail,rh,rb,up,postMat:ud>3.5?up:'2x4',mods,bays,W:Wt,board,count,manual,span,util,
            upLoad:upWorst.load*span,upSafe:upWorst.safe,upLength:upWorst.length, // the hardest-working upright: what it carries, what it may, how long it is
            gallons:rr.reduce((a,r)=>a+r.cnt*r.gal,0),total:rr.reduce((a,r)=>a+r.cnt*r.wt,0),
            over,shallow,flawed:over||shallow.length>0,top,need:last.y+last.pitch,postH,
            tall,ratio,wall:tall/narrow>RACK_RULES.WALL_RATIO+1e-6,tooTall:ratio>RACK_RULES.MAX_RATIO+1e-6,postLong:postH>board+1e-6};
          if(better(pl))best=pl;
        }
        break;
      }
    }
  };
  if(p.orient!=='end')tryOrientation(false,'long side facing out');
  if(p.orient!=='long')tryOrientation(true,'short end facing out');
  return best;
}
/* Where things go along one section (m), measured from its left end:
     sup    left edge of every line of uprights        bay    left edge of every bay
     cross  left edge of every cross piece             under  the cross pieces that lie on a line of uprights
     bx     where the decks start and end (the middle of each line of uprights) */
function rackLayout(pl,m){
  const{B,su}=pl,sup=[],cross=[],under=[],bay=[];
  for(let j=0;j<=m.nb;j++){const s=1.5+j*(B+su);sup.push(s);under.push(s);if(su>1.5)under.push(s+su-1.5);
    if(j<m.nb){const b0=s+su,nc=Math.ceil(B/16-1e-6)-1;bay.push(b0);for(let q=1;q<=nc;q++)cross.push(r16(b0+q*B/(nc+1)-.75));}}
  cross.push(...under);
  return{sup,bay,under,cross:cross.sort((a,b)=>a-b),bx:[1.5,...sup.slice(1,-1).map(s=>s+su/2),m.W-1.5]};
}
/* Plywood comes in 4 ft x 8 ft sheets, so no piece may be wider than 4 ft one way and 8 ft the other. */
const SHEET_W=48,SHEET_L=96;
const fitsSheet=(a,b)=>Math.min(a,b)<=SHEET_W+1e-6&&Math.max(a,b)<=SHEET_L+1e-6;
/* Where to cut a deck that runs from `from` to `to` along the rack and is `deep` front to back, so that every piece
   comes out of one sheet and every seam lands on the middle of a cross piece (never on thin air).
   Returns the cut positions, both ends included. */
function deckCuts(from,to,deep,lay){
  const longest=deep>SHEET_W?SHEET_W:SHEET_L,cuts=[from],middles=lay.cross.map(x=>x+.75);
  while(to-cuts[cuts.length-1]>longest+1e-6){
    const start=cuts[cuts.length-1];
    const seam=middles.filter(x=>x>start+1&&x<to-1&&x<=start+longest+1e-6).pop();
    cuts.push(seam===undefined?start+longest:seam); // cross pieces are never more than 16" apart, so there is always one
  }
  cuts.push(to);
  return cuts;
}
/* The diagonal 1x4 braces across the back of one section. One brace from a bottom corner to the opposite top
   corner is best, but a board that long may be longer than the longest board the user can haul. Then the brace
   stops at a line of uprights nearer by, and if that is still too long the height is done in two or more braces
   that zigzag, each within the board length. Every brace ends on a post or a line of uprights.
   Returns [{x0, x1, y0, y1, rising}]: the box each brace runs corner to corner in; rising = up to the right. */
function rackBraces(pl,m){
  if(pl.n<2)return[];
  const lay=rackLayout(pl,m);
  const ends=[m.W,...lay.sup.slice(1,-1).map(s=>r16(s+pl.su)).reverse()]; // the far post first, then the uprights, far to near
  for(let pieces=1;pieces<=8;pieces++){
    const rise=pl.postH/pieces;
    const reach=ends.find(x=>Math.hypot(x-3.5,rise-3.5)<=pl.board+1e-6);
    if(reach)return Array.from({length:pieces},(unused,k)=>({x0:0,x1:reach,y0:r16(k*rise),y1:r16((k+1)*rise),rising:k%2===0}));
  }
  return[];
}
const pct=v=>Math.round(v*100)+'%';
/* the sentence that says the rack or stand must be screwed to the wall, or '' when it may stand free */
function wallNote(pl,what){
  if(!pl.wall)return'';
  const sideways=pl.narrow<pl.D; // narrower left to right than front to back
  return`Fasten it to the wall. At ${fmtFt(pl.tall)} tall on a base ${fmt(pl.narrow)} ${sideways?'wide':'deep'}, this ${what} is more than ${RACK_RULES.WALL_RATIO} times as tall as it is ${sideways?'wide':'deep'}, so it is not safe standing free: screw the back posts to the wall studs near the top and again at mid height.`;
}
function rackNotes(p,fields){
  const pl=rackPlan(p);if(!pl)return rackCheck(p,fields).map(f=>f.text+' '+f.fix);
  const psf=Math.round(pl.total/(pl.W*pl.D/144)),M0=pl.mods.length,kinds=new Set(pl.rows.map(r=>r.name));
  const N=[`Holds ${pl.count} tank${pl.count===1?'':'s'} (${Math.round(pl.gallons).toLocaleString()} gallons) on ${pl.n} row${pl.n>1?'s':''}, ${pl.o}.`+
    (kinds.size>1?' Bottom to top: '+pl.rows.map(r=>r.store?'storage shelf':`${r.cnt} × ${r.name}`).join(', ')+'.':` That is ${pl.rows[0].cnt} per row.`)];
  if(pl.over)N.push(`OVERLOADED. With the sizes you forced, the rails are at ${pct(pl.util.rail)} and the uprights at ${pct(pl.util.up)} of the rule-of-thumb limit. Pick a bigger rail or upright, or set them back to Auto.`);
  const thing=(fields||RACK_FIELDS).thing; // "rack" or "cabinet stand"
  if(pl.wall)N.push(wallNote(pl,thing));
  if(p.base==='shelf')N.push('The bottom level is an open storage shelf for filters, food and buckets. It is not counted as holding water.');
  if(p.base==='cabinet')N.push('The bottom level is a closed cabinet with doors for filters, food and buckets. It is not counted as holding water.');
  if(pl.need>p.H+.01)N.push(`Your rows need ${fmtFt(pl.need)} of height, which is more than the ${fmtFt(p.H)} available. Remove a row or reduce the room above the tanks.`);
  N.push(`The ${thing} is ${fmtFt(pl.W)} wide × ${fmtFt(pl.D)} deep`+(M0>1?`, built as ${M0} separate sections side by side so no rail is longer than ${pl.board===96?'an':'a'} ${pl.board/12} ft board`:'')+`. Top of the highest tank is ${fmtFt(pl.top)} off the floor.`,
   `Filled weight: about ${Math.round(pl.total).toLocaleString()} lb of tanks plus lumber, roughly ${psf} lb per square foot of floor.`,
   `Above every tank there is ${fmt(p.light)} for the light plus ${fmt(p.clr)} of open hand room for feeding, netting and cleaning.`+(pl.top>66?' The top row is above eye level, so plan on a step stool to service it.':''));
  if(!pl.over)N.push(`Load check: ${pl.rail} rails at ${pct(pl.util.rail)} and ${pl.up} uprights at ${pct(pl.util.up)} of the rule-of-thumb limit, with uprights ${fmt(pl.span)} apart. The weight goes straight down through wood, not through screws.`);
  if(pl.rows.some(r=>r.doubled))N.push('Some rows hold tanks a little shallower than the rack. Their frames have doubled rails front and back, so the edges of those tanks still sit over wood.');
  if(pl.rows.some(r=>r.inset>0))N.push(`The rows hold tanks of different depths. Each tank must have a rail under its front and back edge, so the frames of the shallower rows are built narrower and the ${pl.up} uprights are deep enough to carry them. The plywood decks are all the full ${fmt(pl.D)} deep.`);
  if(!pl.manual&&!(+p.perRow)&&pl.board<192){const big=rackPlan({...p,board:192});if(big&&big.count>pl.count)N.push(`Tip: if you can haul boards up to 16 ft, the same wall holds ${big.count} tanks. Change "Longest board you can haul".`);}
  N.push('Safety: this is a rule-of-thumb estimate, not an engineer\'s certification. Use straight, dry lumber, glue and screw every joint, screw the back posts to wall studs so it cannot tip, and put it on a concrete slab or across floor joists against a load-bearing wall. Keep power strips above tank level, '+DRIP_LOOP_WORDS+'.');
  return N;
}
function buildRack(p){
  const pl=rackPlan(p);if(!pl)return[];
  const{D,y0,rows,mods,rail,rh,rb,up,su,ud,B}=pl,P=[],placed=rows.map(()=>0);let ox=0;
  const frontBack=[0,D-ud]; // where the posts and uprights stand, back and front
  for(const m of mods){const lay=rackLayout(pl,m),W=m.W;
    for(const x of[0,W-1.5])for(const z of frontBack)P.push(mk('Post',pl.postMat,[1.5,pl.postH,ud],[ox+x,0,z]));
    rows.forEach((row,i)=>{const y=row.y,inset=row.inset; // the rails sit under the tank's edges: `inset` in from the back and the front
      // a doubled row has a second rail inside each rail (all four sit on the uprights); the cross pieces fit between
      const railsAt=row.doubled?[0,1.5,D-3,D-1.5]:[inset,D-1.5-inset],frameIn=row.doubled?3:1.5+inset;
      for(const z of railsAt)P.push(mk('Rail',rail,[W-3,rh,1.5],[ox+1.5,y,z]));
      for(const cx of lay.cross)P.push(mk('Cross piece',rail,[1.5,rh,D-2*frameIn],[ox+cx,y,frameIn]));
      // A frame that is set in stops short of the front and back of the rack, and the uprights of the row above
      // stand out there. A filler block on the outside of each rail, at every line of uprights, puts solid wood
      // under the whole foot of the upright above; it sits on the upright (or foot, or floor) below.
      if(inset>0&&i<rows.length-1)for(const cx of lay.under)for(const z of[0,D-inset])P.push(mk('Filler block',rail,[1.5,rh,inset],[ox+cx,y,z]));
      const bx=i===rows.length-1?[0,...lay.bx.slice(1,-1),W]:lay.bx; // the top deck runs over the post tops so the top is one clean surface
      for(let j=0;j<bx.length-1;j++){const cuts=deckCuts(bx[j],bx[j+1],D,lay);
        for(let q=0;q<cuts.length-1;q++)P.push(mk('Shelf deck','ply12',[cuts[q+1]-cuts[q],.5,D],[ox+cuts[q],y+rh,0]));}
      for(const sx of lay.sup)for(const z of frontBack){
        if(i>0){const lo=rows[i-1];P.push(mk('Upright',up,[su,lo.th+lo.ab,ud],[ox+sx,lo.y+rb,z]));}
        else if(y0>0)P.push(mk('Foot',up,[su,y0,ud],[ox+sx,0,z]));}
      if(!row.store)for(const b0 of lay.bay)for(let q=0;q<row.c&&placed[i]<row.cnt;q++,placed[i]++){
        const x=b0+q*B/row.c+(B/row.c-row.tx)/2,t=mk('Tank','tank',[row.tx,row.th,row.tz],[ox+x,y+rb,(D-row.tz)/2]);t.gal=row.gal;P.push(t);
        if(p.light>=1){const lz=Math.min(3,row.tz);P.push(mk('Light','light',[Math.max(4,row.tx-4),1,lz],[ox+x+Math.min(2,(row.tx-4)/2),y+rb+row.th+p.clr,(D-lz)/2]));}}
    });
    if(p.brace)for(const b of rackBraces(pl,m)){ // diagonal 1x4 across the back of the section so it cannot lean sideways
      const bw=b.x1-b.x0-3.5,bh=b.y1-b.y0-3.5,len=r16(Math.hypot(bw,bh)),angle=Math.round(Math.atan2(bh,bw)*1800/Math.PI)/10;
      const br=mk('Back brace','1x4',[len,3.5,.75],[ox+(b.x0+b.x1)/2-len/2,(b.y0+b.y1)/2-1.75,-.75]);
      br.rot={k:2,deg:b.rising?angle:-angle};P.push(br);}
    if(p.base==='cabinet')cabinetSkin(P,ox,m,pl,rows[1].y+rb,{doors:true,left:m===mods[0],right:m===mods[mods.length-1],back:!(p.brace&&rackBraces(pl,m).length)});
    ox+=W;}
  return P;
}
/* The step that fastens a rack or stand to the wall studs. `behind` is how far a brace or back panel holds
   the back posts off the wall (0 when they touch it). */
function wallStepText(behind){
  return'Screw the back posts to the wall studs: two 3" screws through each back post into a stud near the top, and two more at mid height. '+
    'Where a post does not land on a stud, screw through the back rail of the top frame into every stud it crosses instead.'+
    (behind>0?` The back posts stand ${fmt(behind)} off the wall, so slip a scrap of wood that thick behind the post at every screw.`:'');
}
/* how the doors of a cabinet base are hung: on the posts and uprights, and on door stiles where a bay has more than one pair */
function doorStepText(pl,doorHeight){
  const stiles=pl.mods.reduce((sum,m)=>sum+cabinetDoors(pl,m).stiles.length,0),paired=pl.B>DOOR_SINGLE_MAX;
  const three=hingesFor(doorHeight)===3;
  return(stiles?`A bay this wide has more than one pair of doors, so first stand ${stiles===1?'a door stile':'the door stiles'} on the bottom deck under the front rail where two pairs meet, and screw ${stiles===1?'it':'each one'} top and bottom. `:'')+
    // The hinges are the concealed cup hinges the program places and lists (hangDoor, js/hanging.js); the sentence
    // names that kind, so the words agree with the lines under them.
    `Hang the doors across the front. Each door swings on ${three?'three concealed cup hinges (top, middle and bottom)':'two concealed cup hinges'}, the full overlay kind, fixed to the post or upright${stiles?' or door stile':''} at its outer side. `+
    CUP_HINGE_HOLE+
    // (how far each hinge is from the ends of its door is read from the model: the hardware line under the step, js/buildsteps.js)
    `Lay a door face down, drill the cup holes along that side, ${three?'one near the top, one near the bottom and the third halfway between':'one near the top and one near the bottom'}, at the distances from the ends of the door that the hardware line under this step gives, and screw a hinge into each. `+
    `Stand the door in place on a scrap 1/2" thick, so it clears the floor, with its hinged side even with the outside of the post, and screw the plates of the hinges to the post. Turn the adjusting screws until the gaps are even. `+
    (paired?'Hang the second door of each pair the same way: the two meet in the middle of the opening with a gap of about 1/8". ':'Leave a gap of about 1/8" between doors. ')+
    `Screw a magnetic catch inside, under the frame above, where the free side of each door closes, and its metal plate to the back of the door. Then drill for the pulls and screw them on.`;
}
/* Fasteners the racks and stands name themselves (joints on the presets; see namedJointType in js/joints.js).
   A lower deck is cut to fit between the posts and only touches them. An upright that stands on a deck cannot be
   screwed from under that deck once the deck is on its frame: it gets pocket screws down through the deck into
   the frame, like the ones at its top. */
const RACK_JOINTS=[['Post','Shelf deck','none','face-edge'],['Shelf deck','Upright','pocket','face-end'],['Shelf deck','Shelf deck','none']];
/* In the single stand every upright stands in a corner against a post and is screwed to it, so it needs no other
   fastener: the frame above rests on it, and is held by the screws through the posts. */
const STAND_JOINTS=[['Post','Shelf deck','none','face-edge'],['Shelf deck','Upright','none'],['Rail','Upright','none'],['Cross piece','Upright','none'],['Shelf deck','Shelf deck','none']];
/* where the lines of uprights go along a section, for the steps: the left edge of each, from the left end of the rail */
function uprightPlaces(pl,kinds){
  return kinds.map(m=>(kinds.length>1?`${fmt(m.W)} wide section: `:'')+rackLayout(pl,m).sup.map(s=>fmt(s-1.5)).join(', ')).join('; ');
}
/* alwaysOnWall: the rack preset is screwed to the wall whatever its height; the cabinet stand only when it must be */
function rackSteps(p,alwaysOnWall,thing){
  thing=thing||'rack'; // what the steps call it: the single stand and the cabinet stand share these steps
  const pl=rackPlan(p);if(!pl)return[];const{rail,up,n,y0,mods,rows}=pl,M0=mods.length,kinds=[];
  for(const m of mods)if(!kinds.some(k=>k.W===m.W))kinds.push(m);
  const pos=kinds.map(m=>(kinds.length>1?`${fmt(m.W)} wide section: `:'')+rackLayout(pl,m).cross.map(c=>fmt(c-1.5)).join(', ')).join('; ');
  const ups=[...new Set(rows.slice(0,-1).map(r=>fmt(r.th+r.ab)))];
  const braces=p.brace?rackBraces(pl,mods[0]):[],braced=braces.length>0,onWall=alwaysOnWall||pl.wall,tankRows=rows.filter(r=>!r.store).length,behind=braced?.75:p.base==='cabinet'?.25:0;
  // frames of different depths, when the rows hold tanks of different depths
  const depths=rows.map(r=>pl.D-2*r.inset),mixed=depths.some(d=>d!==depths[0]);
  const blocked=rows.some((r,i)=>r.inset>0&&i<n-1); // a narrower frame with a row standing above it gets filler blocks
  const doubledRows=rows.map((r,i)=>r.doubled?i+1:0).filter(Boolean);
  const depthWords=(doubledRows.length?` The tanks on row ${doubledRows.join(' and ')} (counted from the bottom) are a little shallower than the rack, so ${doubledRows.length>1?'those frames get':'that frame gets'} doubled rails: glue and screw a second ${rail} rail to the inside of each rail before you fit the cross pieces, which are 3" shorter there. The edges of those tanks sit over the inner rails.`:'')+(mixed?` The frames are not all the same depth, because each tank needs a rail under its front and back edge. Outside of rail to outside of rail, bottom row first: ${depths.map(d=>fmt(d)).join(', ')}.`:'')+
    (blocked?` On a narrower frame that has another row above it, glue and screw a filler block (a ${rail} offcut as long as the frame is set in, on edge like the rail) to the outside of both rails in line with every cross piece that an upright will stand over. The blocks bring the frame out to the full depth there, so the upright above has solid wood under its whole foot.`:'');
  // how the braces run, when one board from corner to corner would be longer than the longest board
  const braceWordsFor=m=>{
    const list=rackBraces(pl,m),farEnd=!list.length||list[0].x1>=m.W-1e-6,top=farEnd?'the post at the other end':`the uprights ${fmt(list[0].x1)} from that end`;
    if(list.length<=1&&farEnd)return'from a bottom corner to the opposite top corner';
    if(list.length===1)return`from the bottom of one end post up to the top of ${top}, which keeps it within your ${pl.board/12} ft boards`;
    return`in ${list.length} lengths that zigzag up the back, because one board from corner to corner would be longer than your ${pl.board/12} ft boards: the first from the bottom of one end post up to ${top}, the next from there back up to the end post, and so on to the top`;
  };
  // sections of different widths may be braced differently: say so for each width
  const braceKinds=[...new Set(kinds.map(braceWordsFor))];
  const braceWords=braceKinds.length===1?braceKinds[0]:kinds.map(m=>`on a ${fmt(m.W)} wide section ${braceWordsFor(m)}`).join('; ');
  const tallSides=p.base==='cabinet'&&n>1&&!fitsSheet(rows[1].y+pl.rb,pl.D); // side panels too big for one sheet
  return[CUT,
   {t:`Build ${n*M0} shelf frames (${n} for ${M0>1?'each of the '+M0+' sections':'the '+thing}). Each one is two ${rail} rails on edge with cross pieces between them. Left edge of each cross piece, measured from the left end of the rail: ${pos}. Glue each joint and drive two 3" screws through the rail into each cross-piece end.`+depthWords,add:['Rail','Cross piece','Filler block']},
   {t:'Glue and screw a plywood deck onto the top of each frame'+(pl.D>SHEET_W?', with every seam between two pieces centered on a cross piece':', with the grain of its face running the length of the rack')+'. The deck spreads the weight of the tanks and keeps the frame square.'+(mixed?` Every deck is the full ${fmt(pl.D)} deep: center the narrower frames under their decks.`:''),add:['Shelf deck']},
   {t:(M0>1?'Build each section as its own rack. ':'')+(y0>0?`Glue a ${up} foot (${fmt(y0)} long) under the bottom frame wherever an upright will stand above it, front and back, with a rail sitting on each foot, and fasten each one with the pocket screws listed below (the pocket holes are drilled in the foot). `:'')+(n>1?`Set the bottom frame ${y0>0?'on its feet':'on the floor'}, deck up. Clamp the four tall posts to the outside of its ends, standing on the floor, and screw them on with the screws listed below. Check with a level that each post is plumb (straight up and down).`
     :`Screw the four short end posts (${fmt(pl.postH)} long) to the outside of the frame's ends, flush with the top of the rails, so the ends of the deck rest on them.`),add:['Foot','Post']},
   ...(n>1?[{t:`Stack upward one row at a time. Stand the ${up} uprights (${ups.length>1?'lengths, bottom row first: '+rows.slice(0,-1).map(r=>fmt(r.th+r.ab)).join(', '):ups[0]+' long'}) on the deck in pairs, one at the front and one at the back${y0>0?', directly above the feet':''}. Left edge of each pair, measured from the left end of the rail: ${uprightPlaces(pl,kinds)}. Screw the end ones to the posts. Fasten the foot of every upright with pocket screws driven down through the deck into the frame under it (the pocket holes are drilled in the upright). Set the next frame on top of the uprights, fasten the top of each upright to it with pocket screws the same way, and screw through the posts into the ends of its rails. Every upright must sit directly above the one below it, and every rail must sit on its uprights, so the weight goes straight to the floor.`,add:['Upright']}]:[]),
   ...(braced?[{t:'Screw a diagonal 1x4 brace across the back of each section, '+braceWords+'. Hold each board in place, mark where it crosses the posts, trim the ends flush, then drive two screws into every post, upright and rail it crosses. This is what stops the '+thing+' from leaning sideways.',add:['Back brace']}]:[]),
   ...(p.base==='cabinet'?[{t:'Close in the cabinet base. '+(tallSides?'Each end is too big for one sheet of plywood, so first stand a 2x4 panel stud flat against the ends of the frames, midway between the two end posts, and screw it to the end cross piece of every frame it passes. The two halves of each side panel meet on it. ':'')+'Glue and nail the thin plywood panels onto the outer ends'+(braced?'':' and the back')+'. '+doorStepText(pl,rows[1].y+pl.rb-1)+' Paint or seal every plywood edge so splashed water cannot soak in.',add:['Panel stud','Side panel','Back panel','Door stile','Door']}]:[]),
   FIN,   // sanding and the finish, before any water comes near it (finText in js/style.js writes the words)
   {t:[`Level the ${thing} with shims.`,
       onWall?wallStepText(behind):'',
       pl.wall?`This ${thing} is too tall for its depth to stand free, so do not fill a tank until it is fastened.`:'',
       M0>1?'Stand the sections side by side and screw or bolt the neighboring posts together.':'',
       tankRows>1?`Mount each light under the shelf above its tank, leaving the ${fmt(p.clr)} of hand room below it; the lights of the top row hang from the ceiling or from a board you fasten to the wall above them.`
         :`Hang each light ${fmt(p.clr)} above its tank, from the ceiling or from a board you fasten to the wall.`,
       RIMLESS_TANK_WORDS+' Fill one tank at a time, bottom row first, and watch for sag or wobble before filling the next.'].filter(Boolean).join(' '),add:['Tank','Light']}];
}
const RIMLESS_TANK_WORDS='Put a foam mat under a rimless tank (one with no plastic frame around its bottom edge).';
const DRIP_LOOP_WORDS='with a drip loop on every cord (let the cord hang down below the outlet before it comes up to it, so water running along the cord drips off instead of reaching the outlet)';

/* The steps of the single aquarium stand, in its own words. It is the smallest rack there is (two frames, four
   posts, four uprights), and the rack's general steps ("stack upward one row at a time", "above the feet") left
   a beginner guessing which frame was which. The frames, the brace and the panels are the rack's own steps; the
   rest is written for the one stand. Shapes the short version does not cover (frames of two depths, doubled
   rails) fall back to the rack's steps. */
/* The top frame of the single stand: its rails, cross pieces and deck. It is built on the floor with the bottom
   frame and lowered onto the uprights later, so its step "brings" it (stampSteps, js/buildsteps.js): the screws
   through the posts into it are then listed in the step that drives them. */
function standTopFrame(piece,parts){
  if(!['Rail','Cross piece','Shelf deck','Filler block'].includes(piece.name))return false;
  const railHeights=parts.filter(p=>p.name==='Rail').map(p=>p.pos[1]);
  const lowest=Math.min(...railHeights),highest=Math.max(...railHeights);
  return highest>lowest+6&&piece.pos[1]>=highest-.01;   // the top rails and everything level with or above them
}
function standSteps(p){
  const a=standArgs(p);
  if(!a)return[];
  const pl=rackPlan(a),rack=rackSteps(a,false,'stand'),skinned=p.under==='cabinet'||p.under==='panels';
  const plain=pl.mods.length===1&&pl.n===2&&!pl.rows.some(row=>row.doubled||row.inset>0);
  const W=pl.mods[0].W,feet=pl.y0>0,lowerTank=p.under==='tank';
  const steps=[CUT];
  if(plain){
    const uprightLength=fmt(pl.rows[0].th+pl.rows[0].ab);
    const onePiece=W<=SHEET_L;       // each deck is one piece of plywood (a longer one is cut in two over a cross piece)
    steps.push(
      {t:rack[1].t.replace(/^Build 2 shelf frames \(2 for the stand\)\./,'Build the two shelf frames. They are alike: one becomes the bottom of the stand and the other the top. (The picture of each step shows the pieces where they end up in the finished stand.)'),add:rack[1].add},
      {t:(onePiece?`Glue and screw the shorter plywood deck (${fmt(W-3)} long) onto one frame, flush with it all round: this is the bottom frame. Glue and screw the longer deck (${fmt(W)} long) onto the other, the top frame, so that it hangs over 1 1/2" at each end. That overhang will rest on the top ends of the posts.`
          :'Glue and screw the plywood decks onto the two frames. The shorter set is flush with its frame all round: that is the bottom frame. The longer set hangs over 1 1/2" at each end of the other frame, the top frame, and will rest on the top ends of the posts. Where two pieces of a deck meet, the seam goes over the middle of a cross piece.')+
          ' Drive a 1 1/4" screw about every 8" into the rails and two into each cross piece. The grain of the plywood face runs the long way. The deck spreads the weight of the tank and keeps the frame square.',add:['Shelf deck']},
      {t:(feet?`Glue a ${pl.up} foot (${fmt(pl.y0)} long) under each corner of the bottom frame, with a rail sitting on each foot, and fasten each one with the pocket screws listed below (the pocket holes are drilled in the foot). Stand the frame on its feet, deck up. `:'Set the bottom frame on the floor, deck up. ')+
          `Stand the four posts (${fmt(pl.postH)} long) on the floor at its corners, each with a wide face flat against the end of the frame and its outer edge flush with the front or the back. Drive two 3" screws through each post into the end of the rail behind it, and two 2 1/2" screws into the cross piece at that end of the frame. Check with a level that each post is plumb (straight up and down). The top frame stays aside until the next step.`,add:['Foot','Post']},
      {t:`Stand the four ${pl.up} uprights (${uprightLength} long) on the bottom deck, one in each corner, each tight against a post, and screw each one to its post with the screws listed below, about one every 8". Lower the top frame onto the uprights, between the posts, deck up: its rails rest on the tops of the uprights, and the ends of its deck rest on the tops of the posts. Fasten it like the bottom frame, with two 3" screws through each post into the end of each rail and two 2 1/2" screws into the end cross piece, then drive two 1 1/4" screws down through the deck into the top of each post. The weight of the tank goes straight down through the uprights to the floor, wood on wood, and not through the screws.`,add:['Upright'],bring:[standTopFrame]});
  }else{
    steps.push(...rack.slice(1).filter(step=>['Rail','Shelf deck','Post','Upright'].some(name=>step.add.includes(name))));
  }
  const brace=rack.find(step=>step.add.includes('Back brace'));
  if(brace)steps.push(brace);
  if(skinned)steps.push({t:'Glue and nail the thin plywood panels onto the back and onto both ends, flush with the top of the stand, with a nail about every 6" into every post, rail, upright and deck edge they cover. Cut a notch or drill holes in the back panel for hoses and cords before you fasten it.',add:['Back panel','Side panel']});
  steps.push(FIN);                   // before the doors go on and before any water comes near it
  if(p.under==='cabinet')steps.push({t:doorStepText(pl,p.standH-1)+' The doors get the same finish as the stand before they are hung, their edges too: a sealed edge keeps splashed water from soaking into the plywood.',add:['Door stile','Door']});
  // a stand more than 4 times as tall as it is deep must be screwed to the wall (rackPlan's wall)
  const wallWords=pl.wall?wallStepText(skinned?.25:.75)+' This stand is too tall for its depth to stand free, so do not fill a tank until it is fastened. ':'';
  const lowerWords=lowerTank?'Set the lower tank on the bottom frame first and mount its light under the top frame; the light of the top tank hangs from the ceiling or sits on the tank. ':'';
  steps.push({t:'Level the stand with shims. '+wallWords+lowerWords+RIMLESS_TANK_WORDS+' Set the tank on top, fill it part way, check for wobble or sag, then finish filling.',add:['Tank','Light']});
  return steps;
}

/* ---------- the warning box: what the numbers in the form cannot do (the preset rule, README.md) ---------- */
/* what each preset's form calls the sizes the messages talk about */
const RACK_FIELDS={W:'Wall width',H:'Height available',maxD:'Max depth from wall',rows:'Number of rows',thing:'rack',lower:'use fewer rows, shorter tanks or less room above them'};
const CABINET_FIELDS={W:'Length available',H:'',maxD:'',rows:'Rows of tanks on top',thing:'cabinet stand',lower:'use fewer rows, shorter tanks, less hand room or a lower cabinet'};
const stop=(text,fix)=>({level:'stop',text,fix});
/* The tank as typed: a size that is missing, or gallons far below what a tank that size holds. The lumber is
   sized from the gallons, so gallons typed too low would build a rack that is too light. */
function tankProblems(p){
  if(!(p.tl>0&&p.td>0&&p.th>0&&p.gal>0))return[stop('The tank needs a length, a front-to-back size, a height and its gallons, all more than zero.','Pick a tank size from the list, or type all four numbers.')];
  const holds=p.tl*p.td*p.th/231;
  if(RACK_RULES.GALLONS_SHARE*holds>RACK_RULES.MAX_GALLONS){ // asking for more gallons than the form takes would be a dead end
    return[stop(`A tank ${fmt(p.tl)} long, ${fmt(p.td)} front to back and ${fmt(p.th)} tall holds about ${Math.round(holds)} gallons. That is more than the ${RACK_RULES.MAX_GALLONS} gallons these wooden designs are worked out for.`,
      'Pick a smaller tank. A tank this big needs a stand designed for it by an engineer.')];
  }
  if(p.gal<RACK_RULES.GALLONS_SHARE*holds-1e-6){
    return[stop(`A tank ${fmt(p.tl)} long, ${fmt(p.td)} front to back and ${fmt(p.th)} tall holds about ${Math.round(holds)} gallons, but Gallons says ${p.gal}. The lumber is sized from the gallons, so this would be built too light for the water.`,
      `Set Gallons to about ${Math.round(holds)}, or correct the tank sizes.`)];
  }
  return[];
}
/* Why no tank fits: the first of depth, width and height that is too small, in the form's own words. */
function rackWhyNothingFits(p,fields){
  const q=rackBase(p),rb=4,base=q.r1==='store'?rb+(+p.storeH||16):0; // with the smallest rail (a 2x4 frame is 4" with its deck)
  // every tank the form names: the main tank and any row given a tank of its own
  const tanks=[{tl:p.tl,td:p.td}];
  for(let i=1;i<=7;i++)if(TANKS[q['r'+i]])tanks.push({tl:TANKS[q['r'+i]][0],td:TANKS[q['r'+i]][1]});
  const several=tanks.length>1,biggest=pick=>Math.max(...tanks.map(pick));
  const ways=[{end:false},{end:true}].filter(w=>p.orient==='auto'||!p.orient||(p.orient==='end')===w.end);
  const deepOf=w=>Math.max(7.5,Math.ceil((biggest(t=>w.end?t.tl:t.td)+1)*4)/4),wideOf=w=>biggest(t=>w.end?t.td:t.tl)+7;
  const depthOk=ways.filter(w=>deepOf(w)<=p.maxD+1e-6);
  if(!depthOk.length){
    const need=Math.min(...ways.map(deepOf));
    return stop(`No tank fits. The rack must be ${fmt(need)} deep for ${several?'the deepest of these tanks':'this tank'} (the tank plus 1"), and ${fields.maxD||'the depth allowed'} is ${fmt(p.maxD)}.`,
      `Allow at least ${fmt(need)} of depth, or pick a tank that is smaller front to back.`);
  }
  const widthOk=depthOk.filter(w=>wideOf(w)<=p.W+1e-6);
  if(!widthOk.length){
    const need=Math.min(...depthOk.map(wideOf));
    return stop(`No tank fits. ${several?'The longest of these tanks':'One tank'} needs ${fmt(need)} of width (the tank, 1" of slack and the posts and uprights at both ends), and ${fields.W} is ${fmt(p.W)}.`,
      `Make ${fields.W} at least ${fmt(need)}, or pick a shorter tank.`);
  }
  const needH=Math.max(base+rb,p.low||0)+p.th+(p.light||0)+(p.clr||0); // the storage space counts toward "Lowest tank off floor"
  if(fields.H&&needH>p.H+1e-6){
    return stop(`No tank fits. One row needs ${fmt(needH)} of height (the frame, the tank, the light and the hand room${base?', on top of the storage space':''}), and ${fields.H} is ${fmt(p.H)}.`,
      `Make ${fields.H} at least ${fmt(up16(needH))}, or reduce the room above the tank.`);
  }
  const forcedUp=upOf(p.up),deepest=Math.max(...widthOk.map(deepOf));
  if(forcedUp&&2*forcedUp[3]>deepest+1e-6){
    return stop(`The ${p.up} uprights you chose are ${fmt(forcedUp[3])} deep. One at the front and one at the back do not fit in a rack ${fmt(deepest)} deep.`,'Set Upright size back to Auto, or pick 2x4.');
  }
  if(q.r1==='store'&&(+p.storeH||16)<RACK_RULES.MIN_STORAGE)return stop(`The storage space is only ${fmt(+p.storeH)} tall.`,`Make it at least ${fmt(RACK_RULES.MIN_STORAGE)} tall.`);
  // The space is big enough for the tank itself, so it is the lumber the tank needs. Plan one row of tanks by
  // hand in all the room the form could ever give, and say what that plan runs into in the room there really is.
  let storageRows=0;
  while(storageRows<7&&q['r'+(storageRows+1)]==='store')storageRows++;
  const oneRow={...p,levels:''+(storageRows+1-(q===p?0:1)),perRow:1,W:600,H:999};
  const roomy=rackPlan(oneRow)||rackPlan({...oneRow,board:192}); // ... and, failing that, with the longest boards there are
  if(roomy){
    const longestTank=Math.max(...RAILS.map(r=>r[3]))-roomy.su-1,board=+p.board||96,railLength=roomy.mods[0].W-3;
    if(!roomy.pastCap&&railLength>board+1e-6)return stop(`No tank fits. The rails under one of these tanks are ${fmt(railLength)} long, longer than the ${board/12} ft boards this is cut from. A rail must be one piece.`,
      fields.H?'Choose a longer board under "Longest board you can haul", or pick a shorter tank.':'Pick a shorter tank.');
    if(roomy.pastCap)return stop(`No tank fits. This ${fields.thing} has uprights only between tanks, never under the middle of one, so its rails would span ${fmt(roomy.span)}. No rail may span more than ${fmt(roomy.capSpan)} under full tanks.`,
      `Pick a tank no longer than ${fmt(longestTank)}.`);
    if(roomy.over)return stop(`No tank fits. This tank is too heavy for a ${fields.thing} with uprights only between tanks: even ${roomy.rail} rails would be at ${pct(roomy.util.rail)} and ${roomy.up} uprights at ${pct(roomy.util.up)} of the rule-of-thumb limit.`,
      'Pick a lighter or shorter tank.');
    if(roomy.tooTall||roomy.postLong)return planProblems(oneRow,roomy,fields)[0];
    if(fields.H&&roomy.need>p.H+.01)return stop(`No tank fits. This tank needs ${roomy.rail} rails to carry it, and with a frame that deep one row needs ${fmtFt(roomy.need)} of height (the frame, the tank, the light and the hand room${base?', on top of the storage space':''}). ${fields.H} is ${fmtFt(p.H)}.`,
      `Make ${fields.H} at least ${fmtFt(up16(roomy.need))}, or reduce the room above the tank.`);
    if(roomy.mods[0].W>p.W+1e-6)return stop(`No tank fits. With ${roomy.up} uprights one tank needs ${fmt(roomy.mods[0].W)} of width, and ${fields.W} is ${fmt(p.W)}.`,
      `Make ${fields.W} at least ${fmt(roomy.mods[0].W)}${upOf(p.up)?', or set Upright size back to Auto':''}.`);
  }
  return stop('No tank fits. With these numbers no rail size in the program carries the tanks: the tank is too long or too heavy for a rack with uprights only between tanks, or the rows do not fit.',
    'Pick a shorter or lighter tank, or change the sizes of the space.');
}
/* Everything a plan that was built cannot do. Shared by the rack, the cabinet stand and the single stand. */
function planProblems(p,pl,fields){
  const found=[];
  if(pl.over){
    const forced=[railOf(p.rail)?`${pl.rail} rails`:'',upOf(p.up)?`${pl.up} uprights`:''].filter(Boolean).join(' and ');
    const worst=pl.util.rail>=pl.util.up?`each rail spans ${fmt(pl.span)} between uprights`:`an upright ${fmt(pl.upLength)} long carries about ${Math.round(pl.upLoad).toLocaleString()} lb and is good for about ${Math.round(pl.upSafe).toLocaleString()} lb`;
    found.push(stop(`Overloaded. ${forced?`With the ${forced} you chose`:'With these rows'}, the ${pl.rail} rails are at ${pct(pl.util.rail)} and the ${pl.up} uprights at ${pct(pl.util.up)} of the rule-of-thumb limit for full tanks (${worst}). Wood loaded past its limit under water that never leaves keeps sagging until it fails.`,
      forced?'Set the rail and upright sizes back to Auto, or pick bigger ones.':'Use fewer rows, or a lighter tank.'));
  }
  if(pl.shallow.length){
    const rowNames=pl.shallow.map(i=>`row ${i} (${pl.rows[i-1].name}, ${fmt(pl.rows[i-1].tz)} front to back)`).join(' and ');
    const fixedUp=upOf(p.up)&&pl.ud<7.25;
    found.push(stop(`The tanks on ${rowNames} are much shallower than the ${fmt(pl.D)} deep rack. Their front and back edges would sit on bare plywood with no rail under them, and a full tank must be carried along its edges by wood.`,
      fixedUp?'Set Upright size back to Auto so the uprights can be made deep enough to carry rails under those tanks.'
        :'Use tanks closer in depth on one rack (within 11" of the deepest), or build that row as its own rack.'));
  }
  if(pl.tooTall){
    found.push(stop(`Too tall for its depth. The ${fields.thing} would stand ${fmtFt(pl.tall)} tall on a base only ${fmt(pl.D)} deep: more than ${RACK_RULES.MAX_RATIO} times as tall as it is deep. Even screwed to the wall, something that slender full of water is not safe.`,
      `Keep it under ${fmtFt(down16(RACK_RULES.MAX_RATIO*pl.D))} tall: ${fields.lower}, or use a tank that is deeper front to back.`));
  }
  if(fields.H&&pl.need>p.H+.01){
    found.push(stop(`The rows you set need ${fmtFt(pl.need)} of height, and ${fields.H} is ${fmtFt(p.H)}.`,`Remove a row, reduce the room above the tanks, or make ${fields.H} at least ${fmtFt(up16(pl.need))}.`));
  }
  // It would stand, but nobody could look after the fish: a tank under another row with no room to reach in.
  const cramped=pl.rows.filter((r,i)=>!r.store&&i<pl.n-1&&r.ab<RACK_RULES.MIN_REACH);
  if(cramped.length){
    found.push({level:'warn',text:`Only ${fmt(cramped[0].ab)} is left between the top of a tank and the shelf above it. That is too little to get a hand, a net or a lid in, so those tanks cannot be fed or cleaned in place.`,
      fix:`Leave at least ${fmt(RACK_RULES.MIN_REACH)} above the tanks (the space for the light plus the hand room), and more for deep tanks.`});
  }
  if(pl.postLong&&!pl.tooTall){
    found.push(stop(`The end posts would be ${fmtFt(pl.postH)} long, longer than the ${pl.board/12} ft boards this is cut from. A post must be one piece.`,
      fields.H?'Use fewer rows, or choose a longer board under "Longest board you can haul".':'Use fewer rows, shorter tanks or a lower cabinet.'));
  }
  return found;
}
/* Fish tank wall / rack, and (through cabArgs) the cabinet stand with a row of tanks */
function rackCheck(p,fields){
  fields=fields||RACK_FIELDS;
  const tank=tankProblems(p);
  if(tank.length)return tank;
  const pl=rackPlan(p);
  return pl?planProblems(p,pl,fields):[rackWhyNothingFits(p,fields)];
}
/* pieces of that name at the back are screwed to the wall studs (see wall in js/verify.js) */
const RACK_WALL=['Post'];
const rackWallIfNeeded=p=>{const pl=rackPlan(p);return pl&&pl.wall?RACK_WALL:[];};

/* Single stand = a two-row rack: a storage shelf below and one tank on top. */
function standArgs(p){
  // An open stand (a shelf or a second tank underneath) has no plywood skin to keep it square, so it gets the
  // diagonal brace across its back. A closed one is braced by its back and side panels.
  const open=p.under==='tank'||p.under==='shelf';
  const a=p.under==='tank'?{...p,W:p.tl+12,H:999,maxD:p.td+2,light:3,clr:Math.max(8,Math.ceil(p.th/2)),low:6,board:192,orient:'long',levels:2,r1:'',r2:'',perRow:1,brace:open}
    :{...p,W:p.tl+12,H:999,maxD:p.td+2,light:0,clr:0,low:0,board:192,orient:'long',levels:2,r1:'store',r2:'',perRow:1,brace:open};
  return rackPlan(a)?a:null;
}
const STAND_FIELDS={W:'',H:'',maxD:'',rows:'',thing:'stand',lower:'make the stand lower or pick a shorter tank'};
/* the lowest stand that leaves MIN_STORAGE of storage between two frames of the smallest rail (2x4, 4" with its deck) */
const STAND_MIN_HEIGHT=2*4+RACK_RULES.MIN_STORAGE,STAND_MAX_HEIGHT=48; // the limits of the form's Stand height
function standCheck(p){
  const tank=tankProblems(p);
  if(tank.length)return tank;
  const a=standArgs(p);
  if(!a){
    if(p.under!=='tank'&&p.standH<STAND_MIN_HEIGHT)return[stop(`A stand ${fmt(p.standH)} tall has no room inside: the two frames take ${fmt(STAND_MIN_HEIGHT-RACK_RULES.MIN_STORAGE)} and the space between them must be at least ${fmt(RACK_RULES.MIN_STORAGE)}.`,`Make the stand at least ${fmt(STAND_MIN_HEIGHT)} tall.`)];
    if(railOf(p.rail))return[stop(`Two frames of ${p.rail} rails do not leave ${fmt(RACK_RULES.MIN_STORAGE)} of space in a stand ${fmt(p.standH)} tall.`,'Make the stand taller, or set Rail size back to Auto.')];
    return[stop('That combination does not work: no rail size in the program fits this tank and this stand height.','Make the stand taller or pick a smaller tank.')];
  }
  const pl=rackPlan(a),found=planProblems(a,pl,STAND_FIELDS);
  // Auto could not fit rails deep enough for the tank into a stand this low: say how tall it has to be
  if(pl.over&&!railOf(p.rail)&&!upOf(p.up)){
    let enough=0;
    for(let h=Math.ceil(p.standH)+1;h<=STAND_MAX_HEIGHT&&!enough&&p.under!=='tank';h++){const taller=rackPlan({...a,standH:h});if(taller&&!taller.over)enough=h;}
    found[0]=enough
      ?stop(`A stand ${fmt(p.standH)} tall is too low for this tank. It weighs about ${Math.round(pl.total).toLocaleString()} lb full and needs deeper rails than fit in that height with ${fmt(RACK_RULES.MIN_STORAGE)} of space between the two frames. With the ${pl.rail} rails that do fit, the rails are at ${pct(pl.util.rail)} of the rule-of-thumb limit.`,`Make the stand at least ${fmt(enough)} tall.`)
      :pl.pastCap
      ?stop(`This tank is too long for a stand held up only at its ends: the rails would span ${fmt(pl.span)}, and no rail may span more than ${fmt(pl.capSpan)} under a full tank.`,`Pick a tank no longer than ${fmt(pl.capSpan-pl.su-1)}. A longer one needs a stand with legs under its middle, which this design does not draw.`)
      :stop(`This tank is too long or too heavy for a stand held up only at its ends: about ${Math.round(pl.total).toLocaleString()} lb across ${fmt(pl.span)}. Even the biggest rail here is past its rule-of-thumb limit (${pct(pl.util.rail)}).`,'Pick a shorter or lighter tank. A tank this size needs a stand with legs under its middle, which this design does not draw.');
  }
  return found;
}
const standWall=p=>{const a=standArgs(p);return a?rackWallIfNeeded(a):[];};
function standNotes(p){const a=standArgs(p);if(!a)return[standCheck(p).map(f=>f.text+' '+f.fix).join(' ')||'That combination does not work.'];
  const skin=p.under==='cabinet'?' The thin panels and the doors add 1/2" to the width and 1" to the depth.':p.under==='panels'?' The thin panels add 1/2" to the width and 1/4" to the depth.':'';
  const pl=rackPlan(a),N=[`The frame of the stand is ${fmtFt(pl.W)} wide × ${fmtFt(pl.D)} deep × ${fmtFt(p.under==='tank'?pl.top:p.standH)} tall, with ${pl.rail} rails and ${pl.up} uprights.`+skin,
   `${p.under==='tank'?'The two filled tanks are':'The filled tank is'} about ${Math.round(pl.total).toLocaleString()} lb (water, glass, gravel). The weight goes straight down through the uprights, not through screws.`];
  if(pl.wall)N.push(wallNote(pl,'stand'));
  N.push(pl.over?`OVERLOADED. The rails are at ${pct(pl.util.rail)} and the uprights at ${pct(pl.util.up)} of the rule-of-thumb limit. Pick a bigger size, set them back to Auto, or make the stand taller so deeper rails fit.`
    :`Load check: rails at ${pct(pl.util.rail)} and uprights at ${pct(pl.util.up)} of the rule-of-thumb limit.`);
  N.push(p.under==='tank'?'Both tanks are counted in the weight above. Leave room to reach into the lower one. With a second tank underneath, the height of the stand comes from the two tanks, not from Stand height.':'The lower shelf is for storage (filter, food, buckets), not a second tank.',
   'Safety: this is a rule-of-thumb estimate, not an engineer\'s certification. Use straight, dry lumber, glue and screw every joint, level the stand with shims, and keep power strips above the floor, '+DRIP_LOOP_WORDS+'.');
  return N;}
/* Cabinet stand = a rack with a closed cabinet base, laid out long side forward and sitting on the floor. */
const cabArgs=p=>({...p,H:999,maxD:60,light:3,low:0,board:'96',orient:'long',brace:false,base:'cabinet'});

/* ---------- self-check of the three fish presets (selfTest in js/selftest.js calls it) ----------
   Beyond the default sizes and the limits of each number, which selfTest tries for every preset, this tries the
   choices of the forms: every tank size in the list, the bases, forced sizes, rows of different tanks. Each must
   come out sound, or be refused with a reason and a fix. The rack's own load check and the structural check
   (js/verify.js) must also agree on what is overloaded. */
/* What a builder would trip over that the structural check does not look at: a piece that cannot be cut from
   the lumber (longer than the longest board, bigger than a sheet of plywood), and an upright that stands on a
   deck with no wood under part of its foot. Returns one sentence for each thing found. */
function fishShopProblems(parts,longestBoard){
  const found=[];
  for(const part of parts){
    const material=M[part.mat];
    if(material.kind==='board'&&part.l>longestBoard+1e-6)found.push(`the ${part.name} is ${fmt(part.l)} long, longer than the ${longestBoard/12} ft boards`);
    if(material.kind==='sheet'&&!fitsSheet(part.l,part.w))found.push(`the ${part.name} is ${fmt(part.l)} x ${fmt(part.w)}, bigger than a sheet of plywood`);
  }
  const boxOf=part=>{const extent=size(part);return{part,lo:part.pos,hi:part.pos.map((v,k)=>v+extent[k])};};
  const shared=(a,b,k)=>Math.max(0,Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k]));
  const boxes=parts.filter(part=>!part.rot&&!part.q).map(boxOf);
  const frameWood=boxes.filter(b=>['Rail','Cross piece','Filler block'].includes(b.part.name));
  for(const upright of boxes.filter(b=>b.part.name==='Upright')){
    // the frame under the deck it stands on (the deck is 1/2" thick); pieces of a frame never overlap each other
    const under=frameWood.filter(wood=>Math.abs(wood.hi[1]-(upright.lo[1]-.5))<.01);
    const carried=under.reduce((sum,wood)=>sum+shared(upright,wood,0)*shared(upright,wood,2),0);
    const foot=(upright.hi[0]-upright.lo[0])*(upright.hi[2]-upright.lo[2]);
    if(carried<.9*foot)found.push(`an Upright stands on a deck with wood under only ${Math.round(100*carried/foot)}% of its foot`);
  }
  return[...new Set(found)];
}
function selfTestFish(problems){
  const say=(what,vals,message)=>problems.push(`fish racks: ${what} ${JSON.stringify(vals)}: ${message}`);
  const named=name=>PRESETS.find(preset=>preset.name===name);
  const rack=named('Fish tank wall / rack'),stand=named('Single aquarium stand'),cabinet=named('Cabinet stand with a row of tanks');
  const argsOf=new Map([[rack,p=>p],[stand,standArgs],[cabinet,cabArgs]]);
  const OVERLOAD_CODES=['span','span-cap','post-load','tank-on-screws'];
  // one set of form values: the preset's defaults, a tank from the list, and the changes
  const valuesFor=(preset,tankKey,changes)=>{
    const tank=TANKS[tankKey],vals={...presetDefaults(preset),size:tankKey,tl:tank[0],td:tank[1],th:tank[2],gal:tank[3],...changes};
    if('clr'in vals&&!('clr'in changes))vals.clr=Math.max(8,Math.ceil(tank[2]/2));
    return vals;
  };
  // builds it and checks it; returns the check, after reporting anything that breaks the preset rule
  const tryOne=(preset,tankKey,changes)=>{
    const what=`${preset.name}, ${tankKey},`,vals=valuesFor(preset,tankKey,changes);
    let check;
    try{check=checkPreset(preset,vals);}
    catch(e){say(what,changes,'it threw "'+e.message+'"');return null;}
    const args=argsOf.get(preset)(vals),plan=args?rackPlan(args):null;
    const overloaded=check.problems.some(f=>f.level==='stop'&&OVERLOAD_CODES.includes(f.code));
    if(plan&&!!plan.over!==overloaded)say(what,changes,`the rack's load check says ${plan.over?'overloaded':'fine'} but the structural check says ${overloaded?'overloaded':'fine'}`);
    if(check.refused){
      if(check.stops.some(f=>f.code==='input'&&!(f.text&&f.fix)))say(what,changes,'refused without a reason and a fix');
      return check;
    }
    if(!check.parts.length){say(what,changes,'built nothing and did not say why');return check;}
    check.problems.forEach(f=>say(what,changes,`${f.level} ${f.code}: ${f.text}`));
    fishShopProblems(check.parts,plan?plan.board:96).forEach(message=>say(what,changes,message));
    const stepsOf=preset.steps||STEPS[preset.name],inSteps=new Set(stepsOf(vals).flatMap(step=>step.add));
    const unnamed=[...new Set(check.parts.map(part=>part.name))].filter(name=>!inSteps.has(name));
    if(unnamed.length)say(what,changes,'pieces never mentioned in the steps: '+unnamed.join(', '));
    return check;
  };
  const RACK_SETUPS=[{W:96},{W:96,low:0,brace:false},{W:96,base:'cabinet',brace:false},{W:96,base:'shelf'},{W:96,levels:'3',rail:'2x4',up:'2x4'},{W:96,H:120,board:'192'},
    {W:120,H:120},                                                          // tall on 8 ft boards: the braces must stay within the board
    {W:60,H:120,maxD:60,orient:'end',base:'cabinet',storeH:48,brace:false}]; // deep and tall: decks and panels must still come out of 4x8 sheets
  const STAND_SETUPS=[{under:'cabinet'},{under:'panels'},{under:'shelf'},{under:'tank'},{under:'cabinet',standH:18},{under:'shelf',rail:'2x4',up:'2x4'}];
  const CABINET_SETUPS=[{levels:'1'},{levels:'2'},{levels:'1',W:144,rail:'2x4'}];
  for(const tankKey of Object.keys(TANKS)){
    RACK_SETUPS.forEach(changes=>tryOne(rack,tankKey,changes));
    STAND_SETUPS.forEach(changes=>tryOne(stand,tankKey,changes));
    CABINET_SETUPS.forEach(changes=>tryOne(cabinet,tankKey,changes));
  }
  // rows of different tanks: the rails move in under the shallower tanks, on uprights deep enough to carry them
  const mixed={W:84,H:96,board:'120',r2:'g10',r3:'g20l'},mixedCheck=tryOne(rack,'g40b',mixed),mixedPlan=rackPlan(valuesFor(rack,'g40b',mixed));
  if(!mixedCheck||mixedCheck.refused||!mixedPlan||mixedPlan.up!=='2x6'||mixedPlan.rows[1].inset!==4)say('mixed rows',mixed,'a 10 gallon row on a 40 gallon breeder rack should be built on 2x6 uprights with its rails 4" in');
  if(mixedCheck&&!mixedCheck.parts.some(part=>part.name==='Filler block'))say('mixed rows',mixed,'the set-in frame of the 10 gallon row has no filler blocks under the uprights of the row above');
  // "Lowest tank off floor" is about the tank: a storage shelf under it counts, so this fits in 5 ft of height
  const lifted={W:48,H:60,base:'shelf',low:36},liftedCheck=tryOne(rack,'g5',lifted);
  const lowestTank=liftedCheck?Math.min(...liftedCheck.parts.filter(part=>part.name==='Tank').map(part=>part.pos[1])):NaN;
  if(!liftedCheck||liftedCheck.refused||lowestTank!==36)say('lowest tank',lifted,'a 5.5 gallon rack with a storage shelf and the lowest tank 36" up should fit under 60", with that tank at 36"');
  const expectRefusal=(preset,tankKey,changes,words)=>{
    const check=tryOne(preset,tankKey,changes);
    if(check&&!(check.refused&&check.stops.some(f=>f.text.includes(words))))say(`${preset.name}, ${tankKey},`,changes,`should be refused with "${words}"`);
  };
  expectRefusal(rack,'g120',{r2:'g5'},'much shallower');                          // a 5.5 gallon tank in the middle of a 25" deep deck
  expectRefusal(rack,'g125',{rail:'2x4'},'Overloaded');                           // a forced rail that cannot carry the tank
  expectRefusal(rack,'g5',{levels:'4',orient:'long',H:120,board:'192'},'Too tall for its depth'); // 7 ft 7" tall on a 9" base
  expectRefusal(rack,'g20h',{levels:'4'},'need');                                 // more rows than the height allows
  expectRefusal(rack,'g20h',{gal:5},'Gallons says');                              // gallons typed far too low for the tank's size
  expectRefusal(stand,'g125',{standH:STAND_MIN_HEIGHT},'too low for this tank');
  expectRefusal(cabinet,'g20h',{levels:'3'},'Too tall for its depth');
  // the wall: the rack is always fastened; a stand only when it is more than 4 times as tall as it is deep
  const onWall=(preset,tankKey,changes)=>presetOptions(preset,valuesFor(preset,tankKey,changes)).wall.includes('Post');
  if(!onWall(rack,'g20h',{}))say('wall',{},'the rack does not declare its back posts as screwed to the wall');
  if(onWall(stand,'g20h',{}))say('wall',{},'a 20 gallon stand 30" tall should be allowed to stand free');
  if(!onWall(stand,'g5',{})||!/wall studs/.test(JSON.stringify(STEPS[stand.name](valuesFor(stand,'g5',{})))))say('wall',{},'a 5.5 gallon stand 30" tall is more than 4 times as tall as deep: it must be on the wall and its steps must say so');
  // narrower than it is deep: a stand for a tank 8" long and 36" front to back would fall over sideways
  const sideways={...presetDefaults(stand),size:'custom',tl:8,td:36,th:36,gal:44.9};
  if(!presetOptions(stand,sideways).wall.includes('Post')||checkPreset(stand,sideways).problems.length)say('wall',{},'a stand 66" tall and 15" wide must be on the wall, and clean once it is');
  expectRefusal(stand,'g5',{size:'custom',tl:96,td:12,th:12,gal:60},'too long for a stand');      // no rail may span 8 ft under a tank
  expectRefusal(rack,'g75',{W:120,H:60,base:'shelf',low:0},'needs 2x6 rails');                    // the reason is the height the deeper rails take
  // sizes that are not on a 1/16": pieces must still meet exactly (no piece drawn into another)
  const odd={...presetDefaults(rack),size:'custom',tl:20.3,td:10.37,th:9.6,gal:8.5,low:5.3,clr:7.7,W:97.3};
  const oddResult=verifyDesign(rack.build(odd),presetOptions(rack,odd));
  if(!oddResult.clean||oddResult.notes.some(note=>note.code==='overlap'))say('odd sizes',{},'a rack with sizes off the 1/16" is not clean: '+oddResult.problems.concat(oddResult.notes).map(f=>f.code).join(', '));
}
