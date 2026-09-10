(()=>{
'use strict';
const E=window.StudioEngine,C=window.StudioCodec,A=window.StudioAlgorithm,R=window.StudioRmt,P=window.StudioPatterns,T=window.StudioTuning,Trails=window.StudioTrails,$=id=>document.getElementById(id),points=E.mapping(E.clone(window.STUDIO_LAYOUT)),refs=window.STUDIO_LAYOUT.filter(p=>p.kind!=='control');
const names={flow:'冷白流光',scan:'柔光流水',breathe:'渐变呼吸',ripple:'扩散光环',particles:'星火粒子',paint:'静态绘制',legacy:'原始 INO',...P.NAMES};
for(const [type,name] of Object.entries(P.NAMES))if(!['hexagram','heart','emoji'].includes(type))$('addType').add(new Option(name,type));
for(const [id,name] of Object.entries(P.GLYPH_NAMES))$('glyph').add(new Option(name,id));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let project=E.project(),selected=0,time=0,playing=true,previous=0,undo=[],redo=[],selectedPixel=-1,frame=[],stroke=false,lastPaint=null,sliderEditing=false;
let paintRevision=0,lastDrawKey='';
const invalidateCanvas=()=>{paintRevision++;};
const STORE='lamp-studio-project-v1',isolated=new URLSearchParams(location.search).has('preview');
try{if(!isolated){const saved=localStorage.getItem(STORE),backup=localStorage.getItem(STORE+'-before-preset-cleanup'),restored=localStorage.getItem(STORE+'-cleanup-restored');
 if(backup&&restored!==backup){const original=E.validate(JSON.parse(backup));if(saved){localStorage.setItem(STORE+'-before-cleanup-undo',saved);try{undo.push(E.validate(JSON.parse(saved)));}catch{}}localStorage.setItem(STORE,JSON.stringify(original));localStorage.setItem(STORE+'-cleanup-restored',backup);project=original;$('saveState').textContent='已撤回删除 · 恢复原工程';}
 else if(saved){project=E.validate(JSON.parse(saved));$('saveState').textContent='已恢复本机工程';}
}}catch{$('saveState').textContent='本地存储不可用';}
const previewPreset=new URLSearchParams(location.search).get('preset');
if(isolated&&['whiteSweep','flame','blue-fire'].includes(previewPreset)){project=E.project(previewPreset);$('saveState').textContent='独立试播，不覆盖工程';}
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const referenceImage=new Image();referenceImage.src='reference.jpg';
referenceImage.onload=invalidateCanvas;
// A held output frame needs no new light textures or canvas commands. UI edits,
// resizing and asynchronous project imports still invalidate a paused picture.
for(const event of ['input','change','click','pointerdown','pointerup','keydown'])document.addEventListener(event,invalidateCanvas);
window.addEventListener('pointermove',()=>{if(stroke||drag)invalidateCanvas();});
new ResizeObserver(invalidateCanvas).observe(canvas);
document.addEventListener('visibilitychange',()=>{previous=0;invalidateCanvas();});
const outline=new Path2D('M 337 293 C 274 286 222 343 232 416 L 272 717 C 285 860 338 963 435 957 C 526 957 720 905 941 865 L 1543 737 C 1720 696 1773 621 1827 525 C 1878 442 1932 342 1906 326 C 1880 300 1711 309 1560 303 L 1140 308 Z');
function notify(msg,error=false){$('status').textContent=msg;$('status').classList.toggle('error',error);}
function saveLocal(){if(isolated){$('saveState').textContent='独立试播，不覆盖工程';return;}try{localStorage.setItem(STORE,JSON.stringify(project));$('saveState').textContent='已自动保存到本机';}catch{$('saveState').textContent='请另存工程文件';}}
function checkpoint(){undo.push(E.clone(project));if(undo.length>60)undo.shift();redo=[];updateHistory();}
function updateHistory(){$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;}
function setProject(p,message){checkpoint();project=E.validate(p);selected=0;time=0;playing=true;selectedPixel=-1;saveLocal();renderAll();notify(message);}
function mutate(fn,message){try{const draft=E.clone(project);fn(draft);const checked=E.validate(draft);checkpoint();project=checked;selected=Math.max(0,Math.min(selected,project.layers.length-1));time=Math.min(time,project.duration-1/project.fps);saveLocal();renderAll();if(message)notify(message);}catch(err){notify(err.message,true);renderAll();}}
function current(){return project.layers[selected];}
function updateRangeOutputs(){for(const key of ['opacity','speed','scale','angle']){const l=current();if(!l)continue;$(key+'Value').textContent=key==='opacity'?Math.round(l[key]*100)+'%':key==='angle'?l[key]+'°':l[key].toFixed(2)+'×';}}
function renderLayers(){
 $('layerCount').textContent=project.layers.length+' / 16';
 $('layers').innerHTML=project.layers.length?project.layers.map((l,i)=>({l,i})).reverse().map(({l,i})=>`<div class="layer-row ${i===selected?'selected':''}" data-layer="${i}" tabindex="0" role="button" aria-label="选择图层 ${escape(l.name)}" aria-pressed="${i===selected}"><button data-toggle="${i}" title="${l.enabled?'隐藏':'显示'}图层" aria-label="${l.enabled?'隐藏':'显示'} ${escape(l.name)}">${l.enabled?'●':'○'}</button><div class="name">${escape(l.name)}<small>${names[l.type]} · ${l.start.toFixed(1)}–${l.end.toFixed(1)}s</small></div><span class="dot" style="background:${l.color}"></span></div>`).join(''):'<div class="empty">添加一个图层开始。</div>';
 ['layerUp','layerDown','duplicate','deleteLayer'].forEach(id=>$(id).disabled=!current());$('addLayer').disabled=project.layers.length>=16;$('duplicate').disabled=!current()||project.layers.length>=16;
}
function renderInspector(){const l=current();$('inspector').classList.toggle('hide',!l);$('inspectorEmpty').classList.toggle('hide',!!l);$('typeLabel').textContent=l?names[l.type]:'';if(!l)return;
 for(const key of ['color','blend','speed','scale','angle','cx','cy','seed','start','end','fadeIn','fadeOut','legacyBrightness','legacyInterval'])$(key).value=l[key];
 $('layerName').value=l.name;$('opacity').value=l.opacity*100;updateRangeOutputs();$('start').max=project.duration-1/project.fps;$('end').max=project.duration;
 $('geometryField').classList.toggle('hide',!P.SPATIAL.includes(l.type));$('geometry').checked=!!l.geometry;
 $('motionSection').classList.toggle('hide',l.type==='paint');$('legacySection').classList.toggle('hide',l.type!=='legacy');$('color').disabled=['legacy','showcase'].includes(l.type);
 $('scale').closest('.field').classList.toggle('hide',['legacy','breathe','showcase','whiteSweep'].includes(l.type));$('angle').closest('.field').classList.toggle('hide',!['flow','scan','hexagram','heart','emoji','spin','spiral','comet'].includes(l.type));$('cx').closest('.two-cols').classList.toggle('hide',!['ripple','particles','hexagram','heart','emoji','text','spin','spiral'].includes(l.type));$('seed').closest('.field').classList.toggle('hide',!['particles','legacy','rain','sparkle','equalizer','whiteSweep','flame'].includes(l.type));
 document.querySelector('label[for="scale"]').textContent=({text:'字号',hexagram:'图案大小',heart:'图案大小',emoji:'图案大小',flame:'整体缩放',spin:'光束宽度',spiral:'旋臂宽度',equalizer:'柱条宽度',rain:'雨滴宽度',checker:'方块大小'})[l.type]||'光团大小';
 const fields={textField:l.type==='text',directionField:l.type==='text',textHint:l.type==='text',glyphField:l.type==='emoji',accentField:l.type==='flame',beamsField:['spin','spiral'].includes(l.type),patternField:l.type==='strobe'};
 for(const [id,show] of Object.entries(fields))$(id).classList.toggle('hide',!show);$('patternSection').classList.toggle('hide',!Object.values(fields).some(Boolean));
 if(l.type==='text'){$('textContent').value=l.text;$('textDirection').value=l.direction;}if(l.type==='emoji')$('glyph').value=l.glyph;if(l.type==='flame')$('accent').value=l.accent;if(l.beams)$('beams').value=l.beams;if(l.pattern)$('patternMode').value=l.pattern;
 renderTuning(l);renderTrail(l);
 $('maskCount').textContent=l.mask.reduce((a,b)=>a+b,0)+' / 199';
 $('keys').innerHTML=l.keys.length?l.keys.map((k,i)=>`<div class="key"><button data-seek-key="${i}">${k.time.toFixed(2)}s　${Math.round(k.value*100)}%</button><button data-delete-key="${i}" aria-label="删除 ${k.time.toFixed(2)} 秒关键帧">删除</button></div>`).join(''):'<small>尚无关键帧，使用图层亮度。</small>';
}

function renderTrail(l){const supported=Trails.TYPES.includes(l.type),o=l.trail||{...Trails.DEFAULTS,enabled:false};$('trailSection').classList.toggle('hide',!supported);$('trailEnabled').checked=o.enabled;$('trailFields').classList.toggle('hide',!o.enabled);$('trailFields').innerHTML=Trails.FIELDS.map(([key,label,min,max,step,unit])=>`<div class="tuning-field"><label for="trail-${key}">${label}</label><div class="tuning-pair"><input type="range" id="trail-${key}" data-trail="${key}" min="${min}" max="${max}" step="${step}" value="${o[key]}"><input type="number" aria-label="${label}数值" data-trail-number="${key}" min="${min}" max="${max}" step="${step}" value="${o[key]}"><small>${unit}</small></div></div>`).join('')+`<div class="trail-color"><label><input type="checkbox" data-trail="followColor" ${o.followColor?'checked':''}>跟随主体颜色</label><label for="trail-color">星光颜色</label><input id="trail-color" type="color" data-trail="color" value="${o.color}" ${o.followColor?'disabled':''}></div>`;}
$('trailEnabled').onchange=()=>mutate(p=>{p.layers[selected].trail={...Trails.DEFAULTS,...p.layers[selected].trail,enabled:$('trailEnabled').checked};},$('trailEnabled').checked?'星光拖尾已开启：扫过的灯位会留下闪烁星点。':'已关闭星光拖尾，参数保留。');
// Keep controls mounted while editing. Replacing their parent on `change`
// discards focus, breaks held arrow keys and can swallow the next mouse click.
function bindParameterPanel(id,keyOf,apply,sync,message){
 const host=$(id);let editing=null;
 const update=(e,commit,silent=false)=>{
  const el=e.target,key=keyOf(el);if(!key||!el.isConnected||!current())return;
  try{
   if(el.value==='')throw Error('请输入完整数值；已恢复上次有效值。');
   apply(el,key,()=>{if(editing!==el){checkpoint();editing=el;}});
   el.removeAttribute('aria-invalid');sync(el);
   if(commit&&!silent)notify(message);
  }catch(err){
   // Incomplete typing is allowed; on commit, restore the one invalid field.
   if(commit){sync();notify(err.message,true);}
  }
 };
 host.oninput=e=>update(e,false);host.onchange=e=>update(e,true);
 host.onpointerdown=()=>{editing=null;};
 // Also commit on blur: invalid number fields do not reliably emit change.
 host.addEventListener('focusout',e=>{update(e,true,true);editing=null;});
}
function syncTrailInputs(skip){
 const o={...Trails.DEFAULTS,...current().trail};
 $('trailFields').querySelectorAll('[data-trail],[data-trail-number]').forEach(el=>{
  const key=el.dataset.trail||el.dataset.trailNumber;
  if(el!==skip){if(el.type==='checkbox')el.checked=o[key];else el.value=o[key];}
 });
 $('trail-color').disabled=o.followColor;
}
bindParameterPanel('trailFields',el=>el.dataset.trail||el.dataset.trailNumber,(el,key,begin)=>{
 const value=key==='followColor'?el.checked:key==='color'?el.value:Number(el.value);
 const next={...Trails.DEFAULTS,...current().trail,[key]:value};Trails.validate(current().type,next);
 if(current().trail?.[key]!==value){begin();current().trail=next;saveLocal();}
},syncTrailInputs,'星光拖尾参数已保存，预览与 INO 输出同步。');

const sweepTuningGroups=[
 ['motion','运动节奏',['period','motionStart','motionMiddle','motionEnd','motionPeak','motionSoftness'],'调节起步、中段和收尾的相对速度；重复周期控制整轮时长。'],
 ['direction','方向与倾斜',['direction','tilt'],'先选移动方向，再调整倾斜角度；上、中、下始终对应画板实际位置。'],
 ['head','主星团轮廓',['headWidth','headUpper','headMiddle','headLower'],'饱满度改变对应部位的厚薄：0 收起，1 保持，2 加厚。'],
 ['twinkle','主星团闪烁',['headTwinkle','headTwinkleRate','headStarDensity','headGlow'],'星点随主团移动，各自闪亮、回落。底光越低越细碎；闪烁强度调到 0 可恢复连续亮区。'],
 ['stars','残星轮廓',['starGap','starWidth','starUpper','starMiddle','starLower','starDensity','starLife','starBrightness'],'饱满度改变疏密与展开范围，亮度单独调整。展开宽度沿移动方向的横向调节，8 为全宽。']
];
const sweepGroupState=new Map();
function updateSweepSpeedCurve(l){
 const host=$('sweepSpeedCurve');if(!host||l?.type!=='whiteSweep')return;
 const motionFactory=window.StudioReferenceSweep?.motion;if(typeof motionFactory!=='function'){host.innerHTML='<small>速度曲线将在运动模块就绪后显示。</small>';return;}
 try{
  const motion=motionFactory(l),softness=l.tuning?.motionSoftness??0,start=-.18-.06*softness,end=.6+.06*softness;
  const average=Math.abs(motion.position(end)-motion.position(start))/(end-start);
  if(!Number.isFinite(average)||average<=0)throw Error('无有效行程');
  const values=Array.from({length:81},(_,i)=>Math.abs(motion.speed(start+(end-start)*i/80))/average);
  if(values.some(v=>!Number.isFinite(v)))throw Error('速度无效');
  const maximum=Math.max(1,Math.ceil(Math.max(...values)*2)/2),left=29,top=10,width=194,height=66;
  const path=values.map((v,i)=>(i?'L':'M')+(left+i/80*width).toFixed(2)+','+(top+height-v/maximum*height).toFixed(2)).join(' ');
  const midY=top+height-height/maximum;
  host.innerHTML=`<div class="sweep-curve-title"><span>实际速度曲线</span><small>相对行程均速</small></div><svg viewBox="0 0 234 103" role="img" aria-label="实际速度曲线，纵轴为行程均速倍数，横轴为单次运动进度"><path d="M${left} ${top}V${top+height}H${left+width}" class="sweep-curve-axis"/><path d="M${left} ${midY}H${left+width}" class="sweep-curve-guide"/><path d="${path}" class="sweep-curve-line"/><text x="24" y="${top+4}" text-anchor="end">${maximum.toFixed(1)}×</text><text x="24" y="${top+height+3}" text-anchor="end">0</text><text x="${left}" y="94">起步</text><text x="${left+width/2}" y="94" text-anchor="middle">中段</text><text x="${left+width}" y="94" text-anchor="end">收尾</text></svg>`;
 }catch{host.innerHTML='<small>当前参数的速度曲线暂不可用。</small>';}
}
const flameHeightKeys=['baseLeft','baseMiddle','baseRight'];
function tuningValue(l,d){return l.tuning?.[d.key]??(l.type==='flame'&&flameHeightKeys.includes(d.key)?l.tuning?.height??2.8:d.legacyValue??d.value);}
function tuningUnit(l,d){return l.type==='whiteSweep'&&d.key==='starWidth'&&(l.tuning?.direction??0)>=2?'份':d.unit;}
function sweepFollowHint(l){return l.starFollow==='path-v1'?'距离按行程平均速度换算为延迟，残星会走完路线再消散。':'旧工程保留位置偏移；调整距离可启用完整路线跟随。';}
function syncTuningContext(l){
 $('tuningHint').textContent=l.type==='whiteSweep'?((l.tuning?.headTwinkle??0)>0?'主团由错落闪烁的星点组成，轮廓与移动节奏独立可调；残星在后方跟随。':'主团闪烁强度当前为 0，可调高开启星点闪烁；轮廓、运动和残星分别调整。'):l.type==='flame'?((l.flameBase==='level-v1'?'左、中、右高度从同一水平底线计算，三段平滑连接。':'当前沿异形底边燃烧；调整任一基础高度即可改用统一水平底线。')+' 先调基础轮廓，再叠加随机风力和跳动；没有灯位的部分自然裁切。'):l.type==='showcase'?'每区最薄 1 排，按红 / 橙 / 红 / 白循环排列。横向共 8 排；斜向沿错排灯珠对齐。超出灯阵的部分自然截断，亮块沿所选灯排移动。':'参数实时预览，并随工程和 INO 保存。';
 const stars=$('tuningFields').querySelector('[data-sweep-group="stars"] .sweep-group-hint');
 if(stars)stars.textContent=sweepTuningGroups.find(g=>g[0]==='stars')[3]+' '+sweepFollowHint(l);
}
function syncTuningInputs(skip){
 const l=current();
 $('tuningFields').querySelectorAll('[data-tune],[data-tune-number]').forEach(el=>{
  const key=el.dataset.tune||el.dataset.tuneNumber,d=T.defs[l.type].find(d=>d.key===key);
  if(el!==skip){const value=tuningValue(l,d);if(d.kind==='toggle')el.checked=!!value;else el.value=value;}
  el.disabled=l.type==='flame'&&['windStrength','windFrequency'].includes(key)&&!l.tuning?.randomWind;
  const unit=el.closest('.tuning-pair')?.querySelector('small');if(unit)unit.textContent=tuningUnit(l,d);
 });
 syncTuningContext(l);updateSweepSpeedCurve(l);
}
function renderTuning(l){
 const list=T.controls(l);$('tuningSection').classList.toggle('hide',!list.length);
 const followHint=sweepFollowHint(l);syncTuningContext(l);
 $('tuningFields').querySelectorAll('[data-sweep-group]').forEach(group=>sweepGroupState.set(group.dataset.sweepGroup,group.open));
 const controlHtml=d=>{
  const value=tuningValue(l,d),unit=tuningUnit(l,d),accessibleLabel=l.type==='whiteSweep'&&/^(head|star)(Upper|Middle|Lower)$/.test(d.key)?(d.key.startsWith('head')?'主星团':'残星')+d.label:d.label,disabled=l.type==='flame'&&['windStrength','windFrequency'].includes(d.key)&&!l.tuning?.randomWind;let input;
  if(d.kind==='color')input=`<input type="color" id="tune-${d.key}" data-tune="${d.key}" value="${value}">`;
  else if(d.kind==='toggle')input=`<input type="checkbox" id="tune-${d.key}" data-tune="${d.key}" ${value?'checked':''}>`;
  else if(d.kind==='select')input=`<select id="tune-${d.key}" data-tune="${d.key}">${d.options.map(([v,label])=>`<option value="${v}" ${v===value?'selected':''}>${label}</option>`).join('')}</select>`;
  else input=`<div class="tuning-pair"><input type="range" id="tune-${d.key}" aria-label="${accessibleLabel}" data-tune="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${value}" ${disabled?'disabled':''}><input type="number" aria-label="${accessibleLabel}数值" data-tune-number="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${value}" ${disabled?'disabled':''}><small>${unit}</small></div>`;
  return `<div class="tuning-field${d.kind==='toggle'?' tuning-toggle':''}"><label for="tune-${d.key}">${d.label}</label>${input}</div>`;
 };
 if(l.type==='whiteSweep'){
  $('tuningFields').innerHTML=sweepTuningGroups.map(([key,title,keys,hint])=>`<details class="sweep-tuning-group" data-sweep-group="${key}" ${sweepGroupState.get(key)!==false?'open':''}><summary>${title}</summary><div class="sweep-tuning-body"><p class="sweep-group-hint">${hint}${key==='stars'?' '+followHint:''}</p>${key==='motion'?'<div id="sweepSpeedCurve" class="sweep-speed-curve"></div>':''}${keys.map(key=>list.find(d=>d.key===key)).filter(Boolean).map(controlHtml).join('')}</div></details>`).join('');
  $('tuningFields').querySelectorAll('[data-sweep-group]').forEach(group=>group.addEventListener('toggle',()=>{if(group.isConnected)sweepGroupState.set(group.dataset.sweepGroup,group.open);}));
  updateSweepSpeedCurve(l);
 }else $('tuningFields').innerHTML=list.map(controlHtml).join('');
}
bindParameterPanel('tuningFields',el=>el.dataset.tune||el.dataset.tuneNumber,(el,key,begin)=>{
 const l=current(),d=T.defs[l.type].find(d=>d.key===key),value=d.kind==='color'?el.value:d.kind==='toggle'?Number(el.checked):Number(el.value);
 const next={...(l.tuning||(['whiteSweep','flame'].includes(l.type)?{}:T.defaults(l.type))),[key]:value},upgradeFlame=l.type==='flame'&&flameHeightKeys.includes(key),upgradeSweep=l.type==='whiteSweep'&&key==='starGap';
 if(upgradeFlame)for(const field of flameHeightKeys)next[field]??=l.tuning?.height??2.8;
 try{T.validate(l.type,next);}catch(err){throw Error(err.message+(d.kind?'':`（${d.min}–${d.max}）；已恢复上次有效值。`));}
 if(l.tuning?.[key]!==value||(upgradeFlame&&l.flameBase!=='level-v1')||(upgradeSweep&&l.starFollow!=='path-v1')){
  begin();l.tuning=next;if(upgradeSweep)l.starFollow='path-v1';if(upgradeFlame)l.flameBase='level-v1';saveLocal();
 }
},syncTuningInputs,'效果参数已更新，导出 INO 会使用当前画面。');
$('resetTuning').onclick=()=>mutate(p=>{const l=p.layers[selected];l.tuning=T.defaults(l.type);if(l.type==='flame')l.flameBase='level-v1';},'已恢复此图层的默认精调参数。');

function renderTracks(){
 $('tracks').innerHTML=project.layers.map((l,i)=>({l,i})).reverse().map(({l,i})=>`<div class="track"><span class="track-label" data-track-select="${i}" title="${escape(l.name)}">${escape(l.name)}</span><div class="track-bed" data-bed="${i}"><div class="clip ${selected===i?'selected':''}" data-clip="${i}" style="left:${l.start/project.duration*100}%;width:${(l.end-l.start)/project.duration*100}%;opacity:${l.enabled?1:.35}" aria-label="${escape(l.name)} 时间片段"><span class="handle start" data-edge="start"></span><span class="handle end" data-edge="end"></span>${l.keys.filter(k=>k.time>=l.start&&k.time<=l.end).map(k=>`<i class="keymark" style="left:${(k.time-l.start)/(l.end-l.start)*100}%"></i>`).join('')}</div><i class="playhead"></i></div></div>`).join('');
}
function renderAll(){invalidateCanvas();updateGuide();renderLayers();renderInspector();renderTracks();$('projectName').value=project.name;$('duration').value=project.duration;
 if(!Array.from($('fps').options).some(o=>Number(o.value)===project.fps))$('fps').add(new Option(project.fps,project.fps));$('fps').value=project.fps;
 if(!Array.from($('loopFade').options).some(o=>Number(o.value)===project.loopFade))$('loopFade').add(new Option(project.loopFade+' 秒',project.loopFade));$('loopFade').value=Array.from($('loopFade').options).find(o=>Number(o.value)===project.loopFade).value;
 $('scrub').max=Math.round(project.duration*project.fps)-1;$('durationLabel').textContent=project.duration+'s';$('play').textContent=playing?'暂停':'播放';updateHistory();}
function selectLayer(i){selected=i;renderLayers();renderInspector();renderTracks();}
function shownPosition(pt){return E.displayPosition(pt,$('layoutView').value==='photo'?null:project.layout);}
function stagePoint(e){const r=canvas.getBoundingClientRect(),s=Math.min(r.width/1740,r.height/730);return {x:(e.clientX-r.left-(r.width-1740*s)/2)/s+205,y:(e.clientY-r.top-(r.height-730*s)/2)/s+265};}
function paintAt(e){const p=stagePoint(e),l=current();if(!l)return;const radius=Number($('brush').value)*24,from=lastPaint||p,dx=p.x-from.x,dy=p.y-from.y,len=dx*dx+dy*dy;let hit=0;points.forEach((point,i)=>{const pt=shownPosition(point),t=len?E.clamp(((pt.x-from.x)*dx+(pt.y-from.y)*dy)/len):0;if(Math.hypot(pt.x-from.x-t*dx,pt.y-from.y-t*dy)<=radius){l.mask[i]=$('tool').value==='erase'?0:1;hit++;}});lastPaint=p;if(hit)$('maskCount').textContent=l.mask.reduce((a,b)=>a+b,0)+' / 199';}
canvas.onpointerdown=e=>{if(e.button!==0)return;const p=stagePoint(e);if($('tool').value==='inspect'){selectedPixel=points.findIndex(pt=>{const q=shownPosition(pt);return Math.hypot(q.x-p.x,q.y-p.y)<23;});return;}if(!current()){notify('先添加或选择一个图层。',true);return;}checkpoint();stroke=true;lastPaint=null;canvas.setPointerCapture(e.pointerId);paintAt(e);};
canvas.onpointermove=e=>{if(stroke)paintAt(e);};
function endStroke(){if(stroke){stroke=false;saveLocal();renderInspector();notify('已更新当前图层的作用区域，可撤销本次笔画。');}}
canvas.onpointerup=endStroke;canvas.onpointercancel=endStroke;
function draw(now){
 if(document.hidden){previous=0;requestAnimationFrame(draw);return;}
 const dt=previous?Math.min((now-previous)/1000,.1):0;previous=now;if(playing)time=(time+dt)%project.duration;
 const frameIndex=Math.min(Math.round(project.duration*project.fps)-1,Math.floor(time*project.fps+1e-7)),sample=frameIndex/project.fps;
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1,drawKey=[frameIndex,paintRevision,w,h,dpr].join('|');
 if(drawKey===lastDrawKey){requestAnimationFrame(draw);return;}lastDrawKey=drawKey;
 frame=E.render(project,points,sample);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const night=$('nightView').checked,paint=$('tool').value!=='inspect',l=current();
 if(night){ctx.fillStyle='#030406';ctx.fillRect(0,0,w,h);}
 const s=Math.min(w/1740,h/730);ctx.translate((w-s*1740)/2,(h-s*730)/2);ctx.scale(s,s);ctx.translate(-205,-265);
 ctx.shadowBlur=0;ctx.globalAlpha=1;if(!night||paint){ctx.strokeStyle='#1c242e';ctx.lineWidth=1;for(let x=205;x<1945;x+=50){ctx.beginPath();ctx.moveTo(x,265);ctx.lineTo(x,995);ctx.stroke();}for(let y=265;y<995;y+=50){ctx.beginPath();ctx.moveTo(205,y);ctx.lineTo(1945,y);ctx.stroke();}}
 if($('layoutView').value==='photo'&&referenceImage.complete&&referenceImage.naturalWidth){ctx.globalAlpha=.32;ctx.drawImage(referenceImage,0,0,1920,1080);ctx.globalAlpha=1;}
 ctx.strokeStyle=night?'#10141a':'#475360';ctx.lineWidth=2;ctx.stroke(outline);
 for(const pt of points){const p={...pt,...shownPosition(pt)};ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fillStyle=night?'#050608':'#10151c';ctx.fill();ctx.strokeStyle=paint&&l?.mask[p.id-1]?'#547fa6':night?'#0b0e13':'#29313c';ctx.lineWidth=paint?2.2:1.6;ctx.stroke();}
 if($('refs').checked)for(const pt of refs){const p=shownPosition(pt);ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.strokeStyle=night?'#0d140f':'#29372a';ctx.lineWidth=1.6;ctx.stroke();}
 const exposure=Number($('exposure').value);let lit=0;
 if(night)lit=window.StudioOptics.draw(ctx,points.map(shownPosition),frame,exposure);
 else points.forEach((pt,i)=>{const p=shownPosition(pt),values=frame[i],peak=Math.max(...values);if(!peak)return;if(peak>8)lit++;const light=1-Math.exp(-peak/255*exposure),color=values.map(v=>Math.round(v/peak*255)),c=`rgb(${color.join(',')})`;
   ctx.globalAlpha=light*.48;const g=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,35);g.addColorStop(0,c);g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(p.x-35,p.y-35,70,70);
   ctx.globalAlpha=light;ctx.beginPath();ctx.arc(p.x,p.y,10.5,0,Math.PI*2);ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=18;ctx.fill();ctx.shadowBlur=0;
   ctx.globalAlpha=light*.85;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#f4f8ff';ctx.fill();
 });ctx.globalAlpha=1;ctx.shadowBlur=0;
 if(selectedPixel>=0){const p={...points[selectedPixel],...shownPosition(points[selectedPixel])};ctx.beginPath();ctx.arc(p.x,p.y,18,0,Math.PI*2);ctx.strokeStyle='#b9d9ff';ctx.lineWidth=2;ctx.stroke();$('pixelInfo').textContent=`INO #${p.wire} · (${p.lx}, ${p.ly}) · RGB ${frame[selectedPixel].join(' / ')}`;}else $('pixelInfo').textContent=paint?'画笔仅修改当前图层区域，可撤销整个笔画':'点击灯位查看接线编号与 RGB';
 if($('numbers').checked){ctx.font='10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d1dbe6';points.forEach(pt=>{const p=shownPosition(pt);ctx.fillText(pt.wire,p.x,p.y);});}
 $('litCount').textContent=lit;$('timecode').textContent=sample.toFixed(2).padStart(5,'0')+' s';$('scrub').value=frameIndex;document.querySelectorAll('.playhead').forEach(p=>p.style.left=time/project.duration*100+'%');
 requestAnimationFrame(draw);
}
$('layers').onclick=e=>{const toggle=e.target.closest('[data-toggle]');if(toggle){const i=Number(toggle.dataset.toggle);mutate(p=>p.layers[i].enabled=!p.layers[i].enabled);return;}const row=e.target.closest('[data-layer]');if(row)selectLayer(Number(row.dataset.layer));};
$('layers').onkeydown=e=>{if(['Enter',' '].includes(e.key)&&e.target.dataset.layer!==undefined){e.preventDefault();selectLayer(Number(e.target.dataset.layer));}};
$('addLayer').onclick=()=>{mutate(p=>{p.layers.push(E.layer($('addType').value,p.duration));});selectLayer(project.layers.length-1);notify('已添加图层。在右侧调节参数，或用画笔限定灯位。');};
$('duplicate').onclick=()=>{if(!current())return;mutate(p=>{const copy=E.clone(p.layers[selected]);copy.name+=' 副本';p.layers.splice(selected+1,0,copy);});selectLayer(Math.min(selected+1,project.layers.length-1));};
$('deleteLayer').onclick=()=>mutate(p=>p.layers.splice(selected,1),'图层已删除，可撤销。');
$('layerUp').onclick=()=>{if(selected>=project.layers.length-1)return;const i=selected;mutate(p=>[p.layers[i],p.layers[i+1]]=[p.layers[i+1],p.layers[i]]);selectLayer(i+1);};
$('layerDown').onclick=()=>{if(selected<1)return;const i=selected;mutate(p=>[p.layers[i],p.layers[i-1]]=[p.layers[i-1],p.layers[i]]);selectLayer(i-1);};
const presetCatalog=[P.PRESETS.find(p=>p[1]==='whiteSweep'),P.PRESETS.find(p=>p[1]==='showcase'),['灯光效果','flow','冷白流光','宽度 / 间隔'],['灯光效果','aurora','极光叠影','双层混合'],['灯光效果','ripple','蓝色涟漪','空间扩散'],['灯光效果','sparks','星火与余晖','粒子叠加'],...P.PRESETS.filter(p=>p[1]!=='showcase'&&p[1]!=='whiteSweep'&&p[1]!=='text'),['灯光效果','blank','空白画布','自由绘制'],P.PRESETS.find(p=>p[1]==='text')];
let activePreset=isolated&&new URLSearchParams(location.search).get('preset')==='whiteSweep'?'whiteSweep':'';
function renderPresets(){const term=$('presetSearch').value.trim().toLowerCase(),list=presetCatalog.filter(p=>p.join(' ').toLowerCase().includes(term));$('presetCount').textContent=list.length+' 种';let group='';$('presetList').innerHTML=list.map(([category,id,title,desc])=>{const heading=group!==category?`<h3 class="preset-category">${category}</h3>`:'';group=category;return heading+`<button data-preset="${id}" class="preset-tile ${activePreset===id?'active':''}" aria-pressed="${activePreset===id}" title="${escape(desc)}"><i class="preset-swatch swatch-${id}" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i><span>${escape(title)}</span><small>${escape(desc)}</small></button>`;}).join('')||'<small>没有匹配的预设。</small>';}
$('presetSearch').oninput=renderPresets;renderPresets();
$('presetList').onclick=e=>{const b=e.target.closest('[data-preset]');if(b){activePreset=b.dataset.preset;setProject(E.project(activePreset),'已载入 '+b.querySelector('span').textContent+'。可调整右侧效果参数，或撤销返回原工程。');renderPresets();}};
function rasterText(text){const out=[];for(const ch of Array.from(text)){if(P.FONT[ch.toUpperCase()]){out.push(...P.textColumns(ch));continue;}const c=document.createElement('canvas');c.width=32;c.height=28;const g=c.getContext('2d',{willReadFrequently:true});g.scale(4,4);g.font='7px "Microsoft YaHei",sans-serif';g.textBaseline='alphabetic';g.fillStyle='#fff';g.fillText(ch,0,6.7,8);const data=g.getImageData(0,0,32,28).data;for(let x=0;x<8;x++){let bits=0;for(let y=0;y<7;y++){let alpha=0;for(let yy=0;yy<4;yy++)for(let xx=0;xx<4;xx++)alpha+=data[((y*4+yy)*32+x*4+xx)*4+3];if(alpha/16>62)bits|=1<<y;}out.push(bits);}out.push(0);}return out;}
for(const [id,key] of [['textContent','text'],['textDirection','direction'],['glyph','glyph'],['accent','accent'],['beams','beams'],['patternMode','pattern']]){
 let editing=false;
 const apply=()=>{const draft=E.clone(project),l=draft.layers[selected];l[key]=key==='beams'?Number($(id).value):$(id).value;if(key==='text')l.bitmap=rasterText(l.text);const valid=E.validate(draft);if(!editing){checkpoint();editing=true;}project=valid;saveLocal();};
 $(id).oninput=()=>{try{apply();}catch{}};
 $(id).onchange=()=>{try{apply();notify('图案参数已更新，会随工程与 INO 一同保存。');}catch(err){notify(err.message,true);}editing=false;renderInspector();};
}
for(const id of ['opacity','speed','scale','angle']){
 $(id).oninput=()=>{if(!current())return;if(!sliderEditing){checkpoint();sliderEditing=true;}current()[id]=Number($(id).value)/(id==='opacity'?100:1);updateRangeOutputs();};
 $(id).onchange=()=>{sliderEditing=false;saveLocal();renderTracks();};
}
for(const id of ['color','blend','seed','cx','cy','start','end','fadeIn','fadeOut','legacyBrightness','legacyInterval']){
 let editing=false;
 const applyValue=()=>{const draft=E.clone(project);if(!draft.layers[selected])return;if($(id).value==='')throw Error('请输入完整数值');draft.layers[selected][id]=['color','blend'].includes(id)?$(id).value:Number($(id).value);const valid=E.validate(draft);if(!editing){checkpoint();editing=true;}project=valid;saveLocal();renderLayers();renderTracks();};
 $(id).oninput=()=>{try{applyValue();}catch{}};
 $(id).onchange=()=>{try{applyValue();}catch(err){notify(err.message,true);}editing=false;renderInspector();};
}
$('layerName').onchange=()=>mutate(p=>p.layers[selected].name=$('layerName').value);
$('projectName').onchange=()=>mutate(p=>p.name=$('projectName').value);
for(const [id,fn] of [['maskAll',()=>1],['maskNone',()=>0],['maskInvert',v=>1-v]])$(id).onclick=()=>mutate(p=>p.layers[selected].mask=p.layers[selected].mask.map(fn),'已更新当前图层区域。');
function updateGuide(){$('canvasGuide').textContent=$('tool').value!=='inspect'?'区域编辑 · 蓝色边框为当前层作用灯位':$('layoutView').value==='photo'?'原图对照 · 照片包含拍摄透视':project.layout?'错排网格 · 199 灯 · 布局待实物校准':'照片灯位 · 199 灯';}
$('tool').onchange=updateGuide;$('layoutView').onchange=updateGuide;
$('geometry').onchange=()=>mutate(p=>{const l=p.layers[selected];if($('geometry').checked)l.geometry='physical-v2';else delete l.geometry;},$('geometry').checked?'已按实际灯位校正图案，导出 INO 同步生效。':'已切回旧版排号坐标，可对比校正前效果。');
$('addKey').onclick=()=>mutate(p=>{const l=p.layers[selected],t=Math.floor(time*p.fps)/p.fps,j=l.keys.findIndex(k=>Math.abs(k.time-t)<.0001);if(j>=0)l.keys[j].value=l.opacity;else l.keys.push({time:t,value:l.opacity});l.keys.sort((a,b)=>a.time-b.time);},'已记录当前亮度；关键帧之间自动渐变。');
$('keys').onclick=e=>{const seek=e.target.closest('[data-seek-key]'),del=e.target.closest('[data-delete-key]');if(seek){time=current().keys[Number(seek.dataset.seekKey)].time;playing=false;$('play').textContent='播放';}if(del)mutate(p=>p.layers[selected].keys.splice(Number(del.dataset.deleteKey),1));};
$('undo').onclick=()=>{if(!undo.length)return;redo.push(E.clone(project));project=undo.pop();selected=Math.min(selected,Math.max(0,project.layers.length-1));time=Math.min(time,project.duration-1/project.fps);saveLocal();renderAll();notify('已撤销。');};
$('redo').onclick=()=>{if(!redo.length)return;undo.push(E.clone(project));project=redo.pop();selected=Math.min(selected,Math.max(0,project.layers.length-1));time=Math.min(time,project.duration-1/project.fps);saveLocal();renderAll();notify('已重做。');};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暂停':'播放';};$('restart').onclick=()=>{time=0;};
function step(n){playing=false;time=Math.max(0,Math.min(project.duration-1/project.fps,(Math.round(time*project.fps)+n)/project.fps));$('play').textContent='播放';}
$('step').onclick=()=>step(1);$('scrub').oninput=()=>{playing=false;time=Number($('scrub').value)/project.fps;$('play').textContent='播放';};
$('duration').onchange=()=>mutate(p=>{p.duration=Number($('duration').value);p.duration=Math.round(p.duration*p.fps)/p.fps;p.layers.forEach(l=>{l.start=Math.min(l.start,p.duration-1/p.fps);l.end=Math.min(l.end,p.duration);l.keys=l.keys.filter(k=>k.time<=p.duration);});},'时长已更新；超出末尾的片段和关键帧已裁剪，可撤销。');
$('fps').onchange=()=>mutate(p=>{p.fps=Number($('fps').value);p.duration=Math.round(p.duration*p.fps)/p.fps;p.layers.forEach(l=>{l.end=Math.min(l.end,p.duration);l.start=Math.min(l.start,p.duration-1/p.fps);l.keys=l.keys.filter(k=>k.time<=p.duration);});});
$('loopFade').onchange=()=>mutate(p=>p.loopFade=Number($('loopFade').value));
$('exposure').oninput=()=>$('exposureValue').textContent=$('exposure').value+'×';
$('focus').onclick=()=>{document.body.classList.toggle('focus');$('focus').textContent=document.body.classList.contains('focus')?'返回编辑':'专注预览';};
let drag=null;
$('tracks').onpointerdown=e=>{const c=e.target.closest('[data-clip]'),label=e.target.closest('[data-track-select]');if(label){selectLayer(Number(label.dataset.trackSelect));return;}if(!c)return;
 e.preventDefault();const i=Number(c.dataset.clip),rect=c.parentElement.getBoundingClientRect();checkpoint();selected=i;playing=false;$('play').textContent='播放';drag={i,x:e.clientX,width:rect.width,start:project.layers[i].start,end:project.layers[i].end,edge:e.target.dataset.edge||'move'};renderLayers();renderInspector();};
window.addEventListener('pointermove',e=>{if(!drag)return;const d=drag,l=project.layers[d.i],delta=Math.round((e.clientX-d.x)/d.width*project.duration*project.fps)/project.fps;
 if(d.edge==='start')l.start=E.clamp(d.start+delta,0,l.end-1/project.fps);else if(d.edge==='end')l.end=E.clamp(d.end+delta,l.start+1/project.fps,project.duration);else{const shift=E.clamp(delta,-d.start,project.duration-d.end);l.start=d.start+shift;l.end=d.end+shift;}renderTracks();});
window.addEventListener('pointerup',()=>{if(drag){drag=null;saveLocal();renderInspector();notify('已更新时间片段。关键帧保持原时间位置。');}});
function download(name,text,type='text/plain'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function filename(){return project.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g,'_').slice(0,40)||'LampEffect';}
let projectUrl=null;
$('saveProject').onclick=()=>{const text=JSON.stringify(project,null,2),name=filename()+'.lamp.json';download(name,text,'application/json');if(projectUrl)URL.revokeObjectURL(projectUrl);projectUrl=URL.createObjectURL(new Blob([text],{type:'application/json'}));$('downloadProjectLink').href=projectUrl;$('downloadProjectLink').download=name;$('projectSource').value=text;$('projectSaveResult').textContent='工程已生成并发起下载；也可手动下载或复制下方工程内容。';$('projectDialog').showModal();saveLocal();notify('工程已生成并保存在本机缓存，请将工程文件另存到磁盘。');};
for(const [button,dialog] of [['openImport','importDialog'],['openExport','exportDialog'],['help','helpDialog']])$(button).onclick=()=>{if(dialog==='exportDialog'){$('pin').value=project.pin;$('master').value=project.master;$('exportSourcePanel').classList.add('hide');$('exportResult').textContent='';exportSummary();}$(dialog).showModal();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function importResult(msg,error=false){$('importResult').textContent=msg;$('importResult').classList.toggle('error',error);}
async function loadSource(text,json=false){try{importResult('正在解析并校验…');await new Promise(r=>setTimeout(r,30));let p,message;if(json){p=E.validate(JSON.parse(text));message='已导入完整工程。';}else{const result=C.importIno(text,points);p=result.project;message=result.message;}setProject(p,message);importResult(message);$('importDialog').close();}catch(err){importResult(err.message,true);notify('导入未完成，当前工程保留。',true);}}
async function readFile(file){if(!file)return;if(file.size>10000000){importResult('文件不能超过 10 MB。',true);return;}try{await loadSource(await file.text(),file.name.toLowerCase().endsWith('.json'));}catch(err){importResult('读取失败：'+err.message,true);}}
$('importFile').onchange=e=>{readFile(e.target.files[0]);e.target.value='';};$('importText').onclick=()=>{const text=$('sourceText').value;loadSource(text,text.trimStart().startsWith('{'));};
$('loadKnown').onclick=()=>{$('sourceText').value=C.knownSource;importResult('已填入原始粒子代码，点击“解析并预览”导入。');};
const zone=document.querySelector('.dropzone');zone.ondragover=e=>{e.preventDefault();};zone.ondrop=e=>{e.preventDefault();readFile(e.dataTransfer.files[0]);};
let preparedAlgorithm=null;
function exportSummary(){
 const algorithm=$('exportMode').value==='algorithm',count=Math.round(project.duration*project.fps),size=count*199*3;
 $('resourceBudgetField').classList.toggle('hide',!algorithm);$('exportIno').textContent='生成并下载 RMT 包';
 $('exportDescription').textContent=algorithm?'由芯片按算法实时计算，支持火焰、冷白星流、静态绘制。ZIP 含完整 RMT 测试 INO、合入原固件用的 .h、工程和接入说明。':'将最终 RGB 逐帧保存，支持所有预览效果。ZIP 同样含完整 RMT 测试 INO 和原固件集成模块；时长、帧率越高，动画数据越大。';
 $('exportTarget').textContent=`ESP32 · RMT 驱动 · GPIO ${project.pin} · 199 灯 · GRB。合入店家固件用 integration 文件夹；单独测试用同名草稿文件夹。`;
 $('exportSummary').classList.remove('error');$('exportIno').disabled=false;preparedAlgorithm=null;
 try{
  R.validateOptions(project,{namespaceName:$('moduleName').value,mode:$('exportMode').value});
  if(!algorithm){$('exportSummary').textContent=`${project.duration} 秒 × ${project.fps} FPS = ${count} 帧 · 帧数据 ${(size/1024).toFixed(1)} KiB。\n独立示例另有约 18.7 KiB RMT 发送缓冲；合入原驱动不重复分配。固件总 Flash / RAM 以目标板编译为准。`;return;}
  const budget=Number($('resourceBudget').value);if(!Number.isFinite(budget)||budget<1||budget>1024)throw Error('资源预算须在 1–1024 KiB 之间');
  preparedAlgorithm=R.exportBundle(project,points,{namespaceName:$('moduleName').value,mode:'algorithm'});const stats=preparedAlgorithm.stats;
  const exceeded=stats.resourceBytesEstimate>budget*1024;
  $('exportSummary').textContent=`完整 INO 文本 ${(stats.sourceBytes/1024).toFixed(1)} KiB · 效果静态数据估算 ${(stats.resourceBytesEstimate/1024).toFixed(2)} KiB\n同工程逐帧数据 ${(stats.rawFrameBytes/1024).toFixed(1)} KiB。独立 RMT 示例另有约 18.7 KiB 发送缓冲；合入原驱动不重复分配。文本大小不等于固件大小，Flash / RAM 仍需合入编译。${exceeded?'\n超过当前资源预算，请减少图层或调整预算。':''}`;
  $('exportIno').disabled=exceeded;$('exportSummary').classList.toggle('error',exceeded);
 }catch(err){$('exportSummary').textContent=err.message;$('exportSummary').classList.add('error');$('exportIno').disabled=true;}
}
function exportOptionsChanged(){exportSummary();$('exportSourcePanel').classList.add('hide');$('exportResult').textContent='导出选项已更新，请重新生成。';}
$('exportMode').onchange=exportOptionsChanged;
for(const id of ['moduleName','resourceBudget'])$(id).oninput=exportOptionsChanged;
for(const id of ['pin','master'])$(id).onchange=()=>{mutate(p=>p[id]=Number($(id).value));$(id).value=project[id];exportSummary();$('exportSourcePanel').classList.add('hide');$('exportResult').textContent='参数已更新，请重新生成。';};
let sourceUrl=null,algorithmUrls=[];
$('exportIno').onclick=async()=>{const b=$('exportIno');b.disabled=true;$('exportResult').textContent='正在生成并校验导出内容…';try{
 await new Promise(r=>setTimeout(r,30));const mode=$('exportMode').value,algorithm=mode==='algorithm';
 for(const url of algorithmUrls)URL.revokeObjectURL(url);algorithmUrls=[];
 $('algorithmDownloads').classList.remove('hide');
 const bundle=R.exportBundle(project,points,{namespaceName:$('moduleName').value,mode}),budget=Number($('resourceBudget').value);
 if(algorithm&&(!Number.isFinite(budget)||budget<1||budget>1024||bundle.stats.resourceBytesEstimate>budget*1024))throw Error('静态资源估算超过预算，请调整后重新生成。');
 const name=bundle.namespaceName,source=bundle.files[bundle.sketchPath];R.importIno(source,points);
 const pack=A.zip(bundle.files),zipUrl=URL.createObjectURL(new Blob([pack],{type:'application/zip'})),headerUrl=URL.createObjectURL(new Blob([bundle.files[bundle.headerPath]],{type:'text/plain'}));algorithmUrls.push(zipUrl,headerUrl);
 $('downloadZipLink').href=zipUrl;$('downloadZipLink').download=bundle.sketchName+'.zip';$('downloadZipLink').textContent='下载完整包 '+bundle.sketchName+'.zip';
 $('downloadHeaderLink').href=headerUrl;$('downloadHeaderLink').download=name+'.h';$('downloadHeaderLink').textContent='仅下载集成模块 '+name+'.h';
 download(bundle.sketchName+'.zip',pack,'application/zip');$('exportResult').textContent='已生成 RMT 包并核对源码回读。发给店家整个 ZIP：合入原固件用 integration 文件夹；独立 INO 含驱动和播放入口，用于单独测试。';
 notify('已生成 RMT 灯效包，包含独立示例、原固件接入代码和工程。');
 if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=URL.createObjectURL(new Blob([source],{type:'text/plain'}));$('downloadInoLink').href=sourceUrl;$('downloadInoLink').download=bundle.sketchName+'.ino';$('downloadInoLink').textContent='仅下载测试草稿 '+bundle.sketchName+'.ino';$('exportSource').value=source;$('exportSourcePanel').classList.remove('hide');
 }catch(err){$('exportResult').textContent=err.message;}finally{exportSummary();}};
$('copyIno').onclick=async()=>{try{await navigator.clipboard.writeText($('exportSource').value);$('exportResult').textContent='已复制完整 RMT INO 源码，可保存为 '+$('downloadInoLink').download+'。';}catch{$('exportSource').closest('details').open=true;$('exportSource').focus();$('exportSource').select();$('exportResult').textContent='源码已全选，请按 Ctrl+C 复制。';}};
$('copyProject').onclick=async()=>{try{await navigator.clipboard.writeText($('projectSource').value);$('projectSaveResult').textContent='已复制完整工程，可保存为 .lamp.json 文件。';}catch{$('projectSource').focus();$('projectSource').select();$('projectSaveResult').textContent='工程内容已全选，请按 Ctrl+C 复制。';}};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;const editing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('saveProject').click();return;}if(editing)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}else if(e.code==='Space'){e.preventDefault();$('play').click();}else if(e.key==='ArrowRight'){e.preventDefault();step(1);}else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}});
$('calibrate').onclick=()=>{const g=project.layout||E.DEFAULT_LAYOUT;$('rowGap').value=g.rowGap;$('rowCalibration').innerHTML=E.ROWS.map((n,i)=>`<label class="calibration-row">第 ${i+1} 排 · ${n} 灯<input aria-label="第 ${i+1} 排起点偏移" data-offset="${i}" type="number" min="-4" max="4" step=".5" value="${g.rowOffsets[i]}"></label>`).join('');$('layoutDialog').showModal();};
$('applyLayout').onclick=()=>{const g={version:1,rowGap:Number($('rowGap').value),rowOffsets:Array.from(document.querySelectorAll('[data-offset]'),el=>Number(el.value))};try{E.validate({...project,layout:g});mutate(p=>{p.layout=g;p.layers.forEach(l=>{if(P.SPATIAL.includes(l.type))l.geometry='physical-v2';});},'已应用错排布局，预览和 INO 导出同步更新，可撤销。');$('layoutView').value='grid';updateGuide();$('layoutDialog').close();}catch(err){$('calibrationError').textContent=err.message;}};
renderAll();requestAnimationFrame(draw);
})();
