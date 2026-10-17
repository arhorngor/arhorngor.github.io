'use strict';
const C=RoundCore,S=RoundStore;
const DEFAULT=['1W','3W','4W','3I','4I','5I','6I','7I','8I','9I','PW','50°','56°','PT'];
const CLUB_ORDER=['1W','2W','3W','4W','5W','7W','9W','11W','2H','3H','4H','5H','6H','7H','2U','3U','4U','5U','1I','2I','3I','4I','5I','6I','7I','8I','9I','PW','AW','GW','SW','LW','46°','48°','50°','52°','54°','56°','58°','60°','PT'];
const app=document.getElementById('app'),modal=document.getElementById('modal'),modalBody=document.getElementById('modalBody');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let entry,round,baseline,slotId,hole,shots=[],par,bag=DEFAULT,unsaved=false;
const penaltyStrokes=C.penalty,strokeCount=C.strokes;
function current(){return round.roundSlots.find(s=>s.id===slotId)}
function holeLabel(n){return C.holeLabel(round,n)}
function rel(){if(!C.validPar(par)||!shots.length)return '';const d=strokeCount(shots)-par;return d===0?'E':d>0?'+'+d:String(d)}
function save(markComplete=false){
  const s=current();s.shots=C.clone(shots);s.par=par;
  s.status=markComplete?'completed':shots.length?'in_progress':'not_started';
  if(markComplete)s.completedAt=new Date().toISOString();else delete s.completedAt;
  round.currentSlotId=slotId;
  try{S.update(entry.id,round,baseline);baseline=C.clone(round);unsaved=false;return true;}
  catch(e){unsaved=true;showSaveFailure(e);throw e;}
}
function savePosition(){round.currentSlotId=slotId;try{S.update(entry.id,round,baseline);baseline=C.clone(round);return true;}catch(e){unsaved=true;showSaveFailure(e);return false;}}
function showSaveFailure(e){
  modal.classList.add('show');modalBody.innerHTML=`<h3>尚未儲存成功</h3><p>${esc(e.message)}</p><button class="close" id="rescue">下載本頁未儲存球局</button><button class="close" id="retry">重試儲存</button><a href="data.html">完整資料備份</a>`;
  document.getElementById('rescue').onclick=()=>S.download({format:'arhorngor-backup',version:1,exportedAt:new Date().toISOString(),raw:{'arhorngor-active-round':JSON.stringify(round)}},'Arhorngor_unsaved');
  document.getElementById('retry').onclick=()=>{try{S.update(entry.id,round,baseline);baseline=C.clone(round);unsaved=false;modal.classList.remove('show');render();}catch(err){showSaveFailure(err)}};
}
function render(){
  const index=round.roundSlots.findIndex(s=>s.id===slotId);
  const clubs=bag.map(c=>`<button class="club" data-club="${esc(c)}">${esc(c)}</button>`).join('');
  let running=0;
  const rec=shots.length?shots.map((s,i)=>{const count=penaltyStrokes(s)||1,from=running+1;running+=count;return `<button class="shot ${penaltyStrokes(s)?'penaltyshot':''}" data-shot="${i}">${s.trouble||s.teeTrouble?'⚠ ':''}${from===running?running:from+'–'+running}·${penaltyStrokes(s)?'罰'+count+' '+esc(s.penalty||'其他'):esc(s.club)}${s.putt?' '+esc(s.putt):''}${s.distance?' '+esc(s.distance)+'y':''}</button>`}).join(''):'<span class="hint">照順序點剛才使用的球桿</span>';
  const canPick=round.course==='無場地'||!C.validPar(par);
  const parUI=`<div class="parline"><span class="parlabel">${par?'Par '+par:'Par —'}</span>${canPick?[3,4,5].map(p=>`<button class="parpick ${par===p?'on':''}" data-par="${p}">${p}</button>`).join(''):''}<span class="relative">${rel()}</span></div>`;
  app.innerHTML=`<main class="round"><header class="top"><div class="topmain"><div><div class="ey">${esc(round.course)} · 本場 ${index+1}/18${C.completed(current())?' · 已完成':''}</div><div class="hole">${esc(holeLabel(hole))}</div></div><div class="score"><span>本洞</span><b>${strokeCount(shots)}</b><span>桿</span></div></div><div class="navrow"><button class="tool home" id="home">⌂ 首頁</button>${parUI}<button class="tool jump" id="jump">跳洞 ▾</button></div></header><section class="clubs">${clubs}</section><section class="record">${rec}</section><footer class="bottom"><button class="undo" id="undo">↶</button><button class="finish" id="finish">完成本洞</button></footer><button id="summary" style="position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom) + 70px);z-index:8;border:0;border-radius:18px;background:#176ea8;color:#fff;padding:8px 12px;font-size:10px;font-weight:900">總覽 / 分析</button></main>`;
  document.getElementById('home').onclick=()=>{if(!unsaved)location.href='./'};
  document.getElementById('summary').onclick=()=>{if(!unsaved)location.href='summary.html?v=20'};
  document.getElementById('jump').onclick=()=>{if(!unsaved)showJump()};
  document.getElementById('undo').onclick=undo;document.getElementById('finish').onclick=finishHole;
  document.querySelectorAll('[data-club]').forEach(b=>b.onclick=()=>{if(!unsaved)addClub(b.dataset.club)});
  document.querySelectorAll('[data-shot]').forEach(b=>b.onclick=()=>{if(!unsaved)showShotPenalty(+b.dataset.shot)});
  document.querySelectorAll('[data-par]').forEach(b=>b.onclick=()=>{par=+b.dataset.par;save();render()});
}
function loadSlot(id){
  if(unsaved)return;
  const target=round.roundSlots.find(s=>s.id===id);if(!target)return;
  slotId=id;hole=target.courseHoleId;shots=C.clone(target.shots);par=target.par;
  if(savePosition())render();
}
function showJump(){
  modalBody.innerHTML=`<h3>切換記分位置</h3><p>回看／補登請選既有位置。臨時換洞請按下方「更換未打位置」。</p><div class="jumpgrid">${round.roundSlots.map((s,i)=>`<button class="jumpbtn ${s.id===slotId?'on':''}" data-slot="${s.id}">${i+1}/18<br>${esc(holeLabel(s.courseHoleId))}<br>${C.completed(s)?'✓ ':''}${s.shots.length?C.strokes(s.shots)+'桿':'未打'}</button>`).join('')}</div><button class="close" id="replace">更換未打位置／換區</button><button class="close" id="close">取消</button>`;
  modal.classList.add('show');document.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{modal.classList.remove('show');loadSlot(b.dataset.slot)});
  document.getElementById('replace').onclick=showReplacement;document.getElementById('close').onclick=()=>modal.classList.remove('show');
}
function showReplacement(){
  const empty=round.roundSlots.filter(s=>s.status==='not_started'&&!s.shots.length);
  if(!empty.length){alert('18個位置都已有紀錄，不能替換。');return;}
  const preferred=empty.find(s=>s.id===slotId)||empty.find(s=>round.roundSlots.indexOf(s)>round.roundSlots.indexOf(current()))||empty[0];
  modalBody.innerHTML=`<h3>更換未打位置</h3><label>本場位置 <select id="replaceSlot">${empty.map(s=>`<option value="${s.id}" ${s.id===preferred.id?'selected':''}>${round.roundSlots.indexOf(s)+1}/18 · ${esc(holeLabel(s.courseHoleId))}</option>`).join('')}</select></label><p>只更換選定位置。相同球場洞號可再打一次，會保留獨立成績。</p><label>球場洞號 <select id="replaceHole">${Array.from({length:round.courseHoles},(_,i)=>`<option value="${i+1}">${esc(holeLabel(i+1))}</option>`).join('')}</select></label><button class="close" id="previewReplace">預覽更換</button><button class="close" id="close">返回</button>`;
  document.getElementById('previewReplace').onclick=()=>{
    const id=document.getElementById('replaceSlot').value,n=+document.getElementById('replaceHole').value,s=round.roundSlots.find(x=>x.id===id);
    const msg=`本場第${round.roundSlots.indexOf(s)+1}/18洞：${holeLabel(s.courseHoleId)} → ${holeLabel(n)}。其他位置不變。確定更換並前往？`;
    if(!confirm(msg))return;
    const next=C.replaceHole(round,id,n);
    try{S.update(entry.id,next,baseline);round=next;baseline=C.clone(next);modal.classList.remove('show');loadSlot(id);}catch(e){alert(e.message);}
  };
  if(round.courseHoles>18){
    const panel=document.createElement('div');panel.innerHTML=`<p>或從選定位置更換連續九洞（九個位置都須未打）</p><select id="sectionTarget">${Array.from({length:round.courseHoles/9},(_,i)=>`<option value="${i}">${esc(round.sections?.[i]||'區'+(i+1))}</option>`).join('')}</select><button class="close" id="replaceSection">預覽九洞換區</button>`;modalBody.appendChild(panel);
    document.getElementById('replaceSection').onclick=()=>{
      try{
        const id=document.getElementById('replaceSlot').value,section=+document.getElementById('sectionTarget').value,next=C.replaceSection(round,id,section),index=round.roundSlots.findIndex(s=>s.id===id);
        if(!confirm(`本場第${index+1}–${index+9}個位置將依序改為${round.sections?.[section]||'區'+(section+1)}第1–9洞。所有已記錄位置保留。確定？`))return;
        S.update(entry.id,next,baseline);round=next;baseline=C.clone(next);modal.classList.remove('show');loadSlot(id);
      }catch(e){alert(e.message)}
    };
  }
  document.getElementById('close').onclick=showJump;
}
function finishHole(){
  if(unsaved)return;if(!shots.length){alert('本洞還沒有桿數，不能標記完成。');return;}
  save(true);const index=round.roundSlots.findIndex(s=>s.id===slotId);
  const next=[...round.roundSlots.slice(index+1),...round.roundSlots.slice(0,index)].find(s=>!C.completed(s));
  showCaddie(()=>{if(next)loadSlot(next.id);else location.href='summary.html?v=20'});
}
function initRound(){
  try{
    entry=S.active();if(!entry){location.replace('new-round.html');return;}
    round=C.clone(entry.round);baseline=C.clone(round);slotId=round.currentSlotId;
    const s=current();hole=s.courseHoleId;shots=C.clone(s.shots);par=s.par;
    try{const saved=JSON.parse(localStorage.getItem('arhorngor-bag')||'null');if(Array.isArray(saved)&&saved.length)bag=saved.filter(c=>CLUB_ORDER.includes(c));}catch{}
    bag=[...bag].sort((a,b)=>CLUB_ORDER.indexOf(a)-CLUB_ORDER.indexOf(b));render();
    if(!localStorage.getItem(S.KEY)&&entry.original){
      modal.classList.add('show');modalBody.innerHTML='<h3>以新版副本接續</h3><p>舊球局原文會保留。先下載完整備份，再用獨立的18個記分位置接續。</p><button class="close" id="backupContinue">下載備份並接續</button><a href="./">返回首頁</a>';
      document.getElementById('backupContinue').onclick=()=>{try{S.download(S.backup());modal.classList.remove('show');}catch(e){alert(e.message)}};
    }
  }catch(e){app.innerHTML=`<p style="padding:24px">${esc(e.message)}<br><a href="data.html">匯出／還原資料</a></p>`;}
}
window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===S.KEY){unsaved=true;showSaveFailure(Error('其他分頁已更新球局。請先保存本頁副本，再重新整理。'));}});
