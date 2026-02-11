import {chromium} from 'patchright';
import fs from 'fs-extra';

(async () => {
  const url = process.argv[2];

  if (!url) {
    console.log("Usage: node scraper.js <linkedin_profile_url>");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded",
    timeout: 6000
   });

  // Close popup by pressing Escape key
try {
  await page.mouse.click(100,100);  
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
}
  catch {
    console.log("No popup detected");
  }

  // Extract data
  const data = await page.evaluate(() => {
    const text = (sel) =>
      document.querySelector(sel)?.innerText.trim() || null;
  
    const texts = (sel) =>
      [...document.querySelectorAll(sel)].map(e => e.innerText.trim());
  
    return {
      name: text("h1.top-card-layout__title"),
      headline: text("h2.top-card-layout__headline"),
      location: text(".profile-info-subheader span"),
      followers_and_connections: texts(".not-first-middot span"),
      about: text(".core-section-container__content p")
      //experience: text
      //Education: 
    };
  });
  

  //await fs.writeJson("profile.json", data, { spaces: 2 });
  //console.log(data);
  //console.log("Saved to profile.json");
  const filePath = "profile.json";

let existingData = [];

// Step 1: Check if file exists
if (await fs.pathExists(filePath)) {
  existingData = await fs.readJson(filePath);
}

// Step 2: Ensure it's an array
if (!Array.isArray(existingData)) {
  existingData = [existingData];
}

// Step 3: Append new profile
existingData.push(data);

// Step 4: Save back
await fs.writeJson(filePath, existingData, { spaces: 2 });

console.log("Profile appended to profile.json");

  await browser.close();
})();
