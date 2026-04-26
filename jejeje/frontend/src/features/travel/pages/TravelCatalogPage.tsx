import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, Loader2, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import type { Company, Paginated } from '../../../types/domain';
import {
  appInputBorder,
  appPageTitle,
  appSelect,
  appTableBody,
  appTableCellMuted,
  appTableCellSoft,
  appTableCellStrong,
  appTableHead,
  appTableRow,
  appTableWrap,
} from '../../../lib/appTable';
import { cn } from '../../../lib/cn';

type TravelDoc = {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  status: string;
  totalPages: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  importJob?: {
    id: string;
    status: string;
    progress: number;
    currentStep: string | null;
  } | null;
};

type DocListPayload = { items: TravelDoc[]; total: number; page: number; pageSize: number };

type TripListItem = {
  id: string;
  title: string | null;
  status: string;
  document?: { id: string; originalName: string; status: string } | null;
};

type TripListPayload = { items: TripListItem[]; total: number; page: number; pageSize: number };

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: 'Subido',
  PROCESSING: 'Procesando',
  PROCESSED: 'Importado',
  FAILED: 'Error',
};

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

function stepLabel(s: string | null | undefined): string {
  if (!s) return '';
  if (s === 'extract') return 'Extrayendo texto';
  if (s === 'segment') return 'Detectando viajes';
  if (s.startsWith('save:')) {
    const rest = s.slice(5);
    return `Importando ${rest.replace('/', ' de ')}`;
  }
  if (s === 'done' || s === 'queued') return s === 'done' ? 'Completado' : 'En cola';
  return s;
}

/** Página 1-based, total ítems; pageSize fijo. */
function paginationInfo(page: number, pageSize: number, total: number) {
  if (total <= 0) {
    return { totalPages: 0, from: 0, to: 0, label: '0 resultados' as const };
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const label = `Página ${page} de ${totalPages} · ${from}–${to} de ${total}` as const;
  return { totalPages, from, to, label };
}

export function TravelCatalogPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [companyId, setCompanyId] = useState('');
  const [docPage, setDocPage] = useState(1);
  const [tripPage, setTripPage] = useState(1);
  const [fileBusy, setFileBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [jsonTripId, setJsonTripId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const qc = useQueryClient();

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'all-short', 'travel'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: { page: 1, pageSize: 200 },
      });
      return unwrap(body);
    },
    enabled: isSuper,
  });

  useEffect(() => {
    if (isSuper && companiesQ.data?.data?.length && !companyId) {
      setCompanyId(companiesQ.data.data[0].id);
    }
  }, [isSuper, companiesQ.data, companyId]);

  useEffect(() => {
    if (jsonTripId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJsonTripId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jsonTripId]);

  const canQuery = !isSuper || !!companyId;

  const sp = useCallback(() => superParams(companyId || undefined), [companyId]);

  const documentsQ = useQuery<DocListPayload>({
    queryKey: ['travel-documents', isSuper, companyId, docPage],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: DocListPayload }>('/travel/documents', {
        params: { page: docPage, pageSize: 10, ...sp() },
      });
      return unwrap(body);
    },
    enabled: canQuery,
    refetchInterval: (query) => {
      const d = query.state.data as DocListPayload | undefined;
      return d?.items?.some((x) => x.status === 'PROCESSING') ? 2_500 : false;
    },
  });

  const tripsQ = useQuery<TripListPayload>({
    queryKey: ['travel-trips', isSuper, companyId, tripPage],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: TripListPayload }>('/travel/trips', {
        params: { page: tripPage, pageSize: 10, ...sp() },
      });
      return unwrap(body);
    },
    enabled: canQuery,
    refetchInterval: () => {
      const d = qc.getQueryData<DocListPayload>(['travel-documents', isSuper, companyId, docPage]);
      return d?.items?.some((x) => x.status === 'PROCESSING') ? 4_000 : false;
    },
  });

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || f.type !== 'application/pdf') {
      setErr('Solo se admiten archivos PDF.');
      return;
    }
    if (!canQuery) {
      setErr('Selecciona una empresa (super admin).');
      return;
    }
    setFileBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append('file', f);
      await api.post('/travel/documents/upload', form, { params: sp() });
      await qc.invalidateQueries({ queryKey: ['travel-documents'] });
      setDocPage(1);
    } catch {
      setErr('No se pudo subir el PDF. Revisa el tamaño y vuelve a intentarlo.');
    } finally {
      setFileBusy(false);
    }
  };

  const tripJsonQ = useQuery({
    queryKey: ['travel-trip-full', jsonTripId, isSuper, companyId],
    queryFn: async () => {
      if (!jsonTripId) return null;
      const { data: body } = await api.get<{ success: boolean; data: unknown }>(`/travel/trips/${jsonTripId}`, {
        params: sp(),
      });
      return unwrap(body);
    },
    enabled: !!jsonTripId && canQuery,
  });

  const tripJsonText = tripJsonQ.data != null ? JSON.stringify(tripJsonQ.data, null, 2) : '';

  const processDocument = async (id: string) => {
    if (!canQuery) return;
    setErr(null);
    try {
      await api.post(`/travel/documents/${id}/process`, undefined, { params: sp() });
      await qc.invalidateQueries({ queryKey: ['travel-documents'] });
      await qc.invalidateQueries({ queryKey: ['travel-trips'] });
    } catch {
      setErr('No se pudo lanzar el procesamiento.');
    }
  };

  const deleteDocument = async (id: string) => {
    if (!canQuery) return;
    if (!window.confirm('¿Eliminar este PDF del servidor y los viajes importados desde él? No se puede deshacer.')) {
      return;
    }
    setErr(null);
    setDeletingDocId(id);
    try {
      await api.delete(`/travel/documents/${id}`, { params: sp() });
      await qc.invalidateQueries({ queryKey: ['travel-documents'] });
      await qc.invalidateQueries({ queryKey: ['travel-trips'] });
    } catch {
      setErr('No se pudo eliminar el documento.');
    } finally {
      setDeletingDocId(null);
    }
  };

  const clearAllImports = async () => {
    if (!canQuery) return;
    if (
      !window.confirm(
        '¿Borrar todos los PDFs subidos, viajes importados del catálogo y colas de importación de esta empresa? Los viajes creados a mano (sin PDF) se conservan. No se puede deshacer.',
      )
    ) {
      return;
    }
    setErr(null);
    setClearBusy(true);
    try {
      await api.post('/travel/documents/clear', undefined, { params: sp() });
      await qc.invalidateQueries({ queryKey: ['travel-documents'] });
      await qc.invalidateQueries({ queryKey: ['travel-trips'] });
    } catch {
      setErr('No se pudo vaciar las importaciones.');
    } finally {
      setClearBusy(false);
    }
  };

  return (
    <div>
      {jsonTripId != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trip-json-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px] dark:bg-black/70"
            onClick={() => {
              setJsonTripId(null);
            }}
            aria-label="Cerrar"
          />
          <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-white/10">
              <h2 id="trip-json-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                JSON completo del viaje
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!tripJsonText}
                  onClick={() => {
                    void (async () => {
                      try {
                        await navigator.clipboard.writeText(tripJsonText);
                        setCopyState('ok');
                        setTimeout(() => setCopyState('idle'), 2000);
                      } catch {
                        setCopyState('err');
                        setTimeout(() => setCopyState('idle'), 2000);
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copyState === 'ok' ? 'Copiado' : copyState === 'err' ? 'Error' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={() => setJsonTripId(null)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {tripJsonQ.isLoading && <p className="text-sm text-zinc-500">Cargando…</p>}
              {tripJsonQ.isError && <p className="text-sm text-red-500">No se pudo cargar el viaje.</p>}
              {tripJsonQ.isSuccess && tripJsonText && (
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {tripJsonText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={appPageTitle}>
            <span className="inline-flex items-center gap-2">
              <FileText className="h-7 w-7 text-amber-500" strokeWidth={1.5} aria-hidden />
              Catálogo de viajes (PDF)
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-500">
            Sube un PDF, procésalo para extraer viajes y consúltalos abajo. Documentación:{' '}
            <code className="rounded bg-zinc-200/80 px-1 text-xs text-zinc-800 dark:bg-white/10 dark:text-zinc-300">
              saas_practicas_nakedcode/backend/docs/travel-catalog/MODULO_CATALOGO_VIAJES.md
            </code>
            .
          </p>
        </div>
        {isSuper && (
          <div className="min-w-[220px]">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-500">Empresa</label>
            <select
              className={appSelect}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setDocPage(1);
                setTripPage(1);
              }}
            >
              <option value="" disabled>
                {companiesQ.isLoading ? 'Cargando…' : '—'}
              </option>
              {companiesQ.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

      {isSuper && !companyId && !companiesQ.isLoading && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400/90">Añade al menos una empresa para usar el catálogo.</p>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Subir PDF</p>
        <p className="text-xs text-zinc-500">Solo administradores. Máx. según configuración del servidor.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm', appInputBorder)}>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={onUpload}
              disabled={!canQuery || fileBusy}
            />
            {fileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Elegir archivo…</span>}
          </label>
          <button
            type="button"
            disabled={!canQuery || clearBusy}
            onClick={() => void clearAllImports()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            {clearBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Vaciar importaciones (PDF + viajes del catálogo)
          </button>
        </div>
      </div>

      <h2 className="mb-2 mt-10 text-lg font-semibold text-zinc-900 dark:text-white">Documentos</h2>
      {documentsQ.isLoading ? (
        <p className="text-sm text-zinc-500">Cargando documentos…</p>
      ) : (
        <div className={appTableWrap}>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className={appTableHead}>
              <tr>
                <th className="px-4 py-3">Archivo</th>
                <th className="min-w-[200px] px-4 py-3">Estado</th>
                <th className="px-4 py-3">Págs.</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className={appTableBody}>
              {(documentsQ.data?.items ?? []).map((d) => (
                <tr key={d.id} className={appTableRow}>
                  <td className={cn('px-4 py-3', appTableCellStrong)} title={d.originalName}>
                    {d.originalName}
                  </td>
                  <td className={cn('px-4 py-3', appTableCellSoft)}>
                    <div className="max-w-[220px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{STATUS_LABEL[d.status] ?? d.status}</span>
                        {d.status === 'PROCESSING' && d.importJob != null && (
                          <span className="font-mono text-xs tabular-nums text-amber-700/90 dark:text-amber-400/90">
                            {Math.min(100, Math.max(0, d.importJob.progress))}%
                          </span>
                        )}
                      </div>
                      {d.status === 'PROCESSING' && (
                        <div
                          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
                          title={d.importJob?.currentStep ? stepLabel(d.importJob.currentStep) : 'Procesando…'}
                        >
                          <div
                            className="h-full min-w-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-[width] duration-500 dark:from-amber-600 dark:to-amber-500"
                            style={{
                              width: `${Math.min(100, Math.max(2, d.importJob?.progress ?? 2))}%`,
                            }}
                          />
                        </div>
                      )}
                      {d.status === 'PROCESSING' && d.importJob?.currentStep && (
                        <p className="mt-0.5 text-[10px] leading-tight text-zinc-500 dark:text-zinc-500">
                          {stepLabel(d.importJob.currentStep)}
                        </p>
                      )}
                      {d.errorMessage && d.status === 'FAILED' && (
                        <p className="mt-0.5 text-xs text-red-500" title={d.errorMessage}>
                          {d.errorMessage.slice(0, 120)}
                          {d.errorMessage.length > 120 ? '…' : ''}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className={cn('px-4 py-3', appTableCellMuted)}>{d.totalPages ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {d.status !== 'PROCESSING' && (
                        <button
                          type="button"
                          onClick={() => void processDocument(d.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
                          title="Lanzar o relanzar la importación"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Procesar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingDocId === d.id}
                        onClick={() => void deleteDocument(d.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-300/80 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-300 dark:hover:bg-red-950/40"
                        title="Eliminar PDF y viajes asociados"
                      >
                        {deletingDocId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {documentsQ.data && documentsQ.data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay documentos.</p>
      ) : null}

      <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          className={cn('shrink-0 rounded px-3 py-1 text-sm text-zinc-500', appInputBorder)}
          disabled={docPage <= 1 || !documentsQ.data}
          onClick={() => setDocPage((p) => p - 1)}
        >
          ← Anterior
        </button>
        {documentsQ.data ? (
          <p
            className="min-w-0 flex-1 text-center text-xs text-zinc-600 dark:text-zinc-400"
            aria-live="polite"
            aria-atomic="true"
          >
            {paginationInfo(docPage, documentsQ.data.pageSize, documentsQ.data.total).label}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          className={cn('shrink-0 rounded px-3 py-1 text-sm text-zinc-500', appInputBorder)}
          disabled={!documentsQ.data || docPage * documentsQ.data.pageSize >= documentsQ.data.total}
          onClick={() => setDocPage((p) => p + 1)}
        >
          Siguiente →
        </button>
      </div>

      <div className="mb-2 mt-10 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Viajes importados</h2>
        <button
          type="button"
          disabled={!canQuery}
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ['travel-trips'] });
            void tripsQ.refetch();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
          title="Actualizar la lista de viajes (útil al terminar de procesar un PDF)"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', tripsQ.isRefetching && 'animate-spin')} aria-hidden />
          Recargar
        </button>
      </div>
      {tripsQ.isLoading ? (
        <p className="text-sm text-zinc-500">Cargando viajes…</p>
      ) : (
        <div className={appTableWrap}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={appTableHead}>
              <tr>
                <th className="px-4 py-3">Título / estado</th>
                <th className="px-4 py-3">Origen PDF</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">JSON</th>
              </tr>
            </thead>
            <tbody className={appTableBody}>
              {(tripsQ.data?.items ?? []).map((t) => (
                <tr key={t.id} className={appTableRow}>
                  <td className="px-4 py-3">
                    <p className={appTableCellStrong}>{t.title ?? t.id}</p>
                    <p className="text-xs text-zinc-500">{t.status}</p>
                  </td>
                  <td className={cn('px-4 py-3', appTableCellMuted)}>{t.document?.originalName ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setCopyState('idle');
                        setJsonTripId(t.id);
                      }}
                      className="text-sm text-amber-700 hover:underline dark:text-amber-400"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tripsQ.data && tripsQ.data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay viajes todavía. Sube y procesa un PDF.</p>
      ) : null}

      <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          className={cn('shrink-0 rounded px-3 py-1 text-sm text-zinc-500', appInputBorder)}
          disabled={tripPage <= 1 || !tripsQ.data}
          onClick={() => setTripPage((p) => p - 1)}
        >
          ← Anterior
        </button>
        {tripsQ.data ? (
          <p
            className="min-w-0 flex-1 text-center text-xs text-zinc-600 dark:text-zinc-400"
            aria-live="polite"
            aria-atomic="true"
            title="Número de página respecto al total, e ítems mostrados en esta página"
          >
            {paginationInfo(tripPage, tripsQ.data.pageSize, tripsQ.data.total).label}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          className={cn('shrink-0 rounded px-3 py-1 text-sm text-zinc-500', appInputBorder)}
          disabled={!tripsQ.data || tripPage * tripsQ.data.pageSize >= tripsQ.data.total}
          onClick={() => setTripPage((p) => p + 1)}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
