/* NominalCAD: Unfasten, the one way to take a piece off the pieces it is fastened to.

   A fastened piece moves with everything it is fastened to (js/connections.js). To move it by itself, its
   connections have to be deleted first, and that is never done silently: Unfasten (U) always shows what would
   go, in plain words, and asks. There is no modifier key and no drag that pulls a fastened piece free.

     unfastenSel()            the command: frees the selection from everything outside it. Connections between
                              two selected pieces stay.
     linksToOutside(ids)      the fastened connections between these pieces and the rest of the design
     canUnfasten()            is the selection fastened to anything outside it? (greys the command out)
     propsConnections(ps)     the Connections section of the Properties panel

   Deleting a connection stores "Not joined" for its two pieces, as one undo step. Fasten them again with
   Connect (C), or by picking a fastener in the Properties panel (select the two pieces, or click the fastener in the 3D view) or on the Fasteners tab (Expert). */
'use strict';

function linksToOutside(ids){
  const inside=ids instanceof Set?ids:new Set(ids),found=new Map();
  for(const id of inside){
    for(const link of connectionsOf(id)){
      if(!link.fastened)continue;
      const other=link.a.id===id?link.b.id:link.a.id;
      if(!inside.has(other))found.set(link.key,link);
    }
  }
  return[...found.values()];
}
function canUnfasten(){
  for(const id of sel){
    for(const link of connectionsOf(id)){
      if(link.fastened&&!sel.has(link.a.id===id?link.b.id:link.a.id))return true;
    }
  }
  return false;
}
/* The connections as lines for the question: "Long apron to Leg: 2 pocket-hole screws". The selected piece is
   named first. Connections that read the same are one line with a count. */
const UNFASTEN_LINES_MAX=12;
function unfastenLines(links,freed){ // freed: the ids of the pieces that become free (the selection when left out)
  const counts=new Map(),own=freed||sel;
  for(const link of links){
    const[mine,other]=own.has(link.a.id)?[link.a,link.b]:[link.b,link.a];
    const line=`${mine.name} to ${other.name}: ${linkSaid(link)}`;
    counts.set(line,(counts.get(line)||0)+1);
  }
  const lines=[...counts.entries()].map(([line,count])=>count>1?`${line}, in ${count} places`:line);
  if(lines.length<=UNFASTEN_LINES_MAX)return lines;
  const rest=lines.length-UNFASTEN_LINES_MAX+1;
  return lines.slice(0,UNFASTEN_LINES_MAX-1).concat(`and ${rest} more kinds of connection`);
}
function unfastenSel(){
  if(tab!=='design')setTab('design');
  if(!sel.size){toast('Select the piece you want to free first.');return;}
  const links=linksToOutside(sel);
  if(!links.length){
    toast(sel.size===1?'This piece is not fastened to anything.':'The selection is not fastened to anything outside it.');
    return;
  }
  const ps=selParts();
  askDeleteLinks(links,ps.length===1?ps[0].name:`the ${ps.length} selected pieces`,
    `${ps.length===1?ps[0].name+' is':'The selected pieces are'} free. ${howToFastenAgain(links)}`);
}
/* What to say after connections were deleted: how to get them back. Screws come back with Connect; a door goes
   back on hinges and a drawer back on slides with their own commands, never with Connect, which would screw a
   door shut (connectAndFasten in js/connections.js refuses that too). */
function howToFastenAgain(links){
  const motions=new Set(links.filter(link=>link.hold&&HARDWARE[link.type]).map(link=>HARDWARE[link.type].motion));
  const said=[];
  if(motions.has('swing'))said.push('Hang this door or lid (Add, Hardware) puts it back on hinges.');
  if(motions.has('slide')||links.some(link=>link.type==='hung'))said.push('Mount this drawer on slides (Add, Hardware) puts it back on its slides.');
  if(links.some(link=>!link.hold))said.push('Connect (C) fastens two touching pieces again.');
  return said.join(' ');
}
/* THE QUESTION. Everything that would take a piece off its fasteners asks through here, and nothing is deleted
   unless the person agrees: Unfasten, Delete connection on a picked fastener, the last hinge of a door, a tilt of
   one fastened piece (js/panels.js), hanging a piece on hinges or mounting it on slides (js/hanging.js).
     links     the connections that would go (from connGraph())
     question  {text, title, action, freed}: the sentence above the list, the title bar, the label of the button
               that agrees, and the ids of the pieces that become free (for naming them first in each line; the
               selection when left out). Title and action have the usual words when left out.
     onYes     runs when the person agrees. It does the deleting (deleteLinks) and whatever else belongs to it.
   Agreeing destroys connections, so the keyboard starts on "Keep them": Enter never deletes (js/dialogs.js). */
function askAboutLinks(links,question,onYes){
  const one=links.length===1;
  askConfirm(question.text,
    {title:question.title||(one?'Delete the connection?':`Delete these ${links.length} connections?`),
      action:question.action||(one?'Delete connection':'Delete connections'),cancel:one?'Keep it':'Keep them',
      danger:true,list:unfastenLines(links,question.freed)},
    onYes);
}
/* Deletes connections without asking: only ever called from the onYes of askAboutLinks. Call commit() afterwards. */
function deleteLinks(links){
  for(const link of links){
    if(link.remove)link.remove(); // hardware (a hinge, a drawer slide) deletes itself: HOLD_SOURCES in js/connections.js
    else S.joints[link.key]='none';
  }
}
/* The plain case: lists these connections, and deletes them when the person agrees (one undo step).
   who: what becomes free, for the sentence ("Leg", "the 3 selected pieces").  said: the message afterwards.
   A fastener that is clicked in the 3D view asks through here too (js/fastenerview.js). */
function askDeleteLinks(links,who,said){
  const one=links.length===1;
  askAboutLinks(links,
    {text:`${one?'This connection':'These connections'} will be deleted, so that ${who} can be moved alone. Undo (Ctrl+Z) brings ${one?'it':'them'} back.`},
    ()=>{
      deleteLinks(links);
      commit();
      toast(said);
    });
}

/* ---------- Properties panel: what the selection is fastened to ---------- */
const PROPS_LINKS_MAX=6;
function propsConnections(ps){
  if(!ps.length||ps.every(isProp))return'';
  const button=`<button class="btn s" data-cmd="unfasten" title="Delete the connections between the selection and the other pieces, after asking (U)">${icon('i-unfasten')}Unfasten</button>`;
  const along=followerCount();
  let html=propsSection(ps.length===1?'Connections':'Fastened to other pieces',canUnfasten()?button:'');
  if(ps.length===1){
    const p=ps[0],links=connectionsOf(p.id);
    if(!links.length)return html+propsNote('It touches nothing, so it moves by itself.');
    const shown=links.length>PROPS_LINKS_MAX?PROPS_LINKS_MAX-1:links.length; // never "and 1 more" where the one would fit
    const rows=links.slice(0,shown).map(link=>{
      const other=link.a===p?link.b:link.a;
      return`<div class="frow wide"><label>${esc(other.name)}</label><span>${esc(link.fastened?linkSaid(link):'only touching')}</span></div>`;
    }).join('');
    html+=rows+(links.length>shown?propsNote(`and ${links.length-shown} more.`):'');
  }
  return html+propsNote(along?`<b>${along+ps.length} fastened pieces move and turn together.</b> Stretching changes only this piece.`
    :ps.length===1?'Not fastened to anything: it moves by itself.':'Nothing outside the selection is fastened to it.');
}

/* ---------- checks ---------- */
SELFTESTS.push(function fastenedSets(problems){
  const wrong=text=>problems.push('connections: '+text);
  const autoKept=autoFasten,selKept=sel;
  /* two legs under a top, the top screwed to both, a fish tank standing on the top; a loose board lies apart */
  const build=()=>{
    load(JSON.stringify(blank()),true);
    return addParts([mk('Leg','4x4',[3.5,20,3.5],[0,0,0]),mk('Leg','4x4',[3.5,20,3.5],[30,0,0]),
      mk('Top','2x6',[33.5,1.5,5.5],[0,20,0]),mk('Loose board','2x4',[24,1.5,3.5],[0,0,40]),
      mk('Tank','tank',[20,10,5.5],[6,21.5,0])]);
  };
  try{
    autoFasten=true;
    const[legA,legB,top,loose,tank]=build();
    commit();
    const set=fastenedSet([legA]);
    if(!(set.has(top)&&set.has(legB))||set.has(loose))wrong('a leg, the top screwed to it and the other leg are not one fastened set: '+[...set].join());
    if(!set.has(tank))wrong('a fish tank standing on the top does not go along when the stand moves');
    if(fastenedSet([tank]).size!==1)wrong('moving a fish tank would take its stand along');

    // moving one leg takes the set along and leaves the loose board
    sel=new Set([legA]);
    const before=S.parts.map(p=>p.pos.slice());
    applyMove(moveState(legA),[5,0,0],[0],true);
    commit();
    const moved=S.parts.map((p,i)=>p.pos[0]-before[i][0]);
    if([0,1,2,4].some(i=>Math.abs(moved[i]-5)>1e-6)||Math.abs(moved[3])>1e-6)wrong('moving a leg 5" moved the pieces by '+moved.join(', ')+' (the fastened three and the tank should go, the loose board should stay)');
    nudge(0,1);
    if(Math.abs(byId(top).pos[0]-byId(legA).pos[0])>1e-6)wrong('the arrow keys moved a leg away from the top it is screwed to');

    // turning it takes the set along too, and they still hold afterwards
    applyRot(snapshot(),1,Math.PI/2,selCenter());finishRot();commit();
    if(!fastenedSet([legA]).has(legB))wrong('after a quarter turn the fastened set fell apart');
    applyRot(snapshot(),1,Math.PI/6,selCenter());finishRot();commit();
    if(!fastenedSet([legA]).has(legB)||!fastenedSet([legA]).has(top))wrong('after a turn of 30 degrees the fastened set fell apart');
    undo();undo();

    // stretching changes one piece only
    const legLength=byId(legB).l;
    byId(top).l+=2;commit();
    if(byId(legB).l!==legLength)wrong('a size edit changed another piece');
    undo();

    // Unfasten asks, then frees; the connection does not come back while the pieces stay put
    sel=new Set([legA]);
    if(!canUnfasten())wrong('Unfasten is greyed out for a fastened leg');
    const links=linksToOutside(sel);
    if(links.length!==1||!/^Leg to Top: \d+ /.test(unfastenLines(links)[0]))wrong('the question does not list the connection in plain words: '+unfastenLines(links).join(' / '));
    const undoBefore=undoStack.length;
    unfastenSel(); // answered yes at once while the self-check runs
    if(undoStack.length!==undoBefore+1)wrong('Unfasten was not one undo step');
    if(fastenedSet([legA]).size!==1)wrong('after Unfasten the leg is still fastened');
    if(canUnfasten())wrong('Unfasten is still offered for a free piece');
    byId(top).pos[2]+=.25;commit();byId(top).pos[2]-=.25;commit(); // other edits: the leg stays free
    if(fastenedSet([legA]).size!==1)wrong('a deleted connection came back by itself while the pieces stayed where they were');
    applyMove(moveState(legA),[0,0,12],[2],true);commit();
    if(Math.abs(byId(top).pos[2]-byId(legA).pos[2])<11)wrong('a freed leg still took the top along');
    // parted, then touching again: Auto-fasten applies afresh
    applyMove(moveState(legA),[0,0,-12],[2],true);commit();
    if(!fastenedSet([legA]).has(top))wrong('with Auto-fasten on, a leg put back under the top was not fastened again');

    // undo brings a deleted connection back
    unfastenSel();
    undo();
    if(!fastenedSet([legA]).has(top))wrong('undo did not bring the deleted connection back');

    // Auto-fasten off: new contacts only touch, until Connect fastens them
    autoFasten=false;
    sel=new Set([loose]);
    const board=byId(loose),topPiece=byId(top);
    board.pos=[topPiece.pos[0],topPiece.pos[1]+1.5,topPiece.pos[2]];commit(); // laid on the top
    if(!connGraph().byKey.has(top+'-'+loose))wrong('a board laid on the top is not seen as touching it');
    if(fastenedSet([loose]).size!==1)wrong('with Auto-fasten off, a board laid on the top was fastened by itself');
    if(!fastenedSet([legA]).has(legB))wrong('turning Auto-fasten off changed connections that were already there');
    // hardware from another file holds like a fastener, and Unfasten removes it through its own remove()
    let hinged=true;
    const hinge=()=>hinged?[{key:'test-hinge',a:byId(legA),b:byId(loose),type:'hinge',words:'2 hinges',remove(){hinged=false;}}]:[];
    HOLD_SOURCES.push(hinge);
    try{
      commit();
      if(!fastenedSet([legA]).has(loose))wrong('a link from HOLD_SOURCES does not hold its two pieces together');
      sel=new Set([loose]);
      if(!unfastenLines(linksToOutside(sel)).some(line=>/2 hinges/.test(line)))wrong('hardware is not listed by its own words in the Unfasten question');
      unfastenSel();
      if(hinged||fastenedSet([loose]).size!==1)wrong('Unfasten did not remove a hardware link through its remove()');
    }finally{
      HOLD_SOURCES.splice(HOLD_SOURCES.indexOf(hinge),1);
    }
    const said=connectAndFasten(byId(loose),byId(top));commit();
    if(!fastenedSet([loose]).has(top)||!/fastened now/.test(said))wrong('Connect did not fasten two touching pieces: '+said);
    if(byId(loose).pos[1]!==byId(top).pos[1]+1.5)wrong('Connect moved a piece that already touched the other');
  }finally{
    autoFasten=autoKept;sel=selKept;
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* A piece that was unfastened, lifted off and set back is fastened the way its preset fastens it (the joints the
   preset names survive the parting: S.named); a fastened set that is tipped a quarter turn rests on the floor
   again; and a fastened piece flipped "in place" flips its whole set where it stands. */
SELFTESTS.push(function setsGoBackWhereTheyBelong(problems){
  const wrong=text=>problems.push('sets: '+text);
  const kept={auto:autoFasten,sel,tab};
  let presetKept=null;   // placePreset remembers the preset it placed for the dialog; that must not change here
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const place=name=>{
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)return false;
    load(JSON.stringify(blank()),true);
    const vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),false);
    return true;
  };
  const rows=()=>JSON.stringify(hardwareTotals(findJoints()).rows);
  try{
    autoFasten=true;
    if(place('Base cabinet with doors')){
      const before=rows(),top=S.parts.find(p=>p.name==='Countertop');
      sel=new Set([top.id]);
      unfastenSel();   // answered yes at once while the self-check runs
      if(fastenedSet([top.id]).size!==1)wrong('(setting up) the countertop was not freed by Unfasten');
      applyMove(moveState(top.id),[0,5,0],[1],true);commit();
      applyMove(moveState(top.id),[0,-5,0],[1],true);commit();
      if(fastenedSet([top.id]).size<2)wrong('a countertop that was lifted off and set back was not fastened again');
      if(rows()!==before)wrong('a countertop that was unfastened, lifted off and set back is not fastened the way the preset fastens it: the hardware to buy changed');

      // flipped "in place" with one door selected: the cabinet stays where it stands
      place('Base cabinet with doors');
      const stood=bbox(S.parts);
      sel=new Set([S.parts.find(p=>p.name==='Door').id]);
      mirrorSel(0,'mid',false);
      const now=bbox(S.parts);
      if(Math.abs(now.lo[0]-stood.lo[0])>.07||Math.abs(now.hi[0]-stood.hi[0])>.07)wrong(`flipping one door of a cabinet in place moved the cabinet ${fmt(Math.abs(now.lo[0]-stood.lo[0]))} sideways`);
    }
    if(place('Workbench')){
      const top=S.parts.find(p=>p.name==='Top');
      sel=new Set([top.id]);
      for(const direction of[2,0]){   // Tip sideways, Tip front/back
        turnQuarter(byId(top.id),direction);commit();
        const low=bbox(S.parts).lo[1];
        if(Math.abs(low)>.07)wrong(`a workbench tipped a quarter turn hangs ${fmt(low)} above the floor`);
        if(fastenedGroups().length!==1)wrong('a workbench tipped a quarter turn is no longer one fastened set');
      }
    }
  }finally{
    autoFasten=kept.auto;
    load(JSON.stringify(blank()),true);
    sel=kept.sel;
    setTab(kept.tab);
    try{
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
      else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
