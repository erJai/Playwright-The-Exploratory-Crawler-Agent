import { Annotation } from "@langchain/langgraph";

// Define the state schema for our LangGraph workflow
export const GraphState = Annotation.Root({
    // The current URL the agent is on
    currentUrl: Annotation({
        reducer: (x, y) => y, // Always take the latest URL
        default: () => "",
    }),

    // Set of all visited URLs to avoid infinite loops
    visitedUrls: Annotation({
        reducer: (x, y) => new Set([...x, ...y]),
        default: () => new Set(),
    }),

    // A detailed map of paths taken. Route -> Array of discovered interactive elements/links
    crawlMap: Annotation({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    // Any errors encountered out in the wild (console errors, unhandled exceptions, 404s, etc)
    errors: Annotation({
        reducer: (x, y) => [...x, ...y],
        default: () => [],
    }),

    // Queue of elements pending interaction
    elementQueue: Annotation({
        reducer: (x, y) => {
            // Very naive reducer for simplicity - overwrite or combine appropriately.
            // Usually, curiosity engine will overwrite this sorted list for the current page.
            return y;
        },
        default: () => [],
    }),

    // The next action to take
    nextAction: Annotation({
        reducer: (x, y) => y,
        default: () => null,
    })
});
