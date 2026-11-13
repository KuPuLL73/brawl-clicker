import {chromium} from '@playwright/test';
const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1440,height:720}});
await p.goto('http://127.0.0.1:5180/');
const keys=['bull','rico','poco','darryl','carl','rosa','frank','mortis','bibi','max','spike','surge'];
await p.setContent(`<body style="margin:0;background:#152653;color:white;font:700 16px sans-serif;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:12px">${keys.map((k,i)=>`<figure style="margin:0;display:flex;flex-direction:column;align-items:center;background:#244278;border-radius:15px;padding:10px"><img style="width:100%;height:285px;object-fit:contain" src="http://127.0.0.1:5180/art/bosses/${k}.png"><figcaption>${i+1}. ${k}</figcaption></figure>`).join('')}</body>`);
await p.waitForLoadState('networkidle');await p.screenshot({path:'artifacts/boss-roster.jpg'});await browser.close();
