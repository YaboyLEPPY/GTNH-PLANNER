import type {Goods,Recipe} from './types';
const cache=new Map<string,Promise<unknown>>();
export function load<T>(path:string):Promise<T>{
 if(!cache.has(path))cache.set(path,fetch(`/data/${path}`).then(r=>{if(!r.ok)throw new Error(`Could not load ${path} (${r.status}). Run npm run data:import if data is missing.`);return r.json()}).catch(e=>{cache.delete(path);throw e}));
 return cache.get(path) as Promise<T>;
}
let catalog:Promise<Goods[]>|undefined;
export function getCatalog(){return catalog??=load<Goods[]>('catalog.json').catch(e=>{catalog=undefined;throw e})}
export async function getRecipes(g:Goods){return g.recipes?load<Recipe[]>(`recipes/${g.shard.slice(0,2)}/${g.shard}.json`):[]}
export const plain=(s:string)=>s.replace(/§./g,'');
export function format(n:number){return Number.isInteger(n)?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:3})}
