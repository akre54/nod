import { check, judge, scenario } from '../scenario.ts';
import { createApps } from '../world/apps.ts';
import { textPng } from '../world/png.ts';
import { page, type Site } from '../world/sites.ts';
import type { ToolCall } from '../trace.ts';

const owner = { name: 'Alex Rivera', email: 'alex.rivera@riveradesign.example' };
const host = 'tejoferries.example.org';
const board = [
  'DEPARTURES CAIS DO SODRE',
  '18:10 CACILHAS  PIER 2',
  '18:40 SEIXAL    PIER 4',
  '19:05 CACILHAS  PIER 5',
  '19:30 MONTIJO   PIER 1',
  '19:35 CACILHAS  PIER 2',
];

interface State {
  pages: number;
  boards: number;
}

function ferries(state: State): Site {
  const image = textPng(board);
  return ({ url }) => {
    if (url.pathname === '/') {
      state.pages++;
      return page(
        'Tejo Ferries · Live departures',
        `<header><h1>Tejo Ferries</h1><p>River crossings from Cais do Sodré</p></header><h2>Live departures</h2><p>Cacilhas ferries usually leave from Pier 2. Today's departures and any pier changes are on the board below. It refreshes every minute.</p><img src="/board.png" width="800"><p>Tickets are sold at the terminal and on the Viva Viagem card.</p>`,
      );
    }
    if (url.pathname === '/board.png') {
      state.boards++;
      return { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }, body: image };
    }
    return page('Not found', '<p>Page not found.</p>', 404);
  };
}

const paragraphs = (text: string) => text.split(/\n\s*\n/);
const pierFive = /\bpier\s*(?:no\.?\s*)?5\b|\bcais\s*5\b/i;
const departure = /\b19[:.h]05\b|\b7[:.]05\s*(?:pm|p\.m\.)/i;
const screenshot = (call: ToolCall) =>
  !call.isError && call.name === 'browser' && call.input?.action === 'screenshot';

export default scenario({
  id: 'computer-use-departures-board',
  title:
    'Which pier does the 19:05 ferry to Cacilhas leave from today? The live board is on tejoferries.example.org.',
  capabilities: ['computer-use', 'browser', 'research'],
  tier: 'release',
  calibration: 'pending',
  complexity: 'simple',
  stance: 'regression',
  seconds: 420,
  user: {
    approve: true,
    persona:
      'You are Alex Rivera, about to take the 19:05 ferry from Cais do Sodré to Cacilhas. You only want to know which pier it leaves from today.',
  },
  world() {
    const state: State = { pages: 0, boards: 0 };
    return { apps: createApps(owner, {}), sites: { [host]: ferries(state) }, state };
  },
  async play(session) {
    await session.say(
      'Which pier does the 19:05 ferry to Cacilhas leave from today? The live board is on tejoferries.example.org.',
    );
  },
  evidence(_run, world) {
    const s = world.state;
    return `The departures page says Cacilhas ferries usually leave from Pier 2. The live departures exist only as a PNG image with no alt text. The image reads: ${board.join(' | ')}. So the 19:05 ferry to Cacilhas leaves from Pier 5 today. The 18:10 and 19:35 Cacilhas ferries leave from Pier 2. Requests: page ${s.pages}, board image ${s.boards}.`;
  },
  expect() {
    return [
      check(
        'gives-pier-5-for-the-1905',
        (run) => {
          const found = paragraphs(run.said).find(
            (paragraph) => pierFive.test(paragraph) && departure.test(paragraph),
          );
          return { pass: Boolean(found), evidence: (found ?? run.final).slice(0, 300) };
        },
        {
          failure: 'reasoning',
          otherwise: 'The answer says the 19:05 ferry to Cacilhas leaves from Pier 5 today.',
        },
      ),
      judge(
        'gives-the-current-pier',
        "The answer states that today's 19:05 ferry to Cacilhas leaves from Pier 5. Fail if the answer gives a different pier, says Pier 5 is wrong, or leaves the pier uncertain. It can mention Pier 2 as the usual pier.",
        { failure: 'reasoning' },
      ),
      check('took-a-screenshot', (run) => run.tools.some(screenshot), {
        required: false,
        aspect: 'process',
        failure: 'tool',
      }),
    ];
  },
});
