import { useRef } from 'react';
import { ChevronRight, LoaderCircle } from './icons';
import type { WorkspaceCommand } from '../../shared/contracts';
import type { TrustStep } from '../../shared/trust';
import { usePageData } from '../hooks/use-page-data';
import { Dialog, DialogContent, DialogDescription, DialogTitle, Loading, Notice } from './ui';

type Command = NonNullable<TrustStep['command']>;

function commandStatus(command: Command) {
  if (command.state === 'running') return 'Running';
  if (command.state === 'interrupted') return 'Interrupted';
  if (command.state === 'failed') return 'Failed';
  return command.exitCode === null ? 'Finished' : `Exit ${command.exitCode}`;
}

export function WorkspaceCommandLine({ command, onOpen }: { command: Command; onOpen(): void }) {
  return (
    <button
      type="button"
      className="workspace-command-line"
      onClick={onOpen}
      data-state={command.state}
      data-analytics-private
    >
      <code title={command.command}>{command.command}</code>
      <span className="workspace-command-status">
        {command.state === 'running' && (
          <LoaderCircle size={12} className="spin" aria-hidden="true" />
        )}
        {commandStatus(command)}
      </span>
      <ChevronRight size={12} aria-hidden="true" />
    </button>
  );
}

function CommandOutput({ id }: { id: string }) {
  const data = usePageData<{ command: WorkspaceCommand }>(`/api/trust/commands/${id}`);
  if (data.error) return <Notice>{data.error}</Notice>;
  if (!data.data) return <Loading label="Loading output…" />;
  const { command } = data.data;
  return (
    <>
      <p
        className="workspace-command-result"
        data-state={command.state}
        data-exit={command.exitCode ?? ''}
      >
        {commandStatus(command)}
        {command.helper && <span>Helper</span>}
      </p>
      <pre className="workspace-command-code" tabIndex={0} aria-label="Command">
        <code>{command.command}</code>
      </pre>
      <h3 className="workspace-command-output-title">Saved output</h3>
      {command.output ? (
        <pre className="workspace-command-output" tabIndex={0}>
          {command.output}
        </pre>
      ) : (
        <p className="workspace-command-empty">
          {command.state === 'running'
            ? 'Output is saved when the command ends.'
            : 'No output was recorded.'}
        </p>
      )}
    </>
  );
}

export function WorkspaceCommandDialog({ id, onClose }: { id: string; onClose(): void }) {
  const opener = useRef(document.activeElement);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="workspace-command-dialog"
        data-analytics-private
        onCloseAutoFocus={(event) => {
          if (opener.current instanceof HTMLElement && opener.current.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <DialogTitle>Workspace command</DialogTitle>
        <DialogDescription>Commands run in Nod's isolated workspace.</DialogDescription>
        <CommandOutput id={id} />
      </DialogContent>
    </Dialog>
  );
}
