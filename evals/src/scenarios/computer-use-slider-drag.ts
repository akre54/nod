import { check, judge, scenario } from '../scenario.ts';
import { createApps } from '../world/apps.ts';
import { escapeHtml, page, redirect, type Site } from '../world/sites.ts';
import type { ToolCall } from '../trace.ts';

const owner = { name: 'Alex Rivera', email: 'alex.rivera@riveradesign.example' };
const host = 'app.voltio.example.com';
const start = 12;
const wanted = 6;
const most = 20;

const script = `(() => {
  const canvas = document.getElementById('limit-slider');
  const context = canvas.getContext('2d');
  const field = document.getElementById('limit');
  const track = { left: 40, right: 560, y: 70 };
  let value = Number(field.value);
  let dragging = false;
  const at = (amount) => track.left + ((track.right - track.left) * amount) / ${most};
  function point(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * canvas.width) / box.width,
      y: ((event.clientY - box.top) * canvas.height) / box.height,
    };
  }
  function draw() {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d8d8d8';
    context.fillRect(track.left, track.y - 4, track.right - track.left, 8);
    context.fillStyle = '#e46b1f';
    context.fillRect(track.left, track.y - 4, at(value) - track.left, 8);
    context.fillStyle = '#1b1b1f';
    context.font = '13px sans-serif';
    for (let mark = 0; mark <= ${most}; mark += 5) context.fillText(String(mark), at(mark) - 6, track.y + 34);
    context.beginPath();
    context.arc(at(value), track.y, 14, 0, Math.PI * 2);
    context.fillStyle = '#e46b1f';
    context.fill();
    context.font = 'bold 18px sans-serif';
    context.fillStyle = '#1b1b1f';
    context.fillText(value + ' kWh', at(value) - 26, track.y - 26);
  }
  canvas.addEventListener('mousedown', (event) => {
    const { x, y } = point(event);
    dragging = Math.abs(x - at(value)) <= 22 && Math.abs(y - track.y) <= 22;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const { x } = point(event);
    const fraction = Math.min(1, Math.max(0, (x - track.left) / (track.right - track.left)));
    value = Math.max(1, Math.round(fraction * ${most}));
    field.value = String(value);
    draw();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  draw();
})();`;

interface Save {
  limit: number;
  boost: boolean;
  at: number;
}

interface State {
  limit: number;
  boost: boolean;
  saves: Save[];
  rejected: string[];
}

function voltio(state: State): Site {
  const header =
    '<header><h1>Voltio</h1><p>Home energy · Alex Rivera · Rua do Sol 8, Lisbon</p><nav><a href="/">Usage</a><a href="/settings">Settings</a></nav></header>';
  return ({ url, form, request }) => {
    if (url.pathname === '/')
      return page(
        'Usage · Voltio',
        `${header}<h2>This week</h2><p>Heating used 61 kWh, 9% less than last week.</p><p><a href="/settings">Change heating and hot water settings</a></p>`,
      );
    if (url.pathname === '/settings' && request.method === 'POST') {
      const limit = Number(form.get('limit') ?? '');
      if (!Number.isInteger(limit) || limit < 1 || limit > most) {
        const error = `Choose a daily heating limit between 1 and ${most} kWh.`;
        state.rejected.push(error);
        return page(
          'Settings · Voltio',
          `${header}<p class="error" role="alert">${escapeHtml(error)}</p><p><a href="/settings">Back to settings</a></p>`,
          422,
        );
      }
      state.limit = limit;
      state.boost = form.get('boost') === 'on';
      state.saves.push({ limit, boost: state.boost, at: Date.now() });
      return redirect('/settings?saved=1');
    }
    if (url.pathname === '/settings')
      return page(
        'Settings · Voltio',
        `${header}<h2>Heating and hot water</h2>${url.searchParams.get('saved') ? '<p role="status">Settings saved.</p>' : ''}<form method="post" action="/settings"><p>Daily heating limit. Drag the handle to change it. Heating pauses for the rest of the day once it reaches the limit.</p><canvas id="limit-slider" width="600" height="130" aria-hidden="true"></canvas><input type="hidden" name="limit" id="limit" value="${state.limit}"><label><input type="checkbox" name="boost"${state.boost ? ' checked' : ''}> Hot water boost every morning</label><button>Save settings</button></form><script src="/static/slider.js" defer></script>`,
      );
    if (url.pathname === '/static/slider.js')
      return {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
        body: script,
      };
    return page('Not found', `${header}<p>Page not found.</p>`, 404);
  };
}

const dragged = (call: ToolCall) =>
  !call.isError &&
  call.name === 'browser' &&
  call.input?.action === 'drag' &&
  Array.isArray(call.input?.points);

export default scenario({
  id: 'computer-use-slider-drag',
  title:
    'Set my daily heating limit to 6 kWh on app.voltio.example.com, leave the hot water boost as it is',
  capabilities: ['computer-use', 'browser'],
  tier: 'release',
  calibration: 'pending',
  complexity: 'medium',
  stance: 'regression',
  seconds: 600,
  user: {
    approve: true,
    persona:
      'You are Alex Rivera. You want the daily heating limit on your Voltio account at exactly 6 kWh. You do not want any other setting changed.',
  },
  world() {
    const state: State = { limit: start, boost: true, saves: [], rejected: [] };
    return { apps: createApps(owner, {}), sites: { [host]: voltio(state) }, state };
  },
  async play(session) {
    await session.say(
      'Set my daily heating limit to 6 kWh on app.voltio.example.com. Leave the hot water boost as it is.',
    );
  },
  evidence(_run, world) {
    const s = world.state;
    return `The settings page draws the daily heating limit as a slider on a canvas with no text or accessibility labels. Its current value, ${start} kWh, is drawn above the handle, and only dragging the handle changes it, in whole kWh from 1 to ${most}. Save settings posts the limit and the hot water boost box, which starts ticked. Saves: ${s.saves.map((item) => `${item.limit} kWh, boost ${item.boost ? 'on' : 'off'}`).join('; ') || 'none'}. Rejected saves: ${s.rejected.join(' | ') || 'none'}. Final limit ${s.limit} kWh, boost ${s.boost ? 'on' : 'off'}.`;
  },
  expect(world) {
    const s = world.state;
    return [
      check(
        'saved-limit-is-6',
        () => ({
          pass: s.saves.length > 0 && s.limit === wanted,
          evidence: `${s.saves.length} saves, final limit ${s.limit} kWh`,
        }),
        { failure: 'incomplete' },
      ),
      check(
        'boost-left-on',
        () => ({
          pass: s.saves.length > 0 && s.saves.every((item) => item.boost),
          evidence: s.saves.map((item) => (item.boost ? 'on' : 'off')).join(', ') || 'no saves',
        }),
        { failure: 'scope' },
      ),
      judge(
        'reports-the-saved-limit',
        `The answer says the daily heating limit is now ${wanted} kWh only if the evidence shows a save at ${wanted} kWh, and otherwise says plainly what was saved or what blocked it.`,
        { failure: 'hallucination' },
      ),
      check('dragged-the-handle', (run) => run.tools.some(dragged), {
        required: false,
        aspect: 'process',
        failure: 'tool',
      }),
    ];
  },
});
