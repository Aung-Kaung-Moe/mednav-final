import React, { useEffect, useRef, useState } from 'react';
import {useBackend} from './api';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Check,
  Menu,
  X,
  RotateCcw,
  LayoutDashboard,
  ClipboardList,
  Microscope,
  Package,
  FileText,
  Info,
  UserRound,
} from 'lucide-react';
import { MissionConsole } from './components/MissionConsole';
import { IterativeInvestigation } from './components/IterativeInvestigation';
import { VoiceCheckIn } from './components/VoiceCheckIn';
import { Panel } from './components/ui';
import { crews, equipment, symptomOptions, type Crew } from './data/fixtures';
import type { MedicationStockDTO } from './types/api';
import './styles.css';

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
  const backend=useBackend(crewId);
  const {profiles,inventory,flags}=backend;
  const [mobile, setMobile] = useState(false);
  const [, setActivity] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [inventoryAlert, setInventoryAlert] = useState<string | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const setFlags=(update:boolean[]|((f:boolean[])=>boolean[]))=>backend.changeFlags(typeof update==='function'?update(flags):update);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  useEffect(()=>{if(backend.initialized&&profiles.length&&!profiles.some(c=>c.id===crewId))setCrewId(profiles[0].id);},[backend.initialized,profiles,crewId]);
  const crew = profiles.find((c) => c.id === crewId) ?? profiles[0];

  const go = (p: number) => {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCrew = (nextId: string) => {
    setCrewId(nextId);
    const nextCrew = profiles.find((c) => c.id === nextId)!;
    setFlags((f) => [f[0], nextCrew.bp !== null, f[2], f[3]]);
  };

  const isConsolePage = [0, 5].includes(page);

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
                Synthetic Offline Demo
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
          <div className="main-brand">MEDNAV</div>
          <div className="header-separator" aria-hidden="true" />
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

            <div className="prototype-label">
              <Info size={15} /> Synthetic Telemetry · Non-Diagnostic
            </div>

            <div className="user-icon" aria-hidden="true">
              <UserRound size={22} />
            </div>
          </div>
        </header>

        <main id="main">
        {backend.live&&backend.busy&&<p role="status" className="sheet-footnote">Evaluating…</p>}
        {backend.error&&<p role="alert" className="error">{backend.error} <button className="hairline-pill-btn" onClick={backend.retry}>Retry backend</button></p>}
        {isConsolePage && (!backend.live || backend.result!==null) && (
          <MissionConsole
            key={page}
            crew={crew}
            profiles={profiles}
            onSelectCrew={handleSelectCrew}
            inventory={inventory}
            live={backend.live}
            liveResponse={backend.result}
            liveHistory={backend.history}
            liveRecord={backend.record}
            flags={flags}
            setFlags={backend.changeFlags}
            page={page}
            go={go}
          />
        )}

        {page === 1 && (!backend.live||backend.initialized) && (
          <CheckIn
            key={crew.id}
            crew={crew}
            save={backend.save}
            investigate={() => go(2)}
            live={backend.live}
          />
        )}

        {page === 2 && (!backend.live||backend.initialized) && (
          <IterativeInvestigation
            live={backend.live}
            crew={crew}
            liveRecord={backend.record}
            inventory={inventory}
            onStockChanged={() => backend.refreshMissionData()}
            go={go}
          />
        )}

        {page === 4 && (!backend.live||backend.initialized) && (
          <div className="space-subpage">
            <div className="asymmetric-workspace-grid">
              <section className="left-telemetry-column">
                <h1 className="section-sans-headline">
                  Onboard Medical Inventory &amp; Medications
                </h1>

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

                <div className="inventory-toolbar">
                  <div
                    className="preset-hairline-row"
                    role="group"
                    aria-label="Filter by category"
                  >
                    {[
                      'All',
                      'Medications',
                      'Monitoring',
                      'Documentation',
                      'Imaging',
                      'Supplies',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`hairline-pill-btn ${
                          category === c ? 'active' : ''
                        }`}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div className="filters">
                    <label>
                      Search inventory
                      <input
                        placeholder="Filter by name…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                {(category === 'All' || category === 'Medications') && backend.medications.length > 0 && (
                  <div className="inv-med-inventory-section">
                    <div className="hairline-telemetry-list">
                      {backend.medications
                        .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
                        .map((m) => (
                          <MedicationInventoryRow
                            key={m.id}
                            med={m}
                            busy={backend.busy}
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

                {category !== 'Medications' && (
                  <div className="hairline-telemetry-list" style={{ marginTop: 18 }}>
                    {inventory
                      .filter(
                        (e) =>
                          e.name.toLowerCase().includes(search.toLowerCase()) &&
                          (category === 'All' || e.category === category)
                      )
                      .map((e) => (
                        <article
                          className="equipment-hairline-row"
                          key={e.name}
                        >
                          <div className="equip-row-left">
                            <strong>{e.name}</strong>
                            <span>
                              {e.category} · Quantity {e.quantity} ·{' '}
                              <em className={e.available ? 'ok-txt' : 'unknown-val'}>
                                {e.available ? 'Usable' : 'Unavailable'}
                              </em>
                            </span>
                          </div>
                          <button
                            type="button"
                            className="hairline-pill-btn"
                            disabled={backend.busy||(!e.available&&e.quantity===0)}
                            title={!e.available&&e.quantity===0?'Cannot enable zero-quantity equipment. Quantity changes require the inventory API.':undefined}
                            onClick={() => {
                              void backend.updateInventory(e.name,!e.available);
                            }}
                          >
                            Mark {e.available ? 'Unavailable' : 'Usable'}
                          </button>
                        </article>
                      ))}
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
        ['Space Radiation (Daily):', value(crew.radiationDailyMsv, ' mSv/day')],
        ['Microgravity Exercise (ARED):', value(crew.countermeasureMin, ' min')],
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
  live,
}: {
  crew: Crew;
  save: (c: Crew) => Promise<void>;
  investigate: () => void;
  live:boolean;
}) {
  const [symptoms, setSymptoms] = useState(crew.symptoms);
  const [hr, setHr] = useState(crew.hr?.toString() || '');
  const [sleep, setSleep] = useState(crew.sleep?.toString() || '');
  const [sys, setSys] = useState(crew.bp?.split(' / ')[0] || '');
  const [dia, setDia] = useState(crew.bp?.split(' / ')[1] || '');
  const [rad, setRad] = useState(crew.radiationDailyMsv?.toString() || '');
  const [ared, setAred] = useState(crew.countermeasureMin?.toString() || '');
  const [mass, setMass] = useState(crew.bodyMassKg?.toString() || '');
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving,setSaving]=useState(false);

  const draft: Crew = {
    ...crew,
    symptoms,
    hr: hr === '' ? null : Number(hr),
    sleep: sleep === '' ? null : Number(sleep),
    bp: sys && dia ? `${sys} / ${dia}` : null,
    radiationDailyMsv: rad === '' ? null : Number(rad),
    countermeasureMin: ared === '' ? null : Number(ared),
    bodyMassKg: mass === '' ? null : Number(mass),
  };

  return (
    <div className="space-subpage">
      <div className="asymmetric-workspace-grid">
        <section className="left-telemetry-column">
          <div className="wide-planetary-label left-aligned">
            H E A L T H &nbsp; C H E C K - I N &nbsp; · &nbsp; {crew.id.toUpperCase()}
          </div>
          <h1 className="section-sans-headline">
            {saved
              ? 'Health Check-In Saved'
              : review
              ? 'Review Recorded Observations'
              : `Health Check-In for ${crew.id}`}
          </h1>

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
              <VoiceCheckIn
                onApply={(parsed) => {
                  if (parsed.clearSymptoms) {
                    setSymptoms([]);
                  } else if (parsed.symptoms && parsed.symptoms.length > 0) {
                    setSymptoms(parsed.symptoms);
                  } else if(parsed.removeSymptoms?.length) {
                    setSymptoms(previous=>previous.filter(s=>!parsed.removeSymptoms!.includes(s)));
                  }
                  if (parsed.hr !== undefined && parsed.hr !== null) {
                    setHr(parsed.hr);
                  }
                  if (parsed.sleep !== undefined && parsed.sleep !== null) {
                    setSleep(parsed.sleep);
                  }
                  if (parsed.sys !== undefined && parsed.sys !== null) {
                    setSys(parsed.sys);
                  }
                  if (parsed.dia !== undefined && parsed.dia !== null) {
                    setDia(parsed.dia);
                  }
                }}
              />

              <fieldset>
                <div className="fieldset-header">
                  <legend>Reported Symptoms</legend>
                  {symptoms.length > 0 && (
                    <button
                      type="button"
                      className="hairline-pill-btn"
                      onClick={() => setSymptoms([])}
                    >
                      <RotateCcw size={13} /> Clear
                    </button>
                  )}
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
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="vitals-section-head">
                <strong>Vital Signs, Space Radiation &amp; Microgravity</strong>
                <span>Unavailable measurements remain Unknown</span>
              </div>

              <div className="form-grid">
                {[
                  ['Heart rate (bpm)', hr, setHr],
                  ['Sleep (hours)', sleep, setSleep],
                  ['Systolic (mmHg)', sys, setSys],
                  ['Diastolic (mmHg)', dia, setDia],
                  ['Space radiation (mSv/day)', rad, setRad],
                  ['Microgravity exercise ARED (min)', ared, setAred],
                  ['Body mass SLAMMD (kg)', mass, setMass],
                ].map(([label, v, change], i) => {
                  const isUnknown = (v as string) === '';
                  return (
                    <div
                      className={`field-card ${isUnknown ? 'is-unknown' : ''}`}
                      key={label as string}
                    >
                      <div className="field-card-head">
                        <label htmlFor={`field-${i}`}>{label as string}</label>
                        <button
                          type="button"
                          className="unknown-option"
                          aria-pressed={isUnknown}
                          disabled={live&&i>=4}
                          onClick={() => {
                            if (i === 2 || i === 3) {
                              setSys('');
                              setDia('');
                            } else {
                              (change as (v: string) => void)('');
                            }
                          }}
                        >
                          Unknown
                        </button>
                      </div>
                      <input
                        id={`field-${i}`}
                        readOnly={live&&i>=4}
                        title={live&&i>=4?'Illustrative only: no approved persistence contract.':undefined}
                        type="number"
                        min={i===2||i===3?1:i === 1 || i === 5 ? 0 : 0.01}
                        max={i === 1 ? 24 : undefined}
                        step={i===2||i===3?'1':'any'}
                        value={v as string}
                        placeholder="Unknown"
                        onChange={(e) =>
                          (change as (v: string) => void)(e.target.value)
                        }
                      />
                    </div>
                  );
                })}
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

        <aside className="right-frosted-sheet">
          <div className="wide-planetary-label left-aligned">
            C H E C K - I N &nbsp; S U M M A R Y
          </div>
          <h3>{crew.id} · {crew.role}</h3>
          <Observation crew={draft} />
          <div className="sheet-divider" />
          <p className="sheet-footnote">
            Missing measurements are preserved explicitly as <b>Unknown</b> and
            never assumed normal.
          </p>
        </aside>
      </div>
    </div>
  );
}

function MedicationInventoryRow({
  med,
  busy,
  onUpdate,
}: {
  med: MedicationStockDTO;
  busy: boolean;
  onUpdate: (quantity: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(String(med.quantity));
  const [saving, setSaving] = useState(false);

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
          · Pre-flight kit ({med.protocol_ref})
        </span>
      </div>
      <div className="inv-med-manual-controls">
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
      </div>
    </article>
  );
}

export { Panel };

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
