import { buildIndexCoverageSegments } from '../src/services/travel/travel-index-coverage.service';

const pages = [
  { page: 2, text: 'ÍNDICE\nTAILANDIA IMPRESCINDIBLE 10\nLUXURY VIETNAM Y CAMBOYA 20\nJAPÓN HISTÓRICO 30' },
  { page: 10, text: 'TAILANDIA IMPRESCINDIBLE\n9 / 7\nDía 1 Ciudad de origen - Bangkok\nSERVICIOS INCLUIDOS\nSALIDAS\nPRECIO ORIENTATIVO' },
  { page: 11, text: 'Día 2 Bangkok' },
  { page: 20, text: 'LUXURY VIETNAM Y CAMBOYA\n14 / 11\nDía 1 Hanoi\nSERVICIOS INCLUIDOS\nSALIDAS\nPRECIO ORIENTATIVO' },
  { page: 21, text: 'Día 2 Hanoi' },
  { page: 30, text: 'JAPÓN HISTÓRICO\n11 / 8\nDía 1 Tokio\nSERVICIOS INCLUIDOS\nSALIDAS\nPRECIO ORIENTATIVO' },
  { page: 31, text: 'Día 2 Tokio' },
];

const built = buildIndexCoverageSegments(pages);
if (built.expected.length !== 3) {
  console.error('FAIL expected from index', built.expected);
  process.exit(1);
}
if (built.segments.length < 3) {
  console.error('FAIL segments from index', built.segments.length);
  process.exit(1);
}
if (!built.segments.some((s) => /LUXURY VIETNAM Y CAMBOYA/i.test(s.title) && s.pageStart === 20)) {
  console.error('FAIL missing expected indexed segment', built.segments);
  process.exit(1);
}

console.log('OK: validate-index-coverage');

