import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  SlidersHorizontal,
  RotateCcw,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
} from 'recharts';
import { history, type Crew, type Equipment } from '../data/fixtures';
import { getScenario } from '../data/scenarios';
import '../console.css';

type Props = {
  crew: Crew;
  profiles: Crew[];
  onSelectCrew: (id: string) => void;
  inventory: Equipment[];
  flags: boolean[];
  setFlags: (f: boolean[]) => void;
  page: number;
  go: (p: number) => void;
};

const labels = [
  'BP monitor available',
  'BP record available',
  'Earth link online',
  'Manual emergency override',
];

const evidence = {
  readings: {
    title: 'Recorded observations',
    text: 'Heart rate and sleep compared against personal baseline.',
    links: ['known', 'next'],
  },
  bp: {
    title: 'Blood-pressure evidence',
    text: 'Record state and monitor availability are tracked separately.',
    links: ['unknown', 'resource', 'next'],
  },
  resources: {
    title: 'Resource dependency',
    text: 'Unavailable equipment blocks only checks that require it.',
    links: ['resource', 'next'],
  },
  next: {
    title: 'Next step selection',
    text: 'Selected from verified mission checklists.',
    links: ['known', 'unknown', 'resource', 'next'],
  },
};

export function MissionConsole({
  crew,
  profiles,
  onSelectCrew,
  inventory,
  flags,
  setFlags,
  page,
  go,
}: Props) {
  const [selected, setSelected] = useState<keyof typeof evidence>('bp');
  const [drawer, setDrawer] = useState(false);
  const [dayIndex, setDayIndex] = useState(history.length - 1);

  const candidate = getScenario(flags);
  const response = candidate?.next_check?.equipment.some(
    (name) =>
      name !== 'Blood-pressure monitor' &&
      !inventory.some((e) => e.name === name && e.available)
  )
    ? null
    : candidate;

  const focus = evidence[selected];
  const bp = flags[1] ? (crew.bp ?? response?.observations.bp ?? null) : null;
  const monitor = flags[0];

  const missing = [
    crew.hr === null ? 'Heart rate' : null,
    crew.sleep === null ? 'Sleep' : null,
    ...(response?.missing_data ?? ['No scenario record']),
  ].filter(Boolean);

  const toggleFlag = (i: number) =>
    setFlags(flags.map((v, j) => (j === i ? !v : v)));

  const knownVitalsCount =
    (crew.hr !== null ? 1 : 0) +
    (crew.sleep !== null ? 1 : 0) +
    (bp !== null ? 1 : 0);

  const usableEquipCount = inventory.filter((e) =>
    e.name === 'Blood-pressure monitor' ? monitor : e.available
  ).length;

  const crewKey = crew.id.slice(-1).toLowerCase() as 'a' | 'b' | 'c';
  const activeHistoryDay = history[dayIndex] ?? history[history.length - 1];
  const dayHr = activeHistoryDay[crewKey];
  const daySleep = activeHistoryDay[`s${crewKey}` as 'sa' | 'sb' | 'sc'];

  // ---------------------------------------------------------------------------
  // VIEW 0: ASTRONAUT HEALTH OVERVIEW
  // ---------------------------------------------------------------------------
  if (page === 0) {
    return (
      <div className="space-home">
        {/* HERO SECTION */}
        <section className="orbital-hero-section">
          <div className="orbital-horizon-art" aria-hidden="true">
            <img
              src="/Bruce_McCandless_II_during_EVA_in_1984.jpg"
              alt=""
              className="hero-eva-photo"
            />
            <div className="hero-eva-vignette" />
          </div>

          <div className="hero-left-column">
            <div className="wide-planetary-label left-aligned">
              C R E W &nbsp; H E A L T H &nbsp; M O N I T O R &nbsp; · &nbsp; D A Y &nbsp; 1 8 0
            </div>

            <h1 className="editorial-serif-headline">
              Clear Observations.
              <br />
              Missing-Data Awareness.
              <br />
              Resource-Safe Next Checks.
            </h1>

            <p className="hero-lead-subtitle">
              {crew.id} ({crew.role}) · {knownVitalsCount} of 3 vital signs
              recorded.{' '}
              {response?.next_check?.title ?? 'Escalation Protocol Active'}.
            </p>

            <div
              className="crew-switcher-strip"
              role="region"
              aria-label="Select active crew member"
            >
              {profiles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`hairline-pill-btn ${
                    c.id === crew.id ? 'active' : ''
                  }`}
                  onClick={() => onSelectCrew(c.id)}
                  aria-pressed={c.id === crew.id}
                >
                  {c.id}
                </button>
              ))}
            </div>

            <div className="hero-cta-group">
              <button
                type="button"
                className="ghost-rect-cta"
                onClick={() => go(2)}
              >
                <span>Open Health Investigation</span>
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* VITAL SIGNS & BASELINE DETAIL SECTION */}
        <section className="telemetry-detail-section">
          <div className="telemetry-left-column">
            <h2 className="section-sans-headline">
              {crew.id}: Vital Signs &amp; Baseline Status
            </h2>

            <p className="telemetry-summary-copy">
              {response?.explanation.selected}{' '}
              {missing.length > 0
                ? `Unmeasured readings (${missing.join(', ')}) remain flagged as Unknown and are never assumed normal.`
                : 'All primary vital signs are recorded for medical officer review.'}
            </p>

            <dl className="hairline-telemetry-list">
              <div className="telemetry-kv-row rail-reading">
                <dt>Heart Rate:</dt>
                <dd className={crew.hr === null ? 'unknown-val' : ''}>
                  {crew.hr === null
                    ? 'Unknown'
                    : `${crew.hr} bpm (Baseline ${crew.baseline} bpm)`}
                </dd>
              </div>

              <div className="telemetry-kv-row rail-reading">
                <dt>Blood Pressure:</dt>
                <dd className={!bp ? 'unknown-val' : ''}>
                  {bp ? `${bp} mmHg` : 'Unknown'}
                </dd>
              </div>

              <div className="telemetry-kv-row rail-reading">
                <dt>Sleep Duration:</dt>
                <dd className={crew.sleep === null ? 'unknown-val' : ''}>
                  {crew.sleep === null
                    ? 'Unknown'
                    : `${crew.sleep} hrs (Baseline ${crew.sleepBaseline} hrs)`}
                </dd>
              </div>

              <div className="telemetry-kv-row">
                <dt>Reported Symptoms:</dt>
                <dd>{crew.symptoms.join(', ') || 'None reported'}</dd>
              </div>

              <div className="telemetry-kv-row">
                <dt>Medical Equipment:</dt>
                <dd>
                  {usableEquipCount} / {inventory.length} Usable · BP Monitor{' '}
                  {monitor ? 'Available' : 'Unavailable'}
                </dd>
              </div>

              <div className="telemetry-kv-row">
                <dt>Recommended Next Check:</dt>
                <dd>
                  {response?.next_check?.title ?? 'Escalation Protocol'}
                </dd>
              </div>
            </dl>

            <div className="slide-action-pill-track">
              <button
                type="button"
                className="slide-pill-secondary"
                onClick={() => go(1)}
              >
                New Health Check-In
              </button>
              <button
                type="button"
                className="slide-pill-thumb"
                onClick={() => go(2)}
                aria-label="Open Health Investigation"
              >
                <span>Investigate</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>

          <div className="telemetry-right-sphere-col">
            <div className="orbital-trend-card" onClick={() => go(2)}>
              <div className="trend-card-head">
                <span className="wide-planetary-label">
                  7 - D A Y &nbsp; H E A R T &nbsp; R A T E &nbsp; T R E N D
                </span>
                <span className="trend-sub-val">
                  D174–D180 · Synthetic
                </span>
              </div>
              <div className="trend-chart-wrap">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="cobaltGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5B9BD5" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#1E4D8C" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      stroke="rgba(255,255,255,0.35)"
                      tick={{ fill: '#A1A1AA', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey={crewKey}
                      stroke="#5B9BD5"
                      strokeWidth={2}
                      fill="url(#cobaltGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 5: INCIDENT REPORT
  // ---------------------------------------------------------------------------
  if (page === 5) {
    return (
      <div className="mission-console space-subpage">
        <div className="subpage-top-bar">
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => go(2)}
          >
            <ArrowLeft size={16} /> Back to Investigation
          </button>
          <div className="wide-planetary-label">
            I N C I D E N T &nbsp; R E P O R T
          </div>
          <span className="hairline-status-tag">
            PENDING GROUND REVIEW · OFFLINE
          </span>
        </div>

        <div className="asymmetric-workspace-grid">
          <section className="left-telemetry-column">
            <h1 className="section-sans-headline">
              {response?.id ?? 'No demo fixture available'} / {crew.id}
            </h1>
            <p className="telemetry-summary-copy">
              {response?.explanation.selected}
            </p>

            <dl className="hairline-telemetry-list">
              {[
                ['Heart rate:', crew.hr === null ? 'Unknown' : `${crew.hr} bpm`],
                ['Sleep:', crew.sleep === null ? 'Unknown' : `${crew.sleep} hours`],
                ['Blood pressure:', bp ?? 'Unknown'],
                ['Symptoms:', crew.symptoms.join(', ') || 'None reported'],
                ['Missing information:', missing.join(', ') || 'No missing form readings'],
                ['BP monitor:', monitor ? 'Available' : 'Unavailable'],
                ['Earth link:', flags[2] ? 'Online (simulated)' : 'Offline'],
                ['Status:', response?.status ?? 'No demo fixture available'],
                ['Example next check:', response?.next_check?.title ?? 'None'],
              ].map(([k, v]) => (
                <div className="telemetry-kv-row" key={k}>
                  <dt>{k}</dt>
                  <dd className={v === 'Unknown' ? 'unknown-val' : ''}>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="right-frosted-sheet">
            <div className="wide-planetary-label left-aligned">
              C H E C K L I S T &nbsp; R A T I O N A L E
            </div>
            <h3>Why This Next Step Was Selected</h3>
            <p>{response?.explanation.selected}</p>
            <p>{response?.explanation.excluded}</p>

            <div className="sheet-divider" />

            <div className="telemetry-kv-row compact">
              <dt>Data Source:</dt>
              <dd>Synthetic Demo Record</dd>
            </div>
            <div className="telemetry-kv-row compact">
              <dt>Clinical Scope:</dt>
              <dd>Non-Diagnostic Check Navigation</dd>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 3: MISSION WHAT-IF LAB
  // ---------------------------------------------------------------------------
  if (page === 3) {
    return (
      <div className="mission-console space-subpage">
        <div className="subpage-top-bar">
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => go(0)}
          >
            <ArrowLeft size={16} /> Overview
          </button>
          <div className="wide-planetary-label">
            W H A T - I F &nbsp; S C E N A R I O &nbsp; L A B
          </div>
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => setFlags([false, false, false, false])}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        <div className="asymmetric-workspace-grid">
          <section className="left-telemetry-column" aria-label="What-if controls">
            <h1 className="section-sans-headline">
              Simulate Health &amp; Equipment Conditions
            </h1>
            <p className="telemetry-summary-copy">
              Toggle missing measurements, blood-pressure monitor availability,
              and manual safety override to compare deterministic next-check
              selection.
            </p>

            <div className="preset-hairline-row">
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, false, false, false])}
              >
                Default (Monitor Blocked)
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([true, false, false, false])}
              >
                BP Monitor Ready
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, true, false, false])}
              >
                BP Recorded
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, false, false, true])}
              >
                Emergency Override
              </button>
            </div>

            <div className="hairline-telemetry-list">
              {labels.map((l, i) => (
                <button
                  key={l}
                  role="switch"
                  aria-checked={flags[i]}
                  aria-label={l}
                  onClick={() => toggleFlag(i)}
                  className={`telemetry-switch-row ${flags[i] ? 'active' : ''}`}
                >
                  <span>{l}</span>
                  <span className="switch-state-indicator">
                    {flags[i] ? 'ACTIVE ◆' : 'INACTIVE —'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <aside className="right-frosted-sheet" aria-label="Decision trace">
            <div className="wide-planetary-label left-aligned">
              {response?.status === 'escalate'
                ? 'E S C A L A T I O N   S T A T E'
                : response?.status === 'resource-unavailable'
                ? 'R E S O U R C E   U N A V A I L A B L E'
                : 'O F F I C E R   R E V I E W'}
            </div>

            <h2>
              {response?.next_check?.title ??
                (response ? 'Routine checks paused' : 'No demo fixture available')}
            </h2>

            <dl className="hairline-telemetry-list compact-list">
              <div className="telemetry-kv-row compact">
                <dt>Blood Pressure:</dt>
                <dd className={!bp ? 'unknown-val' : ''}>
                  {bp ? `${bp} mmHg` : 'Unknown'}
                </dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>BP Monitor:</dt>
                <dd>{monitor ? 'Available' : 'Unavailable'}</dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>Required Equipment:</dt>
                <dd>
                  {response?.next_check?.equipment.join(', ') ??
                    'None — no next check'}
                </dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>Scenario ID:</dt>
                <dd>{response?.id ?? 'UNSUPPORTED'}</dd>
              </div>
            </dl>

            <div className="trace-copy-block">
              <span className="micro-label">WHY SELECTED</span>
              <p>{response?.explanation.selected}</p>
            </div>

            <div className="trace-copy-block">
              <span className="micro-label">WHY EXCLUDED</span>
              <p>{response?.explanation.excluded}</p>
            </div>

            <button
              type="button"
              className="ghost-rect-cta full-width"
              onClick={() => go(5)}
            >
              <span>View Incident Report</span>
              <ArrowUpRight size={18} />
            </button>
          </aside>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: HEALTH INVESTIGATION (EVIDENCE & NEXT-CHECK NAVIGATION)
  // ---------------------------------------------------------------------------
  return (
    <div className="mission-console mars-configurator-screen">
      <div className="mars-top-header">
        <button
          type="button"
          className="hairline-pill-btn"
          onClick={() => go(0)}
        >
          <ArrowLeft size={15} /> Overview
        </button>

        <div className="wide-planetary-label">
          H E A L T H &nbsp; I N V E S T I G A T I O N
        </div>

        <button
          type="button"
          className="hairline-pill-btn"
          aria-expanded={drawer}
          onClick={() => setDrawer(!drawer)}
        >
          <SlidersHorizontal size={15} />
          {drawer ? 'Close What-If' : 'What-If Controls'}
        </button>
      </div>

      {drawer && (
        <section className="orbital-scenario-drawer" aria-label="What-if controls">
          <div className="drawer-switches-grid">
            {labels.map((l, i) => (
              <button
                key={l}
                role="switch"
                aria-checked={flags[i]}
                aria-label={l}
                onClick={() => toggleFlag(i)}
                className={`telemetry-switch-row ${flags[i] ? 'active' : ''}`}
              >
                <strong>{l}</strong>
                <span className="switch-state-indicator">
                  {flags[i] ? 'ON ◆' : 'OFF —'}
                </span>
              </button>
            ))}
          </div>
          <div className="drawer-reset-bar">
            <button
              type="button"
              className="hairline-pill-btn"
              onClick={() => setFlags([false, false, false, false])}
            >
              Reset to original
            </button>
          </div>
        </section>
      )}

      {/* Upper 7-Day Vital History Scrubber */}
      <div className="vital-history-scrubber-bar">
        <div className="gesture-360-overlay">
          <div className="wide-planetary-label">
            I n s p e c t &nbsp; 7 - D a y &nbsp; V i t a l &nbsp; H i s t o r y
          </div>
          <div className="diamond-scrub-control">
            <span className="scrub-line" />
            <input
              type="range"
              min={0}
              max={history.length - 1}
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              aria-label="Scrub 7-day vital history"
              className="diamond-range-input"
            />
            <span className="diamond-node" aria-hidden="true">
              ◆
            </span>
            <span className="scrub-line" />
          </div>
          <span className="scrub-angle-readout">
            {activeHistoryDay.day.toUpperCase()} · HR {dayHr ?? 'UNKNOWN'} BPM ·
            SLEEP {daySleep ?? 'UNKNOWN'} HRS
          </span>
        </div>
      </div>

      {/* Lower Frosted Glass Evidence & Decision Trace Sheet */}
      <div className="frosted-telemetry-sheet">
        <div className="sheet-two-col-layout">
          <div className="sheet-specs-col" aria-label="Evidence tiers">
            <div className="inline-telemetry-specs">
              <div className="spec-inline-row">
                <span>Crew Member:</span>{' '}
                <strong>
                  {crew.id} ({crew.role})
                </strong>
              </div>
              <div className="spec-inline-row">
                <span>Recorded Vitals:</span>{' '}
                <strong>{knownVitalsCount} / 3 Known</strong>
              </div>
              <div className="spec-inline-row">
                <span>Missing Data:</span>{' '}
                <strong className={missing.length > 0 ? 'unknown-val' : ''}>
                  {missing.length > 0 ? missing.join(', ') : 'None'}
                </strong>
              </div>
            </div>

            <div className="orbital-evidence-stack">
              <div
                className={`evidence-stage-card ${
                  focus.links.includes('known') ? 'linked' : ''
                }`}
              >
                <div className="stage-card-head">
                  <span>01 · KNOWN OBSERVATIONS</span>
                  <span>RECORDED</span>
                </div>
                <button
                  type="button"
                  className={`evidence-item ${
                    selected === 'readings' ? 'chosen' : ''
                  }`}
                  onClick={() => setSelected('readings')}
                  aria-pressed={selected === 'readings'}
                >
                  <span>
                    <strong>Readings &amp; reported symptoms</strong>
                    <small>
                      HR {crew.hr ?? 'Unknown'} · Sleep {crew.sleep ?? 'Unknown'}{' '}
                      · {crew.symptoms.join(', ') || 'No symptoms'}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </div>

              <div
                className={`evidence-stage-card missing-stage ${
                  focus.links.includes('unknown') ? 'linked' : ''
                }`}
              >
                <div className="stage-card-head">
                  <span>02 · MISSING MEASUREMENTS</span>
                  <span>{missing.length ? 'INCOMPLETE' : 'COMPLETE'}</span>
                </div>
                <button
                  type="button"
                  className={`evidence-item ${selected === 'bp' ? 'chosen' : ''}`}
                  onClick={() => setSelected('bp')}
                  aria-pressed={selected === 'bp'}
                >
                  <span>
                    <strong>Blood pressure</strong>
                    <small className={!bp ? 'unknown-val' : ''}>
                      {bp ? `${bp} mmHg` : 'Unknown'}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>

                <button
                  type="button"
                  className={`resource-link ${monitor ? 'available ' : ''}${
                    selected === 'resources' ? 'chosen' : ''
                  }`}
                  onClick={() => setSelected('resources')}
                  aria-pressed={selected === 'resources'}
                >
                  <span>
                    {monitor
                      ? 'BP monitor available'
                      : 'Blocked: BP monitor unavailable'}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              </div>

              <div
                className={`evidence-stage-card next-stage ${
                  response?.status === 'escalate' ? 'escalation ' : ''
                }${focus.links.includes('next') ? 'linked' : ''}`}
              >
                <div className="stage-card-head">
                  <span>03 · FEASIBLE NEXT CHECK</span>
                  <span>
                    {response?.status === 'escalate' ? 'ESCALATED' : 'FEASIBLE'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`evidence-item ${
                    selected === 'next' ? 'chosen' : ''
                  }`}
                  onClick={() => setSelected('next')}
                  aria-pressed={selected === 'next'}
                >
                  <span>
                    <strong>
                      {response
                        ? (response.next_check?.title ?? 'No next check')
                        : 'No demo fixture available'}
                    </strong>
                    <small>
                      {response?.status === 'escalate'
                        ? 'Manual emergency override'
                        : 'Medical officer review required'}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <aside className="decision-trace" aria-label="Decision trace">
            <div className="trace-header-line">
              <span className="wide-planetary-label left-aligned">
                D E C I S I O N &nbsp; T R A C E
              </span>
              <span
                className={
                  'trace-status ' +
                  (response?.status === 'escalate' ? 'escalation' : '')
                }
              >
                {response?.status === 'escalate'
                  ? 'ESCALATION DEMO STATE'
                  : response?.status === 'resource-unavailable'
                  ? 'RESOURCE UNAVAILABLE'
                  : response
                  ? 'OFFICER REVIEW PENDING'
                  : 'NO DEMO FIXTURE AVAILABLE'}
              </span>
            </div>

            <h2>
              {response?.next_check?.title ??
                (response ? 'Routine checks paused' : 'No demo fixture available')}
            </h2>

            <div className="selection-context" aria-live="polite">
              <strong>{focus.title}</strong>
              <p>{focus.text}</p>
            </div>

            <div className="trace-section">
              <span className="micro-label">WHY SELECTED</span>
              <p>{response?.explanation.selected}</p>
            </div>

            <div className="trace-section">
              <span className="micro-label">WHY EXCLUDED</span>
              <p>{response?.explanation.excluded}</p>
            </div>

            <div className="trace-section">
              <span className="micro-label">REQUIRED EQUIPMENT</span>
              <p>
                {response?.next_check?.equipment.join(', ') ??
                  'None — no next check'}
              </p>
            </div>
          </aside>
        </div>

        <div className="landing-zone-footer">
          <div className="landing-zone-prompt">
            Recommended Next Check &amp; Ground Handoff Record
          </div>

          <div className="segmented-launch-bar">
            <button
              type="button"
              className="segmented-left-pill"
              onClick={() => setDrawer(!drawer)}
            >
              <span>
                {response?.next_check?.title ?? 'Escalation Protocol'} ·{' '}
                {crew.id}
              </span>
            </button>

            <button
              type="button"
              className="segmented-right-trigger"
              onClick={() => go(5)}
            >
              <span>Incident Report</span>
              <span className="launch-circle-icon">
                <FileText size={16} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
