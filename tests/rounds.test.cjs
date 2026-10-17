const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const C=require('../round-core.js');
function storage(initial={}){
 const data=new Map(Object.entries(initial));
 return {failKey:null,readOverride:null,getItem(k){return this.readOverride?.(k)??data.get(k)??null},setItem(k,v){if(k===this.failKey)throw Error('QuotaExceededError');data.set(k,String(v))},removeItem(k){data.delete(k)},get length(){return data.size},key(i){return [...data.keys()][i]},dump(){return Object.fromEntries(data)}};
}
function env(initial={},mode='active',shared){
 const localStorage=shared||storage(initial),nodes={};
 const element=()=>({innerHTML:'',textContent:'',dataset:{},style:{},children:[],classList:{add(){},remove(){},contains(){return false}},appendChild(x){this.children.push(x);return x},append(...x){this.children.push(...x)},querySelector(){return element()},click(){},remove(){}});
 const document={body:{...element(),dataset:{mode}},getElementById(id){return nodes[id]||(nodes[id]=element())},createElement:element,querySelectorAll(){return []}};
 const context=vm.createContext({console,localStorage,document,Date,JSON,Math,crypto:require('node:crypto').webcrypto,Blob,URL,URLSearchParams,Image:function(){},setTimeout(){return 1},clearTimeout(){},location:{search:'',href:'',replace(x){this.href=x}},alert(){},confirm(){return true},addEventListener(){}});context.window=context;context.globalThis=context;
 function run(file){return vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
 run('round-core.js');run('round-store.js');
 return {S:context.RoundStore,C:context.RoundCore,localStorage,nodes,document,context,run};
}
const meta=(extra={})=>({course:'Test',courseHoles:18,startHole:1,pars:Array(18).fill(4),...extra});
const legacy=(extra={})=>({id:123,...meta(),createdAt:'2026-10-17T00:00:00Z',status:'finished',holes:{1:{par:4,shots:[{club:'1W'},{club:'PT',putt:'1y'}]}},...extra});
function fill(r,i,shots,par=4,status='completed'){Object.assign(r.roundSlots[i],{shots,par,status});return r;}
const makeBackup=(r)=>({format:'arhorngor-backup',version:1,raw:{'arhorngor-history':JSON.stringify([r])}});
const extractCards=html=>Object.fromEntries([...html.matchAll(/class="card"><b>(.*?)<\/b><span>(.*?)<\/span>/g)].map(m=>[m[2],m[1]]));

test('18 holes starting at 10 preserve actual front/back position order',()=>{
 const r=C.create(meta({startHole:10}));assert.deepEqual(r.roundSlots.map(s=>s.courseHoleId),[10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]);
 fill(r,0,[{club:'1W'}]);fill(r,9,[{club:'1W'},{club:'PT'}]);assert.equal(C.stats(r).halves[0].score,1);assert.equal(C.stats(r).halves[1].score,2);
});
test('27/36 hole custom sections, including repeated section, have distinct slot IDs',()=>{
 for(const courseHoles of [27,36])for(const sections of [[2,0],[1,1]]){
  const r=C.create(meta({courseHoles,pars:Array(courseHoles).fill(4),playSections:sections}));assert.equal(r.roundSlots[0].courseHoleId,sections[0]*9+1);assert.equal(r.roundSlots[9].courseHoleId,sections[1]*9+1);assert.equal(new Set(r.roundSlots.map(s=>s.id)).size,18);C.validateRound(r);
 }
});
test('same physical hole twice stores independent shots and totals',()=>{
 let r=C.create(meta());r=C.replaceHole(r,r.roundSlots[9].id,1);fill(r,0,[{club:'1W'},{club:'PT'}]);fill(r,9,[{club:'1W'},{club:'9I'},{club:'PT'}]);assert.equal(C.stats(r).score,5);assert.equal(r.roundSlots[0].shots.length,2);assert.equal(r.roundSlots[9].shots.length,3);
});
test('replacing a started slot or partially played section is rejected without mutation',()=>{
 const r=C.create(meta({courseHoles:36,pars:Array(36).fill(4)}));fill(r,11,[{club:'1W'}],4,'in_progress');const before=JSON.stringify(r);
 assert.throws(()=>C.replaceHole(r,r.roundSlots[11].id,28));assert.throws(()=>C.replaceSection(r,r.roundSlots[9].id,3));assert.equal(JSON.stringify(r),before);
});
test('section replacement changes exactly nine empty slots',()=>{
 const r=C.create(meta({courseHoles:36,pars:Array(36).fill(4)}));const next=C.replaceSection(r,r.roundSlots[9].id,3);assert.deepEqual(next.roundSlots.slice(9).map(s=>s.courseHoleId),[28,29,30,31,32,33,34,35,36]);assert.deepEqual(next.roundSlots.slice(0,9),r.roundSlots.slice(0,9));assert.throws(()=>C.replaceSection(r,r.roundSlots[10].id,0));
});
test('E5 counts two strokes, local replay one, Trouble adds zero',()=>{
 assert.equal(C.strokes([{club:'1W',trouble:true},{club:'罰',penalty:'OB 前方補球'},{club:'PT'}]),4);
 assert.equal(C.strokes([{club:'1W'},{club:'罰',penalty:'OB 原地重打'},{club:'PT'}]),3);
 assert.equal(C.penalty({club:'罰'}),1);
});
test('E5 is excluded correctly from GIR eligibility result on Par5',()=>{
 const r=fill(C.create(meta()),0,[{club:'1W'},{club:'罰',penalty:'OB 前方補球'},{club:'9I'},{club:'PT'}],5);const t=C.stats(r);assert.equal(t.score,5);assert.equal(t.gir,0);assert.equal(t.girN,1);assert.equal(t.relative,0);
});
test('unfinished and unknown-Par holes never distort relative score or completion',()=>{
 let r=C.create(meta());fill(r,0,Array(5).fill({club:'9I'}),4);fill(r,1,Array(5).fill({club:'9I'}),null);fill(r,2,[{club:'1W'}],4,'in_progress');const t=C.stats(r);assert.equal(t.score,11);assert.equal(t.relative,1);assert.equal(t.relativeN,1);assert.equal(t.done,2);assert.equal(t.recorded,3);assert.equal(t.halves[0].done,2);
});
test('chip-in without PT has a score, but no guessed GIR',()=>{
 const t=C.stats(fill(C.create(meta()),0,[{club:'1W'},{club:'58°',distance:20}],4));assert.equal(t.score,2);assert.equal(t.girN,0);
});
test('legacy read preserves input, original units and unclear out-of-order holes',()=>{
 const raw=legacy({courseHoles:27,pars:Array(27).fill(4),holes:{1:{par:4,shots:[{club:'PT',putt:'<3m'}]},19:{par:4,shots:[{club:'PT',putt:'7m+'}]}}}),before=JSON.stringify(raw),r=C.normalize(raw);assert.equal(JSON.stringify(raw),before);assert.equal(r.roundSlots[0].shots[0].putt,'<3m');assert.equal(r.unassignedHoles.length,1);assert.equal(C.stats(r).score,1);assert.equal(r.unassignedHoles[0].shots[0].putt,'7m+');
});
test('legacy repeated playOrder never duplicates one old score',()=>{
 const raw=legacy({playOrder:[1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,8,9]});const r=C.normalize(raw);assert.equal(C.stats(r).score,2);assert.equal(r.roundSlots[9].shots.length,0);assert.ok(r.legacyWarnings.length);
});
test('legacy active records require explicit per-hole completion',()=>{
 const r=C.normalize(legacy({status:'in_progress'}));assert.equal(r.roundSlots[0].status,'unconfirmed');assert.equal(C.stats(r).done,0);assert.equal(C.stats(r).relative,null);
});
test('read-only legacy views make zero writes',()=>{
 const initial={'arhorngor-active-round':JSON.stringify(legacy({status:'in_progress'})),'arhorngor-history':JSON.stringify([legacy()])};const e=env(initial);e.S.active();e.S.entries();assert.deepEqual(e.localStorage.dump(),initial);
});
test('starting new round archives existing active and preserves every original byte',()=>{
 const initial={'arhorngor-active-round':'  '+JSON.stringify(legacy({status:'in_progress'}))+'\n','arhorngor-history':JSON.stringify([legacy()])};const e=env(initial);e.S.create(meta());assert.equal(e.S.entries().length,3);for(const [k,v]of Object.entries(initial))assert.equal(e.localStorage.getItem(k),v);const snapshot=JSON.parse(e.localStorage.getItem(e.S.SNAPSHOT));assert.deepEqual(snapshot.raw['arhorngor-active-round'],initial['arhorngor-active-round']);
});
test('finishing round stores history and clears active only in atomic V2 envelope',()=>{
 const e=env(),entry=e.S.create(meta());const r=fill(entry.round,0,[{club:'PT'}]);e.S.update(entry.id,r);e.S.finish(entry.id,r);assert.equal(e.S.active(),null);assert.equal(e.S.selected().round.status,'finished');assert.equal(e.S.entries().length,1);assert.equal(e.S.entries()[0].round.totalScore,1);
});
test('finishing cannot destroy a different currently active round',()=>{
 const e=env(),old=e.S.create(meta()),next=e.S.create(meta());assert.throws(()=>e.S.finish(old.id));assert.equal(e.S.active().id,next.id);
});
for(const stage of ['main','previous','snapshot'])test(`storage failure at ${stage} preserves originals and last committed state`,()=>{
 const raw=JSON.stringify(legacy({status:'in_progress'})),e=env({'arhorngor-active-round':raw});
 if(stage!=='snapshot')e.S.create(meta());const before=e.localStorage.getItem(e.S.KEY);e.localStorage.failKey=stage==='main'?e.S.KEY:stage==='previous'?e.S.PREVIOUS:e.S.SNAPSHOT;assert.throws(()=>e.S.create(meta()));assert.equal(e.localStorage.getItem(e.S.KEY),before);assert.equal(e.localStorage.getItem('arhorngor-active-round'),raw);
});
test('quota failure during finish keeps active and prior shots',()=>{
 const e=env(),entry=e.S.create(meta());let r=fill(entry.round,0,[{club:'PT'}]);e.S.update(entry.id,r);e.localStorage.failKey=e.S.KEY;assert.throws(()=>e.S.finish(entry.id,r));assert.equal(e.S.active().id,entry.id);assert.equal(e.S.active().round.status,'in_progress');
});
test('stale tab cannot overwrite newer shots',()=>{
 const e=env(),entry=e.S.create(meta()),other=env({},'active',e.localStorage);const old=other.S.active();const r=fill(C.clone(entry.round),0,[{club:'PT'}]);e.S.update(entry.id,r,entry.round);assert.throws(()=>other.S.update(entry.id,old.round,old.round),/其他分頁/);assert.equal(e.S.active().round.roundSlots[0].shots.length,1);
});
test('import preview is read-only, repeated imports are idempotent, ID collisions create copies',()=>{
 const e=env(),doc=makeBackup(legacy()),before=e.localStorage.dump(),p=e.S.previewImport(doc);assert.deepEqual(e.localStorage.dump(),before);assert.equal(p.add.length,1);e.S.applyImport(doc,p);assert.equal(e.S.previewImport(doc).duplicates,1);const changed=legacy();changed.holes[1].shots.push({club:'PT'});const p2=e.S.previewImport(makeBackup(changed));assert.equal(p2.conflicts,1);e.S.applyImport(makeBackup(changed),p2);assert.equal(e.S.entries().length,2);assert.equal(new Set(e.S.entries().map(x=>x.id)).size,2);assert.equal(e.S.entries()[0].original.holes[1].shots.length,2);
});
test('import preserves current active round and exported originals survive round trip',()=>{
 const e=env({'arhorngor-history':JSON.stringify([legacy()])}),a=e.S.create(meta());const b=e.S.backup(),other=env(),p=other.S.previewImport(b);other.S.applyImport(b,p);assert.equal(other.S.entries().length,2);assert.deepEqual(JSON.parse(JSON.stringify(other.S.entries().find(x=>x.original).original)),legacy());const doc=makeBackup(legacy({id:999}));e.S.applyImport(doc,e.S.previewImport(doc));assert.equal(e.S.active().id,a.id);
});
test('import preview becomes invalid after another write',()=>{
 const e=env(),doc=makeBackup(legacy()),p=e.S.previewImport(doc);e.S.create(meta());assert.throws(()=>e.S.applyImport(doc,p),/重新預覽/);
});
test('bad versions, invalid slots and malformed JSON never write data',()=>{
 const e=env(),before=e.localStorage.dump();assert.throws(()=>e.S.previewImport({format:'arhorngor-backup',version:9,raw:{}}));assert.throws(()=>e.S.previewImport({format:'arhorngor-backup',version:1,raw:{'arhorngor-history':'broken'}}));const bad=C.create(meta());bad.roundSlots.pop();assert.throws(()=>e.S.previewImport(makeBackup(bad)));assert.deepEqual(e.localStorage.dump(),before);
});
test('corrupt existing storage remains exportable and is never silently replaced',()=>{
 const e=env({'arhorngor-history':'broken'});assert.throws(()=>e.S.create(meta()));assert.equal(e.S.backup().raw['arhorngor-history'],'broken');assert.equal(e.localStorage.getItem(e.S.KEY),null);
});
test('rollback archives current contents, accepts a corrupt main, and restores valid previous',()=>{
 const e=env(),a=e.S.create(meta());e.S.create(meta());e.localStorage.setItem(e.S.KEY,'broken');e.S.rollback();assert.equal(e.S.active().id,a.id);const archiveKeys=Object.keys(e.localStorage.dump()).filter(k=>k.startsWith('arhorngor-import-original-'));assert.ok(archiveKeys.some(k=>JSON.parse(e.localStorage.getItem(k)).raw[e.S.KEY]==='broken'));
});
test('active and history overview and analysis agree on E5 and repeated physical holes',()=>{
 const e=env(),a=e.S.create(meta({pars:Array(18).fill(5)}));let r=fill(a.round,0,[{club:'1W'},{club:'罰',penalty:'OB 前方補球'},{club:'9I'},{club:'PT',putt:'1y'}],5);r=C.replaceHole(r,r.roundSlots[9].id,1);fill(r,9,[{club:'PT',putt:'3–7m'}],5);e.S.update(a.id,r);e.run('report-v2.js');let cards=extractCards(e.nodes.app.innerHTML);assert.equal(cards['已記錄總桿'],'6');assert.equal(cards['GIR推估 · 1/2'],'50%');e.run('analysis-v2.js');cards=extractCards(e.nodes.app.innerHTML);assert.equal(cards['總桿'],'6');assert.match(e.nodes.app.innerHTML,/<b>50<\/b>攻果嶺/);assert.match(e.nodes.app.innerHTML,/3–7m/);assert.doesNotMatch(e.nodes.app.innerHTML,/3–7y/);
 e.S.finish(a.id,r);e.document.body.dataset.mode='history';e.run('report-v2.js');assert.equal(extractCards(e.nodes.app.innerHTML)['已記錄總桿'],'6');e.run('analysis-v2.js');assert.equal(extractCards(e.nodes.app.innerHTML)['總桿'],'6');
});
test('imported text is escaped in overview and analysis',()=>{
 const e=env(),a=e.S.create(meta({course:'<img src=x onerror=alert(1)>'}));const r=fill(a.round,0,[{club:'<script>attack</script>'},{club:'PT',putt:'<3m'}]);e.S.update(a.id,r);e.run('report-v2.js');assert.doesNotMatch(e.nodes.app.innerHTML,/<img src=x/);assert.match(e.nodes.app.innerHTML,/&lt;3m/);e.run('analysis-v2.js');assert.doesNotMatch(e.nodes.app.innerHTML,/<script>attack/);
});
test('recording UI completes holes, preserves completion on navigation, and independently repeats holes',()=>{
 const e=env(),a=e.S.create(meta());for(const f of ['round-v2.js','round-actions.js','caddies.js'])e.run(f);vm.runInContext('initRound();shots.push({club:"1W"});save();save(true);loadSlot(round.roundSlots[1].id);',e.context);assert.equal(e.S.active().round.roundSlots[0].status,'completed');assert.equal(e.S.active().round.roundSlots[1].shots.length,0);
});
test('penalty add/remove and undo reflect exact stroke totals',()=>{
 const e=env();e.S.create(meta());for(const f of ['round-v2.js','round-actions.js','caddies.js'])e.run(f);vm.runInContext('initRound();addClub("1W");addShotPenalty(0,"OB 前方補球");',e.context);assert.equal(C.stats(e.S.active().round).score,3);vm.runInContext('showShotPenalty(1)',e.context);e.nodes.removePenalty.onclick();assert.equal(C.stats(e.S.active().round).score,1);vm.runInContext('addShotPenalty(0,"OB 原地重打");undo();',e.context);assert.equal(C.stats(e.S.active().round).score,1);
});
