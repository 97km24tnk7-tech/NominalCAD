/* NominalCAD: materials, units and small helpers shared by every other file */
'use strict';
/* ---------- materials ---------- */
const MATS=[
 ['1x2',.75,1.5],['1x3',.75,2.5],['1x4',.75,3.5],['1x6',.75,5.5],['1x8',.75,7.25],['1x10',.75,9.25],['1x12',.75,11.25],
 ['2x2',1.5,1.5],['2x3',1.5,2.5],['2x4',1.5,3.5],['2x6',1.5,5.5],['2x8',1.5,7.25],['2x10',1.5,9.25],['2x12',1.5,11.25],['4x4',3.5,3.5]
].map(([id,t,w])=>({id,name:id+' board',short:id,kind:'board',t,w,color:id==='4x4'?0xd9b47c:0xe6c592}));
/* Pressure-treated boards, for wood that lies on the ground or stands in the wet (the skids and the floor frame
   of a shed). They are the same sizes as the plain boards, but they are bought as boards of their own, so they
   are materials of their own: the cut list, the cutting diagrams and the shopping list then keep them apart
   ("Pressure-treated 2x6, 10 ft long"). nom is the plain size each is named after; price is the built-in
   estimate for an 8 ft board (see builtInPrice in js/prices.js). They stand after the plain boards, so that
   anything that looks a board up by its size finds the plain one first. */
const TREATED_SIZES=[['2x4',5.5],['2x6',9],['2x8',12.5],['4x4',14]];
MATS.push(...TREATED_SIZES.map(([nom,price])=>{
  const plain=MATS.find(m=>m.id===nom);
  // brief: the name where there is only room for a few letters (the Pieces list)
  return{id:'pt'+nom,name:'Pressure-treated '+nom+' board',short:'Pressure-treated '+nom,brief:'Treated '+nom,kind:'board',t:plain.t,w:plain.w,color:0xb7b587,nom,price,treated:true};
}));
/* the treated board of the same size as a plain one, or the plain one when there is none */
const treatedMat=id=>MATS.some(m=>m.id==='pt'+id)?'pt'+id:id;
MATS.push({id:'ply34',name:'3/4" plywood',short:'3/4" plywood',kind:'sheet',t:.75,color:0xcfa873},
          {id:'ply12',name:'1/2" plywood',short:'1/2" plywood',kind:'sheet',t:.5,color:0xc9a26e},
          {id:'ply14',name:'1/4" plywood',short:'1/4" plywood',kind:'sheet',t:.25,color:0xb99a6b},
          {id:'tank',name:'Fish tank (not wood)',short:'Fish tank',kind:'prop',t:0,color:0x3d9be0},
          // a light is a fixture, not a board: drawn solid and dark (opaque, see propIsSolid), so the lights over the
          // top row of a fish rack do not read as loose boards floating above the tanks
          {id:'light',name:'Tank light (not wood)',short:'Tank light',kind:'prop',t:0,color:0x2b2f33,opaque:true},
          {id:'mattress',name:'Mattress (not wood)',short:'Mattress',kind:'prop',t:0,color:0xffffff},
          {id:'glass',name:'Window (not wood)',short:'Window',kind:'prop',t:0,color:0x9fd3f5});
const isProp=p=>M[p.mat].kind==='prop';
/* a thing that is not wood but is drawn solid, not see-through (a tank light: a dark fixture) */
const propIsSolid=p=>isProp(p)&&!!M[p.mat].opaque;
const M=Object.fromEntries(MATS.map(m=>[m.id,m]));
const isSquare=m=>m.kind==='board'&&m.t===m.w;

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const r16=v=>Math.round(v*16)/16,fa=v=>esc(fmt(v));
/* How a size is written.
     fmt(v)     inches, with fractions to 1/16:  33 1/4"   Used for every piece, cut, field and distance.
     fmtFt(v)   the size of a whole design (its overall width, depth and height, the length of a wall). The same
                inches up to 8 ft, so that a 60" bench reads 60" everywhere; feet and inches from 8 ft up
                (119" reads 9' 11"), because few people can picture 119 inches.
   Every place that shows an overall size calls fmtFt (the status bar, the size lines in the 3D view, the presets
   dialog, the document pages), so one size never reads two ways on the same screen. */
const FEET_FROM=96; // inches
function fmt(v){const neg=v<-1e-9;v=Math.abs(v);let n=Math.round(v*16),w=Math.floor(n/16),f=n%16,s;
  if(f){let d=16;while(f%2===0){f/=2;d/=2;}s=(w?w+' ':'')+f+'/'+d;}else s=''+w;return(neg?'-':'')+s+'"';}
function fmtFt(v){
  v=r16(v);
  if(v<FEET_FROM)return fmt(v);
  const feet=Math.floor(v/12+1e-6);
  return`${feet}' ${fmt(v-feet*12)}`;
}
/* What a box a person types a size or a position into shows (the owner reads sizes the way a steel detailer
   writes them):
     12" and under       inches, as fmt writes them:            11 1/2"   12"   -3/4"
     over 12"            feet, a dash, then the inches:         2'-8"   2'-8 1/2"   25'-0"   1'-0 1/16"   -2'-8"
   Only the boxes use this. Everything that is read or printed (cut list, shopping list, steps, size labels in the
   3D view, the status bar, the Pieces list) keeps fmt and fmtFt. parseLen reads every box back to the very same
   number, to the sixteenth (the self-check lengthBoxesRoundTrip in js/lengthboxes.js tries a table of them). */
const BOX_FEET_OVER=12; // inches: a box value over this is written in feet and inches
function boxLen(inches){
  const sixteenths=Math.round(Math.abs(inches)*16);
  if(sixteenths<=BOX_FEET_OVER*16)return fmt(inches);
  const sign=inches<0?'-':'';
  const feet=Math.floor(sixteenths/192);           // 192 sixteenths in a foot
  const restInches=(sixteenths-feet*192)/16;
  const zeroInches=restInches>0&&restInches<1?'0 ':'';   // 1'-0 1/16", the way a detailer writes it
  return`${sign}${feet}'-${zeroInches}${fmt(restInches)}`;
}
/* A sentence that quotes a size the person typed into a box of the presets form ("Width is 25'-0"") speaks the way
   the box does while the form is talking (the limit line, the findings and the remark under the form, the
   message of Create). The same sentence in the notes and the steps of the build instructions stays in inches.
     typedLen(v)          boxLen(v) while the form is talking, fmt(v) otherwise
     typedLen(v, fmtFt)   the same, with fmtFt as the usual writer
     speakAsBoxes(fn)     runs fn() with the form talking, and returns what it returns */
let boxSpeech=0; // how many speakAsBoxes calls are running (they can sit inside each other)
function typedLen(inches,usualWriter){
  if(boxSpeech>0)return boxLen(inches);
  return(usualWriter||fmt)(inches);
}
function speakAsBoxes(fn){
  boxSpeech++;
  try{return fn();}
  finally{boxSpeech--;}
}
/* Reads a size typed by a person. Returns inches, or NaN when it cannot be read. Reads:
     32   32"   32 in   3 1/2   3-1/2   .75   2'-8"   2' 8"   2'8   2 ft 8 in   2ft 8   2.5'   25'   25'-0"
     2'-8 1/2"   300"   and any of them with a minus sign in front (a position or a distance that goes back).
   Curly quotes, the prime marks and '' for inches are taken as well. */
function parseLen(text){
  let s=String(text).trim().toLowerCase()
    .replace(/[‘’′]/g,"'").replace(/[“”″]/g,'"').replace(/−/g,'-')
    .replace(/''/g,'"')
    .replace(/\s*(feet|foot|ft)\.?/g,"'")          // 2 ft 8 in, 2ft 8
    .replace(/\s*(inches|inch|in)\.?/g,'"')
    .trim();
  if(!s)return NaN;
  let sign=1;
  if(s[0]==='-'){sign=-1;s=s.slice(1).trim();}
  else if(s[0]==='+')s=s.slice(1).trim();
  const footMark=s.indexOf("'");
  let feet=0,inchText=s;
  if(footMark>=0){
    feet=readPlainNumber(s.slice(0,footMark));
    inchText=s.slice(footMark+1).replace(/^\s*-?\s*/,''); // the dash or space between the feet and the inches
    if(inchText.includes("'"))return NaN;               // two foot marks
  }
  inchText=inchText.trim();
  if(inchText.endsWith('"'))inchText=inchText.slice(0,-1).trim();
  if(inchText.includes('"'))return NaN;
  const inches=footMark>=0&&!inchText?0:readPlainNumber(inchText);
  if(isNaN(feet)||isNaN(inches))return NaN;
  return sign*(feet*12+inches);
}
/* one number without a unit: 8, 8.5, .75, 1/2, 8 1/2 or 8-1/2 (no sign); NaN otherwise */
function readPlainNumber(text){
  const t=String(text).trim();
  const found=t.match(/^(?:(\d+\.?\d*|\.\d+)(?:(?:\s+|\s*-\s*)(\d+)\/(\d+))?|(\d+)\/(\d+))$/);
  if(!found)return NaN;
  if(found[4]!==undefined)return +found[5]?found[4]/found[5]:NaN;          // a fraction alone: 1/2
  const whole=+found[1];
  if(found[2]===undefined)return whole;                                     // 8 or 8.5
  if(!+found[3]||found[1].includes('.'))return NaN;                         // 8 1/0, 8.5 1/2
  return whole+found[2]/found[3];                                           // 8 1/2
}
function size(p){const s=[0,0,0];s[p.ax[0]]=p.l;s[p.ax[1]]=p.w;s[p.ax[2]]=p.t;return s;}
function mk(name,mat,s,pos){
  const m=M[mat],eq=(a,b)=>Math.abs(a-b)<1e-6;let ax=null;
  if(m.kind==='prop')ax=[0,2,1];
  else if(m.kind==='board'){
    for(const ti of[0,1,2]){if(!eq(s[ti],m.t))continue;
      for(const wi of[0,1,2])if(wi!==ti&&eq(s[wi],m.w)){ax=[3-ti-wi,wi,ti];break;}
      if(ax)break;}
  }else{const ti=[0,1,2].find(i=>eq(s[i],m.t));
    if(ti!==undefined){const r=[0,1,2].filter(i=>i!==ti).sort((a,b)=>s[b]-s[a]);ax=[r[0],r[1],ti];}}
  if(!ax)ax=[0,1,2].sort((a,b)=>s[b]-s[a]);
  return{id:0,name,mat,l:r16(s[ax[0]]),w:r16(s[ax[1]]),t:s[ax[2]],ax,pos:pos.map(r16)};
}

/* one of the line icons drawn in the #sprite block at the top of index.html.
   size: '' = 16px, 'l' = 24px, 'm' = 20px, 'xs' = 12px. Example: icon('i-undo') */
function icon(id,size){
  return `<svg class="i${size?' '+size:''}"><use href="#${id}"/></svg>`;
}

/* a short message that fades out by itself, for confirming an action without interrupting.
   One at a time, at the bottom centre of the view; long messages stay up a little longer so they can be read. */
function toast(msg){
  let t=$('#toast');
  if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=msg;
  t.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>t.classList.remove('on'),msg.length>80?7000:4000);
}

/* Self-checks that live beside the feature they check. A feature file adds one with
     SELFTESTS.push(function nameOfTheCheck(problems){ ... problems.push('what is wrong') ... });
   and selfTest() (js/selftest.js) runs them all after its own checks, with a design on screen, no dialogs shown
   (autoConfirm is on) and the person's design put back afterwards. Keep each one quick and leave no mess. */
const SELFTESTS=[];

/* Places where a feature file joins in without the core files having to know about it.
     ON_LOAD.push(fn)     fn() runs right after a project has been read (open, paste, undo, redo), before anything
                          is drawn. Bring old projects up to date here (missing fields, old field names).
     ON_COMMIT.push(fn)   fn() runs at the start of commit(), before the undo snapshot is taken. Bookkeeping that
                          belongs to the same undo step as the change goes here (js/connections.js keeps the list
                          of what is fastened to what this way).
     ON_LEVEL.push(fn)    fn(level) runs when the page is set to 'beginner' or 'expert' (js/level.js), and once at
                          start-up. A feature whose switch is hidden in Beginner puts that switch in its safe
                          position here (Auto-fasten on, Pick: Piece).
   The lists run in the order the files were loaded. Keep every function fast: commit() runs after every edit. */
const ON_LOAD=[],ON_COMMIT=[],ON_LEVEL=[];
