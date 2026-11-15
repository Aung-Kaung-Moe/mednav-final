import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Mic, Send, Volume2, X, Activity, Timer, ShieldAlert } from 'lucide-react'
import { apiFor } from './api'
import type { HealthHistory, InvestigationRequest, InvestigationResponse, UiMode } from './types'
import { COMMANDS, matchCommand, normalized, parseWake } from './commands'
import { INITIAL_DRAFT, NEXT_STEP, QUESTIONS, draftSummary, isUnknown, parseBP, parseSymptoms, spokenNumber, type QuestionStep, type VoiceDraft } from './questions'
import type { OfflineRecognizer } from './recognizer'
import { LocalSpeaker } from './speaker'
import './voice.css'

type VoiceStep = QuestionStep | 'pulse_beats' | null
type NavPage = 'dashboard'|'crew'|'investigation'|'trends'|'inventory'|'reports'|'research'|'settings'
const responseOrUnknown=(n:number|null,unit:string)=>n===null?'Not available':`${n} ${unit}`
const lastAvailable=(history:HealthHistory,key:'resting_hr_bpm'|'sleep_hours')=>{
  const records=[...history.series].sort((a,b)=>a.observed_at.localeCompare(b.observed_at))
  return [...records].reverse().find(r=>r[key]!==null)??null
}
const asTime=(date:string)=>{const parsed=new Date(date);return Number.isNaN(parsed.getTime())?date:parsed.toLocaleString()}

function speechRecommendation(result:InvestigationResponse):string {
  if(result.status==='escalate') return `Emergency scenario flagged. ${result.explanation} No routine next check is selected. Medical officer review is required.`
  const needs=result.requires_medical_officer_review?'Medical officer review is required. ':'Medical officer review was not explicitly required by this prototype. '
  const next=result.next_check?`The next permitted prototype check is: ${result.next_check.label}. `:'No routine check has been selected. '
  const gaps=result.missing_data.length?`Missing information: ${result.missing_data.map(k=>k.replaceAll('_',' ')).join(', ')}. `:''
  const resources=result.resource_constraints.length?`Resource constraints: ${result.resource_constraints.join(', ')}. `:''
  return `${result.status.replaceAll('_',' ')}. ${needs}${gaps}${resources}${next}${result.explanation}`
}

export default function VoiceAssistant({crew,onNavigate}:{crew:string;onNavigate:(page:NavPage)=>void}) {
  const [open,setOpen]=useState(false)
  const [listening,setListening]=useState(false)
  const [loading,setLoading]=useState(false)
  const [processing,setProcessing]=useState(false)
  const [ttsMissing,setTtsMissing]=useState(false)
  const [mode,setMode]=useState<UiMode>('demo')
  const [error,setError]=useState('')
  const [transcript,setTranscript]=useState('')
  const [replyText,setReplyText]=useState('Say “Hey MEDNAV” to begin, or “Health Check” to start a check-in.')
  const [testText,setTestText]=useState('')
  const [awake,setAwake]=useState(false)
  const [step,setStep]=useState<VoiceStep>(null)
  const [draft,setDraft]=useState<VoiceDraft>(()=>structuredClone(INITIAL_DRAFT))
  const [lastResult,setLastResult]=useState<InvestigationResponse|null>(null)
  const [isSaving,setIsSaving]=useState(false)
  const [pulseSeconds,setPulseSeconds]=useState(60)
  const [pulseRunning,setPulseRunning]=useState(false)
  const [lastCheckinId,setLastCheckinId]=useState('')
  const recog=useRef<OfflineRecognizer|null>(null)
  const speaker=useRef(new LocalSpeaker())
  const awakeRef=useRef(false)
  const stepRef=useRef<VoiceStep>(null)
  const draftRef=useRef<VoiceDraft>(structuredClone(INITIAL_DRAFT))
  const recentResult=useRef<InvestigationResponse|null>(null)
  const storedConfirmed=useRef<VoiceDraft|null>(null)
  const manuallyCountedHr=useRef<number|null>(null)
  const pulseEndAt=useRef<number>(0)
  const latestConfirmed=useRef<{crew:string;measurements:VoiceDraft['measurements'];observed_at:string;id:string}|null>(null)
  const handling=useRef(false)
  const lastSpoken=useRef('')
  const onSpeech=useRef<(value:string)=>Promise<void>>(async()=>{})
  const listeningGeneration=useRef(0)
  const starting=useRef(false)

  const setCurrentDraft=(next:VoiceDraft)=>{draftRef.current=next;setDraft(next)}
  const setCurrentStep=(next:VoiceStep)=>{stepRef.current=next;setStep(next)}
  const setActive=(value:boolean)=>{awakeRef.current=value;setAwake(value)}

  const say=useCallback(async(text:string)=>{
    setReplyText(text)
    lastSpoken.current=text
    if(recog.current)recog.current.paused=true
    try {
      const played=await speaker.current.say(text)
      setTtsMissing(!played)
    }finally{
      // Prevent the microphone from hearing its own speaker.
      await new Promise(resolve=>setTimeout(resolve,350))
      if(recog.current)recog.current.paused=false
    }
  },[listening])

  const ask=useCallback(async(next:QuestionStep,d:VoiceDraft=draftRef.current)=>{
    setCurrentStep(next)
    await say(next==='confirm'?draftSummary(d):QUESTIONS[next])
  },[say])

  const getHistory=useCallback(()=>apiFor(mode).health(crew),[mode,crew])

  const readHistory=useCallback(async(kind:'heart_rate'|'sleep'|'blood_pressure'|'health_status')=>{
    try {
      const confirmed=latestConfirmed.current?.crew===crew?latestConfirmed.current:null
      const history=await getHistory()
      const hr=lastAvailable(history,'resting_hr_bpm')
      const sleep=lastAvailable(history,'sleep_hours')
      const hrv=hr?.resting_hr_bpm??null
      const slv=sleep?.sleep_hours??null
      const prefix=mode==='demo'?'Synthetic demo record. ':'Recorded health history. '
      if(kind==='heart_rate')return await say(confirmed?`From your confirmed ${mode==='demo'?'synthetic ':''}check-in at ${asTime(confirmed.observed_at)}, resting heart rate is ${responseOrUnknown(confirmed.measurements.resting_hr_bpm,'beats per minute')}.`:(prefix+(hrv===null?'Resting heart rate is not available.':`The most recent available resting heart rate is ${hrv} beats per minute, recorded ${asTime(hr!.observed_at)}.`)))
      if(kind==='sleep')return await say(confirmed?`From your confirmed ${mode==='demo'?'synthetic ':''}check-in at ${asTime(confirmed.observed_at)}, sleep duration is ${responseOrUnknown(confirmed.measurements.sleep_hours,'hours')}.`:(prefix+(slv===null?'Sleep measurement is not available.':`The most recent available sleep duration is ${slv} hours, recorded ${asTime(sleep!.observed_at)}.`)))
      if(kind==='blood_pressure')return await say(confirmed?`From your confirmed ${mode==='demo'?'synthetic ':''}check-in: blood pressure is ${confirmed.measurements.systolic_bp_mm_hg!==null&&confirmed.measurements.diastolic_bp_mm_hg!==null?`${confirmed.measurements.systolic_bp_mm_hg} over ${confirmed.measurements.diastolic_bp_mm_hg} millimeters of mercury`:'Not available'}.`:'Blood pressure is not available in the stored trend history. You may enter a measured systolic and diastolic value in the check-in form. Unknown does not mean normal.')
      return await say(prefix+`Last recorded heart rate: ${responseOrUnknown(hrv,'beats per minute')}. Last recorded sleep: ${responseOrUnknown(slv,'hours')}. `+
        `Personal baseline: heart rate ${responseOrUnknown(history.baseline.resting_hr_bpm,'beats per minute')}; sleep ${responseOrUnknown(history.baseline.sleep_hours,'hours')}. These are recorded values, not real-time sensor readings.`)
    } catch(err) {return await say(`Could not load stored measurements. ${err instanceof Error?err.message:'Check the local backend connection.'}`)}
  },[getHistory,mode,say])

  const investigate=useCallback(async(confirmed:VoiceDraft)=>{
    setIsSaving(true)
    setError('')
    try {
      const client=apiFor(mode)
      const [history,inventory]=await Promise.all([client.health(crew),client.inventory()])
      const request:InvestigationRequest={
        astronaut_id:crew,observed_at:new Date().toISOString(),
        symptoms:confirmed.symptoms,measurements:confirmed.measurements,
        personal_baseline:history.baseline,
        available_equipment:inventory.filter(it=>it.usable&&it.quantity>0).map(it=>it.equipment_id),
        communication_status:'offline',emergency_override:false,dataset_type:'synthetic',
      }
      const saved=await client.checkin({astronaut_id:request.astronaut_id,observed_at:request.observed_at,
        symptoms:request.symptoms,measurements:request.measurements,dataset_type:'synthetic'})
      if(!saved.saved) throw new Error('The backend did not confirm save.')
      setLastCheckinId(saved.checkin_id)
      latestConfirmed.current={crew,measurements:{...confirmed.measurements},observed_at:request.observed_at,id:saved.checkin_id}
      const result=await client.investigate(request)
      recentResult.current=result;setLastResult(result)
      window.dispatchEvent(new CustomEvent('mednav:voice-investigation',{detail:{request,response:result,checkin_id:saved.checkin_id,mode}}))
      storedConfirmed.current=null
      setCurrentStep(null)
      onNavigate('investigation')
      await say(`${mode==='demo'?'Synthetic demonstration only. ':''}Check-in saved with ID ${saved.checkin_id}. ${speechRecommendation(result)}`)
    }catch(err){
      const m=err instanceof Error?err.message:'Unknown backend error'
      setError(m)
      await say(`The check-in or investigation did not finish. ${m}. Do not assume a medical recommendation was generated.`)
    }finally{setIsSaving(false)}
  },[crew,mode,say,onNavigate])

  const handleQuestion=useCallback(async(text:string,stage:VoiceStep)=>{
    const lower=normalized(text)
    if(['cancel','stop','stop listening','goodbye mednav'].some(x=>normalized(x)===lower)){
      setPulseRunning(false);setCurrentStep(null);setCurrentDraft(structuredClone(INITIAL_DRAFT));
      storedConfirmed.current=null;await say('Health questionnaire cancelled. Nothing was saved.');return
    }
    if(['repeat','repeat that'].some(x=>normalized(x)===lower)){await say(lastSpoken.current);return}
    const old=draftRef.current
    let next={...old,measurements:{...old.measurements}}
    if(stage==='pulse_beats') {
      const count=spokenNumber(text)
      if(count===null||!Number.isInteger(count)||count<1||count>250) return await say('Please give the whole number of beats you counted during exactly 60 seconds, or say cancel.')
      next.measurements.resting_hr_bpm=count
      setCurrentDraft(next);storedConfirmed.current=next;setCurrentStep('confirm')
      return await say(`You counted ${count} beats in 60 seconds. Should I save ${count} beats per minute in the questionnaire? Say yes or no. This is a manually counted value, not an automatic sensor reading.`)
    }
    if(stage==='confirm') {
      if(/^(yes|correct|confirm|save|yes save it|that is correct)$/.test(lower)){
        setCurrentStep(null)
        if(storedConfirmed.current){manuallyCountedHr.current=storedConfirmed.current.measurements.resting_hr_bpm;storedConfirmed.current=null;await say('Manual pulse value confirmed, but not yet saved. Start a health check to include it in the next confirmed report.');return}
        return await investigate(old)
      }
      if(/^(no|incorrect|do not save|discard)$/.test(lower)){
        setCurrentStep(null);storedConfirmed.current=null;setCurrentDraft(structuredClone(INITIAL_DRAFT));
        await say('Entries discarded. Nothing was saved.');return
      }
      await say('Please say yes to save the confirmed measurements, or no to discard.');return
    }
    if(stage==='symptoms') {
      const s=parseSymptoms(text)
      if(s===null) return await say('I could not safely identify the symptom. Please say headache, dizziness, fatigue, nausea, poor sleep, muscle discomfort, or none. You may use the form for other symptoms.')
      next.symptoms=s
    }
    if(stage==='onset') next.onset_note=isUnknown(text)?'Unknown':text.slice(0,120)
    if(stage==='heart_rate') {
      const n=isUnknown(text)?null:spokenNumber(text)
      if(n!==null &&(!Number.isInteger(n)||n<1||n>250))return await say('Please give a manually measured whole number of beats per minute, from 1 to 250, or say not measured.')
      if(n===null && !isUnknown(text))return await say('I did not understand the number. Please repeat the measured heart rate or say not measured.')
      next.measurements.resting_hr_bpm=n
    }
    if(stage==='sleep') {
      const n=isUnknown(text)?null:spokenNumber(text)
      if(n!==null&&(n<0||n>24))return await say('Please give hours slept, from 0 to 24, or say unknown.')
      if(n===null&&!isUnknown(text))return await say('Please say a number of hours, such as seven point five, or say unknown.')
      next.measurements.sleep_hours=n
    }
    if(stage==='blood_pressure') {
      const values=isUnknown(text)?null:parseBP(text)
      if(values===null&&!isUnknown(text))return await say('Please state a measured blood pressure like 120 over 80, or say not measured. I cannot estimate blood pressure from your voice.')
      next.measurements.systolic_bp_mm_hg=values?.[0]??null
      next.measurements.diastolic_bp_mm_hg=values?.[1]??null
    }
    setCurrentDraft(next)
    await ask(NEXT_STEP[stage as Exclude<QuestionStep,'confirm'>],next)
  },[ask,investigate,say])

  const process=useCallback(async(utterance:string)=>{
    const text=utterance.trim()
    if(!text||handling.current||isSaving) return
    handling.current=true
    setProcessing(true)
    setTranscript(text);setError('')
    try {
      if(['stop','stop listening','stop microphone'].includes(normalized(text))){
        listeningGeneration.current++
        const instance=recog.current;recog.current=null
        setListening(false);setActive(false);setCurrentStep(null);setPulseRunning(false)
        await instance?.stop()
        setOpen(false)
        await say('Microphone stopped. Select Voice AI to listen again.')
        return
      }
      // A safety escalation prompt is not a diagnosis or automatic emergency flag.
      if(/\b(emergency|severe chest pain|unconscious|can't breathe|cannot breathe|difficulty breathing|loss of consciousness)\b/i.test(text)){
        setCurrentStep(null);setPulseRunning(false);await say('Possible emergency language heard. Do not rely on this prototype for triage. Follow the mission-approved emergency protocol and seek medical officer review immediately. No treatment has been selected.');return
      }
      const wake=parseWake(text)
      if(wake.woke){setOpen(true);setActive(true);if(!wake.remainder) {await say(`Hello, astronaut ${crew}. I am MEDNAV. Would you like to start a health check?`);return}}
      const textToMatch=wake.woke&&wake.remainder?wake.remainder:text
      const directIntent=matchCommand(textToMatch)
      if(!awakeRef.current && !wake.woke) {
        if(directIntent==='start_check') {setOpen(true);setActive(true)}
        else return
      }
      if(stepRef.current){await handleQuestion(textToMatch,stepRef.current);return}
      const intent=directIntent
      switch(intent){
       case 'wake':setActive(true);await say(`Hello, astronaut ${crew}. Say start health check or ask me for recorded measurements.`);break
       case 'start_check':{const beginning=structuredClone(INITIAL_DRAFT);beginning.measurements.resting_hr_bpm=manuallyCountedHr.current;setCurrentDraft(beginning);storedConfirmed.current=null;await ask('symptoms',beginning);break}
       case 'health_status':await readHistory('health_status');break
       case 'heart_rate':await readHistory('heart_rate');break
       case 'sleep':await readHistory('sleep');break
       case 'blood_pressure':await readHistory('blood_pressure');break
       case 'history':onNavigate('trends');await say('Opening the stored heart-rate and sleep trends. Gaps represent unknown measurements.');break
       case 'missing':{
         if(recentResult.current){await say(`Most recent investigation missing: ${recentResult.current.missing_data.length?recentResult.current.missing_data.join(', ').replaceAll('_',' '):'none reported'}.`)}
         else {const m=draftRef.current.measurements;const missing=Object.entries(m).filter(([,v])=>v===null).map(([k])=>k.replaceAll('_',' '));await say(`Current questionnaire missing information: ${missing.join(', ')||'none'}. This is not a diagnosis.`)}
         break
       }
       case 'inventory':{
         onNavigate('inventory')
         try{const stock=await apiFor(mode).inventory();const ready=stock.filter(x=>x.usable&&x.quantity>0);await say(`${mode==='demo'?'Synthetic demo inventory. ':''}${ready.length} usable equipment types recorded. ${stock.map(x=>`${x.label}: ${x.quantity===0?'out of stock':!x.usable?'unusable':`${x.quantity} available`}`).join('. ')}.`)}
         catch{await say('The local inventory could not be retrieved. The displayed inventory may be unavailable.')}break
       }
       case 'investigate':{
         if(recentResult.current){await say(`The last investigation status is ${recentResult.current.status.replaceAll('_',' ')}. Say read my recommendation for details, or start health check for a new record.`)}
         else if(storedConfirmed.current){await investigate(storedConfirmed.current)}
         else {onNavigate('investigation');await say('To investigate new symptoms, say start health check, answer the questions, and confirm before saving. You can also use the investigation form.')}break
       }
       case 'recommendation':
         if(recentResult.current)await say(`${mode==='demo'?'Synthetic demo. ':''}${speechRecommendation(recentResult.current)}`)
         else await say('No investigation recommendation is available. Start and confirm a health check or run an investigation first.')
         break
       case 'pulse_timer':
         await say('Place two fingers on your wrist and get ready to count pulse beats. The sixty-second timer starts now. I cannot measure pulse from the microphone.');
         pulseEndAt.current=performance.now()+60000;setPulseSeconds(60);setPulseRunning(true);break
       case 'control':
         if(/repeat/.test(normalized(textToMatch)))await say(lastSpoken.current)
         else {setActive(false);setCurrentStep(null);setPulseRunning(false);await say('Voice session closed. Say Hey MEDNAV to reactivate.')}break
       default:await say('I did not confidently recognize that command. Please try: start health check, heart rate, missing data, equipment, or read my recommendation.');break
      }
    } finally {handling.current=false;setProcessing(false)}
  },[crew,mode,onNavigate,say,ask,readHistory,handleQuestion,isSaving,investigate])
  useEffect(()=>{
    // Never read the previous astronaut's recommendation or manually entered value.
    recentResult.current=null;setLastResult(null);latestConfirmed.current=null
    setCurrentStep(null);setCurrentDraft(structuredClone(INITIAL_DRAFT));setPulseRunning(false)
    setLastCheckinId('');setActive(false);storedConfirmed.current=null;manuallyCountedHr.current=null
  },[crew])
  useEffect(()=>{onSpeech.current=process},[process])

  useEffect(()=>{
    function onExternal(e:Event){
      const data=(e as CustomEvent<{response:InvestigationResponse}>).detail
      if(data?.response){recentResult.current=data.response;setLastResult(data.response)}
    }
    window.addEventListener('mednav:investigation-result',onExternal)
    return()=>window.removeEventListener('mednav:investigation-result',onExternal)
  },[])
  useEffect(()=>{
    void startListening()
    return()=>{
      listeningGeneration.current++
      starting.current=false
      const instance=recog.current;recog.current=null
      void instance?.stop();speaker.current.stop()
    }
  },[])
  useEffect(()=>{
    if(!pulseRunning) return
    const interval=window.setInterval(()=>setPulseSeconds(Math.max(0,Math.ceil((pulseEndAt.current-performance.now())/1000))),150)
    return()=>window.clearInterval(interval)
  },[pulseRunning])
  useEffect(()=>{
    if(pulseRunning&&pulseSeconds===0){
      setPulseRunning(false);setActive(true);setCurrentStep('pulse_beats')
      void say('60 seconds finished. How many beats did you count? Say the number of beats or cancel.')
    }
  },[pulseRunning,pulseSeconds,say])

  async function startListening(){
    if(recog.current||starting.current)return
    starting.current=true
    const generation=++listeningGeneration.current
    setError('');setLoading(true)
    try{
      const { OfflineRecognizer } = await import('./recognizer')
      if(generation!==listeningGeneration.current)return
      const instance=new OfflineRecognizer(s=>{void onSpeech.current(s)},message=>setError(message))
      recog.current=instance
      await instance.start()
      if(generation!==listeningGeneration.current){await instance.stop();return}
      void speaker.current.prime()
      setListening(true)
      setReplyText('Listening. Say “Hey MEDNAV” or “Health Check”. Say “Stop” to turn off the microphone.')
    }catch(err){
      if(generation!==listeningGeneration.current)return
      const m=err instanceof Error?err.message:'Could not enable local voice recognition.'
      setError(m);setListening(false);recog.current=null
    }finally{if(generation===listeningGeneration.current){starting.current=false;setLoading(false)}}
  }
  function typedCommand(e:FormEvent){
    e.preventDefault();if(!testText.trim())return
    void speaker.current.prime()
    // Manual input acts as activation; it does not depend on microphone permissions.
    setActive(true)
    void onSpeech.current(testText)
    setTestText('')
  }

  return <>
    {!open&&<button className="voice-fab" onClick={()=>{setOpen(true);if(!recog.current)void startListening()}} aria-label="Open MEDNAV offline voice assistant"><Mic size={19}/><span>VOICE AI</span><i className={listening?'voice-dot listening':'voice-dot'}/></button>}
    {open&&<section className="voice-panel" aria-label="MEDNAV voice assistant">
      <div className="voice-panel-head"><div><span className="voice-overline">LOCAL MISSION ASSISTANT</span><strong><Activity size={17}/> MEDNAV VOICE</strong></div><button aria-label="Close assistant" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      <div className="voice-state"><span className={`voice-indicator ${listening?'online':''}`}/>{loading?'CONNECTING TO LOCAL VOICE SERVICE':processing?'MEDNAV RESPONDING':listening?step?'LISTENING FOR ANSWER':awake?'LISTENING':'SAY “HEY MEDNAV”':'MICROPHONE OFF'}<small>CREW {crew} · {mode==='demo'?'SYNTHETIC DEMO':'LOCAL API'}</small></div>
      <p className="voice-hint">{listening?'Say “Hey MEDNAV” to call me · “Stop” turns off the microphone.':'Open Voice AI again to restart listening.'}</p>
      <div className="voice-dialog"><div className="voice-response" aria-live="polite"><small>MEDNAV RESPONSE</small><p>{replyText}</p></div>{transcript&&<div className="voice-transcript"><small>HEARD</small><p>{transcript}</p></div>}</div>
      {step&&<div className="voice-question-state"><strong>{step==='pulse_beats'?'PULSE COUNT ENTRY':`QUESTION: ${step.toUpperCase().replace('_',' ')}`}</strong><p>{step==='confirm'?'Confirmation required before saving.':step==='pulse_beats'?'Say your manually counted number of beats.':QUESTIONS[step]}</p><p className="voice-mini">Current draft: {draft.symptoms.join(', ')||'no symptoms'} · HR {draft.measurements.resting_hr_bpm??'Unknown'} · Sleep {draft.measurements.sleep_hours??'Unknown'}</p></div>}
      {pulseRunning&&<div className="voice-timer"><Timer size={18}/><strong>Manual pulse timer: {pulseSeconds}s</strong><button onClick={()=>{setPulseRunning(false);setCurrentStep(null);setReplyText('Pulse timer cancelled. Nothing was measured or saved.')}}>Cancel timer</button></div>}
      {lastResult&&<div className="voice-investigation-result"><ShieldAlert size={15}/><span>Latest investigation: <b>{lastResult.status.replaceAll('_',' ')}</b></span><button onClick={()=>void say(speechRecommendation(lastResult))}><Volume2 size={14}/> Read</button></div>}
      {lastCheckinId&&<div className="voice-mini">Last saved check-in: {lastCheckinId}</div>}
      <div className="voice-command-examples"><small>TRY A COMMAND</small><div>{['Health Check','Read my vitals','Read my recommendation'].map(x=><button disabled={processing} key={x} onClick={()=>{void speaker.current.prime();setActive(true);void onSpeech.current(x)}}>{x}</button>)}</div></div>
      <form onSubmit={typedCommand} className="voice-text-input"><input value={testText} onChange={e=>setTestText(e.target.value)} placeholder="Or type a command" aria-label="Test voice command by typing"/><button disabled={processing} aria-label="Send typed command"><Send size={16}/></button></form>
      {error&&<div className="voice-error" role="alert">{error}</div>}
      {ttsMissing&&<p className="voice-warning">Piper voice server unavailable — text responses still work. Run the local Piper server for offline spoken output.</p>}
      <p className="voice-disclaimer">Synthetic demonstration · Medical officer review remains required for flagged findings.</p>
    </section>}
  </>
}
