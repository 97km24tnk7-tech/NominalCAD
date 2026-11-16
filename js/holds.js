/* NominalCAD: what holds a piece without being a wood joint, as ONE list for the whole program.

   Two things can hold a piece that touches nothing:
     - hardware that is placed in the design: a hinge, a drawer slide (js/hardware.js adds those to HOLD_SOURCES);
     - hardware that a preset says is there but that is not drawn: the pieces on its `hung` list, kept per
       placement in S.sets (the drawer sides of a nightstand saved before its slides were drawn). This file adds
       those to HOLD_SOURCES too, each hanging from the wooden piece right beside it. A drawer that is put on real
       slides stops being held this way (mountDrawer in js/drawers.js marks its pieces unhung): from then on the
       slides hold it, and taking them away is noticed.

   Everything that asks "is this piece held?" reads that one list:
     - the 3D view: the connection graph (js/connections.js) is built from it, so a hung drawer moves with its
       cabinet, Unfasten lists it and takes it off, and Properties shows it under Connections;
     - Check my design: designCheckOptions() hands the same pairs to the structural check as options.hardware
       (js/verify.js, "HARDWARE, ONE TRUTH"). A door whose hinges were taken off, or a drawer that was unfastened,
       is then reported as not held.

     holdPairs()             [{on, to}]: the ids of every pair of pieces that hardware holds together right now
     designCheckOptions()    the options Check my design uses for the design on screen
     piece.unhung            true once a declaration no longer holds the piece: the person unfastened it, or its
                             hardware is drawn now

   OLDER PROJECTS
     A project saved before hardware was drawn has no hardware list at all. Its doors were checked on the
     understanding that the hinges are there without being drawn, and that must not change when it is opened:
     such a project is marked S.assumeHardware (js/hardware.js sets it while loading), and the check then
     assumes the hardware as it always did.
     When such a project is opened its doors and lids are hung on real hinges, the way Create does it today
     (bringOlderProjectUpToDate below). If Check my design then says no more than it said with the hinges
     assumed, the mark is taken off: the project is one of today, its doors move with their cabinets and can be
     opened. If a door cannot be hung, or the verdict would get worse, everything is put back and the mark
     stays. The mark also goes away with the design (a new project, or a preset that replaces it). */
'use strict';

const HUNG_WORDS='bought hardware that is not drawn (drawer slides or hinges)';

/* The pieces that a preset declared as hanging on bought hardware and that still do: by the placement they came
   with (piece.set, S.sets), or, for a piece without one, by the project-wide list older versions saved. */
function declaredHungPieces(){
  const sets=S.sets&&typeof S.sets==='object'?S.sets:{};
  const whole=new Set(Array.isArray(S.hung)?S.hung:[]);
  const anySet=Object.values(sets).some(set=>set&&Array.isArray(set.hung)&&set.hung.length);
  if(!anySet&&!whole.size)return[];   // the usual case: nothing to look for
  const namesBySet=new Map();
  const namesFor=p=>{
    const own=p.set!==undefined&&p.set!==null?sets[p.set]:null;
    if(!own||typeof own!=='object')return whole;
    if(!namesBySet.has(p.set))namesBySet.set(p.set,new Set(Array.isArray(own.hung)?own.hung:[]));
    return namesBySet.get(p.set);
  };
  return S.parts.filter(p=>!isProp(p)&&!p.unhung&&namesFor(p).has(p.name));
}
/* Each declared piece with the piece it hangs from: the same rule as the structural check has always used
   (hardwareMount in js/verify.js: the nearest wooden piece that faces it across 3/4" or less), looked for among
   the pieces of the same placement. A piece that has real slides or hinges on it is left to those. */
HOLD_SOURCES.push(function declaredHolds(){
  const hung=declaredHungPieces();
  if(!hung.length)return[];
  const real=new Set(hardwareList().filter(item=>HARDWARE[item.kind]&&HARDWARE[item.kind].motion&&item.to!=null).map(item=>item.on));
  const hungIds=new Set(hung.map(p=>p.id));
  const setKey=p=>p.set===undefined||p.set===null?'none':p.set;
  const wanted=new Set(hung.map(setKey)),nodesBySet=new Map();
  for(const p of S.parts){
    if(isProp(p)||!wanted.has(setKey(p)))continue;
    const b=box(p),material=M[p.mat];
    const node={p,lo:b.lo,hi:b.hi,onHardware:hungIds.has(p.id),skin:material.kind==='sheet'&&material.t<=.3};
    if(!nodesBySet.has(setKey(p)))nodesBySet.set(setKey(p),[]);
    nodesBySet.get(setKey(p)).push(node);
  }
  const holds=[];
  for(const nodes of nodesBySet.values()){
    for(const node of nodes){
      if(!node.onHardware||real.has(node.p.id))continue;
      const mount=hardwareMount(node,nodes);
      if(!mount)continue;   // nothing beside it to screw the hardware to: Check my design says so
      const piece=node.p;
      holds.push({key:'hung:'+piece.id,a:piece,b:mount.p,type:'hung',words:HUNG_WORDS,remove(){piece.unhung=true;}});
    }
  }
  return holds;
});

/* every pair of pieces that hardware holds together, as the structural check wants it */
function holdPairs(){
  return connGraph().links.filter(link=>link.hold).map(link=>({on:link.a.id,to:link.b.id}));
}
function designCheckOptions(){
  const options=verifyOptionsOf(S);
  if(!S.assumeHardware)options.hardware=holdPairs();
  return options;
}

/* ---------- a project from before hardware was drawn ---------- */
const stopCount=result=>result.problems.filter(found=>found.level==='stop').length;
function bringOlderProjectUpToDate(){
  if(!S.assumeHardware||S.assumeHardware==='kept')return;   // 'kept': tried once already (undo and redo read the project again)
  const doors=S.parts.filter(p=>!isProp(p)&&DOOR_NAMES.test(p.name));   // what Create would hang (js/hanging.js)
  const before={joints:JSON.stringify(S.joints),hardware:JSON.stringify(hardwareList()),nextHw:S.nextHw};
  const assumed=stopCount(verifyDesign(S.parts,verifyOptionsOf(S)));
  const failed=doors.length?hangPresetDoors(doors.map(p=>p.id)):[];
  connCache=null;      // the hinges hold now, and the doors are no longer joined to their frames as well:
  connGraph();         // the list of what is fastened to what is built again (js/connections.js)
  const drawn=stopCount(verifyDesign(S.parts,Object.assign(verifyOptionsOf(S),{hardware:holdPairs()})));
  if(!failed.length&&drawn<=assumed){
    delete S.assumeHardware;
    // the hinges, pulls and catches that were just placed are listed as what they are; the project's own plain
    // lines for them are settled for good, as Create does it (settlePlainLines, js/hardware.js)
    if(doors.length)settlePlainLines([],S.hw||[],S.parts.map(p=>p.id));
    return;
  }
  // not every door could be hung, or the design would be judged harder than before: leave it as it was saved
  S.assumeHardware='kept';
  S.joints=JSON.parse(before.joints);
  S.hardware=JSON.parse(before.hardware);
  if(before.nextHw===undefined)delete S.nextHw;else S.nextHw=before.nextHw;
  connCache=null;
  connGraph();
}
ON_LOAD.push(bringOlderProjectUpToDate);

/* ---------- checks ---------- */
/* A door on placed hinges is held, and taking the hinges off is noticed; the Nightstand's drawers, on their placed
   slides, are held, move with the cabinet, and are reported once they are unfastened; drawer sides that are only
   declared as hung behave the same; a project from before hardware was drawn keeps its verdict. */
SELFTESTS.push(function hardwareHoldsOneTruth(problems){
  const wrong=text=>problems.push('holds: '+text);
  const tabKept=tab;
  let presetKept=null;   // placePreset remembers the preset it placed for the dialog; that must not change here
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const place=name=>{
    const preset=PRESETS.find(p=>p.name===name);
    if(!preset){wrong(`there is no preset called ${name}`);return false;}
    load(JSON.stringify(blank()),true);
    const vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),false);
    return true;
  };
  const check=()=>verifyDesign(S.parts,designCheckOptions());
  const stopsNaming=(result,name)=>result.problems.filter(f=>f.level==='stop'&&new RegExp(name).test(f.text));
  try{
    // 1. a cabinet door on placed hinges
    if(place('Base cabinet with doors')){
      const door=S.parts.find(p=>p.name==='Door');
      const hinged=holdPairs().filter(pair=>pair.on===door.id);
      if(!hinged.length)wrong('the hinges of a cabinet door are not in the list of what holds');
      const before=check();
      if(before.problems.length)wrong('the Base cabinet as it is placed does not pass Check my design: '+before.problems.map(f=>f.text).join(' / '));
      sel=new Set([door.id]);
      unfastenSel();   // answered yes at once while the self-check runs: the hinges go
      const after=check();
      if(holdPairs().some(pair=>pair.on===door.id))wrong('Unfasten left the hinges of the door in the list of what holds');
      if(!stopsNaming(after,'Door').length)wrong('a cabinet door with its hinges taken off still passes Check my design');
      else if(!/Hang this door or lid/.test(stopsNaming(after,'Door')[0].fix))wrong('the finding for a door without hinges does not say how to hang it');
      // The advice after Unfasten of a door is to hang it again, and Connect does that too: it never screws a door shut
      if(!/Hang this door or lid/.test(howToFastenAgain(connGraph().links.filter(link=>link.hold&&HARDWARE[link.type]&&HARDWARE[link.type].motion==='swing'))))wrong('the message after Unfasten of a door does not say how to hang it again');
      const side=S.parts.find(p=>p.name==='Side'),screws=JSON.stringify(S.joints);
      const said=connectAndFasten(door,side);
      commit();
      if(!moverOf(door.id)||moverOf(door.id).stuck||JSON.stringify(S.joints)!==screws)wrong('Connect on an unfastened door did not hang it again, or screwed it to the cabinet: '+said);
      if(check().problems.length)wrong('a door that Connect hung again does not pass Check my design');
      const again=connectAndFasten(byId(door.id),side);
      if(JSON.stringify(S.joints)!==screws||!/could not open/.test(again))wrong('Connect screwed a door that hangs on hinges to its cabinet: '+again);
      sel=new Set([door.id]);
      unfastenSel();
      // hanging it again makes it pass again
      hangDoor(door);
      commit();
      if(check().problems.length)wrong('a door that was hung again by hand does not pass Check my design');
      // without the list the check assumes the hinges, as it does for a preset that is not placed yet
      sel=new Set([door.id]);
      unfastenSel();
      if(stopsNaming(verifyDesign(S.parts,verifyOptionsOf(S)),'Door').length)wrong('(setting up) the check without a hardware list should assume the hinges');
    }
    // 2. the drawers of the Nightstand run on slides that are placed with it (js/drawers.js): those hold them
    if(place('Nightstand with drawers')){
      const side=S.parts.find(p=>p.name==='Side'),drawerSides=S.parts.filter(p=>p.name==='Drawer side');
      const stops=check().problems.filter(f=>f.level==='stop');
      if(stops.length)wrong('the Nightstand as it is placed has a stop in Check my design: '+stops[0].text);
      if(!drawerSides.length||!drawerSides.every(p=>holdPairs().some(pair=>pair.on===p.id)))wrong('the drawer sides of the Nightstand are not in the list of what holds');
      else if(connGraph().links.some(link=>link.type==='hung'))wrong('a drawer of the Nightstand is still held by a declaration although its slides are placed');
      else{
        if(!fastenedSet([side.id]).has(drawerSides[0].id))wrong('the drawers of the Nightstand do not move with its cabinet');
        // the drawer box alone: what is joined to that drawer side by wood joints, without what hardware holds
        const drawerBox=new Set([drawerSides[0].id]),todo=[drawerSides[0].id];
        while(todo.length){
          const id=todo.pop();
          for(const link of connectionsOf(id)){
            const other=link.a.id===id?link.b.id:link.a.id;
            if(link.fastened&&!link.hold&&!drawerBox.has(other)){drawerBox.add(other);todo.push(other);}
          }
        }
        if(drawerBox.has(side.id))wrong('(setting up) a drawer of the Nightstand is joined to the cabinet by a wood joint');
        sel=drawerBox;
        const lines=unfastenLines(linksToOutside(sel));
        if(!lines.some(line=>/drawer slide/.test(line)))wrong('Unfasten does not list the slides a drawer hangs on: '+lines.join(' / '));
        unfastenSel();
        if(fastenedSet([side.id]).has(drawerSides[0].id))wrong('an unfastened drawer still moves with the cabinet');
        if(!stopsNaming(check(),'Drawer').length)wrong('an unfastened drawer of the Nightstand still passes Check my design');
        undo();
        if(!fastenedSet([S.parts.find(p=>p.name==='Side').id]).has(drawerSides[0].id))wrong('Undo did not bring the hold of a drawer back');
      }
    }
    // 2b. pieces a preset declares as hung on hardware that is NOT drawn (what the Nightstand did before its slides
    //     were placed, and what a project saved then still says): the declaration holds them until they are unfastened
    load(JSON.stringify(blank()),true);
    const declaredIds=addParts([mk('Side','ply34',[.75,20,18],[0,0,0]),mk('Side','ply34',[.75,20,18],[16.75,0,0]),mk('Bottom','ply34',[16,.75,18],[.75,0,0]),
      mk('Drawer side','ply12',[.5,5,14],[1.25,10,1.5]),mk('Drawer side','ply12',[.5,5,14],[15.75,10,1.5]),
      mk('Drawer box front','ply12',[14,5,.5],[1.75,10,15]),mk('Drawer box back','ply12',[14,5,.5],[1.75,10,1.5])]);
    S.sets={1:{name:'Declared',uses:{},wall:[],hung:['Drawer side'],wallFixed:false,warnings:[]}};
    S.parts.forEach(p=>{p.set=1;});
    S.joints[declaredIds[3]+'-'+declaredIds[5]]=S.joints[declaredIds[3]+'-'+declaredIds[6]]=S.joints[declaredIds[4]+'-'+declaredIds[5]]=S.joints[declaredIds[4]+'-'+declaredIds[6]]='nail';
    commit();
    if(!connGraph().links.some(link=>link.type==='hung'))wrong('a drawer side that a preset declares as hung is not held by its declaration');
    else{
      if(stopsNaming(check(),'Drawer').length)wrong('a declared drawer does not pass Check my design');
      sel=new Set(declaredIds.slice(3));
      const lines=unfastenLines(linksToOutside(sel));
      if(!lines.some(line=>line.includes(HUNG_WORDS)))wrong('Unfasten does not list hardware that is declared and not drawn: '+lines.join(' / '));
      unfastenSel();
      if(fastenedSet([declaredIds[0]]).has(declaredIds[3])||!stopsNaming(check(),'Drawer').length)wrong('an unfastened declared drawer is still held, or still passes Check my design');
    }
    // 3. a project saved before hardware was drawn: a door near its frame counts as hinged, as it did then
    const old={name:'Old',parts:[mk('Side','ply34',[.75,20,18],[0,0,0]),mk('Side','ply34',[.75,20,18],[16.75,0,0]),
      mk('Bottom','ply34',[16,.75,18],[.75,0,0]),mk('Top','ply34',[16,.75,18],[.75,19.25,0]),mk('Door','ply34',[17.25,19.75,.75],[.125,.125,18])],
      joints:{},stock:{},notes:[],steps:[],nextId:6};
    old.parts.forEach((piece,index)=>{piece.id=index+1;});
    old.joints['1-5']=old.joints['2-5']=old.joints['3-5']=old.joints['4-5']='none';
    // ... and it is hung on real hinges while the project is opened, so the project becomes one of today
    load(JSON.stringify(old),true);
    if(S.assumeHardware||!moverOf(5)||!fastenedSet([1]).has(5))wrong('the door of an older project was not hung on real hinges when the project was opened');
    if(stopsNaming(check(),'Door').length)wrong('opening an older project changed its verdict: its door is no longer held');
    // a door that stands 1/2" in front of its cabinet cannot be hung by itself: the project stays as it was saved,
    // marked, and is checked with its hinges assumed as before
    const apart=JSON.parse(JSON.stringify(old));
    apart.parts[4].pos[2]=18.5;
    apart.joints={};
    load(JSON.stringify(apart),true);
    if(!S.assumeHardware||designCheckOptions().hardware!==undefined||hardwareList().length)wrong('an older project whose door could not be hung was not left as it was saved');
    if(stopsNaming(check(),'Door').length)wrong('opening an older project changed its verdict: a door that could not be hung is no longer taken as hinged');
    // the same pieces in a project of today: the door needs hinges
    load(JSON.stringify({...old,hardware:[]}),true);
    if(S.assumeHardware||!stopsNaming(check(),'Door').length)wrong('a door with no hinges in a project of today passes Check my design');
  }finally{
    load(JSON.stringify(blank()),true);
    setTab(tabKept);
    try{
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
      else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* The shopping list counts what is in the model. A pull, a catch or a pair of hinges that is deleted from a placed
   preset is off the list, under every name; nothing the preset listed for it comes back. What the preset lists
   without placing it (the screws into the wall) stays, and a copy of the whole design needs it once more. */
SELFTESTS.push(function deletedHardwareLeavesTheList(problems){
  const wrong=text=>problems.push('hardware list: '+text);
  const tabKept=tab;
  let presetKept=null;
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const cabinet=PRESETS.find(p=>p.name==='Base cabinet with doors'),nightstand=PRESETS.find(p=>p.name==='Nightstand with drawers');
  const place=preset=>{
    load(JSON.stringify(blank()),true);
    const vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),false);
  };
  const rows=()=>hardwareTotals(findJoints()).rows;
  const listed=words=>rows().filter(row=>words.test(row[0])&&!HW_NOT_PLAIN.test(row[0]));
  const total=words=>listed(words).reduce((sum,row)=>sum+row[1],0);
  const inModel=kinds=>hardwareList().filter(item=>kinds.includes(item.kind)).length;
  try{
    if(cabinet){
      place(cabinet);
      const kinds=[[/\bpulls?\b|knob/i,['pull','knob'],'pull'],[/catch/i,['catch'],'catch'],[/hinge/i,['butt','strap','cup','piano'],'hinge']];
      for(const[words,ofKind,name]of kinds){
        if(!inModel(ofKind))continue;
        const before=total(words);
        if(before!==inModel(ofKind)){wrong(`(setting up) the Base cabinet lists ${before} ${name}s with ${inModel(ofKind)} in the model`);continue;}
        removeHardware([hardwareList().find(item=>ofKind.includes(item.kind)).id]);
        commit();
        if(total(words)!==before-1)wrong(`with one ${name} deleted from the Base cabinet the list still counts ${total(words)}, not ${before-1}: ${JSON.stringify(listed(words))}`);
        if(listed(words).length>1)wrong(`the ${name}s of the Base cabinet are on the list under two names: ${JSON.stringify(listed(words))}`);
      }
      // Unfasten of a door takes its hinges off the list as well
      place(cabinet);
      const hinges=total(/hinge/i);
      sel=new Set([S.parts.find(p=>p.name==='Door').id]);
      unfastenSel();   // answered yes at once while the self-check runs
      if(total(/hinge/i)!==hinges-2||listed(/hinge/i).length>1)wrong(`after Unfasten of one door the list counts ${total(/hinge/i)} hinges in ${listed(/hinge/i).length} rows (it had ${hinges})`);
      // what is listed and not placed stays, and a copy of the whole cabinet needs it again
      place(cabinet);
      const plain=rows().filter(row=>(S.hw||[]).some(line=>line[0]===row[0]));
      if(!plain.length)wrong('(setting up) the Base cabinet lists nothing but what it places');
      else{
        sel=new Set(S.parts.map(p=>p.id));
        dupSel();
        const twice=rows().find(row=>row[0]===plain[0][0]);
        if(!twice||twice[1]!==2*plain[0][1])wrong(`two cabinets need "${plain[0][0]}" twice: the list says ${twice?twice[1]:0}, one cabinet needs ${plain[0][1]}`);
      }
    }
    if(nightstand){
      place(nightstand);
      const pairs=total(/slide/i);
      removeHardware(movers()[0].items.map(item=>item.id));
      commit();
      if(total(/slide/i)!==pairs-1||listed(/slide/i).length>1)wrong(`with the slides of one drawer deleted the Nightstand lists ${total(/slide/i)} pairs in ${listed(/slide/i).length} rows (it had ${pairs})`);
    }
  }finally{
    load(JSON.stringify(blank()),true);
    setTab(tabKept);
    try{
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
      else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* Every preset as Create places it (its usual sizes, and every choice that gives it a door or a lid) passes Check
   my design with the hardware that is really in the design, exactly as it passed the preset rule before it was
   placed. So the two ways of checking, with the hardware assumed and with the hardware drawn, never disagree
   about a preset. */
SELFTESTS.push(function presetsPassAsPlaced(problems){
  const tabKept=tab;
  let presetKept=null;
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  let placed=0;
  try{
    for(const variant of presetVariants()){   // js/fasteners.js
      let parts=[];
      try{parts=variant.preset.build(variant.vals);}catch(e){}
      if(!parts.length)continue;
      const usual=variant.name===variant.preset.name;
      if(!usual&&!parts.some(p=>DOOR_NAMES.test(p.name)))continue;
      if(checkPreset(variant.preset,variant.vals,parts).problems.length)continue;   // the preset rule reports those itself
      load(JSON.stringify(blank()),true);
      placePreset(variant.preset,variant.vals,parts,false);
      placed++;
      const found=verifyDesign(S.parts,designCheckOptions()).problems;
      if(found.length)problems.push(`holds: ${variant.name} passes the preset rule, but once it is placed Check my design says: ${found[0].text}`);
    }
    if(placed<PRESETS.length)problems.push(`holds: only ${placed} presets could be placed and checked`);
  }finally{
    load(JSON.stringify(blank()),true);
    setTab(tabKept);
    try{
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
      else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
