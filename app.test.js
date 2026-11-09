import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {seedCategories,seedCategory,cropName,catalogCrops,findSeeds,varietyPage} from './seed-picker.js';
import {plants,methods,addDays,defaultBatch,plantKinds,isFlower,expectations,schedule} from './planner.js';

const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
const appSource=readFileSync(new URL('./app.js',import.meta.url),'utf8');
// Run the real editor and its event handlers with a small form-only DOM adapter.
// No application startup, localStorage, or browser garden records are touched.
const editorSource=appSource.slice(appSource.indexOf('function edit('),appSource.indexOf('function detail('));
function editor(state){
  let form,message;
  const controls=new Map();
  const makeControl=()=>({html:'',children:[],close(){},focus(){this.focused=true},set innerHTML(html){
    this.html=html;
    this.children=[...html.matchAll(/<button\b([^>]*)>/g)].map(([,attrs])=>({focus(){this.focused=true},dataset:Object.fromEntries([...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]))}));
  },get innerHTML(){return this.html},querySelectorAll(selector){const key=selector.match(/\[data-([\w-]+)\]/)[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return this.children.filter(el=>Object.hasOwn(el.dataset,key))}});
  const control=selector=>{if(!controls.has(selector))controls.set(selector,makeControl());return controls.get(selector)};
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
    control('#catalog-shortcuts').innerHTML=html.match(/id="catalog-shortcuts"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
  }
  const context=vm.createContext({
    state,plants,methods,addDays,defaultBatch,plantKinds,isFlower,expectations,structuredClone,seedCategories,seedCategory,cropName,catalogCrops,findSeeds,varietyPage,
    modal,dialogHead:()=>'',growingGuide:()=>'',esc:String,
    $:selector=>selector==='#plant-form'?form:control(selector),
    FormData:class{constructor(f){this.entries=Object.entries(f.elements).map(([key,input])=>[key,input.value])}[Symbol.iterator](){return this.entries[Symbol.iterator]()}},
    save(){},render(){},toast:value=>{message=value},today:()=> '2026-11-09',
  });
  vm.runInContext(editorSource,context);
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
  assert.equal(ui.control('#catalog-results').children.length,6);
  ui.form.elements.quantity.value='12';
  const change=(selector,value,event='onchange')=>{const control=ui.control(selector);control.value=value;control[event]({target:control})};
  change('#catalog-category','Herb');change('#catalog-crop','Basil');
  assert.equal(ui.control('#catalog-count').textContent,'Showing 1–6 of 18 matching varieties');
  assert.equal(ui.form.elements.variety.value,'Sungold Hybrid');
  assert.equal(ui.form.elements.quantity.value,'12');
  change('#catalog-search','sun gold tomatoes','oninput');
  assert.equal(ui.control('#catalog-category').value,'');assert.equal(ui.control('#catalog-crop').value,'');
  assert.equal(ui.control('#catalog-count').textContent,'Showing 1–1 of 1 matching variety');
  assert.match(ui.control('#catalog-results').innerHTML,/Sungold Hybrid/);
  change('#catalog-search','no-such-variety-12345','oninput');
  assert.match(ui.control('#catalog-count').textContent,/No matching varieties/);
  assert.equal(ui.form.elements.plant.value,'');
  assert.equal(ui.control('#catalog-prev').disabled,true);assert.equal(ui.control('#catalog-next').disabled,true);
  ui.control('#catalog-clear').onclick();
  assert.equal(ui.control('#catalog-search').value,'');
  assert.match(ui.control('#catalog-count').textContent,/Choose a plant type/);
  assert.equal(ui.control('#catalog-results').hidden,true);
  assert.equal(state.batches.length,0);
});

test('every variety is reachable by paging and browsing preserves entered fields',()=>{
  const ui=editor({settings,batches:[]});ui.open();
  ui.form.elements.quantity.value='12';
  assert.equal(ui.control('#catalog-results').hidden,true);
  ui.control('#catalog-all').onclick();
  assert.equal(ui.control('#catalog-results').hidden,false);
  const found=new Set();
  do{
    for(const button of ui.control('#catalog-results').children)found.add(button.dataset.seedChoice);
    if(ui.control('#catalog-next').disabled)break;
    ui.control('#catalog-next').onclick();
  }while(found.size<=Object.keys(plants).length);
  assert.equal(found.size,Object.keys(plants).length);
  assert.ok(found.has('zinnia'),'Varieties beyond the old cap remain reachable');
  assert.equal(ui.form.elements.quantity.value,'12');
  assert.equal(ui.form.elements.plant.value,'');
  assert.equal(ui.control('#catalog-next').disabled,true);
  ui.control('#catalog-prev').onclick();assert.equal(ui.control('#catalog-next').disabled,false);
  const search=ui.control('#catalog-search');search.value='sungold';search.oninput({target:search});
  assert.equal(ui.control('#catalog-page').textContent,'Page 1 of 1');
});
test('quick crop buttons filter results and choosing a result saves that variety',()=>{
  const state={settings,batches:[]},ui=editor(state);ui.open();
  ui.control('#catalog-shortcuts').children.find(el=>el.dataset.quickCrop==='Basil').onclick();
  assert.equal(ui.control('#catalog-crop').value,'Basil');
  const result=ui.control('#catalog-results').children.find(el=>el.dataset.seedChoice==='burpee-basil-batik-prod600093');
  assert.ok(result);result.onclick();
  assert.equal(ui.form.elements.plant.value,'burpee-basil-batik-prod600093');
  assert.equal(ui.form.elements.variety.value,'Batik');
  ui.form.onsubmit({preventDefault(){}});
  assert.equal(state.batches.length,1);assert.equal(state.batches[0].variety,'Batik');
});


test('search Enter focuses visible matches without saving an implicit variety',()=>{
  const state={settings,batches:[],rotations:[]},ui=editor(state);ui.open();
  assert.equal(ui.form.elements.plant.value,'');
  assert.equal(ui.control('#save-planting').disabled,true);
  const search=ui.control('#catalog-search');search.value='watermelon';search.oninput({target:search});
  let prevented=false;search.onkeydown({key:'Enter',preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.equal(ui.control('#catalog-results').children[0].focused,true);
  ui.form.onsubmit({preventDefault(){}});assert.equal(state.batches.length,0);
  const choice=ui.control('#catalog-results').children.find(el=>plants[el.dataset.seedChoice].name==='Watermelon');choice.onclick();
  assert.match(ui.form.elements.name.value,/watermelon/i);
  assert.equal(ui.control('#save-planting').disabled,false);
  ui.form.onsubmit({preventDefault(){}});assert.equal(state.batches.length,1);
  assert.match(state.batches[0].name,/watermelon/i);
});

test('explicitly choosing Sungold works and a new search requires a new choice or keep',()=>{
  const state={settings,batches:[],rotations:[]},ui=editor(state);ui.open();
  let search=ui.control('#catalog-search');search.value='sungold';search.oninput({target:search});
  ui.control('#catalog-results').children[0].onclick();
  assert.equal(ui.form.elements.plant.value,'tomato');
  search=ui.control('#catalog-search');search.value='watermelon';search.oninput({target:search});
  assert.equal(ui.control('#save-planting').disabled,true);
  ui.form.onsubmit({preventDefault(){}});assert.equal(state.batches.length,0);
  ui.control('#catalog-keep').onclick();assert.equal(ui.control('#save-planting').disabled,false);
  ui.form.onsubmit({preventDefault(){}});assert.equal(state.batches[0].plant,'tomato');
});
