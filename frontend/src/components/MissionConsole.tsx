import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  SlidersHorizontal,
  RotateCcw,
  FileText,
  HeartPulse,
  Stethoscope,
  Moon,
  Activity,
  ShieldAlert,
  Package,
  Radiation,
  Dumbbell,
  Eye,
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
    title: 'Recorded vital & environmental observations',
    text: 'Heart rate, sleep, radiation dosimetry, and microgravity countermeasure load compared against personal baseline.',
    links: ['known', 'next'],
  },
  bp: {
    title: 'Missing measurements (BP & Ocular)',
    text: 'Unmeasured blood pressure, radiation, or microgravity ocular checks remain explicitly Unknown and are tracked separately from equipment state.',
    links: ['unknown', 'resource', 'next'],
  },
  resources: {
    title: 'Onboard equipment dependency',
    text: 'Unavailable equipment (such as BP monitor or Ultrasound unit) blocks only checks that require it.',
    links: ['resource', 'next'],
  },
  next: {
    title: 'Next step selection',
    text: 'Selected deterministically from verified mission checklists.',
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
  const [trendMode, setTrendMode] = useState<'hr' | 'rad' | 'ug'>('hr');

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

  const dosimeterAvailable =
    inventory.find((e) => e.name === 'Personal radiation dosimeter')?.available ?? true;
  const ultrasoundAvailable =
    inventory.find((e) => e.name === 'Ultrasound unit')?.available ?? false;

  const missing = [
    crew.hr === null ? 'Heart rate' : null,
    crew.sleep === null ? 'Sleep' : null,
    crew.radiationDailyMsv === null ? 'Daily radiation dose' : null,
    crew.ocularCheck === null ? 'Microgravity ocular check' : null,
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
  const dayRad = activeHistoryDay[`r${crewKey}` as 'ra' | 'rb' | 'rc'];
  const dayCounter = activeHistoryDay[`c${crewKey}` as 'ca' | 'cb' | 'cc'];

  // ---------------------------------------------------------------------------
  // VIEW 0: ASTRONAUT HEALTH OVERVIEW (WITH SPACE RADIATION & MICROGRAVITY)
  // ---------------------------------------------------------------------------
  if (page === 0) {
    const trendDataKey =
      trendMode === 'hr'
        ? crewKey
        : trendMode === 'rad'
        ? (`r${crewKey}` as const)
        : (`c${crewKey}` as const);
    const trendColor =
      trendMode === 'hr'
        ? '#5B9BD5'
        : trendMode === 'rad'
        ? '#F5A623'
        : '#9D7BFF';

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
              {crew.id} ({crew.role}) · {knownVitalsCount}/3 vitals · Radiation{' '}
              {crew.radiationDailyMsv !== null
                ? `${crew.radiationDailyMsv} mSv/d`
                : 'Unknown'}{' '}
              · {response?.next_check?.title ?? 'Escalation Protocol Active'}.
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

        {/* OVERVIEW HEALTH STATUS DASHBOARD (CARD-BASED PRESENTATION) */}
        <section
          className="overview-dashboard-section"
          aria-label="Crew health status dashboard"
        >
          <div className="dashboard-header-bar">
            <div>
              <div className="wide-planetary-label left-aligned">
                L I V E &nbsp; H E A L T H &nbsp; D A S H B O A R D &nbsp; · &nbsp; S Y N T H E T I C &nbsp; D A T A
              </div>
              <h2 className="section-sans-headline">
                {crew.id} Status Overview · {crew.role}
              </h2>
            </div>

            <div className="dashboard-header-actions">
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => go(1)}
              >
                + Log Check-In
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => go(3)}
              >
                What-If Simulator
              </button>
            </div>
          </div>

          {/* ROW 1: 4 PRIMARY VITAL & SYMPTOM STATUS CARDS */}
          <div className="dashboard-kpi-grid">
            {/* Card 1: Heart Rate */}
            <article className="status-kpi-card rail-reading" onClick={() => go(1)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge">
                  <HeartPulse size={18} />
                </span>
                <span
                  className={`kpi-status-pill ${
                    crew.hr === null ? 'amber' : 'ok'
                  }`}
                >
                  {crew.hr === null ? 'UNKNOWN' : 'RECORDED'}
                </span>
              </div>
              <div className="kpi-card-value">
                <strong className={crew.hr === null ? 'unknown-val' : ''}>
                  {crew.hr ?? 'Unknown'}
                </strong>
                {crew.hr !== null && <small>bpm</small>}
              </div>
              <span className="kpi-card-label">Heart Rate</span>
              <div className="kpi-card-footer">
                <span>Baseline: {crew.baseline} bpm</span>
                <span>
                  {crew.hr !== null
                    ? `${crew.hr - crew.baseline >= 0 ? '+' : ''}${
                        crew.hr - crew.baseline
                      } bpm`
                    : 'Not measured'}
                </span>
              </div>
            </article>

            {/* Card 2: Blood Pressure */}
            <article className="status-kpi-card rail-reading" onClick={() => go(2)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge">
                  <Stethoscope size={18} />
                </span>
                <span className={`kpi-status-pill ${!bp ? 'amber' : 'ok'}`}>
                  {bp ? 'RECORDED' : 'MISSING'}
                </span>
              </div>
              <div className="kpi-card-value">
                <strong className={!bp ? 'unknown-val' : ''}>
                  {bp ?? 'Unknown'}
                </strong>
                {bp && <small>mmHg</small>}
              </div>
              <span className="kpi-card-label">Blood Pressure</span>
              <div className="kpi-card-footer">
                <span>Monitor: {monitor ? 'Available' : 'Unavailable'}</span>
                <span>{bp ? 'Verified' : 'Never assumed normal'}</span>
              </div>
            </article>

            {/* Card 3: Sleep Duration */}
            <article className="status-kpi-card rail-reading" onClick={() => go(1)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge">
                  <Moon size={18} />
                </span>
                <span
                  className={`kpi-status-pill ${
                    crew.sleep === null ? 'amber' : 'ok'
                  }`}
                >
                  {crew.sleep === null ? 'UNKNOWN' : 'RECORDED'}
                </span>
              </div>
              <div className="kpi-card-value">
                <strong className={crew.sleep === null ? 'unknown-val' : ''}>
                  {crew.sleep ?? 'Unknown'}
                </strong>
                {crew.sleep !== null && <small>hrs</small>}
              </div>
              <span className="kpi-card-label">Sleep Duration</span>
              <div className="kpi-card-footer">
                <span>Baseline: {crew.sleepBaseline} hrs</span>
                <span>
                  {crew.sleep !== null
                    ? `${crew.sleep - crew.sleepBaseline >= 0 ? '+' : ''}${(
                        crew.sleep - crew.sleepBaseline
                      ).toFixed(1)} hrs`
                    : 'Not measured'}
                </span>
              </div>
            </article>

            {/* Card 4: Symptoms & Vital Completeness */}
            <article className="status-kpi-card" onClick={() => go(1)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge">
                  <Activity size={18} />
                </span>
                <span
                  className={`kpi-status-pill ${
                    knownVitalsCount === 3 ? 'ok' : 'amber'
                  }`}
                >
                  {knownVitalsCount}/3 VITALS
                </span>
              </div>
              <div className="kpi-card-value symptom-val">
                <strong>
                  {crew.symptoms.length > 0
                    ? crew.symptoms.join(', ')
                    : 'No Symptoms'}
                </strong>
              </div>
              <span className="kpi-card-label">Reported Symptoms</span>
              <div className="kpi-card-footer">
                <span>
                  {missing.length > 0
                    ? `${missing.length} parameter(s) unknown`
                    : 'Complete record'}
                </span>
              </div>
            </article>
          </div>

          {/* ROW 2: SPACE RADIATION & MICROGRAVITY EFFECTS CARDS */}
          <div className="roster-section-head">
            <span className="wide-planetary-label left-aligned">
              S P A C E &nbsp; R A D I A T I O N &nbsp; &amp; &nbsp; M I C R O G R A V I T Y &nbsp; E F F E C T S &nbsp; ( S Y N T H E T I C )
            </span>
          </div>

          <div className="space-hazards-grid">
            {/* Hazard Card 1: Space Radiation Dosimetry */}
            <article className="status-kpi-card" onClick={() => go(1)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge amber-icon">
                  <Radiation size={18} />
                </span>
                <span
                  className={`kpi-status-pill ${
                    crew.radiationDailyMsv === null
                      ? 'amber'
                      : crew.radiationDailyMsv > crew.radiationBaselineMsv + 0.08
                      ? 'amber'
                      : 'ok'
                  }`}
                >
                  {crew.radiationDailyMsv === null
                    ? 'UNKNOWN'
                    : crew.radiationDailyMsv > crew.radiationBaselineMsv + 0.08
                    ? 'ELEVATED GCR/SPE'
                    : 'RECORDED'}
                </span>
              </div>

              <div className="kpi-card-value">
                <strong
                  className={crew.radiationDailyMsv === null ? 'unknown-val' : ''}
                >
                  {crew.radiationDailyMsv ?? 'Unknown'}
                </strong>
                {crew.radiationDailyMsv !== null && <small>mSv/day</small>}
              </div>

              <span className="kpi-card-label">Space Radiation Dosimetry</span>

              <div className="hazard-detail-rows">
                <div className="hazard-kv">
                  <span>Cumulative (180d):</span>
                  <b
                    className={
                      crew.radiationCumulativeMsv === null ? 'unknown-val' : ''
                    }
                  >
                    {crew.radiationCumulativeMsv !== null
                      ? `${crew.radiationCumulativeMsv} mSv`
                      : 'Unknown'}
                  </b>
                </div>
                <div className="hazard-kv">
                  <span>Transit Baseline:</span>
                  <b>{crew.radiationBaselineMsv} mSv/day</b>
                </div>
              </div>

              <div className="kpi-card-footer">
                <span>
                  Dosimeter: {dosimeterAvailable ? 'Available' : 'Unavailable'}
                </span>
                <span>Synthetic Demo</span>
              </div>
            </article>

            {/* Hazard Card 2: Microgravity Countermeasure & Bone/Muscle Load */}
            <article className="status-kpi-card" onClick={() => go(1)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge purple-icon">
                  <Dumbbell size={18} />
                </span>
                <span
                  className={`kpi-status-pill ${
                    crew.countermeasureMin === null
                      ? 'amber'
                      : crew.countermeasureMin < crew.countermeasureTargetMin
                      ? 'amber'
                      : 'ok'
                  }`}
                >
                  {crew.countermeasureMin === null
                    ? 'UNKNOWN'
                    : crew.countermeasureMin >= crew.countermeasureTargetMin
                    ? 'PROTOCOL MET'
                    : 'BELOW TARGET'}
                </span>
              </div>

              <div className="kpi-card-value">
                <strong
                  className={crew.countermeasureMin === null ? 'unknown-val' : ''}
                >
                  {crew.countermeasureMin ?? 'Unknown'}
                </strong>
                {crew.countermeasureMin !== null && (
                  <small>/ {crew.countermeasureTargetMin} min</small>
                )}
              </div>

              <span className="kpi-card-label">
                Microgravity Countermeasure (ARED)
              </span>

              <div className="hazard-detail-rows">
                <div className="hazard-kv">
                  <span>Body Mass (SLAMMD):</span>
                  <b className={crew.bodyMassKg === null ? 'unknown-val' : ''}>
                    {crew.bodyMassKg !== null
                      ? `${crew.bodyMassKg} kg`
                      : 'Unknown'}
                  </b>
                </div>
                <div className="hazard-kv">
                  <span>Pre-Flight Baseline:</span>
                  <b>
                    {crew.baselineMassKg} kg
                    {crew.bodyMassKg !== null
                      ? ` (${(crew.bodyMassKg - crew.baselineMassKg).toFixed(1)} kg)`
                      : ''}
                  </b>
                </div>
              </div>

              <div className="kpi-card-footer">
                <span>Deconditioning log</span>
                <span>Synthetic Demo</span>
              </div>
            </article>

            {/* Hazard Card 3: Microgravity Fluid Shift & Ocular (SANS) Check */}
            <article className="status-kpi-card" onClick={() => go(4)}>
              <div className="kpi-card-top">
                <span className="kpi-icon-badge">
                  <Eye size={18} />
                </span>
                <span
                  className={`kpi-status-pill ${
                    crew.ocularCheck === null ? 'amber' : 'ok'
                  }`}
                >
                  {crew.ocularCheck === null ? 'UNKNOWN' : 'RECORDED'}
                </span>
              </div>

              <div className="kpi-card-value symptom-val">
                <strong className={crew.ocularCheck === null ? 'unknown-val' : ''}>
                  {crew.ocularCheck ?? 'Unknown (Unmeasured)'}
                </strong>
              </div>

              <span className="kpi-card-label">
                Microgravity Ocular &amp; Fluid-Shift Check (SANS)
              </span>

              <div className="hazard-detail-rows">
                <div className="hazard-kv">
                  <span>Ultrasound Unit:</span>
                  <b className={!ultrasoundAvailable ? 'unknown-val' : ''}>
                    {ultrasoundAvailable ? 'Available' : 'Unavailable'}
                  </b>
                </div>
                <div className="hazard-kv">
                  <span>Safety Rule:</span>
                  <b>Never inferred from vitals</b>
                </div>
              </div>

              <div className="kpi-card-footer">
                <span>
                  {ultrasoundAvailable
                    ? 'Ocular scan feasible'
                    : 'Imaging check blocked'}
                </span>
                <span>Inventory →</span>
              </div>
            </article>
          </div>

          {/* ROW 3: NEXT-CHECK NAVIGATION CARD + MULTI-METRIC 7-DAY TREND CARD */}
          <div className="dashboard-middle-grid">
            <article className="next-check-status-card">
              <div className="nc-card-header">
                <span className="wide-planetary-label left-aligned">
                  N E X T - C H E C K &nbsp; N A V I G A T I O N
                </span>
                <span
                  className={`kpi-status-pill ${
                    response?.status === 'escalate'
                      ? 'coral'
                      : response?.status === 'resource-unavailable'
                      ? 'amber'
                      : 'ok'
                  }`}
                >
                  {response?.status === 'escalate'
                    ? 'ESCALATION PROTOCOL'
                    : response?.status === 'resource-unavailable'
                    ? 'RESOURCE UNAVAILABLE'
                    : 'OFFICER REVIEW PENDING'}
                </span>
              </div>

              <h3>
                {response?.next_check?.title ?? 'Escalation Protocol Active'}
              </h3>
              <p>{response?.explanation.selected}</p>

              <div className="nc-status-chips">
                <div className="nc-chip">
                  <Package size={14} />
                  <span>
                    Equipment: <b>{usableEquipCount}/{inventory.length} Usable</b>
                  </span>
                </div>
                <div className="nc-chip">
                  <ShieldAlert size={14} />
                  <span>
                    BP Monitor:{' '}
                    <b className={!monitor ? 'unknown-val' : ''}>
                      {monitor ? 'Available' : 'Unavailable'}
                    </b>
                  </span>
                </div>
                <div className="nc-chip">
                  <Eye size={14} />
                  <span>
                    Ultrasound:{' '}
                    <b className={!ultrasoundAvailable ? 'unknown-val' : ''}>
                      {ultrasoundAvailable ? 'Available' : 'Unavailable'}
                    </b>
                  </span>
                </div>
              </div>

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
            </article>

            <article className="orbital-trend-card">
              <div className="trend-card-head">
                <div>
                  <span className="wide-planetary-label left-aligned">
                    7 - D A Y &nbsp; T E L E M E T R Y &nbsp; T R E N D
                  </span>
                  <span className="trend-sub-val">
                    {crew.id} · D174–D180 (Synthetic)
                  </span>
                </div>

                <div className="trend-mode-pills">
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      trendMode === 'hr' ? 'active' : ''
                    }`}
                    onClick={() => setTrendMode('hr')}
                  >
                    Heart Rate
                  </button>
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      trendMode === 'rad' ? 'active' : ''
                    }`}
                    onClick={() => setTrendMode('rad')}
                  >
                    Radiation (mSv)
                  </button>
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      trendMode === 'ug' ? 'active' : ''
                    }`}
                    onClick={() => setTrendMode('ug')}
                  >
                    μG Exercise
                  </button>
                </div>
              </div>

              <div className="trend-chart-wrap" onClick={() => go(2)}>
                <ResponsiveContainer width="100%" height={195}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="cobaltGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={trendColor}
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="100%"
                          stopColor={trendColor}
                          stopOpacity={0.0}
                        />
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
                      dataKey={trendDataKey}
                      stroke={trendColor}
                      strokeWidth={2}
                      fill="url(#cobaltGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          {/* ROW 4: CREW HEALTH ROSTER CARDS */}
          <div className="roster-section-head">
            <span className="wide-planetary-label left-aligned">
              C R E W &nbsp; H E A L T H &nbsp; R O S T E R
            </span>
          </div>

          <div className="crew-roster-grid">
            {profiles.map((member) => {
              const isSelected = member.id === crew.id;
              const memberBp = isSelected ? bp : member.bp;
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`crew-roster-card ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectCrew(member.id)}
                >
                  <div className="roster-card-top">
                    <div>
                      <strong>{member.id}</strong>
                      <span>{member.role}</span>
                    </div>
                    <span
                      className={`kpi-status-pill ${
                        isSelected ? 'ok' : 'neutral'
                      }`}
                    >
                      {isSelected ? 'ACTIVE' : 'VIEW'}
                    </span>
                  </div>

                  <div className="roster-metrics-strip five-cols">
                    <div className="roster-mini-stat">
                      <small>HR</small>
                      <b className={member.hr === null ? 'unknown-val' : ''}>
                        {member.hr !== null ? `${member.hr} bpm` : 'Unknown'}
                      </b>
                    </div>
                    <div className="roster-mini-stat">
                      <small>SLEEP</small>
                      <b className={member.sleep === null ? 'unknown-val' : ''}>
                        {member.sleep !== null ? `${member.sleep} h` : 'Unknown'}
                      </b>
                    </div>
                    <div className="roster-mini-stat">
                      <small>BP</small>
                      <b className={!memberBp ? 'unknown-val' : ''}>
                        {memberBp ?? 'Unknown'}
                      </b>
                    </div>
                    <div className="roster-mini-stat">
                      <small>RAD</small>
                      <b
                        className={
                          member.radiationDailyMsv === null ? 'unknown-val' : ''
                        }
                      >
                        {member.radiationDailyMsv !== null
                          ? `${member.radiationDailyMsv} mSv`
                          : 'Unknown'}
                      </b>
                    </div>
                    <div className="roster-mini-stat">
                      <small>μG ARED</small>
                      <b
                        className={
                          member.countermeasureMin === null ? 'unknown-val' : ''
                        }
                      >
                        {member.countermeasureMin !== null
                          ? `${member.countermeasureMin}m`
                          : 'Unknown'}
                      </b>
                    </div>
                  </div>

                  <div className="roster-symptoms-line">
                    Symptoms: {member.symptoms.join(', ') || 'None reported'}
                  </div>
                </button>
              );
            })}
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
                [
                  'Space radiation (daily):',
                  crew.radiationDailyMsv === null
                    ? 'Unknown'
                    : `${crew.radiationDailyMsv} mSv/day (Baseline ${crew.radiationBaselineMsv} mSv/day)`,
                ],
                [
                  'Space radiation (180d cumulative):',
                  crew.radiationCumulativeMsv === null
                    ? 'Unknown'
                    : `${crew.radiationCumulativeMsv} mSv`,
                ],
                [
                  'Microgravity exercise (ARED):',
                  crew.countermeasureMin === null
                    ? 'Unknown'
                    : `${crew.countermeasureMin} / ${crew.countermeasureTargetMin} min`,
                ],
                [
                  'Microgravity body mass (SLAMMD):',
                  crew.bodyMassKg === null
                    ? 'Unknown'
                    : `${crew.bodyMassKg} kg (Baseline ${crew.baselineMassKg} kg)`,
                ],
                [
                  'Microgravity ocular check (SANS):',
                  crew.ocularCheck ?? 'Unknown',
                ],
                ['Symptoms:', crew.symptoms.join(', ') || 'None reported'],
                [
                  'Missing information:',
                  missing.join(', ') || 'No missing form readings',
                ],
                ['BP monitor:', monitor ? 'Available' : 'Unavailable'],
                [
                  'Ultrasound unit:',
                  ultrasoundAvailable ? 'Available' : 'Unavailable',
                ],
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

      {/* Upper 7-Day Vital, Radiation & Microgravity History Scrubber */}
      <div className="vital-history-scrubber-bar">
        <div className="gesture-360-overlay">
          <div className="wide-planetary-label">
            I n s p e c t &nbsp; 7 - D a y &nbsp; V i t a l &nbsp; &amp; &nbsp; R a d i a t i o n &nbsp; H i s t o r y
          </div>
          <div className="diamond-scrub-control">
            <span className="scrub-line" />
            <input
              type="range"
              min={0}
              max={history.length - 1}
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              aria-label="Scrub 7-day vital and radiation history"
              className="diamond-range-input"
            />
            <span className="diamond-node" aria-hidden="true">
              ◆
            </span>
            <span className="scrub-line" />
          </div>
          <span className="scrub-angle-readout">
            {activeHistoryDay.day.toUpperCase()} · HR {dayHr ?? 'UNKNOWN'} BPM ·
            SLEEP {daySleep ?? 'UNKNOWN'} HRS · RAD {dayRad ?? 'UNKNOWN'} mSv/d ·
            μG {dayCounter ?? 'UNKNOWN'} MIN
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
                <span>Radiation Dose:</span>{' '}
                <strong
                  className={crew.radiationDailyMsv === null ? 'unknown-val' : ''}
                >
                  {crew.radiationDailyMsv !== null
                    ? `${crew.radiationDailyMsv} mSv/d`
                    : 'Unknown'}
                </strong>
              </div>
              <div className="spec-inline-row">
                <span>μG Exercise:</span>{' '}
                <strong
                  className={crew.countermeasureMin === null ? 'unknown-val' : ''}
                >
                  {crew.countermeasureMin !== null
                    ? `${crew.countermeasureMin}/${crew.countermeasureTargetMin} min`
                    : 'Unknown'}
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
                    <strong>
                      Vitals, radiation dosimetry &amp; microgravity load
                    </strong>
                    <small>
                      HR {crew.hr ?? 'Unknown'} · Sleep {crew.sleep ?? 'Unknown'}{' '}
                      · Rad{' '}
                      {crew.radiationDailyMsv !== null
                        ? `${crew.radiationDailyMsv} mSv/d`
                        : 'Unknown'}{' '}
                      · ARED{' '}
                      {crew.countermeasureMin !== null
                        ? `${crew.countermeasureMin}m`
                        : 'Unknown'}
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
                    <strong>Blood pressure &amp; microgravity ocular check</strong>
                    <small className={!bp || !crew.ocularCheck ? 'unknown-val' : ''}>
                      BP: {bp ? `${bp} mmHg` : 'Unknown'} · Ocular:{' '}
                      {crew.ocularCheck ?? 'Unknown'}
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
                      : 'Blocked: BP monitor unavailable'}{' '}
                    · Ultrasound:{' '}
                    {ultrasoundAvailable ? 'Available' : 'Unavailable'}
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
