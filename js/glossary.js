/* NominalCAD: woodworking words, explained for someone to whom it is all just wood.

   TERMS is the whole vocabulary. An entry with `match` explains a kind of piece: termFor('Long apron') finds
   the Apron entry. Entries without `match` are general words (pilot hole, flush, nominal size).
   The explanations show up in four places, all meant for Beginner (js/level.js) and hidden in Expert:
     - "Words used in this design" at the top of the Cut list and Build instructions pages (wordsSection),
       with a Show me button that picks those pieces out in the 3D view;
     - one line in Properties when a single piece is selected (termLine);
     - a tip when the pointer rests on a piece name in the Pieces list or on a page;
     - the Woodworking words window (openWords), from Help or the button beside the Beginner / Expert switch,
       which is there at both levels.

   To add a word: add an entry to TERMS. Piece entries are tried from the top, so put the more exact name first
   ("Wall cleat" above "Cleat"). selfTest() fails if a preset uses a piece name that no entry explains.
   Write for a first-time builder: where the piece is, then what it does, in one or two sentences, and use no
   other trade word unless it is explained in the same sentence. */
'use strict';

const TERM_GROUPS=[
  ['parts','Parts of furniture'],
  ['shed','Parts of a shed'],
  ['bought','Things you buy, shown for fit'],
  ['join','Joining pieces'],
  ['measure','Measuring and cutting'],
  ['lumber','Lumber and sheets']];

const TERMS=[
  /* ---- pieces: the more exact name first ---- */
  {word:'Drawer front',group:'parts',match:/^drawer front$/i,
    what:'The face of a drawer that you see: a board screwed onto the front of the drawer box from inside the drawer. It covers the gap around the box and carries the handle.'},
  {word:'Drawer box',group:'parts',match:/^drawer (box|side|bottom)/i,
    what:'The box that slides in and out: two sides, a front, a back and a thin bottom. It carries what you put in the drawer and rides on the slides.'},
  {word:'Toe kick',group:'parts',match:/\btoe kick\b/i,
    what:'The board under the front of a cabinet, set back a couple of inches so your toes fit under it when you stand close. It also holds up the front of the bottom panel.'},
  {word:'Apron',group:'parts',match:/\bapron\b/i,
    what:'A board standing on its edge between two legs, right under the top. Aprons tie the legs together so a table or bench cannot wobble, and the top is fastened to them. Long aprons run the length, short aprons run across the ends.'},
  {word:'Stretcher',group:'parts',match:/\bstretcher\b/i,
    what:'A board that runs from leg to leg lower down, nearer the floor. It stops the legs spreading or leaning, and often carries a lower shelf.'},
  {word:'Wall cleat',group:'parts',match:/\bwall cleat\b/i,
    what:'A strip of wood screwed flat to the wall, into the wall studs. The shelf sits on it or is screwed to it, so the wall carries the weight.'},
  {word:'Cleat',group:'parts',match:/\bcleat\b/i,
    what:'A strip of wood fastened to one piece so that another piece can rest on it. On a bed, a cleat runs along the inside of each side rail and the slats sit on the cleats.'},
  {word:'Slat',group:'parts',match:/\bslat\b/i,
    what:'One of a row of narrow boards laid side by side with gaps between them, to make a shelf, the base of a bed or the bottom of a planter. The gaps save wood and let air or water through.'},
  {word:'Deck',group:'parts',match:/\bdeck\b/i,
    what:'A sheet of plywood laid flat over a frame to make one solid surface. A shelf deck is what the tanks stand on, a floor deck is the floor of a shed, and a roof deck is what the roofing is nailed to.'},
  {word:'Shelf',group:'parts',match:/\bshelf\b/i,
    what:'A flat piece that things sit on. It is held at its two ends by the sides, or it rests on the rails or stretchers under it.'},
  {word:'Top',group:'parts',match:/\bcountertop\b|^top( board)?$/i,
    what:'The flat surface you use, on top of everything else. "Top board" means the top is made of several boards laid side by side.'},
  {word:'Brace',group:'parts',match:/\bbrace\b/i,
    what:'A board fastened across the back of a frame. It stops the frame leaning over sideways, the way a cardboard box with no ends folds flat.'},
  {word:'Cross piece',group:'parts',match:/\bcross piece\b/i,
    what:'A short board that runs from front to back between the two long boards of a frame. It holds them the right distance apart and stops them twisting under weight.'},
  {word:'Beam',group:'parts',match:/\bbeam\b/i,
    what:'A long, strong board that carries weight across an open space. The center beam of a bed runs from head to foot down the middle and holds up the middle of the slats.'},
  {word:'Top plate and bottom plate',group:'shed',match:/\b(top|bottom) plate\b/i,
    what:'The two horizontal boards of a wall frame. The bottom plate lies on the floor, the top plate runs along the top, and the upright studs stand between them.'},
  {word:'Rim joist',group:'shed',match:/\brim joist\b/i,
    what:'The board that runs around the outside edge of a floor frame. The ends of the floor joists are nailed to it.'},
  {word:'Floor joist',group:'shed',match:/\bjoist\b/i,
    what:'One of the boards standing on edge under a floor, evenly spaced, that carry the floor and everything on it.'},
  {word:'Stud',group:'shed',match:/\bstud\b/i,
    what:'An upright board in a wall frame. Studs are spaced evenly, usually 16 or 24 inches apart, and carry the roof down to the floor.'},
  {word:'Cripple',group:'shed',match:/\bcripple\b/i,
    what:'A short stud above a door or window opening, or below a window. It fills the space so the wall covering has something to be nailed to.'},
  {word:'Header',group:'shed',match:/\bheader\b/i,
    what:'A strong horizontal piece over a door or window opening. It carries the weight from above across the opening to the studs on each side.'},
  {word:'Sill',group:'shed',match:/\bsill\b/i,
    what:'The horizontal board along the bottom of a window opening.'},
  {word:'Skid',group:'shed',match:/\bskid\b/i,
    what:'A heavy timber laid on the ground, or on blocks, that the whole shed sits on. Skids keep the floor off the dirt and make the shed possible to level.'},
  {word:'Rafter',group:'shed',match:/\brafter\b/i,
    what:'One of the sloping boards that hold up the roof. Rafters run from the top of one wall up and over to the other, evenly spaced.'},
  {word:'Rim',group:'parts',match:/\brim\b/i,
    what:'A low strip around the edge of a tray. It keeps things from sliding off.'},
  {word:'Rail',group:'parts',match:/\brail\b/i,
    what:'A horizontal board in a frame. In a tank rack the rails run left to right and carry the tanks to the uprights. In a cabinet the top rails tie the two sides together and the top is screwed to them. On a bed the side rails and end rails make the frame around the mattress.'},
  {word:'Upright or post',group:'parts',match:/\b(upright|post)\b/i,
    what:'A piece standing straight up that carries weight down to the floor. The weight should rest on top of it, not hang from screws driven into its side.'},
  {word:'Leg',group:'parts',match:/\bleg\b/i,
    what:'An upright piece that holds the furniture up off the floor. A center leg is an extra one in the middle so a long piece does not sag.'},
  {word:'Foot',group:'parts',match:/\bfoot\b/i,
    what:'A piece at the very bottom that an upright stands on. It spreads the weight over more of the floor.'},
  {word:'Side panel',group:'parts',match:/\bside panel\b/i,
    what:'A thin sheet that covers the side of a frame to close it in. It is there for looks and to keep things in. It does not hold anything up.'},
  {word:'Back panel',group:'parts',match:/\bback( panel)?$/i,
    what:'The sheet across the back of a cabinet, bookshelf or box. It closes the back and, more important, it keeps the whole thing square so it cannot lean over sideways.'},
  {word:'Side, end and front',group:'parts',match:/^(side|long side|end|front)$/i,
    what:'The upright walls of a cabinet, bookshelf or box. A cabinet has a left and a right side, and its shelves are fastened between them. A box or planter has two long sides (or a front and a back) and two ends.'},
  {word:'Bottom',group:'parts',match:/^bottom$/i,
    what:'The panel at the bottom of a cabinet or box that everything inside sits on.'},
  {word:'Door',group:'parts',match:/\bdoor\b/i,
    what:'A panel that swings on hinges to close an opening.'},
  {word:'Lid',group:'parts',match:/\blid\b/i,
    what:'A top that lifts off, or swings up on hinges, to open a box.'},
  {word:'Seat',group:'parts',match:/\bseat\b/i,
    what:'The board you sit on.'},
  {word:'Support',group:'parts',match:/\bsupport\b/i,
    what:'A piece under a shelf that holds up its front edge, the way a bracket does.'},
  {word:'Tray',group:'parts',match:/\btray\b/i,
    what:'The flat floor of a bird feeder, where the seed goes.'},
  {word:'Roof board',group:'parts',match:/\broof board\b/i,
    what:'One of the two boards that lean together to make a small sloping roof.'},
  {word:'Tank',group:'bought',match:/^tank$/i,
    what:'The aquarium. You buy it. It is drawn so you can see that it fits and so its filled weight is counted.'},
  {word:'Light',group:'bought',match:/^light$/i,
    what:'The aquarium light. It is drawn so you can check there is room for it, and for your hand, above the tank.'},
  {word:'Mattress',group:'bought',match:/^mattress$/i,
    what:'Drawn so you can see that the bed fits it. It is not in the cut list.'},
  {word:'Window',group:'bought',match:/^window$/i,
    what:'A window you buy and set into the opening framed for it. It is not in the cut list.'},

  /* ---- joining pieces ---- */
  {word:'Fastener',group:'join',
    what:'Anything that holds two pieces together: a screw, a nail, a wooden peg, a metal bracket, or glue.'},
  {word:'Pilot hole',group:'join',
    what:'A thin hole drilled where a screw will go, before the screw goes in. Without it the screw can split the wood, most of all near an end. For a #8 screw use a 1/8 inch drill bit.'},
  {word:'Countersink',group:'join',
    what:'A small cone-shaped hollow at the top of a pilot hole, so the head of the screw ends up level with the wood instead of sticking up.'},
  {word:'Butt joint',group:'join',
    what:'The simplest joint there is: the end or edge of one piece pushed up against another piece and fastened with screws, nails or glue.'},
  {word:'Pocket hole',group:'join',
    what:'A hole drilled at a slant into the hidden side of a board, using a guide called a pocket-hole jig. A screw goes through it and out the end of the board into the next piece. It makes a strong joint with no screw showing.'},
  {word:'Brad nail',group:'join',
    what:'A thin nail with a tiny head. Brads hold a piece in place while the glue dries. The glue does the real holding.'},
  {word:'Dowel',group:'join',
    what:'A short round wooden peg glued into matching holes in two pieces, so nothing shows on the outside.'},
  {word:'L-bracket',group:'join',
    what:'A small metal corner plate screwed into both pieces on the inside of a corner. The easiest joint to make.'},
  {word:'Clamp',group:'join',
    what:'A tool that squeezes pieces together and holds them still while you drill, screw, or wait for glue to dry.'},
  {word:'Hinge',group:'join',
    what:'The metal joint a door or lid swings on. One half screws to the door, the other to the frame.'},
  {word:'Drawer slide',group:'join',
    what:'A pair of metal runners, one for each side of a drawer. One half of each screws to the cabinet and the other half to the drawer, and the drawer rolls in and out on them.'},
  {word:'Racking',group:'join',
    what:'A frame leaning over sideways until its square corners become slanted, like a box folding flat. A back panel, a brace or a glued-on top stops it.'},

  /* ---- measuring and cutting ---- */
  {word:'Face, edge and end',group:'measure',
    what:'The three kinds of surface on a board. The two faces are the wide sides. The two edges are the narrow sides. The two ends are where it was cut across. "On edge" means standing on a narrow side, "flat" means lying on a wide side.'},
  {word:'Flush',group:'measure',
    what:'Two surfaces exactly level with each other, with no step between them. Run a finger across the joint: you should not feel it.'},
  {word:'Square',group:'measure',
    what:'A corner of exactly 90 degrees, like the corner of a sheet of paper. To check a frame or a cabinet, measure corner to corner both ways. When the two numbers match, it is square.'},
  {word:'Set back',group:'measure',
    what:'Moved in from an edge by a stated amount. "Set back 2 inches from the front" means 2 inches behind the front edge.'},
  {word:'Overhang',group:'measure',
    what:'How far one piece sticks out past the piece under it, like a table top past its legs.'},
  {word:'Clearance',group:'measure',
    what:'Empty space left on purpose so something can move or fit: around a drawer, above a fish tank for your hand, behind a door.'},
  {word:'Crosscut and rip cut',group:'measure',
    what:'A crosscut goes across a board to make it shorter. A rip cut goes along a board to make it narrower. Crosscuts are easy with any saw. Rip cuts want a table saw or a circular saw with a guide.'},
  {word:'Kerf',group:'measure',
    what:'The slot of wood the saw blade turns into dust, about 1/8 inch wide. The cutting diagrams leave room for it between pieces.'},
  {word:'Cut list',group:'measure',
    what:'The list of every piece to cut, with its size and the letter to pencil on it. The same letters are used in the cutting diagrams and the steps.'},
  {word:'On center',group:'measure',
    what:'Measured from the middle of one piece to the middle of the next. Studs "16 inches on center" have their middles 16 inches apart.'},
  {word:'Level and plumb',group:'measure',
    what:'Level means perfectly flat, like still water. Plumb means perfectly straight up and down. A bubble level checks both.'},
  {word:'Roof pitch',group:'measure',
    what:'How steep a roof is, given as the inches it rises for every 12 inches it runs across. "4 in 12" is a gentle slope, "12 in 12" is 45 degrees.'},

  /* ---- lumber and sheets ---- */
  {word:'Nominal size and actual size',group:'lumber',
    what:'A board is sold by a name, like 2x4, that is bigger than the board really is. That name is the nominal size. A 2x4 really measures 1 1/2 by 3 1/2 inches: its actual size. NominalCAD always draws and lists the actual size.'},
  // the last piece entry on purpose: a piece you drew yourself is called "Board" until you rename it
  {word:'Board',group:'lumber',match:/\bboard\b/i,
    what:'A length of solid lumber, sold by its nominal size and its length, such as a 2x4 that is 8 feet long.'},
  {word:'Plywood sheet',group:'lumber',
    what:'A wide, flat panel made of thin layers of wood glued together, sold as a sheet 4 feet by 8 feet. It is named by its thickness: 3/4 inch for cabinet sides and tops, 1/2 inch for drawer boxes and decks, 1/4 inch for backs and drawer bottoms.'},
  {word:'Grain',group:'lumber',
    what:'The lines in wood, which run the length of a board. Wood is strong along the grain and splits easily along it, which is why screws near an end need a pilot hole.'},
  {word:'Hardware',group:'lumber',
    what:'Everything you buy that is not wood or finish: screws, nails, hinges, drawer slides, handles, brackets.'},
  {word:'Sandpaper grit',group:'lumber',
    what:'The number on sandpaper. A low number (80) is coarse and removes wood fast. A high number (180, 220) is fine and leaves it smooth. Work from low to high.'},
  {word:'Finish',group:'lumber',
    what:'What goes on the bare wood at the end to protect it and make it look good: paint, stain (color) or a clear coat such as polyurethane.'},
];

/* the entry that explains a piece of this name, or null */
function termFor(name){
  return TERMS.find(term=>term.match&&term.match.test(name))||null;
}
/* "Apron: A board standing on its edge..." for a tip */
const termTip=term=>`${term.word}: ${term.what}`;

/* ---------- on the pages: "Words used in this design" ---------- */
/* The piece words of the design on screen, in the order they first appear, each with the piece names that use it. */
function termsInDesign(){
  const found=new Map();
  for(const part of S.parts){
    const term=termFor(part.name);
    if(!term)continue;
    if(!found.has(term))found.set(term,new Set());
    found.get(term).add(part.name);
  }
  return found;
}
function wordsSection(){
  const found=termsInDesign();
  if(!found.size)return'';
  const rows=[...found.entries()].map(([term,names])=>{
    const others=[...names].filter(name=>name.toLowerCase()!==term.word.toLowerCase());
    return`<dt>${esc(term.word)}${others.length?` <small>${esc(others.join(', '))}</small>`:''}`+
      ` <button class="lnk noprint" data-show-term="${TERMS.indexOf(term)}" title="Pick these pieces out in the 3D view">Show me</button></dt>`+
      `<dd>${esc(term.what)}</dd>`;
  }).join('');
  return`<section class="words" data-beginner><h2>Words used in this design</h2>`+
    `<p class="hint">New to woodworking? These are the names this design gives its pieces. `+
    `<button class="lnk noprint" data-open-words>All woodworking words</button></p>`+
    `<dl class="terms">${rows}</dl></section>`;
}
/* Show me: go to the Design tab with every piece of that word selected and in view */
function showTermPieces(term){
  const ids=S.parts.filter(part=>termFor(part.name)===term&&!hiddenIds.has(part.id)).map(part=>part.id);
  if(!ids.length)return toast('Those pieces are hidden. Use Display, then Show everything.');
  setTab('design');
  sel=new Set(ids);
  renderAll();
  focusSel();
  toast(`${ids.length} piece${ids.length>1?'s':''} selected: ${term.word.toLowerCase()}`);
}

/* ---------- in Properties: one line about the selected piece ---------- */
function termLine(part){
  const term=termFor(part.name);
  if(!term)return'';
  return`<div class="note termline" data-beginner><b>${esc(term.word)}.</b> ${esc(term.what)}</div>`;
}

/* ---------- tips on piece names (Pieces list, cut list, steps) ---------- */
/* When the pointer comes to rest on text that is exactly the name of a piece in the design (or several names with
   commas, as the cut list writes them), the browser's own tip explains the word. Beginner only. */
let pieceNames={at:0,set:new Set()};
function currentPieceNames(){
  const now=Date.now();
  if(now-pieceNames.at>1000)pieceNames={at:now,set:new Set(S.parts.map(part=>part.name))};
  return pieceNames.set;
}
document.addEventListener('mouseover',event=>{
  const el=event.target;
  if(level!=='beginner'||!el.closest||el.title||el.children.length||!el.closest('#left,.page'))return;
  const text=el.textContent.trim();
  if(!text||text.length>60)return;
  const names=text.split(', '),known=currentPieceNames();
  if(!names.every(name=>known.has(name)))return;
  const terms=[...new Set(names.map(termFor).filter(Boolean))];
  if(terms.length)el.title=terms.map(termTip).join('\n\n');
});

/* ---------- the Woodworking words window ---------- */
function renderWords(filter){
  const wanted=(filter||'').trim().toLowerCase();
  const fits=term=>!wanted||term.word.toLowerCase().includes(wanted)||term.what.toLowerCase().includes(wanted);
  const inDesign=termsInDesign();
  // first, how each joint is made (js/jointhelp.js): a row for each that opens to its drawing and steps
  const cards=Object.entries(JOINT_HELP).filter(([,card])=>!wanted||(card.title+' '+card.what).toLowerCase().includes(wanted));
  const joints=cards.length?`<div class="sec">How each joint is made</div>`+
    cards.map(([key,card])=>`<details class="jd"><summary>${esc(card.title)}</summary>${jointCard(key)}</details>`).join(''):'';
  const html=joints+TERM_GROUPS.map(([key,title])=>{
    const terms=TERMS.filter(term=>term.group===key&&fits(term)).sort((a,b)=>a.word.localeCompare(b.word));
    if(!terms.length)return'';
    return`<div class="sec">${esc(title)}</div><dl class="terms">`+
      terms.map(term=>`<dt>${esc(term.word)}${inDesign.has(term)?' <small>in this design</small>':''}</dt><dd>${esc(term.what)}</dd>`).join('')+`</dl>`;
  }).join('');
  $('#wordsList').innerHTML=html||'<p class="dlg-msg">No word matches that. Try a shorter word.</p>';
}
function openWords(){
  $('#wordsFind').value='';
  renderWords('');
  $('#wordsDlg').showModal();
}
$('#wordsFind').addEventListener('input',event=>renderWords(event.target.value));
document.addEventListener('click',event=>{
  const target=event.target.closest?event.target.closest('[data-open-words],[data-show-term]'):null;
  if(!target)return;
  if(target.hasAttribute('data-open-words')){
    const help=$('#helpDlg');
    if(help.open)help.close();
    openWords();
  }else showTermPieces(TERMS[+target.dataset.showTerm]);
});

SELFTESTS.push(function woodworkingWords(problems){
  // every piece name any preset can produce (its defaults, and each choice of each option) must be explained
  const unexplained=new Set();
  for(const preset of PRESETS){
    const defaults={};
    for(const field of preset.params)if(!field.head)defaults[field.k]=field.v;
    const forms=[defaults];
    for(const field of preset.params){
      if(field.opts)for(const option of field.opts)forms.push({...defaults,[field.k]:option[0]});
      if(field.check)forms.push({...defaults,[field.k]:!field.v});
    }
    for(const form of forms){
      let parts=[];
      try{parts=preset.build(form);}catch(e){}
      for(const part of parts)if(!termFor(part.name))unexplained.add(`${part.name} (${preset.name})`);
    }
  }
  if(unexplained.size)problems.push('words: no explanation in js/glossary.js for: '+[...unexplained].slice(0,12).join(', '));
  for(const term of TERMS){
    if(!TERM_GROUPS.some(group=>group[0]===term.group))problems.push(`words: "${term.word}" is in no group`);
    if(!term.what||term.what.length<20||/undefined|NaN/.test(term.what))problems.push(`words: "${term.word}" has no real explanation`);
  }
  // on the page: shown to a beginner, hidden from an expert, and Properties says what the selected piece is
  const partsOnScreen=S.parts;
  S.parts=[mk('Long apron','1x4',[20,3.5,.75],[0,0,0]),mk('Leg','2x2',[1.5,20,1.5],[0,0,0])];
  const html=wordsSection();
  S.parts=partsOnScreen;
  if(!/data-beginner/.test(html)||!/<dt>Apron/.test(html)||!/<dt>Leg/.test(html))problems.push('words: the "Words used in this design" section does not explain an apron and a leg');
  if(!/data-beginner/.test(termLine({name:'Wall cleat'})))problems.push('words: Properties has no line for a wall cleat');
  renderWords('apron');
  if(!/Apron/.test($('#wordsList').textContent))problems.push('words: finding "apron" in the Woodworking words window shows nothing');
  renderWords('');
});
