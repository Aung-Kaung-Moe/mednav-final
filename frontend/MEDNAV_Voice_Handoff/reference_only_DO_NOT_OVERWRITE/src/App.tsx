import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, BarChart3, Box, Brain, ChevronRight, ClipboardList, FileText,
  HeartPulse, Info, Layers3, Menu, Microscope, Moon, Package, RotateCcw, Search,
  Settings2, Stethoscope, UsersRound, Wifi, WifiOff, X,
} from 'lucide-react'
import AnatomyScene, { REGIONS, type BodyRegion } from './AnatomyScene'
import InvestigationConsole from './InvestigationConsole'
import VoiceAssistant from './voice/VoiceAssistant'
import HealthTrends from './HealthTrends'
import { demoAstronauts, demoHealthFor, demoInventory, defaultMeasurementsFor } from './demo'
import type { Equipment } from './types'
import './mednav-anatomy.css'

const menu = [
  { key:'dashboard', label:'Dashboard', Icon:Layers3 },
  { key:'crew', label:'Crew', Icon:UsersRound },
  { key:'investigation', label:'Investigation', Icon:Stethoscope },
  { key:'trends', label:'Trends', Icon:BarChart3 },
  { key:'inventory', label:'Inventory', Icon:Box },
  { key:'reports', label:'Reports', Icon:FileText },
  { key:'research', label:'NASA Research', Icon:Microscope },
  { key:'settings', label:'Settings', Icon:Settings2 },
] as const
type View = (typeof menu)[number]['key']
const displayReadings:Record<string,{symptoms:string[];role:string;mission:string}>={
  A01:{symptoms:['Headache','Dizziness'],role:'Commander',mission:'SYNTHETIC MISSION'},
  A02:{symptoms:[],role:'Mission Specialist',mission:'SYNTHETIC MISSION'},
  A03:{symptoms:['Fatigue'],role:'Flight Engineer',mission:'SYNTHETIC MISSION'},
  A04:{symptoms:[],role:'Science Officer',mission:'SYNTHETIC MISSION'},
}
const readable = (n:number|null,unit:string) => n===null?'Unknown':`${n} ${unit}`
const inventoryStatus=(item:Equipment)=>item.quantity<=0?'Out of stock':item.usable?'Available':'Unusable'
const bodyInfo:Record<BodyRegion,{heading:string;detail:string;metric:string;value:string;note:string}>={
  brain:{heading:'NEUROLOGICAL',detail:'Reports and symptoms related to the head and nervous system.',metric:'Head-related symptom',value:'See check-in',note:'Not an imaging diagnosis'},
  heart:{heading:'CARDIOVASCULAR',detail:'Resting heart-rate history and personal baseline.',metric:'Resting heart rate',value:'Heart-rate reading',note:'No automated diagnosis'},
  lungs:{heading:'RESPIRATORY',detail:'Respiratory observations; no automated lung scans.',metric:'Respiratory sensor',value:'Not connected',note:'Manual observations only'},
  skeleton:{heading:'SKELETAL',detail:'Bone and mobility research context. No bone-density scanner.',metric:'Bone density',value:'Not available',note:'No inferred disease risk'},
  muscles:{heading:'MUSCULOSKELETAL',detail:'Mobility, fatigue and crew-recorded discomfort.',metric:'Muscle status',value:'Not measured',note:'Not an anatomical assessment'},
  arms:{heading:'UPPER LIMBS',detail:'Upper-limb comfort, strength and activity records.',metric:'Strength test',value:'Not measured',note:'Review crew assessments'},
  legs:{heading:'LOWER LIMBS',detail:'Lower-limb motion and astronaut exercise observations.',metric:'Mobility check',value:'Not measured',note:'Review crew assessments'},
  abdomen:{heading:'GENERAL HEALTH',detail:'General symptoms and manually recorded medical data.',metric:'Blood pressure',value:'See check-in',note:'Unknown is not normal'},
}
const nasaTimepoints=['L-92','L-44','L-3','R+1','R+45','R+82','R+194'] as const

function Brand(){return <div className="med-logo"><span className="med-orbit-symbol"><span/></span><div><strong>MEDNAV</strong><small>ASTRONAUT HEALTH MONITORING</small></div></div>}
function SectionTitle({title,eyebrow}:{title:string;eyebrow:string}){return <div className="med-section-title"><span>{eyebrow}</span><h2>{title}</h2></div>}
function ResearchPanel(){const [who,setWho]=useState('C001');const [time,setTime]=useState('L-92');return <div className="med-full-panel med-research"><SectionTitle eyebrow="SEPARATE DATASET · READ ONLY" title="NASA OSD-575 Research"/><p>NASA research participants are not the fictional MEDNAV crew. Study measurements are not loaded in this prototype; no values, units, or sample IDs are fabricated.</p><a className="med-link" target="_blank" rel="noreferrer" href="https://osdr.nasa.gov/bio/repo/data/studies/OSD-575">Open official NASA OSDR study <ArrowRight size={15}/></a><div className="med-panel-grid"><section className="med-glass"><div className="med-card-kicker">RESEARCH PARTICIPANTS</div><div className="med-crew-buttons">{['C001','C002','C003','C004'].map(id=><button key={id} className={who===id?'chosen':''} onClick={()=>setWho(id)}>{id}</button>)}</div><div className="med-data-row"><span>Participant</span><b>{who}</b></div><div className="med-data-row"><span>Measurement</span><b>Not loaded</b></div><div className="med-data-row"><span>Value · Unit</span><b>Not available</b></div><div className="med-data-row"><span>Sample ID</span><b>Not available</b></div><div className="med-data-row"><span>Missing status</span><b>Not available</b></div></section><section className="med-glass"><div className="med-card-kicker">PRE- / POST-FLIGHT RESEARCH TIMELINE</div><div className="med-timepoints">{nasaTimepoints.map((t,i)=><button key={t} onClick={()=>setTime(t)} className={`${time===t?'chosen':''} ${i>2?'post':''}`}>{t}</button>)}</div><p>Selected timepoint: <b>{time}</b></p><p className="med-fine">Study-level timeline reference only. Verify availability and individual sample metadata before displaying actual measurements.</p></section></div></div>}

function Sparkline({vals,color='#32e7ff'}:{vals:(number|null)[],color?:string}){
 const segments:string[]=[];let run:string[]=[]
 vals.forEach((n,i)=>{if(n===null){if(run.length>1)segments.push(run.join(' '));run=[]}else run.push(`${i*27},${38-(n-55)*.43}`)})
 if(run.length>1)segments.push(run.join(' '))
 return <svg className="med-sparkline" viewBox="0 0 110 45" aria-label="Synthetic history; interruptions indicate missing measurements"><path d="M0 35 H110" stroke="#305477" strokeWidth=".7" fill="none"/>{segments.map((s,i)=><polyline key={i} points={s} stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}{vals.map((n,i)=>n===null?<circle key={i} cx={i*27} cy="35" r="2.5" fill="#697a9c"/>:null)}</svg>
}

export default function App(){
 const [view,setView]=useState<View>('dashboard')
 const [crew,setCrew]=useState('A01')
 const [region,setRegion]=useState<BodyRegion>('heart')
 const [resetKey,setResetKey]=useState(0)
 const [shell,setShell]=useState(true)
 const [earth,setEarth]=useState<'online'|'offline'>('offline')
 const [mobileNav,setMobileNav]=useState(false)
 const profile=demoAstronauts.find(p=>p.astronaut_id===crew)??demoAstronauts[0]
 const history=useMemo(()=>demoHealthFor(crew),[crew])
 const measurements=defaultMeasurementsFor(crew)
 const status=displayReadings[crew]
 const selectedInfo=bodyInfo[region]
 const [crewQuery,setCrewQuery]=useState('')
 const usable=demoInventory.filter(x=>x.usable&&x.quantity>0).length
 const missing=['resting_hr_bpm','sleep_hours','systolic_bp_mm_hg','diastolic_bp_mm_hg'].filter(k=>measurements[k as keyof typeof measurements]===null).length
 const go=(k:View)=>{setView(k);setMobileNav(false);window.scrollTo({top:0,behavior:'smooth'})}
 useEffect(()=>{if(view==='reports'){const handle=requestAnimationFrame(()=>document.getElementById('saved-reports')?.scrollIntoView({behavior:'smooth',block:'start'}));return ()=>cancelAnimationFrame(handle)}},[view])
 return <div className="med-app">
  <aside className={`med-sidebar ${mobileNav?'med-open':''}`}>
   <div className="med-sidebar-head"><Brand/><button className="med-close-mobile" onClick={()=>setMobileNav(false)} aria-label="Close navigation"><X/></button></div>
   <div className="med-side-cap">MISSION CONTROL <span>01 / 08</span></div>
   <nav className="med-side-nav" aria-label="MEDNAV sections">{menu.map(({key,label,Icon})=><button type="button" key={key} aria-current={view===key?'page':undefined} className={view===key?'active':''} onClick={()=>go(key)}><Icon size={19}/><span>{label}</span>{view===key&&<ChevronRight size={15} className="med-chevron"/>}</button>)}</nav>
   <div className="med-sidebar-foot"><div className="med-earthline"><div className="med-dot"/> EXPEDITION · DEMO</div><p>RESOURCE-AWARE<br/>HEALTH NAVIGATION</p><span>v1.0 · SYNTHETIC DATA</span></div>
  </aside>
  <main className="med-content">
   <header className="med-top"><button className="med-menu-mobile" onClick={()=>setMobileNav(v=>!v)} aria-label="Toggle navigation"><Menu/></button><div className="med-top-name"><b>MEDNAV</b><span> / </span> Astronaut Health Monitoring</div><div className="med-top-right"><div className="med-nav-notice"><Info size={14}/> Hackathon prototype — not clinically validated.</div><button title="Communication status (demo)" className="med-communication" onClick={()=>setEarth(v=>v==='offline'?'online':'offline')}>{earth==='offline'?<WifiOff size={15}/>:<Wifi size={15}/>} Earth {earth}</button><button className="med-user" title="Synthetic crew"><UsersRound size={17}/></button></div></header>
   {view==='dashboard'&& <>
    <div className="med-hero-heading"><div><span className="med-eyebrow">MISSION HEALTH SYSTEM / SYNTHETIC DEMO DATA</span><h1>Human <em>systems.</em></h1><p>Explore astronaut health records through an interactive 3D body. Select any body region to review related evidence.</p></div><div className="med-heading-side"><span className="med-mode-pill"><span/> LOCAL DEMONSTRATION</span><small>ROTATE · ZOOM · SELECT</small></div></div>
    <section className="med-dashboard" aria-label="Health dashboard">
     <div className="med-left-column">
      <div className="med-glass med-crew-card"><div className="med-card-kicker"><UsersRound size={15}/> SELECT ASTRONAUT <span>SYNTHETIC</span></div><div className="med-crew-buttons">{demoAstronauts.map(p=><button key={p.astronaut_id} onClick={()=>setCrew(p.astronaut_id)} aria-pressed={crew===p.astronaut_id} className={crew===p.astronaut_id?'chosen':''}>{p.astronaut_id}</button>)}</div><div className="med-profile"><div className="med-avatar"><UsersRound size={26}/></div><div><strong>{profile.display_name}</strong><p>{status.role} / {status.mission}</p></div><span className="med-sim-label">DEMO</span></div></div>
      <div className="med-glass med-vitals-card"><div className="med-card-kicker"><Activity size={15}/> RECORDED VITALS <span>NOT LIVE</span></div><div className="med-vital-item"><HeartPulse size={18} className="pink"/><div><span>Resting heart rate</span><strong>{readable(measurements.resting_hr_bpm,'bpm')}</strong></div><Sparkline vals={history.series.map(s=>s.resting_hr_bpm)}/></div><div className="med-vital-item"><Moon size={18}/><div><span>Sleep duration</span><strong>{readable(measurements.sleep_hours,'hours')}</strong></div><span className="med-baseline">Baseline {readable(history.baseline.sleep_hours,'h')}</span></div><div className="med-vital-item"><Activity size={18}/><div><span>Blood pressure</span><strong>{measurements.systolic_bp_mm_hg===null?'Unknown':`${measurements.systolic_bp_mm_hg}/${measurements.diastolic_bp_mm_hg??'?'}`} <small>mmHg</small></strong></div><span className="med-unknown">Not measured</span></div></div>
      <div className="med-glass med-symptom-card"><div className="med-card-kicker"><ClipboardList size={15}/> CREW-REPORTED SYMPTOMS</div>{status.symptoms.length?status.symptoms.map(s=><div className="med-symptom-line" key={s}><span className="med-pink-dot"/>{s}<small>Reported</small></div>):<div className="med-empty-text">No symptoms recorded in this demo profile.</div>}<button className="med-text-button" onClick={()=>go('investigation')}>Open health check-in <ArrowRight size={14}/></button></div>
     </div>
     <div className="med-body-stage"><div className="med-stage-top"><span>HOLOGRAPHIC ANATOMY EXPLORER</span><span className="med-live-ring"/> <small>INTERACTIVE 3D</small></div><div className="med-body-halo"/><AnatomyScene selected={region} onSelect={setRegion} resetKey={resetKey} showShell={shell}/><div className="med-hotspot-prompt">DRAG TO ROTATE <span>·</span> SCROLL / PINCH TO ZOOM <span>·</span> TAP A BODY PART</div><div className="med-body-controls"><button title="Reset camera" onClick={()=>setResetKey(n=>n+1)}><RotateCcw size={16}/> Reset view</button><button title="Toggle translucent body shell" onClick={()=>setShell(v=>!v)}><Layers3 size={15}/> {shell?'Hide':'Show'} shell</button></div><div className="med-selected-marker"><span>SELECTED SYSTEM</span><strong>{selectedInfo.heading}</strong><p>{selectedInfo.detail}</p></div></div>
     <div className="med-right-column"><div className="med-glass med-system-card"><div className="med-card-kicker"><Brain size={15}/> BODY SYSTEMS <span>SELECT</span></div><div className="med-system-list">{REGIONS.map(x=><button key={x.id} className={region===x.id?'active':''} onClick={()=>setRegion(x.id)}><span className="med-system-dot" style={{background:x.color}}/><span>{x.label}</span><ChevronRight size={13}/></button>)}</div></div>
      <div className="med-glass med-findings-card"><div className="med-card-kicker"><Stethoscope size={15}/> REGION RECORDS <span>PROTOTYPE</span></div><h3>{selectedInfo.heading}</h3><p>{selectedInfo.detail}</p><div className="med-data-row"><span>{selectedInfo.metric}</span><strong>{region==='heart'?readable(measurements.resting_hr_bpm,'bpm'):selectedInfo.value}</strong></div><div className="med-data-row"><span>Missing data</span><strong>{missing} measurement{missing===1?'':'s'}</strong></div><div className="med-fine">{selectedInfo.note}. Region highlighting only navigates to available records; it does not scan or diagnose organs.</div><button className="med-action" onClick={()=>go('investigation')}>OPEN INVESTIGATION <ArrowRight size={16}/></button></div>
      <div className="med-glass med-inventory-mini"><div className="med-card-kicker"><Package size={15}/> EQUIPMENT STATUS</div><div className="med-coverage-row"><strong>{usable}/{demoInventory.length}</strong><span>usable equipment types</span></div>{demoInventory.slice(0,3).map(item=><div className="med-mini-equipment" key={item.equipment_id}><span>{item.label}</span><small className={inventoryStatus(item)==='Available'?'avail':'no'}>{inventoryStatus(item)}</small></div>)}<button className="med-text-button" onClick={()=>go('inventory')}>View inventory <ArrowRight size={14}/></button></div>
     </div>
    </section>
    <div className="med-below-banner"><div><span>01 / MISSION READY</span><strong>One system. Every essential signal.</strong></div><button onClick={()=>go('investigation')}>START INVESTIGATION <ArrowRight size={16}/></button></div>
   </>}
   {<div hidden={view!=='investigation'&&view!=='reports'} className="med-functional-view"><div className="med-inner-heading"><SectionTitle eyebrow={view==='reports'?'LOCAL REPORT RECORDS':'ASTRONAUT HEALTH ASSESSMENT'} title={view==='reports'?'Incident reports':'Health investigation'}/><button className="med-outline-button" onClick={()=>go('dashboard')}>← Back to 3D explorer</button></div><p className="med-section-note">Synthetic demo / API Contract v1. This investigation form is functional; backend integration requires agreement on the API schema. No clinical decision is made in the browser.</p><InvestigationConsole selectedCrew={crew} onCrewSelect={setCrew}/></div>}
   {view==='trends'&&<div className="med-full-panel"><SectionTitle eyebrow="RECORDS WITH EXPLICIT MISSING VALUES" title="Health trends"/><div className="med-crew-buttons med-padded-crew">{demoAstronauts.map(p=><button key={p.astronaut_id} className={crew===p.astronaut_id?'chosen':''} onClick={()=>setCrew(p.astronaut_id)}>{p.astronaut_id}</button>)}</div><div className="med-glass med-trend-shell"><HealthTrends health={history}/></div></div>}
   {view==='crew'&&<div className="med-full-panel"><SectionTitle eyebrow="FICTIONAL CREW · SYNTHETIC DEMO" title="Crew directory"/><div className="med-input-search"><Search size={17}/><input aria-label="Search crew" placeholder="Search crew ID or name" value={crewQuery} onChange={e=>setCrewQuery(e.target.value)}/></div><div className="med-crew-directory">{demoAstronauts.filter(x=>`${x.astronaut_id} ${x.display_name}`.toLowerCase().includes(crewQuery.toLowerCase())).map(p=><button key={p.astronaut_id} onClick={()=>{setCrew(p.astronaut_id);setView('dashboard')}} className={`med-glass ${crew===p.astronaut_id?'active':''}`}><UsersRound size={25}/><strong>{p.astronaut_id}</strong><span>{p.display_name}</span><small>{displayReadings[p.astronaut_id].role}</small><span className="med-callout">OPEN 3D PROFILE →</span></button>)}</div></div>}
   {view==='inventory'&&<div className="med-full-panel"><SectionTitle eyebrow="SIMULATED STOCK · NOT REAL MEDICAL SUPPLIES" title="Medical inventory"/><div className="med-glass med-inventory-full"><div className="med-row-head"><span>EQUIPMENT</span><span>QUANTITY</span><span>STATUS</span></div>{demoInventory.map(it=><div className="med-row-head med-row" key={it.equipment_id}><span>{it.label}</span><b>{it.quantity}</b><span className={inventoryStatus(it)==='Available'?'med-stock-yes':'med-stock-no'}>{inventoryStatus(it)}</span></div>)}</div><p className="med-fine">In the actual application, inventory comes from GET /api/v1/inventory. These entries are fictional.</p></div>}
   {view==='research'&&<ResearchPanel/>}
   {view==='settings'&&<div className="med-full-panel"><SectionTitle eyebrow="DISPLAY PREFERENCES" title="System settings"/><div className="med-glass med-settings"><div><strong>Show body shell</strong><p>Display translucent anatomical silhouette around the internal structures.</p></div><button className="med-action" onClick={()=>setShell(v=>!v)}>{shell?'ON':'OFF'}</button><div><strong>Earth communication status</strong><p>Demonstration flag only. No transmission or networking occurs.</p></div><button className="med-action" onClick={()=>setEarth(v=>v==='online'?'offline':'online')}>{earth.toUpperCase()}</button><div><strong>Data source</strong><p>All astronaut profiles and vitals in this dashboard are synthetic.</p></div><span className="med-mode-pill">SYNTHETIC DEMO DATA</span></div></div>}
   <footer className="med-footer"><span>MEDNAV // PROTOTYPE · NOT CLINICALLY VALIDATED</span><span>NO LIVE SENSOR OR ANATOMICAL SCAN</span></footer>
  </main>
  <VoiceAssistant crew={crew} onNavigate={go}/>
 </div>
}
