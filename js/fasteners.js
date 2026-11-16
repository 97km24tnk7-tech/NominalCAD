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
     5. A pocket-hole screw leaves the hidden face at 15 degrees and comes out through the middle of the end of
        its piece: 1-1/4" screws for 3/4" stock, 2-1/2" screws for 1-1/2" stock.
     6. Dowels sit in the middle of the joint, half in each piece, with at least 1/4" of wood left behind the hole.
     7. A screw or brad with no face to go straight through is driven at an angle through the end of one piece
        (about 30 degrees), starting about an inch back from the joint, on alternating sides.
     8. An L-bracket goes in the inside corner, on the hidden side, with two screws into each piece.
     9. Framing nails (stud walls, floor frames, roofs) follow js/framing.js: straight through a plate into the
        end of a stud, through plywood into the framing behind it, at an angle through the side of a piece that
        stands on another (toenailed). A nail that would reach the far face is driven at a slant so that it
        does not. A wall plate on a floor deck gets long screws that land in the framing under the deck. */
'use strict';

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
  return designMiddle()[s]>=(b.lo[s]+b.hi[s])/2?1:-1;
}

/* ---------- the makers: one per kind of fastener ---------- */

/* Screws and brads driven straight through the face of one piece into the other (rules 1 to 4). */
function drivenStraight(j,shape,n,kind,len,label){
  const side=thruPart(j),through=j[side],into=shape.other(through);
  const depthThrough=shape.depthOf(through),depthInto=shape.depthOf(into);
  const way=shape.signInto(into),dir=alongAxis(shape.k,way);
  // A piece so thick that the screw would bite less than 1/2" into the next one gets a deep hole (counterbore),
  // deep enough for 3/4" of bite, leaving at least 1/2" of wood under the head.
  let sunk=0;
  const reach=len-depthThrough;
  if(reach<Math.min(.5,depthInto-.125))sunk=Math.max(0,Math.min(depthThrough-.5,Math.min(.75,depthInto-.125)-reach));
  const start=shape.plane-way*(depthThrough-sunk);
  return spreadAlong(n,shape.long,FASTEN.endMin).map((along,i)=>({
    kind,pos:shape.point(along,acrossAt(i,n,shape.wide),start),dir,len,...FASTENER_SIZE[kind],through,into,label,sunk,
    tip:`${label}. Goes through ${through.name} into ${into.name}.`+(sunk?' Its head sits in a deep hole so it can reach.':'')+(kind==='brad'?' The glue does the holding.':''),
  }));
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
function pocketPiece(j){
  const side=thruPart(j);
  if(side)return side==='a'?j.b:j.a;
  return j.fa==='end'?j.a:j.fb==='end'?j.b:(j.a.t<=j.b.t?j.a:j.b);
}
/* Pocket-hole screws (rule 5). */
function pocketScrews(j,shape,n,len,label){
  const through=pocketPiece(j),into=shape.other(through);
  const way=shape.signInto(into),box=plainBox(through);
  // the hole is drilled into a wide face of the piece: across its thickness when that runs along the joint face
  const s=through.ax[2]!==shape.k?through.ax[2]:shape.W,t=[0,1,2].find(i=>i!==shape.k&&i!==s);
  const rangeT=t===shape.L?shape.rangeL:shape.rangeW;
  const rangeS=s===shape.L?shape.rangeL:shape.rangeW;
  const angle=FASTEN.pocketDegrees*Math.PI/180;
  const bite=Math.min(len*.55,(shape.depthOf(into)-.125)/Math.cos(angle)); // how much of the screw ends up in the second piece
  // Where the screw crosses the joint: the middle of the thickness. When the two pieces only meet over part of
  // that thickness (an upright that stands half on the edge of a shelf deck), the middle of the part where they
  // do meet, so that the point of the screw ends in the second piece and not beside it.
  const middle=(box.lo[s]+box.hi[s])/2,keepIn=Math.min((rangeS[1]-rangeS[0])/2,bite*Math.sin(angle)+.05);
  const crossS=Math.max(rangeS[0]+keepIn,Math.min(rangeS[1]-keepIn,middle));
  // the hole opens on the hidden side, unless the head of the screw would then sit outside the wood
  const headOff=(len-bite)*Math.sin(angle);
  let hidden=hiddenSide(through,s);
  const toFace=side=>side>0?box.hi[s]-crossS:crossS-box.lo[s];
  if(toFace(hidden)<headOff&&toFace(-hidden)>toFace(hidden))hidden=-hidden;
  const face=hidden>0?box.hi[s]:box.lo[s];
  const dir=[0,0,0];
  dir[shape.k]=way*Math.cos(angle);
  dir[s]=-hidden*Math.sin(angle);
  const mouthBack=Math.min(toFace(hidden)/Math.sin(angle),(shape.depthOf(through)-.1)/Math.cos(angle)); // from the joint back to where the hole opens
  const out=alongAxis(s,hidden);
  return spreadAlong(n,rangeT[1]-rangeT[0],FASTEN.endMin).map(along=>{
    const cross=[0,0,0];
    cross[shape.k]=shape.plane;
    cross[s]=crossS;
    cross[t]=rangeT[0]+along;
    return{kind:'pocket',pos:pointPlus(cross,dir,-(len-bite)),dir,len,...FASTENER_SIZE.pocket,through,into,label,
      pocket:{mouth:pointPlus(cross,dir,-mouthBack),out,dia:.375},
      tip:`${label}. Goes from a pocket hole in ${through.name} into ${into.name}. The holes are on the hidden side.`};
  });
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
      for(const side of[-1,1]){
        const edge=side>0?range[1]:range[0];
        if(Math.abs((side>0?mine.hi[s]:mine.lo[s])-edge)>.02)continue;      // this piece does not end here
        const beyond=side>0?theirs.hi[s]-edge:edge-theirs.lo[s];              // how far the other runs on
        const corner=beyond>=.75,flush=Math.abs(beyond)<.02;
        if(!corner&&!flush)continue;
        const score=(corner?8:0)+(s===shape.W?4:0)+(hiddenSide(piece,s)===side?0:2); // an inside corner first, across the narrow way, on the hidden side
        if(!best||score>best.score)best={score,piece,other,s,side,edge,flat:!corner,room:corner?Math.min(F.bracketLeg,beyond):F.bracketLeg};
      }
    }
  }
  if(!best)best={piece:j.a,other:j.b,s:shape.W,side:1,edge:shape.rangeW[1],flat:true,room:F.bracketLeg};
  const{piece,other,s,side,edge,flat}=best,k=shape.k,t=[0,1,2].find(i=>i!==k&&i!==s);
  const rangeT=t===shape.L?shape.rangeL:shape.rangeW;
  const up=shape.signInto(piece);                                  // along k, from the joint into "piece"
  const legOnPiece=Math.min(F.bracketLeg,shape.depthOf(piece)),legOnOther=flat?Math.min(F.bracketLeg,shape.depthOf(other)):best.room;
  const screwAt=[.3,.75];                                          // along a leg, as a share of its length
  return spreadAlong(n,rangeT[1]-rangeT[0],1).map(along=>{
    const at=(depth,across)=>{const p=[0,0,0];p[k]=shape.plane+depth;p[s]=edge+across;p[t]=rangeT[0]+along;return p;};
    const box=(c,sk,ss)=>{const sz=[0,0,0];sz[k]=sk;sz[s]=ss;sz[t]=F.bracketWide;return{c,s:sz};};
    const screw=(pos,dir)=>({pos,dir,len:F.bracketScrew,dia:FASTENER_SIZE.screw.dia,head:.3});
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
      tip:`${label} with 4 short screws. Holds ${piece.name} to ${other.name}`+(flat?', flat across the seam.':' in the inside corner.')};
  });
}

/* ---------- the layout of one joint ---------- */
function fastenerLayout(j,type){
  // A joint inside a turned set is laid out with the set standing square, as it stood before it was turned
  // (squaredUp, js/neighbors.js). Its fasteners are in the frame of the set and say so (f.frame): whoever draws
  // them in the world takes them there with fastenerInWorld.
  if(j.frame&&!squaredNow)return squaredUp(()=>fastenerLayout(j,type));
  const spec=jSpec(j,type),n=spec.n;
  if(!n||!spec.hw.length)return[];
  const shape=jointShape(j),sizes=sizesInLabel(spec.hw[0][0]),label=oneOf(spec.hw[0][0]);
  let list=[];
  if(type==='screw'||type==='nail'){
    const kind=type==='nail'?'brad':'screw',len=sizes[sizes.length-1]||1.25;
    list=thruPart(j)?drivenStraight(j,shape,n,kind,len,label):drivenAtAnAngle(j,shape,n,kind,len,label);
  }
  else if(type==='pocket')list=pocketScrews(j,shape,n,sizes[0]||1.25,label);
  else if(type==='dowel')list=dowelPegs(j,shape,n,sizes[0]||.375,sizes[1]||1.5,label);
  else if(type==='bracket')list=cornerBrackets(j,shape,n,label);
  else if(spec.drive)list=framingLayout(j,shape,spec);   // 'frame' and 'toenail': js/framing.js says how they are driven
  for(const f of list){
    f.type=type;
    if(j.frame)f.frame=j.frame;
  }
  return list;
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
const CARRY_FIELDS=['k','plane','da','db','fa','fb'];
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
  if(sameJointAsBefore(old,j,link.type)){
    list=old.list;
    if(j.frame)for(const f of list)f.frame=j.frame;   // the same set, as it was found this time
  }
  else{
    list=fastenerLayout(j,link.type);
    if(list.loose)layoutCarry.delete(link.key);
    else layoutCarry.set(link.key,{type:link.type,a:j.a,b:j.b,nameA:j.a.name,nameB:j.b.name,thickA:j.a.t,thickB:j.b.t,
      ru0:j.ru[0],ru1:j.ru[1],rv0:j.rv[0],rv1:j.rv[1],k:j.k,plane:j.plane,da:j.da,db:j.db,fa:j.fa,fb:j.fb,frame:j.frame?j.frame.id:'',list});
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

   Brads and framing nails are left alone (a thin nail turns aside), and so are slanted screws and the long
   screws of a wall plate, which have their own reasons for where they are. A design with more than
   SETTLE_MAX fastened joints is not looked at: its screws stay where the rules of thumb put them. */
const SETTLE_MAX=6000;
const SETTLE_STEPS=[.375,.5,.25,.625,.75];   // how far a joint's screws are moved, tried in this order (inches)
const SETTLE_KEEP={apart:.75,edge:.375,end:.5}; // what a move must leave: between two screws, to the edge and to the end of the joint
const settledMemo=new WeakMap();   // graph -> Map link -> layout (only the joints that were moved)
function settledLayouts(){
  const graph=connGraph();
  let moved=settledMemo.get(graph);
  if(moved)return moved;
  moved=new Map();
  settledMemo.set(graph,moved);   // before anything is laid out, so that nothing below comes back here
  const links=graph.links.filter(link=>link.joint&&link.fastened&&(link.type==='screw'||link.type==='pocket'));
  if(!links.length||links.length>SETTLE_MAX)return moved;
  const rank=link=>{
    const list=layoutAsLaidOut(link),f=list[0];
    if(!f)return 9;
    const intoFace=f.into===link.joint.a?link.joint.fa:link.joint.fb;
    const group=f.kind==='pocket'?0:M[f.through.mat].kind==='sheet'?3:intoFace==='end'?1:2;
    return group*3+[1,2,0][link.joint.k];
  };
  const ranked=links.map(link=>({link,rank:rank(link)})).sort((a,b)=>a.rank-b.rank||(a.link.key<b.link.key?-1:1));
  // the screws that are settled so far, in a grid of 4" cells, each frame of a turned set by itself
  const cells=new Map();
  const cellsOf=f=>{
    const end=pointPlus(f.pos,f.dir,f.len),keys=[],frame=f.frame?f.frame.id:'';
    // (a little wider than the screw, so that two screws on either side of the edge of a cell still find each other)
    const lo=f.pos.map((v,k)=>Math.floor((Math.min(v,end[k])-.3)/4)),hi=f.pos.map((v,k)=>Math.floor((Math.max(v,end[k])+.3)/4));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)keys.push(frame+'|'+x+'|'+y+'|'+z);
    return keys;
  };
  const meets=(f,own)=>{
    for(const key of cellsOf(f)){
      for(const other of cells.get(key)||[]){
        if(other.link===own)continue;
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
  for(const{link}of ranked){
    const list=layoutAsLaidOut(link);
    const free=list.length>0&&list.every(f=>(f.kind==='screw'||f.kind==='pocket')&&!f.toe&&!(f.also&&f.also.length));
    if(!free||!list.some(f=>meets(f,link))){settle(list,link);continue;}
    let best=null;
    for(const candidate of movedLayouts(link.joint,list)){
      if(!candidate.some(f=>meets(f,link))){best=candidate;break;}
    }
    // no move of the whole joint clears it: each screw that meets another gets out of its way by itself
    if(!best)best=nudgedLayout(link.joint,list,f=>meets(f,link));
    if(best)moved.set(link,best);
    settle(best||list,link);
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
/* The screws of two different joints that come nearer to each other than their own thickness plus a hair: one
   would hit the other when it is driven. Returns [{a, b, gap}] with the two fasteners. Screws and pocket-hole
   screws only: a brad or a nail turns aside, a screw does not. */
const SCREW_CLEARANCE=.04;
/* Would these two screws touch inside the wood? Their shanks are compared from 1/4" under the head on: two heads
   that sit back to back in two boards that touch (the posts of two racks standing side by side) are not in each
   other's way. */
const HEAD_DEPTH=.25;
function screwsMeet(a,b){
  const from=f=>pointPlus(f.pos,f.dir,Math.min(HEAD_DEPTH,f.len/2));
  return stretchGap(from(a),a.dir,a.len-Math.min(HEAD_DEPTH,a.len/2),from(b),b.dir,b.len-Math.min(HEAD_DEPTH,b.len/2))<(a.dia+b.dia)/2+SCREW_CLEARANCE;
}
function screwsThatMeet(){
  const screws=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link))if(f.kind==='screw'||f.kind==='pocket')screws.push({f,link});
  }
  // sorted along x, so that only neighbours are compared
  const reach=item=>{const end=pointPlus(item.f.pos,item.f.dir,item.f.len);return[Math.min(item.f.pos[0],end[0]),Math.max(item.f.pos[0],end[0])];};
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
    if(!link.joint||!link.fastened||link.type!=='screw')continue;
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
  storeNamedJoints(variant.preset,parts);
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
