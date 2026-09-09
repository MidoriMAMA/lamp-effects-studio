(function(root){
'use strict';
const BASE_START=-.18,BASE_END=.6,ROUNDING=.06,STEPS=1024;
const caches=new WeakMap();
function option(value,fallback,min,max,name){
 if(value===undefined)return fallback;
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Invalid sweep motion '+name);
 return value;
}
function derivative(fn,t,softness,h=1e-5){return (fn(t-2*h,softness)-8*fn(t-h,softness)+8*fn(t+h,softness)-fn(t+2*h,softness))/(12*h);}
function create(options={},referencePosition,referenceVisit){
 if(typeof referencePosition!=='function'||typeof referenceVisit!=='function')throw Error('Sweep motion needs a reference position and inverse');
 const cfg={softness:option(options.softness,0,0,1,'softness'),start:option(options.start,1,.2,3,'start'),middle:option(options.middle,1,.2,3,'middle'),end:option(options.end,1,.2,3,'end'),peak:option(options.peak,.5,.15,.85,'peak')};
 let byVisit=caches.get(referencePosition);if(!byVisit){byVisit=new WeakMap();caches.set(referencePosition,byVisit);}
 let cache=byVisit.get(referenceVisit);if(!cache){cache=new Map();byVisit.set(referenceVisit,cache);}
 const key=JSON.stringify(cfg);if(cache.has(key))return cache.get(key);
 const a=BASE_START-ROUNDING*cfg.softness,b=BASE_END+ROUNDING*cfg.softness,range=b-a,first=referencePosition(a,cfg.softness),last=referencePosition(b,cfg.softness),distance=first-last;
 if(!Number.isFinite(distance)||distance<=0)throw Error('Sweep reference must travel from right to left');
 const domain=Object.freeze({start:a,end:b,first,last}),averageSpeed=distance/range;
 let result;
 // A uniform relative multiplier cancels during normalization. Delegate exactly, so old
 // frames and inverse arrival times retain their original floating-point arithmetic.
 if(cfg.start===cfg.middle&&cfg.middle===cfg.end&&cfg.peak===.5){
   result={domain,averageSpeed,position:phase=>referencePosition(phase,cfg.softness),visit:x=>referenceVisit(x,cfg.softness),speed:phase=>phase<=a||phase>=b?0:derivative(referencePosition,phase,cfg.softness)};
 }else{
   const h=1/STEPS,v=new Float64Array(STEPS+1),slopes=new Float64Array(STEPS+1),k=cfg.peak/(1-cfg.peak);
   // This smooth monotone warp takes the reference midpoint to the requested peak time.
   // Positive C2 crossfades edit early/middle/late speed without reversing motion.
   const blend=z=>z*z*z*(10+z*(-15+6*z));
   for(let i=1;i<STEPS;i++){
     const u=i*h,denominator=k+(1-k)*u,q=u/denominator,warpDerivative=k/(denominator*denominator);
     const weight=q<=.5?cfg.start+(cfg.middle-cfg.start)*blend(2*q):cfg.middle+(cfg.end-cfg.middle)*blend(2*q-1);
     v[i]=Math.max(0,-derivative(referencePosition,a+range*q,cfg.softness))*warpDerivative*weight;
   }
   // Monotone Hermite interpolation of nonnegative speed cannot create negative lobes.
   // Shared speed derivatives make the integrated position C2, including both endpoints.
   for(let i=1;i<STEPS;i++){
     const before=(v[i]-v[i-1])/h,after=(v[i+1]-v[i])/h;
     if(before*after>0)slopes[i]=2*before*after/(before+after);
   }
   const ca=new Float64Array(STEPS),cb=new Float64Array(STEPS),cc=new Float64Array(STEPS),cd=new Float64Array(STEPS),area=new Float64Array(STEPS+1);
   for(let i=0;i<STEPS;i++){
     ca[i]=2*(v[i]-v[i+1])+h*(slopes[i]+slopes[i+1]);
     cb[i]=3*(v[i+1]-v[i])-h*(2*slopes[i]+slopes[i+1]);
     cc[i]=h*slopes[i];cd[i]=v[i];
     area[i+1]=area[i]+h*(ca[i]/4+cb[i]/3+cc[i]/2+cd[i]);
   }
   if(!(area[STEPS]>0))throw Error('Sweep reference has no moving interval');
   const scale=distance/area[STEPS],integral=(i,z)=>h*z*(cd[i]+z*(cc[i]/2+z*(cb[i]/3+z*ca[i]/4)));
   const index=phase=>{const u=(phase-a)/range*STEPS,i=Math.min(STEPS-1,Math.max(0,Math.floor(u)));return [i,u-i];};
   const position=phase=>{if(phase<=a)return first;if(phase>=b)return last;const [i,z]=index(phase);return first-scale*(area[i]+integral(i,z));};
   const speed=phase=>{if(phase<=a||phase>=b)return 0;const [i,z]=index(phase);return -scale/range*Math.max(0,((ca[i]*z+cb[i])*z+cc[i])*z+cd[i]);};
   const arrivals=new Map();
   const visit=x=>{
     if(x>=first)return a;if(x<=last)return b;if(arrivals.has(x))return arrivals.get(x);
     const target=(first-x)/scale;let lo=0,hi=STEPS;
     while(hi-lo>1){const mid=(lo+hi)>>1;if(area[mid]>target)hi=mid;else lo=mid;}
     let lower=0,upper=1;const remaining=target-area[lo];
     for(let i=0;i<34;i++){const z=(lower+upper)/2;if(integral(lo,z)>remaining)upper=z;else lower=z;}
     const phase=a+(lo+(lower+upper)/2)*h*range;
     arrivals.set(x,phase);if(arrivals.size>1024)arrivals.delete(arrivals.keys().next().value);return phase;
   };
   result={domain,averageSpeed,position,visit,speed};
 }
 Object.freeze(result);cache.set(key,result);if(cache.size>32)cache.delete(cache.keys().next().value);return result;
}
root.StudioSweepMotion={create};if(typeof module!=='undefined')module.exports=root.StudioSweepMotion;
})(typeof window==='undefined'?globalThis:window);
