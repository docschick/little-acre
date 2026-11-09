import {addDays,defaultBatch,schedule,plants} from './planner.js';
export const lettuceKeys=['bibb','buttercrunch','lettuce','fourSeasons','dynamite','custom'];
export const cadences={weekly:'Every week',fortnightly:'Every 2 weeks',twiceMonthly:'Twice a month'};
export function localToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function isDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s}
export function validRotation(p){
  return !!(p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=100&&Object.hasOwn(cadences,p.cadence)&&isDate(p.startDate)&&typeof p.paused==='boolean'&&(p.plant===null||lettuceKeys.includes(p.plant))&&Array.isArray(p.monthDays)&&p.monthDays.length===2&&p.monthDays.every(d=>Number.isInteger(d)&&d>=1&&d<=31)&&p.monthDays[0]<p.monthDays[1]&&p.decisions&&typeof p.decisions==='object'&&!Array.isArray(p.decisions)&&Object.entries(p.decisions).every(([date,d])=>isDate(date)&&date>=p.startDate&&d&&['planted','skipped'].includes(d.status)&&(d.status!=='planted'||typeof d.batchId==='string')&&(d.reason==null||(typeof d.reason==='string'&&d.reason.length<=300))));
}
// Always calculate from the original anchor. Skipping or planting late never
// shifts another slot. Month days are clamped and deduplicated in short months.
export function rotationDates(p,until){
  if(until<p.startDate)return [];
  const dates=new Set([p.startDate]);
  if(p.cadence!=='twiceMonthly'){
    const step=p.cadence==='weekly'?7:14;
    for(let d=addDays(p.startDate,step),i=0;d<=until&&i<10000;d=addDays(d,step),i++)dates.add(d);
  }else{
    let month=p.startDate.slice(0,7)+'-01';
    for(let i=0;month<=until&&i<2400;i++){
      const next=addDays(month,32).slice(0,7)+'-01';
      const last=Number(addDays(next,-1).slice(-2));
      for(const day of p.monthDays){const d=month.slice(0,8)+String(Math.min(day,last)).padStart(2,'0');if(d>p.startDate&&d<=until)dates.add(d)}
      month=next;
    }
  }
  return [...dates].sort();
}
export function rotationSlots(p,until){return rotationDates(p,until).map(date=>({date,...(p.decisions[date]||{status:'pending'})}))}
export function nextPlanting(p,from){return p.paused?null:rotationSlots(p,addDays(from,62)).find(s=>s.status==='pending')||null}
export function skipSlot(p,date,reason=''){
  if(!rotationDates(p,date).includes(date))throw Error('This date is not a planting in this rotation.');
  if(p.decisions[date]?.status==='planted')throw Error('This planting has already been recorded.');
  p.decisions[date]={status:'skipped',reason};
}
export function recordPlanting(state,planId,slotDate,input){
  const p=state.rotations.find(p=>p.id===planId);
  if(!p||p.paused)throw Error('Resume the rotation before recording a planting.');
  if(!rotationDates(p,slotDate).includes(slotDate))throw Error('This date is not in the rotation.');
  if(p.decisions[slotDate])throw Error('This planting is already recorded or skipped.');
  if(!lettuceKeys.includes(input.plant)||!isDate(input.sow))throw Error('Choose a lettuce and a valid sowing date.');
  if(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>100000)throw Error('Enter a whole number of plants.');
  if(!Number.isFinite(input.days)||input.days<1||input.days>1500||!['sow','trueLeaves'].includes(input.basis))throw Error('Enter the packet harvest estimate and its starting point.');
  if(input.daysMax!=null&&(!Number.isFinite(input.daysMax)||input.daysMax<input.days||input.daysMax>1500))throw Error('The latest estimate must be on or after the first.');
  if(typeof input.variety!=='string'||!input.variety.trim()||input.variety.length>100)throw Error('Enter the seed variety.');
  const b={...defaultBatch(input.plant,state.settings,'growstand',input.sow),name:'Lettuce',variety:input.variety,quantity:input.quantity,location:input.location||'Indoor grow stand',notes:input.notes||'',days:input.days,basis:input.basis,rotationId:p.id,rotationDate:slotDate};
  if(input.daysMax!=null)b.daysMax=input.daysMax;
  if(input.basis==='trueLeaves'){
    if(!isDate(input.trueLeaves)||input.trueLeaves<input.sow)throw Error('The expected true-leaf date must be on or after sowing.');
    b.trueLeaves=input.trueLeaves;
  }
  b.actual.sow=input.sow;
  state.batches.push(b);
  p.decisions[slotDate]={status:'planted',batchId:b.id};
  return b;
}
// Pending rotation slots, unrecorded single-batch steps, and unacknowledged
// indoor harvest estimates are reminders. No records are generated automatically.
export function indoorReminders(state,date){
  const sowings=(state.rotations||[]).filter(p=>!p.paused).flatMap(p=>rotationSlots(p,date).filter(s=>s.status==='pending').map(s=>({type:'plant',date:s.date,plan:p})));
  const steps=state.batches.filter(b=>b.method==='growstand'&&!b.rotationId&&!b.actual?.ready).flatMap(b=>schedule(b).filter(t=>!t.done&&['sow','trueLeaves'].includes(t.key)&&t.date<=date&&(t.key!=='trueLeaves'||b.actual?.sow)).map(t=>({type:'step',step:t.key,date:t.date,batch:b})));
  const harvests=state.batches.filter(b=>b.method==='growstand'&&b.actual?.sow&&!b.actual?.ready).flatMap(b=>{const t=schedule(b).find(t=>t.key==='ready');return t&&t.date<=date?[{type:'harvest',date:t.date,batch:b,endDate:t.endDate}]:[]});
  return [...sowings,...steps,...harvests].sort((a,b)=>a.date.localeCompare(b.date));
}

// Leaving the outdoor demo must not erase real indoor sowings or rotations.
export function leaveOutdoorDemo(state){
  state.batches=state.batches.filter(b=>b.method==='growstand');
  state.demo=false;
}
