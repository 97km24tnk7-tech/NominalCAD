/* NominalCAD: the result pages of the phone page (design/specs/13-phone-page.md, Builder 2).

   js/phone.js has moved #cutPage and #instrPage into  #phone .ph-docs  and shows them with setTab, so renderCut
   (js/plans.js) draws them exactly as on the desktop: the same words, the same numbers. This file only LAYS THEM OUT
   for a phone, and never writes a word or a number of its own into a list:
     - every top-level part of a page is tagged with the tab of the Result screen that shows it (PHONE_PARTS), and
       css/phonepages.css shows only the parts of the open tab;
     - every table is drawn as stacked rows: each cell carries its column heading in data-label (PHONE_TABLES says
       which cells make the title line of a row);
     - a drawing that cannot shrink and stay readable (board bars, plywood sheets, shape drawings, the part drawings
       of "Drill your pieces") is put in a box that slides sideways, with one line saying so.
   phone.js calls, each time a tab of the Result screen is shown (after setTab drew it), phoneShoppingShown,
   phoneCutListShown or phoneStepsShown with (sectionId, docsNode); a page drawn again while it shows (a board length
   chosen) is laid out again by one MutationObserver. phoneUnmount calls phonePagesUndo, which takes every mark and
   box away again, so the desktop's pages are as renderCut drew them.
   It also keeps what the phone page remembers on the device: phoneSaveState / phoneLoadState
   (localStorage "woodshop.phone.state", every read and write in try/catch). */
'use strict';

/* ---------- the tables ---------- */

/* Which tab of the Result screen shows each part of a page, by the heading (h2) that starts it. A part is everything
   from its h2 to the next one; the shopping list and the words section carry their h2 inside them.
   A heading missing here is shown under Steps, and the self-check phoneListsMatchTheDesktop fails. */
const PHONE_PARTS={
  'Shopping list':'shop',
  'Hardware':'shop',
  'Cut list':'cut',
  'Shapes to cut':'cut',      // (a section of the pages before the shop packet: kept for pages drawn before it)
  'Cutting diagrams':'cut',
  'Part drawings':'cut',      // the shop packet's drawings, one per part (js/shoppacket.js)
  'Notes for making the parts':'cut',   // (the notes about making the parts: on the Cut list page only, shopNotes)
  'Notes':'steps',
  'Words used in this design':'steps',
  'Views with sizes':'steps',
  'How it goes together':'steps',
  'Tools you need':'steps',
  'Steps':'steps',
  'Which fastener goes where':'steps',
};
/* The top of a page, before its first heading, shows on every tab of that page: the title, the line of facts, and
   the big picture with its facts (wood, finish, weight; on Build instructions also the skill and the working time).
   The title block is drawn for paper only, on the phone as on the desktop (its facts are the title and the line of
   facts). Anything else before the first heading also shows on every tab, and the self-check phonePagePartsArePlaced
   fails until it has a row here. */
const PHONE_PAGE_TOP=[
  {match:'h1,.meta,.titleblock,.lead',part:'top'},
];
/* How each table of the pages is drawn as stacked rows, found by the heading of its first column.
     title  the columns that make the title line of a row, in the order shown (the rest are "Label value" lines)
     half   the columns that share a line, two to a line */
const PHONE_TABLES=[
  {kind:'cut',first:'Label',title:['Label','Qty','Piece'],half:['Cut from','Length','Width','Thick']},
  {kind:'shop',first:'Buy',title:['Qty','Buy'],half:[]},   // (the Total joins the title line: css/phonepages.css)
  {kind:'hw',first:'Item',title:['Item','Quantity'],half:[]},
  {kind:'fasten',first:'Join',title:['Join'],half:['Joints']},
  {kind:'setups',first:'Setting',title:['Setting'],half:['Holes']},
  {kind:'holes',first:'',title:['','Setting'],half:['How many']},
];
/* The drawings that slide sideways, and the width each is drawn at (wide enough to read its words). The board bars
   do not slide: a board is long and thin, so each is drawn to the width of the screen, whole (phoneFitBoards). */
const PHONE_SLIDES=[
  {kind:'sheet',match:'.cut.ply',width:560},
  {kind:'shape',match:'svg.shape-draw',width:0},                // drawn at its own size (its width attribute)
  // (a part drawing is 920 units wide with 14 to 16 unit words: at 800 px they read at 12 to 14 px)
  // (the plain outline of a part, svg.pp, is drawn to fit the screen: it does not slide, js/shoppacket.js)
  {kind:'drawing',match:'.drill-legend,svg.pd:not(.pp)',width:800},
];
/* over every drawing that slides */
const PHONE_SLIDE_LINE='Wider than your screen: slide it sideways.';
/* Sentences of the pages that speak of a mouse, a column or the full program's tab names, and what the phone says
   instead. Only these words of guidance are swapped (phoneSwapWords), never a word or a number of the design; the
   desktop's own are put back by phonePagesUndo. */
const PHONE_WORDS=[
  ['Click a picture to see it large.','Tap a picture to see it large.'],
  ['Click a letter to see the drawing of that piece.','Tap a letter to see the drawing of that piece.'],   // (the cut list's hint, js/shoppacket.js)
  // (the shop packet's words for the desktop's tabs: on the phone those things are under the Shopping and Cut list tabs)
  ['Each part has its own drawing on the Cut list & shopping page under','Each part has its own drawing under the Cut list tab, in'],
  ['are on the Cut list & shopping page, with the tools for making the parts.','are under the Shopping and Cut list tabs, with the tools for making the parts.'],
];
/* What the pages offer that does not fit a phone without being made again for it. Each is left out on the phone and
   one plain line says the full program has it (phoneFullProgramLines); the self-check phoneShowsEverythingTheDesktopShows
   accepts it only while that line shows. The Price book is a wide table of every price in a dialog of its own. */
const PHONE_FULL_PROGRAM_ONLY=[
  {match:'[data-shop] .pbar [data-cmd="priceBook"]',line:'The Price book, with every price the program uses, is in the full program.'},
];
/* the line over the list of steps at the top of the Steps tab (phoneStepList) */
const PHONE_STEP_LIST_TITLE='Jump to a step';
const PHONE_STATE_KEY='woodshop.phone.state';

/* ---------- laying the pages out ---------- */

/* The three functions phone.js calls when a tab of the Result screen is shown. */
function phoneShoppingShown(sectionId,docs){phoneLayOutPages(docs);}
function phoneCutListShown(sectionId,docs){phoneLayOutPages(docs);}
function phoneStepsShown(sectionId,docs){phoneLayOutPages(docs);}

/* Lays out every page inside the shell that has not been laid out since it was drawn; the board bars are fitted
   to the screen each time, as they can only be measured while they show. */
function phoneLayOutPages(docs){
  const holder=docs||(phone.root&&phone.root.querySelector('.ph-docs'));
  if(!holder)return;
  holder.querySelectorAll('.page>.doc').forEach(phoneLayOutDoc);
  phoneFitBoards(holder);
}
function phoneLayOutDoc(doc){
  if(doc.dataset.phLaid)return;
  doc.dataset.phLaid='1';
  phoneSwapWords(doc);
  phoneTagParts(doc);
  doc.querySelectorAll('table.tbl').forEach(phoneStackTable);
  phoneSlideWide(doc);
  phoneStepList(doc);
  phoneFullProgramLines(doc);
  // a price box brings up the phone's number keys with a decimal point
  doc.querySelectorAll('input.price').forEach(box=>box.setAttribute('inputmode','decimal'));
}

/* Each thing of PHONE_FULL_PROGRAM_ONLY is left out (class ph-full-only, css/phonepages.css) and its line put just
   after it. */
function phoneFullProgramLines(doc){
  for(const row of PHONE_FULL_PROGRAM_ONLY){
    for(const node of doc.querySelectorAll(row.match)){
      node.classList.add('ph-full-only');
      const line=document.createElement('p');
      line.className='ph-full-line';
      line.textContent=row.line;
      const after=node.closest('p,div')||node;   // (a button's line goes under its row of buttons)
      after.parentNode.insertBefore(line,after.nextSibling);
    }
  }
}

/* The guidance sentences of PHONE_WORDS, in the hints of a page, in the phone's words. Each text node changed is
   remembered with its desktop words, so phonePagesUndo can put them back. */
const phoneSwapped=[];   // {node, text}
function phoneSwapWords(doc){
  // (and the first line of the steps, which names the desktop's Cut list page: js/shoppacket.js, .shop-first)
  const walker=document.createTreeWalker(doc,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentNode.closest('.hint,.shop-first')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    let text=node.nodeValue;
    for(const[desktop,phoneWords]of PHONE_WORDS)text=text.replace(desktop,phoneWords);
    if(text===node.nodeValue)continue;
    phoneSwapped.push({node,text:node.nodeValue});
    node.nodeValue=text;
  }
}

/* Words of the price tools that name a key or the Price book (which the phone leaves to the full program), and
   what the phone page says instead. They are written while the page is in use (the Paste prices dialog, the line
   after Update prices), so the phone page watches those two places; only on a phone (window.PHONE_PAGE). */
const PHONE_PRICE_WORDS=[
  [' (Ctrl+V).',' (press and hold in the box, then Paste).'],
  ['type hardware prices in the Price book or the shopping list.','type hardware prices in the shopping list.'],
  ['The price index was asked within the last day','The price index was checked within the last day'],
];
function phoneSwapPriceWords(root){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    let text=node.nodeValue;
    for(const[desktop,phoneWords]of PHONE_PRICE_WORDS)text=text.replace(desktop,phoneWords);
    if(text===node.nodeValue)continue;
    phoneSwapped.push({node,text:node.nodeValue});
    node.nodeValue=text;
  }
}
function phoneWatchPriceWords(){
  if(!window.PHONE_PAGE||typeof MutationObserver!=='function')return;
  const places='#pastePricesDlg,.pnotice';
  const swapAll=()=>document.querySelectorAll(places).forEach(phoneSwapPriceWords);
  swapAll();
  new MutationObserver(records=>{
    for(const record of records){
      const at=record.target.nodeType===1?record.target:record.target.parentNode;
      if(at&&at.closest&&at.closest(places)){swapAll();return;}
      for(const added of record.addedNodes)if(added.nodeType===1&&(added.matches(places)||added.querySelector(places))){swapAll();return;}
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',phoneWatchPriceWords);
else setTimeout(phoneWatchPriceWords,0);

/* The board bars, each drawn to the width of the screen (css/phonepages.css): a cut's letter stands over its
   length. A label the desktop drew for its wider bar that has no room here keeps its letter only, and one with no
   room even for that is left blank, as the desktop does for its shortest cuts (the length is on the cut list and
   in the cut's own tip). Measured, so it is done while the Cut list tab shows, and again when the phone is turned. */
function phoneFitBoards(holder){
  for(const bar of holder.querySelectorAll('.page .board')){
    if(!bar.getClientRects().length)continue;   // (not showing: measured when it is)
    const squeezed=[];
    for(const cut of bar.children){
      cut.classList.remove('ph-short','ph-blank');
      const fits=()=>cut.scrollWidth<=cut.clientWidth+1&&cut.scrollHeight<=cut.clientHeight+1;
      if(fits())continue;
      cut.classList.add('ph-short');
      if(!fits()){cut.classList.remove('ph-short');cut.classList.add('ph-blank');}
      squeezed.push(cut);
    }
    phoneBarRest(bar,squeezed);
  }
}
/* What a squeezed cut of a board bar had to leave out (its length, or its letter and length, or "16 1/2" left")
   is written in one line under the bar, in the desktop's own words, so the phone leaves out no number. */
function phoneBarRest(bar,squeezed){
  const old=bar.nextElementSibling;
  if(old&&old.classList.contains('ph-bar-rest'))old.remove();
  const labels=squeezed.filter(cut=>cut.textContent.trim());
  if(!labels.length)return;
  const line=document.createElement('p');
  line.className='ph-bar-rest';
  for(const cut of labels){
    const item=document.createElement('span');
    for(const node of cut.childNodes)item.appendChild(node.cloneNode(true));
    line.appendChild(item);
  }
  bar.parentNode.insertBefore(line,bar.nextSibling);
}
window.addEventListener('resize',()=>{
  if(phone.root&&phone.section==='cut')phoneFitBoards(phone.root.querySelector('.ph-docs'));
});

/* At the top of the Steps tab: one line for each step, its number and its first sentence (the step's own words),
   that jumps to it. On a big design step 1 is several screens down, under the notes, words and views. */
function phoneStepList(doc){
  const steps=[...doc.querySelectorAll(':scope>.step')];
  if(!steps.length)return;
  const rows=steps.map(step=>{
    const number=step.querySelector('.no'),words=step.querySelector('.step-text p');
    const text=words?words.textContent.trim():'',first=(text.match(/^.*?\.(?=\s+[A-Z]|$)/)||[text])[0];   // (no look-behind: older iPhones cannot read it)
    return`<button type="button" class="ph-jump-row" data-ph-jump="${esc(step.dataset.step||'')}"><b>${esc(number?number.textContent.trim():'')}</b><span>${esc(first)}</span></button>`;
  }).join('');
  const list=document.createElement('nav');
  list.className='ph-jump';
  list.dataset.phPart='steps';
  list.setAttribute('aria-label',PHONE_STEP_LIST_TITLE);
  list.innerHTML=`<h2 class="ph-jump-h">${esc(PHONE_STEP_LIST_TITLE)}</h2>${rows}`;
  // under the top of the page (title, facts, the picture with its facts), before Notes
  const children=[...doc.children],first=children.find(child=>!PHONE_PAGE_TOP.some(row=>child.matches(row.match)));
  doc.insertBefore(list,first||null);
}
document.addEventListener('click',event=>{
  const row=event.target.closest&&event.target.closest('.ph-jump-row');
  if(!row||!phone.root||!phone.root.contains(row))return;
  const step=row.closest('.doc').querySelector(`:scope>.step[data-step="${row.dataset.phJump}"]`);
  if(step)step.scrollIntoView({block:'start'});
});

/* "Show me" beside a word of "Words used in this design": the desktop's own showTermPieces (js/glossary.js, whose
   listener runs first) has gone to its 3D view with those pieces drawn blue and the rest see-through; the phone
   then opens its 3D tab to show it. A tap on the picture puts it back to normal, as a click does on the desktop. */
/* (the desktop's listener hides the page it is on, which takes the Steps tab's scroll to its top: the place is read
   before it runs, so the Steps tab opens again at the word that was tapped) */
let phoneShowMeScroll=null;
document.addEventListener('click',event=>{
  const link=event.target.closest&&event.target.closest('[data-show-term]');
  phoneShowMeScroll=link&&phone.root&&phone.root.contains(link)?{key:phoneScrollKey(),top:phone.root.querySelector('.ph-body').scrollTop}:null;
},true);
document.addEventListener('click',event=>{
  const link=event.target.closest&&event.target.closest('[data-show-term]');
  if(!link||!phone.root||!phone.root.contains(link))return;
  if(typeof spotlightIds==='undefined'||!spotlightIds)return;
  const kept=phoneShowMeScroll;
  phoneShowMeScroll=null;
  phoneShowSection('3d');
  if(kept)phone.scrolls[kept.key]=kept.top;
  phoneUprightBack();   // (the desktop placed the camera for its wide window)
});

/* Tags each top-level child of a page with data-ph-part: 'shop' | 'cut' | 'steps' | 'top'. Nothing is left out:
   what comes before the first heading shows on every tab, what follows an unknown heading shows under Steps. */
function phoneTagParts(doc){
  let part='top';
  for(const child of[...doc.children]){
    const top=PHONE_PAGE_TOP.find(row=>child.matches(row.match));
    if(top){child.dataset.phPart=top.part;continue;}
    const heading=phoneHeadingOf(child);
    if(heading!==null)part=PHONE_PARTS[heading]||'steps';
    child.dataset.phPart=part;
  }
}
/* the words of the h2 a child is or starts with, or null */
function phoneHeadingOf(child){
  if(child.tagName==='H2')return child.textContent.trim();
  const first=child.firstElementChild;
  if(first&&first.tagName==='H2'&&(child.matches('[data-shop]')||child.tagName==='SECTION'))return first.textContent.trim();
  return null;
}
/* every h2 of a page, as written (for the self-check that each one has a row in PHONE_PARTS) */
function phonePageHeadings(page){
  const doc=page.querySelector('.doc');
  return doc?[...doc.children].map(phoneHeadingOf).filter(text=>text!==null):[];
}
/* The top-level parts of a page (.doc) that the phone has not placed on purpose: a heading with no row in
   PHONE_PARTS, or something before the first heading that PHONE_PAGE_TOP does not name. Each is described in a few
   words, for the self-check. (The phone still shows them, so nothing is lost meanwhile.) */
function phoneUnplacedParts(doc){
  const unplaced=[];
  let headingSeen=false;
  for(const child of[...doc.children]){
    if(child.matches('.ph-jump,.ph-slide-line,[data-ph-slide]'))continue;   // (the phone's own)
    const heading=phoneHeadingOf(child);
    if(heading!==null){
      headingSeen=true;
      if(!(heading in PHONE_PARTS))unplaced.push(`the heading "${heading}"`);
      continue;
    }
    if(!headingSeen&&!PHONE_PAGE_TOP.some(row=>child.matches(row.match))){
      unplaced.push(`a ${child.tagName.toLowerCase()}${child.className?'.'+String(child.className).trim().split(/\s+/).join('.'):''} before the first heading`);
    }
  }
  return unplaced;
}

/* A table drawn as stacked rows: each cell gets its column heading in data-label, the title cells class ph-t (and
   their place on the line in --ph-order), the cells that share a line class ph-half. Same cells, same text. */
function phoneStackTable(table){
  const headings=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  const layout=PHONE_TABLES.find(row=>row.first===headings[0])||{kind:'plain',title:[headings[0]],half:[]};
  table.dataset.phTable=layout.kind;
  // the headings of the title cells stay, as one small line over the rows ("Label  Qty  Piece"); every other
  // cell carries its own heading
  table.querySelectorAll('thead th').forEach((th,column)=>{
    const at=layout.title.indexOf(headings[column]);
    if(at<0)return;
    th.classList.add('ph-t');
    th.style.setProperty('--ph-order',String(at));
  });
  table.querySelectorAll('tbody tr').forEach(tr=>{
    // a total, a subtotal or a group line (a cell across several columns) is one line: its words, then its number
    if([...tr.children].some(td=>td.colSpan>1)){
      for(const td of tr.children)if(td.colSpan>1)td.classList.add('ph-wide');
      return;
    }
    let column=0;
    for(const td of tr.children){
      const heading=headings[column]||'';
      column+=td.colSpan||1;
      if(heading)td.dataset.label=heading;
      const at=layout.title.indexOf(heading);
      if(at>=0){
        td.classList.add('ph-t');
        if(at===layout.title.length-1)td.classList.add('ph-tl');   // the last of the title line takes the rest of it
        td.style.setProperty('--ph-order',String(at));
      }
      else if(layout.half.includes(heading))td.classList.add('ph-half');
    }
  });
}

/* Puts each wide drawing in a box that slides sideways; consecutive drawings of one kind share a box (the sheets of
   one material slide together), and every box has the line over it. */
function phoneSlideWide(doc){
  for(const slide of PHONE_SLIDES){
    let box=null;
    for(const node of doc.querySelectorAll(slide.match)){
      if(node.closest('[data-ph-slide]'))continue;   // (a drawing inside one already put in a box)
      // the same box as the drawing before, when nothing stands between them
      const joins=box&&slide.kind!=='drawing'&&box.nextElementSibling===node;
      if(!joins){
        box=document.createElement('div');
        box.dataset.phSlide=slide.kind;
        if(node.dataset&&node.dataset.phPart)box.dataset.phPart=node.dataset.phPart;   // (a box at the top of the page belongs to the part of its drawing)
        node.parentNode.insertBefore(box,node);
        const line=document.createElement('p');
        line.className='ph-slide-line';
        line.textContent=PHONE_SLIDE_LINE;
        if(box.dataset.phPart)line.dataset.phPart=box.dataset.phPart;
        box.parentNode.insertBefore(line,box);
      }
      box.appendChild(node);
    }
    for(const box of doc.querySelectorAll(`[data-ph-slide="${slide.kind}"]`)){
      if(slide.width)box.style.setProperty('--ph-slide-width',slide.width+'px');
    }
  }
}

/* Takes every mark and box of this file off the pages (phoneUnmount calls it before the pages go back to the
   desktop), so they are exactly as renderCut drew them. */
function phonePagesUndo(){
  // the desktop's own words, where the phone had swapped them (a page drawn again since has none of these nodes)
  for(const{node,text}of phoneSwapped.splice(0))node.nodeValue=text;
  for(const page of[$('#cutPage'),$('#instrPage')]){
    if(!page)continue;
    page.querySelectorAll('.ph-slide-line,.ph-jump').forEach(node=>node.remove());
    page.querySelectorAll('.ph-short,.ph-blank').forEach(node=>{
      node.classList.remove('ph-short','ph-blank');
      if(!node.classList.length)node.removeAttribute('class');
    });
    page.querySelectorAll('[data-ph-slide]').forEach(box=>{
      while(box.firstChild)box.parentNode.insertBefore(box.firstChild,box);
      box.remove();
    });
    page.querySelectorAll('[data-ph-part]').forEach(node=>{delete node.dataset.phPart;});
    page.querySelectorAll('[data-ph-table]').forEach(node=>{delete node.dataset.phTable;});
    page.querySelectorAll('.ph-bar-rest,.ph-full-line').forEach(node=>node.remove());
    page.querySelectorAll('.ph-full-only').forEach(node=>node.classList.remove('ph-full-only'));
    page.querySelectorAll('td[data-label],td.ph-t,td.ph-half,td.ph-wide,th.ph-t').forEach(td=>{
      delete td.dataset.label;
      td.classList.remove('ph-t','ph-tl','ph-half','ph-wide');
      if(!td.classList.length)td.removeAttribute('class');
      td.style.removeProperty('--ph-order');
      if(!td.getAttribute('style'))td.removeAttribute('style');
    });
    page.querySelectorAll('.doc[data-ph-laid]').forEach(doc=>{delete doc.dataset.phLaid;});
    page.querySelectorAll('input.price[inputmode]').forEach(box=>box.removeAttribute('inputmode'));
  }
}

/* A page drawn again while it is in the shell (renderCut sets its innerHTML: a board length chosen on the cutting
   diagrams commits and draws it again) is laid out again. */
const phonePageWatcher=new MutationObserver(changes=>{
  for(const page of new Set(changes.map(change=>change.target))){
    if(phone.root&&phone.root.contains(page))phoneLayOutPages(page.parentNode);
  }
});
for(const page of[$('#cutPage'),$('#instrPage')])if(page)phonePageWatcher.observe(page,{childList:true});

/* ---------- what the phone page remembers on this device ---------- */

/* the self-checks run the phone page at the desktop: what they do is not "this device's" phone page */
const phoneMemory={rememberInCheck:false};
function phoneSaveState(state){
  if(typeof autoConfirm!=='undefined'&&autoConfirm&&!phoneMemory.rememberInCheck)return;
  if(!state)return;
  const kept={screen:state.screen,section:state.section,entry:state.entry||'',built:state.built||''};
  if(state.typed)kept.typed=state.typed;
  try{localStorage.setItem(PHONE_STATE_KEY,JSON.stringify(kept));}catch(e){}
}
/* the state saved last, or null (nothing saved, storage refused, or something that is not a state) */
function phoneLoadState(){
  let state=null;
  try{state=JSON.parse(localStorage.getItem(PHONE_STATE_KEY)||'null');}catch(e){return null;}
  if(!state||typeof state!=='object'||!['pick','sizes','result'].includes(state.screen))return null;
  return{screen:state.screen,section:typeof state.section==='string'?state.section:'3d',
    entry:typeof state.entry==='string'?state.entry:'',built:typeof state.built==='string'?state.built:'',typed:state.typed&&typeof state.typed==='object'?state.typed:undefined};
}

/* ---------- self-checks (selfTest runs every function in SELFTESTS, at the desktop window) ----------
   Each mounts the shell in the 320 x 568 box of phoneCheckAround (js/phone.js), which in every case unmounts it and
   puts back the design, the undo stacks, the tab, the form, the catalog's memory, the camera and autoConfirm. */

/* the two designs the checks build: a small one and the one with the biggest lists */
const PHONE_CHECK_DESIGNS=['Wall shelf','Shed'];
/* the text of a node as the desktop writes it: the phone's own slide line left out, white space made single */
function phoneTextOf(node){
  const copy=node.cloneNode(true);
  copy.querySelectorAll('.ph-slide-line').forEach(line=>line.remove());
  return copy.textContent.replace(/\s+/g,' ').trim();
}
/* the rows of each list on a page: cut list, shopping, Hardware (table rows), and every step */
function phoneListTexts(page){
  const tableAfter=heading=>{
    const h2=[...page.querySelectorAll('.doc h2')].find(node=>node.textContent.trim()===heading);
    if(!h2)return null;
    const shop=h2.closest('[data-shop]');
    if(shop)return shop.querySelector('table');
    for(let node=h2.nextElementSibling;node&&node.tagName!=='H2';node=node.nextElementSibling){
      if(node.matches('table'))return node;
    }
    return null;
  };
  const rows=table=>table?[...table.querySelectorAll('tbody tr')]:[];
  return{
    cut:rows(tableAfter('Cut list')),
    shop:rows(tableAfter('Shopping list')),
    hardware:rows(tableAfter('Hardware')),
    steps:[...page.querySelectorAll('.step')],
  };
}
/* Builds a design through the phone, as a person would: Pick, its row, Build it. Returns false when it cannot.
   (the shell mounted now: a check that took it down and put it up again has a new one) */
function phoneBuildThrough(builder){
  const root=phone.root,id=phoneEntryOf(builder);
  if(!root)return false;
  phoneShow('pick');
  const row=id&&root.querySelector(`.ph-row[data-entry="${id}"]`);
  if(!row)return false;
  row.click();
  if(phone.screen!=='sizes')return false;
  const sets=S.nextSet||0;
  root.querySelector('.ph-build').click();
  return(S.nextSet||0)===sets+1&&S.parts.length>0&&phone.screen==='result';
}
const phoneShown=node=>node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';

/* 6. At 320 px wide nothing runs off the side but a drawing in its sliding box (which fits and has its line above),
   every screen has its content, every control is 44 px or more, every box typed in has 16 px text. */
SELFTESTS.push(function phoneFitsAt320(problems){
  const seen=new Set();   // a problem is said once, not once per design
  const wrong=text=>{if(!seen.has(text)){seen.add(text);problems.push('phone at 320 px: '+text);}};
  const named=node=>node.tagName.toLowerCase()+(typeof node.className==='string'&&node.className.trim()?'.'+node.className.trim().split(/\s+/).join('.'):'');
  phoneCheckAround(root=>{
    const edge=root.getBoundingClientRect().right+.5;
    const look=where=>{
      for(const node of root.querySelectorAll('*')){
        if(!phoneShown(node))continue;
        const box=node.getBoundingClientRect();
        if(node.matches('[data-ph-slide]')){
          if(box.right>edge)wrong(`${where}: a sliding box is wider than the screen`);
          const scope=node.closest('.step')||node.closest('.doc');
          const lines=[...scope.querySelectorAll('.ph-slide-line')].filter(line=>phoneShown(line)&&(line.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING));
          if(!lines.length)wrong(`${where}: a sliding box has no line saying it slides`);
          continue;
        }
        if(box.right>edge&&!node.closest('[data-ph-slide]'))wrong(`${where}: ${named(node)} runs ${Math.round(box.right-edge)} px off the side`);
        const control=node.matches('button,a[href],select,input:not([type=checkbox]):not([type=radio]),textarea,.fig-head .done input')&&!node.closest('.frow.ph-ck');
        if((control||node.matches('.frow.ph-ck'))&&box.height<43.5)wrong(`${where}: ${named(node)} "${phoneTextOf(node).slice(0,30)}" is ${Math.round(box.height)} px tall`);
        if(node.matches('input:not([type=checkbox]):not([type=radio]),select,textarea')&&parseFloat(getComputedStyle(node).fontSize)<16)wrong(`${where}: ${named(node)} has ${getComputedStyle(node).fontSize} text (an iPhone zooms in)`);
      }
    };
    for(const builder of PHONE_CHECK_DESIGNS){
      phoneShow('pick');
      const listed=new Set([...root.querySelectorAll('.ph-row[data-entry]')].map(row=>row.dataset.entry));
      const missing=catalogEntries().filter(entry=>!listed.has(entry.id));
      if(missing.length)wrong(`Pick does not list ${missing.map(entry=>entry.name).join(', ')}`);
      look('Pick');
      if(!phoneOpenSizes(phoneEntryOf(builder))){wrong(`the ${builder} cannot be opened`);continue;}
      look(`${builder}, Sizes`);
      const length=$('#presetForm input[data-len]');
      if(length){
        length.click();
        look(`${builder}, size pad`);
        phonePadKey('cancel');
      }
      if(!phoneBuildThrough(builder)){wrong(`the ${builder} was not built through Pick, Sizes and Build it`);continue;}
      for(const section of PHONE_SECTIONS){
        phoneShowSection(section.id);
        look(`${builder}, ${section.label}`);
      }
      // each tab has its content
      phoneShowSection('cut');
      const cutShown=[...$('#cutPage').querySelectorAll('table[data-ph-table="cut"] tbody tr')].filter(phoneShown).length;
      if(cutShown!==cutRows().rows.length)wrong(`${builder}: the Cut list tab shows ${cutShown} rows, the cut list has ${cutRows().rows.length}`);
      if(![...$('#cutPage').querySelectorAll('.cut')].some(phoneShown))wrong(`${builder}: the Cut list tab shows no cutting diagram`);
      // every board bar shows whole, inside the screen, and every label in it fits its cut
      for(const bar of $('#cutPage').querySelectorAll('.board')){
        if(!phoneShown(bar))continue;
        if(bar.closest('[data-ph-slide]'))wrong(`${builder}: a board bar slides sideways instead of fitting the screen`);
        for(const cut of bar.children)if(cut.scrollWidth>cut.clientWidth+1)wrong(`${builder}: the label "${cut.textContent}" does not fit its cut on the board bar`);
      }
      // the Steps tab lists every step at its top, and a tap on a line brings that step into sight
      phoneShowSection('steps');
      const jumps=[...$('#instrPage').querySelectorAll('.ph-jump-row')].filter(phoneShown);
      if(jumps.length!==buildPlan().steps.length)wrong(`${builder}: the list at the top of the Steps tab has ${jumps.length} lines, the plan ${buildPlan().steps.length} steps`);
      else{
        const body=root.querySelector('.ph-body'),last=jumps[jumps.length-1];
        last.click();
        const step=$(`#instrPage .doc>.step[data-step="${last.dataset.phJump}"]`);
        const top=step&&step.getBoundingClientRect().top-body.getBoundingClientRect().top;
        if(!step||!(Math.abs(top)<2||body.scrollTop+body.clientHeight>=body.scrollHeight-2))wrong(`${builder}: a tap on the last line of the step list did not bring that step into sight`);
      }
      phoneShowSection('shop');
      if(!phoneShown($('#cutPage [data-shop]')))wrong(`${builder}: the Shopping tab does not show the shopping list`);
      phoneShowSection('steps');
      const stepsShown=[...$('#instrPage').querySelectorAll('.step')].filter(phoneShown).length;
      if(stepsShown!==buildPlan().steps.length)wrong(`${builder}: the Steps tab shows ${stepsShown} steps, the plan has ${buildPlan().steps.length}`);
    }
  });
});

/* 7. The lists on the phone are the desktop's, word for word and number for number, and every row of them shows
   under its tab; no heading of either page is missing from PHONE_PARTS. */
SELFTESTS.push(function phoneListsMatchTheDesktop(problems){
  const wrong=text=>problems.push('phone lists: '+text);
  const unlisted=(where,page)=>{
    const missing=phonePageHeadings(page).filter(heading=>!(heading in PHONE_PARTS));
    if(missing.length)wrong(`${where}: no row in PHONE_PARTS for ${missing.map(text=>`"${text}"`).join(', ')}`);
  };
  const grand=page=>{const cell=page.querySelector('[data-shop] .c-grand');return cell?phoneTextOf(cell):'';};
  phoneCheckAround(root=>{
    for(const builder of PHONE_CHECK_DESIGNS){
      if(!phoneBuildThrough(builder)){wrong(`the ${builder} was not built through the phone`);continue;}
      // the phone: each list read under the tab that shows it, and every row of it showing
      const phoneSide={};
      for(const[section,page,lists]of[['shop','#cutPage',['shop','hardware']],['cut','#cutPage',['cut']],['steps','#instrPage',['steps']]]){
        phoneShowSection(section);
        const found=phoneListTexts($(page));
        for(const list of lists){
          phoneSide[list]=found[list].map(phoneTextOf);
          const hidden=found[list].filter(row=>!phoneShown(row)).length;
          if(hidden)wrong(`${builder}: ${hidden} ${list} rows do not show under the ${section} tab`);
          // the same text is not enough: a phone style could hide a cell of a row, and with it a number. Every cell
          // of a list that holds words or a number must show.
          const hiddenCells=found[list].flatMap(row=>[...row.querySelectorAll(':scope>td')]).filter(td=>td.textContent.trim()&&!phoneShown(td));
          if(hiddenCells.length)wrong(`${builder}: ${hiddenCells.length} cells of the ${list} list are hidden on the phone, the first "${phoneTextOf(hiddenCells[0]).slice(0,40)}" (${hiddenCells[0].dataset.label||'no heading'})`);
        }
        if(section==='shop')phoneSide.total=grand($(page));
      }
      unlisted(builder+', phone',$('#cutPage'));
      unlisted(builder+', phone',$('#instrPage'));
      // the desktop: the same design, its pages drawn where they always are
      const holder=phone.holder;
      phoneUnmount();
      setTab('cut');
      const desk=phoneListTexts($('#cutPage'));
      const deskSide={cut:desk.cut.map(phoneTextOf),shop:desk.shop.map(phoneTextOf),hardware:desk.hardware.map(phoneTextOf),total:grand($('#cutPage'))};
      setTab('instr');
      deskSide.steps=phoneListTexts($('#instrPage')).steps.map(phoneTextOf);
      unlisted(builder+', desktop',$('#cutPage'));
      unlisted(builder+', desktop',$('#instrPage'));
      for(const list of['cut','shop','hardware','steps']){
        if(!deskSide[list].length){wrong(`${builder}: the desktop's ${list} list is empty, so this check proves nothing`);continue;}
        if(phoneSide[list].length!==deskSide[list].length){wrong(`${builder}: the phone shows ${phoneSide[list].length} ${list} rows, the desktop ${deskSide[list].length}`);continue;}
        const at=phoneSide[list].findIndex((text,index)=>text!==deskSide[list][index]);
        if(at>=0)wrong(`${builder}: ${list} row ${at+1} reads "${phoneSide[list][at].slice(0,80)}" on the phone and "${deskSide[list][at].slice(0,80)}" on the desktop`);
      }
      if(!deskSide.total||phoneSide.total!==deskSide.total)wrong(`${builder}: the total is ${phoneSide.total} on the phone and ${deskSide.total} on the desktop`);
      setTab('design');
      phoneMount(holder);
    }
  });
});

/* ---------- nothing on the desktop's pages is missing on the phone ----------
   The owner tried the phone page and found less on it than on the desktop. These two checks hold the phone to the
   desktop: everything a person can read or use on "Cut list & shopping" and "Build instructions" (every text, in
   the order of the page, every picture and every button, link, box and choice) must be readable somewhere under the
   phone's tabs, with nothing hidden by a style rule; and every part of a page must have its place on the phone. */

/* the designs the first check builds: one with drilled parts and words, the one with the biggest lists, one with a
   fish tank; and (the shop packet, spec 14) one with a shaped part, a letter drilled two ways and a mirror pair, and
   one with pull holes */
const PHONE_WHOLE_DESIGNS=['Desk','Shed','Single aquarium stand','Dining chair','Nightstand with drawers'];
/* can a person see this element: it takes room, is not made invisible, and its text is not shrunk to nothing */
function phoneReadable(element,page){
  if(!element||!element.getClientRects().length)return false;
  const style=getComputedStyle(element);
  if(style.visibility==='hidden'||parseFloat(style.fontSize)===0)return false;
  for(let node=element;node&&node!==page;node=node.parentElement)if(getComputedStyle(node).opacity==='0')return false;
  return true;
}
/* Everything a person can read or use on a page, in its order: {key, node, where}. key is "text: ..." for words
   and numbers (with the phone's guidance words for those of PHONE_WORDS), "picture: ..." and "control: ...". */
function phoneReadableItems(page){
  const items=[];
  const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(node.nodeType===Node.TEXT_NODE){
      let text=node.nodeValue.replace(/\s+/g,' ').trim();
      if(!text||!phoneReadable(node.parentElement,page))continue;
      for(const[desktop,phoneWords]of PHONE_WORDS)text=text.replace(desktop,phoneWords);
      items.push({key:'text: '+text,node,element:node.parentElement});
    }else if(node.matches('img,canvas,svg:not(.i)')&&!(node.parentElement&&node.parentElement.closest('svg'))){
      if(phoneReadable(node,page))items.push({key:`picture: ${node.tagName.toLowerCase()} ${node.getAttribute('alt')||node.getAttribute('class')||''}`,node,element:node});
    }else if(node.matches('button,a[href],select,input')){
      const what=node.dataset.cmd||(node.dataset.showTerm!=null?'show me':'')||node.dataset.stock&&'board lengths'||node.getAttribute('class')||'';
      if(phoneReadable(node,page))items.push({key:`control: ${node.tagName.toLowerCase()} ${what}`,node,element:node});
    }
  }
  return items;
}
/* the column headings a phone table shows through its cells (data-label, drawn by css/phonepages.css), each as
   "part | text: heading" */
function phoneShownHeadings(page){
  const shown=new Set();
  for(const cell of page.querySelectorAll('td[data-label]')){
    if(!phoneReadable(cell,page))continue;
    const before=getComputedStyle(cell,'::before');
    if(before.content&&before.content!=='none'&&before.display!=='none')shown.add(phoneSectionOf(cell)+' | text: '+cell.dataset.label);
  }
  return shown;
}
/* the heading of a column whose cells are all empty says nothing: the phone may leave it out */
function phoneEmptyColumn(th){
  const table=th.closest('table'),column=[...th.parentNode.children].indexOf(th);
  return[...table.querySelectorAll('tbody tr')].every(tr=>{
    if([...tr.children].some(td=>td.colSpan>1))return true;
    const cell=tr.children[column];
    return!cell||!cell.textContent.trim();
  });
}
/* Builds a design through the phone, reads what each tab shows, then what the desktop's two pages show for the same
   design, and returns what the desktop has that the phone does not show: ['Cut list & shopping, under "Notes":
   text: ...', ...], in the order of the pages. (Inside phoneCheckAround, the shell mounted.) */
function phoneMissingFromTheDesktop(builder){
  if(!phoneBuildThrough(builder))return[`the ${builder} could not be built through the phone`];
  // the phone: every tab, the node of each thing shown (the cut list page shows under two tabs: counted once)
  const onPhone=new Map(),headings=new Set(),linesShown=new Set();   // (linesShown: the "is in the full program" lines)
  for(const[section,id]of[['shop','#cutPage'],['cut','#cutPage'],['steps','#instrPage']]){
    phoneShowSection(section);
    // (each thing is counted within its part: a length on a board bar is not stood in for by the same length in
    // the cut list)
    for(const item of phoneReadableItems($(id)))if(!onPhone.has(item.node))onPhone.set(item.node,phoneSectionOf(item.element)+' | '+item.key);
    phoneShownHeadings($(id)).forEach(heading=>headings.add(heading));
    for(const line of $(id).querySelectorAll('.ph-full-line'))if(phoneReadable(line,$(id)))linesShown.add(line.textContent);
  }
  const have=new Map();
  for(const key of onPhone.values())have.set(key,(have.get(key)||0)+1);
  // the desktop: the same design, its pages drawn where they always are
  const holder=phone.holder;
  phoneUnmount();
  const need=new Map(),first=new Map();   // key -> how many times one page shows it; key -> where it is first
  try{
    for(const[tabName,id,sheet]of[['cut','#cutPage','Cut list & shopping'],['instr','#instrPage','Build instructions']]){
      setTab(tabName);
      const counts=new Map();
      for(const item of phoneReadableItems($(id))){
        const th=item.element.closest('thead th'),part=phoneSectionOf(item.element);
        if(th&&(headings.has(part+' | '+item.key)||phoneEmptyColumn(th)))continue;
        // left to the full program, and the phone says so in its place
        if(PHONE_FULL_PROGRAM_ONLY.some(row=>item.element.closest(row.match)&&linesShown.has(row.line)))continue;
        const key=part+' | '+item.key;
        counts.set(key,(counts.get(key)||0)+1);
        if(!first.has(key))first.set(key,`${sheet}, under "${part}": ${item.key.slice(0,90)}`);
      }
      for(const[key,count]of counts)need.set(key,Math.max(need.get(key)||0,count));
    }
  }finally{
    setTab('design');
    phoneMount(holder);
  }
  const missing=[];
  for(const[key,count]of need){
    const shown=have.get(key)||0;
    if(shown<count)missing.push(`${first.get(key)}${count>1?` (${shown} of ${count} show)`:''}`);
  }
  return missing;
}
/* the heading of the part of a page an element is in, or "the top" */
function phoneSectionOf(element){
  let child=element;
  while(child&&!(child.parentElement&&child.parentElement.classList.contains('doc')))child=child.parentElement;
  for(let node=child;node;node=node.previousElementSibling){
    const heading=phoneHeadingOf(node);
    if(heading!==null)return heading;
  }
  return'the top';
}

/* 10. Everything the desktop's two pages show for the Desk, the Shed and the Single aquarium stand is readable
   somewhere under the phone's tabs. */
SELFTESTS.push(function phoneShowsEverythingTheDesktopShows(problems){
  phoneCheckAround(()=>{
    for(const builder of PHONE_WHOLE_DESIGNS){
      const missing=phoneMissingFromTheDesktop(builder);
      if(missing.length)problems.push(`phone shows less: ${builder}: ${missing.length} thing${missing.length>1?'s':''} of the desktop's pages ${missing.length>1?'do':'does'} not show on the phone, the first: ${missing[0]}`);
    }
  });
});

/* 11. Every top-level part of the two pages has its place on the phone (PHONE_PAGE_TOP or PHONE_PARTS), and the check
   itself fails on a page that gains a part the phone has not placed. */
SELFTESTS.push(function phonePagePartsArePlaced(problems){
  const wrong=text=>problems.push('phone page parts: '+text);
  phoneCheckAround(()=>{
    for(const builder of PHONE_WHOLE_DESIGNS){
      if(!phoneBuildThrough(builder)){wrong(`the ${builder} was not built through the phone`);continue;}
      for(const[section,id]of[['shop','#cutPage'],['steps','#instrPage']]){
        phoneShowSection(section);
        const doc=$(id+' .doc'),unplaced=phoneUnplacedParts(doc);
        if(unplaced.length)wrong(`${builder}: the phone has no place for ${unplaced.join(', ')}`);
        // the check sees a new part: a copy of the page with one thing before the first heading and one new heading
        const copy=doc.cloneNode(true);
        copy.insertBefore(document.createElement('aside'),copy.querySelector(':scope>h2,:scope>section,:scope>[data-shop]'));
        copy.appendChild(Object.assign(document.createElement('h2'),{textContent:'A part made up by the self-check'}));
        if(phoneUnplacedParts(copy).length!==unplaced.length+2)wrong('a page with a new part before its first heading and a new heading was not caught');
      }
    }
  });
});

/* 8. The page remembers where it was: the Sizes of a design with what was typed, and the Result tab, across a
   reload; with storage refused nothing breaks. */
SELFTESTS.push(function phoneRemembers(problems){
  const wrong=text=>problems.push('phone memory: '+text);
  let kept=null;
  try{kept=localStorage.getItem(PHONE_STATE_KEY);}catch(e){}
  const storage=Object.getOwnPropertyDescriptor(window,'localStorage');
  phoneMemory.rememberInCheck=true;
  try{
    phoneCheckAround(root=>{
      const reload=()=>{
        const holder=phone.holder;
        phoneUnmount();
        catalogState.typed={};catalogState.picked='';   // (a reload forgets what is only in memory)
        const state=phoneLoadState();                   // (read before mounting, as phoneStart does)
        phoneMount(holder);
        phoneApplyState(state);
      };
      if(!phoneOpenSizes('wall-shelf'))return wrong('the Wall shelf cannot be opened');
      const box=$('#presetForm [data-k="L"]');
      box.click();
      ['3','ft','1','1/2','done'].forEach(phonePadKey);
      const typed=box.value;
      phoneSaveSoon(0);
      reload();
      const again=$('#presetForm [data-k="L"]');
      if(phone.screen!=='sizes'||catalogState.picked!=='wall-shelf')wrong(`after a reload the page opened on ${phone.screen} ${catalogState.picked}, not the Wall shelf's sizes`);
      else if(!again||again.value!==typed)wrong(`after a reload the length box reads ${again&&again.value}, not ${typed}`);
      root=phone.root;
      root.querySelector('.ph-build').click();
      phoneShowSection('cut');
      reload();
      if(phone.screen!=='result'||phone.section!=='cut')wrong(`after a reload the page opened on ${phone.screen} / ${phone.section}, not the Cut list tab`);
      // storage that throws: nothing breaks, and the page opens on Pick
      Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('refused');}});
      try{
        phoneSaveState(phoneCurrentState());
        if(phoneLoadState()!==null)wrong('with storage refused a state was still read');
        reload();
        if(phone.screen!=='pick')wrong('with storage refused the page did not open on Pick');
      }catch(e){wrong('with storage refused: '+e.message);}
      finally{if(storage)Object.defineProperty(window,'localStorage',storage);else delete window.localStorage;}
    });
  }finally{
    phoneMemory.rememberInCheck=false;
    try{if(kept===null)localStorage.removeItem(PHONE_STATE_KEY);else localStorage.setItem(PHONE_STATE_KEY,kept);}catch(e){}
  }
});

/* 9. After the phone page is taken down the desktop is as it was: every moved node back in its place, nothing of the
   phone left on the pages, the form typed in again, and Reset sizes and Create in the presets window build. */
SELFTESTS.push(function phoneLeavesTheDesktopAsItWas(problems){
  const wrong=text=>problems.push('phone leaves the desktop: '+text);
  // (#legend: the color key, moved into the View sheet by js/phoneview.js)
  const places=['#presetForm','#presetFoot','#cvWrap','#cutPage','#instrPage','#legend'].map(id=>{
    const node=$(id);
    return{id,node,parent:node&&node.parentNode,next:node&&node.nextSibling};
  });
  phoneCheckAround(root=>{
    if(!phoneBuildThrough('Desk'))return wrong('the Desk was not built through the phone');
    for(const section of PHONE_SECTIONS)phoneShowSection(section.id);
    if(!$('#instrPage').textContent.includes(PHONE_WORDS[0][1]))wrong('the phone did not say "'+PHONE_WORDS[0][1]+'" on the Steps tab, so the words put back are not checked');
    const holder=phone.holder;
    phoneUnmount();
    for(const place of places){
      if(!place.node||place.node.parentNode!==place.parent||place.node.nextSibling!==place.next)wrong(`${place.id} is not back in its place`);
    }
    if(!window.PHONE_PAGE&&document.documentElement.classList.contains('phone-page'))wrong('the page still has the phone-page class');
    const left=[...document.querySelectorAll('[class]')].filter(node=>[...node.classList].some(name=>/^ph-/.test(name)));
    if($('#phone')||left.length)wrong(`phone things are left on the page: ${left.slice(0,3).map(node=>node.className).join(', ')||'#phone'}`);
    if(document.querySelector('.page [data-ph-part],.page [data-ph-slide],.page [data-ph-table],.page [data-ph-laid],.page td[data-label]'))wrong('the pages still carry the phone\'s marks');
    const pageWords=$('#cutPage').textContent+' '+$('#instrPage').textContent;
    // (the start of each phone sentence, up to its first $ or the end)
    const kept=PHONE_WORDS.map(pair=>pair[1].split('$')[0]).filter(words=>pageWords.includes(words));
    if(kept.length)wrong(`the desktop's pages still say the phone's words: "${kept[0]}"`);
    // the presets window: Reset sizes, then Create, builds
    catalogPick('wall-shelf');
    const reset=$('#presetForm [data-reset-sizes]');
    if(!reset)wrong('the presets window has no Reset sizes');
    else{
      reset.click();
      const length=$('#presetForm input[data-len]');
      if(length&&length.readOnly)wrong('a size box of the presets window is still read-only');
      const sets=S.nextSet||0;
      makePreset();
      if((S.nextSet||0)!==sets+1)wrong('Create in the presets window did not build after the phone page was taken down');
    }
    phoneMount(holder);   // (phoneCheckAround takes it down again)
  });
});
