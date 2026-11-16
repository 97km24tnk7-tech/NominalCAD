/* NominalCAD: counting visits to the public site, with GoatCounter (no cookies, no IP address stored).

   What is counted, and only on the public site (https, a host in VISIT_HOSTS, the page not inside another page's
   frame, not the hosted copy, not while it is being pre-rendered, not in an automated browser, not while selfTest()
   or a SELFTESTS check runs, and not when the person turned "Count my visits" off in Help):
     the page view          p "/", t "NominalCAD", the referrer as its origin only, the screen size
     the events of VISIT_EVENTS, each at most once per page load, e=true with a readable title
       (a preset's name is sent only when it is the name of a preset in PRESETS)
   Nothing a person types and nothing about the design is ever sent: no project name, no piece names, no sizes, no
   file names, and not the query or the hash of the address bar. Only fixed words written in this file are sent.

   How: the address of the counter is requested as an image (new Image().src), GoatCounter's documented tracking
   pixel. No script of theirs is loaded. It never throws, never waits, never retries, and when the request fails
   or is blocked nothing on screen changes. The copy on a computer (file://, localhost) counts nothing.

   To count something new: add one row to VISIT_EVENTS and call countVisitEvent('its name') where it happens
   (one line). Everything sent goes through countVisitEvent / the page view of makeVisitCounter, which refuse any
   name that is not in the table. Never send anything a person typed.

   This file loads last (after js/selftest.js), so that it can mark selfTest() and every SELFTESTS check as
   "a self-test is running" while they run. */
'use strict';

/* ---------- where and what ---------- */
const VISIT_HOSTS=['97km24tnk7-tech.github.io'];          // the public site; any other host counts nothing
const VISIT_COUNTER='https://nominalcad.goatcounter.com/count';
const VISIT_PAGE={path:'/',title:'NominalCAD'};           // the page view, always these words
const VISIT_SWITCH_KEY='woodshop.visits';                 // 'off' when the person turned counting off in this browser
/* The events, by the name that is sent, with the title that goes with it. 'preset' is the only one that takes a
   second word, and that word must be the name of a preset in PRESETS: it is sent as "preset: Bookshelf". */
const VISIT_EVENTS={
  'preset':      'Made a preset',
  'cut list':    'Opened the Cut list & shopping tab',
  'instructions':'Opened the Build instructions tab',
  'print':       'Printed',
  'save file':   'Saved a project to a file',
  'check':       'Ran Check my design',
};
/* the document tabs that count when they are opened (setTab in js/app.js) */
const VISIT_TABS={cut:'cut list',instr:'instructions'};
/* The preset names that may be sent: the catalog as the program wrote it, copied once now (this file loads after
   every preset has added itself). A name changed or added in PRESETS later, by code or from the console, is not
   in this list and so is never sent. */
const VISIT_PRESET_NAMES=Object.freeze(PRESETS.map(preset=>preset.name).filter(name=>typeof name==='string'));

/* ---------- is a self-test running? ---------- */
let visitsQuiet=0; // how many self-tests are running right now
function quietWhileRunning(check){
  const wrapped=function(...args){
    visitsQuiet++;
    try{return check.apply(this,args);}
    finally{visitsQuiet--;}
  };
  Object.defineProperty(wrapped,'name',{value:check.name}); // selfTest reports a check by its name
  return wrapped;
}
if(typeof selfTest==='function')window.selfTest=quietWhileRunning(selfTest);
SELFTESTS.forEach((check,i)=>{SELFTESTS[i]=quietWhileRunning(check);});

/* ---------- the switch in Help ---------- */
let visitsOffNow=false; // the switch as it is in this page load, in case the browser refuses to store it
function visitsSwitchOn(){
  if(visitsOffNow)return false;
  try{return localStorage.getItem(VISIT_SWITCH_KEY)!=='off';}catch(e){return true;}
}
function setVisitsSwitch(on){
  visitsOffNow=!on;
  try{
    if(on)localStorage.removeItem(VISIT_SWITCH_KEY);
    else localStorage.setItem(VISIT_SWITCH_KEY,'off');
  }catch(e){}
}

/* ---------- where the page is now ---------- */
/* Everything the decision needs, read in one place. Whatever cannot be read is taken the safe way (framed,
   testing), so a doubt never counts. */
function readVisitPlace(){
  const place={protocol:'',host:'',origin:'',framed:true,prerendering:false,webdriver:false,
    hosted:true,testing:true,referrer:'',screen:null,switchOn:false};
  try{
    place.protocol=location.protocol;
    place.host=location.hostname;
    place.origin=location.origin;
    place.hosted=typeof HOSTED!=='undefined'&&HOSTED===true;
    place.testing=visitsQuiet>0||(typeof autoConfirm!=='undefined'&&autoConfirm===true);
    place.switchOn=visitsSwitchOn();
  }catch(e){}
  try{place.framed=window.top!==window.self;}catch(e){place.framed=true;}
  try{place.prerendering=document.prerendering===true||document.visibilityState==='prerender';}catch(e){}
  try{place.webdriver=navigator.webdriver===true;}catch(e){}
  try{place.referrer=document.referrer||'';}catch(e){}
  try{place.screen={w:screen.width,h:screen.height,scale:window.devicePixelRatio||1};}catch(e){}
  return place;
}
/* the public site, as far as the page itself can tell (what Help says, and whether its switch shows) */
function visitIsPublic(place){
  return place.protocol==='https:'&&VISIT_HOSTS.includes(place.host)&&!place.hosted&&!place.framed;
}
/* why nothing may be sent from this place right now, or '' when it may */
function visitRefusal(place){
  if(!visitIsPublic(place))return'not the public site';
  if(place.prerendering)return'the page is being pre-rendered';
  if(place.webdriver)return'an automated browser';
  if(place.testing)return'a self-test is running';
  if(!place.switchOn)return'Count my visits is off';
  return'';
}

/* ---------- the address that is requested ---------- */
function visitQuery(pairs){
  return pairs.map(([key,value])=>key+'='+encodeURIComponent(value)).join('&');
}
function visitScreen(place){
  const s=place.screen;
  return s&&s.w>0&&s.h>0?`${Math.round(s.w)},${Math.round(s.h)},${Number(s.scale)||1}`:'';
}
/* the referrer as its origin only (https://example.com), and nothing for a page of this same site */
function visitReferrer(place){
  try{
    if(!place.referrer)return'';
    const origin=new URL(place.referrer).origin;
    return origin&&origin!=='null'&&origin!==place.origin?origin:'';
  }catch(e){return'';}
}
function visitCacheBuster(){
  return Math.random().toString(36).slice(2,10);
}
function pageViewAddress(place){
  const pairs=[['p',VISIT_PAGE.path],['t',VISIT_PAGE.title]];
  const referrer=visitReferrer(place),screenSize=visitScreen(place);
  if(referrer)pairs.push(['r',referrer]);
  if(screenSize)pairs.push(['s',screenSize]);
  pairs.push(['rnd',visitCacheBuster()]);
  return VISIT_COUNTER+'?'+visitQuery(pairs);
}
function eventAddress(name,title,place){
  const pairs=[['p',name],['t',title],['e','true']];
  const screenSize=visitScreen(place);
  if(screenSize)pairs.push(['s',screenSize]);
  pairs.push(['rnd',visitCacheBuster()]);
  return VISIT_COUNTER+'?'+visitQuery(pairs);
}
/* The name and title of an event from the fixed table, or null for anything else. 'preset' takes the name of
   a preset of the catalog as it was written (VISIT_PRESET_NAMES); every other event takes nothing more. */
function visitEventWords(kind,presetName){
  if(typeof kind!=='string'||!Object.prototype.hasOwnProperty.call(VISIT_EVENTS,kind))return null;
  if(kind==='preset'){
    if(typeof presetName!=='string'||!VISIT_PRESET_NAMES.includes(presetName))return null;
    return{name:'preset: '+presetName,title:VISIT_EVENTS.preset+': '+presetName};
  }
  if(presetName!==undefined)return null;
  return{name:kind,title:VISIT_EVENTS[kind]};
}

/* ---------- sending ---------- */
/* The one request: an image. No answer is read, nothing waits for it, a failure is not retried. It asks for
   nothing but the counting address, whatever it is handed. */
function requestVisitImage(address){
  try{
    if(typeof address!=='string'||!address.startsWith(VISIT_COUNTER+'?'))return;
    const image=new Image();
    image.referrerPolicy='origin';
    image.src=address;
  }catch(e){}
}
/* A counter: where it reads the place from, how it sends, and what it has sent in this page load. The program
   has one (visitCounter); the self-check makes its own with a pretend place and a recorder. */
function makeVisitCounter(readPlace,send){
  const counter={readPlace,send,sent:new Set()};
  function sendOnce(key,addressFor){
    try{
      if(counter.sent.has(key))return false;
      const place=counter.readPlace();
      if(visitRefusal(place))return false;
      counter.sent.add(key);
      counter.send(addressFor(place));
      return true;
    }catch(e){return false;}
  }
  counter.pageView=()=>sendOnce('page view',place=>pageViewAddress(place));
  counter.event=(kind,presetName)=>{
    const words=visitEventWords(kind,presetName);
    if(!words)return false;
    return sendOnce('event '+words.name,place=>eventAddress(words.name,words.title,place));
  };
  return counter;
}
const visitCounter=makeVisitCounter(readVisitPlace,requestVisitImage);

/* What the rest of the program calls (one line where the thing happens). Returns whether it was sent. */
function countVisitEvent(kind,presetName){
  return visitCounter.event(kind,presetName);
}
function countVisitTab(tabName){
  if(VISIT_TABS[tabName])countVisitEvent(VISIT_TABS[tabName]);
}
/* printing, however it was started (Print in the program, Ctrl+P, the browser's own menu) */
window.addEventListener('beforeprint',()=>countVisitEvent('print'));

/* the page view: now, or once the page is shown if the browser is pre-rendering it */
function countPageView(){
  let prerendering=false;
  try{prerendering=document.prerendering===true;}catch(e){}
  if(prerendering){
    document.addEventListener('prerenderingchange',()=>visitCounter.pageView(),{once:true});
    return;
  }
  visitCounter.pageView();
}

/* ---------- the section in Help ---------- */
/* On the public site the section says what is counted and shows the switch; anywhere else it says that nothing
   is counted here, and the switch is hidden. */
function syncVisitsHelp(place){
  const isPublic=visitIsPublic(place);
  $('#visitsPublic').hidden=!isPublic;
  $('#visitsElsewhere').hidden=isPublic;
  $('#visitsSwitchRow').hidden=!isPublic;
  $('#visitsOn').disabled=!isPublic;
  $('#visitsOn').checked=visitsSwitchOn();
}
$('#visitsOn').onchange=e=>setVisitsSwitch(e.target.checked);

syncVisitsHelp(readVisitPlace());
countPageView();

/* ---------- self-check: what is sent, and that nothing else is ----------
   Nothing is really requested here: each counter below sends to a recorder, and the program's own counter gets
   a recorder too while its hooks are tried. */
SELFTESTS.push(quietWhileRunning(function visitsCountOnlyFixedWords(problems){
  const wrong=text=>problems.push('visits: '+text);
  const publicPlace={protocol:'https:',host:VISIT_HOSTS[0],origin:'https://'+VISIT_HOSTS[0],framed:false,
    prerendering:false,webdriver:false,hosted:false,testing:false,switchOn:true,
    referrer:'https://www.example.com/some/path?who=Secret#Mine',screen:{w:1920,h:1080,scale:1.25}};
  const pretend=changes=>()=>({...publicPlace,...changes});
  const recorder=()=>{const sent=[];return{sent,send:address=>sent.push(address)};};
  const paramsOf=address=>{const url=new URL(address);return{url,params:Object.fromEntries(url.searchParams)};};

  // the page view on the public site: the counter's address, the fixed words, the referrer's origin, the screen
  {
    const rec=recorder(),counter=makeVisitCounter(pretend({}),rec.send);
    counter.pageView();counter.pageView();
    if(rec.sent.length!==1)wrong(`the page view was sent ${rec.sent.length} times in one page load, not once`);
    else{
      const{url,params}=paramsOf(rec.sent[0]);
      if(url.origin+url.pathname!==VISIT_COUNTER)wrong('the page view went to '+url.origin+url.pathname);
      if(url.hash)wrong('the page view address has a hash');
      const keys=Object.keys(params).sort().join(',');
      if(keys!=='p,r,rnd,s,t')wrong('the page view sends '+keys+', not exactly p, t, r, s and rnd');
      if(params.p!=='/'||params.t!=='NominalCAD')wrong(`the page view sends p "${params.p}" and t "${params.t}"`);
      if(params.r!=='https://www.example.com')wrong('the referrer is sent as "'+params.r+'", not its origin only');
      if(params.s!=='1920,1080,1.25')wrong('the screen size is sent as "'+params.s+'"');
      if(/secret|mine|some\/path|who=/i.test(rec.sent[0]))wrong('the page view address carries part of the full referrer: '+rec.sent[0]);
    }
    // a referrer from this same site is not sent at all
    const own=recorder();
    makeVisitCounter(pretend({referrer:publicPlace.origin+'/NominalCAD/?x=1'}),own.send).pageView();
    if(own.sent.length===1&&new URL(own.sent[0]).searchParams.has('r'))wrong('a referrer from the site itself was sent');
  }
  // each event once, however often it happens, with e=true and the fixed words
  {
    const rec=recorder(),counter=makeVisitCounter(pretend({}),rec.send),preset=PRESETS[0].name;
    for(let i=0;i<3;i++){
      for(const kind of Object.keys(VISIT_EVENTS))if(kind!=='preset')counter.event(kind);
      counter.event('preset',preset);
    }
    const names=rec.sent.map(address=>paramsOf(address).params.p);
    const wanted=Object.keys(VISIT_EVENTS).map(kind=>kind==='preset'?'preset: '+preset:kind);
    if(names.slice().sort().join('|')!==wanted.slice().sort().join('|'))wrong('the events sent were '+names.join(', ')+'; wanted each of '+wanted.join(', ')+' once');
    for(const address of rec.sent){
      const{url,params}=paramsOf(address);
      if(url.origin+url.pathname!==VISIT_COUNTER||params.e!=='true'||!params.t||params.p.startsWith('/')||'r'in params)
        wrong('an event address is not right: '+address);
    }
  }
  // made-up names and typed text are refused
  {
    const rec=recorder(),counter=makeVisitCounter(pretend({}),rec.send);
    counter.event('made up');
    counter.event('cut list','My garage plans');
    counter.event('preset','My own thing');
    counter.event('preset',PRESETS[0].name+' for the shop, 36" wide');
    counter.event('preset');
    counter.event('/cut list');
    counter.event('toString');
    if(rec.sent.length)wrong('a made-up name or typed text was sent: '+rec.sent.join(' '));
  }
  // a preset renamed in PRESETS while the program runs, or one added to it, is not sent under its new name
  {
    const rec=recorder(),counter=makeVisitCounter(pretend({}),rec.send);
    const first=PRESETS[0],nameWas=first.name,typed='My garage plans 36 in wide';
    const added={name:'Something typed by the person',desc:'',params:[],build:()=>[]};
    try{
      first.name=typed;
      PRESETS.push(added);
      counter.event('preset',typed);
      counter.event('preset',added.name);
    }finally{
      first.name=nameWas;
      const at=PRESETS.indexOf(added);
      if(at>=0)PRESETS.splice(at,1);
    }
    if(rec.sent.length)wrong('a name put into PRESETS while the program runs was sent: '+rec.sent.join(' '));
    if(!VISIT_PRESET_NAMES.includes(nameWas))wrong('the list of preset names that may be sent does not have "'+nameWas+'"');
  }
  // the sender itself requests nothing but the counting address
  {
    const realImage=window.Image,asked=[];
    window.Image=function(){const stand={};Object.defineProperty(stand,'src',{set:value=>asked.push(value)});return stand;};
    try{
      requestVisitImage('https://example.com/?secret=1');
      requestVisitImage(VISIT_COUNTER+'.example.com/?p=x');
    }finally{window.Image=realImage;}
    if(asked.length)wrong('the sender requested an address that is not the counter: '+asked.join(' '));
    // a browser that refuses the image (blocked, broken) must not stop the program
    window.Image=function(){throw new Error('blocked');};
    try{requestVisitImage(VISIT_COUNTER+'?p=check&e=true');}
    catch(e){wrong('the sender let an error through when the image could not be made: '+e.message);}
    finally{window.Image=realImage;}
  }
  // nothing from anywhere but the public site, with the switch off, or while a self-test runs
  const nowhere={
    'with Count my visits off':{switchOn:false},
    'on localhost':{protocol:'http:',host:'localhost',origin:'http://localhost:8765'},
    'from a file on the computer':{protocol:'file:',host:'',origin:'null'},
    'over plain http':{protocol:'http:'},
    'from another host':{host:'example.github.io'},
    'inside another page\'s frame':{framed:true},
    'in the hosted copy':{hosted:true},
    'while being pre-rendered':{prerendering:true},
    'in an automated browser':{webdriver:true},
    'while a self-test is running':{testing:true},
  };
  for(const[where,changes]of Object.entries(nowhere)){
    const rec=recorder(),counter=makeVisitCounter(pretend(changes),rec.send);
    counter.pageView();
    counter.event('check');
    counter.event('preset',PRESETS[0].name);
    if(rec.sent.length)wrong(`something was sent ${where}`);
  }
  // where this check is running now (a self-test, and not the public site) nothing may be sent
  if(!visitRefusal(readVisitPlace()))wrong('the page says it may count while selfTest() is running');

  // the switch in Help: off is remembered and read, and it is put back as it was
  const switchWas=visitsSwitchOn();
  try{
    setVisitsSwitch(false);
    if(visitsSwitchOn()||readVisitPlace().switchOn)wrong('Count my visits was turned off but still reads as on');
    setVisitsSwitch(true);
    if(!visitsSwitchOn())wrong('Count my visits was turned on but still reads as off');
  }finally{setVisitsSwitch(switchWas);}
  if(visitsSwitchOn()!==switchWas)wrong('Count my visits was not put back as it was');

  // Help: the switch shows on the public site only
  try{
    syncVisitsHelp({...publicPlace});
    if($('#visitsSwitchRow').hidden||$('#visitsPublic').hidden||!$('#visitsElsewhere').hidden)wrong('on the public site Help does not show the switch and what is counted');
    syncVisitsHelp({...publicPlace,protocol:'file:',host:''});
    if(!$('#visitsSwitchRow').hidden||!$('#visitsOn').disabled||$('#visitsElsewhere').hidden)wrong('off the public site Help still shows the switch, or does not say that nothing is counted here');
  }finally{syncVisitsHelp(readVisitPlace());}

  // the hooks of the program reach the program's own counter (a recorder for the length of the check)
  const kept={readPlace:visitCounter.readPlace,send:visitCounter.send,sent:new Set(visitCounter.sent)};
  const tabKept=tab,rec=recorder();
  visitCounter.send=rec.send;               // first the recorder, then the pretend place
  visitCounter.readPlace=pretend({});
  visitCounter.sent.clear();
  try{
    setTab('cut');setTab('instr');setTab('cut');setTab('design');
    window.dispatchEvent(new Event('beforeprint'));
    if(S.parts.length){checkDesign();if($('#checkDlg').open)$('#checkDlg').close();}
    const names=rec.sent.map(address=>paramsOf(address).params.p).sort().join(',');
    const wanted=['cut list','instructions','print'].concat(S.parts.length?['check']:[]).sort().join(',');
    if(names!==wanted)wrong(`opening the tabs, printing and Check my design sent "${names}", not "${wanted}"`);
  }finally{
    visitCounter.readPlace=kept.readPlace;  // first the real place again, then the real sender
    visitCounter.send=kept.send;
    visitCounter.sent.clear();
    kept.sent.forEach(key=>visitCounter.sent.add(key));
    setTab(tabKept);
  }
}));
