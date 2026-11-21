/* NominalCAD: drill your pieces. The data and the words of the step "Drill your pieces" (spec 11, stages 1 and 2).

   Stage 2 (live): every hole a bit makes is drilled ahead too, by the owner's ruling (the pilot holes in the piece a
   screw goes into included): a wood screw's clearance hole (with its countersink, or its counterbore when the head
   is sunk or plugged) and its pilot (screwHoles), a dowel's hole in each piece (dowelHoles). A hole and the hole it
   meets in the other piece are measured on both drawings from one corner of the place where the two touch
   (placePairs; cornerSplitLetters splits a letter whose pieces would read a pair from different corners). DRILL_BITS
   is the one table of bits.

   The owner, a steel detailer: "you want all your pieces made and then you just assemble it". So the Build
   instructions get a step 2, right after cutting: every hole that can be drilled ahead is on a drawing of its piece,
   located from one named end and one named edge, and after that step the person only puts the pieces together and
   drives the screws. Stage 1 does this for every pocket hole of every design (presets and designs drawn by hand);
   the other holes are listed in words as drilled in the step that drives them.

   This file holds the data and the words, no drawing and no HTML: the drawings and the step's page are in
   js/partdrawings.js. buildPlan (js/buildsteps.js) calls drillPlan once and keeps it on the plan (plan.drill), so
   the memo of the plan is the memo of this.

     DRILL_KINDS          one row per kind of hole: when it is drilled ('ahead' in step 2, 'assembly' in the step that
                          drives it, 'none' for nothing to drill) and from which stage on that is live. A new kind of
                          hole is a row here.
     DRILL_STAGE          which rows are live (1: pocket holes; 2: also wood screws, plugged screws and dowels)
     DRILL_DRAWINGS_MAX   drawings on the page at most; past that the labels are listed and their lines keep the
                          marking views of the steps (no hole loses its place)
     drillPlan(graph, letterOf)   {holes, labels, setups, nothing, assembly, total, complete, labelOf(piece),
                          holesOfPiece(piece), covers(links), number(stepOfLink)}
       hole   {f, link, piece, kind, jig, screw, plugged, at (where the hole opens), out (the face it is on), dir,
               clear, passEnds, setup, step}
       label  {name ('A' or 'A1'), letter, way, members: [{piece, frame}], mirror (true for the second of a mirror
               pair: it shares its twin's drawing), twin, views, drawn, holesEach, signature}
     benchFrame(...)      how a person sees one face of a piece on the bench: the end with the label on one side,
                          the top edge up (frames below)
     placementWords(step, plan)   the "Put in" line of an assembly step
     drilledAlready(cover)        "The holes are made already: part drawing C, holes ⬡1."
     drillHolesWords(row, drill)  what the drill labels of one cut-list row get, for its Drawing column
                                  (drawingColumnText, js/shoppacket.js)

   A frame (how one piece is drilled and put in), in world terms:
     {n: [x, y, z] the face the label is on (out of the wood), up: [x, y, z] toward the top edge,
      along: [x, y, z] from the end with the label toward the other end, lengthAxis, upAxis,
      datumAt: the world coordinate of the end with the label (along lengthAxis), topAt: of the top edge}
   Seen square on with the top edge up, the end with the label is on the left of the paper when up x n points along
   `along` (a right-handed view: right x up = toward the eye); else it is on the right (the second face of a piece
   drilled on both faces, and the mirror image of a mirror pair). */
'use strict';

const DRILL_STAGE=2;
const DRILL_DRAWINGS_MAX=60;   // (one cap with the part drawings of the shop packet: PART_DRAWINGS_MAX, js/shoppacket.js)
const DRILL_VIEWS_MAX=4;      // views on one drawing at most (a face, the face behind it, an edge, an end): self-checked
const DRILL_SAME=1/32+1e-6;   // two holes are in the same place within this (inches)
/* A wood screw driven square into its face, whose two holes can be drilled ahead: not a structural screw (no hole),
   not one driven at an angle (its angle is set against the piece in place), not a framing screw that lands where a
   joist is under a deck (js/framing.js) */
const squareScrew=f=>f.kind==='screw'&&!f.structural&&!f.toe&&!f.angledAt&&!(f.also&&f.also.length)&&
  (f.type==='screw'||f.type==='plug')&&f.dir.filter(v=>Math.abs(v)>1e-6).length===1;
/* One row per kind of hole (spec 11, section 2). test(f): is this fastener of this kind. holes(f, link): the holes
   it takes, each in its own piece (a pocket hole; a clearance hole and its pilot; a dowel hole in each piece). */
const DRILL_KINDS=[
  {key:'pocket',when:'ahead',stage:1,test:f=>f.kind==='pocket'&&!!f.pocket,holes:(f,link)=>[pocketHole(f,link)]},
  {key:'structural',when:'none',stage:1,test:f=>f.kind==='screw'&&!!f.structural},
  {key:'toe',when:'assembly',stage:1,test:f=>(!!f.toe||!!f.angledAt)&&f.kind==='screw'},
  {key:'plate',when:'assembly',stage:1,test:f=>f.kind==='screw'&&!squareScrew(f)},
  {key:'plug',when:'ahead',stage:2,test:f=>squareScrew(f)&&!!f.plug,holes:(f,link)=>screwHoles(f,link)},
  {key:'screw',when:'ahead',stage:2,test:f=>squareScrew(f),holes:(f,link)=>screwHoles(f,link)},
  {key:'dowel',when:'ahead',stage:2,test:f=>f.kind==='dowel',holes:(f,link)=>dowelHoles(f,link)},
  {key:'bracket',when:'assembly',stage:1,test:f=>f.kind==='bracket'},
  {key:'nail',when:'none',stage:1,test:f=>f.kind==='brad'||f.kind==='nail'},
];
/* The bits of step 2 (spec 11, section 9): one table, read by the drawings, the order of work, "You need" and the
   tool list of the shopping page (toolList, js/plans.js). The program's wood screws are #8 (FASTENER_SIZE.screw,
   js/fasteners.js), so these are the #8 sizes of sheet 23, section 2a: a clearance hole of 11/64" (the shank is
   0.164", so the threads do not grip the first piece and the screw pulls the two tight), a pilot of 7/64" in pine
   and plywood or 1/8" in hardwood ("about": test in a scrap), a #8 countersink, a 3/8" counterbore for a head that
   is sunk or plugged (PLUG_DIA). Dowel holes take a bit the size of the dowel, in a dowel jig. */
const DRILL_BITS={
  clearance:{size:11/64,name:'11/64" bit',tool:'11/64" drill bit, for the holes the wood screws pass through'},
  countersink:{name:'#8 countersink',tool:'#8 countersink bit (a combination countersink bit drills the 11/64" hole and the countersink at once)'},
  counterbore:{size:3/8,name:'3/8" bit',tool:'3/8" drill bit (brad-point or Forstner), for the counterbores the sunk heads sit in'},
  pilotSoft:{size:7/64,name:'7/64" bit',tool:'7/64" drill bit, for the pilot holes in pine and plywood'},
  pilotHard:{size:1/8,name:'1/8" bit',tool:'1/8" drill bit, for the pilot holes in oak and other hard woods'},
  dowel:{name:'brad-point bit the size of the dowel, in a dowel jig',tool:'dowel jig, and a brad-point bit the size of the dowels'},
  depth:{name:'a flag of painter\'s tape on the bit',tool:'painter\'s tape: a flag on the bit marks how deep to drill, and a strip takes a label on a face that shows'},
};
/* The line of the shopping page's tool list for the bits of wood screws (toolList, js/plans.js), from DRILL_BITS:
   types is the Set of fastener types the design uses ('plug' adds the counterbore bit) */
function drillBitsToolLine(types){
  const bits=[`${DRILL_BITS.clearance.name.replace(/ bit$/,'')} for the holes wood screws pass through`,
    `${DRILL_BITS.pilotSoft.name.replace(/ bit$/,'')} for pilot holes in pine (${DRILL_BITS.pilotHard.name.replace(/ bit$/,'')} in oak and other hard woods)`];
  if(types.has('plug'))bits.push(`${DRILL_BITS.counterbore.name.replace(/ bit$/,'')} for the counterbores of plugged heads`);
  return`Drill bits: ${listWords(bits)}; a ${DRILL_BITS.countersink.name} bit; painter's tape for a depth flag on the bit`;
}
/* The lines of the shopping page's tool list for drilling (toolList, js/plans.js), from what is really drilled
   (R12 of the stage 2 review): the bits of wood screws only when a wood screw takes a hole (structural screws need
   none), and the dowel jig with its brad-point bit the size of the dowels. types: the fastener types of the design;
   plan: the build plan when the caller has it (else the types decide, as before). */
function drillToolLines(types,plan){
  const lines=[],drill=plan&&plan.drill;
  const woodScrews=drill?drill.holes.some(hole=>hole.kind==='clear'||hole.kind==='pilot')||drill.other.some(entry=>(entry.row.key==='toe'||entry.row.key==='plate')&&!entry.f.structural)
    :types.has('screw')||types.has('plug');
  if(woodScrews)lines.push(drillBitsToolLine(types));
  if(types.has('dowel')){
    const sizes=drill?[...new Set(drill.holes.filter(hole=>hole.kind==='dowel').map(hole=>r16(hole.dia)))].sort((a,b)=>a-b).map(fmt):[];
    lines.push(`Dowel jig and a mallet; a brad-point bit the size of the dowels${sizes.length?` (${listWords(sizes)})`:''}`);
  }
  return lines;
}
/* the pilot bit for this design's wood: 1/8" in a hardwood (WOODS[...][3], js/style.js), else 7/64" */
const pilotBitKey=()=>{const wood=WOODS[look().wood];return wood&&wood[3]===1?'pilotHard':'pilotSoft';};
/* The order of work after the jig settings, bit by bit, so the person changes bits as seldom as possible (sheet 23,
   section 5): the counterbores, with the 11/64" bit through their middles; the 11/64" holes with their
   countersinks (the same 11/64" bit still in); the pilot holes; the dowel holes, one setting per size of dowel. */
const BIT_STEPS=[
  {key:'counterbore',of:hole=>hole.kind==='clear'&&hole.sunk>0},
  {key:'countersink',of:hole=>hole.kind==='clear'&&!(hole.sunk>0)},
  {key:'pilot',of:hole=>hole.kind==='pilot'},
  {key:'dowel',of:hole=>hole.kind==='dowel'},
];
const DOWEL_GLUE_ROOM=1/16;   // a dowel hole is 1/16" deeper than the dowel goes, for the glue (sheet 23, 2e)
/* ---------- the holes of one fastener ---------- */
function pocketHole(f,link){
  return{f,link,piece:f.through,kind:'pocket',jig:f.jig,screw:f.label,plugged:!!f.pocket.plugged,at:f.pocket.mouth,out:f.pocket.out,dir:f.dir,
    clear:f.clear||null,passEnds:f.passEnds||null,setup:null,step:0,depth:0};
}
/* A wood screw: the clearance hole right through the piece it goes through, opening on the face its head goes in
   at (with a countersink, or a counterbore when its head is sunk, under a plug or not), and its pilot in the piece
   it goes into, opening on the face the first piece lies on, as deep as the screw goes in. The two are one pair
   (mate): the same line, measured from the same place on both drawings (spec 11, 4.4). */
function screwHoles(f,link){
  const dir=f.dir,k=mainAxis(dir),sunk=f.sunk||0,out=dir.map(v=>-v);
  const surface=f.plug?f.plug.at:pointPlus(f.pos,dir,-sunk);
  // (the pilot opens on the face where the two pieces touch, the joint's plane, not the far side of the first
  //  piece's box: the same for a square board, right for a shaped one: C30 of the stage 2 review)
  const contact=surface.slice();
  contact[k]=link.joint.plane;
  const thick=Math.abs(contact[k]-surface[k]);
  const common={f,link,screw:f.label,out,dir,setup:null,step:0,plugged:false};
  const clear={...common,piece:f.through,kind:'clear',at:surface,depth:thick,sunk,plug:!!f.plug,countersink:!sunk};
  const pilot={...common,piece:f.into,kind:'pilot',at:contact,depth:f.len-(thick-sunk)};
  clear.mate=pilot;pilot.mate=clear;
  return[clear,pilot];
}
/* A dowel: a hole in each piece, opening on the faces that meet, each as deep as the dowel goes into that piece and
   1/16" more for the glue; one pair, measured from the same place on both drawings. */
function dowelHoles(f,link){
  const k=mainAxis(f.dir),plane=link.joint.plane,inA=Math.abs(plane-f.pos[k]);
  const at=f.pos.slice();
  at[k]=plane;
  const common={f,link,screw:f.label,kind:'dowel',at,dia:f.dia,setup:null,step:0,plugged:false};
  const first={...common,piece:f.through,out:f.dir.slice(),dir:f.dir.map(v=>-v),depth:inA+DOWEL_GLUE_ROOM};
  const second={...common,piece:f.into,out:f.dir.map(v=>-v),dir:f.dir.slice(),depth:f.len-inA+DOWEL_GLUE_ROOM};
  first.mate=second;second.mate=first;
  return[first,second];
}
/* Holes made by a bit in a face (not by the pocket-hole jig): drawn as circles, measured both ways. */
const straightHole=hole=>hole.kind==='clear'||hole.kind==='pilot'||hole.kind==='dowel';
/* the words of a bit setting: '11/64" bit right through, then the #8 countersink' */
function bitSettingWords(setup){
  const pilot=DRILL_BITS[pilotBitKey()];
  if(setup.bit==='counterbore')return`${DRILL_BITS.counterbore.name} for the counterbores, then the ${DRILL_BITS.clearance.name} right through the middle of each`;
  // (R17: drill them all with the one bit, then countersink them all; the pilot holes by depth, so the tape flag on
  //  the bit is moved as seldom as possible)
  if(setup.bit==='countersink')return`${DRILL_BITS.clearance.name} right through each of them, then the ${DRILL_BITS.countersink.name} on the same face of each (a combination countersink bit does both at once)`;
  if(setup.bit==='pilot'){
    const depths=[...new Set(setup.holes.map(hole=>r16(hole.depth)))].sort((a,b)=>a-b).map(fmt);
    return`${pilot.name} for the pilot holes${pilotBitKey()==='pilotSoft'?' (1/8" in hardwood)':''}, each as deep as its drawing says`+
      (depths.length>1?` (${listWords(depths)}: drill all of one depth before you move the tape flag)`:'');
  }
  return`${fmt(setup.dia)} bit in a dowel jig, each hole as deep as its drawing says`;
}
/* the short name of a setting, for the tables and the tags: 'Jig set for 1 1/2" stock', '11/64" bit and countersink' */
function setupWords(setup){
  if(setup.kind==='jig')return`Jig set for ${jigWords(setup.jig)} stock`;
  if(setup.bit==='counterbore')return'3/8" counterbore, then 11/64" through';
  if(setup.bit==='countersink')return'11/64" through, #8 countersink';
  if(setup.bit==='pilot')return`${DRILL_BITS[pilotBitKey()].name} pilot hole`;
  return`${fmt(setup.dia)} dowel hole`;
}
const drillKindOf=f=>DRILL_KINDS.find(row=>row.test(f))||null;
const drilledAhead=row=>!!row&&row.when==='ahead'&&row.stage<=DRILL_STAGE;

/* ---------- small vector helpers (world vectors along one axis, as [x, y, z]) ---------- */
const axisVector=(axis,sign)=>{const v=[0,0,0];v[axis]=sign<0?-1:1;return v;};
// (crossOf, the cross product, is in js/hanging.js)
const dotOf=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mainAxis=v=>[0,1,2].reduce((best,k)=>Math.abs(v[k])>Math.abs(v[best])?k:best,0);
const sameVector=(a,b)=>dotOf(a,b)>.99;

/* ---------- a piece in its own terms ----------
   Local coordinates: along its length (ax[0]), its width (ax[1]) and its thickness (ax[2]), from its low corner.
   Turning a piece end for end, over, or a square stick a quarter turn about its length are the symmetries of its
   box: a signed permutation of those three axes that keeps every size. det +1: a turn (a piece can be turned);
   det -1: a mirror image (it cannot: that is a different piece).
   The local frame must have the room's handedness, or a turn in the room reads as a mirror image (and a mirror
   image as a turn). ax can be any order of the three world axes: a board on edge along X has [0,1,2], the same
   board lying flat [0,2,1]. When that order is odd, the frame length x width x thickness is left-handed, so the
   thickness is counted from the high face instead (pointing the other way), which makes every local frame
   right-handed. */
const PERMS=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const permParity=p=>(p[0]===0?(p[1]===1?1:-1):p[0]===1?(p[1]===0?-1:1):(p[1]===1?-1:1));
/* +1 when the piece's (length, width, thickness) frame is right-handed in the room, -1 when it is not */
const localHand=piece=>permParity(piece.ax);
function pieceDims(piece){return[piece.l,piece.w,piece.t];}
function toLocalPoint(piece,p){
  const b=plainBox(piece),flip=localHand(piece)<0;
  return piece.ax.map((axis,i)=>i===2&&flip?b.hi[axis]-p[axis]:p[axis]-b.lo[axis]);
}
function toLocalVector(piece,v){const flip=localHand(piece)<0;return piece.ax.map((axis,i)=>i===2&&flip?-v[axis]:v[axis]);}
function toWorldVector(piece,v){
  const w=[0,0,0],flip=localHand(piece)<0;
  piece.ax.forEach((axis,i)=>{w[axis]=i===2&&flip?-v[i]:v[i];});
  return w;
}
function boxSymmetries(dims){
  const list=[];
  for(const perm of PERMS){
    if(perm.some((from,i)=>Math.abs(dims[from]-dims[i])>DRILL_SAME))continue;
    for(let m=0;m<8;m++){
      const signs=[m&1?-1:1,m&2?-1:1,m&4?-1:1];
      list.push({perm,signs,det:permParity(perm)*signs[0]*signs[1]*signs[2]});
    }
  }
  // the plain identity first, then the other turns, then the mirror images
  return list.sort((a,b)=>(b.det-a.det)||(symmetryRank(a)-symmetryRank(b)));
}
const symmetryRank=sym=>sym.perm.filter((from,i)=>from!==i).length*10+sym.signs.filter(s=>s<0).length;
function mapPoint(sym,dims,p){return sym.perm.map((from,i)=>sym.signs[i]>0?p[from]:dims[from]-p[from]);}
function mapVector(sym,v){return sym.perm.map((from,i)=>sym.signs[i]*v[from]);}
/* the inverse of a symmetry: q[i] = s_i * p[perm[i]] (+ size), so p[perm[i]] = s_i * q[i] (+ size) */
function inverseSymmetry(sym){
  const perm=[0,0,0],signs=[1,1,1];
  sym.perm.forEach((from,i)=>{perm[from]=i;signs[from]=sym.signs[i];});
  return{perm,signs,det:sym.det};
}
/* the holes of a piece in its own terms: [{p, n, d, setup, hole}] */
/* what must be the same for two holes to be drilled alike, beyond their place: the setting, how deep, the head */
const holeKey=hole=>[hole.setup,r16(hole.depth||0),r16(hole.sunk||0),hole.plug?'plug':'',hole.plugged?'plugged':''].join('|');
/* corners: with the corner of each hole's place too (c), for a letter whose pieces must also agree on which corner
   their pairs are measured from (cornerSplitLetters) */
function localPattern(piece,holes,corners){
  return holes.map(hole=>({p:toLocalPoint(piece,hole.at),n:toLocalVector(piece,hole.out),d:toLocalVector(piece,hole.dir),setup:hole.setup,key:holeKey(hole),hole,
    c:corners&&hole.place?toLocalPoint(piece,cornerOfPlace(hole.place,piece)):null}));
}
const samePoint=(p,q)=>p.every((v,k)=>Math.abs(v-q[k])<=DRILL_SAME);
/* Are these two lists of holes the same, one to one (within 1/32", the same face, the same slant, the same setting
   and depth, and, where it is part of the pattern, measured from the same corner)? */
function samePattern(a,b){
  if(a.length!==b.length)return false;
  const used=new Array(b.length).fill(false);
  for(const one of a){
    const index=b.findIndex((other,i)=>!used[i]&&other.key===one.key&&sameVector(other.n,one.n)&&dotOf(other.d,one.d)>.98&&
      samePoint(one.p,other.p)&&(!one.c===!other.c)&&(!one.c||samePoint(one.c,other.c)));
    if(index<0)return false;
    used[index]=true;
  }
  return true;
}
function transformPattern(sym,dims,pattern){
  return pattern.map(h=>({...h,p:mapPoint(sym,dims,h.p),n:mapVector(sym,h.n),d:mapVector(sym,h.d),c:h.c?mapPoint(sym,dims,h.c):null}));
}
/* the symmetry of the box that carries pattern `from` onto pattern `onto`, of this det (+1 a turn, -1 a mirror) */
function symmetryBetween(dims,from,onto,det){
  return boxSymmetries(dims).find(sym=>sym.det===det&&samePattern(transformPattern(sym,dims,from),onto))||null;
}
/* Of the symmetries that carry a piece's holes onto the drawing's, the one that puts its face 1 (where the label is
   written) on a hidden side: a short apron with holes only in its top edge can be drilled either way round, and its
   label goes on the face that looks into the design, not on the outside (where it would need painter's tape).
   prefer(sym) gives a score, lower is better. */
function bestSymmetryBetween(dims,from,onto,det,prefer){
  const all=boxSymmetries(dims).filter(sym=>sym.det===det&&samePattern(transformPattern(sym,dims,from),onto));
  if(all.length<2||!prefer)return all[0]||null;
  return all.map((sym,index)=>({sym,score:prefer(sym)*100+index})).sort((a,b)=>a.score-b.score)[0].sym;
}
/* 0 when the face n of this piece looks into the design or down (where a label is not seen), else 1 */
function faceHiddenScore(piece,n){
  const axis=mainAxis(n);
  if(axis===1)return n[1]<0?0:1;
  return Math.sign(n[axis])===hiddenSide(piece,axis)?0:1;
}
/* the end for end mirror (along the length) of a pattern: the same holes measured from the other end */
const END_FOR_END={perm:[0,1,2],signs:[-1,1,1],det:-1};

/* ---------- the frame a piece is drilled in (spec 11, 4.1) ---------- */
/* world vector of the length of the paper for a face: the piece's length, unless the face is an end */
function lengthAxisFor(piece,normalAxis){
  if(piece.ax[0]!==normalAxis)return piece.ax[0];
  return piece.w>=piece.t?piece.ax[1]:piece.ax[2];
}
/* Where do this hole's screw and its jig point, on a face seen square on: 'end' when it comes out of an end of the
   piece (the jig is clamped against that end), 'edge' when out of an edge. */
function holeClampKind(hole,lengthAxis){
  // a hole a bit makes: 'end' when it is in an end of the piece, 'edge' when in an edge, else 'face' (it decides
  // nothing about which end or edge the drawing is measured from)
  if(straightHole(hole)){
    const axis=mainAxis(hole.out);
    if(axis===lengthAxis)return'end';
    return'face';
  }
  const along=Math.abs(hole.dir[lengthAxis]);
  const across=Math.max(...[0,1,2].filter(k=>k!==lengthAxis&&Math.abs(hole.out[k])<.5).map(k=>Math.abs(hole.dir[k])));
  return along>=across?'end':'edge';
}
/* The frame of the sample piece of a way of drilling, by the rules of 4.1:
     - an upright piece: the end with the label is its bottom end;
     - else, when only one end has holes the jig is clamped against (end holes): that end;
     - else the top edge is the edge a row of holes is worked from (its screws come out of that edge);
     - else the end on the left as the marking views see that face in the design (markingFrame), so "left"
       agrees with every step.
   Whatever the rule fixes, the rest follows from seeing the face square on with the label on the left. */
/* The face the label goes on, the face 1 of the drawing: the face with the pocket holes (stage 1, unchanged); else
   a face along the piece with holes in it (a wide face, or any side of square stock); else, for a piece drilled
   only in its edges or ends (pilot holes in the end of a rail, in the top of a leg), its hidden wide face. */
function labelFaceOf(piece,holes,faces){
  if(holes.some(hole=>!straightHole(hole)))return faces[0];
  const square=Math.abs(piece.w-piece.t)<DRILL_SAME;
  const along=face=>mainAxis(face)!==piece.ax[0]&&(square||mainAxis(face)===piece.ax[2]);
  const own=faces.find(along);
  if(own)return own;
  const k=piece.ax[2];
  return axisVector(k,hiddenSide(piece,k));
}
function datumOf(piece,holes,faces){
  const n=labelFaceOf(piece,holes,faces),normalAxis=mainAxis(n);
  const lengthAxis=lengthAxisFor(piece,normalAxis);
  const upAxis=[0,1,2].find(k=>k!==lengthAxis&&k!==normalAxis);
  const b=plainBox(piece);
  // with the top edge this way, where is the end with the label (for it to be on the left of the paper)?
  const endLowFor=upSign=>dotOf(crossOf(axisVector(upAxis,upSign),n),axisVector(lengthAxis,1))>0;
  const upSignFor=endLow=>endLowFor(1)===endLow?1:-1;
  let endLow,upSign;
  const endHoles=holes.filter(hole=>holeClampKind(hole,lengthAxis)==='end');
  // the edges rows of holes are worked from: the edge a pocket row's screws come out of, the edge a bit drills into
  const edgeSigns=holes.filter(hole=>!straightHole(hole)&&holeClampKind(hole,lengthAxis)==='edge').map(hole=>hole.dir[upAxis]>0?1:-1)
    .concat(holes.filter(hole=>straightHole(hole)&&mainAxis(hole.out)===upAxis).map(hole=>hole.out[upAxis]>0?1:-1));
  const middle=(b.lo[lengthAxis]+b.hi[lengthAxis])/2;
  const lowEnd=endHoles.filter(hole=>hole.at[lengthAxis]<middle).length,highEnd=endHoles.length-lowEnd;
  // (the edge a row is worked from comes before the end with the end holes: a rail with a post at one end only is
  //  drawn the way it stands, its top edge up, and not upside down for the sake of the end)
  // An upright: its bottom end, unless all its holes are in its upper half (the legs of a five-board bench, held by
  // pocket holes at their tops; a leg whose apron is doweled or screwed on flush with its top): then the top end, so
  // the tape is hooked on the end that meets the other pieces and not on the far end, where a cut a little long or
  // short would move the holes (the owner's rule, BRIEF "Make every piece first"; R4 of the stage 2 review)
  if(lengthAxis===1){
    const upper=holes.filter(hole=>hole.at[1]>middle).length;
    endLow=!(upper>0&&upper===holes.length);
    upSign=upSignFor(endLow);
  }
  else if(edgeSigns.length){
    const high=edgeSigns.filter(sign=>sign>0).length;
    upSign=high>=edgeSigns.length-high?1:-1;
    endLow=endLowFor(upSign);
  }else if(upAxis===1){upSign=1;endLow=endLowFor(1);}   // a face that stands up: drawn as it stands
  else if(endHoles.length&&(!lowEnd||!highEnd)){endLow=lowEnd>0;upSign=upSignFor(endLow);}
  else{
    const seen=markingFrame(normalAxis,-Math.sign(n[normalAxis]),piece);
    if(seen.right.axis===lengthAxis){endLow=seen.right.sign>0;upSign=upSignFor(endLow);}
    else{upSign=1;endLow=endLowFor(1);}
  }
  return{n:n.slice(),up:axisVector(upAxis,upSign),along:axisVector(lengthAxis,endLow?1:-1),lengthAxis,upAxis,
    datumAt:endLow?b.lo[lengthAxis]:b.hi[lengthAxis],topAt:upSign>0?b.hi[upAxis]:b.lo[upAxis]};
}
/* the frame of another piece of the same way, carried over by the symmetry that maps the sample's holes onto it:
   sym carries this piece's local pattern onto the sample's, so its inverse carries the sample's frame onto this one */
function carriedFrame(sample,frame,piece,sym){
  const back=inverseSymmetry(sym),dims=pieceDims(sample);
  const local=v=>toWorldVector(piece,mapVector(back,toLocalVector(sample,v)));
  const n=local(frame.n),up=local(frame.up),along=local(frame.along);
  const lengthAxis=mainAxis(along),upAxis=mainAxis(up),b=plainBox(piece);
  void dims;
  return{n,up,along,lengthAxis,upAxis,
    datumAt:along[lengthAxis]>0?b.lo[lengthAxis]:b.hi[lengthAxis],topAt:up[upAxis]>0?b.hi[upAxis]:b.lo[upAxis]};
}
/* the frame of one face of a piece (the second face of a piece drilled on both): the same end and top edge */
function faceFrame(frame,n){return{...frame,n:n.slice()};}
/* The frame of any face of a piece, seen square on, from the frame of its label face (spec 11, 4.3, stage 2):
     - the label face, or the face behind it: the same end with the label and top edge (face 1, face 2);
     - an edge: the piece tipped so that edge faces you, the end with the label still on the left: the top edge with
       the face with the label at the bottom of the paper, the bottom edge with it at the top;
     - an end: seen square on with the top edge up, measured across from the face with the label.
   Returns {kind, frame}. The kind names the view in words (viewTitle, js/partdrawings.js). */
function viewOfFace(frame,face,piece){
  const kind=sameVector(face,frame.n)?'face1':sameVector(face,frame.n.map(v=>-v))?'face2'
    :sameVector(face,frame.up)?'topedge':sameVector(face,frame.up.map(v=>-v))?'bottomedge'
    :sameVector(face,frame.along)?'farend':'labelend';
  return{kind,frame:frameOfView(frame,kind,piece)};
}
/* the vectors of a view's frame as mixes of the label face's along, up and n (the same for every piece of a label:
   carried to each piece by its own frame) */
const VIEW_MIX={
  face1:{n:[0,0,1],up:[0,1,0],along:[1,0,0]},face2:{n:[0,0,-1],up:[0,1,0],along:[1,0,0]},
  topedge:{n:[0,1,0],up:[0,0,-1],along:[1,0,0]},bottomedge:{n:[0,-1,0],up:[0,0,1],along:[1,0,0]},
  labelend:{n:[-1,0,0],up:[0,1,0],along:[0,0,-1]},farend:{n:[1,0,0],up:[0,1,0],along:[0,0,-1]},
};
function frameOfView(frame,kind,piece){
  const mix=VIEW_MIX[kind],b=plainBox(piece);
  const of=c=>[0,1,2].map(k=>c[0]*frame.along[k]+c[1]*frame.up[k]+c[2]*frame.n[k]);
  const n=of(mix.n),up=of(mix.up),along=of(mix.along),lengthAxis=mainAxis(along),upAxis=mainAxis(up);
  return{n,up,along,lengthAxis,upAxis,kind,
    datumAt:along[lengthAxis]>0?b.lo[lengthAxis]:b.hi[lengthAxis],topAt:up[upAxis]>0?b.hi[upAxis]:b.lo[upAxis]};
}
/* is the end with the label on the left of the paper, for this frame? */
const datumOnLeft=frame=>dotOf(crossOf(frame.up,frame.n),frame.along)>0;
/* a world point in bench terms: how far from the end with the label, how far down from the top edge */
function benchPoint(frame,p){
  return{a:(p[frame.lengthAxis]-frame.datumAt)*Math.sign(frame.along[frame.lengthAxis]),
    b:(frame.topAt-p[frame.upAxis])*Math.sign(frame.up[frame.upAxis])};
}
/* how a face is seen on the bench, with the interface the marking views read (markingFrame, js/markingview.js):
   right and up on the paper, and the names of its ends and edges as the bench sees them */
function benchFrame(piece,frame){
  const left=datumOnLeft(frame),rightSign=Math.sign(frame.along[frame.lengthAxis])*(left?1:-1);
  const right={axis:frame.lengthAxis,sign:rightSign},up={axis:frame.upAxis,sign:Math.sign(frame.up[frame.upAxis])};
  const axis=mainAxis(frame.n),look=-Math.sign(frame.n[axis]);
  const signOf=k=>k===right.axis?right.sign:k===up.axis?up.sign:0;
  return{axis,look,right,up,from:'on the bench',seen:'seen square on, top edge up',mirrored:false,inside:false,signOf,beyond:'behind',
    toView:p=>[p[right.axis]*right.sign,p[up.axis]*up.sign],
    nameOf:(k,high)=>k===up.axis?((high===(up.sign>0))?'top':'bottom'):k===right.axis?((high===(right.sign>0))===left?'far':'labelled'):'face',
    screenSide:(k,high)=>k===right.axis?((high===(right.sign>0))?'right':'left'):k===up.axis?((high===(up.sign>0))?'top':'bottom'):null,
    screenLowIsHigh:k=>k===right.axis?right.sign<0:k===up.axis?up.sign<0:false,
    viewAxis:k=>k===right.axis?0:k===up.axis?1:-1,
    datumLeft:left,piece};
}

/* ---------- the plan ---------- */
function drillPlan(graph,letterOf){
  const plan={holes:[],labels:[],setups:[],nothing:[],other:[],total:0,complete:true,wallScrews:[],
    byPiece:new Map(),labelOfPiece:new Map(),memberOf:new Map(),
    putSaid:new Map()};   // piece id -> {say(frame), said}: the Put in words of each piece (placementWords), for the self-check
  // 1. every hole drilled ahead, from the layout the 3D view draws; the rest is kept for the At assembly line
  for(const link of graph.links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      const row=drillKindOf(f);
      if(!row)continue;
      if(!drilledAhead(row)){plan.other.push({f,link,row});continue;}
      for(const hole of row.holes(f,link)){
        hole.row=row.key;
        plan.holes.push(hole);
        if(!plan.byPiece.has(hole.piece.id))plan.byPiece.set(hole.piece.id,[]);
        plan.byPiece.get(hole.piece.id).push(hole);
      }
    }
  }
  plan.total=plan.holes.length;
  plan.pockets=plan.holes.filter(hole=>hole.kind==='pocket').length;
  // the screws into the wall studs: placed hardware, or a line of the preset's own list
  for(const item of hardwareList())if(item.kind==='wallscrew'&&byId(item.on))plan.wallScrews.push({on:item.on,count:1});
  // (a preset that lists them as a plain line, with the pieces they go through in its `wall` list: the Bookshelf)
  for(const[label,count]of plainLinesLeft(S.hw||[],hardwareList())){
    if(!/wall studs?/i.test(label)||!(count>0))continue;
    const names=new Set(Object.values(S.sets||{}).flatMap(set=>Array.isArray(set&&set.wall)?set.wall:[]));
    const through=S.parts.filter(p=>names.has(p.name));
    if(through.length)for(const p of through)plan.wallScrews.push({on:p.id,count:count/through.length});
    else plan.wallScrews.push({on:null,count});
  }
  // 2. the jig settings, thickest first: the frame is built before the top goes on; then the bits, in the order of
  //    BIT_STEPS (one setting per size of dowel)
  const pocketHoles=plan.holes.filter(hole=>hole.kind==='pocket');
  const settings=[...new Set(pocketHoles.map(hole=>hole.jig))].sort((a,b)=>b-a);
  plan.setups=settings.map(jig=>({kind:'jig',jig,holes:pocketHoles.filter(hole=>hole.jig===jig)}));
  for(const step of BIT_STEPS){
    const holes=plan.holes.filter(step.of);
    if(step.key!=='dowel'){if(holes.length)plan.setups.push({kind:'bit',bit:step.key,holes});continue;}
    for(const dia of[...new Set(holes.map(hole=>r16(hole.dia)))].sort((a,b)=>a-b))
      plan.setups.push({kind:'bit',bit:'dowel',dia,holes:holes.filter(hole=>r16(hole.dia)===dia)});
  }
  plan.setups.forEach((setup,index)=>{setup.no=index+1;});
  for(const setup of plan.setups)for(const hole of setup.holes)hole.setup=setup.no;
  // 3. the labels: by cut-list letter, then by way of drilling
  const byLetter=new Map();
  for(const p of S.parts){
    if(isProp(p))continue;
    const letter=letterOf(p);
    if(!letter)continue;
    if(!byLetter.has(letter))byLetter.set(letter,[]);
    byLetter.get(letter).push(p);
  }
  const letters=[...byLetter.keys()].sort(letterOrder);
  for(const letter of letters)labelLetter(plan,letter,byLetter.get(letter));
  finishLabels(plan);
  // 4. the place each pair of holes is measured from (spec 11, 4.4), once every piece has its frame; then the views
  placePairs(plan);
  for(const label of plan.labels)label.views=label.drawn?labelViews(label,plan):[];
  // A letter whose pieces, drilled alike, have a pair's holes measured from different corners of their place (a
  // post met by cross pieces that come at it from either side), where the numbers from those corners differ, is
  // labelled again with the corner each hole is measured from as part of how it is drilled: its pieces then split
  // into labels that each read true (cornerSplitLetters).
  const split=cornerSplitLetters(plan);
  if(split.size){
    plan.cornerAware=split;
    plan.labels=plan.labels.filter(label=>!split.has(label.letter));
    plan.nothing=plan.nothing.filter(entry=>!split.has(entry.letter));
    for(const letter of letters)if(split.has(letter))labelLetter(plan,letter,byLetter.get(letter));
    plan.labels.sort((a,b)=>labelNameOrder(a.name,b.name));
    finishLabels(plan);
    for(const label of plan.labels)label.views=label.drawn?labelViews(label,plan):[];
  }
  // a label whose face 1 is seen once it is built goes on painter's tape (spec 11, 3.2): the drawn ones only
  for(const label of plan.labels)if(label.drawn&&label.way&&!label.mirror)label.tape=labelFaceShows(label);
  for(const label of plan.labels)if(label.mirror)label.tape=!!label.twin.tape;
  plan.byFastener=new Map();
  for(const hole of plan.holes){if(!plan.byFastener.has(hole.f))plan.byFastener.set(hole.f,[]);plan.byFastener.get(hole.f).push(hole);}
  for(const entry of plan.nothing)for(const p of entry.pieces)plan.labelOfPiece.set(p.id,entry.label||{name:entry.name,letter:entry.letter,nothing:true});
  plan.labelOf=piece=>{const label=plan.labelOfPiece.get(piece.id);return label?label.name:letterOf(piece);};
  plan.holesOfPiece=piece=>plan.byPiece.get(piece.id)||[];
  /* covers(links): when every hole drilled ahead of these joints is on a drawing that is shown, the drawings and the
     settings that hold them ({labels: ['C'], tags: [1]}); else null */
  plan.covers=links=>{
    const labels=new Set(),tags=new Set(),mirrors=new Map();
    let any=false;
    for(const link of links){
      for(const f of fastenersOfLink(link)){
        if(!drilledAhead(drillKindOf(f)))return null;
        // every hole of the fastener (a clearance hole and its pilot: both pieces) on a drawing that is shown
        const holes=plan.byFastener.get(f)||[];
        if(!holes.length)return null;
        for(const hole of holes){
          const label=plan.labelOfPiece.get(hole.piece.id);
          if(!label||!label.drawn||label.nothing)return null;
          labels.add(label.mirror?label.twin.name:label.name);
          // (a mirror image shares its twin's drawing: the reference names it, so nobody looks for a drawing A2)
          if(label.mirror)mirrors.set(label.twin.name,label.name);
          tags.add(hole.setup);
        }
        any=true;
      }
    }
    if(!any)return null;
    const sorted=[...tags].sort((a,b)=>a-b);
    return{labels:[...labels].sort(labelNameOrder),tags:sorted,tagWords:sorted.map(no=>tagWord(plan.setups[no-1])),mirrors};
  };
  // the step of each hole, once the steps are numbered (makeBuildPlan calls it)
  plan.number=stepOfLink=>{
    for(const hole of plan.holes)hole.step=stepOfLink.get(hole.link)||0;
    for(const entry of plan.other)entry.step=stepOfLink.get(entry.link)||0;
    plan.stepOfLink=stepOfLink;
  };
  return plan;
}
/* The labels of one cut-list letter (spec 11, 3.1): its pieces sorted into ways of drilling, or the Nothing line */
function labelLetter(plan,letter,list){
  const pieces=list.slice().sort(pieceOrder);
  if(!pieces.some(p=>plan.byPiece.has(p.id))){
    plan.nothing.push({name:letter,letter,pieces,count:pieces.length,label:null});
    return;
  }
  for(const label of labelPieces(letter,pieces,plan)){
    // pieces of a letter drilled more than one way that have nothing to drill go on the Nothing line under their number
    if(label.way)plan.labels.push(label);
    else plan.nothing.push({name:label.name,letter:label.letter,pieces:label.members.map(m=>m.piece),count:label.members.length,label});
  }
}
/* After labelling: the Nothing line in cut-list order, which labels are drawn (at most DRILL_DRAWINGS_MAX; past that
   the labels are listed and their lines keep the marking views), and each piece's label and frame */
function finishLabels(plan){
  plan.nothing.sort((a,b)=>letterOrder(a.letter,b.letter)||(a.name<b.name?-1:1));
  const drawings=plan.labels.filter(label=>!label.mirror);
  drawings.forEach((label,index)=>{label.drawn=index<DRILL_DRAWINGS_MAX;});
  for(const label of plan.labels)if(label.mirror)label.drawn=label.twin.drawn;
  plan.complete=plan.labels.every(label=>label.drawn);
  plan.labelOfPiece=new Map();plan.memberOf=new Map();
  for(const label of plan.labels)for(const member of label.members){plan.labelOfPiece.set(member.piece.id,label);plan.memberOf.set(member.piece.id,member);}
}
/* The letters whose drawings would print numbers for a pair of holes that do not read true on every piece: a piece
   of the label whose hole's place, measured from the corner its drawing draws, gives other numbers than from the
   corner the hole really has (the one the other piece's drawing measures from). Numbers that read the same from
   both corners (a screw in the middle of a cleat) do not count. Returns a Set of letters. */
function cornerSplitLetters(plan){
  const split=new Set();
  for(const label of plan.labels){
    if(!label.way||!label.drawn||split.has(label.letter))continue;
    const base=label.mirror?label.twin:label;
    if(!base.views)continue;
    for(const member of label.members){
      if(split.has(label.letter))break;
      for(const pair of entriesOfPiece(label,member.piece,member.frame,plan).pairs){
        const hole=pair.hole,drawn=pair.entry.hole;
        if(!hole.place||!drawn.place)continue;
        // the corner the drawing draws (the sample's, as the sample's view sees it) and the true one, on this piece
        const drawnCorner=benchPoint(pair.view.frame,cornerOfPlace(drawn.place,drawn.piece)),trueCorner=benchPoint(pair.frame,cornerOfPlace(hole.place,hole.piece));
        if(Math.abs(drawnCorner.a-trueCorner.a)<=DRILL_SAME&&Math.abs(drawnCorner.b-trueCorner.b)<=DRILL_SAME)continue;
        // the numbers of every hole of this place, from each corner, as unordered pairs
        const at=pair.frame,mine=(plan.byPiece.get(member.piece.id)||[]).filter(one=>one.place===hole.place).map(one=>benchPoint(at,one.at));
        const numbers=corner=>mine.map(p=>`${r16(Math.abs(p.a-corner.a))}|${r16(Math.abs(p.b-corner.b))}`).sort().join(';');
        if(numbers(drawnCorner)!==numbers(trueCorner)){split.add(label.letter);break;}
      }
    }
  }
  return split;
}
/* Spec 11, 4.4: a hole and the hole it meets in the other piece (a clearance hole and its pilot, the two holes of a
   dowel) are measured on both drawings from the same corner of the place where the two pieces touch, so both
   drawings carry the same numbers and a cut a little long or short at a far end moves nothing. The corner is the
   one nearest the end with the label and the top edge of the piece the screw goes through (for a dowel, the first
   of the two pieces), so pieces drilled alike are measured alike. hole.place = {link, corner (a point in the
   room), k (the axis square to the place), u, v (the two along it), ru, rv (its extent along u and v)}. */
/* (rule 14, js/fasteners.js: the layout puts every hole a bit makes on whole sixteenths from the low corner of the
   place. A place whose length or width is not a whole number of sixteenths has holes off the sixteenth from its
   other corners, so only a corner from which every hole of the place is on a whole sixteenth is taken.) */
const onSixteenthFrom=(value,from)=>Math.abs((value-from)*16-Math.round((value-from)*16))<.02;
function placePairs(plan){
  const byLink=new Map();
  const holesOfLink=new Map();
  for(const hole of plan.holes){
    if(!hole.mate)continue;
    if(!holesOfLink.has(hole.link))holesOfLink.set(hole.link,[]);
    holesOfLink.get(hole.link).push(hole);
  }
  for(const hole of plan.holes){
    if(!hole.mate)continue;
    let place=byLink.get(hole.link);
    if(!place){
      const j=hole.link.joint;
      const corners=[];
      for(const u of j.ru)for(const v of j.rv){const p=[0,0,0];p[j.k]=j.plane;p[j.u]=u;p[j.v]=v;corners.push(p);}
      const holes=holesOfLink.get(hole.link);
      const whole=p=>holes.every(one=>onSixteenthFrom(one.at[j.u],p[j.u])&&onSixteenthFrom(one.at[j.v],p[j.v]));
      const onSixteenths=corners.filter(whole).length?corners.filter(whole):corners;
      // The corners that lie on the most ends and edges of the two pieces themselves (C2 of the stage 2 review): an
      // apron set flush with the top of a leg is measured from the leg's top end, never across the leg from its
      // bottom end, where a leg cut a little short would move the holes off the apron's (the owner's rule: "measured
      // from ends and edges that meet at the joint, never from far ends").
      const onEdges=p=>[hole.f.through,hole.f.into].reduce((sum,piece)=>{
        const b=plainBox(piece);
        return sum+[j.u,j.v].filter(axis=>Math.abs(p[axis]-b.lo[axis])<.02||Math.abs(p[axis]-b.hi[axis])<.02).length;
      },0);
      const most=Math.max(...onSixteenths.map(onEdges));
      const usable=onSixteenths.filter(p=>onEdges(p)===most);
      // Each piece's own first corner: the one nearest its end with the label, then its top edge, then its face 1
      // (an end seen square on has all four at the end). Pieces drilled alike, or as mirror images, then have their
      // holes measured from the same corner of their own, so one drawing serves them all. The corner first for both
      // pieces is taken; else the one first for the piece of the label with more pieces (a single top can be
      // measured from any corner, two aprons drilled alike from one only); else the one first for the piece the
      // screw goes through.
      const firstFor=piece=>{
        const one=plan.memberOf.get(piece.id);
        if(!one||!one.frame)return null;
        const key=p=>{const at=benchPoint(one.frame,p),axis=mainAxis(one.frame.n);return[r16(at.a),r16(at.b),r16(-p[axis]*Math.sign(one.frame.n[axis]))];};
        return usable.slice().sort((p,q)=>{const x=key(p),y=key(q);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];})[0];
      };
      const piecesOfLabel=piece=>{const label=plan.labelOfPiece.get(piece.id);return label?label.members.length+(label.mirrorLabel?label.mirrorLabel.members.length:0)+(label.mirror?label.twin.members.length:0):1;};
      const throughFirst=firstFor(hole.f.through),intoFirst=firstFor(hole.f.into);
      let corner=throughFirst||intoFirst||usable[0];
      // (holes that read the same from both corners, a diagonal pair in the end of a leg, three screws centred along a
      //  rail: each drawing measures them from its own first corner, so each hooks its tape on its own end with the
      //  label (R15 of the stage 2 review), with the same numbers; the places on one piece, the legs under a top, are
      //  then still measured alike and share a row)
      const numbers=c=>holes.map(one=>`${r16(Math.abs(one.at[j.u]-c[j.u]))}|${r16(Math.abs(one.at[j.v]-c[j.v]))}`).sort().join(';');
      const sameFromBoth=throughFirst&&intoFirst&&numbers(throughFirst)===numbers(intoFirst);
      if(throughFirst&&intoFirst&&throughFirst!==intoFirst&&!sameFromBoth&&piecesOfLabel(hole.f.into)>piecesOfLabel(hole.f.through))corner=intoFirst;
      place={link:hole.link,corner,k:j.k,u:j.u,v:j.v,ru:j.ru.slice(),rv:j.rv.slice()};
      if(sameFromBoth&&throughFirst!==intoFirst)place.cornerOf=new Map([[hole.f.through.id,throughFirst],[hole.f.into.id,intoFirst]]);
      byLink.set(hole.link,place);
    }
    hole.place=place;
  }
}
/* the corner of a place that this piece's drawing measures from (the same for both pieces, unless the holes read
   the same from each piece's own first corner: placePairs) */
const cornerOfPlace=(place,piece)=>(place.cornerOf&&piece&&place.cornerOf.get(piece.id))||place.corner;
/* the kinds of hole, in words: what a beginner calls them */
const HOLE_NOUNS={pocket:'pocket hole',clear:'clearance hole',pilot:'pilot hole',dowel:'dowel hole'};
/* '11 pocket holes, 4 pilot holes' for the holes of one piece */
function holeCountWords(holes,each){
  const counts=new Map();
  for(const hole of holes)counts.set(hole.kind,(counts.get(hole.kind)||0)+1);
  const words=['pocket','clear','pilot','dowel'].filter(kind=>counts.get(kind)).map(kind=>{
    const n=counts.get(kind);
    return`${n} ${HOLE_NOUNS[kind]}${n===1?'':'s'}`;
  });
  return words.join(', ')+(each?' each':'');
}
/* 'A' < 'B' < ... < 'Z' < 'AA' */
const letterOrder=(a,b)=>a.length-b.length||(a<b?-1:a>b?1:0);
const labelNameOrder=(a,b)=>{
  const[, la,na]=String(a).match(/^([A-Z]+)(\d*)$/)||[0,a,''],[, lb,nb]=String(b).match(/^([A-Z]+)(\d*)$/)||[0,b,''];
  return letterOrder(la,lb)||(+na||0)-(+nb||0);
};
/* back, left, bottom first (the order whichOne names them in) */
function pieceOrder(a,b){
  const ca=plainBox(a),cb=plainBox(b),mid=box=>box.lo.map((v,k)=>(v+box.hi[k])/2);
  const ma=mid(ca),mb=mid(cb);
  return(ma[2]-mb[2])||(ma[0]-mb[0])||(ma[1]-mb[1])||(a.id-b.id);
}
/* Spec 11, 3.1 and 3.3: the pieces of one letter sorted into ways of drilling. Pieces whose holes match under a
   turn of the box are drilled alike (one label); a mirror image is its own label and shares its twin's drawing;
   anything else gets a label of its own. Returns the labels of this letter, the way with the most pieces first. */
function labelPieces(letter,pieces,plan){
  const dims=pieceDims(pieces[0]);
  const ways=[];   // {pattern, sample, members:[{piece, sym}], mirrors:[{piece, sym}], first}
  const bare=[];
  const corners=!!(plan.cornerAware&&plan.cornerAware.has(letter));
  pieces.forEach((piece,order)=>{
    const holes=plan.byPiece.get(piece.id)||[];
    if(!holes.length){bare.push(piece);return;}
    const pattern=localPattern(piece,holes,corners);
    for(const way of ways){
      const turn=symmetryBetween(dims,pattern,way.pattern,1);
      if(turn){way.members.push({piece,sym:turn});return;}
    }
    for(const way of ways){
      const mirror=symmetryBetween(dims,pattern,way.pattern,-1);
      if(mirror){way.mirrors.push({piece,sym:mirror});return;}
    }
    ways.push({pattern,sample:piece,holes,members:[{piece,sym:boxSymmetries(dims)[0]}],mirrors:[],first:order});
  });
  // A1 is the way with more pieces (a mirror pair counts as one way and its mirror as the next)
  ways.sort((a,b)=>(b.members.length+b.mirrors.length)-(a.members.length+a.mirrors.length)||a.first-b.first);
  const single=ways.length===1&&!ways[0].mirrors.length&&!bare.length;
  const labels=[];
  let number=0;
  const nameOf=()=>single?letter:letter+(++number);
  for(const way of ways){
    const faces=facesOf(way.holes,way.sample);
    const frame=datumOf(way.sample,way.holes,faces);
    const label={name:nameOf(),letter,way,faces,frame,mirror:false,twin:null,members:[],holesEach:way.holes.length,
      symmetric:samePattern(transformPattern(END_FOR_END,dims,way.pattern),way.pattern)};
    // each piece taken onto the drawing the way that keeps its label out of sight, where its holes allow a choice
    const rechoose=(member,det)=>{
      if(member.piece===way.sample)return;
      const pattern=localPattern(member.piece,plan.byPiece.get(member.piece.id)||[],corners);
      const sym=bestSymmetryBetween(dims,pattern,way.pattern,det,s=>faceHiddenScore(member.piece,carriedFrame(way.sample,frame,member.piece,s).n));
      if(sym)member.sym=sym;
    };
    way.members.forEach(member=>rechoose(member,1));
    way.mirrors.forEach(member=>rechoose(member,-1));
    label.members=way.members.map(member=>({piece:member.piece,sym:member.sym,frame:carriedFrame(way.sample,frame,member.piece,member.sym)}));
    labels.push(label);
    if(way.mirrors.length){
      const twin={name:nameOf(),letter,way,faces,frame,mirror:true,twin:label,members:[],holesEach:way.holes.length,symmetric:false};
      twin.members=way.mirrors.map(member=>({piece:member.piece,sym:member.sym,frame:carriedFrame(way.sample,frame,member.piece,member.sym)}));
      label.mirrorLabel=twin;
      labels.push(twin);
    }
  }
  if(bare.length)labels.push({name:nameOf(),letter,way:null,members:bare.map(piece=>({piece,frame:null})),holesEach:0});
  for(const label of labels)label.signature=label.way?drillSignature(label):'';
  return labels;
}
/* the faces of a piece that have holes, the face with the holes at the ends first (else the face with the most) */
function facesOf(holes,piece){
  const faces=[];
  for(const hole of holes)if(!faces.some(face=>sameVector(face,hole.out)))faces.push(hole.out.slice());
  const lengthAxis=piece.ax[0];
  // (stage 1 as it was: pocket holes, those at the ends first; then the faces a bit drills: a face along the piece
  //  before an edge, an edge before an end)
  const where=face=>mainAxis(face)===piece.ax[0]?0:mainAxis(face)===piece.ax[1]&&Math.abs(piece.w-piece.t)>DRILL_SAME?1:2;
  const score=face=>{
    const on=holes.filter(hole=>sameVector(hole.out,face)),pockets=on.filter(hole=>!straightHole(hole));
    return pockets.filter(hole=>holeClampKind(hole,lengthAxis)==='end').length*1e6+pockets.length*1e4+where(face)*1e3+on.length;
  };
  return faces.sort((a,b)=>score(b)-score(a));
}
/* a short text that changes when the holes of a label change (the Done boxes are kept under it) */
function drillSignature(label){
  // (with how deep: a longer screw takes a deeper pilot hole, and the ticks must go: C24 of the stage 2 review)
  const frame=label.frame,text=label.way.holes.map(hole=>{const at=benchPoint(frame,hole.at);return[r16(at.a),r16(at.b),hole.setup,mainAxis(hole.out),r16(hole.depth||0)].join(',');}).sort().join(';');
  let hash=0;
  for(let i=0;i<text.length;i++)hash=(hash*31+text.charCodeAt(i))|0;
  return(hash>>>0).toString(36);
}

/* ---------- the views of one drawing (spec 11, 4.3) ----------
   One view per face with holes; a mirror pair: the face as drawn and its mirror image. Each view lists its holes in
   bench terms: a (from the end with the label), b (down from the top edge), how the jig goes, and its setting. */
function labelViews(label,plan){
  if(label.mirror)return label.twin.views;
  const sample=label.way.sample,views=[];
  // face 1 and face 2 first, then the edges, then the ends
  const order=['face1','face2','topedge','bottomedge','labelend','farend'];
  const faceViews=label.faces.map(face=>({face,...viewOfFace(label.frame,face,sample)})).sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
  for(const one of faceViews)views.push(makeView(sample,one.frame,label.way.holes.filter(hole=>sameVector(hole.out,one.face)),one.kind,false));
  // a mirror pair on one face: the second view is the same picture end for end, measured from the other end
  if(label.mirrorLabel&&views.length===1)views.push(makeView(sample,views[0].frame,views[0].holes.map(entry=>entry.hole),'mirror',true));
  void plan;
  return views;
}
/* how a hole is set out on a view: a pocket hole by the jig, clamped against an end ('labelled', 'far') or an edge
   ('top', 'bottom'); a hole a bit makes square into the face ('face') */
function entryClamp(hole,frame){
  if(straightHole(hole))return'face';
  const dAlong=dotOf(hole.dir,frame.along),dDown=-dotOf(hole.dir,frame.up);
  return Math.abs(dAlong)>=Math.abs(dDown)?(dAlong<0?'labelled':'far'):(dDown<0?'top':'bottom');
}
function makeView(piece,frame,holes,kind,mirrored){
  const L=piece[['l','w','t'][piece.ax.indexOf(frame.lengthAxis)]],H=piece[['l','w','t'][piece.ax.indexOf(frame.upAxis)]];
  // (the mirror image is the same picture end for end: every number from its own end with the label, which is on
  //  the other side of the paper)
  const left=datumOnLeft(frame)!==mirrored;
  const entries=holes.map(hole=>{
    const at=benchPoint(frame,hole.at),a=at.a;
    // the way the screw comes out: along (toward the far end +) and down (+)
    const dAlong=dotOf(hole.dir,frame.along),dDown=-dotOf(hole.dir,frame.up);
    return{hole,a,b:at.b,dAlong,dDown,clamp:entryClamp(hole,frame),setup:hole.setup,key:holeKey(hole),plugged:hole.plugged};
  }).sort((x,y)=>x.setup-y.setup||x.a-y.a||x.b-y.b);
  return{kind,frame,mirrored,datumLeft:left,length:L,height:H,holes:entries,piece,mix:VIEW_MIX[kind]||VIEW_MIX.face1};
}

/* ---------- words ---------- */
const jigWords=jig=>fmt(jig);
/* the name of the design for a sentence: "this desk"; a design that is not one preset: "this design" */
function designWord(){
  // (S.sets: the placements, by number; only those that still have pieces count)
  const used=new Set(S.parts.map(p=>p.set).filter(set=>set!==undefined));
  const sets=[...used].map(set=>S.sets&&S.sets[set]).filter(Boolean),name=String(S.name||'').trim();
  if(S.parts.some(p=>p.set===undefined&&!isProp(p)))return'design';
  if(sets.length===1&&sets[0].name===name&&name.split(/\s+/).length<=3&&!/[\/(]/.test(name))return name.toLowerCase();
  return'design';
}
/* the setting of a hole, for the tables: 'Jig set for 1 1/2" stock' */
const settingWords=setup=>`Jig set for ${jigWords(setup.jig)} stock`;
/* The reference that replaces the "where" sentence of a pre-drilled line (spec 11, 1.4) */
function drilledAlready(cover){
  const names=cover.labels.map(name=>cover.mirrors&&cover.mirrors.has(name)?`${name} (${cover.mirrors.get(name)} is its mirror image)`:name);
  // ("part drawing C" is a link to the drawing on the Cut list page: linkPartWords, js/shoppacket.js)
  const drawings=names.length>1?`part drawings ${listWords(names)}`:`part drawing ${names[0]}`;
  const holes=cover.tagWords||cover.tags.map(tag=>'⬡'+tag);
  return`The holes are made already: ${drawings}, holes ${listWords(holes)}.`;
}
/* the tag of a setting in words: '⬡1' for a setting of the pocket-hole jig, '(3)' for a bit (the drawings draw that
   one in a circle) */
const tagWord=setup=>setup.kind==='bit'?`(${setup.no})`:'⬡'+setup.no;
/* The "Fasten with" lines of a step whose holes are all on drawings that are shown: the line stays, its "where"
   sentence is kept on the line (whereKept, for the self-check) and replaced by the reference (spec 11, 1.4, 5.3) */
/* (stage 2: the lines of wood screws, plugged screws and dowels too. Their words that tell to drill a counterbore or
   a pilot hole are said as drilled already: the counterbore sentence goes, and the words on plugging the heads say
   the heads sink into the counterbores drilled in step 2, plugWords in js/buildsteps.js) */
const PREDRILLED_TYPES=['pocket','screw','plug','dowel'];
function markPredrilled(groups,drill){
  if(!drill||!drill.total)return;
  for(const group of groups){
    if(!PREDRILLED_TYPES.includes(group.type))continue;
    const cover=drill.covers(group.links);
    if(!cover)continue;
    group.predrilled=cover;
    group.whereKept=group.where;
    group.where=drilledAlready(cover);
    // (the fastener the line's words were written from, fastenLine in js/buildsteps.js: C13 of the stage 2 review)
    const sample=group.sunkFastener||(group.sample&&group.sample.layout.find(f=>f.sunk>0));
    if(!sample)continue;
    if(sample.plug){
      const drilled=plugWords(sample,true);
      if(group.plugText)group.line=group.line.split(group.plugText).join(drilled);
      group.plugText=drilled;
    }else group.line=group.line.split(` Drill a hole ${inchWords(sample.sunk)} deep for each head first (a counterbore), so the screw reaches far enough.`).join('');   // (the reference to the drawing says the holes are drilled: said once, R17)
  }
}
/* The preset's own sentences that tell the person to drill pocket holes (step.drill: a string, a list, or per
   style {std, fine, rustic}, written by styledStep in js/style.js). They stay in the words of the step; while
   step 2 holds every pocket hole of the design they are taken out of what the step shows (spec 11, 5.2). */
function drillTextOf(step){
  const drill=step&&step.drill;
  if(!drill)return[];
  const mine=typeof drill==='string'||Array.isArray(drill)?drill:drill[look().style]||drill.std||[];
  return(Array.isArray(mine)?mine:[mine]).filter(Boolean);
}
/* The sentences of some words that tell the person to drill pocket holes ("Drill the pocket holes listed below in
   its underside", "(drill them before the rails go in)"); a sentence about holes already drilled ("from holes
   drilled in its back face") does not count. For the self-check and for designs saved before step 2. */
function drillOrders(text){
  // (the verb "drill" with the holes as its object: not "a drill with the long pocket-hole bit")
  return String(text).split(/(?<=[.:;])\s+|\(|\)/).filter(sentence=>
    /\bdrill (the|those|these|them|all|every|each)\b[^.]*\bholes\b|\bdrill (them|those holes)\b|\bdrill the pocket holes\b/i.test(sentence)&&
    !/\bpilot\b|\bcup\b|\bpulls?\b/i.test(sentence));
}
/* Stage 2: the sentences of some words that tell to drill a dowel hole, or the clearance hole or counterbore of a
   wood screw ("drill the holes with a doweling jig", "drill a clearance hole for each screw", "drill the screw holes
   through the sides now, each with a counterbore"). [{kind: 'dowel' | 'screw', sentence}]. A sentence about holes
   already drilled ("the holes drilled in step 2") is not an order. For the self-check noHoleDrilledTwice. */
const BORE_ORDERS=[
  {kind:'dowel',test:/\bdrill (?:the |each |every |all )?(?:dowel )?holes? with a doweling jig\b|\bdrill (?:the |each |every |all )?dowel holes?\b/i},
  {kind:'screw',test:/\bdrill (?:a |the |each |every |all )?clearance holes?\b|\bdrill (?:the )?screw holes\b|\bdrill (?:a |the )?counterbores?\b|\bdrill a hole [^.]*deep for each head\b/i},
];
function boreOrders(text){
  const found=[];
  for(const sentence of String(text).split(/(?<=[.:;])\s+|\(|\)/))for(const order of BORE_ORDERS)if(order.test.test(sentence))found.push({kind:order.kind,sentence});
  return found;
}
/* The names of the pieces that every drawing of the pieces they lie on pencils on (drawn dashed, with where they go):
   a name counts when each piece of it is drawn dashed on some drawing. Worked out once per plan. */
function piecesPencilledOn(drill){
  if(drill.pencilled)return drill.pencilled;
  const seen=new Set();
  for(const label of drill.labels){
    if(!label.drawn||!label.way||label.mirror)continue;
    for(const view of label.views){
      if(view.kind==='mirror')continue;
      for(const other of dashedPieces(view,{}))seen.add(other.piece.id);
      for(const place of viewPlaces(view))if(place.dashed)seen.add(place.other.id);
    }
  }
  const names=new Set(S.parts.filter(p=>seen.has(p.id)).map(p=>p.name));
  for(const p of S.parts)if(names.has(p.name)&&!seen.has(p.id))names.delete(p.name);
  drill.pencilled=names;
  return names;
}
/* groups: the "Fasten with" lines of the step (carry-over 10): its sentences go when its own lines are all drilled
   already, not when the whole design is (a design past DRILL_DRAWINGS_MAX keeps them only where a line keeps its
   marking view); a step with no such line goes by the whole design */
function withoutDrillWords(words,step,drill,groups){
  if(!drill||!drill.total)return words;
  const held=drillWordsHeld(drill,groups);
  let text=String(words);
  // (the pilot words go with the step's own lines of wood screws whose holes are drilled ahead; a step with none,
  //  its screws all structural or driven at a slant, keeps them: they are about holes still made at assembly)
  if(held.screwLines&&held.screw&&drill.holes.some(hole=>hole.kind==='pilot'))text=withoutPilotWords(text);
  for(const sentence of drillTextOf(step)){
    // a plain sentence tells to drill pocket holes: it goes when the step's pocket holes are on drawings
    if(typeof sentence!=='object'){if(held.pocket)text=text.split(sentence).join('');continue;}
    // ({text, pencilled: a piece name}: a sentence that tells to mark where that piece goes, left out only when the
    //  drawings of step 2 already pencil every such piece on: carry-over 4, "say it once")
    if(sentence.pencilled){
      if(held.pocket&&piecesPencilledOn(drill).has(sentence.pencilled))text=text.split(sentence.text).join('');
      continue;
    }
    // ({text, kind: 'dowel' or 'screw'}: a sentence that tells to drill dowel holes, or the clearance holes and
    //  counterbores of wood screws: it goes when those holes of the step are on drawings, stage 2)
    if(sentence.kind&&held[sentence.kind])text=text.split(sentence.text).join('');
  }
  return text===String(words)?words:text.replace(/ {2,}/g,' ').replace(/ ([.,])/g,'$1').trim();
}
/* Which kinds of hole of a step are all on drawings, so that the step's words that tell to drill them go:
   {pocket, screw, dowel, screwLines}. A kind is held when the step's own lines of it are all pre-drilled; a step with
   no line of that kind (a marking step that tells to drill ahead) goes by the whole design: every drawing shown and
   the design has such holes drilled ahead. */
function drillWordsHeld(drill,groups){
  // (lines whose holes are drilled ahead: not structural screws, which need none)
  const drilledKind=group=>group.links.some(link=>fastenersOfLink(link).some(f=>drilledAhead(drillKindOf(f))));
  const of=types=>(groups||[]).filter(group=>types.includes(group.type)&&drilledKind(group));
  const kindHeld=(lines,holeKinds)=>lines.length?lines.every(group=>group.predrilled):drill.complete&&drill.holes.some(hole=>holeKinds.includes(hole.kind));
  const pockets=(groups||[]).filter(group=>group.type==='pocket'),screws=of(['screw','plug']),dowels=of(['dowel']);
  return{pocket:pockets.length?pockets.every(group=>group.predrilled):drill.complete,
    screw:kindHeld(screws,['clear','pilot']),dowel:kindHeld(dowels,['dowel']),screwLines:screws.length>0};
}
/* The presets' own words that tell to drill the pilot holes of wood screws, and what they say once step 2 holds
   those holes. They are in the step texts of several builders (js/presets.js, js/builders-storage.js,
   js/builders-outdoor.js, js/nightstand.js, js/casesteps.js, js/computerdesk.js); they are worded here, in one
   place, rather than in each builder. Pilot holes for brads, for a screw eye and for screws at a slant are not
   these: they are made at assembly. The self-check (pilotOrders, noHoleDrilledTwice) finds any that is left. */
const PILOT_WORDS=[
  [/Drill pilot holes, add glue, and drive/g,'Add glue and drive'],
  [/, drill pilot holes,? and (screw|drive)/g,' and $1'],
  [/\bDrill pilot holes and drive/g,'Drive'],
  [/Drill pilot holes first, because these screws are close to the ends of the tie\./g,''],
  [/Drill pilot holes first: the strips are thin and split easily\./g,''],
  [/Drill pilot holes first so the post tops do not split, and drive/g,'Drive'],
  [/Drill pilot holes, and set the screw heads/g,'Set the screw heads'],
  [/: drill pilot holes and set the heads just below the surface\./g,': set the heads just below the surface.'],   // (js/diningchair.js, Rustic seat boards)
  [/ with pilot holes, heads just below the surface/g,', heads just below the surface'],   // (js/diningchair.js, Rustic front seat board: C22)
  [/: pilot holes, glue, and two screws/g,': glue, and two screws'],
  [/wood screws take a pilot hole, structural screws do not, and the list says where a head needs a deep hole first/g,'the holes of the wood screws are drilled already, and structural screws need none'],
  [/Drill the pilot holes for the screws listed below straight down through the top, on the line where each support's bottom edge will sit\./g,'The holes for the screws listed below are made already, from the part drawings.'],
  // (js/computerdesk.js, the cable tray step, deskTraySteps: the lip onto the tray bottom, then the tray onto the
  //  back apron; the screws are wood screws, so step 2 drills their holes)
  [/; drill pilot holes through the bottom into the lip and drive the screws/g,'; drive the screws'],
  [/Hold it there, drill pilot holes down through (the middle of [^,.]* of tray bottom that lies on the apron), into its edge, and drive the screws listed below\./g,
    'Hold it there and drive the screws listed below down through $1, into its edge.'],
];
function withoutPilotWords(text){
  let out=String(text);
  for(const[pattern,instead]of PILOT_WORDS)out=out.replace(pattern,instead);
  return out;
}
/* The sentences of some words that tell to drill the pilot holes of wood screws (not those of brads, of a screw eye,
   or of screws at a slant, which are made at assembly) */
function pilotOrders(text){
  return String(text).split(/(?<=[.:;])\s+|\(|\)/).filter(sentence=>
    (/\bdrill(?:s|ing)? (?:the |a )?pilot holes?\b|\bpilot holes, glue\b|\bwood screws take a pilot hole\b/i.test(sentence))&&
    !/\bthin pilot hole\b|\bscrew eye\b|\bsame slant\b|\bbrads?\b/i.test(sentence));
}
/* What the drilled pieces of one cut-list row get, for its Drawing column (spec 14, 4.1; it was the Drill first
   column of spec 11, 1.3): '11 pocket holes each', '1 as H1, 1 as H2 (mirror images): 3 pocket holes each', or ''
   when no piece of the row has a hole drilled ahead. Every way of a letter is named, the pieces of it with nothing
   to drill too. */
function drillHolesWords(row,drill){
  if(!drill||!drill.total)return'';
  const labels=drill.labels.filter(label=>label.letter===row.id);
  if(!labels.length)return'';
  // every kind, counted: '11 pocket holes, 4 pilot holes each'
  const holes=label=>holeCountWords(label.way.holes,false);
  // the pieces of this letter that have nothing to drill ('A2 (1)' on the Nothing line), said in every form
  const bare=drill.nothing.filter(entry=>entry.letter===row.id&&entry.label);
  const bareWords=bare.map(entry=>`; ${entry.count} as ${entry.name}: nothing to drill`).join('');
  if(labels.length===1&&!bare.length){
    const label=labels[0],count=label.members.length;
    return`${holes(label)}${count>1?' each':''}`;
  }
  const mirrorPair=labels.length===2&&labels[1].mirror&&labels[1].twin===labels[0];
  if(mirrorPair)return`${labels[0].members.length} as ${labels[0].name}, ${labels[1].members.length} as ${labels[1].name} (mirror images): ${holes(labels[0])} each${bareWords}`;
  return labels.map(label=>`${label.members.length} as ${label.name}: ${holes(label)}${label.members.length>1?' each':''}${label.mirror?' (mirror image of '+label.twin.name+')':''}`)
    .concat(bare.map(entry=>`${entry.count} as ${entry.name}: nothing to drill`)).join('; ');
}

/* ---------- Put in (spec 11, 3.4) ----------
   For each labelled piece of an assembly step: which way its label faces, where its arrow points, and where the end
   with the label goes. Only what the holes fix is said; a piece the same from either end says so. */
function directionWord(v,forFace){
  const axis=mainAxis(v),high=v[axis]>0;
  if(axis===1)return high?'up':'down';
  if(axis===2)return forFace?(high?'the front':'the back'):(high?'to the front':'to the back');
  return forFace?(high?'the right':'the left'):(high?'to the right':'to the left');
}
/* a piece this near the middle of the design (inches, either side) is told its facing by a direction in the room:
   "in" says nothing for a center leg beside the middle of a bed (R13 of the stage 2 review) */
const NEAR_MIDDLE=6;
function faceDirectionWords(piece,n){
  const axis=mainAxis(n),high=n[axis]>0;
  if(axis===1)return high?'facing up':'facing down';
  const b=plainBox(piece),middle=designMiddle(piece),other=axis===0?2:0;   // (a unit's piece: its own chair's middle, js/fasteners.js)
  // A piece of a unit (a chair of a set, js/chairsets.js) is told in and out of its own chair: one step is done the
  // same way for every chair of the set, and the chairs face four ways, so a direction in the room would be right for
  // one chair only. Only a piece across its own chair's very middle takes a direction.
  const ownUnit=!!piece.unit,reach=ownUnit?.5:NEAR_MIDDLE;
  // (near the middle either way across the room: "in" could be read toward either middle, so the room's direction)
  const near=k=>middle[k]>b.lo[k]-reach&&middle[k]<b.hi[k]+reach;
  if(near(axis)||(!ownUnit&&near(other))){
    // ("side", not "end": the ends of a bed are its head and foot)
    return axis===0?`facing the ${high?'right':'left'} side of the ${designWord()}`:`facing ${high?'the front':'the back'}`;
  }
  const inward=high===(middle[axis]>(b.lo[axis]+b.hi[axis])/2);
  if(inward)return'facing in';
  return axis===2?`facing ${high?'the front':'the back'}`:'facing out';
}
/* the pieces fastened against one end of a piece (along the frame's length): those whose box meets that end face.
   placed(p): is that piece in already when this one goes in (a piece put in later is not named: the person cannot
   see it yet, R13 of the stage 2 review); left out, every piece counts. */
function piecesAtEnd(piece,frame,atLabel,placed){
  const b=plainBox(piece),k=frame.lengthAxis,labelHigh=frame.along[k]<0,high=atLabel?labelHigh:!labelHigh;
  const face=high?b.hi[k]:b.lo[k],found=new Set();
  for(const link of connectionsOf(piece.id)){
    if(!link.fastened)continue;
    const other=link.a===piece?link.b:link.a;
    if(isProp(other)||(placed&&!placed(other)))continue;
    const o=plainBox(other),touch=high?Math.abs(o.lo[k]-face)<.03:Math.abs(o.hi[k]-face)<.03;
    if(touch)found.add(other);
  }
  return[...found];
}
/* Where the end with the label goes. Named by the piece it is fastened against when only that end meets it (the
   other end meets nothing, or other pieces); else by its direction in the room ("at the bottom", "on the left",
   "at the back"), which holds whichever way the label faces. */
function endWords(piece,frame,letterOf,placed){
  const atLabel=piecesAtEnd(piece,frame,true,placed),atFar=piecesAtEnd(piece,frame,false,placed);
  const farNames=new Set(atFar.map(p=>pieceLabel(p,letterOf)));
  const own=[...new Set(atLabel.map(p=>pieceLabel(p,letterOf)))].filter(name=>!farNames.has(name));
  if(own.length)return`the end with the label against the ${listWords(own)}`;
  return`the end with the label ${endWordsInRoom(frame)}`;
}
/* The words of one piece's Put in: which way its label faces, where its arrow points, where its end with the label
   goes. The self-check (putInPlacesEveryHole, js/partdrawings.js) puts the piece in every way these words allow
   and finds every hole where the model has it. */
function memberWords(label,member,letterOf,placed){
  const frame=member.frame,piece=member.piece;
  const parts=[`with its label ${faceDirectionWords(piece,frame.n)}`,`its arrow ${directionWord(frame.up,false)}`];
  let tail='';
  if(label.symmetric)tail='Either end can go either way.';
  else parts.push(endWords(piece,frame,letterOf,placed));
  return{text:listWords(parts),tail};
}
/* the short words of one piece in a long list of many pieces of one name (the uprights of a fish rack): its label
   and the way its label faces in the room; the arrows of a row and the end with the label are said once */
function listedPieceWords(label,frame){
  return`${label.name} facing ${directionWord(frame.n,true).replace(/^the /,'')}`;
}
/* The ways a labelled piece can be set in its place in the design: its own frame turned by every turn of its box
   (a board end for end, over, a square post a quarter turn). A person who reads the Put in words may set it in any
   of these whose words are the same as the words written; the self-check puts the holes in through each. */
function framesOfPlace(member){
  const piece=member.piece;
  return boxSymmetries(pieceDims(piece)).filter(sym=>sym.det>0).map(sym=>carriedFrame(piece,member.frame,piece,sym));
}
/* Do the holes of the drawing, put on the piece through this frame, land on the holes the model has in it (within
   1/32", the same face, the same setting, the jig against the same end or edge)? Returns the first hole that does
   not, in words, or ''. */
function holesMissedByFrame(label,piece,frame,drill){
  return entriesOfPiece(label,piece,frame,drill).missed;
}
/* The holes of one piece matched to the holes of its label's drawing, through a frame of that piece:
   {pairs: [{view, entry, hole}], missed: '' or the first hole that is not on the drawing, in words} */
function entriesOfPiece(label,piece,frame,drill){
  const pairs=[];
  // (a mirror image shares its twin's drawing: the same faces and numbers, measured from its own end with the label)
  const base=label.mirror?label.twin:label,views=base.views.filter(view=>view.kind!=='mirror');
  // each view of the drawing in this piece: its frame worked out from this piece's frame the way the drawing's
  // was from the sample's (VIEW_MIX), so an edge or an end is measured as its view measures it
  const frames=views.map(view=>frameOfView(frame,view.kind,piece));
  const used=views.map(view=>new Array(view.holes.length).fill(false));
  for(const hole of drill.byPiece.get(piece.id)||[]){
    const k=frames.findIndex(one=>sameVector(one.n,hole.out));
    if(k<0||!views[k])return{pairs,missed:`a hole on a face the drawing does not show (${piece.name})`};
    const at=benchPoint(frames[k],hole.at),clamp=entryClamp(hole,frames[k]),key=holeKey(hole);
    const index=views[k].holes.findIndex((entry,i)=>!used[k][i]&&entry.key===key&&entry.clamp===clamp&&
      Math.abs(entry.a-at.a)<=DRILL_SAME&&Math.abs(entry.b-at.b)<=DRILL_SAME);
    if(index<0)return{pairs,missed:`the hole ${fmt(r16(at.a))} from the end with the label and ${fmt(r16(at.b))} down from the top edge of ${piece.name} (${label.name})`};
    used[k][index]=true;
    pairs.push({view:views[k],entry:views[k].holes[index],hole,frame:frames[k]});
  }
  return{pairs,missed:''};
}
/* For each hole of a drawing (a view entry), the same hole in every piece the drawing makes (both of a mirror pair):
   Map entry -> [hole]. The Later column of the table reads it: the pieces of one label can go in at different
   steps and into different pieces (the bottom, the shelves and the top of a bookshelf). */
function holesOfEveryPiece(label,drill){
  const byEntry=new Map();
  const labels=[label].concat(label.mirrorLabel?[label.mirrorLabel]:[]);
  for(const one of labels)for(const member of one.members){
    for(const pair of entriesOfPiece(one,member.piece,member.frame,drill).pairs){
      if(!byEntry.has(pair.entry))byEntry.set(pair.entry,[]);
      byEntry.get(pair.entry).push(pair.hole);
    }
  }
  return byEntry;
}
function placementWords(step,plan){
  const drill=plan.drill;
  if(!drill||!drill.total)return'';
  // (the pieces in already when a piece goes in: those of its own step and of the steps before)
  const stepOf=p=>plan.stepOfPiece?plan.stepOfPiece.get(p.id):undefined;
  const placedFor=piece=>{const mine=stepOf(piece);return mine===undefined?undefined:other=>{const theirs=stepOf(other);return theirs!==undefined&&theirs<=mine;};};
  // by name: the pieces of one name that go in the same way (one label, the same words) are one group; several
  // groups of one name are told apart by where they go
  const byName=new Map();
  // a step done for each of several copies (the chairs of a set, step.oneOf, js/buildsteps.js) is told for one of them
  for(const piece of step.oneOf?step.pieces.filter(p=>step.oneOf.has(p.id)):step.pieces){
    const label=drill.labelOfPiece.get(piece.id),member=drill.memberOf.get(piece.id);
    if(!label||!label.way||!label.drawn||!member)continue;
    const said=memberWords(label,member,plan.letterOf,placedFor(piece));
    if(!byName.has(piece.name))byName.set(piece.name,[]);
    const groups=byName.get(piece.name);
    const group=groups.find(one=>one.label===label&&one.text===said.text);
    if(group)group.pieces.push(piece);else groups.push({label,text:said.text,tail:said.tail,pieces:[piece]});
  }
  if(!byName.size)return'';
  const sentences=[];
  // what was said of each piece, as a function of how it is set in (the self-check tries every way: drill.putSaid)
  const said=(piece,say)=>{if(drill.putSaid)drill.putSaid.set(piece.id,{say,said:say(drill.memberOf.get(piece.id).frame)});};
  for(const[name,groups]of byName){
    // many pieces of one name going in many ways (the uprights of a fish rack): which label goes where and which way
    // its label faces, row by row from the left; the arrows of a row and the end with the label said once
    if(groups.length>3){
      const all=groups.flatMap(group=>group.pieces);
      const labels=[...new Set(groups.map(group=>group.label))];
      const frameOf=p=>drill.memberOf.get(p.id).frame,labelOf=p=>drill.labelOfPiece.get(p.id);
      // rows front to back (pieces within 2" of each other, front to back, are one row), each from the left
      const middleZ=p=>{const b=plainBox(p);return(b.lo[2]+b.hi[2])/2;};
      const rows=[];
      for(const p of all.slice().sort((a,b)=>middleZ(a)-middleZ(b))){
        const row=rows.find(one=>Math.abs(middleZ(one[0])-middleZ(p))<2);
        if(row)row.push(p);else rows.push([p]);
      }
      const rowName=index=>rows.length===1?'':rows.length===2?(index?'in the front row':'in the back row'):`in row ${index+1} from the back`;
      const ends=new Set(all.map(p=>endWordsInRoom(frameOf(p))));
      const endSaid=ends.size===1?[...ends][0]:'';
      // one piece in each row (the slats of a bed): one short list from the back, what is the same said once
      // (R5 of the stage 2 review: thirteen "rows" of one piece, each "from the left", read badly)
      if(rows.length>2&&rows.every(row=>row.length===1)){
        const pieces=rows.map(row=>row[0]);
        const facingOf=p=>listedPieceWords(labelOf(p),frameOf(p)).replace(/^\S+ /,''),arrowOf=p=>directionWord(frameOf(p).up,false);
        const facings=new Set(pieces.map(facingOf));
        const counts=new Map();
        for(const p of pieces)counts.set(arrowOf(p),(counts.get(arrowOf(p))||0)+1);
        const usual=[...counts].sort((a,b)=>b[1]-a[1])[0][0];
        const items=pieces.map(p=>labelOf(p).name+(facings.size>1?` ${facingOf(p)}`:'')+(arrowOf(p)!==usual?` (its arrow ${arrowOf(p)})`:''));
        for(const p of pieces)said(p,frame=>[listedPieceWords(labelOf(p),frame),directionWord(frame.up,false),endSaid?endWordsInRoom(frame):''].join('|'));
        const same=[facings.size===1?`its label ${[...facings][0]}`:'',`its arrow ${usual}`,endSaid?`the end with the label ${endSaid}`:''].filter(Boolean);
        sentences.push(`the ${pluralName(name)} (${listWords(labels.map(label=>label.mirror?`${label.name}, the mirror image on drawing ${label.twin.name}`:label.name))}) in this order from the back: ${items.join(', ')}. Each goes with ${listWords(same)}${counts.size>1?', unless the list says otherwise':''}.`);
        continue;
      }
      const which=rows.map((row,index)=>{
        row.sort((a,b)=>plainBox(a).lo[0]-plainBox(b).lo[0]);
        const arrows=new Set(row.map(p=>directionWord(frameOf(p).up,false)));
        const oneArrow=arrows.size===1?[...arrows][0]:'';
        const items=row.map(p=>listedPieceWords(labelOf(p),frameOf(p))+(oneArrow?'':`, arrow ${directionWord(frameOf(p).up,false)}`));
        for(const p of row)said(p,frame=>[listedPieceWords(labelOf(p),frame),directionWord(frame.up,false),endSaid?endWordsInRoom(frame):''].join('|'));
        const head=[rowName(index),oneArrow?`arrows ${oneArrow}`:''].filter(Boolean).join(', ');
        return`${head?head+', ':''}from the left: ${items.join(', ')}`;
      });
      sentences.push(`the ${pluralName(name)} (${listWords(labels.map(label=>label.mirror?`${label.name}, the mirror image on drawing ${label.twin.name}`:label.name))}) in this order, ${which.join('; ')}. Each goes with its label facing the way the list says${endSaid?`, the end with the label ${endSaid}`:''}.`);
      continue;
    }
    const where=groups.length>1?placesApart(groups.map(group=>group.pieces)):null;
    groups.forEach((group,index)=>{
      // (a mirror image has no drawing of its own: the words say whose it shares, so nobody looks for a drawing A2)
      const key=group.label.mirror?`(${group.label.name}, the mirror image on drawing ${group.label.twin.name})`:`(${group.label.name})`,many=group.pieces.length>1;
      // ("the higher Board", "the 2nd Board from the bottom", "each Board on the left")
      const place=where?where[index]:'',nth=place.match(/^(\S+) (from the bottom)$/);
      const named=/^(lower|higher)$/.test(place)?`${place} ${name}`:nth?`${nth[1]} ${name} ${nth[2]}`:`${name}${place?' '+place:''}`;
      const who=groups.length===1||where?`${many?'each':'the'} ${named} ${key}`
        :listWords(group.pieces.map(piece=>whichOne(piece,S.parts.filter(other=>other.name===name&&(!step.oneOf||step.oneOf.has(other.id))))))+` ${key}`;
      sentences.push(`${who} ${group.text}.`+(group.tail?' '+group.tail:''));
      for(const piece of group.pieces){
        const label=group.label;
        said(piece,frame=>{const words=memberWords(label,{piece,frame},plan.letterOf,placedFor(piece));return words.text+'|'+words.tail;});
      }
    });
  }
  return'Put in: '+sentences.map((sentence,index)=>index?capital(sentence):sentence).join(' ');
}
/* the end with the label by its direction in the room: 'at the bottom', 'on the left' ... */
function endWordsInRoom(frame){
  const toward=frame.along.map(v=>-v),axis=mainAxis(toward),high=toward[axis]>0;
  return axis===1?(high?'at the top':'at the bottom'):axis===0?(high?'on the right':'on the left'):(high?'at the front':'at the back');
}
/* Words that tell groups of pieces apart by where they are: ['on the left', 'on the right'], or null when no one
   direction parts them (each group wholly to one side of the next) */
function placesApart(groups){
  const middle=p=>{const b=plainBox(p);return b.lo.map((v,k)=>(v+b.hi[k])/2);};
  const words=[['on the left','on the right'],['lower','higher'],['at the back','at the front']];
  for(const axis of[0,2,1]){
    const spans=groups.map(list=>{const values=list.map(p=>middle(p)[axis]);return{lo:Math.min(...values),hi:Math.max(...values)};});
    const order=spans.map((span,index)=>index).sort((a,b)=>spans[a].lo-spans[b].lo);
    if(order.every((index,i)=>!i||spans[order[i-1]].hi<spans[index].lo-.5)){
      if(groups.length===2)return order[0]===0?words[axis]:[words[axis][1],words[axis][0]];
      if(axis===1){const rank=new Map(order.map((index,i)=>[index,i]));return groups.map((group,index)=>`${ordinal(rank.get(index)+1)} from the bottom`);}
    }
  }
  return null;
}

/* ---------- the lines at the end of step 2 ---------- */
/* "D Leg (4) and E Top (1)" in cut-list order, and the sentence after it */
/* a piece with round holes or cut-outs of its shape (js/shapes.js): those are cut in a step of their own, so the
   piece is never said to have "nothing to drill" */
const hasShapeHoles=p=>typeof shapeFeatures==='function'&&shapeFeatures(p).some(f=>f.kind==='hole');
/* The Nothing line, said for each kind of piece by what really goes into it (the merge check of drill stage 2: the
   Gaming desk spoke of nails for pieces that take only pocket screws): {entries, why, groups: [{entries, why}]},
   one group per sentence, in cut-list order of their first piece. */
function nothingWords(drill){
  const entries=drill.nothing.filter(entry=>!entry.pieces.some(hasShapeHoles));
  if(!entries.length)return null;
  // what goes into the pieces of one entry: pocket screws only, or other fasteners too (screws, nails: only those
  // there, R17)
  const intoEntry=entry=>{
    const ids=new Set(entry.pieces.map(p=>p.id));
    let screws=false,nails=false,pockets=false,glued=false;
    for(const link of connGraph().links){
      if(!link.joint||!link.fastened||(!ids.has(link.a.id)&&!ids.has(link.b.id)))continue;
      if(link.type==='glue'){glued=true;continue;}
      if(link.type==='pocket'){pockets=true;continue;}
      if(/^(nail|frame|toenail)$/.test(link.type))nails=true;else screws=true;
    }
    // (no joint the program sees at all: a piece set at a slope that its preset fastens itself, the Bird feeder's
    //  roof boards: their screws are in the steps; a piece that is only glued, or only rests in place, takes no
    //  screw at all: the code reviewer's finding 26)
    if(screws||nails)return screws&&nails?'screws and nails':nails?'nails':'screws';
    if(pockets)return'';
    if(glued)return'glue';
    return entry.pieces.some(p=>tilted(p))?'screws':'rest';
  };
  const byWhat=new Map();
  for(const entry of entries){
    const what=intoEntry(entry);
    if(!byWhat.has(what))byWhat.set(what,[]);
    byWhat.get(what).push(entry);
  }
  const whyOf=what=>what==='glue'?'They are only glued, as the steps say.':what==='rest'?'They only rest in place, as the steps say.':
    what?`Their ${what} go in when you put it together, and the steps say where.`:'The pocket screws cut their own way into them.';
  // (spec 11, 1.6: structural screws are named, once, after the last group)
  const structural=drill.other.some(entry=>entry.row.key==='structural')?' Structural screws need no hole.':'';
  const groups=[...byWhat].map(([what,list])=>({entries:list,why:whyOf(what)}));
  groups[groups.length-1].why+=structural;
  return{entries,why:groups.map(group=>group.why).join(' '),groups};
}
/* how many pocket-hole screws of each size the shopping list buys, and the plugs */
function pocketScrewsListed(){
  // (the same list the shopping list is made from: renderCut, js/plans.js)
  const totals=hardwareTotals(findJoints());
  const screws=[],plugs=[];
  for(const[label,count]of totals.rows){
    if(/pocket-hole screws(,|$)/.test(label))screws.push([label,count]);   // (with its thread: POCKET_SCREW_LINE, js/style.js)
    if(POCKET_PLUG_LINE.test(label))plugs.push([label,count]);
  }
  return{screws,plugs,totals};
}
/* the At assembly line (spec 11, 1.1, item 8): holes made in the step that drives them, with why */
function assemblyWords(drill,letterOf){
  const parts=[];
  const stepsOf=list=>{
    const steps=[...new Set(list.map(entry=>entry.step).filter(Boolean))].sort((a,b)=>a-b);
    if(!steps.length)return'';
    if(steps.length===1)return`step ${steps[0]}`;
    const run=steps.every((v,i)=>!i||v===steps[i-1]+1);
    return run&&steps.length>2?`steps ${steps[0]} to ${steps[steps.length-1]}`:`steps ${listWords(steps.map(String))}`;
  };
  const toe=drill.other.filter(entry=>entry.row.key==='toe');
  if(toe.length){
    const into=[...new Set(toe.map(entry=>pieceLabel(entry.f.into,letterOf)))];
    parts.push(`${toe.length} screw${toe.length>1?'s':''} driven at an angle into the ${listWords(into)}, ${stepsOf(toe)} (the angle is set against the piece in place)`);
  }
  const wall=Math.round(drill.wallScrews.reduce((sum,item)=>sum+item.count,0));
  if(wall)parts.push(`${wall} screw${wall>1?'s':''} for the wall studs, when it goes against the wall (the studs decide where)`);
  // the screws of a wall plate land where a joist is under the deck: placed once the wall stands
  const plate=drill.other.filter(entry=>entry.row.key==='plate');
  if(plate.length)parts.push(`${plate.length} screw${plate.length>1?'s':''} down through a plate, ${stepsOf(plate)} (each goes where the framing under it is)`);
  const asSteps=[];
  // (stage 2 draws the wood screws, the plugged screws and the dowels; a kind that is not drawn yet keeps its line)
  for(const[key,noun]of[['plug','wood screws with plugged heads'],['screw','wood screws'],['dowel','dowels'],['bracket','L-brackets']]){
    const list=drill.other.filter(entry=>entry.row.key===key);
    if(!list.length)continue;
    const through=[...new Set(list.map(entry=>pieceLabel(entry.f.through,letterOf)))];
    asSteps.push(`${list.length} ${noun}${key==='bracket'?'':' through the '+(through.length>3?'pieces their steps name':listWords(through))}`);
  }
  const lines=[];
  if(parts.length)lines.push(`Drilled when you put it together, in the step that drives them: ${parts.join('; ')}.`);
  if(asSteps.length)lines.push(`${capital(listWords(asSteps))}: their holes are drilled in the step that drives them${drill.other.some(entry=>entry.row.key==='bracket')?' (a bracket is its own guide)':''}.`);
  return lines;
}
/* The holes of the hardware (hinges, pulls and knobs, shelf pins, slides, feet): not drawn yet (stage 3), so the At
   assembly part of step 2 names each kind with the step that fits it, and the page hides no hole (carry-over 9).
   steps: the plan's steps. Returns the sentence, or ''. */
/* The hardware whose holes a step drills, in a beginner's words, plural (C7 of the stage 2 review): a kind not in
   this table has no hole of its own to drill (a wall screw is said already with the wall studs; a power strip, a
   hook on its own screws) and is not named. */
const HARDWARE_HOLE_NOUNS={
  cup:'cup hinges',butt:'butt hinges',strap:'T-hinges',piano:'piano hinges',pull:'pulls',knob:'knobs',
  slide:'drawer slides',runner:'drawer runners',kicker:'drawer kickers',pin:'shelf pins',foot:'leveling feet',
  caster:'casters',catch:'magnetic catches',hasp:'hasps',stay:'lid stays',bolt:'carriage bolts',
};
function hardwareHoleWords(steps){
  const byKind=new Map();
  for(const step of steps||[])for(const row of step.hardware||[]){
    if(!row.kind||!HARDWARE_HOLE_NOUNS[row.kind])continue;
    if(!byKind.has(row.kind))byKind.set(row.kind,new Set());
    byKind.get(row.kind).add(step.no);
  }
  if(!byKind.size)return'';
  const items=[...byKind].map(([kind,stepNos])=>{
    const nos=[...stepNos].sort((a,b)=>a-b).map(String);
    return`${HARDWARE_HOLE_NOUNS[kind]} (step${nos.length>1?'s':''} ${listWords(nos)})`;
  });
  return`The holes for the hardware are drilled in the step that fits it, as that step says: ${listWords(items)}.`;
}
/* the tools of step 2 (spec 11, 1.1 item 2): the jig for pocket holes, the bits of DRILL_BITS for the rest */
function drillTools(drill){
  const stock=[...new Set(drill.holes.map(hole=>M[hole.piece.mat].short))];
  const tools=[];
  if(drill.setups.some(setup=>setup.kind==='jig'))tools.push('pocket-hole jig with its stepped bit and stop collar');
  tools.push('drill');
  for(const setup of drill.setups){
    if(setup.kind!=='bit')continue;
    if(setup.bit==='counterbore')tools.push(`${DRILL_BITS.counterbore.name} for the counterbores`);
    if(setup.bit==='counterbore'||setup.bit==='countersink')tools.push(`${DRILL_BITS.clearance.name} for the clearance holes`);
    if(setup.bit==='countersink')tools.push(`${DRILL_BITS.countersink.name} bit`);
    if(setup.bit==='pilot')tools.push(`${DRILL_BITS[pilotBitKey()].name} for the pilot holes`);
    if(setup.bit==='dowel')tools.push(`dowel jig and a ${fmt(setup.dia)} brad-point bit`);
  }
  if(drill.setups.some(setup=>setup.kind==='bit'))tools.push('painter\'s tape, for a flag on the bit that marks how deep to drill');
  tools.push('clamp','tape measure, square and pencil',`a scrap of ${listWords(stock)} for a test hole`);
  return[...new Set(tools)];
}
/* Does the face a label is written on show once the piece is built in (spec 11, 3.2, stage 2)? The face with the
   holes is the hidden face of pocket holes, but the clearance holes of a Rustic top are in its top face: a label
   there goes on a strip of painter's tape, which peels off clean. The test is the one the screw heads are judged by
   (js/showfaces.js): a line straight out of the label corner meets no wood, on a top, a front or a side, or the face
   is seen from below. */
function labelFaceShows(label){
  const members=label.members.concat(label.mirrorLabel?label.mirrorLabel.members:[]);
  const wood=S.parts.filter(p=>!isProp(p)&&!tilted(p)).map(plainBox);
  return members.some(member=>{
    const frame=member.frame;
    if(!frame)return false;
    const b=plainBox(member.piece),axis=mainAxis(frame.n);
    const at=[0,0,0];
    at[axis]=frame.n[axis]>0?b.hi[axis]:b.lo[axis];
    // an inch in from the corner with the label, where it is written
    at[frame.lengthAxis]=frame.datumAt+Math.sign(frame.along[frame.lengthAxis])*Math.min(1,(b.hi[frame.lengthAxis]-b.lo[frame.lengthAxis])/2);
    at[frame.upAxis]=frame.topAt-Math.sign(frame.up[frame.upAxis])*Math.min(.5,(b.hi[frame.upAxis]-b.lo[frame.upAxis])/2);
    const head={at,out:frame.n};
    return(SHOW_FACES.faces.includes(faceOfHead(frame.n))&&headShows(head,wood))||seenFromBelow(at,frame.n);
  });
}
/* the names of the pieces of a label ('Toe kick, Base rail'), as the cut list gives a row of several names */
const labelNames=label=>[...new Set(label.members.map(member=>member.piece.name))].join(', ');
/* (drillNeeds, DRILL_WORDS and DRILL_WORDS_BITS, the You need line and the words of the step "Drill your pieces",
   are retired with that step: the hint of the Part drawings section says why the holes are drilled first, and
   drillTools gives its tools to the packet's Tools for making the parts: js/shoppacket.js) */
