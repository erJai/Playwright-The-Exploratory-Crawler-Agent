import { Agent, initializeAgent, closeAgent } from "./src/agent.js";
import { Reporter } from "./src/reporter.js";

async function run() {
    // Let's test on a publicly safe, interactive test site
    // e.g. a sample dummy app or wikipedia. 
    // We'll use httpbin or similar just as a fast test, but playwright.dev is also good for crawling test
    const START_URL = "https://playwright.dev/";

    console.log(`Initializing Exploratory Crawler on ${START_URL}...`);

    try {
        const startUrl = await initializeAgent(START_URL);

        // Create initial state
        const initialState = {
            currentUrl: startUrl,
            visitedUrls: new Set([startUrl]),
            crawlMap: {},
            errors: [],
            elementQueue: [],
            nextAction: null
        };

        console.log(`Starting LangGraph execution...`);

        // Inject the initial state into the compiled graph
        // We can run the graph synchronously for autonomous execution
        // We supply a thread_id so the MemorySaver tracks this run
        const config = { configurable: { thread_id: "test-run" }, recursionLimit: 50 };

        let finalState = initialState;

        try {
            // Instead of agent.invoke() which handles it internally, state graph uses invoke with initial state
            finalState = await Agent.invoke(initialState, config);
        } catch (error) {
            console.log(`\nLangGraph execution halted: ${error.message}`);

            // Extract the latest state from the checkpointer MemorySaver since the run aborted gracefully
            const stateSnapshot = await Agent.getState(config);
            if (stateSnapshot && stateSnapshot.values) {
                finalState = stateSnapshot.values;
                console.log("Successfully recovered mid-flight state from MemorySaver!");
            }
        }

        console.log(`\nCrawler finished execution.`);

        const reporter = new Reporter('./reports');
        reporter.generateReport(finalState);

    } catch (error) {
        console.error("Fatal agent error:", error);
    } finally {
        console.log(`Closing browser...`);
        await closeAgent();
    }
}

run();
