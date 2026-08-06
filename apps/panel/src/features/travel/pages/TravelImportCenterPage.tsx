import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardPaste,
  Clock,
  FileJson,
  History,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import type { Company, Paginated } from '../../../types/domain';
import { cn } from '../../../lib/cn';
import { useDemoPresentationMode } from '../../../lib/demoPresentationMode';
import { confirmAction, notifyError, notifySuccess } from '../../../lib/swal';

type ImportItem = {
  id: string;
  validationStatus: string;
  validationErrors: unknown;
  validationWarnings: unknown;
  normalizedJson: Record<string, unknown>;
  importedTripId: string | null;
};

type ImportBatchListRow = {
  id: string;
  fileName: string;
  status: string;
  totalItems: number;
  validItems: number;
  invalidItems: number;
  createdAt: string;
};

type ImportBatchDetail = ImportBatchListRow & { items: ImportItem[] };

type ImportSummary = {
  imported: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  failed: number;
};

type BatchListPayload = {
  items: ImportBatchListRow[];
  total: number;
  page: number;
  pageSize: number;
};

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

function statusTone(status: string): string {
  switch (status) {
    case 'VALID':
    case 'VALIDATED':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-500/25';
    case 'WARNING':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-100 ring-amber-500/25';
    case 'INVALID':
      return 'bg-rose-500/15 text-rose-900 dark:text-rose-100 ring-rose-500/25';
    case 'IMPORTED':
      return 'bg-cyan-500/15 text-cyan-900 dark:text-cyan-100 ring-cyan-500/25';
    case 'IMPORTING':
    case 'APPROVED':
      return 'bg-violet-500/15 text-violet-900 dark:text-violet-100 ring-violet-500/25';
    case 'FAILED':
      return 'bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 ring-zinc-400/20';
    default:
      return 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 ring-zinc-500/15';
  }
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
}

/** Vista sobre `normalizedJson` enriquecido; compatible con lotes antiguos planos. */
function getNormalizedTrip(n: Record<string, unknown>): Record<string, unknown> {
  const t = n.trip;
  if (t && typeof t === 'object' && !Array.isArray(t)) return t as Record<string, unknown>;
  return n;
}

function getNormalizedMetadata(n: Record<string, unknown>): Record<string, unknown> {
  const m = n.metadata;
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function summarizeImportBatchHealth(items: ImportItem[]): {
  total: number;
  invalid: number;
  warningSignals: number;
  uniqueDestinations: number;
  qualityPct: number;
  verdict: string;
} | null {
  if (!items.length) return null;
  let invalid = 0;
  let warningSignals = 0;
  const dest = new Set<string>();
  for (const it of items) {
    if (it.validationStatus === 'INVALID') invalid++;
    warningSignals += parseStringList(it.validationWarnings).length;
    const trip = getNormalizedTrip(it.normalizedJson);
    const md = trip.mainDestination;
    if (typeof md === 'string' && md.trim()) dest.add(md.trim());
  }
  const validShare = (items.length - invalid) / items.length;
  const qualityPct = Math.max(0, Math.min(100, Math.round(validShare * 100 - Math.min(25, warningSignals * 2))));
  const verdict =
    validShare >= 0.92 && warningSignals <= items.length
      ? 'Este lote parece suficientemente completo para seguir hacia revisión y aprobación.'
      : validShare >= 0.75
        ? 'Calidad mixta: conviene corregir alertas antes de importar en bloque.'
        : 'Priorice ítems inválidos antes de una demo o importación masiva.';
  return {
    total: items.length,
    invalid,
    warningSignals,
    uniqueDestinations: dest.size,
    qualityPct,
    verdict,
  };
}

function BatchPreviewSkeleton() {
  return (
    <div className="animate-pulse space-y-5 rounded-2xl border border-zinc-200/90 bg-white/90 p-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex flex-wrap gap-3">
        <div className="h-9 flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-9 w-28 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-9 w-28 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

/** Alineado con backend `TRAVEL_JSON_IMPORT_MAX_MB` por defecto (documentación). */
const TRAVEL_JSON_IMPORT_MAX_MB_UI = 8;

export function TravelImportCenterPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [companyId, setCompanyId] = useState('');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [editorItem, setEditorItem] = useState<ImportItem | null>(null);
  const [inputTab, setInputTab] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [pasteLocalError, setPasteLocalError] = useState<string | null>(null);
  const [pasteOptionalFileName, setPasteOptionalFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'all-short', 'travel-json-import'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<Company> }>(
        '/superadmin/companies',
        { params: { page: 1, pageSize: 200 } },
      );
      return unwrap(body);
    },
    enabled: isSuper,
  });

  useEffect(() => {
    if (isSuper && companiesQ.data?.data?.length && !companyId) {
      setCompanyId(companiesQ.data.data[0].id);
    }
  }, [isSuper, companiesQ.data, companyId]);

  const canQuery = !isSuper || !!companyId;
  const sp = useCallback(() => superParams(companyId || undefined), [companyId]);

  const batchesQ = useQuery<BatchListPayload>({
    queryKey: ['travel-json-import-batches', isSuper, companyId],
    queryFn: async () => {
      const { data: body } = await api.get<{
        success: boolean;
        data: BatchListPayload;
      }>('/travel/import-json/batches', { params: { page: 1, pageSize: 50, ...sp() } });
      return unwrap<BatchListPayload>(body);
    },
    enabled: canQuery,
    placeholderData: keepPreviousData,
  });

  const batchDetailQ = useQuery<ImportBatchDetail>({
    queryKey: ['travel-json-import-batch', activeBatchId, isSuper, companyId],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: ImportBatchDetail }>(
        `/travel/import-json/batches/${activeBatchId}`,
        { params: sp() },
      );
      return unwrap<ImportBatchDetail>(body);
    },
    enabled: !!activeBatchId && canQuery,
  });

  const demoMode = useDemoPresentationMode();

  const importHealth = useMemo(
    () => summarizeImportBatchHealth(batchDetailQ.data?.items ?? []),
    [batchDetailQ.data?.items],
  );

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data: body } = await api.post<{ success: boolean; data: ImportBatchDetail }>(
        '/travel/import-json/upload',
        form,
        {
          params: sp(),
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      return unwrap<ImportBatchDetail>(body);
    },
    onSuccess: (data) => {
      setActiveBatchId(data.id);
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batches'] });
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batch', data.id] });
      notifySuccess('Archivo validado', 'Revisa la vista previa y corrige alertas antes de importar.');
    },
    onError: (e) => {
      const msg = isAxiosError(e)
        ? (e.response?.data as { error?: { message?: string } })?.error?.message
        : null;
      notifyError('No se pudo procesar el JSON', msg || 'Comprueba formato y tamaño.');
    },
  });

  const pasteM = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { jsonContent: pasteText };
      if (isSuper && companyId) body.companyId = companyId;
      const fn = pasteOptionalFileName.trim();
      if (fn) body.fileName = fn;
      const { data: resp } = await api.post<{ success: boolean; data: ImportBatchDetail }>(
        '/travel/import-json/paste',
        body,
      );
      return unwrap<ImportBatchDetail>(resp);
    },
    onSuccess: (data) => {
      setPasteLocalError(null);
      setActiveBatchId(data.id);
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batches'] });
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batch', data.id] });
      notifySuccess('JSON validado', 'Revisa la vista previa antes de importar.');
    },
    onError: (e) => {
      const msg = isAxiosError(e)
        ? (e.response?.data as { error?: { message?: string } })?.error?.message
        : null;
      setPasteLocalError(msg?.trim() || 'No se pudo validar el JSON.');
      notifyError('Error al validar', msg?.trim() || 'Revisa sintaxis y tamaño.');
    },
  });

  const importM = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: body } = await api.post<{ success: boolean; data: ImportSummary }>(
        `/travel/import-json/batches/${batchId}/import`,
        {},
        { params: sp() },
      );
      return unwrap<ImportSummary>(body);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batches'] });
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batch', activeBatchId] });
      notifySuccess(
        'Importación completada',
        `Creados: ${data.imported ?? 0}. Omitidos (inválidos): ${data.skippedInvalid ?? 0}. Duplicados: ${data.skippedDuplicate ?? 0}. Fallos: ${data.failed ?? 0}.`,
      );
    },
    onError: () => notifyError('Importación fallida', 'Revisa logs del servidor o ítems en error.'),
  });

  const deleteBatchM = useMutation({
    mutationFn: async (batchId: string) => {
      await api.delete(`/travel/import-json/batches/${batchId}`, { params: sp() });
    },
    onSuccess: (_, batchId) => {
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batches'] });
      if (activeBatchId === batchId) {
        setActiveBatchId(null);
      }
      notifySuccess('Lote eliminado');
    },
  });

  const patchItemM = useMutation({
    mutationFn: async ({ itemId, normalizedJson }: { itemId: string; normalizedJson: Record<string, unknown> }) => {
      const { data: body } = await api.patch<{ success: boolean; data: ImportItem }>(
        `/travel/import-json/items/${itemId}`,
        { normalizedJson },
        { params: sp() },
      );
      return unwrap<ImportItem>(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['travel-json-import-batch', activeBatchId] });
      notifySuccess('Ítem actualizado');
      setEditorItem(null);
    },
    onError: () => notifyError('No se guardaron los cambios'),
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith('.json')) {
      uploadM.mutate(f);
    } else {
      notifyError('Archivo no válido', 'Usa un fichero .json');
    }
  };

  const busyPhase =
    uploadM.isPending || pasteM.isPending ? 'validating' : ('idle' as const);

  const pasteUtf8Bytes = useMemo(() => new TextEncoder().encode(pasteText).length, [pasteText]);
  const pasteMaxBytes = TRAVEL_JSON_IMPORT_MAX_MB_UI * 1024 * 1024;

  const formatPastedJson = () => {
    setPasteLocalError(null);
    const t = pasteText.trim();
    if (!t) {
      setPasteLocalError('No hay contenido para formatear.');
      return;
    }
    try {
      const v = JSON.parse(t);
      setPasteText(JSON.stringify(v, null, 2));
    } catch {
      setPasteLocalError('No es JSON válido; corrige la sintaxis antes de formatear.');
    }
  };

  const clearPaste = () => {
    setPasteText('');
    setPasteLocalError(null);
    setPasteOptionalFileName('');
  };

  const validatePastedJson = () => {
    setPasteLocalError(null);
    const t = pasteText.trim();
    if (!t) {
      setPasteLocalError('Pega un JSON con al menos un ítem (array u objeto enriquecido).');
      return;
    }
    if (!canQuery) {
      setPasteLocalError(isSuper ? 'Selecciona una empresa.' : 'Sesión no válida.');
      return;
    }
    try {
      const parsed = JSON.parse(t);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Object.keys(parsed as object).length === 0
      ) {
        setPasteLocalError('El objeto raíz está vacío.');
        return;
      }
    } catch {
      setPasteLocalError('JSON inválido: sintaxis incorrecta (revisa comillas y comas).');
      return;
    }
    if (pasteUtf8Bytes > pasteMaxBytes) {
      setPasteLocalError(
        `El contenido supera ~${TRAVEL_JSON_IMPORT_MAX_MB_UI} MB en UTF-8; reduce el texto.`,
      );
      return;
    }
    pasteM.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(ellipse_at_top,_rgba(6,182,212,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(99,102,241,0.06),_transparent_50%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-400">
              Catálogo · staging
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
              Travel Import Center
              {demoMode ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-500/25 dark:text-violet-100 dark:ring-violet-400/30">
                  <Sparkles className="h-3.5 w-3.5" />
                  Demo
                </span>
              ) : null}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {demoMode
                ? 'Vista pulida para reuniones: validación clara, foco en calidad del lote y siguiente paso.'
                : 'Sube un JSON revisado, evalúa la calidad por viaje, corrige en contexto e importa solo cuando estés conforme. Nada se escribe en el catálogo hasta que confirmes la importación.'}
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

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            <div
              className={cn(
                'rounded-2xl border border-zinc-200/90 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/75',
                busyPhase !== 'idle' && 'pointer-events-none opacity-70',
              )}
            >
              <div className="flex gap-1 border-b border-zinc-200/90 p-1 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setInputTab('file')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    inputTab === 'file'
                      ? 'bg-cyan-500/15 text-cyan-950 dark:text-cyan-100'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900',
                  )}
                >
                  <Upload className="h-4 w-4 shrink-0 opacity-70" />
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('paste')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    inputTab === 'paste'
                      ? 'bg-cyan-500/15 text-cyan-950 dark:text-cyan-100'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900',
                  )}
                >
                  <ClipboardPaste className="h-4 w-4 shrink-0 opacity-70" />
                  Paste JSON
                </button>
              </div>

              {(uploadM.isPending || pasteM.isPending) && (
                <div className="border-t border-zinc-200/90 bg-gradient-to-r from-cyan-500/[0.07] to-indigo-500/[0.06] px-4 py-2.5 text-center text-xs font-medium text-cyan-950 dark:border-zinc-800 dark:text-cyan-50">
                  Validando estructura · revisando campos clave · preparando vista previa…
                </div>
              )}

              {inputTab === 'file' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className="relative overflow-hidden border-t border-transparent p-8"
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-indigo-500/[0.05]" />
                  <div className="relative flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/12 text-cyan-700 dark:text-cyan-300">
                      <FileJson className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <p className="mt-4 text-base font-medium text-zinc-900 dark:text-zinc-100">Arrastra tu JSON aquí</p>
                    <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                      {demoMode ? (
                        <>Arrastra un JSON en formato admitido por el importador enriquecido.</>
                      ) : (
                        <>
                          Formato oficial: cada elemento es{' '}
                          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">source</code> +{' '}
                          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">trip</code> +{' '}
                          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">metadata</code>{' '}
                          (array o un solo objeto). Planos legados siguen admitidos.
                        </>
                      )}
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) uploadM.mutate(f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={!canQuery || uploadM.isPending}
                      onClick={() => fileRef.current?.click()}
                      className={cn(
                        'mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition',
                        'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
                        (!canQuery || uploadM.isPending) && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {uploadM.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadM.isPending ? 'Validando…' : 'Seleccionar archivo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-5">
                  <p className={cn('text-sm text-zinc-600 dark:text-zinc-400', demoMode && 'sr-only')}>
                    Pega un <strong className="font-medium text-zinc-800 dark:text-zinc-200">array</strong> de ítems{' '}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">{'{ source, trip, metadata }'}</code>{' '}
                    o un único objeto enriquecido. Los datos de catálogo van dentro de{' '}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">trip</code>.
                  </p>
                  {demoMode ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Pega el JSON del catálogo; el sistema validará en segundos y mostrará alertas accionables.
                    </p>
                  ) : null}
                  <textarea
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setPasteLocalError(null);
                    }}
                    spellCheck={false}
                    placeholder='[{"source":{...},"trip":{"title":"…","slug":"…","mainDestination":"…","durationDays":10,...},"metadata":{...}}]'
                    className={cn(
                      'min-h-[240px] w-full resize-y rounded-xl border bg-white px-4 py-3 font-mono text-[13px] leading-relaxed',
                      'border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                    )}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {pasteText.length.toLocaleString()} caracteres · {(pasteUtf8Bytes / 1024).toFixed(
                        pasteUtf8Bytes >= 10240 ? 0 : 1,
                      )}{' '}
                      KB UTF-8 (aprox.) · tope ~{TRAVEL_JSON_IMPORT_MAX_MB_UI} MB
                    </span>
                    {pasteUtf8Bytes > pasteMaxBytes ? (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">Supera el tope</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Nombre del lote (opcional)
                      <input
                        value={pasteOptionalFileName}
                        onChange={(e) => setPasteOptionalFileName(e.target.value)}
                        placeholder="mi-import.json"
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal normal-case dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                  </div>
                  {pasteLocalError ? (
                    <div className="flex gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-sm text-rose-900 dark:text-rose-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{pasteLocalError}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canQuery || pasteM.isPending || pasteUtf8Bytes > pasteMaxBytes}
                      onClick={() => validatePastedJson()}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm',
                        'bg-cyan-600 text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45',
                      )}
                    >
                      {pasteM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
                      Validar JSON
                    </button>
                    <button
                      type="button"
                      disabled={pasteM.isPending}
                      onClick={() => formatPastedJson()}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      Formatear JSON
                    </button>
                    <button
                      type="button"
                      disabled={pasteM.isPending}
                      onClick={() => clearPaste()}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {batchDetailQ.data ? (
              <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Vista previa de validación</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{batchDetailQ.data.fileName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Total" value={batchDetailQ.data.totalItems} />
                    <StatPill icon={<Clock className="h-3.5 w-3.5" />} label="OK / aviso" value={batchDetailQ.data.validItems} accent="text-emerald-600 dark:text-emerald-400" />
                    <StatPill icon={<XCircle className="h-3.5 w-3.5" />} label="Inválidos" value={batchDetailQ.data.invalidItems} accent="text-rose-600 dark:text-rose-400" />
                  </div>
                </div>

                {importHealth ? (
                  <div className="mt-5 rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-500/[0.06] to-cyan-500/[0.05] p-4 dark:border-teal-900/40 dark:from-teal-500/10 dark:to-cyan-500/5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-900 dark:text-teal-100">
                      Import Health Summary
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-white/80 px-3 py-2 shadow-sm dark:bg-zinc-950/60">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Calidad estimada</p>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{importHealth.qualityPct}%</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2 shadow-sm dark:bg-zinc-950/60">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Alertas (aprox.)</p>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{importHealth.warningSignals}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2 shadow-sm dark:bg-zinc-950/60">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Destinos únicos</p>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{importHealth.uniqueDestinations}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2 shadow-sm dark:bg-zinc-950/60">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Inválidos</p>
                        <p className="text-lg font-semibold text-rose-700 dark:text-rose-300">{importHealth.invalid}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-teal-950 dark:text-teal-50">
                      <span className="font-semibold text-teal-900 dark:text-teal-100">Recomendación del sistema:</span>{' '}
                      {importHealth.verdict}
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 space-y-3">
                  {batchDetailQ.data.items.map((item) => (
                    <TripPreviewCard
                      key={item.id}
                      item={item}
                      onEdit={() => setEditorItem(item)}
                      disabled={batchDetailQ.data?.status === 'IMPORTED'}
                    />
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={
                      importM.isPending ||
                      batchDetailQ.data.status === 'IMPORTED' ||
                      batchDetailQ.data.validItems === 0
                    }
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Importar viajes válidos',
                        text: 'Se crearán TravelTrip en estado revisión, destinos enlazados y nodos GeoPlace para scoring. Los ítems inválidos y slugs duplicados se omiten.',
                        confirmText: 'Sí, importar',
                        icon: 'question',
                      });
                      if (!ok) return;
                      importM.mutate(batchDetailQ.data!.id);
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm',
                      'bg-cyan-600 text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45',
                    )}
                  >
                    {importM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                    Importar viajes válidos
                  </button>
                  <button
                    type="button"
                    disabled={batchDetailQ.data.status === 'IMPORTED' || deleteBatchM.isPending}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Eliminar lote',
                        text: 'Se borrará el staging de este JSON (no borra viajes ya importados).',
                        confirmText: 'Eliminar',
                        icon: 'warning',
                      });
                      if (!ok) return;
                      deleteBatchM.mutate(batchDetailQ.data!.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar lote
                  </button>
                </div>
              </div>
            ) : activeBatchId && batchDetailQ.isLoading ? (
              <BatchPreviewSkeleton />
            ) : (
              <EmptyPreview />
            )}
          </div>

          <aside className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <History className="h-4 w-4 text-zinc-400" />
              Historial de lotes
            </div>
            <div className="space-y-2">
              {batchesQ.isPending ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
                  ))}
                </div>
              ) : (batchesQ.data?.items ?? []).length === 0 ? (
                <p className="rounded-xl border border-zinc-200/90 bg-white/80 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
                  Aún no hay importaciones JSON en staging para esta empresa.
                </p>
              ) : (
                batchesQ.data?.items.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveBatchId(b.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left text-sm transition',
                      activeBatchId === b.id
                        ? 'border-cyan-500/40 bg-cyan-500/[0.07] shadow-sm dark:border-cyan-500/30'
                        : 'border-zinc-200/90 bg-white/80 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/70',
                    )}
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{b.fileName}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(b.createdAt).toLocaleString()} · {b.validItems}/{b.totalItems} listos ·{' '}
                      <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset', statusTone(b.status))}>
                        {b.status}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
        </section>
      </div>

      {editorItem ? (
        <ItemEditorModal
          item={editorItem}
          saving={patchItemM.isPending}
          onClose={() => setEditorItem(null)}
          onSave={(partial) => patchItemM.mutate({ itemId: editorItem.id, normalizedJson: partial })}
        />
      ) : null}
    </div>
  );
}

function StatPill(props: {
  icon: ReactNode;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <span className={cn('text-zinc-400', props.accent)}>{props.icon}</span>
      <div className="leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{props.label}</p>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{props.value}</p>
      </div>
    </div>
  );
}

function TripPreviewCard(props: { item: ImportItem; onEdit: () => void; disabled?: boolean }) {
  const { item } = props;
  const n = item.normalizedJson;
  const trip = getNormalizedTrip(n);
  const meta = getNormalizedMetadata(n);
  const title = typeof trip.title === 'string' ? trip.title : '—';
  const dest = typeof trip.mainDestination === 'string' ? trip.mainDestination : '—';
  const days = typeof trip.durationDays === 'number' ? trip.durationDays : '—';
  const price = trip.priceFrom != null ? String(trip.priceFrom) : '—';
  const countries = parseStringList(trip.countries);
  const cities = parseStringList(trip.cities);
  const errs = parseStringList(item.validationErrors);
  const warns = parseStringList(item.validationWarnings);
  const needsManualReview = meta.needsManualReview === true;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', statusTone(item.validationStatus))}>
            {item.validationStatus}
          </span>
          {needsManualReview ? (
            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-500/25 dark:text-amber-100">
              Revisión manual (metadata)
            </span>
          ) : null}
          {item.importedTripId ? (
            <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">Importado · {item.importedTripId.slice(0, 8)}…</span>
          ) : null}
        </div>
        <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span>
            <span className="font-medium text-zinc-400">Destino</span> {dest}
          </span>
          <span>
            <span className="font-medium text-zinc-400">Días</span> {days}
          </span>
          <span>
            <span className="font-medium text-zinc-400">Desde</span> {price}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <GeoChips label="País" values={countries} />
          <GeoChips label="Ciudad" values={cities} />
        </div>
        {errs.length > 0 ? (
          <div className="flex gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-900 dark:text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="list-disc space-y-0.5 pl-4">
              {errs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {warns.length > 0 ? (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            <ul className="list-disc space-y-0.5 pl-4">
              {warns.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={props.disabled || !!item.importedTripId}
        onClick={props.onEdit}
        className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        Editar
      </button>
    </div>
  );
}

function GeoChips(props: { label: string; values: string[] }) {
  if (!props.values.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="font-medium text-zinc-400">{props.label}</span>
      {props.values.slice(0, 6).map((v) => (
        <span key={v} className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700">
          {v}
        </span>
      ))}
      {props.values.length > 6 ? <span className="text-[10px]">+{props.values.length - 6}</span> : null}
    </span>
  );
}

function EmptyPreview() {
  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white/70 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Esperando un archivo JSON</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        Cuando subas el fichero verás aquí el detalle de cada viaje: calidad, alertas y enlaces para corregir antes de volcar al catálogo.
      </p>
    </div>
  );
}

function ItemEditorModal(props: {
  item: ImportItem;
  saving: boolean;
  onClose: () => void;
  onSave: (partial: Record<string, unknown>) => void;
}) {
  const n = props.item.normalizedJson;
  const trip = getNormalizedTrip(n);
  const [title, setTitle] = useState(String(trip.title ?? ''));
  const [slug, setSlug] = useState(String(trip.slug ?? ''));
  const [mainDestination, setMainDestination] = useState(String(trip.mainDestination ?? ''));
  const [durationDays, setDurationDays] = useState(String(trip.durationDays ?? ''));
  const [priceFrom, setPriceFrom] = useState(trip.priceFrom != null ? String(trip.priceFrom) : '');
  const [countries, setCountries] = useState(parseStringList(trip.countries).join(', '));
  const [cities, setCities] = useState(parseStringList(trip.cities).join(', '));
  const [highlights, setHighlights] = useState(
    Array.isArray(trip.highlights)
      ? (trip.highlights as unknown[])
          .map((h) => (typeof h === 'string' ? h : (h as { text?: string }).text ?? ''))
          .filter(Boolean)
          .join('\n')
      : '',
  );
  const [itineraryText, setItineraryText] = useState(() => {
    const it = trip.itinerary;
    if (!Array.isArray(it)) return '';
    return it
      .map((row) => {
        const r = row as Record<string, unknown>;
        const dn = r.dayNumber ?? r.day;
        const day =
          typeof dn === 'number' && Number.isFinite(dn)
            ? dn
            : typeof dn === 'string' && /^\d+$/.test(dn.trim())
              ? parseInt(dn.trim(), 10)
              : '';
        const t = r.title ?? '';
        const desc = r.description ?? '';
        return `Día ${day}: ${t} — ${desc}`;
      })
      .join('\n');
  });

  const splitLines = (s: string) =>
    s
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

  const splitCsv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/95">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Editor rápido</p>
          <button type="button" onClick={props.onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <Field label="Título" value={title} onChange={setTitle} />
          <Field label="Slug" value={slug} onChange={setSlug} />
          <Field label="Destino principal" value={mainDestination} onChange={setMainDestination} />
          <Field label="Duración (días)" value={durationDays} onChange={setDurationDays} />
          <Field label="Precio desde (opcional)" value={priceFrom} onChange={setPriceFrom} />
          <Field label="Países (coma)" value={countries} onChange={setCountries} />
          <Field label="Ciudades (coma)" value={cities} onChange={setCities} />
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Highlights (una por línea)</label>
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Itinerario simple (una línea por día: “Día N: título — descripción”)
            </label>
            <textarea
              value={itineraryText}
              onChange={(e) => setItineraryText(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={props.saving}
            onClick={() => {
              const lines = splitLines(itineraryText);
              const itineraryParsed = lines
                .map((line) => {
                  const m = /^Día\s*(\d+)\s*:\s*(.*?)(?:\s+—\s+(.*))?$/.exec(line);
                  if (!m) return null;
                  return {
                    dayNumber: parseInt(m[1], 10),
                    title: m[2]?.trim() || null,
                    description: m[3]?.trim() || null,
                  };
                })
                .filter((x): x is { dayNumber: number; title: string | null; description: string | null } =>
                  x != null && Number.isFinite(x.dayNumber),
                );

              const pf =
                priceFrom.trim() === ''
                  ? null
                  : Number.isFinite(parseFloat(priceFrom))
                    ? parseFloat(priceFrom)
                    : null;
              const d = parseInt(durationDays, 10);
              const partial: Record<string, unknown> = {
                trip: {
                  title: title.trim(),
                  slug: slug.trim(),
                  mainDestination: mainDestination.trim(),
                  durationDays: Number.isFinite(d) ? d : trip.durationDays,
                  priceFrom: pf,
                  countries: splitCsv(countries),
                  cities: splitCsv(cities),
                  highlights: splitLines(highlights),
                  itinerary: itineraryParsed.length ? itineraryParsed : trip.itinerary,
                },
              };
              props.onSave(partial);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {props.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar y revalidar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{props.label}</label>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      />
    </div>
  );
}
