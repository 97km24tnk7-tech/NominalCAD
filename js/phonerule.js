/* NominalCAD: which page a device gets, the full program or the phone page (design/specs/13-phone-page.md).

   This file is the FIRST script inside <body>, before any of the program's markup, so it can mark the page
   (html.phone-page) before anything is drawn and a phone never sees the desktop flash. It needs no other file.

   THE RULE. The phone page shows when all three hold:
     - the main pointer is coarse (a finger)          matchMedia('(pointer: coarse)')
     - nothing can hover                              matchMedia('(hover: none)')
     - the short side of the SCREEN is under 600 px   Math.min(screen.width, screen.height) < 600
   That is true on every phone, upright or sideways (their short side is 320 to 480 px), and false on tablets
   (an iPad mini is 744, Android tablets 600 and up), on touch laptops (their pointer is fine) and in a narrow
   desktop window (it is the screen that counts, not the window). No user agent is read: an iPad says "Macintosh".

   A CHOICE WINS OVER THE RULE. The link "Full program" on the phone page and "Phone page" in the full program
   store the choice in this browser (woodshop.phone.page = 'phone' | 'full'), and from then on that device gets
   what was chosen. For trying it out, an address ending in #phone or #full stores that choice, and #auto forgets
   it; the hash is then taken out of the address. A hash is never sent to a server.

   Gives: phoneFacts(), phonePageRule(facts), phoneChoice(), setPhoneChoice(value), phonePageWanted(),
   and window.PHONE_PAGE (true on the phone page). */
'use strict';

const PHONE_CHOICE_KEY='woodshop.phone.page';   // browser storage: 'phone' or 'full', written only when a person taps a link
const PHONE_SHORT_SIDE_MAX=600;                  // a screen whose short side is this or more is a tablet or bigger

/* What the device says about itself. Every field can be handed in by hand to phonePageRule (the self-check does). */
function phoneFacts(){
  const media=query=>{
    try{return!!(window.matchMedia&&window.matchMedia(query).matches);}
    catch(e){return false;}
  };
  const width=(window.screen&&screen.width)||window.innerWidth||0;
  const height=(window.screen&&screen.height)||window.innerHeight||0;
  return{coarse:media('(pointer: coarse)'),noHover:media('(hover: none)'),shortSide:Math.min(width,height)};
}
/* the rule alone: true when these facts are a phone's */
function phonePageRule(facts){
  return!!(facts&&facts.coarse&&facts.noHover&&facts.shortSide>0&&facts.shortSide<PHONE_SHORT_SIDE_MAX);
}
/* the stored choice: 'phone', 'full' or '' (none, or storage refused) */
function phoneChoice(){
  let value='';
  try{value=localStorage.getItem(PHONE_CHOICE_KEY)||'';}catch(e){value='';}
  return value==='phone'||value==='full'?value:'';
}
/* stores a choice ('phone' or 'full'); '' forgets it. A browser that refuses storage just forgets. */
function setPhoneChoice(value){
  try{
    if(value==='phone'||value==='full')localStorage.setItem(PHONE_CHOICE_KEY,value);
    else localStorage.removeItem(PHONE_CHOICE_KEY);
  }catch(e){}
}
/* #phone, #full or #auto at the end of the address: stored (or forgotten), then taken out of the address */
function phoneReadHash(){
  const hash=String(location.hash||'').toLowerCase();
  const asked={'#phone':'phone','#full':'full','#auto':''}[hash];
  if(asked===undefined)return;
  setPhoneChoice(asked);
  try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
}
/* the answer for this device: the choice if one is stored, else the rule */
function phonePageWanted(choice,facts){
  const stored=choice===undefined?phoneChoice():choice;
  if(stored==='phone')return true;
  if(stored==='full')return false;
  return phonePageRule(facts||phoneFacts());
}

phoneReadHash();
window.PHONE_PAGE=phonePageWanted();
// #phone, #full or #auto typed onto the address of the page already open: the browser does not load it again, so
// the page does, with the new choice
window.addEventListener('hashchange',()=>{
  if(!/^#(phone|full|auto)$/i.test(location.hash))return;
  phoneReadHash();
  location.reload();
});
if(window.PHONE_PAGE)document.documentElement.classList.add('phone-page');
