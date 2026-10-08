/**
 * Serves the built LoanLens web app (app/dist). The app reads its mock data from
 * /data/loans.json, a static file in that build, so there are no API routes.
 *
 *   npm run build && npm start     http://localhost:5055 (WEB_PORT changes it)
 */
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('app/dist is missing. Run `npm run build` first.');
  process.exit(1);
}

const app = express();
app.use(express.static(dist));
// Client-side routes (/calculator) load the same page. The root option keeps a checkout
// under a dot-folder (~/.cache/…) from tripping send's dotfile check.
app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: dist }));

const port = Number(process.env.WEB_PORT ?? 5055);
const server = app.listen(port, () => console.log(`LoanLens web app on http://localhost:${port}`));
server.on('error', (error) => {
  console.error(`LoanLens web app could not start on port ${port}: ${error.message}`);
  process.exit(1);
});
