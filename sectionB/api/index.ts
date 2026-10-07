import { createApp } from './app.js';

const port = Number(process.env.API_PORT ?? 5056);

const server = createApp().listen(port, () => {
  console.log(`LoanLens API on http://localhost:${port}/api`);
});
server.on('error', (error) => {
  console.error(`LoanLens API could not start on port ${port}: ${error.message}`);
  process.exit(1);
});
