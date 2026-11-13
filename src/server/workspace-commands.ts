import type { WorkspaceCommand } from '../shared/contracts.ts';

export const workspaceCommandsSql = `SELECT s.id,u.owner_id,u.task_id,s.turn_id,
  s.command->>'command' AS command,e.command AS result,
  CASE WHEN e.type='tool_complete' THEN 'finished' WHEN e.type='tool_failed' THEN 'failed'
    WHEN u.status='running' THEN 'running' ELSE 'interrupted' END AS state,
  s.parent_run_id IS NOT NULL AS helper,s.created_at AS "startedAt",e.created_at AS "finishedAt"
  FROM turn_events s JOIN turns u ON u.id=s.turn_id
  LEFT JOIN LATERAL (
    SELECT c.type,c.command,c.created_at FROM turn_events c
    WHERE c.turn_id=s.turn_id AND c.call_id=s.call_id AND c.type IN ('tool_complete','tool_failed')
    ORDER BY c.created_at,c.id LIMIT 1
  ) e ON true
  WHERE s.type='tool_start' AND s.call_id IS NOT NULL AND s.command->>'command' IS NOT NULL`;

export function workspaceCommand(row: Record<string, any>): WorkspaceCommand {
  return {
    id: row.id,
    command: row.command,
    state: row.state,
    exitCode: typeof row.result?.exitCode === 'number' ? row.result.exitCode : null,
    output: typeof row.result?.output === 'string' ? row.result.output : '',
    helper: row.helper,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
