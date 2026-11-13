/* Local teaching illustrations. Data examples are shared with app.js. */
const modernModels=['system','request','schemaMotion','types','projection','literal','rules','elements','levelsMotion','alias','distinct'];
let literalValue='column',distinctMode='major';
function inlineMD(value){return esc(value).replace(/&lt;br&gt;/g,'<br>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')}
function label(text){return `<div class="visual-label">${text}</div>`}
function status(text){return `<p class="model-feedback" aria-live="polite">${text}</p>`}
function staged(items,k){return items.map((x,i)=>`<div class="concept-card ${i<=k?'arrived':'waiting'}"><span class="step-no">0${i+1}</span><strong>${x[0]}</strong><p>${x[1]}</p></div>`).join('')}
function modernModel(type,k){
 if(type==='system')return label('从一条记录，到共同使用它的人')+`<div class="system-scene"><div class="system-data"><span class="micro">数据</span><b>2025001 · 林悦 · 88</b></div><div class="system-db ${k>=1?'arrived':'waiting'}"><span>数据库 DB</span><div class="data-tabs"><span>学生</span><span>课程</span><span>选课</span></div></div><div class="system-manager ${k>=2?'arrived':'waiting'}"><b>数据库管理系统 DBMS</b><span>访问 · 约束 · 权限 · 恢复</span></div><div class="system-users ${k>=3?'arrived':'waiting'}"><span>学生</span><span>教师</span><span>教务</span><small>应用与运行环境 · 数据库系统 DBS</small></div></div>`+status(['一条学号、一项成绩，都是数据。','相关数据按结构组织，长期保存。','DBMS 提供管理数据的软件功能。','数据、软件、应用、人员与环境共同组成系统。'][k]);
 if(type==='request')return label('跟随一次成绩查询')+`<div class="request-lane step-${k}"><div class="station ${k===0||k===3?'lit':''}"><span>01</span><b>浏览器</b><small>显示课程与成绩</small></div><div class="station ${k===1||k===3?'lit':''}"><span>02</span><b>应用程序</b><small>PHP 等应用代码</small></div><div class="station ${k===2?'lit':''}"><span>03</span><b>DBMS</b><small>访问数据库</small></div><div class="request-wire"></div><div class="request-packet">${['请求','SQL','结果','页面'][k]}</div></div><div class="request-message">${['用户选择“我的成绩”','应用确认查询对象，发送 SQL','DBMS 返回课程与成绩记录','应用整理内容，浏览器显示页面'][k]}</div>`+status('浏览器 → 应用 → 数据库 → 应用 → 浏览器');
 if(type==='schemaMotion'){
  let rows=students.slice(0,k===1?3:2).map(r=>({...r,enrolled_on:null}));let cols=k>=2?[...studentCols,'enrolled_on']:studentCols;
  return label('结构与当前记录')+`<div class="schema-label">students(${cols.join(', ')})</div><div class="morph-table">${table(rows,cols,k===1?{mark:(_,i)=>i===2}:k>=2?{col:'enrolled_on'}:{})}</div>`+status(['原有结构，当前两条记录。','新增一名学生：多了一行，结构未变。','回到原数据并增加入学日期字段：结构改变。','新增字段不会自动补出已知日期；旧记录需要后续处理。'][k]);
 }
 if(type==='types')return label('相同的输入，不同的含义')+`<div class="type-value">${['0012','0012','120','88.5'][k]}</div><div class="type-path"><span>${['字符','整数','整数','精确小数'][k]}</span><span class="type-arrow">→</span><strong>${['保留 0012','数值为 12','类型通过','保留小数位'][k]}</strong></div><div class="type-rule ${k>=2?'arrived':'waiting'}">${k===2?'百分制范围检查：120 超出 0—100':'业务允许小数时，88.5 可在范围内'}</div>`+status(['学号用于识别，字符形式可能有意义。','整数表达数值，不保留原输入的前导零形式。','类型合法，还要检查业务范围。','精度与取值范围需根据业务分别设计。'][k]);
 if(type==='projection')return label('来源表 → 选出列 → 结果')+`<div class="projection-wrap ${k===1?'column-focus':''}">${table(students,k>=2?(k===3?['major','name']:['name','major']):studentCols,{col:k===1?'name':''})}</div>`+`<pre class="code miniature">SELECT ${k===3?'major, name':'name, major'}\nFROM students;</pre>`+status(['来源表有 6 行、4 列。','突出需要的列，行尚未减少。','输出 6 行、2 列，原表仍完整。','交换 SELECT 列表顺序，输出顺序随之改变。'][k]);
 if(type==='literal'){
  const isText=k>=2;return label('一对引号改变取值方式')+`<div class="literal-pair"><span class="${!isText?'selected':''}">name</span><span class="${isText?'selected':''}">'name'</span></div><pre class="code miniature">SELECT ${isText?"'name'":'name'}\nFROM students;</pre>`+table(students.map(r=>({result:isText?'name':r.name})),['result'])+status(isText?'每行输出同一个字符串 name。':'每行输出姓名列中的值。');
 }
 if(type==='rules')return label('记录接受之前的规则')+`<div class="concept-grid">${staged([['实体完整性','主键唯一，并且非空'],['参照完整性','引用对象必须有效'],['用户定义的完整性','成绩在约定范围内']],k)}</div>`+status(['先保证每条记录能够被识别。','再保证记录之间的引用有效。','还要符合业务约定。','不同规则一起限制允许保存的数据状态。'][k]);
 if(type==='elements')return label('以“修改成绩”为例')+`<div class="elements-wheel">${staged([['结构','enrollments(sid, course_id, score)'],['操作','找到选课记录，修改 score'],['约束','有效引用，成绩在 0—100']],k)}</div>`+status(['先知道数据怎样组织。','再说明允许做什么操作。','操作后的状态仍要符合约束。','结构、操作、约束共同描述数据模型。'][k]);
 if(type==='levelsMotion')return label('同一套数据的三个层次')+`<div class="layer-scene"><div class="view-level"><div>学生视角<span>自己的课程与成绩</span></div><div class="${k>=1?'arrived':'waiting'}">教务视角<span>全校选课信息</span></div></div><div class="layer-link">外模式／模式映像</div><div class="logical-level">模式<span>students ↔ enrollments ↔ courses</span></div><div class="layer-link">模式／内模式映像</div><div class="physical-level">内模式<span>${k>=2?'记录文件 + 索引':'记录的存储组织'}</span>${k>=2?'<b class="index-block">索引</b>':''}</div></div>`+status(['从学生所需的数据开始。','不同用户视图，共用全局逻辑结构。','增加索引，调整存储和访问组织。','映像帮助隔离变化，查询含义尽量保持稳定。'][k]);
 if(type==='alias')return label('表头变化，记录保持一致')+table(courses.map(r=>k<2?r:{course:r.course_name,credit_count:r.credits}),k<2?['course_name','credits']:['course','credit_count'])+status(['原字段名作为结果表头。','AS 指定结果列的名称。','别名成为本次查询的表头。','原表仍叫 course_name、credits。'][k]);
 if(type==='distinct'){
  let pair=k===3;let chosen=pair?students:students.map(r=>({major:r.major}));let result=k>=2&&!pair?Array.from(new Set(students.map(r=>r.major))).map(major=>({major})):chosen;
  return label('比较整个输出行')+`<div class="dedup-stage step-${k}">${table(result,pair?['sid','major']:['major'],k===1?{dim:(r,i)=>students.findIndex(x=>x.major===r.major)!==i}:{})}</div><pre class="code miniature">SELECT ${k>=1?'DISTINCT ':''}${pair?'sid, major':'major'}\nFROM students;</pre>`+status(['默认保留每条记录的专业值。','相同输出行被识别出来。','合并重复输出，留下 3 种专业。','同时输出 sid 后，6 个组合不同，均保留。'][k]);
 }
 return '';
}
const baseTeachingWidget=widget;
widget=function(type,printing=false){
 if(type==='overview')return `<div class="overview"><div class="overview-number">01</div><div class="overview-line"></div><h2>从一条选课记录<br>到一条 SQL</h2><div class="overview-steps"><span>看数据</span><span>定规则</span><span>写查询</span><span>核对结果</span></div></div>`;
 if(type==='courseSource')return label('courses · 来源表')+table(courses,courseCols);
 if(type==='sortMotion')return printing?table([...courses].sort((a,b)=>b.credits-a.credits||a.course_id.localeCompare(b.course_id)),courseCols):label('记录整体移动，字段保持对应')+`<div class="controls"><button data-motion-sort="DESC">学分降序</button><button data-motion-sort="ASC">学分升序</button><button data-motion-sort="RESET">重置</button></div><div class="sort-head"><span>课程号</span><span>课程名</span><span>学分</span></div><div class="sort-motion">${courses.map((r,i)=>`<div class="sort-record" data-course="${r.course_id}" style="--position:${i}"><span>${r.course_id}</span><b>${r.course_name}</b><strong>${r.credits}</strong></div>`).join('')}</div><p class="caption" id="sortMotionCaption">先看来源表的排列，再指定结果顺序。</p>`;
 if(type==='practice')return `<div class="writing-space"><h3>SQL 草稿</h3>${printing?'<div class="paper-lines"></div>':`<textarea id="practiceDraft" aria-label="SQL 练习草稿" placeholder="在这里写 SQL，可分别保留三题"></textarea><p class="caption">来源表、输出列、条件、排序。</p>`}</div>`;
 return baseTeachingWidget(type,printing);
};
function bindModern(){
 document.querySelectorAll('[data-motion-sort]').forEach(b=>b.onclick=()=>{
  let order=b.dataset.motionSort;
  let rows=order==='RESET'?courses:[...courses].sort((a,b)=>(order==='DESC'?b.credits-a.credits:a.credits-b.credits)||a.course_id.localeCompare(b.course_id));
  rows.forEach((r,i)=>document.querySelector(`[data-course="${r.course_id}"]`).style.setProperty('--position',i));
  $('#sortMotionCaption').textContent=order==='RESET'?'来源表的排列。':`按学分${order==='DESC'?'降':'升'}序；同分按课程号升序。`;
  if($('.code'))$('.code').textContent=`SELECT course_id, course_name, credits\nFROM courses\n${order==='RESET'?'':`ORDER BY credits ${order}, course_id ASC`} ;`.replace(/\n ;$/,';').replace(' ;',';');
 });
 // Adding a new record or field remains explicitly controlled by the lecturer.
 if(L.slides[page].widget==='schemaMotion'){
  $('#modelNext').textContent=modelStep===0?'新增记录':modelStep===1?'回到原表并新增字段':'下一步';
 }
}

const previousInlineMD=inlineMD;
inlineMD=function(v){return previousInlineMD(v).replace(/!\[([^\]]*)\]\(((?:data:image\/|https?:\/\/)[^)]+)\)/g,'<img class="lesson-image" alt="$1" src="$2">')};
function renderLessonMath(el){if(window.renderMathInElement&&el)renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}],throwOnError:false,trust:false})}
