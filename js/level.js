/* NominalCAD: Beginner and Expert.

   Beginner, which is how the program opens the first time, shows the three steps a first project needs:
   Design, Cut list & shopping, Build instructions. The program picks every screw and joint by itself.
   Expert adds the Fasteners tab: a table of every place two pieces meet, where the fastener can be changed
   by hand. Nothing is missing in Beginner: the hardware to buy and "which fastener goes where" are on the
   other pages. The choice is remembered in this browser.

   To put anything else behind Expert later, give its element the attribute data-expert in index.html.
   The style sheet hides it in Beginner; nothing needs to change here. */
'use strict';
const LEVEL_KEY='woodshop.level'; // browser storage: 'beginner' or 'expert'
let level='beginner';
try{if(localStorage.getItem(LEVEL_KEY)==='expert')level='expert';}catch(e){}

/* Switch to 'beginner' or 'expert' and remember it. */
function setLevel(next){
  level=next==='expert'?'expert':'beginner';
  try{localStorage.setItem(LEVEL_KEY,level);}catch(e){}
  applyLevel();
}
/* Make the page match the level: mark the body (the style sheet hides expert-only things in Beginner), light
   the switch, and number the tabs that are showing 1, 2, 3 (and 4). */
function applyLevel(){
  document.body.dataset.level=level;
  for(const hook of ON_LEVEL)hook(level);      // switches that are hidden in Beginner go to their safe position (js/core.js)
  if(window.dressWordSpans)dressWordSpans();   // js/wordlinks.js: a woodworking word is a button in Beginner, plain text in Expert
  document.querySelectorAll('#levelSwitch button').forEach(button=>{
    const on=button.dataset.level===level;
    button.classList.toggle('on',on);
    button.setAttribute('aria-pressed',on);
  });
  let step=0;
  document.querySelectorAll('.tabs .tab').forEach(tabButton=>{
    if(level==='beginner'&&tabButton.hasAttribute('data-expert'))return;
    step++;
    tabButton.querySelector('i').textContent=step;
    tabButton.title=tabButton.title.replace(/^Step \d+/,'Step '+step);
  });
  // the page being looked at has just gone away: go back to the design
  const current=document.querySelector(`.tabs .tab[data-tab="${tab}"]`);
  if(level==='beginner'&&current&&current.hasAttribute('data-expert'))setTab('design');
}
document.querySelectorAll('#levelSwitch button').forEach(button=>button.onclick=()=>{
  if(button.dataset.level===level)return;
  setLevel(button.dataset.level);
  toast(level==='expert'
    ?'Expert: the Fasteners tab is now step 2. Change the screw or joint used anywhere two pieces meet.'
    :'Beginner: three steps. The program picks every screw and joint for you.');
});
applyLevel();

SELFTESTS.push(function beginnerAndExpert(problems){
  const before=level,tabBefore=tab;
  let stored=null;
  try{stored=localStorage.getItem(LEVEL_KEY);}catch(e){}
  const showing=()=>[...document.querySelectorAll('.tabs .tab')].filter(b=>getComputedStyle(b).display!=='none')
    .map(b=>b.querySelector('i').textContent+' '+b.dataset.tab).join(', ');
  setLevel('expert');
  if(showing()!=='1 design, 2 joints, 3 cut, 4 instr')problems.push('level: Expert should show four numbered tabs, shows: '+showing());
  setTab('joints');
  setLevel('beginner');
  if(showing()!=='1 design, 2 cut, 3 instr')problems.push('level: Beginner should show three numbered tabs, shows: '+showing());
  if(tab!=='design')problems.push('level: going to Beginner while on the Fasteners tab should return to Design');
  if(!/^Step 3/.test(document.querySelector('.tabs .tab[data-tab="instr"]').title))problems.push('level: the tip of the last tab should say Step 3 in Beginner');
  // put everything back exactly as it was, including what the browser remembers
  setLevel(before);
  try{if(stored===null)localStorage.removeItem(LEVEL_KEY);else localStorage.setItem(LEVEL_KEY,stored);}catch(e){}
  setTab(tabBefore);
});
