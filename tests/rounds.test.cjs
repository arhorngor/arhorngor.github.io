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
 run('round-core.js');run('round-store.js');run('scoring-view.js');
 return {S:context.RoundStore,C:context.RoundCore,localStorage,nodes,document,context,run};
}
const meta=(extra={})=>({course:'Test',courseHoles:18,startHole:1,pars:Array(18).fill(4),...extra});
const legacy=(extra={})=>({id:123,...meta(),createdAt:'2026-10-17T00:00:00Z',status:'finished',holes:{1:{par:4,shots:[{club:'1W'},{club:'PT',putt:'1y'}]}},...extra});
function fill(r,i,shots,par=4,status='completed'){Object.assign(r.roundSlots[i],{shots,par,status});return r;}
const makeBackup=(r)=>({format:'arhorngor-backup',version:1,raw:{'arhorngor-history':JSON.stringify([r])}});
const extractCards=html=>Object.fromEntries([...html.matchAll(/class="card"><b>(.*?)<\/b><span>(.*?)<\/span>/g)].map(m=>[m[2],m[1]]));

test('Miramar official four sections: all 16 ordered pairs, both modes, UI and stored scores',()=>{
 const expected=[[4,5,3,4,4,5,3,4,4],[4,3,4,5,4,4,3,5,4],[4,3,5,4,4,3,4,4,5],[4,4,5,4,3,4,4,3,5]];
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(const mode of ['standard','bogey']){
  const e=env();e.run('courses.js');const course=e.context.ARHORNGOR_COURSES.find(c=>c.name==='美麗華（官方四區）');
  assert.deepEqual(Array.from(course.sections),['北區','東區','南區','西區']);assert.deepEqual(Array.from(course.pars),expected.flat());
  e.document.querySelector=()=>({value:mode});e.run('app.js');e.run('new-round-v2.js');
  vm.runInContext("showStart(ARHORNGOR_COURSES.find(c=>c.name==='美麗華（官方四區）'))",e.context);
  e.nodes.firstSection.value=String(a);e.nodes.secondSection.value=String(b);vm.runInContext('updateBogeyGoal();beginRound()',e.context);
  assert.match(e.nodes.bogeyGoal.textContent,/新手 Par 90/);
  const entry=e.S.active(),r=entry.round;
  assert.deepEqual(Array.from(r.roundSlots,s=>s.par),[...expected[a],...expected[b]]);
  assert.equal(new Set(r.roundSlots.map(s=>s.id)).size,18);
  assert.equal(C.holeLabel(r,r.roundSlots[0].courseHoleId),course.sections[a]+' 第1洞');
  assert.equal(C.holeLabel(r,r.roundSlots[9].courseHoleId),course.sections[b]+' 第1洞');
  r.roundSlots.forEach(s=>{s.shots=[...Array(s.par-1).fill({club:'9I'}),{club:'PT'},{club:'PT'}];s.status='completed'});
  C.validateRound(r);const before=JSON.stringify(r);
  for(const basis of ['standard','bogey']){
   const t=C.stats(r,basis);assert.equal(t.score,90);assert.equal(t.targetPar,basis==='bogey'?90:72);assert.equal(t.relative,basis==='bogey'?0:18);
   t.halves.forEach(h=>{assert.equal(h.score,45);assert.equal(h.targetPar,basis==='bogey'?45:36)});
  }
  assert.equal(C.stats(r).targetPar,mode==='bogey'?90:72);assert.equal(JSON.stringify(r),before);
  e.S.update(entry.id,r);e.S.finish(entry.id,r);assert.equal(C.stats(e.S.selected().round).score,90);
 }
});

test('Miramar data addition preserves old placeholders, West/South route and saved snapshots',()=>{
 const raw=legacy({course:'美麗華',courseHoles:36,sections:['A區','B區','C區','D區'],pars:null});
 const initial={'arhorngor-history':JSON.stringify([raw])},e=env(initial);const before=e.localStorage.dump();e.run('courses.js');
 assert.deepEqual(e.localStorage.dump(),before);assert.equal(e.context.ARHORNGOR_COURSES.find(c=>c.name==='美麗華').pars,undefined);
 assert.deepEqual(Array.from(e.context.ARHORNGOR_COURSES.find(c=>c.name==='美麗華').sections),raw.sections);
 const official=e.context.ARHORNGOR_COURSES.find(c=>c.name==='美麗華（官方四區）');
 assert.deepEqual(Array.from(e.context.ARHORNGOR_COURSES.find(c=>c.name==='美麗華（西／南）').pars),[...Array.from(official.pars.slice(27)),...Array.from(official.pars.slice(18,27))]);
 const r=C.create({course:official.name,courseHoles:36,pars:official.pars,sections:official.sections,playSections:[3,2]});
 fill(r,0,[{club:'1W',trouble:true},{club:'罰',penalty:'OB 前方補球'},{club:'PT'}],4);
 fill(r,9,[{club:'1W'},{club:'罰',penalty:'OB 原地重打'},{club:'PT'}],4);
 assert.equal(C.stats(r).score,7);assert.equal(C.stats(r).penalties,3);
});

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
 const e=env(),a=e.S.create(meta({pars:Array(18).fill(5)}));let r=fill(a.round,0,[{club:'1W'},{club:'罰',penalty:'OB 前方補球'},{club:'9I'},{club:'PT',putt:'1y'}],5);r=C.replaceHole(r,r.roundSlots[9].id,1);fill(r,9,[{club:'PT',putt:'3–7m'}],5);e.S.update(a.id,r);e.run('report-v2.js');let cards=extractCards(e.nodes.app.innerHTML);assert.equal(cards['已記錄總桿'],'6');assert.equal(cards['GIR推估 · 1/2'],'50%');e.run('analysis-v2.js');cards=extractCards(e.nodes.app.innerHTML);assert.equal(cards['總桿'],'6');assert.match(e.nodes.app.innerHTML,/<b>100<\/b>攻果嶺/);assert.match(e.nodes.app.innerHTML,/3–7m/);assert.doesNotMatch(e.nodes.app.innerHTML,/3–7y/);
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
test('Bogey Base maps official 3/4/5 to 4/5/6 without changing stored Pars',()=>{
 const r=C.create(meta({scoringMode:'bogey',pars:[3,4,5,...Array(15).fill(4)]})),before=JSON.stringify(r);
 assert.deepEqual(r.roundSlots.slice(0,3).map(s=>C.scoringPar(s.par,C.scoringMode(r))),[4,5,6]);
 assert.deepEqual(r.roundSlots.slice(0,3).map(s=>s.par),[3,4,5]);C.stats(r);C.stats(r,'standard');assert.equal(JSON.stringify(r),before);
 assert.equal(C.scoringMode(legacy()),'standard');assert.equal(C.scoringPar(null,'bogey'),null);
});
test('a 90-stroke round is E against beginner 90 and +18 against official 72',()=>{
 const r=C.create(meta({scoringMode:'bogey',pars:Array.from({length:18},(_,i)=>3+i%3)}));
 r.roundSlots.forEach((s,i)=>fill(r,i,[...Array(s.par-1).fill({club:'9I'}),{club:'PT'},{club:'PT'}],s.par));
 const novice=C.stats(r),standard=C.stats(r,'standard');assert.equal(novice.targetPar,90);assert.equal(standard.targetPar,72);assert.equal(novice.score,90);assert.equal(standard.score,90);assert.equal(novice.relative,0);assert.equal(standard.relative,18);assert.equal(novice.gir,18);assert.equal(standard.gir,0);assert.equal(novice.halves[0].targetPar,45);
});
test('non-Par72 and incomplete courses use actual known Par, never a fabricated 90',()=>{
 const r=C.create(meta({scoringMode:'bogey',pars:[3,3,...Array(16).fill(4)]}));assert.equal(C.stats(r).targetPar,88);
 r.roundSlots[2].par=null;assert.equal(C.stats(r).targetPar,null);assert.equal(C.stats(r).knownParCount,17);
 fill(r,0,Array(4).fill({club:'PT'}),3);fill(r,2,Array(7).fill({club:'PT'}),null);assert.equal(C.stats(r).relative,0);assert.equal(C.stats(r).relativeN,1);assert.equal(C.stats(r).score,11);
});
test('Bogey Base survives backup/import and finish while original Par stays intact',()=>{
 const e=env(),a=e.S.create(meta({scoringMode:'bogey'})),r=fill(a.round,0,Array(5).fill({club:'PT'}));e.S.update(a.id,r);e.S.finish(a.id,r);const b=e.S.backup(),other=env();other.S.applyImport(b,other.S.previewImport(b));const saved=other.S.entries()[0].round;assert.equal(saved.scoringMode,'bogey');assert.equal(saved.roundSlots[0].par,4);assert.equal(C.stats(saved).relative,0);assert.equal(C.stats(saved,'standard').relative,1);
});
test('overview and analysis default to round mode; comparison changes no storage',()=>{
 const e=env(),a=e.S.create(meta({scoringMode:'bogey'})),r=fill(a.round,0,[{club:'1W'},{club:'9I'},{club:'58°'},{club:'PT'},{club:'PT'}]);e.S.update(a.id,r);const before=e.localStorage.getItem(e.S.KEY);
 e.run('report-v2.js');assert.equal(extractCards(e.nodes.app.innerHTML)['相對新手Par · 1洞'],'E');assert.match(e.nodes.app.innerHTML,/本場新手 Par <strong>90/);e.run('analysis-v2.js');assert.match(e.nodes.app.innerHTML,/<b>100<\/b>攻果嶺/);assert.match(e.nodes.app.innerHTML,/並非正式GIR/);
 e.context.location.search='?basis=standard';e.run('report-v2.js');assert.equal(extractCards(e.nodes.app.innerHTML)['相對Par · 1洞'],'+1');e.run('analysis-v2.js');assert.match(e.nodes.app.innerHTML,/<b>100<\/b>攻果嶺/);assert.equal(e.localStorage.getItem(e.S.KEY),before);
 e.S.finish(a.id,r);e.document.body.dataset.mode='history';e.context.location.search='?basis=bogey';e.run('report-v2.js');assert.equal(extractCards(e.nodes.app.innerHTML)['相對新手Par · 1洞'],'E');e.run('analysis-v2.js');assert.match(e.nodes.app.innerHTML,/<b>100<\/b>攻果嶺/);
});
test('recording and caddie use beginner Par; navigation and save retain official Par',()=>{
 const e=env(),a=e.S.create(meta({scoringMode:'bogey'}));for(const f of ['round-v2.js','round-actions.js','caddies.js'])e.run(f);
 vm.runInContext('initRound();shots=Array(5).fill({club:"PT"});save();render();showCaddie(()=>{});',e.context);
 assert.match(e.nodes.app.innerHTML,/新手 Par 5/);assert.equal(vm.runInContext('rel()',e.context),'E');assert.match(e.document.body.children.at(-1).innerHTML,/class="rinTitle">PAR</);assert.match(e.document.body.children.at(-1).innerHTML,/BOGEY BASE/);assert.equal(e.S.active().round.roundSlots[0].par,4);
});
test('beginner Par3 is not misclassified as an original Par4 driving hole',()=>{
 const e=env(),a=e.S.create(meta({scoringMode:'bogey',pars:Array(18).fill(3)})),r=fill(a.round,0,[{club:'7I'},{club:'58°'},{club:'PT'},{club:'PT'}],3);e.S.update(a.id,r);e.run('analysis-v2.js');assert.match(e.nodes.app.innerHTML,/<b>—<\/b>開球/);assert.match(e.nodes.app.innerHTML,/<b>100<\/b>攻果嶺/);
});
test('new-round UI writes the selected Bogey Base mode and computes selected course target',()=>{
 const e=env();e.context.ARHORNGOR_COURSES=[{name:'Test',holes:18,pars:Array(18).fill(4)}];e.document.querySelector=()=>({value:'bogey'});e.run('app.js');e.run('new-round-v2.js');vm.runInContext('showStart(ARHORNGOR_COURSES[0]);',e.context);assert.match(e.nodes.app.innerHTML,/Bogey Base · 新手模式/);assert.match(e.nodes.bogeyGoal.textContent,/90/);vm.runInContext('beginRound()',e.context);assert.equal(e.S.active().round.scoringMode,'bogey');assert.equal(C.stats(e.S.active().round).targetPar,90);
});
test('invalid mode rejected; comparison switch only updates URL and links retain basis',()=>{
 const e=env();const r=C.create(meta());r.scoringMode='unexpected';assert.throws(()=>C.validateRound(r));const buttons=[{dataset:{basis:'bogey'}}];e.document.querySelectorAll=()=>buttons;e.context.RoundView.bind();buttons[0].onclick();assert.equal(e.context.location.search,'?basis=bogey');assert.match(e.context.RoundView.url('analysis.html','bogey'),/basis=bogey/);assert.equal(e.localStorage.length,0);
});
test('Miramar scorecard route preserves West/South labels, both start orders and 72/90 targets',()=>{
 const e=env();e.run('courses.js');const course=e.context.ARHORNGOR_COURSES.find(c=>c.name==='美麗華（西／南）');
 assert.deepEqual(Array.from(course.pars),[4,4,5,4,3,4,4,3,5,4,3,5,4,4,3,4,4,5]);
 assert.equal(course.pars.slice(0,9).reduce((a,b)=>a+b),36);assert.equal(course.pars.slice(9).reduce((a,b)=>a+b),36);
 for(const startHole of [1,10]){
  const r=C.create({course:course.name,courseHoles:course.holes,sections:course.sections,pars:course.pars,startHole,scoringMode:'bogey'});
  assert.equal(C.stats(r).targetPar,90);assert.equal(C.stats(r,'standard').targetPar,72);
  assert.equal(C.holeLabel(r,r.roundSlots[0].courseHoleId),startHole===1?'西區 第1洞':'南區 第1洞');
  assert.equal(C.holeLabel(r,r.roundSlots[9].courseHoleId),startHole===1?'南區 第1洞':'西區 第1洞');
 }
 e.run('app.js');e.run('new-round-v2.js');vm.runInContext("showStart(ARHORNGOR_COURSES.find(c=>c.name==='美麗華（西／南）'))",e.context);assert.match(e.nodes.app.innerHTML,/西區 第1洞/);assert.match(e.nodes.app.innerHTML,/南區 第1洞/);assert.match(e.nodes.bogeyGoal.textContent,/90/);
});


test('multi-section start requires both choices and changing front nine preserves back nine',()=>{
 const e=env();e.run('courses.js');e.run('app.js');e.run('new-round-v2.js');
 vm.runInContext("showStart(ARHORNGOR_COURSES.find(c=>c.name==='美麗華（官方四區）'))",e.context);
 assert.equal(e.nodes.begin.disabled,true);const before=e.localStorage.dump();vm.runInContext('beginRound()',e.context);assert.deepEqual(e.localStorage.dump(),before);
 e.nodes.firstSection.value='1';e.nodes.firstSection.onchange();assert.equal(e.nodes.begin.disabled,true);
 e.nodes.secondSection.value='0';e.nodes.secondSection.onchange();assert.equal(e.nodes.begin.disabled,false);assert.match(e.nodes.routePreview.textContent,/東區 → 北區/);
 e.nodes.firstSection.value='3';e.nodes.firstSection.onchange();assert.equal(e.nodes.secondSection.value,'0');assert.match(e.nodes.routePreview.textContent,/西區 → 北區/);
});

test('East then North advances from ninth to North first and survives reload in both modes',()=>{
 for(const mode of ['standard','bogey']){
  const e=env();e.run('courses.js');e.document.querySelector=()=>({value:mode});e.run('app.js');e.run('new-round-v2.js');
  vm.runInContext("showStart(ARHORNGOR_COURSES.find(c=>c.name==='美麗華（官方四區）'))",e.context);
  e.nodes.firstSection.value='1';e.nodes.secondSection.value='0';e.nodes.firstSection.onchange();vm.runInContext('beginRound()',e.context);
  for(const f of ['round-v2.js','round-actions.js','caddies.js'])e.run(f);
  vm.runInContext('showCaddie=done=>done();initRound();',e.context);
  for(let i=0;i<9;i++)vm.runInContext('addClub("1W");finishHole()',e.context);
  const r=e.S.active().round;assert.equal(r.currentSlotId,'slot-10');assert.equal(r.roundSlots[9].courseHoleId,1);assert.equal(r.roundSlots[9].par,4);
  assert.deepEqual(Array.from(r.playSections),[1,0]);assert.match(e.nodes.app.innerHTML,/北區 第1洞/);
  const other=env({},'active',e.localStorage);for(const f of ['round-v2.js','round-actions.js','caddies.js'])other.run(f);vm.runInContext('initRound()',other.context);
  assert.match(other.nodes.app.innerHTML,/北區 第1洞/);assert.equal(other.S.active().round.roundSlots.filter(s=>s.status==='completed').length,9);
 }
});

test('pre-putt distribution counts only first PT per completed slot and preserves stored data',()=>{
 const e=env(),a=e.S.create(meta());const r=a.round;
 const shots=(club,extra={})=>[{club,...extra},{club:'PT',putt:'10y'},{club:'PT',putt:'OK'}];
 fill(r,0,shots('PW'));fill(r,1,shots('9I'));fill(r,2,shots('4H'));
 fill(r,3,[{club:'58°',distance:30},{club:'58°',distance:20,bunker:true},{club:'PT',putt:'3y'},{club:'PT',putt:'OK'}]);
 fill(r,4,[{club:'PT',putt:'<3m'}]);
 fill(r,5,[{club:'1W'},{club:'罰',penalty:'OB 前方補球'},{club:'PT',putt:'7m+'}]);
 fill(r,6,shots('PW'),4,'in_progress');
 fill(r,9,shots('PW'));r.roundSlots[9].courseHoleId=r.roundSlots[0].courseHoleId;
 e.S.update(a.id,r);const before=e.localStorage.dump();e.run('analysis-v2.js');
 const d=vm.runInContext('prePuttDistribution(RoundStore.active().round)',e.context);
 assert.equal(d.eligible,7);assert.equal(d.attributed,5);assert.equal(d.unattributed,2);
 assert.equal(d.rows.find(x=>x.club==='PW').count,2);assert.equal(d.rows.find(x=>x.club==='58°').count,1);
 assert.equal(d.rows.find(x=>x.club==='58°').distances.get('20y'),1);assert.equal(d.rows.find(x=>x.club==='58°').firstPutts.get('3y'),1);
 assert.match(e.nodes.app.innerHTML,/進入推桿前一桿/);assert.match(e.nodes.app.innerHTML,/並非各球桿成功率/);
 assert.match(e.nodes.app.innerHTML,/0% \(0\/1\)/); // The first 58-degree attempt still fails the existing direct-to-PT metric.
 assert.deepEqual(e.localStorage.dump(),before);
 e.context.location.search='?basis=bogey';e.run('analysis-v2.js');assert.equal(vm.runInContext('prePuttDistribution(RoundStore.active().round).attributed',e.context),5);
 e.S.finish(a.id,r);e.document.body.dataset.mode='history';e.run('analysis-v2.js');assert.match(e.nodes.app.innerHTML,/進入推桿前一桿/);
});

test('pre-putt distribution empty state and imported labels are safe',()=>{
 const e=env(),a=e.S.create(meta());e.run('analysis-v2.js');assert.match(e.nodes.app.innerHTML,/尚無可統計的前一桿紀錄/);
 const r=fill(a.round,0,[{club:'<img src=x>'},{club:'PT',putt:'<3m'}]);e.S.update(a.id,r);e.run('analysis-v2.js');
 assert.doesNotMatch(e.nodes.app.innerHTML,/<img src=x>/);assert.match(e.nodes.app.innerHTML,/&lt;3m × 1/);
});

test('five-axis v2 separates tasks, counts E5, and never rewrites legacy history',()=>{
 const e=env(),a=e.S.create(meta());const r=a.round,PT={club:'PT',putt:'5y'};
 fill(r,0,[{club:'1W',trouble:false},{club:'9I'},PT,PT]);
 fill(r,1,[{club:'1W',trouble:true},{club:'罰',penalty:'OB 前方補球'},{club:'PW',distance:50},PT,PT,PT]);
 fill(r,2,[{club:'1W'},{club:'58°',distance:30,bunker:true},{club:'58°',distance:10},PT]);
 fill(r,3,[{club:'1W',trouble:true},{club:'4H'},PT,PT]);
 fill(r,4,[{club:'1W',trouble:false},{club:'PW',distance:70},PT],4,'in_progress');
 e.S.update(a.id,r);const before=e.localStorage.dump();e.run('analysis-v2.js');
 const a2=e.context.fiveAbility(r);
 for(const [key,expected] of Object.entries({drive:[100,3],approach:[300,4],short:[200,2],rescue:[0,1],putt:[300,4]}))assert.deepEqual([a2[key].sum,a2[key].n],expected,key);
 assert.match(e.nodes.app.innerHTML,/125碼以上〔依球桿推定〕/);
 assert.match(e.nodes.app.innerHTML,/50碼<\/td><td>1\/1（100%）/);
 assert.match(e.nodes.app.innerHTML,/short|短切/);
 e.context.location.search='?basis=bogey';e.run('analysis-v2.js');
 assert.deepEqual(JSON.parse(JSON.stringify(e.context.fiveAbility(r))),JSON.parse(JSON.stringify(a2)));
 assert.deepEqual(e.localStorage.dump(),before);
 e.S.finish(a.id,r);e.document.body.dataset.mode='history';const finished=e.localStorage.dump();e.run('analysis-v2.js');assert.deepEqual(e.localStorage.dump(),finished);
});

test('five-axis missing observations remain unknown and sand is excluded from short chips',()=>{
 const e=env();e.run('analysis-v2.js');const r=C.create(meta());
 fill(r,0,[{club:'PT'}]);fill(r,1,[{club:'1W'},{club:'58°',distance:20,bunker:true},{club:'PT'}]);
 fill(r,2,[{club:'1W'},{club:'PW',distance:50}],4,'in_progress');
 const a=e.context.fiveAbility(r);assert.equal(a.drive.n,0);assert.equal(a.short.n,0);assert.equal(a.rescue.sum,100);assert.equal(a.rescue.n,1);assert.equal(a.putt.n,1);assert.equal(a.approach.n,1);
});

test('PW distance input and skip work without adding steps for 9I and woods',()=>{
 const e=env();e.S.create(meta());for(const f of ['round-v2.js','round-actions.js','caddies.js'])e.run(f);
 vm.runInContext('initRound();addClub("9I")',e.context);assert.equal(e.S.active().round.roundSlots[0].shots[0].trouble,false);
 vm.runInContext('showShotPenalty(0)',e.context);assert.match(e.nodes.modalBody.innerHTML,/data-trouble/);
 vm.runInContext('addClub("PW")',e.context);assert.match(e.nodes.modalBody.innerHTML,/出手前距離/);assert.match(e.nodes.modalBody.innerHTML,/120/);
 e.nodes.skipDistance.onclick();assert.equal(e.S.active().round.roundSlots[0].shots[1].club,'PW');assert.equal(e.S.active().round.roundSlots[0].shots[1].distance,undefined);
 vm.runInContext('addClub("PW")',e.context);
 e.document.querySelectorAll=selector=>selector==='[data-d]'?[{dataset:{d:'100'}}]:[];
 const button={dataset:{d:'100'}};e.document.querySelectorAll=selector=>selector==='[data-d]'?[button]:[];
 vm.runInContext('showWedgeDistance("PW")',e.context);button.onclick();
 assert.equal(e.S.active().round.roundSlots[0].shots[2].distance,100);
 vm.runInContext('addClub("3W")',e.context);assert.equal(e.S.active().round.roundSlots[0].shots.length,4);
});
