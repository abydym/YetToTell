/* Teaching presentation: deliberate stepping, no exposed presenter controls. */
const oldWidget=widget,oldSlideHTML=slideHTML;
let buildStep=0,modelStep=0,playHandle=null;
const newModels=['system','request','schemaMotion','types','projection','literal','rules','elements','levelsMotion','alias','distinct','anomaly','anomalyDelete','candidate','composite','foreign','architecture','pipeline','precedence','nullCompare'];
function svgFlow(labels,active){return `<svg viewBox="0 0 660 90" role="img" aria-label="处理步骤">${labels.map((t,i)=>`<g opacity="${i<=active?1:.25}"><rect x="${i*165+2}" y="15" width="145" height="52" rx="3" fill="${i===active?'#e5f0ee':'#f3f4f5'}" stroke="#a6b5bc"/><text x="${i*165+74}" y="46" text-anchor="middle" font-size="16" fill="#172b39">${t}</text>${i<3?`<path d="M ${i*165+148} 41 h 15 l -5 -5 m 5 5 l -5 5" fill="none" stroke="#5d7484"/>`:''}</g>`).join('')}</svg>`}
function model(type,k=0){
 if(modernModels.includes(type))return modernModel(type,k);

 if(type==='anomaly'||type==='anomalyDelete'){
  let rows=[{sid:'2025001',name:'林悦',major:'计算机',course:'C01',score:88},{sid:'2025001',name:'林悦',major:'计算机',course:'C02',score:92}];
  if(type==='anomaly'){if(k>=1)rows[0].major='软件工程';if(k>=2)rows[1].major='软件工程';return table(rows,['sid','name','major','course','score'],{mark:(_,i)=>k===1&&i===0})+`<p class="model-feedback">${['原始记录：同一个专业事实保存了两次。','只改一行：同一学号出现两个专业。','同时修改两行：需要保证所有副本一致。','拆分后：专业保存在学生表，选课只保存学号引用。'][Math.min(k,3)]}</p>`+(k>=3?table(students.slice(0,2).map(r=>r.sid==='2025001'?{...r,major:'软件工程'}:r),['sid','name','major']):'')}
  if(k>=1)rows=rows.slice(1);if(k>=2)rows=[];return table(rows,['sid','name','major','course','score'])+`<p class="model-feedback">${['原始记录：林悦选了两门课。','退选 C01，仍有一条学生记录。','退掉最后一门课，学生信息随整行一起消失。','应将学生事实与选课事实分开保存。'][Math.min(k,3)]}</p>`
 }
 if(type==='candidate')return table(students,studentCols,k===1?{col:'name',mark:r=>r.name==='林悦'}:k===2?{col:'sid'}:{})+`<p class="model-feedback">${['比较姓名、学号、学号与姓名的组合。','姓名：两名林悦，不能保证唯一。','学号：业务规则保证唯一且非空。','学号 + 姓名：姓名可以移去，不满足候选键的最小性。'][Math.min(k,3)]}</p>`;
 if(type==='composite')return table(enrollments.slice(0,4),['sid','course_id','score'],{col:k===1?'sid':k===2?'course_id':''})+`<p class="model-feedback">${['观察选课记录。','同一 sid 出现多次：单列不能区分选课。','同一 course_id 出现多次：单列仍然不够。','(sid, course_id) 组合唯一；适用于本例的单学期假设。'][Math.min(k,3)]}</p>`;
 if(type==='foreign'){return `<div class="model-form"><label>学号 <input id="fkSid" value="9999999" maxlength="7"></label><label>课程 <select id="fkCourse"><option>C01</option><option>C99</option></select></label><label>成绩 <input id="fkScore" type="number" value="88"></label><button id="fkCheck">检查记录</button></div>${svgFlow(['待录入记录','学生表','课程表','成绩范围'],k)}<div id="fkResult" class="model-feedback">待检查。已有学号可用 2025001，已有课程可用 C01。</div>`}
 if(type==='architecture')return svgFlow(['学生 / 教务','外模式','全局模式','存储结构'],k)+`<div class="level"><strong>${['同一批数据，不同用户需求','学生视图只需要自己的课程与成绩','统一维护学生、课程与选课关系','调整索引和存储组织，查询接口尽量保持不变'][Math.min(k,3)]}</strong></div>`;
 if(type==='pipeline'){let threshold=+(document.getElementById('threshold')?.value||3),r=courses.filter(x=>x.credits>=threshold);if(k>=3)r.sort((a,b)=>b.credits-a.credits||a.course_id.localeCompare(b.course_id));return `<div class="model-form"><label>学分下限 <input id="threshold" type="range" min="1" max="5" value="${threshold}"></label><output id="thresholdValue">${threshold}</output></div>${svgFlow(['来源表','筛选记录','输出列','排序结果'],k)}<div id="pipelineTable">${table(k===0?courses:r,k<2?courseCols:['course_name','credits'])}</div><p class="model-feedback">${['读取 courses 的全部记录。','保留 credits >= '+threshold+' 的记录。','只输出 course_name、credits；原表没有变化。','按学分降序，同分按课程号升序。'][Math.min(k,3)]}</p><pre class="code pipeline-sql" aria-label="当前查询"><span class="${k===2?'sql-active':''}">SELECT course_name, credits</span>
<span class="${k===0?'sql-active':''}">FROM courses</span>
<span class="${k===1?'sql-active':''}">WHERE credits &gt;= <b id="pipelineSqlThreshold">${threshold}</b></span>
<span class="${k===3?'sql-active':''}">ORDER BY credits DESC, course_id ASC;</span></pre>`}
 if(type==='precedence'){let r=[...students,{sid:'2024007',name:'李明',major:'数学',grade:2024}];let fn=x=>k<2?x.grade===2025&&(x.major==='计算机'||x.major==='数学'):(x.grade===2025&&x.major==='计算机')||x.major==='数学';return table(r,['sid','major','grade'],{mark:fn,dim:x=>!fn(x)})+`<p class="model-feedback">${k<2?'带括号：年级要求作用于两个专业。':'去掉括号：2024 级的数学专业学生也被选中了。'}</p>`}
 if(type==='nullCompare')return table([{score:88,condition:k? 'TRUE':'—'},{score:0,condition:k?'FALSE':'—'},{score:null,condition:k?'UNKNOWN':'—'}],['score','condition'])+`<p class="model-feedback">${['条件：score >= 60。','NULL 参与此比较得到 UNKNOWN。','WHERE 仅保留 TRUE；不及格与成绩未知应分别查询。','查询未录入成绩使用 score IS NULL。'][Math.min(k,3)]}</p>`;
 return '';
}
widget=function(type,printing=false){return newModels.includes(type)?`<div class="model" data-model="${type}">${model(type,printing?3:modelStep)}</div>${printing?'':'<div class="model-controls"><button id="modelPrev">上一步</button><button id="modelNext">下一步</button><button id="modelPlay">播放</button><button id="modelReset">重置</button></div>'}`:oldWidget(type,printing)};
const recapBranches = [
 ['数据库系统','数据 · 数据库 · DBMS · 应用','dbconcept'],
 ['关系与完整性','三张表 · 主键 · 外键','relations'],
 ['单表查询','来源 → 筛选 → 输出 → 排序','pipeline'],
 ['查询验证','边界 · 括号 · NULL','verify']
];
function recapMap(print){
 return `<div class="recap-map"><div class="recap-root">数据库基础与 SQL</div><div class="recap-branches">${recapBranches.map(([label,detail,title])=>{
 const target=L.slides.findIndex(s=>s.id===title);
 return `<div class="recap-node">${print?`<strong>${label}</strong>`:`<button data-recap-page="${target}">${label} ↗</button>`}<span>${detail}</span></div>`;
 }).join('')}</div></div>`;
}
function relationView(sid,print){
 const records=enrollments.filter(row=>row.sid===sid);
 return `<div class="relation-demo">${print?'':`<label>选择学生 <select id="relationStudent">${students.map(s=>`<option value="${s.sid}" ${s.sid===sid?'selected':''}>${s.name} · ${s.sid}</option>`).join('')}</select></label>`}
 <div class="relation-chain"><div><strong>学生表</strong><small>主键 sid</small><b>${sid}</b></div><span>→</span><div><strong>选课表</strong><small>外键 sid、course_id</small><b>${records.length} 条记录</b></div><span>→</span><div><strong>课程表</strong><small>主键 course_id</small><b>${records.map(r=>r.course_id).join('、')||'—'}</b></div></div>
 ${table(records.map(r=>({...r,course:courses.find(c=>c.course_id===r.course_id)?.course_name})),['sid','course_id','course'])}</div>`;
}
slideHTML=function(s,i,print=false,mode='student'){
 if(s.widget==='recap')return `<div class="slide-header"><div class="eyebrow">${esc(s.sub)}</div><h1>${esc(s.title)}</h1></div><div class="layout single">${recapMap(print)}<div class="map-summary">${s.points.map(x=>`<p>${inlineMD(x)}</p>`).join('')}</div></div>`;
 let right=(s.code&&!['projection','distinct'].includes(s.widget)?`<pre class="code">${esc(s.code)}</pre>`:'')+widget(s.widget,print);
 if(s.widget==='relations')right=relationView(students[0].sid,print);
 let q=s.exercise?`<div class="exercise-label">课堂练习</div>`:'';
 let answer='';
 return `<div class="slide-header"><div class="eyebrow"><span class="chapter-dot"></span>${esc(s.sub||'数据库基础与 SQL')}</div><h1>${esc(s.title)}</h1></div><div class="layout ${right?'':'single'}"><div class="teaching-copy">${q}<ul class="points">${s.points.map((x,j)=>`<li class="${print?'':'fragment'}">${inlineMD(x)}</li>`).join('')}</ul>${s.question?`<p class="class-question ${print?'':'fragment'}">${inlineMD(s.question)}</p>`:''}${answer}</div>${right?`<div class="visual ${s.code&&!print?'fragment':''}">${right}</div>`:''}</div>`;
};
function showStep(){const fragments=[...document.querySelectorAll('#deck .active .fragment')];fragments.forEach((el,i)=>el.classList.toggle('shown',i<buildStep));$('#sectionLabel').textContent=`${Math.min(buildStep,fragments.length)} / ${fragments.length}`;$('#stepBtn').textContent=buildStep<fragments.length?'继续展开':page===L.slides.length-1?'本课结束':'下一页';$('#stepBtn').disabled=page===L.slides.length-1&&buildStep>=fragments.length;}
let mainOnly=true;
function adjacent(direction){let n=page+direction;while(n>=0&&n<L.slides.length&&mainOnly&&L.slides[n].extra)n+=direction;return Math.max(0,Math.min(L.slides.length-1,n));}
function advance(){const count=document.querySelectorAll('#deck .active .fragment').length;if(buildStep<count){buildStep++;showStep()}else go(adjacent(1))}
render=function(){clearInterval(playHandle);playHandle=null;modelStep=0;buildStep=1;literalValue='column';distinctMode='major';const s=L.slides[page];let deck=$('#deck');if(!deck){$('#stage').innerHTML='<div class="deck" id="deck"></div>';deck=$('#deck')}
 deck.innerHTML=L.slides.map((x,i)=>`<div class="slide${i===page?' active':''}" data-slide="${i}"${i!==page?' hidden':''}>${i===page?slideHTML(x,i):''}<script type="application/json" class="slide-notes">${JSON.stringify({title:x.title,script:x.script||x.notes,notes:x.points}).replace(/</g,'\\u003c')}</script></div>`).join('');
 $('#pageNo').textContent=`${page+1} / ${L.slides.length}`;$('#bar').style.width=`${(page+1)/L.slides.length*100}%`;$('#prevBtn').disabled=page===0;$('#nextBtn').disabled=page===L.slides.length-1;bindWidget(s);bindModel();bindModern();
 deck.querySelectorAll('[data-recap-page]').forEach(button=>button.onclick=()=>go(+button.dataset.recapPage));
 on('#relationStudent','change',function changeStudent(){
   this.closest('.relation-demo').outerHTML=relationView(this.value,false);
   $('#relationStudent').addEventListener('change',changeStudent);
   $('#relationStudent').focus();
 });
 renderLessonMath(document.querySelector('#stage'));showStep();sync();document.title=s.title+' · '+L.title;
};
function bindModel(){let type=$('.model')?.dataset.model;if(!type)return;function redraw(){const threshold=$('#threshold')?.value;$('.model').innerHTML=model(type,modelStep);if(threshold&&$('#threshold')){$('#threshold').value=threshold}bindInner();bindModern();refreshPresenter()};function bindInner(){on('#fkCheck','click',()=>{const sid=$('#fkSid').value,c=$('#fkCourse').value,n=$('#fkScore').value;let result=!students.some(r=>r.sid===sid)?'拒绝：学生表中没有这个学号。':!courses.some(r=>r.course_id===c)?'拒绝：课程表中没有这个课程号。':n===''?'成绩留空：本例允许 NULL，引用有效。':(+n<0||+n>100)?'拒绝：成绩超出 0—100 范围。':'通过：学生、课程引用和成绩范围均有效。';$('#fkResult').textContent=result});on('#threshold','input',()=>{let v=+$('#threshold').value;$('#thresholdValue').textContent=v;$('#pipelineSqlThreshold').textContent=v;let r=modelStep?courses.filter(x=>x.credits>=v):courses;if(modelStep>=3)r=[...r].sort((a,b)=>b.credits-a.credits||a.course_id.localeCompare(b.course_id));$('#pipelineTable').innerHTML=table(r,modelStep<2?courseCols:['course_name','credits']);$('.model-feedback').textContent=modelStep?'保留学分不少于 '+v+' 的课程，共 '+r.length+' 条。':'当前显示来源表；阈值将在筛选步骤生效。'})}on('#modelNext','click',()=>{modelStep=Math.min(3,modelStep+1);redraw()});on('#modelPrev','click',()=>{modelStep=Math.max(0,modelStep-1);redraw()});on('#modelReset','click',()=>{clearInterval(playHandle);playHandle=null;modelStep=0;redraw();$('#modelPlay').textContent='播放'});on('#modelPlay','click',()=>{if(playHandle){clearInterval(playHandle);playHandle=null;$('#modelPlay').textContent='播放'}else{if(modelStep===3)modelStep=0;$('#modelPlay').textContent='暂停';playHandle=setInterval(()=>{modelStep=Math.min(3,modelStep+1);redraw();if(modelStep>=3){clearInterval(playHandle);playHandle=null;$('#modelPlay').textContent='播放'}},1800)}});bindInner()}
$('#prevBtn').addEventListener('click',e=>{e.stopImmediatePropagation();go(adjacent(-1))},true);
$('#nextBtn').addEventListener('click',e=>{e.stopImmediatePropagation();go(adjacent(1))},true);
$('#teacherBtn').hidden=false;
$('#teacherBtn').textContent='演示者视图';
$('#teacherBtn').title='打开演示者视图（J）';
$('#timerBtn').hidden=true;$('#pdfBtn').hidden=true;
// An about:blank popup inherits the opener's origin, including when launched from a local file.
let presenter=null;
function refreshPresenter(){
 if(!presenter||presenter.closed)return;
 const d=presenter.document,s=L.slides[page];
 d.getElementById('ptitle').textContent=s.title;
 d.getElementById('ppage').value=page;
 [...d.getElementById('ppage').options].forEach((o,i)=>o.textContent=(i+1)+' · '+L.slides[i].title);
 d.getElementById('pscript').textContent=s.script||s.notes;
 d.getElementById('pnotes').textContent=s.notes;
 d.getElementById('pq').textContent=s.question||'';
 d.getElementById('pa').textContent=s.answer||'本页没有预设问答。';
 d.getElementById('ptime').textContent=`${page+1} / ${L.slides.length} · ${s.minutes} 分钟 · ${s.extra?'补充':'主线'} · 动画 ${modelStep+1}/4`;
 d.getElementById('pmodel').disabled=!document.querySelector('.model');
 d.getElementById('pall').checked=!mainOnly;
 d.getElementById('pscript').dataset.slide=s.id;
}
const originalSync=sync;
sync=function(){originalSync();refreshPresenter()};
$('#teacherBtn').addEventListener('click',e=>{
 e.stopImmediatePropagation();
 if(presenter&&!presenter.closed){presenter.focus();refreshPresenter();return}
 presenter=window.open('','classroom_db_presenter','popup,width=880,height=760');
 if(!presenter){toast('请允许弹出窗口');return}
 const d=presenter.document;
 d.open();d.write(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>教师逐字稿</title><style>
body{font:17px/1.85 "Microsoft YaHei",sans-serif;margin:0;background:#f4f5f7;color:#273447}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:14px 24px;z-index:2}nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}select,button{font:inherit;font-size:14px;border:1px solid #ccd5dc;border-radius:6px;padding:7px 11px;background:#fff;color:inherit}select{max-width:58%}button{cursor:pointer}button:hover{background:#e8f1f5}button:disabled{opacity:.4}main{padding:22px 30px;max-width:900px;margin:auto}h1{font-size:27px;line-height:1.5}h2{font-size:15px;color:#55718b;letter-spacing:1px}pre,p{white-space:pre-wrap}pre{font:inherit}section{background:#fff;border:1px solid #dee4e9;padding:20px 26px;border-radius:10px;margin:16px 0}#pscript{font-size:19px;line-height:2;white-space:pre-wrap}#ptime{font-size:13px;color:#62788b;margin:6px 0 0}label{font-size:13px}#pa{border-left:3px solid #c79558;padding-left:16px}a{color:#286188}</style>
<header><nav><button id="pprev">上一页</button><select id="ppage" aria-label="选择页码"></select><button id="pnext">下一页</button></nav><nav style="margin-top:8px"><button id="pstep">展开下一项</button><button id="pmodel">动画下一步</button><button id="preset">重置动画</button><label><input type="checkbox" id="pall">翻页包含补充</label></nav><p id="ptime"></p></header>
<main><h1 id="ptitle"></h1><section><h2>逐字稿</h2><div id="pscript"></div></section><section><h2>课堂问题</h2><p id="pq"></p><h2>教师答案</h2><pre id="pa"></pre></section><section><h2>备课提示</h2><p id="pnotes"></p><p style="font-size:13px">编辑文件夹中的“课程.md”，保存后双击“更新课件.cmd”，再刷新学生窗口。腾讯会议只共享学生窗口。</p></section></main></html>`);d.close();
 const select=d.getElementById('ppage');
 L.slides.forEach((s,i)=>{const o=d.createElement('option');o.value=i;o.textContent=(i+1)+' · '+s.title;select.append(o)});
 select.onchange=()=>go(+select.value);
 d.getElementById('pprev').onclick=()=>go(adjacent(-1));
 d.getElementById('pnext').onclick=()=>go(adjacent(1));
 d.getElementById('pstep').onclick=advance;
 d.getElementById('pmodel').onclick=()=>$('#modelNext')?.click();
 d.getElementById('preset').onclick=()=>$('#modelReset')?.click();
 d.getElementById('pall').onchange=e=>{mainOnly=e.target.checked===false;refreshPresenter()};
 refreshPresenter();
},true);
$('.brand').textContent=L.title;
$('.hint').textContent='';$('#sectionLabel').title='本页已显示的讲解步骤';
const stepBtn=document.createElement('button');stepBtn.id='stepBtn';stepBtn.textContent='继续';$('.paging').prepend(stepBtn);stepBtn.onclick=advance;
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if(['arrowright','arrowleft',' ','r','j','e','p'].includes(k)){e.stopImmediatePropagation();if(k==='arrowright'||k===' '){e.preventDefault();advance()}if(k==='arrowleft'){e.preventDefault();if(buildStep>1){buildStep--;showStep()}else go(adjacent(-1))}if(k==='r'){buildStep=document.querySelectorAll('#deck .active .fragment').length;showStep()}if(k==='j'&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&!e.metaKey){e.preventDefault();$('#teacherBtn').click()}if(k==='p'&&e.ctrlKey&&e.shiftKey){e.preventDefault();$('#pdfBtn').click()}if(k==='e'&&e.ctrlKey&&e.shiftKey){e.preventDefault();document.getElementById('editBtn')?.click()}}},true);
window.goTo=go;window.next=()=>go(adjacent(1));window.prev=()=>go(adjacent(-1));
$('#tocBtn').addEventListener('click',()=>{$('#toc').querySelector('p').textContent=`${L.slides.length} 页 · 讲解与演示 · 练习 · 补充材料`});
$('#exportMode').innerHTML='<option value="student">学生版</option><option value="teacher">教师版 · 答案与逐字稿</option>';
$('#exportRange').innerHTML='<option value="core">本课内容</option><option value="all">含补充材料</option>';
if(params.has('all'))mainOnly=false;
render();if(params.has('print'))preparePrint(params.get('range')||'core',params.get('mode')||'student');

if(params.has('print'))document.querySelectorAll('.print-slide,.notes-page').forEach(renderLessonMath);
