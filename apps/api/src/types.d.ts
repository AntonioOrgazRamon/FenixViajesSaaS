declare namespace Express {
  export interface Request {
    id: string;
    user?: {
      id: string;
      role: string;
      companyId: string | null;
      sessionId: string;
    };
  }
}
