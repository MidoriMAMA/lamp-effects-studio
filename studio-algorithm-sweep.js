(function(root){
'use strict';
const R=root.StudioReferenceSweep||(typeof require==='function'?require('./studio-reference-sweep.js'):null);
const clamp=x=>Math.max(0,Math.min(1,x));
const number=x=>{if(!Number.isFinite(x))throw Error('冷白星流含无效数字');return Object.is(x,-0)?'0':String(x);};
const list=values=>values.map(number).join(',');
const array=(type,name,values,columns=8)=>{
 const lines=[];for(let i=0;i<values.length;i+=columns)lines.push('  '+list(values.slice(i,i+columns)));
 return 'static const '+type+' '+name+'[] = {\n'+lines.join(',\n')+'\n};\n';
};

// C++11, included once inside the caller's namespace. The numeric noise and
// operation order deliberately match the browser's reference renderer.
const sharedCode=String.raw`
struct SweepCurve {
  double softness, start, middle, end, peak;
  double a, range, first, last, scale;
  const double *area;
};
struct SweepConfig {
  double speed, period, headWidth, density, life, brightness;
  double headUpper, headMiddle, headLower, starUpper, starMiddle, starLower;
  double top, height;
  const double (*dots)[4];
  const double *band;
  const uint16_t *offsets, *sources;
  const double *weights;
  const SweepCurve *curve;
  bool bounded;
};
struct SweepTime {
  double time, clock, phase, cycle, p, k, center;
  bool ready, entry, moving;
};
struct SweepParts { double core, stars; };
static double sweepClamp(double x) { return std::max(0.0,std::min(1.0,x)); }
static double sweepSmooth(double x) { x=sweepClamp(x);return x*x*(3-2*x); }
static double sweepSquare(double x) { return x*x; }
static double sweepHash(double x) {
  const double v=std::sin(x*127.1+311.7)*43758.5453;
  return v-std::floor(v);
}
static double sweepFullness(double y,double upper,double middle,double lower) {
  const double f=sweepClamp(y)*2;
  return f<=1?upper+(middle-upper)*sweepSmooth(f):middle+(lower-middle)*sweepSmooth(f-1);
}
static double sweepHinge(double u,double w) {
  if(u<=-w)return 0;if(u>=w)return u;
  const double z=(u+w)/(2*w);return 2*w*(z*z*z-.5*z*z*z*z);
}
static double sweepReferencePosition(double phase,double softness) {
  static const double knots[7]={-.18,-.09,0,.15,.27,.42,.60};
  static const double positions[7]={27,24.5,21.1,15.1,5.9,.8,-1};
  const double w=.06*sweepClamp(softness);
  if(!w){
    for(int i=0;i<7;++i)if(knots[i]>=phase){
      if(i==0)return positions[0];
      return positions[i-1]+(positions[i]-positions[i-1])*(phase-knots[i-1])/(knots[i]-knots[i-1]);
    }
    return positions[6];
  }
  if(phase<=knots[0]-w)return positions[0];
  if(phase>=knots[6]+w)return positions[6];
  double sum=0,previous=0;
  for(int i=0;i<7;++i){
    const double next=i<6?(positions[i+1]-positions[i])/(knots[i+1]-knots[i]):0;
    sum+=(next-previous)*sweepHinge(phase-knots[i],w);previous=next;
  }
  return positions[0]+sum;
}
static double sweepDerivative(double t,double softness) {
  const double h=1e-5;
  return (sweepReferencePosition(t-2*h,softness)-8*sweepReferencePosition(t-h,softness)
         +8*sweepReferencePosition(t+h,softness)-sweepReferencePosition(t+2*h,softness))/(12*h);
}
static double sweepBlend(double z) { return z*z*z*(10+z*(-15+6*z)); }
static double sweepVelocity(const SweepCurve &c,int i) {
  if(i<=0||i>=1024)return 0;
  const double h=1.0/1024,k=c.peak/(1-c.peak),u=i*h,den=k+(1-k)*u,q=u/den;
  const double warp=k/(den*den),weight=q<=.5?c.start+(c.middle-c.start)*sweepBlend(2*q)
                                                        :c.middle+(c.end-c.middle)*sweepBlend(2*q-1);
  return std::max(0.0,-sweepDerivative(c.a+c.range*q,c.softness))*warp*weight;
}
static double sweepVelocitySlope(const SweepCurve &c,int i) {
  if(i<=0||i>=1024)return 0;
  const double h=1.0/1024,v=sweepVelocity(c,i);
  const double before=(v-sweepVelocity(c,i-1))/h,after=(sweepVelocity(c,i+1)-v)/h;
  return before*after>0?2*before*after/(before+after):0;
}
static double sweepPosition(const SweepCurve &c,double phase) {
  if(!c.area)return sweepReferencePosition(phase,c.softness);
  if(phase<=c.a)return c.first;if(phase>=c.a+c.range)return c.last;
  const double h=1.0/1024,u=(phase-c.a)/c.range*1024;
  const int i=std::min(1023,std::max(0,int(std::floor(u))));
  const double z=u-i,v0=sweepVelocity(c,i),v1=sweepVelocity(c,i+1);
  const double s0=sweepVelocitySlope(c,i),s1=sweepVelocitySlope(c,i+1);
  const double a=2*(v0-v1)+h*(s0+s1),b=3*(v1-v0)-h*(2*s0+s1),cc=h*s0,d=v0;
  const double integral=h*z*(d+z*(cc/2+z*(b/3+z*a/4)));
  return c.first-c.scale*(c.area[i]+integral);
}
static const SweepTime &sweepTime(const SweepConfig &c,SweepTime &s,double t) {
  if(s.ready&&s.time==t)return s;
  s.ready=true;s.time=t;s.clock=t*c.speed/c.period;s.cycle=std::floor(s.clock);
  s.phase=s.clock-s.cycle;s.entry=s.phase>=.82;s.p=s.entry?s.phase-1:s.phase;
  s.k=s.entry?s.cycle+1:s.cycle;s.moving=s.phase<.65||s.entry;
  s.center=s.moving?sweepPosition(*c.curve,s.p):0;
  return s;
}
static SweepParts sweepParts(const SweepConfig &c,uint16_t i,const SweepTime &s) {
  const double *dot=c.dots[i],y=dot[0],x=dot[1],arrival=dot[2];
  const double fy=(y-c.top)/c.height;
  const double headFull=sweepFullness(fy,c.headUpper,c.headMiddle,c.headLower);
  const double starFull=sweepFullness(fy,c.starUpper,c.starMiddle,c.starLower);
  SweepParts result={0,0};
  if(s.moving&&headFull>0){
    const double edge=.48*std::sin(y*2.1+s.k*1.7)+.2*std::sin(y*3.6+s.phase*6);
    const double dx=(x-s.center-edge)/(c.headWidth/2.5*headFull),g=std::exp(-.5*dx*dx);
    const double shape=std::pow(sweepSmooth((g-.12)/.88),.65);
    const double profile=.73+.27*sweepSquare(std::sin(y*1.2+s.k*.8));
    const double envelope=s.entry?sweepSmooth((s.phase-.82)/.18):1-sweepSmooth((s.phase-.52)/.13);
    result.core=shape*profile*envelope;
  }
  const int first=c.bounded?int(std::ceil(s.clock-arrival-c.life/c.period)):int(s.cycle)-1;
  const int last=c.bounded?int(std::floor(s.clock-arrival-.035/c.period)):int(s.cycle)+1;
  for(int n=first;n<=last;++n){
    const double key=dot[3]+n*197;
    if(sweepHash(key)>=sweepClamp(c.density*starFull))continue;
    const double age=(s.clock-n-arrival)*c.period;
    const double life=c.life*(.8+.2*sweepHash(key+9));
    if(age<.035||age>life)continue;
    const double a=.075+.065*sweepHash(key+31),b=life*(.8+.15*sweepHash(key+69));
    double flash=std::max(std::exp(-sweepSquare((age-a)/.035)),std::exp(-sweepSquare((age-b)/.044)));
    if(c.life>1){
      const double spacing=.38+.26*sweepHash(key+101);
      const int near=int(std::floor((age-a)/spacing));
      for(int j=std::max(1,near-1);j<=near+1;++j){
        const double at=a+j*spacing+(sweepHash(key+j*53+137)-.5)*spacing*.4;
        if(at>=life*.82)continue;
        const double pulse=.85*std::exp(-sweepSquare((age-at)/(.035+.012*sweepHash(key+j*19+173))));
        flash=std::max(flash,pulse);
      }
    }
    const double star=.75*flash*(1-age/life*.35)*c.brightness*sweepSquare(1-result.core);
    if(star>.025)result.stars=std::max(result.stars,star);
  }
  return result;
}
static double sweepSample(const SweepConfig &c,SweepTime &state,uint16_t i,double t) {
  const SweepTime &s=sweepTime(c,state,t);
  const SweepParts own=sweepParts(c,i,s);double stars=own.stars;
  if(c.offsets){
    stars=0;
    for(uint16_t k=c.offsets[i];k<c.offsets[i+1];++k){
      const uint16_t source=c.sources[k];
      stars+=(source==i?own.stars:sweepParts(c,source,s).stars)*c.weights[k];
    }
  }
  if(c.band)stars*=c.band[i];
  return sweepClamp(std::max(own.core,sweepClamp(stars)));
}
`;

function curveResource(l,id){
 const o=l.tuning||{},softness=o.motionSoftness??0,start=o.motionStart??1,middle=o.motionMiddle??1,end=o.motionEnd??1,peak=o.motionPeak??.5;
 const cfg={softness,start,middle,end,peak},a=-.18-.06*softness,b=.6+.06*softness,range=b-a;
 const first=R.position(a,softness),last=R.position(b,softness);
 let code='',resourceBytes=10*8,areaName='nullptr',scale=0;
 if(!(start===middle&&middle===end&&peak===.5)){
  const steps=1024,h=1/steps,v=new Float64Array(steps+1),slopes=new Float64Array(steps+1),area=new Float64Array(steps+1),k=peak/(1-peak);
  const derivative=t=>{const d=1e-5;return (R.position(t-2*d,softness)-8*R.position(t-d,softness)+8*R.position(t+d,softness)-R.position(t+2*d,softness))/(12*d);};
  const blend=z=>z*z*z*(10+z*(-15+6*z));
  for(let i=1;i<steps;i++){
   const u=i*h,den=k+(1-k)*u,q=u/den,warp=k/(den*den),weight=q<=.5?start+(middle-start)*blend(2*q):middle+(end-middle)*blend(2*q-1);
   v[i]=Math.max(0,-derivative(a+range*q))*warp*weight;
  }
  for(let i=1;i<steps;i++){
   const before=(v[i]-v[i-1])/h,after=(v[i+1]-v[i])/h;
   if(before*after>0)slopes[i]=2*before*after/(before+after);
  }
  for(let i=0;i<steps;i++){
   const ca=2*(v[i]-v[i+1])+h*(slopes[i]+slopes[i+1]),cb=3*(v[i+1]-v[i])-h*(2*slopes[i]+slopes[i+1]),cc=h*slopes[i],cd=v[i];
   area[i+1]=area[i]+h*(ca/4+cb/3+cc/2+cd);
  }
  scale=(first-last)/area[steps];areaName=id+'_sweepArea';code+=array('double',areaName,Array.from(area));resourceBytes+=area.byteLength;
 }
 code+='static const SweepCurve '+id+'_sweepCurve = {'+list([softness,start,middle,end,peak,a,range,first,last,scale])+','+areaName+'};\n';
 return {code,resourceBytes,cfg};
}
function emit(layer,positions,id){
 if(!R)throw Error('冷白星流模块尚未载入');
 if(!/^[A-Za-z_]\w*$/.test(id))throw Error('无效导出标识');
 if(!Array.isArray(positions)||positions.length!==199||positions.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('冷白星流需要199个有效灯位');
 const o={...R.DEFAULTS,...layer.tuning},curve=R.motion(layer);
 const bounds={left:Math.min(...positions.map(p=>p.x)),right:Math.max(...positions.map(p=>p.x)),top:Math.min(...positions.map(p=>p.y)),bottom:Math.max(...positions.map(p=>p.y))};
 const direction=o.direction??0,tilt=o.tilt??0;
 const transform=p=>{
  if(!direction&&!tilt)return p.x;
  const slope=Math.tan(tilt*Math.PI/180),midY=(bounds.top+bounds.bottom)/2,midX=(bounds.left+bounds.right)/2;
  if(direction<2){const shifted=p.x+slope*(p.y-midY);return direction===1?bounds.left+bounds.right-shifted:shifted;}
  const shifted=p.y+slope*(p.x-midX),u=(shifted-bounds.top)/Math.max(1e-6,bounds.bottom-bounds.top),span=bounds.right-bounds.left;
  return bounds.left+(direction===2?1-u:u)*span;
 };
 let delay=0;
 if(layer.starFollow==='path-v1'&&o.starGap){
  const a=-.18-.06*(o.motionSoftness??0),b=.6+.06*(o.motionSoftness??0),average=curve.averageSpeed||(curve.position(a)-curve.position(b))/(b-a);
  const scale=direction>=2?(bounds.right-bounds.left)/Math.max(1e-6,bounds.bottom-bounds.top):1;
  delay=o.starGap*scale/average;
 }
 const dots=positions.map(p=>{const x=transform(p),pixel=Math.round(p.x*11)+Math.round(p.y*47);return [p.y,x,curve.visit(x)+delay,pixel*7+layer.seed*31];});
 const cr=curveResource(layer,id);let code=cr.code,resourceBytes=cr.resourceBytes+dots.length*4*8;
 code+='static const double '+id+'_sweepDots[199][4] = {\n'+dots.map(p=>'  {'+list(p)+'}').join(',\n')+'\n};\n';
 const gap=layer.starFollow==='path-v1'?0:o.starGap;
 const band=R.shapeStars(Array(199).fill(1),positions,0,o.starWidth,o);
 let bandName='nullptr',offsetName='nullptr',sourceName='nullptr',weightName='nullptr';
 if(band.some(v=>v!==1)){bandName=id+'_sweepBand';code+=array('double',bandName,band);resourceBytes+=band.length*8;}
 if(gap!==0){
  const reverse=Array.from({length:199},()=>[]),full={...o,starUpper:1,starMiddle:1,starLower:1};
  for(let source=0;source<199;source++){
   const values=Array(199).fill(0);values[source]=1;
   const weights=R.shapeStars(values,positions,gap,8,full);
   weights.forEach((weight,i)=>{if(weight>0)reverse[i].push([source,weight]);});
  }
  const offsets=[0],sources=[],weights=[];
  for(const row of reverse){for(const [source,weight] of row){sources.push(source);weights.push(weight);}offsets.push(sources.length);}
  // Standard C++ has no zero-length array; an empty transfer map still needs an offset table.
  offsetName=id+'_sweepOffsets';sourceName=id+'_sweepSources';weightName=id+'_sweepWeights';
  code+=array('uint16_t',offsetName,offsets)+array('uint16_t',sourceName,sources.length?sources:[0])+array('double',weightName,weights.length?weights:[0]);
  resourceBytes+=offsets.length*2+Math.max(1,sources.length)*2+Math.max(1,weights.length)*8;
 }
 const config=[layer.speed,o.period,o.headWidth,o.starDensity,o.starLife,o.starBrightness,o.headUpper??1,o.headMiddle??1,o.headLower??1,o.starUpper??1,o.starMiddle??1,o.starLower??1,bounds.top,Math.max(1e-6,bounds.bottom-bounds.top)];
 resourceBytes+=config.length*8+1;
 code+='static const SweepConfig '+id+'_sweepConfig = {'+list(config)+','+id+'_sweepDots,'+bandName+','+offsetName+','+sourceName+','+weightName+',&'+id+'_sweepCurve,'+(o.starLife>1||delay>0?'true':'false')+'};\n';
 const sample=id+'_sweepSample';
 code+='static double '+sample+'(uint16_t i,double t) {\n  static SweepTime state={};\n  return sweepSample('+id+'_sweepConfig,state,i,t);\n}\n';
 return {sharedCode,code,sample,resourceBytes,notes:['冷白星流资源统计为静态数值净数据，不含指针、对齐及编译器代码；每层另有一份固定时间上下文。','保留 double 和原 sin 随机函数；目标设备数学库仍需逐帧验证。']};
}
root.StudioAlgorithmSweep={emit};
if(typeof module!=='undefined')module.exports=root.StudioAlgorithmSweep;
})(typeof window==='undefined'?globalThis:window);
