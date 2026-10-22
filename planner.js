import {plants,isFlower} from './catalog.js';
export {plants,isFlower,plantKinds} from './catalog.js';
export const methods={indoor:'Indoor seed start',outdoor:'Outdoor seed trays',direct:'Direct sow',nursery:'Purchased plant / bare root'};
export function addDays(s,n){let d=new Date(s+'T12:00:00');d.setDate(d.getDate()+Number(n));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function schedule(b){
  let tasks=[];
  if(b.method!=='nursery')tasks.push({key:'sow',label:b.method==='indoor'?'Start seeds indoors':b.method==='outdoor'?'Sow in outdoor trays':'Direct sow outdoors',date:b.sow});
  if(b.basis==='trueLeaves'&&Number(b.days)>0){
    const established=b.actual?.trueLeaves||b.trueLeaves||addDays(b.actual?.sow||b.sow,14);
    tasks.push({key:'trueLeaves',label:'Check for several true leaves',date:established});
  }
  if(b.method==='indoor')tasks.push({key:'harden',label:'Begin hardening off',date:b.harden||addDays(b.transplant,-10)});
  if(b.method!=='direct')tasks.push({key:'transplant',label:b.method==='nursery'?'Plant outside':'Transplant outside',date:b.transplant});
  if(Number(b.days)>0){
    let base=b.basis==='trueLeaves'?(b.actual?.trueLeaves||b.trueLeaves||addDays(b.actual?.sow||b.sow,14)):b.basis==='transplant'&&b.method!=='direct'?(b.actual?.transplant||b.transplant):(b.actual?.sow||b.sow);
    tasks.push({key:'ready',label:isFlower(b)?'Look for first blooms':'Harvest window opens',date:addDays(base,b.days),endDate:Number(b.daysMax)>Number(b.days)?addDays(base,b.daysMax):undefined,estimate:true});
  }
  return tasks.map(t=>({...t,date:b.actual?.[t.key]||t.date,done:!!b.actual?.[t.key]}));
}
export function defaultBatch(key,settings,method){
  let p=plants[key];
  method=method||p.defaultMethod||'indoor';
  if(p.allowedMethods&&!p.allowedMethods.includes(method))method=p.defaultMethod;
  let transplant=addDays(settings.frost,p.offset),sow=['direct','outdoor'].includes(method)?transplant:addDays(transplant,-p.weeks*7);
  if(method==='outdoor')transplant=addDays(sow,p.weeks*7);
  const basis=method==='nursery'?'transplant':method==='direct'&&p.basis==='transplant'?'sow':p.basis;
  return {id:crypto.randomUUID(),plant:key,...p,method,basis,sow,transplant,harden:addDays(transplant,-10),location:'',quantity:method==='nursery'?1:6,actual:{},notes:'',harvests:[]};
}
export function expectations(b){
  if(Number(b.days)>0){
    const range=Number(b.daysMax)>Number(b.days)?`${b.days}–${b.daysMax}`:String(b.days);
    const basis=b.basis==='trueLeaves'?'several true leaves':b.basis==='transplant'&&b.method!=='direct'?'transplanting':'sowing';
    return `${isFlower(b)?'First blooms':'First harvest'} · about ${range} days after ${basis}`;
  }
  return b.season?`${isFlower(b)?'Blooms':'Harvest'} · ${b.season}`:'Timing depends on variety and establishment';
}
