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
     showMessage(title, text, options)     a notice with one OK button. A line break in text starts a new line.
         options.steps   a list of sentences shown under the text as numbered steps (the dialog is wider for them)
         options.extra   one more button, left of OK, that does the first thing for the person:
                         {label: 'Copy design as text', icon: 'i-copy', run: function}. It closes the notice.

   Both return at once; nothing waits for the answer. Put whatever should happen after "yes" inside onYes. */
'use strict';

/* While autoConfirm is true nothing is shown: every question is answered yes on the spot (onYes runs before
   askConfirm returns) and every notice is collected in autoMessages instead. selfTest() uses this. */
let autoConfirm=false;
const autoMessages=[];

let quickDlg=null;   // the one <dialog> that askConfirm and showMessage share; built the first time it is needed
let quickYes=null;   // what to run when the person agrees to the question that is showing
let quickExtra=null; // what the extra button of the notice that is showing does

function quickDialog(){
  if(quickDlg)return quickDlg;
  const dlg=document.createElement('dialog');
  dlg.className='dlg narrow';
  dlg.id='quickDlg';
  dlg.innerHTML=
    `<div class="dlg-h"><span id="quickTitle"></span><button class="ib s" data-close title="Close (Esc)">${icon('i-x','xs')}</button></div>
     <div class="dlg-b" id="quickBody"></div>
     <div class="dlg-f"><button class="btn" id="quickMore"></button><span class="grow"></span><button class="btn" id="quickNo" data-close>Cancel</button><button class="btn pri" id="quickOk"></button></div>`;
  document.body.appendChild(dlg);
  /* closes the dialog, then runs what the pressed button stands for */
  const closeAndRun=run=>{
    quickYes=quickExtra=null;
    dlg.close();
    if(run)run();
  };
  dlg.querySelector('#quickOk').onclick=()=>closeAndRun(quickYes);
  dlg.querySelector('#quickMore').onclick=()=>closeAndRun(quickExtra);
  // Cancel, the close button and Esc all mean "no". (The browser sends "close" a moment after the dialog shuts,
  // so check that a new question has not been opened in the meantime.)
  dlg.addEventListener('close',()=>{if(!dlg.open)quickYes=quickExtra=null;});
  quickDlg=dlg;
  return dlg;
}

/* Fills in the shared dialog and shows it on top of whatever is open.
   q = {title, text, okLabel, danger, withCancel, steps (optional list), extra (optional {label, icon, run})} */
function openQuick(q){
  const dlg=quickDialog(),ok=dlg.querySelector('#quickOk'),no=dlg.querySelector('#quickNo');
  const more=dlg.querySelector('#quickMore');
  dlg.querySelector('#quickTitle').textContent=q.title;
  dlg.querySelector('#quickBody').innerHTML=`<p class="dlg-msg">${esc(q.text)}</p>`+
    (q.steps?`<ol class="dlg-steps">${q.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:'');
  dlg.classList.toggle('narrow',!q.steps); // numbered steps get the standard width, so that each fits on a line or two
  more.hidden=!q.extra;
  more.innerHTML=q.extra?(q.extra.icon?icon(q.extra.icon):'')+esc(q.extra.label):'';
  ok.textContent=q.okLabel;
  ok.className=q.danger?'btn dng':'btn pri';
  no.hidden=!q.withCancel;
  quickYes=null;
  quickExtra=q.extra?q.extra.run:null;
  if(!dlg.open)dlg.showModal();
  (q.danger?no:ok).focus(); // Enter agrees, except when agreeing destroys something: then Enter cancels
}

function askConfirm(message,options,onYes){
  if(typeof options==='function'){onYes=options;options=null;}
  options=options||{};
  if(autoConfirm){onYes();return;}
  openQuick({title:options.title||'Please confirm',text:message,okLabel:options.action||'OK',danger:!!options.danger,withCancel:true});
  quickYes=onYes;
}

function showMessage(title,text,options){
  options=options||{};
  if(autoConfirm){autoMessages.push(title+': '+text);return;}
  openQuick({title,text,okLabel:'OK',danger:false,withCancel:false,steps:options.steps,extra:options.extra});
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
