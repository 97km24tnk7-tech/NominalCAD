/* NominalCAD: the 3D scene: rendering pieces, view modes, size labels */
'use strict';
/* ---------- 3D ---------- */
const cv=$('#cv');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
/* Colors of everything in the view that is not wood. They follow the interface: one blue (the style sheet's --blue)
   for the selection, the stretch handles and the size lines, and neutral grays for the backdrop and the floor grid. */
const VIEW_COL={
  sel:0x0063a3,        // outline of a selected piece, stretch handles, the board being drawn
  selFill:0x7fb1d1,    // faces of a selected piece
  follow:0x4a9bd9,     // outline of a piece that is fastened to the selection and will move with it (js/connections.js)
  dim:0x0063a3,        // size lines
  dimText:'#004f83',   // size labels
  nameText:'#262c33',  // the label over the selected piece
  labelEdge:'#a9b0b9', // thin border of every label
  grid:0xc5cdd6,gridMid:0xaeb8c3,
  clash:0xef8f8f,clashEdge:0xd32f2f, // pieces that overlap
  printBg:0xffffff,    // pictures for the printed plans get plain white instead of the backdrop,
  printDim:0x262c33,printDimText:'#14181d', // and dark gray size lines and labels, like a drawing (blue is never printed)
};
/* the backdrop: a pale gradient from top to bottom, the same colors as --view-bg in the style sheet */
const VIEW_BG=(()=>{
  const c=document.createElement('canvas');c.width=2;c.height=256;
  const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#d8e2ed');g.addColorStop(.58,'#edf1f5');g.addColorStop(1,'#f6f7f9');
  x.fillStyle=g;x.fillRect(0,0,2,256);
  return new THREE.CanvasTexture(c);
})();
const scene=new THREE.Scene();scene.background=VIEW_BG;
const camera=new THREE.PerspectiveCamera(40,1,1,5000);
scene.add(new THREE.HemisphereLight(0xffffff,0x9c8f7a,.85));
const sun=new THREE.DirectionalLight(0xffffff,.55);sun.position.set(60,120,90);scene.add(sun,sun.target);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0005;sun.shadow.normalBias=.4;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.ShadowMaterial({opacity:.2}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(240,20,VIEW_COL.gridMid,VIEW_COL.grid);scene.add(grid);
const partsGroup=new THREE.Group(),fastGroup=new THREE.Group(),dimGroup=new THREE.Group();scene.add(partsGroup,fastGroup,dimGroup);
const meshes=new Map();
/* A feature file that draws its own things in the 3D view, or changes how pieces look, adds a function here:
     SCENE_EXTRAS.push(function nameOfIt(){ ... });
   rebuildScene() runs them all, in order, after the pieces are in the scene (meshes holds them: id -> Group[mesh, edges])
   and before the frame is drawn. Put anything you add to the scene in a THREE.Group of your own and empty it first
   (emptyGroup). Keep them quick: rebuildScene() runs after every change and every selection. */
const SCENE_EXTRAS=[];
const cam={target:new THREE.Vector3(0,15,0),r:120,th:1.05,ph:1.15};
function updateCam(){const{target:t,r,th,ph}=cam;camera.position.set(t.x+r*Math.sin(ph)*Math.cos(th),t.y+r*Math.cos(ph),t.z+r*Math.sin(ph)*Math.sin(th));camera.lookAt(t);drawAxisSymbol();draw();}
/* The little X / Y / Z symbol in the corner of the view (#axisSym) turns with the camera.
   It uses the names people see in the program: X runs left to right, Y front to back, Z is up.
   Each row: the direction in the scene, its letter, its color (the same colors as the move arrows). */
const AXIS_SYMBOL=[[[1,0,0],'X','#c0392b'],[[0,0,1],'Y','#2e8b57'],[[0,1,0],'Z','#2f6fb5']];
function drawAxisSymbol(){
  const el=$('#axisSym');if(!el)return;
  camera.updateMatrixWorld();
  const m=camera.matrixWorld.elements,mid=38,len=22; // m[0..2] is the camera's right direction, m[4..6] its up direction
  el.innerHTML=AXIS_SYMBOL.map(([d,letter,color])=>{
    const dx=d[0]*m[0]+d[1]*m[1]+d[2]*m[2],dy=-(d[0]*m[4]+d[1]*m[5]+d[2]*m[6]),flat=Math.hypot(dx,dy);
    const line=`<line x1="${mid}" y1="${mid}" x2="${(mid+dx*len).toFixed(1)}" y2="${(mid+dy*len).toFixed(1)}" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>`;
    if(flat<.25)return line; // pointing straight at the viewer: no room for the letter
    return line+`<text x="${(mid+dx/flat*(flat*len+8)).toFixed(1)}" y="${(mid+dy/flat*(flat*len+8)+4).toFixed(1)}" text-anchor="middle" fill="${color}">${letter}</text>`;
  }).join('');
}
let drawQueued=false;
function draw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;placeViewLabels();renderer.render(scene,camera);});} // the labels follow every drawn frame
function resize(){const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();placeViewLabels();renderer.render(scene,camera);}
new ResizeObserver(resize).observe($('#cvWrap'));
function fit(dir){const b=bbox(S.parts);
  if(b){cam.target.set((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2);cam.r=Math.max(30,Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2])*1.7);}
  else{cam.target.set(0,12,0);cam.r=120;}
  if(dir==='front'){cam.th=Math.PI/2;cam.ph=Math.PI/2;}else if(dir==='side'){cam.th=0;cam.ph=Math.PI/2;}else if(dir==='top'){cam.th=Math.PI/2;cam.ph=.001;}
  else if(dir==='fit'){cam.th=1.05;cam.ph=1.15;}
  updateCam();}
function setMeshPos(p){const g=meshes.get(p.id);if(!g)return;const s=size(p);g.position.set(p.pos[0]+s[0]/2,p.pos[1]+s[1]/2,p.pos[2]+s[2]/2);
  const q=quatOf(p);if(q)g.quaternion.copy(q);else g.quaternion.set(0,0,0,1);
  if(explode){const c=explodeCenter,o=g.position;o.set(o.x+(o.x-c[0])*explode,o.y+(o.y-c[1])*explode*.8,o.z+(o.z-c[2])*explode);} // exploded view pushes every piece away from the middle
  else poseIfOpen(p,g);} // a door that is swung open, a drawer that is pulled out: js/motion.js
/* two ways to look at a design: realistic wood, or bright color blocks that are easy to tell apart */
let viewMode='real';try{viewMode=localStorage.getItem('woodshop.view')||'real';}catch(e){}
const grainTex=(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#f6f1e8';x.fillRect(0,0,512,512);
  let seed=7;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
  for(let i=0;i<170;i++){const y=rnd()*512,amp=1+rnd()*5,ph=rnd()*6.28,k=1+Math.floor(rnd()*3);x.strokeStyle=`rgba(96,62,28,${.04+rnd()*.16})`;x.lineWidth=.6+rnd()*2.2;x.beginPath();
    for(let u=0;u<=512;u+=16){const yy=y+Math.sin(u/512*k*6.28+ph)*amp;u?x.lineTo(u,yy):x.moveTo(u,yy);}x.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;})();
function grainUV(geo,s,L,id){ // run the grain along the length of the board on every face; end grain gets a tight pattern
  const uv=geo.attributes.uv,dims=[[2,1],[2,1],[0,2],[0,2],[0,1],[0,1]],o=id*.137%1;
  for(let f=0;f<6;f++){const[ua,va]=dims[f],end=ua!==L&&va!==L;
    for(let i=f*4;i<f*4+4;i++){let u=uv.getX(i)*s[ua]/30,v=uv.getY(i)*s[va]/30;
      if(end){u*=.15;v*=.15;}else if(va===L){const t=u;u=v;v=t;}
      uv.setXY(i,u+o+f*.37,v+o+f*.21);}}
  uv.needsUpdate=true;}
/* Color blocks: one clear color per piece name. Calm enough to sit next to the gray interface, far enough apart to
   tell the pieces from each other, and none of them close to the selection blue or the overlap red. */
const BLOCK=[0xf28e2b,0x59a14f,0xedc948,0xb07aa1,0x76b7b2,0xff9da7,0x9c755f,0x8cd17d,0xd37295,0x499894,0xffbe7d,0xbab0ac,0xd4a6c8,0xb6992d,0x86bcb6,0x79706e];
function blockColors(){const m=new Map();for(const p of S.parts)if(!isProp(p)&&!m.has(p.name))m.set(p.name,BLOCK[m.size%BLOCK.length]);return m;}
/* the color key for the Color blocks look. It can be turned off in the Display pulldown; the choice is remembered. */
let legendOn=true;try{legendOn=localStorage.getItem('woodshop.legend')!=='off';}catch(e){}
function toggleLegend(){
  legendOn=!legendOn;
  try{localStorage.setItem('woodshop.legend',legendOn?'on':'off');}catch(e){}
  renderLegend(viewMode==='real'?null:blockColors());
}
function renderLegend(m){
  const el=$('#legend');
  if(!m||!m.size||!legendOn){el.style.display='none';return;}
  const rows=[...m.entries()];
  el.style.display='';
  el.innerHTML=rows.slice(0,16).map(([name,color])=>`<i style="background:#${color.toString(16).padStart(6,'0')}"></i><span>${esc(name)}</span>`).join('')
    +(rows.length>16?`<span class="rest">and ${rows.length-16} more</span>`:'');
}
/* takes everything out of a group of the scene and frees what it held */
function emptyGroup(g){
  while(g.children.length){const c=g.children.pop();c.traverse(o=>{o.geometry&&o.geometry.dispose();if(o.material){o.material.map&&o.material.map!==grainTex&&o.material.map.dispose();o.material.dispose();}});}
}
function rebuildScene(){
  for(const g of[partsGroup,dimGroup])emptyGroup(g); // fastGroup is kept by drawFasteners(), which only redraws it when something changed
  meshes.clear();fastGroup.visible=true;
  const real=viewMode==='real',shadows=real&&S.parts.length<=1500,blk=blockColors(),painted=FINISHES[look().finish][2]===2;
  renderLegend(real?null:blk);
  const bb=bbox(S.parts);if(bb){ // aim the sun and its shadow at the model
    const c=bb.lo.map((v,i)=>(v+bb.hi[i])/2),r=Math.hypot(bb.hi[0]-bb.lo[0],bb.hi[1]-bb.lo[1],bb.hi[2]-bb.lo[2])/2+10;
    explodeCenter=[c[0],bb.lo[1],c[2]];
    sun.position.set(c[0]+r*.6,c[1]+r*1.5,c[2]+r*.9);sun.target.position.set(c[0],c[1],c[2]);
    const sc=sun.shadow.camera;sc.left=sc.bottom=-r*1.3;sc.right=sc.top=r*1.3;sc.near=.1;sc.far=r*6;sc.updateProjectionMatrix();}
  sun.castShadow=shadows;
  const clash=new Set(findClashes().flatMap(([a,b])=>[a.id,b.id])); // pieces that overlap another piece are drawn red
  for(const p of S.parts){if(hiddenIds.has(p.id))continue;
    // "Show me" (js/visibility.js): its pieces are drawn like selected ones, everything else nearly clear
    const lit=!!spotlightIds&&spotlightIds.has(p.id),ghost=!!spotlightIds&&!lit;
    const s=size(p),geo=new THREE.BoxGeometry(s[0],s[1],s[2]),on=sel.has(p.id)||lit;
    let mat;
    if(propIsSolid(p))mat=new THREE.MeshLambertMaterial({color:on?VIEW_COL.sel:M[p.mat].color});   // a tank light: a dark fixture
    else if(isProp(p))mat=new THREE.MeshLambertMaterial({color:on?VIEW_COL.sel:M[p.mat].color,transparent:true,opacity:.35,depthWrite:false});
    else if(real){grainUV(geo,s,p.ax[0],p.id);mat=new THREE.MeshStandardMaterial({color:on?VIEW_COL.selFill:partColor(p),map:painted?null:grainTex,roughness:.82,metalness:0});}
    else mat=new THREE.MeshLambertMaterial({color:on?VIEW_COL.selFill:blk.get(p.name)});
    if(!isProp(p)&&clash.has(p.id)&&!on)mat.color.setHex(VIEW_COL.clash);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.userData.id=p.id;if(!isProp(p)){mesh.castShadow=mesh.receiveShadow=shadows&&!ghost;}   // a see-through piece throws no shadow
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial(real?{color:on?VIEW_COL.sel:0x3a2a18,transparent:true,opacity:on?1:.3}:{color:on?VIEW_COL.sel:0x222222}));
    if(clash.has(p.id)&&!on){edges.material.color.setHex(VIEW_COL.clashEdge);edges.material.opacity=1;}
    // solid, see-through or outlines only (js/viewmodes.js); "Show me" draws its own picture whatever the view mode is
    if(!spotlightIds)dressForWoodMode(p,mesh,edges,on);
    if(ghost){
      mat.transparent=true;mat.opacity=.07;mat.depthWrite=false;
      edges.material.transparent=true;edges.material.opacity=.14;
    }
    const g=new THREE.Group();g.add(mesh,edges);partsGroup.add(g);meshes.set(p.id,g);setMeshPos(p);}
  drawFasteners(); // screws, pocket holes, dowels, brads, brackets and glue at their real size, into fastGroup: js/fastenerview.js
  for(const extra of SCENE_EXTRAS)extra();
  buildDims();buildHandles();buildGizmo();
  draw();
}
/* ---------- labels inside the 3D scene: only for the pictures of the printed plans (see "labels on screen" below) ---------- */
/* A white label box with a thin gray border that always faces the eye.
   sc is its height: in the scene's own inches, or, when sameSize is true, as a share of the picture's height
   (so that near and far labels of a picture in perspective come out the same size). */
const PICTURE_LABEL=.06; // height of a size label in the overview picture of the plans, as a share of the picture's height
function textSprite(text,pos,sc,color,sameSize){
  const c=document.createElement('canvas'),x=c.getContext('2d'),f='600 38px "Segoe UI",system-ui,Arial';x.font=f;
  c.width=Math.ceil(x.measureText(text).width)+28;c.height=56;x.font=f;
  x.fillStyle='#fff';x.fillRect(0,0,c.width,56);
  x.strokeStyle=VIEW_COL.labelEdge;x.lineWidth=3;x.strokeRect(1.5,1.5,c.width-3,53);
  x.fillStyle=color;x.textBaseline='middle';x.fillText(text,14,30);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,sizeAttenuation:!sameSize}));
  if(sameSize)sc*=2/camera.projectionMatrix.elements[5]; // from a share of the picture's height to the units three.js wants for a sprite that does not shrink with distance
  sp.scale.set(sc*c.width/56,sc,1);sp.position.set(pos[0],pos[1],pos[2]);sp.renderOrder=7;return sp;
}
/* ---------- labels on screen ----------
   In the 3D view on screen a label is a small HTML box laid over the canvas (in #viewLabels), not part of the 3D
   scene. That keeps it as sharp as the rest of the interface and one size however far the view is zoomed, and it
   lets two labels step apart when they would cover each other. (The pictures for the printed plans cannot
   include HTML, so there the labels are drawn into the scene with textSprite.)
     addViewLabel(text, at, kind, lift)   at = a function that returns the [x, y, z] the label belongs to;
                                          kind = '' for a size, 'name' for the selected piece;
                                          lift = how many pixels above that point the label sits
     placeViewLabels()                    puts every label where its point is on screen now; draw() calls it */
const LABEL_HEIGHT=18,LABEL_PAD=12,LABEL_GAP=3,LABEL_EDGE=4; // pixels: box height, side padding and border, space between two labels, space to the edge of the view
let viewLabels=[];
let labelRuler=null; // measures text without asking the page to lay itself out again
function labelWidth(text,bold){
  if(!labelRuler)labelRuler=document.createElement('canvas').getContext('2d');
  labelRuler.font=`${bold?600:400} 11px ${getComputedStyle(document.body).fontFamily}`;
  return Math.ceil(labelRuler.measureText(text).width)+LABEL_PAD;
}
function clearViewLabels(){
  viewLabels=[];
  $('#viewLabels').textContent='';
}
function addViewLabel(text,at,kind,lift){
  const el=document.createElement('span');
  el.className='vlabel'+(kind?' '+kind:'');
  el.textContent=text;
  el.style.display='none'; // until placeViewLabels knows where it goes
  $('#viewLabels').appendChild(el);
  viewLabels.push({el,at,lift:lift||0,w:labelWidth(text,kind!=='name'),h:LABEL_HEIGHT});
}
function placeViewLabels(){
  const holder=$('#viewLabels'),show=dimGroup.visible&&viewLabels.length>0; // the size lines are hidden while a piece is dragged, and so are the labels
  holder.hidden=!show;
  if(!show)return;
  const W=cv.clientWidth,H=cv.clientHeight,placed=[],point=new THREE.Vector3();
  const within=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  for(const label of viewLabels){
    const p=label.at();
    point.set(p[0],p[1],p[2]).project(camera);
    if(point.z<-1||point.z>1){label.el.style.display='none';continue;} // behind the eye
    // centred on its point (raised by its lift), but never outside the view
    let x=within((point.x+1)/2*W-label.w/2,LABEL_EDGE,W-label.w-LABEL_EDGE);
    let y=within((1-point.y)/2*H-label.h/2-label.lift,LABEL_EDGE,H-label.h-LABEL_EDGE);
    // step below or above a label that is already there, whichever is the shorter move
    for(let tries=0;tries<viewLabels.length;tries++){
      const other=placed.find(o=>x<o.x+o.w+LABEL_GAP&&x+label.w+LABEL_GAP>o.x&&y<o.y+o.h+LABEL_GAP&&y+label.h+LABEL_GAP>o.y);
      if(!other)break;
      const down=other.y+other.h+LABEL_GAP-y,up=y+label.h+LABEL_GAP-other.y;
      y=down<=up&&other.y+other.h+LABEL_GAP+label.h<=H-LABEL_EDGE?y+down:y-up;
    }
    placed.push({x,y,w:label.w,h:label.h});
    label.el.style.display='';
    label.el.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
}

/* The overall size lines (width, depth, height) and the label of the selected piece.
   On screen the lines are in the 3D scene and their labels are HTML (see above). While takePictures() draws the
   plans (forceDims is true) the labels are sprites in the scene, and there is no selection to label. */
function buildDims(){
  clearViewLabels();
  dimGroup.visible=true;
  const b=bbox(S.parts),forPicture=forceDims;
  if(!b||explode||(!$('#showDims').checked&&!forPicture))return; // nothing to measure; or pulled apart, when the overall size means nothing
  const d=Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]);
  const sc=Math.max(2.2,d*.035)*(forPicture?1.5:1); // the unit the lines are laid out in: larger in a picture, where the labels are larger too
  const off=sc*1.6,tk=sc*.45;
  const dim=(k,a,z,along)=>{ // a = start corner, k = axis measured, z = axis the tick marks run along, along = where on the line the label sits (0 to 1)
    const e=a.slice();e[k]=b.hi[k];
    dimGroup.add(dimLine(a,e,z,tk));
    const spot=a.map((v,i)=>v+(e[i]-v)*along),text=fmtFt(b.hi[k]-b.lo[k]);
    if(forPicture)dimGroup.add(textSprite(text,spot,PICTURE_LABEL,VIEW_COL.dimText,true));
    else addViewLabel(text,()=>spot,'',0);
  };
  dim(0,[b.lo[0],b.lo[1],b.hi[2]+off],2,.5);       // width, along the front at floor level
  dim(2,[b.hi[0]+off,b.lo[1],b.lo[2]],0,.5);       // depth, along the right side
  dim(1,[b.hi[0]+off,b.lo[1],b.hi[2]+off],0,.62);  // height, at the front right corner; its label sits above the middle, clear of the depth label that ends at the same corner
  if(sel.size===1&&!forPicture){
    const p=selParts()[0],pb=box(p),m=M[p.mat],middle=selCenter();
    // The label sits above the piece. A selected piece also carries the move arrows, and the blue one points up
    // from its middle by ARROW_REACH times the arrow length (transform.js): the label goes above whichever is higher.
    const above=()=>[(pb.lo[0]+pb.hi[0])/2,Math.max(pb.hi[1],tool==='select'&&!modal?middle[1]+cam.r*GIZMO_SIZE*ARROW_REACH:0),(pb.lo[2]+pb.hi[2])/2];
    addViewLabel(isProp(p)?p.name:`${p.name}: ${m.short}, ${fmt(p.l)} long`,above,'name',LABEL_HEIGHT/2+8);
  }
  placeViewLabels();
}
/* one size line from a to e with a short tick across each end; the ticks run along axis z and are tk long each way */
function dimLine(a,e,z,tk){
  const pts=[];
  for(const p of[a,e]){const t0=p.slice(),t1=p.slice();t0[z]-=tk;t1[z]+=tk;pts.push(t0,t1);}
  pts.push(a,e);
  const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2]))),
    new THREE.LineBasicMaterial({color:VIEW_COL.dim,depthTest:false}));
  line.renderOrder=6;
  return line;
}

