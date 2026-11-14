import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve('../qa-evidence');
fs.mkdirSync(out,{recursive:true});
test.describe.configure({mode:'serial'});
test('independent QA: saved record, engine, inventory, escalation, persistence',async({page,request})=>{
 const network:unknown[]=[];
 page.on('response',async r=>{if(r.url().includes(':8000/api/v1')){try{network.push({url:r.url(),method:r.request().method(),status:r.status(),request:r.request().postDataJSON(),response:await r.json()})}catch{}}});
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.locator('header select').selectOption('Crew B');await expect(page.getByRole('status').first()).toContainText('LIVE BACKEND');
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
 await page.getByLabel('Heart rate (bpm)',{exact:true}).fill('88');await page.getByLabel('Sleep (hours)',{exact:true}).fill('4.2');
 await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('');
 await page.getByLabel('Headache',{exact:true}).check();
 await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
 const save=page.waitForResponse(r=>r.url().endsWith('/check-ins')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Save Check-In',exact:true}).click();const saved=await(await save).json();
 expect(saved.astronaut_id).toBe('Crew B');expect(saved.bp).toBeNull();
 const persisted=await request.get(`http://127.0.0.1:8000/api/v1/check-ins/${saved.id}`);expect(await persisted.json()).toEqual(saved);
 await page.getByRole('button',{name:'Open Investigation',exact:true}).click();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await expect(page.getByLabel('Live investigation result')).toContainText('systolic_bp_mm_hg');
 const expected=await(await request.post('http://127.0.0.1:8000/api/v1/investigations/evaluate',{data:{check_in_id:saved.id,communication_status:'offline',emergency_override:false}})).json();
 for(const key of ['observations','missing_data','resource_constraints','safety_flags'])for(const text of expected[key])await expect(page.getByLabel('Live investigation result')).toContainText(text);
 await expect(page.getByLabel('Live investigation result')).toContainText(expected.explanation);
 await page.getByRole('button',{name:'What-If Lab',exact:true}).click();
 for(const available of [true,false,true]){
  const sw=page.getByRole('switch',{name:'BP monitor available',exact:true});await expect(sw).toBeVisible();
  if((await sw.getAttribute('aria-checked')==='true')!==available){
   const patch=page.waitForResponse(r=>r.url().includes('/inventory/')&&r.request().method()==='PATCH');await sw.click();expect((await patch).status()).toBe(200);
  }
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  const inv=await(await request.get('http://127.0.0.1:8000/api/v1/inventory')).json();expect(inv.find((i:any)=>i.name==='Blood-pressure monitor').available).toBe(available);
  const result=await(await request.post('http://127.0.0.1:8000/api/v1/investigations/evaluate',{data:{check_in_id:saved.id,communication_status:'offline',emergency_override:false}})).json();
  if(!available)expect(result.next_check?.requires_equipment??[]).not.toContain('bp_monitor');
  expect(result.diagnosis).toBeNull();expect(result.evidence_sources.join(' ')).toContain('mednav_rules_demo-2');
 }
 await page.getByRole('switch',{name:'Manual emergency override',exact:true}).click();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','escalate');
 await expect(page.getByLabel('Live investigation result')).toContainText('next_check: null');
 await expect(page.getByLabel('Live investigation result')).toContainText('approved_emergency_protocol_required');
 await page.screenshot({path:out+'/emergency-desktop.png',fullPage:true});
 await page.reload();await expect(page.getByRole('status').first()).not.toContainText('Connecting');
 // Crew selection and override are temporary. Re-select persisted Crew B after refresh.
 await page.locator('header select').selectOption('Crew B');await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',saved.id);await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:out+'/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:out+'/dashboard-mobile.png',fullPage:true});
 fs.writeFileSync(out+'/network.json',JSON.stringify({saved,network},null,2));
});

test('independent QA: invalid inputs and visible network failures',async({page,request})=>{
 const errors:unknown[]=[];
 for(const body of [{astronaut_id:'Crew A',hr:-1},{astronaut_id:'Crew A',sleep:25},{astronaut_id:'Crew A',bp:'bad'}]){
  const r=await request.post('http://127.0.0.1:8000/api/v1/check-ins',{data:body});expect(r.status()).toBe(422);errors.push({body,status:r.status(),response:await r.json()});
 }
 const missing=await request.post('http://127.0.0.1:8000/api/v1/investigations/evaluate',{data:{communication_status:'offline',emergency_override:false}});expect(missing.status()).toBe(422);
 const invalid=await request.patch('http://127.0.0.1:8000/api/v1/inventory/Blood-pressure%20monitor',{data:{quantity:-1}});expect(invalid.status()).toBe(422);
 await page.goto('/');await page.getByRole('button',{name:'Health Check-In',exact:true}).click();await page.getByLabel('Sleep (hours)',{exact:true}).fill('25');await page.getByRole('button',{name:'Review Check-In',exact:true}).click();expect(await page.getByLabel('Sleep (hours)',{exact:true}).evaluate((e:HTMLInputElement)=>e.validity.valid)).toBe(false);
 await page.getByLabel('Sleep (hours)',{exact:true}).fill('4.2');await page.getByLabel('Heart rate (bpm)',{exact:true}).fill('-1');await page.getByRole('button',{name:'Review Check-In',exact:true}).click();expect(await page.getByLabel('Heart rate (bpm)',{exact:true}).evaluate((e:HTMLInputElement)=>e.validity.valid)).toBe(false);
 await page.getByLabel('Heart rate (bpm)',{exact:true}).fill('88');await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('120.5');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('80');await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
 expect(await page.getByLabel('Systolic (mmHg)',{exact:true}).evaluate((e:HTMLInputElement)=>e.validity.valid)).toBe(false);
 await expect(page.getByRole('button',{name:'Save Check-In',exact:true})).toHaveCount(0);
 await page.route('http://127.0.0.1:8000/**',r=>r.abort());await page.reload();await expect(page.getByRole('alert')).toContainText('Backend unavailable');await expect(page.getByTestId('engine-status')).toHaveCount(0);await page.screenshot({path:out+'/backend-unavailable.png',fullPage:true});
 fs.writeFileSync(out+'/validation.json',JSON.stringify({errors,missingId:await missing.json(),invalidInventory:await invalid.json()},null,2));
});

test('independent QA: external traffic blocked, mission offline still evaluates',async({page})=>{
 const external:string[]=[];
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return r.continue();external.push(u.href);return r.abort()});
 const response=page.waitForResponse(r=>r.url().endsWith('/investigations/evaluate'));
 await page.goto('/');const actual=await response;expect(actual.request().postDataJSON().communication_status).toBe('offline');expect(actual.status()).toBe(200);await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 fs.writeFileSync(out+'/external-traffic.json',JSON.stringify({blockedRequests:external,evaluation:await actual.json()},null,2));
});

test('independent QA defect: reapplying active preset retains a result',async({page,request})=>{
 const items=await(await request.get('http://127.0.0.1:8000/api/v1/inventory')).json();
 const previous=items.find((i:any)=>i.name==='Blood-pressure monitor').available;
 try{
  await request.patch('http://127.0.0.1:8000/api/v1/inventory/Blood-pressure%20monitor',{data:{available:false}});
  await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.getByRole('button',{name:'What-If Lab',exact:true}).click();
  await page.getByRole('button',{name:'Needs Review (Monitor Blocked)',exact:true}).click();
  await page.screenshot({path:out+'/defect-active-preset.png',fullPage:true});
  fs.writeFileSync(out+'/defect-active-preset.json',JSON.stringify({resultCount:await page.getByTestId('engine-status').count(),alertCount:await page.getByRole('alert').count()},null,2));
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 }finally{await request.patch('http://127.0.0.1:8000/api/v1/inventory/Blood-pressure%20monitor',{data:{available:previous}})}
});
