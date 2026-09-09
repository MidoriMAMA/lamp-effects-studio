(function(root){
'use strict';
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},fract=x=>x-Math.floor(x),hash=x=>fract(Math.sin(x*127.1+311.7)*43758.5453);
// Image-space observations from the first video cycle, normalized onto the lamp width.
// These constrain motion and timing; they are not inferred hardware addresses.
const PATH=[[-.18,27],[-.09,24.5],[0,21.1],[.15,15.1],[.27,5.9],[.42,.8],[.60,-1]];
function linearPosition(phase){const a=PATH.findIndex(p=>p[0]>=phase);if(a<0)return PATH.at(-1)[1];if(a===0)return PATH[0][1];const from=PATH[a-1],to=PATH[a];return from[1]+(to[1]-from[1])*(phase-from[0])/(to[0]-from[0]);}
function linearVisit(x){for(let i=1;i<PATH.length;i++){const a=PATH[i-1],b=PATH[i];if(x<=a[1]&&x>=b[1])return a[0]+(b[0]-a[0])*(a[1]-x)/(a[1]-b[1]);}return x>27?PATH[0][0]:PATH.at(-1)[0];}
const slopes=PATH.slice(1).map((p,i)=>(p[1]-PATH[i][1])/(p[0]-PATH[i][0]));
const slopeChanges=PATH.map((_,i)=>(slopes[i]||0)-(slopes[i-1]||0));
// Integrating a smooth velocity transition rounds each corner of the old path.
// This positive-kernel smoothing keeps forward motion and its acceleration beat;
// position, velocity and acceleration all join continuously, without stops at knots.
function roundedHinge(u,w){if(u<=-w)return 0;if(u>=w)return u;const z=(u+w)/(2*w);return 2*w*(z*z*z-.5*z*z*z*z);}
function position(phase,softness=0){
 const w=.06*clamp(softness);if(!w)return linearPosition(phase);
 if(phase<=PATH[0][0]-w)return PATH[0][1];if(phase>=PATH.at(-1)[0]+w)return PATH.at(-1)[1];
 return PATH[0][1]+PATH.reduce((sum,p,i)=>sum+slopeChanges[i]*roundedHinge(phase-p[0],w),0);
}
const arrivalCache=new Map();
function visit(x,softness=0){
 const amount=clamp(softness);if(!amount)return linearVisit(x);
 let cache=arrivalCache.get(amount);
 if(!cache){cache=new Map();arrivalCache.set(amount,cache);if(arrivalCache.size>32)arrivalCache.delete(arrivalCache.keys().next().value);}
 if(cache.has(x))return cache.get(x);
 let lo=PATH[0][0]-.06*amount,hi=PATH.at(-1)[0]+.06*amount;
 if(x>=PATH[0][1])hi=lo;else if(x<=PATH.at(-1)[1])lo=hi;
 // Residual stars must start after the softened head actually passes this lamp.
 for(let i=0;i<36&&hi>lo;i++){const mid=(lo+hi)/2;if(position(mid,amount)>x)lo=mid;else hi=mid;}
 const arrival=(lo+hi)/2;cache.set(x,arrival);if(cache.size>1024)cache.delete(cache.keys().next().value);return arrival;
}
const DEFAULTS={period:1.1,headWidth:6,starDensity:.09,starLife:.8,starBrightness:.85,starGap:0,starWidth:8};
function motion(l){
 const o=l.tuning||{},settings={softness:o.motionSoftness??0,start:o.motionStart??1,middle:o.motionMiddle??1,end:o.motionEnd??1,peak:o.motionPeak??.5};
 const api=root.StudioSweepMotion||(typeof require==='function'?require('./studio-sweep-motion.js'):null);
 if(api)return api.create(settings,position,visit);
 return {position:p=>position(p,settings.softness),visit:x=>visit(x,settings.softness),speed:p=>(position(p+1e-5,settings.softness)-position(p-1e-5,settings.softness))/2e-5};
}
function fullness(y,upper=1,middle=1,lower=1){const f=clamp(y)*2;return f<=1?upper+(middle-upper)*smooth(f):middle+(lower-middle)*smooth(f-1);}
function space(positions){return positions?.length?{left:Math.min(...positions.map(p=>p.x)),right:Math.max(...positions.map(p=>p.x)),top:Math.min(...positions.map(p=>p.y)),bottom:Math.max(...positions.map(p=>p.y))}:{left:0,right:26,top:0,bottom:7};}
function travelCoordinate(x,y,o,bounds){
 const direction=o.direction??0,tilt=o.tilt??0;if(!direction&&!tilt)return x;
 const tiltSlope=Math.tan(tilt*Math.PI/180),midY=(bounds.top+bounds.bottom)/2,midX=(bounds.left+bounds.right)/2;
 if(direction<2){const shifted=x+tiltSlope*(y-midY);return direction===1?bounds.left+bounds.right-shifted:shifted;}
 const shifted=y+tiltSlope*(x-midX),u=(shifted-bounds.top)/Math.max(1e-6,bounds.bottom-bounds.top),span=bounds.right-bounds.left;
 return bounds.left+(direction===2?1-u:u)*span;
}
function followDelay(l,o,curve,bounds){
 if(l.starFollow!=='path-v1'||!o.starGap)return 0;
 const start=-.18-.06*(o.motionSoftness??0),end=.6+.06*(o.motionSoftness??0),average=curve.averageSpeed||(curve.position(start)-curve.position(end))/(end-start);
 const scale=(o.direction??0)>=2?(bounds.right-bounds.left)/Math.max(1e-6,bounds.bottom-bounds.top):1;
 return o.starGap*scale/average;
}
function parts(l,x,y,t,context){const o=context?.options||{...DEFAULTS,...l.tuning},curve=context?.curve||motion(l),bounds=context?.bounds||space(),qx=travelCoordinate(x,y,o,bounds),fy=(y-bounds.top)/Math.max(1e-6,bounds.bottom-bounds.top),headFull=fullness(fy,o.headUpper,o.headMiddle,o.headLower),starFull=fullness(fy,o.starUpper,o.starMiddle,o.starLower),clock=t*l.speed/o.period,cycle=Math.floor(clock),phase=fract(clock),entry=phase>=.82,p=entry?phase-1:phase,k=entry?cycle+1:cycle;
 let core=0;
 if((phase<.65||entry)&&headFull>0){const center=curve.position(p),edge=.48*Math.sin(y*2.1+k*1.7)+.2*Math.sin(y*3.6+phase*6),dx=(qx-center-edge)/(o.headWidth/2.5*headFull),g=Math.exp(-.5*dx*dx),shape=Math.pow(smooth((g-.12)/.88),.65),profile=.73+.27*Math.sin(y*1.2+k*.8)**2;
 const envelope=entry?smooth((phase-.82)/.18):1-smooth((phase-.52)/.13);core=shape*profile*envelope;
 }
 // Discrete short pulses after passage, with zero between pulses and no persistent ambient light.
 // Follow the same real lamp positions later in time. Translating an already
 // clipped array leaves a permanent empty strip at the destination edge.
 const delay=context?.delay??followDelay(l,o,curve,bounds),pixel=Math.round(x*11)+Math.round(y*47),arrival=curve.visit(qx)+delay;let stars=0;
 // Short trails retain the original sampling window and arithmetic for existing INO files.
 // Long trails visit only births whose maximum lifetime can overlap this instant. At the
 // supported 8-second / 0.6-second limits this is at most 14 births, independent of time.
 const long=o.starLife>1,bounded=long||delay>0,first=bounded?Math.ceil(clock-arrival-o.starLife/o.period):cycle-1,last=bounded?Math.floor(clock-arrival-.035/o.period):cycle+1;
 for(let n=first;n<=last;n++){const key=pixel*7+n*197+l.seed*31;if(hash(key)>=clamp(o.starDensity*starFull))continue;const age=(clock-n-arrival)*o.period;
 const life=o.starLife*(.8+.2*hash(key+9));if(age<.035||age>life)continue;
 const a=.075+.065*hash(key+31),b=life*(.8+.15*hash(key+69));let flash=Math.max(Math.exp(-Math.pow((age-a)/.035,2)),Math.exp(-Math.pow((age-b)/.044,2)));
 if(long){
   // Stable, slightly irregular flashes throughout the lifetime. Only neighboring pulse
   // indices can contribute; seeking far ahead never replays an expanding event history.
   const spacing=.38+.26*hash(key+101),near=Math.floor((age-a)/spacing);
   for(let j=Math.max(1,near-1);j<=near+1;j++){
     const at=a+j*spacing+(hash(key+j*53+137)-.5)*spacing*.4;
     if(at>=life*.82)continue;
     const pulse=.85*Math.exp(-Math.pow((age-at)/(.035+.012*hash(key+j*19+173)),2));
     flash=Math.max(flash,pulse);
   }
 }
 const s=.75*flash*(1-age/life*.35)*o.starBrightness*Math.pow(1-core,2);if(s>.025)stars=Math.max(stars,s);
 }
 return {core,stars};
}
function sample(l,x,y,t){const q=parts(l,x,y,t);return clamp(Math.max(q.core,q.stars));}
const geometryCache=new Map();
function geometry(positions,gap,width,options={}){
 const direction=options.direction??0,upper=options.starUpper??1,middle=options.starMiddle??1,lower=options.starLower??1;
 const gapX=direction===0?gap:direction===1?-gap:0,gapY=direction===2?-gap:direction===3?gap:0;
 const key=JSON.stringify([gap,width,direction,upper,middle,lower,positions.map(p=>[p.x,p.y,p.row])]);
 if(geometryCache.has(key))return geometryCache.get(key);
 const rows=new Map();positions.forEach((p,i)=>{const row=p.row??Math.round(p.y);if(!rows.has(row))rows.set(row,[]);rows.get(row).push(i);});
 for(const ids of rows.values())ids.sort((a,b)=>positions[a].x-positions[b].x);
 const rowEntries=[...rows.values()].map(ids=>({ids,y:ids.reduce((s,i)=>s+positions[i].y,0)/ids.length})).sort((a,b)=>a.y-b.y),rowYs=rowEntries.map(row=>row.y),bounds=space(positions);
 const pitches=rowYs.slice(1).map((y,i)=>y-rowYs[i]).filter(v=>v>0).sort((a,b)=>a-b),pitch=pitches[Math.floor(pitches.length/2)]||1;
 // The whole tail narrows around each local column's available vertical extent.
 // The one-cell edge coverage avoids losing a narrow band between two staggered rows.
 const band=positions.map(p=>{
   const factor=fullness((p.y-bounds.top)/Math.max(1e-6,bounds.bottom-bounds.top),upper,middle,lower),localWidth=width*factor;
   if(localWidth>=8)return 1;if(localWidth<=0)return 0;
   if(direction>=2){
     const row=positions.filter(q=>Math.abs(q.y-p.y)<=.75),left=Math.min(...row.map(q=>q.x)),right=Math.max(...row.map(q=>q.x)),crossPitch=(right-left)/7||1;
     return clamp(localWidth/2+.5-Math.abs(p.x-(left+right)/2)/crossPitch);
   }
   const column=positions.filter(q=>Math.abs(q.x-p.x)<=.75),top=Math.min(...column.map(q=>q.y)),bottom=Math.max(...column.map(q=>q.y));
   return clamp(localWidth/2+.5-Math.abs(p.y-(top+bottom)/2)/pitch);
 });
 // Move existing emitters along their physical row. Fractional gaps split light only
 // between real neighboring LEDs; the portion outside the array is clipped away.
 function alongRow(ids,x){
   let hi=ids.findIndex(j=>positions[j].x>=x);
   if(hi<0){const last=ids.at(-1),previous=ids.at(-2),step=previous===undefined?1:positions[last].x-positions[previous].x,w=clamp(1-(x-positions[last].x)/step);return w>0?[[last,w]]:[];}
   if(hi===0){const first=ids[0],next=ids[1],step=next===undefined?1:positions[next].x-positions[first].x,w=clamp(1-(positions[first].x-x)/step);return w>0?[[first,w]]:[];}
   const left=ids[hi-1],right=ids[hi],mix=(x-positions[left].x)/(positions[right].x-positions[left].x);
   return [[left,1-mix],[right,mix]];
 }
 const targets=positions.map((p,i)=>{
   if(gap===0)return [[i,1]];
   const x=p.x+gapX;if(!gapY)return alongRow(rows.get(p.row??Math.round(p.y)),x);
   const y=p.y+gapY,hi=rowEntries.findIndex(row=>row.y>=y);let candidates;
   if(hi<0){const last=rowEntries.at(-1),previous=rowEntries.at(-2),step=previous?last.y-previous.y:1;candidates=[[last,clamp(1-(y-last.y)/step)]];}
   else if(hi===0){const first=rowEntries[0],next=rowEntries[1],step=next?next.y-first.y:1;candidates=[[first,clamp(1-(first.y-y)/step)]];}
   else{const a=rowEntries[hi-1],b=rowEntries[hi],mix=(y-a.y)/(b.y-a.y);candidates=[[a,1-mix],[b,mix]];}
   return candidates.flatMap(([row,weight])=>weight>0?alongRow(row.ids,x).map(([j,w])=>[j,w*weight]):[]);
 });
 const result={targets,band};geometryCache.set(key,result);if(geometryCache.size>24)geometryCache.delete(geometryCache.keys().next().value);return result;
}
function frame(l,positions,t){
 const options={...DEFAULTS,...l.tuning},curve=motion(l),bounds=space(positions),context={options,curve,bounds,delay:followDelay(l,options,curve,bounds)},values=positions.map(p=>parts(l,p.x,p.y,t,context)),gap=l.starFollow==='path-v1'?0:options.starGap,width=options.starWidth;
 if(gap===0&&width===8&&(options.starUpper??1)===1&&(options.starMiddle??1)===1&&(options.starLower??1)===1)return values.map(q=>clamp(Math.max(q.core,q.stars)));
 const stars=shapeStars(values.map(q=>q.stars),positions,gap,width,options);
 return values.map((q,i)=>clamp(Math.max(q.core,stars[i])));
}
function shapeStars(stars,positions,gap=0,width=8,options={}){
 const {targets,band}=geometry(positions,gap,width,options),shifted=new Float64Array(positions.length);
 stars.forEach((light,i)=>{if(light<=0)return;for(const [j,weight] of targets[i])shifted[j]+=light*weight;});
 return Array.from(shifted,(value,i)=>clamp(value*band[i]));
}
root.StudioReferenceSweep={DEFAULTS,PATH,position,visit,motion,sample,parts,frame,shapeStars};if(typeof module!=='undefined')module.exports=root.StudioReferenceSweep;
})(typeof window==='undefined'?globalThis:window);
