/* Comparison switches change the view only; the round and original Par stay untouched. */
(function(root){
  const C=root.RoundCore;
  function mode(r){const selected=new URLSearchParams(location.search).get('basis');return ['standard','bogey'].includes(selected)?selected:C.scoringMode(r);}
  const label=m=>m==='bogey'?'新手 Par':'標準 Par';
  const relative=n=>n===null?'—':n===0?'E':n>0?'+'+n:String(n);
  function controls(r,m){
    const t=C.stats(r,m);
    return `<section class="basis-panel"><div class="basis-buttons" role="group" aria-label="分析計分基準"><button type="button" data-basis="standard" aria-pressed="${m==='standard'}">標準 Par</button><button type="button" data-basis="bogey" aria-pressed="${m==='bogey'}">新手 Par · Bogey Base</button></div><div class="basis-target">本場${label(m)} <strong>${t.targetPar??'待補齊'}</strong>${t.targetPar===null?` · 已知${t.knownParCount}/18洞`:''}</div><p>${m==='bogey'?'每洞以球場 Par＋1 為目標，安心照自己的節奏打。':'依球場原始 Par 檢視這場表現。'}</p></section>`;
  }
  function bind(){document.querySelectorAll('[data-basis]').forEach(b=>b.onclick=()=>{const q=new URLSearchParams(location.search);q.set('basis',b.dataset.basis);location.search='?'+q.toString();});}
  const url=(page,m)=>`${page}?v=21&basis=${m==='bogey'?'bogey':'standard'}`;
  root.RoundView={mode,label,relative,controls,bind,url};
})(typeof window==='undefined'?globalThis:window);
