import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams, useLocation } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  Beaker,
  Compass,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { labelTravelStyleAxisEs } from '../../../lib/esLabels';
import { useDemoPresentationMode } from '../../../lib/demoPresentationMode';
import { useAuthStore } from '../../../store/authStore';
import type { Company, Paginated } from '../../../types/domain';
import type {
  TravelSearchIntentForm,
  TravelSearchResponse,
  TravelSearchResultItem,
  TravelStyleAxis,
} from '../types/travelRecommendation';

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

const STYLE_AXES: TravelStyleAxis[] = [
  'CULTURE',
  'NATURE',
  'GASTRONOMY',
  'BEACH',
  'ADVENTURE',
  'WELLNESS',
  'CITY_BREAK',
  'FAMILY',
  'HONEYMOON',
  'NIGHTLIFE',
  'CRUISE',
  'SAFARI',
  'SKI',
  'ROAD_TRIP',
  'SHOPPING',
  'SENIOR_FRIENDLY',
  'ACCESSIBILITY',
  'WILDLIFE',
  'PHOTOGRAPHY',
];

type TripSnippet = {
  id: string;
  title: string | null;
  mainDestination: string | null;
  durationDays: number | null;
  indicativePrice: unknown;
  currency: string | null;
};

type PlaygroundResult = {
  search: TravelSearchResponse;
  trips: Record<string, TripSnippet>;
};

function emptyForm(): TravelSearchIntentForm {
  return {
    destination: '',
    durationDays: '',
    budgetPerPerson: '',
    month: '',
    approximateStartDate: '',
    travelers: '',
    travelType: '',
    preferences: '',
    travelStyleAxes: [],
  };
}

function buildIntentPayload(form: TravelSearchIntentForm, telemetryVerbose: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    telemetryVerbose,
  };
  const d = form.destination.trim();
  if (d) body.destination = d;
  const dur = form.durationDays.trim();
  if (dur) {
    const n = parseInt(dur, 10);
    if (Number.isFinite(n) && n > 0) body.durationDays = n;
  }
  const bud = form.budgetPerPerson.trim();
  if (bud) {
    const n = parseFloat(bud);
    if (Number.isFinite(n) && n > 0) body.budgetPerPerson = n;
  }
  const mo = form.month.trim();
  if (mo) {
    const n = parseInt(mo, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 12) body.month = n;
  }
  const ad = form.approximateStartDate.trim();
  if (ad) body.approximateStartDate = ad;
  const tv = form.travelers.trim();
  if (tv) {
    const n = parseInt(tv, 10);
    if (Number.isFinite(n) && n > 0) body.travelers = n;
  }
  const tt = form.travelType.trim();
  if (tt) body.travelType = tt;
  const pref = form.preferences.trim();
  if (pref) body.preferences = [pref];
  if (form.travelStyleAxes.length) body.travelStyleAxes = form.travelStyleAxes;
  return body;
}

function formatMoney(amount: unknown, currency: string | null | undefined): string {
  if (amount == null) return '—';
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (!Number.isFinite(n)) return '—';
  const cur = currency?.trim() || 'EUR';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${cur}`;
  }
}

function matchBadgeClass(ms: string): string {
  switch (ms) {
    case 'STRONG_MATCH':
      return 'bg-emerald-500/15 text-emerald-900 ring-emerald-500/25 dark:text-emerald-100';
    case 'WEAK_MATCH':
      return 'bg-amber-500/15 text-amber-950 ring-amber-500/25 dark:text-amber-100';
    case 'NO_MATCH':
      return 'bg-rose-500/15 text-rose-950 ring-rose-500/25 dark:text-rose-100';
    case 'NEEDS_CLARIFICATION':
      return 'bg-violet-500/15 text-violet-950 ring-violet-500/30 dark:text-violet-100';
    default:
      return 'bg-zinc-500/15 text-zinc-800 ring-zinc-500/20 dark:text-zinc-200';
  }
}

function matchLabel(ms: string): string {
  switch (ms) {
    case 'STRONG_MATCH':
      return 'Encaje alto';
    case 'WEAK_MATCH':
      return 'Encaje moderado';
    case 'NO_MATCH':
      return 'Sin encaje claro';
    case 'NEEDS_CLARIFICATION':
      return 'Aclarar intención';
    default:
      return ms;
  }
}

export function TravelRecommendationPlaygroundPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [companyId, setCompanyId] = useState('');
  const [form, setForm] = useState<TravelSearchIntentForm>(emptyForm);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const demoMode = useDemoPresentationMode();
  const debugMode = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true';
  /** En modo demo no forzamos telemetría verbosa ni badges QA aunque venga ?debug=1 */
  const qaDeepMode = debugMode && !demoMode;

  useEffect(() => {
    const fromState = (location.state as { prefillDestination?: string } | undefined)?.prefillDestination?.trim();
    const fromQuery = searchParams.get('dest')?.trim();
    const v = fromState || fromQuery;
    if (v) setForm((f) => ({ ...f, destination: v }));
  }, [location.state, searchParams]);

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'all-short', 'rec-playground'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<Company> }>(
        '/superadmin/companies',
        { params: { page: 1, pageSize: 200 } },
      );
      return unwrap(body);
    },
    enabled: isSuper,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isSuper && companiesQ.data?.data?.length && !companyId) {
      setCompanyId(companiesQ.data.data[0].id);
    }
  }, [isSuper, companiesQ.data, companyId]);

  useEffect(() => {
    if (!isSuper && user?.companyId) setCompanyId(user.companyId);
  }, [isSuper, user?.companyId]);

  const canSearch = isSuper ? !!companyId : !!user?.companyId;
  const sp = useCallback(() => superParams(isSuper ? companyId || undefined : undefined), [isSuper, companyId]);

  const searchM = useMutation({
    mutationFn: async (): Promise<PlaygroundResult> => {
      const payload = buildIntentPayload(form, qaDeepMode);
      const { data: body } = await api.post<{ success: boolean; data: TravelSearchResponse }>(
        '/travel/trips/search-intent',
        payload,
        { params: sp() },
      );
      const search = unwrap<TravelSearchResponse>(body);
      const topIds = search.ranked.slice(0, 5).map((r) => r.tripId);
      const trips: Record<string, TripSnippet> = {};
      await Promise.all(
        topIds.map(async (id) => {
          try {
            const { data: tr } = await api.get<{ success: boolean; data: TripSnippet }>(`/travel/trips/${id}`, {
              params: sp(),
            });
            const row = unwrap<TripSnippet>(tr);
            trips[id] = row;
          } catch {
            trips[id] = {
              id,
              title: null,
              mainDestination: null,
              durationDays: null,
              indicativePrice: null,
              currency: null,
            };
          }
        }),
      );
      return { search, trips };
    },
  });

  const applyPreset = (key: string) => {
    switch (key) {
      case 'argentina':
        setForm({
          ...emptyForm(),
          destination: 'Argentina',
          durationDays: '10',
          budgetPerPerson: '8500',
          travelType: 'cultural premium',
          travelStyleAxes: ['CULTURE', 'GASTRONOMY'],
        });
        break;
      case 'patagonia':
        setForm({
          ...emptyForm(),
          destination: 'Patagonia',
          durationDays: '12',
          budgetPerPerson: '4800',
          travelStyleAxes: ['NATURE', 'ADVENTURE'],
          travelType: 'naturaleza',
        });
        break;
      case 'uruguay':
        setForm({
          ...emptyForm(),
          destination: 'Uruguay',
          durationDays: '6',
          budgetPerPerson: '2400',
          travelStyleAxes: ['GASTRONOMY', 'NATURE'],
          preferences: 'enoturismo, vinos',
        });
        break;
      case 'cheap':
        setForm({
          ...emptyForm(),
          destination: 'Praga',
          durationDays: '4',
          budgetPerPerson: '380',
          travelType: 'city break',
          travelStyleAxes: ['CITY_BREAK', 'CULTURE'],
        });
        break;
      case 'invented':
        setForm({
          ...emptyForm(),
          destination: 'Planeta Zargoth',
          durationDays: '7',
          budgetPerPerson: '12000',
          travelType: 'premium',
        });
        break;
      case 'empty':
        setForm(emptyForm());
        break;
      default:
        break;
    }
  };

  const result = searchM.data;
  const topFive = result?.search.ranked.slice(0, 5) ?? [];

  const transparencyLines = useMemo(() => {
    if (!result) return [];
    const ts = result.search.trustSummary;
    const lines: string[] = [];

    if (demoMode) {
      lines.push(`Claridad de la intención: ${Math.round(ts.intentCompleteness * 100)}%`);
      const geo = result.search.premiumUx.geoContextLine;
      if (geo) lines.push(geo);
      lines.push(result.search.premiumUx.similarAlternativesSummary);
      return lines;
    }

    lines.push(
      `Completitud de intención: ${Math.round(ts.intentCompleteness * 100)}%`,
      `Catálogo evaluable: ${ts.catalogTripCount} circuitos`,
      `Proporción en ranking final: ${Math.round(ts.catalogEligibleRatio * 100)}%`,
      `Dimensiones de scoring (top-1): ${ts.topMatchCoverageDimensions ?? '—'}`,
    );
    if (ts.topRawScoreIfAdjusted != null) {
      lines.push(`Score bruto top-1 (si hubo cap): ${ts.topRawScoreIfAdjusted}`);
    }
    const topCov = result.search.ranked[0]?.matchCoverageDimensions;
    if (topCov != null) {
      lines.push(`Dimensiones de cobertura (top-1 circuito): ${topCov}`);
    }
    const geo = result.search.premiumUx.geoContextLine;
    if (geo) lines.push(geo);
    lines.push(result.search.premiumUx.similarAlternativesSummary);
    return lines;
  }, [result, demoMode]);

  const errMsg = searchM.isError
    ? isAxiosError(searchM.error)
      ? (searchM.error.response?.data as { error?: { message?: string } })?.error?.message ??
        searchM.error.message
      : 'Error desconocido'
    : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full min-w-0 bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.09),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(99,102,241,0.06),_transparent_50%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600 dark:text-teal-400">
              Viajes · motor
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
              Laboratorio de recomendación
              {demoMode ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-500/25 dark:text-violet-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Demo
                </span>
              ) : null}
              {qaDeepMode ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-500/25 dark:text-amber-100">
                  <Beaker className="h-3.5 w-3.5" />
                  QA
                </span>
              ) : null}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {demoMode
                ? 'Visualiza cómo el motor sintetiza intención y catálogo, con narrativa premium y sin ruido técnico.'
                : 'Ejecuta intents manuales contra el endpoint de búsqueda por intención. Ideal para demos y calibración visual.'}{' '}
              {!demoMode && (
                <span className="text-zinc-500">
                  Añade <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">?demo=1</code> o{' '}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">?debug=1</code> según necesites.
                </span>
              )}
            </p>
          </div>

          {isSuper ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Empresa (super admin)
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={cn(
                  'rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-950',
                  'border-zinc-200 dark:border-zinc-800',
                )}
              >
                {(companiesQ.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </header>

        {demoMode ? (
          <section
            className="rounded-2xl border border-teal-200/70 bg-gradient-to-r from-teal-500/[0.08] to-violet-500/[0.05] p-5 shadow-sm dark:border-teal-900/45 dark:from-teal-500/15 dark:to-violet-500/10"
            aria-label="Guía de demostración"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-200">
              Historia en 3 pasos
            </p>
            <ol className="mt-4 grid list-none gap-4 text-sm leading-snug text-zinc-700 dark:text-zinc-300 sm:grid-cols-3">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/25 text-xs font-bold text-teal-950 dark:text-teal-50">
                  1
                </span>
                <span>
                  Define la intención (preset rápido o campos manuales): destino, días y presupuesto orientativo.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/25 text-xs font-bold text-teal-950 dark:text-teal-50">
                  2
                </span>
                <span>Pulsa <strong className="font-semibold text-zinc-900 dark:text-white">Buscar</strong> y observa cómo el motor rankea el catálogo con narrativa clara.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/25 text-xs font-bold text-teal-950 dark:text-teal-50">
                  3
                </span>
                <span>
                  Revisa transparencia y top recomendaciones; en reuniones usa solo esta vista (sin{' '}
                  <code className="rounded bg-white/80 px-1 text-[11px] dark:bg-black/40">?debug=1</code>).
                </span>
              </li>
            </ol>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section
              className={cn(
                'rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80',
                demoMode && 'border-teal-200/50 dark:border-teal-900/40',
              )}
            >
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Intención de búsqueda</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Destino
                  <input
                    value={form.destination}
                    onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="p. ej. Patagonia"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Días
                    <input
                      value={form.durationDays}
                      onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
                      inputMode="numeric"
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      placeholder="12"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    € / persona
                    <input
                      value={form.budgetPerPerson}
                      onChange={(e) => setForm((f) => ({ ...f, budgetPerPerson: e.target.value }))}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      placeholder="4500"
                    />
                  </label>
                </div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Mes (1–12)
                  <input
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Opcional"
                  />
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Fecha aproximada (ISO)
                  <input
                    value={form.approximateStartDate}
                    onChange={(e) => setForm((f) => ({ ...f, approximateStartDate: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="2026-03-15"
                  />
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Viajeros
                  <input
                    value={form.travelers}
                    onChange={(e) => setForm((f) => ({ ...f, travelers: e.target.value }))}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="2"
                  />
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Tipo de viaje (texto)
                  <input
                    value={form.travelType}
                    onChange={(e) => setForm((f) => ({ ...f, travelType: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="cultural, luna de miel…"
                  />
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Preferencias (una línea)
                  <input
                    value={form.preferences}
                    onChange={(e) => setForm((f) => ({ ...f, preferences: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="vuelos directos, gastronomía…"
                  />
                </label>
                {!demoMode ? (
                  <fieldset className="space-y-2">
                    <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Estilos estructurados
                    </legend>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-200/90 p-2 dark:border-zinc-800">
                      <div className="flex flex-wrap gap-2">
                        {STYLE_AXES.map((axis) => {
                          const on = form.travelStyleAxes.includes(axis);
                          return (
                            <button
                              key={axis}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  travelStyleAxes: on
                                    ? f.travelStyleAxes.filter((x) => x !== axis)
                                    : [...f.travelStyleAxes, axis],
                                }))
                              }
                              className={cn(
                                'rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition',
                                on
                                  ? 'bg-teal-500/15 text-teal-900 ring-teal-500/30 dark:text-teal-100'
                                  : 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700',
                              )}
                            >
                              {labelTravelStyleAxisEs(axis)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </fieldset>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Estilos seleccionados:{' '}
                    {form.travelStyleAxes.length
                      ? form.travelStyleAxes.map((x) => labelTravelStyleAxisEs(x)).join(', ')
                      : 'ninguno'}{' '}
                    — en modo normal puedes editar los chips.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={!canSearch || searchM.isPending}
                onClick={() => void searchM.mutate()}
                className={cn(
                  'mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition',
                  'bg-teal-600 text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-45',
                )}
              >
                {searchM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
                Ejecutar búsqueda
              </button>
            </section>

            <section className="rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                <Wand2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Atajos
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { id: 'argentina', label: 'Argentina cultural premium' },
                  { id: 'patagonia', label: 'Patagonia naturaleza' },
                  { id: 'uruguay', label: 'Uruguay vino' },
                  { id: 'cheap', label: 'Viaje corto barato' },
                  { id: 'invented', label: 'Destino inventado' },
                  { id: 'empty', label: 'Intent vacío' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="min-w-0 space-y-6">
            {searchM.isPending ? (
              <PlaygroundSkeleton demoMode={demoMode} />
            ) : errMsg ? (
              <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-500/10 p-5 text-rose-950 dark:border-rose-900/50 dark:bg-rose-500/10 dark:text-rose-50">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">No se pudo ejecutar la búsqueda</p>
                  <p className="mt-1 text-sm opacity-90">{errMsg}</p>
                </div>
              </div>
            ) : !result ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-12 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Configura un intent y pulsa <strong>Ejecutar búsqueda</strong>, o usa un atajo.
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Sin OpenAI: solo motor determinista + narrativa <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">premiumUx</code>.
                </p>
              </div>
            ) : (
              <>
                <section
                  className={cn(
                    'rounded-2xl border border-zinc-200/90 bg-white/95 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/85',
                    demoMode && 'border-teal-200/40 shadow-md shadow-teal-500/5 dark:border-teal-900/35',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
                        Resultado global
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
                            matchBadgeClass(result.search.matchState),
                          )}
                        >
                          {matchLabel(result.search.matchState)}
                        </span>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          Confianza global{' '}
                          <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
                            {result.search.globalConfidence != null
                              ? `${Math.round(result.search.globalConfidence * 100)}%`
                              : 'n/d'}
                          </strong>
                        </span>
                        {!demoMode ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Catálogo: {result.search.totalCandidates} · Ranking: {result.search.ranked.length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
                    {result.search.premiumUx.humanReadableReasoning}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <ConfidenceMini
                      title={result.search.premiumUx.confidencePanel.matchQualityHeadline}
                      body={result.search.premiumUx.confidencePanel.matchQualityBody}
                    />
                    <ConfidenceMini
                      title={result.search.premiumUx.confidencePanel.catalogCoverageHeadline}
                      body={result.search.premiumUx.confidencePanel.catalogCoverageBody}
                    />
                    <ConfidenceMini
                      title={result.search.premiumUx.confidencePanel.confidenceHeadline}
                      body={result.search.premiumUx.confidencePanel.confidenceBody}
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-50">
                    <strong className="font-semibold">Riesgo:</strong>{' '}
                    {result.search.premiumUx.confidencePanel.partialRecommendationRisk}
                  </div>

                  {!demoMode && result.search.validationIssues.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Validación</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
                        {result.search.validationIssues.map((v, i) => (
                          <li key={`${v.code}-${i}`}>
                            <span className="font-medium">{v.severity}</span>: {v.messageCustomer ?? v.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {!demoMode && result.search.fallbackHints.length > 0 ? (
                    <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Sugerencias:</span>{' '}
                      {result.search.fallbackHints.join(' · ')}
                    </div>
                  ) : null}
                </section>

                {!demoMode ? (
                  <section className="rounded-2xl border border-zinc-200/90 bg-white/90 p-6 dark:border-zinc-800 dark:bg-zinc-950/80">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Por qué recomienda · fortalezas · compensaciones
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <BulletCard title="Por qué (bullets)" lines={result.search.premiumUx.whyRecommendedBullets} accent="teal" />
                      <BulletCard title="Fortalezas globales" lines={result.search.premiumUx.topStrengths} accent="emerald" />
                      <BulletCard title="Tradeoffs / brechas" lines={result.search.premiumUx.mainTradeoffs} accent="amber" />
                    </div>
                  </section>
                ) : null}

                <section className="rounded-2xl border border-zinc-200/90 bg-white/90 p-6 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Transparencia</h3>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {transparencyLines.map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-teal-600 dark:text-teal-400">·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Top {Math.min(5, topFive.length)} recomendaciones
                  </h3>
                  {topFive.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                      El motor no devolvió candidatos rankeados para esta intención y catálogo.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {topFive.map((item, idx) => (
                        <TripPlaygroundCard
                          key={item.tripId}
                          rank={idx + 1}
                          item={item}
                          trip={result.trips[item.tripId]}
                          premiumUx={result.search.premiumUx}
                          demoMode={demoMode}
                          debugMode={qaDeepMode}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {qaDeepMode ? (
                  <div className="space-y-3">
                    <details className="rounded-2xl border border-zinc-300 bg-zinc-950 p-4 text-zinc-100 dark:border-zinc-700" open>
                      <summary className="cursor-pointer text-sm font-semibold text-teal-300">
                        Respuesta API completa (JSON)
                      </summary>
                      <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed">
                        {JSON.stringify(result.search, null, 2)}
                      </pre>
                    </details>
                    {result.search.debug?.telemetry ? (
                      <details className="rounded-2xl border border-zinc-300 bg-zinc-950 p-4 text-zinc-100 dark:border-zinc-700">
                        <summary className="cursor-pointer text-sm font-semibold text-teal-300">
                          Telemetría (debug.telemetry)
                        </summary>
                        <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed">
                          {JSON.stringify(result.search.debug.telemetry, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function PlaygroundSkeleton({ demoMode }: { demoMode: boolean }) {
  return (
    <div className={cn('animate-pulse space-y-6', demoMode && 'opacity-90')}>
      <div className="h-36 rounded-2xl bg-zinc-200/90 dark:bg-zinc-800/90" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-28 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-28 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
      </div>
      <div className="h-48 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-72 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
      </div>
    </div>
  );
}

function ConfidenceMini({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{body}</p>
    </div>
  );
}

function BulletCard({
  title,
  lines,
  accent,
}: {
  title: string;
  lines: string[];
  accent: 'teal' | 'emerald' | 'amber';
}) {
  const ring =
    accent === 'teal'
      ? 'border-teal-200/60 dark:border-teal-900/50'
      : accent === 'emerald'
        ? 'border-emerald-200/60 dark:border-emerald-900/50'
        : 'border-amber-200/70 dark:border-amber-900/50';
  return (
    <div className={cn('rounded-xl border bg-white/90 p-4 dark:bg-zinc-950/60', ring)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
        {lines.length ? lines.map((l, i) => <li key={i}>{l}</li>) : <li className="text-zinc-500">—</li>}
      </ul>
    </div>
  );
}

function TripPlaygroundCard(props: {
  rank: number;
  item: TravelSearchResultItem;
  trip: TripSnippet | undefined;
  premiumUx: TravelSearchResponse['premiumUx'];
  demoMode: boolean;
  debugMode: boolean;
}) {
  const { rank, item, trip, premiumUx, demoMode, debugMode } = props;
  const title = trip?.title ?? `Viaje ${item.tripId.slice(0, 8)}…`;
  const rawDiff =
    item.rawScore != null && item.rawScore !== item.score ? `${item.rawScore} → ${item.score}` : String(item.score);

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/85',
        demoMode && 'border-teal-200/35 shadow-md shadow-teal-500/[0.06] dark:border-teal-900/30',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">#{rank}</span>
          <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {trip?.mainDestination ?? '—'} · {trip?.durationDays != null ? `${trip.durationDays} días` : '—'} ·{' '}
            {formatMoney(trip?.indicativePrice, trip?.currency ?? null)}
          </p>
        </div>
        <div className="text-right">
          <span
            className={cn(
              'inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
              matchBadgeClass(item.matchState),
            )}
          >
            {matchLabel(item.matchState)}
          </span>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Score <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{item.score}</strong>
            {item.rawScore != null && item.rawScore !== item.score ? (
              <>
                {' '}
                <span className="text-zinc-400">(ajustado desde {item.rawScore})</span>
              </>
            ) : null}
          </p>
          {!demoMode && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">Conf. {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : 'n/d'}</p>
          )}
          {debugMode && (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">Raw→final: {rawDiff}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-emerald-500/[0.06] p-3 dark:bg-emerald-500/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            Coincidencias (circuito)
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-emerald-950 dark:text-emerald-50">
            {item.matches.length ? item.matches.map((m, i) => <li key={i}>{m}</li>) : <li className="text-zinc-500">—</li>}
          </ul>
        </div>
        <div className="rounded-xl bg-amber-500/[0.06] p-3 dark:bg-amber-500/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            Brechas (circuito)
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-950 dark:text-amber-50">
            {item.misses.length ? item.misses.map((m, i) => <li key={i}>{m}</li>) : <li className="text-zinc-500">—</li>}
          </ul>
        </div>
      </div>

      {demoMode && item.reasons.length > 0 ? (
        <div className="mt-4 rounded-xl border border-violet-200/60 bg-violet-500/[0.06] p-3 dark:border-violet-900/40 dark:bg-violet-500/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-900 dark:text-violet-100">
            Por qué este circuito
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-violet-950 dark:text-violet-50">
            {item.reasons.slice(0, 5).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!demoMode ? (
        <div className="mt-4 rounded-xl border border-teal-200/50 bg-teal-500/[0.04] p-3 dark:border-teal-900/40 dark:bg-teal-500/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-900 dark:text-teal-100">
            Lectura global del motor (premiumUx)
          </p>
          <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
            <div>
              <span className="font-semibold text-teal-800 dark:text-teal-200">Por qué:</span>{' '}
              {premiumUx.whyRecommendedBullets.slice(0, 4).join(' · ') || '—'}
            </div>
            <div>
              <span className="font-semibold text-emerald-800 dark:text-emerald-200">Fortalezas:</span>{' '}
              {premiumUx.topStrengths.slice(0, 3).join(' · ') || '—'}
            </div>
            <div>
              <span className="font-semibold text-amber-800 dark:text-amber-200">Tradeoffs:</span>{' '}
              {premiumUx.mainTradeoffs.slice(0, 3).join(' · ') || '—'}
            </div>
          </div>
        </div>
      ) : null}

      {!demoMode && (
        <p className="mt-3 text-xs italic text-zinc-500 dark:text-zinc-400">{item.commercialAngle}</p>
      )}

      {debugMode ? (
        <details className="mt-4 rounded-lg border border-zinc-300 bg-zinc-950 p-3 text-zinc-100 dark:border-zinc-700">
          <summary className="cursor-pointer text-xs font-semibold text-teal-300">
            Contribuciones técnicas (debug)
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed">
            {item.contributions.map((c, i) => (
              <li key={i}>
                {c.factor}: {c.contribution}/{c.weight} — {c.explanation}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
