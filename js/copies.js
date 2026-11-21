/* NominalCAD: what a copy keeps from its original.

   Duplicate, Duplicate and drag, Copy in a row and Mirror all make their copies through addCopies(), so that every
   kind of copy behaves the same way:

     Components   A component that is copied whole becomes a new component with the same subcomponents:
                  "Workbench" gives "Workbench 2". A copy of only some pieces of a component stays in that
                  component, next to its original.
     Connections  The copies are fastened among themselves exactly as the originals are: every choice stored
                  for two originals (a fastener picked by hand, or "Not joined") is stored for their two copies too.
                  A copy is not tied to its original. If it lands touching it, the Auto-fasten switch decides,
                  like for any two pieces that end up touching (js/connections.js).
     Hardware     What is mounted on the originals is mounted on the copies (copyHardware, js/hardware.js).
     The check    What a preset declared for Check my design goes along (copySets below). */
'use strict';

/* What a preset declared for Check my design (S.sets, under the number its pieces carry as piece.set). A placement
   that is copied whole becomes a placement of its own with the same declarations, so the copy has its own wall
   and is judged by itself. A copy of only some of its pieces stays in the placement of its originals.
   Call it before the clones are added to the design. */
function copySets(sources,clones){
  const sets=S.sets;
  if(!sets||typeof sets!=='object')return;
  const copied=new Map();   // set number -> how many of its pieces were copied
  for(const p of sources){
    if(p.set!==undefined&&p.set!==null&&sets[p.set])copied.set(p.set,(copied.get(p.set)||0)+1);
  }
  if(!copied.size)return;
  const inDesign=new Map(); // set number -> how many pieces it has
  for(const p of S.parts){
    if(copied.has(p.set))inDesign.set(p.set,(inDesign.get(p.set)||0)+1);
  }
  for(const[number,count]of copied){
    if(count<inDesign.get(number))continue;
    const twin=S.nextSet=(S.nextSet||0)+1;
    sets[twin]=JSON.parse(JSON.stringify(sets[number]));
    // what the preset lists and does not place (the screws into the wall) is needed once more for the copy
    if(Array.isArray(sets[number].hw)&&sets[number].hw.length)S.hw=(S.hw||[]).concat(JSON.parse(JSON.stringify(sets[number].hw)));
    clones.forEach((clone,i)=>{
      if(sources[i].set===number)clone.set=twin;
    });
  }
}

/* A unit placed with a design (one chair of a Dining table with Chairs to match: p.unit, js/chairsets.js) that is
   copied whole, while its placement is not, becomes a unit of its own: "Dining chair 7" beside "Dining chair 1".
   Without that the copy and its original would share one unit, and be taken for one chair (its middle, its
   inside faces, its steps). A copy of only some pieces of a unit stays in that unit, as with components.
   Call it after copySets (a placement copied whole keeps its unit names: its set number tells them apart). */
function copyUnits(sources,clones){
  const copied=new Map();   // set|unit -> how many of its pieces were copied
  sources.forEach((p,i)=>{
    if(typeof p.unit!=='string'||clones[i].set!==p.set)return;
    const key=p.set+'|'+p.unit;
    copied.set(key,(copied.get(key)||0)+1);
  });
  if(!copied.size)return;
  const taken=new Set(S.parts.filter(p=>typeof p.unit==='string').map(p=>p.set+'|'+p.unit));
  const renamed=new Map();
  for(const[key,count]of copied){
    const[set,unit]=[key.slice(0,key.indexOf('|')),key.slice(key.indexOf('|')+1)];
    if(count<S.parts.filter(p=>String(p.set)===set&&p.unit===unit).length)continue;
    const stem=unit.replace(/\s*\d+$/,'');
    let n=1;
    while(taken.has(`${set}|${stem} ${n}`))n++;
    taken.add(`${set}|${stem} ${n}`);
    renamed.set(key,`${stem} ${n}`);
  }
  sources.forEach((p,i)=>{
    const key=p.set+'|'+p.unit;
    if(renamed.has(key)&&clones[i].set===p.set)clones[i].unit=renamed.get(key);
  });
}

/* sources: the pieces that were copied.  clones: their copies, in the same order, not yet in the design.
   Adds the clones to the design and returns their ids. Call commit() afterwards. */
function addCopies(sources,clones){
  const index=compIndex(),picked=new Set(sources.map(p=>p.id));

  // is every piece of this component, at every level, among the pieces that were copied?
  const wholeMemo=new Map();
  const whole=node=>{
    if(!wholeMemo.has(node.comp.id))wholeMemo.set(node.comp.id,node.pieces.every(p=>picked.has(p.id))&&node.kids.every(whole));
    return wholeMemo.get(node.comp.id);
  };
  // the copy of a whole component, made the first time it is asked for
  const twins=new Map();
  const twinOf=node=>{
    if(twins.has(node.comp.id))return twins.get(node.comp.id);
    const above=node.comp.parent==null?null:index.nodes.get(node.comp.parent);
    let twin;
    if(above&&whole(above))twin=newComp(node.comp.name,twinOf(above).id);          // inside a copied component: same name
    else twin=newComp(freeCompName(node.comp.name,node.comp.parent),node.comp.parent); // beside its original: "Workbench 2"
    twins.set(node.comp.id,twin);
    return twin;
  };
  clones.forEach((clone,i)=>{
    const node=index.ofPiece.get(sources[i].id);
    if(node&&whole(node))clone.comp=twinOf(node).id;
  });
  // a copied component may hold nothing but subcomponents: make its copy too, so the levels stay the same
  for(const node of index.nodes.values()){
    if(node.count&&whole(node))twinOf(node);
  }

  copySets(sources,clones);
  copyUnits(sources,clones);
  const ids=addParts(clones);

  const copyOf=new Map(sources.map((p,i)=>[p.id,ids[i]]));
  for(const key of Object.keys(S.joints)){
    const dash=key.indexOf('-'),idA=+key.slice(0,dash),idB=+key.slice(dash+1);
    if(copyOf.has(idA)&&copyOf.has(idB))S.joints[copyOf.get(idA)+'-'+copyOf.get(idB)]=S.joints[key];
  }
  // and what the preset named for two originals (S.named, js/joints.js) is named for their two copies
  for(const key of Object.keys(S.named||{})){
    const dash=key.indexOf('-'),idA=+key.slice(0,dash),idB=+key.slice(dash+1);
    if(copyOf.has(idA)&&copyOf.has(idB))S.named[copyOf.get(idA)+'-'+copyOf.get(idB)]=S.named[key];
  }
  // and a joint that follows the style (S.styled, js/joints.js) follows it between the two copies too
  for(const key of Object.keys(S.styled||{})){
    const dash=key.indexOf('-'),idA=+key.slice(0,dash),idB=+key.slice(dash+1);
    if(copyOf.has(idA)&&copyOf.has(idB))S.styled[copyOf.get(idA)+'-'+copyOf.get(idB)]=S.styled[key];
  }
  // and the piece a preset said the screws go through (S.through, js/joints.js) is that piece's copy
  for(const key of Object.keys(S.through||{})){
    const dash=key.indexOf('-'),idA=+key.slice(0,dash),idB=+key.slice(dash+1);
    if(copyOf.has(idA)&&copyOf.has(idB)&&copyOf.has(S.through[key]))S.through[copyOf.get(idA)+'-'+copyOf.get(idB)]=copyOf.get(S.through[key]);
  }
  copyHardware(copyOf); // the hardware mounted on the originals is copied with them (js/hardware.js)
  bornTogether(ids);
  compsChanged();
  return ids;
}

SELFTESTS.push(function copiesKeepWhatTheyHad(problems){
  const wrong=text=>problems.push('copies: '+text);
  load(JSON.stringify(blank()),true);
  // two boards face to face, joined with dowels by hand, as one component
  const ids=addParts([mk('Board','1x4',[24,.75,3.5],[0,0,0]),mk('Board','1x4',[24,.75,3.5],[0,.75,0])]);
  const key=ids[0]+'-'+ids[1];
  S.joints[key]='dowel';
  const original=makeComponentOf(ids,'Pair');
  commit();
  if(!connGraph().byKey.has(key))wrong('two stacked boards are not seen as touching');

  sel=new Set(ids);
  dupSel();
  const copies=[...sel];
  if(copies.length!==2||copies.some(id=>ids.includes(id))){wrong('Duplicate did not select two new pieces');return;}
  if(S.joints[copies[0]+'-'+copies[1]]!=='dowel')wrong('the copies lost the fastener chosen for the originals');
  if(!fastenedSet([copies[0]]).has(copies[1]))wrong('the two copies are not fastened to each other');
  if(fastenedSet([copies[0]]).has(ids[0]))wrong('a copy is fastened to its original although they do not touch');
  const twin=compById(byId(copies[0]).comp);
  if(!twin||twin.id===original.id||twin.name!=='Pair 2'||byId(copies[1]).comp!==twin.id)wrong('the copy of a whole component is not a new component named "Pair 2": '+JSON.stringify(S.comps));

  // a row and a mirrored copy go the same way
  sel=new Set(ids);
  copyRow(2,2,20);
  if(S.comps.filter(comp=>/^Pair/.test(comp.name)).length!==4)wrong('Copy in a row did not make one new component per copy');
  sel=new Set(ids);
  mirrorSel(0,'hi',true);
  const mirrored=[...sel];
  if(S.joints[mirrored[0]+'-'+mirrored[1]]!=='dowel')wrong('a mirrored copy lost the fastener chosen for the originals');

  // a copy of one piece of a component stays in that component
  sel=new Set([ids[0]]);
  dupSel();
  if(byId([...sel][0]).comp!==original.id)wrong('the copy of one piece left the component of its original');
  if($('#toast'))$('#toast').classList.remove('on');
});

/* A copy that lands touching something is not fastened to it (rule 4 in js/connections.js), with Auto-fasten on:
   a duplicated leg that stands under the same top, a row of cabinets edge to edge, a mirrored copy against its
   original. Moving the copy leaves the original where it is, and Connect fastens the two when the person wants. */
SELFTESTS.push(function copiesStayFreeOfWhatTheyTouch(problems){
  const wrong=text=>problems.push('copies: '+text);
  const autoKept=autoFasten,selKept=sel;
  /* a top on two legs, wide enough for a copy of the left leg to stand under it too */
  const bench=()=>{
    load(JSON.stringify(blank()),true);
    const ids=addParts([mk('Leg','4x4',[3.5,20,3.5],[0,0,0]),mk('Leg','4x4',[3.5,20,3.5],[40,0,0]),mk('Top','2x6',[43.5,1.5,5.5],[0,20,0])]);
    commit();
    return ids;
  };
  const setsOf=()=>fastenedGroups().length;
  try{
    autoFasten=true;
    let[leg,,top]=bench();
    sel=new Set([leg]);
    dupSel();
    const copy=[...sel][0];
    if(!connGraph().byKey.has(top+'-'+copy))wrong('(setting up) the copy of the leg does not stand under the top');
    if(fastenedSet([copy]).size!==1)wrong('a duplicated leg that lands under the top was fastened to it at once');
    if(!/not fastened/.test($('#toast').textContent))wrong('Duplicate does not say that the copy touches a piece without being fastened to it');
    const legAt=byId(leg).pos[0];
    nudge(0,1);
    if(byId(leg).pos[0]!==legAt)wrong('moving the copy of a leg moved the original');
    connectAndFasten(byId(copy),byId(top));commit();
    if(!fastenedSet([copy]).has(top))wrong('Connect did not fasten a copy to the piece it stands under');

    // a row at the default distance (edge to edge) and a mirrored copy at the far edge: every copy is its own set
    [leg,,top]=bench();
    sel=new Set(S.parts.map(p=>p.id));
    const width=bbox(S.parts).hi[0]-bbox(S.parts).lo[0];
    copyRow(2,0,width);
    if(setsOf()!==3)wrong(`a row of three benches edge to edge is ${setsOf()} fastened sets, not three`);
    bench();
    sel=new Set(S.parts.map(p=>p.id));
    mirrorSel(0,'hi',true);
    if(setsOf()!==2)wrong(`a bench and its mirrored copy at the far edge are ${setsOf()} fastened sets, not two`);
    // the copies keep the connections among their own pieces
    if(fastenedSet([[...sel][0]]).size!==3)wrong('a mirrored copy lost the connections among its own pieces');
  }finally{
    autoFasten=autoKept;sel=selKept;
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* Copies against what a preset declared for the check (S.sets, piece.set) and against the hardware that holds:
   a duplicate, a row, a mirrored copy, a second design added beside the first, and Break apart. Every copy of a
   whole design is a placement of its own, its doors hang on their own hinges, and Check my design says about the
   lot what it said about the original. */
SELFTESTS.push(function copiesKeepTheirDeclarations(problems){
  const wrong=text=>problems.push('copies and sets: '+text);
  const tabKept=tab;
  let presetKept=null;   // placePreset remembers the preset it placed for the dialog; that must not change here
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const cabinet=PRESETS.find(p=>p.name==='Base cabinet with doors'),shelf=PRESETS.find(p=>p.name==='Bookshelf');
  if(!cabinet||!shelf){wrong('the Base cabinet or the Bookshelf preset is missing');return;}
  const place=(preset,add)=>{
    if(!add)load(JSON.stringify(blank()),true);
    const vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),add);
  };
  const everything=()=>new Set(S.parts.map(p=>p.id));
  const setCount=()=>new Set(S.parts.map(p=>p.set)).size;
  const findings=()=>verifyDesign(S.parts,designCheckOptions()).problems;
  /* after an operation that should have made `designs` cabinets out of one */
  const cabinetsAreWhole=(what,designs,hingesEach,allowTouching)=>{
    if(setCount()!==designs||Object.keys(S.sets).length<designs)wrong(`${what}: ${designs} designs should be ${designs} placements, but the pieces carry ${setCount()} set numbers`);
    if(holdPairs().length!==designs*hingesEach)wrong(`${what}: ${holdPairs().length} pairs of pieces are held by hinges, not ${designs*hingesEach}`);
    for(const door of S.parts.filter(p=>p.name==='Door')){
      const mover=moverOf(door.id);
      if(!mover||mover.stuck){wrong(`${what}: a door is not on working hinges`);break;}
      if(byId(mover.items[0].to).set!==door.set){wrong(`${what}: a door is hinged to a piece of another design`);break;}
      if(openReach(mover).hit&&!allowTouching){wrong(`${what}: a door hits ${openReach(mover).hit.other.name} when it opens`);break;}
    }
    const found=findings().filter(f=>f.level==='stop'||!allowTouching);
    if(found.length)wrong(`${what}: Check my design now says: ${found[0].text}`);
  };
  try{
    place(cabinet,false);
    const hingesEach=holdPairs().length;
    if(!hingesEach||findings().length){wrong('(setting up) the Base cabinet does not arrive with hinges and a clean check');return;}

    sel=everything();
    dupSel();
    cabinetsAreWhole('Duplicate',2,hingesEach);

    place(cabinet,false);
    sel=everything();
    copyRow(2,0,80);
    cabinetsAreWhole('Copy in a row',3,hingesEach);

    place(cabinet,false);
    sel=everything();
    mirrorSel(0,'hi',true);
    cabinetsAreWhole('Mirror with a copy',2,hingesEach,true);   // the two stand side by side and touch

    // a copy of some pieces only stays in the placement of its originals
    place(cabinet,false);
    sel=new Set([S.parts.find(p=>p.name==='Door').id]);
    dupSel();
    if(setCount()!==1)wrong('the copy of one door became a placement of its own');

    // a second design beside the first, then Break apart: the declarations stay with the pieces
    place(cabinet,false);
    place(shelf,true);
    if(setCount()!==2)wrong('Add beside the current design did not give the second design its own set number');
    const before=JSON.stringify(findings().map(f=>f.code)),pairsBefore=holdPairs().length;
    sel=everything();
    breakApart();
    if((S.comps||[]).length&&S.parts.every(p=>p.comp!=null))wrong('(setting up) Break apart left every piece in a component');
    if(setCount()!==2||holdPairs().length!==pairsBefore)wrong('Break apart changed the placements or the hinges of the pieces');
    if(JSON.stringify(findings().map(f=>f.code))!==before)wrong('Break apart changed what Check my design says');
    const side=S.parts.find(p=>p.name==='Side'&&p.set===S.parts.find(q=>q.name==='Door').set);
    if(!fastenedSet([side.id]).has(S.parts.find(p=>p.name==='Door').id))wrong('after Break apart a hinged door no longer moves with its cabinet');
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
