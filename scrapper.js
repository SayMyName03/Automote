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

      const parseOneLineExperience = (arr) => {
        return arr.map(item => {
          // Normalize spacing
          const text = item.replace(/\s+/g, " ").trim();
      
          const durationMatch = text.match(
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s?\d{4}\s-\s(Present|\w+\s?\d{4})/
          );
      
          const duration = durationMatch ? durationMatch[0] : null;
      
          // Match total time like "1 year 2 months"
          const totalTimeMatch = text.match(/\d+\s+year[s]?\s*\d*\s*month[s]?/i);
          const total_time = totalTimeMatch ? totalTimeMatch[0] : null;
      
          // Remove duration + time from original string
          let clean = text
            .replace(duration || "", "")
            .replace(total_time || "", "")
            .trim();
      
          // First word(s) = role
          const words = clean.split(" ");
      
          // Heuristic:
          // Role is usually first 1–3 words until capitalized company starts
          let role = words[0];
          let company = words.slice(1).join(" ");
      
          // Better split: detect first capitalized company phrase
          const parts = clean.split(" ");
          let splitIndex = 1;
      
          for (let i = 1; i < parts.length; i++) {
            if (parts[i][0] === parts[i][0].toUpperCase()) {
              splitIndex = i;
              break;
            }
          }
      
          role = parts.slice(0, splitIndex).join(" ");
          company = parts.slice(splitIndex).join(" ");
      
          return {
            role,
            company,
            duration,
            total_time
          };
        });
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
      experience: parseOneLineExperience(
        getSectionByHeading("Experience")),
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
