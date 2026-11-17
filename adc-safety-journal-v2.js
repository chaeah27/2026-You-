/* Yurif development branch: independent IndexedDB ADC safety journal.
 * Append-only records; does not delete or migrate existing localStorage/Firestore data.
 * No network access here. A server copy is verified separately.
 */
(function(){
 'use strict';
 const DB='yurif_adc_safety_v1',STORE='samples',VERSION=1;
 let dbPromise,queue=[],inflight=null,ready=false,failed='',lastSaved=0;
 const status=()=>({ready,failed,pending:queue.length+(inflight?inflight.length:0),lastSaved});
 function open(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   if(!('indexedDB' in window))return reject(Error('IndexedDB를 사용할 수 없습니다.'));
   const req=indexedDB.open(DB,VERSION);
   req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains(STORE)){
     const store=db.createObjectStore(STORE,{keyPath:'key'});
     store.createIndex('runId','runId',{unique:false});
    }
   };
   req.onsuccess=()=>{ready=true;resolve(req.result)};
   req.onerror=()=>reject(req.error||Error('IndexedDB 열기 실패'));
   req.onblocked=()=>reject(Error('다른 탭에서 DB 사용 중'));
  }).catch(err=>{failed=String(err?.message||err);dbPromise=null;throw err});
  return dbPromise;
 }
 async function flush(){
  if(inflight)return inflight.promise;
  if(!queue.length)return true;
  const batch=queue.splice(0,Math.min(200,queue.length));
  let resolveJob,rejectJob;
  const promise=new Promise((res,rej)=>{resolveJob=res;rejectJob=rej});
  inflight={batch,promise};
  try{
   const db=await open();
   const tx=db.transaction(STORE,'readwrite');
   const store=tx.objectStore(STORE);
   batch.forEach(item=>store.put(item));
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error||Error('ADC 기록 트랜잭션 오류'));
    tx.onabort=()=>reject(tx.error||Error('ADC 기록 중단'));
   });
   lastSaved=Date.now();failed='';resolveJob(true);
  }catch(err){
   failed=String(err?.message||err);
   queue=batch.concat(queue);
   rejectJob(err);
  }finally{inflight=null}
  return promise;
 }
 async function flushAll(){
  while(queue.length||inflight){
   if(inflight)await inflight.promise;
   else await flush();
  }
  return status();
 }
 function record(runId,seq,time,adc,phase,segmentId){
  if(!runId||!Number.isInteger(seq)||!Number.isFinite(time)||!Number.isFinite(adc))return;
  queue.push({key:String(runId)+'::'+String(seq).padStart(9,'0'),
   runId:String(runId),seq,time,adc,phase:String(phase||'gap'),segmentId:String(segmentId||'')});
  if(queue.length>=40)flush().catch(()=>{});
 }
 async function readRun(runId){
  await flushAll();
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly');
   const request=tx.objectStore(STORE).index('runId').getAll(String(runId));
   request.onsuccess=()=>resolve(request.result.sort((a,b)=>a.seq-b.seq));
   request.onerror=()=>reject(request.error);
  });
 }
 async function validate(runId,expected){
  const all=await readRun(runId);
  const seen=new Set(all.map(x=>x.seq));
  const contiguous=all.length===expected&&seen.size===expected&&all.every((x,i)=>x.seq===i);
  return {runId,expected,stored:all.length,contiguous,first:all[0]?.time||null,last:all.at(-1)?.time||null};
 }
 async function exportCsv(runId){
  const samples=await readRun(runId);
  if(!samples.length)throw Error('보존된 원시 ADC 데이터가 없습니다.');
  const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  const lines=['sample_sequence,timestamp_ms,iso_datetime,adc_raw,phase,segment_id,experiment_id'];
  for(const s of samples)lines.push([s.seq,s.time,new Date(s.time).toISOString(),s.adc,csv(s.phase),csv(s.segmentId),csv(s.runId)].join(','));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='yurif-adc-safety-'+String(runId).replace(/[^a-zA-Z0-9_-]/g,'_')+'.csv';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 setInterval(()=>{if(queue.length)flush().catch(()=>{})},1000);
 window.addEventListener('pagehide',()=>{if(queue.length)flush().catch(()=>{})});
 window.yurifSafeAdc={record,flush:flushAll,validate,readRun,exportCsv,status};
 open().catch(()=>{});
})();