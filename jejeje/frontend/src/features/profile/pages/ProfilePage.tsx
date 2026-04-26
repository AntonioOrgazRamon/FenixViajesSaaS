import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { getApiErrorMessage } from '../../../lib/errors';
import { useProfileQuery } from '../hooks/useProfileQuery';
import { ProfilePageSkeleton } from '../components/ProfilePageSkeleton';
import { ProfileInternalSidebar } from '../components/ProfileInternalSidebar';
import {
  PROFILE_SECTIONS,
  type ProfileSectionId,
  parseProfileSectionId,
} from '../sections/profileSectionTypes';
import { ProfileOverview } from '../sections/ProfileOverview';
import { ProfileActivity } from '../sections/ProfileActivity';
import { ProfileOrganization } from '../sections/ProfileOrganization';
import { ProfilePersonalInfo } from '../sections/ProfilePersonalInfo';
import { ProfileAppearance } from '../sections/ProfileAppearance';
import { ProfilePreferences } from '../sections/ProfilePreferences';
import { ProfileNotifications } from '../sections/ProfileNotifications';
import { ProfilePrivacy } from '../sections/ProfilePrivacy';
import { ProfileConnections } from '../sections/ProfileConnections';
import { ProfileAvatar } from '../sections/ProfileAvatar';
import { ProfileSecurity } from '../sections/ProfileSecurity';
import type { ThemePreference } from '../../../lib/theme';
import { cn } from '../../../lib/cn';

export function ProfilePage() {
  const { data, isLoading, isError, error, refetch } = useProfileQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<ProfileSectionId>(() =>
    parseProfileSectionId(
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('section') : null,
    ) ?? 'overview',
  );

  useEffect(() => {
    const raw = searchParams.get('section');
    const next = parseProfileSectionId(raw);
    if (raw && next == null) {
      setSearchParams({}, { replace: true });
      setSection('overview');
      return;
    }
    if (next != null) setSection(next);
    else setSection('overview');
  }, [searchParams, setSearchParams]);

  const selectSection = useCallback(
    (id: ProfileSectionId) => {
      setSection(id);
      setSearchParams(id === 'overview' ? {} : { section: id }, { replace: true });
    },
    [setSearchParams],
  );

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-4 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        <p className="font-medium">No se pudo cargar la cuenta</p>
        <p className="mt-1 text-xs opacity-90">{getApiErrorMessage(error)}</p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-200/80 dark:bg-red-500/20 dark:text-red-100"
          onClick={() => refetch()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">No hay datos de perfil.</p>;
  }

  const theme: ThemePreference = (data.theme as ThemePreference) ?? 'SYSTEM';
  const lang = data.language === 'en' ? 'en' : 'es';
  const meta = PROFILE_SECTIONS[section];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        className="shrink-0"
        title="Cuenta"
        description="Una sección a la vez. Cada bloque se guarda por separado; el tema se aplica al instante."
      />

      <div className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/50 shadow-sm dark:border-white/[0.08] dark:bg-zinc-950/30 sm:mt-0.5 sm:flex-row">
        <ProfileInternalSidebar active={section} onSelect={selectSection} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-zinc-200/80 dark:border-white/[0.07] sm:border-l sm:border-t-0">
          <header
            className={cn(
              'shrink-0 border-b border-zinc-200/80 px-4 dark:border-white/[0.07] sm:px-5',
              section === 'security' ? 'py-2' : 'py-3 sm:py-3.5',
            )}
          >
            <h2
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}
            >
              {meta.title}
            </h2>
            {section === 'security' ? (
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">Correo, contraseña y dispositivos en una sola pantalla (detalles bajo acordeones).</p>
            ) : (
              <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-500">{meta.description}</p>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-2.5 sm:px-5 sm:py-3.5">
            <div key={section} className="profile-section-panel min-w-0 pb-1 sm:pb-2">
              {section === 'overview' && <ProfileOverview user={data} />}
              {section === 'activity' && <ProfileActivity language={lang} />}
              {section === 'organization' && <ProfileOrganization data={data} />}
              {section === 'personal' && <ProfilePersonalInfo data={data} />}
              {section === 'appearance' && <ProfileAppearance theme={theme} />}
              {section === 'preferences' && <ProfilePreferences data={data} />}
              {section === 'notifications' && <ProfileNotifications data={data} />}
              {section === 'privacy' && <ProfilePrivacy />}
              {section === 'connections' && <ProfileConnections data={data} />}
              {section === 'avatar' && <ProfileAvatar data={data} />}
              {section === 'security' && <ProfileSecurity data={data} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
