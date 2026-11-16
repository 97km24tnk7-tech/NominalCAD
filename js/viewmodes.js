/* NominalCAD: how the wood is drawn, so that what is inside it can be seen.

   One setting with three values (Display pulldown, "Wood" row):
     solid      the normal view. Screw heads, pocket holes and hardware show where they really would.
     through    See-through (Shift+S): the wood is translucent, fasteners and hardware are solid. Watch a screw
                pass through one piece into the next.
     fast       Fasteners only (Shift+F): the wood is only faint outlines; fasteners are solid and colored by kind,
                hardware is solid.
   It only changes the picture: it is not saved in the project and not touched by undo. The pictures of the
   printed plans are taken in Solid unless the caller of takePictures() asks for another mode.

     woodMode                 the current value
     setWoodMode(mode)        change it (redraws, updates the menus and the status bar)
     toggleWoodMode(mode)     switch to that mode, or back to Solid when it is on already (what the hotkeys do)
     dressForWoodMode(p, mesh, edges, selected)   rebuildScene() calls this for every wooden piece it draws */
'use strict';

const WOOD_MODES={
  solid:{name:'Solid',said:'Solid view: the wood is drawn as it looks.'},
  through:{name:'See-through',said:'See-through view: the wood is translucent, fasteners and hardware are solid. Shift+S goes back.'},
  fast:{name:'Fasteners only',said:'Fasteners only: the wood is an outline, fasteners are colored by kind. Shift+F goes back.'},
};
const THROUGH_OPACITY=.35;  // how solid the wood is in the see-through view
const OUTLINE_OPACITY=.04;  // the faces of the wood in the fasteners-only view: all but gone
let woodMode='solid';

function setWoodMode(mode){
  if(!WOOD_MODES[mode])mode='solid';
  if(mode===woodMode)return;
  woodMode=mode;
  if(mode==='fast'&&!$('#showFast').checked)$('#showFast').checked=true; // nothing to see otherwise
  rebuildScene();
  syncChecks();
  syncWoodModeChip();
  toast(WOOD_MODES[mode].said);
}
function toggleWoodMode(mode){
  setWoodMode(woodMode===mode?'solid':mode);
}
/* the status bar says which view is on whenever it is not the normal one; clicking it goes back to Solid */
function syncWoodModeChip(){
  const chip=$('#stView');
  if(!chip)return;
  chip.hidden=woodMode==='solid';
  chip.innerHTML=icon('i-display')+esc(WOOD_MODES[woodMode].name);
}
$('#stView').onclick=()=>setWoodMode('solid');
syncWoodModeChip();

function dressForWoodMode(p,mesh,edges,selected){
  if(woodMode==='solid'||isProp(p))return;
  const faces=mesh.material,lines=edges.material;
  faces.transparent=true;
  faces.depthWrite=false;
  mesh.castShadow=mesh.receiveShadow=false;
  if(woodMode==='through'){
    faces.opacity=THROUGH_OPACITY;
    return;
  }
  faces.opacity=selected?.22:OUTLINE_OPACITY;
  lines.transparent=true;
  if(!selected&&lines.color.getHex()!==VIEW_COL.clashEdge)lines.opacity=.3;
}

SELFTESTS.push(function woodModes(problems){
  const wrong=text=>problems.push('view modes: '+text);
  const kept=woodMode,fastenersKept=$('#showFast').checked;
  load(JSON.stringify(blank()),true);
  const[id]=addParts([mk('Board','2x4',[24,1.5,3.5],[0,0,0])]);
  const facesOf=()=>meshes.get(id).children[0].material;
  try{
    setWoodMode('solid');
    rebuildScene();
    if(facesOf().transparent)wrong('the wood is see-through in the Solid view');
    setWoodMode('through');
    if(woodMode!=='through'||!facesOf().transparent||Math.abs(facesOf().opacity-THROUGH_OPACITY)>1e-6)wrong('See-through did not make the wood translucent');
    if($('#stView').hidden||!/See-through/.test($('#stView').textContent))wrong('the status bar does not say that the see-through view is on');
    if(!CHECKS.woodThrough()||CHECKS.woodSolid())wrong('the Display pulldown does not tick See-through');
    $('#showFast').checked=false;
    setWoodMode('fast');
    if(facesOf().opacity>.1)wrong('Fasteners only still draws the wood');
    if(!$('#showFast').checked)wrong('Fasteners only left the Fasteners switch off, so nothing would show');
    toggleWoodMode('fast');
    if(woodMode!=='solid'||!$('#stView').hidden)wrong('pressing the hotkey of the current view did not go back to Solid');
    // pictures for the plans are Solid whatever is on screen
    setWoodMode('through');
    const seen=[];
    const spy=()=>seen.push(woodMode);
    SCENE_EXTRAS.push(spy);
    try{takePictures(false);}finally{SCENE_EXTRAS.splice(SCENE_EXTRAS.indexOf(spy),1);}
    if(seen[0]!=='solid')wrong('the pictures for the plans were not taken in the Solid view');
    if(woodMode!=='through')wrong('taking the pictures for the plans changed the view on screen');
  }finally{
    $('#showFast').checked=fastenersKept;
    setWoodMode(kept);
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
