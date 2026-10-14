export interface Goods { id:string; name:string; mod:string; registry:string; icon:number; nbt:string|null; kind:'item'|'fluid'; unit:string; damage:number; shard:string; recipes:number }
export interface SourceItem { id?:string; Count?:number; Damage?:number; FluidName?:string; Amount?:number; label?:string; resolved?:Goods|null; [key:string]:unknown }
export interface QuestNode {id:string;name:string;icon:SourceItem; prerequisites:string[];x:number;y:number;width:number;height:number;generated?:boolean}
export interface ChapterSummary {id:string;name:string;description:string;icon?:SourceItem;count:number;generated:boolean}
export interface Chapter extends ChapterSummary {nodes:QuestNode[]}
export interface Quest {id:string;name:string;description:string;icon:SourceItem;prerequisites:string[];tasks:Record<string,Record<string,unknown>>;rewards:Record<string,Record<string,unknown>>;properties:Record<string,unknown>;raw:unknown;source:string}
export interface BookIndex {chapters:ChapterSummary[];stats:Record<string,number>;questVersion:string;recipeVersion:string;enderIO:{quest:string;id:string;chapters:string[]}[]}
export interface SearchEntry {id:string;name:string;chapters:{id:string;name:string}[];text:string}
export interface RecipeIO {id:string;amount:number;chance:number;slot:number;alternatives?:string[]}
export interface Recipe {id:string;machine:string;inputs:RecipeIO[];outputs:RecipeIO[];tier:number;voltage:number;ticks:number|null;metadata:{key:string;value:number}[];special:number;machines:string[]}
