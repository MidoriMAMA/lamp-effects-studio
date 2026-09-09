(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.StudioAlgorithmFlame=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ROWS=[28,28,27,26,26,25,22,17];
 const CANONICAL=ROWS.flatMap((length,y)=>Array.from({length},(_,x)=>({x,y})));

 // Included once inside namespace LampEffect by the enclosing exporter.
 // All arithmetic is double; the lattice hash uses explicitly unsigned 32-bit
 // products, including the JS ToUint32 conversion of negative lattice indices.
 const sharedCode=`namespace flame_runtime {
struct flameConfig {
  double speed, scale, height, width, frequency, flicker, wind, upper, lower;
  double randomWind, windStrength, windFrequency, randomFlicker;
  double baseLeft, baseMiddle, baseRight;
  uint32_t seed;
  uint8_t level, raw;
};
static const uint8_t flameRows[8] = {28,28,27,26,26,25,22,17};
static double flameClamp(double x) { return std::max(0.0, std::min(1.0, x)); }
static double flameSmooth(double x) { x=flameClamp(x); return x*x*(3.0-2.0*x); }
static double flameFade(double x) { return x*x*x*(x*(x*6.0-15.0)+10.0); }
static double flameMix(double a,double b,double t) { return a+(b-a)*t; }
static double flameSquare(double x) { return x*x; }
static uint32_t flameWord(double x) {
  if(x>=-2147483648.0 && x<=2147483647.0)
    return static_cast<uint32_t>(static_cast<int32_t>(x));
  double n=std::fmod(std::trunc(x),4294967296.0);
  if(n<0.0) n+=4294967296.0;
  return static_cast<uint32_t>(n);
}
static double flameHash(double x,double y,uint32_t seed) {
  uint32_t h=flameWord(x)*374761393u ^ flameWord(y)*668265263u ^ seed*1442695041u;
  h=(h^(h>>13))*1274126177u;
  return static_cast<double>(h^(h>>16))/4294967295.0*2.0-1.0;
}
static double flameNoise1(double t,uint32_t seed) {
  const double i=std::floor(t);
  return flameMix(flameHash(i,0.0,seed),flameHash(i+1.0,0.0,seed),flameFade(t-i));
}
static double flameNoise2(double x,double t,uint32_t seed) {
  const double ix=std::floor(x),it=std::floor(t);
  const double fx=flameFade(x-ix),ft=flameFade(t-it);
  return flameMix(flameMix(flameHash(ix,it,seed),flameHash(ix+1.0,it,seed),fx),
                  flameMix(flameHash(ix,it+1.0,seed),flameHash(ix+1.0,it+1.0,seed),fx),ft);
}
static bool flameLogicalPosition(uint16_t i,double &x,double &y) {
  for(uint8_t row=0;row<8;row++) {
    if(i<flameRows[row]) { x=i; y=row; return true; }
    i=static_cast<uint16_t>(i-flameRows[row]);
  }
  return false;
}
static double flameBottom(double x) {
  for(int row=7;row>=0;row--) if(x<flameRows[row]) return row;
  return 0.0;
}
static double flameBaseHeight(const flameConfig &c,double x) {
  if(!c.level) return c.height;
  const double u=flameClamp(x/27.0)*2.0;
  return u<=1.0 ? flameMix(c.baseLeft,c.baseMiddle,flameFade(u))
                : flameMix(c.baseMiddle,c.baseRight,flameFade(u-1.0));
}
static double flameWindAt(const flameConfig &c,double x,double q) {
  if(!(c.randomWind>0.0)) return c.wind;
  const double gust=.78*flameNoise1(q*c.windFrequency*.72,c.seed^0x35bc7a21u)
    +.22*flameNoise2(x/(c.width*3.0+4.0),q*c.windFrequency*1.33,c.seed^0x6a09e667u);
  return c.wind+c.windStrength*gust;
}
static double flameCoordinate(const flameConfig &c,double x,double dist,double q) {
  const double base=x+dist*c.wind*.4;
  if(!(c.randomWind>0.0)) return base;
  const double bend=.2+.075*std::max(0.0,std::min(8.0,dist));
  return base+dist*(flameWindAt(c,x,q)-c.wind)*bend;
}
static double flameHeight(const flameConfig &c,double wind,double q,double base) {
  const double amplitude=c.randomFlicker;
  if(!(amplitude>0.0)) {
    return (base+c.flicker*(1.25*std::sin(wind*1.6/c.width+q*3.1)
      +.85*std::sin(wind*3.8/c.width-q*5.3)))*c.scale;
  }
  const double s=wind/c.width;
  const double phase=amplitude*.6*flameNoise2(s*.31-q*.05,q*.43,c.seed^0x165667b1u);
  const double original=base+c.flicker*(1.25*std::sin(wind*1.6/c.width+q*3.1+phase)
    +.85*std::sin(wind*3.8/c.width-q*5.3-phase*.79));
  const double tongues=.58*flameNoise2(s*.62-q*.16,q*.83,c.seed^0x1b873593u)
    +.27*flameNoise2(s*1.31+q*.21,q*1.61,c.seed^0x5bd1e995u)
    +.15*flameNoise2(s*.23-q*.07,q*.37,c.seed^0x27d4eb2du);
  return (original+amplitude*1.8*tongues)*c.scale;
}
static double flameSample(const flameConfig &c,double x,double y,double t) {
  // Pre-tuning projects used StudioPatterns directly. Keep their distinct
  // addition order and x coefficients instead of substituting default tuning.
  if(c.raw) {
    const double q=t*c.speed;
    const double height=(2.8+1.25*std::sin(x*.8+q*3.1)+.85*std::sin(x*1.9-q*5.3))*c.scale;
    const double dist=flameBottom(x)-y;
    return flameSmooth((height-dist)/1.8)*(.75+.25*flameSquare(std::sin(x*1.5-q*8.0+dist*.9)));
  }
  const double q=t*c.speed*c.frequency;
  double value;
  if(!c.level && !(c.randomWind>0.0) && !(c.randomFlicker>0.0)) {
    // Original tuned projects: preserve the old formula's operation order.
    const double dist=flameBottom(x)-y,wind=x+dist*c.wind*.4;
    const double height=(c.height+c.flicker*(1.25*std::sin(wind*1.6/c.width+q*3.1)
      +.85*std::sin(wind*3.8/c.width-q*5.3)))*c.scale;
    value=flameSmooth((height-dist)/1.8)*(.75+.25*flameSquare(std::sin(wind*1.5-q*8.0+dist*.9)));
  } else {
    const double dist=(c.level?7.0:flameBottom(x))-y;
    const double wind=flameCoordinate(c,x,dist,q),base=flameBaseHeight(c,x);
    const double height=flameHeight(c,wind,q,base);
    const double flame=flameSmooth((height-dist)/1.8)*(.75+.25*flameSquare(std::sin(wind*1.5-q*8.0+dist*.9)));
    const double fuel=.52*flameSmooth(base*c.scale/1.2)*std::exp(-std::max(0.0,dist)/(.32+.12*c.scale));
    value=flame+(1.0-flame)*fuel;
  }
  const double fy=flameClamp(y/7.0),fullness=c.upper*(1.0-fy)+c.lower*fy;
  return flameClamp(value*fullness);
}
} // namespace flame_runtime
`;

 function number(value,label){
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid flame '+label);
  return value;
 }
 function literal(value){
  const text=String(value);
  return /[.eE]/.test(text)?text:text+'.0';
 }
 function emit(layer,positions,id){
  if(!layer||layer.type!=='flame')throw Error('Flame algorithm emitter requires a flame layer');
  if(typeof id!=='string'||!/^[_A-Za-z][_A-Za-z0-9]*$/.test(id))throw Error('Unsafe flame algorithm identifier');
  const tuning=layer.tuning||{},hasTuning=Boolean(layer.tuning),level=layer.flameBase==='level-v1';
  const get=(key,fallback)=>number(tuning[key]??fallback,key);
  const height=get('height',2.8),frequency=get('frequency',1)||1;
  const values=[
   number(layer.speed,'speed'),number(layer.scale,'scale'),height,get('width',2),frequency,
   get('flicker',1),get('wind',0),get('upper',1),get('lower',1),get('randomWind',0),
   get('windStrength',.8),get('windFrequency',.65),get('randomFlicker',0),
   get('baseLeft',height),get('baseMiddle',height),get('baseRight',height)
  ];
  if(values[1]<=0||values[3]<=0)throw Error('Flame scale and width must be positive');
  const seed=number(layer.seed,'seed')>>>0;
  const sample='flame_'+id+'_sample',config='flame_'+id+'_config';
  const points=positions==null?CANONICAL:positions;
  if(!Array.isArray(points)||!points.length||points.length>65535)throw Error('Invalid flame positions');
  points.forEach((p,i)=>{if(!p)throw Error('Invalid flame position '+i);number(p.x,'position x');number(p.y,'position y');});
  const canonical=points.length===CANONICAL.length&&points.every((p,i)=>p.x===CANONICAL[i].x&&p.y===CANONICAL[i].y);
  let data='',lookup='',resourceBytes=136;
  if(canonical){
   lookup='  double x,y;\n  if(!flame_runtime::flameLogicalPosition(i,x,y)) return 0.0;';
  }else{
   const table='flame_'+id+'_positions';
   data='static const double '+table+'['+points.length+'][2] = {\n'+points.map(p=>'  {'+literal(p.x)+','+literal(p.y)+'}').join(',\n')+'\n};\n';
   lookup='  if(i>='+points.length+'u) return 0.0;\n  const double x='+table+'[i][0],y='+table+'[i][1];';
   resourceBytes+=points.length*16;
  }
  const code=data+'static const flame_runtime::flameConfig '+config+' = {\n  '+values.map(literal).join(',')+',\n  '+seed+'u,'+(level?1:0)+'u,'+(!hasTuning&&!level?1:0)+'u\n};\n'+
   'static double '+sample+'(uint16_t i,double t) {\n'+lookup+'\n  return flame_runtime::flameSample('+config+',x,y,t);\n}\n';
  return {sharedCode,code,sample,resourceBytes,notes:[canonical?'火焰按 8 排灯数即时计算坐标，不保存帧序列。':'火焰保留静态灯位表，不保存帧序列。']};
 }
 return {emit};
});
