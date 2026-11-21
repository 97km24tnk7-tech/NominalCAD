/* NominalCAD: pocket holes that stay inside their piece (reference sheet 27, "Pocket-hole geometry").

   The owner, on the Dining chair's side seat rail drawing: "on the chair these pocket holes seem to close to the
   edge please verify this is correct". He was right: a 2x4 rail on edge, drilled at the 1 1/2" jig setting for the
   screws up into the seat, gets an oval from 2.07" to 3.52" below its top edge, and the rail is 3 1/2" tall: the bit
   breaks out of its bottom edge. Sheet 27 section 8: drill a rail ACROSS its height (a top, a seat or a deck on it)
   at the 3/4" setting; the ends of a rail (into a leg) keep the setting for their thickness. pocketJigFor
   (js/fasteners.js) does that; this file checks it on every preset.

     pocketHoleRoom(f, joint)    how much room one pocket hole has in its piece: the wood beyond the far end of its
                                 oval, its distance from the edges or ends of the piece across the oval, and its face
     pocketRoomFaults()          what is wrong with the pocket holes of the design as it is now: [{text, f}]
     POCKET_ROOM                 the distances, each with where it comes from

   Self-checks: pocketHolesStayInTheirPiece (every preset, every choice, every number at its smallest and largest,
   in all three styles) and pocketRoomCanFail (the rule fails on a rail drilled the old way). */
'use strict';
/* The distances a pocket hole keeps (inches). */
const POCKET_ROOM={
  // wood left beyond the far end of the oval, before the far edge of the piece: sheet 27, sections 3 and 7, a
  // builder's choice [judgment] so the bit neither breaks out nor leaves a feather of wood at the far end
  beyond:POCKET_BEYOND,   // (js/fasteners.js: styleType asks it too, pocketHasRoom)
  // the middle of the hole from an edge or an end of the piece, across the oval: sheet 27 section 5, "at least
  // 3/4"" from the edge of a board (one source; Kreg says about 1"), and 5/8" to 1 1/2" from the end of a joint:
  // the larger of the two lower bounds
  side:POCKET_SIDE,       // (js/fasteners.js: a hole moved to pass a screw keeps it, pocketKeepsToTheSide)
  // wood between the ovals of two holes on one face: rule 11's web (END_HOLE_WEB, js/fasteners.js), sheet 27
  // section 8 "clear of the end holes"
  web:END_HOLE_WEB,
};
/* The room of one pocket hole f (a fastener of kind 'pocket', from fastenersOfLink) of joint j.
   {beyond: wood past the far end of the oval along the joint's normal, side: the least distance from the middle of
    the hole to an edge or end of the piece across the oval, alongK: the axis the oval runs along, acrossT: the axis
    across it, face: the axis and sign of the face it opens on, half: half the oval's length} */
function pocketHoleRoom(f,j){
  const piece=f.through,b=plainBox(piece),k=j.k;
  // the piece lies on one side of the joint face: how far it reaches from there
  const lowSide=(b.lo[k]+b.hi[k])/2<j.plane;
  const reach=lowSide?j.plane-b.lo[k]:b.hi[k]-j.plane;
  const half=POCKET_OVAL*f.pocket.dia/.375;
  const farEnd=Math.abs(f.pocket.mouth[k]-j.plane)+half;
  const faceAxis=f.pocket.out.findIndex(v=>Math.abs(v)>.5);
  const acrossT=[0,1,2].find(axis=>axis!==k&&axis!==faceAxis);
  const side=Math.min(f.pocket.mouth[acrossT]-b.lo[acrossT],b.hi[acrossT]-f.pocket.mouth[acrossT]);
  return{beyond:reach-farEnd,side,alongK:k,acrossT,faceAxis,faceSign:Math.sign(f.pocket.out[faceAxis]),half,reach};
}
/* How far in from the face its hole is drilled in a pocket screw leaves its piece, where it crosses the joint */
function pocketExitDepth(f,j){
  const k=j.k,faceAxis=f.pocket.out.findIndex(v=>Math.abs(v)>.5),b=plainBox(f.through);
  const face=f.pocket.out[faceAxis]>0?b.hi[faceAxis]:b.lo[faceAxis];
  const along=(j.plane-f.pos[k])/f.dir[k];
  return Math.abs(face-(f.pos[faceAxis]+f.dir[faceAxis]*along));
}
/* The oval of a pocket hole on its face as a capsule (a line with round ends) in the room: it holds the true oval
   (a 3/8" bore cut at 15 degrees, half length POCKET_OVAL, half width 3/16"). {a, b: the two ends of its middle
   line, r: its half width} */
function pocketOvalCapsule(f,j){
  const r=f.pocket.dia/2,half=POCKET_OVAL*f.pocket.dia/.375,k=j.k;
  const a=f.pocket.mouth.slice(),b=f.pocket.mouth.slice();
  a[k]-=half-r;b[k]+=half-r;
  return{a,b,r};
}
/* the least distance between two line pieces in the room (both from p to q) */
function segmentGap(p1,q1,p2,q2){
  const d1=q1.map((v,k)=>v-p1[k]),d2=q2.map((v,k)=>v-p2[k]);
  const len1=Math.hypot(...d1)||1e-9,len2=Math.hypot(...d2)||1e-9;
  return stretchGap(p1,d1.map(v=>v/len1),len1,p2,d2.map(v=>v/len2),len2);
}
/* What is wrong with the pocket holes of the design as it is now: [{text, f}]. A hole is read to the nearest 1/16",
   as every size in the program is written (fmt), so a hole that leaves 0.48" beyond its oval leaves 1/2". */
function pocketRoomFaults(){
  const faults=[],byFace=new Map();
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened||link.type!=='pocket')continue;
    for(const f of fastenersOfLink(link)){
      if(f.kind!=='pocket'||!f.pocket)continue;
      const room=pocketHoleRoom(f,link.joint),what=`a pocket hole in the ${f.through.name} (into the ${f.into.name}, jig set for ${fmt(f.jig)} stock)`;
      if(r16(room.beyond)<POCKET_ROOM.beyond-1e-6)
        faults.push({f,text:`${what}: ${r16(room.beyond)<1/16?(r16(room.beyond)<=-1/16?'its oval runs '+fmt(r16(-room.beyond))+' past the far edge':'its oval runs out at the far edge'):'only '+fmt(r16(room.beyond))+' of wood beyond the far end of its oval'}, in a piece ${fmt(r16(room.reach))} across; ${fmt(POCKET_ROOM.beyond)} of wood is wanted`});
      if(r16(room.side)<POCKET_ROOM.side-1e-6)
        faults.push({f,text:`${what} is ${fmt(Math.max(0,r16(room.side)))} from an edge or end of the piece; ${fmt(POCKET_ROOM.side)} is wanted`});
      // a jig brings the screw out half its setting in from the face it is clamped to (the real-thing reviewer's
      // finding 3: 4x4 uprights whose screws left 2 3/8" in, a hole no jig can drill)
      const exit=pocketExitDepth(f,link.joint);
      if(Math.abs(exit-f.jig/2)>1/32)
        faults.push({f,text:`${what}: its screw leaves the piece ${fmt(r16(exit))} in from the face the hole is drilled in, where a jig set for ${fmt(f.jig)} brings it out ${fmt(f.jig/2)} in: no jig can drill it`});
      // gathered by piece and face for the holes that come too near each other on that face
      const key=f.through.id+'|'+room.faceAxis+'|'+room.faceSign;
      if(!byFace.has(key))byFace.set(key,[]);
      byFace.get(key).push({f,capsule:pocketOvalCapsule(f,link.joint),link});
    }
  }
  for(const holes of byFace.values()){
    if(holes.length>200)continue;   // (a long run of holes in one huge piece: the rows keep their own spacing)
    for(let i=0;i<holes.length;i++)for(let n=i+1;n<holes.length;n++){
      const x=holes[i].capsule,y=holes[n].capsule;
      const gap=segmentGap(x.a,x.b,y.a,y.b)-x.r-y.r;
      if(gap<POCKET_ROOM.web-1/32)
        faults.push({f:holes[i].f,text:`two pocket holes in the ${holes[i].f.through.name} open ${gap<0?'into each other':'with only '+fmt(r16(gap))+' of wood between them'} (into the ${holes[i].f.into.name} and into the ${holes[n].f.into.name}); ${fmt(POCKET_ROOM.web)} is wanted`});
    }
  }
  return faults;
}
/* What Check my design says of pocket holes in the design on screen that have no room (the code reader's finding 12:
   a hand-drawn design, or a preset changed by hand, could be given holes that run out of their piece and nothing
   told the person). One finding for each piece, at most POCKET_WARNINGS_MAX; a design of more than
   POCKET_WARNINGS_PIECES pieces is not looked at, for speed (the status bar re-checks after every change). */
const POCKET_WARNINGS_MAX=6,POCKET_WARNINGS_PIECES=1500;
function pocketRoomWarnings(){
  if(!S.parts.length||S.parts.length>POCKET_WARNINGS_PIECES||typeof connGraph!=='function')return[];
  const byPiece=new Map();
  for(const fault of pocketRoomFaults()){
    const id=fault.f.through.id;
    if(!byPiece.has(id))byPiece.set(id,fault);
  }
  return[...byPiece.values()].slice(0,POCKET_WARNINGS_MAX).map(fault=>({level:'warn',code:'pocket-room',ids:[fault.f.through.id],
    text:`${fault.text.charAt(0).toUpperCase()+fault.text.slice(1)}.`,
    fix:'Click the fastener in the 3D view and pick another kind in Properties (a screw or an L-bracket), or use a deeper board there.'}));
}
/* Self-check (the code reader's finding 12): a 1x3 apron drawn by hand on edge under a 3/4" plywood top is not
   suggested pocket holes (the oval of the 3/4" setting runs to 2 1/8" in a board 2 1/2" deep, with 1/2" wanted past
   it), and when pocket holes are picked for it by hand, Check my design says the hole has no room. */
SELFTESTS.push(function handDrawnPocketsHaveRoom(problems){
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>{
    load(JSON.stringify(blank()),true);
    addParts([mk('Apron','1x3',[24,2.5,.75],[0,0,0]),mk('Top','ply34',[24,.75,6],[0,2.5,-3])]);
    commit();
    const j=findJoints().find(one=>one.k===1);
    if(!j){problems.push('pocket room: the hand-drawn apron and top of the test do not touch');return;}
    if(jType(j)==='pocket')problems.push('pocket room: a 1x3 apron drawn under a top is suggested pocket holes that run out of it');
    S.joints[j.key]='pocket';
    commit();
    if(!pocketRoomWarnings().some(found=>found.code==='pocket-room'))problems.push('pocket room: pocket holes picked by hand in a 1x3 apron under a top are not reported by Check my design');
  });}finally{load(kept,true);}
});
/* ---------- why a setting is thinner than the piece it drills ----------
   Under the jig settings of "Drill your pieces" one line says why a setting is thinner than a piece it drills
   (jigSettingsHtml, js/partdrawings.js). There are two reasons, and each gets its own words with the real thickness of
   the piece the screws go into (the real-thing reviewer's finding 1 and the code reader's finding 3: the old line
   called a 2x6 seat board "the 3/4" Seat board"):
     into   the screws go into a piece no thicker than the setting (a 2x4 apron under a 3/4" top): the thicker setting
            would push them out through it
     across the holes run across a rail on edge into a thicker top or seat (sheet 27, section 8): at the rail's own
            setting the hole would break out of the rail's far edge; at the thinner one it stays inside
   A jig that sets itself from the board (sheet 27, section 4) needs the rail stood on a spacer to drill a 3/4" hole in
   a 1 1/2" board: said once, half a sentence (finding 13).
   setups: the jig setups of the drill plan ({no, jig, holes: [{piece, f}]}). Returns a list of sentences. */
function drillWhyTexts(setups){
  const texts=[];
  const numbered=setups.length>1;
  let spacerSaid=false;
  for(const setup of setups){
    const thick=setup.holes.filter(hole=>hole.piece.t>setup.jig+.02);
    if(!thick.length)continue;
    // the depth of the piece a hole's screw goes into, along the screw's main direction
    const depthInto=hole=>{
      const d=hole.f.dir.map(Math.abs),k=d.indexOf(Math.max(...d)),b=plainBox(hole.f.into);
      return b.hi[k]-b.lo[k];
    };
    const kinds={into:[],across:[]};
    for(const hole of thick)kinds[depthInto(hole)<=setup.jig+.02?'into':'across'].push(hole);
    const head=numbered?`Setting ${setup.no}`:'The setting';
    for(const kind of['into','across']){
      const holes=kinds[kind];
      if(!holes.length)continue;
      const names=[...new Set(holes.map(hole=>hole.piece.name))].map(name=>{
        const many=new Set(holes.filter(hole=>hole.piece.name===name).map(hole=>hole.piece.id)).size>1;
        return(many?pluralName(name):name).toLowerCase();
      });
      const plural=names.length>1||new Set(holes.map(hole=>hole.piece.id)).size>1;
      const sizes=[...new Set(holes.map(hole=>fmt(hole.piece.t)))];
      // the pieces the screws go into, grouped by their real thickness: 'the 1 1/2" Seat board and Back seat board'
      const byThickness=new Map();
      for(const hole of holes){
        const t=fmt(r16(depthInto(hole)));
        if(!byThickness.has(t))byThickness.set(t,new Set());
        byThickness.get(t).add(hole.f.into.name);
      }
      const intoWords=listWords([...byThickness].map(([t,set])=>`the ${t} ${listWords([...set])}`));
      const many=[...byThickness.values()].reduce((sum,set)=>sum+set.size,0)>1;
      const opening=`${head} is for ${fmt(setup.jig)} stock although the ${listWords(names)} ${plural?'are':'is'} ${sizes.length===1?sizes[0]:'thicker'} thick:`;
      if(kind==='into'){
        texts.push(`${opening} these screws go into ${intoWords}, and the thicker setting would push them out through ${many?'them':'it'}.`);
        continue;
      }
      const up=holes.every(hole=>hole.f.dir[1]>.5);
      const own=fmt(Math.max(...holes.map(hole=>hole.piece.t)));
      let text=`${opening} these holes go ${up?'up ':''}across the width of the board into ${intoWords}, and at the ${own} setting each hole would break out of the board's ${up?'bottom':'far'} edge; at ${fmt(setup.jig)} it stays well inside.`;
      if(!spacerSaid&&Math.abs(setup.jig-.75)<.01&&holes.some(hole=>Math.abs(hole.piece.t-1.5)<.02)){
        text+=' On a jig that sets itself from the board, stand the board on a spacer about 1 1/8" tall (the jig\'s instructions say how).';
        spacerSaid=true;
      }
      texts.push(text);
    }
  }
  return texts;
}
/* Self-check: the line under the jig settings writes every piece the screws go into at its own thickness, and gives
   the across reason (not "push them out") where the piece is thicker than the setting. Run on the presets whose holes
   across a rail go into a top or a seat, in Everyday and Fine furniture. Shown failing on the old words first: the
   old line called the Dining chair's 1 1/2" seat boards "the 3/4" Seat board". */
function drillWhyFaults(name){
  const faults=[];
  const drill=buildPlan(true).drill;
  const html=jigSettingsHtml(drill);
  const lines=[...html.matchAll(/<p class="hint drill-why">([^<]*)<\/p>/g)].map(m=>m[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'));
  const pieces=S.parts.filter(p=>!isProp(p));
  for(const line of lines){
    for(const p of pieces){
      const quoted=p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const found=line.match(new RegExp('(\\d+ \\d+/\\d+|\\d+/\\d+|\\d+)" '+quoted+'\\b'));
      if(!found)continue;
      const said=parseLen(found[1]+'"');
      // a piece of that name with that thickness in some direction is in the design
      const sizes=pieces.filter(q=>q.name===p.name).flatMap(q=>[q.t,q.w,q.l]);
      if(!sizes.some(t=>Math.abs(t-said)<.02))faults.push(`${name}: the line under the jig settings calls the ${p.name} ${found[1]}" thick, and no ${p.name} is: "${line.slice(0,140)}"`);
      else if(/push them out/.test(line)&&said>parseLen((line.match(/is for (\S+(?: \S+)?)" stock/)||[,'0'])[1]+'"')+.02)
        faults.push(`${name}: the line under the jig settings says the screws would push out through the ${found[1]}" ${p.name}, thicker than the setting: "${line.slice(0,140)}"`);
    }
  }
  return{faults,lines};
}
SELFTESTS.push(function drillWhyWordsAreTrue(problems){
  const kept=JSON.stringify(S);
  let lines=0;
  try{withoutDrawing(()=>{
    const names=['Dining chair','Dining table','Sturdy bench','Single aquarium stand','Cabinet stand with a row of tanks','Garage shelves','Desk'];
    for(const name of names){
      const preset=PRESETS.find(p=>p.name===name);
      if(!preset)continue;
      for(const style of['std','fine']){
        load(JSON.stringify(blank()),true);
        if(!placeInStyle(preset,presetDefaults(preset),style))continue;
        const found=drillWhyFaults(`${name} (${STYLES[style][0]})`);
        lines+=found.lines.length;
        for(const fault of found.faults.slice(0,2))problems.push('drill words: '+fault);
      }
    }
  });}finally{load(kept,true);}
  if(!lines)problems.push('drill words: no line under the jig settings was written for any preset tried, so this check proves nothing');
});
/* Self-check: every preset with each of its choices (presetVariants), and each number at its smallest and largest
   (sizesToTry), in Rustic, Everyday and Fine furniture: every pocket hole keeps POCKET_ROOM, and no two screws or
   their holes meet inside the wood (screwsThatMeet: R14 of the drill stage 2 review found two pairs that nearly
   touched in option designs no check ran in Fine or Rustic). A size the form refuses is not built, so not checked. */
SELFTESTS.push(function pocketHolesStayInTheirPiece(problems){
  const seen=new Set();
  const wrong=text=>{const kind=text.replace(/\d[\d\/ ]*"/g,'#').replace(/\(variant \d+\)|\([^)]*\)/g,'');if(!seen.has(kind)&&seen.size<16){seen.add(kind);problems.push('pocket holes: '+text);}};
  let holes=0;
  const tryOne=(preset,vals,style,name)=>{
    if(preset.check&&preset.check(vals).some(found=>found.level==='stop'))return;
    if(!placeInStyle(preset,vals,style))return;
    for(const fault of pocketRoomFaults())wrong(`${name} (${STYLES[style][0]}): ${fault.text}`);
    for(const met of screwsThatMeet())wrong(`${name} (${STYLES[style][0]}): the ${met.a.label} (${met.a.through.name} into ${met.a.into.name}) and the ${met.b.label} (${met.b.through.name} into ${met.b.into.name}) meet inside the wood`);
    for(const link of connGraph().links)if(link.type==='pocket'&&link.fastened)holes++;
  };
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>{
    for(const variant of presetVariants()){
      for(const style of Object.keys(STYLES))tryOne(variant.preset,{...presetDefaults(variant.preset),...variant.vals},style,variant.name);
    }
    for(const preset of PRESETS){
      for(const size of sizesToTry(preset).slice(1)){
        for(const style of Object.keys(STYLES))tryOne(preset,size.vals,style,`${preset.name} at ${size.where}`);
      }
    }
    // the choices of the fish presets taken together (a cabinet under a rack at its lowest storage height: there a
    // layout carried over from Everyday ran the row for the countertop into the end holes in Fine furniture)
    if(typeof fishTopCases==='function')for(const one of fishTopCases()){
      for(const style of Object.keys(STYLES))tryOne(one.preset,one.vals,style,`${one.preset.name} (${one.where})`);
    }
  });}finally{load(kept,true);}
  if(!holes)wrong('no pocket hole was found in any preset, so this check proves nothing');
});
/* Self-check: the rule can fail. A 2x4 rail on edge with a 2x6 seat board on it, its pocket holes for the seat
   drilled the old way (the jig set for the 1 1/2" rail): the oval runs past the bottom edge. And two holes drawn into
   each other are found. */
SELFTESTS.push(function pocketRoomCanFail(problems){
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>{
    load(JSON.stringify(blank()),true);
    addParts([mk('Rail','2x4',[24,3.5,1.5],[0,0,0]),mk('Seat board','2x6',[24,1.5,5.5],[0,3.5,-2])]);
    commit();
    const link=connGraph().links.find(one=>one.joint&&one.joint.k===1);
    if(!link){problems.push('pocket holes: the rail and the seat board of the test do not touch');return;}
    const j=link.joint,list=fastenerLayout(j,'pocket');
    if(!list.length){problems.push('pocket holes: the test rail gets no pocket holes');return;}
    if(list[0].jig!==.75)problems.push(`pocket holes: a 2x4 rail drilled across its height for a 1 1/2" seat is set for ${fmt(list[0].jig)} stock, not 3/4" (sheet 27 section 8)`);
    // the same hole as the old jig drilled it: half of 1 1/2" in from the face, the middle of the bit at 0.75 / tan 15
    const f=list[0],old={...f,pocket:{...f.pocket,mouth:f.pocket.mouth.slice()}};
    old.pocket.mouth[1]=j.plane-.75/Math.tan(FASTEN.pocketDegrees*Math.PI/180);
    const room=pocketHoleRoom(old,j);
    if(r16(room.beyond)>=POCKET_ROOM.beyond)problems.push(`pocket holes: the old 1 1/2" setting on a 3 1/2" rail is not found too near the bottom edge (${fmt(r16(room.beyond))} beyond its oval)`);
    if(r16(pocketHoleRoom(f,j).beyond)<POCKET_ROOM.beyond)problems.push(`pocket holes: the 3/4" setting on a 3 1/2" rail leaves only ${fmt(r16(pocketHoleRoom(f,j).beyond))} beyond its oval`);
    const x=pocketOvalCapsule(f,j),y=pocketOvalCapsule({...f,pocket:{...f.pocket,mouth:f.pocket.mouth.map((v,k)=>k===0?v+.3:v)}},j);
    if(segmentGap(x.a,x.b,y.a,y.b)-x.r-y.r>=POCKET_ROOM.web)problems.push('pocket holes: two ovals 0.3" apart are not found to meet');
    // a screw that leaves its piece 1" deeper than the jig puts it (the 4x4 uprights of finding 3)
    const faceAxis=f.pocket.out.findIndex(v=>Math.abs(v)>.5),inward=-Math.sign(f.pocket.out[faceAxis]);
    const deep={...f,pos:f.pos.map((v,k)=>k===faceAxis?v+inward:v)};
    if(Math.abs(pocketExitDepth(deep,j)-f.jig/2)<=1/32)problems.push('pocket holes: a screw that leaves its piece 1" deeper than a jig puts it is not found');
    if(Math.abs(pocketExitDepth(f,j)-f.jig/2)>1/32)problems.push(`pocket holes: the test rail's screw leaves ${fmt(r16(pocketExitDepth(f,j)))} in from its face, not half its setting`);
  });}finally{load(kept,true);}
  // and the whole rule, run on real designs (the code reader's finding 13): the Cabinet stand at 400 gallons, whose
  // uprights are 4x4s, laid out with the bracket rule taken away (thickPiecesTakeBrackets, js/joints.js), must be
  // reported by pocketRoomFaults; and a rail on edge under a seat, set the old way, too
  const cabinet=PRESETS.find(preset=>preset.name==='Cabinet stand with a row of tanks');
  const keptRule=thickPiecesTakeBrackets;
  try{withoutDrawing(()=>{
    thickPiecesTakeBrackets=()=>{};
    load(JSON.stringify(blank()),true);
    if(cabinet&&placeInStyle(cabinet,{...presetDefaults(cabinet),gal:400},'std')){
      if(!pocketRoomFaults().some(fault=>/no jig can drill it/.test(fault.text)))problems.push('pocket holes: the 4x4 uprights of a 400 gallon Cabinet stand, laid out without brackets, are not reported');
    }
    thickPiecesTakeBrackets=keptRule;
    const keptAcross=pocketAcross;
    pocketAcross=()=>false;   // every hole at the setting for its thickness, as before the round
    if(typeof layoutCarry!=='undefined')layoutCarry.clear();   // (nothing laid out under the rule is kept)
    try{
      load(JSON.stringify(blank()),true);
      addParts([mk('Rail','2x4',[24,3.5,1.5],[0,0,0]),mk('Seat board','2x6',[24,1.5,5.5],[0,3.5,-2])]);
      for(const j of findJoints())S.joints[j.key]='pocket';
      commit();
      if(!pocketRoomFaults().some(fault=>/far edge|beyond the far end/.test(fault.text)))problems.push('pocket holes: a 2x4 rail drilled at the 1 1/2" setting for a seat is not reported by pocketRoomFaults');
    }finally{pocketAcross=keptAcross;if(typeof layoutCarry!=='undefined')layoutCarry.clear();}
  });}finally{thickPiecesTakeBrackets=keptRule;load(kept,true);}
});
