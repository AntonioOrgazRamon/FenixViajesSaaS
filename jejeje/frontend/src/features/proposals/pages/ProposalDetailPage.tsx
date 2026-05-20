import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
} from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { appFilterLabel, appInputFilter, appSelect, appSelectFilter } from '../../../lib/appTable';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { useAuthStore } from '../../../store/authStore';
import type { Company, Paginated } from '../../../types/domain';
import type { ProposalLibraryDetailPayload } from '../types/proposalLibrary';
import { downloadProposalLibraryPdf } from './ProposalLibraryPage';
import { labelLeadActivityTypeEs, labelLeadStatusEs, labelProposalStatusEs } from '../../../lib/esLabels';
import { buttonClassName } from '../../../lib/buttonStyles';

const btnPrimary = buttonClassName('primary', 'md', 'shadow-lg');

const btnGhost = buttonClassName('secondary', 'md');

const btnNotify = buttonClassName('violet', 'md');

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

const STATUS_OPTIONS = ['DRAFT', 'GENERATED', 'SENT_TO_SELLER', 'SENT_TO_CLIENT', 'ARCHIVED'] as const;

function fmtShort(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function openHtmlTab(html: string) {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function extractTrustBlock(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const s = snapshot as Record<string, unknown>;
  const pux = s.premiumUx;
  if (pux && typeof pux === 'object' && 'trust' in pux) {
    try {
      return JSON.stringify((pux as Record<string, unknown>).trust, null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

function extractMatchBlock(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const s = snapshot as Record<string, unknown>;
  const search = s.search;
  if (search && typeof search === 'object') {
    try {
      return JSON.stringify(search, null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

export function ProposalDetailPage() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';
  const canManage = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [companyId, setCompanyId] = useState('');

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'short', 'proposal-detail'],
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

  const detailQ = useQuery({
    queryKey: ['proposal-library-detail', proposalId, sp()],
    queryFn: async (): Promise<ProposalLibraryDetailPayload> => {
      const { data: body } = await api.get<{ success: boolean; data: ProposalLibraryDetailPayload }>(
        `/proposals/library/${proposalId}`,
        { params: sp() },
      );
      return unwrap<ProposalLibraryDetailPayload>(body);
    },
    enabled: !!proposalId && (isSuper ? !!companyId : !!user?.companyId),
  });

  const patchM = useMutation({
    mutationFn: async (status: string) => {
      const { data: body } = await api.patch<{ success: boolean; data: unknown }>(
        `/proposals/library/${proposalId}`,
        { status },
        { params: sp() },
      );
      return unwrap(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposal-library-detail'] });
      void qc.invalidateQueries({ queryKey: ['proposal-library'] });
    },
    onError: (e) => {
      window.alert(isAxiosError(e) ? e.message : 'No se pudo actualizar');
    },
  });

  const notifyM = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.post<{ success: boolean; data: unknown }>(
        `/proposals/library/${proposalId}/notify-sellers`,
        {},
        { params: sp() },
      );
      return unwrap(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposal-library-detail'] });
      window.alert('Notificación encolada / registrada');
    },
    onError: (e) => {
      window.alert(isAxiosError(e) ? e.message : 'No se pudo notificar');
    },
  });

  const html = detailQ.data?.latestVersion?.generatedHtml ?? '';
  const hasHtml = html.length > 40;
  const matchJson = useMemo(
    () => extractMatchBlock(detailQ.data?.latestVersion?.intentSnapshot),
    [detailQ.data?.latestVersion?.intentSnapshot],
  );
  const trustJson = useMemo(
    () => extractTrustBlock(detailQ.data?.latestVersion?.intentSnapshot),
    [detailQ.data?.latestVersion?.intentSnapshot],
  );

  const latest = detailQ.data?.latestVersion;

  return (
    <div className="w-full min-w-0 space-y-6">
      <PanelCard padding="p-3 sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className={cn(appInputFilter, 'w-auto px-3')}>
            <span className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver
            </span>
          </button>
          <Link
            to="/proposals/library"
            className={cn(appInputFilter, 'inline-flex w-auto items-center px-3 text-cyan-800 hover:bg-cyan-500/10 dark:text-cyan-200')}
          >
            Biblioteca
          </Link>
          {isSuper ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={cn(appSelectFilter, 'w-auto min-w-[10rem]')}
            >
              {(companiesQ.data?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </PanelCard>

      {detailQ.isLoading ? (
        <PanelCard className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
        </PanelCard>
      ) : detailQ.isError ? (
        <PanelCard className="border-rose-300/60 bg-rose-500/[0.06] dark:border-rose-900/50">
          <div className="flex gap-2 text-sm text-rose-900 dark:text-rose-100">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            No se pudo cargar la propuesta.
          </div>
        </PanelCard>
      ) : !detailQ.data ? null : (
        <>
          <PageHeader
            title={detailQ.data.lead.fullName ?? `Propuesta ${detailQ.data.proposal.id.slice(0, 8)}`}
            description={`Versión ${latest?.versionNumber ?? '—'} · ${labelProposalStatusEs(detailQ.data.proposal.status)} · Lead ${labelLeadStatusEs(detailQ.data.lead.status)}`}
          />

          <PanelCard>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Acciones</p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/leads/${detailQ.data.lead.id}`} className={btnPrimary}>
                Abrir lead <ExternalLink className="h-4 w-4" />
              </Link>
              {latest?.pdfStoragePath ? (
                <button
                  type="button"
                  onClick={() =>
                    void downloadProposalLibraryPdf(detailQ.data!.proposal.id, isSuper ? companyId : undefined)
                  }
                  className={btnGhost}
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </button>
              ) : null}
              {hasHtml ? (
                <button type="button" onClick={() => openHtmlTab(html)} className={btnGhost}>
                  <FileText className="h-4 w-4" />
                  HTML completo
                </button>
              ) : null}
            </div>

            {canManage ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-200/80 pt-4 dark:border-white/[0.06]">
                <div>
                  <label className={appFilterLabel}>Estado comercial</label>
                  <select
                    className={cn(appSelect, 'mt-0.5')}
                    value={detailQ.data.proposal.status}
                    disabled={patchM.isPending}
                    onChange={(e) => void patchM.mutate(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {labelProposalStatusEs(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" disabled={notifyM.isPending} onClick={() => void notifyM.mutate()} className={btnNotify}>
                  <Mail className="h-4 w-4" />
                  Reenviar aviso
                </button>
              </div>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                Solo administradores pueden cambiar el estado de la propuesta o reenviar notificaciones.
              </p>
            )}
          </PanelCard>

          <Section title="Lead">
            <div className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                <strong>Email:</strong> {detailQ.data.lead.email ?? '—'}
              </p>
              <p>
                <strong>Teléfono:</strong> {detailQ.data.lead.phone ?? '—'}
              </p>
              <p>
                <strong>País:</strong> {detailQ.data.lead.country ?? '—'}
              </p>
            </div>
          </Section>

          <Section title="Vista previa HTML">
            {hasHtml ? (
              <iframe
                title="Vista previa de la propuesta"
                sandbox=""
                srcDoc={html}
                className="h-[min(70vh,520px)] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
              />
            ) : (
              <p className="text-sm text-zinc-500">Sin HTML generado en la última versión.</p>
            )}
          </Section>

          <Section title="Viajes incluidos">
            <ul className="space-y-2 text-sm">
              {latest?.trips.length ? (
                latest.trips.map((t) => (
                  <li key={t.id} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <Link className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300" to={`/travel/library/${t.id}`}>
                      {t.title ?? t.mainDestination ?? t.id.slice(0, 8)}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {t.mainDestination ?? ''} · {t.durationDays != null ? `${t.durationDays} días` : ''}{' '}
                      {t.indicativePrice != null ? `· desde ${t.indicativePrice} ${t.currency ?? ''}` : ''}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-zinc-500">Sin viajes vinculados en esta versión.</li>
              )}
            </ul>
          </Section>

          <Section title="Match summary">
            {matchJson ? (
              <pre className="max-h-64 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-900">{matchJson}</pre>
            ) : (
              <JsonFallback snapshot={detailQ.data.latestVersion?.intentSnapshot} />
            )}
          </Section>

          <Section title="Trust summary">
            {trustJson ? (
              <pre className="max-h-64 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-900">{trustJson}</pre>
            ) : (
              <p className="text-sm text-zinc-500">Sin bloque trust en el snapshot (normal si la versión es anterior).</p>
            )}
          </Section>

          <Section title="Timeline de actividades">
            <ul className="space-y-3">
              {detailQ.data.activities.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{a.title}</p>
                    <p className="text-xs text-zinc-500">
                      {fmtShort(a.createdAt)} · {labelLeadActivityTypeEs(a.activityType)}
                    </p>
                    {a.description ? (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{a.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Historial de versiones">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {detailQ.data.versionHistory.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold">v{v.versionNumber}</span>
                  <span className="text-xs text-zinc-500">{fmtShort(v.createdAt)}</span>
                  <span className="flex gap-2 text-[11px]">
                    {v.hasPdf ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-800 dark:text-emerald-200">PDF</span>
                    ) : null}
                    {v.hasHtml ? (
                      <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-cyan-800 dark:text-cyan-200">HTML</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              La vista previa HTML corresponde siempre a la última versión. Para regenerar, usa el lead y el copiloto IA.
            </p>
          </Section>

          <Section title="Notificación vendedor">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Busca entradas <strong>SELLER_NOTIFIED</strong> en la línea de tiempo. Puedes forzar un nuevo intento con el botón superior si eres admin.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}

function JsonFallback({ snapshot }: { snapshot: unknown }) {
  if (snapshot == null) return <p className="text-sm text-zinc-500">Sin snapshot de intención.</p>;
  try {
    return (
      <pre className="max-h-64 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    );
  } catch {
    return <p className="text-sm text-zinc-500">Snapshot no serializable.</p>;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PanelCard>
      <h2 className="border-b border-zinc-200/80 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-white/[0.06]">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </PanelCard>
  );
}
