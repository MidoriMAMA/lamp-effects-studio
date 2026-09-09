(function(root){
'use strict';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const fade=x=>x*x*x*(x*(x*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;

// Integer lattice noise has no per-column bias or accumulated simulation state.
// Quintic interpolation keeps a gust continuous across space and time boundaries.
function hash(x,y,seed){
 let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1442695041);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295*2-1;
}
function noise1(t,seed){
 const i=Math.floor(t);
 return mix(hash(i,0,seed),hash(i+1,0,seed),fade(t-i));
}
function noise2(x,t,seed){
 const ix=Math.floor(x),it=Math.floor(t),fx=fade(x-ix),ft=fade(t-it);
 return mix(mix(hash(ix,it,seed),hash(ix+1,it,seed),fx),
            mix(hash(ix,it+1,seed),hash(ix+1,it+1,seed),fx),ft);
}

// Heights are in unscaled lamp rows, tied to the original horizontal position.
// Wind may bend the tongues above this contour without sliding the contour itself.
function baseHeightAt(l,x,o){
 const fallback=o.height??2.8;
 if(l.flameBase!=='level-v1')return fallback;
 const left=o.baseLeft??fallback,middle=o.baseMiddle??fallback,right=o.baseRight??fallback;
 const u=clamp(x/27)*2;
 return u<=1?mix(left,middle,fade(u)):mix(middle,right,fade(u-1));
}
function baseline(l,x,bottom){
 return l.flameBase==='level-v1'?7:bottom(x);
}

// q is already effect time (seconds * layer speed * effect frequency).
// Missing new options intentionally mean legacy behavior for saved projects.
function windAt(l,x,q,o){
 if(!(o.randomWind>0))return o.wind;
 const seed=l.seed|0,frequency=o.windFrequency??.65,strength=o.windStrength??.8;
 const gust=.78*noise1(q*frequency*.72,seed^0x35bc7a21)
             +.22*noise2(x/(o.width*3+4),q*frequency*1.33,seed^0x6a09e667);
 return o.wind+strength*gust;
}
function coordinate(l,x,dist,q,o){
 // Keep the original fixed wind. A changing gust bends the tip more strongly
 // than the lower body, and never translates the bottom edge or its fuel roots.
 const base=x+dist*o.wind*.4;
 if(!(o.randomWind>0))return base;
 const bend=.2+.075*Math.max(0,Math.min(8,dist));
 return base+dist*(windAt(l,x,q,o)-o.wind)*bend;
}
function height(l,wind,q,o,base=o.height){
 const amplitude=o.randomFlicker??0;
 if(!(amplitude>0))return (base+o.flicker*(1.25*Math.sin(wind*1.6/o.width+q*3.1)
                                            +.85*Math.sin(wind*3.8/o.width-q*5.3)))*l.scale;
 const seed=l.seed|0,s=wind/o.width;
 // Retain the flicker amplitude while letting slow local drift loosen its beat.
 const phase=amplitude*.6*noise2(s*.31-q*.05,q*.43,seed^0x165667b1);
 const original=base+o.flicker*(1.25*Math.sin(wind*1.6/o.width+q*3.1+phase)
                                  +.85*Math.sin(wind*3.8/o.width-q*5.3-phase*.79));
 // Different advected scales exchange the tall and short tongues over time.
 // The coarse field raises groups; the finer fields break them into local tips.
 const tongues=.58*noise2(s*.62-q*.16,q*.83,seed^0x1b873593)
                +.27*noise2(s*1.31+q*.21,q*1.61,seed^0x5bd1e995)
                +.15*noise2(s*.23-q*.07,q*.37,seed^0x27d4eb2d);
 return (original+amplitude*1.8*tongues)*l.scale;
}
function heightAt(l,x,q,o,dist=0){
 return height(l,coordinate(l,x,dist,q,o),q,o,l.flameBase==='level-v1'?baseHeightAt(l,x,o):o.height);
}
function amount(l,x,y,q,o,bottom){
 if(l.flameBase!=='level-v1'&&!(o.randomWind>0)&&!(o.randomFlicker>0)){
  // Preserve the exact operation order of the original StudioTuning formula.
  const dist=bottom(x)-y,wind=x+dist*o.wind*.4,h=(o.height+o.flicker*(1.25*Math.sin(wind*1.6/o.width+q*3.1)+.85*Math.sin(wind*3.8/o.width-q*5.3)))*l.scale;
  return smooth((h-dist)/1.8)*(.75+.25*Math.sin(wind*1.5-q*8+dist*.9)**2);
 }
 const dist=baseline(l,x,bottom)-y,wind=coordinate(l,x,dist,q,o);
 const base=l.flameBase==='level-v1'?baseHeightAt(l,x,o):o.height,h=height(l,wind,q,o,base);
 const flame=smooth((h-dist)/1.8)*(.75+.25*Math.sin(wind*1.5-q*8+dist*.9)**2);
 // Fuel follows the generating baseline, including where no physical lamp exists.
 // A short column must not create a new elevated root in the level-baseline mode.
 const fuel=.52*smooth(base*l.scale/1.2)*Math.exp(-Math.max(0,dist)/(.32+.12*l.scale));
 return flame+(1-flame)*fuel;
}

root.StudioFlame={amount,windAt,heightAt,baseHeightAt,baseline};
if(typeof module!=='undefined')module.exports=root.StudioFlame;
})(typeof window==='undefined'?globalThis:window);
