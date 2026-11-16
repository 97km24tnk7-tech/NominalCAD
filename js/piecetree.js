/* NominalCAD: the Pieces panel, as a tree.

   Components and subcomponents (js/components.js) are rows that open and close; the pieces are the leaves.
     a component row   chevron, name, how many pieces it holds, and an eye that hides or shows all of them
     a piece row       name, what it is cut from, its length, and its own eye
   Click a component row to select all its pieces, double-click its name to rename it, right-click any row for
   the usual menu. Ctrl + click adds to the selection or takes away from it.

   It stays quick with thousands of pieces because a closed component draws nothing below it, and the list never
   draws more than TREE_ROWS_MAX rows. A component starts open when it is at the top level and small; the big
   ones (a fish room wall) start closed. Opening and closing is remembered until the page is closed. */
'use strict';

const TREE_ROWS_MAX=400;   // rows drawn at most; the rest is one line saying how many more there are
const TREE_OPEN_UP_TO=60;  // a top-level component with this many pieces or fewer starts open
const treeOpen=new Map();  // component id -> true / false, once the person has opened or closed it

function treeIsOpen(node,depth){
  const chosen=treeOpen.get(node.comp.id);
  return chosen!==undefined?chosen:depth===0&&node.count<=TREE_OPEN_UP_TO;
}
/* for every component: how many of its pieces are selected, and how many are hidden */
function treeTallies(index){
  const selected=new Map(),hidden=new Map();
  const tally=(counts,ids)=>{
    for(const id of ids){
      for(let node=index.ofPiece.get(id);node;node=node.comp.parent==null?null:index.nodes.get(node.comp.parent)){
        counts.set(node.comp.id,(counts.get(node.comp.id)||0)+1);
      }
    }
  };
  tally(selected,sel);
  tally(hidden,hiddenIds);
  return{selected,hidden};
}
const TREE_EYE=hidden=>`<button class="eye" data-eye title="${hidden?'Show':'Hide'}">${icon(hidden?'i-hide':'i-eye','xs')}</button>`;

function renderParts(){
  const count=S.parts.length,list=$('#partList');
  $('#partCount').textContent=count||'';
  if(!count){
    list.innerHTML='<li class="note">Nothing here yet. Pick a furniture preset, or draw a board.</li>';
    return;
  }
  const index=compIndex(),{selected,hidden}=treeTallies(index),rows=[];
  let left=0; // rows that did not fit
  const room=()=>rows.length<TREE_ROWS_MAX;

  const pieceRow=(p,depth)=>{
    if(!room()){left++;return;}
    const isHidden=hiddenIds.has(p.id);
    rows.push(`<li data-id="${p.id}" style="--d:${depth}" class="${sel.has(p.id)?'on':''}${isHidden?' hid':''}">`+
      // the short name of the material (a pressure-treated board has a still shorter one for this list), the full one as its tip
      `<span title="${esc(p.name)}">${esc(p.name)}</span><span title="${esc(M[p.mat].name)}">${esc(M[p.mat].brief||M[p.mat].short)}</span><span class="num">${fmt(p.l)}</span>${TREE_EYE(isHidden)}</li>`);
    for(const row of hardwareTreeRows(p,depth+1)){ // the hardware mounted on it: js/hardwaretool.js
      if(room())rows.push(row);
    }
  };
  const compRow=(node,depth)=>{
    if(!node.count)return; // emptied a moment ago (a copy that was cancelled); it is removed at the next change
    if(!room()){left+=node.count;return;}
    const id=node.comp.id,open=treeIsOpen(node,depth),picked=selected.get(id)||0,gone=hidden.get(id)||0;
    const allPicked=picked>0&&picked===node.count-gone,allHidden=gone===node.count;
    rows.push(`<li data-comp="${id}" style="--d:${depth}" class="comp${open?' open':''}${allPicked?' on':picked?' part':''}${allHidden?' hid':''}">`+
      `<button class="tw" data-open title="${open?'Close':'Open'}" aria-expanded="${open}">${icon('i-chev','xs')}</button>`+
      `<span class="nm" title="${esc(node.comp.name)}. Double-click to rename.">${esc(node.comp.name)}</span>`+
      `<span class="num" title="Pieces in this component">${node.count.toLocaleString()}</span>${TREE_EYE(allHidden)}</li>`);
    if(!open)return;
    for(const kid of node.kids)compRow(kid,depth+1);
    for(const p of node.pieces)pieceRow(p,depth+1);
  };
  for(const node of index.roots)compRow(node,0);
  for(const p of index.loose)pieceRow(p,0);

  list.innerHTML=rows.join('')+
    (left?`<li class="note">${left.toLocaleString()} more piece${left===1?'':'s'} not listed. Close a component to make room, or click a piece in the 3D view.</li>`:'');
  // bring the selected row into view, so picking a piece in 3D also finds it in the list. The body of the panel
  // is what scrolls; the column headings stay at its top and cover that much of it.
  const row=list.querySelector('li.on')||list.querySelector('li.part');
  if(row){
    const scroller=list.parentElement,frame=scroller.getBoundingClientRect(),r=row.getBoundingClientRect();
    const top=frame.top+scroller.querySelector('.phead').offsetHeight;
    if(r.top<top)scroller.scrollTop-=top-r.top;
    else if(r.bottom>frame.bottom)scroller.scrollTop+=r.bottom-frame.bottom;
  }
}

/* ---------- clicks in the tree ---------- */
function treeToggleHidden(ids){
  const show=ids.length>0&&ids.every(id=>hiddenIds.has(id));
  for(const id of ids){
    if(show)hiddenIds.delete(id);
    else{hiddenIds.add(id);sel.delete(id);} // a hidden piece is never left selected: Delete must not remove what cannot be seen
  }
  renderAll();
}
$('#partList').addEventListener('click',e=>{
  const row=e.target.closest('li[data-id],li[data-comp]');
  if(!row||e.target.closest('input'))return;
  const ctrl=e.ctrlKey||e.metaKey,compId=row.dataset.comp?+row.dataset.comp:null;
  if(e.target.closest('[data-eye]')){
    treeToggleHidden(compId!==null?compPieceIds(compId):[+row.dataset.id]);
    return;
  }
  if(compId!==null){
    if(e.target.closest('[data-open]')){
      treeOpen.set(compId,!row.classList.contains('open'));
      renderParts();
      return;
    }
    // A double-click renames. The first click redraws the list (it selects the component), so the browser never
    // sees two clicks on the same row and sends no double-click of its own: the two clicks are matched up here.
    const now=performance.now(),second=!ctrl&&treeLastClick.comp===compId&&now-treeLastClick.time<DOUBLE_CLICK_MS;
    treeLastClick={comp:second?null:compId,time:now};
    if(second){renameInTree(compId);return;}
    if(ctrl&&row.classList.contains('on')){
      compPieceIds(compId).forEach(id=>sel.delete(id));
      renderAll();
    }else selectComponent(compId,ctrl);
    return;
  }
  const id=+row.dataset.id;
  if(hiddenIds.has(id)){toast('This piece is hidden. Click the eye on its row to show it.');return;}
  if(ctrl){sel.has(id)?sel.delete(id):sel.add(id);}
  else sel=new Set([id]);
  pickedComp=null; // a piece row always means that one piece, whatever the Pick switch says
  renderAll();
});
/* Double-click the name of a component: type a new one in its place. Enter keeps it, Esc leaves it as it was. */
const DOUBLE_CLICK_MS=450;
let treeLastClick={comp:null,time:0}; // the last component row that was clicked, and when
function renameInTree(compId){
  const row=document.querySelector(`#partList li[data-comp="${compId}"]`);
  const comp=compById(compId),name=row&&row.querySelector('.nm');
  if(!comp||!name)return;
  const field=document.createElement('input');
  field.className='fld s';
  field.value=comp.name;
  field.setAttribute('aria-label','Component name');
  name.replaceWith(field);
  field.focus();field.select();
  let done=false;
  const finish=keep=>{
    if(done)return;
    done=true;
    if(!(keep&&renameComponent(comp.id,field.value)))renderParts(); // renameComponent redraws everything when the name changed
  };
  field.addEventListener('keydown',ev=>{
    ev.stopPropagation(); // typing a name must not start M, R, S or delete the selection
    if(ev.key==='Enter')finish(true);
    else if(ev.key==='Escape')finish(false);
  });
  field.addEventListener('blur',()=>finish(true));
}
/* right-click a row: select it if it is not selected yet, then the same menu as in the 3D view */
$('#partList').addEventListener('contextmenu',e=>{
  const row=e.target.closest('li[data-id],li[data-comp]');
  if(!row||e.target.closest('input'))return;
  if(!row.classList.contains('on')){
    if(row.dataset.comp)selectComponent(+row.dataset.comp);
    else if(!hiddenIds.has(+row.dataset.id)){sel=new Set([+row.dataset.id]);pickedComp=null;renderAll();}
  }
  openContext(e.clientX,e.clientY,null);
});

SELFTESTS.push(function pieceTree(problems){
  const wrong=text=>problems.push('pieces panel: '+text);
  load(JSON.stringify(blank()),true);
  // a big component (closed by itself), a small one with a subcomponent, and a loose piece
  const many=[];
  for(let i=0;i<450;i++)many.push(mk('Slat','1x4',[20,.75,3.5],[0,i,0]));
  const big=addParts(many);
  const small=addParts([mk('Side','1x4',[20,.75,3.5],[40,0,0]),mk('Door rail','1x2',[10,.75,1.5],[40,5,0]),mk('Door stile','1x2',[10,.75,1.5],[40,8,0])]);
  addParts([mk('Loose board','2x4',[24,1.5,3.5],[80,0,0])]);
  const wall=makeComponentOf(big,'Wall'),cabinet=makeComponentOf(small,'Cabinet'),door=makeComponentOf(small.slice(1),'Door');
  commit();
  if(door.parent!==cabinet.id)wrong('a component made inside another did not become its subcomponent');
  const rowOf=comp=>document.querySelector(`#partList li[data-comp="${comp.id}"]`);
  const shown=()=>document.querySelectorAll('#partList li[data-id]').length;
  if(!rowOf(wall)||!rowOf(cabinet))wrong('component rows are missing');
  if(rowOf(wall)&&rowOf(wall).classList.contains('open'))wrong('a component of 450 pieces starts open');
  if(shown()!==2)wrong(`with the big component closed and the subcomponent closed, ${shown()} piece rows are drawn (expected 2: the side and the loose board)`);
  if(rowOf(wall)&&rowOf(wall).querySelector('.num').textContent!=='450')wrong('the component row does not show its piece count');

  // open the subcomponent, click a component row, hide with the eye
  rowOf(door).querySelector('[data-open]').click();
  if(shown()!==4)wrong('opening a subcomponent did not show its pieces');
  rowOf(cabinet).querySelector('.nm').click();
  if(sel.size!==3||(selectedComponent()||{}).id!==cabinet.id)wrong('clicking a component row did not select the component');
  rowOf(door).querySelector('[data-eye]').click();
  if(hiddenIds.size!==2||sel.size!==1)wrong('the eye of a component did not hide its pieces');
  rowOf(door).querySelector('[data-eye]').click();
  if(hiddenIds.size)wrong('the eye of a component did not show its pieces again');

  // rename by double-click: two clicks on the name, one after the other
  treeLastClick={comp:null,time:0};
  rowOf(cabinet).querySelector('.nm').click();
  rowOf(cabinet).querySelector('.nm').click();
  const field=document.querySelector('#partList li[data-comp] input');
  if(!field)wrong('double-clicking a component name did not open a box to rename it');
  else{
    field.value='Base cabinet';
    field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    if(cabinet.name!=='Base cabinet'&&(compById(cabinet.id)||{}).name!=='Base cabinet')wrong('renaming a component in the Pieces panel did not take');
  }
  // opening the big one draws at most TREE_ROWS_MAX rows
  treeOpen.set(wall.id,true);renderParts();
  if(document.querySelectorAll('#partList li').length>TREE_ROWS_MAX+1)wrong('the list drew more rows than its limit');
  treeOpen.delete(wall.id);treeOpen.delete(door.id);
  if($('#toast'))$('#toast').classList.remove('on');
});
