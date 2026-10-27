/* Offline document export. Page images keep Japanese fonts and diagram geometry. */
const ThinkingExport=(()=>{
 const W=1400,H=990,enc=new TextEncoder();
 const bytes=s=>enc.encode(s);
 const join=arrays=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arrays){out.set(a,p);p+=a.length;}return out;};
 function crc32(a){let c=0xffffffff;for(const b of a){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 function zip(entries){
  const parts=[],central=[];let offset=0;
  const header=(size,values)=>{const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [p,n,len] of values)len===2?v.setUint16(p,n,true):v.setUint32(p,n,true);return b;};
  for(const [name,data] of entries){const n=bytes(name),a=typeof data==='string'?bytes(data):data,c=crc32(a);
   const local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,c,4],[18,a.length,4],[22,a.length,4],[26,n.length,2]]);
   parts.push(local,n,a);central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,c,4],[20,a.length,4],[24,a.length,4],[28,n.length,2],[42,offset,4]]),n);offset+=30+n.length+a.length;
  }
  const cd=join(central);return join([...parts,cd,header(22,[[0,0x06054b50,4],[8,entries.length,2],[10,entries.length,2],[12,cd.length,4],[16,offset,4]])]);
 }
 function dataBytes(url){return Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));}
 function pdf(jpegs){
  const objects=[],add=s=>{objects.push(typeof s==='string'?bytes(s):s);return objects.length;};
  add('<< /Type /Catalog /Pages 2 0 R >>');add('');const kids=[];
  for(const jpg of jpegs){const page=objects.length+1,image=page+1,content=page+2;kids.push(`${page} 0 R`);
   add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im ${image} 0 R >> >> /Contents ${content} 0 R >>`);
   add(join([bytes(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),jpg,bytes('\nendstream')]));
   const cmd='q 841.89 0 0 595.28 0 0 cm /Im Do Q';add(`<< /Length ${cmd.length} >>\nstream\n${cmd}\nendstream`);
  }
  objects[1]=bytes(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.join(' ')}] >>`);
  const parts=[bytes('%PDF-1.4\n')],offsets=[0];let pos=parts[0].length;
  objects.forEach((o,i)=>{offsets.push(pos);const p=join([bytes(`${i+1} 0 obj\n`),o,bytes('\nendobj\n')]);parts.push(p);pos+=p.length;});
  parts.push(bytes(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`));return join(parts);
 }
 const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
 const rel=(items)=>xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id,type,target])=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`);
 function pptx(pngs){
  const p='http://schemas.openxmlformats.org/presentationml/2006/main',a='http://schemas.openxmlformats.org/drawingml/2006/main',r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const files=[['[Content_Types].xml',xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${pngs.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`)],
   ['_rels/.rels',rel([['rId1','officeDocument','ppt/presentation.xml']])],
   ['ppt/presentation.xml',xml(`<p:presentation xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rMaster"/></p:sldMasterIdLst><p:sldIdLst>${pngs.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12801600" cy="9052560"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)],
   ['ppt/_rels/presentation.xml.rels',rel([['rMaster','slideMaster','slideMasters/slideMaster1.xml'],...pngs.map((_,i)=>[`rId${i+1}`,'slide',`slides/slide${i+1}.xml`])])],
   ['ppt/slideMasters/slideMaster1.xml',xml(`<p:sldMaster xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/></p:sldMaster>`)],
   ['ppt/slideMasters/_rels/slideMaster1.xml.rels',rel([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']])],
   ['ppt/slideLayouts/slideLayout1.xml',xml(`<p:sldLayout xmlns:p="${p}" xmlns:a="${a}" type="blank"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`)],
   ['ppt/slideLayouts/_rels/slideLayout1.xml.rels',rel([['rId1','slideMaster','../slideMasters/slideMaster1.xml']])]];
  pngs.forEach((img,i)=>{files.push([`ppt/media/image${i+1}.png`,img],[`ppt/slides/slide${i+1}.xml`,xml(`<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${group}<p:pic><p:nvPicPr><p:cNvPr id="2" name="Thinking tool page ${i+1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rImage"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12801600" cy="9052560"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)],
   [`ppt/slides/_rels/slide${i+1}.xml.rels`,rel([['rImage','image',`../media/image${i+1}.png`],['rLayout','slideLayout','../slideLayouts/slideLayout1.xml']])]);});return zip(files);
 }
 function wrap(ctx,text,width){const lines=[];for(const line of String(text).replace(/\r\n?/g,'\n').split('\n')){let row='';for(const ch of line){if(ctx.measureText(row+ch).width>width&&row){lines.push(row);row='';}row+=ch;}lines.push(row);}return lines;}
 function render(doc,name,fullText,makeCanvas=()=>document.createElement('canvas'),options={}){
  const pages=[];let ctx;
  function page(title){if(pages.length>=100)throw Error('出力が100ページを超えます。記入内容を分けて保存してください。');const canvas=makeCanvas();canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');if(!ctx)throw Error('画像を作成できません。');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#243449';ctx.font='bold 30px "Yu Gothic",sans-serif';ctx.fillText(title.slice(0,65),48,50);ctx.font='20px "Yu Gothic",sans-serif';ctx.fillText(`シンキングツール  |  ${pages.length+1}`,48,962);pages.push(canvas);return ctx;}
  function box(x,y,w,h,title,text,color='#f4f8fc',circle=false){ctx.strokeStyle='#597b9c';ctx.fillStyle=color;ctx.lineWidth=2;if(circle){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}else{ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}ctx.save();ctx.beginPath();ctx.rect(x+10,y+8,w-20,h-16);ctx.clip();ctx.fillStyle='#243449';ctx.font='bold 20px "Yu Gothic",sans-serif';ctx.fillText(title,x+14,y+28);ctx.font='19px "Yu Gothic",sans-serif';const lines=wrap(ctx,text,w-28),max=Math.max(1,Math.floor((h-45)/25));lines.slice(0,max).forEach((l,i)=>ctx.fillText((i===max-1&&lines.length>max)?l+'…':l,x+14,y+58+i*25));ctx.restore();}
  function fitWorld(rects,width,height){const x=Math.min(0,...rects.map(p=>p.x-25)),y=Math.min(0,...rects.map(p=>p.y-35)),right=Math.max(width,...rects.map(p=>p.x+p.w+25)),bottom=Math.max(height,...rects.map(p=>p.y+p.h+25)),w=right-x,h=bottom-y,z=Math.min(1300/w,730/h);ctx.save();ctx.translate(50+(1300-w*z)/2,125+(730-h*z)/2);ctx.scale(z,z);ctx.translate(-x,-y);}
  const noteColor=c=>({yellow:'#fff1a8',blue:'#d7edff',green:'#ddf3c4',pink:'#ffe0ea',purple:'#eaddff',white:'#ffffff'}[c||'yellow']);
  const d=doc.diagram,id=doc.toolId;
  if(id===6&&options.singlePageData){
   page(name);
   // Keep every row and every character on one sheet; reject overflow rather than silently omit it.
   function fitted(text,x,y,w,h,bold=false,max=22){
    let lines,size;
    for(size=max;size>=12;size--){ctx.font=(bold?'bold ':'')+size+'px "Yu Gothic",sans-serif';lines=wrap(ctx,text,w);if(lines.length*size*1.35<=h)break;}
    if(size<12)throw Error('データチャートを1ページに収められません。長い記入を短くしてからPDFを保存してください。編集用データ（JSON）では全文を保存できます。');
    ctx.fillStyle='#243449';lines.forEach((line,i)=>ctx.fillText(line,x,y+size+i*size*1.35));
   }
   fitted('テーマ：'+doc.topic,50,70,1290,50,true);
   const rows=d.rows.length+1,cols=d.columns.length+1,cw=1290/cols;
   const cells=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>r===0?(c===0?'情報源 ／ 調査項目':d.columns[c-1]):c===0?d.rows[r-1]:d.cells[r-1][c-1]));
   let size,heights;
   for(size=22;size>=12;size--){
    heights=cells.map((row,r)=>Math.max(44,...row.map((text,c)=>{ctx.font=(r===0||c===0?'bold ':'')+size+'px "Yu Gothic",sans-serif';return wrap(ctx,text,cw-20).length*size*1.35+20;})));
    if(heights.reduce((a,b)=>a+b,0)<=510)break;
   }
   if(size<12)throw Error('データチャートの表を1ページに収められません。長い記入を短くしてからPDFを保存してください。編集用データ（JSON）では全文を保存できます。');
   const extra=(510-heights.reduce((a,b)=>a+b,0))/rows;let y=130;
   cells.forEach((row,r)=>{const h=heights[r]+extra;row.forEach((text,c)=>{const x=50+c*cw;ctx.fillStyle=r===0||c===0?'#edf5fc':'#ffffff';ctx.fillRect(x,y,cw,h);ctx.strokeStyle='#597b9c';ctx.lineWidth=1;ctx.strokeRect(x,y,cw,h);fitted(text,x+10,y+10,cw-20,h-20,r===0||c===0,size);});y+=h;});
   const hasNotes=Boolean(doc.notes.trim()),summaryHeight=hasNotes?165:275;
   ctx.fillStyle='#f4f8fc';ctx.fillRect(50,655,1290,summaryHeight);ctx.strokeStyle='#597b9c';ctx.strokeRect(50,655,1290,summaryHeight);
   ctx.font='bold 22px "Yu Gothic",sans-serif';ctx.fillStyle='#243449';ctx.fillText('まとめ',64,684);
   fitted(doc.summary,64,695,1262,summaryHeight-48);
   if(hasNotes){ctx.font='bold 18px "Yu Gothic",sans-serif';ctx.fillText('考えたこと・メモ',50,847);fitted(doc.notes,50,855,1290,75,false,18);}
   return pages;
  }
  page(name+'：図の概要');ctx.fillText('テーマ：'+doc.topic.slice(0,70),48,90);
  const columns=(labels,regions)=>{const n=labels.length,w=1290/n;labels.forEach((l,i)=>box(50+i*w,145,w-14,660,l,regions[i].join('\n')));};
  if(id===1){ctx.strokeStyle='#597b9c';ctx.lineWidth=3;for(const x of [520,880]){ctx.beginPath();ctx.ellipse(x,460,390,310,0,0,Math.PI*2);ctx.stroke();}ctx.fillText(d.labels[0].slice(0,25),120,133);ctx.fillText(d.labels[1].slice(0,25),870,133);['Aのみ','共通（両方）','Bのみ'].forEach((l,i)=>box(130+i*390,290,350,350,l,d.regions[i].join('\n')));}
  else if(id===2){const at=n=>({x:n.x,y:n.y,w:260,h:230}),root={x:870,y:710,w:260,h:180};fitWorld([root,...d.nodes.map(at)],2000,1600);const find=id=>id==='root'?root:at(d.nodes.find(n=>n.id===id));const line=(a,b)=>{ctx.beginPath();ctx.moveTo(a.x+a.w/2,a.y+a.h/2);ctx.lineTo(b.x+b.w/2,b.y+b.h/2);ctx.stroke();};d.nodes.forEach(n=>{if(n.parent!==null)line(n.parent?find(n.parent):root,at(n));});ctx.setLineDash([7,4]);(d.links||[]).forEach(l=>line(find(l.from),find(l.to)));ctx.setLineDash([]);box(root.x,root.y,root.w,root.h,'中心テーマ',doc.topic,'#edf5fc',true);d.nodes.forEach(n=>{const p=at(n);box(p.x,p.y,p.w,p.h,n.id,n.text,noteColor(n.color),(n.shape||'circle')==='circle');});ctx.restore();}
  else if(id===3){box(450,130,500,110,'テーマ（柄）',doc.topic);ctx.beginPath();ctx.moveTo(700,240);ctx.lineTo(700,280);ctx.moveTo(50,280);ctx.lineTo(1340,280);ctx.stroke();const w=1290/d.count;d.teeth.slice(0,d.count).forEach((t,i)=>{ctx.beginPath();ctx.moveTo(50+(i+0.5)*w,280);ctx.lineTo(50+(i+0.5)*w,330);ctx.stroke();box(50+i*w,330,w-12,460,t.label||`歯${i+1}`,t.text);});}
  else if(id===15){ctx.beginPath();ctx.moveTo(50,460);ctx.lineTo(1100,460);ctx.stroke();box(1100,350,250,220,'問題・結果',d.problem);const bones=d.bones.slice(0,4);bones.forEach((b,i)=>{const x=65+Math.floor(i/2)*510,y=i%2?540:140;ctx.beginPath();ctx.moveTo(x+220,i%2?540:400);ctx.lineTo(x+280,460);ctx.stroke();box(x,y,470,260,b.label,b.factors.map(f=>`${f.text}［${DocumentModel.factorState(f.state)}］\n根拠：${f.evidence}`).join('\n'));});}
  else if(id===17){const positions=[[50,150],[50,510],[810,510],[810,150]];positions.forEach(([x,y],i)=>box(x,y,540,310,DocumentModel.columnLabels(17)[i],d.regions[i].join('\n')));box(610,350,180,250,'論点',doc.topic);}
  else if(id===12){const rects=d.scenarios.map((s,i)=>({x:s.x??60+(i%2)*1180,y:s.y??60+Math.floor(i/2)*560,w:1100,h:480}));fitWorld(rects,0,0);d.scenarios.forEach((s,i)=>{const {x,y}=rects[i];ctx.fillStyle='#243449';ctx.font='bold 24px "Yu Gothic",sans-serif';ctx.fillText('予想'+(i+1),x,y+30);ctx.strokeStyle='#597b9c';ctx.beginPath();ctx.moveTo(x+300,y+250);ctx.lineTo(x+350,y+250);ctx.moveTo(x+730,y+250);ctx.lineTo(x+780,y+250);ctx.stroke();box(x,y+55,300,400,'もし〜なら',s.condition);box(x+350,y+55,380,400,'〜になる',s.prediction,'#fff1a8',true);box(x+780,y+55,320,400,'なぜなら〜',s.reason+'\n類似例・根拠の出所：'+s.source);});ctx.restore();}
  else if([0,11].includes(id)){

   const pos=n=>({x:n.x+30,y:n.y+45,w:n.w||220,h:n.h||80});
   const bounds=[...d.nodes.map(pos),...d.groups.filter(g=>g.x!==undefined),...(d.freeArrows||[]).map(a=>({x:Math.min(a.x1,a.x2),y:Math.min(a.y1,a.y2),w:Math.abs(a.x2-a.x1),h:Math.abs(a.y2-a.y1)}))];fitWorld(bounds,1300,820);
   d.groups.forEach(g=>{const ns=d.nodes.filter(n=>n.group===g.id);let p=g;if(g.x===undefined){if(!ns.length)return;const ps=ns.map(pos),x=Math.min(...ps.map(p=>p.x))-20,y=Math.min(...ps.map(p=>p.y))-35;p={x,y,w:Math.max(...ps.map(p=>p.x+p.w))-x+20,h:Math.max(...ps.map(p=>p.y+p.h))-y+25};}ctx.fillStyle='#edf5fc';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='#597b9c';ctx.setLineDash([8,4]);ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.setLineDash([]);ctx.fillStyle='#243449';ctx.fillText(g.label.slice(0,40),p.x+8,p.y+24);});
   const line=a=>{const dx=a.x2-a.x1,dy=a.y2-a.y1;ctx.strokeStyle='#597b9c';ctx.setLineDash(a.style==='dashed'?[8,5]:[]);ctx.beginPath();ctx.moveTo(a.x1,a.y1);ctx.lineTo(a.x2,a.y2);ctx.stroke();ctx.setLineDash([]);const arrow=(x,y,t)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-15*Math.cos(t-.4),y-15*Math.sin(t-.4));ctx.moveTo(x,y);ctx.lineTo(x-15*Math.cos(t+.4),y-15*Math.sin(t+.4));ctx.stroke();};if(a.direction!=='none')arrow(a.x2,a.y2,Math.atan2(dy,dx));if(a.direction==='both')arrow(a.x1,a.y1,Math.atan2(-dy,-dx));ctx.fillStyle='#243449';ctx.fillText((a.label||a.kind).slice(0,30),(a.x1+a.x2)/2,(a.y1+a.y2)/2-12);};
   d.links.forEach(l=>{const a=pos(d.nodes.find(n=>n.id===l.from)),b=pos(d.nodes.find(n=>n.id===l.to)),x=a.x+a.w/2,y=a.y+a.h/2,dx=b.x+b.w/2-x,dy=b.y+b.h/2-y,t1=Math.min(.48,Math.min(a.w/2/(Math.abs(dx)||.001),a.h/2/(Math.abs(dy)||.001))),t2=Math.min(.48,Math.min(b.w/2/(Math.abs(dx)||.001),b.h/2/(Math.abs(dy)||.001)));line({...l,x1:x+dx*t1,y1:y+dy*t1,x2:x+dx*(1-t2),y2:y+dy*(1-t2)});});
   (d.freeArrows||[]).forEach(line);d.nodes.forEach(n=>{const p=pos(n);box(p.x,p.y,p.w,p.h,n.id,n.text);});ctx.restore();
  }
  else if(id===13){let previous;DocumentModel.columnLabels(13).forEach((label,i)=>{const x=50+(d.direction==='rtl'?4-i:i)*260,y=[470,300,150,300,470][i];if(previous){ctx.beginPath();ctx.moveTo(previous.x+120,previous.y-20);ctx.lineTo(x+120,y-20);ctx.stroke();}box(x,y,240,300,label,d.regions[i].join('\n'));previous={x,y};});}
  else if(id===16){ctx.strokeStyle='#597b9c';ctx.beginPath();ctx.moveTo(140,470);ctx.lineTo(1260,470);ctx.moveTo(700,150);ctx.lineTo(700,810);ctx.stroke();ctx.fillStyle='#243449';ctx.fillText(`${d.axes.y} / ${d.axes.top}`.slice(0,50),720,135);ctx.fillText(d.axes.bottom.slice(0,40),720,845);ctx.fillText(d.axes.left.slice(0,20),55,445);ctx.fillText(d.axes.right.slice(0,20),1130,445);ctx.fillText(d.axes.x.slice(0,40),1000,845);d.points.forEach((p,i)=>{const x=700+p.x*5,y=470-p.y*3;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.fillText(`${i+1}: ${p.text}`.slice(0,20),x+10,y-8);});}
  else if(id===18){for(let j=d.labels.length-1;j>=0;j--){const r=65+j*270/(d.labels.length-1);ctx.fillStyle=j%2?'#edf5fc':'#fff';ctx.strokeStyle='#597b9c';ctx.beginPath();ctx.arc(700,490,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#243449';ctx.fillText(`${j}: ${d.labels[j]}`.slice(0,28),710,490-r+26);ctx.fillText((d.regions[j][0]||'').slice(0,22),710,490-r+50);}ctx.fillText(('輪の意味：'+d.meaning).slice(0,65),70,125);}
  else if(id===19)columns(DocumentModel.columnLabels(19),d.regions.map(r=>r.map(c=>`${c.text}\n出所：${c.source}\n分類理由：${c.reason}`)));
  else if(id===4)columns(d.labels.slice(0,{Y:3,X:4,W:5}[d.variant]),d.regions);
  else if([7,8].includes(id))columns(DocumentModel.columnLabels(id),d.regions);
  else if([5,6].includes(id)){const rows=Math.min(d.rows.length,5),cols=Math.min(d.columns.length,5),w=1290/(cols+1),h=650/(rows+1);box(50,145,w-4,h-4,id===6?'情報源／項目':'対象／観点','');d.columns.slice(0,cols).forEach((v,c)=>box(50+(c+1)*w,145,w-4,h-4,v,''));for(let r=0;r<rows;r++){box(50,145+(r+1)*h,w-4,h-4,d.rows[r],'');for(let c=0;c<cols;c++)box(50+(c+1)*w,145+(r+1)*h,w-4,h-4,'',d.cells[r][c]);}}
  else if(id===14){[0,1,2].forEach(i=>{const w=650+i*310;box((W-w)/2,145+i*215,w,190,DocumentModel.columnLabels(14)[i],d.regions[i].join('\n'));});}
  else if(id===10){box(350,140,700,200,'主張・結論',d.claim);const count=Math.min(5,d.evidence.length),w=1290/Math.max(1,count);d.evidence.slice(0,5).forEach((e,i)=>{ctx.beginPath();ctx.moveTo(700,340);ctx.lineTo(50+(i+.5)*w,400);ctx.stroke();box(50+i*w,400,w-15,390,`根拠${i+1}`,e.text+'\n出典：'+e.source+'\nつながり：'+e.explanation,noteColor(e.color));});}
  else if(id===9){d.steps.slice(0,6).forEach((s,i)=>box(60+(i%3)*440,155+Math.floor(i/3)*300,400,260,`${s.id}`,s.text));ctx.fillStyle='#243449';ctx.fillText('接続：'+d.links.slice(0,6).map(l=>`${l.from} → ${l.to}`).join(' / '),60,815);}
  else box(65,150,1270,650,'考えたこと・メモ',doc.notes);
  ctx.fillStyle='#243449';ctx.font='20px "Yu Gothic",sans-serif';ctx.fillText('図は概要です。省略部分・非表示の観点・メモ・まとめを含む全文は次ページ以降に収録します。',48,910);
  // All text is paginated separately so no long entry is silently truncated.
  page(name+'：記入内容（全文）');ctx.font='23px "Yu Gothic",sans-serif';const lines=wrap(ctx,fullText,1290);let y=100;
  for(const line of lines){if(y>900){page(name+'：記入内容（続き）');ctx.font='23px "Yu Gothic",sans-serif';y=100;}ctx.fillText(line,50,y);y+=32;}
  return pages;
 }
 async function create(doc,name,format){
  if(!['pdf','pptx'].includes(format))throw Error('保存形式を選んでください。');
  await document.fonts.ready;
  const pages=render(doc,name,DocumentModel.text(doc,name),undefined,{singlePageData:format==='pdf'&&doc.toolId===6});
  return format==='pdf'?pdf(pages.map(c=>dataBytes(c.toDataURL('image/jpeg',0.94)))):pptx(pages.map(c=>dataBytes(c.toDataURL('image/png'))));
 }
 return {create,render,wrap,pdf,pptx,zip,crc32};
})();
if(typeof module!=='undefined')module.exports=ThinkingExport;
