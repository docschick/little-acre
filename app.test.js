import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {seedCategories,cropName,catalogCrops,findSeeds} from './seed-picker.js';
import {plants,methods,addDays,defaultBatch,plantKinds,isFlower,expectations,schedule} from './planner.js';

const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
const appSource=readFileSync(new URL('./app.js',import.meta.url),'utf8');
// Run the real editor and its event handlers with a small form-only DOM adapter.
// No application startup, localStorage, or browser garden records are touched.
const editorSource=appSource.slice(appSource.indexOf('function edit('),appSource.indexOf('function detail('));
const optionsSource=appSource.slice(appSource.indexOf('function plantOptions('),appSource.indexOf('function growingGuide('));
function editor(state){
  let form,message;
  const controls=new Map();
  function modal(html){
    const elements={};
    for(const match of html.matchAll(/<(input|select|textarea)\b([^>]*)(?:>([\s\S]*?)<\/\1>)?/g)){
      const [,tag,attrs,content='']=match,name=attrs.match(/\bname="([^"]*)"/)?.[1],id=attrs.match(/\bid="([^"]*)"/)?.[1];
      if(!name&&!id)continue;
      let value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';
      if(tag==='textarea')value=content;
      if(tag==='select'){
        const options=[...content.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)];
        const option=options.find(o=>/\bselected\b/.test(o[1]))||options[0];
        value=option?.[1].match(/\bvalue="([^"]*)"/)?.[1]??option?.[2]??'';
      }
      const control={name,value};
      if(name)elements[name]=control;
      if(id)controls.set('#'+id,control);
    }
    form={elements,addEventListener(){},querySelector(){return {textContent:''}}};
  }
  const context=vm.createContext({
    state,plants,methods,addDays,defaultBatch,plantKinds,isFlower,expectations,structuredClone,seedCategories,cropName,catalogCrops,findSeeds,
    modal,dialogHead:()=>'',growingGuide:()=>'',esc:String,
    $:selector=>{if(selector==='#plant-form')return form;if(!controls.has(selector))controls.set(selector,{close(){}});return controls.get(selector)},
    FormData:class{constructor(f){this.entries=Object.entries(f.elements).map(([key,input])=>[key,input.value])}[Symbol.iterator](){return this.entries[Symbol.iterator]()}},
    save(){},render(){},toast:value=>{message=value},today:()=> '2026-11-09',
  });
  vm.runInContext(optionsSource+editorSource,context);
  return {open:(id,seed)=>context.edit(id,seed),control:selector=>controls.get(selector),get form(){return form},get message(){return message}};
}

for(const existing of [false,true])test(`changing lettuce preserves an entered sow date for ${existing?'a recorded rotation planting':'a new indoor planting'}`,()=>{
  const seed=defaultBatch('lettuce',settings,'growstand','2026-11-09');
  if(existing){seed.rotationId='rotation-1';seed.rotationDate='2026-11-09';seed.actual.sow='2026-11-09';seed.harvests.push({date:'2027-01-07',amount:'1',unit:'handfuls',note:''})}
  const state={settings,batches:existing?[seed]:[]},ui=editor(state);
  ui.open(existing?seed.id:undefined,existing?undefined:seed);
  ui.form.elements.sow.value='2026-11-01';
  ui.form.elements.sow.onchange();
  ui.form.elements.plant.value='bibb';
  ui.form.elements.plant.onchange({target:ui.form.elements.plant});
  assert.equal(ui.form.elements.sow.value,'2026-11-01');
  assert.equal(ui.form.elements.method.value,'growstand');
  ui.form.onsubmit({preventDefault(){}});
  assert.equal(state.batches.length,1);
  const saved=state.batches[0];
  assert.equal(saved.plant,'bibb');
  assert.equal(saved.sow,'2026-11-01');
  assert.equal(saved.id,seed.id);
  assert.deepEqual(saved.actual,seed.actual);
  assert.deepEqual(saved.harvests,seed.harvests);
  assert.equal(saved.rotationId,seed.rotationId);
  assert.equal(saved.rotationDate,seed.rotationDate);
  if(!existing)assert.equal(schedule(saved).find(t=>t.key==='ready').date,addDays('2026-11-15',plants.bibb.days));
  assert.match(ui.message,/Planting (added|updated)/);
});

test('switching a Burpee vegetable between indoor and direct sowing updates its maturity basis',()=>{
  const key=Object.keys(plants).find(key=>key.startsWith('burpee-')&&plants[key].seedCategory==='Vegetable'&&plants[key].days>0&&/Indoor/i.test(plants[key].burpeeAttributes?.['Sow Method']||'')&&/Outdoor/i.test(plants[key].burpeeAttributes?.['Sow Method']||''));
  assert.ok(key,'Catalog includes a Burpee vegetable with indoor and outdoor sowing methods');
  const ui=editor({settings,batches:[]});
  ui.open(undefined,defaultBatch(key,settings,'indoor'));
  assert.equal(ui.form.elements.basis.value,'transplant');
  ui.form.elements.method.value='direct';
  ui.form.elements.method.onchange();
  assert.equal(ui.form.elements.basis.value,'trueLeaves');
  ui.form.elements.method.value='indoor';
  ui.form.elements.method.onchange();
  assert.equal(ui.form.elements.basis.value,'transplant');
});

test('picker narrows a full catalog without changing planting fields and can clear its filters',()=>{
  const state={settings,batches:[]},ui=editor(state);
  ui.open();
  assert.ok((ui.form.elements.plant.innerHTML.match(/<option\b/g)||[]).length<=61);
  ui.form.elements.quantity.value='12';
  const change=(selector,value,event='onchange')=>{const control=ui.control(selector);control.value=value;control[event]({target:control})};
  change('#catalog-category','Herb');change('#catalog-crop','Basil');
  assert.equal(ui.control('#catalog-count').textContent,'18 matching choices');
  assert.equal(ui.form.elements.variety.value,'Sungold Hybrid');
  assert.equal(ui.form.elements.quantity.value,'12');
  change('#catalog-search','sun gold tomatoes','oninput');
  assert.equal(ui.control('#catalog-category').value,'');assert.equal(ui.control('#catalog-crop').value,'');
  assert.equal(ui.control('#catalog-count').textContent,'1 matching choice');
  assert.match(ui.form.elements.plant.innerHTML,/Sungold Hybrid/);
  change('#catalog-search','no-such-variety-12345','oninput');
  assert.match(ui.control('#catalog-count').textContent,/No matching varieties/);
  assert.match(ui.form.elements.plant.innerHTML,/Current selection/);
  ui.control('#catalog-clear').onclick();
  assert.equal(ui.control('#catalog-search').value,'');
  assert.match(ui.control('#catalog-count').textContent,/Showing the first 60/);
  assert.equal(state.batches.length,0);
});
