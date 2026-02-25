import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { GraphState } from "./state.js";
import { BrowserHelper } from "./browser.js";
import { prioritizeElements } from "./curiosity.js";

// We'll keep a singleton browser instance for the graph to use
const browserHelper = new BrowserHelper();

// Helper to check if a URL belongs to our target domain so we don't crawl the internet
function isSameOrigin(targetUrl, currentUrl) {
    try {
        const target = new URL(targetUrl);
        const origin = new URL(currentUrl);
        return target.hostname === origin.hostname || targetUrl.startsWith('/');
    } catch (e) {
        return false;
    }
}

/**
 * Node 1: Observe
 * Looks at the current page, extracts interactive elements, and catches any errors.
 */
async function observeNode(state) {
    console.log(`[Observe] Looking at ${state.currentUrl}`);
    const errors = browserHelper.getAndClearErrors();
    const elements = await browserHelper.extractInteractiveElements();

    return {
        errors,
        elementQueue: elements, // Raw elements
    };
}

/**
 * Node 2: Evaluate
 * Uses the Curiosity Engine to sort elements.
 * Generates the "next action".
 */
async function evaluateNode(state) {
    console.log(`[Evaluate] Curiosity Engine scoring ${state.elementQueue.length} elements...`);

    const sortedElements = prioritizeElements(state.elementQueue);

    // Find the top unvisited action
    let nextAction = null;

    for (const el of sortedElements) {
        // If it's a link to an external site or a site we've visited, skip
        if (el.tagName.toLowerCase() === 'a' && el.href) {
            // normalize url
            try {
                const urlObj = new URL(el.href, state.currentUrl);
                // Strip hash for visited checks
                urlObj.hash = '';
                const normalizedHref = urlObj.toString();

                if (!state.visitedUrls.has(normalizedHref) && isSameOrigin(normalizedHref, state.currentUrl)) {
                    nextAction = { type: 'navigate', url: el.href, element: el };
                    break;
                }
            } catch (e) { } // ignore invalid urls
        } else {
            // It's a button or input 
            // We need to check if we've interacted with it on this page.
            const previousActionsHere = state.crawlMap[state.currentUrl] || [];
            const alreadyInteracted = previousActionsHere.some(
                a => a.type === 'interact' && a.element.selector === el.selector
            );

            if (!alreadyInteracted) {
                nextAction = { type: 'interact', element: el };
                break;
            }
        }
    }

    if (!nextAction && sortedElements.length > 0) {
        // Fallback: just do the top action anyway even if visited, but maybe change state to note it?
        // Actually, let's just end if we exhaust new things
        console.log(`[Evaluate] No unvisited actions found, stopping.`);
    }

    return {
        elementQueue: sortedElements,
        nextAction
    };
}

/**
 * Node 3: Act
 * Performs the action determined by Evaluate.
 */
async function actNode(state) {
    const action = state.nextAction;
    let newCurrentUrl = state.currentUrl;

    try {
        if (action.type === 'navigate') {
            console.log(`[Act] Navigating to ${action.url} via click on ${action.element.tagName}`);
            await browserHelper.performAction({ actionType: 'click', elementSelector: action.element.selector });

            // Some navigations take a bit
            await browserHelper.page.waitForTimeout(2000);
            newCurrentUrl = browserHelper.getCurrentUrl();

        } else if (action.type === 'interact') {
            console.log(`[Act] Interacting with ${action.element.tagName} (${action.element.selector})`);

            if (['input', 'textarea'].includes(action.element.tagName.toLowerCase())) {
                await browserHelper.performAction({ actionType: 'fill', elementSelector: action.element.selector, value: "test content" });
            } else {
                await browserHelper.performAction({ actionType: 'click', elementSelector: action.element.selector });
            }

            // Wait for any DOM changes or navigation
            await browserHelper.page.waitForTimeout(2000);
            newCurrentUrl = browserHelper.getCurrentUrl();
        }
    } catch (e) {
        console.log(`[Act] Error during action: ${e.message}`);
        return {
            errors: [{ type: 'action_error', message: e.message, url: state.currentUrl }]
        }
    }

    // Normalize URL for visited tracking
    let normalizedUrl = newCurrentUrl;
    try {
        const u = new URL(newCurrentUrl);
        u.hash = '';
        normalizedUrl = u.toString();
    } catch (e) { }

    return {
        currentUrl: newCurrentUrl,
        visitedUrls: new Set([normalizedUrl]),
        crawlMap: { [state.currentUrl]: [...(state.crawlMap[state.currentUrl] || []), action] }
    };
}

// Ensure the browser is ready before we start
export async function initializeAgent(startUrl) {
    await browserHelper.init();
    await browserHelper.goto(startUrl);
    return browserHelper.getCurrentUrl();
}

export async function closeAgent() {
    await browserHelper.close();
}

// Build the LangGraph
const workflow = new StateGraph(GraphState)
    .addNode("observe", observeNode)
    .addNode("evaluate", evaluateNode)
    .addNode("act", actNode);

// Routing logic
workflow.addEdge(START, "observe");
workflow.addEdge("observe", "evaluate");

workflow.addConditionalEdges("evaluate", (state) => {
    if (!state.nextAction) {
        return END;
    }
    // Optional: Stop if we've accumulated too many errors or visited too many pages
    if (state.visitedUrls.size > 20) {
        console.log(`[Evaluate] Max depth reached. Stopping.`);
        return END;
    }
    return "act";
});

workflow.addEdge("act", "observe"); // Loop back

const checkpointer = new MemorySaver();
export const Agent = workflow.compile({ checkpointer });
