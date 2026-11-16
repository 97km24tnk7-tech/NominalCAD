/* NominalCAD: working with hardware by hand.

   Adding     Ribbon, Add group, Hardware: pick a kind, then click a piece. While the pointer is over a piece a
              blue preview shows where it will sit; it snaps to the middle of the face and to round distances
              from its edges. A hinge kind hangs the clicked door or lid (hangDoor), a slide kind puts the
              clicked drawer on slides (mountSlides): those two need a second piece, which the helper finds.
   Picking    Click a piece of hardware in the 3D view, or its row in the Pieces panel (it is listed under the
              piece it is mounted on). Properties then shows its size, where it sits, how to mount it, and Delete.
   Sliding    Drag a picked piece of hardware to slide it over the face it sits on. A hinge only slides along
              its edge, a drawer slide only up and down.
   Deleting   The Delete key or the Delete button. The last hinge or slide between two pieces is a connection,
              so that one asks first, like Unfasten.

     placingHardware            the kind waiting for a click, or null
     startPlacing(kind)         what the pulldown calls
     placeHardwareClick(event)  the canvas asks this first when the left button goes down (js/tools.js)
     propsHardware(ps)          the Hardware section in the Properties of a selected piece
     hardwareTreeRows(p, depth) the rows of the Pieces panel for the hardware on piece p (js/piecetree.js) */
'use strict';

let placingHardware=null;
const HW_SNAP_REACH=.4;                   // inches: how near a snap line the pointer must be
const HW_EDGE_STEPS=[1,1.5,2,2.5,3,4];    // round distances from an edge that hardware snaps to
const ghostGroup=new THREE.Group();
scene.add(ghostGroup);

/* ---------- the Hardware pulldown ---------- */
function fillHardwareMenu(){
  const groups=new Map();
  for(const[key,kind]of Object.entries(HARDWARE)){
    if(!groups.has(kind.group))groups.set(kind.group,[]);
    groups.get(kind.group).push(`<button class="mi" data-hw-kind="${key}" title="${esc(kind.mount)}"><i></i><span>${esc(kind.name)}</span><kbd></kbd></button>`);
  }
  $('#hardwareMenu').innerHTML=
    `<button class="mi" data-cmd="hang" title="Hinges on the edge next to the frame, a pull on the far side and a catch, in one go">${icon('i-hinge')}<span>Hang this door or lid&hellip;</span><kbd></kbd></button>`+
    `<button class="mi" data-cmd="drawer" title="Builds a drawer to fit the space you click inside, on a pair of slides, with a pull">${icon('i-hardware')}<span>Add a drawer&hellip;</span><kbd></kbd></button>`+
    `<button class="mi" data-cmd="slides" title="A pair of drawer slides (or wooden runners) between the selected drawer box and the cabinet sides, and a pull on its front">${icon('i-hardware')}<span>Mount this drawer on slides</span><kbd></kbd></button>`+
    [...groups.entries()].map(([name,rows])=>`<div class="msep"></div><div class="mhead">${esc(name)}</div>${rows.join('')}`).join('');
}
fillHardwareMenu();
$('#hardwareMenu').addEventListener('click',e=>{
  const row=e.target.closest('[data-hw-kind]');
  if(row)startPlacing(row.dataset.hwKind);
});
function startPlacing(kind){
  if(tab!=='design')setTab('design');
  if(!S.parts.length){toast('Add a piece first: hardware is mounted on a piece.');return;}
  setTool('select');
  placingHardware=kind;
  cv.style.cursor='crosshair';
  renderStatus();
}
function stopPlacing(){
  placingHardware=null;
  clearGhost();
  cv.style.cursor='';
  renderStatus();
  draw();
}
function clearGhost(){
  while(ghostGroup.children.length)ghostGroup.children.pop().material.dispose();
}

/* ---------- where the pointer puts it ---------- */
/* one coordinate on a face: the middle, a round distance from either edge, or the nearest quarter inch */
function snapOnFace(value,half,free){
  if(free)return value;
  const lines=[0];
  for(const step of HW_EDGE_STEPS){
    if(half-step>.25)lines.push(half-step,step-half);
  }
  let best=null;
  for(const line of lines){
    if(Math.abs(line-value)<=HW_SNAP_REACH&&(best===null||Math.abs(line-value)<Math.abs(best-value)))best=line;
  }
  return best!==null?best:Math.round(value*4)/4;
}
/* The item a click here would make, or null when the pointer is not on a piece. Not added to the design. */
function hardwareUnderPointer(e){
  const hit=pick(e);
  if(!hit||!hit.face)return null;
  const piece=byId(hit.object.userData.id);
  if(!piece||isProp(piece))return null;
  const normal=hit.face.normal,axis=[0,1,2].reduce((most,k)=>Math.abs(normal.getComponent(k))>Math.abs(normal.getComponent(most))?k:most,0);
  // the point in the piece's own frame (this also holds while the piece is drawn swung open or pulled apart)
  const sign=normal.getComponent(axis)>0?1:-1,half=size(piece).map(v=>v/2),at=hit.object.worldToLocal(hit.point.clone()).toArray();
  const others=[0,1,2].filter(k=>k!==axis);
  at[axis]=sign*half[axis];
  for(const k of others)at[k]=Math.max(-half[k],Math.min(half[k],snapOnFace(at[k],half[k],e.altKey)));
  const along=half[others[0]]>=half[others[1]]?others[0]:others[1]; // its length runs the long way of the face
  const n=[0,0,0],u=[0,0,0];
  n[axis]=sign;u[along]=1;
  return{piece,item:{id:0,kind:placingHardware,size:HARDWARE[placingHardware].size,on:piece.id,to:null,at,n,u,geo:{}}};
}
function showGhost(e){
  clearGhost();
  const kind=HARDWARE[placingHardware];
  if(!kind||kind.motion||tool!=='select'){draw();return;}
  const found=hardwareUnderPointer(e);
  if(found){
    const where=pieceFrame(found.piece).multiply(hardwareMatrix(found.item));
    for(const part of['on','to']){
      const shape=hardwareShape(found.item,part);
      if(!shape)continue;
      const mesh=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:VIEW_COL.sel,transparent:true,opacity:.6,depthTest:false}));
      mesh.matrixAutoUpdate=false;mesh.matrix.copy(where);mesh.renderOrder=8;
      ghostGroup.add(mesh);
    }
    const half=size(found.piece).map(v=>v/2),axis=found.item.n.findIndex(v=>v),others=[0,1,2].filter(k=>k!==axis);
    setPrompt(`<b>${esc(kind.name)}</b>On ${esc(found.piece.name)}, ${others.map(k=>fmt(r16(half[k]+found.item.at[k]))).join(' and ')} from its edges. Click to mount it. Alt turns snapping off. Esc stops.`,'i-hardware');
  }
  draw();
}
cv.addEventListener('pointermove',e=>{
  if(placingHardware&&!drag&&!modal)showGhost(e);
});
function placeHardwareClick(e){
  if(!placingHardware)return false;
  if(tool!=='select'||e.button!==0){stopPlacing();return false;}
  const kind=HARDWARE[placingHardware],hit=pick(e);
  if(!hit)return false; // empty space: the view turns as usual, and the tool keeps waiting
  const piece=byId(hit.object.userData.id);
  if(!piece||isProp(piece)){toast('Hardware goes on a wooden piece.');return true;}
  // A hinge hangs the clicked piece and a slide mounts the clicked drawer. Both take the piece off whatever it is
  // screwed to, so both ask first when it is fastened (hangByHand and mountByHand, js/hanging.js).
  if(kind.motion==='swing'){
    const options={kind:placingHardware,pull:false,catch:false};
    stopPlacing();
    hangByHand(piece,options,'Drag the blue ball to swing it open.');
    return true;
  }
  if(kind.motion==='slide'){
    const options={kind:placingHardware},plan=slidePlan([piece.id],options);
    stopPlacing();
    if(!plan.ok){showMessage('Could not fit drawer slides',plan.message);return true;}
    mountByHand(plan,()=>mountSlides([piece.id],options),'Drag the blue arrow to pull it out.',piece.id);
    return true;
  }
  const found=hardwareUnderPointer(e);
  if(!found)return true;
  const item=addHardware(found.item);
  stopPlacing();
  sel=new Set();
  commit();
  setPicked({type:'hw',id:item.id});
  toast(`${kind.name} mounted on ${piece.name}. Drag it to slide it along the piece.`);
  return true;
}
window.addEventListener('keydown',e=>{
  if(placingHardware&&e.key==='Escape'&&!document.querySelector('dialog[open]')){
    e.stopImmediatePropagation();
    stopPlacing();
  }
},true);

/* ---------- pointing at, picking and sliding ---------- */
function hardwareTip(item){
  const pieces=pieceMap(),host=pieces.get(item.on),other=item.to==null?null:pieces.get(item.to);
  const sizes=HARDWARE[item.kind].sizes.length>1?', '+sizeLabel(item):'';
  return`${HARDWARE[item.kind].name}${sizes}. On ${host?host.name:'a piece'}${other?`, holds it to ${other.name}`:''}.`;
}
/* puts the meshes of one item where the item is now, without drawing everything again */
function refreshHardwareMeshes(item){
  const pieces=pieceMap(),host=pieces.get(item.on),other=item.to==null?null:pieces.get(item.to);
  const inHost=hardwareMatrix(item);
  for(const mesh of hardwareMeshes){
    if(mesh.userData.hw!==item.id)continue;
    const onOther=other&&mesh.parent===meshes.get(other.id)&&mesh.parent!==meshes.get(host.id);
    mesh.matrix.copy(onOther?pieceFrame(other).invert().multiply(pieceFrame(host)).multiply(inHost):inHost);
  }
  draw();
}
function slideHardware(item,base){
  const host=pieceMap().get(item.on),kind=HARDWARE[item.kind],pose=hardwarePose(item);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(pose.n,pose.at),half=size(host).map(v=>v/2);
  const normalAxis=item.n.findIndex(v=>Math.abs(v)>.5),pinAxis=item.u.findIndex(v=>Math.abs(v)>.5);
  const start=item.at.slice();
  let grab=null; // where on the face the pointer took hold, so the hardware does not jump under it
  return{...base,mode:'custom',
    move(e){
      setRay(e);
      const hit=new THREE.Vector3();
      if(!ray.ray.intersectPlane(plane,hit))return;
      const point=toHostFrame(host,hit);
      if(!grab)grab=point.map((v,k)=>v-start[k]);
      for(let k=0;k<3;k++){
        if(k===normalAxis)continue;
        if(kind.motion==='swing'&&k!==pinAxis)continue;  // a hinge stays on its edge
        if(kind.motion==='slide'&&k===pinAxis)continue;  // a drawer slide only moves up and down
        const room=kind.motion==='swing'?half[k]:half[k];
        item.at[k]=clean(Math.max(-room,Math.min(room,snapOnFace(point[k]-grab[k],half[k],e.altKey))));
      }
      refreshHardwareMeshes(item);
      const others=[0,1,2].filter(k=>k!==normalAxis);
      setPrompt(`<b>Sliding ${esc(kind.name.toLowerCase())}</b>${others.map(k=>fmt(r16(half[k]+item.at[k]))).join(' and ')} from the edges of ${esc(host.name)}. Release to keep it. Alt turns snapping off.`);
    },
    up(d){
      if(d.moved)commit();
    }};
}
VIEW_PICKERS.push({
  early:false,
  find(){
    if(!hardwareMeshes.length)return null;
    const hit=ray.intersectObjects(hardwareMeshes)[0];
    if(!hit)return null;
    const item=hardwareById(hit.object.userData.hw);
    if(!item)return null;
    return{dist:hit.distance,tip:hardwareTip(item),through:woodMode!=='solid',
      press(e,base){
        setPicked({type:'hw',id:item.id});
        drag=slideHardware(item,base);
      }};
  },
});

/* ---------- a picked piece of hardware ---------- */
const HW_FROM=['From the left end','From the bottom','From the back']; // what a distance along each direction is measured from
function deleteHardware(item){
  const kind=HARDWARE[item.kind];
  const link=kind.motion&&item.to!=null?connGraph().byKey.get(`hw:${item.on}:${item.to}`):null;
  const others=hardwareList().filter(o=>o!==item&&o.on===item.on&&o.to===item.to&&HARDWARE[o.kind].motion);
  if(link&&!others.length){ // the last hinge or slide between the two: that is a connection, so ask
    askDeleteLinks([link],`${link.a.name} or ${link.b.name}`,`The ${kind.name.toLowerCase()} is removed. The two pieces are no longer held together.`);
    return;
  }
  removeHardware([item.id]);
  picked=null;
  commit();
  toast(`${kind.name} removed.`);
}
PICKED_KINDS.hw={
  exists:pick=>!!hardwareById(pick.id),
  prompt:pick=>`${hardwareTip(hardwareById(pick.id))} Drag it to slide it along the piece, or press Delete to remove it.`,
  remove(pick){
    const item=hardwareById(pick.id);
    if(item)deleteHardware(item);
  },
  props(pick){
    const item=hardwareById(pick.id);
    if(!item)return null;
    const kind=HARDWARE[item.kind],pieces=pieceMap(),host=pieces.get(item.on),other=item.to==null?null:pieces.get(item.to);
    const half=size(host).map(v=>v/2),normalAxis=item.n.findIndex(v=>Math.abs(v)>.5),pinAxis=item.u.findIndex(v=>Math.abs(v)>.5);
    const pieceButton=p=>`<button class="btn t" data-hw-piece="${p.id}" title="Select this piece">${esc(p.name)}</button>`;
    let html=hardwareTermLine(kind);   // in Beginner: one line that says what this thing is
    if(kind.sizes.length>1){
      const sizes=kind.sizes.map(([value,label])=>`<option value="${value}"${value===item.size?' selected':''}>${esc(label)}</option>`).join('');
      html+=propsRow('Size',`<select class="fld" data-hw-size>${sizes}</select>`);
    }else html+=propsRow('Size',`<span>${esc(kind.sizes[0][1])}</span>`);
    html+=propsRow('Mounted on',pieceButton(host),true)+(other?propsRow('Holds it to',pieceButton(other),true):'');
    // where it sits: a distance from the low end of the piece, for each direction it can slide in
    const canSlide=k=>k!==normalAxis&&!(kind.motion==='swing'&&k!==pinAxis)&&!(kind.motion==='slide'&&k===pinAxis);
    const cells=[0,2,1].filter(canSlide).map(k=>[HW_FROM[k],`<input class="fld" type="text" data-hw-at="${k}" value="${fa(r16(half[k]+item.at[k]))}">`]);
    if(cells.length&&!tilted(host))html+=propsSection('Position on the piece')+propsGroup(cells,cells.length===2?'even':cells.length===1?'two':'');
    html+=propsSection('How to mount it')+propsNote(esc(kind.mount))+
      propsNote(`Screws: ${esc(kind.screws)}.<br>${esc(hardwarePriceWords(kind,item.size))}`)+
      propsSection('Remove')+`<button class="btn dng" data-hw-delete title="Delete this piece of hardware (Delete)">${icon('i-delete')}Delete</button>`;
    return{title:kind.name,html};
  },
};
$('#props').addEventListener('change',e=>{
  const item=picked&&picked.type==='hw'&&hardwareById(picked.id);
  if(!item)return;
  if(e.target.matches('[data-hw-size]')){
    item.size=+e.target.value;
    commit();
  }else if(e.target.dataset.hwAt){
    const k=+e.target.dataset.hwAt,value=parseLen(e.target.value),half=size(pieceMap().get(item.on))[k]/2;
    if(isNaN(value)){renderProps();return;}
    item.at[k]=clean(Math.max(-half,Math.min(half,value-half)));
    commit();
  }
});
$('#props').addEventListener('click',e=>{
  const piece=e.target.closest('[data-hw-piece]');
  if(piece){picked=null;sel=new Set([+piece.dataset.hwPiece]);renderAll();return;}
  if(e.target.closest('[data-hw-delete]')){deletePicked();return;}
  const row=e.target.closest('[data-hw-pick]');
  if(row)setPicked({type:'hw',id:+row.dataset.hwPick});
});

/* ---------- Properties of a piece: the hardware on it ---------- */
const PROPS_HW_MAX=6;
function propsHardware(ps){
  if(ps.length!==1||isProp(ps[0]))return'';
  const p=ps[0],items=hardwareBetween(p.id);
  const buttons=`<div class="f3 even"><button class="btn t" data-cmd="hang" title="Hinges on the edge next to its frame, a pull on the far side and a catch">Hang it&hellip;</button>`+
    `<button class="btn t" data-cmd="slides" title="A pair of drawer slides between this drawer and the cabinet sides. The drawer box needs a 1/2&quot; gap on each side.">Drawer slides</button></div>`;
  let html=propsSection('Hardware')+buttons;
  if(!items.length)return html;
  const rows=items.slice(0,PROPS_HW_MAX).map(item=>
    `<div class="frow wide"><label>${esc(sizeLabel(item))}</label><button class="btn t" data-hw-pick="${item.id}" title="${esc(hardwareTip(item))} Click to pick it.">${esc(HARDWARE[item.kind].name)}</button></div>`).join('');
  return html+rows+(items.length>PROPS_HW_MAX?propsNote(`and ${items.length-PROPS_HW_MAX} more.`):'');
}

/* ---------- the Pieces panel: hardware is listed under the piece it is mounted on ---------- */
let hardwareByPieceMemo=null;
function hardwareByPiece(){
  const list=hardwareList();
  if(!hardwareByPieceMemo||hardwareByPieceMemo.list!==list||hardwareByPieceMemo.count!==list.length){
    const map=new Map();
    for(const item of list){
      if(!map.has(item.on))map.set(item.on,[]);
      map.get(item.on).push(item);
    }
    hardwareByPieceMemo={list,count:list.length,map};
  }
  return hardwareByPieceMemo.map;
}
function hardwareTreeRows(p,depth){
  const items=hardwareByPiece().get(p.id);
  if(!items)return[];
  return items.map(item=>{
    const on=!!picked&&picked.type==='hw'&&picked.id===item.id;
    return`<li data-hw="${item.id}" style="--d:${depth}" class="hw${on?' on':''}" title="${esc(hardwareTip(item))}">`+
      `<span>${icon('i-hardware','xs')}${esc(HARDWARE[item.kind].name.replace(/,.*$| \(.*$/,''))}</span><span>${esc(sizeLabel(item))}</span><span></span><span></span></li>`;
  });
}
$('#partList').addEventListener('click',e=>{
  const row=e.target.closest('li[data-hw]');
  if(row)setPicked({type:'hw',id:+row.dataset.hw});
});
/* while the Hardware tool waits for a click, the status bar says what to do */
const promptBeforeHardware=TOOL_PROMPTS.select;
TOOL_PROMPTS.select=()=>{
  if(!placingHardware)return promptBeforeHardware();
  const kind=HARDWARE[placingHardware];
  const what=kind.motion==='swing'?'Click the door or lid to hang. Its hinges go on the edge next to the frame.'
    :kind.motion==='slide'?'Click the drawer. It needs a side of the cabinet beside each of its sides.'
    :'Click the piece it goes on. A blue preview shows where it will sit.';
  return['i-hardware',kind.name,what+' Esc stops.'];
};

/* ---------- words and prices ----------
   A kind of hardware is explained by the entry of TERMS (js/glossary.js) that its catalog row names (term), and
   priced by the row of HARDWARE_PRICES (js/prices.js) that matches the line it puts on the shopping list. The
   shopping list, the Price book and this panel all read that one price. */
function hardwareTermLine(kind){
  const term=TERMS.find(entry=>entry.word===kind.term);
  return term?`<div class="note termline" data-beginner><b>${esc(term.word)}.</b> ${esc(term.what)}</div>`:'';
}
function hardwarePriceWords(kind,sizeOfIt){
  const label=kind.buy(sizeOfIt),family=hardwareFamily(label),info=hardwarePriceInfo(label,family);
  if(info.price===null)return'No price estimate yet: type one on the Cut list & shopping tab.';
  const sold=family?family.sold:'each';
  const amount=sold==='each'?`${dollars(info.price)} each`:sold==='pair'?`${dollars(info.price)} a pair`:`${dollars(info.price)} for one ${sold}`;
  return info.source==='yours'?`Your price: ${amount}.`:`About ${amount} (an estimate; type your store's price on the Cut list & shopping tab).`;
}
/* Every kind, at every size it comes in: explained in plain words, clickable on the pages, and priced. */
SELFTESTS.push(function hardwareWordsAndPrices(problems){
  const wrong=text=>problems.push('hardware words and prices: '+text);
  for(const[key,kind]of Object.entries(HARDWARE)){
    const term=TERMS.find(entry=>entry.word===kind.term);
    if(!term)wrong(`"${key}" names no entry of TERMS (js/glossary.js) that explains it`);
    else if(!WORD_LINKS.some(row=>row.word===term.word))wrong(`the word "${term.word}" cannot be clicked on the pages (no row in WORD_LINKS)`);
    for(const[sizeOfIt]of kind.sizes){
      const label=kind.buy(sizeOfIt),family=hardwareFamily(label);
      if(!family||!(family.price>0))wrong(`no price row in HARDWARE_PRICES for "${label}"`);
      else if(/undefined|NaN/.test(hardwarePriceWords(kind,sizeOfIt)))wrong(`the price of "${label}" reads wrong in Properties`);
      // on the pages the name of the item must be found as its word
      if(term&&!WORD_LINKS.some(row=>row.word===term.word&&row.re.test(label)))wrong(`"${label}" on the shopping list is not highlighted as the word "${term.word}"`);
    }
    // a preset that lists this kind as a plain line must not have it counted twice once it is placed
    const plain=HW_PLAIN.find(([,kinds])=>kinds.includes(key));
    if(kind.motion&&!plain)wrong(`"${key}" holds or moves a piece but has no row in HW_PLAIN (js/hardware.js)`);
  }
  // every fastener type is explained and can be clicked too (js/jointhelp.js checks its own cards)
  for(const type of Object.keys(JTYPES)){
    if(type!=='none'&&!JOINT_HELP[type])wrong(`the fastener type "${type}" has no card in JOINT_HELP`);
    if(type!=='none'&&!WORD_LINKS.some(row=>row.joint===type))wrong(`the fastener type "${type}" has no clickable word in WORD_LINKS`);
  }
});

/* ---------- checks ---------- */
SELFTESTS.push(function hardwareByHand(problems){
  const wrong=text=>problems.push('hardware: '+text);
  const pickedKept=picked;
  load(JSON.stringify(blank()),true);
  const[board,loose]=addParts([mk('Board','1x6',[24,.75,5.5],[0,10,0]),mk('Loose board','2x4',[24,1.5,3.5],[0,0,30])]);
  try{
    commit();
    // every kind in the catalog has what the shopping list, the instructions and the 3D view need
    for(const[key,kind]of Object.entries(HARDWARE)){
      const shape=kind.shape(kind.size,{});
      if(!kind.name||!kind.mount||!kind.screws||!kind.term||!kind.sizes.length||!kind.buy(kind.size))wrong(`the catalog entry "${key}" is missing a name, sizes, its word, its screws or how to mount it`);
      if(!shape.on.length&&!shape.to.length)wrong(`"${key}" has no 3D shape`);
      if(/undefined|NaN/.test(kind.buy(kind.size)))wrong(`"${key}" has a broken shopping-list label`);
    }
    // a pull on top of the board: drawn, listed, counted once, and it follows the board
    const pull=addOnFace('pull',byId(board),1,1,{offset:[9,0]}); // 3" from one end
    commit();
    if(!hardwareMeshes.some(mesh=>mesh.userData.hw===pull.id))wrong('a pull that was added is not drawn');
    if(!document.querySelector(`#partList li[data-hw="${pull.id}"]`))wrong('a pull is not listed in the Pieces panel under its piece');
    const rows=hardwareTotals(findJoints()).rows.filter(row=>/Pull handles/.test(row[0]));
    if(rows.length!==1||rows[0][1]!==1)wrong('a placed pull is not counted once in the shopping list: '+JSON.stringify(rows));
    // the preset asks for two pulls and one of them is placed: two to buy, not three, and not one
    S.hw=[['Door pulls',2],['Screw eyes',2],['Screws, 3/4", for the pulls',4]];
    const withPlain=hardwareTotals(findJoints()).rows;
    const pulls=withPlain.filter(row=>/\bpulls?\b/i.test(row[0])&&!/screws/i.test(row[0])).reduce((sum,row)=>sum+row[1],0);
    if(pulls!==2)wrong(`a preset that lists 2 pulls, with 1 of them placed, puts ${pulls} on the shopping list`);
    if(!withPlain.some(row=>row[0]==='Screw eyes'))wrong('a plain hardware line of another kind was dropped');
    if(!withPlain.some(row=>/^Screws, 3\/4"/.test(row[0])&&row[1]===4))wrong('the screws a preset lists for its pulls were taken for pulls');
    S.hw=[['Door pulls',1]];
    if(hardwareTotals(findJoints()).rows.some(row=>row[0]==='Door pulls'))wrong('a pull that is placed is still on the plain list of the preset: it would be bought twice');
    S.hw=[];
    const before=hardwarePose(pull).at.clone();
    sel=new Set([board]);
    applyMove(moveState(board),[5,0,0],[0],true);commit();
    if(Math.abs(hardwarePose(pull).at.x-before.x-5)>1e-6)wrong('hardware did not move with its piece');
    // a quarter turn about the up direction: the pull stays on the top face and turns with the board
    applyRot(snapshot(),1,Math.PI/2,selCenter());finishRot();commit();
    const turned=hardwarePose(pull),top=box(byId(board)).hi[1];
    if(Math.abs(turned.at.y-top)>1e-6||Math.abs(turned.n.y-1)>1e-6||Math.abs(turned.u.z)<.99)wrong('hardware did not turn with its piece: '+JSON.stringify([turned.at,turned.n,turned.u]));
    // stretching the board keeps the pull the same distance from the end it is near
    const p=byId(board),k=p.ax[0],nearEnd=size(p)[k]/2-Math.abs(pull.at[k]);
    p.l+=6;commit();
    if(Math.abs(size(p)[k]/2-Math.abs(pull.at[k])-nearEnd)>1e-6)wrong('after a stretch the hardware is no longer the same distance from its end');
    // a copy takes its hardware along
    dupSel();
    if(hardwareList().length!==2||hardwareOn([...sel][0]).length!==1)wrong('Duplicate did not copy the hardware with its piece');
    undo();
    // picking: Properties, size, position box, Delete
    setPicked({type:'hw',id:pull.id});
    if(sel.size||!/How to mount it/.test($('#props').textContent)||$('#right').classList.contains('off')&&!panelOf('right').off)wrong('picking hardware does not show its Properties');
    const sizeBox=$('#props [data-hw-size]');
    sizeBox.value='5';sizeBox.dispatchEvent(new Event('change',{bubbles:true}));
    if(hardwareById(pull.id).size!==5)wrong('changing the size of picked hardware did not take');
    const atBox=$('#props [data-hw-at]');
    atBox.value='3';atBox.dispatchEvent(new Event('change',{bubbles:true}));
    const moved=hardwareById(pull.id),axis=+atBox.dataset.hwAt;
    if(Math.abs(size(byId(board))[axis]/2+moved.at[axis]-3)>1e-6)wrong('typing a position for picked hardware did not move it');
    deletePicked();
    if(hardwareList().length||picked)wrong('Delete did not remove the picked hardware');
    // deleting a piece takes its hardware along
    addOnFace('knob',byId(loose),1,1);commit();
    sel=new Set([loose]);delSel();
    if(hardwareList().length)wrong('hardware was left behind when its piece was deleted');
    // an old project without the list still opens
    load(JSON.stringify({name:'Old',parts:[],joints:{},nextId:1}),true);
    if(!Array.isArray(hardwareList())||hardwareList().length)wrong('a project saved before hardware existed did not open with an empty list');
  }finally{
    picked=pickedKept;
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
