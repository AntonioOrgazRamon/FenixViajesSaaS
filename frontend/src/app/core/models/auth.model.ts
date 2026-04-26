export interface User {
  id: number;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  memberships: Membership[];
}

export interface Membership {
  companyId: number;
  companyName: string;
  role: 'COMPANY_ADMIN' | 'USER';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginDto {
  email: string;
  password: string;
}
