import type {ScenarioResponse} from '../types/scenario';
// Exact finite lookup: monitor, BP record, Earth link, manual override.
// These are authored UI examples, not medical recommendations or validated protocols.
const authored = {
 blocked: {status:'resource-unavailable',next_check:{title:'Review the missing observation',equipment:['Crew check-in tablet']},explanation:{selected:'The record is incomplete and the monitor is unavailable. This example keeps the missing observation visible for medical-officer review.',excluded:'A blood-pressure recording check is excluded because no usable monitor is available.'}},
 measure: {status:'review',next_check:{title:'Preview a measurement check',equipment:['Blood-pressure monitor']},explanation:{selected:'This fixture pairs a missing record with an available monitor. The example is a recording workflow, subject to medical-officer review.',excluded:'A completed-record review is excluded because the blood-pressure observation is still missing.'}},
 review: {status:'review',next_check:{title:'Review the observation record',equipment:['Crew check-in tablet']},explanation:{selected:'This example includes a blood-pressure record. It moves to officer review without interpreting the readings.',excluded:'The missing-record workflow is excluded because a synthetic observation is present.'}},
 escalation: {status:'escalate',next_check:null,explanation:{selected:'The manual emergency override selects this escalation demonstration. No emergency was detected or inferred.',excluded:'All routine next checks are suppressed. No procedure or treatment is generated.'}}
} as const;
const keys:Record<string,keyof typeof authored>={
 '0000':'blocked','0010':'blocked','0100':'review','0110':'review',
 '1000':'measure','1010':'measure','1100':'review','1110':'review',
 '0001':'escalation','0011':'escalation','0101':'escalation','0111':'escalation',
 '1001':'escalation','1011':'escalation','1101':'escalation','1111':'escalation'
};
export const scenarioFixtures:Record<string,ScenarioResponse>=Object.fromEntries(Object.entries(keys).map(([key,name])=>[key,{
 id:`MN-${key}`, ...authored[name],
 observations:{bp:key[1]==='1'?'120 / 80':null},
 missing_data:key[1]==='1'?[]:['Blood pressure'],
 resource_constraints:{bp_monitor_available:key[0]==='1'},
 safety_flags:name==='escalation'?['Manual emergency override']:['No automated clinical assessment'],
 requires_medical_officer_review:true,
 evidence_sources:[{id:'MEDNAV-UI-FIXTURES',kind:'scripted-demo',version:'1.0'}],diagnosis:null
}]));
export function getScenario(flags:boolean[]){return scenarioFixtures[flags.map(Number).join('')]??null;}
