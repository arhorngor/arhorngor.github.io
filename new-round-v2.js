function showStart(c){
  selected=c;startHole=1;
  const sections=c.holes>18;
  const starts=sections?Array.from({length:c.holes/9},(_,i)=>({hole:i*9+1,label:c.sections?.[i]||`第${i*9+1}洞`})): [{hole:1,label:'第1洞'},{hole:10,label:'第10洞'}];
  APP.innerHTML=`<main class="page"><div class="head"><div><div class="ey">STARTING HOLE</div><div class="title">${c.name}</div></div><button class="back" id="back">返回</button></div><div class="starts">${starts.map((s,i)=>`<button class="startChoice ${i===0?'on':''}" data-hole="${s.hole}">${s.label}</button>`).join('')}</div>${sections?`<p>後九區域</p><select id="secondSection" style="width:100%;padding:14px;font-size:18px">${starts.map((s,i)=>`<option value="${i}" ${i===1?'selected':''}>${s.label}</option>`).join('')}</select>`:''}<p class="note">本場共18個記分位置。前九／後九依實際記分位置計算；同一區可選兩次。</p><button class="primary" id="begin">開始球局</button><p><a href="data.html">資料備份／還原</a></p></main>`;
  document.getElementById('back').onclick=showCourses;
  document.querySelectorAll('[data-hole]').forEach(b=>b.onclick=()=>{startHole=+b.dataset.hole;document.querySelectorAll('[data-hole]').forEach(x=>x.classList.remove('on'));b.classList.add('on');if(sections)document.getElementById('secondSection').value=(Math.floor((startHole-1)/9)+1)%starts.length;});
  document.getElementById('begin').onclick=beginRound;
}
function beginRound(){
  try{
    const previous=RoundStore.active();
    if(previous&&!confirm('目前有未完成球局。開始新局後，原局會保留在「歷史與暫存球局」，可隨時接續。確定開始？'))return;
    if(!localStorage.getItem(RoundStore.KEY)&&(localStorage.getItem('arhorngor-active-round')||localStorage.getItem('arhorngor-history')))RoundStore.download(RoundStore.backup());
    const si=selected.holes>18?Math.floor((startHole-1)/9):null;
    RoundStore.create({course:selected.name,courseHoles:selected.holes,startHole,pars:selected.pars||null,parSource:selected.parSource||null,sections:selected.sections||null,playSections:si===null?null:[si,+document.getElementById('secondSection').value]});
    window.ArhorngorAnalytics?.track('round_started');location.href='round.html?v=20';
  }catch(e){alert(e.message);}
}
try{const qs=new URLSearchParams(location.search);if(qs.get('continue')==='1'&&RoundStore.active())location.replace('round.html?v=20');else showCourses();}catch(e){APP.textContent=e.message;const a=document.createElement('a');a.href='data.html';a.textContent=' 前往備份／還原';APP.appendChild(a);}
