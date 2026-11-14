import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
test('P1 fix: changed preset, rapid no-ops, visible evaluation error and recovery',async({page,request})=>{
 const out=path.resolve('../qa-evidence');fs.mkdirSync(out,{recursive:true});
 const inventory=await(await request.get('http://127.0.0.1:8000/api/v1/inventory')).json();
 const previous=inventory.find((i:any)=>i.name==='Blood-pressure monitor').available;
 const calls:{body:any;status?:number}[]=[];
 page.on('request',r=>{if(r.url().endsWith('/investigations/evaluate'))calls.push({body:r.postDataJSON()})});
 try{
  await request.patch('http://127.0.0.1:8000/api/v1/inventory/Blood-pressure%20monitor',{data:{available:true}});
  await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.getByRole('button',{name:'What-If Lab',exact:true}).click();
  await page.screenshot({path:out+'/p1-before-preset.png',fullPage:true});
  const patch=page.waitForResponse(r=>r.url().includes('/inventory/')&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Needs Review (Monitor Blocked)',exact:true}).click();expect((await patch).status()).toBe(200);
  await expect(page.getByRole('switch',{name:'BP monitor available',exact:true})).toHaveAttribute('aria-checked','false');
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.screenshot({path:out+'/p1-after-preset.png',fullPage:true});
  const panel=await page.getByLabel('Live investigation result').innerText();const count=calls.length;
  for(let i=0;i<10;i++)await page.getByRole('button',{name:'Needs Review (Monitor Blocked)',exact:true}).click();
  await expect(page.getByRole('button',{name:'BP Recorded',exact:true})).toBeDisabled();
  const noOpRequestCount=calls.length-count;
  expect(noOpRequestCount).toBe(0);expect(await page.getByLabel('Live investigation result').innerText()).toBe(panel);
  await expect(page.getByRole('switch',{name:'BP monitor available',exact:true})).toBeVisible();
  await page.screenshot({path:out+'/p1-after-reapply.png',fullPage:true});
  await page.route('**/api/v1/investigations/evaluate',async route=>{await new Promise(r=>setTimeout(r,400));await route.abort()});
  await page.getByRole('switch',{name:'Manual emergency override',exact:true}).click();
  await expect(page.getByRole('status').first()).toContainText('Evaluating');
  await expect(page.getByRole('alert')).toContainText('Backend unavailable');await expect(page.getByTestId('engine-status')).toHaveCount(0);
  await page.screenshot({path:out+'/p1-evaluation-error.png',fullPage:true});
  await page.unroute('**/api/v1/investigations/evaluate');await page.getByRole('button',{name:'Retry backend',exact:true}).click();
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','escalate');await expect(page.getByLabel('Live investigation result')).toContainText('next_check: null');
  expect(calls.at(-1)?.body.emergency_override).toBe(true);expect(calls.at(-1)?.body.communication_status).toBe('offline');
  fs.writeFileSync(out+'/p1-fix-verification.json',JSON.stringify({repeatedClicks:10,ignoredBpPreset:true,noOpRequestCount,evaluationRequests:calls},null,2));
 }finally{await request.patch('http://127.0.0.1:8000/api/v1/inventory/Blood-pressure%20monitor',{data:{available:previous}})}
});
