/* NominalCAD: a built-in self-check.
   Open the browser console (F12) and run  selfTest()  after changing the code.
   It builds every preset with its default sizes and checks that nothing overlaps, every piece matches its
   material, the steps mention every piece, and the Joints, Cut list and Build instructions tabs all render.
   It also checks the presets dialog (every tile fits its text, the live picture and the live summary are
   there, Create refuses, asks or builds as the preset rule says, and a number outside its limits is turned
   away), the title block and table headers of the printed pages, the dialog helpers (askConfirm,
   showMessage), Copy design as text and Paste design from text, Print, the roll-up of the floating panels,
   and what the pointer grabs on a selected piece (a stretch handle before a move arrow, the piece at its
   middle). Then it runs every check that lives beside its feature (SELFTESTS, js/core.js). No dialog is shown
   while it runs, nothing is printed and the clipboard is not touched.
   It puts your design back afterwards. Returns {ok, checked, problems, hosted, structural, structuralOk}.

   ok, checked and problems are the checks described above. structural is separate: it is the preset rule
   (README.md, "The preset rule"), checked with js/verify.js. Every preset must pass the structural check with
   no "stop" and no "warn" at its default sizes, and at the smallest and the largest value of every number that
   has limits it must either pass the same way or be refused by its own check(p) with an explanation. structural
   lists every failure as {preset, field, value, level, code, text}:
       field   'default sizes', or the key of the number that was set to its limit (value says which limit)
       level   'stop' or 'warn' (a finding), 'error' (it threw, or refused without saying why and what to
               change), 'unchecked' (too many pieces for the full check)
   structuralOk is true when that list is empty. A preset on the list is fixed or removed; the check is never
   loosened to let it through. Read it with:  selfTest().structural  , or for one preset
   selfTest({only:['Bookshelf']}).structural .
   It runs in both copies of the program: from index.html, and from hosted-preview.html (the hosted copy, see
   js/hosted.js), where it checks that Print explains itself instead of printing and that Download is gone.
   Options: selfTest({only:['Bookshelf']}) to check some presets; selfTest({set:{key:value}}) to change a
   form field (by its data-k) in every preset that has it before building. */
'use strict';

/* Copy design as text and Paste design from text: the design must come back the same through the text, and
   text that is not a design must be turned away with a message. Called with a design on screen. */
function selfTestTransfer(problems){
  const text=designText(),pieces=JSON.stringify(S.parts),name=S.name;
  const wrong=[['','empty'],['2 legs, 1 top','not a project'],['{"parts":[{"mat":"no such wood"}]}','not a project'],
    [text.slice(0,text.length>>1),'cut off']];
  for(const[bad,expected]of wrong){
    const got=readProject(bad).problem;
    if(got!==expected)problems.push(`transfer: text "${bad.slice(0,30)}" should be turned away as "${expected}" but gave "${got}"`);
  }
  // through the Paste dialog itself: first nonsense, then the real text with words around it, as an email might add
  load(JSON.stringify(blank()),true);
  openPasteDesign();
  $('#pasteText').value='this is not a design';
  $('#bPasteGo').click();
  if(!$('#pasteErr').textContent||!$('#pasteDlg').open||S.parts.length)problems.push('transfer: pasting nonsense was not turned away with a message');
  $('#pasteText').value='My design:\n\n'+text+'\n\nSent from my phone';
  $('#bPasteGo').click();
  if($('#pasteDlg').open){problems.push('transfer: pasting a design left the dialog open: '+$('#pasteErr').textContent);$('#pasteDlg').close();}
  if(S.name!==name||JSON.stringify(S.parts)!==pieces)problems.push('transfer: the design did not come back the same after Copy design as text and Paste design from text');
  if($('#toast'))$('#toast').classList.remove('on'); // the "Opened ..." message belongs to the check, not to the person
}

/* Print: the print window on the computer; in the hosted copy a notice instead, because printing does nothing there.
   Also checks that the controls marked data-hosted are shown in the right copy only. */
function selfTestPrint(problems){
  const realPrint=window.print;
  let printed=0;
  window.print=()=>{printed++;};
  try{printPage();}finally{window.print=realPrint;}
  const notices=autoMessages.splice(0);
  if(HOSTED){
    if(printed)problems.push('hosted: Print called window.print(), which does nothing in the hosted copy');
    if(notices.length!==1)problems.push('hosted: Print did not explain that printing needs the copy on the computer');
  }else{
    if(printed!==1)problems.push('print: Print did not open the print window');
    notices.forEach(m=>problems.push('print: unexpected message: '+m.slice(0,160)));
  }
  document.querySelectorAll('[data-hosted]').forEach(el=>{
    const belongs=(el.dataset.hosted==='only')===HOSTED;
    if(el.hidden===belongs)problems.push(`hosted: "${el.textContent.trim().slice(0,40)}" is ${belongs?'hidden':'shown'} in the ${HOSTED?'hosted':'computer'} copy`);
  });
}

/* The floating panels: the dash in a panel's title bar must roll the panel up to its title bar, and down again.
   Called with a design on screen (Properties only shows while a piece is selected). */
function selfTestPanels(problems){
  const PANELS_KEY='woodshop.panels';                   // where layout.js remembers the panels in this browser
  const stateKept=JSON.stringify(panelState),selKept=sel;
  let storedKept=null;try{storedKept=localStorage.getItem(PANELS_KEY);}catch(e){}
  panelState={};                                        // both panels switched on, where they start
  sel=new Set(S.parts.slice(0,1).map(p=>p.id));
  syncPanels();
  for(const k of PANELS){
    const body=$(`#${k} .fb`),dash=$(`#${k} [data-min]`);
    if(!body.offsetHeight){problems.push(`panels: the "${k}" panel shows nothing under its title bar`);continue;}
    dash.click();
    if(body.offsetHeight)problems.push(`panels: the dash did not roll up the "${k}" panel`);
    dash.click();
    if(!body.offsetHeight)problems.push(`panels: the dash did not roll the "${k}" panel back down`);
  }
  // put back how the person left the panels, on screen and in the browser's storage
  panelState=JSON.parse(stateKept);sel=selKept;
  try{
    if(storedKept===null)localStorage.removeItem(PANELS_KEY);else localStorage.setItem(PANELS_KEY,storedKept);
  }catch(e){}
  syncPanels();
}

/* Grabbing things on a selected piece with the mouse. A blue stretch handle must win over the move arrow that
   reaches past it, and pressing the middle of the piece must drag the piece, not one of the arrows. */
function selfTestGrab(problems){
  load(JSON.stringify(blank()),true);
  // a short board beside a long one: the view fits both, so the arrows on the short board reach past its ends
  const ids=addParts([mk('Short board','2x4',[24,1.5,3.5],[0,0,0]),mk('Long board','2x4',[120,1.5,3.5],[0,0,30])]);
  setTool('select');
  sel=new Set([ids[0]]);
  renderAll();fit('fit');
  buildHandles();buildGizmo();              // sized for the fitted view
  const frame=cv.getBoundingClientRect();
  if(!frame.width)return;                   // the 3D view is not on screen, so there is nothing to press
  /* presses and releases the left button on a point of the scene; returns what the press grabbed */
  const press=point=>{
    scene.updateMatrixWorld(true);          // normally the next drawn frame does this; the check does not wait for one
    const v=point.clone().project(camera);
    const where={clientX:frame.left+(v.x+1)/2*frame.width,clientY:frame.top+(1-v.y)/2*frame.height,button:0,pointerId:1,bubbles:true};
    cv.dispatchEvent(new PointerEvent('pointerdown',where));
    const grabbed=drag?drag.mode:'nothing';
    cv.dispatchEvent(new PointerEvent('pointerup',where));
    return grabbed;
  };
  const handle=handleGroup.children.find(h=>h.userData.side===1);
  if(!handle){problems.push('grab: a selected board shows no stretch handles');return;}
  const onHandle=press(handle.position);
  if(onHandle!=='resize')problems.push(`grab: pressing the stretch handle on the end of a board grabbed "${onHandle}", not the handle`);
  const b=box(byId(ids[0]));
  const onMiddle=press(new THREE.Vector3((b.lo[0]+b.hi[0])/2,b.hi[1],(b.lo[2]+b.hi[2])/2));
  if(onMiddle!=='move')problems.push(`grab: pressing the middle of a selected board grabbed "${onMiddle}", not the board`);
}

/* The preset rule: see the notes at the top of this file. Nothing here touches the page or the design on screen. */
function selfTestStructure(opt){
  const failures=[];
  const run=(preset,field,value,vals)=>{
    const fail=(level,code,text)=>failures.push({preset:preset.name,field,value,level,code,text});
    let check;
    try{check=checkPreset(preset,vals);}
    catch(e){fail('error','threw',e.message);return;}
    if(check.refused){
      // turning the numbers away is a fine answer at a limit, as long as it says why and what to change
      const first=check.stops[0];
      if(field==='default sizes')fail('stop','refused','It refuses its own default sizes: '+first.text);
      else if(check.stops.some(f=>f.code==='input'&&!(f.text&&f.fix)))fail('error','no-explanation','Its check(p) refused without both a text and a fix.');
      return;
    }
    if(!check.parts.length){fail('error','nothing-built','It built no pieces and its check(p) did not say why.');return;}
    check.problems.forEach(f=>fail(f.level,f.code,f.text));
    if(check.skipped)fail('unchecked','too-big',check.skipped);
  };
  for(const preset of PRESETS){
    if(opt.only&&!opt.only.includes(preset.name))continue;
    const defaults=presetDefaults(preset);
    for(const[key,value]of Object.entries(opt.set||{}))if(key in defaults)defaults[key]=value;
    run(preset,'default sizes','',defaults);
    for(const q of preset.params){
      if(!q.k||q.opts||q.check)continue;
      for(const limit of[q.min,q.max])if(limit!==undefined)run(preset,q.k,limit,{...defaults,[q.k]:limit});
    }
    // a preset may name other choices that must pass the same way (variants:[{roof:'lean'}]): each is tried
    // with the default sizes and at every limit. Unlike the defaults, a variant may be refused by check(p).
    for(const variant of preset.variants||[]){
      const base={...defaults,...variant},label=' with '+Object.entries(variant).map(([key,value])=>key+' = '+value).join(', ');
      run(preset,'the defaults'+label,'',base);
      for(const q of preset.params){
        if(!q.k||q.opts||q.check)continue;
        for(const limit of[q.min,q.max])if(limit!==undefined)run(preset,q.k+label,limit,{...base,[q.k]:limit});
      }
    }
  }
  return failures;
}

/* The structural check itself, tried on small designs that are known to be bad or known to be fine. Each one is a
   way the check was once fooled (it passed something that falls down, or flagged something sound), so each must
   keep giving this answer. A case is { name, parts(), options, must, clean, notes }:
       must    findings that have to be there, as 'level:code' ('stop:span'); list one twice if it must be found twice
       clean   true: there must be no problem at all
       notes   note codes that have to be there
   To add a case, add a row. Nothing here touches the page or the design on screen. */
/* Two 2x4 rafters 8 ft apart at the feet, standing on two plates that lie on the floor and meeting at a ridge
   board, at `pitch` inches of rise per foot; with or without a tie across the two plates. */
function rafterPairCase(pitch,tied){
  const deg=Math.round(Math.atan(pitch/12)*18000/Math.PI)/100,ang=deg*Math.PI/180;
  const slope={deg,cos:Math.cos(ang),sin:Math.sin(ang)},tan=Math.tan(ang),plumb=3.5/slope.cos,ridgeTop=(48-.75-1.5)*tan+plumb;
  const parts=[mk('Plate','2x4',[24,1.5,3.5],[0,0,0]),mk('Plate','2x4',[24,1.5,3.5],[0,0,92.5]),
    mk('Ridge board','2x6',[24,5.5,1.5],[0,1.5+ridgeTop-5.5,47.25]),
    shedSlopePiece(slope,'Rafter','2x4',10,1.5,3.5,-6,47.25,z=>1.5+(z-1.5)*tan+plumb,1,false),
    shedSlopePiece(slope,'Rafter','2x4',10,1.5,3.5,48.75,102,z=>1.5+(96-1.5-z)*tan+plumb,-1,false)];
  if(tied)parts.push(mk('Rafter tie','2x4',[1.5,3.5,91],[8.5,1.5,2.5]));
  return parts;
}
/* A plywood cabinet with one drawer box in it. The drawer touches nothing: it is `sideGap` away from each
   cabinet side, the room side-mount slides need (1/2"). */
function drawerCase(sideGap){
  const left=.75+sideGap,width=18.5-2*sideGap;
  return[mk('Side','ply34',[.75,20,16],[0,0,0]),mk('Side','ply34',[.75,20,16],[19.25,0,0]),mk('Bottom','ply34',[18.5,.75,16],[.75,3,0]),
    mk('Top','ply34',[20,.75,16],[0,20,0]),mk('Back panel','ply14',[20,17,.25],[0,3,-.25]),
    mk('Drawer side','ply12',[.5,5,14],[left,10,1.5]),mk('Drawer side','ply12',[.5,5,14],[left+width-.5,10,1.5]),
    mk('Drawer box front','ply12',[width,5,.5],[left,10,15.5]),mk('Drawer box back','ply12',[width,5,.5],[left,10,1]),
    mk('Drawer bottom','ply14',[width,.25,15],[left,9.75,1])];
}
/* A 1x4 lying flat on two posts 8 ft apart; with a 4x4 beam 1/2" under it that hangs from it on hardware, or without. */
function hangingRailCase(withBeam){
  const parts=[mk('Post','4x4',[3.5,36,3.5],[0,0,0]),mk('Post','4x4',[3.5,36,3.5],[92.5,0,0]),mk('Rail','1x4',[96,.75,3.5],[0,36,0])];
  if(withBeam)parts.push(mk('Hanging beam','4x4',[60,3.5,3.5],[18,32,0]));
  return parts;
}
/* A preset with some of its pieces taken away, the way somebody deletes them on the Design tab: the pieces of
   the preset `name` built with the form values `vals` over its defaults, without every piece called one of
   `without` (or, with `only` = 1, without the first one of each of those names). Returns {parts, options}:
   what verifyDesign is handed, with everything the preset declares for the check. */
function presetCase(name,vals,without,only){
  const preset=PRESETS.find(p=>p.name===name),values={...presetDefaults(preset),...vals};
  const gone=new Set();
  const parts=preset.build(values).filter(piece=>{
    if(!without.includes(piece.name)||(only&&gone.has(piece.name)))return true;
    gone.add(piece.name);
    return false;
  });
  return{parts,options:{...presetOptions(preset,values),namedJoints:preset.joints||[]}};
}
/* a row of VERIFY_CASES made from presetCase */
const presetRow=(label,must,name,vals,without,only)=>({name:label,must,
  parts:()=>presetCase(name,vals,without,only).parts,options:()=>presetCase(name,vals,without,only).options});
const VERIFY_CASES=[
  {name:'a board lying on the floor',clean:true,
    parts:()=>[mk('Board','1x6',[40,.75,5.5],[0,0,0])]},
  {name:'a shelf nailed to nothing but the 1/4" back',must:['stop:unsupported'],
    parts:()=>[mk('Side','ply34',[.75,36,10],[0,0,0]),mk('Side','ply34',[.75,36,10],[30.75,0,0]),mk('Back','ply14',[31.5,36,.25],[0,0,-.25]),
      mk('Top','ply34',[31.5,.75,10],[0,36,0]),mk('Shelf','ply34',[28,.75,10],[1.75,18,0])]},
  {name:'a shelf drawn 1/8" into its sides (a housing joint)',clean:true,notes:['overlap'],options:{uses:{Shelf:'general'}},
    parts:()=>[mk('Side','ply34',[.75,36,10],[0,0,0]),mk('Side','ply34',[.75,36,10],[30.75,0,0]),mk('Back','ply14',[31.5,36,.25],[0,0,-.25]),
      mk('Shelf','ply34',[30.25,.75,10],[.625,18,0])]},
  {name:'a 6 ft frame standing on two 2x4 ends',must:['stop:top-heavy'],
    parts:()=>[mk('Post','2x4',[1.5,72,3.5],[0,0,0]),mk('Post','2x4',[1.5,72,3.5],[40,0,0]),mk('Top rail','2x4',[41.5,1.5,3.5],[0,72,0])]},
  {name:'a 12 ft 1x4 lying flat between two posts, carrying nothing',must:['stop:span'],options:{wallFixed:true},
    parts:()=>[mk('Post','4x4',[3.5,30,3.5],[0,0,0]),mk('Post','4x4',[3.5,30,3.5],[140.5,0,0]),mk('Rail','1x4',[144,.75,3.5],[0,30,0])]},
  {name:'a bare arm screwed to a post at one end',must:['warn:cantilever'],
    parts:()=>[mk('Base','ply34',[48,.75,48],[0,0,0]),mk('Post','4x4',[3.5,40,3.5],[22,.75,22]),mk('Arm','2x4',[20,3.5,1.5],[25.5,30,23])]},
  {name:'the same arm with a shelf on it',must:['stop:cantilever'],
    parts:()=>[mk('Base','ply34',[48,.75,48],[0,0,0]),mk('Post','4x4',[3.5,40,3.5],[22,.75,22]),mk('Arm','2x4',[20,3.5,1.5],[25.5,30,23]),
      mk('Shelf','ply34',[20,.75,8],[25.5,33.5,20])]},
  {name:'a 29 gallon tank on a shelf held by the screws through its sides',must:['stop:tank-on-screws'],options:{wallFixed:true},
    parts:()=>[mk('Side','ply34',[.75,36,30],[0,0,0]),mk('Side','ply34',[.75,36,30],[13.25,0,0]),mk('Shelf','ply34',[12.5,.75,30],[.75,20,0]),
      Object.assign(mk('Tank','tank',[12.5,18,30],[.75,20.75,0]),{gal:29})]},
  {name:'the same tank shelf sitting on cleats',clean:true,options:{wallFixed:true},
    parts:()=>[mk('Side','ply34',[.75,36,30],[0,0,0]),mk('Side','ply34',[.75,36,30],[13.25,0,0]),mk('Shelf','ply34',[12.5,.75,30],[.75,20,0]),
      Object.assign(mk('Tank','tank',[12.5,18,30],[.75,20.75,0]),{gal:29}),mk('Cleat','1x2',[.75,1.5,30],[.75,18.5,0]),mk('Cleat','1x2',[.75,1.5,30],[12.5,18.5,0])]},
  {name:'a book shelf screwed to the wall by its back edge',must:['stop:cantilever'],options:{wall:['Shelf'],uses:{Shelf:'books'}},
    parts:()=>[mk('Shelf','1x10',[36,.75,9.25],[0,48,0])]},
  {name:'a book shelf on a wall cleat with no brackets',must:['stop:cantilever'],options:{wall:['Wall cleat'],uses:{Shelf:'books'}},
    parts:()=>[mk('Wall cleat','1x4',[36,3.5,.75],[0,44.5,0]),mk('Shelf','1x10',[36,.75,9.25],[0,48,0])]},
  {name:'a book shelf on a wall cleat and two brackets',clean:true,options:{wall:['Wall cleat'],uses:{Shelf:'books'}},
    parts:()=>[mk('Wall cleat','1x4',[36,3.5,.75],[0,44.5,0]),mk('Shelf','1x10',[36,.75,9.25],[0,48,0]),
      mk('Bracket','1x8',[.75,7.25,8.5],[2,40.75,.75]),mk('Bracket','1x8',[.75,7.25,8.5],[33.25,40.75,.75])]},
  {name:'a 4 ft wide 1/2" plywood top on one beam down its middle',must:['stop:overhang'],options:{uses:{Top:'tableTop'},wallFixed:true},
    parts:()=>[mk('Leg','4x4',[3.5,30,3.5],[0,0,22.25]),mk('Leg','4x4',[3.5,30,3.5],[56.5,0,22.25]),mk('Beam','2x6',[60,5.5,1.5],[0,30,23.25]),
      mk('Top','ply12',[60,.5,48],[0,35.5,0])]},
  {name:'a 1/4" plywood top on four corner legs with no aprons',must:['stop:span'],options:{wallFixed:true},
    parts:()=>[[0,0],[56.5,0],[0,26.5],[56.5,26.5]].map(([x,z])=>mk('Leg','4x4',[3.5,29,3.5],[x,0,z])).concat([mk('Top','ply14',[60,.25,30],[0,29,0])])},
  {name:'a 1/4" plywood floor on joists 2 ft apart that run its length',must:['stop:span'],
    parts:()=>[0,24,44.5].map(z=>mk('Joist','2x4',[96,3.5,1.5],[0,0,z])).concat([mk('Floor deck','ply14',[96,.25,46],[0,3.5,0])])},
  {name:'a 5 ft bench whose seat reaches 4" past its legs',clean:true,options:{uses:{Seat:'seat'}},
    parts:()=>[mk('Leg','1x10',[.75,17,9.25],[4,0,0]),mk('Leg','1x10',[.75,17,9.25],[55.25,0,0]),mk('Seat','2x10',[60,1.5,9.25],[0,17,0]),
      mk('Apron','2x4',[50.5,3.5,1.5],[4.75,13.5,4])]},
  {name:'a bench whose seat reaches 12" past its legs',must:['stop:tips-under-load'],options:{uses:{Seat:'seat'}},
    parts:()=>[mk('Leg','2x12',[1.5,16.5,11.25],[12,0,0]),mk('Leg','2x12',[1.5,16.5,11.25],[34.5,0,0]),mk('Seat','2x12',[48,1.5,11.25],[0,16.5,0]),
      mk('Stretcher','2x4',[21,3.5,1.5],[13.5,8,5])]},
  {name:'a 2x4 "Door header" lying flat over an 8 ft opening',must:['warn:span'],options:{wallFixed:true},
    parts:()=>[mk('Stud','2x4',[1.5,80,3.5],[0,0,0]),mk('Stud','2x4',[1.5,80,3.5],[97.5,0,0]),mk('Door header','2x4',[99,1.5,3.5],[0,80,0]),
      mk('Roof deck','ply12',[99,.5,3.5],[0,81.5,0])]},
  {name:'a shelf between two splayed legs',must:['warn:span'],
    parts:()=>[Object.assign(mk('Leg','2x4',[1.5,36,3.5],[0,-.07,0]),{rot:{k:2,deg:8}}),Object.assign(mk('Leg','2x4',[1.5,36,3.5],[40,-.07,0]),{rot:{k:2,deg:-8}}),
      mk('Shelf','1x4',[38.5,.75,3.5],[1.5,18,0])]},
  {name:'a brace that misses its posts by 1"',must:['stop:floating'],
    parts:()=>[mk('Post','2x4',[1.5,48,3.5],[0,0,0]),mk('Post','2x4',[1.5,48,3.5],[30,0,0]),mk('Rail','2x4',[31.5,1.5,3.5],[0,48,0]),
      Object.assign(mk('Brace','1x4',[40,3.5,.75],[-4,22,-1.75]),{rot:{k:2,deg:45}})]},
  {name:'an 8 ft ramp of 1/4" plywood from the floor up to a 2x4',must:['stop:span'],
    parts:()=>[Object.assign(mk('Ramp','ply14',[96,.25,24],[0,5.875,0]),{rot:{k:2,deg:7.2}}),mk('Block','4x4',[3.5,11.6,24],[92.5,0,0])]},
  {name:'a 6 ft frame braced by nothing but two short stubs on one post',must:['warn:racking','warn:racking'],options:{uses:{Top:'none'}}, // both ways
    parts:()=>[[0,0],[40,0],[0,30],[40,30]].map(([x,z])=>mk('Post','2x4',[1.5,72,3.5],[x,0,z])).concat([mk('Top','ply34',[41.5,.75,33.5],[0,72,0]),
      mk('Stub','2x4',[6,3.5,1.5],[1.5,10,0]),mk('Stub','2x4',[6,3.5,1.5],[1.5,60,0])])},
  {name:'a pair of rafters on a ridge board with a tie across their feet',clean:true,parts:()=>rafterPairCase(4,true)},
  {name:'the same pair of rafters with no tie (the walls would spread)',must:['stop:spread'],parts:()=>rafterPairCase(4,false)},
  {name:'a pair of rafters with only a collar tie up near the ridge',must:['stop:spread'],
    parts:()=>rafterPairCase(6,false).concat([mk('Collar tie','2x4',[1.5,3.5,23.6],[8.5,19,36.2])])},
  {name:'a tied pair of rafters flatter than 3 in 12',must:['stop:spread'],parts:()=>rafterPairCase(2,true)},
  // Plywood braces framing lumber but does not hold it up. The check once let a rafter hang from the roof deck
  // and a stud lean on the wall sheathing, so a shed that had lost its rafter ties, its ridge board or a
  // header still came out clean.
  presetRow('the default shed with its rafter ties deleted',['stop:spread'],'Shed',{},['Rafter tie']),
  presetRow('the shed at 6 in 12 with its rafter ties deleted',['stop:spread'],'Shed',{pitch:6},['Rafter tie']),
  presetRow('the shed with its rafter ties, ridge board, roof deck and gable studs deleted',['stop:spread'],'Shed',{},['Rafter tie','Ridge board','Roof deck','Gable stud']),
  // with the ties still there the pairs hold, but rafters that only touch at their tips are a marginal joint
  presetRow('the shed with only its ridge board deleted',['warn:ridge'],'Shed',{},['Ridge board']),
  presetRow('the steep shed with only its ridge board deleted',['warn:ridge'],'Shed',{pitch:12},['Ridge board']),
  // rafters with no roof deck across them stand, but nothing keeps them from rolling over
  presetRow('the shed with only its roof deck deleted',['warn:racking'],'Shed',{},['Roof deck']),
  presetRow('the lean-to shed with only its roof deck deleted',['warn:racking'],'Shed',{roof:'lean',pitch:3},['Roof deck']),
  presetRow('the shed with the headers over its openings deleted',['stop:span'],'Shed',{},['Header']),
  presetRow('the shed with a 6 ft door and no header or cripple studs over it',['stop:span'],'Shed',{W:144,dw:72},['Header','Cripple']),
  presetRow('the lean-to shed with its headers deleted',['stop:span'],'Shed',{roof:'lean',pitch:3},['Header']),
  presetRow('the shed with its top plates deleted (the roof would hang on the sheathing)',['stop:unsupported'],'Shed',{},['Top plate']),
  {name:'a 2x4 stud nailed to a sheet of sheathing and to nothing else',must:['stop:unsupported'],
    parts:()=>[mk('Plate','2x4',[48,1.5,3.5],[0,0,0]),mk('Wall sheathing','ply12',[48,48,.5],[0,0,-.5]),mk('Stud','2x4',[1.5,30,3.5],[20,10,0])]},
  {name:'a 2x4 rail screwed between two plywood ends',clean:true,
    parts:()=>[mk('End','ply34',[.75,20,16],[0,0,0]),mk('End','ply34',[.75,20,16],[30.75,0,0]),mk('Rail','2x4',[30,3.5,1.5],[.75,10,7])]},
  // a drawer whose cabinet side is gone hangs on one slide: the drawer side with nothing beside it is reported
  presetRow('the nightstand with drawers with one side deleted',['stop:unsupported'],'Nightstand with drawers',{},['Side'],1),
  {name:'a tied pair of rafters at exactly 45 degrees is still span-checked',clean:true,parts:()=>rafterPairCase(12,true)},
  // 1,033 lb on each upright: fine for a short 2x4 (1,340 lb), too much for one 6 ft long, which bows sideways (about 820 lb)
  {name:'a 180 gallon tank on 2x4 uprights 6 ft long',must:['stop:post-load'],options:{wallFixed:true,uses:{Rail:'tankRail','Shelf deck':'tankDeck'}},
    parts:()=>[[0,0],[74.5,0],[0,21.5],[74.5,21.5]].map(([x,z])=>mk('Upright','2x4',[1.5,72,3.5],[x,0,z])).concat([mk('Rail','2x10',[76,9.25,1.5],[0,72,0]),
      mk('Rail','2x10',[76,9.25,1.5],[0,72,23.5]),mk('Shelf deck','ply34',[76,.75,25],[0,81.25,0]),Object.assign(mk('Tank','tank',[72,25,24],[2,82,.5]),{gal:180})])},
  {name:'the same tank on 2x4 uprights 4 ft long',clean:true,options:{wallFixed:true,uses:{Rail:'tankRail','Shelf deck':'tankDeck'}},
    parts:()=>[[0,0],[74.5,0],[0,21.5],[74.5,21.5]].map(([x,z])=>mk('Upright','2x4',[1.5,48,3.5],[x,0,z])).concat([mk('Rail','2x10',[76,9.25,1.5],[0,48,0]),
      mk('Rail','2x10',[76,9.25,1.5],[0,48,23.5]),mk('Shelf deck','ply34',[76,.75,25],[0,57.25,0]),Object.assign(mk('Tank','tank',[72,25,24],[2,58,.5]),{gal:180})])},
  // pieces that hang on bought hardware (options.hung): a drawer box on side-mount slides, 1/2" from each cabinet side
  {name:'a drawer box on slides between two cabinet sides',clean:true,options:{hung:['Drawer side']},parts:()=>drawerCase(.5)},
  {name:'the same drawer when nobody says it hangs on slides',must:['stop:unsupported'],parts:()=>drawerCase(.5)},
  {name:'a drawer box 2" away from the sides its slides would be screwed to',must:['stop:unsupported'],options:{hung:['Drawer side']},parts:()=>drawerCase(2)},
  {name:'an 8 ft 1x4 lying flat between two posts, carrying nothing',clean:true,options:{wallFixed:true},parts:()=>hangingRailCase(false)},
  {name:'the same 1x4 with a 15 lb beam hung under it on hardware',must:['stop:span'],options:{wallFixed:true,hung:['Hanging beam']},parts:()=>hangingRailCase(true)},
  {name:'pieces from a damaged file',must:['warn:bad-piece'],
    parts:()=>[{name:'x',mat:'no such wood',l:10,w:2,t:1,ax:[0,1,2],pos:[0,0,0]},{name:'y',mat:'2x4'},null,7,
      {name:'z',mat:'2x4',l:NaN,w:3.5,t:1.5,ax:[0,1,2],pos:[0,0,0]},{name:'q',mat:'2x4',l:10,w:3.5,t:1.5,pos:[0,0,0]},
      Object.assign(mk('Board','1x6',[40,.75,5.5],[0,0,0]),{q:[0,0,0,0],rot:{k:7,deg:'x'}})]}
];
function selfTestVerify(problems){
  for(const test of VERIFY_CASES){
    let result;
    try{result=verifyDesign(test.parts(),typeof test.options==='function'?test.options():test.options);}
    catch(e){problems.push(`structural check, ${test.name}: it threw "${e.message}"`);continue;}
    const got=result.problems.map(f=>f.level+':'+f.code),noted=result.notes.map(f=>f.code);
    const count=(list,item)=>list.filter(x=>x===item).length; // a finding listed twice in must has to be there twice
    for(const want of new Set(test.must||[])){
      if(count(got,want)<count(test.must,want))problems.push(`structural check, ${test.name}: expected ${want}${count(test.must,want)>1?' '+count(test.must,want)+' times':''} but got ${got.join(', ')||'no problem'}`);
    }
    for(const want of test.notes||[])if(!noted.includes(want))problems.push(`structural check, ${test.name}: expected the note ${want}`);
    if(test.clean&&got.length)problems.push(`structural check, ${test.name}: it is sound but got ${got.join(', ')}`);
  }
  // it must never throw, whatever it is handed
  for(const odd of[null,undefined,[],'text',{},[null],[[]]]){
    try{verifyDesign(odd,null);verifyDesign(odd,{wall:true,uses:null,joints:null,style:null,maxPieces:'many'});}
    catch(e){problems.push(`structural check: it threw "${e.message}" when handed ${JSON.stringify(odd)}`);}
  }
}

/* The shed's own bearing check (shedBearingProblems in js/builders-shed.js: rafters on plates and at the ridge,
   studs between plates, headers on trimmer studs) on sheds of both roof styles, flat and steep, small and
   large, and once on a shed with its cap plates taken away, which it has to notice. To cover another shape,
   add a row: the fields are the ones in the Shed form, and anything left out keeps its default. */
const SHED_SHAPES=[{},{pitch:12},{pitch:3,W:192,D:144,Hb:96},{W:48,D:48,dw:24,wn:0},{pitch:7.3,W:74.5,D:129,sp:'24',dwall:'back',doff:20},
  {roof:'lean',pitch:3},{roof:'lean',pitch:1,W:192,D:144,Hb:96},{roof:'lean',pitch:12,D:48,Hb:72,dh:60,sill:20,wh:20},
  {roof:'lean',pitch:4.5,W:100,dw:72,dh:60,dwall:'left',wwall:'front'}];
function selfTestShed(problems){
  const shed=PRESETS.find(preset=>preset.name==='Shed');
  if(!shed)return;
  for(const shape of SHED_SHAPES){
    const vals={...presetDefaults(shed),...shape},label='shed '+JSON.stringify(shape);
    try{
      if(shed.check(vals).some(f=>f.level==='stop')){problems.push(`${label}: it is refused, so its bearing was not checked`);continue;}
      shedBearingProblems(vals).forEach(text=>problems.push(`${label}: ${text}`));
    }catch(e){problems.push(`${label}: it threw "${e.message}"`);}
  }
  const defaults=presetDefaults(shed),noCaps=buildShed(defaults).filter(piece=>piece.name!=='Cap plate');
  if(!shedBearingProblems(defaults,noCaps).length)problems.push('shed: the bearing check did not notice that the cap plates were missing');
}

/* Create in the presets dialog (presetGate) and the limits on a preset's numbers (readVals), tried on a made-up
   preset: a "stop" must not be built and must say why, a "warn" is built after Build anyway, a clean design is
   built without a question, and a number outside its limits is turned away in plain words. */
function selfTestGate(problems){
  const made=found=>({name:'Self-check',desc:'',params:[num('W','Width',20,10,30)],check:()=>found,
    build:p=>[mk('Board','1x4',[p.W||20,.75,3.5],[0,0,0])]});
  let built=0;
  presetGate(made([{level:'stop',text:'Too steep.',fix:'Lower it.'}]),{W:20},()=>{built++;});
  const said=autoMessages.splice(0).join(' ');
  if(built||!said.includes('Too steep.')||!said.includes('Lower it.'))problems.push('preset gate: a preset whose check(p) returns a stop must not be built, and the box must say why and what to change');
  presetGate(made([{level:'warn',text:'A bit wobbly.',fix:'Add a brace.'}]),{W:20},()=>{built++;});
  if(built!==1)problems.push('preset gate: a preset with only warnings must be built after Build anyway');
  presetGate(made([]),{W:20},()=>{built++;});
  if(built!==2||autoMessages.length)problems.push('preset gate: a clean preset must be built without a question or a notice');
  autoMessages.length=0;
  // the limits, through the form itself
  PRESETS.push(made([]));
  try{
    renderPresetCards();
    choosePreset(PRESETS.length-1);
    const box=$('#presetForm [data-k="W"]');
    box.value='31';
    if(readVals(false)!==null||!/between 10" and 30"/.test(presetFieldNote))problems.push('preset limits: 31" in a box limited to 10" to 30" was not turned away with a plain message: '+presetFieldNote);
    box.value='30';
    if(!readVals(false))problems.push('preset limits: 30" in a box limited to 10" to 30" was turned away');
  }finally{
    PRESETS.pop();
    renderPresetCards();
  }
}

function selfTest(opt){
  opt=opt||{};
  const keep=lastSnap,undo0=undoStack.slice(),redo0=redoStack.slice(),hidden0=hiddenIds,tab0=tab,tool0=tool,problems=[],preset0=curPreset;
  const view0={target:cam.target.clone(),r:cam.r,th:cam.th,ph:cam.ph}; // where the 3D view was looking, to put back at the end
  let lastPreset0=null;try{lastPreset0=localStorage.getItem(LAST_PRESET_KEY);}catch(e){} // the preset the dialog opens on, also put back
  const note=(name,msg)=>problems.push(name+': '+msg);
  let checked=0;
  // No dialogs while the check runs: questions (askConfirm) answer yes at once, and every notice (showMessage)
  // lands in autoMessages. A notice during the check means something went wrong, so each one is a problem.
  autoConfirm=true;autoMessages.length=0;
  // The older checks below look at what every preset builds, so Create must build it even when the structural
  // check would refuse it. Those findings are reported on their own, under "structural".
  presetGateOff=true;
  let structural=[];
  try{
    PRESETS.forEach((pr,i)=>{
      if(opt.only&&!opt.only.includes(pr.name))return;
      try{
        if(!$('#presetDlg').open)$('#bPreset').click();
        $(`#presetCards .card[data-i="${i}"]`).click();
        for(const[k,v]of Object.entries(opt.set||{})){const el=$(`#presetForm [data-k="${k}"]`);if(!el)continue;
          if(el.type==='checkbox')el.checked=!!v;else el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}
        if(!$('#presetSum b'))note(pr.name,'the presets dialog shows no live summary (size, pieces, lumber, cost): '+$('#presetSum').textContent);
        if(!previewFailed&&!(previewKit&&previewKit.content.children.length))note(pr.name,'the presets dialog shows no picture of the design');
        const tile=$(`#presetCards .card[data-i="${i}"]`);
        if(!pr.spec)note(pr.name,'has no spec (the short line on its tile)');
        if([...tile.querySelectorAll('b,small')].some(line=>line.scrollWidth>line.clientWidth))note(pr.name,'the name or the short line on its tile does not fit and is cut off');
        $('#bPGo').click();checked++;
        autoMessages.splice(0).forEach(m=>note(pr.name,'message: '+m.slice(0,160)));
        if(S.name!==pr.name)return note(pr.name,`did not build (the project is still "${S.name}")`);
        if(!S.parts.length)return note(pr.name,'built no pieces');
        const cl=findClashes();if(cl.length)note(pr.name,`${cl.length} overlapping pairs, for example ${cl[0][0].name} / ${cl[0][1].name}`);
        for(const p of S.parts){const m=M[p.mat];if(!m){note(pr.name,`${p.name} has an unknown material "${p.mat}"`);break;}
          if(!(p.l>0&&p.w>0&&p.t>0)||p.pos.some(v=>!isFinite(v))){note(pr.name,`${p.name} has a bad size or position`);break;}
          if(m.kind==='prop')continue;
          if(Math.abs(p.t-m.t)>1e-6||(m.kind==='board'&&p.w>m.w+1e-6)){note(pr.name,`${p.name} is ${p.l} x ${p.w} x ${p.t} but ${m.id} stock is ${m.t} x ${m.w}`);break;}}
        if(bbox(S.parts).lo[1]<-.01)note(pr.name,'something sits below the floor');
        const names=new Set(S.parts.map(p=>p.name)),used=new Set((S.steps||[]).flatMap(s=>s.add));
        if(!(S.steps||[]).length)note(pr.name,'has no steps');
        else{const unused=[...names].filter(n=>!used.has(n));if(unused.length)note(pr.name,'pieces never mentioned in the steps: '+unused.join(', '));}
        findJoints().forEach(j=>jSpec(j,jType(j)));
        setTab('instr');
        if(!document.querySelectorAll('#instrPage .step').length)note(pr.name,'the instructions show no steps');
        if(document.querySelectorAll('#instrPage .views img').length!==3)note(pr.name,'the flat views are missing from the instructions');
        if(/undefined|NaN/.test($('#instrPage').innerText))note(pr.name,'the instructions contain "undefined" or "NaN"');
        if(!$('#instrPage .titleblock'))note(pr.name,'the instructions have no title block for printing');
        if([...document.querySelectorAll('#instrPage table.tbl')].some(t=>!t.tHead))note(pr.name,'a table in the instructions has no header row that can repeat on each printed page');
        setTab('cut');if(/undefined|NaN/.test($('#cutPage').innerText))note(pr.name,'the cut list contains "undefined" or "NaN"');
        setTab('joints');if(/undefined|NaN/.test($('#jointsPage').innerText))note(pr.name,'the Fasteners tab contains "undefined" or "NaN"');
        setTab('design');
      }catch(e){note(pr.name,'error: '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,3).join(' | ').trim());}
    });
    // the dialog helpers themselves: with autoConfirm on, a question answers yes on the spot and a notice is collected
    let answered=false;
    askConfirm('self-check',{},()=>{answered=true;});
    if(!answered)problems.push('dialogs: askConfirm did not answer at once while autoConfirm is on');
    showMessage('self-check','notice');
    if(autoMessages.splice(0).join()!=='self-check: notice')problems.push('dialogs: showMessage was not collected while autoConfirm is on');
    // Create in the presets dialog, with the gate back on; then the preset rule itself
    presetGateOff=false;
    if(!opt.only)selfTestGate(problems);
    if(!opt.only)selfTestVerify(problems);
    if(!opt.only||opt.only.includes('Shed'))selfTestShed(problems);
    if(!opt.only)selfTestTablesFamily(problems); // tables, benches and the bed at every corner of their limits (js/builders-furniture.js)
    if(!opt.only)selfTestFish(problems); // the choices of the fish rack forms (js/builders-fish.js)
    try{structural=selfTestStructure(opt);}
    catch(e){problems.push('structural check: error: '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,3).join(' | ').trim());}
    // moving a design as text, and printing (the last preset built is still on screen)
    if(S.parts.length)selfTestTransfer(problems);
    selfTestPrint(problems);
    // the parts of the Design tab that are worked with the mouse
    if(tab!=='design')setTab('design');
    if($('#presetDlg').open)$('#presetDlg').close();
    if(S.parts.length)selfTestPanels(problems);
    selfTestGrab(problems);
    // checks that live beside their feature (see SELFTESTS in js/core.js); one that throws does not stop the rest
    for(const check of SELFTESTS){
      try{check(problems);}
      catch(e){problems.push(`error in ${check.name||'a feature check'}: ${e.message}`);}
    }
  }catch(e){
    problems.push('error: '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,3).join(' | ').trim());
  }finally{
    autoConfirm=false;
    presetGateOff=false;
    autoMessages.splice(0).forEach(m=>problems.push('message: '+m.slice(0,160)));
    if($('#presetDlg').open)$('#presetDlg').close();
    drag=null;lite=false;
    load(keep,true);undoStack=undo0;redoStack=redo0;hiddenIds=hidden0;setTool(tool0);setTab(tab0);renderAll();
    cam.target.copy(view0.target);cam.r=view0.r;cam.th=view0.th;cam.ph=view0.ph;updateCam();
    if(preset0)choosePreset(PRESETS.indexOf(preset0));else showNoPreset(); // leave the presets dialog showing what it showed before
    try{
      if(lastPreset0===null)localStorage.removeItem(LAST_PRESET_KEY);else localStorage.setItem(LAST_PRESET_KEY,lastPreset0);
    }catch(e){}
  }
  return{ok:!problems.length,checked,problems,hosted:HOSTED,structural,structuralOk:!structural.length};
}
