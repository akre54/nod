import { useEffect, useState } from 'react';
import { ApiError, apiStream } from '../lib/api';
import { browserFrames } from '../lib/browser-frames';
import { BrandMark } from './brand';
import { Button, Loading } from './ui';

export function BrowserWatch({ taskId, title }: { taskId: string; title: string }) {
  const [attempt, setAttempt] = useState(0);
  const [frame, setFrame] = useState('');
  const [ended, setEnded] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let current = '';
    const release = () => {
      if (current) URL.revokeObjectURL(current);
      current = '';
    };
    setFrame('');
    setEnded('');
    void apiStream(
      `/api/browser-watch/stream?taskId=${encodeURIComponent(taskId)}`,
      { signal: controller.signal },
      (body) =>
        browserFrames(body, (bytes) => {
          const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
          release();
          current = url;
          setFrame(url);
        }),
    ).catch((reason) => {
      if (controller.signal.aborted) return;
      release();
      setFrame('');
      setEnded(reason instanceof ApiError ? reason.message : 'The browser view ended.');
    });
    return () => {
      controller.abort();
      release();
    };
  }, [taskId, attempt]);
  return (
    <div className="browser-handoff" role="region" aria-label={`Browser for ${title}`}>
      <div className="browser-handoff-header">
        <BrandMark small />
        <span className="browser-handoff-title">Browser</span>
        <span className="browser-handoff-state" role="status" aria-live="polite">
          {ended ? 'Not showing' : frame ? 'Nod has control' : 'Opening…'}
        </span>
      </div>
      <div className="browser-handoff-screen">
        {frame && !ended ? (
          <img src={frame} alt={`Nod's browser for ${title}`} draggable={false} />
        ) : ended ? (
          <div className="browser-handoff-recovery">
            <p>{ended}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
              Watch again
            </Button>
          </div>
        ) : (
          <Loading label="Opening Nod's browser…" />
        )}
      </div>
      <div className="browser-handoff-bar">
        <span>You're watching. Nod keeps control of this page.</span>
      </div>
    </div>
  );
}
