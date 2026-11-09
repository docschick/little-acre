import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {plants,methods,addDays,defaultBatch,plantKinds,isFlower,expectations,schedule} from './planner.js';

const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
const appSource=readFileSync(new URL('./app.js',import.meta.url),'utf8');
// Run the real editor and its event handlers with a small form-only DOM adapter.
// No application startup, localStorage, or browser garden records are touched.
const editorSource=appSource.slice(appSource.indexOf('function edit('),appSource.indexOf('function detail('));
function editor(state){
  let form,message;
  const search={};
  function modal(html){
    const elements={};
    for(const match of html.matchAll(/<(input|select|textarea)\b([^>]*)(?:>([\s\S]*?)<\/\1>)?/g)){
      const [,tag,attrs,content='']=match,name=attrs.match(/\bname="([^"]*)"/)?.[1];
      if(!name)continue;
      let value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';
      if(tag==='textarea')value=content;
      if(tag==='select'){
        const options=[...content.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)];
        const option=options.find(o=>/\bselected\b/.test(o[1]))||options[0];
        value=option?.[1].match(/\bvalue="([^"]*)"/)?.[1]??option?.[2]??'';
      }
      elements[name]={name,value};
    }
    form={elements,addEventListener(){},querySelector(){return {textContent:''}}};
  }
  const context=vm.createContext({
    state,plants,methods,addDays,defaultBatch,plantKinds,isFlower,expectations,structuredClone,
    modal,dialogHead:()=>'',growingGuide:()=>'',esc:String,
    plantOptions:key=>Object.entries(plants).map(([value,p])=>`<option value="${value}" ${value===key?'selected':''}>${p.variety}</option>`).join(''),
    $:selector=>selector==='#plant-form'?form:selector==='#catalog-search'?search:{close(){}},
    FormData:class{constructor(f){this.entries=Object.entries(f.elements).map(([key,input])=>[key,input.value])}[Symbol.iterator](){return this.entries[Symbol.iterator]()}},
    save(){},render(){},toast:value=>{message=value},today:()=> '2026-11-09',
  });
  vm.runInContext(editorSource,context);
  return {open:(id,seed)=>context.edit(id,seed),get form(){return form},get message(){return message}};
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
