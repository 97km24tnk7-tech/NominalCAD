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
  'Shapes to cut':'cut',
  'Cutting diagrams':'cut',
  'Notes':'steps',
  'Words used in this design':'steps',
  'Views with sizes':'steps',
  'How it goes together':'steps',
  'Tools you need':'steps',
  'Steps':'steps',
  'Which fastener goes where':'steps',
};
/* What the top of a page becomes: the line of facts under the title shows on every tab; the title, the title block
   and the big picture do not (the top bar and the 3D tab show them). */
const PHONE_PAGE_TOP=[
  {match:'.meta',part:'top'},
  {match:'h1,.titleblock,.lead',part:'none'},
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
  {kind:'drawing',match:'.drill-legend,svg.pd',width:800},
];
/* over every drawing that slides */
const PHONE_SLIDE_LINE='Wider than your screen: slide it sideways.';
/* Sentences of the pages that speak of a mouse, a column or the full program's tab names, and what the phone says
   instead. Only these words of guidance are swapped (phoneSwapWords), never a word or a number of the design; the
   desktop's own are put back by phonePagesUndo. */
const PHONE_WORDS=[
  ['Click a picture to see it large.','Tap a picture to see it large.'],
  ['The Drill first column says which pieces','The Drill first line of each piece says which pieces'],
  [/Build instructions, step (\d+), has a drawing of each\./,'the Steps tab, step $1, has a drawing of each.'],
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
  // a price box brings up the phone's number keys with a decimal point
  doc.querySelectorAll('input.price').forEach(box=>box.setAttribute('inputmode','decimal'));
}

/* The guidance sentences of PHONE_WORDS, in the hints of a page, in the phone's words. Each text node changed is
   remembered with its desktop words, so phonePagesUndo can put them back. */
const phoneSwapped=[];   // {node, text}
function phoneSwapWords(doc){
  const walker=document.createTreeWalker(doc,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentNode.closest('.hint')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    let text=node.nodeValue;
    for(const[desktop,phoneWords]of PHONE_WORDS)text=text.replace(desktop,phoneWords);
    if(text===node.nodeValue)continue;
    phoneSwapped.push({node,text:node.nodeValue});
    node.nodeValue=text;
  }
}

/* The board bars, each drawn to the width of the screen (css/phonepages.css): a cut's letter stands over its
   length. A label the desktop drew for its wider bar that has no room here keeps its letter only, and one with no
   room even for that is left blank, as the desktop does for its shortest cuts (the length is on the cut list and
   in the cut's own tip). Measured, so it is done while the Cut list tab shows, and again when the phone is turned. */
function phoneFitBoards(holder){
  for(const cut of holder.querySelectorAll('.page .board>div')){
    if(!cut.getClientRects().length)continue;   // (not showing: measured when it is)
    cut.classList.remove('ph-short','ph-blank');
    const fits=()=>cut.scrollWidth<=cut.clientWidth+1&&cut.scrollHeight<=cut.clientHeight+1;
    if(fits())continue;
    cut.classList.add('ph-short');
    if(!fits()){cut.classList.remove('ph-short');cut.classList.add('ph-blank');}
  }
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
  const top=doc.querySelector(':scope>.meta');
  doc.insertBefore(list,top?top.nextSibling:doc.firstChild);
}
document.addEventListener('click',event=>{
  const row=event.target.closest&&event.target.closest('.ph-jump-row');
  if(!row||!phone.root||!phone.root.contains(row))return;
  const step=row.closest('.doc').querySelector(`:scope>.step[data-step="${row.dataset.phJump}"]`);
  if(step)step.scrollIntoView({block:'start'});
});

/* Tags each top-level child of a page with data-ph-part: 'shop' | 'cut' | 'steps' | 'top' | 'none'. */
function phoneTagParts(doc){
  let part='none';
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

/* A table drawn as stacked rows: each cell gets its column heading in data-label, the title cells class ph-t (and
   their place on the line in --ph-order), the cells that share a line class ph-half. Same cells, same text. */
function phoneStackTable(table){
  const headings=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  const layout=PHONE_TABLES.find(row=>row.first===headings[0])||{kind:'plain',title:[headings[0]],half:[]};
  table.dataset.phTable=layout.kind;
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
    page.querySelectorAll('td[data-label],td.ph-t,td.ph-half,td.ph-wide').forEach(td=>{
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
  const places=['#presetForm','#presetFoot','#cvWrap','#cutPage','#instrPage'].map(id=>{
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
