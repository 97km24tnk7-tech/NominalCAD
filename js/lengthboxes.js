/* NominalCAD: the boxes a person types a size or a position into.
   The owner reads a size the way a steel detailer writes it, so every such box shows feet and inches over 12"
   (2'-8", 2'-8 1/2", 25'-0") and inches from 12" down (11 1/2"). The writer and the reader are in js/core.js:
   boxLen(inches) is what a box shows, parseLen(text) reads whatever a person types back (32, 32", 2'-8", 2' 8",
   2'8, 2 ft 8 in, 2.5', 300", 25', with a minus sign for a position or a distance that goes back).

   A length box is an <input> with the attribute data-len. Today that is:
     - every size box of a preset form (presetField in js/app.js; counts, gallons and the roof slope are not sizes)
     - the Size and Position boxes in Properties (sizeField in js/panels.js)
     - the Position on the piece boxes of a picked piece of hardware (js/hardwaretool.js)
     - Distance apart in Copy in a row (index.html)
   A new box for a size gets data-len and starts with boxLen(value); nothing else is needed.

   What this file does: when the person leaves a length box (it loses the keyboard, or Enter is pressed), what
   they typed is written again in the box's own form, so 300" becomes 25'-0" and 32 becomes 2'-8". While they are
   still typing nothing jumps. A box that cannot be read keeps its text (and its red mark, if the form gave it
   one), so the person can see what to put right. Whatever was typed has already been read by then: the box's
   own change handler runs before the box is tidied. Nothing stored changes: projects hold inches. */
'use strict';

const LENGTH_BOX='input[data-len]';

/* Writes what a length box holds in the box's form. Returns false when it cannot be read (then it is left alone). */
function tidyLengthBox(box){
  const inches=parseLen(box.value);
  if(isNaN(inches))return false;
  const tidy=boxLen(inches);
  if(box.value===tidy)return true;
  // Enter on a size outside the limits selects the whole box for typing again (readVals in js/app.js); writing
  // the new text would drop that selection, so it is put back
  const wholeSelected=document.activeElement===box&&box.value.length>0&&box.selectionStart===0&&box.selectionEnd===box.value.length;
  box.value=tidy;
  if(wholeSelected)box.select();
  return true;
}
const isLengthBox=el=>!!(el&&el.matches&&el.matches(LENGTH_BOX));

// leaving the box: the change event (which reads what was typed) has already run when focusout comes
document.addEventListener('focusout',e=>{
  if(isLengthBox(e.target))tidyLengthBox(e.target);
});
// Enter: wait until the change event and whatever Enter does (Create, Make copies) have run, then tidy the box if it
// is still on the page
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!isLengthBox(e.target))return;
  const box=e.target;
  setTimeout(()=>{if(box.isConnected)tidyLengthBox(box);},0);
});

/* ---------- self-checks (selfTest runs every function in SELFTESTS, see js/core.js) ---------- */

/* The writer and the reader agree: every size a box can show reads back as the very same number, to the
   sixteenth, and everything a person might type is read as it is meant. */
SELFTESTS.push(function lengthBoxesRoundTrip(problems){
  const wrong=text=>problems.push('length boxes: '+text);
  // what a box shows
  const SHOWS=[[0,'0"'],[1/16,'1/16"'],[.75,'3/4"'],[11.5,'11 1/2"'],[12,'12"'],[12+1/16,`1'-0 1/16"`],[32,`2'-8"`],
    [32.5,`2'-8 1/2"`],[96,`8'-0"`],[300,`25'-0"`],[310.5,`25'-10 1/2"`],[-32,`-2'-8"`],[-12,'-12"'],[-0.75,'-3/4"']];
  for(const[inches,shown]of SHOWS){
    if(boxLen(inches)!==shown)wrong(`${inches}" should show as ${shown}, not ${boxLen(inches)}`);
  }
  // every sixteenth from -50 ft to 50 ft reads back as itself
  let misread=0,firstMisread='';
  for(let n=-9600;n<=9600;n++){
    const inches=n/16,back=parseLen(boxLen(inches));
    if(back!==inches){misread++;if(!firstMisread)firstMisread=`${boxLen(inches)} read back as ${back}, not ${inches}`;}
  }
  if(misread)wrong(`${misread} sizes do not read back as the number shown, for example ${firstMisread}`);
  // what a person might type
  const TYPED=[['32',32],['32"',32],[`2'-8"`,32],[`2' 8"`,32],[`2'8`,32],[`2'8"`,32],['2 ft 8 in',32],['2ft 8',32],
    ['2 feet 8 inches',32],[`2.5'`,30],[`2'-8 1/2"`,32.5],[`2' 8-1/2"`,32.5],['300"',300],[`25'`,300],[`25'-0"`,300],
    [` 2 ' - 8 " `,32],[`-2'-8"`,-32],[`- 2' 8`,-32],['-300"',-300],['3 1/2',3.5],['3-1/2',3.5],['.75',.75],['1/2',.5],
    ['36 inches',36],['36 in',36],[`4' 6`,54],['0',0],['2 ft',24],[`2′ 8″`,32],[`2’-8”`,32],[`8''`,8]];
  for(const[text,inches]of TYPED){
    const got=parseLen(text);
    if(got!==inches)wrong(`"${text}" should read as ${inches}", not ${got}`);
  }
  for(const text of['','abc',`2'3'`,'1/0','2"3',`'`,'--3','3 1/2 1/4','x2']){
    if(!isNaN(parseLen(text)))wrong(`"${text}" should not be readable, but read as ${parseLen(text)}`);
  }
  // the words under the form: sizes the person typed are quoted as the boxes show them, the notes stay in inches
  if(typedLen(300,fmtFt)!==fmtFt(300)||speakAsBoxes(()=>typedLen(300,fmtFt))!==`25'-0"`||typedLen(32)!=='32"')wrong('typedLen must give boxLen inside speakAsBoxes and the usual writer outside it');
});

/* Every preset form shows its sizes in the box form and reads them back as the same numbers; a count, gallons
   and a roof slope are not sizes and are left as they were; the box is tidied when it is left; the limit line
   speaks as the box does. */
SELFTESTS.push(function lengthBoxesInPresetForms(problems){
  const wrong=text=>problems.push('length boxes: '+text);
  const before=curPreset;
  try{
    PRESETS.forEach((preset,index)=>{
      choosePreset(index);
      for(const q of preset.params){
        if(q.head||q.opts||q.check)continue;
        const box=$(`#presetForm [data-k="${q.k}"]`);
        if(!box){wrong(`${preset.name}: no box for ${q.k}`);continue;}
        const isSize=!q.int&&!q.dec;
        if(isSize!==box.hasAttribute('data-len'))wrong(`${preset.name}: the box ${q.label} ${isSize?'is a size but is not':'is not a size but is'} marked as a length box`);
        const shown=isSize?boxLen(q.v):String(q.v);
        if(box.value!==shown)wrong(`${preset.name}: the box ${q.label} shows "${box.value}", it should show "${shown}"`);
      }
      // the defaults read back as the same numbers (rows hidden by a show rule hand over their starting value too)
      const vals=readVals(false);
      if(!vals){wrong(`${preset.name}: the form at its defaults cannot be read: ${presetFieldNote}`);return;}
      for(const q of preset.params){
        if(q.head||q.opts||q.check)continue;
        if(Math.abs(vals[q.k]-q.v)>1e-9)wrong(`${preset.name}: ${q.label} starts at ${q.v} but the form reads back ${vals[q.k]}`);
      }
    });
    // the Shed, by hand: 300" in Width is tidied to 25'-0" when the box is left, and the limit line says it the same way
    const shed=PRESETS.findIndex(preset=>preset.name==='Shed');
    if(shed>=0){
      choosePreset(shed);
      const width=$('#presetForm [data-k="W"]');
      width.value='300"';
      width.dispatchEvent(new Event('change',{bubbles:true}));
      width.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
      if(width.value!==`25'-0"`)wrong(`300" in the Shed's Width should read 25'-0" after leaving the box, not ${width.value}`);
      if(readVals(false)!==null||!presetFieldNote.includes(`between 4'-0" and 16'-0"`))wrong(`the Shed's limit line should say between 4'-0" and 16'-0": ${presetFieldNote}`);
      if(!width.classList.contains('bad'))wrong('300" in the Shed\'s Width should be marked red');
      // Enter on a size outside the limits leaves the whole box selected for typing again, also once it is tidied
      // (checked only where the box can take the keyboard: the dialog may be closed while selfTest runs)
      width.value='300"';
      width.focus();
      if(document.activeElement===width){
        width.select();
        tidyLengthBox(width);
        if(width.value!==`25'-0"`||width.selectionStart!==0||width.selectionEnd!==width.value.length)wrong('a box tidied while all its text is selected must stay all selected');
        width.blur();
      }
      width.value='12 ft';
      width.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
      if(width.value!==`12'-0"`)wrong(`12 ft in the Shed's Width should read 12'-0" after leaving the box, not ${width.value}`);
      // a box that cannot be read keeps its text
      width.value='ten feet';
      width.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
      if(width.value!=='ten feet'||readVals(false)!==null||!width.classList.contains('bad'))wrong('a box that cannot be read must keep its text and its red mark');
      // a count and a roof slope are left alone
      const windows=$('#presetForm [data-k="wn"]'),slope=$('#presetForm [data-k="pitch"]');
      windows.value='3';slope.value='5';
      windows.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
      slope.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
      if(windows.value!=='3'||slope.value!=='5')wrong('a count or a roof slope must not be rewritten when the box is left');
      // a finding that quotes a typed size, under the form, speaks as the boxes do; the notes stay in inches
      width.value='4\'';
      const door=$('#presetForm [data-k="dw"]');
      door.value='6\'';
      showPresetSummary();
      const findings=$('#presetCheck').textContent;
      if(!/6'-0" wide/.test(findings)||!/only 4'-0" long/.test(findings))wrong(`a door 6'-0" wide on a wall 4'-0" long: the finding under the form should quote both that way: ${findings.slice(0,200)}`);
      const vals={...presetDefaults(PRESETS[shed]),W:120,D:96};
      if(!PRESETS[shed].notes(vals).some(note=>note.includes(`${fmtFt(120)} wide`)))wrong('the notes of the Shed must keep their sizes in inches and fmtFt');
      if(!speakAsBoxes(()=>PRESETS[shed].info(vals)).includes(`10'-0" wide`))wrong('the remark under the Shed form should repeat its Width as 10\'-0"');
      // the windows' finding quotes the top of the glass (sill + window height, both typed) the same way
      const tooHigh=speakAsBoxes(()=>PRESETS[shed].check({...presetDefaults(PRESETS[shed]),sill:72,wh:24})).map(f=>f.text+' '+f.fix).join(' ');
      const plainInchesOver12=[...tooHigh.matchAll(/(?:^|[\s(])(\d+)(?: \d+\/\d+)?"/g)].some(found=>+found[1]>12||(+found[1]===12&&found[0].includes('/')));
      if(!/The windows reach 8'-0" above the floor/.test(tooHigh)||plainInchesOver12)wrong(`windows 8'-0" high on 7'-0" walls: the finding should quote every size as the boxes do: ${tooHigh.slice(0,240)}`);
    }
    // a tank size picked from the list fills the tank boxes in the box form
    const rack=PRESETS.findIndex(preset=>preset.name==='Fish tank wall / rack');
    if(rack>=0){
      choosePreset(rack);
      const size=$('#presetForm [data-k="size"]'),pick=Object.keys(TANKS).find(key=>TANKS[key][0]>12);
      size.value=pick;
      size.dispatchEvent(new Event('change',{bubbles:true}));
      if($('#presetForm [data-k="tl"]').value!==boxLen(TANKS[pick][0]))wrong(`picking a tank size should fill Tank length with ${boxLen(TANKS[pick][0])}, not ${$('#presetForm [data-k="tl"]').value}`);
      if($('#presetForm [data-k="gal"]').value!==String(TANKS[pick][3]))wrong('picking a tank size should fill Gallons as a plain number');
    }
  }finally{
    const was=PRESETS.indexOf(before);
    if(was>=0)choosePreset(was);else showNoPreset();
  }
});

/* Properties: the Size and Position boxes show the box form, take feet and inches, and the Tilt (degrees) box,
   the Copy in a row count and a price box are not length boxes. */
SELFTESTS.push(function lengthBoxesInProperties(problems){
  const wrong=text=>problems.push('length boxes: '+text);
  const selKept=sel;
  try{
    load(JSON.stringify(blank()),true);
    const ids=addParts([mk('Rail','2x4',[30,1.5,3.5],[40,0,10])]);
    commit();
    sel=new Set(ids);
    renderProps();
    const piece=byId(ids[0]),field=f=>$(`#props [data-f="${f}"]`);
    const expected={l:piece.l,w:piece.w,x:piece.pos[0],y:piece.pos[1],z:piece.pos[2]};
    for(const[f,inches]of Object.entries(expected)){
      const box=field(f);
      if(!box){wrong(`Properties has no ${f} box`);continue;}
      if(!box.hasAttribute('data-len'))wrong(`the Properties box ${f} is not marked as a length box`);
      if(box.value!==boxLen(inches))wrong(`the Properties box ${f} shows ${box.value}, it should show ${boxLen(inches)}`);
      if(parseLen(box.value)!==inches)wrong(`the Properties box ${f} does not read back as ${inches}`);
    }
    // the longest a box shows within a 50 ft design, and a position that goes back, are not cut off at the right
    // edge of the box (the Properties panel is laid out for them in css/style.css). The panel is shown for the
    // measurement (it may be hidden or rolled up) and put back as it was.
    const panel=$('#right'),panelClass=panel.className;
    panel.classList.remove('off','min');
    for(const box of document.querySelectorAll('#props input[data-len]')){
      const kept=box.value;
      for(const longest of[`49'-11 15/16"`,`-49'-11 15/16"`]){
        box.value=longest;
        if(box.scrollWidth>box.clientWidth)wrong(`the Properties box ${box.dataset.f} cuts off ${longest} (${box.scrollWidth-box.clientWidth} pixels)`);
      }
      box.value=kept;
    }
    panel.className=panelClass;
    // 2'6 typed in X puts the piece 30" from the left, and the box then shows 2'-6"
    const x=field('x');
    x.value=`2'6`;
    x.dispatchEvent(new Event('change',{bubbles:true}));
    if(byId(ids[0]).pos[0]!==30)wrong(`2'6 typed in X should put the piece at 30", not ${byId(ids[0]).pos[0]}`);
    if(field('x').value!==`2'-6"`)wrong(`after 2'6 in X the box should show 2'-6", not ${field('x').value}`);
    const length=field('l');
    length.value='4 ft';
    length.dispatchEvent(new Event('change',{bubbles:true}));
    if(byId(ids[0]).l!==48||field('l').value!==`4'-0"`)wrong(`4 ft typed in Length should make the piece 48" long and show 4'-0"`);
    // not lengths: an angle, a count and a price
    const tilt=field('deg');
    if(!tilt||tilt.hasAttribute('data-len')||tilt.value!=='0')wrong('the Tilt, degrees box must stay a plain number');
    if($('#rowN').hasAttribute('data-len'))wrong('How many copies is a count, not a length box');
    if(!$('#rowStep').hasAttribute('data-len'))wrong('Distance apart in Copy in a row is a length box');
    if(document.querySelector('input.price[data-len]'))wrong('a price box must not be a length box');
    // Copy in a row starts with the size of the selection in the box form
    $('#rowDir').value='0';
    rowSpacing();
    if($('#rowStep').value!==boxLen(48))wrong(`Copy in a row should start with ${boxLen(48)} apart, not ${$('#rowStep').value}`);
    // Move typed with the keyboard (M, then a size): feet and inches are taken
    if(startModal('g')&&modal){
      for(const key of`1'6"`)modalKey({key,ctrlKey:false,metaKey:false,shiftKey:false});
      const moved=byId(ids[0]).pos[0];
      modalEnd(false);
      if(moved!==30+18)wrong(`M then 1'6" should move the piece 18" (to 48"), it went to ${moved}`);
    }else wrong('M did not start a move');
  }finally{
    sel=selKept;
  }
});
