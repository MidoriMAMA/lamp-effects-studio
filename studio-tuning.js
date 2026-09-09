(function(root){
'use strict';
const P=root.StudioPatterns||(typeof require==='function'?require('./studio-patterns.js'):null);
const Flame=root.StudioFlame||(typeof require==='function'?require('./studio-flame.js'):null);
const control=(key,label,min,max,step,value,unit='')=>({key,label,min,max,step,value,unit});
const frequency=()=>control('frequency','变化频率',.1,4,.05,1,'×');
const width=(value=2)=>control('width','亮区宽度',.3,8,.1,value,'灯距');
const interval=(value=8)=>control('interval','亮区间隔',2,24,.5,value,'灯距');
const full=(shape=false)=>[control('upper',shape?'上部丰满度':'上部强度',0,2,.05,1,'×'),control('lower',shape?'下部丰满度':'下部强度',0,2,.05,1,'×')];
const defs={
 whiteSweep:[control('period','重复周期',.6,2.5,.05,1.1,'秒'),control('motionStart','起步速度',.2,3,.05,1,'×'),control('motionMiddle','中段速度',.2,3,.05,1,'×'),control('motionEnd','收尾速度',.2,3,.05,1,'×'),control('motionPeak','变速重心',.15,.85,.01,.5,'进度'),{...control('motionSoftness','加减速柔和度',0,1,.05,1),legacyValue:0},{...control('direction','移动方向',0,3,1,0),kind:'select',options:[[0,'右 → 左'],[1,'左 → 右'],[2,'上 → 下'],[3,'下 → 上']]},control('tilt','倾斜角度',-60,60,1,0,'°'),control('headWidth','主光团宽度',3,10,.25,6,'灯距'),control('headUpper','上部饱满度',0,2,.05,1,'×'),control('headMiddle','中部饱满度',0,2,.05,1,'×'),control('headLower','下部饱满度',0,2,.05,1,'×'),{...control('headTwinkle','主团闪烁强度',0,1,.05,.9),legacyValue:0},control('headTwinkleRate','主团闪烁频率',1,12,.5,6,'Hz'),control('headStarDensity','主团星点密度',.2,1,.05,.8),control('headGlow','主团底光',0,.6,.01,.08),control('starGap','残星离主团距离',0,12,.25,0,'灯距'),control('starWidth','拖尾展开宽度',1,8,.25,8,'排'),control('starUpper','上部饱满度',0,2,.05,1,'×'),control('starMiddle','中部饱满度',0,2,.05,1,'×'),control('starLower','下部饱满度',0,2,.05,1,'×'),control('starDensity','残星数量',.04,1,.01,.09),control('starLife','残星消散',.2,8,.02,.8,'秒'),control('starBrightness','残星亮度',.15,.9,.05,.85,'×')],
 flow:[interval(11),width(3),frequency(),control('turbulence','流动起伏',0,2,.05,1),control('softness','边缘柔和度',.1,2,.05,1),...full(true)],
 scan:[interval(14),width(2),frequency(),control('softness','边缘柔和度',.1,2,.05,1),...full()],
 breathe:[frequency(),control('floor','最低亮度',0,.8,.02,.06),control('curve','呼吸锐度',.3,6,.1,1.8),...full()],
 ripple:[interval(8),width(1.1),frequency(),control('decay','远处衰减',0,1,.05,.15),...full()],
 particles:[control('count','粒子数量',4,64,1,32),control('spread','扩散范围',1,12,.5,6),control('trail','粒子寿命',.3,4,.1,2,'秒'),frequency(),...full()],
 flame:[control('height','基础火焰高度',.5,8,.1,2.8,'排'),control('baseLeft','左侧基础高度',0,8,.1,2.8,'排'),control('baseMiddle','中间基础高度',0,8,.1,2.8,'排'),control('baseRight','右侧基础高度',0,8,.1,2.8,'排'),width(2),frequency(),control('flicker','基础跳动幅度',0,3,.1,1),{...control('randomFlicker','随机跳动幅度',0,4,.1,1.6,'排'),legacyValue:0},control('wind','侧向风力',-2,2,.1,0),{...control('randomWind','开启随机风力',0,1,1,1),kind:'toggle',legacyValue:0},control('windStrength','随机风力强度',0,2,.1,.8,'×'),control('windFrequency','风力变化快慢',.1,3,.05,.65,'×'),...full()],
 rain:[control('density','雨滴密度',.1,1,.05,.75),control('trail','拖尾长度',1,8,.5,4,'排'),width(1),frequency(),...full()],
 comet:[control('count','彗星数量',1,8,1,3),control('trail','拖尾长度',1,20,.5,10,'灯距'),interval(13),width(.6),frequency(),...full()],
 spin:[frequency(),control('sharpness','光束锐度',1,20,.5,9),control('core','中心亮度',0,1,.05,.6),...full()],
 spiral:[frequency(),control('twist','旋臂弯曲',0,1,.05,.35),control('sharpness','旋臂锐度',1,20,.5,9),control('core','中心亮度',0,1,.05,.6),...full()],
 sparkle:[control('density','星点密度',.1,1,.05,1),frequency(),control('sharpness','闪烁锐度',2,24,1,16),...full()],
 wave:[interval(20),width(.65),frequency(),control('amplitude','波浪高度',0,4,.1,2.5,'排'),...full()],
 equalizer:[width(2),frequency(),control('height','柱条最高高度',1,8,.5,7,'排'),control('contrast','高低落差',.1,3,.1,1.4),...full()],
 strobe:[frequency(),width(2),interval(8),control('duty','每拍亮灯占比',.05,.95,.05,.35),control('rowPhase','相邻排错拍',0,1,.05,.5),...full()],
 checker:[width(2),frequency(),control('contrast','明暗反差',.2,4,.1,1),...full()],
 text:[control('gap','循环留白',0,40,1,2,'灯距'),control('textWidth','字形横向比例',.5,2,.05,1,'×'),control('stroke','笔画加粗',0,.5,.05,0,'灯距'),...full()],
 paint:[control('upper','上部亮度',0,2,.05,1,'×'),control('lower','下部亮度',0,2,.05,1,'×')],
 showcase:[{...control('zoneDirection','分区方向',0,2,1,0),kind:'select',options:[[0,'横排 →'],[1,'左斜排 ↙'],[2,'右斜排 ↘']]},control('redRows','第 1 段 · 红区厚度',1,8,1,2,'排'),control('amberRows','第 2 段 · 橙区厚度',1,8,1,2,'排'),control('red2Rows','第 3 段 · 红区厚度',1,8,1,2,'排'),control('whiteRows','第 4 段 · 白区厚度',1,8,1,2,'排'),control('bpm','节拍速度',40,240,1,120,'BPM'),control('block','亮块宽度',.08,.6,.02,.25),control('duty','每拍亮灯占比',.1,1,.05,.8),control('softness','移动柔和度',0,1,.05,.18),control('phase','分区错拍',0,1,.05,.25),control('floor','暗区底光',0,.2,.01,0),control('redLevel','红区亮度',0,1,.05,.7),control('amberLevel','橙区亮度',0,1,.05,1),control('whiteLevel','白区亮度',0,1,.05,.85),{key:'red',label:'红区颜色',value:'#ff1835',kind:'color'},{key:'amber',label:'橙区颜色',value:'#ff930c',kind:'color'},{key:'white',label:'白区颜色',value:'#e4efff',kind:'color'}]
};
function controls(l){return (defs[l.type]||[]).filter(d=>!(l.type==='flame'&&d.key==='height')&&!(l.type==='strobe'&&l.pattern==='halves'&&['width','interval','rowPhase'].includes(d.key))&&!(l.type==='strobe'&&l.pattern==='checker'&&['interval','rowPhase'].includes(d.key))&&!(l.type==='text'&&l.direction==='still'&&d.key==='gap'));}
const defaults=type=>Object.fromEntries((defs[type]||[]).map(d=>[d.key,d.value]));
function validate(type,tuning){if(!tuning||typeof tuning!=='object'||Array.isArray(tuning))throw Error('效果参数无效');const list=defs[type];if(!list)throw Error('此效果没有扩展参数');const out={};for(const [key,v] of Object.entries(tuning)){const d=list.find(d=>d.key===key);if(!d)throw Error('未知效果参数 '+key);if(d.kind==='color'){if(typeof v!=='string'||!/^#[\da-f]{6}$/i.test(v))throw Error(d.label+' 无效');}else if(typeof v!=='number'||!Number.isFinite(v)||v<d.min||v>d.max||(d.step===1&&!Number.isInteger(v)))throw Error(d.label+' 超出范围');out[key]=v;}return out;}
const clamp=x=>Math.max(0,Math.min(1,x)),fract=x=>x-Math.floor(x),mod=(x,n)=>(x%n+n)%n,smooth=x=>{x=clamp(x);return x*x*(3-2*x)},hash=x=>fract(Math.sin(x*127.1+311.7)*43758.5453);
function amount(l,x,y,t,base){
 const o={...defaults(l.type),...l.tuning},q=t*l.speed*(o.frequency||1),angle=l.angle*Math.PI/180,xx=(x-l.cx)*Math.cos(angle)+(y-l.cy)*Math.sin(angle)+l.cx,dy=y-l.cy,r=Math.hypot(x-l.cx,dy);let v=0;
 const fullness=(o.upper??1)*(1-clamp(y/7))+(o.lower??1)*clamp(y/7);
 if(l.type==='flow'){const travel=t*l.speed,phase=t*o.frequency,warp=o.turbulence*(Math.sin(y*.9-phase*.7)*1.2+Math.sin(xx*.4+y+phase*.4)*.5),d=Math.abs(mod(xx+warp-travel*3.5,o.interval)-o.interval/2),w=o.width*l.scale*fullness;return w<=0?0:smooth((w-d)/Math.max(.15,o.softness))* (.62+.38*Math.sin(y*.65+phase*.6)**2);}
 if(l.type==='scan'){const d=Math.abs(mod(xx-q*5,o.interval)-o.interval/2);v=Math.exp(-Math.pow(d/(o.width*l.scale),2/o.softness));}
 else if(l.type==='breathe')v=o.floor+(1-o.floor)*Math.pow(.5+.5*Math.sin(q*Math.PI),o.curve);
 else if(l.type==='ripple'){const d=Math.abs(mod(r-q*4+o.interval/2,o.interval)-o.interval/2);v=Math.exp(-Math.pow(d/(o.width*l.scale),2))*Math.exp(-r*o.decay*.12);}
 else if(l.type==='particles'){for(let k=0;k<o.count;k++){const age=mod(q+hash(k+l.seed)*o.trail,o.trail),a=hash(k*17+l.seed)*Math.PI*2,d=age/o.trail*o.spread,px=l.cx+Math.cos(a)*d,py=l.cy+Math.sin(a)*d*.5;v+=Math.exp(-((x-px)**2+(y-py)**2)/(.42*l.scale))*(1-age/o.trail)**2;}}
 // Missing fields keep old saved projects and their baked INO frames unchanged.
 else if(l.type==='flame')v=Flame.amount(l,x,y,q,{...o,baseLeft:l.tuning?.baseLeft??l.tuning?.height??2.8,baseMiddle:l.tuning?.baseMiddle??l.tuning?.height??2.8,baseRight:l.tuning?.baseRight??l.tuning?.height??2.8,randomWind:l.tuning?.randomWind??0,randomFlicker:l.tuning?.randomFlicker??0},P.bottom);
 else if(l.type==='rain'){const col=Math.floor(x/o.width),head=fract(q*.45+hash(col+l.seed))*(9+o.trail)-1,d=head-y;v=hash(col+l.seed*3)<o.density&&d>=0&&d<o.trail?Math.exp(-d*3/o.trail):0;}
 else if(l.type==='comet'){for(let k=0;k<o.count;k++){const head=mod(q*7+k*o.interval,28+o.trail+5)-2,d=head-xx,cy=2+Math.sin(k*2+q*.5)*2;if(d>=-.5&&d<o.trail)v+=Math.exp(-Math.max(0,d)*3/o.trail)*Math.exp(-Math.pow((y-cy)/(o.width*l.scale),2));}}
 else if(l.type==='spin'||l.type==='spiral'){const a=Math.atan2(dy,x-l.cx)-angle-q*1.4-(l.type==='spiral'?r*o.twist:0);v=Math.pow(Math.max(0,Math.cos(a*l.beams)),o.sharpness/l.scale)*(.25+.75*Math.exp(-r/18))+o.core*Math.exp(-r*r/1.2);}
 else if(l.type==='sparkle'){const h=hash(x*13+y+l.seed);v=h<o.density?Math.pow(Math.max(0,1-Math.abs(fract(q*(.2+hash(x*9+y)*.35)+h)-.5)*2),o.sharpness/l.scale):0;}
 else if(l.type==='wave'){const crest=3+Math.sin(x*Math.PI*2/o.interval-q*1.4)*o.amplitude;v=Math.exp(-Math.pow((y-crest)/(o.width*l.scale),2));}
 else if(l.type==='equalizer'){const b=Math.floor(x/o.width),h=1+(o.height-1)*Math.pow(.5+.5*Math.sin(q*(2+hash(b+l.seed))+.8+b*1.3),o.contrast);v=smooth(h-(P.bottom(x)-y));}
 else if(l.type==='strobe'){const pulse=fract(q*2);if(l.pattern==='halves')v=(x<14?0:1)===Math.floor(q*2)%2&&pulse<o.duty?1:0;else if(l.pattern==='checker')v=(Math.floor(x/o.width)+y+Math.floor(q*2))%2===0&&pulse<o.duty?1:0;else v=fract(q*2-Math.floor(x/o.width)*o.width/o.interval+(y%2)*o.rowPhase)<o.duty?1:0;}
 else if(l.type==='checker'){const bit=(Math.floor(x/o.width)+Math.floor(y/o.width))%2,b=.5+.5*Math.sin(q*3);v=Math.pow(bit?b:1-b,o.contrast);}
 else if(l.type==='text'){const bits=l.bitmap,w=bits.length,unit=l.scale*o.textWidth,period=w+o.gap+28/unit,pos=mod(q*5+(l.direction==='right'?w+2:26),period),start=l.direction==='still'||l.speed===0?l.cx-w*unit/2:l.direction==='right'?-w*unit+pos*unit:28-pos*unit;const get=(dx,dy)=>{const col=Math.floor((x+dx-start)/unit),row=Math.round((y+dy-l.cy)/l.scale+3);return col>=0&&col<w&&row>=0&&row<7&&(bits[col]&(1<<row))?1:0;};v=get(0,0);if(o.stroke>0)for(const dx of [-o.stroke,o.stroke])for(const yy of [-o.stroke,o.stroke])v=Math.max(v,get(dx,yy));}
 else v=base(l,x,y,t);
 return clamp(v*fullness);
}
const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
// Four eight-beat phrases adapt the video's linked red/amber/white blocks to this single array.
const showcaseRows=[28,28,27,26,26,25,22,17],showcaseOffsets=[0,-.5,0,.5,0,.5,0,.5];
function showcaseBand(o,x,y,layout){
 const offsets=layout?.rowOffsets||showcaseOffsets;
 let line=y,u;
 if(o.zoneDirection===0){
  const left=Math.min(...offsets),right=Math.max(...offsets.map((v,i)=>v+showcaseRows[i]-1));
  u=(x+offsets[y]-left)/(right-left);
 }else{
  // Staggered rows advance half a lamp pitch: each integer is one complete diagonal chain.
  const slope=o.zoneDirection===1?.5:-.5,starts=offsets.map((v,i)=>Math.round(v+slope*i));
  line=x+starts[y]-Math.min(...starts);u=y/7;
 }
 const widths=[o.redRows,o.amberRows,o.red2Rows,o.whiteRows];
 let at=mod(line,widths.reduce((a,b)=>a+b,0)),segment=0;
 while(segment<3&&at>=widths[segment])at-=widths[segment++];
 return {line,segment,zone:['red','amber','red','white'][segment],u};
}
function showcase(l,x,y,t,layout){const o={...defaults('showcase'),...l.tuning},beat=t*l.speed*o.bpm/60,group=Math.floor(beat/8)%4;
 const {u,zone}=showcaseBand(o,x,y,layout),offset=zone==='red'?0:zone==='amber'?o.phase:o.phase*2,b=beat-offset,step=Math.floor(b),f=fract(b),active=f<o.duty;
 const positions=[.16,.5,.84,.5,.84,.5,.16,.5],curr=positions[mod(step,8)],next=positions[mod(step+1,8)],move=o.softness?smooth((f-(1-o.softness))/o.softness):0,c=curr+(next-curr)*move;
 const block=center=>smooth((o.block/2+.025-Math.abs(u-center))/.05);let lit=0;
 if(group===0)lit=block(zone==='amber'?1-c:c);
 else if(group===1)lit=Math.max(block(c*.65),block(1-c*.65))*(zone==='red'&&mod(step,2)? .65:1);
 else if(group===2){const stage=mod(step,8);lit=stage<3?+(u<(stage+1)/3):stage===3?0:stage<7?+(u>1-(stage-3)/3):0;}
 else{const stage=mod(step,8);lit=stage===0||stage===4?1:stage===1||stage===5?Math.max(block(.18),block(.82)):stage===2||stage===6?block(.5):0;}
 const light=(active?lit:0)*(o[zone+'Level'])+o.floor*(1-lit);return rgb(o[zone]).map(c=>c*clamp(light));
}
root.StudioTuning={defs,controls,defaults,validate,amount,showcase,showcaseBand};if(typeof module!=='undefined')module.exports=root.StudioTuning;
})(typeof window==='undefined'?globalThis:window);
