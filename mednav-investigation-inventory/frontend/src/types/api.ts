import type {Crew} from '../data/fixtures';
import type {ScenarioResponse} from './scenario';

export type AstronautDTO = Pick<Crew,'id'|'role'|'hr'|'sleep'|'bp'|'symptoms'|'baseline'|'sleepBaseline'> & {synthetic:true;provenance:string};
export type SavedCheckIn = Pick<Crew,'hr'|'sleep'|'bp'|'symptoms'> & {id:string;astronaut_id:string;recorded_at:string;synthetic:true;provenance:string};
export interface EngineResponse extends ScenarioResponse {
 status:'needs_review'|'insufficient_evidence'|'escalate';
 observations:string[];
 resource_constraints:string[];
 explanation:string;
 evidence_sources:string[];
 next_check:{id:string;label:string;requires_equipment:string[];prototype_only:true}|null;
}

// Exact API fields always win. Only unsupported illustrative fields come from
// the same crew's local display fixture; unknown IDs never borrow another crew.
export function displayProfile(profile:AstronautDTO,fixtures:Crew[]):Crew {
 const extra=fixtures.find(c=>c.id===profile.id);
 return {...(extra??{radiationDailyMsv:null,radiationCumulativeMsv:null,radiationBaselineMsv:null,countermeasureMin:null,countermeasureTargetMin:null,ocularCheck:null,bodyMassKg:null,baselineMassKg:null}),...profile};
}

export interface MedicationStockDTO {
 id: string;
 name: string;
 category: string;
 unit: string;
 quantity: number;
 default_quantity: number;
 max_daily_dose: number;
 standard_course_days: number;
 reserve_per_crew_30d: number;
 contraindications: string;
 protocol_ref: string;
}

export interface MissionContextDTO {
 crew_count: number;
 remaining_days: number;
 mission_label: string;
 medications: MedicationStockDTO[];
 synthetic: true;
}

export interface QuestionOptionDTO {
 value: string;
 label: string;
 tone: 'neutral' | 'confirm' | 'warn';
}

export interface InvestigationQuestionDTO {
 id: string;
 prompt: string;
 rationale: string;
 required_equipment: string | null;
 equipment_usable: boolean | null;
 supports_numeric_input: boolean;
 numeric_label: string | null;
 numeric_unit: string | null;
 options: QuestionOptionDTO[];
}

export interface HypothesisDTO {
 id: string;
 label: string;
 status: 'leading' | 'active' | 'ruled_out';
 score: number;
 reason: string;
}

export interface TurnRecordDTO {
 turn: number;
 question_id: string;
 question_prompt: string;
 answer_value: string;
 answer_label: string;
 numeric_value: number | null;
 recorded_at: string;
}

export interface MedicationAllocationDTO {
 rationing_mode: 'standard' | 'rationed' | 'depleted' | 'non_pharmacologic';
 medication_id: string | null;
 medication_name: string | null;
 unit: string | null;
 stock_available: number;
 crew_count: number;
 remaining_days: number;
 crew_safety_reserve: number;
 allocatable_pool: number;
 standard_total_units: number;
 recommended_total_units: number;
 recommended_daily_dose: number;
 recommended_days: number;
 remaining_stock_after: number;
 instruction_headline: string;
 dosage_schedule: string;
 rationing_rationale: string;
}

export interface CheckInSnapshotDTO {
 id: string;
 astronaut_id: string;
 recorded_at: string;
 hr: number | null;
 baseline_hr: number;
 sleep: number | null;
 baseline_sleep: number;
 bp: string | null;
 symptoms: string[];
 anomalies: string[];
 missing_fields: string[];
}

export interface InvestigationSessionDTO {
 id: string;
 astronaut_id: string;
 check_in_id: string;
 status: 'in_progress' | 'completed';
 turn_count: number;
 max_turns: number;
 summary_headline: string;
 assessment_title: string;
 assessment_summary: string;
 confidence_pct: number;
 check_in_snapshot: CheckInSnapshotDTO;
 mission_context: MissionContextDTO;
 hypotheses: HypothesisDTO[];
 current_question: InvestigationQuestionDTO | null;
 turns: TurnRecordDTO[];
 medication_allocation: MedicationAllocationDTO | null;
 secondary_allocations: MedicationAllocationDTO[];
 clinical_basis: string[];
 dispensed: boolean;
 dispensed_medication_id: string | null;
 dispensed_units: number;
 dispensed_secondary_ids: string[];
 synthetic: true;
}
