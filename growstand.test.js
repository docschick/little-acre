import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBatch} from './planner.js';
import {setupGrowStand,growStandMarkup} from './growstand.js';

const settings={zip:'27540',zone:'8a',frost:'2027-04-06',fall:'2027-11-03'};
function preview(count){
  const state={settings,rotations:[],batches:Array.from({length:count},(_,i)=>({...defaultBatch('buttercrunch',settings,'growstand','2026-11-16'),id:`batch-${i}`,variety:`Buttercrunch ${i+1}`}))};
  state.batches.push(defaultBatch('tomato',settings));
  const before=structuredClone(state);
  setupGrowStand({getState:()=>state,today:()=> '2026-11-09',fmt:date=>date,esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
  const html=growStandMarkup();
  assert.deepEqual(state,before,'Rendering must preserve every planting record');
  assert.ok(html.indexOf('Growing for your plate')<html.indexOf('Your planting rhythm'));
  return html.slice(html.indexOf('<section class="plants-section indoor-plantings">'),html.indexOf('</section>',html.indexOf('<section class="plants-section indoor-plantings">')));
}
test('four indoor batches stay visible without an expand control',()=>{
  const html=preview(4);
  assert.equal((html.match(/class="panel indoor-batch"/g)||[]).length,4);
  assert.doesNotMatch(html,/<details|Show all|Sungold/);
  assert.match(html,/data-add-growstand/);
});
test('additional batches are collapsed in a native disclosure and retain detail links',()=>{
  const html=preview(6),[visible,disclosure]=html.split('<details class="indoor-more">');
  assert.equal((visible.match(/class="panel indoor-batch"/g)||[]).length,4);
  assert.equal((disclosure.match(/class="panel indoor-batch"/g)||[]).length,2);
  assert.match(disclosure,/<summary>.*Show all 6 indoor batches.*Show fewer batches/);
  for(let i=0;i<6;i++)assert.match(html,new RegExp(`data-batch="batch-${i}"`));
  assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
});
test('an empty grow stand keeps the add action and helpful empty state',()=>{
  const html=preview(0);
  assert.match(html,/data-add-growstand/);
  assert.match(html,/No indoor batches recorded yet/);
  assert.doesNotMatch(html,/<details|Show all/);
});
