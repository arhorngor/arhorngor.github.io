// Five-axis v2: read-only event analysis; all thresholds use original course Par.
function fiveAbility(r){
 const C=RoundCore, keys=['drive','approach','short','rescue','putt'];
 const a=Object.fromEntries(keys.map(k=>[k,{sum:0,n:0}]));
 const add=(k,success)=>{a[k].n++;a[k].sum+=success?100:0};
 for(const h of (r.roundSlots||[]).filter(C.completed)){
  const s=h.shots||[], firstPT=s.findIndex(x=>x.club==='PT');
  const first=s.findIndex(x=>!C.penalty(x));
  if(C.validPar(h.par)&&h.par>=4&&first===0&&s[0].club!=='PT'){
   const tee=s[0], bad=!!(tee.trouble||tee.teeTrouble||C.penalty(s[1]));
   const known=bad||typeof tee.trouble==='boolean'||typeof tee.teeTrouble==='boolean';
   if(known)add('drive',!bad);
  }
  if(firstPT>0&&C.validPar(h.par))add('approach',C.strokes(s.slice(0,firstPT))<=h.par-1);
  const ps=s.filter(x=>x.club==='PT');
  if(ps.length&&firstPT>0)add('putt',ps.length<=2);
  s.forEach((x,i)=>{
   if(C.penalty(x)||x.club==='PT'||!s[i+1])return;
   if(firstPT>=0&&i>=firstPT)return;
   if(x.bunker)add('rescue',s[i+1].club==='PT');
   else if((x.club==='PW'||/^\d+°$/.test(x.club))&&Number(x.distance)>0)add('short',s[i+1].club==='PT');
  });
 }
 return a;
}
function distanceApproachHTML(r){
 const C=RoundCore,groups=new Map();
 for(const h of (r.roundSlots||[]).filter(C.completed)){
  const s=h.shots||[],first=s.findIndex(x=>x.club==='PT');
  s.forEach((x,i)=>{
   if(C.penalty(x)||x.club==='PT'||!s[i+1]||(first>=0&&i>=first))return;
   const short=x.club==='PW'||/^\d+°$/.test(x.club),long=/^(?:\d+[WHU]|[1-9]I)$/.test(x.club);
   const direct=s[i+1].club==='PT';
   const key=short&&Number(x.distance)>0?Number(x.distance):long&&direct?'long':null;
   if(key===null)return;
   const row=groups.get(key)||{n:0,direct:0,putts:new Map()};row.n++;if(direct){row.direct++;const d=s[i+1].putt||'未記距離';row.putts.set(d,(row.putts.get(d)||0)+1)}groups.set(key,row);
  });
 }
 const rows=[...groups].sort(([a],[b])=>a==='long'?1:b==='long'?-1:a-b).map(([k,v])=>`<tr><td>${k==='long'?'125碼以上〔依球桿推定〕':escapeHTML(k)+'碼'}</td><td>${k==='long'?v.direct+'次到位':v.direct+'/'+v.n+'（'+Math.round(v.direct/v.n*100)+'%）'}</td><td>${[...v.putts].map(([d,n])=>escapeHTML(d)+' ×'+n).join('、')||'—'}</td></tr>`).join('');
 return `<div class="section">攻果嶺距離分析</div><div class="box" style="overflow-x:auto"><table style="width:100%;font-size:12px"><thead><tr><th>出手距離</th><th>接推結果</th><th>留下第一推距離</th></tr></thead><tbody>${rows||'<tr><td colspan="3">尚無可用距離紀錄</td></tr>'}</tbody></table><p class="small">PW與挖起桿依已記距離合併統計，含沙坑；下一桿直接接PT算成功。9鐵及更長的桿僅統計接推次數，125碼以上是依球桿推定，並非實測距離，不計成功率。刻意過渡球請略過距離。</p></div>`;
}
'use strict';
function escapeHTML(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// One observation per completed slot: the shot immediately before its first PT.
function prePuttDistribution(r){
  const groups=new Map();let eligible=0,unattributed=0;
  for(const h of r.roundSlots.filter(RoundCore.completed)){
    const shots=h.shots||[],i=shots.findIndex(x=>x.club==='PT');if(i<0)continue;
    eligible++;const previous=shots[i-1];
    if(!previous||RoundCore.penalty(previous)||previous.club==='PT'){unattributed++;continue;}
    const club=previous.club,row=groups.get(club)||{club,count:0,distances:new Map(),firstPutts:new Map()};
    row.count++;
    const distance=previous.distance!=null?String(previous.distance)+'y':'未記距離';
    row.distances.set(distance,(row.distances.get(distance)||0)+1);
    const first=shots[i].putt||'未記距離';row.firstPutts.set(first,(row.firstPutts.get(first)||0)+1);
    groups.set(club,row);
  }
  return {eligible,unattributed,attributed:eligible-unattributed,rows:[...groups.values()].sort((a,b)=>b.count-a.count||a.club.localeCompare(b.club))};
}
function prePuttHTML(r){
  const d=prePuttDistribution(r),details=m=>[...m].map(([label,n])=>escapeHTML(label)+' × '+n).join('、');
  const rows=d.rows.map(row=>`<tr><th scope="row" style="padding:10px;text-align:left">${escapeHTML(row.club)}</th><td style="padding:10px">${row.count}</td><td style="padding:10px">${Math.round(row.count/d.attributed*100)}%</td><td style="padding:10px">${details(row.distances)}</td><td style="padding:10px">${details(row.firstPutts)}</td></tr>`).join('');
  return `<div class="section">進入推桿前一桿</div><div class="box" id="prePuttDistribution"><p class="small">${d.attributed}洞有前一桿紀錄／${d.eligible}洞有推桿紀錄</p>${rows?`<div style="overflow-x:auto"><table style="width:100%;min-width:430px;border-collapse:collapse;font-size:12px"><thead><tr><th>球桿</th><th>洞數</th><th>占比</th><th>前一桿距離</th><th>留下第一推距離</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="small">尚無可統計的前一桿紀錄。</p>'}<p class="small" style="line-height:1.6">每個已完成洞只計第一推前緊接的一桿；果嶺外推桿也納入，代表球已到可推的位置。占比以有前一桿紀錄的${d.attributed}洞為分母，並非各球桿成功率。${d.unattributed?`另${d.unattributed}洞第一筆就是推桿，或前一筆為罰桿，未歸入球桿。`:''} 距離沿用原紀錄；未記距離不推算。可搭配下方短距離成功率，查看需要再補一桿的情況。</p></div>`;
}
try{
const C=RoundCore,S=RoundStore,entry=document.body.dataset.mode==='history'?S.selected():S.active(),r=entry?.round,normP=v=>v,app=document.getElementById('app');if(!r){app.innerHTML='<div class="empty">這台裝置目前沒有球局資料</div>'}else{const mode=RoundView.mode(r);let total=0,played=0,putts=0,penalties=0,one=0,two=0,three=0,ok=0;const penaltyStrokes=C.penalty,strokeCount=C.strokes;const clubs=Object.create(null),dist={'OK':0,'1y':0,'3y':0,'5y':0,'10y':0,'15y+':0,'<3m':0,'3–7m':0,'7m+':0},wedges={};r.roundSlots.filter(C.completed).forEach(h=>{const s=h.shots||[];if(!s.length)return;s.forEach((x,i)=>{if(!['PW','50°','56°','58°','60°'].includes(x.club)||!x.distance)return;const k=x.club+'|'+x.distance,w=wedges[k]||(wedges[k]={club:x.club,distance:x.distance,total:0,direct:0,OK:0,'1y':0,'3y':0,'5y':0,'10y':0,'15y+':0,'<3m':0,'3–7m':0,'7m+':0});w.total++;const nx=s[i+1];if(nx?.club==='PT'){w.direct++;const np=normP(nx.putt);if(np&&w[np]!=null)w[np]++}});played++;total+=strokeCount(s);const ps=s.filter(x=>x.club==='PT');if(ps.length){const first=normP(ps[0].putt);if(dist[first]!=null)dist[first]++}putts+=ps.length;if(ps.length===1)one++;else if(ps.length===2)two++;else if(ps.length>=3)three++;s.forEach(x=>{if(x.penalty||x.club==='罰'){penalties+=penaltyStrokes(x);return}clubs[x.club]=(clubs[x.club]||0)+1;});if(ps.some(x=>x.putt==='OK'))ok++});let drivingHoles=0,penaltyDrives=0,troubleDrives=0;r.roundSlots.filter(C.completed).forEach(h=>{const s=h.shots||[];if(!s.length||!C.validPar(h.par)||h.par<4)return;drivingHoles++;const first=s.findIndex(x=>!x.penalty&&x.club!=='罰');if(first<0)return;const tee=s[first];if(tee.teeTrouble||tee.trouble)troubleDrives++;if(s.slice(first+1).some(x=>x.penalty&&s.indexOf(x)===first+1))penaltyDrives++});const longClub=x=>/^(?:\d+W|\d+H|\d+U|[1-6]I)$/.test(x),longShots=r.roundSlots.filter(C.completed).flatMap(h=>h.shots||[]).filter(x=>longClub(x.club)),longTroubles=longShots.filter(x=>x.trouble||x.teeTrouble).length;const ability=fiveAbility(r);const score=k=>ability[k].n?Math.round(ability[k].sum/ability[k].n):null;const A=[score('drive'),score('approach'),score('short'),score('rescue'),score('putt')],labels=['開球','攻果嶺','短切','救球','推桿'];const cx=150,cy=132,R=92,pts=(rad)=>[0,1,2,3,4].map(i=>{const a=-Math.PI/2+i*Math.PI*2/5;return[(cx+Math.cos(a)*R*rad).toFixed(1),(cy+Math.sin(a)*R*rad).toFixed(1)]});const rings=[.25,.5,.75,1].map(v=>'<polygon points="'+pts(v).map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#cddae2" stroke-width="1"/>').join('');const axes=pts(1).map(p=>'<line x1="150" y1="132" x2="'+p[0]+'" y2="'+p[1]+'" stroke="#dbe5eb"/>').join('');const dataPts=[0,1,2,3,4].map((i)=>{const v=(A[i]??0)/100,a=-Math.PI/2+i*Math.PI*2/5;return[(cx+Math.cos(a)*R*v).toFixed(1),(cy+Math.sin(a)*R*v).toFixed(1)]});const radarSvg='<div class="radar"><svg viewBox="0 0 300 245" aria-label="五角能力圖">'+rings+axes+(A.every(v=>v!==null)?'<polygon points="'+dataPts.map(p=>p.join(',')).join(' ')+'" fill="rgba(23,110,168,.20)" stroke="#176ea8" stroke-width="3"/>':dataPts.map((p,i)=>A[i]===null?'':'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="#176ea8"/>').join(''))+pts(1.17).map((p,i)=>'<text x="'+p[0]+'" y="'+p[1]+'" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="800" fill="#31556d">'+labels[i]+'</text>').join('')+'</svg><div class="abilityLegend">'+labels.map((l,i)=>'<div class="ability"><b>'+(A[i]??'—')+'</b>'+l+'<br>'+ability[['drive','approach','short','rescue','putt'][i]].sum/100+'/'+ability[['drive','approach','short','rescue','putt'][i]].n+'</div>').join('')+'</div><div class="small" style="margin-top:7px;line-height:1.5">開球＝無開球罰桿且無Trouble的比例；攻果嶺＝原Par−1桿內到可推位置（含罰桿、含GIR）；短切＝非沙坑PW／挖起桿有距離後直接接PT；救球＝沙坑後直接接PT；推桿＝兩推內完成。各角為成功率，附成功／樣本數；兩模式使用相同基準。— 表示資料不足，缺項不畫成0分。新記開球預設安全，遇麻煩請標Trouble；舊紀錄未記狀態不推定成功。</div></div>';const clubRows=Object.entries(clubs).filter(([c])=>c!=='PT'&&c!=='罰').sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...clubRows.map(x=>x[1]));const bars=clubRows.map(([c,n])=>`<div class="bar"><b>${escapeHTML(c)}</b><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><b>${n}</b></div>`).join('')||'<span class="small">尚無球桿資料</span>';const wedgeDistances=[10,20,30,40,50,60,70,80,90,100,110,120],wedgeClubs=['PW','50°','56°','58°','60°'];const wedgeGrid=`<div class="wgrid" style="grid-template-columns:44px repeat(5,58px);min-width:334px"><div class="wc wh">碼</div>${wedgeClubs.map(x=>`<div class="wc wh">${x}</div>`).join('')}${wedgeDistances.map(d=>`<div class="wc good">${d}y</div>${wedgeClubs.map(club=>{const w=wedges[club+'|'+d];return `<div class="wc">${w?Math.round(w.direct/w.total*100)+'% ('+w.direct+'/'+w.total+')':'—'}</div>`}).join('')}`).join('')}</div>`;const totals=C.stats(r,mode);total=totals.score;putts=totals.putts;penalties=totals.penalties;app.innerHTML=`<div class="head"><div><div class="ey">ROUND ANALYSIS</div><h1>${escapeHTML(r.course)}</h1><div class="sub">總桿含所有已記錄桿數；下列洞別分析採已完成洞</div></div><button class="back" onclick="location.href='${RoundView.url(document.body.dataset.mode==='history'?'history-round.html':'summary.html',mode)}'">總覽</button></div>${RoundView.controls(r,mode)}<div class="analysis-basis-summary">相對${RoundView.label(mode)} <b>${RoundView.relative(totals.relative)}</b>（${totals.relativeN}洞） · ${mode==='bogey'?'新手上果嶺率':'GIR推估'} <b>${totals.girN?Math.round(totals.gir/totals.girN*100)+'%':'—'}</b>（${totals.gir}/${totals.girN}）<br>${mode==='bogey'?'依新手Par−2桿判斷攻果嶺，並非正式GIR。':'依球場Par−2桿判斷攻果嶺。'}切換只改變比較基準，實際桿數不變。</div><div class="cards"><div class="card"><b>${total}</b><span>總桿</span></div><div class="card"><b>${putts}</b><span>推桿</span></div><div class="card"><b>${penalties}</b><span>罰桿</span></div></div><div class="section">五角能力（新版成功率）</div>${radarSvg}<div class="section">開球失誤紀錄</div><div class="putts"><div class="putt"><b>${drivingHoles}</b><span class="small">球場原Par 4／5開球洞</span></div><div class="putt"><b>${penaltyDrives}</b><span class="small">開球後罰桿洞</span></div><div class="putt"><b>${troubleDrives}</b><span class="small">標記陷入麻煩</span></div><div class="putt"><b>${drivingHoles?Math.round(troubleDrives/drivingHoles*100)+"%":"—"}</b><span class="small">陷入麻煩率</span></div></div><div class="small" style="margin-top:5px">「陷入麻煩」由使用者主動標記，不自動判斷是否失誤；不另加罰桿。開球後罰桿洞為第一擊後緊接罰桿的洞數。</div><div class="section">長桿 Trouble（逐桿）</div><div class="putts"><div class="putt"><b>${longShots.length}</b><span class="small">長桿次數</span></div><div class="putt"><b>${longTroubles}</b><span class="small">Trouble次數</span></div><div class="putt"><b>${longShots.length?Math.round(longTroubles/longShots.length*100)+"%":"—"}</b><span class="small">Trouble率</span></div><div class="putt"><b>${troubleDrives}</b><span class="small">開球Trouble洞</span></div></div><div class="small" style="margin-top:5px">Trouble為球友標記的困難球位事件，不另外加桿；與OB等罰桿分開統計。長桿包含木桿、Hybrid／Utility與1～6號鐵。</div><div class="section">推桿結果</div><div class="putts"><div class="putt"><b>${one}</b><span class="small">1推洞</span></div><div class="putt"><b>${two}</b><span class="small">2推洞</span></div><div class="putt"><b>${three}</b><span class="small">3+推洞</span></div><div class="putt"><b>${ok}</b><span class="small">含OK洞</span></div></div><div class="section">第一推距離紀錄（每洞第一推）</div><div class="putts">${Object.entries(dist).filter(([k,v])=>v>0||['OK','1y','3y','5y','10y','15y+'].includes(k)).map(([k,v])=>`<div class="putt"><b>${v}</b><span class="small">${escapeHTML(k)}</span></div>`).join('')}</div>${prePuttHTML(r)}${distanceApproachHTML(r)}<div class="section">短距離成功率</div><div class="wedgeTable">${wedgeGrid}</div><div class="small" style="margin-top:6px;line-height:1.5">成功＝該距離使用這支球桿後，下一桿直接進入推桿。括號為成功次數／使用次數；— 表示本場沒有使用。</div><div class="section">球桿使用次數</div><div class="box"><div class="bars">${bars}</div></div><div class="notice"><b>完成 ${totals.done}/18 洞；${mode==='bogey'?'新手上果嶺率':'GIR推估'}樣本 ${totals.girN} 洞。</b><br>舊公尺分類保留原標籤，不當作碼數評分。${r.unassignedHoles?.length?'另有待確認位置的舊紀錄，請回總覽查看；未納入分析。':''}<br>五角攻果嶺固定採原Par−1桿的可推到位率，果嶺外PT也納入，並非正式GIR。救球只採明確標記沙坑的擊球；不推算未記球位。五角有關聯，不加總為總能力分數。</div>`;RoundView.bind();}
}catch(e){const a=document.getElementById('app');a.textContent=e.message;const link=document.createElement('a');link.href='data.html';link.textContent=' 備份／還原';a.appendChild(link);}
