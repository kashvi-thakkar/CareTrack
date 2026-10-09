import {useEffect,useState} from 'react';
import {DB,Role,Act,CAP,ALERT,KEY,ymd,active,streak,run,seed,stats} from './logic';
const ls={get:(k:string)=>{try{return localStorage.getItem(k)}catch{return null}},set:(k:string,v:string|null)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch{}}};
const load=():DB=>{try{const s=ls.get(KEY);if(s){const d=JSON.parse(s);if(d&&d.patients&&d.temps&&d.visits)return d}}catch{}return seed()};
type Me={role:Role;name:string};type G=(a:Act,ok?:string)=>boolean;type P={db:DB;go:G;me:Me};
const TABS:Record<Role,string[]>={nurse:['Record temperatures'],doctor:['Patients & visits'],admin:['Overview','Admissions','Rooms','Discharges']};
const DEF:Record<Role,string>={nurse:'Nurse Priya',doctor:'Dr. Mehta',admin:'Admin Rao'};
const pct=(x:number)=>(x*100).toFixed(1)+'%';

export default function App(){
  const [db,setDb]=useState<DB>(load);
  const [me,setMe]=useState<Me|null>(()=>{try{return JSON.parse(ls.get('ct-me')||'null')}catch{return null}});
  const [tab,setTab]=useState(0);const [msg,setMsg]=useState<{ok:boolean;t:string}|null>(null);
  useEffect(()=>{ls.set(KEY,JSON.stringify(db))},[db]);
  useEffect(()=>{ls.set('ct-me',me?JSON.stringify(me):null)},[me]);
  useEffect(()=>{if(msg){const t=setTimeout(()=>setMsg(null),4000);return()=>clearTimeout(t)}},[msg]);
  const go:G=(a,ok='Saved')=>{if(!me)return false;const r=run(db,me.role,me.name,a);if(r.err){setMsg({ok:false,t:r.err});return false}setDb(r.db);setMsg({ok:true,t:ok});return true};
  if(!me)return <Login onLogin={m=>{setMe(m);setTab(0)}}/>;
  const p:P={db,go,me};const st=stats(db);
  return <>
    <header><h1>🏥 CareTrack</h1><div className="row"><span className="badge">{me.role}</span><span>{me.name}</span><span className="mu">{st.occ}/{CAP} beds</span><button className="sec" onClick={()=>setMe(null)}>Switch role</button></div></header>
    <main>
      {msg&&<div className={'toast'+(msg.ok?'':' err')} role="status">{msg.t}</div>}
      {st.mort>ALERT&&<div className="alert" role="alert">⚠ Mortality rate is {pct(st.mort)}, above the {ALERT*100}% threshold ({st.d} of {st.n} admitted patients).</div>}
      <nav>{TABS[me.role].map((t,i)=><button key={t} className={i===tab?'on':''} onClick={()=>setTab(i)}>{t}</button>)}</nav>
      {me.role==='nurse'&&<Nurse {...p}/>}
      {me.role==='doctor'&&<Doctor {...p}/>}
      {me.role==='admin'&&[<Overview key={0} {...p}/>,<Admissions key={1} {...p}/>,<Rooms key={2} {...p}/>,<Discharges key={3} {...p}/>][tab]}
    </main></>;
}
function Login({onLogin}:{onLogin:(m:Me)=>void}){
  const [role,setRole]=useState<Role>('nurse');const [name,setName]=useState(DEF.nurse);
  const info:Record<Role,string>={nurse:'Record daily patient temperatures',doctor:'Review history, record visits, recommend discharge',admin:'Admissions, rooms, discharges, analytics'};
  return <main style={{maxWidth:640,marginTop:40}}><div className="card"><h1>🏥 CareTrack</h1><p className="mu">Quarantine facility patient monitoring · demo with synthetic data</p>
    <div className="roles">{(['nurse','doctor','admin'] as Role[]).map(r=><button key={r} className={r===role?'on':''} onClick={()=>{setRole(r);setName(DEF[r])}}><b style={{textTransform:'capitalize'}}>{r}</b><br/><span className="mu">{info[r]}</span></button>)}</div>
    <div className="row" style={{marginTop:14}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" aria-label="Your name"/><button disabled={name.trim().length<2} onClick={()=>onLogin({role,name:name.trim()})}>Sign in</button></div></div></main>;
}
function Nurse({db,go}:P){
  const act=active(db),today=ymd();const [id,setId]=useState(''),[date,setDate]=useState(today),[t,setT]=useState('');
  const done=new Set(db.temps.filter(x=>x.date===today).map(x=>x.patientId));const pending=act.filter(x=>!done.has(x.id));
  return <><div className="card"><h2>Record temperature</h2><div className="row">
    <select value={id} onChange={e=>setId(e.target.value)} aria-label="Patient"><option value="">Select patient</option>{act.map(x=><option key={x.id} value={x.id}>Room {x.room} – {x.name}</option>)}</select>
    <input type="date" max={today} value={date} onChange={e=>setDate(e.target.value)} aria-label="Date"/>
    <input type="number" step="0.1" min="34" max="42" placeholder="°C" value={t} onChange={e=>setT(e.target.value)} aria-label="Temperature in Celsius" style={{width:90}}/>
    <button onClick={()=>{if(go({t:'temp',id,date,temp:parseFloat(t)},'Temperature recorded'))setT('')}}>Save reading</button></div>
    <p className="mu">Fever is 38.0 °C or higher. One reading per patient per day.</p></div>
  <div className="card"><h2>Pending today ({pending.length} of {act.length})</h2>{pending.length?pending.map(x=><button key={x.id} className="chip sec" onClick={()=>{setId(x.id);setDate(today)}}>Rm {x.room} · {x.name}</button>):<span className="badge ok">All readings recorded for today</span>}</div>
  <div className="card"><h2>Today's readings</h2><div className="tw"><table><thead><tr><th>Room</th><th>Patient</th><th>°C</th><th>By</th></tr></thead><tbody>{db.temps.filter(x=>x.date===today).map(x=>{const q=db.patients.find(y=>y.id===x.patientId);return q&&q.status==='admitted'?<tr key={x.patientId}><td>{q.room}</td><td>{q.name}</td><td><span className={'badge '+(x.temp>=38?'bad':'ok')}>{x.temp.toFixed(1)}</span></td><td>{x.by}</td></tr>:null})}</tbody></table></div></div></>;
}
function Doctor({db,go}:P){
  const act=active(db),today=ymd();const [sel,setSel]=useState(''),[notes,setNotes]=useState('');
  const vis=new Set(db.visits.filter(v=>v.date===today).map(v=>v.patientId));const p=act.find(x=>x.id===sel);
  const tt=(id:string)=>db.temps.find(x=>x.patientId===id&&x.date===today)?.temp;
  return <><div className="card"><h2>Active patients · visited today {act.filter(x=>vis.has(x.id)).length}/{act.length}</h2><div className="tw"><table><thead><tr><th>Room</th><th>Patient</th><th>Today °C</th><th>Fever-free days</th><th>Visited</th><th>Discharge</th></tr></thead><tbody>
    {act.map(x=>{const s=streak(db,x.id),v=tt(x.id);return <tr key={x.id} className={'cl'+(x.id===sel?' sel':'')} onClick={()=>setSel(x.id)}><td>{x.room}</td><td>{x.name}</td><td>{v===undefined?'—':v.toFixed(1)}</td><td>{s}/3</td><td>{vis.has(x.id)?<span className="badge ok">Yes</span>:<span className="badge wa">Due</span>}</td><td>{x.recommended?<span className="badge ok">Recommended</span>:s>=3?<span className="badge wa">Eligible</span>:'—'}</td></tr>})}</tbody></table></div></div>
  {p?<div className="card"><h2>{p.name} · Room {p.room} · {p.age}y · {p.gender}</h2><p className="mu">Admitted {p.admitted} · {streak(db,p.id)}/3 consecutive fever-free recorded days</p>
    <div className="row"><button disabled={streak(db,p.id)<3||!!p.recommended} onClick={()=>go({t:'rec',id:p.id},'Discharge recommended')}>{p.recommended?'Discharge recommended':'Recommend discharge'}</button></div>
    <h2 style={{marginTop:14}}>Record visit (today)</h2><textarea rows={3} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Visit notes"/>
    <button disabled={vis.has(p.id)} onClick={()=>{if(go({t:'visit',id:p.id,notes},'Visit recorded'))setNotes('')}}>{vis.has(p.id)?'Visited today':'Save visit'}</button>
    <div className="grid" style={{marginTop:14,alignItems:'start'}}><div className="tw"><h2>Temperature history</h2><table><tbody>{db.temps.filter(x=>x.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date)).map(x=><tr key={x.date}><td>{x.date}</td><td><span className={'badge '+(x.temp>=38?'bad':'ok')}>{x.temp.toFixed(1)} °C</span></td></tr>)}</tbody></table></div>
    <div className="tw"><h2>Visits</h2><table><tbody>{db.visits.filter(v=>v.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date)).map(v=><tr key={v.id}><td>{v.date}</td><td style={{whiteSpace:'normal'}}>{v.notes} <span className="mu">— {v.by}</span></td></tr>)}</tbody></table></div></div></div>:<p className="mu">Select a patient to view history, record a visit, or recommend discharge.</p>}</>;
}
function Overview({db,go}:P){
  const s=stats(db),act=active(db),today=ymd();const visited=act.filter(x=>db.visits.some(v=>v.patientId===x.id&&v.date===today)).length;
  const missing=act.filter(x=>!db.temps.some(t=>t.patientId===x.id&&t.date===today)).length;
  const S=(l:string,v:string|number)=><div className="card stat"><b>{v}</b><span>{l}</span></div>;
  return <><div className="grid">{S('Occupancy',`${s.occ}/${CAP}`)}{S('Total admitted',s.n)}{S('Recovered',s.r)}{S('Deceased',s.d)}{S('Temps pending today',missing)}{S('Visited today',`${visited}/${act.length}`)}</div>
  <div className="card"><h2>Analytics</h2>{([['Occupancy',s.occ/CAP,''],['Recovery rate',s.rec,''],['Mortality rate',s.mort,'m']] as [string,number,string][]).map(([l,v,c])=><div key={l} style={{marginBottom:10}}><div className="row" style={{justifyContent:'space-between'}}><span>{l}</span><b>{pct(v)}</b></div><div className={'bar '+c}><i style={{width:Math.min(100,v*100)+'%'}}/></div></div>)}
  <p className="mu">Rates are calculated over all patients ever admitted. Mortality above {ALERT*100}% raises an alert.</p><button className="sec" onClick={()=>{if(confirm('Reset all data to the synthetic demo set?'))go({t:'reset'},'Demo data reset')}}>Reset demo data</button></div></>;
}
function Admissions({db,go}:P){
  const [name,setName]=useState(''),[age,setAge]=useState(''),[g,setG]=useState('');const n=active(db).length;
  return <><div className="card"><h2>Admit patient ({n}/{CAP})</h2><div className="row"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" maxLength={60} aria-label="Full name"/>
    <input type="number" value={age} onChange={e=>setAge(e.target.value)} placeholder="Age" min={0} max={120} style={{width:80}} aria-label="Age"/>
    <select value={g} onChange={e=>setG(e.target.value)} aria-label="Gender"><option value="">Gender</option><option>Female</option><option>Male</option><option>Other</option></select>
    <button disabled={n>=CAP} onClick={()=>{if(go({t:'admit',name,age:age===''?NaN:Number(age),gender:g},'Patient admitted')){setName('');setAge('');setG('')}}}>{n>=CAP?'At capacity':'Admit'}</button></div></div>
  <div className="card"><h2>All patients</h2><div className="tw"><table><thead><tr><th>ID</th><th>Name</th><th>Age</th><th>Room</th><th>Admitted</th><th>Status</th></tr></thead><tbody>{[...db.patients].reverse().map(x=><tr key={x.id}><td>{x.id}</td><td>{x.name}</td><td>{x.age}</td><td>{x.status==='admitted'?x.room:'—'}</td><td>{x.admitted}</td><td><span className={'badge '+(x.status==='deceased'?'bad':x.status==='recovered'?'ok':'')}>{x.status}</span></td></tr>)}</tbody></table></div></div></>;
}
function Rooms({db}:P){
  const by=new Map(active(db).map(x=>[x.room,x]));
  return <div className="card"><h2>Rooms · {by.size} occupied, {CAP-by.size} free</h2><div className="rooms">{Array.from({length:CAP},(_,i)=>i+1).map(r=>{const x=by.get(r);return <div key={r} className={'room'+(x?' occ':'')} title={x?x.name:'Vacant'}><b>{r}</b><br/><span className="mu">{x?x.name.split(' ')[0]:'Free'}</span></div>})}</div></div>;
}
function Discharges({db,go}:P){
  const act=active(db);
  return <><div className="card"><h2>Discharge management</h2><p className="mu">Recovery discharge requires a doctor recommendation and 3 consecutive fever-free days with recorded readings.</p><div className="tw"><table><thead><tr><th>Room</th><th>Patient</th><th>Fever-free days</th><th>Doctor</th><th>Actions</th></tr></thead><tbody>
    {act.map(x=>{const s=streak(db,x.id);return <tr key={x.id}><td>{x.room}</td><td>{x.name}</td><td>{s}/3</td><td>{x.recommended?<span className="badge ok">Recommended</span>:'—'}</td><td><div className="row"><button disabled={s<3||!x.recommended} onClick={()=>go({t:'close',id:x.id,outcome:'recovered'},'Patient discharged as recovered')}>Discharge</button><button className="danger" onClick={()=>{if(confirm(`Record death of ${x.name}?`))go({t:'close',id:x.id,outcome:'deceased'},'Mortality recorded')}}>Record death</button></div></td></tr>})}</tbody></table></div></div>
  <div className="card"><h2>Closed cases</h2><div className="tw"><table><tbody>{db.patients.filter(x=>x.status!=='admitted').map(x=><tr key={x.id}><td>{x.name}</td><td><span className={'badge '+(x.status==='deceased'?'bad':'ok')}>{x.status}</span></td><td>{x.closed}</td></tr>)}</tbody></table></div></div></>;
}
