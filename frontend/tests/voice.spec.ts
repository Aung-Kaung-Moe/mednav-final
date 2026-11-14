import {test,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
test.use({permissions:['microphone'],launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${path.resolve('../.demo-runtime/voice-checkin.wav')}`]}});
async function recordSpeech(page:import('@playwright/test').Page){
 await page.getByRole('button',{name:'Record Voice',exact:true}).click();
 await expect(page.getByRole('button',{name:/Stop \(/})).toBeVisible();
 await page.waitForTimeout(6500);
 const response=page.waitForResponse(r=>r.url().endsWith('/voice/transcribe')&&r.request().method()==='POST');
 await page.getByRole('button',{name:/Stop \(/}).click();
 return response;
}

test('real offline voice: WAV, transcript review, explicit apply, SQLite save and engine',async({page,request})=>{
 test.setTimeout(60000);
 const fixture=path.resolve('../.demo-runtime/voice-checkin.wav');
 expect(fs.existsSync(fixture),'Generate speech with scripts/create-voice-test-wav.ps1').toBeTruthy();
 const status=await request.get('http://127.0.0.1:8000/api/v1/voice/status');
 expect((await status.json()).available).toBe(true);
 const external:string[]=[];
 await page.route('**/*',route=>{
  const host=new URL(route.request().url()).hostname;
  if(host!=='127.0.0.1'&&host!=='localhost'){external.push(host);return route.abort();}
  return route.continue();
 });
 let saves=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/check-ins'))saves++});
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
 const actual=await recordSpeech(page);expect(actual.status()).toBe(200);
 // Edge may evict an inspected response body after the frontend consumes it.
 // Read the actual transcript rendered from that successful POST instead.
 await expect(page.getByLabel('Voice transcript')).toBeVisible();
 const transcript=await page.getByLabel('Voice transcript').inputValue();
 expect(transcript).toContain('heart rate');expect(transcript).toContain('headache');
 await expect(page.getByLabel('Voice transcript')).toHaveValue(transcript);expect(saves).toBe(0);
 // Actual recognizer hears "for hours". The user reviews and corrects the transcript.
 await page.getByLabel('Voice transcript').fill('heart rate eighty eight sleep four hours headache blood pressure unknown');
 await page.getByRole('button',{name:'Apply to Form',exact:true}).click();
 await expect(page.getByLabel('Heart rate (bpm)',{exact:true})).toHaveValue('88');
 await expect(page.getByLabel('Sleep (hours)',{exact:true})).toHaveValue('4');
 expect(saves).toBe(0);
 fs.mkdirSync('../qa-evidence',{recursive:true});
 await page.screenshot({path:'../qa-evidence/unified-voice-review.png',fullPage:true});
 await page.getByRole('button',{name:'Review Check-In',exact:true}).click();
 const saved=page.waitForResponse(r=>r.url().endsWith('/check-ins')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Save Check-In',exact:true}).click();
 const record=await(await saved).json();expect(record.id).toBeTruthy();expect(record.bp).toBeNull();expect(record.hr).toBe(88);expect(record.sleep).toBe(4);
 await page.getByRole('button',{name:'Open Investigation',exact:true}).click();
 await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.reload();await expect(page.getByTestId('backend-status')).toHaveAttribute('data-check-in-id',record.id);
 await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.screenshot({path:'../qa-evidence/unified-live-desktop.png',fullPage:true});
 fs.writeFileSync('../qa-evidence/unified-voice.json',JSON.stringify({transcript,reviewed:true,record,externalBlocked:external},null,2));
});

test('voice unreachable service shows explicit error without saving',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
 await page.route('**/api/v1/voice/transcribe',r=>r.abort());
 await page.getByRole('button',{name:'Record Voice',exact:true}).click();await page.waitForTimeout(1500);
 await page.getByRole('button',{name:/Stop \(/}).click();
 await expect(page.getByRole('alert')).toContainText('Failed to fetch');
 await expect(page.getByLabel('Voice transcript')).toHaveCount(0);
 await page.screenshot({path:'../qa-evidence/unified-voice-error.png',fullPage:true});
});

test.describe('actual browser WAV recorder',()=>{
 test('microphone capture produces supported PCM16 WAV and real transcript',async({page})=>{
  test.setTimeout(60000);
  await page.addInitScript(()=>{
   const original=window.fetch.bind(window);
   window.fetch=async(input,init)=>{
    if(String(input).endsWith('/voice/transcribe')&&init?.body instanceof Blob){
     const bytes=await init.body.arrayBuffer();Object.assign(window,{recordedWavHeader:Array.from(new Uint8Array(bytes.slice(0,44)))});
    }
    return original(input,init);
   };
  });
  await page.goto('/');await expect(page.getByTestId('engine-status')).toHaveAttribute('data-status','needs_review');
  await page.getByRole('button',{name:'Health Check-In',exact:true}).click();
  await page.getByRole('button',{name:'Record Voice',exact:true}).click();
  await expect(page.getByRole('button',{name:/Stop \(/})).toBeVisible();
  await page.waitForTimeout(6500); // Allow the complete synthetic spoken phrase to reach the actual recorder.
  const response=page.waitForResponse(r=>r.url().endsWith('/voice/transcribe')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/Stop \(/}).click();
  const r=await response;expect(r.status()).toBe(200);
  const wav=Buffer.from(await page.evaluate(()=>(window as unknown as {recordedWavHeader:number[]}).recordedWavHeader));
  expect(wav.toString('ascii',0,4)).toBe('RIFF');expect(wav.readUInt32LE(24)).toBe(16000);expect(wav.readUInt16LE(22)).toBe(1);expect(wav.readUInt16LE(34)).toBe(16);
  await expect(page.getByLabel('Voice transcript')).not.toHaveValue('');
 });
});
