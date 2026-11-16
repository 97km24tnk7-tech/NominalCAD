/* WoodShop Designer: the current project, undo/redo and autosave */
'use strict';
/* ---------- state ---------- */
let S,sel=new Set(),undoStack=[],redoStack=[],lastSnap='';
const blank=()=>({name:'My project',parts:[],joints:{},stock:{},notes:[],steps:[],nextId:1});
const byId=id=>S.parts.find(p=>p.id===id);
function addParts(list){const ids=[];for(const p of list){p.id=S.nextId++;S.parts.push(p);ids.push(p.id);}return ids;}
function commit(){undoStack.push(lastSnap);if(undoStack.length>200)undoStack.shift();redoStack=[];lastSnap=JSON.stringify(S);save();renderAll();}
let saveWarned=false;
function save(){ // autosave to this browser; tell the user once if the browser refuses, so work is not lost silently
  try{localStorage.setItem('woodshop.autosave',lastSnap);saveWarned=false;}
  catch(e){if(!saveWarned){saveWarned=true;toast('This browser could not autosave (its storage is full or turned off). Use File, then Download as a file, to keep your work.');}}}
function load(json,keepHistory){S=Object.assign(blank(),JSON.parse(json));sel=new Set();if(!keepHistory){undoStack=[];redoStack=[];hiddenIds=new Set();}lastSnap=JSON.stringify(S);save();renderAll();}
function undo(){if(!undoStack.length)return;redoStack.push(lastSnap);const j=undoStack.pop();const u=undoStack,r=redoStack;load(j,true);undoStack=u;redoStack=r;renderAll();}
function redo(){if(!redoStack.length)return;undoStack.push(lastSnap);const j=redoStack.pop();load(j,true);renderAll();}
function bbox(parts){if(!parts.length)return null;const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(const p of parts){const b=box(p);for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],b.lo[i]);hi[i]=Math.max(hi[i],b.hi[i]);}}return{lo,hi};}

