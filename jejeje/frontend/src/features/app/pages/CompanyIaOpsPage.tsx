import { Activity, Coins, Cpu, ShieldCheck, Zap } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

const metrics = [
  { label: 'Tokens (30d)', value: '—', hint: 'Conectar billing / proveedor' },
  { label: 'Latencia p95 generación', value: '—', hint: 'Pipeline propuesta + PDF' },
  { label: 'Tasa error IA', value: '—', hint: 'LeadActivity + logs' },
];

export function CompanyIaOpsPage() {
  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="IA y observabilidad"
        description="Centro de mando para costes, salud de pipelines y cumplimiento. Datos en vivo cuando exista endpoint de uso por tenant."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
            <Cpu className="h-3 w-3" strokeWidth={2} />
            Placeholder operativo
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <PanelCard key={m.label} padding="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{m.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{m.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{m.hint}</p>
          </PanelCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard>
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <Coins className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold">Presupuesto y límites</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Aquí definiremos tope mensual por empresa, alertas al 80% y modo degradado (sin LLM, solo reglas) para proteger margen.
          </p>
        </PanelCard>
        <PanelCard>
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold">Cumplimiento</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Retención de prompts, clasificación de datos personales en notas y export para DPO cuando el backend exponga
            `ai_usage_events` y enmascarado PII en logs.
          </p>
        </PanelCard>
        <PanelCard className="lg:col-span-2">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold">Salud del sistema</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Paneles enlazados a colas de generación, finalización de versiones y notificaciones a vendedor (
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-white/10">SELLER_NOTIFIED</code>
            ). Integración pendiente con tu proveedor APM.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Próximo: webhooks Slack / Teams desde el mismo dispatcher que el email operativo.</span>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
