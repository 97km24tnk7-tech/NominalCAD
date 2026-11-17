/* NominalCAD: a design saved under an older rule for fasteners is brought up to today's rule when it is opened.

   The owner, on designs saved before tops were held from underneath: "for now just switch it, in the future with
   more users we might reconsider". So when a design is opened (a saved file, the autosave, a pasted project) and it
   was saved before the current rule (S.fastening is missing or lower than FASTENING_NOW):
     - every joint between two pieces of one placement of a preset takes the fastening that preset gives it today
       (its `joints` list: a rule that follows the build style, a fixed type, or nothing named, which is then the
       suggestion worked out from the shapes), in the design's own style;
     - a joint whose fastener the person chose by hand keeps it (a choice in S.joints that is not the preset's own
       word for that joint, S.named);
     - a design that is not from a preset (no placement of a preset, and not named after one) is left alone;
     - its build steps and notes are brought up to date too (bringWordsUpToDate below), so no step still
       describes a screw it no longer has;
     - it is done once, quietly, as part of opening the design: it is not a step that Undo takes back, and one
       line (a toast) says how the design is fastened now: "Updated the fasteners of this Desk to the current
       way: no screw heads show on the top, the front or the sides. Its build steps and notes were written again
       to match." (upgradeWords: it speaks of the design as it is now, never of what the old program did)
   Opening the same file twice gives the same result: the work depends on the file alone.

   FASTENING_NOW   the rule the program fastens by today. 1 (or missing): tops screwed down, or held from underneath
                   with the sides screwed through from outside. 2: the sides of house furniture show no heads
                   either, and the plugged heads of a bed rail. 3: a bed's legs are screwed to its end rails from
                   inside the leg (no corner brace). 4: a drawer nightstand's toe kick is held to the bottom
                   panel by pocket holes, so no screw head shows on the floor of its open shelf. 5: every pocket hole
                   is drilled in "Drill your pieces" (js/drillplan.js), and the steps no longer tell to drill them.
   upgradeFastening()  the ON_LOAD hook. lastFasteningUpgrade: what the last opening changed, for the self-check. */
'use strict';

const FASTENING_NOW=5;
let lastFasteningUpgrade=null;
/* how the line is shown (the self-check listens in) */
let sayFasteningUpgrade=text=>toast(text);

/* The placements of presets in this design: [{preset, parts}]. A design saved before placements were numbered is
   one placement of the preset it is named after. */
function presetPlacements(){
  const bySet=new Map();
  for(const piece of S.parts){
    const set=S.sets&&piece.set!==undefined?S.sets[piece.set]:null;
    if(!set)continue;
    if(!bySet.has(piece.set))bySet.set(piece.set,{name:set.name,entry:set.entry,parts:[],vals:set.vals});
    bySet.get(piece.set).parts.push(piece);
  }
  const list=[...bySet.values()].map(entry=>({preset:PRESETS.find(candidate=>candidate.name===entry.name),parts:entry.parts,vals:entry.vals,entry:entry.entry}));
  if(!bySet.size){
    const preset=PRESETS.find(candidate=>candidate.name===S.name);
    if(preset)list.push({preset,parts:S.parts.slice()});
  }
  // (a preset's joints may be a list, or a function of the form values: presetJointList, js/joints.js)
  return list.filter(entry=>entry.preset&&(Array.isArray(entry.preset.joints)||typeof entry.preset.joints==='function')&&entry.parts.length);
}
/* the faces that showed screw heads, counted (showingHeads, js/showfaces.js) */
function headsByFace(){
  const count={};
  for(const head of showingHeads())count[head.face]=(count[head.face]||0)+1;
  return count;
}
/* the fastener of every joint as it is now, by key */
function fastenerTypes(){
  return new Map(findJoints().map(j=>[j.key,jType(j)]));
}
/* The words for what the design is like now. They speak of the design as it is after the change, never of what
   it was before: "before" can only be read with today's program, which does not always read an old file the way
   the old program did (a Fine furniture desk of that program already had its top held from underneath).
     byHand        keys of the joints whose fastener the person picked and that were kept
     plugsBefore   how many heads were sunk under plugs before
   Faces: top, front, sides (SHOW_FACES in js/showfaces.js). A face with no head is said to have none; a face
   whose only heads are those of fasteners picked by hand is said so; a face where the style shows heads (Rustic)
   is not spoken of. Heads newly sunk under plugs are counted. */
const UPGRADE_FACE_WORDS={top:'the top',front:'the front',side:'the sides'};
function upgradeWords(byHand,plugsBefore,changedJoints){
  const showing=showingHeads();
  const clean=[],onlyHand=[];
  for(const face of Object.keys(UPGRADE_FACE_WORDS)){
    const here=showing.filter(head=>head.face===face);
    if(!here.length)clean.push(UPGRADE_FACE_WORDS[face]);
    else if(here.every(head=>byHand.has(head.link.key)))onlyHand.push(UPGRADE_FACE_WORDS[face]);
  }
  const said=[];
  if(clean.length)said.push(`no screw heads show on ${orWords(clean)}`);
  if(onlyHand.length)said.push(`on ${orWords(onlyHand).replace(/ or /,' and ')} only those of the fasteners you picked yourself`);
  const plugs=coveredHeads().length;
  if(plugs>plugsBefore)said.push(`${plugs} screw head${plugs===1?' is':'s are'} hidden: sunk under wooden plugs (wood filler under paint), which the build step and the shopping list now give`);
  if(!said.length)said.push(changedJoints===1?'one joint is fastened as the preset fastens it today':`${changedJoints} joints are fastened as the preset fastens them today`);
  return said.length>1?said.slice(0,-1).join(', ')+', and '+said[said.length-1]:said[0];
}
const orWords=items=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' or '+items[items.length-1];
/* A joint that the preset today leaves unfastened because hardware it places at Create holds the two pieces (the
   end posts of two fish rack sections, joined by carriage bolts: preset.place, js/rackwall.js), in an old design
   that has no such hardware between them: the fastener it was saved with stays. Taking it away would leave the
   sections standing side by side, held to each other by nothing, with a step that still says to screw them. */
function leftToMissingHardware(preset,j,today,before){
  if(today!=='none'||!before||before==='none')return false;
  const pairs=preset.hardwareJoints||[];
  if(!pairs.some(([a,b])=>(j.a.name===a&&j.b.name===b)||(j.a.name===b&&j.b.name===a)))return false;
  // a bolt passes through the two pieces and the ones beside them (its head and nut sit on the end cross pieces
  // or end uprights against the posts)
  const near=new Set([j.a.id,j.b.id]);
  for(const piece of[j.a,j.b])for(const link of connectionsOf(piece.id))near.add(link.a.id).add(link.b.id);
  return!(S.hardware||[]).some(item=>item.kind==='bolt'&&(near.has(item.on)||near.has(item.to)));
}
function upgradeFastening(){
  lastFasteningUpgrade=null;
  if(!S||Number(S.fastening)>=FASTENING_NOW)return;
  const placements=presetPlacements(),savedUnder=Number(S.fastening)||0;
  S.fastening=FASTENING_NOW;
  if(!placements.length)return;   // not from a preset: left alone
  if(!S.styled||typeof S.styled!=='object')S.styled={};
  if(!S.named||typeof S.named!=='object')S.named={};
  connCache=null;
  const typesBefore=fastenerTypes(),headsBefore=headsByFace(),plugsBefore=coveredHeads().length;
  const pocketRules=[],keptByHand=new Set();
  for(const{preset,parts,vals}of placements){
    const own=new Set(parts),list=presetJointList(preset,vals);
    for(const j of findJoints()){
      if(!own.has(j.a)||!own.has(j.b))continue;
      const key=j.key,chosen=S.joints[key];
      const byHand=chosen!==undefined&&S.named[key]!==chosen;
      if(byHand){keptByHand.add(key);continue;}             // the person's choice is kept
      const row=namedJointRow(j,list),today=row?row[2]:'';
      if(leftToMissingHardware(preset,j,today,typesBefore.get(key)))continue;   // the old fastener still holds it
      rememberThrough(j,row);   // the piece the screws go through, as the preset says today ({through})
      if(isStyleRule(today)){
        delete S.joints[key];delete S.named[key];
        S.styled[key]=today;
        if(today==='pocketUnlessRustic')pocketRules.push(key);
      }else if(today){
        S.joints[key]=today;S.named[key]=today;
        delete S.styled[key];
      }else{
        // the preset names nothing for this joint today: the suggestion worked out from the shapes
        if(chosen!==undefined){delete S.joints[key];delete S.named[key];}
        delete S.styled[key];
      }
    }
  }
  roomForTopRows(pocketRules);   // a top board right beside a leg only rests there, as Create decides it (js/joints.js)
  connCache=null;
  if(typeof layoutCarry!=='undefined')layoutCarry.clear();
  const typesAfter=fastenerTypes(),headsAfter=headsByFace();
  const changedKeys=[];
  for(const[key,type]of typesAfter)if(typesBefore.get(key)!==type)changedKeys.push(key);
  // (5: steps saved before "Drill your pieces" tell the person to drill pocket holes that step 2 holds now: they are
  //  written again, quietly, as the fasteners did not change, js/drillplan.js)
  if(!changedKeys.length){if(savedUnder<5)bringWordsUpToDate(placements,[],true);return;}
  const words=bringWordsUpToDate(placements,changedKeys,false,savedUnder<5);
  const names=[...new Set(placements.map(entry=>entry.entry||entry.preset.name))];   // (an entry's name, never a hidden builder's: "this Bookshelf")
  const text=`Updated the fasteners of this ${names.join(' and ')} to the current way: ${upgradeWords(keptByHand,plugsBefore,changedKeys.length)}.`+
    (words==='preset'?' Its build steps and notes were written again to match.':words==='notes'?' Its notes were written again to match.':
     words==='refreshed'?' The build steps for those joints were written again to match.':'');
  lastFasteningUpgrade={text,changed:changedKeys.length,before:headsBefore,after:headsAfter,words};
  sayFasteningUpgrade(text);
}

/* ---------- the words follow the fasteners ----------
   An old design keeps the steps and the notes it was saved with (S.steps, S.notes), and those describe its old
   fasteners ("two screws through the side into each end of a board"). When its fasteners change, its words are
   brought up to date as well:
     - when the form values the design was made with are known (S.sets[n].vals, saved since this rule) or can be
       read back from its pieces (presetValuesOf), and the preset builds exactly these pieces from them, the steps
       and the notes are written again from the preset, as Create writes them today;
     - otherwise (a design whose pieces were changed by hand, or that the search cannot read back) every saved step
       that makes one of the joints that changed is marked (step.refresh) and written from the pieces as they are
       now (rule 3 in js/buildsteps.js), and the notes get the line about screw heads.
   Only a design with one placement has steps of its own; with two or more, the steps are worked out from the
   pieces anyway. Returns 'preset', 'refreshed' or ''. */
function bringWordsUpToDate(placements,changedKeys,drillWordsOnly,drillWordsToo){
  if(placements.length!==1)return'';
  // only the words that tell to drill pocket holes are out of date: the saved steps that say so are written again
  if(drillWordsOnly&&!(S.steps||[]).some(step=>step&&Array.isArray(step.add)&&!step.drill&&drillOrders(stepText(step)).length))return'';
  const{preset,parts}=placements[0];
  const saved=(S.steps||[]).filter(step=>step&&Array.isArray(step.add));
  const setNumber=parts[0].set;
  const vals=presetValuesOf(preset,parts,setNumber!==undefined&&S.sets&&S.sets[setNumber]?S.sets[setNumber].vals:null);
  if(vals){
    const stepsOf=preset.steps||STEPS[preset.name];
    if(saved.length&&stepsOf)S.steps=stampSteps(stepsOf(vals),parts);
    S.notes=(preset.notes?preset.notes(vals):[]).concat(headsNote(preset.name));
    if(setNumber!==undefined&&S.sets&&S.sets[setNumber])S.sets[setNumber].vals={...vals};
    return saved.length?'preset':'notes';
  }
  // the steps that make a joint that changed: the step of the later of its two pieces (rule 6 in js/buildsteps.js)
  const owner=presetStepOfPieces(saved);
  // (drillWordsToo: saved before 5, with fasteners that changed as well: the steps that tell to drill pocket holes are
  //  written again too, not only those that make a joint that changed)
  if(drillWordsOnly||drillWordsToo)for(const step of saved)if(!step.drill&&drillOrders(stepText(step)).length)step.refresh=true;
  for(const key of changedKeys){
    const[a,b]=key.split('-').map(Number);
    if(!owner.has(a)||!owner.has(b))continue;
    saved[Math.max(owner.get(a),owner.get(b))].refresh=true;
  }
  const line=headsNote(preset.name);
  if(line.length&&!(S.notes||[]).some(note=>/^Screw heads:/.test(note)))S.notes=(S.notes||[]).concat(line);
  return'refreshed';
}
/* The form values that build exactly these pieces (the same names, materials, sizes and places relative to each
   other), or null. Tried in turn: the values saved with the placement, the preset's defaults, and a short search
   that changes one value at a time among the likely ones (each choice; whole numbers within their limits; for a
   size, the sizes of the pieces themselves) and keeps the change that makes more pieces match. A design of more
   than PRESET_SEARCH_MAX pieces is only tried with the first two. */
const PRESET_SEARCH_MAX=400;
function presetValuesOf(preset,parts,savedVals){
  const wanted=piecePrints(parts);
  const score=vals=>{
    let built;
    try{built=preset.build({...vals});}catch(e){return-1;}
    if(!Array.isArray(built)||!built.length)return-1;
    return matchingPrints(wanted,piecePrints(built),built.length);
  };
  const exact=vals=>score(vals)===wanted.length+1;   // every piece matches, and no piece more or less
  const defaults=presetDefaults(preset);
  if(savedVals&&exact({...defaults,...savedVals}))return{...defaults,...savedVals};
  if(exact(defaults))return defaults;
  if(parts.length>PRESET_SEARCH_MAX)return null;
  // the likely values of each form row
  const sizes=new Set();
  for(const p of parts)for(const v of[p.l,p.w,p.t])sizes.add(r16(v));
  const whole=bbox(parts);
  if(whole)for(let k=0;k<3;k++)sizes.add(r16(whole.hi[k]-whole.lo[k]));
  const choicesOf=q=>{
    if(q.opts)return q.opts.map(opt=>Array.isArray(opt)?opt[0]:opt&&opt.v!==undefined?opt.v:opt);
    if(typeof q.v==='boolean')return[true,false];
    if(typeof q.v!=='number')return[q.v];
    const list=new Set([q.v]);
    if(q.min!==undefined)list.add(q.min);
    if(q.max!==undefined)list.add(q.max);
    if(q.int&&q.min!==undefined&&q.max!==undefined&&q.max-q.min<=40)for(let n=q.min;n<=q.max;n++)list.add(n);
    if(!q.int)for(const v of sizes)if((q.min===undefined||v>=q.min)&&(q.max===undefined||v<=q.max))list.add(v);
    return[...list];
  };
  const rows=preset.params.filter(q=>q.k&&!q.show&&!q.check);
  let best={...defaults},bestScore=score(best);
  for(let pass=0;pass<3;pass++){
    let better=false;
    for(const q of rows){
      for(const value of choicesOf(q)){
        if(value===best[q.k])continue;
        const trial={...best,[q.k]:value},trialScore=score(trial);
        if(trialScore>bestScore){best=trial;bestScore=trialScore;better=true;}
      }
    }
    if(bestScore===wanted.length+1||!better)break;
  }
  return bestScore===wanted.length+1?best:null;
}
/* each piece as one line of text: name, material, size, which way it runs, and where it is measured from the
   lowest corner of all of them (so a design moved as a whole still matches) */
function piecePrints(parts){
  const whole=bbox(parts);
  return parts.map(p=>[p.name,p.mat,r16(p.l),r16(p.w),r16(p.t),(p.ax||[]).join(''),
    p.pos.map((v,k)=>r16(v-(whole?whole.lo[k]:0))).join(','),JSON.stringify(p.rot||null),JSON.stringify(p.q||null)].join('|')).sort();
}
/* how many prints of `wanted` the built ones match, one each; plus 1 when they match every one and there are just
   as many pieces (so `wanted.length + 1` means exactly the same pieces) */
function matchingPrints(wanted,built,builtCount){
  const left=new Map();
  for(const print of built)left.set(print,(left.get(print)||0)+1);
  let found=0;
  for(const print of wanted){
    const n=left.get(print)||0;
    if(n){left.set(print,n-1);found++;}
  }
  return found+(found===wanted.length&&builtCount===wanted.length?1:0);
}
ON_LOAD.push(upgradeFastening);
/* A design made today is fastened the current way from the start (placePreset keeps S.fastening; a new, empty
   project gets it at its first opening above). */

/* ---------- self-check ----------
   Projects written by the program as it was before today's rules (commit 8cd3c9c, tops screwed down; and the
   version of this morning, tops held from underneath but the sides of a bookshelf screwed through), each opened
   the way a file is opened (load). The pieces, the fasteners and the placements are as that program saved them;
   only the steps, the notes and the parts of the file that play no part here are left out. */
const OLD_PROJECTS={
  // the Desk, with one fastener chosen by hand: an L-bracket between a leg and a long apron (joint 63-67)
  desk:{"name":"Desk","parts":[{"id":62,"name":"Top","mat":"ply34","l":48,"w":24,"t":0.75,"ax":[0,2,1],"pos":[0,29.25,0],"set":5},{"id":63,"name":"Leg","mat":"4x4","l":29.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[1,0,1],"set":5},{"id":64,"name":"Leg","mat":"4x4","l":29.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[1,0,19.5],"set":5},{"id":65,"name":"Leg","mat":"4x4","l":29.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[43.5,0,1],"set":5},{"id":66,"name":"Leg","mat":"4x4","l":29.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[43.5,0,19.5],"set":5},{"id":67,"name":"Long apron","mat":"2x4","l":39,"w":3.5,"t":1.5,"ax":[0,1,2],"pos":[4.5,25.75,1],"set":5},{"id":68,"name":"Long apron","mat":"2x4","l":39,"w":3.5,"t":1.5,"ax":[0,1,2],"pos":[4.5,25.75,21.5],"set":5},{"id":69,"name":"Short apron","mat":"2x4","l":15,"w":3.5,"t":1.5,"ax":[2,1,0],"pos":[1,25.75,4.5],"set":5},{"id":70,"name":"Short apron","mat":"2x4","l":15,"w":3.5,"t":1.5,"ax":[2,1,0],"pos":[45.5,25.75,4.5],"set":5},{"id":71,"name":"Cross rail","mat":"2x4","l":19,"w":3.5,"t":1.5,"ax":[2,1,0],"pos":[23.25,25.75,2.5],"set":5}],"joints":{"63-67":"bracket"},"named":{},"sets":{"5":{"name":"Desk","uses":{"Top":"tableTop","Top board":"tableTop","Seat board":"tableTop","Long apron":"tableTop","Short apron":"tableTop","Cross rail":"tableTop","Long stretcher":"shelf","Short stretcher":"none","Shelf slat":"shelf","Lower shelf":"shelf","Shelf rail":"shelf"},"wall":[],"hung":[],"wallFixed":false}},"look":{"style":"std","wood":"pine","finish":"clear"},"nextId":72,"nextSet":5},
  bookshelf:{"name":"Bookshelf","parts":[{"id":72,"name":"Side","mat":"1x10","l":48,"w":9.25,"t":0.75,"ax":[1,2,0],"pos":[0,0,0.25],"set":6},{"id":73,"name":"Side","mat":"1x10","l":48,"w":9.25,"t":0.75,"ax":[1,2,0],"pos":[31.25,0,0.25],"set":6},{"id":74,"name":"Top","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,47.25,0.25],"set":6},{"id":75,"name":"Bottom","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,3.5,0.25],"set":6},{"id":76,"name":"Shelf","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,18.0625,0.25],"set":6},{"id":77,"name":"Shelf","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,32.6875,0.25],"set":6},{"id":78,"name":"Toe kick","mat":"1x4","l":30.5,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[0.75,0,7.75],"set":6},{"id":79,"name":"Base rail","mat":"1x4","l":30.5,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[0.75,0,0.25],"set":6},{"id":80,"name":"Back rail","mat":"1x4","l":30.5,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[0.75,43.75,0.25],"set":6},{"id":81,"name":"Back panel","mat":"ply14","l":44.5,"w":32,"t":0.25,"ax":[1,0,2],"pos":[0,3.5,0],"set":6}],"joints":{},"named":{},"sets":{"6":{"name":"Bookshelf","uses":{"Top":"books","Bottom":"books","Shelf":"books","Toe kick":"books","Base rail":"books","Back rail":"none"},"wall":[],"hung":[],"wallFixed":true}},"look":{"style":"std","wood":"pine","finish":"clear"},"nextId":82,"nextSet":6},
  bed:{"name":"Platform bed","parts":[{"id":94,"name":"Side rail","mat":"2x6","l":55.5,"w":5.5,"t":1.5,"ax":[2,1,0],"pos":[0,8.5,0],"set":8},{"id":95,"name":"Side rail","mat":"2x6","l":55.5,"w":5.5,"t":1.5,"ax":[2,1,0],"pos":[40,8.5,0],"set":8},{"id":96,"name":"End rail","mat":"2x6","l":38.5,"w":5.5,"t":1.5,"ax":[0,1,2],"pos":[1.5,8.5,0],"set":8},{"id":97,"name":"End rail","mat":"2x6","l":38.5,"w":5.5,"t":1.5,"ax":[0,1,2],"pos":[1.5,8.5,54],"set":8},{"id":98,"name":"Leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[1.5,0,1.5],"set":8},{"id":99,"name":"Leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[1.5,0,50.5],"set":8},{"id":100,"name":"Leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[36.5,0,1.5],"set":8},{"id":101,"name":"Leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[36.5,0,50.5],"set":8},{"id":102,"name":"Cleat","mat":"2x2","l":45.5,"w":1.5,"t":1.5,"ax":[2,1,0],"pos":[1.5,10.75,5],"set":8},{"id":103,"name":"Cleat","mat":"2x2","l":45.5,"w":1.5,"t":1.5,"ax":[2,1,0],"pos":[38.5,10.75,5],"set":8},{"id":104,"name":"Center beam","mat":"2x4","l":52.5,"w":3.5,"t":1.5,"ax":[2,1,0],"pos":[20,8.75,1.5],"set":8},{"id":105,"name":"Center leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[21.5,0,1.5],"set":8},{"id":106,"name":"Center leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[21.5,0,26],"set":8},{"id":107,"name":"Center leg","mat":"4x4","l":12.25,"w":3.5,"t":3.5,"ax":[1,2,0],"pos":[21.5,0,50.5],"set":8},{"id":108,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,1.5],"set":8},{"id":109,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,7.625],"set":8},{"id":110,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,13.75],"set":8},{"id":111,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,19.875],"set":8},{"id":112,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,26],"set":8},{"id":113,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,32.125],"set":8},{"id":114,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,38.25],"set":8},{"id":115,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,44.375],"set":8},{"id":116,"name":"Slat","mat":"1x4","l":38.5,"w":3.5,"t":0.75,"ax":[0,2,1],"pos":[1.5,12.25,50.5],"set":8},{"id":117,"name":"Mattress","mat":"mattress","l":38,"w":52,"t":10,"ax":[0,2,1],"pos":[1.75,13,1.75],"set":8}],"joints":{"94-108":"none","94-109":"none","94-110":"none","94-111":"none","94-112":"none","94-113":"none","94-114":"none","94-115":"none","94-116":"none","95-108":"none","95-109":"none","95-110":"none","95-111":"none","95-112":"none","95-113":"none","95-114":"none","95-115":"none","95-116":"none","96-108":"none","97-116":"none","98-102":"none","99-102":"none","100-103":"none","101-103":"none"},"named":{"94-108":"none","94-109":"none","94-110":"none","94-111":"none","94-112":"none","94-113":"none","94-114":"none","94-115":"none","94-116":"none","95-108":"none","95-109":"none","95-110":"none","95-111":"none","95-112":"none","95-113":"none","95-114":"none","95-115":"none","95-116":"none","96-108":"none","97-116":"none","98-102":"none","99-102":"none","100-103":"none","101-103":"none"},"sets":{"8":{"name":"Platform bed","uses":{"Slat":"bedSlat","Cleat":"bedSlat","Center beam":"bedSlat","Side rail":"bedSlat","End rail":"bedSlat"},"wall":[],"hung":[],"wallFixed":false}},"look":{"style":"std","wood":"pine","finish":"clear"},"nextId":118,"nextSet":8},
  // saved this morning: the top held from underneath already (S.styled), the sides still screwed through
  // the Storage box / toy chest at its usual size, whole, steps and notes as that program saved them
  toychest:{"name":"Storage box / toy chest","parts":[{"id":130,"name":"Front","mat":"ply34","l":30,"w":16,"t":0.75,"ax":[0,1,2],"pos":[0,0,15.25],"set":12},{"id":131,"name":"Back","mat":"ply34","l":30,"w":16,"t":0.75,"ax":[0,1,2],"pos":[0,0,0],"set":12},{"id":132,"name":"Side","mat":"ply34","l":16,"w":14.5,"t":0.75,"ax":[1,2,0],"pos":[0,0,0.75],"set":12},{"id":133,"name":"Side","mat":"ply34","l":16,"w":14.5,"t":0.75,"ax":[1,2,0],"pos":[29.25,0,0.75],"set":12},{"id":134,"name":"Bottom","mat":"ply34","l":28.5,"w":14.5,"t":0.75,"ax":[0,2,1],"pos":[0.75,0,0.75],"set":12},{"id":135,"name":"Lid","mat":"ply34","l":30,"w":16,"t":0.75,"ax":[0,2,1],"pos":[0,16,0],"set":12}],"joints":{},"stock":{},"notes":["The lid is stiff enough for someone to sit on. Do not stand on it.","For a toy chest, fit a soft-close lid support so the lid cannot slam on fingers, and leave a finger gap or drill air holes so a child cannot be shut inside."],"steps":[{"t":"Cut every piece on the cut list and pencil its letter on it. Measure twice, cut once, and cut the longest pieces first.","add":[],"ids":[],"sig":null},{"t":"Fasten the two sides between the front and the back. Glue each joint, drill pilot holes and screw through the front and the back into the side edges, a screw every 6\".","add":["Front","Back","Side"],"ids":[130,131,132,133],"sig":{"sizes":"16x14.5x0.75,16x14.5x0.75,30x16x0.75,30x16x0.75","spread":[61,61,117,117]}},{"t":"Drop the bottom in flush with the lower edges and fasten it through all four walls with glue and a screw every 6\".","add":["Bottom"],"ids":[134],"sig":{"sizes":"28.5x14.5x0.75","spread":[0]}},{"t":"Set the lid on top, flush with the walls all round, and hang it on two hinges along the back. Fit a soft-close lid support inside so it cannot slam on fingers.","add":["Lid"],"ids":[135],"sig":{"sizes":"30x16x0.75","spread":[0]}},{"t":"Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust, then paint or stain, and finish with at least two coats of clear coat.","add":[],"ids":[],"sig":null}],"nextId":136,"named":{},"sets":{"12":{"name":"Storage box / toy chest","uses":{"Lid":"lid","Bottom":"general","Front":"none","Back":"none","Side":"none"},"wall":[],"hung":[],"wallFixed":false,"warnings":[],"hw":[]}},"look":{"style":"std","wood":"pine","finish":"clear"},"nextSet":12,"hardware":[],"hw":[],"uses":{},"wall":[],"hung":[],"wallFixed":false},
  morning:{"name":"Bookshelf","parts":[{"id":118,"name":"Side","mat":"1x10","l":48,"w":9.25,"t":0.75,"ax":[1,2,0],"pos":[0,0,0.25],"set":9},{"id":119,"name":"Side","mat":"1x10","l":48,"w":9.25,"t":0.75,"ax":[1,2,0],"pos":[31.25,0,0.25],"set":9},{"id":120,"name":"Top","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,47.25,0.25],"set":9},{"id":121,"name":"Bottom","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,3.5,0.25],"set":9},{"id":122,"name":"Shelf","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,18.0625,0.25],"set":9},{"id":123,"name":"Shelf","mat":"1x10","l":30.5,"w":9.25,"t":0.75,"ax":[0,2,1],"pos":[0.75,32.6875,0.25],"set":9},{"id":124,"name":"Toe kick","mat":"1x4","l":30.5,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[0.75,0,7.75],"set":9},{"id":125,"name":"Base rail","mat":"1x4","l":30.5,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[0.75,0,0.25],"set":9},{"id":126,"name":"Back rail","mat":"1x4","l":30.5,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[0.75,43.75,0.25],"set":9},{"id":127,"name":"Back panel","mat":"ply14","l":44.5,"w":32,"t":0.25,"ax":[1,0,2],"pos":[0,3.5,0],"set":9}],"joints":{},"named":{},"styled":{"120-126":"pocketUnlessRustic"},"sets":{"9":{"name":"Bookshelf","wall":[],"wallFixed":true}},"look":{"style":"std","wood":"pine","finish":"clear"},"nextId":128,"nextSet":9}
};
/* The steps and the notes that program saved with the Bookshelf and the Platform bed above (same piece ids), so a
   project can be opened with them: an old file's words must follow its new fasteners. */
const OLD_WORDS={
  bookshelf:{"notes":["Each shelf is sized for a full row of books: about 80 lb spread along it (40 lb per square foot). These are rule-of-thumb sizes, not an engineer's numbers.","This case is more than 4 times as tall as it is deep. Loaded with books it can be pulled over, so it must be screwed to the wall studs through the back rail under its top. Do not skip that step."],
    "steps":[{"t":"Cut every piece on the cut list and pencil its letter on it. Measure twice, cut once, and cut the longest pieces first.","add":[],"ids":[],"sig":null},{"t":"Lay the two sides next to each other with their bottom ends lined up, and mark the shelf positions across all of them at once so they match. Underside of each piece, measured from the bottom end of the side: bottom board 3 1/2\", shelves 18 1/16\", 32 11/16\".","add":["Side"],"ids":[72,73],"sig":{"sizes":"48x9.25x0.75,48x9.25x0.75","spread":[125,125]},"about":[{"id":75,"measure":"lo1","said":"3 1/2"},{"id":76,"measure":"lo1","said":"18 1/16"},{"id":77,"measure":"lo1","said":"32 11/16"}]},{"t":"Fasten the bottom board between the sides, at the lowest mark, flush with the front and back edges. Drill pilot holes, add glue, and drive two screws through the side into each end of a board.","add":["Bottom"],"ids":[75],"sig":{"sizes":"30.5x9.25x0.75","spread":[0]}},{"t":"Under the bottom board, fasten a toe kick set back 1\" from the front edge and a base rail flush with the back edge. Glue them, drive two screws through each side into each of their ends, and screw down through the bottom board into them about every 8\". They carry the bottom board, so it cannot sag. Do this now, before the shelves go in: afterwards the drill does not fit between the bottom board and the first shelf.","add":["Toe kick","Base rail"],"ids":[78,79],"sig":{"sizes":"30.5x3.5x0.75,30.5x3.5x0.75","spread":[30,30]}},{"t":"Fasten the shelves between the sides, at the marks, flush with the front and back edges, the same way as the bottom board: pilot holes, glue, and two screws through the side into each end of a shelf.","add":["Shelf"],"ids":[76,77],"sig":{"sizes":"30.5x9.25x0.75,30.5x9.25x0.75","spread":[59,59]}},{"t":"Fasten the top between the sides, flush with their top ends, with glue and two screws through each side into its end.","add":["Top"],"ids":[74],"sig":{"sizes":"30.5x9.25x0.75","spread":[0]}},{"t":"Fasten a back rail under the top at the back, standing on edge. Glue it, drive two screws through each side into each of its ends, and screw down through the top into it about every 8\". The screws into the wall studs will go through this rail.","add":["Back rail"],"ids":[80],"sig":{"sizes":"30.5x3.5x0.75","spread":[0]}},{"t":"Lay the case (the box you have built so far) face down. Measure corner to corner both ways and nudge it until the two measurements match, then glue and nail the back on, with a nail about every 6\" into the back edge of every board it lies against: the sides, the top, the bottom board and the shelves. Its top edge is flush with the top of the case and its bottom edge with the underside of the bottom board, so the base rail shows below it. The back is what stops the bookshelf from leaning sideways.","add":["Back panel"],"ids":[81],"sig":{"sizes":"44.5x32x0.25","spread":[0]}},{"t":"Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust, then paint or stain, and finish with at least two coats of clear coat.","add":[],"ids":[],"sig":null},{"t":"Stand it against the wall, find the wall studs with a stud finder, and drive two 3\" screws through the back rail under the top into every stud it crosses (at least one). If a baseboard holds the case off the wall, put a scrap of wood that thick behind the rail at each screw, so the screws do not pull the case out of square. This case is tall for its depth: do not load it before it is fastened.","add":[],"ids":[],"sig":null}]},
  bed:{"notes":["One center beam runs under the slats, on 3 legs of its own: a 1x4 slat carries a mattress and sleepers across about 18\", not across the whole bed.","9 slats with gaps of about 2 5/8\". Most mattress makers ask for gaps of 3\" or less.","Sized by rule of thumb for a mattress and two sleepers: about 30 lb on every square foot."],
    "steps":[{"t":"Cut every piece on the cut list and pencil its letter on it. Measure twice, cut once, and cut the longest pieces first.","add":[],"ids":[],"sig":null},{"t":"Screw a cleat along the inside of each side rail, 1 3/4\" below the top edge and centered end to end. Glue it and drive a 2 1/2\" screw every 8\". The slats rest on these, so do not skimp on the screws.","add":["Side rail","Cleat"],"ids":[94,95,102,103],"sig":{"sizes":"45.5x1.5x1.5,45.5x1.5x1.5,55.5x5.5x1.5,55.5x5.5x1.5","spread":[148,148,160,160]}},{"t":"Stand the two side rails on edge, cleats facing in, and fit the two end rails (the head and the foot of the bed) between them, flush with the ends of the side rails. Glue each joint and drive two 3\" screws through the side rail into the end of the end rail. Then stand a leg in each inside corner, in the space past the end of the cleat, with its top level with the top of the cleat. Glue it and drive two 3\" screws through the side rail and two through the end rail into it.","add":["End rail","Leg"],"ids":[96,97,98,99,100,101],"sig":{"sizes":"12.25x3.5x3.5,12.25x3.5x3.5,12.25x3.5x3.5,12.25x3.5x3.5,38.5x5.5x1.5,38.5x5.5x1.5","spread":[218,218,241,241,241,241]}},{"t":"Fasten the center beam between the head and foot rails, on edge, with its top level with the cleats, in the middle of the bed. Drive two 3\" screws through each rail into the end of the beam. Stand 3 center legs against one side of the beam, with their tops level with the top of the beam: one at each end, tight against the head or foot rail, and one in the middle. Glue each leg to the beam and drive two 3\" screws through the beam into it. Then drive two 3\" screws through the head rail and two through the foot rail into the leg that stands against it: that leg reaches 3 3/4\" up the rail, which is the room you have for them.","add":["Center beam","Center leg"],"ids":[104,105,106,107],"sig":{"sizes":"12.25x3.5x3.5,12.25x3.5x3.5,12.25x3.5x3.5,52.5x3.5x1.5","spread":[10,30,196,196]}},{"t":"Lay the slats across with even gaps of about 2 5/8\"; the first and the last lie tight against the head and foot rails, on the tops of the corner legs. Drive two 1 5/8\" screws down through each end of every slat into the cleat, and two more into the center beam. Where a slat lies on the top of a leg, its two screws go into the leg. The mattress sits about 1\" down inside the frame so it cannot slide.","add":["Slat"],"ids":[108,109,110,111,112,113,114,115,116],"sig":{"sizes":"38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75,38.5x3.5x0.75","spread":[0,49,49,98,98,147,147,196,196]}},{"t":"Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust, then paint or stain, and finish with at least two coats of clear coat.","add":[],"ids":[],"sig":null},{"t":"Set the mattress on the slats.","add":["Mattress"],"ids":[117],"sig":{"sizes":"38x52x10","spread":[0]}}]}
};
SELFTESTS.push(function oldDesignsSwitchToTodaysFastening(problems){
  const wrong=text=>problems.push('old designs: '+text);
  const said=[],keepSay=sayFasteningUpgrade;
  sayFasteningUpgrade=text=>said.push(text);
  const open=(project,changes)=>{said.length=0;load(JSON.stringify({...project,...(changes||{})}),true);return said.slice();};
  const faces=()=>headsByFace();
  try{
    // the Desk: the top held from underneath now, the bracket picked by hand kept, one line said
    let lines=open(OLD_PROJECTS.desk);
    if(lines.length!==1||!/^Updated the fasteners of this Desk to the current way: no screw heads show on the top/.test(lines[0]))wrong(`the old Desk must say once that no screw heads show on its top now, and said: ${lines.join(' / ')||'nothing'}`);
    if(faces().top)wrong(`the old Desk still shows ${faces().top} screw heads on its top`);
    if(S.joints['63-67']!=='bracket')wrong('the old Desk lost the L-bracket that was picked by hand for a leg and a long apron');
    if(S.fastening!==FASTENING_NOW)wrong('the old Desk is not marked as fastened the current way');
    // the same file opened twice gives the same design
    const first=JSON.stringify([S.joints,S.styled,S.named])+fastenerSummary();
    open(OLD_PROJECTS.desk);
    if(JSON.stringify([S.joints,S.styled,S.named])+fastenerSummary()!==first)wrong('opening the old Desk twice does not give the same fasteners');
    // a design that was brought up to date says nothing the next time it is opened
    if(open(JSON.parse(JSON.stringify(S))).length)wrong('a design already fastened the current way is updated again when it is opened');
    // the old Bookshelf: no heads on the top or the sides any more
    // (the line names the faces with no head: "no screw heads show on the top, the front or the sides")
    const saysNoHeadsOn=(line,face)=>{
      const list=String(line||'').match(/no screw heads show on (the \w+(?:, the \w+)*(?: or the \w+)?)/);
      return!!list&&new RegExp(`\\bthe ${face}\\b`).test(list[1]);
    };
    lines=open(OLD_PROJECTS.bookshelf);
    if(!saysNoHeadsOn(lines[0],'sides'))wrong(`the old Bookshelf must say that no screw heads show on its sides, and said: ${lines.join(' / ')||'nothing'}`);
    if(faces().side||faces().top)wrong(`the old Bookshelf still shows screw heads: ${JSON.stringify(faces())}`);
    // this morning's Bookshelf: its top was already held from underneath; its sides change now. The line speaks of
    // the design as it is now, never of what changed ("the top is now held ..." was untrue of it)
    lines=open(OLD_PROJECTS.morning);
    if(!saysNoHeadsOn(lines[0],'sides')||/ is now held| now goes/.test(lines[0]||''))wrong(`this morning's Bookshelf must say that its sides show no screw heads, and nothing about what its top was, and said: ${lines.join(' / ')||'nothing'}`);
    // the old Desk opened in Fine furniture: that program already held its top from underneath there, so the line
    // must not say the top was changed
    lines=open(OLD_PROJECTS.desk,{look:{style:'fine',wood:'pine',finish:'clear'}});
    if(lines.some(line=>/top is now|now held from underneath/.test(line)))wrong(`the old Fine furniture Desk says its top was changed: ${lines.join(' / ')}`);
    // the old toy chest with brads picked by hand between a side and the bottom (heads on the side): the line must
    // not say that no heads show on the sides, and must say whose they are
    lines=open(OLD_PROJECTS.toychest,{joints:{'132-134':'nail'}});
    if(saysNoHeadsOn(lines[0],'sides')||!/on the sides only those of the fasteners you picked yourself/.test(lines[0]||''))wrong(`the old toy chest with brads picked by hand on a side must say the heads on the sides are the ones picked by hand, and said: ${lines.join(' / ')||'nothing'}`);
    if(S.joints['132-134']!=='nail')wrong('the old toy chest lost the brads picked by hand');
    // The words follow the fasteners: an old design keeps the steps and notes it was saved with, and they must not
    // still describe the screws it no longer has. Its notes say where heads show now.
    const STALE=/screws? through (the|each) sides?\b|through each side into|screw down through the (top|bottom board)|through the side rail into the end|through each rail into the end of the beam|through the end rail into it|through the front and the back into|through all four walls/i;
    const staleSteps=()=>buildPlan(true).steps.filter(step=>STALE.test(step.words)).map(step=>`step ${step.no}: "${step.words.match(STALE)[0]}"`);
    for(const[label,project]of[['Bookshelf',{...OLD_PROJECTS.bookshelf,...OLD_WORDS.bookshelf}],['Platform bed',{...OLD_PROJECTS.bed,...OLD_WORDS.bed}],['toy chest',OLD_PROJECTS.toychest]]){
      lines=open(project);
      const stale=staleSteps();
      if(stale.length)wrong(`the old ${label} still describes its old screws after its fasteners switched: ${stale.join('; ')}`);
      if(!(S.notes||[]).some(note=>/^Screw heads:/.test(note)))wrong(`the notes of the old ${label} do not say where screw heads show now`);
      if(!/written again to match/.test(lines[0]||''))wrong(`the old ${label} does not say that its steps were written again: ${lines.join(' / ')||'nothing'}`);
    }
    // ... also when its pieces were changed by hand, so the preset cannot build them again (a shelf moved up): the
    // steps of the joints that changed are written from the pieces, and the ones the person did not touch do not
    // say that the person changed them
    const moved=JSON.parse(JSON.stringify({...OLD_PROJECTS.bookshelf,...OLD_WORDS.bookshelf}));
    moved.parts.find(piece=>piece.id===76).pos[1]=20;
    open(moved);
    const stale=staleSteps(),bottomStep=buildPlan(true).steps.find(step=>step.pieces.some(piece=>piece.id===75));
    if(stale.length)wrong(`an old Bookshelf with a shelf moved by hand still describes its old screws: ${stale.join('; ')}`);
    if(!bottomStep||bottomStep.was)wrong('an old Bookshelf with a shelf moved by hand: the step of its bottom board says the person changed it');
    if(!(S.notes||[]).some(note=>/^Screw heads:/.test(note)))wrong('an old Bookshelf with a shelf moved by hand: its notes do not say where screw heads show now');
    // ... and in Rustic / rough the heads stay where they were, and nothing is said
    lines=open(OLD_PROJECTS.morning,{look:{style:'rustic',wood:'pine',finish:'clear'}});
    if(lines.length||!faces().side)wrong('a Rustic / rough Bookshelf of this morning must keep its screw heads on the sides and say nothing');
    // the old bed: its side rails are held to the legs by plugged screws, and the list buys the plugs
    lines=open(OLD_PROJECTS.bed);
    if(!lines.length)wrong('the old Platform bed says nothing about its fasteners');
    else if(!/hidden: sunk under wooden plugs/.test(lines[0]))wrong(`the old Platform bed does not say that heads are now sunk under plugs (new drilling, plugs to buy): ${lines[0]}`);
    if(faces().side)wrong(`the old Platform bed still shows ${faces().side} screw heads on its sides`);
    if(!coveredHeads().length||!hardwareTotals(findJoints()).rows.some(([label])=>label===PLUG_LABEL))wrong('the old Platform bed has no plugged heads on its side rails, or no plugs on the shopping list');
    // a design that is not from a preset is left alone
    const drawn={name:'My project',parts:[{id:1,name:'Board',mat:'1x4',l:20,w:3.5,t:.75,ax:[0,2,1],pos:[0,10,0]},{id:2,name:'Post',mat:'2x4',l:10,w:3.5,t:1.5,ax:[1,2,0],pos:[0,0,0]}],joints:{},nextId:3};
    load(JSON.stringify(drawn),true);
    const plain=JSON.stringify([S.joints,S.styled||{}]);
    said.length=0;load(JSON.stringify(drawn),true);
    if(said.length||JSON.stringify([S.joints,S.styled||{}])!==plain||Object.keys(S.styled||{}).length)wrong('a design that is not from a preset was changed when it was opened');
  }finally{
    sayFasteningUpgrade=keepSay;
    load(JSON.stringify(blank()),true);
  }
});

/* Self-check: an old fish rack built as separate sections (saved before the sections were bolted together: its end
   posts screwed to each other, no bolts in the file, no fastening rule saved) keeps those screws when it is opened,
   so its sections are still held to each other; a rack of today, with its bolts, keeps the posts unscrewed. */
SELFTESTS.push(function oldRackSectionsStayJoined(problems){
  const wrong=text=>problems.push('old rack sections: '+text);
  const rack=PRESETS.find(preset=>preset.name==='Fish tank wall / rack');
  if(!rack){wrong('the Fish tank wall / rack preset is missing');return;}
  const keepSay=sayFasteningUpgrade;
  sayFasteningUpgrade=()=>{};
  try{
    const vals={...presetDefaults(rack),orient:'long',W:240,build:'sections'};
    placePreset(rack,vals,rack.build(vals),false);
    commit();
    const postJoints=()=>findJoints().filter(j=>j.a.name==='Post'&&j.b.name==='Post');
    if(!postJoints().length){wrong('the sections have no posts side by side, so this check proves nothing');return;}
    // today's file: bolts, posts not screwed; opened again it stays so
    load(JSON.stringify({...S,fastening:undefined}),true);
    if(postJoints().some(j=>jType(j)!=='none'))wrong('a rack of today, opened again, has its bolted posts screwed to each other as well');
    // the old file: no bolts, the posts screwed, no fastening rule
    const old=JSON.parse(JSON.stringify(S));
    old.hardware=(old.hardware||[]).filter(item=>item.kind!=='bolt');
    delete old.fastening;
    for(const j of postJoints()){old.joints[j.key]='screw';old.named=old.named||{};old.named[j.key]='screw';}
    load(JSON.stringify(old),true);
    const loose=postJoints().filter(j=>jType(j)==='none');
    if(loose.length)wrong(`an old rack in sections, opened now, has ${loose.length} pairs of posts held to each other by nothing`);
  }finally{
    sayFasteningUpgrade=keepSay;
    load(JSON.stringify(blank()),true);
  }
});
