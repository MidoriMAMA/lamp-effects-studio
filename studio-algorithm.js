(function(root){
'use strict';
const E=root.StudioEngine||(typeof require==='function'?require('./studio-engine.js'):null);
const Flame=root.StudioAlgorithmFlame||(typeof require==='function'?require('./studio-algorithm-flame.js'):null);
const Sweep=root.StudioAlgorithmSweep||(typeof require==='function'?require('./studio-algorithm-sweep.js'):null);
const TYPES=['flame','whiteSweep','paint'];
const bytes=s=>new TextEncoder().encode(s).length;
const number=n=>{if(!Number.isFinite(n))throw Error('算法参数必须为有限数字');return Object.is(n,-0)?'0':String(n);};
const cppBool=b=>b?'true':'false';
const encode=s=>typeof Buffer!=='undefined'?Buffer.from(s,'utf8').toString('base64'):btoa(Array.from(new TextEncoder().encode(s),v=>String.fromCharCode(v)).join(''));
const decode=s=>typeof Buffer!=='undefined'?Buffer.from(s,'base64').toString('utf8'):new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
const reserved=new Set('alignas alignof and asm auto bitand bitor bool break case catch char class compl const constexpr continue decltype default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast return short signed sizeof static static_assert std struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor'.split(' '));
function moduleName(value='LampEffect'){
 if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value)||value.includes('__')||reserved.has(value))throw Error('模块名须以英文字母开头，只含字母、数字、下划线，且不能是 C++ 关键字');
 return value;
}
function supported(project){
 const p=E.validate(project),reasons=[];
 for(const l of p.layers){if(!l.enabled||!l.mask.some(Boolean))continue;
  if(!TYPES.includes(l.type))reasons.push(`「${l.name}」尚未支持算法导出`);
  if(l.trail?.enabled)reasons.push(`「${l.name}」的通用星光拖尾尚未支持算法导出`);
 }
 return {supported:reasons.length===0,reasons,project:p};
}
function opacityFunction(l,id){
 let code=`static double ${id}_alpha(double t) {\n  if (t < ${number(l.start)} || t >= ${number(l.end)}) return 0;\n  double a = ${number(l.opacity)};\n`;
 if(l.keys.length){
  code+=`  if (t <= ${number(l.keys[0].time)}) a = ${number(l.keys[0].value)};\n`;
  for(let i=1;i<l.keys.length;i++){const a=l.keys[i-1],b=l.keys[i];code+=`  else if (t < ${number(b.time)}) a = ${number(a.value)} + (${number(b.value)} - ${number(a.value)}) * (t - ${number(a.time)}) / (${number(b.time)} - ${number(a.time)});\n`;}
  code+=`  else a = ${number(l.keys.at(-1).value)};\n`;
 }
 if(l.fadeIn)code+=`  a *= ls_smooth((t - ${number(l.start)}) / ${number(l.fadeIn)});\n`;
 if(l.fadeOut)code+=`  a *= ls_smooth((${number(l.end)} - t) / ${number(l.fadeOut)});\n`;
 return code+'  return a;\n}\n';
}
function exportBundle(project,points,options={}){
 const check=supported(project),p=check.project,name=moduleName(options.namespaceName);
 if(!check.supported)throw Error(check.reasons.join('；')+'。请关闭对应图层/拖尾，或明确选择逐帧导出。');
 if(!Array.isArray(points)||points.length!==199||new Set(points.map(pt=>pt.wire)).size!==199||points.some(pt=>!Number.isInteger(pt.wire)||pt.wire<0||pt.wire>=199))throw Error('算法导出需要完整的 199 灯接线表');
 const layers=p.layers.filter(l=>l.enabled&&l.mask.some(Boolean)),shared=new Map(),parts=[],evaluations=[],notes=[];
 let resourceBytes=0,hasSweep=false;
 const canonical=points.every((pt,i)=>{let y=0,x=i;while(x>=E.ROWS[y])x-=E.ROWS[y++];const start=E.ROWS.slice(0,y).reduce((a,b)=>a+b,0);return pt.lx===x&&pt.ly===y&&pt.wire===start+(y%2?E.ROWS[y]-1-x:x);});
 let wireCode;
 if(canonical)wireCode='static uint16_t ls_wire(uint16_t i) { static const uint8_t rows[8]={28,28,27,26,26,25,22,17}; uint16_t start=0; for(uint8_t y=0;y<8;++y){ if(i<start+rows[y]) return (y&1)?start+rows[y]-1-(i-start):i; start+=rows[y]; } return 0; }';
 else{wireCode=`static const uint8_t ls_wires[199]={${points.map(pt=>pt.wire).join(',')}};\nstatic uint16_t ls_wire(uint16_t i){return ls_wires[i];}`;resourceBytes+=199;}
 for(let index=0;index<layers.length;index++){
  const l=layers[index],id='e'+index;
  let emission;
  if(l.type==='flame')emission=Flame.emit(l,points.map(pt=>({x:pt.lx,y:pt.ly,row:pt.ly})),id);
  else if(l.type==='whiteSweep'){hasSweep=true;emission=Sweep.emit(l,points.map(pt=>({...p.layout?E.gridPosition(pt,p.layout):E.physicalPosition(pt),row:pt.ly})),id);}
  else emission={code:'',sample:null,resourceBytes:0};
  if(emission.sharedCode)shared.set(l.type,emission.sharedCode);
  resourceBytes+=emission.resourceBytes||0;notes.push(...emission.notes||[]);
  parts.push(emission.code,opacityFunction(l,id));
  let mask='true';
  if(!l.mask.every(Boolean)){const packed=Array(25).fill(0);l.mask.forEach((v,i)=>{if(v)packed[i>>3]|=1<<(i&7);});parts.push(`static const uint8_t ${id}_mask[25]={${packed.join(',')}};`);mask=`(${id}_mask[i >> 3] & (1u << (i & 7)))`;resourceBytes+=25;}
  const color=E.rgb(l.color),tint=E.rgb(l.accent||l.color);
  let expr;
  if(l.type==='flame')expr=`double hot=ls_clamp((light-0.3)/0.7); hot*=hot;\n      ls_Color c={(${color[0]}*(1-hot)+${tint[0]}*hot)*light,(${color[1]}*(1-hot)+${tint[1]}*hot)*light,(${color[2]}*(1-hot)+${tint[2]}*hot)*light};`;
  else expr=`ls_Color c={${color[0]}*light,${color[1]}*light,${color[2]}*light};`;
  // Paint has the same optional upper/lower gain as the browser's tuning path.
  let sample=emission.sample?`${emission.sample}(i,t-${number(l.start)})`:'1.0';
  if(l.type==='paint'&&l.tuning){const up=l.tuning.upper??1,low=l.tuning.lower??1;const pos=points.map(pt=>p.layout?E.gridPosition(pt,p.layout):{y:(pt.y-448)/46});const levels=pos.map(pt=>E.clamp(up*(1-E.clamp(pt.y/7))+low*E.clamp(pt.y/7)));parts.push(`static const double ${id}_paint[199]={${levels.map(number).join(',')}};`);sample=`${id}_paint[i]`;resourceBytes+=199*8;}
  const channels=['r','g','b'].map(ch=>l.blend==='normal'?`out.${ch}=out.${ch}*(1-a)+c.${ch}*a;`:l.blend==='add'?`out.${ch}=std::min(255.0,out.${ch}+c.${ch}*a);`:`out.${ch}=std::max(out.${ch},c.${ch}*a);`).join(' ');
  evaluations.push(`  { const double a=alpha[${index}]; if(a>0 && ${mask}) {\n      double light=${sample};\n      ${expr}\n      ${channels}\n  } }`);
 }
 // Net numeric resources are an estimate: target ABI, machine code, driver and
 // compiler padding are deliberately not represented as a firmware size claim.
 resourceBytes+=8+(hasSweep?112:0);
 const count=Math.round(p.duration*p.fps),fade=Math.min(p.loopFade,p.duration/2);
 const alpha=layers.map((_,i)=>`e${i}_alpha(t)`).join(',')||'0';
 const alpha0=layers.map((_,i)=>`e${i}_alpha(0)`).join(',')||'0';
 const payload={revision:1,namespaceName:name,project:p};
 const sharedText=[...shared.entries()].map(([kind,code])=>`#ifndef LAMP_STUDIO_${kind.toUpperCase()}_KERNEL_V1\n#define LAMP_STUDIO_${kind.toUpperCase()}_KERNEL_V1\nnamespace LampStudioKernel {\n${code}\n}\n#endif`).join('\n');
 const source=`// Lamp Studio algorithm module v1. No RGB frame table; no setup()/loop()/LED driver.
// Use this same source as ${name}.h inside your existing firmware.
// Call ${name}::renderFrame(frameIndex, output) or renderAt(elapsedMs, output).
// Output is RGB in physical wire order, including the project's output brightness.
/* LAMP_STUDIO_ALGORITHM_V1:${encode(JSON.stringify(payload))} */
#ifndef LAMP_STUDIO_PROGRAM_${name}_V1
#define LAMP_STUDIO_PROGRAM_${name}_V1
#include <stdint.h>
#include <stddef.h>
#include <cmath>
#include <algorithm>
${sharedText}
namespace ${name} {
using namespace LampStudioKernel;
struct RGB { uint8_t r,g,b; };
static_assert(sizeof(RGB)==3, "RGB must occupy three bytes");
static constexpr uint16_t LED_COUNT=199;
static constexpr uint32_t FRAME_COUNT=${count};
static constexpr uint8_t FPS=${p.fps};
static double ls_clamp(double x){return std::max(0.0,std::min(1.0,x));}
static double ls_smooth(double x){x=ls_clamp(x);return x*x*(3-2*x);}
struct ls_Color {double r,g,b;};
${wireCode}
${parts.join('\n')}
static ls_Color ls_raw(double t,uint16_t i,const double *alpha){
  ls_Color out={0,0,0};
${evaluations.join('\n')}
  return out;
}
static void renderFrame(uint32_t frame,RGB *output){
  if(!output)return;
  const double t=(frame%FRAME_COUNT)/double(FPS);
  const double alpha[]={${alpha}};
  ${fade>0?`const bool fade=t>${number(p.duration-fade)};\n  const double weight=fade?ls_smooth((t-${number(p.duration-fade)})/${number(fade)}):0;\n  const double beginning[]={${alpha0}};`:''}
  for(uint16_t i=0;i<LED_COUNT;++i){
    ls_Color c=ls_raw(t,i,alpha);
    ${fade>0?'if(fade){const ls_Color b=ls_raw(0,i,beginning); c.r=c.r*(1-weight)+b.r*weight; c.g=c.g*(1-weight)+b.g*weight; c.b=c.b*(1-weight)+b.b*weight;}':''}
    RGB &dst=output[ls_wire(i)];
    dst.r=uint8_t(std::floor(std::max(0.0,std::min(255.0,c.r*${p.master}/255.0))+0.5));
    dst.g=uint8_t(std::floor(std::max(0.0,std::min(255.0,c.g*${p.master}/255.0))+0.5));
    dst.b=uint8_t(std::floor(std::max(0.0,std::min(255.0,c.b*${p.master}/255.0))+0.5));
  }
}
static void renderAt(uint32_t elapsedMs,RGB *output){
  const uint32_t frame=uint32_t((uint64_t(elapsedMs)*FPS/1000)%FRAME_COUNT);
  renderFrame(frame,output);
}
} // namespace ${name}
#endif
`;
 // Empty/paint-only projects still need a valid shared namespace.
 const complete=shared.size?source:source.replace(`namespace ${name} {`,`namespace LampStudioKernel {}\nnamespace ${name} {`);
 const readme=`# ${name} 固件集成模块\n\n本包以算法和少量静态参数生成画面，不保存每帧 RGB。支持当前工程中的火焰、冷白星流和静态绘制；图层混合、区域、亮度关键帧、时间片段、循环衔接均进入输出。\n\n1. 将 ${name}.h 复制到已有固件工程。\n2. 在原工程中 #include "${name}.h"。不要把备份用的同名 .ino 同时复制过去。\n3. 保留店家原有 setup、RMT 配置、show 和接线；由原来的循环按 ${p.fps} FPS 调用下面代码。\n\n    static ${name}::RGB pixels[${name}::LED_COUNT];\n    ${name}::renderAt(millis(), pixels);\n    for (int i=0;i<199;i++) {\n      leds[i].r=pixels[i].r;\n      leds[i].g=pixels[i].g;\n      leds[i].b=pixels[i].b;\n    }\n    show();\n\n算法输出已经包含本工程输出亮度，数组按蛇形接线排序。每次调用写满 199 灯。renderAt 的时间应是该效果开始后的毫秒数；切换效果时把起始时间重新记为 millis()。renderFrame 可按固定帧序号采样。\n\n${name}.ino 是同一算法源码的编辑器回读副本，没有独立的 setup/loop，不能单独烧录。工程 JSON 可继续编辑。多个模块用不同的模块名导出，在同一个翻译单元中共用带版本保护的灯效内核。\n\n效果静态数值资源估算 ${resourceBytes} 字节（不含编译机器码、指针对齐、驱动和原固件）。输出缓冲 597 字节，另有算法局部/缓存内存；不是最终 RAM 占用。请用实际控制板、原固件、分区表和编译配置比较新增 Flash/RAM，并测试最坏渲染耗时。\n\n算法按 double 移植并做主机 C++ 对照；目标 ESP32 工具链及实灯仍须验收。不要启用改变浮点语义的 fast-math 选项。保留 ${name}.ino 中的工程注释可在编辑器严格回读。\n`;
 return {project:p,namespaceName:name,files:{[name+'.h']:complete,[name+'.ino']:complete,'project.lamp.json':JSON.stringify(p,null,2),'README.md':readme},stats:{sourceBytes:bytes(complete),resourceBytesEstimate:resourceBytes,rawFrameBytes:count*199*3,frameCount:count,outputBufferBytes:597,layers:layers.length},notes:[...new Set(notes)]};
}
function importIno(source,points){
 const normalized=source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),match=normalized.match(/\/\* LAMP_STUDIO_ALGORITHM_V1:([A-Za-z0-9+/=]+) \*\//);
 if(!match)throw Error('不是算法导出文件');
 let payload;try{payload=JSON.parse(decode(match[1]));}catch{throw Error('算法工程信息损坏');}
 if(payload.revision!==1)throw Error('算法导出版本暂不支持');
 const bundle=exportBundle(payload.project,points,{namespaceName:payload.namespaceName});
 if(normalized.trim()!==bundle.files[bundle.namespaceName+'.ino'].trim())throw Error('算法源码或参数已被外部修改，不能仅凭注释还原；请导入原导出文件或工程 JSON。');
 return {project:bundle.project,kind:'algorithm',message:'已完整回读算法工程并核对源码，可继续调节。目标固件仍需编译和实灯验收。'};
}
// A stored ZIP keeps the whole export offline and avoids a dependency or service.
function zip(files){
 const enc=new TextEncoder(),chunks=[],central=[];let offset=0,centralBytes=0;
 const crc=data=>{let c=0xffffffff;for(const v of data){c^=v;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const [name,text] of Object.entries(files)){
  const path=enc.encode(name),data=enc.encode(text),sum=crc(data),local=new Uint8Array(30+path.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,path.length,true);local.set(path,30);
  const directory=new Uint8Array(46+path.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,sum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,path.length,true);d.setUint32(42,offset,true);directory.set(path,46);
  chunks.push(local,data);central.push(directory);offset+=local.length+data.length;centralBytes+=directory.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,centralBytes,true);v.setUint32(16,offset,true);
 const out=new Uint8Array(offset+centralBytes+22);let at=0;for(const part of [...chunks,...central,end]){out.set(part,at);at+=part.length;}return out;
}
root.StudioAlgorithm={TYPES,supported,moduleName,exportBundle,importIno,zip};if(typeof module!=='undefined')module.exports=root.StudioAlgorithm;
})(typeof window==='undefined'?globalThis:window);
