(function(root){
'use strict';
const FONT={
' ':['000','000','000','000','000','000','000'],
A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01110','10001','10000','10111','10001','10001','01110'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','00010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
'0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
'!':['1','1','1','1','1','0','1'],'?':['01110','10001','00001','00010','00100','00000','00100'],'.':['0','0','0','0','0','1','1'],':':['0','1','1','0','1','1','0'],'-':['000','000','000','111','000','000','000'],'+':['000','010','010','111','010','010','000'],'♥':['0110110','1111111','1111111','1111111','0111110','0011100','0001000']};
const ICONS={
 smile:['0011100','0100010','1010101','1000001','1010101','0101010','0011100'],
 wink:['0011100','0100010','1010111','1000001','1010101','0101010','0011100'],
 cool:['0011100','0100010','1111111','1110111','1000001','0101010','0011100'],
 love:['0011100','0100010','1110111','1111111','1000001','0101010','0011100'],
 surprise:['0011100','0100010','1010101','1000001','1001001','0101010','0011100'],
 angry:['0011100','0100010','1100011','1010101','1000001','0101010','0011100'],
 invader:['0010100','0001000','0011100','0111110','1101011','1111111','0100010'],
 cat:['1000001','1100011','1111111','1010101','1001001','0101010','0011100'],
 skull:['0111110','1111111','1001001','1001001','1111111','0101010','0111110'],
 music:['0001111','0001001','0001001','0001001','0111001','1110111','0110110'],
 lightning:['0001100','0011000','0110000','1111110','0001100','0011000','0010000']};
const GLYPH_NAMES={smile:'笑脸',wink:'眨眼',cool:'墨镜',love:'爱心眼',surprise:'惊讶',angry:'生气',invader:'像素外星人',cat:'猫猫',skull:'骷髅',music:'音符',lightning:'闪电'};
// Optical geometry is independent of row indices and serpentine wire addresses.
const SPATIAL=['hexagram','heart','emoji','text','spin','spiral','comet','wave','rain'];
function columns(rows){return Array.from({length:rows[0].length},(_,x)=>rows.reduce((b,r,y)=>b|(r[x]==='1'?1<<y:0),0));}
function textColumns(text){const out=[];for(const ch of Array.from(text.toUpperCase())){out.push(...columns(FONT[ch]||FONT['?']),0);}return out;}
const NAMES={whiteSweep:'参考复刻 · 冷白星流',showcase:'视频同款 · 分区编排',hexagram:'六芒星',heart:'心跳爱心',flame:'底部火焰',emoji:'像素表情',text:'滚动文字',spin:'旋转眩光',strobe:'交错频闪',rain:'数字雨滴',comet:'彗星拖尾',equalizer:'律动均衡器',spiral:'星云旋涡',sparkle:'星空闪烁',wave:'海浪推进',checker:'棋盘翻转'};
const PRESETS=[
 ['灯光效果','whiteSweep','冷白星流 · 参考','单团外扫 · 短促残星'],
 ['灯光效果','magic-comet','魔法扫帚','扫过留下闪闪星光'],
 ['灯光效果','showcase','视频分区编排','红橙白 · 四段节拍'],
 ['灯光效果','flame','底部火焰','跳动火舌'],['灯光效果','blue-fire','冰蓝焰火','冷色渐变'],['灯光效果','rain','数字雨滴','向下流淌'],['灯光效果','comet','彗星拖尾','长尾划过'],['灯光效果','spiral','星云旋涡','旋臂流动'],['灯光效果','sparkle','星空闪烁','随机明灭'],['灯光效果','wave','海浪推进','起伏波峰'],
 ['灯光效果','spin','旋转眩光','多束旋转'],['灯光效果','strobe','交错流水频闪','错排追逐'],['灯光效果','strobe-rows','左右交替','节拍频闪'],['灯光效果','equalizer','律动均衡器','程序节奏'],['灯光效果','checker','棋盘翻转','交错色块'],
 ['图案与文字','text','滚动文字','文字 / 数字']
];

function decorate(l){if(!(l.type in NAMES))return l;l.name=NAMES[l.type];l.cx=12;l.cy=3;
 if(SPATIAL.includes(l.type)){l.geometry='physical-v2';l.cx=12.5;l.cy=3;}
 if(l.type==='text'){delete l.geometry;l.cx=12;l.cy=3;l.text='HELLO';l.bitmap=textColumns(l.text);l.direction='left';l.color='#83edff';}
 if(l.type==='emoji'){l.glyph='smile';l.color='#ffd34f';}
 if(l.type==='heart')l.color='#ff3c71';
 if(l.type==='flame'){l.color='#ff3908';l.accent='#fff0ad';}
 if(l.type==='spin'||l.type==='spiral'){l.beams=l.type==='spin'?3:2;l.color=l.type==='spin'?'#b7deff':'#b28aff';}
 if(l.type==='strobe'){l.pattern='chase';l.color='#9cd3ff';l.speed=.7;}
 if(l.type==='rain')l.color='#44e9ae';if(l.type==='comet')l.color='#a9d8ff';if(l.type==='equalizer')l.color='#93ff57';if(l.type==='wave')l.color='#35b9ff';return l;
}
function preset(id,E){if(!PRESETS.some(p=>p[1]===id))return null;const base=id==='magic-comet'?'scan':id==='blue-fire'?'flame':id.startsWith('emoji-')?'emoji':id==='love-message'?'text':id==='strobe-rows'?'strobe':id;
 const p=E.project('blank');p.name=PRESETS.find(p=>p[1]===id)[2];p.layers=[E.layer(base)];p.layers[0].end=p.duration;p.loopFade=['strobe','checker','text','heart','emoji'].includes(base)?0:.4;
 if(['text','flame','showcase'].includes(id))delete p.layout;if(id==='showcase'){p.duration=16;p.fps=30;p.loopFade=0;p.layers[0].end=16;p.layers[0].tuning={bpm:120};}const l=p.layers[0];if(id==='blue-fire'){l.color='#145cff';l.accent='#9ffaff';}
 if(id==='emoji-cool')l.glyph='cool';
 if(id==='emoji-party'){l.cx=4;const heart=E.layer('heart'),alien=E.layer('emoji');heart.cx=12;alien.cx=20;alien.cy=2.8;alien.glyph='invader';alien.color='#73ff74';p.layers.push(heart,alien);}
 if(id==='love-message'){l.text='LOVE';l.bitmap=textColumns(l.text);l.direction='still';l.scale=.8;l.cx=9.5;l.cy=3;const heart=E.layer('heart');heart.cx=22;heart.cy=2.5;heart.scale=.75;p.layers.push(heart);}
 if(id==='whiteSweep'){delete p.layout;l.seed=4;l.color='#e8efff';l.name='冷白星流';p.name='冷白星流 · 视频参考';p.duration=11;p.fps=60;l.end=11;p.loopFade=0;}if(id==='strobe-rows')l.pattern='halves';if(id==='magic-comet'){delete p.layout;l.name='扫帚光束';l.color='#adcaff';l.angle=-12;l.speed=.65;l.tuning={...l.tuning,width:1,interval:24,frequency:1,softness:.6};l.trail={enabled:true,life:2.4,density:.8,brightness:1.8,twinkle:5,color:'#ffe5b3',followColor:false,seed:27};p.loopFade=0;}return p;
}
const fract=x=>x-Math.floor(x),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
function bottom(x){const lengths=[28,28,27,26,26,25,22,17];for(let y=7;y>=0;y--)if(x<lengths[y])return y;return 0;}
function lineDistance(x,y,a,b){const vx=b[0]-a[0],vy=b[1]-a[1],t=clamp(((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy));return Math.hypot(x-a[0]-t*vx,y-a[1]-t*vy);}
function filteredPixel(get,x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;return get(ix,iy)*(1-fx)*(1-fy)+get(ix+1,iy)*fx*(1-fy)+get(ix,iy+1)*(1-fx)*fy+get(ix+1,iy+1)*fx*fy;}
function local(l,x,y){const a=-l.angle*Math.PI/180,dx=(x-l.cx)/l.scale,dy=(y-l.cy)/l.scale;return [dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)];}
// Sample a compact footprint, not a whole neighbouring row. This keeps eyes and letter gaps open.
function footprint(get,x,y){let sum=0;for(const dx of [-.18,0,.18])for(const dy of [-.18,0,.18])sum+=get(Math.floor(x+dx+.5),Math.floor(y+dy+.5));return sum/9;}
const stroke=(d,w=.24)=>smooth((w+.25-Math.abs(d))/.5);
function segment(x,y,a,b,w=.24){return stroke(lineDistance(x,y,a,b),w);}
function heartShape(x,y){const u=x/2.65,v=-(y-.1)/2.65,f=(u*u+v*v-1)**3-u*u*v*v*v;return f<=0?1:0;}
function vectorHeart(x,y){let v=0;for(const dx of [-.16,0,.16])for(const dy of [-.16,0,.16])v+=heartShape(x+dx,y+dy);return v/9;}
function face(glyph,x,y){
 let v=stroke(Math.hypot(x,y)-3,.21);
 const dot=(cx,cy,r=.34)=>smooth((r+.25-Math.hypot(x-cx,y-cy))/.5);
 const mouth=()=>Math.abs(x)<1.8?stroke(y-(1.55-.32*x*x),.21):0;
 if(glyph==='cool'){
   v=Math.max(v,segment(x,y,[-2.5,-1],[2.5,-1],.22));
   for(const cx of [-1.35,1.35])v=Math.max(v,smooth((.8-Math.abs(x-cx))/.25)*smooth((.65-Math.abs(y+.65))/.25));
 }else if(glyph==='love'){
   for(const cx of [-1.25,1.25])v=Math.max(v,vectorHeart((x-cx)*3.9,(y+.85)*3.9));
 }else if(glyph==='angry'){
   v=Math.max(v,segment(x,y,[-1.9,-1.45],[-.6,-.8]),segment(x,y,[.6,-.8],[1.9,-1.45]));
 }else{
   v=Math.max(v,dot(-1.2,-.9));
   v=Math.max(v,glyph==='wink'?segment(x,y,[.65,-.9],[1.8,-.9]):dot(1.2,-.9));
 }
 if(glyph==='surprise')v=Math.max(v,stroke(Math.hypot(x,y-1.1)-.65,.21));
 else if(glyph==='angry')v=Math.max(v,Math.abs(x)<1.7?stroke(y-(.95+.25*x*x),.21):0);
 else v=Math.max(v,mouth());
 return v;
}
function symbol(rows,l,x,y){const a=-l.angle*Math.PI/180,dx=(x-l.cx)/l.scale,dy=(y-l.cy)/l.scale,px=dx*Math.cos(a)-dy*Math.sin(a)+(rows[0].length-1)/2,py=dx*Math.sin(a)+dy*Math.cos(a)+3;const get=(xx,yy)=>rows[yy]?.[xx]==='1'?1:0;return l.geometry==='physical-v1'?filteredPixel(get,px,py):get(Math.round(px),Math.round(py));}
function intensity(l,x,y,t){const q=t*l.speed,dx=x-l.cx,dy=y-l.cy,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx)-l.angle*Math.PI/180;
 if(l.geometry==='physical-v2'&&l.type==='heart'){const [xx,yy]=local(l,x,y),pulse=.65+.35*(Math.exp(-Math.pow((fract(q*.65)-.1)/.07,2))+.6*Math.exp(-Math.pow((fract(q*.65)-.28)/.09,2)));return vectorHeart(xx,yy)*Math.min(1,pulse);}
 if(l.geometry==='physical-v2'&&l.type==='emoji'){const [xx,yy]=local(l,x,y);if(['smile','wink','cool','love','surprise','angry'].includes(l.glyph))return face(l.glyph,xx,yy)*(.8+.2*Math.cos(q*2));const rows=ICONS[l.glyph]||ICONS.smile;return footprint((x,y)=>rows[y]?.[x]==='1'?1:0,xx+3,yy+3)*(.8+.2*Math.cos(q*2));}
 if(l.type==='heart'){const pulse=.65+.35*(Math.exp(-Math.pow((fract(q*.65)-.1)/.07,2))+.6*Math.exp(-Math.pow((fract(q*.65)-.28)/.09,2)));return symbol(FONT['♥'],l,x,y)*Math.min(1,pulse);}
 if(l.type==='emoji'){const rows=ICONS[l.glyph]||ICONS.smile;return symbol(rows,l,x,y)*(.8+.2*Math.cos(q*2));}
 if(l.type==='text'){const bits=l.bitmap||textColumns(l.text||'HELLO'),width=bits.length,phase=(q*5+26)%(width+30),start=l.direction==='still'||l.speed===0?l.cx-width*l.scale/2:l.direction==='right'?-width*l.scale+((q*5+width+2)%(width+30))*l.scale:28-phase*l.scale;const xx=(x-start)/l.scale,yy=(y-l.cy)/l.scale+3,get=(x,y)=>x>=0&&x<width&&y>=0&&y<7&&(bits[x]&(1<<y))?1:0;return l.geometry==='physical-v2'?footprint(get,xx-.5,yy):l.geometry==='physical-v1'?filteredPixel(get,xx-.5,yy):get(Math.floor(xx),Math.round(yy));}
 if(l.type==='hexagram'){const theta=-l.angle*Math.PI/180,xx=(dx*Math.cos(theta)-dy*Math.sin(theta))/l.scale,yy=(dx*Math.sin(theta)+dy*Math.cos(theta))/l.scale,tri=[[0,-3.3],[2.86,1.65],[-2.86,1.65]];let d=99;for(const sign of [-1,1])for(let i=0;i<3;i++)d=Math.min(d,lineDistance(xx,yy,tri[i].map(v=>v*sign),tri[(i+1)%3].map(v=>v*sign)));return Math.exp(-Math.pow(d/.48,4))*(.72+.28*Math.sin(q*2)**2);}
 if(l.type==='flame'){const floor=bottom(x),height=(2.8+1.25*Math.sin(x*.8+q*3.1)+.85*Math.sin(x*1.9-q*5.3))*l.scale,dist=floor-y;return smooth((height-dist)/1.8)*(.75+.25*Math.sin(x*1.5-q*8+dist*.9)**2);}
 if(l.type==='spin'||l.type==='spiral'){const theta=a-q*1.4-(l.type==='spiral'?r*.35:0),v=Math.max(0,Math.cos(theta*l.beams));return clamp(Math.pow(v,Math.max(1,9/l.scale))*(.25+.75*Math.exp(-r/18))+.6*Math.exp(-r*r/1.2));}
 if(l.type==='strobe'){if(l.pattern==='halves')return ((x<14?0:1)===Math.floor(q*2)%2&&fract(q*2)<.65)?1:0;if(l.pattern==='checker')return (Math.floor(x/Math.max(1,Math.round(l.scale)))+y+Math.floor(q*3))%2===0?1:0;const phase=fract(q*2-x*.12+(y%2)*.5);return phase<.23?1:0;}
 if(l.type==='rain'){const col=Math.floor(x/Math.max(1,Math.round(l.scale))),head=fract(q*.45+hash(col+l.seed))*13-2,d=head-y;return hash(col+l.seed*3)>.23&&d>=0&&d<4?Math.exp(-d*1.05):0;}
 if(l.type==='comet'){const rad=l.angle*Math.PI/180,xx=dx*Math.cos(rad)+dy*Math.sin(rad)+l.cx,yy=-dx*Math.sin(rad)+dy*Math.cos(rad)+l.cy;let out=0;for(let k=0;k<3;k++){const head=(q*7+k*13)%43-6,cy=2+Math.sin(k*2+q*.5)*2,d=head-xx;if(d>=-.6&&d<10)out+=Math.exp(-Math.max(0,d)/3)*Math.exp(-Math.pow((yy-cy)/(.48*l.scale),2));}return clamp(out);}
 if(l.type==='equalizer'){const b=Math.floor(x/Math.max(1,Math.round(l.scale*2))),height=1+6*(.5+.5*Math.sin(q*(2+hash(b+l.seed))+.8+b*1.3))**1.4,dist=bottom(x)-y;return smooth(height-dist);}
 if(l.type==='sparkle'){const phase=fract(q*(.2+hash(x*9+y)*.35)+hash(x*13+y+l.seed)),v=Math.max(0,1-Math.abs(phase-.5)*2);return Math.pow(v,Math.max(2,16/l.scale));}
 if(l.type==='wave'){const crest=3+Math.sin(x*.3-q*1.4)*2.5,dist=Math.abs(y-crest);return Math.exp(-Math.pow(dist/(.65*l.scale),2));}
 if(l.type==='checker'){const s=Math.max(1,Math.round(l.scale*2)),bit=(Math.floor(x/s)+Math.floor(y/s))%2,blend=.5+.5*Math.sin(q*3);return bit?blend:1-blend;}
 return null;
}
root.StudioPatterns={FONT,ICONS,GLYPH_NAMES,NAMES,PRESETS,SPATIAL,decorate,preset,intensity,textColumns,bottom};if(typeof module!=='undefined')module.exports=root.StudioPatterns;
})(typeof window==='undefined'?globalThis:window);
