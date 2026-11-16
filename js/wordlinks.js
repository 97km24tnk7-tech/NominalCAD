/* NominalCAD: words you can click.

   On the three document pages (Fasteners, Cut list & shopping, Build instructions) the words in WORD_LINKS
   are highlighted. Clicking one opens a small card beside it:
     - a joint word (wood screws, pocket holes, dowels, brad nails, L-brackets, glue) opens how that joint is
       made, with its drawing (js/jointhelp.js). These are highlighted at both levels.
     - a woodworking word (pilot hole, flush, square, ...) opens its explanation from TERMS (js/glossary.js).
       These are highlighted in Beginner only (js/level.js).

   Nothing in the code that writes the pages has to know about this: whenever a page is rewritten, the words
   in it are found and wrapped (see the observer at the bottom). So text added to the pages later gets its
   highlighted words for free.

   To make another word clickable: add a row to WORD_LINKS. `joint` is a key of JOINT_HELP, `word` is the
   `word` of an entry in TERMS. Rows are tried from the top, and where two could start at the same place the
   earlier row wins, so put the longer phrase first. */
'use strict';

const WORD_LINKS=[
  {re:/\bpocket[- ]hole screws?\b|\bpocket[- ]holes?\b|\bpocket screws?\b/i,joint:'pocket'},
  {re:/\bwood screws?\b/i,joint:'screw'},
  {re:/\bdowels?\b/i,joint:'dowel'},
  {re:/\bbrad nails?\b|\bbrads\b/i,joint:'nail'},
  {re:/\bL-brackets?\b/i,joint:'bracket'},
  {re:/\bwood glue and clamps\b|\bwood glue\b|\bglue only\b/i,joint:'glue'},
  {re:/\bpilot holes?\b/i,word:'Pilot hole'},
  {re:/\bcountersink\b/i,word:'Countersink'},
  {re:/\bflush\b/i,word:'Flush'},
  {re:/\bsquare\b/i,word:'Square'},
  {re:/\bset back\b/i,word:'Set back'},
  {re:/\boverhangs?\b/i,word:'Overhang'},
  {re:/\bclearance\b/i,word:'Clearance'},
  {re:/\bkerf\b/i,word:'Kerf'},
  {re:/\bon center\b/i,word:'On center'},
  {re:/\brip cuts?\b|\bcrosscuts?\b/i,word:'Crosscut and rip cut'},
  {re:/\bclamps?\b|\bclamped\b/i,word:'Clamp'},
  {re:/\bgrit\b/i,word:'Sandpaper grit'},
  {re:/\bracking\b/i,word:'Racking'},
  {re:/\bdrawer slides?\b|\bslides\b/i,word:'Drawer slide'},
  {re:/\bhinges?\b/i,word:'Hinge'},
];
/* text inside these is left alone: controls, headings, the vocabulary's own entries, and words already wrapped */
const WORD_SKIP='button,select,option,input,textarea,a,svg,script,style,h1,h2,h3,h4,th,.term,.terms,.titleblock,.jcard';
/* a woodworking word is highlighted once in each of these, a joint word every time */
const WORD_BLOCK='li,p,td,dd,figcaption,.step';

/* Find and wrap the words in one page. */
function linkWords(page){
  const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
  const textNodes=[];
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(node.nodeValue.trim().length>2&&!node.parentElement.closest(WORD_SKIP))textNodes.push(node);
  }
  const seenInBlock=new Map();              // block element -> Set of words already highlighted in it
  for(const node of textNodes){
    const block=node.parentElement.closest(WORD_BLOCK)||node.parentElement;
    if(!seenInBlock.has(block))seenInBlock.set(block,new Set());
    const seen=seenInBlock.get(block);
    let text=node.nodeValue,rest=node;
    for(let guard=0;guard<40;guard++){
      // the match that starts earliest; of two at the same place, the earlier row
      let best=null;
      WORD_LINKS.forEach((link,index)=>{
        if(link.word&&seen.has(link.word))return;
        const found=link.re.exec(text);
        if(found&&(!best||found.index<best.found.index))best={found,link,index};
      });
      if(!best)break;
      const{found,link,index}=best;
      if(link.word)seen.add(link.word);
      // split the text node around the match and put a clickable span in its place
      const matched=rest.splitText(found.index);
      rest=matched.splitText(found[0].length);
      const span=document.createElement('span');
      span.className='term '+(link.joint?'joint':'word');
      span.dataset.link=index;
      span.setAttribute('role','button');
      span.tabIndex=0;
      span.title=link.joint?'Click to see how this joint is made':'Click for what this means';
      span.textContent=matched.nodeValue;
      matched.replaceWith(span);
      text=rest.nodeValue;
    }
  }
}

/* ---------- the card ---------- */
function openInfoCard(span){
  const link=WORD_LINKS[+span.dataset.link],card=$('#infoCard');
  let title,body;
  if(link.joint){
    title=JOINT_HELP[link.joint].title;
    body=jointCard(link.joint);
  }else{
    const term=TERMS.find(entry=>entry.word===link.word);
    if(!term)return;
    title=term.word;
    body=`<div class="jcard"><p>${esc(term.what)}</p></div>`;
  }
  card.innerHTML=`<div class="ic-h"><b>${esc(title)}</b><button class="ib s" data-info-close title="Close (Esc)" aria-label="Close">${icon('i-x','xs')}</button></div>`+
    `<div class="ic-b">${body}<p class="ic-more"><button class="lnk" data-open-words>All woodworking words</button></p></div>`;
  card.classList.toggle('wide',!!link.joint);
  card.style.display='block';
  // beside the word: below it when there is room, otherwise above; never off the edge of the window
  const at=span.getBoundingClientRect(),width=card.offsetWidth,height=card.offsetHeight,gap=6;
  const left=Math.max(8,Math.min(at.left,innerWidth-width-8));
  const below=at.bottom+gap+height<=innerHeight-8;
  const top=below?at.bottom+gap:Math.max(8,at.top-gap-height);
  card.style.left=left+'px';
  card.style.top=top+'px';
  card.querySelector('[data-info-close]').focus();
  infoCardFor=span;
}
let infoCardFor=null;                        // the word the open card belongs to, for giving the focus back
function closeInfoCard(){
  const card=$('#infoCard');
  if(card.style.display==='none'||!card.style.display)return;
  card.style.display='none';
  if(infoCardFor&&document.contains(infoCardFor))infoCardFor.focus({preventScroll:true});
  infoCardFor=null;
}
/* A woodworking word only answers in Beginner; a joint word always does. */
const termIsLive=span=>span.classList.contains('joint')||level==='beginner';
document.addEventListener('click',event=>{
  if(!event.target.closest)return;
  const span=event.target.closest('.term');
  if(span&&termIsLive(span)){openInfoCard(span);return;}
  if(event.target.closest('[data-info-close],[data-open-words]')||!event.target.closest('#infoCard'))closeInfoCard();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeInfoCard();
  const span=(event.key==='Enter'||event.key===' ')&&event.target.closest&&event.target.closest('.term');
  if(span&&termIsLive(span)){event.preventDefault();openInfoCard(span);}
});
// the card belongs to a place on the page: scrolling the page or changing tabs puts it away
document.addEventListener('scroll',event=>{if(event.target.closest&&!event.target.closest('#infoCard'))closeInfoCard();},true);

/* ---------- keep the pages wrapped ---------- */
/* A page is rewritten by setting its innerHTML, which replaces its children; that is what is watched for.
   The wrapping itself changes things deeper down, which is not watched, so it cannot set itself off. */
const wordWatcher=new MutationObserver(changes=>{
  closeInfoCard();
  for(const page of new Set(changes.map(change=>change.target)))linkWords(page);
});
document.querySelectorAll('.page').forEach(page=>{
  wordWatcher.observe(page,{childList:true});
  linkWords(page);
});

SELFTESTS.push(function clickableWords(problems){
  for(const link of WORD_LINKS){
    if(link.joint&&!JOINT_HELP[link.joint])problems.push(`word links: "${link.joint}" has no card in js/jointhelp.js`);
    if(link.word&&!TERMS.some(term=>term.word===link.word))problems.push(`word links: "${link.word}" is not a word in js/glossary.js`);
  }
  // a made-up page: each joint word becomes clickable, a woodworking word once per paragraph, headings are left alone
  const page=document.createElement('section');
  page.innerHTML='<h2>Pocket holes</h2><p>Drill pilot holes, then more pilot holes. Use 2 × #8 × 1-5/8" wood screws and wood screws.</p>'+
    '<ul><li>3 × 1-1/4" pocket screws (holes in the apron)</li><li>4 × 3/4" brad nails + glue</li><li>dowels</li><li>L-brackets</li><li>Wood glue and clamps</li></ul>';
  linkWords(page);
  const got=[...page.querySelectorAll('.term')].map(span=>span.textContent.toLowerCase()).join('|');
  const want='pilot holes|wood screws|wood screws|pocket screws|brad nails|dowels|l-brackets|wood glue and clamps';
  if(got!==want)problems.push(`word links: expected the words "${want}" to be clickable, got "${got}"`);
  if(page.querySelector('h2 .term'))problems.push('word links: a heading was wrapped');
  // the card opens for a joint word, shows its drawing, and closes again
  document.body.appendChild(page);
  const span=page.querySelector('.term.joint');
  openInfoCard(span);
  const card=$('#infoCard');
  if(card.style.display!=='block'||!card.querySelector('svg.jh')||!card.querySelector('ol li'))problems.push('word links: clicking a joint word did not open a card with its drawing and steps');
  closeInfoCard();
  if(card.style.display!=='none')problems.push('word links: the card did not close');
  page.remove();
});
