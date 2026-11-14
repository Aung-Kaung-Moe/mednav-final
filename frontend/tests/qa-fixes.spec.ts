import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const base='http://127.0.0.1:8000/api/v1',phase=process.env.QA_FIX_PHASE??'after';
const out='../qa-evidence/qa-fixes';
test.use({viewport:{width:1440,height:900},reducedMotion:'reduce'});
test.beforeEach(async({page})=>{
 fs.mkdirSync(out,{recursive:true});
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
});

test('external writes synchronize vitals, history and anatomy on crew switch, refresh and focus',async({page,request})=>{
 test.setTimeout(60000);
 let evaluations=0;page.on('request',r=>{if(r.url().endsWith('/investigations/evaluate'))evaluations++});
 await page.goto('/');await expect(page.getByTestId('body-monitoring')).toBeVisible();
 const created=await request.post(`${base}/check-ins`,{data:{astronaut_id:'Crew B',hr:111,sleep:2.25,bp:null,symptoms:['Fatigue']}});expect(created.status()).toBe(201);const saved=await created.json();
 await page.locator('header select').selectOption('Crew B');await expect(page.getByTestId('body-monitoring')).toContainText(saved.id);
 await page.screenshot({path:`${out}/${phase}-vitals.png`,fullPage:true});
 const vitals=page.locator('.vitals-card');await expect(vitals).toContainText('111');await expect(vitals).toContainText('2.25');await expect(vitals).toContainText('2/3 Recorded');await expect(vitals).not.toContainText('118 / 76');
 const timeline=page.getByRole('region',{name:'Mission health timeline',exact:true});await expect(timeline).toContainText('Latest HR: 111 bpm');await expect(timeline).toContainText('Latest BP: Unknown');
 await page.getByRole('button',{name:'Heart',exact:true}).click();await expect(page.getByTestId('body-monitoring')).toContainText('111 bpm');await expect(page.getByTestId('body-monitoring')).toContainText('Latest check-in BP: Unknown');
 const refresh=page.getByRole('button',{name:'Refresh recorded data',exact:true});await expect(refresh).toBeEnabled();
 const nulls=await(await request.post(`${base}/check-ins`,{data:{astronaut_id:'Crew B',hr:null,sleep:null,bp:null,symptoms:[]}})).json();await refresh.click();await expect(page.getByTestId('body-monitoring')).toContainText(nulls.id);await expect(vitals).toContainText('0/3 Recorded');await expect(vitals).not.toContainText('111');await expect(timeline).toContainText('Latest sleep: Unknown');await expect(page.getByTestId('sync-status')).toContainText('Last synchronized');await expect(refresh).toBeEnabled();
 const count=evaluations;const sync=await page.getByTestId('sync-status').innerText();await refresh.click();await expect(page.getByTestId('sync-status')).not.toHaveText(sync);await expect(refresh).toBeEnabled();expect(evaluations).toBe(count);const unchangedRefreshEvaluations=evaluations-count;
 const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(1100); // beyond the event-coalescing guard
 const newest=await(await request.post(`${base}/check-ins`,{data:{astronaut_id:'Crew B',hr:99,sleep:4.75,bp:'121 / 79',symptoms:['Headache']}})).json();await page.bringToFront();
 // Headless Edge keeps tabs logically focused. Exercise the actual DOM
 // lifecycle listeners (not React handlers); HTTP responses remain real.
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});
 await expect(page.getByTestId('body-monitoring')).toContainText(newest.id);await expect(vitals).toContainText('99');await expect(vitals).toContainText('4.75');await expect(vitals).toContainText('121 / 79');await other.close();
 await page.locator('header select').selectOption('Crew C');await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-crew','Crew C');await expect(page.getByTestId('body-monitoring')).not.toContainText(newest.id);
 await page.locator('header select').selectOption('Crew B');await expect(vitals).toContainText('121 / 79');
 fs.writeFileSync(`${out}/${phase}-sync.json`,JSON.stringify({saved,nulls,newest,evaluations,unchangedRefreshEvaluations,focusEvent:'DOM focus/visibility events dispatched in headless Edge'},null,2));
});

test('Live ocular provenance stays Unknown across every crew and surface',async({page,request})=>{
 await page.goto('/');await expect(page.getByTestId('body-monitoring')).toBeVisible();
 for(const crew of ['Crew B','Crew A','Crew C']){
  await page.locator('header select').selectOption(crew);await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-crew',crew);
  expect((await(await request.get(`${base}/astronauts/${encodeURIComponent(crew)}`)).json())).not.toHaveProperty('ocularCheck');
  await page.getByRole('button',{name:'Ocular Structure (L)',exact:true}).click();await expect(page.getByTestId('body-monitoring')).toContainText('Ocular assessment not recorded');
  if(crew==='Crew B')await page.screenshot({path:`${out}/${phase}-ocular-dashboard.png`,fullPage:true});
  await expect(page.locator('.hazards-card')).not.toContainText('Optic sheath 5.1');await expect(page.locator('.hazards-card')).toContainText('Ocular assessment not recorded');
  await expect(page.getByRole('region',{name:'Mission health timeline',exact:true})).not.toContainText('Optic sheath');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Incident Report',exact:true}).click();
  await expect(page.locator('.mission-console')).toContainText('Ocular assessment not recorded');await expect(page.locator('.mission-console')).not.toContainText('Optic sheath 5.1');await expect(page.locator('.mission-console')).toContainText('illustrative');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Demo JSON',exact:true}).click();const file=await download;const saved=`../.demo-runtime/qa-fixes/report-${crew.slice(-1)}.json`;await file.saveAs(saved);expect(JSON.parse(fs.readFileSync(saved,'utf8')).illustrative_telemetry.ocularCheck).toBeNull();
  await page.getByRole('button',{name:'Dashboard',exact:true}).click();
 }
});

test('ocular fixture remains explicitly illustrative only in fixture mode',async({page})=>{
 await page.goto('/?mode=fixture');await page.locator('header select').selectOption('Crew B');
 await expect(page.getByTestId('backend-status')).toContainText('LOCAL FIXTURE');
 await expect(page.locator('.hazards-card')).toContainText('Illustrative optic sheath');await expect(page.locator('.hazards-card')).not.toContainText('5.1 mm (Recorded)');
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Incident Report',exact:true}).click();await expect(page.locator('.mission-console')).toContainText('Illustrative optic sheath');
});

test('Incident Report fits 375/390 and preserves desktop column geometry',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('body-monitoring')).toBeVisible();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Incident Report',exact:true}).click();
 const geometry=await page.locator('.mission-console .asymmetric-workspace-grid > *').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width}}));
 const baseline='../.demo-runtime/qa-fixes/desktop-before.json';if(phase==='before')fs.writeFileSync(baseline,JSON.stringify(geometry));else if(fs.existsSync(baseline))expect(geometry).toEqual(JSON.parse(fs.readFileSync(baseline,'utf8')));
 await page.screenshot({path:`${out}/${phase}-report-desktop.png`,fullPage:true});const widths=[];
 for(const width of [375,390]){await page.setViewportSize({width,height:844});await expect.poll(()=>page.locator('.sidebar').evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  widths.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('.mission-console *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,text:el.textContent?.slice(0,60)})).slice(0,8)})));
  await page.screenshot({path:`${out}/${phase}-report-${width}.png`,fullPage:true});
 }
 fs.writeFileSync(`${out}/${phase}-report-widths.json`,JSON.stringify(widths,null,2));for(const size of widths)expect(size.document).toBeLessThanOrEqual(size.viewport);
});
