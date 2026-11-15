import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route('**/piper/synthesize', route => route.fulfill({ status: 503 }));
});

test('handoff assistant follows selected crew and saves confirmed demo check-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crew B', exact: true }).click();
  await page.getByRole('button', { name: 'Open MEDNAV offline voice assistant' }).click();
  const assistant = page.getByRole('region', { name: 'MEDNAV voice assistant' });
  await expect(assistant).toContainText('CREW Crew B');
  await assistant.getByRole('button', { name: 'Health Check', exact: true }).click();
  await expect(assistant).toContainText('QUESTION: SYMPTOMS');
  const input = assistant.getByRole('textbox', { name: 'Test voice command by typing' });
  const answer = async (value: string) => {
    await input.fill(value);
    await assistant.getByRole('button', { name: 'Send typed command' }).click();
  };
  await answer('headache');
  await answer('today');
  await answer('82 bpm.');
  await answer('5');
  await answer('not measured');
  await expect(assistant).toContainText('Confirmation required before saving');
  await answer('yes');
  await expect(assistant).toContainText('Last saved check-in: voice-demo-1');
  await expect(page.getByRole('region', { name: 'Crew telemetry summary' })).toContainText('82 bpm');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.locator('.vital-copy strong').first()).toContainText('82');
});

test('local tiny Faster-Whisper model is ready', async ({ request }) => {
  const response = await request.get('/api/v1/voice/status');
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).model).toBe('Systran/faster-whisper-tiny.en');
});

test('assistant can read the current investigation result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open MEDNAV offline voice assistant' }).click();
  const assistant = page.getByRole('region', { name: 'MEDNAV voice assistant' });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Investigation' }).click();
  const input = assistant.getByRole('textbox', { name: 'Test voice command by typing' });
  await input.fill('Read my recommendation');
  await assistant.getByRole('button', { name: 'Send typed command' }).click();
  await expect(assistant.locator('.voice-response')).toContainText('Synthetic demo');
  await expect(assistant.locator('.voice-response')).toContainText('Medical officer review is required');
});

test('tiny Faster-Whisper wake phrase produces a Piper reply', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    (window as any).AudioContext = class {
      sampleRate = 16000; state = 'running'; destination = {};
      resume() { return Promise.resolve(); }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() {
        const processor: any = { onaudioprocess: null, connect() {}, disconnect() {} };
        setInterval(() => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(.1) } }), 100);
        return processor;
      }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    };
  });
  let wavBytes = 0;
  await page.route('**/api/v1/voice/transcribe?segment_mode=true', async route => {
    const body = route.request().postDataBuffer();
    wavBytes = body?.length ?? 0;
    expect(body?.subarray(0, 4).toString()).toBe('RIFF');
    await route.fulfill({ json: { text: 'Hey MEDNAV' } });
  });
  await page.goto('/');
  const assistant = page.getByRole('region', { name: 'MEDNAV voice assistant' });
  await expect(assistant.locator('.voice-response')).toContainText('Hello, astronaut Crew A', { timeout: 15000 });
  expect(wavBytes).toBeGreaterThan(1600);
  await expect(assistant).toContainText('LISTENING');
  await expect(assistant.getByRole('button', { name: /microphone/i })).toHaveCount(0);
});

test('Health Check starts while the microphone remains enabled', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    (window as any).AudioContext = class {
      sampleRate = 16000; state = 'running'; destination = {};
      resume() { return Promise.resolve(); }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() {
        const processor: any = { onaudioprocess: null, connect() {}, disconnect() {} };
        setInterval(() => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(.1) } }), 100);
        return processor;
      }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    };
  });
  await page.route('**/api/v1/voice/transcribe?segment_mode=true', route => route.fulfill({ json: { text: 'Health Check' } }));
  await page.goto('/');
  const assistant = page.getByRole('region', { name: 'MEDNAV voice assistant' });
  await expect(assistant).toContainText('QUESTION: SYMPTOMS', { timeout: 15000 });
  await expect(assistant.locator('.voice-response')).toContainText('symptoms');
  await expect(assistant).toContainText('LISTENING FOR ANSWER');
});

test('Stop releases the microphone and Voice AI starts a new session', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).microphoneStops = 0;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() { (window as any).microphoneStops++; } }] }) } });
    (window as any).AudioContext = class {
      sampleRate = 16000; state = 'running'; destination = {};
      resume() { return Promise.resolve(); }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() {
        const processor: any = { onaudioprocess: null, connect() {}, disconnect() {} };
        setInterval(() => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(.1) } }), 100);
        return processor;
      }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    };
  });
  let calls = 0;
  await page.route('**/api/v1/voice/transcribe?segment_mode=true', route => route.fulfill({ json: { text: ++calls === 1 ? 'Hey MEDNAV' : 'Stop' } }));
  await page.goto('/');
  const assistant = page.getByRole('region', { name: 'MEDNAV voice assistant' });
  await expect(assistant.locator('.voice-response')).toContainText('Hello, astronaut Crew A', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Open MEDNAV offline voice assistant' })).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => (window as any).microphoneStops)).toBeGreaterThan(0);
  expect(calls).toBe(2);
  await page.getByRole('button', { name: 'Open MEDNAV offline voice assistant' }).click();
  await expect(assistant.locator('.voice-response')).toContainText('Listening. Say “Hey MEDNAV”', { timeout: 15000 });
});
