import {useEffect,useState} from 'react';
import {createFollowUp,loadFollowUps} from '../api';
import type {FollowUpEvent,FollowUpType} from '../types/api';

export function FollowUpPanel({crewId,checkInId}:{crewId:string;checkInId:string}){
 const [rows,setRows]=useState<FollowUpEvent[]>([]),[note,setNote]=useState('');
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [revision,setRevision]=useState(0),[allCrew,setAllCrew]=useState(false),[saved,setSaved]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setRows([]);setError('');
  loadFollowUps(crewId,allCrew?undefined:checkInId).then(events=>{if(active)setRows(events)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[crewId,checkInId,revision,allCrew]);
 async function record(eventType:FollowUpType){
  if(eventType==='note_recorded'&&!note.trim()){setError('Enter a follow-up note before recording.');return;}
  setSaving(true);setError('');setSaved('');
  try{const event=await createFollowUp({astronaut_id:crewId,check_in_id:checkInId,event_type:eventType,note:note.trim()||null});setNote('');setSaved(`Saved ${event.event_type} · ${event.id}`);setRevision(r=>r+1);}
  catch(e){setError((e as Error).message)}finally{setSaving(false)}
 }
 return <section className="orbital-trend-card" aria-label="Follow-up tracking">
  <header className="trend-card-head"><h2>Follow-Up Record</h2><button type="button" className="mini-action-link" disabled={loading||saving} onClick={()=>setRevision(r=>r+1)}>View Follow-Up History</button></header>
  <p className="selected-desc">{crewId} · Saved check-in {checkInId}</p>
  <p className="sheet-footnote">User-recorded workflow documentation only. Events do not prove treatment, resolution, medical-officer approval or Earth synchronization. Incident reports remain session previews.</p>
  <label className="selected-desc">Follow-up note (optional for review/action)<input aria-label="Follow-up note" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} disabled={saving}/></label>
  <div className="trend-mode-pills">
   <button type="button" className="hairline-pill-btn" disabled={saving} onClick={()=>void record('note_recorded')}>Record Follow-Up Note</button>
   <button type="button" className="hairline-pill-btn" disabled={saving} onClick={()=>void record('review_requested')}>Mark Review Requested</button>
   <button type="button" className="hairline-pill-btn" disabled={saving} onClick={()=>void record('action_recorded')}>Record Action</button>
  </div>
  <p className="selected-desc"><label><input type="checkbox" checked={allCrew} onChange={e=>setAllCrew(e.target.checked)}/> View all follow-up events for {crewId}</label></p>
  {saving&&<p role="status">Saving follow-up event…</p>}{loading&&<p role="status">Loading follow-up history…</p>}
  {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}
  {!loading&&!error&&<ol aria-label="Recorded follow-up events">{rows.length?rows.map(event=><li key={event.id} className="selected-desc"><strong>{event.event_type}</strong> · <time dateTime={event.recorded_at}>{new Date(event.recorded_at).toISOString()}</time><br/>{event.note??'No note recorded'}<br/>{event.astronaut_id} · {event.check_in_id}<br/><span className="sheet-footnote">{event.provenance} · {event.id}</span></li>):<li>No follow-up events recorded for this selection.</li>}</ol>}
 </section>;
}
