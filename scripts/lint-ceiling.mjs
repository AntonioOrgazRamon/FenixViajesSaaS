// Lint del panel con techo: falla si hay más errores que la línea base (AGENTS.md, «Línea base»).
// El techo SOLO BAJA: si se corrigen errores de lint, MAX_ERRORS se baja en el mismo commit.
// Nunca se sube para dejar pasar un cambio.
import { spawnSync } from 'node:child_process';

const MAX_ERRORS = 37;

const res = spawnSync('npx', ['eslint', '.', '-f', 'json'], {
  cwd: 'apps/panel',
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
let results;
try {
  results = JSON.parse(res.stdout);
} catch {
  console.error('lint-ceiling: no se pudo leer la salida de eslint');
  console.error(res.stderr);
  process.exit(2);
}
const errors = results.reduce((n, r) => n + r.errorCount, 0);
const warnings = results.reduce((n, r) => n + r.warningCount, 0);
console.log(`lint panel: ${errors} errores, ${warnings} avisos (techo: ${MAX_ERRORS} errores)`);
if (errors > MAX_ERRORS) {
  console.error(`lint-ceiling: ${errors} > ${MAX_ERRORS}. Este cambio añade errores de lint.`);
  process.exit(1);
}
