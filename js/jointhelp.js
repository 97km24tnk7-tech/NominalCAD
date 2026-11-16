/* NominalCAD: how each kind of joint is made, with a picture.

   JOINT_HELP has one card for each fastener type in JTYPES (js/joints.js): what it is, a drawing, what you
   need, the steps, and things worth knowing. jointCard(key) gives the card as HTML. It is shown when a
   highlighted joint word is clicked on a page (js/wordlinks.js) and in the Woodworking words window
   (js/glossary.js).

   To add a joint type: add its row to JTYPES, a card here under the same key, and the words that should open
   the card to WORD_LINKS in js/wordlinks.js. selfTest() fails if a fastener type has no card.

   The drawings are plain SVG, 300 x 160, drawn as a cut through the joint. Their colors come from the
   style sheet (svg.jh): .w and .w2 are the two pieces of wood, .m is metal, .g is glue, .peg a dowel,
   .hole a drilled hole, .ld a leader line from a label, .ah an arrow head, .t label text.
   Sizes in the text are written like 1-1/4 inch. */
'use strict';

/* An arrow from one point to another. Drawn as a line and a small triangle (not an SVG marker: a marker is found
   by its id, and the browser cannot see the id while the first drawing that carries it sits in a closed window). */
function jhArrow(x1,y1,x2,y2){
  const angle=Math.atan2(y2-y1,x2-x1),size=7;
  const point=(back,side)=>`${(x2-back*Math.cos(angle)-side*Math.sin(angle)).toFixed(1)} ${(y2-back*Math.sin(angle)+side*Math.cos(angle)).toFixed(1)}`;
  return`<path class="ld arrow" d="M${x1} ${y1}L${x2} ${y2}"/><path class="ah" d="M${point(0,0)}L${point(size,size/2)}L${point(size,-size/2)}z"/>`;
}
const jhSvg=(label,inner)=>`<svg class="jh" viewBox="0 0 300 160" role="img" aria-label="${label}">${inner}</svg>`;

const JOINT_HELP={
  screw:{
    title:'Wood screws',
    what:'A screw passes through the first piece and its threads grip the second. The head presses down on the first piece, so tightening the screw squeezes the two together. The everyday joint.',
    picture:jhSvg('A screw through one board into the end of another',
      '<rect class="w2" x="118" y="52" width="44" height="100"/>'+
      '<rect class="w" x="20" y="22" width="156" height="30"/>'+
      // the pilot hole is thinner than the threads, so the threads are drawn cutting into the wood beside it
      '<path class="hole" d="M137.5 22V112M142.5 22V112"/>'+
      '<path class="m" d="M131 22h18l-5 7h-8z"/><rect class="m" x="138.5" y="29" width="3" height="74"/><path class="m" d="M138.5 103h3l-1.5 7z"/>'+
      '<path class="m thread" d="M134 60l12 3M134 68l12 3M134 76l12 3M134 84l12 3M134 92l12 3"/>'+
      '<text class="t" x="26" y="41">goes through this piece</text>'+
      '<text class="t" x="20" y="100">and into this one</text><path class="ld" d="M102 97h14"/>'+
      '<path class="ld" d="M150 24l34-10"/><text class="t" x="187" y="12">head level with</text><text class="t" x="187" y="23">the surface</text>'+
      '<path class="ld" d="M148 70h34"/><text class="t" x="185" y="68">pilot hole first,</text><text class="t" x="185" y="79">thinner than the screw</text>'+
      '<path class="ld" d="M148 100h34"/><text class="t" x="185" y="104">most of the screw is</text><text class="t" x="185" y="115">in the second piece</text>'),
    need:['Drill','7/64 inch drill bit for the pilot holes (1/8 inch for oak and other hard woods)','Driver bit that fits the screw heads',
      'Wood glue (optional). It adds a lot of strength where a face or an edge is glued, and only a little on a cut end.'],
    steps:['Hold or clamp the two pieces exactly where they go.',
      'Drill a pilot hole where each screw will go, through the first piece and into the second, about as deep as the screw is long.',
      'Widen the top of each hole a little (a countersink bit does it) so the screw head can sit level with the surface.',
      'For a stronger joint, take the pieces apart, spread glue where they meet, and put them back.',
      'Drive the screws until the heads are level with the wood, then stop. Driving them deeper crushes the wood and weakens the joint.'],
    tips:['Wood splits most easily near the end of a board. Keep screws 3/4 inch or more from an end where you can. Where a screw has to be closer, as at a corner of 3/4 inch boards, the pilot hole is what prevents the split.',
      'The screw has to be shorter than the two pieces together, or its point comes out the far side. The lengths in the lists already allow for that.',
      'When the list says "driven at an angle", start the screw in the side of the first piece about 1 inch from the joint and slant it so it passes through the corner into the second piece. Drill the slanted pilot hole first.',
      'If a gap stays between the pieces, back the screw out, squeeze the pieces together with a clamp, and drive it again.']},
  pocket:{
    title:'Pocket-hole screws',
    what:'A slanted hole is drilled into the hidden side of one piece, so a screw can go out through its end and into the next piece. Strong, quick, and no screw shows.',
    picture:jhSvg('A slanted pocket hole with a screw going out the end of one board into the next',
      '<rect class="w2" x="206" y="18" width="44" height="130"/>'+
      '<rect class="w" x="26" y="58" width="180" height="38"/>'+
      '<path class="hole pocket" d="M138 96h22l46-14v-9z"/>'+
      '<path class="m screwline" d="M160 88l64-18"/><circle class="m" cx="158" cy="88.5" r="4.5"/>'+
      '<text class="t" x="32" y="74">this piece gets the pockets</text>'+
      '<path class="ld" d="M148 98v22"/><text class="t" x="60" y="132">pocket drilled with a jig,</text><text class="t" x="60" y="143">on the side nobody sees</text>'+
      '<path class="ld" d="M222 68l-30-34"/><text class="t" x="60" y="26">the screw comes out the end</text><text class="t" x="60" y="37">and into the next piece</text>'),
    need:['Pocket-hole jig, with its stepped drill bit and stop collar (the ring that clamps on the bit and sets how deep it drills)','Drill',
      'The long square-drive bit that comes with the jig','A clamp',
      'Pocket-hole screws (coarse thread for pine and plywood, fine thread for oak and other hard woods)'],
    steps:['Set the jig and the stop collar on the bit for the thickness of your board: 3/4 inch for 3/4 inch plywood or a board sold as 1x (such as a 1x4), 1-1/2 inch for a 2x4, 1/2 inch for 1/2 inch plywood.',
      'Clamp the jig on the side of the board that will be hidden, at its end, and drill the holes.',
      'Put the two pieces together where they go and clamp them so they cannot slide.',
      'Drive a pocket screw through each hole until it is snug.'],
    tips:['Use 1 inch screws for 1/2 inch wood, 1-1/4 inch screws for 3/4 inch wood and 2-1/2 inch screws for 1-1/2 inch wood.',
      'The pieces try to slide as the screw goes in. A clamp across the joint stops that.',
      'Use only pocket-hole screws. The cone-shaped head of an ordinary screw splits the pocket.']},
  dowel:{
    title:'Dowels and glue',
    what:'Short wooden pegs are glued into matching holes in both pieces. Nothing shows on the outside.',
    picture:jhSvg('Two boards about to be pushed together over a wooden peg that fits a hole in each',
      '<rect class="w" x="14" y="58" width="112" height="40"/>'+
      '<rect class="w2" x="184" y="22" width="44" height="112"/>'+
      '<rect class="hole" x="100" y="71" width="26" height="14"/><rect class="hole" x="184" y="71" width="24" height="14"/>'+
      '<rect class="peg" x="132" y="72" width="46" height="12" rx="3"/>'+
      jhArrow(58,112,104,112)+jhArrow(262,78,234,78)+
      '<path class="ld" d="M150 70l-22-28"/><text class="t" x="22" y="26">wooden peg (dowel),</text><text class="t" x="22" y="37">glue on it and in the holes</text>'+
      '<path class="ld" d="M112 87v40"/><text class="t" x="20" y="140">matching holes in both pieces,</text><text class="t" x="20" y="151">lined up with a dowel jig</text>'),
    need:['Drill','Dowel jig (it keeps the holes straight and lined up)',
      'Drill bit the size of the dowels, with a depth stop (a ring that clamps on the bit) or a piece of tape wrapped around the bit to mark how deep to drill',
      'Dowel pins in the size the list gives (short grooved pegs sold in bags, not a long dowel rod), wood glue and clamps'],
    steps:['Mark where the two pieces meet.',
      'With the jig, drill the holes in the first piece, a little deeper than half the length of a dowel. Where a hole goes into the face of a board, stop at least 1/4 inch short of the far side and drill the matching hole in the other piece deeper to make up.',
      'Drill the matching holes in the second piece. They must line up exactly, and that is the job of the jig.',
      'Put glue in the holes and where the pieces meet, push the dowels in, and bring the pieces together.',
      'Clamp it and leave it clamped at least 30 minutes. Do not put weight on the joint for a day.'],
    tips:['Try the joint dry, with no glue, first. If it will not close, a hole is too shallow or out of line.',
      'Dowels need accurate holes. On a first project, screws are more forgiving.']},
  nail:{
    title:'Brad nails and glue',
    what:'Glue does the holding. Thin nails called brads only keep the piece from sliding while the glue dries. Used for thin panels such as cabinet backs and drawer bottoms, and for the corners of small drawer boxes.',
    picture:jhSvg('A thin panel glued to the edge of a board, held by thin nails',
      '<rect class="w2" x="24" y="84" width="252" height="40"/>'+
      '<rect class="w" x="24" y="72" width="252" height="12"/>'+
      '<path class="g" d="M28 84h244"/>'+
      '<path class="m brad" d="M70 71v34M150 71v34M230 71v34"/><path class="m" d="M66 70h8v2h-8zM146 70h8v2h-8zM226 70h8v2h-8z"/>'+
      '<path class="ld" d="M40 72l-6-22"/><text class="t" x="20" y="44">thin panel</text>'+
      '<path class="ld" d="M150 68v-30"/><text class="t" x="92" y="22">a brad about every 6 inches,</text><text class="t" x="92" y="33">into the middle of the edge</text>'+
      '<path class="ld" d="M196 86l14 54"/><text class="t" x="110" y="150">glue line: this is what holds</text>'),
    need:['Wood glue','Brad nailer, or a small hammer','Brad nails (18 gauge)','A damp rag'],
    steps:['Spread a thin line of glue on the edge the panel will sit on.',
      'Lay the panel in place and line it up.',
      'Drive a brad about every 6 inches, straight down into the middle of the edge under it.',
      'Wipe off any glue that squeezes out.'],
    tips:['Aim for the middle of the edge. A brad too near the side breaks out through it.',
      'Keep your free hand several inches from where the brad goes in. A brad can curve inside the wood and come out the side.',
      'On a cabinet back, check the cabinet is square (measure corner to corner both ways) before the glue sets. The back locks the cabinet in whatever shape it is in.']},
  bracket:{
    title:'L-brackets',
    what:'A small metal corner plate is screwed to both pieces on the inside of the corner. The easiest joint there is, and easy to undo.',
    picture:jhSvg('A metal corner bracket screwed into both boards on the inside of a corner',
      '<rect class="w2" x="40" y="14" width="34" height="132"/>'+
      '<rect class="w" x="74" y="112" width="200" height="34"/>'+
      '<path class="m" d="M74 58h6v48h48v6h-54z"/>'+
      '<path class="m brad" d="M80 72h-22M80 94h-22M96 106v20M118 106v20"/>'+
      '<path class="ld" d="M82 60l40-24"/><text class="t" x="126" y="30">metal corner bracket on the</text><text class="t" x="126" y="41">inside, where it does not show</text>'+
      '<path class="ld" d="M120 124l34-44"/><text class="t" x="126" y="68">short screws into both pieces</text><text class="t" x="126" y="79">(5/8 inch for 3/4 inch wood)</text>'),
    need:['Screwdriver or drill','L-brackets (sold as corner braces) with their screws'],
    steps:['Hold the two pieces where they go.',
      'Set a bracket into the inside corner, where it will not show.',
      'Mark the holes, drill small pilot holes no more than 1/2 inch deep, and drive the screws into both pieces.'],
    tips:['Use screws shorter than the wood is thick, or they come out the other side.',
      'Brackets are fine for light shelves and boxes. For anything that carries real weight, use screws or pocket holes as well.']},
  glue:{
    title:'Glue only',
    what:'Wood glue alone, with clamps holding the pieces while it dries. Edge to edge or face to face, a good glue joint is stronger than the wood around it.',
    picture:jhSvg('Two boards glued edge to edge and squeezed together by clamps',
      '<rect class="w" x="40" y="46" width="220" height="34"/>'+
      '<rect class="w2" x="40" y="80" width="220" height="34"/>'+
      '<path class="g" d="M44 80h212"/>'+
      jhArrow(90,14,90,44)+jhArrow(210,14,210,44)+jhArrow(90,146,90,116)+jhArrow(210,146,210,116)+
      '<text class="t" x="104" y="24">clamps squeeze here</text>'+
      '<text class="t" x="52" y="66">thin, even glue on the meeting surfaces</text>'+
      '<text class="t" x="52" y="101">a thin line squeezing out: enough glue</text>'),
    need:['Wood glue','Clamps','A damp rag'],
    steps:['Check that the two surfaces meet with no gaps.',
      'Spread a thin, even layer of glue on one of them.',
      'Bring the pieces together and clamp until a thin line of glue squeezes out along the whole joint.',
      'Wipe off the squeezed-out glue. Leave it clamped at least 30 minutes. Full strength takes a day.'],
    tips:['Glue holds poorly on the cut end of a board. Ends need screws, dowels or pocket holes.',
      'No clamps? Heavy weights, tape pulled tight, or a few screws can do the squeezing.',
      'Wood glue does not set properly below about 50 degrees F, so glue in a warm room.',
      'For anything that stays outdoors or near water, buy wood glue marked water resistant or waterproof.']},
  frame:{
    title:'Framing nails',
    what:'Thick nails 3 inches long, driven straight through one board into the next. This is how the frames of walls, floors and roofs are put together: it is fast, and a nail bends where a screw of the same size would snap. Plywood is nailed to a frame with shorter nails, close together.',
    picture:jhSvg('Two nails through a flat board into the end of an upright board',
      '<rect class="w2" x="118" y="52" width="44" height="100"/>'+
      '<rect class="w" x="20" y="22" width="156" height="30"/>'+
      '<path class="m brad" d="M130 22v66M150 22v66"/><path class="m" d="M125 19h10v3h-10zM145 19h10v3h-10z"/>'+
      '<text class="t" x="26" y="41">through this piece</text>'+
      '<text class="t" x="20" y="100">into the end</text><text class="t" x="20" y="111">of this one</text><path class="ld" d="M84 102h32"/>'+
      '<path class="ld" d="M154 20l28-8"/><text class="t" x="185" y="12">head tight against the</text><text class="t" x="185" y="23">wood, not sunk into it</text>'+
      '<path class="ld" d="M152 76h30"/><text class="t" x="185" y="74">half of the nail or more</text><text class="t" x="185" y="85">in the second piece</text>'),
    need:['Hammer of about 20 ounces, or a framing nailer','The nails the list names: 3 inch nails (sold as 10d) for boards, 2-1/2 inch nails (sold as 8d) for plywood',
      'Safety glasses'],
    steps:['Mark where the second piece goes on the first one, so that you can see where to nail when it is covered.',
      'Hold the two pieces where they go. A helper, a clamp or your foot keeps them from sliding.',
      'Start each nail with a light tap, take your fingers away, then drive it home with full swings.',
      'Stop when the head is tight against the wood. For plywood, drive a nail every 6 inches along the edges of the sheet and every 12 inches into the boards behind the rest of it.'],
    tips:['Keep nails 3/4 inch or more from the end of a board, and do not put two in the same line of grain, or the board splits. Tapping the point of a nail flat with the hammer first also helps.',
      'On plywood, keep nails 3/8 inch in from the edge of the sheet and do not sink the heads below the surface: a sunk head has cut through the top layers and holds much less.',
      'A long screw can stand in for a nail where the list allows it, but an ordinary screw is brittle. For framing use screws sold as structural or construction screws.',
      'Wear safety glasses. A nail struck off center can fly.']},
  toenail:{
    title:'Nails driven at an angle (toenailing)',
    what:'When a board stands on another board that is already fixed in place, you cannot nail up through the lower one. So the nails go in at a slant, through the side of the standing board, near its foot, and down into the board under it.',
    picture:jhSvg('An upright board standing on a flat board, held by two nails that slant in through its sides',
      '<rect class="w" x="30" y="112" width="240" height="34"/>'+
      '<rect class="w2" x="128" y="14" width="44" height="98"/>'+
      '<path class="m brad" d="M112 72l34 56M188 72l-34 56"/><circle class="m" cx="112" cy="72" r="3"/><circle class="m" cx="188" cy="72" r="3"/>'+
      '<text class="t" x="16" y="26">this piece stands</text><text class="t" x="16" y="37">on the other one</text><path class="ld" d="M98 30h28"/>'+
      '<path class="ld" d="M192 70l22-14"/><text class="t" x="188" y="38">start about 1 inch up,</text><text class="t" x="188" y="49">slanted steeply down</text>'+
      '<text class="t" x="40" y="134">one nail from each side</text>'),
    need:['Hammer','The nails the list names (3 inch nails, sold as 10d)','Safety glasses'],
    steps:['Stand the board on its mark. Put your foot or a block against the far side, because the first nail will push it along.',
      'Start a nail in the side of the standing board, about 1 inch above its foot, pointing almost straight in. After two taps, tip it to slant steeply downward.',
      'Drive it through the corner of the standing board and into the board under it.',
      'Drive the next nail the same way from the opposite side. It pushes the board back onto its mark.'],
    tips:['If the board has moved off its mark after the first nail, the nail from the other side brings it back. Check the mark before you drive the last one home.',
      'A nail started too low splits the corner off the board. If that happens, start again 1/2 inch higher.',
      'Where wind can lift the roof, a toenail alone is not enough at a rafter: add the metal tie the list names.']},
};

/* one card as HTML: what it is, the drawing, what you need, the steps, good to know */
function jointCard(key){
  const card=JOINT_HELP[key];
  if(!card)return'';
  const list=(items,tag)=>`<${tag}>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</${tag}>`;
  return`<div class="jcard"><p>${esc(card.what)}</p>${card.picture}`+
    `<h4>You need</h4>${list(card.need,'ul')}<h4>How to do it</h4>${list(card.steps,'ol')}<h4>Good to know</h4>${list(card.tips,'ul')}</div>`;
}

SELFTESTS.push(function jointCards(problems){
  for(const key of Object.keys(JTYPES)){
    if(key==='none')continue;                 // "not joined" is not a joint to make
    const card=JOINT_HELP[key];
    if(!card){problems.push(`joint help: no card in js/jointhelp.js for the fastener type "${key}"`);continue;}
    if(!card.picture||!card.steps.length||!card.need.length)problems.push(`joint help: the card for "${key}" is missing its picture, its steps or its list of tools`);
    if(/undefined|NaN/.test(jointCard(key)))problems.push(`joint help: the card for "${key}" contains "undefined" or "NaN"`);
  }
});
