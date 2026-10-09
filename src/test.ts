import assert from 'node:assert';
import {run,seed,streak,stats,ymd,addDays,CAP,DB,active} from './logic';
const empty:DB={patients:[],temps:[],visits:[]};const T=ymd();
const ok=(r:{db:DB;err?:string})=>{assert.ok(!r.err,r.err);return r.db};
let db=empty;
for(let i=0;i<CAP;i++)db=ok(run(db,'admin','A',{t:'admit',name:'Patient '+i,age:30,gender:'Male'}));
assert.equal(active(db).length,74);
assert.match(run(db,'admin','A',{t:'admit',name:'Over Cap',age:30,gender:'Male'}).err||'', /capacity/);
assert.ok(run(db,'nurse','N',{t:'admit',name:'Nope Role',age:30,gender:'Male'}).err,'nurse cannot admit');
assert.ok(run(db,'admin','A',{t:'temp',id:'P1',date:T,temp:37}).err,'admin cannot record temps');
assert.ok(run(empty,'admin','A',{t:'admit',name:'X',age:30,gender:'Male'}).err,'short name rejected');
assert.ok(run(empty,'admin','A',{t:'admit',name:'Xavier',age:-1,gender:'Male'}).err,'bad age rejected');
// temps
db=ok(run(empty,'admin','A',{t:'admit',name:'Test One',age:40,gender:'Female'}));
db={...db,patients:db.patients.map(p=>({...p,admitted:addDays(T,-5)}))};
const rec=(d:string,t:number)=>{db=ok(run(db,'nurse','N',{t:'temp',id:'P1',date:d,temp:t}))};
rec(addDays(T,-2),37.0);rec(addDays(T,-1),37.2);
assert.match(run(db,'nurse','N',{t:'temp',id:'P1',date:T,temp:50}).err||'', /between 34/);
assert.match(run(db,'nurse','N',{t:'temp',id:'P1',date:addDays(T,-1),temp:36.5}).err||'', /already exists/);
assert.ok(run(db,'nurse','N',{t:'temp',id:'P1',date:addDays(T,1),temp:36.5}).err,'future date rejected');
assert.equal(streak(db,'P1'),2);
assert.ok(run(db,'doctor','D',{t:'rec',id:'P1'}).err,'cannot recommend with 2 days');
rec(T,36.9);assert.equal(streak(db,'P1'),3);
// gap + fever break streaks
let g=db;g={...g,temps:g.temps.filter(t=>t.date!==addDays(T,-1))};assert.equal(streak(g,'P1'),1);
rec(addDays(T,-3),38.4);assert.equal(streak(db,'P1'),3);
assert.ok(run(db,'admin','A',{t:'close',id:'P1',outcome:'recovered'}).err,'needs recommendation');
db=ok(run(db,'doctor','D',{t:'rec',id:'P1'}));
db=ok(run(db,'doctor','D',{t:'visit',id:'P1',notes:'Looks well'}));
assert.match(run(db,'doctor','D',{t:'visit',id:'P1',notes:'Again today'}).err||'', /already/);
db=ok(run(db,'admin','A',{t:'close',id:'P1',outcome:'recovered'}));
assert.equal(stats(db).r,1);
// mortality
let m=seed();const s0=stats(m);assert.ok(s0.mort<0.15,'seed under alert');
let k=0;while(stats(m).mort<=0.15){const p=active(m)[0];m=ok(run(m,'admin','A',{t:'close',id:p.id,outcome:'deceased'}));k++}
assert.ok(stats(m).mort>0.15);console.log('all tests passed; seed mortality',(s0.mort*100).toFixed(1)+'%, alert after',k,'more deaths; seed active',active(seed()).length);
