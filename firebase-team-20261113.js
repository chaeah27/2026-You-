import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
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
const types=['journal','sessions','equipment','results','references','sensoryEnvironments','experimenters','labRuns','journalBoard'];
const choices=[
 ['home','연구 소개'],['protocol','실험 설계'],['equipment','장비 소개'],['journal','연구 일지 소개'],
 ['lab','실험 방법'],['sessions','실험 세션 소개'],['analysis','분석 결과'],['references','참고자료']
];
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={member:null,unsubs:[],cache:{},pending:new Set(),queued:null,writeJob:null,busy:false,ready:false,started:false,guestUnsub:null,publicDoc:{sections:{}}};
window.yurifCloud={ready:false,status:'연결 중',initialData:null,queueSave};

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
$('open-admin-settings').addEventListener('click',()=>{if(state.member?.role==='admin'){show('workspace');$('admin-drawer').hidden=false;renderAdmin()}});
$('close-admin-settings').addEventListener('click',()=>$('admin-drawer').hidden=true);
$('admin-publish').addEventListener('click',publish);
$('guest-refresh').addEventListener('click',()=>{watchPublic(true)});

function cleanup(){
 deactivateGsrSharing();
 state.unsubs.forEach(fn=>fn());state.unsubs=[];state.cache={};state.pending.clear();state.started=false;state.ready=false;state.member=null;
 window.yurifCloud.ready=false;window.yurifCloud.initialData=null;
 clearTimeout(timer);state.queued=null;
 $('workspace').hidden=true;$('admin-drawer').hidden=true;
}
onAuthStateChanged(auth,async user=>{
 if(!user){if(state.ready)cleanup();return}
 if(state.started)return;
 state.started=true;error('관리자·연구원 권한 확인 중…');
 try{
  const snap=await getDoc(doc(store,'members',user.uid));
  const member=snap.exists()?snap.data():null;
  if(!member?.active||!['admin','researcher'].includes(member.role)){
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
  if(member.role==='admin')renderAdmin();
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
 for(const src of ['app-cloud-ready-20261113.js?v=csv-quoted-fix-20261117','gsr-live-chart-20261113.js']){
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
function activateGsrSharing(){
 if(gsrShared.offRuns)return;
 gsrShared.offRuns=onSnapshot(gsrIndex,snapshot=>{
  gsrShared.runs=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));
  refreshGsrShared();
 },e=>{gsrShared.notice='공유 실험 목록 조회 실패: '+friendly(e);refreshGsrShared()});
 gsrShared.interval=setInterval(()=>{
  if(!state.ready||!auth.currentUser)return;
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
  const samples=run.gsrSamples;
  const count=samples.length;
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
window.yurifGsrSharing={
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
