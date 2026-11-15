import { useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { investigationApi } from './api';
import { getMedicationPurpose } from './data/medicalReferences';
import type { CrewProactiveAlertDTO, MedicationStockDTO } from './types/api';
import { LocalSpeaker } from './voice/speaker';

/**
 * Crisp clinical 2-tone intercom chime played right before the Piper voice
 * investigation announcement on any active tab.
 */
export function playInvestigationAlertChime(): void {
  try {
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const chime = (offset: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.45, ctx.currentTime + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + dur + 0.02);
    };
    chime(0.02, 880, 0.16);
    chime(0.19, 1318.5, 0.28);
  } catch {
    // Audio playback unavailable in restricted environment
  }
}

/**
 * Loud, distinct 3-burst warning klaxon (sawtooth + square dual-tone) triggered
 * when an operator manually adjusts medication quantities in Medical Inventory.
 */
export function playTripleAlertSound(): void {
  try {
    const win = window as Window & {
      webkitAudioContext?: typeof AudioContext;
      __mednavAlertCount?: number;
    };
    win.__mednavAlertCount = (win.__mednavAlertCount ?? 0) + 3;
    const AudioCtx = window.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-12, ctx.currentTime);
    comp.ratio.setValueAtTime(8, ctx.currentTime);
    comp.connect(ctx.destination);

    const playWarningBurst = (startOffset: number) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const gain = ctx.createGain();
      o1.type = 'sawtooth';
      o2.type = 'square';
      const t0 = ctx.currentTime + startOffset;
      o1.frequency.setValueAtTime(680, t0);
      o1.frequency.setValueAtTime(510, t0 + 0.11);
      o2.frequency.setValueAtTime(340, t0);
      o2.frequency.setValueAtTime(255, t0 + 0.11);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.015);
      gain.gain.setValueAtTime(0.82, t0 + 0.19);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      o1.connect(gain);
      o2.connect(gain);
      gain.connect(comp);
      o1.start(t0);
      o2.start(t0);
      o1.stop(t0 + 0.25);
      o2.stop(t0 + 0.25);
    };
    playWarningBurst(0.02);
    playWarningBurst(0.32);
    playWarningBurst(0.62);
  } catch {
    // Audio playback unavailable in restricted environment
  }
}

/**
 * Global 15-second background crew alert scanner + UI banner shown on any tab.
 */
export function useGlobalCrewAlertScanner(live: boolean) {
  const [globalCrewAlerts, setGlobalCrewAlerts] = useState<CrewProactiveAlertDTO[]>([]);
  const checkInScanTimerRef = useRef<number | null>(null);
  const globalSpeakerRef = useRef<LocalSpeaker | null>(null);
  const alertRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (checkInScanTimerRef.current !== null) {
        window.clearTimeout(checkInScanTimerRef.current);
      }
      alertRunIdRef.current += 1;
      globalSpeakerRef.current?.stop();
    };
  }, []);

  const scheduleCheckInAlertScan = () => {
    if (!live) return;
    if (checkInScanTimerRef.current !== null) {
      window.clearTimeout(checkInScanTimerRef.current);
    }
    alertRunIdRef.current += 1;
    const runId = alertRunIdRef.current;
    globalSpeakerRef.current ??= new LocalSpeaker();
    globalSpeakerRef.current.stop();
    void globalSpeakerRef.current.prime();
    setGlobalCrewAlerts([]);

    checkInScanTimerRef.current = window.setTimeout(() => {
      checkInScanTimerRef.current = null;
      void (async () => {
        try {
          const alerts = await investigationApi.getCrewAlerts();
          if (alertRunIdRef.current !== runId) return;
          const pending = alerts.filter((a) => a.needs_investigation);
          if (pending.length === 0) {
            setGlobalCrewAlerts([]);
            return;
          }
          setGlobalCrewAlerts(pending);
          const names = pending.map((a) => a.astronaut_id);
          const who =
            names.length === 1
              ? `${names[0]} needs`
              : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} need`;
          const msg = `Attention. ${who} a health investigation. Please open the Investigation tab.`;
          const speaker = (globalSpeakerRef.current ??= new LocalSpeaker());
          playInvestigationAlertChime();
          await new Promise((r) => window.setTimeout(r, 420));
          for (let pass = 0; pass < 2; pass++) {
            if (alertRunIdRef.current !== runId) return;
            const spoke = await speaker.say(msg);
            if (!spoke && alertRunIdRef.current === runId) {
              playInvestigationAlertChime();
              await new Promise((r) => window.setTimeout(r, 2500));
            } else if (pass === 0 && alertRunIdRef.current === runId) {
              await new Promise((r) => window.setTimeout(r, 350));
            }
          }
          if (alertRunIdRef.current === runId) {
            setGlobalCrewAlerts([]);
          }
        } catch {
          // Non-fatal if background crew alert scan fails
        }
      })();
    }, 2_000);
  };

  return { globalCrewAlerts, scheduleCheckInAlertScan };
}

export function GlobalCrewAlertBanner({
  alerts,
  activeCrewId,
  onSelectAndInvestigate,
}: {
  alerts: CrewProactiveAlertDTO[];
  activeCrewId: string;
  onSelectAndInvestigate: (astronautId: string) => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <div
      className="inv-global-crew-alert"
      role="alert"
      data-testid="global-crew-alert"
    >
      <div className="inv-crew-triage-head">
        <BellRing size={16} />
        <span>
          HEALTH CHECK ALERT — Crew member(s) outside pre-flight baseline need a health check:
        </span>
      </div>
      <div className="inv-crew-triage-list">
        {alerts.map((a) => (
          <button
            key={a.astronaut_id}
            type="button"
            className={`inv-crew-triage-chip ${a.astronaut_id === activeCrewId ? 'is-active' : ''}`}
            onClick={() => onSelectAndInvestigate(a.astronaut_id)}
          >
            <strong>{a.astronaut_id}</strong>
            <span>· {a.summary_tags.join(' · ')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MedicalInventoryView({
  medications,
  busy,
  onUpdateMedicationQuantity,
}: {
  medications: MedicationStockDTO[];
  busy: boolean;
  onUpdateMedicationQuantity: (id: string, qty: number) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [manageStock, setManageStock] = useState(false);
  const [inventoryAlert, setInventoryAlert] = useState<string | null>(null);
  const alertTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  return (
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
              data-beeps="3"
              className="inv-crew-alert-banner"
            >
              <strong>Crew Alert (3× audio beep):</strong> {inventoryAlert}
            </div>
          )}

          <div className="inventory-toolbar inv-inventory-toolbar-row">
            <div className="filters">
              <label>
                Search medications
                <input
                  placeholder="Filter by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className={`hairline-pill-btn inv-manage-stock-btn${manageStock ? ' active' : ''}`}
              aria-pressed={manageStock}
              onClick={() => setManageStock((v) => !v)}
            >
              {manageStock ? 'Done Adjusting' : 'Adjust Stock'}
            </button>
          </div>

          {medications.length > 0 && (
            <div className="inv-med-inventory-section">
              <div className="hairline-telemetry-list">
                {medications
                  .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
                  .map((m) => (
                    <MedicationInventoryRow
                      key={m.id}
                      med={m}
                      busy={busy}
                      manageStock={manageStock}
                      onUpdate={async (qty) => {
                        const prev = m.quantity;
                        await onUpdateMedicationQuantity(m.id, qty);
                        playTripleAlertSound();
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
              <dd>{medications.length} Types</dd>
            </div>
            <div className="telemetry-kv-row compact">
              <dt>Total Medication Units:</dt>
              <dd>{medications.reduce((sum, m) => sum + m.quantity, 0)} Units</dd>
            </div>
          </dl>
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
    } finally {
      setSaving(false);
    }
  };

  const depleted = med.quantity <= 0;
  const purpose = getMedicationPurpose(med.id);

  return (
    <article
      className={`equipment-hairline-row inv-med-inventory-row${depleted && !manageStock ? ' is-depleted' : ''}`}
    >
      <div className="equip-row-left">
        <strong>{med.name}</strong>
        <span>
          <em className={depleted ? 'unknown-val' : 'ok-txt'}>
            {med.quantity} {med.unit} remaining
          </em>{' '}
          · {purpose ?? `Pre-flight kit (${med.protocol_ref})`}
        </span>
      </div>

      {manageStock && (
        <div className="inv-med-manual-controls">
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
            disabled={busy || saving || draftQty === '' || Number(draftQty) === med.quantity}
            aria-label={`Save ${med.name}`}
            onClick={() => void commit()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </article>
  );
}
