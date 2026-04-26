export type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
};

export type UserDetail = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  companyId: string | null;
  phone: string | null;
  createdAt: string;
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
