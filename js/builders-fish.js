/* NominalCAD: fish tank rack engine and the single aquarium stand */
'use strict';
/* Fish tank rack engine.
   Auto mode fits as many tanks as it can and sizes the lumber for the water weight; every choice can also be
   forced by hand (rows, tank per row, tanks per row, rail size, upright size), and the load check then reports
   how hard the wood is working. Rule-of-thumb numbers for construction-grade 2x lumber under long-term load,
   deliberately conservative. A wall longer than the boards you can haul is one wall whose rails are joined end
   to end over an upright, or separate sections if the form says so (js/rackjoints.js): every rail piece comes
   from a board you can haul.

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
  // Screws into the wall studs (only for a rack more than WALL_RATIO times as tall as it is deep; one that is not
  // stands free and gets none). Structural screws through the back rail of the TOP frame only, never at mid height:
  // the higher a screw, the longer its lever against tipping. How many is worked out in WALL_SCREW_RULES
  // (js/verify.js, which checks the same numbers on the model): a pull of 200 lb at the top (a person pulling on
  // the rack or climbing it, a bump; its own weight given no credit, for empty tanks and an uneven floor), a
  // factor of safety of 1.5, about 288 lb for one 1/4" structural screw with 2 1/2" of thread in a stud (two
  // thirds of the published withdrawal value for spruce-pine-fir, 115 lb an inch), at least 2, and no point of
  // the top more than 2 ft from a screw, which is a screw into every third stud (studs 16" apart), about every
  // 4 ft. A pull near an end is taken mostly by the screws near that end (wallScrewWorst), so the end screws
  // decide the count: the 10 ft rack with its tanks long side out gets 4 (it had 16). Each separate section is
  // held by its own.
  // rackWallScrewPlan (js/rackwall.js) places them.
  WALL:WALL_SCREW_RULES,
  LEGS_HELD:12,                // feet this tall or taller: the rack is screwed to the wall too, however short it is. Legs that long
                               // with a frame only at their top lean over (the structural check calls it racking): the wall
                               // holds the top of the rack square
  FOOT_MIN:4                   // the shortest foot under a bottom frame: a shorter block cannot take a pocket hole
};
const up16=v=>Math.ceil(v*16-1e-6)/16,down16=v=>Math.floor(v*16+1e-6)/16; // to the next / the last 1/16"
/* what the thin plywood side panels of a cabinet base add to the width, outside the end posts (1/4" each end), so
   that the whole rack, panels and all, is no wider than the width typed */
const sidePanelsWidth=p=>p.base==='cabinet'?.5:0;
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
   Where the rails are joined over a pair of uprights, the door on each side covers the upright on its side (the
   doors meet over the middle of the joint line), so each still hinges on wood.
   A bay with center posts (a long stand) has its doors meet in front of them instead (doorsAroundCenters).
   Returns { doors:[{x, w}], stiles:[x] } with x measured from the left end of the section. */
const DOOR_SINGLE_MAX=20,DOOR_PAIR_MAX=54,DOOR_GAP=.125;
const cabinetDoors=(pl,m)=>rackLayout(pl,m).front;
function doorsAlong(pl,m,lines,bays){
  const doors=[],stiles=[];
  // (the lines that bound the bays; a stand's center posts stand inside a bay, and its doors meet on them: see below)
  const ends=lines.filter(L=>!L.center);
  bays.forEach((b0,j)=>{
    // the stretch of front this bay's doors cover: to the middle of the line of uprights it shares with the next bay
    const left=ends[j],right=ends[j+1];
    const from=j===0?0:left.x+left.w/2,to=j===bays.length-1?m.W:right.x+right.w/2;
    // A bay with center posts (a long stand): the doors meet in front of every center post (doorsAroundCenters)
    const centers=lines.filter(L=>L.center&&L.x>b0-1e-6&&L.x<b0+pl.B+1e-6);
    if(centers.length){doorsAroundCenters(from,to,centers,doors);return;}
    const pairs=pl.B<=DOOR_SINGLE_MAX?0:Math.ceil(pl.B/DOOR_PAIR_MAX-1e-6),count=pairs?2*pairs:1,wide=(to-from-DOOR_GAP*count)/count;
    for(let i=0;i<count;i++)doors.push({x:from+DOOR_GAP/2+i*(wide+DOOR_GAP),w:wide});
    // a door stile where two pairs meet
    for(let q=1;q<pairs;q++)stiles.push(r16(from+q*(to-from)/pairs-.75));
  });
  return{doors,stiles};
}
/* The doors of a bay that has center posts (standCenterLines). The center posts stand at the front like any upright,
   and the doors follow them, the way the center posts of a real stand split its front into door openings (reference
   sheet 08): the front from `from` to `to` is cut at the middle of every center post, so two doors meet in front of
   each one and close against it, and no door has a post standing behind the middle of it. Each stretch gets one door
   hinged at its outer side when it is no wider than DOOR_ONE_SIDE_MAX (a door of a pair in a bay without center posts
   is as wide), else a pair that meets in the middle. The posts are never more than STAND_RULES.most apart, so no
   stretch needs a door stile. Adds {x, w} to doors. */
const DOOR_ONE_SIDE_MAX=29;
function doorsAroundCenters(from,to,centers,doors){
  const cuts=[from,...centers.map(L=>L.x+L.w/2),to];
  for(let s=0;s<cuts.length-1;s++){
    const start=cuts[s],stretch=cuts[s+1]-start;
    const count=stretch<=DOOR_ONE_SIDE_MAX+1e-6?1:2*Math.ceil(stretch/(2*DOOR_ONE_SIDE_MAX)-1e-6);
    const wide=(stretch-DOOR_GAP*count)/count;
    for(let i=0;i<count;i++)doors.push({x:start+DOOR_GAP/2+i*(wide+DOOR_GAP),w:wide});
  }
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
    const storage=pl.rows[0],{seams,nailers}=backSeams(pl,m,H);
    const cuts=[0,...seams,W];
    for(let i=0;i<cuts.length-1;i++)P.push(mk('Back panel','ply14',[cuts[i+1]-cuts[i],H,.25],[ox+cuts[i],0,-.25]));
    // Where no upright stands at a seam, a panel stud stands behind it on the bottom deck. It stops 1/8" under the
    // frame above: it is there to nail the panels to and must not pick up tank weight from the rail over a bay.
    for(const x of nailers)P.push(mk('Panel stud','2x4',[1.5,storage.th+storage.ab-BACK_STUD_GAP,3.5],[ox+x-.75,storage.y+pl.rb,0]));
  }
  if(!o.doors)return;
  const front=cabinetDoors(pl,m),storage=pl.rows[0];
  for(const door of front.doors)P.push(mk('Door','ply34',[door.w,H-1,.75],[ox+door.x,.5,D]));
  // a stile stands on the bottom deck over the front rail and reaches the underside of the frame above, like an upright
  const st=stileStock(pl);
  for(const x of front.stiles)P.push(mk('Door stile',st.mat,[1.5,storage.th+storage.ab,st.deep],[ox+x,storage.y+pl.rb,D-st.deep]));
}
/* Where the thin back panels of a cabinet base meet, from the left end of the section m, for a back H tall.
   A carpenter breaks sheathing on framing, so every seam lands on the middle of a line of uprights (3/4" of
   wood behind each panel edge, more on a joint line), as far along as a sheet reaches. Where no line of uprights
   is within a sheet's reach (a bay wider than a sheet, or a stand with uprights at its ends only), the seam goes
   where the sheet runs out and a panel stud stands behind it (nailers). Returns {seams, nailers}, both on the 1/16". */
const BACK_STUD_GAP=.125;
function backSeams(pl,m,H){
  const longest=H>SHEET_W?SHEET_W:SHEET_L,W=m.W;
  const all=rackLayout(pl,m).lines,lines=all.slice(1,-1).map(L=>r16(L.x+L.w/2));
  const seams=[],nailers=[];
  let start=0;
  for(let guard=0;guard<500&&W-start>longest+1e-6;guard++){
    let seam=lines.filter(x=>x>start+1&&x<=start+longest+1e-6).pop();
    if(seam===undefined){
      // as far as the sheet reaches, with the stud (1 1/2" wide) clear of the next line of uprights
      const next=all.find(L=>L.x+L.w/2>start+longest);
      seam=down16(Math.min(start+longest,next?next.x-.75:Infinity));
      nailers.push(seam);
    }
    seams.push(seam);
    start=seam;
  }
  return{seams,nailers};
}
/* The back panels in words, for the steps: where their seams go, and the panel studs behind seams with no upright. */
function backSeamWords(pl,H){
  const seams=pl.mods.reduce((sum,m)=>sum+backSeams(pl,m,H).seams.length,0),studs=pl.mods.reduce((sum,m)=>sum+backSeams(pl,m,H).nailers.length,0);
  if(!seams)return'';
  return` The back is wider than one sheet, so it is ${seams+pl.mods.length} pieces, and every seam between two of them lands on the middle of an upright${studs?' or a panel stud':''}, so both edges have wood to nail into.`+
    (studs?` Where no upright stands at a seam, first stand a 2x4 panel stud on the bottom deck behind it, narrow edge to the back, cut 1/8" short of the frame above, and screw it to the deck (${studs===1?'one':studs} in all). It is only there to nail the panels to, so it must not carry any of the weight of the tanks.`:'');
}
/* the lumber of a door stile: as the uprights, but never wider than 1 1/2" across (a 2x4 beside 4x4 uprights) */
const stileStock=pl=>pl.su>1.5?{mat:'2x4',deep:3.5}:{mat:pl.up,deep:pl.ud};
/* Hardware that is not wood: door hardware for a cabinet base; the screws into the wall studs, only when it is too
   tall for its depth to stand free (js/rackwall.js works out how many and where); the carriage bolts between
   separate sections; and the screws of the back braces. Placing the preset puts the wall screws and the bolts
   into the model (placeRackHardware), and from then on those are what is listed. gap: how far its back stands
   off the wall (rackWallGap when it is not given). */
function rackHw(p,gap){
  const pl=rackPlan(p),list=[];
  if(!pl)return list;
  if(p.base==='cabinet')list.push(...doorHardware(doorTotal(pl),pl.rows[1].y+pl.rb-1));
  list.push(...wallScrewLines(pl,gap===undefined?rackWallGap(p,pl):gap),...sectionBoltLines(pl),...braceScrewLines(p));
  return list;
}
/* the carriage bolts that join separate sections (rackBoltPlan, js/rackwall.js), one line for each length */
function sectionBoltLines(pl){
  const byLength=new Map();
  for(const bolt of rackBoltPlan(pl))byLength.set(bolt.len,(byLength.get(bolt.len)||0)+1);
  return[...byLength.entries()].map(([length,count])=>[HARDWARE.bolt.buy(length),count]);
}
/* The screws of the diagonal back braces: two through the brace into every post, upright, rail, foot and filler
   block it crosses. A brace is set at an angle, so the program works out no joint for it; they are counted here
   from the pieces it touches (findAngledTies, js/neighbors.js), for the shopping list and the brace step. */
const BRACE_SCREW='#8 × 1-5/8" wood screws',BRACE_SCREWS_EACH=2;
const braceScrewMemo=new Map();
function braceScrewCount(p){
  if(!p.brace)return 0;
  const key=JSON.stringify(p);
  if(braceScrewMemo.has(key))return braceScrewMemo.get(key);
  const parts=buildRack(p);
  const crossed=findAngledTies(parts).filter(tie=>(tie.a.name==='Back brace')!==(tie.b.name==='Back brace')).length;
  if(braceScrewMemo.size>=24)braceScrewMemo.delete(braceScrewMemo.keys().next().value);
  braceScrewMemo.set(key,crossed*BRACE_SCREWS_EACH);
  return crossed*BRACE_SCREWS_EACH;
}
const braceScrewLines=p=>{const n=braceScrewCount(p);return n?[[BRACE_SCREW,n]]:[];};
/* How long a screw into a wall stud must be. It goes through the wood it holds (`through`: a back post is as deep
   as the rack's uprights front to back, a rail 1 1/2"), the gap behind it (`behind`: a brace or a back panel holds
   the back off the wall), about 1/2" of drywall, and then WALL_SCREW_INTO into the stud, but never more than
   WALL_SCREW_MOST into it (a stud is 3 1/2" deep, and the tip must not come out the far side). The lengths are the
   structural screws a home center sells. Returns the length, or the longest that fits when none is in between. */
// WALL_SCREW_INTO is the thread the screws are counted for (WALL_SCREW_RULES.bite, 2 1/2"): a screw that cannot
// reach that far is counted for what it does reach (rackWallScrewPlan, wallScrewHold), and more of them are used
// room (optional): the longest screw wanted. RIGHT_ANGLE_HEAD: how deep a right-angle drill attachment is, so that
// a screw and the attachment fit between the two rails of the top frame (rackWallScrewPlan: where they do not, the
// screw goes in through an access hole in the front rail)
const WALL_SCREW_LENGTHS=[3,3.5,4,5,6,8,10],WALL_SCREW_INTO=WALL_SCREW_RULES.bite,WALL_SCREW_MOST=3.25,DRYWALL=.5,RIGHT_ANGLE_HEAD=1.5;
function wallScrewLength(through,behind,room){
  const toStud=through+behind+DRYWALL,most=Math.min(toStud+WALL_SCREW_MOST,room===undefined?Infinity:room)+1e-6;
  return WALL_SCREW_LENGTHS.find(l=>l>=toStud+WALL_SCREW_INTO-1e-6&&l<=most)||
    WALL_SCREW_LENGTHS.filter(l=>l<=most).pop()||0;
}
/* how far the back of a rack stands off the wall: 3/4" behind a 1x4 brace, 1/4" behind a thin back panel */
function rackWallGap(p,pl){
  const braced=p.brace&&rackBraces(pl,pl.mods[0]).length>0;
  return braced?.75:p.base==='cabinet'?.25:0;
}
const standWallGap=p=>p.under==='cabinet'||p.under==='panels'?.25:.75;
/* the shopping list line of the screws into the wall studs, with their length (wallStepText says the same); none
   for a rack that may stand free. gap: how far its back stands off the wall. */
function wallScrewLines(pl,gap){
  const plan=rackWallScrewPlan(pl,gap);
  if(!plan.screws.length)return[];
  return[[`Screws for the wall studs, ${fmt(plan.len)} structural (through the back rail of the top frame, about every ${ruleLength(WALL_SCREW_RULES.every)})`,plan.screws.length]];
}

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
/* Center posts of a stand (STAND_RULES in js/verify.js, from reference sheet 08). In a bay of B between two lines of
   uprights su across, the extra lines of uprights a stand needs so that no rail runs more than STAND_RULES.most
   between the middles of the uprights under it. They go under a seam between two tanks where there is one (the
   row with the most tanks in a bay decides; a cabinet stand of two 20 gallon tanks gets one pair, right under the
   seam), and otherwise share the bay evenly (a single 48" tank gets one pair under its middle, a 72" tank two).
   rows: the rows of the plan, each with c, its tanks in a bay. Returns {left: the left edge of each, measured from
   the left edge of the bay, span: the longest the rails now run, middle to middle}. A bay short enough gets none. */
function standCenterLines(B,su,rows){
  const most=STAND_RULES.most,end=B+su/2;
  const busiest=rows.filter(row=>!row.store&&row.c>1).sort((a,b)=>b.c-a.c)[0];
  const seams=busiest?Array.from({length:busiest.c-1},(_,q)=>(q+1)*B/busiest.c):[];   // middles, from the bay's left edge
  const middles=[];
  let last=-su/2;   // the middle of the line of uprights on the left of the bay
  for(let guard=0;guard<50&&end-last>most+1e-6;guard++){
    const reachable=seams.filter(x=>x>last+su&&x-last<=most+1e-6);
    // the farthest seam within reach, else an even share of what is left
    const next=reachable.length?reachable[reachable.length-1]:last+(end-last)/Math.ceil((end-last)/most-1e-6);
    middles.push(next);
    last=next;
  }
  const points=[-su/2,...middles,end];
  const span=Math.max(...points.slice(1).map((x,i)=>x-points[i]));
  return{left:middles.map(x=>r16(x-su/2)),span};
}
/* a rack is built as a stand (center posts, STAND_RULES) when a stand preset says so, or on a cabinet base */
const isStandPlan=p=>!!p.stand||p.base==='cabinet';
function rackPlanFresh(p){
  const stand=isStandPlan(p);
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
      // A foot is held by pocket screws from its top into the frame (RACK_JOINTS). A block shorter than
      // RACK_RULES.FOOT_MIN cannot take a pocket hole (it cannot be held in the jig, and the hole would come out
      // at its bottom), so a shorter gap under the bottom frame is made that tall: the tanks sit a little higher
      // than asked, and the notes say so (raised).
      const wanted=r16(Math.max(0,p.low-rb-underTanks)),y0=wanted>0&&wanted<RACK_RULES.FOOT_MIN-1e-6?RACK_RULES.FOOT_MIN:wanted;
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
        for(const B of ok){
          const cmax=Math.max(...tanks.map(r=>Math.floor(B/r.sl+1e-6))),budget=capTanks?Math.ceil(capTanks/cmax):1e9;
          // One wall with its rails joined over uprights, or separate sections (js/rackjoints.js)
          // (the thin side panels of a cabinet base sit outside the end posts: the frame gets what is left of the width)
          const split=rackSplit(p.W-sidePanelsWidth(p),B,su,board,budget,rackBuildOf(p));
          if(!split)continue;
          const{mods,bays,W:Wt}=split;
          const rr=rows.map(r=>{const c=r.store?0:Math.floor(B/r.sl+1e-6);return{...r,c,cnt:Math.min(capTanks||1e9,c*bays)};});
          // a stand gets center posts in a long bay: the rails then span from one to the next (standCenterLines)
          const centers=stand?standCenterLines(B,su,rr):{left:[],span:B+su};
          const count=rr.reduce((a,r)=>a+r.cnt,0),span=centers.span;
          const util={rail:beamCheck({S:Sx,I},span,wmax,'tankRail').ratio,up:upNeed*span};
          const pastCap=carried.length>0&&span>capSpan+1e-6;   // a rail may never span further than its size allows, unless the floor carries it
          const over=util.rail>VERIFY_OVER||util.up>VERIFY_OVER||pastCap;
          const worst=Math.max(util.rail,util.up,pastCap?span/capSpan:0)+shallow.length;
          // It can fall over the way it is narrowest: front to back, or sideways when it is narrower than it is deep
          // (one tall tank turned end-out, or a stand for a tank that is short but deep).
          const narrow=Math.min(D,Wt);
          const pl={worst,narrow,pastCap,capSpan,o:words,end,rows:rr,n:rr.length,D,y0,B,su,ud,rail,rh,rb,up,postMat:ud>3.5?up:'2x4',mods,bays,W:Wt,board,count,manual,span,util,
            raised:y0-wanted,   // how much higher than "Lowest tank off floor" the feet put the tanks (0 almost always)
            build:rackBuildOf(p),doors:p.base==='cabinet'||!!p.doors,   // how it is built along its length; whether it has cabinet doors (they need door stiles in wide bays)
            stand,centers:centers.left,   // built as a stand; the left edges of its center posts in each bay, from the bay's left edge (none in a short bay)
            brace:!!p.brace,    // it gets diagonal back braces (rackBraces; the screws into the wall keep clear of them, js/rackwall.js)
            upLoad:upWorst.load*span,upSafe:upWorst.safe,upLength:upWorst.length, // the hardest-working upright: what it carries, what it may, how long it is
            gallons:rr.reduce((a,r)=>a+r.cnt*r.gal,0),total:rr.reduce((a,r)=>a+r.cnt*r.wt,0),
            over,shallow,flawed:over||shallow.length>0,top,need:last.y+last.pitch,postH,
            tall,ratio,wall:tall/narrow>RACK_RULES.WALL_RATIO+1e-6||y0>=RACK_RULES.LEGS_HELD-1e-6,legsHeld:tall/narrow<=RACK_RULES.WALL_RATIO+1e-6&&y0>=RACK_RULES.LEGS_HELD-1e-6,tooTall:ratio>RACK_RULES.MAX_RATIO+1e-6,postLong:postH>board+1e-6};
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
/* Where things go along one section (m), measured from its left end (worked out once for each section of a plan):
     lines       every line of uprights: {x (left edge), w (width), joint (two rails are joined over it)}
     sup         left edge of every upright (a joint line of 2x4 uprights has two side by side)
     bay         left edge of every bay
     cross       left edge of every cross piece          under  the cross pieces that lie on a line of uprights
     inBay       the cross pieces inside the bays (every 16" or closer, one under every door stile, and one
                 wherever a deck seam needs one: deckSeams in js/rackjoints.js)
     railJoints  where the rails of a row are joined end to end (the middle of each joint line)
     seams       where the decks are cut into pieces; front: the doors and door stiles of a cabinet base
   At a joint line each rail end rests on its upright and is screwed into the end of its own cross piece; the two
   cross pieces lie side by side between the rails, over the uprights (with a 4x4 both over the one upright), so
   they can be screwed to each other. */
const rackLayoutMemo=new WeakMap();
function rackLayout(pl,m){
  const kept=rackLayoutMemo.get(m);
  if(kept&&kept.pl===pl)return kept;
  const{B,su}=pl,{lines,bays}=rackLines(pl,m),sup=[],under=[],railJoints=[],inBay=[];
  for(const L of lines){
    if(L.joint){
      railJoints.push(L.x+L.w/2);
      if(su<3){sup.push(L.x,L.x+su);under.push(L.x,L.x+1.5);}           // two uprights, a cross piece over each
      else{sup.push(L.x);under.push(L.x+L.w/2-1.5,L.x+L.w/2);}          // one 4x4, two cross pieces that meet over its middle
    }else{
      sup.push(L.x);under.push(L.x);
      if(su>1.5)under.push(L.x+su-1.5);
    }
  }
  for(const b0 of bays){
    // the stretches of the bay between its lines of uprights (the center posts of a stand split a bay in two or three)
    const inside=lines.filter(L=>L.center&&L.x>b0&&L.x<b0+B);
    const cuts=[b0,...inside.flatMap(L=>[L.x,L.x+L.w]),b0+B];
    for(let s=0;s<cuts.length;s+=2){
      const from=cuts[s],length=cuts[s+1]-from,nc=Math.ceil(length/16-1e-6)-1;
      for(let q=1;q<=nc;q++)inBay.push(r16(from+q*length/(nc+1)-.75));
    }
  }
  const lay={pl,lines,sup,bay:bays,under,inBay,added:[],railJoints,front:pl.doors?doorsAlong(pl,m,lines,bays):{doors:[],stiles:[]}};
  // A door stile stands on the bottom deck: wood right under it puts wood under its whole foot. Where a cross
  // piece of the bay already lies partly under the stile, that one slides under it (in every frame, so the frames
  // stay alike); two cross pieces are never cut to lie in the same place. Elsewhere the bottom frame gets one
  // more cross piece, right under the stile (only there: in the frame above, the stile stands under the front rail).
  lay.stileCross=[];
  for(const x of lay.front.stiles){
    const overlapping=inBay.findIndex(c=>Math.abs(c-x)<1.5-1e-6);
    if(overlapping>=0){inBay[overlapping]=x;continue;}
    if(!under.some(c=>Math.abs(c-x)<1.5-1e-6))lay.stileCross.push(x);
  }
  lay.seams=deckSeams(pl,m,lay);
  lay.cross=[...new Set([...lay.inBay,...under])].sort((a,b)=>a-b);
  rackLayoutMemo.set(m,lay);
  return lay;
}
/* Plywood comes in 4 ft x 8 ft sheets: SHEET_W, SHEET_L and fitsSheet are in js/core.js. */
/* The diagonal 1x4 braces across the back. Each stretch of the wall between two rail joints (or the whole of a
   section) is braced like a rack of its own, so no brace runs across a joint. One brace from a bottom corner to
   the opposite top corner is best, but a board that long may be longer than the longest board the user can haul.
   Then the brace stops at a line of uprights nearer by, and if that is still too long the height is done in two
   or more braces that zigzag, each within the board length. Every brace ends on a post or a line of uprights; at
   a joint line of two uprights, the brace on the left ends on the left one and the next brace starts on the right
   one. Returns [{x0, x1, y0, y1, rising}]: the box each brace runs corner to corner in; rising = up to the right. */
function rackBraces(pl,m){
  if(pl.n<2)return[];
  const lay=rackLayout(pl,m),su=pl.su,joints=lay.lines.filter(L=>L.joint),out=[];
  const starts=[0,...joints.map(L=>L.x+L.w-su)],ends=[...joints.map(L=>L.x+su),m.W];
  starts.forEach((x0,s)=>{
    // the far end first, then the lines of uprights inside the stretch, far to near
    const inside=lay.lines.filter(L=>!L.joint&&L.x>x0+3.5&&L.x+su<ends[s]-1.6).map(L=>r16(L.x+su)).reverse();
    const reachable=[ends[s],...inside];
    for(let pieces=1;pieces<=8;pieces++){
      const rise=pl.postH/pieces;
      const reach=reachable.find(x=>Math.hypot(x-x0-3.5,rise-3.5)<=pl.board+1e-6);
      if(reach){
        for(let k=0;k<pieces;k++)out.push({x0,x1:reach,y0:r16(k*rise),y1:r16((k+1)*rise),rising:k%2===0,stretch:s});
        break;
      }
    }
  });
  return out;
}
/* What the top of a brace that ends at x1 (rackBraces) is screwed to, in the words of the steps: the end post, or
   the upright of a line of uprights named by its left edge from the left end of the frame, as the upright step
   names them (a brace ends at the right-hand edge of that upright). */
function braceEndName(pl,m,x1){
  if(x1>=m.W-1e-6)return'the right end post';
  const line=rackLayout(pl,m).lines.find(L=>Math.abs(L.x+pl.su-x1)<.02);
  if(!line)return`the upright at ${fmt(r16(x1-pl.su-1.5))}`;
  const at=fmt(r16(line.x-1.5));
  if(!line.joint)return`the uprights at ${at}`;
  return pl.su<3?`the left-hand upright of the rail joint at ${at}`:`the ${pl.up} upright of the rail joint at ${at}`;
}
/* The note on the center posts of a stand (standCenterLines), or '' when it has none. what: "stand", "cabinet stand". */
function centerPostsNote(pl,what){
  const pairs=pl.centers.length*pl.bays;
  if(!pairs)return'';
  const seam=pl.rows.some(row=>!row.store&&row.c>1);
  return`Center posts: ${pairs===1?'one pair of uprights stands':`${pairs} pairs of uprights stand`}, one at the front and one at the back, inside the length of the ${what}${seam?', under the seam between two tanks':', under the middle of the tank'}, so no rail runs more than ${fmt(STAND_RULES.most)} from one upright to the next. A stand ${fmt(STAND_RULES.from)} or longer needs them: a longer span sags over the years and can crack the front glass of a tank.`+
    (pl.doors?' The doors close in front of them.':'');
}
/* A stand saved before stands had center posts. Its pieces are left as they were saved (the person may have built it,
   or changed it by hand), but it must not open as if nothing were wrong: when a design is opened that has a stand
   placed in it which does not yet say it is a stand (S.sets[n].stand, written by placePreset since center posts
   came in) and the structural check stops it for 'center-posts', one line says so and what to do. Undo and redo read
   the same design again, so it is said once for each design opened (oldStandSaidFor). sayOldStand is how the line
   is shown; the self-check standsHaveCenterPosts listens in. */
let sayOldStand=text=>toast(text);
let oldStandSaidFor='';
function oldStandNotice(){
  if(!S.sets||typeof S.sets!=='object')return;
  // (standOfSet, js/verify.js: what its preset declares for the values it was made with; a rack on legs is no stand)
  const old=Object.values(S.sets).filter(set=>set&&typeof set==='object'&&set.stand===undefined&&standOfSet(set));
  if(!old.length)return;
  const key=`${S.name}|${S.parts.length}|${old.map(set=>set.name).join(',')}`;
  if(key===oldStandSaidFor)return;
  oldStandSaidFor=key;
  const found=verifyDesign(S.parts,verifyOptionsOf(S)).problems.some(f=>f.code==='center-posts');
  if(!found)return;
  sayOldStand(`This aquarium stand was saved before long stands got center posts, and it has none: a rail under its tanks runs more than ${fmt(STAND_RULES.most)} between uprights. Check my design explains why. Make the stand again from the presets window to get the center posts, or add them yourself.`);
}
ON_LOAD.push(oldStandNotice);
/* why the tanks stand a little higher than "Lowest tank off floor" (rackPlan's raised) */
const footRaisedWords=pl=>`The feet under the bottom frame are ${fmt(pl.y0)} tall, so the lowest tank sits ${fmt(pl.raised)} higher than "Lowest tank off floor" asks: a block of wood shorter than ${fmt(RACK_RULES.FOOT_MIN)} is too short to drill pocket holes in, and the feet are held on by pocket screws.`;
const pct=v=>Math.round(v*100)+'%';
/* the sentence that says the rack or stand must be screwed to the wall, or '' when it may stand free */
function wallNote(pl,what,gap){
  if(!pl.wall)return'';
  const sideways=pl.narrow<pl.D; // narrower left to right than front to back
  if(pl.legsHeld)return`Fasten it to the wall. It stands on feet ${fmt(pl.y0)} tall, and legs that long with a frame only at their top lean over unless something holds the top square: ${wallScrewWords(pl,gap)}. ${wallScrewWhy(pl,gap)}`;
  return`Fasten it to the wall. At ${fmtFt(pl.tall)} tall on a base ${fmt(pl.narrow)} ${sideways?'wide':'deep'}, this ${what} is more than ${RACK_RULES.WALL_RATIO} times as tall as it is ${sideways?'wide':'deep'}, so it is not safe standing free: ${wallScrewWords(pl,gap)}. ${wallScrewWhy(pl,gap)}`;
}
/* The plain sentence for a rack or stand that may stand free (the owner wanted fewer holes in his wall): it says
   that it needs no screws into the wall and why, with the same numbers wallNote would use. '' when it must be
   fastened. */
function freeStandingNote(pl,what){
  if(pl.wall)return'';
  const sideways=pl.narrow<pl.D;
  const across=sideways?'wide':'deep';
  return`It stands free and needs no screws into the wall: at ${fmtFt(pl.tall)} tall on a base ${fmt(pl.narrow)} ${across}, this ${what} is less than ${RACK_RULES.WALL_RATIO} times as tall as it is ${across}, so its own footprint keeps it from tipping. (A ${what} more than ${RACK_RULES.WALL_RATIO} times as tall as it is ${across} is screwed to the wall studs, and the notes then say how many screws and where.)`;
}
/* The note on the tank lights (the dark bars drawn over the tanks; bought, not wood, not in the cut list). It starts
   with "Lights:" so it is easy to find among the notes: a light hangs under the shelf above its tank, and the top row
   has no shelf over it, so its lights hang from the ceiling or from a board fastened to the wall above the rack.
   Nothing when the design draws no lights. */
function lightsNote(p,pl){
  if(!(p.light>=1))return'';
  const tankRows=pl.rows.filter(row=>!row.store).length;
  const top=tankRows>1?'The top row has no shelf over it: hang its lights from the ceiling, or from a board you fasten to the wall above the rack, at the height drawn.'
    :'Nothing is built over the tanks: hang the lights from the ceiling, or from a board you fasten to the wall above them, at the height drawn.';
  return'Lights: the dark bars over the tanks are the tank lights you buy; they are not wood and are not in the cut list. '+
    (tankRows>1?'Mount each light under the shelf above its tank. ':'')+top;
}
/* Self-check: the tank lights read as light fixtures, not lumber. In the rack as the form starts and in the Single
   aquarium stand with a second tank under it: the lights are drawn solid and dark (not a pale see-through box like
   the glass of a tank), they are not wood (nothing to cut or buy for them), and the notes have the line, starting
   "Lights:", that says the top row's lights hang from the ceiling or from a board on the wall. */
SELFTESTS.push(function tankLightsLookLikeFixtures(problems){
  const wrong=text=>problems.push('tank lights: '+text);
  const light=M.light,shade=new THREE.Color(light.color);
  if(!light.opaque||shade.r+shade.g+shade.b>.75)wrong('a tank light should be drawn as a solid dark bar');
  for(const[name,change]of[['Fish tank wall / rack',{}],['Single aquarium stand',{under:'tank'}]]){
    const preset=PRESETS.find(row=>row.name===name);
    if(!preset){wrong(`${name} is missing`);continue;}
    const vals={...presetDefaults(preset),...change},parts=preset.build(vals),lights=parts.filter(p=>p.name==='Light');
    if(!lights.length){wrong(`${name} draws no lights, so this check proves nothing`);continue;}
    if(!lights.every(p=>p.mat==='light'&&propIsSolid(p)))wrong(`${name}: a light is not drawn as a solid fixture`);
    const withoutLights=lumberToBuy(parts.filter(p=>p.name!=='Light'));
    const buy=lumberToBuy(parts);
    if(buy.boards!==withoutLights.boards||buy.sheets!==withoutLights.sheets||Math.abs(buy.cost-withoutLights.cost)>.01)wrong(`${name}: the lights change the lumber to buy`);
    const note=(preset.notes(vals)||[]).find(line=>/^Lights:/.test(line));
    if(!note||!/ceiling/.test(note)||!/not in the cut list/.test(note))wrong(`${name}: the notes have no "Lights:" line saying where the top row's lights hang`);
  }
});
function rackNotes(p,fields){
  const pl=rackPlan(p);if(!pl)return rackCheck(p,fields).map(f=>f.text+' '+f.fix);
  const psf=Math.round(pl.total/(pl.W*pl.D/144)),M0=pl.mods.length,kinds=new Set(pl.rows.map(r=>r.name));
  const N=[`Holds ${pl.count} tank${pl.count===1?'':'s'} (${Math.round(pl.gallons).toLocaleString()} gallons) on ${pl.n} row${pl.n>1?'s':''}, ${pl.o}.`+
    (kinds.size>1?' Bottom to top: '+pl.rows.map(r=>r.store?'storage shelf':`${r.cnt} × ${r.name}`).join(', ')+'.':` That is ${pl.rows[0].cnt} per row.`)];
  if(pl.over)N.push(`OVERLOADED. With the sizes you forced, the rails are at ${pct(pl.util.rail)} and the uprights at ${pct(pl.util.up)} of the rule-of-thumb limit. Pick a bigger rail or upright, or set them back to Auto.`);
  const thing=(fields||RACK_FIELDS).thing; // "rack" or "cabinet stand"
  N.push(pl.wall?wallNote(pl,thing,rackWallGap(p,pl)):freeStandingNote(pl,thing));
  if(p.base==='shelf')N.push('The bottom level is an open storage shelf for filters, food and buckets. It is not counted as holding water.');
  if(p.base==='cabinet')N.push('The bottom level is a closed cabinet with doors for filters, food and buckets. It is not counted as holding water.');
  // typedLen (js/core.js): under the presets form these repeat the sizes typed in its boxes the way the boxes show them
  if(pl.need>p.H+.01)N.push(`Your rows need ${typedLen(pl.need,fmtFt)} of height, which is more than the ${typedLen(p.H,fmtFt)} available. Remove a row or reduce the room above the tanks.`);
  // how it is built along its length: one frame, one wall with joined rails, or sections (js/rackjoints.js)
  const joined=railJointWords(pl,thing),remark=rackBuildRemark(pl),aBoard=`${pl.board===96?'an':'a'} ${pl.board/12} ft board`;
  const along=M0>1?`, built as ${M0} separate sections side by side (${pl.mods.map(m=>m.nb).join(' + ')} bays), each with its own posts, so no rail is longer than ${aBoard}`
    :joined?`, built as one wall with posts at its two ends only. ${joined} No piece is longer than ${aBoard}`:'';
  N.push(`The ${thing} is ${fmtFt(pl.W+sidePanelsWidth(p))} wide${sidePanelsWidth(p)?' with its side panels':''} × ${fmtFt(pl.D)} deep`+along+`. Top of the highest tank is ${fmtFt(pl.top)} off the floor.`+(remark?' '+remark:''),
   `Filled weight: about ${Math.round(pl.total).toLocaleString()} lb of tanks plus lumber, roughly ${psf} lb per square foot of floor.`,
   `Above every tank there is ${typedLen(p.light)} for the light plus ${typedLen(p.clr)} of open hand room for feeding, netting and cleaning.`+(pl.top>66?' The top row is above eye level, so plan on a step stool to service it.':''));
  const lights=lightsNote(p,pl);
  if(lights)N.push(lights);
  if(pl.raised>0)N.push(footRaisedWords(pl));
  if(!pl.over)N.push(`Load check: ${pl.rail} rails at ${pct(pl.util.rail)} and ${pl.up} uprights at ${pct(pl.util.up)} of the rule-of-thumb limit, with uprights ${pl.centers.length?'no more than ':''}${fmt(r16(pl.span))} apart. The weight goes straight down through wood, not through screws.`);
  const centers=centerPostsNote(pl,thing);
  if(centers)N.push(centers);
  if(joined)N.push(`Where two rail pieces meet, each end sits on ${fmt(pl.su<3?pl.su:pl.su/2)} of upright and is screwed into a cross piece of its own; the two cross pieces are screwed to each other, and the plywood deck runs across the joint. The joints of every row and of the front and back rails are at the same places, not staggered: no rail runs on past a joint (each piece is a span of its own that ends on its own upright), and the uprights of a joint stand straight above the ones below, down to the floor. Staggering them would take a doubled line of uprights under every joint of every row.`);
  if(pl.rows.some(r=>r.doubled))N.push('Some rows hold tanks a little shallower than the rack. Their frames have doubled rails front and back, so the edges of those tanks still sit over wood.');
  if(pl.rows.some(r=>r.inset>0))N.push(`The rows hold tanks of different depths. Each tank must have a rail under its front and back edge, so the frames of the shallower rows are built narrower and the ${pl.up} uprights are deep enough to carry them. The plywood decks are all the full ${fmt(pl.D)} deep.`);
  if(!pl.manual&&!(+p.perRow)&&pl.board<192){const big=rackPlan({...p,board:192});if(big&&big.count>pl.count)N.push(`Tip: if you can haul boards up to 16 ft, the same wall holds ${big.count} tanks. Change "Longest board you can haul".`);}
  N.push('Safety: this is a rule-of-thumb estimate, not an engineer\'s certification. Use straight, dry lumber, glue and screw every joint, '+(pl.wall?'screw it to the wall studs as the steps say so it cannot tip':'level it with shims (it is short enough for its depth to stand free)')+', and put it on a concrete slab or across floor joists against a load-bearing wall. Keep power strips above tank level, '+DRIP_LOOP_WORDS+'.');
  return N;
}
function buildRack(p){
  const pl=rackPlan(p);if(!pl)return[];
  const{D,y0,rows,mods,rail,rh,rb,up,su,ud,B}=pl,P=[],placed=rows.map(()=>0);let ox=0;
  const frontBack=[0,D-ud]; // where the posts and uprights stand, back and front
  for(const m of mods){const lay=rackLayout(pl,m),W=m.W,railRuns=railPieces(lay,m);
    rows.forEach((row,i)=>{const y=row.y,inset=row.inset; // the rails sit under the tank's edges: `inset` in from the back and the front
      // a doubled row has a second rail inside each rail (all four sit on the uprights); the cross pieces fit between
      const railsAt=row.doubled?[0,1.5,D-3,D-1.5]:[inset,D-1.5-inset],frameIn=row.doubled?3:1.5+inset;
      // each rail runs between the posts, in pieces that meet end to end over the joint lines (js/rackjoints.js)
      for(const z of railsAt)for(const[from,to]of railRuns)P.push(mk('Rail',rail,[to-from,rh,1.5],[ox+from,y,z]));
      for(const cx of i===0?lay.cross.concat(lay.stileCross):lay.cross)P.push(mk('Cross piece',rail,[1.5,rh,D-2*frameIn],[ox+cx,y,frameIn]));
      // A frame that is set in stops short of the front and back of the rack, and the uprights stand out there. A
      // filler block on the outside of each rail, at every line of uprights, puts solid wood under the whole foot
      // of the upright above and over the whole top of the upright below (so the top frame too has them: the
      // top of an upright under it would otherwise meet only the 1 1/2" of a rail, and take one pocket screw).
      if(inset>0&&rows.length>1)for(const cx of lay.under)for(const z of[0,D-inset])P.push(mk('Filler block',rail,[1.5,rh,inset],[ox+cx,y,z]));
      // One deck along the whole frame, cut where a sheet runs out, always inside a bay (lay.seams): every upright
      // stands on one piece of plywood, and the plywood runs across the rail joints. The lower decks fit between
      // the posts; the top deck runs over the post tops so the top is one clean surface.
      const top=i===rows.length-1,from=top?0:1.5,to=top?W:W-1.5;
      const cuts=[from,...lay.seams.filter(x=>x>from+1e-6&&x<to-1e-6),to];
      for(let q=0;q<cuts.length-1;q++)P.push(mk('Shelf deck','ply12',[cuts[q+1]-cuts[q],.5,D],[ox+cuts[q],y+rh,0]));
      for(const sx of lay.sup)for(const z of frontBack){
        if(i>0){const lo=rows[i-1];P.push(mk('Upright',up,[su,lo.th+lo.ab,ud],[ox+sx,lo.y+rb,z]));}
        else if(y0>0)P.push(mk('Foot',up,[su,y0,ud],[ox+sx,0,z]));}
      // a door stile carries the front rail above it down to the bottom frame: on feet, a foot goes under it too
      if(i===0&&y0>0){const st=stileStock(pl);for(const x of lay.front.stiles)P.push(mk('Foot',st.mat,[1.5,y0,st.deep],[ox+x,0,D-st.deep]));}
      if(!row.store)for(const b0 of lay.bay)for(let q=0;q<row.c&&placed[i]<row.cnt;q++,placed[i]++){
        const x=b0+q*B/row.c+(B/row.c-row.tx)/2,t=mk('Tank','tank',[row.tx,row.th,row.tz],[ox+x,y+rb,(D-row.tz)/2]);t.gal=row.gal;P.push(t);
        if(p.light>=1){const lz=Math.min(3,row.tz);P.push(mk('Light','light',[Math.max(4,row.tx-4),1,lz],[ox+x+Math.min(2,(row.tx-4)/2),y+rb+row.th+p.clr,(D-lz)/2]));}}
    });
    // The posts come after the frames: of two pieces that meet face to face, a screw goes through the one that comes
    // first in the design, so the screws between a post and the end cross piece or end upright beside it go in from
    // the inside of the rack and the outside of its ends shows no heads (RACK_JOINTS).
    for(const x of[0,W-1.5])for(const z of frontBack)P.push(mk('Post',pl.postMat,[1.5,pl.postH,ud],[ox+x,0,z]));
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
function wallStepText(gap,pl,thing){
  const plan=rackWallScrewPlan(pl,gap),behind=plan.behind||0;
  if(!plan.screws.length)return'';
  // the length is the one on the shopping list (wallScrewLines): through the wood, the gap and the drywall, and 1 1/2" into the stud
  return`Screw the ${thing||'rack'} to the wall studs: ${wallScrewWords(pl,gap)}. Find the studs behind that rail with a stud finder and mark them; drive a ${fmt(plan.len)} structural screw through the rail into the stud nearest each place the line below gives, so that no screw is more than ${ruleLength(WALL_SCREW_RULES.every)} from the next and none more than ${ruleLength(WALL_SCREW_RULES.reach)} from an end${pl.mods.length>1?' of its section (each section is held by its own)':''}. The screws nearest the ends matter most (a pull near an end is taken mostly by them): if the studs are not where the picture puts them, use for each end screw a stud no further from its end than the picture shows, never one further in, and keep the screws between them no more than ${ruleLength(WALL_SCREW_RULES.every)} apart. Keep each one at least ${fmt(WALL_SCREW_FROM_CROSS)} from a cross piece; where one meets a brace behind the rail, drive it through the brace too, 1" from the brace's own screws. `+
    (plan.access
      ?`The head goes on the inside face of the rail, under the top deck, and a screw that long will not fit between the two rails of the top frame: first drill a 3/4" access hole straight through the front rail of the top frame, in the middle of its height and in line with each screw, then put the screw in through that hole and drive it with a 12" long driver bit (fill the holes with 3/4" wood plugs afterward if you like; at the middle of the rail's height they take almost nothing from its strength). `
      :`The head goes on the inside face of the rail, under the top deck: there is not room between the two rails for a drill and a screw that long in line, so use a right-angle drill attachment (a screw this long and the attachment fit between the rails). `)+
    `${wallScrewWhy(pl,gap)} Each screw goes through ${fmt(plan.through)} of wood${behind>0?', the gap behind it':''} and about ${fmt(DRYWALL)} of drywall, and ${fmt(plan.into)} into the stud: buy 1/4" structural screws with at least ${fmt(Math.min(plan.into,WALL_SCREW_INTO))} of thread (the box gives the thread length). With a wall covering thicker than 1/2" drywall, buy them that much longer${plan.access?'':' if they still fit between the rails (if they do not, drill a 3/4" access hole through the front rail of the top frame in line with each screw, and drive them through it with a 12" long driver bit)'}.`+
    (behind>0?` The back rail stands ${fmt(behind)} off the wall (${gap>=.5?'the braces are behind the frame':gap>0?'the thin back panel is behind the frame':'the top frame is set in from the back'}${gap>0&&behind>gap?', and the top frame is set in from the back':''}), so slip a scrap of wood that thick behind the rail at every screw where nothing fills that space, so the screw does not pull the rail back against the wall.`:'');
}
/* Separate sections ("Build it as", js/rackjoints.js) are each built as a rack of their own and joined where the
   rack stands, before it is fastened to the wall. The screws through one end post into the next are the ones
   the model has (the Fasten with line under the step): each section is a part that is set in place in this
   step (bring, js/buildsteps.js), so the joints between two sections are listed here, where they are driven,
   and not in the step that builds the sections. No glue, so the sections can be taken apart to be moved. */
function sectionsJoinStep(pl,thing){
  const spans=[];
  let ox=0;
  for(const m of pl.mods){spans.push([ox,ox+m.W]);ox+=m.W;}
  const last=spans.length-1;
  // a piece belongs to the section its middle is over; the thin side panels just outside the two ends go with theirs
  const sectionOf=index=>piece=>{
    if(piece.name==='Tank'||piece.name==='Light')return false;
    const s=size(piece),middle=piece.pos[0]+s[0]/2,[from,to]=spans[index];
    return middle>=from-(index===0?.5:0)&&middle<to+(index===last?.5:0);
  };
  // the bolts are placed in the model with the preset (placeRackHardware, js/rackwall.js); their line under this
  // step gives the count, the length and where they go (HARDWARE.bolt.line)
  const bolts=rackBoltPlan(pl);
  return{t:`Join the ${pl.mods.length} sections with 3/8" carriage bolts where their end posts meet, ${bolts.length} in all: at every frame one through the back pair of posts and one through the front pair, `+
      `through the end cross pieces of the two frames where they fit, and through the end uprights just under the frame or in the hand room above the tanks where they do not, as the lines below say. `+
      `Once the sections stand together there is no room to hold a drill or swing a hammer in line with a bolt, so drill first: on each end post that meets another section, mark every bolt at the height and the distance from the back that the line below gives, and drill a 7/16" hole there, square to the post, through the post and the piece behind it, from the outside. `+
      `Then stand the sections side by side where the ${thing} will go, in the order they are drawn, with the end posts touching and the holes lined up, and shim each one so its frames are level and line up with the frames of the next. `+
      `Push each bolt in from inside the first section, put a flat washer and a nut on it inside the next, and tighten the nut with a 9/16" wrench until the square neck under the head is pulled into the wood (it keeps the bolt from turning). Use no glue and no screws here: the sections come apart again to be moved by undoing the nuts.`,
    add:[],bring:spans.map((span,index)=>sectionOf(index)),hardware:['bolt']};
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
    // (with center posts the doors follow them, doorsAroundCenters: two doors meet in front of each center post)
    (pl.centers&&pl.centers.length?`Hang the next door the same way (a door that hangs on a center post has its hinged side over the middle of that post instead). Where two doors meet in front of a center post, they close against it: leave a gap of about 1/8" between them, over the middle of the post. `
      :paired?'Hang the second door of each pair the same way: the two meet in the middle of the opening with a gap of about 1/8". ':'Leave a gap of about 1/8" between doors. ')+
    `Screw a magnetic catch inside, under the frame above, where the free side of each door closes, and its metal plate to the back of the door. Then drill for the pulls and screw them on.`;
}
/* Fasteners the racks and stands name themselves (joints on the presets; see namedJointType in js/joints.js).
   A lower deck is cut to fit between the posts and only touches them. An upright that stands on a deck cannot be
   screwed from under that deck once the deck is on its frame: it gets pocket screws down through the deck into
   the frame, like the ones at its top. */
/* A foot stands on the floor under the bottom frame and is held by the pocket screws in its top. The end post
   only stands beside it: screws through the post into the foot would run into those pocket holes.
   Where the rails of one row are joined end to end over a line of uprights (js/rackjoints.js), the two rail
   ends only butt each other: what holds them together is the pair of cross pieces under them, screwed to each
   other, and the plywood deck that runs across the joint. The two feet under such a joint (short blocks, the
   height of the gap under the bottom frame) only stand side by side: each is held by its own pocket screws, and
   screws from one into the other would run into them. */
/* The same fastening in every build style where the style's own suggestion would make screws meet inside the
   wood (fastenersKeepTheirDistance, js/fastenerroom.js):
     - the top and the foot of an upright are held by pocket screws in Rustic too (Rustic would toe-screw them,
       and toe screws cannot be moved aside of the screws of the post and the cross piece at the same corner);
       where they meet a rail or the filler block outside a set-in rail, Fine furniture holds them with an L-bracket instead (bracketInFine, js/joints.js),
       because there the cross pieces' own pocket screws pass the same spot inside the rail;
     - the top deck is screwed down through its ends into the post tops in every style: Fine would put pocket
       holes in the outside face of the end posts, which shows;
     - the end posts of two separate sections only touch: they are joined by carriage bolts (js/rackwall.js).
   The posts are made after the frames (buildRack), so the screws between a post and the end cross piece or end
   upright beside it go in from the inside of the rack, through the cross piece or the upright into the post, and
   the outside of the rack's ends shows no screw heads. */
const RACK_JOINTS=[['Post','Shelf deck','none','face-edge'],['Post','Shelf deck','screw','end-face'],['Shelf deck','Upright','pocket','face-end'],['Shelf deck','Shelf deck','none'],
  ['Post','Foot','none'],['Rail','Rail','none','end-end'],['Foot','Foot','none'],['Post','Post','none'],
  ['Upright','Rail','bracketInFine'],['Foot','Rail','bracketInFine'],['Upright','Cross piece','pocket'],['Foot','Cross piece','pocket'],
  ['Upright','Filler block','bracketInFine'],['Foot','Filler block','bracketInFine']];   // a filler block brings a set-in frame out to the full depth: it is met like a rail
/* In the single stand every upright stands in a corner against a post and is screwed to it, so it needs no other
   fastener: the frame above rests on it, and is held by the screws through the posts. */
const STAND_JOINTS=[['Post','Shelf deck','none','face-edge'],['Shelf deck','Upright','none'],['Rail','Upright','none'],['Cross piece','Upright','none'],['Shelf deck','Shelf deck','none']];
/* A stand long enough for center posts (standCenterLines): those stand in the middle of the length, against no post,
   so like the uprights of a rack they are held by pocket screws at their foot, down through the deck into the
   frame, and at their top into the frame above. The corner ones get the same, besides their screws into the posts. */
const STAND_JOINTS_CENTERS=[['Post','Shelf deck','none','face-edge'],['Shelf deck','Upright','pocket','face-end'],['Upright','Rail','bracketInFine'],
  ['Upright','Cross piece','pocket'],['Upright','Filler block','bracketInFine'],['Shelf deck','Shelf deck','none']];
const standHasCenters=p=>{const a=standArgs(p);return!!a&&rackPlan(a).centers.length>0;};
const standJoints=p=>standHasCenters(p)?STAND_JOINTS_CENTERS:STAND_JOINTS;
/* The thin plywood ends of a cabinet base or a closed stand are nailed on from the outside (there is no other way
   to hold a 1/4" panel), so the brad heads are on the ends: the owner's rule is to hide them or say how to cover
   them. This sentence says how, in the steps that nail those panels on. */
const PANEL_NAIL_HEADS=' The brad heads are on the outside of the ends: unless you want the rough look, set each one a little below the surface with a nail set and fill the holes with wood filler before the finish, so they do not show.';
/* words of a step in each build style, from a function of the style (for styledStep, js/style.js) */
const byStyleWords=say=>({std:say('std'),rustic:say('rustic'),fine:say('fine')});
/* the frame step: the rails are screwed into the ends of the cross pieces, except in Fine furniture, where the
   cross pieces are held by pocket screws from their inside faces and nothing shows on the rails */
const frameWords=(head,tail)=>byStyleWords(style=>head+(style==='fine'
  ?'Glue each joint and drive two pocket screws through each cross-piece end into the rail (the pocket holes on the inside face of the cross piece, so no head shows on the rails).'
  :'Glue each joint and drive two 3" screws through the rail into each cross-piece end.')+tail);
/* where the lines of uprights go along a section, for the steps: the left edge of each, from the left end of the rail */
function uprightPlaces(pl,kinds){
  return kinds.map(m=>(kinds.length>1?`${fmt(m.W)} wide section: `:'')+rackLayout(pl,m).sup.map(s=>fmt(s-1.5)).join(', ')).join('; ');
}
/* The steps of a rack, and of the cabinet stand (thing names it). The second argument is no longer used: every
   rack, stand and cabinet stand is screwed to the wall when it is too tall for its depth to stand free, and only
   then (js/rackwall.js). Steps whose fasteners depend on the build style carry their words per style (styledStep). */
function rackSteps(p,unused,thing){
  thing=thing||'rack'; // what the steps call it: the single stand and the cabinet stand share these steps
  const pl=rackPlan(p);if(!pl)return[];const{rail,up,n,y0,mods,rows}=pl,M0=mods.length,kinds=[];
  for(const m of mods)if(!kinds.some(k=>k.W===m.W))kinds.push(m);
  const pos=kinds.map(m=>(kinds.length>1?`${fmt(m.W)} wide section: `:'')+rackLayout(pl,m).cross.map(c=>fmt(c-1.5)).join(', ')).join('; ');
  const ups=[...new Set(rows.slice(0,-1).map(r=>fmt(r.th+r.ab)))];
  const braces=p.brace?rackBraces(pl,mods[0]):[],braced=braces.length>0,tankRows=rows.filter(r=>!r.store).length,gap=rackWallGap(p,pl);
  // frames of different depths, when the rows hold tanks of different depths
  const depths=rows.map(r=>pl.D-2*r.inset),mixed=depths.some(d=>d!==depths[0]);
  const blocked=n>1&&rows.some(r=>r.inset>0); // a narrower frame gets filler blocks where uprights stand above or below it (buildRack)
  const doubledRows=rows.map((r,i)=>r.doubled?i+1:0).filter(Boolean);
  const depthWords=(doubledRows.length?` The tanks on row ${doubledRows.join(' and ')} (counted from the bottom) are a little shallower than the rack, so ${doubledRows.length>1?'those frames get':'that frame gets'} doubled rails: glue and screw a second ${rail} rail to the inside of each rail before you fit the cross pieces, which are 3" shorter there. The edges of those tanks sit over the inner rails.`:'')+(mixed?` The frames are not all the same depth, because each tank needs a rail under its front and back edge. Outside of rail to outside of rail, bottom row first: ${depths.map(d=>fmt(d)).join(', ')}.`:'')+
    (blocked?` On a narrower frame, glue and screw a filler block (a ${rail} offcut as long as the frame is set in, on edge like the rail) to the outside of both rails in line with every cross piece that stands over a line of uprights. The blocks bring the frame out to the full depth there, so an upright above it has solid wood under its whole foot, and the top of an upright under it meets wood all over.`:'');
  // One wall whose rails are joined end to end (js/rackjoints.js): where the joints are, measured like the cross
  // pieces from the left end of the frame, and what happens at each.
  const wall=mods[0],wallLay=rackLayout(pl,wall),joinedWall=M0===1&&wallLay.railJoints.length>0;
  const fromFrame=list=>listWords(list.map(x=>fmt(r16(x-1.5))));
  const railRuns=railPieces(wallLay,wall).map(([a,b])=>fmt(r16(b-a)));
  const jointWords=joinedWall?` The frames are longer than your ${pl.board/12} ft boards, so each rail is ${railRuns.length} pieces that meet end to end (${lengthsWords(railRuns)}), with ${wallLay.railJoints.length>1?'the joints':'the joint'} at ${fromFrame(wallLay.railJoints)} from the left end of the frame. At each joint two cross pieces lie side by side between the two rails, level with them, one just inside the end of each rail piece${pl.su<3?'':` (they meet over the middle of the ${up} upright that will stand under the joint)`}: screw through each rail end into the end of its own cross piece, then screw the two cross pieces to each other. That is what holds the two rail pieces together; the rail ends themselves rest on the ${pl.su<3?'uprights':'upright'} under the joint.`:'';
  // a cabinet base with wide bays: the bottom frame gets a cross piece under every door stile (rackLayout)
  const stileKinds=kinds.filter(m=>rackLayout(pl,m).stileCross.length);
  const stileWords=stileKinds.length?` The bottom frame gets one more cross piece under each door stile of the cabinet, so the stile stands on wood: at ${stileKinds.map(m=>(kinds.length>1?`on a ${fmt(m.W)} wide section `:'')+fromFrame(rackLayout(pl,m).stileCross)).join('; ')} from the left end of the frame.`:'';
  const stileFeet=y0>0&&mods.some(m=>rackLayout(pl,m).front.stiles.length);
  // where the decks are cut: never over an upright, never over a rail joint (deckSeams, js/rackjoints.js)
  const seamKinds=kinds.filter(m=>rackLayout(pl,m).seams.length);
  const seamWords=seamKinds.length?` Each deck is longer than a sheet of plywood, so it is made of pieces that meet over the middle of a cross piece inside a bay, at ${seamKinds.map(m=>(kinds.length>1?`on a ${fmt(m.W)} wide section `:'')+fromFrame(rackLayout(pl,m).seams)).join('; ')} from the left end of the frame. A seam is never over an upright or a rail joint: every upright then stands on one piece of plywood${joinedWall?', and the plywood runs across the rail joints and ties the rail pieces together':''}.`:'';
  // how the braces run, when one board from corner to corner would be longer than the longest board
  const braceWordsFor=m=>{
    const list=rackBraces(pl,m),farEnd=!list.length||list[0].x1>=m.W-1e-6,top=farEnd?'the post at the other end':braceEndName(pl,m,list[0].x1);
    if(list.length<=1&&farEnd)return'from a bottom corner to the opposite top corner';
    if(list.length===1)return`from the bottom of one end post up to the top of ${top}, which keeps it within your ${pl.board/12} ft boards`;
    return`in ${list.length} lengths that zigzag up the back, because one board from corner to corner would be longer than your ${pl.board/12} ft boards: the first from the bottom of one end post up to ${top}, the next from there back up to the end post, and so on to the top`;
  };
  // sections of different widths may be braced differently: say so for each width
  const braceKinds=[...new Set(kinds.map(braceWordsFor))];
  const braceWords=braceKinds.length===1?braceKinds[0]:kinds.map(m=>`on a ${fmt(m.W)} wide section ${braceWordsFor(m)}`).join('; ');
  // one wall: each length between the rail joints is braced on its own, so no brace crosses a joint
  const wallBraces=joinedWall&&braced?rackBraces(pl,wall):[];
  const lengths=[...new Set(wallBraces.map(b=>b.stretch))].map(s=>wallBraces.filter(b=>b.stretch===s));
  // each length in words: from the bottom of what stands at its left up to the top of what stands at its right,
  // named the way the upright step names the uprights (by their left edge, from the left end of the frame)
  const wallJoints=wallLay.lines.filter(L=>L.joint);
  const lengthWords=(set,s)=>{
    const from=s===0?'the left end post':pl.su<3?`the right-hand upright of the rail joint at ${fmt(r16(wallJoints[s-1].x+pl.su-1.5))}`:`the ${up} upright of the rail joint at ${fmt(r16(wallJoints[s-1].x-1.5))}`;
    const to=braceEndName(pl,wall,set[0].x1);
    return set.length===1?`${s===0?'the first':'the next'} from the bottom of ${from} up to the top of ${to}`
      :`${s===0?'the first':'the next'} in ${set.length} lengths that zigzag up the back between ${from} and ${to}, because one board from corner to corner would be longer than your ${pl.board/12} ft boards`;
  };
  const braceStep=joinedWall
    ?`Screw diagonal 1x4 braces across the back. Each length of the wall between its ends and the rail joints is braced on its own, so no brace crosses a joint: ${lengths.length} brace${lengths.length>1?'s':''}, ${lengths.map(lengthWords).join('; ')} (where an upright is named by a number, that is its left edge from the left end of the frame, as in the step that stands the uprights).`
    :'Screw a diagonal 1x4 brace across the back of each section, '+braceWords+'.';
  const tallSides=p.base==='cabinet'&&n>1&&!fitsSheet(rows[1].y+pl.rb,pl.D); // side panels too big for one sheet
  // the center posts of a stand (standCenterLines): which of the pairs they are, and why
  const centerAt=kinds.map(m=>rackLayout(pl,m).lines.filter(L=>L.center).map(L=>fmt(r16(L.x-1.5)))).filter(list=>list.length);
  const centerWords=centerAt.length?` The ${centerAt.flat().length>1?`pairs at ${listWords([...new Set(centerAt.flat())])} are center posts`:`pair at ${centerAt[0][0]} is a pair of center posts`}: they stand under the middle of a long bay${pl.rows.some(r=>!r.store&&r.c>1)?', under the seam between two tanks,':''} and hold the rails up there, so no rail runs more than ${fmt(STAND_RULES.most)} between uprights and sags under the water over the years.`:'';
  return[CUT,
   styledStep(frameWords(`Build ${n*M0} shelf frames (${n} for ${M0>1?'each of the '+M0+' sections':'the '+thing}). Each one is two ${rail} rails on edge with cross pieces between them. Left edge of each cross piece, measured from the left end of the frame: ${pos}. `,jointWords+stileWords+depthWords),['Rail','Cross piece','Filler block']),
   {t:'Glue and screw a plywood deck onto the top of each frame'+(pl.D>SHEET_W?', with every seam between two pieces centered on a cross piece':', with the grain of its face running the length of the rack')+'. The deck spreads the weight of the tanks and keeps the frame square.'+seamWords+(mixed?` Every deck is the full ${fmt(pl.D)} deep: center the narrower frames under their decks.`:''),add:['Shelf deck']},
   styledStep(byStyleWords(style=>(M0>1?'Build each section as its own rack. ':'')+(y0>0?`Glue a ${up} foot (${fmt(y0)} long) under the bottom frame wherever an upright will stand above it, front and back${stileFeet?', and one under each door stile of the cabinet':''}, with a rail sitting on each foot, and fasten each one ${style==='fine'?'with the L-bracket and the pocket screw listed below (an L-bracket inside the corner where the foot meets the rail, and a pocket screw from the foot up into the cross piece)':'with the pocket screws listed below (the pocket holes are drilled in the foot)'}. `:'')+(n>1?`Set the bottom frame ${y0>0?'on its feet':'on the floor'}, deck up. Clamp the four tall posts to the outside of its ends, standing on the floor, and screw them on with the screws listed below: `+
     (style==='fine'?'they all go in from the inside, through the end cross piece into the post and with pocket screws from the inside face of each rail end into the post, so no screw head shows on the outside of the ends.'
       :'through the end cross piece into the post from the inside, and through the post into the rail ends from the outside (those heads show on the outside of the ends; in the Fine furniture style they are pocket screws driven from the inside).')+
     ' Check with a level that each post is plumb (straight up and down).'
     :`Screw the four short end posts (${fmt(pl.postH)} long) to the outside of the frame's ends, flush with the top of the rails, so the ends of the deck rest on them. Screw the ends of the top deck down into the tops of the posts.`)),['Foot','Post']),
   // (the upper frames were built with the bottom one and are set on the uprights here: the step brings them, so the
   // screws between them and the posts are listed here, where they are driven, and the post step's picture leaves
   // them out)
   ...(n>1?[Object.assign(styledStep(byStyleWords(style=>`Stack upward one row at a time. Stand the ${up} uprights (${ups.length>1?'lengths, bottom row first: '+rows.slice(0,-1).map(r=>fmt(r.th+r.ab)).join(', '):ups[0]+' long'}) on the deck in pairs, one at the front and one at the back${y0>0?', directly above the feet':''}. Left edge of each pair, measured from the left end of the frame: ${uprightPlaces(pl,kinds)}.${centerWords} Screw the end ones to the posts from the inside (through the upright into the post).${joinedWall?(pl.su<3?' Under each rail joint two pairs stand side by side, one under the end of each rail piece: screw the two uprights of each such pair to each other.':` The ${up} upright under a rail joint carries both rail ends, ${fmt(pl.su/2)} each.`):''} `+
     `Fasten the foot of every upright with pocket screws driven down through the deck into the frame under it (the pocket holes are drilled in the upright, with the jig set for 1 1/2" stock; the screws listed below are long enough to go through the 1/2" deck and on into the rail or the cross piece under it, because a short screw would end in the deck, and 1/2" of plywood is too little for a screw to hold in).`+
     `Set the next frame on top of the uprights, fasten the top of each upright to it ${style==='fine'?'with an L-bracket inside the corner where it meets the rail and a pocket screw up into the cross piece':'with pocket screws up into the rail and the cross piece'}, and fasten the ends of its rails to the posts as you did on the bottom frame${style==='fine'?' (pocket screws from the inside)':' (through the posts)'}. When the top frame is on, screw the ends of its deck down into the tops of the posts. Every upright must sit directly above the one below it, and every rail must sit on its uprights, so the weight goes straight to the floor.`),['Upright']),{bring:rows.slice(1).map(row=>upperFrame(row,pl))})]:[]),
   ...(braced?[{t:braceStep+' Hold each board in place, mark where it crosses the posts, trim the ends flush, then drive two screws into every post, upright and rail it crosses. This is what stops the '+thing+' from leaning sideways.',add:['Back brace'],
     fasten:braceScrewCount(p)?[{line:`${fastenerPhrase(braceScrewCount(p),BRACE_SCREW)}: two through the Back brace into every Post, Upright, Rail and Foot it crosses (the brace is set at an angle, so these are counted here).`,uses:[[BRACE_SCREW,braceScrewCount(p)]]}]:[]}]:[]),
   ...(p.base==='cabinet'?[{t:'Close in the cabinet base. '+(tallSides?'Each end is too big for one sheet of plywood, so first stand a 2x4 panel stud flat against the ends of the frames, midway between the two end posts, and screw it to the end cross piece of every frame it passes. The two halves of each side panel meet on it. ':'')+'Glue and nail the thin plywood panels onto the outer ends'+(braced?'':' and the back')+'.'+(braced?'':backSeamWords(pl,rows[1].y+pl.rb))+PANEL_NAIL_HEADS+' '+doorStepText(pl,rows[1].y+pl.rb-1)+' Paint or seal every plywood edge so splashed water cannot soak in.',add:['Panel stud','Side panel','Back panel','Door stile','Door']}]:[]),
   FIN,   // sanding and the finish, before any water comes near it (finText in js/style.js writes the words)
   ...(M0>1?[sectionsJoinStep(pl,thing)]:[]),
   {t:[`Level the ${thing} with shims.`,
       pl.wall?wallStepText(gap,pl,thing):'',
       pl.wall?`${pl.legsHeld?`This ${thing} stands on legs too tall to stay square by themselves`:`This ${thing} is too tall for its depth to stand free`}, so do not fill a tank until it is fastened.`
         :`It is short enough for its depth to stand free, so it needs no screws into the wall.`,
       tankRows>1?`Mount each light under the shelf above its tank, leaving the ${fmt(p.clr)} of hand room below it; the lights of the top row hang from the ceiling or from a board you fasten to the wall above them.`
         :`Hang each light ${fmt(p.clr)} above its tank, from the ceiling or from a board you fasten to the wall.`,
       RIMLESS_TANK_WORDS+' Fill one tank at a time, bottom row first, and watch for sag or wobble before filling the next.'].filter(Boolean).join(' '),add:['Tank','Light'],hardware:['wallscrew']}];
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
/* One frame of a rack above the bottom one (row: a row of rackPlan, pl: the plan): its rails, cross pieces, filler
   blocks and deck, in every section. The frames are all built in one step and each is set on the uprights in the
   stacking step, which "brings" them (stampSteps, js/buildsteps.js), so the screws between a frame and the posts
   are listed in the step that drives them, not in the step that stands the posts. */
const FRAME_PIECES=['Rail','Cross piece','Shelf deck','Filler block'];
const upperFrame=(row,pl)=>piece=>FRAME_PIECES.includes(piece.name)&&piece.pos[1]>=row.y-.01&&piece.pos[1]<=row.y+pl.rh+.01;
/* the rack's frame step in the stand's own words, in every build style */
function standFrameStep(frames){
  const say=text=>text.replace(/^Build 2 shelf frames \(2 for the stand\)\./,'Build the two shelf frames. They are alike: one becomes the bottom of the stand and the other the top. (The picture of each step shows the pieces where they end up in the finished stand.)');
  const step={t:say(frames.t),add:frames.add};
  if(frames.byStyle)step.byStyle=Object.fromEntries(Object.entries(frames.byStyle).map(([style,text])=>[style,say(text)]));
  return step;
}
/* The step of the single stand that stands the uprights and lowers the top frame onto them. A stand long enough for
   center posts (standCenterLines) gets them here too, with the pocket screws that hold every upright at its foot
   and its top (STAND_JOINTS_CENTERS), in the words of each build style. */
function standUprightStep(pl,uprightLength){
  const centerLines=rackLayout(pl,pl.mods[0]).lines.filter(L=>L.center);
  const corners=`Stand the four ${pl.up} uprights (${uprightLength} long) on the bottom deck, one in each corner, each tight against a post, and screw each one to its post with the screws listed below, about one every 8". `;
  const lower=`Lower the top frame onto the uprights, between the posts, deck up: its rails rest on the tops of the uprights, and the ends of its deck rest on the tops of the posts. Fasten it like the bottom frame, with two 3" screws through each post into the end of each rail and two 2 1/2" screws through the end cross piece into the post, then drive two 1 1/4" screws down through the deck into the top of each post. `;
  const weight='The weight of the tank goes straight down through the uprights to the floor, wood on wood, and not through the screws.';
  if(!centerLines.length)return{t:corners+lower+weight,add:['Upright'],bring:[standTopFrame]};
  const places=listWords(centerLines.map(L=>fmt(r16(L.x-1.5))));
  const pairs=centerLines.length===1?'one pair of center posts':`${centerLines.length} pairs of center posts`;
  const say=style=>corners+
    `The stand is ${fmt(pl.W)} long, so it gets ${pairs}: ${pl.up} uprights of the same length, one at the front and one at the back, flush with the front and the back of the frame, with ${centerLines.length===1?'the left edge of the pair':'the left edge of each pair'} at ${places} from the left end of the frame (inside the left posts). They hold the rails up in the middle, so the long span cannot sag over the years and crack the glass of the tank. `+
    `Fasten the foot of every upright with pocket screws driven down through the deck into the frame under it (the pocket holes are drilled in the upright, on its inside face, with the jig set for 1 1/2" stock; the screws listed below are long enough to go through the deck and on into the frame). `+
    lower+
    `Fasten the top of every upright to the top frame ${style==='fine'?'with an L-bracket inside the corner where it meets the rail and a pocket screw up into the cross piece':'with pocket screws up into the rail and the cross piece'}. `+weight;
  return{...styledStep(byStyleWords(say),['Upright']),bring:[standTopFrame]};
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
      standFrameStep(rack[1]),
      {t:(onePiece?`Glue and screw the shorter plywood deck (${fmt(W-3)} long) onto one frame, flush with it all round: this is the bottom frame. Glue and screw the longer deck (${fmt(W)} long) onto the other, the top frame, so that it hangs over 1 1/2" at each end. That overhang will rest on the top ends of the posts.`
          :'Glue and screw the plywood decks onto the two frames. The shorter set is flush with its frame all round: that is the bottom frame. The longer set hangs over 1 1/2" at each end of the other frame, the top frame, and will rest on the top ends of the posts. Where two pieces of a deck meet, the seam goes over the middle of a cross piece.')+
          ' Drive a 1 1/4" screw about every 8" into the rails and two into each cross piece. The grain of the plywood face runs the long way. The deck spreads the weight of the tank and keeps the frame square.',add:['Shelf deck']},
      {t:(feet?`Glue a ${pl.up} foot (${fmt(pl.y0)} long) under each corner of the bottom frame, with a rail sitting on each foot, and fasten each one with the pocket screws listed below (the pocket holes are drilled in the foot). Stand the frame on its feet, deck up. `:'Set the bottom frame on the floor, deck up. ')+
          `Stand the four posts (${fmt(pl.postH)} long) on the floor at its corners, each with a wide face flat against the end of the frame and its outer edge flush with the front or the back. Drive two 3" screws through each post into the end of the rail behind it, and two 2 1/2" screws from the inside through the cross piece at that end of the frame into the post. Check with a level that each post is plumb (straight up and down). The top frame stays aside until the next step.`,add:['Foot','Post']},
      standUprightStep(pl,uprightLength));
  }else{
    steps.push(...rack.slice(1).filter(step=>['Rail','Shelf deck','Post','Upright'].some(name=>step.add.includes(name))));
  }
  const brace=rack.find(step=>step.add.includes('Back brace'));
  if(brace)steps.push(brace);
  if(skinned)steps.push({t:'Glue and nail the thin plywood panels onto the back and onto both ends, flush with the top of the stand, with a nail about every 6" into every post, rail, upright and deck edge they cover.'+backSeamWords(pl,p.standH)+' Cut a notch or drill holes in the back panel for hoses and cords before you fasten it.'+PANEL_NAIL_HEADS,add:['Panel stud','Back panel','Side panel']});
  steps.push(FIN);                   // before the doors go on and before any water comes near it
  if(p.under==='cabinet')steps.push({t:doorStepText(pl,p.standH-1)+' The doors get the same finish as the stand before they are hung, their edges too: a sealed edge keeps splashed water from soaking into the plywood.',add:['Door stile','Door']});
  // a stand more than 4 times as tall as it is deep must be screwed to the wall (rackPlan's wall)
  const wallWords=pl.wall?wallStepText(standWallGap(p),pl,'stand')+' This stand is too tall for its depth to stand free, so do not fill a tank until it is fastened. ':'';
  const lowerWords=lowerTank?'Set the lower tank on the bottom frame first and mount its light under the top frame; the light of the top tank hangs from the ceiling or sits on the tank. ':'';
  steps.push({t:'Level the stand with shims. '+wallWords+lowerWords+RIMLESS_TANK_WORDS+' Set the tank on top, fill it part way, check for wobble or sag, then finish filling.',add:['Tank','Light'],hardware:['wallscrew']});
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
    return[stop(`A tank ${typedLen(p.tl)} long, ${typedLen(p.td)} front to back and ${typedLen(p.th)} tall holds about ${Math.round(holds)} gallons. That is more than the ${RACK_RULES.MAX_GALLONS} gallons these wooden designs are worked out for.`,
      'Pick a smaller tank. A tank this big needs a stand designed for it by an engineer.')];
  }
  if(p.gal<RACK_RULES.GALLONS_SHARE*holds-1e-6){
    return[stop(`A tank ${typedLen(p.tl)} long, ${typedLen(p.td)} front to back and ${typedLen(p.th)} tall holds about ${Math.round(holds)} gallons, but Gallons says ${p.gal}. The lumber is sized from the gallons, so this would be built too light for the water.`,
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
  const deepOf=w=>Math.max(7.5,Math.ceil((biggest(t=>w.end?t.tl:t.td)+1)*4)/4),wideOf=w=>biggest(t=>w.end?t.td:t.tl)+7+sidePanelsWidth(p);
  const depthOk=ways.filter(w=>deepOf(w)<=p.maxD+1e-6);
  if(!depthOk.length){
    const need=Math.min(...ways.map(deepOf));
    // typedLen (js/core.js): a size typed in the form, the size it is held against and the size to type instead
    // are quoted the way the form's boxes show them
    return stop(`No tank fits. The rack must be ${typedLen(need)} deep for ${several?'the deepest of these tanks':'this tank'} (the tank plus 1"), and ${fields.maxD||'the depth allowed'} is ${typedLen(p.maxD)}.`,
      `Allow at least ${typedLen(need)} of depth, or pick a tank that is smaller front to back.`);
  }
  const widthOk=depthOk.filter(w=>wideOf(w)<=p.W+1e-6);
  if(!widthOk.length){
    const need=Math.min(...depthOk.map(wideOf));
    return stop(`No tank fits. ${several?'The longest of these tanks':'One tank'} needs ${typedLen(need)} of width (the tank, 1" of slack and the posts and uprights at both ends${sidePanelsWidth(p)?', and the thin side panels of the cabinet':''}), and ${fields.W} is ${typedLen(p.W)}.`,
      `Make ${fields.W} at least ${typedLen(need)}, or pick a shorter tank.`);
  }
  const needH=Math.max(base+rb,p.low||0)+p.th+(p.light||0)+(p.clr||0); // the storage space counts toward "Lowest tank off floor"
  if(fields.H&&needH>p.H+1e-6){
    return stop(`No tank fits. One row needs ${typedLen(needH)} of height (the frame, the tank, the light and the hand room${base?', on top of the storage space':''}), and ${fields.H} is ${typedLen(p.H)}.`,
      `Make ${fields.H} at least ${typedLen(up16(needH))}, or reduce the room above the tank.`);
  }
  const forcedUp=upOf(p.up),deepest=Math.max(...widthOk.map(deepOf));
  if(forcedUp&&2*forcedUp[3]>deepest+1e-6){
    return stop(`The ${p.up} uprights you chose are ${fmt(forcedUp[3])} deep. One at the front and one at the back do not fit in a rack ${fmt(deepest)} deep.`,'Set Upright size back to Auto, or pick 2x4.');
  }
  if(q.r1==='store'&&(+p.storeH||16)<RACK_RULES.MIN_STORAGE)return stop(`The storage space is only ${typedLen(+p.storeH)} tall.`,`Make it at least ${fmt(RACK_RULES.MIN_STORAGE)} tall.`);
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
      `Pick a tank no longer than ${typedLen(longestTank)}.`);
    if(roomy.over)return stop(`No tank fits. This tank is too heavy for a ${fields.thing} with uprights only between tanks: even ${roomy.rail} rails would be at ${pct(roomy.util.rail)} and ${roomy.up} uprights at ${pct(roomy.util.up)} of the rule-of-thumb limit.`,
      'Pick a lighter or shorter tank.');
    if(roomy.tooTall||roomy.postLong)return planProblems(oneRow,roomy,fields)[0];
    if(fields.H&&roomy.need>p.H+.01)return stop(`No tank fits. This tank needs ${roomy.rail} rails to carry it, and with a frame that deep one row needs ${typedLen(roomy.need,fmtFt)} of height (the frame, the tank, the light and the hand room${base?', on top of the storage space':''}). ${fields.H} is ${typedLen(p.H,fmtFt)}.`,
      `Make ${fields.H} at least ${typedLen(up16(roomy.need),fmtFt)}, or reduce the room above the tank.`);
    const oneWide=roomy.mods[0].W+sidePanelsWidth(p);   // (with the side panels of a cabinet)
    if(oneWide>p.W+1e-6)return stop(`No tank fits. With ${roomy.up} uprights one tank needs ${typedLen(oneWide)} of width, and ${fields.W} is ${typedLen(p.W)}.`,
      `Make ${fields.W} at least ${typedLen(oneWide)}${upOf(p.up)?', or set Upright size back to Auto':''}.`);
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
    found.push(stop(`The rows you set need ${typedLen(pl.need,fmtFt)} of height, and ${fields.H} is ${typedLen(p.H,fmtFt)}.`,`Remove a row, reduce the room above the tanks, or make ${fields.H} at least ${typedLen(up16(pl.need),fmtFt)}.`));
  }
  // It would stand, but nobody could look after the fish: a tank under another row with no room to reach in.
  const cramped=pl.rows.filter((r,i)=>!r.store&&i<pl.n-1&&r.ab<RACK_RULES.MIN_REACH);
  if(cramped.length){
    found.push({level:'warn',text:`Only ${fmt(cramped[0].ab)} is left between the top of a tank and the shelf above it. That is too little to get a hand, a net or a lid in, so those tanks cannot be fed or cleaned in place.`,
      fix:`Leave at least ${fmt(RACK_RULES.MIN_REACH)} above the tanks (the space for the light plus the hand room), and more for deep tanks.`});
  }
  // Too tall for its depth to stand free, and no way found to screw it (or one of its sections) to studs 16" apart
  // strongly enough (rackWallScrewPlan, WALL_SCREW_RULES). Said here in plain words; the structural check refuses it too.
  if(pl.wall&&!pl.tooTall&&p.base!==undefined){
    const gap=rackWallGap(p,pl),plan=rackWallScrewPlan(pl,gap);
    const unheld=pl.mods.filter((m,i)=>!plan.screws.some(s=>s.section===i)).length;
    const setIn=plan.behind>gap+1e-6;   // the top frame is set in from the back (shallower tanks on the top row)
    if(unheld&&setIn){
      found.push(stop(`The ${fields.thing} is too tall for its depth to stand free, so it must be screwed to the wall studs through the back rail of its top frame, but that frame is set in ${fmt(plan.behind-gap)} from the back (the tanks on the top row are shallower than the rest). A screw long enough to cross that gap and still reach into a stud is too long to line up and drive between the two rails of that frame.`,
        'Put tanks on the top row that are as deep as the ones below, or turn the tanks short end out so the rack is deep enough to stand free.'));
    }
    else if(unheld){
      const weak=plan.into<WALL_SCREW_RULES.bite-1e-6;
      found.push(stop(`The ${fields.thing} is too tall for its depth to stand free, so it must be screwed to the wall studs, and the program finds no way to do that strongly enough${pl.mods.length>1?` for ${unheld===pl.mods.length?'its sections':unheld+' of its sections'}`:''}: `+
        (weak?`there is only room for a ${fmt(plan.len)} screw between the rails of the top frame, which reaches ${fmt(Math.max(0,plan.into))} into a stud and holds about ${plan.hold} lb, too little for a pull of ${WALL_SCREW_RULES.pull} lb near an end.`
          :`with studs 16" apart, somewhere along it more than ${ruleLength(WALL_SCREW_RULES.every)} of the top would have every stud behind a cross piece or a rail joint, where a screw cannot go.`),
        weak?'Turn the tanks short end out (a deeper rack may stand free), or use tanks that are deeper front to back.'
          :(RACK_BUILD_FIELD.show(p)&&rackBuildOf(p)!=='sections'?'Choose "Separate sections you can carry" under Build it as (each section is screwed to the studs behind it on its own), or':'Try')+' a wall a few inches shorter or longer, or turn the tanks the other way.'));
    }
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
/* What a rack, stand or cabinet stand declares about the wall (see wall in js/verify.js): when it is too tall for
   its depth to stand free, it is held by the screws into the wall studs that are really in it, and the structural
   check counts them (WALL_BY_SCREWS, WALL_SCREW_RULES); when it is not, nothing (it stands free and gets none). */
const RACK_WALL=[WALL_BY_SCREWS];
const rackWallIfNeeded=p=>{const pl=rackPlan(p);return pl&&pl.wall?RACK_WALL:[];};
/* The wall screws of a preset that is not placed yet, as the structural check takes them (preset.wallScrews), and
   placing its wall screws and section bolts into the design (preset.place, called by placePreset in js/app.js).
   args: the plan's arguments of the form values; gap: how far its back stands off the wall. */
function presetWallScrews(args,gap,parts){
  const pl=args?rackPlan(args):null;
  return pl?wallScrewsInParts(rackWallScrewPlan(pl,gap).screws,parts):[];
}
const rackPresetHooks=(argsOf,gapOf)=>({
  // the joints the hardware placed with the preset holds (the bolts between sections), which RACK_JOINTS names
  // 'none': an old design with no bolts keeps the screws it was saved with there (leftToMissingHardware,
  // js/fasteningupgrade.js)
  hardwareJoints:[['Post','Post']],
  wallScrews:(p,parts)=>{const args=argsOf(p),pl=args&&rackPlan(args);return pl?presetWallScrews(args,gapOf(p,args,pl),parts):[];},
  place:(p,parts)=>{const args=argsOf(p),pl=args&&rackPlan(args);if(pl)placeRackHardware(args,gapOf(p,args,pl),parts);}
});

/* Single stand = a two-row rack: a storage shelf below and one tank on top. */
function standArgs(p){
  // An open stand (a shelf or a second tank underneath) has no plywood skin to keep it square, so it gets the
  // diagonal brace across its back. A closed one is braced by its back and side panels.
  const open=p.under==='tank'||p.under==='shelf';
  // (doors: a cabinet stand gets a door stile in a bay too wide for one pair of doors, with a cross piece under it;
  // a stand long enough for center posts has its doors meet on those instead: doorsAroundCenters)
  const a=p.under==='tank'?{...p,W:p.tl+12,H:999,maxD:p.td+2,light:3,clr:Math.max(8,Math.ceil(p.th/2)),low:6,board:192,orient:'long',levels:2,r1:'',r2:'',perRow:1,brace:open}
    :{...p,W:p.tl+12,H:999,maxD:p.td+2,light:0,clr:0,low:0,board:192,orient:'long',levels:2,r1:'store',r2:'',perRow:1,brace:open};
  a.doors=p.under==='cabinet';
  a.stand=true;   // center posts on a long one (standCenterLines)
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
    if(p.under!=='tank'&&p.standH<STAND_MIN_HEIGHT)return[stop(`A stand ${typedLen(p.standH)} tall has no room inside: the two frames take ${fmt(STAND_MIN_HEIGHT-RACK_RULES.MIN_STORAGE)} and the space between them must be at least ${fmt(RACK_RULES.MIN_STORAGE)}.`,`Make the stand at least ${typedLen(STAND_MIN_HEIGHT)} tall.`)];
    if(railOf(p.rail))return[stop(`Two frames of ${p.rail} rails do not leave ${fmt(RACK_RULES.MIN_STORAGE)} of space in a stand ${typedLen(p.standH)} tall.`,'Make the stand taller, or set Rail size back to Auto.')];
    return[stop('That combination does not work: no rail size in the program fits this tank and this stand height.','Make the stand taller or pick a smaller tank.')];
  }
  const pl=rackPlan(a),found=planProblems(a,pl,STAND_FIELDS);
  // Auto could not fit rails deep enough for the tank into a stand this low: say how tall it has to be
  if(pl.over&&!railOf(p.rail)&&!upOf(p.up)){
    let enough=0;
    for(let h=Math.ceil(p.standH)+1;h<=STAND_MAX_HEIGHT&&!enough&&p.under!=='tank';h++){const taller=rackPlan({...a,standH:h});if(taller&&!taller.over)enough=h;}
    found[0]=enough
      ?stop(`A stand ${typedLen(p.standH)} tall is too low for this tank. It weighs about ${Math.round(pl.total).toLocaleString()} lb full and needs deeper rails than fit in that height with ${fmt(RACK_RULES.MIN_STORAGE)} of space between the two frames. With the ${pl.rail} rails that do fit, the rails are at ${pct(pl.util.rail)} of the rule-of-thumb limit.`,`Make the stand at least ${typedLen(enough)} tall.`)
      :pl.pastCap
      ?stop(`This tank is too long for this stand: the rails would span ${fmt(pl.span)} between uprights, and no rail may span more than ${fmt(pl.capSpan)} under a full tank.`,`Pick a tank no longer than ${typedLen(pl.capSpan-pl.su-1)}.`)
      :stop(`This tank is too heavy for this stand: about ${Math.round(pl.total).toLocaleString()} lb with the rails spanning ${fmt(pl.span)} between uprights${pl.centers.length?' (center posts included)':''}. Even the biggest rail here is past its rule-of-thumb limit (${pct(pl.util.rail)}).`,'Pick a shorter or lighter tank.');
  }
  return found;
}
const standWall=p=>{const a=standArgs(p);return a?rackWallIfNeeded(a):[];};
function standNotes(p){const a=standArgs(p);if(!a)return[standCheck(p).map(f=>f.text+' '+f.fix).join(' ')||'That combination does not work.'];
  const skin=p.under==='cabinet'?' The thin panels and the doors add 1/2" to the width and 1" to the depth.':p.under==='panels'?' The thin panels add 1/2" to the width and 1/4" to the depth.':'';
  const pl=rackPlan(a),N=[`The frame of the stand is ${typedLen(pl.W,fmtFt)} wide × ${typedLen(pl.D,fmtFt)} deep × ${typedLen(p.under==='tank'?pl.top:p.standH,fmtFt)} tall, with ${pl.rail} rails and ${pl.up} uprights.`+skin,
   `${p.under==='tank'?'The two filled tanks are':'The filled tank is'} about ${Math.round(pl.total).toLocaleString()} lb (water, glass, gravel). The weight goes straight down through the uprights, not through screws.`];
  if(pl.wall)N.push(wallNote(pl,'stand',standWallGap(p)));
  N.push(pl.over?`OVERLOADED. The rails are at ${pct(pl.util.rail)} and the uprights at ${pct(pl.util.up)} of the rule-of-thumb limit. Pick a bigger size, set them back to Auto, or make the stand taller so deeper rails fit.`
    :`Load check: rails at ${pct(pl.util.rail)} and uprights at ${pct(pl.util.up)} of the rule-of-thumb limit.`);
  const centers=centerPostsNote(pl,'stand');
  if(centers)N.push(centers);
  const lights=lightsNote(a,pl);
  if(lights)N.push(lights);
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
  // a foot takes pocket holes in its top: a block shorter than FOOT_MIN cannot
  for(const foot of boxes.filter(b=>b.part.name==='Foot'))if(foot.hi[1]-foot.lo[1]<RACK_RULES.FOOT_MIN-1e-6)found.push(`a Foot is only ${fmt(r16(foot.hi[1]-foot.lo[1]))} tall, too short for the pocket holes that hold it`);
  const frameWood=boxes.filter(b=>['Rail','Cross piece','Filler block'].includes(b.part.name));
  // two pieces of a frame cut to lie in the same place (a cross piece under a door stile on top of another one)
  const byLevel=new Map();
  for(const wood of frameWood){const y=Math.round(wood.lo[1]*16);if(!byLevel.has(y))byLevel.set(y,[]);byLevel.get(y).push(wood);}
  for(const level of byLevel.values())for(let i=0;i<level.length;i++)for(let j=i+1;j<level.length;j++){
    const a=level[i],b=level[j];
    if([0,1,2].every(k=>shared(a,b,k)>.01))found.push(`a ${a.part.name} and a ${b.part.name} of one frame overlap by ${fmt(r16(shared(a,b,0)))}`);
  }
  // (a door stile stands on the bottom deck like an upright, and must have wood under it the same way)
  for(const upright of boxes.filter(b=>b.part.name==='Upright'||b.part.name==='Door stile')){
    // the frame under the deck it stands on (the deck is 1/2" thick); pieces of a frame never overlap each other
    const under=frameWood.filter(wood=>Math.abs(wood.hi[1]-(upright.lo[1]-.5))<.01);
    const carried=under.reduce((sum,wood)=>sum+shared(upright,wood,0)*shared(upright,wood,2),0);
    const foot=(upright.hi[0]-upright.lo[0])*(upright.hi[2]-upright.lo[2]);
    if(carried<.9*foot)found.push(`a ${upright.part.name} stands on a deck with wood under only ${Math.round(100*carried/foot)}% of its foot`);
    // and on one piece of plywood: on a seam it would stand half on each piece and take two sets of pocket screws
    const decks=boxes.filter(b=>b.part.name==='Shelf deck'&&Math.abs(b.hi[1]-upright.lo[1])<.01&&shared(upright,b,0)>.01&&shared(upright,b,2)>.01);
    if(decks.length>1)found.push(`a ${upright.part.name} stands on a seam between ${decks.length} pieces of deck`);
  }
  // Where two thin back panels meet, both edges are nailed to wood standing right behind them (an upright, a post
  // or a panel stud, at least 1/2" of it behind each edge; the two uprights of a rail joint, one behind each edge,
  // do too): a free plywood edge does not keep a closed cabinet from leaning.
  const backs=boxes.filter(b=>b.part.name==='Back panel'),standing=boxes.filter(b=>['Upright','Post','Panel stud'].includes(b.part.name));
  for(const panel of backs)for(const other of backs){
    if(other===panel||Math.abs(other.lo[0]-panel.hi[0])>.01||shared(panel,other,1)<.01)continue;
    const seam=panel.hi[0];
    const woodFrom=(a,b)=>standing.some(w=>Math.abs(w.lo[2]-panel.hi[2])<.01&&w.lo[0]<=a+1e-6&&w.hi[0]>=b-1e-6&&shared(w,panel,1)>.01);
    if(!woodFrom(seam-.5,seam)||!woodFrom(seam,seam+.5))found.push(`two Back panels meet ${fmt(r16(seam))} from the left with no upright or panel stud behind the seam to nail them to`);
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
  // (a 125 gallon tank fits on 2x4 frames 14" tall now that a long stand has center posts: a tank twice as heavy does not)
  expectRefusal(stand,'g125',{size:'custom',tl:96,td:24,th:30,gal:300,standH:STAND_MIN_HEIGHT},'too low for this tank');
  expectRefusal(cabinet,'g20h',{levels:'3'},'Too tall for its depth');
  // the wall: a rack or a stand is fastened only when it is more than 4 times as tall as it is deep, and then it is
  // held by the screws into the wall studs that are in it (WALL_BY_SCREWS: js/rackwall.js)
  const onWall=(preset,tankKey,changes)=>presetOptions(preset,valuesFor(preset,tankKey,changes)).wall.includes(WALL_BY_SCREWS);
  if(!onWall(rack,'g20h',{orient:'long'}))say('wall',{},'a rack of 20 gallon tanks long side out, 55" tall on a base 13" deep, does not declare that it is held by its wall screws');
  if(onWall(rack,'g20h',{}))say('wall',{},'the default rack, 55" tall on a base 25" deep, should be allowed to stand free');
  if(onWall(stand,'g20h',{}))say('wall',{},'a 20 gallon stand 30" tall should be allowed to stand free');
  if(!onWall(stand,'g5',{})||!/wall studs/.test(JSON.stringify(STEPS[stand.name](valuesFor(stand,'g5',{})))))say('wall',{},'a 5.5 gallon stand 30" tall is more than 4 times as tall as deep: it must be on the wall and its steps must say so');
  // narrower than it is deep: a stand for a tank 8" long and 36" front to back would fall over sideways
  const sideways={...presetDefaults(stand),size:'custom',tl:8,td:36,th:36,gal:44.9};
  if(!presetOptions(stand,sideways).wall.includes(WALL_BY_SCREWS)||checkPreset(stand,sideways).problems.length)say('wall',{},'a stand 66" tall and 15" wide must be on the wall, and clean once it is');
  // An 8 ft tank was refused ("too long for a stand held up only at its ends"): no rail may span 8 ft under a tank. A
  // long stand now has center posts (STAND_RULES), so it is built, with its rails held up at least every 36".
  const eightFoot={size:'custom',tl:96,td:12,th:12,gal:60},eightCheck=tryOne(stand,'g5',eightFoot),eightPlan=rackPlan(standArgs(valuesFor(stand,'g5',eightFoot)));
  if(!eightCheck||eightCheck.refused||!eightPlan||eightPlan.centers.length<2||eightPlan.span>STAND_RULES.most+1e-6)say('8 ft tank',eightFoot,'a stand for a 96" tank should be built with two pairs of center posts or more, its rails held up at least every 36"');
  expectRefusal(rack,'g75',{W:120,H:60,base:'shelf',low:0},'needs 2x6 rails');                    // the reason is the height the deeper rails take
  // sizes that are not on a 1/16": pieces must still meet exactly (no piece drawn into another)
  const odd={...presetDefaults(rack),size:'custom',tl:20.3,td:10.37,th:9.6,gal:8.5,low:5.3,clr:7.7,W:97.3};
  const oddParts=rack.build(odd),oddResult=verifyDesign(oddParts,{...presetOptions(rack,odd),wallScrews:rack.wallScrews(odd,oddParts)});
  if(!oddResult.clean||oddResult.notes.some(note=>note.code==='overlap'))say('odd sizes',{},'a rack with sizes off the 1/16" is not clean: '+oddResult.problems.concat(oddResult.notes).map(f=>f.code).join(', '));
}
/* The screws into the wall studs reach the stud: the length on the shopping list goes through the wood in front of
   the stud (the back rail of the top frame, both rails where they are doubled), the gap behind it (a brace, a
   back panel, or a top frame set in from the back) and 1/2" of drywall, and then at least 1 1/2" into the stud,
   without coming out of its far side. A 3" screw through a rail that a brace holds 3/4" off the wall once reached
   about 1/4" into the stud. The steps give the same length, and tell the builder to fill a gap behind the rail at
   each screw. Only designs too tall to stand free get them (js/rackwall.js). */
SELFTESTS.push(function wallScrewsReachTheStud(problems){
  const say=text=>problems.push('wall screws: '+text);
  const named=name=>PRESETS.find(preset=>preset.name===name);
  const rack=named('Fish tank wall / rack'),stand=named('Single aquarium stand'),cabinet=named('Cabinet stand with a row of tanks');
  const tankOf=key=>{const t=TANKS[key];return{size:key,tl:t[0],td:t[1],th:t[2],gal:t[3],clr:Math.max(8,Math.ceil(t[2]/2))};};
  // [preset, form values, the plan's arguments, how far the back of the frame stands off the wall]
  const cases=[];
  const onRack=changes=>{const vals={...presetDefaults(rack),orient:'long',...changes};cases.push([rack,vals,vals,rackWallGap(vals,rackPlan(vals))]);};
  onRack({});                                                     // braced: 3/4" off the wall
  onRack({brace:false});                                          // tight to the wall
  onRack({base:'cabinet',brace:false});                           // behind a thin back panel
  onRack({...tankOf('g40b'),levels:'3',H:110,r3:'g10'});          // a top frame of shallower tanks: set in 4" from the back
  const standVals={...presetDefaults(stand),...tankOf('g5')};    // a stand that must be on the wall
  cases.push([stand,standVals,standArgs(standVals),standWallGap(standVals)]);
  const cabinetVals={...presetDefaults(cabinet),levels:'3',...tankOf('g10')};
  if(rackPlan(cabArgs(cabinetVals))&&rackPlan(cabArgs(cabinetVals)).wall)cases.push([cabinet,cabinetVals,cabArgs(cabinetVals),rackWallGap(cabArgs(cabinetVals),rackPlan(cabArgs(cabinetVals)))]);
  let checked=0,setIn=false;
  for(const[preset,vals,args,gap]of cases){
    const what=`${preset.name} ${JSON.stringify(vals).slice(0,60)}`,pl=rackPlan(args);
    if(!pl){say(`${what}: no plan`);continue;}
    if(!pl.wall)continue;   // it stands free: no screws into the wall (wallScrewsAreWorkedOut checks that)
    checked++;
    const plan=rackWallScrewPlan(pl,gap);
    // A top frame set in from the back puts a gap behind its rail: a screw long enough to cross it and reach into
    // a stud cannot be lined up between the rails to be driven (it once was a 10" screw in 8" of room), so the
    // preset refuses it in words, and the structural check refuses it too.
    if(plan.behind>gap+1e-6){
      setIn=true;
      const words=(preset.check(vals)||[]).filter(f=>f.level==='stop').map(f=>f.text).join(' ');
      if(!plan.screws.length&&!/set in .* from the back/.test(words))say(`${what}: a top frame set in from the back gets no screws, and the form does not say why`);
      if(!plan.screws.length)continue;
    }
    const lines=preset.hw(vals).filter(([label])=>/wall studs/.test(label));
    if(lines.length!==1){say(`${what}: the shopping list has ${lines.length} lines of screws for the wall studs, not one`);continue;}
    const steps=(preset.steps||STEPS[preset.name])(vals).map(step=>step.t).join(' ');
    const[label,count]=lines[0],length=parseLen((label.match(/studs, ([^"]+")/)||[])[1]||'');
    const into=length-(plan.through+plan.behind+DRYWALL);
    // as far into the stud as the plan counts it for (WALL_SCREW_INTO where there is room between the rails to
    // drive one that long, less in a shallow rack, which then gets more screws), never out of the far side
    if(!(Math.abs(into-plan.into)<1e-6&&into>0&&into<=WALL_SCREW_MOST+1e-6))say(`${what}: "${label}" reaches ${fmt(Math.max(0,into))} into the stud, the plan counts ${fmt(plan.into)}`);
    // driven with a right-angle attachment between the rails, or through access holes in the front rail when it does not fit
    const between=pl.D-(pl.rows[pl.n-1].doubled?6:3+2*pl.rows[pl.n-1].inset);
    if(!plan.access&&plan.len+RIGHT_ANGLE_HEAD>between+1e-6)say(`${what}: a ${fmt(plan.len)} screw cannot be lined up between the rails of the top frame, and no access holes are planned`);
    if(plan.access&&!/access hole straight through the front rail/.test(steps))say(`${what}: the screws need access holes in the front rail and the wall step does not say so`);
    const check=checkPreset(preset,vals);
    if(check.problems.some(f=>f.code==='wall-screws'))say(`${what}: the structural check finds its screws into the wall too few or too weak`);
    if(!steps.includes(`${fmt(length)} structural screw`))say(`${what}: the steps do not give the ${fmt(length)} of "${label}"`);
    if(count!==plan.screws.length||!(count>=WALL_SCREW_RULES.least))say(`${what}: "${label}" counts ${count}, the plan has ${plan.screws.length}`);
    if(plan.behind>0&&!/scrap of wood that thick behind the rail at every screw/.test(steps))say(`${what}: the rail stands ${fmt(plan.behind)} off the wall and the steps do not say to fill that gap at each screw`);
  }
  if(checked<4)say(`only ${checked} of the cases are too tall to stand free, so the screws were hardly checked`);
  if(!setIn)say('no case with a top frame set in from the back was checked');
});
/* Every upright and foot is held by fasteners a builder can drive. The top of each upright gets at least two
   pocket screws into the frame above (with rows of different depths the top frame is set in, and an upright
   under it once met only the 1 1/2" of a rail and took one); a foot is at least RACK_RULES.FOOT_MIN tall and its
   pocket holes open at least 1" above the floor (a 2" block once had them at 0.1"). */
SELFTESTS.push(function uprightsAndFeetAreHeld(problems){
  const say=text=>problems.push('uprights and feet: '+text);
  const rack=PRESETS.find(preset=>preset.name==='Fish tank wall / rack');
  if(!rack){say('the Fish tank wall / rack preset is missing');return;}
  const tankOf=key=>{const t=TANKS[key];return{size:key,tl:t[0],td:t[1],th:t[2],gal:t[3],clr:Math.max(8,Math.ceil(t[2]/2))};};
  const cases=[{},{low:7},{low:8},{low:5,build:'sections'},
    {...tankOf('g75'),W:200,r2:'g20l',r3:'g10',levels:'3',H:110,maxD:36},
    {...tankOf('g40b'),W:84,H:96,board:'120',r2:'g10',r3:'g20l'}];
  for(const changes of cases){
    const vals={...presetDefaults(rack),...changes},what=JSON.stringify(changes),plan=rackPlan(vals);
    if(!plan){say(`${what}: no plan`);continue;}
    if(plan.y0>0&&plan.y0<RACK_RULES.FOOT_MIN-1e-6)say(`${what}: feet ${fmt(plan.y0)} tall`);
    if(plan.raised>0&&!rackNotes(vals).some(note=>/higher than "Lowest tank off floor"/.test(note)))say(`${what}: the tanks are ${fmt(plan.raised)} higher than asked and the notes do not say why`);
    placePreset(rack,vals,rack.build(vals),false);
    const tops=new Map();
    for(const link of connGraph().links){
      if(!link.joint||!link.fastened)continue;
      for(const f of fastenersOfLink(link)){
        if(f.kind!=='pocket')continue;
        if(f.through.name==='Foot'&&f.pocket.mouth[1]<1-1e-6)say(`${what}: a pocket hole in a foot opens ${fmt(r16(f.pocket.mouth[1]))} above the floor`);
        // the top of an upright: pocket screws into the frame above it
        if(f.through.name==='Upright'&&['Rail','Cross piece','Filler block'].includes(f.into.name))tops.set(f.through,(tops.get(f.through)||0)+1);
      }
    }
    const uprights=S.parts.filter(p=>p.name==='Upright');
    const few=uprights.filter(p=>(tops.get(p)||0)<2);
    if(few.length)say(`${what}: ${few.length} of ${uprights.length} uprights have fewer than two pocket screws at the top (${few.map(p=>tops.get(p)||0).join(', ')})`);
  }
});
/* A door stile (where two pairs of doors meet in a wide bay of a cabinet base) is a piece of the frame: it is not
   put in the Doors with the doors (SUB_BY_NAME, js/components.js), so hanging the doors does not free it from the
   deck and the rail, and it is held by its own fasteners in every style. It was held by nothing: the 125 gallon
   single stand and a rack of 125 gallon tanks on a cabinet base were found "only resting in place". (Since stands
   have center posts, those two cases have their doors meeting on the front center posts instead of on stiles: the
   same is asked of those posts.) */
SELFTESTS.push(function doorStilesAreHeld(problems){
  const say=text=>problems.push('door stiles: '+text);
  const named=name=>PRESETS.find(preset=>preset.name===name);
  const t=TANKS.g125,big={size:'g125',tl:t[0],td:t[1],th:t[2],gal:t[3]};
  const cases=[[named('Single aquarium stand'),{...big,under:'cabinet'}],[named('Fish tank wall / rack'),{...big,orient:'long',base:'cabinet'}]];
  const styleKept=look().style;
  for(const[preset,changes]of cases){
    if(!preset){say('a fish preset is missing');continue;}
    const vals={...presetDefaults(preset),...changes};
    placePreset(preset,vals,preset.build(vals),false);
    // What the doors meet on inside a bay: a door stile, or, on a stand long enough for center posts (all of these
    // cases since stands have them), the front center posts, which the doors follow instead (doorsAroundCenters).
    // Either is a frame piece that must be held and must not be put in the Doors.
    const args=preset.name==='Single aquarium stand'?standArgs(vals):vals,pl=rackPlan(args);
    const centerXs=pl?pl.mods.flatMap((m,i)=>rackLayout(pl,m).lines.filter(L=>L.center).map(L=>pl.mods.slice(0,i).reduce((sum,s)=>sum+s.W,0)+L.x)):[];
    const frontZ=Math.max(...S.parts.filter(p=>p.name==='Upright').map(p=>box(p).hi[2]));
    const frontCenter=p=>p.name==='Upright'&&box(p).hi[2]>=frontZ-.01&&centerXs.some(x=>Math.abs(p.pos[0]-x)<.01);
    const stiles=S.parts.filter(p=>p.name==='Door stile'||frontCenter(p));
    if(!stiles.length){say(`${preset.name}: the case has no door stile or front center post to check`);continue;}
    if(stiles.some(p=>compChain(p.id).some(c=>c.name==='Doors')))say(`${preset.name}: a door stile is put in the Doors`);
    // (the brads of the thin end panels are on the outside of the ends: the steps say how to hide them)
    if(!buildPlan().steps.some(step=>/nail set and fill the holes/.test(step.words)))say(`${preset.name}: the steps do not say how to hide the brad heads on the ends`);
    for(const style of['std','rustic','fine']){
      look().style=style;
      commit();
      const unheld=stiles.filter(p=>!findJoints().some(j=>(j.a.id===p.id||j.b.id===p.id)&&!/door/i.test((j.a.id===p.id?j.b:j.a).name)&&jType(j)!=='none'));
      if(unheld.length)say(`${preset.name} ${style}: ${unheld.length} door stile${unheld.length>1?'s are':' is'} fastened to nothing`);
      const result=verifyDesign(S.parts,designCheckOptions());
      if(result.problems.length)say(`${preset.name} ${style}: the structural check says ${result.problems.map(f=>f.code).join(', ')}`);
    }
  }
  look().style=styleKept;
});
/* Center posts under a long stand (woodworker's eye review, E4; reference sheet 08). A cabinet stand of two 20 gallon
   tanks once stood on uprights at its two ends only, 51 1/2" apart, with the seam between the tanks right over the
   middle of that span, and the structural check passed it. For the three stand designs (the Cabinet stand, the Single
   aquarium stand and the rack on a cabinet base), at the sizes the forms start with and at longer and shorter ones:
     - a stand STAND_RULES.from long or longer has no rail under tanks that runs more than STAND_RULES.most from one
       upright to the next, and each pair of center posts has an upright at the front and one at the back;
     - where a center post was needed in a bay that holds two tanks or more, it stands under a seam between two tanks;
     - a stand up to 36" long gets none (the sheet: none up to 36");
     - the same stand with its center posts taken out is refused by the structural check, with the code 'center-posts',
       and so is a stand saved before stands said so (its set has no `stand`): Check my design finds it;
     - the doors still hang on hinges, and every door opens all the way without hitting a center post. */
SELFTESTS.push(function standsHaveCenterPosts(problems){
  const say=text=>problems.push('center posts: '+text);
  const named=name=>PRESETS.find(preset=>preset.name===name);
  const rack=named('Fish tank wall / rack'),stand=named('Single aquarium stand'),cabinet=named('Cabinet stand with a row of tanks');
  if(!rack||!stand||!cabinet){say('a fish preset is missing');return;}
  const tankOf=key=>{const t=TANKS[key];return{size:key,tl:t[0],td:t[1],th:t[2],gal:t[3]};};
  // [preset, changes, the plan's arguments of the form values]
  const cases=[[cabinet,{},cabArgs],[cabinet,{W:48},cabArgs],[cabinet,{W:100},cabArgs],[cabinet,{W:144},cabArgs],[cabinet,{levels:'2'},cabArgs],
    [cabinet,tankOf('g55'),cabArgs],[cabinet,{...tankOf('g10'),W:60},cabArgs],[cabinet,{...tankOf('g40b'),W:144},cabArgs],
    [stand,{},standArgs],[stand,tankOf('g40b'),standArgs],[stand,tankOf('g55'),standArgs],[stand,{...tankOf('g55'),under:'tank'},standArgs],
    [stand,{...tankOf('g125'),under:'panels'},standArgs],[stand,{...tankOf('g75'),under:'shelf'},standArgs],
    // (doors over two pairs of center posts; three small tanks in a bay, a pair of doors in one stretch)
    [stand,tankOf('g125'),standArgs],[cabinet,{...tankOf('g125'),W:84},cabArgs],[cabinet,{...tankOf('g5'),W:60},cabArgs],
    [rack,{base:'cabinet',orient:'long',brace:false},p=>p],[rack,{base:'cabinet'},p=>p],[rack,{...tankOf('g55'),base:'cabinet',W:60,H:72},p=>p]];
  const offsetOf=(pl,m)=>pl.mods.slice(0,pl.mods.indexOf(m)).reduce((sum,s)=>sum+s.W,0);   // where a section starts
  const centerLines=pl=>pl.mods.flatMap(m=>rackLayout(pl,m).lines.filter(L=>L.center).map(L=>({x:offsetOf(pl,m)+L.x,w:L.w})));
  const kept=JSON.stringify(S),styleKept=look().style;
  let long=0,withPosts=0,seamChecked=0,shortChecked=0,doorsChecked=0;
  try{
    look().style='std';
    for(const[preset,changes,argsOf]of cases){
      const vals={...presetDefaults(preset),...changes},what=`${preset.name} ${JSON.stringify(changes)}`;
      const args=argsOf(vals),pl=args?rackPlan(args):null;
      const check=checkPreset(preset,vals);
      if(!pl||check.refused){say(`${what}: not built (${check.stops.map(f=>f.text).join(' ')})`);continue;}
      if(check.problems.length){say(`${what}: ${check.problems.map(f=>f.code).join(', ')}`);continue;}
      const parts=check.parts,wood=parts.filter(p=>!isProp(p));
      const length=Math.max(...wood.map(p=>box(p).hi[0]))-Math.min(...wood.map(p=>box(p).lo[0]));
      const lines=centerLines(pl);
      if(length<STAND_RULES.from-1e-6){
        if(length<=36+1e-6){shortChecked++;if(lines.length)say(`${what}: a stand ${fmt(length)} long has center posts`);}
        continue;
      }
      long++;
      if(pl.span>STAND_RULES.most+1e-6)say(`${what}: the rails run ${fmt(pl.span)} between uprights`);
      if(!lines.length)continue;   // its bays are short enough already (a cabinet stand with a line of uprights between every two tanks)
      withPosts++;
      // every pair of center posts has an upright at the front and one at the back
      const uprights=parts.filter(p=>p.name==='Upright').map(box);
      const standsAt=(x,atFront)=>uprights.some(b=>b.lo[0]<=x+1e-6&&b.hi[0]>=x-1e-6&&(atFront?b.hi[2]>=pl.D-.01:b.lo[2]<=.01));
      for(const line of lines){
        const x=line.x+line.w/2;
        for(const atFront of[true,false])if(!standsAt(x,atFront))say(`${what}: the center posts at ${fmt(r16(line.x))} have no upright at the ${atFront?'front':'back'}`);
      }
      // a center post in a bay of two tanks or more stands under the seam between two of them
      const busiest=pl.rows.filter(row=>!row.store&&row.c>1)[0];
      if(busiest){
        const tanks=parts.filter(p=>p.name==='Tank'&&Math.abs(p.pos[1]-(busiest.y+pl.rb))<.01).sort((a,b)=>a.pos[0]-b.pos[0]);
        const seams=tanks.slice(1).map((t,i)=>(tanks[i].pos[0]+size(tanks[i])[0]+t.pos[0])/2);
        for(const line of lines){
          const near=seams.filter(x=>x>line.x-6&&x<line.x+line.w+6);
          if(!near.length)continue;
          seamChecked++;
          if(!near.some(x=>x>=line.x-1e-6&&x<=line.x+line.w+1e-6))say(`${what}: the center posts at ${fmt(r16(line.x))} are not under the seam between the tanks (${near.map(x=>fmt(r16(x))).join(', ')})`);
        }
      }
      // without its center posts, the structural check refuses it, with a stop of its own
      const isCenter=p=>(p.name==='Upright'||p.name==='Foot')&&lines.some(L=>Math.abs(p.pos[0]-L.x)<.01);
      const refused=checkPreset(preset,vals,parts.filter(p=>!isCenter(p))).problems.filter(f=>f.code==='center-posts');
      if(!refused.length||refused.some(f=>f.level!=='stop'||!f.text||!f.fix))say(`${what}: without its center posts the structural check does not stop it with a reason and a fix`);
      // placed: it says it is a stand, and its doors hang and open all the way, past the center posts
      placePreset(preset,vals,preset.build(vals),false);
      const set=S.sets[S.nextSet];
      if(!set||set.stand!==true)say(`${what}: the placed stand does not say it is a stand`);
      if(pl.doors){
        const swings=movers().filter(mover=>mover.kind==='swing');
        if(!swings.length)say(`${what}: the doors do not swing`);
        for(const mover of swings){
          doorsChecked++;
          const reach=openReach(mover);
          if(mover.stuck||reach.free<1)say(`${what}: ${mover.name} opens only ${Math.round(reach.free*100)}% of the way${reach.hit?`: it hits the ${reach.hit.other.name}`:''}`);
        }
        // the doors follow the center posts: two doors meet in front of every one (doorsAroundCenters), so no post
        // stands behind the middle of a door, and no door stile stands between two center posts
        const doorBoxes=S.parts.filter(p=>p.name==='Door').map(box).sort((a,b)=>a.lo[0]-b.lo[0]);
        const meetings=doorBoxes.slice(1).map((door,i)=>(doorBoxes[i].hi[0]+door.lo[0])/2);
        for(const line of lines)if(!meetings.some(x=>x>=line.x-1e-6&&x<=line.x+line.w+1e-6))say(`${what}: no two doors meet in front of the center posts at ${fmt(r16(line.x))}`);
        if(S.parts.some(p=>p.name==='Door stile'))say(`${what}: a door stile stands beside the center posts`);
        doorsChecked++;
      }
      // a stand saved before stands said so, without center posts: Check my design still finds it
      S.parts=S.parts.filter(p=>!isCenter(p));
      if(set)delete set.stand;
      const saved=verifyDesign(S.parts,designCheckOptions());
      if(!saved.problems.some(f=>f.code==='center-posts'))say(`${what}: a stand saved before stands said so, without center posts, passes Check my design`);
      // and opening it says so in one line (oldStandNotice), once, not again on undo
      const said=[],sayKept=sayOldStand;
      sayOldStand=text=>said.push(text);
      try{
        oldStandSaidFor='';
        oldStandNotice();
        oldStandNotice();
      }finally{sayOldStand=sayKept;}
      if(said.length!==1||!/center posts/.test(said[0]||''))say(`${what}: opening a stand saved before center posts says ${said.length} lines about it, not one`);
    }
  }finally{
    look().style=styleKept;
    load(kept,true);
  }
  if(long<10)say(`only ${long} of the cases are 48" or longer, so the rule was hardly checked`);
  if(withPosts<8)say(`only ${withPosts} of the cases have center posts, so they were hardly checked`);
  if(!seamChecked)say('no center post was checked against the seam between two tanks');
  if(!shortChecked)say('no stand up to 36" long was checked');
  if(!doorsChecked)say('no door in front of a center post was opened');
});
/* Every step fastens only what is in place by then (woodworker's eye review, E5). The rack's step 4 stood the posts
   and listed the screws through them into the TOP frame, which a beginner sets on the uprights only in step 5. A piece
   is in place once the step that builds it, and, for a piece set in place later as part of something (the upper
   frames, a section), once that step; a piece that rests on others is in place once one of them is. Every
   "Fasten with" line of every step must join two pieces that are both in place at that step, and the picture of the
   step that stands the posts must not show the upper frames. Tried on the rack, the rack with its tanks long side
   out, on a cabinet base, with three rows, as one long wall with joined rails and as separate sections, and on the
   Cabinet stand and the Single aquarium stand, short and long. */
SELFTESTS.push(function stepsFastenOnlyWhatIsThere(problems){
  const say=text=>problems.push('steps in order: '+text);
  const named=name=>PRESETS.find(preset=>preset.name===name);
  const cases=[['Fish tank wall / rack',{}],['Fish tank wall / rack',{orient:'long'}],['Fish tank wall / rack',{base:'cabinet',brace:false}],
    ['Fish tank wall / rack',{levels:'3',H:110}],['Fish tank wall / rack',{W:240}],['Fish tank wall / rack',{W:240,build:'sections'}],
    ['Cabinet stand with a row of tanks',{}],['Cabinet stand with a row of tanks',{levels:'2'}],
    ['Single aquarium stand',{}],['Single aquarium stand',{under:'tank'}],['Single aquarium stand',{size:'g55',tl:48,td:13,th:21,gal:55}]];
  const kept=JSON.stringify(S);
  let links=0,postSteps=0;
  try{
    for(const[name,changes]of cases){
      const preset=named(name);
      if(!preset){say(`${name} is missing`);continue;}
      const vals={...presetDefaults(preset),...changes},what=`${name} ${JSON.stringify(changes)}`;
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,preset.build(vals),false);
      const plan=buildPlan(true),wood=S.parts.filter(p=>!isProp(p)&&plan.stepOfPiece.has(p.id));
      // what each piece rests on: wood right under it that it overlaps
      const boxes=new Map(wood.map(p=>[p.id,box(p)]));
      const overlap=(b,c,k)=>Math.min(b.hi[k],c.hi[k])-Math.max(b.lo[k],c.lo[k]);
      const restsOn=p=>{const b=boxes.get(p.id);return wood.filter(o=>{const c=boxes.get(o.id);return o!==p&&Math.abs(c.hi[1]-b.lo[1])<.02&&overlap(b,c,0)>.1&&overlap(b,c,2)>.1;});};
      // When a piece is in place, seen from inside a part both pieces of a joint belong to (`shared`: a section of a
      // fish wall is built as a rack of its own, so moving the whole section later does not count): the step that
      // builds it, the steps that set it in place by a part not shared, and, for a piece that rests on others, the
      // step where the first of them is in place.
      const groupsOf=p=>((plan.placedIn&&plan.placedIn.get(p.id))||[]).map(placed=>placed.group);
      // A piece off the floor that is set in place by no part and rests on nothing, or only on such pieces (a cross
      // piece in the middle of a bay), hangs on its joints alone: it says nothing about when the rest is in place.
      const hangMemo=new Map();
      const hangs=(p,shared)=>{
        const key=p.id+'|'+[...shared].sort().join(',');
        if(hangMemo.has(key))return hangMemo.get(key);
        hangMemo.set(key,true);
        const result=boxes.get(p.id).lo[1]>.02&&!groupsOf(p).some(g=>!shared.has(g))&&restsOn(p).every(o=>hangs(o,shared));
        hangMemo.set(key,result);
        return result;
      };
      const memo=new Map();
      const inPlace=(p,shared)=>{
        const key=p.id+'|'+[...shared].sort().join(',');
        if(memo.has(key))return memo.get(key);
        let at=plan.stepOfPiece.get(p.id);
        memo.set(key,at);   // (nothing rests on itself through a loop)
        for(const placed of(plan.placedIn&&plan.placedIn.get(p.id))||[])if(!shared.has(placed.group))at=Math.max(at,placed.at);
        const under=boxes.get(p.id).lo[1]>.02?restsOn(p).filter(o=>!hangs(o,shared)):[];
        if(under.length)at=Math.max(at,Math.min(...under.map(o=>inPlace(o,shared))));
        memo.set(key,at);
        return at;
      };
      // A joint in a step fastens a piece that is in place to one that is not yet: the second one is in the air
      // (two pieces that are both not in place yet are being put together on the bench, like a frame and its deck).
      plan.steps.forEach((step,index)=>{
        for(const group of step.groups)for(const link of group.links){
          if(!boxes.has(link.a.id)||!boxes.has(link.b.id))continue;
          links++;
          const shared=new Set(groupsOf(link.a).filter(g=>groupsOf(link.b).includes(g)));
          if(hangs(link.a,shared)||hangs(link.b,shared))continue;
          const atA=inPlace(link.a,shared),atB=inPlace(link.b,shared);
          if((atA<=index)!==(atB<=index)){
            const late=atA>index?link.a:link.b;
            say(`${what}: step ${index+1} fastens the ${link.a.name} to the ${link.b.name}, but the ${late.name} is not in place until step ${Math.max(atA,atB)+1}`);
          }
        }
      });
      // the step that stands the posts shows no frame above the bottom one
      const postStep=plan.steps.findIndex(step=>step.pieces.some(p=>p.name==='Post'));
      if(postStep<0){say(`${what}: no step stands the posts`);continue;}
      postSteps++;
      const away=piecesNotYetThere(plan,postStep),apart=partBuiltApart(plan,postStep);
      const shown=p=>apart?apart.ids.has(p.id):!away.has(p.id);
      const lowest=Math.min(...S.parts.filter(p=>p.name==='Rail').map(p=>p.pos[1]));
      const upper=S.parts.filter(p=>FRAME_PIECES.includes(p.name)&&p.pos[1]>lowest+6&&plan.stepOfPiece.get(p.id)<postStep);
      if(upper.some(shown))say(`${what}: the picture of step ${postStep+1}, where the posts go on, shows ${upper.filter(shown).length} pieces of the upper frames already in place`);
    }
  }finally{
    load(kept,true);
  }
  if(links<200)say(`only ${links} fastened joints were looked at`);
  if(postSteps<cases.length)say('a case was not checked');
});
