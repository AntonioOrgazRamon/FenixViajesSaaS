import { AvatarSettingsSection } from '../components/AvatarSettingsSection';
import type { AuthUser } from '../../../store/authStore';

/** Avatar, vista previa y generador; sin doble contenedor (el bloque ya trae sub-paneles). */
export function ProfileAvatar({ data }: { data: AuthUser }) {
  return <AvatarSettingsSection data={data} embedded />;
}
