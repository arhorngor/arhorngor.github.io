/* V2 storage is isolated from all legacy keys. Failed writes never clear an active round. */
(function (root) {
  'use strict';
  const C = root.RoundCore;
  const KEY = 'arhorngor-data-v2', SNAPSHOT = 'arhorngor-original-v1', PREVIOUS = 'arhorngor-data-v2-previous';
  const LEGACY = ['arhorngor-active-round','arhorngor-history','arhorngor-view-round','arhorngor-bag','arhorngor-caddie'];
  let observed;
  const parse = (raw, fallback) => raw == null ? fallback : JSON.parse(raw);
  const canonical = x => JSON.stringify(x && typeof x === 'object' ? (Array.isArray(x) ? x.map(v => JSON.parse(canonical(v))) : Object.fromEntries(Object.keys(x).sort().map(k => [k, JSON.parse(canonical(x[k]))]))) : x);
  function validateState(s) {
    if (!s || s.schemaVersion !== 2 || !Number.isInteger(s.revision) || !Array.isArray(s.entries)) throw Error('新版資料格式損壞；請先匯出備份，勿清除網站資料');
    const ids = new Set();
    for (const e of s.entries) {
      if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id)) throw Error('球局ID衝突');
      ids.add(e.id); C.validateRound(e.round);
      if (e.original) C.validateRound(e.original);
    }
    for (const p of ['activeId','viewId']) if (s[p] != null && !ids.has(s[p])) throw Error('球局指標無效');
    return s;
  }
  function legacyState() {
    const active = parse(localStorage.getItem(LEGACY[0]), null), history = parse(localStorage.getItem(LEGACY[1]), []);
    if (!Array.isArray(history)) throw Error('歷史資料格式損壞；可先匯出原始備份');
    const entries = history.map((r,i) => {C.validateRound(r); return {id: `legacy-history-${i}`, original: C.clone(r), round: C.normalize(r)};});
    if (active) { C.validateRound(active); entries.push({id:'legacy-active', original:C.clone(active), round:C.normalize(active)}); }
    return {schemaVersion:2, revision:0, entries, activeId:active ? 'legacy-active' : null, viewId:null};
  }
  function read() {
    observed = localStorage.getItem(KEY);
    return observed == null ? legacyState() : validateState(parse(observed));
  }
  function originalSnapshot() {
    if (localStorage.getItem(SNAPSHOT) != null) return;
    const data = JSON.stringify({createdAt:new Date().toISOString(), raw:Object.fromEntries(LEGACY.map(k => [k,localStorage.getItem(k)]))});
    localStorage.setItem(SNAPSHOT,data);
    if (localStorage.getItem(SNAPSHOT) !== data) throw Error('原始備份讀回驗證失敗');
  }
  function write(s) {
    validateState(s);
    if (localStorage.getItem(KEY) !== observed) throw Error('另一個分頁已更新資料，請重新整理後再操作');
    try {
      originalSnapshot();
      if (observed != null) {
        localStorage.setItem(PREVIOUS, observed);
        if (localStorage.getItem(PREVIOUS) !== observed) throw Error('回退副本驗證失敗');
      }
      const next = JSON.stringify({...s, revision:s.revision + 1});
      localStorage.setItem(KEY,next);
      if (localStorage.getItem(KEY) !== next) throw Error('寫入後讀回不一致');
      observed = next;
      return JSON.parse(next);
    } catch (e) { throw Error(`儲存未確認成功，請保留本頁並匯出備份。${e.message || '裝置空間可能不足'}`); }
  }
  function active() { const s=read(); return s.entries.find(e => e.id===s.activeId) || null; }
  function selected() { const s=read(); return s.entries.find(e => e.id===s.viewId) || null; }
  function entries() { return read().entries; }
  function create(meta) {
    const s=read(), r=C.create(meta), e={id:C.uid(),round:r};
    s.entries.unshift(e); s.activeId=e.id; write(s); return e;
  }
  function update(id, round, expectedRound) {
    const s=read(), e=s.entries.find(x=>x.id===id);
    if (!e) throw Error('球局不存在');
    if (expectedRound && canonical(e.round)!==canonical(expectedRound)) throw Error('這場球局已在其他分頁更新，請重新整理；本次未覆寫');
    e.round=C.clone(round); write(s); return e;
  }
  function select(id) {const s=read(); if (!s.entries.some(e=>e.id===id)) throw Error('找不到球局'); s.viewId=id; write(s);}
  function resume(id) {const s=read(),e=s.entries.find(e=>e.id===id); if(!e)throw Error('找不到球局'); if(e.round.status==='finished')throw Error('已完成球局不可直接接續');s.activeId=id;write(s);}
  function finish(id, expectedRound) {
    const s=read(),e=s.entries.find(e=>e.id===id);
    if(!e || s.activeId!==id)throw Error('進行中的球局已變更，請重新整理');
    if(expectedRound && canonical(e.round)!==canonical(expectedRound))throw Error('球局已更新，請重新整理');
    if(!e.round.roundSlots.some(x=>x.shots.length))throw Error('空白球局不能完成');
    e.round={...e.round,status:'finished',finishedAt:new Date().toISOString(),totalScore:C.stats(e.round).score};
    s.activeId=null;s.viewId=id;write(s);
  }
  function backup() {
    return {format:'arhorngor-backup',version:1,exportedAt:new Date().toISOString(),raw:Object.fromEntries([...LEGACY,KEY,SNAPSHOT,PREVIOUS].map(k=>[k,localStorage.getItem(k)]))};
  }
  function download(value, prefix='Arhorngor_backup') {
    const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${prefix}_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function importCandidates(doc) {
    if(!doc || doc.format!=='arhorngor-backup' || doc.version!==1 || !doc.raw || typeof doc.raw!=='object')throw Error('不支援的備份格式或版本');
    for(const value of Object.values(doc.raw))if(value!==null&&typeof value!=='string')throw Error('原始備份欄位必須為字串');
    let incoming=[];
    if(doc.raw[KEY]!=null) incoming=validateState(parse(doc.raw[KEY])).entries.map(e=>C.clone(e));
    else {
      const old=parse(doc.raw[LEGACY[1]],[]),a=parse(doc.raw[LEGACY[0]],null);
      if(!Array.isArray(old))throw Error('備份歷史資料格式錯誤');
      incoming=[...old,...(a?[a]:[])].map(r=>{C.validateRound(r);return {round:C.normalize(r),original:C.clone(r)};});
    }
    return incoming;
  }
  function previewImport(doc) {
    const incoming=importCandidates(doc),s=read(),existing=[...s.entries],add=[];let duplicates=0,conflicts=0;
    for(const e of incoming){
      const same=existing.some(x=>canonical(x.round)===canonical(e.round));
      if(same){duplicates++;continue;}
      const conflict=existing.some(x=>String(x.round.id)===String(e.round.id));
      if(conflict)conflicts++;
      const copy={...e,id:C.uid(),importedAt:new Date().toISOString(),importConflict:conflict};add.push(copy);existing.push(copy);
    }
    return {add,duplicates,conflicts,revision:s.revision,base:observed};
  }
  function applyImport(doc, preview) {
    const s=read();if(observed!==preview.base)throw Error('預覽後資料已變動，請重新預覽');
    const checked=previewImport(doc);if(!checked.add.length)return checked;
    // Preserve the incoming source verbatim as an immutable archive before committing new entries.
    const archiveKey=`arhorngor-import-original-${C.uid()}`,raw=JSON.stringify(doc);
    localStorage.setItem(archiveKey,raw);if(localStorage.getItem(archiveKey)!==raw)throw Error('匯入原始備份保存失敗');
    s.entries.push(...checked.add.map(e=>({...e,importArchiveKey:archiveKey})));write(s);return checked;
  }
  function backupAll() {
    const b=backup();
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('arhorngor-import-original-'))b.raw[k]=localStorage.getItem(k);}
    return b;
  }
  function rollback() {
    const previous=localStorage.getItem(PREVIOUS);
    if(!previous)throw Error('尚無上一保存版本');
    const s=validateState(parse(previous)),current=localStorage.getItem(KEY),archive=JSON.stringify(backupAll());
    const k=`arhorngor-import-original-${C.uid()}`;
    localStorage.setItem(k,archive);if(localStorage.getItem(k)!==archive)throw Error('目前原文備份失敗，未回退');
    if(localStorage.getItem(KEY)!==current)throw Error('其他分頁已更新，未回退');
    const raw=JSON.stringify({...s,revision:s.revision+1});localStorage.setItem(KEY,raw);
    if(localStorage.getItem(KEY)!==raw)throw Error('回退讀回驗證失敗');observed=raw;
  }
  root.RoundStore={KEY,SNAPSHOT,PREVIOUS,read,active,selected,entries,create,update,select,resume,finish,backup:backupAll,download,previewImport,applyImport,rollback,canonical,validateState};
})(typeof window==='undefined'?globalThis:window);
