import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Filter,
  ImageIcon,
  Search,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { cn } from '../../../lib/cn';
import { labelLeadStatusEs, labelProposalStatusEs } from '../../../lib/esLabels';
import { buttonClassName } from '../../../lib/buttonStyles';
import { appFilterBar, appFilterLabel, appInputFilter, appSelectFilter } from '../../../lib/appTable';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { useAuthStore } from '../../../store/authStore';
import type { Company, Paginated } from '../../../types/domain';
import type { ProposalLibraryItem, ProposalLibraryListPayload } from '../types/proposalLibrary';

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

const PRESETS = [
  { id: '', label: 'Todas' },
  { id: 'draft', label: 'Borradores' },
  { id: 'generated', label: 'Generadas' },
  { id: 'sent', label: 'Enviadas' },
  { id: 'accepted', label: 'Aceptadas (lead)' },
  { id: 'rejected', label: 'Rechazadas (lead)' },
  { id: 'with_pdf', label: 'Con PDF' },
  { id: 'without_pdf', label: 'Sin PDF' },
  { id: 'with_html', label: 'Con HTML' },
] as const;

const btnPrimarySm = buttonClassName('primary', 'sm', 'flex-1 min-h-11 sm:min-h-9');

const btnGhostSm = buttonClassName('secondary', 'sm', 'min-h-11 shrink-0 sm:min-h-9');

function fmtMoney(n: number | null) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

function fmtShort(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function downloadProposalLibraryPdf(proposalId: string, companyId: string | undefined) {
  const params = superParams(companyId);
  const { data } = await api.get(`/proposals/library/${proposalId}/pdf`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proposal-${proposalId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProposalLibraryPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [companyId, setCompanyId] = useState('');
  const [preset, setPreset] = useState('');
  const [q, setQ] = useState('');
  const [destination, setDestination] = useState('');
  const [leadId, setLeadId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'short', 'proposal-lib'],
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
    queryKey: ['proposal-library', sp(), preset, q, destination, leadId, dateFrom, dateTo, page],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: ProposalLibraryListPayload }>(
        '/proposals/library',
        {
          params: {
            ...sp(),
            preset: preset || undefined,
            q: q.trim() || undefined,
            destination: destination.trim() || undefined,
            leadId: leadId.trim() || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            page,
            pageSize: 24,
          },
        },
      );
      return unwrap<ProposalLibraryListPayload>(body);
    },
    enabled: isSuper ? !!companyId : !!user?.companyId,
  });

  useEffect(() => {
    setPage(1);
  }, [preset, q, destination, leadId, dateFrom, dateTo, companyId]);

  const err = listQ.isError ? getApiErrorMessage(listQ.error) : null;
  const awaitingTenant = isSuper && !companyId;
  const companiesErr = isSuper && companiesQ.isError ? getApiErrorMessage(companiesQ.error) : null;
  const metrics = listQ.data?.metrics;

  const totalPages = useMemo(() => {
    if (!listQ.data) return 1;
    return Math.max(1, Math.ceil(listQ.data.total / listQ.data.pageSize));
  }, [listQ.data]);

  const estSum =
    metrics?.estimatedValueSum != null ? fmtMoney(metrics.estimatedValueSum) : '— (sin agregar en servidor)';

  const resultsSummary =
    listQ.data && !listQ.isError
      ? `${listQ.data.total} resultado${listQ.data.total === 1 ? '' : 's'} · página ${listQ.data.page}`
      : null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Biblioteca de propuestas"
        description="Histórico comercial alineado con Leads: filtros compactos, mismos chips y CTAs que el resto del panel."
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

      <PanelCard className="border-violet-500/10">
        <div className="mb-2 flex items-center gap-2 text-violet-800 dark:text-violet-200">
          <Sparkles className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Salud del pipeline</span>
        </div>
        {metrics ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <MetricCell label="Total" value={metrics.total} />
            <MetricCell label="Borradores" value={metrics.draft} muted />
            <MetricCell label="Generadas" value={metrics.generated} emphasize="cyan" />
            <MetricCell label="Enviadas" value={metrics.sentToSeller + metrics.sentToClient} emphasize="violet" />
            <MetricCell label="Aceptadas" value={metrics.leadConverted} emphasize="ok" />
            <MetricCell label="Rechazadas" value={metrics.leadLost} emphasize="risk" />
            <MetricCell label="Con PDF" value={metrics.withPdf} />
            <MetricCell label="Con HTML" value={metrics.withHtml} />
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
        <div className="mt-3 grid gap-2 border-t border-zinc-200/80 pt-3 dark:border-white/[0.06] sm:grid-cols-2">
          <div>
            <p className={appFilterLabel}>Valor estimado agregado</p>
            <p className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-white">{estSum}</p>
          </div>
          <div>
            <p className={appFilterLabel}>HTML con imágenes (hint)</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
              {metrics?.withImagesHint ?? '—'}
            </p>
          </div>
        </div>
        {resultsSummary ? (
          <p className="mt-2 text-[11px] text-zinc-500">{resultsSummary}</p>
        ) : null}
      </PanelCard>

      <PanelCard>
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
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <label className={appFilterLabel}>Buscar</label>
              <div className="relative mt-0.5">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Lead, email, teléfono, ID…"
                  className={cn(appInputFilter, 'pl-8')}
                />
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className={appFilterLabel}>Destino</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ciudad / viaje"
                className={cn(appInputFilter, 'mt-0.5')}
              />
            </div>
            <div className="lg:col-span-2">
              <label className={appFilterLabel}>Lead ID</label>
              <input
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="UUID"
                className={cn(appInputFilter, 'mt-0.5 font-mono text-[11px]')}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2 lg:col-span-2">
              <div className="min-w-0 flex-1">
                <label className={cn(appFilterLabel, 'flex items-center gap-1')}>
                  <Calendar className="h-3 w-3" />
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={cn(appInputFilter, 'mt-0.5')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className={appFilterLabel}>Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={cn(appInputFilter, 'mt-0.5')}
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
            Selecciona una empresa para cargar las propuestas.
          </p>
        </PanelCard>
      ) : listQ.isLoading ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[22rem] rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" />
          ))}
        </div>
      ) : listQ.isError ? (
        <PanelCard className="border-dashed border-rose-300/50 dark:border-rose-900/40">
          <p className="text-center text-sm text-zinc-700 dark:text-zinc-300">
            No se pudo cargar la biblioteca de propuestas. Revisa logs del servidor y migraciones.
          </p>
        </PanelCard>
      ) : !listQ.data?.items.length ? (
        <PanelCard className="border-dashed">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            No hay propuestas con estos filtros.
          </p>
        </PanelCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listQ.data.items.map((p) => (
            <ProposalCard key={p.id} item={p} companyId={isSuper ? companyId : undefined} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <PanelCard padding="p-3 sm:p-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((x) => Math.max(1, x - 1))}
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
              onClick={() => setPage((x) => x + 1)}
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

function ProposalCard({ item, companyId }: { item: ProposalLibraryItem; companyId?: string }) {
  return (
    <PanelCard className="transition-all hover:border-cyan-500/20 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200/80 pb-3 dark:border-white/[0.06]">
        <div className="min-w-0">
          <span className="inline-flex rounded-md border border-cyan-500/25 bg-cyan-500/[0.12] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-950 dark:text-cyan-100">
            {labelProposalStatusEs(item.status)}
          </span>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Lead · {labelLeadStatusEs(item.leadStatus)}
          </p>
          <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</h2>
          <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{item.leadName ?? 'Sin nombre'}</p>
        </div>
        <span className="shrink-0 rounded-md border border-zinc-200/80 px-2 py-1 text-[10px] font-bold tabular-nums text-zinc-700 dark:border-white/[0.08] dark:text-zinc-200">
          v{item.version}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
        {item.destination ? (
          <span className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-1.5 py-0.5 font-semibold text-cyan-900 dark:text-cyan-200">
            {item.destination}
          </span>
        ) : null}
        {item.matchState ? (
          <span className="rounded-md border border-zinc-200/80 px-1.5 py-0.5 text-zinc-700 dark:border-white/[0.08] dark:text-zinc-300">
            {item.matchState}
          </span>
        ) : null}
        {item.confidence != null ? (
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-0.5 font-medium text-emerald-900 dark:text-emerald-200">
            Conf. {(item.confidence * 100).toFixed(0)}%
          </span>
        ) : null}
        <span className="rounded-md border border-zinc-200/80 px-1.5 py-0.5 dark:border-white/[0.08]">
          {item.tripCount} viajes
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-zinc-500">Valor est.</dt>
          <dd className="mt-0.5 font-semibold text-zinc-900 dark:text-white">{fmtMoney(item.estimatedValue)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-zinc-500">Creada</dt>
          <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">{fmtShort(item.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-zinc-500">Generada</dt>
          <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">{fmtShort(item.generatedAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-zinc-500">Envío</dt>
          <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">{fmtShort(item.sentAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <AssetPill ok={item.hasPdf} label="PDF" />
        <AssetPill ok={item.hasHtml} label="HTML" />
        <AssetPill ok={item.hasMedia} label="Imágenes" icon={<ImageIcon className="h-3 w-3" />} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200/80 pt-3 dark:border-white/[0.06]">
        <Link to={`/proposals/library/${item.id}`} className={btnPrimarySm}>
          Ver ficha <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to={`/leads/${item.leadId}`} className={btnGhostSm}>
          Lead <ExternalLink className="h-3 w-3 opacity-70" />
        </Link>
        {item.hasPdf ? (
          <button type="button" onClick={() => void downloadProposalLibraryPdf(item.id, companyId)} className={btnGhostSm}>
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-xl border border-dashed border-amber-400/40 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-700/50 dark:text-amber-200">
            <FileText className="h-3.5 w-3.5" />
            Sin PDF
          </span>
        )}
      </div>
    </PanelCard>
  );
}

function AssetPill({ ok, label, icon }: { ok: boolean; label: string; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
        ok
          ? 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-900 dark:text-emerald-100'
          : 'border-zinc-200/80 text-zinc-500 dark:border-white/[0.08]',
      )}
    >
      {icon}
      {label}
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
  emphasize?: 'ok' | 'risk' | 'cyan' | 'violet';
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5',
        'border-zinc-200/90 bg-zinc-50/80 dark:border-white/[0.06] dark:bg-black/25',
        emphasize === 'ok' && 'border-emerald-500/20 bg-emerald-500/[0.06]',
        emphasize === 'risk' && 'border-rose-500/20 bg-rose-500/[0.06]',
        emphasize === 'cyan' && 'border-cyan-500/20 bg-cyan-500/[0.06]',
        emphasize === 'violet' && 'border-violet-500/20 bg-violet-500/[0.06]',
        muted && 'opacity-80',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}
