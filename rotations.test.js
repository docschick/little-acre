import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationDates,rotationSlots,skipSlot,recordPlanting,indoorReminders,nextPlanting,validRotation,leaveOutdoorDemo} from './rotations.js';
import {defaultBatch,schedule} from './planner.js';
import {validBackup} from './backup.js';
const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
function plan(overrides={}){return {id:'rotation-1',name:'Indoor lettuce',startDate:'2026-11-09',cadence:'weekly',monthDays:[1,15],plant:null,paused:false,decisions:{},...overrides}}
function state(p=plan()){return {version:1,settings,rotations:[p],batches:[]}}
function input(overrides={}){return {plant:'lettuce',variety:'Black Seeded Simpson',sow:'2026-11-09',quantity:6,days:45,basis:'trueLeaves',trueLeaves:'2026-11-23',location:'Shelf 2',notes:'',...overrides}}
test('weekly and fortnightly sowings cross years without drifting',()=>{
  assert.deepEqual(rotationDates(plan({startDate:'2026-12-28'}),'2027-01-12'),['2026-12-28','2027-01-04','2027-01-11']);
  assert.deepEqual(rotationDates(plan({cadence:'fortnightly'}),'2026-12-09'),['2026-11-09','2026-11-23','2026-12-07']);
});
test('twice-monthly is two calendar days, not fourteen-day intervals',()=>{
  const p=plan({cadence:'twiceMonthly'});
  assert.deepEqual(rotationDates(p,'2027-01-16'),['2026-11-09','2026-11-15','2026-12-01','2026-12-15','2027-01-01','2027-01-15']);
});
test('short months clamp and deduplicate month days, including leap years',()=>{
  const p=plan({startDate:'2028-01-31',cadence:'twiceMonthly',monthDays:[30,31]});
  assert.deepEqual(rotationDates(p,'2028-03-31'),['2028-01-31','2028-02-29','2028-03-30','2028-03-31']);
});
test('skipping keeps later slots fixed and produces no planting or harvest record',()=>{
  const s=state();skipSlot(s.rotations[0],'2026-11-09','Vacation');
  assert.equal(nextPlanting(s.rotations[0],'2026-11-09').date,'2026-11-16');
  assert.equal(s.batches.length,0);assert.deepEqual(indoorReminders(s,'2026-11-09'),[]);
  delete s.rotations[0].decisions['2026-11-09'];assert.equal(nextPlanting(s.rotations[0],'2026-11-09').date,'2026-11-09');
});
test('a late actual sowing shifts its harvest, but not the next rotation planting',()=>{
  const s=state();const b=recordPlanting(s,'rotation-1','2026-11-09',input({sow:'2026-11-12',trueLeaves:'2026-11-26'}));
  assert.equal(nextPlanting(s.rotations[0],'2026-11-12').date,'2026-11-16');
  assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-01-10');
  assert.deepEqual(schedule(b).map(t=>t.key),['sow','trueLeaves','ready']);
  assert.equal(b.actual.sow,'2026-11-12');
});
test('recording is explicit and duplicate clicks cannot create duplicate batches',()=>{
  const s=state();assert.equal(rotationSlots(s.rotations[0],'2026-12-01').length,4);assert.equal(s.batches.length,0);
  recordPlanting(s,'rotation-1','2026-11-09',input());
  assert.throws(()=>recordPlanting(s,'rotation-1','2026-11-09',input()),/already recorded/);assert.equal(s.batches.length,1);
  assert.throws(()=>skipSlot(s.rotations[0],'2026-11-09'),/already been recorded/);
});
test('seeds and harvest timing can differ between sowings',()=>{
  const s=state();recordPlanting(s,'rotation-1','2026-11-09',input());
  const b=recordPlanting(s,'rotation-1','2026-11-16',input({plant:'custom',variety:'My baby-leaf mix',sow:'2026-11-16',days:28,daysMax:35,basis:'sow'}));
  const ready=schedule(b).find(t=>t.key==='ready');assert.equal(ready.date,'2026-12-14');assert.equal(ready.endDate,'2026-12-21');assert.equal(b.variety,'My baby-leaf mix');
});
test('indoor harvests use sowing dates in November rather than the outdoor frost date',()=>{
  const b=defaultBatch('lettuce',settings,'growstand','2026-11-09');assert.equal(b.sow,'2026-11-09');
  assert.equal(schedule(b).some(t=>['harden','transplant'].includes(t.key)),false);
  assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-01-07');
});
test('harvest reminders start at the estimate and stop only when acknowledged',()=>{
  const s=state();const b=recordPlanting(s,'rotation-1','2026-11-09',input({basis:'sow',days:28}));
  s.rotations[0].paused=true;
  assert.equal(indoorReminders(s,'2026-12-06').length,0);assert.equal(indoorReminders(s,'2026-12-07')[0].type,'harvest');
  b.harvests.push({date:'2026-12-07',amount:'1',unit:'handfuls',note:''});assert.equal(indoorReminders(s,'2026-12-08').length,1);
  b.actual.ready='2026-12-08';assert.deepEqual(indoorReminders(s,'2026-12-08'),[]);
});
test('pause suppresses sowing reminders, keeps harvest checks, and preserves slots for resume',()=>{
  const p=plan({paused:true});assert.deepEqual(indoorReminders(state(p),'2026-11-30'),[]);assert.equal(nextPlanting(p,'2026-11-30'),null);
  p.paused=false;assert.equal(indoorReminders(state(p),'2026-11-30').length,4);
});
test('future rotations create no early reminders or false records',()=>{
  const s=state(plan({startDate:'2026-12-01'}));assert.deepEqual(indoorReminders(s,'2026-11-09'),[]);assert.equal(s.batches.length,0);
});
test('skipped slots must be restored before recording, and non-slot dates cannot be used',()=>{
  const s=state();skipSlot(s.rotations[0],'2026-11-09');assert.throws(()=>recordPlanting(s,'rotation-1','2026-11-09',input()),/skipped/);
  assert.throws(()=>skipSlot(s.rotations[0],'2026-11-10'),/not a planting/);
});
test('new rotation backups and legacy backups are both valid',()=>{
  const s=state();recordPlanting(s,'rotation-1','2026-11-09',input());skipSlot(s.rotations[0],'2026-11-16','Away');
  const restored=JSON.parse(JSON.stringify(s));assert.equal(validBackup(restored),true);assert.deepEqual(rotationSlots(restored.rotations[0],'2026-11-23').map(s=>s.status),['planted','skipped','pending']);
  const legacy={version:1,settings,batches:[defaultBatch('tomato',settings)]};assert.equal(validBackup(legacy),true);
});
test('malformed rotation dates, cadence, and history are rejected on import',()=>{
  for(const patch of [{cadence:'daily'},{startDate:'2026-02-30'},{monthDays:[15,1]},{paused:'false'},{decisions:{'bad-date':{status:'skipped'}}}]){const p=plan(patch);assert.equal(validRotation(p),false);assert.equal(validBackup(state(p)),false)}
});

test('leaving the outdoor sample preserves real indoor batches and rotation history',()=>{
  const s=state();s.demo=true;const b=recordPlanting(s,'rotation-1','2026-11-09',input());s.batches.push(defaultBatch('tomato',settings));
  const history=structuredClone(s.rotations);leaveOutdoorDemo(s);assert.equal(s.demo,false);assert.deepEqual(s.batches,[b]);assert.deepEqual(s.rotations,history);
});
