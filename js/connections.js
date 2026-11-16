/* NominalCAD: connections that hold.

   Two pieces that are screwed, nailed, doweled, bracketed or glued together are FASTENED: moving or turning one
   takes the other along, and so on through everything they are fastened to. This file keeps the list of what is
   fastened to what (the connection graph), and answers "what moves with these pieces?".

   Where a connection comes from
     - findJoints() finds where square-set pieces touch; jType(joint) says how that joint is fastened: the
       person's choice in S.joints[key], or else the suggested fastener. Anything but 'none' is fastened.
     - findAngledTies() (js/neighbors.js) finds what a piece set at an angle touches. No fastener is worked out
       for those, but they hold too, unless S.joints[key] is 'none'.

   The graph is built once per change of the design (commit, open, paste, undo, redo) and kept. Nothing here
   searches for joints while the mouse moves.

   What the rest of the program calls
     connGraph()            {links, byKey, of, held, carries, rests}   the graph as of the last change
                              links   every contact: {key, a, b, type, fastened, joint}  (a and b are pieces; joint is
                                      the findJoints() entry, or null for an angled tie or for hardware; type is a
                                      JTYPES key, 'angled', or whatever a HOLD_SOURCES function gave)
                              byKey   Map key -> link
                              of      Map piece id -> the links of that piece (fastened or only touching)
                              held    Map piece id -> ids of the pieces fastened straight to it
                              carries Map piece id -> ids of the tanks, lights, mattresses and windows that sit on it
                              rests   [{prop, on, touching}]  what each of those sits on (findPropRests, js/neighbors.js)
     connectionsOf(id)      the links of one piece
     fastenedSet(ids)       Set of ids: those pieces, everything reachable from them through fastened links, and
                            the things that are not wood (a fish tank, a light) sitting on any of them. Those ride
                            along one way only: moving the stand moves the tank, moving the tank leaves the stand.
     movingIds()            fastenedSet of the selection (remembered until the selection or the design changes)
     movingParts()          the same as pieces, in the order of S.parts
     followerCount()        how many pieces come along with the selection without being selected
     fastenedGroups()       the design split into its fastened sets: an array of arrays of pieces (for build order)
     linkSaid(link)        a connection in plain words: "2 pocket-hole screws"
     fastenPair(pA, pB)     fasten two touching pieces (Connect uses it). Returns false when they do not touch.
     bornTogether(ids)      tell the graph that these new pieces arrived as one thing (a preset, a copy)
     HOLD_SOURCES           where hardware (a hinge, a drawer slide) says which pieces it holds together
     shiftPieces(parts, [dx, dy, dz])   move exactly these pieces, all by the same amount (no followers added)
     moveSetTo, dropSet, turnQuarter, connectAndFasten   what the Properties panel and Connect call
     autoFasten             the status bar switch: do new contacts fasten by themselves?

   THE RULE FOR NEW AND DELETED CONNECTIONS (settleConnections, run at every commit)
     1. A choice made by hand (a fastener, or "Not joined", which is what Unfasten stores) stays with its two
        pieces for as long as they touch. Nothing automatic ever changes it.
     2. When two pieces stop touching, a stored "Not joined" for them is forgotten: the deletion has done its
        job. Where the preset itself named the joint (S.named), its own word is in force again: "Not joined"
        for a countertop that only rests on the sides, so it is not screwed to them when it is set back. (Any other fastener chosen by hand is remembered, in case the two meet again.) So a connection the
        person deleted never comes back while the pieces stay where they are, and once they have been parted and
        touch again, rule 3 decides afresh.
     3. Two pieces that touch now and did not touch before the change, with no stored choice:
          Auto-fasten on   they get the suggested fastener (nothing is stored; the suggestion follows the style).
          Auto-fasten off  they only touch: "Not joined" is stored until the person connects them.
        Pieces that arrive together (a preset, the copies of one Duplicate) keep the connections they came with
        whichever way the switch is set.
     4. A copy that the program puts down (Duplicate, Copy in a row, a mirrored copy) keeps the connections
        among its own pieces and is free of everything else: where it lands touching its original, another copy
        or any other piece, "Not joined" is stored and the command says so. Otherwise a copied leg that happens
        to stand under the same top would be screwed to it at once, and moving the copy would move the original.
        Once the person moves the copy away and against something, rule 3 applies as for any piece. A copy that
        is dragged to its place (Shift+D) is placed by the person, so rule 3 applies to it straight away. */
'use strict';

/* ---------- the Auto-fasten switch (status bar), remembered in this browser ---------- */
const AUTO_FASTEN_KEY='woodshop.autofasten';
let autoFastenChoice=true;   // what the switch says; it is only shown in Expert
try{autoFastenChoice=localStorage.getItem(AUTO_FASTEN_KEY)!=='off';}catch(e){}
let autoFasten=autoFastenChoice;   // what is in force: always on in Beginner, where the switch is hidden
function setAutoFasten(on){
  autoFasten=autoFastenChoice=!!on;
  try{localStorage.setItem(AUTO_FASTEN_KEY,autoFasten?'on':'off');}catch(e){}
  $('#autoFasten').checked=autoFasten;
  toast(autoFasten?'Auto-fasten on: pieces that end up touching are fastened with the suggested fastener.'
    :'Auto-fasten off: pieces that end up touching only touch, until you connect them (C).');
}
$('#autoFasten').checked=autoFasten;
$('#autoFasten').onchange=e=>setAutoFasten(e.target.checked);
ON_LEVEL.push(level=>{
  autoFasten=level==='beginner'?true:autoFastenChoice;
  $('#autoFasten').checked=autoFasten;
});

/* ---------- other things that hold: hardware ----------
   A hinge or a drawer slide holds two pieces together without being a joint that findJoints() knows. The file
   that owns such hardware adds a function here; it returns its links for the design as it is now:

     HOLD_SOURCES.push(()=>[{key:'hinge:7', a:doorPiece, b:sidePiece, type:'hinge', words:'2 hinges', remove(){...}}]);

   key     unique, and never of the form "12-34" (that is a joint)
   words   how the link reads where connections are listed ("Door to Side: 2 hinges")
   remove  deletes the hardware; Unfasten calls it after the person agreed. commit() follows by itself.
   Every such link counts as fastened: the two pieces move and turn together. The functions run when the graph is
   built (once per change of the design), so keep them quick. */
const HOLD_SOURCES=[];

/* ---------- the graph ---------- */
let connCache=null;        // the graph as of the last change; null until it is first needed
let movingMemo=null;       // the last answer of movingIds(), with what it was worked out from
const bornBatch=new Map(); // piece id -> a number shared by the pieces that arrived together since the last commit
let nextBatch=1;

function buildConnGraph(joints,ties,rests){
  const graph={links:[],byKey:new Map(),of:new Map(),held:new Map(),carries:new Map(),rests};
  const listOf=(map,id)=>{
    let list=map.get(id);
    if(!list)map.set(id,list=[]);
    return list;
  };
  const add=link=>{
    graph.links.push(link);
    graph.byKey.set(link.key,link);
    listOf(graph.of,link.a.id).push(link);
    listOf(graph.of,link.b.id).push(link);
    if(link.fastened){
      listOf(graph.held,link.a.id).push(link.b.id);
      listOf(graph.held,link.b.id).push(link.a.id);
    }
  };
  for(const joint of joints){
    const type=jType(joint);
    add({key:joint.key,a:joint.a,b:joint.b,type,fastened:type!=='none',joint});
  }
  for(const tie of ties){
    const loose=S.joints[tie.key]==='none';
    add({key:tie.key,a:tie.a,b:tie.b,type:loose?'none':'angled',fastened:!loose,joint:null});
  }
  for(const source of HOLD_SOURCES){
    for(const hold of source()){
      add({key:hold.key,a:hold.a,b:hold.b,type:hold.type,fastened:true,joint:null,hold:true,words:hold.words,remove:hold.remove});
    }
  }
  for(const rest of rests)listOf(graph.carries,rest.on.id).push(rest.prop.id);
  return graph;
}
function connGraph(){
  if(!connCache)connCache=buildConnGraph(findJoints(),findAngledTies(S.parts),findPropRests(S.parts));
  return connCache;
}
function connectionsOf(id){
  return connGraph().of.get(id)||[];
}
function fastenedSet(ids){
  const graph=connGraph(),out=new Set(ids),todo=[...out];
  const take=list=>{
    if(!list)return;
    for(const id of list){
      if(!out.has(id)){out.add(id);todo.push(id);}
    }
  };
  while(todo.length){
    const id=todo.pop();
    take(graph.held.get(id));    // what it is fastened to
    take(graph.carries.get(id)); // the tank, light, mattress or window that sits on it
  }
  return out;
}
/* The selection and everything fastened to it. Worked out once and remembered: the 3D view, the status bar, the
   menus and the Properties panel all ask after every change. */
function movingIds(){
  const graph=connGraph();
  let sum=0;
  for(const id of sel)sum+=id;
  const m=movingMemo;
  if(m&&m.graph===graph&&m.sel===sel&&m.size===sel.size&&m.sum===sum)return m.ids;
  movingMemo={graph,sel,size:sel.size,sum,ids:fastenedSet(sel)};
  return movingMemo.ids;
}
function movingParts(){
  const ids=movingIds();
  return ids.size===sel.size?selParts():S.parts.filter(p=>ids.has(p.id));
}
function followerCount(){
  return sel.size?movingIds().size-sel.size:0;
}
function fastenedGroups(){
  const seen=new Set(),groups=[],byPiece=new Map(S.parts.map(p=>[p.id,p]));
  for(const p of S.parts){
    if(seen.has(p.id))continue;
    const ids=fastenedSet([p.id]);
    ids.forEach(id=>seen.add(id));
    groups.push([...ids].map(id=>byPiece.get(id)).filter(Boolean));
  }
  return groups;
}

/* ---------- plain words ---------- */
const FASTENER_WORDS={ // one, several
  screw:['wood screw','wood screws'],
  plug:['wood screw with a plugged head','wood screws with plugged heads'],
  pocket:['pocket-hole screw','pocket-hole screws'],
  dowel:['dowel and glue','dowels and glue'],
  nail:['brad nail and glue','brad nails and glue'],
  bracket:['L-bracket','L-brackets'],
};
function linkSaid(link){
  if(link.type==='none')return'not joined';
  if(link.words)return link.words; // hardware says for itself what it is
  if(!link.joint)return'an angled joint, fastened by hand';
  if(link.type==='glue')return'glue';
  const spec=jSpec(link.joint,link.type),count=spec.n,words=FASTENER_WORDS[link.type];
  if(words)return`${count} ${words[count===1?0:1]}`;
  // framing (js/framing.js): the item itself says best what it is, nails or the long screws of a wall plate
  if(spec.drive&&spec.hw.length)return`${count} × ${spec.hw[0][0]}`+(spec.drive.how==='toe'?', driven at an angle':'');
  return JTYPES[link.type][0].toLowerCase();
}

/* ---------- keeping the stored choices right (see THE RULE at the top) ---------- */
function bornTogether(ids){
  const batch=nextBatch++;
  for(const id of ids)bornBatch.set(id,batch);
}
/* Copies that the program put down by itself (Duplicate, Copy in a row, a mirrored copy): see rule 4 at the top.
   Call it before commit(). copiesLeftLoose() then says, once, how many contacts were left as "only touching",
   so that the command can tell the person. */
const looseBorn=new Set();
let looseContacts=0;
function bornLoose(ids){
  for(const id of ids)looseBorn.add(id);
}
function copiesLeftLoose(){
  const count=looseContacts;
  looseContacts=0;
  return count;
}
const LOOSE_COPY_WORDS=' Where a copy touches another piece the two are not fastened: Connect (C) fastens them.';
function settleConnections(){
  const before=connCache; // the graph before this change
  const joints=findJoints(),ties=findAngledTies(S.parts);
  const touching=new Set();
  for(const contact of joints)touching.add(contact.key);
  for(const contact of ties)touching.add(contact.key);

  // rule 2, and choices that belong to pieces that are gone
  const alive=new Set(S.parts.map(p=>p.id)),named=S.named&&typeof S.named==='object'?S.named:null;
  for(const key of Object.keys(S.joints)){
    const dash=key.indexOf('-'),idA=+key.slice(0,dash),idB=+key.slice(dash+1);
    if(!alive.has(idA)||!alive.has(idB))delete S.joints[key];
    else if(S.joints[key]==='none'&&!touching.has(key)){
      // forgotten; where the preset itself named this joint (S.named, js/joints.js), its word is in force again
      if(named&&named[key])S.joints[key]=named[key];
      else delete S.joints[key];
    }
  }
  // the joints that follow the style (S.styled, js/joints.js) are forgotten with their pieces
  if(S.styled&&typeof S.styled==='object'){
    for(const key of Object.keys(S.styled)){
      const dash=key.indexOf('-');
      if(!alive.has(+key.slice(0,dash))||!alive.has(+key.slice(dash+1)))delete S.styled[key];
    }
  }
  if(named){
    for(const key of Object.keys(named)){
      const dash=key.indexOf('-');
      if(!alive.has(+key.slice(0,dash))||!alive.has(+key.slice(dash+1)))delete named[key];
    }
  }

  // rule 4: a fresh copy is not fastened to what it lands against
  let left=0;
  if(looseBorn.size&&before){
    const landed=contact=>{
      if(before.byKey.has(contact.key)||contact.key in S.joints)return false;
      if(!looseBorn.has(contact.a.id)&&!looseBorn.has(contact.b.id))return false;
      const batch=bornBatch.get(contact.a.id);
      return batch===undefined||batch!==bornBatch.get(contact.b.id);   // two pieces of one copy keep what the originals had
    };
    for(const contact of joints){
      if(landed(contact)&&jType(contact)!=='none'){S.joints[contact.key]='none';left++;}
    }
    for(const contact of ties){
      if(landed(contact)){S.joints[contact.key]='none';left++;}
    }
  }
  looseBorn.clear();
  looseContacts=left;

  // rule 3 with the switch off: new contacts only touch
  if(!autoFasten&&before){
    const isNew=contact=>{
      if(before.byKey.has(contact.key)||contact.key in S.joints)return false;
      const batch=bornBatch.get(contact.a.id);
      return batch===undefined||batch!==bornBatch.get(contact.b.id);
    };
    for(const contact of joints)if(isNew(contact))S.joints[contact.key]='none';
    for(const contact of ties)if(isNew(contact))S.joints[contact.key]='none';
  }
  bornBatch.clear();
  connCache=buildConnGraph(joints,ties,findPropRests(S.parts));
}
ON_COMMIT.push(settleConnections);
/* A project that was just read: its graph is the starting point that later changes are compared with. */
ON_LOAD.push(()=>{
  bornBatch.clear();
  connCache=null;
  connGraph();
});

/* ---------- fastening two pieces by hand ---------- */
/* the fastener to use when the person asks for these two to be fastened: the suggestion, or, where the
   suggestion is "only touching" (a lid, a door, boards stacked on edge), the plainest fastener that works */
function fastenerFor(joint){
  const suggested=suggestedType(joint);
  if(suggested!=='none')return suggested;
  return thruPart(joint)?'screw':'pocket';
}
/* Fasten two pieces that touch. A fastener already chosen for them is kept. Call commit() afterwards. */
function fastenPair(pA,pB){
  if(!pA||!pB||pA===pB)return false;
  const joint=jointBetween(pA,pB);
  if(joint){
    const stored=S.joints[joint.key];
    if(stored&&stored!=='none')return true; // a fastener picked by hand stays
    // Where the suggestion is a real fastener and will apply by itself, nothing needs storing (and the joint keeps
    // following the style). Otherwise the fastener is stored: for a lid or a door, and for a contact that is new
    // while Auto-fasten is off.
    const suggested=suggestedType(joint);
    const appliesByItself=suggested!=='none'&&(autoFasten||connGraph().byKey.has(joint.key));
    if(appliesByItself)delete S.joints[joint.key];
    else S.joints[joint.key]=fastenerFor(joint);
    return true;
  }
  // an angled piece: it is tied to what it touches unless that tie was deleted
  const first=S.parts.indexOf(pA)<S.parts.indexOf(pB)?pA:pB,second=first===pA?pB:pA;
  const tie=findAngledTies([first,second])[0];
  if(!tie)return false;
  S.joints[tie.key]='screw'; // any choice but 'none' holds an angled joint; this one also says a person made it
  return true;
}

/* ---------- showing what comes along ----------
   The selected pieces have the strong outline and the blue faces (js/view3d.js). The pieces fastened to them,
   which will move with them, get a lighter outline and only a breath of blue on their own color. */
const FOLLOW_TINT=.3;  // how far the faces of a piece that comes along lean towards the selection blue (0 = not at all)
SCENE_EXTRAS.push(function outlineFollowers(){
  if(!sel.size)return;
  const moving=movingIds();
  if(moving.size===sel.size)return;
  const blue=new THREE.Color(VIEW_COL.selFill);
  for(const id of moving){
    if(sel.has(id))continue;
    const group=meshes.get(id);
    if(!group)continue; // hidden
    const faces=group.children[0].material,edges=group.children[1].material;
    if(edges.color.getHex()===VIEW_COL.clashEdge)continue; // an overlap stays red
    edges.color.setHex(VIEW_COL.follow);
    edges.transparent=true;
    edges.opacity=.95;
    faces.color.lerp(blue,FOLLOW_TINT);
  }
});

/* ---------- moving a fastened set as one ----------
   The mouse tools (js/tools.js, js/transform.js) move and turn movingParts(). These helpers do the same for the
   commands that are not dragged: the arrow keys, the Position boxes, Drop down, the quarter-turn buttons, Connect. */

/* Where a piece may stand: square pieces on a sixteenth of an inch, like everything else in the program. A piece
   set at an angle keeps a much finer position, because rounding each angled piece of a turned set to its own
   sixteenth would pull them apart by a hair and they would stop touching. */
const FINE_STEPS=4096; // per inch
function placeRound(p,value){
  return tilted(p)?Math.round(value*FINE_STEPS)/FINE_STEPS:r16(value);
}
/* move pieces by the same amount [dx, dy, dz] */
function shiftPieces(parts,delta){
  for(const p of parts){
    for(let k=0;k<3;k++){
      if(delta[k])p.pos[k]=placeRound(p,p.pos[k]+delta[k]);
    }
  }
}
/* raise pieces together until none is below the floor */
function liftToFloor(parts){
  if(!parts.length)return;
  const low=bbox(parts).lo[1];
  if(low<-1e-6)shiftPieces(parts,[0,Math.ceil((-low-1e-6)*16)/16,0]);
}
/* A Position box in Properties: put the piece at value along direction k (0 left-right, 1 up, 2 back-front). What is
   fastened to it goes along. */
function moveSetTo(p,k,value){
  const moving=movingParts(),delta=[0,0,0];
  delta[k]=value-p.pos[k];
  if(k===1)delta[1]=Math.max(delta[1],-bbox(moving).lo[1]); // never below the floor
  shiftPieces(moving,delta);
}
/* Drop down: lower the piece, with everything fastened to it, until one of them rests on the floor or on a piece
   below that is not part of the set. */
const DROP_CHECK_MAX=200; // a bigger set only looks for the floor: checking every piece against every other would take too long
function dropSet(p){
  const moving=movingParts(),ids=movingIds();
  if(moving.length<2){p.pos[1]=dropPart(p);return;}
  let down=-bbox(moving).lo[1]; // how far to the floor (zero or less)
  if(moving.length<=DROP_CHECK_MAX){
    for(const piece of moving)down=Math.max(down,dropPart(piece,ids)-piece.pos[1]);
  }
  shiftPieces(moving,[0,Math.min(0,down),0]);
}
/* The quarter-turn buttons in Properties: turn the piece about direction k through its own middle. What is
   fastened to it turns with it, about the same point. */
function turnQuarter(p,k){
  if(movingIds().size<2){rotatePart(p,k);return;}
  const s=size(p),middle=p.pos.map((v,i)=>v+s[i]/2),onFloor=stoodOnFloor();
  applyRot(snapshot(),k,Math.PI/2,middle);
  finishRot(onFloor);   // a set that stood on the floor rests on it again after the turn
}
/* Connect never screws shut what is meant to open. Returns the message to show when one of the two pieces is a
   door, a lid or part of a drawer and the other belongs to its frame, or '' when Connect may go ahead.
     - It hangs on hinges or runs on slides already: nothing is done, and the message says why.
     - A door or a lid without hinges (by its name: one that was unfastened, or one drawn by hand): it is hung, the
       way Hang this door or lid does it. When it cannot be hung the message says what is missing.
     - A drawer without slides: the message names the command that mounts it. */
function connectWhatOpens(A,B){
  for(const[piece,other]of[[A,B],[B,A]]){
    if(isProp(piece)||isProp(other))continue;
    const mover=moverOf(piece.id);            // js/motion.js
    if(mover&&!mover.riders.has(other.id)){
      const how=mover.kind==='swing'?'hangs on its hinges':'runs on its slides';
      return`${mover.name} ${how}, so it is not screwed to ${other.name} as well: it could not open any more. To fasten it for good, take the ${mover.kind==='swing'?'hinges':'slides'} off first (Unfasten, U).`;
    }
    const own=ownParts(piece);                // js/hanging.js: the pieces of the same door or drawer
    if(mover||own.has(other.id))continue;
    if(DOOR_NAMES.test(piece.name)){
      // screwed to something already: hanging it would take those screws out, and that needs the question
      if(frameLinks([...own]).length)return`${piece.name} is a door or a lid, so Connect does not screw it to ${other.name}. To put it on hinges, select it and choose Hang this door or lid (Add, Hardware).`;
      const hung=hangDoor(piece);
      return hung.ok?`${hung.message} Connect hangs a door or a lid on hinges: it is never screwed shut.`
        :`${piece.name} is a door or a lid, so Connect does not screw it to ${other.name}. ${hung.message}`;
    }
    if(own.size>1&&S.parts.some(p=>own.has(p.id)&&p.name==='Drawer side')){
      return`${piece.name} is part of a drawer, so Connect does not screw it to ${other.name}. Select the drawer and choose Mount this drawer on slides (Add, Hardware) to put it back on its slides.`;
    }
  }
  return'';
}
/* Connect: make A meet B (connectParts in js/tools.js lines A up and stretches, trims or slides it; B never moves),
   then fasten the two. When A has to slide, the pieces fastened to A slide with it. Returns the message to show. */
function connectAndFasten(A,B){
  if(!A||!B||A===B)return'';
  const opens=connectWhatOpens(A,B);
  if(opens)return opens;
  // two pieces that touch already: nothing to move, only to fasten
  const touching=jointBetween(A,B);
  if(touching){
    const loose=jType(touching)==='none';
    fastenPair(A,B);
    const how=jSpec(touching,S.joints[touching.key]||jType(touching)).text;
    return loose?`${A.name} and ${B.name} are fastened now: ${how}.`
      :`${A.name} and ${B.name} already touch and are fastened: ${how}.`;
  }
  const set=fastenedSet([A.id]),was={pos:A.pos.slice(),l:A.l};
  const message=connectParts(A,B);
  const slide=A.pos.map((v,k)=>v-was.pos[k]);
  if(A.l!==was.l)slide[A.ax[0]]=0; // a change of length moves one end of A, not the pieces fastened to it
  if(set.size>1&&slide.some(v=>Math.abs(v)>1e-6)){
    if(set.has(B.id)){
      // the two are already one fastened set: A cannot slide towards B without being torn off something
      A.pos=was.pos;A.l=was.l;
      return`${A.name} and ${B.name} are already fastened together through other pieces, so one cannot slide to the other. Unfasten one of them first (U).`;
    }
    shiftPieces(S.parts.filter(p=>p!==A&&set.has(p.id)),slide);
  }
  fastenPair(A,B);
  return message;
}

/* ---------- checks ---------- */
/* Beginner and Expert (js/level.js). In Beginner the two switches an experienced builder may want (Auto-fasten,
   Pick) are hidden and stand in their safe position, whatever they were left at; everything a beginner needs to
   see fasteners, change one, free a piece, hang a door and open it is still there. */
SELFTESTS.push(function fastenersInBeginner(problems){
  const wrong=text=>problems.push('beginner: '+text);
  const kept={level,auto:autoFastenChoice,pick:pickChoice,tab,stored:null};
  try{kept.stored=localStorage.getItem(LEVEL_KEY);}catch(e){}
  const shows=el=>!!el&&getComputedStyle(el.closest('.st')||el).display!=='none';
  try{
    setTab('design');
    autoFastenChoice=false;
    pickChoice='comp';
    setLevel('beginner');
    if(!autoFasten||pickLevel!=='piece')wrong('Auto-fasten must be on and a click must pick one piece, whatever the hidden switches were left at');
    if(shows($('#autoFasten'))||shows($('#pickSeg')))wrong('the Auto-fasten switch or the Pick switch shows');
    if(!shows($('#showFast')))wrong('the Fasteners switch of the status bar is hidden');
    for(const command of['woodSolid','woodThrough','woodFast','unfasten','openAll','check']){
      const controls=[...document.querySelectorAll(`[data-cmd="${command}"]`)];
      if(!controls.some(control=>!control.closest('[data-expert]')))wrong(`the command "${command}" is only offered in Expert`);
    }
    if(!$('#bHardware')||$('#bHardware').closest('[data-expert]'))wrong('the Hardware pulldown is only offered in Expert');
    for(const row of[...CTX_SEL,...CTX_NONE]){
      if(row&&/Joints tab|tab \d/i.test(row[1]))wrong('a row of the right-click menu sends a beginner to a tab: '+row[1]);
    }
    setLevel('expert');
    if(autoFasten||pickLevel!=='comp')wrong('back in Expert the two switches do not return to what they said');
    if(!shows($('#autoFasten'))||!shows($('#pickSeg')))wrong('the Auto-fasten switch or the Pick switch does not show in Expert');
  }finally{
    autoFastenChoice=kept.auto;
    pickChoice=kept.pick;
    setLevel(kept.level);
    try{
      if(kept.stored===null)localStorage.removeItem(LEVEL_KEY);
      else localStorage.setItem(LEVEL_KEY,kept.stored);
    }catch(e){}
    setTab(kept.tab);
  }
});
