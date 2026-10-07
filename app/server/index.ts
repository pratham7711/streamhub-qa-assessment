import { createApp } from './app.js';

const port = Number(process.env.APP_PORT ?? 5055);

const server = createApp().listen(port, () => {
  console.log(`LoanLens listening on http://localhost:${port}`);
});
server.on('error', (error) => {
  console.error(`LoanLens could not start on port ${port}: ${error.message}`);
  process.exit(1);
});
