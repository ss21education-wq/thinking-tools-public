/* Pointer operations keep drafts unchanged until a complete gesture commits. */
const DirectUI=(()=>{
 const colors={yellow:['黄','#fff1a8'],blue:['青','#d7edff'],green:['緑','#ddf3c4'],pink:['桃','#ffe0ea'],purple:['紫','#eaddff'],white:['白','#ffffff']};
 let mode='select',source=null,drag=null,port=null;
 const bg=c=>(colors[c]||colors.yellow)[1];
 const palette=(path,value,label)=>`<label class="color-label">色 <select data-path="${esc(JSON.stringify(path))}" aria-label="${esc(label)}">${Object.entries(colors).map(([k,[name]])=>`<option value="${k}" ${(value||'yellow')===k?'selected':''}>${name}</option>`).join('')}</select></label>`;
 const pos=id=>id==='root'?{x:870,y:710,w:260,h:180}:((n)=>n?{x:drag?.id===id&&drag.moved?drag.nextX:n.x,y:drag?.id===id&&drag.moved?drag.nextY:n.y,w:260,h:230}:null)(activeDoc.diagram.nodes.find(n=>n.id===id));
 function stroke(from,to,attrs=''){
  const a=pos(from),b=pos(to);if(!a||!b)return '';const x1=a.x+a.w/2,y1=a.y+a.h/2,x2=b.x+b.w/2,y2=b.y+b.h/2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
 }
 function lines(){
  const d=activeDoc.diagram;
  return d.nodes.filter(n=>n.parent!==null).map((n,i)=>stroke(n.parent||'root',n.id,`class="map-link" data-map-tree="${n.id}" role="button" tabindex="0" aria-label="枝${d.nodes.indexOf(n)+1}の親との線を外す"`)).join('')+(d.links||[]).map((l,i)=>stroke(l.from,l.to,`class="map-link association" data-map-link="${i}" role="button" tabindex="0" aria-label="関連線${i+1}を削除"`)).join('')+'<line id="mapRubber" class="map-rubber" visibility="hidden"/>';
 }
 function markSource(){app.querySelectorAll('[data-map-target]').forEach(el=>{el.classList.toggle('link-source',el.dataset.mapTarget===(port?.id||source));el.classList.toggle('link-target',el.dataset.mapTarget===port?.over);});}
 function repaint(){const svg=document.getElementById('mapLines');if(svg)svg.innerHTML=lines();markSource();}
 function rebuild(){
  const sc=app.querySelector('.map-scroll'),left=sc?.scrollLeft||0,top=sc?.scrollTop||0;
  renderEditor();const fresh=app.querySelector('.map-scroll');if(fresh){fresh.scrollLeft=left;fresh.scrollTop=top;}
 }
 function map(){
  source=null;port=null;drag=null;const ns=activeDoc.diagram.nodes;
  return `<p>中心から自由に連想しましょう。空いている所をダブルクリックすると丸を追加できます。丸・付箋は「つかんで移動」をドラッグ。「線を引く」を選ぶと丸・付箋のどこからでも相手へドラッグでき、2つを順にクリックするだけでもつなげます。</p><div class="map-toolbar" role="toolbar" aria-label="イメージマップの操作">${[['select','選択・移動'],['circle','〇を追加'],['sticky','付箋を追加'],['connect','線を引く']].map(([v,l])=>`<button data-map-mode="${v}" aria-pressed="${mode===v}">${l}</button>`).join('')}<button data-action="add-node" data-parent="" ${ns.length>=500?'disabled':''}>＋ 中心から枝を追加</button><button data-map-center>中心に戻す</button><span id="mapHint" role="status">${mode==='circle'||mode==='sticky'?'空いている場所をクリックして配置':mode==='connect'?'つなぐ2つを選ぶ、または接続ボタンからドラッグ':'丸・付箋に直接入力できます'}</span></div><div class="diagram-scroll map-scroll"><div class="image-map free-map ${mode==='connect'?'connecting':''}" id="freeMap"><svg id="mapLines" viewBox="0 0 2000 1600" aria-label="イメージマップの接続線">${lines()}</svg><div class="map-center free-center" data-map-target="root" tabindex="${mode==='connect'?0:-1}"><strong>中心テーマ</strong><p id="mapCenterText">${esc(activeDoc.topic||'上のテーマ欄に入力')}</p><button data-map-connect="root" aria-label="中心から線を引く">● 線を引く</button></div>${ns.map((n,i)=>`<section class="map-node free-node ${(n.shape||'circle')==='circle'?'round-note':'sticky'}" data-map-id="${n.id}" data-map-target="${n.id}" tabindex="${mode==='connect'?0:-1}" style="left:${n.x}px;top:${n.y}px;--note-color:${bg(n.color)}" aria-label="枝${i+1}"><button class="note-grip" data-map-drag="${n.id}" aria-label="枝${i+1}を動かす">⠿ つかんで移動</button><span class="note-number">${i+1}</span><div class="free-note-body">${field(['diagram','nodes',i,'text'],n.text,`枝${i+1}の内容`,true)}</div><div class="note-tools">${palette(['diagram','nodes',i,'color'],n.color,`枝${i+1}の色`)}<button data-map-connect="${n.id}" aria-label="枝${i+1}から線を引く">● 線</button></div></section>`).join('')}</div></div><p class="muted">線をクリックして外せます。移動ハンドルは矢印キーで10ずつ、Shift＋矢印で50ずつ動かせます。Escapeでドラッグ・接続を中止。丸・付箋は500個、関連線は1000本まで。色だけでなく文章でも関連を説明しましょう。</p><details class="map-details" open><summary>形・親子関係・削除の操作</summary>${ns.map((n,i)=>`<section class="extra-panel"><h3>枝${i+1}</h3><label>形<select data-path='["diagram","nodes",${i},"shape"]' aria-label="枝${i+1}の形"><option value="circle" ${(n.shape||'circle')==='circle'?'selected':''}>丸</option><option value="sticky" ${n.shape==='sticky'?'selected':''}>付箋</option></select></label><label>つながる元<select data-map-parent="${i}" aria-label="枝${i+1}のつながる元"><option value="__none__" ${n.parent===null?'selected':''}>接続なし</option><option value="" ${n.parent===''?'selected':''}>中心テーマ</option>${ns.filter(p=>p.id!==n.id).map(p=>`<option value="${p.id}" ${n.parent===p.id?'selected':''}>枝${ns.indexOf(p)+1}</option>`).join('')}</select></label><div class="row">${[['left','左'],['right','右'],['up','上'],['down','下']].map(([v,l])=>`<button data-action="position-node" data-index="${i}" data-direction="${v}" aria-label="枝${i+1}を${l}へ">${l}へ</button>`).join('')}<button data-action="add-node" data-parent="${n.id}" ${ns.length>=500?'disabled':''}>この枝から連想</button><button data-action="delete-node" data-index="${i}" aria-label="枝${i+1}を削除">削除</button></div></section>`).join('')}</details><p class="note">まずは評価せず発想を広げ、後から色や関連線で整理しましょう。関連線は自由につなげます。親子関係には循環を作れません。枝を削除すると関連線は削除し、子は親につなぎ直します。取り消しで戻せます。</p>`;
 }
 function jelly(){
  const d=activeDoc.diagram,count=Math.min(d.columns===0?Math.max(1,d.evidence.length):d.columns??5,Math.max(1,d.evidence.length));
  return `<p>頭に主張・結論、足に根拠と出所・つながりを書きます。足の数を埋めることより、主張との対応を説明しましょう。</p><div class="row"><button data-action="add-evidence">＋ 根拠を追加</button><label>追加する足の本数<input id="jellyAddCount" type="number" min="1" max="1000" step="1" value="5" aria-label="追加する足の本数"></label><button data-jelly-batch>指定した本数を追加</button>${jellyLayout()}<span class="muted">6本目以降も横へ並べられます。「すべて横一列」は折り返しません。</span></div><div class="diagram-scroll jelly-scroll"><div class="jellyfish direct-jelly" style="min-width:${Math.max(400,count*194-18)}px"><div class="jelly-head"><label>主張・結論${field(['diagram','claim'],d.claim,'主張・結論',true)}</label></div><div class="jelly-legs" style="grid-template-columns:repeat(${count},minmax(176px,1fr))">${d.evidence.map((e,i)=>`<section class="jelly-leg" tabindex="0" data-jelly-index="${i}" style="--note-color:${bg(e.color)}" aria-label="根拠${i+1}"><button class="note-grip" data-jelly-drag="${i}" aria-label="根拠${i+1}をドラッグで並べ替え">⠿ 根拠${i+1}を選択・移動</button><button class="jelly-add-near" data-jelly-add="${i}" aria-label="根拠${i+1}の後に足を追加">＋ 足を追加</button>${palette(['diagram','evidence',i,'color'],e.color,`根拠${i+1}の色`)}<label>事実・文章の要約${field(['diagram','evidence',i,'text'],e.text,`根拠${i+1}の内容`,true)}</label><label>出典・該当箇所${field(['diagram','evidence',i,'source'],e.source,`根拠${i+1}の出典`,true)}</label><label>主張とのつながり${field(['diagram','evidence',i,'explanation'],e.explanation,`根拠${i+1}と主張のつながり`,true)}</label><div class="row"><button data-action="move-evidence" data-index="${i}" ${i===0?'disabled':''} aria-label="根拠${i+1}を前へ">前へ</button><button data-action="delete-evidence" data-index="${i}" aria-label="根拠${i+1}を削除">削除</button></div></section>`).join('')}</div></div></div><p class="muted">総数の100本制限はありません。1回に1～1000本追加でき、繰り返し追加できます。ドラッグまたは「前へ」で並べ替え、色分けできます。大量の入力は端末の保存容量に注意し、JSONでも保存してください。</p>`;
 }
 function commitLink(from,to){
  if(!from||!to||from===to){source=null;markSource();return;}
  const d=activeDoc.diagram;d.links??=[];
  if(d.links.length>=1000){status('関連線は1000本までです。');source=null;return;}
  if(d.links.some(l=>(l.from===from&&l.to===to)||(l.from===to&&l.to===from))||d.nodes.some(n=>n.parent!==null&&((n.id===from&&(n.parent||'root')===to)||(n.id===to&&(n.parent||'root')===from)))){source=null;markSource();status('この線はすでにあります。');return;}
  checkpoint();d.links.push({from,to});source=null;persist();repaint();hint('線を追加しました。次の2つもつなげます。');
 }
 function hint(text){const el=document.getElementById('mapHint');if(el)el.textContent=text;}
 function addAt(x,y,shape){
  const d=activeDoc.diagram;if(d.nodes.length>=500){status('丸・付箋は500個までです。');return;}let n=1;while(d.nodes.some(v=>v.id==='n'+n))n++;
  checkpoint();d.nodes.push({id:'n'+n,parent:null,text:'',x:Math.round(x),y:Math.round(y),shape,color:'yellow'});persist();rebuild();focusField(['diagram','nodes',d.nodes.length-1,'text']);
 }
 const point=(e,board)=>{const r=board.getBoundingClientRect();return {x:(e.clientX-r.left)*2000/r.width,y:(e.clientY-r.top)*1600/r.height};};
 const blank=t=>t?.id==='freeMap'||t?.id==='mapLines'||t?.classList?.contains('map-scroll');
 function click(e){
  const center=e.target.closest('[data-map-center]');if(center?.dataset.mapCenter!==undefined){CanvasUI.centerMap();return true;}
  const modeButton=e.target.closest('[data-map-mode]');if(modeButton?.dataset.mapMode!==undefined){mode=modeButton.dataset.mapMode;source=null;document.getElementById('freeMap')?.classList.toggle('connecting',mode==='connect');app.querySelectorAll('[data-map-target]').forEach(el=>el.tabIndex=mode==='connect'?0:-1);markSource();app.querySelectorAll('[data-map-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapMode===mode)));hint(mode==='circle'||mode==='sticky'?'空いている場所をクリックして配置':mode==='connect'?'つなぐ2つを順に選ぶか、線ボタンからドラッグ':'ハンドルをドラッグして移動');CanvasUI.feedback();return true;}
  if(selected===2&&!CanvasUI.isPanning()){
   const link=e.target.closest('[data-map-link],[data-map-tree]');if(link&&(link.dataset.mapTree!==undefined||link.dataset.mapLink!==undefined)){checkpoint();if(link.dataset.mapTree){const n=activeDoc.diagram.nodes.find(n=>n.id===link.dataset.mapTree);if(n)n.parent=null;}else activeDoc.diagram.links.splice(Number(link.dataset.mapLink),1);persist();rebuild();return true;}
   const c=e.target.closest('[data-map-connect]'),t=e.target.closest('[data-map-target]'),connect=c?.dataset.mapConnect!==undefined?c:null,target=t?.dataset.mapTarget!==undefined?t:null;
   if(connect||((mode==='connect'||source)&&target)){const id=connect?.dataset.mapConnect||target.dataset.mapTarget;if(source)commitLink(source,id);else{source=id;markSource();hint('始点を選びました。相手の丸・付箋をクリックしてください。Escapeで中止できます。');}return true;}
   if(blank(e.target)&&['circle','sticky'].includes(mode)){const board=document.getElementById('freeMap'),p=point(e,board);addAt(p.x-130,p.y-115,mode);return true;}
  }
  if(e.target.closest('[data-jelly-batch]')?.dataset.jellyBatch!==undefined){const n=Number(document.getElementById('jellyAddCount').value);if(!Number.isInteger(n)||n<1||n>1000){status('追加する本数は1～1000の整数を入力してください。');return true;}checkpoint();for(let i=0;i<n;i++)activeDoc.diagram.evidence.push({text:'',source:'',explanation:'',color:'yellow'});persist();renderEditor();focusField(['diagram','evidence',activeDoc.diagram.evidence.length-n,'text']);return true;}
  return false;
 }
 function change(e){
  if(selected===10&&e.target.dataset?.jellyColumns!==undefined){const value=Number(e.target.value);if(!Number.isInteger(value)||value<0||value>1000)return true;if(value===(activeDoc.diagram.columns??5))return true;checkpoint();activeDoc.diagram.columns=value;CanvasUI.resetLayout();const view=CanvasUI.snapshotView();persist();renderEditor();CanvasUI.restoreView(view);return true;}
  if(selected===2&&e.target.dataset?.mapParent!==undefined){const i=Number(e.target.dataset.mapParent),value=e.target.value==='__none__'?null:e.target.value,candidate=DocumentModel.clone(activeDoc);candidate.diagram.nodes[i].parent=value;try{DocumentModel.validate(candidate);}catch{e.target.value=activeDoc.diagram.nodes[i].parent??'__none__';status('自分や子孫の枝にはつなげません。');return true;}checkpoint();activeDoc.diagram.nodes[i].parent=value;persist();rebuild();return true;}return false;
 }
 function input(keys){
  if(selected===2&&keys[1]==='nodes'&&['color','shape'].includes(keys[3])){const n=activeDoc.diagram.nodes[keys[2]],el=app.querySelector(`[data-map-id="${n.id}"]`);if(el){el.style.setProperty('--note-color',bg(n.color));el.classList.toggle('round-note',(n.shape||'circle')==='circle');el.classList.toggle('sticky',n.shape==='sticky');}}
  if(selected===10&&keys[1]==='evidence'&&keys[3]==='color'){const el=app.querySelector(`[data-jelly-index="${keys[2]}"]`);el?.style.setProperty('--note-color',bg(activeDoc.diagram.evidence[keys[2]].color));}
 }
 function cancel(){
  const hadInteraction=drag||port||source;
  if(drag?.kind==='map'){const el=app.querySelector(`[data-map-id="${drag.id}"]`);if(el){el.style.left=drag.x+'px';el.style.top=drag.y+'px';}}
  if(drag?.element)drag.element.style.transform='';drag=null;port=null;source=null;if(selected===2){repaint();if(hadInteraction)hint('操作を中止しました。');}
 }
 function dropTarget(e,exclude){const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-map-target]');if(hit&&hit.dataset.mapTarget!==exclude)return hit;const sc=app.querySelector('.map-scroll'),bounds=sc?.getBoundingClientRect();if(!bounds||e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)return null;let nearest=null,best=25;app.querySelectorAll('[data-map-target]').forEach(el=>{if(el.dataset.mapTarget===exclude)return;const r=el.getBoundingClientRect(),dx=Math.max(r.left-e.clientX,0,e.clientX-r.right),dy=Math.max(r.top-e.clientY,0,e.clientY-r.bottom),d=Math.hypot(dx,dy);if(d<best){best=d;nearest=el;}});return nearest;}
 function down(e){if(CanvasUI.isPanning())return;
  if(e.button!==0||drag||port)return;const handle=e.target.closest('[data-map-drag],[data-jelly-drag]'),connector=e.target.closest('[data-map-connect]');
  const whole=selected===2&&mode==='connect'?e.target.closest('[data-map-target]'):null;
  if((connector||whole)&&selected===2){e.preventDefault();const origin=whole||connector;port={id:whole?.dataset.mapTarget||connector.dataset.mapConnect,startX:e.clientX,startY:e.clientY,session:editorSession,element:origin,moved:false,pointer:e.pointerId};origin.setPointerCapture(e.pointerId);markSource();return;}
  if(!handle)return;e.preventDefault();handle.focus();handle.setPointerCapture(e.pointerId);
  if(handle.dataset.mapDrag){const n=activeDoc.diagram.nodes.find(n=>n.id===handle.dataset.mapDrag),board=document.getElementById('freeMap');drag={kind:'map',id:n.id,x:n.x,y:n.y,initial:point(e,board),session:editorSession,pointer:e.pointerId,element:handle,moved:false};}
  else{drag={kind:'jelly',index:Number(handle.dataset.jellyDrag),startX:e.clientX,startY:e.clientY,session:editorSession,pointer:e.pointerId,element:handle.closest('[data-jelly-index]'),moved:false};}
 }
 function move(e){
  if((drag&&drag.pointer!==e.pointerId)||(port&&port.pointer!==e.pointerId))return;
  if(port){if(port.session!==editorSession){cancel();return;}if(Math.hypot(e.clientX-port.startX,e.clientY-port.startY)>5)port.moved=true;if(port.moved){port.over=dropTarget(e,port.id)?.dataset.mapTarget;markSource();const board=document.getElementById('freeMap'),p=point(e,board),a=pos(port.id),rubber=document.getElementById('mapRubber');if(rubber){rubber.setAttribute('x1',a.x+a.w/2);rubber.setAttribute('y1',a.y+a.h/2);rubber.setAttribute('x2',p.x);rubber.setAttribute('y2',p.y);rubber.setAttribute('visibility','visible');}}return;}
  if(!drag)return;if(drag.session!==editorSession){cancel();return;}
  if(drag.kind==='map'){const p=point(e,document.getElementById('freeMap')),dx=p.x-drag.initial.x,dy=p.y-drag.initial.y;if(Math.hypot(dx,dy)<3&&!drag.moved)return;drag.moved=true;drag.nextX=Math.round(drag.x+dx);drag.nextY=Math.round(drag.y+dy);const el=app.querySelector(`[data-map-id="${drag.id}"]`);if(el){el.style.left=drag.nextX+'px';el.style.top=drag.nextY+'px';}repaint();}
  else{const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved)drag.element.style.transform=`translate(${dx}px,${dy}px)`;}
 }
 function up(e){
  if((drag&&drag.pointer!==e.pointerId)||(port&&port.pointer!==e.pointerId))return;
  if(port){const p=port;port=null;document.getElementById('mapRubber')?.setAttribute('visibility','hidden');if(p.session===editorSession&&p.moved){e.preventDefault();const target=dropTarget(e,p.id);if(target)commitLink(p.id,target.dataset.mapTarget);else{source=p.id;hint('始点を保持しました。相手をクリックするとつなげます。');}markSource();suppressClick=true;setTimeout(()=>suppressClick=false,50);}return;}
  if(!drag)return;const d=drag;drag=null;if(d.session!==editorSession)return;
  if(d.kind==='map'&&d.moved){const n=activeDoc.diagram.nodes.find(n=>n.id===d.id);if(n&&(n.x!==d.nextX||n.y!==d.nextY)){checkpoint();n.x=d.nextX;n.y=d.nextY;persist();repaint();}suppressClick=true;setTimeout(()=>suppressClick=false,50);}
  if(d.kind==='jelly'){d.element.style.transform='';if(d.moved){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-jelly-index]'),to=Number(target?.dataset.jellyIndex);if(target&&to!==d.index){checkpoint();CanvasUI.clearPick();activeDoc.diagram.evidence.splice(to,0,activeDoc.diagram.evidence.splice(d.index,1)[0]);persist();renderEditor();focusField(['diagram','evidence',to,'text']);}suppressClick=true;setTimeout(()=>suppressClick=false,50);}}
 }
 let suppressClick=false;
 function handleClick(e){if(suppressClick){suppressClick=false;return true;}return click(e);}
 function key(e){
  if(e.key==='Escape'){cancel();return;}
  const endpoint=e.target.closest('[data-map-target]');if(selected===2&&mode==='connect'&&endpoint===e.target&&['Enter',' '].includes(e.key)){e.preventDefault();click(e);return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-map-link],[data-map-tree]')){e.preventDefault();click(e);return;}
  const handle=e.target.closest('[data-map-drag]');if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const n=activeDoc.diagram.nodes.find(n=>n.id===handle.dataset.mapDrag),step=e.shiftKey?50:10,x=n.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y=n.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);if(x===n.x&&y===n.y)return;checkpoint();n.x=x;n.y=y;persist();const el=handle.closest('[data-map-id]');el.style.left=x+'px';el.style.top=y+'px';repaint();
 }
 function init(){app.addEventListener('pointerdown',down);app.addEventListener('pointermove',move);app.addEventListener('pointerup',up);app.addEventListener('pointercancel',cancel);app.addEventListener('keydown',key);app.addEventListener('dblclick',e=>{if(selected===2&&!CanvasUI.isPanning()&&blank(e.target)&&mode==='select'){const p=point(e,document.getElementById('freeMap'));addAt(p.x-130,p.y-115,'circle');}});window.addEventListener('blur',cancel);}
 function reset(){cancel();mode='select';suppressClick=false;}
 function jellyLayout(label='足の並べ方'){const value=activeDoc.diagram.columns??5;const options=[5,6,8,10,15,20,0];if(!options.includes(value))options.unshift(value);return `<label>${label}<select data-jelly-columns aria-label="${label}">${options.map(n=>`<option value="${n}" ${value===n?'selected':''}>${n===0?'すべて横一列（折り返さない）':n+'本で折り返す'}</option>`).join('')}</select></label>`;}
 return {map,jelly,init,click:handleClick,change,input,bg,cancel,reset,jellyLayout,currentMode:()=>mode};
})();
