/**
 * Heurística determinista: presupuesto por persona → etiqueta de gama (texto para query semántica).
 */
export function inferBudgetTierLabel(budgetPerPerson: number | undefined): string | null {
  if (budgetPerPerson == null || !Number.isFinite(budgetPerPerson)) return null;
  const b = budgetPerPerson;
  if (b < 1200) return 'económica / valor';
  if (b < 2500) return 'media';
  if (b < 4500) return 'premium';
  if (b < 8000) return 'alta gama';
  return 'ultra lujo';
}
