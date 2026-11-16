/* NominalCAD: what you can see, without changing the design.
   Hide / show pieces, see-through (X-ray) view, exploded view, zoom to the selection, and the overlap check.
   None of this is saved in the project or touched by undo: it only affects the picture on screen. */
'use strict';
let hiddenIds=new Set(),xray=false,explode=0,forceDims=false,explodeCenter=[0,0,0];
function hideSel(){if(!sel.size)return toast('Select the pieces to hide first.');const n=sel.size;sel.forEach(i=>hiddenIds.add(i));sel=new Set();renderAll();toast(`${n} hidden. Alt+H shows everything again.`);}
function isolateSel(){if(!sel.size)return toast('Select the pieces you want to keep on screen first.');for(const p of S.parts)if(!sel.has(p.id))hiddenIds.add(p.id);renderAll();toast('Showing only the selection. Alt+H shows everything again.');}
function showAll(){hiddenIds=new Set();renderAll();}
function toggleXray(){xray=!xray;rebuildScene();toast(xray?'See-through view on':'See-through view off');}
function setExplode(v){explode=v;rebuildScene();renderStatus();if(v)toast('Exploded view. Click any piece to put it back together.');} // renderStatus: the status bar prompt says how to leave the exploded view
function focusSel(){ // zoom to the selection, or to everything when nothing is selected
  const b=bbox(sel.size?selParts():S.parts);if(!b)return;
  cam.target.set((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2);cam.r=Math.max(20,Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2])*1.6);
  updateCam();buildHandles();buildGizmo();}
function findClashes(){ // pairs of square-set wooden pieces that occupy the same space
  const ps=S.parts.filter(p=>!isProp(p)&&!tilted(p)&&!hiddenIds.has(p.id));if(ps.length>900)return[];
  const B=ps.map(p=>{const s=size(p);return{p,lo:p.pos,hi:p.pos.map((v,i)=>v+s[i])};}),out=[];
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++)if([0,1,2].every(k=>B[i].lo[k]<B[j].hi[k]-.06&&B[j].lo[k]<B[i].hi[k]-.06))out.push([B[i].p,B[j].p]);
  return out;}
