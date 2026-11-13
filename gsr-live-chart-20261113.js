'use strict';
/* Arduino GSR live capture. Serial samples are uncalibrated 10-bit ADC readings, not EDA/µS. */
const gsrDevice={port:null,reader:null,task:null,connected:false,stopping:false,last:null,received:0,error:'',partial:'',status:'USB 연결 대기',lastPersist:0,livePoints:[]};
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
 '<div class="gsr-chart-box"><div class="gsr-chart-header"><div><h3>Arduino 실시간 ADC 그래프</h3><p class="muted">최근 120초 · 가로축 시간(초), 세로축 ADC(0~1023)</p></div><span class="pill" id="gsr-chart-segment">실험 대기</span></div><canvas id="gsr-live-chart" width="900" height="290" role="img" aria-label="Arduino GSR ADC의 최근 120초 실시간 선 그래프 및 실험 구간 경계"></canvas><div class="gsr-chart-legend"><span><i class="gsr-line-legend"></i>GSR ADC 원시값</span><span><i class="gsr-boundary-legend"></i>구간 변경 시점</span></div><p class="muted">그래프는 측정값을 보여주는 보조 화면이며, 실제 저장은 실험 시작 후 구간별로 이루어집니다.</p></div>'+ 
 '<div class="actions"><button type="button" class="btn" data-gsr-action="connect" '+(supported?'':'disabled')+'>USB 센서 연결</button><button type="button" class="btn secondary" data-gsr-action="disconnect">연결 해제</button></div>'+
 '<p class="muted" style="margin-top:10px">'+info+'</p><div class="notice">정식 실험 전에 센서를 착용하지 않은 상태와 착용한 상태의 원시 출력 및 결측값을 확인하세요. Arduino IDE 시리얼 모니터가 포트를 사용 중이라면 닫아야 합니다. 데이터는 GitHub에 업로드되지 않습니다.</div></section>';
}
function gsrRefresh(){
 const status=document.getElementById('gsr-status'),current=document.getElementById('gsr-current'),count=document.getElementById('gsr-count'),connection=document.getElementById('gsr-connection');
 if(status)status.textContent=gsrDevice.status;
 if(current)current.textContent=gsrDevice.last==null?'—':String(gsrDevice.last);
 if(count)count.textContent=String(gsrSamples(labDraft).length);
 if(connection)connection.textContent=gsrDevice.connected?'연결됨':'연결 안 됨';
 gsrDrawChart();
}

/* Live graph is drawn from the same Web Serial samples already being saved.
   Browser canvas does not open another serial port. */
function gsrDrawChart(){
 const canvas=document.getElementById('gsr-live-chart');
 if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const rect=canvas.getBoundingClientRect();
 const width=Math.max(320,Math.floor(rect.width||850)),height=Math.max(180,Math.floor(width*.34));
 const dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.floor(width*dpr)||canvas.height!==Math.floor(height*dpr)){
  canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
 }
 ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.clearRect(0,0,width,height);
 const left=45,right=14,top=14,bottom=29,plotW=width-left-right,plotH=height-top-bottom;
 ctx.fillStyle='#FAFCFE';ctx.fillRect(0,0,width,height);
 const rangeEnd=Date.now(),rangeStart=rangeEnd-120000;
 const X=t=>left+plotW*(t-rangeStart)/120000;
 const Y=v=>top+plotH*(1-v/1023);
 ctx.font='11px system-ui, sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
 for(const tick of [0,256,512,768,1023]){
  const y=Y(tick);
  ctx.beginPath();ctx.strokeStyle='#DFEAF3';ctx.lineWidth=1;ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();
  ctx.fillStyle='#637A8C';ctx.fillText(String(tick),left-8,y);
 }
 ctx.textBaseline='top';ctx.textAlign='center';
 for(const sec of [120,90,60,30,0]){
  const x=X(rangeEnd-sec*1000);
  ctx.fillStyle='#637A8C';ctx.fillText(sec===0?'현재':'-'+sec+'초',x,height-bottom+8);
 }
 const run=typeof labDraft==='undefined'?null:labDraft;
 const badge=document.getElementById('gsr-chart-segment');
 const active=run?.steps?.find(s=>s.startedAt&&!s.endedAt);
 if(badge)badge.textContent=active?'현재 '+active.label+'구간':run?.startedAt?'실험 종료 또는 대기':'실험 대기';
 if(run?.steps){
  for(const step of run.steps){
   const t=step.startedAt;
   if(!t||t<rangeStart||t>rangeEnd)continue;
   const x=X(t);
   ctx.save();ctx.strokeStyle='#D18556';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
   ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+plotH);ctx.stroke();ctx.restore();
   ctx.fillStyle='#A4603B';ctx.textAlign='left';ctx.textBaseline='top';ctx.font='bold 11px system-ui, sans-serif';
   ctx.fillText(String(step.label||''),Math.min(width-18,x+4),top+4);
  }
 }
 const pts=gsrDevice.livePoints.filter(p=>p[0]>=rangeStart&&p[0]<=rangeEnd);
 if(pts.length){
  ctx.beginPath();ctx.strokeStyle='#246B9A';ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
  pts.forEach((p,i)=>{const x=X(p[0]),y=Y(p[1]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
  ctx.stroke();
  const last=pts[pts.length-1];ctx.beginPath();ctx.fillStyle='#246B9A';ctx.arc(X(last[0]),Y(last[1]),3,0,2*Math.PI);ctx.fill();
 }else{
  ctx.font='13px system-ui, sans-serif';ctx.fillStyle='#7A8FA0';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(gsrDevice.connected?'센서 데이터를 수신하는 중입니다.':'USB 센서를 연결하면 여기에 그래프가 나타납니다.',left+plotW/2,top+plotH/2);
 }
}

function gsrReceive(adc){
 const now=Date.now();gsrDevice.last=adc;gsrDevice.received++;
 gsrDevice.livePoints.push([now,adc]);
 const cutoff=now-125000;
 while(gsrDevice.livePoints.length&&(gsrDevice.livePoints[0][0]<cutoff||gsrDevice.livePoints.length>2000))gsrDevice.livePoints.shift();
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
