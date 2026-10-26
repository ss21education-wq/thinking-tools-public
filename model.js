/* Editable documents use the existing zero-based tool IDs and storage keys. */
const DocumentModel = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  function fresh(toolId) {
    const doc = {version:[2,3,6,7,8,9,10,12,14,15,17].includes(toolId)?3:2, toolId, topic:'', notes:'', summary:''};
    if (toolId === 1) doc.diagram = {mode:'compare', labels:['対象A','対象B'], regions:[[],[],[]]};
    if (toolId === 4) doc.diagram = {variant:'Y',labels:['観点1','観点2','観点3'], regions:[[],[],[]]};
    if (toolId === 5) doc.diagram = {rows:['対象1','対象2'], columns:['観点1','観点2'], cells:[['',''],['','']]};
    if (toolId === 7 || toolId === 8) doc.diagram = {regions:[[],[],[]]};
    if(toolId===6)doc.diagram={rows:['情報源1','情報源2'],columns:['調査項目1','調査項目2'],cells:[['',''],['','']]};
    if(toolId===10){doc.version=5;doc.diagram={claim:'',evidence:[]};}
    if(toolId===9)doc.diagram={steps:[{id:'s1',text:''},{id:'s2',text:''}],links:[{from:'s1',to:'s2',label:''}]};
    if(toolId===14)doc.diagram={direction:'up',regions:[[],[],[]],connections:['','']};
    if(toolId===2){doc.version=5;doc.diagram={nodes:[],links:[]};}
    if(toolId===3)doc.diagram={mode:'ideas',count:3,teeth:Array.from({length:3},()=>({label:'',text:''}))};
    if(toolId===15)doc.diagram={problem:'',bones:Array.from({length:4},(_,i)=>({label:`分類${i+1}`,factors:[]}))};
    if(toolId===17)doc.diagram={regions:[[],[],[],[]]};
    if(toolId===12)doc.version=4;
    if(toolId===12)doc.diagram={scenarios:[{condition:'',prediction:'',reason:'',source:''}]};
    if([0,11].includes(toolId)){doc.version=6;doc.diagram={nodes:[],links:[],groups:[],freeArrows:[]};}
    if(toolId===13){doc.version=4;doc.diagram={direction:'ltr',regions:[[],[],[],[],[]]};}
    if(toolId===16){doc.version=4;doc.diagram={axes:{x:'横軸',y:'縦軸',left:'低い',right:'高い',bottom:'低い',top:'高い'},points:[]};}
    if(toolId===18){doc.version=4;doc.diagram={meaning:'',labels:['中心','輪1','輪2'],regions:[[],[],[]]};}
    if(toolId===19){doc.version=4;doc.diagram={regions:[[],[],[],[]]};}
    return doc;
  }
  function validate(value) {
    const fail = () => {throw new Error('対応する編集用データではありません。内容とバージョンを確認してください。')};
    const str = v => typeof v === 'string' && v.length <= 20000;
    const strings = (v,min,max) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(str);
    if (!value || !Number.isInteger(value.toolId) || value.toolId < 0 || value.toolId > 19) fail();
    if(value.version!==2 && !(value.version===3 && [2,3,6,7,8,9,10,12,14,15,17].includes(value.toolId)) && !(value.version===4&&[0,11,12,13,16,18,19].includes(value.toolId)) && !(value.version===5&&[2,10].includes(value.toolId)) && !(value.version===6&&[0,11].includes(value.toolId)))fail();
    if (![value.topic,value.notes,value.summary].every(str)) fail();
    const out = fresh(value.toolId);
    for (const key of ['topic','notes','summary']) out[key] = value[key];
    const d = value.diagram;
    if (value.toolId === 1) {
      if (!d || !strings(d.labels,2,2) || !Array.isArray(d.regions) || d.regions.length !== 3 || !d.regions.every(r=>strings(r,0,100))) fail();
      out.diagram = {labels:clone(d.labels), regions:clone(d.regions)};
      if (!['compare','classify'].includes(d.mode)) fail();
      out.diagram.mode = d.mode;
    }
    if (value.toolId === 4) {
      if(!d)fail();
      const variant=d.variant===undefined?'Y':d.variant;
      if(!['Y','X','W'].includes(variant))fail();
      const count=chartCount({variant});
      if(!strings(d.labels,count,5)||!Array.isArray(d.regions)||d.regions.length!==d.labels.length||!d.regions.every(r=>strings(r,0,100)))fail();
      out.diagram={variant,labels:clone(d.labels),regions:clone(d.regions)};
    }
    if (value.toolId === 5 || (value.toolId===6 && d!==undefined)) {
      if (!d || !strings(d.rows,1,8) || !strings(d.columns,1,8) || !Array.isArray(d.cells) || d.cells.length !== d.rows.length || !d.cells.every(r=>strings(r,d.columns.length,d.columns.length))) fail();
      out.diagram = {rows:clone(d.rows),columns:clone(d.columns),cells:clone(d.cells)};
    }
    if(value.toolId===7||value.toolId===8){
      // Earlier v2 documents for these tools had only topic, notes and summary.
      if(d===undefined&&value.version===3)fail();
      if(d!==undefined){
        if(!d||!Array.isArray(d.regions)||d.regions.length!==3||!d.regions.every(r=>strings(r,0,100)))fail();
        out.diagram={regions:clone(d.regions)};
      }
    }
    if([6,10].includes(value.toolId)&&d===undefined&&value.version!==2)fail();
    if(value.toolId===10&&d!==undefined){
      if(!d||!str(d.claim)||!Array.isArray(d.evidence)||!d.evidence.every(e=>e&&[e.text,e.source,e.explanation].every(str)&&validColor(e.color)))fail();
      out.diagram={claim:d.claim,evidence:d.evidence.map(e=>({text:e.text,source:e.source,explanation:e.explanation,color:e.color||'yellow'}))};
      if(d.columns!==undefined){if(!Number.isInteger(d.columns)||d.columns<0||d.columns>1000)fail();out.diagram.columns=d.columns;}
    }
    if(value.toolId===9){
      if(d===undefined&&value.version===3)fail();
      if(d!==undefined){
        if(!d||!Array.isArray(d.steps)||d.steps.length<1||d.steps.length>50||!d.steps.every(s=>s&&typeof s.id==='string'&&/^s[1-9][0-9]{0,5}$/.test(s.id)&&str(s.text)))fail();
        const ids=new Set(d.steps.map(s=>s.id));
        if(ids.size!==d.steps.length||!Array.isArray(d.links)||d.links.length>100||!d.links.every(l=>l&&ids.has(l.from)&&ids.has(l.to)&&str(l.label)))fail();
        out.diagram={steps:d.steps.map(s=>({id:s.id,text:s.text})),links:d.links.map(l=>({from:l.from,to:l.to,label:l.label}))};
      }
    }
    if(value.toolId===14){
      if(d===undefined&&value.version===3)fail();
      if(d!==undefined){
        if(!d||!['up','down'].includes(d.direction)||!Array.isArray(d.regions)||d.regions.length!==3||!d.regions.every(r=>strings(r,0,100))||!strings(d.connections,2,2))fail();
        out.diagram={direction:d.direction,regions:clone(d.regions),connections:clone(d.connections)};
      }
    }
    if(value.toolId===2){
      if(d===undefined&&value.version!==2)fail();
      if(d!==undefined){
        if(!d||!Array.isArray(d.nodes)||d.nodes.length>500||!d.nodes.every(n=>n&&typeof n.id==='string'&&/^n[1-9][0-9]{0,5}$/.test(n.id)&&str(n.text)&&(n.parent===null||typeof n.parent==='string')&&Number.isInteger(n.x)&&Math.abs(n.x)<=1e9&&Number.isInteger(n.y)&&Math.abs(n.y)<=1e9&&validColor(n.color)&&(n.shape===undefined||['circle','sticky'].includes(n.shape))))fail();
        const byId=new Map(d.nodes.map(n=>[n.id,n]));if(byId.size!==d.nodes.length)fail();
        for(const node of d.nodes){const seen=new Set([node.id]);let parent=node.parent;while(parent!==''&&parent!==null){if(!byId.has(parent)||seen.has(parent))fail();seen.add(parent);parent=byId.get(parent).parent;}}
        const links=d.links===undefined&&value.version!==5?[]:d.links;
        const ids=new Set(['root',...byId.keys()]);
        if(!Array.isArray(links)||links.length>1000||!links.every(l=>l&&ids.has(l.from)&&ids.has(l.to)&&l.from!==l.to)||new Set(links.map(l=>[l.from,l.to].sort().join('|'))).size!==links.length)fail();
        out.diagram={nodes:d.nodes.map(n=>({id:n.id,text:n.text,parent:n.parent,x:n.x,y:n.y,color:n.color||'yellow',shape:n.shape||'circle'})),links:links.map(l=>({from:l.from,to:l.to}))};
      }
    }
    if(value.toolId===3){
      if(d===undefined&&value.version===3)fail();
      if(d!==undefined){
        if(!d||!['ideas','views'].includes(d.mode)||!Number.isInteger(d.count)||d.count<2||d.count>8||!Array.isArray(d.teeth)||d.teeth.length<d.count||d.teeth.length>8||!d.teeth.every(t=>t&&str(t.label)&&str(t.text)))fail();
        out.diagram={mode:d.mode,count:d.count,teeth:d.teeth.map(t=>({label:t.label,text:t.text}))};
      }
    }
    if(value.toolId===15){
      if(d===undefined&&value.version===3)fail();
      if(d!==undefined){
        if(!d||!str(d.problem)||!Array.isArray(d.bones)||d.bones.length<1||d.bones.length>8||!d.bones.every(b=>b&&str(b.label)&&Array.isArray(b.factors)&&b.factors.length<=30&&b.factors.every(f=>f&&str(f.text)&&str(f.evidence)&&['hypothesis','checking','supported'].includes(f.state))))fail();
        out.diagram={problem:d.problem,bones:d.bones.map(b=>({label:b.label,factors:b.factors.map(f=>({text:f.text,evidence:f.evidence,state:f.state}))}))};
      }
    }
    if(value.toolId===17){
      if(d===undefined&&value.version===3)fail();
      if(d!==undefined){
        if(!d||!Array.isArray(d.regions)||d.regions.length!==4||!d.regions.every(r=>strings(r,0,100)))fail();
        out.diagram={regions:clone(d.regions)};
      }
    }
    if(value.toolId===12){
      if(d===undefined&&value.version!==2)fail();
      if(d!==undefined){
        if(!d||!Array.isArray(d.scenarios)||d.scenarios.length<1||d.scenarios.length>30||!d.scenarios.every(s=>s&&[s.condition,s.prediction,s.reason,s.source].every(str)))fail();
        out.diagram={scenarios:d.scenarios.map(s=>{
 const entry={condition:s.condition,prediction:s.prediction,reason:s.reason,source:s.source};
 if(s.x!==undefined||s.y!==undefined){if(![s.x,s.y].every(n=>Number.isInteger(n)&&Math.abs(n)<=1e9))fail();entry.x=s.x;entry.y=s.y;}return entry;})};
      }
    }
    if([0,11,13,16,18,19].includes(value.toolId)){
      if(d===undefined&&value.version!==2)fail();
      if(d!==undefined){
        if(!d)fail();
        if([0,11].includes(value.toolId)){
          if(!Array.isArray(d.nodes)||d.nodes.length>30||!Array.isArray(d.links)||d.links.length>60||!Array.isArray(d.groups)||d.groups.length>10)fail();
          const validId=(s,p)=>typeof s==='string'&&new RegExp('^'+p+'[1-9][0-9]{0,5}$').test(s);
          if(!d.groups.every(g=>g&&validId(g.id,'g')&&str(g.label)))fail();const groups=new Set(d.groups.map(g=>g.id));if(groups.size!==d.groups.length)fail();
          if(!d.nodes.every(n=>n&&validId(n.id,'n')&&str(n.text)&&(n.group===''||groups.has(n.group))&&Number.isInteger(n.x)&&Math.abs(n.x)<=1e9&&Number.isInteger(n.y)&&Math.abs(n.y)<=1e9))fail();
          const ids=new Set(d.nodes.map(n=>n.id));if(ids.size!==d.nodes.length||!d.links.every(l=>l&&ids.has(l.from)&&ids.has(l.to)&&l.from!==l.to&&str(l.label)&&['関係','順序','時間','因果','理由'].includes(l.kind)&&['forward','both','none'].includes(l.direction)&&['solid','dashed'].includes(l.style)))fail();
          out.diagram={nodes:d.nodes.map(n=>({id:n.id,text:n.text,group:n.group,x:n.x,y:n.y})),links:d.links.map(l=>({from:l.from,to:l.to,label:l.label,kind:l.kind,direction:l.direction,style:l.style})),groups:d.groups.map(g=>({id:g.id,label:g.label}))};
          const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
          d.nodes.forEach((n,i)=>{if(n.w!==undefined||n.h!==undefined){if(!integer(n.w,60,1e7)||!integer(n.h,50,1e7))fail();Object.assign(out.diagram.nodes[i],{w:n.w,h:n.h});}});
          d.groups.forEach((g,i)=>{if(['x','y','w','h'].some(k=>g[k]!==undefined)){if(!integer(g.x,-1e9,1e9)||!integer(g.y,-1e9,1e9)||!integer(g.w,60,1e7)||!integer(g.h,50,1e7))fail();Object.assign(out.diagram.groups[i],{x:g.x,y:g.y,w:g.w,h:g.h});}});
          const arrows=d.freeArrows===undefined&&value.version!==6?[]:d.freeArrows;
          if(!Array.isArray(arrows)||arrows.length>100||!arrows.every(a=>a&&integer(a.x1,-1e9,1e9)&&integer(a.x2,-1e9,1e9)&&integer(a.y1,-1e9,1e9)&&integer(a.y2,-1e9,1e9)&&(a.x1!==a.x2||a.y1!==a.y2)&&str(a.label)&&['関係','順序','時間','因果','理由'].includes(a.kind)&&['forward','both','none'].includes(a.direction)&&['solid','dashed'].includes(a.style)))fail();
          out.diagram.freeArrows=arrows.map(a=>Object.fromEntries(['x1','y1','x2','y2','label','kind','direction','style'].map(k=>[k,a[k]])));
        }
        if(value.toolId===13){if(!['ltr','rtl'].includes(d.direction)||!Array.isArray(d.regions)||d.regions.length!==5||!d.regions.every(r=>strings(r,0,100)))fail();out.diagram={direction:d.direction,regions:clone(d.regions)};}
        if(value.toolId===16){if(!d.axes||!['x','y','left','right','bottom','top'].every(k=>str(d.axes[k]))||!Array.isArray(d.points)||d.points.length>50||!d.points.every(p=>p&&str(p.text)&&str(p.reason)&&Number.isInteger(p.x)&&Math.abs(p.x)<=100&&Number.isInteger(p.y)&&Math.abs(p.y)<=100))fail();out.diagram={axes:Object.fromEntries(['x','y','left','right','bottom','top'].map(k=>[k,d.axes[k]])),points:d.points.map(p=>({text:p.text,reason:p.reason,x:p.x,y:p.y}))};}
        if(value.toolId===18){if(!str(d.meaning)||!strings(d.labels,2,6)||!Array.isArray(d.regions)||d.regions.length!==d.labels.length||!d.regions.every(r=>strings(r,0,100)))fail();out.diagram={meaning:d.meaning,labels:clone(d.labels),regions:clone(d.regions)};}
        if(value.toolId===19){if(!Array.isArray(d.regions)||d.regions.length!==4||!d.regions.every(r=>Array.isArray(r)&&r.length<=100&&r.every(c=>c&&str(c.text)&&str(c.source)&&str(c.reason))))fail();out.diagram={regions:d.regions.map(r=>r.map(c=>({text:c.text,source:c.source,reason:c.reason})))};}
      }
    }
    return out;
  }
  function restore(raw,toolId) {
    if (raw === null) return fresh(toolId);
    const value = JSON.parse(raw);
    if (value && value.version === undefined && ['topic','notes','summary'].every(k=>value[k] === undefined || typeof value[k] === 'string')) {
      const doc = fresh(toolId);
      for (const key of ['topic','notes','summary']) doc[key] = value[key] || '';
      return validate(doc);
    }
    const doc = validate(value);
    if (doc.toolId !== toolId) throw new Error('保存先とツールが一致しません。');
    return doc;
  }
  function text(doc,name) {
    const parts = [name,`テーマ：${doc.topic}`,`考えたこと：\n${doc.notes}`];
    const d = doc.diagram;
    if (doc.toolId === 1 || doc.toolId === 4) {
      if (doc.toolId === 1) parts.push(`使い方：${d.mode === 'compare' ? '比較' : '属性による分類'}`,`A：${d.labels[0]} / B：${d.labels[1]}`);
      if (doc.toolId === 4) parts.push(`チャート：${d.variant||'Y'}（${chartCount(d)}観点）`);
      const labels = doc.toolId === 1 ? ['Aのみ','共通（両方）','Bのみ'] : d.labels;
      d.regions.forEach((cards,i)=>parts.push(`${labels[i]}${doc.toolId===4&&i>=chartCount(d)?'（非表示・観点数を増やすと再表示）':''}：\n${cards.join('\n')}`));
    }
    if (doc.toolId === 5 || doc.toolId===6) parts.push([doc.toolId===6?'情報源（資料名・著者・URL・ページ） / 調査項目':'対象 / 観点',...d.columns].join('\t'),...d.rows.map((row,i)=>[row,...d.cells[i]].join('\t')));
    if(doc.toolId===7||doc.toolId===8)d.regions.forEach((cards,i)=>parts.push(`${columnLabels(doc.toolId)[i]}：\n${cards.join('\n')}`));
    if(doc.toolId===10){parts.push(`足の並べ方：${d.columns===0?'すべて横一列':(d.columns??5)+'本で折り返す'}`);parts.push(`主張・結論：\n${d.claim}`);d.evidence.forEach((e,i)=>parts.push(`根拠${i+1}：\n${e.text}\n出典：${e.source}\n主張とのつながり：${e.explanation}\n色：${e.color||'yellow'}`));}
    if(doc.toolId===9){d.steps.forEach((s,i)=>parts.push(`段階${i+1} [${s.id}]：${s.text}`));d.links.forEach(l=>parts.push(`矢印：${l.from} → ${l.to} / 順序・つながりの理由：${l.label}`));}
    if(doc.toolId===14){parts.push(`進め方：${d.direction==='up'?'下から上へ集約':'上から下へ展開'}`);d.regions.forEach((r,i)=>parts.push(`${columnLabels(14)[i]}：\n${r.join('\n')}`));d.connections.forEach((v,i)=>parts.push(`${i===0?'上段と中段':'中段と下段'}のつながり：${v}`));}
    if(doc.toolId===2){doc.diagram.nodes.forEach(n=>parts.push(`[${n.id}] ${n.text}\nつながる元：${n.parent===null?'接続なし':n.parent||'中心テーマ'} / 位置：${n.x}, ${n.y} / 色：${n.color||'yellow'} / 形：${n.shape||'circle'}`));(d.links||[]).forEach(l=>parts.push(`関連線：${l.from} ― ${l.to}`));}
    if(doc.toolId===3){parts.push(`使い方：${d.mode==='ideas'?'発想数を限定':'観点別に見る'} / 歯の数：${d.count}`);d.teeth.forEach((t,i)=>parts.push(`歯${i+1}${i>=d.count?'（非表示・歯の数を増やすと再表示）':''}：${t.label}\n${t.text}`));}
    if(doc.toolId===15){parts.push(`問題・結果：${d.problem}`);d.bones.forEach((b,i)=>parts.push(`大骨${i+1}：${b.label}\n${b.factors.map(f=>`${f.text}\n検証状況：${factorState(f.state)}\n根拠・確かめたこと：${f.evidence}`).join('\n\n')}`));}
    if(doc.toolId===17)d.regions.forEach((r,i)=>parts.push(`${columnLabels(17)[i]}：\n${r.join('\n')}`));
    if(doc.toolId===12)d.scenarios.forEach((s,i)=>parts.push(`予想${i+1}\nもし〜なら（仮定）：${s.condition}\n〜になる（予想）：${s.prediction}\nなぜなら〜（理由）：${s.reason}\n類似例・根拠の出所：${s.source}`));
    if([0,11].includes(doc.toolId)){(d.freeArrows||[]).forEach(a=>parts.push(`自由な矢印：${a.x1},${a.y1} → ${a.x2},${a.y2} / 種類：${a.kind} / 向き：${a.direction==='both'?'双方向':a.direction==='none'?'矢印なし':'始点から終点へ'} / 線：${a.style==='dashed'?'破線':'実線'} / 説明：${a.label}`));d.groups.forEach(g=>parts.push(`囲み [${g.id}]：${g.label}${g.x===undefined?'':` / 位置：${g.x},${g.y} / 大きさ：${g.w},${g.h}`}`));d.nodes.forEach(n=>parts.push(`項目 [${n.id}]：${n.text}\n囲み：${n.group||'なし'} / 位置：${n.x},${n.y}${n.w?` / 大きさ：${n.w},${n.h}`:''}`));d.links.forEach(l=>parts.push(`接続：${l.from} ${l.direction==='both'?'↔':l.direction==='none'?'―':'→'} ${l.to}\n種類：${l.kind} / 線：${l.style==='dashed'?'破線':'実線'} / 関係の説明：${l.label}`));}
    if(doc.toolId===13){parts.push(`表現方向：${d.direction==='ltr'?'左から右':'右から左'}`);d.regions.forEach((r,i)=>parts.push(`${columnLabels(13)[i]}：\n${r.join('\n')}`));}
    if(doc.toolId===16){parts.push(`横軸：${d.axes.x}（左：${d.axes.left}／右：${d.axes.right}）`,`縦軸：${d.axes.y}（下：${d.axes.bottom}／上：${d.axes.top}）`);d.points.forEach(p=>parts.push(`対象：${p.text} / 位置：${p.x},${p.y}\n配置理由：${p.reason}`));}
    if(doc.toolId===18){parts.push(`輪の意味：${d.meaning}`);d.regions.forEach((r,i)=>parts.push(`${i===0?'中心':`輪${i}`}：${d.labels[i]}\n${r.join('\n')}`));}
    if(doc.toolId===19)d.regions.forEach((r,i)=>parts.push(`${columnLabels(19)[i]}：\n${r.map(c=>`${c.text}\n出所：${c.source}\n分類理由・確かさ：${c.reason}`).join('\n\n')}`));
    parts.push(`まとめ：\n${doc.summary}`);
    return parts.join('\n\n')+'\n';
  }
  function chartCount(diagram){return {Y:3,X:4,W:5}[diagram.variant||'Y'];}
  function columnLabels(toolId){
    if(toolId===13)return ['導入','上昇','クライマックス','下降','終末'];
    if(toolId===19)return ['事実','伝聞','推測','意見'];
    if(toolId===17)return ['強い賛成','賛成','反対','強い反対'];
    if(toolId===14)return ['上段：主張・結論','中段：要点・理由','下段：具体的な情報・事実'];
    if(toolId===7)return ['K：知っていること','W：知りたいこと','L：学んだこと'];
    if(toolId===8)return ['P：よい点','M：よくない点','I：興味深い点'];
    throw new Error('3欄ツールの種類が不正です。');
  }
  function setChartVariant(doc,variant){
    if(doc.toolId!==4||!['Y','X','W'].includes(variant))throw new Error('チャートの種類が不正です。');
    const d=doc.diagram;
    for(let i=d.labels.length;i<chartCount({variant});i++){d.labels.push(`観点${i+1}`);d.regions.push([]);}
    d.variant=variant;
  }
  function factorState(state){return {hypothesis:'未検証の仮説',checking:'検証中',supported:'根拠あり（自分で確認）'}[state];}
  function validColor(color){return color===undefined||['yellow','blue','green','pink','purple','white'].includes(color);}
  return {fresh,validate,restore,text,clone,chartCount,setChartVariant,columnLabels,factorState};
})();
if (typeof module !== 'undefined') module.exports = DocumentModel;
