/* NominalCAD: getting a design out of the program and back in.

   Two ways, and both carry the same thing: the project as text (JSON).
     As a file   Download as a file writes  <name>.woodshop.json ; Load from a file reads one back.
                 (The hosted copy cannot download, so js/hosted.js hides Download there. Loading works everywhere.)
     As text     Copy design as text puts the project on the clipboard; Paste design from text opens a box to
                 paste it into. No file is involved, so this also works on a phone, a tablet or the hosted copy:
                 copy on one device, send the text to yourself, paste on the other.

   What the rest of the program calls:
     designText()             the design on screen as text
     readProject(text)        checks text that should be a project. Returns {project} or {problem}.
     openProject(project)     shows a project that readProject accepted
     copyDesignText()         File > Copy design as text
     openPasteDesign()        File > Paste design from text */
'use strict';

/* ---------- the design as text, and reading it back ---------- */
function designText(){
  return JSON.stringify(S);
}

/* is this one piece of a project, with everything the 3D view needs to draw it? */
function isPiece(p){
  const isNumber=v=>typeof v==='number'&&isFinite(v);
  return!!p&&typeof p==='object'&&!!M[p.mat]&&
    [p.l,p.w,p.t].every(isNumber)&&
    Array.isArray(p.ax)&&p.ax.slice().sort().join()==='0,1,2'&&
    Array.isArray(p.pos)&&p.pos.length===3&&p.pos.every(isNumber);
}

/* Checks text that should be a NominalCAD project. Returns {project} when it is one. Otherwise {problem}:
     'empty'          there is no text at all
     'cut off'        it starts like a project, but part of it is missing (a copy that did not take everything)
     'not a project'  it is something else */
function readProject(text){
  text=String(text||'').trim();
  if(!text)return{problem:'empty'};
  // an email or chat program may have put words around the text: keep what is between the outer braces
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  const body=start>=0&&end>start?text.slice(start,end+1):text;
  let project=null;
  try{
    project=JSON.parse(body);
  }catch(err){
    return{problem:/"parts"\s*:/.test(text)?'cut off':'not a project'};
  }
  const good=!!project&&typeof project==='object'&&Array.isArray(project.parts)&&project.parts.every(isPiece);
  return good?{project}:{problem:'not a project'};
}

/* shows a project that readProject accepted, in place of the design on screen */
function openProject(project){
  load(JSON.stringify(project));
  setTab('design');
  fit('fit');
}

/* ---------- as a file ---------- */
$('#bExport').onclick=()=>{
  const link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));
  link.download=(S.name.replace(/[^\w\- ]+/g,'').trim()||'project')+'.woodshop.json';
  link.click();
  if(window.countVisitEvent)countVisitEvent('save file'); // the public site counts the first save to a file of a visit (js/visits.js)
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
};
$('#bImport').onclick=()=>$('#fileIn').click();
/* what Load from a file does with the text of the file that was picked */
function openProjectText(text){
  const read=readProject(text);
  if(!read.project){
    showMessage('Not a NominalCAD project','That file is not a NominalCAD project. Pick a file that was saved with File, then Download as a file.');
    return;
  }
  $('#projDlg').close();
  openProject(read.project);
}
$('#fileIn').onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;
  file.text().then(openProjectText);
  e.target.value=''; // so that picking the same file again still counts as a change
};

/* ---------- as text: copy ---------- */
/* Puts text on the clipboard. Calls done(true) when it worked and done(false) when the browser refused.
   Browsers only allow this as the direct result of a click or a key, and some refuse anyway. There are two
   ways to ask; the newer one is tried first. */
function writeClipboard(text,done){
  const olderWay=()=>done(copyBySelection(text));
  if(!navigator.clipboard||!navigator.clipboard.writeText){olderWay();return;}
  let answer;
  try{
    answer=navigator.clipboard.writeText(text);
  }catch(err){
    olderWay();
    return;
  }
  answer.then(()=>done(true),olderWay);
}
/* the older way to copy: put the text in a text box, select it, and ask the browser to copy the selection */
function copyBySelection(text){
  const focusBefore=document.activeElement;
  const box=document.createElement('textarea');
  box.value=text;
  box.readOnly=true;
  box.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
  // a dialog that is open keeps the keyboard to itself, so the box has to go inside it
  const home=document.querySelector('dialog[open]')||document.body;
  home.appendChild(box);
  box.select();
  let worked=false;
  try{worked=document.execCommand('copy');}catch(err){}
  box.remove();
  if(focusBefore&&focusBefore.focus)focusBefore.focus();
  return worked;
}
function selectCopyText(){
  const box=$('#copyText');
  box.focus();
  box.select();
  box.scrollTop=0; // selecting scrolls to the end; show the start, which is easier to recognize
}
function copyDesignText(){
  if(!S.parts.length){toast('There is nothing to copy yet. Add a piece or pick a furniture preset first.');return;}
  const text=designText(),name=S.name;
  writeClipboard(text,copied=>{
    if(copied){
      if($('#projDlg').open)$('#projDlg').close(); // the message below would be hidden behind it
      toast(`Copied "${name}" as text. On the other device, click File, then Paste design from text.`);
      return;
    }
    // The browser said no. Show the text, already selected, so that it can be copied by hand.
    $('#copyText').value=text;
    $('#copyNote').textContent='';
    if(!$('#copyDlg').open)$('#copyDlg').showModal();
    selectCopyText();
  });
}
$('#bCopyText').onclick=copyDesignText;
/* the Copy button in that dialog tries once more: this click may be allowed where the first was not */
$('#bCopyAgain').onclick=()=>{
  writeClipboard($('#copyText').value,copied=>{
    $('#copyNote').textContent=copied?'Copied.':'Press Ctrl+C to copy the selected text.';
    selectCopyText(); // still selected, so that Ctrl+C works as well
  });
};

/* ---------- as text: paste ---------- */
const PASTE_PROBLEMS={
  'empty':'Paste the text into the box first.',
  'cut off':'Part of the text is missing. Copy it again on the other device and paste all of it.',
  'not a project':'That text is not a NominalCAD design. Copy it with File, then Copy design as text, and paste all of it here.',
};
function openPasteDesign(){
  $('#pasteText').value='';
  $('#pasteErr').textContent='';
  $('#pasteDlg').showModal();
}
function pasteDesignGo(){
  const read=readProject($('#pasteText').value);
  if(!read.project){
    $('#pasteErr').textContent=PASTE_PROBLEMS[read.problem];
    $('#pasteText').focus();
    return;
  }
  const open=()=>{
    $('#pasteDlg').close();
    openProject(read.project);
    const count=read.project.parts.length;
    toast(`Opened "${S.name}" (${count.toLocaleString()} piece${count===1?'':'s'}).`);
  };
  if(!S.parts.length){open();return;}
  askConfirm('Replace the design on screen with the pasted one? Save it first (File, then Save) if you want to keep it.',
    {title:'Replace the current design',action:'Replace',danger:true},open);
}
$('#bPasteText').onclick=openPasteDesign;
$('#bPasteGo').onclick=pasteDesignGo;
$('#pasteText').oninput=()=>{$('#pasteErr').textContent='';};
