import { chromium } from "playwright";

export class BrowserHelper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.context = null;
        this.errors = [];
    }

    async init() {
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();

        // Setup generic global error, console log, and response listeners
        this.page.on("pageerror", (err) => {
            this.errors.push({ type: "pageerror", message: err.message, url: this.page.url() });
        });

        this.page.on("console", (msg) => {
            if (msg.type() === "error") {
                this.errors.push({ type: "console_error", message: msg.text(), url: this.page.url() });
            }
        });

        this.page.on("response", (response) => {
            if (response.status() >= 400 && response.status() < 600) {
                // Exclude generic static asset 404s if desired, but grab them all for now
                this.errors.push({
                    type: "network_error",
                    status: response.status(),
                    url: response.url(),
                    pageUrl: this.page.url()
                });
            }
        });
    }

    async goto(url) {
        if (!this.page) throw new Error("Browser not initialized");
        await this.page.goto(url, { waitUntil: "load" });
    }

    getCurrentUrl() {
        return this.page ? this.page.url() : "";
    }

    getAndClearErrors() {
        const currentErrors = [...this.errors];
        this.errors = [];
        return currentErrors;
    }

    /**
     * Extracts interactive elements from the DOM
     * Returns an array of objects describing the element.
     */
    async extractInteractiveElements() {
        if (!this.page) return [];

        const elements = await this.page.evaluate(() => {
            const getSelector = (el) => {
                if (el.id) return `#${el.id}`;
                if (el.className && typeof el.className === 'string') {
                    return `${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')}`;
                }
                // Fallback for unique identification, though fragile
                return el.tagName.toLowerCase();
            };

            const interactives = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"]'));

            return interactives.map((el, index) => {
                const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                return {
                    id: `el_${index}`,
                    tagName: el.tagName,
                    type: el.type || null,
                    text: el.innerText || el.value || el.placeholder || el.name || '',
                    href: el.href || null,
                    selector: getSelector(el),
                    isVisible
                };
            }).filter(el => el.isVisible);
        });

        return elements;
    }

    async performAction(action) {
        // action: { elementSelector: string, actionType: 'click' | 'fill', value?: string }
        if (!this.page) return;
        try {
            if (action.actionType === 'click') {
                const urlBefore = this.page.url();
                await this.page.mouse.move(0, 0); // Reset mouse
                // We use evaluate since selector can be fragile
                await this.page.evaluate((selector) => {
                    const el = document.querySelector(selector);
                    if (el) el.click();
                }, action.elementSelector);

                // Very basic simple wait, or we could wait for navigation/network idle
                await this.page.waitForTimeout(2000);
            } else if (action.actionType === 'fill') {
                await this.page.fill(action.elementSelector, action.value || "test_input");
                await this.page.waitForTimeout(500);
            }
        } catch (e) {
            console.log(`Failed to perform action on ${action.elementSelector}: ${e.message}`);
        }
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}
