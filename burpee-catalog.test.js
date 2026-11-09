import test from 'node:test';
import assert from 'node:assert/strict';
import {plants,defaultBatch,schedule} from './planner.js';
import {burpeeSeedData,burpeeCatalogSummary} from './burpee-seed-data.js';
import {validBackup} from './backup.js';
import {lettuceKeys,validRotation,recordPlanting} from './rotations.js';
import {findSeeds,catalogCrops,seedCategory} from './seed-picker.js';

const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
test('every included Burpee seed product has one source-linked preset with its verified facts',()=>{
  assert.equal(burpeeCatalogSummary.listedSeedProducts,1059,'The checked seed-only inventory must be complete');
  assert.equal(burpeeCatalogSummary.included,burpeeSeedData.length);
  assert.equal(burpeeCatalogSummary.included+burpeeCatalogSummary.excluded.length,burpeeCatalogSummary.listedSeedProducts);
  assert.equal(new Set(burpeeSeedData.map(row=>row.slug)).size,burpeeSeedData.length);
  for(const row of burpeeSeedData){
    const url=`https://www.burpee.com/products/${row.slug}`;
    const matches=Object.values(plants).filter(p=>p.sources?.includes(url));
    assert.equal(matches.length,1,row.title);
    assert.deepEqual(matches[0].burpeeAttributes,row.attributes);
    assert.equal(matches[0].referenceDate,burpeeCatalogSummary.checkedOn);
  }
});
test('Benary’s Giant Burpee seed updates the original preset instead of creating a duplicate',()=>{
  const slug='benarys-giant-mix-zinnia-prod600555',url=`https://www.burpee.com/products/${slug}`;
  assert.ok(plants.zinnia.sources.includes(url));
  assert.equal(plants.zinnia.variety,'Benary’s Giant');
  assert.equal(plants[`burpee-${slug}`],undefined);
});
test('every catalog preset produces valid schedules and survives a garden backup',()=>{
  const batches=Object.keys(plants).map(key=>defaultBatch(key,settings));
  assert.equal(validBackup({version:1,settings,batches,rotations:[]}),true);
  for(const batch of batches)for(const task of schedule(batch)){
    assert.match(task.date,/^\d{4}-\d{2}-\d{2}$/ ,`${batch.variety}: ${task.key}`);
    assert.ok(!Number.isNaN(Date.parse(task.date)));
  }
});
test('new flower seeds use seasonal expectations and unknown maturity is left unset',()=>{
  for(const [key,p] of Object.entries(plants).filter(([key])=>key.startsWith('burpee-'))){
    if(p.kind==='Flower'){
      assert.equal(p.days,0,key);
      assert.equal(schedule(defaultBatch(key,settings)).some(t=>t.key==='ready'),false);
      assert.equal(p.season,p.burpeeAttributes['Bloom Season']||'');
    }else if(!p.burpeeAttributes['Days to Maturity'])assert.equal(p.days,0,key);
  }
});
test('new lettuce varieties can be chosen, recorded, and restored in indoor rotations',()=>{
  const key=lettuceKeys.find(key=>key.startsWith('burpee-'));
  assert.ok(key,'Expanded catalog includes additional lettuces');
  const p=plants[key],plan={id:'lettuce-plan',name:'Fresh leaves',cadence:'weekly',startDate:'2026-11-09',monthDays:[1,15],plant:key,paused:false,decisions:{}};
  assert.equal(validRotation(plan),true);
  const state={settings,rotations:[plan],batches:[]};
  const b=recordPlanting(state,plan.id,plan.startDate,{plant:key,variety:p.variety,sow:plan.startDate,quantity:6,days:p.days||45,basis:'trueLeaves',trueLeaves:'2026-11-23'});
  assert.equal(b.method,'growstand');
  assert.equal(validBackup({version:1,...JSON.parse(JSON.stringify(state))}),true);
});
test('Sungold search handles joined names, spaces, case, and the tomato crop filter',()=>{
  for(const query of ['sungold','sun gold','SUNGOLD TOMATO','sun gold tomatoes'])assert.ok(findSeeds(plants,{query}).some(([key])=>key==='tomato'),query);
  assert.ok(findSeeds(plants,{category:'Vegetable',crop:'Tomato',query:'sungold'}).some(([key])=>key==='tomato'));
  assert.equal(findSeeds(plants,{category:'Herb',query:'sungold'}).length,0);
});
test('category and crop filters narrow choices and distinguish annual and perennial flowers',()=>{
  for(const category of ['Vegetable','Herb','Annual flower','Perennial flower']){
    const crops=catalogCrops(plants,category);
    assert.ok(crops.length,category);
    const results=findSeeds(plants,{category,crop:crops[0]});
    assert.ok(results.length);
    assert.ok(results.every(([,p])=>seedCategory(p)===category&&(p.crop||p.name)===crops[0]));
  }
  assert.equal(findSeeds(plants,{query:'no-such-variety-12345'}).length,0);
});
test('generic source breadcrumbs retain actual variety names and useful crop groups',()=>{
  const charm=findSeeds(plants,{category:'Annual flower',crop:'Zinnia',query:'charm alarm'});
  assert.equal(charm.length,1);
  assert.equal(charm[0][1].variety,'Charm Alarm Mix');
  assert.ok(findSeeds(plants,{category:'Herb',crop:'Tarragon',query:'russian'}).length);
  assert.ok(burpeeSeedData.every(row=>row.title!=='Annuals'));
});
