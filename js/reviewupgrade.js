/* NominalCAD: a design saved before the woodworker's-eye review fixes is brought up to date when it is opened.

   The fixes changed what two presets build and say, and a design keeps the pieces, steps and notes it was saved
   with. Without this file a toy chest saved from the published program would open with no air holes and a note that
   offers them as a choice, and a saved Coffee table would keep the slat step a beginner cannot do. So when a design
   is opened (a saved file, the autosave, a pasted project):
     - Storage box / toy chest (review E3, child safety): a chest with a lid whose front and sides have no hole at all
       gets its air holes (drillAirHoles, js/builders-storage.js), once: the placement is marked (S.sets[n].airHoles),
       so holes a person later takes away by hand are not put back. A placement made today is marked at its first
       commit. Its notes stop offering the holes as a choice.
     - Coffee table and Entryway shoe bench (review E2): saved steps that still lay the slats on the stretchers and
       fasten them from below are written again, so the shelf is built first, upside down on the bench.
   The steps and the notes are written again from the preset when the form values that build exactly these pieces
   can be read back (presetValuesOf, js/fasteningupgrade.js), as Create writes them; otherwise the old note sentence
   is replaced and the old slat step is written from the pieces as they are now (step.refresh, js/buildsteps.js).
   One line (a toast) says what changed. Opening the same file twice gives the same result. This runs after
   upgradeFastening (this file loads after js/fasteningupgrade.js), so it has the last word on the words.
     upgradeReviewFixes()   the ON_LOAD hook. lastReviewUpgrade: what the last opening changed, for the self-check.
     markToyChests()        the ON_COMMIT hook that marks a toy chest made today. */
'use strict';

let lastReviewUpgrade=null;
let sayReviewUpgrade=text=>toast(text);
const TOY_CHEST='Storage box / toy chest';
const SLATTED_SHELF_PRESETS=['Coffee table','Entryway shoe bench'];
// the words the published program used, which these fixes replaced
const OLD_TOY_CHEST_NOTE=/leave a finger gap or drill air holes/;
const OLD_SLAT_STEP=/^Lay the shelf slats across the long stretchers/;

/* the placement's entry in S.sets, or null (a design saved before placements were numbered) */
function placementSet(parts){
  const number=parts[0].set;
  return number!==undefined&&S.sets&&S.sets[number]?S.sets[number]:null;
}
/* the steps and the notes of a design of one placement, written again from its preset as Create writes them, when
   the form values that build exactly its pieces are known. true when it was done. */
function rewriteWordsFromPreset(placement){
  const{preset,parts}=placement;
  const set=placementSet(parts);
  const vals=presetValuesOf(preset,parts,set?set.vals:null);
  if(!vals)return false;
  const stepsOf=preset.steps||STEPS[preset.name];
  if((S.steps||[]).length&&stepsOf)S.steps=stampSteps(stepsOf(vals),parts);
  S.notes=(preset.notes?preset.notes(vals):[]).concat(headsNote(preset.name));
  if(set)set.vals={...vals};
  return true;
}
const stepSaysOldSlats=step=>step&&[step.t,...Object.values(step.byStyle||{})].some(text=>OLD_SLAT_STEP.test(text||''));

/* a toy chest of an old design: its air holes, and the note that offered them as a choice. Returns what was done. */
function upgradeToyChest(placement,alone){
  const{parts}=placement,set=placementSet(parts);
  const marked=set?set.airHoles:S.airHoles;
  const walls=parts.filter(piece=>piece.name==='Front'||piece.name==='Side');
  const lid=parts.some(piece=>piece.name==='Lid');
  let holes=0;
  if(!marked&&lid&&walls.length&&walls.every(wall=>!shapeFeatures(wall).length)){
    for(const wall of walls){
      drillAirHoles(wall);
      holes+=shapeFeatures(wall).length;
    }
    tidyShapes();
  }
  if(set)set.airHoles=true;else S.airHoles=true;
  const oldNote=(S.notes||[]).some(note=>OLD_TOY_CHEST_NOTE.test(note));
  if(!holes&&!oldNote)return null;
  const total=walls.reduce((sum,wall)=>sum+shapeFeatures(wall).filter(f=>f.kind==='hole').length,0);
  let rewritten=alone&&rewriteWordsFromPreset(placement);
  if(!rewritten)S.notes=(S.notes||[]).map(note=>OLD_TOY_CHEST_NOTE.test(note)?toyChestWarning(total):note);
  return{holes,total,rewritten};
}
/* a slatted shelf of an old design: the step that fastened the slats from below */
function upgradeSlattedShelf(placement,alone){
  const stale=(S.steps||[]).filter(stepSaysOldSlats);
  if(!stale.length)return null;
  if(alone&&rewriteWordsFromPreset(placement))return{rewritten:true};
  // the pieces were changed by hand: that step is written from the pieces as they are now
  stale.forEach(step=>{step.refresh=true;});
  return{rewritten:false};
}

function upgradeReviewFixes(){
  lastReviewUpgrade=null;
  if(!S||!Array.isArray(S.parts)||!S.parts.length)return;
  const placements=presetPlacements().filter(entry=>entry.preset.name===TOY_CHEST||SLATTED_SHELF_PRESETS.includes(entry.preset.name));
  if(!placements.length)return;
  connCache=null;
  const alone=presetPlacements().length===1,said=[];
  let rewritten=false;
  for(const placement of placements){
    const name=placement.entry||placement.preset.name;
    if(placement.preset.name===TOY_CHEST){
      const done=upgradeToyChest(placement,alone);
      if(!done)continue;
      rewritten=rewritten||done.rewritten;
      // (the preset's name has a slash in it: "this toy chest" reads better than "this Storage box / toy chest")
      const chest=name===TOY_CHEST?'toy chest':name;
      said.push(done.holes?`this ${chest} now has ${done.total} air holes, ${fmt(AIR_HOLES.d)} across, high on the front and on both ends, so a child shut inside can breathe (the drawings are in Shapes to cut)`
        :`the notes of this ${chest} now say it must have its air holes`);
    }else{
      const done=upgradeSlattedShelf(placement,alone);
      if(!done)continue;
      rewritten=rewritten||done.rewritten;
      said.push(`the lower shelf of this ${name} is now built first, upside down on the bench, where every screw can be reached`);
    }
  }
  if(!said.length)return;
  connCache=null;
  const text='Updated to the current plans: '+said.join('; ')+'.'+(rewritten?' Its build steps and notes were written again to match.':'');
  lastReviewUpgrade={text,said};
  sayReviewUpgrade(text);
}
ON_LOAD.push(upgradeReviewFixes);

/* A toy chest made today has its air holes from the start: its placement is marked at the first commit, so that a
   design whose holes were taken away by hand does not get them back when it is opened again. */
function markToyChests(){
  if(!S||!S.sets)return;
  for(const set of Object.values(S.sets))if(set&&set.name===TOY_CHEST&&!set.airHoles)set.airHoles=true;
}
ON_COMMIT.push(markToyChests);

/* ---------- self-check ----------
   Designs as the published program saved them (main 57bb16b), opened the way a file is opened (load): a toy chest
   (default size), the same in Fine furniture, and a Coffee table and an Entryway shoe bench at their usual sizes.
   Made there with placeInStyle and copied here whole, only the parts that play no part trimmed by JSON round trip:
   the pieces, joints, placements, steps and notes are as that program saved them. */
SELFTESTS.push(function savedDesignsGetTheReviewFixes(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('saved designs: '+text);};
  const kept=JSON.stringify(S),keptSay=sayReviewUpgrade;
  const heard=[];
  sayReviewUpgrade=text=>heard.push(text);
  const open=project=>{heard.length=0;load(JSON.stringify(project),true);return heard.slice();};
  try{
    // a toy chest saved before the air holes: it gets them, its words follow, and it says so once
    const toy=reviewOldToyChest();
    let lines=open(toy);
    const walls=S.parts.filter(piece=>piece.name==='Front'||piece.name==='Side');
    if(walls.some(wall=>!shapeFeatures(wall).some(f=>f.kind==='hole')))wrong('a toy chest saved before the air holes opens with a wall that has none');
    if(S.parts.some(piece=>!['Front','Side'].includes(piece.name)&&shapeFeatures(piece).length))wrong('a toy chest saved before the air holes gets holes in the back, the bottom or the lid');
    // the same holes as a chest made today at that size
    const preset=PRESETS.find(row=>row.name===TOY_CHEST);
    const today=preset.build({...presetDefaults(preset),...(S.sets[toy.parts[0].set].vals||{})});
    const holesOf=parts=>parts.filter(piece=>shapeFeatures(piece).length).map(piece=>piece.name+':'+shapeFeatures(piece).length).sort().join(',');
    if(holesOf(S.parts)!==holesOf(today))wrong(`the old toy chest has holes ${holesOf(S.parts)}, a chest made today ${holesOf(today)}`);
    if((S.notes||[]).some(note=>OLD_TOY_CHEST_NOTE.test(note)))wrong('the old toy chest still offers the air holes as a choice');
    if(!buildPlan(true).steps.some(step=>/air holes/.test(step.words)))wrong('the old toy chest has no step that drills its air holes');
    if(lines.length!==1||!/air holes/.test(lines[0]))wrong(`the old toy chest must say once that it has air holes now, and said: ${lines.join(' / ')||'nothing'}`);
    if(shapeFindings().length)wrong(`the old toy chest's holes break a shape rule: ${shapeFindings()[0].text||shapeFindings()[0].code}`);
    // opened again: nothing more happens; a hole taken away by hand stays away
    const once=JSON.stringify(S.parts);
    lines=open(JSON.parse(JSON.stringify(S)));
    if(lines.length||JSON.stringify(S.parts)!==once)wrong('a toy chest brought up to date changes again when it is opened again');
    for(const wall of S.parts.filter(piece=>piece.name==='Front'||piece.name==='Side'))delete wall.shape;
    commit();
    open(JSON.parse(JSON.stringify(S)));
    if(S.parts.some(piece=>shapeFeatures(piece).length))wrong('air holes taken away by hand come back when the design is opened again');
    // a toy chest made today and its holes taken away by hand: they do not come back either
    load(JSON.stringify(blank()),true);
    placeInStyle(preset,presetDefaults(preset),'std');
    for(const wall of S.parts.filter(piece=>piece.name==='Front'||piece.name==='Side'))delete wall.shape;
    commit();
    lines=open(JSON.parse(JSON.stringify(S)));
    if(lines.length||S.parts.some(piece=>shapeFeatures(piece).length))wrong('a toy chest made today gets its holes back, taken away by hand, when it is opened again');
    // an old open box (no lid) gets no holes
    const box=JSON.parse(JSON.stringify(toy));
    box.parts=box.parts.filter(piece=>piece.name!=='Lid');
    open(box);
    if(S.parts.some(piece=>shapeFeatures(piece).length))wrong('an old open box with no lid gets air holes');
    // a Coffee table and a shoe bench saved with the old slat step: the shelf is built on the bench now
    for(const name of SLATTED_SHELF_PRESETS){
      const old=reviewOldSlattedDesign(name);
      if(!old){wrong(`no old ${name} to open`);continue;}
      lines=open(old);
      const plan=buildPlan(true);
      if(plan.steps.some(step=>/fasten each one from below/.test(step.words)))wrong(`the old ${name} still fastens the slats from below`);
      if(!plan.steps.some(step=>/upside down on your bench/.test(step.words)))wrong(`the old ${name} does not build its shelf upside down on the bench`);
      if(lines.length!==1||!/upside down on the bench/.test(lines[0]))wrong(`the old ${name} must say once that its shelf is built on the bench now, and said: ${lines.join(' / ')||'nothing'}`);
      if(open(JSON.parse(JSON.stringify(S))).length)wrong(`the old ${name}, brought up to date, is updated again when it is opened again`);
    }
    // a design with none of these presets is left alone
    const plain=presetPrintsUntouched();
    if(plain)wrong(plain);
  }finally{sayReviewUpgrade=keptSay;load(kept,true);}
});});
/* An old toy chest: what the published program builds and saves at the default size (no holes, its own steps and
   the note that offers air holes as a choice), made here from today's preset by taking the holes and the marks off
   and putting back the words that program wrote. */
function reviewOldToyChest(){
  const preset=PRESETS.find(row=>row.name===TOY_CHEST);
  const kept=JSON.stringify(S);
  load(JSON.stringify(blank()),true);
  placeInStyle(preset,presetDefaults(preset),'std');
  const old=JSON.parse(JSON.stringify(S));
  load(kept,true);
  for(const piece of old.parts)delete piece.shape;
  for(const set of Object.values(old.sets||{}))delete set.airHoles;
  old.notes=['The lid is stiff enough for someone to sit on. Do not stand on it.',
    'For a toy chest, fit a soft-close lid support so the lid cannot slam on fingers, and leave a finger gap or drill air holes so a child cannot be shut inside.'].concat(headsNote(TOY_CHEST));
  old.steps=(old.steps||[]).filter(step=>!Array.isArray(step.shapes));
  return old;
}
/* An old Coffee table or shoe bench: today's design at its usual size with the slat step the published program wrote
   in place of the shelf step built on the bench. */
function reviewOldSlattedDesign(name){
  const preset=PRESETS.find(row=>row.name===name);
  if(!preset)return null;
  const kept=JSON.stringify(S);
  load(JSON.stringify(blank()),true);
  placeInStyle(preset,presetDefaults(preset),'std');
  const old=JSON.parse(JSON.stringify(S));
  load(kept,true);
  const lay='Lay the shelf slats across the long stretchers with even gaps of about 3/8"';
  const below=`${lay}, and fasten each one from below: drive the pocket screws listed below from the holes on the inside face of the long stretchers up into the ends of the slats. Drill those holes before the stretchers go in, at the places the list gives.`;
  const index=(old.steps||[]).findIndex(step=>/upside down on your bench/.test(step.t||''));
  if(index<0)return null;
  old.steps[index]={...old.steps[index],t:below,byStyle:{std:below,fine:below,rustic:`${lay}, and drive two screws down through each end of every slat into the stretcher under it.`}};
  return old;
}
/* a design of another preset opened through this hook is not changed at all: '' or what changed */
function presetPrintsUntouched(){
  const desk=PRESETS.find(row=>row.name==='Desk');
  if(!desk)return'';
  load(JSON.stringify(blank()),true);
  placeInStyle(desk,presetDefaults(desk),'std');
  const before=JSON.stringify(S);
  const said=[];
  const keptSay=sayReviewUpgrade;
  sayReviewUpgrade=text=>said.push(text);
  load(before,true);
  sayReviewUpgrade=keptSay;
  return said.length||JSON.stringify(S)!==before?'a Desk opened through the review upgrade was changed':'';
}
