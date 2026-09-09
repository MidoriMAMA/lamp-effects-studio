(function(root){
'use strict';
// A stateless star field in coordinates carried by the moving head.
// The caller supplies physical LED pitches, continuous seconds and a pass seed.
// Keep arithmetic in step with the C++ export; no frame count or mutable RNG state.
const DEFAULTS=Object.freeze({headTwinkle:.9,headTwinkleRate:6,headStarDensity:.8,headGlow:.08});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function hash32(value){
 let x=value>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d)>>>0;
 x=Math.imul(x^(x>>>15),0x846ca68b)>>>0;
 return (x^(x>>>16))>>>0;
}
function factor(along,across,time,seed,options={}){
 // Missing strength means an older project: preserve its original head exactly.
 const amount=clamp(options.headTwinkle??0);
 if(amount===0)return 1;
 if(!Number.isFinite(along)||!Number.isFinite(across)||!Number.isFinite(time))return 0;
 const rate=Math.max(1,Math.min(12,options.headTwinkleRate??DEFAULTS.headTwinkleRate));
 const density=Math.max(.2,Math.min(1,options.headStarDensity??DEFAULTS.headStarDensity));
 const glow=Math.max(0,Math.min(.6,options.headGlow??DEFAULTS.headGlow));
 const pitch=.94,cx=Math.floor(along/pitch),cy=Math.floor(across/pitch),baseSeed=seed>>>0;
 let stars=0;
 // Radius <= .82 and jitter <= .28 cell, so this 3x3 neighborhood is complete.
 // Compact smooth footprints disappear before a star leaves the neighborhood.
 for(let iy=cy-1;iy<=cy+1;iy++)for(let ix=cx-1;ix<=cx+1;ix++){
  const key=hash32(Math.imul(ix,0x1f123bb5)^Math.imul(iy,0x5f356495)^baseSeed);
  if((key>>>8)/16777216>=density)continue;
  const hx=hash32((key+0x9e3779b9)>>>0),hy=hash32((key+0x68bc21eb)>>>0);
  const hz=hash32((key+0x02e5be93)>>>0);
  const x=(ix+.5+((hx&65535)/65536-.5)*.56)*pitch;
  const y=(iy+.5+((hy&65535)/65536-.5)*.56)*pitch;
  const radius=.62+.2*(hz&65535)/65536;
  const dx=along-x,dy=across-y,coverage=1-(dx*dx+dy*dy)/(radius*radius);
  if(coverage<=0)continue;
  const footprint=smooth(coverage);
  const clock=time*rate*(.65+.5*(hx>>>16)/65536)+(hy>>>16)/65536;
  const phase=clock-Math.floor(clock);
  // Independent phase/rate: quick smooth rise, longer smooth fall, then darkness.
  const pulse=phase<.09?smooth(phase/.09):1-smooth((phase-.09)/.43);
  const sparkle=footprint*(.07+.93*pulse)*(.85+.45*(hz>>>16)/65536);
  stars=Math.max(stars,sparkle);
 }
 // Use a maximum, not an additive wash: increasing density adds distinct stars.
 // Glow lifts only dark gaps and cannot dim a bright star or create a hot slab.
 const field=Math.max(glow,Math.min(1.5,stars*1.35));
 return 1-amount+amount*field;
}
root.StudioHeadStars={DEFAULTS,factor};
if(typeof module!=='undefined')module.exports=root.StudioHeadStars;
})(typeof globalThis!=='undefined'?globalThis:this);
