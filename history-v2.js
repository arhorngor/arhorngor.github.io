'use strict';
(function(){
  const z=document.getElementById('list'),S=RoundStore,C=RoundCore;
  try{
    const list=S.entries().sort((a,b)=>new Date(b.round.finishedAt||b.round.createdAt)-new Date(a.round.finishedAt||a.round.createdAt));
    if(!list.length){z.textContent='尚無球局';return;}
    list.forEach(e=>{
      const r=e.round,t=C.stats(r),b=document.createElement('button');b.className='round';
      const date=document.createElement('span');date.className='date';const d=new Date(r.finishedAt||r.createdAt);date.textContent=isNaN(d)?'日期未知':`${d.getMonth()+1}/${d.getDate()}`;
      const name=document.createElement('span');name.className='course';name.textContent=r.course;
      const sub=document.createElement('small');sub.style.cssText='display:block;font-size:10px;margin-top:5px;font-weight:400';sub.textContent=`${r.status==='finished'?'已結束':'可接續'}${C.scoringMode(r)==='bogey'?' · Bogey Base':''} · 完成${t.done}/18${e.importConflict?' · 匯入衝突副本':''}${r.unassignedHoles?.length?' · 有待確認紀錄':''}`;name.appendChild(sub);
      const score=document.createElement('span');score.className='score';score.textContent=t.score;
      b.append(date,name,score);b.onclick=()=>{try{S.select(e.id);location.href='history-round.html?v=21';}catch(err){alert(err.message)}};z.appendChild(b);
    });
  }catch(e){z.textContent=e.message;}
})();
