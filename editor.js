const drafts = new Map(), histories = new Map(), storageErrors = new Map(), blocked = new Set();
let activeDoc, editGroup = null, editorSession = 0, importSequence = 0;
function documentFor(id) {
  if (!drafts.has(id)) {
    let raw;
    try { raw = localStorage.getItem('thinking-tool-'+id); }
    catch { storageErrors.set(id,'端末内保存を利用できません。入力はこの画面内で保持します。編集用データを書き出してください。'); }
    try { drafts.set(id, DocumentModel.restore(raw ?? null,id)); }
    catch { blocked.add(id); storageErrors.set(id,'保存データを読み込めません。元データは上書きしません。現在の入力は編集用データとして書き出してください。'); drafts.set(id,DocumentModel.fresh(id)); }
  }
  return drafts.get(id);
}
function status(message) {
  const el = document.getElementById('status');
  if (el) {el.textContent = storageErrors.get(selected) || message || 'このブラウザに自動保存します。';if(el.dataset)el.dataset.problem=String(storageErrors.has(selected));}
  const focused=document.getElementById('focusStatus');if(focused)focused.textContent=storageErrors.get(selected)||message||'';
}
function persist() {
  if (!activeDoc || blocked.has(selected)) {status();return;}
  try { localStorage.setItem('thinking-tool-'+selected,JSON.stringify(activeDoc)); storageErrors.delete(selected); status('このブラウザ内に保存しました。'); }
  catch { storageErrors.set(selected,'端末内に保存できません。入力はこの画面内で保持します。編集用データを書き出してください。'); status(); }
}
function historyFor() {
  if (!histories.has(selected)) histories.set(selected,{undo:[],redo:[]});
  return histories.get(selected);
}
function checkpoint() {
  const h = historyFor(); h.undo.push(DocumentModel.clone(activeDoc));
  if (h.undo.length > 60) h.undo.shift();
  h.redo = []; updateHistoryButtons();
}
function updateHistoryButtons() {
  const h=historyFor();
  if (document.getElementById('undo')) document.getElementById('undo').disabled=!h.undo.length;
  if (document.getElementById('redo')) document.getElementById('redo').disabled=!h.redo.length;
  const undoIcon=app.querySelector('[data-workspace="undo"]'),redoIcon=app.querySelector('[data-workspace="redo"]');if(undoIcon)undoIcon.disabled=!h.undo.length;if(redoIcon)redoIcon.disabled=!h.redo.length;
}
function undoEdit(redo=false) {
  const h=historyFor(), from=redo?h.redo:h.undo, to=redo?h.undo:h.redo;
  if (!from.length) return;
  const view=CanvasUI.snapshotView(),columns=selected===10?(activeDoc.diagram.columns??5):null;CanvasUI.clearPick();
  to.push(DocumentModel.clone(activeDoc)); activeDoc=from.pop(); drafts.set(selected,activeDoc);
  if(selected===10&&columns!==(activeDoc.diagram.columns??5))CanvasUI.resetLayout();
  persist(); renderEditor();CanvasUI.restoreView(view);
  const primary=document.getElementById(redo?'redo':'undo');
  const alternate=document.getElementById(redo?'undo':'redo');
  const visible=app.querySelector(redo?'[data-workspace=redo]':'[data-workspace=undo]');if(document.body?.classList?.contains('focus-mode')){if(visible&&!visible.disabled)visible.focus({preventScroll:true});else CanvasUI.focusCanvas();}else (primary.disabled?alternate:primary).focus({preventScroll:true});
}
function resetDocument() {
  if (route!=='detail'||!activeDoc) return;
  if (!window.confirm(`「${tools[selected][0]}」のテーマ・図・メモ・まとめを初期状態に戻します。他のツールは変更しません。「取り消し」で戻せます。リセットしますか？`)) return;
  DirectUI.reset(); CanvasUI.resetView();
  const fresh=DocumentModel.fresh(selected);
  if (JSON.stringify(activeDoc)!==JSON.stringify(fresh)) checkpoint();
  activeDoc=fresh; drafts.set(selected,activeDoc); importSequence++;
  persist(); renderEditor();
  document.getElementById('resetDocument').focus();
}
function focusField(path) {
  const el=app.querySelector(`[data-path='${JSON.stringify(path)}']`);
  el?.focus({preventScroll:!!el.closest?.('.infinite-viewport')});
}
function refreshRegionNames() {
  if(selected!==4)return;
  const labels=regionLabels();
  app.querySelectorAll('[data-move]').forEach(select=>{
    [...select.options].forEach((option,index)=>option.textContent=labels[index]);
  });
}
function field(path,value,label,area=false) {
  const attrs=`data-path="${esc(JSON.stringify(path))}" aria-label="${esc(label)}" maxlength="20000"`;
  return area ? `<textarea ${attrs} rows="3">${esc(value)}</textarea>` : `<input ${attrs} value="${esc(value)}">`;
}
function cards(region,label) {
  const d=activeDoc.diagram;
  return `<section class="region" aria-label="${esc(label)}"><h3>${esc(label)}</h3>${d.regions[region].map((text,index)=>`<div class="idea">${field(['diagram','regions',region,index],text,`${label}の記入${index+1}`,true)}<div class="idea-actions"><label>移動先 <select aria-label="${esc(label)}の記入${index+1}の移動先" data-move="${region},${index}">${regionLabels().map((name,i)=>`<option value="${i}" ${i===region?'selected':''}>${esc(name)}</option>`).join('')}</select></label><button data-action="delete-card" data-region="${region}" data-index="${index}" aria-label="${esc(label)}の記入${index+1}を削除">削除</button></div></div>`).join('')}<button data-action="add-card" data-region="${region}" ${d.regions[region].length>=100?'disabled':''}>＋ ${esc(label)}に追加</button></section>`;
}
function regionLabels() {
  if(selected===13||selected===19)return DocumentModel.columnLabels(selected);
  if(selected===18)return activeDoc.diagram.labels.map((_,i)=>`層${i}`);
  if(selected===1)return ['Aのみ','共通（両方）','Bのみ'];
  if(selected===7||selected===8||selected===14||selected===17)return DocumentModel.columnLabels(selected);
  return activeDoc.diagram.labels.slice(0,DocumentModel.chartCount(activeDoc.diagram)).map((v,i)=>v||`観点${i+1}`);
}
function learningColumns(){
  const guides=selected===7?[
    '学習前にKへ知っていること、Wへ知りたいことを書き、学習中・学習後にLへ学んだことを追加します。',
    'KとLを見比べ、考えがどう変わったかを振り返りましょう。調べた情報の出所は下のメモに残せます。',
    'まとめの問い：Wの疑問に答えられた？まだ分からないことや、新しく生まれた疑問は？'
  ]:[
    '同じ対象についてP・M・Iの3つの見方から考えます。判断する前に、それぞれの欄へ理由や事実を書きましょう。',
    'Iには、賛否をすぐに決められない点や、新しい問い・可能性を書きます。',
    'まとめの問い：3つの見方から、どのように判断する？その理由と、さらに確かめたいことは？'
  ];
  return `<p>${guides[0]}</p><p class="note">${guides[1]}</p><div class="diagram-scroll"><div class="learning-columns ${selected===7?'kwl-editor':'pmi-editor'}" role="group" aria-label="${selected===7?'KWLの学習整理表':'PMIの評価表'}">${regionLabels().map((label,i)=>cards(i,label)).join('')}</div></div><p class="note" id="reflectionGuide">${guides[2]}</p>`;
}
function perspectiveRegion(i,className){
  return `<div class="${className}"><label>観点${i+1}${field(['diagram','labels',i],activeDoc.diagram.labels[i],`観点${i+1}`)}</label>${cards(i,`観点${i+1}`)}</div>`;
}
function perspectiveEditor(){
  const d=activeDoc.diagram, variant=d.variant||'Y',count=DocumentModel.chartCount(d);
  const hidden=d.regions.slice(count),hiddenCards=hidden.reduce((sum,region)=>sum+region.length,0);
  let shape;
  if(variant==='Y')shape=`<div class="y-editor"><svg viewBox="0 0 720 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 L360 120 L720 0"/></svg>${[0,1,2].map(i=>perspectiveRegion(i,`y-region y-region-${i}`)).join('')}</div>`;
  if(variant==='X')shape=`<div class="x-editor"><svg viewBox="0 0 120 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 L120 120 M120 0 L0 120"/></svg>${[0,1,2,3].map(i=>perspectiveRegion(i,`x-region x-region-${i}`)).join('')}</div>`;
  if(variant==='W')shape=`<div class="w-editor"><svg viewBox="0 0 720 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 L180 120 L360 0 L540 120 L720 0"/></svg>${[0,1,2,3,4].map(i=>perspectiveRegion(i,`w-region w-region-${i}`)).join('')}</div>`;
  return `<p>観点を設定して気づきを書き、複数の観点をつなげてまとめましょう。</p><label>チャートの種類 <select id="chartVariant" aria-label="チャートの種類">${[['Y',3],['X',4],['W',5]].map(([v,n])=>`<option value="${v}" ${variant===v?'selected':''}>${v}（${n}観点）</option>`).join('')}</select></label><p class="muted">観点1～3は切り替え後も引き継ぎます。観点数を減らしても、追加した観点と記入は保持し、増やすと再表示します。</p>${hidden.length?`<p class="note" id="hiddenPerspectives">非表示の観点${hidden.length}件・記入${hiddenCards}件を保持しています。${d.labels.length===5?'W':'X'}に切り替えるとすべて表示できます。</p>`:''}<div class="diagram-scroll">${shape}</div>`;
}
function specificEditor() {
  const d=activeDoc.diagram;
  if(ExtraEditor.ids.includes(selected))return ExtraEditor.render();
  if (selected===1) return `<p>対象や属性を決め、左右には片方だけの特徴、重なりには両方の特徴を書きます。</p><label>使い方 <select data-path='["diagram","mode"]' aria-label="ベン図の使い方"><option value="compare" ${d.mode==='compare'?'selected':''}>比較</option><option value="classify" ${d.mode==='classify'?'selected':''}>属性による分類</option></select></label><div class="two-labels"><label>Aの対象・属性${field(['diagram','labels',0],d.labels[0],'Aの対象・属性')}</label><label>Bの対象・属性${field(['diagram','labels',1],d.labels[1],'Bの対象・属性')}</label></div><div class="diagram-scroll"><div class="venn-editor"><div class="venn-outline left"></div><div class="venn-outline right"></div><div class="venn-regions">${regionLabels().map((label,i)=>cards(i,label)).join('')}</div></div></div>`;
  if (selected===4) return perspectiveEditor();
  if (selected===7||selected===8) return learningColumns();
  if(selected===12)return candyEditor();
  if(selected===17)return butterflyEditor();
  if(selected===15)return fishEditor();
  if(selected===3)return rakeEditor();
  if(selected===2)return imageMapEditor();
  if(selected===14)return pyramidEditor();
  if(selected===9)return stepEditor();
  if(selected===10)return jellyfishEditor();
  if(selected===6)return dataChartEditor();
  if (selected===5) return `<p>行に比較対象、列に共通の観点を設定します。同じ列を見比べて、違いや共通点を考えましょう。</p><div class="row"><button data-action="add-row" ${d.rows.length>=8?'disabled':''}>＋ 行を追加</button><button data-action="add-column" ${d.columns.length>=8?'disabled':''}>＋ 列を追加</button><span class="muted">各8件まで。削除や並べ替えは取り消せます。</span></div><div class="diagram-scroll"><table class="matrix" style="min-width:${Math.max(650,(d.columns.length+1)*170)}px"><caption>比較対象と共通の観点</caption><thead><tr><th scope="col">対象 ／ 観点</th>${d.columns.map((v,c)=>`<th scope="col">${field(['diagram','columns',c],v,`列${c+1}の観点`)}${axisButtons('column',c,d.columns.length)}</th>`).join('')}</tr></thead><tbody>${d.rows.map((v,r)=>`<tr><th scope="row">${field(['diagram','rows',r],v,`行${r+1}の対象`)}${axisButtons('row',r,d.rows.length)}</th>${d.columns.map((_,c)=>`<td>${field(['diagram','cells',r,c],d.cells[r][c],`行${r+1}・列${c+1}`,true)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="thumb large-thumb">${diagram(selected)}</div><p class="note">このツールの図内編集は未実装です。下の文章欄は保存・再編集できます。</p>`;
}
function dataChartEditor(){
  const d=activeDoc.diagram;
  return `<p>テーマを複数の調査項目と情報源から調べます。情報源には資料名・著者・URL・ページなどを残しましょう。</p><p class="note">同じ項目を複数の資料で確かめ、共通点や食い違い、さらに調べたいことをまとめましょう。</p><div class="row"><button data-action="add-row" ${d.rows.length>=8?'disabled':''}>＋ 行を追加</button><button data-action="add-column" ${d.columns.length>=8?'disabled':''}>＋ 列を追加</button><span>情報源・調査項目は各8件まで</span></div><div class="diagram-scroll"><table class="matrix data-chart"><caption>情報源別の調査内容</caption><thead><tr><th scope="col">情報源 ／ 調査項目</th>${d.columns.map((v,c)=>`<th scope="col">${field(['diagram','columns',c],v,`調査項目${c+1}`)}${axisButtons('column',c,d.columns.length)}</th>`).join('')}</tr></thead><tbody>${d.rows.map((v,r)=>`<tr><th scope="row">${field(['diagram','rows',r],v,`情報源${r+1}（資料名・著者・URL・ページ）`,true)}${axisButtons('row',r,d.rows.length)}</th>${d.columns.map((_,c)=>`<td>${field(['diagram','cells',r,c],d.cells[r][c],`情報源${r+1}・調査項目${c+1}`,true)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function jellyfishEditor(){return DirectUI.jelly();}
function candyEditor(){
 const scenarios=activeDoc.diagram.scenarios;
 return `<p>「もし〜なら」「〜になる」「なぜなら〜」を1組にして予想を考えます。同じキャンバスに追加し、条件や理由を見比べましょう。</p><div class="row candy-actions"><button data-action="add-scenario" ${scenarios.length>=30?'disabled':''}>＋ 予想を追加</button><button data-workspace="candy-fit">すべてのキャンディを表示</button><span>上端をつかんで移動。2本指で拡大・縮小できます。</span></div><div class="diagram-scroll candy-scroll"><div id="candyCanvas" class="candy-canvas">${scenarios.map((s,i)=>{const p=CanvasUI.geometry('scenarios',i);return `<section class="candy-case candy-tile" data-candy-index="${i}" style="left:${p.x}px;top:${p.y}px" aria-label="予想${i+1}"><div class="candy-case-bar"><button class="candy-grip" data-candy-drag="${i}" aria-label="予想${i+1}を動かす">⠿ 予想${i+1}を移動</button><button data-action="copy-scenario" data-index="${i}" aria-label="予想${i+1}を複製" ${scenarios.length>=30?'disabled':''}>複製</button><button data-action="move-scenario" data-index="${i}" aria-label="予想${i+1}を前へ" ${i===0?'disabled':''}>番号を前へ</button><button data-action="delete-scenario" data-index="${i}" aria-label="予想${i+1}を削除" ${scenarios.length===1?'disabled':''}>削除</button></div><div class="candy-row"><div class="candy-end"><h4>もし〜なら</h4><label>仮定・条件${field(['diagram','scenarios',i,'condition'],s.condition,`予想${i+1}の仮定`,true)}</label></div><div class="candy-center"><h4>〜になる</h4><label>起こりそうな結果${field(['diagram','scenarios',i,'prediction'],s.prediction,`予想${i+1}の結果`,true)}</label></div><div class="candy-end"><h4>なぜなら〜</h4><label>理由${field(['diagram','scenarios',i,'reason'],s.reason,`予想${i+1}の理由`,true)}</label><label>類似例・根拠の出所${field(['diagram','scenarios',i,'source'],s.source,`予想${i+1}の根拠の出所`,true)}</label></div></div></section>`}).join('')}</div></div><p class="muted">1～30組。各キャンディは条件・予想・理由・出所をまとめて移動します。「複製」で条件を引き継ぎ、違う予想や理由を比べられます。配置と記入は自動保存され、移動・追加・削除を取り消せます。</p><p class="note">条件を変えると予想はどう変わる？理由は予想を十分に支えている？確かめたいことと、図から考えたことをまとめましょう。</p>`;
}

function butterflyEditor(){
 return `<p>同じ論点について「強い賛成・賛成・反対・強い反対」の4つの立場から、主張と理由・根拠を書きます。自分と違う立場にも立って考えましょう。</p><p class="note">単に賛成か反対かを決めず、強さの違いを生む条件や背景を考えます。理由の根拠や情報源も記入してください。移動先を選ぶと、記入を別の立場へ移せます。</p><div class="diagram-scroll"><div class="butterfly-editor"><div class="butterfly-body"><strong>論点</strong><p id="butterflyTopic">${esc(activeDoc.topic||'上のテーマ欄に入力')}</p></div>${regionLabels().map((label,i)=>`<div class="butterfly-wing wing-${i}">${cards(i,label)}</div>`).join('')}</div></div><p class="note">異なる立場にも納得できる理由はあった？どんな条件なら考えが変わる？4つの立場を比べて、自分の判断と理由をまとめましょう。</p><p class="muted">各立場100件まで。立場の見出しは4段階の意味を保つため固定です。</p>`;
}
function fishEditor(){
 const d=activeDoc.diagram;
 return `<p>頭に問題・結果、大骨に要因の分類、小骨に個別の要因を書きます。分類や骨の数を見直しながら、原因の構造を考えましょう。</p><label>頭：問題・結果${field(['diagram','problem'],d.problem,'問題・結果',true)}</label><p class="note">要因を挙げただけで原因が実証されたとは限りません。未検証の仮説と、根拠を確かめた要因を区別し、調べたことや反例も残しましょう。「根拠あり」は自分の確認状況で、因果関係の証明を意味しません。</p><button data-action="add-bone" ${d.bones.length>=8?'disabled':''}>＋ 大骨を追加</button><div class="diagram-scroll"><div class="fish-chart" style="width:${Math.max(1050,Math.ceil(d.bones.length/2)*350+240)}px"><div class="fish-spine" aria-hidden="true"></div><div class="fish-head">問題・結果<p id="fishProblem">${esc(d.problem||'上の欄に入力')}</p></div><div class="fish-bones" style="grid-template-columns:repeat(${Math.ceil(d.bones.length/2)},minmax(0,1fr))">${d.bones.map((b,i)=>`<section class="fish-bone ${i%2?'lower':'upper'}" style="grid-column:${Math.floor(i/2)+1};grid-row:${i%2+1}" aria-label="大骨${i+1}"><h3>大骨${i+1}</h3><label>要因の分類${field(['diagram','bones',i,'label'],b.label,`大骨${i+1}の分類`)}</label><div class="row"><button data-action="move-bone" data-index="${i}" ${i===0?'disabled':''} aria-label="大骨${i+1}を前へ">前へ</button><button data-action="delete-bone" data-index="${i}" ${d.bones.length===1?'disabled':''} aria-label="大骨${i+1}を削除">削除</button></div>${b.factors.map((f,j)=>`<div class="fish-factor"><label>要因${field(['diagram','bones',i,'factors',j,'text'],f.text,`大骨${i+1}の要因${j+1}`,true)}</label><label>検証状況<select data-path='["diagram","bones",${i},"factors",${j},"state"]' aria-label="大骨${i+1}の要因${j+1}の検証状況">${['hypothesis','checking','supported'].map(v=>`<option value="${v}" ${f.state===v?'selected':''}>${DocumentModel.factorState(v)}</option>`).join('')}</select></label><label>根拠・確かめたこと${field(['diagram','bones',i,'factors',j,'evidence'],f.evidence,`大骨${i+1}の要因${j+1}の根拠`,true)}</label><label>移動先<select data-factor-move="${i},${j}" aria-label="大骨${i+1}の要因${j+1}の移動先">${d.bones.map((_,k)=>`<option value="${k}" ${k===i?'selected':''}>大骨${k+1}</option>`).join('')}</select></label><button data-action="delete-factor" data-region="${i}" data-index="${j}" aria-label="大骨${i+1}の要因${j+1}を削除">削除</button></div>`).join('')}<button data-action="add-factor" data-region="${i}" ${b.factors.length>=30?'disabled':''}>＋ 大骨${i+1}に要因を追加</button></section>`).join('')}</div></div></div><p class="muted">大骨1～8本、各30要因まで。分類を削除すると中の要因も削除します。取り消しで戻せます。</p><p class="note">どの要因をさらに検証する？集めた根拠から、どんな解決仮説を試す？メモとまとめに残しましょう。</p>`;
}
function rakeEditor(){
 const d=activeDoc.diagram;
 return `<p>柄にテーマ、歯にアイデアや観点を書きます。歯の数を決め、発想を絞って出す方法と、複数の観点から見る方法を使い分けましょう。</p><div class="row"><label>使い方<select id="rakeMode" aria-label="くま手の使い方"><option value="ideas" ${d.mode==='ideas'?'selected':''}>発想数を限定</option><option value="views" ${d.mode==='views'?'selected':''}>観点別に見る</option></select></label><label>歯の数<select id="rakeCount" aria-label="くま手の歯の数">${Array.from({length:7},(_,i)=>i+2).map(n=>`<option value="${n}" ${d.count===n?'selected':''}>${n}</option>`).join('')}</select></label></div><p class="note">${d.mode==='ideas'?`歯1本につきアイデアを1つ、合計${d.count}個考えます。自由に増やし続けるのではなく、決めた数で発想しましょう。`:'各歯の見出しに観点を決め、同じ対象をそれぞれの観点から観察・記述しましょう。'}</p>${d.teeth.length>d.count?`<p class="note">非表示の歯${d.teeth.length-d.count}本の見出しと記入を保持しています。歯の数を${d.teeth.length}にするとすべて再表示できます。</p>`:''}<div class="diagram-scroll"><div class="rake-editor" style="min-width:${Math.max(800,d.count*270)}px"><div class="rake-handle"><strong>テーマ（柄）</strong><p id="rakeTheme">${esc(activeDoc.topic||'上のテーマ欄に入力')}</p></div><div class="rake-teeth" style="grid-template-columns:repeat(${d.count},minmax(0,1fr))">${d.teeth.slice(0,d.count).map((t,i)=>`<section class="rake-tooth"><h3>歯${i+1}</h3><label>${d.mode==='ideas'?'アイデアの見出し':'観点'}${field(['diagram','teeth',i,'label'],t.label,`歯${i+1}の見出し`)}</label><label>${d.mode==='ideas'?'アイデアと理由':'観察・気づき'}${field(['diagram','teeth',i,'text'],t.text,`歯${i+1}の記入`,true)}</label><button data-action="move-tooth" data-index="${i}" ${i===0?'disabled':''} aria-label="歯${i+1}を前へ">← 前へ</button></section>`).join('')}</div></div></div><p class="note">共有して比べたら、どのアイデアや観点を選ぶ？選んだ理由や、歯どうしから気づいたことをまとめましょう。</p><p class="muted">歯は2～8本。数を減らしても内容は削除せず保持し、増やすと再表示します。非表示の記入も出力します。</p>`;
}
function imageMapEditor(){return DirectUI.map();}
function pyramidEditor(){
 const d=activeDoc.diagram;
 return `<p>具体的な情報を要点にまとめ、主張へつなぐ／主張を支える理由と事実へ展開する図です。単なる重要度順ではなく、段どうしの関係を説明しましょう。</p><label>進め方<select id="pyramidDirection" aria-label="ピラミッドの進め方"><option value="up" ${d.direction==='up'?'selected':''}>下から上へ集約</option><option value="down" ${d.direction==='down'?'selected':''}>上から下へ展開</option></select></label><p class="note">${d.direction==='up'?'下段の事実を集め、中段で共通する要点を整理し、上段で言えることを考えます。':'上段の主張を決め、中段に理由、下段にそれを支える具体的な事実を選びます。'}</p><div class="diagram-scroll"><div class="pyramid-editor">${regionLabels().map((label,i)=>`<div class="pyramid-level pyramid-level-${i}">${cards(i,label)}</div>`).join('')}</div></div><label>上段と中段のつながり${field(['diagram','connections',0],d.connections[0],'上段と中段のつながり',true)}</label><label>中段と下段のつながり${field(['diagram','connections',1],d.connections[1],'中段と下段のつながり',true)}</label><p class="muted">進め方を切り替えても記入は保持します。各段100件まで。移動先から上下の段へ移せます。</p>`;
}
function stepEditor(){
 const d=activeDoc.diagram;
 const options=value=>d.steps.map((s,i)=>`<option value="${s.id}" ${s.id===value?'selected':''}>段階${i+1} [${s.id}]</option>`).join('');
 return `<p>手順・時間・論理の流れを、段階と矢印で表します。分岐や前の段階への戻りも作れます。</p><p class="note">段階の並べ替えは表示順だけを変えます。矢印の接続先はIDで保持します。段階を削除すると、その段階につながる矢印も削除します。取り消しで戻せます。</p><div class="diagram-scroll"><div class="step-chart">${d.steps.map((s,i)=>`<section class="step-node"><h3>段階${i+1} [${s.id}]</h3>${field(['diagram','steps',i,'text'],s.text,`段階${i+1}の内容`,true)}<button data-action="move-step" data-index="${i}" ${i===0?'disabled':''} aria-label="段階${i+1}を前へ">前へ</button><button data-action="delete-step" data-index="${i}" ${d.steps.length===1?'disabled':''} aria-label="段階${i+1}を削除">削除</button></section>`).join('')}</div></div><button data-action="add-step" ${d.steps.length>=50?'disabled':''}>＋ 段階を追加</button><h3>矢印と順序の理由</h3><p>接続元から接続先へ進みます。同じ接続元から複数の矢印を作ると分岐、前の段階を選ぶと戻りになります。</p>${d.links.map((l,i)=>`<section class="step-link" aria-label="矢印${i+1}"><label>接続元<select data-path='["diagram","links",${i},"from"]' aria-label="矢印${i+1}の接続元">${options(l.from)}</select></label><span aria-hidden="true"> → </span><label>接続先<select data-path='["diagram","links",${i},"to"]' aria-label="矢印${i+1}の接続先">${options(l.to)}</select></label><label>順序・つながりの理由${field(['diagram','links',i,'label'],l.label,`矢印${i+1}の理由`,true)}</label><button data-action="delete-link" data-index="${i}" aria-label="矢印${i+1}を削除">削除</button></section>`).join('')}<button data-action="add-link" ${d.links.length>=100?'disabled':''}>＋ 矢印を追加</button><p class="muted">段階は50件、矢印は100件まで。順番や分岐が必要な理由を説明しましょう。</p>`;
}
function axisButtons(axis,i,length) {
  const name=axis==='row'?'行':'列';
  return `<div class="axis-actions"><button data-action="move-${axis}" data-index="${i}" ${i===0?'disabled':''} aria-label="${name}${i+1}を前へ">${axis==='row'?'↑':'←'}</button><button data-action="delete-${axis}" data-index="${i}" ${length===1?'disabled':''} aria-label="${name}${i+1}を削除">削除</button></div>`;
}
function goToThinkingStep(step){
 if(step===2){const board=app.querySelector('.diagram-scroll,.jelly-scroll'),top=app.querySelector('.workspace-controls')?.getBoundingClientRect?.().height||0;if(board?.style)board.style.scrollMarginTop=(top+40)+'px';board?.scrollIntoView?.({block:'start',behavior:'auto'});CanvasUI.focusCanvas();}
 else app.querySelector(`.editor > label [data-path='${JSON.stringify([step===1?'topic':'summary'])}']`)?.focus();
}
function renderEditor() {
  CanvasUI.captureView();
  route='detail'; activeDoc=documentFor(selected); editGroup=null;editorSession++;
  app.innerHTML=`<button class="back" onclick="go('browse')">← 探す画面へ</button><h1>${esc(tools[selected][0])}</h1><p class="muted">${esc(tools[selected][1])}</p><section class="panel editor"><nav class="thinking-steps" aria-label="考える手順"><p>まずはテーマから。途中で戻ったり、書き直したりできます。</p><ol><li><button type="button" onclick="goToThinkingStep(1)"><b>① テーマを書く</b><span>何について考える？</span></button></li><li><button type="button" onclick="goToThinkingStep(2)"><b>② 図に書く</b><span>比べたり、つないだりしよう</span></button></li><li><button type="button" onclick="goToThinkingStep(3)"><b>③ 気づきをまとめる</b><span>図から何が言える？</span></button></li></ol></nav><label>考えるテーマ${field(['topic'],activeDoc.topic,'考えるテーマ')}</label><div class="row"><button id="undo" onclick="undoEdit()">取り消し</button><button id="redo" onclick="undoEdit(true)">やり直し</button><button id="resetDocument" type="button" onclick="resetDocument()">この図をリセット</button></div><p id="status" role="status" aria-live="polite"></p><h2 class="editor-section-title">② 図に書く</h2>${CanvasUI.toolbar()}${specificEditor()}<label>考えたこと・メモ${field(['notes'],activeDoc.notes,'考えたこと・メモ',true)}</label><h2 class="editor-section-title">③ 気づきをまとめる</h2><label>この図から何が言える？${field(['summary'],activeDoc.summary,'この図から何が言える？',true)}</label><div class="row"><label>保存形式<select id="exportFormat" aria-label="保存形式"><option value="pdf">PDF (.pdf)</option><option value="pptx">PowerPoint (.pptx)</option></select></label><button id="exportWork" onclick="exportWork()">選んだ形式で保存</button></div><p class="muted">図の概要と記入内容の全文を保存します。PDF・PowerPointは画像として出力します。再編集には下の編集用データ（JSON）を使ってください。</p><div class="row"><button onclick="persist()">作業をブラウザに保存</button><button onclick="downloadDocument()">編集用データを書き出す</button><button onclick="downloadText()">内容をテキスト保存</button><label class="import-label">編集用データを読み込む<input id="importFile" type="file" accept=".json,application/json"></label></div><p class="muted">各ツール1件ずつ、このブラウザ内に自動保存します。共有端末では個人情報を入力しないでください。読み込みで置き換えた内容は「取り消し」で戻せます。</p></section>`;
  status(); updateHistoryButtons();CanvasUI.applyZoom();
}
app.addEventListener('focusin',e=>{if(e.target.dataset.path)editGroup=null;});
app.addEventListener('input',e=>{
  const path=e.target.dataset.path;
  if(!path)return;
  const checkKeys=JSON.parse(path);
  if([0,11].includes(selected)&&checkKeys[1]==='links'&&['from','to'].includes(checkKeys[3])){
    const link=activeDoc.diagram.links[checkKeys[2]],other=checkKeys[3]==='from'?'to':'from';
    if(link[other]===e.target.value){e.target.value=link[checkKeys[3]];status('別の項目を接続先に選んでください。元の接続を保持します。');return;}
  }
  if(editGroup!==e.target){checkpoint();editGroup=e.target;}
  const keys=JSON.parse(path);let target=activeDoc;
  keys.slice(0,-1).forEach(k=>target=target[k]); target[keys.at(-1)]=e.target.dataset.number==='true'?Number(e.target.value):e.target.value;
  if(selected===17&&keys[0]==='topic'){const topic=document.getElementById('butterflyTopic');if(topic)topic.textContent=activeDoc.topic||'上のテーマ欄に入力';}
  if(selected===15&&keys[0]==='diagram'&&keys[1]==='problem'){const head=document.getElementById('fishProblem');if(head)head.textContent=activeDoc.diagram.problem||'上の欄に入力';}
  if(selected===3&&keys[0]==='topic'){const theme=document.getElementById('rakeTheme');if(theme)theme.textContent=activeDoc.topic||'上のテーマ欄に入力';}
  if(selected===2&&keys[0]==='topic'){const center=document.getElementById('mapCenterText');if(center)center.textContent=activeDoc.topic||'上のテーマ欄に入力';}
  if(keys[0]==='diagram'&&keys[1]==='labels')refreshRegionNames();

  app.querySelectorAll('[data-path]').forEach(el=>{if(el!==e.target&&el.dataset.path===path)el.value=e.target.value;});
  persist();
  ExtraEditor.input(keys);
  DirectUI.input(keys);
});
app.addEventListener('change',e=>{
  if(DirectUI.change(e))return;
  if(ExtraEditor.change(e))return;
  if(e.target.dataset?.factorMove){
    const [from,i]=e.target.dataset.factorMove.split(',').map(Number),to=Number(e.target.value),bones=activeDoc.diagram.bones;if(from===to)return;
    if(bones[to].factors.length>=30){e.target.value=from;status('移動先は30要因までです。');return;}
    checkpoint();bones[to].factors.push(bones[from].factors.splice(i,1)[0]);persist();renderEditor();focusField(['diagram','bones',to,'factors',bones[to].factors.length-1,'text']);return;
  }
  if(e.target.id==='rakeMode'||e.target.id==='rakeCount'){
    checkpoint();const d=activeDoc.diagram;
    if(e.target.id==='rakeMode')d.mode=e.target.value;
    else{d.count=Number(e.target.value);while(d.teeth.length<d.count)d.teeth.push({label:'',text:''});}
    const id=e.target.id;persist();renderEditor();document.getElementById(id).focus();return;
  }
  if(e.target.dataset?.mapParent!==undefined){
    const i=Number(e.target.dataset.mapParent),candidate=DocumentModel.clone(activeDoc);candidate.diagram.nodes[i].parent=e.target.value;
    try{DocumentModel.validate(candidate);}catch{e.target.value=activeDoc.diagram.nodes[i].parent;status('自分や子孫の枝にはつなげません。現在の接続を保持しました。');return;}
    checkpoint();activeDoc.diagram.nodes[i].parent=e.target.value;persist();renderEditor();app.querySelector(`[data-map-parent="${i}"]`)?.focus();return;
  }
  if(e.target.id==='pyramidDirection'){
    checkpoint();activeDoc.diagram.direction=e.target.value;persist();renderEditor();document.getElementById('pyramidDirection').focus();return;
  }
  if(e.target.id==='chartVariant'){
    checkpoint();DocumentModel.setChartVariant(activeDoc,e.target.value);persist();renderEditor();
    document.getElementById('chartVariant').focus();return;
  }
  if(e.target.matches('[data-path]') && e.target.tagName==='SELECT')e.target.dispatchEvent(new Event('input',{bubbles:true}));
  if(e.target.dataset.move){
    const [r,i]=e.target.dataset.move.split(',').map(Number), to=Number(e.target.value);
    if(to===r)return;
    if(activeDoc.diagram.regions[to].length>=100){status('移動先は100件までです。');e.target.value=r;return;}
    checkpoint();activeDoc.diagram.regions[to].push(activeDoc.diagram.regions[r].splice(i,1)[0]);persist();renderEditor();
    focusField(['diagram','regions',to,activeDoc.diagram.regions[to].length-1]);
  }
  if(e.target.id==='importFile') importDocument(e.target.files[0]);
});
app.addEventListener('click',e=>{
  if(CanvasUI.click(e))return;
  if(DirectUI.click(e))return;
  const b=e.target.closest('[data-action]'); if(!b || b.disabled)return;
  const action=b.dataset.action, d=activeDoc.diagram, i=Number(b.dataset.index), r=Number(b.dataset.region);
  if(action.startsWith('extra-')){ExtraEditor.act(action,i,r);return;}
  checkpoint();
  if(action==='add-scenario')d.scenarios.push({condition:'',prediction:'',reason:'',source:''});
  if(action==='delete-scenario')d.scenarios.splice(i,1);
  if(action==='move-scenario')[d.scenarios[i-1],d.scenarios[i]]=[d.scenarios[i],d.scenarios[i-1]];
  if(action==='add-bone')d.bones.push({label:`分類${d.bones.length+1}`,factors:[]});
  if(action==='delete-bone')d.bones.splice(i,1);
  if(action==='move-bone')[d.bones[i-1],d.bones[i]]=[d.bones[i],d.bones[i-1]];
  if(action==='add-factor')d.bones[r].factors.push({text:'',evidence:'',state:'hypothesis'});
  if(action==='delete-factor')d.bones[r].factors.splice(i,1);
  if(action==='move-tooth')[d.teeth[i-1],d.teeth[i]]=[d.teeth[i],d.teeth[i-1]];
  if(action==='add-node'){let n=1;while(d.nodes.some(v=>v.id==='n'+n))n++;const parent=b.dataset.parent||'',p=d.nodes.find(v=>v.id===parent);d.nodes.push({id:'n'+n,parent,text:'',color:'yellow',shape:'circle',x:p?Math.min(1700,p.x+300):Math.round(Math.max(0,Math.min(1700,870+Math.min(520,360+Math.floor(d.nodes.length/8)*100)*Math.cos(d.nodes.length*Math.PI/4)))),y:p?Math.min(1200,p.y+400):Math.round(Math.max(0,Math.min(1200,685+Math.min(520,360+Math.floor(d.nodes.length/8)*100)*Math.sin(d.nodes.length*Math.PI/4))))});}
  if(action==='delete-node'){const node=d.nodes[i];d.links=(d.links||[]).filter(l=>l.from!==node.id&&l.to!==node.id);d.nodes.forEach(n=>{if(n.parent===node.id)n.parent=node.parent;});d.nodes.splice(i,1);}
  if(action==='position-node'){const n=d.nodes[i],direction=b.dataset.direction;if(direction==='left')n.x-=50;if(direction==='right')n.x+=50;if(direction==='up')n.y-=50;if(direction==='down')n.y+=50;}
  if(action==='add-step'){let n=1;while(d.steps.some(s=>s.id==='s'+n))n++;d.steps.push({id:'s'+n,text:''});}
  if(action==='move-step')[d.steps[i-1],d.steps[i]]=[d.steps[i],d.steps[i-1]];
  if(action==='delete-step'){const id=d.steps[i].id;d.steps.splice(i,1);d.links=d.links.filter(l=>l.from!==id&&l.to!==id);}
  if(action==='add-link')d.links.push({from:d.steps[0].id,to:d.steps.at(-1).id,label:''});
  if(action==='delete-link')d.links.splice(i,1);
  if(action==='add-evidence')d.evidence.push({text:'',source:'',explanation:'',color:'yellow'});
  if(action==='delete-evidence')d.evidence.splice(i,1);
  if(action==='move-evidence')[d.evidence[i-1],d.evidence[i]]=[d.evidence[i],d.evidence[i-1]];
  if(action==='add-card')d.regions[r].push('');
  if(action==='delete-card')d.regions[r].splice(i,1);
  if(action==='add-row'){d.rows.push(`${selected===6?'情報源':'対象'}${d.rows.length+1}`);d.cells.push(d.columns.map(()=>''));}
  if(action==='add-column'){d.columns.push(`${selected===6?'調査項目':'観点'}${d.columns.length+1}`);d.cells.forEach(row=>row.push(''));}
  if(action==='delete-row'){d.rows.splice(i,1);d.cells.splice(i,1);}
  if(action==='delete-column'){d.columns.splice(i,1);d.cells.forEach(row=>row.splice(i,1));}
  if(action==='move-row'){[d.rows[i-1],d.rows[i]]=[d.rows[i],d.rows[i-1]];[d.cells[i-1],d.cells[i]]=[d.cells[i],d.cells[i-1]];}
  if(action==='move-column'){[d.columns[i-1],d.columns[i]]=[d.columns[i],d.columns[i-1]];d.cells.forEach(row=>[row[i-1],row[i]]=[row[i],row[i-1]]);}
  persist();renderEditor();
  if(action==='add-scenario')focusField(['diagram','scenarios',d.scenarios.length-1,'condition']);
  if(action==='delete-scenario')focusField(['diagram','scenarios',Math.min(i,d.scenarios.length-1),'condition']);
  if(action==='move-scenario')focusField(['diagram','scenarios',i-1,'condition']);
  if(action==='add-bone')focusField(['diagram','bones',d.bones.length-1,'label']);
  if(action==='delete-bone')focusField(['diagram','bones',Math.min(i,d.bones.length-1),'label']);
  if(action==='move-bone')focusField(['diagram','bones',i-1,'label']);
  if(action==='add-factor')focusField(['diagram','bones',r,'factors',d.bones[r].factors.length-1,'text']);
  if(action==='delete-factor'){if(d.bones[r].factors.length)focusField(['diagram','bones',r,'factors',Math.min(i,d.bones[r].factors.length-1),'text']);else app.querySelector(`[data-action="add-factor"][data-region="${r}"]`)?.focus();}
  if(action==='move-tooth')focusField(['diagram','teeth',i-1,'label']);
  if(action==='add-node')focusField(['diagram','nodes',d.nodes.length-1,'text']);
  if(action==='position-node')focusField(['diagram','nodes',i,'text']);
  if(action==='delete-node'){if(d.nodes.length)focusField(['diagram','nodes',Math.min(i,d.nodes.length-1),'text']);else app.querySelector('[data-action="add-node"]')?.focus();}
  if(action==='add-step')focusField(['diagram','steps',d.steps.length-1,'text']);
  if(action==='move-step')focusField(['diagram','steps',i-1,'text']);
  if(action==='delete-step')focusField(['diagram','steps',Math.min(i,d.steps.length-1),'text']);
  if(action==='add-link')focusField(['diagram','links',d.links.length-1,'from']);
  if(action==='delete-link'){
    if(d.links.length)focusField(['diagram','links',Math.min(i,d.links.length-1),'from']);
    else app.querySelector('[data-action="add-link"]')?.focus();
  }
  if(action==='add-evidence')focusField(['diagram','evidence',d.evidence.length-1,'text']);
  if(action==='move-evidence')focusField(['diagram','evidence',i-1,'text']);
  if(action==='delete-evidence'){
    if(d.evidence.length)focusField(['diagram','evidence',Math.min(i,d.evidence.length-1),'text']);
    else app.querySelector('[data-action="add-evidence"]')?.focus();
  }
  if(action==='add-card')focusField(['diagram','regions',r,d.regions[r].length-1]);
  if(action==='delete-card'){
    if(d.regions[r].length)focusField(['diagram','regions',r,Math.min(i,d.regions[r].length-1)]);
    else app.querySelector(`[data-action="add-card"][data-region="${r}"]`)?.focus();
  }
  if(action==='add-row')focusField(['diagram','rows',d.rows.length-1]);
  if(action==='add-column')focusField(['diagram','columns',d.columns.length-1]);
  if(action==='delete-row')focusField(['diagram','rows',Math.min(i,d.rows.length-1)]);
  if(action==='delete-column')focusField(['diagram','columns',Math.min(i,d.columns.length-1)]);
  if(action==='move-row')focusField(['diagram','rows',i-1]);
  if(action==='move-column')focusField(['diagram','columns',i-1]);
});
function downloadFile(content,type,extension) {
  const url=URL.createObjectURL(new Blob([content],{type})), a=document.createElement('a');
  a.href=url;a.download=`thinking-tool-${selected+1}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadDocument(){downloadFile(JSON.stringify(activeDoc,null,2),'application/json;charset=utf-8','json');}
let exportBusy=false;
async function exportWork(){
 if(exportBusy)return;
 const button=document.getElementById('exportWork'),format=document.getElementById('exportFormat').value;
 const doc=DocumentModel.clone(activeDoc),name=tools[selected][0],session=editorSession;
 exportBusy=true;button.disabled=true;button.textContent='保存ファイルを作成中…';
 try{
  // Yield before drawing so the progress message becomes visible.
  await new Promise(resolve=>setTimeout(resolve,30));
  const data=await ThinkingExport.create(doc,name,format);
  const url=URL.createObjectURL(new Blob([data],{type:format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));
  const a=document.createElement('a');a.href=url;a.download=`thinking-tool-${doc.toolId+1}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  if(editorSession===session)status('保存ファイルを作成しました。ブラウザのダウンロード先を確認してください。');
 }catch(error){if(editorSession===session)document.getElementById('status').textContent='保存ファイルを作成できませんでした。'+error.message;}
 finally{exportBusy=false;if(button.isConnected){button.disabled=false;button.textContent='選んだ形式で保存';}}
}
function downloadText(){downloadFile(DocumentModel.text(activeDoc,tools[selected][0]),'text/plain;charset=utf-8','txt');}
async function importDocument(file) {
  if(!file)return;
  // A file read must not overwrite later edits, a later import, or a reopened editor.
  const destination=selected, session=editorSession, request=++importSequence;
  const snapshot=JSON.stringify(activeDoc);
  const current=()=>route==='detail'&&selected===destination&&editorSession===session&&importSequence===request;
  try {
    if(file.size>40000000)throw new Error('40MB以下のファイルを選んでください。');
    const doc=DocumentModel.validate(JSON.parse(await file.text()));
    if(!current())return;
    if(JSON.stringify(activeDoc)!==snapshot)throw new Error('読み込み中に編集されたため、読み込みを中止しました。現在の入力を保持しています。必要ならもう一度ファイルを選んでください。');
    if(doc.toolId!==destination)throw new Error('このツールのデータではありません。対応するツールを開いて読み込んでください。');
    if(blocked.has(destination))throw new Error('元の保存データを保護するため読み込みできません。別のブラウザで読み込んでください。');
    checkpoint();activeDoc=doc;drafts.set(selected,doc);persist();renderEditor();status('データを読み込みました。「取り消し」で元に戻せます。');
  } catch(error){if(current()){const el=document.getElementById('status');el.textContent=error instanceof SyntaxError?'JSONを読み取れません。元の入力は保持しています。':error.message;}}
  finally{if(current()){const input=document.getElementById('importFile');if(input)input.value='';}}
}
window.addEventListener('beforeunload',e=>{if([...storageErrors.keys()].some(id=>drafts.has(id))){e.preventDefault();e.returnValue='';}});
CanvasUI.init();
DirectUI.init();
render();
