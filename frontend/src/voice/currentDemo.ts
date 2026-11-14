import { crews, equipment, history, type Crew, type Equipment as InventoryItem } from '../data/fixtures';
import { getScenario } from '../data/scenarios';
import type { Astronaut, CheckinRequest, CheckinResult, Equipment, HealthHistory, InvestigationRequest, InvestigationResponse } from './types';
import type { ScenarioResponse } from '../types/scenario';

type Context = { profiles: Crew[]; inventory: InventoryItem[]; save: (crew: Crew) => void };
let context: Context = { profiles: crews, inventory: equipment, save: () => {} };
let nextId = 1;
export function configureVoiceDemo(next: Context) { context = next; }
export function demoAstronauts(): Astronaut[] { return context.profiles.map(crew => ({ astronaut_id: crew.id, display_name: crew.id, dataset_type: 'synthetic' })); }
const current = (id: string) => context.profiles.find(c => c.id === id) ?? context.profiles[0];

export function demoHealth(id: string): HealthHistory {
  const crew = current(id);
  const key = id.endsWith('B') ? 'b' : id.endsWith('C') ? 'c' : 'a';
  const sleepKey = `s${key}` as 'sa' | 'sb' | 'sc';
  return {
    astronaut_id: id,
    baseline: { resting_hr_bpm: crew.baseline, sleep_hours: crew.sleepBaseline },
    series: history.map((row, i) => ({
      observed_at: `2026-11-${String(8 + i).padStart(2, '0')}T08:00:00+06:30`,
      resting_hr_bpm: row[key],
      sleep_hours: row[sleepKey],
    })),
    dataset_type: 'synthetic',
  };
}

export function demoInventory(): Equipment[] {
  return context.inventory.map(item => ({
    equipment_id: item.name === 'Blood-pressure monitor' ? 'bp_monitor' : item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/, ''),
    label: item.name, quantity: item.quantity,
    usable: item.available && item.quantity > 0,
    dataset_type: 'synthetic',
  }));
}

export function demoCheckin(data: CheckinRequest): CheckinResult {
  const crew = current(data.astronaut_id);
  const m = data.measurements;
  context.save({ ...crew, symptoms: data.symptoms,
    hr: m.resting_hr_bpm, sleep: m.sleep_hours,
    bp: m.systolic_bp_mm_hg !== null && m.diastolic_bp_mm_hg !== null ? `${m.systolic_bp_mm_hg} / ${m.diastolic_bp_mm_hg}` : null,
  });
  return { checkin_id: `voice-demo-${nextId++}`, saved: true };
}

export function demoInvestigation(data: InvestigationRequest): InvestigationResponse {
  const bpAvailable = data.available_equipment.includes('bp_monitor');
  const bpRecorded = data.measurements.systolic_bp_mm_hg !== null && data.measurements.diastolic_bp_mm_hg !== null;
  const fixture = getScenario([bpAvailable, bpRecorded, false, data.emergency_override]);
  if (!fixture) throw new Error('Scripted investigation fixture unavailable');
  return asVoiceResponse(fixture, data.measurements);
}

export function asVoiceResponse(fixture: ScenarioResponse, measurements: InvestigationRequest['measurements']): InvestigationResponse {
  return {
    status: fixture.status,
    observations: Array.isArray(fixture.observations) ? fixture.observations : [],
    missing_data: Object.entries(measurements).filter(([, value]) => value === null).map(([key]) => key),
    resource_constraints: Array.isArray(fixture.resource_constraints) ? fixture.resource_constraints : [],
    safety_flags: fixture.safety_flags,
    next_check: fixture.next_check && {
      id: fixture.next_check.id ?? 'scripted_check',
      label: fixture.next_check.label ?? fixture.next_check.title ?? 'Reviewed check',
      requires_equipment: [...(fixture.next_check.requires_equipment ?? fixture.next_check.equipment ?? [])],
      prototype_only: true,
    },
    requires_medical_officer_review: fixture.requires_medical_officer_review,
    explanation: typeof fixture.explanation === 'string' ? fixture.explanation : fixture.explanation.selected,
    evidence_sources: ['synthetic:MEDNAV-UI-FIXTURES'], diagnosis: null,
  };
}
