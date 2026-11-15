import {useEffect,useState} from 'react';
import {BODY_SYSTEMS,evidenceLabels,systemEvidence,regionForPart} from '../data/bodyGraph';
import {baselineDifference} from '../data/missionMonitoring';
import type {Crew} from '../data/fixtures';
import type {SavedCheckIn,FollowUpEvent} from '../types/api';
import {loadFollowUps} from '../api';

type Props={crew:Crew;records:SavedCheckIn[];history:SavedCheckIn[];record?:SavedCheckIn;replaying:boolean;part:string;loading:boolean;error:string;onReplay:(id:string|null)=>void;onPart:(part:string)=>void;onInvestigate:(id:string)=>void};
export function BodyGraphNavigator({crew,records,history,record,replaying,part,loading,error,onReplay,onPart,onInvestigate}:Props){
 const [open,setOpen]=useState(false);
 const [follow,setFollow]=useState<{key:string;rows:FollowUpEvent[];error:string;loading:boolean}>({key:'',rows:[],error:'',loading:false});
 const key=`${crew.id}:${record?.id??''}`;
 useEffect(()=>{if(!open||!record)return;let active=true;setFollow({key,rows:[],error:'',loading:true});
  loadFollowUps(crew.id,record.id).then(rows=>{if(active)setFollow({key,rows,error:'',loading:false})}).catch(e=>{if(active)setFollow({key,rows:[],error:e.message,loading:false})});return()=>{active=false};
 },[key,open,crew.id,record?.id]);
 return <section className="bodygraph-navigator" aria-label="BodyGraph evidence navigator" data-crew={crew.id} data-check-in-id={record?.id??''}>
  <label className="sheet-footnote">Mission replay<select aria-label="Mission replay" disabled={loading||!records.length} value={replaying?record?.id??'':'latest'} onChange={e=>onReplay(e.target.value==='latest'?null:e.target.value)}>
   <option value="latest">Latest recorded observation</option>{records.map(r=><option value={r.id} key={r.id}>{r.recorded_at} · {r.id}</option>)}
  </select></label>
  <button className="mini-action-link" type="button" disabled={!replaying} onClick={()=>onReplay(null)}>Return to latest observation</button>
  <p className="part-note">{record?`${replaying?'REPLAY':'LATEST'} · ${crew.id} · ${record.recorded_at} · ${record.id}`:'No saved observation available.'}</p>
  {loading&&<p role="status">Loading BodyGraph evidence…</p>}{error&&<p>{error}</p>}
  <div className="bodygraph-system-list" role="group" aria-label="Body-system evidence map">
   {BODY_SYSTEMS.map(system=>{const {state}=systemEvidence(system.id,record,crew);return <button key={system.id} type="button" className="hairline-pill-btn" aria-pressed={regionForPart(part)===system.id} aria-label={`Select ${system.label}`} title={evidenceLabels(state).join(' · ')} onClick={()=>onPart(system.part)}>
    {system.short}<span className="bodygraph-evidence-marks" aria-label={evidenceLabels(state).join('; ')}>{state.recorded&&<i className="evidence-recorded">●</i>}{state.changed&&<i className="evidence-change">◇</i>}{state.missing&&<i className="evidence-missing">?</i>}{state.review&&<i className="evidence-review">↗</i>}</span>
   </button>})}
  </div>
  <p className="sheet-footnote" aria-label="Evidence map legend">● Recorded evidence · ◇ Descriptive baseline change · ? Missing evidence · ↗ Review available</p>
  <p className="part-note">States can coexist. They describe saved evidence, not risk, disease or medical approval. Review available means a saved check-in can open the existing engine workflow. Region labels work even when a loaded model has no matching mesh.</p>
  <details><summary className="sheet-footnote">Cross-system observations · same replay window</summary>
   <p className="part-note">Up to seven recorded observations through this check-in, without interpolation. Co-occurrence does not establish causation or a clinical interaction.</p>
   <ol aria-label="Cross-system recorded observations">{history.slice(-7).map(r=><li className="selected-desc" key={r.id}>
    <time dateTime={r.recorded_at}>{r.recorded_at}</time> · {r.id}<br/>
    HR: {r.hr??'Unknown'}{r.hr!==null?' bpm':''} (baseline difference {baselineDifference(r.hr,crew.baseline)} bpm) · Sleep: {r.sleep??'Unknown'}{r.sleep!==null?' h':''} (baseline difference {baselineDifference(r.sleep,crew.sleepBaseline)} h) · BP: {r.bp??'Unknown'}<br/>
    Reported symptoms: {r.symptoms.join(', ')||'None reported'}<br/>Source: {r.provenance} · Synthetic
   </li>)}</ol>
  </details>
  <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="sheet-footnote">Recorded follow-up for this check-in</summary>
   <p className="part-note">User-recorded workflow events, not medical approval. No event is saved by replaying or viewing this panel.</p>
   {(follow.key!==key||follow.loading)&&open&&record&&<p role="status">Loading recorded follow-up…</p>}
   {follow.key===key&&follow.error&&<p role="alert">{follow.error}</p>}
   {follow.key===key&&!follow.loading&&!follow.error&&<ul>{follow.rows.length?follow.rows.slice(-5).map(event=><li className="part-note" key={event.id}>{event.event_type} · {event.recorded_at} · {event.note??'No note recorded'} · {event.provenance}</li>):<li className="part-note">No follow-up events recorded for this check-in.</li>}</ul>}
   <p className="part-note">Most recent five events. Open Investigation to view all or explicitly record a follow-up.</p>
  </details>
  <button type="button" className="mini-action-link" disabled={!record||loading||!!error} onClick={()=>record&&onInvestigate(record.id)}>Investigate replay observation</button>
 </section>;
}
