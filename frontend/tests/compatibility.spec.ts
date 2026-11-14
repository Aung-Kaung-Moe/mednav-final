import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const base='http://127.0.0.1:8000/api/v1';
test('cross-screen real records, three-crew isolation, report export and stale-response exclusion',async({page,request})=>{
 test.setTimeout(90000);
 const records:Record<string,any>={};
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 for(const [i,id] of ['Crew A','Crew B','Crew C'].entries()){
  await page.locator('header select').selectOption(id);
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
  await expect(page.getByLabel('Space radiation (mSv/day)',{exact:true})).toHaveJSProperty('readOnly',true);
  await page.getByLabel('Heart rate (bpm)',{exact:true}).fill(String(81+i));
  await page.getByLabel('Sleep (hours)',{exact:true}).fill(i===2?'0':String(5+i));
  await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('');
  await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
  const response=page.waitForResponse(r=>r.url().endsWith('/check-ins')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save Check-In',exact:true}).click();const saved=await(await response).json();records[id]=saved;
  expect(saved.hr).toBe(81+i);expect(saved.bp).toBeNull();
  await page.getByRole('button',{name:'Open Investigation',exact:true}).click();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  const profile=await(await request.get(`${base}/astronauts/${encodeURIComponent(id)}`)).json();expect(profile.hr).toBe(saved.hr);expect(profile.sleep).toBe(saved.sleep);
  const history=await(await request.get(`${base}/astronauts/${encodeURIComponent(id)}/history?limit=1000`)).json();expect(history.some((r:any)=>r.id===saved.id&&r.astronaut_id===id)).toBe(true);
 }
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Incident Report',exact:true}).click();
 await expect(page.locator('.mission-console')).toContainText('LOCAL PREVIEW');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Demo JSON',exact:true}).click();
 const file=await download;await file.saveAs('../.demo-runtime/audit-report.json');const report=JSON.parse(fs.readFileSync('../.demo-runtime/audit-report.json','utf8'));
 expect(report.subject.id).toBe(records['Crew C'].id);expect(report.subject.sleep).toBe(0);expect(report.subject).not.toHaveProperty('radiationDailyMsv');expect(report.illustrative_telemetry).toBeTruthy();
 const expected=await(await request.post(`${base}/investigations/evaluate`,{data:{check_in_id:records['Crew C'].id,communication_status:'offline',emergency_override:false}})).json();
 expect(report.investigation_response).toEqual(expected);expect(expected.diagnosis).toBeNull();
 await page.route('**/investigations/evaluate',async route=>{if(route.request().postDataJSON().check_in_id===records['Crew B'].id)await new Promise(r=>setTimeout(r,700));await route.continue();});
 await page.locator('header select').selectOption('Crew B');await expect(page.getByTestId('engine-status')).toHaveCount(0);
 await page.locator('header select').selectOption('Crew A');await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',records['Crew A'].id);await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.reload();await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',records['Crew A'].id);
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();await expect(page.getByLabel('Heart rate (bpm)',{exact:true})).toHaveValue('81');
 fs.writeFileSync('../qa-evidence/audit-cross-crew.json',JSON.stringify({records,report},null,2));
});

test('inventory UI synchronizes What-If, rejects zero quantity and surfaces PATCH failure',async({page,request})=>{
 test.setTimeout(60000);
 const url=`${base}/inventory/Blood-pressure%20monitor`;const initial=(await(await request.get(`${base}/inventory`)).json()).find((i:any)=>i.name==='Blood-pressure monitor');
 try{
  await request.patch(url,{data:{quantity:1,available:true}});
  await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.getByRole('button',{name:'Medical Inventory',exact:true}).click();await page.getByLabel('Search equipment').fill('Blood-pressure');
  const patch=page.waitForResponse(r=>r.url().includes('/inventory/')&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Mark Unavailable',exact:true}).click();expect((await patch).status()).toBe(200);
  await expect(page.locator('.equipment-hairline-row')).toContainText('Unavailable');
  await page.getByRole('button',{name:'What-If Lab',exact:true}).click();await expect(page.getByRole('switch',{name:'BP monitor available',exact:true})).toHaveAttribute('aria-checked','false');
  await expect(page.getByRole('button',{name:'BP Recorded',exact:true})).toBeDisabled();
  await page.route('**/inventory/*',r=>r.request().method()==='PATCH'?r.abort():r.continue());
  await page.getByRole('switch',{name:'BP monitor available',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Backend unavailable');
  await page.unroute('**/inventory/*');await page.getByRole('button',{name:'Retry backend',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
  await request.patch(url,{data:{quantity:0,available:false}});await page.reload();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.getByRole('button',{name:'Medical Inventory',exact:true}).click();await page.getByLabel('Search equipment').fill('Blood-pressure');await expect(page.getByRole('button',{name:'Mark Usable',exact:true})).toBeDisabled();
  expect((await request.patch(url,{data:{available:true}})).status()).toBe(422);
 }finally{await request.patch(url,{data:{quantity:initial.quantity,available:initial.available}})}
});

test('equipment-free real check is not labeled null; anatomy follows selected crew readings',async({page,request})=>{
 const saved=await(await request.post(`${base}/check-ins`,{data:{astronaut_id:'Crew C',hr:74,sleep:1,bp:'120 / 80',symptoms:['Fatigue']}})).json();
 const result=await(await request.post(`${base}/investigations/evaluate`,{data:{check_in_id:saved.id,communication_status:'offline',emergency_override:false}})).json();
 expect(result.next_check).not.toBeNull();expect(result.next_check.requires_equipment).toEqual([]);
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');await page.locator('header select').selectOption('Crew C');
 await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',saved.id);await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.getByRole('button',{name:'Heart',exact:true}).click();await expect(page.locator('.selected-card')).toContainText('74 bpm');await expect(page.locator('.selected-card')).toContainText('120 / 80');
 await page.getByRole('button',{name:'What-If Lab',exact:true}).click();await expect(page.getByLabel('Decision trace')).toContainText('None required');
 await expect(page.getByLabel('Decision trace')).not.toContainText('None (next_check: null)');
});
