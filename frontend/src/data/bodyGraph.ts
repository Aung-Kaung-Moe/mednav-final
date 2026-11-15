import type {Crew} from './fixtures';
import type {SavedCheckIn} from '../types/api';

export const BODY_SYSTEMS = [
 {id:'heart',label:'Heart / Cardiovascular',short:'Heart',part:'heart',mode:'organs'},
 {id:'brain',label:'Brain / Sleep',short:'Brain',part:'brain',mode:'organs'},
 {id:'eyes',label:'Eyes / Ocular',short:'Eyes',part:'eye_l',mode:'organs'},
 {id:'muscles',label:'Muscles / Exercise',short:'Muscles',part:'quadriceps_l',mode:'surface'},
 {id:'bones',label:'Bones / Skeletal',short:'Bones',part:'spine',mode:'skeleton'},
 {id:'balance',label:'Vestibular / Balance',short:'Balance',part:'brainstem',mode:'organs'},
 {id:'lungs',label:'Lungs / Respiratory',short:'Lungs',part:'lung_l',mode:'organs'},
 {id:'skin',label:'Skin / Immune',short:'Skin / Immune',part:'skin',mode:'surface'},
] as const;
export type BodySystem=typeof BODY_SYSTEMS[number]['id'];
export type EvidenceState={recorded:boolean;changed:boolean;missing:boolean;review:boolean};

export function regionForPart(part:string):BodySystem|null {
 if(['heart','aorta','veins','chest'].includes(part))return 'heart';
 if(['brain','cranial_nerves'].includes(part))return 'brain';
 if(['brainstem','cerebellum','vestibular'].includes(part))return 'balance';
 if(['eye_l','eye_r','eyes'].includes(part))return 'eyes';
 if(/^(quadriceps|chest_muscles|arm_|leg_|muscles)/.test(part))return 'muscles';
 if(/^(spine|femur|tibia|humerus|radius|rib_cage|sternum|pelvis|skull|bones)/.test(part))return 'bones';
 if(/^lung/.test(part))return 'lungs';
 if(['skin','head','immune'].includes(part))return 'skin';
 return null;
}
const patterns:Record<BodySystem,RegExp>={
 heart:/\b(palpitations|heartbeat|chest pain)\b/i,
 brain:/\b(headache|dizz(?:y|iness)|fatigue|sleep|insomnia)\b/i,
 eyes:/\b(vision|visual|eyes?|ocular|sight|blurry|blurred|floaters|photophobia)\b/i,
 muscles:/\b(fatigue|weakness|muscles?|cramps?|soreness|myalgia|exercise)\b/i,
 bones:/\b(bones?|skeletal|joint pain|fracture)\b/i,
 balance:/\b(dizz(?:y|iness)|vertigo|balance|unsteady|motion sickness)\b/i,
 lungs:/\b(cough|breath|breathing|dyspnea|wheez(?:e|ing))\b/i,
 skin:/\b(skin|rash|itch(?:y|ing)?|fever|immune|infection)\b/i,
};
export function reportedEvidence(system:BodySystem,row:SavedCheckIn):string[]{
 // Display the complete original report, including negation. This is a keyword
 // navigation aid, not a positive clinical finding or symptom diagnosis.
 return row.symptoms.filter(s=>patterns[system].test(s));
}
export const unsupported:Record<BodySystem,string[]>={
 heart:['Blood pressure'],brain:['Sleep duration'],eyes:['Verified ocular assessment / imaging'],
 muscles:['Persisted exercise/activity log','Muscle strength measurement'],bones:['Bone-density measurement','Skeletal imaging'],
 balance:['Verified balance/vestibular assessment'],lungs:['Respiratory rate','Oxygen saturation / lung-function measurement'],
 skin:['Verified skin assessment','Immune/laboratory measurement'],
};
export function systemEvidence(system:BodySystem,row:SavedCheckIn|undefined,crew:Crew){
 const reports=row?reportedEvidence(system,row):[];
 const missing=system==='heart'?[...(row?.hr==null?['Heart rate']:[]),...(row?.bp==null?['Blood pressure']:[])]:system==='brain'?(row?.sleep==null?['Sleep duration']:[]):unsupported[system];
 const numeric=system==='heart'?(row?.hr!=null||row?.bp!=null):system==='brain'?row?.sleep!=null:false;
 const changed=system==='heart'?row?.hr!=null&&row.hr!==crew.baseline:system==='brain'?row?.sleep!=null&&row.sleep!==crew.sleepBaseline:false;
 return {reports,missing,state:{recorded:numeric||reports.length>0,changed,missing:missing.length>0,review:Boolean(row)} satisfies EvidenceState};
}
export function replayWindow(rows:SavedCheckIn[],crewId:string,id:string|null){
 if(rows.some(r=>r.astronaut_id!==crewId||!r.synthetic||!r.provenance.trim()))throw new Error('BodyGraph requires this crew’s labelled synthetic saved evidence.');
 const index=id===null?rows.length-1:rows.findIndex(r=>r.id===id);
 if(id!==null&&index<0)throw new Error('Selected replay check-in unavailable. Return to latest or refresh history.');
 return {record:rows[index],history:rows.slice(0,index+1),replaying:id!==null};
}
export function evidenceLabels(state:EvidenceState):string[]{
 return [state.recorded?'Recorded evidence':null,state.changed?'Descriptive baseline change':null,state.missing?'Missing evidence':null,state.review?'Review available':null].filter((s):s is string=>s!==null);
}
