import React, { useEffect, useRef, useState } from 'react';
import { investigationApi, useBackend } from './api';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Check,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  Microscope,
  Package,
  FileText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { MissionConsole } from './components/MissionConsole';
import { IncidentReportPage } from './components/IncidentReportPage';
import { IterativeInvestigation } from './components/IterativeInvestigation';
import { FollowUpPanel } from './components/FollowUpPanel';
import VoiceAssistant from './voice/VoiceAssistant';
import { configureVoiceDemo } from './voice/currentDemo';
import type { InvestigationResponse } from './voice/types';
import { Panel } from './components/ui';
import { crews, symptomOptions, type Crew } from './data/fixtures';
import { getMedicationPurpose } from './data/medicalReferences';
import type { CrewProactiveAlertDTO, MedicationStockDTO } from './types/api';
import './styles.css';
import './subpages.css';

function playDoubleAlertSound(): void {
  try {
    const win = window as Window & {
      webkitAudioContext?: typeof AudioContext;
      __mednavAlertCount?: number;
    };
    win.__mednavAlertCount = (win.__mednavAlertCount ?? 0) + 2;
    const AudioCtx = window.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const playTone = (startOffset: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + 0.17);
    };
    // Two alert tones to notify all crew onboard when medication stock is manually edited
    playTone(0.02, 880);
    playTone(0.26, 988);
  } catch {
    // Audio playback unavailable in restricted environment
  }
}

const navItems = [
  { label: 'Dashboard', page: 0, icon: LayoutDashboard },
  { label: 'Health Check-In', page: 1, icon: ClipboardList },
  { label: 'Investigation', page: 2, icon: Microscope },
  { label: 'Medical Inventory', page: 4, icon: Package },
  { label: 'Incident Report', page: 5, icon: FileText },
];

const value = (v: number | string | null, unit = '') =>
  v === null ? 'Unknown' : `${v}${unit}`;

function App() {
  const [page, setPage] = useState(0);
  const [crewId, setCrewId] = useState('Crew A');
  const backend=useBackend(crewId,page===0);
  const {profiles,inventory,flags}=backend;
  const [mobile, setMobile] = useState(false);
  const [inventoryAlert, setInventoryAlert] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [manageStock, setManageStock] = useState(false);
  const [crewAlerts, setCrewAlerts] = useState<CrewProactiveAlertDTO[]>([]);
  const alertTimerRef = useRef<number | null>(null);
  const [voiceResponse, setVoiceResponse] = useState<InvestigationResponse | null>(null);
  const setFlags = (update: boolean[] | ((f: boolean[]) => boolean[])) =>
    backend.changeFlags(typeof update === 'function' ? update(flags) : update);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (backend.initialized && profiles.length && !profiles.some((c) => c.id === crewId)) {
      setCrewId(profiles[0].id);
    }
  }, [backend.initialized, profiles, crewId]);

  useEffect(() => {
    if (!backend.live || (page !== 2 && page !== 4)) return;
    let active = true;
    const refresh = () => void investigationApi.getCrewAlerts()
      .then((alerts) => { if (active) setCrewAlerts(alerts.filter((a) => a.needs_investigation)); })
      .catch(() => { if (active) setCrewAlerts([]); });
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [backend.live, page, backend.record?.id]);

  const crew = profiles.find((c) => c.id === crewId) ?? profiles[0];

  configureVoiceDemo({
    profiles,
    inventory,
    save: (next) => {
      void backend.save(next);
    },
  });

  useEffect(() => {
    const onVoiceResult = (event: Event) => {
      const detail = (event as CustomEvent<{ response: InvestigationResponse }>).detail;
      if (detail?.response) setVoiceResponse(detail.response);
    };
    window.addEventListener('mednav:voice-investigation', onVoiceResult);
    return () => window.removeEventListener('mednav:voice-investigation', onVoiceResult);
  }, []);

  const go = (p: number) => {
    if (p === 0) backend.refresh();
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCrew = (nextId: string) => {
    setVoiceResponse(null);
    backend.selectLatest();
    setCrewId(nextId);
    const nextCrew = profiles.find((c) => c.id === nextId)!;
    setFlags((f) => [f[0], nextCrew.bp !== null, f[2], f[3]]);
  };

  const isConsolePage = page === 0;

  return (
    <div className="app-shell">
      <a href="#main" className="skip">
        Skip to content
      </a>

      {/* LEFT VERTICAL SIDEBAR SHELL (PORTED FROM FRONTEND2 IN ORBITAL VOID PALETTE) */}
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <div className="side-identity">
          <div className="logo-orbit" aria-hidden="true">
            <span />
            <i />
          </div>
          <div className="side-brand">
            MEDNAV<sup>™</sup>
          </div>
          <div className="side-tagline">
            ASTRONAUT HEALTH
            <br />
            MONITORING SYSTEM
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${page === item.page ? 'nav-current' : ''}`}
                onClick={() => go(item.page)}
                aria-current={page === item.page ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="side-bottom">
          <div className="program-logo">
            <div className="nasa-ish">M</div>
            <div>
              <strong>MEDNAV</strong>
              <small>
                Space Health Program
                <br />
                Offline Telemetry
              </small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA WITH TOPBAR & WORKSPACE */}
      <div className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="brand-divider" aria-hidden="true" />
          <div className="header-subtitle">Astronaut Health Monitoring</div>

          <div className="topbar-right">
            <label className="crew-select-inline">
              <span>CREW</span>
              <select
                value={crewId}
                disabled={backend.live&&!backend.initialized}
                onChange={(e) => handleSelectCrew(e.target.value)}
              >
                {profiles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </label>

          </div>
        </header>

        <main id="main">
        {backend.live&&backend.busy&&<p role="status" className="sheet-footnote">Evaluating…</p>}
        {backend.error&&<p role="alert" className="error">{backend.error} <button className="hairline-pill-btn" onClick={backend.retry}>Retry backend</button></p>}
        {isConsolePage && (!backend.live || backend.result!==null || (page===0&&backend.initialized)) && (
          <MissionConsole
            key={page}
            crew={backend.live&&page!==0&&backend.record?{...crew,hr:backend.record.hr,sleep:backend.record.sleep,bp:backend.record.bp,symptoms:backend.record.symptoms}:crew}
            profiles={profiles}
            onSelectCrew={handleSelectCrew}
            inventory={inventory}
            live={backend.live}
            liveResponse={backend.result}
            liveHistory={backend.history}
            liveRecord={backend.record}
            liveRecords={backend.records}
            historyLoading={backend.historyLoading}
            historyError={backend.historyError}
            lastSyncedAt={backend.lastSyncedAt}
            onRefresh={backend.refresh}
            refreshing={backend.busy}
            onInvestigate={(id)=>{backend.investigate(id);go(2)}}
            flags={flags}
            setFlags={backend.changeFlags}
            page={page}
            voiceResponse={voiceResponse}
            go={go}
          />
        )}
        {page === 5 && <IncidentReportPage crewId={crewId} go={go} />}

        {page === 1 && (!backend.live||backend.initialized) && (
          <CheckIn
            key={crew.id}
            crew={crew}
            save={backend.save}
            investigate={() => go(2)}
            onBack={() => go(0)}
            live={backend.live}
          />
        )}

        {page === 2 && (!backend.live||backend.initialized) && (
          <>
            <IterativeInvestigation
              live={backend.live}
              crew={crew}
              liveRecord={backend.record}
              inventory={inventory}
              onStockChanged={() => backend.refreshMissionData()}
              go={go}
            />
            {backend.live&&backend.result&&backend.savedId&&<div className="investigation-followup"><FollowUpPanel key={`${crew.id}:${backend.savedId}`} crewId={crew.id} checkInId={backend.savedId}/></div>}
          </>
        )}

        {page === 4 && (!backend.live||backend.initialized) && (
          <div className="space-subpage inventory-page">
            <div className="subpage-top-bar">
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => go(0)}
              >
                Overview
              </button>
              <div className="wide-planetary-label">
                M E D I C A L &nbsp; I N V E N T O R Y
              </div>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => go(2)}
              >
                Investigation <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="asymmetric-workspace-grid">
              <section className="left-telemetry-column">
                <h1 className="section-sans-headline">
                  Medical inventory
                </h1>
                <p className="subpage-lede">Review onboard medication stock and medical readiness.</p>

                {inventoryAlert && (
                  <div
                    role="status"
                    data-testid="crew-alert-banner"
                    data-beeps="2"
                    className="inv-crew-alert-banner"
                  >
                    <strong>Crew Alert (2× audio beep):</strong> {inventoryAlert}
                  </div>
                )}

                {crewAlerts.length > 0 && (
                  <div role="status" className="inv-crew-alert-banner">
                    <strong>Crew needing investigation</strong>
                    <div className="inv-crew-alert-actions">
                      {crewAlerts.map((alert) => (
                        <button key={alert.astronaut_id} type="button" className="hairline-pill-btn"
                          onClick={() => { handleSelectCrew(alert.astronaut_id); go(2); }}>
                          {alert.astronaut_id}: {alert.summary_tags.join(' · ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="inventory-toolbar inv-inventory-toolbar-row">
                  <label className="inv-search-label">Search medications
                    <input type="search" placeholder="Filter by name…" value={inventorySearch}
                      onChange={(event) => setInventorySearch(event.target.value)} />
                  </label>
                  <button type="button" className={`hairline-pill-btn${manageStock ? ' active' : ''}`}
                    aria-pressed={manageStock} onClick={() => setManageStock((value) => !value)}>
                    {manageStock ? 'Done Adjusting' : 'Adjust Stock'}
                  </button>
                </div>

                {backend.medications.length > 0 && (
                  <div className="inv-med-inventory-section">
                    <div className="hairline-telemetry-list">
                      {backend.medications
                        .filter((m) => m.name.toLowerCase().includes(inventorySearch.trim().toLowerCase()))
                        .map((m) => (
                          <MedicationInventoryRow
                            key={m.id}
                            med={m}
                            busy={backend.busy}
                            manageStock={manageStock}
                            onUpdate={async (qty) => {
                              const prev = m.quantity;
                              await backend.updateMedicationQuantity(m.id, qty);
                              playDoubleAlertSound();
                              setInventoryAlert(
                                `${m.name} manually updated (${prev} → ${qty} ${m.unit}).`
                              );
                              if (alertTimerRef.current !== null) {
                                window.clearTimeout(alertTimerRef.current);
                              }
                              alertTimerRef.current = window.setTimeout(() => {
                                setInventoryAlert(null);
                                alertTimerRef.current = null;
                              }, 1000);
                            }}
                          />
                        ))}
                    </div>
                  </div>
                )}

              </section>

              <aside className="right-frosted-sheet inv-readiness-panel">
                <div className="inv-readiness-head">
                  <span className="micro-label">ONBOARD MEDICAL READINESS</span>
                </div>

                <dl className="hairline-telemetry-list compact-list">
                  <div className="telemetry-kv-row compact">
                    <dt>Medication Types:</dt>
                    <dd>{backend.medications.length} Types</dd>
                  </div>
                  <div className="telemetry-kv-row compact">
                    <dt>Total Medication Units:</dt>
                    <dd>{backend.medications.reduce((sum, m) => sum + m.quantity, 0)} Units</dd>
                  </div>
                  <div className="telemetry-kv-row compact">
                    <dt>Hardware &amp; Supplies:</dt>
                    <dd>{inventory.length} Types</dd>
                  </div>
                  <div className="telemetry-kv-row compact">
                    <dt>Available Supplies:</dt>
                    <dd>
                      {inventory.filter((e) => e.available).length} / {inventory.length} Ready
                    </dd>
                  </div>
                </dl>

                <div className="inv-readiness-block">
                  <span className="micro-label">DIAGNOSTIC DEVICES</span>
                  <ul className="inv-equip-mini">
                    {inventory
                      .filter((e) => e.category !== 'Documentation')
                      .map((e) => (
                        <li key={e.name}>
                          <span>{e.name}</span>
                          <span className={e.available ? 'ok-txt' : 'unknown-val'}>
                            {e.available ? 'Ready' : 'Offline'}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}

        <VoiceAssistant crew={crew.id} onNavigate={(target) => go(({ dashboard: 0, crew: 0, trends: 0, investigation: 2, inventory: 4, reports: 5, research: 0, settings: 0 } as const)[target])} />

        <footer>
          <span>MEDNAV · ASTRONAUT HEALTH MONITORING</span>
          <span role="status" data-testid="backend-status" data-check-in-id={backend.savedId} title="Radiation, microgravity and anatomy telemetry remain illustrative. Earth-offline context is separate from local server connectivity.">{backend.live?'SYNTHETIC DATA · LIVE BACKEND':'SYNTHETIC DATA · LOCAL FIXTURE MODE'}</span>
          <details aria-label="Developer tools">
            <summary>Developer tools</summary>
            <label>Data mode <select aria-label="Data mode" value={backend.live?'live':'fixture'} onChange={e=>{const params=new URLSearchParams(location.search);if(e.target.value==='fixture')params.set('mode','fixture');else params.delete('mode');location.search=params.toString();}}><option value="live">Live FastAPI + Stable engine</option><option value="fixture">Local fixture fallback (explicit)</option></select></label>
            <p>Saved check-in: {backend.savedId||'None'}. Radiation, microgravity and anatomy telemetry are illustrative. Fixtures are scripted and nonpersistent.</p>
            {backend.live&&backend.result&&<pre aria-label="Backend diagnostics" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(backend.result,null,2)}</pre>}
          </details>
        </footer>
        </main>
      </div>
    </div>
  );
}

function Observation({ crew }: { crew: Crew }) {
  return (
    <dl className="hairline-telemetry-list">
      {[
        ['Heart Rate:', value(crew.hr, ' bpm')],
        ['Sleep Duration:', value(crew.sleep, ' hours')],
        ['Blood Pressure:', value(crew.bp, ' mmHg')],
        ['Body Mass (SLAMMD):', value(crew.bodyMassKg, ' kg')],
        ['Ocular / SANS Check:', crew.ocularCheck ?? 'Unknown'],
        ['Reported Symptoms:', crew.symptoms.join(', ') || 'None reported'],
      ].map(([k, v]) => (
        <div className="telemetry-kv-row" key={k}>
          <dt>{k}</dt>
          <dd className={v === 'Unknown' ? 'unknown-val' : ''}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CheckIn({
  crew,
  save,
  investigate,
  onBack,
  live,
}: {
  crew: Crew;
  save: (c: Crew) => Promise<void>;
  investigate: () => void;
  onBack: () => void;
  live: boolean;
}) {
  const [symptoms, setSymptoms] = useState(crew.symptoms);
  const [hr, setHr] = useState(crew.hr?.toString() || '');
  const [sleep, setSleep] = useState(crew.sleep?.toString() || '');
  const [sys, setSys] = useState(crew.bp?.split(' / ')[0] || '');
  const [dia, setDia] = useState(crew.bp?.split(' / ')[1] || '');
  const [mass, setMass] = useState(crew.bodyMassKg?.toString() || '');
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [syncedNotice, setSyncedNotice] = useState(false);
  const [saving, setSaving] = useState(false);

  const syncSensors = () => {
    setHr(crew.hr?.toString() ?? '');
    setSleep(crew.sleep?.toString() ?? '');
    setMass(crew.bodyMassKg?.toString() ?? '');
    setSyncedNotice(true);
  };

  const stepValue = (
    val: string,
    setter: (v: string) => void,
    delta: number,
    min = 0,
    decimals = 0
  ) => {
    const base = val === '' ? 0 : Number(val);
    const next = Math.max(min, Number((base + delta).toFixed(decimals)));
    setter(String(next));
  };

  const draft: Crew = {
    ...crew,
    symptoms,
    hr: hr === '' ? null : Number(hr),
    sleep: sleep === '' ? null : Number(sleep),
    bp: sys && dia ? `${sys} / ${dia}` : null,
    bodyMassKg: mass === '' ? null : Number(mass),
  };

  return (
    <div className="space-subpage health-check-page">
      <div className="subpage-top-bar">
        <button
          type="button"
          className="hairline-pill-btn"
          onClick={onBack}
        >
          Overview
        </button>
        <div className="wide-planetary-label">
          H E A L T H &nbsp; C H E C K - I N
        </div>
        <span className="hairline-status-tag">{crew.id} · {crew.role}</span>
      </div>

      <div className="asymmetric-workspace-grid">
        <section className="left-telemetry-column">
          <h1 className="section-sans-headline">
            {saved
              ? 'Health Check-In Saved'
              : review
              ? 'Review Recorded Observations'
              : `Health Check-In for ${crew.id}`}
          </h1>
          {!saved && !review && <p className="subpage-lede">Record symptoms and measurements for {crew.id}. Review every value before saving.</p>}

          {saved ? (
            <div className="checkin-saved-box">
              <p role="status" className="status-success">
                <Check size={18} /> Saved to local health log for {crew.id}.
              </p>
              <button className="ghost-rect-cta" onClick={investigate}>
                <span>Open Investigation</span>
                <ArrowUpRight size={18} />
              </button>
            </div>
          ) : review ? (
            <div>
              {error&&<p role="alert">{error}</p>}
              <Observation crew={draft} />
              <div className="review-actions">
                <button
                  className="hairline-pill-btn"
                  onClick={() => setReview(false)}
                >
                  Edit Observations
                </button>
                <button
                  className="ghost-rect-cta"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);setError('');
                    try {await save(draft);setSaved(true);}catch(e){setError((e as Error).message);}finally{setSaving(false);}
                  }}
                >
                  <span>{saving?'Saving…':'Save Check-In'}</span>
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (Boolean(sys) !== Boolean(dia) || (sys!=='' && (!/^[1-9][0-9]{0,3}$/.test(sys)||!/^[1-9][0-9]{0,3}$/.test(dia)))) {
                  setError(
                    'Enter both blood-pressure values as positive whole numbers (1–4 digits) or leave both Unknown.'
                  );
                  return;
                }
                setError('');
                setReview(true);
              }}
            >
              {/* Confirm-First Quick-Action Bar */}
              <div className="checkin-quick-bar">
                <button
                  type="button"
                  className="quick-nominal-btn"
                  onClick={() => {
                    setSymptoms([]);
                    setError('');
                    if (Boolean(sys) !== Boolean(dia)) {
                      setSys('');
                      setDia('');
                    }
                    setReview(true);
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>All Nominal · No Symptoms</span>
                </button>

                <button
                  type="button"
                  className="hairline-pill-btn"
                  onClick={syncSensors}
                >
                  <RefreshCw size={14} />
                  <span>
                    {syncedNotice ? 'Sensors Synced' : 'Sync Station Sensors'}
                  </span>
                </button>
              </div>

              <fieldset className="checkin-symptoms">
                <div className="fieldset-header">
                  <legend>1 · Symptoms</legend>
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      symptoms.length === 0 ? 'active' : ''
                    }`}
                    onClick={() => setSymptoms([])}
                  >
                    None reported
                  </button>
                </div>
                <div className="symptom-options">
                  {symptomOptions.map((s) => (
                    <label key={s}>
                      <input
                        type="checkbox"
                        checked={symptoms.includes(s)}
                        onChange={() =>
                          setSymptoms((v) =>
                            v.includes(s)
                              ? v.filter((x) => x !== s)
                              : [...v, s]
                          )
                        }
                      />
                      <span className="symptom-name">{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="vitals-section-head">
                <strong>2 · Sensor Telemetry &amp; Manual Measurements</strong>

              </div>

              <div className="form-grid">
                {[
                  {
                    id: 0,
                    label: 'Heart rate (bpm)',
                    val: hr,
                    set: setHr,
                    step: 1,
                    min: 1,
                    decimals: 0,
                  },
                  {
                    id: 1,
                    label: 'Sleep (hours)',
                    val: sleep,
                    set: setSleep,
                    step: 0.5,
                    min: 0,
                    decimals: 1,
                  },
                  {
                    id: 6,
                    label: 'Body mass (kg)',
                    val: mass,
                    set: setMass,
                    step: 0.2,
                    min: 1,
                    decimals: 1,
                    source: 'STATION',
                  },
                ].map((f) => {
                  const isUnknown = f.val === '';
                  return (
                    <div
                      className={`field-card ${isUnknown ? 'is-unknown' : ''} ${live && f.id >= 4 ? 'is-reference' : ''}`}
                      key={f.label}
                    >
                      <div className="field-card-head">
                        <label htmlFor={`field-${f.id}`}>{f.label}</label>
                        <div className="field-badge-group">
                          {!isUnknown && f.source && <span className="source-chip sensor">{f.source}</span>}
                          {!(live && f.id >= 4) && <button
                            type="button"
                            className="unknown-option"
                            aria-pressed={isUnknown}
                            onClick={() => f.set('')}
                          >
                            {isUnknown ? 'Unknown' : 'Mark unknown'}
                          </button>}
                        </div>
                      </div>
                      <div className="field-stepper-input">
                        <input
                          id={`field-${f.id}`}
                          readOnly={live && f.id >= 4}
                          type="number"
                          min={f.min}
                          max={f.id === 1 ? 24 : undefined}
                          step="any"
                          value={f.val}
                          placeholder="Unknown"
                          onChange={(e) => f.set(e.target.value)}
                        />
                        {!(live && f.id >= 4) && <div className="field-step-actions">
                          <button
                            type="button"
                            className="field-step-btn"
                            aria-label={`Decrease ${f.label}`}
                            onClick={() =>
                              stepValue(f.val, f.set, -f.step, f.min, f.decimals)
                            }
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="field-step-btn"
                            aria-label={`Increase ${f.label}`}
                            onClick={() =>
                              stepValue(f.val, f.set, f.step, f.min, f.decimals)
                            }
                          >
                            +
                          </button>
                        </div>}
                      </div>
                    </div>
                  );
                })}

                {/* Manual Blood Pressure Pair Card */}
                <div
                  className={`field-card bp-pair-card ${
                    !sys && !dia ? 'is-unknown' : ''
                  }`}
                >
                  <div className="field-card-head">
                    <span className="field-label">Blood pressure (mmHg)</span>
                    <div className="field-badge-group">
                      {(sys || dia) && <span className="source-chip sensor">MANUAL</span>}
                      <button
                        type="button"
                        className="unknown-option"
                        aria-pressed={!sys && !dia}
                        onClick={() => {
                          setSys('');
                          setDia('');
                        }}
                      >
                        {(!sys && !dia) ? 'Unknown' : 'Mark unknown'}
                      </button>
                    </div>
                  </div>
                  <div className="bp-dual-inputs">
                    <label htmlFor="field-2"><span>Systolic</span><input
                      id="field-2"
                      type="number"
                      min={1}
                      step="any"
                      value={sys}
                      placeholder="—"
                      aria-label="Systolic (mmHg)"
                      onChange={(e) => setSys(e.target.value)}
                    /></label>
                    <span className="bp-slash">/</span>
                    <label htmlFor="field-3"><span>Diastolic</span><input
                      id="field-3"
                      type="number"
                      min={1}
                      step="any"
                      value={dia}
                      placeholder="—"
                      aria-label="Diastolic (mmHg)"
                      onChange={(e) => setDia(e.target.value)}
                    /></label>
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}

              <div className="form-submit-row">
                <button className="ghost-rect-cta" type="submit">
                  <span>Review Check-In</span>
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className={`right-frosted-sheet checkin-summary-card ${!saved && !review ? 'checkin-summary-aligned' : ''}`} aria-label="Check-in summary">
          <div className="checkin-summary-top">
            <span className="checkin-summary-eyebrow">CHECK-IN SUMMARY</span>
            <h3>{crew.id}</h3>
            <p>{crew.role}</p>
          </div>
          <div className="checkin-summary-vitals">
            <div><span>Heart rate</span><strong className={draft.hr === null ? 'unknown-val' : ''}>{value(draft.hr, ' bpm')}</strong></div>
            <div><span>Sleep duration</span><strong className={draft.sleep === null ? 'unknown-val' : ''}>{value(draft.sleep, ' hours')}</strong></div>
            <div className="checkin-summary-bp"><span>Blood pressure</span><strong className={draft.bp === null ? 'unknown-val' : ''}>{value(draft.bp, ' mmHg')}</strong></div>
          </div>
          <div className="checkin-summary-symptoms">
            <span>Symptoms</span>
            {draft.symptoms.length ? <div className="checkin-summary-tags">{draft.symptoms.map(symptom => <span key={symptom}>{symptom}</span>)}</div> : <p>None reported</p>}
          </div>
          <p className="checkin-summary-note">Unknown values stay unknown until recorded.</p>
        </aside>
      </div>
    </div>
  );
}

function MedicationInventoryRow({
  med,
  busy,
  manageStock,
  onUpdate,
}: {
  med: MedicationStockDTO;
  busy: boolean;
  manageStock: boolean;
  onUpdate: (quantity: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(String(med.quantity));
  const [saving, setSaving] = useState(false);
  const purpose = getMedicationPurpose(med.id);

  useEffect(() => {
    setDraftQty(String(med.quantity));
  }, [med.quantity]);

  const commit = async () => {
    const parsed = Number(draftQty);
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(5000, Math.round(parsed))) : med.quantity;
    setSaving(true);
    try {
      await onUpdate(safe);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="equipment-hairline-row inv-med-inventory-row">
      <div className="equip-row-left">
        <strong>{med.name}</strong>
        <span>
          <em className={med.quantity > 0 ? 'ok-txt' : 'unknown-val'}>
            {med.quantity} {med.unit} remaining
          </em>{' '}
          · {purpose ?? `Pre-flight kit (${med.protocol_ref})`}
        </span>
      </div>
      {manageStock && <div className="inv-med-manual-controls">
        {editing ? (
          <>
            <input
              type="number"
              min={0}
              max={5000}
              aria-label={`Quantity for ${med.name}`}
              value={draftQty}
              onChange={(e) => setDraftQty(e.target.value)}
            />
            <button
              type="button"
              className="hairline-pill-btn active"
              disabled={busy || saving || draftQty === ''}
              aria-label={`Save ${med.name}`}
              onClick={() => void commit()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="hairline-pill-btn"
              disabled={saving}
              onClick={() => {
                setDraftQty(String(med.quantity));
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="hairline-pill-btn"
            disabled={busy || saving}
            aria-label={`Edit ${med.name}`}
            onClick={() => {
              setDraftQty(String(med.quantity));
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
      </div>}
    </article>
  );
}

export { Panel };

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
