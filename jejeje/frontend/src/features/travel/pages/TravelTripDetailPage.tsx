import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  Compass,
  ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { appInputFilter, appSelectFilter } from '../../../lib/appTable';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { useAuthStore } from '../../../store/authStore';
import { notifyError, notifySuccess } from '../../../lib/swal';
import type { Company, Paginated } from '../../../types/domain';

import { buttonClassName } from '../../../lib/buttonStyles';

const btnGhost = buttonClassName('secondary', 'md');

const btnSuccess = buttonClassName('emerald', 'md');

const btnAccent = buttonClassName('violet', 'md');

function superParams(companyId: string | undefined) {
  return companyId ? { companyId } : undefined;
}

export function TravelTripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'SUPER_ADMIN';
  const canCatalog = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [companyId, setCompanyId] = useState('');

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'short', 'trip-detail'],
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
    queryKey: ['travel-library-detail', tripId, sp()],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: unknown }>(
        `/travel/trips/library/${tripId}`,
        { params: sp() },
      );
      return unwrap(body) as Record<string, unknown>;
    },
    enabled: !!tripId && (isSuper ? !!companyId : !!user?.companyId),
  });

  const approveM = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.post<{ success: boolean; data: unknown }>(
        `/travel/trips/${tripId}/approve`,
        {},
        { params: sp() },
      );
      return unwrap(body);
    },
    onSuccess: () => {
      notifySuccess('Viaje aprobado');
      void qc.invalidateQueries({ queryKey: ['travel-library-detail'] });
      void qc.invalidateQueries({ queryKey: ['travel-library'] });
    },
    onError: (e) => {
      notifyError(isAxiosError(e) ? e.message : 'No se pudo aprobar');
    },
  });

  const mediaM = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.post<{ success: boolean; data: unknown }>(
        `/travel/trips/${tripId}/media/enqueue`,
        {},
        { params: sp() },
      );
      return unwrap(body);
    },
    onSuccess: () => notifySuccess('Enriquecimiento de imágenes encolado'),
    onError: (e) => {
      notifyError(isAxiosError(e) ? e.message : 'No se pudo encolar');
    },
  });

  const d = detailQ.data;

  const title = d ? String(d.title) : 'Viaje';

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
            to="/travel/library"
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

      {!detailQ.isLoading && !detailQ.isError && d ? (
        <PageHeader
          title={title}
          description={`${String(d.mainDestination ?? '—')} · ${d.durationDays != null ? `${d.durationDays} días` : 'Duración —'} · Estado ${String(d.status)}`}
        />
      ) : null}

      {detailQ.isLoading ? (
        <PanelCard className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
        </PanelCard>
      ) : detailQ.isError ? (
        <PanelCard className="border-rose-300/60 bg-rose-500/[0.06] dark:border-rose-900/50">
          <div className="flex gap-2 text-sm text-rose-900 dark:text-rose-100">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            No se pudo cargar la ficha.
          </div>
        </PanelCard>
      ) : !d ? null : (
        <>
          <TripHero d={d} />
          <PanelCard>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Acciones</p>
            <div className="flex flex-wrap gap-2">
              {canCatalog && String(d.status) !== 'APPROVED' ? (
                <button
                  type="button"
                  disabled={approveM.isPending}
                  onClick={() => void approveM.mutate()}
                  className={btnSuccess}
                >
                  Aprobar viaje
                </button>
              ) : null}
              {canCatalog && String(d.status) === 'APPROVED' ? (
                <button type="button" disabled={mediaM.isPending} onClick={() => void mediaM.mutate()} className={btnAccent}>
                  <Sparkles className="h-4 w-4" />
                  Enriquecer imágenes
                </button>
              ) : null}
              <Link
                to={`/travel/recommendation-playground?demo=1&dest=${encodeURIComponent(String(d.mainDestination ?? ''))}`}
                className={cn(btnGhost, 'border-violet-400/25 text-violet-800 dark:border-violet-500/25 dark:text-violet-200')}
              >
                <Compass className="h-4 w-4" />
                Playground
              </Link>
              {canCatalog ? (
                <Link to="/app/travel" className={btnGhost}>
                  Catálogo admin
                </Link>
              ) : null}
            </div>
          </PanelCard>

          <Section title="Resumen">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {(d.description as string) || 'Sin descripción.'}
              </p>
            </Section>

            <Section title="Estado de calidad">
              <pre className="overflow-x-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
                {JSON.stringify(d.qualityFlags, null, 2)}
              </pre>
            </Section>

            <Section title="Destinos">
              <ul className="list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
                {(d.tripDestinations as { destination: { name: string; type: string } }[]).map((row, i) => (
                  <li key={i}>
                    {row.destination.name}{' '}
                    <span className="text-xs text-zinc-500">({row.destination.type})</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Itinerario">
              <ul className="space-y-2 text-sm">
                {(d.itineraryDays as { dayNumber: number; title: string | null; description: string | null }[]).map(
                  (day) => (
                    <li key={day.dayNumber} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                      <strong>Día {day.dayNumber}</strong> — {day.title ?? '—'}
                      {day.description ? (
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{day.description}</p>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            </Section>

            <Section title="Highlights">
              <ul className="list-inside list-disc text-sm">
                {(d.highlights as { text: string }[]).map((h, i) => (
                  <li key={i}>{h.text}</li>
                ))}
              </ul>
            </Section>

            <Section title="Servicios">
              <ul className="text-sm">
                {(d.services as { type: string; text: string }[]).map((s, i) => (
                  <li key={i}>
                    <span className="font-semibold">{s.type}</span>: {s.text}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Hoteles">
              <ul className="text-sm">
                {(d.hotels as { hotelName: string | null; city: string | null; category: string | null }[]).map(
                  (h, i) => (
                    <li key={i}>
                      {h.hotelName ?? '—'} — {h.city ?? ''} ({h.category ?? ''})
                    </li>
                  ),
                )}
              </ul>
            </Section>

            <Section title="Media assets">
              <div className="grid gap-3 sm:grid-cols-3">
                {(d.mediaAssets as { id: string; imageUrl: string; isPrimary: boolean }[]).map((m) => (
                  <a
                    key={m.id}
                    href={m.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                  >
                    <img src={m.imageUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
                    {m.isPrimary ? (
                      <p className="bg-cyan-600 py-1 text-center text-[10px] font-bold text-white">Primary</p>
                    ) : null}
                  </a>
                ))}
              </div>
            </Section>

            <Section title="Geo links">
              <ul className="text-sm">
                {(d.geoLinks as { canonicalName: string; kind: string; role: string }[]).map((g, i) => (
                  <li key={i}>
                    {g.canonicalName} <span className="text-zinc-500">({g.kind})</span> — {g.role}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Propuestas que usan este viaje">
              {(d.proposalsUsing as { proposalId: string; leadName: string | null; status: string }[]).length ? (
                <ul className="space-y-2">
                  {(d.proposalsUsing as { proposalId: string; leadName: string | null; status: string }[]).map(
                    (p) => (
                      <li key={p.proposalId}>
                        <Link
                          className="font-medium text-cyan-700 hover:underline dark:text-cyan-300"
                          to={`/proposals/library/${p.proposalId}`}
                        >
                          {p.leadName ?? p.proposalId.slice(0, 8)}
                        </Link>{' '}
                        <span className="text-xs text-zinc-500">{p.status}</span>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Aún no aparece en propuestas.</p>
              )}
            </Section>
        </>
      )}
    </div>
  );
}

function TripHero({ d }: { d: Record<string, unknown> }) {
  const hero = d.heroImage as string | null;
  return (
    <PanelCard padding="p-0" className="overflow-hidden">
      <div className="relative aspect-[21/9] bg-zinc-100 dark:bg-zinc-900/90">
        {hero ? (
          <img src={hero} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-zinc-400">
            <ImageIcon className="h-12 w-12 opacity-40" />
            Sin hero
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
          <h1 className="text-xl font-bold md:text-2xl" style={{ fontFamily: '"Syne", system-ui, sans-serif' }}>
            {String(d.title)}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm opacity-95">
            <MapPin className="h-4 w-4" />
            {String(d.mainDestination ?? '—')} · {d.durationDays != null ? `${d.durationDays} días` : '—'}
          </p>
        </div>
      </div>
    </PanelCard>
  );
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
