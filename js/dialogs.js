/* NominalCAD: dialogs.

   Every dialog in the program is a <dialog class="dlg"> in index.html with the same three parts:

       <dialog class="dlg" id="someDlg">
         <div class="dlg-h"><span>Title</span>
           <button class="ib s" data-close title="Close (Esc)"><svg class="i xs"><use href="#i-x"/></svg></button></div>
         <div class="dlg-b"> ...rows of fields: <div class="frow"><label>Name</label><input class="fld"></div> ... </div>
         <div class="dlg-f"><span class="grow">one short note, or nothing</span>
           <button class="btn" data-close>Cancel</button>
           <button class="btn pri" id="bSomeGo">Do it</button></div>
       </dialog>

   Open one with  $('#someDlg').showModal() . Add class "narrow" or "wide" beside "dlg" for a different width.
   This file gives all of them the same behavior:
     - a button marked data-close closes its dialog (Esc does too; the browser handles that);
     - Enter in a text box presses the dialog's primary button (.btn.pri in the footer).

   It also holds the two ready-made dialogs the program uses INSTEAD of the browser's own "alert", "confirm" and
   "prompt" boxes. Never call those three: they do not appear when the program runs inside another page.

     askConfirm(message, options, onYes)   a yes / no question. onYes runs only if the person agrees.
         options.action  the label of the button that agrees, e.g. 'Delete'   (default 'OK')
         options.danger  true when agreeing destroys something that cannot be brought back
         options.title   the words in the title bar                            (default 'Please confirm')
     showMessage(title, text)              a notice with one OK button. A line break in text starts a new line.

   Both return at once; nothing waits for the answer. Put whatever should happen after "yes" inside onYes. */
'use strict';

/* While autoConfirm is true nothing is shown: every question is answered yes on the spot (onYes runs before
   askConfirm returns) and every notice is collected in autoMessages instead. selfTest() uses this. */
let autoConfirm=false;
const autoMessages=[];

let quickDlg=null;   // the one <dialog> that askConfirm and showMessage share; built the first time it is needed
let quickYes=null;   // what to run when the person agrees to the question that is showing

function quickDialog(){
  if(quickDlg)return quickDlg;
  const dlg=document.createElement('dialog');
  dlg.className='dlg narrow';
  dlg.id='quickDlg';
  dlg.innerHTML=
    `<div class="dlg-h"><span id="quickTitle"></span><button class="ib s" data-close title="Close (Esc)">${icon('i-x','xs')}</button></div>
     <div class="dlg-b"><p class="dlg-msg" id="quickText"></p></div>
     <div class="dlg-f"><span class="grow"></span><button class="btn" id="quickNo" data-close>Cancel</button><button class="btn pri" id="quickOk"></button></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('#quickOk').onclick=()=>{
    const run=quickYes;
    quickYes=null;
    dlg.close();
    if(run)run();
  };
  // Cancel, the close button and Esc all mean "no". (The browser sends "close" a moment after the dialog shuts,
  // so check that a new question has not been opened in the meantime.)
  dlg.addEventListener('close',()=>{if(!dlg.open)quickYes=null;});
  quickDlg=dlg;
  return dlg;
}

/* fills in the shared dialog and shows it on top of whatever is open */
function openQuick(title,text,okLabel,danger,withCancel){
  const dlg=quickDialog(),ok=dlg.querySelector('#quickOk'),no=dlg.querySelector('#quickNo');
  dlg.querySelector('#quickTitle').textContent=title;
  dlg.querySelector('#quickText').textContent=text;
  ok.textContent=okLabel;
  ok.className=danger?'btn dng':'btn pri';
  no.hidden=!withCancel;
  quickYes=null;
  if(!dlg.open)dlg.showModal();
  (danger?no:ok).focus(); // Enter agrees, except when agreeing destroys something: then Enter cancels
}

function askConfirm(message,options,onYes){
  if(typeof options==='function'){onYes=options;options=null;}
  options=options||{};
  if(autoConfirm){onYes();return;}
  openQuick(options.title||'Please confirm',message,options.action||'OK',!!options.danger,true);
  quickYes=onYes;
}

function showMessage(title,text){
  if(autoConfirm){autoMessages.push(title+': '+text);return;}
  openQuick(title,text,'OK',false,false);
}

/* ---------- behavior every dialog shares ---------- */
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-close]');
  if(!button)return;
  const dlg=button.closest('dialog');
  if(dlg)dlg.close();
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.target.tagName!=='INPUT'||e.target.type==='checkbox'||e.target.type==='radio')return;
  const dlg=e.target.closest('dialog.dlg');
  if(!dlg)return;
  const primary=dlg.querySelector('.dlg-f .btn.pri');
  if(primary&&!primary.disabled&&!primary.hidden){e.preventDefault();primary.click();}
});
