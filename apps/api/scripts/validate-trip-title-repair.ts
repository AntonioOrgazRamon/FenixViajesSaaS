/**
 * Casos validateAndRepairTripTitle
 * npx ts-node --transpile-only scripts/validate-trip-title-repair.ts
 */
import type { IndexExpectedTrip } from '../src/services/travel/travel-index-coverage.service';
import {
  stripLeadingPageNumberFromTitle,
  titleHasNarrativeContamination,
  validateAndRepairTripTitle,
} from '../src/services/travel/trip-title-repair.service';

const emptyCtx = { indexEntries: [] as IndexExpectedTrip[], pageStart: 1, pageEnd: 5 };

let failed = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error('FAIL:', name, detail ?? '');
    failed++;
  }
}

assert('strip 56', stripLeadingPageNumberFromTitle('56 Tailandia Por Libre') === 'Tailandia Por Libre');
assert('strip 354', stripLeadingPageNumberFromTitle('354 LUXURY BUTÁN') === 'LUXURY BUTÁN');

assert('contam: acantilado', titleHasNarrativeContamination('MARAVILLOSA DEL ACANTILADO Y YELLOW BRIDGE'));
assert('contam: veremos', titleHasNarrativeContamination('SRI LANKA VEREMOS MUCHO'));

const tailandiaSeg = `
NORTE DE TAILANDIA AL COMPLETO
Chiang Mai
12 / 9
DÍA 1 CIUDAD DE ORIGEN
SERVICIOS INCLUIDOS hotel
SALIDAS 2026
PRECIO ORIENTATIVO 2.900 €
`;
const rT = validateAndRepairTripTitle('Norte de Tailandia la Completo', tailandiaSeg, emptyCtx);
assert('completo typo', rT.title?.includes('AL COMPLETO') === true && rT.ok, JSON.stringify(rT));

const rClean = validateAndRepairTripTitle('56 Tailandia Por Libre', tailandiaSeg, {
  ...emptyCtx,
});
assert('56 strip clean', rClean.title === 'Tailandia Por Libre' && rClean.ok, JSON.stringify(rClean));

const dirtySeg = `
 Línea basura maravillosa
SINGAPUR E ICONOS DE MALASIA
Singapur
15 / 12
DÍA 1 ORIGEN
SERVICIOS INCLUIDOS
SALIDAS
PRECIO ORIENTATIVO
`;
const rRep = validateAndRepairTripTitle('MARAVILLOSA DEL ACANTILADO Y YELLOW BRIDGE', dirtySeg, emptyCtx);
assert('repair narrative', rRep.ok && /SINGAPUR/i.test(rRep.title ?? ''), JSON.stringify(rRep));

if (failed) {
  console.error(`\n${failed} error(es).`);
  process.exit(1);
}
console.log('OK — validate-trip-title-repair');
