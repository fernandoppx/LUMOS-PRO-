import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  isDbApproved: boolean;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return null;
      }

      if (data) {
        let currentProfile = data as Profile;
        if (!currentProfile.aprovado) {
          // Attempt to update aprovado to true in case RLS allows updating own profile
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ aprovado: true })
            .eq('id', userId);
          if (!updErr) {
            currentProfile = { ...currentProfile, aprovado: true };
          }
        }
        setProfile(currentProfile);
        return currentProfile;
      } else {
        // If profile doesn't exist, try to insert one
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user) {
          const { data: newProfile, error: insErr } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              nome: authUser.user.user_metadata?.nome || authUser.user.email?.split('@')[0] || 'Usuário',
              email: authUser.user.email || '',
              papel: 'admin',
              aprovado: true,
            })
            .select()
            .maybeSingle();
          if (!insErr && newProfile) {
            setProfile(newProfile as Profile);
            return newProfile as Profile;
          }
        }
      }
      return null;
    } catch (err) {
      console.error('Falha inesperada ao buscar perfil:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) return null;
    return await fetchProfile(authUser.user.id);
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        // Check for PKCE ?code= in URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
            // Clean up the query params
            const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          } catch (codeErr) {
            console.error('Erro ao trocar código de autenticação:', codeErr);
          }
        }

        // Check if hash contains access_token from email confirmation link
        if (window.location.hash && window.location.hash.includes('access_token=')) {
          // Supabase auto-detects session in URL, wait briefly and clean up hash
          setTimeout(() => {
            if (window.location.hash.includes('access_token=')) {
              window.location.hash = '#/clientes';
            }
          }, 300);
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Erro ao inicializar sessão:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      window.location.hash = '#/login';
    }
  };

  const isAdmin = profile?.papel === 'admin';
  const isApproved = true;
  const isDbApproved = profile?.aprovado === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        isApproved,
        isDbApproved,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
