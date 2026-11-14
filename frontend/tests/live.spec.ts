import {test,expect} from '@playwright/test';
test('live browser save, engine, resources, override and persistence',async({page})=>{
 const calls:string[]=[];page.on('response',r=>{if(r.url().includes(':8000/api/v1'))calls.push(r.url())});
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
 await page.getByLabel('Heart rate (bpm)',{exact:true}).fill('88');await page.getByLabel('Sleep (hours)',{exact:true}).fill('4.2');
 await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('');
 await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
 const saved=page.waitForResponse(r=>r.url().endsWith('/check-ins')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Save Check-In',exact:true}).click();const record=await (await saved).json();expect(record.id).toBeTruthy();expect(record.bp).toBeNull();
 await page.getByRole('button',{name:'Open Investigation',exact:true}).click();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.getByRole('button',{name:'What-If Lab',exact:true}).click();
 const sw=page.getByRole('switch',{name:'BP monitor available',exact:true});
 await expect(sw).toBeVisible();if(await sw.getAttribute('aria-checked')==='true')await sw.click();
 await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.getByRole('switch',{name:'BP monitor available',exact:true}).click();
 await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 const emerg=page.getByRole('switch',{name:'Manual emergency override',exact:true});await emerg.click();
 await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','escalate');await expect(page.getByLabel('Live investigation result')).toContainText('next_check: null');
 await page.reload();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',record.id);
 expect(calls.some(x=>x.endsWith('/investigations/evaluate'))).toBeTruthy();
 await page.screenshot({path:'tests/live-desktop.png',fullPage:true});
});
test('unavailable backend never silently falls back and fixture is explicit',async({page})=>{
 await page.route('http://127.0.0.1:8000/**',r=>r.abort());await page.goto('/');await expect(page.getByRole('alert')).toContainText('Backend unavailable');await expect(page.getByTestId('engine-status')).toHaveCount(0);
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();await expect(page.getByLabel('Heart rate (bpm)',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Medical Inventory',exact:true}).click();await expect(page.locator('.equipment-hairline-row')).toHaveCount(0);
 await page.getByText('Developer tools',{exact:true}).click();await page.getByLabel('Data mode').selectOption('fixture');await page.waitForURL('**/?mode=fixture');await page.waitForLoadState('domcontentloaded');await expect(page.getByRole('status').first()).toContainText('LOCAL FIXTURE');
});
test('browser saves complete BP using strict backend fields',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
 await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('120');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('80');
 await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
 const request=page.waitForRequest(r=>r.url().endsWith('/check-ins')&&r.method()==='POST');await page.getByRole('button',{name:'Save Check-In',exact:true}).click();
 const body=(await request).postDataJSON();expect(Object.keys(body).sort()).toEqual(['astronaut_id','bp','hr','sleep','symptoms']);expect(body.bp).toBe('120 / 80');
 await page.getByRole('button',{name:'Open Investigation',exact:true}).click();await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
});
