export const seedCategories=['Vegetable','Herb','Annual flower','Perennial flower','Other plants & presets'];
export function seedCategory(plant){
  return plant.seedCategory||(plant.kind==='Vegetable'?'Vegetable':plant.kind==='Herb'?'Herb':'Other plants & presets');
}
export const cropName=plant=>plant.crop||plant.name;
export const varietyPageSize=6;
export function varietyPage(matches,page=0){
  const pages=Math.max(1,Math.ceil(matches.length/varietyPageSize));
  const current=Math.max(0,Math.min(page,pages-1)),start=current*varietyPageSize;
  return {items:matches.slice(start,start+varietyPageSize),page:current,pages,total:matches.length,start:matches.length?start+1:0,end:Math.min(start+varietyPageSize,matches.length)};
}
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
