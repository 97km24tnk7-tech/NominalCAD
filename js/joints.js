/* WoodShop Designer: finding where pieces touch and choosing fasteners */
'use strict';
/* ---------- joints ---------- */
const JTYPES={screw:['Wood screws',0x333333,'Drill a pilot hole first so the wood does not split. A bead of glue makes it much stronger.'],
 pocket:['Pocket-hole screws',0x1e88e5,'Needs a pocket-hole jig. Drill the angled holes on the hidden side, clamp, then drive the screws.'],
 dowel:['Dowels + glue',0x8d5524,'Drill matching holes in both pieces (a dowel jig helps), glue, tap together and clamp.'],
 nail:['Brad nails + glue',0x888888,'Glue does the holding; brads just keep things in place while it dries.'],
 bracket:['L-brackets',0xe53935,'Easiest joint there is: screw a metal corner bracket into both pieces on the hidden side.'],
 glue:['Glue only',0xf9a825,'Spread glue evenly and clamp for at least 30 minutes. Good for edge-to-edge and face-to-face.'],
 none:['Not joined',0,'These pieces only touch.']};
const SCREWS=[[1,'1"'],[1.25,'1-1/4"'],[1.625,'1-5/8"'],[2,'2"'],[2.5,'2-1/2"'],[3,'3"'],[3.5,'3-1/2"']];
const BRADS=[[.625,'5/8"'],[.75,'3/4"'],[1,'1"'],[1.25,'1-1/4"'],[1.5,'1-1/2"'],[2,'2"']];
const pickLE=(arr,x)=>{let r=arr[0];for(const a of arr)if(a[0]<=x+.13)r=a;return r;};
function faceType(p,k){const m=M[p.mat];if(p.ax[2]===k)return'face';if(p.ax[1]===k)return isSquare(m)?'face':'edge';return m.kind==='sheet'?'edge':'end';}
function findJoints(){
  const out=[],ps=S.parts.filter(p=>!isProp(p)&&!tilted(p)),B=ps.map(p=>{const s=size(p);return{p,lo:p.pos,hi:p.pos.map((v,i)=>v+s[i]),s};});
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],b=B[j];
    for(let k=0;k<3;k++){let plane=null;
      if(Math.abs(a.hi[k]-b.lo[k])<.02)plane=a.hi[k];else if(Math.abs(b.hi[k]-a.lo[k])<.02)plane=a.lo[k];
      if(plane===null)continue;
      const[u,v]=[0,1,2].filter(x=>x!==k);
      const ru=[Math.max(a.lo[u],b.lo[u]),Math.min(a.hi[u],b.hi[u])],rv=[Math.max(a.lo[v],b.lo[v]),Math.min(a.hi[v],b.hi[v])];
      if(ru[1]-ru[0]<.1||rv[1]-rv[0]<.1)continue;
      out.push({key:a.p.id+'-'+b.p.id,a:a.p,b:b.p,k,u,v,ru,rv,plane,fa:faceType(a.p,k),fb:faceType(b.p,k),da:a.s[k],db:b.s[k]});
      break;}}
  return out;
}
function thruPart(j){ // the piece a fastener passes through first
  if(j.fa==='face'&&j.fb==='face')return j.da<=j.db?'a':'b';
  return j.fa==='face'?'a':j.fb==='face'?'b':null;
}
function defaultType(j){
  const th=thruPart(j);
  if(/^(Lid|Door)$/.test(j.a.name)||/^(Lid|Door)$/.test(j.b.name))return'none'; // lids lift off, doors hang on hinges
  if(!th)return(j.fa==='edge'&&j.fb==='edge')?(j.k===1?'none':'glue'):'pocket'; // boards stacked on edge just rest on each other
  const tp=j[th],d=th==='a'?j.da:j.db,ot=th==='a'?j.b:j.a,of=th==='a'?j.fb:j.fa;
  if(d<=.3)return'nail';
  if(M[ot.mat].kind==='sheet'&&of==='edge'&&ot.t<=.5&&isSquare(M[tp.mat]))return'none'; // thin panel just butting a leg
  if(isSquare(M[tp.mat])&&!(j.fa==='face'&&j.fb==='face'&&isSquare(M[j.a.mat])&&isSquare(M[j.b.mat])))return'pocket';
  if(d>1.6)return'pocket';
  return'screw';
}
