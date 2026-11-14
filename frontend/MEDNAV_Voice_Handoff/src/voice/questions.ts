import type { Measurements } from '../types'

export type QuestionStep = 'symptoms'|'onset'|'heart_rate'|'sleep'|'blood_pressure'|'confirm'
export type VoiceDraft = {
  symptoms: string[]
  onset_note: string // UI-only; API contract v1 has no onset field
  measurements: Measurements
}
export const INITIAL_DRAFT:VoiceDraft={
  symptoms:[], onset_note:'Not specified',
  measurements:{resting_hr_bpm:null,sleep_hours:null,systolic_bp_mm_hg:null,diastolic_bp_mm_hg:null},
}
export const QUESTIONS:Record<QuestionStep,string>={
  symptoms:'Are you experiencing any symptoms? For example, headache, dizziness, fatigue, or nausea. Say none if you have no symptoms.',
  onset:'When did these symptoms begin? You may say unknown.',
  heart_rate:'Have you measured your resting heart rate? Tell me the number in beats per minute, or say not measured.',
  sleep:'How many hours did you sleep in your most recent sleep period? Or say unknown.',
  blood_pressure:'What is your measured blood pressure? For example, 120 over 80, in millimeters of mercury. Or say not measured.',
  confirm:'',
}
export const NEXT_STEP:Record<Exclude<QuestionStep,'confirm'>,QuestionStep>={
  symptoms:'onset',onset:'heart_rate',heart_rate:'sleep',sleep:'blood_pressure',blood_pressure:'confirm',
}
export function isUnknown(s:string){return /^(?:not measured|unknown|no reading|not available|skip|i do not know|i don't know|none)$/i.test(s.trim())}

const small:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90}
export function spokenNumber(raw:string):number|null {
 const v=raw.toLowerCase().trim().replace(/beats per minute|millimeters of mercury|hours?|bpm|mmhg/gi,'').trim()
 if(/^\d+(?:\.\d+)?$/.test(v)) return Number(v)
 if(/^\d+\s+(?:point|dot)\s+\d+$/.test(v)) return Number(v.replace(/\s+(?:point|dot)\s+/,' .').replace(' .','.'))
 const words=v.replace(/-/g,' ').replace(/\band\b/g,' ').split(/\s+/).filter(Boolean)
 if (!words.length) return null
 const dot=words.findIndex(w=>w==='point'||w==='dot')
 if(dot!==-1) {
  const integer=spokenNumber(words.slice(0,dot).join(' '))
  if(integer===null || words.slice(dot+1).some(w=>small[w]===undefined||small[w]>9)) return null
  const decimals=words.slice(dot+1).map(w=>small[w]).join('')
  return decimals?Number(`${integer}.${decimals}`):null
 }
 let total=0; let last=0
 for(let i=0;i<words.length;i++) {
  const word=words[i]
  if(word==='hundred') {if(total<1||total>9) return null;total*=100;last=100;continue}
  const n=small[word];if(n===undefined) return null
  if(last===100 && n<10) {total+=n;last=n;continue}
  if(n===0&&words.length>1) return null
  if(last>=20&&last%10===0&&n<10){total+=n;last=n;continue}
  if(total>=100 && n>=10 && n<100){total+=n;last=n;continue}
  // 1 20 => 120 (colloquial "one twenty")
  if(total>0 && total<10 && n>=20 && n<100) {total=total*100+n;last=n;continue}
  if(total>0&&n>=10) return null
  total+=n;last=n
 }
 return total
}
export function parseBP(text:string):[number,number]|null {
 const v=text.trim().toLowerCase().replace(/mmhg|millimeters? of mercury/g,'').trim()
 const parts=v.split(/\s+(?:over|by)\s+|\s*\/\s*/)
 if(parts.length!==2) return null
 const a=spokenNumber(parts[0]),b=spokenNumber(parts[1])
 if(a===null||b===null||!Number.isInteger(a)||!Number.isInteger(b)||a<1||a>300||b<1||b>250)return null
 return [a,b]
}
export function parseSymptoms(text:string):string[]|null {
 const s=text.toLowerCase()
 if (/\b(no symptoms|none|nothing|i feel fine|no)\b/.test(s))return []
 const known:[string,string][]=[['headache','headache'],['head pain','headache'],['dizzy','dizziness'],['dizziness','dizziness'],['tired','fatigue'],['fatigue','fatigue'],['nausea','nausea'],['sick to my stomach','nausea'],['sleep trouble','sleep_disturbance'],['poor sleep','sleep_disturbance'],['muscle pain','muscle_discomfort'],['muscle discomfort','muscle_discomfort']]
 const picked=new Set<string>()
 for(const [needle,value] of known) if(s.includes(needle))picked.add(value)
 return picked.size?[...picked]:null
}
export function draftSummary(d:VoiceDraft):string{
 const m=d.measurements
 return `Symptoms: ${d.symptoms.join(', ')||'none reported'}. Onset: ${d.onset_note}. `+
 `Resting heart rate: ${m.resting_hr_bpm===null?'unknown':m.resting_hr_bpm+' beats per minute'}. `+
 `Sleep: ${m.sleep_hours===null?'unknown':m.sleep_hours+' hours'}. `+
 `Blood pressure: ${m.systolic_bp_mm_hg===null||m.diastolic_bp_mm_hg===null?'unknown':m.systolic_bp_mm_hg+' over '+m.diastolic_bp_mm_hg+' millimeters of mercury'}. `+
 'Do you confirm these entries should be saved? Say yes or no.'
}
