import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import type { LeadDetailBundle, UserListItem } from '../../../types/domain';
import { useAuthStore } from '../../../store/authStore';

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

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);

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
        <Link to="/leads" className="mt-4 inline-block text-sm text-amber-400 hover:underline">
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
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.06]"
          onClick={() => navigate('/leads')}
        >
          ← Lista
        </button>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => patchMutation.mutate(v))}
        className="grid w-full min-w-0 gap-4 lg:grid-cols-2 xl:gap-5"
      >
        <PanelCard>
          <h2 className="text-sm font-semibold text-white">Datos principales</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-500">Estado</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                {...form.register('status')}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Prioridad</label>
              <select className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('priority')}>
                <option value="">—</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Nombre</label>
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('first_name')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Apellidos</label>
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('last_name')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Email</label>
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('email')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Teléfono</label>
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('phone')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Empresa (lead)</label>
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('company_name')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Mensaje</label>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                {...form.register('message')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Asignado a</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                {...form.register('assigned_user_id')}
              >
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
            className="mt-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            Guardar cambios
          </button>
        </PanelCard>

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
      </form>

      <div className="grid w-full min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:gap-5">
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
                <span className="text-xs uppercase text-zinc-500">{r.status}</span>
                <span className="text-xs text-zinc-600">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard className="min-w-0">
          <h2 className="text-sm font-semibold text-white">Timeline</h2>
          <ul className="mt-3 max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto text-sm">
            {bundle.activities.map((a) => (
              <li key={a.id} className="border-l-2 border-amber-500/30 pl-3">
                <p className="font-medium text-zinc-200">{a.title}</p>
                <p className="text-xs text-zinc-500">{a.activityType}</p>
                <p className="text-xs text-zinc-600">{new Date(a.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard className="min-w-0 lg:col-span-2 xl:col-span-1">
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

      {role === 'COMPANY_ADMIN' && (
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
