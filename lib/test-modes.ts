import { TestMode } from '@/types/runner';

export interface TestModeDefinition {
  id: TestMode;
  name: string;
  requestEstimate: string;
  description: string;
}

export const TEST_MODES: TestModeDefinition[] = [
  {
    id: 'smoke',
    name: 'Smoke',
    requestEstimate: 'about 10 to 15',
    description:
      'A quick health check, about 10 steps and 1 to 3 minutes. Opens the site, checks the main pages and links, and looks for broken images and console errors. Best for a fast check after a deploy. Uses the fewest Gemini requests (about 10 to 15).',
  },
  {
    id: 'user_flow',
    name: 'User Flow',
    requestEstimate: 'about 20 to 25',
    description:
      'Follows your command like a real user, up to 20 steps. Best for testing one journey such as login, signup or checkout. Uses a medium number of requests (about 20 to 25).',
  },
  {
    id: 'full_qa',
    name: 'Full QA',
    requestEstimate: 'about 25 to 30',
    description:
      'The deepest test, up to 25 steps. Does your command plus form checks with empty and wrong input, a 404 page check, and a mobile-size (375px) pass. Best before a release. Uses the most requests (about 25 to 30), so a free key may run out sooner.',
  },
];

export const TEST_MODES_FOOTER_NOTE = 'Request counts are approximate.';
