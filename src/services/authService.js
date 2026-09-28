import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { getRandomAvatar } from '../data/avatars';

export const GOOGLE_CLIENT_ID = '514433759579-r2i3dsva88gcnobhk1bm5eb8rls1lji1.apps.googleusercontent.com';

export const authService = {
  /**
   * Check if a display name / username is available (unique, case-insensitive)
   */
  async isDisplayNameAvailable(displayName, excludeUserId = null) {
    if (!displayName || !displayName.trim()) return false;
    const clean = displayName.trim().toLowerCase();

    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('profiles')
          .select('id, display_name')
          .ilike('display_name', clean);

        if (excludeUserId) {
          query = query.neq('id', excludeUserId);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('Check display name error:', error.message);
          return true;
        }
        return !data || data.length === 0;
      } catch (err) {
        console.warn('Check display name exception:', err);
        return true;
      }
    }

    const users = localStore.getUsers();
    const match = users.find(u => 
      u.display_name && u.display_name.trim().toLowerCase() === clean && u.id !== excludeUserId
    );
    return !match;
  },

  async getCurrentUser() {
    if (isSupabaseConfigured) {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        return null;
      }
      
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

      // Persist avatar only if missing
      if (!rawAvatar) {
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
      const resolved = {
        id: session.user.id,
        email: session.user.email,
        display_name: profile?.display_name || session.user.user_metadata?.display_name || session.user.email.split('@')[0],
        avatar_url: avatarUrl,
        role: userRole
      };
      localStore.setCurrentUser(resolved);
      return resolved;
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
      return await this.getCurrentUser();
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
    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check display name uniqueness
    const isAvail = await this.isDisplayNameAvailable(cleanName);
    if (!isAvail) {
      throw new Error(`The username "${cleanName}" is already taken. Please choose another username.`);
    }

    const assignedAvatar = getRandomAvatar(cleanEmail || cleanName);

    if (isSupabaseConfigured) {
      let authUser = null;
      let authSession = null;

      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanName,
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
            display_name: cleanName,
            avatar_url: assignedAvatar,
            role: cleanEmail === 'tushrahul58@gmail.com' ? 'admin' : 'Member',
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Profiles table upsert notice:', err.message);
        }
      }
      return await this.getCurrentUser() || authUser;
    }

    const users = localStore.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }
    const newUser = {
      id: 'user-' + Date.now(),
      email: cleanEmail,
      display_name: cleanName,
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
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    localStore.setCurrentUser(null);
  },

  /**
   * Google OAuth 2.0 Sign-In using Google Identity Services
   */
  async signInWithGoogle() {
    return new Promise((resolve, reject) => {
      const startAuth = () => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error('Google Sign-In is initializing. Please try again in a few seconds.'));
          return;
        }

        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                reject(new Error(tokenResponse.error_description || tokenResponse.error));
                return;
              }
              try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                if (!res.ok) throw new Error('Failed to retrieve Google user profile.');
                const googleUserInfo = await res.json();
                const loggedInUser = await authService.loginWithGoogleUser(googleUserInfo);
                resolve(loggedInUser);
              } catch (err) {
                reject(err);
              }
            },
            error_callback: (err) => {
              reject(new Error(err?.message || 'Google Sign-In was cancelled or failed.'));
            }
          });

          client.requestAccessToken();
        } catch (err) {
          reject(err);
        }
      };

      if (window.google?.accounts?.oauth2) {
        startAuth();
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => startAuth();
        script.onerror = () => reject(new Error('Could not load Google authentication service.'));
        document.head.appendChild(script);
      }
    });
  },

  /**
   * Internal helper to register / log in user from Google profile
   */
  async loginWithGoogleUser(googleUser) {
    const email = (googleUser.email || '').toLowerCase().trim();
    if (!email) throw new Error('Google did not return a valid email address.');
    const picture = googleUser.picture || getRandomAvatar(email);
    const rawName = googleUser.name || email.split('@')[0];

    if (isSupabaseConfigured) {
      // 1. Check if user profile already exists in public.profiles
      let profile = null;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        profile = data;
      } catch (err) {
        console.warn('Profiles query notice:', err);
      }

      let userId = profile?.id;
      let displayName = profile?.display_name;
      let avatarUrl = profile?.avatar_url || picture;
      const userRole = profile?.role || (email === 'tushrahul58@gmail.com' ? 'admin' : 'Member');

      // 2. If new user, guarantee unique display name and insert profile
      if (!profile) {
        userId = crypto.randomUUID();
        let baseName = rawName.trim().replace(/\s+/g, '_');
        let isAvail = await this.isDisplayNameAvailable(baseName);
        displayName = isAvail ? baseName : `${baseName}_${Math.floor(100 + Math.random() * 900)}`;

        try {
          await supabase.from('profiles').insert([{
            id: userId,
            email,
            display_name: displayName,
            avatar_url: avatarUrl,
            role: userRole,
            updated_at: new Date().toISOString()
          }]);
        } catch (err) {
          console.warn('Google profile insert error:', err);
        }
      } else if (!profile.avatar_url || profile.avatar_url.includes('dicebear.com')) {
        // Update avatar if missing or legacy
        try {
          await supabase.from('profiles').update({
            avatar_url: picture,
            updated_at: new Date().toISOString()
          }).eq('id', userId);
          avatarUrl = picture;
        } catch (_) {}
      }

      // 3. Try to establish or create Supabase Auth session if possible
      try {
        const googlePass = `Google#Auth#${googleUser.sub || 'Ideate2026'}!`;
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email,
          password: googlePass
        });
        if (signErr) {
          await supabase.auth.signUp({
            email,
            password: googlePass,
            options: {
              data: {
                display_name: displayName,
                avatar_url: avatarUrl,
                role: userRole
              }
            }
          });
          await supabase.auth.signInWithPassword({
            email,
            password: googlePass
          });
        }
      } catch (_) {}

      const resolved = {
        id: userId,
        email,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: userRole
      };
      localStore.setCurrentUser(resolved);
      return resolved;
    }

    // Local / Offline fallback
    const users = localStore.getUsers();
    let existing = users.find(u => u.email.toLowerCase() === email);
    if (!existing) {
      let baseName = rawName.trim().replace(/\s+/g, '_');
      let isAvail = await this.isDisplayNameAvailable(baseName);
      const displayName = isAvail ? baseName : `${baseName}_${Math.floor(100 + Math.random() * 900)}`;
      existing = {
        id: 'google-' + Date.now(),
        email,
        display_name: displayName,
        avatar_url: picture,
        role: email === 'tushrahul58@gmail.com' ? 'admin' : 'Member'
      };
      users.push(existing);
      localStorage.setItem('ideate_users_v1', JSON.stringify(users));
    } else {
      existing.avatar_url = picture;
    }
    localStore.setCurrentUser(existing);
    return existing;
  },

  async updateProfile({ displayName, avatarUrl }) {
    const cleanName = displayName ? displayName.trim() : '';

    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      const current = await this.getCurrentUser();
      const currentUserId = user?.id || current?.id;
      if (!currentUserId) throw new Error('No active user session');

      // Check unique display name if changed
      if (cleanName) {
        const isAvail = await this.isDisplayNameAvailable(cleanName, currentUserId);
        if (!isAvail) {
          throw new Error(`The username "${cleanName}" is already taken. Please choose another username.`);
        }
      }

      // Update auth user metadata if auth session exists
      if (user) {
        try {
          await supabase.auth.updateUser({
            data: {
              display_name: cleanName,
              avatar_url: avatarUrl
            }
          });
        } catch (_) {}
      }

      // Update profiles table
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: currentUserId,
            email: user?.email || current?.email,
            display_name: cleanName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.warn('Profiles table upsert notice:', err.message);
      }

      const resolved = {
        id: currentUserId,
        email: user?.email || current?.email,
        display_name: cleanName,
        avatar_url: avatarUrl,
        role: current?.role || 'Member'
      };
      localStore.setCurrentUser(resolved);
      return resolved;
    }

    const currentUser = localStore.getCurrentUser();
    if (!currentUser) throw new Error('No user found');

    if (cleanName) {
      const isAvail = await this.isDisplayNameAvailable(cleanName, currentUser.id);
      if (!isAvail) {
        throw new Error(`The username "${cleanName}" is already taken. Please choose another username.`);
      }
    }

    const updated = {
      ...currentUser,
      display_name: cleanName,
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
