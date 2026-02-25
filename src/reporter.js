import fs from 'fs';
import path from 'path';

export class Reporter {
    constructor(outputDir = './output') {
        this.outputDir = outputDir;
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    generateReport(finalState) {
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalVisitedUrls: finalState.visitedUrls.size,
                totalErrors: finalState.errors.length,
            },
            visitedPaths: Array.from(finalState.visitedUrls),
            errors: finalState.errors,
            crawlMap: finalState.crawlMap, // The relationships
        };

        const reportPath = path.join(this.outputDir, `crawl-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        const htmlPath = path.join(this.outputDir, `crawl-report-${Date.now()}.html`);
        const htmlContent = this.generateHtmlReport(reportData);
        fs.writeFileSync(htmlPath, htmlContent);

        console.log(`\n================================`);
        console.log(`JSON Report generated at: ${reportPath}`);
        console.log(`HTML Report generated at: ${htmlPath}`);
        console.log(`Visited ${finalState.visitedUrls.size} unique URLs.`);
        console.log(`Encountered ${finalState.errors.length} errors/anomalies.`);
        console.log(`================================`);

        return { json: reportPath, html: htmlPath };
    }

    generateHtmlReport(data) {
        const errorListTemplate = data.errors.length > 0
            ? data.errors.map(err => `
                <div class="error-card glass">
                    <span class="badge ${err.type === 'console_error' ? 'badge-orange' : 'badge-red'}">${err.type}</span>
                    <p class="error-msg">${err.message || err.status || 'Unknown error'}</p>
                    <p class="error-url"><a href="${err.url}" target="_blank">${err.url}</a></p>
                </div>
              `).join('')
            : '<p class="text-muted">No errors encountered during the crawl! 🎉</p>';

        const pathListTemplate = data.visitedPaths.map(p => `<li><a href="${p}" target="_blank">${p}</a></li>`).join('');

        const crawlMapTemplate = Object.entries(data.crawlMap).map(([url, actions]) => {
            const actionItems = actions.map(act => `
                <div class="action-item">
                    <span class="action-type">${act.type}</span>
                    <span class="action-target">${act.element?.tagName || 'UNKNOWN'} ${act.element?.selector || act.element?.text || ''}</span>
                </div>
            `).join('');

            return `
                <div class="map-node glass">
                    <h4><a href="${url}" target="_blank">${url}</a></h4>
                    <div class="action-list">
                        ${actionItems || '<span class="text-muted">No actions taken</span>'}
                    </div>
                </div>
            `;
        }).join('');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exploratory Crawler Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0f172a;
            --surface: #1e293b;
            --primary: #3b82f6;
            --accent: #8b5cf6;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --error-bg: #450a0a;
            --error-text: #fca5a5;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background-image: radial-gradient(circle at top right, rgba(139, 92, 246, 0.15), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.15), transparent 40%);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #60a5fa, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }

        .timestamp {
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .glass {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            text-align: center;
            transition: transform 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-5px);
        }

        .stat-value {
            font-size: 3rem;
            font-weight: 700;
            color: var(--primary);
            line-height: 1;
            margin-bottom: 0.5rem;
        }

        .stat-value.danger {
            color: #ef4444;
        }

        h2 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        ul.visited-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        ul.visited-list li {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        ul.visited-list li:last-child {
            border-bottom: none;
        }

        a {
            color: var(--primary);
            text-decoration: none;
            transition: color 0.2s;
        }

        a:hover {
            color: #60a5fa;
            text-decoration: underline;
        }

        .error-card {
            margin-bottom: 1rem;
            border-left: 4px solid #ef4444;
        }

        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }

        .badge-red { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .badge-orange { background: rgba(249, 115, 22, 0.2); color: #fdba74; }

        .error-msg {
            font-family: monospace;
            background: rgba(0, 0, 0, 0.2);
            padding: 0.75rem;
            border-radius: 6px;
            margin: 0.5rem 0;
            word-break: break-all;
        }

        .map-node {
            margin-bottom: 1rem;
        }
        
        .map-node h4 {
            margin: 0 0 1rem 0;
            font-size: 1.1rem;
            word-break: break-all;
        }

        .action-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .action-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.5rem;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
        }

        .action-type {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: var(--primary);
            color: white;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-weight: 600;
        }

        .action-target {
            font-family: monospace;
            color: #a78bfa;
            font-size: 0.9rem;
        }

        .text-muted {
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Exploratory Crawler Report</h1>
            <p class="timestamp">Generated on ${new Date(data.timestamp).toLocaleString()}</p>
        </header>

        <div class="stats-grid">
            <div class="stat-card glass">
                <div class="stat-value">${data.summary.totalVisitedUrls}</div>
                <div class="stat-label">Unique URLs Visited</div>
            </div>
            <div class="stat-card glass">
                <div class="stat-value ${data.summary.totalErrors > 0 ? 'danger' : ''}">${data.summary.totalErrors}</div>
                <div class="stat-label">Errors Detected</div>
            </div>
            <div class="stat-card glass">
                <div class="stat-value">${Object.values(data.crawlMap).reduce((acc, curr) => acc + curr.length, 0)}</div>
                <div class="stat-label">Total Actions Performed</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div>
                <h2>🚨 Errors Encountered</h2>
                ${errorListTemplate}
            </div>
            <div>
                <h2>🗺️ Visited Paths</h2>
                <div class="glass">
                    <ul class="visited-list">
                        ${pathListTemplate}
                    </ul>
                </div>
            </div>
        </div>

        <h2>🕸️ Crawl Action Map</h2>
        <div class="map-grid">
            ${crawlMapTemplate}
        </div>
    </div>
</body>
</html>`;
    }
}
