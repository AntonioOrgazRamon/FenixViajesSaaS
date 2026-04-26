import { Download, ExternalLink, FileText, Radio } from 'lucide-react';
import { PanelCard } from '../../../components/ui/PanelCard';
import { accountExternalLinks, supportMailto } from '../lib/accountLinks';
import { sectionDescriptionClass, sectionTitleClass } from '../components/profileFormStyles';

export function ProfilePrivacy() {
  const exportSubject = encodeURIComponent('Solicitud de acceso a datos personales (RGPD)');
  const exportBody = encodeURIComponent(
    'Hola,\n\nSolicito información sobre el tratamiento de mis datos personales y, en su caso, el envío de una copia en formato legible.\n\nCorreo de la cuenta: \nOrganización: \n\nGracias.',
  );

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h3 className={sectionTitleClass + ' !text-sm'}>Privacidad, datos y transparencia</h3>
        <p className={sectionDescriptionClass}>
          Enlaces a documentación, estado del servicio y vías para ejercer derechos sobre datos personales según
          normativa aplicable.
        </p>
      </div>

      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Documentación</h4>
        <ul className="mt-2 space-y-1.5 text-[13px]">
          <li>
            <a
              href={accountExternalLinks.privacy}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-amber-800 hover:underline dark:text-amber-300/95"
            >
              <FileText className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Política de privacidad
              <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-80" aria-hidden />
            </a>
          </li>
          <li>
            <a
              href={accountExternalLinks.terms}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-amber-800 hover:underline dark:text-amber-300/95"
            >
              <FileText className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Términos y condiciones de uso
              <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-80" aria-hidden />
            </a>
          </li>
        </ul>
      </PanelCard>

      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Producto y servicio</h4>
        <ul className="mt-2 space-y-1.5 text-[13px]">
          <li>
            <a
              href={accountExternalLinks.statusPage}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-amber-800 hover:underline dark:text-amber-300/95"
            >
              <Radio className="h-3.5 w-3.5 opacity-80" aria-hidden />
              Estado del servicio
              <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-80" aria-hidden />
            </a>
          </li>
          <li>
            <a
              href={accountExternalLinks.productUpdates}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-amber-800 hover:underline dark:text-amber-300/95"
            >
              Novedades y notas de versión
              <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-80" aria-hidden />
            </a>
          </li>
        </ul>
      </PanelCard>

      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <Download className="mt-0.5 h-4 w-4 shrink-0 text-amber-600/90 dark:text-amber-400/90" aria-hidden />
          <div>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-white">Portabilidad y copia de datos</h4>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              Puedes solicitar información sobre el tratamiento de tus datos o una copia en formato legible. El equipo
              validará la petición y el plazo según RGPD y contrato con tu organización.
            </p>
            <a
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
              href={`mailto:${supportMailto}?subject=${exportSubject}&body=${exportBody}`}
            >
              Abrir solicitud por correo
            </a>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
