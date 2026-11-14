import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import path from 'node:path';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.resolve('../.demo-runtime/audit-vite-cache'),server:{middlewareMode:true},logLevel:'error'});
after(()=>vite.close());
const {loadHistory}=await vite.ssrLoadModule('/src/api.ts');
const {displayProfile,recordedProfile}=await vite.ssrLoadModule('/src/types/api.ts');
const {crews}=await vite.ssrLoadModule('/src/data/fixtures.ts');
const {parseTranscriptToCheckIn}=await vite.ssrLoadModule('/src/components/VoiceCheckIn.tsx');
const {formatInvestigationView}=await vite.ssrLoadModule('/src/types/scenario.ts');
const {orderedRecords,bodyRegion,visualSymptoms}=await vite.ssrLoadModule('/src/data/bodyMonitoring.ts');
const {BodySystemMonitoring}=await vite.ssrLoadModule('/src/components/BodySystemMonitoring.tsx');
const {baselineDifference,completeness}=await vite.ssrLoadModule('/src/data/missionMonitoring.ts');
const {MissionHealthTimeline}=await vite.ssrLoadModule('/src/components/MissionHealthTimeline.tsx');
const {BODY_SYSTEMS,replayWindow,systemEvidence,reportedEvidence}=await vite.ssrLoadModule('/src/data/bodyGraph.ts');

test('BodyGraph replay preserves identity and excludes later or other-crew evidence',()=>{
 const row={id:'old',astronaut_id:crews[0].id,recorded_at:'2026-01-01T00:00:00Z',hr:null,sleep:0,bp:null,symptoms:['No dizziness'],synthetic:true,provenance:'Synthetic unit'};
 const newer={...row,id:'new',recorded_at:'2026-01-02T00:00:00Z',hr:88};
 const replay=replayWindow([row,newer],row.astronaut_id,'old');assert.deepEqual(replay.history,[row]);assert.equal(replay.record.id,'old');assert.equal(replay.record.sleep,0);assert.equal(replay.record.hr,null);
 const earlier={...row,id:'z',recorded_at:'2026-01-01T00:00:00.123001Z'},later={...row,id:'a',recorded_at:'2026-01-01T01:00:00.123002+01:00'};
 const ordered=orderedRecords([later,earlier],row.astronaut_id);assert.deepEqual(ordered.map(r=>r.id),['z','a']);assert.deepEqual(replayWindow(ordered,row.astronaut_id,'z').history,[earlier]);
 assert.equal(replayWindow([row,newer],row.astronaut_id,null).record.id,'new');assert.throws(()=>replayWindow([row],row.astronaut_id,'absent'),/unavailable/);assert.throws(()=>replayWindow([row],'Crew B',null),/synthetic saved evidence/);assert.throws(()=>replayWindow([{...row,provenance:''}],row.astronaut_id,null),/synthetic saved evidence/);
 assert.deepEqual(replayWindow([],row.astronaut_id,null).history,[]);assert.deepEqual(reportedEvidence('balance',row),['No dizziness']);
});
test('BodyGraph evidence states never invent unsupported measurements',()=>{
 const row={id:'one',astronaut_id:crews[0].id,recorded_at:'2026-01-01T00:00:00Z',hr:88,sleep:0,bp:null,symptoms:['Cough','Rash'],synthetic:true,provenance:'Synthetic unit'};
 assert.equal(BODY_SYSTEMS.length,8);assert.deepEqual(systemEvidence('heart',row,crews[0]).state,{recorded:true,changed:true,missing:true,review:true});assert.equal(systemEvidence('brain',row,crews[0]).state.missing,false);
 for(const system of ['eyes','muscles','bones','balance','lungs','skin']){const evidence=systemEvidence(system,row,crews[0]);assert.equal(evidence.state.missing,true);assert.equal(evidence.state.changed,false);assert.ok(evidence.missing.length);}
 assert.equal(systemEvidence('eyes',row,crews[0]).state.recorded,false);assert.equal(systemEvidence('lungs',row,crews[0]).state.recorded,true);assert.equal(systemEvidence('heart',undefined,crews[0]).state.review,false);
});
test('history pagination includes records beyond 1000 without changing the HTTP contract',async()=>{
 const offsets=[];
 const rows=await loadHistory('Crew A',async url=>{offsets.push(url);return Array.from({length:offsets.length===1?1000:1},(_,i)=>({id:String(i),astronaut_id:'Crew A',recorded_at:'2026-01-01T00:00:00Z'}));});
 assert.equal(rows.length,1001);assert.match(offsets[1],/offset=1000$/);
});
test('history rejects data belonging to another crew',async()=>{
 await assert.rejects(()=>loadHistory('Crew A',async()=>[{astronaut_id:'Crew B'}]),/selected crew/);
});
test('profile core values override fixtures and unknown IDs never borrow readings',()=>{
 const profile={id:'Crew A',role:'Backend role',hr:null,sleep:0,bp:null,symptoms:[],baseline:71,sleepBaseline:7,synthetic:true,provenance:'unit synthetic'};
 const actual=displayProfile(profile,crews);assert.equal(actual.hr,null);assert.equal(actual.sleep,0);assert.equal(actual.baseline,71);
 const unknown=displayProfile({...profile,id:'Unseen Crew'},crews);
 for(const key of ['radiationDailyMsv','radiationBaselineMsv','countermeasureMin','countermeasureTargetMin','bodyMassKg','ocularCheck'])assert.equal(unknown[key],null);
});
test('voice explicit negation does not become a positive symptom',()=>{
 const actual=parseTranscriptToCheckIn('no headache. heart rate eighty eight. sleep four point two hours');
 assert.deepEqual(actual.removeSymptoms,['Headache']);assert.equal(actual.symptoms,undefined);
 assert.equal(actual.hr,'88');assert.equal(actual.sleep,'4.2');
 assert.equal(parseTranscriptToCheckIn('blood pressure unknown').sys,'');
 assert.deepEqual(parseTranscriptToCheckIn('no muscle pain').removeSymptoms,['Muscle discomfort']);
});
test('spoken numbers reject noncanonical sums and preserve HR decimals',()=>{
 assert.equal(parseTranscriptToCheckIn('heart rate twenty twenty').hr,undefined);
 assert.equal(parseTranscriptToCheckIn('heart rate one hundred and twenty').hr,'120');
 assert.equal(parseTranscriptToCheckIn('heart rate 88.5').hr,'88.5');
});
test('negative voice numbers are not silently converted to positive readings',()=>{
 assert.equal(parseTranscriptToCheckIn('heart rate minus eighty eight bpm').hr,undefined);
 assert.equal(parseTranscriptToCheckIn('sleep -2 hours').sleep,undefined);
 assert.equal(parseTranscriptToCheckIn('blood pressure negative one hundred twenty over eighty').sys,undefined);
});
test('live presentation adapter preserves exact response without inventing exclusion reasons',()=>{
 const result={status:'needs_review',observations:['Recorded synthetic value'],missing_data:['sleep_hours'],resource_constraints:[],safety_flags:['synthetic_demo'],next_check:null,requires_medical_officer_review:false,explanation:'Exact engine explanation',evidence_sources:[],diagnosis:null};
 const view=formatInvestigationView(result);assert.equal(view.selectedExplanation,result.explanation);assert.equal(view.reviewLabel,'Not required by returned result');assert.deepEqual(view.observationsList,result.observations);assert.deepEqual(view.missingData,result.missing_data);assert.deepEqual(view.safetyFlags,result.safety_flags);
 assert.equal(view.excludedExplanation,'No separate exclusion explanation was returned. See the engine explanation above.');
});
test('absent response is unavailable rather than a fabricated engine rejection',()=>{
 assert.equal(formatInvestigationView(null).selectedExplanation,'No investigation response is available.');
});


test('body monitoring sorts actual instants and retains full nullable records',()=>{
 const first={id:'a',astronaut_id:'Crew A',recorded_at:'2026-01-01T01:00:00+01:00',hr:null,sleep:0,bp:null,symptoms:['Blurred vision'],synthetic:true,provenance:'Synthetic test'};
 const last={...first,id:'b',recorded_at:'2026-01-02T00:00:00Z',hr:88};
 const rows=orderedRecords([last,first],'Crew A');assert.deepEqual(rows,[first,last]);assert.equal(rows[0].bp,null);assert.equal(rows[0].sleep,0);assert.deepEqual(rows[0].symptoms,['Blurred vision']);
 assert.deepEqual(visualSymptoms(first),['Blurred vision']);assert.deepEqual(visualSymptoms({...first,symptoms:['Fatigue']}),[]);
 assert.throws(()=>orderedRecords([first],'Crew B'),/mismatched/);assert.throws(()=>orderedRecords([{...first,recorded_at:'bad'}],'Crew A'),/timestamp/);
 assert.equal(bodyRegion('eye_r'),'eyes');assert.equal(bodyRegion('heart'),'heart');assert.equal(bodyRegion('liver'),null);
});
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('empty and sparse body history never claims a trend or invents an ocular result',()=>{
 const props={part:'heart',crew:crews[0],records:[],loading:false,error:'',onInvestigate:()=>{}};
 const empty=renderToStaticMarkup(React.createElement(BodySystemMonitoring,props));
 assert.match(empty,/No saved check-in/);assert.match(empty,/disabled/);assert.match(empty,/no trend shown/);assert.match(empty,/Unknown/);
 const row={id:'one',astronaut_id:crews[0].id,recorded_at:'2026-01-01T00:00:00Z',hr:88,sleep:null,bp:null,symptoms:[],synthetic:true,provenance:'Synthetic unit'};
 const sparse=renderToStaticMarkup(React.createElement(BodySystemMonitoring,{...props,records:[row]}));assert.match(sparse,/no trend shown/);
 const eye=renderToStaticMarkup(React.createElement(BodySystemMonitoring,{...props,part:'eye_r',records:[row]}));assert.match(eye,/Ocular assessment not recorded in the current backend/);assert.doesNotMatch(eye,/SANS diagnosis/);
});

test('mission baseline comparison is descriptive arithmetic and preserves Unknown and sleep zero',()=>{
 assert.equal(baselineDifference(88,70),'+18');assert.equal(baselineDifference(4.2,7.3),'-3.1');assert.equal(baselineDifference(null,70),'Unknown');assert.equal(baselineDifference(0,7),'-7');assert.equal(baselineDifference(70,70),'0');
 assert.deepEqual(completeness([{hr:88,sleep:null,bp:null},{hr:null,sleep:0,bp:'120 / 80'}]),{recorded:3,slots:6});
});

test('mission timeline empty/sparse records expose Unknown without fabricating a trend',()=>{
 const props={crew:crews[0],records:[],loading:false,error:'',onRegion:()=>{},onInvestigate:()=>{}};
 const empty=renderToStaticMarkup(React.createElement(MissionHealthTimeline,props));assert.match(empty,/Insufficient recorded observations for trend comparison/);assert.match(empty,/No saved check-in available/);
 const row={id:'sparse',astronaut_id:crews[0].id,recorded_at:'2026-01-01T00:00:00Z',hr:null,sleep:0,bp:null,symptoms:[],synthetic:true,provenance:'Synthetic sparse observation'};
 const sparse=renderToStaticMarkup(React.createElement(MissionHealthTimeline,{...props,records:[row]}));assert.match(sparse,/Latest HR: Unknown/);assert.match(sparse,/Latest sleep: 0 h/);assert.match(sparse,/1\/3 HR\/Sleep\/BP measurement slots/);assert.match(sparse,/Insufficient recorded observations for trend comparison/);
});

test('recorded profile uses latest history including null/zero and rejects another crew',()=>{
 const profile=crews[1],row={id:'latest',astronaut_id:profile.id,recorded_at:'2026-11-14T00:00:00Z',hr:null,sleep:0,bp:null,symptoms:['Fatigue'],synthetic:true,provenance:'Synthetic regression'};
 const shown=recordedProfile(profile,row);assert.equal(shown.hr,null);assert.equal(shown.sleep,0);assert.equal(shown.bp,null);assert.equal(shown.ocularCheck,null);assert.deepEqual(shown.symptoms,['Fatigue']);assert.equal(shown.baseline,profile.baseline);
 const empty=recordedProfile(profile);assert.equal(empty.hr,null);assert.equal(empty.sleep,null);assert.equal(empty.bp,null);assert.deepEqual(empty.symptoms,[]);assert.throws(()=>recordedProfile(crews[0],row),/crew mismatch/);
});
test('every live crew discards illustrative ocular measurements while fixture data is explicit',()=>{
 for(const fixture of crews){const live=displayProfile({...fixture,synthetic:true,provenance:'Synthetic backend'},crews);assert.equal(live.ocularCheck,null);}
 assert.match(crews[1].ocularCheck,/Illustrative/);assert.doesNotMatch(crews[1].ocularCheck,/\(Recorded\)/);
});
