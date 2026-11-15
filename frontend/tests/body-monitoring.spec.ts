import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
const api='http://127.0.0.1:8000/api/v1';
test.use({viewport:{width:1440,height:900}});
test.beforeEach(async({page})=>{
  // Exercise the original offline/fallback model deterministically; no medical responses are mocked.
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
});
async function select(page:import('@playwright/test').Page,crew:string){
 await page.locator('header select').selectOption(crew);
 await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-crew',crew);
}
test('body systems use real selected-crew SQLite history, missing ocular evidence and real evaluation',async({page,request})=>{
 const profiles=await(await request.get(`${api}/astronauts`)).json();
 const history=await(await request.get(`${api}/astronauts/Crew%20A/history`)).json();const latest=history.at(-1);
 await page.goto('/');await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-crew','Crew A');
 await page.getByRole('button',{name:'Heart',exact:true}).click();
 const panel=page.getByTestId('body-monitoring');await expect(panel).toContainText(`Recorded personal baseline: ${profiles.find((p:{id:string})=>p.id==='Crew A').baseline} bpm`);
 await expect(panel).toContainText(latest.id);await expect(panel).toContainText(`${latest.hr} bpm`);
 await panel.getByText('Observation values, timestamps and sources',{exact:true}).click();
 for(const row of history.slice(-7))await expect(panel).toContainText(row.id);
 fs.mkdirSync('../qa-evidence/body-monitoring',{recursive:true});
 await panel.getByText('Observation values, timestamps and sources',{exact:true}).click();
 await page.screenshot({path:'../qa-evidence/body-monitoring/heart-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Brain',exact:true}).click();await expect(panel).toContainText(`${latest.sleep} h`);
 await expect(panel).toContainText('not a direct neurological measurement');
 await page.screenshot({path:'../qa-evidence/body-monitoring/brain-desktop.png',fullPage:true});
 const saved=await(await request.post(`${api}/check-ins`,{data:{astronaut_id:'Crew B',hr:93,sleep:3.25,bp:null,symptoms:['Blurred vision','Fatigue']}})).json();
 await select(page,'Crew B');await expect(panel).toContainText(saved.id);
 await page.getByRole('button',{name:'Ocular Structure (L)',exact:true}).click();
 await expect(panel).toContainText('Ocular assessment not recorded in the current backend.');await expect(panel).toContainText('Blurred vision');
 await expect(panel).not.toContainText('optic nerve measurement:');
 await page.screenshot({path:'../qa-evidence/body-monitoring/eyes-desktop.png',fullPage:true});
 for(const name of ['Heart','Brain','Ocular Structure (L)','Heart'])await page.getByRole('button',{name,exact:true}).click();
 await expect(panel).toContainText('93 bpm');await expect(panel).not.toContainText(latest.id);
 const evaluation=page.waitForResponse(r=>r.url().endsWith('/investigations/evaluate')&&r.request().postDataJSON().check_in_id===saved.id);
 await panel.getByRole('button',{name:'Open Investigation',exact:true}).click();const response=await evaluation;expect(response.status()).toBe(200);
 const result=await response.json();await expect(page.getByLabel('Decision trace')).toContainText(result.explanation);
 expect(response.request().postDataJSON()).toEqual({check_in_id:saved.id,communication_status:'offline',emergency_override:false});
 fs.writeFileSync('../qa-evidence/body-monitoring/http-evidence.json',JSON.stringify({profiles,crewAHistory:history,crewBSaved:saved,evaluationRequest:response.request().postDataJSON(),evaluationResponse:result},null,2));
});

test('manual saved nullable readings refresh monitoring; API errors never substitute a fixture',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('body-monitoring')).toBeVisible();await select(page,'Crew C');
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
 await page.getByLabel('Heart rate (bpm)',{exact:true}).fill('');await page.getByLabel('Sleep (hours)',{exact:true}).fill('');
 await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('');
 await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
 const response=page.waitForResponse(r=>r.url().endsWith('/check-ins')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save Check-In',exact:true}).click();
 const saved=await(await response).json();expect(saved.hr).toBeNull();expect(saved.sleep).toBeNull();expect(saved.bp).toBeNull();
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();await expect(page.getByTestId('body-monitoring')).toContainText(saved.id);
 await page.getByRole('button',{name:'Heart',exact:true}).click();await expect(page.locator('.selected-card .selected-metric')).toContainText('Unknown');
 await page.getByRole('button',{name:'Brain',exact:true}).click();await expect(page.locator('.selected-card .selected-metric')).toContainText('Unknown');
 await page.reload();await select(page,'Crew C');await expect(page.getByTestId('body-monitoring')).toContainText(saved.id);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../qa-evidence/body-monitoring/brain-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.route('**/astronauts/*/history*',r=>r.abort());await page.locator('header select').selectOption('Crew A');
 await expect(page.locator('.selected-card').getByRole('alert')).toContainText('History unavailable');
 await expect(page.getByTestId('body-monitoring')).toHaveCount(0);
 await page.unroute('**/astronauts/*/history*');await page.getByRole('button',{name:'Retry backend',exact:true}).click();
 await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-crew','Crew A');
});

test('original 3D canvas raycast selects Heart, Brain and both Eyes',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 await expect(page.getByTestId('body-monitoring')).toBeVisible();
 await page.getByRole('button',{name:'ORGANS',exact:true}).click();
 const canvas=page.locator('.body-stage canvas');
 // Project the unchanged fallback model's world coordinates through its actual
 // documented camera. Click the canvas itself, not a replacement/test selector.
 for(const [region,point] of [['heart',[0.04,2.22,0.245]],['brain',[0,3.20,0.04]],['eyes',[0.07,3.08,0.165]],['eyes',[-0.07,3.08,0.165]]] as const){
  await page.getByRole('button',{name:'Reset camera',exact:true}).click();
  const box=await canvas.boundingBox();expect(box).not.toBeNull();
  const camera=new PerspectiveCamera(box!.width<440?48:40,box!.width/box!.height,0.05,100);
  camera.position.set(0.22,1.83,5.35);camera.lookAt(0,1.72,0);camera.updateMatrixWorld();
  const projected=new Vector3(...point).project(camera);
  await canvas.click({position:{x:(projected.x+1)*box!.width/2,y:(1-projected.y)*box!.height/2}});
  await expect(page.getByTestId('body-monitoring')).toHaveAttribute('data-region',region);
 }
 await page.screenshot({path:'../qa-evidence/body-monitoring/canvas-eye-selection.png',fullPage:true});
});
