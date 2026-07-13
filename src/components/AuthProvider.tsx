'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSession, logoutUser } from '@/lib/localAuth';
import { setUserId } from '@/lib/store';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    const user = session.user;
    if (user) {
      setUserId(user.id);
      Promise.resolve().then(() => {
        setUser({ id: user.id, email: user.email });
        setProfile({
          id: user.id,
          full_name: user.full_name,
          currency: user.currency,
          onboarding_completed: user.onboarding_completed,
          email: user.email,
          phone: user.phone,
          monthly_income: user.monthly_income,
          primary_goal: user.primary_goal,
          occupation: user.occupation,
          business_name: user.business_name,
          business_type: user.business_type,
          terms_accepted: user.terms_accepted,
        });
      });
    } else {
      setUserId('local-user');
    }
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(() => {
    const session = getSession();
    if (session.user) {
      setUserId(session.user.id);
      setUser({ id: session.user.id, email: session.user.email });
      setProfile({
        id: session.user.id,
        full_name: session.user.full_name,
        currency: session.user.currency,
        onboarding_completed: session.user.onboarding_completed,
        email: session.user.email,
        phone: session.user.phone,
        monthly_income: session.user.monthly_income,
        primary_goal: session.user.primary_goal,
        occupation: session.user.occupation,
        business_name: session.user.business_name,
        business_type: session.user.business_type,
        terms_accepted: session.user.terms_accepted,
      });
    } else {
      setUserId('local-user');
      setUser(null);
      setProfile(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    logoutUser();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
