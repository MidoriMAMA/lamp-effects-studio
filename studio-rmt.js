(function(root){
'use strict';
const E=root.StudioEngine||(typeof require==='function'?require('./studio-engine.js'):null);
const A=root.StudioAlgorithm||(typeof require==='function'?require('./studio-algorithm.js'):null);
const D=root.StudioRmtDriver||(typeof require==='function'?require('./studio-rmt-driver.js'):null);
const bytes=s=>new TextEncoder().encode(s).length;
const encode=s=>typeof Buffer!=='undefined'?Buffer.from(s,'utf8').toString('base64'):btoa(Array.from(new TextEncoder().encode(s),v=>String.fromCharCode(v)).join(''));
const decode=s=>typeof Buffer!=='undefined'?Buffer.from(s,'base64').toString('utf8'):new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
function frameModule(project,points,name){
 const C=root.StudioCodec||(typeof require==='function'?require('./studio-codec.js'):null);
 const baked=C.bake(project,points),rows=[];
 for(let i=0;i<baked.bytes.length;i+=48)rows.push('  '+Array.from(baked.bytes.slice(i,i+48)).join(','));
 return `// Lamp Studio frame module. RGB in physical wire order, brightness already applied.
#ifndef LAMP_STUDIO_FRAMES_${name}_V1
#define LAMP_STUDIO_FRAMES_${name}_V1
#include <stdint.h>
#ifdef ARDUINO
#include <pgmspace.h>
#endif
namespace ${name} {
struct RGB { uint8_t r,g,b; };
static_assert(sizeof(RGB)==3, "RGB must occupy three bytes");
static constexpr uint16_t LED_COUNT=199;
static constexpr uint32_t FRAME_COUNT=${baked.count};
static constexpr uint8_t FPS=${baked.project.fps};
static const uint8_t ls_frameData[]
#ifdef ARDUINO
PROGMEM
#endif
= {
${rows.join(',\n')}
};
static_assert(sizeof(ls_frameData)==FRAME_COUNT*LED_COUNT*3, "Invalid frame length");
static uint8_t ls_read(uint32_t offset){
#ifdef ARDUINO
  return pgm_read_byte(ls_frameData+offset);
#else
  return ls_frameData[offset];
#endif
}
static void renderFrame(uint32_t frame,RGB *output){
  if(!output)return;
  const uint32_t offset=(frame%FRAME_COUNT)*LED_COUNT*3;
  for(uint16_t i=0;i<LED_COUNT;++i){
    output[i].r=ls_read(offset+i*3);
    output[i].g=ls_read(offset+i*3+1);
    output[i].b=ls_read(offset+i*3+2);
  }
}
static void renderAt(uint32_t elapsedMs,RGB *output){
  renderFrame(uint32_t((uint64_t(elapsedMs)*FPS/1000)%FRAME_COUNT),output);
}
} // namespace ${name}
#endif
`;
}
function integrationExample(name){return `// Copy into the seller's existing .ino AFTER its leds[] and show() declarations.
// Keep the existing RMT setup and show(). Do not also copy the standalone sketch.
#include "${name}.h"
namespace ${name}Playback {
static ${name}::RGB pixels[${name}::LED_COUNT];
static uint32_t previousUs=0,frame=0;
static uint64_t fraction=0;
static bool first=true;
void begin(){previousUs=micros();frame=0;fraction=0;first=true;}
void tick(){
  const uint32_t now=micros();
  fraction+=uint64_t(uint32_t(now-previousUs))*${name}::FPS;
  previousUs=now;
  const uint32_t steps=uint32_t(fraction/1000000ULL);
  fraction%=1000000ULL;
  if(!first && !steps)return;
  frame=uint32_t((uint64_t(frame)+steps)%${name}::FRAME_COUNT);
  first=false;
  ${name}::renderFrame(frame,pixels);
  for(uint16_t i=0;i<${name}::LED_COUNT;++i){
    // Named assignment: the seller's Color_t is {g,r,b}, NOT {r,g,b}.
    leds[i].r=pixels[i].r;
    leds[i].g=pixels[i].g;
    leds[i].b=pixels[i].b;
  }
  show();
}
}
// In your existing setup(), AFTER RMT initialization:
//   ${name}Playback::begin();
// In your existing loop(), call regularly instead of tuanExplode():
//   ${name}Playback::tick();
// Also call begin() whenever switching to this effect to restart its clock.
// Do not apply XY(), serpentine mapping, or output brightness a second time.
`;}
function validateOptions(project,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('RMT 导出选项无效');
 const p=E.validate(project),name=A.moduleName(options.namespaceName),mode=options.mode===undefined?'algorithm':options.mode;
 if(!['algorithm','frames'].includes(mode))throw Error('导出模式必须为 algorithm 或 frames');
 return {project:p,namespaceName:name,mode,driver:D.code({pin:p.pin,namespaceName:name})};
}
function exportBundle(project,points,options={}){
 const {project:p,namespaceName:name,mode,driver}=validateOptions(project,options);
 if(!Array.isArray(points)||points.length!==199||new Set(points.map(pt=>pt.wire)).size!==199||points.some(pt=>!Number.isInteger(pt.wire)||pt.wire<0||pt.wire>=199))throw Error('RMT 导出需要完整的 199 灯接线表');
 const base=mode==='algorithm'?A.exportBundle(p,points,{namespaceName:name}):null;
 const rawHeader=base?base.files[name+'.h']:frameModule(p,points,name);
 const marker=artifact=>`/* LAMP_STUDIO_RMT_V1:${encode(JSON.stringify({revision:1,mode,namespaceName:name,artifact,project:p}))} */\n`;
 const header=marker('integration')+rawHeader,source=marker('standalone')+rawHeader+'\n'+driver;
 const sketchName=name+'_RMT',sketchPath=sketchName+'/'+sketchName+'.ino',headerPath='integration/'+name+'.h';
 const frameCount=Math.round(p.duration*p.fps),rawFrameBytes=frameCount*199*3;
 const stats={sourceBytes:bytes(source),moduleSourceBytes:bytes(header),resourceBytesEstimate:base?base.stats.resourceBytesEstimate:rawFrameBytes,rawFrameBytes,frameCount,outputBufferBytes:597,rmtSymbolBufferBytes:(199*24+1)*4,layers:base?.stats.layers??p.layers.filter(l=>l.enabled).length};
 const readme=`# ${name} · ESP32 RMT 灯效包

本包针对店家提供的 199 灯、8 排蛇形接线代码制作。导出方式：${mode==='algorithm'?'算法实时计算，不保存 RGB 帧表':'逐帧播放，完整保存最终 RGB 结果'}。效果 ${p.duration} 秒，${p.fps} FPS。

## 合入店家的现有固件（你的主要用途）

1. 把 integration/${name}.h 复制到店家的工程目录。
2. 参照 integration/接入店家原固件.txt：保留原来的 RMT 初始化、leds 数组和 show()；复制提供的播放函数，在原 setup() 初始化后调用 begin()，原 loop() 中调用 tick()，替换旧的 tuanExplode() 调用。
3. tick() 的限帧不会调用 delay()；店家原 show() 若阻塞发送，会保留其原有发送耗时。工程中只能有一处控制同一组灯，原动画不要继续覆盖输出。
4. 导出的 RGB 已按实际接线排序，并包含全局输出亮度 ${p.master}/255。按字段复制到店家的 {g,r,b} 结构，不要直接 memcpy，不要再做蛇形映射或亮度缩放。
5. 多种效果用不同模块名导出，共用店家原有一套驱动；切换时调用该效果的 begin()。单独测试文件夹不参与现有固件编译。

## 单独编译与实灯测试

打开 ${sketchPath}。该文件自身包含效果、RMT 驱动、setup() 和 loop()，不需要另放自定义头文件或安装第三方灯库；Arduino 草稿文件夹和 .ino 同名。

默认参数沿用店家示例：GPIO ${p.pin}、199 灯、GRB 字节顺序、40 MHz RMT 时钟，0 位高/低 16/34 tick，1 位高/低 32/18 tick，帧尾低电平 60 微秒。2.x 使用 driver/rmt.h，3.x 使用 driver/rmt_tx.h，按 Arduino-ESP32 主版本选择。具体控制板型号、可用 GPIO、供电和 LED 型号仍应与店家确认；RMT 本身不能确定芯片型号或灯珠协议。

独立示例用于测试，会替代板上原程序；合入已有产品固件请使用上面的 integration 文件。先用店家实际板型和原分区设置编译，再做实灯验收。

导出器已用 Arduino CLI 1.5.1，在 Arduino-ESP32 2.0.17 与 3.3.11 的经典 ESP32 默认配置上，完成火焰、星流、逐帧及空白草稿的完整编译；2.0.17 还验证了店家原代码接入片段。该验证不替代你当前工程、实际板型及原产品固件的编译和实灯测试。算法模式请保留正常浮点语义，不启用 fast-math。

## 体积与内存

效果静态数据估算：${stats.resourceBytesEstimate} 字节。完整 .ino 文本：${stats.sourceBytes} 字节，其中工程回读注释不进入固件。RGB 输出缓冲：597 字节。独立 RMT 示例还使用 ${stats.rmtSymbolBufferBytes} 字节的发送符号缓冲，另有驱动、算法缓存、栈及系统开销；合入原驱动不重复分配这一发送缓冲。

上述不是完整固件大小，Flash / RAM 要以店家的目标板、原固件和分区设置编译结果为准。${mode==='frames'?'帧数组位于程序存储区，不在启动时整份复制到 RAM。时长、帧率会直接增加数组体积。':'时长、帧率不会线性增加算法静态数据。算法运算耗时须在真实控制器上测量。'}

## 返回编辑器继续修改

优先导入 project.lamp.json。也可导入未修改的 ${sketchName}.ino 或 ${name}.h；编辑器会核对完整源码，店家修改过的文件不能仅凭注释冒充预览一致。
`;
 return {project:p,namespaceName:name,mode,sketchName,sketchPath,headerPath,files:{[sketchPath]:source,[headerPath]:header,'integration/接入店家原固件.txt':integrationExample(name),'project.lamp.json':JSON.stringify(p,null,2),'README.md':readme},stats,notes:base?.notes??[]};
}
function importIno(source,points){
 if(typeof source!=='string'||source.length>10000000)throw Error('INO 文件不能超过 10 MB');
 const normalized=source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),match=normalized.match(/\/\* LAMP_STUDIO_RMT_V1:([A-Za-z0-9+/=]+) \*\//);
 if(!match)throw Error('不是 RMT 导出文件');
 let payload;try{payload=JSON.parse(decode(match[1]));}catch{throw Error('RMT 工程信息损坏');}
 if(payload.revision!==1)throw Error('RMT 导出版本暂不支持');
 if(!['integration','standalone'].includes(payload.artifact))throw Error('RMT 文件类型不受支持');
 const bundle=exportBundle(payload.project,points,{namespaceName:payload.namespaceName,mode:payload.mode});
 const expected=bundle.files[payload.artifact==='standalone'?bundle.sketchPath:bundle.headerPath];
 if(normalized.trim()!==expected.replace(/\r\n/g,'\n').trim())throw Error('RMT 源码或参数已被外部修改，不能仅凭注释还原；请导入原导出文件或工程 JSON。');
 return {project:bundle.project,kind:'rmt',message:'已完整回读 RMT 灯效工程并核对源码，可继续编辑；实灯效果仍以目标控制板验收为准。'};
}
root.StudioRmt={validateOptions,exportBundle,importIno};if(typeof module!=='undefined')module.exports=root.StudioRmt;
})(typeof window==='undefined'?globalThis:window);
