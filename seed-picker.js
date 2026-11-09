export const seedCategories=['Vegetable','Herb','Annual flower','Perennial flower','Other plants & presets'];
export function seedCategory(plant){
  return plant.seedCategory||(plant.kind==='Vegetable'?'Vegetable':plant.kind==='Herb'?'Herb':'Other plants & presets');
}
export const cropName=plant=>plant.crop||plant.name;
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
export function catalogCrops(plants,category=''){
  return [...new Set(Object.values(plants).filter(p=>!category||seedCategory(p)===category).map(cropName))].sort((a,b)=>a.localeCompare(b));
}
export function findSeeds(plants,{category='',crop='',query=''}={}){
  const terms=query.trim().split(/\s+/).map(normalize).filter(Boolean);
  return Object.entries(plants).filter(([,p])=>{
    if(category&&seedCategory(p)!==category)return false;
    if(crop&&cropName(p)!==crop)return false;
    const search=normalize([p.name,p.variety,cropName(p),p.sourceCrop,p.sourceTitle,seedCategory(p)].join(' '));
    return terms.every(term=>search.includes(term));
  }).sort(([,a],[,b])=>cropName(a).localeCompare(cropName(b))||a.variety.localeCompare(b.variety));
}
