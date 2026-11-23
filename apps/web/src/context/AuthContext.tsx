import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthMeResponse, TenantDetailResponse } from '@voicepilot/shared';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthMeResponse['user'] | null;
  memberships: AuthMeResponse['memberships'];
  activeTenantId: string | null;
  activeTenant: TenantDetailResponse | null;
  loading: boolean;
  isMockMode: boolean;
  getAuthToken: () => string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  createCompany: (name: string, slug?: string) => Promise<{ id: string } | null>;
  switchCompany: (tenantId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'voicepilot_demo_session';
const ACTIVE_TENANT_KEY = 'voicepilot_active_tenant_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthMeResponse['user'] | null>(null);
  const [memberships, setMemberships] = useState<AuthMeResponse['memberships']>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(
    localStorage.getItem(ACTIVE_TENANT_KEY)
  );
  const [activeTenant, setActiveTenant] = useState<TenantDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMockMode, setIsMockMode] = useState<boolean>(!isSupabaseConfigured && !import.meta.env.PROD);

  // Helper to make authenticated requests to Fastify API
  const getAuthToken = () => {
    if (session?.access_token) return session.access_token;
    if (isMockMode && user) {
      // Create lightweight signed/encoded token for demo mode
      return `demo_token_${user.id}_${user.email}`;
    }
    return null;
  };

  const fetchProfileAndTenants = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data: AuthMeResponse = await res.json();
        setProfile(data.user);
        setMemberships(data.memberships);

        // Determine active tenant
        const savedTenantId = localStorage.getItem(ACTIVE_TENANT_KEY);
        const hasSaved = data.memberships.some((m) => m.tenantId === savedTenantId);
        const targetId = hasSaved ? savedTenantId : data.memberships[0]?.tenantId || null;

        if (targetId) {
          setActiveTenantId(targetId);
          localStorage.setItem(ACTIVE_TENANT_KEY, targetId);
          await fetchTenantDetails(targetId, token);
        } else {
          setActiveTenantId(null);
          setActiveTenant(null);
        }
      }
    } catch (e) {
      console.warn('Could not sync profile with Fastify backend:', e);
    }
  };

  const fetchTenantDetails = async (tenantId: string, token?: string) => {
    const authToken = token || getAuthToken();
    if (!authToken) return;

    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data: TenantDetailResponse = await res.json();
        setActiveTenant(data);
      }
    } catch (e) {
      console.error('Failed to load tenant details:', e);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);

      if (isSupabaseConfigured) {
        try {
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          if (existingSession) {
            setSession(existingSession);
            setUser(existingSession.user);
            await fetchProfileAndTenants(existingSession.access_token);
          }
        } catch (e) {
          console.error('Error fetching Supabase session:', e);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            setSession(newSession);
            setUser(newSession?.user || null);
            if (newSession?.access_token) {
              await fetchProfileAndTenants(newSession.access_token);
            } else {
              setProfile(null);
              setMemberships([]);
              setActiveTenant(null);
              setActiveTenantId(null);
            }
          }
        );

        setLoading(false);
        return () => subscription.unsubscribe();
      } else {
        // Local Demo fallback
        setIsMockMode(true);
        const stored = localStorage.getItem(DEMO_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setUser(parsed.user);
            setSession(parsed.session);
            await fetchProfileAndTenants(parsed.session.access_token);
          } catch (e) {
            localStorage.removeItem(DEMO_STORAGE_KEY);
          }
        }
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        await fetchProfileAndTenants(data.session.access_token);
      }
      return { error: null };
    }

    // Local Demo Auth (only permitted in non-production development)
    if (import.meta.env.PROD) {
      return { error: 'Authentication service not configured for production deployment.' };
    }
    const mockUser: User = {
      id: `usr_${Math.random().toString(36).substring(2, 10)}`,
      email,
      app_metadata: {},
      user_metadata: { full_name: email.split('@')[0] },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
    const mockSession: Session = {
      access_token: `demo_jwt_${mockUser.id}`,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'demo_refresh_token',
      user: mockUser,
    };

    setUser(mockUser);
    setSession(mockSession);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ user: mockUser, session: mockSession }));
    await fetchProfileAndTenants(mockSession.access_token);
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) return { error: error.message };
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        await fetchProfileAndTenants(data.session.access_token);
      }
      return { error: null };
    }

    // Local Demo Sign Up
    return await signIn(email, password);
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(DEMO_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    setUser(null);
    setSession(null);
    setProfile(null);
    setMemberships([]);
    setActiveTenantId(null);
    setActiveTenant(null);
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error?.message || null };
    }
    return { error: null };
  };

  const createCompany = async (name: string, slug?: string) => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug }),
      });

      if (res.ok) {
        const newTenant = await res.json();
        await fetchProfileAndTenants(token);
        await switchCompany(newTenant.id);
        return { id: newTenant.id };
      }
    } catch (e) {
      console.error('Error creating company:', e);
    }
    return null;
  };

  const switchCompany = async (tenantId: string) => {
    setActiveTenantId(tenantId);
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    await fetchTenantDetails(tenantId);
  };

  const refreshProfile = async () => {
    const token = getAuthToken();
    if (token) {
      await fetchProfileAndTenants(token);
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      memberships,
      activeTenantId,
      activeTenant,
      loading,
      isMockMode,
      getAuthToken,
      signIn,
      signUp,
      signOut,
      resetPassword,
      createCompany,
      switchCompany,
      refreshProfile,
    }),
    [user, session, profile, memberships, activeTenantId, activeTenant, loading, isMockMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
