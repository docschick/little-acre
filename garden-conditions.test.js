import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {conditionsMarkup,spotFor,spotPlantings} from './garden-conditions.js';
import {validBackup} from './backup.js';
import {defaultBatch,schedule} from './planner.js';
const base={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
const spot={id:'sunny-bed',name:'Sunny raised bed',sun:'sun',notes:'Afternoon sun; needs watering.'};
const backup=()=>({version:1,settings:{...base,place:'My backyard',gardenNotes:'Clay soil',spots:[{...spot}]},batches:[{...defaultBatch('tomato',base),spotId:spot.id,location:spot.name,notes:'Twelve plants did well.',harvests:[{date:'2027-07-04',amount:'12',unit:'count',note:'Sweet!'}]}]});
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

test('garden conditions, linked plantings, and journals round-trip without changing schedules',()=>{
  const original=backup(),restored=JSON.parse(JSON.stringify(original));
  assert.equal(validBackup(restored),true);assert.deepEqual(restored,original);
  assert.deepEqual(schedule(restored.batches[0]),schedule(original.batches[0]));
  delete restored.settings.spots;delete restored.settings.place;delete restored.settings.gardenNotes;delete restored.batches[0].spotId;
  assert.equal(validBackup(restored),true);
});
test('malformed conditions and dangling spot links are rejected on restore',()=>{
  for(const change of [d=>d.settings.spots[0].sun='unrecognized',d=>d.settings.spots.push({...spot}),d=>d.settings.spots.push({...spot,id:'different',name:' SUNNY RAISED BED '}),d=>d.settings.spots[0].notes=42,d=>d.settings.spots[0].name=' ',d=>d.settings.place={},d=>d.settings.gardenNotes=42,d=>d.batches[0].spotId='missing']){
    const d=backup();change(d);assert.equal(validBackup(d),false);
  }
});
test('spot history spans seasons, sorts by actual sowing, retains linked records after renaming, and includes legacy names',()=>{
  const d=backup(),old={...structuredClone(d.batches[0]),id:'old',sow:'2026-03-01'};delete old.spotId;
  d.batches[0].sow='2026-04-01';d.batches[0].actual.sow='2026-02-01';
  const other={...old,id:'shade',location:'Shaded yard'};
  assert.deepEqual(spotPlantings(spot,[old,other,d.batches[0]]).map(b=>b.id),['old',d.batches[0].id]);
  d.settings.spots[0].name='Renamed bed';
  assert.equal(spotFor(d.batches[0],d.settings).name,'Renamed bed');
  assert.equal(spotPlantings(d.settings.spots[0],d.batches).length,1);
});
test('spot history displays personal notes and individual harvest units safely',()=>{
  const d=backup();d.settings.spots[0].notes='<img src=x>';d.batches[0].notes='<script>bad</script>';
  const markup=conditionsMarkup(d,esc,date=>date);
  assert.match(markup,/Mostly sun/);assert.match(markup,/12 count · Sweet!/);
  assert.match(markup,/&lt;script>/);assert.match(markup,/&lt;img/);assert.doesNotMatch(markup,/<script>|<img/);
});
test('editing a spot retains its identity, linked history, and other garden settings',()=>{
  const state=backup();delete state.batches[0].spotId;const controls={'#spot-form':{},'#modal':{close(){}}};let message;
  const context=vm.createContext({state,crypto:{randomUUID:()=> 'new-id'},FormData:class{constructor(form){this.data=Object.entries(form.values)}[Symbol.iterator](){return this.data[Symbol.iterator]()}},ctx:{state,modal(){},dialogHead:()=>'',esc,save(){},render(){},toast:m=>message=m,$:s=>controls[s]}});
  vm.runInContext(readFileSync(new URL('./garden-conditions.js',import.meta.url),'utf8').replaceAll('export ',''),context);
  vm.runInContext("editSpot('sunny-bed',ctx)",context);
  assert.equal(state.settings.spots[0].name,spot.name);
  controls['#spot-form'].onsubmit({preventDefault(){},target:{values:{name:'Renamed bed',sun:'partial',notes:'Morning light'}}});
  assert.equal(state.settings.spots[0].id,spot.id);assert.equal(state.settings.spots[0].sun,'partial');
  assert.equal(spotFor(state.batches[0],state.settings).name,'Renamed bed');assert.equal(state.settings.gardenNotes,'Clay soil');
  assert.equal(message,'Garden spot saved');assert.equal(validBackup(state),true);
});
test('saving garden-level conditions preserves spots and existing planting dates',()=>{
  const state=backup(),before=structuredClone(state.batches),controls={};
  const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
  const context=vm.createContext({state,fmt:date=>date,heading:()=>'',conditionsMarkup:()=>'',esc,shell(){},openSpot(){},exportData(){},importData(){},confirmAction(){},save(){},render(){},toast(){},$:s=>controls[s]??=(s==='#app'?{querySelectorAll:()=>[]} : {}),FormData:class{constructor(form){this.data=Object.entries(form.values)}[Symbol.iterator](){return this.data[Symbol.iterator]()}}});
  vm.runInContext(source.slice(source.indexOf('function settings(){'),source.indexOf('function openSpot(')),context);vm.runInContext('settings()',context);
  controls['#settings-form'].onsubmit({preventDefault(){},target:{values:{...base,place:'New garden location',frost:'2027-04-15',gardenNotes:'Updated soil notes'}}});
  assert.equal(state.settings.frost,'2027-04-15');assert.equal(state.settings.spots[0].id,spot.id);assert.deepEqual(state.batches,before);
});
