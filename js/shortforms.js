/* NominalCAD: every preset form opens short, and nothing on it is lost.

   The owner (16 Nov, on the computer desk form, and "a rule for every form with many options"): "i want most of the
   options hidden behind check boxes and stuff that way it can get as complex as you want". So every form of the
   Furniture presets window opens with the few sizes everyone sets. An option is a check box, mostly off, whose own
   rows show only while it is ticked (under() in js/presets.js). A row that only means something with one choice
   shows only with that choice (the four tank boxes with "Custom" picked, a row's own tank with "Different tank on
   each row" ticked). The rest is under one "More options" fold (entry.short or preset.short, js/presetentry.js).
   Nothing is taken away: every row can still be reached, with the same limits and words, and the untouched form
   builds what it always built.

   The self-checks below hold every entry of the catalog to that:
     presetFormsOpenShort         on opening at most FORM_MOST_ROWS rows show (FORM_ROW_EXCEPTIONS names the entries
                                  that may show more, and why); "More options" starts closed; every box that hides
                                  rows starts as its entry starts it, its rows shown only while it is ticked; every row
                                  that can be seen (the fold opened) does something at the start values; every hidden
                                  row can be reached by the choices of the form; no row shown at once comes and goes
                                  with a row under More options (the row that decides it is where it can be seen)
     presetFormsReopenAsMade      the values a design was made with, put back into its form (the phone's "Sizes", a
                                  design reopened), read back the same, with the options ticked and the fold open where
                                  they were changed; values saved before an option box existed tick that box
     presetFormsBuildTheirPrints  the untouched form hands the builder its own start values (the entry's where it
                                  gives some), and builds the fingerprint recorded in PRESET_PRINTS (js/shapes.js)
     phoneSizesOpenShort          the phone page's Sizes shows the same short form: the fold, the option boxes as rows
                                  a thumb taps, the sizes they reveal with - / + and the size pad
     sizeChoicesFitTheirRows      every size a choice fills in (a tank from the list, a mattress size) is inside the
                                  limits of the box it fills: those boxes are hidden unless Custom is picked, and a
                                  hidden box is never judged, so a new tank in TANKS outside them would go unchecked
     sweepsTryHiddenSizes         the older sweeps that try every size at its smallest and largest (sizesToTry in
                                  js/showfaces.js, fastenersStayInTheWood in js/fastenerreach.js) still reach a size a
                                  choice hides (the tank boxes with Custom), through presetValuesThatShow
     shortFormFaultsAreFound      each of these finds the fault it is for, on a made-up preset with one of each

   How to keep a new form short: give its builder (or its catalog entry) a `short` list of the rows shown at once,
   put an option's rows under its check box with under('key', [rows]), and give a row that belongs to one choice a
   show(p). Run selfTest(): these checks say what is still long, dead or out of reach. */
'use strict';

/* How many rows a form may show as it opens. The owner asked for "about eight" on the computer desk, and that desk
   opens with seven (its three sizes, the drawers and three option boxes), the most any form needed; seven keeps
   every other form at least that short. */
const FORM_MOST_ROWS=7;
/* The entries that may open with more, each with why. A ticked option shows its own rows: an entry that starts
   with options ticked shows them, as a design reopened with them does. */
const FORM_ROW_EXCEPTIONS={
  'gaming-desk':{most:9,why:'it starts with the monitor shelf ticked, and a ticked option shows its own two rows (the shelf depth and width)'},
};

/* ---------- reading the form in the pane ---------- */

/* the rows of the form a person can see now */
function formRowsShown(){
  return[...document.querySelectorAll('#presetForm .frow')].filter(row=>!row.hidden&&!row.closest('[hidden]'));
}
const formBox=key=>document.querySelector(`#presetForm [data-k="${key}"]`);
/* a row can be seen: not hidden by its rule, and not in a closed fold */
const formRowSeen=key=>{const box=formBox(key),row=box&&box.closest('.frow');return!!row&&!row.hidden&&!row.closest('[hidden]');};
/* is a size, written the way its box writes sizes */
const formIsSize=q=>!q.head&&!q.opts&&!q.check&&!q.int&&!q.dec;
/* what is in every box now, as values (not as the text of the box) */
function formRawNow(preset){
  const raw={};
  for(const q of preset.params){
    if(q.head)continue;
    const box=formBox(q.k);
    if(!box)continue;
    raw[q.k]=q.check?box.checked:q.opts?box.value:q.int?parseInt(box.value,10):q.dec?parseFloat(box.value):parseLen(box.value);
  }
  return raw;
}
/* puts values into the boxes, a size the way its box shows sizes */
function formWrite(preset,raw){
  for(const q of preset.params){
    if(q.head||!(q.k in raw))continue;
    const box=formBox(q.k);
    if(!box)continue;
    if(q.check)box.checked=!!raw[q.k];
    else box.value=formIsSize(q)?boxLenOf(q,raw[q.k]):String(raw[q.k]);
  }
}
/* What the form would read, and which rows it would show, with these values in its boxes: the way readVals (js/app.js)
   does it, in order, a row with show(p) asked with the values read so far and a hidden row handing over
   presetChoiceValue. No box is touched. Needs the preset's form in the pane (curPreset, curEntry). */
function formReadAs(preset,raw){
  const vals={},shown=new Set();
  for(const q of preset.params){
    if(q.head)continue;
    let visible=true;
    if(q.show){try{visible=!!q.show(vals);}catch(e){visible=false;}}
    if(visible){shown.add(q.k);vals[q.k]=raw[q.k];}
    else vals[q.k]=presetChoiceValue(q,vals);
  }
  return{vals,shown};
}
/* the other values a row can be given: every choice, ticked and unticked, a number's limits and a step either side */
function formTries(q,now){
  if(q.opts)return q.opts.map(([value])=>value).filter(value=>value!==now);
  if(q.check)return[!now];
  const{min,max}=presetLimits(q),step=q.int?1:q.dec?.5:1;
  const inside=value=>(min===undefined||value>=min-1e-9)&&(max===undefined||value<=max+1e-9);
  const list=[max,min,now+step,now-step,min!==undefined&&max!==undefined?(q.int?Math.round((min+max)/2):(min+max)/2):now*2]
    .filter(value=>value!==undefined&&isFinite(value)&&inside(value)&&Math.abs(value-now)>1e-9);
  return[...new Set(list)];
}

/* ---------- what a set of values builds ---------- */

/* What a preset makes of these values, in three parts, cheapest first: the pieces; what it says (its warning box,
   the remark, the notes, the hardware list); and what it declares (the steps, the loads, the wall, its fasteners,
   its look). A row "does something" when any part differs. */
function formOutcome(preset,vals,part){
  const tryIt=work=>{try{return work();}catch(e){return'error: '+(e&&e.message);}};
  const call=(value,...args)=>typeof value==='function'?value(...args):value;
  if(part===0){
    const parts=tryIt(()=>preset.build(vals)||[]);
    if(!Array.isArray(parts))return String(parts);
    return parts.map(p=>[p.name,p.mat,...p.pos.map(r16),...size(p).map(r16),p.q?p.q.join(','):'',p.rot?JSON.stringify(p.rot):'',p.shape?JSON.stringify(p.shape):'',p.unit||''].join('|')).join(';');
  }
  if(part===1)return JSON.stringify([
    tryIt(()=>(preset.check?preset.check(vals)||[]:[]).map(f=>[f.level,f.text,f.fix||''])),
    tryIt(()=>preset.info?preset.info(vals):''),tryIt(()=>preset.notes?preset.notes(vals):''),tryIt(()=>preset.hw?preset.hw(vals):'')]);
  const stepsOf=preset.steps||(typeof STEPS!=='undefined'&&STEPS[preset.name]);
  return JSON.stringify([tryIt(()=>stepsOf?stepsOf(vals):''),tryIt(()=>call(preset.uses,vals)),tryIt(()=>call(preset.wall,vals)),
    tryIt(()=>call(preset.hung,vals)),tryIt(()=>call(preset.joints,vals)),tryIt(()=>presetLook(preset,vals))]);
}
/* do two sets of values make anything different? (the start's parts are worked out once, in `cache`) */
function formMakesADifference(preset,startVals,vals,cache){
  for(let part=0;part<3;part++){
    if(!(part in cache))cache[part]=formOutcome(preset,startVals,part);
    if(formOutcome(preset,vals,part)!==cache[part])return true;
  }
  return false;
}

/* ---------- the faults of one form ---------- */

/* Opens the entry's form as a person first sees it and returns what is wrong with it, one sentence each.
   options.afterOpen(): run once the form is open (the made-up faults of shortFormFaultsAreFound). */
function shortFormFaults(entry,options){
  options=options||{};
  const faults=[],say=text=>faults.push(`${entry.name}: ${text}`);
  if(!catalogPick(entry.id,{fresh:true})){say('the entry cannot be picked');return faults;}
  const preset=curPreset;
  if(options.afterOpen)options.afterOpen();
  readVals(false);
  // 1. short: rows shown, and the fold closed
  const most=(FORM_ROW_EXCEPTIONS[entry.id]||{}).most||FORM_MOST_ROWS,count=formRowsShown().length;
  if(count>most)say(`it opens with ${count} rows; a form opens with ${most} at most (the owner: "most of the options hidden behind check boxes")`);
  const fold=$('#presetForm .pform-more');
  if(fold&&!fold.hidden)say('"More options" is open as the form opens');
  // 2. every box that hides rows starts as the entry starts it, and its rows show only while it is ticked
  for(const q of preset.params){
    if(!q.check||!preset.params.some(row=>row.under===q.k))continue;
    const box=formBox(q.k);
    if(!box)continue;
    if(box.checked!==!!presetStartValue(q))say(`the box "${q.label}" starts ${box.checked?'ticked':'unticked'}; its entry starts it ${presetStartValue(q)?'ticked':'unticked'}`);
    if(!box.checked){
      const seen=preset.params.filter(row=>row.under===q.k&&formRowsShown().includes(formBox(row.k)&&formBox(row.k).closest('.frow')));
      if(seen.length)say(`the rows of "${q.label}" show while it is unticked: ${seen.map(row=>row.label).join(', ')}`);
    }
  }
  const raw=formRawNow(preset),start=formReadAs(preset,raw),cache={};
  // 3. every row that can be seen does something at the start values (a box that brings rows does that)
  const sameRows=(a,b)=>a.size===b.size&&[...a].every(key=>b.has(key));
  for(const q of preset.params){
    if(q.head||!start.shown.has(q.k))continue;
    const tries=formTries(q,raw[q.k]);
    const acts=tries.some(value=>{
      const next=formReadAs(preset,{...raw,[q.k]:value});
      return!sameRows(next.shown,start.shown)||formMakesADifference(preset,start.vals,next.vals,cache);
    });
    if(!acts)say(`the row "${q.label}" shows but does nothing at these choices (tried ${tries.map(String).join(', ')||'nothing'})`);
  }
  // 3b. no section is split by the fold so that a row of it shown at once comes and goes with a row of it under
  // More options: the row that decides whether the other is there is where the person can see it (the Fish tank
  // wall's "Build it as" goes with "Longest board you can haul"; "Your space" once stood both above and in the fold)
  const foldNode=$('#presetForm .pform-more');
  if(foldNode){
    const folded=q=>{const box=formBox(q.k);return!!box&&foldNode.contains(box);};
    const sectionOf=new Map();
    let section=null;
    preset.params.forEach(q=>{if(q.head)section=q.head;else sectionOf.set(q.k,section);});
    const atOnce=preset.params.filter(q=>!q.head&&formBox(q.k)&&!folded(q)&&start.shown.has(q.k));
    for(const q of preset.params){
      if(q.head||!folded(q)||!start.shown.has(q.k)||!sectionOf.get(q.k))continue;
      const mates=atOnce.filter(row=>sectionOf.get(row.k)===sectionOf.get(q.k));
      const moved=formTries(q,raw[q.k]).map(value=>mates.find(row=>!formReadAs(preset,{...raw,[q.k]:value}).shown.has(row.k))).find(Boolean);
      if(moved)say(`the row "${moved.label}" shows at once, but goes away with a change of "${q.label}", which is under More options`);
    }
  }
  // 4. every hidden row can be reached: up to three changes of the rows that show, each bringing a row back
  const hidden=preset.params.filter(q=>!q.head&&!start.shown.has(q.k)).map(q=>q.k),paths={};
  let frontier=[{raw,path:[]}];
  for(let depth=0;depth<3&&frontier.length&&Object.keys(paths).length<hidden.length;depth++){
    const next=[];
    for(const state of frontier){
      const now=formReadAs(preset,state.raw);
      for(const q of preset.params){
        if(q.head||!now.shown.has(q.k))continue;
        for(const value of formTries(q,state.raw[q.k])){
          const changed={...state.raw,[q.k]:value},after=formReadAs(preset,changed);
          const brought=hidden.filter(key=>after.shown.has(key)&&!(key in paths));
          if(!brought.length)continue;
          const path=[...state.path,[q.k,value]];
          brought.forEach(key=>{paths[key]=path;});
          next.push({raw:changed,path});
        }
      }
    }
    frontier=next;
  }
  for(const key of hidden){
    const q=preset.params.find(row=>row.k===key);
    if(!(key in paths)){say(`the row "${q.label}" can never be shown`);continue;}
    // and the form itself shows it: the changes made in its boxes, the fold opened
    const change={};
    paths[key].forEach(([k,value])=>{change[k]=value;});
    formWrite(preset,change);
    setPresetFold(true);
    readVals(false);
    if(!formRowSeen(key))say(`the row "${q.label}" does not show after ${paths[key].map(([k,v])=>`${k} = ${v}`).join(', ')}`);
    formWrite(preset,raw);
    setPresetFold(false);
    readVals(false);
  }
  return faults;
}

/* ---------- a design's values put back in its form ---------- */

/* The values the form reads after `values` are put in the way a design reopened puts them (fillFormBoxes, as the
   phone's "Sizes" and a design reopened do), starting from the form as it opens. */
function formReopenedWith(entry,raw,values){
  formWrite(curPreset,raw);
  setPresetFold(false);
  fillFormBoxes(values,true);
  return readVals(false);
}
/* the faults of putting the values of every choice of the builder back into its form */
function reopenFaults(entry,options){
  options=options||{};
  const faults=[],say=text=>{if(faults.length<12)faults.push(`${entry.name}: ${text}`);};
  if(!catalogPick(entry.id,{fresh:true})){say('the entry cannot be picked');return faults;}
  const preset=curPreset,raw=formRawNow(preset);
  if(options.afterOpen)options.afterOpen();
  const differs=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)>1e-6:String(a)!==String(b);
  const variants=options.variants||presetVariants().filter(row=>row.preset===preset).map(row=>row.vals);
  const optionBoxes=preset.params.filter(q=>q.check&&preset.params.some(row=>row.under===q.k)).map(q=>q.k);
  for(const variant of variants){
    // made: what the form reads with this choice made in it, as Create keeps it (S.sets[n].vals)
    const made=formReopenedWith(entry,raw,variant);
    if(!made)continue;   // (a choice whose sizes the form refuses is never made)
    const again=formReopenedWith(entry,raw,made);
    const lost=again?Object.keys(made).filter(key=>differs(made[key],again[key])):['every value'];
    if(lost.length){say(`a design made with ${JSON.stringify(variantWords(preset,variant))} reopens with ${lost.join(', ')} changed`);continue;}
    // the fold is open when a row in it holds what the person changed (judged with presetChoiceValue, as the fold
    // itself is: this catches a fold that does not open, not a wrong fill, which sizeChoicesFitTheirRows and
    // untouchedFormFaults look at)
    const fold=$('#presetForm .pform-more');
    if(fold&&fold.hidden){
      const inFold=preset.params.filter(q=>!q.head&&fold.contains(formBox(q.k))&&!formBox(q.k).closest('.frow').hidden&&differs(made[q.k],presetChoiceValue(q,made)));
      if(inFold.length)say(`a design made with ${inFold.map(q=>q.k).join(', ')} changed reopens with "More options" closed`);
    }
  }
  // Saved before its option boxes existed (a fish wall made with a storage shelf as Row 1 before "Different tank on
  // each row" was a box): the values without those boxes, and a row of one of them set, tick the box again and keep
  // the row. Every choice of every row that sits under an option box is tried that way.
  for(const variant of variants){
    const set=Object.keys(variant).filter(key=>{
      const q=preset.params.find(row=>row.k===key);
      return q&&q.under&&optionBoxes.includes(q.under)&&differs(variant[key],presetStartValue(q));
    });
    if(!set.length)continue;
    const older={...variant};
    optionBoxes.forEach(key=>{delete older[key];});
    // what that design is: the same values with the boxes of those rows ticked (a row that its other choices hide,
    // such as the tower shelf's end with drawers at one end, was never part of it)
    const ticked={...older};
    for(const key of set){
      for(let q=preset.params.find(row=>row.k===key);q&&q.under;q=preset.params.find(row=>row.k===q.under)){
        if(optionBoxes.includes(q.under))ticked[q.under]=true;
      }
    }
    const meant=formReopenedWith(entry,raw,ticked);
    if(!meant||!set.some(key=>!differs(variant[key],meant[key])))continue;
    const old=formReopenedWith(entry,raw,older);
    const lostOld=old?Object.keys(meant).filter(key=>differs(meant[key],old[key])):['every value'];
    if(lostOld.length)say(`a design saved before its option boxes, made with ${JSON.stringify(variantWords(preset,variant))}, reopens with ${lostOld.join(', ')} lost`);
  }
  formWrite(preset,raw);
  setPresetFold(false);
  readVals(false);
  return faults;
}
/* the values of a choice that are not the builder's defaults (for the words of a fault) */
function variantWords(preset,vals){
  const usual=presetDefaults(preset);
  return Object.fromEntries(Object.entries(vals).filter(([key,value])=>String(usual[key])!==String(value)));
}

/* ---------- the untouched form builds the fingerprint ---------- */

/* The values the untouched form of an entry hands its builder, against what they should be: the builder's own
   defaults with the entry's start values over them. Returns the faults, and the values read. */
function untouchedFormFaults(entry){
  const faults=[];
  if(!catalogPick(entry.id,{fresh:true}))return{faults:[`${entry.name}: the entry cannot be picked`],vals:null};
  const preset=curPreset,vals=readVals(false);
  if(!vals)return{faults:[`${entry.name}: the untouched form cannot be read (${presetFieldNote})`],vals:null};
  const want={...presetDefaults(preset),...(entry.start||{})};
  const differs=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)>1e-6:String(a)!==String(b);
  for(const key of Object.keys(want))if(differs(want[key],vals[key]))faults.push(`${entry.name}: the untouched form hands the builder ${key} = ${vals[key]}, its start is ${want[key]}`);
  return{faults,vals};
}

/* ---------- the self-checks ---------- */

/* runs a check over the forms with the window's state kept and put back: the entry picked again the way the list
   picks it (its name, its description, "Reset sizes" and the sizes typed in it), as phoneCheckAround does */
function aroundForms(work){
  const kept={picked:catalogState.picked,typed:JSON.parse(JSON.stringify(catalogState.typed)),preset:curPreset,entry:curEntry};
  try{return work();}
  finally{
    catalogState.typed=JSON.parse(JSON.stringify(kept.typed));
    if(kept.picked&&catalogEntry(kept.picked)){catalogState.picked='';catalogPick(kept.picked);}
    else if(kept.preset&&PRESETS.includes(kept.preset))choosePreset(PRESETS.indexOf(kept.preset),kept.entry);
    else showNoPreset();
    catalogState.picked=kept.picked;catalogState.typed=kept.typed;
  }
}
const formEntries=()=>catalogEntries().filter(entry=>!entry.selfCheck);

SELFTESTS.push(function presetFormsOpenShort(problems){
  if(typeof catalogPick!=='function')return;
  aroundForms(()=>{
    for(const entry of formEntries())shortFormFaults(entry).forEach(text=>problems.push('short forms: '+text));
  });
});
SELFTESTS.push(function presetFormsReopenAsMade(problems){
  if(typeof catalogPick!=='function')return;
  aroundForms(()=>{
    // one entry for each builder: the choices are the builder's (its own entries start the same rows)
    const done=new Set();
    for(const entry of formEntries()){
      if(done.has(entry.builder))continue;
      done.add(entry.builder);
      reopenFaults(entry).forEach(text=>problems.push('short forms: '+text));
    }
  });
});
SELFTESTS.push(function presetFormsBuildTheirPrints(problems){
  if(typeof catalogPick!=='function'||typeof presetPrint!=='function')return;
  const keptDesign=JSON.stringify(S),undo0=undoStack.slice(),redo0=redoStack.slice(),tab0=tab;
  try{
    aroundForms(()=>{
      const printed=new Set();
      for(const entry of formEntries()){
        const{faults,vals}=untouchedFormFaults(entry);
        faults.forEach(text=>problems.push('short forms: '+text));
        // the fingerprint is of the builder's own start: built from the first entry that starts there
        const preset=PRESETS.find(row=>row.name===entry.builder);
        if(!vals||faults.length||printed.has(preset.name)||entry.start&&Object.keys(entry.start).length||!PRESET_PRINTS[preset.name])continue;
        printed.add(preset.name);
        let got=presetPrint(preset,vals);
        if(JSON.stringify(got)!==JSON.stringify(PRESET_PRINTS[preset.name]))got=presetPrint(preset,vals);   // (as presetsKeepTheirCutLists: a second look)
        if(JSON.stringify(got)!==JSON.stringify(PRESET_PRINTS[preset.name]))problems.push(`short forms: ${entry.name} built from its untouched form gives ${JSON.stringify(got)}, its fingerprint is ${JSON.stringify(PRESET_PRINTS[preset.name])}`);
      }
      // every builder that has a fingerprint and an entry is built from a form (one with start values only, such as
      // the cabinet builder's Bookshelf, is held to its start values above and to its fingerprint by presetsKeepTheirCutLists)
      for(const preset of PRESETS){
        if(preset.retired||printed.has(preset.name))continue;
        const entries=formEntries().filter(entry=>entry.builder===preset.name);
        if(entries.length&&entries.every(entry=>entry.start&&Object.keys(entry.start).length))continue;
        if(entries.length)problems.push(`short forms: ${preset.name} was not built from its untouched form`);
      }
    });
  }finally{
    load(keptDesign,true);undoStack=undo0;redoStack=redo0;
    if(tab!==tab0)setTab(tab0);
  }
});
/* The phone page shows the same form (it moves #presetForm into its Sizes screen): as short, with the fold a tap
   opens, an option box as a row a thumb taps, and the sizes an option or a choice brings with - and + and the size
   pad. */
SELFTESTS.push(function phoneSizesOpenShort(problems){
  if(typeof phoneCheckAround!=='function'||typeof phoneOpenSizes!=='function')return;
  const wrong=text=>problems.push('short forms, phone: '+text);
  phoneCheckAround(()=>{
    for(const id of['fish-tank-wall','shed','aquarium-stand','cabinet-stand','drawer-nightstand']){
      if(!phoneOpenSizes(id)){wrong(`${id} cannot be opened`);continue;}
      const most=(FORM_ROW_EXCEPTIONS[id]||{}).most||FORM_MOST_ROWS,count=formRowsShown().length;
      if(count>most)wrong(`${id} opens with ${count} rows on the phone`);
      const button=$('#presetForm [data-fold]'),fold=$('#presetForm .pform-more');
      if(!button||!fold||!fold.hidden){wrong(`${id} has no closed "More options" on the phone`);continue;}
      button.click();
      if(fold.hidden)wrong(`a tap on "More options" does not open it on the phone (${id})`);
      button.click();
    }
    // the fish wall: the rows of different tanks behind their box, a tap on the row ticks it; Custom brings the
    // four tank boxes with - and +, a size among them read by the pad
    if(!phoneOpenSizes('fish-tank-wall'))return;
    const foldButton=$('#presetForm [data-fold]');
    if(foldButton)foldButton.click();
    const tick=formBox('rowTanks'),tickRow=tick&&tick.closest('.frow');
    if(!tickRow||!tickRow.classList.contains('ph-ck'))return wrong('"Different tank on each row" is not a row a thumb taps');
    if(formRowSeen('r1'))wrong('Row 1 shows on the phone before its box is ticked');
    tickRow.click();   // a tap on the row, beside the box (phoneToggleRow, js/phone.js)
    readVals(false);
    if(!tick.checked||!formRowSeen('r1')||!formBox('r1').closest('.frow').classList.contains('ph-sel'))wrong('ticking "Different tank on each row" on the phone does not bring Row 1 as a choice');
    const size=formBox('size');
    size.value='custom';size.dispatchEvent(new Event('change',{bubbles:true}));
    const tankRow=formBox('tl').closest('.frow');
    if(!formRowSeen('tl')||!tankRow.classList.contains('ph-step')||!tankRow.querySelector('.ph-plus')||!formBox('tl').readOnly)wrong('Custom does not bring the tank length with - and + and the size pad on the phone');
  });
});

/* ---------- what a size choice fills in, and the sweeps that try every size ---------- */

/* The sizes a choice fills in that are outside the limits of the boxes they fill, for the builder and for each of
   its catalog entries (an entry may narrow the limits). Only the choices the form offers count: the Cabinet stand
   fills from every tank but lists only those deep enough. */
function sizeChoiceFaults(preset){
  const faults=[];
  const limitSets=[{name:preset.name,limits:{}},
    ...catalogEntries().filter(entry=>entry.builder===preset.name&&entry.limits).map(entry=>({name:entry.name,limits:entry.limits}))];
  for(const choice of preset.params){
    if(!choice.fill)continue;
    for(const[value,label]of choice.opts||[]){
      const filled=choice.fill[value];
      if(!filled)continue;
      for(const[key,size]of Object.entries(filled)){
        const q=preset.params.find(row=>row.k===key);
        if(!q){faults.push(`${preset.name}: "${choice.label}" ${label} fills in ${key}, which is not a box of the form`);continue;}
        for(const set of limitSets){
          const own=set.limits[key],min=own?own[0]:q.min,max=own?own[1]:q.max;
          if(min!==undefined&&size<min-1e-9||max!==undefined&&size>max+1e-9)
            faults.push(`${set.name}: "${choice.label}" ${label} fills in ${q.label} ${size}, outside its limits (${min} to ${max}); that box is hidden unless Custom is picked and a hidden box is never judged, so the size would go to the builder unchecked`);
        }
      }
    }
  }
  return faults;
}
SELFTESTS.push(function sizeChoicesFitTheirRows(problems){
  if(typeof catalogEntries!=='function')return;
  for(const preset of PRESETS)sizeChoiceFaults(preset).forEach(text=>problems.push('short forms: '+text));
});

/* A number of a preset's form that a choice above it hides at the usual values (the tank boxes until Custom is
   picked, a mattress size until Custom) must still be tried at its smallest and its largest by the sweeps of every
   size (sizesToTry, js/showfaces.js; the loop of fastenersStayInTheWood, js/fastenerreach.js, asks the same
   presetValuesThatShow). The rows of a check box option are left to presetVariants, as they were before. */
function hiddenSizeSweepFaults(preset){
  if(typeof sizesToTry!=='function')return[];
  const faults=[],usual=presetDefaults(preset),tried=new Set(sizesToTry(preset).map(row=>row.where));
  for(const q of preset.params){
    if(!q.k||q.opts||q.check||q.min===undefined||q.max===undefined||!q.under)continue;
    const choice=preset.params.find(row=>row.k===q.under);
    if(!choice||choice.check)continue;
    // can a person bring it with that choice? (worked out here on its own, not with the helper the sweeps use)
    const values=choice.opts?choice.opts.map(([value])=>value):[choice.max,choice.min,choice.v+1];
    const shows=vals=>{try{return!!q.show(vals);}catch(e){return false;}};
    if(!q.show||shows(usual)||!values.some(value=>value!==undefined&&shows({...usual,[choice.k]:value})))continue;
    if(!tried.has(`${q.label} ${q.min}`)||!tried.has(`${q.label} ${q.max}`))faults.push(`${preset.name}: the sweeps of every size never try "${q.label}" at ${q.min} and at ${q.max} (it is hidden until "${choice.label}" is changed)`);
  }
  return faults;
}
SELFTESTS.push(function sweepsTryHiddenSizes(problems){
  for(const preset of PRESETS)hiddenSizeSweepFaults(preset).forEach(text=>problems.push('short forms: '+text));
});

/* Each check finds the fault it is for: a made-up builder with too many rows, a box that starts wrong, rows of an
   unticked box that show, a row that does nothing, a row that can never be shown, a size choice whose own start
   disagrees with the sizes it fills in (so the untouched form builds something else), a fingerprint that would
   move, a reopened design that loses an option, a fold that stays closed over a changed value, a fold that starts
   open, a row shown at once that a folded row takes away, a size choice that fills in a size outside its box, and
   sweeps that skip a size a choice hides. (Not shown failing here: a row reachable on paper that the real form
   does not show, an untouched form that builds no fingerprint, and the phone's own branches.) */
SELFTESTS.push(function shortFormFaultsAreFound(problems){
  if(typeof catalogPick!=='function')return;
  const wrong=text=>problems.push('short forms (made-up faults): '+text);
  const builder={name:'Self-check short form',desc:'',spec:'self-check',
    params:[{head:'Made up'},num('W','Width',20,10,30),num('H','Height',10,5,20),num('D','Depth',4,2,8),
      {k:'kind',label:'Size',opts:[['big','Big'],['custom','Custom']],v:'big',fill:{big:{X:6}}},
      ...under('kind',[num('X','Board width',3,1,9)],kind=>kind==='custom'),   // its start (3) is not what Big fills in (6)
      num('A','A',1,0,9),num('B','B',1,0,9),num('C','C',1,0,9),
      num('dead','Does nothing',1,0,9),                                         // the builder never reads it
      {...num('never','Never shown',1,0,9),show:()=>false},
      {k:'opt',label:'An option',check:1,v:false},
      ...under('opt',[num('O','Option size',2,1,5)]),
      {k:'O2',label:'Shows without its box',v:2,int:1,min:1,max:5,under:'opt'}],
    build:p=>[mk('Board','1x4',[p.W+p.H+p.D+p.A+p.B+p.C+(p.opt?p.O+p.O2:0),.75,p.X],[0,0,0])]};
  const entry={id:'self-check-short-form',name:'Self-check short form',group:'more',spec:'Made up',icon:'i-presets',builder:builder.name,tags:[],selfCheck:true};
  PRESETS.push(builder);
  CATALOG.push(entry);
  try{
    aroundForms(()=>{
      const found=shortFormFaults(entry,{afterOpen:()=>{formBox('opt').checked=true;}}).join(' / ');
      if(!/opens with \d+ rows/.test(found))wrong('a form of 11 rows is not found too long');
      if(!/the box "An option" starts ticked/.test(found))wrong('a box that starts ticked against its entry is not found');
      if(!/"Does nothing" shows but does nothing/.test(found))wrong('a row that does nothing is not found');
      if(!/"Never shown" can never be shown/.test(found))wrong('a row that can never be shown is not found');
      if(/"Option size" can never be shown|"Board width" can never be shown/.test(found))wrong('a row a box or a choice brings is found out of reach: '+found);
      const loose=shortFormFaults(entry).join(' / ');
      if(!/the rows of "An option" show while it is unticked: Shows without its box/.test(loose))wrong('a row of an unticked box that shows is not found');
      const untouched=untouchedFormFaults(entry).faults.join(' / ');
      if(!/X = 6, its start is 3/.test(untouched))wrong('a size choice whose start disagrees with the sizes it fills in is not found: '+untouched);
      // a reopened design: with no ticking of option boxes, or a fold that never opens by itself, the check sees it
      const tick0=presetTickOptionsOf;
      presetTickOptionsOf=()=>false;
      let lost;
      try{lost=reopenFaults(entry,{variants:[{opt:true,O:4}]}).join(' / ');}finally{presetTickOptionsOf=tick0;}
      if(!/saved before its option boxes.*reopens with/.test(lost))wrong('a design saved before its option box, whose box is not ticked again, is not found: '+lost);
      builder.short=['W','H'];
      const open0=presetFoldOpenIfNeeded;
      presetFoldOpenIfNeeded=()=>{};
      let closed;
      try{closed=reopenFaults(entry,{variants:[{A:4}]}).join(' / ');}finally{presetFoldOpenIfNeeded=open0;delete builder.short;}
      if(!/reopens with "More options" closed/.test(closed))wrong('a design reopened with a changed row under a closed "More options" is not found: '+closed);
      // a fold that starts open, and a row shown at once that a row under the fold takes away
      builder.short=['W','O'];
      let folds;
      try{
        folds=shortFormFaults(entry,{afterOpen:()=>{formBox('opt').checked=true;setPresetFold(true);}}).join(' / ');
      }finally{delete builder.short;}
      if(!/"More options" is open as the form opens/.test(folds))wrong('a form whose "More options" starts open is not found: '+folds);
      if(!/"Option size" shows at once, but goes away with a change of "An option"/.test(folds))wrong('a row shown at once that a row under More options takes away is not found: '+folds);
    });
    // a size choice that fills in a size outside the limits of its box is found
    if(sizeChoiceFaults(builder).length)wrong('the made-up size choice is found outside its limits: '+sizeChoiceFaults(builder).join(' / '));
    const huge={...builder,params:builder.params.map(q=>q.fill?{...q,opts:[...q.opts,['huge','Huge']],fill:{...q.fill,huge:{X:12}}}:q)};
    if(!/Huge fills in Board width 12, outside its limits/.test(sizeChoiceFaults(huge).join(' / ')))wrong('a size choice that fills in a size outside its box is not found');
    // the sweeps of every size: the made-up board width, hidden until Custom, is tried; with the old skip it is not
    if(typeof sizesToTry==='function'){
      if(hiddenSizeSweepFaults(builder).length)wrong('the sweeps do not reach a size a choice hides: '+hiddenSizeSweepFaults(builder).join(' / '));
      const reach0=presetValuesThatShow;
      presetValuesThatShow=(preset,q,usual)=>!q.show||q.show(usual)?usual:null;   // the skip the sweeps had before
      let missed;
      try{missed=hiddenSizeSweepFaults(builder).join(' / ');}finally{presetValuesThatShow=reach0;}
      if(!/never try "Board width"/.test(missed))wrong('sweeps that skip a size a choice hides are not found: '+missed);
    }
    // a fingerprint that would move is seen: the Wall shelf built from its form with its length one inch longer
    const keptDesign=JSON.stringify(S),undo0=undoStack.slice(),redo0=redoStack.slice(),tab0=tab;
    try{
      const shelf=PRESETS.find(preset=>preset.name==='Wall shelf');
      if(shelf&&PRESET_PRINTS[shelf.name]){
        const vals={...presetDefaults(shelf)};
        vals.L+=1;
        if(JSON.stringify(presetPrint(shelf,vals))===JSON.stringify(PRESET_PRINTS[shelf.name]))wrong('a Wall shelf one inch longer gives the same fingerprint, so a moved print would not be seen');
      }
    }finally{load(keptDesign,true);undoStack=undo0;redoStack=redo0;if(tab!==tab0)setTab(tab0);}
  }finally{
    PRESETS.pop();
    CATALOG.pop();
    renderPresetCards();
  }
});
