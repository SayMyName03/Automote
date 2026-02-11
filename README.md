# Rich Results Test Web Scraper

A Node.js web scraper using Patchright (Playwright-based automation) that extracts publicly available user data from webpages via Google Rich Results Test as an intermediate renderer/parser.

## Features

- Uses Google Rich Results Test to render and parse target pages
- Extracts public user data including:
  - Page title and meta description
  - Name, headline, and location
  - Bio/About text
  - Profile image URL
  - Social media links
  - JSON-LD structured data
- Modular, production-ready code structure
- Headless/headful browser toggle
- Comprehensive error handling and retry logic
- Saves results to JSON format

## Installation

```bash
npm install
```

## Usage

### Basic Usage
```bash
node scraper.js <target_url>
```

### Examples
```bash
# Scrape a profile page
node scraper.js https://example.com/profile

# Scrape with visible browser (debug mode)
HEADLESS=false node scraper.js https://example.com/profile

# Scrape a LinkedIn public profile
node scraper.js https://www.linkedin.com/in/username
```

## Configuration

Set environment variables to customize behavior:

```bash
# Run with visible browser window
HEADLESS=false node scraper.js <url>

# Change output filename
OUTPUT_FILE=my_data.json node scraper.js <url>
```

## Output Format

Results are saved to `public_user_data.json`:

```json
{
  "input_url": "https://example.com/profile",
  "scraped_at": "2026-02-10T12:00:00.000Z",
  "public_user_data": {
    "name": "John Doe",
    "headline": "Software Engineer",
    "location": "San Francisco, CA",
    "bio": "Experienced developer with 10+ years...",
    "profile_image": "https://example.com/photo.jpg",
    "social_links": [
      "https://twitter.com/johndoe",
      "https://linkedin.com/in/johndoe"
    ],
    "title": "John Doe | Software Engineer",
    "meta_description": "John Doe's professional profile..."
  },
  "structured_data": [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "John Doe",
      "jobTitle": "Software Engineer"
    }
  ]
}
```

## Code Structure

- `startBrowser()` - Launch Patchright browser
- `openRichResultsTool(page)` - Navigate to Google Rich Results Test
- `submitUrlForTesting(page, targetUrl)` - Submit URL for analysis
- `waitForResults(page)` - Wait for test completion
- `openTestedPageView(page)` - Open rendered page view
- `extractRenderedHtml(page)` - Extract HTML content
- `extractPublicUserData(html)` - Parse user data from HTML
- `extractStructuredData(html)` - Extract JSON-LD structured data
- `saveToJson(data)` - Save results to file

## Requirements

- Node.js >= 16.0.0
- Patchright (Playwright-based automation library)

## Notes

- The script only extracts publicly available data visible without authentication
- Google Rich Results Test may have rate limits
- Some websites may block automated access
- Results depend on what data is actually present in the rendered HTML

## License

MIT
