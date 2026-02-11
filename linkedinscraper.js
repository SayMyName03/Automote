#!/usr/bin/env node

/**
 * LinkedIn Public Profile Scraper
 * 
 * Extracts publicly available information from LinkedIn profiles using Patchright.
 * Only extracts data visible to logged-out users (no authentication required).
 * 
 * Usage:
 *   node linkedinscraper.js <linkedin_profile_url>
 *   
 * Example:
 *   node linkedinscraper.js https://www.linkedin.com/in/username/
 * 
 * Environment Variables:
 *   HEADLESS=true|false - Run in headless mode (default: false)
 *   MAX_RETRIES=n - Maximum retry attempts on auth wall (default: 3)
 *   TIMEOUT=n - Page load timeout in ms (default: 30000)
 */

import { chromium } from 'patchright';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  HEADLESS: process.env.HEADLESS === 'true' || false,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES, 10) || 3,
  TIMEOUT: parseInt(process.env.TIMEOUT, 10) || 30000,
  NAVIGATION_TIMEOUT: parseInt(process.env.NAVIGATION_TIMEOUT, 10) || 60000,
  OUTPUT_FILE: process.env.OUTPUT_FILE || 'linkedin_public_profile.json',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Logger utility for structured logging
 */
class Logger {
  static info(message) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }

  static error(message) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  }

  static debug(message) {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
    }
  }

  static success(message) {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`);
  }

  static warn(message) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  }
}

/**
 * Starts a new browser instance with stealth settings
 * @returns {Promise<Object>} Browser instance
 */
async function startBrowser() {
  Logger.info('Starting browser instance...');
  
  const browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  Logger.success('Browser instance started');
  return browser;
}

/**
 * Creates a new browser context with stealth settings
 * @param {Object} browser - Browser instance
 * @returns {Promise<Object>} Browser context
 */
async function createContext(browser) {
  Logger.debug('Creating browser context...');
  
  const context = await browser.newContext({
    userAgent: CONFIG.USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: [],
    bypassCSP: true
  });

  // Add additional stealth measures
  await context.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
  });

  Logger.debug('Browser context created with stealth settings');
  return context;
}

/**
 * Navigates to the LinkedIn profile URL
 * @param {Object} page - Page instance
 * @param {string} url - LinkedIn profile URL
 * @returns {Promise<boolean>} Success status
 */
async function navigateToProfile(page, url) {
  Logger.info(`Navigating to: ${url}`);
  
  try {
    // Set default timeout
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    page.setDefaultNavigationTimeout(CONFIG.NAVIGATION_TIMEOUT);
    
    // Navigate with waitUntil
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: CONFIG.NAVIGATION_TIMEOUT
    });

    if (!response) {
      throw new Error('No response received from page');
    }

    Logger.info(`Page loaded with status: ${response.status()}`);
    
    // Wait a bit for any client-side rendering
    await page.waitForTimeout(3000);
    
    return true;
  } catch (error) {
    Logger.error(`Navigation failed: ${error.message}`);
    return false;
  }
}

/**
 * Detects if LinkedIn is showing an authentication wall
 * @param {Object} page - Page instance
 * @returns {Promise<boolean>} True if auth wall detected
 */
async function detectAuthWall(page) {
  Logger.debug('Checking for authentication wall...');
  
  const authIndicators = [
    // URL patterns
    page.url().includes('/authwall'),
    page.url().includes('/checkpoint'),
    page.url().includes('/login'),
    
    // DOM selectors that indicate auth wall
    await page.locator('.authwall-join-form').count() > 0,
    await page.locator('[data-test-id="auth-wall"]"').count() > 0,
    await page.locator('.join-form').count() > 0,
    await page.locator('.sign-in-form').count() > 0,
    await page.locator('form[action*="login"]').count() > 0,
    
    // Text indicators
    await page.locator('text=/sign in to view/i').count() > 0,
    await page.locator('text=/join now to view/i').count() > 0,
    await page.locator('text=/auth/i').count() > 0,
    
    // Title check
    (await page.title()).toLowerCase().includes('sign in'),
    (await page.title()).toLowerCase().includes('log in'),
    (await page.title()).toLowerCase().includes('auth')
  ];

  const isAuthWall = authIndicators.some(indicator => indicator);
  
  if (isAuthWall) {
    Logger.warn('Authentication wall detected!');
  } else {
    Logger.debug('No authentication wall detected');
  }
  
  return isAuthWall;
}

/**
 * Closes any popup/modal dialogs on the page
 * @param {Object} page - Page instance
 */
async function closePopups(page) {
  Logger.info('Checking for popups and modals...');
  
  let popupClosed = false;
  
  // PRIMARY: Handle "View full profile" popup specifically
  try {
    Logger.debug('Looking for "View full profile" popup...');
    
    // Try to find the popup by text content
    const viewFullProfilePopup = await page.locator('text=/view.*full.*profile/i').first();
    if (await viewFullProfilePopup.count() > 0) {
      const isVisible = await viewFullProfilePopup.isVisible({ timeout: 2000 });
      if (isVisible) {
        Logger.info('Found "View full profile" popup - looking for close button...');
        
        // Look for close button in the same modal/dialog
        const closeButton = await page.locator('[role="dialog"] button, .artdeco-modal__dismiss, .artdeco-modal button').first();
        if (await closeButton.count() > 0 && await closeButton.isVisible({ timeout: 2000 })) {
          await closeButton.click({ timeout: 5000 });
          Logger.success('"View full profile" popup closed');
          popupClosed = true;
          await page.waitForTimeout(1000);
          return popupClosed;
        }
        
        // Try Escape key if close button not found
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        Logger.success('"View full profile" popup closed with Escape key');
        popupClosed = true;
        return popupClosed;
      }
    }
  } catch (error) {
    Logger.debug(`"View full profile" popup handling failed: ${error.message}`);
  }
  
  // Try the specific LinkedIn dismiss button pattern
  try {
    Logger.debug('Looking for Dismiss button with role...');
    const dismissButton = page.getByRole('button', { name: 'Dismiss' });
    const count = await dismissButton.count();
    
    if (count > 0) {
      const isVisible = await dismissButton.isVisible({ timeout: 2000 });
      if (isVisible) {
        Logger.info('Found Dismiss button - clicking...');
        await dismissButton.click({ timeout: 5000 });
        Logger.success('Dismiss button clicked successfully');
        popupClosed = true;
        await page.waitForTimeout(1000);
        return popupClosed;
      }
    }
  } catch (error) {
    Logger.debug(`Dismiss button not found or not clickable: ${error.message}`);
  }
  
  // SECONDARY: Try other common popup close patterns
  const closeButtonSelectors = [
    // Common close buttons
    'button[aria-label="Dismiss"]',
    'button[aria-label="Close"]',
    '[aria-label="Dismiss"]',
    '[aria-label="Close"]',
    
    // LinkedIn specific
    '.artdeco-modal__dismiss',
    '.artdeco-modal__close-btn',
    '.artdeco-dismiss',
    '[data-test-modal-close-btn]',
    '[data-control-name="close_modal"]',
    '.modal-close-btn',
    
    // Generic
    '.modal .close',
    '.modal-close',
    '[class*="close"][class*="modal"]',
    '[class*="dismiss"]',
    
    // SVG/icon buttons
    'button svg[data-test-icon="close-small"]',
    'button svg[data-test-icon="close"]',
    'button:has(svg)',
    
    // Dialog close
    'dialog button',
    '[role="dialog"] button',
    '[role="alertdialog"] button'
  ];
  
  for (const selector of closeButtonSelectors) {
    try {
      const elements = await page.locator(selector).all();
      
      for (const element of elements) {
        try {
          // Check if element is visible
          const isVisible = await element.isVisible({ timeout: 1000 });
          
          if (isVisible) {
            Logger.info(`Found popup close button: ${selector}`);
            await element.click({ timeout: 5000 });
            Logger.success('Popup closed successfully');
            popupClosed = true;
            
            // Wait for popup to close
            await page.waitForTimeout(1000);
            
            // Only close one popup at a time
            return popupClosed;
          }
        } catch {
          // Element not interactable, continue
        }
      }
    } catch {
      // Selector not found, continue to next
    }
  }
  
  // Try pressing Escape key as fallback
  if (!popupClosed) {
    try {
      Logger.debug('Trying to close popup with Escape key...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // Check if any modals are still present
      const modalCount = await page.locator('[role="dialog"], .artdeco-modal, .modal').count();
      if (modalCount === 0) {
        Logger.success('Popup closed with Escape key');
        popupClosed = true;
      }
    } catch (error) {
      Logger.debug(`Escape key failed: ${error.message}`);
    }
  }
  
  if (!popupClosed) {
    Logger.debug('No popups found to close');
  }
  
  return popupClosed;
}

/**
 * Scrolls down the page to load more content
 * @param {Object} page - Page instance
 * @param {number} scrollCount - Number of times to scroll (default: 5)
 */
async function scrollPage(page, scrollCount = 5) {
  Logger.info(`Scrolling page ${scrollCount} times to load more content...`);
  
  for (let i = 0; i < scrollCount; i++) {
    try {
      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.8);
      });
      
      // Wait for content to load
      await page.waitForTimeout(1500);
      
      Logger.debug(`Scroll ${i + 1}/${scrollCount} completed`);
      
      // Check if we've reached the bottom
      const isAtBottom = await page.evaluate(() => {
        return (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 100;
      });
      
      if (isAtBottom) {
        Logger.info('Reached bottom of page');
        break;
      }
    } catch (error) {
      Logger.debug(`Scroll ${i + 1} failed: ${error.message}`);
    }
  }
  
  Logger.success('Page scrolling completed');
}

/**
 * Extracts meta tags from HTML content
 * @param {string} html - HTML content
 * @returns {Object} Extracted meta tags
 */
function extractMetaTags(html) {
  Logger.debug('Extracting meta tags...');
  
  const meta = {
    title: '',
    description: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    ogUrl: '',
    ogType: ''
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    meta.title = cleanText(titleMatch[1]);
    Logger.debug(`Found title: ${meta.title}`);
  }

  // Extract meta description
  const descPatterns = [
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i
  ];
  
  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match) {
      meta.description = cleanText(match[1]);
      Logger.debug(`Found meta description: ${meta.description.substring(0, 80)}...`);
      break;
    }
  }

  // Extract Open Graph tags
  const ogPatterns = {
    ogTitle: /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    ogDescription: /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    ogImage: /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    ogUrl: /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    ogType: /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']*)["'][^>]*>/i
  };

  for (const [key, pattern] of Object.entries(ogPatterns)) {
    const match = html.match(pattern);
    if (match) {
      meta[key] = cleanText(match[1]);
      Logger.debug(`Found ${key}: ${meta[key].substring(0, 80)}`);
    }
  }

  return meta;
}

/**
 * Extracts JSON-LD structured data from HTML
 * @param {string} html - HTML content
 * @returns {Array} Array of structured data objects
 */
function extractJsonLd(html) {
  Logger.debug('Extracting JSON-LD structured data...');
  
  const structuredData = [];
  const jsonLdRegex = /<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);
      
      if (data['@type'] === 'Person' || data['@type'] === 'ProfilePage') {
        structuredData.push(data);
        Logger.debug(`Found JSON-LD @type: ${data['@type']}`);
      }
    } catch (error) {
      Logger.debug(`Failed to parse JSON-LD: ${error.message}`);
    }
  }

  Logger.debug(`Extracted ${structuredData.length} relevant JSON-LD objects`);
  return structuredData;
}

/**
 * Extracts experience data from the page
 * @param {Object} page - Page instance
 * @returns {Promise<Array>} Array of experience entries
 */
async function extractExperience(page) {
  Logger.info('Extracting experience data...');
  
  const experiences = [];
  
  try {
    // Try multiple selectors for experience sections
    const experienceSelectors = [
      '#experience ~ .pvs-list__outer-container .pvs-entity',
      '.experience-section .pvs-entity',
      '[data-section="experience"] .pvs-entity',
      '.pv-profile-section--experience .pvs-entity',
      '#experience-section .pvs-entity'
    ];
    
    for (const selector of experienceSelectors) {
      const elements = await page.locator(selector).all();
      
      if (elements.length > 0) {
        Logger.debug(`Found ${elements.length} experience entries with selector: ${selector}`);
        
        for (const element of elements) {
          try {
            const experience = {};
            
            // Try to get title
            const titleEl = await element.locator('.t-bold, .hoverable-link-text, .mr1').first();
            if (await titleEl.count() > 0) {
              experience.title = cleanText(await titleEl.textContent());
            }
            
            // Try to get company
            const companyEl = await element.locator('.t-14.t-normal, .hoverable-link-text span').first();
            if (await companyEl.count() > 0) {
              const companyText = cleanText(await companyEl.textContent());
              // Sometimes company and employment type are together
              if (companyText.includes('·')) {
                const parts = companyText.split('·').map(p => p.trim());
                experience.company = parts[0];
                experience.employment_type = parts[1];
              } else {
                experience.company = companyText;
              }
            }
            
            // Try to get duration
            const durationEl = await element.locator('.pvs-entity__caption-wrapper, .t-14.t-normal.t-black--light').first();
            if (await durationEl.count() > 0) {
              const durationText = cleanText(await durationEl.textContent());
              if (durationText.includes('·')) {
                const parts = durationText.split('·').map(p => p.trim());
                experience.duration = parts[0];
                experience.location = parts[1];
              } else {
                experience.duration = durationText;
              }
            }
            
            if (experience.title || experience.company) {
              experiences.push(experience);
            }
          } catch (e) {
            Logger.debug(`Error extracting experience entry: ${e.message}`);
          }
        }
        
        if (experiences.length > 0) {
          break; // Found experiences, no need to try other selectors
        }
      }
    }
  } catch (error) {
    Logger.debug(`Experience extraction failed: ${error.message}`);
  }
  
  Logger.success(`Extracted ${experiences.length} experience entries`);
  return experiences;
}

/**
 * Extracts education data from the page
 * @param {Object} page - Page instance
 * @returns {Promise<Array>} Array of education entries
 */
async function extractEducation(page) {
  Logger.info('Extracting education data...');
  
  const educations = [];
  
  try {
    // Try multiple selectors for education sections
    const educationSelectors = [
      '#education ~ .pvs-list__outer-container .pvs-entity',
      '.education-section .pvs-entity',
      '[data-section="education"] .pvs-entity',
      '.pv-profile-section--education .pvs-entity',
      '#education-section .pvs-entity'
    ];
    
    for (const selector of educationSelectors) {
      const elements = await page.locator(selector).all();
      
      if (elements.length > 0) {
        Logger.debug(`Found ${elements.length} education entries with selector: ${selector}`);
        
        for (const element of elements) {
          try {
            const education = {};
            
            // Try to get school/institution
            const schoolEl = await element.locator('.t-bold, .hoverable-link-text').first();
            if (await schoolEl.count() > 0) {
              education.school = cleanText(await schoolEl.textContent());
            }
            
            // Try to get degree
            const degreeEl = await element.locator('.t-14.t-normal span').first();
            if (await degreeEl.count() > 0) {
              const degreeText = cleanText(await degreeEl.textContent());
              if (degreeText.includes('·')) {
                const parts = degreeText.split('·').map(p => p.trim());
                education.degree = parts[0];
                education.field_of_study = parts[1];
              } else {
                education.degree = degreeText;
              }
            }
            
            // Try to get dates
            const datesEl = await element.locator('.pvs-entity__caption-wrapper, .t-14.t-normal.t-black--light').first();
            if (await datesEl.count() > 0) {
              education.dates = cleanText(await datesEl.textContent());
            }
            
            if (education.school) {
              educations.push(education);
            }
          } catch (e) {
            Logger.debug(`Error extracting education entry: ${e.message}`);
          }
        }
        
        if (educations.length > 0) {
          break; // Found educations, no need to try other selectors
        }
      }
    }
  } catch (error) {
    Logger.debug(`Education extraction failed: ${error.message}`);
  }
  
  Logger.success(`Extracted ${educations.length} education entries`);
  return educations;
}

/**
 * Extracts public profile data from the page
 * @param {Object} page - Page instance
 * @param {string} html - HTML content
 * @returns {Object} Extracted profile data
 */
async function extractPublicProfileData(page, html) {
  Logger.info('Extracting public profile data...');
  
  const profileData = {
    name: '',
    headline: '',
    location: '',
    about: '',
    profile_image: '',
    title: '',
    meta_description: '',
    experience: [],
    education: []
  };

  // Extract meta tags
  const meta = extractMetaTags(html);
  profileData.title = meta.title;
  profileData.meta_description = meta.description;

  // Try to get name from various sources
  if (meta.ogTitle) {
    profileData.name = meta.ogTitle;
    Logger.debug(`Name from og:title: ${profileData.name}`);
  } else if (meta.title) {
    // Often LinkedIn titles are like "John Doe - Software Engineer | LinkedIn"
    const titleParts = meta.title.split(/[\|\-–—]/);
    if (titleParts.length > 0) {
      profileData.name = cleanText(titleParts[0]);
      Logger.debug(`Name from title: ${profileData.name}`);
    }
  }

  // Extract headline from og:description or meta description
  if (meta.ogDescription) {
    profileData.headline = meta.ogDescription;
    Logger.debug(`Headline from og:description: ${profileData.headline.substring(0, 80)}...`);
  } else if (meta.description) {
    profileData.headline = meta.description;
  }

  // Extract profile image
  if (meta.ogImage) {
    profileData.profile_image = meta.ogImage;
    Logger.debug(`Profile image from og:image: ${profileData.profile_image}`);
  }

  // Try to extract from page content using selectors
  try {
    // Name from h1
    const h1Text = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => '');
    if (h1Text && !profileData.name) {
      profileData.name = cleanText(h1Text);
      Logger.debug(`Name from h1: ${profileData.name}`);
    }

    // Look for common LinkedIn profile selectors
    const selectors = {
      name: [
        '.top-card-layout__title',
        '.profile-card__name',
        '[data-test-id="profile-card-name"]',
        '.artdeco-entity-lockup__title'
      ],
      headline: [
        '.top-card-layout__headline',
        '.profile-card__headline',
        '[data-test-id="profile-card-headline"]',
        '.artdeco-entity-lockup__subtitle'
      ],
      location: [
        '.top-card-layout__first-subline',
        '.profile-card__location',
        '[data-test-id="profile-card-location"]'
      ],
      about: [
        '.core-section-container__content',
        '.about-section',
        '[data-section="summary"]'
      ]
    };

    // Try each selector
    for (const [field, selectorList] of Object.entries(selectors)) {
      for (const selector of selectorList) {
        try {
          const element = page.locator(selector).first();
          const text = await element.textContent({ timeout: 2000 });
          if (text && !profileData[field]) {
            profileData[field] = cleanText(text);
            Logger.debug(`${field} from selector ${selector}: ${profileData[field].substring(0, 80)}`);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }
    }

  } catch (error) {
    Logger.debug(`Error extracting from selectors: ${error.message}`);
  }

  // Extract JSON-LD data
  const structuredData = extractJsonLd(html);
  
  for (const data of structuredData) {
    if (data.name && !profileData.name) {
      profileData.name = data.name;
      Logger.debug(`Name from JSON-LD: ${profileData.name}`);
    }
    if (data.jobTitle && !profileData.headline) {
      profileData.headline = data.jobTitle;
      Logger.debug(`Headline from JSON-LD: ${profileData.headline}`);
    }
    if (data.description && !profileData.about) {
      profileData.about = data.description;
      Logger.debug(`About from JSON-LD: ${profileData.about.substring(0, 80)}...`);
    }
    if (data.image && !profileData.profile_image) {
      profileData.profile_image = typeof data.image === 'string' ? data.image : data.image.url;
      Logger.debug(`Profile image from JSON-LD`);
    }
    if (data.address?.addressLocality && !profileData.location) {
      profileData.location = data.address.addressLocality;
      Logger.debug(`Location from JSON-LD: ${profileData.location}`);
    }
    if (data.address?.addressRegion && profileData.location) {
      profileData.location += `, ${data.address.addressRegion}`;
    }
    if (data.address?.addressCountry && profileData.location) {
      profileData.location += `, ${data.address.addressCountry}`;
    }
  }

  // Extract experience and education after scrolling
  profileData.experience = await extractExperience(page);
  profileData.education = await extractEducation(page);

  // Log extraction summary
  Logger.info('Extraction summary:');
  Object.entries(profileData).forEach(([key, value]) => {
    if (value && key !== 'experience' && key !== 'education') {
      Logger.success(`  ✓ ${key}: ${value.substring(0, 60)}${value.length > 60 ? '...' : ''}`);
    } else if (key === 'experience' || key === 'education') {
      if (Array.isArray(value) && value.length > 0) {
        Logger.success(`  ✓ ${key}: ${value.length} entries found`);
      } else {
        Logger.warn(`  ✗ ${key}: Not found`);
      }
    } else {
      Logger.warn(`  ✗ ${key}: Not found`);
    }
  });

  return profileData;
}

/**
 * Cleans and normalizes text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#\d+;/g, (match) => {
      try {
        return String.fromCharCode(parseInt(match.replace(/&#|;/g, ''), 10));
      } catch {
        return match;
      }
    })
    .replace(/&#x[0-9a-f]+;/gi, (match) => {
      try {
        return String.fromCharCode(parseInt(match.replace(/&#x|;/g, ''), 16));
      } catch {
        return match;
      }
    })
    .trim();
}

/**
 * Saves data to JSON file
 * @param {Object} data - Data to save
 */
async function saveToJson(data) {
  try {
    const outputPath = path.resolve(CONFIG.OUTPUT_FILE);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    Logger.success(`Data saved to: ${outputPath}`);
  } catch (error) {
    Logger.error(`Failed to save data: ${error.message}`);
  }
}

/**
 * Main scraping function with retry logic
 * @param {string} profileUrl - LinkedIn profile URL
 */
async function scrapeLinkedInProfile(profileUrl) {
  Logger.info('='.repeat(70));
  Logger.info('LinkedIn Public Profile Scraper');
  Logger.info('='.repeat(70));
  Logger.info(`Target URL: ${profileUrl}`);
  Logger.info(`Headless mode: ${CONFIG.HEADLESS}`);
  Logger.info(`Max retries: ${CONFIG.MAX_RETRIES}`);
  Logger.info('='.repeat(70));

  let browser = null;
  let retryCount = 0;
  let success = false;
  let finalData = null;

  while (retryCount < CONFIG.MAX_RETRIES && !success) {
    if (retryCount > 0) {
      Logger.warn(`\nRetry attempt ${retryCount}/${CONFIG.MAX_RETRIES}...`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
    }

    try {
      // Start browser
      browser = await startBrowser();
      
      // Create context
      const context = await createContext(browser);
      
      // Create new page
      const page = await context.newPage();
      
      // Navigate to profile
      const navigated = await navigateToProfile(page, profileUrl);
      
      if (!navigated) {
        throw new Error('Failed to navigate to profile');
      }

      // Close any popups/modals
      await closePopups(page);

      // Check for auth wall
      const isAuthWall = await detectAuthWall(page);
      
      if (isAuthWall) {
        Logger.warn('Authentication wall detected, closing browser and retrying...');
        await browser.close();
        browser = null;
        retryCount++;
        continue;
      }

      // Close any popups again (especially "View full profile" popup)
      await closePopups(page);
      
      // Scroll down to load more content (experience, education sections)
      await scrollPage(page, 5);
      
      // Close any popups that might have appeared after scrolling
      await closePopups(page);

      // Get page content
      Logger.info('Retrieving page content...');
      const html = await page.content();
      
      if (!html || html.length < 100) {
        throw new Error('Retrieved HTML content is too short or empty');
      }

      Logger.info(`Retrieved ${html.length} characters of HTML`);

      // Extract profile data
      const profileData = await extractPublicProfileData(page, html);
      
      // Prepare output
      finalData = {
        profile_url: profileUrl,
        scraped_at: new Date().toISOString(),
        public_data: profileData,
        structured_data: extractJsonLd(html),
        metadata: {
          html_length: html.length,
          retry_count: retryCount,
          headless: CONFIG.HEADLESS,
          user_agent: CONFIG.USER_AGENT
        }
      };

      // Save to file
      await saveToJson(finalData);
      
      success = true;
      
      // Print to console
      Logger.info('\n' + '='.repeat(70));
      Logger.info('EXTRACTED DATA');
      Logger.info('='.repeat(70));
      console.log(JSON.stringify(finalData, null, 2));
      Logger.info('='.repeat(70));

    } catch (error) {
      Logger.error(`Error during scraping: ${error.message}`);
      Logger.debug(error.stack);
      
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
      
      retryCount++;
    }
  }

  // Cleanup
  if (browser) {
    Logger.info('Closing browser...');
    await browser.close();
  }

  // Final status
  Logger.info('\n' + '='.repeat(70));
  if (success) {
    Logger.success('SCRAPING COMPLETED SUCCESSFULLY!');
    Logger.info(`Output file: ${CONFIG.OUTPUT_FILE}`);
    return finalData;
  } else {
    Logger.error('SCRAPING FAILED AFTER MAX RETRIES');
    throw new Error('Failed to scrape profile after maximum retry attempts');
  }
}

/**
 * Validates LinkedIn profile URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidLinkedInUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com') && 
           (parsed.pathname.includes('/in/') || parsed.pathname.includes('/pub/'));
  } catch {
    return false;
  }
}

/**
 * Main entry point
 */
async function main() {
  const profileUrl = process.argv[2];

  // Validate input
  if (!profileUrl) {
    console.error('\nError: Please provide a LinkedIn profile URL\n');
    console.error('Usage: node linkedinscraper.js <linkedin_profile_url>');
    console.error('Example: node linkedinscraper.js https://www.linkedin.com/in/username/\n');
    console.error('Environment Variables:');
    console.error('  HEADLESS=true|false    Run in headless mode (default: false)');
    console.error('  MAX_RETRIES=n          Maximum retry attempts (default: 3)');
    console.error('  TIMEOUT=n              Page load timeout in ms (default: 30000)');
    console.error('  DEBUG=true|false       Enable debug logging (default: false)');
    process.exit(1);
  }

  if (!isValidLinkedInUrl(profileUrl)) {
    console.error('\nError: Invalid LinkedIn profile URL\n');
    console.error('URL must be a valid LinkedIn profile URL (e.g., https://www.linkedin.com/in/username/)\n');
    process.exit(1);
  }

  try {
    await scrapeLinkedInProfile(profileUrl);
    process.exit(0);
  } catch (error) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

// Run main
main();
