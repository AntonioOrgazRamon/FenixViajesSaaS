import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { PanelCard } from '../../../components/ui/PanelCard';
import type { SmartProposalState, SmartProposalTier, SmartProposalTripVm } from '../../../types/domain';
import { normalizeSmartProposalState } from '../normalizeSmartProposal';

const qk = (leadId: string) => ['lead', leadId, 'smart-proposal'] as const;

function tierLabel(t: SmartProposalTier): string {
  switch (t) {
    case 'recommended':
      return 'Recomendada';
    case 'economic':
      return 'Económica';
    case 'premium':
      return 'Premium';
    default:
      return t;
  }
}

function tierBadgeClass(t: SmartProposalTier): string {
  switch (t) {
    case 'recommended':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    case 'economic':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'premium':
      return 'border-violet-500/35 bg-violet-500/10 text-violet-200';
    default:
      return 'border-white/15 bg-white/[0.04] text-zinc-200';
  }
}

function TripRow({ t }: { t: SmartProposalTripVm }) {
  const price =
    t.indicativePrice != null
      ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(t.indicativePrice)}${t.currency ? ` ${t.currency}` : ''}`
      : '—';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierBadgeClass(t.tier)}`}>
          {tierLabel(t.tier)}
        </span>
        <span className="text-xs text-zinc-500">Score {t.matchScore}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-100">{t.title}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {t.mainDestination ?? 'Destino por confirmar'} · {t.durationDays != null ? `${t.durationDays} días` : 'Duración —'} · {price}
      </p>
      {(t.highlights?.length ?? 0) > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
          {(t.highlights ?? []).slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SmartProposalSection({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlDoc, setHtmlDoc] = useState('');

  const stateQuery = useQuery({
    queryKey: qk(leadId),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: SmartProposalState }>(`/leads/${leadId}/smart-proposal`);
      return normalizeSmartProposalState(unwrap<SmartProposalState>(data));
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk(leadId) });
    void qc.invalidateQueries({ queryKey: ['lead', leadId] });
  };

  const genMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; data: SmartProposalState }>(
        `/leads/${leadId}/smart-proposal/generate`,
        {},
      );
      return normalizeSmartProposalState(unwrap<SmartProposalState>(data));
    },
    onSuccess: invalidate,
  });

  const regenMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; data: SmartProposalState }>(
        `/leads/${leadId}/smart-proposal/regenerate`,
        {},
      );
      return normalizeSmartProposalState(unwrap<SmartProposalState>(data));
    },
    onSuccess: invalidate,
  });

  const vendorMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ success: boolean; data: SmartProposalState }>(
        `/leads/${leadId}/smart-proposal/vendor-notified`,
        {},
      );
      return normalizeSmartProposalState(unwrap<SmartProposalState>(data));
    },
    onSuccess: invalidate,
  });

  const openHtml = async () => {
    try {
      const { data } = await api.get(`/leads/${leadId}/smart-proposal/html`);
      const { html } = unwrap(data as { success: boolean; data: { html: string } }) as { html: string };
      setHtmlDoc(html);
      setHtmlOpen(true);
    } catch {
      /* handled by axios; optional toast */
    }
  };

  const downloadPdf = async () => {
    const res = await api.get(`/leads/${leadId}/smart-proposal/pdf`, { responseType: 'blob' });
    const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propuesta-${leadId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const busy = genMut.isPending || regenMut.isPending;
  const st = stateQuery.data;
  const errMsg =
    genMut.isError ? getApiErrorMessage(genMut.error) : regenMut.isError ? getApiErrorMessage(regenMut.error) : null;

  if (stateQuery.isLoading) {
    return (
      <section id="propuesta" className="scroll-mt-28">
        <PanelCard>
          <p className="text-sm text-zinc-500">Cargando propuesta inteligente…</p>
        </PanelCard>
      </section>
    );
  }

  if (stateQuery.isError || !st) {
    return (
      <section id="propuesta" className="scroll-mt-28">
        <PanelCard>
          <p className="text-sm text-red-400">No se pudo cargar la propuesta inteligente.</p>
        </PanelCard>
      </section>
    );
  }

  const { analysis, phase, lastError, vendorNotified, versionNumber, htmlAvailable, pdfAvailable } =
    st as SmartProposalState;
  const confPct = Math.round(analysis.intention.confidence * 100);

  return (
    <section id="propuesta" className="scroll-mt-28 space-y-4">
      <PanelCard className={`relative ${busy ? 'opacity-90' : ''}`}>
        {busy && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-black/40">
            <p className="rounded-lg border border-amber-500/30 bg-zinc-950/90 px-4 py-2 text-sm text-amber-100">
              Generando propuesta…
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Propuesta inteligente</h2>
            <p className="mt-1 max-w-xl text-xs text-zinc-500">
              Resumen para llamada rápida: intención, huecos del dato e hipótesis de viaje listas para argumentar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vendorNotified && (
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                Vendedor avisado
              </span>
            )}
            {phase === 'ready' && versionNumber != null && (
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400">
                v{versionNumber}
              </span>
            )}
          </div>
        </div>

        {phase === 'error' && lastError && (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-sm text-red-200">
            {lastError}
          </div>
        )}

        {errMsg && <p className="mt-3 text-sm text-red-400">{errMsg}</p>}

        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">Intención detectada</p>
              <p className="mt-1.5 text-sm text-zinc-100">{analysis.intention.summary}</p>
              <p className="mt-2 text-xs text-amber-100/70">Confianza estimada · {confPct}%</p>
              {analysis.intention.signals.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {analysis.intention.signals.map((s: string) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Score comercial</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-white">{analysis.overallScore}</span>
                <span className="text-sm text-zinc-500">/ 100</span>
              </div>
            </div>

            {analysis.missingData.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Datos que faltan</p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                  {analysis.missingData.map((m: string) => (
                    <li key={m}>· {m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 lg:border-l lg:border-white/[0.06] lg:pl-5">
            <div className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-100/90">Qué decir al cliente</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-100">{analysis.talkTrack}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
                <p className="text-[11px] font-semibold uppercase text-emerald-200/80">Encajes</p>
                <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
                  {analysis.matches.map((x: string) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.04] p-3">
                <p className="text-[11px] font-semibold uppercase text-orange-200/80">Riesgos / preguntar</p>
                <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
                  {analysis.misses.map((x: string) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-orange-300">!</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Viajes recomendados</p>
            <div className="mt-2 space-y-2">
              {analysis.recommendedTrips.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin catálogo suficiente o sin coincidencias. Revisa viajes aprobados.</p>
              ) : (
                analysis.recommendedTrips.map((t: SmartProposalTripVm) => (
                  <TripRow key={`${t.id}-${t.tier}`} t={t} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            disabled={busy || phase === 'ready'}
            onClick={() => genMut.mutate()}
            className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generar propuesta
          </button>
          <button
            type="button"
            disabled={busy || phase !== 'ready'}
            onClick={() => regenMut.mutate()}
            className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Regenerar
          </button>
          <button
            type="button"
            disabled={!htmlAvailable || busy}
            onClick={() => void openHtml()}
            className="rounded-xl border border-white/12 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ver HTML
          </button>
          <button
            type="button"
            disabled={!pdfAvailable || busy}
            onClick={() => void downloadPdf()}
            className="rounded-xl border border-white/12 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Descargar PDF
          </button>
          <button
            type="button"
            disabled={busy || vendorNotified || phase !== 'ready'}
            onClick={() => vendorMut.mutate()}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Marcar vendedor avisado
          </button>
          {vendorMut.isError && (
            <p className="w-full text-xs text-red-400">{getApiErrorMessage(vendorMut.error)}</p>
          )}
        </div>
      </PanelCard>

      {htmlOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-medium text-white">Vista previa HTML</p>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1 text-xs text-zinc-200 hover:bg-white/5"
                onClick={() => setHtmlOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <iframe title="Propuesta HTML" className="min-h-[60vh] flex-1 w-full bg-white" srcDoc={htmlDoc} />
          </div>
        </div>
      )}
    </section>
  );
}
