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
function draw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;renderer.render(scene,camera);});}
function resize(){const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}
new ResizeObserver(resize).observe($('#cvWrap'));
function fit(dir){const b=bbox(S.parts);
  if(b){cam.target.set((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2);cam.r=Math.max(30,Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2])*1.7);}
  else{cam.target.set(0,12,0);cam.r=120;}
  if(dir==='front'){cam.th=Math.PI/2;cam.ph=Math.PI/2;}else if(dir==='side'){cam.th=0;cam.ph=Math.PI/2;}else if(dir==='top'){cam.th=Math.PI/2;cam.ph=.001;}
  else if(dir==='fit'){cam.th=1.05;cam.ph=1.15;}
  updateCam();}
function setMeshPos(p){const g=meshes.get(p.id);if(!g)return;const s=size(p);g.position.set(p.pos[0]+s[0]/2,p.pos[1]+s[1]/2,p.pos[2]+s[2]/2);
  const q=quatOf(p);if(q)g.quaternion.copy(q);else g.quaternion.set(0,0,0,1);
  if(explode){const c=explodeCenter,o=g.position;o.set(o.x+(o.x-c[0])*explode,o.y+(o.y-c[1])*explode*.8,o.z+(o.z-c[2])*explode);}} // exploded view pushes every piece away from the middle
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
function rebuildScene(){
  for(const g of[partsGroup,fastGroup,dimGroup])while(g.children.length){const c=g.children.pop();c.traverse(o=>{o.geometry&&o.geometry.dispose();if(o.material){o.material.map&&o.material.map!==grainTex&&o.material.map.dispose();o.material.dispose();}});}
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
  for(const p of S.parts){if(hiddenIds.has(p.id))continue;const s=size(p),geo=new THREE.BoxGeometry(s[0],s[1],s[2]),on=sel.has(p.id);
    let mat;
    if(isProp(p))mat=new THREE.MeshLambertMaterial({color:on?VIEW_COL.sel:M[p.mat].color,transparent:true,opacity:.35,depthWrite:false});
    else if(real){grainUV(geo,s,p.ax[0],p.id);mat=new THREE.MeshStandardMaterial({color:on?VIEW_COL.selFill:partColor(p),map:painted?null:grainTex,roughness:.82,metalness:0});}
    else mat=new THREE.MeshLambertMaterial({color:on?VIEW_COL.selFill:blk.get(p.name)});
    if(!isProp(p)){if(clash.has(p.id)&&!on)mat.color.setHex(VIEW_COL.clash);if(xray){mat.transparent=true;mat.opacity=.35;mat.depthWrite=false;}}
    const mesh=new THREE.Mesh(geo,mat);
    mesh.userData.id=p.id;if(!isProp(p)){mesh.castShadow=mesh.receiveShadow=shadows;}
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial(real?{color:on?VIEW_COL.sel:0x3a2a18,transparent:true,opacity:on?1:.3}:{color:on?VIEW_COL.sel:0x222222}));
    if(clash.has(p.id)&&!on){edges.material.color.setHex(VIEW_COL.clashEdge);edges.material.opacity=1;}
    const g=new THREE.Group();g.add(mesh,edges);partsGroup.add(g);meshes.set(p.id,g);setMeshPos(p);}
  if($('#showFast').checked&&S.parts.length<=600&&!lite)for(const j of findJoints()){const type=jType(j);if(type==='none'||type==='glue')continue;
    const n=jSpec(j,type).n,lu=j.ru[1]-j.ru[0]>=j.rv[1]-j.rv[0];
    for(let i=0;i<n;i++){const t=(i+.5)/n,pos=[0,0,0];pos[j.k]=j.plane;
      pos[j.u]=lu?j.ru[0]+(j.ru[1]-j.ru[0])*t:(j.ru[0]+j.ru[1])/2;pos[j.v]=lu?(j.rv[0]+j.rv[1])/2:j.rv[0]+(j.rv[1]-j.rv[0])*t;
      const m=new THREE.Mesh(new THREE.SphereGeometry(.32,10,8),new THREE.MeshBasicMaterial({color:JTYPES[type][1],depthTest:false,transparent:true,opacity:.85}));
      m.renderOrder=5;m.position.set(pos[0],pos[1],pos[2]);fastGroup.add(m);}}
  buildDims();buildHandles();buildGizmo();
  draw();
}
/* overall size lines and a label on the selected piece, drawn in the 3D view */
function textSprite(text,pos,sc,color){ // a white label box with a thin gray border, like the labels in the interface
  const c=document.createElement('canvas'),x=c.getContext('2d'),f='600 38px "Segoe UI",system-ui,Arial';x.font=f;
  c.width=Math.ceil(x.measureText(text).width)+28;c.height=56;x.font=f;
  x.fillStyle='#fff';x.fillRect(0,0,c.width,56);
  x.strokeStyle=VIEW_COL.labelEdge;x.lineWidth=3;x.strokeRect(1.5,1.5,c.width-3,53);
  x.fillStyle=color;x.textBaseline='middle';x.fillText(text,14,30);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));
  sp.scale.set(sc*c.width/56,sc,1);sp.position.set(pos[0],pos[1],pos[2]);sp.renderOrder=7;return sp;
}
function buildDims(only){ // only = which directions to label (used for the flat drawings); leave empty for all three
  if(only)while(dimGroup.children.length){const c=dimGroup.children.pop();c.geometry&&c.geometry.dispose();if(c.material){c.material.map&&c.material.map.dispose();c.material.dispose();}}
  dimGroup.visible=true;const b=bbox(S.parts);if(!b||(!$('#showDims').checked&&!forceDims))return;
  const d=Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]),sc=Math.max(2.2,d*.035),off=sc*1.6,tk=sc*.45;
  const mat=()=>new THREE.LineBasicMaterial({color:VIEW_COL.dim,depthTest:false});
  const dim=(k,a,z)=>{ // a = start corner, k = axis measured, z = axis the tick marks run along
    const e=a.slice();e[k]=b.hi[k];const pts=[];
    for(const p of[a,e]){const t0=p.slice(),t1=p.slice();t0[z]-=tk;t1[z]+=tk;pts.push(t0,t1);}
    pts.push(a,e);
    const ln=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2]))),mat());ln.renderOrder=6;
    const mid=a.map((v,i)=>(v+e[i])/2);dimGroup.add(ln,textSprite(fmtFt(b.hi[k]-b.lo[k]),mid,sc,VIEW_COL.dimText));};
  if(!only||only.includes(0))dim(0,[b.lo[0],b.lo[1],b.hi[2]+off],2);          // width, along the front at floor level
  if(!only||only.includes(2))dim(2,[b.hi[0]+off,b.lo[1],b.lo[2]],0);          // depth, along the right side
  if(!only||only.includes(1))dim(1,[b.hi[0]+off,b.lo[1],b.hi[2]+off],0);      // height, at the front right corner
  if(sel.size===1){const p=selParts()[0],pb=box(p),m=M[p.mat];
    dimGroup.add(textSprite(isProp(p)?p.name:`${p.name}: ${m.short}, ${fmt(p.l)} long`,[(pb.lo[0]+pb.hi[0])/2,pb.hi[1]+sc*.9,(pb.lo[2]+pb.hi[2])/2],sc*.8,VIEW_COL.nameText));}
}

