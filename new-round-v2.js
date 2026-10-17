function showStart(c){
  selected=c;startHole=1;
  const sections=c.holes>18;
  const starts=sections?Array.from({length:c.holes/9},(_,i)=>({hole:i*9+1,label:c.sections?.[i]||`第${i*9+1}洞`})): [{hole:1,label:'第1洞'},{hole:10,label:'第10洞'}];
  APP.innerHTML=`<main class="page"><div class="head"><div><div class="ey">STARTING HOLE</div><div class="title">${c.name}</div></div><button class="back" id="back">返回</button></div><div class="starts">${starts.map((s,i)=>`<button class="startChoice ${i===0?'on':''}" data-hole="${s.hole}">${s.label}</button>`).join('')}</div>${sections?`<p>後九區域</p><select id="secondSection" style="width:100%;padding:14px;font-size:18px">${starts.map((s,i)=>`<option value="${i}" ${i===1?'selected':''}>${s.label}</option>`).join('')}</select>`:''}<p class="note">本場共18個記分位置。前九／後九依實際記分位置計算；同一區可選兩次。</p><div class="mode-title">這場怎麼打？</div><label class="mode-option"><input type="radio" name="scoringMode" value="standard" checked><span><b>標準模式</b><small>依球場原始 Par 記分。</small></span></label><label class="mode-option"><input type="radio" name="scoringMode" value="bogey"><span><b>Bogey Base · 新手模式</b><small>每洞多給自己一桿：3→4、4→5、5→6。<br><span id="bogeyGoal">一般 Par72 球場，以90桿為新手 Par。</span></small></span></label><button class="primary" id="begin">開始球局</button><p><a href="data.html">資料備份／還原</a></p></main>`;
  document.getElementById('back').onclick=showCourses;
  document.querySelectorAll('[data-hole]').forEach(b=>b.onclick=()=>{startHole=+b.dataset.hole;document.querySelectorAll('[data-hole]').forEach(x=>x.classList.remove('on'));b.classList.add('on');if(sections)document.getElementById('secondSection').value=(Math.floor((startHole-1)/9)+1)%starts.length;updateBogeyGoal();});
  document.getElementById('begin').onclick=beginRound;if(sections)document.getElementById('secondSection').onchange=updateBogeyGoal;updateBogeyGoal();
}
function updateBogeyGoal(){
  const si=selected.holes>18?Math.floor((startHole-1)/9):null;
  const holes=RoundCore.order({courseHoles:selected.holes,startHole,playSections:si===null?null:[si,+document.getElementById('secondSection').value]});
  const pars=holes.map(n=>selected.pars?.[n-1]);
  document.getElementById('bogeyGoal').textContent=pars.every(RoundCore.validPar)?`本場新手 Par ${pars.reduce((a,b)=>a+b,0)+18}；球僮也按新手 Par 陪你打。`:'此球場 Par 資料未齊；已知的每洞 Par＋1，總目標待補齊。';
}
function beginRound(){
  try{
    const previous=RoundStore.active();
    if(previous&&!confirm('目前有未完成球局。開始新局後，原局會保留在「歷史與暫存球局」，可隨時接續。確定開始？'))return;
    if(!localStorage.getItem(RoundStore.KEY)&&(localStorage.getItem('arhorngor-active-round')||localStorage.getItem('arhorngor-history')))RoundStore.download(RoundStore.backup());
    const si=selected.holes>18?Math.floor((startHole-1)/9):null;
    RoundStore.create({scoringMode:document.querySelector('input[name="scoringMode"]:checked')?.value||'standard',course:selected.name,courseHoles:selected.holes,startHole,pars:selected.pars||null,parSource:selected.parSource||null,sections:selected.sections||null,playSections:si===null?null:[si,+document.getElementById('secondSection').value]});
    window.ArhorngorAnalytics?.track('round_started');location.href='round.html?v=21';
  }catch(e){alert(e.message);}
}
try{const qs=new URLSearchParams(location.search);if(qs.get('continue')==='1'&&RoundStore.active())location.replace('round.html?v=21');else showCourses();}catch(e){APP.textContent=e.message;const a=document.createElement('a');a.href='data.html';a.textContent=' 前往備份／還原';APP.appendChild(a);}
