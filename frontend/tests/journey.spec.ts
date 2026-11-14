import {test,expect} from '@playwright/test';
test('explicit fixture mode retains check-in validation',async({page})=>{
 await page.goto('/?mode=fixture');await expect(page.getByRole('status').first()).toContainText('LOCAL FIXTURE');
 await page.getByRole('button',{name:'Health Check-In',exact:true}).click();await expect(page.getByLabel('Heart rate (bpm)',{exact:true})).toBeVisible();
 await page.getByLabel('Systolic (mmHg)',{exact:true}).fill('120');await page.getByLabel('Diastolic (mmHg)',{exact:true}).fill('');await page.getByRole('button',{name:'Review Check-In',exact:true}).click();await expect(page.getByRole('alert')).toContainText('both');
});
test('fixture inventory local edit remains available',async({page})=>{
 await page.goto('/?mode=fixture');await page.getByRole('button',{name:'Medical Inventory',exact:true}).click();await page.getByLabel('Search equipment').fill('Blood-pressure');
 await expect(page.locator('.equipment-hairline-row')).toHaveCount(1);await page.locator('.equipment-hairline-row button').click();await expect(page.locator('.equipment-hairline-row')).toContainText('Usable');
});
test('desktop and mobile shell retain responsive layout',async({page})=>{
 await page.goto('/?mode=fixture');await page.setViewportSize({width:1440,height:900});await expect(page.locator('.sidebar')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'tests/integration-mobile.png',fullPage:true});
});
