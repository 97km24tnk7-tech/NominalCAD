/* NominalCAD: how a piece is turned in space.
   Most pieces sit square to the world; p.ax says which way their length, width and thickness run.
   On top of that a piece can carry a free rotation about its own center, stored one of two ways:
     p.rot = {k, deg}   a tilt about one world axis (written by presets and the Angle fields)
     p.q   = [x,y,z,w]  any rotation at all (written by the Rotate tool and the R key)
   Quarter turns are always folded back into p.ax, so square pieces keep snapping and joint detection. */
'use strict';
const AXV=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
function quatOf(p){
  if(p.q)return new THREE.Quaternion(p.q[0],p.q[1],p.q[2],p.q[3]);
  if(p.rot&&p.rot.deg)return new THREE.Quaternion().setFromAxisAngle(AXV[p.rot.k],p.rot.deg*Math.PI/180);
  return null;}
const tilted=p=>!!(p.q||(p.rot&&p.rot.deg));
function angleOf(p){const q=quatOf(p);return q?Math.round(2*Math.acos(Math.min(1,Math.abs(q.w)))*1800/Math.PI)/10:0;} // degrees off square
function box(p){ // outer bounds of a piece in the world, allowing for any rotation
  const s=size(p),q=quatOf(p);if(!q)return{lo:p.pos,hi:p.pos.map((v,i)=>v+s[i])};
  const m=new THREE.Matrix4().makeRotationFromQuaternion(q).elements,e=[0,1,2].map(i=>Math.abs(m[i])*s[0]+Math.abs(m[4+i])*s[1]+Math.abs(m[8+i])*s[2]);
  return{lo:p.pos.map((x,i)=>x+s[i]/2-e[i]/2),hi:p.pos.map((x,i)=>x+s[i]/2+e[i]/2)};}
function setQuat(p,q){ // store a rotation on a piece, folding quarter turns into p.ax
  delete p.rot;delete p.q;q.normalize();
  const m=new THREE.Matrix4().makeRotationFromQuaternion(q).elements,perm=[];
  for(let j=0;j<3;j++){const i=[0,1,2].find(i=>Math.abs(Math.abs(m[j*4+i])-1)<1e-3);if(i===undefined)break;perm.push(i);}
  if(perm.length===3){const s0=size(p),c=p.pos.map((v,i)=>v+s0[i]/2);
    hardwareTurned(p,q); // what is mounted on the piece turns with it (js/hardware.js)
    delete p.turned;     // it stands square again: no longer a piece of a turned set (js/neighbors.js)
    p.ax=p.ax.map(a=>perm[a]);const s=size(p);p.pos=c.map((v,i)=>r16(v-s[i]/2));return;}
  p.q=[q.x,q.y,q.z,q.w].map(v=>Math.round(v*1e6)/1e6);}
