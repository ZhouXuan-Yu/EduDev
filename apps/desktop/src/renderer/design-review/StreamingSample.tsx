import {useEffect,useState} from 'react';

/** Authored review text, never presented as a provider event or private reasoning. */
export function StreamingSample({text,active,onComplete}:{text:string;active:boolean;onComplete?:()=>void}) {
 const [chars,setChars]=useState(0);
 useEffect(()=>{
  if(!active)return;
  const timer=setInterval(()=>setChars(n=>Math.min(text.length,n+3)),24);
  return()=>clearInterval(timer);
 },[active,text]);
 useEffect(()=>{if(chars===text.length)onComplete?.();},[chars,text,onComplete]);
 return <div data-testid="sample-text-stream" data-streaming={active&&chars<text.length}>
   {text.slice(0,chars).split('\n\n').filter(Boolean).map((paragraph,i)=><p key={i}>{paragraph}</p>)}
 </div>;
}
