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
