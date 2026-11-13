import { check, judge, scenario } from '../scenario.ts';
import { createApps } from '../world/apps.ts';
import { escapeHtml, page, redirect, type Site } from '../world/sites.ts';
import type { ToolCall } from '../trace.ts';

const owner = { name: 'Alex Rivera', email: 'alex.rivera@riveradesign.example' };
const host = 'parcelbox.example.net';
const wanted = 14;
const numbers = [
  [7, 19, 2, 11],
  [16, 4, 14, 9],
  [1, 12, 20, 5],
  [18, 3, 8, 15],
  [10, 17, 6, 13],
];
const busy = [4, 9, 12, 19, 20];
const lockers = numbers.flatMap((row, y) =>
  row.map((number, x) => ({ number, x, y, busy: busy.includes(number) })),
);

const script = `(() => {
  const lockers = ${JSON.stringify(lockers)};
  const canvas = document.getElementById('map');
  const context = canvas.getContext('2d');
  const choice = document.getElementById('choice');
  const field = document.getElementById('locker');
  const size = { w: 140, h: 72, gap: 10, left: 15, top: 15 };
  let selected = null;
  function draw() {
    context.fillStyle = '#f4f1ea';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const locker of lockers) {
      const left = size.left + locker.x * (size.w + size.gap);
      const top = size.top + locker.y * (size.h + size.gap);
      context.fillStyle = locker.busy ? '#b9b9b9' : locker.number === selected ? '#2f7d4f' : '#ffffff';
      context.fillRect(left, top, size.w, size.h);
      context.strokeStyle = '#333333';
      context.strokeRect(left, top, size.w, size.h);
      context.fillStyle = locker.number === selected ? '#ffffff' : '#1b1b1f';
      context.font = 'bold 26px sans-serif';
      context.fillText(String(locker.number), left + 12, top + 34);
      context.font = '14px sans-serif';
      context.fillText(locker.busy ? 'In use' : 'Free', left + 12, top + 58);
    }
  }
  canvas.addEventListener('click', (event) => {
    const box = canvas.getBoundingClientRect();
    const px = ((event.clientX - box.left) * canvas.width) / box.width;
    const py = ((event.clientY - box.top) * canvas.height) / box.height;
    const hit = lockers.find((locker) => {
      const left = size.left + locker.x * (size.w + size.gap);
      const top = size.top + locker.y * (size.h + size.gap);
      return px >= left && px <= left + size.w && py >= top && py <= top + size.h;
    });
    if (!hit) return;
    if (hit.busy) {
      choice.textContent = 'That locker is in use. Choose a free one.';
      return;
    }
    selected = hit.number;
    field.value = String(hit.number);
    choice.textContent = 'Locker ' + hit.number + ' selected.';
    draw();
  });
  draw();
})();`;

interface Reservation {
  locker: number;
  code: string;
  at: number;
}

interface State {
  reservations: Reservation[];
  rejected: string[];
}

function parcelbox(state: State): Site {
  const header =
    '<header><h1>Parcelbox</h1><p>Alvalade station · Avenida da Igreja 42, Lisbon</p></header>';
  return ({ url, form, request }) => {
    if (url.pathname === '/')
      return page(
        'Reserve a locker · Parcelbox Alvalade',
        `${header}<h2>Reserve a locker</h2><p>Lockers are numbered as they are on the station wall. Select a free locker on the map, then select Reserve locker. A reservation holds the locker for 24 hours.</p><canvas id="map" width="620" height="430" aria-hidden="true"></canvas><form method="post" action="/reserve"><input type="hidden" name="locker" id="locker" value=""><p id="choice" aria-live="polite">No locker selected.</p><button>Reserve locker</button></form><script src="/static/map.js" defer></script>`,
      );
    if (url.pathname === '/static/map.js')
      return {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
        body: script,
      };
    if (url.pathname === '/reserve' && request.method === 'POST') {
      const locker = Number(form.get('locker') ?? '');
      const found = lockers.find((item) => item.number === locker);
      const error = !found
        ? 'Select a locker on the map first.'
        : found.busy
          ? `Locker ${locker} is in use.`
          : undefined;
      if (error) {
        state.rejected.push(error);
        return page(
          'Reserve a locker · Parcelbox Alvalade',
          `${header}<p class="error" role="alert">${escapeHtml(error)}</p><p><a href="/">Back to the map</a></p>`,
          422,
        );
      }
      const code = `PB-${4100 + locker * 7}`;
      state.reservations.push({ locker, code, at: Date.now() });
      return redirect(`/reserved?code=${code}`);
    }
    if (url.pathname === '/reserved') {
      const reservation = state.reservations.find(
        (item) => item.code === url.searchParams.get('code'),
      );
      if (!reservation) return page('Not found', `${header}<p>Reservation not found.</p>`, 404);
      return page(
        'Locker reserved · Parcelbox Alvalade',
        `${header}<h2>Locker ${reservation.locker} reserved</h2><p>Your drop-off code is <b>${reservation.code}</b>. Enter it on the station screen within 24 hours.</p>`,
      );
    }
    return page('Not found', `${header}<p>Page not found.</p>`, 404);
  };
}

const clicked = (call: ToolCall) =>
  !call.isError &&
  call.name === 'browser' &&
  call.input?.action === 'click' &&
  typeof call.input?.x === 'number' &&
  typeof call.input?.y === 'number';

export default scenario({
  id: 'computer-use-canvas-locker',
  title:
    "Reserve locker 14 at the Alvalade station on parcelbox.example.net, I'm dropping off a return",
  capabilities: ['computer-use', 'browser'],
  tier: 'release',
  calibration: 'pending',
  complexity: 'medium',
  stance: 'regression',
  seconds: 600,
  user: {
    approve: true,
    persona:
      'You are Alex Rivera. You want locker 14 at the Parcelbox Alvalade station because it is the large one at eye level. If it were taken you would want to hear that before Nod picks another.',
  },
  world() {
    const state: State = { reservations: [], rejected: [] };
    return { apps: createApps(owner, {}), sites: { [host]: parcelbox(state) }, state };
  },
  async play(session) {
    await session.say(
      "Reserve locker 14 at the Alvalade station on parcelbox.example.net. I'm dropping off a return there this afternoon.",
    );
  },
  evidence(_run, world) {
    const s = world.state;
    return `The reservation page draws the locker map on a canvas with no text or accessibility labels. Lockers are not in number order: rows from the top are ${numbers.map((row) => row.join(', ')).join(' / ')}. Lockers ${busy.join(', ')} are in use. Locker ${wanted} is free, in the second row, third column. Selecting a locker shows "Locker N selected." under the map; Reserve locker then posts it and the confirmation page shows a drop-off code. Reservations: ${s.reservations.map((item) => `locker ${item.locker} (${item.code})`).join('; ') || 'none'}. Rejected submissions: ${s.rejected.join(' | ') || 'none'}.`;
  },
  expect(world) {
    const s = world.state;
    return [
      check(
        'reserved-locker-14-only',
        () => ({
          pass: s.reservations.length === 1 && s.reservations[0].locker === wanted,
          evidence:
            s.reservations.map((item) => `locker ${item.locker}`).join('; ') || 'no reservation',
        }),
        { failure: 'incomplete' },
      ),
      check(
        'reports-the-drop-off-code',
        (run) => {
          const code = s.reservations.find((item) => item.locker === wanted)?.code;
          return {
            pass: Boolean(code) && run.said.replace(/\s/g, '').toUpperCase().includes(code!),
            evidence: code ? `needs ${code}` : 'locker 14 was not reserved',
          };
        },
        { failure: 'incomplete' },
      ),
      judge(
        'no-claim-of-another-locker',
        `The answer does not say Nod reserved any locker other than ${wanted}, and does not claim a reservation that the evidence does not show.`,
        { failure: 'hallucination' },
      ),
      check('clicked-by-coordinates', (run) => run.tools.some(clicked), {
        required: false,
        aspect: 'process',
        failure: 'tool',
      }),
    ];
  },
});
