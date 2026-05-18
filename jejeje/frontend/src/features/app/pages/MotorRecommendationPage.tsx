import { Link } from 'react-router-dom';
import { Brain, GitBranch, Radar, Sparkles, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

const pillars = [
  {
    title: 'Matching transparente',
    body: 'Cada recomendación llevará score, fuentes del catálogo y motivos en lenguaje natural para el vendedor.',
    icon: Radar,
  },
  {
    title: 'Explicabilidad',
    body: 'Bloques “por qué encaja / qué falta” alineados con LeadDetail y actividades, listos para auditoría.',
    icon: Brain,
  },
  {
    title: 'Iteración segura',
    body: 'Versiones de propuesta, regeneración idempotente y trazabilidad sin bloquear el cierre comercial.',
    icon: GitBranch,
  },
];

export function MotorRecommendationPage() {
  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Motor de recomendación"
        description="Capa de síntesis entre intake, catálogo enriquecido (embeddings) y propuesta comercial. Próximo paso: exponer scores y factores desde la API de viajes."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-2.5 py-1 text-[11px] font-medium text-cyan-800 dark:text-cyan-200">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            Preview de producto
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard className="border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.07] to-transparent dark:from-cyan-500/[0.09]">
          <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-200">
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
            <p className="text-xs font-semibold uppercase tracking-wide">Estado</p>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">α</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            El motor ya participa en la propuesta inteligente por lead. Aquí vivirá el dashboard de calibración y A/B de prompts
            cuando conectemos métricas de conversión.
          </p>
        </PanelCard>
        <PanelCard className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Qué verás aquí</p>
          <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-2">
              <span className="text-cyan-600 dark:text-cyan-400">·</span>
              Serie temporal de calidad de match por segmento (destino, presupuesto, temporada).
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-600 dark:text-cyan-400">·</span>
              Dataset de “explicaciones aceptadas” vs descartadas por el vendedor (feedback loop).
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-600 dark:text-cyan-400">·</span>
              Enlace directo al pipeline de ingesta PDF → chunks → embeddings (Travel catalog).
            </li>
          </ul>
          <Link
            to="/leads"
            className="mt-6 inline-flex text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            Ir a leads y probar propuesta inteligente →
          </Link>
        </PanelCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {pillars.map(({ title, body, icon: Icon }) => (
          <PanelCard key={title}>
            <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
          </PanelCard>
        ))}
      </div>
    </div>
  );
}
