/* NominalCAD: adding a drawer by hand.

   Add group, More, then Drawer (also at the top of the Hardware pulldown). A small dialog asks what the drawer
   runs on and how its front sits; then the person clicks INSIDE the space the drawer goes in: on the back, a side
   or the floor of that space. The space must have a cabinet side on its left and on its right, and something
   below and above. The drawer is built to fit it by buildDrawer (js/drawers.js), becomes a component of its own,
   and is put on real slides with a pull (mountDrawer). While the pointer moves, the space it would use is
   outlined in blue and the status bar gives its size, or says why no drawer fits there.

     openDrawerDialog()        the command
     startDrawerTool(choice)   wait for the click: choice is {slide: 'slide' | 'runner', front: 'overlay' | 'inset'}
     placingDrawer             that choice while the tool waits, else null
     openingAt(point)          the space around a point of the world: {ok, opening, bounds, lap} or {ok:false, message}
     addDrawerAt(point, choice)   build, mount and select a drawer there. Returns {ok, message, ids}. Call commit() afterwards.
     placeDrawerClick(event)   the canvas asks this when the left button goes down (js/tools.js)
     mountDrawerOfSel()        "Mount this drawer": the selected hand-built box goes on slides, or on runners when
                               its gaps suit those, and gets a pull */
'use strict';

let placingDrawer=null;
const DRAWER_TOOL={
  step:.25,            // how far in front of the clicked face the space is probed, inches
  tallest:12,          // one drawer does not fill a space taller than this: a full drawer that tall is heavy
  previewPieces:1500,  // above this many pieces the blue outline is left out while the pointer moves
};
const drawerGhost=new THREE.Group();
scene.add(drawerGhost);

/* ---------- finding the space ---------- */
/* The space around a point: the nearest square-set wooden piece to its left, right, below and above, and how far
   back and forward the two sides let a drawer run. */
function openingAt(point){
  const fail=message=>({ok:false,message});
  const at=[point.x,point.y,point.z],boxes=[];
  for(const p of S.parts){
    if(isProp(p)||tilted(p))continue;
    const b=plainBox(p);
    boxes.push({p,lo:b.lo,hi:b.hi});
  }
  /* the nearest piece met when looking from the point along direction k (sign +1 or -1) */
  const nearest=(k,sign,within)=>{
    const[u,v]=[0,1,2].filter(axis=>axis!==k);
    let best=null;
    for(const b of boxes){
      if(at[u]<b.lo[u]||at[u]>b.hi[u]||at[v]<b.lo[v]||at[v]>b.hi[v])continue;
      const face=sign>0?b.lo[k]:b.hi[k],distance=(face-at[k])*sign;
      if(distance<-.01||(within&&(face<within[0]-.01||face>within[1]+.01)))continue;
      if(!best||distance<best.distance)best={b,face,distance};
    }
    return best;
  };
  const below=nearest(1,-1),above=nearest(1,1);
  if(!below||!above)return fail(`A drawer needs something ${below?'above':'below'} it: a panel or a rail between the two sides. Click inside a space that is closed at the top and the bottom.`);
  // the two sides: left and right as the design stands, or else front and back (a cabinet that faces sideways)
  let across=0,low=nearest(0,-1),high=nearest(0,1);
  if(!low||!high){across=2;low=nearest(2,-1);high=nearest(2,1);}
  if(!low||!high)return fail('A drawer needs a cabinet side on its left and on its right. Click inside a space between two sides.');
  const deep=2-across;
  // how far the sides let it run, and which end is open
  const sidesFrom=Math.max(low.b.lo[deep],high.b.lo[deep]),sidesTo=Math.min(low.b.hi[deep],high.b.hi[deep]);
  const closedLow=nearest(deep,-1,[sidesFrom-1,sidesTo+1]),closedHigh=nearest(deep,1,[sidesFrom-1,sidesTo+1]);
  if(closedLow&&closedHigh)return fail(`That space is closed all round: ${closedLow.b.p.name} is on one end and ${closedHigh.b.p.name} on the other, so a drawer could not come out.`);
  const out=closedLow?1:closedHigh?-1:(camera.position.getComponent(deep)>=at[deep]?1:-1);   // open at both ends: it comes out toward the viewer
  const closed=closedLow||closedHigh;
  const back=closed?closed.face:(out>0?sidesFrom:sidesTo),front=out>0?sidesTo:sidesFrom;
  const bounds={low:low.b.p,high:high.b.p,below:below.b.p,above:above.b.p,back:closed?closed.b.p:null};
  const moving=Object.values(bounds).find(piece=>piece&&moverOf(piece.id));
  if(moving)return fail(`That space is inside or right beside ${moverOf(moving.id).name}, which opens. Click inside a space of the cabinet itself.`);
  const corner=[0,0,0];
  corner[across]=low.face;corner[1]=below.face;corner[deep]=Math.min(back,front);
  const opening={x:corner[0],y:corner[1],z:corner[2],across,out,
    width:r16(high.face-low.face),height:r16(above.face-below.face),depth:r16(Math.abs(front-back))};
  if(opening.height>DRAWER_TOOL.tallest)return fail(`That space is ${fmt(opening.height)} tall. One drawer fills ${fmt(DRAWER_TOOL.tallest)} at most: put a rail or a shelf across it first, then click the space above or below that.`);
  // nothing else may be in the way
  const lowCorner=corner,highCorner=[0,0,0];
  highCorner[across]=high.face;highCorner[1]=above.face;highCorner[deep]=Math.max(back,front);
  const inTheWay=boxes.find(b=>[0,1,2].every(k=>b.lo[k]<highCorner[k]-.05&&b.hi[k]>lowCorner[k]+.05));
  if(inTheWay)return fail(`${inTheWay.p.name} is already in that space. Move it out first, or click inside an empty space.`);
  /* How far an overlay front may reach over each piece around the space: half its thickness less half a gap, so
     that two drawers either side of a rail keep one gap between their fronts. A piece that stands proud of the
     front edges of the sides (a top that overhangs) gets no lap at all: the front stops one gap short of it. */
  const lapOver=(b,k)=>{
    const proud=out>0?b.hi[deep]-front:front-b.lo[deep];
    if(proud>DRAWER.overlayStandoff+.01)return-DRAWER.frontGap;
    return Math.max(0,Math.min(.625,r16((b.hi[k]-b.lo[k])/2-DRAWER.frontGap/2)));
  };
  const lap={side:Math.min(lapOver(low.b,across),lapOver(high.b,across)),top:lapOver(above.b,1),bottom:lapOver(below.b,1)};
  /* Whatever already lies in front of the cabinet there (the front of the drawer above, a door beside it) takes
     its room first: the new front stops one gap short of it. */
  const slabFrom=out>0?front+DRAWER.overlayStandoff:front-DRAWER.overlayStandoff-DRAWER.frontThick;
  const slabTo=slabFrom+DRAWER.frontThick,spaceTop=above.face,spaceBottom=below.face,gap=DRAWER.frontGap;
  for(const b of boxes){
    if(b.lo[deep]>=slabTo-.01||b.hi[deep]<=slabFrom+.01)continue;   // not in the layer the front lies in
    const acrossToo=b.lo[across]<high.face+lap.side&&b.hi[across]>low.face-lap.side;
    const levelToo=b.lo[1]<spaceTop+lap.top&&b.hi[1]>spaceBottom-lap.bottom;
    if(acrossToo&&b.lo[1]>=spaceTop-.01)lap.top=Math.min(lap.top,r16(b.lo[1]-spaceTop-gap));
    else if(acrossToo&&b.hi[1]<=spaceBottom+.01)lap.bottom=Math.min(lap.bottom,r16(spaceBottom-b.hi[1]-gap));
    else if(levelToo&&b.lo[across]>=high.face-.01)lap.side=Math.min(lap.side,r16(b.lo[across]-high.face-gap));
    else if(levelToo&&b.hi[across]<=low.face+.01)lap.side=Math.min(lap.side,r16(low.face-b.hi[across]-gap));
  }
  return{ok:true,opening,bounds,lap};
}

/* ---------- building it ---------- */
function addDrawerAt(point,choice){
  const found=openingAt(point);
  if(!found.ok)return found;
  // its name: the next free "Drawer n" inside the component the two sides share
  const shared=compChain(found.bounds.low.id).map(comp=>comp.id).find(id=>pieceIsIn(found.bounds.high.id,id));
  const parent=shared===undefined?null:shared;
  let number=1;
  const taken=new Set((S.comps||[]).map(comp=>comp.name));
  while(taken.has(`Drawer ${number}`))number++;
  const options={name:`Drawer ${number}`,slide:choice.slide,front:choice.front,lap:found.lap};
  const parts=buildDrawer(found.opening,options);
  if(!parts.length)return{ok:false,message:parts.plan.problems.join(' ')};
  parts.forEach(part=>{delete part.sub;});
  const ids=addParts(parts);
  const comp=newComp(options.name,parent);          // js/components.js
  parts.forEach(part=>{part.comp=comp.id;});
  compsChanged();
  bornTogether(ids);                                // they arrive as one thing, whatever Auto-fasten says
  storeNamedJoints({joints:DRAWER_JOINTS},parts);   // glued and nailed box, front screwed on from inside
  const mounted=mountDrawer(ids,{kind:parts.plan.kind,dir:hardwareDirection(found.opening)});
  if(!mounted.ok){
    // put everything back: a drawer that cannot be mounted is not left lying in the cabinet
    const gone=new Set(ids);
    S.parts=S.parts.filter(part=>!gone.has(part.id));
    S.comps=S.comps.filter(other=>other!==comp);
    compsChanged();
    return mounted;
  }
  const plan=parts.plan;
  return{ok:true,ids,name:options.name,
    message:`${options.name} is built to fit: on a pair of ${fmt(plan.length)} ${plan.kind==='slide'?'slides':'wooden runners'}, with a pull on its front. It comes out ${fmt(r16(plan.travel))}.`};
}
/* the way a drawer of this opening comes out, as a direction of the world */
function hardwareDirection(opening){
  const direction=[0,0,0];
  direction[2-opening.across]=opening.out;
  return direction;
}

/* ---------- the tool ---------- */
function openDrawerDialog(){
  if(tab!=='design')setTab('design');
  if(!S.parts.length){toast('Build or draw the cabinet first: a drawer goes into a space between two sides.');return;}
  $('#drawerDlg').showModal();
}
$('#bDrawerGo').onclick=()=>{
  $('#drawerDlg').close();
  startDrawerTool({slide:$('#drawerSlide').value,front:$('#drawerFront').value});
};
function startDrawerTool(choice){
  if(placingHardware)stopPlacing();
  setTool('select');
  placingDrawer=choice;
  cv.style.cursor='crosshair';
  renderStatus();
}
function stopDrawerTool(){
  placingDrawer=null;
  clearDrawerGhost();
  cv.style.cursor='';
  renderStatus();
  draw();
}
function clearDrawerGhost(){
  while(drawerGhost.children.length){
    const child=drawerGhost.children.pop();
    child.geometry.dispose();
    child.material.dispose();
  }
}
/* The space the pointer means: {point, found} (found is what openingAt says about that point), or null over empty
   space. Usually the point is just in front of the face under the pointer. A click on the front EDGE of a shelf
   or of a side looks out of the cabinet, where there is no space; then the spaces right behind that edge are
   tried: above the piece, below it, and to either side of it. */
function spaceUnderPointer(e){
  const hit=pick(e);
  if(!hit||!hit.face)return null;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const first=hit.point.clone().addScaledVector(normal,DRAWER_TOOL.step),straight=openingAt(first);
  const piece=byId(hit.object.userData.id);
  if(straight.ok||!piece||tilted(piece)||Math.abs(normal.y)>.5)return{point:first,found:straight};
  const b=plainBox(piece),behindEdge=hit.point.clone().addScaledVector(normal,-1);
  const normalAxis=Math.abs(normal.x)>.5?0:2;
  for(const[k,sign]of[[1,1],[1,-1],[2-normalAxis,1],[2-normalAxis,-1]]){
    const point=behindEdge.clone();
    point.setComponent(k,sign>0?b.hi[k]+DRAWER_TOOL.step:b.lo[k]-DRAWER_TOOL.step);
    const found=openingAt(point);
    if(found.ok)return{point,found};
  }
  return{point:first,found:straight};
}
function showDrawerGhost(e){
  clearDrawerGhost();
  const under=S.parts.length<=DRAWER_TOOL.previewPieces?spaceUnderPointer(e):null;
  const found=under?under.found:null;
  if(found&&found.ok){
    const o=found.opening,extent=[0,0,0];
    extent[o.across]=o.width;extent[1]=o.height;extent[2-o.across]=o.depth;
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(extent[0],extent[1],extent[2])),
      new THREE.LineBasicMaterial({color:VIEW_COL.sel,depthTest:false,transparent:true,opacity:.9}));
    outline.position.set(o.x+extent[0]/2,o.y+extent[1]/2,o.z+extent[2]/2);
    outline.renderOrder=8;
    drawerGhost.add(outline);
    const plan=drawerPlan(o,{...placingDrawer,lap:found.lap});
    setPrompt(`<b>Drawer</b>`+(plan.ok
      ?`This space is ${fmt(o.width)} wide, ${fmt(o.height)} tall and ${fmt(o.depth)} deep. Click to fit a drawer on ${fmt(plan.length)} ${plan.kind==='slide'?'slides':'runners'}. Esc stops.`
      :esc(plan.problems[0])+' Esc stops.'),'i-hardware');
  }else if(found)setPrompt(`<b>Drawer</b>${esc(found.message)} Esc stops.`,'i-hardware');
  else renderStatus();
  draw();
}
let drawerGhostQueued=false,drawerGhostEvent=null;
cv.addEventListener('pointermove',e=>{
  if(!placingDrawer||drag||modal)return;
  drawerGhostEvent=e;
  if(drawerGhostQueued)return;
  drawerGhostQueued=true;
  requestAnimationFrame(()=>{   // at most once per drawn frame
    drawerGhostQueued=false;
    if(placingDrawer&&!drag&&!modal)showDrawerGhost(drawerGhostEvent);
  });
});
function placeDrawerClick(e){
  if(!placingDrawer)return false;
  if(tool!=='select'||e.button!==0){stopDrawerTool();return false;}
  const under=spaceUnderPointer(e);
  if(!under)return false;   // empty space: the view turns as usual, and the tool keeps waiting
  const choice=placingDrawer,result=addDrawerAt(under.point,choice);
  if(!result.ok){
    showMessage('No drawer fits there',result.message);
    return true;            // the tool keeps waiting for a better click
  }
  stopDrawerTool();
  sel=new Set([result.ids[result.ids.length-1]]);   // its front, so the handle that pulls it out shows at once
  commit();
  toast(result.message+' Drag the blue arrow to pull it out.');
  return true;
}
window.addEventListener('keydown',e=>{
  if(placingDrawer&&e.key==='Escape'&&!document.querySelector('dialog[open]')){
    e.stopImmediatePropagation();
    stopDrawerTool();
  }
},true);
/* while the tool waits for a click, the status bar says what to do */
const promptBeforeDrawer=TOOL_PROMPTS.select;
TOOL_PROMPTS.select=()=>placingDrawer
  ?['i-hardware','Drawer','Click inside the space the drawer goes in: on the back, a side or the floor of that space. It needs a side to its left and right, and something below and above. Esc stops.']
  :promptBeforeDrawer();

/* ---------- "Mount this drawer": a box the person built ---------- */
/* Several selected pieces (or a selected component) are the drawer as they are; one selected piece stands for its
   subcomponent, or else for everything fastened to it. Metal slides when it has their 1/2" gaps, wooden runners
   when it sits close to the cabinet sides. */
function mountDrawerOfSel(){
  if(tab!=='design')setTab('design');
  if(!sel.size){toast('Select the drawer (any piece of it, or all of it) first.');return;}
  const exact=sel.size>1,onSlides=slidePlan([...sel],{exact});   // js/hanging.js
  const onRunners=slidePlan([...sel],{exact,kind:'runner'});
  // A box that sits close to both cabinet sides is a drawer on runners, even when its back happens to stand a
  // slide's gap from the back panel (which would offer one metal slide, on the back): a pair wins over one.
  const pairOf=plan=>plan.ok&&plan.items.length===2;
  const fits=pairOf(onSlides)||!pairOf(onRunners)?(onSlides.ok?onSlides:onRunners):onRunners;
  if(!fits.ok){
    showMessage('Could not mount this drawer',onSlides.message+' For wooden runners instead, the box must sit within 1/4" of each cabinet side.');
    return;
  }
  // asks first when the box is fastened to the cabinet: mounting takes those fasteners out (mountByHand, js/hanging.js)
  mountByHand(fits,()=>mountDrawer(fits.drawer.map(piece=>piece.id),{kind:fits.items[0].kind}),'Select the drawer and drag the blue arrow to pull it out.');
}

/* ---------- checks ---------- */
/* A drawer added by hand into a cabinet that faces each of the four ways: it fits its space, is one component, runs
   on a pair of slides with a pull, opens all the way toward the open end and hits nothing; spaces that cannot take
   a drawer are refused in words; and a hand-built box is mounted by the command. */
SELFTESTS.push(function drawersByHand(problems){
  const wrong=text=>problems.push('drawer by hand: '+text);
  const tabKept=tab,autoKept=autoFasten;
  autoFasten=true;   // the hand-built box at the end is fastened as a beginner's would be
  /* A plywood cabinet 18 wide, 16 deep: two sides, a bottom, a top and a back, with a rail 8" above the bottom.
     turn: 0 faces the front, 1 the right, 2 the back, 3 the left. Returns the point inside the lower space. */
  const cabinet=turn=>{
    load(JSON.stringify(blank()),true);
    const pieces=[['Side',[.75,20,16],[0,0,0]],['Side',[.75,20,16],[17.25,0,0]],['Bottom',[16.5,.75,16],[.75,0,0]],
      ['Top',[16.5,.75,16],[.75,19.25,0]],['Back panel',[18,20,.25],[0,0,-.25]],['Rail',[16.5,.75,16],[.75,8.75,0]]];
    const turned=([sx,sy,sz],[x,y,z])=>{
      if(turn===0)return[[sx,sy,sz],[x,y,z]];
      if(turn===2)return[[sx,sy,sz],[18-x-sx,y,16-z-sz]];
      if(turn===1)return[[sz,sy,sx],[z,y,18-x-sx]];
      return[[sz,sy,sx],[16-z-sz,y,x]];
    };
    addParts(pieces.map(([name,extent,at])=>{const[s,p]=turned(extent,at);return mk(name,name==='Back panel'?'ply14':'ply34',s,p);}));
    commit();
    const[,inside]=turned([0,0,0],[9,4,8]);
    return new THREE.Vector3(inside[0],inside[1],inside[2]);
  };
  try{
    for(const turn of[0,1,2,3]){
      for(const choice of[{slide:'slide',front:'overlay'},{slide:'runner',front:'inset'}]){
        const where=`a cabinet turned ${turn} quarter turns, ${choice.slide} and ${choice.front}: `;
        const point=cabinet(turn),result=addDrawerAt(point,choice);
        if(!result.ok){wrong(where+'no drawer was fitted: '+result.message);continue;}
        commit();
        const mover=moverOf(result.ids[0]);
        if(!mover||mover.kind!=='slide'||mover.items.length!==2){wrong(where+'the drawer is not on a pair of slides or runners');continue;}
        if(mover.riders.size!==6||mover.name!=='Drawer 1')wrong(where+`what moves is ${mover.riders.size} pieces called ${mover.name}, not the six pieces of Drawer 1`);
        if(findClashes().length)wrong(where+'the new drawer shares space with the cabinet');
        const reach=openReach(mover);
        if(reach.hit||reach.free<1)wrong(where+`the drawer hits ${reach.hit?reach.hit.other.name:'something'} when it is pulled out`);
        // it comes out of the open end: away from the back panel
        const backPanel=S.parts.find(p=>p.name==='Back panel'),middle=pieceMiddle(backPanel),front=pieceMiddle(byId(result.ids[5]));
        if(mover.axis.dot(front.clone().sub(middle))<=0)wrong(where+'the drawer opens toward the back panel');
        if(hardwareList().filter(item=>DRAWER_PULLS.includes(item.kind)).length!==1)wrong(where+'the drawer did not get one pull');
        if(verifyDesign(S.parts,designCheckOptions()).problems.some(f=>f.level==='stop'))wrong(where+'Check my design finds a stop: '+verifyDesign(S.parts,designCheckOptions()).problems.find(f=>f.level==='stop').text);
        // a second click in the same space is refused: the drawer is in the way
        const again=addDrawerAt(point,choice);
        if(again.ok)wrong(where+'a second drawer was put into the space the first one fills');
      }
    }
    // spaces that cannot take a drawer say why
    const point=cabinet(0);
    const upper=openingAt(new THREE.Vector3(9,14,8));
    if(!upper.ok||Math.abs(upper.opening.height-9.75)>.01||Math.abs(upper.opening.width-16.5)>.01||Math.abs(upper.opening.depth-16)>.01)wrong('the space above the rail was not measured right: '+JSON.stringify(upper.opening||upper.message));
    if(openingAt(new THREE.Vector3(9,4,40)).ok||openingAt(new THREE.Vector3(40,4,8)).ok)wrong('a point outside the cabinet was taken for a space');
    S.parts=S.parts.filter(p=>p.name!=='Rail');commit();
    const tall=openingAt(point);
    if(tall.ok||!/tall/.test(tall.message))wrong('a space 18 1/2" tall was not refused with the reason: '+(tall.message||'accepted'));
    // a third drawer in the open shelf of the Nightstand: its overlay front keeps one gap under the front above it
    const nightstand=PRESETS.find(preset=>preset.name==='Nightstand with drawers');
    if(nightstand){
      let presetKept=null;
      try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
      load(JSON.stringify(blank()),true);
      const vals=presetDefaults(nightstand),plan=nightstandPlan(vals);
      placePreset(nightstand,vals,nightstand.build(vals),false);
      try{
        if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
        else localStorage.setItem(LAST_PRESET_KEY,presetKept);
      }catch(e){}
      const third=addDrawerAt(new THREE.Vector3(plan.W/2,plan.floorOfCabinet+2,plan.D/2),{slide:'slide',front:'overlay'});
      commit();
      if(!third.ok)wrong('no drawer was fitted into the open shelf of the Nightstand: '+third.message);
      else{
        if(third.name!=='Drawer 3'||compChain(third.ids[0]).length!==2)wrong('a drawer added to the Nightstand is not a subcomponent of it called Drawer 3');
        if(findClashes().length)wrong('a drawer added under the drawers of the Nightstand shares space with the front above it');
        if(movers().length!==3||movers().some(mover=>openReach(mover).hit))wrong('after adding a third drawer to the Nightstand, not all three open freely');
        const fronts=S.parts.filter(p=>p.name==='Drawer front').map(p=>plainBox(p)).sort((a,b)=>a.lo[1]-b.lo[1]);
        if(Math.abs(fronts[1].lo[1]-fronts[0].hi[1]-DRAWER.frontGap)>.001)wrong('the front of the added drawer is not one gap below the front above it');
      }
    }
    // "Mount this drawer" on a box built by hand, 1/2" from each side, with no pull
    cabinet(0);
    const box=addParts([mk('Board','ply12',[.5,5,14],[1.25,1.5,1.5]),mk('Board','ply12',[.5,5,14],[16.25,1.5,1.5]),
      mk('Board','ply12',[14.5,5,.5],[1.75,1.5,15]),mk('Board','ply12',[14.5,5,.5],[1.75,1.5,1.5])]);
    commit();
    sel=new Set(box);
    mountDrawerOfSel();
    const handBuilt=moverOf(box[0]);
    if(!handBuilt||handBuilt.items.length!==2||handBuilt.items[0].kind!=='slide')wrong('Mount this drawer did not put a hand-built box on a pair of slides');
    else if(openReach(handBuilt).hit)wrong('a hand-built box on slides hits something when it is pulled out');
    if(!hardwareOn(box[2]).some(item=>DRAWER_PULLS.includes(item.kind)))wrong('Mount this drawer did not put a pull or a knob on the front of the box');
  }finally{
    autoFasten=autoKept;
    stopDrawerTool();
    load(JSON.stringify(blank()),true);
    setTab(tabKept);
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
