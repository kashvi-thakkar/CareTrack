export type Role='nurse'|'doctor'|'admin';
export type Patient={id:string;name:string;age:number;gender:string;room:number;admitted:string;status:'admitted'|'recovered'|'deceased';closed?:string;recommended?:boolean};
export type Temp={patientId:string;date:string;temp:number;by:string};
export type Visit={id:string;patientId:string;date:string;by:string;notes:string};
export type DB={patients:Patient[];temps:Temp[];visits:Visit[]};
export type Act={t:'admit';name:string;age:number;gender:string}|{t:'temp';id:string;date:string;temp:number}|{t:'visit';id:string;notes:string}|{t:'rec';id:string}|{t:'close';id:string;outcome:'recovered'|'deceased'}|{t:'reset'};
export const CAP=74,FEVER=38,KEY='caretrack-v1',ALERT=0.15;
export const ymd=(d=new Date())=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
export const addDays=(s:string,n:number)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const PERM:Record<Role,string[]>={nurse:['temp'],doctor:['visit','recommend'],admin:['admit','discharge','reset']};
export const can=(r:Role,a:string)=>PERM[r].includes(a);
export const active=(db:DB)=>db.patients.filter(p=>p.status==='admitted');
/** Consecutive fever-free days with an actual reading, counted back from today (or yesterday if today's reading is pending). */
export const streak=(db:DB,id:string,today=ymd())=>{
  const t=new Map(db.temps.filter(x=>x.patientId===id).map(x=>[x.date,x.temp] as [string,number]));
  let d=t.has(today)?today:addDays(today,-1),n=0;
  while(t.has(d)&&(t.get(d) as number)<FEVER){n++;d=addDays(d,-1)}
  return n;
};
export const stats=(db:DB)=>{const n=db.patients.length,r=db.patients.filter(p=>p.status==='recovered').length,d=db.patients.filter(p=>p.status==='deceased').length;
  return{n,r,d,occ:n-r-d,rec:n?r/n:0,mort:n?d/n:0}};
const NEED:Record<Act['t'],string>={admit:'admit',temp:'temp',visit:'visit',rec:'recommend',close:'discharge',reset:'reset'};
export function run(db:DB,role:Role,user:string,a:Act):{db:DB;err?:string}{
  const e=(err:string)=>({db,err});
  if(!can(role,NEED[a.t]))return e('Your role is not permitted to do this.');
  const today=ymd();
  if(a.t==='reset')return{db:seed()};
  if(a.t==='admit'){
    const name=a.name.trim();
    if(name.length<2||name.length>60)return e('Name must be 2–60 characters.');
    if(!Number.isInteger(a.age)||a.age<0||a.age>120)return e('Age must be a whole number from 0 to 120.');
    if(!['Female','Male','Other'].includes(a.gender))return e('Select a gender.');
    const used=new Set(active(db).map(p=>p.room));
    if(used.size>=CAP)return e(`Facility is at capacity (${CAP}/${CAP}). Discharge a patient first.`);
    let room=1;while(used.has(room))room++;
    const id='P'+(Math.max(0,...db.patients.map(p=>+p.id.slice(1)))+1);
    return{db:{...db,patients:[...db.patients,{id,name,age:a.age,gender:a.gender,room,admitted:today,status:'admitted'}]}};
  }
  const p=db.patients.find(x=>x.id===a.id);
  if(!p||p.status!=='admitted')return e('Select an admitted patient.');
  if(a.t==='temp'){
    if(!Number.isFinite(a.temp)||a.temp<34||a.temp>42)return e('Temperature must be between 34.0 and 42.0 °C.');
    if(!/^\d{4}-\d\d-\d\d$/.test(a.date)||a.date>today||a.date<p.admitted)return e('Date must be between the admission date and today.');
    if(db.temps.some(x=>x.patientId===p.id&&x.date===a.date))return e(`A reading for ${p.name} on ${a.date} already exists.`);
    return{db:{...db,temps:[...db.temps,{patientId:p.id,date:a.date,temp:Math.round(a.temp*10)/10,by:user}]}};
  }
  if(a.t==='visit'){
    const n=a.notes.trim();
    if(n.length<3||n.length>500)return e('Visit notes must be 3–500 characters.');
    if(db.visits.some(v=>v.patientId===p.id&&v.date===today))return e(`${p.name} has already been visited today.`);
    return{db:{...db,visits:[...db.visits,{id:'V'+(db.visits.length+1)+Date.now(),patientId:p.id,date:today,by:user,notes:n}]}};
  }
  const s=streak(db,p.id);
  if(a.t==='rec'){
    if(s<3)return e(`Needs 3 consecutive fever-free recorded days (currently ${s}).`);
    if(p.recommended)return e('Discharge already recommended.');
    return{db:{...db,patients:db.patients.map(x=>x===p?{...x,recommended:true}:x)}};
  }
  if(a.outcome==='recovered'&&(s<3||!p.recommended))return e('Recovery discharge needs a doctor recommendation and 3 consecutive fever-free recorded days.');
  return{db:{...db,patients:db.patients.map(x=>x===p?{...x,status:a.outcome,closed:today}:x)}};
}
export function seed():DB{
  let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const F=['Aarav','Diya','Rohan','Meera','Kabir','Ananya','Vihaan','Isha','Arjun','Sana'],L=['Shah','Patil','Iyer','Khan','Rao','Joshi'];
  const today=ymd(),patients:Patient[]=[],temps:Temp[]=[],visits:Visit[]=[];let room=1;
  for(let i=0;i<30;i++){
    const status:Patient['status']=i<9?'recovered':i<12?'deceased':'admitted';
    const ago=status==='admitted'?3+(i%7):8+(i%4),closed=addDays(today,-1);
    const id='P'+(i+1),adm=addDays(today,-ago);
    patients.push({id,name:`${F[i%10]} ${L[(i*5+Math.floor(i/10))%6]}`,age:18+Math.floor(rnd()*60),gender:['Female','Male','Other'][i%3===2?(i%2?2:0):i%2],room:status==='admitted'?room++:0,admitted:adm,status,closed:status==='admitted'?undefined:closed,recommended:status==='recovered'||(status==='admitted'&&i%6===0)});
    for(let k=0;k<=ago;k++){
      const d=addDays(adm,k);
      if(status!=='admitted'&&d>closed)continue;
      if(status==='admitted'&&((d===today&&i%2===0)||(i%5===0&&d===addDays(today,-2))))continue;
      const fever=status==='deceased'||k<(status==='recovered'?2:i%3);
      temps.push({patientId:id,date:d,temp:Math.round((fever?38.2+rnd()*1.3:36.6+rnd()*0.6)*10)/10,by:'Nurse Priya'});
    }
    if(status==='admitted'){visits.push({id:'V'+i+'a',patientId:id,date:addDays(today,-1),by:'Dr. Mehta',notes:'Routine review. Monitoring continues.'});
      if(i%3===1)visits.push({id:'V'+i+'b',patientId:id,date:today,by:'Dr. Mehta',notes:'Stable, vitals reviewed.'})}
  }
  return{patients,temps,visits};
}
