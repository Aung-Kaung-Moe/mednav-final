import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const api='http://127.0.0.1:8000/api/v1',out='../qa-evidence/bodygraph-v3';
test.use({viewport:{width:1440,height:900},reducedMotion:'reduce'});
test.beforeEach(async({page})=>{fs.mkdirSync(out,{recursive:true});await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort())});

test('eight systems replay exact saved evidence without future or cross-crew leakage',async({page,request})=>{
 const older=await(await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew A',hr:89,sleep:4,bp:null,symptoms:['Dizziness','Fatigue','Muscle soreness','Joint pain','Cough','Rash','Blurred vision']}})).json();
 const marker='Future-only fatigue marker '+older.id;
 const newer=await(await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew A',hr:75,sleep:7,bp:'120 / 78',symptoms:[marker]}})).json();
 await page.goto('/');const nav=page.getByRole('region',{name:'BodyGraph evidence navigator',exact:true});await expect(nav).toHaveAttribute('data-check-in-id',newer.id);
 await nav.getByLabel('Mission replay',{exact:true}).selectOption(older.id);await expect(nav).toContainText(older.recorded_at);
 const definitions=[['Heart / Cardiovascular','heart','89 bpm'],['Brain / Sleep','brain','4 h'],['Eyes / Ocular','eyes','Ocular assessment not recorded'],['Muscles / Exercise','muscles','Muscle soreness'],['Bones / Skeletal','bones','Joint pain'],['Vestibular / Balance','balance','Dizziness'],['Lungs / Respiratory','lungs','Cough'],['Skin / Immune','skin','Rash']];
 for(const [label,region,text] of definitions){await nav.getByRole('button',{name:`Select ${label}`,exact:true}).click();const panel=page.getByTestId('body-monitoring');await expect(panel).toHaveAttribute('data-region',region);await expect(panel).toHaveAttribute('data-record-id',older.id);await expect(panel).toContainText(text);await expect(panel).not.toContainText(marker);await expect(panel).not.toContainText(newer.id);if(!['heart','brain'].includes(region))await expect(panel).toContainText(/not recorded/i);}
 await nav.getByText('Cross-system observations · same replay window',{exact:true}).click();const cross=nav.getByRole('list',{name:'Cross-system recorded observations',exact:true});await expect(cross).toContainText(older.id);await expect(cross).not.toContainText(newer.id);await expect(cross).toContainText(older.recorded_at);await expect(cross).toContainText('Dizziness');await expect(nav).toContainText('does not establish causation');
 await page.getByRole('button',{name:'Heart',exact:true}).click();await expect(page.getByRole('button',{name:'Heart',exact:true})).toHaveAttribute('aria-description',/Descriptive baseline change/);
 await page.screenshot({path:`${out}/replay-desktop.png`,fullPage:true});
 await nav.getByRole('button',{name:'Return to latest observation',exact:true}).click();await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-record-id',newer.id);await expect(page.getByTestId('body-monitoring')).toContainText('75 bpm');
 await page.locator('header select').selectOption('Crew B');await expect(nav).toHaveAttribute('data-crew','Crew B');await expect(page.getByTestId('body-monitoring')).not.toContainText(older.id);
});

test('BodyGraph invokes the real engine for replay ID and retrieves persisted follow-up',async({page,request})=>{
 const record=await(await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew B',hr:90,sleep:4.5,bp:null,symptoms:['Fatigue']}})).json();
 await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew B',hr:72,sleep:7.5,bp:'118 / 76',symptoms:[]}});
 await page.goto('/');await page.locator('header select').selectOption('Crew B');const nav=page.getByRole('region',{name:'BodyGraph evidence navigator',exact:true});await nav.getByLabel('Mission replay',{exact:true}).selectOption(record.id);
 const evaluation=page.waitForResponse(r=>r.url().endsWith('/investigations/evaluate')&&r.request().postDataJSON().check_in_id===record.id);await nav.getByRole('button',{name:'Investigate replay observation',exact:true}).click();const response=await evaluation;expect(response.status()).toBe(200);const result=await response.json();expect(result.diagnosis).toBeNull();await expect(page.getByLabel('Decision trace')).toContainText(result.explanation);await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',record.id);
 const follow=page.getByRole('region',{name:'Follow-up tracking',exact:true}),note=`Synthetic BodyGraph follow-up ${record.id}`;await follow.getByLabel('Follow-up note',{exact:true}).fill(note);const saving=page.waitForResponse(r=>r.url().endsWith('/follow-ups')&&r.request().method()==='POST');await follow.getByRole('button',{name:'Record Follow-Up Note',exact:true}).click();expect((await saving).status()).toBe(201);await expect(follow.getByRole('list')).toContainText(note);
 await page.reload();await page.locator('header select').selectOption('Crew B');await nav.getByLabel('Mission replay',{exact:true}).selectOption(record.id);const before=await(await request.get(`${api}/astronauts/Crew%20B/follow-ups?check_in_id=${record.id}`)).json();await nav.getByText('Recorded follow-up for this check-in',{exact:true}).click();await expect(nav).toContainText(note);const after=await(await request.get(`${api}/astronauts/Crew%20B/follow-ups?check_in_id=${record.id}`)).json();expect(after).toEqual(before);
 await page.screenshot({path:`${out}/follow-up-replay.png`,fullPage:true});await nav.getByRole('button',{name:'Return to latest observation',exact:true}).click();await expect(nav).not.toContainText(note);
 fs.writeFileSync(`${out}/engine-follow-up.json`,JSON.stringify({record,result,followUp:after},null,2));
});

test('timeline replay bridge preserves null and zero measurements on mobile',async({page,request})=>{
 const selected=await(await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew C',hr:null,sleep:0,bp:null,symptoms:[]}})).json();await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew C',hr:80,sleep:6,bp:null,symptoms:['Fatigue']}});
 await page.goto('/');await page.locator('header select').selectOption('Crew C');const timeline=page.getByRole('region',{name:'Mission health timeline',exact:true});await timeline.getByRole('button',{name:`Inspect observation ${selected.id}`,exact:true}).click();await timeline.getByRole('button',{name:'Replay on BodyGraph',exact:true}).click();const panel=page.getByTestId('body-monitoring');await expect(panel).toHaveAttribute('data-record-id',selected.id);await expect(panel).toContainText('0 h');
 await page.getByRole('button',{name:'Heart',exact:true}).click();await expect(panel.locator('.selected-metric')).toContainText('Unknown');await expect(panel).toContainText('Replay check-in BP: Unknown');await expect(page.getByRole('region',{name:'BodyGraph evidence navigator',exact:true})).toContainText('not risk');
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${out}/replay-mobile.png`,fullPage:true});
});
