/**
 * Web Scraper using Google Rich Results Test
 * 
 * This script uses Patchright (Playwright) to extract publicly available
 * user data from webpages using Google Rich Results Test as an intermediate
 * renderer/parser.
 * 
 * Usage: node scraper.js <target_url>
 * Example: node scraper.js https://www.linkedin.com/in/leonardo-chamsin
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
    console.error('Usage: node scraper.js <target_url>');
    process.exit(1);
  }

  console.log('=' .repeat(60));
  console.log('Rich Results Test Web Scraper');
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
    
    // Step 7: Click Copy editor content button
    console.log('Clicking Copy editor content button...');
    await page.getByRole('button', { name: 'Copy editor content' }).click();
    console.log('HTML copied to clipboard successfully!');
    
    // Wait a moment for clipboard operation
    await page.waitForTimeout(1000);
    
    // Extract HTML content from the editor (same content that was copied)
    console.log('Extracting HTML content from editor...');
    const html = await extractHtmlFromEditor(page);
    
    // Extract and display user data immediately after clipboard copy
    console.log('\n' + '='.repeat(60));
    console.log('EXTRACTING USER DATA FROM COPIED HTML');
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
    
    // Step 8: Click on screenshot element
    console.log('Clicking screenshot element...');
    await page.getByText('screenshot').click();
    
    // Save results
    const outputData = {
      input_url: targetUrl,
      scraped_at: new Date().toISOString(),
      public_user_data: userData
    };
    
    await saveToJson(outputData);
    
    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`✓ HTML copied to clipboard`);
    console.log(`✓ User data extracted and displayed above`);
    console.log(`✓ Results saved to: ${CONFIG.OUTPUT_FILE}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '!' .repeat(60));
    console.error('Error during scraping:');
    console.error(error.message);
    console.error('!' .repeat(60));
    process.exit(1);
  } finally {
    if (browser) {
      console.log('\nClosing browser...');
      await browser.close();
    }
  }
}

async function extractHtmlFromEditor(page) {
  // Try to get HTML from the code editor - this is the copied content
  const editorSelectors = [
    '[role="textbox"]',
    'textarea',
    'pre[role="presentation"]',
    '.monaco-editor .view-lines',
    '[class*="editor"] pre',
    'code[class*="html"]',
    'pre code',
    'pre',
    '.html-content'
  ];
  
  for (const selector of editorSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.includes('<') && text.length > 500) {
          console.log(`  Found HTML content in editor (${text.length} characters)`);
          return text;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  // Try to get content from the active element or body
  try {
    const bodyText = await page.evaluate(() => {
      // Look for the largest text content that looks like HTML
      const allElements = document.querySelectorAll('pre, code, textarea, [role="textbox"]');
      let largestHtml = '';
      
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.includes('<!DOCTYPE') || text.includes('<html') || (text.includes('<') && text.length > largestHtml.length)) {
          largestHtml = text;
        }
      }
      
      return largestHtml;
    });
    
    if (bodyText && bodyText.length > 500) {
      console.log(`  Extracted HTML from page (${bodyText.length} characters)`);
      return bodyText;
    }
  } catch (e) {
    console.log('  Could not extract from page body');
  }
  
  // Fallback: get page content
  console.log('  Using fallback: page content');
  return await page.content();
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
  
  // Debug: Show first 500 characters of raw HTML
  console.log('\n  [DEBUG] Raw HTML preview (first 500 chars):');
  console.log('  ' + html.substring(0, 500).replace(/\n/g, '\\n'));
  
  // Check if HTML is encoded (contains &lt; instead of <)
  const isEncoded = html.includes('&lt;') && html.includes('&gt;');
  console.log(`  [DEBUG] HTML appears to be ${isEncoded ? 'ENCODED' : 'normal'}`);
  
  // Decode HTML entities if needed
  let decodedHtml = html;
  if (isEncoded) {
    decodedHtml = html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
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
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (metaDescMatch) {
    data.meta_description = cleanText(metaDescMatch[1]);
  }
  
  // Extract Open Graph tags
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  
  if (ogTitle) data.name = cleanText(ogTitle[1]);
  if (ogDesc) data.bio = cleanText(ogDesc[1]);
  if (ogImage) data.profile_image = ogImage[1];
  
  // Try to extract name from title if not found
  if (!data.name && data.title) {
    data.name = data.title.split(/[\|\-–—]/)[0].trim();
  }
  
  // Use meta description as bio if no bio found
  if (!data.bio && data.meta_description) {
    data.bio = data.meta_description;
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
    while ((match = pattern.exec(html)) !== null) {
      if (match[1]) socialLinks.add(match[1]);
    }
  }
  data.social_links = Array.from(socialLinks);
  
  console.log(`  Found ${data.social_links.length} social links`);
  if (data.name) console.log(`  Found name: ${data.name}`);
  if (data.bio) console.log(`  Found bio: ${data.bio.substring(0, 100)}...`);
  
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
    .trim();
}

main();
