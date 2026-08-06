import { PanelCard } from '../../../components/ui/PanelCard';
import { PreferencesForm } from '../components/PreferencesForm';
import type { AuthUser } from '../../../store/authStore';

export function ProfilePreferences({ data }: { data: AuthUser }) {
  return (
    <PanelCard className="min-w-0" padding="p-4 sm:p-5">
      <PreferencesForm data={data} embedded />
    </PanelCard>
  );
}
