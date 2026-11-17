/* NominalCAD: where every fastener goes. The one source of truth for fasteners.

   jSpec(joint, type) (js/style.js) decides HOW MANY fasteners a joint takes and WHAT SIZE they are; that is the
   number the Fasteners tab and the shopping list show. This file places exactly that many, at real size and in the
   real direction, so the 3D view, the tips, and the build instructions all describe the same screws.

     fastenerLayout(joint, type)   the fasteners of one joint: a list of
         {kind, pos, dir, len, dia, head, through, into, label, tip, ...}
           kind     'screw' | 'pocket' | 'dowel' | 'brad' | 'bracket' | 'nail' (a framing nail)
           type     the fastener type of its joint (a key of JTYPES)
           pos      [x, y, z] where it enters the wood (the middle of its head; for a dowel, one end of the peg)
           dir      unit vector it is driven along: from the piece it goes THROUGH into the piece that RECEIVES it
           len dia  length and thickness in inches;  head: width of its head (0 = none)
           through  the piece it passes through first;  into: the piece that receives the point
           also     pieces beyond those two that it ends in (the joist under a floor deck, for a plate screw)
           label    what it is, one of them: '#8 × 2-1/2" wood screw'
           tip      one or two plain sentences: what it is and what it goes through
           toe      true when it is driven at an angle through the end of a piece (no face to go straight through)
           sunk     how deep its head sits below the surface, when the piece is too thick for the screw otherwise
           pocket   {mouth: [x, y, z], out: [x, y, z], dia}   pocket holes: where the hole opens on the hidden
                    face, the outward direction of that face, and the width of the hole
           plates   brackets: the two legs of the L as boxes [{c: [x, y, z], s: [sx, sy, sz]}]
           screws   brackets: its own four screws [{pos, dir, len, dia, head}]
         The list has jSpec(joint, type).n entries: one per screw, dowel, brad or bracket. Glue alone gives none.
     glueFilm(joint, type)         {k, plane, ru, rv} where glue is spread on this joint, or null
     fastenersOfLink(link)         the layout of a connection from connGraph() (js/connections.js), remembered
     fastenerProblem(f)            '' when the fastener stays inside its two pieces and reaches the second one,
                                   or what is wrong in plain words

   THE RULES OF THUMB USED HERE (each is also noted where it is applied)
     1. Screws and brads stay at least 3/4" from the end of a joint, so the wood does not split. A joint too short
        for that gets them spread evenly. A joint shorter than 2 1/4" takes one screw, in its middle
        (TWO_SCREWS_FROM in js/style.js).
     2. Along a long joint they are never more than about 8" apart (brads and dowels 6"). jSpec counts them that way.
     3. Across the joint they sit about a quarter of the width in from the edge, never closer than 3/8", and on a
        contact 2-1/2" wide or wider they are staggered (zig-zag), which holds better and splits less.
        On a narrow contact they run down the middle.
     4. A screw is as long as the piece it passes through plus about two thirds of the piece that receives it, and
        never pokes out the far side. (jSpec picks the store length; the check at the bottom of this file makes sure
        none comes through.)
     5. A pocket-hole screw leaves the hidden face at 15 degrees. The jig is set for the thinner of the two pieces
        (POCKET_JIG in js/style.js: 1-1/4" screws for 3/4", 2-1/2" screws for 1-1/2"), the screw comes out of
        the end half that setting in from the drilled face, and its head seats at the jig's shoulder. So a 2x4
        apron under a 3/4" top takes 1-1/4" screws, whose points stay more than 1/4" under the top surface.
     6. Dowels sit in the middle of the joint, half in each piece, with at least 1/4" of wood left behind the hole.
     7. A screw or brad with no face to go straight through is driven at an angle through the end of one piece
        (about 30 degrees), starting about an inch back from the joint, on alternating sides.
     8. An L-bracket goes in the inside corner, on the hidden side (under a top: on the inside face of the apron),
        with two screws into each piece; one about every 12", the outer ones within 4" of the ends.
    10. No pocket hole and no bracket goes where a third piece lies against the face (a cross rail that butts the
        inside of an apron): it is moved along the row to the nearest place that is clear (f.clear).
    11. A row of pocket holes along a piece keeps clear of the pocket holes in the ends of that same piece, on the
        same face (the holes for a top against the holes that hold an apron to its legs): such a hole is moved
        along the row past them (f.passEnds).
     9. Framing nails (stud walls, floor frames, roofs) follow js/framing.js: straight through a plate into the
        end of a stud, through plywood into the framing behind it, at an angle through the side of a piece that
        stands on another (toenailed). A nail that would reach the far face is driven at a slant so that it
        does not. A wall plate on a floor deck gets long screws that land in the framing under the deck.
    12. A screw that holds a joint bites deep enough into the piece that receives it (SCREW_BITE, biteWanted).
        How deep is measured along the screw, inside the receiving piece.
        - Into side grain (a face or an edge of a board, and the face or edge of plywood): at least 3/4". A #8
          screw is about 0.16" thick, and a wood screw comes near its full hold at about 4 to 5 times its own
          thickness of thread in the wood. A receiving piece too thin for that (a 3/4" top or drawer front,
          screwed from below) takes all of it but 1/4", so the point stays hidden: 1/2" in a 3/4" board.
        - Into end grain (the end of a board): at least 1 1/4". End grain holds a screw about half as well as
          side grain (the thread lies between the ends of the fibres and tears them out), so it needs more of
          it: 1 2/3 times the side grain bite, rounded to the nearest 1/4". A 3/4" side into the end of a 3/4"
          shelf takes 2" screws, a 1 1/2" rail into the end of another takes 3".
        - A piece too thick for the longest #8 screw the store has (3 1/2") to bite that far into END grain (a
          4x4 leg screwed into the end of a 2x apron: 3 1/2" of leg) gets a 1/4" structural screw instead
          (STRUCTURAL_SCREWS: washer head, no pilot hole; US home centers stock them in 4", 5" and 6"). The makers
          of such screws ask for about 6 times its thickness into end grain, 1 1/2": through a 4x4 that is the
          5" screw. Into SIDE grain such a piece gets a counterbore instead (rule 4: the head sits in a deep hole,
          at least 1/2" of wood left under it).
        - A screw whose head is to be hidden under a wooden plug (type 'plug') sits in a 3/8" deep counterbore
          (PLUG_DEPTH), and the screw is picked for the wood left under that hole.
        Pocket screws follow the jig's chart instead (rule 5): the jig is made for that bite. Brads (the glue
        holds), dowels, the short screws of a bracket, framing nails and screws driven at an angle are not held
        to this rule. jSpec (js/style.js) picks the length by it, drivenStraight below sinks the head when it
        must, and the self-check screwsBiteDeepEnough (js/screwbite.js) holds every preset to it in every style. */
'use strict';
/* Rule 12 in numbers (inches) */
const SCREW_BITE={side:.75,end:1.25,thinLeave:.25,structuralEnd:1.5};
const STRUCTURAL_SCREWS=[[4,'4"'],[5,'5"'],[6,'6"']];   // 1/4" structural screws, the lengths a home center stocks
const STRUCTURAL_SIZE={dia:.25,head:.6};                 // a 1/4" structural screw and its washer head
const PLUG_DEPTH=.375;                                    // a 3/8" plug in a 3/8" counterbore
const PLUG_DIA=.375;
/* How deep a screw must bite into the piece that receives it (rule 12). depthInto: how far the receiving piece
   reaches along the screw; endGrain: the screw goes into the end of a board. */
function biteWanted(depthInto,endGrain){
  if(endGrain)return Math.min(SCREW_BITE.end,depthInto-.125);
  return Math.min(SCREW_BITE.side,Math.max(.25,depthInto-SCREW_BITE.thinLeave));
}
/* Does a screw through this joint go into end grain? (j as findJoints gives it, through: 'a' or 'b') */
const intoEndGrain=(j,through)=>(through==='a'?j.fb:j.fa)==='end';

/* Rule 13: high up, the underside shows. In furniture for the house a pocket hole on the underside of a board, or
   on a face that looks sideways under a shelf, is out of sight only while it is low: a person standing in front
   looks down on it. Higher than SEEN.underAbove (54", about the shoulder of a grown-up) it is seen from below, in
   plain sight (the underside of the top of a tall bookcase, the supports of a shelf hung at eye level). There:
     - the holes of a board with something above it (a shelf: books stand on it) go on its top face instead;
     - so do those of the top of the design when its top face is SEEN.topFrom (68", the eye of a tall grown-up)
       or higher: nobody standing sees it;
     - otherwise no face is out of sight, and the holes are drilled where they would be and filled with glued
       pocket-hole plugs, sanded flush (f.pocket.plugged): the shopping list buys the plugs and the step says so.
   Floors are at y = 0 (a wall shelf is drawn at the height it hangs). seenFromBelow is what the self-check
   showFacesOfHouseFurniture (js/showfaces.js) asks too. */
const SEEN={underAbove:54,topFrom:68};
/* Is a hole that opens at `at`, on a face looking `out`, seen by a person standing in front of the design? Only
   faces that look down or sideways (not up, not to the back) higher than SEEN.underAbove, with nothing in front
   of them (a door), count. */
function seenFromBelow(at,out,parts=S.parts){
  if(at[1]<=SEEN.underAbove||out[1]>.5||out[2]<-.5)return false;
  const from=pointPlus(at,out,.06),forward=[0,0,1];
  return!parts.some(p=>!isProp(p)&&!tilted(p)&&rayHitsBox(from,forward,plainBox(p)));
}
/* Is the top face of this piece out of sight: as high as SEEN.topFrom, or with another piece standing over it? */
function topFaceUnseen(piece,parts=S.parts){
  const b=plainBox(piece);
  return b.hi[1]>=SEEN.topFrom-1e-6||faceIsInside(piece,1,1,parts);
}
/* Is the underside of this board seen from below ANYWHERE along it? Asking at its middle alone is not enough: on a
   bookcase with one divider, the middle of the top's underside lies on the divider, while both bays leave the rest
   of it open to anyone looking up (the woodworker's-eye review, E1). So it is asked every UNDERSIDE_LOOK_EVERY
   inches along the board's length, on the line across the middle of its depth. A point right over another piece
   (a side, a divider) is covered there and does not count; a door in front of a point hides it. */
const UNDERSIDE_LOOK_EVERY=3;
function undersideSeen(piece,parts=S.parts){
  const b=plainBox(piece);
  if(b.lo[1]<=SEEN.underAbove)return false;
  // along the longer of the two level directions, at the middle of the other
  const along=b.hi[0]-b.lo[0]>=b.hi[2]-b.lo[2]?0:2,across=2-along;
  const length=b.hi[along]-b.lo[along],count=Math.max(1,Math.ceil(length/UNDERSIDE_LOOK_EVERY));
  for(let i=0;i<count;i++){
    const point=[0,b.lo[1],0];
    point[along]=b.lo[along]+length*(i+.5)/count;
    point[across]=(b.lo[across]+b.hi[across])/2;
    if(seenFromBelow(point,[0,-1,0],parts))return true;
  }
  return false;
}
/* Rule 13 for one board, as ONE answer that the fastener layout and the words of a preset's steps both read, so
   the two can never disagree: where the pocket holes go that would otherwise open on the board's underside.
   'under' (out of sight there), 'top' (the underside is seen, nobody sees the top face) or 'plugged' (seen
   either way: drilled underneath and filled with plugs). parts: the pieces around it (the design; or the pieces a
   preset is about to place, when its steps are written before they are in the design). */
function undersideHoleFace(piece,parts=S.parts){
  if(!undersideSeen(piece,parts))return'under';
  return topFaceUnseen(piece,parts)?'top':'plugged';
}
/* The preset that placed this piece (its placement, S.sets), or null for a piece drawn by hand. */
function presetOfPiece(piece){
  const set=S.sets&&piece.set!==undefined?S.sets[piece.set]:null;
  return set&&PRESETS.find(row=>row.name===set.name)||null;
}
/* A preset may ask for the pocket holes of some of its pieces to be plugged in a build style:
   preset.pluggedPockets(piece, out, style) (the cabinet builder plugs its shelves' and its top's in Fine furniture). */
function pocketPluggedByPreset(piece,out){
  const preset=presetOfPiece(piece);
  return!!(preset&&typeof preset.pluggedPockets==='function'&&preset.pluggedPockets(piece,out,look().style));
}
/* A preset may name the face of a piece that stays out of sight along a direction, for its pocket holes and for
   screws started at an angle: preset.hiddenFace(piece, axis) gives -1 (the low face), +1 (the high face) or 0
   (let the shapes decide). The cabinet builder drills a back rail on its back face even with no back panel and no
   wall behind it: the back is not a face anybody looks at, the front of the rail is seen from the front. */
function hiddenFaceByPreset(piece,axis){
  const preset=presetOfPiece(piece);
  if(!preset||typeof preset.hiddenFace!=='function')return 0;
  const side=preset.hiddenFace(piece,axis);
  return side===1||side===-1?side:0;
}

const FASTEN={
  endMin:.75,        // rule 1
  edgeMin:.375,      // rule 3
  staggerFrom:2.5,   // rule 3
  pocketDegrees:15,  // rule 5
  toeDegrees:30,     // rule 7
  dowelCover:.25,    // rule 6
  bracketLeg:1.5,bracketWide:.625,bracketThick:.08,bracketScrew:.625,
};
/* thickness and head width of each kind, in inches (a #8 screw is 0.164" thick; an 18 gauge brad about 0.05"; a 10d
   framing nail 0.148" with a 5/16" head) */
const FASTENER_SIZE={screw:{dia:.164,head:.33},pocket:{dia:.164,head:.38},brad:{dia:.06,head:.1},dowel:{dia:.375,head:0},nail:{dia:.148,head:.31}};

/* ---------- small helpers ---------- */
const alongAxis=(k,amount)=>{const v=[0,0,0];v[k]=amount;return v;};
const pointPlus=(p,dir,amount)=>[p[0]+dir[0]*amount,p[1]+dir[1]*amount,p[2]+dir[2]*amount];
/* the sizes written in a shopping-list label, in inches: '#8 × 2-1/2" wood screws' gives [2.5] */
function sizesInLabel(label){
  return(String(label).match(/\d[\d\/\-]*(?=")/g)||[]).map(parseLen);
}
/* one of them, for a tip: '1-1/4" brad nails (18 gauge)' gives '1-1/4" brad nail' */
function oneOf(label){
  return String(label).replace(/\s*\(.*\)$/,'').replace(/s$/,'');
}
/* Does a line from this point, going this way, run into one of these boxes ({lo, hi})? (the slab test) */
function rayHitsBox(from,way,b){
  let near=0,far=Infinity;
  for(let k=0;k<3;k++){
    if(Math.abs(way[k])<1e-9){
      if(from[k]<b.lo[k]||from[k]>b.hi[k])return false;
      continue;
    }
    let t1=(b.lo[k]-from[k])/way[k],t2=(b.hi[k]-from[k])/way[k];
    if(t1>t2)[t1,t2]=[t2,t1];
    near=Math.max(near,t1);far=Math.min(far,t2);
    if(near>far)return false;
  }
  return far>0;
}
/* the outer bounds of a square-set piece */
function plainBox(p){
  const s=size(p);
  return{lo:p.pos,hi:[p.pos[0]+s[0],p.pos[1]+s[1],p.pos[2]+s[2]]};
}

/* What every maker below needs to know about a joint: its long and its narrow direction, and which way leads
   into each of the two pieces. */
function jointShape(j){
  const longIsU=j.ru[1]-j.ru[0]>=j.rv[1]-j.rv[0];
  const aIsLow=j.a.pos[j.k]+j.da/2<j.plane; // piece a lies on the low side of the touching plane
  const shape={
    k:j.k,plane:j.plane,
    L:longIsU?j.u:j.v,W:longIsU?j.v:j.u,          // the direction the joint is long in, and the one across it
    rangeL:longIsU?j.ru:j.rv,rangeW:longIsU?j.rv:j.ru,
    signInto:piece=>(piece===j.a)===aIsLow?-1:1, // which way along k leads from the joint into that piece
    depthOf:piece=>piece===j.a?j.da:j.db,        // how thick that piece is, square to the joint
    other:piece=>piece===j.a?j.b:j.a,
  };
  shape.long=shape.rangeL[1]-shape.rangeL[0];
  shape.wide=shape.rangeW[1]-shape.rangeW[0];
  /* a point given along the joint (from its start), across it (from its edge) and at a depth along k */
  shape.point=(along,across,depth)=>{
    const p=[0,0,0];
    p[shape.k]=depth;
    p[shape.L]=shape.rangeL[0]+along;
    p[shape.W]=shape.rangeW[0]+across;
    return p;
  };
  return shape;
}
/* Rules 1 and 2: where n fasteners sit along a joint of this length (distances from its start). */
function spreadAlong(n,long,endMin){
  if(n<=1)return[long/2];
  let margin=long/(2*n);                                    // evenly spaced, half a space at each end
  if(margin<endMin)margin=Math.min(endMin,long/(n+1));      // a short joint: as far from the ends as it allows
  return Array.from({length:n},(unused,i)=>margin+i*(long-2*margin)/(n-1));
}
/* Rule 3: how far in from the edge fastener number i sits, on a contact this wide. */
function acrossAt(i,n,wide){
  if(n<2||wide<FASTEN.staggerFrom)return wide/2;
  const inFromEdge=Math.max(wide/4,FASTEN.edgeMin);
  return i%2?wide-inFromEdge:inFromEdge;
}
/* The middle of the design: the "inside" that pocket holes and brackets face. Worked out once per change. */
let insideMemo=null;
let designTick=0; // goes up at every commit and every load: a cheap way to know that the design may have changed
ON_COMMIT.push(()=>{designTick++;});
ON_LOAD.push(()=>{designTick++;});
function designMiddle(){
  // (squared: with the turned sets standing square the pieces stand elsewhere, js/neighbors.js)
  if(insideMemo&&insideMemo.parts===S.parts&&insideMemo.count===S.parts.length&&insideMemo.tick===designTick&&insideMemo.squared===!!squaredNow)return insideMemo.middle;
  const b=bbox(S.parts.filter(p=>!isProp(p)));
  insideMemo={parts:S.parts,count:S.parts.length,tick:designTick,squared:!!squaredNow,middle:b?b.lo.map((v,i)=>(v+b.hi[i])/2):[0,0,0]};
  return insideMemo.middle;
}
/* The hidden side of a piece along direction s: -1 for its low face, +1 for its high face. Underneath when s is
   up and down; otherwise the side that faces the middle of the design. */
function hiddenSide(piece,s){
  if(s===1)return-1;
  const b=plainBox(piece);
  const side=designMiddle()[s]>=(b.lo[s]+b.hi[s])/2?1:-1;
  // not a face that another board lies against (faceCovered, js/fastenerroom.js)
  if(typeof faceCovered==='function'&&faceCovered(piece,s,side)&&!faceCovered(piece,s,-side))return-side;
  return side;
}

/* ---------- the makers: one per kind of fastener ---------- */

/* Screws and brads driven straight through the face of one piece into the other (rules 1 to 4). */
/* Rule 12: how deep the head of a screw (or a brad) driven straight is sunk. A screw that would not bite deep
   enough into the next piece (the piece it goes through is too thick for it) gets a deep hole for its head (a
   counterbore), deep enough for the bite the rule wants, leaving at least 1/2" of wood under the head. A screw
   whose head is to be plugged sits at least PLUG_DEPTH deep. (A brad only has to reach: the glue holds. One that
   would bite less than 1/2" is sunk for 3/4", as before.) jSpec (js/style.js) asks the same question, so the list
   says the depth the layout drills. */
function sunkDepth(kind,len,depthThrough,depthInto,endGrain,plug){
  const wanted=kind==='screw'?biteWanted(depthInto,endGrain):Math.min(.75,depthInto-.125);
  let sunk=plug?PLUG_DEPTH:0;
  const reach=len-depthThrough+sunk;
  if(kind==='screw'?reach<wanted-.01:reach<Math.min(.5,depthInto-.125)){
    // to the next 1/16", a depth that can be measured, and never leaving less than 1/2" under the head
    sunk=Math.max(sunk,Math.min(depthThrough-.5,Math.ceil((sunk+wanted-reach)*16-1e-6)/16));
  }
  return sunk;
}
/* a plugged head deeper than a store-bought plug is long: the hole is filled with a glued length of dowel rod */
const plugIsDowel=sunk=>sunk>PLUG_DEPTH+.01;
function drivenStraight(j,shape,n,kind,len,label,plug){
  const side=screwSide(j,kind==='screw'&&!plug),through=j[side],into=shape.other(through);
  const depthThrough=shape.depthOf(through),depthInto=shape.depthOf(into);
  const way=shape.signInto(into),dir=alongAxis(shape.k,way);
  const sunk=sunkDepth(kind,len,depthThrough,depthInto,intoEndGrain(j,side),plug);
  const start=shape.plane-way*(depthThrough-sunk);
  const structural=/structural/.test(label),sizes=structural?STRUCTURAL_SIZE:FASTENER_SIZE[kind];
  return spreadAlong(n,shape.long,FASTEN.endMin).map((along,i)=>{
    const pos=shape.point(along,acrossAt(i,n,shape.wide),start);
    const f={kind,pos,dir,len,...sizes,through,into,label,sunk,structural,
      tip:`${label}. Goes through ${through.name} into ${into.name}.`+
        (plug?` Its head sits in a 3/8" hole ${fmt(sunk)} deep under ${plugIsDowel(sunk)?'a glued length of 3/8" dowel':'a glued wooden plug'}, cut flush.`:sunk?' Its head sits in a deep hole so it can reach.':'')+
        (structural?' A structural screw: no pilot hole needed.':'')+(kind==='brad'?' The glue does the holding.':'')};
    // the plug over the head: where it lies on the face and which way that face looks
    if(plug)f.plug={at:pointPlus(pos,dir,-sunk),out:dir.map(v=>-v),dia:PLUG_DIA};
    return f;
  });
}
/* The piece a screw goes through (thruPart, js/joints.js), with one tie decided for furniture for the house: two
   pieces of the same thickness face to face (a bed rail and the cleat along its inside) are screwed from the
   piece whose far face looks into the design, so the heads are on the inside (the cleat) and not on the outside
   of the rail. Shop pieces, racks and buildings keep the plain rule.
   fromThicker (plain wood screws, in Everyday and Fine furniture): the same holds for two pieces of different
   thickness, when the thinner one is on the outside (a bed's head rail and the 4x4 leg standing inside its corner):
   the screws go in from the inside face of the thicker piece, their heads sunk in counterbores as deep as rule 12
   needs, instead of through the show face of the thin one. Rustic / rough keeps its heads on the outside. */
function screwSide(j,fromThicker){
  const side=thruPart(j);
  if(forcedThrough(j))return side;   // the preset named the piece the screws go through ({through}, js/joints.js)
  if(!side||j.fa!=='face'||j.fb!=='face'||typeof S==='undefined'||!S.parts.includes(j.a))return side;
  const sameThickness=Math.abs(j.da-j.db)<=.01;
  // (only pieces side by side: a board lying on another, a slat on a cleat, is screwed down as always)
  if(!sameThickness&&!(fromThicker&&j.k!==1&&look().style!=='rustic'))return side;
  if(!isHouseFurniturePiece(j.a))return side;
  // the far face of a piece looks into the design when the middle of the design lies beyond it, away from the joint
  const looksIn=piece=>{
    const b=plainBox(piece),middle=designMiddle()[j.k],farIsHigh=(b.lo[j.k]+b.hi[j.k])/2>j.plane;
    return farIsHigh?middle>b.hi[j.k]-1e-6:middle<b.lo[j.k]+1e-6;
  };
  const aIn=looksIn(j.a),bIn=looksIn(j.b);
  if(aIn!==bIn)return aIn?'a':'b';
  return side;
}
/* Was this piece placed by a preset of furniture for the house (HOUSE_FURNITURE, js/showfaces.js)? */
function isHouseFurniturePiece(piece){
  const set=S.sets&&piece.set!==undefined?S.sets[piece.set]:null;
  return!!set&&typeof HOUSE_FURNITURE!=='undefined'&&HOUSE_FURNITURE.includes(set.name);
}
/* Screws, brads and nails with no face to go through: driven at an angle through the end of one piece (rule 7).
   toed: the piece they start in, when the caller knows (a toenailed joint, js/framing.js); else it is worked out. */
function drivenAtAnAngle(j,shape,n,kind,len,label,toed){
  const through=toed||(j.fa==='end'?j.a:j.fb==='end'?j.b:shape.depthOf(j.a)<=shape.depthOf(j.b)?j.a:j.b),into=shape.other(through);
  const way=shape.signInto(into),box=plainBox(through);
  // it starts on a side of the piece that ends at the joint: the narrow sides when the whole end is in contact
  const fits=s=>Math.abs(box.lo[s]-(s===shape.W?shape.rangeW:shape.rangeL)[0])<.02&&Math.abs(box.hi[s]-(s===shape.W?shape.rangeW:shape.rangeL)[1])<.02;
  const s=fits(shape.W)||!fits(shape.L)?shape.W:shape.L,t=s===shape.W?shape.L:shape.W;
  const rangeS=s===shape.W?shape.rangeW:shape.rangeL,rangeT=s===shape.W?shape.rangeL:shape.rangeW;
  const thick=rangeS[1]-rangeS[0];
  // flatter than 30 degrees in thin wood, so the point stays inside
  const angle=Math.min(FASTEN.toeDegrees*Math.PI/180,Math.asin(Math.min(1,Math.max(.1,thick-.25)/len)));
  const forward=len*Math.cos(angle);
  let back=forward*.45;                                           // how far from the joint it starts
  const room=shape.depthOf(into)-.125;
  if(forward-back>room)back=Math.min(shape.depthOf(through)-.1,forward-room);
  return spreadAlong(n,rangeT[1]-rangeT[0],FASTEN.endMin).map((along,i)=>{
    const from=i%2?1:-1; // alternate sides
    const pos=[0,0,0],dir=[0,0,0];
    pos[shape.k]=shape.plane-way*back;
    pos[s]=from>0?rangeS[1]:rangeS[0];
    pos[t]=rangeT[0]+along;
    dir[shape.k]=way*Math.cos(angle);
    dir[s]=-from*Math.sin(angle);
    return{kind,pos,dir,len,...FASTENER_SIZE[kind],through,into,label,toe:true,
      tip:`${label}, driven at an angle. Goes through the ${toed?'side':'end'} of ${through.name} into ${into.name}.`};
  });
}

/* ---------- nails for framing (rule 9; js/framing.js decides how many, what size, and through which piece) ---------- */
/* Nails driven through one piece into the other: through a plate into the end of a stud, through one 2x4 into the
   one it lies against, through plywood into the framing behind it. A nail as long as the two pieces are thick
   together would come out of the far side, so it is driven at a slant, just enough for its point to stay 1/8"
   inside: what a carpenter does when nailing two 2x4s face to face with 3" nails. */
function nailedThrough(j,shape,n,len,label,through,into){
  const depthThrough=shape.depthOf(through),depthInto=shape.depthOf(into);
  const way=shape.signInto(into),start=shape.plane-way*depthThrough;
  const room=depthThrough+depthInto-.125;                // how deep the point may go
  const lean=len>room?Math.acos(room/len):0;             // 0 = straight in
  const sideways=len*Math.sin(lean);                     // how far along the joint the point ends from where the nail went in
  return spreadAlong(n,shape.long,FASTEN.endMin).map((along,i)=>{
    // it leans toward the middle of the joint, so the point ends under the piece it went through
    const toward=along<=shape.long/2?1:-1;
    if(lean)along=Math.max(0,Math.min(shape.long,along+toward*sideways))-toward*sideways;
    const dir=alongAxis(shape.k,way*Math.cos(lean));
    dir[shape.L]=toward*Math.sin(lean);
    return{kind:'nail',pos:shape.point(along,acrossAt(i,n,shape.wide),start),dir,len,...FASTENER_SIZE.nail,through,into,label,lean,
      tip:`${label}. Goes through ${through.name} into ${into.name}.`+(lean?' Driven at a slant, so that its point stays inside the wood.':'')};
  });
}
/* A wall plate on a floor deck: long screws down through the plate and the plywood into the framing under the
   plywood. Each screw is put where there really is a joist or a rim under the deck, as near to its even spacing
   as that allows. Where nothing is under the deck the screw is drawn all the same, and its tip says that it has
   nothing to bite into. The layout depends on a third piece, so it is worked out again at every change (loose). */
function plateScrews(j,shape,n,len,label,board,sheet){
  const way=shape.signInto(sheet),top=shape.plane-way*shape.depthOf(board),underside=shape.plane+way*shape.depthOf(sheet);
  const past=len-shape.depthOf(board)-shape.depthOf(sheet);   // how much of the screw comes out under the plywood
  const inset=FASTEN.edgeMin,k=shape.k;
  // the framing right under the plywood, below this joint: where along and across the joint a screw can go into it
  const spots=[];
  for(const p of S.parts){
    if(p===board||p===sheet||isProp(p)||tilted(p))continue;
    const b=plainBox(p),face=way<0?b.hi[k]:b.lo[k];
    if(Math.abs(face-underside)>.03||b.hi[k]-b.lo[k]<past+.125)continue;   // not right under the plywood, or too thin for the point
    const range=(axis,joint,edge)=>{
      const lo=Math.max(joint[0],b.lo[axis]),hi=Math.min(joint[1],b.hi[axis]);
      if(hi-lo<.25)return null;
      return hi-lo<2*edge?[(lo+hi)/2,(lo+hi)/2]:[lo+edge,hi-edge];
    };
    const along=range(shape.L,shape.rangeL,FASTEN.endMin),across=range(shape.W,shape.rangeW,inset);
    if(along&&across)spots.push({p,along,across:(across[0]+across[1])/2});
  }
  const used=[];
  const list=spreadAlong(n,shape.long,FASTEN.endMin).map(wanted=>{
    const want=shape.rangeL[0]+wanted;
    let best=null;
    for(const spot of spots){
      for(const at of[Math.max(spot.along[0],Math.min(spot.along[1],want)),...used.flatMap(u=>[u-1.5,u+1.5])]){
        if(at<spot.along[0]-1e-6||at>spot.along[1]+1e-6||used.some(u=>Math.abs(u-at)<1.4))continue;
        if(!best||Math.abs(at-want)<Math.abs(best.at-want))best={at,spot};
      }
    }
    const pos=[0,0,0];
    pos[k]=top;
    pos[shape.L]=best?best.at:want;
    pos[shape.W]=best?best.spot.across:(shape.rangeW[0]+shape.rangeW[1])/2;
    used.push(pos[shape.L]);
    const under=best?best.spot.p:null;
    return{kind:'screw',pos,dir:alongAxis(k,way),len,...FASTENER_SIZE.screw,through:board,into:sheet,also:under?[under]:[],label,
      tip:under?`${label}. Goes down through ${board.name} and ${sheet.name} into ${under.name}.`
        :`${label}. Goes down through ${board.name} and ${sheet.name}, but there is no framing under the plywood here for it to hold in. Put a joist or a block under this spot.`};
  });
  list.loose=true;
  return list;
}
/* the layout of a joint of type 'frame' or 'toenail' */
function framingLayout(j,shape,spec){
  const drive=spec.drive,item=spec.hw[0][0],len=sizesInLabel(item).pop()||3;
  if(drive.how==='plate')return plateScrews(j,shape,spec.n,len,oneOf(item),drive.through,drive.into);
  const label=`${item.match(/^[^ ]+/)[0]} nail${(item.match(/ \(\d+d\)/)||[''])[0]}`;   // '3" nail (10d)'
  if(drive.how==='toe')return drivenAtAnAngle(j,shape,spec.n,'nail',len,label,drive.through);
  return nailedThrough(j,shape,spec.n,len,label,drive.through,drive.into);
}
/* the piece the pocket holes are drilled in. jSpec names the same piece in its text; the check below compares them. */
/* Rule 5, a piece standing on a thin deck: a pocket screw from a board that stands on a sheet 1/2" thick or
   thinner, lying on framing (an upright of a fish rack on the plywood deck of the frame under it). With the jig
   set for the sheet the screw is 1" and ends in it, and 1/2" of plywood is too little for a screw to hold in (the
   NDS wants about six times the screw's thickness of thread in the piece that holds it, about 1" for a #8). So the
   jig is set for the board itself and the screw goes on through the sheet into the framing glued under it:
   {depth, under}, the thickness to set the jig against and the framing pieces under the sheet at the joint; null
   for every other pocket joint (and for pieces not in the design, where nothing is known of what is under them).
   jSpec (js/style.js) and pocketScrews both read it, so the list buys the screw that is drawn. */
const THIN_DECK=.5;
function pocketThroughSheet(j,holes){
  const sheet=holes===j.a?j.b:j.a;
  if(j.k!==1||M[sheet.mat].kind!=='sheet'||sheet.t>THIN_DECK+1e-6||M[holes.mat].kind==='sheet'||holes.t<1.4)return null;
  if(typeof connGraph!=='function'||!S.parts.includes(sheet)||!S.parts.includes(holes))return null;
  const deck=plainBox(sheet);
  if(Math.abs(deck.hi[1]-j.plane)>.02)return null;          // the board stands ON the sheet
  const under=connectionsOf(sheet.id).map(link=>link.a===sheet?link.b:link.a).filter(p=>{
    if(isProp(p)||tilted(p)||M[p.mat].kind!=='board'||p.t<1.4)return false;
    const b=plainBox(p);
    return Math.abs(b.hi[1]-deck.lo[1])<.02&&b.lo[j.u]<j.ru[1]-.1&&b.hi[j.u]>j.ru[0]+.1&&b.lo[j.v]<j.rv[1]-.1&&b.hi[j.v]>j.rv[0]+.1;
  });
  return under.length?{depth:sheet.t+1.5,sheet:sheet.t,under}:null;
}
/* The pocket screw through a thin deck: rule 12 decides its length, not the jig's chart. The jig stays set for the
   board (1 1/2"), so the head seats at the same shoulder, but the chart's 2-1/2" screw, after its slanted path
   through the 1/2" plywood, goes only about 1/2" into the rail or cross piece under it, where rule 12 wants 3/4"
   in side grain. So it is the shortest pocket screw the store has whose point goes SCREW_BITE.side into the
   framing along its slant: 3" for a 1/2" deck. One rule for the joint: jSpec and pocketScrews both take the jig
   from here (pocketJigFor), and the self-check pocketScrewsThroughADeckBite holds the bite. */
const POCKET_SCREW_LENGTHS=[[1,'1"'],[1.25,'1-1/4"'],[1.5,'1-1/2"'],[2,'2"'],[2.5,'2-1/2"'],[3,'3"']];
function pocketJigFor(j,holes){
  const deck=pocketThroughSheet(j,holes);
  const jig=pocketJig(holes,deck?deck.depth:holes===j.a?j.db:j.da);
  if(!deck)return jig;
  const slant=1/Math.cos(FASTEN.pocketDegrees*Math.PI/180);
  const need=jig.shoulder+deck.sheet*slant+SCREW_BITE.side;
  const pick=POCKET_SCREW_LENGTHS.find(([length])=>length>=need-1e-6)||POCKET_SCREW_LENGTHS[POCKET_SCREW_LENGTHS.length-1];
  return pick[0]>jig.screw?{...jig,screw:pick[0],size:pick[1]}:jig;
}
function pocketPiece(j){
  const side=thruPart(j);
  if(side)return side==='a'?j.b:j.a;
  return j.fa==='end'?j.a:j.fb==='end'?j.b:(j.a.t<=j.b.t?j.a:j.b);
}
/* Pocket-hole screws (rule 5). The jig is set for the thinner of the two pieces (pocketJig, js/style.js), and the
   bit drills to a fixed stop, so the head seats at the jig's shoulder: the screw is never "slid back" to make it
   fit. The screw leaves the piece half the jig setting in from the drilled face (in the middle of the end when
   the jig is set for the piece itself), and the hole opens on the hidden side. */
const ROW_ON_OTHER_FACE_BELOW=8;   // inches across: a piece held at its ends that is narrower takes its row on its other face
function pocketScrews(j,shape,n,len,label){
  const through=pocketPiece(j),into=shape.other(through);
  const way=shape.signInto(into),box=plainBox(through);
  // the hole is drilled into a wide face of the piece: across its thickness when that runs along the joint face
  const s=through.ax[2]!==shape.k?through.ax[2]:shape.W,t=[0,1,2].find(i=>i!==shape.k&&i!==s);
  // a board on a thin deck: through it into the framing, with the screw rule 12 asks for (pocketJigFor)
  const deck=pocketThroughSheet(j,through),jig=deck?pocketJigFor(j,through):pocketJig(through,shape.depthOf(into));
  // Through a thin deck the screws must end in the framing under it, so they are kept over that framing: a panel
  // stud of a cabinet stand stands 3 1/2" deep on the deck over a back rail only 1 1/2" deep, and a screw past the
  // rail would end in open air under the deck. Where the framing leaves too short a stretch for two screws, the
  // joint takes one in its middle (TWO_SCREWS_FROM, js/style.js); jSpec counts what is laid out (pocketCountAsLaidOut).
  const overFraming=(range,axis)=>{
    if(!deck)return range;
    const lo=Math.min(...deck.under.map(p=>plainBox(p).lo[axis])),hi=Math.max(...deck.under.map(p=>plainBox(p).hi[axis]));
    return[Math.max(range[0],lo),Math.min(range[1],hi)];
  };
  const rangeT=overFraming(t===shape.L?shape.rangeL:shape.rangeW,t);
  const rangeS=overFraming(s===shape.L?shape.rangeL:shape.rangeW,s);
  if(deck&&n>1&&rangeT[1]-rangeT[0]<TWO_SCREWS_FROM)n=1;
  const angle=FASTEN.pocketDegrees*Math.PI/180,sin=Math.sin(angle),cos=Math.cos(angle);
  const shoulder=Math.min(jig.shoulder,len-.25);   // a screw shorter than the jig's own (picked by hand) still bites 1/4"
  const bite=len-shoulder;                          // how much of the screw ends up in the second piece
  // Where the screw crosses the joint: half the jig setting in from the drilled face. When the two pieces only
  // meet over part of the thickness (an upright that stands half on the edge of a shelf deck), it is kept inside
  // the part where they do meet, so that the point of the screw ends in the second piece and not beside it.
  const keepIn=Math.min((rangeS[1]-rangeS[0])/2,bite*sin+.05);
  const crossFor=side=>{
    const face=side>0?box.hi[s]:box.lo[s],wanted=face-side*jig.set/2;
    return Math.max(rangeS[0]+keepIn,Math.min(rangeS[1]-keepIn,wanted));
  };
  // the hole opens on the hidden side, unless the head of the screw would then sit outside the wood
  const headOff=shoulder*sin+.02;
  const toFaceOf=(side,cross)=>side>0?box.hi[s]-cross:cross-box.lo[s];
  let hidden=hiddenSide(through,s);
  // A face that will be covered for good is better still: the back of a rail that a thin back panel is nailed over
  // later, or the back of a cleat that is screwed to the wall (coveredForGood)
  if(coveredForGood(through,s,-hidden)&&!coveredForGood(through,s,hidden))hidden=-hidden;
  // A piece held at its ends by pocket holes of its own (a cross rail) gets the row that holds what lies on it (the
  // top) on its other face, when that face is inside the frame too: drilled on the same face, the screws of the
  // row would run into the screws of the ends inside the wood.
  // A wide board (the bottom of a toy chest, 14" from front to back) is left alone: there the holes at its ends and
  // the rows along its edges are far apart, rule 11 keeps the rows clear of the end holes along the board, and all
  // the holes stay on the one face the step names (its underside, driven with the chest upside down).
  const heldAtEnds=endPocketsOn(through,j);
  const narrow=box.hi[shape.k]-box.lo[shape.k]<ROW_ON_OTHER_FACE_BELOW;
  if(heldAtEnds&&narrow&&faceIsInside(through,s,-hidden))hidden=-hidden;
  // the face the preset says stays out of sight wins (hiddenFaceByPreset; rule 11 keeps the row clear of the end holes)
  if(hiddenFaceByPreset(through,s))hidden=hiddenFaceByPreset(through,s);
  // Rule 13: an underside high enough to be seen from below. The holes go on the top face when nobody sees that,
  // or stay and are plugged.
  const house=isHouseFurniturePiece(through);
  let plugged=false;
  if(house&&s===1&&hidden<0){
    const face=undersideHoleFace(through);
    if(face==='top')hidden=1;
    else if(face==='plugged')plugged=true;
  }
  let crossS=crossFor(hidden);
  if(toFaceOf(hidden,crossS)<headOff&&toFaceOf(-hidden,crossFor(-hidden))>toFaceOf(hidden,crossS)){
    hidden=-hidden;
    crossS=crossFor(hidden);
  }
  const dir=[0,0,0];
  dir[shape.k]=way*cos;
  dir[s]=-hidden*sin;
  const mouthBack=Math.min(toFaceOf(hidden,crossS)/sin,(shape.depthOf(through)-.1)/cos); // from the joint back to where the hole opens
  const out=alongAxis(s,hidden);
  // Rule 10: no hole opens where a third piece lies against that face (the cross rail that butts the inside of
  // a long apron): such a hole is moved along the row to the nearest place that is clear.
  const faceAt=hidden>0?box.hi[s]:box.lo[s];
  const slot=[shape.plane-way*(mouthBack*cos+.4),shape.plane-way*Math.max(0,mouthBack*cos-.9)];
  const blocked=coveredSpans(through,[into],{axis:s,at:faceAt,out:hidden},{axis:shape.k,range:slot},t);
  // Rule 11: a row along a piece keeps clear of the pocket holes drilled in the ends of that piece on the same face
  // (an apron's holes for the top against its holes into the legs): two holes that open into each other cannot
  // both be drilled, and the second screw would run through the first hole.
  const endHoles=endHoleSpans(through,j,out,t);
  // Rule 10 for hardware: no hole of the row where a bolt passes through the piece beside the joint (the bolts
  // through the end cross pieces of two rack sections, js/rackwall.js)
  const bolts=boltSpansAcross(through,shape,t);
  if(bolts.length)blocked.spans.push(...bolts);
  const evenly=spreadAlong(n,rangeT[1]-rangeT[0],FASTEN.endMin).map(a=>rangeT[0]+a);
  // (of two places equally near, the one on the left of the drilled face as the person drilling sees it: clearOf)
  const seenFrom=markingFrame(s,-hidden,through);
  const leftward=seenFrom.right.axis===t?seenFrom.right.sign:seenFrom.up.axis===t?seenFrom.up.sign:1;
  const alongs=clearOf(evenly,blocked.spans.concat(endHoles.spans),rangeT,FASTEN.endMin,.3,at=>at*leftward);
  const inEndHoles=at=>endHoles.spans.some(([a,b])=>at>a-.3&&at<b+.3);
  // A hole that found no clear place (a top board that only crosses the apron right beside a leg) is left out, and
  // jSpec counts the holes that are left. When none is left the row stays as it was: placing a preset turns such a
  // joint into one that only rests (roomForTopRows, js/joints.js), so this only happens after a change by hand.
  const placed=alongs.map((place,index)=>({...place,index})).filter(place=>!inEndHoles(place.at));
  const rows=placed.length?placed:alongs.map((place,index)=>({...place,index}));
  const list=rows.map(({at,moved,index})=>{
    const why=!moved?{}:inEndHoles(evenly[index])?{passEnds:endHoles.names}:{clear:blocked.names,...(bolts.length?{pastBolt:true}:{})};
    const cross=[0,0,0];
    cross[shape.k]=shape.plane;
    cross[s]=crossS;
    cross[t]=at;
    const mouth=pointPlus(cross,dir,-mouthBack);
    const pos=pointPlus(cross,dir,-shoulder),point=pointPlus(pos,dir,len);
    // through a thin deck: the framing under it that the point ends in
    const beyond=deck?deck.under.filter(p=>{const b=plainBox(p);return[0,1,2].every(k=>point[k]>=b.lo[k]-.03&&point[k]<=b.hi[k]+.03);}):[];
    // (rule 13 for a face that looks sideways, under a shelf hung high: the supports of a wall shelf)
    // (and the holes a preset asks to be plugged in this style: pocketPluggedByPreset)
    const plug=plugged||(house&&s!==1&&seenFromBelow(mouth,out))||pocketPluggedByPreset(through,out);
    const path=beyond.length?`down through ${into.name} into ${beyond[0].name}`:`into ${into.name}`;
    return{kind:'pocket',pos,dir,len,...FASTENER_SIZE.pocket,through,into,label,jig:jig.set,
      pocket:{mouth,out,dia:.375,plugged:plug},
      ...why,...(beyond.length?{also:beyond}:{}),
      tip:`${label}. Goes from a pocket hole in ${through.name} ${path}. `+
        (plug?'The hole would be seen from below, so it is filled with a glued pocket-hole plug, sanded flush.':'The holes are on the hidden side.')};
  });
  // The layout depends on the neighbours: one that had to move a hole is worked out again at every change
  // (loose), and one that did not is worked out again when the piece gets more or fewer neighbours (near).
  // (rule 13 looks at what stands in front of and over the piece, and a deck at the framing under it: worked out
  // again at every change)
  if(blocked.spans.length||endHoles.spans.length||heldAtEnds||house||deck)list.loose=true;
  if(!placed.length&&endHoles.spans.length)list.noRoom=true;   // every hole of the row lands in the end holes
  list.near={id:through.id,count:blocked.count};
  return list;
}
/* Is this face of a piece covered for good once the piece is built in: a thin panel (1/4" or so, a back nailed on
   after the frame is together) lies against all of it, or it is the back of a piece the design is screwed to the
   wall by (its placement declares it in `wall`, js/app.js) and nothing stands behind it? Holes there never show. */
const THIN_COVER=.3;
function coveredForGood(piece,axis,side){
  if(typeof connGraph!=='function'||!S.parts.includes(piece))return false;
  const b=plainBox(piece),face=side>0?b.hi[axis]:b.lo[axis];
  const others=[0,1,2].filter(k=>k!==axis);
  for(const link of connectionsOf(piece.id)){
    const other=link.a===piece?link.b:link.a;
    if(isProp(other)||tilted(other)||M[other.mat].kind!=='sheet'||other.t>THIN_COVER)continue;
    const o=plainBox(other);
    const against=side>0?Math.abs(o.lo[axis]-face)<.03:Math.abs(o.hi[axis]-face)<.03;
    if(against&&others.every(k=>o.lo[k]<=b.lo[k]+.05&&o.hi[k]>=b.hi[k]-.05))return true;
  }
  // the back of a piece screwed to the wall (the back of the design is z = its lowest)
  const set=S.sets&&piece.set!==undefined?S.sets[piece.set]:null;
  const onWall=set&&(set.wallFixed||(Array.isArray(set.wall)&&set.wall.includes(piece.name)));
  if(onWall&&axis===2&&side<0){
    const back=Math.min(...S.parts.filter(p=>p.set===piece.set&&!isProp(p)).map(p=>plainBox(p).lo[2]));
    if(Math.abs(b.lo[2]-back)<.03)return true;
  }
  return false;
}
/* Is this piece held at its ends by pocket holes drilled in it, while the joint j is along its length (not at an end)? */
function endPocketsOn(piece,j){
  if(typeof connGraph!=='function'||!S.parts.includes(piece)||j.k===piece.ax[0])return false;
  return connectionsOf(piece.id).some(link=>link.type==='pocket'&&link.joint&&link.joint.key!==j.key&&
    link.joint.k===piece.ax[0]&&pocketPiece(link.joint)===piece);
}
/* How many pocket holes the layout of this joint really has, when the joint is one of the design as it is now
   (0 when it is not, or while that is being worked out): a row may have left out holes that had no room past the
   holes in the ends of its piece (rule 11). jSpec gives this number, so the lists count what is drawn. */
let countingPockets=false;
/* the pocket holes of this joint as they are laid out in the design, or null (see pocketCountAsLaidOut) */
function pocketLayoutInDesign(j){
  if(countingPockets||typeof connGraph!=='function'||!S.parts.includes(j.a))return null;
  countingPockets=true;
  try{
    const link=connGraph().byKey.get(j.key),seen=link&&link.joint;
    if(!seen||link.type!=='pocket'||seen.a!==j.a||seen.b!==j.b)return null;
    const same=CARRY_FIELDS.every(field=>seen[field]===j[field])&&
      seen.ru[0]===j.ru[0]&&seen.ru[1]===j.ru[1]&&seen.rv[0]===j.rv[0]&&seen.rv[1]===j.rv[1];
    return same?layoutAsLaidOut(link):null;
  }finally{countingPockets=false;}
}
function pocketCountAsLaidOut(j){
  const layout=pocketLayoutInDesign(j);
  return layout?layout.length:0;
}
/* how many pocket holes of this joint are filled with plugs (rule 13), as laid out in the design */
function pocketPlugsAsLaidOut(j){
  const layout=pocketLayoutInDesign(j);
  return layout?layout.filter(f=>f.pocket&&f.pocket.plugged).length:0;
}
/* Rule 11: the stretches along a piece (direction t) that the pocket holes in its own ends take up on one face
   (out: the way that face looks). A pocket hole opens as a long oval: the 3/8" bit crosses the face at 15 degrees,
   so the oval runs about 3/4" each way from where the middle of the bit comes out (f.pocket.mouth), and the hole
   goes on inside to where the head sits (f.pos). Only asked for a row along the piece (a top on an apron), never
   for the joints at its ends, so working out their layouts here does not come back to this one.
   Returns {spans: [[lo, hi]] along t, names: the pieces those holes go into}. */
const END_HOLE_WEB=.25;   // wood left between two holes (inches), on top of the half hole clearOf keeps
/* Half the length of the oval a 3/8" pocket-hole bit leaves on the face, from where the middle of the bit comes out
   (about 0.72"): the one size of a pocket hole on the face, for rule 11 and for the piece drawings (js/partdrawings.js). */
const POCKET_OVAL=(3/16)/Math.sin(15*Math.PI/180);
function endHoleSpans(piece,j,out,t){
  const none={spans:[],names:[]};
  if(typeof connGraph!=='function'||!S.parts.includes(piece)||j.k===piece.ax[0]||t!==piece.ax[0])return none;
  const ovalHalf=dia=>POCKET_OVAL*dia/.375;
  const spans=[],names=new Set();
  for(const link of connectionsOf(piece.id)){
    const end=link.joint;
    if(link.type!=='pocket'||!link.fastened||!end||end.key===j.key||end.k!==piece.ax[0])continue;
    if(pocketPiece(end)!==piece)continue;
    for(const f of layoutAsLaidOut(link)){
      if(!f.pocket||f.pocket.out.some((v,k)=>Math.abs(v-out[k])>1e-6))continue;   // drilled in another face
      const half=ovalHalf(f.pocket.dia)+END_HOLE_WEB;
      spans.push([Math.min(f.pocket.mouth[t],f.pos[t])-half,Math.max(f.pocket.mouth[t],f.pos[t])+half]);
      names.add((end.a===piece?end.b:end.a).name);
    }
  }
  return spans.length?{spans,names:[...names]}:none;
}
/* Does this face of a piece look into the design (a line straight out of its middle runs into other wood within
   4 ft)? Then a pocket hole there is out of sight as much as one on the other face. Looks at every piece, so it
   is only asked about pieces held by pocket holes at both ends, and not in a very big design. */
const INSIDE_LOOK=48,INSIDE_MAX_PIECES=1500;
function faceIsInside(piece,axis,side,parts=S.parts){
  if(parts.length>INSIDE_MAX_PIECES)return false;
  const b=plainBox(piece),from=b.lo.map((v,k)=>(v+b.hi[k])/2);
  from[axis]=side>0?b.hi[axis]+.05:b.lo[axis]-.05;
  const way=alongAxis(axis,side);
  return parts.some(other=>{
    if(other===piece||isProp(other)||tilted(other))return false;
    const o=plainBox(other);
    if(!rayHitsBox(from,way,o))return false;
    const distance=side>0?o.lo[axis]-from[axis]:from[axis]-o.hi[axis];
    return distance<=INSIDE_LOOK;
  });
}
/* The stretches along direction t of a piece's face that other pieces cover: those that lie against the face
   (face: {axis, at, out}, the face at "at" facing "out") within a stretch along a second direction (band: {axis,
   range}). Only pieces that touch the piece are looked at (its neighbours in the connection graph), so this stays
   quick in a big design. skip: pieces that do not count (the two of the joint). Returns {spans: [[lo, hi]],
   names: the names of the pieces that cover, count: how many neighbours were looked at}. */
function coveredSpans(piece,skip,face,band,t){
  const spans=[],names=new Set();
  let count=0;
  if(typeof connGraph!=='function'||!S.parts.includes(piece))return{spans,names:[],count};
  const lo=Math.min(band.range[0],band.range[1]),hi=Math.max(band.range[0],band.range[1]);
  for(const link of connectionsOf(piece.id)){
    const other=link.a===piece?link.b:link.a;
    count++;
    if(skip.includes(other)||other===piece||isProp(other)||tilted(other))continue;
    if(M[other.mat].kind==='sheet'&&other.t<=THIN_COVER)continue;   // a thin back is nailed on after the holes are drilled and driven
    const b=plainBox(other);
    // it lies against the face: it starts at the face and reaches out from it
    const against=face.out>0?Math.abs(b.lo[face.axis]-face.at)<.03:Math.abs(b.hi[face.axis]-face.at)<.03;
    if(!against)continue;
    if(b.hi[band.axis]<=lo+.01||b.lo[band.axis]>=hi-.01)continue;
    spans.push([b.lo[t],b.hi[t]]);
    names.add(other.name);
  }
  return{spans,names:[...names],count};
}
/* The stretches along t of a row of pocket holes in this piece that a bolt keeps for itself: a bolt in the design
   (hardwareHoles) that crosses the row square to it, passes through the piece, and runs within BOLT_NEAR_JOINT of
   the joint face (a bolt at the back of an end cross piece does not move the holes at its front). Each stretch is
   the bolt's width, a pocket hole's bore and a drill bit's room on either side. */
const BOLT_NEAR_JOINT=2;
function boltSpansAcross(piece,shape,t){
  const spans=[];
  if(!S.parts.includes(piece))return spans;
  const b=plainBox(piece);
  for(const{f}of hardwareHoles()){
    if(f.hardware!=='bolt'||Math.abs(f.dir[t])>.1||Math.abs(f.dir[shape.k])>.1)continue;
    const along=[0,1,2].find(k=>Math.abs(f.dir[k])>.9);
    if(along===undefined)continue;
    const from=Math.min(f.pos[along],f.pos[along]+f.dir[along]*f.len),to=Math.max(f.pos[along],f.pos[along]+f.dir[along]*f.len);
    if(to<b.lo[along]+.05||from>b.hi[along]-.05)continue;                     // it does not pass through the piece
    if(f.pos[t]<b.lo[t]-.05||f.pos[t]>b.hi[t]+.05)continue;
    if(Math.abs(f.pos[shape.k]-shape.plane)>BOLT_NEAR_JOINT)continue;         // far from this joint
    const room=f.dia/2+.1875+FASTENER_ROOM;
    spans.push([f.pos[t]-room,f.pos[t]+room]);
  }
  return spans;
}
/* Places along a row (absolute positions), each moved off the covered spans to the nearest place that is clear,
   keeping endMin from the ends of the row and about an inch from the other places. room: half the width a
   place needs (half a hole and a little). Returns [{at, moved}] in the same order.
   prefer (optional): for two clear places equally near (within 1/32"), the one with the smaller prefer(at) wins.
   pocketScrews passes the left of the drilled face as the person drilling sees it, so pieces that do one job on
   opposite sides of a design that is the same left and right (the two long aprons of a desk, either side of the
   cross rail) come out drilled alike (spec 11, 7.3). Without it the lower world coordinate wins, as before. */
function clearOf(places,spans,range,endMin,room,prefer){
  if(!spans.length)return places.map(at=>({at,moved:false}));
  const lo=range[0]+Math.min(endMin,(range[1]-range[0])/2),hi=range[1]-Math.min(endMin,(range[1]-range[0])/2);
  const free=at=>at>=lo-1e-6&&at<=hi+1e-6&&!spans.some(([a,b])=>at>a-room&&at<b+room);
  const out=places.map(at=>({at,moved:false}));
  out.forEach((place,index)=>{
    if(free(place.at))return;
    // the nearest clear places on both sides of the span it is in
    const candidates=[];
    for(const[a,b]of spans){candidates.push(a-room-.05,b+room+.05);}
    candidates.sort((x,y)=>Math.abs(x-place.at)-Math.abs(y-place.at));
    const apart=at=>out.every((other,i)=>i===index||Math.abs(other.at-at)>=1);
    let pick=candidates.find(at=>free(at)&&apart(at));
    if(pick!==undefined&&prefer){
      const nearest=Math.abs(pick-place.at);
      const ties=candidates.filter(at=>free(at)&&apart(at)&&Math.abs(at-place.at)<=nearest+1/32);
      pick=ties.reduce((best,at)=>prefer(at)<prefer(best)-1e-9?at:best,pick);
    }
    if(pick!==undefined){place.at=r16(pick);place.moved=true;}
  });
  return out;
}
/* Dowels (rule 6). */
function dowelPegs(j,shape,n,dia,len,label){
  const way=shape.signInto(j.b),dir=alongAxis(shape.k,way);
  let inA=Math.min(len/2,j.da-FASTEN.dowelCover);
  const inB=Math.min(len-inA,j.db-FASTEN.dowelCover);
  inA=Math.min(len-inB,j.da-FASTEN.dowelCover); // what one piece cannot take goes into the other
  return spreadAlong(n,shape.long,FASTEN.endMin).map(along=>({
    kind:'dowel',pos:shape.point(along,shape.wide/2,shape.plane-way*inA),dir,len:inA+inB,dia,head:0,through:j.a,into:j.b,label,
    tip:`${label}, glued. Half in ${j.a.name}, half in ${j.b.name}.`,
  }));
}
/* L-brackets (rule 8). Looks for an inside corner: a side of one piece that ends at the joint, with the other
   piece running on past it. Where there is none (two boards stacked flush) the bracket lies flat across the seam. */
function cornerBrackets(j,shape,n,label){
  const F=FASTEN,boxes=new Map([[j.a,plainBox(j.a)],[j.b,plainBox(j.b)]]);
  let best=null;
  for(const piece of[j.a,j.b]){
    const other=shape.other(piece),mine=boxes.get(piece),theirs=boxes.get(other);
    for(const s of[shape.W,shape.L]){
      const range=s===shape.W?shape.rangeW:shape.rangeL;
      const t=[0,1,2].find(i=>i!==shape.k&&i!==s),rangeT=t===shape.L?shape.rangeL:shape.rangeW;
      for(const side of[-1,1]){
        const edge=side>0?range[1]:range[0];
        if(Math.abs((side>0?mine.hi[s]:mine.lo[s])-edge)>.02)continue;      // this piece does not end here
        const beyond=side>0?theirs.hi[s]-edge:edge-theirs.lo[s];              // how far the other runs on
        const corner=beyond>=.75,flush=Math.abs(beyond)<.02;
        if(!corner&&!flush)continue;
        // a third piece against that face (an apron against the inside of a leg) leaves less room for the plate
        const up=shape.signInto(piece),legOnPiece=Math.min(F.bracketLeg,shape.depthOf(piece));
        const covered=coveredSpans(piece,[other],{axis:s,at:edge,out:side},{axis:shape.k,range:[shape.plane,shape.plane+up*legOnPiece]},t);
        const open=openLength(rangeT,covered.spans,F.bracketWide/2+.05);
        if(open<F.bracketWide+.1)continue;                                    // no room for a plate here
        // an inside corner first, on the hidden side (the inside of the frame), with its other leg on a hidden face
        // of the other piece too (that face looks the way "up" goes), and across the narrow way
        const otherHidden=corner&&hiddenSide(other,shape.k)===up;
        const score=(corner?8:0)+(hiddenSide(piece,s)===side?6:0)+(otherHidden?6:0)+(s===shape.W?2:0);
        if(!best||score>best.score)best={score,piece,other,s,side,edge,flat:!corner,room:corner?Math.min(F.bracketLeg,beyond):F.bracketLeg,covered};
      }
    }
  }
  if(!best)best={piece:j.a,other:j.b,s:shape.W,side:1,edge:shape.rangeW[1],flat:true,room:F.bracketLeg,covered:{spans:[],names:[]}};
  const{piece,other,s,side,edge,flat}=best,k=shape.k,t=[0,1,2].find(i=>i!==k&&i!==s);
  const rangeT=t===shape.L?shape.rangeL:shape.rangeW;
  const up=shape.signInto(piece);                                  // along k, from the joint into "piece"
  const legOnPiece=Math.min(F.bracketLeg,shape.depthOf(piece)),legOnOther=flat?Math.min(F.bracketLeg,shape.depthOf(other)):best.room;
  const screwAt=[.3,.75];                                          // along a leg, as a share of its length
  const screwLen=bracketScrew(j).len;
  const places=clearOf(bracketSpread(n,rangeT),best.covered.spans,rangeT,F.bracketWide/2,F.bracketWide/2+.05);
  return places.map(({at:placeAt,moved})=>{
    const along=placeAt-rangeT[0];
    const at=(depth,across)=>{const p=[0,0,0];p[k]=shape.plane+depth;p[s]=edge+across;p[t]=rangeT[0]+along;return p;};
    const box=(c,sk,ss)=>{const sz=[0,0,0];sz[k]=sk;sz[s]=ss;sz[t]=F.bracketWide;return{c,s:sz};};
    const screw=(pos,dir)=>({pos,dir,len:screwLen,dia:FASTENER_SIZE.screw.dia,head:.3});
    const plates=[box(at(up*legOnPiece/2,side*F.bracketThick/2),legOnPiece,F.bracketThick)],screws=[];
    for(const share of screwAt)screws.push(screw(at(up*legOnPiece*share,side*F.bracketThick),alongAxis(s,-side)));
    if(flat){ // the second leg lies on the same side face, across the seam
      plates.push(box(at(-up*legOnOther/2,side*F.bracketThick/2),legOnOther,F.bracketThick));
      for(const share of screwAt)screws.push(screw(at(-up*legOnOther*share,side*F.bracketThick),alongAxis(s,-side)));
    }else{    // the second leg lies on the face of the other piece, in the corner
      plates.push(box(at(up*F.bracketThick/2,side*legOnOther/2),F.bracketThick,legOnOther));
      for(const share of screwAt)screws.push(screw(at(up*F.bracketThick,side*legOnOther*share),alongAxis(k,-up)));
    }
    return{kind:'bracket',pos:at(0,0),dir:alongAxis(s,side),len:F.bracketLeg,dia:F.bracketWide,head:0,through:piece,into:other,label,plates,screws,flat,
      ...(moved?{clear:best.covered.names}:{}),
      tip:`${label} with 4 short screws. Holds ${piece.name} to ${other.name}`+(flat?', flat across the seam.':' in the inside corner.')};
  });
}
/* Rule 8: where n brackets sit along a joint (absolute positions): one about every 12", the first and the last
   within 4" of the ends (BRACKET_EVERY, BRACKET_FROM_END in js/style.js); one alone in the middle. */
function bracketSpread(n,range){
  const long=range[1]-range[0];
  if(n<=1)return[range[0]+long/2];
  const fromEnd=Math.min(BRACKET_FROM_END,long/4);
  return Array.from({length:n},(unused,i)=>range[0]+fromEnd+i*(long-2*fromEnd)/(n-1));
}
/* how much of a row is not covered by the spans (each widened by room on both sides) */
function openLength(range,spans,room){
  const cuts=spans.map(([a,b])=>[Math.max(range[0],a-room),Math.min(range[1],b+room)]).filter(([a,b])=>b>a).sort((x,y)=>x[0]-y[0]);
  let covered=0,reach=range[0];
  for(const[a,b]of cuts){
    if(b<=reach)continue;
    covered+=b-Math.max(a,reach);
    reach=b;
  }
  return range[1]-range[0]-covered;
}

/* ---------- the layout of one joint ---------- */
function fastenerLayout(j,type){
  // A joint inside a turned set is laid out with the set standing square, as it stood before it was turned
  // (squaredUp, js/neighbors.js). Its fasteners are in the frame of the set and say so (f.frame): whoever draws
  // them in the world takes them there with fastenerInWorld.
  if(j.frame&&!squaredNow)return squaredUp(()=>fastenerLayout(j,type));
  // the count by the rules of thumb alone: a pocket-hole row may then drop holes that have no room (rule 11),
  // and jSpec gives the count that is laid out from then on (pocketCountAsLaidOut)
  const spec=jSpec(j,type,{asPlanned:true}),n=spec.n;
  if(!n||!spec.hw.length)return[];
  const shape=jointShape(j),sizes=sizesInLabel(spec.hw[0][0]),label=oneOf(spec.hw[0][0]);
  let list=[];
  if(type==='screw'||type==='nail'||type==='plug'){
    // (a plugged screw is a wood screw whose head sits under a wooden plug: rule 12)
    const kind=type==='nail'?'brad':'screw',len=sizes[sizes.length-1]||1.25;
    list=thruPart(j)?drivenStraight(j,shape,n,kind,len,label,type==='plug'):drivenAtAnAngle(j,shape,n,kind,len,label);
  }
  else if(type==='pocket')list=pocketScrews(j,shape,n,sizes[0]||1.25,label);
  else if(type==='dowel')list=dowelPegs(j,shape,n,sizes[0]||.375,sizes[1]||1.5,label);
  else if(type==='bracket'){
    list=cornerBrackets(j,shape,n,label);
    list.loose=true;   // where a plate goes depends on the pieces beside the joint (rule 10)
  }
  else if(spec.drive)list=framingLayout(j,shape,spec);   // 'frame' and 'toenail': js/framing.js says how they are driven
  for(const f of list){
    f.type=type;
    if(j.frame)f.frame=j.frame;
  }
  return j.shapes?keepOffOpenings(j,list):list;   // a joint with a shaped piece: no fastener in or beside a hole (js/shapes.js)
}
/* A fastener of a turned set as it is in the world: its place and its direction taken out of the frame of the set.
   (For drawing a single stick: the pocket and the plates of a bracket are not taken along.) A fastener of square
   pieces, and any fastener while the design is squared up, is returned as it is. */
function fastenerInWorld(f){
  if(!f.frame||squaredNow)return f;
  const pos=new THREE.Vector3(f.pos[0],f.pos[1],f.pos[2]).applyMatrix4(f.frame.matrix);
  const dir=new THREE.Vector3(f.dir[0],f.dir[1],f.dir[2]).applyQuaternion(f.frame.q);
  return{...f,pos:[pos.x,pos.y,pos.z],dir:[dir.x,dir.y,dir.z],frame:null};
}
/* where glue is spread: on the whole contact, for the joints that are glued as a matter of course */
const GLUED_TYPES={glue:1,dowel:1,nail:1};
function glueFilm(j,type){
  return GLUED_TYPES[type]?{k:j.k,plane:j.plane,ru:j.ru,rv:j.rv}:null;
}

/* The layout of a connection from the graph, worked out once and remembered. The graph is built again after
   every change of the design, but most joints are the same as before: a joint between the same two pieces, in the
   same place, with the same fastener keeps its layout (layoutCarry), so a change only costs the joints it touched.
   Everything is worked out again when the middle of the design moves, because the hidden side of a piece (where
   pocket holes and brackets go) depends on it. A layout marked loose depends on a third piece (the joist under a
   floor deck) and is never carried over. */
const layoutMemo=new WeakMap(); // link -> layout, for as long as that graph lives
const layoutCarry=new Map();    // joint key -> {what the layout was worked out from, list}
let carryMiddle='';
const CARRY_FIELDS=['k','plane','da','db','fa','fb','shapes'];   // shapes: a hole added to a piece lays its joints out again (js/shapes.js)
function sameJointAsBefore(old,j,type){
  if(old&&old.frame!==(j.frame?j.frame.id:''))return false;   // turned since, or turned differently
  if(!old||old.type!==type||old.a!==j.a||old.b!==j.b||old.nameA!==j.a.name||old.nameB!==j.b.name||old.thickA!==j.a.t||old.thickB!==j.b.t)return false;
  if(old.ru0!==j.ru[0]||old.ru1!==j.ru[1]||old.rv0!==j.rv[0]||old.rv1!==j.rv[1])return false;
  return CARRY_FIELDS.every(field=>old[field]===j[field]);
}
function fastenersOfLink(link){
  if(!link.joint||!link.fastened||link.type==='glue'||link.type==='angled')return[];
  // screws that would meet the screws of another joint inside the wood are set aside first (settledLayouts)
  const settled=settledLayouts();
  return settled.get(link)||layoutAsLaidOut(link);
}
/* the layout of one connection by the rules of thumb alone, before it is looked at beside its neighbours */
function layoutAsLaidOut(link){
  let list=layoutMemo.get(link);
  if(list)return list;
  // (the middle to the nearest half foot: a design that grows or shifts a little keeps its layouts)
  const j=link.joint,middle=designMiddle().map(v=>Math.round(v/6)).join();
  if(middle!==carryMiddle||layoutCarry.size>60000){layoutCarry.clear();carryMiddle=middle;}
  const old=layoutCarry.get(link.key);
  // (a layout that looked at the neighbours of a piece is only kept while that piece has as many neighbours)
  const sameNeighbours=!old||!old.list.near||connectionsOf(old.list.near.id).length===old.list.near.count;
  if(sameJointAsBefore(old,j,link.type)&&sameNeighbours){
    list=old.list;
    if(j.frame)for(const f of list)f.frame=j.frame;   // the same set, as it was found this time
  }
  else{
    const planned=fastenerLayout(j,link.type);
    list=planned;
    // two boards screwed through one upright from its two sides: the second is moved or angled (js/fastenerreach.js)
    if(typeof drivableLayout==='function')list=drivableLayout(link,list);
    // a joint with a shaped piece: screws moved or angled there keep off its holes too (js/shapes.js)
    if(j.shapes&&list!==planned)list=keepOffOpeningsAgain(j,list,planned);
    if(list.loose)layoutCarry.delete(link.key);
    else layoutCarry.set(link.key,{type:link.type,a:j.a,b:j.b,nameA:j.a.name,nameB:j.b.name,thickA:j.a.t,thickB:j.b.t,
      ru0:j.ru[0],ru1:j.ru[1],rv0:j.rv[0],rv1:j.rv[1],k:j.k,plane:j.plane,da:j.da,db:j.db,fa:j.fa,fb:j.fb,shapes:j.shapes,frame:j.frame?j.frame.id:'',list});
  }
  layoutMemo.set(link,list);
  return list;
}

/* ---------- checking a fastener ---------- */
/* Is the point inside one of the pieces of the fastener (or within "slack" inches of it)? */
function insideEither(point,f,slack){
  return[f.through,f.into,...(f.also||[])].some(piece=>{
    const b=plainBox(piece);
    return[0,1,2].every(k=>point[k]>=b.lo[k]-slack&&point[k]<=b.hi[k]+slack);
  });
}
function fastenerProblem(f){
  if(f.frame&&!squaredNow)return squaredUp(()=>fastenerProblem(f));   // judged where it was laid out: with its set standing square
  const inBox=(point,piece)=>{const b=plainBox(piece);return[0,1,2].every(k=>point[k]>=b.lo[k]-.03&&point[k]<=b.hi[k]+.03);};
  const check=(pos,dir,len,what,startSlack)=>{
    const point=pointPlus(pos,dir,len);
    if(!insideEither(pos,f,startSlack))return`${what} starts outside the wood`;
    if(!insideEither(point,f,.03))return`${what} pokes out of the wood`;
    return'';
  };
  if(f.kind==='bracket'){
    for(const screw of f.screws){ // its head sits on the plate, which is that much off the wood
      const wrong=check(screw.pos,screw.dir,screw.len,'a bracket screw',FASTEN.bracketThick+.03);
      if(wrong)return wrong;
    }
    return'';
  }
  const wrong=check(f.pos,f.dir,f.len,`the ${f.kind}`,.03);
  if(wrong)return wrong;
  // it must end in the piece that receives it (for a plate screw: in the framing beyond the plywood)
  const point=pointPlus(f.pos,f.dir,f.len),receivers=f.also&&f.also.length?f.also:[f.into];
  if(!receivers.some(piece=>inBox(point,piece)))return`the ${f.kind} does not reach ${receivers[0].name}`;
  if(f.kind==='dowel'){
    const asked=sizesInLabel(f.label)[1];
    if(asked&&f.len<asked-.01)return`the wood is too thin for a ${f.label}`;
  }
  return'';
}

/* ---------- screws of different joints that share a corner ----------
   Where three pieces meet at a corner (a post against the end of a frame whose rail is already screwed to its
   cross piece), the rules of thumb put the screws of each joint the same 7/8" in from the edges, and a later
   screw would run into an earlier one inside the wood. So the layouts of a design are looked at together, once
   for each state of the design: joint after joint, in a fixed order, and a joint whose screws would meet the
   screws that are already settled has ALL its screws moved the same way, toward the middle of the joint (or,
   failing that, toward its edges), by the smallest step that clears them. Every joint of a kind that meets the
   same trouble moves alike, so a line of the instructions still gives one set of numbers, and the fasteners so
   moved are marked (f.moved) so that the line can say why they sit where they do.

   The order: pocket holes first (they can only move along their row), then joints into the end of a board
   (frames), then board on board, then plywood onto boards; in each group the ones driven from front to back first, then left to right, then down. That is
   the order such things are usually built in, but nothing depends on it being the true order: whichever joint
   is looked at second gets out of the way.

   Framing nails are left alone (a thin nail turns aside), and so are slanted screws and the long
   screws of a wall plate, which have their own reasons for where they are. A design with more than
   SETTLE_MAX fastened joints is not looked at: its screws stay where the rules of thumb put them. */
const SETTLE_MAX=6000;
const SETTLE_STEPS=[.375,.5,.25,.625,.75];   // how far a joint's screws are moved, tried in this order (inches)
const SETTLE_KEEP={apart:.75,edge:.375,end:.5}; // what a move must leave: between two screws, to the edge and to the end of the joint
const settledMemo=new WeakMap();   // graph -> Map link -> layout (only the joints that were moved)
/* The holes of the hardware in the design that the screws of the joints must keep clear of, as fasteners that
   cannot move: [{f, link}], link a stand-in marked fixed (it never gives way). A carriage bolt between two rack
   sections (its 3/8" shank through the end cross pieces and posts, js/rackwall.js) and a screw into a wall stud (a
   1/4" structural screw through the back rail of the top frame; two structural screws keep STRUCTURAL_CLEARANCE).
   A bolt is placed clear of the screws of every style (placeRackHardware), but a screw that settles later (a
   cabinet stand's end cross piece into its post in Fine furniture, pushed down by the 2" screws of the deck into
   the post top) could otherwise come to rest against it. */
function hardwareHoles(){
  if(typeof hardwareList!=='function'||typeof hardwarePose!=='function')return[];
  const out=[];
  for(const item of hardwareList()){
    const bolt=item.kind==='bolt',wall=item.kind==='wallscrew';
    if(!bolt&&!wall)continue;
    const pose=hardwarePose(item);
    if(!pose)continue;
    const dir=[-pose.n.x,-pose.n.y,-pose.n.z],at=[pose.at.x,pose.at.y,pose.at.z];
    const len=bolt?((item.geo&&item.geo.grip)||item.size):item.size;
    // (started HEAD_DEPTH back, so that drilledStretches takes in the whole length from the face on)
    const f={kind:'hole',hardware:item.kind,pos:pointPlus(at,dir,-HEAD_DEPTH),dir,len:len+HEAD_DEPTH,
      dia:bolt?2*BOLT_RADIUS:.25,structural:wall};
    out.push({f,link:{fixed:true,key:'hardware '+item.id}});
  }
  return out;
}
function settledLayouts(){
  const graph=connGraph();
  let moved=settledMemo.get(graph);
  if(moved)return moved;
  moved=new Map();
  settledMemo.set(graph,moved);   // before anything is laid out, so that nothing below comes back here
  // (brads too: one driven through a thin panel onto the head of a screw bends over, so it is moved aside like a screw;
  // a plugged screw is a screw whose head is sunk, and moves like one)
  const links=graph.links.filter(link=>link.joint&&link.fastened&&(link.type==='screw'||link.type==='pocket'||link.type==='plug'||link.type==='nail'));
  if(!links.length||links.length>SETTLE_MAX)return moved;
  const rank=link=>{
    const list=layoutAsLaidOut(link),f=list[0];
    if(!f)return 9;
    const intoFace=f.into===link.joint.a?link.joint.fa:link.joint.fb;
    // screws angled by drivableLayout (js/fastenerreach.js) cannot move, so they go first and the others make way
    const group=f.angledAt?-1:f.kind==='pocket'?0:M[f.through.mat].kind==='sheet'?3:intoFace==='end'?1:2;
    return group*3+[1,2,0][link.joint.k];
  };
  const ranked=links.map(link=>({link,rank:rank(link)})).sort((a,b)=>a.rank-b.rank||(a.link.key<b.link.key?-1:1));
  // the screws that are settled so far, in a grid of 4" cells, each frame of a turned set by itself
  const cells=new Map();
  const cellsOf=f=>{
    const keys=[],frame=f.frame?f.frame.id:'';
    // everything the screw takes up, its hole included (drilledStretches), a little wider than that, so that two
    // screws on either side of the edge of a cell still find each other
    const ends=drilledStretches(f).flatMap(x=>[x.from,pointPlus(x.from,x.dir,x.len)]);
    const lo=[0,1,2].map(k=>Math.floor((Math.min(...ends.map(p=>p[k]))-.3)/4)),hi=[0,1,2].map(k=>Math.floor((Math.max(...ends.map(p=>p[k]))+.3)/4));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)keys.push(frame+'|'+x+'|'+y+'|'+z);
    return keys;
  };
  const meets=(f,own)=>{
    // a place in or beside a hole or cut of a shaped piece of the joint is taken too (js/shapes.js)
    if(own.joint&&own.joint.shapes&&fastenerInAnOpening(f,own.joint))return true;
    for(const key of cellsOf(f)){
      for(const other of cells.get(key)||[]){
        if(other.link===own)continue;
        if(other.link.fixed&&!holesCount)continue;
        if(screwsMeet(f,other.f))return true;
      }
    }
    return false;
  };
  const settle=(list,link)=>{
    for(const f of list){
      for(const key of cellsOf(f)){
        if(!cells.has(key))cells.set(key,[]);
        cells.get(key).push({f,link});
      }
    }
  };
  // what can be moved: screws, pocket screws and brads, not one driven at an angle (a toe screw) or one of a set
  const movable=list=>list.length>0&&list.every(f=>(f.kind==='screw'||f.kind==='pocket'||f.kind==='brad')&&!f.toe&&!(f.also&&f.also.length));
  const unsettle=link=>{for(const list of cells.values())for(let i=list.length-1;i>=0;i--)if(list[i].link===link)list.splice(i,1);};
  // The holes of the bolts and of the screws into the wall studs that are in the design (hardwareHoles) are drilled
  // where they are drawn and never move: they are settled first, and the screws of the joints keep clear of them.
  // (holesCount: whether they count just now; see the loop below)
  let holesCount=true;
  for(const hole of hardwareHoles())settle([hole.f],hole.link);
  /* the way out of the way for one joint: the whole joint moved, else each screw by itself; null when neither clears */
  const wayOut=(link,list)=>{
    for(const candidate of movedLayouts(link.joint,list)){
      if(!candidate.some(f=>meets(f,link)))return candidate;
    }
    const nudged=nudgedLayout(link.joint,list,f=>meets(f,link));
    return nudged&&!nudged.some(f=>meets(f,link))?nudged:null;
  };
  /* When a joint cannot get out of the way (the screws of a top driven down into the edge of a short apron, right
     where the screws through the leg go into its end, with no room to move along a 3/4" edge), the joints already
     settled that it meets give way instead: each is moved like any other, with this joint in place. When one of
     them cannot move either, everything is put back as it was. */
  const giveWay=(link,list)=>{
    const blockers=new Set();
    for(const f of list)for(const key of cellsOf(f))for(const other of cells.get(key)||[])
      if(other.link!==link&&!(other.link.fixed&&!holesCount)&&screwsMeet(f,other.f))blockers.add(other.link);
    if(!blockers.size||[...blockers].some(other=>other.fixed||!movable(moved.get(other)||layoutAsLaidOut(other))))return false;
    const before=new Map([...blockers].map(other=>[other,moved.get(other)]));
    for(const other of blockers)unsettle(other);
    settle(list,link);
    for(const other of blockers){
      // from where the rules of thumb put it, else from where it had been moved to before
      const out=wayOut(other,layoutAsLaidOut(other))||(before.get(other)&&wayOut(other,before.get(other)));
      if(!out){
        // put it all back
        unsettle(link);
        for(const back of blockers){
          unsettle(back);
          if(before.get(back))moved.set(back,before.get(back));else moved.delete(back);
          settle(before.get(back)||layoutAsLaidOut(back),back);
        }
        return false;
      }
      moved.set(other,out);
      settle(out,other);
    }
    return true;
  };
  /* A joint gets a place that meets nothing: where it stands, moved, or with the others giving way. false when
     there is none (nothing is changed then). */
  const placeCleanly=(link,list)=>{
    if(!list.some(f=>meets(f,link))){settle(list,link);return true;}
    if(!movable(list))return giveWay(link,list);
    const best=wayOut(link,list);
    if(best){moved.set(link,best);settle(best,link);return true;}
    // the others give way to this joint where it stands, or where one of its own moves leaves fewer in its way
    for(const where of[list,...movedLayouts(link.joint,list)]){
      if(!giveWay(link,where))continue;
      if(where!==list)moved.set(link,where);
      return true;
    }
    return false;
  };
  for(const{link}of ranked){
    const list=layoutAsLaidOut(link);
    if(placeCleanly(link,list))continue;
    // A joint that finds no place clear of the hardware holes as well (the crowded end cross piece of a rack
    // section in Fine furniture) is placed as if they were not there: the bolts were put where they clear the
    // screws of every style (placeRackHardware), and one joint crowded by them must not push the others into
    // each other.
    holesCount=false;
    const placed=placeCleanly(link,list);
    holesCount=true;
    if(placed){
      // where that place is in a hole's way, each screw is still nudged out of it when that meets nothing else
      const now=moved.get(link)||list;
      if(now.some(f=>meets(f,link))){
        const nudged=nudgedLayout(link.joint,now,f=>meets(f,link));
        if(nudged&&!nudged.some(f=>meets(f,link))){unsettle(link);moved.set(link,nudged);settle(nudged,link);}
      }
      continue;
    }
    // screws that cannot move themselves (driven at an angle: a toe screw up through a foot) stay where they are
    if(!movable(list)){settle(list,link);continue;}
    // nothing clears it: each screw that meets another still gets out of its way where it can
    const nudged=nudgedLayout(link.joint,list,f=>meets(f,link));
    if(nudged)moved.set(link,nudged);
    settle(nudged||list,link);
  }
  return moved;
}
/* The ways the screws of one joint can get out of the way, nearest first: each is the whole layout with every
   screw moved by the same amount toward the middle of the joint along one of its two directions, or along
   both, and after those, toward the edges. A move is only offered when it leaves SETTLE_KEEP.apart between screws that
   stood on opposite sides of the middle, and the usual distance to the edge and the end of the joint. */
function* movedLayouts(joint,list){
  const shape=jointShape(joint),pocket=list[0].kind==='pocket';
  // a pocket-hole screw can only move along the row of holes; a screw driven straight in, both ways in the joint
  const axes=pocket?[[0,1,2].find(k=>k!==shape.k&&Math.abs(list[0].dir[k])<1e-6)]:[shape.W,shape.L];
  const range=axis=>axis===shape.L?shape.rangeL:shape.rangeW;
  const shifted=(steps)=>{   // steps: Map axis -> signed amount as a function of the screw, or null when it cannot be done
    const out=[];
    for(const f of list){
      const pos=f.pos.slice(),mouth=f.pocket?f.pocket.mouth.slice():null;
      for(const[axis,amountOf]of steps){
        const amount=amountOf(f);
        if(amount===null)return null;
        pos[axis]+=amount;
        if(mouth)mouth[axis]+=amount;
      }
      out.push({...f,pos,...(mouth?{pocket:{...f.pocket,mouth}}:{}),moved:true});
    }
    return out;
  };
  const inward=(axis,step)=>f=>{
    const middle=(range(axis)[0]+range(axis)[1])/2,off=f.pos[axis]-middle;
    if(Math.abs(off)<.02)return 0;                                   // on the middle line: it stays
    if(Math.abs(off)-step<SETTLE_KEEP.apart/2)return null;           // it would come too near its partner
    return-Math.sign(off)*step;
  };
  const outward=(axis,step)=>f=>{
    const[lo,hi]=range(axis),middle=(lo+hi)/2,off=f.pos[axis]-middle,keep=axis===shape.L&&!pocket?SETTLE_KEEP.end:SETTLE_KEEP.edge;
    if(Math.abs(off)<.02)return 0;
    if(Math.min(f.pos[axis]-lo,hi-f.pos[axis])-step<keep)return null;
    return Math.sign(off)*step;
  };
  const really=layout=>layout&&layout.some((f,index)=>f.pos.some((v,k)=>Math.abs(v-list[index].pos[k])>1e-6));
  for(const way of[inward,outward]){
    for(const step of SETTLE_STEPS){
      for(const axis of axes){
        const layout=shifted(new Map([[axis,way(axis,step)]]));
        if(really(layout))yield layout;
      }
      if(axes.length>1){
        const layout=shifted(new Map(axes.map(axis=>[axis,way(axis,step)])));
        if(really(layout))yield layout;
      }
    }
  }
}

/* The last way out: each screw of the joint that meets another screw is moved by itself, along the joint first and
   then across it, toward the middle first, by the smallest step that clears it and keeps it SETTLE_KEEP away from
   the edges of the joint and from the other screws of its own joint. In a row of three or more the moved screw
   keeps a note of where the even spacing had it (pos0), so that the words can still say "one about every 8 in."
   and add that a mark which lands on a screw is moved along the line. Returns the new layout, or null when no
   screw could be moved. */
const NUDGE_STEPS=[.375,.5,.625,.75,1];
function nudgedLayout(joint,list,meets){
  const shape=jointShape(joint),pocket=list[0].kind==='pocket';
  const axes=pocket?[[0,1,2].find(k=>k!==shape.k&&Math.abs(list[0].dir[k])<1e-6)]:[shape.L,shape.W];
  const range=axis=>axis===shape.L?shape.rangeL:shape.rangeW;
  const out=list.slice();
  let changed=false;
  list.forEach((f,index)=>{
    if(!meets(f))return;
    for(const step of NUDGE_STEPS){
      for(const axis of axes){
        const[lo,hi]=range(axis),inward=f.pos[axis]<=(lo+hi)/2?1:-1;
        for(const sign of[inward,-inward]){
          const pos=f.pos.slice(),mouth=f.pocket?f.pocket.mouth.slice():null;
          pos[axis]+=sign*step;
          if(mouth)mouth[axis]+=sign*step;
          if(pos[axis]<lo+SETTLE_KEEP.edge||pos[axis]>hi-SETTLE_KEEP.edge)continue;
          if(out.some((other,at)=>at!==index&&Math.hypot(other.pos[0]-pos[0],other.pos[1]-pos[1],other.pos[2]-pos[2])<SETTLE_KEEP.apart))continue;
          const tried={...f,pos,...(mouth?{pocket:{...f.pocket,mouth}}:{})};
          if(meets(tried))continue;
          out[index]=list.length>2?{...tried,pos0:f.pos,nudged:true}:{...tried,moved:true};
          changed=true;
          return;
        }
      }
    }
  });
  if(!changed)return null;
  // a pair that was moved gives its own numbers in the words, so both of the pair say so
  return list.length>2?out:out.map(f=>f.moved?f:{...f,moved:true});
}

/* ---------- screws that would meet inside the wood ---------- */
/* how near two stretches come to each other (each from p to p + d * len) */
function stretchGap(p1,d1,len1,p2,d2,len2){
  const u=[d1[0]*len1,d1[1]*len1,d1[2]*len1],v=[d2[0]*len2,d2[1]*len2,d2[2]*len2],w=[p1[0]-p2[0],p1[1]-p2[1],p1[2]-p2[2]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(u,w),e=dot(v,w),den=a*c-b*b;
  let s=den<1e-9?0:(b*e-c*d)/den;
  s=Math.max(0,Math.min(1,s));
  let t=c<1e-9?0:(b*s+e)/c;
  if(t<0){t=0;s=Math.max(0,Math.min(1,-d/a));}
  else if(t>1){t=1;s=Math.max(0,Math.min(1,(b-d)/a));}
  return Math.hypot(w[0]+s*u[0]-t*v[0],w[1]+s*u[1]-t*v[1],w[2]+s*u[2]-t*v[2]);
}
/* The screws of two different joints that come nearer to each other than their own thickness plus a drill bit:
   one would hit the other when it is driven, or leave a sliver of wood between them that splits. A screw cannot
   be placed to a hair by hand and a structural screw driven without a pilot hole wanders, so 1/8" (the pilot bit
   of a #8 screw, the room js/fastenerroom.js asks for) is kept between them, and screws that settle (below) move
   until they have it. Returns [{a, b, gap}] with the two fasteners. Screws and pocket-hole screws only: a brad or
   a nail turns aside, a screw does not. */
const SCREW_CLEARANCE=1/8;
/* Two structural screws that cross inside one piece (the screws of a long and a short apron through a 4x4 leg)
   are driven with no pilot hole and wander more: they are kept 1/2" apart, in practice staggered in height. */
const STRUCTURAL_CLEARANCE=1/2;
/* Would these two screws touch inside the wood? Their shanks are compared from 1/4" under the head on: two heads
   that sit back to back in two boards that touch (the posts of two racks standing side by side) are not in each
   other's way. */
const HEAD_DEPTH=.25;
function screwsMeet(a,b){
  const clearance=a.structural&&b.structural?STRUCTURAL_CLEARANCE:SCREW_CLEARANCE;
  for(const x of drilledStretches(a)){
    for(const y of drilledStretches(b)){
      if(stretchGap(x.from,x.dir,x.len,y.from,y.dir,y.len)<x.r+y.r+clearance)return true;
    }
  }
  return false;
}
/* What a screw takes up inside the wood, as stretches {from, dir, len, r}: its shank, from 1/4" under the head
   on; for a pocket-hole screw also the hole the head sits in (the 3/8" bore from where it opens on the face to
   the head, and the long oval it makes on the face, which runs about 3/4" past where the middle of the bit comes
   out); for a screw whose head sits in a deep hole (f.sunk) that hole. Two holes that run into each other, or a
   screw driven through another screw's hole, cannot both be made, so these count as meeting too (the holes of
   two pocket screws at the two ends of a short apron, a screw through a 4x4 leg whose deep hole meets the deep
   hole of the screw from the next face). COUNTERBORE_DIA: the bit for that deep hole (3/8" for a #8 head). */
const COUNTERBORE_DIA=.375;
function drilledStretches(f){
  const head=Math.min(HEAD_DEPTH,f.len/2);
  const out=[{from:pointPlus(f.pos,f.dir,head),dir:f.dir,len:f.len-head,r:f.dia/2}];
  if(f.kind==='pocket'&&f.pocket){
    const r=f.pocket.dia/2,oval=r/Math.sin(FASTEN.pocketDegrees*Math.PI/180)-r;
    const deep=Math.hypot(...f.pos.map((v,k)=>v-f.pocket.mouth[k]));
    out.push({from:pointPlus(f.pocket.mouth,f.dir,-oval),dir:f.dir,len:deep+oval,r});
  }
  if(f.sunk>0){
    const r=Math.max(f.head||FASTENER_SIZE.screw.head,COUNTERBORE_DIA)/2;
    out.push({from:pointPlus(f.pos,f.dir,-f.sunk),dir:f.dir,len:f.sunk,r});
  }
  return out;
}
/* Self-check: screws that pass within a hair of each other count as meeting (the Rustic Dining table had a top screw
   0.043" from the tip of a structural screw), a drill bit apart they do not, and two structural screws crossing in
   a leg need 1/2". The presets themselves are checked by screwsPassEachOther below and showFacesOfHouseFurniture
   (js/showfaces.js), which use this same test. */
SELFTESTS.push(function screwsKeepADrillBitApart(problems){
  const screw=(pos,dir,structural)=>({kind:'screw',pos,dir,len:3,dia:structural?.25:.164,head:.33,structural:!!structural});
  // two shanks crossing at right angles, their surfaces `gap` apart
  const pair=(gap,structural)=>{
    const r=structural?.125:.082;
    return[screw([0,0,-1.5],[0,0,1],structural),screw([-1.5,2*r+gap,0],[1,0,0],structural)];
  };
  if(!screwsMeet(...pair(.06)))problems.push('screws 1/16" apart must count as running into each other');
  if(screwsMeet(...pair(.2)))problems.push('screws 3/16" apart must not count as running into each other');
  if(!screwsMeet(...pair(.3,true)))problems.push('two structural screws 5/16" apart in a leg must count as too close (they wander without a pilot hole)');
  if(screwsMeet(...pair(.6,true)))problems.push('two structural screws 5/8" apart must not count as too close');
});
function screwsThatMeet(){
  const screws=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link))if(f.kind==='screw'||f.kind==='pocket')screws.push({f,link});
  }
  // sorted along x, so that only neighbours are compared
  const reach=item=>{
    const xs=drilledStretches(item.f).flatMap(x=>[x.from[0],x.from[0]+x.dir[0]*x.len]);
    return[Math.min(...xs),Math.max(...xs)];
  };
  for(const item of screws)item.x=reach(item);
  screws.sort((a,b)=>a.x[0]-b.x[0]);
  const met=[];
  for(let i=0;i<screws.length;i++){
    for(let j=i+1;j<screws.length&&screws[j].x[0]<=screws[i].x[1]+.3;j++){
      const a=screws[i],b=screws[j];
      if(a.link===b.link)continue;
      if(screwsMeet(a.f,b.f))met.push({a:a.f,b:b.f});
    }
  }
  return met;
}

/* Self-check: in no preset does a screw of one joint run into a screw of another, a screw that was moved out of
   the way still stays inside its two pieces and reaches the second one, and a line of the instructions whose
   screws were moved says so. Then a corner made by hand: a rail screwed into the end of a cross piece, and a post
   screwed over that corner into the end of the rail. */
SELFTESTS.push(function screwsPassEachOther(problems){
  const wrong=text=>{if(problems.length<60)problems.push('screws at a corner: '+text);};
  let movedSomewhere=false;
  for(const preset of PRESETS){
    const vals=presetDefaults(preset);
    let parts=[];
    try{parts=preset.build(vals)||[];}catch(e){}
    if(!parts.length)continue;
    placePreset(preset,vals,parts,false);
    screwsHaveRoom(preset.name,wrong);   // (and none crammed together in one joint: see screwsHaveRoom below)
    const met=screwsThatMeet();
    if(met.length)wrong(`${preset.name}: ${met.length} pairs of screws would meet inside the wood (${met[0].a.through.name} into ${met[0].a.into.name}, and ${met[0].b.through.name} into ${met[0].b.into.name})`);
    for(const link of connGraph().links){
      for(const f of fastenersOfLink(link)){
        if(!f.moved&&!f.nudged)continue;
        movedSomewhere=true;
        const problem=fastenerProblem(f);
        if(problem){wrong(`${preset.name}: a screw that was moved out of the way of another (${f.through.name} into ${f.into.name}): ${problem}`);break;}
      }
    }
  }
  if(!movedSomewhere)wrong('no preset has screws that were moved to pass each other: the corners are no longer looked at');
  // the aquarium stand: the posts go on over corners that already hold screws, and their line says so
  const stand=PRESETS.find(candidate=>candidate.name==='Single aquarium stand');
  if(stand){
    const vals=presetDefaults(stand);
    placePreset(stand,vals,stand.build(vals),false);
    const lines=buildPlan(true).steps.flatMap(step=>step.groups);
    const post=lines.find(group=>/through the Post \([A-Z]+\) into the end of the Rail/.test(group.line));
    if(!post||!/not the usual ones on purpose/.test(post.where))wrong('the post screws of the aquarium stand do not say that their marks are set to pass the screws already in the corner: '+(post&&post.where));
  }
  // by hand
  load(JSON.stringify(blank()),true);
  addParts([mk('Rail','2x4',[30,3.5,1.5],[0,0,0]),mk('Cross piece','2x4',[1.5,3.5,12],[0,0,1.5]),mk('Post','2x4',[1.5,30,3.5],[-1.5,0,0])]);
  commit();
  if(screwsThatMeet().length)wrong('by hand: a post screwed over the corner of a rail and a cross piece has screws that meet the screws of that corner');
  if(![...settledLayouts().values()].length)wrong('by hand: no screw was moved at a corner where three boards meet');
});

/* Self-check: two screws of one joint never sit closer together than 3/4" (the first-time builder found two 3"
   screws 5/8" apart on the strip of a seat board over a cross rail, and two 1/2" apart in the top of a 2x2 leg),
   and a joint too short for two takes one (TWO_SCREWS_FROM in js/style.js). Run on every preset as it is placed,
   by the self-check screwsPassEachOther above. */
function screwsHaveRoom(label,wrong){
  const ROOM=FASTEN.endMin-.02;
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened||(link.type!=='screw'&&link.type!=='plug'))continue;
    const j=link.joint,long=Math.max(j.ru[1]-j.ru[0],j.rv[1]-j.rv[0]);
    const layout=fastenersOfLink(link);
    if(long<TWO_SCREWS_FROM&&layout.length>1){wrong(`${label}: ${layout.length} screws in a ${fmt(r16(long))} joint (${layout[0].through.name} into ${layout[0].into.name})`);return;}
    for(let i=0;i<layout.length;i++)for(let n=i+1;n<layout.length;n++){
      // measured on the face the screws go in at: their heads
      const a=layout[i].pos,b=layout[n].pos,apart=Math.hypot(...[0,1,2].filter(k=>k!==j.k).map(k=>a[k]-b[k]));
      if(apart<ROOM){wrong(`${label}: two screws of one joint ${fmt(r16(apart))} apart (${layout[i].through.name} into ${layout[i].into.name})`);return;}
    }
  }
}

/* ---------- checks ---------- */
/* The designs the self-checks of fasteners, doors and hardware try: every preset with its usual sizes, with each
   choice of each option and each check box flipped (the cabinet versions of the fish stands, the Shed with its
   plywood door), and with the other choices the preset declares (variants).  [{preset, vals, name}] */
function presetVariants(){
  const list=[];
  for(const preset of PRESETS){
    const usual=Object.fromEntries(preset.params.filter(q=>!q.head).map(q=>[q.k,q.v]));
    list.push({preset,vals:usual,name:preset.name});
    for(const q of preset.params){
      if(!q.k)continue;
      if(q.opts){
        for(const[value,label]of q.opts){
          if(value!==usual[q.k])list.push({preset,vals:{...usual,[q.k]:value},name:`${preset.name} (${String(label||value).toLowerCase()})`});
        }
      }else if(q.check)list.push({preset,vals:{...usual,[q.k]:!q.v},name:`${preset.name} (${String(q.label||q.k).toLowerCase()}: ${q.v?'off':'on'})`});
    }
    (preset.variants||[]).forEach((variant,i)=>list.push({preset,vals:{...usual,...variant},name:`${preset.name} (variant ${i+1})`}));
  }
  return list;
}
/* Puts one of those designs into an empty project the way Create does, short of drawing it: the pieces, the
   preset's own hardware list and the fasteners it names (storeNamedJoints, js/joints.js). Returns the ids of the
   pieces, or null when the preset builds nothing with these values. */
function placeForCheck(variant){
  let parts=[];
  try{parts=variant.preset.build(variant.vals);}catch(e){}
  if(!parts.length)return null;
  load(JSON.stringify(blank()),true);
  S.hw=variant.preset.hw?variant.preset.hw(variant.vals):[];
  const ids=addParts(parts);
  storeNamedJoints(variant.preset,parts,variant.vals);
  return ids;
}
function checkJointFasteners(j,type,where,wrong){
  const spec=jSpec(j,type),layout=fastenerLayout(j,type);
  if(layout.length!==spec.n){wrong(`${where}: ${j.a.name} to ${j.b.name} (${type}) is drawn with ${layout.length} fasteners but listed with ${spec.n}`);return;}
  for(const f of layout){
    const problem=fastenerProblem(f);
    if(problem){wrong(`${where}: ${j.a.name} to ${j.b.name} (${f.label}): ${problem}`);return;}
    if(!f.tip||/undefined|NaN/.test(f.tip+f.pos+f.dir+f.len)){wrong(`${where}: ${j.a.name} to ${j.b.name} (${type}) has a fastener with a missing value`);return;}
    if(spec.drive&&(f.through!==spec.drive.through||f.into!==spec.drive.into)){wrong(`${where}: ${j.a.name} to ${j.b.name} (${type}) is drawn through ${f.through.name}, but the list says through ${spec.drive.through.name}`);return;}
  }
  if(type==='pocket'&&layout.length&&!spec.text.includes(layout[0].through.name.toLowerCase()))wrong(`${where}: the pocket holes are drawn in ${layout[0].through.name} but listed as "${spec.text}"`);
}
/* Every preset as it is placed (with the fasteners it names itself, so the Shed is checked with its nails): for
   every joint the layout has as many fasteners as jSpec says, each stays inside the wood and reaches the piece
   that receives it, the pocket holes are in the piece jSpec names, and a framing nail goes through the piece
   js/framing.js names. Pieces that only touch get nothing. Then the same for every kind of fastener on a few
   joints made by hand. */
SELFTESTS.push(function fastenerLayouts(problems){
  const seen=new Set();
  const wrong=text=>{ // one line per kind of problem is enough to act on
    const kind=text.replace(/^[^:]*: /,'');
    if(!seen.has(kind)&&seen.size<12){seen.add(kind);problems.push('fasteners: '+text);}
  };
  const typesSeen=new Set();
  for(const variant of presetVariants()){
    if(!placeForCheck(variant))continue;
    for(const j of findJoints()){
      const type=jType(j);
      typesSeen.add(type);
      if(type==='none'&&fastenerLayout(j,type).length)wrong(`${variant.name}: ${j.a.name} and ${j.b.name} only touch, but a fastener is drawn there`);
      checkJointFasteners(j,type,variant.name,wrong);
    }
  }
  for(const type of['frame','toenail','none']){
    if(!typesSeen.has(type))wrong(`no preset was checked with a joint of type "${type}": the fasteners a preset names are not being read`);
  }
  // by hand: every kind of fastener on a butt joint, a corner, a stack and a thin panel
  load(JSON.stringify(blank()),true);
  addParts([mk('Rail','2x4',[24,3.5,1.5],[3.5,10,1]),mk('Leg','4x4',[3.5,30,3.5],[0,0,0]),      // end of a rail against a leg
    mk('Top','1x6',[30,.75,5.5],[0,30,0]),                                                        // a board on top of the leg
    mk('Plank','2x4',[24,1.5,3.5],[40,0,0]),mk('Plank','2x4',[24,1.5,3.5],[40,1.5,0]),             // two boards stacked flush
    mk('Panel','ply14',[12,12,.25],[80,0,0]),mk('Cleat','1x2',[12,1.5,.75],[80,0,.25])]);         // a thin panel on a cleat
  for(const j of findJoints()){
    for(const type of['screw','pocket','dowel','nail','bracket','frame','toenail']){
      // a 1/4" panel cannot take a pocket hole, a dowel, or the 5/8" screws of a bracket, and no screw on the list is
      // short enough for it: those are choices no one would make, so only the brads are checked there
      if(Math.min(j.a.t,j.b.t)<.5&&type!=='nail')continue;
      checkJointFasteners(j,type,'by hand',wrong);
    }
  }
  // framing by hand: two plates face to face take 3" nails that would just come through, so they are slanted;
  // a plate on a floor deck gets its long screws where the joist under the deck is, and says so when there is none
  load(JSON.stringify(blank()),true);
  const framing=addParts([mk('Top plate','2x4',[48,1.5,3.5],[0,0,0]),mk('Cap plate','2x4',[48,1.5,3.5],[0,1.5,0]),
    mk('Floor joist','2x6',[1.5,5.5,40],[100,0,0]),mk('Floor deck','ply34',[48,.75,40],[90,5.5,0]),
    mk('Bottom plate','2x4',[3.5,1.5,40],[100,6.25,0]),mk('Bottom plate','2x4',[3.5,1.5,40],[125,6.25,0])]).map(byId);
  const jointOf=(first,second)=>jointBetween(first,second);
  const plates=fastenerLayout(jointOf(framing[0],framing[1]),'frame');
  if(!plates.length||!plates.every(f=>f.kind==='nail'&&f.lean>0&&f.through===framing[1]))wrong('by hand: 3" nails through one 2x4 into another are not drawn slanted, down through the upper one');
  const onJoist=fastenerLayout(jointOf(framing[3],framing[4]),'frame');
  if(!onJoist.length||!onJoist.every(f=>f.kind==='screw'&&f.also[0]===framing[2]&&!fastenerProblem(f)))wrong('by hand: the screws of a plate on a floor deck do not land in the joist under the deck');
  const noJoist=fastenerLayout(jointOf(framing[3],framing[5]),'frame');
  if(!noJoist.length||!noJoist.every(f=>!f.also.length&&/no framing under/.test(f.tip)))wrong('by hand: a plate screw with no joist under the deck does not say so in its tip');
});
