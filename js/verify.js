/* NominalCAD: the structural check. "Will it stand, or is it held up with hopes and dreams?"

   Rule-of-thumb checks, deliberately conservative. They are not an engineer's certification, and the wording
   shown to people must stay honest about that. This file is pure: no page, no 3D scene, no project state.
   The same input always gives the same answer.

   ---------------------------------------------------------------------------------------------------------
   THE API (stable; presets, the Check my design command and selfTest all go through it)

   verifyDesign(parts, options)  ->  { ok, clean, problems, notes, facts, skipped }
       parts    the pieces of a design (S.parts, or what a preset's build(p) returns; ids may all be 0)
       options  { uses, wall, hung, joints, namedJoints, style, wallFixed, maxPieces }, all optional:
           uses       { 'Piece name': 'key of USES' }   what each load-carrying piece is for
           wall       [ 'Piece name', ... ]              pieces that are screwed to the wall studs
           hung       [ 'Piece name', ... ]              pieces that hang on bought hardware (drawer slides, hinges)
                                                         screwed to a neighbouring piece: see WHAT IS ASSUMED
           joints     { 'idA-idB': 'screw' }             fasteners chosen by hand (S.joints)
           namedJoints [['Side','Top','glue'], ...]      fasteners a preset names by piece name (its `joints`); used for
                                                         pieces that are not in a project yet, where joints has no keys
           styled     { 'idA-idB': 'pocketUnlessRustic' } joints whose fastener follows the style (S.styled, STYLE_RULES
                                                         in js/joints.js); a rule in namedJoints is read the same way
           style      'std'                              the build style (S.look.style); it nudges default fasteners
                                                         and picks the fastener of a style rule
           hardware   [ {on: idA, to: idB}, ... ]        the hardware that is really placed in the design and holds one
                                                         piece to another (hinges, drawer slides), and the pieces a
                                                         preset declares as hung, each with the piece it hangs from.
                                                         Given (a project on screen: holdPairs in js/holds.js makes
                                                         it from HOLD_SOURCES), nothing else is assumed: a door with
                                                         no hinge in this list is not held. Left out (pieces that are
                                                         not in a project, or a project from before hardware was
                                                         drawn), the hardware is assumed: see WHAT IS ASSUMED
           wallFixed  false                              true: the whole design is tied back to the wall so it cannot tip
           stand      false                              true: the design is an aquarium stand, and a long one needs
                                                         center posts ('center-posts', STAND_RULES); a set says it as
                                                         sets[n].stand (a set saved before that is read from its preset)
           sets       { 3: { uses, wall, hung, wallFixed } }  what each preset placed in the project declared, under the
                                                         number its pieces carry (piece.set). A piece with a set is read
                                                         by that entry alone; uses, wall and hung above are for the pieces
                                                         without one (drawn by hand, or from an older project file)
           maxPieces  VERIFY_MAX_PIECES                  above this the slow checks are skipped
           wallScrews [ {on: id or piece, at: [x,y,z], hold}, ... ] the screws into the wall studs that are really in the
                                                         design (hold: the lb it is counted for, wallScrewHold; when it
                                                         is left out, WALL_SCREW_RULES.hold) (hardware of kind 'wallscrew', js/hardware.js; for a
                                                         preset not placed yet, the ones its wallScrews(vals, parts)
                                                         says placing it will drive). A piece with one in it is held
                                                         by the wall. A design that declares WALL_BY_SCREWS in its wall
                                                         list is held by these screws only, and must have as many as
                                                         WALL_SCREW_RULES asks: see 'wall-screws'
       ok        true when there is no "stop"
       clean     true when there is no problem at all (what a preset must reach at its default sizes)
       problems  [{ level, code, ids, text, fix }]
                   level  'stop' = cannot work as drawn;  'warn' = works but is marginal
                   code   a short stable name, listed below
                   ids    the ids of the pieces involved (for parts without ids: their place in the list, from 1)
                   text   one or two plain sentences that name the pieces, in inches
                   fix    what to change
       notes     [{ level:'note', code, ids, text, fix }]  worth knowing but not a problem: pairs of pieces that touch
                 with no fastener while both are held by other joints (code 'unjoined'), and square pieces that run
                 into each other and were taken as notched together (code 'overlap'). Never fails a preset.
       facts     { pieces, woodPieces, weight, woodWeight, loadWeight, centerOfMass:[x,y,z], tallest, size:[w,h,d],
                   footprint:{x:[lo,hi], z:[lo,hi], width, depth} or null, wallFastened, uses:{name:key}, guessed:[names],
                   leftOut, onHardware:[names] }
                 (weights in lb, everything else in inches; uses is what each horizontal piece was checked as;
                 leftOut is how many pieces could not be read and were left out, see 'bad-piece'; onHardware
                 names the kinds of piece that were found hanging on bought hardware)
       skipped   '' or one sentence saying the slow checks were skipped because the design is too big
       It never throws, whatever it is handed: not a list, pieces with sizes that are not numbers, an unknown
       material, a rotation that is not a rotation. What it cannot read it leaves out and reports.

   verifyOptionsOf(project)       the options for a project (S): its sets, joints, style, wallFixed, and the older
                                  project-wide uses, wall list and hung list
   presetOptions(preset, vals)    the options a preset declares (uses, wall, hung, wallFixed); uses, wall and hung may be
                                  functions of the form values
   presetDefaults(preset)         { key: default value } of a preset's form
   checkPreset(preset, vals, parts, extra)
       -> { parts, problems, stops, warns, refused, facts, skipped }
       builds the preset (unless parts is given), runs its own check(p) and verifyDesign, and returns everything
       together. refused is true when check(p) itself returned a "stop".

   beamCheck(section, span, load, useKey) -> { stress, sag, allowStress, allowSag, stressRatio, sagRatio, ratio }
       THE one place bending is worked out. section comes from sectionOf(breadth, depth, isPlywood); span in
       inches; load in lb per inch of span, spread evenly; useKey picks the limits from USES. ratio above 1 is over.
   maxSpanFor(section, load, useKey)      the longest span that stays inside both limits
   sectionOf(breadth, depth, isPlywood)   { b, d, A, S, I } of a rectangle bending about its breadth
   postSafeLoad(materialId, length)       what a post or upright under fish tanks may carry, in lb; less when it is long and thin

   HOW A PRESET USES IT (the preset rule; see README.md)
       { name, params, build(p),
         uses:  { 'Shelf':'books', 'Top':'tableTop' },   // by piece name; a key of USES below
         wall:  [ 'Wall cleat' ],                         // optional: pieces screwed to the wall (those of that name at the back),
                                                          // or wall: true when the whole thing is tied back to the wall studs
         hung:  [ 'Drawer side' ],                        // optional: pieces that hang on bought hardware (slides, hinges)
         wallScrews(vals, parts),                         // optional, with wall: [WALL_BY_SCREWS]: the screws into the studs placing it drives
         check(p) { return [{ level:'stop', text:'...', fix:'...' }]; } }   // optional: inputs that cannot work
       and limits on its numbers: num('W', 'Width', 32, 12, 36)   (minimum 12", maximum 36")

   PROBLEM CODES
       floating        a piece touches nothing                         stop
       unsupported     held by nothing that reaches the floor or wall  stop   (fastened only to a 1/4" panel counts as nothing;
                                                                       so does framing lumber nailed only to plywood, and
                                                                       hardware with no piece beside it to screw to, even
                                                                       when the other side of the drawer still has its slide)
       spread          one of a pair of rafters that lean on each      stop   (however short the rafters are)
                       other with no tie across their feet, or a
                       pair flatter than 3 in 12
       ridge           a tied pair of rafters that only touch at       warn
                       their tips: no ridge board, gusset or collar
       loose          only rests on something, nothing fixes it       warn
       tips-off        rests with its middle past its support          stop
       cantilever      held at one end only by its fasteners, or       stop when it carries a load,
                       screwed to the wall by a thin back edge         warn when it carries only itself
       span            too long between supports for its load          stop or warn (sag only); a piece that carries
                                                                       nothing is checked for its own weight
       overhang        sticks out too far past its last support        stop or warn
       span-cap        longer than a tank rail of that size may be     stop
       post-load       a post carries more tank weight than it should  stop
       tank-floating   a tank rests on nothing                         stop
       tank-overhang   a tank hangs over the edge of its shelf         warn
       tank-on-screws  a rail or a shelf under tanks hangs on          warn, or stop above 300 lb
                       fasteners alone
       end-bearing     an end of a rail under tanks sits on less       stop
                       than 1 1/2" of wood
       rail-joint      two rails under tanks meet end to end with      stop
                       nothing screwed across them, or with a deck
                       seam on the joint (RAIL_RULES)
       center-posts    an aquarium stand (options.stand, sets[n].stand) stop
                       48" or longer has a rail under tanks that runs
                       more than 36" between uprights (STAND_RULES)
       post-offset     an upright under tanks does not stand straight  stop
                       over an upright, a post or a frame on the floor
       tips-over       the weight is centered outside the footprint    stop
       tips-under-load a push on an overhanging part tips it           stop or warn (a person's weight on a seat or floor)
       top-heavy       tall and shallow: fasten it to the wall         warn above 4 times its base, stop above 10 times
       wall-screws     held by wall screws (WALL_BY_SCREWS), too tall  stop
                       to stand free, and a part of it that stands on
                       its own has fewer screws into the studs than
                       WALL_SCREW_RULES asks, or they leave a stretch
                       of the top unheld
       racking         nothing stops the frame leaning sideways, or    warn
                       nothing is fastened across a row of rafters
       glue-end-grain  a glue-only end-grain joint carries load        warn
       wall-gap        marked as on the wall but not at the back       warn
       bad-piece       pieces that could not be read were left out     warn
       input           from a preset's own check(p)                    stop or warn
       unjoined        two pieces touch with no fastener, both held    a note, not a problem
       overlap         two square pieces run into each other           a note, not a problem

   WHAT IS ASSUMED
     - Square-set pieces: findJoints() / jointOfPair() say where faces touch and the Fasteners tab's fastener for
       each pair. "Not joined" still carries weight straight down when one piece sits on top of the other.
     - Rotated pieces: the Fasteners tab cannot pick a fastener for a piece that is not square to the others, so a
       rotated piece that touches (or runs into) another wooden piece is taken as screwed to it. Put
       'idA-idB':'none' in options.joints to say otherwise. Where one lies on top of the other (a rafter on a
       wall plate, a roof deck on a rafter) the lower one carries the upper one and its span is checked. Where
       they pass side by side (a brace across the back of a post) the joint holds them together and counts for
       racking, but the rotated piece is not counted as carrying anything.
       A square piece with nothing else carrying it (a shelf between two splayed legs) is carried by the rotated
       pieces it is fastened to. Two sloping members that lean against each other at a ridge (a rafter pair)
       carry each other at the top, but only while a level piece ties their feet together: see verifyLeaning
       and LEAN_RULES. A rotated piece stands on the floor where its lowest corners touch it, and only
       there: that is its footprint for tipping, and one with an end on the floor and the rest in the air (a
       ramp) is carried by the floor at that end only, so its span is checked. (A piece turns about its middle,
       so a leg that is rotated lifts off the floor a little and has to be moved back down.)
     - Square pieces that run into each other (a shelf drawn 1/8" into its sides, two rails crossing) are taken
       as notched together, glued and screwed, and listed in the notes. findClashes() is what reports overlaps.
     - Fish tanks, mattresses, lights and windows are loads, never structure.
     - HARDWARE, ONE TRUTH. A design on screen draws its hardware (js/hardware.js) and keeps one list of what
       holds without being a wood joint (HOLD_SOURCES, js/connections.js): the hinges and slides that are placed,
       and the pieces a preset declared as hung, each with the piece it hangs from. Check my design hands that
       list over as options.hardware (holdPairs, js/holds.js), and then exactly those pairs hold: a door hangs
       on the piece its hinges are screwed to, and a door whose hinges were taken off, or a drawer that was
       unfastened, is not held and is reported. The same list decides what moves together in the 3D view.
       The next two points describe what is assumed when options.hardware is left out: pieces that are not in a
       project yet (a preset being checked before it is placed, where placing it is what hangs the doors:
       hangPresetDoors in js/hanging.js) and projects saved before hardware was drawn.
     - A piece whose use is 'door' hangs on hinges from whatever supported piece is within 3/4"; a 'lid' may
       simply rest in place. Guessed from the name only when the name ends in "door" or is "Lid".
     - Bought hardware that carries wood (drawer slides today, hinges and shelf standards later) is not a piece
       in the design, so the design says which pieces hang on it: the names in options.hung (a preset's `hung`,
       saved on the project as S.hung). Such a piece counts as fastened to the nearest wooden piece that faces
       it across a gap of no more than 3/4" (HARDWARE_GAP: side-mount slides need 1/2") over at least 1" each
       way (HARDWARE_LAP): that is the piece the hardware is screwed to. Thin 1/4" panels and other hung pieces
       do not count. With no such neighbour it is not held up ('unsupported'), exactly as if nobody had said it
       hangs. Everything fastened to a hung piece (the rest of a drawer box, its front) is held through it.
       The weight of all of that is handed to the piece the hardware is screwed to, shared evenly when there
       are several (a drawer on two slides), and is added to that piece's load when its span is checked. It also
       counts for tipping, as part of the same thing standing on the floor. What is NOT worked out: the
       hardware itself (buy slides rated for the load), and a drawer pulled open, which moves its weight out
       past the feet. A preset with drawers checks that itself in its check(p): see js/nightstand.js.
     - The wall is at the back of the design (the smallest z). Screws into the studs hold a piece that stands
       flat against the wall (a cleat). A piece on the wall list that sticks out more than 4 times the height it
       has against the wall (a shelf lying flat) is not held by the wall: it needs a cleat and brackets.
     - Who carries whom: a piece is carried by what it sits on, and through a fastened side joint by a piece that
       is nearer the floor (or equally near and deeper, like a bed rail carrying the cleat screwed along it).
       Whether a piece sits on something counts too: one that sits on something (or on the floor) is never carried
       through a side joint by one that sits on nothing, nor by one that butts its face with an end; and a piece
       that butts with its end the face of one that sits (a cross piece screwed between two rails) is carried by
       it, whichever of the two is nearer the floor by the count of steps (a brace across the back can make the
       back rail of a long fish wall a step nearer than the front one).
       A rotated piece declared as carrying nothing (a brace) never rests on anything: its contacts are side joints.
       A piece fastened up under others (a drawer bottom nailed on under the four parts of its box) is carried by
       every one of them that is held up without it, not only by the one nearest the floor.
       Thin sheets (1/4" backs and skins) brace a frame but are never counted as carrying, and nothing is held
       up through them; the one exception is straight down through a thin sheet that lies flat.
       Thicker plywood carries what sits on it, other sheets, and boards up to 1" thick that are screwed to it.
       It does not hold up framing lumber (2x and 4x) that it is nailed along: a rafter does not hang from the
       roof deck, a joist from the floor, a stud from the wall sheathing (sheetOnlyBraces). And a piece does not
       rest on one that is itself only hanging from it.
     - Stacked members: a member that lies along the top of another (a cap plate on a top plate) hands what it
       carries straight down, and the lower one is checked as if it carried all of that alone (carriedThrough).
       That is how two flat plates over an opening with no header are found out.
     - A sloping member held at its lower end only may reach LEVER times the length it bears on, like a level one.
     - Held at one end only: fasteners can hold a piece that sticks out up to 4 times the length of joint that
       holds it (LEVER). Further than that it is marginal carrying only itself, and cannot work with a load on it.
     - Tipping is worked out about every line the thing could tip over (TIP_RULES): a push straight down on the
       part that reaches furthest past the feet; on a seat or a floor that push is a grown person.
     - A tank's weight goes to the members declared 'tankRail' under it (if none is declared: to the framing
       under it, in the direction most of that framing runs), shared evenly and spread over the tank's length
       plus 1". That is the fish rack engine's rule, and the two give the same verdict. One known difference:
       a bottom rail that lies on the floor cannot bend, so the check passes it where the engine still counts it.
     - Plywood may span either way, and is taken as cut with its face grain running the way it spans (the strong
       way: 70% of the section for stiffness, 60% for strength). Cut the other way it is about half as stiff, so
       a preset's steps should say which way the grain runs on a shelf or deck that carries weight.
       A solid board spans along its grain, or is carried along both long edges.
     - A sheet or wide board is checked along the lane through its middle. Carried all the way along that lane
       (a deck on a joist that runs its length), it is checked the other way: between that support and the next,
       and past the last one. With nothing under its middle either way (a top on four corner legs) it has to
       make the distance between its supports in both directions.

   WHAT IS NOT CHECKED (these are rule-of-thumb checks; say so when it matters)
       Weight handed from one beam to another through a side joint (tank weight coming down the uprights is
       followed down posts only: a post that stands on a shelf or a rail instead of the floor puts a point load
       on it that is not worked out; other loads are checked member by member). One heavy thing on one spot: a
       vise, a person standing on a shelf or sitting on the middle of a long thin seat. Posts buckling under anything
       but fish tanks (under tanks, postSafeLoad lowers what a long thin upright may carry). Fastener sizes and counts. Wind, snow drifts, uplift, soil pushing
       planter walls outward, and anything a building permit asks for.

   --------------------------------------------------------------------------------------------------------- */
'use strict';

/* ---------- 1. The numbers. One table each; the fish rack engine (builders-fish.js) reads the same ones ---------- */
const WOOD_RULES={
  E:1.2e6,               // stiffness of construction-grade lumber, psi
  FB_LONG:700,           // bending stress the wood may carry for good (water never leaves), psi
  FB_SHORT:1000,         // the same for loads that come and go (people, books, tools), psi
  SHEET_FACTOR:.7,       // plywood stiffness: only the plies that run along the span work, so 70% of the section counts
  SHEET_STRENGTH:.6,     // plywood strength: the outer plies do the work, so 60% of the section counts against bending stress
  DENSITY:35/1728,       // pine, spruce and plywood: 35 lb per cubic foot, here in lb per cubic inch
  TANK_LB_PER_GAL:11.25, // a filled tank: water, glass, gravel and lid
  POST_PSI:255,          // safe load on a post for each square inch of its cross-section (sizes not in POST_SAFE_LOAD)
  MATTRESS_DENSITY:.0017 // lb per cubic inch (a queen mattress is about 80 lb)
};
/* a rail under fish tanks is never allowed to span further than this, however light the tanks (inches) */
const TANK_RAIL_MAX_SPAN={'2x4':60,'2x6':84,'2x8':96,'2x10':96};
/* Center posts under an aquarium stand (reference sheet 08): extra uprights at the front and the back, in the middle
   of the length, on stands 48" and longer (one pair at 48", two pairs at 72", none on a stand up to 36"). Builders
   say a 48" 2x4 span sags over the years and can crack the front glass of the tank. So on a design that is a stand
   (a preset that declares `stand`) and is `from` long or longer, no rail under tanks may run more than `most`
   between the middles of the uprights that hold it up (verifyStandCenters, code 'center-posts'). The stand builders
   put the posts under the seam between two tanks where there is one (standCenterLines, js/builders-fish.js). */
const STAND_RULES={from:48,most:36};
/* safe load on one upright or post under fish tanks (lb) */
const POST_SAFE_LOAD={'2x4':1340,'4x4':3100};
/* The safe load on a post of a given lumber and length (lb). A long thin post buckles before it crushes: up to
   about 37 times its thinner side (4 ft 8" for a 2x4) it carries the full load above; longer than that the load
   falls with the square of its length (the long-column rule, 0.3 E / (length / side)^2). The fish rack engine
   and verifyPosts both ask here, so they cannot disagree. */
function postSafeLoad(matId,length){
  const m=M[matId],full=POST_SAFE_LOAD[matId]||WOOD_RULES.POST_PSI*m.w*m.t;
  const slender=(length||0)/Math.min(m.w,m.t),limit=Math.sqrt(.3*WOOD_RULES.E/WOOD_RULES.POST_PSI);
  return slender>limit?full*(limit/slender)**2:full;
}

/* What a piece is for: the design load it must carry.
     label      how the load is named in messages ("... under a shelf of books")
     psf        design load in lb per square foot of the surface (people, things and the surface itself)
     sag        the piece may sag span / sag before it is called marginal (a warn)
     stopSag    it is a stop at this many times the sag limit (default 2)
     permanent  the load never leaves, so the lower stress limit FB_LONG applies
     skip       carries nothing: it is only checked for its own weight       hinged / loose: see WHAT IS ASSUMED above
     people     somebody may put their whole weight on its very end: the tipping check allows for a person there
   A surface (a board lying flat, a sheet) carries the load on its own top. A framing member (a rail, an apron,
   a joist, a slat) carries the strip of surface that rests on it, halfway to the next member; if it has no use
   of its own it takes the use of what rests on it. Tank weight is never taken from this table: it comes from
   the tanks that really stand on the piece, and 'tankRail' says which members carry them. A member with tanks
   on it is checked for the tanks alone, with the tankRail limits, whatever its own use is.
   To add a use, add a row here and name it in a preset's uses. */
const USES={
  books:   {label:'a shelf of books',              psf:40, sag:300},
  shelf:   {label:'a loaded storage shelf',        psf:50, sag:240},
  seat:    {label:'people sitting on it',          psf:100,sag:240,people:true},
  tableTop:{label:'a table or desk top',           psf:50, sag:240},
  benchTop:{label:'a workbench top',               psf:100,sag:240},
  bedSlat: {label:'a mattress and sleepers',       psf:30, sag:180},
  floor:   {label:'a floor people walk on',        psf:50, sag:360,people:true},
  roof:    {label:'a roof with light snow',        psf:30, sag:180},
  soil:    {label:'wet soil about a foot deep',    psf:100,sag:180},
  tankRail:{label:'full fish tanks',               psf:50, sag:480,stopSag:1,permanent:true}, // psf counts only where no tank stands on it
  tankDeck:{label:'the deck under fish tanks',     psf:50, sag:240},
  lid:     {label:'a lid',                         psf:20, sag:180,loose:true},
  general: {label:'light things set on it',        psf:20, sag:180},
  door:    {label:'a door on hinges',              psf:0,  sag:180,skip:true,hinged:true},
  none:    {label:'nothing but itself',            psf:0,  sag:180,skip:true}
};
/* a piece that is not named in options.uses is guessed from its name, in this order.
   Only a name that ends in "door" is a door: a "Door header" is a beam and must be checked like one. */
const USE_GUESSES=[[/^lid$/i,'lid'],[/(^|\s)doors?$/i,'door'],[/book/i,'books'],[/joist|floor/i,'floor'],[/rafter|roof/i,'roof'],
  [/seat/i,'seat'],[/shelf|deck/i,'shelf'],[/counter|^top( board)?$/i,'tableTop']];

const VERIFY_TOL=.06;          // pieces closer than this (about 1/16") count as touching
const VERIFY_MAX_PIECES=12000; // above this many pieces only the weight and tipping are checked (5,000 pieces take about 0.1 s)
const VERIFY_OVER=1.005;       // a ratio must pass 1 by this much before it counts as over (same margin as the fish rack engine)
const HANG_COST=50;            // in the load path, hanging from a fastener is the last resort
const VERIFY_OVERLAP=.02;      // square pieces that run into each other deeper than this count as notched together
const VERIFY_MAX_LAPS=12;      // ... with at most this many others each
const LEVER=4;                 // a piece held at one end by fasteners may stick out this many times the length of joint that holds it
const FRAMING_THICK=1.4;       // lumber this thick or thicker (2x and 4x) is framing: plywood braces it but does not hold it up
const HARDWARE_GAP=.75;        // a piece that hangs on bought hardware needs a wooden neighbour no further away than this
const HARDWARE_LAP=1;          // ... that faces it over at least this much each way, so the hardware has something to be screwed to
const TANK_ON_SCREWS_LB=300;   // tank weight hanging on fasteners alone: marginal up to this, cannot work above it
/* Tipping (check d). Pushes are in lb, lengths in inches. */
const TIP_RULES={
  pushStop:25,pushWarn:50,       // a push straight down on the part that reaches furthest past the feet: below these it tips
  personStop:100,personWarn:200, // the same where somebody sits or stands (USES people): a grown person's weight
  personInset:5,                 // ... whose weight cannot be centered nearer the very end than this
  minReach:3,                    // an overhang shorter than this is never a tipping risk
  minHeight:24,                  // nothing shorter than this is called top-heavy
  narrow:4,                      // taller than this many times the depth of its base: fasten it to the wall (warn)
  hopeless:10,                   // taller than this many times its base: it cannot stand on its own at all (stop)
  lean:.0875                     // tan of 5 degrees: the weight is centered this close to the edge of the base
};
/* Screws into the wall studs: how many a design that is too tall to stand free needs (the wall rule of the fish
   presets; the fish rack engine reads the same table, RACK_RULES in js/builders-fish.js). Worked out, not guessed:
     - What would tip it: a person pulling on the top or climbing it, or somebody bumping into it, taken as
       `pull` (200 lb) pulling straight out at the very top. That is the load the building code puts on the top
       of a guard rail, and more than a person leaning back on a rack pulls. The design's own weight gets no
       credit: its tanks may still be empty, and an uneven floor (shimmed, but a floor 1/4" in a foot out leans
       it forward) eats into what the weight holds back.
     - What one screw holds: a 1/4" structural screw in a spruce or pine stud. The published reference value for
       the withdrawal of a 1/4" lag screw from spruce-pine-fir (the NDS, the US design standard for wood:
       W = 1800 G^1.5 D^0.75 with G = 0.42 and D = 1/4") is about 173 lb per inch of thread in the stud; the
       washer head of a structural screw pulling into a 1 1/2" rail holds more than that. Counted: `perInch`,
       115 lb, two thirds of it, with no increase for a pull that lasts a moment. The program's screws are long
       enough to put `bite` (2 1/2") of thread into the stud (wallScrewLength in js/builders-fish.js), about
       288 lb each (wallScrewHold); a screw whose thread in the stud is not known (one added by hand) is
       counted for 1 1/2" only, `hold`, about 173 lb.
     - Factor of safety `safety` (1.5) on the pull, on top of the reference value, which is itself an allowable
       value, a fraction of what such a screw pulls out at in a test.
     - The screws sit a little below the top, so their lever is shorter than the pull's:
         needed = safety × pull × (height of the top / height of the lowest screw) / hold,
       rounded up, and never fewer than `least` (2): one screw alone lets the design swing about it.
       For a 7 ft rack that is 1.5 × 200 × 84 / 82 / 173 = 1.78, so 2.
     - Spread along the top: no point along the top may be further than `reach` (2 ft) from a screw, so a long
       wall is held all along its length. With studs `studs` (16") apart that is a screw into every third stud,
       `every` (4 ft).
     - The pull is not shared out evenly (wallScrewWorst). A pull near one end of the top tips that end more than
       the other: the decked top frame is stiff along its length (taken over `window`, 10 ft, each side of the
       pull), so it shares the pull among the screws near it like a stiff board on springs: evenly, plus a part
       that grows with how far the pull and the screw are from the middle of those screws. A pull at the end of a
       10 ft rack with three screws puts 1.12 times the whole pull on the end screw, not a third of it. Every
       screw must hold its share of a pull anywhere along the top, times `safety`; where one does not, the
       program adds a screw into the next stud or a second one into the same stud.
     - Each part that stands on its own (a separate section of a rack, joined to the next by bolts that are
       taken out to move it) is held by its own screws.
   None goes at mid height: the higher a screw, the longer its lever against tipping, and the top is the highest
   place there is. These are rules of thumb, not an engineer's design. */
const WALL_SCREW_RULES={pull:200,safety:1.5,perInch:115,bite:2.5,hold:173,least:2,reach:24,every:48,studs:16,window:120};
/* What one screw into a stud is counted for, by how far its thread goes into the stud (`into`, inches): never more
   than WALL_SCREW_RULES.bite of it, and WALL_SCREW_RULES.hold (1 1/2") when that is not known. */
function wallScrewHold(into){
  const R=WALL_SCREW_RULES;
  if(typeof into!=='number'||!Number.isFinite(into))return R.hold;   // not known: a screw added by hand
  return Math.round(R.perInch*Math.max(0,Math.min(into,R.bite)));
}
/* The screw worst off under a pull anywhere along the top of one part [from, to] whose top is `top` high.
   screws: [{x, y, hold}]. The pull is tried every 3" along the top and at its ends; at each place it is shared
   by the screws within WALL_SCREW_RULES.window of it the way a stiff board on springs shares a push: an even
   share plus one that grows with the distance from the middle of those screws (the screw on the side of the
   pull takes more, the far one less). The lever is the top's height over the height of the lowest screw.
   Returns {ratio, at, x, force, hold}: ratio is safety × the screw's share of the pull / what the screw holds,
   so above 1 means that screw is too weak for a pull at `at` (inches along, like x). */
function wallScrewWorst(screws,from,to,top){
  const R=WALL_SCREW_RULES;
  if(!screws.length)return{ratio:Infinity,at:from,x:from,force:R.pull,hold:0};
  const lowest=Math.min(...screws.map(s=>s.y)),lever=top/Math.max(1,lowest);
  const pulls=[];
  for(let p=from;p<to;p+=3)pulls.push(p);
  pulls.push(to);
  let worst={ratio:0,at:from,x:screws[0].x,force:0,hold:screws[0].hold};
  for(const p of pulls){
    const near=screws.filter(s=>Math.abs(s.x-p)<=R.window+1e-6);
    if(!near.length)return{ratio:Infinity,at:p,x:p,force:R.pull*lever,hold:0};
    const count=near.length,middle=near.reduce((sum,s)=>sum+s.x,0)/count;
    const spread=near.reduce((sum,s)=>sum+(s.x-middle)*(s.x-middle),0);
    for(const s of near){
      const share=1/count+(spread>1e-9?(p-middle)*(s.x-middle)/spread:0);
      const force=R.pull*lever*share,ratio=R.safety*force/s.hold;
      if(ratio>worst.ratio)worst={ratio,at:p,x:s.x,force,hold:s.hold};
    }
  }
  return worst;
}
/* the word a preset puts in its wall list to say "held by the wall screws that are in the design" */
const WALL_BY_SCREWS='held by its wall screws';
/* a length of the rules in words: 48 is "4 ft", 24 is "2 ft" */
const ruleLength=inches=>inches%12===0?`${inches/12} ft`:fmt(inches);
/* how many screws hold a part whose top is `top` high with its lowest wall screw `screwHeight` high */
function wallScrewsNeeded(top,screwHeight){
  const R=WALL_SCREW_RULES,lever=top/Math.max(1,screwHeight);
  return Math.max(R.least,Math.ceil(R.safety*R.pull*lever/R.hold-1e-9));
}
/* The screws along one stretch [from, to] of a back (x positions, sorted): '' when every point of the stretch is
   within WALL_SCREW_RULES.reach of a screw, else a sentence saying where it is not. */
function wallScrewGap(xs,from,to){
  const R=WALL_SCREW_RULES,list=xs.slice().sort((a,b)=>a-b);
  if(!list.length)return'there are none';
  if(list[0]-from>R.reach+.01)return`the first one is ${fmt(r16(list[0]-from))} from the left end`;
  if(to-list[list.length-1]>R.reach+.01)return`the last one is ${fmt(r16(to-list[list.length-1]))} from the right end`;
  for(let i=1;i<list.length;i++)if(list[i]-list[i-1]>R.every+.01)return`two of them are ${fmt(r16(list[i]-list[i-1]))} apart`;
  return'';
}

/* ---------- 2. Bending: the one helper ---------- */
function sectionOf(breadth,depth,isPlywood){
  const stiff=isPlywood?WOOD_RULES.SHEET_FACTOR:1,strong=isPlywood?WOOD_RULES.SHEET_STRENGTH:1;
  return{b:breadth,d:depth,A:breadth*depth,S:strong*breadth*depth*depth/6,I:stiff*breadth*depth*depth*depth/12};
}
function beamCheck(section,span,load,useKey){
  const use=USES[useKey]||USES.general;
  const allowStress=use.permanent?WOOD_RULES.FB_LONG:WOOD_RULES.FB_SHORT;
  const stress=load*span*span/8/section.S;                       // simple span, even load: M = w L^2 / 8
  const sag=5*load*span**4/(384*WOOD_RULES.E*section.I);
  const allowSag=span/use.sag;
  const stressRatio=stress/allowStress,sagRatio=span>0?sag/allowSag:0;
  return{stress,sag,allowStress,allowSag,stressRatio,sagRatio,ratio:Math.max(stressRatio,sagRatio)};
}
function maxSpanFor(section,load,useKey){
  const use=USES[useKey]||USES.general;
  if(!(load>0))return Infinity;
  const allowStress=use.permanent?WOOD_RULES.FB_LONG:WOOD_RULES.FB_SHORT;
  return Math.min(Math.sqrt(8*section.S*allowStress/load),Math.cbrt(384*WOOD_RULES.E*section.I/(5*use.sag*load)));
}

/* ---------- 3. Small geometry helpers ---------- */
const vDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const extentOf=(n,k)=>n.hi[k]-n.lo[k];
/* how far two pieces' outer boxes overlap along world axis k (negative = a gap) */
const overlapOf=(a,b,k)=>Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k]);
/* the world axis (0 = left to right, 2 = front to back) a piece's length mostly runs along */
const runAxis=n=>Math.abs(n.axes[0][0])>=Math.abs(n.axes[0][2])?0:2;

/* the eight corners of a piece as it is turned */
function nodeCorners(n){
  if(n.corners)return n.corners;
  const out=[];
  for(const a of[-1,1])for(const b of[-1,1])for(const c of[-1,1]){
    out.push([0,1,2].map(k=>n.c[k]+a*n.h[0]*n.axes[0][k]+b*n.h[1]*n.axes[1][k]+c*n.h[2]*n.axes[2][k]));
  }
  return n.corners=out;
}
/* the stretch [min, max] a piece covers along a direction, measured from an origin */
function projectNode(n,origin,dir){
  let min=Infinity,max=-Infinity;
  for(const corner of nodeCorners(n)){
    const v=(corner[0]-origin[0])*dir[0]+(corner[1]-origin[1])*dir[1]+(corner[2]-origin[2])*dir[2];
    if(v<min)min=v;
    if(v>max)max=v;
  }
  return[min,max];
}
/* Do two turned boxes touch or run into each other? (separating-axis test with a small tolerance.)
   Returns null when they are apart; otherwise the direction they press against each other, as a unit
   vector pointing from A to B: the axis along which they overlap least. */
function boxesMeet(A,B,tol){
  const d=[B.c[0]-A.c[0],B.c[1]-A.c[1],B.c[2]-A.c[2]];
  let best=null,bestGap=-Infinity;
  const tryAxis=L=>{
    const len=Math.hypot(L[0],L[1],L[2]);
    if(len<1e-6)return true; // two parallel edges: this direction says nothing
    let reachA=0,reachB=0;
    for(let k=0;k<3;k++){reachA+=A.h[k]*Math.abs(vDot(A.axes[k],L));reachB+=B.h[k]*Math.abs(vDot(B.axes[k],L));}
    const along=vDot(d,L),gap=(Math.abs(along)-reachA-reachB)/len;
    if(gap>tol)return false;
    if(gap>bestGap+1e-9){bestGap=gap;best=L.map(v=>v/len*(along<0?-1:1));}
    return true;
  };
  for(let k=0;k<3;k++)if(!tryAxis(A.axes[k])||!tryAxis(B.axes[k]))return null;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(!tryAxis(vCross(A.axes[i],B.axes[j])))return null;
  return best;
}
/* convex hull of points [x, z] (monotone chain); returns the corners in order */
function convexHull(points){
  const pts=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const turn=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=list=>{
    const out=[];
    for(const p of list){
      while(out.length>=2&&turn(out[out.length-2],out[out.length-1],p)<=1e-9)out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return half(pts).concat(half(pts.reverse()));
}
/* distance from a point to the edge of a hull: positive inside, negative outside */
function insideHullBy(hull,point){
  let least=Infinity;
  for(let k=0;k<hull.length;k++){
    const a=hull[k],b=hull[(k+1)%hull.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<1e-9)continue;
    least=Math.min(least,((b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]))/len);
  }
  return least;
}
/* the narrowest width of a hull (how deep the base is the shallow way) */
function hullWidth(hull){
  let least=Infinity;
  for(let k=0;k<hull.length;k++){
    const a=hull[k],b=hull[(k+1)%hull.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<1e-9)continue;
    let far=0;
    for(const p of hull)far=Math.max(far,Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))/len);
    least=Math.min(least,far);
  }
  return least===Infinity?0:least;
}

/* ---------- 4. Words ---------- */
/* "the Leg", "the 4 Leg pieces", "the Top and the 2 Long apron pieces" */
function piecesLabel(nodes){
  const count=new Map();
  for(const n of nodes)count.set(n.name,(count.get(n.name)||0)+1);
  const bits=[...count].map(([name,c])=>c===1?`the ${name}`:`the ${c} ${name} pieces`);
  if(!bits.length)return'nothing';
  if(bits.length>3){
    const names=[...count.keys()],others=nodes.length-count.get(names[0])-count.get(names[1]);
    return`${bits[0]}, ${bits[1]} and ${others} other pieces`;
  }
  return bits.length>1?bits.slice(0,-1).join(', ')+' and '+bits[bits.length-1]:bits[0];
}
const lbText=v=>Math.round(v).toLocaleString('en-US')+' lb';
/* how a member lies, for messages: "2x4 on edge", "1x10 lying flat", "3/4" plywood" */
function sectionText(n){
  const m=n.mat;
  if(m.kind==='sheet')return m.short;
  if(m.t===m.w)return m.short;
  return m.short+(n.up===1?' on edge':' lying flat');
}

/* ---------- 5. The model: one node for each piece ---------- */
/* What is declared for one piece: {uses, wall, hung, tied}. A piece placed by a preset carries the number of
   its placement (p.set), and the project keeps what that preset declared under that number (options.sets),
   so two designs side by side in one project are each checked by their own declarations even when both call a
   piece "Top". A piece with no set (drawn by hand, or from a project saved before sets existed) is read by
   the project-wide lists, by name. */
function declarationsOf(opt){
  const list=value=>new Set(Array.isArray(value)?value:[]);
  const whole={uses:opt.uses||{},wall:list(opt.wall),hung:list(opt.hung),tied:false,stand:!!opt.stand};
  const bySet=new Map();
  return p=>{
    const own=opt.sets&&p.set!==undefined&&p.set!==null?opt.sets[p.set]:null;
    if(!own||typeof own!=='object')return whole;
    if(!bySet.has(p.set))bySet.set(p.set,{uses:own.uses||{},wall:list(own.wall),hung:list(own.hung),tied:!!own.wallFixed,stand:standOfSet(own)});
    return bySet.get(p.set);
  };
}
/* Whether a placement is an aquarium stand (STAND_RULES): what it saved, or, for a design saved before stands
   declared it, what its preset declares for the values it was made with. */
function standOfSet(own){
  if(own.stand!==undefined)return!!own.stand;
  const preset=typeof PRESETS!=='undefined'&&typeof own.name==='string'?PRESETS.find(candidate=>candidate.name===own.name):null;
  if(!preset||preset.stand===undefined)return false;
  try{return!!presetOptions(preset,{...presetDefaults(preset),...(own.vals||{})}).stand;}
  catch(e){return false;}
}
function verifyNode(p,i,id,own){   // own: what is declared for this piece (declarationsOf)
  const mat=M[p.mat]||M['2x4'],s=size(p),q=quatOf(p),b=box(p),prop=mat.kind==='prop';
  const axes=[0,1,2].map(n=>{
    const v=[0,0,0];
    v[p.ax[n]]=1;
    if(!q)return v;
    const turned=new THREE.Vector3(v[0],v[1],v[2]).applyQuaternion(q);
    return[turned.x,turned.y,turned.z];
  });
  // (a shaped piece weighs what is left after its cuts and holes: pieceVolume, js/shapes.js)
  const volume=p.shape&&!prop?pieceVolume(p):p.l*p.w*p.t;
  let weight=0;
  if(p.mat==='tank')weight=(p.gal||volume/231)*WOOD_RULES.TANK_LB_PER_GAL;
  else if(p.mat==='mattress')weight=volume*WOOD_RULES.MATTRESS_DENSITY;
  else if(!prop)weight=volume*WOOD_RULES.DENSITY;   // lights and windows are light enough to leave out
  // which of length, width, thickness points most nearly up decides how the piece works. On an exact tie (a
  // rafter or a roof sheet at 45 degrees) the piece is read as lying, not standing, so that its span is checked.
  const up=[2,1,0].reduce((best,n)=>Math.abs(axes[n][1])>Math.abs(axes[best][1])+1e-9?n:best,2);
  const planW=up===1?p.t:p.w;
  let cls='prop';
  if(!prop)cls=up===0?'post':(mat.kind==='board'&&planW<=3.6)||up===1?'beam':'plate';
  const declared=USES[own.uses[p.name]]?own.uses[p.name]:'';
  const guess=declared?null:USE_GUESSES.find(g=>g[0].test(p.name));
  const grounded=b.lo[1]<=VERIFY_TOL;
  // A rotated piece with a corner on the floor (a ramp, a low brace) is carried there and nowhere else along
  // the floor: where that is, along its own length and width, [[from,to],[from,to]] measured from its middle.
  let floor=null;
  // a turned shaped piece stands on its real corners (a leg whose foot is cut flat stands on the whole cut), so its
  // corners and the patch it stands on come from its solid (pieceCorners, js/shapes.js), not from its blank
  const shapedCorners=q&&p.shape&&!prop?pieceCorners(p):null;
  if(shapedCorners&&grounded){
    floor=[[Infinity,-Infinity],[Infinity,-Infinity]];
    toWorld(p,shapedCorners).forEach((point,k)=>{
      if(point[1]>b.lo[1]+.3)return;
      const along=shapedCorners[k][0]-p.l/2,across=shapedCorners[k][1]-p.w/2;
      floor[0]=[Math.min(floor[0][0],along),Math.max(floor[0][1],along)];
      floor[1]=[Math.min(floor[1][0],across),Math.max(floor[1][1],across)];
    });
  }else if(q&&grounded&&!prop){
    floor=[[Infinity,-Infinity],[Infinity,-Infinity]];
    for(const a of[-1,1])for(const c of[-1,1])for(const d of[-1,1]){
      if(s[1]/2+a*p.l/2*axes[0][1]+c*p.w/2*axes[1][1]+d*p.t/2*axes[2][1]+p.pos[1]>b.lo[1]+.3)continue;
      floor[0]=[Math.min(floor[0][0],a*p.l/2),Math.max(floor[0][1],a*p.l/2)];
      floor[1]=[Math.min(floor[1][0],c*p.w/2),Math.max(floor[1][1],c*p.w/2)];
    }
  }
  return{i,id,p,name:p.name,mat,prop,tilt:!!q,cls,up,planW,sheet:mat.kind==='sheet',floor,laps:0,
    ...(shapedCorners?{corners:toWorld(p,shapedCorners)}:{}),   // nodeCorners reads these first
    skin:mat.kind==='sheet'&&mat.t<=.3,                  // a 1/4" back or skin: it braces a frame but is never counted as carrying
    lo:b.lo.slice(),hi:b.hi.slice(),c:p.pos.map((v,k)=>v+s[k]/2),axes,h:[p.l/2,p.w/2,p.t/2],
    run:Math.sqrt(Math.max(0,1-axes[0][1]*axes[0][1])),  // how much of its length is level (1 = flat, less on a slope)
    weight,grounded,wall:!prop&&(own.wall.has(p.name)||own.wall.has(id)),wallEdge:false,
    wallScrews:[],                                       // the screws into the wall studs that are in it (options.wallScrews), where they enter it
    screwed:!prop&&own.wall.has(WALL_BY_SCREWS),         // its design is held to the wall by its wall screws alone (WALL_SCREW_RULES)
    own,wallZ:0,                                         // what is declared for it, and where the wall of its design is (verifyModel)
    tied:own.tied,                                       // its whole design is tied back to the wall (wall: true on its preset)
    stand:!prop&&!!own.stand,                            // its design is an aquarium stand (stand on its preset; STAND_RULES)
    onHardware:!prop&&own.hung.has(p.name),              // hangs on bought hardware (options.hung)
    hungLb:0,                                            // weight that hangs from this piece on bought hardware
    noMount:false,                                       // hangs on hardware by its name, but has no piece beside it to mount to
    spread:null,                                         // one of a pair of rafters that nothing ties together (verifyLeaning)
    use:declared||(guess?guess[1]:''),declared:!!declared,
    links:[],sup:[],carries:[],rests:[],loads:[],tankLoads:[],tankW:0,tankPsf:0,tankLb:0,mattress:false,
    cost:Infinity,supported:false,fixed:false,hung:false,comp:-1};
}
/* A piece the check can work with: real numbers for its size and its place, a material the program knows, and
   length, width and thickness each along their own axis. Anything else (a damaged or hand-edited project file)
   is left out of the check and reported as a 'bad-piece' problem; it never makes the check fail with an error. */
function usablePiece(p){
  const numbers=list=>Array.isArray(list)&&list.every(Number.isFinite);
  return!!p&&typeof p==='object'&&!!M[p.mat]&&numbers([p.l,p.w,p.t])&&p.l>0&&p.w>0&&p.t>0&&
    numbers(p.pos)&&p.pos.length===3&&Array.isArray(p.ax)&&p.ax.slice().sort().join()==='0,1,2';
}
/* The piece itself, or a copy with the unreadable bits put right: a rotation that is not a rotation is dropped
   (the piece is checked as if it sat square), and a piece with no name is called "Piece". */
function soundPiece(p){
  const q=p.q,rot=p.rot;
  const badQ=q!==undefined&&q!==null&&!(Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)&&Math.hypot(q[0],q[1],q[2],q[3])>1e-6);
  const badRot=rot!==undefined&&rot!==null&&!(typeof rot==='object'&&[0,1,2].includes(rot.k)&&Number.isFinite(rot.deg));
  const badName=typeof p.name!=='string'||!p.name;
  if(!badQ&&!badRot&&!badName)return p;
  const copy=Object.assign({},p);
  if(badQ)delete copy.q;
  if(badRot)delete copy.rot;
  if(badName)copy.name='Piece';
  return copy;
}
function verifyModel(parts,opt){
  const usable=[],leftOut=[];
  (Array.isArray(parts)?parts:[]).forEach((p,place)=>{
    if(usablePiece(p))usable.push({p:soundPiece(p),given:p,place:place+1});
    else leftOut.push(p);
  });
  const haveIds=usable.every(u=>u.p.id)&&new Set(usable.map(u=>u.p.id)).size===usable.length;
  const declaredFor=declarationsOf(opt);
  const nodes=usable.map((u,i)=>verifyNode(u.p,i,haveIds?u.p.id:u.place,declaredFor(u.p)));
  const wood=nodes.filter(n=>!n.prop),props=nodes.filter(n=>n.prop);
  // Where the wall is: at the back (the smallest z) of the design a piece belongs to. Two designs placed side
  // by side each have their own back, so a shed beside a wall shelf does not move the shelf's wall.
  const backOf=new Map();
  for(const n of wood)backOf.set(n.own,Math.min(backOf.has(n.own)?backOf.get(n.own):Infinity,n.lo[2]));
  for(const n of wood)n.wallZ=backOf.get(n.own);
  // the screws into the wall studs: each is found by the piece it goes into (its id, or the piece itself for a
  // preset that is not placed yet); a piece with one in it is held by the wall
  if(Array.isArray(opt.wallScrews)&&opt.wallScrews.length){
    const byPiece=new Map();
    nodes.forEach((n,i)=>{byPiece.set(usable[i].given,n);if(haveIds)byPiece.set(n.id,n);});
    for(const screw of opt.wallScrews){
      const n=screw&&byPiece.get(screw.on);
      if(!n||n.prop||!Array.isArray(screw.at)||!screw.at.every(Number.isFinite))continue;
      // what it holds: given with it (by how far its thread reaches into the stud), else the least (WALL_SCREW_RULES.hold)
      n.wallScrews.push({at:screw.at,hold:typeof screw.hold==='number'&&screw.hold>=0?screw.hold:WALL_SCREW_RULES.hold});
      n.wall=true;
    }
  }
  return{nodes,wood,props,leftOut,reactions:[],comps:[]};
}

/* ---------- 6. Which pieces touch ---------- */
/* kind: 'bear' = one piece sits on the other (lower / upper say which); 'side' = they meet side by side.
   tilt marks a link that involves a rotated piece. Its fastener is assumed, not chosen on the Fasteners tab, and so
   is the fastener of two square pieces that run into each other (overlap says how deep): j is null for both.
   hardware marks a link made by bought hardware (a drawer slide) between a hung piece and the piece it is screwed to. */
function verifyLink(a,b,kind,type,j,lower){
  const link={a,b,kind,type,fastened:type!=='none',j:j||null,lower:null,upper:null,tilt:a.tilt||b.tilt,overlap:0,hardware:false};
  if(kind==='bear'){
    link.lower=lower||(Math.abs(a.hi[1]-j.plane)<.03?a:b);
    link.upper=link.lower===a?b:a;
  }
  a.links.push(link);
  b.links.push(link);
  return link;
}
/* The wooden piece a hung piece's hardware is screwed to: the nearest one that faces it across a gap of at most
   HARDWARE_GAP over at least HARDWARE_LAP each way. Side by side is preferred to above or below when both are
   equally near (a slide on the cabinet side, not on the panel under the drawer). Returns null when there is none. */
function hardwareMount(hung,wood){
  let best=null;
  for(const Y of wood){
    if(Y===hung||Y.onHardware||Y.skin)continue;
    for(const k of[0,2,1]){
      const gap=Math.max(hung.lo[k]-Y.hi[k],Y.lo[k]-hung.hi[k]);
      if(gap<-VERIFY_TOL||gap>HARDWARE_GAP+VERIFY_TOL)continue;
      const[u,v]=[0,1,2].filter(axis=>axis!==k),lapU=overlapOf(hung,Y,u),lapV=overlapOf(hung,Y,v);
      if(lapU<HARDWARE_LAP||lapV<HARDWARE_LAP)continue;
      const score=Math.max(0,gap)+(k===1?.01:0)-lapU*lapV*1e-6;   // nearest; then side by side; then the bigger face
      if(!best||score<best.score)best={node:Y,score};
    }
  }
  return best?best.node:null;
}
function verifyContacts(model,opt){
  const joints=opt.joints||{},styled=opt.styled&&typeof opt.styled==='object'?opt.styled:{};
  // a preset's own fasteners, by piece name, for pieces that have no ids yet (see checkPreset)
  const named=Array.isArray(opt.namedJoints)?opt.namedJoints:[];
  const namedType=j=>namedJointType(j,named);   // js/joints.js: the same reading of the list as placePreset
  // square-set pieces: the same face contacts and fastener choices as the Fasteners tab, found with a sweep from left to right
  const boxes=model.wood.filter(n=>!n.tilt).map(n=>({p:n.p,lo:n.lo,hi:n.hi,s:size(n.p),n}));
  boxes.sort((a,b)=>a.lo[0]-b.lo[0]);
  for(let x=0;x<boxes.length;x++){
    const A=boxes[x];
    for(let y=x+1;y<boxes.length;y++){
      const B=boxes[y];
      if(B.lo[0]>A.hi[0]+.02)break;
      if(B.lo[1]>A.hi[1]+.02||A.lo[1]>B.hi[1]+.02||B.lo[2]>A.hi[2]+.02||A.lo[2]>B.hi[2]+.02)continue;
      const first=A.n.i<B.n.i?A:B,second=first===A?B:A; // same order as findJoints, so the joint keys match
      const j=jointOfPair(first,second);   // js/neighbors.js
      if(!j){
        // No faces touch. Do they run into each other (a shelf drawn 1/8" into its sides, two rails crossing)?
        // That is a notch or a housing, which holds at least as well as a butt joint, so it counts as fastened;
        // it is mentioned in the notes (code 'overlap'), and findClashes() lists it too.
        const deep=[0,1,2].map(k=>overlapOf(A,B,k));
        if(deep.some(v=>v<=VERIFY_OVERLAP))continue;
        // (blanks that cross where the wood does not, as at a mitered corner: a cut-end tie below, not a housing)
        if((A.p.shape||B.p.shape)&&!solidsOverlap(A.p,B.p))continue;
        // a pile of copies left on top of each other must not turn into millions of joints
        if(A.n.laps>=VERIFY_MAX_LAPS||B.n.laps>=VERIFY_MAX_LAPS)continue;
        A.n.laps++;
        B.n.laps++;
        const k=deep.indexOf(Math.min(deep[0],deep[1],deep[2]));
        const chosen=joints[first.p.id+'-'+second.p.id]||joints[second.p.id+'-'+first.p.id]||'screw';
        const below=k===1?(first.n.c[1]<=second.n.c[1]?first.n:second.n):null;
        verifyLink(first.n,second.n,below?'bear':'side',chosen,null,below).overlap=deep[k];
        continue;
      }
      // a choice made by hand, else the preset's rule for this joint (it may follow the style), else the suggestion
      const style=opt.style||'std',rule=styled[j.key];
      const type=joints[j.key]||(isStyleRule(rule)?typeForStyle(rule,style):'')||typeForStyle(namedType(j),style)||styleType(defaultType(j),j,style);
      verifyLink(first.n,second.n,j.k===1?'bear':'side',type,j);
    }
  }
  // An end cut at an angle (or rounded, or pointed) that only touches another piece (shapeEndTies, js/shapes.js):
  // the two touch, so the piece is not "floating", but nothing fastens them unless a fastener was chosen by hand.
  // A cut end standing on a piece below rests on it (a post with a slanted top under a shelf: the shelf rests).
  if(model.wood.some(n=>n.p.shape)){
    const nodeOf=new Map(model.wood.map(n=>[n.p,n]));
    for(const tie of shapeEndTies(model.wood.filter(n=>!n.tilt).map(n=>n.p))){
      const a=nodeOf.get(tie.a),b=nodeOf.get(tie.b);
      if(!a||!b||a.links.some(l=>l.a===b||l.b===b))continue;
      const chosen=joints[tie.key]||'none';
      const lower=Math.abs(a.hi[1]-b.lo[1])<.03?a:Math.abs(b.hi[1]-a.lo[1])<.03?b:null;
      verifyLink(a,b,lower?'bear':'side',chosen,null,lower);
    }
  }
  // Pieces that hang on bought hardware are fastened, by that hardware, to another piece. With the hardware of
  // the design given (opt.hardware), exactly those pairs hold. Without it the hardware is not drawn, and a piece
  // on a hung list hangs from the wooden piece right beside it.
  const placed=Array.isArray(opt.hardware);
  const hold=(H,mount)=>{
    let link=H.links.find(l=>l.a===mount||l.b===mount);  // they may touch as well (a hinge on a flush edge)
    if(!link)link=verifyLink(H,mount,'side','hardware',null);
    link.fastened=link.hardware=true;
  };
  if(placed){
    const byId=new Map(model.wood.map(n=>[n.id,n]));
    for(const pair of opt.hardware){
      const H=pair&&byId.get(pair.on),mount=pair&&byId.get(pair.to);
      if(!H||!mount||H===mount)continue;
      H.onHardware=true;
      hold(H,mount);
    }
    // a door is meant to hang on hinges: with none placed it is not held, and the load path says so
    for(const H of model.wood)if(USES[H.use||'none'].hinged)H.onHardware=true;
  }
  for(const H of model.wood){
    if(placed||!H.onHardware)continue;
    const mount=hardwareMount(H,model.wood);
    if(mount)hold(H,mount);                              // verifyLoadPath says so if nothing else holds it up
  }
  // rotated pieces: taken as screwed to whatever they touch
  const tilted=model.wood.filter(n=>n.tilt);
  for(const T of tilted){
    for(const Y of model.wood){
      if(Y===T||(Y.tilt&&Y.i<T.i))continue;
      if([0,1,2].some(k=>overlapOf(T,Y,k)<-VERIFY_TOL))continue;
      const press=boxesMeet(T,Y,VERIFY_TOL);
      if(!press)continue;
      const type=joints[T.id+'-'+Y.id]||joints[Y.id+'-'+T.id]||'screw';
      // pressing up and down: one lies on the other (a rafter on a wall plate, a roof deck on a rafter);
      // pressing sideways: they pass side by side (a brace across the back of a post)
      // A rotated piece declared as carrying nothing (a diagonal brace across the back of a frame) is screwed through
      // its face to what it crosses and never sits on anything: where its corner happens to touch the top of a short
      // block (the foot of a fish rack) that is still a side joint, not a rest.
      let lower=press[1]>=.5?T:press[1]<=-.5?Y:null;
      if(lower===Y&&T.declared&&T.use==='none')lower=null;
      verifyLink(T,Y,lower?'bear':'side',type,null,lower);
    }
  }
  // heavy things (tanks, mattresses) and what they stand on
  for(const P of model.props){
    if(!P.weight||P.grounded)continue;
    for(const Y of model.wood){
      if(Math.abs(Y.hi[1]-P.lo[1])>.3||overlapOf(P,Y,0)<.1||overlapOf(P,Y,2)<.1)continue;
      P.rests.push(Y);
      Y.loads.push(P);
      if(P.p.mat==='mattress')Y.mattress=true;
    }
  }
}

/* ---------- 7. Check a: the load path ---------- */
/* Plywood stiffens a frame and is carried by it. It is not what holds the frame up. True when the sheet X only
   braces the piece Y through this link and so cannot be counted as holding Y up:
     - a 1/4" back or skin holds nothing up, except what stands on it while it lies flat (a 1/4" bottom on the
       floor with the sides standing on it); a shelf nailed to nothing but the 1/4" back is not held up;
     - a thicker sheet holds up whatever sits on top of it, other sheets (a box), and boards up to 1" thick (a
       cleat or a shelf screwed to a 3/4" cabinet side). It does not hold up framing lumber (2x and 4x) that it
       is nailed along: a rafter does not hang from the roof deck, a joist from the floor, or a stud from the
       wall sheathing. The one way a sheet does carry such a board is a rail that butts it with its end (a 2x4
       between two plywood ends), where the screws go through the sheet into the end of the board. The spans
       are still checked, so a wall plate held by nothing but the sheathing at its two ends does not pass.
   Rotated pieces have no face-to-face joint to look at, so for them the plain rule holds: no framing lumber
   is held up by a sheet. */
function sheetOnlyBraces(X,Y,link){
  if(!X.sheet)return false;
  if(link.kind==='bear'&&link.lower===X)return X.skin&&X.up!==2;   // Y sits on top of it
  if(X.skin)return true;
  if(Y.sheet||Y.mat.t<FRAMING_THICK)return false;
  // a rail that butts the sheet with its end; a short block (a cripple stud no longer than it is wide) is not a rail
  const j=link.j,rail=Y.p.l>2*Y.p.w;
  return!(rail&&j&&(link.a===Y?j.fa:j.fb)==='end');
}
/* What it costs a piece to be held up by X through this link: resting on X or a fastened side joint costs 1,
   hanging under X from a fastener costs HANG_COST, and Infinity means X cannot hold it up that way. */
function holdCost(X,link){
  if(sheetOnlyBraces(X,link.a===X?link.b:link.a,link))return Infinity;
  if(link.kind==='bear')return link.lower===X?1:link.fastened?HANG_COST:Infinity;
  return link.fastened?1:Infinity;
}
/* Bought hardware carries weight too. Everything that is held up only because of a hardware link (a drawer
   box on its slides, with its front) hangs from the pieces that hardware is screwed to: its weight goes to
   them as hungLb, shared evenly when there are several, and the span check adds it to their load. */
function verifyHardwareLoads(wood){
  const other=(link,n)=>link.a===n?link.b:link.a;
  // what stays held up when every hardware link is taken away: the same walk as the load path
  const held=new Set(wood.filter(n=>n.grounded||n.wall)),queue=[...held];
  for(let at=0;at<queue.length;at++){
    const X=queue[at];
    for(const link of X.links){
      const Y=other(link,X);
      if(link.hardware||held.has(Y)||holdCost(X,link)===Infinity)continue;
      held.add(Y);
      queue.push(Y);
    }
  }
  // the rest hangs on hardware, in clusters of pieces that are joined to each other
  const seen=new Set();
  for(const start of wood){
    if(!start.supported||held.has(start)||seen.has(start))continue;
    const group=[start],mounts=[];
    seen.add(start);
    let weight=0;
    for(let at=0;at<group.length;at++){
      const X=group[at];
      weight+=X.weight;
      for(const link of X.links){
        const Y=other(link,X);
        if(held.has(Y)){if(link.hardware)mounts.push(Y);continue;}
        if(Y.supported&&!seen.has(Y)){seen.add(Y);group.push(Y);}
      }
    }
    for(const mount of mounts)mount.hungLb+=weight/mounts.length;
    // A piece of the cluster that is said to hang on hardware but has nothing beside it to mount to (a drawer
    // side next to a cabinet side that is gone): the cluster hangs on the hardware of its other pieces only.
    for(const X of group)if(X.onHardware&&!X.links.some(link=>link.hardware))X.noMount=true;
  }
}
function verifyLoadPath(model,opt,found){
  const wood=model.wood,other=(link,n)=>link.a===n?link.b:link.a;
  // the cheapest way down from every piece to the floor or the wall: resting on something or a fastened side
  // joint costs 1, hanging from a fastener costs HANG_COST, a joint with no fastener carries nothing sideways
  const queue=[];
  // screwed to the wall: of the pieces with a name on the wall list, the ones at the back of the design
  const onList=new Map(),designs=new Map();   // pieces on a wall list, by design and name
  for(const n of wood){
    if(!n.wall)continue;
    if(n.wallScrews.length)continue;   // a screw into a stud is really in it: it is held, wherever it stands
    if(!designs.has(n.own))designs.set(n.own,designs.size);
    const key=designs.get(n.own)+'|'+n.name;
    if(!onList.has(key))onList.set(key,[]);
    onList.get(key).push(n);
    n.wall=n.lo[2]-n.wallZ<=1.5;
    // Screws into the studs hold a board that stands flat against the wall (a cleat). A shelf that meets the
    // wall with nothing but its thin back edge would hang on screws driven through that edge: see verifyBearing.
    n.wallEdge=n.wall&&n.hi[2]-n.wallZ>LEVER*extentOf(n,1)+.1;
  }
  for(const group of onList.values()){
    if(group.some(n=>n.wall))continue;
    const gap=Math.min(...group.map(n=>n.lo[2]-n.wallZ)),name=group[0].name;
    found.push({level:'warn',code:'wall-gap',ids:group.map(n=>n.id),group:name,rank:gap,
      text:`The ${name} is meant to be screwed to the wall, but it sits ${fmt(gap)} in front of the back of the design, where the wall is.`,
      fix:'Move it back against the wall, or fasten a different piece to the wall.'});
  }
  for(const n of wood){
    if(n.grounded||n.wall){n.cost=0;queue.push(n);}
  }
  for(let at=0;at<queue.length;at++){
    const X=queue[at];
    for(const link of X.links){
      const Y=other(link,X),step=holdCost(X,link);
      if(X.cost+step<Y.cost){Y.cost=X.cost+step;queue.push(Y);}
    }
  }
  for(const n of wood)n.supported=n.cost<Infinity;
  if(wood.some(n=>n.links.some(link=>link.hardware)))verifyHardwareLoads(wood);
  // In a project on screen the hardware is drawn (opt.hardware), so what is missing is the hardware itself;
  // without it the hardware is assumed, and what can be missing is a piece to screw it to.
  const placed=Array.isArray(opt.hardware);
  const hangIt='Select it and choose Hang this door or lid, or Put this drawer on slides (right-click it, or use the Hardware pulldown in the Add group)';
  for(const n of wood){
    if(!n.noMount)continue;
    found.push({level:'stop',code:'unsupported',ids:[n.id],group:'m'+n.name,rank:n.weight,
      text:placed?`The ${n.name} is meant to hang on bought hardware (hinges or a drawer slide), but none holds it now. It is held only through the pieces it is joined to, which hang on the hardware of another piece.`
        :`The ${n.name} is meant to hang on bought hardware (a drawer slide or hinges), but there is no wooden piece within ${fmt(HARDWARE_GAP)} beside it for that hardware to be screwed to. It is held only through the pieces it is joined to, which hang on the hardware of another piece.`,
      fix:placed?`${hangIt}. The piece that carries it must be within ${fmt(HARDWARE_GAP)} of it.`
        :`Put the piece that carries it back, within ${fmt(HARDWARE_GAP)} of it and facing it over at least ${fmt(HARDWARE_LAP)}, or hold it up another way.`});
  }
  // hardware that is not drawn: doors hang on hinges from the nearest supported piece
  for(const n of wood){
    if(placed||n.supported||!USES[n.use||'none'].hinged)continue;
    const frame=wood.find(y=>y.supported&&!y.hung&&y!==n&&[0,1,2].every(k=>overlapOf(n,y,k)>=-.75));
    if(frame){n.supported=n.hung=true;n.cost=frame.cost+1;}
  }
  // "fixed": reached from the floor or the wall through fasteners alone (or standing on the floor itself)
  const fixedQueue=wood.filter(n=>n.grounded||n.wall||n.hung);
  fixedQueue.forEach(n=>{n.fixed=true;});
  for(let at=0;at<fixedQueue.length;at++){
    for(const link of fixedQueue[at].links){
      const Y=other(link,fixedQueue[at]);
      if(link.fastened&&!Y.fixed){Y.fixed=true;fixedQueue.push(Y);}
    }
  }
  // clusters of pieces that share a fate: `linked` says which links hold a cluster together
  const clusters=(nodes,linked)=>{
    const pool=new Set(nodes),seen=new Set(),out=[];
    for(const start of nodes){
      if(seen.has(start))continue;
      const group=[start];
      seen.add(start);
      for(let at=0;at<group.length;at++){
        for(const link of group[at].links){
          const Y=other(link,group[at]);
          if(linked(link)&&pool.has(Y)&&!seen.has(Y)){seen.add(Y);group.push(Y);}
        }
      }
      out.push(group);
    }
    return out;
  };
  // not held up at all
  const hanging=wood.filter(n=>!n.supported);
  for(const group of clusters(hanging,()=>true)){
    const ids=group.map(n=>n.id),first=group[0],many=group.length>1;
    const touched=[...new Set(group.flatMap(n=>n.links.map(l=>other(l,n))).filter(y=>y.supported))];
    // a supported piece that only braces every piece of the group it touches (see sheetOnlyBraces)
    const bracesOnly=y=>group.every(n=>n.links.every(l=>other(l,n)!==y||sheetOnlyBraces(y,n,l)));
    // said to hang on bought hardware, but there is nothing beside it for that hardware to be screwed to
    const adrift=group.filter(n=>n.onHardware&&!n.links.some(l=>l.hardware));
    if(adrift.length){
      const several=adrift.length>1;
      found.push({level:'stop',code:'unsupported',ids,group:'h'+first.name,rank:group.length,
        text:placed?`Nothing holds up ${piecesLabel(group)}. ${several?'They are':'It is'} meant to hang on hinges or drawer slides, and no such hardware holds ${several?'them':'it'} now.`
          :`Nothing holds up ${piecesLabel(group)}. The hardware that ${piecesLabel(adrift)} ${several?'hang':'hangs'} on (drawer slides or hinges) has to be screwed to a wooden piece right beside ${several?'them':'it'}, and there is none within ${fmt(HARDWARE_GAP)}.`,
        fix:placed?`${hangIt}, or fasten ${several?'them':'it'} another way.`
          :`Move ${several?'them':'it'} to within ${fmt(HARDWARE_GAP)} of the piece that carries ${several?'them':'it'}, facing it over at least ${fmt(HARDWARE_LAP)}, or hold ${several?'them':'it'} up another way.`});
    }else if(!many&&!first.links.length){
      found.push({level:'stop',code:'floating',ids,group:'f'+first.id,rank:first.lo[1],
        text:`The ${first.name} touches nothing. It is floating ${fmt(first.lo[1])} above the floor.`,
        fix:'Rest it on another piece or on the floor, or fasten it to a piece that is held up.'});
    }else if(touched.length&&touched.every(bracesOnly)&&group.some(n=>n.links.some(l=>l.fastened&&other(l,n).supported))){
      // fastened to plywood that braces but does not hold up: a thin back or skin, or sheathing nailed along framing lumber
      const thin=touched.every(y=>y.skin);
      found.push({level:'stop',code:'unsupported',ids,group:'u'+first.id,rank:group.length,
        text:`Nothing holds up ${piecesLabel(group)}. ${many?'They are':'It is'} fastened only to ${piecesLabel(touched)}, and `+
          (thin?'a panel that thin braces a frame but cannot carry weight.':'plywood nailed along framing lumber braces it but does not hold it up.'),
        fix:thin?'Fasten it to the sides or the frame as well, or put a support underneath.':'Stand it on a plate or a post, or fasten it to framing that is held up.'});
    }else if(touched.length){
      found.push({level:'stop',code:'unsupported',ids,group:'u'+first.id,rank:group.length,
        text:`Nothing holds up ${piecesLabel(group)}. ${many?'They touch':'It touches'} ${piecesLabel(touched)}, but with no fastener there and without sitting on top.`,
        fix:'Fasten them: click Connect (C), then the two pieces. Or put a support underneath.'});
    }else{
      // a near miss is worth saying: a leg that was rotated lifts a little off the floor
      const lowest=Math.min(...group.map(n=>n.lo[1]));
      found.push({level:'stop',code:'unsupported',ids,group:'u'+first.id,rank:group.length,
        text:`Nothing holds up ${piecesLabel(group)}. They are joined to each other but none of them reaches the floor or a piece that does.`+
          (lowest<=2?` The lowest one stops ${fmt(lowest)} above the floor.`:''),
        fix:'Stand them on the floor, or fasten them to a piece that is held up.'});
    }
  }
  // held up, but only by sitting there
  const resting=wood.filter(n=>n.supported&&!n.fixed);
  for(const group of clusters(resting,link=>link.fastened)){
    if(group.some(n=>USES[n.use||'none'].loose))continue; // a lid is meant to lift off
    const under=[...new Set(group.flatMap(n=>n.links.filter(l=>l.kind==='bear'&&l.upper===n).map(l=>l.lower)).filter(y=>!group.includes(y)))];
    const many=group.length>1;
    found.push({level:'warn',code:'loose',ids:group.map(n=>n.id),group:group[0].name+'|'+(under[0]?under[0].name:''),rank:group.length,
      text:`${many?'These pieces only rest':'This piece only rests'} in place: ${piecesLabel(group)} on ${piecesLabel(under)}. Nothing fixes ${many?'them':'it'}, so a bump can knock ${many?'them':'it'} off.`,
      fix:'Fasten it down: click Connect (C), then this piece and the piece under it.'});
  }
  // who carries whom, and where along each piece its supports are
  for(const X of wood){
    if(!X.supported||X.hung)continue;
    const beside=[]; // rotated pieces it is fastened to side by side, nearer the floor than it is
    for(const link of X.links){
      const Y=other(link,X);
      if(!Y.supported||Y.hung)continue;
      let how='';
      // a thin panel nailed on (a cabinet back) braces the frame, and so does plywood nailed along framing
      // lumber (a roof deck on its rafters): neither is counted as carrying it
      if(sheetOnlyBraces(Y,X,link))continue;
      if(link.kind==='bear'){
        // X rests on Y, unless Y itself is only held up by hanging (a cripple stud that hangs from the plate
        // above it is not what carries that plate: the two would be holding each other up)
        if(link.lower===Y){
          if(Y.cost<X.cost+HANG_COST)how='bear';
        }else if(link.fastened&&Y.cost<X.cost)how='hang';
      }else if(link.fastened){
        // a fastened side joint carries from the piece nearer the floor; of two pieces equally near (a cleat
        // screwed along a bed rail, both ending at the legs) the deeper one carries the shallower one.
        // A rotated piece passing side by side (a brace) holds things together but is not counted as carrying,
        // unless nothing else carries the piece (a shelf between two splayed legs): see below.
        // And of two equally near and equally deep, the one that sits on something carries the one that does not
        // (a rail on its uprights carries the cross piece screwed between it and the other rail, even where a
        // brace across the back has made the back rail a step nearer the floor than the front one).
        // The other way round, a piece that sits on something is never counted as hanging from the side of one that
        // sits on nothing (a rail on its uprights does not hang from a cross piece that is only screwed between rails).
        // And a piece that sits on nothing and butts a piece that sits with its end (a cross piece screwed between two
        // rails) is carried by it, however the steps to the floor happen to count: through a brace across the back
        // the back rail may be nearer the floor than the front one, and the cross piece is carried by both.
        const sits=n=>n.grounded||n.links.some(l=>l.kind==='bear'&&l.upper===n&&l.lower.cost<Infinity);
        const square=!X.tilt&&!Y.tilt,sitsX=square&&sits(X),sitsY=square&&sits(Y);
        // (butts: X meets the face of Y with its end, as a cross piece meets a rail; it may also sit on a block at
        // that end, the foot of a door stile, and is still carried by the rail it is screwed to)
        const faceOf=n=>!link.j?'':(link.a===n?link.j.fa:link.j.fb);
        const butts=faceOf(X)==='end'&&faceOf(Y)!=='end',buttedBy=faceOf(Y)==='end'&&faceOf(X)!=='end';
        const carries=(Y.cost<X.cost||(Y.cost===X.cost&&extentOf(Y,1)>extentOf(X,1)+.1)||(sitsY&&butts)||
          (sitsY&&!sitsX&&Y.cost===X.cost&&Math.abs(extentOf(Y,1)-extentOf(X,1))<=.1))&&!(sitsX&&!sitsY)&&!(sitsX&&sitsY&&buttedBy);
        if(carries&&!link.tilt)how='side';
        else if(Y.cost<X.cost)beside.push({node:Y,how:'side',fastened:true,link,iv:supportStretch(X,Y)});
      }
      if(!how)continue;
      X.sup.push({node:Y,how,fastened:link.fastened,link,iv:supportStretch(X,Y)});
      Y.carries.push(X);
    }
    if(!X.sup.length&&!X.tilt){
      for(const s of beside){X.sup.push(s);s.node.carries.push(X);}
    }
  }
  verifyLeaning(model,found);
}
/* Rafter pairs. Two sloping members that lean against each other at a ridge hold each other up at the top, but
   only while something ties their feet together: without a tie they push the walls apart and the ridge drops.
   So the upper end of a sloping member counts as carried when all of this is true (LEAN_RULES):
     - it rests on something at its lower end, and slopes between 3 in 12 and about 60 degrees;
     - at its upper end it is fastened to a ridge piece, or straight to its partner;
     - the partner slopes the other way, meets the same ridge opposite it, and rests on something too;
     - a level, square-set piece that runs the way the pair spans (a rafter tie, a ceiling joist, the plate of
       an end wall) is fastened to both members or to what their feet rest on, is no further from the
       pair than a tie is when ties are 4 ft apart and each sits beside a rafter (26"), and is low: its
       underside in the lowest third of the height from the feet to the ridge (a collar tie is not a tie).
   A pair with no tie, or one flatter than 3 in 12, gets no support at the ridge. It is marked (X.spread) and
   verifyBeam reports it as 'spread', a stop, however short the rafters are: a short rafter would otherwise
   pass as a short overhang, and the walls would still be pushed apart. The pull in the tie and its fasteners
   are not worked out. */
const LEAN_RULES={
  minSlope:.25,   // rise over run. Flatter than 3 in 12 the push on the walls is more than ties can be trusted with
  leastSlope:.04, // flatter than about 1/2 in 12 two members that meet end to end are not a pair of rafters at all
  maxSlope:1.75,  // steeper than about 60 degrees it is a wall, not a roof
  tieWithin:26,   // the tie is no further than this from the pair, measured along the ridge: ties 4 ft apart, each beside a rafter
  tieBelow:1/3,   // the underside of the tie is within this much of the height from the feet up to the ridge
  apart:3.1       // the two members stand opposite each other: at most this far apart along the ridge (inches)
};
function verifyLeaning(model,found){
  const other=(link,n)=>link.a===n?link.b:link.a;
  // which way is uphill on the floor plan, and how steep
  const leanOf=n=>{
    const e=n.axes[0],level=Math.hypot(e[0],e[2]),sign=e[1]>=0?1:-1;
    if(level<1e-6)return null;
    const slope=Math.abs(e[1])/level;
    if(slope<LEAN_RULES.leastSlope||slope>LEAN_RULES.maxSlope)return null;
    return{uphill:[sign*e[0]/level,sign*e[2]/level],topEnd:sign*n.h[0],slope,flat:slope<LEAN_RULES.minSlope-1e-6};
  };
  const feetOf=n=>n.sup.filter(s=>s.how==='bear').map(s=>s.node);
  const sloping=n=>n.tilt&&n.cls==='beam'&&n.supported&&!n.hung;
  // does the level piece T hold the foot of the sloping member Z?
  const holdsFoot=(T,Z,feet)=>feet.includes(T)||T.links.some(l=>l.fastened&&(other(l,T)===Z||feet.includes(other(l,T))));
  const added=[];
  for(const X of model.wood){
    if(!sloping(X))continue;
    const mine=leanOf(X),myFeet=feetOf(X);
    if(!mine||!myFeet.length)continue;
    const across=[-mine.uphill[1],mine.uphill[0]];                       // along the ridge
    const offset=n=>(n.c[0]-X.c[0])*across[0]+(n.c[2]-X.c[2])*across[1];
    // what it meets at its upper end and nowhere else: within its own depth of the end, and not lying along it
    const atTop=X.links.filter(link=>{
      if(!link.fastened)return false;
      const reach=supportStretch(X,other(link,X))[0],depth=2*X.h[1];
      return mine.topEnd>0?reach[1]>=mine.topEnd-depth&&reach[0]>=mine.topEnd-4*depth:reach[0]<=mine.topEnd+depth&&reach[1]<=mine.topEnd+4*depth;
    });
    const opposes=P=>{
      if(P===X||!sloping(P)||Math.abs(offset(P))>LEAN_RULES.apart)return false;
      const theirs=leanOf(P);
      return!!theirs&&theirs.uphill[0]*mine.uphill[0]+theirs.uphill[1]*mine.uphill[1]<-.7&&feetOf(P).length>0;
    };
    let lean=null;
    for(const link of atTop){
      const R=other(link,X);
      const partner=opposes(R)?R:R.tilt?null:R.links.filter(l=>l.fastened).map(l=>other(l,R)).find(opposes);
      if(!partner)continue;
      // It is one of a pair. Until a tie is found below, nothing stops the pair from spreading.
      X.spread={partner,top:mine.topEnd,flat:mine.flat||leanOf(partner).flat,slope:Math.min(mine.slope,leanOf(partner).slope)};
      if(X.spread.flat)break;                                // too flat for a tie to be trusted with
      const theirFeet=feetOf(partner);
      // candidates for the tie: the feet themselves and everything fastened to the feet or to the member
      const near=new Set(myFeet);
      for(const n of myFeet.concat([X]))for(const l of n.links)if(l.fastened)near.add(other(l,n));
      // a tie only stops the feet spreading when it is low: its underside within the lowest third of the height
      // from the feet to the top of the member (a collar tie up near the ridge does not do this job)
      const footTop=Math.max(...myFeet.map(n=>n.hi[1])),lowEnough=footTop+(X.hi[1]-footTop)*LEAN_RULES.tieBelow+VERIFY_TOL;
      const tie=[...near].find(T=>!T.tilt&&!T.skin&&T!==R&&T.lo[1]<=lowEnough&&Math.abs(T.axes[0][0]*mine.uphill[0]+T.axes[0][2]*mine.uphill[1])>.9&&
        Math.abs(offset(T))<=LEAN_RULES.tieWithin&&holdsFoot(T,X,myFeet)&&holdsFoot(T,partner,theirFeet));
      if(tie){lean={node:R,how:'lean',fastened:true,link,iv:supportStretch(X,R)};X.spread=null;break;}
    }
    if(!lean)continue;
    added.push([X,lean]);
    // Tied, but does the pair meet on anything at the top? Two sloping boards that only touch at their tips (a
    // roof whose ridge board has been taken out) are joined there by a few slanted nails and nothing else. A
    // ridge piece between them, or a gusset or a collar tie fastened across the two near the top, is what makes
    // that joint. Without one it is marginal: reported once for the pair, on the member that comes first.
    const partner=lean.node;
    if(!opposes(partner)||X.i>partner.i)continue;
    const joinsBoth=atTop.some(link=>{
      const C=other(link,X);
      return C!==partner&&link.kind==='side'&&C.links.some(l=>l.fastened&&other(l,C)===partner);
    });
    if(joinsBoth)continue;
    found.push({level:'warn',code:'ridge',ids:[X.id,partner.id],group:X.name+'|ridge',rank:X.h[0],
      text:`The ${X.name} meets ${partner.name===X.name?'its partner':'the '+partner.name} at the top with nothing between the two and nothing across the joint. Two sloping boards that only touch at their tips are held there by a few slanted nails, which work loose.`,
      fix:'Fit a ridge board between the two and nail both to it, or fasten a plywood gusset or a short level board across the pair just below the top.'});
  }
  for(const[X,lean]of added)X.sup.push(lean); // all at once, so that one pair does not change what the next one sees
}
/* where a support Y meets the piece X, measured along X's own length and width from its middle: [[a,b],[a,b]] */
function supportStretch(X,Y){
  return[0,1].map(n=>{
    const[min,max]=projectNode(Y,X.c,X.axes[n]),H=X.h[n];
    if(min>H)return[H,H];     // it butts the far end
    if(max<-H)return[-H,-H];  // it butts the near end
    return[Math.max(min,-H),Math.min(max,H)];
  });
}

/* ---------- 8. What each piece is for ---------- */
function verifyUses(model,facts){
  const inherited=(X,depth)=>{
    if(X.use)return X.use;
    if(X.mattress)return'bedSlat';
    if(depth>3)return'';
    let best='';
    for(const C of X.carries){
      const use=inherited(C,depth+1)||(C.cls==='plate'?'general':'');
      if(use&&(!best||USES[use].psf>USES[best].psf))best=use;
    }
    return best;
  };
  const resolved=model.wood.map(n=>inherited(n,0)||(n.cls==='plate'?'general':'none'));
  model.wood.forEach((n,k)=>{
    if(!n.declared&&resolved[k]!=='none'&&n.cls!=='post'&&!facts.guessed.includes(n.name))facts.guessed.push(n.name);
    n.use=resolved[k];
    if(n.cls==='post')return;
    if(!(n.name in facts.uses))facts.uses[n.name]=n.use;
    // two designs in one project may use the same name for pieces with different jobs
    else if(facts.uses[n.name]!==n.use&&!facts.alsoUses.some(([name,use])=>name===n.name&&use===n.use))facts.alsoUses.push([n.name,n.use]);
  });
}

/* ---------- 9. Check b: bearing and overhang ---------- */
/* does a piece carry more than itself? (a use with a design load, or tanks or a mattress standing on it) */
const carriesLoad=X=>USES[X.use||'none'].psf>0||X.tankW>0||X.tankPsf>0||X.loads.length>0;
/* what it carries, for messages */
const loadWords=X=>X.tankW>0||X.tankPsf>0?'full fish tanks':USES[X.use||'none'].label;
function verifyBearing(model,found){
  for(const X of model.wood){
    if(X.wall&&!X.wallEdge)continue;                 // screwed flat to the wall: the wall holds it
    if(X.wallEdge&&X.supported&&!X.sup.length){
      // on the wall list, but only its thin back edge meets the wall and nothing else holds it
      const grip=extentOf(X,1),reach=X.hi[2]-X.wallZ,loaded=carriesLoad(X);
      found.push({level:loaded?'stop':'warn',code:'cantilever',ids:[X.id],group:'wall|'+X.name,rank:reach,
        text:`The ${X.name} is meant to be screwed to the wall, but only its ${fmt(grip)} back edge meets the wall and it sticks out ${fmt(reach)}${loaded?', carrying '+loadWords(X):''}. Screws through an edge that thin cannot hold it level.`,
        fix:`Screw a cleat and brackets to the wall and fasten the ${X.name} onto them, or hold it with a piece that stands at least ${fmt(Math.ceil(reach/LEVER*2)/2)} tall against the wall.`});
      continue;
    }
    if(!X.supported||X.grounded||X.tilt||X.hung||!X.sup.length)continue;
    // the patch of floor plan its supports cover
    const lo=[Infinity,0,Infinity],hi=[-Infinity,0,-Infinity],patch=(s,k)=>{
      const a=Math.max(X.lo[k],s.node.lo[k]),b=Math.min(X.hi[k],s.node.hi[k]);
      return a<=b?[a,b]:(s.node.lo[k]>X.hi[k]?[X.hi[k],X.hi[k]]:[X.lo[k],X.lo[k]]);
    };
    for(const s of X.sup)for(const k of[0,2]){
      const[a,b]=patch(s,k);
      lo[k]=Math.min(lo[k],a);
      hi[k]=Math.max(hi[k],b);
    }
    const off=k=>X.c[k]<lo[k]?lo[k]-X.c[k]:X.c[k]>hi[k]?X.c[k]-hi[k]:0;
    const k=off(0)>=off(2)?0:2,past=off(k);
    if(past<=.1)continue;
    const holders=X.sup.filter(s=>s.fastened),names=piecesLabel(X.sup.map(s=>s.node));
    if(!holders.length){
      found.push({level:'stop',code:'tips-off',ids:[X.id,...X.sup.map(s=>s.node.id)],group:X.name,rank:past,
        text:`The ${X.name} rests on ${names} with its middle ${fmt(past)} past the edge of its support, and nothing fastens it. It will tip off.`,
        fix:'Slide it back over its support, add a support under the far end, or fasten it down.'});
      continue;
    }
    // fastened at one end only: fine while it is short compared with how much joint holds it
    const reach=X.c[k]>hi[k]?X.hi[k]-hi[k]:lo[k]-X.lo[k];
    let grip=0;
    for(const s of holders){
      const along=patch(s,k);
      grip=Math.max(grip,s.how==='side'?overlapOf(X,s.node,1):along[1]-along[0]);
    }
    if(reach>LEVER*grip+.1){
      // carrying nothing but itself it is marginal; with a load on it the fasteners at that one end give way
      const loaded=carriesLoad(X);
      found.push({level:loaded?'stop':'warn',code:'cantilever',ids:[X.id,...holders.map(s=>s.node.id)],group:X.name,rank:reach,
        text:loaded?`The ${X.name} sticks out ${fmt(reach)} from ${piecesLabel(holders.map(s=>s.node))} and is held at that one end only, carrying ${loadWords(X)}. The joint works like a lever, and fasteners alone cannot hold a loaded piece level.`
          :`The ${X.name} sticks out ${fmt(reach)} from ${piecesLabel(holders.map(s=>s.node))} and is held at that one end only. The joint works like a lever and will work loose.`,
        fix:`Support the far end too, put a bracket or brace under it, or keep it shorter than ${fmt(LEVER*grip)}.`});
    }
  }
}

/* ---------- 10. Check c: spans ---------- */
/* fish tanks: which members carry each one, and how hard */
function verifyTankLoads(model,found){
  for(const T of model.props){
    if(T.p.mat!=='tank'||T.grounded)continue;
    if(!T.rests.length){
      found.push({level:'stop',code:'tank-floating',ids:[T.id],group:'t'+T.id,rank:T.weight,
        text:`A fish tank (about ${lbText(T.weight)} when full) rests on nothing. Its bottom is ${fmt(T.lo[1])} above the floor.`,
        fix:'Put a shelf or frame under it, or set it on the floor.'});
      continue;
    }
    const area=extentOf(T,0)*extentOf(T,2);
    let covered=0;
    for(const Y of T.rests)covered+=overlapOf(T,Y,0)*overlapOf(T,Y,2);
    if(covered<.9*area){
      found.push({level:'warn',code:'tank-overhang',ids:[T.id,...T.rests.map(n=>n.id)],group:'tank',rank:1-covered/area,
        text:`A fish tank hangs over the edge of ${piecesLabel(T.rests)}: only ${Math.round(100*covered/area)}% of its bottom is carried. A tank must be carried along its whole rim.`,
        fix:'Make the shelf under it as long and as deep as the tank, or move the tank fully onto it.'});
    }
    // the members under the tank: the ones it stands on, and those under the deck it stands on
    const under=n=>overlapOf(T,n,0)>-.5&&overlapOf(T,n,2)>-.5;
    let beams=T.rests.filter(n=>n.cls==='beam');
    const plates=T.rests.filter(n=>n.cls!=='beam');
    for(const P of plates)for(const s of P.sup){
      if(s.how==='bear'&&s.node.cls==='beam'&&under(s.node)&&!beams.includes(s.node))beams.push(s.node);
    }
    const declared=beams.filter(n=>n.declared&&n.use==='tankRail');
    if(declared.length)beams=declared;
    else if(beams.length){
      // nobody said which members are the rails: take the direction most of the wood under the tank runs in
      const along=k=>beams.filter(n=>runAxis(n)===k),length=k=>along(k).reduce((sum,n)=>sum+Math.max(0,overlapOf(T,n,k)),0);
      beams=along(length(0)>=length(2)?0:2);
    }
    if(!beams.length){
      for(const P of plates){
        P.tankPsf+=T.weight/(area/144);
        P.tankLb+=T.weight/plates.length;
      }
      continue;
    }
    // shared evenly, spread over the tank's length plus an inch (the same rule as the fish rack engine)
    for(const B of beams){
      const k=runAxis(B);
      B.tankLoads.push({a:Math.max(T.lo[k],B.lo[k]),b:Math.min(T.hi[k],B.hi[k]),w:T.weight/beams.length/(extentOf(T,k)+1)});
    }
  }
  for(const B of model.wood){
    for(const t of B.tankLoads){
      const mid=(t.a+t.b)/2;
      let sum=0;
      for(const u of B.tankLoads)if(u.a<=mid&&mid<=u.b)sum+=u.w;
      B.tankW=Math.max(B.tankW,sum);
    }
  }
}
/* A shelf or deck that carries tanks itself (no rails under it) must sit on wood. Held between two sides by
   nothing but the screws through them, every pound of water hangs on those screws. (Rails are checked the same
   way where they meet their uprights, in verifyBeam.) */
function verifyTankSeats(model,found){
  for(const X of model.wood){
    if(!(X.tankLb>0)||X.grounded||!X.supported||!X.sup.length||X.sup.some(s=>s.how==='bear'))continue;
    const holders=X.sup.map(s=>s.node);
    found.push({level:X.tankLb>TANK_ON_SCREWS_LB?'stop':'warn',code:'tank-on-screws',ids:[X.id,...holders.map(n=>n.id)],group:X.name,rank:X.tankLb,
      text:`About ${lbText(X.tankLb)} of fish tank hangs on the fasteners where the ${X.name} meets ${piecesLabel(holders)}. Water weight should go straight down through wood, not through screws.`,
      fix:`Fasten a cleat under each end of the ${X.name}, or stand it on top of its supports, so it sits on wood.`});
  }
}
/* The stretches of a piece with nothing under them, along its length (n = 0) or its width (n = 1).
   Only supports that cross the lane at `at` (within `band`) on the other axis count.
   Returns {none, rests, gaps}: none = no support crosses the lane at all; rests = the supported stretches;
   gaps = [{kind:'span'|'over', clear, L, mid, left, right}] where L is the design span: center to center of
   the supports (at most 1 3/4" into each), or twice the length of an overhang. */
function spanGaps(X,n,at,band){
  const m=1-n,H=X.h[n],list=[];
  for(const s of X.sup){
    if(s.iv[m][1]<at-band-.05||s.iv[m][0]>at+band+.05)continue;
    list.push({a:s.iv[n][0],b:s.iv[n][1],sups:[s],floor:false});
  }
  // a rotated piece with one end on the floor is carried by the floor there
  if(X.floor&&X.floor[m][1]>=at-band-.05&&X.floor[m][0]<=at+band+.05)list.push({a:X.floor[n][0],b:X.floor[n][1],sups:[],floor:true});
  if(!list.length)return{none:true,rests:[],gaps:[]};
  list.sort((p,q)=>p.a-q.a);
  const rests=[list[0]];
  for(const iv of list.slice(1)){
    const last=rests[rests.length-1];
    if(iv.a<=last.b+.1){last.b=Math.max(last.b,iv.b);last.sups.push(...iv.sups);last.floor=last.floor||iv.floor;}
    else rests.push(iv);
  }
  const gaps=[],into=iv=>Math.min((iv.b-iv.a)/2,1.75),first=rests[0],last=rests[rests.length-1];
  if(first.a>-H+.1)gaps.push({kind:'over',clear:first.a+H,L:2*(first.a+H),mid:(first.a-H)/2,left:null,right:first});
  for(let k=1;k<rests.length;k++){
    const l=rests[k-1],r=rests[k];
    gaps.push({kind:'span',clear:r.a-l.b,L:r.a-l.b+into(l)+into(r),mid:(l.b+r.a)/2,left:l,right:r});
  }
  if(last.b<H-.1)gaps.push({kind:'over',clear:H-last.b,L:2*(H-last.b),mid:(last.b+H)/2,left:last,right:null});
  return{none:false,rests,gaps};
}
/* the width of surface a framing member carries: halfway to the next member under the same surface, or all
   of what rests on it on a side where there is no other member */
/* The pieces a member carries, for working out its load: the ones that rest on it, and what comes straight
   down through a member that lies along the top of it. A cap plate on a top plate hands the rafters down to
   it, so two flat plates over a gap in the studs are checked as the beam they are being asked to be. The
   lower member is checked as if it carried all of it alone, which is on the safe side. */
function carriedThrough(X,depth){
  const out=[];
  for(const C of X.carries){
    out.push(C);
    const lyingAlong=!X.tilt&&!C.tilt&&C.cls==='beam'&&(depth||0)<3&&Math.abs(vDot(C.axes[0],X.axes[0]))>.9&&
      C.sup.some(s=>s.node===X&&s.how==='bear');
    if(lyingAlong)out.push(...carriedThrough(C,(depth||0)+1));
  }
  return out;
}
function tributaryWidth(X){
  const e=X.axes[0],len=Math.hypot(e[0],e[2])||1,across=[-e[2]/len,0,e[0]/len];
  const reach=[X.planW/2,X.planW/2];
  let minus=Infinity,plus=Infinity;
  for(const C of carriedThrough(X).concat(X.loads)){
    const[min,max]=projectNode(C,X.c,across);
    reach[0]=Math.max(reach[0],-min);
    reach[1]=Math.max(reach[1],max);
    const sharers=C.prop?C.rests:C.sup.map(s=>s.node);
    for(const B of sharers){
      if(B===X||B.cls!=='beam'||Math.abs(vDot(B.axes[0],e))<.9)continue;
      const d=(B.c[0]-X.c[0])*across[0]+(B.c[2]-X.c[2])*across[2];
      if(d>.5)plus=Math.min(plus,d);
      if(d<-.5)minus=Math.min(minus,-d);
    }
  }
  return(plus<Infinity?plus/2:reach[1])+(minus<Infinity?minus/2:reach[0]);
}
/* one finding for one stretch of one member */
function spanFinding(X,gap,result,level,section,load,useKey,found,flat){
  // flat: how much of the span is level (1 on the flat, less up a slope); the limits are worked out on the level
  const use=USES[useKey],good=maxSpanFor(section,load,useKey)/(flat||X.run||1),over=gap.kind==='over';
  const tanks=X.tankW>0||X.tankPsf>0,hanging=X.hungLb>0&&!tanks?`about ${lbText(X.hungLb)} that hangs from it on bought hardware`:'';
  const carrying=tanks?`full fish tanks`:use.psf>0?`${use.label} (about ${use.psf} lb per square foot)${hanging?' and '+hanging:''}`
    :hanging?`its own weight and ${hanging}`:'only its own weight';
  const length=over?gap.clear:gap.L,limit=over?good/2:good;
  const verdict=level==='stop'
    ?`A ${sectionText(X)} is good for about ${fmt(Math.floor(limit))} there, so it would be overloaded.`
    :`It will hold, but a ${sectionText(X)} that long sags about ${fmt(result.sag)}. About ${fmt(Math.floor(limit))} is the most that stays straight.`;
  const thicker=X.cls==='beam'&&X.up===2&&X.mat.t!==X.mat.w?'stand it on edge, or use a board that is taller on edge (the next size up, such as a 2x6 in place of a 2x4)':X.cls==='beam'?'use a board that is taller on edge (the next size up, such as a 2x6 in place of a 2x4)':'use a thicker piece';
  found.push({level,code:over?'overhang':'span',ids:[X.id],group:X.name+'|'+useKey+'|'+gap.kind,rank:result.ratio,
    text:over?`The ${X.name} sticks out ${fmt(length)} past its last support, carrying ${carrying}. ${verdict}`
      :`The ${X.name} spans ${fmt(length)} between supports, carrying ${carrying}. ${verdict}`,
    fix:over?`Move a support closer to that end, shorten the overhang to ${fmt(Math.floor(limit))} or less, or ${thicker}.`
      :`Add a support near the middle, keep the span to ${fmt(Math.floor(limit))} or less, or ${thicker}.`});
}
/* stop, warn or nothing for one result */
function spanLevel(result,useKey){
  const use=USES[useKey];
  if(result.stressRatio>VERIFY_OVER||result.sagRatio>(use.stopSag||2)*VERIFY_OVER)return'stop';
  return result.sagRatio>VERIFY_OVER?'warn':'';
}
function verifySpans(model,found){
  for(const X of model.wood){
    // a square piece on the floor lies on it all the way along; a rotated one only touches down at one end
    if(!X.supported||(X.grounded&&!X.floor)||(X.wall&&!X.wallEdge)||X.hung||!X.sup.length||X.cls==='post')continue;
    const tanks=X.tankW>0||X.tankPsf>0,useKey=tanks?'tankRail':X.use;
    // a piece that carries nothing is still checked for its own weight: a long thin rail sags all by itself
    if(USES[X.use].hinged&&!tanks)continue;
    if(X.cls==='beam')verifyBeam(X,useKey,model,found);
    else verifyPlate(X,useKey,found);
  }
}
function verifyBeam(X,useKey,model,found){
  // (a hole or a notch takes wood out of the width over the whole span: the net width, js/shapecheck.js)
  const p=X.p,netW=p.shape?shapeNetWidth(p):p.w,section=X.up===1?sectionOf(p.t,netW,X.sheet):sectionOf(netW,p.t,X.sheet);
  // under tanks the tanks are the load (their 11.25 lb per gallon allows for the shelf); otherwise the strip of
  // surface this member carries, plus its own weight
  // What hangs from it on bought hardware (a drawer on its slides) is spread along its length.
  const psf=USES[X.use].psf,hanging=X.hungLb/(2*X.h[0]);
  const load=X.tankW>0?X.tankW:(psf>0?psf/144*tributaryWidth(X):0)+WOOD_RULES.DENSITY*section.A+hanging;
  const lane=spanGaps(X,0,0,1e9);
  if(lane.none)return;
  let worst=null;
  const cap=X.tankW>0&&X.up===1?TANK_RAIL_MAX_SPAN[p.mat]:0;
  let gaps=lane.gaps;
  if(X.tilt){
    // One of a pair of rafters with nothing to stop the pair spreading (see verifyLeaning): its upper end is
    // not carried, and that is a stop however short it is.
    const open=X.spread?gaps.find(g=>g.kind==='over'&&(X.spread.top>0?!g.right:!g.left)):null;
    if(open){
      const partner=X.spread.partner.name,same=partner===X.name;
      found.push({level:'stop',code:'spread',ids:[X.id,X.spread.partner.id],group:X.name+'|'+(X.spread.flat?'flat':'tie'),rank:open.clear,
        text:X.spread.flat
          ?`The ${X.name} leans against ${same?'its partner':'the '+partner} at the top, and the two slope only ${Math.round(X.spread.slope*120)/10} in 12. Flatter than ${LEAN_RULES.minSlope*12} in 12, a pair like that pushes the tops of the walls apart harder than a tie across them can be trusted to hold.`
          :`The ${X.name} leans against ${same?'its partner':'the '+partner} at the top, and nothing ties their lower ends together. The weight of the roof pushes the two apart at the bottom, the walls spread and the ridge drops.`,
        fix:X.spread.flat
          ?`Make the roof steeper, ${LEAN_RULES.minSlope*12} in 12 or more, or hold the ridge up on posts.`
          :`Fasten a level board (a rafter tie) across from one to the other, low down at the top of the walls, beside this pair or no more than ${fmt(LEAN_RULES.tieWithin-2)} from it.`});
      gaps=gaps.filter(g=>g!==open);
    }
    // A sloping member held at its lower end only works like a lever on that joint, as a level one does
    // (verifyBearing): it may reach LEVER times the length it bears on.
    for(const gap of gaps){
      const rest=gap.left||gap.right,grip=rest.b-rest.a;
      if(gap.kind!=='over'||rest.floor||gap.clear<=LEVER*grip+.1)continue;
      const loaded=carriesLoad(X),holders=rest.sups.map(s=>s.node);
      found.push({level:loaded?'stop':'warn',code:'cantilever',ids:[X.id,...holders.map(n=>n.id)],group:X.name,rank:gap.clear,
        text:`The ${X.name} sticks out ${fmt(gap.clear)} from ${piecesLabel(holders)} and is held at that one end only${loaded?', carrying '+loadWords(X):''}. The joint works like a lever, and fasteners alone cannot hold a sloping piece that long.`,
        fix:`Support the far end too (a ridge board with a partner and a tie, a wall or a post), or keep it shorter than ${fmt(LEVER*grip)}.`});
      gaps=gaps.filter(g=>g!==gap);
    }
  }
  for(const gap of gaps){
    const result=beamCheck(section,gap.L*X.run,load,useKey);
    if(cap&&gap.kind==='span'&&gap.L>cap+1e-6){
      found.push({level:'stop',code:'span-cap',ids:[X.id],group:X.name,rank:gap.L,
        text:`The ${X.name} spans ${fmt(gap.L)} between uprights under fish tanks. A ${p.mat} rail should never span more than ${fmt(cap)} there, however light the tanks.`,
        fix:'Add an upright under the middle of it, or use a rail that is taller on edge (a 2x6 or 2x8 in place of a 2x4).'});
    }
    if(!worst||result.ratio>worst.result.ratio)worst={gap,result};
  }
  if(worst){
    const level=spanLevel(worst.result,useKey);
    if(level)spanFinding(X,worst.gap,worst.result,level,section,load,useKey,found);
  }
  if(!(X.tankW>0))return;
  // what each support of a tank rail has to carry (the fish rack engine's rule: the load on one full span)
  lane.rests.forEach((rest,k)=>{
    const before=lane.gaps.find(g=>g.right===rest),after=lane.gaps.find(g=>g.left===rest);
    const size=g=>!g?0:g.kind==='over'?g.clear:g.L;
    const R=X.tankW*Math.max(size(before),size(after));
    if(!(R>0)||rest.floor)return;               // the floor takes whatever comes down on it
    const bearing=rest.sups.filter(s=>s.how==='bear');
    if(!bearing.length){
      const holders=rest.sups.map(s=>s.node);
      found.push({level:R>300?'stop':'warn',code:'tank-on-screws',ids:[X.id,...holders.map(n=>n.id)],group:X.name,rank:R,
        text:`About ${lbText(R)} of fish tank hangs on the fasteners where the ${X.name} meets ${piecesLabel(holders)}. Water weight should go straight down through wood, not through screws.`,
        fix:'Stand an upright or a block under the rail at that joint so the rail sits on wood.'});
      return;
    }
    // Where this rest is an end of the rail and another tank rail butts that end (a rail joint of a long fish
    // wall), the two rail ends share one load: see railJointOf and postLoadOf.
    const atEnd=k===0&&!before?-1:k===lane.rests.length-1&&!after?1:0;
    const joint=atEnd?railJointOf(X,atEnd):'';
    for(const s of bearing){
      const Y=s.node;
      model.reactions.push({node:Y,lb:R/bearing.length,y:X.lo[1],joint,
        x:(Math.max(X.lo[0],Y.lo[0])+Math.min(X.hi[0],Y.hi[0]))/2,z:(Math.max(X.lo[2],Y.lo[2])+Math.min(X.hi[2],Y.hi[2]))/2});
    }
  });
}
function verifyPlate(X,useKey,found){
  // a strip one inch wide, carrying what stands on it
  // (what hangs from it on bought hardware is spread over its whole face)
  // (an opening takes its share of the wood out of every strip: the worst share, js/shapecheck.js)
  const p=X.p,section=sectionOf(p.shape?1-shapeOpenShare(p):1,p.t,X.sheet),load=X.tankPsf>0?X.tankPsf/144:USES[X.use].psf/144+WOOD_RULES.DENSITY*p.t+X.hungLb/(p.l*p.w);
  // how much of its length (0) and of its width (1) is level: 1 on the flat, less up a slope
  const flat=[X.run,Math.sqrt(Math.max(0,1-X.axes[1][1]*X.axes[1][1]))];
  // the longest stretch of a lane, worked out: { gap, result, n } or null when the lane has no open stretch
  const worstOf=(lane,n)=>{
    const gap=lane.gaps.reduce((worst,g)=>!worst||g.L>worst.L?g:worst,null);
    return gap?{gap,result:beamCheck(section,gap.L*flat[n],load,useKey),n}:null;
  };
  const report=worst=>{
    const level=worst?spanLevel(worst.result,useKey):'';
    if(level)spanFinding(X,worst.gap,worst.result,level,section,load,useKey,found,flat[worst.n]);
  };
  const lengthways=spanGaps(X,0,0,X.h[1]/2);
  if(lengthways.none){
    const crossways=spanGaps(X,1,0,X.h[0]/2);
    if(!crossways.none){report(worstOf(crossways,1));return;}                // nothing crosses its middle lengthways: it spans the other way
    // Nothing passes under its middle either way (a top standing on four corner legs, with no aprons). It has
    // to make the distance between its supports in both directions, so the worse of the two decides.
    const a=worstOf(spanGaps(X,0,0,1e9),0),b=worstOf(spanGaps(X,1,0,1e9),1);
    report(!b||(a&&a.result.ratio>=b.result.ratio)?a:b);
    return;
  }
  if(!lengthways.gaps.length){
    // Carried all the way along its middle (a deck on a joist that runs its length, a top on one center beam).
    // What is left is the other direction: how far it reaches sideways to the next support, or past the last one.
    report(worstOf(spanGaps(X,1,0,X.h[0]/2),1));
    return;
  }
  const along=worstOf(lengthways,0);
  if(!spanLevel(along.result,useKey))return;                                 // it spans its length without trouble
  // it does not make it lengthways: can it span the other way, across the middle of the worst stretch?
  const crossways=spanGaps(X,1,along.gap.mid,Math.max(1,along.gap.clear/4));
  let worst=along;
  if(!crossways.none){
    if(!crossways.gaps.length)return;                                        // carried all the way across there
    const across=worstOf(crossways,1);
    if(across.gap.kind==='span'){                                            // carried on both sides of that stretch
      if(!X.sheet&&across.gap.clear<=16*p.t)return;                          // a board resting on both long edges
      if(X.sheet){
        if(!spanLevel(across.result,useKey))return;                          // plywood works either way
        if(across.result.ratio<worst.result.ratio)worst=across;
      }
    }
  }
  report(worst);
}
/* The rail that butts the end `side` (-1 the start of its length, 1 the far end) of the tank rail X end to end,
   as the two rail pieces of a long fish wall meet over a line of uprights: a key naming the pair, or ''. */
function railJointOf(X,side){
  const k=runAxis(X),endAt=X.c[k]+side*Math.sign(X.axes[0][k]||1)*X.h[0];
  for(const link of X.links){
    const Y=link.a===X?link.b:link.a,j=link.j;
    if(!j||!isTankRail(Y)||j.fa!=='end'||j.fb!=='end'||j.k!==k||runAxis(Y)!==k)continue;
    if(Math.abs(j.plane-endAt)<.05)return[X.id,Y.id].sort().join('|');
  }
  return'';
}
/* What a post or upright carries of the fish tanks above it: what rests on it, and everything that comes down
   the same line from above. The rack engine's rule is that each support carries the load of one full span of
   the rail on it (rackPlan's upLoad). Where two rail pieces meet end to end over one upright (a 4x4 at a rail
   joint), each rail end would bring a full span of its own, but the two together are one span: half of each
   neighbouring bay, the same as any upright inside a rail. So of the two ends of one joint only the heavier
   counts. */
function postLoadOf(V,model){
  let lb=0;
  const joints=new Map();
  for(const r of model.reactions){
    const direct=r.node===V;
    const below=V.hi[1]<=r.y+.1&&r.x>=V.lo[0]-.5&&r.x<=V.hi[0]+.5&&r.z>=V.lo[2]-.5&&r.z<=V.hi[2]+.5;
    if(!direct&&!below)continue;
    if(r.joint)joints.set(r.joint,Math.max(joints.get(r.joint)||0,r.lb));
    else lb+=r.lb;
  }
  for(const share of joints.values())lb+=share;
  return lb;
}
/* posts and uprights under fish tanks: everything that comes down the same line */
function verifyPosts(model,found){
  if(!model.reactions.length)return;
  for(const V of model.wood){
    if(V.cls!=='post')continue;
    const lb=postLoadOf(V,model);
    const safe=postSafeLoad(V.p.mat,V.p.l),long=safe<postSafeLoad(V.p.mat,0)-.5; // long enough that buckling, not crushing, decides
    if(lb>safe*VERIFY_OVER){
      // (a thicker upright is only the fix when it is not one already)
      const thicker=V.p.mat==='4x4'?'':'Use a thicker upright (a 4x4), or put',fix=thicker?thicker+' the uprights closer together so each one carries less.':'Put the uprights closer together so each one carries less (shorter bays), or use lighter tanks.';
      found.push({level:'stop',code:'post-load',ids:[V.id],group:V.name+'|'+V.p.mat,rank:lb/safe,
        text:`The ${V.name} carries about ${lbText(lb)} of fish tanks. A ${V.mat.short} standing on end${long?` and ${fmt(V.p.l)} long`:''} is good for about ${lbText(safe)}${long?', because a post that long and thin bows sideways under load':''}.`,
        fix});
    }
  }
}

/* ---------- Check c, continued: rails under fish tanks, where they end and where two of them meet ----------
   A fish wall longer than the longest board has its rails joined end to end over a line of uprights
   (js/rackjoints.js). The span check above already sees each rail piece as what it is, a span of its own that
   ends on that line. What a joint needs beyond that is checked here, on the pieces as they are:
     end-bearing   each end of a rail under tanks that rests on wood sits on at least RAIL_RULES.bearing of it
                   (a rail end on the edge of an upright crushes the corner of the upright and slides off);
     rail-joint    where two such rails meet end to end, something holds them together: a framing piece screwed
                   to both, or two (a cross piece under each end) that are screwed to each other; and one piece of
                   plywood rests on both and runs at least RAIL_RULES.bridge past the joint each way (a deck seam
                   that lands on the joint ties nothing);
     post-offset   a post or upright that carries tank weight and does not stand on the floor stands with at least
                   RAIL_RULES.under of its foot straight over a post or upright below, or over a frame that lies on
                   the floor, within RAIL_RULES.drop under it: the weight goes straight down through wood and does
                   not land on the middle of a rail.
   All three are stops. */
const RAIL_RULES={bearing:1.5,bridge:3,under:.9,drop:14};
const isTankRail=n=>n.cls==='beam'&&!n.tilt&&(n.tankW>0||n.use==='tankRail');
function verifyRailEnds(model,found){
  for(const X of model.wood){
    if(!(X.tankW>0)||X.cls!=='beam'||X.tilt||!X.supported||X.grounded||X.hung)continue;
    // the stretches of its length (from -h to h) that sit on wood
    const bear=X.sup.filter(s=>s.how==='bear').map(s=>s.iv[0].slice()).sort((a,b)=>a[0]-b[0]),H=X.h[0],merged=[];
    for(const iv of bear){
      const last=merged[merged.length-1];
      if(last&&iv[0]<=last[1]+.05)last[1]=Math.max(last[1],iv[1]);
      else merged.push(iv);
    }
    if(!merged.length)continue;                                   // hangs on fasteners: tank-on-screws says so
    const ends=[[merged[0],merged[0][0]+H],[merged[merged.length-1],H-merged[merged.length-1][1]]];
    for(const[iv,fromEnd]of ends){
      if(fromEnd>.05)continue;                                    // the end sticks out past its support: the overhang check says so
      const length=iv[1]-iv[0];
      if(length>=RAIL_RULES.bearing-.01)continue;
      found.push({level:'stop',code:'end-bearing',ids:[X.id],group:X.name+'|end',rank:RAIL_RULES.bearing-length,
        text:`An end of the ${X.name} sits on only ${fmt(r16(length))} of wood. Under full fish tanks each end of a rail needs at least ${fmt(RAIL_RULES.bearing)} under it, or it crushes the corner of what it sits on and can slip off.`,
        fix:`Put a whole upright under that end (where two rails meet, an upright under each end), so the rail sits on ${fmt(RAIL_RULES.bearing)} or more.`});
    }
  }
}
function verifyRailJoints(model,found){
  const other=(link,n)=>link.a===n?link.b:link.a;
  const fastenedTo=n=>new Set(n.links.filter(l=>l.fastened).map(l=>other(l,n)));
  const seen=new Set();
  for(const X of model.wood){
    if(!isTankRail(X))continue;
    for(const link of X.links){
      const Y=other(link,X),j=link.j;
      if(!j||!isTankRail(Y)||j.fa!=='end'||j.fb!=='end'||runAxis(X)!==runAxis(Y)||j.k!==runAxis(X))continue;
      const key=Math.min(X.i,Y.i)+'|'+Math.max(X.i,Y.i);
      if(seen.has(key))continue;
      seen.add(key);
      // held together: one framing piece screwed to both, or two screwed to each other, one to each rail
      const framing=n=>!n.sheet&&!n.prop&&n!==X&&n!==Y;
      const nearX=[...fastenedTo(X)].filter(framing),nearY=new Set([...fastenedTo(Y)].filter(framing));
      const tied=nearX.some(Z=>nearY.has(Z)||[...fastenedTo(Z)].some(W=>nearY.has(W)));
      if(!tied)found.push({level:'stop',code:'rail-joint',ids:[X.id,Y.id],group:'tie|'+X.name,rank:1,
        text:`Two pieces of the ${X.name} meet end to end, and nothing holds them to each other. Each could be pushed off its upright on its own.`,
        fix:'Put a cross piece between the rails just inside the end of each rail piece and screw the two cross pieces to each other (or screw a block across the joint), and screw each rail end into its cross piece.'});
      // a piece of plywood that rests on both and runs well past the joint each way
      const plane=j.plane,k=j.k;
      const bridged=X.links.some(l=>{
        const P=other(l,X);
        return P.sheet&&l.kind==='bear'&&l.lower===X&&P.links.some(m=>m.kind==='bear'&&m.lower===Y&&other(m,P)===Y)&&
          P.lo[k]<=plane-RAIL_RULES.bridge+.01&&P.hi[k]>=plane+RAIL_RULES.bridge-.01;
      });
      if(!bridged)found.push({level:'stop',code:'rail-joint',ids:[X.id,Y.id],group:'deck|'+X.name,rank:1,
        text:`Where two pieces of the ${X.name} meet end to end, no piece of the deck runs across the joint: a seam of the plywood lands on it, so the deck does not tie the two together.`,
        fix:`Cut the deck so that a seam lands inside a bay, and one piece of plywood runs at least ${fmt(RAIL_RULES.bridge)} past the joint each way.`});
    }
  }
}
/* ---------- Check c, continued: center posts under an aquarium stand (STAND_RULES) ----------
   On a design that is a stand (its preset declares `stand`) and is STAND_RULES.from long or longer along its rails,
   every rail that carries tanks is held up by uprights no more than STAND_RULES.most apart, middle to middle. The
   load check alone (a 2x4 at 70% over 51 1/2") let a stand of two 20 gallon tanks through with nothing under the
   middle, where the seam between the two tanks lands. A stop of its own, 'center-posts'. */
function verifyStandCenters(model,found){
  const stands=model.wood.filter(n=>n.stand);
  if(!stands.length)return;
  // how long each stand is, along each axis: the wood of its own placement (the pieces that share its declarations)
  const reach=new Map();
  for(const n of stands){
    if(!reach.has(n.own))reach.set(n.own,{lo:n.lo.slice(),hi:n.hi.slice()});
    const r=reach.get(n.own);
    for(let k=0;k<3;k++){r.lo[k]=Math.min(r.lo[k],n.lo[k]);r.hi[k]=Math.max(r.hi[k],n.hi[k]);}
  }
  for(const X of stands){
    if(!isTankRail(X)||!(X.tankW>0)||!X.supported||X.grounded||X.hung)continue;
    const k=runAxis(X),r=reach.get(X.own),length=r.hi[k]-r.lo[k];
    if(length<STAND_RULES.from-.05)continue;
    // the stretches of its length that sit on wood, merged, and the middle of each
    const bear=X.sup.filter(s=>s.how==='bear').map(s=>s.iv[0].slice()).sort((a,b)=>a[0]-b[0]),merged=[];
    for(const iv of bear){
      const last=merged[merged.length-1];
      if(last&&iv[0]<=last[1]+.05)last[1]=Math.max(last[1],iv[1]);
      else merged.push(iv);
    }
    if(merged.length<2)continue;   // held at one end or on fasteners: the bearing and tank-on-screws checks say so
    const middles=merged.map(iv=>(iv[0]+iv[1])/2);
    const apart=Math.max(...middles.slice(1).map((x,i)=>x-middles[i]));
    if(apart<=STAND_RULES.most+.05)continue;
    found.push({level:'stop',code:'center-posts',ids:[X.id],group:'center|'+X.name,rank:apart/STAND_RULES.most,
      text:`The ${X.name} under the tanks runs ${fmt(r16(apart))} from one upright to the next, on a stand ${fmt(r16(length))} long. A stand ${fmt(STAND_RULES.from)} or longer needs center posts: an upright at the front and one at the back, at least every ${fmt(STAND_RULES.most)} along the rails, and under the seam between two tanks where there is one. A longer span sags over the years, and the front glass of a tank can crack.`,
      fix:`Stand center posts (an upright at the front and one at the back, straight down to the floor) under the middle of the rails, or under the seam between the tanks, so that no rail runs more than ${fmt(STAND_RULES.most)} between uprights. Making the stand again from the presets window puts them in.`});
  }
}
function verifyPostsStacked(model,found){
  if(!model.reactions.length)return;
  // the pieces that can carry a post from below: other posts, and anything that lies on the floor; sorted along x
  const carriers=model.wood.filter(n=>!n.tilt&&(n.cls==='post'||n.grounded)).sort((a,b)=>a.lo[0]-b.lo[0]);
  const loaded=new Set(model.reactions.map(r=>r.node));
  for(const V of model.wood){
    if(V.cls!=='post'||V.tilt||V.grounded||!V.supported||!loaded.has(V))continue;
    const lb=postLoadOf(V,model);
    // how much of its foot is straight over a carrier within RAIL_RULES.drop under it (a grid of points on the foot)
    const near=[];
    // (carriers are sorted by their left edge; any that reaches V has its left edge before V's right edge)
    for(let c=0;c<carriers.length&&carriers[c].lo[0]<V.hi[0];c++){
      const C=carriers[c];
      if(C===V||C.hi[0]<=V.lo[0]||C.hi[1]>V.lo[1]+.05||C.hi[1]<V.lo[1]-RAIL_RULES.drop)continue;
      if(C.hi[2]<=V.lo[2]||C.lo[2]>=V.hi[2])continue;
      near.push(C);
    }
    const STEPS=6;
    let over=0;
    for(let a=0;a<STEPS;a++)for(let b=0;b<STEPS;b++){
      const x=V.lo[0]+(a+.5)*extentOf(V,0)/STEPS,z=V.lo[2]+(b+.5)*extentOf(V,2)/STEPS;
      if(near.some(C=>x>=C.lo[0]&&x<=C.hi[0]&&z>=C.lo[2]&&z<=C.hi[2]))over++;
    }
    const share=over/(STEPS*STEPS);
    if(share>=RAIL_RULES.under-1e-6)continue;
    found.push({level:'stop',code:'post-offset',ids:[V.id],group:V.name+'|offset',rank:1-share,
      text:`The ${V.name} carries about ${lbText(lb)} of fish tanks, but only ${Math.round(share*100)}% of its foot stands straight over an upright or a post below it. The rest of the weight comes down on the middle of the frame under it instead of going straight to the floor.`,
      fix:'Stand it directly above an upright of the row below (or a foot), so the weight goes straight down through wood.'});
  }
}

/* ---------- 11. Checks d and e work on each separate thing standing in the design ---------- */
function verifyComponents(model,asOne){
  const wood=model.wood,parent=wood.map((n,k)=>k),index=new Map(wood.map((n,k)=>[n,k]));
  const find=k=>{while(parent[k]!==k){parent[k]=parent[parent[k]];k=parent[k];}return k;};
  if(asOne)wood.forEach((n,k)=>{parent[k]=0;});
  else for(const n of wood)for(const link of n.links)parent[find(index.get(link.a))]=find(index.get(link.b));
  const byRoot=new Map();
  wood.forEach((n,k)=>{
    const root=find(k);
    if(!byRoot.has(root))byRoot.set(root,{wood:[],loads:[]});
    byRoot.get(root).wood.push(n);
    n.comp=root;
  });
  for(const P of model.props){
    if(!P.weight)continue;
    const home=asOne?wood[0]:P.rests[0];
    if(home)byRoot.get(home.comp).loads.push(P);
  }
  model.comps=[...byRoot.values()];
}
/* ---------- Check d0: a design held to the wall by its wall screws (WALL_SCREW_RULES) ----------
   comp is held by the screws into the wall studs that are really in it (n.wallScrews). Each part of it that
   stands on its own (pieces fastened to each other by wood joints, so separate sections that are bolted together
   are separate parts) must have as many screws as WALL_SCREW_RULES asks for its height, spread so that no point
   of its back is more than WALL_SCREW_RULES.reach from one. mustBeOnWall: it is too tall for its base to stand
   free (TIP_RULES.narrow). Returns true when the design is held (or a stop was given for it); false when it has
   too few screws and is short enough to be checked as standing free. The count and where they are go into
   model.wallScrewFacts, for Check my design. */
function verifyWallScrews(model,comp,mustBeOnWall,found){
  const wood=comp.wood,index=new Map(wood.map((n,k)=>[n,k])),parent=wood.map((n,k)=>k);
  const find=k=>{while(parent[k]!==k){parent[k]=parent[parent[k]];k=parent[k];}return k;};
  // (a design too big for the full check has no joints worked out: it is taken as one part)
  const linked=wood.some(n=>n.links.length);
  if(!linked)wood.forEach((n,k)=>{parent[k]=0;});
  for(const n of wood)for(const link of n.links){
    if(!link.fastened||link.hardware)continue;               // bolts between two sections leave them two parts
    const a=index.get(link.a),b=index.get(link.b);
    if(a!==undefined&&b!==undefined)parent[find(a)]=find(b);
  }
  const parts=new Map();
  wood.forEach((n,k)=>{const root=find(k);if(!parts.has(root))parts.set(root,[]);parts.get(root).push(n);});
  const report=[],short=[];
  for(const part of parts.values()){
    if(!part.some(n=>n.grounded))continue;                   // a door or a lid: it hangs on the part it is hinged to
    const screws=part.flatMap(n=>n.wallScrews);
    const top=Math.max(...part.map(n=>n.hi[1])),from=Math.min(...part.map(n=>n.lo[0])),to=Math.max(...part.map(n=>n.hi[0]));
    const lowest=screws.length?Math.min(...screws.map(s=>s.at[1])):top;
    const need=wallScrewsNeeded(top,lowest),gap=wallScrewGap(screws.map(s=>s.at[0]),from,to);
    // the screw worst off under a pull anywhere along the top (a pull near an end loads the end screw most)
    const worst=wallScrewWorst(screws.map(s=>({x:s.at[0],y:s.at[1],hold:s.hold})),from,to,top);
    const entry={count:screws.length,need,from,to,top,xs:screws.map(s=>s.at[0]).sort((a,b)=>a-b),worst};
    report.push(entry);
    if(screws.length<need||gap||worst.ratio>1+1e-6){
      entry.why=screws.length<need?`it has ${screws.length} and needs at least ${need}`:gap||
        `a pull at ${fmt(r16(worst.at-from))} from its left end puts about ${Math.round(worst.force)} lb on the screw at ${fmt(r16(worst.x-from))}, and with the factor of safety that is more than the ${worst.hold} lb that screw holds`;
      short.push({entry,part});
    }
  }
  if(!model.wallScrewFacts)model.wallScrewFacts={count:0,parts:[]};
  model.wallScrewFacts.parts.push(...report);
  model.wallScrewFacts.count+=report.reduce((sum,entry)=>sum+entry.count,0);
  if(!short.length)return true;
  if(!mustBeOnWall)return false;
  const R=WALL_SCREW_RULES,several=report.length>1;
  for(const{entry,part}of short){
    found.push({level:'stop',code:'wall-screws',ids:part.filter(n=>n.wallScrews.length||n.grounded).map(n=>n.id),group:'wall-screws|'+entry.from,rank:entry.need-entry.count,
      text:`${several?`The section from ${fmt(r16(entry.from))} to ${fmt(r16(entry.to))}`:'This'} is too tall for its depth to stand free and is held only by screws into the wall studs, but ${entry.why}. `+
        `It has to hold a pull of ${R.pull} lb anywhere along its top (a person pulling on it or climbing it) with a factor of safety of ${R.safety}, and a pull near an end is taken mostly by the screws near that end.`,
      fix:`Drive at least ${entry.need} structural screws through the back rail of its top frame into the studs, one about every ${ruleLength(R.every)} and none more than ${ruleLength(R.reach)} from an end${several?' of the section':''}, with ${fmt(R.bite)} of thread in the stud; where an end screw is still too weak, add one into the next stud or a second one into the same stud (Hardware, Structural screw into a wall stud).`});
  }
  return true;
}
/* ---------- Check d: tipping ---------- */
function verifyTipping(model,opt,found){
  for(const comp of model.comps){
    const feet=comp.wood.filter(n=>n.grounded);
    if(!feet.length)continue;                                   // hangs on the wall, or is not held up at all
    if(opt.wallFixed||comp.wood.some(n=>n.tied))continue;        // tied back to the wall: it cannot tip
    // held by its wall screws alone (WALL_SCREW_RULES): judged below, once its height and base are known
    const screwed=comp.wood.some(n=>n.screwed);
    if(!screwed&&comp.wood.some(n=>n.wall))continue;              // screwed to the wall: it cannot tip
    const all=comp.wood.concat(comp.loads);
    let weight=0,cx=0,cy=0,cz=0,top=0;
    for(const n of all){weight+=n.weight;cx+=n.weight*n.c[0];cy+=n.weight*n.c[1];cz+=n.weight*n.c[2];top=Math.max(top,n.hi[1]);}
    if(!(weight>0))continue;
    cx/=weight;cy/=weight;cz/=weight;
    // where it stands on the floor: all of a square piece's underside, but only the lowest corners of a rotated one
    const hull=convexHull(feet.flatMap(n=>n.tilt?nodeCorners(n).filter(corner=>corner[1]<=n.lo[1]+.3).map(corner=>[corner[0],corner[2]])
      :[[n.lo[0],n.lo[2]],[n.hi[0],n.lo[2]],[n.hi[0],n.hi[2]],[n.lo[0],n.hi[2]]]));
    if(hull.length<3)continue;
    const inside=insideHullBy(hull,[cx,cz]),ids=feet.map(n=>n.id),base=hullWidth(hull);
    if(screwed){
      const mustBeOnWall=top>=TIP_RULES.minHeight&&top>TIP_RULES.narrow*base+.01;
      if(verifyWallScrews(model,comp,mustBeOnWall,found))continue;   // held, or refused there
    }
    if(inside<-.05){
      found.push({level:'stop',code:'tips-over',ids,group:'c'+feet[0].id,rank:-inside,
        text:`This will fall over. Its weight (about ${lbText(weight)}) is centered ${fmt(-inside)} outside the area where it stands on the floor, on ${piecesLabel(feet)}.`,
        fix:'Add a leg or a support under the heavy side, or move the heavy pieces back over the feet.'});
      continue;
    }
    // A push down on a part that reaches past the feet. The thing tips about a line along the edge of its
    // footprint: the push has the overhang as its lever, the weight has the distance from that line back to
    // where the weight is centered. Every line it could tip about is tried: each edge of the footprint, and
    // lines through its corners in 10 degree steps.
    const lines=[];
    for(let k=0;k<hull.length;k++){
      const a=hull[k],b=hull[(k+1)%hull.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(len<1e-9)continue;
      lines.push([(b[1]-a[1])/len,-(b[0]-a[0])/len],[-(b[1]-a[1])/len,(b[0]-a[0])/len]);
    }
    for(let deg=0;deg<360;deg+=10)lines.push([Math.cos(deg*Math.PI/180),Math.sin(deg*Math.PI/180)]);
    let worst=null;
    for(const d of lines){
      let edge=-Infinity;
      for(const corner of hull)edge=Math.max(edge,corner[0]*d[0]+corner[1]*d[1]);
      const arm=Math.max(0,edge-(cx*d[0]+cz*d[1]));               // how far inside that line the weight is centered
      for(const n of all){
        if(n.grounded&&!n.tilt)continue;                           // a square piece on the floor cannot be pushed down
        const reach=(d[0]>0?n.hi[0]:n.lo[0])*d[0]+(d[1]>0?n.hi[2]:n.lo[2])*d[1]-edge; // how far it sticks out past the line
        if(reach<=TIP_RULES.minReach)continue;
        // where somebody sits or stands, a grown person's weight; it cannot be centered on the very end
        const people=!n.prop&&!!USES[n.use||'none'].people,lever=people?reach-TIP_RULES.personInset:reach;
        if(lever<=0)continue;
        const push=weight*arm/lever,warnAt=people?TIP_RULES.personWarn:TIP_RULES.pushWarn;
        if(push<warnAt&&(!worst||push/warnAt<worst.score))worst={score:push/warnAt,push,reach,node:n,people};
      }
    }
    if(worst){
      const stop=worst.push<(worst.people?TIP_RULES.personStop:TIP_RULES.pushStop),outer=worst.node;
      found.push({level:stop?'stop':'warn',code:'tips-under-load',ids:[outer.id,...ids],group:'c'+feet[0].id,rank:1/(worst.push+1),
        text:`The ${outer.name} reaches ${fmt(worst.reach)} past the nearest feet (${piecesLabel(feet)}). `+
          (worst.people?`Somebody putting their weight on that end tips the whole thing over (about ${lbText(Math.max(1,worst.push))} is enough).`
            :`About ${lbText(Math.max(1,worst.push))} pressing down on that end tips the whole thing over.`),
        fix:'Put a leg or support under that end, or pull the overhang back over the feet.'});
      continue;
    }
    if(top>=TIP_RULES.minHeight&&top>TIP_RULES.hopeless*base+.01){
      found.push({level:'stop',code:'top-heavy',ids,group:'c'+feet[0].id,rank:top/Math.max(base,.1),
        text:`This stands ${fmt(top)} tall on a base only ${fmt(base)} deep. It cannot stand on its own: the lightest push tips it over.`,
        fix:`Fasten it to the wall studs, or give it a base at least ${fmt(Math.ceil(top/TIP_RULES.narrow))} deep.`});
      continue;
    }
    const narrow=top>=TIP_RULES.minHeight&&top>TIP_RULES.narrow*base+.01,nearEdge=top>=TIP_RULES.minHeight&&inside<cy*TIP_RULES.lean;
    if(narrow||nearEdge){
      found.push({level:'warn',code:'top-heavy',ids,group:'c'+feet[0].id,rank:top/Math.max(base,.1),
        text:narrow?`This stands ${fmt(top)} tall on a base only ${fmt(base)} deep. Something this tall and shallow can be pulled over, more easily still once it is loaded.`
          :`Its weight is centered only ${fmt(inside)} inside the edge of its base and ${fmt(cy)} up. A small push tips it.`,
        fix:`Screw it to the wall studs, or make the base at least ${fmt(Math.ceil(top/TIP_RULES.narrow))} deep.`});
    }
  }
}
/* ---------- Check e: racking (leaning over sideways like a folding chair) ---------- */
function verifyRacking(model,opt,found){
  const DIRS=[[0,'left and right'],[2,'front to back']];
  for(const comp of model.comps){
    if(opt.wallFixed||comp.wood.some(n=>n.wall||n.tied)||!comp.wood.some(n=>n.grounded))continue; // the wall holds it square
    for(const[dir,words]of DIRS){
      const cross=2-dir;
      const posts=comp.wood.filter(n=>n.cls==='post'&&!n.tilt&&n.supported&&2*n.h[0]>=12&&extentOf(n,dir)<=Math.max(3.5,n.h[0]/3));
      if(posts.length<2)continue;
      const H=Math.max(...posts.map(n=>2*n.h[0]));
      // the pieces a piece is fastened to, and how many of them are uprights
      const heldBy=n=>new Set(n.links.filter(l=>l.fastened).map(l=>l.a===n?l.b:l.a));
      const uprightsOn=n=>[...heldBy(n)].filter(y=>y.cls==='post').length;
      // A panel standing in line with the lean, a diagonal brace, or rails deep enough. Each has to tie pieces
      // together to count: a panel that is not itself an upright must be fastened to two pieces, and a rail must
      // run from one upright to another (a short stub screwed to a single post braces nothing).
      const panel=comp.wood.some(n=>!n.tilt&&!n.hung&&heldBy(n).size>=(n.cls==='post'?1:2)&&extentOf(n,cross)<=1.6&&
        extentOf(n,dir)>=Math.max(8,H/6)&&extentOf(n,1)>=Math.max(8,H/4));
      const brace=comp.wood.some(n=>n.tilt&&2*n.h[0]>=12&&Math.abs(n.axes[0][1])>=.34&&Math.abs(n.axes[0][1])<=.94&&Math.abs(n.axes[0][dir])>=.34&&
        heldBy(n).size>=2&&uprightsOn(n)>=1);
      const rails=comp.wood.filter(n=>!n.tilt&&n.cls!=='post'&&n.p.ax[0]===dir&&extentOf(n,1)>=2.5&&uprightsOn(n)>=2);
      const deepOne=rails.some(n=>extentOf(n,1)>=H/10);
      const sturdy=rails.filter(n=>extentOf(n,1)>=Math.max(2.5,H/24));
      const twoLevels=sturdy.some(a=>sturdy.some(b=>Math.abs(a.c[1]-b.c[1])>=Math.max(6,H/4)));
      if(panel||brace||deepOne||twoLevels)continue;
      found.push({level:'warn',code:'racking',ids:posts.map(n=>n.id),group:'r'+dir+'|'+posts[0].id,rank:H,
        text:`Nothing stops this frame from leaning over ${words}. Its uprights (${piecesLabel(posts)}, up to ${fmt(H)} tall) are held only by the joints at their ends, which work loose.`,
        fix:`Add a diagonal brace or a plywood panel fastened across the uprights in that direction, or rails at least ${fmt(Math.max(2.5,Math.ceil(H/24*2)/2))} deep at two heights.`});
    }
  }
}
/* Rafters with nothing across them. A row of rafters is a row of thin boards on edge. What keeps them from
   rolling over, and the roof from leaning along its length, is what is nailed across their tops: the roof deck,
   or boards laid across them. A rafter that has a neighbour on the same slope, with nothing lying across the
   two, is marginal. Reported once for the whole roof. A single pair of rafters has no neighbour and is left alone. */
function verifyRoofBracing(model,found){
  const other=(link,n)=>link.a===n?link.b:link.a;
  const isRafter=n=>n.tilt&&n.cls==='beam'&&n.supported&&!n.hung&&n.use==='roof'&&n.sup.some(s=>s.how==='bear');
  const rafters=model.wood.filter(isRafter);
  if(rafters.length<2)return;
  const sameSlope=(a,b)=>Math.abs(vDot(a.axes[0],b.axes[0]))>.95;
  // something fastened on top of this rafter that also lies on top of another one
  const tiedAcross=X=>X.links.some(link=>{
    if(link.kind!=='bear'||link.lower!==X||!link.fastened)return false;
    const cover=other(link,X);
    return cover.links.some(l=>l.kind==='bear'&&l.fastened&&l.lower!==cover&&l.lower!==X&&isRafter(l.lower));
  });
  // a sloping plate with a rafter nailed down along it (the rake plate of a lean-to) is not itself a rafter
  const underRafter=X=>X.links.some(link=>link.kind==='bear'&&link.lower===X&&isRafter(other(link,X)));
  const bare=rafters.filter(X=>!underRafter(X)&&!tiedAcross(X)&&rafters.some(P=>P!==X&&sameSlope(X,P)));
  if(!bare.length)return;
  found.push({level:'warn',code:'racking',ids:bare.map(n=>n.id),group:'roof',rank:bare.length,
    text:`Nothing is fastened across the tops of ${piecesLabel(bare)}. Rafters are thin boards standing on edge: the roof deck nailed across them is what keeps them from rolling over and the roof from leaning along its length.`,
    fix:'Nail the roof deck (plywood, or boards laid across the rafters) to every one of them.'});
}

/* ---------- 12. Check f: joints ---------- */
function verifyJoints(model,found,notes){
  const seen=new Set();
  for(const X of model.wood){
    for(const link of X.links){
      if(seen.has(link))continue;
      seen.add(link);
      // Two pieces that touch side by side with no fastener. When that leaves one of them with nothing holding
      // it, the load path check has already said so (unsupported, loose); otherwise it is only worth a note.
      const a=link.a,b=link.b,passive=n=>n.hung||USES[n.use||'none'].loose||USES[n.use||'none'].hinged;
      if(link.overlap>0){
        notes.push({level:'note',code:'overlap',ids:[a.id,b.id],group:'o|'+[a.name,b.name].sort().join('|'),rank:link.overlap,
          text:`The ${a.name} and the ${b.name} run ${fmt(link.overlap)} into each other. The check takes that as a notch cut for the joint, glued and screwed.`,
          fix:'If you did not mean a notch, move one of them so that they only touch.'});
      }
      // (not worth a note where the edge of a sheet of plywood is one side of it: nothing is fastened into that)
      const sheetEdge=!!link.j&&((a.sheet&&link.j.fa==='edge')||(b.sheet&&link.j.fb==='edge'));
      if(link.type==='none'&&link.kind==='side'&&a.supported&&b.supported&&!passive(a)&&!passive(b)&&!sheetEdge){
        notes.push({level:'note',code:'unjoined',ids:[a.id,b.id],group:[a.name,b.name].sort().join('|'),rank:1,
          text:`The ${a.name} and the ${b.name} touch side by side with no fastener between them. Both are held by other joints.`,
          fix:'Nothing has to change. To join them as well, click Connect (C), then the two pieces.'});
      }
    }
    for(const s of X.sup){
      const j=s.link.j;
      if(s.link.type!=='glue'||s.how==='bear'||!j||(j.fa!=='end'&&j.fb!=='end'))continue;
      found.push({level:'warn',code:'glue-end-grain',ids:[X.id,s.node.id],group:[X.name,s.node.name].sort().join('|'),rank:1,
        text:`The ${X.name} is held to the ${s.node.name} by glue alone on end grain, and that joint carries weight. End grain soaks up glue and lets go.`,
        fix:'Add screws, pocket screws or dowels to that joint: hold Ctrl and click the two pieces, then pick another fastener under Connection in the Properties panel.'});
    }
  }
}

/* ---------- 13. Putting it together ---------- */
/* problems of the same kind about the same sort of piece become one entry that lists every piece */
function mergeFindings(found){
  const byKey=new Map();
  for(const f of found){
    const key=f.level+'|'+f.code+'|'+f.group;
    const have=byKey.get(key);
    if(!have){byKey.set(key,{best:f,ids:new Set(f.ids),count:1});continue;}
    f.ids.forEach(id=>have.ids.add(id));
    have.count++;
    if(f.rank>have.best.rank)have.best=f;
  }
  const out=[...byKey.values()].map(({best,ids,count})=>({level:best.level,code:best.code,ids:[...ids],
    text:best.text+(count>1?` The same goes for ${count-1} more like it.`:''),fix:best.fix}));
  return out.filter(p=>p.level==='stop').concat(out.filter(p=>p.level!=='stop'));
}
function verifyFacts(model,opt){
  const all=model.nodes,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  let weight=0,woodWeight=0;
  const com=[0,0,0];
  for(const n of all){
    weight+=n.weight;
    if(!n.prop)woodWeight+=n.weight;
    for(let k=0;k<3;k++){com[k]+=n.weight*n.c[k];lo[k]=Math.min(lo[k],n.lo[k]);hi[k]=Math.max(hi[k],n.hi[k]);}
  }
  const feet=model.wood.filter(n=>n.grounded),r1=v=>Math.round(v*10)/10;
  let footprint=null;
  if(feet.length){
    const x=[Math.min(...feet.map(n=>n.lo[0])),Math.max(...feet.map(n=>n.hi[0]))],z=[Math.min(...feet.map(n=>n.lo[2])),Math.max(...feet.map(n=>n.hi[2]))];
    footprint={x,z,width:x[1]-x[0],depth:z[1]-z[0]};
  }
  return{pieces:all.length,woodPieces:model.wood.length,weight:r1(weight),woodWeight:r1(woodWeight),loadWeight:r1(weight-woodWeight),
    centerOfMass:weight>0?com.map(v=>r1(v/weight)):null,tallest:all.length?hi[1]:0,size:all.length?[hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]]:[0,0,0],
    footprint,wallFastened:!!opt.wallFixed||model.wood.some(n=>n.wall||n.tied),uses:{},alsoUses:[],guessed:[],leftOut:model.leftOut.length,
    onHardware:[...new Set(model.wood.filter(n=>n.onHardware).map(n=>n.name))]};
}
function verifyDesign(parts,options){
  const opt=Object.assign({uses:{},wall:[],hung:[],joints:{},namedJoints:[],style:'std',wallFixed:false,maxPieces:VERIFY_MAX_PIECES},options||{});
  if(!(opt.maxPieces>0))opt.maxPieces=VERIFY_MAX_PIECES;
  const model=verifyModel(parts,opt),facts=verifyFacts(model,opt),found=[],noted=[];
  if(model.leftOut.length){
    const bad=model.leftOut,names=[...new Set(bad.map(p=>p&&typeof p.name==='string'&&p.name?p.name:'a piece with no name'))];
    found.push({level:'warn',code:'bad-piece',ids:bad.filter(p=>p&&p.id).map(p=>p.id),group:'bad',rank:bad.length,
      text:`${bad.length===1?'One piece':bad.length+' pieces'} could not be checked (${names.slice(0,4).join(', ')}${names.length>4?' and others':''}): a size, a position or the material is missing or is not a number.`,
      fix:'Delete those pieces and draw them again.'});
  }
  let skipped='';
  if(model.nodes.length>opt.maxPieces){
    skipped=`This design has ${model.nodes.length.toLocaleString('en-US')} pieces, more than the ${opt.maxPieces.toLocaleString('en-US')} the full check handles at once. Only its weight and tipping were checked.`;
    verifyComponents(model,true);
    verifyTipping(model,opt,found);
  }else{
    verifyContacts(model,opt);
    verifyLoadPath(model,opt,found);
    verifyUses(model,facts);
    verifyTankLoads(model,found);
    verifyBearing(model,found);
    verifySpans(model,found);
    verifyTankSeats(model,found);
    verifyPosts(model,found);
    verifyRailEnds(model,found);
    verifyRailJoints(model,found);
    verifyStandCenters(model,found);
    verifyPostsStacked(model,found);
    verifyComponents(model,false);
    verifyTipping(model,opt,found);
    verifyRacking(model,opt,found);
    verifyRoofBracing(model,found);
    verifyJoints(model,found,noted);
  }
  // the rules of shaped pieces: wood left beside a hole, cuts that meet, saw limits (js/shapecheck.js)
  if(typeof shapeFindings==='function')found.push(...shapeFindings(parts));
  if(model.wallScrewFacts)facts.wallScrews=model.wallScrewFacts;   // how many screws hold it to the wall, and where (verifyWallScrews)
  const problems=mergeFindings(found);
  return{ok:!problems.some(p=>p.level==='stop'),clean:!problems.length&&!skipped,problems,notes:mergeFindings(noted),facts,skipped};
}

/* ---------- 14. Projects and presets ---------- */
function verifyOptionsOf(project){
  project=project||{};   // an older project file has none of these fields
  return{uses:project.uses||{},wall:project.wall||[],hung:project.hung||[],joints:project.joints||{},
    styled:project.styled&&typeof project.styled==='object'?project.styled:{},
    style:(project.look&&project.look.style)||'std',wallFixed:!!project.wallFixed,
    sets:project.sets&&typeof project.sets==='object'?project.sets:{}};
}
function presetOptions(preset,vals){
  const of=field=>typeof field==='function'?field(vals):field;
  const wall=of(preset.wall),hung=of(preset.hung);
  return{uses:of(preset.uses)||{},wall:Array.isArray(wall)?wall:[],wallFixed:wall===true,hung:Array.isArray(hung)?hung:[],
    stand:!!of(preset.stand)};   // an aquarium stand: the center-post rule applies (STAND_RULES)
}
function presetDefaults(preset){
  const vals={};
  for(const q of preset.params)if(q.k)vals[q.k]=q.v;
  return vals;
}
function checkPreset(preset,vals,parts,extra){
  parts=parts||preset.build(vals);
  // (word: a preset may name a warning its own way, "Does not fit." for a room it was measured against; findingsHtml, js/checkui.js)
  const own=(preset.check?preset.check(vals)||[]:[]).map(f=>({level:f.level==='warn'?'warn':'stop',code:f.code||'input',ids:f.ids||[],text:f.text,fix:f.fix||'',...(f.word?{word:f.word}:{})}));
  // the pieces are not in a project yet, so the fasteners the preset names (its `joints`) are handed over by name
  // (a preset's `joints` may be a function of the form values, like its uses and wall)
  const options=Object.assign(presetOptions(preset,vals),{namedJoints:typeof preset.joints==='function'?preset.joints(vals)||[]:preset.joints||[]},extra||{});
  // the screws into the wall studs that placing it will drive (a preset that is held by them: WALL_BY_SCREWS)
  if(typeof preset.wallScrews==='function'&&!(extra&&extra.wallScrews))options.wallScrews=preset.wallScrews(vals,parts);
  const result=parts.length?verifyDesign(parts,options):{problems:[],facts:null,skipped:''};
  const problems=own.concat(result.problems),refused=own.some(f=>f.level==='stop');
  // What to show the person. When the preset itself refuses the numbers, its own reasons are the ones to read:
  // each comes with a fix that can be typed into the form. The general check would add two or three more
  // findings about the very same pieces (the same rail past three different limits), with fixes the form
  // cannot do, so those are left out of what is shown. `problems` still holds everything.
  const shown=refused?own:problems;
  return{parts,problems,shown,stops:problems.filter(f=>f.level==='stop'),warns:problems.filter(f=>f.level==='warn'),
    shownStops:shown.filter(f=>f.level==='stop'),refused,facts:result.facts,skipped:result.skipped};
}
