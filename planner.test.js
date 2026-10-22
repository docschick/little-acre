import test from 'node:test';import assert from 'node:assert/strict';import {addDays,schedule,defaultBatch} from './planner.js';
const settings={frost:'2027-04-06'};
test('dates remain correct across leap years, month and daylight saving boundaries',()=>{assert.equal(addDays('2028-02-28',1),'2028-02-29');assert.equal(addDays('2027-03-01',-1),'2027-02-28');assert.equal(addDays('2027-03-13',2),'2027-03-15');assert.equal(addDays('2027-12-31',1),'2028-01-01')});
test('indoor tomatoes plan sowing, hardening, transplant and harvest from transplant',()=>{const b=defaultBatch('tomato',settings);assert.deepEqual(schedule(b).map(t=>[t.key,t.date]),[['sow','2027-03-02'],['harden','2027-04-10'],['transplant','2027-04-20'],['ready','2027-06-24']]);b.actual.transplant='2027-05-01';assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-07-05')});
test('direct-sown Burpee lettuce counts from true leaves and skips transplanting',()=>{const b=defaultBatch('lettuce',settings,'direct');assert.deepEqual(schedule(b).map(t=>t.key),['sow','trueLeaves','ready']);b.actual.sow='2027-03-20';assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-05-18');b.actual.trueLeaves='2027-04-01';assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-05-16')});
test('outdoor trays have transplant without automatic indoor hardening',()=>{assert.deepEqual(schedule(defaultBatch('tomato',settings,'outdoor')).map(t=>t.key),['sow','transplant','ready'])});
test('purchased seedlings have no seed-start or hardening tasks',()=>{assert.deepEqual(schedule(defaultBatch('tomato',settings,'nursery')).map(t=>t.key),['transplant','ready'])});
test('perennials with unknown maturity get no invented harvest or bloom deadline',()=>{assert.equal(schedule(defaultBatch('butterfly',settings)).some(t=>t.key==='ready'),false)});
test('sow-based maturity stays tied to sowing when transplant changes',()=>{const b=defaultBatch('basil',settings);b.actual.transplant='2027-05-04';assert.equal(schedule(b).find(t=>t.key==='ready').date,addDays(b.sow,65))});
test('outdoor tomato starts wait for the outdoor target and mature from later transplant',()=>{const b=defaultBatch('tomato',settings,'outdoor');assert.equal(b.sow,'2027-04-20');assert.equal(b.transplant,'2027-06-08');assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-08-12')});
test('purchased herbs count maturity from transplant, not an invented seed start',()=>{const b=defaultBatch('basil',settings,'nursery');assert.equal(b.basis,'transplant');assert.equal(schedule(b).find(t=>t.key==='ready').date,addDays(b.transplant,65))});

import {plants,isFlower,expectations} from './planner.js';
import {validBackup} from './backup.js';
test('all 26 requested types are available, including existing Sungold and Simpson presets',()=>{
  const requested=['bibb','lettuce','fourSeasons','dynamite','tomato','verandaRed','superSweet100','twoTasty','blueberryPie','everlastingRevolution','miniMe','fantasia','dasanteBlue','largeLeafBasil','powwowWildBerry','blackCherry','amishPaste','fignomenal','redLark','rainbowSherbet','sweetSandia','galaxy','hosta','sweetPepper','bellPepper','toadLily'];
  assert.equal(requested.length,26);
  for(const key of requested){const b=defaultBatch(key,settings);assert.ok(b.name);assert.ok(plants[key].sources?.length,`${key} has a reference`);assert.ok(schedule(b).every(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.date)),`${key} produces valid dates`)}
});
test('lettuce varieties and early / late tomato varieties have distinct harvest estimates',()=>{
  const harvest=k=>schedule(defaultBatch(k,settings)).find(t=>t.key==='ready').date;
  assert.ok(harvest('lettuce')<harvest('bibb'));
  assert.ok(harvest('verandaRed')<harvest('superSweet100'));
  assert.equal(defaultBatch('tomato',settings).days,65);
});
test('Amish Paste and unspecified peppers expose a harvest range, and actual dates move both bounds',()=>{
  const b=defaultBatch('amishPaste',settings);b.actual.transplant='2027-05-01';const t=schedule(b).find(t=>t.key==='ready');
  assert.equal(t.date,'2027-07-14');assert.equal(t.endDate,'2027-07-25');
  assert.match(expectations(defaultBatch('sweetPepper',settings)),/60–90/);
});
test('nursery-only cultivars default to plants and do not invent seed or harvest tasks',()=>{
  for(const key of ['fignomenal','galaxy','sweetSandia','rainbowSherbet','everlastingRevolution','blueberryPie','redLark']){
    const b=defaultBatch(key,settings,'indoor');assert.equal(b.method,'nursery');assert.equal(b.quantity,1);
    assert.deepEqual(schedule(b).map(t=>t.key),['transplant']);assert.ok(b.season);
  }
});
test('flowers produce bloom expectations and observations rather than vegetable harvests',()=>{
  const b=defaultBatch('toadLily',settings);assert.equal(isFlower(b),true);assert.match(expectations(b),/^Blooms · Late summer into fall/);
  b.days=90;assert.equal(schedule(b).find(t=>t.key==='ready').label,'Look for first blooms');
  assert.equal(isFlower(defaultBatch('fignomenal',settings)),false);
});
test('legacy batches retain their saved name, days, dates and sowing basis',()=>{
  const b={...defaultBatch('lettuce',settings,'direct'),name:'My original lettuce',basis:'sow',days:45,sow:'2027-03-20'};
  const before=structuredClone(b);assert.equal(schedule(b).find(t=>t.key==='ready').date,'2027-05-04');assert.deepEqual(b,before);
});
test('old and new garden backups round-trip with seasonal notes, ranges and actual true-leaf dates',()=>{
  const legacy={...defaultBatch('tomato',settings),name:'Cherry tomato',days:60};
  delete legacy.season;delete legacy.sources;delete legacy.defaultMethod;
  const b=defaultBatch('lettuce',settings);b.trueLeaves='2027-04-01';b.actual.trueLeaves='2027-04-03';
  const d={version:1,settings:{...settings,zip:'27540',zone:'8a',fall:'2027-11-03'},batches:[legacy,b,defaultBatch('amishPaste',settings),defaultBatch('galaxy',settings),defaultBatch('toadLily',settings)]};
  assert.equal(validBackup(JSON.parse(JSON.stringify(d))),true);
  d.batches[2].daysMax=2;assert.equal(validBackup(d),false);
});
test('malformed optional dates or plant kinds cannot enter through import',()=>{
  const b=defaultBatch('lettuce',settings);const d={version:1,settings:{...settings,zip:'27540',zone:'8a',fall:'2027-11-03'},batches:[b]};
  b.trueLeaves='2027-02-30';assert.equal(validBackup(d),false);delete b.trueLeaves;b.kind='unknown';assert.equal(validBackup(d),false);
});
