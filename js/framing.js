/* NominalCAD: nails for framing. Two fastener types for stud walls, floor frames and roofs, where screws by the
   hundred and pocket holes are the wrong tool:

     frame     "Framing nails": a nail driven straight through one piece into the other
     toenail   "Nails driven at an angle": for a piece that stands on another and cannot be nailed through it
               (a rafter tie or a gable stud on a wall plate that is already in place, a joist on a skid)

   Their rows are in JTYPES (js/joints.js), their cards in JOINT_HELP (js/jointhelp.js); jSpec (js/style.js)
   asks framingSpec(j, type) here for the words, the count and the item for the shopping list. Nothing picks
   these types by itself: a preset names them in its `joints` list (the Shed does), or a person chooses them for
   a joint by hand.

   What framingSpec decides, from the joint alone:
     - plywood against framing: nails through the plywood, by spacing rather than by count, because the spacing
       is what matters on a sheet (FRAMING.SHEET_EDGE along its edges, FRAMING.SHEET_FIELD elsewhere)
     - a board lying flat on a sheet of plywood (a wall plate on a floor deck): a nail or a short screw would
       end in the plywood, and nobody can fasten up from under a floor. So long screws go down through the
       board and the sheet into the framing under the sheet.
     - two boards: the nail goes through the one that shows its face and is no more than 1 1/2" thick, into the
       end, edge or face of the other. Where neither piece offers that, the joint is toenailed.
   The same three item names are used by the Shed for the joints this file never sees (rafters and roof deck
   are rotated pieces, which have no joints): FRAMING.NAIL, FRAMING.SHEET_NAIL, FRAMING.LONG_SCREW. */
'use strict';

const FRAMING={
  NAIL:'3" framing nails (10d)',                  // item names, exactly as they appear on the shopping list
  SHEET_NAIL:'2-1/2" nails (8d) for plywood',
  LONG_SCREW:'#8 × 3-1/2" wood screws',
  NAIL_WORDS:'3" nails (10d)',                    // the same nails as a line of a step reads them
  SHEET_WORDS:'2-1/2" nails (8d)',
  THROUGH_MAX:1.6,      // a nail is driven through a board up to this thick (a 2x); a 4x4 is toenailed instead
  SHEET_EDGE:6,         // plywood: a nail this often along the edges of a sheet
  SHEET_FIELD:12,       // ... and this often into the framing behind the rest of it
  SHEET_COUNT_EVERY:8,  // for counting: one nail for every 8" of framing behind plywood, between the two spacings
  FACE_EVERY:12,        // two boards face to face (a cap plate on a top plate, a trimmer on a stud): a nail this often
  TOE_EVERY:16,         // a long piece toenailed along its length (a rim joist on a skid)
  PLATE_SCREW_EVERY:16  // a plate on a floor: a long screw this often, which is where the joists are
};

/* how plywood is nailed, in words (the Shed's steps use the same sentence) */
const framingSheetWords=()=>`${FRAMING.SHEET_WORDS} through the plywood, every ${FRAMING.SHEET_EDGE}" along the edges of each sheet and every ${FRAMING.SHEET_FIELD}" in between`;

/* The fastener for one joint of type 'frame' or 'toenail': { text, hw:[[item, count]], n, glue, bySpacing, drive }.
   j is a joint from findJoints (js/joints.js). bySpacing is true when the text gives a spacing, not a count
   for the joint (the steps then leave out "at each joint").
   drive says how the fasteners go in, for the drawing (fastenerLayout in js/fasteners.js) and for any text that
   names the two pieces: { how, through, into }. through is the piece the nail enters first, into the piece that
   receives its point, and how is one of
     'straight'  a nail straight through the first piece into the second
     'sheet'     a nail through the plywood into the framing behind it
     'plate'     a long screw down through a board and the plywood under it, into the framing under the plywood
     'toe'       a nail at an angle through the side of the first piece into the second */
function framingSpec(j,type){
  const isSheet=p=>M[p.mat].kind==='sheet',lower=p=>p.name.toLowerCase();
  // the two pieces in words: "the stud" and "the top plate", or "one stud" and "the other" when both have the same name
  const both=(first,second)=>first.name===second.name?['one '+lower(first),'the other']:['the '+lower(first),'the '+lower(second)];
  const long=Math.max(j.ru[1]-j.ru[0],j.rv[1]-j.rv[0]);
  const count=every=>Math.max(2,Math.ceil(long/every));
  const sheetA=isSheet(j.a),sheetB=isSheet(j.b);

  // plywood against framing, or plywood against plywood
  if(sheetA||sheetB){
    const sheet=sheetA?j.a:j.b,board=sheetA?j.b:j.a,sheetFace=sheetA?j.fa:j.fb,boardFace=sheetA?j.fb:j.fa;
    // a board lying flat on top of a sheet that lies flat itself: long screws into what is under the sheet
    const sheetTop=sheet.pos[1]+size(sheet)[1];
    const boardOnSheet=sheetA!==sheetB&&j.k===1&&sheetFace==='face'&&boardFace==='face'&&Math.abs(sheetTop-j.plane)<.03&&board.t<=FRAMING.THROUGH_MAX;
    if(boardOnSheet){
      const n=count(FRAMING.PLATE_SCREW_EVERY);
      return{n,glue:false,hw:[[FRAMING.LONG_SCREW,n]],bySpacing:true,drive:{how:'plate',through:board,into:sheet},
        text:`${FRAMING.LONG_SCREW} about every ${FRAMING.PLATE_SCREW_EVERY}", down through the ${lower(board)} and the ${lower(sheet)} into the framing under it`};
    }
    const n=count(FRAMING.SHEET_COUNT_EVERY);
    return{n,glue:false,hw:[[FRAMING.SHEET_NAIL,n]],text:framingSheetWords(),bySpacing:true,drive:{how:'sheet',through:sheet,into:board}};
  }

  // Two boards: through the one that shows its face, unless the joint is to be toenailed. Of two boards lying
  // face to face one on the other (a cap plate on a top plate) it is the upper one that can be reached.
  const faceA=j.fa==='face'&&j.da<=FRAMING.THROUGH_MAX,faceB=j.fb==='face'&&j.db<=FRAMING.THROUGH_MAX;
  const aOnTop=j.k===1&&Math.abs(j.a.pos[1]-j.plane)<.03;
  let through=null;
  if(type!=='toenail'){
    if(faceA&&faceB)through=j.k===1?(aOnTop?'a':'b'):j.da<=j.db?'a':'b';
    else if(faceA)through='a';
    else if(faceB)through='b';
  }
  // a long joint is given by its spacing, a short one by its count
  const spaced=(n,words,every,tail)=>n>2?{bySpacing:true,text:`${FRAMING.NAIL_WORDS} ${words}, about every ${every}"${tail||''}`}:{text:`${n} × ${FRAMING.NAIL_WORDS} ${words}${n===2&&tail?', one from each side':''}`};
  if(through){
    const first=through==='a'?j.a:j.b,second=through==='a'?j.b:j.a,secondFace=through==='a'?j.fb:j.fa;
    const[one,two]=both(first,second);
    if(secondFace==='end'){
      // into the end of a stud or a joist: three nails for a 2x4 or a 2x6, more for a deeper board
      const n=Math.max(3,Math.round(long/1.85));
      return{n,glue:false,drive:{how:'straight',through:first,into:second},hw:[[FRAMING.NAIL,n]],text:`${n} × ${FRAMING.NAIL_WORDS} through ${one} into the end of ${two}`};
    }
    const n=count(FRAMING.FACE_EVERY);
    return{n,glue:false,drive:{how:'straight',through:first,into:second},hw:[[FRAMING.NAIL,n]],...spaced(n,`through ${one} into ${two}`,FRAMING.FACE_EVERY)};
  }
  // Toenailed: the piece that meets the other with its end, or else the one on top, is nailed at an angle
  // through its side into the other.
  const toed=j.fa==='end'&&j.fb!=='end'?j.a:j.fb==='end'&&j.fa!=='end'?j.b:j.k===1?(aOnTop?j.a:j.b):j.a;
  const other=toed===j.a?j.b:j.a,n=count(FRAMING.TOE_EVERY),[one,two]=both(toed,other);
  return{n,glue:false,drive:{how:'toe',through:toed,into:other},hw:[[FRAMING.NAIL,n]],...spaced(n,`driven at an angle through the side of ${one} into ${two}`,FRAMING.TOE_EVERY,', from both sides in turn')};
}

/* ---------- self-check (selfTest runs every function in SELFTESTS, see js/core.js) ---------- */
SELFTESTS.push(function framingNails(problems){
  const joint=(a,b)=>jointOfPair(jointBox(Object.assign(a,{id:1})),jointBox(Object.assign(b,{id:2})));
  const spec=(a,b,type)=>jSpec(joint(a,b),type||'frame');
  // a wall plate on a floor deck: never a fastener that ends in the plywood or is driven up from under the floor
  const plate=spec(mk('Bottom plate','2x4',[48,1.5,3.5],[0,.75,0]),mk('Floor deck','ply34',[48,.75,48],[0,0,0]));
  if(!/3-1\/2"/.test(plate.text)||!/down through the bottom plate and the floor deck/.test(plate.text))problems.push('framing nails: a plate on a floor deck must get long screws down through the plate and the deck: '+plate.text);
  // a cap plate on a top plate: nailed down through the upper one, whichever was drawn first
  const cap=spec(mk('Top plate','2x4',[48,1.5,3.5],[0,0,0]),mk('Cap plate','2x4',[48,1.5,3.5],[0,1.5,0]));
  if(!/through the cap plate into the top plate/.test(cap.text))problems.push('framing nails: of two plates one on the other, the nail must go down through the upper one: '+cap.text);
  // a stud between plates: three nails through the plate into its end
  const stud=spec(mk('Bottom plate','2x4',[48,1.5,3.5],[0,0,0]),mk('Stud','2x4',[1.5,60,3.5],[10,1.5,0]));
  if(stud.n!==3||!/through the bottom plate into the end of the stud/.test(stud.text))problems.push('framing nails: a stud on a plate must be nailed through the plate into its end: '+stud.text);
  // plywood on a stud: by spacing, nails through the plywood
  const sheathing=spec(mk('Stud','2x4',[1.5,60,3.5],[10,0,0]),mk('Wall sheathing','ply12',[48,60,.5],[0,0,-.5]));
  if(!/through the plywood, every 6"/.test(sheathing.text)||sheathing.hw[0][0]!==FRAMING.SHEET_NAIL)problems.push('framing nails: plywood on a stud must be nailed through the plywood by spacing: '+sheathing.text);
  // a joist on a 4x4 skid cannot be nailed through the skid; a gable stud on a plate is toenailed when the preset says so
  const onSkid=spec(mk('Skid','4x4',[48,3.5,3.5],[0,0,0]),mk('Floor joist','2x6',[1.5,5.5,40],[10,3.5,0]));
  const onPlate=spec(mk('Cap plate','2x4',[48,1.5,3.5],[0,0,0]),mk('Gable stud','2x4',[3.5,20,1.5],[10,1.5,1]),'toenail');
  if(!/driven at an angle through the side of the floor joist into the skid/.test(onSkid.text))problems.push('framing nails: a joist on a 4x4 skid must be toenailed: '+onSkid.text);
  if(!/driven at an angle through the side of the gable stud into the cap plate/.test(onPlate.text))problems.push('framing nails: a toenailed gable stud is nailed through its own side: '+onPlate.text);
  // every item these joints put on the shopping list has a price
  for(const item of[FRAMING.NAIL,FRAMING.SHEET_NAIL,FRAMING.LONG_SCREW])if(!hardwareFamily(item))problems.push('framing nails: no price row for "'+item+'"');
});
