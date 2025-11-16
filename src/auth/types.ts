/**
 * Authentication types for QRefine
 */

export interface AuthCredentials {
  email: string;
  password: string;
  username?: string; // Required for signup only
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  active_status: boolean;
  username: string;
}

export interface AuthState {
  access_token: string | null;
  user_id: number | null;
  username: string | null;
  isAuthenticated: boolean;
}

export const DEFAULT_AUTH_STATE: AuthState = {
  access_token: null,
  user_id: null,
  username: null,
  isAuthenticated: false,
};
