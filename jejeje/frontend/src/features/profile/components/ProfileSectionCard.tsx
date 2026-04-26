import type { ReactNode } from 'react';
import { PanelCard } from '../../../components/ui/PanelCard';
import { cn } from '../../../lib/cn';
import { sectionDescriptionClass, sectionTitleClass } from './profileFormStyles';

export function ProfileSectionCard({
  id,
  title,
  description,
  children,
  className,
  padding,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn('min-w-0', className)}>
      <PanelCard className="min-w-0" padding={padding}>
        <h2 id={id ? `${id}-title` : undefined} className={sectionTitleClass}>
          {title}
        </h2>
        {description ? <p className={sectionDescriptionClass}>{description}</p> : null}
        <div className="mt-3 min-w-0">{children}</div>
      </PanelCard>
    </section>
  );
}
