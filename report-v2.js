'use strict';
(function(){
  const C=RoundCore,S=RoundStore,app=document.getElementById('app');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const relative=n=>n===null?'—':n===0?'E':n>0?'+'+n:String(n);
  try{
    const history=document.body.dataset.mode==='history',entry=history?S.selected():S.active();
    if(!entry){app.innerHTML='<div class="empty">找不到球局。<a href="history.html">歷史與暫存球局</a> · <a href="data.html">備份／還原</a></div>';return;}
    const r=entry.round,t=C.stats(r);
    const cards=[[t.score,'已記錄總桿'],[relative(t.relative),`相對Par · ${t.relativeN}洞`],[t.putts,'已記錄推桿'],[t.shortShots,'短桿'],[t.penalties,'罰桿'],[t.girN?Math.round(t.gir/t.girN*100)+'%':'—',`GIR推估 · ${t.gir}/${t.girN}`]];
    const shotText=x=>x.club==='PT'?`<span class="putt-line">PT ${esc(x.putt||'')}</span>`:C.penalty(x)?`罰${C.penalty(x)} · ${esc(x.penalty||'其他')} · `:`${x.trouble||x.teeTrouble?'⚠ ':''}${esc(x.club)}${x.distance?' '+esc(x.distance)+'y':''}${x.bunker?' 沙坑':''} · `;
    const rows=t.slots.map((s,i)=>`<div class="cell">${i+1}/18<br>${esc(C.holeLabel(r,s.courseHoleId))}<br><small>${C.completed(s)?'已完成':s.shots.length?'未確認完成':'未打'}</small></div><div class="cell">${s.par??'—'}</div><div class="cell">${s.shots.length?C.strokes(s.shots):'—'}</div><div class="cell clubs">${s.shots.map(shotText).join('')||'—'}</div>`).join('');
    const half=h=>`${h.score}桿（完成${h.done}/9）`;
    const original=entry.original?.totalScore;
    const diff=original!=null&&original!==t.score?`<p class="notice">原存總桿 ${esc(original)}；依現有逐桿資料及可確認位置重算 ${t.score}。原始JSON保留，可下載核對。</p>`:'';
    const warnings=(r.legacyWarnings||[]).map(w=>`<p class="notice">${esc(w)}</p>`).join('');
    const extras=(r.unassignedHoles||[]).map(h=>`<div class="notice"><b>${esc(C.holeLabel(r,h.courseHoleId))} · ${C.strokes(h.shots)}桿（未納入18洞）</b><p>${h.shots.map(shotText).join('')}</p></div>`).join('');
    app.innerHTML=`<div class="head"><div><div class="ey">ROUND OVERVIEW</div><h1>${esc(r.course)}</h1><p>完成 ${t.done}/18 洞 · 有紀錄 ${t.recorded}/18 洞</p></div><button class="back" onclick="location.href='./'">首頁</button></div>${warnings}${diff}<div class="cards">${cards.map(([v,l])=>`<div class="card"><b>${v}</b><span>${l}</span></div>`).join('')}</div><p class="notice">總桿包含尚未完成洞的已記錄桿數。相對Par只計已完成且Par已知的洞；GIR只計其中有PT紀錄的洞，依首次PT前桿數推估。無PT的切進球不猜果嶺位置。</p><div class="section">逐洞總覽</div><div class="table"><div class="halfrow"><div><b>${half(t.halves[0])}</b><span>本場前九</span></div><div><b>${half(t.halves[1])}</b><span>本場後九</span></div><div><b>${t.done===18?Math.abs(t.halves[0].score-t.halves[1].score):'—'}</b><span>前後九差</span></div></div><div class="grid"><div class="cell th">位置／球場洞</div><div class="cell th">Par</div><div class="cell th">桿</div><div class="cell th">用桿順序</div>${rows}</div></div>${extras?'<div class="section">待確認位置的原始紀錄</div>'+extras:''}<div class="actions"><button class="action roundbtn" id="backRound">${history?'歷史與暫存':'回記桿'}</button><button class="action analysis" id="analysis">查看分析</button></div>${history?(r.status!=='finished'?'<button class="finish" id="resume">接續這場球局</button>':''):'<button class="finish" id="finishRound">完成本局</button>'}<p><a href="data.html">完整備份／還原</a> · <button id="exportRound">下載本局備份</button></p>`;
    document.getElementById('backRound').onclick=()=>location.href=history?'history.html?v=20':'round.html?v=20';
    document.getElementById('analysis').onclick=()=>location.href=history?'history-analysis.html?v=20':'analysis.html?v=20';
    document.getElementById('exportRound').onclick=()=>S.download({format:'arhorngor-backup',version:1,exportedAt:new Date().toISOString(),raw:{[S.KEY]:JSON.stringify({schemaVersion:2,revision:0,entries:[entry],activeId:null,viewId:null})}},'Arhorngor_round');
    if(history&&r.status!=='finished')document.getElementById('resume').onclick=()=>{try{S.resume(entry.id);location.href='round.html?v=20';}catch(e){alert(e.message)}};
    if(!history)document.getElementById('finishRound').onclick=()=>{
      if(t.done<18&&!confirm(`目前完成${t.done}/18洞。結束後保留所有已記錄桿數，未完成洞不列入完成洞統計。確定結束本局？`))return;
      try{S.finish(entry.id,r);window.ArhorngorAnalytics?.track('round_finished');location.href='history.html?v=20';}catch(e){alert(e.message);}
    };
  }catch(e){app.textContent=e.message;const a=document.createElement('a');a.href='data.html';a.textContent=' 前往備份／還原';app.appendChild(a);}
})();
