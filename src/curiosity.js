/**
 * The Curiosity Engine
 * 
 * Scores and ranks elements based on standard heuristics.
 * "Risky" paths (forms, checkouts, settings, logins) get higher scores.
 */

const HIGH_RISK_KEYWORDS = [
    'login', 'signin', 'sign-in', 'password',
    'checkout', 'cart', 'buy', 'pay', 'billing', 'credit',
    'settings', 'config', 'admin', 'dashboard', 'profile',
    'submit', 'save', 'delete', 'remove', 'destroy'
];

const MEDIUM_RISK_KEYWORDS = [
    'search', 'query', 'filter', 'sort', 'add', 'create', 'new', 'edit', 'update'
];

/**
 * Scores an element from 0 to 100 based on its attributes and text.
 */
function scoreElement(element) {
    let score = 10; // Base score for any interactive element

    const textToAnalyze = `
    ${element.text || ''} 
    ${element.selector || ''} 
    ${element.href || ''} 
    ${element.id || ''} 
  `.toLowerCase();

    for (const keyword of HIGH_RISK_KEYWORDS) {
        if (textToAnalyze.includes(keyword)) {
            score += 40;
            break;
        }
    }

    for (const keyword of MEDIUM_RISK_KEYWORDS) {
        if (textToAnalyze.includes(keyword)) {
            score += 20;
            break;
        }
    }

    // Inputs and forms are more "curious" than standard links
    if (['input', 'textarea', 'select'].includes(element.tagName?.toLowerCase())) {
        score += 15;
    }

    if (element.tagName?.toLowerCase() === 'button' || element.type === 'submit') {
        score += 15;
    }

    return score;
}

/**
 * Takes a list of elements, scores them, and sorts them descending.
 */
export function prioritizeElements(elements, visitedSelectors = new Set()) {
    return elements
        .map(el => ({ ...el, score: scoreElement(el) }))
        // De-prioritize things we've likely interacted with on this specific page
        // (A real implementation might track interactions globally or per URL)
        .map(el => visitedSelectors.has(el.selector) ? { ...el, score: el.score - 50 } : el)
        .sort((a, b) => b.score - a.score);
}
