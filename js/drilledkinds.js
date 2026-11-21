/* NominalCAD: like pieces drilled alike.

   The owner, 20 Nov: "we want to combine as many pieces as possible for all furniture", "do what makes sense, we
   want like pieces but if a special part is 100% necessary its fine, if the screw isnt visible then it should be
   ok". One row of the cut list (one letter in "Drill your pieces") whose pieces come out as more than one drilled
   kind (labels A1, A2, A3 under one letter) means the shop makes them one by one instead of as a batch. A mirror
   pair (A1 and its mirror image A2) counts as one kind: the person drills them from the same drawing.

     drilledKinds()      the rows of the design as it is now with more than one drilled kind:
                         {total, rows: [{letter, name, kinds, labels}]}
     drilledKindsNow()   the table DRILLED_KINDS_RECORDED as it is now, to paste when a preset is changed on purpose

   Self-check drilledKindsStayPinned: for every preset at its usual sizes in each style, the number of drilled kinds of
   the whole design and of the rows split into more than one kind are as recorded, so a later change that splits a
   piece again fails (and one that joins two kinds is recorded again on purpose). drilledKindsCanFail proves it. */
'use strict';
function drilledKinds(){
  const drill=buildPlan(true).drill;
  const byLetter=new Map();
  for(const label of drill.labels||[]){
    if(label.mirror)continue;   // (the mirror image of a label is drilled from its drawing)
    if(!byLetter.has(label.letter))byLetter.set(label.letter,[]);
    byLetter.get(label.letter).push(label);
  }
  const rows=[];
  let total=0;
  for(const[letter,labels]of byLetter){
    total+=labels.length;
    if(labels.length<2)continue;
    const sample=labels[0].members[0];
    rows.push({letter,name:sample?sample.piece.name:'',kinds:labels.length,labels:labels.map(label=>label.name+(label.mirrorLabel?'/'+label.mirrorLabel.name:''))});
  }
  return{total,rows};
}
/* [kinds in the design, rows split into more than one kind] for one preset at its usual sizes in one style */
function drilledKindsOf(preset,style){
  load(JSON.stringify(blank()),true);
  placeInStyle(preset,presetDefaults(preset),style);
  const kinds=drilledKinds();
  return[kinds.total,kinds.rows.reduce((sum,row)=>sum+row.kinds-1,0)];
}
function drilledKindsNow(){
  const kept=JSON.stringify(S),table={};
  try{withoutDrawing(()=>{for(const preset of PRESETS){table[preset.name]={};for(const style of DRILL_PRINT_STYLES)table[preset.name][style]=drilledKindsOf(preset,style);}});}finally{load(kept,true);}
  return JSON.stringify(table).replace(/\},"/g,'},\n  "');
}
/* Recorded on branch alike (the pocket-edge round), in all three styles, twice the same: [drilled kinds, extra kinds
   in rows that split]. The second number is what "like pieces drilled alike" is about: it may go down (record it
   again, saying which pieces were joined), never up.
   Recorded again by the fixes of that round, after the like-pieces pass (alikePieces, js/fasteners.js) and the
   mirror-way nudge (nudgedLayout): Fish tank wall / rack 28/21 to 23/16 (Everyday), 17/12 to 16/11 (Fine, the posts
   one kind again), 25/16 to 20/11 (Rustic); Cabinet stand 12/8 to 11/7 and 14/8 to 12/6 (the posts one kind again);
   Platform bed 11/5 to 10/4 (the middle slats and the corner legs); Planter box 9/4 to 8/3 (the bottom slats);
   Garage shelves in Fine 6/2 to 5/1 (the top deck rests on its posts). Every other preset as before. Most of the
   splits left are pieces of one cut size that do different jobs (a rail under the top deck and one under a shelf
   deck; a base rail and a top rail): special parts, listed with their reasons in the round's report. */
const DRILLED_KINDS_RECORDED={"Fish tank wall / rack":{"std":[23,16],"fine":[16,11],"rustic":[20,11]},
  "Single aquarium stand":{"std":[6,2],"fine":[6,2],"rustic":[10,4]},
  "Cabinet stand with a row of tanks":{"std":[11,7],"fine":[11,7],"rustic":[12,6]},
  "Platform bed":{"std":[10,4],"fine":[10,4],"rustic":[10,4]},
  "Shed":{"std":[0,0],"fine":[0,0],"rustic":[0,0]},
  "Bird feeder":{"std":[4,0],"fine":[4,0],"rustic":[4,0]},
  "Bookshelf":{"std":[2,0],"fine":[2,0],"rustic":[5,2]},
  "Dining table":{"std":[3,0],"fine":[3,0],"rustic":[10,5]},
  "Coffee table":{"std":[4,1],"fine":[4,1],"rustic":[9,3]},
  "Side table / nightstand":{"std":[2,0],"fine":[2,0],"rustic":[5,1]},
  "Desk":{"std":[3,0],"fine":[3,0],"rustic":[5,0]},
  "Sturdy bench":{"std":[3,0],"fine":[4,0],"rustic":[8,3]},
  "Five-board bench":{"std":[2,0],"fine":[2,0],"rustic":[3,0]},
  "Workbench":{"std":[9,3],"fine":[7,3],"rustic":[8,2]},
  "Garage shelves":{"std":[9,3],"fine":[5,1],"rustic":[9,3]},
  "Storage box / toy chest":{"std":[2,0],"fine":[2,0],"rustic":[4,0]},
  "Planter box":{"std":[8,3],"fine":[8,3],"rustic":[8,3]},
  "Raised garden bed":{"std":[6,3],"fine":[6,3],"rustic":[6,3]},
  "Entryway shoe bench":{"std":[4,1],"fine":[4,1],"rustic":[9,3]},
  "Base cabinet with doors":{"std":[6,2],"fine":[6,2],"rustic":[7,2]},
  "Wall shelf":{"std":[2,0],"fine":[2,0],"rustic":[3,0]},
  "Nightstand with drawers":{"std":[7,2],"fine":[7,2],"rustic":[8,2]},
  "Computer desk":{"std":[10,3],"fine":[10,3],"rustic":[13,3]},
  "Dining chair":{"std":[8,1],"fine":[8,1],"rustic":[9,1]},
  "Cabinet / case":{"std":[5,2],"fine":[5,2],"rustic":[6,2]}};
/* what the pin says of one preset in one style: '' when the count is as recorded (got and want: [kinds, extra]) */
function drilledKindsPinFault(name,style,got,want){
  const where=`${name} (${STYLES[style][0]})`;
  if(!want)return`like pieces: ${where} has no recorded count of drilled kinds (DRILLED_KINDS_RECORDED, js/drilledkinds.js)`;
  if(got[1]>want[1])return`like pieces: ${where} has ${got[1]} more drilled kinds in its rows than one each, ${want[1]} recorded: a piece is split into kinds again`;
  if(got[0]!==want[0]||got[1]!==want[1])return`like pieces: ${where} has [${got.join(', ')}] drilled kinds, [${want.join(', ')}] recorded: record it again on purpose (drilledKindsNow())`;
  return'';
}
SELFTESTS.push(function drilledKindsStayPinned(problems){
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>{
    for(const preset of PRESETS){
      const recorded=DRILLED_KINDS_RECORDED[preset.name];
      for(const style of DRILL_PRINT_STYLES){
        const want=recorded&&recorded[style];
        const fault=drilledKindsPinFault(preset.name,style,want?drilledKindsOf(preset,style):[0,0],want);
        if(fault)problems.push(fault);
      }
    }
  });}finally{load(kept,true);}
});
/* Self-check: a split is found, and the pin catches it. Three 1x4 rails of one size: two pocket-screwed to a block
   at both ends, the third at one end only, are two drilled kinds of one row; and a design recorded with fewer
   kinds than it has fails the pin (the code reader's finding 15: the pin itself is run on a split). */
SELFTESTS.push(function drilledKindsCanFail(problems){
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>{
    load(JSON.stringify(blank()),true);
    const rail=y=>mk('Rail','1x4',[24,3.5,.75],[1.5,y,0]),block=(x,y)=>mk('Block','2x4',[1.5,3.5,3.5],[x,y,0]);
    addParts([rail(0),block(0,0),block(25.5,0),rail(10),block(0,10),block(25.5,10),rail(20),block(0,20)]);
    for(const j of findJoints())S.joints[j.key]='pocket';
    commit();
    const found=drilledKinds(),row=found.rows.find(one=>one.name==='Rail');
    if(!row||row.kinds!==2)problems.push(`like pieces: three rails, one held at one end only, are not found as two drilled kinds (${row?row.kinds:'one'})`);
    const got=[found.total,found.rows.reduce((sum,one)=>sum+one.kinds-1,0)];
    if(!/split into kinds again/.test(drilledKindsPinFault('Test','std',got,[got[0]-1,got[1]-1])))problems.push('like pieces: a design with one kind more than recorded is not caught by the pin');
    if(drilledKindsPinFault('Test','std',got,got))problems.push('like pieces: a design exactly as recorded is caught by the pin');
  });}finally{load(kept,true);}
});
