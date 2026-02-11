/**
 * Web Scraper using Google Rich Results Test - IMPROVED VERSION
 * 
 * This script uses Patchright (Playwright) to extract publicly available
 * user data from webpages using Google Rich Results Test as an intermediate
 * renderer/parser.
 * 
 * Usage: node scraper-improved.js <target_url>
 * Example: node scraper-improved.js https://www.linkedin.com/in/leonardo-chamsin
 */

import { chromium } from 'patchright';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  HEADLESS: false,
  TIMEOUT: 60000,
  OUTPUT_FILE: 'public_user_data.json'
};

async function main() {
  const targetUrl = process.argv[2];
  
  if (!targetUrl) {
    console.error('Error: Please provide a target URL as a command-line argument.');
    console.error('Usage: node scraper-improved.js <target_url>');
    process.exit(1);
  }

  console.log('=' .repeat(60));
  console.log('Rich Results Test Web Scraper - IMPROVED');
  console.log('=' .repeat(60));
  console.log(`Target URL: ${targetUrl}`);
  console.log('=' .repeat(60));

  let browser = null;
  
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: CONFIG.HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(CONFIG.TIMEOUT);
    
    // Step 1: Navigate to Rich Results Test
    console.log('\nNavigating to Google Rich Results Test...');
    await page.goto('https://search.google.com/test/rich-results');
    
    // Step 2: Click the URL input textbox
    console.log('Clicking URL input textbox...');
    await page.getByRole('textbox', { name: 'Enter a URL to test' }).click();
    
    // Step 3: Click again (as in the test)
    await page.getByRole('textbox', { name: 'Enter a URL to test' }).click();
    
    // Step 4: Fill the URL
    console.log(`Filling URL: ${targetUrl}`);
    await page.getByRole('textbox', { name: 'Enter a URL to test' }).fill(targetUrl);
    
    // Step 5: Click Test URL button
    console.log('Clicking Test URL button...');
    await page.getByRole('button', { name: 'test url' }).click();
    
    // Wait for results page to load
    console.log('Waiting for results...');
    await page.waitForURL(/test\/rich-results\/result/);
    
    // Step 6: Click View tested page button
    console.log('Clicking View tested page button...');
    await page.getByRole('button', { name: 'View tested page' }).click();
    
    // Wait for the HTML panel to be visible
    console.log('Waiting for HTML panel to load...');
    await page.waitForTimeout(2000); // Give it time to render
    
    // Make sure HTML tab is selected
    console.log('Ensuring HTML tab is selected...');
    try {
      const htmlTab = page.getByRole('tab', { name: 'HTML' });
      await htmlTab.click();
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('  HTML tab already selected or not found');
    }
    
    // Extract HTML content from the viewer using multiple strategies
    console.log('Extracting HTML content from viewer...');
    const html = await extractHtmlFromViewer(page);
    
    if (!html || html.length < 100) {
      console.error('ERROR: Failed to extract meaningful HTML content!');
      console.log('HTML length:', html ? html.length : 0);
      
      // Debug: Take a screenshot
      await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
      console.log('Debug screenshot saved to: debug-screenshot.png');
      
      // Debug: Try to see what's in the page
      const debugInfo = await page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.innerText.substring(0, 500),
          codeElements: document.querySelectorAll('code, pre').length,
          hasMonacoEditor: !!document.querySelector('.monaco-editor')
        };
      });
      console.log('Debug info:', debugInfo);
      
      throw new Error('Could not extract HTML from the viewer');
    }
    
    // Extract and display user data
    console.log('\n' + '='.repeat(60));
    console.log('EXTRACTING USER DATA FROM HTML');
    console.log('='.repeat(60));
    const userData = extractPublicUserData(html);
    
    // Display extracted data prominently in terminal
    console.log('\n' + '█'.repeat(60));
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█' + ' '.repeat(16) + 'EXTRACTED USER DATA' + ' '.repeat(23) + '█');
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█'.repeat(60));
    console.log('\n📋 USER DATA:\n');
    console.log(JSON.stringify(userData, null, 2));
    console.log('\n' + '█'.repeat(60) + '\n');
    
    // Save results
    const outputData = {
      input_url: targetUrl,
      scraped_at: new Date().toISOString(),
      public_user_data: userData,
      raw_html_length: html.length
    };
    
    await saveToJson(outputData);
    
    // Optionally save the raw HTML for debugging
    fs.writeFileSync('extracted_html.html', html, 'utf8');
    console.log('Raw HTML saved to: extracted_html.html');
    
    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`✓ HTML extracted (${html.length} characters)`);
    console.log(`✓ User data extracted and displayed above`);
    console.log(`✓ Results saved to: ${CONFIG.OUTPUT_FILE}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '!' .repeat(60));
    console.error('Error during scraping:');
    console.error(error.message);
    console.error(error.stack);
    console.error('!' .repeat(60));
    process.exit(1);
  } finally {
    if (browser && CONFIG.HEADLESS) {
      console.log('\nClosing browser...');
      await browser.close();
    } else if (browser) {
      console.log('\nBrowser left open for debugging. Close manually when done.');
    }
  }
}

async function extractHtmlFromViewer(page) {
  console.log('  Trying multiple extraction strategies...');
  
  // Strategy 1: Try to get content from Monaco Editor (Google uses this)
  console.log('  [Strategy 1] Checking for Monaco Editor...');
  try {
    const monacoContent = await page.evaluate(() => {
      const monaco = document.querySelector('.monaco-editor');
      if (monaco) {
        // Try to get the text content from view-lines
        const viewLines = monaco.querySelector('.view-lines');
        if (viewLines) {
          return viewLines.innerText;
        }
        // Fallback to getting all text
        return monaco.innerText;
      }
      return null;
    });
    
    if (monacoContent && monacoContent.length > 500) {
      console.log(`  ✓ Extracted from Monaco Editor (${monacoContent.length} chars)`);
      return monacoContent;
    }
  } catch (e) {
    console.log('  ✗ Monaco Editor extraction failed:', e.message);
  }
  
  // Strategy 2: Look for code/pre elements in the side panel
  console.log('  [Strategy 2] Checking for code/pre elements...');
  try {
    const codeContent = await page.evaluate(() => {
      // Look for elements that might contain the HTML
      const candidates = [
        ...document.querySelectorAll('pre code'),
        ...document.querySelectorAll('pre'),
        ...document.querySelectorAll('code'),
        ...document.querySelectorAll('[class*="code"]'),
        ...document.querySelectorAll('[class*="html"]')
      ];
      
      let longestContent = '';
      for (const el of candidates) {
        const text = el.innerText || el.textContent || '';
        if (text.length > longestContent.length && text.includes('<!DOCTYPE')) {
          longestContent = text;
        }
      }
      
      return longestContent;
    });
    
    if (codeContent && codeContent.length > 500) {
      console.log(`  ✓ Extracted from code element (${codeContent.length} chars)`);
      return codeContent;
    }
  } catch (e) {
    console.log('  ✗ Code element extraction failed:', e.message);
  }
  
  // Strategy 3: Look for the HTML tab content specifically
  console.log('  [Strategy 3] Checking HTML tab panel...');
  try {
    const tabContent = await page.evaluate(() => {
      // Find elements with role="tabpanel" or similar
      const tabPanels = document.querySelectorAll('[role="tabpanel"], [class*="tab-panel"]');
      for (const panel of tabPanels) {
        const text = panel.innerText || panel.textContent || '';
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          return text;
        }
      }
      return null;
    });
    
    if (tabContent && tabContent.length > 500) {
      console.log(`  ✓ Extracted from tab panel (${tabContent.length} chars)`);
      return tabContent;
    }
  } catch (e) {
    console.log('  ✗ Tab panel extraction failed:', e.message);
  }
  
  // Strategy 4: Use clipboard API (click the copy button first)
  console.log('  [Strategy 4] Trying clipboard method...');
  try {
    // Click the copy button
    await page.getByRole('button', { name: 'Copy editor content' }).click();
    await page.waitForTimeout(500);
    
    // Try to read from clipboard using CDP
    const cdpSession = await page.context().newCDPSession(page);
    const { data } = await cdpSession.send('Browser.getClipboardContents');
    
    if (data && data.length > 500) {
      console.log(`  ✓ Extracted from clipboard (${data.length} chars)`);
      return data;
    }
  } catch (e) {
    console.log('  ✗ Clipboard extraction failed:', e.message);
  }
  
  // Strategy 5: Get all visible text and look for HTML patterns
  console.log('  [Strategy 5] Scanning all visible text...');
  try {
    const allText = await page.evaluate(() => {
      // Get all text nodes that might contain HTML
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let longestHtmlLike = '';
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent || '';
        if (text.includes('<!DOCTYPE') || (text.includes('<html') && text.length > 1000)) {
          if (text.length > longestHtmlLike.length) {
            longestHtmlLike = text;
          }
        }
      }
      
      return longestHtmlLike;
    });
    
    if (allText && allText.length > 500) {
      console.log(`  ✓ Found HTML-like content (${allText.length} chars)`);
      return allText;
    }
  } catch (e) {
    console.log('  ✗ Text scanning failed:', e.message);
  }
  
  // Strategy 6: Last resort - get the entire page content
  console.log('  [Strategy 6] Using page.content() as fallback...');
  const pageContent = await page.content();
  console.log(`  ⚠ Using page content (${pageContent.length} chars) - may not be accurate`);
  
  return pageContent;
}

function extractPublicUserData(html) {
  const data = {
    name: '',
    headline: '',
    location: '',
    bio: '',
    profile_image: '',
    social_links: [],
    title: '',
    meta_description: '',
    extracted_from: 'Google Rich Results Test HTML'
  };
  
  // Debug: Show first 1000 characters of raw HTML
  console.log('\n  [DEBUG] Raw HTML preview (first 1000 chars):');
  console.log('  ' + html.substring(0, 1000).replace(/\n/g, '\n  '));
  
  // Check if HTML is encoded (contains &lt; instead of <)
  const isEncoded = html.includes('&lt;') && html.includes('&gt;');
  console.log(`\n  [DEBUG] HTML appears to be ${isEncoded ? 'ENCODED' : 'normal'}`);
  
  // Decode HTML entities if needed
  let decodedHtml = html;
  if (isEncoded) {
    decodedHtml = html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    console.log('  [DEBUG] Decoded HTML entities');
  }
  
  // Extract title
  const titleMatch = decodedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    data.title = cleanText(titleMatch[1]);
    console.log(`  [DEBUG] Found title: ${data.title}`);
  } else {
    console.log('  [DEBUG] No title tag found');
  }
  
  // Extract meta description
  const metaDescMatch = decodedHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        decodedHtml.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (metaDescMatch) {
    data.meta_description = cleanText(metaDescMatch[1]);
    console.log(`  [DEBUG] Found meta description: ${data.meta_description.substring(0, 80)}...`);
  } else {
    console.log('  [DEBUG] No meta description found');
  }
  
  // Extract Open Graph tags
  const ogTitle = decodedHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogDesc = decodedHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogImage = decodedHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  
  if (ogTitle) {
    data.name = cleanText(ogTitle[1]);
    console.log(`  [DEBUG] Found og:title: ${data.name}`);
  }
  if (ogDesc) {
    data.bio = cleanText(ogDesc[1]);
    console.log(`  [DEBUG] Found og:description: ${data.bio.substring(0, 80)}...`);
  }
  if (ogImage) {
    data.profile_image = ogImage[1];
    console.log(`  [DEBUG] Found og:image`);
  }
  
  // Try to extract name from title if not found
  if (!data.name && data.title) {
    data.name = data.title.split(/[\|\-–—]/)[0].trim();
  }
  
  // Use meta description as bio if no bio found
  if (!data.bio && data.meta_description) {
    data.bio = data.meta_description;
  }
  
  // Extract JSON-LD structured data (commonly used by LinkedIn and other sites)
  console.log('  [DEBUG] Looking for JSON-LD structured data...');
  const jsonLdMatches = decodedHtml.match(/<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    console.log(`  [DEBUG] Found ${jsonLdMatches.length} JSON-LD script(s)`);
    for (const scriptTag of jsonLdMatches) {
      try {
        const jsonContent = scriptTag.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const jsonData = JSON.parse(jsonContent);
        console.log(`  [DEBUG] JSON-LD @type: ${jsonData['@type'] || 'undefined'}`);
        
        // Extract person data
        if (jsonData['@type'] === 'Person' || jsonData['@type'] === 'ProfilePage') {
          if (jsonData.name && !data.name) {
            data.name = jsonData.name;
            console.log(`  [DEBUG] Extracted name from JSON-LD: ${data.name}`);
          }
          if (jsonData.description && !data.bio) {
            data.bio = jsonData.description;
            console.log(`  [DEBUG] Extracted bio from JSON-LD`);
          }
          if (jsonData.jobTitle && !data.headline) {
            data.headline = jsonData.jobTitle;
            console.log(`  [DEBUG] Extracted job title from JSON-LD: ${data.headline}`);
          }
          if (jsonData.image && !data.profile_image) {
            data.profile_image = typeof jsonData.image === 'string' ? jsonData.image : jsonData.image.url;
            console.log(`  [DEBUG] Extracted image from JSON-LD`);
          }
          if (jsonData.address?.addressLocality && !data.location) {
            data.location = jsonData.address.addressLocality;
            console.log(`  [DEBUG] Extracted location from JSON-LD: ${data.location}`);
          }
        }
      } catch (e) {
        console.log(`  [DEBUG] Failed to parse JSON-LD: ${e.message}`);
      }
    }
  } else {
    console.log('  [DEBUG] No JSON-LD scripts found');
  }
  
  // Extract social links
  const socialPatterns = [
    /<a[^>]*href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']*)["'][^>]*>/gi,
    /<a[^>]*href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']*)["'][^>]*>/gi,
    /<a[^>]*href=["'](https?:\/\/(?:www\.)?github\.com\/[^"']*)["'][^>]*>/gi
  ];
  
  const socialLinks = new Set();
  for (const pattern of socialPatterns) {
    let match;
    while ((match = pattern.exec(decodedHtml)) !== null) {
      if (match[1]) socialLinks.add(match[1]);
    }
  }
  data.social_links = Array.from(socialLinks);
  
  // Try to extract additional LinkedIn-specific data
  if (decodedHtml.includes('linkedin.com/in/')) {
    console.log('  [DEBUG] Detected LinkedIn profile page');
    
    // Extract headline from LinkedIn meta tags or title
    const linkedinHeadline = decodedHtml.match(/<meta[^>]*name=["']linkedin:headline["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                             decodedHtml.match(/<meta[^>]*property=["']linkedin:headline["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    if (linkedinHeadline && !data.headline) {
      data.headline = cleanText(linkedinHeadline[1]);
      console.log(`  [DEBUG] Found LinkedIn headline: ${data.headline}`);
    }
    
    // Sometimes the headline is in the title after the name
    if (!data.headline && data.title && data.title.includes('-')) {
      const parts = data.title.split('-').map(p => p.trim());
      if (parts.length >= 2) {
        data.headline = parts[1];
        console.log(`  [DEBUG] Extracted headline from title: ${data.headline}`);
      }
    }
    
    // Extract location from meta tags
    const locationMatch = decodedHtml.match(/<meta[^>]*name=["']linkedin:location["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    if (locationMatch && !data.location) {
      data.location = cleanText(locationMatch[1]);
      console.log(`  [DEBUG] Found LinkedIn location: ${data.location}`);
    }
  }
  
  console.log(`\n  [SUMMARY]`);
  console.log(`  Found ${data.social_links.length} social links`);
  if (data.name) console.log(`  ✓ Name: ${data.name}`);
  if (data.headline) console.log(`  ✓ Headline: ${data.headline}`);
  if (data.location) console.log(`  ✓ Location: ${data.location}`);
  if (data.bio) console.log(`  ✓ Bio: ${data.bio.substring(0, 100)}...`);
  if (data.profile_image) console.log(`  ✓ Profile image found`);
  
  return data;
}

async function saveToJson(data) {
  const outputPath = path.resolve(CONFIG.OUTPUT_FILE);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Results saved to: ${outputPath}`);
}

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
    .trim();
}

main();