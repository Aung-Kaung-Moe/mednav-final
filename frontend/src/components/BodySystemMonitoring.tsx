import {LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer} from 'recharts';
import type {Crew} from '../data/fixtures';
import {bodyRegion, orderedRecords, visualSymptoms} from '../data/bodyMonitoring';
import type {SavedCheckIn} from '../types/api';
import {BODY_SYSTEMS,reportedEvidence,systemEvidence} from '../data/bodyGraph';
import {baselineDifference} from '../data/missionMonitoring';

type Props = {
  part: string; crew: Crew; records: SavedCheckIn[];
  loading: boolean; error: string; onInvestigate: () => void; replaying?:boolean;
};
const timestamp = (value: string) => new Date(value).toISOString().replace('T',' ').replace('.000Z','Z');
const shown = (value: number|string|null|undefined, unit='') => value == null ? 'Unknown' : `${value}${unit}`;

export function BodySystemMonitoring({part,crew,records,loading,error,onInvestigate,replaying=false}: Props) {
  const region = bodyRegion(part);
  if(!region) return null;
  // Defense in depth: never display a different astronaut's rows, even during transitions.
  let rows: SavedCheckIn[];
  try { rows = orderedRecords(records,crew.id); }
  catch { return <p role="alert">History unavailable: crew or timestamp mismatch.</p>; }
  if(loading) return <p role="status" className="selected-desc">Loading recorded observations for {crew.id}…</p>;
  if(error) return <p role="alert" className="selected-desc">History unavailable: {error}</p>;
  const latest=rows.at(-1), recent=rows.slice(-7);
  const label=BODY_SYSTEMS.find(s=>s.id===region)!.label;
  const evidence=systemEvidence(region,latest,crew);
  const reports=rows.filter(r=>reportedEvidence(region,r).length>0);
  const lastEvidence=[...rows].reverse().find(r=>systemEvidence(region,r,crew).state.recorded);
  const field=region==='heart'?'hr':'sleep';
  const unit=region==='heart'?' bpm':' h';
  const baseline=region==='heart'?crew.baseline:crew.sleepBaseline;
  const observed=recent.filter(r=>r[field]!==null).length;
  const ocularReports=rows.filter(r=>visualSymptoms(r).length>0);
  const lastOcular=ocularReports.at(-1);
  const lastBp=[...rows].reverse().find(r=>r.bp!==null);
  return <div data-testid="body-monitoring" data-crew={crew.id} data-region={region} data-record-id={latest?.id??''}>
    <p className="selected-desc">{region==='heart'?'Cardiovascular monitoring':region==='brain'?'Sleep and neurological observations':label}</p>
    {!['heart','brain','eyes'].includes(region) ? <>
      <p className="selected-desc">Recorded reports in this check-in: {evidence.reports.join(', ')||'No matching reports. This does not establish absence of symptoms.'}</p>
      <p className="selected-desc unknown-val">Missing measurements: {evidence.missing.join(' · ')}. Not recorded in the current backend.</p>
      {region==='muscles'&&<p className="part-note">Existing exercise/ARED values are illustrative; no persisted activity-log API is available. They are excluded from this evidence panel.</p>}
      <details><summary className="sheet-footnote">Historical reported evidence through this observation</summary>
       {reports.slice(-7).map(r=><p className="selected-desc" key={r.id}>{r.recorded_at} · {reportedEvidence(region,r).join(', ')}<br/>{r.provenance} · {r.id}</p>)}
       {!reports.length&&<p>No matching reports recorded in available history.</p>}
      </details>
    </> : region==='eyes' ? <>
      <div className="selected-metric"><span>Ocular measurement</span><strong className="unknown-val">Unknown</strong></div>
      <p className="selected-desc">Ocular assessment not recorded in the current backend.</p>
      <p className="selected-desc">{lastOcular ? `Latest visual symptom report: ${visualSymptoms(lastOcular).join(', ')} · ${timestamp(lastOcular.recorded_at)}` : 'No visual symptoms recorded in available check-ins. This does not establish absence of symptoms.'}</p>
      {lastOcular&&<p className="part-note">Report source: {lastOcular.provenance} · {lastOcular.id}</p>}
      {ocularReports.length>0&&<details><summary className="sheet-footnote">Recorded visual symptom reports ({ocularReports.length})</summary>
        {ocularReports.map(r=><p className="selected-desc" key={r.id}><time dateTime={r.recorded_at}>{timestamp(r.recorded_at)}</time> · {visualSymptoms(r).join(', ')}<br/>{r.provenance} · {r.id}</p>)}
      </details>}
    </> : <>
      <div className="selected-metric"><span>{replaying?'Replay':'Latest'} {region==='heart'?'heart rate':'sleep'}</span><strong className={latest?.[field]==null?'unknown-val':''}>{shown(latest?.[field],unit)}</strong></div>
      <p className="selected-desc">Recorded personal baseline: {shown(baseline,unit)} · Difference: {baselineDifference(latest?.[field]??null,baseline)}{unit} (descriptive)</p>
      {region==='heart' ? <>
        <p className="selected-desc">{replaying?'Replay':'Latest'} check-in BP: <span className={latest?.bp==null?'unknown-val':''}>{shown(latest?.bp,' mmHg')}</span></p>
        {lastBp && lastBp.id!==latest?.id && <p className="selected-desc">Previous recorded BP: {lastBp.bp} mmHg · {timestamp(lastBp.recorded_at)} (not a current measurement)</p>}
      </> : <p className="selected-desc">{replaying?'Replay':'Latest'} reported symptoms: {latest?.symptoms.join(', ') || (latest?'None reported':'Unknown — no check-in')}</p>}
      <p className="sheet-footnote">{recent.length} most recent recorded observations · not continuous calendar days.</p>
      {observed>=2 ? <div role="img" aria-label={`${crew.id} recorded ${field==='hr'?'heart rate':'sleep'} observations; full values and timestamps below`}>
        <ResponsiveContainer width="100%" height={125}>
          <LineChart data={recent.map((r,i)=>({...r,observation:i+1}))} margin={{top:8,right:8,bottom:0,left:-18}}>
            <XAxis dataKey="observation" tick={{fontSize:10,fill:'#b8c4d0'}} allowDecimals={false} />
            <YAxis tick={{fontSize:10,fill:'#b8c4d0'}} width={48} domain={['auto','auto']} unit={field==='hr'?'':'h'} />
            <Tooltip content={({active,payload})=>{const row=payload?.[0]?.payload as SavedCheckIn|undefined;return active&&row?<div className="command-card">{timestamp(row.recorded_at)}<br/>{shown(row[field],unit)}</div>:null;}} />
            <ReferenceLine y={baseline} stroke="#b8c4d0" strokeDasharray="3 3" ifOverflow="extendDomain" />
            <Line type="linear" dataKey={field} stroke="#5B9BD5" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
        <p className="sheet-footnote">X: observation number · Y: {field==='hr'?'bpm':'hours'} · dashed: personal baseline. Unknown values leave gaps.</p>
      </div> : <p className="selected-desc">Fewer than two available measurements; no trend shown.</p>}
      <details><summary className="sheet-footnote">Observation values, timestamps and sources</summary>
        {recent.map((r,i)=><p className="selected-desc" key={r.id}>{i+1}. <time dateTime={r.recorded_at}>{timestamp(r.recorded_at)}</time> · {shown(r[field],unit)}{region==='heart'?` · BP ${shown(r.bp,' mmHg')}`:` · Symptoms: ${r.symptoms.join(', ')||'None reported'}`}<br/>{r.provenance} · {r.id}</p>)}
      </details>
    </>}
    <p className="part-note">{latest ? <span>{replaying?'Replay':'Latest'} check-in: <time dateTime={latest.recorded_at}>{timestamp(latest.recorded_at)}</time><br/>Source: {latest.provenance} · {latest.id}</span> : 'No saved check-in available for this astronaut.'}</p>
    <p className="part-note">Last relevant recorded evidence: {lastEvidence?`${lastEvidence.recorded_at} · ${lastEvidence.id}`:'Unknown - no relevant record'}. Keyword matching displays original report text, including negation; it is not a clinical finding.</p>
    <p className="part-note">Synthetic SQLite records · {crew.id}. {region==='brain'?'Sleep duration is not a direct neurological measurement.':region==='heart'?'Baseline differences are descriptive, not a risk score.':region==='eyes'?'Symptom reports are not a verified ocular examination.':'Symptom reports are not verified system measurements.'} No diagnosis or organ-health assessment.</p>
    <button type="button" className="mini-action-link" disabled={!latest} onClick={onInvestigate}>Open Investigation</button>
  </div>;
}
