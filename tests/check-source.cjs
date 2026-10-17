const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');let count=0;
for(const name of fs.readdirSync(root)){
 const file=path.join(root,name);
 if(name.endsWith('.js')){cp.execFileSync(process.execPath,['--check',file]);count++;}
 if(!name.endsWith('.html'))continue;
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())cp.execFileSync(process.execPath,['--check'],{input:match[1]});
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const ref=match[1].split(/[?#]/)[0];if(!ref||/^(?:https?:|data:|javascript:)/.test(ref)||ref.includes('${'))continue;
  assert.ok(fs.existsSync(path.resolve(root,ref)),`${name}: missing ${ref}`);
 }
}
for(const name of ['round.html','summary.html','history-round.html','analysis.html','history-analysis.html','history.html','new-round.html','index.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');assert.ok(html.includes('round-core.js?v=21'),name);assert.ok(html.includes('round-store.js?v=21'),name);
}
assert.ok(!fs.readFileSync(path.join(root,'round.html'),'utf8').includes('round-v8.js'));
console.log(`${count} JavaScript files parsed; inline scripts, local references and V2 entry points checked.`);
