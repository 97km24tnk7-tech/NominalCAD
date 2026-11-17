/* NominalCAD: the 3D solid of a shaped piece (design\specs\03, section 5b).

     pieceGeometry(p)   {geometry, edges, bad} for a piece with p.shape: the outline of js/shapes.js extruded
                        through the thickness, with every through opening a real hole, in the world axes of the
                        piece and centered on its blank (the 3D view places it like any box, setMeshPos). The
                        geometry is shared by every piece with the same shape and size (userData.shared), so the
                        3D view must not dispose it (emptyGroup, js/view3d.js).
     badOutlines(p)     red outline loops of the features that do not fit (they are not cut into the solid)

   How it is made (three.js r128 as vendored, nothing else):
     1. THREE.Shape from the outline, centered (u - l/2, v - w/2); each opening a THREE.Path in shape.holes;
        ExtrudeGeometry along z from 0 to t (two layers for a ridge), curves already cut into straight pieces.
     2. A bevel needs no plane clipper: every vertex on a saw end moves along u, into the piece, by
        ds tan(bevel) / cos(miter) (ds measured from the long face); a ridge point by |s - t/2| tan(deg).
     3. (u, v, s) goes to the world axes ax[0], ax[1], ax[2]; when ax is an odd permutation (a mirror image of the
        local frame) every triangle is turned round so its face still points out.
     4. UVs by each face's main direction (grain along the length), then EdgesGeometry at 25 degrees, so the
        facets of a curve draw no lines and its rims do. */
'use strict';

const SHAPE_GEOMETRY_KEPT=300;   // the cache is trimmed of pieces not drawn this time once it holds more than this
const shapeGeometryCache=new Map();
let shapeGeneration=0;           // counted up by every rebuildScene (js/view3d.js), so old entries can be found

const axOdd=ax=>{let swaps=0;const a=ax.slice();for(let i=0;i<3;i++)while(a[i]!==i){const j=a[i];[a[i],a[j]]=[a[j],a[i]];swaps++;}return swaps%2===1;};

function pieceGeometry(p){
  // (ax is in the key: the vertices are written in world axes)
  const key=[JSON.stringify(p.shape),p.l,p.w,p.t,p.ax.join()].join('|');
  let entry=shapeGeometryCache.get(key);
  if(!entry){
    entry=buildShapedGeometry(p);
    shapeGeometryCache.set(key,entry);
  }
  entry.used=shapeGeneration;
  return entry;
}
/* called at the start of every rebuildScene: frees the shapes not drawn last time once the cache is large */
function nextShapeGeneration(){
  shapeGeneration++;
  if(shapeGeometryCache.size<=SHAPE_GEOMETRY_KEPT)return;
  for(const[key,entry]of shapeGeometryCache){
    if(entry.used<shapeGeneration-1){
      entry.geometry.dispose();
      entry.edges.dispose();
      shapeGeometryCache.delete(key);
    }
  }
}

function buildShapedGeometry(p){
  const l=p.l,w=p.w,t=p.t,outline=shapeOutline(p);
  const shape=new THREE.Shape(outline.outer.map(q=>new THREE.Vector2(q.u-l/2,q.v-w/2)));
  for(const ring of outline.openings)shape.holes.push(new THREE.Path(ring.map(([u,v])=>new THREE.Vector2(u-l/2,v-w/2))));
  const ridge=[0,1].some(i=>{const e=shapeEnd(p,i);return e&&e.cut==='point'&&e.across==='t';});
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:t,steps:ridge?2:1,bevelEnabled:false,curveSegments:1});

  // which outline points move with the depth (a bevel, a ridge): looked up by where they are on the face
  const moving=new Map();
  for(const q of outline.outer){
    if(q.tag==='cut'||q.tag==='ridge')moving.set((q.u-l/2).toFixed(5)+','+(q.v-w/2).toFixed(5),q);
  }
  const position=geometry.attributes.position,uv=geometry.attributes.uv,count=position.count;
  const local=[];
  for(let i=0;i<count;i++){
    let u=position.getX(i),v=position.getY(i);
    const s=position.getZ(i);
    const q=moving.size?moving.get(u.toFixed(5)+','+v.toFixed(5)):null;
    if(q){const shift=shiftAt(p,q,s);u+=q.end===1?-shift:shift;}
    local.push([u,v,s-t/2]);
  }
  // into the world axes of the piece
  const out=new Float32Array(count*3);
  for(let i=0;i<count;i++)for(let k=0;k<3;k++)out[i*3+p.ax[k]]=local[i][k];
  const odd=axOdd(p.ax);
  const result=new THREE.BufferGeometry();
  const uvs=new Float32Array(count*2);
  // planar UVs, worked out per triangle from its own direction in the piece's frame
  for(let i=0;i<count;i+=3){
    const a=local[i],b=local[i+1],c=local[i+2];
    const n=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])].map(Math.abs);
    const main=n[2]>=n[0]&&n[2]>=n[1]?2:n[1]>=n[0]?1:0;
    for(let j=0;j<3;j++){
      const q=local[i+j];
      let x,y;
      if(main===2){x=q[0]/30;y=q[1]/30;}            // the faces: grain along the length
      else if(main===1){x=q[0]/30;y=q[2]/30;}       // the edges
      else{x=q[1]/30*.15;y=q[2]/30*.15;}            // the ends and the walls of the openings: tight end grain
      uvs[(i+j)*2]=x;uvs[(i+j)*2+1]=y;
    }
  }
  if(odd){
    // swap the 2nd and 3rd corner of every triangle, so each face keeps pointing out of the wood
    for(let i=0;i<count;i+=3){
      for(let k=0;k<3;k++){const x=out[(i+1)*3+k];out[(i+1)*3+k]=out[(i+2)*3+k];out[(i+2)*3+k]=x;}
      for(let k=0;k<2;k++){const x=uvs[(i+1)*2+k];uvs[(i+1)*2+k]=uvs[(i+2)*2+k];uvs[(i+2)*2+k]=x;}
    }
  }
  geometry.dispose();
  result.setAttribute('position',new THREE.BufferAttribute(out,3));
  result.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.shared=true;
  const edges=new THREE.EdgesGeometry(result,25);
  edges.userData.shared=true;
  return{geometry:result,edges,bad:outline.bad,used:shapeGeneration};
}

/* the features that do not fit, as red loops on both faces, in the same centered world axes as the solid */
function badOutlines(p){
  const bad=hasShape(p)?misfits(p).bad:[];
  if(!bad.length)return null;
  const points=[];
  for(const f of bad){
    let ring=openingPoints(p,f);
    if(!ring){const b=featureBounds(p,f);ring=[[b.u0,b.v0],[b.u1,b.v0],[b.u1,b.v1],[b.u0,b.v1]];}
    for(const s of[0,p.t]){
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        for(const q of[a,b]){
          const world=[0,0,0];
          world[p.ax[0]]=q[0]-p.l/2;world[p.ax[1]]=q[1]-p.w/2;world[p.ax[2]]=s-p.t/2;
          points.push(...world);
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(points),3));
  // drawn over everything, in a plain bright red (a 1px line of the darker clash red reads nearly black over the wood)
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:SHAPE_MISFIT_RED,depthTest:false,transparent:true}));
  lines.renderOrder=10;
  return lines;
}
const SHAPE_MISFIT_RED=0xff1a1a;

/* ---------- self-checks ---------- */
/* a test piece: a 2x4 laid flat along x, or any material and axes */
function shapeTestPiece(mat,l,w,t,ax,shape){
  const p={id:-1,name:'Test',mat,l,w,t,ax:ax||[0,2,1],pos:[0,0,0]};
  if(shape){p.shape=shape;tidyShape(p);}
  return p;
}
SELFTESTS.push(function shapeSolidsMeasureTrue(problems){
  const wrong=text=>problems.push('shapes: '+text);
  const meshVolume=geometry=>{
    const a=geometry.attributes.position.array;let v=0;
    for(let i=0;i<a.length;i+=9){
      v+=(a[i]*(a[i+4]*a[i+8]-a[i+5]*a[i+7])-a[i+1]*(a[i+3]*a[i+8]-a[i+5]*a[i+6])+a[i+2]*(a[i+3]*a[i+7]-a[i+4]*a[i+6]))/6;
    }
    return v;
  };
  const S1={v:1,ends:[{cut:'saw',miter:11,long:0},{cut:'round',r:1.75}],corners:[null,null,null,null],feats:[{kind:'hole',d:.375,at:{u:{from:1,d:1.75},v:{from:'mid',d:0}}}]};
  const S2={v:1,ends:[{cut:'saw',miter:30,long:1,bevel:45,bevelLong:1},{cut:'point',deg:30,across:'t'}],corners:[null,null,null,null],feats:[{kind:'slot',d:.5,len:3,dir:'u',at:{u:{from:'mid',d:0},v:{from:'mid',d:0}}}]};
  const S3={v:1,ends:[null,null],corners:[{cut:'clip',a:2,b:1},{cut:'round',r:1},{cut:'notch',a:1.5,b:1},null],feats:[{kind:'cutout',a:4,b:1.25,r:.5,at:{u:{from:0,d:8},v:{from:'mid',d:0}}},{kind:'notch',edge:1,len:3.5,depth:1,at:{u:{from:1,d:6}}}]};
  const shapes=[S1,S2,S3,{v:1,ends:[{cut:'point',deg:45,across:'w'},null],corners:[null,null,null,null],feats:[]}];
  const perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const shape of shapes){
    for(const ax of perms){
      const p=shapeTestPiece('2x4',20,3.5,1.5,ax,JSON.parse(JSON.stringify(shape)));
      const solid=buildShapedGeometry(p),volume=meshVolume(solid.geometry),want=pieceVolume(p);
      // (a solid whose faces point inward has a negative volume)
      if(!(Math.abs(volume-want)<=want*.005))wrong(`the solid of ${shapeNote(p)} along ${ax.join('')} measures ${volume.toFixed(2)} cu in, not ${want.toFixed(2)}`);
      const box=solid.geometry.boundingBox,s=size(p);
      for(let k=0;k<3;k++){
        if(Math.abs(box.max.getComponent(k)-box.min.getComponent(k)-s[k])>.011)wrong(`the solid of ${shapeNote(p)} along ${ax.join('')} is not as big as its blank`);
      }
      solid.geometry.dispose();solid.edges.dispose();
    }
  }
});
SELFTESTS.push(function shapeRaysThroughHoles(problems){
  const p=shapeTestPiece('ply34',48,24,.75,[0,2,1],{v:1,ends:[null,null],corners:[null,null,null,null],feats:[{kind:'hole',d:6,at:{u:{from:1,d:9},v:{from:'mid',d:0}}}]});
  const solid=buildShapedGeometry(p),mesh=new THREE.Mesh(solid.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.updateMatrixWorld();
  const caster=new THREE.Raycaster();
  const hits=(x,z)=>{caster.set(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));return caster.intersectObject(mesh).length;};
  // the hole's center is 9" from end 1 (u = 39), centered (v = 12); the solid is centered on the blank
  if(hits(39-24,0))problems.push('shapes: a ray through the middle of a 6" hole hits the deck');
  if(!hits(39-24+3.25,0))problems.push('shapes: a ray 1/4" outside a 6" hole misses the deck');
  solid.geometry.dispose();solid.edges.dispose();mesh.material.dispose();
});
SELFTESTS.push(function shapesStayQuick(problems){
  // 200 shaped pieces of 20 kinds (spec 03, section 6): the solids within 300 ms
  const started=performance.now(),made=[];
  for(let i=0;i<200;i++){
    const kind=i%20,shape={v:1,ends:[kind%4===1?{cut:'saw',miter:5+kind}:null,kind%4===2?{cut:'round',r:1}:kind%4===3?{cut:'point',deg:20+kind}:null],
      corners:[null,null,null,null],feats:kind%2?[{kind:'hole',d:.5+kind/20,at:{u:{from:0,d:4},v:{from:'mid',d:0}}}]:[]};
    const p=shapeTestPiece('2x4',24+kind,3.5,1.5,[0,2,1],shape);
    made.push(buildShapedGeometry(p));
  }
  const took=performance.now()-started;
  for(const solid of made){solid.geometry.dispose();solid.edges.dispose();}
  if(took>300)problems.push(`shapes: 200 shaped pieces took ${Math.round(took)} ms to build (300 at most)`);
});
