import { supabase, isSupabaseConfigured, localStore } from '../lib/supabase';
import { getRandomAvatar } from '../data/avatars';

export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '514433759579-r2i3dsva88gcnobhk1bm5eb8rls1lji1.apps.googleusercontent.com';

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

      this._saveGoogleBridge(email, password);

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
        this._saveGoogleBridge(cleanEmail, password);
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
   * Ensure Google Identity Services script is loaded eagerly
   */
  preloadGoogleScript() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
    if (window.google?.accounts?.oauth2) return Promise.resolve();

    return new Promise((resolve) => {
      const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existingScript) {
        if (window.google?.accounts?.oauth2) {
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => resolve(), { once: true });
        setTimeout(resolve, 2500);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  },

  /**
   * Fallback OAuth 2.0 Redirect Flow for mobile browsers / in-app webviews that block popups
   */
  startGoogleRedirectAuth() {
    const redirectUri = window.location.origin;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'email profile openid',
      include_granted_scopes: 'true',
      prompt: 'select_account'
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  /**
   * Check URL hash for Google OAuth implicit redirect return (#access_token=...)
   */
  async handleGoogleRedirectCallback() {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return null;

    // Parse fragment parameters
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    if (!accessToken) return null;

    // Clean URL hash immediately so refreshes don't re-trigger
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState({}, document.title, cleanUrl);

    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve Google user profile after redirect.');
    }
    const googleUserInfo = await res.json();
    return await this.loginWithGoogleUser(googleUserInfo);
  },

  async signInWithOAuth(provider) {
    if (provider === 'google') {
      return await this.signInWithGoogle();
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
      return data;
    }
    throw new Error(`OAuth provider "${provider}" is not configured.`);
  },

  /**
   * Google OAuth 2.0 Sign-In using Google Identity Services (with automatic redirect fallback for mobile)
   */
  async signInWithGoogle() {
    // Detect mobile in-app browsers (WhatsApp, Instagram, Facebook, LinkedIn, Telegram) where popups are blocked
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isInAppBrowser = /FBAN|FBAV|Instagram|WhatsApp|Line|LinkedInApp|wv|Telegram/i.test(ua);
    const allowedRedirectOrigins = [
      'https://ideate-black.vercel.app',
      'https://hegemonical-marin-unbarrenly.ngrok-free.dev',
      'http://localhost:5173'
    ];
    const canUseRedirectFallback =
      typeof window !== 'undefined' && allowedRedirectOrigins.includes(window.location.origin);

    if (isInAppBrowser && canUseRedirectFallback) {
      this.startGoogleRedirectAuth();
      return new Promise(() => {}); // Page is redirecting
    }

    return new Promise((resolve, reject) => {
      const startAuth = () => {
        if (!window.google?.accounts?.oauth2) {
          if (canUseRedirectFallback) {
            this.startGoogleRedirectAuth();
            return;
          }
          reject(new Error('Could not load Google Sign-In. Please check your connection or disable ad-blockers.'));
          return;
        }

        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            prompt: 'select_account',
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
              if (err?.type === 'popup_failed_to_open') {
                if (canUseRedirectFallback) {
                  this.startGoogleRedirectAuth();
                  return;
                }
                reject(new Error('Google Sign-In popup was blocked by your browser. Please allow popups and try again.'));
                return;
              }
              if (err?.type === 'popup_closed') {
                reject(new Error('Google Sign-In window was closed before completing sign in.'));
                return;
              }
              reject(new Error(err?.message || 'Google Sign-In was cancelled or failed.'));
            }
          });

          client.requestAccessToken({ prompt: 'select_account' });
        } catch (err) {
          if (canUseRedirectFallback) {
            this.startGoogleRedirectAuth();
            return;
          }
          reject(err);
        }
      };

      if (window.google?.accounts?.oauth2) {
        startAuth();
      } else {
        this.preloadGoogleScript().then(() => startAuth());
      }
    });
  },

  /**
   * Save or retrieve local password bridge for accounts that use both Password & Google Sign-In
   */
  _saveGoogleBridge(email, password) {
    if (!email || !password) return;
    try {
      const cleanEmail = email.toLowerCase().trim();
      const map = JSON.parse(localStorage.getItem('ideate_auth_bridge_v1') || '{}');
      map[cleanEmail] = btoa(encodeURIComponent(password));
      localStorage.setItem('ideate_auth_bridge_v1', JSON.stringify(map));
    } catch (_) {}
  },

  _getGoogleBridge(email) {
    if (!email) return null;
    try {
      const cleanEmail = email.toLowerCase().trim();
      const map = JSON.parse(localStorage.getItem('ideate_auth_bridge_v1') || '{}');
      return map[cleanEmail] ? decodeURIComponent(atob(map[cleanEmail])) : null;
    } catch (_) {
      return null;
    }
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

      let displayName = profile?.display_name;
      let avatarUrl = (profile?.avatar_url && !profile.avatar_url.includes('dicebear.com'))
        ? profile.avatar_url
        : picture;
      const userRole = profile?.role || (email === 'tushrahul58@gmail.com' ? 'admin' : 'Member');

      // Prepare unique display name if new user
      if (!displayName) {
        let baseName = rawName.trim().replace(/\s+/g, '_');
        let isAvail = await this.isDisplayNameAvailable(baseName);
        displayName = isAvail ? baseName : `${baseName}_${Math.floor(100 + Math.random() * 900)}`;
      }

      // 2. Establish a real Supabase Auth session FIRST so auth.uid() is valid for RLS & Foreign Keys
      const primaryGooglePass = `Google#Auth#${googleUser.sub || 'Ideate2026'}!`;
      const fallbackGooglePass = `Google#Auth#Ideate2026!`;
      const bridgedPass = this._getGoogleBridge(email);

      const candidatePasswords = Array.from(
        new Set([
          primaryGooglePass,
          fallbackGooglePass,
          bridgedPass,
          email === 'tushrahul58@gmail.com' ? 'Admin@123' : null
        ].filter(Boolean))
      );

      let authUser = null;
      let authSession = null;

      // 2a. Try signing in with candidate passwords
      for (const candidatePass of candidatePasswords) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password: candidatePass
        });
        if (!signInErr && signInData?.user) {
          authUser = signInData.user;
          authSession = signInData.session;
          break;
        }
      }

      // 2b. If not signed in yet, attempt signUp for new Google user
      if (!authUser) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password: primaryGooglePass,
          options: {
            data: {
              display_name: displayName,
              avatar_url: avatarUrl,
              role: userRole
            }
          }
        });

        // Check if Supabase returned a real new user (identities.length > 0)
        const isExistingPasswordUser =
          signUpData?.user &&
          Array.isArray(signUpData.user.identities) &&
          signUpData.user.identities.length === 0;

        if (!signUpErr && signUpData?.user && !isExistingPasswordUser) {
          authUser = signUpData.user;
          authSession = signUpData.session;
          if (!authSession) {
            const { data: retrySignIn } = await supabase.auth.signInWithPassword({
              email,
              password: primaryGooglePass
            });
            if (retrySignIn?.user) {
              authUser = retrySignIn.user;
              authSession = retrySignIn.session;
            }
          }
        } else if (isExistingPasswordUser || signUpErr?.message?.toLowerCase().includes('already registered')) {
          // Account exists in auth.users with a different password.
          // Check if it is an empty/unused account (0 ideas, 0 posts, 0 memberships) that can be cleanly re-initialized
          let canResetEmptyAccount = false;
          if (profile?.id && email !== 'tushrahul58@gmail.com') {
            try {
              const { data: stats } = await supabase.rpc('get_admin_stats');
              const userStat = stats?.users?.find(u => u.id === profile.id || u.email?.toLowerCase() === email);
              if (userStat && Number(userStat.ideas_count || 0) === 0 && Number(userStat.posts_count || 0) === 0) {
                canResetEmptyAccount = true;
              }
            } catch (_) {}
          }

          if (canResetEmptyAccount && profile?.id) {
            try {
              await supabase.rpc('admin_delete_user', { target_user_id: profile.id });
              const { data: freshSignUp } = await supabase.auth.signUp({
                email,
                password: primaryGooglePass,
                options: {
                  data: {
                    display_name: displayName,
                    avatar_url: avatarUrl,
                    role: userRole
                  }
                }
              });
              if (freshSignUp?.user) {
                authUser = freshSignUp.user;
                authSession = freshSignUp.session;
                if (!authSession) {
                  const { data: freshSignIn } = await supabase.auth.signInWithPassword({
                    email,
                    password: primaryGooglePass
                  });
                  authUser = freshSignIn?.user || authUser;
                  authSession = freshSignIn?.session || null;
                }
              }
            } catch (resetErr) {
              console.warn('Empty Google account reset notice:', resetErr);
            }
          }

          if (!authUser) {
            const linkErr = new Error(
              `Your email (${email}) is already registered with a password. Please enter your password once below to link Google Sign-In.`
            );
            linkErr.code = 'GOOGLE_PASSWORD_LINK_REQUIRED';
            linkErr.email = email;
            linkErr.googleUser = googleUser;
            throw linkErr;
          }
        } else if (signUpErr) {
          throw new Error(signUpErr.message || 'Could not complete Google Sign-In.');
        }
      }

      const finalUserId = authUser?.id || profile?.id;
      if (!finalUserId) {
        throw new Error('Could not establish user session with Google.');
      }

      // 3. Now that Supabase session is active (auth.uid() === finalUserId), upsert profile in public.profiles
      try {
        await supabase.from('profiles').upsert({
          id: finalUserId,
          email,
          display_name: displayName,
          avatar_url: avatarUrl,
          role: userRole,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Google profile upsert notice:', err);
      }

      const resolved = {
        id: finalUserId,
        email,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: userRole
      };
      localStore.setCurrentUser(resolved);
      return (await this.getCurrentUser()) || resolved;
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
  },

  async signInWithOAuth(provider = 'google') {
    if (isSupabaseConfigured && supabase) {
      const origin = typeof window !== 'undefined' 
        ? window.location.origin 
        : 'https://ideate-black.vercel.app';
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      if (error) throw error;
      return { redirecting: true, ...data };
    }
    throw new Error('Supabase authentication is not configured.');
  },

  async signInWithGoogle() {
    return this.signInWithOAuth('google');
  }
};
