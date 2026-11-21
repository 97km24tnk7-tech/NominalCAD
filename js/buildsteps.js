/* NominalCAD: the build steps, worked out from the design as it is now.

   Everything that shows steps reads ONE list, buildPlan(): the Build instructions page and its pictures
   (js/plans.js, js/steppictures.js) and Build step by step on screen (js/stepmode.js). The list is made fresh
   after every change of the design, so the steps follow edits.

   THE RULES
     1. Every piece of the design is in exactly one step, always.
     2. A preset's own steps (S.steps) keep their pieces by id (step.ids, stamped when the preset is placed;
        projects saved before that find them by name). A renamed piece stays in its step. A preset step whose
        pieces were all deleted is dropped, and the numbers stay continuous.
     3. A preset step whose pieces were changed after it was made (resized, moved against each other, one
        deleted) is written again from the pieces as they are now; the preset's own words are kept under it,
        marked as written before the change. A step nobody touched keeps the preset's words.
     4. A piece no preset step has (a board added by hand, a copy) gets a generated step, placed after the step
        that builds what it touches, or before the finishing step when it touches nothing.
     5. A design without preset steps (drawn from scratch, or two designs in one project) gets generated steps
        in a "Suggested order": what stands on the floor first, then what is fastened to that, tops after the
        frame, doors and drawers last, pieces that take the same operation in one step.
     6. Every fastened joint is in exactly one step: the step that adds the later of its two pieces. Its
        "Fasten with" line says which piece the fastener goes THROUGH and which it goes INTO, from the same
        layout the 3D view draws (fastenerLayout, js/fasteners.js), with the count and size of jSpec
        (js/style.js). Pieces that only touch get no line.
     7. Every piece of hardware that is placed in the design (S.hardware) is in exactly one step, with where it
        goes in real numbers read from the model.

   WHAT THE REST OF THE PROGRAM CALLS
     buildPlan()        {steps, suggested, rewritten, stepOfPiece, letterOf, note}   remembered until the design changes
       suggested    true when the program worked the order out itself (rule 5); note is then the sentence that says so
       rewritten    how many preset steps were written again (rule 3)
       stepOfPiece  Map piece id -> index of its step
       step = {
         no          1, 2, 3 ...
         kind        'cut' | 'build' | 'hardware' (a step that only mounts hardware) | 'finish' | 'note' (a preset
                     step that adds no piece: "screw it to the wall")
         source      'preset' (the preset's words) | 'rewritten' (rule 3) | 'generated' (rules 4 and 5)
         words       what to do, in sentences
         was         rule 3: the preset's own words, else ''
         pieces      the pieces this step adds
         groups      the "Fasten with" lines: [{no, line, where, type, links, places, each, total, label, hardware,
                     sample}]   links: the joints of the line; hardware: Map shopping-list label -> count;
                     sample = {link, layout, dims} is the joint the close-up picture shows (none for glue alone)
         extra       lines the preset wrote for joints the program cannot see (rotated pieces)
         hardware    [{line, kind, items}]   placed hardware mounted in this step
         need        {pieces: [{qty, letter, name, length}], fasteners: ['12 wood screws, #8 × 1-5/8"'], tools: [...]}
       }
     stampSteps(steps, parts)    placePreset (js/app.js) calls it: gives each preset step its piece ids
     fastenerPhrase(count, label)   '2 wood screws, #8 × 1-5/8"' from a shopping-list label
     pieceLabel(piece, letterOf)    'Side (A)'
     connectionSentence(link)       one plain sentence for a picked connection (Properties, js/fastenerview.js) */
'use strict';

/* ---------- small helpers for words ---------- */
/* the two ends of each world direction, as a person standing in front of the design says them */
const DIRECTION_ENDS=[['left','right'],['bottom','top'],['back','front']];
const inchWords=v=>fmt(r16(v));
const listWords=items=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+' and '+items[items.length-1];
const countWord=n=>['no','one','two','three','four','five','six','seven','eight','nine','ten'][n]||String(n);
const capital=text=>text.charAt(0).toUpperCase()+text.slice(1);
/* 'Shelf' -> 'Shelves', 'Leg' -> 'Legs' */
function pluralName(name){
  if(/foot$/i.test(name))return name.replace(/oot$/i,'eet');   // (the Feet of a fish rack)
  if(/(s|x|ch|sh)$/i.test(name))return name+'es';
  if(/[^aeiou]y$/i.test(name))return name.slice(0,-1)+'ies';
  if(/(elf|alf)$/i.test(name))return name.slice(0,-1)+'ves';
  return name+'s';
}
function pieceLabel(piece,letterOf){
  const letter=letterOf?letterOf(piece):'';
  return piece.name+(letter?` (${letter})`:'');
}

/* A count of fasteners in words, from the label the shopping list uses for them:
     fastenerPhrase(2, '#8 × 1-5/8" wood screws')  ->  '2 wood screws, #8 × 1-5/8"'
   The label is kept whole when its shape is not known, so nothing is ever lost. */
const FASTENER_LABELS=[
  [/^(#\d+ × \S+) (wood screws|exterior screws)$/,(m,n)=>`${n} ${n===1?m[2].replace(/s$/,''):m[2]}, ${m[1]}`],
  [/^(1\/4" × \S+) structural screws$/,(m,n)=>`${n} structural screw${n===1?'':'s'}, ${m[1]}`],
  [/^(\S+) wood plugs$/,(m,n)=>`${n} wood plug${n===1?'':'s'}, ${m[1]}`],
  [/^(\S+) dowel rod, cut into plugs$/,(m,n)=>`${n} plug${n===1?'':'s'} cut from ${m[1]} dowel rod`],
  [/^Pocket-hole plugs$/,(m,n)=>`${n} pocket-hole plug${n===1?'':'s'}`],
  [/^(\S+) pocket-hole screws$/,(m,n)=>`${n} pocket-hole screw${n===1?'':'s'}, ${m[1]}`],
  [/^(.+) wood dowels$/,(m,n)=>`${n} wood dowel${n===1?'':'s'}, ${m[1]}`],
  [/^(\S+) brad nails \(18 gauge\)$/,(m,n)=>`${n} brad nail${n===1?'':'s'}, ${m[1]}`],
  [/^(\S+) L-brackets \(corner braces\)$/,(m,n)=>`${n} L-bracket${n===1?'':'s'}, ${m[1]}`],
  [/^(#\d+ × \S+) screws for brackets$/,(m,n)=>`${n} short screws for the brackets, ${m[1]}`],
  [/^(\S+) framing nails \((\d+d)\)$/,(m,n)=>`${n} framing nail${n===1?'':'s'}, ${m[1]} (${m[2]})`],
  [/^(\S+) nails \((\d+d)\) for plywood$/,(m,n)=>`${n} nail${n===1?'':'s'} for plywood, ${m[1]} (${m[2]})`],
  // plain lines of a preset's hardware list
  [/^Metal hurricane ties\b/,(m,n)=>`${n} metal hurricane tie${n===1?'':'s'}`],
  [/^Joist hanger nails, (\S+),/,(m,n)=>`${n} joist hanger nails, ${m[1]}`],
  [/^Wood screws, ([^ ,]+),? (.+)$/,(m,n)=>`${n} wood screw${n===1?'':'s'}, ${m[1]} (${m[2]})`],
  [/^Screws for the wall studs, (.+)$/,(m,n)=>`${n} screws for the wall studs, ${m[1]}`],
];
function fastenerPhrase(count,label){
  for(const[pattern,say]of FASTENER_LABELS){
    const found=String(label).match(pattern);
    if(found)return say(found,count);
  }
  return`${count} × ${label}`;
}

/* ---------- which preset step a piece belongs to ---------- */
/* What a step's pieces looked like when the preset made them: their sizes, and how far each one is from the
   middle of them all. Moving or turning the whole design changes neither; resizing a piece, moving one against
   the others or deleting one does. */
function stepSignature(pieces){
  const sizes=pieces.map(p=>[r16(p.l),r16(p.w),r16(p.t)].join('x')).sort().join(',');
  const middle=[0,0,0],centers=pieces.map(p=>{const b=box(p);return b.lo.map((v,k)=>(v+b.hi[k])/2);});
  for(const c of centers)for(let k=0;k<3;k++)middle[k]+=c[k]/centers.length;
  const spread=centers.map(c=>Math.round(Math.hypot(c[0]-middle[0],c[1]-middle[1],c[2]-middle[2])*8)).sort((a,b)=>a-b);
  return{sizes,spread};
}
function sameSignature(was,now){
  if(!was||was.sizes!==now.sizes||was.spread.length!==now.spread.length)return false;
  return was.spread.every((v,i)=>Math.abs(v-now.spread[i])<=1);   // within 1/8"
}
/* placePreset (js/app.js) hands the preset's steps and the pieces it has just added: each step gets the ids of
   its pieces (the first step that names a piece keeps it) and what they looked like. Returns new step objects,
   so the shared CUT and FIN steps are never written on. */
/* The words of a preset step often quote where OTHER pieces go: "mark the shelf positions: 14 7/16", 25 3/8",
   36 5/16"" in the step that only adds the two sides. When such a piece is deleted or moved later, the sentence
   is stale although the step's own pieces never changed. So, when the preset is placed, every piece whose name
   the words use and one of whose measures the words quote is written down with that measure:
     [{id, measure, said}]   measure: 'lo1' (how high its underside is above the lowest point of the design),
                             'hi1' (its top, likewise), 'l' (its length); said: the number as the words give it
   measuresStillTrue() compares them with the design as it is now. Only measures of 2" and more count: 3/4" is the
   thickness of half the pieces of a design and proves nothing. */
const inchesQuoted=text=>new Set((String(text).match(/\d+(?: \d+\/\d+)?(?=")|\d+\/\d+(?=")/g)||[]));
const namesInWords=(text,name)=>new RegExp('\\b'+name.toLowerCase().replace(/[^a-z0-9 ]/g,'.').replace(/(y|f)$/,'(y|f|ie|ve)')+'(s|es)?\\b','i').test(text);
function pieceMeasures(piece,whole){
  // heights only (and the length): turning the whole design to face another way changes neither
  const b=box(piece);
  return{l:piece.l,lo1:b.lo[1]-whole.lo[1],hi1:b.hi[1]-whole.lo[1]};
}
function quotedMeasures(text,others,all){
  const quoted=inchesQuoted(text),whole=bbox(all.filter(p=>!isProp(p))),found=[];
  if(!quoted.size||!whole)return found;
  for(const piece of others){
    if(isProp(piece)||!namesInWords(text,piece.name))continue;
    for(const[measure,value]of Object.entries(pieceMeasures(piece,whole))){
      const said=fmt(r16(value)).replace(/"$/,'');
      if(value>=2&&quoted.has(said)){found.push({id:piece.id,measure,said});break;}
    }
  }
  return found;
}
function measuresStillTrue(about){
  const whole=bbox(S.parts.filter(p=>!isProp(p)));
  return about.every(row=>{
    const piece=byId(row.id);
    return!!piece&&!!whole&&fmt(r16(pieceMeasures(piece,whole)[row.measure])).replace(/"$/,'')===row.said;
  });
}
/* A step may also say, with functions that are only used here and never stored:
     pick(piece, parts)       which of the pieces it names it takes (the two BACK posts; the studs of ONE wall). The
                              next step that names the same pieces gets the rest.
     bring: [group, ...]      parts that were built in earlier steps and are set in place in this one (the top
                              frame of a stand that is lowered onto the posts, a wall that is stood up, a drawer
                              box that is slid in). Each group is a function (piece, parts) -> true for its pieces.
                              It is stored as lists of ids. The fasteners between such a part and the rest of
                              the design then belong to THIS step, where they are driven, and the pictures leave
                              the part out between the step that builds it and this one. */
function stampSteps(steps,parts){
  const taken=new Set();
  return steps.map(step=>{
    const own=parts.filter(p=>step.add.includes(p.name)&&!taken.has(p.id)&&(!step.pick||step.pick(p,parts)));
    own.forEach(p=>taken.add(p.id));
    const stamped={...step,ids:own.map(p=>p.id),sig:own.length?stepSignature(own):null};
    delete stamped.pick;
    // the numbers the words quote about OTHER pieces (a marking step that lists the height of every shelf)
    const about=quotedMeasures(step.t,parts.filter(p=>!own.includes(p)),parts);
    if(about.length)stamped.about=about;
    if(Array.isArray(step.bring)){
      stamped.bring=step.bring.map(group=>typeof group==='function'?parts.filter(p=>group(p,parts)).map(p=>p.id):group).filter(ids=>ids.length);
    }
    return stamped;
  });
}
/* the cutting step: the usual one, or a preset's own that tells the same thing in its own words (the Shed's) */
const isCutStep=step=>step.t===CUT.t||(!step.add.length&&/cut every piece on the cut list/i.test(step.t));
/* Map piece id -> index of its preset step. */
function presetStepOfPieces(steps){
  const owner=new Map(),present=new Map(S.parts.map(p=>[p.id,p]));
  if(steps.some(step=>Array.isArray(step.ids))){
    steps.forEach((step,index)=>{
      for(const id of step.ids||[])if(present.has(id)&&!owner.has(id))owner.set(id,index);
    });
  }else{   // a project saved before steps kept ids: the first step that names the piece
    for(const p of S.parts){
      const index=steps.findIndex(step=>step.add.includes(p.name));
      if(index>=0)owner.set(p.id,index);
    }
  }
  return owner;
}

/* Copies of a placed design that are built in its own steps. A preset may ask for it (preset.copiesShareSteps: the
   Dining chair, made as a set with Copy in a row): a placement that is an exact copy of the one the steps were
   written for (the same preset and form values, S.sets, and the same pieces by name, board and size, however it was
   moved, turned a quarter turn or mirrored) has each of its pieces put in the step that has the piece of the same
   name. Every piece name of the stepped design must then be in one step only. Adds those pieces to `owner` and
   returns {of: their ids, made: step index -> how many are built in it, most, name}. A copy that was changed is
   not one, and gets steps of its own as before. */
function copiesInSteps(owner){
  const found={of:new Set(),made:new Map(),most:1,name:''},sets=S.sets||{};
  const signature=pieces=>pieces.map(p=>[p.name,p.mat,r16(p.l),r16(p.w),r16(p.t)].join('|')).sort().join(',');
  const stepped=new Set(S.parts.filter(p=>owner.has(p.id)&&p.set!==undefined&&p.set!==null).map(p=>String(p.set)));
  for(const number of stepped){
    const set=sets[number],preset=set&&PRESETS.find(row=>row.name===set.name);
    if(!preset||!preset.copiesShareSteps)continue;
    const own=S.parts.filter(p=>String(p.set)===number);
    if(!own.every(p=>owner.has(p.id)))continue;
    const stepOfName=new Map();
    let oneStepEach=true;
    for(const p of own){
      if(stepOfName.has(p.name)&&stepOfName.get(p.name)!==owner.get(p.id))oneStepEach=false;
      stepOfName.set(p.name,owner.get(p.id));
    }
    if(!oneStepEach)continue;
    const mine=signature(own),vals=JSON.stringify(set.vals||{});
    let made=1;
    for(const[other,twin]of Object.entries(sets)){
      if(other===number||!twin||twin.name!==set.name||JSON.stringify(twin.vals||{})!==vals)continue;
      const theirs=S.parts.filter(p=>String(p.set)===other);
      if(!theirs.length||theirs.some(p=>owner.has(p.id))||signature(theirs)!==mine)continue;
      for(const p of theirs){owner.set(p.id,stepOfName.get(p.name));found.of.add(p.id);}
      made++;
    }
    if(made<2)continue;
    for(const index of new Set(stepOfName.values()))found.made.set(index,made);
    found.most=Math.max(found.most,made);
    found.name=set.name.toLowerCase();
  }
  return found;
}

/* ---------- where a fastener goes, in words and as size lines ----------
   For one joint and its layout: a sentence a person can mark the wood from, and the same distances as pairs of
   points for the size lines of the close-up picture, so the words and the picture cannot disagree.
   Returns {text, general, dims: [{from, to}], across, first, gap, rule, row}
     text      the sentence with every number
     general   the same sentence without the distance across the joint, for a group of joints that sit at
               different heights (five shelves in one bookcase side)
     across / first / gap   the numbers, for telling whether two joints are laid out the same way
     rule      what the words measure from, so that the marking view (js/markingview.js) draws the same sizes
               from the same edges: {across, along} for fasteners driven straight in (see placesWords), or
               {row:true} for pocket holes, angled nails and brackets
     row       pocket holes, angled nails, brackets: {axis, range, frame, ends, refWord, refName} the line they
               are spread along and the face they are marked on
   "Left", "right", "top" and "bottom" in the words are as the marking view of the joint sees the face that is
   marked (markingFrame, js/markingview.js): seen from the back, the left end is the end on your left as you
   stand behind it, and the words say so. */
const HEIGHT_FROM_TOP=6;   // inches: see fromNearer in fastenerPlaces
function fastenerPlaces(joint,layout){
  const none={text:'',mirrored:'',general:'',dims:[],across:null,side:0,first:null,gap:null};
  if(!layout.length)return none;
  // one screw of a long row that was moved off a screw of another joint (js/fasteners.js): the words give the even spacing
  layout=layout.map(f=>f.pos0?{...f,pos:f.pos0}:f);
  const shape=jointShape(joint),f0=layout[0],through=f0.through,into=f0.into;
  const throughBox=plainBox(through),intoBox=plainBox(into);
  const sideWord=(piece,axis)=>piece.ax[0]===axis?'end':'edge';
  const biggest=(vector,skip)=>[0,1,2].filter(k=>k!==skip).reduce((best,k)=>Math.abs(vector[k])>Math.abs(vector[best])?k:best);
  /* a pocket hole, an angled screw or nail, or a bracket sits along the end of its own piece (a bracket: along
     the inside corner). They are spread evenly along one line, so the words give the first one from one end of
     that line and the spacing; the marking view draws the same chain on the face they are marked on. */
  if(f0.kind==='pocket'||f0.toe||f0.kind==='bracket'){
    const pocket=f0.kind==='pocket',bracket=f0.kind==='bracket';
    const slantAxis=pocket?biggest(f0.pocket.out,-1):bracket?biggest(f0.dir,-1):biggest(f0.dir,shape.k);   // the way the hole or the nail leans (a bracket: the way its leg stands off)
    const axis=[0,1,2].find(k=>k!==shape.k&&k!==slantAxis);                       // the way they are spread
    const range=axis===shape.L?shape.rangeL:shape.rangeW;
    const pointOf=f=>pocket?f.pocket.mouth:f.pos;
    const spots=layout.map(f=>pointOf(f)[axis]).sort((a,b)=>a-b);
    const first=spots[0]-range[0],what=pocket?'pocket hole':bracket?'bracket':f0.kind==='nail'?'nail':'screw';
    const gap=layout.length>1?spots[1]-spots[0]:null;
    const rowGaps=spots.slice(1).map((v,index)=>Math.round((v-spots[index])*16)/16);
    const evenRow=rowGaps.every(one=>Math.abs(one-rowGaps[0])<.03);
    const wholeEnd=Math.abs(range[0]-throughBox.lo[axis])<.07&&Math.abs(range[1]-throughBox.hi[axis])<.07;
    const ref=wholeEnd?`the ${through.name}`:'the joint',refSide=wholeEnd?sideWord(through,axis):'end';
    // the face they are marked on: the face the holes open on, the side the nail starts in, the face the bracket lies on
    const faceAxis=pocket?biggest(f0.pocket.out,-1):slantAxis;
    const look=pocket?-Math.sign(f0.pocket.out[faceAxis]):bracket?-Math.sign(f0.dir[faceAxis]):Math.sign(f0.dir[faceAxis])||1;
    const frame=markingFrame(faceAxis,look,through);
    // the end the first one is measured from: the one on the left of the marking view (or at its bottom)
    const startHigh=frame.screenLowIsHigh(axis),startName=frame.nameOf(axis,startHigh),otherName=frame.nameOf(axis,!startHigh);
    const firstSaid=startHigh?range[1]-spots[spots.length-1]:first;
    // the first and the last from their own ends, and whether they are alike (a row set off the middle is not)
    const lastFrom=range[1]-spots[spots.length-1],lastSaid=startHigh?first:lastFrom;
    const balanced=Math.abs(Math.round(first*16)-Math.round(lastFrom*16))<=0;
    let text;
    /* Pocket holes measured along the piece they are drilled in, from one end of that piece (each place given, not
       a spacing), in two cases:
       - a row with a hole moved off a piece that lies against that face (rule 10 in js/fasteners.js), or moved past
         the pocket holes in the ends of the piece (rule 11): it is not evenly spaced;
       - a joint over part of the piece (a top board crossing a cross rail): the piece is marked and drilled before
         it goes in, so the places are measured on it.
       The end they are measured from is the one on the left of the marking view (or at its bottom), named as the
       view sees it, like every other row. */
    const cleared=layout.find(f=>f.clear||f.passEnds||f.pastBolt);
    const alongPiece=pocket&&(!!cleared||!wholeEnd);
    const pieceStart=startHigh?throughBox.hi[axis]:throughBox.lo[axis];
    const fromPieceEnd=spots.map(v=>Math.abs(v-pieceStart)).sort((a,b)=>a-b);
    const pieceSide=sideWord(through,axis);
    // the same places from both ends of the piece (a short apron with its holes kept clear of the holes at both
    // ends): "from either end", so that the two aprons of a table, seen from opposite sides, read the same
    const pieceLength=throughBox.hi[axis]-throughBox.lo[axis];
    const bothEnds=fromPieceEnd.every((v,index)=>Math.abs(v+fromPieceEnd[fromPieceEnd.length-1-index]-pieceLength)<.03);
    if(alongPiece){
      text=`Put the ${what}${layout.length>1?'s':''} ${listWords(fromPieceEnd.map(inchWords))} from ${bothEnds?'either':'the '+startName} ${pieceSide} of the ${through.name}.`;
      if(cleared)text+=' '+notEvenlyWords(layout,through.name);
      if(frame.mirrored&&!bothEnds)text+=` Left and right are as you look at it ${frame.from}.`;
    }
    else if(layout.length===1&&balanced)text=`Put the ${what} in the middle of ${wholeEnd?'the '+through.name:'the joint'} (${inchWords(first)} from either ${refSide}).`;
    else if(layout.length===1)text=`Put the ${what} ${inchWords(firstSaid)} in from the ${startName} ${refSide} of ${ref} (${inchWords(lastSaid)} from the ${otherName} ${refSide}).`;
    else if(layout.length===2&&balanced)text=`Put one ${what} ${inchWords(first)} in from each ${refSide} of ${ref} (${inchWords(gap)} apart).`;
    else if(layout.length===2)text=`Put one ${what} ${inchWords(firstSaid)} in from the ${startName} ${refSide} of ${ref} and the other ${inchWords(lastSaid)} in from the ${otherName} ${refSide} (${inchWords(gap)} apart).`;
    else if(evenRow)text=`Put the first ${what} ${inchWords(firstSaid)} in from the ${startName} ${refSide} of ${ref}, then one every ${inchWords(gap)} `+
      (balanced?`(the last is as far from the ${otherName} ${refSide}).`:`(the last is ${inchWords(lastSaid)} from the ${otherName} ${refSide}).`);
    else{
      // not evenly spread (one moved off another screw): each gap in turn, from the start end
      const fromStart=startHigh?rowGaps.slice().reverse():rowGaps;
      text=`Put the first ${what} ${inchWords(firstSaid)} in from the ${startName} ${refSide} of ${ref}, then the others at gaps of ${listWords(fromStart.map(inchWords))}, in turn (the last is ${inchWords(lastSaid)} from the ${otherName} ${refSide}).`;
    }
    if(!alongPiece&&frame.mirrored&&layout.length>2)text+=` Left and right are as you look at it ${frame.from}.`;
    if(f0.toe){
      const back=Math.abs(f0.pos[shape.k]-shape.plane);
      text+=` Start each ${what} about ${inchWords(back)} back from the joint and slant it toward the joint.`;
    }
    if(bracket&&!f0.flat)text+=' Push each bracket tight into the corner before you mark its screw holes.';
    const start=pointOf(layout.slice().sort((a,b)=>pointOf(a)[axis]-pointOf(b)[axis])[0]);
    const from=start.slice(),to=start.slice();
    // (measured the way the words measure: from the start end of the piece when they give places along it)
    from[axis]=alongPiece?pieceStart:range[0];
    const dims=(alongPiece?fromPieceEnd[0]:first)>.05?[{from,to}]:[];
    if(layout.length>1&&!alongPiece){
      const next=start.slice();
      next[axis]=spots[1];
      dims.push({from:start.slice(),to:next});
    }
    /* the row, for the marking view (js/markingview.js) and for a line of several joints on one piece
       (pocketRowsWords): alongPiece rows give the places along the piece (at, from its startEnd end), and why they
       are not evenly spaced (clear, passEnds) */
    const row={axis,range,frame,faceAxis,startHigh,refWord:refSide,refName:wholeEnd?through.name:'',first:r16(first),gap:gap===null?null:r16(gap),even:evenRow,
      back:f0.toe?r16(Math.abs(f0.pos[shape.k]-shape.plane)):null,kind:what,
      alongPiece,through,startEnd:startName,bothEnds,side:pieceSide,at:pocket?fromPieceEnd.map(r16):null,
      clear:cleared?[...new Set(layout.flatMap(f=>f.clear||[]))]:null,passEnds:cleared?[...new Set(layout.flatMap(f=>f.passEnds||[]))]:null,pastBolt:layout.some(f=>f.pastBolt)};
    return{text,mirrored:text,general:text,dims,across:null,side:0,first:r16(first),gap:gap===null?null:r16(gap),rule:{row:true},row};
  }

  /* driven straight in (screws, brads, nails, dowels): a line across the joint, and places along it.
     Everything is measured on the piece that is MARKED (the one the fastener goes through; for a dowel, the
     one that is drilled first), from its own ends and edges, because that is the board the pencil is on: the
     piece behind it cannot be seen. The numbers are kept (spot) so that a line for many joints can tell
     whether they are laid out alike (placesWords). */
  const L=shape.L,W=shape.W,sorted=layout.slice().sort((a,b)=>a.pos[L]-b.pos[L]);
  const marked=f0.kind==='dowel'?into:through,markedBox=f0.kind==='dowel'?intoBox:throughBox;
  const round=v=>Math.round(v*16)/16;
  // The rows across: the fasteners sorted into rows by where they sit (to the nearest 1/16"), and each row's
  // distance from the edges worked out from where its fasteners really are, rounded once. (Rounding the place
  // first and the distance after made 0.209" read 1/4" where the edge is not on a sixteenth, a lean-to stud.)
  const rowsAcross=new Map();
  for(const f of layout){
    const key=round(f.pos[W]);
    if(!rowsAcross.has(key))rowsAcross.set(key,[]);
    rowsAcross.get(key).push(f.pos[W]);
  }
  const acrossValues=[...rowsAcross.keys()].sort((a,b)=>a-b);
  const acrossRaw=acrossValues.map(key=>{const list=rowsAcross.get(key);return list.reduce((sum,v)=>sum+v,0)/list.length;});
  const acrossLow=acrossRaw.map(v=>round(v-markedBox.lo[W])),acrossHigh=acrossRaw.map(v=>round(markedBox.hi[W]-v)).reverse();
  // A height is measured up from the bottom end, as the steps that mark heights do, unless the line is within
  // HEIGHT_FROM_TOP of the top end and nearer to it (a top rail). Everything else: from the nearer side.
  const fromNearer=(axis,low,high)=>axis===1?!(high<low&&high<HEIGHT_FROM_TOP):low<=high+.03;
  const nearLowW=fromNearer(W,acrossLow[0],acrossHigh[0]);
  const alongLow=sorted.map(f=>round(f.pos[L]-markedBox.lo[L])),alongHigh=sorted.map(f=>round(markedBox.hi[L]-f.pos[L])).reverse();
  const nearLowL=alongLow[0]<=alongHigh[0]+.03;
  const first=sorted[0].pos[L]-shape.rangeL[0],gap=sorted.length>1?sorted[1].pos[L]-sorted[0].pos[L]:null;
  // every gap along the row, and whether they are all one size: "then one every 7 1/4"" is only said when they are
  // (a screw moved out of the way of another makes them uneven)
  const gaps=sorted.slice(1).map((f,index)=>round(f.pos[L]-sorted[index].pos[L]));
  const evenGaps=gaps.every(one=>Math.abs(one-gaps[0])<.03);
  // the last one from the far side of the place where the two pieces touch (two screws moved on purpose are not
  // as far from both sides)
  const last=shape.rangeL[1]-sorted[sorted.length-1].pos[L];
  // two on a slant: each one's distances, and which end and edge each is nearest (0 the low one, 1 the high one)
  const nearSide=sorted.map(f=>[f.pos[L]-markedBox.lo[L]<=markedBox.hi[L]-f.pos[L]?0:1,f.pos[W]-markedBox.lo[W]<=markedBox.hi[W]-f.pos[W]?0:1]);
  const fromPlace=sorted.map((f,index)=>round(index?shape.rangeL[1]-f.pos[L]:f.pos[L]-shape.rangeL[0]));
  // the joint is as wide as the other piece: the line then runs over the middle of that piece
  const overInto=Math.abs(intoBox.hi[W]-intoBox.lo[W]-shape.wide)<.07;
  const endsAt=b=>Math.abs(b.lo[L]-shape.rangeL[0])<.07&&Math.abs(b.hi[L]-shape.rangeL[1])<.07;
  // the same numbers as size lines, on the face the fastener goes in at
  const face=f0.pos[shape.k];
  const at=(along,across)=>{const p=[0,0,0];p[shape.k]=face;p[L]=along;p[W]=across;return p;};
  const start=sorted[0].pos,end=nearLowL?markedBox.lo[L]:markedBox.hi[L];
  // two set on a slant are each given from the NEAREST edge and end (placesWords): the size line is measured the same way
  const slant=sorted.length===2&&acrossValues.length===2;
  const edge=slant?(start[W]-markedBox.lo[W]<=markedBox.hi[W]-start[W]?markedBox.lo[W]:markedBox.hi[W]):nearLowW?markedBox.lo[W]:markedBox.hi[W];
  const nearest=nearLowL?sorted[0].pos:sorted[sorted.length-1].pos;   // the fastener nearest the end the marks are measured from
  // (inches: the number the words give, rounded the way the words round it: once, from where the fastener is)
  const acrossInches=round(Math.abs(start[W]-edge));
  const acrossDim=Math.abs(edge-start[W])>.05?[{from:at(start[L],edge),to:at(start[L],start[W]),word:sideWord(marked,W),inches:acrossInches}]:[];
  const gapDim=gap?[{from:at(start[L],sorted[1].pos[W]),to:at(sorted[1].pos[L],sorted[1].pos[W])}]:[];
  // the marking view of this joint: the face of the marked piece, seen from where the fastener comes from (a
  // dowel: the face of the joint, seen from the other piece)
  const frame=markingFrame(shape.k,Math.sign(f0.dir[shape.k])||1,marked);
  const spot={
    kind:'straight',n:sorted.length,marked,into,W,L,frame,
    sideW:sideWord(marked,W),sideL:sideWord(marked,L),
    acrossLow,acrossHigh,acrossNear:nearLowW?acrossLow:acrossHigh,nearLowW,
    // "at the middle (24" from either end)" only when both ends really read the same number: a deck 1/16" short of
    // its frame (the Garage shelves, js/builders-storage.js) has a screw 24" from one end and 23 15/16" from the other
    centredW:acrossValues.length===1&&Math.abs(acrossLow[0]-acrossHigh[0])<.03,
    alongLow,alongHigh,nearLowL,centredL:sorted.length===1&&Math.abs(alongLow[0]-alongHigh[0])<.03,
    // each fastener by how far it is from the nearest end and the nearest edge of the marked piece
    nearEach:sorted.map(f=>[round(Math.min(f.pos[L]-markedBox.lo[L],markedBox.hi[L]-f.pos[L])),round(Math.min(f.pos[W]-markedBox.lo[W],markedBox.hi[W]-f.pos[W]))]),
    nearSide,fromPlace,gaps,evenGaps,last:round(last),
    first:r16(first),gap:gap?r16(gap):null,long:r16(shape.long),
    overInto,beyond:shape.k===1?(shape.signInto(into)<0?'under it':'above it'):'behind it',
    intoEnds:endsAt(intoBox),intoSideL:sideWord(into,L),
    // size lines: measured on the marked piece, or (when the words have to speak of the place where the two
    // pieces touch) from the start of that place
    dimsMarked:acrossDim.concat(Math.abs(end-nearest[L])>.05?[{from:at(end,nearest[W]),to:at(nearest[L],nearest[W]),word:sideWord(marked,L)}]:[],gapDim),
    dimsJoint:acrossDim.concat(first>.05?[{from:at(shape.rangeL[0],start[W]),to:at(start[L],start[W]),word:'edge of the joint'}]:[],gapDim),
  };
  const said=placesWords([spot]);
  return{...none,text:said.text,dims:said.fromJoint?spot.dimsJoint:spot.dimsMarked,spot,first:spot.first,gap:spot.gap,rule:said.rule};
}
/* Where the fasteners of one line go, in words, for all its joints at once (spots: one entry per joint, from
   fastenerPlaces). Numbers that are the same at every joint are given once, from a named end or edge of the
   marked piece; joints that mirror each other get "the nearest end"; joints at different places along one
   board (shelves up a bookcase side, cross pieces along a rail) get the list of their distances.
   Returns {text, fromJoint, rule}: fromJoint is true when the words had to measure from the place where the two
   pieces touch, so that the close-up draws its size lines from there as well. rule says what the words measured
   from, so that the marking view (jointMarkPlan, js/markingview.js) draws exactly those sizes:
     rule.slant    'nearest' (each of two from its nearest end and edge) or 'joint' (from the corners of the place)
     rule.across   {kind:'middle'} | {kind:'from', side:'low'|'high'|'near'} | {kind:'none'} (no number across)
     rule.along    {kind:'middle'} | {kind:'from', side:'low'|'high'|'near'} (n=2: both from that end; more: the
                   first from it, then the spacing) | {kind:'even'} (from both ends: the first, the spacing, the
                   last; starting at the end on the left of the marking view, or at its bottom) | {kind:'joint'}
                   (from the side of the place where the two pieces touch)
   Ends and edges named left and right are as the marking view sees them (markingFrame): from the back of a
   piece, the left end is the one on your left as you stand behind it, and the words then say so. */
function placesWords(spots){
  const s=spots[0],name=s.marked.name,lead=s.n>1?'Mark them':'Mark it';
  const same=pick=>{const want=JSON.stringify(pick(s));return spots.every(spot=>JSON.stringify(pick(spot))===want);};
  const distinct=pick=>[...new Set(spots.map(pick))].sort((a,b)=>a-b);
  const said=values=>listWords(values.map(inchWords));
  const LIST_MAX=12;   // a list of more places than this is no help on a page (the 9 studs of a 10 ft shed wall still are)
  let fromJoint=false;
  const behind=`the ${s.into.name} ${s.beyond}`;
  // the name of an end or an edge: as the marking view sees it when every joint of the line is seen the same way
  const mirrored=spots.every(spot=>spot.frame&&spot.frame.mirrored);
  let usedLeftRight=false;
  const sideName=(axis,high)=>{
    const word=mirrored?s.frame.nameOf(axis,high):DIRECTION_ENDS[axis][high?1:0];
    if(axis===0)usedLeftRight=true;
    return word;
  };
  // the spacing after the first one: "one every 4 5/8"" when the gaps are equal, else each gap in turn (a screw
  // moved out of the way of another makes them uneven, and "every" would then be wrong)
  const spacingWords=gaps=>gaps.every(one=>Math.abs(one-gaps[0])<.03)?`one every ${inchWords(gaps[0])}`:`the others at gaps of ${said(gaps)}, in turn`;
  // "3/8" down from the top end", "2 3/8" in from the front edge"
  const off=(axis,high)=>axis===1?(high?'down from':'up from'):'in from';
  const finish=(text,rule)=>({fromJoint,rule,text:text+(mirrored&&usedLeftRight?` Left and right are as you look at the ${name} ${s.frame.from}.`:'')});

  // two fasteners set on a slant (a joint wide enough to stagger them): each from the nearest end and edge
  if(s.n===2&&s.acrossLow.length===2){
    // the two, the one nearer its end first, and whether the other is nearest the same end and edge or the other ones
    const slantPair=spot=>{
      const order=[0,1].sort((i,j)=>spot.nearEach[i][0]-spot.nearEach[j][0]||spot.nearEach[i][1]-spot.nearEach[j][1]);
      const[a,b]=order.map(index=>spot.nearEach[index]),[sa,sb]=order.map(index=>spot.nearSide[index]);
      return{a,b,sameEnd:sa[0]===sb[0],sameEdge:sa[1]===sb[1]};
    };
    if(same(slantPair)){
      const{a,b,sameEnd,sameEdge}=slantPair(s);
      return finish(`${lead} on the ${name}, on a slant so that they do not split the wood along one line: one ${inchWords(a[0])} from the nearest ${s.sideL} and ${inchWords(a[1])} from the nearest ${s.sideW} of the ${name}, `+
        `the other ${inchWords(b[0])} from ${sameEnd?'that':'the other'} ${s.sideL} and ${inchWords(b[1])} from ${sameEdge?'that':'the other'} ${s.sideW}.`,{slant:'nearest'});
    }
    // joints that mirror each other slant the other way: the same distances, paired differently
    // (each one's two numbers together, so it is plain which goes with which)
    const pairsOf=spot=>spot.nearEach.slice().sort((one,two)=>one[0]-two[0]||one[1]-two[1]);
    if(same(pairsOf)){
      const[a,b]=pairsOf(s);
      return finish(`${lead} on the ${name}, on a slant (either way round) so that they do not split the wood along one line: one ${inchWords(a[0])} from the ${s.sideL} of the ${name} nearest it and ${inchWords(a[1])} from the ${s.sideW} nearest it, `+
        `the other ${inchWords(b[0])} from the ${s.sideL} nearest it and ${inchWords(b[1])} from the ${s.sideW} nearest it.`,{slant:'nearest'});
    }
    /* At opposite corners of the place where the two pieces touch: each from its own side of that place and from
       the nearest edge of the marked piece, with its own numbers (the near screw of a bed end rail is 1 1/4" from
       its side of the leg, the far one 2 1/4"). Joints that are not alike get a sentence each (the caller). */
    const corners=spot=>spot.fromPlace.map((along,index)=>[along,spot.nearEach[index][1]]);
    const eachSame=spot=>{const[a,b]=corners(spot);return Math.abs(a[0]-b[0])<.03&&Math.abs(a[1]-b[1])<.03;};
    const mirrorOf=spot=>corners(spot).slice().reverse();
    const sameWay=same(corners),eitherWay=spots.every(spot=>{const want=JSON.stringify(corners(s));return JSON.stringify(corners(spot))===want||JSON.stringify(mirrorOf(spot))===want;});
    if(!sameWay&&!eitherWay)return{fromJoint,text:''};
    fromJoint=true;
    const[a,b]=corners(s),place=`the place where the ${name} lies on ${behind}`;
    if(spots.every(eachSame))return finish(`${lead} on the ${name}: the two go at opposite corners of ${place}, each ${inchWords(a[0])} in from its own side of that place and ${inchWords(a[1])} from the nearest ${s.sideW} of the ${name}.`,{slant:'joint'});
    const lowSide=`the ${sideName(s.L,false)} side`,highSide=`the ${sideName(s.L,true)} side`;
    const sides=sameWay?[lowSide,highSide]:['one side','the other side'];
    return finish(`${lead} on the ${name}: the two go at opposite corners of ${place}, one ${inchWords(a[0])} in from ${sides[0]} of that place and ${inchWords(a[1])} from the nearest ${s.sideW} of the ${name}, `+
      `the other ${inchWords(b[0])} in from ${sides[1]} and ${inchWords(b[1])} from its nearest ${s.sideW}${sameWay?'':' (either way round)'}.`,{slant:'joint'});
  }

  /* across: the line (or the two rows) the fasteners sit on */
  let across,acrossRule;
  const middleNote=spots.every(spot=>spot.overInto)?` (that is the middle of ${behind})`:'';
  if(spots.every(spot=>spot.centredW)){
    // the middle, with its number too, so the size line of the close-up says nothing the words do not
    across=s.marked.ax[0]===s.W?`on a line across the ${name}, at the middle of its length (${inchWords(s.acrossLow[0])} from either end)`
      :`along the middle of the ${name} (${inchWords(s.acrossLow[0])} from either edge)`;
    acrossRule={kind:'middle'};
  }else if(same(spot=>spot.acrossNear)){
    const named=same(spot=>spot.nearLowW),high=!s.nearLowW;
    const which=named?`${off(s.W,high)} the ${sideName(s.W,high)} ${s.sideW}`:`from the nearest ${s.sideW}`;
    across=s.acrossNear.length>1?`in two rows, ${said(s.acrossNear)} ${which} of the ${name}, in a zig-zag`
      :`on a line ${inchWords(s.acrossNear[0])} ${which} of the ${name}${middleNote}`;
    acrossRule={kind:'from',side:named?(high?'high':'low'):'near'};
  }else if(spots.length===2&&spots[0].marked!==spots[1].marked&&spots.every(spot=>spot.acrossLow.length===1)&&!same(spot=>spot.nearLowW)&&!same(spot=>spot.acrossNear)){
    // Pieces of one name, each fastened near its own outer edge with its own number (the front and back top
    // rails of a drawer case, each screwed up into its own apron, 5/8" from the back edge of one and 3/8" from
    // the front edge of the other): one sentence "on two lines, 5/8" and 2 5/8" from the back edge" would have a
    // beginner mark both lines on both. The caller says each place on its own (whereWords).
    return{fromJoint,text:''};
  }else if(s.acrossLow.length===1&&distinct(spot=>spot.acrossLow[0]).length<=LIST_MAX){
    const lines=distinct(spot=>spot.acrossLow[0]);
    across=`on ${countWord(lines.length)} lines, ${said(lines)} ${off(s.W,false)} the ${sideName(s.W,false)} ${s.sideW} of the ${name}`+(spots.every(spot=>spot.overInto)?` (each is the middle of a ${s.into.name} ${s.beyond})`:'');
    acrossRule={kind:'from',side:'low'};
  }else if(s.acrossLow.length===1){
    across=`on a line over the middle of each ${s.into.name} ${s.beyond}`;
    acrossRule={kind:'none'};
  }else if(spots.length>1){
    // two rows that sit at different places at different joints (a back panel over a top rail and a bottom
    // rail): no one sentence gives their numbers, so the caller writes a sentence for each sort of joint
    return{fromJoint,text:''};
  }else{
    across=`in two rows in a zig-zag, each row a quarter of the way in from the edges of the place where the ${name} lies on ${behind}`;
    acrossRule={kind:'none'};
  }

  /* along: where on that line */
  let along,alongRule;
  const eachEnd=spot=>[spot.alongLow[0],spot.alongHigh[0]];   // the first from the low end, the last from the high end
  const intoWords=()=>{   // measured from the piece behind: only when the marked piece gives no single number
    fromJoint=true;
    alongRule={kind:'joint'};
    const firsts=distinct(spot=>spot.alongLow[0]);
    const where=firsts.length<=LIST_MAX?` (measured on the ${name}: the first of each place is ${said(firsts)} ${off(s.L,false)} its ${sideName(s.L,false)} ${s.sideL})`:'';
    const ref=s.intoEnds?`${s.intoSideL} of ${behind}`:`side of the place where the ${name} lies on ${behind}`;
    const refWord=s.intoEnds?s.intoSideL:'side';
    if(s.n===1)return`${inchWords(s.first)} in from the ${ref}${where}`;
    // two: as far from both sides, or each with its own number (a pair moved so that other screws pass them)
    if(s.n===2&&Math.abs(s.first-s.last)<.03)return`${inchWords(s.first)} in from each ${ref} (${inchWords(s.gap)} apart)${where}`;
    if(s.n===2)return`one ${inchWords(s.first)} ${off(s.L,false)} the ${sideName(s.L,false)} ${ref}, the other ${inchWords(s.last)} ${off(s.L,true)} its ${sideName(s.L,true)} ${refWord} (${inchWords(s.gap)} apart)${where}`;
    return`the first ${inchWords(s.first)} in from the ${ref}, then ${spacingWords(s.gaps)}${where}`;
  };
  if(s.n===1){
    if(spots.every(spot=>spot.centredL)){
      along=`${s.marked.ax[0]===s.L?'at the middle of its length':'at the middle of its width'} (${inchWords(s.alongLow[0])} from either ${s.sideL})`;
      alongRule={kind:'middle'};
    }else if(same(spot=>spot.alongLow[0])){
      along=`${inchWords(s.alongLow[0])} ${off(s.L,false)} the ${sideName(s.L,false)} ${s.sideL} of the ${name}`;
      alongRule={kind:'from',side:'low'};
    }else if(same(spot=>Math.min(spot.alongLow[0],spot.alongHigh[0]))){
      along=`${inchWords(Math.min(s.alongLow[0],s.alongHigh[0]))} from the nearest ${s.sideL} of the ${name}`;
      alongRule={kind:'from',side:'near'};
    }else if(distinct(spot=>spot.alongLow[0]).length<=LIST_MAX){
      along=`one at each of these distances ${off(s.L,false)} the ${sideName(s.L,false)} ${s.sideL} of the ${name}: ${said(distinct(spot=>spot.alongLow[0]))}`;
      alongRule={kind:'from',side:'low'};
    }else along=intoWords();
  }else{
    // Two or more on the line. They are counted from the end of the marked piece they are nearer to: the two
    // screws through the foot of a post are "1 1/4 in. and 2 1/4 in. from its bottom end", not one from each end.
    const groupNearLow=spot=>spot.alongLow[0]+spot.alongLow[spot.n-1]<=spot.alongHigh[0]+spot.alongHigh[spot.n-1]+.03;
    const fromNear=spot=>groupNearLow(spot)?spot.alongLow:spot.alongHigh;
    // ("the last is as far from the other end" only when the two ends read the same number: see centredW above)
    const evenBothEnds=spot=>Math.abs(eachEnd(spot)[0]-eachEnd(spot)[1])<.03;
    if(spots.every(spot=>evenBothEnds(spot)&&spot.evenGaps)&&same(spot=>[spot.alongLow[0],spot.gap])){
      // the same from both ends: counted from the end on the left of the marking view (or at its bottom)
      const startHigh=s.frame.screenLowIsHigh(s.L),start=startHigh?s.alongHigh[0]:s.alongLow[0];
      along=s.n===2?`${inchWords(s.alongLow[0])} in from each ${s.sideL} of the ${name} (${inchWords(s.gap)} apart)`
        :`the first ${inchWords(start)} ${off(s.L,startHigh)} the ${sideName(s.L,startHigh)} ${s.sideL} of the ${name}, then one every ${inchWords(s.gap)} (the last is as far from the ${sideName(s.L,!startHigh)} ${s.sideL})`;
      alongRule={kind:'even'};
    }else if(same(fromNear)){
      const named=same(groupNearLow),high=!groupNearLow(s),near=fromNear(s);
      const which=named?`${off(s.L,high)} the ${sideName(s.L,high)} ${s.sideL}`:`from the nearest ${s.sideL}`;
      // (each gap rounded once, from where the fasteners are: s.gaps runs from the low end. The difference of two
      // places already rounded made a gap of 4.333" read 4 3/8" where the marking view says 4 5/16")
      const gapsFromNear=high?s.gaps.slice().reverse():s.gaps;
      along=s.n===2?`${inchWords(near[0])} and ${inchWords(near[1])} ${which} of the ${name}`
        :`the first ${inchWords(near[0])} ${which} of the ${name}, then ${spacingWords(gapsFromNear)}`;
      alongRule={kind:'from',side:named?(high?'high':'low'):'near'};
    }else if(same(spot=>[spot.first,spot.last,spot.gaps]))along=intoWords();
    else return{fromJoint,text:''};   // joints of different lengths: the caller writes a sentence for each length
  }
  return finish(`${lead} on the ${name}: ${across}; ${along}.`,{across:acrossRule,along:alongRule});
}

/* ---------- one "Fasten with" line ----------
   links: the joints of one step that take the very same fastener between the same two kinds of piece. */
/* The face of a piece that is in a joint, as the words call it: 'face', 'edge' or 'end'. The short faces of a
   plywood panel are its ends, like those of a board (the faces square to its length), so that a step and the
   line under it use one word for one thing. */
function faceSaid(joint,piece){
  const face=piece===joint.a?joint.fa:joint.fb;
  return face==='edge'&&!tilted(piece)&&piece.ax[0]===joint.k?'end':face;
}
function faceOfInto(joint,into){
  return faceSaid(joint,into);
}
/* Do other pieces of the design lie against both faces of this piece along this axis (b: its box)? */
function touchedOnBothFaces(piece,b,axis){
  const others=[1,2,0].filter(k=>k!==axis);
  let low=false,high=false;
  for(const other of S.parts){
    if(other===piece||isProp(other)||tilted(other))continue;
    const o=plainBox(other);
    if(!others.every(k=>o.lo[k]<b.hi[k]-.01&&o.hi[k]>b.lo[k]+.01))continue;
    if(Math.abs(o.hi[axis]-b.lo[axis])<.01)low=true;
    if(Math.abs(o.lo[axis]-b.hi[axis])<.01)high=true;
    if(low&&high)return true;
  }
  return false;
}
/* the face of a piece that points this way, in words: 'underside', 'inside face (it faces left)' */
function faceWords(piece,out,withDirection){
  const axis=[0,1,2].reduce((best,k)=>Math.abs(out[k])>Math.abs(out[best])?k:best,0),high=out[axis]>0;
  if(axis===1)return high?'top face':'underside';
  const b=plainBox(piece),middle=designMiddle();
  // A piece in the middle of the design (the cross rail under the middle of a desk) has no inside or outside face:
  // the face is named by the way it looks, or, where the joints of a line differ, either face will do
  if(middle[axis]>b.lo[axis]-.5&&middle[axis]<b.hi[axis]+.5){
    const end=DIRECTION_ENDS[axis][high?1:0];
    return withDirection?`${end} face (the one that looks to the ${end})`:`${DIRECTION_ENDS[axis].join(' or ')} face (either one)`;
  }
  // Nor has a piece with others against both of its faces this way (a divider between two bays, not in the middle):
  // its face is named by the way it looks, always: "back or front face" told a beginner nothing about which face of
  // a back rail with a back panel behind it takes the holes (the fish countertop review, S6)
  if(touchedOnBothFaces(piece,b,axis)){
    const end=DIRECTION_ENDS[axis][high?1:0];
    return`${end} face (the one that looks to the ${end})`;
  }
  const inward=high===(middle[axis]>(b.lo[axis]+b.hi[axis])/2);
  // "faces out" means nothing on a piece inside the design (two cross rails under a desk top, each off the middle):
  // say which way out is, the nearer end (left or right) or away from the middle (front or back)
  const outward=axis===0?'the nearer end of the design':'away from the middle of the design';
  return`${inward?'inside':'outside'} face`+(withDirection?` (the one that faces the ${DIRECTION_ENDS[axis][high?1:0]})`:` (the one that faces ${inward?'the middle of the design':outward})`);
}
/* Screws driven at an angle start on one side of their piece or on both in turn (rule 7 in js/fasteners.js); a
   board screwed at an angle into an upright that is covered on its other side starts them all on its hidden side
   (js/fastenerreach.js). The words for that: ', all from its underside', or ', from both sides in turn'. */
function angledFromWords(all){
  const faces=new Map();   // which face each starts on -> its words
  for(const facts of all)for(const f of facts.layout){
    if(!f.toe)continue;
    const k=facts.joint.k,s=[0,1,2].filter(axis=>axis!==k).reduce((best,axis)=>Math.abs(f.dir[axis])>Math.abs(f.dir[best])?axis:best);
    const out=[0,0,0];
    out[s]=f.dir[s]>0?-1:1;
    const words=faceWords(f.through,out,false);
    // a piece in the middle of the design has the same words for both of its faces ("back or front face (either
    // one)"): there the two faces are told apart by the way they look, so nails from both sides do not read as one face
    faces.set(/\(either one\)/.test(words)?words+'|'+s+'|'+out[s]:words,words);
  }
  return faces.size===1&&all.some(facts=>facts.layout.length>1)?`, all from its ${[...faces.values()][0]}`:', from both sides in turn';
}
/* 'Stud (F)'; 'Shelf deck (F, G)' for pieces of one name in two or three sizes; the bare name for more sizes */
function namedLabel(pieces,letterOf){
  const letters=[...new Set(pieces.map(letterOf).filter(Boolean))].sort();
  return pieces[0].name+(letters.length&&letters.length<=3?` (${letters.join(', ')})`:'');
}
/* what the joints of a line have in common, joint by joint: the fastener, the piece it goes through, the piece it goes into */
function linkFacts(link){
  const joint=link.joint,spec=jSpec(joint,link.type),layout=fastenersOfLink(link),f=layout[0];
  const through=f?f.through:joint.a,into=f?f.into:joint.b;
  return{link,joint,spec,layout,f,through,into,intoFace:f?faceOfInto(joint,into):'',how:spec.drive?spec.drive.how:f&&f.toe?'toe':f?f.kind:'glue'};
}
/* Two keys. linePairKey: the joints that read the same down to the two pieces ("through the Side into the end of a
   Shelf"); they always share a line. lineKindKey: the joints that take the same fastener the same way, between
   whatever pieces; a step with more than LINES_MAX lines is shortened to one line for each of these. */
const LINES_MAX=6;
function lineKindKey(facts){
  const spaced=!!facts.spec.bySpacing||facts.spec.n>2;   // long joints of different lengths take different counts at the same spacing
  // into the end of a piece the count is fixed by the size of the end, so those joints never share a line with long ones
  const byRule=facts.how==='sheet'||facts.how==='plate';   // plywood nailed by spacing, plate screws: one rule whatever is behind
  return[facts.link.type,facts.spec.hw.map(row=>row[0]).join('+'),facts.how,byRule?'':facts.intoFace==='end'?'end':'side',byRule||spaced?'spaced':facts.spec.n].join('|');
}
// (moved: screws that were set aside to pass the screws of another joint, js/fasteners.js, get a line of their own, so one line gives one set of marks;
//  joinMovedLines joins such lines again when the joined line names the places of each set of marks)
// (pocket holes in the underside of some shelves and in the top face of others, rule 13 in js/fasteners.js, get a
//  line each: one line names one face; holes on the two inside faces of a pair of sides still share one)
const pocketUpOrDown=facts=>facts.f&&facts.f.pocket?'face:'+Math.round(facts.f.pocket.out[1])+(facts.f.pocket.plugged?':plugged':''):'';
const linePairKey=facts=>facts.how==='sheet'||facts.how==='plate'?[lineKindKey(facts),facts.through.name].join('|')
  :[lineKindKey(facts),facts.through.name,facts.into.name,facts.intoFace,movedMarks(facts),pocketUpOrDown(facts)].join('|');
/* where moved screws sit on the piece they go through, from its nearest end and edges: joints with the same marks share a line */
function movedMarks(facts){
  if(!facts.f||!facts.f.moved)return'';
  const b=plainBox(facts.through),k=facts.joint.k;
  return'moved:'+facts.layout.map(f=>[0,1,2].filter(axis=>axis!==k).map(axis=>r16(Math.min(f.pos[axis]-b.lo[axis],b.hi[axis]-f.pos[axis]))).join('/')).sort().join(',');
}
/* the short screws of a bracket line, as the shopping list names them: '#8 × 1/2"' */
function bracketScrewWords(spec){
  const row=spec.hw.find(entry=>/screws for brackets/.test(entry[0]));
  return row?row[0].replace(/ screws for brackets$/,''):'#8 × 5/8"';
}
/* What to do about the head of a plugged screw (type 'plug', rule 12 in js/fasteners.js): sink it, and cover it. The
   finishing step (finText, js/style.js) says how the plugs are cut flush or the holes filled. */
function plugWords(f,drilled){
  const painted=FINISHES[look().finish][2]===2,deep=inchWords(f.sunk);
  // (drilled: the counterbores and the pilot holes are drilled in step 2, js/drillplan.js)
  const start=drilled?` These heads would show, so they sink into the 3/8" counterbores drilled in step 2, ${deep} deep.`
    :` These heads would show, so sink them: drill a 3/8" hole ${deep} deep for each one first (a counterbore), then drill the pilot hole in its middle and drive the screw.`;
  // deeper than a store plug is long (3/8"): a length of dowel rod fills the hole, under paint too
  if(plugIsDowel(f.sunk))return start+` A store-bought plug is only about 3/8" long and would sit deep in that hole, so cut a piece of 3/8" dowel rod ${inchWords(f.sunk+.25)} long for each hole, put a little glue in the hole and tap the dowel in until it bottoms. It sticks out 1/4" and is cut flush when you finish.`;
  return start+(painted?' Under paint the holes are filled with wood filler when you finish.'
      :' Put a little glue in each hole and tap in a 3/8" wooden plug, with its grain running the same way as the wood around it. It is cut flush when you finish.');
}
/* What covers a plugged head, as the pictures name it (the close-up labels it, the marking view's legend names
   the counterbore): {name, does: [two short lines]}. The same three cases as plugWords: a length of dowel in a deep
   hole, wood filler under paint, else a store-bought wooden plug. */
function plugCoverWords(f){
  const deep=inchWords(f.sunk),painted=FINISHES[look().finish][2]===2;
  if(plugIsDowel(f.sunk))return{name:'Dowel plug',does:['3/8" dowel glued in the counterbore',`(${deep} deep) over the head`]};
  if(painted)return{name:'Wood filler',does:['fills the 3/8" counterbore',`(${deep} deep) over the head`]};
  return{name:'Wooden plug',does:['glued in the 3/8" counterbore',`(${deep} deep) over the head`]};
}
/* One "Fasten with" line for these joints: {type, links, places, each, total, label, hardware, line, where, sample}. */
function fastenLine(links,letterOf){
  const all=links.map(linkFacts),one=all[0],type=one.link.type,spec=one.spec;
  const places=links.length,total=all.reduce((sum,facts)=>sum+facts.spec.n,0);
  const hardware=new Map();
  for(const facts of all)for(const[label,count]of facts.spec.hw)hardware.set(label,(hardware.get(label)||0)+count);
  const group={type,links,places,each:spec.n,total,label:spec.hw.length?oneOf(spec.hw[0][0]):'wood glue',hardware,sample:null,line:'',where:''};
  // the pairs of pieces these joints are between, the pair with the most joints first
  const pairs=new Map();
  for(const facts of all){
    const key=[facts.through.name,facts.into.name,facts.intoFace].join('|');
    if(!pairs.has(key))pairs.set(key,{throughs:[],intos:[],intoFace:facts.intoFace,places:0,first:facts});
    const pair=pairs.get(key);
    pair.throughs.push(facts.through);pair.intos.push(facts.into);pair.places++;
  }
  const byPlaces=[...pairs.values()].sort((a,b)=>b.places-a.places);
  // The joint the close-ups show. When the joints of the first pair are marked some from the front and some from
  // the back (the front and the back rail of a stand), one marked from the front: the words then name left and
  // right as a person in front of the design does, and so does the marking view.
  const seenFromBehind=facts=>!!facts.f&&facts.joint.k===2&&facts.f.dir[2]>0&&facts.f.kind!=='pocket'&&!facts.f.toe&&facts.f.kind!=='bracket';
  const firstPair=byPlaces[0];
  if(seenFromBehind(firstPair.first)){
    const fromFront=all.find(facts=>facts.f&&[facts.through.name,facts.into.name,facts.intoFace].join('|')===[firstPair.first.through.name,firstPair.first.into.name,firstPair.first.intoFace].join('|')&&!seenFromBehind(facts));
    if(fromFront)firstPair.first=fromFront;
  }
  const sample=byPlaces[0].first,f=sample.f;

  if(type==='glue'||!f){
    const said=byPlaces.map(pair=>namedLabel(pair.throughs,letterOf)===namedLabel(pair.intos,letterOf)?`one ${namedLabel(pair.throughs,letterOf)} and the next`:`the ${namedLabel(pair.throughs,letterOf)} and the ${namedLabel(pair.intos,letterOf)}`);
    group.line=`Wood glue on the whole joint between ${listWords(said)}. Keep it pressed together until the glue is dry (30 minutes at least): with clamps, or with the screws of this step where it has any.`+(places>1?` There are ${places} joints like this.`:'');
    return group;
  }
  const sameCount=all.every(facts=>facts.spec.n===spec.n);
  const here=fastenerPlaces(sample.joint,sample.layout);
  // (here: where the fasteners of the sample joint go; rule: what the words of the line measure from, set again
  //  below once the words of every joint are known. The marking view reads both.)
  group.sample={link:sample.link,layout:sample.layout,dims:here.dims,here,rule:here.rule||null};
  const leans=all.some(facts=>facts.f&&facts.f.lean),sunk=all.find(facts=>facts.f&&facts.f.sunk);
  // (the words on sinking and plugging the heads, kept apart so that a step says them once: fastenLines)
  if(sunk&&sunk.f.plug)group.plugText=plugWords(sunk.f);
  if(sunk)group.sunkFastener=sunk.f;   // (the fastener these words are written from: markPredrilled rewrites them, js/drillplan.js)
  const tail=()=>(leans?(all.every(facts=>facts.f.lean)?' Drive each nail at a slight slant, so that its point stays inside the wood.':' Where a nail driven straight would come out of the far side, drive it at a slight slant.'):'')+
    (sunk&&sunk.f.plug?plugWords(sunk.f):
      sunk?` Drill a hole ${inchWords(sunk.f.sunk)} deep for each head first (a counterbore), so the screw reaches far enough.`:'')+
    (all.some(facts=>facts.f&&facts.f.structural)?' Structural screws need no pilot hole: drive them with the bit that comes in the box, until the washer head is snug on the wood.':'')+
    // rule 13 in js/fasteners.js: holes high enough to be seen from below; or holes the preset plugs in this style
    // (pocketPluggedByPreset: the cabinet builder's shelves in Fine furniture), whatever their height
    (all.some(facts=>facts.layout.some(f=>f.pocket&&f.pocket.plugged))?
      (all.some(facts=>facts.layout.some(f=>f.pocket&&f.pocket.plugged&&f.pocket.mouth[1]>SEEN.underAbove&&f.pocket.out[1]<.5))?` These holes are more than ${SEEN.underAbove}" up, where they are seen from below, so once`:' So that no hole shows, once')+
      ' the screws are in, glue a pocket-hole plug into each one (sold in bags, in pine and oak), with its flat side lined up with the face, and sand it flush when the glue is dry.':'');
  /* the two pieces of a pair in words: with "the" for a sentence, without for a list */
  const pieceWords=(pair,inSentence)=>{
    const through=namedLabel(pair.throughs,letterOf),into=namedLabel(pair.intos,letterOf);
    const same=through===into,face=pair.intoFace==='face'?'':`the ${pair.intoFace} of `;   // two pieces of one name and size: "one Stud" and "the next"
    if(inSentence)return same?[`one ${through}`,`${face}the next`,'the next']:[`the ${through}`,`${face}the ${into}`,`the ${into}`];
    return same?[through,`${face}the next ${pair.intos[0].name}`]:[through,`${face}a ${into}`];
  };

  /* plywood nailed by spacing, and the long screws of a wall plate: one sentence whatever is behind */
  if(sample.how==='sheet'){
    const sheets=listWords([...new Set(all.map(facts=>facts.through.name))].map(name=>namedLabel(all.filter(facts=>facts.through.name===name).map(facts=>facts.through),letterOf)));
    const behind=[...new Set(byPlaces.map(pair=>pair.intos[0].name))];
    group.line=`${capital(fastenerPhrase(total,spec.hw[0][0]).replace(/^\d+ /,''))}, through the ${sheets} into ${behind.length>1?'every board behind it ('+listWords(behind)+')':'the '+namedLabel(byPlaces[0].intos,letterOf)}: `+
      `one every ${FRAMING.SHEET_EDGE}" along the edges of each sheet and every ${FRAMING.SHEET_FIELD}" in between (about ${total} in this step).`+tail();
    group.sample.dims=[];   // nailed by that rule, not at the places the picture happens to show: no size lines that would say otherwise
    group.sample.rule={sheet:true,edge:FRAMING.SHEET_EDGE,field:FRAMING.SHEET_FIELD};
    return group;
  }
  if(sample.how==='plate'){
    const plates=listWords([...new Set(all.map(facts=>facts.through.name))].map(name=>namedLabel(all.filter(facts=>facts.through.name===name).map(facts=>facts.through),letterOf)));
    const under=[...new Set(all.flatMap(facts=>(facts.f.also||[]).map(piece=>piece.name)))];
    group.line=`${capital(fastenerPhrase(total,spec.hw[0][0]))}, about every ${FRAMING.PLATE_SCREW_EVERY}", down through the ${plates} and the ${byPlaces[0].intos[0].name} into ${under.length?'the '+listWords(under)+' under it':'the framing under it'}. Put each one where a joist or a rim joist is under the plywood${all.some(facts=>facts.layout.some(f=>f.clearHead))?', and not under a stud: the wall stands on the plate before these go in, so move a screw that would land under one along the plate until it is clear':''}.`;
    group.sample.rule={plate:true};
    return group;
  }
  /* several pairs of pieces on one line (a step with many joints): the count, then each pair, through-piece first */
  if(byPlaces.length>1){
    const count=capital(fastenerPhrase(total,spec.hw[0][0]))+(f.kind==='brad'||f.kind==='dowel'?', and glue':'');
    const share=sameCount?`${spec.n} at each of ${places} places`:`spaced evenly along ${places} joints, more in a longer joint${here.gap?' (about '+inchWords(here.gap)+' apart)':''}`;
    const how=f.kind==='pocket'?'Each is driven from a pocket hole in the piece named first, into the piece named second'
      :f.kind==='dowel'?'Half of each goes in the piece named first, half in the piece named second'
      :f.kind==='bracket'?'Each holds the piece named first to the piece named second, with 4 short screws ('+bracketScrewWords(spec)+')'
      :f.toe?`Each is driven at an angle through the ${spec.drive?'side':faceSaid(sample.joint,f.through)==='face'?'edge':'end'} of the piece named first, into the piece named second`
      :'Each goes through the piece named first into the piece named second';
    const list=byPlaces.map(pair=>{
      const[through,into]=pieceWords(pair,false);
      return`${through} into ${into} (${pair.places} place${pair.places>1?'s':''})`;
    }).join('; ');
    group.line=`${count}: ${share}. ${how}: ${list}.`+tail();
    group.sample.rule={free:true,gap:null};   // the words give no marks for these: the marking view shows where they sit, with no sizes
    if(f.toe)group.where=`Start each one about an inch back from the joint and slant it toward the joint${angledFromWords(all)}.`;
    else if(f.kind!=='pocket'&&f.kind!=='bracket')group.where='Keep them at least 3/4" from the ends of each joint, so the wood does not split. The close-up shows one of these joints.';
    return group;
  }

  /* one pair of pieces */
  const[through,into,intoPlain]=pieceWords(byPlaces[0],true);
  const count=fastenerPhrase(sameCount?spec.n:total,spec.hw[0][0]);
  let atEach='';
  if(places>1&&sameCount)atEach=` Do this at each of the ${places} places (${total} in all).`;
  else if(places>1)atEach=` They go into ${places} joints of different lengths: more in a longer joint, ${here.gap?'about '+inchWords(here.gap)+' apart':'evenly spaced'}.`;
  let line;
  if(f.kind==='pocket'){
    // the holes face one way on every joint of the line, or the line only says "inside face"
    const oneWay=all.every(facts=>facts.f.pocket.out.every((v,k)=>Math.abs(v-f.pocket.out[k])<.01));
    line=`${capital(count)}, from pocket holes drilled in the ${faceWords(f.through,f.pocket.out,oneWay)} of ${through}, into ${into}.`+atEach;
  }else if(f.kind==='dowel'){
    line=`${capital(count)}, glued: half of each in ${through}, half in ${intoPlain}.`+atEach;
  }else if(f.kind==='bracket'){
    line=`${capital(count)}, ${f.flat?'flat across the seam between':'in the inside corner between'} ${through} and ${intoPlain}, each with 4 short screws (${bracketScrewWords(spec)}). Put the brackets on the hidden side, inside the corner.`+atEach;
  }else if(f.toe){
    line=`${capital(count)}, driven at an angle through the ${spec.drive?'side':faceSaid(sample.joint,f.through)==='face'?'edge':'end'} of ${through} into ${intoPlain}${sample.layout.length>1?angledFromWords(all):''}.`+atEach;
  }else{
    line=`${capital(count)}${f.kind==='brad'?', and glue':''}, through ${through} into ${into}.`+atEach;
  }
  group.line=line+tail();
  // Where they go: in numbers, always, measured on the piece that is marked (placesWords).
  const places_=all.map(facts=>facts===sample?here:fastenerPlaces(facts.joint,facts.layout));
  // (each place knows where it is on the piece that is marked, for a line whose places are marked differently)
  places_.forEach((place,index)=>{place.facts=all[index];});
  group.where=whereWords(places_,here,group);
  // screws that were set aside so that they pass the screws of another joint in the same corner: say so, or the
  // builder evens the marks out and drills into a screw
  const movedCount=all.filter(facts=>facts.f&&facts.f.moved).length;
  if(movedCount&&group.where){
    const single=group.each===1;
    group.where+=movedCount===all.length?(single?' This mark is not the usual one on purpose: other screws cross this corner inside the wood, and at this mark the screw passes them.'
      :' These marks are not the usual ones on purpose: other screws cross this corner inside the wood, and at these marks the two sets pass each other.')
      :' The places with other marks are that way on purpose: other screws cross those corners inside the wood, and at these marks the two sets pass each other.';
  }
  if(all.some(facts=>facts.layout.some(laid=>laid.nudged)))group.where+=' Where a mark lands on a screw that is already in the wood, move it up to 1" along the line (the 3D view shows these moved).';
  return group;
}
/* The "where" sentence of a line for all its joints. places: what fastenerPlaces gave for each joint; here: the
   one of the joint the close-up shows (its size lines are set to match the words). */
function whereWords(places,here,group){
  const SORTS_MAX=3;
  if(!here.spot){   // pocket holes, fasteners driven at an angle, brackets: each joint has its sentence already
    const texts=new Map();
    for(const place of places)texts.set(place.text,(texts.get(place.text)||0)+1);
    if(texts.size<=1)return here.text;
    // pocket holes of several joints in the same kind of piece: one row along each piece, and the marking view
    // measures the holes it shows along the piece too (running sizes from its start end), as the words do
    const rows=pocketRowsWords(places);
    if(rows){group.sample.rule={row:true,alongPiece:true};return rows;}
    // many boards that each cross the piece with the holes, every one held by holes laid out alike from its own
    // edges (the slats of a lower shelf on its stretchers): said once, from the edges of the board that crosses,
    // and the marking view measures one crossing the same way (crossingPocketWords)
    const crossing=crossingPocketWords(places);
    if(crossing){group.sample.rule={row:true,crossing:true};return crossing;}
    if(texts.size>SORTS_MAX){group.sample.rule={free:true,gap:null};return'';}
    // each sort said for the piece it is on when it is one piece ("On the back Long apron: ..."), so a beginner
    // knows which is which; else by count
    // (only when every sort is on one piece of its own, and no piece has two sorts)
    const pieceOf=new Map();
    for(const text of texts.keys()){
      const own=places.filter(place=>place.text===text);
      const pieces=[...new Set(own.map(place=>place.row&&place.row.through))];
      pieceOf.set(text,pieces.length===1&&pieces[0]?pieces[0]:null);
    }
    const byPiece=[...pieceOf.values()].every(piece=>piece)&&new Set(pieceOf.values()).size===pieceOf.size;
    const whose=(text,count)=>{
      if(!byPiece)return`At ${count} of them`;
      const piece=pieceOf.get(text);
      return`On ${whichOne(piece,S.parts.filter(other=>other.name===piece.name))}`;
    };
    return'The places of this line are not all alike. '+[...texts.entries()].map(([text,count])=>`${whose(text,count)}: ${text}`).join(' ');
  }
  const said=placesWords(places.map(place=>place.spot));
  if(said.text){
    group.sample.dims=said.fromJoint?here.spot.dimsJoint:here.spot.dimsMarked;
    group.sample.rule=said.rule;
    return said.text;
  }
  // The places of the line are not all laid out alike (boards of different widths crossing one rail, a corner
  // where one pair had to make room for another screw): they are sorted into the few sorts that are alike, and
  // each sort gets its sentence. The sort that the close-up shows comes first, and its rule is the one the
  // marking view draws.
  group.sample.dims=here.spot.dimsMarked;
  group.sample.rule={free:true,gap:here.spot.gap};
  const sorts=[{spots:[here.spot],places:[here]}];
  for(const place of places){
    if(place===here)continue;
    const fits=sorts.find(sort=>placesWords(sort.spots.concat(place.spot)).text);
    if(fits){fits.spots.push(place.spot);fits.places.push(place);}
    else sorts.push({spots:[place.spot],places:[place]});
  }
  // each sort said once, with the places it is for named on the piece that is marked ("at the back end of the
  // left Side rail"), so a builder knows which marks go where
  const named=sortsByPlace(sorts,group);
  if(named)return named;
  if(sorts.length<=SORTS_MAX){
    group.whereSorted=true;   // (sorts that do not say where they are: fastenLines keeps moved screws on lines of their own)
    group.sample.rule=placesWords(sorts[0].spots).rule||group.sample.rule;
    const sizes=new Set(sorts.map(sort=>sort.spots[0].long));
    return'The places of this line are not all alike. '+sorts.map((sort,index)=>{
      const which=sizes.size===sorts.length?`Where the two pieces touch over ${inchWords(sort.spots[0].long)} (${sort.spots.length} place${sort.spots.length>1?'s':''})`
        :sort.spots.length===1?`At ${index===0?'one of them (the one the close-up shows)':'another'}`
        :`At ${sort.spots.length} of them${index===0?' (the close-up shows one)':''}`;
      return`${which}: ${placesWords(sort.spots).text}`;
    }).join(' ');
  }
  const gap=here.spot.gap;
  group.whereGeneral=true;   // (no numbers for the marks: fastenLines then keeps moved screws on lines of their own)
  return`Spread them evenly along each place where the two pieces touch${gap?`, about ${inchWords(gap)} apart`:''}: the first and the last half that far from its ends, and never nearer than 3/4" to an end, so the wood does not split.`;
}
/* A line whose places are not all marked alike (the plugged screws at the four corners of a bed, each pair moved
   its own way to pass the screws that cross that corner): what is said of every place is said once, then each sort
   of marks with the places it is for, named on the piece that is marked: "At the back end of the left Side rail
   (the close-up shows this one): one 2 3/8" from ...". Places marked alike share a sentence ("At both ends of each
   Side rail"). Returns the words, or null when the places cannot be told apart by name (the caller then says it
   the older way). Sets group.sampleAt: the place the close-up shows, for its caption. */
const NAMED_SORTS_MAX=6;
function sortsByPlace(loose,group){
  // Places share a sort when one sentence gives the marks of all of them, measured from the matching end and edge
  // ("from the nearest end"), but not when it would leave the way round open: the sorts of whereWords also join
  // places that mirror each other ("either way round"), and once each sort says where it is, it says which way
  // round, so a builder never picks the way that runs into the screws crossing that corner. Places marked from the
  // back of their piece (left and right as seen from there) never share a sort with places marked from the front,
  // so a sort's name and its words see left and right the same way.
  const mirrored=spot=>!!(spot.frame&&spot.frame.mirrored);
  const sorts=[];
  for(const place of loose.flatMap(sort=>sort.places)){
    const fits=sorts.find(sort=>{
      if(!sort.spots.every(spot=>mirrored(spot)===mirrored(place.spot)))return false;
      const text=placesWords(sort.spots.concat(place.spot)).text;
      return!!text&&!/either way round/.test(text);
    });
    if(fits){fits.spots.push(place.spot);fits.places.push(place);}
    else sorts.push({spots:[place.spot],places:[place]});
  }
  // sorts whose words come out the same (marked from the front and from the back, with no left or right in the
  // words) are one sort
  for(let i=0;i<sorts.length;i++)for(let j=sorts.length-1;j>i;j--){
    if(placesWords(sorts[i].spots).text!==placesWords(sorts[j].spots).text)continue;
    sorts[i].spots.push(...sorts[j].spots);sorts[i].places.push(...sorts[j].places);
    sorts.splice(j,1);
  }
  if(sorts.length<2||sorts.length>NAMED_SORTS_MAX)return null;
  const names=sorts.map(sort=>placesNamed(sort.places));
  if(names.some(name=>!name)||new Set(names).size<names.length)return null;
  const texts=sorts.map(sort=>placesWords(sort.spots).text);
  if(texts.some(text=>!text))return null;
  // the words every sort starts with ("Mark them on the Side rail, on a slant so that ...: "), said once
  const colon=texts[0].indexOf(': ');
  let lead=colon>0?texts[0].slice(0,colon+2):'';
  if(lead&&texts.some(text=>!text.startsWith(lead)))lead='';
  group.sample.rule=placesWords(sorts[0].spots).rule||group.sample.rule;
  group.sampleAt=names[0];
  group.sampleOneOf=sorts[0].places.length>1;   // (the close-up shows one of several places of that name: its caption says so)
  group.sampleWords=texts[0];   // the words of the places the close-up shows, alone (the marking view is checked against them)
  const each=sorts.map((sort,index)=>`At ${names[index]}${index>0?'':sort.places.length>1?' (the close-up shows one of them)':' (the close-up shows this one)'}: ${texts[index].slice(lead.length)}`);
  return(lead?lead.slice(0,-2)+'. ':'')+'The marks are not the same at every place. '+each.join(' ');
}
/* The places of some joints in words, named on the piece each is marked on: 'the back end of the left Side rail',
   'both ends of each Side rail', 'the bottom ends of the 1st and 3rd Posts from the left', 'the middle of the
   Shelf'. An end is named as the words of its marks name it: from the back of a piece (a mirrored marking view)
   left and right are as a person behind it sees them, as the sentence after it says. null when a place does not
   know its joint, or when the places are too many to read as a list (NAMED_PIECES_MAX pieces of one sort). */
const NAMED_PIECES_MAX=8;
function placesNamed(places){
  const where=places.map(place=>{
    if(!place.facts||!place.spot)return null;
    const piece=place.spot.marked,axis=piece.ax[0],b=plainBox(piece),layout=place.facts.layout;
    const middle=layout.reduce((sum,f)=>sum+(f.pos0||f.pos)[axis],0)/layout.length;
    const share=(middle-b.lo[axis])/((b.hi[axis]-b.lo[axis])||1);
    const frame=place.spot.frame,nameOf=high=>frame&&frame.mirrored?frame.nameOf(axis,high):DIRECTION_ENDS[axis][high?1:0];
    return{piece,ends:[nameOf(false),nameOf(true)],end:share<.4?'low':share>.6?'high':'middle'};
  });
  if(where.some(one=>!one))return null;
  const byPiece=new Map();
  for(const one of where){
    if(!byPiece.has(one.piece.id))byPiece.set(one.piece.id,{piece:one.piece,names:one.ends,ends:new Set()});
    byPiece.get(one.piece.id).ends.add(one.end);
  }
  // 'the back end', 'both ends', 'the middle'; plural ('the back ends') for several pieces
  const endWords=(entry,many)=>{
    const ends=entry.ends,words=[],[low,high]=entry.names,s=many?'s':'';
    if(ends.has('low')&&ends.has('high'))words.push('both ends');
    else if(ends.has('low'))words.push(`the ${low} end${s}`);
    else if(ends.has('high'))words.push(`the ${high} end${s}`);
    if(ends.has('middle'))words.push(many?'the middles':'the middle');
    return listWords(words);
  };
  // pieces of one name with the same places: "each Side rail" when that is every piece of the name, else one list
  const alike=new Map();
  for(const entry of byPiece.values()){
    const key=entry.piece.name+'|'+endWords(entry,false);
    if(!alike.has(key))alike.set(key,[]);
    alike.get(key).push(entry);
  }
  const said=[];
  for(const list of alike.values()){
    if(list.length>NAMED_PIECES_MAX)return null;
    const name=list[0].piece.name,siblings=S.parts.filter(p=>p.name===name);
    if(list.length>1&&list.length===siblings.length){said.push(`${endWords(list[0],false)} of each ${name}`);continue;}
    const which=list.map(entry=>whichOne(entry.piece,siblings));
    // "the 1st Post from the left", "the 3rd Post from the left" -> "the 1st and 3rd Posts from the left"
    const parts=which.map(words=>words.match(new RegExp(`^the (\\S+) ${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}( from the \\w+)?$`)));
    if(list.length>1&&parts.every(part=>part&&part[2]===parts[0][2]))
      said.push(`${endWords(list[0],true)} of the ${listWords(parts.map(part=>part[1]))} ${pluralName(name)}${parts[0][2]||''}`);
    else list.forEach((entry,index)=>said.push(`${endWords(entry,false)} of ${which[index]}`));
  }
  return listWords(said);
}
/* Pocket holes of several joints drilled in the same kind of piece (a cross rail under several top boards, each
   board its own joint): the holes of each such piece as one row, measured from one end of it. When every piece
   of the line has the same row, one sentence gives it; otherwise null, and the line says it joint by joint. */
const ROW_PLACES_MAX=10;
function pocketRowsWords(places){
  if(!places.every(place=>place.row&&place.row.at))return null;   // (pocket holes only)
  // every place measured from the same end, as the marking views see their faces (or the places of one piece
  // would be measured from two ends and the words could give only one)
  // (or every row has the same places from both ends of its piece: "from either end")
  const one=places[0].row,eitherEnd=places.every(place=>place.row.bothEnds);
  if(!eitherEnd&&!places.every(place=>place.row.startEnd===one.startEnd&&place.row.side===one.side&&!!place.row.frame.mirrored===!!one.frame.mirrored))return null;
  const byPiece=new Map();
  for(const place of places){
    const id=place.row.through.id;
    if(!byPiece.has(id))byPiece.set(id,{row:place.row,at:[]});
    byPiece.get(id).at.push(...place.row.at);
  }
  const lists=[...byPiece.values()].map(entry=>({...entry,at:entry.at.slice().sort((a,b)=>a-b)}));
  const first=lists[0],same=lists.every(entry=>entry.row.axis===first.row.axis&&entry.at.length===first.at.length&&entry.at.every((v,i)=>Math.abs(v-first.at[i])<.07));
  if(!same||first.at.length>ROW_PLACES_MAX)return null;
  const name=first.row.through.name,each=lists.length>1?`each ${name}`:`the ${name}`;
  const clear=[...new Set(places.flatMap(place=>place.row.clear||[]))];
  const passEnds=[...new Set(places.flatMap(place=>place.row.passEnds||[]))];
  const pastBolt=places.some(place=>place.row.pastBolt);
  const why=clear.length||passEnds.length||pastBolt?' '+notEvenlyWords([{clear,passEnds,pastBolt}],name):'';
  const seen=first.row.frame.mirrored&&!eitherEnd?` Left and right are as you look at it ${first.row.frame.from}.`:'';
  return`Put the pocket holes in ${each} at ${listWords(first.at.map(inchWords))} from ${eitherEnd?'either':'its '+first.row.startEnd} ${first.row.side}.`+why+seen;
}
/* Pocket holes of many joints along one piece, where at each joint another board crosses that piece from edge to
   edge of the board (the slats of a lower shelf lying across its stretchers: 16 joints and 32 holes, too many to
   give as places along the stretcher). When the holes of every joint sit alike from the edges of the board that
   crosses there, measured from its edge nearer the end of the piece with the holes (so the joints at the two ends
   of a stretcher, mirror images, read the same), one sentence says it for all of them:
     'Where each Shelf slat crosses the Long stretcher: put one pocket hole 7/8" in from each edge of the Shelf slat
      (1 3/4" apart).'
   The marking view then draws one crossing, the board that crosses dashed behind, with its sizes from the edges of
   that board (rule.crossing in rowMarkPlan, js/markingview.js). Where the boards cross is for the step to say (the
   Coffee table's shelf step gives the place of every slat). null when the joints are not alike. */
function crossingPocketWords(places){
  if(places.length<2||!places.every(place=>place.row&&place.row.at&&place.facts&&place.facts.layout&&place.facts.layout.length))return null;
  const sorts=[];
  for(const place of places){
    const row=place.row,axis=row.axis,layout=place.facts.layout,through=layout[0].through,into=layout[0].into;
    if(!layout.every(f=>f.kind==='pocket'))return null;
    // the joint runs from one edge of the board that crosses to its other edge
    const intoBox=plainBox(into),throughBox=plainBox(through);
    if(Math.abs(row.range[0]-intoBox.lo[axis])>.07||Math.abs(row.range[1]-intoBox.hi[axis])>.07)return null;
    // measured from the edge of that board nearer an end of the piece with the holes
    const middle=(throughBox.lo[axis]+throughBox.hi[axis])/2,lowOuter=(row.range[0]+row.range[1])/2<middle;
    const from=lowOuter?row.range[0]:row.range[1];
    const spots=layout.map(f=>Math.round(Math.abs(f.pocket.mouth[axis]-from)*16)/16).sort((a,b)=>a-b);
    sorts.push({through:through.name,into:into.name,width:Math.round((row.range[1]-row.range[0])*16)/16,spots});
  }
  const one=sorts[0];
  const alike=sorts.every(sort=>sort.through===one.through&&sort.into===one.into&&sort.width===one.width&&
    sort.spots.length===one.spots.length&&sort.spots.every((v,index)=>Math.abs(v-one.spots[index])<.03));
  if(!alike)return null;
  const n=one.spots.length,far=one.spots.map(v=>Math.round((one.width-v)*16)/16);
  const lead=`Where each ${one.into} crosses the ${one.through}: put `;
  if(n===2&&Math.abs(one.spots[0]-far[1])<.03)
    return lead+`one pocket hole ${inchWords(one.spots[0])} in from each edge of the ${one.into} (${inchWords(one.spots[1]-one.spots[0])} apart).`;
  if(n===1&&Math.abs(one.spots[0]-far[0])<.03)
    return lead+`the pocket hole in the middle of the ${one.into} (${inchWords(one.spots[0])} from either edge).`;
  // otherwise every hole from the edge nearer the end of the piece, and from the other edge too, so the marking view
  // (which measures from both edges of the board) gives no number the words do not
  return lead+`the pocket hole${n>1?'s':''} ${listWords(one.spots.map(inchWords))} in from the edge of the ${one.into} nearer the end of the ${one.through}`+
    ` (${listWords(far.slice().reverse().map(inchWords))} from its other edge)`+(n>1?`, ${listWords(one.spots.slice(1).map((v,index)=>inchWords(v-one.spots[index])))} apart`:'')+'.';
}
/* Why a row of pocket holes is not evenly spaced (rules 10 and 11 in js/fasteners.js): a hole was moved off a piece
   that lies against the face, or past the pocket holes in the ends of the piece. */
function notEvenlyWords(layout,name){
  const clear=[...new Set(layout.flatMap(f=>f.clear||[]))],passEnds=[...new Set(layout.flatMap(f=>f.passEnds||[]))];
  const reasons=[];
  if(clear.length)reasons.push(`no hole may open where the ${listWords(clear)} lies against the ${name}`);
  if(passEnds.length)reasons.push(`the holes stay clear of the pocket holes in the ends of the ${name} that hold it to the ${listWords(passEnds)}`);
  if(layout.some(f=>f.pastBolt))reasons.push(`the holes stay clear of the bolt that goes through the ${name} to join the sections`);
  // only the start moved (past the holes at the ends) and the gaps are even: say that, not "not evenly spaced"
  const mouths=layout.filter(f=>f.pocket).map(f=>f.pocket.mouth);
  if(passEnds.length&&!clear.length&&mouths.length>2){
    const axis=[0,1,2].reduce((best,k)=>Math.max(...mouths.map(m=>m[k]))-Math.min(...mouths.map(m=>m[k]))>Math.max(...mouths.map(m=>m[best]))-Math.min(...mouths.map(m=>m[best]))?k:best,0);
    const at=mouths.map(m=>m[axis]).sort((a,b)=>a-b),gaps=at.slice(1).map((v,i)=>v-at[i]);
    if(gaps.every(gap=>Math.abs(gap-gaps[0])<1/32))return`They start further in on purpose, ${reasons[0].replace(/^the holes /,'so the holes ')}; the gaps between them are even (${inchWords(gaps[0])}).`;
  }
  return reasons.length?`They are not evenly spaced on purpose: ${reasons.join(', and ')}.`:'';
}
/* Screws moved out of each other's way (js/fasteners.js) start on lines of their own, one for each set of marks.
   Where those lines differ only by their marks, they are joined into one when the joined line can still give every
   mark in numbers and say which places each set of marks is for: it then says the fastener, and how to sink and
   plug its heads, once, and each set of marks with the places it is for (sortsByPlace), or one set for all. Four lines that differ only by a mark read as four near-copies (the
   plugged corners of the Platform bed). Lines whose joined words would lose the numbers (the posts of the Garage
   shelves, a frame at every height) stay apart. lists: the joints of each line; returns the new lists, in order. */
function joinMovedLines(lists,pairOnly,letterOf){
  const families=new Map();   // the key without the marks -> the lists that share it
  for(const list of lists){
    const key=pairOnly(linkFacts(list[0]));
    if(!families.has(key))families.set(key,[]);
    families.get(key).push(list);
  }
  const joined=[],done=new Set();
  for(const list of lists){
    const family=families.get(pairOnly(linkFacts(list[0])));
    if(done.has(family))continue;
    done.add(family);
    if(family.length<2){joined.push(list);continue;}
    const all=family.flat(),trial=fastenLine(all,letterOf);
    if(trial.where&&!trial.whereGeneral&&!trial.whereSorted)joined.push(all);
    else joined.push(...family);
  }
  return joined;
}
/* The joints of one step, sorted into lines: joints between the same two kinds of piece share a line; when that
   leaves too many lines, every kind of fastener gets one line that lists its pairs of pieces. */
function fastenLines(links,letterOf){
  const sortBy=key=>{
    const lists=new Map();
    for(const link of links){
      const value=key(linkFacts(link));
      if(!lists.has(value))lists.set(value,[]);
      lists.get(value).push(link);
    }
    return[...lists.values()];
  };
  // (when screws that were moved out of each other's way make too many lines, they share the line of their pair
  //  again, and that line says how each sort is marked)
  // (the marks are one part of the key, not always the last: the face of pocket holes comes after them)
  const pairOnly=facts=>linePairKey(facts).replace(/\|moved:[^|]*/,'|');
  let lists=joinMovedLines(sortBy(linePairKey),pairOnly,letterOf);
  if(lists.length>LINES_MAX)lists=sortBy(pairOnly);
  if(lists.length>LINES_MAX)lists=sortBy(lineKindKey);
  const lines=lists.map((list,index)=>Object.assign(fastenLine(list,letterOf),{no:index+1}));
  // how to sink and plug the heads is said once in a step: a later line with the same words refers to it
  const plugSaid=new Map();   // the words -> the number of the line that says them
  for(const line of lines){
    if(!line.plugText)continue;
    if(!plugSaid.has(line.plugText)){plugSaid.set(line.plugText,line.no);continue;}
    line.line=line.line.replace(line.plugText,` Sink and plug these heads as line ${plugSaid.get(line.plugText)} says.`);
  }
  return lines;
}

/* ---------- hardware that is placed in the design ---------- */
/* the words a preset step uses when it talks about a kind of hardware */
const HARDWARE_STEP_WORDS={butt:/hinge/i,strap:/hinge/i,cup:/hinge/i,piano:/hinge/i,slide:/slide/i,runner:/runner/i,kicker:/kicker/i,
  pull:/pull|handle/i,knob:/knob|pull/i,catch:/catch/i,hasp:/latch|hasp|bolt/i,stay:/stay|lid support/i,caster:/caster/i,foot:/leveling f/i,pin:/shelf pin/i};
const SLIDE_BODY=1.75;   // how tall the usual side-mount drawer slide is; used for the height of a spacer block
/* which of several pieces with one name this is: 'the left Door', 'the 2nd Drawer side from the bottom' */
function whichOne(piece,siblings){
  if(siblings.length<2)return'the '+piece.name;
  const centers=siblings.map(p=>{const b=box(p);return b.lo.map((v,k)=>(v+b.hi[k])/2);});
  const spread=[0,1,2].map(k=>Math.max(...centers.map(c=>c[k]))-Math.min(...centers.map(c=>c[k])));
  const axis=spread.indexOf(Math.max(...spread));
  const order=siblings.slice().sort((a,b)=>centers[siblings.indexOf(a)][axis]-centers[siblings.indexOf(b)][axis]);
  const place=order.indexOf(piece);
  if(siblings.length===2)return`the ${DIRECTION_ENDS[axis][place]} ${piece.name}`;
  const nth=n=>n+1+(['st','nd','rd'][n]&&(n<3)?['st','nd','rd'][n]:'th');
  return`the ${nth(place)} ${piece.name} from the ${DIRECTION_ENDS[axis][0]}`;
}
/* where one piece of hardware sits on the piece it is mounted on, measured along the two directions of the face
   it is on: {along, cross}, each {axis, centered} or {axis, side (0 low, 1 high), distance} */
function hardwareSpot(item,host){
  const half=size(host).map(v=>v/2),at=item.at;
  const biggest=(vector,among)=>among.reduce((best,k)=>Math.abs(vector[k])>Math.abs(vector[best])?k:best);
  const faceAxis=biggest(item.n,[0,1,2]);
  const alongAxis=biggest(item.u,[0,1,2].filter(k=>k!==faceAxis));
  const crossAxis=[0,1,2].find(k=>k!==faceAxis&&k!==alongAxis);
  const measure=axis=>{
    const low=at[axis]+half[axis],high=half[axis]-at[axis];
    if(Math.abs(low-high)<.13)return{axis,centered:true};
    return low<high?{axis,side:0,distance:low}:{axis,side:1,distance:high};
  };
  return{along:measure(alongAxis),cross:measure(crossAxis)};
}
/* one host's hardware of one kind in words: 'along its left edge, 3" from its top end and 3" from its bottom end' */
function hardwareSpotWords(items,host){
  const spots=items.map(item=>hardwareSpot(item,host));
  const sideOf=m=>`${DIRECTION_ENDS[m.axis][m.side]} ${host.ax[0]===m.axis?'end':'edge'}`;
  const middleOf=axis=>axis===1?'halfway up':axis===0?'halfway across':'halfway from back to front';
  const cross=spots[0].cross;
  const crossSaid=cross.centered?middleOf(cross.axis):cross.distance<.13?`along its ${sideOf(cross)}`:`${inchWords(cross.distance)} in from its ${sideOf(cross)}`;
  // two or more each get their own place ("one 3" from its left end, the other 3" from its right end"), so that two
  // places measured from opposite ends never read as one place
  const places=spots.map(spot=>spot.along.centered?middleOf(spot.along.axis):`${inchWords(spot.along.distance)} from its ${sideOf(spot.along)}`);
  const alongSaid=new Set(places).size===1?places[0]:places.length===2?`one ${places[0]}, the other ${places[1]}`:listWords(places.map(place=>'one '+place));
  return`${crossSaid}, ${alongSaid}`;
}
/* The hardware lines of one step: one line for each kind of hardware on each kind of piece.
   stripLetterOf(item): the cut-list letter of a strip of wood that is placed as hardware (a runner, a kicker). */
function hardwareLines(items,letterOf,stripLetterOf){
  const lines=[],groups=new Map();
  for(const item of items){
    const host=byId(item.on),other=item.to!=null?byId(item.to):null;
    if(!host||!HARDWARE[item.kind])continue;
    const key=[item.kind,item.size,host.name,letterOf(host),other?other.name:''].join('|');
    if(!groups.has(key))groups.set(key,{kind:item.kind,items:[],other});
    groups.get(key).items.push(item);
  }
  for(const group of groups.values()){
    const kind=HARDWARE[group.kind],list=group.items,shortName=kind.name.toLowerCase().replace(/ \(.*|,.*/g,'');
    const hosts=[...new Set(list.map(item=>item.on))].map(byId);
    const alike=S.parts.filter(p=>p.name===hosts[0].name&&letterOf(p)===letterOf(hosts[0]));
    // each kind that needs more than "where its middle is" writes its own line
    let line='';
    if(kind.motion==='slide'&&group.other)line=slideLine(group,hosts,letterOf,stripLetterOf);
    else if(group.kind==='kicker')line=kickerLine(group,hosts,letterOf,stripLetterOf);
    else if(group.kind==='cup'&&group.other)line=cupHingeLine(group,hosts,alike,letterOf);
    else if(group.kind==='pull')line=pullLine(group,hosts,alike,letterOf);
    else if(kind.line)line=kind.line(group,hosts,letterOf);   // a kind that writes its own line (HARDWARE[kind].line)
    if(!line){
      const each=list.length/hosts.length;
      const head=capital(hardwareWords(list))+(kind.sizes.length>1?', '+sizeLabel(list[0]):'');
      const onWhat=hosts.length===1?`on ${whichOne(hosts[0],alike)}${letterOf(hosts[0])?` (${letterOf(hosts[0])})`:''}`
        :`${Number.isInteger(each)?countWord(each)+' on each of the ':'on the '}${hosts.length} ${pluralName(hosts[0].name)}${letterOf(hosts[0])?` (${letterOf(hosts[0])})`:''}`;
      // hosts whose hardware sits the same way share the words; otherwise each host is named ("the left Door")
      const said=new Map();
      for(const host of hosts){
        const words=hardwareSpotWords(list.filter(item=>item.on===host.id),host);
        if(!said.has(words))said.set(words,[]);
        said.get(words).push(host);
      }
      const measured=`(measured to the middle of the ${shortName})`;
      let where;
      if(said.size===1)where=`${list.length===1?'It sits':each===1?'Each one sits':'They sit'} ${[...said.keys()][0]} ${measured}.`;
      else where=[...said.entries()].map(([words,group])=>`${capital(listWords(group.map(host=>whichOne(host,alike))))}: ${words}.`).join(' ')+` Each is ${measured.slice(1,-1)}.`;
      if(group.other)where+=` The other half of ${list.length>1?'each':'it'} is screwed to the ${pieceLabel(group.other,letterOf)}.`;
      line=`${head}, ${onWhat}. ${where} Screws: ${kind.screws}.`;
    }
    lines.push({items:list,kind:group.kind,line});
  }
  return lines;
}
/* 'the bottom drawer', 'the top drawer', 'the 2nd drawer from the bottom': drawers are told apart by where they
   are, because that is what a person sees (index counts from the bottom, 0 first) */
function drawerPlaceName(index,count){
  if(count===1)return'the drawer';
  if(index===0)return'the bottom drawer';
  if(index===count-1)return'the top drawer';
  return`the ${index+1}${['st','nd','rd'][index]||'th'} drawer from the bottom`;
}
/* The level panel a height inside a cabinet is measured from: the highest shelf or bottom that touches this cabinet
   side and lies under that height. {piece, top} or null (then heights are measured from the bottom end of the side). */
function panelUnder(side,height,skip){
  let under=null;
  for(const link of connectionsOf(side.id)){
    const p=link.a===side?link.b:link.a;
    if((skip&&skip.has(p.id))||isProp(p)||tilted(p)||p.ax[2]!==1)continue;
    const top=p.pos[1]+size(p)[1];
    if(top<=height+.01&&(!under||top>under.top))under={piece:p,top};
  }
  return under;
}
/* every piece that rides on a door or a drawer: never something to measure a cabinet height from */
function ridingPieces(){
  const riding=new Set();
  for(const mover of movers())for(const id of mover.riders)riding.add(id);
  return riding;
}
/* heights in words, each with its drawer: '3/4" above the top of the Shelf for the bottom drawer and 7 7/8" for the top drawer' */
function heightsSaid(rows,amountOf,baseName){
  if(rows.length===1)return`${inchWords(amountOf(rows[0]))} above ${baseName}`;
  return listWords(rows.map((row,index)=>`${inchWords(amountOf(row))}${index===0?' above '+baseName:''} for ${row.place}`));
}
/* A pair of drawer slides, or of wooden runners, for each drawer: which piece each half goes on, the height of
   each on the cabinet side, the set-back, the spacer block. Runners are strips of wood from the cut list. */
function slideLine(group,hosts,letterOf,stripLetterOf){
  const kind=HARDWARE[group.kind],runner=group.kind==='runner',riding=ridingPieces();
  const rows=[],seen=new Set();
  for(const host of hosts){
    const facts=drawerFacts(host.id),mover=moverOf(host.id);
    if(!facts||!mover||seen.has(mover))continue;
    seen.add(mover);
    const side=byId(mover.items[0].to);
    rows.push({height:facts.slideHeight,under:panelUnder(side,facts.slideHeight-(runner?DRAWER.runnerStrip:.5),riding),facts,side});
  }
  if(!rows.length)return'';
  rows.sort((a,b)=>a.height-b.height);
  rows.forEach((row,index)=>{row.place=drawerPlaceName(index,rows.length);});
  const first=rows[0],cabinetSide=pieceLabel(first.side,letterOf),drawerSide=pieceLabel(hosts[0],letterOf);
  const count=group.items.length,pairs=count/2,long=sizeLabel(group.items[0]);
  // heights are measured up from the panel under the drawers when there is one, else from the bottom end of the side
  const sameBase=rows.every(row=>(row.under?row.under.piece:null)===(first.under?first.under.piece:null));
  const baseOf=row=>sameBase?(first.under?first.under.top:plainBox(first.side).lo[1]):plainBox(row.side).lo[1];
  const baseName=sameBase&&first.under?`the top of the ${first.under.piece.name}`:`the bottom end of the ${first.side.name}`;
  const up=row=>row.height-baseOf(row);
  const setBack=first.facts.slideFromEdge>0?`${inchWords(first.facts.slideFromEdge)} back from the front edge of the ${first.side.name}`:`flush with the front edge of the ${first.side.name}`;
  if(runner){
    const letter=stripLetterOf?stripLetterOf(group.items[0]):'';
    const lying=sameBase&&first.under&&Math.abs(up(first)-DRAWER.runnerStrip)<.02?` The lowest pair lies on the ${first.under.piece.name}.`:'';
    return`${count} wooden runners${letter?` (${letter})`:''}, ${long} long: ${rows.length>1?`${countWord(rows.length)} on the inside face of each cabinet ${cabinetSide}, one under each drawer`:`one on the inside face of each cabinet ${cabinetSide}, under the drawer`}. `+
      `They are fixed to the cabinet, not to the drawers. Glue and screw each one on, level, with its front end ${setBack} and its top edge ${heightsSaid(rows,up,baseName)}.${lying} `+
      `The bottom of each drawer box slides on a pair of them. Screws: ${kind.screws}, through the runner into the ${first.side.name}.`;
  }
  const blocks=listWords(rows.map(row=>inchWords(Math.max(0,up(row)-SLIDE_BODY/2))+(rows.length>1?` for ${row.place}`:'')));
  const boxFront=first.facts.slideFromBoxFront>0?`${inchWords(first.facts.slideFromBoxFront)} back from the front of the drawer box`:'flush with the front of the drawer box';
  return`${pairs===1?'1 pair of drawer slides (2 slides)':`${pairs} pairs of drawer slides (${count} slides)`}, ${long} long: a pair for each drawer. Each slide pulls apart into a cabinet half and a drawer half. `+
    `Cabinet halves: screw one to the inside face of each cabinet ${cabinetSide} for each drawer, level, with its front end ${setBack} and its middle (its row of screw holes) ${heightsSaid(rows,up,baseName)}. `+
    `A spacer block gets the left and the right slide to the same height: cut a scrap of wood, stand it ${sameBase&&first.under?'on the '+first.under.piece.name:'beside the bottom end of the side'} against the ${first.side.name} and rest the slide on it while you screw. `+
    `For the usual slide, ${inchWords(SLIDE_BODY)} tall, the block is this long: ${blocks}. Measure your own slides first. `+
    `Drawer halves: screw one along the middle of the outside face of each ${drawerSide}, level, with its front end ${boxFront}. Screws: ${kind.screws}.`;
}
/* Kickers: the strip above a drawer that rides on wooden runners. Its underside is what matters (the drawer runs
   under it), so that is the face the height is given to, above the panel under the drawers and down from the
   top end of the cabinet side. */
function kickerLine(group,hosts,letterOf,stripLetterOf){
  const riding=ridingPieces(),rows=[];
  for(const item of group.items){
    const side=byId(item.on),pose=hardwarePose(item);
    if(!side||!pose)continue;
    const underside=pose.at.y-(item.geo&&item.geo.mid?DRAWER.runnerStrip/2:0);
    const travel=[0,2].find(k=>Math.abs(pose.u.getComponent(k))>.5),sideBox=plainBox(side);
    // the front end of the strip: the end nearer the front edge of the cabinet side that the drawer comes out of
    const drawerSide=item.geo&&item.geo.for!=null?byId(item.geo.for):null,mover=drawerSide?moverOf(drawerSide.id):null;
    const outward=mover?(mover.axis.getComponent(travel)>0?1:-1):1;
    const frontEnd=pose.at.getComponent(travel)+outward*item.size/2;
    const setBack=((outward>0?sideBox.hi[travel]:sideBox.lo[travel])-frontEnd)*outward;
    rows.push({item,side,underside,setBack,mover,under:panelUnder(side,underside-.5,riding),fromTop:sideBox.hi[1]-underside});
  }
  if(!rows.length)return'';
  // one height for each drawer that has kickers, bottom drawer first
  const levels=[...new Set(rows.map(row=>r16(row.underside)))].sort((a,b)=>a-b);
  const drawers=movers().filter(mover=>mover.kind==='slide').sort((a,b)=>pieceMiddle(a.lead).y-pieceMiddle(b.lead).y);
  const first=rows[0],cabinetSide=pieceLabel(first.side,letterOf),letter=stripLetterOf?stripLetterOf(first.item):'';
  const base=first.under?first.under.top:plainBox(first.side).lo[1];
  const baseName=first.under?`the top of the ${first.under.piece.name}`:`the bottom end of the ${first.side.name}`;
  const perLevel=levels.map(level=>{
    const row=rows.find(candidate=>r16(candidate.underside)===level);
    const place=row.mover&&drawers.includes(row.mover)?drawerPlaceName(drawers.indexOf(row.mover),drawers.length):'the drawer under it';
    return{place,up:level-base,fromTop:row.fromTop};
  });
  const heights=perLevel.length===1?`${inchWords(perLevel[0].up)} above ${baseName} (that is ${inchWords(perLevel[0].fromTop)} down from the top end of the ${first.side.name})`
    :listWords(perLevel.map((level,index)=>`${inchWords(level.up)}${index===0?' above '+baseName:''} for the pair above ${level.place}`));
  const setBack=first.setBack>.03?`${inchWords(first.setBack)} back from the front edge of the ${first.side.name}`:`flush with the front edge of the ${first.side.name}`;
  return`${rows.length} kickers${letter?` (${letter})`:''}, ${sizeLabel(first.item)} long, the same strips as the runners: ${perLevel.length===1?`one on the inside face of each cabinet ${cabinetSide}, above ${perLevel[0].place}`:`on the inside face of each cabinet ${cabinetSide}, one above each drawer that has no runner or rail right over it`}. `+
    `Glue and screw each one on, level, with its front end ${setBack} and its UNDERSIDE ${heights}. Measure to the underside, not to the middle of the strip: the side of the drawer runs ${inchWords(DRAWER.runnerAbove)} under it. `+
    `Screws: ${HARDWARE.kicker.screws}, through the kicker into the ${first.side.name}.`;
}
/* Concealed cup hinges: the hole for the cup is what a beginner has never drilled, so its size, depth and place
   are given as numbers, on the face it is drilled in. */
const CUP_HOLE={wide:1.375,deep:.5,fromEdge:.875,plateBack:1.5};   // inches: the usual full-overlay cup hinge (35 mm cup; the plate's screw line is 37 mm back)
function cupHingeLine(group,hosts,alike,letterOf){
  const list=group.items,each=list.length/hosts.length;
  const said=new Map();   // the words for one door -> the doors they are true for
  for(const host of hosts){
    const own=list.filter(item=>item.on===host.id),spots=own.map(item=>hardwareSpot(item,host));
    const cross=spots[0].cross,along=spots.map(spot=>spot.along);
    const edge=`${DIRECTION_ENDS[cross.axis][cross.side||0]} ${host.ax[0]===cross.axis?'end':'edge'}`;
    const ends=listWords(along.map(m=>m.centered?'halfway along it':`${inchWords(m.distance)} from its ${DIRECTION_ENDS[m.axis][m.side]} ${host.ax[0]===m.axis?'end':'edge'}`));
    const words=`hinged on its ${edge}; the middle of each hole is ${inchWords(CUP_HOLE.fromEdge)} in from that edge, ${ends}`;
    if(!said.has(words))said.set(words,[]);
    said.get(words).push(host);
  }
  const doorThick=Math.min(...hosts.map(host=>host.t)),deep=Math.min(CUP_HOLE.deep,doorThick-.125);
  const doors=`${hosts.length>1?`the ${hosts.length} ${pluralName(hosts[0].name)}`:`the ${hosts[0].name}`}${letterOf(hosts[0])?` (${letterOf(hosts[0])})`:''}`;
  const where=said.size===1?`${hosts.length>1?'Each door is':'It is'} ${[...said.keys()][0]}.`
    :[...said.entries()].map(([words,doorsLikeThis])=>`${capital(listWords(doorsLikeThis.map(host=>whichOne(host,alike))))}: ${words}.`).join(' ');
  return`${capital(hardwareWords(list))}${Number.isInteger(each)&&hosts.length>1?`, ${countWord(each)} on each of ${doors}`:`, on ${doors}`}. `+
    `The round cup of each hinge sits in a hole in the BACK face of the door: ${inchWords(CUP_HOLE.wide)} wide and ${inchWords(deep)} deep, drilled with a ${inchWords(CUP_HOLE.wide)} Forstner bit. Do not drill through: stop ${inchWords(deep)} down. `+
    `${where} Left and right are as you look at the front of the closed door. `+
    `Press the cup into its hole, square to the edge, and drive its 2 small screws. Then hold the door in place and screw the plate of each hinge to the inside face of the ${pieceLabel(group.other,letterOf)}, at the height of its cup, with its screw holes about ${inchWords(CUP_HOLE.plateBack)} back from the front edge (the sheet in the package gives the exact distance for your hinges). `+
    `Screws: ${HARDWARE.cup.screws}.`;
}
/* Pull handles: two holes, each given from an end and an edge of the piece that is drilled, and how much wood the
   screws must pass through (a drawer front has the front of the drawer box behind it). */
function pullLine(group,hosts,alike,letterOf){
  const list=group.items,said=new Map();
  const biggest=(vector,among)=>among.reduce((best,k)=>Math.abs(vector[k])>Math.abs(vector[best])?k:best);
  let through=0;
  for(const host of hosts){
    const item=list.find(candidate=>candidate.on===host.id),half=size(host).map(v=>v/2),box=plainBox(host);
    const faceAxis=biggest(item.n,[0,1,2]),alongAxis=biggest(item.u,[0,1,2].filter(k=>k!==faceAxis)),crossAxis=[0,1,2].find(k=>k!==faceAxis&&k!==alongAxis);
    // across the pull: from the nearer edge; a pull at the middle is given from the top (or the left) all the same
    const low=item.at[crossAxis]+half[crossAxis],high=half[crossAxis]-item.at[crossAxis];
    const fromHigh=crossAxis===1?high<=low+.13:high<low-.13;
    const crossWords=`${inchWords(fromHigh?high:low)} ${crossAxis===1?(fromHigh?'down from':'up from'):'in from'} its ${DIRECTION_ENDS[crossAxis][fromHigh?1:0]} ${host.ax[0]===crossAxis?'end':'edge'}`+(Math.abs(low-high)<.13?' (the middle)':'');
    // along the pull: the two holes, from the low end
    const fromLowEnd=item.at[alongAxis]+half[alongAxis],fromHighEnd=half[alongAxis]-item.at[alongAxis];
    const nearHighEnd=alongAxis===1?fromHighEnd<=fromLowEnd+.13:fromHighEnd<fromLowEnd-.13;   // from the top, or from the nearer end
    const middle=nearHighEnd?fromHighEnd:fromLowEnd,holes=[middle-item.size/2,middle+item.size/2];
    const alongWords=`${listWords(holes.map(inchWords))} from its ${DIRECTION_ENDS[alongAxis][nearHighEnd?1:0]} ${host.ax[0]===alongAxis?'end':'edge'}`;
    const upright=alongAxis===1;
    const words=`on ${upright?'an upright':'a level'} line ${crossWords}, ${alongWords}`;
    if(!said.has(words))said.set(words,[]);
    said.get(words).push(host);
    // what the screws pass through: this piece, and a piece fastened flat against the back of it at that spot
    const spot=box.lo.map((v,k)=>(v+box.hi[k])/2+item.at[k]);
    let wood=size(host)[faceAxis];
    const back=item.n[faceAxis]>0?box.lo[faceAxis]:box.hi[faceAxis];
    for(const link of connectionsOf(host.id)){
      const other=link.a===host?link.b:link.a;
      if(!link.joint||!link.fastened||tilted(other))continue;
      const b=plainBox(other);
      const behind=Math.abs((item.n[faceAxis]>0?b.hi[faceAxis]:b.lo[faceAxis])-back)<.03;
      if(behind&&[0,1,2].every(k=>k===faceAxis||(spot[k]>=b.lo[k]&&spot[k]<=b.hi[k])))wood+=size(other)[faceAxis];
    }
    through=Math.max(through,wood);
  }
  const what=`${hosts.length>1?`one on each of the ${hosts.length} ${pluralName(hosts[0].name)}`:`on the ${hosts[0].name}`}${letterOf(hosts[0])?` (${letterOf(hosts[0])})`:''}`;
  const where=said.size===1?`Drill two 3/16" holes ${[...said.keys()][0]}.`
    :'Drill two 3/16" holes. '+[...said.entries()].map(([words,group])=>`${capital(listWords(group.map(host=>whichOne(host,alike))))}: ${words}.`).join(' ');
  const hostThick=Math.min(...hosts.map(host=>host.t));
  const screws=through>hostThick+.01
    ?`The screws pass through ${inchWords(through)} of wood here (the ${hosts[0].name} and the piece behind it), so use screws about ${inchWords(drawerPullScrewLength(through))} long: the short ones in the package will not reach.`
    :`The screws pass through ${inchWords(through)} of wood: the ones in the package (about 1" long) fit.`;
  return`${capital(hardwareWords(list))}, ${sizeLabel(list[0])} between holes, ${what}. ${where} The holes are ${sizeLabel(list[0])} apart. Mark them with a square so the pull sits straight, drill from the front with a scrap held behind so the back does not splinter, and screw the pull on from the back. ${screws}`;
}

/* ---------- where each sheet of a wall goes ----------
   A step that nails many sheets of plywood onto upright walls (the sheathing of a shed: thirteen sheets in nine
   sizes) says, wall by wall, which lettered sheet goes where, as seen from outside and from left to right, row by
   row from the bottom. Returns '' for any other step. */
const SHEET_LAYOUT_FROM=8;   // sheets in one step before the step lists where each one goes (a box with one panel a side needs no list)
function sheetLayoutWords(pieces,letterOf){
  const sheets=pieces.filter(p=>!isProp(p)&&!tilted(p)&&M[p.mat].kind==='sheet'&&p.ax[2]!==1&&letterOf(p));
  if(sheets.length<SHEET_LAYOUT_FROM||sheets.length!==pieces.filter(p=>!isProp(p)).length)return'';
  const middle=designMiddle(),walls=new Map();
  for(const sheet of sheets){
    const b=plainBox(sheet),k=sheet.ax[2],out=(b.lo[k]+b.hi[k])/2>middle[k]?1:-1;
    const key=k+'|'+out;
    if(!walls.has(key))walls.set(key,{k,out,sheets:[]});
    walls.get(key).sheets.push(sheet);
  }
  const said=[];
  // the walls in the order a person walks round: front, right, back, left
  const order=['2|1','0|1','2|-1','0|-1'];
  for(const key of order){
    const wall=walls.get(key);
    if(!wall)continue;
    // seen from outside, the right hand points along (looking direction) x (up): front +x, right -z, back -x, left +z
    const along=wall.k===2?0:2,rightward=wall.k===2?wall.out:-wall.out;
    const rows=new Map();
    for(const sheet of wall.sheets){
      const bottom=Math.round(plainBox(sheet).lo[1]);
      if(!rows.has(bottom))rows.set(bottom,[]);
      rows.get(bottom).push(sheet);
    }
    const rowWords=[...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([,row])=>row
      .sort((a,b)=>(plainBox(a).lo[along]-plainBox(b).lo[along])*rightward).map(letterOf).join(', '));
    const name=`${DIRECTION_ENDS[wall.k][wall.out>0?1:0]} wall`;
    said.push(`${capital(name)}: ${rowWords.length>1?rowWords.map((words,index)=>`${index?'higher up':'bottom row'} ${words}`).join('; '):rowWords[0]}.`);
  }
  if(!said.length)return'';
  return`Where each sheet goes, by its cut-list letter, seen from outside and from left to right: ${said.join(' ')}`;
}

/* ---------- room for the drill behind a pocket hole ----------
   A pocket screw is driven along its own line, from behind the hole: the drill and the long square bit that comes
   with a pocket-hole jig (about 6") need about 13" of room there. Inside a closed box or a narrow case there is
   less: the room is measured from where the hole opens, back along the screw, to the first piece that is already
   in place when the step drives it. Below DRIVER_ROOM.usual the step says so and names the tool that fits (a 3"
   driver bit in a right-angle drill attachment, which needs about 4"); below DRIVER_ROOM.least nothing fits, and
   the self-check pocketHolesHaveRoomForTheDrill fails. */
const DRIVER_ROOM={usual:13,least:4,look:60};
/* how far a ray from `from` along `way` (a unit vector) travels before it enters the box, or Infinity */
function rayDistanceToBox(from,way,b){
  let near=0,far=Infinity;
  for(let k=0;k<3;k++){
    if(Math.abs(way[k])<1e-9){
      if(from[k]<b.lo[k]||from[k]>b.hi[k])return Infinity;
      continue;
    }
    let t1=(b.lo[k]-from[k])/way[k],t2=(b.hi[k]-from[k])/way[k];
    if(t1>t2)[t1,t2]=[t2,t1];
    near=Math.max(near,t1);far=Math.min(far,t2);
    if(near>far)return Infinity;
  }
  return far>0?near:Infinity;
}
/* The room behind one pocket hole, with the pieces in `present` (a Set of ids) in place. `later`: pieces of the
   same step that are not one of the two the screw joins; the step's words put those in after this screw (the legs
   of a bed after the screws from the end rail into the side rail), so they are not in the way. A step whose
   pieces cannot be fastened in such an order is split in two (the toy chest's front, then its back). */
function driverRoom(f,present,later){
  if(f.kind!=='pocket'||!f.pocket)return Infinity;
  const length=Math.hypot(...f.dir)||1,back=f.dir.map(v=>-v/length);
  const from=pointPlus(f.pocket.mouth,back,.05);
  let room=Infinity;
  for(const piece of S.parts){
    if(piece===f.through||piece===f.into||!present.has(piece.id)||(later&&later.has(piece.id))||isProp(piece)||tilted(piece))continue;
    room=Math.min(room,rayDistanceToBox(from,back,plainBox(piece)));
  }
  return room>DRIVER_ROOM.look?Infinity:room;
}
/* The "Fasten with" lines of a step whose pocket holes have less room than the usual drill and bit need:
   [{group, room, through, into}] with the least room of each line. */
function tightPockets(groups,present,stepPieces){
  const tight=[];
  for(const group of groups){
    if(group.type!=='pocket')continue;
    let least=Infinity,sample=null;
    for(const link of group.links)for(const f of fastenersOfLink(link)){
      const later=new Set((stepPieces||[]).filter(p=>p!==f.through&&p!==f.into).map(p=>p.id));
      const room=driverRoom(f,present,later);
      if(room<least){least=room;sample=f;}
    }
    if(least<DRIVER_ROOM.usual)tight.push({group,room:least,through:sample.through,into:sample.into});
  }
  return tight;
}
/* the sentence a step gets for its tight pocket holes */
function tightPocketWords(tight,letterOf){
  if(!tight.length)return'';
  const least=Math.min(...tight.map(entry=>entry.room));
  const which=listWords([...new Set(tight.map(entry=>`in the ${pieceLabel(entry.through,letterOf)} that go into the ${pieceLabel(entry.into,letterOf)}`))]);
  return` Little room for the drill: behind the pocket holes ${which} there is only ${inchWords(Math.floor(least*4)/4)} along the screw, and a drill with the long pocket-hole bit needs about ${DRIVER_ROOM.usual}". Drive those screws with a 3" driver bit in a right-angle drill attachment.`;
}

/* ---------- tools for one step ---------- */
const STEP_TOOLS={
  measure:'tape measure, pencil and square',
  screw:'drill/driver, pilot-hole bit and countersink bit',
  structural:'drill/driver and the driver bit that comes with the structural screws',
  plug:'3/8" drill bit for the counterbores, and a small hammer',
  plugFilled:'3/8" drill bit for the counterbores',
  plugTapped:'a small hammer, for the plugs',   // the counterbores drilled in step 2 (js/drillplan.js)
  dowelDriven:'mallet',                          // the dowel holes drilled in step 2
  pocket:'pocket-hole jig and drill/driver',
  pocketDriven:'drill/driver with the square driver bit of the pocket screws',
  dowel:'dowel jig, drill and mallet',
  nail:'brad nailer (or hammer and nail set)',
  bracket:'drill/driver',
  frame:'framing hammer',
  toenail:'framing hammer',
  clamps:'clamps',
  glue:'wood glue',
  banding:'household iron, and an edge banding trimmer or a sharp chisel',   // iron-on edge banding (the Computer desk)
};
/* the tools a preset step's own words name that the fasteners do not tell (step.tools, a list, or a list for each
   build style: the Dining chair's block plane, its two clamps and, for the plugs, its flush-cut saw) */
function presetStepTools(step){
  const own=step.preset&&step.source!=='generated'?step.preset.tools:null;
  if(Array.isArray(own))return own;
  if(own&&typeof own==='object')return own[look().style]||own.std||[];
  return[];
}
function stepTools(step){
  const tools=[];
  const add=tool=>{if(tool&&!tools.includes(tool))tools.push(tool);};
  if(step.kind==='cut'){
    add('tape measure, pencil and square');add('saw');
    if(S.parts.some(p=>!isProp(p)&&M[p.mat].kind==='sheet'))add('straight-edge guide for the plywood');
    for(const tool of shapeToolLines(null,step.shapesElsewhere||[]))add(shapeLower(tool));   // what the shaped pieces need: a miter saw, a hole saw (js/shapedrawings.js)
    for(const tool of presetStepTools(step))add(tool);
    add('safety glasses and hearing protection');
    return tools;
  }
  // a preset step of its own that makes the shapes of some pieces (`shapes`: the toy chest's air holes): the tools
  // those shapes need, nothing that its words only mention ("Shapes to cut" is not a saw)
  if(step.preset&&Array.isArray(step.preset.shapes)&&!step.groups.length){
    add('tape measure, pencil and square');add('drill/driver');
    for(const tool of shapeToolLines(step.preset.shapes))add(shapeLower(tool));
    if(/\bclamp/i.test(step.words))add(STEP_TOOLS.clamps);
    add('safety glasses and hearing protection');
    return tools;
  }
  if(step.kind==='finish'){
    // coverWords, js/style.js: plugs (and pieces of dowel in deep holes) are sawn flush, holes under paint filled
    if(plugsInDesign()){
      const plugged=findJoints().filter(j=>jType(j)==='plug').map(j=>jSpec(j,'plug'));
      const painted=FINISHES[look().finish][2]===2,dowels=plugged.some(spec=>spec.deep),shallow=plugged.some(spec=>!spec.deep);
      const sawn=dowels&&shallow&&!painted?'the wooden plugs and the pieces of dowel':dowels?'the pieces of dowel':'the wooden plugs';
      if(!painted||dowels)add('flush-cut saw for '+sawn);
      if(painted&&shallow)add('putty knife for the wood filler');
    }
    if(hasFinishStep())add('sandpaper: '+sandpaperGrits());
    const finish=look().finish;
    if(finish!=='none')add('brush or roller');
    add('dust mask');
    return tools;
  }
  // a step that only says what to do (screw it to the wall, set the tank on): the tools its own words name
  const words=step.words;
  const named=()=>{
    if(/\bmark\b|\bmeasure\b/i.test(words))add(STEP_TOOLS.measure);
    if(/\bsaw\b|\bcut\b/i.test(words))add('saw');
    if(/stud finder/i.test(words))add('stud finder');
    if(/\bscrews?\b|\bdrill\b|\bbolt/i.test(words))add('drill/driver');
    if(/\bnails?\b/i.test(words))add('hammer');
    if(/\bshims?\b/i.test(words))add('level, and shims (thin wedges of wood or plastic)');
    else if(/\blevel\b|\bplumb\b/i.test(words))add('level');
    if(/\bfoam mat\b/i.test(words))add('a foam mat, if the tank is rimless');
    if(/\bstaple/i.test(words))add('staple gun');
    if(/\bpulls?\b|\bknobs?\b|\bhinges?\b/i.test(words))add('screwdriver');
    if(/\bedge banding\b/i.test(words)&&/\biron\b/i.test(words))add(STEP_TOOLS.banding);
  };
  if(!step.groups.length&&!step.hardware.length&&(!step.pieces.length||step.pieces.every(isProp))){
    named();
    for(const tool of presetStepTools(step))add(tool);
    return tools;
  }
  add(STEP_TOOLS.measure);
  // what the fasteners of the step take; a drill is named once, with its bits when screws need pilot holes
  const types=new Set(step.groups.map(group=>group.type));
  const hardwareKinds=new Set(step.hardware.map(row=>row.kind));
  // a step whose screws are all structural screws (washer heads, driven without a pilot hole) needs no pilot-hole
  // or countersink bit, only the bit that comes in their box
  const screwGroups=step.groups.filter(group=>group.type==='screw'||group.type==='plug');
  const allStructural=screwGroups.length>0&&screwGroups.every(group=>[...group.hardware.keys()].some(label=>/structural screws/.test(label)));
  // (holes drilled in step 2 need no bits here: js/drillplan.js. A step whose wood screws all have their holes
  //  drilled already needs only the driver; one with structural screws too, the bit of their box)
  const woodScrews=screwGroups.filter(group=>![...group.hardware.keys()].some(label=>/structural screws/.test(label)));
  const screwsDrilled=woodScrews.length>0&&woodScrews.every(group=>group.predrilled);
  if(allStructural)add(STEP_TOOLS.structural);
  else if(screwsDrilled)add(woodScrews.length<screwGroups.length?STEP_TOOLS.structural:'drill/driver');
  else if(screwGroups.length)add(STEP_TOOLS.screw);
  else if(types.has('bracket')||hardwareKinds.size)add('drill/driver');
  // the counterbores of plugged heads; a hammer to tap the plugs in (under paint a shallow hole takes filler only)
  if(types.has('plug')){
    const painted=FINISHES[look().finish][2]===2;
    const tapped=!painted||step.groups.some(group=>group.type==='plug'&&group.links.some(link=>jSpec(link.joint,'plug').deep));
    const bored=step.groups.filter(group=>group.type==='plug').every(group=>group.predrilled);
    if(!bored)add(tapped?STEP_TOOLS.plug:STEP_TOOLS.plugFilled);
    else if(tapped)add(STEP_TOOLS.plugTapped);
  }
  // (pocket holes drilled in step 2 need no jig here: only the driver bit of the screws, js/drillplan.js; dowel
  //  holes drilled there need only the mallet that taps the dowels home)
  const drilledAll=type=>step.groups.some(group=>group.type===type)&&step.groups.every(group=>group.type!==type||group.predrilled);
  for(const type of['pocket','dowel','nail','frame','toenail'])if(types.has(type))
    add(type==='pocket'&&drilledAll('pocket')?STEP_TOOLS.pocketDriven:type==='dowel'&&drilledAll('dowel')?STEP_TOOLS.dowelDriven:STEP_TOOLS[type]);
  if(step.tight&&step.tight.length)add('right-angle drill attachment and a 3" driver bit, for the pocket screws with little room');
  if(['screw','plug','pocket','dowel','nail','glue'].some(type=>types.has(type)))add(STEP_TOOLS.clamps);
  // wood glue is a supply: stepNeeds lists it with the fasteners
  step.glued=step.groups.some(group=>GLUED_TYPES[group.type])||(step.groups.length>0&&/\bglue\b/i.test(words+' '+step.groups.map(group=>group.line).join(' ')));
  if(hardwareKinds.has('cup'))add('1 3/8" Forstner bit for the cup holes');
  if(['slide','runner','kicker'].some(kind=>hardwareKinds.has(kind)))add('level, and a scrap of wood for a spacer block');
  if(hardwareKinds.has('pull')||hardwareKinds.has('knob'))add('3/16" drill bit');
  if(/stud finder/i.test(words))add('stud finder');
  if(/\blevel\b|\bplumb\b/i.test(words)&&!tools.some(tool=>/level/.test(tool)))add('level');
  // what the words and the preset's own lines ask for beyond the joints the program sees
  const said=words+' '+step.extra.join(' ');
  if(/\bnails?\b|\bnailed\b/i.test(said)&&!tools.some(tool=>/hammer|nailer/.test(tool)))add(STEP_TOOLS.frame);
  if(/\bscrews?\b/i.test(step.extra.join(' '))&&!tools.some(tool=>/drill/.test(tool)))add(STEP_TOOLS.screw);   // screws the preset counts itself (a roof set at a slope)
  // (a saw the preset step names itself, a flush-cut saw for its plugs, is the saw its words speak of)
  const ownTools=presetStepTools(step);
  if(/\b(saw|cut|notch|trim)\b/i.test(words)&&!tools.includes('saw')&&!ownTools.some(tool=>/\bsaw\b/.test(tool)))add('saw');
  if(/\bladder\b/i.test(words))add('stepladder');
  for(const tool of ownTools)add(tool);
  return tools;
}

/* ---------- words for a step the program writes itself ---------- */
/* a side of a piece along one direction: 'left end' when the piece is long that way, else 'left side', 'underside', 'front' */
function pieceSideWord(piece,axis,high){
  if(piece.ax[0]===axis)return`${DIRECTION_ENDS[axis][high?1:0]} end`;
  return[['left side','right side'],['underside','top'],['back','front']][axis][high?1:0];
}
/* How a piece sits against what it is fastened to, along one direction of the joint.
   ref = {lo, hi, label, piece}: the bounds of what it sits against, how to call it ('the Side', 'the frame under
   it'), and the single piece it is, if it is one. Returns {kind, number, say(numbers)} or null. */
function seatClause(piece,ref,axis){
  const p=plainBox(piece),tight=.04;
  const lowGap=p.lo[axis]-ref.lo[axis],highGap=ref.hi[axis]-p.hi[axis];
  const ends=DIRECTION_ENDS[axis];
  const sideOfRef=high=>ref.piece?`the ${ends[high?1:0]} ${ref.piece.ax[0]===axis?'end':'edge'} of ${ref.label}`:`the ${ends[high?1:0]} of ${ref.label}`;
  if(Math.abs(lowGap)<tight&&Math.abs(highGap)<tight)return{kind:'even',say:()=>`flush with ${ref.label} at the ${ends[0]} and at the ${ends[1]}`};
  if(lowGap>=-tight&&highGap>=-tight){   // it lies within what it sits against
    if(Math.abs(lowGap)<tight)return{kind:'flushLow',say:()=>`flush with ${sideOfRef(false)}`};
    if(Math.abs(highGap)<tight)return{kind:'flushHigh',say:()=>`flush with ${sideOfRef(true)}`};
    if(Math.abs(lowGap-highGap)<.07)return{kind:'centered',number:lowGap,say:numbers=>`centered ${axis===1?'top to bottom':axis===0?'left to right':'front to back'} on ${ref.label} (${numbers} in from each side)`};
    if(axis===1||lowGap<=highGap)return{kind:'fromLow',number:lowGap,say:numbers=>`with its ${pieceSideWord(piece,axis,false)} ${numbers} ${axis===1?'up ':''}from ${sideOfRef(false)}`};
    return{kind:'fromHigh',number:highGap,say:numbers=>`with its ${pieceSideWord(piece,axis,true)} ${numbers} from ${sideOfRef(true)}`};
  }
  if(lowGap<=tight&&highGap<=tight){     // it sticks out past what it sits against
    const overLow=-lowGap,overHigh=-highGap;
    if(Math.abs(overLow-overHigh)<.07)return{kind:'overBoth',number:overLow,say:numbers=>`sticking out ${numbers} past ${ref.label} at the ${ends[0]} and at the ${ends[1]}`};
    if(overLow<tight)return{kind:'overHigh',number:overHigh,say:numbers=>`flush at the ${ends[0]} and sticking out ${numbers} past ${ref.label} at the ${ends[1]}`};
    if(overHigh<tight)return{kind:'overLow',number:overLow,say:numbers=>`flush at the ${ends[1]} and sticking out ${numbers} past ${ref.label} at the ${ends[0]}`};
    return{kind:'overEach',say:()=>`sticking out ${inchWords(overLow)} past ${ref.label} at the ${ends[0]} and ${inchWords(overHigh)} at the ${ends[1]}`};
  }
  return null;
}
/* The sentences for pieces that are added to what is built: which faces meet, and where each piece sits.
   pieces all carry one name; builtIds = what stands already. */
/* how a generated step ends: hold it, check it, fasten it (said once for a step, whatever it adds) */
function closingWords(count,atRightAngle,hung,glueOnly){
  const it=count>1?'each one':'it';
  // glued and nothing driven: no drill in this step
  if(glueOnly)return` Spread glue on both faces, press ${it} in place and clamp ${count>1?'them':'it'}, ${atRightAngle?'check with a square that it sits at a right angle':'check that the two pieces lie even with each other'}, and leave the clamps on until the glue is dry.`;
  return` Hold ${it} in place with a clamp, ${atRightAngle?'check with a square that it sits at a right angle':'check that the two pieces lie even with each other'}, then fasten it as listed below.`+
    ' Before you fasten, check that the drill can reach every screw of this step.'+(hung?' Some of these hang on hardware: see the hardware lines.':'');
}
/* plain: true to leave the closing sentences out (a step that adds several kinds of piece says them once, at its end) */
function generatedWords(pieces,builtIds,letterOf,graph,isFirst,plain){
  const sample=pieces[0],count=pieces.length,own=new Set(pieces);
  const letter=letterOf(sample);
  const label=(count>1?`the ${count} ${pluralName(sample.name)}`:`the ${sample.name}`)+(letter?` (${letter})`:'');
  const lettered=piece=>piece.name+(letterOf(piece)?` (${letterOf(piece)})`:'');
  const each=count>1?'each '+sample.name:'the '+lettered(sample),it=count>1?'each one':'it';
  if(isProp(sample)){
    const rest=graph.rests.find(row=>row.prop===sample);
    return`Set ${label} in place${rest?` on the ${rest.on.name}`:''}. Nothing fastens ${count>1?'them':'it'}: ${count>1?'they rest':'it rests'} on the wood.`;
  }
  // what the pieces are fastened to among the built ones, and other ways they are held
  const fastened=[];   // {piece, other, joint, area}
  let hung=false,angled=false,touchOnly=false;
  for(const piece of pieces){
    for(const link of graph.of.get(piece.id)||[]){
      const other=link.a===piece?link.b:link.a;
      if(!builtIds.has(other.id)||own.has(other))continue;
      if(link.hold)hung=true;
      else if(!link.fastened)touchOnly=true;
      else if(!link.joint)angled=true;
      else fastened.push({piece,other,joint:link.joint,type:link.type,area:(link.joint.ru[1]-link.joint.ru[0])*(link.joint.rv[1]-link.joint.rv[0])});
    }
  }
  const among=pieces.some(piece=>(graph.of.get(piece.id)||[]).some(link=>link.fastened&&own.has(link.a)&&own.has(link.b)));
  const reachNote=' Before you fasten, check that the drill can reach every screw of this step.';
  if(!fastened.length){
    if(hung)return`Hang ${label} on ${count>1?'their':'its'} hardware, as the hardware lines below say.`;
    if(isFirst||(!angled&&!touchOnly)){   // the first pieces of the design, or of a part of it that stands by itself
      let text=isFirst?`Start with ${label}.`:`Now a part that stands by itself. Start it with ${label}.`;
      if(count===2&&!among){   // two pieces that stand apart: say how far
        const a=plainBox(pieces[0]),b=plainBox(pieces[1]);
        const axis=[0,1,2].find(k=>a.hi[k]<=b.lo[k]+.01||b.hi[k]<=a.lo[k]+.01);
        const gap=axis===undefined?0:Math.max(b.lo[axis]-a.hi[axis],a.lo[axis]-b.hi[axis]);
        if(gap>.1)text+=` Set them ${inchWords(gap)} apart, measured between the two faces that look at each other, with their ends lined up.`;
      }
      if(among)return text+' Join them to each other as listed below.';
      return text+` Nothing holds ${count>1?'them':'it'} yet: the next steps do that, so lay ${count>1?'them':'it'} where the picture shows.`;
    }
    if(angled)return`Add ${label}. ${count>1?'They sit':'It sits'} at an angle, so the program has not worked out ${count>1?'their':'its'} fasteners: hold ${it} where the picture shows, mark where it meets the other pieces, and screw or nail through it there.`;
    if(touchOnly)return`Set ${label} in place. ${count>1?'They only touch':'It only touches'} the pieces around ${count>1?'them':'it'}: nothing is fastened here.`;
  }
  // "Add the 3 Shelves (C) to the 2 Sides (A)": every kind of built piece they are fastened to
  const byName=new Map();
  for(const row of fastened){
    if(!byName.has(row.other.name))byName.set(row.other.name,new Set());
    byName.get(row.other.name).add(row.other);
  }
  const neighborWords=listWords([...byName.entries()].slice(0,4).map(([name,set])=>{
    const l=letterOf([...set][0]);
    return(set.size>1?`the ${set.size} ${pluralName(name)}`:`the ${name}`)+(l?` (${l})`:'');
  }));
  let text=`Add ${label} to ${neighborWords}.`;
  // which faces meet, from the largest joint
  const main=fastened.slice().sort((a,b)=>b.area-a.area)[0],joint=main.joint;
  // a second piece of one name and size against the first ("Add the 2x4 piece (B) to the 2x4 piece (B)" read as nonsense)
  const twin=count===1&&byName.size===1&&main.other.name===sample.name&&letterOf(main.other)===letter;
  if(twin)text=`Add a second ${lettered(sample)} to the first one.`;
  const myFace=faceSaid(joint,main.piece),theirFace=faceSaid(joint,main.other);
  const aOrAn=/^[aeiou]/i.test(main.other.name)?'an':'a';
  // which one of several pieces of that name it is ("the right Side"), and which of its faces ("outside face")
  const sameNamed=S.parts.filter(p=>p.name===main.other.name&&letterOf(p)===letterOf(main.other));
  const onlyOne=byName.get(main.other.name).size===1,otherLetter=letterOf(main.other)?` (${letterOf(main.other)})`:'';
  const otherSaid=!onlyOne?`${aOrAn} ${lettered(main.other)}`:sameNamed.length>1?whichOne(main.other,sameNamed)+otherLetter:`the ${lettered(main.other)}`;
  const otherBox=plainBox(main.other),outOfOther=[0,0,0];
  outOfOther[joint.k]=joint.plane>(otherBox.lo[joint.k]+otherBox.hi[joint.k])/2?1:-1;
  const theirFaceSaid=theirFace==='face'&&onlyOne?faceWords(main.other,outOfOther,false):theirFace;
  text+=twin?` The ${myFace} of the second one goes against the ${theirFaceSaid} of the first`:` The ${myFace} of ${each} goes against the ${theirFaceSaid} of ${otherSaid}`;
  /* Where each piece sits, along the two directions of that joint. A piece that lies against several built pieces
     across one plane (a top on a frame) is measured against all of them together. Pieces that sit the same way
     share the words; the numbers are listed when they differ (shelves at different heights). */
  const seatOf=piece=>{
    const mine=fastened.filter(row=>row.piece===piece&&row.joint.k===joint.k);
    if(!mine.length)return null;
    const best=mine.slice().sort((a,b)=>b.area-a.area)[0],samePlane=mine.filter(row=>Math.abs(row.joint.plane-best.joint.plane)<.02);
    const others=[...new Set(samePlane.map(row=>row.other))];
    if(others.length===1)return{lo:plainBox(others[0]).lo,hi:plainBox(others[0]).hi,label:`the ${lettered(others[0])}`,piece:others[0]};
    const bounds=bbox(others),above=joint.k===1&&plainBox(piece).lo[1]>=best.joint.plane-.02;
    return{lo:bounds.lo,hi:bounds.hi,label:joint.k===1?(above?'the pieces under it':'the pieces above it'):'the pieces it lies against',piece:null};
  };
  const seats=pieces.map(seatOf),clauses=[];
  if(seats.every(Boolean)&&seats.every(seat=>seat.label===seats[0].label)){
    for(const axis of[joint.u,joint.v]){
      const list=pieces.map((piece,index)=>seatClause(piece,seats[index],axis));
      if(list.some(clause=>!clause)||!list.every(clause=>clause.kind===list[0].kind))continue;
      const numbers=[...new Set(list.filter(clause=>clause.number!==undefined).map(clause=>r16(clause.number)))].sort((a,b)=>a-b);
      if(numbers.length>6)continue;
      clauses.push({text:list[0].say(listWords(numbers.map(inchWords))),several:numbers.length>1});
    }
  }
  text+=clauses.length?', '+clauses.map(clause=>clause.text).join(', and ')+'.':'.';
  if(clauses.some(clause=>clause.several))text+=` Each ${sample.name} takes one of those measurements.`;
  // how the piece lies, when all of them lie the same way
  const lies=piece=>piece.ax[0]===1?'stands upright':piece.ax[2]===1?'lies flat':'stands on edge';
  if(pieces.every(piece=>!tilted(piece)&&lies(piece)===lies(sample)))text+=` ${count>1?'Each one':'It'} ${lies(sample)}.`;
  if(plain)return text;
  return text+closingWords(count,myFace==='end'||theirFace==='end'||main.piece.ax[0]!==main.other.ax[0],hung,fastened.every(row=>row.type==='glue'));
}

/* ---------- the order of pieces nobody wrote steps for ----------
   pieces: what to put in order. builtIds: what is built before them (empty for a whole design).
   Returns an array of arrays of pieces: one array per step.

   Each part that holds together by itself (a fastened set: one of two designs side by side) is finished before
   the next is started, from left to right. Within a part:
     1. what touches the pieces that stand already; or, for a part that starts from nothing, what stands on the floor
     2. then, ring by ring, what touches the pieces placed so far
     3. tops (a piece lying flat at the very top, with nothing standing on it) after the frame
     4. thin skins (a 1/4" back or side panel) after that: they are nailed on over everything else
     5. doors, lids and drawers last
   The pieces of one ring that share a name and a size are one step (the same operation done several times); of
   two steps in one ring the bigger pieces come first. */
const ORDER_RANK={top:5000,skin:6000,mover:9000};
function suggestedOrder(pieces,builtIds,graph){
  const inList=new Set(pieces.map(p=>p.id)),wood=pieces.filter(p=>!isProp(p)),props=pieces.filter(isProp);
  const neighborsOf=piece=>(graph.of.get(piece.id)||[]).map(link=>link.a===piece?link.b:link.a);
  const riding=new Set();
  for(const mover of movers())for(const id of mover.riders)if(inList.has(id))riding.add(id);
  // the parts that hold together by themselves
  const parts=[],placed=new Set();
  for(const piece of wood){
    if(placed.has(piece.id))continue;
    const ids=fastenedSet([piece.id]),part=wood.filter(p=>ids.has(p.id)&&!placed.has(p.id));
    part.forEach(p=>placed.add(p.id));
    parts.push(part);
  }
  const touchesBuilt=part=>part.some(p=>neighborsOf(p).some(other=>builtIds.has(other.id)));
  parts.sort((a,b)=>(touchesBuilt(b)?1:0)-(touchesBuilt(a)?1:0)||bbox(a).lo[0]-bbox(b).lo[0]);

  const steps=[];
  for(const part of parts){
    const inPart=new Set(part.map(p=>p.id));
    const lowest=Math.min(...part.map(p=>box(p).lo[1])),highest=Math.max(...part.map(p=>box(p).hi[1]));
    const isTop=piece=>!tilted(piece)&&piece.ax[2]===1&&box(piece).hi[1]>highest-1&&box(piece).lo[1]>lowest+.5&&
      !neighborsOf(piece).some(other=>inPart.has(other.id)&&!isProp(other)&&box(other).lo[1]>=box(piece).hi[1]-.05);
    const isSkin=piece=>M[piece.mat].kind==='sheet'&&piece.t<=.3;
    const special=new Map();   // piece id -> the rank of a top, a skin or a door
    for(const p of part){
      if(riding.has(p.id))special.set(p.id,ORDER_RANK.mover);
      else if(isSkin(p))special.set(p.id,ORDER_RANK.skin);
      else if(isTop(p))special.set(p.id,ORDER_RANK.top);
    }
    const rank=new Map();
    /* from these pieces outward, ring by ring, through pieces that are allowed */
    const spread=(starts,from,allowed)=>{
      let ring=starts.filter(p=>!rank.has(p.id)&&allowed(p)),level=from;
      while(ring.length){
        for(const p of ring)rank.set(p.id,level);
        const next=new Set();
        for(const p of ring)for(const other of neighborsOf(p))if(inPart.has(other.id)&&!isProp(other)&&!rank.has(other.id)&&allowed(other))next.add(other);
        ring=[...next];level++;
      }
      return level;
    };
    const plain=p=>!special.has(p.id);
    let starts=part.filter(p=>neighborsOf(p).some(other=>builtIds.has(other.id)));
    if(!starts.length)starts=part.filter(p=>box(p).lo[1]<lowest+.26);
    const level=spread(starts,0,plain);
    // what the rings did not reach: something that stands on a top goes on after the top, the rest after the rings
    const onTop=part.filter(p=>plain(p)&&!rank.has(p.id)&&neighborsOf(p).some(other=>special.get(other.id)===ORDER_RANK.top));
    spread(onTop,ORDER_RANK.top+1,plain);
    spread(part.filter(plain),level,plain);
    for(const p of part)if(special.get(p.id)===ORDER_RANK.top)rank.set(p.id,ORDER_RANK.top);
    for(const p of part)if(special.get(p.id)===ORDER_RANK.skin)rank.set(p.id,ORDER_RANK.skin);
    // a drawer or a door: the piece its hardware is on first, then what is fastened to that
    const leads=part.filter(p=>riding.has(p.id)&&hardwareOn(p.id).some(item=>HARDWARE[item.kind]&&HARDWARE[item.kind].motion));
    spread(leads,ORDER_RANK.mover,p=>riding.has(p.id));
    for(const p of part)if(!rank.has(p.id))rank.set(p.id,ORDER_RANK.mover+500);
    // one step for the pieces of one ring that carry one name and one size
    const byKey=new Map();
    for(const p of part){
      const key=[rank.get(p.id),p.name,p.mat,r16(p.l),r16(p.w),r16(p.t)].join('|');
      if(!byKey.has(key))byKey.set(key,{rank:rank.get(p.id),bulk:p.l*p.w*p.t,low:1e9,pieces:[]});
      const step=byKey.get(key);
      step.pieces.push(p);
      step.low=Math.min(step.low,box(p).lo[1]);
    }
    /* Pieces of one such step that are fastened to EACH OTHER are not one operation done several times (two boards
       glued edge to edge: the second goes against the first). They are taken one after the other: first those
       that touch what is built, then those that touch these, and so on. */
    const builtSoFar=new Set(builtIds);
    for(const step of[...byKey.values()].sort((a,b)=>a.rank-b.rank||b.bulk-a.bulk||a.low-b.low)){
      const inStep=new Set(step.pieces);
      const touchEachOther=step.pieces.some(p=>(graph.of.get(p.id)||[]).some(link=>link.fastened&&inStep.has(link.a)&&inStep.has(link.b)));
      if(!touchEachOther){
        steps.push(step.pieces);
      }else{
        const left=new Set(step.pieces);
        while(left.size){
          let now=[...left].filter(p=>neighborsOf(p).some(other=>builtSoFar.has(other.id)));
          if(!now.length||now.length===left.size&&now.length>1)now=[[...left][0]];
          steps.push(now);
          for(const p of now){left.delete(p);builtSoFar.add(p.id);}
        }
      }
      for(const p of step.pieces)builtSoFar.add(p.id);
    }
  }
  // tanks, mattresses and the like go on last, each kind in one step
  const propSteps=new Map();
  for(const p of props){
    if(!propSteps.has(p.name))propSteps.set(p.name,[]);
    propSteps.get(p.name).push(p);
  }
  return steps.concat([...propSteps.values()]);
}

/* ---------- the plan ---------- */
/* The words of step 2 "Drill your pieces". DRILL_WORDS ends "After this step you only put the pieces together",
   which is not true when the step after it is a preset step that makes the shapes of some pieces (its `shapes`:
   the toy chest's air holes, drilled while the front and the sides are still flat). Then step 2 says so.
   Without pocket holes (a Rustic design: wood screws only) the words start from DRILL_WORDS_BITS (js/drillplan.js). */
function drillStepWords(next,drill){
  const base=drill&&!drill.pockets?DRILL_WORDS_BITS:DRILL_WORDS;
  const shapes=next&&next.source!=='generated'&&next.preset&&Array.isArray(next.preset.shapes)?next.preset.shapes:[];
  if(!shapes.length)return base;
  const names=listWords(shapes.map(name=>name.toLowerCase()));
  // what that step really does to those pieces: drills holes, cuts other shapes (rounded corners, notches), or both
  const pieces=S.parts.filter(p=>shapes.includes(p.name)&&hasShape(p));
  const holes=pieces.some(p=>shapeFeatures(p).some(f=>f.kind==='hole'));
  const other=pieces.some(p=>shapeFeatures(p).some(f=>f.kind!=='hole')||(p.shape.corners||[]).some(Boolean)||(p.shape.ends||[]).some(Boolean));
  const does=holes&&other?'drills the other holes and cuts the shapes':holes?'drills the other holes':'cuts the shapes';
  const what=pieces.length>1?`the ${names} pieces, while those pieces are`:`the ${names}, while it is`;
  return base.replace('After this step you only put the pieces together',
    `The next step ${does} ${holes?'in':'of'} ${what} still flat. After that you only put the pieces together`);
}
let planMemo=null;
const SUGGESTED_NOTE='Suggested order. The program worked this order out from what touches what: what stands on the floor first, then what is fastened to that, tops after the frame, doors and drawers last. Before each step, check that you can reach every screw of that step with the drill. Where you cannot, fasten that piece one step earlier.';
function buildPlan(fresh){
  const graph=connGraph(),lookKey=JSON.stringify(look())+'|'+(S.glue===false);
  if(!fresh&&planMemo&&planMemo.graph===graph&&planMemo.steps===S.steps&&planMemo.lookKey===lookKey&&planMemo.count===S.parts.length)return planMemo.plan;
  // A design that was turned as one (30 degrees in the room) is built like the same design standing square, so
  // the steps are worked out with every turned set standing square (squaredUp, js/neighbors.js).
  const plan=squaredUp(()=>makeBuildPlan(graph));
  planMemo={graph,steps:S.steps,lookKey,count:S.parts.length,plan};
  return plan;
}
function makeBuildPlan(graph){
  const cutList=cutRows(),letterOf=cutList.letterOf;
  const glueListed=hardwareTotals(graph.links.filter(link=>link.joint).map(link=>link.joint)).glue;   // is wood glue on the shopping list?
  const preset=(S.steps||[]).filter(step=>step&&Array.isArray(step.add));
  const own=preset.length>0;
  const owner=own?presetStepOfPieces(preset):new Map();
  // copies of the placed design, built in its own steps when its preset asks for it (copiesInSteps, below)
  const copies=own?copiesInSteps(owner):{of:new Set(),made:new Map(),most:1,name:''};
  const copyWords=index=>{
    const n=copies.made.get(index)||1;
    return n>1?` Do this for each of the ${n} ${copies.name}s; the lists below count all ${n}.`:'';
  };
  const drafts=[];   // {kind, source, words, was, pieces, extra, claims: preset step or null}
  const loose=S.parts.filter(p=>!owner.has(p.id));

  if(own){
    // rule 4: pieces without a preset step, in clusters that touch each other, each after the step it touches
    const after=new Map();   // preset step index -> [cluster of pieces]
    const looseIds=new Set(loose.map(p=>p.id)),seen=new Set();
    const finishAt=preset.findIndex(isFinishStep),lastBuild=preset.reduce((last,step,index)=>preset[index].add.length&&S.parts.some(p=>owner.get(p.id)===index)?index:last,0);
    for(const start of loose){
      if(seen.has(start.id))continue;
      const cluster=[],todo=[start];
      let touches=-1;
      seen.add(start.id);
      while(todo.length){
        const p=todo.pop();
        cluster.push(p);
        for(const link of graph.of.get(p.id)||[]){
          const other=link.a===p?link.b:link.a;
          if(looseIds.has(other.id)){
            if(!seen.has(other.id)){seen.add(other.id);todo.push(other);}
          }else if(owner.has(other.id))touches=Math.max(touches,owner.get(other.id));
        }
        for(const rest of graph.rests)if(rest.prop===p&&owner.has(rest.on.id))touches=Math.max(touches,owner.get(rest.on.id));
      }
      const index=touches>=0?touches:finishAt>0?finishAt-1:lastBuild;
      if(!after.has(index))after.set(index,[]);
      after.get(index).push(cluster);
    }
    preset.forEach((step,index)=>{
      const pieces=S.parts.filter(p=>owner.get(p.id)===index);
      const dropped=step.add.length>0&&!pieces.length;   // rule 2: everything it added is gone
      if(!dropped){
        const kind=isFinishStep(step)?'finish':isCutStep(step)?'cut':pieces.length?'build':'note';
        // changed: its own pieces were resized, moved or deleted; or a piece it quotes a number about was (quotedMeasures)
        const quotesStale=Array.isArray(step.about)&&!measuresStillTrue(step.about);
        // (a copy built in this step is not a change: the step's own pieces are what it was written for)
        const ownPieces=pieces.filter(p=>!copies.of.has(p.id));
        const edited=pieces.length>0&&((step.sig&&!sameSignature(step.sig,stepSignature(ownPieces)))||quotesStale);
        // refresh: a design saved under an older rule for fasteners, whose fasteners in this step changed when it
        // was opened (js/fasteningupgrade.js): its old words describe the old fasteners, so it is written from the
        // pieces too, without the note that the person changed something
        const refreshed=pieces.length>0&&!!step.refresh&&!edited;
        const changed=edited||refreshed;
        // fasten: the preset's own lines for joints the program cannot see (rotated pieces). A line is a sentence,
        // or {line, uses: [[hardware-list label, count]]} when the preset has counted what it takes.
        const own=step.fasten||[];
        const copyLine=kind==='cut'&&copies.most>1?` You are making ${copies.most} ${copies.name}s: cut each piece for all of them at one saw setting, with a stop block clamped to the saw, so they come out alike.`
          :pieces.length?copyWords(index):'';
        drafts.push({kind,source:changed?'rewritten':'preset',words:stepText(step)+copyLine,was:'',pieces,preset:step,stale:quotesStale&&!pieces.length,refreshed,
          extra:own.map(entry=>typeof entry==='string'?entry:entry.line),extraUses:own.flatMap(entry=>entry.uses||[]),uncounted:own.some(entry=>typeof entry==='string')});
      }
      for(const cluster of after.get(index)||[]){
        const built=new Set(S.parts.filter(p=>owner.has(p.id)&&owner.get(p.id)<=index).map(p=>p.id));
        for(const pieces of suggestedOrder(cluster,built,graph))drafts.push({kind:'build',source:'generated',words:'',was:'',pieces,extra:[],preset:null});
      }
    });
    // a design that got a finish after a bare preset made it is told how to put it on
    if(look().finish!=='none'&&!preset.some(isFinishStep))drafts.push({kind:'finish',source:'preset',words:finText(),was:'',pieces:[],extra:[],preset:FIN});
  }else{
    drafts.push({kind:'cut',source:'preset',words:CUT.t,was:'',pieces:[],extra:[],preset:CUT});
    for(const pieces of suggestedOrder(S.parts,new Set(),graph))drafts.push({kind:'build',source:'generated',words:'',was:'',pieces,extra:[],preset:null});
    drafts.push({kind:'finish',source:'preset',words:finText(),was:'',pieces:[],extra:[],preset:FIN});
  }
  // every cut and hole in a piece is made in the cutting work, before the piece is fastened to anything: the
  // cutting step names the shaped rows as they are now (shapeCutStepLine, js/shapedrawings.js)
  // (except the pieces whose shapes a preset step of their own makes, named in its `shapes`: the toy chest's air
  // holes; that step lists their tools too, stepTools)
  const shapesElsewhere=[...new Set(drafts.flatMap(draft=>draft.source!=='generated'&&draft.preset&&Array.isArray(draft.preset.shapes)?draft.preset.shapes:[]))];
  const shapedLine=shapeCutStepLine(cutList,shapesElsewhere);
  for(const draft of drafts)if(draft.kind==='cut'){
    if(shapedLine)draft.words+=' '+shapedLine;
    draft.shapesElsewhere=shapesElsewhere;
  }
  // Drill your pieces (js/drillplan.js): right after cutting, when the design has a hole that is drilled ahead
  const drill=drillPlan(graph,letterOf);
  if(drill.total){
    const cutAt=drafts.findIndex(draft=>draft.kind==='cut');
    drafts.splice(cutAt+1,0,{kind:'drill',source:'generated',words:drillStepWords(drafts[cutAt+1],drill),was:'',pieces:[],extra:[],preset:null});
  }

  // the step of every piece, then the joints and the hardware of every step
  const stepOfPiece=new Map();
  drafts.forEach((draft,index)=>draft.pieces.forEach(p=>stepOfPiece.set(p.id,index)));
  /* Parts that are built in one step and set in place in a later one (step.bring, see stampSteps): the piece is
     "in place" from that later step on. A joint between two pieces of one such part is made where the part is
     built; a joint between the part and anything else is made where the part is set in place.
     Parts can sit inside bigger parts: the upper frames of one section of a fish wall are set on its uprights in
     one step, and the whole section is stood beside the next in a later one. So a piece may be set in place more
     than once, and each time is kept (placements, in step order). Moving a part both pieces belong to does not
     make the joint between them: the joint is made at the latest step where one of them is set in place by a
     part the other is not in (or where it is built). */
  const placements=new Map();   // piece id -> [{at: index of the step, group: which part}], in step order
  drafts.forEach((draft,index)=>{
    const groups=draft.preset&&draft.source!=='generated'&&Array.isArray(draft.preset.bring)?draft.preset.bring:[];
    groups.forEach((ids,number)=>{
      for(const id of ids){
        if(!stepOfPiece.has(id)||stepOfPiece.get(id)>=index)continue;
        if(!placements.has(id))placements.set(id,[]);
        const list=placements.get(id);
        if(list.some(placed=>placed.at===index))continue;   // (one step sets a piece in place once)
        list.push({at:index,group:index+':'+number});
      }
    });
  });
  // the last placement is when the piece is finally where it belongs (the pictures and the drill room read it)
  const placedAt=new Map(),partOf=new Map();   // piece id -> step index; -> which part it belongs to last
  for(const[id,list]of placements){
    placedAt.set(id,list[list.length-1].at);
    partOf.set(id,list[list.length-1].group);
  }
  const groupsOf=piece=>(placements.get(piece.id)||[]).map(placed=>placed.group);
  const inPlaceAt=(piece,shared)=>(placements.get(piece.id)||[]).filter(placed=>!shared.has(placed.group))
    .reduce((latest,placed)=>Math.max(latest,placed.at),stepOfPiece.get(piece.id));
  const stepOfJoint=(a,b)=>{
    const shared=new Set(groupsOf(a).filter(group=>groupsOf(b).includes(group)));
    return Math.max(inPlaceAt(a,shared),inPlaceAt(b,shared));
  };
  const linksOf=drafts.map(()=>[]);
  for(const link of graph.links){
    if(!link.joint||!link.fastened||!stepOfPiece.has(link.a.id)||!stepOfPiece.has(link.b.id))continue;
    linksOf[stepOfJoint(link.a,link.b)].push(link);
  }
  const hardwareOf=drafts.map(()=>[]),hardwareSteps=[];
  for(const item of hardwareList()){
    if(!HARDWARE[item.kind]||!stepOfPiece.has(item.on))continue;
    const host=byId(item.on),other=item.to!=null&&stepOfPiece.has(item.to)?byId(item.to):null;
    const ready=other?stepOfJoint(host,other):stepOfPiece.get(item.on);
    const words=HARDWARE_STEP_WORDS[item.kind];
    // Its home: a preset step, at or after that point, that says it mounts this kind (step.hardware: ['slide']);
    // else the first preset step from there on whose words talk about this kind; else a step of its own.
    let home=drafts[ready].source==='generated'?ready:-1;   // a step the program writes mounts its own hardware
    for(let index=ready;index<drafts.length&&home<0;index++){
      const step=drafts[index].preset;
      if(step&&drafts[index].source!=='generated'&&(step.hardware||[]).includes(item.kind))home=index;
    }
    for(let index=ready;index<drafts.length&&home<0;index++){
      const step=drafts[index].preset;
      if(step&&drafts[index].source!=='generated'&&words&&words.test(step.t||''))home=index;
    }
    if(home>=0)hardwareOf[home].push(item);
    else hardwareSteps.push({after:ready,item});
  }
  // generated hardware steps: one for each kind of hardware on each kind of piece, after the step that makes both pieces
  const extraSteps=new Map();
  for(const{after,item}of hardwareSteps){
    const host=byId(item.on),key=after+'|'+HARDWARE[item.kind].group+'|'+host.name;
    if(!extraSteps.has(key))extraSteps.set(key,{after,items:[],host});
    extraSteps.get(key).items.push(item);
  }
  const finalDrafts=[];
  drafts.forEach((draft,index)=>{
    // brought: the pieces of earlier steps that this step sets in place; apart: every piece of this step is part
    // of something that is set in place later, so the step builds a part by itself (a drawer box, a wall)
    const brought=S.parts.filter(p=>(placements.get(p.id)||[]).some(placed=>placed.at===index));
    const apart=draft.pieces.length>0&&draft.pieces.every(p=>placedAt.has(p.id));
    finalDrafts.push({...draft,links:linksOf[index],items:hardwareOf[index],brought,apart,draftIndex:index});
    for(const extra of extraSteps.values()){
      if(extra.after===index)finalDrafts.push({kind:'hardware',source:'generated',words:'',was:'',pieces:[],extra:[],preset:null,links:[],items:extra.items});
    }
  });

  // write every step out
  const steps=[],built=new Set();
  let rewritten=0,firstBuild=true;
  const pieceStep=new Map();
  const suppliesClaimed=new Set();   // plain lines of the hardware list that a step has listed under "You need"
  const finalIndexOf=new Map();   // index of a draft -> index of its step in the finished list
  finalDrafts.forEach((draft,index)=>{if(draft.draftIndex!==undefined)finalIndexOf.set(draft.draftIndex,index);});
  for(const draft of finalDrafts){
    const step={no:steps.length+1,kind:draft.kind,source:draft.source,words:draft.words,was:draft.was,pieces:draft.pieces,groups:[],extra:draft.extra,hardware:[],need:null,
      brought:draft.brought||[],apart:!!draft.apart,preset:draft.preset||null,extraUses:draft.extraUses||[],uncounted:!!draft.uncounted,stale:!!draft.stale,
      shapesElsewhere:draft.shapesElsewhere||[]};
    const before=new Set(built);
    draft.pieces.forEach(p=>{built.add(p.id);pieceStep.set(p.id,steps.length);});
    // the "Fasten with" lines, numbered: the joints that take the same fastener between the same kinds of piece share one
    step.groups=fastenLines(draft.links,letterOf);
    // pocket-hole lines whose holes are on the drawings of step 2 point there (js/drillplan.js), and the preset's
    // own sentences that tell to drill those holes are not shown
    markPredrilled(step.groups,drill);
    if(draft.source==='preset')step.words=withoutDrillWords(step.words,draft.preset,drill,step.groups);
    step.hardware=hardwareLines(draft.items,letterOf,cutList.letterOfStrip);
    step.hardware.forEach((row,index)=>{row.no=step.groups.length+index+1;});   // numbered on after the "Fasten with" lines, for the balloons
    if(draft.source==='generated'&&draft.kind==='build'){
      step.words=generatedWords(draft.pieces,before,letterOf,graph,firstBuild&&!before.size);
    }else if(draft.source==='rewritten'){
      rewritten++;
      step.was=draft.refreshed?'':draft.words;
      step.words=rewrittenWords(draft.pieces,before,letterOf,graph);
    }else if(draft.kind==='hardware'){
      const kinds=[...new Set(draft.items.map(item=>item.kind))];
      step.words=`Mount the ${listWords([...new Set(draft.items.map(item=>HARDWARE[item.kind].name.toLowerCase().replace(/ \(.*| ?,.*/g,'')+'s'))])} on the ${pluralOrOne(draft.items,letterOf)}. `+
        kinds.map(kind=>HARDWARE[kind].mount).join(' ');
    }
    // pocket holes with little room behind them for the drill, with the pieces that are in place by then: the
    // pieces built so far, less a part built apart that is not set in place yet; a part built apart is built
    // on its own (only its own pieces are around it)
    const index=draft.draftIndex;
    let present;
    if(draft.apart&&index!==undefined)present=new Set(S.parts.filter(p=>draft.pieces.some(own=>partOf.get(own.id)===partOf.get(p.id))&&built.has(p.id)).map(p=>p.id));
    else present=new Set([...built].filter(id=>!(index!==undefined&&placedAt.has(id)&&placedAt.get(id)>index&&stepOfPiece.get(id)<index)));
    step.tight=tightPockets(step.groups,present,draft.pieces);
    if(step.tight.length)step.words+=tightPocketWords(step.tight,letterOf);
    // a screwed joint is stronger with glue: steps the program writes say so once, unless the design is built dry
    if(draft.source!=='preset'&&step.groups.some(group=>group.type==='screw')&&glueListed&&S.glue!==false){
      step.words+=' Spread a thin line of wood glue in each screwed joint first: it makes the joint much stronger.';
    }
    // many plywood sheets on the walls in one step (the sheathing of a shed): which lettered sheet goes where
    const layout=sheetLayoutWords(draft.pieces,letterOf);
    if(layout)step.words+=' '+layout;
    if(draft.kind==='build')firstBuild=false;
    step.need=draft.kind==='drill'?drillNeeds(drill):stepNeeds(step,letterOf,glueListed,cutList.letterOfStrip,suppliesClaimed);
    steps.push(step);
  }
  // the step that drives each hole of step 2, and the Put in line of each step (js/drillplan.js)
  const stepOfLink=new Map();
  for(const step of steps)for(const group of step.groups)for(const link of group.links)stepOfLink.set(link,step.no);
  drill.number(stepOfLink);
  const drillStep=steps.find(step=>step.kind==='drill');
  drill.stepNo=drillStep?drillStep.no:0;
  drill.steps=steps;   // (the hardware holes of the At assembly part of step 2 name their steps: hardwareHoleWords)
  // setInPlace: piece id -> index of the step that sets it in place, for the parts that are built apart first
  const setInPlace=new Map();
  for(const[id,draftIndex]of placedAt)if(finalIndexOf.has(draftIndex))setInPlace.set(id,finalIndexOf.get(draftIndex));
  // placedIn: every time it is set in place, [{at: step index, group: the part}] (a part can sit inside a bigger one)
  const placedIn=new Map();
  for(const[id,list]of placements)placedIn.set(id,list.filter(placed=>finalIndexOf.has(placed.at)).map(placed=>({at:finalIndexOf.get(placed.at),group:placed.group})));
  // added: the steps the program wrote for pieces that were added to a preset design (rule 4)
  const added=own?steps.filter(step=>step.source==='generated'&&step.kind==='build').length:0;
  const plan={steps,suggested:!own,rewritten,added,stepOfPiece:pieceStep,setInPlace,placedIn,partOf,letterOf,note:own?'':SUGGESTED_NOTE,drill};
  for(const step of steps)step.put=step.kind==='build'?placementWords(step,plan):'';
  return plan;
}
/* The pieces that are not to be seen at one step (index from 0): those of later steps, and a part that was built
   apart in an earlier step and is not set in place yet (the top frame of a stand while the posts go on). */
function piecesNotYetThere(plan,index){
  const placedIn=plan.placedIn||new Map();
  // the parts this step works on (a piece of them is built in it): they are shown as far as they are built, where
  // they end up (the decks go on the frames that are set on the uprights later: the frames are drawn under them)
  const working=new Set();
  for(const p of S.parts)if(plan.stepOfPiece.get(p.id)===index)for(const placed of placedIn.get(p.id)||[])working.add(placed.group);
  const away=new Set();
  for(const p of S.parts){
    const own=plan.stepOfPiece.get(p.id);
    if(own===undefined)continue;
    if(own>index){away.add(p.id);continue;}
    // built earlier and set in place by a part later on, and that part is not being worked on now: not there yet
    // (with parts inside parts, every part it is still to be set in place by counts: the upper frames of one
    // section of a fish wall are away while its posts go on, though the posts are of the same section)
    const later=own<index?(placedIn.get(p.id)||[]).filter(placed=>placed.at>index):[];
    if(later.some(placed=>!working.has(placed.group)))away.add(p.id);
  }
  return away;
}
/* What the picture of a step that builds a part by itself shows: that part only, as far as it is built. When the
   step builds several parts that are alike (two drawer boxes), one of them. Returns {ids: Set, alike: how many
   such parts the step builds} or null for an ordinary step. */
function partBuiltApart(plan,index){
  const step=plan.steps[index];
  if(!step||!step.apart)return null;
  // the pieces of this step fall into parts: each is the pieces that are set in place together and touch
  const graph=connGraph(),mine=new Set(step.pieces.map(p=>p.id));
  const clusters=[],seen=new Set();
  for(const start of step.pieces){
    if(seen.has(start.id))continue;
    const cluster=new Set([start.id]),todo=[start];
    seen.add(start.id);
    while(todo.length){
      const p=todo.pop();
      for(const link of graph.of.get(p.id)||[]){
        const other=link.a===p?link.b:link.a;
        if(!link.joint||!link.fastened||cluster.has(other.id)||plan.stepOfPiece.get(other.id)>index||plan.partOf.get(other.id)!==plan.partOf.get(start.id))continue;
        // (a smaller part inside this one that is set on it in a later step is not there yet: the upper frames of a
        // section of a fish wall while its posts go on)
        const groupsOfStart=(plan.placedIn&&plan.placedIn.get(start.id)||[]).map(placed=>placed.group);
        const laterOwn=(plan.placedIn&&plan.placedIn.get(other.id)||[]).filter(placed=>placed.at>index&&!groupsOfStart.includes(placed.group));
        if(laterOwn.length&&plan.stepOfPiece.get(other.id)<index)continue;
        cluster.add(other.id);seen.add(other.id);todo.push(other);
      }
    }
    clusters.push(cluster);
  }
  const shape=cluster=>[...cluster].map(id=>{const p=byId(id);return[p.name,r16(p.l),r16(p.w)].join('|');}).sort().join(',');
  const alike=clusters.filter(cluster=>shape(cluster)===shape(clusters[0])).length;
  if(alike===clusters.length&&clusters.length>1)return{ids:clusters[0],alike};
  return{ids:new Set(clusters.flatMap(cluster=>[...cluster])),alike:1};
}
/* 'Door (H)' or 'Doors (H)' for the pieces a set of hardware is mounted on */
function pluralOrOne(items,letterOf){
  const hosts=[...new Set(items.map(item=>item.on))].map(byId),names=[...new Set(hosts.map(host=>host.name))];
  return listWords(names.map(name=>{
    const list=hosts.filter(host=>host.name===name),letter=letterOf(list[0]);
    return(list.length>1?pluralName(name):name)+(letter?` (${letter})`:'');
  }));
}
/* rule 3: a preset step whose pieces changed is written from the pieces; several kinds of piece get a sentence each */
function rewrittenWords(pieces,built,letterOf,graph){
  // pieces of one name and one cut-list letter share a sentence; a shelf that was made deeper gets its own, with
  // its own letter and how it lines up
  const byKind=new Map();
  for(const p of pieces){
    const key=p.name+'|'+letterOf(p);
    if(!byKind.has(key))byKind.set(key,[]);
    byKind.get(key).push(p);
  }
  const sentences=[],standing=new Set(built);
  let first=!built.size,fastens=false;
  for(const list of byKind.values()){
    const words=generatedWords(list,standing,letterOf,graph,first,true);
    if(/^Add /.test(words))fastens=true;
    sentences.push(words);
    list.forEach(p=>standing.add(p.id));
    first=false;
  }
  return sentences.join(' ')+(fastens?closingWords(pieces.length,true,false):'');
}
/* the "You need" line of a step */
/* The plain lines of the hardware list (S.hw: what a preset lists and the program neither places nor counts from a
   joint) that the words of this step use. A line belongs to the first step whose words speak of it (claimed). */
const SUPPLY_WORDS=[[/wall studs?/i,/wall studs?|\bstuds\b/i],[/landscape fabric/i,/\bfabric\b/i],[/screw eyes?/i,/screw eyes?/i],[/chain or rope/i,/\bchain\b|\brope\b/i],
  [/concrete blocks?/i,/\bblocks\b/i],[/ground anchors?/i,/\banchor/i],[/corner braces?/i,/corner braces?/i],[/barrel bolts?/i,/barrel bolt/i],
  [/for the hinge leaves/i,/hinges?/i],[/for the hinge straps/i,/hinges?/i],[/lid support/i,/lid support|lid stay/i],
  [/for the gable ends|sloped tops of the side walls/i,/triangle above|sloped strip above/i]];
function suppliesNamed(step,claimed){
  if(!claimed||step.source==='generated'||step.kind==='cut'||step.kind==='finish')return[];
  const found=[];
  for(const[label,count]of plainLinesLeft(S.hw,hardwareList())){
    if(claimed.has(label)||!(count>0))continue;
    const rule=SUPPLY_WORDS.find(([inLabel])=>inLabel.test(label));
    if(!rule||!rule[1].test(step.words))continue;
    claimed.add(label);
    found.push([label,count]);
  }
  return found;
}
function stepNeeds(step,letterOf,glueListed,stripLetterOf,claimed){
  const pieces=new Map();
  for(const p of step.pieces){
    const key=letterOf(p)+'|'+p.name+'|'+(isProp(p)?'':fmt(p.l));
    pieces.set(key,(pieces.get(key)||0)+1);
  }
  const fasteners=new Map();
  let glue=false;
  for(const group of step.groups){
    for(const[label,count]of group.hardware)fasteners.set(label,(fasteners.get(label)||0)+count);
    if(GLUED_TYPES[group.type])glue=true;
  }
  // hardware of the step: bought hardware by name; a strip of wood (runner, kicker) is a piece to cut, with its screws and glue
  const bought=[];
  for(const row of step.hardware){
    const wood=HARDWARE[row.kind].wood;
    if(!wood){bought.push(hardwareWords(row.items));continue;}
    for(const item of row.items){
      const key=(stripLetterOf?stripLetterOf(item):'')+'|'+wood.name+'|'+fmt(item.size);
      pieces.set(key,(pieces.get(key)||0)+1);
    }
    fasteners.set(wood.screwLabel,(fasteners.get(wood.screwLabel)||0)+row.items.length*wood.screwsEach);
    glue=true;
  }
  // what the preset's own lines take (the nails of a roof), and what the words of the step use from the plain
  // lines of the hardware list (the screws into the wall studs): counted, so the row never has to be vague
  for(const[label,count]of step.extraUses||[])fasteners.set(label,(fasteners.get(label)||0)+count);
  for(const[label,count]of suppliesNamed(step,claimed))fasteners.set(label,(fasteners.get(label)||0)+count);
  const fastenerWords=[...fasteners.entries()].map(([label,count])=>fastenerPhrase(count,label));
  if(step.kind==='cut')return{pieces:[],fasteners:['every board and sheet on the shopping list'],tools:stepTools(step)};
  if(step.kind==='finish'){
    const supplies=finishSupplies().map(([name])=>name.replace(/, quarts| \(packs\)|, small tub/,'').toLowerCase());
    return{pieces:[],fasteners:supplies.length?supplies:['nothing to buy'],tools:stepTools(step)};
  }
  // a step that only explains how the next steps are done (step.info on the preset's step) takes nothing itself
  if(step.preset&&step.preset.info&&!step.pieces.length)return{pieces:[],fasteners:[],hardware:[],tools:[]};
  const need={
    pieces:[...pieces.entries()].map(([key,qty])=>{const[letter,name,length]=key.split('|');return{qty,letter,name,length};}),
    fasteners:fastenerWords,hardware:bought,tools:stepTools(step),
  };
  // fasteners the program does not count for this step: the ones its own words or the preset's own lines name
  if(step.uncounted)need.fasteners.push('the nails and screws that the lines under "Fasten with" name');
  else if(!fastenerWords.length&&!step.hardware.length&&step.kind==='note'&&step.source==='preset'&&/\bscrews?\b|\bnails?\b|\bbolts?\b|\bbrackets?\b|\bstaples?\b/i.test(step.words)){
    need.fasteners.push('the fasteners named in the words of this step (they are counted on the Hardware list)');
  }
  if((glue||step.glued)&&glueListed)need.fasteners.push('wood glue');   // only when glue is on the shopping list
  return need;
}
/* one plain sentence for a connection that was clicked in the 3D view */
function connectionSentence(link){
  if(!link.joint||!link.fastened)return'';
  if(link.joint.frame&&!squaredNow)return squaredUp(()=>connectionSentence(link)); // inside a turned set: worded with the set standing square
  const group=fastenLine([link],()=>'');
  return group.line+(group.where?' '+group.where:'');
}

/* ---------- self-checks (selfTest runs every function in SELFTESTS, see js/core.js) ----------
   What a person builds from must hold for every preset as Create places it, and after the design is edited:
     - every piece is in exactly one step, the steps are numbered 1, 2, 3 ... and each has its "You need" line;
     - the fasteners of the steps add up to what the joints put on the hardware list, and every piece of placed
       hardware is in exactly one step;
     - a "Fasten with" line is only written for a fastened joint, and it names the piece the layout drives the
       fastener through and the piece it ends in;
   then the edits the owner asked about: delete a piece, stretch one, rename one, add a board and connect it; a
   design drawn by hand; two designs in one project. The pictures are checked in js/steppictures.js. */
function buildStepProblems(label){
  const found=[],plan=buildPlan(true);
  const seen=new Map();
  plan.steps.forEach((step,index)=>{
    if(step.no!==index+1)found.push(`${label}: step ${index+1} carries the number ${step.no}`);
    if(!step.need||!Array.isArray(step.need.tools))found.push(`${label}: step ${step.no} has no "You need" line`);
    if(!step.words)found.push(`${label}: step ${step.no} has no words`);
    for(const p of step.pieces)seen.set(p.id,(seen.get(p.id)||0)+1);
    if(step.kind==='build'&&step.pieces.length&&!step.need.pieces.length)found.push(`${label}: step ${step.no} adds pieces that its "You need" line leaves out`);
    for(const group of step.groups){
      if(group.links.some(link=>!link.fastened||link.type==='none'))found.push(`${label}: step ${step.no} has a "Fasten with" line for pieces that only touch`);
      if(!group.line||/undefined|NaN/.test(group.line+group.where))found.push(`${label}: step ${step.no}, line ${group.no} is missing a value: ${group.line}`);
      if(group.sample){
        const f=group.sample.layout[0];
        if(!group.line.includes(f.through.name)||!group.line.includes(f.into.name))found.push(`${label}: step ${step.no}, line ${group.no} does not name the piece the fastener goes through (${f.through.name}) and the one it goes into (${f.into.name})`);
      }
    }
  });
  const missing=S.parts.filter(p=>!seen.has(p.id)),twice=S.parts.filter(p=>seen.get(p.id)>1);
  if(missing.length)found.push(`${label}: ${missing.length} piece(s) are in no step (${missing[0].name})`);
  if(twice.length)found.push(`${label}: ${twice.length} piece(s) are in more than one step (${twice[0].name})`);
  // the fasteners of the steps against the hardware list
  const listed=new Map(),inSteps=new Map();
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const[item,count]of jSpec(link.joint,link.type).hw)listed.set(item,(listed.get(item)||0)+count);
  }
  for(const step of plan.steps)for(const group of step.groups)for(const[item,count]of group.hardware)inSteps.set(item,(inSteps.get(item)||0)+count);
  for(const[item,count]of listed)if(inSteps.get(item)!==count)found.push(`${label}: the steps use ${inSteps.get(item)||0} × ${item}, the hardware list buys ${count}`);
  const placed=hardwareList().filter(item=>HARDWARE[item.kind]&&byId(item.on)).length;
  const mounted=plan.steps.reduce((sum,step)=>sum+step.hardware.reduce((n,row)=>n+row.items.length,0),0);
  if(placed!==mounted)found.push(`${label}: ${placed} pieces of hardware are placed, the steps mount ${mounted}`);
  return found;
}
SELFTESTS.push(function buildStepsFollowTheDesign(problems){
  const wrong=text=>{if(problems.length<60)problems.push('build steps: '+text);};
  const place=name=>{
    const preset=PRESETS.find(candidate=>candidate.name===name),vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),false);
    return{preset,vals};
  };
  // every preset as it comes
  for(const preset of PRESETS){
    const vals=presetDefaults(preset);
    let parts=[];
    try{parts=preset.build(vals)||[];}catch(e){}
    if(!parts.length)continue;
    placePreset(preset,vals,parts,false);
    buildStepProblems(preset.name).slice(0,4).forEach(wrong);
    const plan=buildPlan();
    if(plan.suggested||plan.rewritten)wrong(`${preset.name}: a preset that nobody changed must keep its own steps and words`);
  }
  // a line says through and into, and at how many places (in Rustic / rough, where the shelves are screwed through
  // the sides; in Everyday and Fine they are held by pocket holes in their undersides)
  place('Bookshelf');
  look().style='rustic';commit();
  let plan=buildPlan(true);
  const shelves=plan.steps.find(step=>step.pieces.some(p=>p.name==='Shelf'));
  if(!shelves||!shelves.groups.some(group=>/through the Side \([A-Z]+\) into the end of the Shelf \([A-Z]+\)/.test(group.line)&&/6 places \(12 in all\)/.test(group.line)))wrong('the Bookshelf in Rustic / rough does not say "through the Side into the end of the Shelf" for its six shelf ends');
  look().style='std';commit();
  plan=buildPlan(true);
  const pocketed=plan.steps.find(step=>step.pieces.some(p=>p.name==='Shelf'));
  if(!pocketed||!pocketed.groups.some(group=>/pocket holes drilled in the underside of the Shelf \([A-Z]+\)/i.test(group.line)))wrong('the Bookshelf in Everyday does not hold its shelves by pocket holes in their undersides: '+(pocketed?pocketed.groups.map(group=>group.line).join(' / '):'no step'));
  // deleted: the step goes, the numbers stay continuous
  place('Workbench');
  const stepsBefore=buildPlan(true).steps.length;
  S.parts=S.parts.filter(p=>p.name!=='Lower shelf');
  commit();
  plan=buildPlan(true);
  if(plan.steps.length!==stepsBefore-1||plan.steps.some(step=>/lower shelf/i.test(step.words)))wrong('deleting the lower shelf of the Workbench did not drop its step');
  buildStepProblems('Workbench without its lower shelf').slice(0,3).forEach(wrong);
  // stretched: its step is written again from the pieces, and says so; renamed: it stays in its step
  const top=S.parts.find(p=>p.name==='Top');
  top.l=r16(top.l+6);
  S.parts.find(p=>p.name==='Leg').name='Corner leg';
  commit();
  plan=buildPlan(true);
  const topStep=plan.steps[plan.stepOfPiece.get(top.id)];
  if(topStep.source!=='rewritten'||!topStep.was||!/7"/.test(topStep.words))wrong('a stretched top did not get words written from the pieces as they are now (it sticks out 7" at one end)');
  if(plan.rewritten!==1)wrong(`stretching one piece rewrote ${plan.rewritten} steps`);
  const renamed=S.parts.find(p=>p.name==='Corner leg');
  if(plan.steps[plan.stepOfPiece.get(renamed.id)].source!=='preset')wrong('a renamed piece left its preset step');
  // added and connected by hand: a step of its own, after the step that builds what it touches
  const aprons=S.parts.filter(p=>p.name==='Long apron').map(plainBox);
  const zLow=Math.min(aprons[0].hi[2],aprons[1].hi[2]),zHigh=Math.max(aprons[0].lo[2],aprons[1].lo[2]);
  const[braceId]=addParts([mk('Brace','2x4',[1.5,3.5,zHigh-zLow],[aprons[0].lo[0]+8,aprons[0].lo[1],zLow])]);
  commit();
  plan=buildPlan(true);
  const braceStep=plan.steps[plan.stepOfPiece.get(braceId)];
  if(!braceStep||braceStep.source!=='generated'||braceStep.pieces.length!==1)wrong('a board added by hand did not get a step of its own');
  else{
    const neighbors=connectionsOf(braceId).map(link=>link.a.id===braceId?link.b:link.a);
    if(neighbors.some(other=>plan.stepOfPiece.get(other.id)>plan.stepOfPiece.get(braceId)))wrong('a board added by hand is placed before a piece it is fastened to');
    if(!braceStep.groups.some(group=>/through the Long apron \([A-Z]+\) into the end of the Brace/.test(group.line)))wrong('the step of a board added by hand does not say through which piece its screws go');
    if(!/Add the Brace/.test(braceStep.words))wrong('the step of a board added by hand does not say what to add');
  }
  buildStepProblems('Workbench after edits').slice(0,3).forEach(wrong);
  // drawn by hand: a suggested order, floor first, the top last
  load(JSON.stringify(blank()),true);
  const drawn=addParts([mk('Side','1x10',[.75,36,9.25],[0,0,0]),mk('Side','1x10',[.75,36,9.25],[24.75,0,0]),
    mk('Shelf','1x10',[24,.75,9.25],[.75,12,0]),mk('Top','1x12',[27.5,.75,11.25],[-1,36,-1])]);
  commit();
  plan=buildPlan(true);
  const order=drawn.map(id=>plan.stepOfPiece.get(id));
  if(!plan.suggested||!plan.note)wrong('a design drawn by hand is not marked as a suggested order');
  if(!(order[0]===order[1]&&order[0]<order[2]&&order[2]<order[3]))wrong('a hand-drawn bookcase is not built sides first, then the shelf, then the top');
  if(!/Start with the 2 Sides/.test(plan.steps[order[0]].words)||!/24" apart/.test(plan.steps[order[0]].words))wrong('the first step of a hand-drawn design does not say what to start with and how far apart');
  if(plan.steps[0].kind!=='cut'||plan.steps[plan.steps.length-1].kind!=='finish')wrong('a hand-drawn design does not start with cutting and end with finishing');
  buildStepProblems('a design drawn by hand').slice(0,3).forEach(wrong);
  // two designs in one project: a suggested order, one design finished before the other is started
  place('Bookshelf');
  const bench=PRESETS.find(candidate=>candidate.name==='Five-board bench'),benchVals=presetDefaults(bench);
  placePreset(bench,benchVals,bench.build(benchVals),true);
  plan=buildPlan(true);
  if(!plan.suggested)wrong('two designs in one project are not given a suggested order');
  const setOfStep=plan.steps.filter(step=>step.pieces.length).map(step=>new Set(step.pieces.map(p=>p.set)));
  if(setOfStep.some(sets=>sets.size>1))wrong('one step mixes the pieces of two designs');
  const sequence=setOfStep.map(sets=>[...sets][0]);
  if(sequence.some((set,index)=>index>0&&set!==sequence[index-1]&&sequence.slice(index+1).includes(sequence[index-1])))wrong('the steps jump back and forth between two designs');
  buildStepProblems('two designs').slice(0,3).forEach(wrong);
  // hardware: real numbers from the model, in the step the preset wrote for it
  place('Base cabinet with doors');
  plan=buildPlan(true);
  const hinges=plan.steps.flatMap(step=>step.hardware).find(row=>row.kind==='cup');
  const hingeLine=hinges?hinges.line:'';
  if(!hingeLine.includes('hinged on its left edge; the middle of each hole is 7/8" in from that edge, 3" from its bottom end and 3" from its top end')||
    !hingeLine.includes('1 3/8" wide and 1/2" deep')||!hingeLine.includes('inside face of the Side')){
    wrong('the hinge line of the Base cabinet does not give the cup hole (how wide, how deep, how far from the hinged edge and from the ends of the door) and the piece the plates go on: '+hingeLine);
  }
  const nightstand=place('Nightstand with drawers');
  plan=buildPlan(true);
  const slideStep=plan.steps.find(step=>step.hardware.some(row=>row.kind==='slide'));
  const heights=nightstandHeights(nightstandPlan(nightstand.vals));
  if(!slideStep||!/^Mount the slides/.test(slideStep.words))wrong('the slides of the Nightstand are not listed under its "Mount the slides" step');
  else if(!heights.hardware.every(height=>slideStep.hardware[0].line.includes(fmt(height))))wrong('the slide line of the Nightstand does not give the heights its own step gives: '+slideStep.hardware[0].line);
  else if(!/^2 pairs of drawer slides \(4 slides\)/.test(slideStep.hardware[0].line)||!/inside face of each cabinet Side/.test(slideStep.hardware[0].line))wrong('the slide line of the Nightstand does not count pairs or does not say that the cabinet halves go on the cabinet sides: '+slideStep.hardware[0].line);
  whatABeginnerReads(wrong,place);
});
/* The findings of the first-time builder, each kept from coming back (the pictures are checked in js/steppictures.js):
     - wooden runners and kickers: the kicker's height is given to its underside, above the panel under the drawers,
       and that number is where the strip really is, clear of the drawer under it; the runner line says cabinet
       sides; both are on the cut list, in the lumber to buy and under Pieces of their step, with their screws;
     - a step lists only fasteners that are driven in it: the aquarium stand's post step has no screw into the
       top frame, which goes on a step later; the garage shelves fasten two posts in each of two steps;
     - every "Fasten with" line with a close-up says where the fasteners go, in numbers. */
function whatABeginnerReads(wrong,place){
  place('Nightstand with drawers');   // (the usual choice: metal slides)
  const preset=PRESETS.find(candidate=>candidate.name==='Nightstand with drawers');
  const vals={...presetDefaults(preset),slides:'runner'};
  placePreset(preset,vals,preset.build(vals),false);
  let plan=buildPlan(true);
  const rows=plan.steps.flatMap(step=>step.hardware),runners=rows.find(row=>row.kind==='runner'),kickers=rows.find(row=>row.kind==='kicker');
  if(!runners||!/fixed to the cabinet, not to the drawers/.test(runners.line)||/on each of the \d+ Drawer sides/.test(runners.line))wrong('the runner line of the Nightstand does not say plainly that the runners go on the cabinet sides: '+(runners&&runners.line));
  if(!kickers)wrong('the Nightstand on wooden runners has no kicker line');
  else{
    // the height the line gives, against where the strip and the drawer under it really are
    const item=kickers.items[0],pose=hardwarePose(item),underside=pose.at.y-(item.geo&&item.geo.mid?DRAWER.runnerStrip/2:0);
    const shelf=S.parts.find(p=>p.name==='Shelf'),shelfTop=shelf.pos[1]+size(shelf)[1];
    const said=`its UNDERSIDE ${fmt(r16(underside-shelfTop))} above the top of the Shelf`;
    if(!kickers.line.includes(said))wrong(`the kicker line does not give the height of the underside of the kicker (${said}): ${kickers.line}`);
    const drawerSide=byId(item.geo.for),drawerTop=drawerSide.pos[1]+size(drawerSide)[1];
    if(underside<drawerTop+.06)wrong('the kicker sits lower than the top of the drawer side under it: the drawer would not go in');
    if(/measured to the middle/.test(kickers.line))wrong('the kicker line is measured to the middle of the strip, which no builder can find');
  }
  const cut=cutRows(),stripRow=cut.rows.find(row=>row.strip);
  if(!stripRow||stripRow.qty!==hardwareList().filter(item=>HARDWARE[item.kind].wood).length)wrong('the wooden runners and kickers are not on the cut list, one row with all of them');
  if(!diagramSection(cut).buy.some(row=>row.m.id==='1x2'&&row.qty>0))wrong('the board the runners and kickers are cut from is not in the lumber to buy');
  if(hardwareTotals(findJoints()).rows.some(row=>/drawer (runners|kickers)/i.test(row[0])))wrong('wooden runners or kickers are listed as hardware to buy');
  const mountStep=plan.steps.find(step=>step.hardware.some(row=>row.kind==='runner'));
  if(!mountStep||!mountStep.need.pieces.some(row=>row.name==='Drawer runner')||!mountStep.need.fasteners.some(text=>/18 wood screws, #8 × 1-1\/4"/.test(text)))wrong('the step that mounts the runners does not list them under Pieces with their 18 screws');
  // a step lists what is driven in that step
  place('Single aquarium stand');
  plan=buildPlan(true);
  const posts=plan.steps.find(step=>step.pieces.some(p=>p.name==='Post'));
  if(!posts||posts.groups.some(group=>/Shelf deck/.test(group.line))||posts.groups.reduce((sum,group)=>sum+group.total,0)!==16)wrong('the post step of the aquarium stand lists screws of the top frame, which goes on a step later');
  const frameOn=plan.steps.find(step=>step.brought.length);
  // (the screws between the top frame and the posts, by name: its rails and its end cross pieces, not any screw into
  // a post, which the uprights' would also be; its countertop only rests on the post tops in Everyday and Fine,
  // held from underneath, and is screwed down into them in Rustic: js/fishtop.js)
  const frameLines=frameOn?frameOn.groups.map(group=>group.line):[];
  const railsToPosts=frameLines.some(line=>/through the Post \([A-Z]+\) into the end of the Rail|through the Rail \([A-Z]+\) into the Post/.test(line));
  const crossToPosts=frameLines.some(line=>/through the Cross piece \([A-Z]+\) into the Post/.test(line));
  const downThrough=frameLines.some(line=>/through the Countertop/.test(line));
  if(!frameOn||!railsToPosts||!crossToPosts||downThrough!==(look().style==='rustic'))wrong('the step that lowers the top frame of the aquarium stand does not list the screws between its rails and cross pieces and the posts, or screws down through the countertop in a style that holds it from underneath');
  if(/also counts the screws of the next step/.test(plan.steps.map(step=>step.words).join(' ')))wrong('a step of the aquarium stand still says its list counts the screws of another step');
  place('Garage shelves');
  plan=buildPlan(true);
  const postSteps=plan.steps.filter(step=>step.pieces.some(p=>p.name==='Post'));
  if(postSteps.length!==2||postSteps.some(step=>step.pieces.length!==2||!step.groups.length))wrong('the garage shelves do not fasten the back posts and the front posts in two steps, each with its own screws');
  // Every line that fastens says where its fasteners go, in numbers, on the piece that is marked: the piece the
  // fastener goes through (pocket holes: the piece they are drilled in). Never from the piece hidden behind it
  // alone, and never the bare advice to keep away from the ends.
  for(const name of['Workbench','Sturdy bench','Bookshelf','Base cabinet with doors','Nightstand with drawers','Single aquarium stand','Garage shelves']){
    place(name);
    for(const step of buildPlan(true).steps){
      for(const group of step.groups){
        if(!group.sample||group.sample.layout[0].kind==='bracket')continue;
        const marked=group.sample.layout[0].kind==='dowel'?group.sample.layout[0].into.name:group.sample.layout[0].through.name;
        // (a line drilled in step 2 points to its drawing; the sentence it had is kept as whereKept: js/drillplan.js)
        const where=group.whereKept||group.where,numbered=/\d+(?: \d+\/\d+)?"|\d+\/\d+"/.test(where);
        if(!numbered||!where.includes(marked)||/^Keep them at least/.test(where))wrong(`${name}, step ${step.no}, line ${group.no} does not give marks in numbers on the ${marked}: ${where}`);
        // the close-up's size line across the joint says the number the words say (it said 3 1/2" where the words said 3 7/16")
        const across=(group.sample.dims||[]).find(dim=>dim.inches!==undefined);
        if(across&&!where.includes(fmt(across.inches)))wrong(`${name}, step ${step.no}, line ${group.no}: its close-up shows ${fmt(across.inches)}, its words do not: ${where}`);
        if(/a quarter of the way in/.test(where))wrong(`${name}, step ${step.no}, line ${group.no} gives its rows as "a quarter of the way in", not in numbers: ${where}`);
      }
    }
  }
  // the shed's sheathing step says which lettered sheet goes on which wall, and its stud walls list every stud mark
  place('Shed');
  plan=buildPlan(true);
  const sheathing=plan.steps.find(step=>step.pieces.some(p=>p.name==='Wall sheathing'));
  const sheathed=sheathing?S.parts.filter(p=>p.name==='Wall sheathing').every(p=>sheathing.words.includes(plan.letterOf(p))):false;
  if(!sheathing||!/Front wall:.*Right wall:.*Back wall:.*Left wall:/.test(sheathing.words)||!sheathed)wrong('the sheathing step of the Shed does not say which lettered sheet goes on which wall');
  if(plan.steps.some(step=>step.groups.some(group=>/over the middle of each Stud/.test(group.where))))wrong('a wall of the Shed marks its studs "over the middle of each Stud" with no numbers');
  // what a preset fastens itself (the roof of the bird feeder, set at a slope) is counted in its step and on the list
  place('Bird feeder');
  const roofStep=buildPlan(true).steps.find(step=>step.pieces.some(p=>p.name==='Roof board'));
  if(!roofStep||!roofStep.need.fasteners.some(text=>/^4 exterior screws/.test(text))||!roofStep.need.tools.some(tool=>/drill/.test(tool)))wrong('the roof step of the bird feeder does not count its screws, or names no drill: '+(roofStep&&roofStep.need.fasteners.join('; ')));
  if(!hardwareTotals(findJoints()).rows.some(([item,count])=>item===FEEDER_ROOF_SCREW&&count>=FEEDER_ROOF_SCREWS))wrong('the roof screws of the bird feeder are not on the shopping list');
  for(const preset of PRESETS){
    if(!preset.steps)continue;
    const vals=presetDefaults(preset);
    for(const step of preset.steps(vals)||[]){
      if((step.fasten||[]).some(entry=>typeof entry==='string'))wrong(`${preset.name}: a line the preset fastens itself is not counted ({line, uses}), so its step cannot say how many to have ready`);
    }
  }
  // edits: a step that quotes the place of a piece of another step follows when that piece is deleted
  place('Bookshelf');
  const shelves=S.parts.filter(p=>p.name==='Shelf').sort((a,b)=>a.pos[1]-b.pos[1]),topShelf=shelves[shelves.length-1];
  const gone=fmt(r16(topShelf.pos[1]));
  const quoting=buildPlan(true).steps.filter(step=>step.words.includes(gone));
  if(!quoting.length)wrong('the Bookshelf has no step that gives the height of its top shelf (the marking step), so this check checks nothing');
  S.parts=S.parts.filter(p=>p!==topShelf);
  commit();
  plan=buildPlan(true);
  const stillSaid=plan.steps.filter(step=>step.words.includes(gone));
  if(stillSaid.length)wrong(`after the top shelf of the Bookshelf was deleted, step ${stillSaid[0].no} still gives its height (${gone})`);
  // a shelf made deeper: the step that is written again names each shelf with its own letter and says how it lines up
  const deep=S.parts.filter(p=>p.name==='Shelf')[0];
  deep.mat='1x12';deep.w=M['1x12'].w;
  commit();
  plan=buildPlan(true);
  const shelfStep=plan.steps[plan.stepOfPiece.get(deep.id)],other=S.parts.find(p=>p.name==='Shelf'&&p!==deep);
  if(shelfStep.source!=='rewritten'||!shelfStep.words.includes(`Shelf (${plan.letterOf(deep)})`)||!shelfStep.words.includes(`Shelf (${plan.letterOf(other)})`)||plan.letterOf(deep)===plan.letterOf(other)){
    wrong('a shelf of the Bookshelf that was made deeper is not named with its own cut-list letter in the step that was written again: '+shelfStep.words.slice(0,200));
  }
  if(!/sticking out 2" past the Side/.test(shelfStep.words))wrong('the step of the deeper shelf does not say that it sticks out 2" past the sides');
  if((shelfStep.words.match(/Before you fasten, check that the drill/g)||[]).length>1)wrong('a step that was written again says its closing sentences more than once');
  // drawn by hand: two boards of one name that are fastened to each other are two steps, each with its own sentence
  load(JSON.stringify(blank()),true);
  const boards=addParts([mk('2x4 piece','2x4',[1.5,3.5,36],[10,0,3.5]),mk('2x4 piece','2x4',[24,3.5,1.5],[0,0,2]),mk('2x4 piece','2x4',[24,3.5,1.5],[0,0,.5])]);
  commit();
  plan=buildPlan(true);
  if(plan.stepOfPiece.get(boards[1])===plan.stepOfPiece.get(boards[2]))wrong('two boards of one name that are glued to each other are added in one step, as if both met the first board');
  if(plan.steps.some(step=>/Add the 2 2x4 pieces/.test(step.words)))wrong('a hand-made design still says "Add the 2 2x4 pieces" for boards that are fastened one to the other');
  // the second board glued to the first: named as the second one, and no drill, screws or square for a glue joint
  const glueJoint=findJoints().find(j=>[j.a.id,j.b.id].includes(boards[1])&&[j.a.id,j.b.id].includes(boards[2]));
  S.joints[glueJoint.key]='glue';
  commit();
  plan=buildPlan(true);
  const glued=plan.steps[plan.stepOfPiece.get(boards[2])];
  if(/to the 2x4 piece \([A-Z]+\)\. /.test(glued.words)&&!/a second 2x4 piece/.test(glued.words))wrong('a board glued to a board of the same name reads "Add the 2x4 piece (B) to the 2x4 piece (B)": '+glued.words);
  if(/drill|screw|with a square/i.test(glued.words)||glued.need.tools.some(tool=>/drill/.test(tool)))wrong('a step that only glues talks of a drill, screws or a square: '+glued.words+' | '+glued.need.tools.join('; '));
}

/* Room for the drill, and the face the words name. For every preset of furniture for the house (HOUSE_FURNITURE,
   js/showfaces.js) and the Workbench, at its usual size and at the smallest and largest of each number, in
   Everyday (the pocket holes of Fine furniture are the same):
     - every pocket hole has at least DRIVER_ROOM.least behind it once its step's pieces are in place;
     - a step whose pocket holes have less than DRIVER_ROOM.usual says so and lists the tool that fits;
     - (usual size, Everyday and Fine) a step whose words say its pocket holes are drilled in the underside (or the
       top face) of a piece has no line under it that drills that piece's holes in another face. */
SELFTESTS.push(function pocketHolesHaveRoomForTheDrill(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('room for the drill: '+text);};
  const seen=new Set(),once=(key,text)=>{if(!seen.has(key)){seen.add(key);wrong(text);}};
  for(const name of HOUSE_FURNITURE.concat(['Workbench'])){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)continue;
    for(const{vals,where}of sizesToTry(preset)){
      if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;
      const styles=where==='default size'?['std','fine']:['std'];
      for(const style of styles){
        if(!placeInStyle(preset,vals,style))continue;
        const at=`${name} (${where}, ${STYLES[style][0]})`;
        for(const step of buildPlan(true).steps){
          for(const entry of step.tight||[]){
            if(entry.room<DRIVER_ROOM.least)once(name+'least',`${at}: step ${step.no}: the pocket holes in the ${entry.through.name} into the ${entry.into.name} have only ${fmt(Math.max(0,entry.room))} behind them, too little for any drill`);
          }
          if((step.tight||[]).length&&(!/Little room for the drill/.test(step.words)||!step.need.tools.some(tool=>/right-angle/.test(tool))))
            once(name+'said',`${at}: step ${step.no} has pocket holes with little room for the drill and does not say so, or does not list the tool`);
          // the face the words name for a piece's pocket holes, against the lines under them
          for(const group of step.groups){
            if(group.type!=='pocket')continue;
            const line=group.line.match(/drilled in the (underside|top face|[^,()]+?) of (?:the |each )?([A-Z][a-z ]+?) \([A-Z]+\)/);
            if(!line)continue;
            const piece=line[2].toLowerCase().replace(/[^a-z ]/g,''),face=line[1];
            for(const named of['underside','top face']){
              const says=new RegExp(`(pocket holes[^.]*? in the ${named} of (the |each )?${piece}\b)`,'i').test(step.words);
              if(says&&face!==named)once(name+style+'face'+step.no,`${at}: step ${step.no} says the pocket holes are in the ${named} of the ${line[2]}, and a line under it drills them in the ${face}`);
            }
          }
        }
      }
    }
  }
});});

/* Plugged screws read as a person would write them (the owner's checker read four near-copies of one paragraph):
   - in a step, the words on sinking and plugging the heads are said once; a later line with the same words
     refers to that line;
   - the plugged screws of the Platform bed's corners (moved apart at each corner to pass the screws that cross
     it) are one line, whose words name every corner they give marks for, or say that all are marked alike;
   - a Bookshelf with every joint of its sides plugged by hand says the paragraph once in each step. */
const PLUG_PARAGRAPH=/sink them: drill a 3\/8" hole|sink into the 3\/8" counterbores drilled in step/g;   // (the second: drilled in step 2, js/drillplan.js)
SELFTESTS.push(function plugWordsOncePerStep(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<60)problems.push('plugged screws: '+text);};
  const place=(name,choose)=>{
    const preset=PRESETS.find(candidate=>candidate.name===name),vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),false);
    if(choose){choose();commit();}
    return buildPlan(true);
  };
  const onceEach=(label,plan)=>{
    for(const step of plan.steps){
      const said=step.groups.reduce((sum,group)=>sum+((group.line||'').match(PLUG_PARAGRAPH)||[]).length,0);
      if(said>1)wrong(`${label}, step ${step.no}: says how to sink and plug the heads ${said} times`);
    }
  };
  // the bed, in Everyday
  const bed=place('Platform bed');
  onceEach('Platform bed',bed);
  const plugged=bed.steps.flatMap(step=>step.groups).filter(group=>group.sample&&group.sample.layout.some(f=>f.plug));
  if(plugged.length!==1)wrong(`the Platform bed has ${plugged.length} lines of plugged screws (the side rails into the legs are one line)`);
  for(const group of plugged){
    if(group.places!==4)wrong(`the plugged line of the Platform bed covers ${group.places} corners, not 4`);
    const named=['left','right'].every(side=>new RegExp(`(back|front|both) ends? of the ${side} Side rail|of each Side rail`).test(group.where));
    if(!named&&!/Do this at each of the 4 places/.test(group.line))wrong(`the plugged line of the Platform bed does not say which corner each set of marks is for: ${group.where}`);
    if(/either way round/.test(group.where))wrong('the plugged line of the Platform bed lets the builder slant the screws either way round, though the model slants them one way at each corner');
    if(group.sampleAt&&!group.where.includes(`At ${group.sampleAt} (the close-up shows this one)`))wrong(`the words do not say which corner the close-up of the plugged line shows (${group.sampleAt})`);
  }
  // a Bookshelf with plugs picked by hand on every joint of its sides
  const shelf=place('Bookshelf',()=>{
    for(const joint of findJoints()){
      const names=[joint.a.name,joint.b.name];
      if(names.includes('Side')&&!names.includes('Back panel'))S.joints[joint.key]='plug';
    }
  });
  if(!shelf.steps.some(step=>step.groups.some(group=>((group.line||'').match(PLUG_PARAGRAPH)||[]).length)))wrong('a Bookshelf with plugs picked by hand on its sides never says how to plug them');
  if(!shelf.steps.some(step=>step.groups.some(group=>/Sink and plug these heads as line \d+ says/.test(group.line||''))))wrong('a Bookshelf step with two lines of plugged screws does not refer the second to the first');
  onceEach('a Bookshelf with plugged sides',shelf);
});});
