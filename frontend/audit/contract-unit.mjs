import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import path from 'node:path';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.resolve('../.demo-runtime/audit-vite-cache'),server:{middlewareMode:true},logLevel:'error'});
after(()=>vite.close());
const {loadHistory}=await vite.ssrLoadModule('/src/api.ts');
const {displayProfile}=await vite.ssrLoadModule('/src/types/api.ts');
const {crews}=await vite.ssrLoadModule('/src/data/fixtures.ts');
const {parseTranscriptToCheckIn}=await vite.ssrLoadModule('/src/components/VoiceCheckIn.tsx');
const {formatInvestigationView}=await vite.ssrLoadModule('/src/types/scenario.ts');
test('history pagination includes records beyond 1000 without changing the HTTP contract',async()=>{
 const offsets=[];
 const rows=await loadHistory('Crew A',async url=>{offsets.push(url);return Array.from({length:offsets.length===1?1000:1},(_,i)=>({id:String(i),astronaut_id:'Crew A'}));});
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
