(function(root){
'use strict';
const P=root.StudioPatterns||(typeof require==='function'?require('./studio-patterns.js'):null);
const T=root.StudioTuning||(typeof require==='function'?require('./studio-tuning.js'):null);
const Trails=root.StudioTrails||(typeof require==='function'?require('./studio-trails.js'):null);
const Reference=root.StudioReferenceSweep||(typeof require==='function'?require('./studio-reference-sweep.js'):null);
const ROWS=[28,28,27,26,26,25,22,17],COUNT=199,TYPES=['flow','scan','breathe','ripple','particles','paint','legacy',...Object.keys(P.NAMES)];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const hash=n=>{let x=(n|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const clone=x=>JSON.parse(JSON.stringify(x));
const DEFAULT_LAYOUT={version:1,rowGap:1,rowOffsets:[0,-.5,0,.5,0,.5,0,.5]};
function gridPosition(pt,layout=DEFAULT_LAYOUT){return {x:pt.lx+layout.rowOffsets[pt.ly],y:pt.ly*layout.rowGap};}
function displayPosition(pt,layout){if(!layout)return {x:pt.x,y:pt.y};if(pt.kind==='control'){const q=gridPosition(pt,layout);return {x:407+q.x*47,y:448+q.y*47};}const row=pt.row-3,starts=[-2,-2.5,-2,-2.5,-2,-1.5,-2,-1.5,-2,-1.5,-1,-.5,0];const start=row>=0&&row<8?layout.rowOffsets[row]-2:starts[pt.row-1];return {x:407+(start+pt.column-1)*47,y:448+row*layout.rowGap*47};}
// A single scale on both axes preserves angles and aspect ratio in the reference plane.
function physicalPosition(pt){return {x:(pt.x-385)/47,y:(pt.y-448)/47};}
function mapping(layout){let list=layout.filter(p=>p.kind==='control').sort((a,b)=>a.id-b.id);if(list.length!==COUNT)throw Error('灯位数量必须为 199');let offset=0;ROWS.forEach((n,y)=>{const row=list.filter(p=>p.row===y+3).sort((a,b)=>a.x-b.x);if(row.length!==n)throw Error('灯位排数不匹配');row.forEach((p,x)=>Object.assign(p,{lx:x,ly:y,wire:offset+(y%2?n-1-x:x)}));offset+=n;});return list;}
function layer(type='flow',duration=12){const l=P.decorate({id:'l'+Math.random().toString(36).slice(2,10),name:({flow:'冷白流光',scan:'柔光流水',breathe:'渐变呼吸',ripple:'扩散光环',particles:'星火粒子',paint:'静态绘制',legacy:'原始 INO 粒子'})[type],type,enabled:true,color:type==='particles'?'#ff953d':'#cfdcff',opacity:1,blend:'max',start:0,end:duration,fadeIn:0,fadeOut:0,speed:1,scale:1,angle:0,cx:14,cy:4,seed:7,mask:Array(COUNT).fill(1),keys:[],legacyBrightness:5,legacyInterval:35});if(T.defs[type])l.tuning=T.defaults(type);if(type==='whiteSweep')l.starFollow='path-v1';if(type==='flame')l.flameBase='level-v1';return l;}
function project(preset='flow'){
 const extra=P.preset(preset,{project,layer});if(extra)return extra;
 let p={schema:1,name:'冷白流光练习',duration:12,fps:30,pin:18,master:160,layers:[layer('flow')],loopFade:.4,layout:clone(DEFAULT_LAYOUT)};
 if(preset==='aurora'){p.name='极光叠影';p.layers[0].color='#70cfff';const b=layer('flow');Object.assign(b,{name:'紫色流光',color:'#be70ff',speed:.7,angle:75,scale:1.4,opacity:.65,blend:'add'});p.layers.push(b);}
 if(preset==='ripple'){p.name='蓝色涟漪';p.layers=[layer('ripple')];p.layers[0].color='#62baff';}
 if(preset==='sparks'){p.name='星火与余晖';p.layers=[layer('particles')];const b=layer('breathe');Object.assign(b,{name:'暖色底光',color:'#ff5029',opacity:.1,speed:.4});p.layers.unshift(b);}
 if(preset==='blank'){p.name='未命名灯效';p.layers=[layer('paint')];p.layers[0].mask.fill(0);}
 if(preset==='legacy'){p.name='原始 INO 粒子';p.layers=[layer('legacy')];p.master=255;p.loopFade=0;}
 return p;
}
function finite(v,lo,hi,label){if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(label+' 超出范围');return v;}
function validate(data){
 if(!data||data.schema!==1)throw Error('不是灯效编辑器 v1 工程');
 const p={schema:1,name:String(data.name||'未命名灯效').slice(0,80),duration:finite(data.duration,1,30,'时长'),fps:finite(data.fps,5,60,'帧率'),pin:finite(data.pin,0,48,'引脚'),master:finite(data.master,0,255,'输出亮度'),loopFade:finite(data.loopFade??0,0,3,'循环衔接')};
 if(!Number.isInteger(p.fps)||!Number.isInteger(p.pin)||!Number.isInteger(p.master)||Math.abs(Math.round(p.duration*p.fps)-p.duration*p.fps)>.0001)throw Error('帧率、引脚和输出亮度须为整数，时长必须对应完整帧');
 if(!Array.isArray(data.layers)||data.layers.length>16)throw Error('最多支持 16 层');
 if(data.layout!==undefined){const g=data.layout;if(!g||g.version!==1||!Array.isArray(g.rowOffsets)||g.rowOffsets.length!==8)throw Error('灯位布局无效');p.layout={version:1,rowGap:finite(g.rowGap,.5,1.5,'排距'),rowOffsets:g.rowOffsets.map(v=>finite(v,-4,4,'排偏移'))};}
 p.layers=data.layers.map((l,i)=>{
   if(!l||!TYPES.includes(l.type))throw Error('未知图层效果');
   if(!/^#[\da-f]{6}$/i.test(l.color))throw Error('颜色须为 #RRGGBB');
   if(!['max','add','normal'].includes(l.blend))throw Error('未知混合方式');
   const out={id:'layer-'+i,name:String(l.name||'图层').slice(0,60),type:l.type,enabled:l.enabled===true,color:l.color,blend:l.blend};
   const spec={opacity:[0,1],start:[0,p.duration],end:[0,p.duration],fadeIn:[0,30],fadeOut:[0,30],speed:[0,4],scale:[.25,4],angle:[-180,180],cx:[0,28],cy:[0,8],seed:[0,99999],legacyBrightness:[0,23],legacyInterval:[0,254]};
   for(const [k,[a,b]] of Object.entries(spec))out[k]=finite(l[k],a,b,k);
   if(out.end<=out.start)throw Error('图层结束时间必须晚于开始时间');
   if(!Number.isInteger(out.seed)||!Number.isInteger(out.legacyBrightness)||!Number.isInteger(out.legacyInterval))throw Error('种子与 INO 参数必须为整数');
   if(!Array.isArray(l.mask)||l.mask.length!==COUNT||l.mask.some(v=>v!==0&&v!==1))throw Error('区域数据应为 199 个 0 或 1');out.mask=[...l.mask];
   if(!Array.isArray(l.keys)||l.keys.length>64)throw Error('每层最多 64 个关键帧');
   out.keys=l.keys.map(k=>({time:finite(k.time,0,p.duration,'关键帧时间'),value:finite(k.value,0,1,'关键帧亮度')})).sort((a,b)=>a.time-b.time);
   if(out.keys.some((k,j)=>j&&Math.abs(k.time-out.keys[j-1].time)<.0001))throw Error('关键帧时间不能重复');
   if(l.type==='text'){
     if(typeof l.text!=='string'||!l.text.length||Array.from(l.text).length>80)throw Error('文字内容须为 1–80 个字符');out.text=l.text;
     if(!Array.isArray(l.bitmap)||!l.bitmap.length||l.bitmap.length>2048||l.bitmap.some(v=>!Number.isInteger(v)||v<0||v>127))throw Error('文字点阵无效');out.bitmap=[...l.bitmap];
     if(!['left','right','still'].includes(l.direction))throw Error('文字方向无效');out.direction=l.direction;
   }
   if(l.type==='emoji'){if(!P.ICONS[l.glyph]||!Object.hasOwn(P.ICONS,l.glyph))throw Error('表情样式无效');out.glyph=l.glyph;}
   if(l.type==='flame'){if(!/^#[\da-f]{6}$/i.test(l.accent))throw Error('火焰高温色无效');out.accent=l.accent;}
   if(['spin','spiral'].includes(l.type)){out.beams=finite(l.beams,1,12,'光束数量');if(!Number.isInteger(out.beams))throw Error('光束数量须为整数');}
   if(l.type==='strobe'){if(!['chase','checker','halves'].includes(l.pattern))throw Error('交错模式无效');out.pattern=l.pattern;}
   if(l.geometry!==undefined){if(!['physical-v1','physical-v2'].includes(l.geometry)||!P.SPATIAL.includes(l.type))throw Error('灯位校正模式无效');out.geometry=l.geometry;}
   if(l.starFollow!==undefined){if(l.type!=='whiteSweep'||l.starFollow!=='path-v1')throw Error('残星跟随模式无效');out.starFollow=l.starFollow;}
   if(l.flameBase!==undefined){if(l.type!=='flame'||l.flameBase!=='level-v1')throw Error('火焰高度基准无效');out.flameBase=l.flameBase;}
   if(l.tuning!==undefined)out.tuning=T.validate(l.type,l.tuning);
   if(l.trail!==undefined)out.trail=Trails.validate(l.type,l.trail);
   return out;
 });return p;
}
function opacity(l,t){if(t<l.start||t>=l.end||!l.enabled)return 0;let a=l.opacity;
 if(l.keys.length){const ks=l.keys;if(t<=ks[0].time)a=ks[0].value;else if(t>=ks.at(-1).time)a=ks.at(-1).value;else{const j=ks.findIndex(k=>k.time>t),b=ks[j-1],c=ks[j];a=b.value+(c.value-b.value)*(t-b.time)/(c.time-b.time);}}
 if(l.fadeIn)a*=smooth((t-l.start)/l.fadeIn);if(l.fadeOut)a*=smooth((l.end-t)/l.fadeOut);return a;
}
function intensity(l,x,y,t){
 if(Object.hasOwn(P.NAMES,l.type))return P.intensity(l,x,y,t);
 const a=l.angle*Math.PI/180,xx=(x-l.cx)*Math.cos(a)+(y-l.cy)*Math.sin(a)+l.cx,yy=-(x-l.cx)*Math.sin(a)+(y-l.cy)*Math.cos(a)+l.cy;
 const u=xx/(5.4*l.scale),v=yy/(2.7*l.scale),q=t*l.speed;
 if(l.type==='paint')return 1;
 if(l.type==='breathe')return .06+.94*Math.pow(.5+.5*Math.sin(q*Math.PI),1.8);
 if(l.type==='scan'){const d=((xx-q*7)%34+34)%34;return Math.exp(-Math.pow((d-17)/(2.2*l.scale),2));}
 if(l.type==='ripple'){const d=Math.hypot(x-l.cx,(y-l.cy)*1.1),front=(q*4)%28;return Math.exp(-Math.pow((d-front)/(1.1*l.scale),2));}
 if(l.type==='particles'){
   let sum=0;for(let k=0;k<32;k++){const cycle=q*.6+hash(l.seed+k*91)*2,age=cycle%2;const angle=hash(l.seed+k*17)*Math.PI*2,r=age*(2+hash(k*72+l.seed)*4);const px=l.cx+Math.cos(angle)*r,py=l.cy+Math.sin(angle)*r*.45;sum+=Math.exp(-((x-px)**2+(y-py)**2)/(l.scale*.42))*(1-age/2)**2;}
   return clamp(sum);
 }
 const wx=u+.48*Math.sin(v*1.7-q*.65)+.22*Math.sin(u*1.4+v-q*.34),wy=v+.38*Math.sin(u*1.6+q*.42);
 const field=(Math.sin(wx*2.25-q*1.15)+.7*Math.sin(wy*2.5+wx*.7+q*.83)+.45*Math.cos(wx*1.35-wy*1.9-q*.57))/2.15;
 return .008+.992*Math.pow(smooth((field+.38)/.95),1.5);
}
function hsv(h,v){const reg=Math.floor(h/43),rem=(h-reg*43)*6,p=0,q=(v*(255-((255*rem)>>8)))>>8,t=(v*(255-((255*(255-rem))>>8)))>>8;return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][Math.min(reg,5)];}
const legacyCache=new Map();
function legacy(l,t){const target=Math.floor(t/ .02803),key=[l.seed,l.legacyBrightness,l.legacyInterval].join('/');let state=legacyCache.get(key);
 if(!state||state.step>target){let n=l.seed;state={step:0,timer:0,rng:()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296},particles:Array.from({length:80},()=>({active:false})),leds:Array.from({length:COUNT},()=>[0,0,0])};if(legacyCache.size>32)legacyCache.clear();legacyCache.set(key,state);}
 const rand=(a,b)=>b===undefined?Math.floor(state.rng()*a):a+Math.floor(state.rng()*(b-a));
 const spawn=(cx,cy)=>{const p=state.particles.find(p=>!p.active);if(!p)return;const angle=Math.fround(rand(0,628)/100),speed=Math.fround(rand(30,80)/100);Object.assign(p,{x:cx,y:cy,vx:Math.fround(Math.cos(angle)*speed),vy:Math.fround(Math.sin(angle)*speed*.45),life:rand(25,45),hue:rand(0,60),active:true});};
 while(state.step<target){state.step++;state.leds=Array.from({length:COUNT},()=>[0,0,0]);if(++state.timer>l.legacyInterval){spawn(14,4);if(rand(100)<25)spawn(rand(0,28),rand(0,8));state.timer=0;}
 for(const p of state.particles){if(!p.active)continue;p.x=Math.fround(p.x+p.vx);p.y=Math.fround(p.y+p.vy);if(--p.life<=0){p.active=false;continue;}const x=Math.round(p.x),y=Math.round(p.y);if(y>=0&&y<8&&x>=0&&x<ROWS[y]){const i=ROWS.slice(0,y).reduce((a,b)=>a+b,0)+x;state.leds[i]=hsv(p.hue,Math.trunc(p.life*l.legacyBrightness*11/45));}}}
 return state.leds;
}
function sampleLayer(l,p,pt,t){const base=rgb(l.color);
 if(l.type==='showcase')return T.showcase(l,pt.lx,pt.ly,t,p.layout||DEFAULT_LAYOUT);
 if(Object.hasOwn(P.NAMES,l.type)){const pos=l.geometry?.startsWith('physical-')?(p.layout?gridPosition(pt,p.layout):physicalPosition(pt)):{x:pt.lx,y:pt.ly};const light=l.tuning||l.flameBase==='level-v1'?T.amount(l,pos.x,pos.y,t,P.intensity):P.intensity(l,pos.x,pos.y,t);if(l.type==='flame'){const hot=rgb(l.accent),mix=clamp((light-.3)/.7)**2;return base.map((v,c)=>(v*(1-mix)+hot[c]*mix)*light);}return base.map(v=>v*light);}
 const pos=p.layout?gridPosition(pt,p.layout):{x:(pt.x-385)/47,y:(pt.y-448)/46};return base.map(v=>v*(l.tuning?T.amount(l,pos.x,pos.y,t,intensity):intensity(l,pos.x,pos.y,t)));
}
function sampleValues(l,p,points,t){
 if(l.type==='legacy')return legacy(l,t*l.speed);
 if(l.type==='whiteSweep'){const base=rgb(l.color),positions=points.map(pt=>({...(p.layout?gridPosition(pt,p.layout):physicalPosition(pt)),row:pt.ly}));return Reference.frame(l,positions,t).map(value=>base.map(c=>c*value));}
 return points.map(pt=>sampleLayer(l,p,pt,t));
}
function rawFrame(p,points,t){let out=Array.from({length:COUNT},()=>[0,0,0]);
 for(const l of p.layers){const a=opacity(l,t);if(a<=0)continue;const local=t-l.start;
 const values=sampleValues(l,p,points,local);
 const stars=l.trail?.enabled?Trails.render(l,p,points,local,values,past=>sampleValues(l,p,points,past),past=>opacity(l,past+l.start)):null;
 points.forEach((pt,i)=>{if(!l.mask[i])return;for(let c=0;c<3;c++){const value=stars?Math.max(values[i][c],stars[i][c]):values[i][c],v=value*a;out[i][c]=l.blend==='normal'?out[i][c]*(1-a)+v:l.blend==='add'?Math.min(255,out[i][c]+v):Math.max(out[i][c],v);}});
 }return out;
}
function render(p,points,t){if(t<0||t>=p.duration)t=((t%p.duration)+p.duration)%p.duration;let out=rawFrame(p,points,t);
 const fade=Math.min(p.loopFade,p.duration/2);if(fade>0&&t>p.duration-fade){const b=rawFrame(p,points,0),a=smooth((t-(p.duration-fade))/fade);out=out.map((v,i)=>v.map((n,c)=>n*(1-a)+b[i][c]*a));}
 return out.map(v=>v.map(c=>Math.round(clamp(c*p.master/255,0,255))));
}
root.StudioEngine={ROWS,COUNT,TYPES,clamp,rgb,clone,mapping,physicalPosition,gridPosition,displayPosition,DEFAULT_LAYOUT,layer,project,validate,opacity,render,intensity,legacy};
if(typeof module!=='undefined')module.exports=root.StudioEngine;
})(typeof window==='undefined'?globalThis:window);
