# Exploratory Crawler 🐒

A "monkey tester" on steroids that autonomously explores your web applications to find unhandled exceptions, network anomalies (404s/500s), and UI crashes. 

Built with **Playwright** for browser automation and **LangGraph** for intelligent state management and decision making.

## Core Logic & Architecture

Unlike standard crawlers that just blindly follow `href` links to map out a site, the Exploratory Crawler acts like a chaotic user trying to break things. It prioritizes interacting with "risky" inputs (like checkout forms or settings pages) over just clicking standard navigation links.

It operates using a cyclical LangGraph consisting of three main nodes:

1. **Observe (`src/browser.js`)**: 
   - Uses Playwright to evaluate the current page.
   - Attaches listeners to catch any `console.error` logs, unhandled page exceptions, and failed network requests (404s).
   - Extracts all interactive DOM elements (buttons, inputs, links).

2. **Evaluate (`src/curiosity.js`)**: 
   - The "Curiosity Engine". Takes the raw elements extracted from the `Observe` node and scores them.
   - Standard links get a low score.
   - Buttons, textareas, and inputs with "high-risk" keywords (like *login, password, checkout, pay*) get a massive score multiplier.
   - It filters out elements we've already interacted with to prevent getting stuck in infinite loops.

3. **Act (`src/agent.js`)**: 
   - Takes the highest-scoring element and uses Playwright to interact with it (e.g., clicking a button or filling an input with dummy text).
   - Modifies the global Memory state to log the interaction route (`crawlMap`) and updates the current URL.
   
The graph then loops back to **Observe** until it exhausts all novel interactions or hits a max step limit (recursion limit).

## Prerequisites

- Node.js > 18
- Playwright browsers installed (`npx playwright install`)

## Quickstart

1. Install dependencies:
```bash
npm install
```

2. Point the crawler at your target URL in `example.js`:
```javascript
const START_URL = "https://your-local-dev-server.com/";
```

3. Run the agent:
```bash
node example.js
```

## The Report Generator

When the crawler exhausts its routes or hits the recursion limit, the `Reporter` (`src/reporter.js`) generates both a **JSON payload** and a sleek **HTML Dashboard** in the `./reports` directory.

The dashboard includes:
- **Unique URLs Visited**: Every distinct page route reached.
- **Errors Detected**: A categorized list of every single stack trace, console error, or broken network request the monkey tester triggered.
- **Crawl Action Map**: A chronological tree showing *exactly* which DOM elements the agent clicked or filled on each specific URL to help you reproduce the crash manually.

## Handling Bot Protection (Why did it fail on Amazon?)

If you run this against a site with heavy anti-bot protection (like Amazon or Cloudflare-protected domains), the `Observe` node will often extract `0 elements`. This is because Playwright's default headless browser is easily detected, and the server returns a blank shell or a CAPTCHA challenge. 

**To test against protected production sites:**
1. Open `src/browser.js`.
2. Find the browser initialization: `chromium.launch({ headless: true })`.
3. Change it to `{ headless: false }`. This allows you to visually see the page open, manually solve the CAPTCHA, and then the agent will take over and continue the DOM extraction!
