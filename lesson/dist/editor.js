/* Classroom v1: source-preserving, percentage-based canvas editing. */
(() => {
  const copy = x => JSON.parse(JSON.stringify(x));
  const canvas = copy(L.canvas || {version:1,slides:{}});
  let source = L.sourceMarkdown, hash = L.sourceHash, dirty = false, editing = false, selected = null;
  let sourceFields=copy(L.sourceFields||{}), textEdits={}, savedSlides=copy(L.slides), contentDraft=false, saving=false, selectedSourceKey='points';
  const fonts = {sans:'"Microsoft YaHei","Segoe UI",sans-serif',serif:'"SimSun",serif',mono:'Consolas,monospace'};
  const cfg = (id=L.slides[page].id) => canvas.slides[id] ||= {elements:[],styles:{}};
  const entries = () => Object.values(canvas.slides).flatMap(c=>c.elements||[]);
  const clean = () => JSON.parse(JSON.stringify(canvas,(key,value)=>key.startsWith('_')?undefined:value));
  const status = text => { $('#saveState').textContent=text; };
  const changed = () => {dirty=true;status('尚未保存到 Markdown');};
  function styleNode(node,s={}){if(!node)return; if(s.fontSize)node.style.fontSize=s.fontSize+'px';if(s.fontFamily)node.style.fontFamily=fonts[s.fontFamily]||JSON.stringify(s.fontFamily);if(s.color)node.style.color=s.color;if('bold'in s)node.style.fontWeight=s.bold?'700':'400';if(s.align)node.style.textAlign=s.align;const slide=node.closest('.slide,.print-slide');if(slide){if('dx'in s||'dy'in s){node.style.position='relative';node.style.left=(s.dx||0)*(slide.clientWidth||1209.45)/100+'px';node.style.top=(s.dy||0)*(slide.clientHeight||680.31)/100+'px';}if(s.w)node.style.width=s.w*(slide.clientWidth||1209.45)/100+'px';if(s.h)node.style.minHeight=s.h*(slide.clientHeight||680.31)/100+'px';}}
  function widgetHTML(el,printing){
    const p=el.props||{},label=`<div class="widget-label">${esc(p.label||'互动演示')}</div>`;
    if(el.widget==='counter'||el.widget==='range')return label+`<output class="widget-value">${esc(p.value??0)}</output>`+(printing?`<p>范围 ${esc(p.min??0)}—${esc(p.max??100)} · 步长 ${esc(p.step??1)}</p>`:el.widget==='range'?`<input aria-label="${esc(p.label||'数值')}" type="range" min="${esc(p.min??0)}" max="${esc(p.max??100)}" step="${esc(p.step??1)}" value="${esc(p.value??0)}">`:'<button data-count="-1">−</button> <button data-count="1">＋</button> <button data-count="0">重置</button>');
    if(el.widget==='tabs')return label+(printing?(p.items||[]).map(i=>`<p><b>${esc(i.label)}</b><br>${esc(i.text)}</p>`).join(''):`<div class="widget-tabs">${(p.items||[]).map((i,n)=>`<button data-tab="${n}" aria-selected="${n===0}">${esc(i.label)}</button>`).join('')}</div><div class="widget-body">${esc(p.items?.[0]?.text||'')}</div>`);
    return label+(printing?`<p>${esc(p.text||'')}</p>`:`<button data-reveal>点击展开</button><div class="widget-body" hidden>${esc(p.text||'')}</div>`);
  }
  function elementHTML(el,printing){
    let body='';
    if(el.type==='image')body=`<img draggable="false" src="${esc(el._src||el.src)}" alt="${esc(el.alt||'课程图片')}">`;
    if(el.type==='text')body=`<div class="text-content">${previousInlineMD(el.text||'')}</div>`;
    if(el.type==='widget')body=widgetHTML(el,printing);
    if(el.type==='html')body=printing?`<div>${esc(el.printText)}</div>`:`<iframe title="${esc(el.alt||'互动 HTML')}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${esc('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">'+(el._html||''))}"></iframe>`;
    return `<div class="canvas-element ${el.type}" data-element="${el.id}" data-label="${esc(el.fixed?'固定图片':el.alt||el.widget||'文本')}" style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%">${body}<span class="resize-handle" aria-hidden="true"></span></div>`;
  }
  const baseSlideHTML=slideHTML;
  slideHTML=function(s,i,printing=false,mode='student'){
    const own=cfg(s.id).elements||[];
    const fixed=entries().filter(e=>e.fixed&&!own.includes(e));
    return baseSlideHTML(s,i,printing,mode)+`<div class="canvas-layer" data-slide-id="${s.id}">${[...own,...fixed].map(e=>elementHTML(e,printing)).join('')}</div>`;
  };
  function apply(root,sid){
    const c=cfg(sid);const styles=c.styles||{};
    styleNode(root.querySelector('h1'),styles.title);
    styleNode(root.querySelector('.class-question'),styles.question);
    root.querySelectorAll('.points>li').forEach((n,i)=>{styleNode(n,styles.points);styleNode(n,styles['point-'+i]);n.dataset.fontTarget='point-'+i;});
    for(const el of entries()){
      const n=root.querySelector(`[data-element="${el.id}"]`);if(!n)continue;styleNode(n,el.style);
      if((c.elements||[]).includes(el)&&el.point!==undefined)root.querySelectorAll('.points>li')[el.point]?.setAttribute('hidden','');
      n.classList.toggle('edit-selected',editing&&selected===el);
      const img=n.querySelector('img');if(img)img.onerror=()=>{n.classList.add('image-error');img.alt='图片加载失败：'+(el.alt||el.src);};
      n.oncontextmenu=ev=>{if(el.type!=='image'||document.fullscreenElement)return;ev.preventDefault();setEditing(true);select(el);el.fixed=!el.fixed;changed();redraw();};
      n.onpointerdown=ev=>beginDrag(ev,el,n);
      if(el.type==='text')n.ondblclick=()=>{if(editing){$('#selectionGroup').scrollIntoView({block:'start'});$('#elementContent').focus();}};
      if(el.type==='widget'){
        const p=el.props||{},out=n.querySelector('output');
        n.querySelector('input')?.addEventListener('input',ev=>{out.textContent=ev.target.value;});
        n.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{const d=+b.dataset.count;out.textContent=d?Math.max(p.min??0,Math.min(p.max??100,+(+out.textContent+d*(p.step??1)).toFixed(6))):p.value??0;});
        n.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{n.querySelector('.widget-body').textContent=p.items[+b.dataset.tab].text;n.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x===b));});
        n.querySelector('[data-reveal]')?.addEventListener('click',()=>{const b=n.querySelector('.widget-body');b.hidden=!b.hidden;});
      }
    }
    root.querySelectorAll('.lesson-image').forEach(img=>{
      const convert=()=>{const li=img.closest('li'),index=[...root.querySelectorAll('.points>li')].indexOf(li);if(index<0)return;const rect=root.getBoundingClientRect(),r=img.getBoundingClientRect();const el={id:'image-'+safename(sid)+'-'+index,type:'image',point:index,src:img.getAttribute('src'),alt:img.alt,x:Math.max(0,(r.x-rect.x)/rect.width*100),y:Math.max(0,(r.y-rect.y)/rect.height*100),w:Math.min(90,r.width/rect.width*100),h:Math.min(70,r.height/rect.height*100)};el.x=Math.min(el.x,100-el.w);el.y=Math.min(el.y,100-el.h);cfg(sid).elements||=[];cfg(sid).elements.push(el);selected=el;changed();redraw();select(el);return el;};
      img.onclick=()=>{if(editing)convert();};img.oncontextmenu=e=>{if(document.fullscreenElement)return;e.preventDefault();setEditing(true);const el=convert();if(el){el.fixed=true;redraw();select(el);}};
    });
    const bindText=(node,key)=>{if(!node)return;node.dataset.sourceText=key;bindSourceDrag(node,key);node.onclick=e=>{if(!editing||saving||e.target.closest('img'))return;e.stopPropagation();if(!commitContent())return;$('#fontTarget').value=key;select(null);$('#selectionGroup').scrollIntoView({block:'start'});};node.ondblclick=()=>{if(editing){$('#elementContent').focus();}};};
    bindText(root.querySelector('h1'),'title');
    bindText(root.querySelector('.class-question'),'question');
    root.querySelectorAll('.points>li').forEach((n,i)=>bindText(n,'point-'+i));
    renderLessonMath(root);
  }

  function bindSourceDrag(node,key){
    const handle=document.createElement('span');handle.className='source-resize';node.append(handle);
    node.addEventListener('pointerdown',ev=>{
      if(!editing||saving||ev.button!==0||ev.target.closest('img'))return;
      if(!commitContent())return;ev.preventDefault();ev.stopPropagation();$('#fontTarget').value=key;select(null);
      const root=node.closest('.slide'),box=root.getBoundingClientRect(),initial=node.getBoundingClientRect();cfg().styles||={};const st=cfg().styles[key]||={},old={...st};const px=ev.clientX,py=ev.clientY,resize=ev.target.classList.contains('source-resize');node.setPointerCapture(ev.pointerId);let moved=false;
      const move=e=>{const dx=(e.clientX-px)/box.width*100,dy=(e.clientY-py)/box.height*100;if(Math.abs(dx)+Math.abs(dy)<.15)return;moved=true;if(resize){st.w=Math.max(2,Math.min(100,initial.width/box.width*100+dx));st.h=Math.max(2,Math.min(100,initial.height/box.height*100+dy));}else{st.dx=Math.max(-100,Math.min(100,(old.dx||0)+dx));st.dy=Math.max(-100,Math.min(100,(old.dy||0)+dy));}styleNode(node,st);};
      const end=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);if(moved)changed();};node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
    });
  }
  function safename(id){return id.replace(/[^a-z0-9-]/g,'').slice(0,35);}
  const baseRender=render;
  render=function(){baseRender();if(selected&&!document.querySelector('#deck .active [data-element="'+selected.id+'"]'))selected=null;apply($('#deck .active'),L.slides[page].id);if(editing)select(selected);};
  const basePrint=preparePrint;
  preparePrint=function(...args){window.__printReady=false;basePrint(...args);document.querySelectorAll('.print-slide').forEach(n=>{const sid=n.querySelector('.canvas-layer')?.dataset.slideId;const s=L.slides.find(x=>x.id===sid);if(s)apply(n,s.id);renderLessonMath(n);});window.__printReady=true;};
  function redraw(){render();}
  function sourceKey(){return selected?null:$('#fontTarget').value;}
  function targetValue(key){const id=L.slides[page].id;return textEdits[id]?.[key]??sourceFields[id]?.[key]?.value??'';}
  function sourceNode(key){const root=$('#deck .active');if(key==='title')return root.querySelector('h1');if(key==='question')return root.querySelector('.class-question');return root.querySelectorAll('.points>li')[Number(key?.slice(6))];}
  function refreshTargets(){
    const select=$('#fontTarget'),old=select.value,fields=sourceFields[L.slides[page].id]||{};
    select.innerHTML='<option value="points">整页正文样式</option>'+Object.keys(fields).map(key=>`<option value="${key}">${key==='title'?'原文 · 页标题':key==='question'?'原文 · 课堂问题':'原文 · 第 '+(Number(key.slice(6))+1)+' 条正文'}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===old)?old:'points';
  }
  function select(el){
    selected=el;refreshTargets();selectedSourceKey=$('#fontTarget').value;const key=sourceKey(),original=!el&&key!=='points';
    $('#selection').textContent=el?(el.type==='text'?'独立文字框':el.alt||el.widget||el.id):original?$('#fontTarget').selectedOptions[0].textContent:'整页正文样式';
    $('#textOverflow').hidden=true;$('#elementFields').hidden=!el;$('#removeElement').hidden=!el;$('#fitText').hidden=el?.type!=='text';$('#fontTarget').disabled=!!el;
    for(const k of ['x','y','w','h'])$('#pos-'+k).value=el?Math.round(el[k]*100)/100:'';
    $('#fixedImage').hidden=el?.type!=='image';$('#isFixed').checked=!!el?.fixed;
    $('#contentEditor').hidden=el?el.type==='image':!original;
    $('#elementContent').value=el?(el.type==='widget'?JSON.stringify(el.props||{},null,2):el.type==='html'?el.printText||'':el.text||''):targetValue(key).replace(/<br>/g,'\n');
    contentDraft=false;
    $('#applyContent').hidden=el?.type!=='widget';
    $('#contentLabel').textContent=el?.type==='widget'?'互动参数（JSON）':el?.type==='html'?'打印说明':'文字内容';
    $('#textHelp').textContent=original?(key==='title'?'修改页标题，页编号保持不变。':key==='question'?'直接修改 Markdown 中的课堂问题。':'直接修改 Markdown 对应要点；支持换行、 **加粗**、`代码`、$公式$。'):el?.type==='text'?'独立文字框，可拖动和缩放。支持换行、**加粗**、`代码`、$公式$。':'';
    const st=el?.style||{...(key?.startsWith('point-')?cfg().styles?.points:{}),...cfg().styles?.[key]};
    const node=el?document.querySelector('#deck .active [data-element="'+el.id+'"]'):key==='points'?$('#deck .active .points>li'):sourceNode(key);
    const computed=node?getComputedStyle(node):null;
    $('#fontSize').value=st.fontSize||Math.round(parseFloat(computed?.fontSize)||22);$('#fontColor').value=st.color||'#172633';if(st.fontFamily&&![...$('#fontFamily').options].some(o=>o.value===st.fontFamily))$('#fontFamily').add(new Option(st.fontFamily,st.fontFamily));$('#fontFamily').value=st.fontFamily||'sans';$('#fontBold').checked=st.bold??(Number(computed?.fontWeight)>=600);$('#fontAlign').value=st.align||'left';
    document.querySelectorAll('#deck [data-element]').forEach(n=>n.classList.toggle('edit-selected',editing&&n.dataset.element===el?.id));
    document.querySelectorAll('#deck [data-source-text]').forEach(n=>n.classList.toggle('source-selected',editing&&!el&&n.dataset.sourceText===key));
    checkTextOverflow(el);
  }
  function normalizeSource(key,value){
    value=value.replace(/\r\n?/g,'\n').trim();if(key!=='question')value=value.replace(/\r?\n/g,'<br>');
    if(key.startsWith('point-')&&value.startsWith('- ')&&!sourceFields[L.slides[page].id][key].prefix)throw Error('段落内容无需添加列表符号。');
    if(!value||value.length>20000)throw Error('原文不能为空，且不能超过 20000 字。');
    if(value.split('\n').some(row=>/^(```|#{1,3} )/.test(row)))throw Error('请只修改文字，不要插入页标题、小节标题或代码围栏。');
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw Error('文字中包含无效控制字符。');
    return value;
  }
  function previewSource(key,value){
    const slide=L.slides[page],node=sourceNode(key);
    if(key==='title'){slide.title=value;if(node)node.textContent=value;document.title=value+' · '+L.title;}
    else if(key==='question'){slide.question=value;if(node)node.innerHTML=inlineMD(value);}
    else{const i=Number(key.slice(6)),before=sourceFields[slide.id][key].value;
      const rawImages=[...before.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)],shownImages=[...savedSlides.find(x=>x.id===slide.id).points[i].matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
      const display=value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(all,alt,src)=>{const n=rawImages.findIndex(x=>x[2]===src);return n>=0&&shownImages[n]?'!['+alt+']('+shownImages[n][2]+')':all;});
      slide.points[i]=display;if(node)node.innerHTML=inlineMD(display);
    }
    if(node){renderLessonMath(node);if(!node.querySelector('.source-resize')){const handle=document.createElement('span');handle.className='source-resize';node.append(handle);}}refreshPresenter();
  }
  function checkTextOverflow(el){const node=el?.type==='text'?document.querySelector('#deck .active [data-element="'+el.id+'"]'):null,body=node?.querySelector('.text-content');const overflow=!!body&&body.scrollHeight+16>node.clientHeight+1;$('#textOverflow').hidden=!overflow;node?.classList.toggle('text-overflow',overflow);}
  function fitText(el,shrink=false){
    if(el?.type!=='text')return;
    const node=document.querySelector('#deck .active [data-element="'+el.id+'"]'),body=node?.querySelector('.text-content');if(!body)return;
    const available=100-el.y,needed=Math.ceil((body.scrollHeight+18)/node.closest('.slide').offsetHeight*10000)/100;
    const height=Math.min(available,Math.max(2,shrink?needed:Math.max(el.h,needed)));
    if(height!==el.h){el.h=height;node.style.height=height+'%';$('#pos-h').value=height;}
    node.classList.toggle('text-overflow',needed>available);
    checkTextOverflow(el);
  }
  function commitContent(){
    if(!contentDraft)return true;
    if(selected&& !['text','html'].includes(selected.type))return true;
    try{
      let value=$('#elementContent').value;if(value.length>20000)throw Error('文字不能超过 20000 字。');
      if(selected){selected[selected.type==='html'?'printText':'text']=value;const node=document.querySelector('#deck .active [data-element="'+selected.id+'"] .text-content');if(node){node.innerHTML=previousInlineMD(value);renderLessonMath(node);fitText(selected);}}
      else{const key=sourceKey(),id=L.slides[page].id;value=normalizeSource(key,value);textEdits[id]||={};textEdits[id][key]=value;previewSource(key,value);}
      contentDraft=false;changed();return true;
    }catch(e){status(e.message);return false;}
  }
  function scaleEditor(){if(editing){const slide=$('#deck .active');if(slide)document.body.style.setProperty('--edit-scale',Math.min(1,($('#stage').clientWidth-300)/slide.offsetWidth));}}
  window.addEventListener('resize',scaleEditor);
  function setEditing(value){if(saving)return;if(!value&&!commitContent())return;editing=value;document.body.classList.toggle('editing',value);$('#editorPanel').hidden=!value;$('#editBtn').textContent=value?'完成编辑':'编辑';$('#editBtn').setAttribute('aria-pressed',value);if(value){$('#classMenu').hidden=true;scaleEditor();select(selected);} }
  function beginDrag(ev,el,node){if(!editing||saving||ev.button!==0)return;if(!commitContent())return;ev.preventDefault();ev.stopPropagation();select(el);const box=node.closest('.slide').getBoundingClientRect(),start={x:ev.clientX,y:ev.clientY,...el},resize=ev.target.classList.contains('resize-handle');node.setPointerCapture(ev.pointerId);const px=ev.clientX,py=ev.clientY;let moved=false;const update=e=>{const dx=(e.clientX-px)/box.width*100,dy=(e.clientY-py)/box.height*100;if(resize){el.w=Math.max(2,Math.min(100-el.x,start.w+dx));el.h=Math.max(2,Math.min(100-el.y,start.h+dy));}else{el.x=Math.max(0,Math.min(100-el.w,start.x+dx));el.y=Math.max(0,Math.min(100-el.h,start.y+dy));}for(const k of ['x','y','w','h'])el[k]=Math.round(el[k]*100)/100;Object.assign(node.style,{left:el.x+'%',top:el.y+'%',width:el.w+'%',height:el.h+'%'});moved=true;};const finish=()=>{node.removeEventListener('pointermove',update);node.removeEventListener('pointerup',finish);node.removeEventListener('pointercancel',finish);if(moved){fitText(el);changed();}select(el);};node.addEventListener('pointermove',update);node.addEventListener('pointerup',finish);node.addEventListener('pointercancel',finish);}
  const nav=$('.toolbar nav');
  for(const [id,label] of [['editBtn','编辑'],['settingsBtn','设置'],['menuBtn','菜单']]){const b=document.createElement('button');b.id=id;b.textContent=label;b.className='fs-hide';nav.insertBefore(b,$('#fullBtn'));}
  document.body.insertAdjacentHTML('beforeend',`<div id="classMenu" hidden></div><aside id="editorPanel" hidden aria-label="编辑工具"><h3>布局与样式</h3><small>点击原文或文字框编辑内容；图片和独立文字框可拖动，右下角可调整大小。</small><div class="editor-row"><button id="saveCanvas" class="primary">保存到 MD</button><button id="downloadMD">下载 MD</button><button id="undoCanvas">撤销全部未保存</button></div><div id="saveState" role="status">已载入 Markdown 布局</div><fieldset><legend>插入</legend><label>图片网址或课程内路径<input id="imageSource" placeholder="https://… 或 assets/image.png"></label><div class="editor-row"><button id="addImage">插入图片</button><button id="chooseImage">选择本机图片</button><input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden></div><div class="editor-row"><select id="widgetType" aria-label="控件类型"><option value="counter">计数器</option><option value="range">滑块</option><option value="tabs">选项卡</option><option value="reveal">点击展开</option></select><button id="addWidget">插入互动控件</button><button id="addText">插入文字</button></div><small>自定义 HTML 在 Markdown 中使用 type: html，并填写 src 与 printText。</small></fieldset><fieldset id="selectionGroup"><legend id="selection">当前页文字</legend><div id="elementFields" hidden><div class="editor-grid">${['x','y','w','h'].map((k,i)=>`<label>${['左侧 %','顶部 %','宽度 %','高度 %'][i]}<input id="pos-${k}" type="number" min="0" max="100" step="0.1"></label>`).join('')}</div><label id="fixedImage"><input id="isFixed" type="checkbox">固定显示在每一页（也可右键切换）</label></div><div id="contentEditor" hidden><label id="contentLabel">文字内容</label><textarea id="elementContent" aria-label="文字或控件内容"></textarea><small id="textHelp"></small><small id="textOverflow" hidden>文字超过画布底部，请上移、加宽文字框或减小字号。</small><button id="applyContent">应用内容</button></div><label>文字目标<select id="fontTarget"><option value="points">本页正文</option><option value="title">本页标题</option></select></label><div class="editor-grid"><label>字号<input id="fontSize" type="number" min="10" max="96" value="22"></label><label>颜色<input id="fontColor" type="color" value="#172633"></label></div><div class="editor-row"><select id="fontFamily" aria-label="字体"><option value="sans">黑体 / 无衬线</option><option value="serif">宋体 / 衬线</option><option value="mono">等宽</option></select><select id="fontAlign" aria-label="对齐"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select><label><input id="fontBold" type="checkbox">加粗</label></div><button id="applyFont">应用字体</button> <button id="fitText" hidden>适应文字高度</button> <button id="removeElement" hidden>删除控件</button></fieldset></aside><dialog id="settingsDialog"><div class="dialog-head"><h2>设置</h2><button id="closeSettings" aria-label="关闭设置">×</button></div><p>PDF 隐藏署名仅保存在当前浏览器，不写入课程 Markdown。留空即可匿名导出。这是署名标记，不是证书数字签名。</p><label>署名<input id="signatureName" maxlength="120" autocomplete="off"></label><label>联系信息（可选）<input id="signatureContact" maxlength="200" autocomplete="off"></label><label><input id="signatureEnabled" type="checkbox">启用 PDF 隐藏署名</label><button id="saveSettings" class="primary">保存设置</button> <button id="clearSettings">清空签名</button><p id="settingsStatus" role="status"></p></dialog>`);
  const fontGroup=document.createElement('fieldset');fontGroup.innerHTML='<legend>字体与排版</legend>';const fontStart=$('#fontTarget').closest('label');for(let n=fontStart;n;){const next=n.nextElementSibling;fontGroup.append(n);n=next;}$('#selectionGroup').append(fontGroup);
  const localFonts=document.createElement('button');localFonts.textContent='添加本机字体';fontGroup.append(localFonts);localFonts.onclick=async()=>{try{if(window.queryLocalFonts){const list=await window.queryLocalFonts();for(const name of [...new Set(list.map(f=>f.family))].sort())if(![...$('#fontFamily').options].some(o=>o.value===name))$('#fontFamily').add(new Option(name,name));status('本机字体已加入字体列表');}else{const name=prompt('输入已安装字体的准确名称，例如：Microsoft YaHei');if(name&&/^[\w \-,\u4e00-\u9fff]{1,120}$/.test(name)){$('#fontFamily').add(new Option(name,name));$('#fontFamily').value=name;status('已加入字体名称，点击应用字体；未安装时浏览器会使用替代字体。');}}}catch(e){status('未能读取本机字体：'+e.message);}};
  const insertion=$('#editorPanel fieldset'),selection=$('#selectionGroup');insertion.before(selection);const inspectorScroll=document.createElement('div');inspectorScroll.id='editorScroll';$('#editorPanel').append(inspectorScroll);inspectorScroll.append(selection,insertion);
  for(const id of ['teacherBtn','pdfBtn','timerBtn']){$('#classMenu').append($('#'+id));$('#'+id).hidden=false;}
  $('.brand').classList.add('fs-hide');$('#menuBtn').setAttribute('aria-expanded','false');
  $('#menuBtn').onclick=()=>{const menu=$('#classMenu');menu.hidden=!menu.hidden;$('#menuBtn').setAttribute('aria-expanded',!menu.hidden);};
  $('#classMenu').addEventListener('click',()=>{$('#classMenu').hidden=true;$('#menuBtn').setAttribute('aria-expanded','false');});
  document.addEventListener('click',e=>{if(!e.target.closest('#classMenu,#menuBtn'))$('#classMenu').hidden=true;});
  $('#editBtn').onclick=()=>setEditing(!editing);
  document.addEventListener('fullscreenchange',()=>{const full=!!document.fullscreenElement;document.body.classList.toggle('presenting',full);$('#classMenu').hidden=true;for(const n of document.querySelectorAll('.fs-hide'))n.inert=full;if(full){$('#settingsDialog').close();$('#pdf').close();} });
  $('#fullBtn').addEventListener('click',()=>{if(editing)setEditing(false);});
  function add(el){if(!commitContent())return;el.id='el-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5);Object.assign(el,{x:42,y:30,w:36,h:35});if(el.type==='text'){const slide=$('#deck .active'),rect=slide.getBoundingClientRect(),body=slide.querySelector('.layout').getBoundingClientRect();Object.assign(el,{x:8,y:Math.min(82,Math.max(28,(body.bottom-rect.top)/rect.height*100+4)),w:60,h:12});}cfg().elements||=[];cfg().elements.push(el);setEditing(true);selected=el;changed();redraw();select(el);$('#selectionGroup').scrollIntoView({block:'start'});if(el.type==='text'){$('#elementContent').focus();$('#elementContent').select();}}
  async function api(route,data){const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok){let message;try{message=(await r.json()).error;}catch{message='请求失败 '+r.status;}throw Error(message);}return r;}
  $('#addImage').onclick=async()=>{try{const src=$('#imageSource').value.trim();if(!src)throw Error('请填写图片网址或相对路径。');if(/^https?:\/\//.test(src)){const u=new URL(src);if(u.username||u.password)throw Error('网址不能包含账号密码。');add({type:'image',src,alt:'图片'});}else{if(location.protocol==='file:')throw Error('离线模式请使用“选择本机图片”；课程内路径需要从启动课件打开。');const data=await (await api('/api/media',{src,hash})).json();add({type:'image',src,_src:data.src,alt:'图片'});}}catch(e){status(e.message);}};
  $('#chooseImage').onclick=()=>$('#imageFile').click();
  $('#imageFile').onchange=async ev=>{try{const file=ev.target.files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('单张图片请控制在 8 MB 内。');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});let src=data;if(location.protocol!=='file:')src=(await (await api('/api/upload',{name:file.name,data,hash})).json()).src;add({type:'image',src,_src:data,alt:file.name.replace(/\.[^.]+$/,'')});}catch(e){status(e.message);}finally{ev.target.value='';}};
  $('#addWidget').onclick=()=>{const widget=$('#widgetType').value;const props=widget==='tabs'?{label:'比较观察',items:[{label:'情况一',text:'第一种情况的说明'},{label:'情况二',text:'第二种情况的说明'}]}:widget==='reveal'?{label:'观察提示',text:'点击后显示的补充信息'}:{label:'调整数值，观察变化',min:0,max:100,step:1,value:20};add({type:'widget',widget,props});};
  $('#addText').onclick=()=>{const node=$('#deck .active .points>li');add({type:'text',text:'在这里填写文字',style:{fontSize:Math.round(node?parseFloat(getComputedStyle(node).fontSize):22)}});};
  for(const key of ['x','y','w','h'])$('#pos-'+key).onchange=()=>{if(!selected)return;let value=Number($('#pos-'+key).value);if(!Number.isFinite(value))return;selected[key]=Math.max(key==='w'||key==='h'?2:0,Math.min(100,value));selected.x=Math.min(selected.x,100-selected.w);selected.y=Math.min(selected.y,100-selected.h);changed();redraw();select(selected);};
  $('#isFixed').onchange=()=>{if(selected?.type==='image'){selected.fixed=$('#isFixed').checked;changed();redraw();}};
  $('#fontTarget').onchange=()=>{const next=$('#fontTarget').value;$('#fontTarget').value=selectedSourceKey;if(!commitContent())return;$('#fontTarget').value=next;select(null);};
  $('#elementContent').addEventListener('input',()=>{contentDraft=true;if(selected?.type==='widget'){changed();return;}commitContent();});
  $('#fitText').onclick=()=>{if(commitContent()){fitText(selected,true);changed();}};
  $('#applyFont').onclick=()=>{if(!commitContent())return;const size=Number($('#fontSize').value);if(!Number.isFinite(size)||size<10||size>96){status('字号应为 10—96。');return;}const value={fontSize:size,fontFamily:$('#fontFamily').value,color:$('#fontColor').value,bold:$('#fontBold').checked,align:$('#fontAlign').value};if(selected)selected.style=value;else{cfg().styles||={};cfg().styles[$('#fontTarget').value]={...cfg().styles[$('#fontTarget').value],...value};}changed();redraw();fitText(selected);};
  $('#applyContent').onclick=()=>{if(!selected||selected.type==='text'||selected.type==='html'){commitContent();return;}try{if(selected.type==='widget'){const value=JSON.parse($('#elementContent').value);if(!value||Array.isArray(value)||typeof value!=='object')throw Error('参数必须是 JSON 对象。');if(Object.keys(value).some(k=>!['label','min','max','step','value','items','text'].includes(k)))throw Error('包含未知参数。');for(const k of ['label','text'])if(k in value&&typeof value[k]!=='string')throw Error(k+' 必须是文字。');if(selected.widget==='tabs'&&(!Array.isArray(value.items)||!value.items.length||value.items.length>12||value.items.some(i=>!i||typeof i.label!=='string'||typeof i.text!=='string')))throw Error('选项卡需要 1—12 项 label/text。');if(['range','counter'].includes(selected.widget)){const v={min:0,max:100,step:1,value:0,...value};for(const k of ['min','max','step','value'])if(typeof v[k]!=='number'||!Number.isFinite(v[k])||Math.abs(v[k])>100000)throw Error('数值参数无效。');if(v.step<.001||v.min>=v.max||v.value<v.min||v.value>v.max)throw Error('初始值、步长或范围无效。');}selected.props=value;contentDraft=false;}else selected[selected.type==='html'?'printText':'text']=$('#elementContent').value;changed();redraw();}catch(e){status(e.message);}};
  $('#removeElement').onclick=()=>{if(!selected)return;for(const c of Object.values(canvas.slides))c.elements=(c.elements||[]).filter(x=>x!==selected);selected=null;changed();redraw();select(null);};
  function editedSource(){const rows=source.split('\n'),changes=[];for(const [sid,fields] of Object.entries(textEdits))for(const [key,value] of Object.entries(fields)){const f=sourceFields[sid][key];if(value!==f.value)changes.push({...f,value:normalizeSource(key,value)});}changes.sort((a,b)=>b.start-a.start).forEach(f=>rows.splice(f.start,f.end-f.start,...(f.prefix+f.value+f.suffix).split('\n')));return rows.join('\n');}
  function markdown(){const edited=editedSource();const block='```classroom\n'+JSON.stringify(clean(),null,2)+'\n```';const pattern=/^```classroom\s*\n[\s\S]*?^```\s*$/m;return pattern.test(edited)?edited.replace(pattern,()=>block):edited.trimEnd()+'\n\n'+block+'\n';}
  function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('#downloadMD').onclick=()=>{if(!commitContent())return;download(markdown(),'课程.md');status('已下载 Markdown；替换课程.md 后重新生成。');};
  $('#saveCanvas').onclick=async()=>{
    if(!commitContent())return;
    if(selected?.type==='widget'&&contentDraft){$('#applyContent').click();if(contentDraft)return;}
    if(location.protocol==='file:'){$('#downloadMD').click();return;}
    const panel=$('#editorPanel'),button=$('#saveCanvas');saving=true;panel.inert=true;button.disabled=true;
    try{const health=await(await fetch('/api/health')).json();if(health.version<5)throw Error('请重启本地课件服务，以启用原文保存功能。');const data=await(await api('/api/save',{canvas:clean(),textEdits,hash})).json();source=data.source;hash=data.hash;sourceFields=data.sourceFields;textEdits={};dirty=false;saved=copy(canvas);savedSlides=copy(L.slides);status('已保存课程.md 并重新生成课件');}
    catch(e){status(e.message);}finally{saving=false;panel.inert=false;button.disabled=false;}
  };
  let saved=copy(canvas);
  $('#undoCanvas').onclick=()=>{canvas.slides=copy(saved.slides);L.slides=copy(savedSlides);textEdits={};contentDraft=false;selected=null;dirty=false;redraw();select(null);status('已恢复上次保存的文字与布局');};
  window.addEventListener('beforeunload',e=>{if(dirty||contentDraft){e.preventDefault();e.returnValue='';}});
  const settingsKey='classroom-pdf-signature:'+location.pathname;
  let signature={enabled:false,name:'',contact:''};try{Object.assign(signature,JSON.parse(localStorage.getItem(settingsKey)||'{}'));}catch{}
  function fillSettings(){$('#signatureName').value=signature.name;$('#signatureContact').value=signature.contact;$('#signatureEnabled').checked=signature.enabled;}
  function saveSignature(){signature={enabled:$('#signatureEnabled').checked,name:$('#signatureName').value.trim(),contact:$('#signatureContact').value.trim()};try{localStorage.setItem(settingsKey,JSON.stringify(signature));$('#settingsStatus').textContent='设置已保存到当前浏览器';}catch{$('#settingsStatus').textContent='浏览器禁止存储；设置仅本次有效。';}$('.copyright-note').textContent=signature.enabled?'使用设置中的 PDF 隐藏署名。':'匿名导出：未启用个人署名。';}
  $('#settingsBtn').onclick=()=>{fillSettings();$('#settingsDialog').showModal();};$('#closeSettings').onclick=()=>$('#settingsDialog').close();$('#saveSettings').onclick=saveSignature;$('#clearSettings').onclick=()=>{signature={enabled:false,name:'',contact:''};fillSettings();saveSignature();};
  $('.copyright-note').textContent=signature.enabled?'使用设置中的 PDF 隐藏署名。':'匿名导出：未启用个人署名。';
  $('#exportBtn').addEventListener('click',async e=>{e.stopImmediatePropagation();const state=$('#exportStatus'),b=$('#exportBtn');if(dirty){state.textContent='请先保存布局到 MD，再导出 PDF。';return;}if(location.protocol==='file:'){state.textContent='请用“启动课件.cmd”打开后导出 PDF。';return;}b.disabled=true;try{const pages=parseExportPages($('#exportPages').value);state.textContent='正在生成 PDF…';const r=await api('/api/export',{mode:$('#exportMode').value,range:$('#exportRange').value,pages,signature,hash});const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='课程_'+$('#exportMode').value+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);state.textContent='PDF 已导出。';}catch(err){state.textContent=err.message;}finally{b.disabled=false;}},true);
  // Prevent stage shortcuts from consuming editor form keys or interactive widgets.
  window.addEventListener('keydown',e=>{if(e.target.closest('#editorPanel,#settingsDialog,.canvas-element')||document.fullscreenElement&&['j','t','e','p'].includes(e.key.toLowerCase()))e.stopImmediatePropagation();},true);
  const goWithText=go;go=function(n){if(saving||!commitContent())return;goWithText(n);};window.goTo=go;
  render();if(params.has('print'))preparePrint(params.get('range')||'core',params.get('mode')||'student');
})();
