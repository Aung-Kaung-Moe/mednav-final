import {crews, equipment, type Crew, type Equipment} from './data/fixtures';
import {useEffect, useRef, useState} from 'react';
import type {ScenarioResponse} from './types/scenario';
import {displayProfile,type AstronautDTO,type SavedCheckIn as Saved,type EngineResponse} from './types/api';
export const API = (import.meta as unknown as {env:Record<string,string>}).env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
async function request<T>(path:string, method='GET', body?:unknown):Promise<T>{
  let response:Response;
  try { response=await fetch(API+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)}); }
  catch { throw new Error('Backend unavailable. Start FastAPI or explicitly select local fixture mode.'); }
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:`API ${response.status}: invalid request`);
  return data;
}
export async function loadHistory(crewId:string,readPage=request<Saved[]>):Promise<Saved[]> {
 const rows:Saved[]=[];
 for(let offset=0;;offset+=1000){
  const page=await readPage(`/astronauts/${encodeURIComponent(crewId)}/history?limit=1000&offset=${offset}`);
  if(page.some(r=>r.astronaut_id!==crewId))throw new Error('History response does not match selected crew.');
  rows.push(...page);if(page.length<1000)return rows;
 }
}
export function useBackend(crewId:string){
 const live=new URLSearchParams(location.search).get('mode')!=='fixture';
 const [profiles,setProfiles]=useState(crews),[inventory,setInventory]=useState(equipment),[flags,setFlags]=useState([false,false,false,false]);
 const [result,setResult]=useState<ScenarioResponse|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(!live),[revision,setRevision]=useState(0),[history,setHistory]=useState<Record<string,unknown>[]>([]),[savedId,setSavedId]=useState('');
 const [initialized,setInitialized]=useState(!live),[resultCrew,setResultCrew]=useState(''),[record,setRecord]=useState<Saved|null>(null),[pendingWrites,setPendingWrites]=useState(0),[writeError,setWriteError]=useState('');
 const writes=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{if(!live||pendingWrites)return;let active=true;setReady(false);setResult(null);
 Promise.all([request<AstronautDTO[]>('/astronauts'),request<Equipment[]>('/inventory')]).then(([people,items])=>{if(!active)return;if(!people.length)throw new Error('No synthetic astronaut profiles available. Import demo data before check-in.');setProfiles(people.map(p=>displayProfile(p,crews)));setInventory(items);setFlags(f=>[items.some(i=>i.name==='Blood-pressure monitor'&&i.available&&i.quantity>0),f[1],f[2],f[3]]);setInitialized(true);setReady(true);setError('');}).catch(e=>active&&setError(e.message));return()=>{active=false};},[live,revision,pendingWrites]);
 useEffect(()=>{if(!live||!ready||pendingWrites)return;let active=true;setBusy(true);setResult(null);setSavedId('');setRecord(null);
 loadHistory(crewId).then(async rows=>{if(!active)return;const latest=rows.at(-1);if(!latest)throw new Error('Save a check-in before investigation.');setSavedId(latest.id);setRecord(latest);setHistory(rows.map(r=>({day:r.recorded_at.slice(0,10),recorded_at:r.recorded_at,[crewId.slice(-1).toLowerCase()]:r.hr,['s'+crewId.slice(-1).toLowerCase()]:r.sleep})));const response=await request<EngineResponse>('/investigations/evaluate','POST',{check_in_id:latest.id,communication_status:flags[2]?'online':'offline',emergency_override:flags[3]});if(active){setResultCrew(crewId);setResult(response);setError('');}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setBusy(false));return()=>{active=false};},[live,ready,crewId,revision,flags[0],flags[2],flags[3],pendingWrites]);
 async function save(c:Crew){if(!live){setProfiles(p=>p.map(x=>x.id===c.id?c:x));return;}setResult(null);setError('');const record=await request<Saved>('/check-ins','POST',{astronaut_id:c.id,hr:c.hr,sleep:c.sleep,bp:c.bp,symptoms:c.symptoms});setSavedId(record.id);setRevision(r=>r+1);}
 async function updateInventory(name:string,available:boolean){if(!live){setInventory(v=>v.map(x=>x.name===name?{...x,available}:x));setFlags(f=>[name==='Blood-pressure monitor'?available:f[0],f[1],f[2],f[3]]);return;}setPendingWrites(n=>n+1);setWriteError('');setBusy(true);setResult(null);const task=writes.current.then(async()=>{await request(`/inventory/${encodeURIComponent(name)}`,'PATCH',{available});});writes.current=task.catch(()=>{});try{await task;setRevision(r=>r+1);}catch(e){setWriteError((e as Error).message);}finally{setPendingWrites(n=>n-1);setBusy(false);}}
 function changeFlags(next:boolean[]){
  if(!live){setFlags(next);return;}
  // BP-record state (index 1) is read-only in live mode. A no-op must
  // retain its current result: no effect dependency would trigger evaluation.
  if(next[0]===flags[0]&&next[2]===flags[2]&&next[3]===flags[3])return;
  setBusy(true);setError('');setResult(null);
  if(next[0]!==flags[0])void updateInventory('Blood-pressure monitor',next[0]);
  setFlags(f=>[f[0],f[1],next[2],next[3]]);
 }
 const shownFlags=live?[flags[0],profiles.find(p=>p.id===crewId)?.bp!=null,flags[2],flags[3]]:flags;
 const current=resultCrew===crewId&&!pendingWrites?result:null;
 return {live,profiles,inventory,flags:shownFlags,result:current,error:writeError||error,busy:busy||pendingWrites>0,ready,initialized,history,record:record?.astronaut_id===crewId?record:null,savedId:record?.astronaut_id===crewId?savedId:'',save,updateInventory,changeFlags,retry:()=>{setWriteError('');setRevision(r=>r+1)}};
}
