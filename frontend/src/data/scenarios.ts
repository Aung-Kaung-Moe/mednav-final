import type { ScenarioResponse } from '../types/scenario';

// Exact finite lookup: monitor, BP record, Earth link, manual override.
// These are authored UI examples matching the engine statuses (`needs_review`,
// `insufficient_evidence`, `escalate`), not medical recommendations or validated protocols.
const authored = {
  blocked: {
    status: 'needs_review',
    next_check: {
      id: 'repeat_symptom_and_hr_recheck_15m',
      label: 'Repeat symptom and heart-rate recheck in 15 minutes (prototype)',
      title: 'Repeat symptom and heart-rate recheck in 15 minutes',
      requires_equipment: ['pulse_ox_or_hr_sensor'],
      equipment: ['Crew check-in tablet'],
      prototype_only: true,
    },
    explanation: {
      selected:
        'Blood pressure is unknown and the BP monitor is unavailable. The engine selects a feasible symptom and heart-rate recheck using available equipment.',
      excluded:
        'A blood-pressure recording check is excluded because bp_monitor is unavailable.',
    },
  },
  insufficient: {
    status: 'insufficient_evidence',
    next_check: null,
    explanation: {
      selected:
        'Insufficient evidence to select a routine check while required blood-pressure observation and monitor remain unavailable in this simulation.',
      excluded:
        'No permissible next check is returned (next_check: null); missing observations remain explicitly flagged for medical-officer review.',
    },
  },
  measure: {
    status: 'needs_review',
    next_check: {
      id: 'record_bp_observation',
      label: 'Record blood-pressure observation with available monitor (prototype)',
      title: 'Record blood-pressure observation',
      requires_equipment: ['bp_monitor'],
      equipment: ['Blood-pressure monitor'],
      prototype_only: true,
    },
    explanation: {
      selected:
        'This fixture pairs a missing blood-pressure record with an available monitor, subject to medical-officer review.',
      excluded:
        'A completed-record review is excluded because the blood-pressure observation is still missing.',
    },
  },
  review: {
    status: 'needs_review',
    next_check: {
      id: 'review_observation_record',
      label: 'Review recorded observations with medical officer (prototype)',
      title: 'Review the observation record',
      requires_equipment: ['crew_tablet'],
      equipment: ['Crew check-in tablet'],
      prototype_only: true,
    },
    explanation: {
      selected:
        'This example includes a blood-pressure record. It moves to officer review without interpreting the readings.',
      excluded:
        'The missing-record workflow is excluded because a synthetic observation is present.',
    },
  },
  escalation: {
    status: 'escalate',
    next_check: null,
    explanation: {
      selected:
        'Manual emergency override active. Follow approved crew emergency medical protocol and contact medical officer.',
      excluded:
        'All routine next checks are bypassed (next_check: null). No procedure or treatment is generated.',
    },
  },
} as const;

const keys: Record<string, keyof typeof authored> = {
  '0000': 'blocked',
  '0010': 'insufficient',
  '0100': 'review',
  '0110': 'review',
  '1000': 'measure',
  '1010': 'measure',
  '1100': 'review',
  '1110': 'review',
  '0001': 'escalation',
  '0011': 'escalation',
  '0101': 'escalation',
  '0111': 'escalation',
  '1001': 'escalation',
  '1011': 'escalation',
  '1101': 'escalation',
  '1111': 'escalation',
};

export const scenarioFixtures: Record<string, ScenarioResponse> =
  Object.fromEntries(
    Object.entries(keys).map(([key, name]) => [
      key,
      {
        id: `MN-${key}`,
        ...authored[name],
        observations: { bp: key[1] === '1' ? '120 / 80' : null },
        missing_data:
          key[1] === '1'
            ? []
            : ['systolic_bp_mm_hg', 'diastolic_bp_mm_hg'],
        resource_constraints:
          key[0] === '1' ? [] : ['bp_monitor unavailable'],
        safety_flags:
          name === 'escalation'
            ? ['Manual emergency override']
            : ['No automated clinical assessment'],
        requires_medical_officer_review: true,
        evidence_sources: [
          { id: 'MEDNAV-UI-FIXTURES', kind: 'scripted-demo', version: '1.0' },
        ],
        diagnosis: null,
      },
    ])
  );

export function getScenario(flags: boolean[]) {
  return scenarioFixtures[flags.map(Number).join('')] ?? null;
}
