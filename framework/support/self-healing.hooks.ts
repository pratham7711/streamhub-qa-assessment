import { After, Before, Status } from '@cucumber/cucumber';
import { beginScenario, endScenario } from '../../self-healing/runtime.js';
import type { CustomWorld } from './world.js';

Before(function (this: CustomWorld, { pickle }) {
  beginScenario({ scenario: pickle.name, attach: (data, mediaType) => this.attach(data, mediaType) });
});

After(function (this: CustomWorld, { result }) {
  endScenario(result?.status === Status.PASSED ? 'passed' : 'failed');
});
