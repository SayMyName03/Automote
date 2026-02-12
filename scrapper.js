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

    // Extract data
  const data = await page.evaluate(() => {
    const text = (sel) =>
      document.querySelector(sel)?.innerText.trim() || null;
  
    const texts = (sel) =>
      [...document.querySelectorAll(sel)]
        .map(e => e.innerText.trim())
        .filter(Boolean);
  
    // Helper: extract section by heading text
    const getSectionByHeading = (heading) => {
        const headings = [...document.querySelectorAll("h2")];
      
        const target = headings.find(h =>
          h.innerText.trim().toLowerCase() === heading.toLowerCase()
        );
      
        if (!target) return [];
      
        const section = target.closest("section");
        if (!section) return [];
      
        return [...new Set(
          [...section.querySelectorAll("li")]
            .map(e => e.innerText.replace(/\s+/g, " ").trim())
            .filter(t => t.length > 25)
        )];
      };
      
  
    return {
      // BASIC
      name: text("h1.top-card-layout__title"),
      headline: text("h2.top-card-layout__headline"),
      location: text(".profile-info-subheader span"),
      followers_and_connections: texts(".not-first-middot span").slice(0,2),
      about: text(".core-section-container__content p"),
  
      // TOP CARD RIGHT
      current_company: text('[data-section="currentPositionsDetails"] span'),
      education_top: text('[data-section="educationsDetails"] span'),
  
      // DEEP SECTIONS (may or may not exist)
      experience: getSectionByHeading("Experience"),
      education: getSectionByHeading("Education"),
      skills: getSectionByHeading("Skills"),
      activity: getSectionByHeading("Activity"),
      certifications: getSectionByHeading("Certifications"),
      projects: getSectionByHeading("Projects"),
      publications: getSectionByHeading("Publications"),
      honors: getSectionByHeading("Honors"),
      languages: getSectionByHeading("Languages")
    };
  });
  
  
  const filePath = "profile.json";
  console.log(data);
  console.log("Data appended to profile-json")

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
