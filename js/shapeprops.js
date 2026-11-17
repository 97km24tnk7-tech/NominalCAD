/* NominalCAD: the Shape section of the Properties panel (design\specs\03, section 1a): shaping a piece by hand.

   One wooden piece selected: after the Angle section, "Shape". A plain piece shows one line, "Shape: square cut"
   and Change shape. Opened, it has three groups:
     Ends                one block per end, named by where it points ("Bottom end"): Square / Angled / Rounded /
                         Pointed, and the fields of that kind (SHAPE_KINDS, js/shapes.js)
     Corners             Expert, or any sheet (corner shelves): Square / Cut off / Rounded / Notched
     Holes and cut-outs  one line per feature in words, with Edit and a delete cross; Add hole, Add cut-out, and
                         in Expert Add slot, Add notch. Edit opens the feature's fields under its line, and the 3D
                         view draws its outline in the selection blue
   Every change is one undo step. A value outside the field's limits, or one that makes a STOP finding of
   js/shapecheck.js on this piece, is not taken: the box turns red and the box under the section says why. A WARN
   finding is shown in the yellow box and is also listed by Check my design. Nothing here is automatic: it is the
   by-hand way to everything a builder may do with js/shapes.js. */
'use strict';

const shapeOpen=new Set();      // ids of plain pieces whose Shape section was opened with Change shape
let shapeEditing=null;          // {id, k}: the feature whose fields are open
let shapeRefusal=null;          // {id, text, field}: the last value that was not taken

const isExpertLevel=()=>typeof level!=='undefined'&&level==='expert';
const SHAPE_END_CUTS=[['square','Square'],['saw','Angled'],['round','Rounded'],['point','Pointed']];
const SHAPE_CORNER_CUTS=[['square','Square'],['clip','Cut off'],['round','Rounded'],['notch','Notched']];

/* one field: its label on the left, the box or the pulldown on the right */
function shapeFieldRow(label,control){
  return`<div class="shp-f"><label>${esc(label)}</label>${control}</div>`;
}
function shapeControl(attrs,field,value,p,names){
  const data=Object.entries(attrs).map(([k,v])=>` data-${k}="${esc(String(v))}"`).join('');
  if(field.type==='select'){
    const options=field.options(p,names).filter(([v])=>v!==field.expertOption||isExpertLevel()||value===v);
    return`<select class="fld"${data}>${options.map(([v,text])=>`<option value="${v}"${String(v)===String(value)?' selected':''}>${esc(text)}</option>`).join('')}</select>`;
  }
  if(field.type==='len'){
    const list=field.sizes?' list="shapeHoleSizes"':'';
    return`<input class="fld" type="text" data-len${list}${data} value="${esc(boxLen(value))}">`;
  }
  return`<input class="fld" type="text"${data} value="${roundDeg(value)}">`;
}

/* the Shape section of one wooden piece (appended to propsOfPiece, js/panels.js) */
function shapeSection(p){
  if(isProp(p))return'';
  const names=shapeNames(p),open=!!p.shape||shapeOpen.has(p.id);
  if(!open)return propsSection('Shape')+`<div class="shp-plain"><span>Square cut</span><button class="btn s" data-shape-act="open">Change shape</button></div>`;
  let h=propsSection('Shape');
  // Ends
  h+=`<div class="shp-g">Ends</div>`;
  [0,1].forEach(i=>{
    const e=shapeEnd(p,i),cut=e?e.cut:'square';
    h+=shapeFieldRow(names.end[i],`<select class="fld" data-shape="endcut" data-i="${i}">${SHAPE_END_CUTS.map(([v,t])=>`<option value="${v}"${v===cut?' selected':''}>${t}</option>`).join('')}</select>`);
    if(!e)return;
    for(const field of SHAPE_KINDS[e.cut].fields){
      if(field.show&&!field.show(p,e))continue;
      if(field.expertUnlessSet&&!isExpertLevel()&&!e[field.key])continue;
      h+=shapeFieldRow(field.label,shapeControl({shape:'field',scope:'end',i,key:field.key},field,e[field.key],p,names));
    }
  });
  if([0,1].some(i=>{const e=shapeEnd(p,i);return e&&e.cut==='saw';})){
    const sides=shortSides(p);
    h+=propsNote(`Short side ${fmt(Math.min(...sides.edge))}. The length is the blank, long point to long point.`);
  }
  // Corners (Expert; any sheet, for corner shelves)
  if(isExpertLevel()||M[p.mat].kind==='sheet'){
    h+=`<div class="shp-g">Corners</div>`;
    [0,1,2,3].forEach(i=>{
      const c=shapeCorner(p,i),cut=c?c.cut:'square';
      const cuts=SHAPE_CORNER_CUTS.filter(([v])=>v!=='notch'||isExpertLevel()||cut==='notch');
      h+=shapeFieldRow(names.corner[i],`<select class="fld" data-shape="cornercut" data-i="${i}">${cuts.map(([v,t])=>`<option value="${v}"${v===cut?' selected':''}>${t}</option>`).join('')}</select>`);
      if(!c)return;
      for(const field of SHAPE_KINDS['corner-'+c.cut].fields)h+=shapeFieldRow(field.label,shapeControl({shape:'field',scope:'corner',i,key:field.key},field,c[field.key],p,names));
    });
  }
  // Holes and cut-outs
  h+=`<div class="shp-g">Holes and cut-outs</div>`;
  const feats=shapeFeatures(p);
  if(!feats.length)h+=propsNote('None yet.');
  feats.forEach((f,k)=>{
    const editing=shapeEditing&&shapeEditing.id===p.id&&shapeEditing.k===k;
    h+=`<div class="shp-line${editing?' on':''}"><span>${esc(featureWords(p,f,names))}</span>`+
      `<button class="btn s" data-shape-act="edit" data-k="${k}">${editing?'Done':'Edit'}</button>`+
      `<button class="btn s dng" data-shape-act="del" data-k="${k}" title="Delete it (Ctrl+Z brings it back)">×</button></div>`;
    if(editing)h+=shapeFeatureFields(p,f,k,names);
  });
  h+=`<div class="shp-add"><button class="btn s" data-shape-act="add" data-kind="hole">Add hole</button><button class="btn s" data-shape-act="add" data-kind="cutout">Add cut-out</button>`+
    (isExpertLevel()?`<button class="btn s" data-shape-act="add" data-kind="slot">Add slot</button><button class="btn s" data-shape-act="add" data-kind="notch">Add notch</button>`:'')+`</div>`;
  // what is wrong: the value just refused, then the findings of the piece as it is
  if(shapeRefusal&&(shapeRefusal.id!==p.id||shapeRefusal.sel!==sel))shapeRefusal=null;   // selected again, or another piece
  const refused=shapeRefusal?shapeRefusal.text:'';
  const findings=shapePieceFindings(p);
  if(refused)h+=`<div class="shp-msg stop">${esc(refused)}</div>`;
  for(const f of findings)h+=`<div class="shp-msg ${f.level}">${esc(f.text)}${f.fix?' '+esc(f.fix):''}</div>`;
  if(p.shape)h+=`<div class="shp-add"><button class="btn s" data-shape-act="square">Make it square again</button></div>`;
  return h;
}
/* the fields of one feature, under its line */
function shapeFeatureFields(p,f,k,names){
  let h='';
  for(const field of SHAPE_KINDS[f.kind].fields)h+=shapeFieldRow(field.label,shapeControl({shape:'field',scope:'feat',i:k,key:field.key},field,f[field.key],p,names));
  const u=f.at.u,sel=(key,options,value)=>`<select class="fld" data-shape="pos" data-i="${k}" data-key="${key}">${options.map(([v,t])=>`<option value="${v}"${String(v)===String(value)?' selected':''}>${esc(t)}</option>`).join('')}</select>`;
  const len=(key,value)=>`<input class="fld" type="text" data-len data-shape="pos" data-i="${k}" data-key="${key}" value="${esc(boxLen(value))}">`;
  h+=shapeFieldRow('From the',sel('ufrom',[[0,names.end[0]],[1,names.end[1]],['mid','Middle']],u.from));
  h+=shapeFieldRow(u.from==='mid'?'Distance from the middle':'Distance',len('ud',Math.abs(u.d||0)));
  if(u.from==='mid'&&u.d)h+=shapeFieldRow('Toward the',sel('usign',[[1,names.end[1]],[-1,names.end[0]]],u.d>0?1:-1));
  if(f.kind!=='notch'){
    const v=f.at.v,across=v.from==='mid'?'mid':v.from;
    h+=shapeFieldRow('Across',sel('vfrom',[['mid','Centered'],[0,'From the '+shapeLower(names.edge[0])],[1,'From the '+shapeLower(names.edge[1])]],across));
    if(v.from!=='mid')h+=shapeFieldRow('Distance',len('vd',v.d));
  }
  return h;
}

/* ---------- changes ---------- */
/* a change to a copy of the shape; returns the words that refuse it, or '' */
function shapeChange(p,shape,el){
  const kind=el.dataset.shape,i=+el.dataset.i,key=el.dataset.key,raw=el.value;
  if(kind==='endcut'){
    if(raw==='square'){shape.ends[i]=null;return'';}
    const row=SHAPE_KINDS[raw],end={cut:raw};
    for(const field of row.fields)end[field.key]=field.def(p);
    if(raw==='saw')end.long=0;
    shape.ends[i]=end;
    return'';
  }
  if(kind==='cornercut'){
    if(raw==='square'){shape.corners[i]=null;return'';}
    const corner={cut:raw};
    for(const field of SHAPE_KINDS['corner-'+raw].fields)corner[field.key]=field.def(p);
    shape.corners[i]=corner;
    return'';
  }
  if(kind==='field'){
    const scope=el.dataset.scope;
    const target=scope==='end'?shape.ends[i]:scope==='corner'?shape.corners[i]:shape.feats[i];
    if(!target)return'';
    const row=scope==='end'?SHAPE_KINDS[target.cut]:scope==='corner'?SHAPE_KINDS['corner-'+target.cut]:SHAPE_KINDS[target.kind];
    const field=row.fields.find(x=>x.key===key);
    if(!field)return'';
    if(field.type==='select'){target[key]=/^-?\d+$/.test(raw)?+raw:raw;return'';}
    const value=field.type==='len'?parseLen(raw):parseFloat(raw);
    if(!isFinite(value))return`${field.label}: "${raw}" is not a ${field.type==='len'?'size':'number'}.`;
    const trial={...target,[key]:value},min=field.min(p,trial),max=field.max(p,trial);
    const shown=x=>field.type==='len'?fmt(x):degText(x);
    // both angles of an angled end at 0 make it square again
    const squareAgain=scope==='end'&&target.cut==='saw'&&value===0&&!(key==='miter'?target.bevel:target.miter);
    if(!squareAgain&&(value<min-1e-9||value>max+1e-9))return`${field.label}: ${shown(value)} is outside what this piece allows, ${shown(min)} to ${shown(max)}.`;
    target[key]=value;
    if(squareAgain)shape.ends[i]=null;
    return'';
  }
  if(kind==='pos'){
    const f=shape.feats[i];
    if(!f)return'';
    // measuring from somewhere else keeps the feature where it is: only the number changes
    const c=featureCenter(p,f);
    if(key==='ufrom'){const from=raw==='mid'?'mid':+raw;f.at.u={from,d:from==='mid'?c.u-p.l/2:from===1?p.l-c.u:c.u};return'';}
    if(key==='usign'){f.at.u.d=Math.abs(f.at.u.d||0)*(+raw<0?-1:1);return'';}
    if(key==='vfrom'){const from=raw==='mid'?'mid':+raw;f.at.v={from,d:from==='mid'?0:from===1?p.w-c.v:c.v};return'';}
    const value=parseLen(raw);
    if(!isFinite(value)||value<0)return`"${raw}" is not a size.`;
    if(key==='ud'){
      const most=f.at.u.from==='mid'?p.l/2:p.l;
      if(value>most+1e-9)return`The distance can be at most ${fmt(most)} on this ${fmt(p.l)} long piece.`;
      f.at.u.d=f.at.u.from==='mid'?value*(f.at.u.d<0?-1:1):value;
    }
    if(key==='vd'){
      if(value>p.w+1e-9)return`The distance can be at most ${fmt(p.w)} on this ${fmt(p.w)} wide piece.`;
      f.at.v.d=value;
    }
    return'';
  }
  return'';
}
/* try a new shape on the piece: refused when it brings a STOP the piece did not have; else taken as one undo step */
function tryShape(p,shape,field){
  const trial={...p,shape};
  tidyShape(trial);
  const before=new Set(shapePieceFindings(p).filter(f=>f.level==='stop').map(f=>f.text));
  const brought=shapePieceFindings(trial).filter(f=>f.level==='stop'&&!before.has(f.text));
  if(brought.length){refuse(p,brought[0].text+(brought[0].fix?' '+brought[0].fix:''),field);return false;}
  shapeRefusal=null;
  // nothing changed (a value typed again as it was): no undo step for it, only the panel drawn afresh
  if(JSON.stringify(trial.shape||null)===JSON.stringify(p.shape||null)){renderProps();return true;}
  if(trial.shape)p.shape=trial.shape;else{delete p.shape;shapeOpen.add(p.id);}   // (square again: the section stays open)
  shapeCommitting=true;
  try{commit();}finally{shapeCommitting=false;}
  return true;
}
let shapeCommitting=false;   // a commit made by the Shape section itself (it keeps nothing refused anyway)
function refuse(p,text,field){
  // remembered with the selection it was typed under: a new selection, or any other change, forgets it
  shapeRefusal={id:p.id,text,field,sel};
  renderProps();
  // the box that was typed in keeps what was typed, in red
  if(field){
    const box=$('#props').querySelector(field.selector);
    if(box){box.value=field.value;box.classList.add('bad');}
  }
}
const fieldSelector=el=>'[data-shape="'+el.dataset.shape+'"]'+['scope','i','key'].filter(k=>el.dataset[k]!==undefined).map(k=>`[data-${k}="${el.dataset[k]}"]`).join('');

$('#props').addEventListener('change',e=>{
  const el=e.target.closest('[data-shape]');
  if(!el)return;
  const p=selParts()[0];
  if(!p||isProp(p)||selParts().length!==1)return;
  const shape=JSON.parse(JSON.stringify(p.shape||blankShape()));
  const field={selector:fieldSelector(el),value:el.value};
  const why=shapeChange(p,shape,el);
  if(why){refuse(p,why,field);return;}
  tryShape(p,shape,field);
});
$('#props').addEventListener('click',e=>{
  const button=e.target.closest('[data-shape-act]');
  if(!button)return;
  const p=selParts()[0];
  if(!p||isProp(p))return;
  const act=button.dataset.shapeAct,k=+button.dataset.k;
  if(act==='open'){shapeOpen.add(p.id);renderProps();return;}
  if(act==='edit'){shapeEditing=shapeEditing&&shapeEditing.id===p.id&&shapeEditing.k===k?null:{id:p.id,k};renderProps();rebuildScene();return;}
  if(act==='del'){
    const shape=JSON.parse(JSON.stringify(p.shape));
    shape.feats.splice(k,1);
    if(shapeEditing&&shapeEditing.id===p.id)shapeEditing=null;
    shapeRefusal=null;
    const trial={...p,shape};tidyShape(trial);
    if(trial.shape)p.shape=trial.shape;else{delete p.shape;shapeOpen.add(p.id);}
    commit();
    return;
  }
  if(act==='add'){
    const kind=button.dataset.kind,row=SHAPE_KINDS[kind],f={kind};
    for(const field of row.fields){
      const def=field.def(p);
      f[field.key]=field.type==='select'?def:Math.max(field.min(p,f),Math.min(def,field.max(p,f)));
    }
    f.at=kind==='notch'?{u:{from:'mid',d:0}}:{u:{from:'mid',d:0},v:{from:'mid',d:0}};
    const shape=JSON.parse(JSON.stringify(p.shape||blankShape()));
    shape.feats.push(f);
    if(tryShape(p,shape,null)){shapeEditing={id:p.id,k:shape.feats.length-1};renderProps();rebuildScene();}
    return;
  }
  if(act==='square'){
    askConfirm(`Remove every cut, hole and notch from ${p.name}? You can undo this.`,{action:'Make it square'},()=>{
      delete p.shape;shapeEditing=null;shapeRefusal=null;
      commit();
    });
  }
});
/* the feature whose fields are open: its outline in the selection blue, on both faces of the piece */
SCENE_EXTRAS.push(function outlineOpenFeature(){
  if(!shapeEditing)return;
  const p=S.parts.find(x=>x.id===shapeEditing.id),f=p&&p.shape&&p.shape.feats[shapeEditing.k];
  const group=p&&meshes.get(p.id);
  if(!f||!group)return;
  let ring=openingPoints(p,f);
  if(!ring){const b=featureBounds(p,f);ring=[[b.u0,b.v0],[b.u1,b.v0],[b.u1,b.v1],[b.u0,b.v1]];}
  const points=[];
  for(const s of[-.01,p.t+.01])for(let i=0;i<ring.length;i++)for(const q of[ring[i],ring[(i+1)%ring.length]]){
    const world=[0,0,0];
    world[p.ax[0]]=q[0]-p.l/2;world[p.ax[1]]=q[1]-p.w/2;world[p.ax[2]]=s-p.t/2;
    points.push(...world);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(points),3));
  group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:VIEW_COL.sel,depthTest:false})));
});
/* another design opened (or undo, which loads the design again): piece numbers start over, so which plain pieces had
   their Shape section opened is forgotten, and so is a refused value */
ON_LOAD.push(()=>{shapeOpen.clear();shapeRefusal=null;});
/* a change made anywhere else forgets a refused value (a new selection does too: see shapeSection); a feature that
   is gone closes its fields */
ON_COMMIT.push(()=>{
  if(!shapeCommitting)shapeRefusal=null;
  if(shapeEditing&&!S.parts.some(p=>p.id===shapeEditing.id&&p.shape&&p.shape.feats[shapeEditing.k]))shapeEditing=null;
});

/* ---------- self-check: shaping by hand, through the panel ---------- */
SELFTESTS.push(function shapePropsByHand(problems){
  const wrong=text=>problems.push('shape properties: '+text);
  const kept=JSON.stringify(S),keptSel=sel;
  const change=(selector,value)=>{
    const el=$('#props').querySelector(selector);
    if(!el){wrong(`no box ${selector}`);return null;}
    el.value=value;
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return el;
  };
  const click=selector=>{const el=$('#props').querySelector(selector);if(!el){wrong(`no button ${selector}`);return;}el.click();};
  try{
    load(JSON.stringify(blank()),true);
    const[id]=addParts([mk('Leg','2x4',[1.5,30,3.5],[0,0,0])]);
    sel=new Set([id]);commit();
    const leg=()=>S.parts.find(p=>p.id===id);
    if(!/Square cut/.test($('#props').textContent))wrong('a plain piece does not say "Square cut"');
    click('[data-shape-act="open"]');
    // the bottom end angled at 30°
    change('[data-shape="endcut"][data-i="0"]','saw');
    change('[data-shape="field"][data-scope="end"][data-i="0"][data-key="miter"]','30');
    if(!leg().shape||leg().shape.ends[0].miter!==30)wrong('typing 30 into the angle did not cut the end at 30°');
    // a hole by its fields
    click('[data-shape-act="add"][data-kind="hole"]');
    if(!leg().shape||leg().shape.feats.length!==1)wrong('Add hole did not add a hole');
    change('[data-shape="field"][data-scope="feat"][data-i="0"][data-key="d"]','2');
    if(leg().shape.feats[0].d!==2)wrong('the hole did not take its new diameter');
    // a value that makes a STOP is refused, the model unchanged, the box red
    change('[data-shape="field"][data-scope="feat"][data-i="0"][data-key="d"]','3 1/4');
    if(leg().shape.feats[0].d!==2)wrong('a hole too big for the board was taken');
    const box=$('#props').querySelector('[data-shape="field"][data-scope="feat"][data-key="d"]');
    if(!box||!box.classList.contains('bad'))wrong('the refused box is not red');
    if(!$('#props .shp-msg.stop'))wrong('no words say why the value was refused');
    // moved 6" from the top end
    change('[data-shape="pos"][data-key="ufrom"]','1');
    change('[data-shape="pos"][data-key="ud"]','6');
    const c=featureCenter(leg(),leg().shape.feats[0]);
    if(Math.abs(c.u-24)>1e-6)wrong(`the hole is at ${c.u}" along the leg, not 24"`);
    // the solid has the hole: more vertices than a box
    rebuildScene();
    const count=meshes.get(id).children[0].geometry.attributes.position.count;
    if(count<=36)wrong('the 3D solid of the leg has no hole');
    // delete it, undo, redo
    click('[data-shape-act="del"][data-k="0"]');
    if(leg().shape.feats.length)wrong('the delete cross did not delete the hole');
    undo();
    if(!leg().shape||leg().shape.feats.length!==1)wrong('undo did not bring the hole back');
    redo();
    if(leg().shape.feats.length)wrong('redo did not take the hole away again');
    // the same value typed again: no undo step (undo and redo leave nothing selected: select the leg again)
    sel=new Set([id]);renderProps();
    const steps=undoStack.length;
    change('[data-shape="field"][data-scope="end"][data-i="0"][data-key="miter"]','30');
    if(undoStack.length!==steps)wrong('typing the same angle again made an undo step');
    // 0 across the face with no bevel: the end is square again (the stored end is removed)
    change('[data-shape="field"][data-scope="end"][data-i="0"][data-key="miter"]','0');
    if(leg().shape&&leg().shape.ends[0])wrong('an angle of 0 with no bevel did not make the end square again');
    const endBox=$('#props').querySelector('[data-shape="endcut"][data-i="0"]');
    if(!endBox||endBox.value!=='square')wrong('after an angle of 0 the end does not read Square');
    // a refused value is forgotten when the piece is selected again, and after a change made elsewhere
    click('[data-shape-act="add"][data-kind="hole"]');
    const tooBig=()=>change('[data-shape="field"][data-scope="feat"][data-i="0"][data-key="d"]','9');
    tooBig();
    if(!$('#props .shp-msg.stop'))wrong('a hole too big for the leg is not refused in words');
    sel=new Set();renderProps();sel=new Set([id]);renderProps();
    if($('#props .shp-msg.stop'))wrong('a refused value is still shown after the piece was selected again');
    tooBig();
    leg().pos[2]+=1;commit();
    if($('#props .shp-msg.stop'))wrong('a refused value is still shown after the piece was moved');
  }finally{
    shapeEditing=null;shapeRefusal=null;
    load(kept,true);sel=keptSel;renderAll();
  }
});
