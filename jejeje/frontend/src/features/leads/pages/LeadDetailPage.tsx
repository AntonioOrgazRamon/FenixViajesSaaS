import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { cn } from '../../../lib/cn';
import type { LeadDetailBundle, SmartProposalState, UserListItem } from '../../../types/domain';
import { useAuthStore } from '../../../store/authStore';
import { SmartProposalSection } from '../components/SmartProposalSection';
import { LeadTravelProfilePanel } from '../components/LeadTravelProfilePanel';
import { normalizeSmartProposalState } from '../normalizeSmartProposal';
import {
  labelLeadActivityTypeEs,
  labelLeadAgentRunStatusEs,
  labelLeadPriorityEs,
  labelLeadStatusEs,
} from '../../../lib/esLabels';
import { buttonClassName } from '../../../lib/buttonStyles';

const editSchema = z.object({
  status: z.string(),
  priority: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  message: z.string().optional(),
  assigned_user_id: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

const emptyEdit: EditForm = {
  status: 'NEW',
  priority: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company_name: '',
  message: '',
  assigned_user_id: '',
};

const noteSchema = z.object({ content: z.string().min(1) });
type NoteForm = z.infer<typeof noteSchema>;

const statuses = [
  'NEW',
  'QUALIFYING',
  'QUALIFIED',
  'CONTACTED',
  'WAITING',
  'CONVERTED',
  'LOST',
  'ARCHIVED',
];


const smartProposalKey = (leadId: string) => ['lead', leadId, 'smart-proposal'] as const;

function LeadCopilotStrip({ leadId }: { leadId: string }) {
  const q = useQuery({
    queryKey: smartProposalKey(leadId),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: SmartProposalState }>(`/leads/${leadId}/smart-proposal`);
      return normalizeSmartProposalState(unwrap(data) as SmartProposalState);
    },
  });

  if (q.isLoading || q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] to-transparent px-4 py-3 dark:from-cyan-500/[0.1]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-900 dark:text-cyan-100">
            <Sparkles className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide">Copiloto</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {q.isLoading ? 'Cargando señales de propuesta…' : 'Sin datos de IA todavía.'}
              </p>
            </div>
          </div>
          <a
            href="#propuesta"
            className={cn(
              buttonClassName('secondary', 'touch'),
              'shrink-0 border-cyan-500/30 text-cyan-900 shadow-sm dark:border-cyan-500/25 dark:text-cyan-100',
            )}
          >
            Ir a propuesta
          </a>
        </div>
      </div>
    );
  }

  const st = q.data;
  const phaseLabel =
    st.phase === 'ready' ? 'Propuesta lista' : st.phase === 'error' ? 'Error de generación' : 'Sin generar';

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-violet-500/[0.05] px-4 py-3 dark:from-cyan-500/[0.12] dark:to-violet-500/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-900 dark:text-cyan-100">Copiloto</p>
            <p className="mt-0.5 truncate text-sm text-zinc-800 dark:text-zinc-200">{st.analysis.intention.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className="rounded-md border border-cyan-500/20 bg-white/70 px-1.5 py-0.5 font-medium tabular-nums dark:bg-white/[0.06]">
                Score {st.analysis.overallScore}
              </span>
              <span className="rounded-md border border-white/10 px-1.5 py-0.5 dark:border-white/[0.08]">{phaseLabel}</span>
              {st.vendorNotified ? (
                <span className="text-emerald-600 dark:text-emerald-400">Vendedor notificado</span>
              ) : null}
            </div>
          </div>
        </div>
        <a
          href="#propuesta"
          className={cn(buttonClassName('primary', 'touch'), 'inline-flex shrink-0 shadow-md shadow-cyan-900/25')}
        >
          Abrir propuesta IA
        </a>
      </div>
    </div>
  );
}

const fieldInput =
  'mt-1 w-full rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100';

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const commercialDefault = role === 'COMPANY_USER';
  const [technicalOpen, setTechnicalOpen] = useState(!commercialDefault);

  const detailQuery = useQuery<LeadDetailBundle>({
    queryKey: ['lead', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: LeadDetailBundle }>(`/leads/${id}`);
      return unwrap(data);
    },
  });

  const usersQuery = useQuery<UserListItem[]>({
    queryKey: ['users', 'assign'],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: { data: UserListItem[]; total: number; page: number; pageSize: number };
      }>('/users?page=1&pageSize=200');
      const pageData = unwrap<{ data: UserListItem[]; total: number; page: number; pageSize: number }>(data);
      return pageData.data;
    },
  });

  const lead = detailQuery.data?.lead;
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: lead
      ? {
          status: lead.status,
          priority: lead.priority ?? '',
          first_name: lead.firstName ?? '',
          last_name: lead.lastName ?? '',
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          company_name: lead.companyName ?? '',
          message: lead.message ?? '',
          assigned_user_id: lead.assignedUser?.id ?? '',
        }
      : emptyEdit,
  });

  const noteForm = useForm<NoteForm>({ resolver: zodResolver(noteSchema) });

  const patchMutation = useMutation({
    mutationFn: async (values: EditForm) => {
      const payload: Record<string, unknown> = {
        status: values.status,
        priority: values.priority || null,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        email: values.email || null,
        phone: values.phone || null,
        company_name: values.company_name || null,
        message: values.message || null,
        assigned_user_id: values.assigned_user_id || null,
      };
      const { data } = await api.patch(`/leads/${id}`, payload);
      return unwrap(data as { success: boolean; data: unknown });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const noteMutation = useMutation({
    mutationFn: async (values: NoteForm) => {
      const { data } = await api.post(`/leads/${id}/notes`, values);
      return unwrap(data as { success: boolean; data: unknown });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      noteForm.reset({ content: '' });
    },
  });

  const runAgentsMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/leads/${id}/run-agents`, {});
      return unwrap(data as { success: boolean; data: unknown });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
  });

  if (detailQuery.isLoading) return <p className="text-sm text-zinc-500">Cargando ficha…</p>;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div>
        <p className="text-sm text-red-400">Lead no encontrado o error al cargar.</p>
        <Link to="/leads" className="mt-4 inline-block text-sm text-cyan-600 hover:underline dark:text-cyan-400">
          ← Volver a leads
        </Link>
      </div>
    );
  }

  const bundle = detailQuery.data;
  const l = bundle.lead;

  return (
    <div className="w-full min-w-0 space-y-4 lg:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={l.fullName || l.email || 'Lead'}
          description={`Origen ${l.source}${l.sourceDetail ? ` · ${l.sourceDetail}` : ''}`}
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setTechnicalOpen((v) => !v)}
            className={buttonClassName('secondary', 'touch', 'w-full sm:w-auto')}
          >
            {technicalOpen ? (
              <>
                <ChevronUp className="h-4 w-4 opacity-70" aria-hidden />
                Ocultar vista técnica
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                Mostrar vista técnica
              </>
            )}
          </button>
          <button
            type="button"
            className={buttonClassName('secondary', 'touch', 'w-full sm:w-auto')}
            onClick={() => navigate('/leads')}
          >
            ← Lista
          </button>
        </div>
      </div>

      {!technicalOpen && commercialDefault ? (
        <p className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-3 text-xs text-zinc-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-zinc-400">
          Vista comercial: puedes abrir la vista técnica para ver JSON de contexto, automatizaciones en prueba y el payload en bruto (admins).
        </p>
      ) : null}

      <LeadCopilotStrip leadId={l.id} />

      <LeadTravelProfilePanel leadId={l.id} profile={l.travelProfile ?? null} />

      <SmartProposalSection leadId={l.id} />

      <form
        onSubmit={form.handleSubmit((v) => patchMutation.mutate(v))}
        className="grid w-full min-w-0 gap-4 lg:grid-cols-2 xl:gap-5"
      >
        <PanelCard>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Datos principales</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-500">Estado</label>
              <select className={fieldInput} {...form.register('status')}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {labelLeadStatusEs(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Prioridad</label>
              <select className={fieldInput} {...form.register('priority')}>
                <option value="">—</option>
                <option value="LOW">{labelLeadPriorityEs('LOW')}</option>
                <option value="MEDIUM">{labelLeadPriorityEs('MEDIUM')}</option>
                <option value="HIGH">{labelLeadPriorityEs('HIGH')}</option>
                <option value="URGENT">{labelLeadPriorityEs('URGENT')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Nombre</label>
              <input className={fieldInput} {...form.register('first_name')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Apellidos</label>
              <input className={fieldInput} {...form.register('last_name')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Email</label>
              <input className={fieldInput} {...form.register('email')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Teléfono</label>
              <input className={fieldInput} {...form.register('phone')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Empresa (lead)</label>
              <input className={fieldInput} {...form.register('company_name')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Mensaje</label>
              <textarea rows={3} className={fieldInput} {...form.register('message')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Asignado a</label>
              <select className={fieldInput} {...form.register('assigned_user_id')}>
                <option value="">—</option>
                {(usersQuery.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {patchMutation.isError && (
            <p className="mt-3 text-sm text-red-400">{getApiErrorMessage(patchMutation.error)}</p>
          )}
          <button
            type="submit"
            disabled={patchMutation.isPending}
            className={buttonClassName('primary', 'touch', 'w-full sm:w-auto')}
          >
            Guardar cambios
          </button>
        </PanelCard>

        {technicalOpen ? (
          <PanelCard>
            <h2 className="text-sm font-semibold text-white">Contexto JSON (detalle)</h2>
            <p className="mt-1 text-xs text-zinc-500">Bloques flexibles para enriquecimiento e IA.</p>
            <JsonBlock title="Compras / historial" value={l.details?.purchaseHistory} />
            <JsonBlock title="Contexto actual" value={l.details?.currentContext} />
            <JsonBlock title="Requisitos" value={l.details?.requirements} />
            <JsonBlock title="Técnico" value={l.details?.technicalSnapshot} />
            <JsonBlock title="Comercial" value={l.details?.commercialSnapshot} />
            <p className="mt-4 text-xs text-zinc-600">
              Para editar estos bloques usa{' '}
              <code className="text-zinc-500">PATCH /api/v1/leads/:id/details</code> (próxima iteración en UI).
            </p>
          </PanelCard>
        ) : (
          <div className="hidden lg:block" aria-hidden />
        )}
      </form>

      <div className="grid w-full min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:gap-5">
        {technicalOpen ? (
          <PanelCard className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Automatizaciones / agentes</h2>
              <button
                type="button"
                onClick={() => runAgentsMutation.mutate()}
                disabled={runAgentsMutation.isPending}
                className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 disabled:opacity-50"
              >
                Lanzar (stub)
              </button>
            </div>
            <ul className="mt-3 max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto text-sm text-zinc-400">
              {bundle.agentRuns.length === 0 && <li>Sin ejecuciones registradas.</li>}
              {bundle.agentRuns.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2 border-b border-white/[0.05] pb-2">
                  <span className="text-zinc-200">{r.agentKey}</span>
                  <span className="text-xs text-zinc-500">{labelLeadAgentRunStatusEs(r.status)}</span>
                  <span className="text-xs text-zinc-600">{new Date(r.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </PanelCard>
        ) : null}

        <PanelCard className="min-w-0">
          <h2 className="text-sm font-semibold text-white">Timeline</h2>
          <ul className="mt-3 max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto text-sm">
            {bundle.activities.map((a) => (
              <li key={a.id} className="border-l-2 border-amber-500/30 pl-3">
                <p className="font-medium text-zinc-200">{a.title}</p>
                <p className="text-xs text-zinc-500">{labelLeadActivityTypeEs(a.activityType)}</p>
                <p className="text-xs text-zinc-600">{new Date(a.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard className={cn('min-w-0', technicalOpen && 'lg:col-span-2 xl:col-span-1')}>
          <h2 className="text-sm font-semibold text-white">Notas internas</h2>
          <form
            className="mt-4 space-y-2"
            onSubmit={noteForm.handleSubmit((v) => noteMutation.mutate(v))}
          >
            <textarea
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
              placeholder="Nueva nota…"
              {...noteForm.register('content')}
            />
            {noteMutation.isError && (
              <p className="text-xs text-red-400">{getApiErrorMessage(noteMutation.error)}</p>
            )}
            <button
              type="submit"
              disabled={noteMutation.isPending}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
            >
              Añadir nota
            </button>
          </form>
          <ul className="mt-6 space-y-3">
            {bundle.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-sm text-zinc-300">
                <p className="whitespace-pre-wrap">{n.content}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {n.author.firstName} {n.author.lastName} · {new Date(n.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>

      {role === 'COMPANY_ADMIN' && technicalOpen && (
        <PanelCard>
          <h2 className="text-sm font-semibold text-white">Payload en bruto (solo revisión)</h2>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-400">
            {JSON.stringify(l.rawPayload ?? {}, null, 2)}
          </pre>
        </PanelCard>
      )}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  const emptyObj = typeof value === 'object' && value !== null && Object.keys(value as object).length === 0;
  if (emptyObj) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-black/35 p-2 text-xs text-zinc-400">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
