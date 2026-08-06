import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, BookOpen, Compass, Filter, ImageIcon, MapPin, Search } from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { cn } from '../../../lib/cn';
import { buttonClassName } from '../../../lib/buttonStyles';
import { labelTravelStyleAxisEs } from '../../../lib/esLabels';
import { appFilterBar, appFilterLabel, appInputFilter, appSelectFilter } from '../../../lib/appTable';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { useAuthStore } from '../../../store/authStore';
import type { Company, Paginated } from '../../../types/domain';
import type { TravelLibraryListPayload } from '../types/travelLibrary';

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

const STYLE_OPTIONS = [
  'CULTURE',
  'NATURE',
  'GASTRONOMY',
  'BEACH',
  'ADVENTURE',
  'WELLNESS',
  'CITY_BREAK',
  'FAMILY',
  'HONEYMOON',
] as const;

const PRESETS = [
  { id: '', label: 'Todos' },
  { id: 'approved', label: 'Aprobados' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'no_price', label: 'Sin precio' },
  { id: 'no_media', label: 'Sin imagen' },
  { id: 'no_geo', label: 'Sin geo' },
  { id: 'no_itinerary', label: 'Sin itinerario' },
] as const;

const btnPrimarySm = buttonClassName('primary', 'sm', 'flex-1 min-h-11 sm:min-h-9');

const btnGhostSm = buttonClassName('secondary', 'sm', 'min-h-11 shrink-0 sm:min-h-9');

function fmtMoney(n: number | null, cur: string | null) {
  if (n == null) return '—';
  const c = cur?.trim() || 'EUR';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${c}`;
  }
}

export function TravelLibraryPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';
  const canCatalog = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [companyId, setCompanyId] = useState('');
  const [preset, setPreset] = useState('');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [style, setStyle] = useState('');
  const [page, setPage] = useState(1);

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'short', 'travel-lib'],
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

  const sp = useCallback(() => superParams(isSuper ? companyId || undefined : undefined), [isSuper, companyId]);

  const listQ = useQuery({
    queryKey: ['travel-library', sp(), preset, q, country, style, page],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: TravelLibraryListPayload }>(
        '/travel/trips/library',
        {
          params: {
            ...sp(),
            preset: preset || undefined,
            q: q.trim() || undefined,
            country: country.trim() || undefined,
            style: style || undefined,
            page,
            pageSize: 24,
          },
        },
      );
      return unwrap<TravelLibraryListPayload>(body);
    },
    enabled: isSuper ? !!companyId : !!user?.companyId,
  });

  useEffect(() => {
    setPage(1);
  }, [preset, q, country, style, companyId]);

  const err = listQ.isError ? getApiErrorMessage(listQ.error) : null;
  const awaitingTenant = isSuper && !companyId;
  const companiesErr = isSuper && companiesQ.isError ? getApiErrorMessage(companiesQ.error) : null;
  const metrics = listQ.data?.metrics;

  const totalPages = useMemo(() => {
    if (!listQ.data) return 1;
    return Math.max(1, Math.ceil(listQ.data.total / listQ.data.pageSize));
  }, [listQ.data]);

  const resultsSummary =
    listQ.data && !listQ.isError
      ? `${listQ.data.total} resultado${listQ.data.total === 1 ? '' : 's'} · página ${listQ.data.page}`
      : null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Biblioteca de viajes"
        description="Misma línea visual que Leads y catálogo: filtros compactos, tarjetas claras y acciones rápidas."
        actions={
          isSuper ? (
            <div className="w-full min-w-[12rem] sm:w-auto">
              <label className={appFilterLabel}>Empresa</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={cn(appSelectFilter, 'mt-0.5')}
              >
                {(companiesQ.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      <PanelCard className="border-cyan-500/10">
        <div className="mb-2 flex items-center gap-2 text-cyan-800 dark:text-cyan-200">
          <BookOpen className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Resumen del catálogo</span>
        </div>
        {metrics ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <MetricCell label="Total" value={metrics.totalTrips} />
            <MetricCell label="Aprobados" value={metrics.approved} emphasize="ok" />
            <MetricCell label="Pendientes" value={metrics.pendingReview} emphasize="warn" />
            <MetricCell label="Países" value={metrics.countryCount} />
            <MetricCell label="Sin precio" value={metrics.withoutPrice} emphasize="risk" />
            <MetricCell label="Sin imagen" value={metrics.withoutPrimaryImage} />
            <MetricCell label="Borrador / rech." value={metrics.draftRejected} muted />
          </div>
        ) : listQ.isLoading ? (
          <div className="grid animate-pulse grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Sin métricas todavía.</p>
        )}
        {resultsSummary ? (
          <p className="mt-3 border-t border-zinc-200/80 pt-2 text-[11px] text-zinc-500 dark:border-white/[0.06]">
            {resultsSummary}
          </p>
        ) : null}
      </PanelCard>

      <PanelCard className="border-zinc-200/90 dark:border-white/[0.07]">
        <div className={cn(appFilterBar, 'space-y-3 border-0 bg-transparent p-0 dark:bg-transparent')}>
          <div>
            <span className={cn(appFilterLabel, 'mb-1 flex items-center gap-1')}>
              <Filter className="h-3 w-3" strokeWidth={2} />
              Vista rápida
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id || 'all'}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    preset === p.id
                      ? 'border-cyan-500/35 bg-cyan-500/[0.12] text-cyan-950 dark:text-cyan-100'
                      : 'border-zinc-200/90 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-black/20 dark:text-zinc-400 dark:hover:bg-white/[0.04]',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={appFilterLabel}>Estilo</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className={cn(appSelectFilter, 'mt-0.5')}>
                <option value="">Todos</option>
                {STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {labelTravelStyleAxisEs(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={appFilterLabel}>País</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Filtrar país"
                className={cn(appInputFilter, 'mt-0.5')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={appFilterLabel}>Buscar</label>
              <div className="relative mt-0.5">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Título, destino, ciudad…"
                  className={cn(appInputFilter, 'pl-8')}
                />
              </div>
            </div>
          </div>
        </div>
      </PanelCard>

      {companiesErr ? (
        <PanelCard className="border-rose-300/60 bg-rose-500/[0.06] dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="flex gap-2 text-sm text-rose-900 dark:text-rose-100">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {companiesErr}
          </div>
        </PanelCard>
      ) : null}

      {err ? (
        <PanelCard className="border-rose-300/60 bg-rose-500/[0.06] dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="flex gap-2 text-sm text-rose-900 dark:text-rose-100">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {err}
          </div>
        </PanelCard>
      ) : null}

      {awaitingTenant ? (
        <PanelCard className="border-dashed">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Selecciona una empresa para cargar el catálogo.
          </p>
        </PanelCard>
      ) : listQ.isLoading ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" />
          ))}
        </div>
      ) : listQ.isError ? (
        <PanelCard className="border-dashed border-rose-300/50 dark:border-rose-900/40">
          <p className="text-center text-sm text-zinc-700 dark:text-zinc-300">
            No se pudo cargar la biblioteca. Revisa logs del servidor y migraciones Prisma.
          </p>
        </PanelCard>
      ) : !listQ.data?.items.length ? (
        <PanelCard className="border-dashed">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            No hay viajes con estos filtros.
          </p>
        </PanelCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listQ.data.items.map((trip) => (
            <PanelCard
              key={trip.id}
              padding="p-0"
              className="group overflow-hidden transition-all hover:border-cyan-500/25 hover:shadow-md"
            >
              <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-900/80">
                {trip.heroImage ? (
                  <img src={trip.heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-400">
                    <ImageIcon className="h-9 w-9 opacity-35" strokeWidth={1.25} />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Sin imagen</span>
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <TripStatusChip status={trip.status} />
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div>
                  <h2 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-white">{trip.title}</h2>
                  <p className="mt-1 flex items-start gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" strokeWidth={2} />
                    <span>{(trip.mainDestination ?? trip.countries.join(', ')) || '—'}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {trip.countries.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-zinc-200/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-white/[0.08] dark:text-zinc-300"
                    >
                      {c}
                    </span>
                  ))}
                  {trip.styles.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-cyan-900 dark:text-cyan-200"
                    >
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {trip.qualityFlags.noPrice ? <Flag label="Sin precio" /> : null}
                  {trip.qualityFlags.noImage ? <Flag label="Sin imagen" /> : null}
                  {trip.qualityFlags.noItinerary ? <Flag label="Sin itinerario" /> : null}
                  {trip.qualityFlags.noGeo ? <Flag label="Sin geo" /> : null}
                  {trip.qualityFlags.noHotels ? <Flag label="Sin hoteles" /> : null}
                  {trip.qualityFlags.importWarning ? <Flag label="Import warning" warn /> : null}
                </div>
                <div className="border-t border-zinc-200/80 pt-3 text-xs text-zinc-600 dark:border-white/[0.06] dark:text-zinc-400">
                  {trip.durationDays != null ? `${trip.durationDays} días` : '—'} ·{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {fmtMoney(trip.priceFrom, trip.currency)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/travel/library/${trip.id}`} className={btnPrimarySm}>
                    Ver ficha <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {canCatalog ? (
                    <Link to="/app/travel" className={btnGhostSm}>
                      Catálogo admin
                    </Link>
                  ) : null}
                  <Link
                    to={`/travel/recommendation-playground?demo=1&dest=${encodeURIComponent(trip.mainDestination ?? trip.countries[0] ?? '')}`}
                    state={{ prefillDestination: trip.mainDestination ?? trip.countries[0] }}
                    className={cn(btnGhostSm, 'border-violet-400/25 text-violet-800 dark:border-violet-500/20 dark:text-violet-200')}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    Motor
                  </Link>
                </div>
                <Link
                  to="/leads"
                  className="block text-center text-[10px] font-medium text-zinc-500 hover:text-cyan-700 dark:hover:text-cyan-300"
                >
                  Generar propuesta → elegir lead
                </Link>
              </div>
            </PanelCard>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <PanelCard padding="p-3 sm:p-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(appInputFilter, 'w-auto px-3 disabled:opacity-40')}
            >
              Anterior
            </button>
            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
              Página {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={cn(appInputFilter, 'w-auto px-3 disabled:opacity-40')}
            >
              Siguiente
            </button>
          </div>
        </PanelCard>
      ) : null}
    </div>
  );
}

function TripStatusChip({ status }: { status: string }) {
  const ok = status === 'APPROVED';
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        ok
          ? 'border-emerald-500/30 bg-emerald-500/[0.15] text-emerald-950 dark:text-emerald-100'
          : 'border-amber-500/30 bg-amber-500/[0.15] text-amber-950 dark:text-amber-100',
      )}
    >
      {status === 'APPROVED' ? 'Aprobado' : status === 'PENDING_REVIEW' ? 'Revisión' : status}
    </span>
  );
}

function MetricCell({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string;
  value: number;
  emphasize?: 'ok' | 'warn' | 'risk';
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5',
        'border-zinc-200/90 bg-zinc-50/80 dark:border-white/[0.06] dark:bg-black/25',
        emphasize === 'ok' && 'border-emerald-500/20 bg-emerald-500/[0.06]',
        emphasize === 'warn' && 'border-amber-500/20 bg-amber-500/[0.06]',
        emphasize === 'risk' && 'border-rose-500/20 bg-rose-500/[0.06]',
        muted && 'opacity-80',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}

function Flag({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
        warn
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100'
          : 'border-zinc-200/80 bg-zinc-500/[0.06] text-zinc-700 dark:border-white/[0.08] dark:text-zinc-300',
      )}
    >
      {label}
    </span>
  );
}
