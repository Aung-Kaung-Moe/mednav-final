import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  HeartPulse,
  Moon,
  Eye,
  Activity,
  AlertCircle,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import type { Crew } from '../data/fixtures';
import {
  bodyRegion,
  orderedRecords,
  visualSymptoms,
} from '../data/bodyMonitoring';
import type { SavedCheckIn } from '../types/api';
import {
  BODY_SYSTEMS,
  reportedEvidence,
  systemEvidence,
} from '../data/bodyGraph';
import { baselineDifference } from '../data/missionMonitoring';

type Props = {
  part: string;
  crew: Crew;
  records: SavedCheckIn[];
  loading: boolean;
  error: string;
  onInvestigate: () => void;
  replaying?: boolean;
};

const timestamp = (value: string) =>
  new Date(value).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const shown = (value: number | string | null | undefined, unit = '') =>
  value == null ? 'Unknown' : `${value}${unit}`;

export function BodySystemMonitoring({
  part,
  crew,
  records,
  loading,
  error,
  onInvestigate,
  replaying = false,
}: Props) {
  const region = bodyRegion(part);
  if (!region) return null;

  let rows: SavedCheckIn[];
  try {
    rows = orderedRecords(records, crew.id);
  } catch {
    return (
      <p className="bsm-status error" role="alert">
        History unavailable: crew or timestamp mismatch.
      </p>
    );
  }
  if (loading) {
    return (
      <p className="bsm-status" role="status">
        Loading recorded observations for {crew.id}…
      </p>
    );
  }
  if (error) {
    return (
      <p className="bsm-status error" role="alert">
        History unavailable: {error}
      </p>
    );
  }

  const latest = rows.at(-1);
  const recent = rows.slice(-7);
  const label = BODY_SYSTEMS.find((s) => s.id === region)!.label;
  const evidence = systemEvidence(region, latest, crew);
  const reports = rows.filter((r) => reportedEvidence(region, r).length > 0);
  const lastEvidence = [...rows]
    .reverse()
    .find((r) => systemEvidence(region, r, crew).state.recorded);
  const field = region === 'heart' ? 'hr' : 'sleep';
  const unit = region === 'heart' ? ' bpm' : ' h';
  const baseline = region === 'heart' ? crew.baseline : crew.sleepBaseline;
  const observed = recent.filter((r) => r[field] !== null).length;
  const ocularReports = rows.filter((r) => visualSymptoms(r).length > 0);
  const lastOcular = ocularReports.at(-1);
  const lastBp = [...rows].reverse().find((r) => r.bp !== null);

  const RegionIcon =
    region === 'heart'
      ? HeartPulse
      : region === 'brain'
      ? Moon
      : region === 'eyes'
      ? Eye
      : Activity;

  return (
    <div
      className="bsm-root"
      data-testid="body-monitoring"
      data-crew={crew.id}
      data-region={region}
      data-record-id={latest?.id ?? ''}
    >
      <div className="bsm-subtitle-bar">
        <RegionIcon size={15} className="bsm-icon" />
        <span>
          {region === 'heart'
            ? 'Cardiovascular monitoring'
            : region === 'brain'
            ? 'Sleep & neurological observations'
            : label}
        </span>
      </div>

      {!['heart', 'brain', 'eyes'].includes(region) ? (
        <div className="bsm-kv-grid">
          <div className="bsm-kv-card">
            <span className="bsm-kv-label">REPORTED IN CHECK-IN</span>
            <strong>
              {evidence.reports.join(', ') || 'No matching reports'}
            </strong>
          </div>
          <div className="bsm-kv-card">
            <span className="bsm-kv-label">MISSING MEASUREMENTS</span>
            <strong className="unknown-val">
              <AlertCircle size={13} /> {evidence.missing.join(' · ')}
            </strong>
          </div>
          {reports.length > 0 && (
            <details className="bgn-details bsm-full">
              <summary>Historical reports ({reports.slice(-7).length})</summary>
              {reports.slice(-7).map((r) => (
                <p key={r.id}>
                  {r.recorded_at.slice(0, 16).replace('T', ' ')} ·{' '}
                  {reportedEvidence(region, r).join(', ')}
                </p>
              ))}
            </details>
          )}
        </div>
      ) : region === 'eyes' ? (
        <div className="bsm-kv-grid">
          <div className="bsm-kv-card">
            <span className="bsm-kv-label">OCULAR MEASUREMENT</span>
            <strong className="unknown-val">
              <AlertCircle size={13} /> Unknown
            </strong>
          </div>
          <div className="bsm-kv-card">
            <span className="bsm-kv-label">VISUAL SYMPTOMS</span>
            <strong>
              {lastOcular
                ? visualSymptoms(lastOcular).join(', ')
                : 'None recorded'}
            </strong>
          </div>
          {ocularReports.length > 0 && (
            <details className="bgn-details bsm-full">
              <summary>
                Visual symptom reports ({ocularReports.length})
              </summary>
              {ocularReports.map((r) => (
                <p key={r.id}>
                  {timestamp(r.recorded_at)} · {visualSymptoms(r).join(', ')}
                </p>
              ))}
            </details>
          )}
        </div>
      ) : (
        <>
          <div className="bsm-kv-grid">
            <div className="bsm-kv-card highlight">
              <span className="bsm-kv-label">
                {replaying ? 'REPLAY' : 'LATEST'}{' '}
                {region === 'heart' ? 'HEART RATE' : 'SLEEP'}
              </span>
              <strong
                className={`bsm-hero-val ${
                  latest?.[field] == null ? 'unknown-val' : ''
                }`}
              >
                {shown(latest?.[field], unit)}
              </strong>
            </div>

            <div className="bsm-kv-card">
              <span className="bsm-kv-label">BASELINE / DELTA</span>
              <strong>
                {shown(baseline, unit)} · Δ{' '}
                {baselineDifference(latest?.[field] ?? null, baseline)}
                {unit}
              </strong>
            </div>

            {region === 'heart' ? (
              <div className="bsm-kv-card">
                <span className="bsm-kv-label">BLOOD PRESSURE</span>
                <strong className={latest?.bp == null ? 'unknown-val' : ''}>
                  {shown(latest?.bp, ' mmHg')}
                </strong>
                {lastBp && lastBp.id !== latest?.id && (
                  <small>Prev: {lastBp.bp} mmHg</small>
                )}
              </div>
            ) : (
              <div className="bsm-kv-card">
                <span className="bsm-kv-label">SYMPTOMS</span>
                <strong>
                  {latest?.symptoms.join(', ') ||
                    (latest ? 'None reported' : 'Unknown')}
                </strong>
              </div>
            )}

            <div className="bsm-kv-card">
              <span className="bsm-kv-label">LAST EVIDENCE</span>
              <strong>
                {lastEvidence
                  ? lastEvidence.recorded_at.slice(0, 16).replace('T', ' ')
                  : 'Unknown'}
              </strong>
            </div>
          </div>

          {observed >= 2 ? (
            <div
              className="bsm-chart-wrap"
              role="img"
              aria-label={`${crew.id} recorded ${
                field === 'hr' ? 'heart rate' : 'sleep'
              } observations; full values and timestamps below`}
            >
              <ResponsiveContainer width="100%" height={120}>
                <LineChart
                  data={recent.map((r, i) => ({ ...r, observation: i + 1 }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                >
                  <XAxis
                    dataKey="observation"
                    tick={{ fontSize: 10, fill: '#b8c4d0' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#b8c4d0' }}
                    width={46}
                    domain={['auto', 'auto']}
                    unit={field === 'hr' ? '' : 'h'}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as
                        | SavedCheckIn
                        | undefined;
                      return active && row ? (
                        <div className="mht-tooltip">
                          <span>{timestamp(row.recorded_at)}</span>
                          <strong>{shown(row[field], unit)}</strong>
                        </div>
                      ) : null;
                    }}
                  />
                  <ReferenceLine
                    y={baseline}
                    stroke="#b8c4d0"
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                  <Line
                    type="linear"
                    dataKey={field}
                    stroke="#5B9BD5"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#5B9BD5' }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="bsm-status">
              Fewer than two measurements; no trend shown.
            </p>
          )}

          <details className="bgn-details">
            <summary>Recent observations ({recent.length})</summary>
            {recent.map((r, i) => (
              <p key={r.id}>
                {i + 1}. {timestamp(r.recorded_at)} · {shown(r[field], unit)}
              </p>
            ))}
          </details>
        </>
      )}

      <div className="bsm-footer">
        <span className="bsm-time-chip">
          <Clock size={12} />
          {latest
            ? timestamp(latest.recorded_at).slice(0, 16)
            : 'No check-in'}
        </span>
        <button
          type="button"
          className="bsm-open-inv-btn"
          disabled={!latest}
          onClick={onInvestigate}
        >
          <span>Open Investigation</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
