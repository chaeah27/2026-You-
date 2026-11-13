'use strict';
/* Arduino GSR live capture. Serial samples are uncalibrated 10-bit ADC readings, not EDA/µS. */
const gsrDevice={port:null,reader:null,task:null,connected:false,stopping:false,last:null,received:0,error:'',partial:'',status:'USB 연결 대기',lastPersist:0};
function gsrSamples(run){return Array.isArray(run?.gsrSamples)?run.gsrSamples:[]}
function gsrWindow(run,step,windowMode='all'){
 let start=step.startedAt||0,end=step.endedAt||Date.now();
 if(windowMode==='first60')end=Math.min(end,start+60000);
 if(windowMode==='last60')start=Math.max(start,end-60000);
 return gsrSamples(run).filter(p=>Array.isArray(p)&&p[0]>=start&&p[0]<=end&&Number.isFinite(p[1]));
}
function gsrStats(pts){if(!pts.length)return null;const nums=pts.map(x=>x[1]);return {n:nums.length,mean:(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2),min:Math.min(...nums),max:Math.max(...nums),start:pts[0][0],end:pts[pts.length-1][0]}}
function gsrSegmentText(run,step){const s=gsrStats(gsrWindow(run,step));return s?'ADC 평균 '+s.mean+' · '+s.n+'개':'GSR 기록 없음'}
function gsrRunById(id){return [...(db.pilotRuns||[]),...(db.labRuns||[])].find(x=>x.id===id)}
function gsrArchiveActions(run){
 const samples=gsrSamples(run);if(!samples.length)return '<p class="muted">GSR ADC 측정값 없음 · 구간 시간·메모만 저장됨</p>';
 return '<div class="gsr-archive-actions"><span class="pill">GSR ADC '+samples.length+'개 수집</span> <button type="button" class="btn secondary" data-gsr-csv="'+esc(run.id)+'">원시 데이터 CSV</button><details><summary>구간별 ADC 평균 · 60초 범위 확인</summary>'+
 run.steps.map((s,i)=>{const all=gsrStats(gsrWindow(run,s)),first=gsrStats(gsrWindow(run,s,'first60')),last=gsrStats(gsrWindow(run,s,'last60'));
 return '<div class="gsr-summary"><strong>'+esc(s.label)+' · '+esc(s.name)+'</strong><div class="gsr-summary-grid">'+[
 ['전체 구간',all],['시작 60초',first],['마지막 60초',last]
 ].map(([name,a])=>'<div><small>'+name+'</small><b>'+(a?a.mean:'—')+'</b><small>'+ (a?a.n+'개 샘플':'측정값 없음')+'</small></div>').join('')+'</div></div>'}).join('')+
 '</details></div>';
}
function gsrLabPanel(){
 const supported='serial' in navigator && window.isSecureContext;
 const info=supported?'Chrome/Edge 데스크톱에서 Arduino USB 포트를 선택해 연결하세요. Arduino 스케치는 한 줄에 ADC 정수 1개(0~1023)를 9600 baud로 출력해야 합니다.':'이 브라우저에서는 Web Serial이 제공되지 않습니다. HTTPS의 데스크톱 Chrome 또는 Edge를 사용하세요.';
 return '<section class="panel gsr-panel"><div class="entry-head" style="align-items:center;flex-wrap:wrap"><div><h2>Arduino GSR 실시간 측정</h2><p class="muted">Grove GSR → Uno R3 → USB → 유리프 실험실</p></div><span id="gsr-status" class="pill">연결 대기</span></div>'+
 '<div class="gsr-live"><div><small>현재 ADC 원시값</small><strong id="gsr-current">—</strong><small>0~1023 · 전도도(µS) 아님</small></div><div><small>현재 실험 수집 샘플</small><strong id="gsr-count">0</strong><small>구간 시작 후 기록</small></div><div><small>USB 연결 상태</small><strong id="gsr-connection">대기</strong><small>기록은 현재 브라우저에 저장</small></div></div>'+
 '<div class="actions"><button type="button" class="btn" data-gsr-action="connect" '+(supported?'':'disabled')+'>USB 센서 연결</button><button type="button" class="btn secondary" data-gsr-action="disconnect">연결 해제</button></div>'+
 '<p class="muted" style="margin-top:10px">'+info+'</p><div class="notice">정식 실험 전에 센서를 착용하지 않은 상태와 착용한 상태의 원시 출력 및 결측값을 확인하세요. Arduino IDE 시리얼 모니터가 포트를 사용 중이라면 닫아야 합니다. 데이터는 GitHub에 업로드되지 않습니다.</div></section>';
}
function gsrRefresh(){
 const status=document.getElementById('gsr-status'),current=document.getElementById('gsr-current'),count=document.getElementById('gsr-count'),connection=document.getElementById('gsr-connection');
 if(status)status.textContent=gsrDevice.status;
 if(current)current.textContent=gsrDevice.last==null?'—':String(gsrDevice.last);
 if(count)count.textContent=String(gsrSamples(labDraft).length);
 if(connection)connection.textContent=gsrDevice.connected?'연결됨':'연결 안 됨';
}
function gsrReceive(adc){
 const now=Date.now();gsrDevice.last=adc;gsrDevice.received++;
 const d=typeof labDraft==='undefined'?null:labDraft;
 if(d&&d.startedAt&&!d.endedAt&&d.steps.some(x=>x.startedAt&&!x.endedAt)){
   d.gsrSamples??=[];
   if(d.gsrSamples.length>=60000){gsrDevice.status='기록 상한 60,000개 도달: 실험을 종료하고 CSV 백업하세요.';return}
   d.gsrSamples.push([now,adc]);
   if(now-gsrDevice.lastPersist>2500){gsrDevice.lastPersist=now;labSaveDraft()}
 }
}
function gsrParseLine(line){
 const trimmed=line.trim();const match=trimmed.match(/^(?:ADC\s*[:=]\s*)?(\d{1,4})$/i);
 if(!match)return;
 const n=Number(match[1]);if(Number.isInteger(n)&&n>=0&&n<=1023)gsrReceive(n);
}
async function gsrReadLoop(port){
 let buffer='';
 try{
  const reader=port.readable.getReader();gsrDevice.reader=reader;
  while(!gsrDevice.stopping){
   const {value,done}=await reader.read();if(done)break;
   if(!value)continue;
   buffer+=new TextDecoder().decode(value);
   if(buffer.length>2048&&!buffer.includes('\n'))buffer=buffer.slice(-200);
   let i;
   while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);gsrParseLine(line)}
  }
 }catch(e){if(!gsrDevice.stopping)gsrDevice.status='수신 오류: '+String(e.message||e)}
 finally{
  if(gsrDevice.reader){try{gsrDevice.reader.releaseLock()}catch(e){}}
  gsrDevice.reader=null;gsrDevice.connected=false;
  if(labDraft&&labDraft.gsrSamples)labSaveDraft();
  if(!gsrDevice.stopping&&gsrDevice.status==='USB 연결됨')gsrDevice.status='USB 연결 종료';
  gsrRefresh();
 }
}
async function gsrConnect(){
 if(gsrDevice.connected)return;
 if(!('serial' in navigator)||!window.isSecureContext){alert('HTTPS 기반 Chrome 또는 Edge 데스크톱 브라우저가 필요합니다.');return}
 let port;
 try{
  // Must run inside direct click activation, before any other await.
  port=await navigator.serial.requestPort();
  await port.open({baudRate:9600});
  gsrDevice.port=port;gsrDevice.connected=true;gsrDevice.stopping=false;gsrDevice.status='USB 연결됨';gsrDevice.last=null;gsrDevice.received=0;gsrRefresh();
  gsrDevice.task=gsrReadLoop(port);
 }catch(e){gsrDevice.status=e?.name==='NotFoundError'?'포트 선택 취소':'연결 실패: '+String(e.message||e);gsrDevice.connected=false;gsrRefresh();if(port){try{await port.close()}catch{}}}
}
async function gsrDisconnect(){
 gsrDevice.stopping=true;gsrDevice.status='연결 해제 중';gsrRefresh();
 try{if(gsrDevice.reader)await gsrDevice.reader.cancel()}catch(e){}
 try{if(gsrDevice.task)await gsrDevice.task}catch(e){}
 try{if(gsrDevice.port)await gsrDevice.port.close()}catch(e){}
 gsrDevice.port=null;gsrDevice.task=null;gsrDevice.reader=null;gsrDevice.connected=false;gsrDevice.stopping=false;gsrDevice.status='USB 연결 해제됨';gsrRefresh();
}
function gsrExportCsv(run){
 const pts=gsrSamples(run);if(!pts.length)return alert('저장된 ADC 데이터가 없습니다.');
 const lines=['timestamp_ms,iso_datetime,elapsed_seconds,segment,environment,adc_raw'];
 for(const [t,v] of pts){const s=run.steps.find(x=>x.startedAt&&t>=x.startedAt&&t<=(x.endedAt||run.endedAt||Infinity));const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  lines.push([t,new Date(t).toISOString(),((t-run.startedAt)/1000).toFixed(3),csv(s?.label||''),csv(s?.envName||s?.name||''),v].join(','));
 }
 download('yurif-gsr-'+run.mode+'-'+run.code+'-'+run.date+'.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-gsr-action]');if(b){if(b.dataset.gsrAction==='connect')gsrConnect();else if(b.dataset.gsrAction==='disconnect')gsrDisconnect();return}
 const csv=e.target.closest('[data-gsr-csv]');if(csv){const run=gsrRunById(csv.dataset.gsrCsv);if(run)gsrExportCsv(run)}
});
setInterval(gsrRefresh,400);
window.addEventListener('beforeunload',e=>{if(gsrDevice.connected&&labDraft?.startedAt&&!labDraft.endedAt){labSaveDraft();e.preventDefault()}});
