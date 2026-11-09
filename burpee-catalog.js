import {burpeeSeedData,burpeeCatalogSummary,burpeeCropGroups} from './burpee-seed-data.js';

const maturitySource='https://support.burpee.com/support/solutions/articles/60000710747-when-does-days-to-maturity-days-to-harvest-start-';
const cropNames={Tomatoes:'Tomato',Beans:'Bean',Beets:'Beet',Cabbages:'Cabbage',Carrots:'Carrot',Cucumbers:'Cucumber',Eggplants:'Eggplant',Peppers:'Pepper',Pumpkins:'Pumpkin',Turnips:'Turnip',Peas:'Pea',Onions:'Onion',Leeks:'Leek',Parsnips:'Parsnip',Shallots:'Shallot',Peanuts:'Peanut',Gourds:'Gourd',Zinnias:'Zinnia',Sunflowers:'Sunflower',Marigolds:'Marigold',Snapdragons:'Snapdragon',Petunias:'Petunia',Pansies:'Pansy',Violas:'Viola',Strawflowers:'Strawflower',Foxgloves:'Foxglove','Morning Glories':'Morning glory','Moonflowers':'Moonflower','Sweet Peas':'Sweet pea','Shasta Daisies':'Shasta daisy','Painted Daisies':'Painted daisy','Gloriosa Daisies':'Gloriosa daisy','Poppy Flowers':'Poppy','Salvia Flowers':'Salvia','Dianthus-Annuals':'Dianthus','Babys Breath-Annuals':"Baby’s breath",Gaillardias:'Gaillardia',Rudbeckias:'Rudbeckia',Lavenders:'Lavender','Asclepias-Annuals':'Asclepias','Phlox Flowers':'Phlox','Geraniums-Annuals':'Geranium','Ice Plants':'Ice plant','Scabiosa Flowers':'Scabiosa',Lobelias:'Lobelia',Vincas:'Vinca',Verbenas:'Verbena',Carnations:'Carnation',Cowpeas:'Cowpea','Ornamental Kales':'Ornamental kale','Babys Breath':"Baby’s breath",'Four OClocks':"Four o’clock"};
const genericCrops=new Set(['Vegetables','Herbs','Flowers','Perennials','Bedding Flowers','Direct Sow Flowers','Salad Greens','Garden Ready Flowers','Herb Plants','Gourmet Herbs']);
const knownCrops=[...new Set(burpeeCropGroups.filter(name=>!genericCrops.has(name)&&!/(Container|Deer|Drought|Full Sun|Shade|New |Seeds|Plants|Flowers|Favorite|Cutting|Gourmet|Sown|Sow |Hardy)/i.test(name)).map(name=>cropNames[name]||name))].sort((a,b)=>b.length-a.length);
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// These product titles identify a crop more precisely than their generic breadcrumb.
const cropOverrides={
  'anise-hyssop-herb-seeds-plant-prod600398':'Anise hyssop',
  'asparagus-fern-fuzzy-fern-frizz-prod600209':'Asparagus fern',
  'centaurea-the-bride-prod600180':'Centaurea',
  'craspedia-drumstick-prod500427':'Craspedia',
  'flowerburst-fruitbowl-achillea-prod600505':'Achillea',
  'herb-eucalyptus-gunii-silverdrop-prod099646':'Eucalyptus',
  'herb-sesame-prod100127':'Sesame',
  'matricaria-vegmo-snowball-prod600207':'Matricaria',
  'melampodium-jackpot-gold-prod500038':'Melampodium',
  'miss-jekyll-mixed-colors-nigella-seeds-prod600419':'Nigella',
  'petchoa-caliburst-yellow-hybrid-prod600208':'Petchoa',
  'phacelia-tanacetifolia-blue-tansy-prod100151':'Phacelia',
  'ptilotus-matilda-prod600206':'Ptilotus',
  'sunspell-hybrid-petchoa-prod600537':'Petchoa',
  'tarragon-russian-prod600131':'Tarragon',
  'wildflowers-burpees-pollinator-mix-prod600585':'Wildflower mix',
};
function productNames(row){
  const titleCrop=knownCrops.find(name=>row.title.toLowerCase().endsWith(' '+name.toLowerCase()));
  const crop=cropOverrides[row.slug]||cropNames[row.crop]||(genericCrops.has(row.crop)?titleCrop||(row.category==='Vegetables'?'Vegetable':row.category==='Herbs'?'Herb':'Flower'):row.crop);
  const escaped=crop.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const variety=row.title.replace(new RegExp(`\\s+${escaped}$`,'i'),'').trim();
  return {name:crop,crop,variety:variety||row.title};
}
function metadata(row){
  const life=row.attributes.Lifecycle||'';
  const seedCategory=row.category==='Vegetables'?'Vegetable':row.category==='Herbs'?'Herb':row.category==='Perennials'||life==='Perennial'||life==='Biennial'?'Perennial flower':'Annual flower';
  return {seedCategory,lifecycle:life,sourceCrop:row.crop,sourceTitle:row.title,referenceDate:burpeeCatalogSummary.checkedOn,burpeeAttributes:{...row.attributes}};
}
export function expandBurpeeSeeds(legacy){
  const catalog={...legacy},bySlug=new Map();
  for(const [key,p] of Object.entries(legacy))for(const url of p.sources||[]){
    if(url.startsWith('https://www.burpee.com/products/'))bySlug.set(new URL(url).pathname.split('/').pop(),key);
  }
  // These original generic presets predate product links. Keep their stable IDs.
  const originalAliases={'basil-genovese-prod000452':'basil','asclepias-tuberosa-butterfly-weed-prod000004':'butterfly'};
  for(const row of burpeeSeedData){
    const names=productNames(row),facts=metadata(row),url=`https://www.burpee.com/products/${row.slug}`;
    const existingKey=bySlug.get(row.slug)||originalAliases[row.slug]||Object.keys(legacy).find(key=>normalize(legacy[key].name+legacy[key].variety)===normalize(names.name+names.variety));
    if(existingKey&&legacy[existingKey]){
      catalog[existingKey]={...legacy[existingKey],...facts,crop:names.crop,sources:[...new Set([url,...(legacy[existingKey].sources||[])])]};
      continue;
    }
    const methods=row.attributes['Sow Method']||'',direct=/Outdoor/i.test(methods);
    const defaultMethod=direct?'direct':/Indoor/i.test(methods)?'indoor':'direct';
    const flower=facts.seedCategory.endsWith('flower'),vegetableSeed=facts.seedCategory==='Vegetable',kind=flower?'Flower':facts.seedCategory==='Herb'?'Herb':['Watermelon','Melon','Cantaloupe'].includes(names.name)?'Fruit':'Vegetable';
    const maturity=row.attributes['Days to Maturity']||'';
    const match=maturity.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    const days=!flower&&match?Number(match[1]):0;
    const profile=(names.name==='Pepper'?legacy.sweetPepper:null)||Object.values(legacy).find(p=>normalize(p.name)===normalize(names.name)&&p.defaultMethod!=='nursery');
    const weeks=profile?.weeks??(defaultMethod==='indoor'?6:4),offset=profile?.offset??(defaultMethod==='indoor'?14:0);
    const basis=vegetableSeed?(direct?'trueLeaves':'transplant'):'sow';
    const notes=[methods?`Burpee sowing method: ${methods.toLowerCase()}.`:'Sowing method is not listed; use the seed packet.',
      !profile?'Initial sowing and planting-out dates are editable planning placeholders around your frost date, not cultivar-specific packet instructions.':'Adjust planting dates to your packet and growing conditions.',
      basis==='trueLeaves'&&days?'Burpee’s direct-sown vegetable maturity counts from several true leaves; the editable 14-day allowance is an estimate.':'',
      kind==='Herb'&&days?'The sowing-based maturity anchor is an editable planning assumption; check your packet.':'',
      flower?(facts.lifecycle==='Annual'?'Bloom season is a seasonal expectation, not a sow-to-bloom countdown.':'Bloom season describes established plants. Seed-grown perennials may need additional seasons; check packet pretreatment instructions.'):'',
      row.category==='Perennials'&&facts.lifecycle==='Annual'?'Burpee places this product under Perennials but labels its lifecycle Annual. Check the seed packet for how it grows in your conditions.':'',
      !days&&!flower?'No maturity countdown is supplied. Enter a packet estimate when available.':'',
      'Check the packet for seed depth, germination conditions, thinning, and transplant readiness.'].filter(Boolean).join(' ');
    catalog[`burpee-${row.slug}`]={...names,...facts,kind,icon:flower?'flower':names.name==='Tomato'?'tomato':'leaf',weeks,offset,days,basis,defaultMethod,season:flower?row.attributes['Bloom Season']||'':'',note:notes,sources:[url,...(vegetableSeed?[maturitySource]:[])]};
    if(match?.[2]&&!flower)catalog[`burpee-${row.slug}`].daysMax=Number(match[2]);
  }
  return catalog;
}
