import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bell, BookOpen, Brain, CalendarDays, CheckCircle2, ChevronDown,
  CircleHelp, ClipboardList, Database, Download, Eye, FileText, FlaskConical,
  Heart, Info, Layers, LayoutDashboard, Menu, Microscope, Moon, Package,
  Pause, Play, RotateCcw, ScanLine, Search, Settings, ShieldCheck, Sparkles,
  Stethoscope, Thermometer, UserRound, Users, Wifi, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { mountAnatomy } from './anatomyScene.js';
import { CREW, INVENTORY, FREQUENT_PARTS, formatPartKey, partInfo } from './data.js';

const NAV = [
  ['Dashboard', LayoutDashboard], ['Crew', Users], ['Investigation', Microscope],
  ['Trends', Activity], ['Inventory', Package], ['Reports', FileText],
  ['NASA Research', BookOpen], ['Settings', Settings],
];
const MODES = [
  { id: 'xray', name: 'X-RAY' }, { id: 'organs', name: 'ORGANS' },
  { id: 'skeleton', name: 'BONES' }, { id: 'surface', name: 'SKIN' },
];
const waveformPoints = (base = 0, pulse = false) => {
  const n = 68;
  return Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * 180;
    let y = 20 + Math.sin(i * 0.35 + base) * 2.5 + Math.sin(i * 0.09) * 1.5;
    if (pulse) {
      const phase = (i + base) % 22;
      y += phase === 11 ? -16 : phase === 10 || phase === 12 ? 8 : 0;
    }
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};
function MiniWave({ color = 'cyan', pulse = false, seed = 0 }) {
  return <svg aria-hidden="true" className={`miniwave wave-${color}`} viewBox="0 0 180 42" preserveAspectRatio="none">
    <line x1="0" y1="20" x2="180" y2="20" stroke="currentColor" opacity=".10" />
    <polyline fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" points={waveformPoints(seed, pulse)} />
  </svg>;
}
function SleepBars() {
  const heights = [30, 45, 25, 57, 41, 34, 53, 70, 42, 62, 39, 51];
  return <div className="sleep-bars" aria-label="Illustrative sleep trend">{heights.map((h, i) => <i key={i} style={{ height: `${h}%`, opacity: .55 + (i % 3) * .18 }} />)}</div>;
}
function AstronautBadge() {
  return <div className="astronaut-badge"><svg viewBox="0 0 100 100" aria-hidden="true"><defs>
    <linearGradient id="helmet-g" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#4fdfff"/><stop offset="1" stopColor="#4057a3"/></linearGradient>
  </defs><path d="M25 47Q20 17 50 14Q80 17 75 47L83 81Q50 92 17 81Z" fill="#d5e9fa" opacity=".95"/>
  <path d="M31 46Q25 24 50 24Q75 24 69 46Q65 65 50 66Q35 65 31 46" fill="#06182d" stroke="url(#helmet-g)" strokeWidth="4"/>
  <path d="M35 32Q47 23 59 30" stroke="#6deeff" strokeWidth="4" fill="none" opacity=".6" />
  <path d="M24 74Q50 60 76 74L80 84Q50 94 20 84Z" fill="#6b8db3"/>
  <circle cx="26" cy="74" r="5" fill="#e65b93"/><circle cx="74" cy="74" r="5" fill="#40efff"/></svg></div>;
}
function GlassCard({ className = '', title, icon: Icon, right, children }) {
  return <section className={`glass-card ${className}`}>
    {title && <header className="card-header"><div className="card-title"><Icon size={20} strokeWidth={1.9}/><span>{title}</span></div>{right}</header>}
    {children}
  </section>;
}
function TinyDot({ tone = 'cyan' }) { return <span className={`tiny-dot ${tone}`} aria-hidden="true" />; }
function Pill({ tone = 'green', children }) { return <span className={`pill pill-${tone}`}>{children}</span>; }

function BodyViewer({ selectedPart, setSelectedPart, layerMode, setLayerMode, autoRotate, setAutoRotate, sex, setSex, modelStatus, setModelStatus }) {
  const canvasRef = useRef(null), stageRef = useRef(null);
  const [hoverName, setHoverName] = useState('');
  useEffect(() => {
    if (!canvasRef.current) return;
    const stage = mountAnatomy(canvasRef.current, {
      onSelect: setSelectedPart,
      onStatus: setModelStatus,
      onHover: setHoverName,
      initialSex: sex,
    });
    stageRef.current = stage;
    stage.setMode(layerMode); stage.setAutoRotate(autoRotate); stage.setActive(selectedPart);
    return () => { stage.dispose(); stageRef.current = null; };
    // mount once; later props are forwarded by effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { stageRef.current?.setMode(layerMode); }, [layerMode]);
  useEffect(() => { stageRef.current?.setActive(selectedPart); }, [selectedPart]);
  useEffect(() => { stageRef.current?.setAutoRotate(autoRotate); }, [autoRotate]);
  // mountAnatomy already starts the male model. Only change on subsequent sex updates.
  const firstSexRef = useRef(true);
  useEffect(() => {
    if (firstSexRef.current) { firstSexRef.current = false; return; }
    stageRef.current?.setSex(sex);
  }, [sex]);

  return <section className="body-stage" aria-label="Interactive 3D anatomy explorer">
    <div className="stage-stars" aria-hidden="true"/>
    <div className="stage-halo" aria-hidden="true" />
    <div className="stage-head">
      <div><div className="overline">MEDNAV / ANATOMY EXPLORER</div><h2>Interactive Human Model <span className="beta">3D</span></h2></div>
      <div className="live-demo"><TinyDot tone={modelStatus === 'detailed' ? 'green' : 'yellow'}/>
        {modelStatus === 'detailed' ? 'DETAILED ANATOMY' : modelStatus === 'loading' ? 'LOADING MODEL' : 'SCHEMATIC MODEL'}
      </div>
    </div>
    <div className="mode-controls" role="group" aria-label="Anatomy layers">
      {MODES.map((m) => <button key={m.id} className={`mode-btn ${layerMode === m.id ? 'active' : ''}`} onClick={() => setLayerMode(m.id)}>{m.name}</button>)}
    </div>
    <div className="body-canvas" ref={canvasRef}/>
    <div className="side-axis" aria-hidden="true"><span>H</span><div/><span>F</span></div>
    <div className="floating-label floating-label-top"><span className="crosshair">+</span> NEURAL / MUSCULOSKELETAL</div>
    <div className="floating-label floating-label-mid"><span className="crosshair">+</span> LIVE TELEMETRY: DEMO</div>
    {hoverName && <div className="hover-part"><ScanLine size={14}/>{hoverName}</div>}
    <div className="viewer-tools" aria-label="3D controls">
      <button title="Zoom in" aria-label="Zoom in" onClick={() => stageRef.current?.zoom(0.84)}><ZoomIn size={18}/></button>
      <button title="Zoom out" aria-label="Zoom out" onClick={() => stageRef.current?.zoom(1.18)}><ZoomOut size={18}/></button>
      <button title="Reset camera" aria-label="Reset camera" onClick={() => stageRef.current?.reset()}><RotateCcw size={18}/></button>
      <button title={autoRotate ? 'Pause rotation' : 'Auto rotate'} aria-label={autoRotate ? 'Pause rotation' : 'Auto rotate'} className={autoRotate ? 'tool-active' : ''} onClick={() => setAutoRotate(!autoRotate)}>{autoRotate ? <Pause size={18}/> : <Play size={18}/>}</button>
    </div>
    <div className="model-person"><span>MODEL</span><div className="sex-select"><button className={sex === 'male' ? 'sex-on' : ''} onClick={() => setSex('male')}>M</button><button className={sex === 'female' ? 'sex-on' : ''} onClick={() => setSex('female')}>F</button></div></div>
    <div className="stage-bottom">
      <div className="viewer-guide"><RotateCcw size={15}/> DRAG TO ROTATE <span className="guide-divide">·</span> SCROLL TO ZOOM <span className="guide-divide">·</span> CLICK A BODY PART</div>
      <div className="quick-parts">{FREQUENT_PARTS.slice(0, 6).map((key) => <button key={key} className={selectedPart === key ? 'quick-active' : ''} onClick={() => { setSelectedPart(key); if (layerMode === 'surface') setLayerMode('organs'); }}>{formatPartKey(key)}</button>)}</div>
      <div className="model-credit">Model: <a href="https://github.com/MervinR07/open-anatomy-3d" target="_blank" rel="noreferrer">open-anatomy-3d</a> (CC BY 4.0) · DBCLS / HuBMAP / MakeHuman · <a href="https://github.com/MervinR07/open-anatomy-3d/blob/main/ATTRIBUTION.md" target="_blank" rel="noreferrer">credits</a></div>
    </div>
  </section>;
}

function Dashboard({ crew, selectedPart, setSelectedPart, layerMode, setLayerMode, autoRotate, setAutoRotate, sex, setSex, modelStatus, setModelStatus }) {
  const part = useMemo(() => partInfo(selectedPart, crew), [crew, selectedPart]);
  const coverage = crew.coverage;
  const unknownCoverage = Math.min(12, 100 - coverage);
  const unavailableCoverage = 100 - coverage - unknownCoverage;
  return <div className="dashboard-grid">
    <div className="left-stack">
      <div className="crew-picker"><div className="crew-picker-label"><UserRound size={22}/> Astronaut</div><div className="crew-tabs">{CREW.map((c) => <CrewTab key={c.id} crew={c}/>)}</div></div>
      <GlassCard className="crew-card">
        <div className="profile-pic"><AstronautBadge/></div>
        <div className="profile-details"><h2>{crew.id}</h2><div>Mission: <span>{crew.mission}</span></div><div>Role: <span>{crew.role}</span></div></div>
        <Pill tone="green"><TinyDot tone="green"/> {crew.status}</Pill>
      </GlassCard>
      <GlassCard title="Vital Signs" icon={Activity} className="vitals-card" right={<span className="realtime"><TinyDot tone="green"/> Demo stream</span>}>
        <div className="vital-list">
          <div className="vital-row"><Heart className="vital-icon pink-text" size={28}/><div className="vital-copy"><small>Heart Rate</small><strong>{crew.heartRate}<sub> bpm</sub></strong></div><MiniWave color="pink" pulse seed={4}/></div>
          <div className="vital-row"><Moon className="vital-icon bright-text" size={28}/><div className="vital-copy"><small>Sleep</small><strong>{crew.sleep}<sub> h</sub></strong></div><SleepBars/></div>
          <div className="vital-row"><Stethoscope className="vital-icon bright-text" size={28}/><div className="vital-copy"><small>Blood Pressure</small><strong className="bp-number">{crew.bp}<sub> mmHg</sub></strong></div><MiniWave color="cyan" seed={7}/></div>
          <div className="vital-row"><Activity className="vital-icon cyan-text" size={27}/><div className="vital-copy"><small>Blood Oxygen</small><strong>{crew.spo2}<sub> % SpO₂</sub></strong></div><MiniWave color="cyan" seed={12}/></div>
        </div>
      </GlassCard>
      <GlassCard title="Symptoms" icon={ClipboardList} className="symptoms-card">
        <div className="symptom-row"><TinyDot tone="pink"/><span>{crew.symptom}</span><Pill tone="pink">{crew.symptom === 'None reported' ? 'Clear' : 'Reported'}</Pill></div>
        <div className="symptom-row"><TinyDot tone="muted"/><span>Motion sickness</span><Pill tone="blue">Not reported</Pill></div>
        <div className="symptom-row"><TinyDot tone="muted"/><span>Nausea</span><Pill tone="blue">Not reported</Pill></div>
      </GlassCard>
      <div className="left-foot"><ShieldCheck size={16}/> SYNTHETIC SAMPLE DATA <span>•</span> NOT FOR DIAGNOSIS</div>
    </div>

    <BodyViewer selectedPart={selectedPart} setSelectedPart={setSelectedPart} layerMode={layerMode} setLayerMode={setLayerMode}
      autoRotate={autoRotate} setAutoRotate={setAutoRotate} sex={sex} setSex={setSex}
      modelStatus={modelStatus} setModelStatus={setModelStatus}/>

    <div className="right-stack">
      <GlassCard title="Investigation Result" icon={FlaskConical} className="investigation-card" right={<span className="right-muted">{crew.id} — Demo</span>}>
        <div className="investigation-content">
          <div className="scan-preview"><div className="scan-art"><Brain size={66} strokeWidth={1.1}/><span>DEMO SCAN</span></div></div>
          <div className="investigation-list">
            <div className="investigation-status"><span>Status</span><Pill tone="green"><CheckCircle2 size={14}/> Sample only</Pill></div>
            <div className="investigation-line"><ClipboardList size={15}/><span>Observations</span><strong>Synthetic entries</strong></div>
            <div className="investigation-line"><ShieldCheck size={15}/><span>Safety flags</span><strong>Not evaluated</strong></div>
            <div className="investigation-line"><CalendarDays size={15}/><span>Next check</span><strong>Not scheduled</strong></div>
            <div className="investigation-line"><UserRound size={15}/><span>Medical review</span><Pill tone="yellow">Required</Pill></div>
          </div>
        </div>
      </GlassCard>
      <GlassCard title="Inventory Status" icon={Package} className="inventory-card">
        {INVENTORY.map((item, i) => <div key={item.name} className="inventory-row"><span className="inventory-symbol">{i === 0 ? '▣' : i === 1 ? '✛' : '◉'}</span><span className="inventory-name">{item.name}</span><span className={`inventory-status ${item.tone}`}><TinyDot tone={item.tone}/> {item.status}</span><span className="inventory-count">({item.quantity})</span></div>)}
      </GlassCard>
      <GlassCard title="Data Coverage" icon={Database} className="coverage-card">
        <div className="coverage-content"><div className="coverage-circle" style={{ '--pct': `${coverage}%`, '--unknown': `${coverage + unknownCoverage}%` }}><div><strong>{coverage}%</strong><small>ONLINE</small></div></div>
          <div className="coverage-key"><div><span><TinyDot tone="green"/> Available</span><strong>{coverage}%</strong></div><div><span><TinyDot tone="yellow"/> Unknown</span><strong>{unknownCoverage}%</strong></div><div><span><TinyDot tone="muted"/> Not available</span><strong>{unavailableCoverage}%</strong></div></div></div>
      </GlassCard>
      <GlassCard title="Selected Anatomy" icon={ScanLine} className="selected-card" right={<span className="selected-indicator">CLICK TO INSPECT</span>}>
        <div className="selected-top"><div className="selected-organ-icon"><Heart size={24}/></div><div><small>{part.system}</small><h3>{part.label}</h3></div><Pill tone="cyan">SELECTED</Pill></div>
        <p>{part.description}</p>
        <div className="selected-metric"><span>{part.metric}</span><strong>{part.value}</strong></div>
        {part.note && <div className="part-note"><Info size={13}/>{part.note}</div>}
      </GlassCard>
    </div>
  </div>;
}

// Crew tabs use the selected astronaut id through context-free DOM callbacks
// (the actual crew-switch function is provided via the top-level event context below).
const CrewSelectionContext = React.createContext(() => {});
function CrewTab({ crew }) {
  const changeCrew = React.useContext(CrewSelectionContext);
  return <button className={`crew-tab ${changeCrew.selected === crew.id ? 'active' : ''}`} onClick={() => changeCrew.set(crew.id)}>{crew.id}</button>;
}

function Workspace({ section, crew, onSelectCrew, selectedCrew, layerMode, setLayerMode, autoRotate, setAutoRotate, downloadReport, onGoDashboard }) {
  const label = section === 'NASA Research' ? 'Research Integration' : section;
  return <div className="workspace">
    <div className="workspace-head"><div className="overline">MEDNAV / CONTROL CENTER</div><h1>{label}</h1><p>Frontend demonstration — all health readings are synthetic.</p></div>
    {section === 'Crew' && <div className="workspace-cards crew-roster">{CREW.map((p) => <button className={`roster-card ${p.id === selectedCrew ? 'chosen' : ''}`} key={p.id} onClick={() => { onSelectCrew(p.id); onGoDashboard(); }}><AstronautBadge/><div><h3>{p.id} · {p.name}</h3><p>{p.role} / {p.mission}</p><Pill tone="green">Active</Pill></div><span className="roster-arrow">View dashboard →</span></button>)}</div>}
    {section === 'Investigation' && <div className="workspace-cards"><GlassCard title="Assessment overview" icon={FlaskConical}><p className="workspace-text">This prototype visualizes selected anatomy and mock screening records. It does not interpret medical scans or provide diagnosis.</p><button className="primary-action" onClick={onGoDashboard}><ScanLine size={16}/> Open 3D body explorer</button></GlassCard><GlassCard title="Review checklist" icon={ClipboardList}><div className="setting-line">Subject: <strong>{crew.id}</strong></div><div className="setting-line">Sensor feed: <strong>Not connected</strong></div><div className="setting-line">Medical officer approval: <strong>Required</strong></div></GlassCard></div>}
    {section === 'Trends' && <div className="workspace-cards"><GlassCard title="Heart rate • illustrative" icon={Heart}><div className="big-trend">{crew.heartRate}<span> bpm</span></div><MiniWave color="pink" pulse seed={2}/><p className="workspace-text">This line is generated locally to demonstrate chart styling. No historic sensor data is loaded.</p></GlassCard><GlassCard title="Sleep • illustrative" icon={Moon}><div className="big-trend">{crew.sleep}<span> hours</span></div><SleepBars/><p className="workspace-text">Connect your historical database to show actual trends.</p></GlassCard></div>}
    {section === 'Inventory' && <div className="workspace-cards"><GlassCard title="Onboard supplies" icon={Package}>{INVENTORY.map((i) => <div className="setting-line" key={i.name}><span>{i.name}</span><strong>{i.quantity} · {i.status}</strong></div>)}</GlassCard></div>}
    {section === 'Reports' && <div className="workspace-cards"><GlassCard title="Export demonstration record" icon={FileText}><p className="workspace-text">Export the currently selected astronaut’s synthetic dashboard record as JSON for integration testing.</p><button className="primary-action" onClick={downloadReport}><Download size={16}/> Download demo JSON</button></GlassCard></div>}
    {section === 'NASA Research' && <div className="workspace-cards"><GlassCard title="Research mode" icon={BookOpen}><p className="workspace-text">Prototype workspace for linking publicly available space-health literature and training datasets. No NASA databases or NASA clinical systems are connected. MEDNAV is an independent demonstration and is not NASA-endorsed.</p><button className="primary-action" onClick={onGoDashboard}><Eye size={16}/> Explore body visualization</button></GlassCard></div>}
    {section === 'Settings' && <div className="workspace-cards"><GlassCard title="3D visualization preferences" icon={Layers}><p className="workspace-text">These preferences are applied to the body explorer.</p><div className="setting-line"><span>Default anatomy view</span><select value={layerMode} onChange={(e) => setLayerMode(e.target.value)}>{MODES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div className="setting-line"><span>Automatic rotation</span><button className={`toggle ${autoRotate ? 'on' : ''}`} onClick={() => setAutoRotate(!autoRotate)} aria-label="Toggle automatic rotation"><span/></button></div><button className="primary-action" onClick={onGoDashboard}><Eye size={16}/> View updated model</button></GlassCard></div>}
  </div>;
}

function downloadJSON(crew) {
  const sample = { project: 'MEDNAV', status: 'HACKATHON_DEMO_ONLY', exportedAt: new Date().toISOString(), subject: crew, inventory: INVENTORY, note: 'All fields are synthetic test values, not clinical data.' };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `mednav-demo-${crew.id.toLowerCase()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [section, setSection] = useState('Dashboard');
  const [selectedCrew, setSelectedCrew] = useState('A01');
  const [selectedPart, setSelectedPart] = useState('brain');
  const [layerMode, setLayerMode] = useState('xray');
  const [autoRotate, setAutoRotate] = useState(false);
  const [sex, setSex] = useState('male');
  const [modelStatus, setModelStatus] = useState('loading');
  const [mobileMenu, setMobileMenu] = useState(false);
  const crew = CREW.find((c) => c.id === selectedCrew) || CREW[0];
  const crewContextValue = useMemo(() => ({ selected: selectedCrew, set: setSelectedCrew }), [selectedCrew]);
  const switchSection = (s) => { setSection(s); setMobileMenu(false); };

  return <CrewSelectionContext.Provider value={crewContextValue}>
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="side-identity"><div className="logo-orbit" aria-hidden="true"><span/><i/></div><div className="side-brand">MEDNAV<sup>™</sup></div><div className="side-tagline">ASTRONAUT HEALTH<br/>MONITORING SYSTEM</div></div>
        <nav className="sidebar-nav" aria-label="Primary navigation">{NAV.map(([title, Icon]) => <button key={title} className={`nav-item ${section === title ? 'nav-current' : ''}`} onClick={() => switchSection(title)}><Icon size={23} strokeWidth={1.8}/><span>{title}</span></button>)}</nav>
        <div className="side-bottom"><div className="planet-curve"/><div className="program-logo"><div className="nasa-ish">M</div><div><strong>MEDNAV</strong><small>Space Health Program<br/>Independent demo</small></div></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open navigation">{mobileMenu ? <X size={24}/> : <Menu size={24}/>}</button>
          <div className="brand-divider"/><div className="main-brand">MEDNAV</div><div className="header-separator"/><div className="header-subtitle">Astronaut Health Monitoring</div>
          <div className="topbar-right"><div className="prototype-label"><Info size={17}/> Hackathon prototype — not clinically validated</div><button className="header-icon-btn" title="No notifications connected" aria-label="Notifications"><Bell size={19}/><span className="notify-dot"/></button><div className="user-icon"><UserRound size={27}/></div></div>
        </header>
        {section === 'Dashboard' ? <Dashboard crew={crew} selectedPart={selectedPart} setSelectedPart={setSelectedPart}
          layerMode={layerMode} setLayerMode={setLayerMode} autoRotate={autoRotate} setAutoRotate={setAutoRotate}
          sex={sex} setSex={setSex} modelStatus={modelStatus} setModelStatus={setModelStatus}/>
          : <Workspace section={section} crew={crew} selectedCrew={selectedCrew} onSelectCrew={setSelectedCrew} layerMode={layerMode} setLayerMode={setLayerMode} autoRotate={autoRotate} setAutoRotate={setAutoRotate} downloadReport={() => downloadJSON(crew)} onGoDashboard={() => switchSection('Dashboard')} />}
      </main>
    </div>
  </CrewSelectionContext.Provider>;
}
