import { useEffect,useState } from 'react';
import { load, plain } from '../data';
import type { Goods,SourceItem } from '../types';
export function useData<T>(path:string){const [data,setData]=useState<T>(),[error,setError]=useState('');useEffect(()=>{let active=true;setData(undefined);setError('');load<T>(path).then(d=>active&&setData(d)).catch(e=>active&&setError(e.message));return()=>{active=false}},[path]);return {data,error}}
export function Icon({goods,item,size=32}:{goods?:Goods;item?:SourceItem;size?:number}){const g=goods||item?.resolved;return g?<img className="item-icon" src={`/assets/items/${g.icon}.webp`} width={size} height={size} alt="" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>:<span className="unknown-icon" style={{width:size,height:size}} title="No verified source icon">?</span>}
export function RichText({text}:{text:string}){return <div className="rich-text">{plain(text).split(/(https?:\/\/[^\s<>]+)/g).map((s,i)=>s.match(/^https?:/)?<a key={i} href={s} target="_blank" rel="noreferrer">{s}</a>:<span key={i}>{s}</span>)}</div>}
export function ErrorBox({message}:{message:string}){return <div className="error" role="alert">{message}<button onClick={()=>location.reload()}>Retry</button></div>}
export function Empty({title,children}:{title:string;children:React.ReactNode}){return <div className="empty"><h3>{title}</h3><p>{children}</p></div>}
