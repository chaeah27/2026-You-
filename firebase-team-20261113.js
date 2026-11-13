import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,onSnapshot,writeBatch,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

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
  $('cloud-status').textContent='공동 데이터 연결됨';
  if(member.role==='admin')renderAdmin();
  for(const type of types){
   const unsub=onSnapshot(collection(store,'teamData',type,'items'),snapshot=>{
    if(state.pending.has(type))return;
    const data=snapshot.docs.map(d=>d.data().value).filter(x=>x&&typeof x==='object');
    state.cache[type]=new Map(data.map(x=>[String(x.id),JSON.stringify(stripForCloud(x))]));
    if(window.yurifCloudApply)window.yurifCloudApply(type,data);
   },e=>{$('cloud-status').textContent='동기화 오류: '+friendly(e)});
   state.unsubs.push(unsub);
  }
 }catch(ex){state.started=false;show('login-screen');error('공동 저장소 연결 실패: '+friendly(ex));}
});

async function loadWorkspace(){
 if(window.yurifCloudGetData){for(const type of types)window.yurifCloudApply(type,window.yurifCloud.initialData[type]||[]);return;}
 for(const src of ['app-cloud-ready-20261113.js','gsr-live-chart-20261113.js']){
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
