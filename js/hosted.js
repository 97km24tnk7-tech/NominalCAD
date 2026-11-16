/* NominalCAD: the hosted copy (the program opened from a link instead of from its folder).

   The same files run in two places:
     - on the computer, from index.html. Everything works.
     - on the web, from hosted.html, which tools/make-hosted.sh writes from index.html. That page runs inside a
       locked-down frame on someone else's site, and the frame takes a few things away:
         printing            window.print() does nothing there, so there is no print window and no "Save as PDF"
         downloads           a file the page tries to save by itself never arrives
         alert / confirm     never appear (the program does not use them anywhere; see dialogs.js)
         browser storage     works, but only on that one device, and it may be refused
       Picking a file to load, pasting into a text box and copying to the clipboard from a click all still work.

   hosted.html sets  window.WOODSHOP_HOSTED = true  before any script loads. Nothing is detected while the
   program runs: HOSTED is read once, here, and every difference between the two copies is in this file:
     HOSTED            true in the hosted copy
     printPage()       what every Print button calls
     PRINT_HINT        what the status bar says about printing on the Build instructions tab
     KEEP_ADVICE       how to keep a design safe when the browser will not store it (used in two messages)
     data-hosted       an attribute for index.html: data-hosted="hide" takes an element out of the hosted copy,
                       data-hosted="only" shows it there and nowhere else

   Moving a design from the hosted copy to the computer goes through File, then Copy design as text, and
   File, then Paste design from text (js/transfer.js). Those two work in both copies. */
'use strict';

const HOSTED=window.WOODSHOP_HOSTED===true;

/* ---------- printing ---------- */
const NO_PRINT_TITLE='Printing needs the copy on your computer';
const NO_PRINT_TEXT=
  'This online copy of NominalCAD cannot print or save a PDF. You can still read every page here on screen.\n\n'+
  'To print this design:';
const NO_PRINT_STEPS=[
  'Press Copy design as text, below. (It is also in the File menu.)',
  'If you are not at your own computer, send that text to yourself in an email or a note.',
  'On your computer, open NominalCAD from its folder (the file index.html).',
  'Click File, then Paste design from text, and print from there.',
];

/* Prints the document tab that is open. Every Print button and Ctrl+P end up here. */
function printPage(){
  if(HOSTED){
    showMessage(NO_PRINT_TITLE,NO_PRINT_TEXT,{
      steps:NO_PRINT_STEPS,
      extra:{label:'Copy design as text',icon:'i-copy',run:()=>copyDesignText()}, // transfer.js; step 1, done for the person
    });
    return;
  }
  window.print();
}
/* the end of the status bar prompt on the Build instructions tab */
const PRINT_HINT=HOSTED
  ?'To print them, move the design to the copy on your computer: press How to print in the ribbon.'
  :'Press Print in the ribbon to print them.';

/* ---------- keeping a design when the browser will not store it ---------- */
const KEEP_ADVICE=HOSTED
  ?'Use File, then Copy design as text, and paste the text into an email or a note to keep your work.'
  :'Use File, then Download as a file, to keep your work.';

/* ---------- controls that belong to only one of the two copies ---------- */
document.querySelectorAll('[data-hosted]').forEach(el=>{
  const wanted=el.dataset.hosted==='only'?HOSTED:!HOSTED;
  el.hidden=!wanted;
});
