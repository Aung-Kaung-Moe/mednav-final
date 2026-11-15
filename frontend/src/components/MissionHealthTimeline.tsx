import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { Crew } from '../data/fixtures';
import type { SavedCheckIn } from '../types/api';
import { orderedRecords } from '../data/bodyMonitoring';
import { baselineDifference, completeness } from '../data/missionMonitoring';

type Props = {
  crew: Crew;
  records: SavedCheckIn[];
  loading: boolean;
  error: string;
  onReplay?: (id: string) => void;
};

const show = (v: number | string | null | undefined, unit = '') =>
  v == null ? 'Unknown' : `${v}${unit}`;
const date = (stamp: string) =>
  new Date(stamp).toISOString().replace('T', ' ').slice(0, 19) + 'Z';

export function MissionHealthTimeline({
  crew,
  records,
  loading,
  error,
  onReplay,
}: Props) {
  const [filter, setFilter] = useState<'hr' | 'sleep' | 'symptoms'>('hr');
  const [limit, setLimit] = useState(7);
  const [selectedId, setSelectedId] = useState('');

  if (loading) {
    return (
      <p className="mht-status-msg" role="status">
        Loading recorded health timeline…
      </p>
    );
  }
  if (error) {
    return (
      <p className="mht-status-msg error" role="alert">
        Health timeline unavailable: {error}
      </p>
    );
  }

  const all = orderedRecords(records, crew.id);
  const rows = all.slice(-limit);
  const latest = all.at(-1);
  const selected = rows.find((r) => r.id === selectedId) ?? rows.at(-1);
  const baseline = filter === 'sleep' ? crew.sleepBaseline : crew.baseline;
  const field = filter === 'sleep' ? 'sleep' : 'hr';
  const count = completeness(rows);
  const numeric = rows.filter((r) => r[field] !== null).length;

  const missingLatest = latest
    ? [
        latest.hr === null ? 'HR' : null,
        latest.sleep === null ? 'Sleep' : null,
        latest.bp === null ? 'BP' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'None in HR/Sleep/BP'
    : 'Unknown — no saved check-in';

  return (
    <section
      className="mht-root"
      aria-label="Mission health timeline"
      data-crew={crew.id}
    >
      <div className="mht-header-row">
        <div className="mht-title-block">
          <h3>Mission Health Timeline</h3>
          <span className="mht-subtitle">
            Last {limit} Recorded Observations · {rows.length} available ·{' '}
            {count.recorded}/{count.slots} HR/Sleep/BP slots · Synthetic SQLite
            history
          </span>
        </div>

        <div className="mht-controls">
          <div
            className="trend-mode-pills"
            role="group"
            aria-label="Timeline filter"
          >
            {(['hr', 'sleep', 'symptoms'] as const).map((f) => (
              <button
                key={f}
                className={`hairline-pill-btn ${filter === f ? 'active' : ''}`}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'hr'
                  ? 'Heart Rate'
                  : f === 'sleep'
                  ? 'Sleep'
                  : 'Symptoms'}
              </button>
            ))}
          </div>

          <label className="mht-window-label">
            <span>Window</span>
            <select
              className="mht-window-select"
              aria-label="Observation window"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={7}>Last 7 Recorded Observations</option>
              <option value={30}>Last 30 Recorded Observations</option>
            </select>
          </label>
        </div>
      </div>

      <div aria-label="Recorded health summary" className="mht-summary-grid">
        <div className="mht-summary-tile">
          <span className="mht-tile-label">LATEST HR</span>
          <strong className={latest?.hr == null ? 'unknown-val' : ''}>
            {show(latest?.hr, ' bpm')}
          </strong>
          <small>
            Baseline {crew.baseline} bpm · Δ{' '}
            {baselineDifference(latest?.hr ?? null, crew.baseline)} bpm
          </small>
        </div>
        <div className="mht-summary-tile">
          <span className="mht-tile-label">LATEST SLEEP</span>
          <strong className={latest?.sleep == null ? 'unknown-val' : ''}>
            {show(latest?.sleep, ' h')}
          </strong>
          <small>
            Baseline {crew.sleepBaseline} h · Δ{' '}
            {baselineDifference(latest?.sleep ?? null, crew.sleepBaseline)} h
          </small>
        </div>
        <div className="mht-summary-tile">
          <span className="mht-tile-label">LATEST BP / MISSING</span>
          <strong className={latest?.bp == null ? 'unknown-val' : ''}>
            {show(latest?.bp, ' mmHg')}
          </strong>
          <small>Missing: {missingLatest}</small>
        </div>
        <div className="mht-summary-tile">
          <span className="mht-tile-label">
            LATEST CHECK-IN ({all.length} SAVED)
          </span>
          <strong>{latest ? date(latest.recorded_at) : 'Unknown'}</strong>
          <small>
            Symptoms:{' '}
            {latest?.symptoms.join(', ') ||
              (latest ? 'None reported' : 'Unknown')}
          </small>
        </div>
      </div>

      <div className="mht-body-grid">
        <div className="mht-left-col">
          {filter !== 'symptoms' &&
            (numeric >= 2 ? (
              <div
                className="mht-chart-card"
                role="img"
                aria-label={`${crew.id} ${
                  filter === 'hr' ? 'heart-rate' : 'sleep-duration'
                } recorded trend`}
              >
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={rows.map((r, i) => ({ ...r, observation: i + 1 }))}
                    margin={{ left: -12, right: 12, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.06)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="observation"
                      allowDecimals={false}
                      stroke="rgba(255,255,255,0.25)"
                      tick={{ fill: '#A1A1AA', fontSize: 11 }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="rgba(255,255,255,0.25)"
                      tick={{ fill: '#A1A1AA', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as
                          | SavedCheckIn
                          | undefined;
                        return active && r ? (
                          <div className="mht-tooltip">
                            <span>{date(r.recorded_at)}</span>
                            <strong>
                              {show(r[field], filter === 'hr' ? ' bpm' : ' h')}
                            </strong>
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
                      dataKey={field}
                      type="linear"
                      stroke="#5B9BD5"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#5B9BD5' }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mht-footnote">
                  X: observation # · Y: {filter === 'hr' ? 'bpm' : 'hours'} ·
                  dashed: personal baseline. Unknown readings leave gaps.
                </p>
              </div>
            ) : (
              <div className="mht-empty-chart">
                Insufficient recorded observations for trend comparison.
              </div>
            ))}

          <ol className="mht-obs-list" aria-label="Saved health observations">
            {rows.map((r, i) => {
              const isSelected = selected?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    className={`mht-obs-row ${isSelected ? 'selected' : ''}`}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Replay observation ${r.id} on BodyGraph`}
                    onClick={() => {
                      setSelectedId(r.id);
                      onReplay?.(r.id);
                    }}
                  >
                    <span className="mht-obs-idx">#{i + 1}</span>
                    <time className="mht-obs-time" dateTime={r.recorded_at}>
                      {date(r.recorded_at)}
                    </time>
                    <span className="mht-obs-val">
                      {filter === 'symptoms'
                        ? r.symptoms.join(', ') || 'None reported'
                        : show(r[field], filter === 'hr' ? ' bpm' : ' h')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

      </div>
    </section>
  );
}
