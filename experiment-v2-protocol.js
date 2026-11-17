/* Yurif v2 first-phase protocol. Pure, deterministic and separately testable. */
(function(root){
 'use strict';
 const CATEGORIES=[['visual',4],['olfactory',4],['auditory',2]];
 const surveySlot=i=>i===3?'visual':i>=4&&i<=7?'olfactory-'+(i-4):i>=8&&i<=9?'auditory-'+(i-8):null;
 const assertOrder=order=>{
  if(!Array.isArray(order)||order.length!==10)throw Error('시각 4개, 후각 4개, 청각 2개 환경이 필요합니다.');
  const expected=[...Array(4).fill('visual'),...Array(4).fill('olfactory'),...Array(2).fill('auditory')];
  order.forEach((x,i)=>{
   if(!x||x.type!==expected[i]||typeof x.name!=='string'||!x.name.trim())throw Error((i+1)+'번째 감각 환경 또는 분야가 잘못되었습니다.');
  });
  for(const [type,count] of CATEGORIES){
   const ids=order.filter(x=>x.type===type).map(x=>String(x.id||x.name));
   if(ids.length!==count||new Set(ids).size!==count)throw Error(type+' 감각 환경이 중복되었습니다.');
  }
  return true;
 };
 function makeSegments(order){
  assertOrder(order);
  const result=[{id:'baseline',kind:'baseline',label:'안정',name:'초기 안정 상태',duration:60,position:-1,type:'baseline'}];
  order.forEach((env,i)=>{
   result.push({id:'stimulus-'+i,kind:'stimulus',label:'환경'+(i+1),name:env.name,envId:env.id||'',duration:60,position:i,type:env.type});
   result.push({id:'rest-'+i,kind:'rest',label:'휴식'+(i+1),name:env.name+' 이후 휴식',envId:env.id||'',duration:30,position:i,type:'rest',surveyAfter:surveySlot(i)});
  });
  return result;
 }
 function shuffledOrder({visual,olfactory,auditory}){
  const order=[];
  for(const [type,count] of CATEGORIES){
   const items=(type==='visual'?visual:type==='olfactory'?olfactory:auditory)||[];
   if(items.length!==count)throw Error(type+' 환경은 정확히 '+count+'개가 필요합니다.');
   const tmp=items.map(x=>({...x,type}));
   for(let i=tmp.length-1;i>0;i--){
    const bytes=new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j=bytes[0]%(i+1);
    [tmp[i],tmp[j]]=[tmp[j],tmp[i]];
   }
   order.push(...tmp);
  }
  assertOrder(order);return order;
 }
 const sequence=makeSegments;
 const api={CATEGORIES,surveySlot,assertOrder,makeSegments,shuffledOrder,sequence};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.yurifV2Protocol=api;
})(typeof window!=='undefined'?window:globalThis);