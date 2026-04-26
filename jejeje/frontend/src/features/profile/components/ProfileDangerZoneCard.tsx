import { ProfileSectionCard } from './ProfileSectionCard';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/cn';

export function ProfileDangerZoneCard({ embedded, compact }: { embedded?: boolean; compact?: boolean }) {
  const box = (
    <div
      className={cn(
        'flex gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-100',
        compact ? 'p-2 text-[10px] leading-snug' : 'p-2.5 text-[11px]',
      )}
    >
      <AlertTriangle
        className={cn('shrink-0 text-amber-600 dark:text-amber-400', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
        aria-hidden
      />
      <p>
        {compact ? (
          <>
            <strong>Autocierre de cuenta</strong> no disponible aún. Para baja, export o RGPD, contacta a{' '}
            <strong>administración o soporte</strong> con tu correo y organización.
          </>
        ) : (
          <>
            El producto aún <strong>no ofrece</strong> cierre de cuenta en autogestión desde el panel. Para solicitudes
            de baja, exportación de datos o eliminación conforme a RGPD,{' '}
            <strong>contacta con el administrador de tu espacio o con soporte</strong> indicando el correo y la
            organización. Evitamos botones destructivos que puedan activarse por error.
          </>
        )}
      </p>
    </div>
  );

  if (embedded) {
    return <div className="min-w-0">{box}</div>;
  }

  return (
    <ProfileSectionCard
      id="danger"
      title="Baja o eliminación de cuenta"
      description="Zona restringida. Cualquier cierre o borrado debe cumplir normativa, contrato y debería requerir confirmación explícita."
    >
      {box}
    </ProfileSectionCard>
  );
}
