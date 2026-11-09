import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as planner from './planner.js';

const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').split('\n').filter(line=>!line.startsWith('import ')).join('\n').split('setupGrowStand({')[0];
function preview(batches){
  const nodes=new Map();
  const root={html:'',buttons:[],set innerHTML(html){
    this.html=html;
    this.buttons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,attrs,text])=>({
      text:text.replace(/<[^>]*>/g,''),
      dataset:Object.fromEntries([...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value])),
    }));
  },querySelectorAll(selector){
    const key=selector.match(/\[data-([\w-]+)\]/)[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    return this.buttons.filter(b=>Object.hasOwn(b.dataset,key));
  }};
  const context=vm.createContext({...planner,crypto,structuredClone,
    localStorage:{getItem:()=>JSON.stringify({settings,demo:true,batches,rotations:[]})},
    document:{querySelector(selector){if(selector==='#app')return root;if(selector==='#clear-demo')return null;if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector)}},
    indoorReminderMarkup:()=>'',bindGrowStand(){},
  });
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run('overview()');
  return {root,run,click(label){const button=root.buttons.find(b=>b.text.includes(label));assert.ok(button,`Missing button: ${label}`);button.onclick()}};
}
function batch(variety,overrides={}){return {...planner.defaultBatch('custom',settings,'direct'),variety,sow:'2027-03-01',basis:'sow',days:20,actual:{sow:'2027-03-01'},...overrides}}

test('planting and pollinator cards open the garden with fresh matching filters',()=>{
  const ui=preview([batch('Salad'),batch('Bee flowers',{kind:'Pollinator'})]);
  ui.run("search='missing';filter='Fruit';overview()");
  ui.click('Planting batches');
  assert.match(ui.root.html,/Salad/);assert.match(ui.root.html,/Bee flowers/);
  assert.equal(ui.run('search'),'');assert.equal(ui.run('filter'),'All');
  ui.run('overview()');ui.click('Pollinator plantings');
  assert.equal(ui.run('filter'),'Pollinator');
  assert.match(ui.root.html,/Bee flowers/);assert.doesNotMatch(ui.root.html,/Salad/);
});
test('task cards open full matching lists including overdue tasks and distant harvests',()=>{
  const ui=preview([
    batch('Due soon'),batch('Overdue',{sow:'2027-02-01',actual:{sow:'2027-02-01'}}),
    batch('Later',{sow:'2027-06-01',actual:{sow:'2027-06-01'}}),
    batch('Completed',{actual:{sow:'2027-03-01',ready:'2027-03-10'}}),
    batch('Flower',{kind:'Pollinator'}),batch('Indoor',{method:'growstand'}),
  ]);
  const upcoming=ui.root.buttons.find(b=>b.text.includes('Upcoming & overdue')).text;
  assert.match(upcoming,/3Upcoming/);
  ui.click('Upcoming & overdue');
  assert.match(ui.root.html,/3 items/);assert.match(ui.root.html,/Overdue/);assert.match(ui.root.html,/Due soon/);assert.match(ui.root.html,/Flower/);
  assert.doesNotMatch(ui.root.html,/Later|Completed|>Indoor</);
  ui.run('overview()');ui.click('Harvests to look forward to');
  assert.match(ui.root.html,/3 items/);assert.match(ui.root.html,/Later/);
  assert.doesNotMatch(ui.root.html,/Flower|Completed|>Indoor</);
  assert.equal(ui.root.buttons.filter(b=>b.dataset.batch).length,3);
  ui.click('← Overview');assert.match(ui.root.html,/Good things are growing/);
});
test('zero-count task cards remain useful and show an empty state',()=>{
  const ui=preview([]);ui.click('Upcoming & overdue');
  assert.match(ui.root.html,/No upcoming or overdue outdoor tasks/);
  ui.run('overview()');ui.click('Harvests to look forward to');
  assert.match(ui.root.html,/No pending outdoor harvest estimates/);
});
