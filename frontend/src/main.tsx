import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Check,
  Menu,
  X,
  RotateCcw,
} from 'lucide-react';
import { MissionConsole } from './components/MissionConsole';
import { VoiceCheckIn } from './components/VoiceCheckIn';
import { Panel, Badge } from './components/ui';
import { crews, equipment, symptomOptions, type Crew } from './data/fixtures';
import './styles.css';

const navItems = [
  { label: 'Overview', page: 0 },
  { label: 'Health Check-In', page: 1 },
  { label: 'Investigation', page: 2 },
  { label: 'What-If Lab', page: 3 },
  { label: 'Medical Inventory', page: 4 },
];

const value = (v: number | string | null, unit = '') =>
  v === null ? 'Unknown' : `${v}${unit}`;

function App() {
  const [page, setPage] = useState(0);
  const [crewId, setCrewId] = useState('Crew A');
  const [profiles, setProfiles] = useState(crews);
  const [inventory, setInventory] = useState(equipment);
  const [mobile, setMobile] = useState(false);
  const [, setActivity] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [flags, setFlags] = useState([false, false, false, false]);

  const crew = profiles.find((c) => c.id === crewId)!;

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

  const isConsolePage = [0, 2, 3, 5].includes(page);

  return (
    <div className="app">
      <a href="#main" className="skip">
        Skip to content
      </a>

      {/* GLOBAL TOP NAVIGATION BAR */}
      <header className="orbital-top-nav">
        <button
          className="mobile-toggle"
          aria-label="Toggle navigation"
          onClick={() => setMobile(!mobile)}
        >
          {mobile ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav
          className={`top-nav-links ${mobile ? 'open' : ''}`}
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`top-nav-link ${page === item.page ? 'active' : ''}`}
              onClick={() => go(item.page)}
              aria-current={page === item.page ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="top-nav-right">
          <label className="crew-select-inline">
            <span>CREW</span>
            <select
              value={crewId}
              onChange={(e) => handleSelectCrew(e.target.value)}
            >
              {profiles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`nav-outlined-pill ${page === 5 ? 'active' : ''}`}
            onClick={() => go(5)}
          >
            Incident Report
          </button>
        </div>
      </header>

      <main id="main">
        {isConsolePage && (
          <MissionConsole
            key={page}
            crew={crew}
            profiles={profiles}
            onSelectCrew={handleSelectCrew}
            inventory={inventory}
            flags={flags}
            setFlags={(f) => {
              setFlags(f);
              setInventory((v) =>
                v.map((e) =>
                  e.name === 'Blood-pressure monitor'
                    ? { ...e, available: f[0] }
                    : e
                )
              );
            }}
            page={page}
            go={go}
          />
        )}

        {page === 1 && (
          <CheckIn
            key={crew.id}
            crew={crew}
            save={(c) => {
              setProfiles((p) => p.map((x) => (x.id === c.id ? c : x)));
              setFlags((f) => [f[0], c.bp !== null, f[2], f[3]]);
              setActivity((a) => [`${c.id} · Check-in saved`, ...a]);
            }}
            investigate={() => go(2)}
          />
        )}

        {page === 4 && (
          <div className="space-subpage">
            <div className="asymmetric-workspace-grid">
              <section className="left-telemetry-column">
                <div className="wide-planetary-label left-aligned">
                  M E D I C A L &nbsp; I N V E N T O R Y &nbsp; · &nbsp; D A Y &nbsp; 1 8 0
                </div>
                <h1 className="section-sans-headline">
                  Onboard Medical Equipment
                </h1>
                <p className="telemetry-summary-copy">
                  Verify and toggle usable status for onboard medical devices and
                  consumables. Unavailable equipment is automatically excluded
                  from recommended next checks.
                </p>

                <div className="inventory-toolbar">
                  <div
                    className="preset-hairline-row"
                    role="group"
                    aria-label="Filter by category"
                  >
                    {[
                      'All',
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
                      Search equipment
                      <input
                        placeholder="Filter by equipment name…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <Badge>
                      {inventory.filter((e) => e.available).length} /{' '}
                      {inventory.length} USABLE
                    </Badge>
                  </div>
                </div>

                <div className="hairline-telemetry-list">
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
                          onClick={() => {
                            setInventory((v) =>
                              v.map((x) =>
                                x.name === e.name
                                  ? { ...x, available: !x.available }
                                  : x
                              )
                            );
                            if (e.name === 'Blood-pressure monitor') {
                              setFlags((f) => [!e.available, f[1], f[2], f[3]]);
                            }
                          }}
                        >
                          Mark {e.available ? 'Unavailable' : 'Usable'}
                        </button>
                      </article>
                    ))}
                </div>
              </section>

              <aside className="right-frosted-sheet">
                <div className="wide-planetary-label left-aligned">
                  E Q U I P M E N T &nbsp; R E A D I N E S S
                </div>
                <dl className="hairline-telemetry-list compact-list">
                  <div className="telemetry-kv-row compact">
                    <dt>Tracked Medical Items:</dt>
                    <dd>{inventory.length} Items</dd>
                  </div>
                  <div className="telemetry-kv-row compact">
                    <dt>Currently Usable:</dt>
                    <dd>
                      {inventory.filter((e) => e.available).length} Available
                    </dd>
                  </div>
                  <div className="telemetry-kv-row compact">
                    <dt>Blood-Pressure Monitor:</dt>
                    <dd className={!flags[0] ? 'unknown-val' : ''}>
                      {flags[0] ? 'Available' : 'Unavailable'}
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>
          </div>
        )}

        <footer>
          <span>MEDNAV · ASTRONAUT HEALTH MONITORING</span>
          <span>SYNTHETIC DATA · OFFLINE MODE</span>
        </footer>
      </main>
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
}: {
  crew: Crew;
  save: (c: Crew) => void;
  investigate: () => void;
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
                  onClick={() => {
                    save(draft);
                    setSaved(true);
                  }}
                >
                  <span>Save Check-In</span>
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (Boolean(sys) !== Boolean(dia)) {
                  setError(
                    'Enter both blood-pressure values or leave both Unknown.'
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
                        type="number"
                        min={i === 1 || i === 5 ? 0 : 0.01}
                        max={i === 1 ? 24 : undefined}
                        step="any"
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

export { Panel };

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
