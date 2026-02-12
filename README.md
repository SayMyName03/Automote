# LinkedIn Public Profile Scraper (Patchright + Node.js)

## 📌 Overview

This project is a Node.js-based web scraper that extracts **publicly available information** from LinkedIn profiles without logging in.
It uses **Patchright (Playwright-compatible)** to open profile pages, handle popups, scroll through content, and collect visible data.

The scraper is designed to work only with information that is accessible to logged-out users and does not bypass authentication.

---

## 🚀 Features

* Opens LinkedIn profile from a provided URL
* Extracts publicly visible information:

  * Name
  * Headline
  * Location
  * Followers & connections
  * About section
  * Current company
  * Education (top section)
  * Experience (structured)
  * Skills (if visible)
  * Activity (if visible)
  * Certifications / Projects / Publications / Languages (if visible)
* Appends results to a JSON file instead of overwriting
* Avoids duplicates using profile URL matching

---

## 🛠️ Tech Stack

* **Node.js**
* **Patchright** (Playwright-style automation)
* **fs-extra** (File handling)

---

## 📂 Project Structure

```
linkedin-scraper/
│
├── scraper.js          # Main scraping script
├── profile.json        # Output file (auto-created)
├── package.json
└── README.md
```

---

## 📦 Installation

```bash
git clone <your-repo-url>
cd linkedin-scraper
npm install
```

Install dependencies:

```bash
npm install patchright fs-extra
```

---

## ▶️ Usage

Run the scraper with a LinkedIn profile URL:

```bash
node scraper.js https://www.linkedin.com/in/username/
```

Each run will:

1. Open the profile in a browser
2. Extract visible public data
3. Append results to `profile.json`

---

## 📄 Output Format

Data is saved in `profile.json` as an array of profiles:

```json
[
  {
    "profileUrl": "https://www.linkedin.com/in/example/",
    "name": "John Doe",
    "headline": "Software Engineer",
    "location": "Bangalore, India",
    "followers_and_connections": [
      "5k followers",
      "500+ connections"
    ],
    "about": "Passionate developer...",
    "current_company": "Google",
    "education_top": "IIT Delhi",
    "experience": [
      {
        "role": "Software Engineer",
        "company": "Google",
        "duration": "2020 - Present",
        "location": "Bangalore",
        "description": "Working on backend systems..."
      }
    ]
  }
]
```

New profiles are appended automatically.

---

## 🧠 How It Works

1. Launches a Chromium browser using Patchright
2. Navigates to the provided profile URL
3. Scrapes content using DOM selectors
4. Structures experience into role/company/duration
5. Appends results to JSON storage

---

## ⚠️ Limitations

This scraper only collects **publicly visible data**.

LinkedIn may hide sections when logged out, including:

* Full experience history
* Skills list
* Activity posts
* Contact information

If a section is not visible without login, it will not be scraped.

---

## 🧩 Notes

* Do not keep `profile.json` open in software that locks files (Excel, some viewers).
* VS Code is safe but may require refreshing to see updates.
* Some profiles expose more data than others.

---

## 🛡️ Ethics & Compliance

This project:

* Scrapes only publicly accessible information
* Does not use login credentials
* Does not bypass authentication walls
* Does not automate account actions

Use responsibly and follow LinkedIn’s terms of service.

---

## 👨‍💻 Author

Built as a learning project for web automation, DOM parsing, and data extraction using Node.js and browser automation tools.

---
