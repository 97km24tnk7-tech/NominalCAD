/* NominalCAD: components and subcomponents.

   A component is a named set of pieces that belong together: a workbench, a door, a drawer. A component can sit
   inside another one (a Door inside a Base cabinet); that makes it a subcomponent. This replaces the old flat
   groups (a number in p.grp), which are turned into components when an old project is opened.

   In the project
     S.comps     [{id, name, parent}]   parent is the id of the component it sits in, or null at the top
     p.comp      the id of the smallest component the piece is in (missing when it is in none)
     S.nextComp  the next free id

   Where components come from
     - A preset: all its pieces go into one component named after it (componentFromPreset, called from
       placePreset in js/app.js). A piece that a builder marked with a string field  sub  (sub:'Door') goes into
       a subcomponent of that name. Builders that do not mark their pieces yet are covered by SUB_BY_NAME below.
     - By hand: select pieces, Make component (Shift+M). Break apart (Shift+B) removes one level.
     - Copies: a copy of a whole component is a new component (js/copies.js).

   What the rest of the program calls
     compIndex()               the tree, built once per change: {nodes, roots, loose, ofPiece}
                                 a node is {comp, kids (nodes), pieces (its own pieces), count (pieces with all levels below)}
     compChain(pieceId)        the components a piece is in, smallest first
     compPieceIds(compId)      ids of every piece in a component, subcomponents included
     selectedComponent()       the component that is selected as a whole, or null
     selectComponent(compId)   select all pieces of a component that are not hidden
     pickIds(pieceId)          what a click on a piece selects: the piece, or its component (the Pick switch)
     pickAgain(pieceId)        a second click on a selected piece: step up to the parent component
     makeComponentOf(ids, name)   make a component from pieces; returns it. Call commit() afterwards.
     newComp(name, parentId)   add an empty component; returns it
     compsChanged()            call after changing S.comps or p.comp by hand, so the tree is worked out again */
'use strict';

/* pieces from builders that do not say which subcomponent they belong to: a name that starts with one of these
   words puts the piece in the subcomponent on the right. A "Door stile" is not part of a door: it is the post of
   the frame where two doors meet (the fish racks' cabinet base), screwed to the frame, and in the Doors it was
   freed from the frame with them when they were hung (it was then held by nothing). */
const SUB_BY_NAME=[[/^(shed )?door\b(?! stile\b)/i,'Doors'],[/^lid\b/i,'Lid'],[/^drawer\b/i,'Drawers']];

/* ---------- the tree ---------- */
let compIndexCache=null;
function compsChanged(){compIndexCache=null;}
function compIndex(){
  const c=compIndexCache,comps=S.comps||[];
  if(c&&c.parts===S.parts&&c.pieceCount===S.parts.length&&c.comps===comps&&c.compCount===comps.length)return c;
  const nodes=new Map(),roots=[],loose=[],ofPiece=new Map();
  for(const comp of comps)nodes.set(comp.id,{comp,kids:[],pieces:[],count:0});
  for(const node of nodes.values()){
    const parent=node.comp.parent==null?null:nodes.get(node.comp.parent);
    if(parent)parent.kids.push(node);else roots.push(node);
  }
  for(const p of S.parts){
    const node=p.comp==null?null:nodes.get(p.comp);
    if(node){node.pieces.push(p);ofPiece.set(p.id,node);}
    else loose.push(p);
  }
  const countIn=node=>{
    node.count=node.pieces.length;
    for(const kid of node.kids)node.count+=countIn(kid);
    return node.count;
  };
  roots.forEach(countIn);
  compIndexCache={nodes,roots,loose,ofPiece,parts:S.parts,pieceCount:S.parts.length,comps,compCount:comps.length};
  return compIndexCache;
}
const compById=id=>{const node=compIndex().nodes.get(id);return node?node.comp:null;};
function compChain(pieceId){
  const index=compIndex(),chain=[];
  let node=index.ofPiece.get(pieceId);
  while(node){
    chain.push(node.comp);
    node=node.comp.parent==null?null:index.nodes.get(node.comp.parent);
  }
  return chain;
}
function compPieceIds(compId){
  const ids=[],start=compIndex().nodes.get(compId);
  const collect=node=>{
    for(const p of node.pieces)ids.push(p.id);
    node.kids.forEach(collect);
  };
  if(start)collect(start);
  return ids;
}
/* is the piece inside this component, at any depth? */
function pieceIsIn(pieceId,compId){
  return compChain(pieceId).some(comp=>comp.id===compId);
}

/* ---------- keeping the data sound ---------- */
function newComp(name,parentId){
  if(!Array.isArray(S.comps))S.comps=[];
  const used=S.comps.reduce((most,comp)=>Math.max(most,comp.id),0);
  const comp={id:Math.max(S.nextComp||1,used+1),name,parent:parentId==null?null:parentId};
  S.nextComp=comp.id+1;
  S.comps.push(comp);
  compsChanged();
  return comp;
}
/* a name no other component beside it has: "Workbench", then "Workbench 2", "Workbench 3" */
function freeCompName(name,parentId){
  const taken=new Set((S.comps||[]).filter(comp=>(comp.parent==null?null:comp.parent)===(parentId==null?null:parentId)).map(comp=>comp.name));
  if(!taken.has(name))return name;
  const base=name.replace(/ \d+$/,'');
  for(let n=2;;n++){
    if(!taken.has(base+' '+n))return base+' '+n;
  }
}
/* Makes the component data safe to use whatever was in the project: old groups become components, a component
   whose parent is gone moves to the top, a piece whose component is gone is in none, and a component that holds
   no piece at any level is removed. Runs when a project is read and before every commit. */
function tidyComps(){
  if(!Array.isArray(S.comps))S.comps=[];
  // old projects: every group number becomes a component
  const fromGroup=new Map();
  for(const p of S.parts){
    if(p.grp==null)continue;
    if(p.comp==null){
      if(!fromGroup.has(p.grp))fromGroup.set(p.grp,newComp('Group '+p.grp,null));
      p.comp=fromGroup.get(p.grp).id;
    }
    delete p.grp;
  }
  delete S.nextGrp;

  const known=new Map(); // id -> component
  S.comps=S.comps.filter(comp=>comp&&typeof comp.id==='number'&&!known.has(comp.id)&&(known.set(comp.id,comp),true));
  for(const comp of S.comps){
    if(typeof comp.name!=='string'||!comp.name.trim())comp.name='Component';
    if(comp.parent!=null&&!known.has(comp.parent))comp.parent=null;
    // a component can never sit inside itself, however far down
    const seen=new Set([comp.id]);
    for(let up=comp.parent;up!=null;up=known.get(up).parent){
      if(seen.has(up)){comp.parent=null;break;}
      seen.add(up);
    }
  }
  // which components hold a piece, at any level
  const used=new Set();
  for(const p of S.parts){
    if(p.comp==null)continue;
    if(!known.has(p.comp)){delete p.comp;continue;}
    for(let up=p.comp;up!=null&&!used.has(up);up=known.get(up).parent)used.add(up);
  }
  if(used.size!==S.comps.length)S.comps=S.comps.filter(comp=>used.has(comp.id));
  compsChanged();
}
ON_LOAD.push(tidyComps);
ON_COMMIT.push(tidyComps);

/* ---------- the Pick switch in the status bar: does a click select one piece, or its component? ---------- */
const PICK_KEY='woodshop.pick';
let pickChoice='piece'; // what the switch says, 'piece' or 'comp'; it is only shown in Expert
try{if(localStorage.getItem(PICK_KEY)==='comp')pickChoice='comp';}catch(e){}
let pickLevel=pickChoice; // what is in force: always 'piece' in Beginner, where the switch is hidden
let pickedComp=null;   // the component that was selected as a whole (by a click at component level, or its row in the Pieces panel)
function setPickLevel(level){
  pickLevel=pickChoice=level==='comp'?'comp':'piece';
  try{localStorage.setItem(PICK_KEY,pickLevel);}catch(e){}
  syncPickLevel();
  renderStatus();
}
function syncPickLevel(){
  document.querySelectorAll('#pickSeg [data-pick]').forEach(b=>b.classList.toggle('on',b.dataset.pick===pickLevel));
}
$('#pickSeg').addEventListener('click',e=>{
  const button=e.target.closest('[data-pick]');
  if(button)setPickLevel(button.dataset.pick);
});
syncPickLevel();
/* In Beginner a click always picks one piece; a second click on it, or its row in the Pieces panel, picks the
   component. (The page level and the pick level are two different things; both happen to be called level.) */
ON_LEVEL.push(pageLevel=>{
  pickLevel=pageLevel==='beginner'?'piece':pickChoice;
  syncPickLevel();
});

/* the pieces of a component that can be seen, as ids */
function visibleIdsOf(compId){
  return compPieceIds(compId).filter(id=>!hiddenIds.has(id));
}
/* is the selection exactly this component (all of its pieces that are not hidden)? */
function selectionIs(compId){
  const node=compIndex().nodes.get(compId);
  if(!node||!sel.size||sel.size>node.count)return false;
  let hiddenInside=0;
  for(const id of hiddenIds){
    if(!sel.has(id)&&pieceIsIn(id,compId))hiddenInside++;
  }
  if(sel.size!==node.count-hiddenInside)return false;
  for(const id of sel){
    if(!pieceIsIn(id,compId))return false;
  }
  return true;
}
function selectedComponent(){
  if(!sel.size)return null;
  if(pickedComp!=null&&selectionIs(pickedComp))return compById(pickedComp);
  if(sel.size<2)return null; // one piece is a piece, unless its component was picked on purpose
  // otherwise: the largest component whose pieces are exactly the selection
  const chain=compChain(sel.values().next().value);
  for(let i=chain.length-1;i>=0;i--){
    if(selectionIs(chain[i].id))return chain[i];
  }
  return null;
}
function selectComponent(compId,add){
  const ids=visibleIdsOf(compId);
  if(!ids.length){toast('Every piece of this component is hidden. Click the eye on its row to show it.');return;}
  if(add)ids.forEach(id=>sel.add(id));else sel=new Set(ids);
  pickedComp=add?null:compId;
  renderAll();
}
function pickIds(pieceId){
  const chain=pickLevel==='comp'?compChain(pieceId):[];
  if(!chain.length){
    if(!sel.has(pieceId))pickedComp=null;
    return[pieceId];
  }
  if(!sel.has(pieceId))pickedComp=chain[0].id;
  const ids=visibleIdsOf(chain[0].id);
  return ids.includes(pieceId)?ids:ids.concat(pieceId);
}
function pickAgain(pieceId){
  if(pickLevel!=='comp')return;
  const chain=compChain(pieceId);
  let at=chain.findIndex(comp=>comp.id===pickedComp);
  if(at<0||!selectionIs(pickedComp)){
    at=-1;
    for(let i=chain.length-1;i>=0;i--){
      if(selectionIs(chain[i].id)){at=i;break;}
    }
  }
  if(at<0||at+1>=chain.length)return; // the selection is something else, or this is already the top component
  selectComponent(chain[at+1].id);
  toast(`Selected ${chain[at+1].name}, the component that ${chain[at].name} is part of.`);
}

/* ---------- making and breaking components ---------- */
/* Make one component from these pieces. It goes inside the smallest component that already holds all of them.
   A component that is selected whole moves in as a subcomponent; a piece taken from a component that is only
   partly selected leaves that component. */
function makeComponentOf(ids,name){
  const index=compIndex(),picked=new Set(ids);
  if(!picked.size)return null;
  // the smallest component that holds every picked piece
  let common=null;
  for(const id of picked){
    const chain=compChain(id).map(comp=>comp.id);
    common=common===null?chain:common.filter(compId=>chain.includes(compId));
    if(!common.length)break;
  }
  const outer=common&&common.length?common[0]:null;
  const fresh=newComp(freeCompName(name,outer),outer);
  const pieceOf=new Map(S.parts.map(p=>[p.id,p]));
  const wholeMemo=new Map(); // component id -> is every piece of it picked? (asked once per component, not once per piece)
  const whole=node=>{
    if(!wholeMemo.has(node.comp.id))wholeMemo.set(node.comp.id,node.pieces.every(p=>picked.has(p.id))&&node.kids.every(whole));
    return wholeMemo.get(node.comp.id);
  };
  for(const id of picked){
    // the highest component below "outer" that this piece is in
    const below=[];
    for(const comp of compChain(id)){
      if(comp.id===outer||comp.id===fresh.id)break;
      below.push(comp);
    }
    const top=below[below.length-1];
    if(top&&whole(index.nodes.get(top.id)))top.parent=fresh.id;
    else pieceOf.get(id).comp=fresh.id;
  }
  compsChanged();
  return fresh;
}
/* the first word the names of these pieces share ("Door rail", "Door stile" give "Door"), or '' */
function sharedFirstWord(parts){
  const words=new Set(parts.map(p=>p.name.trim().split(/\s+/)[0].toLowerCase()));
  if(words.size!==1)return'';
  const word=parts[0].name.trim().split(/\s+/)[0];
  return word.length>2?word[0].toUpperCase()+word.slice(1):'';
}
function suggestCompName(parts){
  const word=sharedFirstWord(parts);
  if(word&&!parts.every(p=>p.name===parts[0].name))return word;
  return'Component '+((S.comps||[]).length+1);
}
/* the Make component command: ask for the name, then make it */
function makeComponent(){
  if(tab!=='design')setTab('design');
  if(!sel.size){toast('Select the pieces that belong together first.');return;}
  const field=$('#compName');
  field.value=suggestCompName(selParts());
  field.classList.remove('bad');
  $('#compDlg').showModal();
  field.select();
}
$('#bCompGo').onclick=()=>{
  const field=$('#compName'),name=field.value.trim();
  field.classList.toggle('bad',!name);
  if(!name){field.focus();return;}
  field.blur(); // so that the next key (Shift+B, M, U) goes to the design and not to this box
  $('#compDlg').close();
  const made=makeComponentOf([...sel],name);
  if(!made)return;
  pickedComp=made.id;
  commit();
  toast(`${made.name} is now a component. Set Pick to Component in the status bar to select it with one click.`);
};
/* Break apart: remove one level. A component that is selected whole is dissolved: its pieces and subcomponents
   move up into the component it was in. Otherwise the selected pieces are taken out of their component, one level up. */
function breakApart(){
  if(!sel.size)return;
  const index=compIndex(),whole=new Map(),checked=new Map(); // checked: component id -> is it selected whole?
  const isWhole=comp=>{
    if(!checked.has(comp.id))checked.set(comp.id,compPieceIds(comp.id).every(pieceId=>sel.has(pieceId)||hiddenIds.has(pieceId)));
    return checked.get(comp.id);
  };
  for(const id of sel){
    // the largest component around this piece that is selected whole
    const chain=compChain(id);
    for(let i=chain.length-1;i>=0;i--){
      if(isWhole(chain[i])){whole.set(chain[i].id,chain[i]);break;}
    }
  }
  if(whole.size){
    for(const comp of whole.values()){
      const node=index.nodes.get(comp.id);
      for(const p of node.pieces){
        if(comp.parent==null)delete p.comp;else p.comp=comp.parent;
      }
      for(const kid of node.kids)kid.comp.parent=comp.parent;
    }
    S.comps=S.comps.filter(comp=>!whole.has(comp.id));
    const names=[...whole.values()].map(comp=>comp.name);
    pickedComp=null;
    compsChanged();
    commit();
    toast(names.length===1?`${names[0]} was broken apart. Its pieces are still there.`:`${names.length} components were broken apart. Their pieces are still there.`);
    return;
  }
  const inside=selParts().filter(p=>p.comp!=null&&index.nodes.has(p.comp));
  if(!inside.length){toast('Nothing in the selection is part of a component.');return;}
  for(const p of inside){
    const parent=index.nodes.get(p.comp).comp.parent;
    if(parent==null)delete p.comp;else p.comp=parent;
  }
  compsChanged();
  commit();
  toast(inside.length===1?`${inside[0].name} was taken out of its component.`:`${inside.length} pieces were taken out of their component.`);
}
function renameComponent(compId,name){
  const comp=compById(compId);
  name=String(name).trim();
  if(!comp||!name||name===comp.name)return false;
  comp.name=name;
  commit();
  return true;
}

/* ---------- presets ---------- */
/* The pieces a preset just added (ids) become one component named after the preset, with subcomponents for the
   pieces that carry  sub  or match SUB_BY_NAME. Called from placePreset before its commit. */
function componentFromPreset(presetName,ids){
  const added=new Set(ids),top=newComp(freeCompName(presetName,null),null),subs=new Map();
  for(const p of S.parts){
    if(!added.has(p.id))continue;
    let subName=typeof p.sub==='string'?p.sub.trim():'';
    delete p.sub; // it has done its job; the component remembers it from here on
    if(!subName&&!isProp(p)){
      const rule=SUB_BY_NAME.find(([pattern])=>pattern.test(p.name));
      if(rule)subName=rule[1];
    }
    if(!subName){p.comp=top.id;continue;}
    if(!subs.has(subName))subs.set(subName,newComp(subName,top.id));
    p.comp=subs.get(subName).id;
  }
  compsChanged();
  bornTogether(ids); // the pieces of a preset keep the fasteners it was designed with (js/connections.js)
  return top;
}

/* ---------- Properties panel, with a component selected ---------- */
function propsOfComponent(comp,ps){
  const b=bbox(ps),node=compIndex().nodes.get(comp.id),parent=comp.parent==null?null:compById(comp.parent);
  const hiddenInside=node.count-ps.length;
  const facts=[`${node.count.toLocaleString()} piece${node.count===1?'':'s'}`];
  if(node.kids.length)facts.push(`${node.kids.length} subcomponent${node.kids.length===1?'':'s'}`);
  if(hiddenInside>0)facts.push(`${hiddenInside} hidden`);
  return propsRow('Name',`<input class="fld" type="text" data-f="compName" data-comp="${comp.id}" value="${esc(comp.name)}">`)+
    propsNote(facts.join(', ')+(parent?`. Part of <b>${esc(parent.name)}</b>.`:'.'))+
    propsSection('Size')+
    propsNote(`<b>${fmtFt(b.hi[0]-b.lo[0])} wide × ${fmtFt(b.hi[2]-b.lo[2])} deep × ${fmtFt(b.hi[1]-b.lo[1])} tall</b>`)+
    propsSection('Component')+componentButtons();
}
const componentButtons=()=>`<div class="f3 even"><button class="btn t" data-cmd="makeComponent" title="Make one component of the selected pieces (Shift+M)">Make component</button>`+
  `<button class="btn t" data-cmd="breakApart" title="Remove one level: the pieces stay, the component goes (Shift+B)">Break apart</button></div>`;
/* one line for a piece that is inside a component: "Part of Base cabinet > Doors" */
function componentLine(p){
  const chain=compChain(p.id);
  if(!chain.length)return'';
  return propsNote('Part of '+chain.slice().reverse().map(comp=>`<b>${esc(comp.name)}</b>`).join(' › ')+'.');
}

/* ---------- checks ---------- */
SELFTESTS.push(function components(problems){
  const wrong=text=>problems.push('components: '+text);
  const levelKept=pickLevel,pickedKept=pickedComp;
  try{
    // an old project with groups opens with one component per group
    load(JSON.stringify({name:'Old',parts:[
      {id:1,name:'Leg',mat:'2x4',l:20,w:3.5,t:1.5,ax:[1,0,2],pos:[0,0,0],grp:1},
      {id:2,name:'Leg',mat:'2x4',l:20,w:3.5,t:1.5,ax:[1,0,2],pos:[30,0,0],grp:1},
      {id:3,name:'Rail',mat:'2x4',l:26.5,w:3.5,t:1.5,ax:[0,1,2],pos:[3.5,10,0],grp:2},
      {id:4,name:'Loose board',mat:'2x4',l:24,w:3.5,t:1.5,ax:[0,2,1],pos:[0,0,40]}],joints:{},nextId:5,nextGrp:2}),true);
    if(S.comps.length!==2||S.parts.some(p=>'grp' in p)||byId(1).comp!==byId(2).comp||byId(3).comp===byId(1).comp||byId(4).comp!=null)
      wrong('an old project with groups did not open as components: '+JSON.stringify(S.comps));

    // pick level: a click selects the smallest component, a second click steps up
    const legs=byId(1).comp;
    const outer=makeComponentOf([1,2,4],'Frame');
    commit();
    if(compById(legs).parent!==outer.id||byId(4).comp!==outer.id)wrong('Make component did not nest a whole component and a single piece under the new one');
    pickLevel='comp';pickedComp=null;sel=new Set();
    sel=new Set(pickIds(1));
    if([...sel].sort().join()!=='1,2')wrong('with Pick on Component, a click on a leg selected '+[...sel].join()+' and not its component (1,2)');
    pickAgain(1);
    if([...sel].sort().join()!=='1,2,4')wrong('a second click did not step up to the parent component: '+[...sel].join());
    if((selectedComponent()||{}).id!==outer.id)wrong('the parent component is not what Properties would show after stepping up');
    pickLevel='piece';
    if(pickIds(1).join()!=='1')wrong('with Pick on Piece, a click selected more than the piece');

    // the tree in the Pieces panel
    renderParts();
    const rows=document.querySelectorAll('#partList li[data-comp]');
    if(!rows.length)wrong('the Pieces panel shows no component rows');
    if(!document.querySelector('#partList li[data-id="4"]'))wrong('a piece inside an open component is missing from the Pieces panel');

    // break apart removes one level, and undo brings it back
    sel=new Set([1,2,4]);pickedComp=outer.id;
    breakApart();
    if(S.comps.some(comp=>comp.id===outer.id)||compById(legs).parent!=null||byId(4).comp!=null)wrong('Break apart did not remove exactly one level');
    undo();
    if(!S.comps.some(comp=>comp.id===outer.id))wrong('undo did not bring the component back');

    // Copy design as text and Paste design from text carry the components and the connection choices
    S.joints['1-3']='none';
    const read=readProject(designText());
    if(!read.project)wrong('the design with components could not be read back from its text');
    else{
      const compsBefore=JSON.stringify(S.comps),inComp=byId(4).comp;
      load(JSON.stringify(read.project),true);
      if(JSON.stringify(S.comps)!==compsBefore||byId(4).comp!==inComp)wrong('components did not come back the same through Copy design as text');
      if(S.joints['1-3']!=='none')wrong('a deleted connection did not come back as deleted through Copy design as text');
    }

    // deleting every piece of a component removes the component
    sel=new Set([1,2]);delSel();
    if(S.comps.some(comp=>comp.id===legs))wrong('a component with no pieces left was kept');

    // a preset arrives as one component, with a subcomponent for the pieces marked  sub
    load(JSON.stringify(blank()),true);
    const door=mk('Panel','ply34',[12,20,.75],[0,0,0]);
    door.sub='Door';
    const top=componentFromPreset('Cabinet',addParts([mk('Side','ply34',[.75,20,12],[20,0,0]),door,mk('Lid','ply34',[14,.75,12],[40,0,0])]));
    commit();
    const names=S.comps.map(comp=>comp.name+(comp.parent===top.id?' in Cabinet':'')).sort().join(', ');
    if(names!=='Cabinet, Door in Cabinet, Lid in Cabinet'||S.parts.some(p=>'sub' in p))wrong('a preset did not arrive as one component with its subcomponents: '+names);
    if($('#toast'))$('#toast').classList.remove('on');
  }finally{
    pickLevel=levelKept;pickedComp=pickedKept;syncPickLevel();
  }
});
