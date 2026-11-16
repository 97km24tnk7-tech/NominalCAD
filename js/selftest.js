/* NominalCAD: a built-in self-check.
   Open the browser console (F12) and run  selfTest()  after changing the code.
   It builds every preset with its default sizes and checks that nothing overlaps, every piece matches its
   material, the steps mention every piece, and the Joints, Cut list and Build instructions tabs all render.
   It also checks the presets dialog (every tile fits its text, the live picture and the live summary are
   there), the title block and table headers of the printed pages, the dialog helpers (askConfirm,
   showMessage), Copy design as text and Paste design from text, Print, the roll-up of the floating panels,
   and what the pointer grabs on a selected piece (a stretch handle before a move arrow, the piece at its
   middle). No dialog is shown while it runs, nothing is printed and the clipboard is not touched.
   It puts your design back afterwards. Returns {ok, checked, problems, hosted}.
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
        setTab('joints');if(/undefined|NaN/.test($('#jointsPage').innerText))note(pr.name,'the Joints tab contains "undefined" or "NaN"');
        setTab('design');
      }catch(e){note(pr.name,'error: '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,3).join(' | ').trim());}
    });
    // the dialog helpers themselves: with autoConfirm on, a question answers yes on the spot and a notice is collected
    let answered=false;
    askConfirm('self-check',{},()=>{answered=true;});
    if(!answered)problems.push('dialogs: askConfirm did not answer at once while autoConfirm is on');
    showMessage('self-check','notice');
    if(autoMessages.splice(0).join()!=='self-check: notice')problems.push('dialogs: showMessage was not collected while autoConfirm is on');
    // moving a design as text, and printing (the last preset built is still on screen)
    if(S.parts.length)selfTestTransfer(problems);
    selfTestPrint(problems);
    // the parts of the Design tab that are worked with the mouse
    if(tab!=='design')setTab('design');
    if($('#presetDlg').open)$('#presetDlg').close();
    if(S.parts.length)selfTestPanels(problems);
    selfTestGrab(problems);
  }catch(e){
    problems.push('error: '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,3).join(' | ').trim());
  }finally{
    autoConfirm=false;
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
  return{ok:!problems.length,checked,problems,hosted:HOSTED};
}
