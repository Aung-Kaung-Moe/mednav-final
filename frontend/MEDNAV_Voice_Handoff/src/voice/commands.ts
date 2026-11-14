/** Offline voice commands: matching never authorizes a medical action by itself. */
export type Intent =
  | 'wake' | 'start_check' | 'health_status' | 'heart_rate' | 'sleep'
  | 'blood_pressure' | 'history' | 'missing' | 'inventory'
  | 'investigate' | 'recommendation' | 'pulse_timer' | 'control'

export const COMMANDS: ReadonlyArray<{ intent: Intent; phrases: readonly string[] }> = [
  { intent: 'wake', phrases: ['hey mednav', 'hey med nav', 'hello mednav', 'hello med nav', 'okay mednav'] },
  { intent: 'start_check', phrases: ['start health check', 'begin health check', 'check my health', 'start check in', 'new health check in'] },
  { intent: 'health_status', phrases: ['show my health status', 'how is my health', 'give me my health summary', 'read my vitals'] },
  { intent: 'heart_rate', phrases: ['what is my heart rate', 'tell me my pulse', 'read my bpm', 'what is my pulse', 'heart rate reading'] },
  { intent: 'sleep', phrases: ['how many hours did i sleep', 'what is my sleep duration', 'read my sleep data', 'how much did i sleep'] },
  { intent: 'blood_pressure', phrases: ['what is my blood pressure', 'read my blood pressure', 'tell me my bp', 'blood pressure reading'] },
  { intent: 'history', phrases: ['show my health history', 'open health trends', 'show heart rate history', 'show my sleep history'] },
  { intent: 'missing', phrases: ['what measurements are missing', 'what data is missing', 'show missing data', 'what is unknown', 'what information is missing'] },
  { intent: 'inventory', phrases: ['check medical equipment', 'show medical inventory', 'what equipment is available', 'open inventory'] },
  { intent: 'investigate', phrases: ['investigate my health', 'run investigation', 'analyze my check in', 'start investigation'] },
  { intent: 'recommendation', phrases: ['read my recommendation', 'what is the next check', 'read the explanation', 'what should i check next', 'read investigation result'] },
  { intent: 'pulse_timer', phrases: ['start pulse timer', 'measure my heart rate', 'count my pulse', 'start heart rate timer'] },
  { intent: 'control', phrases: ['repeat', 'repeat that', 'stop listening', 'cancel', 'goodbye mednav', 'stop'] },
]

export function normalized(text: string) {
  return text.toLowerCase().replace(/med[\s-]+nav/g,'mednav')
    .replace(/\bb\s*p\b/g,'bp').replace(/[^a-z0-9 ]/g,' ')
    .replace(/\b(please|could|you|would|kindly|the|me|my|a|an)\b/g,' ')
    .replace(/\s+/g,' ').trim()
}
function editDistance(a: string, b: string) {
  if (Math.abs(a.length-b.length)>2) return 3
  let v=Array.from({length:b.length+1},(_,i)=>i)
  for(let i=1;i<=a.length;i++) {
    const next=[i]
    for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,v[j]+1,v[j-1]+(a[i-1]===b[j-1]?0:1))
    v=next
  }
  return v[b.length]
}
function tokenScore(a:string,b:string) {
  const one=normalized(a).split(' ').filter(Boolean), two=normalized(b).split(' ').filter(Boolean)
  if (!one.length||!two.length) return 0
  const used=new Set<number>(); let matches=0
  for(const w of one) {
    const idx=two.findIndex((v,i)=>!used.has(i)&&(v===w||(w.length>=5&&v.length>=5&&editDistance(w,v)<=1)))
    if(idx>=0){used.add(idx);matches++}
  }
  return 2*matches/(one.length+two.length)
}

/** Returns null on weak or ambiguous matches. Never guess medical intentions. */
export function matchCommand(utterance:string): Intent | null {
  const n=normalized(utterance)
  if (!n || n.length<3) return null
  const scores=COMMANDS.map(c=>({intent:c.intent,score:Math.max(...c.phrases.map(p=>{
    const q=normalized(p)
    return n===q?1:tokenScore(n,q)
  }))})).sort((a,b)=>b.score-a.score)
  if (scores[0].score<0.78) return null
  if (scores[0].score<1 && scores[0].score-scores[1].score<0.12) return null
  return scores[0].intent
}

export function parseWake(text:string):{woke:boolean;remainder:string} {
  const t=text.trim()
  const match=t.match(/(?:^|\b)(?:hey|hello|okay)\s+med\s*nav\b[,.!\s]*/i)
  if(!match) return {woke:false,remainder:''}
  return {woke:true,remainder:t.slice((match.index??0)+match[0].length).trim()}
}
