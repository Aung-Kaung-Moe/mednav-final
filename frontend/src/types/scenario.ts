export interface ScenarioResponse {
 id: string; status: 'review' | 'resource-unavailable' | 'escalate';
 observations: {bp: string|null}; missing_data: string[];
 resource_constraints: {bp_monitor_available:boolean}; safety_flags:string[];
 next_check: {title:string; equipment:readonly string[]}|null;
 requires_medical_officer_review: boolean;
 explanation: {selected:string; excluded:string};
 evidence_sources: {id:string; kind:'scripted-demo'; version:string}[];
 diagnosis:null;
}
