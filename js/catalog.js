/* NominalCAD: the catalog of the Furniture presets window, and the two panes of that window that browse it.

   The window has three panes side by side:
     GROUPS (left)    Start here, Recent and Favorites, then All designs and every group that has pieces in it,
                      each with a count.
     PIECES (middle)  a search box and filter chips over the tiles of the chosen group (or of the search).
                      On screen the things a person picks are called "designs", because "pieces" already means
                      the boards of a design (the Pieces panel, "Pieces to cut" in the live pane).
     THE LIVE PANE    the chosen piece: its description, the live picture, the form, the remark and the warning
     (right)          box, and the buttons. It is drawn by choosePreset and showPresetSummary in js/app.js and is
                      always there: choosing a tile fills it at once, nothing ever covers or replaces it.

   Three layers, so the list can grow past a hundred pieces without turning into a tangle:
     BUILDERS   the code that builds a kind of thing from a form: the preset objects in PRESETS (js/presets.js and
                the files beside it). "Builder" is a word for the code only; it never appears on screen.
     ENTRIES    what a person picks: CATALOG below. An entry names the builder it uses and the values it hands
                the form, so several entries may share one builder (a Bookshelf, a Pantry and a Wardrobe from
                one cabinet builder, each starting the form differently).
     VIEWS      what the window shows of the entries: Start here (CATALOG_START), Recent (what this browser made
                last), Favorites (the star on a tile), All designs, each group, and the results of a search.

   HOW TO ADD A PIECE THAT AN EXISTING BUILDER CAN MAKE: add one entry to CATALOG:
       { id:'pantry', name:'Pantry', group:'storage', spec:'Tall, shallow shelves', icon:'i-p-shelf',
         builder:'Bookshelf', start:{D:12, H:84}, tags:['shelves','kitchen'] }
     - id      stable and unique, lowercase with dashes. Recent and Favorites are kept by it, so never change it.
     - name    the name on the tile (about 20 letters at most).
     - group   the id of one row of CATALOG_GROUPS. Each entry is in exactly one group.
     - spec    the short line under the name on the tile (about 25 letters).
     - icon    an icon of the #sprite block in index.html (the i-p-... pictures).
     - builder the name of the preset in PRESETS that builds it.
     - start   optional: values the form starts with, by field key, in the units of the form (inches, a count,
               the value of a choice). Anything not given starts at the builder's own default.
     - desc    optional: a description of its own for the live pane. Without it the pane shows the builder's.
     - tags    words a search finds it by, and the ids of the filter chips it belongs under (CATALOG_CHIPS).
   HOW TO ADD A BUILDER (a new preset): add it to PRESETS as js/presets.js says, then give it an entry here.
     A preset with no entry still shows, under "More", so nothing is lost, but selfTest() reports it.
   HOW TO ADD A GROUP: add a row to CATALOG_GROUPS where it should appear in the list. A group with no entries
     is not shown, so a group can be added before its first piece is finished.
   HOW TO ADD A FILTER CHIP: add a row to CATALOG_CHIPS and its id to the tags of the entries it covers. Some chips
     are checked by selfTest against what the pieces really are (catalogChipsTellTheTruth below): keep them true.

   In the code:
     renderPresetCards()        draws the groups and the pieces (js/app.js calls it once at start, the
                                self-checks after adding a made-up preset)
     catalogOpened()            the window was just opened (openPresets): show the chosen piece, keyboard in the search box
     catalogPick(id, options)   choose an entry: fill the live pane with its builder's form, its start values and
                                whatever was typed for it earlier in this visit
     catalogEntries()           every entry whose builder exists, plus the automatic ones under "More"
     presetTileInWindow(index)  for selfTest: clicks the group of PRESETS[index] and returns its tile
   Kept in this browser: woodshop.catalog.recent and woodshop.catalog.favorites (lists of entry ids). */
'use strict';

/* The groups, in the order the window lists them. These are the groups of the brainstorm list; a group shows
   only once it has a piece in it. A search finds a piece by the words of its group's name, or by `find` instead
   when the name promises more than every piece of the group is (no piece of Aquariums is made for a terrarium yet;
   add the word once one is). */
const CATALOG_GROUPS=[
  {id:'aquariums',name:'Aquariums and terrariums',find:['aquariums','fish tanks']},
  {id:'tables',name:'Tables and desks'},
  {id:'seating',name:'Seating'},
  {id:'storage',name:'Storage and shelving'},
  {id:'bedroom',name:'Bedroom'},
  {id:'outdoors',name:'Outdoors'},
  {id:'kids',name:'Kids'},
  {id:'pets',name:'Pets'},
  {id:'fun',name:'Fun'},
  {id:'workshop',name:'Workshop'},
  {id:'hobby',name:'Hobby and utility'},
  {id:'more',name:'More'},          // where a preset without an entry lands (see catalogEntries)
];

/* The filter chips over the tiles. A chip narrows the tiles shown to the entries that carry its id in their tags.
   `find` holds the words a search finds the chip's pieces by. It is not the label: "Has doors or drawers" would
   let "drawer" find a cabinet that only has doors, so those pieces carry their own words (door, drawers). */
const CATALOG_CHIPS=[
  {id:'beginner',label:'Beginner-friendly',find:['beginner','easy','first project'],
    tip:'Rated "a good first project": plain cuts and screws, nothing that needs much experience'},
  {id:'doors',label:'Has doors or drawers',find:[],tip:'Comes with doors or drawers that open'},
  {id:'outdoor',label:'Outdoor',find:['outdoor'],tip:'Made to stand outside: starts as bare wood or cedar'},
  {id:'tanks',label:'For tanks',find:['tanks'],tip:'Holds fish tanks, sized for the weight of the water'},
  {id:'shop',label:'Shop',find:['shop','workshop'],tip:'For the garage or the workshop'},
];

/* One entry for each preset that exists today. Tags that are not chip ids are only words a search finds. */
const CATALOG=[
  // Aquariums and terrariums
  {id:'fish-tank-wall',name:'Fish tank wall / rack',group:'aquariums',spec:'One rack or a whole wall',icon:'i-p-rack',
    builder:'Fish tank wall / rack',tags:['tanks','fish','aquarium','fish room','rack','wall']},
  {id:'cabinet-stand',name:'Cabinet stand',group:'aquariums',spec:'Doors below, tanks on top',icon:'i-p-stand',
    builder:'Cabinet stand with a row of tanks',tags:['tanks','doors','fish','aquarium','cabinet','row of tanks','door']},
  {id:'aquarium-stand',name:'Single aquarium stand',group:'aquariums',spec:'One tank, cabinet below',icon:'i-p-stand',
    builder:'Single aquarium stand',tags:['tanks','doors','beginner','fish','aquarium','cabinet','door']},
  // Tables and desks
  {id:'dining-table',name:'Dining table',group:'tables',spec:'4x4 legs, 2x6 plank top',icon:'i-presets',
    builder:'Dining table',tags:['beginner','table','kitchen','farmhouse']},
  {id:'coffee-table',name:'Coffee table',group:'tables',spec:'Slatted lower shelf',icon:'i-presets',
    builder:'Coffee table',tags:['beginner','table','living room']},
  {id:'side-table',name:'Side table / nightstand',group:'tables',spec:'2x2 legs, board top',icon:'i-presets',
    builder:'Side table / nightstand',tags:['beginner','table','end table','bedside','nightstand']},
  {id:'desk',name:'Desk',group:'tables',spec:'4x4 legs, plywood top',icon:'i-presets',
    builder:'Desk',tags:['table','office','computer','study']},
  // Seating
  {id:'sturdy-bench',name:'Sturdy bench',group:'seating',spec:'4x4s, 2x4s and 2x6s',icon:'i-p-bench',
    builder:'Sturdy bench',tags:['beginner','bench','seat','patio']},
  {id:'five-board-bench',name:'Five-board bench',group:'seating',spec:'Classic first project',icon:'i-p-bench',
    builder:'Five-board bench',tags:['beginner','bench','seat','stool']},
  {id:'shoe-bench',name:'Entryway shoe bench',group:'seating',spec:'Seat over a shoe shelf',icon:'i-p-bench',
    builder:'Entryway shoe bench',tags:['beginner','bench','seat','shoes','hallway','mudroom']},
  // Storage and shelving
  {id:'bookshelf',name:'Bookshelf',group:'storage',spec:'Fixed shelves, thin back',icon:'i-p-shelf',
    builder:'Bookshelf',tags:['shelves','books','bookcase']},
  {id:'garage-shelves',name:'Garage shelves',group:'storage',spec:'2x4 frame, plywood decks',icon:'i-p-shelf',
    builder:'Garage shelves',tags:['shop','shelves','garage','shelving unit']},
  {id:'base-cabinet',name:'Base cabinet',group:'storage',spec:'Shelf, doors and a top',icon:'i-p-cabinet',
    builder:'Base cabinet with doors',tags:['doors','cabinet','cupboard','kitchen','door']},
  {id:'storage-box',name:'Storage box / toy chest',group:'storage',spec:'Plywood box, hinged lid',icon:'i-p-box',
    builder:'Storage box / toy chest',tags:['box','chest','toys','lid','blanket chest','kids','toy chest']},
  {id:'wall-shelf',name:'Wall shelf',group:'storage',spec:'Board on a wall cleat',icon:'i-p-wallshelf',
    builder:'Wall shelf',tags:['beginner','shelf','floating shelf']},
  // Bedroom
  {id:'platform-bed',name:'Platform bed',group:'bedroom',spec:'2x6 frame, 1x4 slats',icon:'i-p-bed',
    builder:'Platform bed',tags:['bed','mattress','twin','queen','king']},
  {id:'drawer-nightstand',name:'Drawer nightstand',group:'bedroom',spec:'Plywood, 1 to 4 drawers',icon:'i-p-cabinet',
    builder:'Nightstand with drawers',tags:['doors','drawers','bedside','nightstand','dresser']},
  // Outdoors
  {id:'shed',name:'Shed',group:'outdoors',spec:'Gable or lean-to roof',icon:'i-p-shed',
    builder:'Shed',tags:['outdoor','building','garden','storage','roof']},
  {id:'planter-box',name:'Planter box',group:'outdoors',spec:'1x6 sides, slatted bottom',icon:'i-p-planter',
    builder:'Planter box',tags:['outdoor','beginner','garden','plants','flowers','cedar']},
  {id:'raised-garden-bed',name:'Raised garden bed',group:'outdoors',spec:'2x6 sides, 4x4 posts',icon:'i-p-planter',
    builder:'Raised garden bed',tags:['outdoor','beginner','garden','vegetables','plants','cedar']},
  {id:'bird-feeder',name:'Bird feeder',group:'outdoors',spec:'Tray with a pitched roof',icon:'i-p-feeder',
    builder:'Bird feeder',tags:['outdoor','birds','garden','cedar']},
  // Workshop
  {id:'workbench',name:'Workbench',group:'workshop',spec:'4x4 frame, plywood top',icon:'i-presets',
    builder:'Workbench',tags:['shop','bench','table','garage']},
];

/* Start here: a few good first projects, in this order. Each must carry the beginner tag (selfTest checks).
   The Bookshelf, the Storage box, the Base cabinet and the Drawer nightstand are not here (nor tagged beginner):
   in the Everyday style they are held together with pocket screws, so no screw head shows on a top, front or side (js/showfaces.js), and a pocket-hole jig on top of the plywood is what the window rates "Beginner with patience", not "a good first project". */
const CATALOG_START=['five-board-bench','wall-shelf','planter-box','side-table','raised-garden-bed','sturdy-bench'];

const CATALOG_RECENT_KEY='woodshop.catalog.recent';       // browser storage: ids of the entries made last, newest first
const CATALOG_FAVORITES_KEY='woodshop.catalog.favorites'; // browser storage: ids of the starred entries
const CATALOG_RECENT_MAX=8;                                // how many Recent keeps

/* The views of the groups list. Each gives the ids of its entries. The first three stand above the groups;
   "All designs" (every entry, group by group) heads the groups, with a line above it. */
const CATALOG_VIEWS=[
  {id:'start',name:'Start here',ids:()=>CATALOG_START,empty:''},
  {id:'recent',name:'Recent',ids:()=>catalogStored(CATALOG_RECENT_KEY),
    empty:'Nothing made in this browser yet. What you create shows here.'},
  {id:'favorites',name:'Favorites',ids:()=>catalogStored(CATALOG_FAVORITES_KEY),
    empty:'No favorites yet. Click the star on a tile to keep it here.'},
  {id:'all',name:'All designs',headsGroups:true,empty:'',
    ids:()=>CATALOG_GROUPS.flatMap(group=>catalogEntries().filter(entry=>entry.group===group.id)).map(entry=>entry.id)},
];

const STAR_SVG='<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/></svg>';

/* What the window is showing. Lives for the visit; Recent and Favorites are the only things kept in the browser. */
const catalogState={
  view:'start',        // the id of a view ('start', 'recent', 'favorites', 'all') or of a group
  find:'',             // what is typed in the search box
  chips:new Set(),     // ids of the chips that are on
  picked:'',           // id of the entry whose form is in the live pane
  formNode:null,       // the heading of the form the catalog filled last; another one means code redrew the form
  typed:{},            // entry id -> {field key: what was in the box}, so a piece keeps its numbers in this visit
  nextSetAtOpen:null,  // S.nextSet when the window opened: a higher one at the next commit means a piece was created
  rememberInCheck:false, // the self-check of Recent turns this on to let a creation be remembered while it runs
};

/* ---------- the entries ---------- */

/* Every entry that can be picked: the entries of CATALOG whose builder exists (an entry for a preset that is
   gone is left out quietly), and one automatic entry under "More" for each preset that has no entry. */
function catalogEntries(){
  const names=new Set(PRESETS.map(preset=>preset.name));
  const listed=CATALOG.filter(entry=>names.has(entry.builder));
  const covered=new Set(listed.map(entry=>entry.builder));
  const automatic=PRESETS.filter(preset=>!covered.has(preset.name)).map(preset=>({
    id:'preset:'+preset.name,name:preset.tile||preset.name,group:'more',spec:preset.spec||'',
    icon:preset.icon||'i-presets',builder:preset.name,tags:[],automatic:true}));
  return listed.concat(automatic);
}
function catalogEntry(id){
  return catalogEntries().find(entry=>entry.id===id)||null;
}
function builderIndex(entry){
  return PRESETS.findIndex(preset=>preset.name===entry.builder);
}
/* the entry to show for a preset chosen by code: the picked one if it uses that preset, else its first entry */
function entryForPreset(preset){
  if(!preset)return null;
  const entries=catalogEntries();
  return entries.find(entry=>entry.id===catalogState.picked&&entry.builder===preset.name)||
    entries.find(entry=>entry.builder===preset.name)||null;
}

/* A list of entry ids kept in the browser. Ids of entries that no longer exist are dropped quietly. */
function catalogStored(key){
  let ids=[];
  try{ids=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){ids=[];}
  if(!Array.isArray(ids))return[];
  const known=new Set(catalogEntries().map(entry=>entry.id));
  return ids.filter(id=>typeof id==='string'&&known.has(id));
}
function catalogStore(key,ids){
  try{localStorage.setItem(key,JSON.stringify(ids));}catch(e){} // a browser that refuses storage just forgets
}
function isFavorite(id){
  return catalogStored(CATALOG_FAVORITES_KEY).includes(id);
}
function toggleFavorite(id){
  const ids=catalogStored(CATALOG_FAVORITES_KEY);
  catalogStore(CATALOG_FAVORITES_KEY,ids.includes(id)?ids.filter(other=>other!==id):[...ids,id]);
}
function rememberRecent(id){
  const ids=[id,...catalogStored(CATALOG_RECENT_KEY).filter(other=>other!==id)].slice(0,CATALOG_RECENT_MAX);
  catalogStore(CATALOG_RECENT_KEY,ids);
}

/* ---------- which tiles show ---------- */

function chipLabel(id){
  const chip=CATALOG_CHIPS.find(row=>row.id===id);
  return chip?chip.label:id;
}
/* everything a search looks through for one entry, in lowercase: its name, short line and builder, the words of
   its group, its tags, and for a tag that is a chip the chip's own search words (not its label) */
function searchText(entry){
  const group=CATALOG_GROUPS.find(row=>row.id===entry.group);
  const groupWords=group?(group.find||[group.name]):[];
  const tagWords=(entry.tags||[]).flatMap(tag=>{
    const chip=CATALOG_CHIPS.find(row=>row.id===tag);
    return chip?chip.find||[]:[tag];
  });
  return[entry.name,entry.spec,entry.builder,...groupWords,...tagWords].join(' ').toLowerCase();
}
/* A word as one of a thing, so a plural typed finds the piece: bookshelves and bookshelfs -> bookshelf,
   benches -> bench, boxes -> box, kids -> kid. Short words and words ending in ss are left alone. */
function singular(word){
  if(word.length<4)return word;
  if(/ves$/.test(word))return word.slice(0,-3)+'f';
  if(/ies$/.test(word))return word.slice(0,-3)+'y';
  if(/(ch|sh|x|ss)es$/.test(word))return word.slice(0,-2);
  if(/[^s]s$/.test(word))return word.slice(0,-1);
  return word;
}
/* The entries that match what is typed. Every word typed must match, as typed or as one of a thing (singular):
   anywhere inside the name ("shelf" finds the Bookshelf), or at the start of a word of the short line, the tags or
   the group ("table" finds the tables but not "vegetables"). Names that start with what is typed come first, then
   names that contain it, then the rest. */
function searchEntries(find){
  const words=find.toLowerCase().split(/\s+/).filter(Boolean);
  const query=words.join(' ');
  const rank=entry=>{
    const name=entry.name.toLowerCase(),one=singular(query);
    return name.startsWith(query)||name.startsWith(one)?0:name.includes(query)||name.includes(one)?1:2;
  };
  const matches=entry=>{
    const name=entry.name.toLowerCase();
    const starts=searchText(entry).split(/[^a-z0-9]+/).filter(Boolean).flatMap(start=>[start,singular(start)]);
    return words.every(word=>{
      const forms=[word,singular(word)];
      return forms.some(form=>{
        const bare=form.replace(/[^a-z0-9]/g,'');          // a word of the text has no dashes or quotes
        return name.includes(form)||(!!bare&&starts.some(start=>start.startsWith(bare)));
      });
    });
  };
  return catalogEntries()
    .filter(matches)
    .map((entry,order)=>({entry,order,rank:rank(entry)}))
    .sort((a,b)=>a.rank-b.rank||a.order-b.order)
    .map(row=>row.entry);
}
/* The entries of a view or a group, before the chips. */
function viewEntries(viewId){
  const view=CATALOG_VIEWS.find(row=>row.id===viewId);
  if(view){
    const entries=catalogEntries();
    return view.ids().map(id=>entries.find(entry=>entry.id===id)).filter(Boolean);
  }
  return catalogEntries().filter(entry=>entry.group===viewId);
}
/* the groups that have pieces in them, in their order */
function shownGroups(){
  const entries=catalogEntries();
  return CATALOG_GROUPS.filter(group=>entries.some(entry=>entry.group===group.id));
}
/* entries narrowed by the chips that are on */
function withChips(entries){
  const chips=[...catalogState.chips];
  return entries.filter(entry=>chips.every(chip=>(entry.tags||[]).includes(chip)));
}
/* What the middle pane lists: the search results or the chosen view, narrowed by the chips that are on. */
function tilesShown(){
  return withChips(catalogState.find?searchEntries(catalogState.find):viewEntries(catalogState.view));
}
/* a view that is no longer there (a group that lost its pieces) gives way to the group of the chosen piece */
function settleView(){
  const known=CATALOG_VIEWS.some(view=>view.id===catalogState.view)||shownGroups().some(group=>group.id===catalogState.view);
  if(known)return;
  const picked=catalogEntry(catalogState.picked);
  catalogState.view=picked?picked.group:'start';
}

/* ---------- drawing the two panes ---------- */

/* Builds the panes the first time; after that it draws the groups, the chips and the tiles again. The search box
   is made once, so it keeps the keyboard while the tiles under it change. */
function renderPresetCards(){
  const pane=$('#presetCards');
  if(!pane)return;
  if(!$('#presetFind')){
    pane.innerHTML=
      `<div class="pfind">
         <input class="fld" id="presetFind" type="search" placeholder="Find a design" autocomplete="off" spellcheck="false"
           aria-label="Find a design" title="Type to find a design by its name, what it is made of or what it is for. Esc clears it.">
         <div class="pchips" id="presetChips"></div>
       </div>
       <div class="ptiles" id="presetTiles"></div>`;
  }
  settleView();
  drawGroups();
  drawChips();
  drawTiles();
}
/* The groups list. Each count is the number of tiles the row shows when clicked, so it counts with the chips
   that are on (a group can then say 0; it stays in the list, which does not jump about as chips go on and off). */
function drawGroups(){
  const pane=$('#presetGroups');
  if(!pane)return;
  const searching=!!catalogState.find;
  const row=(id,name,extra)=>{
    const on=!searching&&catalogState.view===id;
    return`<button class="pgrp${extra||''}${on?' on':''}" data-view="${esc(id)}" tabindex="${on?0:-1}">`+
      `<span>${esc(name)}</span><small>${withChips(viewEntries(id)).length}</small></button>`;
  };
  pane.innerHTML=
    CATALOG_VIEWS.filter(view=>!view.headsGroups).map(view=>row(view.id,view.name)).join('')+
    CATALOG_VIEWS.filter(view=>view.headsGroups).map(view=>row(view.id,view.name,' pgrp-all')).join('')+
    shownGroups().map(group=>row(group.id,group.name)).join('');
  if(searching||!pane.querySelector('.pgrp.on')){
    const first=pane.querySelector('.pgrp');
    if(first)first.tabIndex=0;           // the groups are still one Tab stop while a search is showing
  }
}
function drawChips(){
  const pane=$('#presetChips');
  if(!pane)return;
  const entries=catalogEntries();
  // a chip shows only once some piece carries it
  pane.innerHTML=CATALOG_CHIPS.filter(chip=>entries.some(entry=>(entry.tags||[]).includes(chip.id))).map(chip=>
    `<label class="tg" title="${esc(chip.tip)}"><input type="checkbox" data-chip="${chip.id}"${catalogState.chips.has(chip.id)?' checked':''}><span>${esc(chip.label)}</span></label>`).join('');
}
function tileHtml(entry,favorites){
  const picked=entry.id===catalogState.picked,star=favorites.has(entry.id);
  const index=builderIndex(entry),preset=PRESETS[index];
  // The tile keeps one short line in every view, so it always fits; the tooltip also names the group, which
  // matters in search results, where pieces of every group stand together.
  const group=CATALOG_GROUPS.find(row=>row.id===entry.group);
  const line=entry.spec;
  const tip=`${preset?preset.name:entry.name}${group?` (${group.name})`:''}. ${entry.desc||(preset&&preset.desc)||entry.spec}`;
  return`<div class="ptile">`+
    `<button class="card${picked?' on':''}" data-entry="${esc(entry.id)}" data-i="${index}" tabindex="-1" title="${esc(tip)}">`+
      `${icon(entry.icon||'i-presets','l')}<span><b>${esc(entry.name)}</b><small>${esc(line)}</small></span></button>`+
    `<button class="pstar${star?' on':''}" data-star="${esc(entry.id)}" aria-pressed="${star}" tabindex="-1" `+
      `title="${star?'Take it off Favorites':'Add to Favorites'}" aria-label="${star?'Take it off Favorites':'Add to Favorites'}">${STAR_SVG}</button>`+
    `</div>`;
}
function drawTiles(){
  const pane=$('#presetTiles');
  if(!pane)return;
  const list=tilesShown(),chips=[...catalogState.chips].map(chipLabel);
  const view=CATALOG_VIEWS.find(row=>row.id===catalogState.view)||CATALOG_GROUPS.find(row=>row.id===catalogState.view);
  const title=catalogState.find?`Results for "${catalogState.find}"`:view?view.name:'';
  const narrowed=chips.length?` · ${chips.join(', ')}`:'';
  let body;
  const favorites=new Set(catalogStored(CATALOG_FAVORITES_KEY));
  if(list.length)body=`<div class="tiles">${list.map(entry=>tileHtml(entry,favorites)).join('')}</div>`;
  else if(catalogState.find||chips.length){
    const what=catalogState.find?`"${esc(catalogState.find)}"${chips.length?' with these filters':''}`:'these filters';
    const clear=catalogState.find?`Clear the search${chips.length?' and the filters':''}`:'Clear the filters';
    body=`<p class="pnone">Nothing matches ${what}. <button class="lnk" data-clear-find>${clear}</button></p>`;
  }else{
    const special=CATALOG_VIEWS.find(row=>row.id===catalogState.view);
    body=`<p class="pnone">${esc(special&&special.empty||'Nothing here.')}</p>`;
  }
  pane.innerHTML=`<div class="pcat-head"><b>${esc(title)}${esc(narrowed)}</b><small>${list.length} design${list.length===1?'':'s'}</small></div>${body}`;
  markPicked();
}

/* ---------- choosing a piece ---------- */

/* the boxes of the form the catalog filled, read as they are now: {field key: text or true/false} */
function readFormBoxes(){
  const values={};
  document.querySelectorAll('#presetForm [data-k]').forEach(box=>{
    values[box.dataset.k]=box.type==='checkbox'?box.checked:box.value;
  });
  return values;
}
/* puts values into the boxes of the form; a size is written the way its box shows sizes */
function fillFormBoxes(values,fromEntry){
  let changed=false;
  for(const[key,value]of Object.entries(values||{})){
    const box=$(`#presetForm [data-k="${key}"]`);
    if(!box)continue;
    if(box.type==='checkbox')box.checked=!!value;
    else box.value=fromEntry&&box.hasAttribute('data-len')&&typeof value==='number'?boxLen(value):String(value);
    changed=true;
  }
  return changed;
}
/* the form in the live pane is still the one the catalog filled (code may have drawn another since) */
function formIsOurs(){
  return !!(catalogState.formNode&&catalogState.formNode.isConnected&&catalogState.picked);
}
/* Chooses an entry: the live pane shows its builder's form at once, with the entry's start values and then
   whatever was typed for this piece earlier in this visit.
   options: {focusForm: move the keyboard to the first box of the form, fresh: forget what was typed for it} */
function catalogPick(id,options){
  options=options||{};
  const entry=catalogEntry(id);
  if(!entry)return false;
  const index=builderIndex(entry);
  if(index<0)return false;
  // keep the numbers of the piece we leave; a fresh start of the same piece leaves nothing to keep
  const restartingThisPiece=options.fresh&&catalogState.picked===id;
  if(formIsOurs()&&!restartingThisPiece)catalogState.typed[catalogState.picked]=readFormBoxes();
  if(options.fresh)delete catalogState.typed[id];
  catalogState.picked=id;
  choosePreset(index);                                   // js/app.js: the form, the live picture, the summary
  catalogState.formNode=$('#presetForm .pform-h');
  if(entry.desc){
    $('#presetForm .pform-h h4').textContent=entry.name;
    $('#presetForm .pform-h p').textContent=entry.desc;
  }
  // the way back to where this piece starts, beside its name (the sizes typed are kept otherwise, see typed)
  catalogState.formNode.insertAdjacentHTML('beforeend',
    `<button class="lnk preset-reset" data-reset-sizes title="Put every size and choice of this piece back where it starts">Reset sizes</button>`);
  const started=fillFormBoxes(entry.start,true);
  const restored=fillFormBoxes(catalogState.typed[id],false);
  if(started||restored)showPresetSummary();              // the picture and the summary follow those numbers
  markPicked();
  if(options.focusForm)focusFirstBox();
  return true;
}
/* The tile of the chosen entry is the one marked, and the one the keyboard enters the tiles on (the first tile
   when the chosen one is not in the list). The tiles are one Tab stop, moved through with the arrows, and so
   are the stars: only the star of that tile is in the Tab order, so Tab does not walk through every star. */
function markPicked(){
  const cards=[...document.querySelectorAll('#presetTiles .card')];
  cards.forEach(card=>card.classList.toggle('on',card.dataset.entry===catalogState.picked));
  const entry=cards.find(card=>card.dataset.entry===catalogState.picked)||cards[0];
  cards.forEach(card=>{
    card.tabIndex=card===entry?0:-1;
    const star=card.parentElement.querySelector('.pstar');
    if(star)star.tabIndex=card===entry?0:-1;
  });
}
function focusFirstBox(){
  const box=[...document.querySelectorAll('#presetForm .pform-b [data-k]')].find(field=>!field.closest('[hidden]'));
  if(box){box.focus();if(box.select)box.select();}
}
function showView(viewId){
  catalogState.view=viewId;
  catalogState.find='';
  const find=$('#presetFind');
  if(find)find.value='';
  drawGroups();
  drawTiles();
}
function clearFind(){
  catalogState.find='';
  const find=$('#presetFind');
  if(find)find.value='';
  drawGroups();
  drawTiles();
}

/* The window was just opened (openPresets in js/app.js, after it has chosen a preset). The search and the chips
   start empty, the list shows the group of the chosen piece (or Start here, when that is where it was picked),
   and the keyboard is in the search box. */
function catalogOpened(){
  renderPresetCards();
  catalogState.nextSetAtOpen=S.nextSet||0;
  catalogState.find='';
  catalogState.chips.clear();
  const find=$('#presetFind');
  if(find)find.value='';
  // code may have drawn another form since the catalog last filled one (the self-check puts the form back the
  // way it was): show that preset's entry, with what was typed for it in this visit
  const entry=entryForPreset(curPreset);
  if(entry&&!(formIsOurs()&&entry.id===catalogState.picked))catalogPick(entry.id);
  else if(entry)catalogState.picked=entry.id;
  const inView=viewEntries(catalogState.view).some(row=>row.id===catalogState.picked);
  if(!inView&&entry)catalogState.view=entry.group;
  settleView();
  drawGroups();
  drawChips();
  drawTiles();
  const tile=$('#presetTiles .card.on');
  if(tile)tile.scrollIntoView({block:'nearest'});
  if(find)find.focus();
}

/* A piece was created from the window: remember it under Recent. ON_COMMIT runs at the start of commit(), and
   placePreset (js/app.js) commits right after it has numbered the new placement (S.nextSet), so a number above the
   one at opening means the piece in the live pane was just made. The self-check builds every preset; that is not
   something this browser "made", so nothing is remembered while it runs (autoConfirm is on). */
ON_COMMIT.push(function rememberWhatWasMade(){
  if(catalogState.nextSetAtOpen===null)return;
  const made=(S.nextSet||0)>catalogState.nextSetAtOpen?S.sets&&S.sets[S.nextSet]:null;
  if(!made)return;
  catalogState.nextSetAtOpen=null;
  if(autoConfirm&&!catalogState.rememberInCheck)return;
  const entry=catalogEntry(catalogState.picked);
  if(entry&&entry.builder===made.name)rememberRecent(entry.id);
});

/* ---------- mouse and keyboard ---------- */

/* the tiles in their order on screen, and how many stand in one row */
function tileCards(){
  return[...document.querySelectorAll('#presetTiles .card')];
}
/* Measured on screen: each card sits in its own .ptile box, so its offsetTop is 0 whatever row it is in. */
function tilesPerRow(cards){
  if(cards.length<2)return 1;
  const top=cards[0].getBoundingClientRect().top;
  const inRow=cards.findIndex(card=>Math.abs(card.getBoundingClientRect().top-top)>1);
  return inRow<0?cards.length:inRow;
}
/* moves the keyboard to a tile and chooses it, so the live pane follows the keyboard as it does the mouse */
function goToTile(card){
  if(!card)return;
  catalogPick(card.dataset.entry);
  card=$(`#presetTiles .card[data-entry="${CSS.escape(card.dataset.entry)}"]`)||card;
  card.focus();
  card.scrollIntoView({block:'nearest'});
}
function setupCatalogEvents(){
  const dialog=$('#presetDlg'),groups=$('#presetGroups'),cards=$('#presetCards');
  if(!dialog||!groups||!cards)return;

  groups.addEventListener('click',event=>{
    const button=event.target.closest('.pgrp');
    if(button)showView(button.dataset.view);
  });
  // Up and Down walk the list of groups and show each one; Right goes over to its tiles
  groups.addEventListener('keydown',event=>{
    const buttons=[...groups.querySelectorAll('.pgrp')],at=buttons.indexOf(document.activeElement);
    if(at<0)return;
    let next=null;
    if(event.key==='ArrowDown')next=buttons[Math.min(buttons.length-1,at+1)];
    else if(event.key==='ArrowUp')next=buttons[Math.max(0,at-1)];
    else if(event.key==='Home')next=buttons[0];
    else if(event.key==='End')next=buttons[buttons.length-1];
    else if(event.key==='ArrowRight'){
      event.preventDefault();
      const card=$('#presetTiles .card[tabindex="0"]');
      if(card)card.focus();
      return;
    }
    if(!next)return;
    event.preventDefault();
    showView(next.dataset.view);
    const shown=groups.querySelector(`.pgrp[data-view="${CSS.escape(next.dataset.view)}"]`);
    if(shown)shown.focus();
  });

  cards.addEventListener('click',event=>{
    const star=event.target.closest('.pstar');
    if(star){
      const place=[...cards.querySelectorAll('.pstar')].indexOf(star);
      toggleFavorite(star.dataset.star);
      drawGroups();
      drawTiles();
      // the keyboard stays on this star, or, when its tile has left the list (Favorites), on the star that took
      // its place, or on the search box when the list is empty now
      const stars=[...cards.querySelectorAll('.pstar')];
      const again=stars.find(other=>other.dataset.star===star.dataset.star)||stars[Math.min(place,stars.length-1)];
      if(again)again.focus();else $('#presetFind').focus();
      return;
    }
    if(event.target.closest('[data-clear-find]')){
      catalogState.chips.clear();
      drawChips();
      clearFind();
      $('#presetFind').focus();
      return;
    }
    const card=event.target.closest('.card');
    if(card)catalogPick(card.dataset.entry);
  });
  cards.addEventListener('input',event=>{
    if(event.target.id!=='presetFind')return;
    catalogState.find=event.target.value.trim();
    drawGroups();
    drawTiles();
  });
  cards.addEventListener('change',event=>{
    const chip=event.target.dataset&&event.target.dataset.chip;
    if(!chip)return;
    if(event.target.checked)catalogState.chips.add(chip);else catalogState.chips.delete(chip);
    drawGroups();                                          // the counts on the left count with the chips
    drawTiles();
  });
  cards.addEventListener('keydown',event=>{
    // The search box: Down goes to the tiles, Enter chooses the first piece found and goes to its form.
    // (Enter in a box of a dialog normally presses its primary button, here Create: not from the search box.)
    if(event.target.id==='presetFind'){
      if(event.key==='ArrowDown'){
        event.preventDefault();
        const cards=tileCards();
        goToTile(cards.find(card=>card.dataset.entry===catalogState.picked)||cards[0]);
      }else if(event.key==='Enter'){
        event.preventDefault();
        event.stopPropagation();
        const first=tileCards()[0];
        if(first)catalogPick(first.dataset.entry,{focusForm:true});
      }
      return;
    }
    const card=event.target.closest('.card');
    if(!card)return;
    const all=tileCards(),at=all.indexOf(card),row=tilesPerRow(all);
    const moves={ArrowRight:1,ArrowLeft:-1,ArrowDown:row,ArrowUp:-row,Home:-at,End:all.length-1-at};
    if(event.key in moves){
      event.preventDefault();
      const to=at+moves[event.key];
      if(event.key==='ArrowUp'&&to<0){$('#presetFind').focus();return;} // above the first row is the search box
      goToTile(all[Math.max(0,Math.min(all.length-1,to))]);
    }else if(event.key==='Enter'){
      event.preventDefault();
      catalogPick(card.dataset.entry,{focusForm:true});
    }else if(event.key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&event.key!==' '){
      // typing on a tile types into the search box
      event.preventDefault();
      const find=$('#presetFind');
      find.focus();
      find.value+=event.key;
      find.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });

  // Reset sizes, beside the name in the live pane: the piece starts again from its own sizes and choices
  $('#presetForm').addEventListener('click',event=>{
    if(!event.target.closest('[data-reset-sizes]')||!catalogState.picked)return;
    catalogPick(catalogState.picked,{fresh:true});
    const again=$('#presetForm [data-reset-sizes]');
    if(again)again.focus();
  });

  // Esc in the groups or the pieces first clears the search, then the chips, and only then closes the window.
  // Taken before the dialog sees the key, so the window stays open while there is something to clear. In the
  // live pane Esc is left alone (it closes the window, as it always did): someone backing out of a number must
  // not lose the search or be pulled out of the form.
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(!groups.contains(event.target)&&!cards.contains(event.target))return;
    if(catalogState.find){
      event.preventDefault();
      event.stopPropagation();
      clearFind();
      $('#presetFind').focus();
    }else if(catalogState.chips.size){
      event.preventDefault();
      event.stopPropagation();
      catalogState.chips.clear();
      drawChips();
      drawGroups();
      drawTiles();
      $('#presetFind').focus();
    }
  },true);
  // A window closed without creating anything has nothing for Recent to remember. What was typed for the piece in
  // the live pane is kept, so it is still there if code draws another form before the window opens again.
  // The browser sends "close" a moment after the window shuts (much later while the page is not drawn): when the
  // window has been opened again by then, that late "close" must not wipe what the new opening noted.
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    catalogState.nextSetAtOpen=null;
    if(formIsOurs())catalogState.typed[catalogState.picked]=readFormBoxes();
  });
}
setupCatalogEvents();

/* ---------- for the self-check ---------- */

/* Drives the window the way a person does for PRESETS[index]: clicks its group in the list on the left and returns
   its tile, for the caller to click. What was typed for that piece earlier is forgotten first, because the check
   builds every preset at its defaults. Returns null when the preset cannot be reached that way. */
function presetTileInWindow(index){
  const preset=PRESETS[index],entry=preset&&catalogEntries().find(row=>row.builder===preset.name);
  if(!entry)return null;
  delete catalogState.typed[entry.id];
  // already in the live pane: start it again from its defaults now, or the click on its tile would keep what the
  // person typed in it (the click saves the form of the piece in the pane before it shows the one clicked)
  if(catalogState.picked===entry.id)catalogPick(entry.id,{fresh:true});
  const group=$(`#presetGroups .pgrp[data-view="${CSS.escape(entry.group)}"]`);
  if(!group)return null;
  group.click();
  return $(`#presetTiles .card[data-entry="${CSS.escape(entry.id)}"]`);
}

/* Every preset is one entry in exactly one shown group and is reached in two clicks (its group, then its tile),
   every entry names a builder that exists, a known group, real chips and a real icon, ids are unique, and Start
   here lists only real beginner pieces. */
SELFTESTS.push(function catalogCoversEveryPreset(problems){
  const wrong=text=>problems.push('presets window: '+text);
  const ids=new Set(),names=new Set(PRESETS.map(preset=>preset.name));
  for(const entry of CATALOG){
    if(ids.has(entry.id))wrong(`two entries have the id "${entry.id}"`);
    ids.add(entry.id);
    if(!/^[a-z0-9-]+$/.test(entry.id))wrong(`the id "${entry.id}" must be lowercase letters, numbers and dashes`);
    if(!names.has(entry.builder))wrong(`${entry.name} uses "${entry.builder}", which is not a preset`);
    if(!CATALOG_GROUPS.some(group=>group.id===entry.group)||entry.group==='more')wrong(`${entry.name} is in no known group ("${entry.group}")`);
    if(!entry.name||!entry.spec)wrong(`${entry.id} needs a name and a short line`);
    if(!document.getElementById(entry.icon))wrong(`${entry.name}: there is no icon "${entry.icon}" in index.html`);
    const preset=PRESETS.find(row=>row.name===entry.builder);
    for(const key of Object.keys(entry.start||{}))if(preset&&!preset.params.some(q=>q.k===key))wrong(`${entry.name} starts "${key}", which its form does not have`);
  }
  for(const id of CATALOG_START)if(!CATALOG.some(entry=>entry.id===id&&(entry.tags||[]).includes('beginner')))wrong(`Start here lists "${id}", which is not a beginner piece of the catalog`);
  const dialogWasOpen=$('#presetDlg').open;
  if(!dialogWasOpen)$('#bPreset').click();
  try{
    PRESETS.forEach((preset,index)=>{
      const entries=catalogEntries().filter(entry=>entry.builder===preset.name);
      if(!entries.length||entries.every(entry=>entry.automatic))wrong(`${preset.name} has no entry in the catalog (js/catalog.js); it shows under "More"`);
      const groupsOf=new Set(entries.map(entry=>entry.group));
      if(groupsOf.size!==1)wrong(`${preset.name} is in ${groupsOf.size} groups, it must be in exactly one`);
      // two clicks: its group, then its tile; the live pane must then show that preset
      const tile=presetTileInWindow(index);
      if(!tile){wrong(`${preset.name} cannot be reached by clicking its group`);return;}
      tile.click();
      if(curPreset!==preset)wrong(`clicking the tile of ${preset.name} shows ${curPreset&&curPreset.name} in the live pane`);
    });
    // a group with no pieces is not shown, and every count is the number of its tiles
    const views=[...document.querySelectorAll('#presetGroups .pgrp')].map(button=>button.dataset.view);
    for(const view of views){
      $(`#presetGroups .pgrp[data-view="${CSS.escape(view)}"]`).click();   // a click draws the list again
      const button=$(`#presetGroups .pgrp[data-view="${CSS.escape(view)}"]`);
      if(!button.classList.contains('on'))wrong(`clicking ${view} did not choose it`);
      const count=+button.querySelector('small').textContent,tiles=document.querySelectorAll('#presetTiles .card').length;
      const isGroup=CATALOG_GROUPS.some(group=>group.id===button.dataset.view);
      if(isGroup&&!count)wrong(`the group ${button.dataset.view} is shown with no pieces`);
      if(count!==tiles)wrong(`${button.dataset.view} says ${count} but shows ${tiles} tiles`);
      const name=button.querySelector('span');
      if(name.scrollWidth>name.clientWidth)wrong(`the name of the group ${button.dataset.view} is cut off`);
      if(button.title&&button.title.trim()===name.textContent.trim())wrong(`the row ${button.dataset.view} has a tooltip that only repeats its name`);
    }
  }finally{
    if(!dialogWasOpen)$('#presetDlg').close();
  }
});

/* The chips that can be checked by what a piece really is say the truth about it at its defaults:
   "Has doors or drawers" is on exactly the pieces that come with a door or a drawer, "For tanks" on the ones that
   hold a tank, "Outdoor" on the ones in the Outdoors group (which also start as bare wood, js/builders-outdoor.js),
   and "Beginner-friendly" on the ones rated "a good first project", with the rating the window itself gives. */
SELFTESTS.push(function catalogChipsTellTheTruth(problems){
  const wrong=text=>problems.push('presets window chips: '+text);
  for(const entry of CATALOG){
    const preset=PRESETS.find(row=>row.name===entry.builder);
    if(!preset)continue;
    const vals={...presetDefaults(preset),...(entry.start||{})};
    let parts=[];
    try{parts=preset.build(vals)||[];}catch(e){}
    const tags=entry.tags||[];
    const claim=(chip,truth,words)=>{if(tags.includes(chip)!==truth)wrong(`${entry.name} ${tags.includes(chip)?'is':'is not'} marked "${chipLabel(chip)}" but ${words}`);};
    const opens=parts.some(piece=>/^(door|drawer)/i.test(piece.name));
    claim('doors',opens,opens?'it has a door or a drawer':'it has none');
    const tank=parts.some(piece=>piece.gal);
    claim('tanks',tank,tank?'it holds a tank':'it holds none');
    claim('outdoor',entry.group==='outdoors',entry.group==='outdoors'?'it is in Outdoors':'it is not in Outdoors');
    if(parts.length&&parts.length<=PREVIEW_JOINTS_MAX){
      const rating=assessParts(parts,preset).rating;
      const first=!!rating&&/^Beginner:/.test(rating.level);
      claim('beginner',first,`the window rates it "${rating&&rating.level}"`);
    }
  }
  for(const chip of CATALOG_CHIPS)if(!CATALOG.some(entry=>(entry.tags||[]).includes(chip.id)))wrong(`no piece carries "${chip.label}"`);
  // the checks of bare wood outdoors (js/builders-outdoor.js, js/checkui.js) still read the Outdoors row of
  // PRESET_GROUPS (js/presets.js): it must name the same presets as the Outdoors group of the window
  const oldOutdoors=((PRESET_GROUPS.find(group=>group[0]==='Outdoors')||[,[]])[1]).slice().sort().join(', ');
  const newOutdoors=CATALOG.filter(entry=>entry.group==='outdoors').map(entry=>entry.builder).sort().join(', ');
  if(oldOutdoors!==newOutdoors)wrong(`the Outdoors group of the window (${newOutdoors}) and of PRESET_GROUPS (${oldOutdoors}) differ`);
});

/* Search, chips, Esc and the keyboard, through the window itself. */
SELFTESTS.push(function catalogSearchAndKeys(problems){
  const wrong=text=>problems.push('presets window search: '+text);
  const key=(target,name)=>{
    const event=new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true});
    target.dispatchEvent(event);
    return event;
  };
  const type=text=>{const find=$('#presetFind');find.value=text;find.dispatchEvent(new Event('input',{bubbles:true}));};
  const shownIds=()=>[...document.querySelectorAll('#presetTiles .card')].map(card=>card.dataset.entry);
  const keepPicked=catalogState.picked;
  if($('#presetDlg').open)$('#presetDlg').close();
  $('#bPreset').click();                                   // opened the way a person opens it
  try{
    const find=$('#presetFind');
    if(document.activeElement!==find)wrong('the keyboard is not in the search box when the window opens');
    // names, short lines and tags are searched as you type; a name that starts with the words comes first
    type('book');
    if(shownIds()[0]!=='bookshelf')wrong(`"book" should find the Bookshelf first, it found ${shownIds().join(', ')}`);
    type('plank top');
    if(!shownIds().includes('dining-table'))wrong('"plank top" (words of a short line) should find the Dining table');
    type('table');
    if(!shownIds().includes('coffee-table')||shownIds().includes('raised-garden-bed'))wrong(`"table" should find the tables and not the garden bed (its tag "vegetables"): ${shownIds().join(', ')}`);
    type('shelf');
    if(!shownIds().includes('bookshelf'))wrong('"shelf" should find the Bookshelf (inside its name)');
    type('e');                                             // results from every group: no tile text may be cut off
    const cut=[...document.querySelectorAll('#presetTiles .card b,#presetTiles .card small')].filter(line=>line.scrollWidth>line.clientWidth);
    if(cut.length)wrong(`tile text is cut off in search results: ${cut.map(line=>line.textContent).join(', ')}`);
    type('vegetables');
    if(shownIds().join()!=='raised-garden-bed')wrong(`"vegetables" (a tag) should find only the Raised garden bed: ${shownIds().join(', ')}`);
    // plurals and the obvious misspelt plural find the piece; a chip's label is not searched, only what pieces are
    for(const[words,id]of[['bookshelves','bookshelf'],['bookshelfs','bookshelf'],['benches','five-board-bench'],
      ['boxes','storage-box'],['kids','storage-box'],['kid','storage-box'],['tables','coffee-table'],['five-board','five-board-bench']]){
      type(words);
      if(!shownIds().includes(id))wrong(`"${words}" should find ${id}, it found ${shownIds().join(', ')||'nothing'}`);
    }
    type('bookshelves');
    if(shownIds()[0]!=='bookshelf')wrong(`"bookshelves" should find the Bookshelf first, it found ${shownIds().join(', ')}`);
    type('drawer');
    if(shownIds().join()!=='drawer-nightstand')wrong(`"drawer" should find only the piece with drawers, it found ${shownIds().join(', ')}`);
    type('door');
    if(shownIds().includes('drawer-nightstand')||!shownIds().includes('base-cabinet'))wrong(`"door" should find the pieces with doors and not the drawer nightstand: ${shownIds().join(', ')}`);
    type('terrarium');
    if(shownIds().length)wrong(`"terrarium" should find nothing while no piece is made for a terrarium, it found ${shownIds().join(', ')}`);
    type('zzqq');
    if(shownIds().length||!$('#presetTiles .pnone'))wrong('a search that finds nothing should say so and show no tiles');
    if($('#presetGroups .pgrp.on'))wrong('while a search shows, no group should be marked as chosen');
    // Esc clears the search first and leaves the window open; a second Esc is left to close it
    type('bench');
    const first=key(find,'Escape');
    if(!first.defaultPrevented||find.value||catalogState.find||!$('#presetDlg').open)wrong('Esc with a search typed must clear the search and keep the window open');
    const second=key(find,'Escape');
    if(second.defaultPrevented)wrong('Esc with nothing to clear must be left to close the window');
    // Esc in a box of the form leaves the search and the cursor where they are
    type('bench');
    const sizeBox=[...document.querySelectorAll('#presetForm .pform-b [data-k]')].find(box=>!box.closest('[hidden]'));
    if(sizeBox){
      sizeBox.focus();
      const inForm=key(sizeBox,'Escape');
      if(inForm.defaultPrevented||catalogState.find!=='bench'||document.activeElement!==sizeBox)wrong('Esc in a box of the form must not clear the search or move the cursor out of the form');
    }
    key(find,'Escape');
    // chips narrow the tiles shown; Esc takes them off before it closes
    showView('outdoors');
    const chip=$('#presetChips input[data-chip="beginner"]');
    chip.checked=true;chip.dispatchEvent(new Event('change',{bubbles:true}));
    const narrowed=shownIds();
    if(narrowed.includes('shed')||narrowed.includes('bird-feeder')||!narrowed.includes('planter-box'))wrong(`Beginner-friendly in Outdoors should leave the planter and the garden bed: ${narrowed.join(', ')}`);
    // the count on the left is the count of tiles its row shows, chips included
    const outdoorsCount=+$('#presetGroups .pgrp[data-view="outdoors"] small').textContent;
    if(outdoorsCount!==narrowed.length)wrong(`with Beginner-friendly on, Outdoors says ${outdoorsCount} on the left and shows ${narrowed.length} tiles`);
    // every chip on: nothing matches, the words speak of the filters only (nothing is typed), and the heading,
    // with every chip named in it, wraps instead of being cut off
    document.querySelectorAll('#presetChips input').forEach(box=>{box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));});
    const none=$('#presetTiles .pnone');
    if(!none||/search/i.test(none.textContent)||!/Clear the filters/.test(none.textContent))wrong(`with only filters on, the window should offer to clear the filters, not a search: "${none&&none.textContent}"`);
    const heading=$('#presetTiles .pcat-head b');
    if(heading&&heading.scrollWidth>heading.clientWidth+1)wrong('the heading over the tiles is cut off with every chip on');
    if(!key(find,'Escape').defaultPrevented||catalogState.chips.size)wrong('Esc must take the chips off before it closes the window');
    // the keyboard alone, from opening to Create: type, Enter chooses the first piece found and goes to its form
    type('wall shelf');
    const enter=key(find,'Enter');
    if(!enter.defaultPrevented||curPreset.name!=='Wall shelf')wrong(`Enter in the search box should choose the Wall shelf, the live pane shows ${curPreset&&curPreset.name}`);
    if(!$('#presetForm').contains(document.activeElement))wrong('after Enter in the search box the keyboard should be in the form');
    if($('#presetDlg').open!==true)wrong('Enter in the search box must not create anything');
    // arrows: Down from the search box enters the tiles on the chosen one; Right moves on and the live pane follows
    showView('storage');
    catalogPick('bookshelf');                              // the first tile of Storage and shelving
    find.focus();
    key(find,'ArrowDown');
    const on=document.activeElement;
    if(!on.classList.contains('card'))wrong('Down in the search box should move to the tiles');
    else{
      const before=curPreset;
      key(on,'ArrowRight');
      if(curPreset===before||!document.activeElement.classList.contains('card'))wrong('Right on a tile should move to the next tile and show it in the live pane');
      key(document.activeElement,'Enter');
      if(!$('#presetForm').contains(document.activeElement))wrong('Enter on a tile should move the keyboard to the form');
    }
    // Down moves one row down to the tile right under, Up one row back, and Up from the top row to the search box
    // (whatever the number of columns at this window size)
    catalogPick('bookshelf');
    const firstCard=$('#presetTiles .card[data-entry="bookshelf"]'),firstBox=firstCard.getBoundingClientRect();
    const under=tileCards().find(card=>{
      const box=card.getBoundingClientRect();
      return Math.abs(box.left-firstBox.left)<2&&box.top>firstBox.top+1;
    });
    firstCard.focus();
    key(firstCard,'ArrowDown');
    const below=document.activeElement;
    if(under&&below!==under)wrong(`Down on the Bookshelf tile should go to ${under.dataset.entry}, right under it; it went to ${below.dataset.entry||below.id||below.tagName}`);
    if(under&&curPreset.name!==PRESETS[+under.dataset.i].name)wrong('Down on a tile should show the tile it moves to in the live pane');
    key(document.activeElement,'ArrowUp');
    if(document.activeElement.dataset.entry!=='bookshelf')wrong(`Up should come back to the Bookshelf tile, it went to ${document.activeElement.dataset.entry||document.activeElement.id}`);
    key(document.activeElement,'ArrowUp');
    if(document.activeElement!==find)wrong('Up on a tile of the top row should go to the search box');
    // a size typed for a piece is kept while moving to another piece and back
    catalogPick('bookshelf',{fresh:true});
    const box=$('#presetForm [data-k="W"]');
    if(box){
      box.value='30';box.dispatchEvent(new Event('change',{bubbles:true}));
      catalogPick('wall-shelf');
      catalogPick('bookshelf');
      if(parseLen($('#presetForm [data-k="W"]').value)!==30)wrong('the width typed for the Bookshelf was not kept after looking at another piece');
      catalogPick('bookshelf',{fresh:true});
      if(parseLen($('#presetForm [data-k="W"]').value)===30)wrong('a fresh Bookshelf should start at its own width');
      // Reset sizes in the live pane puts the piece in the pane back where it starts
      const startWidth=parseLen($('#presetForm [data-k="W"]').value);
      const typeWidth=()=>{const width=$('#presetForm [data-k="W"]');width.value='30';width.dispatchEvent(new Event('change',{bubbles:true}));};
      typeWidth();
      const reset=$('#presetForm [data-reset-sizes]');
      if(!reset)wrong('the live pane has no Reset sizes link');
      else{
        reset.click();
        if(parseLen($('#presetForm [data-k="W"]').value)!==startWidth)wrong('Reset sizes did not put the Bookshelf back to its own width');
        if(document.activeElement!==$('#presetForm [data-reset-sizes]'))wrong('after Reset sizes the keyboard should stay on the link');
      }
      // the main loop of selfTest builds every preset at its defaults, even the one in the pane with sizes typed
      typeWidth();
      const tile=presetTileInWindow(PRESETS.findIndex(preset=>preset.name==='Bookshelf'));
      if(tile)tile.click();
      if(parseLen($('#presetForm [data-k="W"]').value)!==startWidth)wrong('presetTileInWindow on the piece already in the pane kept the width typed for it');
    }else wrong('the Bookshelf form has no Width box');
  }finally{
    catalogState.find='';catalogState.chips.clear();
    if($('#presetDlg').open)$('#presetDlg').close();
    if(keepPicked&&catalogEntry(keepPicked))catalogState.picked=keepPicked;
  }
});

/* Favorites and Recent are kept in this browser under woodshop. keys, survive the window being drawn again, and
   quietly drop a piece that no longer exists. Creating a piece puts it at the top of Recent. */
SELFTESTS.push(function catalogRecentAndFavorites(problems){
  const wrong=text=>problems.push('presets window lists: '+text);
  let keptRecent=null,keptFavorites=null;
  try{keptRecent=localStorage.getItem(CATALOG_RECENT_KEY);keptFavorites=localStorage.getItem(CATALOG_FAVORITES_KEY);}
  catch(e){return;}                                       // no browser storage here: nothing can be kept, nothing to check
  const keepSnap=lastSnap,undo0=undoStack.slice(),redo0=redoStack.slice();
  try{
    catalogStore(CATALOG_FAVORITES_KEY,['workbench','no-such-piece']);
    catalogStore(CATALOG_RECENT_KEY,[]);
    if(catalogStored(CATALOG_FAVORITES_KEY).join()!=='workbench')wrong('a favorite that no longer exists must be dropped quietly');
    if(!$('#presetDlg').open)$('#bPreset').click();
    // the star on a tile
    showView('storage');
    const star=$('#presetTiles .pstar[data-star="bookshelf"]');
    star.click();
    if(!isFavorite('bookshelf'))wrong('the star on the Bookshelf tile did not make it a favorite');
    if(!$('#presetTiles .pstar[data-star="bookshelf"]').classList.contains('on'))wrong('the star of a favorite should show as on');
    showView('favorites');
    const listed=[...document.querySelectorAll('#presetTiles .card')].map(card=>card.dataset.entry);
    if(listed.join()!=='workbench,bookshelf')wrong(`Favorites should list the Workbench and the Bookshelf, it lists ${listed.join(', ')}`);
    const inTabOrder=[...document.querySelectorAll('#presetTiles .pstar')].filter(other=>other.tabIndex>=0).length;
    if(inTabOrder!==1)wrong(`one star (the chosen tile's) should be in the Tab order, ${inTabOrder} are`);
    $('#presetTiles .pstar[data-star="workbench"]').click();
    if(isFavorite('workbench'))wrong('the star of a favorite should take it off again');
    // its tile leaves Favorites; the keyboard goes to the star that took its place, then to the search box
    if(document.activeElement!==$('#presetTiles .pstar[data-star="bookshelf"]'))wrong(`after a tile leaves Favorites the keyboard should be on the next star, it is on ${document.activeElement.id||document.activeElement.className||document.activeElement.tagName}`);
    $('#presetTiles .pstar[data-star="bookshelf"]').click();
    if(document.activeElement!==$('#presetFind'))wrong('after the last favorite is taken off the keyboard should be in the search box');
    // creating a piece from the window puts it in Recent (the gate and the questions answer at once in the check)
    catalogState.rememberInCheck=true;
    $('#presetDlg').close();
    $('#bPreset').click();
    // the browser's "close" of the closing above may arrive only now, with the window open again: it must not
    // make the window forget that it was opened (Create would then not reach Recent)
    $('#presetDlg').dispatchEvent(new Event('close'));
    const tile=presetTileInWindow(PRESETS.findIndex(preset=>preset.name==='Planter box'));
    tile.click();
    $('#bPGo').click();
    if(catalogStored(CATALOG_RECENT_KEY)[0]!=='planter-box')wrong(`Create did not put the Planter box at the top of Recent: ${catalogStored(CATALOG_RECENT_KEY).join(', ')}`);
    // a lost entry in Recent is dropped, and the window then counts only what exists
    catalogStore(CATALOG_RECENT_KEY,['gone-for-good','planter-box']);
    if(!$('#presetDlg').open)$('#bPreset').click();
    const recentRow=$('#presetGroups .pgrp[data-view="recent"] small');
    if(!recentRow||recentRow.textContent!=='1')wrong('Recent should count 1 when one of its two pieces no longer exists');
    if(!/^woodshop\./.test(CATALOG_RECENT_KEY)||!/^woodshop\./.test(CATALOG_FAVORITES_KEY))wrong('the browser storage keys must start with woodshop.');
  }finally{
    catalogState.rememberInCheck=false;
    if($('#presetDlg').open)$('#presetDlg').close();
    try{
      if(keptRecent===null)localStorage.removeItem(CATALOG_RECENT_KEY);else localStorage.setItem(CATALOG_RECENT_KEY,keptRecent);
      if(keptFavorites===null)localStorage.removeItem(CATALOG_FAVORITES_KEY);else localStorage.setItem(CATALOG_FAVORITES_KEY,keptFavorites);
    }catch(e){}
    load(keepSnap,true);undoStack=undo0;redoStack=redo0;
  }
});

/* css/catalog.css styles the presets window and nothing else: every element a rule of it matches is inside the
   window, so a class name it shares with the rest of the program (as .phead once did, the header of the Pieces
   panel) is caught. The heading over the tiles is plain text that lines up with the search box and the tiles. */
SELFTESTS.push(function catalogStylesStayInWindow(problems){
  const wrong=text=>problems.push('presets window styles: '+text);
  const dialog=$('#presetDlg');
  const sheet=[...document.styleSheets].find(row=>/css\/catalog\.css(\?|#|$)/.test(row.href||''));
  if(!sheet)wrong('css/catalog.css is not loaded');
  let rules=null;
  try{rules=sheet&&sheet.cssRules;}catch(e){rules=null;}  // opened from disk, the browser may not let the page read it
  for(const rule of rules||[]){
    if(!rule.selectorText)continue;
    let outside=[];
    try{outside=[...document.querySelectorAll(rule.selectorText)].filter(element=>!dialog.contains(element)&&element!==dialog);}
    catch(e){continue;}                                     // a selector this browser cannot query (a pseudo-class)
    if(outside.length)wrong(`"${rule.selectorText}" also styles ${outside.length} element(s) outside the window, e.g. ${outside[0].className||outside[0].tagName}`);
  }
  const dialogWasOpen=dialog.open;
  if(!dialogWasOpen)$('#bPreset').click();
  try{
    const head=$('#presetTiles .pcat-head'),tiles=$('#presetTiles .tiles'),find=$('#presetFind');
    if(!head||!tiles)return;
    const style=getComputedStyle(head);
    if(style.position==='sticky'||!/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor))wrong('the heading over the tiles is drawn on a band; it should be plain text');
    const left=head.querySelector('b').getBoundingClientRect().left;
    if(Math.abs(left-tiles.getBoundingClientRect().left)>1||Math.abs(left-find.getBoundingClientRect().left)>1)wrong('the heading over the tiles does not line up with the search box and the tiles');
  }finally{
    if(!dialogWasOpen)dialog.close();
  }
});

/* The three panes fit side by side: none overlaps another or the edges of the window, the live pane keeps a width
   at which its form reads well, and each pane scrolls on its own. Measured at the size the page is now, when that
   is at least CATALOG_SMALLEST, the smallest window the presets window is laid out for. */
const LIVE_PANE_MIN=460;   // narrower than this, the labels, boxes and hints of the form start to crowd
const CATALOG_SMALLEST={width:1100,height:700};
SELFTESTS.push(function catalogPanesFit(problems){
  const wrong=text=>problems.push('presets window layout: '+text);
  if(innerWidth<CATALOG_SMALLEST.width||innerHeight<CATALOG_SMALLEST.height)return;
  const dialogWasOpen=$('#presetDlg').open;
  if(!dialogWasOpen)$('#bPreset').click();
  try{
    const dialog=$('#presetDlg').getBoundingClientRect();
    const panes=[['groups','#presetGroups'],['pieces','#presetCards'],['live pane','#presetForm']].map(([name,at])=>[name,$(at),$(at).getBoundingClientRect()]);
    if(dialog.right>innerWidth+1||dialog.bottom>innerHeight+1||dialog.left<-1||dialog.top<-1)wrong('the window does not fit inside the page');
    for(let i=0;i<panes.length;i++){
      const[name,element,rect]=panes[i];
      if(rect.left<dialog.left-1||rect.right>dialog.right+1)wrong(`the ${name} pane is cut off at the side`);
      if(i&&rect.left<panes[i-1][2].right-1)wrong(`the ${name} pane overlaps the one to its left`);
      if(rect.width<40)wrong(`the ${name} pane has no room (${Math.round(rect.width)}px)`);
    }
    const live=panes[2][2];
    if(live.width<LIVE_PANE_MIN)wrong(`the live pane is ${Math.round(live.width)}px wide, it needs ${LIVE_PANE_MIN}`);
    const scrolls=element=>/auto|scroll/.test(getComputedStyle(element).overflowY);
    if(!scrolls($('#presetGroups')))wrong('the list of groups does not scroll on its own');
    if(!scrolls($('#presetTiles')))wrong('the tiles do not scroll on their own');
    if(!scrolls($('#presetForm .pform-b')))wrong('the form does not scroll on its own');
    const buttons=$('#presetDlg .dlg-f').getBoundingClientRect();
    if(buttons.bottom>dialog.bottom+1)wrong('the buttons of the window are cut off at the bottom');
  }finally{
    if(!dialogWasOpen)$('#presetDlg').close();
  }
});
