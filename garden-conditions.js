export const sunExposures={'':'Not recorded',sun:'Mostly sun',partial:'Part sun / part shade',shade:'Mostly shade',indoor:'Indoors / grow lights'};
export const validSpot=s=>!!(s&&typeof s.id==='string'&&s.id.length>0&&s.id.length<=100&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=150&&typeof s.sun==='string'&&Object.hasOwn(sunExposures,s.sun)&&typeof s.notes==='string'&&s.notes.length<=5000);
export function spotFor(batch,settings){return (settings.spots||[]).find(s=>batch.spotId?s.id===batch.spotId:s.name.trim().toLowerCase()===batch.location.trim().toLowerCase())}
export function spotPlantings(spot,batches){const when=b=>b.actual?.sow||b.sow;return batches.filter(b=>b.spotId===spot.id||(!b.spotId&&b.location.trim().toLowerCase()===spot.name.trim().toLowerCase())).sort((a,b)=>when(b).localeCompare(when(a)))}
export function spotOptions(batch,settings,esc){return `<label>Saved garden spot<select name="spotId"><option value="">Unassigned / custom spot</option>${(settings.spots||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===batch.spotId?'selected':''}>${esc(s.name)} · ${esc(sunExposures[s.sun])}</option>`).join('')}</select><span class="small">Manage spots and sun exposure in Settings.</span></label>`}
export function conditionsMarkup(state,esc,fmt){
  return `<section class="panel garden-spots" aria-label="Garden spots and history"><div class="section-head"><h2>Your garden spots</h2><button type="button" class="secondary" id="add-spot">+ Add spot</button></div><p class="small">Record the light you observe in each spot. Open its history to see what grew there, your notes, and individual harvests across seasons.</p>${(state.settings.spots||[]).map(s=>{
    const batches=spotPlantings(s,state.batches);
    return `<article class="garden-spot"><div class="section-head"><div><h3>${esc(s.name)}</h3><span class="pill">${esc(sunExposures[s.sun])}</span></div><button type="button" class="text-button" data-edit-spot="${esc(s.id)}">Edit spot</button></div>${s.notes?`<p class="spot-notes">${esc(s.notes)}</p>`:''}<details><summary>Planting & harvest history · ${batches.length} ${batches.length===1?'planting':'plantings'}</summary>${batches.length?batches.map(b=>`<div class="spot-history"><button type="button" class="text-button" data-batch="${esc(b.id)}">${esc(b.name)} · ${esc(b.variety||'Your own variety')} ↗</button><p class="small">${esc(b.quantity)} plants · ${fmt(b.actual?.sow||b.sow,{month:'short',day:'numeric',year:'numeric'})}</p>${b.notes?`<p class="spot-notes">${esc(b.notes)}</p>`:''}${b.harvests.length?b.harvests.map(h=>`<p class="small">${fmt(h.date,{month:'short',day:'numeric',year:'numeric'})} · ${esc(h.amount)} ${esc(h.unit)}${h.note?` · ${esc(h.note)}`:''}</p>`).join(''):'<p class="small">No harvests or observations recorded yet.</p>'}</div>`).join(''):'<p class="small">Assign a planting to this spot to start its history. Older plantings with a matching garden-spot name appear here too.</p>'}</details></article>`;
  }).join('')||'<p class="small">Try “Sunny raised bed” or “Shaded backyard.” Your existing planting locations stay as recorded.</p>'}</section>`;
}
export function editSpot(id,ctx){
  const {state,modal,dialogHead,esc,save,render,toast,$}=ctx;
  const current=(state.settings.spots||[]).find(s=>s.id===id);
  const spot=current||{id:crypto.randomUUID(),name:'',sun:'',notes:''};
  modal(`${dialogHead(current?'Edit garden spot':'A place to grow.')}<form id="spot-form"><div class="form-grid"><label class="full">Spot name<input name="name" value="${esc(spot.name)}" maxlength="150" required placeholder="e.g. Sunny raised bed"></label><label class="full">Sun exposure<select name="sun">${Object.entries(sunExposures).map(([key,label])=>`<option value="${key}" ${spot.sun===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="full">Spot notes<textarea name="notes" maxlength="5000" placeholder="Morning sun, afternoon shade, soil, watering, seasonal changes…">${esc(spot.notes)}</textarea></label></div><p class="small">Light is your observation of this spot. It does not automatically change planting dates or predict yields.</p><div class="form-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save spot</button></div></form>`);
  $('#spot-form').onsubmit=e=>{
    e.preventDefault();const values=Object.fromEntries(new FormData(e.target));
    const updated={...spot,...values,name:values.name.trim()};
    if(!validSpot(updated))return toast('Enter a spot name and valid sun exposure.');
    if((state.settings.spots||[]).some(s=>s.id!==spot.id&&s.name.trim().toLowerCase()===updated.name.toLowerCase()))return toast('Use a different name for each garden spot.');
    if(!current&&(state.settings.spots||[]).length>=200)return toast('You can save up to 200 garden spots.');
    if(current)for(const batch of spotPlantings(current,state.batches)){if(!batch.spotId)batch.spotId=current.id}
    state.settings.spots=current?state.settings.spots.map(s=>s.id===id?updated:s):[...(state.settings.spots||[]),updated];
    save();$('#modal').close();render();toast('Garden spot saved');
  };
}
