/* WoodShop Designer: groups and "select similar".
   A group is just a shared number (p.grp) on its pieces; clicking one piece of a group selects them all. */
'use strict';
function groupIds(id){const p=byId(id);return p&&p.grp?S.parts.filter(q=>q.grp===p.grp).map(q=>q.id):[id];}
function groupSel(){if(sel.size<2)return toast('Select two or more pieces to group them.');const g=S.nextGrp=(S.nextGrp||0)+1;selParts().forEach(p=>p.grp=g);commit();toast('Grouped. Clicking one piece now selects them all.');}
function ungroupSel(){const ps=selParts().filter(p=>p.grp);if(!ps.length)return toast('Nothing in the selection is grouped.');ps.forEach(p=>delete p.grp);commit();toast('Ungrouped');}
function regroup(parts){ // copies of grouped pieces become their own new group instead of joining the original
  const m=new Map();for(const p of parts)if(p.grp){if(!m.has(p.grp))m.set(p.grp,S.nextGrp=(S.nextGrp||0)+1);p.grp=m.get(p.grp);}return parts;}
function selectSimilar(){const names=new Set(selParts().map(p=>p.name));if(!names.size)return toast('Select a piece first.');
  sel=new Set(S.parts.filter(p=>names.has(p.name)&&!hiddenIds.has(p.id)).map(p=>p.id));renderAll();toast(`${sel.size} pieces selected`);}
function selectAllVisible(){ // Select everything never picks up hidden pieces, so Delete cannot remove boards you cannot see
  sel=new Set(S.parts.filter(p=>!hiddenIds.has(p.id)).map(p=>p.id));renderAll();}
