'use strict';
const S=RoundStore,message=document.getElementById('message'),preview=document.getElementById('preview'),importButton=document.getElementById('import');
let doc=null,plan=null;
document.getElementById('export').onclick=()=>{try{S.download(S.backup());message.textContent='已啟動下載。請到裝置的下載／檔案確認備份檔。';}catch(e){message.textContent=e.message}};
document.getElementById('file').onchange=async e=>{
  doc=null;plan=null;importButton.disabled=true;message.textContent='';
  try{const f=e.target.files[0];if(!f)return;if(f.size>30*1024*1024)throw Error('備份超過30MB，請先分批匯入');doc=JSON.parse(await f.text());plan=S.previewImport(doc);preview.textContent=`新增 ${plan.add.length} 場\n相同內容跳過 ${plan.duplicates} 場\n其中同ID不同內容 ${plan.conflicts} 場：另存副本\n現有球局與目前進行中球局均保留。\n球袋／球僮設定保留在原始匯入備份，這次不取代裝置設定。`;importButton.disabled=!plan.add.length;}catch(err){preview.textContent='未匯入任何資料';message.textContent=err.message;}
};
importButton.onclick=()=>{try{S.download(S.backup());const result=S.applyImport(doc,plan);message.textContent=`已新增${result.add.length}場，可到歷史與暫存球局查看。`;importButton.disabled=true;doc=null;plan=null;}catch(e){message.textContent=e.message;}};
document.getElementById('rollback').onclick=()=>{try{if(!confirm('將另存目前原文並回退上一保存版本。確定？'))return;S.download(S.backup());S.rollback();message.textContent='已回退。請重新開啟球局頁面。';}catch(e){message.textContent=e.message}};
