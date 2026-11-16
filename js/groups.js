/* NominalCAD: selecting many pieces at once: "all pieces like this" and "everything".
   (Groups are gone: a set of pieces that belong together is a component now, see js/components.js. Old projects
   that used groups open with one component per group.) */
'use strict';
function selectSimilar(){const names=new Set(selParts().map(p=>p.name));if(!names.size)return toast('Select a piece first.');
  sel=new Set(S.parts.filter(p=>names.has(p.name)&&!hiddenIds.has(p.id)).map(p=>p.id));renderAll();toast(`${sel.size} pieces selected`);}
function selectAllVisible(){ // Select everything never picks up hidden pieces, so Delete cannot remove boards you cannot see
  sel=new Set(S.parts.filter(p=>!hiddenIds.has(p.id)).map(p=>p.id));renderAll();}
