export type InvestigationStatus =
  | 'needs_review'
  | 'insufficient_evidence'
  | 'escalate'
  | 'nominal'
  | 'review'
  | 'resource-unavailable';

export interface InvestigationNextCheck {
  id?: string;
  title?: string;
  label?: string;
  equipment?: readonly string[];
  requires_equipment?: readonly string[];
  prototype_only?: boolean;
}

export interface InvestigationRequestPayload {
  astronaut_id: string;
  observed_at: string;
  symptoms: string[];
  measurements: {
    resting_hr_bpm: number | null;
    sleep_hours: number | null;
    systolic_bp_mm_hg: number | null;
    diastolic_bp_mm_hg: number | null;
  };
  personal_baseline: {
    resting_hr_bpm: number;
    sleep_hours: number;
  };
  available_equipment: string[];
  communication_status: 'online' | 'offline';
  emergency_override: boolean;
  dataset_type: 'synthetic';
}

export interface InvestigationEvaluateRequest {
  check_in_id: string;
  communication_status: 'online' | 'offline';
  emergency_override: boolean;
}

export interface ScenarioResponse {
  id?: string;
  status: InvestigationStatus;
  observations: { bp?: string | null } | string[];
  missing_data: string[];
  resource_constraints: { bp_monitor_available?: boolean } | string[];
  safety_flags: string[];
  next_check: InvestigationNextCheck | null;
  requires_medical_officer_review: boolean;
  explanation: { selected: string; excluded?: string } | string;
  evidence_sources:
    | { id: string; kind: 'scripted-demo'; version: string }[]
    | string[];
  diagnosis: null;
}

/**
 * Display adapter for investigation responses. No decision logic.
 */
export function formatInvestigationView(res: ScenarioResponse | null) {
  if (!res) {
    return {
      id: 'UNAVAILABLE',
      status: 'insufficient_evidence' as InvestigationStatus,
      statusBadge: 'INSUFFICIENT EVIDENCE',
      statusTone: 'amber' as 'ok' | 'amber' | 'coral',
      nextCheckTitle: 'No next check',
      nextCheckEquipment: [] as string[],
      hasNextCheck: false,
      selectedExplanation:
        'No investigation response is available.',
      excludedExplanation:
        'No exclusion explanation is available.',
      resourceConstraintsList: [] as string[],
      observationsBp: null as string | null,
      observationsList: [] as string[],
      missingData: [] as string[],
      safetyFlags: [] as string[],
      reviewLabel: 'Unavailable',
    };
  }

  const nextTitle =
    res.next_check?.label ?? res.next_check?.title ?? null;
  const nextEquip = [
    ...(res.next_check?.requires_equipment ??
      res.next_check?.equipment ??
      []),
  ];

  const selectedExplanation =
    typeof res.explanation === 'string'
      ? res.explanation
      : res.explanation.selected;
  const excludedExplanation =
    typeof res.explanation === 'string'
      ? res.resource_constraints && Array.isArray(res.resource_constraints) && res.resource_constraints.length > 0
        ? res.resource_constraints.join(' · ')
        : 'No separate exclusion explanation was returned. See the engine explanation above.'
      : (res.explanation.excluded ?? '');

  const observationsBp =
    !Array.isArray(res.observations) && res.observations
      ? (res.observations.bp ?? null)
      : null;

  const resourceConstraintsList = Array.isArray(res.resource_constraints)
    ? res.resource_constraints
    : res.resource_constraints.bp_monitor_available
    ? []
    : ['bp_monitor unavailable'];

  let statusBadge = 'NEEDS REVIEW';
  let statusTone: 'ok' | 'amber' | 'coral' = 'ok';

  if (res.status === 'escalate') {
    statusBadge = 'ESCALATE · EMERGENCY PROTOCOL';
    statusTone = 'coral';
  } else if (
    res.status === 'insufficient_evidence' ||
    res.status === 'resource-unavailable'
  ) {
    statusBadge =
      res.status === 'insufficient_evidence'
        ? 'INSUFFICIENT EVIDENCE'
        : 'NEEDS REVIEW · RESOURCE CONSTRAINT';
    statusTone = 'amber';
  } else if (res.status === 'needs_review' || res.status === 'review') {
    statusBadge = 'NEEDS REVIEW';
    statusTone = 'ok';
  } else if (res.status === 'nominal') {
    statusBadge = 'NOMINAL';
    statusTone = 'ok';
  }

  return {
    id: res.id ?? res.next_check?.id ?? 'RESPONSE',
    status: res.status,
    statusBadge,
    statusTone,
    nextCheckTitle:
      nextTitle ??
      (res.status === 'escalate'
        ? 'Escalation demo — no next check (next_check: null)'
        : 'No permissible next check (next_check: null)'),
    nextCheckEquipment: nextEquip,
    hasNextCheck: res.next_check !== null,
    selectedExplanation,
    excludedExplanation,
    resourceConstraintsList,
    observationsBp,
    observationsList: Array.isArray(res.observations)?res.observations:[],
    missingData: res.missing_data,
    safetyFlags: res.safety_flags,
    reviewLabel: res.requires_medical_officer_review?'Required':'Not required by returned result',
  };
}
