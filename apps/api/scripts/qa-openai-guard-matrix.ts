/**
 * Matriz QA OpenAIUsageGuard vía subprocesos (cada uno carga config con env distinto).
 * npm run qa:openai-matrix
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cwd = path.join(__dirname, '..');

type Row = { id: string; env: Record<string, string> };

const rows: Row[] = [
  { id: 'kill_switch', env: { OPENAI_GLOBAL_KILL_SWITCH: 'true' } },
  { id: 'intent_disabled', env: { OPENAI_INTENT_ENABLED: 'false' } },
  { id: 'copy_disabled', env: { OPENAI_COPY_ENABLED: 'false' } },
  { id: 'embed_disabled', env: { OPENAI_EMBEDDINGS_ENABLED: 'false' } },
  { id: 'daily_cap', env: { OPENAI_MAX_DAILY_EUROS_PER_COMPANY: '0' } },
  { id: 'monthly_cap', env: { OPENAI_MAX_MONTHLY_EUROS_PER_COMPANY: '0' } },
  {
    id: 'allowed',
    env: {
      OPENAI_GLOBAL_KILL_SWITCH: 'false',
      OPENAI_INTENT_ENABLED: 'true',
      OPENAI_MAX_DAILY_EUROS_PER_COMPANY: '50',
      OPENAI_MAX_MONTHLY_EUROS_PER_COMPANY: '500',
    },
  },
];

let failed = false;
for (const r of rows) {
  const cmd = `npx ts-node --transpile-only scripts/qa-guard-probe-runner.ts ${r.id}`;
  const res = spawnSync(cmd, {
    shell: true,
    cwd,
    env: { ...process.env, ...r.env },
    encoding: 'utf-8',
  });
  const out = (res.stdout || '') + (res.stderr || '');
  const ok = res.status === 0;
  if (!ok) failed = true;
  console.log(`--- ${r.id} (exit ${res.status}) ---`);
  if (res.error) console.log('spawn error:', res.error.message);
  console.log(out.trim() || '(sin salida)');
}

process.exit(failed ? 1 : 0);
