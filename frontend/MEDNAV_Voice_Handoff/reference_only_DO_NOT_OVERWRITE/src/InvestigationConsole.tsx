import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, BarChart3, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, ClipboardList, Clock3, Database, Download, FileText,
  HeartPulse, Info, LockKeyhole, Moon, Package, Radar, RotateCcw, Search, Shield,
  ShieldCheck, Sparkles, Stethoscope, UserRound, UsersRound, WifiOff,
} from 'lucide-react'
import { apiFor } from './api'
import { defaultMeasurementsFor } from './demo'
import HealthTrends from './HealthTrends'
import type {
  Astronaut, CommunicationStatus, Equipment, HealthHistory, InvestigationRequest,
  InvestigationResponse, Measurements, UiMode,
} from './types'

const symptomOptions = [
  ['headache', 'Headache'], ['dizziness', 'Dizziness'], ['fatigue', 'Fatigue'],
  ['nausea', 'Nausea'], ['sleep_disturbance', 'Poor sleep'], ['muscle_discomfort', 'Muscle discomfort'],
] as const

const readingLabels: Record<keyof Measurements, string> = {
  resting_hr_bpm: 'Resting heart rate', sleep_hours: 'Sleep duration',
  systolic_bp_mm_hg: 'Systolic blood pressure', diastolic_bp_mm_hg: 'Diastolic blood pressure',
}

function MetricInput({ label, unit, value, hint, min, max, onChange }: {
  label: string; unit: string; value: number | null; hint?: string; min?: number; max?: number
  onChange: (v: number | null) => void
}) {
  return <label className="metric-field">
    <span className="field-label">{label}</span>
    <div className="metric-input-row">
      <input aria-label={label} type="number" inputMode="decimal" step="any" min={min} max={max}
        value={value ?? ''} onChange={e => onChange(e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
        placeholder="Unknown" />
      <span className="metric-unit">{unit}</span>
    </div>
    <button type="button" aria-pressed={value === null} className={`not-measured-toggle ${value === null ? "is-unknown" : ""}`} onClick={() => onChange(null)}>
      <span className="not-measured-dot" /> Not measured {value === null ? "· Unknown" : ""}
    </button>
    {hint && <span className="field-hint">{hint}</span>}
  </label>
}

function PanelHeading({ icon, number, title, aside }: { icon: ReactNode; number: string; title: string; aside?: ReactNode }) {
  return <div className="panel-heading">
    <div className="panel-title"><span className="section-icon">{icon}</span><span className="section-number">{number}</span><h2>{title}</h2></div>
    {aside}
  </div>
}

function FileChip({ children }: { children: ReactNode }) {
  return <span className="file-chip"><CheckCircle2 size={13} />{children}</span>
}

function StatCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub: string; tone?: string }) {
  return <div className={`stat-card ${tone || ''}`}>
    <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
    <div className="stat-value">{value}</div><div className="stat-sub">{sub}</div>
  </div>
}

function downloadReport(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'mednav-synthetic-investigation.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function InvestigationConsole({ selectedCrew, onCrewSelect }: { selectedCrew?: string; onCrewSelect?: (id: string) => void }) {
  const [mode, setMode] = useState<UiMode>('demo')
  const [observedAt, setObservedAt] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0,16)
  })
  const [savedReports, setSavedReports] = useState<Array<{id:string; savedAt:string; request:InvestigationRequest; response:InvestigationResponse}>>([])
  const [astronauts, setAstronauts] = useState<Astronaut[]>([])
  const [selectedId, setSelectedId] = useState('A01')
  const [health, setHealth] = useState<HealthHistory | null>(null)
  const [inventory, setInventory] = useState<Equipment[]>([])
  const [symptoms, setSymptoms] = useState<string[]>(['headache', 'dizziness'])
  const [customSymptom, setCustomSymptom] = useState('')
  const [measurements, setMeasurements] = useState<Measurements>(defaultMeasurementsFor('A01'))
  const [commStatus, setCommStatus] = useState<CommunicationStatus>('offline')
  const [emergency, setEmergency] = useState(false)
  const [restockDemo, setRestockDemo] = useState(false)
  const [result, setResult] = useState<InvestigationResponse | null>(null)
  const [lastRequest, setLastRequest] = useState<InvestigationRequest | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null); setResult(null); setReceipt(null); setRestockDemo(false)
    Promise.all([apiFor(mode).astronauts(), apiFor(mode).inventory()]).then(([crew, stock]) => {
      if (!active) return
      setAstronauts(crew); setInventory(stock)
      if (!crew.some(a => a.astronaut_id === selectedId)) {
        setSelectedId(crew[0]?.astronaut_id ?? '')
      }
    }).catch((err: unknown) => {
      if (!active) return
      setAstronauts([]); setInventory([])
      setError(err instanceof Error ? err.message : 'Unable to load MEDNAV data')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Selected id is only checked during mode switching; selection updates are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    let active = true
    setHealth(null)
    if (!selectedId) return
    apiFor(mode).health(selectedId).then(data => { if (active) setHealth(data) })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Could not load health baseline') })
    return () => { active = false }
  }, [selectedId, mode])

  const chosen = astronauts.find(p => p.astronaut_id === selectedId)
  const usableInventory = useMemo(() => inventory.map(item =>
    mode === 'demo' && restockDemo && item.equipment_id === 'bp_monitor'
      ? { ...item, quantity: 1, usable: true } : item
  ), [inventory, mode, restockDemo])
  const availableEquipment = useMemo(() => usableInventory
    .filter(item => item.usable && item.quantity > 0).map(item => item.equipment_id), [usableInventory])
  const currentMissing = (Object.keys(measurements) as Array<keyof Measurements>)
    .filter(k => measurements[k] === null)
  const displayMissing = result?.missing_data ?? currentMissing
  const missingCount = displayMissing.length
  const selectedProfileHr = health?.baseline.resting_hr_bpm ?? null
  const selectedProfileSleep = health?.baseline.sleep_hours ?? null
  const validMeasurements = (
    (measurements.resting_hr_bpm === null || (measurements.resting_hr_bpm > 0 && measurements.resting_hr_bpm <= 250)) &&
    (measurements.sleep_hours === null || (measurements.sleep_hours >= 0 && measurements.sleep_hours <= 24)) &&
    (measurements.systolic_bp_mm_hg === null || (measurements.systolic_bp_mm_hg > 0 && measurements.systolic_bp_mm_hg <= 300)) &&
    (measurements.diastolic_bp_mm_hg === null || (measurements.diastolic_bp_mm_hg > 0 && measurements.diastolic_bp_mm_hg <= 250))
  )
  // Voice assistant shares only confirmed, saved synthetic investigations.
  // No medical inference is performed here.
  useEffect(() => {
    const receive=(event:Event)=>{
      const data=(event as CustomEvent<{
        request:InvestigationRequest; response:InvestigationResponse; checkin_id:string; mode:UiMode
      }>).detail
      if(!data?.request||!data?.response)return
      setMode(data.mode);setSelectedId(data.request.astronaut_id)
      onCrewSelect?.(data.request.astronaut_id)
      setMeasurements(data.request.measurements);setSymptoms(data.request.symptoms)
      setLastRequest(data.request);setResult(data.response)
      setReceipt(data.checkin_id)
      setSavedReports(prev=>[{id:`VOICE-${data.checkin_id}`,savedAt:new Date().toISOString(),request:data.request,response:data.response},...prev].slice(0,10))
    }
    window.addEventListener('mednav:voice-investigation',receive)
    return()=>window.removeEventListener('mednav:voice-investigation',receive)
  },[onCrewSelect])
  const canAnalyze = Boolean(selectedId) && observedAt.length > 0 && !Number.isNaN(new Date(observedAt).getTime()) && validMeasurements && (symptoms.length > 0 || Object.values(measurements).some(v => v !== null) || emergency) && !busy && !loading

  function chooseCrew(id: string) {
    setSelectedId(id)
    onCrewSelect?.(id)
    setSymptoms(id === 'A01' ? ['headache', 'dizziness'] : [])
    setMeasurements(defaultMeasurementsFor(id))
    setCustomSymptom(''); setEmergency(false); setResult(null); setLastRequest(null); setReceipt(null); setSubmitError(null)
  }
  useEffect(() => {
    if (selectedCrew && selectedCrew !== selectedId) {
      setSelectedId(selectedCrew)
      setMeasurements(defaultMeasurementsFor(selectedCrew))
      setSymptoms(selectedCrew === 'A01' ? ['headache', 'dizziness'] : [])
      setResult(null); setReceipt(null); setLastRequest(null)
    }
  }, [selectedCrew, selectedId])

  function changeMeasurement(key: keyof Measurements, value: number | null) {
    setMeasurements(old => ({ ...old, [key]: value })); setResult(null); setReceipt(null)
  }
  function toggleSymptom(s: string) {
    setSymptoms(old => old.includes(s) ? old.filter(x => x !== s) : [...old, s]); setResult(null); setReceipt(null)
  }
  function resetForm() {
    setMeasurements({ resting_hr_bpm: null, sleep_hours: null, systolic_bp_mm_hg: null, diastolic_bp_mm_hg: null })
    setSymptoms([]); setCustomSymptom(''); setEmergency(false); setResult(null); setLastRequest(null); setReceipt(null); setSubmitError(null)
  }
  async function runInvestigation(event: FormEvent) {
    event.preventDefault()
    setSubmitError(null); setResult(null); setReceipt(null)
    if (!canAnalyze) { setSubmitError('Select a crew member and enter a valid symptom or measurement.'); return }
    const input: InvestigationRequest = {
      astronaut_id: selectedId,
      observed_at: new Date(observedAt).toISOString(),
      symptoms, measurements,
      personal_baseline: { resting_hr_bpm: selectedProfileHr, sleep_hours: selectedProfileSleep },
      available_equipment: availableEquipment,
      communication_status: commStatus,
      emergency_override: mode === 'demo' && emergency,
      dataset_type: 'synthetic',
    }
    setBusy(true)
    try {
      const client = apiFor(mode)
      const saved = await client.checkin({
        astronaut_id: input.astronaut_id, observed_at: input.observed_at,
        symptoms: input.symptoms, measurements: input.measurements, dataset_type: input.dataset_type,
      })
      if (!saved.saved) throw new Error('The API did not confirm the check-in was saved.')
      setReceipt(saved.checkin_id)
      const answer = await client.investigate(input)
      setLastRequest(input); setResult(answer)
      window.dispatchEvent(new CustomEvent('mednav:investigation-result',{detail:{request:input,response:answer,mode}}))
      setSavedReports(prev => [{ id:`LOCAL-${selectedId}-${Date.now()}`, savedAt:new Date().toISOString(), request:input, response:answer },...prev].slice(0,10))
      document.getElementById('investigation-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The investigation could not be completed')
    } finally { setBusy(false) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={24} strokeWidth={2.4} /></div><div><span className="brand-name">MEDNAV<span className="brand-dot">.</span></span><span className="brand-caption">MISSION HEALTH SYSTEM</span></div></div>
      <div className="side-group-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Section navigation">
        <a href="#investigation-form" className="side-link active"><Stethoscope size={18} />Health investigation<span className="side-indicator" /></a>
        <a href="#crew-overview" className="side-link"><UsersRound size={18} />Crew overview</a>
        <a href="#data-gaps" className="side-link"><Search size={18} />Missing data</a>
        <a href="#medical-inventory" className="side-link"><Package size={18} />Medical inventory</a>
        <a href="#investigation-result" className="side-link"><ClipboardList size={18} />Investigation result</a>
      </nav>
      <div className="sidebar-spacer" />
      <div className="side-mission">
        <div className="side-mission-top"><Radar size={16}/><span>ARES — 01</span></div>
        <strong>DEEP SPACE MISSION</strong>
        <p>Health investigation workspace</p>
        <div className="side-mission-divider" />
        <div className="side-mission-foot"><span className="tiny-pulse" />Local mission environment</div>
      </div>
      <div className="side-footer"><LockKeyhole size={14}/>PROTOTYPE • NO CLINICAL USE</div>
    </aside>

    <div className="app-body">
      <header className="topbar">
        <div className="breadcrumb"><span>Mission Health</span><span className="crumb-slash">/</span><strong>Health Investigation</strong></div>
        <div className="topbar-actions"><span className="mission-day"><Clock3 size={14}/> MISSION DAY 180</span><span className="topbar-avatar">MN</span></div>
      </header>

      <main className="main-content">
        <div className="page-intro">
          <div><div className="eyebrow"><span className="eyebrow-line" /> MEDICAL INTELLIGENCE PLATFORM / 01</div>
            <h1>Health <span>Investigation</span></h1>
            <p>Collect observations, identify information gaps, and review feasible next checks—without assuming a diagnosis.</p>
          </div>
          <div className="mode-switch" role="group" aria-label="Data connection mode">
            <button type="button" onClick={() => setMode('demo')} className={mode === 'demo' ? 'mode-active' : ''}>Demo data</button>
            <button type="button" onClick={() => setMode('api')} className={mode === 'api' ? 'mode-active' : ''}>Local API</button>
          </div>
        </div>

        <div className="notice-strip"><Info size={17}/><span><strong>SIMULATED MISSION.</strong> All crew records and demonstration findings are synthetic. This prototype does not diagnose, prescribe, or replace crew medical protocols.</span><span className="notice-version">API CONTRACT V1</span></div>
        {error && <div className="error-strip" role="alert"><AlertTriangle size={16}/>{error}{mode === 'api' && <span> — Start FastAPI at the URL in <code>.env</code> and enable CORS for the frontend origin.</span>}</div>}

        <section id="crew-overview" className="crew-overview">
          <div className="crew-title-row"><h2>Mission overview</h2><span><span className="green-dot" />{mode === 'demo' ? 'Offline demo ready' : 'Local API mode'}</span></div>
          <div className="stats-grid">
            <StatCard icon={<UsersRound size={21}/>} label="Active crew" value={loading ? '—' : String(astronauts.length).padStart(2,'0')} sub="Fictional mission crew" />
            <StatCard icon={<HeartPulse size={21}/>} label="Resting HR baseline" value={selectedProfileHr !== null ? `${selectedProfileHr} bpm` : 'Unknown'} sub="Selected crew member" />
            <StatCard icon={<Moon size={21}/>} label="Sleep baseline" value={selectedProfileSleep !== null ? `${selectedProfileSleep} hrs` : 'Unknown'} sub="Selected crew member" />
            <StatCard icon={<Database size={21}/>} label="Missing inputs" value={String(missingCount).padStart(2,'0')} sub="Unknown, not normal" tone={missingCount > 0 ? 'stat-highlight' : ''} />
          </div>
        </section>

        <HealthTrends health={health} />

        <div className="workspace-grid">
          <form className="form-stack" id="investigation-form" onSubmit={runInvestigation}>
            <div className="section-kicker"><div className="kicker-dot"/> INVESTIGATION SETUP <span>—</span> NEW CASE</div>
            <section className="panel crew-panel">
              <PanelHeading icon={<UserRound size={18}/>} number="01" title="Select crew member" aside={<span className="small-tag">CREW DATABASE</span>}/>
              <label className="field-label" htmlFor="crew-select">Astronaut profile</label>
              <div className="select-wrap"><div className="crew-avatar">{chosen?.display_name?.split(' ').slice(-1)[0]?.slice(0,2).toUpperCase() || '—'}</div>
                <select id="crew-select" aria-label="Astronaut profile" value={selectedId} onChange={e => chooseCrew(e.currentTarget.value)} disabled={loading || astronauts.length === 0}>
                  {astronauts.map(a => <option key={a.astronaut_id} value={a.astronaut_id}>{a.display_name} · {a.astronaut_id}</option>)}
                </select><ChevronDown size={18} className="select-chevron"/>
              </div>
              <div className="crew-meta"><span><FileChip>Synthetic crew record</FileChip></span><span className="crew-id">ID: {selectedId || '—'}</span></div>
              <label className="observation-field" htmlFor="observation-time"><span className="field-label">Observation time</span><input type="datetime-local" id="observation-time" value={observedAt} onChange={e => {setObservedAt(e.target.value);setResult(null)}} required /></label>
            </section>

            <section className="panel symptoms-panel">
              <PanelHeading icon={<ClipboardCheck size={18}/>} number="02" title="Reported symptoms" aside={<span className="small-tag">SELECT ALL THAT APPLY</span>}/>
              <p className="panel-description">Choose what the crew member reported. These are observations, not a diagnosis.</p>
              <div className="symptom-tags" role="group" aria-label="Reported symptoms">
                {symptomOptions.map(([id, label]) => <button key={id} type="button" aria-pressed={symptoms.includes(id)} className={`symptom-tag ${symptoms.includes(id) ? 'selected' : ''}`} onClick={() => toggleSymptom(id)}>{symptoms.includes(id) && <Check size={14}/>} {label}</button>)}
              </div>
              <div className="custom-symptom-row"><input type="text" aria-label="Additional symptom" value={customSymptom} onChange={e=>setCustomSymptom(e.currentTarget.value)} placeholder="Add another reported symptom..." maxLength={80}/><button type="button" disabled={!customSymptom.trim()} onClick={() => { const s=customSymptom.trim().toLowerCase().replace(/\s+/g,'_');if(s&&!symptoms.includes(s))setSymptoms(old=>[...old,s]); setCustomSymptom('');setResult(null) }}>+ Add</button></div>
              {symptoms.length > 0 && <p className="selection-caption">{symptoms.length} reported symptom{symptoms.length === 1 ? '' : 's'} selected</p>}
            </section>

            <section className="panel measurements-panel">
              <PanelHeading icon={<Activity size={18}/>} number="03" title="Health measurements" aside={<span className="small-tag">OPTIONAL FIELDS</span>}/>
              <p className="panel-description">Leave unknown readings blank. Never estimate or substitute zero for missing data.</p>
              <div className="measurements-grid">
                <MetricInput label="Resting heart rate" unit="bpm" value={measurements.resting_hr_bpm} min={1} max={250} hint={`Baseline: ${selectedProfileHr ?? 'unknown'} bpm`} onChange={v=>changeMeasurement('resting_hr_bpm',v)}/>
                <MetricInput label="Sleep duration" unit="hours" value={measurements.sleep_hours} min={0} max={24} hint={`Baseline: ${selectedProfileSleep ?? 'unknown'} hrs`} onChange={v=>changeMeasurement('sleep_hours',v)}/>
                <MetricInput label="Systolic blood pressure" unit="mmHg" value={measurements.systolic_bp_mm_hg} min={1} max={300} hint="Blank means not measured" onChange={v=>changeMeasurement('systolic_bp_mm_hg',v)}/>
                <MetricInput label="Diastolic blood pressure" unit="mmHg" value={measurements.diastolic_bp_mm_hg} min={1} max={250} hint="Blank means not measured" onChange={v=>changeMeasurement('diastolic_bp_mm_hg',v)}/>
              </div>
              {!validMeasurements && <div className="field-error" role="alert">Please enter valid non-negative measurements within the allowed input range.</div>}
              <div className="missing-inline"><AlertCircle size={15}/>{currentMissing.length} field{currentMissing.length === 1 ? '' : 's'} currently unknown: {currentMissing.length ? currentMissing.map(k=>readingLabels[k]).join(', ') : 'none'}</div>
            </section>

            <section className="panel scenario-panel">
              <PanelHeading icon={<Shield size={18}/>} number="04" title="Mission context"/>
              <div className="context-row"><div><strong>Earth communication</strong><p>Use the scenario connection status.</p></div><div className="context-segment" role="group" aria-label="Earth communication"><button type="button" aria-pressed={commStatus === 'offline'} onClick={()=>{setCommStatus('offline');setResult(null)}} className={commStatus === 'offline' ? 'on' : ''}><WifiOff size={14}/> Offline</button><button type="button" aria-pressed={commStatus === 'online'} onClick={()=>{setCommStatus('online');setResult(null)}} className={commStatus === 'online' ? 'on' : ''}>Online</button></div></div>
              {mode === 'demo' && <label className="emergency-option"><input type="checkbox" checked={emergency} onChange={e=>{setEmergency(e.currentTarget.checked);setResult(null)}}/><span><strong>Simulate emergency protocol override</strong><small>Demo-only test switch. Disables normal check ranking and requests protocol escalation.</small></span></label>}
            </section>

            <div className="form-actions"><button className="reset-button" type="button" onClick={resetForm}><RotateCcw size={16}/> Clear form</button><button className="run-button" disabled={!canAnalyze} type="submit">{busy ? 'Running investigation...' : 'Save & run investigation'}<ArrowRight size={18}/></button></div>
            {submitError && <div className="error-strip" role="alert"><AlertTriangle size={17}/>{submitError}{receipt && <span> Check-in {receipt} was saved, but analysis did not finish.</span>}</div>}
          </form>

          <div className="right-stack">
            <div className="section-kicker"><div className="kicker-dot"/> EVIDENCE & RESOURCES <span>—</span> LIVE PREVIEW</div>
            <section className="panel insight-panel" id="data-gaps">
              <PanelHeading icon={<Search size={18}/>} number="A" title="Information gaps" aside={<span className={`counter-pill ${displayMissing.length ? 'amber' : ''}`}>{displayMissing.length} missing</span>}/>
              <p className="panel-description">The difference between unknown and known is critical.</p>
              <div className="gap-list">
                {displayMissing.length ? displayMissing.map(k => <div className="gap-item" key={k}><span className="gap-icon"><AlertCircle size={16}/></span><div><strong>{readingLabels[k as keyof Measurements] || k.replaceAll('_',' ')}</strong><small>No measurement available</small></div><span className="unknown-badge">UNKNOWN</span></div>) : <div className="empty-inline"><CheckCircle2 size={18}/>All tracked measurements provided.</div>}
              </div>
              <div className="panel-bottom-note"><Info size={15}/> Unknown measurements are not classified as healthy or unhealthy.</div>
            </section>

            <section className="panel inventory-panel" id="medical-inventory">
              <PanelHeading icon={<Package size={18}/>} number="B" title="Medical inventory" aside={<span className="counter-pill">{availableEquipment.length} usable</span>}/>
              <p className="panel-description">A check can only require equipment listed as currently usable.</p>
              <div className="inventory-list">
                {usableInventory.map(item => <div key={item.equipment_id} className="inventory-item"><div className={`inventory-item-icon ${item.usable && item.quantity > 0 ? 'item-ready' : 'item-missing'}`}><Package size={17}/></div><div className="inventory-item-details"><strong>{item.label}</strong><span>{item.quantity} in stock · {item.equipment_id}</span></div><span className={`item-status ${item.usable && item.quantity > 0 ? 'available' : 'unavailable'}`}>{item.usable && item.quantity > 0 ? 'Available' : 'Unavailable'}</span></div>)}
                {!usableInventory.length && <p className="quiet">No inventory entries returned.</p>}
              </div>
              {mode === 'demo' && <button className="restock-button" type="button" onClick={()=>{setRestockDemo(v=>!v);setResult(null)}}>{restockDemo ? 'Reset BP monitor to unavailable' : '+ Simulate BP monitor restock'}</button>}
              <div className="panel-bottom-note"><ShieldCheck size={15}/> Synthetic inventory; availability is checked before next-check selection.</div>
            </section>

            <section className={`panel result-panel ${result?.status === 'escalate' ? 'escalation-panel' : ''}`} id="investigation-result" aria-live="polite">
              <PanelHeading icon={<Sparkles size={18}/>} number="C" title="Investigation result" aside={result ? <span className={`result-status ${result.status === 'escalate' ? 'escalate' : ''}`}>{result.status.replaceAll('_', ' ')}</span> : <span className="small-tag">NOT YET RUN</span>}/>
              {!result ? <div className="result-placeholder"><div className="placeholder-orbit"><div className="orbit-outer"/><div className="orbit-inner"/><Stethoscope size={31}/></div><h3>Ready for investigation</h3><p>Complete the crew report and run the investigation to see evidence, missing inputs and a permitted next step.</p><div className="placeholder-steps"><span><CheckCircle2 size={14}/> Collect</span><ArrowRight size={14}/><span>Evaluate</span><ArrowRight size={14}/><span>Review</span></div></div> : <div className="result-content">
                {receipt && <div className="receipt-row"><CheckCircle2 size={15}/> Check-in saved · {receipt}</div>}
                <div className={`result-heading ${result.status === 'escalate' ? 'result-danger' : ''}`}><div className="result-symbol">{result.status === 'escalate' ? <AlertTriangle size={22}/> : <ShieldCheck size={22}/>}</div><div><strong>{result.status === 'escalate' ? 'Protocol escalation required' : result.status === 'monitoring' ? 'Monitoring record created' : 'Medical review recommended'}</strong><span>{result.requires_medical_officer_review ? 'Requires medical officer review' : 'No specific escalation indicated by this demo'}</span></div></div>
                <div className="result-block"><div className="result-subhead"><BarChart3 size={15}/> Observations</div>{result.observations.length ? <ul>{result.observations.map((s,i)=><li key={i}>{s}</li>)}</ul> : <p className="quiet">No observations returned.</p>}</div>
                {result.resource_constraints.length > 0 && <div className="constraint-box"><AlertTriangle size={17}/><div><strong>Resource constraints</strong><ul>{result.resource_constraints.map((s,i)=><li key={i}>{s}</li>)}</ul></div></div>}
                {result.safety_flags.length > 0 && <div className="constraint-box"><Shield size={17}/><div><strong>Safety flags</strong><ul>{result.safety_flags.map((s,i)=><li key={i}>{s.replaceAll('_', ' ')}</li>)}</ul></div></div>}
                <div className="next-check-box"><span className="mini-label">NEXT PERMITTED CHECK</span>{result.next_check ? <><h3>{result.next_check.label}</h3><p>Required equipment: {result.next_check.requires_equipment.length ? result.next_check.requires_equipment.join(', ') : 'None'}</p>{result.next_check.prototype_only && <span className="prototype-pill">PROTOTYPE ONLY</span>}</> : <><h3>No routine check selected</h3><p>Follow the mission-approved emergency workflow and seek medical officer review.</p></>}</div>
                <div className="result-block"><div className="result-subhead"><Info size={15}/> Explanation</div><p>{result.explanation}</p></div>
                <div className="evidence-line">Evidence: {result.evidence_sources.join(' · ') || 'not provided'} · Diagnosis: none</div>
                <button type="button" className="export-button" disabled={!lastRequest} onClick={()=>downloadReport({ request: lastRequest, response: result, exported_at: new Date().toISOString(), dataset_type: 'synthetic', note: 'Prototype demonstration; not a clinical medical report' })}><Download size={16}/> Export synthetic case JSON</button>
              </div>}
            </section>
          </div>
        </div>
        <section className="saved-reports-section" id="saved-reports">
          <div className="history-heading"><div><small>03 / LOCAL INCIDENT RECORDS</small><h2>Saved investigation reports</h2></div><span className="history-data-label">SESSION ONLY · SYNTHETIC</span></div>
          {savedReports.length ? <div className="saved-list">{savedReports.map(report => <div className="saved-row" key={report.id}><FileText size={20}/><div><strong>{report.id}</strong><span>{new Date(report.savedAt).toLocaleString()} · {report.request.astronaut_id}</span></div><button type="button" onClick={()=>{setSelectedId(report.request.astronaut_id);onCrewSelect?.(report.request.astronaut_id);setMeasurements(report.request.measurements);setSymptoms(report.request.symptoms);setLastRequest(report.request);setResult(report.response);document.getElementById('investigation-result')?.scrollIntoView({behavior:'smooth'})}}>Reopen report <ArrowRight size={15}/></button></div>)}</div> : <div className="saved-empty">No reports yet. Submit an investigation to create a local session report.</div>}
        </section>
        <footer className="footer"><span>MEDNAV / RESEARCH PROTOTYPE / API CONTRACT V1</span><span>Designed for transparent, safety-gated investigations · No clinical use</span></footer>
      </main>
    </div>
  </div>
}
