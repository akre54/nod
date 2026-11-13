import type { ModelDefinition } from '../../src/ports/models.ts';
import { createPiModelBackend, modelContextBudget } from '../../src/providers/pi/models.ts';
import { agentModels } from '../../src/shared/model-defaults.ts';
import { modelProviders, type ModelEffort, type ModelProvider } from '../../src/shared/models.ts';
import type { RunSummary } from './results.ts';
import type { Capability } from './scenario.ts';

export const measuredCapabilities = {
  'Computer use': 'computer-use',
  'Tool selection': 'apps',
  Coding: 'files',
} as const satisfies Record<string, Capability>;

type Measured = keyof typeof measuredCapabilities;

export interface CapabilityRow {
  model: string;
  images: boolean | null;
  contextWindow: number | null;
  compact: boolean | null;
  efforts: ModelEffort[];
  measured: Record<Measured, { passAt1: number; scenarios: number; label: string } | null>;
}

const usable = (summary: RunSummary) =>
  !summary.contaminated &&
  summary.coverage.incomplete === 0 &&
  summary.coverage.missing.length === 0;

export async function capabilityMatrix(runs: Array<{ label: string; summary: RunSummary }>) {
  const backend = createPiModelBackend({
    fetch: async () => {
      throw new Error('The capability matrix reads only the model catalog bundled with Nod.');
    },
  });
  const catalogs = new Map<ModelProvider, Promise<ModelDefinition[]>>();
  const catalog = (provider: ModelProvider) => {
    if (!catalogs.has(provider)) catalogs.set(provider, backend.catalog(provider, 'api_key'));
    return catalogs.get(provider)!;
  };
  const newest = [...runs]
    .filter((run) => usable(run.summary))
    .sort((a, b) => b.summary.manifest.startedAt.localeCompare(a.summary.manifest.startedAt));
  const models = [
    ...new Set([
      ...Object.entries(agentModels).map(([provider, id]) => `${provider}/${id}`),
      ...newest.map((run) => run.summary.manifest.model),
    ]),
  ];
  return Promise.all(
    models.map(async (model): Promise<CapabilityRow> => {
      const [provider, ...rest] = model.split('/');
      const known = modelProviders.find((item) => item === provider && item !== 'compatible');
      const definition = known
        ? (await catalog(known)).find((item) => item.choice.id === rest.join('/'))
        : undefined;
      const budget = definition
        ? modelContextBudget(definition.spec as Parameters<typeof modelContextBudget>[0])
        : undefined;
      const measured = Object.fromEntries(
        Object.entries(measuredCapabilities).map(([name, capability]) => {
          for (const run of newest) {
            if (run.summary.manifest.model !== model) continue;
            const found = run.summary.capabilities.find(
              (item) => item.capability === capability && item.passAt1 !== null,
            );
            if (found)
              return [
                name,
                { passAt1: found.passAt1!, scenarios: found.scenarios, label: run.label },
              ];
          }
          return [name, null];
        }),
      ) as CapabilityRow['measured'];
      return {
        model,
        images: definition?.choice.images ?? null,
        contextWindow: budget?.window ?? null,
        compact: budget?.compact ?? null,
        efforts: definition?.choice.efforts ?? [],
        measured,
      };
    }),
  );
}

export function capabilityTable(rows: CapabilityRow[]) {
  const known = (value: boolean | null, yes: string, no: string) =>
    value === null ? 'Unknown' : value ? yes : no;
  const names = Object.keys(measuredCapabilities) as Measured[];
  return [
    `| Model | Image input | Context window | Context profile | Thinking levels | ${names.join(' | ')} |`,
    `| --- | --- | --- | --- | --- | ${names.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) =>
        `| ${[
          `\`${row.model}\``,
          known(row.images, 'Yes', 'No'),
          row.contextWindow === null ? 'Unknown' : row.contextWindow.toLocaleString('en-US'),
          known(row.compact, 'Compact', 'Full'),
          row.efforts.join(', ') || 'Unknown',
          ...names.map((name) => {
            const value = row.measured[name];
            return value
              ? `${Math.round(value.passAt1 * 100)}% over ${value.scenarios} scenarios (${value.label})`
              : 'Not measured';
          }),
        ].join(' | ')} |`,
    ),
  ].join('\n');
}
