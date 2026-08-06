import { PanelCard } from '../../../components/ui/PanelCard';
import { ThemePreferencePicker } from '../components/ThemePreferencePicker';
import type { ThemePreference } from '../../../lib/theme';

export function ProfileAppearance({ theme }: { theme: ThemePreference }) {
  return (
    <PanelCard className="min-w-0" padding="p-4 sm:p-5">
      <ThemePreferencePicker value={theme} />
    </PanelCard>
  );
}
