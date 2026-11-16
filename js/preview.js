/* NominalCAD: the small 3D picture in the Furniture presets dialog.

   It shows what the sizes typed so far will build, before anything is created, so the effect of a number can be
   seen without leaving the dialog. It is a second, very plain 3D view of its own: flat wood colors, no grain,
   no shadows, no size lines. It never touches the main view or the design on screen.

     showPreview(holder, parts)   draws these pieces (the list a preset's build() returns) inside the element
                                  `holder`, as large as the holder is. An empty list clears the picture.

   A whole fish room is thousands of pieces. That stays fast because all the wood is drawn in one go (one
   "instanced" mesh: the same box, placed and sized once per piece). */
'use strict';

const PREVIEW_EDGES_MAX=600;   // above this many pieces the thin outlines are left out (each one is drawn on its own)
const PREVIEW_EDGE_COLOR=0x3a2a18;
const PREVIEW_ANGLE={around:1.05,down:1.15}; // the same three-quarter view the main 3D view starts in (cam.th, cam.ph)

let previewKit=null;       // the renderer, scene and camera; made the first time a picture is needed
let previewFailed=false;   // true when this browser would not give the program a second 3D view

function previewSetup(){
  const canvas=document.createElement('canvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}); // alpha: the holder's own background shows through
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,1,40000);
  const sun=new THREE.DirectionalLight(0xffffff,.55);
  const content=new THREE.Group();     // the pieces; emptied and refilled for every picture
  scene.add(new THREE.HemisphereLight(0xffffff,0x8d96a0,.85),sun,sun.target,content);
  const box=new THREE.BoxGeometry(1,1,1);
  const kit={
    canvas,renderer,scene,camera,sun,content,
    box,                                                    // one box, 1 x 1 x 1, stretched to the size of each piece
    edges:new THREE.EdgesGeometry(box),
    edgeMaterial:new THREE.LineBasicMaterial({color:PREVIEW_EDGE_COLOR,transparent:true,opacity:.4}),
    holder:null,                                            // the element the canvas is in right now
    middle:new THREE.Vector3(),across:1,                    // what the camera looks at, and how big it is corner to corner
  };
  kit.watch=new ResizeObserver(()=>renderPreview());        // the dialog opened or changed size: draw at the new size
  return kit;
}

/* where a piece is, how it is turned and how big it is, as one matrix for the unit box */
function previewMatrix(p){
  const s=size(p);
  const position=new THREE.Vector3(p.pos[0]+s[0]/2,p.pos[1]+s[1]/2,p.pos[2]+s[2]/2);
  return new THREE.Matrix4().compose(position,quatOf(p)||new THREE.Quaternion(),new THREE.Vector3(s[0],s[1],s[2]));
}

function showPreview(holder,parts){
  if(previewFailed||!holder)return;
  if(!previewKit){
    try{previewKit=previewSetup();}
    catch(err){previewFailed=true;}   // no second 3D view in this browser: the dialog works without the picture
  }
  if(previewFailed){holder.hidden=true;return;}
  const kit=previewKit;
  if(kit.holder!==holder){            // the form was drawn again: move the picture into its new place
    kit.watch.disconnect();
    holder.appendChild(kit.canvas);
    kit.watch.observe(holder);
    kit.holder=holder;
  }

  // out with the pieces of the last picture (the box and the outline shape are shared and stay)
  while(kit.content.children.length){
    const old=kit.content.children.pop();
    if(old.isInstancedMesh){old.dispose();old.material.dispose();}
  }
  kit.canvas.hidden=!parts.length;
  if(!parts.length)return;

  // all the wood as one mesh, and everything that is not wood (tanks, lights, a mattress, windows) as a see-through one
  const wood=parts.filter(p=>!isProp(p)),other=parts.filter(isProp),color=new THREE.Color();
  const groups=[
    [wood,new THREE.MeshLambertMaterial()],
    [other,new THREE.MeshLambertMaterial({transparent:true,opacity:.35,depthWrite:false})],
  ];
  for(const[pieces,material]of groups){
    if(!pieces.length){material.dispose();continue;}
    const mesh=new THREE.InstancedMesh(kit.box,material,pieces.length);
    pieces.forEach((p,i)=>{
      mesh.setMatrixAt(i,previewMatrix(p));
      mesh.setColorAt(i,color.setHex(M[p.mat].color));
    });
    mesh.frustumCulled=false; // three.js would judge "is it on screen" by the single unit box, which is the wrong place
    kit.content.add(mesh);
  }
  if(parts.length<=PREVIEW_EDGES_MAX){
    for(const p of wood){
      const outline=new THREE.LineSegments(kit.edges,kit.edgeMaterial);
      outline.matrixAutoUpdate=false;
      outline.matrix.copy(previewMatrix(p));
      kit.content.add(outline);
    }
  }

  const b=bbox(parts);
  kit.middle.set((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2);
  kit.across=Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]);
  renderPreview();
}

/* draws the picture at the size its holder has now, with the whole design in view */
function renderPreview(){
  const kit=previewKit;
  if(!kit||!kit.holder)return;
  const width=kit.holder.clientWidth,height=kit.holder.clientHeight;
  if(!width||!height)return;          // the dialog is closed; the picture is drawn when it opens
  const camera=kit.camera,aspect=width/height;
  kit.renderer.setSize(width,height,false);
  camera.aspect=aspect;
  camera.updateProjectionMatrix();
  // far enough away that a ball around the design fits the view, top to bottom and side to side
  const halfAngle=camera.fov/2*Math.PI/180;
  const distance=kit.across/2/Math.sin(halfAngle)/Math.min(1,aspect)*.92;
  const{around,down}=PREVIEW_ANGLE,m=kit.middle;
  camera.position.set(m.x+distance*Math.sin(down)*Math.cos(around),m.y+distance*Math.cos(down),m.z+distance*Math.sin(down)*Math.sin(around));
  camera.lookAt(m);
  kit.sun.position.copy(camera.position).add(new THREE.Vector3(distance*.3,distance*.6,0)); // light from above the eye, a little to one side
  kit.sun.target.position.copy(m);
  kit.renderer.render(kit.scene,camera);
}
