import { validateTravelSegment } from '../src/services/travel/travel-segment-validator.service';

type Case = { title: string; text: string; expectedValid: boolean };

const positives: Case[] = [
  {
    title: 'TAILANDIA IMPRESCINDIBLE',
    text: `TAILANDIA IMPRESCINDIBLE
10 / 7
Día 1 Ciudad de origen - Bangkok
SERVICIOS INCLUIDOS
SALIDAS 2026/27
PRECIO ORIENTATIVO`,
    expectedValid: true,
  },
  {
    title: 'JAPÓN CON JAPAN RAIL PASS RUTA 8',
    text: `JAPÓN CON JAPAN RAIL PASS RUTA 8
12 / 9
Día 1 Ciudad de origen - Tokio
SERVICIOS INCLUIDOS
SALIDAS
PRECIO ORIENTATIVO`,
    expectedValid: true,
  },
  {
    title: 'LUXURY VIETNAM Y CAMBOYA',
    text: `LUXURY VIETNAM Y CAMBOYA
14 / 11
Día 1 Ciudad de origen - Hanoi
SERVICIOS INCLUIDOS
SALIDAS 2026/27
PRECIO ORIENTATIVO
HOTELES (indicados o similares)`,
    expectedValid: true,
  },
  {
    title: 'PUERTO RICO DE LUJO',
    text: `PUERTO RICO DE LUJO
9 / 7
Día 1 Ciudad de origen - San Juan
SERVICIOS INCLUIDOS
SALIDAS
PRECIO ORIENTATIVO`,
    expectedValid: true,
  },
  {
    title: 'CARIBE MEXICANO DE LUJO',
    text: `CARIBE MEXICANO DE LUJO
8 / 6
Día 1 Ciudad de origen - Cancún
SERVICIOS INCLUIDOS
SALIDAS
PRECIO ORIENTATIVO`,
    expectedValid: true,
  },
];

const negatives: Case[] = [
  { title: 'CON BOUTIQUES DE LUJO Y UN RITMO FRENÉTICO QUE', text: 'Con boutiques de lujo...', expectedValid: false },
  { title: 'EN UN TEMPLO MILENARIO Y MARAVILLARNOS', text: 'En un templo milenario...', expectedValid: false },
  { title: 'VER EL TAJ MAHAL, UNA IMPRESIONANTE MARAVILLA', text: 'Ver el Taj Mahal...', expectedValid: false },
  { title: 'MARAVILLOSAS VISTAS PANORÁMICAS, HERMOSOS', text: 'Maravillosas vistas...', expectedValid: false },
  { title: 'DEL DÍA, A UN MARAVILLOSO JUEGO', text: 'Del día...', expectedValid: false },
  { title: "LUGAR DENTRO DE LA DISTINGUIDA FAMILIA 'SMALL LUXURY HOTELS", text: 'LUGAR DENTRO...', expectedValid: false },
  { title: 'EXTENSIONES A PLAYAS', text: 'EXTENSIONES A PLAYAS', expectedValid: false },
  { title: 'SOSTENIBILIDAD', text: 'SOSTENIBILIDAD', expectedValid: false },
  { title: 'APP ICÁRION', text: 'APP ICÁRION', expectedValid: false },
  { title: 'ÍNDICE', text: 'ÍNDICE', expectedValid: false },
];

for (const c of [...positives, ...negatives]) {
  const got = validateTravelSegment({ titleHint: c.title, segmentText: c.text });
  if (got.isValidTravel !== c.expectedValid) {
    console.error('FAIL segment validator', { title: c.title, expected: c.expectedValid, got });
    process.exit(1);
  }
}

console.log('OK: validate-segment-validator');

