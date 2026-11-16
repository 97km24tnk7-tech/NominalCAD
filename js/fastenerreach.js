/* NominalCAD: screws that can really be driven where they are drawn, and the check that none goes through.

   THE FAULT THIS FILE MENDS (the owner: "the screws are so long they go through"). Where two boards meet one
   upright from its two sides at the same height (the shelves of two bays at a bookshelf divider, a rail and the
   next rack's post on the two faces of a post), the rules of thumb in js/fasteners.js screw BOTH of them straight
   through the upright. Each screw then starts on the face that the other board covers: in the 3D view the screws
   run out of the end of one shelf, through the divider and into the next shelf, and no drill can reach the second
   set at all. The steps already said what a builder does instead ("screw through the divider into the first one
   ... the second gets two screws driven at an angle", secondSideOfUpright in js/builders-storage.js); the model
   did not.

   drivableLayout(link, list)   called once for every joint as it is laid out (layoutAsLaidOut in
                                js/fasteners.js). For screws and brads driven straight through a piece X it looks
                                for a "mutual" pair: a third piece C against the face the screws start on, itself
                                screwed straight through X from the face this joint's board covers. One of the two
                                joints must be made second. The second one is
                                  - moved along the joint to where nothing covers its heads, when there is room
                                    (the screws that tie two rack posts together move off the rail ends), or
                                  - when the whole face is covered (a shelf end against a divider), driven at an
                                    angle through the end of its board into X, from the board's hidden side (the
                                    underside of a shelf, the back of a toe kick), and clear of the first joint's
                                    screws inside X.
                                Which one is second: the one that can move; when neither can, the one whose angled
                                screws find a place clear of every screw around them; when that does not decide
                                it, the one whose board comes later in the design (the next bay).
                                It also moves the long screws down through a wall plate off the studs that stand on
                                the plate (plateScrewsClearOfTheWall).
   fastenerFault(f)             '' or what is wrong, in plain words. Everything fastenerProblem (js/fasteners.js)
                                asks, and also: the point leaves at least 1/8" of wood before any face of the piece
                                that receives it (closer, it dimples or splits that face: a woodworker calls it
                                "through"); no stretch of the body lies in open air (a gap, an opening, a rabbet)
                                or in a piece that is not one of its own; and the head is on a face a drill can
                                reach (not under a board that is in place before it is driven).
   Self-checks: fastenersStayInTheWood (every preset with each of its choices, in each of the three build styles)
   and bookshelfScrewsAtDividers (the Bookshelf at its corners: every number of bays, with and without a back,
   1 to the most shelves, openings set as low as allowed). */
'use strict';

const REACH={
  probe:.03,       // how far behind the head we look for wood that covers it (inches)
  cover:.125,      // wood wanted beyond the point of a screw or a brad, to every face of its piece
  stretch:1/16,    // a piece of the body this long outside its own wood is a fault
  samples:24,      // points looked at along each fastener
  room:.3,         // half the room a head needs on the face when it is moved (rule 10 of js/fasteners.js uses the same)
  shifts:[.5,.75,1,1.25,1.5,2]   // how far angled screws are moved along the end to pass the screws already in X
};

/* ---------- small helpers ---------- */
const reachBoxHolds=(b,point,inset)=>[0,1,2].every(k=>point[k]>b.lo[k]+inset&&point[k]<b.hi[k]-inset);
/* just behind the head, outside the wood it is driven into (past the deep hole of a sunk head) */
const headSpot=f=>pointPlus(f.pos,f.dir,-(REACH.probe+(f.sunk||0)));
/* screws and brads driven straight in, the kind this file can move or turn */
const drivenStraightIn=list=>list.length>0&&list.every(f=>(f.kind==='screw'||f.kind==='brad')&&!f.toe&&!f.lean&&!(f.also&&f.also.length));
/* Is the joint of this link screwed or nailed straight through this piece? */
function screwedThrough(link,piece){
  if(!link.joint||!link.fastened||(link.type!=='screw'&&link.type!=='nail'))return false;
  const side=thruPart(link.joint);
  return!!side&&link.joint[side]===piece;
}
/* The pieces beside X whose joint with X is screwed straight through X and which lie over a head of the list
   (a thin back panel is nailed on afterwards and never counts). Returns [{piece, link}]. */
function coversOfHeads(list,X,skip){
  const found=new Map();
  for(const link of connectionsOf(X.id)){
    const other=link.a===X?link.b:link.a;
    if(other===skip||found.has(other)||isProp(other)||tilted(other))continue;
    if(M[other.mat].kind==='sheet'&&other.t<=THIN_COVER)continue;
    if(!screwedThrough(link,X))continue;
    const b=plainBox(other);
    if(list.some(f=>reachBoxHolds(b,headSpot(f),.01)))found.set(other,link);
  }
  return[...found].map(([piece,link])=>({piece,link}));
}
/* Every piece against the face of X that these screws start on which is itself screwed straight through X: none
   of their heads may be moved under one of them. */
function blockersOnStartFace(list,X,skip){
  const f0=list[0],k=[0,1,2].reduce((best,axis)=>Math.abs(f0.dir[axis])>Math.abs(f0.dir[best])?axis:best,0);
  const out=[];
  for(const link of connectionsOf(X.id)){
    const other=link.a===X?link.b:link.a;
    if(other===skip||out.includes(other)||isProp(other)||tilted(other))continue;
    if(M[other.mat].kind==='sheet'&&other.t<=THIN_COVER)continue;
    if(!screwedThrough(link,X))continue;
    const b=plainBox(other),face=f0.pos[k],outward=-Math.sign(f0.dir[k]);
    if(Math.abs((outward>0?b.lo[k]:b.hi[k])-face)<.03)out.push(other);
  }
  return out;
}
/* The same screws moved along their joint so that no head is under one of these pieces, or null when there is
   no such place for every one of them (rule 1: 3/4" from the ends of the joint; about 1" apart). */
function headsMovedClear(joint,list,pieces){
  const shape=jointShape(joint),L=shape.L;
  const spans=pieces.map(piece=>{const b=plainBox(piece);return[b.lo[L],b.hi[L]];});
  const places=clearOf(list.map(f=>f.pos[L]),spans,shape.rangeL,FASTEN.endMin,REACH.room);
  const moved=list.map((f,i)=>{
    const pos=f.pos.slice();
    pos[L]=places[i].at;
    return places[i].moved?{...f,pos,clearHead:pieces.map(piece=>piece.name)}:f;
  });
  const covered=moved.some(f=>pieces.some(piece=>reachBoxHolds(plainBox(piece),headSpot(f),.01)));
  return covered?null:moved;
}
/* Is the point inside this piece, more than inset from its faces? A piece set at an angle (the diagonal back
   brace of a fish rack, screwed across the backs of the posts) is measured in its own turned frame. */
function pieceHoldsPoint(piece,point,inset){
  const q=quatOf(piece);
  if(!q)return reachBoxHolds(plainBox(piece),point,inset);
  const s=size(piece),center=piece.pos.map((v,k)=>v+s[k]/2);
  const local=new THREE.Vector3(point[0]-center[0],point[1]-center[1],point[2]-center[2]).applyQuaternion(q.clone().invert());
  return[local.x,local.y,local.z].every((v,k)=>Math.abs(v)<s[k]/2-inset);
}
/* Where the head of a fastener needs room: the spot just behind it, and the edge of the head on each side of it
   along the face it starts on (a head that starts right at the edge of a brace is half under it). */
function headSpots(f){
  const spot=headSpot(f),b=plainBox(f.through),r=(f.head||FASTENER_SIZE.screw.head)/2;
  const out=[0,1,2].find(k=>spot[k]<b.lo[k]||spot[k]>b.hi[k]);   // the face it starts on is across this axis
  const spots=[spot];
  for(const k of[0,1,2]){
    if(k===out)continue;
    for(const way of[-1,1]){const point=spot.slice();point[k]+=way*r;spots.push(point);}
  }
  return spots;
}
/* The pieces (other than the fastener's own) that lie over where a fastener starts: wood against that face. A
   piece set at an angle counts too: a back brace is screwed on before the sections of a rack are joined. */
function piecesOverStart(f){
  const spots=headSpots(f),over=[];
  for(const link of connectionsOf(f.through.id)){
    const other=link.a===f.through?link.b:link.a;
    if(other===f.into||isProp(other))continue;
    if(M[other.mat].kind==='sheet'&&other.t<=THIN_COVER)continue;   // a thin back is nailed on afterwards
    if(spots.some(spot=>pieceHoldsPoint(other,spot,.01)))over.push(other);
  }
  return over;
}
/* A screw driven at an angle starts on one of the two sides of its piece (rule 7 of js/fasteners.js alternates
   them). One that would start where another piece lies against that side is started on the other side instead,
   when that one is open. Returns the list, changed or not. */
function angledFromOpenSides(list,shape){
  let changed=false;
  const out=list.map(f=>{
    if(!f.toe||!piecesOverStart(f).length)return f;
    const s=[0,1,2].find(k=>k!==shape.k&&Math.abs(f.dir[k])>1e-6);
    if(s===undefined)return f;
    // mirrored across the joint: the same distance in from the other side of the contact
    const range=s===shape.L?shape.rangeL:shape.rangeW,pos=f.pos.slice(),dir=f.dir.slice();
    pos[s]=range[0]+range[1]-pos[s];
    dir[s]=-dir[s];
    const flipped={...f,pos,dir};
    if(piecesOverStart(flipped).length||fastenerProblem(flipped))return f;
    changed=true;
    return flipped;
  });
  return changed?out:list;
}
/* The screws driven straight in (and pocket screws) of the other joints of these pieces, near the box given, as
   the rules of thumb lay them out (fastenerLayout, not layoutAsLaidOut: this is called while a layout is being
   made). The joint being laid out is left out. Returns {laid, mayMove}: the screws where they are laid out, and
   the same screws at each place they may still be moved to (see below).
   Such screws may still be moved afterwards, when the screws of all joints are looked at together
   (settledLayouts in js/fasteners.js moves a straight screw out of the way of another, but never a screw driven
   at an angle, so it never moves out of the way of these). So every place that move may give them counts as
   well (movedLayouts, js/fasteners.js): screws laid out at an angle clear of all of those are clear of the
   screws wherever they end up. (At the doubled posts of the fish rack the screws through a post into the end of
   its rail are moved 3/8" toward each other, onto the place the angled screws had first.) */
/* Toe screws of those joints are in `laid` too: they are never moved afterwards. */
function straightScrewsAround(joint,pieces,near){
  const seen=new Set(),laid=[],mayMove=[];
  const isNear=f=>[f.pos,pointPlus(f.pos,f.dir,f.len)].some(point=>reachBoxHolds(near,point,0));
  for(const piece of pieces){
    for(const link of connectionsOf(piece.id)){
      if(seen.has(link)||!link.joint||link.joint===joint||link.joint.key===joint.key||!link.fastened)continue;
      seen.add(link);
      if(link.type!=='screw'&&link.type!=='pocket')continue;
      const screws=fastenerLayout(link.joint,link.type).filter(f=>f.kind==='screw'||f.kind==='pocket');
      // Toe screws (driven at a slant through the side of a foot or an upright, js/fasteners.js) are never moved
      // by settledLayouts, only started on their open side (angledFromOpenSides, as drivableLayout does): the
      // angled screws must clear them where they end up. (In Rustic the toe screws through a foot or an upright
      // into a filler block of the fish rack end where the angled screws through that filler block into the
      // rail would run.)
      const toeScrews=screws.filter(f=>f.toe);
      if(toeScrews.length)laid.push(...angledFromOpenSides(toeScrews,jointShape(link.joint)).filter(isNear));
      const list=screws.filter(f=>!f.toe);
      if(!list.some(isNear))continue;
      laid.push(...list);
      const free=list.length>0&&list.every(f=>(f.kind==='screw'||f.kind==='pocket')&&!(f.also&&f.also.length));
      if(free&&typeof movedLayouts==='function')for(const moved of movedLayouts(link.joint,list))mayMove.push(...moved.filter(isNear));
    }
  }
  return{laid,mayMove};
}
/* The screws of the second board, driven at an angle into X instead of straight through X: through the end of a
   board that meets X with its end, all from the board's hidden side (the underside of a shelf, the back of a toe
   kick), or through the edges of a board that lies flat against X (a post against a post), from whichever edge is
   open. Then moved along until they pass the screws that are already in X (others). null when the board offers
   no end and no edge to drive through. */
function angledIntoUpright(joint,list,X,others){
  const board=joint.a===X?joint.b:joint.a,boardFace=joint.a===X?joint.fb:joint.fa;
  const shape=jointShape(joint),f0=list[0];
  const made=drivenAtAnAngle(joint,shape,list.length,f0.kind,f0.len,f0.label,boardFace==='end'?undefined:board);
  if(!made.length||made[0].through!==board)return null;
  // the side the screws start on: the one with a sideways part in their direction
  const s=[0,1,2].find(k=>k!==shape.k&&Math.abs(made[0].dir[k])>1e-6);
  const t=[0,1,2].find(k=>k!==shape.k&&k!==s);
  let hidden=hiddenSide(board,s);
  const box=plainBox(board);
  // A face that will be covered for good is better still, as for pocket holes (coveredForGood, js/fasteners.js):
  // a bookshelf's back rail is screwed to a divider from its back face, before the back panel is nailed over it,
  // not from its front face, which is seen when one looks into the bay.
  if(coveredForGood(board,s,-hidden)&&!coveredForGood(board,s,hidden))hidden=-hidden;
  const where=boardFace==='end'?`the end of ${board.name}`:`the edge of ${board.name}`;
  // all of them on the hidden side first: into the end of a board, and through its edge too (a toe kick 3 1/2"
  // tall meets a divider with what counts as its edge; started on both of its faces in turn, one head would be
  // on the front of the toe kick, where it shows)
  const allOnHidden=boardFace==='end'||boardFace==='edge'?made.map(f=>{
    const pos=f.pos.slice(),dir=f.dir.slice();
    pos[s]=hidden>0?box.hi[s]:box.lo[s];
    dir[s]=-hidden*Math.abs(dir[s]);
    return{...f,pos,dir};
  }):made;
  // A screw whose hidden side is covered by a third piece where it starts goes in from the other side
  // (angledFromOpenSides). That is decided again wherever the screws are moved to below: one that met the bottom
  // board near the top of a toe kick and was moved down clear of it starts on the hidden face again, not on the
  // front of the toe kick, where it would show.
  const startedFromOpenSides=layout=>angledFromOpenSides(layout,shape).map(f=>({...f,angledAt:X.name,
    tip:`${f.label}, driven at an angle. Goes through ${where} into ${X.name}${boardFace==='end'&&s===1?(Math.abs(f.pos[1]-box.lo[1])<.01?', from its underside':', from its top face'):''}: the other face of ${X.name} is covered by the piece on its other side.`}));
  const onHidden=startedFromOpenSides(allOnHidden);
  // moved along the end, toward its middle first, until none meets a screw already in X or in the board: the
  // first joint's screws (others), and the straight screws of every other joint of X and of the board (at the
  // doubled posts of the fish rack, the screws through a post into the ends of its rail and cross piece)
  const range=t===shape.L?shape.rangeL:shape.rangeW,middle=(range[0]+range[1])/2;
  const ends=onHidden.flatMap(f=>[f.pos,pointPlus(f.pos,f.dir,f.len)]);
  const reach=REACH.shifts[REACH.shifts.length-1]+1;      // as far as the angled screws may be moved, and a little more
  const nearBox={lo:[0,1,2].map(k=>Math.min(...ends.map(point=>point[k]))-reach),hi:[0,1,2].map(k=>Math.max(...ends.map(point=>point[k]))+reach)};
  const around=straightScrewsAround(joint,[X,board],nearBox);
  // the place nearest the rules of thumb that clears these screws, or null
  const clearOfAll=inTheWay=>{
    const meetsOthers=layout=>layout.some(f=>inTheWay.some(g=>screwsMeet(f,g)));
    if(!meetsOthers(onHidden))return onHidden;
    for(const step of REACH.shifts){
      for(const way of[1,-1]){
        const shifted=startedFromOpenSides(allOnHidden.map(f=>{
          const pos=f.pos.slice(),toward=f.pos[t]<middle?1:-1;
          pos[t]+=way*toward*step;
          return{...f,pos};
        }));
        const inside=shifted.every(f=>f.pos[t]>=range[0]+FASTEN.endMin-1e-6&&f.pos[t]<=range[1]-FASTEN.endMin+1e-6);
        const apart=shifted.every((f,i)=>shifted.every((g,n)=>n===i||Math.abs(f.pos[t]-g.pos[t])>=FASTEN.endMin));
        if(inside&&apart&&!meetsOthers(shifted)&&shifted.every(f=>!piecesOverStart(f).length))return shifted;
      }
    }
    return null;
  };
  // clear of everything, the places those screws may still be moved to included; else clear of where they are
  // laid out; else of the first joint's screws alone
  // laid out where they are, the second one clears every screw around; drivableLayout asks for clearsAll when
  // it decides which joint of a pair goes second
  const clearOfEverything=clearOfAll(others.concat(around.laid));
  const best=clearOfAll(others.concat(around.laid,around.mayMove))||clearOfEverything||clearOfAll(others)
    ||onHidden;   // nothing clears: left as it is, and fastenersStayInTheWood says so
  best.clearsAll=!!clearOfEverything;
  return best;
}
/* The long screws of a wall plate on a floor deck: straight down through the plate and the deck into the framing
   under it (f.also, js/framing.js). */
const throughTwoPieces=list=>list.length>0&&list.every(f=>f.kind==='screw'&&!f.toe&&!f.lean&&f.also&&f.also.length);
/* Those screws are driven after the wall is framed and stood up, so the studs already stand on the plate: a screw
   laid out under a stud (a Shed 48" deep had two) cannot be driven. Each such screw is moved along the plate to
   the nearest place clear of the studs, and only where it still goes into the framing under the deck (rule 1:
   3/4" from the ends). Left as it is when there is no such place; fastenerFault then says so. */
function plateScrewsClearOfTheWall(link,list){
  if(!list.some(f=>piecesOverStart(f).length))return list;
  // every piece that stands on the face the screws start on (studs, trimmer studs), not only the ones over them now
  const f0=list[0],plate=f0.through,k=[0,1,2].reduce((best,axis)=>Math.abs(f0.dir[axis])>Math.abs(f0.dir[best])?axis:best,0);
  const face=f0.pos[k],outward=-Math.sign(f0.dir[k]);
  const standing=connectionsOf(plate.id).map(other=>other.a===plate?other.b:other.a).filter(piece=>{
    if(piece===f0.into||isProp(piece)||tilted(piece)||(M[piece.mat].kind==='sheet'&&piece.t<=THIN_COVER))return false;
    const b=plainBox(piece);
    return Math.abs((outward>0?b.lo[k]:b.hi[k])-face)<.03;
  });
  // the usual move first (about an inch apart), else into the gaps between the studs
  const fine=layout=>!!layout&&!layout.some(f=>fastenerProblem(f)||piecesOverStart(f).length);
  const moved=headsMovedClear(link.joint,list,standing);
  const out=fine(moved)?moved:(()=>{const gaps=screwsIntoGaps(link.joint,list,standing);return fine(gaps)?gaps:null;})();
  if(!out)return list;
  out.loose=true;   // it depends on the pieces on the plate
  return out;
}
/* The same screws put into the gaps between those pieces when the usual way of moving them (about an inch apart)
   finds no room: on a short piece of plate beside a door, between a stud and the trimmer stud, two screws fit
   3/4" apart (rule 1) where they do not fit an inch apart. Each screw goes to the nearest free place, in order
   along the plate. null when they do not all fit. */
function screwsIntoGaps(joint,list,pieces){
  const shape=jointShape(joint),L=shape.L,room=REACH.room;
  const lo=shape.rangeL[0]+FASTEN.endMin,hi=shape.rangeL[1]-FASTEN.endMin;
  // the free stretches along the plate: [lo, hi] less every piece widened by the room a head needs
  const covered=pieces.map(piece=>{const b=plainBox(piece);return[b.lo[L]-room,b.hi[L]+room];}).sort((a,b)=>a[0]-b[0]);
  const free=[];
  let from=lo;
  for(const[a,b]of covered){
    if(a>from)free.push([from,Math.min(a,hi)]);
    from=Math.max(from,b);
  }
  if(from<hi)free.push([from,hi]);
  const stretches=free.filter(([a,b])=>b>=a);
  const order=list.map((f,i)=>i).sort((a,b)=>list[a].pos[L]-list[b].pos[L]);
  const placed=[];
  for(const index of order){
    const want=list[index].pos[L];
    let best=null;
    for(const[a,b]of stretches){
      // the nearest place in this stretch that keeps 3/4" from the screws placed so far (all lower down the plate)
      const after=placed.length?Math.max(a,placed[placed.length-1]+FASTEN.endMin):a;
      if(after>b+1e-6)continue;
      const at=Math.min(b,Math.max(after,want));
      if(best===null||Math.abs(at-want)<Math.abs(best-want))best=at;
    }
    if(best===null)return null;
    placed.push(r16(best));
  }
  const out=list.slice();
  order.forEach((index,i)=>{
    const f=list[index],pos=f.pos.slice();
    pos[L]=placed[i];
    if(Math.abs(pos[L]-f.pos[L])>1e-6)out[index]={...f,pos,clearHead:pieces.map(piece=>piece.name)};
  });
  return out;
}
/* Does a piece beside X (other than the board) lie over a head of the list, however that piece is fastened? (the
   same pieces coversOfHeads looks at, without asking whether they are screwed through X now) */
function headsUnderAnotherBoard(list,X,board){
  return connectionsOf(X.id).some(link=>{
    const other=link.a===X?link.b:link.a;
    if(other===board||isProp(other)||tilted(other))return false;
    if(M[other.mat].kind==='sheet'&&other.t<=THIN_COVER)return false;
    const b=plainBox(other);
    return list.some(f=>reachBoxHolds(b,headSpot(f),.01));
  });
}
/* Would this joint, made second, get angled screws clear of every screw around them? (angledIntoUpright) */
function angledClears(joint,list,X,others){
  const angled=angledIntoUpright(joint,list,X,others);
  return!!angled&&angled.clearsAll;
}
/* see the top of this file */
function drivableLayout(link,list){
  if(typeof connGraph!=='function'||!link.joint||!list.length||!S.parts.includes(list[0].through))return list;
  // screws already driven at an angle (rule 7): each starts on a side that is open
  if(list.some(f=>f.toe&&(f.kind==='screw'||f.kind==='brad'))){
    const open=angledFromOpenSides(list,jointShape(link.joint));
    if(open!==list){open.loose=true;return open;}
    return list;
  }
  if(throughTwoPieces(list))return plateScrewsClearOfTheWall(link,list);
  if(!drivenStraightIn(list))return list;
  const X=list[0].through,board=list[0].into;
  if(!S.parts.includes(X))return list;
  // worked out again when X gets more or fewer neighbours (layoutCarry in js/fasteners.js)
  if(!list.near)list.near={id:X.id,count:connectionsOf(X.id).length};
  const pairs=[];
  for(const{piece,link:other}of coversOfHeads(list,X,board)){
    const theirs=fastenerLayout(other.joint,other.type);
    // mutual: the screws of that joint start on the face this board covers
    if(!drivenStraightIn(theirs)||!theirs.some(f=>f.through===X&&reachBoxHolds(plainBox(board),headSpot(f),.01)))continue;
    pairs.push({piece,other,theirs});
  }
  if(!pairs.length){
    // No pair now. But when a board lies over these heads, whether it makes a pair depends on how that board is
    // fastened (a cross piece screwed in Everyday, pocket-screwed in Fine furniture, or changed by hand), which
    // layoutCarry does not look at: a layout carried over from Fine would stay straight beside a cross piece that
    // is now screwed through X too, and neither could be driven second. So such a layout is not carried over.
    if(!headsUnderAnotherBoard(list,X,board))return list;
    const alone=list.slice();
    alone.loose=true;
    alone.near=list.near;
    return alone;
  }
  // decided pair by pair, the same way from both joints of a pair, so that exactly one of them makes way
  // a joint "can move" when its heads find places clear of every piece on its face that is screwed through X
  const myBlockers=blockersOnStartFace(list,X,board);
  const moved=headsMovedClear(link.joint,list,myBlockers);
  const second=pairs.filter(pair=>{
    const theyMove=!!headsMovedClear(pair.other.joint,pair.theirs,blockersOnStartFace(pair.theirs,X,pair.piece));
    if(!!moved!==theyMove)return!!moved;         // the joint that can move goes second
    if(!moved){
      // neither can move, so the second one is driven at an angle: the one whose angled screws find a place
      // clear of every screw around them (a filler block of the fish rack, crowded by the toe screws from the
      // foot under it and the deck screws from above, leaves that to the long cross piece on the rail's other side)
      const mineClear=!!angledClears(link.joint,list,X,pair.theirs);
      const theirsClear=!!angledClears(pair.other.joint,pair.theirs,X,list);
      if(mineClear!==theirsClear)return mineClear;
    }
    return board.id>pair.piece.id;               // else the later board goes second
  });
  if(!second.length){
    // this one goes first: the other joint makes way. Which one goes first depends on the pieces around both
    // boards (whose angled screws find room), not only on X, so the layout is worked out afresh each time and
    // never carried over from an earlier state of the design (layoutCarry in js/fasteners.js); a carried "first"
    // beside a freshly decided "first" would leave both joints blocking each other.
    const first=list.slice();
    first.loose=true;
    first.near=list.near;
    return first;
  }
  let out=moved;
  if(!out)out=angledIntoUpright(link.joint,list,X,second.flatMap(pair=>pair.theirs));
  if(!out)return list;
  out.loose=true;   // it depends on the pieces beside the joint
  out.near=list.near;
  return out;
}

/* ---------- the check ---------- */
/* see the top of this file */
function fastenerFault(f){
  if(f.frame&&!squaredNow)return squaredUp(()=>fastenerFault(f));
  const basic=fastenerProblem(f);
  if(basic)return basic;
  if(f.kind==='dowel')return'';                       // a glued peg, half in each piece (rule 6)
  const runs=f.kind==='bracket'?f.screws.map(screw=>({...screw,kind:'bracket screw',through:f.through,into:f.into,also:[],bracket:true})):[f];
  for(const run of runs){
    const wrong=runFault(run);
    if(wrong)return wrong;
  }
  return'';
}
function runFault(f){
  const own=[f.through,f.into,...(f.also||[])];
  if(own.some(piece=>tilted(piece)))return'';         // a piece set at an angle has no square box to measure in
  const ownBoxes=own.map(plainBox);
  // the pieces beside it that it could run into
  const near=new Set();
  if(typeof connectionsOf==='function')for(const piece of own)for(const link of connectionsOf(piece.id))near.add(link.a===piece?link.b:link.a);
  const others=[...near].filter(piece=>!own.includes(piece)&&!isProp(piece)&&!tilted(piece)).map(piece=>({piece,b:plainBox(piece)}));
  // 1. the body, from just under the head to the point
  let air=0,foreign=0,foreignName='';
  const step=f.len/REACH.samples;
  for(let i=1;i<REACH.samples;i++){
    const point=pointPlus(f.pos,f.dir,i*step);
    if(!ownBoxes.some(b=>reachBoxHolds(b,point,-.003)))air+=step;
    const hit=others.find(other=>reachBoxHolds(other.b,point,.01));
    if(hit){foreign+=step;foreignName=hit.piece.name;}
  }
  const what=f.bracket?'a bracket screw':`the ${f.kind}`;
  if(air>REACH.stretch+1e-6)return`${what} crosses ${fmt(r16(air))} of open air between ${f.through.name} and ${f.into.name}`;
  if(foreign>REACH.stretch+1e-6)return`${what} runs ${fmt(r16(foreign))} into ${foreignName}, which is not one of its two pieces`;
  // 2. the point: wood left to every face of the piece it ends in
  const tip=pointPlus(f.pos,f.dir,f.len);
  const ends=f.bracket?own:(f.also&&f.also.length?f.also:[f.into]);
  const inPiece=ends.find(piece=>reachBoxHolds(plainBox(piece),tip,-.001));
  if(inPiece&&f.kind!=='nail'){                       // a framing nail is judged by js/framing.js (rule 9)
    const b=plainBox(inPiece),left=Math.min(...[0,1,2].flatMap(k=>[tip[k]-b.lo[k],b.hi[k]-tip[k]]));
    if(left<REACH.cover-.002)return`the point of ${what} stops ${fmt(r16(Math.max(0,left)))} from a face of ${inPiece.name}: closer than 1/8", it dimples or splits that face`;
  }
  // 3. the head, on a face a drill can reach
  if(f.kind==='screw'||f.kind==='brad'){
    const spot=headSpot(f);
    // (a thin back panel is nailed on after the screws are in: a head under it is reached first, as piecesOverStart says)
    const thinBack=piece=>M[piece.mat].kind==='sheet'&&piece.t<=THIN_COVER;
    const over=others.find(other=>!thinBack(other.piece)&&reachBoxHolds(other.b,spot,.01));
    // an angled screw needs room for its whole head, also clear of a piece set at an angle (a back brace), which is
    // measured in its own frame
    // a long screw down through a wall plate is driven with the wall already standing on the plate
    if(throughTwoPieces([f])){
      const stud=piecesOverStart(f)[0];
      if(stud)return`${what} down through ${f.through.name} starts under ${stud.name}, which stands on it before the screw is driven`;
    }
    if(f.toe){
      const spots=headSpots(f);
      const under=[...near].find(piece=>!own.includes(piece)&&!isProp(piece)&&!thinBack(piece)&&spots.some(point=>pieceHoldsPoint(piece,point,.01)));
      if(under)return`${what} is started where ${under.name} lies against ${f.through.name}`;
    }
    if(over&&!f.toe&&!f.lean){
      // a board on that face that is itself screwed through the same piece from the face this one covers: whichever
      // goes second cannot be driven
      const link=connectionsOf(f.through.id).find(candidate=>candidate.a===over.piece||candidate.b===over.piece);
      if(link&&screwedThrough(link,f.through)&&fastenersOfLink(link).some(g=>g.through===f.through&&!g.toe&&reachBoxHolds(plainBox(f.into),headSpot(g),.01)))
        return`${what} through ${f.through.name} into ${f.into.name} starts under ${over.piece.name}, whose own screws start under ${f.into.name}: one of the two cannot be driven`;
    }
  }
  return'';
}

/* ---------- self-checks ---------- */
/* the faults of the design as it is now: [{text, f}] (one per joint at most) */
function fastenerFaultsNow(){
  const out=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      const wrong=fastenerFault(f);
      if(wrong){out.push({text:`${f.through.name} into ${f.into.name} (${f.label}): ${wrong}`,f});break;}
    }
  }
  return out;
}
/* The screws this file drove at an angle (f.angledAt) that meet a screw of another joint inside the wood, as the
   design is now (after settledLayouts has moved what it moves): [text], one per joint at most. */
function angledScrewsThatMeet(){
  const out=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    const angled=fastenersOfLink(link).filter(f=>f.angledAt);
    if(!angled.length)continue;
    const met=[];
    for(const piece of[angled[0].through,angled[0].into]){
      for(const other of connectionsOf(piece.id)){
        if(other===link||!other.joint||!other.fastened)continue;
        for(const g of fastenersOfLink(other)){
          if((g.kind==='screw'||g.kind==='pocket')&&angled.some(f=>screwsMeet(f,g)))met.push(g);
        }
      }
    }
    if(met.length)out.push(`${angled[0].through.name} into ${angled[0].into.name}, driven at an angle, meets the ${met[0].kind} through ${met[0].through.name} into ${met[0].into.name}`);
  }
  return out;
}
/* Every preset with each of its choices (presetVariants, js/fasteners.js), placed the way Create places it, in
   each of the three build styles: no fastener runs out of its wood, crosses a gap, stops within 1/8" of a face,
   or starts where it cannot be driven, and no screw this file drove at an angle meets another screw. Then every
   preset with each number of its form at its smallest and at its largest (where its own check lets it be built),
   each in one style, taken in turn so that all three come up: the doubled posts of a long cabinet stand only
   appear at its largest width. */
SELFTESTS.push(function fastenersStayInTheWood(problems){
  const seen=new Set();
  const wrong=text=>{const kind=text.replace(/\d[\d\/ ]*"/g,'#');if(!seen.has(kind)&&seen.size<12){seen.add(kind);problems.push('fasteners in the wood: '+text);}};
  const styles=Object.keys(STYLES);
  const tryOne=(preset,vals,style,name)=>{
    if(preset.check&&preset.check(vals).some(found=>found.level==='stop'))return;
    if(!placeInStyle(preset,vals,style))return;
    for(const fault of fastenerFaultsNow())wrong(`${name} (${STYLES[style][0]}): ${fault.text}`);
    for(const text of angledScrewsThatMeet())wrong(`${name} (${STYLES[style][0]}): ${text}`);
  };
  withoutDrawing(()=>{
    for(const variant of presetVariants()){
      for(const style of styles)tryOne(variant.preset,{...presetDefaults(variant.preset),...variant.vals},style,variant.name);
    }
    let turn=0;
    for(const preset of PRESETS){
      const usual=presetDefaults(preset);
      for(const q of preset.params){
        if(!q.k||q.opts||q.check||q.min===undefined||q.max===undefined)continue;
        if(q.show&&!q.show(usual))continue;   // a row the form does not show with the usual choices
        for(const value of[q.min,q.max])tryOne(preset,{...usual,[q.k]:value},styles[turn++%styles.length],`${preset.name} at ${q.label} ${value}`);
      }
    }
  });
});
/* The Bookshelf at the corners of its form, every number of bays it can have, with and without a back, from one
   shelf to the most, the openings as low as they may be set, in each style: no fault, and at every divider the
   board of the next bay is screwed at an angle from its underside (or its back), never straight through the
   divider from the face the first board covers. */
SELFTESTS.push(function bookshelfScrewsAtDividers(problems){
  const preset=PRESETS.find(candidate=>candidate.name==='Bookshelf');
  if(!preset)return;
  const wrong=text=>{if(problems.length<80)problems.push('bookshelf screws: '+text);};
  const bays=new Set();
  let angled=0;
  withoutDrawing(()=>{
    for(const W of[BOOKSHELF_LIMITS.W[0],32,40,60,BOOKSHELF_LIMITS.W[1]])for(const H of BOOKSHELF_LIMITS.H)
    for(const n of[1,3,BOOKSHELF_LIMITS.n[1]])for(const back of[true,false])for(const style of Object.keys(STYLES)){
      const plan=bookshelfPlan({...presetDefaults(preset),W,H,n,back});
      if(plan.room/(n+1)<plan.least)continue;   // too many shelves for this height: refused by the form
      // the openings as low as the form lets them be set, the rest in the top one
      const low={spacing:'set',...Object.fromEntries(Array.from({length:n},(unused,i)=>['o'+(i+1),plan.least]))};
      for(const more of[{},low]){
        const vals={...presetDefaults(preset),W,H,n,back,...more};
        if(bookshelfCheck(vals).length)continue;
        if(!placeInStyle(preset,vals,style))continue;
        bays.add(plan.bays.length);
        const label=`${W}" wide, ${H}" tall, ${n} shelves${back?'':', no back'}${more.spacing?', lowest openings':''}, ${STYLES[style][0]}`;
        const faults=fastenerFaultsNow().map(fault=>fault.text).concat(angledScrewsThatMeet());
        if(faults.length){wrong(`${label}: ${faults[0]}`);continue;}
        for(const link of connGraph().links){
          const layout=link.joint&&link.fastened?fastenersOfLink(link):[];
          if(!layout.length||!layout.some(f=>f.through.name==='Divider'||f.into.name==='Divider'))continue;
          if(layout.some(f=>f.angledAt))angled++;
        }
      }
    }
  });
  if(bays.size<3)wrong(`only cases with ${[...bays].join(' and ')} bays were tried`);
  if(!angled)wrong('no board at a divider is screwed at an angle: the second bay is screwed straight through the divider again');
});
/* A design whose build style is changed (Everyday to Rustic to Fine furniture and back), the way a person does it
   in the Style & finish dialog: no fastener runs out of its wood or starts where it cannot be driven, and no screw
   driven at an angle meets another, in each style. The layouts of the style before are still in memory then
   (layoutCarry in js/fasteners.js), which a check that places each design afresh never sees. After the merge with
   the fish wall of main, the Fish tank wall with a row of 5.5 gallon tanks switched from Everyday to Rustic kept
   the cross piece's straight screws from Everyday and worked out the filler block's afresh, so both were screwed
   straight through the rail from the faces the other one covers, and neither could be driven second.
   Run over the fish racks and stands with every choice of their forms and the Bookshelf with dividers. */
SELFTESTS.push(function fastenersDrivableAfterAStyleChange(problems){
  const seen=new Set();
  const wrong=text=>{if(!seen.has(text)&&seen.size<8){seen.add(text);problems.push('fasteners after a style change: '+text);}};
  const cases=presetVariants()
    .filter(variant=>/^(Fish tank wall|Single aquarium stand|Cabinet stand)/.test(variant.name))
    .map(variant=>({preset:variant.preset,vals:{...presetDefaults(variant.preset),...variant.vals},name:variant.name}));
  const bookshelf=PRESETS.find(candidate=>candidate.name==='Bookshelf');
  if(bookshelf)for(const W of[40,72])cases.push({preset:bookshelf,vals:{...presetDefaults(bookshelf),W,H:48,n:3},name:`Bookshelf ${W}" wide`});
  const order=['std','rustic','fine','std'];
  withoutDrawing(()=>{
    for(const one of cases){
      if(one.preset.check&&one.preset.check(one.vals).some(found=>found.level==='stop'))continue;
      if(!placeInStyle(one.preset,one.vals,order[0]))continue;
      fastenerFaultsNow();                       // laid out in the first style, as the screen would have drawn it
      for(const style of order.slice(1)){
        look().style=style;
        commit();
        const faults=fastenerFaultsNow().map(fault=>fault.text).concat(angledScrewsThatMeet());
        if(faults.length)wrong(`${one.name}, changed to ${STYLES[style][0]}: ${faults[0]}`);
      }
    }
  });
});
