(function(root){
'use strict';
const TYPES=['flow','scan','ripple','particles','flame','rain','comet','spin','spiral','wave','equalizer','strobe','showcase','text'];
const DEFAULTS={enabled:true,life:1.8,density:.7,brightness:1.25,twinkle:4,color:'#ffe7b8',followColor:false,seed:27};
const FIELDS=[['life','消散时间',.2,4,.1,'秒'],['density','星点密度',.05,1,.05,''],['brightness','星光亮度',.1,2,.05,'×'],['twinkle','闪烁频率',.5,12,.5,'Hz'],['seed','星点分布',0,9999,1,'']];
function validate(type,v){if(!TYPES.includes(type)||!v||typeof v!=='object'||Array.isArray(v))throw Error('星光拖尾配置无效');if(Object.keys(v).some(k=>!Object.hasOwn(DEFAULTS,k)))throw Error('未知星光参数');const out={};for(const k of ['enabled','followColor']){if(typeof v[k]!=='boolean')throw Error('星光开关无效');out[k]=v[k];}for(const [k,name,min,max,,] of FIELDS){if(typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<min||v[k]>max||(k==='seed'&&!Number.isInteger(v[k])))throw Error(name+' 超出范围');out[k]=v[k];}if(typeof v.color!=='string'||!/^#[\da-f]{6}$/i.test(v.color))throw Error('星光颜色无效');out.color=v.color;return out;}
const clamp=x=>Math.max(0,Math.min(1,x)),fract=x=>x-Math.floor(x),hash=x=>fract(Math.sin(x*127.1+311.7)*43758.5453),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const caches=new Map(),pointIds=new WeakMap();let nextPointId=1;const RATE=30;
function signature(l,p,points){if(!pointIds.has(points))pointIds.set(points,nextPointId++);const {trail,mask,keys,id,name,enabled,opacity,blend,start,end,fadeIn,fadeOut,...effect}=l;return JSON.stringify([effect,p.layout,pointIds.get(points)]);}
// Cache sampled source light, never displayed canvas pixels. Seeking and INO baking share this history.
function render(l,p,points,t,current,sample,emissionGain=()=>1){const o=l.trail,key=signature(l,p,points);let cache=caches.get(key);if(!cache){cache=new Map();caches.set(key,cache);if(caches.size>24)caches.delete(caches.keys().next().value);}
 const first=Math.max(0,Math.ceil((t-o.life)*RATE)),last=Math.floor((t-1/RATE)*RATE+1e-7),history=[];
 for(let frame=last;frame>=first;frame--){let data=cache.get(frame);if(!data){const colors=sample(frame/RATE);data={strength:Float32Array.from(colors,v=>Math.max(...v)/255),colors:Uint8Array.from(colors.flat(),v=>Math.round(v))};cache.set(frame,data);}history.push([frame/RATE,data.strength,emissionGain(frame/RATE),data.colors]);}
 // Bounded per-effect storage, independent of project length and playback order.
 if(cache.size>256){const keep=new Set(history.map(h=>Math.round(h[0]*RATE)));for(const frame of cache.keys())if(!keep.has(frame)&&cache.size>256)cache.delete(frame);}
 const tint=rgb(o.followColor?l.color:o.color);
 return current.map((color,i)=>{
   let birth=-1,power=0,gain=0,birthColor=null;for(const [time,strength,alpha,colors] of history){if(alpha>0&&strength[i]>=.35){birth=time;power=strength[i];gain=alpha;birthColor=colors;break;}}
   if(birth<0)return [0,0,0];
   const key=i*17+o.seed*31+Math.floor(birth*2)*131;
   if(hash(key)>o.density)return [0,0,0];
   const age=t-birth,life=o.life*(.75+.25*hash(i+o.seed));if(age>=life)return [0,0,0];
   const decay=Math.pow(1-age/life,1.6),phase=t*o.twinkle+hash(key+79),twinkle=.12+.88*Math.pow(.5+.5*Math.sin(phase*Math.PI*2),7);
   const behind=Math.pow(1-clamp(Math.max(...color)/255),.65);
   const light=clamp((.55+.45*power)*decay*twinkle*behind*o.brightness*gain);
   if(o.followColor){const source=Array.from(birthColor.slice(i*3,i*3+3)),peak=Math.max(...source);return source.map(c=>peak?c/peak*255*light:0);}return tint.map(c=>c*light);
 });
}
root.StudioTrails={TYPES,DEFAULTS,FIELDS,validate,render};if(typeof module!=='undefined')module.exports=root.StudioTrails;
})(typeof window==='undefined'?globalThis:window);
