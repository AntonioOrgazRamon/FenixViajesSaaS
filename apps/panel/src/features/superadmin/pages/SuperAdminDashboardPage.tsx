import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Building2, Clock3, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Paginated, Company, UserListItem } from '../../../types/domain';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function kpiValue(q: { isLoading: boolean; isError: boolean }, value: number | undefined) {
  if (q.isLoading) return '...';
  if (q.isError) return '—';
  return value ?? 0;
}

type FlowStage = {
  id: string;
  title: string;
  subtitle: string;
  ratio: number;
  agentHint: string;
};

const FLOW_STAGES: FlowStage[] = [
  {
    id: 'visit',
    title: 'Visita',
    subtitle: 'Tráfico web y entradas por campañas',
    ratio: 100,
    agentHint: 'Atribución automática UTM',
  },
  {
    id: 'interaction',
    title: 'Interacción',
    subtitle: 'Clicks en catálogo, lectura y señales',
    ratio: 72,
    agentHint: 'Clasificación de intención',
  },
  {
    id: 'intent',
    title: 'Intención',
    subtitle: 'Inicio de reserva o envío de formulario',
    ratio: 44,
    agentHint: 'Lead scoring inicial',
  },
  {
    id: 'lead',
    title: 'Lead',
    subtitle: 'Lead creado y enriquecido en CRM',
    ratio: 29,
    agentHint: 'Enriquecimiento + next-best-action',
  },
  {
    id: 'customer',
    title: 'Cliente',
    subtitle: 'Conversión final y seguimiento',
    ratio: 15,
    agentHint: 'Agente comercial de cierre',
  },
];

export function SuperAdminDashboardPage() {
  const companies = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'dash'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: { page: 1, pageSize: 5 },
      });
      return unwrap(data);
    },
  });
  const users = useQuery<Paginated<UserListItem>>({
    queryKey: ['users', 'dash'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: { page: 1, pageSize: 5 },
      });
      return unwrap(data);
    },
  });

  const activeCompanies = companies.data?.data.filter((c) => c.status === 'ACTIVE').length ?? 0;
  const suspendedCompanies = companies.data?.data.filter((c) => c.status === 'SUSPENDED').length ?? 0;
  const recentCompanies = companies.data?.data.slice(0, 4) ?? [];
  const recentUsers = users.data?.data.slice(0, 4) ?? [];

  const statusPill = (status: string) =>
    status === 'ACTIVE'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
      : 'border-amber-500/25 bg-amber-500/10 text-amber-300';

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Superadmin"
        description="Control central del ecosistema: visibilidad rápida de tenants y usuarios para tomar decisiones operativas."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white/80 px-3 py-1.5 text-xs text-zinc-600 dark:border-white/[0.08] dark:bg-zinc-900/40 dark:text-zinc-400">
            <Clock3 className="h-3.5 w-3.5" />
            Actualización en tiempo real
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanelCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/70 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-zinc-400">
              <Building2 className="h-3.5 w-3.5" />
              Tenants
            </span>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">Empresas registradas</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">
              {kpiValue(companies, companies.data?.total)}
            </p>
          </div>
        </PanelCard>

        <PanelCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/70 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Estado
            </span>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">Tenants activos (muestra)</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">{kpiValue(companies, activeCompanies)}</p>
          </div>
        </PanelCard>

        <PanelCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-rose-500/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/70 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-zinc-400">
              <Building2 className="h-3.5 w-3.5" />
              Riesgo
            </span>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">Tenants suspendidos (muestra)</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">{kpiValue(companies, suspendedCompanies)}</p>
          </div>
        </PanelCard>

        <PanelCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/70 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-zinc-400">
              <Users className="h-3.5 w-3.5" />
              Personas
            </span>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">Usuarios totales</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">{kpiValue(users, users.data?.total)}</p>
          </div>
        </PanelCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <PanelCard className="overflow-hidden border-zinc-200/90 dark:border-white/[0.08]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Empresas recientes</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">Últimos tenants visibles en dashboard</p>
            </div>
            <Link
              to="/superadmin/tenants"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-zinc-100/70 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]"
            >
              Gestionar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentCompanies.length === 0 && !companies.isLoading ? (
              <p className="rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-500 dark:border-white/[0.12] dark:bg-zinc-900/25 dark:text-zinc-400">
                No hay empresas para mostrar.
              </p>
            ) : null}
            {recentCompanies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-2.5 dark:border-white/[0.07] dark:bg-zinc-900/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{company.name}</p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{company.slug}</p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill(company.status)}`}>
                    {company.status}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatDate(company.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard className="overflow-hidden border-zinc-200/90 dark:border-white/[0.08]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Usuarios recientes</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">Actividad de altas en el sistema</p>
            </div>
            <Link
              to="/superadmin/users"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-zinc-100/70 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]"
            >
              Ver usuarios
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentUsers.length === 0 && !users.isLoading ? (
              <p className="rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-500 dark:border-white/[0.12] dark:bg-zinc-900/25 dark:text-zinc-400">
                No hay usuarios para mostrar.
              </p>
            ) : null}
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-2.5 dark:border-white/[0.07] dark:bg-zinc-900/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{user.email}</p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {user.company?.name ?? 'Sin empresa'} · {user.role}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">{formatDate(user.createdAt)}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      <PanelCard className="overflow-hidden border-zinc-200/90 dark:border-white/[0.08]">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Visualizador de flujo de clientes</p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Vista de embudo operacional preparada para conectar eventos reales y agentes de IA.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Vista estratégica (beta)
          </div>
        </div>

        <div className="grid gap-2.5 xl:grid-cols-5">
          {FLOW_STAGES.map((stage, idx) => (
            <div
              key={stage.id}
              className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-3 dark:border-white/[0.08] dark:bg-zinc-900/30"
            >
              {idx < FLOW_STAGES.length - 1 ? (
                <div
                  className="pointer-events-none absolute right-[-12px] top-1/2 hidden h-px w-5 -translate-y-1/2 bg-zinc-300/80 xl:block dark:bg-white/[0.15]"
                  aria-hidden
                />
              ) : null}
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{stage.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{stage.subtitle}</p>

              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{ width: `${stage.ratio}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{stage.ratio}% paso relativo</p>
              </div>

              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                <Bot className="h-3 w-3" />
                {stage.agentHint}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-dashed border-zinc-300/80 bg-white/60 p-3 text-xs text-zinc-600 dark:border-white/[0.14] dark:bg-zinc-950/30 dark:text-zinc-400">
          Próximo paso recomendado: conectar este panel a eventos (`page_view`, `item_click`, `start_booking`, `booking_completed`) para visualizar
          conversión real por tenant y activar agentes automáticos por caída de etapa.
        </div>
      </PanelCard>
    </div>
  );
}
