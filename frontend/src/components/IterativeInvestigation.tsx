import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
} from 'lucide-react';
import { investigationApi } from '../api';
import type { Crew, Equipment } from '../data/fixtures';
import { getClinicalResourcesForSuggestion, getOfflineHealthCareGuide } from '../data/medicalReferences';
import type {
  InvestigationSessionDTO,
  SavedCheckIn,
} from '../types/api';

type Props = {
  live?: boolean;
  crew: Crew;
  liveRecord?: SavedCheckIn | null;
  inventory: Equipment[];
  onStockChanged?: () => Promise<void> | void;
  go: (p: number) => void;
};

const QUICK_TEST_CASES = [
  {
    label: 'High HR 112 (Exercise vs Illness)',
    hr: 112,
    sleep: 7.2,
    bp: null,
    symptoms: [] as string[],
  },
  {
    label: 'Headache + HR 96 + Low Sleep',
    hr: 96,
    sleep: 4.5,
    bp: null,
    symptoms: ['Headache', 'Fatigue'],
  },
  {
    label: 'Dizziness + Nausea + HR 102',
    hr: 102,
    sleep: 6.0,
    bp: null,
    symptoms: ['Dizziness', 'Nausea'],
  },
];

export function IterativeInvestigation({
  live = true,
  crew,
  liveRecord,
  inventory,
  onStockChanged,
  go,
}: Props) {
  const [session, setSession] = useState<InvestigationSessionDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [numericInput, setNumericInput] = useState('');
  const [daysInput, setDaysInput] = useState(45);

  const loadLatest = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    setError('');
    try {
      const dto = await investigationApi.getLatestSession(crew.id);
      setSession(dto);
      setDaysInput(dto.mission_context.remaining_days);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [live, crew.id, liveRecord?.id]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const handleAnswer = async (questionId: string, answerValue: string, includeNumeric = true) => {
    if (!session) return;
    setSubmitting(true);
    setError('');
    try {
      const parsedNum =
        includeNumeric && numericInput.trim() !== '' && Number.isFinite(Number(numericInput))
          ? Number(numericInput)
          : undefined;
      const dto = await investigationApi.submitAnswer(session.id, {
        question_id: questionId,
        answer_value: answerValue,
        numeric_value: parsedNum,
      });
      setSession(dto);
      setDaysInput(dto.mission_context.remaining_days);
      setNumericInput('');
      if (questionId === 'mission_duration_check') await onStockChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMissionPatch = async (nextDays: number) => {
    setSubmitting(true);
    setError('');
    try {
      await investigationApi.updateMissionContext({
        crew_count: session?.mission_context.crew_count ?? 4,
        remaining_days: nextDays,
      });
      await loadLatest();
      await onStockChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispense = async (medicationId?: string) => {
    if (!session) return;
    setSubmitting(true);
    setError('');
    try {
      const dto = await investigationApi.dispenseAllocation(
        session.id,
        medicationId
      );
      setSession(dto);
      await onStockChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickTestCase = async (
    tc: (typeof QUICK_TEST_CASES)[number]
  ) => {
    setSubmitting(true);
    setError('');
    setNumericInput('');
    try {
      const saved = await investigationApi.createSyntheticCheckIn({
        astronaut_id: crew.id,
        hr: tc.hr,
        sleep: tc.sleep,
        bp: tc.bp,
        symptoms: tc.symptoms,
      });
      const dto = await investigationApi.startSession({
        astronaut_id: crew.id,
        check_in_id: saved.id,
      });
      setSession(dto);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!live) {
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
            H E A L T H &nbsp; I N V E S T I G A T I O N
          </div>
          <span />
        </div>
        <div
          className="right-frosted-sheet"
          style={{ maxWidth: 680, margin: '24px auto' }}
        >
          <h2>Backend Required for Investigation</h2>
          <p className="telemetry-summary-copy">
            Switch to Live FastAPI mode in Footer → Developer tools to run the
            iterative investigation and mission medication rationing.
          </p>
        </div>
      </div>
    );
  }

  const snap = session?.check_in_snapshot;
  const alloc = session?.medication_allocation;
  const q = session?.current_question;
  const isCompleted = session?.status === 'completed';
  const healthCareGuide = getOfflineHealthCareGuide(session?.condition_id, alloc?.medication_id);

  return (
    <div
      className="mission-console space-subpage"
      data-testid="iterative-investigation"
      data-status={session?.status ?? 'loading'}
    >
      {/* TOP BAR */}
      <div className="subpage-top-bar">
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
          onClick={() => go(4)}
        >
          <Pill size={14} /> Medical Inventory
        </button>
      </div>

      <div className="subpage-intro">
        <span className="subpage-eyebrow">GUIDED ASSESSMENT</span>
        <h1>Health investigation</h1>
        <p>Review the current question, possible causes, and available onboard resources.</p>
      </div>
      {session?.proactive_alert && session.status === 'in_progress' && (
        <p role="status" className="inv-crew-alert-banner">{session.proactive_alert}</p>
      )}

      {/* MISSION SUPPLY & TEST SCENARIO STRIP */}
      <section
        className="inv-mission-strip"
        aria-label="Mission supply parameters"
      >
        <div className="inv-mission-left">
          <div className="inv-mission-inline-field">
            <Activity size={15} className="inv-accent-icon" />
            <label htmlFor="inv-remaining-days">Mission Days Left:</label>
            <input
              id="inv-remaining-days"
              type="number"
              min={1}
              max={1825}
              value={daysInput}
              onChange={(e) =>
                setDaysInput(
                  Math.max(1, Math.min(1825, Number(e.target.value) || 1))
                )
              }
            />
            <span className="inv-days-months">
              ({(daysInput / 30).toFixed(1)} mo)
            </span>
          </div>

          <div className="inv-days-presets">
            {[15, 45, 90, 180].map((d) => (
              <button
                key={d}
                type="button"
                className={`hairline-pill-btn ${
                  daysInput === d ? 'active' : ''
                }`}
                disabled={submitting}
                onClick={() => setDaysInput(d)}
              >
                {d}d
              </button>
            ))}
            <button
              type="button"
              className="hairline-pill-btn active"
              disabled={submitting}
              onClick={() => void handleMissionPatch(daysInput)}
            >
              Apply
            </button>
          </div>
        </div>

        <details className="inv-test-details">
          <summary>
            <FlaskConical size={13} />
            <span>Quick Test Scenarios</span>
          </summary>
          <div className="inv-quick-test-bar">
            {QUICK_TEST_CASES.map((tc) => (
              <button
                key={tc.label}
                type="button"
                className="hairline-pill-btn"
                disabled={submitting}
                onClick={() => void handleQuickTestCase(tc)}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </details>
      </section>

      {error && (
        <p role="alert" className="error" style={{ margin: '12px 0' }}>
          {error}
        </p>
      )}

      {loading && !session ? (
        <div className="command-card" style={{ padding: 24 }}>
          <p className="telemetry-summary-copy">Loading investigation…</p>
        </div>
      ) : (
        <div className="inv-workspace">
          {/* LEFT: SNAPSHOT + ACTIVE QUESTION / FINAL RESULT */}
          <div className="inv-main-column">
            {snap && (
              <div className="inv-snapshot-strip">
                <div className="inv-snap-card">
                  <span className="inv-snap-label">
                    <Activity size={13} /> DAILY TELEMETRY FINDINGS
                  </span>
                  <p>
                    {snap.anomalies.length > 0
                      ? snap.anomalies.join(' · ')
                      : 'Readings look normal'}
                  </p>
                </div>
                <div className="inv-snap-card">
                  <span className="inv-snap-label">
                    <AlertTriangle size={13} /> MISSING READINGS
                  </span>
                  <p
                    className={
                      snap.missing_fields.length > 0 ? 'unknown-val' : ''
                    }
                  >
                    {snap.missing_fields.length > 0
                      ? snap.missing_fields.join(', ')
                      : 'All core readings available'}
                  </p>
                </div>
              </div>
            )}

            {/* ACTIVE QUESTION CARD */}
            {session?.status === 'in_progress' && q && (
              <section
                className="inv-question-card"
                aria-label="Current investigation question"
              >
                <div className="stage-card-head">
                  <span>
                    STEP {session.turn_count + 1} OF {session.max_turns}
                  </span>
                  <span>GUIDED CHECK</span>
                </div>
                <h2 className="inv-question-prompt">{q.prompt}</h2>
                <p className="inv-question-rationale">{q.rationale}</p>

                {q.required_equipment && (
                  <div className="inv-equipment-tag">
                    Device: <strong>{q.required_equipment}</strong> —{' '}
                    <span
                      className={q.equipment_usable ? 'ok-txt' : 'unknown-val'}
                    >
                      {q.equipment_usable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                )}

                {q.supports_numeric_input && (
                  <div className="inv-numeric-row">
                    <label>
                      {q.numeric_label ?? 'Value'} ({q.numeric_unit ?? ''}):
                      <input
                        type="number"
                        step={q.id === 'mission_duration_check' ? 1 : 0.1}
                        min={q.id === 'mission_duration_check' ? 1 : undefined}
                        placeholder={q.id === 'mission_duration_check' ? 'e.g. 60' : 'e.g. 37.1'}
                        value={numericInput}
                        onChange={(e) => setNumericInput(e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {q.id === 'mission_duration_check' && numericInput.trim() !== '' && (
                  <button type="button" className="hairline-pill-btn" disabled={submitting}
                    onClick={() => void handleAnswer(q.id, '45')}>Use {numericInput} days</button>
                )}

                <div className="inv-options-grid">
                  {q.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      className={`inv-option-btn tone-${opt.tone}`}
                      onClick={() => void handleAnswer(q.id, opt.value, q.id !== 'mission_duration_check')}
                    >
                      <span>{opt.label}</span>
                      <ArrowRight size={15} className="inv-opt-arrow" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* FINAL RESULT & MEDICATION INSTRUCTION */}
            {isCompleted && alloc && (
              <section
                className={`inv-outcome-card mode-${
                  session?.dispensed ? 'standard' : alloc.rationing_mode
                }`}
                aria-label="Investigation outcome and medication allocation"
              >
                <div className="trace-header-line">
                  <span className="wide-planetary-label left-aligned">
                    FINAL RESULT &amp; MEDICATION ADVICE
                  </span>
                  <span className="trace-status">
                    {session?.dispensed
                      ? `DOSE TAKEN · ${session?.confidence_pct}% MATCH`
                      : `${session?.confidence_pct}% MATCH`}
                  </span>
                </div>

                <h2 className="inv-outcome-title">
                  <CheckCircle2 size={22} className="inv-outcome-icon" />
                  <span>{session?.assessment_title}</span>
                </h2>
                <p className="inv-outcome-summary">
                  {session?.assessment_summary}
                </p>
                {healthCareGuide?.condition?.immediate_actions[0] && (
                  <p className="inv-outcome-summary"><strong>Care guidance</strong> {healthCareGuide.condition.immediate_actions[0]}</p>
                )}

                <div className="inv-allocation-box">
                  <p className="inv-alloc-schedule">
                    {alloc.medication_name ? (
                      <>
                        <strong>{alloc.medication_name}</strong> ·{' '}
                      </>
                    ) : null}
                    {session?.dispensed
                      ? `Deducted ${session.dispensed_units} ${alloc.unit} from Medical Inventory. ${alloc.stock_available} ${alloc.unit} now remain onboard.`
                      : alloc.dosage_schedule}
                  </p>

                  {alloc.medication_id && (
                    <div className="inv-ration-metrics">
                      <div>
                        <small>Inventory Stock</small>
                        <strong>
                          {alloc.stock_available} {alloc.unit}
                        </strong>
                      </div>
                      <div>
                        <small>
                          Crew Reserve ({alloc.crew_count} ·{' '}
                          {alloc.remaining_days}d)
                        </small>
                        <strong>
                          {alloc.crew_safety_reserve} {alloc.unit}
                        </strong>
                      </div>
                      <div>
                        <small>Standard Dose</small>
                        <strong>
                          {alloc.standard_total_units} {alloc.unit}
                        </strong>
                      </div>
                      <div>
                        <small>
                          {session?.dispensed ? 'Dose Taken' : 'Allowed Dose'}
                        </small>
                        <strong className="inv-highlight-dose">
                          {session?.dispensed
                            ? session.dispensed_units
                            : alloc.recommended_total_units}{' '}
                          {alloc.unit}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="inv-outcome-actions">
                    {alloc.medication_id &&
                      (alloc.recommended_total_units > 0 ||
                        session?.dispensed) && (
                        <button
                          type="button"
                          className="ghost-rect-cta inv-take-btn"
                          disabled={submitting || session?.dispensed}
                          onClick={() => void handleDispense()}
                        >
                          <ClipboardCheck size={15} />
                          <span>
                            {session?.dispensed
                              ? `Taken (${session.dispensed_units} ${alloc.unit})`
                              : `Take ${alloc.recommended_total_units} ${alloc.unit}`}
                          </span>
                        </button>
                      )}

                    <button
                      type="button"
                      className="hairline-pill-btn"
                      onClick={() => go(4)}
                    >
                      <Pill size={15} /> Inventory
                    </button>

                    <button
                      type="button"
                      className="hairline-pill-btn"
                      onClick={() => go(5)}
                    >
                      <FileText size={15} /> Incident Report
                    </button>
                  </div>
                </div>

                {(session?.secondary_allocations?.length ?? 0) > 0 && (
                  <div className="inv-secondary-box">
                    <div className="stage-card-head">
                      <span>CO-TREATMENTS</span>
                      <span>ISS PROTOCOL</span>
                    </div>
                    <div className="inv-secondary-list">
                      {session!.secondary_allocations.map((sec) => {
                        const secTaken = Boolean(
                          sec.medication_id &&
                            session?.dispensed_secondary_ids?.includes(
                              sec.medication_id
                            )
                        );
                        return (
                          <div
                            key={sec.medication_id ?? sec.instruction_headline}
                            className="inv-secondary-item"
                          >
                            <div>
                              <strong>
                                {sec.medication_name} ·{' '}
                                {sec.recommended_total_units} {sec.unit}
                              </strong>
                              <p>{sec.dosage_schedule}</p>
                            </div>
                            {sec.medication_id &&
                              sec.recommended_total_units > 0 && (
                                <button
                                  type="button"
                                  className="hairline-pill-btn"
                                  disabled={submitting || secTaken}
                                  onClick={() =>
                                    void handleDispense(
                                      sec.medication_id ?? undefined
                                    )
                                  }
                                >
                                  {secTaken
                                    ? `Taken (${sec.recommended_total_units} ${sec.unit})`
                                    : `Take ${sec.recommended_total_units} ${sec.unit}`}
                                </button>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* COLLAPSIBLE CLINICAL SOURCES */}
            {isCompleted && alloc && (
              <details
                className="inv-sources-details"
                aria-label="Medication suggestion clinical sources"
              >
                <summary>Clinical Sources (Offline Bundled)</summary>
                <div className="inv-turns-history">
                  {getClinicalResourcesForSuggestion(
                    alloc.medication_id,
                    (session?.secondary_allocations?.length ?? 0) > 0
                  ).map((res, idx) => (
                    <div key={res.id} className="inv-turn-row">
                      <span className="inv-turn-num">#{idx + 1}</span>
                      <div className="inv-turn-body">
                        <small>{res.shortCitation}</small>
                        <strong>{res.summary}</strong>
                        <small>
                          <a
                            href={res.referenceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {res.referenceUrl}
                          </a>
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* RIGHT: POSSIBLE CONDITIONS & DEVICES */}
          <aside
            className="inv-hypotheses-col"
            aria-label="Possible causes"
          >
            <div className="inv-side-top">
              <div className="inv-side-head">
                <Stethoscope size={15} className="inv-accent-icon" />
                <span className="inv-causes-title">POSSIBLE CAUSES</span>
              </div>

              <div className="inv-hyp-list">
                {(session?.hypotheses ?? []).map((h) => (
                  <div key={h.id} className={`inv-hyp-item status-${h.status}`}>
                    <div className="inv-hyp-head">
                      <strong>{h.label}</strong>
                      <span className={`inv-hyp-badge badge-${h.status}`}>
                        {h.status.replace('_', ' ')} · {h.score}%
                      </span>
                    </div>
                    <div className="inv-hyp-bar">
                      <div style={{ width: `${h.score}%` }} />
                    </div>
                    <small>{h.reason}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="inv-devices-box">
              <span className="micro-label">ONBOARD DEVICES</span>
              <ul className="inv-equip-mini">
                {inventory
                  .filter(
                    (e) =>
                      e.category === 'Monitoring' || e.category === 'Imaging'
                  )
                  .map((e) => {
                    const ok = e.available && e.quantity > 0;
                    return (
                      <li key={e.name}>
                        <span>{e.name}</span>
                        <strong className={ok ? 'ok-txt' : 'unknown-val'}>
                          {ok ? '● Available' : '● Unavailable'}
                        </strong>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
