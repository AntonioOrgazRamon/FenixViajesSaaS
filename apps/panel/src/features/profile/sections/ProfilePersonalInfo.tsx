import { PanelCard } from '../../../components/ui/PanelCard';
import { PersonalInfoForm } from '../components/PersonalInfoForm';
import type { AuthUser } from '../../../store/authStore';

export function ProfilePersonalInfo({ data }: { data: AuthUser }) {
  return (
    <PanelCard className="min-w-0" padding="p-4 sm:p-5">
      <PersonalInfoForm data={data} embedded />
    </PanelCard>
  );
}
