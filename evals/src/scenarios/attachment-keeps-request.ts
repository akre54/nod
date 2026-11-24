import { noWrites } from '../checks.ts';
import { judge, scenario } from '../scenario.ts';
import { createApps } from '../world/apps.ts';

export default scenario({
  id: 'attachment-keeps-request',
  title: 'Use an attachment without asking for the task again',
  capabilities: ['files', 'progress'],
  tier: 'pr',
  complexity: 'simple',
  stance: 'regression',
  calibration: 'pending',
  seconds: 240,
  user: { approve: false },
  world() {
    return { apps: createApps({ name: 'Alex Rivera', email: 'alex@studio.example' }, {}) };
  },
  async play(session) {
    await session.say(
      'I will upload supplier quotes next. After the file arrives, compare the prices and delivery times in a table. I need delivery within four days. Recommend the cheapest eligible option. Use only the supplied facts and do not contact anyone.',
    );
    const file = await session.upload(
      'supplier-quotes.txt',
      Buffer.from(
        'Aspen: EUR 120, delivery in three days.\nLinden: EUR 150, delivery in two days.\nElm: EUR 110, delivery in six days.\n',
      ),
      'text/plain',
    );
    await session.say('', { attach: [file] });
  },
  expect() {
    return [
      noWrites('create', 'update', 'delete', 'draft', 'send', 'post'),
      judge(
        'attachment-comparison-is-delivered',
        'After the file arrives without text, Nod uses the earlier request and delivers a table with all three prices and delivery times. It recommends Aspen as the cheapest option within four days and explains that Elm is too late. The table is visible in chat or an accessible shared file. It does not ask what to do with the attachment, request the same file again, resume unrelated work, or stop at a promise.',
        { failure: 'incomplete' },
      ),
    ];
  },
});
