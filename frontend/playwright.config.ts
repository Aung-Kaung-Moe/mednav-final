import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
export default defineConfig({testDir:'./tests',globalSetup:'./tests/global-setup.ts',use:{baseURL,channel:'msedge'},webServer:{command:'npm.cmd run dev -- --port 5173',url:baseURL,reuseExistingServer:true},reporter:'list'});
