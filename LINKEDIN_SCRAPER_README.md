# LinkedIn Public Profile Scraper

A production-ready Node.js scraper that extracts publicly available information from LinkedIn profiles using **Patchright** (a stealthy Playwright fork). This tool only extracts data visible to logged-out users - no authentication required.

## Features

✅ **Stealth Mode**: Uses Patchright to bypass bot detection  
✅ **Auth Wall Detection**: Automatically detects and retries on auth walls  
✅ **Popup Handling**: Automatically detects and closes popup dialogs  
✅ **Multiple Data Sources**: Extracts from meta tags, Open Graph, JSON-LD, and DOM  
✅ **Structured Logging**: Clear logging of each extraction step  
✅ **Retry Logic**: Configurable retry attempts with backoff  
✅ **JSON Output**: Clean JSON output saved to file  
✅ **Headless/Headful**: Toggle between visible and headless browser  

## Installation

```bash
# Install dependencies
npm install

# Install Patchright browsers (Chromium)
npx patchright install chromium
```

## Usage

### Basic Usage

```bash
node linkedinscraper.js <linkedin_profile_url>
```

### Examples

```bash
# Basic scrape (headful mode - browser visible)
node linkedinscraper.js https://www.linkedin.com/in/username/

# Headless mode (background scraping)
HEADLESS=true node linkedinscraper.js https://www.linkedin.com/in/username/

# With debug logging
DEBUG=true node linkedinscraper.js https://www.linkedin.com/in/username/

# Custom retry count
MAX_RETRIES=5 node linkedinscraper.js https://www.linkedin.com/in/username/

# Custom timeout
TIMEOUT=60000 node linkedinscraper.js https://www.linkedin.com/in/username/

# Custom output file
OUTPUT_FILE=my_profile.json node linkedinscraper.js https://www.linkedin.com/in/username/
```

### NPM Scripts

```bash
# Standard scrape
npm run scrape -- https://www.linkedin.com/in/username/

# Headless mode
npm run scrape:headless -- https://www.linkedin.com/in/username/

# Debug mode
npm run scrape:debug -- https://www.linkedin.com/in/username/
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HEADLESS` | Run browser in headless mode | `false` |
| `MAX_RETRIES` | Maximum retry attempts on auth wall | `3` |
| `TIMEOUT` | Page load timeout (ms) | `30000` |
| `NAVIGATION_TIMEOUT` | Navigation timeout (ms) | `60000` |
| `OUTPUT_FILE` | Output JSON filename | `linkedin_public_profile.json` |
| `DEBUG` | Enable debug logging | `false` |

## Output Format

The scraper outputs a JSON file with the following structure:

```json
{
  "profile_url": "https://www.linkedin.com/in/username/",
  "scraped_at": "2025-02-11T10:30:00.000Z",
  "public_data": {
    "name": "John Doe",
    "headline": "Software Engineer at Tech Company",
    "location": "San Francisco Bay Area",
    "about": "Passionate developer with 10+ years of experience...",
    "profile_image": "https://media.licdn.com/...",
    "title": "John Doe - LinkedIn",
    "meta_description": "View John Doe's profile on LinkedIn..."
  },
  "structured_data": [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "John Doe",
      "jobTitle": "Software Engineer",
      "worksFor": {...}
    }
  ],
  "metadata": {
    "html_length": 154230,
    "retry_count": 0,
    "headless": false,
    "user_agent": "Mozilla/5.0..."
  }
}
```

## How It Works

1. **Browser Launch**: Starts a Patchright Chromium instance with stealth settings
2. **Navigation**: Opens the LinkedIn profile URL
3. **Popup Handling**: Detects and closes any popup/modal dialogs
4. **Auth Detection**: Checks for authentication walls
5. **Data Extraction**: Extracts data from multiple sources:
   - Open Graph meta tags (`og:title`, `og:description`, `og:image`)
   - Standard meta tags (`title`, `description`)
   - JSON-LD structured data (Schema.org Person type)
   - DOM selectors (h1, profile-specific classes)
6. **Output**: Saves structured JSON data to file

## Important Notes

⚠️ **Ethical Usage**:
- Only extracts **publicly available** data visible to logged-out users
- Respects LinkedIn's terms of service
- Does NOT attempt to bypass authentication
- Does NOT use login credentials
- Includes appropriate delays and retry logic

⚠️ **Limitations**:
- Public profiles may have limited information
- LinkedIn may show auth walls for some profiles
- Rate limiting may apply
- Not all fields may be available for all profiles

## Architecture

```
linkedinscraper.js
├── Logger (structured logging)
├── startBrowser() (launch Patchright)
├── createContext() (stealth settings)
├── navigateToProfile() (page navigation)
├── closePopups() (popup/modal handling)
├── detectAuthWall() (auth detection)
├── extractMetaTags() (meta extraction)
├── extractJsonLd() (structured data)
├── extractPublicProfileData() (main extraction)
├── cleanText() (data cleaning)
└── saveToJson() (output)
```

## Troubleshooting

### Auth Wall Detected
- The scraper will automatically retry with new browser instances
- Increase `MAX_RETRIES` if needed
- Try running in headful mode (`HEADLESS=false`)

### No Data Extracted
- Verify the profile URL is correct and publicly accessible
- Check if the profile requires login to view
- Enable debug mode (`DEBUG=true`) to see extraction steps

### Timeout Errors
- Increase `TIMEOUT` and `NAVIGATION_TIMEOUT` values
- Check your internet connection
- LinkedIn may be rate-limiting requests

## License

This project is for educational purposes. Please use responsibly and in accordance with LinkedIn's terms of service.

## Dependencies

- [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs) - Undetected Playwright fork
- Node.js 16+

## Author

Created for automated LinkedIn profile data extraction with respect for privacy and terms of service.
