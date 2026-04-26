export type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string | null;
  deletedAt?: string | null;
  /** Listado superadmin: conteos agregados */
  leadsCount?: number;
  usersCount?: number;
  activeSessionCount?: number;
  lastUserCreatedAt?: string | null;
  lastLeadCreatedAt?: string | null;
  recentAudit?: CompanyAuditRow[];
};

export type CompanyAuditRow = {
  id: string;
  action: string;
  result: string;
  createdAt: string;
  targetType: string;
  targetId: string;
  actorRole: string | null;
};

export type UserListItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  companyId: string | null;
  createdAt: string;
  company?: { id: string; name: string; slug: string } | null;
};

export type UserDetailAuditRow = {
  id: string;
  action: string;
  result: string;
  createdAt: string;
  targetType: string;
  targetId: string;
  companyId: string | null;
};

export type UserDetail = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: string;
  status: string;
  companyId: string | null;
  phone: string | null;
  locale: string | null;
  timezone: string | null;
  timeFormat: string | null;
  dateFormat: string | null;
  theme: string | null;
  authProvider: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  company: { id: string; name: string; slug: string; status: string } | null;
  activeSessionCount: number;
  avatarUrl: string | null;
  avatarType: string;
  avatarBackgroundColor: string | null;
  avatarTextColor: string | null;
  avatarInitials: string | null;
  avatarShape: string;
  lastPasswordChangeAt: string | null;
  leadsAssignedCount: number;
  leadsCreatedCount: number;
  recentAudit: UserDetailAuditRow[];
};

export type Paginated<T> = {
  total: number;
  page: number;
  pageSize: number;
  data: T[];
};

export type LeadListItem = {
  id: string;
  companyId: string;
  source: string;
  status: string;
  priority: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser: { id: string; email: string; firstName: string; lastName: string } | null;
};

export type LeadDetailBundle = {
  lead: LeadListItem & {
    firstName: string | null;
    lastName: string | null;
    message: string | null;
    sourceDetail: string | null;
    rawPayload: unknown;
    normalizedPayload: unknown;
    details: {
      purchaseHistory?: unknown;
      currentContext?: unknown;
      requirements?: unknown;
      preferences?: unknown;
      technicalSnapshot?: unknown;
      commercialSnapshot?: unknown;
      extraData?: unknown;
    } | null;
    createdByUser: { id: string; email: string; firstName: string; lastName: string } | null;
  };
  activities: Array<{
    id: string;
    activityType: string;
    title: string;
    description: string | null;
    createdAt: string;
    actorUser: { id: string; email: string; firstName: string; lastName: string } | null;
  }>;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; email: string; firstName: string; lastName: string };
  }>;
  agentRuns: Array<{
    id: string;
    agentKey: string;
    status: string;
    triggerType: string;
    createdAt: string;
    finishedAt: string | null;
  }>;
};
