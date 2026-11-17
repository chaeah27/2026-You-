import {collection,doc,getDoc,getDocFromServer,onSnapshot,writeBatch,serverTimestamp,runTransaction,setDoc,query,where} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
/* v2 experiment registration and researcher/participant synchronized state.
   Only used in the isolated development branch until device tests and rules rollout. */
export function installYurifV2({auth,store}){
 const P=()=>window.yurifV2Protocol;
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
 const plans=collection(store,'experimentsV2');
 const refProgress=key=>doc(store,'experimentProgress',key);
 const refAnswers=key=>collection(store,'participantAnswersV2',key,'items');
 const refAnswer=(key,slot)=>doc(store,'participantAnswersV2',key,'items',slot);
 const state={list:[],selected:'',progress:null,answers:new Map(),offPlans:null,offProgress:null,offAnswers:null,
   participantKey:'',participantPlan:null,participantReady:false,participantProgress:null,participantAnswers:new Map(),
   offParticipantProgress:null,offParticipantAnswers:null,offParticipantPlan:null,transitioning:false,warning:''};
 const activePlan=()=>state.list.find(p=>p.id===state.selected);
 const envChoices=()=>window.yurifV2EnvironmentList?.()||[];
 function activateResearch(){
  if(state.offPlans)return;
  state.offPlans=onSnapshot(plans,s=>{
   state.list=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.createdAt?.seconds||'').localeCompare(String(a.createdAt?.seconds||'')));
   refreshRegistration();refreshLab();
  },e=>{state.warning='예정 실험 조회 불가: '+e.message;refreshRegistration();refreshLab()});
 }
 function deactivateResearch(){
  state.offPlans?.();state.offPlans=null;state.offProgress?.();state.offProgress=null;state.offAnswers?.();state.offAnswers=null;
  stopParticipant();
  state.list=[];state.selected='';state.progress=null;state.answers.clear();
 }
 function choices(type){
  const a=envChoices().filter(x=>x.type===type);
  return a.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
 }
 function registrationHtml(){
  const types=[['visual','시각',4],['olfactory','후각',4],['auditory','청각',2]];
  const selections=types.map(([type,title,count])=>'<section class="panel"><h3>'+title+' · '+count+'개 선택</h3><p class="muted">해당 분야 내 순서만 등록 시 무작위로 섞고 확정합니다.</p>'+
   '<div class="formgrid">'+Array.from({length:count},(_,i)=>'<div class="field"><label>'+title+' '+(i+1)+'</label><select required name="'+type+i+'">'+choices(type)+'</select></div>').join('')+'</div></section>').join('');
  return '<h1>실험 등록 <span class="pill">1차 연구 · 개발 버전</span></h1>'+
   '<p class="lead">실험 설계에서 등록한 시각 4개·후각 4개·청각 2개의 환경을 선택하세요. 등록 시 셔플된 제시 순서는 고정됩니다.</p>'+
   '<form id="v2-registration-form"><section class="panel"><div class="formgrid">'+
   '<div class="field"><label>참가자 코드</label><input name="code" required maxlength="30" placeholder="P01"></div>'+
   '<div class="field"><label>실험자 코드</label><input name="researcherCode" required maxlength="40" placeholder="E01"></div>'+
   '<div class="field"><label>실험 차수</label><select name="stage"><option value="stage1">1차 실험</option></select></div>'+
   '<div class="field"><label>예약 일시</label><input type="datetime-local" name="scheduledAt" required></div>'+
   '</div><div class="field"><label>특이사항</label><textarea name="notes" maxlength="2000"></textarea></div>'+
   '<div class="field"><label>참가자 사전 안내서 및 동의 설명문</label><textarea name="consentText" rows="5" required placeholder="연구 목적, 절차, 자발적 참여 및 철회, 안전 유의사항, 기록 보존기간 등을 직접 작성"></textarea></div>'+
   '<div class="field"><label>청각 설문 문항 (미확정이면 비워 두기)</label><input name="audioQuestion" maxlength="300" placeholder="직접 확정할 질문"></div>'+ 
   '<div class="field"><label>청각 응답 선택지 5개 (한 줄에 하나씩)</label><textarea name="audioOptions" rows="5"></textarea></div></section>'+
   selections+
   '<section class="panel"><button class="btn" type="submit">환경 순서 셔플·확정하고 실험 등록</button><p class="muted">임시 비밀번호로 32자리 무작위 입장키를 발급합니다. 입장키는 별도 보관하고 승인된 연구원만 접근하도록 합니다.</p></section></form>'+
   '<section class="panel"><h2>예정된 실험</h2><div id="v2-registration-list">'+registrationRows()+'</div><button type="button" class="btn secondary" id="v2-csv-export">예정 실험 CSV 다운로드</button></section>';
 }
 function registrationRows(){
  if(!state.list.length)return '<p class="muted">등록된 1차 실험이 없거나 목록을 불러오는 중입니다.</p>';
  return state.list.map(p=>'<div class="entry"><strong>'+esc(p.code)+' · '+esc(p.researcherCode)+' · 1차 실험</strong>'+
   '<p class="muted">예약: '+esc(p.scheduledAt)+' · 상태: '+esc(p.active===false?'비활성':'등록')+' · '+esc(p.notes||'특이사항 없음')+'</p>'+
   '<p>시각: '+(p.order||[]).slice(0,4).map(x=>esc(x.name)).join(' → ')+'<br>후각: '+(p.order||[]).slice(4,8).map(x=>esc(x.name)).join(' → ')+
   '<br>청각: '+(p.order||[]).slice(8,10).map(x=>esc(x.name)).join(' → ')+'</p>'+
   '<button type="button" class="btn secondary" data-v2-copy="'+esc(p.id)+'">참가자 코드·임시 비밀번호 복사</button>'+ 
   '<details><summary>예약·참가자 정보 수정 (변경 이력 보존)</summary><form data-v2-edit="'+esc(p.id)+'"><div class="formgrid">'+
   '<div class="field"><label>참가자 코드</label><input name="code" required maxlength="30" value="'+esc(p.code)+'"></div>'+
   '<div class="field"><label>실험자 코드</label><input name="researcherCode" required maxlength="40" value="'+esc(p.researcherCode)+'"></div>'+
   '<div class="field"><label>예약 일시</label><input type="datetime-local" name="scheduledAt" required value="'+esc(p.scheduledAt)+'"></div></div>'+
   '<div class="field"><label>특이사항</label><textarea name="notes" maxlength="2000">'+esc(p.notes||'')+'</textarea></div>'+
   '<button type="submit" class="btn secondary">정보 변경 및 수정 이력 저장</button></form></details>'+ 
   '<details><summary>청각 설문 문항·선택지 수정 (환경 순서는 고정)</summary><form data-v2-audio-edit="'+esc(p.id)+'"><div class="field"><label>문항</label><input name="audioQuestion" maxlength="300" value="'+esc(p.audioQuestion||'')+'"></div><div class="field"><label>선택지 5개 (한 줄씩)</label><textarea name="audioOptions" rows="5">'+esc((p.audioOptions||[]).join('\n'))+'</textarea></div><button type="submit" class="btn secondary">설문 문항 저장</button></form></details></div>').join('');
 }
 function refreshRegistration(){
  const root=$('v2-registration-list');if(root)root.innerHTML=registrationRows();
 }
 async function register(form){
  if(!window.yurifCloud?.ready)throw Error('승인된 연구원으로 로그인해야 합니다.');
  const data=Object.fromEntries(new FormData(form)),all=envChoices();
  const selected={};
  for(const [type,count] of P().CATEGORIES){
   const choices=[];
   for(let i=0;i<count;i++){
    const env=all.find(e=>String(e.id)===data[type+i]&&e.type===type);
    if(!env)throw Error(type+' '+(i+1)+'의 환경을 실험 설계에서 등록해 주세요.');
    choices.push({id:env.id,name:env.name,type});
   }
   if(new Set(choices.map(x=>x.id)).size!==count)throw Error(type+' 환경이 중복 선택되었습니다.');
   selected[type]=choices;
  }
  const order=P().shuffledOrder(selected);
  const code=data.code.trim();
  if(state.list.some(x=>x.code===code&&x.stage==='stage1'&&x.active!==false))
   throw Error('이미 활성 상태인 같은 참가자 코드·실험 차수가 있습니다.');
  const id=crypto.randomUUID(),key=randomHex(16);
  const plan={code,researcherCode:String(data.researcherCode).trim(),stage:'stage1',
   scheduledAt:data.scheduledAt,notes:String(data.notes||''),order,accessKey:key,
   consentText:String(data.consentText||'').trim(),audioQuestion:String(data.audioQuestion||'').trim(),
   audioOptions:String(data.audioOptions||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),
   active:true,createdAt:serverTimestamp()};
  if(!plan.consentText)throw Error('사전 안내서가 필요합니다.');
  if((plan.audioQuestion||plan.audioOptions.length)&&(!plan.audioQuestion||plan.audioOptions.length!==5))throw Error('청각 설문 문항과 선택지 5개를 모두 입력하거나 둘 다 비워 두세요.');
  const batch=writeBatch(store);
  batch.set(doc(plans,id),plan);
  batch.set(doc(store,'participantAccess',key),{code,experimentId:id,v2:true,stage:'stage1',
   order:order.map(x=>x.name),active:true,consentText:plan.consentText,audioQuestion:plan.audioQuestion,audioOptions:plan.audioOptions,createdAt:serverTimestamp()});
  batch.set(refProgress(key),{experimentId:id,code,phase:'registered',position:-1,
   startedAt:null,endedAt:null,updatedAt:serverTimestamp()});
  await batch.commit();
  const check=await getDocFromServer(doc(plans,id));
  if(!check.exists())throw Error('실험 등록 서버 확인 실패');
  form.reset();
  alert('실험 등록 및 셔플 확정 완료. 참가자 코드: '+code+'\\n임시 비밀번호: '+key+
    '\\n이 정보는 참가자 입장에 필요하므로 안전하게 전달하세요.');
 }
 function csvExport(){
  const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  const headers=['experiment_id','participant_code','researcher_code','stage','scheduled_at','notes','visual_order','olfactory_order','auditory_order'];
  const rows=state.list.map(p=>[p.id,p.code,p.researcherCode,p.stage,p.scheduledAt,p.notes,
   p.order?.slice(0,4).map(x=>x.name).join(' > '),p.order?.slice(4,8).map(x=>x.name).join(' > '),p.order?.slice(8).map(x=>x.name).join(' > ')]);
  const blob=new Blob(['\\ufeff'+[headers,...rows].map(r=>r.map(csv).join(',')).join('\\r\\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'),url=URL.createObjectURL(blob);
  a.href=url;a.download='yurif-experiments-v2.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 function selectExperiment(id){
  if(state.selected===id)return;
  state.offProgress?.();state.offAnswers?.();state.selected=id;state.progress=null;state.answers=new Map();
  const plan=activePlan();
  if(plan){
   state.offProgress=onSnapshot(refProgress(plan.accessKey),snap=>{
    state.progress=snap.exists()?snap.data():null;refreshLab();
   },e=>{state.warning='실험 상태 조회 오류: '+e.message;refreshLab()});
   state.offAnswers=onSnapshot(refAnswers(plan.accessKey),snap=>{
    state.answers=new Map(snap.docs.map(x=>[x.id,x.data()]));refreshLab();
   },e=>{state.warning='설문 응답 조회 오류: '+e.message;refreshLab()});
  }
  refreshLab();
 }
 function phaseLabel(p){
  return ({registered:'실험 준비',measurement:'측정 중',restReady:'휴식 시작 대기',
   rest:'휴식 측정 중',setup:'다음 환경 준비',survey:'참가자 설문 대기',
   completed:'완료',aborted:'중단',sensorError:'센서 오류 · 연구원 조치 필요'})[p?.phase]||'실험 상태 확인 중';
 }
 function labHtml(){
  return '<section class="panel" id="v2-lab-root"><h2>확정 1차 실험 · 연구원 진행</h2><p class="muted">등록된 실험의 21개 구간을 사용합니다. 각 휴식은 연구원이 직접 시작합니다. 설문 저장이 확인되기 전에는 다음 환경으로 진행할 수 없습니다.</p>'+
   '<div class="field"><label>진행할 예정 실험</label><select id="v2-lab-select"><option value="">선택하세요</option>'+
   state.list.map(p=>'<option value="'+esc(p.id)+'" '+(state.selected===p.id?'selected':'')+'>'+esc(p.code)+' · '+esc(p.scheduledAt)+' · '+esc(p.researcherCode)+'</option>').join('')+'</select></div>'+
   '<div id="v2-lab-current">'+labControls()+'</div></section>';
 }
 function labControls(){
  const p=state.progress,plan=activePlan();
  if(!plan)return '<p class="muted">실험을 선택해 주세요.</p>';
  if(!p)return '<p class="muted">실험 진행 상태 불러오는 중…</p>';
  const steps=P().makeSegments(plan.order),n=p.position,kind=p.phase,slot=P().surveySlot(n);
  const uploaded=slot&&state.answers.has(slot);
  const next=steps.find(x=>x.position===n&&x.kind==='stimulus');
  const btn=(action,text)=>'<button type="button" class="btn" data-v2-lab="'+action+'" '+(state.transitioning?'disabled':'')+'>'+text+'</button>';
  let action='';
  if(kind==='registered')action=btn('baseline','실험 시작 · 안정 상태 60초');
  if(kind==='setup')action=btn('stimulus','다음 환경 준비 완료');
  if(kind==='restReady')action=btn('rest','휴식 30초 시작');
  if(kind==='survey')action=uploaded?(n===9?btn('finish','최종 설문 확인 · 실험 종료 저장'):btn('stimulus','설문 저장 확인 · 다음 환경 준비 완료')):'<p>참가자가 설문을 저장하면 다음 측정을 진행할 수 있습니다.</p>';
  if(kind==='measurement'||kind==='rest'){
   const seconds=kind==='measurement'?60:30;
   action='<p>자동 종료 예정 · '+seconds+'초 측정 / 시작 '+(p.startedAt?esc(new Date(p.startedAt).toLocaleTimeString('ko-KR')):'—')+'</p>'+
    '<strong id="v2-countdown">남은 시간 계산 중…</strong>';
  }
  if(kind==='sensorError')action='<p role="alert">측정 중 센서 연결이 끊어졌습니다. 재연결 후 해당 구간을 재측정하거나 실험을 중단하세요. 이전 샘플은 삭제하지 않습니다.</p>'+btn('retry','센서 연결 후 해당 구간 재측정')+btn('abort','실험 중단 · 기록 보존');
  if(kind==='completed')action='<p>측정 기록 종료됨. 저장 상태와 세션 기록을 확인하세요.</p>';
  const last=n>=0?'현재 환경: '+esc(plan.order[n]?.name||''):'초기 안정 상태';
  return '<p><strong>진행 상태: '+esc(phaseLabel(p))+'</strong> · '+last+'</p>'+
   '<p class="muted">ADC 실시간 연결·구간 기록 상태와 Firebase 업로드 검증 결과를 각각 확인해야 합니다.</p>'+
   (state.warning?'<p role="alert" class="notice">'+esc(state.warning)+'</p>':'')+
   '<div class="actions">'+action+'</div>';
 }
 function refreshLab(){
  const root=$('v2-lab-root');if(root){const select=$('v2-lab-select');if(select&&select.options.length!==state.list.length+1){
   root.outerHTML=labHtml();return;
  }const controls=$('v2-lab-current');if(controls)controls.innerHTML=labControls();}
 }
 async function transition(next,expected,payload={}){
  const plan=activePlan();if(!plan)throw Error('실험이 선택되지 않았습니다.');
  if(!navigator.onLine)throw Error('오프라인에서는 실험 상태를 변경할 수 없습니다.');
  state.transitioning=true;refreshLab();
  try{
   await runTransaction(store,async tx=>{
    const ref=refProgress(plan.accessKey),snap=await tx.get(ref);
    if(!snap.exists()||snap.data().phase!==expected)throw Error('다른 화면에서 실험 상태가 변경되었습니다. 새로고침하여 확인하세요.');
    tx.update(ref,{...payload,phase:next,updatedAt:serverTimestamp()});
   });
   state.progress={...state.progress,...payload,phase:next};
  }finally{state.transitioning=false;refreshLab()}
 }
 async function beginStep(kind){
  const plan=activePlan(),p=state.progress;
  if(!plan||!p)throw Error('실험을 먼저 선택해 주세요.');
  if(!window.yurifV2ConnectedSensor?.())throw Error('Arduino USB 센서 연결 후 진행해 주세요.');
  const nextPos=kind==='baseline'?-1:(kind==='rest'?p.position:p.position+1);
  if(nextPos>9)throw Error('모든 환경이 완료되었습니다.');
  const expected=kind==='baseline'?'registered':kind==='rest'?'restReady':p.phase;
  if(kind==='stimulus'&& !['setup','survey'].includes(p.phase))throw Error('다음 환경을 시작할 수 없는 상태입니다.');
  if(kind==='stimulus'&&p.phase==='survey'){
   const slot=P().surveySlot(p.position);
   if(!slot||!state.answers.has(slot))throw Error('참가자의 설문 제출이 확인되지 않았습니다.');
   await getDocFromServer(refAnswer(plan.accessKey,slot)).then(s=>{if(!s.exists())throw Error('설문 서버 확인 실패')});
  }
  if(kind==='baseline'){
   await window.yurifV2PrepareLab?.(plan,P().makeSegments(plan.order));
  }
  if(kind==='stimulus'&&(!plan.audioQuestion||plan.audioOptions?.length!==5)&&nextPos>=8)throw Error('청각 설문 문항이 미확정입니다. 실험 설계에서 먼저 등록해야 합니다.');
  const startedAt=Date.now(),segment=kind==='baseline'?0:kind==='stimulus'?1+2*nextPos:2+2*nextPos;
  await transition(kind==='rest'?'rest':'measurement',expected,{position:nextPos,segment,startedAt,endedAt:null});
  window.yurifV2StepStart?.(plan,segment,startedAt);
 }
 async function handleSensorFailure(){
  const p=state.progress,plan=activePlan();
  if(!p||!plan||!['measurement','rest'].includes(p.phase)||state.transitioning)return;
  if(window.yurifV2ConnectedSensor?.())return;
  const at=Date.now();
  window.yurifV2StepFailure?.(plan,p.segment,at,'USB 연결 끊김');
  try{await transition('sensorError',p.phase,{failedAt:at,failedSegment:p.segment,failedPhase:p.phase})}
  catch(err){state.warning='센서 오류 상태 서버 동기화 실패: '+String(err.message||err)}
 }
 window.yurifV2OnSensorLost=()=>handleSensorFailure().catch(err=>{state.warning=String(err.message||err);refreshLab()});
 async function retry(){
  const p=state.progress,plan=activePlan();if(!p||p.phase!=='sensorError'||!plan)throw Error('재측정 대기 상태가 아닙니다.');
  if(!window.yurifV2ConnectedSensor?.())throw Error('먼저 Arduino 센서를 다시 연결해 주세요.');
  const kind=p.failedPhase==='rest'?'rest':'measurement';
  const start=Date.now();
  await transition(kind,'sensorError',{startedAt:start,endedAt:null,failedAt:null,failedSegment:null,failedPhase:null});
  window.yurifV2StepRetry?.(plan,p.segment,start);
 }
 async function endTimed(){
  const p=state.progress,plan=activePlan();
  if(!p||!plan||!['measurement','rest'].includes(p.phase)||state.transitioning)return;
  if(!window.yurifV2ConnectedSensor?.()){await handleSensorFailure();return}
  const duration=p.phase==='rest'?30000:60000;
  if(!p.startedAt||Date.now()-p.startedAt<duration)return;
  const stamp=Date.now();
  window.yurifV2StepEnd?.(plan,p.segment,stamp);
  const after=p.phase==='measurement'?(p.position===-1?'setup':'restReady'):
   P().surveySlot(p.position)?'survey':'setup';
  try{await transition(after,p.phase,{endedAt:stamp,surveySlot:after==='survey'?P().surveySlot(p.position):null})}
  catch(err){state.warning='자동 종료 동기화 실패: '+String(err.message||err)+' · 복구를 위해 인터넷 연결을 확인하세요.';refreshLab()}
 }
 async function finish(){
  const plan=activePlan(),p=state.progress;if(!plan||!p||p.phase!=='survey'||p.position!==9)throw Error('마지막 설문 완료 후 종료할 수 있습니다.');
  const slot=P().surveySlot(9),confirmed=await getDocFromServer(refAnswer(plan.accessKey,slot));
  if(!confirmed.exists())throw Error('최종 설문 서버 저장이 확인되지 않았습니다.');
  const completed=await window.yurifV2FinishLab?.();
  if(!completed)throw Error('ADC 로컬 기록 저장 검증이 완료되지 않았습니다.');
  await transition('completed','survey',{endedAt:Date.now()});
 }
 setInterval(()=>{endTimed().catch(()=>{});const el=$('v2-countdown'),p=state.progress;
  if(el&&p?.startedAt){const remaining=(p.phase==='rest'?30:60)-Math.floor((Date.now()-p.startedAt)/1000);el.textContent='남은 시간 '+Math.max(0,remaining)+'초';}
 },500);
 document.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-v2-edit]');if(!form)return;
  e.preventDefault();const plan=state.list.find(x=>x.id===form.dataset.v2Edit);if(!plan)return;
  const data=Object.fromEntries(new FormData(form)),updated={
   code:String(data.code||'').trim(),researcherCode:String(data.researcherCode||'').trim(),
   scheduledAt:String(data.scheduledAt||''),notes:String(data.notes||'').trim()
  };
  if(!updated.code||!updated.researcherCode||!updated.scheduledAt)return alert('필수 정보를 확인해 주세요.');
  if(state.list.some(x=>x.id!==plan.id&&x.code===updated.code&&x.active!==false))return alert('다른 활성 실험에서 사용하는 참가자 코드입니다.');
  if(!confirm('참가자·예약 정보를 수정하고 변경 이력을 기록할까요? 감각 환경 순서는 그대로 유지됩니다.'))return;
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
   const batch=writeBatch(store),changes={};
   for(const k of Object.keys(updated))if(updated[k]!==String(plan[k]||''))changes[k]={before:plan[k]||'',after:updated[k]};
   if(!Object.keys(changes).length)return alert('변경된 내용이 없습니다.');
   batch.update(doc(plans,plan.id),updated);
   if('code' in changes){
    batch.update(doc(store,'participantAccess',plan.accessKey),{code:updated.code});
    batch.update(refProgress(plan.accessKey),{code:updated.code,updatedAt:serverTimestamp()});
   }
   batch.set(doc(store,'experimentsV2',plan.id,'audit',crypto.randomUUID()),{
    event:'metadata_updated',changes,actorUid:auth.currentUser.uid,at:serverTimestamp()
   });
   await batch.commit();
   const confirmed=await getDocFromServer(doc(plans,plan.id));
   if(!confirmed.exists()||confirmed.data().code!==updated.code)throw Error('변경 내용 서버 확인 실패');
   alert('연결된 참가자·실험 정보 및 변경 이력 저장 완료');
  }catch(err){alert('실험 정보 수정 실패: '+String(err.message||err))}
  finally{button.disabled=false}
 });
 document.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-v2-audio-edit]');if(!form)return;
  e.preventDefault();
  const plan=state.list.find(x=>x.id===form.dataset.v2AudioEdit);if(!plan)return;
  const fd=new FormData(form),question=String(fd.get('audioQuestion')||'').trim();
  const options=String(fd.get('audioOptions')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if((question||options.length)&&(!question||options.length!==5)){alert('문항과 선택지 5개를 모두 입력하거나 둘 다 비워 주세요.');return}
  if(!confirm('등록된 실험의 청각 설문만 수정할까요? 감각 환경 순서는 변경되지 않습니다.'))return;
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
   const progress=await getDocFromServer(refProgress(plan.accessKey));
   if(!progress.exists()||progress.data().phase!=='registered')throw Error('실험 시작 이후에는 설문 문항을 수정할 수 없습니다.');
   const batch=writeBatch(store);
   batch.update(doc(plans,plan.id),{audioQuestion:question,audioOptions:options});
   batch.update(doc(store,'participantAccess',plan.accessKey),{audioQuestion:question,audioOptions:options});
   await batch.commit();
   const confirmed=await getDocFromServer(doc(plans,plan.id));
   if(!confirmed.exists()||confirmed.data().audioQuestion!==question)throw Error('서버 저장 확인 실패');
   alert('청각 설문 업데이트 완료');
  }catch(err){alert('청각 설문 저장 실패: '+String(err.message||err))}
  finally{button.disabled=false}
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='v2-registration-form')return;e.preventDefault();
  const button=e.target.querySelector('button[type=submit]');button.disabled=true;
  try{await register(e.target)}catch(err){alert('실험 등록 실패: '+String(err.message||err))}
  finally{button.disabled=false}
 });
 document.addEventListener('change',e=>{if(e.target.id==='v2-lab-select')selectExperiment(e.target.value)});
 document.addEventListener('click',async e=>{
  const copy=e.target.closest('[data-v2-copy]');
  if(copy){const p=state.list.find(x=>x.id===copy.dataset.v2Copy);if(p){
   const value='참가자 코드: '+p.code+'\\n임시 비밀번호: '+p.accessKey;
   try{await navigator.clipboard.writeText(value);alert('참가자 입장 정보 복사 완료')}catch{alert(value)}
  }return}
  if(e.target.id==='v2-csv-export'){csvExport();return}
  const button=e.target.closest('[data-v2-lab]');if(!button)return;
  button.disabled=true;
  try{
   const action=button.dataset.v2Lab;
   if(action==='finish')await finish();else if(action==='retry')await retry();else if(action==='abort')await transition('aborted','sensorError',{abortedAt:Date.now()});else await beginStep(action);
  }catch(err){state.warning=String(err.message||err);alert('진행 불가: '+state.warning);refreshLab()}
  finally{button.disabled=false}
 });
 function stopParticipant(){
  state.offParticipantProgress?.();state.offParticipantAnswers?.();state.offParticipantPlan?.();state.offParticipantProgress=null;state.offParticipantAnswers=null;state.offParticipantPlan=null;
  state.participantKey='';state.participantPlan=null;state.participantProgress=null;state.participantAnswers=new Map();
 }
 function renderParticipant({key,plan}){
  if(state.participantKey!==key){
   stopParticipant();state.participantKey=key;state.participantPlan=plan;
   state.participantReady=sessionStorage.getItem('yurif_v2_ready_'+key)==='yes';
   state.offParticipantPlan=onSnapshot(doc(store,'participantAccess',key),snap=>{
    if(!snap.exists()||snap.data().active!==true){$('participant-steps').textContent='참가자 입장 코드가 비활성화되었습니다.';return}
    state.participantPlan=snap.data();updateParticipant();
   },err=>{$('participant-steps').textContent='설문 정보 갱신 실패: '+err.message});

   state.offParticipantProgress=onSnapshot(refProgress(key),snap=>{
    state.participantProgress=snap.exists()?snap.data():null;updateParticipant();
   },err=>{$('participant-steps').textContent='진행 상태를 확인할 수 없습니다. Firebase 보안 규칙 확인: '+err.message});
   state.offParticipantAnswers=onSnapshot(refAnswers(key),snap=>{
    state.participantAnswers=new Map(snap.docs.map(d=>[d.id,d.data()]));updateParticipant();
   },err=>{$('participant-steps').textContent='설문 저장 상태 조회 실패: '+err.message});
  }else updateParticipant();
 }
 function updateParticipant(){
  const root=$('participant-steps'),key=state.participantKey,p=state.participantProgress;
  if(!root||!key)return;
  if(!state.participantReady){
   root.innerHTML='<section class="panel"><h2>실험 참여 준비</h2><p>사전 동의가 확인되었습니다. 실험 시작 화면을 준비하려면 아래 버튼을 눌러 주세요. 실제 측정은 연구원이 시작합니다.</p>'+
    '<button type="button" class="btn" id="v2-participant-ready">실험 시작하기</button></section>';return;
  }
  if(!p){root.innerHTML='<section class="panel"><p>연구원 진행 상태 연결 중…</p></section>';return}
  if(p.phase==='survey'){
   const slot=P().surveySlot(p.position);
   if(!slot){root.innerHTML='<p>설문 상태 불일치. 연구원에게 알려 주세요.</p>';return}
   if(state.participantAnswers.has(slot)){root.innerHTML='<section class="panel"><h2>설문 제출 완료</h2><p>응답이 저장되었습니다. 다음 측정을 기다려 주세요.</p></section>';return}
   root.innerHTML=surveyForm(slot,p.position,state.participantPlan);return;
  }
  if(p.phase==='completed'){
   root.innerHTML='<section class="panel"><h2>1차 실험이 완료되었습니다.</h2><p>모든 설문 응답과 측정이 종료되었습니다.</p></section>';return;
  }
  root.innerHTML='<section class="panel"><h2>연구원의 안내를 기다려 주세요.</h2><p>현재 진행 상태: '+esc(phaseLabel(p))+'</p>'+
   '<p class="muted">설문은 해당 감각 환경 측정과 30초 휴식이 끝나면 자동으로 표시됩니다.</p></section>';
 }
 function surveyForm(slot,pos,plan){
  const open='<section class="panel"><h2>감각 환경 평가</h2><form id="v2-survey-form"><input type="hidden" name="slot" value="'+esc(slot)+'">';
  let body='';
  if(slot==='visual'){
   body='<p>경험한 네 조명을 가장 마음에 들었던 순서로 나열해 주세요.</p>'+
    Array.from({length:4},(_,i)=>'<div class="field"><label>'+(i+1)+'순위</label><select required name="rank'+i+'"><option value="">선택</option>'+
     plan.order.slice(0,4).map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></div>').join('')+
    '<p>불쾌감을 느낀 조명이 있다면 모두 선택해 주세요. 없으면 선택하지 않아도 됩니다.</p>'+
    plan.order.slice(0,4).map(x=>'<label class="participant-confirm"><input type="checkbox" name="discomfort" value="'+esc(x)+'"> '+esc(x)+'</label>').join('');
  }else if(slot.startsWith('olfactory')){
   body='<p>해당 냄새를 맡았을 때 느낀 감정에 표시해 주세요.</p>'+
    ['매우 나쁨','살짝 불쾌함','아무 변화 없음','좋음','매우 좋음'].map((t,i)=>'<label class="participant-confirm"><input type="radio" required name="rating" value="'+(i+1)+'"> '+t+'</label>').join('');
  }else{
   body='<p>'+esc(plan.audioQuestion||'청각 설문 문항이 아직 확정되지 않았습니다. 연구원에게 문의해 주세요.')+'</p>'+
    (plan.audioQuestion&&plan.audioOptions?.length===5?plan.audioOptions.map((t,i)=>
      '<label class="participant-confirm"><input type="radio" required name="rating" value="'+(i+1)+'"> '+t+'</label>').join(''):'');
  }
  return open+body+'<button type="submit" class="btn" '+((!plan.audioQuestion||plan.audioOptions?.length!==5)&&slot.startsWith('auditory')?'disabled':'')+'>설문 제출</button></form></section>';
 }
 document.addEventListener('click',e=>{
  if(e.target.id==='v2-participant-ready'){state.participantReady=true;sessionStorage.setItem('yurif_v2_ready_'+state.participantKey,'yes');updateParticipant()}
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='v2-survey-form')return;e.preventDefault();
  const key=state.participantKey,p=state.participantProgress,form=e.target;
  const slot=P().surveySlot(p?.position);
  if(!key||p?.phase!=='survey'||new FormData(form).get('slot')!==slot)return;
  const btn=form.querySelector('button[type=submit]');btn.disabled=true;
  try{
   const values=new FormData(form);
   const answer={uid:auth.currentUser.uid,slot,position:p.position,stage:'stage1',createdAt:serverTimestamp()};
   if(slot==='visual'){
    const ranked=Array.from({length:4},(_,i)=>values.get('rank'+i));
    if(ranked.some(x=>!x)||new Set(ranked).size!==4)throw Error('4개 조명을 중복 없이 순서대로 선택해 주세요.');
    answer.ranking=ranked;answer.discomfort=values.getAll('discomfort');
   }else{
    const score=Number(values.get('rating'));
    if(!Number.isInteger(score)||score<1||score>5)throw Error('다섯 선택지 중 하나를 선택해 주세요.');
    answer.rating=score;
   }
   await setDoc(refAnswer(key,slot),answer);
   const confirmed=await getDocFromServer(refAnswer(key,slot));
   if(!confirmed.exists()||confirmed.data().uid!==auth.currentUser.uid)throw Error('설문 서버 저장 확인 실패');
   state.participantAnswers.set(slot,confirmed.data());updateParticipant();
  }catch(err){alert('설문 저장 실패: '+String(err.message||err));btn.disabled=false}
 });
 /* v2 session review: read raw ADC from Firebase, never from overwritten participant labels. */
 const session={planId:'',run:null,points:[],answers:new Map(),heart:new Map(),error:''};
 const CHUNK_COL=collection(store,'teamData','gsrRawChunks','items');
 const indexRef=id=>doc(store,'teamData','gsrRunIndex','items',id);
 function selectedSessionPlan(){return state.list.find(p=>p.id===session.planId)}
 function sessionHtml(){
  return '<section class="panel"><h2>확정 1차 실험 통합 세션 · v2</h2>'+
   '<p class="muted">등록 실험 ID를 기준으로 ADC 구간, 설문 7회와 추후 입력한 구간별 심박수를 연결합니다. 보정 전 ADC 원시값입니다.</p>'+
   '<div class="formgrid"><div class="field"><label>참가자 · 실험 선택</label><select id="v2-session-select"><option value="">선택</option>'+
   state.list.map(p=>'<option value="'+esc(p.id)+'" '+(session.planId===p.id?'selected':'')+'>'+esc(p.code)+' · '+esc(p.scheduledAt)+'</option>').join('')+
   '</select></div><div class="field"><label>분석할 감각 분야</label><select id="v2-sensory-filter"><option value="all">모두</option><option value="visual">시각</option><option value="olfactory">후각</option><option value="auditory">청각</option></select></div></div>'+
   '<div class="actions"><button class="btn secondary" type="button" id="v2-session-load">서버 기록 조회·대조</button></div>'+
   '<div id="v2-session-output">'+sessionOutput()+'</div></section>';
 }
 const selectedOptions=[
  ['baseline','초기 안정 상태'],['stimulus','감각 환경'],['rest','30초 휴식'],['gap','구간 외 ADC']
 ];
 const measurements=[
  ['adcMean','ADC 평균'],['adcMin','ADC 최저'],['adcMax','ADC 최고'],
  ['hrMean','심박수 평균'],['hrMin','심박수 최저'],['hrMax','심박수 최고'],['survey','설문 결과']
 ];
 function sessionOutput(){
  if(session.error)return '<p role="alert">'+esc(session.error)+'</p>';
  const plan=selectedSessionPlan();if(!plan)return '<p class="muted">실험을 선택하고 조회해 주세요.</p>';
  const run=session.run;const segments=run?.steps||[];
  let html='<p><strong>'+esc(plan.code)+' · '+esc(plan.researcherCode)+'</strong> · '+esc(plan.scheduledAt)+'</p>'+
   '<p>ADC 원시 샘플 '+session.points.length+'개 · 측정 구간 '+segments.length+'개 · 설문 '+session.answers.size+'/7개</p>';
  html+='<div class="field"><label>분석에 포함할 구간</label><div class="actions">'+selectedOptions.map(([v,label])=>
   '<label><input type="checkbox" class="v2-include" value="'+v+'" '+(v==='gap'?'':'checked')+'> '+label+'</label>').join('')+'</div></div>'+
   '<div class="field"><label>표·CSV에 표시할 지표</label><div class="actions">'+measurements.map(([v,label])=>
   '<label><input type="checkbox" class="v2-metric" value="'+v+'" '+(['adcMean','hrMean','survey'].includes(v)?'checked':'')+'> '+label+'</label>').join('')+'</div></div>'+
   '<div id="v2-analysis-table"></div><div class="actions"><button type="button" class="btn secondary" id="v2-session-csv">선택 항목 CSV 다운로드</button></div>';
  if(segments.length){
   html+='<details><summary>Apple Watch 구간별 심박수 수동 입력 · 기록 이후 입력 가능</summary>'+
    '<form id="v2-heart-form"><div class="field"><label>측정 구간</label><select name="stepId" required>'+
    segments.map((step,i)=>'<option value="'+i+'">'+esc(step.name)+' · '+esc(step.label)+'</option>').join('')+'</select></div>'+
    '<div class="formgrid">'+[['mean','평균 심박수 (bpm)'],['min','최저 심박수 (bpm)'],['max','최고 심박수 (bpm)']].map(([k,label])=>
     '<div class="field"><label>'+label+'</label><input name="'+k+'" type="number" min="0" max="250" step="0.1"></div>').join('')+'</div>'+
    '<div class="field"><label>심박수 앱 기록·특이사항 메모</label><textarea name="note" maxlength="1000"></textarea></div>'+
    '<button type="submit" class="btn secondary">선택한 구간의 심박수 저장</button></form>'+
    '<p class="muted">이미지 첨부는 Firebase Storage 접근 규칙과 업로드 검증을 별도로 완성한 후 활성화할 예정입니다. 값이 없는 구간은 추측해서 채우지 마세요.</p></details>';
  }
  return html;
 }
 function drawSummaryCanvas(rows,metrics){
  const canvas=$('v2-summary-chart');if(!canvas)return;
  const width=Math.max(560,Math.round(canvas.getBoundingClientRect().width||840)),height=330;
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.height=height+'px';
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#FAFCFE';ctx.fillRect(0,0,width,height);
  const groups=[
   {name:'ADC 원시값 (0~1023)',keys:['adcMean','adcMin','adcMax'],max:1023,color:'#2875A8'},
   {name:'심박수 (bpm)',keys:['hrMean','hrMin','hrMax'],max:250,color:'#B57643'}
  ];
  const usable=groups.map(g=>({...g,keys:g.keys.filter(k=>metrics.includes(k))})).filter(g=>g.keys.length);
  if(!rows.length||!usable.length){
   ctx.fillStyle='#586F80';ctx.font='14px system-ui';ctx.fillText('표시할 수치가 없습니다. 지표를 선택하세요.',16,45);return;
  }
  let top=22;const padLeft=42,right=14,chartW=width-padLeft-right,sectionH=Math.floor((height-25)/usable.length);
  usable.forEach(g=>{
   const plotY=top+24,plotH=Math.max(45,sectionH-63),unitW=chartW/rows.length;
   ctx.fillStyle='#334F61';ctx.font='bold 13px system-ui';ctx.textAlign='left';ctx.fillText(g.name,8,top+8);
   ctx.strokeStyle='#C9D9E3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padLeft,plotY+plotH);ctx.lineTo(width-right,plotY+plotH);ctx.stroke();
   rows.forEach((row,i)=>{
    const itemW=Math.max(2,unitW/(g.keys.length+1)),start=padLeft+i*unitW;
    g.keys.forEach((key,k)=>{
     const val=Number(row[key]);if(row[key]===''||!Number.isFinite(val))return;
     const bh=Math.max(1,Math.min(plotH,plotH*val/g.max));
     ctx.fillStyle=g.color;ctx.globalAlpha=0.45+0.5*(k+1)/g.keys.length;
     ctx.fillRect(start+4+k*itemW,plotY+plotH-bh,Math.max(2,itemW-2),bh);
     ctx.globalAlpha=1;
    });
    if(unitW>=26){
     const short=String(row.environment||'').slice(0,4);
     ctx.fillStyle='#587083';ctx.font='10px system-ui';ctx.textAlign='center';
     ctx.fillText(short,start+unitW/2,plotY+plotH+15);
    }
   });
   ctx.fillStyle='#728A9A';ctx.font='10px system-ui';ctx.textAlign='right';
   ctx.fillText(String(g.max),padLeft-5,plotY+3);ctx.fillText('0',padLeft-5,plotY+plotH+3);
   top+=sectionH;
  });
 }
 function chosenChecked(css){return new Set([...document.querySelectorAll(css+':checked')].map(x=>x.value))}
 function analysisRows(){
  const plan=selectedSessionPlan();if(!plan)return [];
  const types=chosenChecked('.v2-include'),metrics=chosenChecked('.v2-metric'),filter=$('v2-sensory-filter')?.value||'all';
  const steps=session.run?.steps||[];
  const rows=[];
  for(let i=0;i<steps.length;i++){
   const step=steps[i];const kind=i===0?'baseline':i%2?'stimulus':'rest';
   if(!types.has(kind))continue;
   const pos=i===0?-1:Math.floor((i-1)/2);
   const env=pos<0?null:plan.order[pos];
   if(filter!=='all'&&env?.type!==filter)continue;
   const pts=session.points.filter(p=>Array.isArray(p)&&p[0]>=step.startedAt&&p[0]<(step.endedAt||Infinity)&&p[2]!=='gap');
   const values=pts.map(p=>p[1]).filter(Number.isFinite);
   const heart=session.heart.get(String(i))||{};
   const rating=pos>=0&&kind==='stimulus'?session.answers.get(P().surveySlot(pos)):null;
   const detail=rating?(rating.rating!=null?String(rating.rating):'순위: '+(rating.ranking||[]).join(' > ')):'';
   rows.push({kind,category:env?.type||'baseline',environment:step.name,segmentId:i,
    start:step.startedAt||'',end:step.endedAt||'',samples:values.length,
    adcMean:values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2):'',
    adcMin:values.length?Math.min(...values):'',adcMax:values.length?Math.max(...values):'',
    hrMean:heart.mean??'',hrMin:heart.min??'',hrMax:heart.max??'',survey:detail});
  }
  if(types.has('gap')){
   const points=session.points.filter(p=>p[2]==='gap');
   if(points.length&&filter==='all'){
    const values=points.map(x=>x[1]);
    rows.push({kind:'gap',category:'gap',environment:'구간 외 ADC',segmentId:'',start:points[0][0],end:points.at(-1)[0],
     samples:points.length,adcMean:(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2),
     adcMin:Math.min(...values),adcMax:Math.max(...values),hrMean:'',hrMin:'',hrMax:'',survey:''});
   }
  }
  return rows;
 }
 function drawSessionTable(){
  const root=$('v2-analysis-table');if(!root)return;
  const metrics=[...document.querySelectorAll('.v2-metric:checked')].map(x=>x.value);
  const headers=[['environment','환경 / 구간'],['kind','구간 유형'],['samples','ADC 샘플 수'],...measurements.filter(([id])=>metrics.includes(id))];
  const rows=analysisRows();
  root.innerHTML='<div style="overflow-x:auto"><canvas id="v2-summary-chart" role="img" aria-label="선택한 ADC와 심박수의 구간별 비교 그래프" style="width:100%;min-height:300px"></canvas></div>'+ 
    '<div class="tablewrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x[1])+'</th>').join('')+'</tr></thead><tbody>'+
   rows.map(row=>'<tr>'+headers.map(([key])=>'<td>'+esc(row[key]??'')+'</td>').join('')+'</tr>').join('')+
   '</tbody></table></div>'+(rows.length?'':'<p class="muted">선택된 조건에 해당하는 구간 자료가 없습니다.</p>');
  drawSummaryCanvas(rows,metrics);
 }
 async function loadSession(id){
  session.planId=id;session.run=null;session.points=[];session.answers=new Map();session.heart=new Map();session.error='';
  const plan=selectedSessionPlan();if(!plan){session.error='실험 선택이 필요합니다.';return}
  try{
   const [meta,chunks,answers]=await Promise.all([
    getDocFromServer(indexRef(id)),
    getDocs(query(CHUNK_COL,where('runId','==',id))),
    getDocs(refAnswers(plan.accessKey))
   ]);
   const local=window.yurifFindGsrRun?.(id);
   session.run=meta.exists()?meta.data():local||null;
   session.points=chunks.docs.sort((a,b)=>(a.data().index||0)-(b.data().index||0))
    .flatMap(d=>Array.isArray(d.data().points)?d.data().points:[]);
   if(!session.points.length&&local?.gsrSamples?.length)session.points=local.gsrSamples;
   session.answers=new Map(answers.docs.map(x=>[x.id,x.data()]));
   if(session.run?.steps){
    for(let i=0;i<session.run.steps.length;i++){
     const snap=await getDoc(doc(store,'experimentsV2',id,'heartRate',String(i)));
     if(snap.exists())session.heart.set(String(i),snap.data());
    }
   }
   if(session.run?.sampleCount&&session.points.length!==session.run.sampleCount)
    session.error='경고: 서버 인덱스와 로드한 ADC 샘플 수가 다릅니다. 원본을 확인해야 합니다.';
  }catch(err){session.error='세션 조회 실패: '+String(err.message||err)}
 }
 async function saveHeart(form){
  const plan=selectedSessionPlan();if(!plan||!session.run)throw Error('먼저 측정 기록을 불러와 주세요.');
  const data=Object.fromEntries(new FormData(form)),key=String(data.stepId);
  const out={updatedAt:serverTimestamp(),note:String(data.note||'').slice(0,1000)};
  for(const k of ['mean','min','max']){
   if(data[k]!==''&&data[k]!=null){
    const v=Number(data[k]);if(!Number.isFinite(v)||v<0||v>250)throw Error('심박수는 0~250 범위로 입력해 주세요.');
    out[k]=v;
   }else out[k]=null;
  }
  if(out.min!=null&&out.max!=null&&out.min>out.max)throw Error('최저 심박수가 최고 심박수보다 클 수 없습니다.');
  if(out.mean!=null&&out.min!=null&&out.mean<out.min)throw Error('평균 심박수가 최저보다 작습니다.');
  if(out.mean!=null&&out.max!=null&&out.mean>out.max)throw Error('평균 심박수가 최고보다 큽니다.');
  const ref=doc(store,'experimentsV2',plan.id,'heartRate',key);
  await setDoc(ref,out);
  const verified=await getDocFromServer(ref);
  if(!verified.exists())throw Error('심박수 저장 확인 실패');
  session.heart.set(key,verified.data());
  return true;
 }
 function exportSessionCsv(){
  const metrics=chosenChecked('.v2-metric'),plan=selectedSessionPlan();
  if(!plan)return;
  const cols=['environment','kind','category','start','end','samples',...measurements.map(x=>x[0]).filter(x=>metrics.has(x))];
  const escCsv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  const csv=['participant_code,experiment_id,'+cols.join(','),
   ...analysisRows().map(row=>[plan.code,plan.id,...cols.map(c=>row[c])].map(escCsv).join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='yurif-session-'+plan.code+'-'+plan.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 document.addEventListener('click',async e=>{
  if(e.target.id==='v2-session-load'){
   const id=$('v2-session-select')?.value||'';if(!id)return alert('실험을 먼저 선택하세요.');
   const button=e.target;button.disabled=true;
   await loadSession(id);
   const out=$('v2-session-output');if(out)out.innerHTML=sessionOutput();
   drawSessionTable();button.disabled=false;
  }
  if(e.target.id==='v2-session-csv')exportSessionCsv();
 });
 document.addEventListener('change',e=>{
  if(e.target.matches('.v2-include,.v2-metric')||e.target.id==='v2-sensory-filter')drawSessionTable();
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='v2-heart-form')return;e.preventDefault();
  const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;
  try{await saveHeart(e.target);alert('심박수 서버 저장 확인 완료');drawSessionTable()}
  catch(err){alert('심박수 저장 실패: '+String(err.message||err))}
  finally{btn.disabled=false}
 });

 window.yurifV2={activateResearch,deactivateResearch,registrationHtml,labHtml,sessionHtml,renderParticipant,stopParticipant,state,selectExperiment};
}
