import {useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,ReferenceLine} from 'recharts';
import type {Crew} from '../data/fixtures';
import type {SavedCheckIn} from '../types/api';
import {orderedRecords,visualSymptoms} from '../data/bodyMonitoring';
import {baselineDifference,completeness} from '../data/missionMonitoring';

type Props={crew:Crew;records:SavedCheckIn[];loading:boolean;error:string;onRegion:(region:string,id?:string)=>void;onReplay?:(id:string)=>void;onInvestigate:(id:string)=>void};
const show=(v:number|string|null|undefined,unit='')=>v==null?'Unknown':`${v}${unit}`;
const date=(stamp:string)=>new Date(stamp).toISOString().replace('T',' ');
export function MissionHealthTimeline({crew,records,loading,error,onRegion,onReplay,onInvestigate}:Props){
 const [filter,setFilter]=useState<'hr'|'sleep'|'symptoms'>('hr');
 const [limit,setLimit]=useState(7),[selectedId,setSelectedId]=useState('');
 if(loading)return <p role="status">Loading recorded health timeline…</p>;
 if(error)return <p role="alert">Health timeline unavailable: {error}</p>;
 const all=orderedRecords(records,crew.id),rows=all.slice(-limit),latest=all.at(-1);
 const selected=rows.find(r=>r.id===selectedId)??rows.at(-1);
 const baseline=filter==='sleep'?crew.sleepBaseline:crew.baseline;
 const field=filter==='sleep'?'sleep':'hr';
 const count=completeness(rows),numeric=rows.filter(r=>r[field]!==null).length;
 return <section aria-label="Mission health timeline" data-crew={crew.id}>
   <h3>Mission Health Timeline</h3>
   <div aria-label="Recorded health summary" className="selected-desc">
     <p>Latest HR: {show(latest?.hr,' bpm')} · baseline {crew.baseline} bpm · difference {baselineDifference(latest?.hr??null,crew.baseline)} bpm</p>
     <p>Latest sleep: {show(latest?.sleep,' h')} · baseline {crew.sleepBaseline} h · difference {baselineDifference(latest?.sleep??null,crew.sleepBaseline)} h</p>
     <p>Latest BP: {show(latest?.bp,' mmHg')} · Missing: {latest?[(latest.hr===null?'HR':null),(latest.sleep===null?'Sleep':null),(latest.bp===null?'BP':null)].filter(Boolean).join(', ')||'None in HR/Sleep/BP':'Unknown — no saved check-in'}</p>
     <p>Latest check-in: {latest?date(latest.recorded_at):'Unknown'} · {all.length} available observations · {crew.id}</p>
     <p>Reported symptoms: {latest?.symptoms.join(', ')||(latest?'None reported':'Unknown')}</p>
   </div>
   <div className="trend-mode-pills" role="group" aria-label="Timeline filter">
    {(['hr','sleep','symptoms'] as const).map(f=><button key={f} className={`hairline-pill-btn ${filter===f?'active':''}`} type="button" aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='hr'?'Heart Rate':f==='sleep'?'Sleep':'Symptoms'}</button>)}
    <label className="sheet-footnote">Observation window <select aria-label="Observation window" value={limit} onChange={e=>setLimit(Number(e.target.value))}><option value={7}>Last 7 Recorded Observations</option><option value={30}>Last 30 Recorded Observations</option></select></label>
   </div>
   <p className="sheet-footnote">Last {limit} Recorded Observations · {rows.length} available · not continuous calendar days. Data completeness: {count.recorded}/{count.slots} HR/Sleep/BP measurement slots. Synthetic SQLite history.</p>
   {filter!=='symptoms'&&(numeric>=2?<div role="img" aria-label={`${crew.id} ${filter==='hr'?'heart-rate':'sleep-duration'} recorded trend`}>
    <ResponsiveContainer width="100%" height={180}><LineChart data={rows.map((r,i)=>({...r,observation:i+1}))} margin={{left:0,right:16,top:8,bottom:0}}>
     <XAxis dataKey="observation" allowDecimals={false} tick={{fill:'#A1A1AA',fontSize:11}}/>
     <YAxis domain={['auto','auto']} tick={{fill:'#A1A1AA',fontSize:11}}/>
     <Tooltip content={({active,payload})=>{const r=payload?.[0]?.payload as SavedCheckIn|undefined;return active&&r?<div className="command-card">{date(r.recorded_at)}<br/>{show(r[field],filter==='hr'?' bpm':' h')}</div>:null;}}/>
     <ReferenceLine y={baseline} stroke="#b8c4d0" strokeDasharray="3 3" ifOverflow="extendDomain"/>
     <Line dataKey={field} type="linear" stroke="#5B9BD5" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false}/>
    </LineChart></ResponsiveContainer>
    <p className="sheet-footnote">X: observation number · Y: {filter==='hr'?'bpm':'hours'} · dashed: personal baseline. Unknown readings leave gaps.</p>
   </div>:<p className="selected-desc">Insufficient recorded observations for trend comparison.</p>)}
   <ol aria-label="Saved health observations">
    {rows.map((r,i)=><li key={r.id}><button className="mini-action-link" type="button" aria-pressed={selected?.id===r.id} aria-label={`Inspect observation ${r.id}`} onClick={()=>setSelectedId(r.id)}>{i+1}. <time dateTime={r.recorded_at}>{date(r.recorded_at)}</time> · {filter==='symptoms'?(r.symptoms.join(', ')||'None reported'):show(r[field],filter==='hr'?' bpm':' h')}</button></li>)}
   </ol>
   {selected?<div aria-label="Selected timeline observation" className="selected-desc">
    <p>{crew.id} · {selected.id} · <time dateTime={selected.recorded_at}>{date(selected.recorded_at)}</time></p>
    <p>HR {show(selected.hr,' bpm')} · Sleep {show(selected.sleep,' h')} · BP {show(selected.bp,' mmHg')}</p>
    <p>Symptoms: {selected.symptoms.join(', ')||'None reported'}</p>
    <p>Source: {selected.provenance} · Synthetic</p>
    <div className="trend-mode-pills">
     {onReplay&&<button className="hairline-pill-btn" type="button" onClick={()=>onReplay(selected.id)}>Replay on BodyGraph</button>}
     <button className="hairline-pill-btn" type="button" onClick={()=>onRegion('heart',selected.id)}>Open Heart Monitoring</button>
     <button className="hairline-pill-btn" type="button" onClick={()=>onRegion('brain',selected.id)}>Open Brain/Sleep Monitoring</button>
     <button className="hairline-pill-btn" type="button" onClick={()=>onRegion('eye_l',selected.id)}>Open Eye Evidence</button>
     <button className="hairline-pill-btn" type="button" onClick={()=>onInvestigate(selected.id)}>Investigate Selected Observation</button>
    </div>
    {visualSymptoms(selected).length>0&&<p>Recorded visual symptoms: {visualSymptoms(selected).join(', ')}</p>}
    <p className="sheet-footnote">BodyGraph replay shows the exact selected record; return to latest for current monitoring. Investigation evaluates the exact selected ID above. Differences from baseline describe observations, not diagnoses.</p>
   </div>:<p>No saved check-in available.</p>}
 </section>;
}
