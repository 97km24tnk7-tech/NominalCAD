/* NominalCAD: the cabinet builder's tables (design/specs/01-cabinet-case-builder.md, sections 1.3, 2.1 and 5.1).

   Data only: the rule numbers of a case with their reasons (CASE), what each kind of case is made for
   (CASE_KINDS), what can go inside a bay (CASE_RECIPES), and the old preset names that open a catalog entry
   (PRESET_ALIASES). The plan (js/caseplan.js), the pieces (js/casebuild.js), the checks, the steps and the
   self-checks read them; nothing here is drawn or built.

   Where a number comes from: [01 §n] is the reference sheet design/reference/01-case-furniture.md. A number marked
   PRACTICE there is a default, never a stop or a warn. Numbers that already live elsewhere are not copied: the
   drawer clearances are DRAWER's (js/drawers.js), the Nightstand's are NS (js/nightstand.js), the loads are
   USES (js/verify.js).

   Words used below: T = 3/4" (every case panel), a bay = the space between two uprights (a side or a divider),
   a section = one part of a bay, bottom up, a front = a door, a drawer front or a false front. */
'use strict';

const CASE={
  T:.75,                    // every panel of a case: 3/4" plywood, or a 1x board
  back:.25,                 // the back panel: 1/4" plywood
  // the outer limits the plan holds to; each catalog entry narrows them for its own form (entry.limits)
  limits:{
    W:[12,96],              // 96": one 8 ft sheet for a top or a back
    H:[16,96],              // 96": one 8 ft sheet for a side
    D:[8,30],
    n:[0,8],                // shelves in a section
    N:[1,6],                // drawers in a bay
    bays:[1,6],
    fh:[3.5,12],            // drawer front height: NS.minFrontInset to NS.maxFront
    falseH:[4,8],           // the false front of a sink base
    kickH:[3,4.5],          // [01 §2a, §5 item 4]: toe kicks are 3 1/2" to 4 1/2" high
    kickBack:[1,4],         // [01 §2a, §5 item 4]: 3" is the usual set back
    overSide:[0,2],         // a top that lies on the case: how far past each side
    overFront:[0,2],        // and past the fronts
  },
  // An opening between two fixed panels is never shorter than this: every shelf is screwed from underneath, and a
  // drill needs about 6" of room to do that. The same in every build style, so a design does not change when its
  // style does. The sheet's smallest useful opening is 7" [01 §4].
  leastOpening:6,
  // "Shelf spacing: at a spacing I choose" (the Bookshelf today, js/builders-storage.js): the clear opening asked
  // for is 7" to 15" [01 §2f, §4], 11" to start; what is left goes into one taller opening, never shorter than 7"
  // (the owner, 16 Nov: "no 4 in. shelves").
  spacing:{limits:BOOKSHELF_SPACING_LIMITS,usual:BOOKSHELF_SPACING_USUAL,leastLeftover:BOOKSHELF_SPACING_LIMITS[0]},
  // A bay narrower than this (clear, between its uprights) has no room for a pocket-hole driver: its boards are
  // held by plugged screws through the uprights in Everyday and Fine furniture. PRACTICE: a default, never a stop.
  reachClear:12,
  // No shelf, bottom or top spans more than this for books or storage, whatever the bending numbers allow:
  // 3/4" plywood 32", 1x white pine 32" worked out [01 §2f], and [01 §5 item 1].
  maxShelfSpan:32,
  maxSpanUses:['books','shelf'],   // the uses the 32" cap is for
  // One door when the front of a bay is narrower than this, a pair from here up (today's Base cabinet:
  // CABINET_ONE_DOOR_BELOW, 21" measured on the case, less the two 1/8" reveals).
  oneDoorBelow:CABINET_ONE_DOOR_BELOW-.25,
  // shelves behind doors stop this far short of the front edge, clear of the hinge plates (today's Base cabinet)
  shelfBehindDoors:1,
  // a shelf on pins: 1/16" clear at each end, 1/2" shallower than its space
  adjustableShelf:{endClear:1/16,shallower:.5},
  // shelf pins [01 §3, §5 item 16]: four to a shelf, 1 1/2" in from the front and the back edge of the shelf;
  // the holes 1/4" wide and 3/8" deep (the pin's own mounting words, HARDWARE.pin), 32 mm (about 1 1/4") apart,
  // from 4" above the panel below to 4" under the panel above; behind doors no hole within 1" of a hinge plate
  // (PRACTICE, words only)
  pins:{perShelf:4,fromEdge:1.5,hole:.25,holeDepth:.375,spacing:32/25.4,fromPanel:4,clearOfHinge:1},
  // a section of adjustable shelves taller than this with no fixed panel in it gets one fixed shelf near its
  // middle, to stay stiff [01 §3] (keepFixed on the form)
  keepFixedOver:48,
  // building it lying down: H at or over this gets the note on the ceiling height (PRACTICE [01 §5 item 13])
  ceilingNoteFrom:84,
  // fastened to the wall when it has doors or drawers and is this tall or taller: the clothing-storage height [01 §2i]
  clothingHeight:27,
  // the false front of a sink base: 1 1/4" screws from inside through the on-edge top rail, 2 for each 12" of
  // width, at least 2
  falseFrontScrews:{per:12,least:2},
  // A doubled divider (two drawer bays side by side): glued and screwed face to face with 1 1/4" screws from the
  // face a slide will cover, 6 for each 12" of height, spread out.
  doubledDividerScrews:{per:12,count:6},
  // Stage 5, closet rods: the rod diameter, the socket size and the clothes load per foot are not on the reference
  // sheet yet. They are added here once they are looked up, never from memory.
};

/* What a case is made for: the row of the "Made for" field (kind). The loads each piece is sized for, the toe kick,
   the top rails, how far the fronts stand back from the edges of the case (overlay), whether it has a base rail,
   and the rules of 4.5 (fastening to the wall).
     uses        {shelf, bottom, top}: keys of USES (js/verify.js). bottomOpen: the bottom's use when an open
                 space stands on it (else bottom). The form's "Shelves hold" (use) overrides shelf and bottomOpen.
     kickH, kickBack   the toe kick (a 1x case always takes a 1x4: 3 1/2")
     railW       the width of the top rails, and of the back and base rails
     reveal      {side, top, bottom}: how far an overlay front stops short of the outside of the case. With no toe
                 kick (base 'none') the bottom reveal is 1/4" for every kind: a front never touches the floor.
     baseRail    a rail under the back of the bottom, beside the toe kick's space
     rules       clothing: clothing storage (a tip restraint kit at 27" and taller [01 §2i, §6 item 1]);
                 wall: always fastened to the wall [01 §6 item 2]; sink: a sink base
   The values marked "today" keep today's presets exactly as they are (5.5 of the spec). */
const CASE_KINDS={
  bookshelf:{name:'Bookshelf',word:'the bookshelf',uses:{shelf:'books',bottom:'books',top:'books'},
    kickH:3.5,kickBack:1,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{}},
  nightstand:{name:'Nightstand',word:'the nightstand',uses:{shelf:'shelf',bottom:'general',bottomOpen:'shelf',top:'tableTop'},
    kickH:NS.kick,kickBack:NS.kickBack,railW:NS.rail,reveal:{side:NS.frontReveal,top:.125,bottom:0},
    baseRail:false,   // today: the Nightstand has no base rail
    rules:{clothing:true}},
  dresser:{name:'Dresser',word:'the dresser',uses:{shelf:'shelf',bottom:'general',bottomOpen:'shelf',top:'tableTop'},
    kickH:3.5,kickBack:2,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{clothing:true}},
  tv:{name:'TV stand',word:'the TV stand',uses:{shelf:'shelf',bottom:'shelf',top:'tableTop'},
    kickH:3.5,kickBack:2,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{wall:true}},
  pantry:{name:'Pantry',word:'the pantry',uses:{shelf:'shelf',bottom:'shelf',top:'general'},
    kickH:4,kickBack:3,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{wall:true}},
  wardrobe:{name:'Wardrobe',word:'the wardrobe',uses:{shelf:'shelf',bottom:'shelf',top:'general'},
    kickH:3.5,kickBack:2,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{clothing:true,wall:true}},
  vanity:{name:'Bathroom vanity',word:'the vanity',uses:{shelf:'shelf',bottom:'general',top:'tableTop'},
    kickH:4,kickBack:3,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{sink:true}},
  basecab:{name:'Base cabinet',word:'the cabinet',uses:{shelf:'shelf',bottom:'shelf',top:'tableTop'},
    kickH:3.5,kickBack:2.25,railW:3.5,
    reveal:{side:.125,top:.25,bottom:.25},   // today: the Base cabinet's doors stop 1/4" under the top and over the floor of the bottom panel
    baseRail:true,rules:{}},
  other:{name:'Other cabinet',word:'the cabinet',uses:{shelf:'shelf',bottom:'shelf',top:'tableTop'},
    kickH:4,kickBack:3,railW:3.5,reveal:{side:.125,top:.125,bottom:0},baseRail:true,rules:{}},
};
const CASE_REVEAL_NO_KICK=.25;   // with no toe kick, a front stops this far over the floor, whatever the kind

/* What goes inside a bay ("What goes inside"): its sections, bottom up.
     kind      'open' | 'doors' | 'drawers' | 'false' (a false drawer front) | 'rod' (stage 5)
     shelves   'n': the form's shelf count goes in this section; 0: none
     drawers   'N': the form's drawer count; 1: one drawer
     front     'fh': its drawers take the form's front height; 'falseH': the false front's height
     split     'half': this section takes half of the inside height (the lower of "Lower and upper doors")
     rod       true: holds a hanging rod (stage 5)
   Between two sections stands a fixed 3/4" Shelf, except under a false front (panelBelow:false): a sink base
   needs that space clear. stage: the stage of the spec that brings it (section 7). */
const CASE_RECIPES={
  shelves:{label:'Open shelves',stage:1,sections:[{kind:'open',shelves:'n'}]},
  doors:{label:'Doors, with shelves behind',stage:2,sections:[{kind:'doors',shelves:'n'}]},
  doors2:{label:'Lower and upper doors',stage:2,sections:[{kind:'doors',shelves:'n',split:'half'},{kind:'doors',shelves:'n'}]},
  drawers:{label:'Drawers',stage:4,sections:[{kind:'drawers',drawers:'N'}]},
  drawersOpen:{label:'Drawers over an open space',stage:4,sections:[{kind:'open',shelves:0},{kind:'drawers',drawers:'N',front:'fh'}]},
  drawerDoors:{label:'A drawer over doors',stage:4,sections:[{kind:'doors',shelves:'n'},{kind:'drawers',drawers:1,front:'fh'}]},
  drawersDoors:{label:'Doors over drawers',stage:4,sections:[{kind:'drawers',drawers:'N',front:'fh'},{kind:'doors',shelves:'n'}]},
  sink:{label:'Sink base: doors under a false front',stage:2,sections:[{kind:'doors',shelves:0},{kind:'false',front:'falseH',panelBelow:false}]},
  open:{label:'Nothing: an open space',stage:1,sections:[{kind:'open',shelves:0}]},
  rodDoors:{label:'Hanging rod, with doors',stage:5,sections:[{kind:'doors',shelves:0,rod:true}]},
  rodOpen:{label:'Hanging rod, open',stage:5,sections:[{kind:'open',shelves:0,rod:true}]},
};
const CASE_SECTION_KINDS=['open','doors','drawers','false','rod'];

/* The names today's three presets had, as a design or the browser may still hold them (the preset created last,
   LAST_PRESET_KEY in js/app.js), and the catalog entry each opens once its preset has moved onto the cabinet
   builder (section 5.4 of the spec). Until then each name is still a preset of its own, which wins. */
const PRESET_ALIASES={'Bookshelf':'bookshelf','Nightstand with drawers':'drawer-nightstand','Base cabinet with doors':'base-cabinet'};
