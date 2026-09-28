import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const user = await authService.getCurrentUser();
        if (mounted) setCurrentUser(user);
      } catch (err) {
        console.error('Failed to load user', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUser();

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          const user = await authService.getCurrentUser();
          if (mounted) setCurrentUser(user);
        } else {
          if (mounted) setCurrentUser(null);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const user = await authService.login(email, password);
    setCurrentUser(user);
    return user;
  };

  const signup = async (email, password, displayName) => {
    const user = await authService.signup(email, password, displayName);
    setCurrentUser(user);
    return user;
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
  };

  const signInWithOAuth = async (provider) => {
    return await authService.signInWithOAuth(provider);
  };

  const signInWithGoogle = async () => {
    const user = await authService.signInWithGoogle();
    setCurrentUser(user);
    return user;
  };

  const updateProfile = async (updates) => {
    const updatedUser = await authService.updateProfile(updates);
    setCurrentUser(updatedUser);
    return updatedUser;
  };

  const resendConfirmationEmail = async (email) => {
    return await authService.resendConfirmationEmail(email);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      login,
      signup,
      logout,
      signInWithOAuth,
      signInWithGoogle,
      updateProfile,
      resendConfirmationEmail,
      isSupabaseConfigured
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
