import { AccountSummaryCard } from '../components/AccountSummaryCard';
import type { AuthUser } from '../../../store/authStore';

export function ProfileOverview({ user }: { user: AuthUser }) {
  return (
    <div className="min-w-0">
      <AccountSummaryCard user={user} />
    </div>
  );
}
