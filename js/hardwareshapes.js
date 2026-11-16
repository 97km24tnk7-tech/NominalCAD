/* NominalCAD: drawing the hardware of the design (S.hardware, js/hardware.js) in the 3D view.

   A shape in the catalog is a short list of boxes and cylinders, written in the hardware's own frame:
     x runs along it (item.u), y points out of the face it is mounted on (item.n), z is square to both;
     the origin is where it sits (item.at).
       {box: [sizeX, sizeY, sizeZ], at: [x, y, z], color}
       {cyl: [radius, length], at: [x, y, z], axis: 'x' | 'y' | 'z', color}     color is a name from HW_COLOR
   A shape has two parts: "on" is fixed to the piece the hardware is mounted on, "to" to the second piece (the
   frame half of a hinge, the cabinet half of a drawer slide).

   Each part is one mesh, and it is added to the 3D group of its piece. So it moves, turns, hides, explodes and
   swings open with that piece without any code here. Hardware is drawn in every view mode, always solid.

     hardwareMeshes          what is on screen: meshes with userData.hw = the id of the item (for picking)
     hardwareShape(item, part)   the mesh geometry of one part ('on' or 'to'), made once per kind and size
     hardwareMatrix(item)    the placement of an item in the frame of the piece it is on (THREE.Matrix4)
     pieceFrame(piece)       the placement of a piece's own frame in the world, closed (THREE.Matrix4) */
'use strict';

let hardwareMeshes=[];
const shapeMemo=new Map(); // 'kind|size|geo|part' -> geometry

/* boxes and cylinders melted into one geometry, each with its own color */
function meltShape(prims){
  const positions=[],normals=[],colors=[],color=new THREE.Color();
  for(const prim of prims){
    let shape;
    if(prim.box)shape=new THREE.BoxGeometry(prim.box[0],prim.box[1],prim.box[2]);
    else{
      shape=new THREE.CylinderGeometry(prim.cyl[0],prim.cyl[0],prim.cyl[1],14); // stands along y
      if(prim.axis==='x')shape.rotateZ(Math.PI/2);
      else if(prim.axis==='z')shape.rotateX(Math.PI/2);
    }
    shape.translate(prim.at[0],prim.at[1],prim.at[2]);
    const flat=shape.toNonIndexed(),p=flat.attributes.position.array,n=flat.attributes.normal.array;
    color.setHex(HW_COLOR[prim.color]||HW_COLOR.steel);
    for(let i=0;i<p.length;i+=3){
      positions.push(p[i],p[i+1],p[i+2]);
      normals.push(n[i],n[i+1],n[i+2]);
      colors.push(color.r,color.g,color.b);
    }
    shape.dispose();flat.dispose();
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  out.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  out.dispose=()=>{}; // shared by every item of this kind and size: emptyGroup() must not free it
  return out;
}
function hardwareShape(item,part){
  const key=[item.kind,item.size,JSON.stringify(item.geo||{}),part].join('|');
  if(!shapeMemo.has(key)){
    const prims=HARDWARE[item.kind].shape(item.size,item.geo||{})[part];
    shapeMemo.set(key,prims.length?meltShape(prims):null);
  }
  return shapeMemo.get(key);
}
function hardwareMatrix(item){
  const x=new THREE.Vector3(item.u[0],item.u[1],item.u[2]),y=new THREE.Vector3(item.n[0],item.n[1],item.n[2]);
  return new THREE.Matrix4().makeBasis(x,y,new THREE.Vector3().crossVectors(x,y)).setPosition(item.at[0],item.at[1],item.at[2]);
}
function pieceFrame(piece){
  return new THREE.Matrix4().compose(pieceMiddle(piece),quatOf(piece)||new THREE.Quaternion(),new THREE.Vector3(1,1,1));
}

SCENE_EXTRAS.push(function drawHardware(){
  hardwareMeshes=[];
  const list=hardwareList();
  if(!list.length)return;
  const pieces=pieceMap();
  const add=(group,shape,matrix,item)=>{
    const isPicked=!!picked&&picked.type==='hw'&&picked.id===item.id;
    const mesh=new THREE.Mesh(shape,new THREE.MeshLambertMaterial(isPicked?{color:VIEW_COL.selFill,emissive:VIEW_COL.sel,emissiveIntensity:.55}:{vertexColors:true}));
    mesh.matrixAutoUpdate=false;
    mesh.matrix.copy(matrix);
    mesh.userData.hw=item.id;
    group.add(mesh);
    hardwareMeshes.push(mesh);
  };
  for(const item of list){
    const host=pieces.get(item.on),hostGroup=meshes.get(item.on);
    if(!host||!hostGroup)continue; // its piece is hidden
    const inHost=hardwareMatrix(item),onShape=hardwareShape(item,'on'),toShape=hardwareShape(item,'to');
    if(onShape)add(hostGroup,onShape,inHost,item);
    if(!toShape)continue;
    const other=item.to==null?null:pieces.get(item.to);
    if(!other){add(hostGroup,toShape,inHost,item);continue;} // nothing to be fixed to: the whole thing stays on its piece
    const otherGroup=meshes.get(other.id);
    if(!otherGroup)continue;
    // the same place in the world, written in the frame of the second piece
    const inOther=pieceFrame(other).invert().multiply(pieceFrame(host)).multiply(inHost);
    add(otherGroup,toShape,inOther,item);
  }
});
