/* NominalCAD: what a catalog entry adds to the form of the Furniture presets window.

   One builder (a preset in PRESETS) can serve several entries of the catalog (CATALOG, js/catalog.js): the
   cabinet builder makes a Bookshelf, a Dresser and a Pantry cabinet. Each entry starts the form its own way and
   may say four more things, all optional; an entry that says none of them gets the form exactly as before.

     entry.start    {key: value}        the values the form starts with (the catalog has always had this)
     entry.short    ['W', 'H', ...]     the keys of the rows shown at once. Every other row of the builder goes
                                        into a fold under a text button "More options" (closed at first). The
                                        folded rows stay in the form, so they are read like any other row. The fold
                                        opens by itself when a row inside it is red, or holds a value that is not
                                        the entry's start value (presetFoldOpenIfNeeded).
     entry.limits   {key: [min, max]}   limits narrower than the builder's own, for this entry's form: the box
                                        turns red outside them and the line under the form gives them. The builder
                                        itself still holds to its own limits.
   And on the builder:
     preset.short   ['W', 'H', ...]     the same as entry.short, for every entry of the builder that gives none
                                        (presetShortList; the forms open short: js/shortforms.js checks them all)
     preset.foldSays 'door, windows'    what the fold holds, said on its button ("More options: door, windows"), for
                                        a fold that holds what nearly everyone looks for (the Shed's door); also on
                                        an entry (entry.foldSays)
     preset.hidden  true                the builder never shows under its own name: a design made from one of its
                                        entries is named after the entry ("Dresser"), the project, its component
                                        and the visit counted (placePreset, js/app.js, with presetEntryName)
     preset.afterPlace(ids, vals)       called by placePreset once the doors are hung and the drawers mounted, to
                                        place more hardware (shelf pins) on the new pieces

   In the code: choosePreset (js/app.js) is handed the entry by catalogPick (js/catalog.js) and keeps it in
   curEntry; presetFormRows draws the rows; readVals asks presetLimits and presetStartValue. */
'use strict';

let curEntry=null;   // the catalog entry whose form is in the live pane, or null (a preset chosen by code)
/* the entry, while the form in the live pane is its builder's */
const activeEntry=()=>curEntry&&typeof curPreset!=='undefined'&&curPreset&&curEntry.builder===curPreset.name?curEntry:null;

/* the entry's own start value for a row, else the builder's default */
function presetStartValue(q){
  const entry=activeEntry(),start=entry&&entry.start;
  return start&&Object.prototype.hasOwnProperty.call(start,q.k)?start[q.k]:q.v;
}
/* The value a row stands for while it is hidden, or folded away and left alone. Most rows: their start value. A row
   that a size choice above it fills in (a tank size fills the tank's length, depth, height and gallons; a mattress
   size its width and length: `fill` on the choice) stands for what the choice picked fills in, so a box shown only
   with "Custom" still hands the builder the size of the tank picked. vals: the values read so far (the rows above). */
function presetChoiceValue(q,vals){
  const params=(typeof curPreset!=='undefined'&&curPreset&&curPreset.params)||[];
  for(const choice of params){
    if(!choice.fill||!vals||!(choice.k in vals))continue;
    const filled=choice.fill[vals[choice.k]];
    if(filled&&Object.prototype.hasOwnProperty.call(filled,q.k))return filled[q.k];
  }
  return presetStartValue(q);
}
/* The values with which a row of a preset's form is shown, starting from `usual` (the builder's defaults, or the
   values found so far): `usual` itself when the row shows with them; for a row of an option or of a choice
   (under() in js/presets.js: the tank boxes come with "Custom", a window's sizes with one window or more, Row 1
   with "Different tank on each row") the same values with that option ticked or that choice made, the option
   above it first when it sits inside another one; null when nothing does it in one step per level. The builders
   read those rows directly, so a size tried this way is really built. Read by the sweeps that try every size
   (sizesToTry in js/showfaces.js, fastenersStayInTheWood in js/fastenerreach.js) and by the search for an old
   design's values (presetValuesOf, js/fasteningupgrade.js), so a row the short forms hide is still tried there.
   options.boxes false: rows of a check box option are left out (null), as those sweeps did before the short forms
   (presetVariants ticks each option at its usual sizes). */
function presetValuesThatShow(preset,q,usual,options){
  const boxes=!options||options.boxes!==false;
  const shows=vals=>{try{return!q.show||!!q.show(vals);}catch(e){return false;}};
  if(shows(usual))return usual;
  if(!q.under)return null;
  const parent=preset.params.find(row=>row.k===q.under);
  if(!parent||parent.check&&!boxes)return null;
  const base=presetValuesThatShow(preset,parent,usual,options);   // the option it sits in, first
  if(!base)return null;
  const values=parent.check?[true]:parent.opts?parent.opts.map(([value])=>value)
    :[parent.max,parent.min,parent.v+1].filter(value=>value!==undefined&&isFinite(value));
  for(const value of values){
    const vals={...base,[parent.k]:value};
    if(shows(vals))return vals;
  }
  return null;
}
/* The rows shown at once, the rest going under "More options": the entry's own list (entry.short), else the
   builder's (preset.short, for a builder that is shown under its own name: the fish racks and stands, the Shed, the
   Drawer nightstand), else none (every row shown). */
function presetShortList(){
  const entry=activeEntry();
  if(entry&&Array.isArray(entry.short))return entry.short;
  const preset=typeof curPreset!=='undefined'?curPreset:null;
  return preset&&Array.isArray(preset.short)?preset.short:null;
}
/* A design reopened with the values it was made with (S.sets[n].vals: the phone's "Sizes", a design saved before an
   option box existed) shows the options it was made with: a check box that hides rows (under() in js/presets.js
   marks each of them with the key of its box) and is not among the values is ticked when one of its rows was given
   something other than where it starts. Called by fillFormBoxes (js/catalog.js). */
function presetTickOptionsOf(values){
  const params=(typeof curPreset!=='undefined'&&curPreset&&curPreset.params)||[];
  const differs=(value,start)=>typeof start==='number'?Math.abs((typeof value==='number'?value:parseLen(String(value)))-start)>1e-6
    :typeof start==='boolean'?!!value!==start:String(value)!==String(start);
  let ticked=false;
  // (an option inside an option: a row two levels down ticks both boxes; the rows are walked from the bottom up,
  // so the inner box, or the inner choice, is found first and asks for the outer one)
  const asked=new Set();
  for(const q of params.slice().reverse()){
    if(!q.under)continue;
    const given=q.k in values&&differs(values[q.k],presetStartValue(q));
    if(!given&&!asked.has(q.k))continue;
    const parent=params.find(row=>row.k===q.under);
    if(!parent)continue;
    // (a box or a choice that sits inside an option of its own asks for that one in turn; a box the values untick
    // asks for nothing)
    if(parent.check&&parent.k in values){if(values[parent.k])asked.add(parent.k);continue;}
    asked.add(parent.k);
    if(!parent.check)continue;
    const box=$(`#presetForm [data-k="${parent.k}"]`);
    if(box&&box.type==='checkbox'&&!box.checked){box.checked=true;ticked=true;}
  }
  return ticked;
}
/* the limits a box of the form is held to: {min, max} (either may be undefined) */
function presetLimits(q){
  const entry=activeEntry(),own=entry&&entry.limits&&entry.limits[q.k];
  if(Array.isArray(own)&&own.length===2)return{min:own[0],max:own[1]};
  return{min:q.min,max:q.max};
}
/* the name over the form, and the name a design made from it is given: the entry's for a hidden builder */
function presetEntryName(preset){
  const entry=activeEntry();
  return entry&&preset&&preset.hidden&&entry.builder===preset.name?entry.name:'';
}
/* An entry that starts a builder that is not hidden with other values and says it is shown under its own name
   (entry.titled: "Dining table and chairs", the Dining table with Chairs to match ticked) gives the form its name
   and its description; the design keeps the builder's name. */
const titledEntry=preset=>{const entry=activeEntry();return entry&&entry.titled&&preset&&entry.builder===preset.name?entry:null;};
function presetTitle(preset){
  return presetEntryName(preset)||(titledEntry(preset)||{}).name||preset.name;
}
/* The catalog entry a remembered name opens (the preset created last, LAST_PRESET_KEY in js/app.js), or null when
   the name is a preset of its own that is still listed. Two kinds of name lead to an entry: the name of an old
   preset that has been retired, through PRESET_ALIASES (js/casedata.js: "Bookshelf" opens the Bookshelf entry,
   now made by the cabinet builder), and the name of an entry of a hidden builder ("Bookshelf", "Dresser"), which
   is what placePreset remembers for those. */
function presetEntryForName(name){
  if(!name||typeof CATALOG==='undefined')return null;
  const own=PRESETS.find(preset=>preset.name===name);
  if(own&&!own.retired&&!own.hidden)return null;
  const aliases=typeof PRESET_ALIASES!=='undefined'?PRESET_ALIASES:{};
  const byAlias=aliases[name]&&CATALOG.find(entry=>entry.id===aliases[name]&&entry.builder!==name);
  if(byAlias&&PRESETS.some(preset=>preset.name===byAlias.builder))return byAlias;
  const byName=CATALOG.find(entry=>entry.name===name&&PRESETS.some(preset=>preset.name===entry.builder&&preset.hidden));
  return byName||null;
}
/* the description over the form: the entry's own (entry.desc) for a hidden builder, else the preset's */
function presetDesc(preset){
  const entry=activeEntry();
  return(presetEntryName(preset)||titledEntry(preset))&&entry.desc?entry.desc:preset.desc;
}

/* The rows of the form (presetField, js/app.js, draws each). Each row starts at the entry's start value. With an
   entry that has a `short` list, the rows outside it go into the fold; a section heading goes with its rows, so
   it can stand both above the fold and inside it. */
function presetFormRows(params){
  const startAt=q=>q.head||presetStartValue(q)===q.v?q:{...q,v:presetStartValue(q)};
  const list=presetShortList(),short=list?new Set(list):null;
  if(!short)return params.map((q,index)=>presetField(startAt(q),index)).join('');
  const above=[],folded=[];
  let heading=null,headingAbove=false,headingFolded=false;
  params.forEach((q,index)=>{
    if(q.head){heading={q,index};headingAbove=headingFolded=false;return;}
    const shownAbove=short.has(q.k);
    if(heading&&shownAbove&&!headingAbove){above.push(presetField(heading.q,heading.index));headingAbove=true;}
    if(heading&&!shownAbove&&!headingFolded){folded.push(presetField(heading.q,heading.index));headingFolded=true;}
    (shownAbove?above:folded).push(presetField(startAt(q),index));
  });
  if(!folded.length)return above.join('');
  return above.join('')+
    `<button type="button" class="lnk pform-fold" data-fold aria-expanded="false">${esc(presetFoldWords(false))}</button>`+
    `<div class="pform-more" hidden>${folded.join('')}</div>`;
}
/* The words on the fold's button: "More options", and what it holds where the entry or builder says (foldSays:
   the Shed's "door, windows, wall studs", so a person looking for the door knows where it is); "Fewer options"
   while it is open. */
function presetFoldWords(open){
  if(open)return'Fewer options';
  const entry=activeEntry(),preset=typeof curPreset!=='undefined'?curPreset:null;
  const says=entry&&entry.foldSays||preset&&preset.foldSays;
  return says?`More options: ${says}`:'More options';
}
/* opens or closes the fold */
function setPresetFold(open){
  const fold=$('#presetForm .pform-more'),button=$('#presetForm [data-fold]');
  if(!fold||!button)return;
  fold.hidden=!open;
  button.textContent=presetFoldWords(open);
  button.setAttribute('aria-expanded',String(open));
}
/* Opens the fold when the person must see a row inside it: a box there is red, or a row there holds something
   other than where the entry starts (a value typed earlier in this visit and brought back). Never closes it. */
function presetFoldOpenIfNeeded(vals){
  const fold=$('#presetForm .pform-more');
  if(!fold||!fold.hidden||!curPreset)return;
  if(fold.querySelector('.bad')){setPresetFold(true);return;}
  const differs=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)>1e-6:String(a)!==String(b);
  curPreset.params.forEach((q,index)=>{
    if(q.head||!(q.k in vals))return;
    const row=fold.querySelector(`[data-q="${index}"]`);
    // (a row a size choice fills in, Hand room above a tank, is compared with what that choice fills in)
    if(row&&!row.hidden&&differs(vals[q.k],presetChoiceValue(q,vals)))setPresetFold(true);
  });
}
$('#presetForm').addEventListener('click',event=>{
  const button=event.target.closest('[data-fold]');
  if(!button)return;
  const fold=$('#presetForm .pform-more');
  setPresetFold(!!fold&&fold.hidden);
});
