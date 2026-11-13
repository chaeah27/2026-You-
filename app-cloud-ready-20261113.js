'use strict';
const KEY='yurif_archive_v1';
const defaults={journal:[],sessions:[],equipment:[],results:[],references:[],sensoryEnvironments:[],experimenters:[],pilotRuns:[],labRuns:[],journalBoard:[]};
let db=load();let view='home';
function load(){if(window.yurifCloud?.initialData){try{const original=localStorage.getItem(KEY);if(original&&!localStorage.getItem('yurif_legacy_precloud_backup'))localStorage.setItem('yurif_legacy_precloud_backup',original)}catch{}return {...structuredClone(defaults),...window.yurifCloud.initialData}}try{const raw=JSON.parse(localStorage.getItem(KEY));return {...structuredClone(defaults),...raw,sensoryEnvironments:Array.isArray(raw?.sensoryEnvironments)?raw.sensoryEnvironments:[],experimenters:Array.isArray(raw?.experimenters)?raw.experimenters:[],pilotRuns:Array.isArray(raw?.pilotRuns)?raw.pilotRuns:[],labRuns:Array.isArray(raw?.labRuns)?raw.labRuns:[],journalBoard:Array.isArray(raw?.journalBoard)?raw.journalBoard:[]}}catch{return structuredClone(defaults)}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));if(window.yurifCloud?.ready)window.yurifCloud.queueSave(db);return true}catch{alert('브라우저 저장에 실패했습니다. JSON 백업 파일을 다운로드하세요.');return false}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateNow=()=>new Date().toLocaleDateString('sv-SE');
function download(name,body,type='application/json'){let blob=new Blob([body],{type});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportJSON(){download('eureka-backup-'+dateNow()+'.json',JSON.stringify({schema:1,exported_at:new Date().toISOString(),data:db},null,2))}
const stat=(label,num,note)=>`<div class="stat"><div class="label">${label}</div><div class="num">${num}</div><div class="note">${note}</div></div>`;
function head(title,subtitle,eyebrow='EUREKA / RESEARCH'){return `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lead">${subtitle}</p>`}
function home(){return `<section class="hero"><div><div class="eyebrow">A LIVING RESEARCH ARCHIVE</div><h1>감각에서 정서로,<br>정서에서 관계로.</h1><p>시각·청각·후각 환경이 각성 호감, 비각성 호감과 실제 사회적 교류에 미치는 영향을 탐구하는 유리프 연구 공간입니다.</p><button class="btn" onclick="route('journal')">＋ 오늘의 연구 기록 작성</button></div><div class="rings"><span>Y</span></div></section><div class="statgrid">${stat('연구 일지',db.journal.length,'작성된 연구 기록')}${stat('실험 세션',db.sessions.length,'등록된 익명 세션')}${stat('장비·보정',db.equipment.length,'등록된 장비 기록')}${stat('분석 메모',db.results.length,'등록된 연구 결과')}</div><div class="cols"><section class="panel"><h2>연구 진행 로드맵</h2><div class="steps">${[['01','연구 설계','연구 질문, 윤리, 참가자 기준 확정'],['02','장비·센서 검증','Grove GSR 보정, 심박 측정, 조도·CCT 확인'],['03','1차 감각 실험','시각·청각·후각 조건별 정서 및 생체 반응'],['04','감각 환경 후보 선정','각성 호감·비각성 호감·대조 환경 구분'],['05','2차 실제 대화 실험','환경별 실제 대화와 정서·대인 호감 비교'],['06','결과 분석 및 가이드라인','학교생활 상황에 맞춘 환경 설계 지침']].map(x=>`<div class="step"><span class="stepno">${x[0]}</span><div><strong>${x[1]}</strong><small>${x[2]}</small></div></div>`).join('')}</div></section><section class="panel"><h2>최근 연구 활동</h2>${db.journal.length?db.journal.slice().reverse().slice(0,4).map(x=>`<div class="entry"><small>${esc(x.date)} · ${esc(x.category)}</small><strong style="display:block">${esc(x.title)}</strong><span class="muted">${esc((x.memo||'').slice(0,85))}</span></div>`).join(''):'<div class="empty">아직 기록이 없어요. 연구 일지에서 첫 기록을 작성하세요.</div>'}<div class="notice">이 사이트는 <b>GitHub Pages용 정적 사이트</b>입니다. 브라우저에 작성한 기록은 서버에 자동 업로드되지 않습니다. 자주 JSON 백업을 다운로드하세요.</div></section></div><div class="cards"><div class="card"><span class="tag">SENSORY</span><h3>1차 감각 실험</h3><p>조도·CCT·움직임, 환경음, 향수 6종을 분리해 비교합니다.</p></div><div class="card"><span class="tag">INTERACTION</span><h3>2차 실제 대화</h3><p>실제 대화를 유지하면서 상대와 환경을 균형 배정합니다.</p></div><div class="card"><span class="tag">EVIDENCE</span><h3>과학적 해석</h3><p>정서 설문을 주요 지표로, EDA와 심박수를 보조 자료로 활용합니다.</p></div></div>`}

const sensoryTypes={visual:'시각',auditory:'청각',olfactory:'후각'};
const sensoryLabel=k=>sensoryTypes[k]||'기타';
function sensoryItems(type){return (Array.isArray(db.sensoryEnvironments)?db.sensoryEnvironments:[]).filter(x=>x.type===type)}
function sensoryOptions(type){return '<option value="">환경을 선택하세요</option>'+sensoryItems(type).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')}
function sensoryEditor(){
  return '<section class="panel"><h2>감각 환경 직접 분류·관리</h2><p class="muted">시각·청각·후각 환경을 직접 등록하세요. 아래에 추가한 환경은 연구 일지의 ‘감각 환경’ 선택 목록에 자동으로 연결됩니다.</p><div class="cards">'+Object.entries(sensoryTypes).map(([type,label])=>
    '<div class="card sensory-card"><span class="tag">'+label+'</span><h3>'+label+' 감각 환경</h3>'+
    '<form data-form="sensoryEnvironments" class="sensory-form"><input type="hidden" name="type" value="'+type+'"><div class="field"><label>환경 이름</label><input name="name" maxlength="100" required placeholder="'+(type==='visual'?'예: 조도 300 lx · 4000 K':type==='auditory'?'예: 조용한 교실':'예: 향수 1번')+'"></div><div class="field"><label>구체적 조건 / 특성 (선택)</label><textarea name="memo" placeholder="변수, 측정값, 재현 방법 등을 기록하세요."></textarea></div><button class="btn" type="submit">＋ 환경 추가</button></form>'+
    '<div class="sensory-list">'+(sensoryItems(type).length?sensoryItems(type).map(x=>
      '<div class="entry"><div class="entry-head"><div><strong>'+esc(x.name)+'</strong><small style="display:block;white-space:pre-wrap">'+esc(x.memo||'')+'</small></div><button type="button" data-sensory-remove="'+esc(x.id)+'">삭제</button></div></div>').join(''):'<div class="empty">아직 등록된 환경이 없습니다.</div>')+'</div></div>').join('')+'</div><div class="notice">연구 환경과 일지 기록은 현재 브라우저에 저장됩니다. 같은 주소에 접속하더라도 다른 팀원 기기와 자동으로 공유되지는 않습니다. 정기적으로 JSON 백업을 내려받으세요.</div></section>';
}
function journalSensoryFields(){
  return '<div class="formgrid"><div class="field"><label>감각 분야 (선택)</label><select name="sensoryType" id="journal-sensory-type"><option value="">일반 연구 기록</option>'+Object.entries(sensoryTypes).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div><div class="field"><label>등록한 감각 환경</label><select name="sensoryId" id="journal-sensory-id" disabled><option value="">먼저 감각 분야를 선택하세요</option></select></div></div>';
}
function updateJournalSensoryOptions(){
 const type=document.getElementById('journal-sensory-type'),select=document.getElementById('journal-sensory-id');
 if(!type||!select)return;
 select.disabled=!type.value;
 select.innerHTML=type.value?sensoryOptions(type.value):'<option value="">먼저 감각 분야를 선택하세요</option>';
}

function protocol(){return sensoryEditor()+head('실험 설계와 프로토콜','현재까지 논의된 연구 방법의 요약입니다. 세부 수치와 장비 성능은 예비실험 후 확정합니다.','01 / EXPERIMENT DESIGN')+`<div class="panel"><h2>연구 질문</h2><p>시각·청각·후각 환경에 따라 정서의 쾌·불쾌와 각성 수준이 달라지는가? 개별 자극의 반응은 실제 대화 상황에서도 나타나며, 대인 호감과 어떤 관계가 있는가?</p><div class="flowdots"><span>감각 조건 탐색</span><b>→</b><span>환경 후보 선정</span><b>→</b><span>실제 대화</span><b>→</b><span>정서·대인 호감</span><b>→</b><span>학교 가이드라인</span></div></div><div class="cards"><div class="card"><span class="tag">1차 / 시각</span><h3>조도 · 색온도 · 움직임</h3><p>조도와 색온도의 2×2 조건을 검토하고, 움직임은 고정 조명에서 별도로 비교합니다.</p></div><div class="card"><span class="tag">1차 / 청각</span><h3>학교·자연 환경음</h3><p>조용한 교실, 시끄러운 교실, 급식실, 학교 특정 공간, 숲길. 고정 조명·음량 관리.</p></div><div class="card"><span class="tag">1차 / 후각</span><h3>향수 6종</h3><p>시향지, 분사량, 제시 거리와 환기 통제. 향 강도·잔향 기록, 민감성 확인.</p></div></div><div class="panel"><h2>2차 실제 대화 검증</h2><p>한 학급 평균 인원 규모를 모집하고 참가자를 환경 A(각성 호감 후보), B(비각성 호감 후보), C(일반 교실 대조)에 무작위 배정합니다. 참가자당 대화 1회, 대화 상대 3명이 각 환경에 균형 있게 배정되도록 합니다.</p><div class="tablewrap"><table><thead><tr><th>구간</th><th>상황</th><th>측정</th></tr></thead><tbody><tr><td>T0</td><td>일반 교실 안정 상태</td><td>정서, EDA, HR</td></tr><tr><td>T1</td><td>배정된 환경에 노출·대화 없음</td><td>정서, EDA, HR</td></tr><tr><td>T2</td><td>반구조화된 실제 대화</td><td>EDA, HR; HRV는 신뢰성 검증 시 탐색</td></tr><tr><td>T3</td><td>대화 후 안정 및 설문</td><td>정서, 대인 호감, 재교류 의향</td></tr></tbody></table></div></div><div class="panel"><h2>측정 및 해석 원칙</h2><p><b>핵심 결과:</b> 쾌·불쾌(Valence), 각성(Arousal), 대인 호감 및 재교류 의향.</p><p><b>보조 결과:</b> Grove GSR 기반 전도도 추정값과 평균 심박수. HRV는 장비·구간 적합성을 확인한 후 선택적으로 적용합니다.</p><p><b>주의:</b> EDA·심박수만으로 긍정·부정 감정을 판정하지 않습니다. 감각 조건의 효과를 판단할 때 대조집단, 사전 상태, 대화 상대, 자극 순서를 고려합니다.</p></div><div class="notice">참가자에게 자극·센서·예상 위험과 자발적 참여를 충분히 안내해야 합니다. 특정 가설의 사전 비공개는 별도의 연구윤리 검토가 필요합니다.</div>`}
function renderEntries(type,fmt){return db[type].length?db[type].slice().reverse().map(x=>`<div class="entry"><div class="entry-head"><div><small>${esc(x.date||'')} · ${esc(x.category||x.stage||'')}</small><strong style="display:block">${esc(x.title||x.device||x.code||'기록')}</strong></div><button data-remove="${type}" data-id="${esc(x.id)}">삭제</button></div><p style="white-space:pre-wrap;margin:4px 0">${fmt(x)}</p></div>`).join(''):'<div class="empty">등록된 기록이 없습니다.</div>'}

function journalTaskList(type){
 const items=(db.journalBoard||[]).filter(x=>x.type===type);
 if(!items.length)return '<div class="journal-empty">아직 등록된 항목이 없습니다. 펜 버튼으로 추가해 보세요.</div>';
 return items.slice().sort((a,b)=>(a.done===b.done?0:a.done?1:-1)).map(x=>
  '<article class="journal-board-item '+(x.done?'is-done':'')+'"><label class="journal-check"><input type="checkbox" data-board-toggle="'+esc(x.id)+'" '+(x.done?'checked':'')+' aria-label="완료 표시"></label><div class="journal-board-body"><div class="journal-board-item-title">'+esc(x.title)+'</div>'+(x.detail?'<p>'+esc(x.detail)+'</p>':'')+(x.due?'<small>예정: '+esc(x.due)+'</small>':'')+'</div><button type="button" class="journal-icon-button" data-board-edit="'+esc(x.id)+'" aria-label="수정">✎</button><button type="button" class="journal-icon-button" data-board-delete="'+esc(x.id)+'" aria-label="삭제">×</button></article>').join('');
}
function journalBoardCard(type,label,description,icon){
 const count=(db.journalBoard||[]).filter(x=>x.type===type&&!x.done).length;
 return '<section class="panel journal-board-card"><div class="journal-card-head"><div><span class="journal-card-icon">'+icon+'</span><h2>'+label+'</h2><p class="muted">'+description+'</p></div><button type="button" class="journal-pen" data-board-add="'+type+'" title="'+label+' 추가" aria-label="'+label+' 추가">✎</button></div><div class="journal-card-count">'+count+'개 진행 중</div><div class="journal-board-list">'+journalTaskList(type)+'</div></section>';
}
function journalArchive(){
 const old=db.journal||[];
 return '<section class="panel journal-history"><div class="journal-card-head"><div><h2>연구 일지 아카이브</h2><p class="muted">이전에 작성한 실험·회의 기록을 그대로 확인할 수 있어요.</p></div><button type="button" class="journal-pen" data-board-add="journal" aria-label="연구 일지 작성" title="연구 일지 작성">✎</button></div>'+
 (old.length?renderEntries('journal',x=>(x.sensoryType?'<span class="pill">'+esc(sensoryLabel(x.sensoryType))+'</span> ':'')+(x.sensoryName?'<strong>'+esc(x.sensoryName)+'</strong><br>':'')+esc(x.memo)+(x.next?'<br><small>다음: '+esc(x.next)+'</small>':'')):'<div class="journal-empty">아직 연구 일지가 없어요. 펜 버튼을 눌러 첫 기록을 작성하세요.</div>')+'</section>';
}
function journalModal(){
 return '<div id="journal-modal" class="journal-modal" hidden role="dialog" aria-modal="true" aria-labelledby="journal-modal-title"><div class="journal-modal-panel"><div class="journal-card-head"><h2 id="journal-modal-title">새 항목</h2><button type="button" class="journal-icon-button" data-journal-close aria-label="닫기">×</button></div><div id="journal-modal-content"></div></div></div>';
}
function journal(){
 const total=(db.journalBoard||[]),pending=total.filter(x=>!x.done);
 return head('연구 일지','메모, 다음 할 일, 준비물을 한눈에 정리하는 연구팀 작업 대시보드입니다.','02 / RESEARCH WORKSPACE')+
 '<div class="journal-dashboard-top"><div class="journal-hero"><div><h2>RESEARCH WORKSPACE</h2><span>펜 버튼을 눌러 새로운 내용을 작성하거나 수정할 수 있어요.</span></div><button type="button" class="btn" data-board-add="journal">✎ 연구 일지 작성</button></div>'+
 '<div class="journal-kpis"><div><small>남은 할 일</small><strong>'+pending.filter(x=>x.type==='todo').length+'</strong></div><div><small>준비할 것</small><strong>'+pending.filter(x=>x.type==='prep').length+'</strong></div><div><small>메모</small><strong>'+total.filter(x=>x.type==='memo').length+'</strong></div><div><small>연구 기록</small><strong>'+(db.journal||[]).length+'</strong></div></div></div>'+
 '<div class="journal-board-grid">'+journalBoardCard('memo','메모','아이디어와 중요한 내용을 빠르게 기록해요.','✎')+journalBoardCard('todo','다음 할 일','남은 연구 작업과 마감일을 관리해요.','✓')+journalBoardCard('prep','준비할 것','실험에 필요한 장비와 자료를 챙겨요.','▣')+'</div>'+journalArchive()+journalModal();
}
function journalOpen(kind,id){
 const modal=document.getElementById('journal-modal'),content=document.getElementById('journal-modal-content');
 if(!modal||!content)return;
 const existing=(db.journalBoard||[]).find(x=>x.id===id);
 const type=existing?.type||kind;
 if(type==='journal'){
 document.getElementById('journal-modal-title').textContent='연구 일지 작성';
 content.innerHTML='<form data-form="journal" class="journal-edit-form"><div class="formgrid"><div class="field"><label>작성일</label><input name="date" type="date" value="'+dateNow()+'" required></div><div class="field"><label>구분</label><select name="category"><option>회의</option><option>장비 테스트</option><option>예비실험</option><option>1차 실험</option><option>2차 실험</option><option>자료 분석</option><option>기타</option></select></div></div>'+journalSensoryFields()+'<div class="field"><label>제목</label><input name="title" required maxlength="120" placeholder="연구 기록 제목"></div><div class="field"><label>실행 내용과 관찰</label><textarea name="memo" required placeholder="실험, 회의 및 관찰 내용"></textarea></div><div class="field"><label>결론·다음 할 일</label><textarea name="next" placeholder="결론과 후속 작업"></textarea></div><button class="btn" type="submit">일지 저장</button></form>';
 } else {
 const heading={memo:'메모',todo:'다음 할 일',prep:'준비할 것'}[type]||'새 항목';
 document.getElementById('journal-modal-title').textContent=existing?heading+' 수정':heading+' 추가';
 content.innerHTML='<form data-form="journalBoard"><input name="boardId" type="hidden" value="'+esc(existing?.id||'')+'"><input name="type" type="hidden" value="'+esc(type)+'"><div class="field"><label>제목</label><input name="title" required maxlength="150" placeholder="내용을 입력하세요" value="'+esc(existing?.title||'')+'"></div><div class="field"><label>상세 내용</label><textarea name="detail" placeholder="간단한 메모 또는 설명">'+esc(existing?.detail||'')+'</textarea></div>'+(type==='todo'||type==='prep'?'<div class="field"><label>예정일 (선택)</label><input name="due" type="date" value="'+esc(existing?.due||'')+'"></div>':'')+'<button class="btn" type="submit">'+(existing?'수정 저장':'항목 저장')+'</button></form>';
 }
 modal.hidden=false;
 const first=modal.querySelector('input:not([type="hidden"])');if(first)first.focus();
}
function journalClose(){const modal=document.getElementById('journal-modal');if(modal)modal.hidden=true}

function equipment(){return head('장비 및 보정 관리','장비 사양, 실제 보정 조건, 신호 품질과 센서 변경 이력을 따로 기록합니다.','03 / CALIBRATION')+`<div class="cards"><div class="card"><span class="tag">구매 완료</span><h3>Grove GSR + Uno R3</h3><p>ADC 기록 → 제조사 보정식으로 저항 추정 → 전도도(µS) 추정. 기판 버전 확인 필수.</p></div><div class="card"><span class="tag">활용 검토</span><h3>Apple Watch</h3><p>심박수 기록 간격과 구간별 자료 추출 확인. HRV는 추가 검증 필요.</p></div><div class="card"><span class="tag">구매 검토</span><h3>조도·CCT 측정</h3><p>예산 3만 원. 저가 색 센서는 추정·보정 필요. 혼합 조명에서 실측값 기록.</p></div></div><div class="twocol"><section class="panel"><h2>장비·보정 기록 추가</h2><form data-form="equipment"><div class="formgrid"><div class="field"><label>일자</label><input type="date" name="date" value="${dateNow()}" required></div><div class="field"><label>장비명</label><input name="device" placeholder="Grove GSR / Apple Watch / TCS34725" required></div></div><div class="field"><label>보정 조건 및 절차</label><textarea name="memo" required placeholder="전극 미착용 ADC, 착용 시 ADC, 조도 기준, 제조사 공식식 등"></textarea></div><div class="field"><label>결과 및 문제점</label><textarea name="next" placeholder="정상 여부, 추후 검증이 필요한 부분"></textarea></div><button class="btn" type="submit">＋ 보정 기록 저장</button></form></section><section class="panel"><h2>검증 이력</h2>${renderEntries('equipment',x=>esc(x.memo)+(x.next?`<br><small>결과: ${esc(x.next)}</small>`:''))}</section></div>`}

function experimenterOptions(){return '<option value="">실험자 선택</option>'+(db.experimenters||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.code)+'</option>').join('')}
function stageToSensory(stage){return {'1차-시각':'visual','1차-청각':'auditory','1차-후각':'olfactory'}[stage]||''}
function sensorySessionOptions(type){return '<option value="">등록된 환경 선택 (선택사항)</option>'+(type?sensoryItems(type):db.sensoryEnvironments||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(sensoryLabel(x.type))+' · '+esc(x.name)+'</option>').join('')}
function updateSessionEnvironmentOptions(){
 const stage=document.getElementById('session-stage'), select=document.getElementById('session-sensory-id');
 if(!stage||!select)return;
 select.innerHTML=sensorySessionOptions(stageToSensory(stage.value));
}
function experimenterManager(){
 return '<section class="panel"><h2>실험자 코드 관리</h2><p class="muted">실험 진행자를 실명 대신 코드로 등록합니다. 세션을 저장할 때 이 코드로 담당 실험자를 연결하고 결과를 모아서 조회할 수 있습니다.</p><form data-form="experimenters" class="actions"><input name="code" maxlength="40" required placeholder="예: 연구자 A / E01" style="max-width:270px"><button class="btn" type="submit">＋ 실험자 추가</button></form><div class="actions" style="margin-top:12px">'+((db.experimenters||[]).length?(db.experimenters||[]).map(x=>'<span class="experimenter-chip">'+esc(x.code)+' <button type="button" data-experimenter-remove="'+esc(x.id)+'" aria-label="'+esc(x.code)+' 삭제">×</button></span>').join(''):'<span class="muted">등록된 실험자가 없습니다.</span>')+'</div></section>';
}
function meanOf(items,key){const nums=items.map(x=>x[key]).filter(x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x))).map(Number);return nums.length?(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2):'—'}
function experimenterResults(){
 const ex=db.experimenters||[];
 const ids=ex.map(x=>x.id);
 const legacy=(db.sessions||[]).filter(x=>!x.experimenterId);
 const opts='<option value="all">전체 실험자</option>'+ex.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.code)+'</option>').join('')+(legacy.length?'<option value="unassigned">미지정 세션</option>':'');
 return '<section class="panel"><div class="entry-head" style="align-items:center;flex-wrap:wrap"><div><h2 style="margin-bottom:4px">실험자별 결과 한눈에 보기</h2><p class="muted">실험자를 선택하면 담당 세션별 측정값과 평균을 확인할 수 있습니다.</p></div><select id="experimenter-filter" aria-label="실험자 선택" style="max-width:240px">'+opts+'</select></div><div id="experimenter-results-content"></div></section>';
}
function renderExperimenterResults(){
 const root=document.getElementById('experimenter-results-content');
 const select=document.getElementById('experimenter-filter');
 if(!root||!select)return;
 const id=select.value;
 const all=db.sessions||[];
 const records=id==='all'?all:id==='unassigned'?all.filter(x=>!x.experimenterId):all.filter(x=>x.experimenterId===id);
 const experimenterName=id==='all'?'전체 실험자':id==='unassigned'?'미지정':(db.experimenters||[]).find(x=>x.id===id)?.code||'실험자';
 const measures=[['valence','쾌·불쾌'],['arousal','각성'],['hr','심박수 bpm'],['eda','전도도 µS'],['liking','대인 호감']];
 root.innerHTML='<p class="muted">'+esc(experimenterName)+' · '+records.length+'개 세션</p>'+
   '<div class="session-metrics">'+measures.map(([k,label])=>'<div class="stat"><div class="label">'+label+' 평균</div><div class="num">'+meanOf(records,k)+'</div></div>').join('')+'</div>'+
   (records.length?'<div class="tablewrap"><table><thead><tr><th>날짜</th><th>실험자</th><th>참가자 코드</th><th>단계 · 환경</th><th>쾌·불쾌</th><th>각성</th><th>HR</th><th>GSR (µS)</th><th>조도 (lx)</th><th>CCT (K)</th><th>호감</th></tr></thead><tbody>'+
   records.slice().reverse().map(x=>'<tr><td>'+esc(x.date||'—')+'</td><td>'+esc(x.experimenterCode||(db.experimenters||[]).find(y=>y.id===x.experimenterId)?.code||'미지정')+'</td><td>'+esc(x.code||'—')+'</td><td>'+esc(x.stage||'—')+'<br><small>'+esc(x.sensoryName||x.condition||'—')+'</small></td>'+
   ['valence','arousal','hr','eda','lux','cct','liking'].map(k=>'<td>'+esc(x[k]!==''&&x[k]!=null?x[k]:'—')+'</td>').join('')+'</tr>').join('')+
   '</tbody></table></div>':'<div class="empty">선택한 실험자의 기록이 없습니다.</div>');
}


function sessionSelectorOptions(items,label){
 return '<option value="">'+label+'</option>'+items.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
}
function sessionViews(){
 const records=db.sessions||[];
 const participants=[...new Set(records.map(x=>String(x.code||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
 const environments=[...new Map(records.filter(x=>x.sensoryId||x.sensoryName||x.condition).map(x=>[x.sensoryId||'name:'+String(x.sensoryName||x.condition),{id:x.sensoryId||'name:'+String(x.sensoryName||x.condition),name:x.sensoryName||x.condition||'미지정',type:x.sensoryType||stageToSensory(x.stage)||''}])).values()];
 return '<div class="session-compare-grid"><section class="panel session-compare-panel"><h2>참가자별 세션 기록</h2><p class="muted">익명 참가자 코드를 선택하면 해당 참가자의 1차·2차 실험 기록만 조회합니다.</p><div class="actions"><select id="session-participant-filter" style="max-width:260px" aria-label="참가자 코드 선택">'+sessionSelectorOptions(participants,'참가자 선택')+'</select><select id="session-participant-stage" style="max-width:180px" aria-label="실험 차수 선택"><option value="">전체 실험</option><option value="1차">1차</option><option value="2차">2차</option><option value="예비">예비실험</option></select></div><div id="session-participant-results" style="margin-top:14px"></div></section>'+
 '<section class="panel session-compare-panel"><h2>감각 환경별 반응 비교</h2><p class="muted">환경별 참가자 반응과 대화 정보를 비교합니다.</p><div class="actions"><select id="session-environment-filter" aria-label="감각 환경 선택" style="max-width:340px"><option value="">감각 환경 선택</option>'+environments.map(x=>'<option value="'+esc(x.id)+'">'+esc(sensoryLabel(x.type)+' · '+x.name)+'</option>').join('')+'</select><select id="session-environment-stage" aria-label="실험 차수 선택" style="max-width:180px"><option value="">전체 실험</option><option value="1차">1차</option><option value="2차">2차</option><option value="예비">예비실험</option></select></div><div id="session-environment-results" style="margin-top:14px"></div></section></div>';
}
function stageMatches(stage,prefix){return !prefix||String(stage||'').startsWith(prefix)}
function numberSummary(items,key){const xs=items.map(x=>x[key]).filter(v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);return xs.length?(xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(2):'—'}
function resultTable(items){
 if(!items.length)return '<div class="empty">해당 조건의 기록이 없습니다.</div>';
 const measures=[['세션 수',String(items.length)],['쾌·불쾌 평균',numberSummary(items,'valence')],['각성 평균',numberSummary(items,'arousal')],['심박수 평균',numberSummary(items,'hr')],['대인 호감 평균',numberSummary(items,'liking')]];
 const cards=items.slice().reverse().map(x=>
   '<article class="session-result-card"><div class="session-result-title"><strong>'+esc(x.code||'—')+'</strong><span>'+esc(x.date||'—')+' · '+esc(x.stage||'—')+'</span></div>'+
   '<div class="session-result-environment">'+esc(x.sensoryName||x.condition||'감각 환경 미지정')+'</div>'+
   '<div class="session-result-grid">'+[
    ['자극 전 느낌',x.preFeeling||'—'],['자극 후 느낌',x.postFeeling||'—'],
    ['쾌·불쾌 전 → 후',(x.preValence||'—')+' → '+(x.valence||'—')],
    ['각성 전 → 후',(x.preArousal||'—')+' → '+(x.arousal||'—')],
    ['평균 심박수',x.hr?x.hr+' bpm':'—'],['GSR 추정',x.eda?x.eda+' µS':'—'],
    ['대화 상대',x.partner||'—'],['대화 주제',x.conversationTopic||'—'],
    ['대인 호감',x.liking||'—'],['실험실 구간',x.labRunId?'구간 '+(x.labSegment||'')+' · '+(x.labSegmentName||''):'—'],['GSR ADC 평균',x.gsrAdcMean??'—'],['보정 EDA 평균',x.eda!==''&&x.eda!=null?x.eda+' µS':'—'],['ADC 샘플 수',x.gsrSampleCount??'—']
   ].map(([label,value])=>'<div class="session-result-detail"><small>'+label+'</small><span>'+esc(value)+'</span></div>').join('')+'</div></article>'
 ).join('');
 return '<div class="session-compact-metrics">'+measures.map(([name,v])=>'<div class="stat"><div class="label">'+name+'</div><div class="num">'+v+'</div></div>').join('')+'</div><div class="session-result-list">'+cards+'</div>';
}
function renderSessionViews(){
 const p=document.getElementById('session-participant-filter'),e=document.getElementById('session-environment-filter');
 if(!p||!e)return;
 const pr=document.getElementById('session-participant-results'),er=document.getElementById('session-environment-results');
 const records=db.sessions||[];
 pr.innerHTML=p.value?resultTable(records.filter(x=>String(x.code||'').trim()===p.value&&stageMatches(x.stage,document.getElementById('session-participant-stage').value))):'<div class="empty">참가자 코드를 선택하면 개인별 기록이 표시됩니다.</div>';
 er.innerHTML=e.value?resultTable(records.filter(x=>(x.sensoryId||'name:'+String(x.sensoryName||x.condition))===e.value&&stageMatches(x.stage,document.getElementById('session-environment-stage').value))):'<div class="empty">감각 환경을 선택하면 참가자별 반응이 표시됩니다.</div>';
}



function pilotSessionPanel(){
 const runs=(db.pilotRuns||[]).filter(r=>r&&r.mode==='pilot'&&r.startedAt&&r.endedAt).slice().reverse();
 return '<section class="panel lab-import-panel pilot-session-panel"><div class="entry-head" style="flex-wrap:wrap;align-items:center"><div><h2>개인 예비실험 결과 조회</h2><p class="muted">예비실험의 구간별 반응과 GSR 원시값을 비교해 볼 수 있어요.</p></div><span class="pill">정식 세션과 분리</span></div>'+
 '<div class="notice">예비실험은 조회만 가능하며 정식 1·2차 세션이나 결과 통계에 포함되지 않습니다. 측정값은 보정되지 않은 ADC 원시값입니다.</div>'+
 (runs.length?
 '<div class="formgrid"><div class="field"><label>개인 예비실험</label><select id="pilot-session-run"><option value="">예비실험 선택</option>'+runs.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.date||'날짜 미상')+' · '+esc(r.code||'개인')+' · '+(r.steps||[]).length+'개 구간</option>').join('')+'</select></div>'+
 '<div class="field"><label>분석할 구간</label><select id="pilot-session-step"><option value="">먼저 예비실험을 선택하세요</option></select></div>'+
 '<div class="field"><label>분석 범위</label><select id="pilot-session-range"><option value="all">구간 전체</option><option value="first60">구간 시작 후 60초</option><option value="last60">구간 종료 전 60초</option><option value="custom60">사용자 지정 60초</option></select></div>'+
 '<div class="field"><label>시작 시점 (구간 시작 후 초)</label><input id="pilot-session-offset" type="number" min="0" step="1" value="0" disabled></div></div>'+
 '<div id="pilot-session-comparison" class="segment-compare"><div class="empty">예비실험을 선택하면 구간별 결과를 비교할 수 있습니다.</div></div><div id="pilot-session-preview" class="lab-import-preview"><div class="empty">예비실험을 선택하면 구간별 기록을 확인할 수 있습니다.</div></div>':
 '<div class="empty">저장된 개인 예비실험이 없습니다. 실험실에서 개인 예비실험을 종료·저장하면 여기에 표시됩니다.</div>')+'</section>';
}
function pilotSessionSelection(){
 const runId=document.getElementById('pilot-session-run')?.value;
 const run=(db.pilotRuns||[]).find(r=>r.id===runId&&r.mode==='pilot'&&r.endedAt);
 const stepSelect=document.getElementById('pilot-session-step');
 const index=stepSelect?.value===''?NaN:Number(stepSelect?.value);
 const step=Number.isInteger(index)&&index>=0?run?.steps?.[index]:null;
 return {run,step};
}
function pilotSessionChanged(id){
 const select=document.getElementById('pilot-session-run');
 if(id==='pilot-session-run'&&select){
  const run=(db.pilotRuns||[]).find(x=>x.id===select.value&&x.mode==='pilot');
  const step=document.getElementById('pilot-session-step');
  if(step)step.innerHTML='<option value="">구간 선택</option>'+(run?.steps||[]).map((s,i)=>s.startedAt&&s.endedAt?'<option value="'+i+'">'+esc(s.label)+' · '+esc(s.envName||s.name)+'</option>':'').join('');
 }
 const range=document.getElementById('pilot-session-range'),offset=document.getElementById('pilot-session-offset');
 if(offset)offset.disabled=range?.value!=='custom60';
 pilotSessionPreview();renderAllSegmentComparisons();
}
function pilotSessionPreview(){
 const root=document.getElementById('pilot-session-preview');if(!root)return;
 const {run,step}=pilotSessionSelection();
 if(!run||!step){root.innerHTML='<div class="empty">예비실험과 구간을 선택해 주세요.</div>';return}
 const range=document.getElementById('pilot-session-range')?.value||'all';
 const offset=Number(document.getElementById('pilot-session-offset')?.value||0);
 const selection=labImportPoints(run,step,range,offset);
 if(!selection){root.innerHTML='<div class="empty">선택한 시작 시점이 구간 길이를 벗어났습니다.</div>';return}
 const stats=labImportStats(selection.points);
 const elapsed=((selection.end-selection.start)/1000).toFixed(1);
 root.innerHTML='<div class="lab-import-heading"><strong>'+esc(run.code||'개인')+' · '+esc(step.label)+'구간</strong><span>'+esc(step.envName||step.name)+' · '+elapsed+'초</span></div>'+
 '<div class="lab-import-metrics">'+[['ADC 샘플 수',stats?.count??0],['ADC 평균',stats?.mean??'—'],['ADC 최솟값',stats?.min??'—'],['ADC 최댓값',stats?.max??'—']].map(([a,b])=>'<div><small>'+a+'</small><strong>'+esc(b)+'</strong></div>').join('')+'</div>'+
 '<div class="pilot-session-observation"><strong>구간 정보</strong><p>구간 시작: '+esc(new Date(step.startedAt).toLocaleString('ko-KR'))+'</p><p>구간 종료: '+esc(new Date(step.endedAt).toLocaleString('ko-KR'))+'</p><p>관찰 메모: '+esc(step.note||'기록 없음')+'</p></div>'+
 (!stats?'<p class="muted">이 구간에는 수집된 GSR 원시값이 없으며, 구간 시각과 메모만 확인할 수 있습니다.</p>':'');
}


function segmentCompareHtml(run,range,offset){
 if(!run||!Array.isArray(run.steps))return '<div class="empty">실험 기록을 선택하면 모든 구간의 평균·최솟값·최댓값을 비교할 수 있어요.</div>';
 const rows=run.steps.filter(s=>s.startedAt&&s.endedAt).map(s=>{
  const selection=labImportPoints(run,s,range,offset);
  const stats=selection?labImportStats(selection.points):null;
  return {segment:s,stats,valid:!!selection};
 });
 if(!rows.length)return '<div class="empty">시간이 기록된 구간이 없습니다.</div>';
 const header='<div class="segment-compare-head"><h3>구간별 측정값 비교</h3><span>Arduino ADC 원시값 · 0~1023</span></div>';
 const table='<div class="segment-compare-table"><table><thead><tr><th>구간</th><th>평균</th><th>최솟값</th><th>최댓값</th><th>샘플</th></tr></thead><tbody>'+
 rows.map(({segment:s,stats,valid})=>'<tr><th scope="row"><strong>'+esc(s.label)+'</strong> <small>'+esc(s.envName||s.name||'환경 미지정')+'</small></th><td>'+(stats?esc(stats.mean):'—')+'</td><td>'+(stats?esc(stats.min):'—')+'</td><td>'+(stats?esc(stats.max):'—')+'</td><td>'+(stats?esc(stats.count):'—')+'</td></tr>').join('')+'</tbody></table></div>';
 const bars='<div class="segment-compare-chart">'+rows.map(({segment:s,stats})=>
   '<div class="segment-compare-row"><div class="segment-compare-label"><strong>'+esc(s.label)+'</strong><small>'+esc(s.envName||s.name||'')+'</small></div>'+
   (stats?'<div class="segment-compare-bars">'+[
     ['최솟값',stats.min,'min'],['평균',stats.mean,'avg'],['최댓값',stats.max,'max']
   ].map(([label,val,cls])=>'<div class="segment-compare-barline"><span>'+label+'</span><div class="segment-compare-track"><div class="segment-compare-fill '+cls+'" style="width:'+Math.max(0,Math.min(100,100*Number(val)/1023)).toFixed(2)+'%"></div></div><b>'+esc(val)+'</b></div>').join('')+'</div>':'<span class="muted">측정값 없음</span>')+'</div>').join('')+'</div>';
 return header+table+bars+'<p class="muted segment-compare-note">각 구간에서 선택한 분석 범위를 적용했어요. 측정값이 없는 구간은 평균을 계산하지 않습니다. 이 그래프는 피부전도도(µS)가 아닌 보정 전 ADC 비교입니다.</p>';
}
function renderAllSegmentComparisons(){
 const official=document.getElementById('lab-import-comparison');
 if(official){
  const id=document.getElementById('lab-import-run')?.value;
  const run=labOfficialRunOptions().find(x=>x.id===id);
  const range=document.getElementById('lab-import-range')?.value||'all';
  const offset=Number(document.getElementById('lab-import-offset')?.value||0);
  official.innerHTML=segmentCompareHtml(run,range,offset);
 }
 const pilot=document.getElementById('pilot-session-comparison');
 if(pilot){
  const id=document.getElementById('pilot-session-run')?.value;
  const run=(db.pilotRuns||[]).find(x=>x.id===id&&x.mode==='pilot');
  const range=document.getElementById('pilot-session-range')?.value||'all';
  const offset=Number(document.getElementById('pilot-session-offset')?.value||0);
  pilot.innerHTML=segmentCompareHtml(run,range,offset);
 }
}

function labOfficialRunOptions(){
 return (db.labRuns||[]).filter(r=>r&&(r.mode==='stage1'||r.mode==='stage2')&&r.startedAt&&r.endedAt).slice().reverse();
}
function labImportPanel(){
 const runs=labOfficialRunOptions();
 return '<section class="panel lab-import-panel"><div class="entry-head" style="flex-wrap:wrap;align-items:center"><div><h2>실험실 기록 불러오기</h2><p class="muted">1·2차 실험실 기록에서 구간과 분석할 시간을 골라 세션에 저장해요.</p></div><span class="pill">정식 실험 전용</span></div>'+
 '<div class="notice">개인 예비실험은 제외됩니다. GSR은 보정 전 Arduino ADC 원시값이며 µS(피부전도도)가 아닙니다. 세션 저장 시 선택한 구간의 측정값과 요약 통계를 복사해 보존합니다.</div>'+
 (runs.length?'<form data-form="labSessionImport" id="lab-import-form">'+
 '<div class="formgrid"><div class="field"><label>실험실 기록</label><select id="lab-import-run" name="runId" required><option value="">실험 기록 선택</option>'+runs.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.date||'날짜 미상')+' · '+esc(r.code||'참가자 미상')+' · '+esc(labModeName(r.mode))+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>분석할 구간</label><select id="lab-import-step" name="stepIndex" required><option value="">먼저 실험 기록을 선택하세요</option></select></div>'+
 '<div class="field"><label>분석 범위</label><select id="lab-import-range" name="range"><option value="all">구간 전체</option><option value="first60">구간 시작 후 60초</option><option value="last60">구간 종료 전 60초</option><option value="custom60">사용자 지정 시작점부터 60초</option></select></div>'+
 '<div class="field"><label>구간 시작 후 경과 시간(초)</label><input id="lab-import-offset" name="offset" type="number" value="0" min="0" step="1" disabled></div>'+
 '<div class="field"><label>실험 단계</label><select id="lab-import-stage" name="stage"><option value="1차-시각">1차-시각</option><option value="1차-청각">1차-청각</option><option value="1차-후각">1차-후각</option><option value="2차-대화">2차-대화</option></select></div>'+
 '<div class="field"><label>담당 실험자</label><select name="experimenterId">'+experimenterOptions()+'</select></div></div>'+
 '<div id="lab-import-comparison" class="segment-compare"><div class="empty">실험 기록을 선택하면 구간별 결과를 비교할 수 있습니다.</div></div><div class="lab-eda-calibration"><label for="lab-import-calibration">GSR 무착용 기준 ADC 값 (선택)</label><input id="lab-import-calibration" type="number" name="calibrationAdc" min="1" max="1023" step="1" placeholder="무착용 상태의 보정값"><p class="muted">센서 제조사의 보정 절차로 측정한 기준값을 입력하면 선택 구간의 ADC를 EDA(µS) 추정값으로 변환합니다. 보정값이 없으면 원시 ADC 통계만 저장합니다.</p></div><div id="lab-import-preview" class="lab-import-preview"><div class="empty">실험 기록과 구간을 선택하면 측정 결과가 표시됩니다.</div></div>'+
 '<details class="lab-import-extra"><summary>정서·대화 정보 함께 입력하기 (선택)</summary><div class="formgrid">'+
 [['preValence','자극 전 쾌·불쾌'],['valence','자극 후 쾌·불쾌'],['preArousal','자극 전 각성'],['arousal','자극 후 각성'],['liking','대인 호감']].map(([key,label])=>'<div class="field"><label>'+label+' (1~9)</label><input name="'+key+'" type="number" min="1" max="9" step="1"></div>').join('')+
 '<div class="field"><label>평균 심박수 (bpm, 별도 측정)</label><input name="hr" type="number" min="30" max="240" step="0.1"></div>'+
 '<div class="field"><label>대화 상대 코드</label><input name="partner" maxlength="60" placeholder="상대 코드"></div>'+
 '<div class="field"><label>대화 주제</label><input name="conversationTopic" maxlength="180" placeholder="대화 주제"></div></div>'+
 '<div class="field"><label>자극 전 느낌</label><textarea name="preFeeling"></textarea></div><div class="field"><label>자극 후 느낌</label><textarea name="postFeeling"></textarea></div>'+
 '<div class="field"><label>추가 메모</label><textarea name="memo"></textarea></div></details>'+
 '<button type="submit" class="btn">선택한 구간을 세션에 저장</button></form>':
 '<div class="empty">아직 저장된 정식 실험이 없어요. 실험실에서 1차 또는 2차 실험을 종료·저장하면 여기에 나타납니다. 개인 예비실험은 가져오지 않아요.</div>')+'</section>';
}
function labImportSelection(){
 const r=document.getElementById('lab-import-run');
 const s=document.getElementById('lab-import-step');
 if(!r||!s)return {run:null,step:null,idx:-1};
 const run=labOfficialRunOptions().find(x=>x.id===r.value);
 const idx=Number(s.value);
 const step=s.value!==''&&Number.isInteger(idx)?run?.steps?.[idx]:null;
 return {run:run||null,step:step||null,idx};
}
function labImportChanged(which){
 if(which==='run'){
   const r=document.getElementById('lab-import-run'),s=document.getElementById('lab-import-step');
   const run=labOfficialRunOptions().find(x=>x.id===r.value);
   s.innerHTML='<option value="">구간 선택</option>'+(run?.steps||[]).filter(x=>x.startedAt&&x.endedAt).map(x=>{const index=run.steps.indexOf(x);return '<option value="'+index+'">'+esc(x.label)+' · '+esc(x.envName||x.name)+' ('+Math.max(0,Math.round((x.endedAt-x.startedAt)/1000))+'초)</option>'}).join('');
   const stage=document.getElementById('lab-import-stage');
   if(stage){stage.value=run?.mode==='stage2'?'2차-대화':'1차-시각'}
 }
 const range=document.getElementById('lab-import-range'),offset=document.getElementById('lab-import-offset');
 if(offset)offset.disabled=range?.value!=='custom60';
 labRenderImportPreview();renderAllSegmentComparisons();
}
function labImportPoints(run,step,range,offset){
 if(!run||!step||!step.startedAt||!step.endedAt)return {points:[],start:0,end:0};
 const a=Number(step.startedAt),b=Number(step.endedAt);
 let start=a,end=b;
 if(range==='first60')end=Math.min(b,a+60000);
 if(range==='last60')start=Math.max(a,b-60000);
 if(range==='custom60'){
   if(!Number.isFinite(offset)||offset<0||offset>(b-a)/1000)return null;
   start=a+offset*1000;end=Math.min(b,start+60000);
 }
 const points=(Array.isArray(run.gsrSamples)?run.gsrSamples:[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[1]>=0&&p[1]<=1023&&p[0]>=start&&p[0]<end).map(p=>[p[0],p[1]]);
 return {points,start,end};
}
function labImportStats(points){
 if(!points.length)return null;
 let sum=0,min=Infinity,max=-Infinity;
 for(const p of points){sum+=p[1];min=Math.min(min,p[1]);max=Math.max(max,p[1])}
 return {count:points.length,mean:Number((sum/points.length).toFixed(2)),min,max};
}
function labImportValues(){
 const {run,step,idx}=labImportSelection();
 const range=document.getElementById('lab-import-range')?.value||'all';
 const offset=Number(document.getElementById('lab-import-offset')?.value||'0');
 const sampled=labImportPoints(run,step,range,offset);
 return {run,step,idx,range,offset,sampled,stats:sampled?labImportStats(sampled.points):null};
}

function edaFromAdc(points,calibration){
 if(!Number.isInteger(calibration)||calibration<1||calibration>1023||!points.length)return null;
 const values=[];
 for(const [timestamp,adc] of points){
  if(!Number.isFinite(adc)||adc<0||adc>=calibration)return null;
  const resistance=((1024+2*adc)*10000)/(calibration-adc);
  if(!Number.isFinite(resistance)||resistance<=0)return null;
  values.push(1000000/resistance);
 }
 const avg=values.reduce((a,b)=>a+b,0)/values.length;
 return {mean:Number(avg.toFixed(4)),min:Number(Math.min(...values).toFixed(4)),max:Number(Math.max(...values).toFixed(4)),count:values.length};
}
function edaCalibrationFromForm(){
 const el=document.getElementById('lab-import-calibration');
 if(!el||el.value.trim()==='')return null;
 const n=Number(el.value);
 return Number.isInteger(n)&&n>=1&&n<=1023?n:null;
}

function labRenderImportPreview(){
 const root=document.getElementById('lab-import-preview');if(!root)return;
 const x=labImportValues();
 if(!x.run||!x.step){root.innerHTML='<div class="empty">실험 기록과 구간을 선택하면 측정 결과가 표시됩니다.</div>';return}
 if(!x.sampled){root.innerHTML='<div class="empty">선택한 시작 시간이 구간 길이를 벗어났습니다.</div>';return}
 const sec=((x.sampled.end-x.sampled.start)/1000).toFixed(1);
 const calibration=edaCalibrationFromForm();const derived=calibration===null?null:edaFromAdc(x.sampled.points,calibration);
 root.innerHTML='<div class="lab-import-heading"><strong>'+esc(x.run.code)+' · 구간 '+esc(x.step.label)+'</strong><span>'+esc(x.step.envName||x.step.name)+' · '+sec+'초</span></div>'+
 '<div class="lab-import-metrics">'+[['샘플 수',x.stats?x.stats.count:'0'],['ADC 평균',x.stats?x.stats.mean:'—'],['최솟값',x.stats?x.stats.min:'—'],['최댓값',x.stats?x.stats.max:'—']].map(([a,b])=>'<div><small>'+a+'</small><strong>'+b+'</strong></div>').join('')+'</div>'+
 '<div class="lab-eda-preview"><strong>보정 EDA 평균 (µS): '+(derived?esc(derived.mean):'—')+'</strong><small>'+(derived?'공식 센서 환산식에 기반한 추정값 · '+derived.count+'개 측정값':calibration===null?'보정값 미입력 · ADC로만 저장':'보정값이 부적합하거나 해당 범위의 측정값이 없습니다.')+'</small></div>'+ 
 (x.stats?'<p class="muted">선택한 구간의 원시 ADC 샘플을 함께 복사하여 보관합니다.</p>':'<p class="muted">이 범위에는 GSR 측정값이 없습니다. 구간 시각과 관찰 메모만 세션에 저장할 수 있습니다.</p>');
}
function labImportSubmit(vals){
 const x=labImportValues();
 if(!x.run||!x.step||!x.sampled||!['stage1','stage2'].includes(x.run.mode))return alert('실험 기록과 구간, 시간 범위를 확인하세요.');
 if(x.run.mode==='stage1'&&!['1차-시각','1차-청각','1차-후각'].includes(vals.stage))return alert('1차 실험 단계를 선택해 주세요.');
 if(x.run.mode==='stage2'&&vals.stage!=='2차-대화')return alert('2차 실험 단계를 선택해 주세요.');
 const selectedType=stageToSensory(vals.stage);
 const env=(db.sensoryEnvironments||[]).find(y=>y.id===x.step.envId);
 if(env&&selectedType&&env.type!==selectedType)return alert('구간의 감각 환경과 실험 단계가 일치하지 않습니다.');
 for(const k of ['valence','arousal','preValence','preArousal','liking'])if(vals[k]!==''&&(!Number.isInteger(Number(vals[k]))||Number(vals[k])<1||Number(vals[k])>9))return alert('정서 점수는 1~9의 정수여야 합니다.');
 if(vals.hr!==''&&(!Number.isFinite(Number(vals.hr))||Number(vals.hr)<30||Number(vals.hr)>240))return alert('심박수 입력값을 확인하세요.');
 const key=[x.run.id,x.idx,x.range,x.range==='custom60'?x.offset:''].join(':');
 if((db.sessions||[]).some(y=>y.labImportKey===key)&&!confirm('동일한 실험 구간과 시간 범위가 이미 저장되어 있습니다. 추가 기록을 생성할까요?'))return;
 const calibration=vals.calibrationAdc===''?null:Number(vals.calibrationAdc);
 if(calibration!==null&&(!Number.isInteger(calibration)||calibration<1||calibration>1023))return alert('GSR 보정 기준값은 1~1023의 정수로 입력하세요.');
 const eda=calibration===null?null:edaFromAdc(x.sampled.points,calibration);
 if(calibration!==null&&!eda)return alert('이 구간의 ADC 값으로 EDA를 환산할 수 없습니다. 기준값이 모든 측정 ADC보다 크고 보정 절차가 정확한지 확인하세요.');
 const experimenter=(db.experimenters||[]).find(e=>e.id===vals.experimenterId);
 const item={id:String(Date.now())+'-'+Math.random().toString(36).slice(2,7),
  date:x.run.date||dateNow(),code:x.run.code, title:x.run.code,stage:vals.stage,
  experimenterId:experimenter?.id||'',experimenterCode:experimenter?.code||'',
  sensoryId:x.step.envId||'',sensoryName:x.step.envName||env?.name||x.step.name,
  sensoryType:env?.type||selectedType||'',condition:x.step.name,
  preValence:vals.preValence||'',valence:vals.valence||'',preArousal:vals.preArousal||'',arousal:vals.arousal||'',
  hr:vals.hr||'',eda:eda?String(eda.mean):'',edaSource:eda?'Seeed Grove GSR manufacturer resistance formula':'',edaCalibrationAdc:calibration,edaMin:eda?.min??null,edaMax:eda?.max??null,lux:'',cct:'',liking:vals.liking||'',partner:vals.partner||'',conversationTopic:vals.conversationTopic||'',
  preFeeling:vals.preFeeling||'',postFeeling:vals.postFeeling||'',memo:[x.step.note||'',vals.memo||''].filter(Boolean).join('\n'),
  labRunId:x.run.id,labStepIndex:x.idx,labSegment:x.step.label,labSegmentName:x.step.name,labImportKey:key,
  labWindow:x.range,labWindowOffset:x.range==='custom60'?x.offset:null,labWindowStart:x.sampled.start,labWindowEnd:x.sampled.end,
  gsrUnit:'ADC raw (0-1023)',gsrSampleCount:x.stats?.count||0,
  gsrAdcMean:x.stats?.mean??null,gsrAdcMin:x.stats?.min??null,gsrAdcMax:x.stats?.max??null,
  gsrRawSamples:x.sampled.points};
 db.sessions.push(item);
 if(!save()){db.sessions.pop();return}
 render();
 alert('실험실 구간 기록을 세션에 저장했습니다.');
}

function sessions(){return head('실험 세션 기록','실험자 코드와 등록한 감각 환경을 연결하고 결과를 비교합니다. 참가자는 익명 코드만 사용하세요.','04 / SESSION LOG')+`<div class="lab-import-split"><div class="lab-import-half">${labImportPanel()}</div><div class="lab-import-half">${pilotSessionPanel()}</div></div>${experimenterManager()}<div class="notice">이 양식은 세션 단위의 비식별 요약만 기록합니다. 이름, 연락처, 건강 정보, 원시 생체 시계열 데이터는 입력하지 마세요. 실제 민감 자료는 별도 안전한 위치에서 관리해야 합니다.</div><div class="twocol"><section class="panel"><h2>세션 추가</h2><form data-form="sessions"><div class="formgrid"><div class="field"><label>실험일</label><input name="date" type="date" value="${dateNow()}" required></div><div class="field"><label>참가자 코드</label><input name="code" placeholder="P01" required maxlength="30"></div><div class="field"><label>실험자(진행자) 코드</label><select name="experimenterId">${experimenterOptions()}</select></div><div class="field"><label>실험 단계</label><select name="stage" id="session-stage"><option>1차-시각</option><option>1차-청각</option><option>1차-후각</option><option>2차-대화</option><option>예비실험</option></select></div><div class="field"><label>등록한 감각 환경</label><select name="sensoryId" id="session-sensory-id">${sensorySessionOptions("visual")}</select></div><div class="field"><label>환경 조건 / 실험군 코드</label><input name="condition" placeholder="V1 / A1 / O1 / 환경 A"></div><div class="field"><label>자극 전 쾌·불쾌 (1~9)</label><input type="number" min="1" max="9" step="1" name="preValence"></div><div class="field"><label>자극 전 각성 (1~9)</label><input type="number" min="1" max="9" step="1" name="preArousal"></div><div class="field"><label>쾌·불쾌 (1~9)</label><input type="number" min="1" max="9" step="1" name="valence"></div><div class="field"><label>각성 (1~9)</label><input type="number" min="1" max="9" step="1" name="arousal"></div><div class="field"><label>평균 심박수 (bpm)</label><input type="number" min="30" max="240" step="0.1" name="hr"></div><div class="field"><label>보정 EDA 추정값 (µS)</label><input type="number" min="0" step="any" name="eda"></div><div class="field"><label>조도 (lx)</label><input type="number" min="0" step="any" name="lux"></div><div class="field"><label>혼합 CCT (K)</label><input type="number" min="0" step="any" name="cct"></div><div class="field"><label>대인 호감 (1~9, 2차)</label><input type="number" min="1" max="9" step="1" name="liking"></div><div class="field"><label>대화 상대 코드</label><input name="partner" placeholder="상대 A/B/C"></div><div class="field"><label>대화 주제</label><input name="conversationTopic" maxlength="180" placeholder="예: 학교생활과 취미"></div></div><div class="field"><label>자극 전 느낌 · 감각</label><textarea name="preFeeling" placeholder="실험 전 정서와 감각의 주관적 상태 (선택)"></textarea></div><div class="field"><label>자극 후 느낌 · 감각</label><textarea name="postFeeling" placeholder="환경 노출 또는 대화 후 느낀 변화 (선택)"></textarea></div><div class="field"><label>비고</label><textarea name="memo" placeholder="환경 특이 사항, 잡음, 측정 실패 여부"></textarea></div><button class="btn" type="submit">＋ 세션 저장</button></form></section><section class="panel"><h2>저장된 세션</h2>${renderEntries('sessions',x=>`조건: ${esc(x.condition||'미입력')} · 정서: ${esc(x.valence||'-')}/9 · 각성: ${esc(x.arousal||'-')}/9<br>실험자: ${esc(x.experimenterCode||'미지정')} · 환경: ${esc(x.sensoryName||'미지정')}<br>HR: ${esc(x.hr||'-')} bpm · 보정 EDA: ${esc(x.eda||'-')} µS${x.labRunId?`<br>실험실 ${esc(x.labSegment||'')}구간 · ADC 평균 ${esc(x.gsrAdcMean??'측정값 없음')} · ${esc(x.gsrSampleCount??0)}개 샘플${x.eda!==''&&x.eda!=null?` · 보정 EDA ${esc(x.eda)} µS`:''}`:''}<br><small>${esc(x.memo||'')}</small>`)}</section></div>${sessionViews()}${experimenterResults()}`}
function analysis(){const valid=db.sessions.filter(x=>x.valence!==''&&x.arousal!=='');const groups={};valid.forEach(x=>{let c=x.condition||'미분류';(groups[c]??=[]).push(x)});const rows=Object.entries(groups).map(([name,arr])=>({name,n:arr.length,v:arr.reduce((a,x)=>a+Number(x.valence),0)/arr.length,a:arr.reduce((a,x)=>a+Number(x.arousal),0)/arr.length}));return head('분석 및 결과 정리','실험 세션의 기록을 조건별로 집계하고, 가설과 해석상의 한계를 함께 기록합니다.','05 / ANALYSIS')+`<div class="panel"><h2>조건별 정서 요약 <span class="pill">기술통계</span></h2>${rows.length?`<div class="tablewrap"><table><thead><tr><th>조건</th><th>표본 수</th><th>평균 쾌·불쾌</th><th>평균 각성</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.n}</td><td>${x.v.toFixed(2)}</td><td>${x.a.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:18px">쾌·불쾌 평균</h3>${rows.map(x=>`<div class="graphrow"><span>${esc(x.name)}</span><div class="barbg"><div class="bar" style="width:${x.v/9*100}%"></div></div><b>${x.v.toFixed(1)}</b></div>`).join('')}`:'<div class="empty">세션 기록에 조건과 정서 점수를 입력하면 평균이 표시됩니다.</div>'}<div class="notice">여기 표시되는 값은 단순한 기술통계입니다. 무작위 배정, 반복측정, 신뢰구간, 유의성, 대화 상대 효과 등을 자동으로 검증하지 않습니다. n이 작으면 평균 차이를 과장하지 마세요.</div><button class="btn secondary" onclick="exportCSV()">세션 CSV 내려받기</button></div><div class="twocol"><section class="panel"><h2>분석 메모 추가</h2><form data-form="results"><div class="field"><label>분석 일자</label><input type="date" name="date" value="${dateNow()}" required></div><div class="field"><label>분석 제목</label><input name="title" required placeholder="예: 환경 A와 대조군의 쾌·불쾌 점수 비교"></div><div class="field"><label>관찰된 결과 / 계산 방법</label><textarea name="memo" required></textarea></div><div class="field"><label>한계 / 후속 검증</label><textarea name="next"></textarea></div><button class="btn" type="submit">＋ 분석 메모 저장</button></form></section><section class="panel"><h2>분석 기록</h2>${renderEntries('results',x=>esc(x.memo)+(x.next?`<br><small>한계: ${esc(x.next)}</small>`:''))}</section></div>`}
function references(){return head('참고문헌 및 링크','검증된 연구 이론과 측정 장비의 공식 자료를 보관합니다.','06 / LITERATURE')+`<div class="panel"><h2>핵심 참고자료</h2><div class="tablewrap"><table><thead><tr><th>자료</th><th>연구 활용</th><th>연결</th></tr></thead><tbody><tr><td>Russell (1980), A Circumplex Model of Affect</td><td>정서의 쾌·불쾌·각성 차원</td><td><a target="_blank" rel="noopener" href="https://doi.org/10.1037/h0077714">DOI</a></td></tr><tr><td>Bradley & Lang (1994), Measuring Emotion</td><td>SAM 자기평가 척도</td><td><a target="_blank" rel="noopener" href="https://pubmed.ncbi.nlm.nih.gov/7962581/">PubMed</a></td></tr><tr><td>Boucsein et al. (2012), Publication Recommendations for Electrodermal Measurements</td><td>EDA 측정 표준</td><td><a target="_blank" rel="noopener" href="https://pubmed.ncbi.nlm.nih.gov/22680988/">PubMed</a></td></tr><tr><td>Aron et al. (1997), Experimental Generation of Interpersonal Closeness</td><td>구조화된 대화 연구</td><td><a target="_blank" rel="noopener" href="https://doi.org/10.1177/0146167297234003">DOI</a></td></tr><tr><td>Seeed Studio Grove GSR Wiki</td><td>센서 배선·보정·제조사 안내</td><td><a target="_blank" rel="noopener" href="https://wiki.seeedstudio.com/Grove-GSR_Sensor/">공식 위키</a></td></tr><tr><td>GitHub Pages</td><td>웹사이트 게시 방법</td><td><a target="_blank" rel="noopener" href="https://docs.github.com/en/pages">공식 문서</a></td></tr></tbody></table></div></div><div class="twocol"><section class="panel"><h2>참고자료 추가</h2><form data-form="references"><div class="field"><label>자료명</label><input name="title" required placeholder="논문 제목 또는 자료명"></div><div class="field"><label>링크 (https://)</label><input name="url" type="url" placeholder="https://example.com"></div><div class="field"><label>요약 및 활용 목적</label><textarea name="memo"></textarea></div><button class="btn" type="submit">＋ 자료 저장</button></form></section><section class="panel"><h2>추가한 자료</h2>${renderEntries('references',x=>`${esc(x.memo||'')} ${/^https?:\/\//.test(x.url||'')?`<br><a href="${esc(x.url)}" target="_blank" rel="noopener">원문 열기</a>`:''}`)}</section></div>`}
function backup(){return head('기록 백업 및 복원','GitHub Pages는 정적 사이트입니다. 로컬 저장 내용을 주기적으로 파일로 백업하세요.','07 / DATA MANAGEMENT')+`<div class="panel"><h2>공동 작업 전 기존 기록 백업</h2><p>이 컴퓨터에 남아 있던 기존 로컬 기록이 있다면 별도의 백업 파일로 받을 수 있습니다. 기존 로컬 기록은 자동으로 공동 데이터베이스에 업로드하지 않습니다.</p><button type="button" class="btn secondary" onclick="yurifLegacyBackup()">기존 로컬 기록 백업 다운로드</button></div><div class="panel"><h2>기록 내보내기</h2><p>연구 일지, 장비 기록, 세션 요약, 분석 메모, 참고자료를 한 파일에 백업합니다. 이 데이터는 현재 브라우저에만 저장됩니다.</p><div class="actions"><button class="btn" onclick="exportJSON()">전체 기록 JSON 다운로드</button><button class="btn secondary" onclick="exportCSV()">실험 세션 CSV 다운로드</button></div></div><div class="panel"><h2>기록 복원하기</h2><p>이전에 다운로드한 JSON 파일을 선택하면 연구 일지·감각 환경·실험자·실험실 기록을 포함한 기존 브라우저 기록을 <b>모두 대체</b>합니다. 복원 전에 현재 기록을 백업하세요.</p><input class="fileinput" id="restorefile" type="file" accept="application/json,.json"><button class="btn secondary" id="restorebtn">파일에서 복원</button></div><div class="notice">GitHub 공개 저장소에는 이름, 연락처, 동의서, 원시 EDA/심박 신호, 개인별 응답을 올리지 마세요. 공개 사이트에 데이터를 입력해도 업로드되지는 않지만 공유 기기에서는 브라우저 기록을 다른 사람이 볼 수 있습니다. 브라우저 저장은 암호화된 개인정보 보관소가 아닙니다.</div><div class="panel"><h2>GitHub Pages 게시 안내</h2><ol><li>현재 저장소 <code>chaeah27/2026-You-</code>를 사용하고 있습니다.</li><li>이 ZIP의 파일들을 저장소 최상위에 업로드하세요.</li><li><code>Settings → Pages → Build and deployment</code>에서 <code>Deploy from a branch</code>를 선택하세요.</li><li><code>main</code> 브랜치의 <code>/(root)</code>를 선택한 뒤 저장하세요.</li><li>게시된 주소는 보통 <code>https://chaeah27.github.io/2026-You-/</code> 형태입니다.</li></ol><p class="muted">공개 연구 요약은 저장소 파일로 공유할 수 있지만, 브라우저에 입력한 기록은 자동으로 GitHub에 동기화되지 않습니다.</p></div>`}

/* Laboratory: pilot runs are kept separate from official experiment sessions. */
const LAB_DRAFT_KEY='yurif_lab_draft_v1';
let labDraft=null;
try{const stored=JSON.parse(localStorage.getItem(LAB_DRAFT_KEY));if(stored&&Array.isArray(stored.steps))labDraft=stored}catch{}
let labClock=null;
function labSaveDraft(){try{localStorage.setItem(LAB_DRAFT_KEY,JSON.stringify(labDraft))}catch{alert('진행 중인 실험 정보를 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요.')}}
function labTime(t){if(!t)return '—';const seconds=Math.max(0,Math.floor((Date.now()-t)/1000));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}
function labDuration(a,b){if(!a)return '—';const sec=Math.max(0,Math.floor(((b||Date.now())-a)/1000));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function labEnvOptions(){return '<option value="">환경 직접 기입 / 일반 구간</option>'+(db.sensoryEnvironments||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(sensoryLabel(x.type)+' · '+x.name)+'</option>').join('')}
function labDefaults(mode){return mode==='stage2'?[{label:'A',name:'일반 교실 안정',envId:'',target:120},{label:'B',name:'환경 노출',envId:'',target:180},{label:'C',name:'실제 대화',envId:'',target:300},{label:'D',name:'대화 후 회복',envId:'',target:120}]:[{label:'A',name:'기준 안정 상태',envId:'',target:120},{label:'B',name:'감각 환경 노출',envId:'',target:180},{label:'C',name:'회복',envId:'',target:120}]}
function labModeName(mode){return mode==='pilot'?'개인 예비실험':mode==='stage1'?'1차 감각 실험':'2차 대화 실험'}
function labDraftView(){
 if(!labDraft)return '<div class="empty">실험을 시작하려면 아래에서 실험 종류를 선택하세요.</div>';
 const d=labDraft,active=d.steps.findIndex(x=>x.startedAt&&!x.endedAt),done=d.steps.filter(x=>x.endedAt).length;
 const mode=labModeName(d.mode),running=d.startedAt&&!d.endedAt;
 const table=d.steps.map((s,i)=>'<div class="lab-segment '+(i===active?'lab-segment-active':'')+'"><div class="lab-segment-badge">'+esc(s.label)+'</div><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.envName||'환경 미지정')+' · 목표 '+Number(s.target||0)+'초</small><small>기록 '+labDuration(s.startedAt,s.endedAt)+(s.note?' · '+esc(s.note):'')+'</small></div><div class="lab-segment-state">'+(s.endedAt?'완료':i===active?'진행 중':'대기')+'</div></div>').join('');
 return '<section class="panel"><h2>현재 실험 · '+esc(mode)+'</h2><p class="muted">'+esc(d.code)+' · '+esc(d.date)+' · '+(running?'실험 진행 중':'실험 준비 중')+'</p><div class="lab-timer" id="lab-timer">'+(active<0?'00:00':labDuration(d.steps[active].startedAt))+'</div><p class="muted" id="lab-active-label">'+(active<0?'구간 시작 전':'현재 구간 '+esc(d.steps[active].label)+' · '+esc(d.steps[active].name))+'</p><div class="actions">'+(!running?'<button class="btn" type="button" data-lab-action="start">▶ 실험 시작</button>':active>=0&&active<d.steps.length-1?'<button class="btn" type="button" data-lab-action="next">▶ 다음 구간 표시</button>':'')+(running?'<button class="btn secondary" type="button" data-lab-action="finish">■ 실험 종료·저장</button>':'')+'<button class="btn secondary" type="button" data-lab-action="discard">초안 폐기</button></div><div class="lab-segment-list">'+table+'</div>'+(active>=0?'<div class="field"><label>현재 구간 관찰 메모</label><textarea id="lab-current-note" placeholder="환경 변화, 체감 반응, 특이사항을 자유롭게 기록하세요.">'+esc(d.steps[active].note||'')+'</textarea><button class="btn secondary" type="button" data-lab-action="save-note">메모 저장</button></div>':'')+'<p class="muted">버튼을 누른 시각이 구간 경계로 저장됩니다. 환경 자체를 자동 전환하지는 않으며, Arduino USB 연결 시 해당 구간의 ADC 원시값도 자동으로 기록됩니다.</p></section>';
}
function labEditor(){
 return '<section class="panel"><h2>실험 구간 미리 설정</h2><p class="muted">참가자 코드와 실험 종류를 정한 뒤, 구간 이름·환경·목표 시간을 설정하세요. 예비실험 기록은 공식 실험 세션에 포함되지 않습니다.</p><div class="formgrid"><div class="field"><label>실험 종류</label><select id="lab-mode"><option value="pilot" '+(labArchiveTab==='pilot'?'selected':'')+'>개인 예비실험</option><option value="stage1" '+(labArchiveTab==='stage1'?'selected':'')+'>1차 감각 실험</option><option value="stage2" '+(labArchiveTab==='stage2'?'selected':'')+'>2차 대화 실험</option></select></div><div class="field"><label>참가자 또는 개인 코드</label><input id="lab-code" maxlength="30" value="개인" placeholder="예: P01 / 개인"></div></div><div id="lab-step-editor"></div><div class="actions"><button type="button" class="btn secondary" data-lab-action="add-step">＋ 구간 추가</button><button type="button" class="btn" data-lab-action="create">실험 계획 확정</button></div></section>';
}
let labPlan=labDefaults('pilot');
function labRenderStepEditor(){
 const box=document.getElementById('lab-step-editor');if(!box)return;
 box.innerHTML=labPlan.map((s,i)=>'<div class="lab-editor-row" data-lab-step="'+i+'"><div class="lab-segment-badge">'+String.fromCharCode(65+i)+'</div><div class="lab-editor-inputs"><input aria-label="구간 이름" name="lab-name" value="'+esc(s.name)+'" maxlength="100" placeholder="구간 이름"><select aria-label="감각 환경" name="lab-environment">'+labEnvOptions()+'</select><label class="lab-time-label">목표 초 <input aria-label="구간 목표 시간(초)" name="lab-target" type="number" min="1" max="7200" value="'+Number(s.target||120)+'"></label></div><button type="button" class="lab-remove" data-lab-remove="'+i+'" '+(labPlan.length<=1?'disabled':'')+' aria-label="구간 삭제">×</button></div>').join('');
 box.querySelectorAll('[data-lab-step]').forEach((row,i)=>{row.querySelector('[name="lab-environment"]').value=labPlan[i].envId||''});
}
function labCapturePlan(){
 const root=document.getElementById('lab-step-editor');if(!root)return;
 labPlan=[...root.querySelectorAll('[data-lab-step]')].map((row,i)=>({label:String.fromCharCode(65+i),name:row.querySelector('[name="lab-name"]').value.trim(),envId:row.querySelector('[name="lab-environment"]').value,target:Number(row.querySelector('[name="lab-target"]').value)}));
}
function labArchive(mode){
 const arr=mode==='pilot'?(db.pilotRuns||[]):(db.labRuns||[]).filter(x=>x.mode===mode);
 return '<section class="panel"><h2>'+(mode==='pilot'?'예비실험 아카이브':'정식 실험 진행 이력')+'</h2><p class="muted">'+(mode==='pilot'?'실험 세션과 분리 보관되는 개인 테스트 기록입니다.':'1차·2차 실험의 구간 시각 기록이며, 실험 세션 수치와는 아직 자동 합쳐지지 않습니다.')+'</p>'+
 (arr.length?arr.slice().reverse().map(x=>'<div class="lab-archive-item"><div class="entry-head"><div><strong>'+esc(x.code||'개인')+'</strong><small> · '+esc(x.date)+' · '+esc(labModeName(x.mode))+'</small></div><button type="button" data-lab-delete="'+esc(x.id)+'" data-lab-type="'+esc(mode)+'">삭제</button></div><div class="lab-archive-detail">'+x.steps.map(s=>'<span>'+esc(s.label)+' '+esc(s.name)+' · '+labDuration(s.startedAt,s.endedAt)+(s.note?' · 메모: '+esc(s.note):'')+'</span>').join('')+'</div>'+(typeof gsrArchiveActions==='function'?gsrArchiveActions(x):'')+(mode==='pilot'?'<button type="button" class="btn secondary" data-pilot-session-link="'+esc(x.id)+'">세션 화면에서 예비실험 결과 보기</button>':'<button type="button" class="btn secondary" data-lab-import-link="'+esc(x.id)+'">이 실험을 세션 기록으로 가져오기</button>')+'</div>').join(''):'<div class="empty">저장된 기록이 없습니다.</div>')+'</section>';
}
function lab(){
 const tabs='<div class="lab-tabs"><button type="button" data-lab-tab="pilot" class="'+(labArchiveTab==='pilot'?'active':'')+'">개인 예비실험</button><button type="button" data-lab-tab="stage1" class="'+(labArchiveTab==='stage1'?'active':'')+'">1차 실험</button><button type="button" data-lab-tab="stage2" class="'+(labArchiveTab==='stage2'?'active':'')+'">2차 실험</button></div>';
 return head('실험실','실험 환경의 순서를 미리 지정하고 버튼으로 구간 경계를 기록합니다. 개인 예비실험은 정식 결과와 완전히 분리해 보관합니다.','LAB / EXPERIMENT')+
 '<div class="notice">Arduino GSR 센서의 원시 ADC를 USB로 수집합니다. 피부전도도(µS) 환산은 보정 전까지 지원하지 않습니다. Apple Watch 실시간 연결도 아직 지원하지 않습니다. 측정 중 브라우저 탭과 컴퓨터를 켜 두세요.</div>'+
 (typeof gsrLabPanel==='function'?gsrLabPanel():'')+(labDraft?labDraftView():labEditor())+tabs+labArchive(labArchiveTab);
}
let labArchiveTab='pilot';
function labTick(){
 if(view!=='lab'||!labDraft)return;
 const active=labDraft.steps.find(x=>x.startedAt&&!x.endedAt);
 const node=document.getElementById('lab-timer');
 if(node&&active)node.textContent=labDuration(active.startedAt);
}
function labStart(){
 if(!labDraft)return;
 if(!labDraft.startedAt){const t=Date.now();labDraft.startedAt=t;labDraft.steps[0].startedAt=t;labSaveDraft();render()}
}
function labNext(){
 if(!labDraft||!labDraft.startedAt||labDraft.endedAt)return;
 const i=labDraft.steps.findIndex(x=>x.startedAt&&!x.endedAt);
 if(i<0||i>=labDraft.steps.length-1)return;
 const t=Date.now();labDraft.steps[i].endedAt=t;labDraft.steps[i+1].startedAt=t;labSaveDraft();render();
}
function labFinish(){
 if(!labDraft||!labDraft.startedAt)return;
 if(!confirm('현재 구간을 종료하고 실험 기록을 저장할까요?'))return;
 const t=Date.now();labDraft.endedAt=t;
 const i=labDraft.steps.findIndex(x=>x.startedAt&&!x.endedAt);
 if(i>=0)labDraft.steps[i].endedAt=t;
 if(labDraft.mode==='pilot')db.pilotRuns.push(labDraft);
 else db.labRuns.push(labDraft);
 if(!save()){if(labDraft.mode==='pilot')db.pilotRuns.pop();else db.labRuns.pop();labSaveDraft();return}
 labDraft=null;localStorage.removeItem(LAB_DRAFT_KEY);render();
}

function render(){if(window.yurifCloud?.ready){const label=document.getElementById('cloud-status');if(label)label.textContent=window.yurifCloud.status||'팀 공유 연결됨'}document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));let names={home:'연구 대시보드',protocol:'실험 설계·프로토콜',equipment:'장비·보정 관리',journal:'연구 일지',sessions:'실험 세션 기록',analysis:'분석·결과 정리',references:'참고문헌·링크',lab:'실험실',export:'데이터 백업'};document.getElementById('viewlabel').textContent=names[view];document.getElementById('content').innerHTML=({home,protocol,equipment,journal,sessions,analysis,references,lab,export:backup}[view])();if(view==='sessions'){renderExperimenterResults();renderSessionViews()}if(view==='lab'&&!labDraft)labRenderStepEditor();if(view==='lab'&&typeof gsrRefresh==='function')gsrRefresh();window.scrollTo({top:0,behavior:'instant'});}
function route(v){view=v;render()}window.route=route;window.exportJSON=exportJSON;
window.yurifCloudApply=(type,records)=>{if(!Array.isArray(records)||!Object.hasOwn(defaults,type))return;const prior=new Map((db[type]||[]).filter(x=>x?.id!=null).map(x=>[String(x.id),x]));db[type]=records.map(record=>{const own=prior.get(String(record.id));const merged={...record};if(own&&Array.isArray(own.gsrSamples)&&!Array.isArray(merged.gsrSamples))merged.gsrSamples=own.gsrSamples;if(own&&Array.isArray(own.gsrRawSamples)&&!Array.isArray(merged.gsrRawSamples))merged.gsrRawSamples=own.gsrRawSamples;return merged});try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}if(document.getElementById('content'))render()};
window.yurifCloudGetData=()=>db;
window.yurifLegacyBackup=()=>{const raw=localStorage.getItem('yurif_legacy_precloud_backup');if(!raw)return alert('이 브라우저에 기존 로컬 백업이 없습니다.');download('yurif-before-cloud-'+dateNow()+'.json',JSON.stringify({schema:1,exported_at:new Date().toISOString(),data:JSON.parse(raw)},null,2));};
function exportCSV(){let cols=['date','code','stage','condition','valence','arousal','hr','eda','lux','cct','liking','partner','memo'];const csv=[cols.join(','),...db.sessions.map(r=>cols.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\r\n');download('eureka-sessions-'+dateNow()+'.csv','\ufeff'+csv,'text/csv;charset=utf-8')}window.exportCSV=exportCSV;
document.getElementById('nav').addEventListener('click',e=>{let b=e.target.closest('button[data-view]');if(b)route(b.dataset.view)});document.getElementById('exportQuick').addEventListener('click',exportJSON);
document.getElementById('content').addEventListener('submit',e=>{const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();const type=form.dataset.form;let vals=Object.fromEntries(new FormData(form));if(type==='labSessionImport'){labImportSubmit(vals);return}if(type==='journalBoard'){const existing=db.journalBoard.find(x=>x.id===vals.boardId);if(!['memo','todo','prep'].includes(vals.type)||!vals.title?.trim())return;const item={id:existing?.id||String(Date.now())+'-'+Math.random().toString(36).slice(2,7),type:vals.type,title:vals.title.trim().slice(0,150),detail:(vals.detail||'').trim().slice(0,3000),due:vals.due||'',done:existing?.done||false};if(existing)Object.assign(existing,item);else db.journalBoard.push(item);save();render();return}if(type==='sessions'){for(let k of ['valence','arousal','liking','preValence','preArousal'])if(vals[k]!==''&&(!Number.isInteger(Number(vals[k]))||Number(vals[k])<1||Number(vals[k])>9)){alert(k+' 점수는 1~9의 정수여야 합니다.');return}}if(type==='experimenters'){vals.code=(vals.code||'').trim().slice(0,40);if(!vals.code||db.experimenters.some(x=>x.code===vals.code)){alert('실험자 코드를 확인해 주세요. 이미 사용 중인 코드는 중복 등록할 수 없습니다.');return}}if(type==='sessions'){const exp=db.experimenters.find(x=>x.id===vals.experimenterId);vals.experimenterCode=exp?.code||'';if(!exp)vals.experimenterId='';const env=db.sensoryEnvironments.find(x=>x.id===vals.sensoryId);if(vals.sensoryId&&!env){alert('등록된 감각 환경을 다시 선택해 주세요.');return}if(env&&stageToSensory(vals.stage)&&env.type!==stageToSensory(vals.stage)){alert('실험 단계와 감각 환경 분야가 일치하지 않습니다.');return}vals.sensoryName=env?.name||'';vals.sensoryType=env?.type||''}if(type==='sensoryEnvironments'){if(!sensoryTypes[vals.type]||!vals.name?.trim())return;vals.name=vals.name.trim().slice(0,100);db.sensoryEnvironments??=[];if(db.sensoryEnvironments.some(x=>x.type===vals.type&&x.name===vals.name)){alert('같은 분야에 이미 등록된 환경 이름입니다.');return}}if(type==='journal'){if(vals.sensoryType&&!sensoryTypes[vals.sensoryType])return;const match=(db.sensoryEnvironments||[]).find(x=>x.id===vals.sensoryId&&x.type===vals.sensoryType);vals.sensoryName=match?.name||'';if(vals.sensoryType&&!match&&vals.sensoryId){alert('등록된 감각 환경을 다시 선택해 주세요.');return}if(!vals.sensoryType){vals.sensoryId='';vals.sensoryName=''}}if(type==='references')vals.date=dateNow();vals.id=String(Date.now())+'-'+String(Math.random()).slice(2,7);if(type==='sessions')vals.title=vals.code;if(!db[type])return;db[type].push(vals);save();render()});
document.getElementById('content').addEventListener('change',e=>{if(['pilot-session-run','pilot-session-step','pilot-session-range','pilot-session-offset'].includes(e.target.id)){pilotSessionChanged(e.target.id);return}if(['lab-import-run','lab-import-step','lab-import-range','lab-import-offset'].includes(e.target.id)){labImportChanged(e.target.id);return}if(e.target.id==='lab-mode'){labPlan=labDefaults(e.target.value);labArchiveTab=e.target.value;render()}if(e.target.matches('[data-board-toggle]')){const x=db.journalBoard.find(y=>y.id===e.target.dataset.boardToggle);if(x){x.done=e.target.checked;save();render()}return}if(e.target.id==='journal-sensory-type')updateJournalSensoryOptions();if(e.target.id==='session-stage')updateSessionEnvironmentOptions();if(e.target.id==='experimenter-filter')renderExperimenterResults();if(['session-participant-filter','session-participant-stage','session-environment-filter','session-environment-stage'].includes(e.target.id))renderSessionViews()});
document.getElementById('content').addEventListener('input',e=>{if(['lab-import-offset','lab-import-calibration'].includes(e.target.id)){labRenderImportPreview();if(e.target.id==='lab-import-offset')renderAllSegmentComparisons()};if(e.target.id==='pilot-session-offset'){pilotSessionPreview();renderAllSegmentComparisons()}});
document.getElementById('content').addEventListener('click',async e=>{const directPilot=e.target.closest('[data-pilot-session-link]');if(directPilot){route('sessions');const select=document.getElementById('pilot-session-run');if(select){select.value=directPilot.dataset.pilotSessionLink;pilotSessionChanged('pilot-session-run');document.querySelector('.pilot-session-panel')?.scrollIntoView({block:'start'})}return}const directImport=e.target.closest('[data-lab-import-link]');if(directImport){route('sessions');const chooser=document.getElementById('lab-import-run');if(chooser){chooser.value=directImport.dataset.labImportLink;labImportChanged('run');document.querySelector('.lab-import-panel')?.scrollIntoView({block:'start'})}return}const boardAdd=e.target.closest('[data-board-add]');if(boardAdd){journalOpen(boardAdd.dataset.boardAdd);return}const boardEdit=e.target.closest('[data-board-edit]');if(boardEdit){journalOpen('',boardEdit.dataset.boardEdit);return}const boardDelete=e.target.closest('[data-board-delete]');if(boardDelete){if(!confirm('이 항목을 삭제할까요?'))return;db.journalBoard=db.journalBoard.filter(x=>x.id!==boardDelete.dataset.boardDelete);save();render();return}if(e.target.closest('[data-journal-close]')||e.target.id==='journal-modal'){journalClose();return}const labtab=e.target.closest('[data-lab-tab]');if(labtab){if(!labDraft)labCapturePlan();labArchiveTab=labtab.dataset.labTab;const existing=document.getElementById('lab-mode');if(existing)existing.value=labArchiveTab;render();return}const remstep=e.target.closest('[data-lab-remove]');if(remstep){labCapturePlan();if(labPlan.length>1){labPlan.splice(Number(remstep.dataset.labRemove),1);labRenderStepEditor()}return}const action=e.target.closest('[data-lab-action]');if(action){const op=action.dataset.labAction;if(op==='add-step'){labCapturePlan();if(labPlan.length>=20)return alert('구간은 최대 20개입니다.');labPlan.push({label:String.fromCharCode(65+labPlan.length),name:'새 감각 환경',envId:'',target:120});labRenderStepEditor()}else if(op==='create'){labCapturePlan();const mode=document.getElementById('lab-mode').value,code=document.getElementById('lab-code').value.trim()||'개인';if(!labPlan.length||labPlan.some(x=>!x.name||!Number.isFinite(x.target)||x.target<1||x.target>7200))return alert('구간 이름과 목표 시간(1~7200초)을 확인해 주세요.');if(mode!=='pilot'&&code==='개인')return alert('정식 실험은 익명 참가자 코드를 입력하세요.');labDraft={id:String(Date.now())+'-'+String(Math.random()).slice(2,7),mode,code,date:dateNow(),startedAt:null,endedAt:null,steps:labPlan.map((s,i)=>({label:String.fromCharCode(65+i),name:s.name,envId:s.envId,envName:db.sensoryEnvironments.find(x=>x.id===s.envId)?.name||'',target:s.target,startedAt:null,endedAt:null,note:''}))};labSaveDraft();render()}else if(op==='start')labStart();else if(op==='next')labNext();else if(op==='finish')labFinish();else if(op==='save-note'){const active=labDraft?.steps.find(x=>x.startedAt&&!x.endedAt);const note=document.getElementById('lab-current-note');if(active&&note){active.note=note.value.slice(0,4000);labSaveDraft();alert('현재 구간 메모를 저장했습니다.')}}else if(op==='discard'){if(confirm('진행 중인 실험 초안을 폐기할까요? 저장된 아카이브 기록은 유지됩니다.')){labDraft=null;localStorage.removeItem(LAB_DRAFT_KEY);render()}}return}const ldel=e.target.closest('[data-lab-delete]');if(ldel){if(!confirm('해당 실험 기록을 아카이브에서 삭제할까요?'))return;const k=ldel.dataset.labType==='pilot'?'pilotRuns':'labRuns';db[k]=db[k].filter(x=>x.id!==ldel.dataset.labDelete);save();render();return}const er=e.target.closest('[data-experimenter-remove]');if(er){if(!confirm('이 실험자 코드를 목록에서 삭제할까요? 기존 실험 세션 기록은 유지됩니다.'))return;db.experimenters=db.experimenters.filter(x=>x.id!==er.dataset.experimenterRemove);save();render();return}const sr=e.target.closest('[data-sensory-remove]');if(sr){if(!confirm('이 감각 환경을 목록에서 삭제할까요? 이미 작성한 연구 일지는 유지됩니다.'))return;db.sensoryEnvironments=(db.sensoryEnvironments||[]).filter(x=>x.id!==sr.dataset.sensoryRemove);save();render();return}let d=e.target.closest('[data-remove]');if(d){if(!confirm('이 기록을 삭제할까요?'))return;db[d.dataset.remove]=db[d.dataset.remove].filter(x=>x.id!==d.dataset.id);save();render();return}if(e.target.id==='restorebtn'){const f=document.getElementById('restorefile').files[0];if(!f)return alert('먼저 백업 JSON 파일을 선택하세요.');try{let j=JSON.parse(await f.text());let data=j.data;if(!data||!['journal','sessions','equipment','results','references'].every(k=>Array.isArray(data[k])))throw Error('invalid');if(!confirm('기존 기록을 모두 백업 파일 내용으로 대체할까요?'))return;db={...structuredClone(defaults),...data,sensoryEnvironments:Array.isArray(data.sensoryEnvironments)?data.sensoryEnvironments:[],experimenters:Array.isArray(data.experimenters)?data.experimenters:[],pilotRuns:Array.isArray(data.pilotRuns)?data.pilotRuns:[],labRuns:Array.isArray(data.labRuns)?data.labRuns:[],journalBoard:Array.isArray(data.journalBoard)?data.journalBoard:[]};save();render();alert('복원이 완료되었습니다.')}catch{alert('올바른 연구 백업 파일이 아닙니다.')}}});render();
setInterval(labTick,500);
