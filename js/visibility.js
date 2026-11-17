/* NominalCAD: what you can see, without changing the design.
   Hide / show pieces, exploded view, zoom to the selection, and the overlap check. (Solid, see-through and
   fasteners-only wood is in js/viewmodes.js.)
   None of this is saved in the project or touched by undo: it only affects the picture on screen. */
'use strict';
let hiddenIds=new Set(),explode=0,forceDims=false,explodeCenter=[0,0,0];
function hideSel(){if(!sel.size)return toast('Select the pieces to hide first.');const n=sel.size;sel.forEach(i=>hiddenIds.add(i));sel=new Set();renderAll();toast(`${n} hidden. Alt+H shows everything again.`);}
function isolateSel(){if(!sel.size)return toast('Select the pieces you want to keep on screen first.');for(const p of S.parts)if(!sel.has(p.id))hiddenIds.add(p.id);renderAll();toast('Showing only the selection. Alt+H shows everything again.');}
function showAll(){hiddenIds=new Set();renderAll();}
function setExplode(v){explode=v;rebuildScene();renderStatus();syncChecks();} // renderStatus: the status bar prompt says how to leave the exploded view; syncChecks: the Display button lights up
function focusSel(){ // zoom to the selection, or to everything when nothing is selected
  const b=bbox(sel.size?selParts():S.parts);if(!b)return;
  cam.target.set((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2);cam.r=Math.max(20,Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2])*1.6);
  updateCam();buildHandles();buildGizmo();}
function findClashes(){ // pairs of square-set wooden pieces that occupy the same space
  const ps=S.parts.filter(p=>!isProp(p)&&!tilted(p)&&!hiddenIds.has(p.id));if(ps.length>900)return[];
  const B=ps.map(p=>{const s=size(p);return{p,lo:p.pos,hi:p.pos.map((v,i)=>v+s[i])};}),out=[];
  // (a pair where either piece is shaped is tested again on the real wood: a board in the cut-away corner of
  // another is no clash, solidsOverlap in js/shapes.js)
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++)if([0,1,2].every(k=>B[i].lo[k]<B[j].hi[k]-.06&&B[j].lo[k]<B[i].hi[k]-.06)&&
    (!B[i].p.shape&&!B[j].p.shape||solidsOverlap(B[i].p,B[j].p)))out.push([B[i].p,B[j].p]);
  return out;}

/* ---------- "Show me" ----------
   Words used in this design, Show me (js/glossary.js): the pieces of that word are drawn solid, in the selection
   color, and everything else nearly clear, so that a piece that sits behind others (a base rail behind a toe
   kick, a stud inside a sheathed wall) can be found. Nothing is selected while it shows: no move arrows cover
   the pieces, and Properties does not offer a tool that would change the design. A click (in the view: a
   click without a drag, so the view can still be turned), Esc, or leaving the Design tab puts the view back. rebuildScene (js/view3d.js) reads spotlightIds;
   renderPrompt (js/statusbar.js) says what is going on. */
let spotlightIds=null,spotlightWord='';
function showSpotlight(ids,word){
  sel=new Set();
  spotlightIds=new Set(ids);
  spotlightWord=word;
  renderAll();
  // look at those pieces, from far enough away to see where in the design they are
  const shown=bbox(S.parts.filter(part=>spotlightIds.has(part.id))),all=bbox(S.parts);
  if(shown&&all){
    const span=b=>Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]);
    cam.target.set((shown.lo[0]+shown.hi[0])/2,(shown.lo[1]+shown.hi[1])/2,(shown.lo[2]+shown.hi[2])/2);
    cam.r=Math.max(30,span(shown)*1.8,span(all)*.9);
    updateCam();
    draw();
  }
}
function endSpotlight(){
  if(!spotlightIds)return false;
  spotlightIds=null;
  spotlightWord='';
  rebuildScene();
  renderStatus();
  return true;
}
// Dragging in the view turns it, and that must not end the show: there only a click without a drag does.
let spotlightPress=null;
document.addEventListener('pointerdown',event=>{
  if(!spotlightIds)return;
  if(event.target.closest&&event.target.closest('#cvWrap canvas'))spotlightPress=[event.clientX,event.clientY];
  else endSpotlight();
},true);
document.addEventListener('pointerup',event=>{
  const press=spotlightPress;
  spotlightPress=null;
  if(press&&Math.hypot(event.clientX-press[0],event.clientY-press[1])<4)endSpotlight();
},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape')endSpotlight();},true);
