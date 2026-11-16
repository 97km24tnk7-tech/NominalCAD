/* WoodShop Designer: a built-in self-check.
   Open the browser console (F12) and run  selfTest()  after changing the code.
   It builds every preset with its default sizes and checks that nothing overlaps, every piece matches its
   material, the steps mention every piece, and the Joints, Cut list and Build instructions tabs all render.
   It puts your design back afterwards. Returns {ok, checked, problems}.
   Options: selfTest({only:['Bookshelf']}) to check some presets; selfTest({set:{key:value}}) to change a
   form field (by its data-k) in every preset that has it before building. */
'use strict';
function selfTest(opt){
  opt=opt||{};
  const keep=lastSnap,undo0=undoStack.slice(),redo0=redoStack.slice(),tab0=tab,problems=[],confirm0=window.confirm,alert0=window.alert;
  const note=(name,msg)=>problems.push(name+': '+msg);
  let checked=0;
  window.confirm=()=>true;window.alert=m=>problems.push('alert: '+String(m).slice(0,160));
  try{
    PRESETS.forEach((pr,i)=>{
      if(opt.only&&!opt.only.includes(pr.name))return;
      try{
        if(!$('#presetDlg').open)$('#bPreset').click();
        $(`#presetCards .card[data-i="${i}"]`).click();
        for(const[k,v]of Object.entries(opt.set||{})){const el=$(`#presetForm [data-k="${k}"]`);if(!el)continue;
          if(el.type==='checkbox')el.checked=!!v;else el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}
        $('#bPGo').click();checked++;
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
        setTab('cut');if(/undefined|NaN/.test($('#cutPage').innerText))note(pr.name,'the cut list contains "undefined" or "NaN"');
        setTab('joints');if(/undefined|NaN/.test($('#jointsPage').innerText))note(pr.name,'the Joints tab contains "undefined" or "NaN"');
        setTab('design');
      }catch(e){note(pr.name,'error: '+e.message+' @ '+String(e.stack||'').split('\n').slice(1,3).join(' | ').trim());}
    });
  }finally{
    window.confirm=confirm0;window.alert=alert0;
    if($('#presetDlg').open)$('#presetDlg').close();
    load(keep,true);undoStack=undo0;redoStack=redo0;setTab(tab0);renderAll();
  }
  return{ok:!problems.length,checked,problems};
}
