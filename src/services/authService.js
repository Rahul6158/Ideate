import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { USERS } from '../data/mockData';
import { getRandomAvatar } from '../data/avatars';

export const authService = {
  async getCurrentUser() {
    if (isSupabaseConfigured) {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return null;
      
      let profile = null;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (data) profile = data;
      } catch (err) {
        console.warn('Profiles query error:', err.message);
      }
        
      const rawAvatar = profile?.avatar_url || session.user.user_metadata?.avatar_url;
      const avatarUrl = (rawAvatar && !rawAvatar.includes('dicebear.com'))
        ? rawAvatar
        : getRandomAvatar(session.user.email);

      // Automatically persist avatar if missing or legacy
      if (!rawAvatar || rawAvatar.includes('dicebear.com')) {
        try {
          supabase.auth.updateUser({
            data: { avatar_url: avatarUrl }
          }).catch(() => {});

          supabase.from('profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            display_name: profile?.display_name || session.user.user_metadata?.display_name || session.user.email.split('@')[0],
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          }).catch(() => {});
        } catch (_) {}
      }

      const userRole = profile?.role || session.user.user_metadata?.role || (session.user.email === 'tushrahul58@gmail.com' ? 'admin' : 'Member');
      return {
        id: session.user.id,
        email: session.user.email,
        display_name: profile?.display_name || session.user.user_metadata?.display_name || session.user.email.split('@')[0],
        avatar_url: avatarUrl,
        role: userRole
      };
    }

    const current = localStore.getCurrentUser();
    if (current && (!current.avatar_url || current.avatar_url.includes('dicebear.com'))) {
      current.avatar_url = getRandomAvatar(current.email || current.display_name);
      localStore.setCurrentUser(current);
    }
    return current;
  },

  async login(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      // Automatically assign and persist avatar if new/missing
      const user = data.user;
      if (user && (!user.user_metadata?.avatar_url || user.user_metadata.avatar_url.includes('dicebear.com'))) {
        const autoAvatar = getRandomAvatar(user.email);
        try {
          await supabase.auth.updateUser({
            data: { avatar_url: autoAvatar }
          });
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.email.split('@')[0],
            avatar_url: autoAvatar,
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Auto avatar assignment notice:', err.message);
        }
      }
      return data.user;
    }

    // Offline cache / Local fallback: find user by email or register
    const users = localStore.getUsers();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      // Allow seamless login with entered email
      const name = email.split('@')[0];
      user = {
        id: 'user-' + Date.now(),
        email,
        display_name: name.charAt(0).toUpperCase() + name.slice(1),
        avatar_url: getRandomAvatar(email),
        role: 'Member'
      };
      users.push(user);
      localStorage.setItem('ideate_users_v1', JSON.stringify(users));
    } else if (!user.avatar_url || user.avatar_url.includes('dicebear.com')) {
      user.avatar_url = getRandomAvatar(user.email);
    }
    localStore.setCurrentUser(user);
    return user;
  },

  async signup(email, password, displayName) {
    const assignedAvatar = getRandomAvatar(email || displayName);
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured) {
      let authUser = null;
      let authSession = null;

      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: displayName,
              avatar_url: assignedAvatar,
              role: cleanEmail === 'tushrahul58@gmail.com' ? 'admin' : 'Member'
            }
          }
        });

        if (error) {
          // If rate limit reached on email confirmation dispatch, attempt immediate sign-in
          if (error.message?.includes('rate limit') || error.code === 'over_email_send_rate_limit') {
            const loginRes = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password
            });
            if (loginRes.data?.user) {
              authUser = loginRes.data.user;
              authSession = loginRes.data.session;
            } else {
              throw new Error('Account created! Please log in with your email and password.');
            }
          } else {
            throw error;
          }
        } else {
          authUser = data.user;
          authSession = data.session;
        }

        // If session was not immediately returned (due to email confirmation flag), auto-sign-in now
        if (!authSession && authUser) {
          try {
            const loginAttempt = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password
            });
            if (loginAttempt.data?.user) {
              authUser = loginAttempt.data.user;
            }
          } catch (_) {}
        }
      } catch (err) {
        throw err;
      }

      if (authUser) {
        try {
          await supabase.from('profiles').upsert({
            id: authUser.id,
            email: cleanEmail,
            display_name: displayName,
            avatar_url: assignedAvatar,
            role: cleanEmail === 'tushrahul58@gmail.com' ? 'admin' : 'Member',
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Profiles table upsert notice:', err.message);
        }
      }
      return authUser;
    }

    const users = localStore.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }
    const newUser = {
      id: 'user-' + Date.now(),
      email,
      display_name: displayName,
      avatar_url: assignedAvatar,
      role: 'Member'
    };
    users.push(newUser);
    localStorage.setItem('ideate_users_v1', JSON.stringify(users));
    localStore.setCurrentUser(newUser);
    return newUser;
  },

  async logout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStore.setCurrentUser(null);
  },

  async signInWithOAuth(provider = 'google') {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return data;
    }
    throw new Error(`${provider} authentication requires Supabase OAuth credentials.`);
  },

  async updateProfile({ displayName, avatarUrl }) {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active user session');

      // Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_url: avatarUrl
        }
      });

      // Update profiles table
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.warn('Profiles table upsert notice:', err.message);
      }

      return {
        id: user.id,
        email: user.email,
        display_name: displayName,
        avatar_url: avatarUrl
      };
    }

    const currentUser = localStore.getCurrentUser();
    if (!currentUser) throw new Error('No user found');
    const updated = {
      ...currentUser,
      display_name: displayName,
      avatar_url: avatarUrl
    };
    localStore.setCurrentUser(updated);

    const users = localStore.getUsers();
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) {
      users[idx] = updated;
      localStorage.setItem('ideate_users_v1', JSON.stringify(users));
    }
    return updated;
  },

  async resendConfirmationEmail(email) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email
      });
      if (error) throw error;
      return data;
    }
    return true;
  }
};
