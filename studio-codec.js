(function(root){
'use strict';
const E=root.StudioEngine||(typeof require==='function'?require('./studio-engine.js'):null);
const knownSource="#include \"driver/rmt.h\"\n#define DATA_PIN 18\n#define NUM_LEDS 199\n#define ROWS 8\n#define BRIGHTNESS 5\n#define EXPLODE_SPEED 35\nconst uint8_t rowLengths[ROWS]={28,28,27,26,26,25,22,17};\nuint16_t rowStart[ROWS];\n#define RMT_CH RMT_CHANNEL_0\n#define T0H 16\n#define T0L 34\n#define T1H 32\n#define T1L 18\ntypedef struct{uint8_t g,r,b;}Color_t;\nColor_t leds[NUM_LEDS];\nrmt_item32_t bit0={{{T0H,1,T0L,0}}};\nrmt_item32_t bit1={{{T1H,1,T1L,0}}};\nstruct Particle{float x,y;float vx,vy;uint8_t life;uint8_t hue;bool active;};\nParticle particles[80];\nvoid hsv2rgb(uint8_t h,uint8_t s,uint8_t v,uint8_t &r,uint8_t &g,uint8_t &b){\nif(s==0){r=g=b=v;return;}\nuint8_t region=h/43,remainder=(h-region*43)*6;\nuint8_t p=(v*(255-s))>>8,q=(v*(255-((s*remainder)>>8)))>>8,t=(v*(255-((s*(255-remainder))>>8)))>>8;\nswitch(region){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;default:r=v;g=p;b=q;break;}}\nvoid setup(){\nrmt_config_t cfg;\ncfg.rmt_mode=RMT_MODE_TX;cfg.channel=RMT_CH;cfg.gpio_num=(gpio_num_t)DATA_PIN;cfg.clk_div=2;cfg.mem_block_num=1;\ncfg.tx_config.loop_en=false;cfg.tx_config.carrier_freq_hz=0;cfg.tx_config.carrier_duty_percent=0;cfg.tx_config.carrier_level=RMT_CARRIER_LEVEL_LOW;cfg.tx_config.carrier_en=false;cfg.tx_config.idle_level=RMT_IDLE_LEVEL_LOW;cfg.tx_config.idle_output_en=true;\nrmt_config(&cfg);rmt_driver_install(RMT_CH,0,0);\nrowStart[0]=0;for(int i=1;i<ROWS;i++)rowStart[i]=rowStart[i-1]+rowLengths[i-1];\nfor(int i=0;i<80;i++) particles[i].active=false;\n}\nuint16_t XY(uint8_t x,uint8_t y){if(y>=ROWS||x>=rowLengths[y])return 0xFFFF;return y%2==0?rowStart[y]+x:rowStart[y]+(rowLengths[y]-1-x);}\nvoid show(){static rmt_item32_t items[NUM_LEDS*24];int idx=0;for(int i=0;i<NUM_LEDS;i++){uint8_t bytes[3]={leds[i].g,leds[i].r,leds[i].b};for(int b=0;b<3;b++)for(int bit=7;bit>=0;bit--)items[idx++]=(bytes[b]&(1<<bit))?bit1:bit0;}rmt_write_items(RMT_CH,items,idx,true);delayMicroseconds(60);}\nvoid setPixel(uint8_t x,uint8_t y,uint8_t r,uint8_t g,uint8_t b){uint16_t idx=XY(x,y);if(idx==0xFFFF)return;leds[idx].g=g;leds[idx].r=r;leds[idx].b=b;}\nuint8_t maxCol(){uint8_t m=0;for(int i=0;i<ROWS;i++)if(rowLengths[i]>m)m=rowLengths[i];return m;}\nvoid clearAll(){for(int i=0;i<NUM_LEDS;i++){leds[i].g=0;leds[i].r=0;leds[i].b=0;}}\nvoid spawnExplosion(float cx,float cy){for(int i=0;i<80;i++){if(!particles[i].active){float angle=random(0,628)/100.0f;float speed=random(30,80)/100.0f;particles[i].x=cx;particles[i].y=cy;particles[i].vx=cos(angle)*speed;particles[i].vy=sin(angle)*speed*0.45f;particles[i].life=random(25,45);particles[i].hue=random(0,60);particles[i].active=true;break;}}}\nvoid tuanExplode(){static uint8_t explodeTimer=0;float cx=maxCol()/2.0f;float cy=ROWS/2.0f;clearAll();explodeTimer++;if(explodeTimer>EXPLODE_SPEED){spawnExplosion(cx,cy);if(random(100)<25){spawnExplosion(random(0,maxCol()),random(0,ROWS));}explodeTimer=0;}for(int i=0;i<80;i++){if(!particles[i].active)continue;Particle &p=particles[i];p.x+=p.vx;p.y+=p.vy;p.life--;if(p.life<=0){p.active=false;continue;}uint8_t bright=map(p.life,0,45,0,BRIGHTNESS*11);uint8_t r,g,b;hsv2rgb(p.hue,255,bright,r,g,b);int px=round(p.x);int py=round(p.y);if(px>=0&&px<maxCol()&&py>=0&&py<ROWS&&px<rowLengths[py]){setPixel(px,py,r,g,b);}}show();delay(22);}\nvoid loop(){tuanExplode();}\n";
function clean(s){return s.replace(/\\([#_*<>])/g,'$1').replace(/\*{3}/g,'*').replace(/random\(0,\s*maxCol\s*\)/g,'random(0,maxCol())').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\r\n]*/g,'').replace(/\r/g,'');}
function signature(s){return clean(s).replace(/(#define\s+(?:DATA_PIN|BRIGHTNESS|EXPLODE_SPEED)\s+)\d+/g,'$1@').replace(/\s+/g,'');}
function base64(s){return typeof Buffer!=='undefined'?Buffer.from(s,'utf8').toString('base64'):btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(''));}
function unbase64(s){return typeof Buffer!=='undefined'?Buffer.from(s,'base64').toString('utf8'):new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));}
function bake(project,points){const p=E.validate(project),count=Math.round(p.duration*p.fps),bytes=new Uint8Array(count*199*3);
 for(let f=0;f<count;f++){const values=E.render(p,points,f/p.fps);points.forEach((pt,i)=>{for(let c=0;c<3;c++)bytes[(f*199+pt.wire)*3+c]=values[i][c];});}
 return {project:p,count,bytes};
}
function codeFor(baked){const {project:p,count,bytes}=baked,rows=[];for(let i=0;i<bytes.length;i+=48)rows.push('  '+Array.from(bytes.slice(i,i+48)).join(','));
 return `// Lamp Studio v1. ESP32 + FastLED; WS2812B-compatible GRB assumed.
// Frame data includes output brightness, layer composition and serpentine mapping.
// Install FastLED in Arduino Library Manager. Keep this INO in a folder of the same name.
/* LAMP_STUDIO_V1:${base64(JSON.stringify(p))} */
#include <Arduino.h>
#include <FastLED.h>
#include <pgmspace.h>
#define DATA_PIN ${p.pin}
#define NUM_LEDS 199
#define FRAME_COUNT ${count}
#define FRAME_US ${Math.round(1000000/p.fps)}UL
CRGB leds[NUM_LEDS];
const uint8_t frameData[] PROGMEM = {
${rows.join(',\n')}
};
static_assert(sizeof(frameData) == FRAME_COUNT * NUM_LEDS * 3, "Invalid frame length");
void setup() {
  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(255);
  FastLED.setDither(0);
  FastLED.clear(true);
}
void loop() {
  static uint32_t previous = micros();
  static uint16_t frame = 0;
  uint32_t now = micros();
  if ((uint32_t)(now - previous) < FRAME_US) return;
  previous += FRAME_US;
  uint32_t offset = (uint32_t)frame * NUM_LEDS * 3;
  for (uint16_t i = 0; i < NUM_LEDS; ++i) {
    leds[i].r = pgm_read_byte(frameData + offset + i * 3);
    leds[i].g = pgm_read_byte(frameData + offset + i * 3 + 1);
    leds[i].b = pgm_read_byte(frameData + offset + i * 3 + 2);
  }
  FastLED.show();
  frame = (frame + 1) % FRAME_COUNT;
}
`;
}
function exportIno(p,points){return codeFor(bake(p,points));}
function importIno(source,points){if(typeof source!=='string'||source.length>10000000)throw Error('INO 文件不能超过 10 MB');const s=source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');const marker=s.match(/\/\* LAMP_STUDIO_V1:([A-Za-z0-9+/=]+) \*\//);
 if(s.includes('LAMP_STUDIO_RMT_V1:')){const R=root.StudioRmt||(typeof require==='function'?require('./studio-rmt.js'):null);if(!R)throw Error('RMT 导出模块尚未加载，请刷新编辑器');return R.importIno(s,points);}
 if(s.includes('LAMP_STUDIO_ALGORITHM_V1:')){const A=root.StudioAlgorithm||(typeof require==='function'?require('./studio-algorithm.js'):null);if(!A)throw Error('算法导出模块尚未加载，请刷新编辑器');return A.importIno(s,points);}
 if(marker){let p;try{p=E.validate(JSON.parse(unbase64(marker[1])));}catch(err){throw Error('工程信息损坏：'+err.message);}const expected=exportIno(p,points);if(s.trim()!==expected.trim())throw Error('此 INO 的代码或帧数据已被外部修改，不能仅凭工程注释还原效果。请导入未修改的导出文件。');return {project:p,kind:'studio',message:'已完整回读 INO：图层、区域、关键帧及逐帧数据核对一致。'};}
 if(signature(s)===signature(knownSource)){
   const c=clean(s),get=k=>Number(c.match(new RegExp('#define\\s+'+k+'\\s+(\\d+)'))?.[1]);const p=E.project('legacy');p.pin=get('DATA_PIN');p.layers[0].legacyBrightness=get('BRIGHTNESS');p.layers[0].legacyInterval=get('EXPLODE_SPEED');
   return {project:E.validate(p),kind:'legacy',message:'已识别你提供的原始粒子 INO。保留算法与参数；预览使用固定随机种子，路径不保证与实灯逐帧相同。'};
 }
 throw Error('暂不支持这份外部 INO。当前支持：本编辑器导出的完整 INO，以及已提供的 tuanExplode 粒子程序（允许调整 DATA_PIN / BRIGHTNESS / EXPLODE_SPEED）。未知代码不会被当作已有灯效播放。');
}
root.StudioCodec={bake,exportIno,importIno,knownSource,signature};if(typeof module!=='undefined')module.exports=root.StudioCodec;
})(typeof window==='undefined'?globalThis:window);
