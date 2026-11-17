/* NominalCAD: "Check my design" on screen.

   The checking itself is js/verify.js, which knows nothing about the page. This file is the part people see:

     checkDesign()                        the command (Tools pulldown, right-click on empty space, the status bar count):
                                          checks the design on screen and opens the Check my design dialog
     lastCheck                            what the last check found; the status bar shows its count
     renderCheckChip()                    draws that count (statusbar.js calls it with the other facts)
     findingsHtml(problems, clickable)    a list of findings as HTML; the dialog and the presets form share it
     findingsText(problems)               the same list as plain text, for askConfirm and showMessage
     presetGate(preset, vals, build)      what Create does in the presets dialog: it refuses a design with a "stop"
                                          and says why, asks before building one with only "warn" items, and
                                          otherwise calls build(parts)
     cannotBuildText(preset, vals)        the words for a preset that builds nothing without a "stop" that says why

   Nothing here runs while the mouse moves. The design is checked when the command is used, and once more after a
   change if a check has already been asked for and the design is small enough to check in an instant. */
'use strict';

let lastCheck=null;              // {problems, facts, skipped, snap}; snap is the design it was made for (lastSnap)
let presetGateOff=false;         // selfTest turns the gate off while it runs its older checks on every preset
const RECHECK_MAX_PIECES=2000;   // after a change, a design up to this size is checked again by itself
const LIVE_CHECK_MAX_PIECES=5000;// the presets form checks designs up to this size while the numbers are typed
const FINDING_WORDS={stop:'Cannot work.',warn:'Marginal.'};
const RULE_OF_THUMB='These are rule-of-thumb checks, not an engineer\'s certification.';

/* ---------- findings as HTML and as text ---------- */
function findingsHtml(problems,clickable){
  return problems.map((f,n)=>{
    // f.word: a finding may carry its own first word ("Does not fit." for a measured room, js/computerdesk.js)
    const body=`${icon('i-warn')}<span><b>${esc(f.word||FINDING_WORDS[f.level])}</b> ${esc(f.text)}<small>${esc(f.fix)}</small></span>`;
    if(clickable&&f.ids.length){
      const what=f.ids.length===1?'this piece':`these ${f.ids.length} pieces`;
      return`<button class="chk-i ${f.level}" data-n="${n}" title="Select and zoom to ${what}">${body}</button>`;
    }
    return`<div class="chk-i ${f.level}">${body}</div>`;
  }).join('');
}
function findingsText(problems){
  const SHOWN=6,lines=problems.slice(0,SHOWN).map(f=>`${f.text}\nWhat to change: ${f.fix}`);
  if(problems.length>SHOWN)lines.push(`And ${problems.length-SHOWN} more.`);
  return lines.join('\n\n');
}
const countWords=(n,one,many)=>`${n} ${n===1?one:many}`;

/* ---------- the check itself, for the design on screen ---------- */
function runCheck(){
  const result=verifyDesign(S.parts,designCheckOptions());   // with the hardware that really holds: js/holds.js
  const problems=result.problems.concat(keptWarnings());
  lastCheck={problems,notes:result.notes||[],facts:result.facts,skipped:result.skipped,snap:lastSnap};
  return result;
}
/* What a preset's own check(p) called marginal when the design was made (placePreset keeps it with the set):
   the general check cannot work these out (a drawer pulled open, a shed with too little wall between its
   openings), so they are repeated here for as long as pieces of that design are still there. */
function keptWarnings(){
  const out=[];
  for(const[number,set]of Object.entries(S.sets||{})){
    if(!set||!Array.isArray(set.warnings)||!set.warnings.length)continue;
    const ids=S.parts.filter(p=>String(p.set)===number).map(p=>p.id);
    if(!ids.length)continue;
    for(const warning of set.warnings){
      out.push({level:'warn',code:'preset',ids,text:String(warning.text||''),...(warning.word?{word:String(warning.word)}:{}),
        fix:[warning.fix,`This was worked out for the sizes the ${set.entry||set.name||'preset'} was made with.`].filter(Boolean).join(' ')});
    }
  }
  return out;
}
/* Is the design tied back to the wall? 'all' when everything is (the tick in the dialog, or every placed preset
   says so in its steps), 'some' when only some of the designs in the project are, 'none' otherwise. */
function wallTieState(){
  if(S.wallFixed)return'all';
  const sets=S.sets||{},wood=S.parts.filter(p=>!isProp(p));
  const tied=wood.filter(p=>sets[p.set]&&sets[p.set].wallFixed).length;
  return!tied?'none':tied===wood.length?'all':'some';
}
function checkDesign(){
  if(!S.parts.length){
    toast('There is nothing to check yet. Add some pieces or pick a preset first.');
    return;
  }
  if(window.countVisitEvent)countVisitEvent('check'); // the public site counts the first check of a visit (js/visits.js)
  runCheck();
  renderCheckChip();
  renderCheckDialog();
  if(!$('#checkDlg').open)$('#checkDlg').showModal();
}
function renderCheckDialog(){
  const{problems,facts,skipped}=lastCheck;
  const stops=problems.filter(f=>f.level==='stop').length,warns=problems.length-stops;
  let summary;
  if(stops)summary=`${countWords(stops,'thing','things')} cannot work as drawn${warns?`, and ${countWords(warns,'more is','more are')} marginal`:''}. Click one to see its pieces.`;
  else if(warns)summary=`It can be built, but ${countWords(warns,'thing is','things are')} marginal. Click one to see its pieces.`;
  else{
    summary='No problems found. Every piece is held up, no board reaches too far between its supports for what it carries, and it will not tip or lean as it stands.';
    // honest about what is not worked out: a drawer pulled open moves its weight out past the feet
    if(facts.onHardware&&facts.onHardware.length)summary+=' What a full drawer does to the balance when it is pulled all the way out is not part of this check.';
  }
  $('#checkSum').textContent=[summary,skipped,RULE_OF_THUMB].filter(Boolean).join('\n');
  $('#checkList').innerHTML=findingsHtml(problems,true);
  // a few facts the check worked out on the way
  // the weight of the wood is the same number the pages show ("Weight of the wood"); loads are said apart
  const pounds=weight=>Math.round(weight).toLocaleString()+' lb';
  const rows=[['Weight',facts.loadWeight?`about ${pounds(facts.weight)} in all: ${pounds(facts.weight-facts.loadWeight)} of wood, and ${pounds(facts.loadWeight)} of full tanks and other things it carries`
    :`about ${pounds(facts.weight)} of wood`]];
  if(facts.footprint)rows.push(['Stands on',`${fmt(facts.footprint.width)} wide × ${fmt(facts.footprint.depth)} deep of floor`]);
  rows.push(['Tallest point',fmt(facts.tallest)]);
  // how many screws into the wall studs hold it, and where (counted from the model: verifyWallScrews, js/verify.js)
  if(facts.wallScrews&&facts.wallScrews.count)rows.push(['Held to the wall by',wallScrewFactWords(facts.wallScrews)]);
  if(facts.centerOfMass)rows.push(['Balance point',`${fmt(facts.centerOfMass[1])} above the floor: the middle of its weight. The lower it is, the harder the design is to tip`]);
  // what each load-carrying piece was checked as carrying, one load with all its pieces: "a roof with light
  // snow (Top plate, Header, Rafter)". A plate is not a roof; it carries one.
  const uses=Object.entries(facts.uses).concat(facts.alsoUses||[]).filter(([,key])=>!USES[key].skip);
  const byLoad=new Map();
  for(const[name,key]of uses){
    if(!byLoad.has(key))byLoad.set(key,[]);
    byLoad.get(key).push(name);
  }
  if(byLoad.size)rows.push(['Checked as carrying',[...byLoad.entries()].map(([key,names])=>`${USES[key].label} (${names.join(', ')})`).join('; ')]);
  if(facts.onHardware&&facts.onHardware.length)rows.push(['On bought hardware',`${facts.onHardware.join(', ')}: taken as hanging on slides or hinges screwed to the piece beside it`]);
  // Pieces that only touch (a slat between two rails, a deck fitted between posts) are said in one row, not in a
  // row for every pair: each is held by its other joints, and a list of them reads like a list of faults.
  const touching=lastCheck.notes.filter(note=>note.code==='unjoined'),pairs=[];
  for(const note of touching){
    const names=/^The (.+?) and the (.+?) touch /.exec(note.text);
    if(names)pairs.push(`the ${names[1]} and the ${names[2]}`);
  }
  if(touching.length===1)rows.push(['Worth knowing',touching[0].text]);
  else if(touching.length)rows.push(['Worth knowing',`Some pieces only touch, with no fastener between them: ${pairs.slice(0,4).join('; ')}${pairs.length>4?'; and '+(pairs.length-4)+' more pairs':''}. Nothing has to change: each is held by its other joints.`]);
  for(const note of lastCheck.notes)if(note.code!=='unjoined')rows.push(['Worth knowing',note.text]);
  $('#checkFacts').innerHTML=rows.map(([name,value])=>`<dt>${esc(name)}</dt><dd>${esc(value)}</dd>`).join('');
  // ticked when everything is tied to the wall, a dash when only some of the designs in the project are
  const tie=wallTieState();
  $('#checkWall').checked=tie==='all';
  $('#checkWall').indeterminate=tie==='some';
  // nobody screws a shed or a garden bed to the wall studs: the tick is not offered for a design made for outdoors
  const outdoors=(PRESET_GROUPS.find(group=>group[0]==='Outdoors')||[,[]])[1];
  const sets=Object.values(S.sets||{}).filter(Boolean);
  const outdoorOnly=sets.length>0&&sets.every(set=>outdoors.includes(set.name))&&S.parts.every(part=>part.set);
  $('#checkWall').closest('label').style.visibility=outdoorOnly?'hidden':'';   // it keeps its place, so the buttons stay put
}
/* clicking a finding closes the dialog, selects its pieces and zooms to them; the finding stays readable as a message */
$('#checkList').onclick=e=>{
  const row=e.target.closest('[data-n]');
  if(!row||!lastCheck)return;
  const finding=lastCheck.problems[+row.dataset.n],ids=finding.ids.filter(id=>byId(id));
  if(!ids.length)return;
  $('#checkDlg').close();
  if(tab!=='design')setTab('design');
  ids.forEach(id=>hiddenIds.delete(id));
  sel=new Set(ids);
  renderAll();
  focusSel();
  toast(`${finding.text} ${finding.fix}`);
};
$('#bCheckAgain').onclick=checkDesign;
$('#checkWall').onchange=e=>{
  // The tick speaks for everything on screen. Taking it away also takes away what the presets declared
  // ("its steps screw it to the wall"), so that somebody who will not do that sees what the check then says.
  S.wallFixed=e.target.checked;
  if(!S.wallFixed)for(const set of Object.values(S.sets||{}))if(set)set.wallFixed=false;
  commit();
  checkDesign();
};

/* ---------- the count in the status bar ---------- */
function renderCheckChip(){
  const el=$('#stCheck');
  if(!lastCheck||!S.parts.length){el.hidden=true;return;}
  // the design changed since the check: look again, unless it is big enough for that to be noticed
  let old=lastCheck.snap!==lastSnap;
  if(old&&S.parts.length<=RECHECK_MAX_PIECES){runCheck();old=false;}
  const stops=lastCheck.problems.filter(f=>f.level==='stop').length,warns=lastCheck.problems.length-stops;
  el.hidden=!stops&&!warns;
  if(el.hidden)return;
  const words=[stops?`${stops} cannot work`:'',warns?`${warns} marginal`:''].filter(Boolean).join(' · ');
  el.innerHTML=`${icon('i-warn')}${words}`;
  el.classList.toggle('stop',!!stops);
  el.title=`Check my design found ${countWords(stops,'thing','things')} that cannot work and ${countWords(warns,'thing','things')} that ${warns===1?'is':'are'} marginal`+
    (old?', before your last change':'')+'. Click to check again and see them.';
}

/* ---------- Create in the presets dialog ---------- */
/* A preset that builds nothing and has no "stop" that says why (it has no check(p), or the check is switched
   off): its own remark under the form says what is wrong and what to change; one without a remark gets the
   general sentence. The live summary and the message from Create both take their words from here. */
function cannotBuildText(preset,vals){
  const remark=preset.info?preset.info(vals):'';
  return remark||'Nothing fits with these sizes. Try a wider or taller space.';
}
/* the one message for "this cannot be built", whatever the reason */
const CANNOT_BUILD_TITLE='This cannot be built';
/* build(parts, alreadyAsked): alreadyAsked is true when the person has just answered "Build anyway", so the
   caller does not put a second question straight after it. note is added to that question: what else building
   it does (it replaces the design on screen). */
function presetGate(preset,vals,build,note){
  // What it says quotes the sizes typed in the form the way its boxes show them (speakAsBoxes, js/core.js).
  // Only the words: building runs outside, so the notes and steps of the design stay in inches.
  const cannotText=()=>speakAsBoxes(()=>cannotBuildText(preset,vals));
  if(presetGateOff){
    const parts=preset.build(vals);
    if(parts.length)build(parts);
    else showMessage(CANNOT_BUILD_TITLE,cannotText(),{wide:true});
    return;
  }
  const check=speakAsBoxes(()=>checkPreset(preset,vals));
  if(check.stops.length){
    showMessage(CANNOT_BUILD_TITLE,`${findingsText(check.shownStops.length?check.shownStops:check.stops)}\n\n${RULE_OF_THUMB}`,{wide:true});
    return;
  }
  if(!check.parts.length){
    showMessage(CANNOT_BUILD_TITLE,cannotText(),{wide:true});
    return;
  }
  if(check.warns.length){
    // Warnings that carry their own first word (f.word: "Does not fit." for a measured room, js/computerdesk.js) are
    // not a design that is weak by rule of thumb: the window says what they are, and leaves out the rule-of-thumb line
    const ownWords=[...new Set(check.warns.map(f=>f.word||''))];
    const ownWord=ownWords.length===1&&ownWords[0]?ownWords[0].replace(/\.$/,''):'';
    askConfirm(`It can be built, but look at ${check.warns.length===1?'this':'these'} first:\n\n${findingsText(check.warns)}${ownWord?'':'\n\n'+RULE_OF_THUMB}${note?'\n\n'+note:''}`,
      {title:ownWord||'This design is marginal',action:'Build anyway',cancel:'Go back',wide:true},()=>build(check.parts,true));
    return;
  }
  build(check.parts,false);
}

/* ---------- self-check: what a preset declares stays with its own pieces (selfTest runs every function in SELFTESTS) ----------
   Two presets in one project must each be checked by their own declarations: "Add beside the current design"
   once kept them per project and per piece name, so a Bookshelf added to a side table lost its "screwed to the
   wall", and a Workbench added to a Bookshelf turned the Bookshelf's top into a workbench top. Also: a project
   saved before sets existed is still read by its project-wide lists, the marginal findings of a preset's own
   check(p) are repeated by Check my design, and the dialog does not promise what the check does not work out. */
SELFTESTS.push(function declarationsStayWithTheirPieces(problems){
  const preset=name=>PRESETS.find(p=>p.name===name);
  const place=(name,add,over)=>{
    const p=preset(name),vals={...presetDefaults(p),...(over||{})};
    placePreset(p,vals,p.build(vals),add);
  };
  const findings=()=>{runCheck();return lastCheck.problems.map(f=>f.level+':'+f.code).join(', ');};
  const pairs=[['Side table / nightstand','Bookshelf'],['Bookshelf','Workbench'],['Wall shelf','Shed'],['Fish tank wall / rack','Garage shelves']];
  for(const[first,second]of pairs){
    if(!preset(first)||!preset(second))continue;
    place(first,false);
    place(second,true);
    const got=findings();
    if(got)problems.push(`add beside: ${second} added beside ${first} must check as clean as each does alone, but gave ${got}`);
    if(new Set(S.parts.map(p=>p.set)).size!==2)problems.push(`add beside: the pieces of ${first} and ${second} must carry two different set numbers`);
  }
  if(preset('Bookshelf')){
    // a tall thing added later is not tied to the wall just because the first design is
    place('Bookshelf',false);
    addParts([mk('Post','2x4',[1.5,72,3.5],[200,0,0]),mk('Post','2x4',[1.5,72,3.5],[240,0,0]),mk('Top rail','2x4',[41.5,1.5,3.5],[200,72,0])]);
    commit();
    if(!/top-heavy/.test(findings()))problems.push('add beside: a tall frame drawn next to a Bookshelf was taken as screwed to the wall like the Bookshelf');
    // the same Bookshelf as an older version saved it: no sets, the lists kept for the whole project by name
    place('Bookshelf',false);
    const old=JSON.parse(JSON.stringify(S)),declared=Object.values(old.sets)[0];
    old.parts.forEach(p=>{delete p.set;});
    Object.assign(old,{uses:declared.uses,wall:declared.wall,hung:declared.hung,wallFixed:declared.wallFixed});
    delete old.sets;
    load(JSON.stringify(old),true);
    const got=findings();
    if(got)problems.push('older project: a Bookshelf saved without sets must still check clean by its project-wide lists, but gave '+got);
  }
  const nightstand=preset('Nightstand with drawers');
  if(nightstand){
    // marginal by its own check(p): a full top drawer pulled out nearly tips it
    // (the overall size, the top included: the narrowest, shallowest and lowest the form allows, one drawer, no open shelf)
    const vals={...presetDefaults(nightstand),W:15,D:13.5,H:21,N:'1',cub:false};
    const own=(nightstand.check(vals)||[]).filter(f=>f.level==='warn');
    if(!own.length)problems.push('kept warnings: the narrow nightstand of this self-check is no longer marginal, pick other sizes for it');
    placePreset(nightstand,vals,nightstand.build(vals),false);
    runCheck();
    if(own.length&&!lastCheck.problems.some(f=>f.code==='preset'&&f.text===own[0].text))problems.push('kept warnings: Check my design must repeat what the preset itself called marginal when the design was made');
    place('Nightstand with drawers',false);
    runCheck();
    renderCheckDialog();
    if(lastCheck.problems.length)problems.push('kept warnings: the default nightstand must check clean');
    else if(!/drawer/.test($('#checkSum').textContent))problems.push('check dialog: with drawers in the design the clean verdict must say that a drawer pulled out is not part of the check');
  }
});
