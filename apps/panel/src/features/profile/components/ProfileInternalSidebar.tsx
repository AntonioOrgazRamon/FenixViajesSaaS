import {
  Bell,
  Building2,
  History,
  Image,
  LayoutDashboard,
  Link2,
  Lock,
  Palette,
  Shield,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { cn } from '../../../lib/cn';
import { PROFILE_SECTION_IDS, PROFILE_SECTIONS, type ProfileSectionId } from '../sections/profileSectionTypes';

const ICON: Record<ProfileSectionId, typeof User> = {
  overview: LayoutDashboard,
  activity: History,
  organization: Building2,
  personal: User,
  appearance: Palette,
  preferences: SlidersHorizontal,
  notifications: Bell,
  privacy: Shield,
  connections: Link2,
  avatar: Image,
  security: Lock,
};

type Props = {
  active: ProfileSectionId;
  onSelect: (id: ProfileSectionId) => void;
};

export function ProfileInternalSidebar({ active, onSelect }: Props) {
  return (
    <nav
      className={cn(
        'flex min-h-0 min-w-0 flex-none flex-row gap-0.5 overflow-x-auto overscroll-x-contain border-b p-1.5 sm:w-[13.5rem] sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:border-b-0 sm:border-r',
        'border-zinc-200/90 bg-zinc-50/40 dark:border-white/[0.07] dark:bg-zinc-950/25',
      )}
      aria-label="Secciones de la cuenta"
    >
      {PROFILE_SECTION_IDS.map((id) => {
        const { label } = PROFILE_SECTIONS[id];
        const Icon = ICON[id];
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-all duration-200',
              'min-w-[10.25rem] flex-none sm:min-w-0 sm:w-full',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/50',
              isActive
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.08] dark:text-zinc-50'
                : 'text-zinc-500 hover:bg-white/70 hover:text-zinc-800 dark:hover:bg-white/[0.04] dark:hover:text-zinc-200',
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                isActive
                  ? 'text-amber-600 dark:text-amber-400/95'
                  : 'text-zinc-400 dark:text-zinc-500',
              )}
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
