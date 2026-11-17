import {installYurifV2} from './experiment-v2-controller.js?v=1';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInAnonymously,signOut} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,onSnapshot,writeBatch,setDoc,serverTimestamp,query,where} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const firebaseConfig = {
 apiKey:"AIzaSyCXtS-9hwvCb4c3NIOaSEkHUNejdGQHimA",
 authDomain:"eureka-research-program.firebaseapp.com",
 projectId:"eureka-research-program",
 storageBucket:"eureka-research-program.firebasestorage.app",
 messagingSenderId:"461187144553",
 appId:"1:461187144553:web:b2536e34b0328987b17bf8",
 measurementId:"G-H3EWS0Y2QN"
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app),store=getFirestore(app);
const types=['journal','sessions','equipment','results','references','sensoryEnvironments','experimenters','labRuns','journalBoard','dashboardNotes','protocolNotes'];
const choices=[
 ['home','연구 소개'],['protocol','실험 설계'],['equipment','장비 소개'],['journal','연구 일지 소개'],
 ['lab','실험 방법'],['sessions','실험 세션 소개'],['analysis','분석 결과'],['references','참고자료']
];
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={member:null,unsubs:[],cache:{},pending:new Set(),queued:null,writeJob:null,busy:false,ready:false,started:false,guestUnsub:null,publicDoc:{sections:{}}};
window.yurifCloud={ready:false,status:'연결 중',initialData:null,queueSave};
installYurifV2({auth,store});

function show(screen){
 for(const id of ['entry-screen','login-screen','guest-screen','workspace'])$(id).hidden=id!==screen;
 if(screen!=='workspace')document.body.classList.remove('yurif-workspace-active');
 else document.body.classList.add('yurif-workspace-active');
}
function error(message){$('auth-message').textContent=message||''}
function friendly(e){
 const code=e?.code||'';
 if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return '이메일이나 비밀번호를 확인해 주세요.';
 if(code==='auth/too-many-requests')return '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.';
 if(code==='permission-denied')return '접근 권한이 없습니다. 관리자에게 계정 승인 상태와 보안 규칙을 확인해 주세요.';
 return '요청에 실패했습니다: '+(e?.message||String(e));
}
$('go-admin').addEventListener('click',()=>{show('login-screen');$('login-email').focus()});
$('go-guest').addEventListener('click',()=>{show('guest-screen');watchPublic()});
document.querySelectorAll('[data-go-back]').forEach(b=>b.addEventListener('click',()=>show('entry-screen')));
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();error('로그인 확인 중…');
 const btn=$('login-submit');btn.disabled=true;
 try{await signInWithEmailAndPassword(auth,$('login-email').value.trim(),$('login-password').value)}
 catch(ex){error(friendly(ex))}
 finally{btn.disabled=false;$('login-password').value=''}
});
$('logout').addEventListener('click',async()=>{cleanup();await signOut(auth);show('entry-screen')});
$('open-admin-settings').addEventListener('click',()=>{if(state.member?.role==='admin'){show('workspace');$('admin-drawer').hidden=false;renderAdmin();renderTeamMemberManager()}});
$('close-admin-settings').addEventListener('click',()=>$('admin-drawer').hidden=true);
$('admin-publish').addEventListener('click',publish);
$('guest-refresh').addEventListener('click',()=>{watchPublic(true)});

function cleanup(){
 deactivateGsrSharing();
 window.yurifV2?.deactivateResearch();
 state.unsubs.forEach(fn=>fn());state.unsubs=[];state.cache={};state.pending.clear();state.started=false;state.ready=false;state.member=null;
 window.yurifCloud.ready=false;window.yurifCloud.initialData=null;
 clearTimeout(timer);state.queued=null;
 $('workspace').hidden=true;$('admin-drawer').hidden=true;
}
onAuthStateChanged(auth,async user=>{
 if(user?.isAnonymous){if(!$('participant-screen').hidden)return;show('entry-screen');return}
 if(!user){if(state.ready)cleanup();return}
 if(state.started)return;
 state.started=true;error('관리자·연구원 권한 확인 중…');
 try{
  const snap=await getDoc(doc(store,'members',user.uid));
  const member=snap.exists()?snap.data():null;
  if(!member?.active||!['admin','researcher'].includes(member.role)){
   if(researcherSigningUp){state.started=false;return}
   await signOut(auth);state.started=false;
   show('login-screen');error('아직 승인된 연구팀 계정이 아닙니다. Firestore members 문서의 UID, role, active를 확인해 주세요.');return;
  }
  state.member=member;
  try{const publicSnapshot=await getDoc(doc(store,'publicContent','site'));state.publicDoc=publicSnapshot.exists()?publicSnapshot.data():{sections:{}}}catch(ex){state.publicDoc={sections:{}}}
  $('cloud-user').textContent=user.email||'연구원';
  $('open-admin-settings').hidden=member.role!=='admin';
  error('공동 연구 기록 불러오는 중…');
  const loaded={};
  await Promise.all(types.map(async type=>{
   const snapshot=await getDocs(collection(store,'teamData',type,'items'));
   const entries=snapshot.docs.map(d=>d.data().value).filter(x=>x&&typeof x==='object');
   state.cache[type]=new Map(entries.map(x=>[String(x.id),JSON.stringify(stripForCloud(x))]));
   loaded[type]=entries;
  }));
  window.yurifCloud.initialData=loaded;window.yurifCloud.ready=true;state.ready=true;window.yurifCloud.status='공동 데이터 연결됨';
  await loadWorkspace();
  show('workspace');
  activateGsrSharing();
  $('cloud-status').textContent='공동 데이터 연결됨';
  if(member.role==='admin'){renderAdmin();renderTeamMemberManager()}
  for(const type of types){
   const unsub=onSnapshot(collection(store,'teamData',type,'items'),snapshot=>{
    if(state.pending.has(type))return;
    const data=snapshot.docs.map(d=>d.data().value).filter(x=>x&&typeof x==='object');
    const nextCache=new Map(data.map(x=>[String(x.id),JSON.stringify(stripForCloud(x))]));
    const previous=state.cache[type]||new Map();
    const changed=nextCache.size!==previous.size||[...nextCache].some(([id,value])=>previous.get(id)!==value);
    if(!changed)return;
    state.cache[type]=nextCache;
    if(window.yurifCloudApply)window.yurifCloudApply(type,data);
   },e=>{$('cloud-status').textContent='동기화 오류: '+friendly(e)});
   state.unsubs.push(unsub);
  }
 }catch(ex){state.started=false;show('login-screen');error('공동 저장소 연결 실패: '+friendly(ex));}
});

async function loadWorkspace(){
 if(window.yurifCloudGetData){for(const type of types)window.yurifCloudApply(type,window.yurifCloud.initialData[type]||[]);return;}
 for(const src of ['adc-safety-journal-v2.js?v=1','app-cloud-ready-20261113.js?v=participant-team-complete-20261117','gsr-live-chart-20261113.js']){
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(src+' 파일을 불러오지 못했습니다'));document.body.append(s)});
 }
}
function stripForCloud(row){
 const copy=JSON.parse(JSON.stringify(row));
 // Raw sensor samples remain on the original measuring device.
 // Do not put unbounded physiological time series into Firestore documents.
 if(Array.isArray(copy.gsrSamples)){copy.gsrSampleCountTotal=copy.gsrSamples.length;delete copy.gsrSamples}
 if(Array.isArray(copy.gsrRawSamples)){copy.gsrRawSampleCountTotal=copy.gsrRawSamples.length;delete copy.gsrRawSamples}
 return copy;
}
let timer;
function queueSave(data){
 if(!state.ready||!state.member)return;
 state.queued=JSON.parse(JSON.stringify(data));
 clearTimeout(timer);
 timer=setTimeout(flush,450);
}
async function flush(){
 if(state.busy||!state.queued||!state.ready)return;
 state.busy=true;
 const next=state.queued;state.queued=null;
 const batches=[];
 for(const type of types){
  const rows=Array.isArray(next[type])?next[type]:[];
  const old=state.cache[type]||new Map();
  const present=new Map(rows.filter(x=>x&&x.id!=null).map(x=>[String(x.id),stripForCloud(x)]));
  const changed=[...present].filter(([id,v])=>JSON.stringify(v)!==old.get(id));
  const removed=[...old.keys()].filter(id=>!present.has(id));
  if(changed.length||removed.length){
   state.pending.add(type);
   batches.push({type,changed,removed});
  }
 }
 try{
  for(const {type,changed,removed} of batches){
   const all=[...changed.map(([id,value])=>({id,value})),...removed.map(id=>({id,deleted:true}))];
   for(let i=0;i<all.length;i+=350){
    const batch=writeBatch(store);
    for(const item of all.slice(i,i+350)){
     const ref=doc(store,'teamData',type,'items',item.id);
     if(item.deleted)batch.delete(ref);
     else {
      const bytes=JSON.stringify(item.value).length;
      if(bytes>750000)throw new Error('저장 항목 '+type+' / '+item.id+'의 크기가 너무 큽니다. JSON 백업을 먼저 다운로드해 주세요.');
      batch.set(ref,{value:item.value,updatedAt:serverTimestamp()});
     }
    }
    await batch.commit();
   }
   const latest=await getDocs(collection(store,'teamData',type,'items'));
   const records=latest.docs.map(d=>d.data().value);
   state.cache[type]=new Map(records.map(x=>[String(x.id),JSON.stringify(stripForCloud(x))]));
   state.pending.delete(type);
   if(!state.queued&&window.yurifCloudApply)window.yurifCloudApply(type,records);
  }
  $('cloud-status').textContent='공동 데이터 저장됨';
 }catch(e){
  $('cloud-status').textContent='저장 오류 — JSON 백업 권장';
  alert('공동 데이터 저장 실패: '+friendly(e)+'\n로컬 백업을 확인해 주세요.');
 }finally{
  for(const {type} of batches)state.pending.delete(type);
  state.busy=false;
  if(state.queued)setTimeout(flush,100);
 }
}
function watchPublic(force=false){
 if(state.guestUnsub&&!force)return;
 if(state.guestUnsub){state.guestUnsub();state.guestUnsub=null}
 state.guestUnsub=onSnapshot(doc(store,'publicContent','site'),snapshot=>{
  state.publicDoc=snapshot.exists()?snapshot.data():{sections:{}};
  drawPublic();
 },e=>{$('guest-list').textContent=friendly(e)});
}
function drawPublic(){
 const sections=state.publicDoc.sections||{};
 const shown=choices.filter(([id])=>sections[id]?.enabled);
 $('guest-list').innerHTML=shown.length?shown.map(([id,name])=>{
  const item=sections[id];
  return '<article class="yurif-public-card"><h3>'+safe(item.title||name)+'</h3><p>'+safe(item.body||'').replace(/\n/g,'<br>')+'</p></article>';
 }).join(''):'<div class="yurif-empty">관리자가 아직 공개한 연구 자료가 없습니다.</div>';
}
function renderAdmin(){
 const sections=state.publicDoc.sections||{};
 $('admin-sections').innerHTML=choices.map(([id,name])=>{
  const current=sections[id]||{};
  return '<div class="yurif-public-editor"><label><input type="checkbox" data-public-enable="'+id+'" '+(current.enabled?'checked':'')+'> '+name+' 공개</label>'+
  '<input data-public-title="'+id+'" maxlength="100" value="'+safe(current.title||name)+'" aria-label="'+name+' 제목">'+
  '<textarea data-public-body="'+id+'" rows="3" maxlength="4000" placeholder="일반 방문자에게 보여줄 설명문만 직접 작성하세요."></textarea></div>';
 }).join('');
 for(const [id] of choices){const ta=document.querySelector('[data-public-body="'+id+'"]');if(ta)ta.value=sections[id]?.body||''}
}
async function publish(){
 if(state.member?.role!=='admin')return;
 const sections={};
 for(const [id,name] of choices){
  const enabled=document.querySelector('[data-public-enable="'+id+'"]')?.checked||false;
  const title=document.querySelector('[data-public-title="'+id+'"]')?.value.trim()||name;
  const body=document.querySelector('[data-public-body="'+id+'"]')?.value.trim()||'';
  if(enabled&&!body){alert('공개할 '+name+' 항목의 설명문을 입력해 주세요.');return}
  sections[id]={enabled,title,body};
 }
 if(!confirm('선택한 글이 로그인하지 않은 모든 방문자에게 공개됩니다. 참가자 정보와 원시 생체 데이터를 포함하지 않았는지 확인했나요?'))return;
 const btn=$('admin-publish');btn.disabled=true;
 try{
  await setDoc(doc(store,'publicContent','site'),{sections,updatedAt:serverTimestamp()});
  state.publicDoc={sections};alert('공개 범위가 저장되었습니다.');
 }catch(e){alert('공개 설정 저장 실패: '+friendly(e))}
 finally{btn.disabled=false}
}


/* GSR raw-data sharing for authorized team members only.
 * Existing Firestore rules permit isMember() under teamData/{document=**}.
 * 200-sample chunks ensure each document stays comfortably below 1 MiB.
 */
const GSR_CHUNK=200;
const gsrShared={
 runs:[],selected:'',points:[],chunks:[],offRuns:null,offSamples:null,
 interval:null,inflight:new Map(),verified:new Map(),notice:'',lastRender:0
};
const gsrRunRef=id=>doc(store,'teamData','gsrRunIndex','items',String(id));
const gsrChunks=collection(store,'teamData','gsrRawChunks','items');
const gsrIndex=collection(store,'teamData','gsrRunIndex','items');
function gsrPanel(){
 if(!state.ready)return '<section class="panel"><h2>팀 공유 GSR 원시자료</h2><p>연구원 로그인 후 사용할 수 있습니다.</p></section>';
 const selected=gsrShared.runs.find(r=>r.id===gsrShared.selected);
 const n=gsrShared.points.length,vals=gsrShared.points.map(p=>p[1]);
 const mean=n?(vals.reduce((x,y)=>x+y,0)/n).toFixed(2):'—';
 const status=selected?(selected.endedAt?'실험 종료':'실험 진행 중'):'실험 선택 전';
 return '<section class="panel" id="gsr-team-panel">'+
 '<div class="entry-head"><div><h2>팀 공유 GSR 원시자료 · 실시간 조회</h2><p class="muted">승인된 관리자·연구원만 접근 · Arduino ADC 원시값(0~1023, µS 아님)</p></div></div>'+
 '<div class="formgrid"><div class="field"><label>다른 컴퓨터에서 공유된 실험 선택</label><select id="gsr-team-select"><option value="">공유 실험 선택</option>'+
 gsrShared.runs.map(r=>'<option value="'+safe(r.id)+'"'+(r.id===gsrShared.selected?' selected':'')+'>'+safe(r.date||'')+' · '+safe(r.code||'실험')+' · '+safe(r.mode==='pilot'?'예비실험':r.mode==='stage1'?'1차 실험':'2차 실험')+(r.endedAt?' · 종료':' · 진행 중')+'</option>').join('')+
 '</select></div></div>'+
 (gsrShared.runs.length?'':'<p class="muted">아직 팀에 공유된 GSR 실험이 없습니다. 새 실험 중에는 약 8초 간격으로 전송을 시도하며, 기존 기록은 실험실 아카이브에서 직접 공유할 수 있습니다.</p>')+
 (selected?'<div class="gsr-live"><div><small>클라우드에 확인된 샘플</small><strong>'+n+' / '+(selected.sampleCount||0)+'</strong></div><div><small>ADC 평균</small><strong>'+mean+'</strong></div><div><small>실험 상태</small><strong>'+status+'</strong></div></div>'+
 '<div class="gsr-chart-box"><canvas id="gsr-team-chart" width="900" height="280" role="img" aria-label="공유된 GSR 원시 ADC 측정값 시간대별 그래프"></canvas></div>'+
 '<div class="actions"><button class="btn secondary" type="button" id="gsr-team-csv"'+(n?'':' disabled')+'>공유 원시값 CSV 다운로드</button></div>'+
 '<p class="muted">각 구간: '+(selected.steps||[]).map(s=>safe(s.label||'')+' '+safe(s.envName||s.name||'')).join(' · ')+'</p>':'')+
 (gsrShared.notice?'<p class="muted">'+safe(gsrShared.notice)+'</p>':'')+
 '<p class="muted">실험 진행 중 최신 데이터 반영에는 수 초가 걸릴 수 있습니다. 네트워크 장애 시 측정 컴퓨터의 원본은 별도로 유지됩니다.</p></section>';
}
window.yurifGsrSharedPanel=gsrPanel;
function drawGsrShared(){
 const canvas=document.getElementById('gsr-team-chart');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const width=Math.max(320,Math.floor(canvas.getBoundingClientRect().width||840));
 const height=Math.max(180,Math.round(width*.34)),dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#FAFCFE';ctx.fillRect(0,0,width,height);
 const pts=gsrShared.points;
 if(!pts.length){ctx.fillStyle='#637A8C';ctx.textAlign='center';ctx.font='13px system-ui';ctx.fillText('아직 서버에서 읽은 측정값이 없습니다.',width/2,height/2);return}
 const left=47,right=14,top=15,bottom=30,W=width-left-right,H=height-top-bottom;
 const start=pts[0][0],end=Math.max(start+1,pts[pts.length-1][0]);
 const X=t=>left+W*(t-start)/(end-start),Y=v=>top+H*(1-v/1023);
 ctx.font='11px system-ui';ctx.textAlign='right';ctx.textBaseline='middle';
 for(const tick of [0,256,512,768,1023]){const y=Y(tick);ctx.strokeStyle='#DEEAF3';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillStyle='#60778C';ctx.fillText(String(tick),left-6,y)}
 const selected=gsrShared.runs.find(r=>r.id===gsrShared.selected);
 for(const step of selected?.steps||[]){if(!step.startedAt)continue;const x=X(step.startedAt);if(x<left||x>width-right)continue;ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle='#C57E4B';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+H);ctx.stroke();ctx.restore();ctx.fillStyle='#A4603B';ctx.textAlign='left';ctx.fillText(String(step.label||''),x+4,top+10)}
 ctx.beginPath();ctx.strokeStyle='#246B9A';ctx.lineWidth=1.8;
 const stride=Math.max(1,Math.ceil(pts.length/1700));
 for(let i=0;i<pts.length;i+=stride){const p=pts[i];if(i===0)ctx.moveTo(X(p[0]),Y(p[1]));else ctx.lineTo(X(p[0]),Y(p[1]))}
 const tail=pts[pts.length-1];ctx.lineTo(X(tail[0]),Y(tail[1]));ctx.stroke();
 ctx.fillStyle='#60778C';ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText('0초',left,height-bottom+7);ctx.textAlign='right';ctx.fillText(((end-start)/1000).toFixed(1)+'초',width-right,height-bottom+7);
}
function refreshGsrShared(){
 const panel=document.getElementById('gsr-team-panel');if(!panel)return;
 panel.outerHTML=gsrPanel();drawGsrShared();
}
function selectGsrShared(id){
 if(gsrShared.offSamples){gsrShared.offSamples();gsrShared.offSamples=null}
 gsrShared.selected=id;gsrShared.points=[];gsrShared.notice='';
 if(!id){refreshGsrShared();return}
 const q=query(gsrChunks,where('runId','==',id));
 gsrShared.offSamples=onSnapshot(q,snapshot=>{
  const chunks=snapshot.docs.map(d=>d.data()).filter(r=>Array.isArray(r.points)).sort((a,b)=>a.index-b.index);
  const pts=[];for(const chunk of chunks)for(const p of chunk.points)if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))pts.push(p);
  gsrShared.points=pts;
  refreshGsrShared();
 },e=>{gsrShared.notice='원시값 조회 실패: '+friendly(e);refreshGsrShared()});
 refreshGsrShared();
}
// Pending cloud uploads are recorded locally and retried after reconnection.
const PENDING_GSR_KEY='yurif_adc_pending_cloud_v2';
const pendingGsr=()=>{
 try{return JSON.parse(localStorage.getItem(PENDING_GSR_KEY)||'[]').filter(x=>typeof x==='string')}catch{return []}
};
function storePendingGsr(ids){
 try{localStorage.setItem(PENDING_GSR_KEY,JSON.stringify([...new Set(ids)]))}catch(e){console.warn('원시 ADC 재전송 목록 저장 실패',e)}
}
function queuePendingGsr(id){if(!id)return;storePendingGsr([...pendingGsr(),String(id)])}
function clearPendingGsr(id){storePendingGsr(pendingGsr().filter(x=>x!==String(id)))}
let retryingGsr=false;
async function retryPendingGsr(){
 if(retryingGsr||!state.ready||!navigator.onLine)return;
 retryingGsr=true;
 try{
  for(const id of pendingGsr()){
   const archive=window.yurifFindGsrRun?.(id);
   if(!archive)continue;
   let run=archive;
   if(!run.gsrSamples?.length&&window.yurifSafeAdc){
    const rows=await window.yurifSafeAdc.readRun(id);
    if(rows.length)run={...archive,gsrSamples:rows.map(x=>[x.time,x.adc,x.phase,x.segmentId])};
   }
   if(!run?.gsrSamples?.length)continue;
   try{
    await uploadGsrRun(run);
    await verifyFullGsrRun(run);
    clearPendingGsr(id);
   }catch(e){console.warn('원시 ADC 재전송 실패:',id,e?.message||e);break}
  }
 }finally{retryingGsr=false}
}
window.addEventListener('online',()=>retryPendingGsr().catch(()=>{}));
function activateGsrSharing(){
 if(gsrShared.offRuns)return;
 gsrShared.offRuns=onSnapshot(gsrIndex,snapshot=>{
  gsrShared.runs=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));
  refreshGsrShared();
 },e=>{gsrShared.notice='공유 실험 목록 조회 실패: '+friendly(e);refreshGsrShared()});
 gsrShared.interval=setInterval(()=>{
  if(!state.ready||!auth.currentUser)return;
  retryPendingGsr().catch(()=>{});
  const run=window.yurifGetActiveGsrRun?.();
  if(run?.startedAt&&!run.endedAt&&Array.isArray(run.gsrSamples)&&run.gsrSamples.length)uploadGsrRun(run).catch(()=>{});
 },8000);
}
function deactivateGsrSharing(){
 if(gsrShared.offRuns){gsrShared.offRuns();gsrShared.offRuns=null}
 if(gsrShared.offSamples){gsrShared.offSamples();gsrShared.offSamples=null}
 if(gsrShared.interval){clearInterval(gsrShared.interval);gsrShared.interval=null}
 gsrShared.runs=[];gsrShared.selected='';gsrShared.points=[];gsrShared.verified.clear();
}
async function uploadGsrRun(run){
 if(!state.ready||!auth.currentUser)throw new Error('승인된 연구원 로그인 필요');
 if(!run||!run.id||!Array.isArray(run.gsrSamples))throw new Error('GSR 원시값이 존재하지 않습니다');
 const id=String(run.id);
 const previous=gsrShared.inflight.get(id);
 if(previous){await previous;return uploadGsrRun(run)}
 const task=async()=>{
  const count=run.gsrSamples.length;
  const samples=run.gsrSamples.slice(0,count);
  const last=gsrShared.verified.get(id)||{count:0,signature:''};
  const signature=JSON.stringify([run.startedAt,run.endedAt,run.steps,run.code,run.mode]);
  if(count===last.count&&signature===last.signature)return {verified:true,count};
  const firstChunk=Math.max(0,Math.floor(Math.max(0,last.count-1)/GSR_CHUNK));
  const lastChunk=Math.floor(Math.max(0,count-1)/GSR_CHUNK);
  for(let index=firstChunk;index<=lastChunk&&count;index+=1){
   const points=samples.slice(index*GSR_CHUNK,(index+1)*GSR_CHUNK);
   if(!points.length)continue;
   await setDoc(doc(store,'teamData','gsrRawChunks','items',id+'__'+String(index).padStart(5,'0')),{runId:id,index,points,sampleCount:points.length});
  }
  const meta={id,code:String(run.code||'').slice(0,60),date:run.date||'',mode:run.mode,
   startedAt:run.startedAt||null,endedAt:run.endedAt||null,
   steps:(run.steps||[]).map(s=>({label:s.label||'',name:s.name||'',envName:s.envName||'',startedAt:s.startedAt||null,endedAt:s.endedAt||null})),
   sampleCount:count,updatedAt:serverTimestamp()};
  await setDoc(gsrRunRef(id),meta);
  const verified=await getDoc(gsrRunRef(id));
  const finalChunk=count?await getDoc(doc(store,'teamData','gsrRawChunks','items',id+'__'+String(lastChunk).padStart(5,'0'))):null;
  if(!verified.exists()||verified.data().sampleCount!==count||(count&&(!finalChunk?.exists()||finalChunk.data().points.length!==count-lastChunk*GSR_CHUNK)))throw new Error('서버 저장 개수 재확인 실패');
  gsrShared.verified.set(id,{count,signature});
  return {verified:true,count};
 };
 const promise=task();gsrShared.inflight.set(id,promise);
 try{return await promise}finally{if(gsrShared.inflight.get(id)===promise)gsrShared.inflight.delete(id)}
}
async function verifyFullGsrRun(run){
 if(!run?.id||!Array.isArray(run.gsrSamples))throw Error('검증할 원시 ADC 데이터가 없습니다.');
 const expected=run.gsrSamples,docs=await getDocs(query(gsrChunks,where('runId','==',String(run.id))));
 const chunks=docs.docs.map(d=>d.data()).sort((a,b)=>a.index-b.index);
 const n=Math.ceil(expected.length/GSR_CHUNK);
 if(chunks.length!==n)throw Error('서버 청크 수 불일치: '+chunks.length+' / '+n);
 let readCount=0;
 for(let i=0;i<n;i++){
  const chunk=chunks[i],start=i*GSR_CHUNK,items=expected.slice(start,start+GSR_CHUNK);
  if(chunk?.index!==i||!Array.isArray(chunk.points)||chunk.points.length!==items.length)
   throw Error('청크 '+i+' 누락 또는 개수 오류');
  for(let j=0;j<items.length;j++){
   const actual=chunk.points[j],wanted=items[j];
   if(!Array.isArray(actual)||actual[0]!==wanted[0]||actual[1]!==wanted[1])
    throw Error('청크 '+i+' · '+j+' 원시값 불일치');
  }
  readCount+=items.length;
 }
 const metadata=await getDoc(gsrRunRef(run.id));
 if(!metadata.exists()||metadata.data().sampleCount!==expected.length)throw Error('서버 인덱스와 ADC 수량 불일치');
 return {verified:true,count:readCount,chunks:n,checkedAt:Date.now()};
}
window.yurifGsrSharing={
 queuePending:queuePendingGsr,
 clearPending:clearPendingGsr,
 retryPending:retryPendingGsr,
 pending:pendingGsr,
 verifyFull:verifyFullGsrRun,
 upload:uploadGsrRun,
 status:id=>gsrShared.verified.get(id)||null
};
document.addEventListener('change',e=>{
 if(e.target.id==='gsr-team-select')selectGsrShared(e.target.value);
});
document.addEventListener('click',async e=>{
 const csv=e.target.closest('#gsr-team-csv');
 if(csv){
  const run=gsrShared.runs.find(r=>r.id===gsrShared.selected);if(!run)return;
  const lines=['timestamp_ms,iso_datetime,elapsed_seconds,segment,environment,adc_raw'];
  for(const [t,v] of gsrShared.points){
   const s=(run.steps||[]).find(x=>x.startedAt&&t>=x.startedAt&&t<(x.endedAt||run.endedAt||Infinity));
   const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
   lines.push([t,new Date(t).toISOString(),((t-run.startedAt)/1000).toFixed(3),quote(s?.label||''),quote(s?.envName||s?.name||''),v].join(','));
  }
  const file=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='yurif-shared-gsr-'+(run.date||'')+'-'+(run.code||'experiment')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);return;
 }
 const b=e.target.closest('[data-gsr-share]');
 if(!b)return;
 const id=b.dataset.gsrShare;
 const run=window.yurifFindGsrRun?.(id);
 if(!run)return alert('이 컴퓨터에서 해당 실험 원본을 찾지 못했습니다.');
 if(!confirm('이 실험의 GSR 원시값 '+(run.gsrSamples?.length||0)+'개를 승인된 연구원들과 공유할까요? 참가자의 동의와 익명 코드 사용 여부를 확인해 주세요.'))return;
 b.disabled=true;b.textContent='클라우드로 전송 중…';
 try{const result=await uploadGsrRun(run);alert('서버 저장 확인 완료: GSR 원시값 '+result.count+'개. 연구원은 팀 공유 GSR 원시자료 메뉴에서 볼 수 있습니다.');}
 catch(err){alert('서버 업로드 실패: '+friendly(err)+'\n원본은 이 컴퓨터에 남아 있습니다. 다시 시도해 주세요.')}
 finally{b.disabled=false;b.textContent='팀원과 GSR 원시값 공유'}
});

/* Participant portal. Anonymous Firebase auth is REQUIRED.
   An entry key is a cryptographically random 128-bit bearer capability,
   not the human-readable P01 code. Never expose records to public visitors. */
let researcherSigningUp=false;
$('researcher-signup-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const email=$('signup-email').value.trim(),password=$('signup-password').value;
 const btn=$('signup-submit');btn.disabled=true;researcherSigningUp=true;
 $('signup-message').textContent='계정 생성 중…';
 try{
  const result=await createUserWithEmailAndPassword(auth,email,password);
  const uid=result.user.uid;
  $('signup-message').textContent='계정이 생성되었습니다. 관리자에게 다음 UID를 전달하세요: '+uid+' / 관리자 승인 후 로그인할 수 있습니다.';
  window.yurifLastSignupUid=uid;
  await signOut(auth);
  show('login-screen');
  $('signup-message').textContent='계정 생성 완료 · 승인 대기. 관리자에게 UID '+uid+' 를 전달해 주세요.';
 }catch(ex){$('signup-message').textContent='계정 생성 실패: '+friendly(ex)}
 finally{researcherSigningUp=false;btn.disabled=false;$('signup-password').value=''}
});
const participantState={key:'',plan:null,consent:null,answers:new Map(),adminPlans:[],adminSelected:'',adminRows:[],adminBusy:false};
const participantPlanRef=key=>doc(store,'participantAccess',key);
const participantConsentRef=key=>doc(store,'participantConsents',key);
const participantAnswerRef=(key,slot)=>doc(store,'participantAnswers',key,'items',slot);
const participantAnswersRef=key=>collection(store,'participantAnswers',key,'items');
const portalMsg=value=>{const el=$('participant-message');if(el)el.textContent=value||''};
const shortText=value=>safe(String(value||''));
const participantSurveySlots=plan=>plan?.stage==='stage1'
 ?(plan.order||[]).map((name,i)=>({slot:'s'+i,title:'감각 환경 '+(i+1)+' / '+name,env:name,index:i}))
 :[{slot:'final',title:'2차 실험 · 대화 종료 후 설문',env:'대화 종료 후',index:0}];

async function enterParticipantPortal(){
 show('participant-screen');portalMsg('');
 if(auth.currentUser&&!auth.currentUser.isAnonymous){portalMsg('이 브라우저에서는 연구원으로 로그인되어 있습니다. 연구원 로그아웃 후 참가자 모드에 입장해 주세요.');return}
 try{
  if(!auth.currentUser)await signInAnonymously(auth);
  portalMsg('입장 코드를 입력해 주세요.');
 }catch(e){portalMsg('참가자 인증 실패. Firebase Authentication에서 익명 인증을 활성화해야 합니다. '+friendly(e))}
}
$('go-participant').addEventListener('click',enterParticipantPortal);
$('participant-exit').addEventListener('click',async()=>{
 window.yurifV2?.stopParticipant();
 participantState.key='';participantState.plan=null;participantState.consent=null;participantState.answers=new Map();
 $('participant-steps').innerHTML='';$('participant-access-code').value='';$('participant-entry-form').hidden=false;portalMsg('');
 // Preserve anonymous session so an accidental exit does not lock the participant out of the one-time consent record.
 show('entry-screen');
});
$('participant-entry-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!auth.currentUser?.isAnonymous)return portalMsg('참가자 인증이 필요합니다. 연구원 계정과 별도의 브라우저에서 접속해 주세요.');
 const key=$('participant-access-code').value.trim().toLowerCase().replaceAll('-','');
 const code=$('participant-code')?.value.trim()||'';
 if(!/^[0-9a-f]{32}$/.test(key))return portalMsg('연구원에게 받은 32자리 입장 코드를 정확히 입력해 주세요.');
 const btn=$('participant-enter-btn');btn.disabled=true;portalMsg('참가 정보를 확인하는 중…');
 try{
  const snap=await getDoc(participantPlanRef(key));
  if(!snap.exists()||snap.data().active!==true)throw Error('활성화된 참가 코드가 아닙니다.');
  if(snap.data().v2&&code!==snap.data().code)throw Error('참가자 코드와 임시 비밀번호가 일치하지 않습니다.');
  participantState.key=key;participantState.plan=snap.data();
  const consentSnap=await getDoc(participantConsentRef(key));
  participantState.consent=consentSnap.exists()?consentSnap.data():null;
  if(participantState.consent&&participantState.consent.uid!==auth.currentUser.uid)
   throw Error('이미 다른 참가자 세션에서 사용된 입장 코드입니다. 연구원에게 문의해 주세요.');
  participantState.answers=new Map();
  if(participantState.consent?.agreed){
   const response=await getDocs(participantAnswersRef(key));
   for(const item of response.docs)participantState.answers.set(item.id,item.data());
  }
  $('participant-entry-form').hidden=true;portalMsg('참가 코드 확인 완료');
  renderParticipantSteps();
 }catch(ex){portalMsg('입장할 수 없습니다: '+friendly(ex))}
 finally{btn.disabled=false}
});
function renderParticipantSteps(){
 const root=$('participant-steps'),plan=participantState.plan,consent=participantState.consent;
 if(!root||!plan)return;
 if(!consent){
  root.innerHTML='<section class="panel"><h2>사전 안내서 확인하기</h2>'+
   '<details id="participant-info"><summary>사전 안내서 열기</summary><div class="participant-consent-copy">'+shortText(plan.consentText).replace(/\n/g,'<br>')+'</div></details>'+
   '<label class="participant-confirm"><input type="checkbox" id="participant-read-check"> 안내서를 읽고 연구 목적·절차·중단 권리를 확인했습니다.</label>'+
   '<div class="actions"><button type="button" class="btn" id="participant-agree">동의</button>'+
   '<button type="button" class="btn secondary" id="participant-decline">비동의</button></div>'+
   '<p class="muted">동의하지 않으면 설문이 시작되지 않습니다. 참여는 자발적이며, 중단을 원하면 연구원에게 알려 주세요.</p></section>';
  return;
 }
 if(!consent.agreed){
  root.innerHTML='<section class="panel"><h2>동의하지 않음</h2><p>동의하지 않았으므로 실험 설문을 진행하지 않습니다. 참여를 원하지 않는다는 이유로 불이익이 없어야 합니다.</p></section>';return;
 }
 if(plan.v2){window.yurifV2?.renderParticipant({key:participantState.key,plan,consent});return;}
 const slots=participantSurveySlots(plan),next=slots.find(x=>!participantState.answers.has(x.slot));
 if(!next){
  root.innerHTML='<section class="panel"><h2>모든 설문 완료</h2><p>응답이 서버에 저장되었습니다. 연구원의 안내를 따라 주세요.</p>'+
   '<p class="muted">총 '+slots.length+'개 설문 응답 완료</p></section>';return;
 }
 const completed=slots.filter(x=>participantState.answers.has(x.slot)).length;
 root.innerHTML='<section class="panel"><h2>'+shortText(next.title)+'</h2>'+
  '<p>진행 상태: '+completed+' / '+slots.length+' 완료</p>'+
  (plan.stage==='stage1'?'<p>해당 감각 환경 체험을 마친 뒤 아래 설문에 답하고 다음 단계로 넘어가세요.</p>':'<p>전체 대화가 끝난 후에만 아래 설문에 응답해 주세요.</p>')+
  '<form id="participant-survey-form"><div class="field"><label>'+shortText(plan.valenceQuestion||'현재 느끼는 쾌·불쾌 정도 (1 매우 불쾌 ~ 9 매우 쾌적)')+'</label>'+
  '<input name="valence" type="number" min="1" max="9" step="1" required></div>'+
  '<div class="field"><label>'+shortText(plan.arousalQuestion||'현재 각성 수준 (1 매우 낮음 ~ 9 매우 높음)')+'</label>'+
  '<input name="arousal" type="number" min="1" max="9" step="1" required></div>'+
  (plan.stage==='stage2'?'<div class="field"><label>'+shortText(plan.likingQuestion||'대화 상대에 대한 호감 정도 (1 매우 낮음 ~ 9 매우 높음)')+'</label><input name="liking" type="number" min="1" max="9" step="1" required></div>':'')+
  '<label class="participant-confirm"><input type="checkbox" name="finished" value="yes" required> '+(plan.stage==='stage1'?'위 감각 환경의 체험을 마친 후 응답했습니다.':'전체 대화를 마친 후 응답했습니다.')+'</label>'+ 
  '<div class="field"><label>추가 느낌 · 특이사항 (선택)</label><textarea name="note" maxlength="1000"></textarea></div>'+
  '<button type="submit" class="btn" id="participant-survey-save">'+(completed===slots.length-1?'최종 설문 저장':'응답 저장하고 다음 단계')+'</button></form></section>';
}
async function recordParticipantConsent(agreed){
 if(!participantState.plan||!participantState.key||!auth.currentUser?.isAnonymous)return;
 if(agreed&&!$('participant-read-check')?.checked)return portalMsg('안내서 확인란에 먼저 체크해 주세요.');
 const data={uid:auth.currentUser.uid,agreed,createdAt:serverTimestamp()};
 try{
  await setDoc(participantConsentRef(participantState.key),data);
  const stored=await getDoc(participantConsentRef(participantState.key));
  if(!stored.exists()||stored.data().agreed!==agreed)throw Error('동의 기록 확인 실패');
  participantState.consent=stored.data();portalMsg(agreed?'동의 응답 저장 확인 완료':'비동의 응답 저장 확인 완료');
  renderParticipantSteps();
 }catch(e){portalMsg('동의 기록 저장 실패: '+friendly(e)+' · 저장 확인 전에는 다음 단계로 진행할 수 없습니다.')}
}
async function recordParticipantAnswer(form){
 if(!participantState.plan||!participantState.consent?.agreed)return;
 const next=participantSurveySlots(participantState.plan).find(x=>!participantState.answers.has(x.slot));
 if(!next)return;
 const values=Object.fromEntries(new FormData(form));
 if(values.finished!=='yes')return portalMsg('해당 실험 구간이 끝났음을 확인한 뒤 설문을 저장해 주세요.');
 const valence=Number(values.valence),arousal=Number(values.arousal),liking=values.liking==null?null:Number(values.liking);
 if(![valence,arousal].every(v=>Number.isInteger(v)&&v>=1&&v<=9)||(liking!==null&&(!Number.isInteger(liking)||liking<1||liking>9)))return portalMsg('설문 점수는 1~9 사이의 정수로 입력해 주세요.');
 const button=$('participant-survey-save');button.disabled=true;portalMsg('응답 저장 중…');
 const answer={uid:auth.currentUser.uid,slot:next.slot,environment:next.env,index:next.index,
  stage:participantState.plan.stage,finishedConfirmed:true,valence,arousal,liking:liking===null?'':liking,
  note:String(values.note||'').slice(0,1000),createdAt:serverTimestamp()};
 try{
  await setDoc(participantAnswerRef(participantState.key,next.slot),answer);
  const check=await getDoc(participantAnswerRef(participantState.key,next.slot));
  if(!check.exists()||check.data().valence!==valence||check.data().arousal!==arousal)throw Error('응답 저장 확인 실패');
  participantState.answers.set(next.slot,check.data());portalMsg('응답 '+(participantState.answers.size)+'개 저장 확인 완료');
  renderParticipantSteps();
 }catch(e){portalMsg('응답 저장 실패: '+friendly(e)+' · 저장 성공 전에는 다음 설문으로 넘어가지 않습니다.');button.disabled=false}
}
document.addEventListener('click',e=>{
 if(e.target?.id==='participant-agree')recordParticipantConsent(true);
 if(e.target?.id==='participant-decline')recordParticipantConsent(false);
});
document.addEventListener('submit',e=>{
 if(e.target?.id!=='participant-survey-form')return;
 e.preventDefault();recordParticipantAnswer(e.target);
});

function participantAdminHtml(){
 return '<section class="panel"><h2>실험 참가자 등록 및 설문 순서 설정</h2>'+
 '<p class="muted">연구용 참가자 코드(P01 등)와 추측하기 어려운 별도의 입장 코드를 발급합니다. 입장 코드를 받은 사람만 본인 설문에 접근할 수 있습니다. 실명은 입력하지 마세요.</p>'+
 '<form id="participant-plan-form"><div class="formgrid"><div class="field"><label>연구용 참가자 코드</label><input name="code" maxlength="30" required placeholder="P01"></div>'+
 '<div class="field"><label>실험 단계</label><select name="stage" id="participant-plan-stage"><option value="stage1">1차 감각 환경 실험</option><option value="stage2">2차 대화 실험</option></select></div></div>'+
 '<div class="field"><label>참가자에게 적용할 감각 환경 순서 (1차 실험 · 한 줄에 하나씩)</label><textarea name="order" rows="5" placeholder="조도 300 lx · 4000 K&#10;조용한 교실&#10;바닐라 향" required></textarea></div>'+
 '<div class="field"><label>사전 안내서 및 동의 설명문 (직접 작성 · 필수)</label><textarea name="consentText" rows="7" required placeholder="연구 목적, 실험 절차와 시간, 측정 자료 및 설문 저장 방식, 예상되는 불편, 자발적 참여와 중단 권리, 문의 방법, 보존 기간을 정확히 작성하세요."></textarea></div>'+
 '<div class="field"><label>쾌·불쾌 설문 문항</label><input name="valenceQuestion" maxlength="240" value="현재 느끼는 쾌·불쾌 정도 (1 매우 불쾌 ~ 9 매우 쾌적)"></div>'+
 '<div class="field"><label>각성 설문 문항</label><input name="arousalQuestion" maxlength="240" value="현재 각성 수준 (1 매우 낮음 ~ 9 매우 높음)"></div>'+
 '<div class="field"><label>대인 호감 설문 문항 (2차)</label><input name="likingQuestion" maxlength="240" value="대화 상대에 대한 호감 정도 (1 매우 낮음 ~ 9 매우 높음)"></div>'+
 '<button type="submit" class="btn" id="participant-plan-create">참가자 등록 · 입장 코드 발급</button></form></section>'+
 '<section class="panel"><div class="entry-head"><div><h2>참가자별 설문 및 생리 측정 결과</h2><p class="muted">설문과 같은 참가자 코드의 GSR 기록을 함께 확인합니다. 구간 매칭은 환경명·시각을 검토해야 합니다.</p></div><button type="button" class="btn secondary" id="participant-admin-refresh">목록 새로고침</button></div>'+
 '<div id="participant-admin-list">'+(participantState.adminPlans.length?participantState.adminPlans.map(p=>
  '<div class="lab-archive-item"><strong>'+shortText(p.code)+'</strong> · '+(p.stage==='stage1'?'1차':'2차')+' · '+(p.order||[]).length+'개 조건'+
  '<p class="muted">상태: '+(p.active?'활성':'접근 중지')+'</p><p class="muted">입장 코드: <code>'+shortText(p.key)+'</code></p>'+
  '<div class="actions"><button type="button" class="btn secondary" data-participant-copy="'+shortText(p.key)+'">입장 코드 복사</button>'+
  '<button type="button" class="btn secondary" data-participant-results="'+shortText(p.key)+'">동의·응답·GSR 조회</button>'+(state.member?.role==='admin'&&p.active?'<button type="button" class="btn secondary" data-participant-deactivate="'+shortText(p.key)+'">참가 코드 사용 중지</button>':'')+'</div></div>').join(''):'<p class="muted">등록된 참가자가 없거나 아직 목록을 불러오지 못했습니다.</p>')+'</div>'+
 '<div id="participant-admin-results">'+(participantState.adminRows||[]).join('')+'</div></section>';
}
window.yurifParticipantAdminHtml=participantAdminHtml;
window.yurifParticipantSessionHtml=()=>'<section class="panel"><h2>참가자 설문 · GSR 통합 결과</h2><p class="muted">참가자의 사전 동의·감각 환경별 설문·GSR 원시값을 함께 확인합니다. 측정값은 보정 전 ADC입니다.</p><div class="formgrid"><div class="field"><label>참가자 선택</label><select id="participant-session-picker"><option value="">선택하세요</option>'+participantState.adminPlans.map(p=>'<option value="'+safe(p.key)+'">'+safe(p.code)+' · '+(p.stage==='stage1'?'1차':'2차')+'</option>').join('')+'</select></div></div><div id="participant-session-results" class="muted">등록된 참가자와 설문을 선택해 주세요.</div></section>';
async function refreshParticipantAdmin(){
 if(!state.ready)return;
 try{
  const snapshot=await getDocs(collection(store,'participantAccess'));
  participantState.adminPlans=snapshot.docs.map(d=>({key:d.id,...d.data()})).sort((a,b)=>String(a.code).localeCompare(String(b.code)));
  if(document.getElementById('content')&&window.yurifParticipantAdminRefreshView)window.yurifParticipantAdminRefreshView();
  const sessionPicker=$('participant-session-picker');if(sessionPicker){const prev=sessionPicker.value;sessionPicker.innerHTML='<option value="">선택하세요</option>'+participantState.adminPlans.map(p=>'<option value="'+safe(p.key)+'">'+safe(p.code)+' · '+(p.stage==='stage1'?'1차':'2차')+'</option>').join('');sessionPicker.value=prev;}
 }catch(ex){const node=$('participant-admin-list');if(node)node.textContent='참가자 목록 불러오기 실패: '+friendly(ex)}
}
window.yurifParticipantAdminLoad=refreshParticipantAdmin;
function participantAdminSelectStage(){
 const el=document.querySelector('#participant-plan-form [name=order]');
 if(!el)return;
 el.required=$('participant-plan-stage')?.value==='stage1';
 el.disabled=$('participant-plan-stage')?.value==='stage2';
 el.placeholder=el.disabled?'2차 실험은 대화 종료 후 설문 한 번만 표시됩니다.':'환경 순서대로 한 줄에 하나씩 입력하세요.';
}
document.addEventListener('change',e=>{if(e.target?.id==='participant-plan-stage')participantAdminSelectStage()});
document.addEventListener('submit',async e=>{
 if(e.target?.id!=='participant-plan-form')return;
 e.preventDefault();
 if(!state.ready||!state.member)return alert('승인된 연구원 계정으로 로그인해 주세요.');
 const d=Object.fromEntries(new FormData(e.target)),code=String(d.code||'').trim();
 const stage=d.stage==='stage2'?'stage2':'stage1';
 const order=stage==='stage1'?String(d.order||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean):['대화 종료'];
 const consentText=String(d.consentText||'').trim();
 if(!code||!order.length||!consentText)return alert('참가자 코드, 환경 순서, 안내서를 확인해 주세요.');
 if(participantState.adminPlans.some(p=>p.code===code&&p.stage===stage&&p.active))return alert('같은 참가자 코드·실험 단계가 이미 등록되어 있습니다. 기존 등록 정보를 확인해 주세요.');
 const key=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const plan={code,stage,order,consentText,active:true,valenceQuestion:String(d.valenceQuestion||'').slice(0,240),
  arousalQuestion:String(d.arousalQuestion||'').slice(0,240),likingQuestion:String(d.likingQuestion||'').slice(0,240),
  createdAt:serverTimestamp()};
 const button=$('participant-plan-create');button.disabled=true;
 try{
  await setDoc(participantPlanRef(key),plan);
  const check=await getDoc(participantPlanRef(key));
  if(!check.exists())throw Error('서버 저장 확인 실패');
  await refreshParticipantAdmin();
  alert('참가자 등록 완료. 입장 코드: '+key+'\n연구원 화면의 코드 복사 버튼으로 참가자에게 전달할 수 있습니다.');
 }catch(ex){alert('참가자 등록 실패: '+friendly(ex))}
 finally{button.disabled=false}
});
async function participantAdminRead(key,elementId='participant-admin-results'){
 const root=$(elementId);
 if(!root)return;
 root.textContent='동의 및 설문 응답을 불러오는 중…';
 const plan=participantState.adminPlans.find(p=>p.key===key);if(!plan)return;
 try{
  const [consentSnapshot,answerSnapshot,gsrSnapshot]=await Promise.all([
   getDoc(participantConsentRef(key)),getDocs(participantAnswersRef(key)),
   getDocs(query(gsrIndex,where('code','==',plan.code)))
  ]);
  const consent=consentSnapshot.exists()?consentSnapshot.data():null;
  const answers=new Map(answerSnapshot.docs.map(d=>[d.id,d.data()]));
  const runs=gsrSnapshot.docs.map(d=>d.data()).filter(r=>r.mode===plan.stage);
  let physiology=[];
  for(const run of runs){
   const chunkSnap=await getDocs(query(gsrChunks,where('runId','==',run.id)));
   const points=chunkSnap.docs.flatMap(d=>Array.isArray(d.data().points)?d.data().points:[]);
   for(const step of run.steps||[]){
    if(!step.startedAt||!step.endedAt)continue;
    const readings=points.filter(p=>Array.isArray(p)&&p[0]>=step.startedAt&&p[0]<step.endedAt);
    if(!readings.length)continue;
    physiology.push({name:step.envName||step.name||step.label,label:step.label,
      count:readings.length,mean:(readings.reduce((sum,p)=>sum+p[1],0)/readings.length).toFixed(2),
      min:Math.min(...readings.map(p=>p[1])),max:Math.max(...readings.map(p=>p[1])),run:run.id});
   }
  }
  const slots=participantSurveySlots(plan);
  root.innerHTML='<section class="panel"><h3>'+shortText(plan.code)+' · 설문·GSR 확인</h3>'+
   '<p>사전 동의: '+(!consent?'아직 응답 없음':consent.agreed?'동의':'비동의')+
   ' / 설문 완료: '+answers.size+' / '+slots.length+'</p>'+
   '<div class="tablewrap"><table><thead><tr><th>구간 · 환경</th><th>설문 저장</th><th>쾌·불쾌</th><th>각성</th><th>대인 호감</th><th>GSR ADC</th></tr></thead><tbody>'+
   slots.map(slot=>{
    const answer=answers.get(slot.slot);
    const candidates=physiology.filter(p=>p.name===slot.env);
    const matched=candidates.length===1?candidates[0]:null;
    return '<tr><td>'+shortText(slot.title)+'</td><td>'+(answer?'완료':'미응답')+'</td><td>'+(answer?answer.valence:'—')+
     '</td><td>'+(answer?answer.arousal:'—')+'</td><td>'+(answer&&answer.liking!==''?answer.liking:'—')+'</td>'+
     '<td>'+(matched?'평균 '+matched.mean+' · '+matched.count+'개 (최소 '+matched.min+', 최대 '+matched.max+')':(candidates.length>1?'동일 환경의 측정 구간이 여러 개여서 수동 확인 필요':'동일 환경명으로 자동 매칭되지 않음'))+'</td></tr>';
   }).join('')+'</tbody></table></div>'+
   '<p class="muted">GSR 수치는 보정 전 ADC이며, 같은 참가자 코드와 정확히 일치하는 환경명만 자동 연결합니다. 실험 구간 시각과 설문 응답 시각을 별도로 확인하세요. 맞지 않으면 임의로 합치지 않습니다.</p>'+
   (physiology.length?'<p class="muted">연결된 GSR 구간: '+physiology.map(p=>shortText(p.label)+' '+shortText(p.name)+'(평균 '+p.mean+')').join(', ')+'</p>':'')+
   '</section>';
 }catch(ex){root.textContent='설문·GSR 조회 실패: '+friendly(ex)}
}
document.addEventListener('change',async e=>{if(e.target?.id==='participant-session-picker'&&e.target.value)await participantAdminRead(e.target.value,'participant-session-results')});
document.addEventListener('click',async e=>{
 if(e.target?.id==='participant-admin-refresh'){await refreshParticipantAdmin();return}
 const copy=e.target?.closest('[data-participant-copy]');
 if(copy){try{await navigator.clipboard.writeText(copy.dataset.participantCopy);alert('입장 코드 복사 완료')}catch{alert('입장 코드: '+copy.dataset.participantCopy)}return}
 const deactivate=e.target?.closest('[data-participant-deactivate]');
 if(deactivate&&state.member?.role==='admin'){
  const key=deactivate.dataset.participantDeactivate;
  if(!confirm('이 참가자의 입장 코드를 비활성화할까요? 이미 저장된 동의·설문 데이터는 삭제되지 않습니다.'))return;
  try{const p=participantState.adminPlans.find(x=>x.key===key);if(!p)return;
   await setDoc(participantPlanRef(key),{code:p.code,stage:p.stage,order:p.order,consentText:p.consentText,active:false,valenceQuestion:p.valenceQuestion||'',arousalQuestion:p.arousalQuestion||'',likingQuestion:p.likingQuestion||'',createdAt:p.createdAt||serverTimestamp()});
   await refreshParticipantAdmin();alert('입장 코드 사용을 중지했습니다.');
  }catch(ex){alert('참가 코드 비활성화 실패: '+friendly(ex))}
  return;
 }
 const result=e.target?.closest('[data-participant-results]');
 if(result){await participantAdminRead(result.dataset.participantResults)}
});

async function renderTeamMemberManager(){
 if(state.member?.role!=='admin')return;
 const drawer=$('admin-drawer');if(!drawer)return;
 const panel=drawer.querySelector('.yurif-admin-panel');if(!panel)return;
 let section=$('team-member-manager');
 if(!section){
  section=document.createElement('section');section.id='team-member-manager';section.className='yurif-admin-members';
  panel.append(section);
 }
 section.innerHTML='<h3>연구원 계정 승인 및 관리</h3>'+
  '<p>연구원은 로그인 화면에서 이메일·비밀번호로 계정을 만들고, 생성된 UID를 관리자에게 전달합니다. UID가 정확한지 확인한 후 승인하세요.</p>'+
  '<form id="team-member-approve-form"><label for="team-member-uid">연구원 Firebase UID</label><input id="team-member-uid" required minlength="10" maxlength="128" placeholder="연구원이 전달한 UID">'+
  '<button type="submit" class="yurif-smallbtn">연구원 승인</button></form><div id="team-member-list">승인된 계정 조회 중…</div>';
 try{
  const docs=await getDocs(collection(store,'members'));
  const list=docs.docs.map(d=>({uid:d.id,...d.data()}));
  const root=$('team-member-list');if(!root)return;
  root.innerHTML=list.length?list.map(m=>'<div class="yurif-member-row"><code>'+safe(m.uid)+'</code> <strong>'+safe(m.role||'')+'</strong> '+
   (m.active?'활성':'비활성')+
   (m.role==='researcher'?'<button type="button" class="yurif-smallbtn" data-member-toggle="'+safe(m.uid)+'" data-member-active="'+(m.active?'0':'1')+'">'+(m.active?'접근 중지':'접근 재개')+'</button>':'')+'</div>').join(''):'등록된 연구팀 계정이 없습니다.';
 }catch(ex){const root=$('team-member-list');if(root)root.textContent='팀 계정 조회 실패: '+friendly(ex)}
}
document.addEventListener('submit',async e=>{
 if(e.target?.id!=='team-member-approve-form')return;
 e.preventDefault();if(state.member?.role!=='admin')return;
 const uid=$('team-member-uid').value.trim();
 if(!/^[A-Za-z0-9_-]{10,128}$/.test(uid))return alert('연구원의 Firebase UID를 확인해 주세요.');
 if(!confirm('이 UID를 승인된 연구원으로 등록할까요? UID의 소유자를 먼저 확인해 주세요.'))return;
 try{
  const existing=await getDoc(doc(store,'members',uid));
  if(existing.exists()&&existing.data().role==='admin')throw new Error('관리자 계정은 연구원으로 덮어쓸 수 없습니다.');
  await setDoc(doc(store,'members',uid),{role:'researcher',active:true});
  const check=await getDoc(doc(store,'members',uid));
  if(!check.exists()||check.data().role!=='researcher'||check.data().active!==true)throw Error('승인 결과 확인 실패');
  await renderTeamMemberManager();alert('연구원 승인 완료. 해당 연구원이 본인 계정으로 로그인할 수 있습니다.');
 }catch(ex){alert('연구원 승인 실패: '+friendly(ex))}
});
document.addEventListener('click',async e=>{
 const b=e.target?.closest('[data-member-toggle]');if(!b||state.member?.role!=='admin')return;
 const uid=b.dataset.memberToggle,active=b.dataset.memberActive==='1';
 if(!confirm('연구원 '+uid+'의 접근을 '+(active?'다시 허용':'중지')+'할까요?'))return;
 try{
  await setDoc(doc(store,'members',uid),{role:'researcher',active});
  await renderTeamMemberManager();
 }catch(ex){alert('접근 권한 변경 실패: '+friendly(ex))}
});
