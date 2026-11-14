import type {Crew} from '../data/fixtures';
import type {ScenarioResponse} from './scenario';

export type AstronautDTO = Pick<Crew,'id'|'role'|'hr'|'sleep'|'bp'|'symptoms'|'baseline'|'sleepBaseline'> & {synthetic:true;provenance:string};
export type SavedCheckIn = Pick<Crew,'hr'|'sleep'|'bp'|'symptoms'> & {id:string;astronaut_id:string;recorded_at:string;synthetic:true;provenance:string};
export type FollowUpType='review_requested'|'note_recorded'|'action_recorded';
export type FollowUpCreate={astronaut_id:string;check_in_id:string;event_type:FollowUpType;note?:string|null};
export type FollowUpEvent=FollowUpCreate&{id:string;note:string|null;recorded_at:string;synthetic:true;provenance:string};
export interface EngineResponse extends ScenarioResponse {
 status:'needs_review'|'insufficient_evidence'|'escalate';
 observations:string[];
 resource_constraints:string[];
 explanation:string;
 evidence_sources:string[];
 next_check:{id:string;label:string;requires_equipment:string[];prototype_only:true}|null;
}

// Supported API fields win. Other display fixtures belong to the same crew;
// ocular measurements are always unavailable under the current live contract.
export function displayProfile(profile:AstronautDTO,fixtures:Crew[]):Crew {
 const extra=fixtures.find(c=>c.id===profile.id);
 return {...(extra??{radiationDailyMsv:null,radiationCumulativeMsv:null,radiationBaselineMsv:null,countermeasureMin:null,countermeasureTargetMin:null,ocularCheck:null,bodyMassKg:null,baselineMassKg:null}),...profile,ocularCheck:null};
}

// Every selected-crew display uses the same validated history snapshot. An
// absent/null latest reading must never inherit an older profile reading.
export function recordedProfile(profile:Crew,latest?:SavedCheckIn):Crew {
 if(latest&&latest.astronaut_id!==profile.id)throw new Error('Recorded profile crew mismatch.');
 return {...profile,hr:latest?.hr??null,sleep:latest?.sleep??null,bp:latest?.bp??null,symptoms:latest?.symptoms??[],ocularCheck:null};
}
