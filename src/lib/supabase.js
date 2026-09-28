import { createClient } from '@supabase/supabase-js';
import { USERS, INITIAL_IDEAS, INITIAL_MEMBERS, INITIAL_POSTS } from '../data/mockData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== ''
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================================
// Robust Offline Local Storage & Cache for complete resilience
// ============================================================================
const STORAGE_KEY_IDEAS = 'ideate_ideas_v1';
const STORAGE_KEY_POSTS = 'ideate_posts_v1';
const STORAGE_KEY_MEMBERS = 'ideate_members_v1';
const STORAGE_KEY_CURRENT_USER = 'ideate_current_user_v1';
const STORAGE_KEY_USERS = 'ideate_users_v1';

class LocalStore {
  constructor() {
    this.init();
  }

  init() {
    // Unconditionally purge legacy demo and rahul session keys
    try {
      localStorage.removeItem('ideaflow_current_user_v1');
      localStorage.removeItem('ideaflow_users_v1');
      const rawCur = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (rawCur) {
        const u = JSON.parse(rawCur);
        if (!u || u.email === 'rahul@gmail.com' || u.id === 'user-rahul' || u.display_name === 'Rahul') {
          localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }

    // Seamlessly migrate legacy ideaflow content data if present (excluding session)
    ['users', 'ideas', 'members', 'posts'].forEach(k => {
      const oldVal = localStorage.getItem(`ideaflow_${k}_v1`);
      if (oldVal && !localStorage.getItem(`ideate_${k}_v1`)) {
        localStorage.setItem(`ideate_${k}_v1`, oldVal);
      }
    });

    if (!localStorage.getItem(STORAGE_KEY_USERS)) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([]));
    }
    // Clean out template ideas (e.g. idea-1 to idea-7) if present in storage
    const storedIdeas = JSON.parse(localStorage.getItem(STORAGE_KEY_IDEAS) || 'null');
    if (!storedIdeas) {
      localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify([]));
    } else {
      const templateIds = ['idea-1', 'idea-2', 'idea-3', 'idea-4', 'idea-5', 'idea-6', 'idea-7'];
      const nonTemplates = storedIdeas.filter(i => !templateIds.includes(i.id));
      localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(nonTemplates));
    }

    if (!localStorage.getItem(STORAGE_KEY_MEMBERS)) {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(INITIAL_MEMBERS));
    }
    if (!localStorage.getItem(STORAGE_KEY_POSTS)) {
      localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(INITIAL_POSTS));
    }
  }

  getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
  }

  getCurrentUser() {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!raw) return null;
    try {
      const user = JSON.parse(raw);
      if (!user || user.email === 'rahul@gmail.com' || user.id === 'user-rahul') {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } else {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    }
  }

  getIdeas() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_IDEAS) || '[]');
  }

  setIdeas(ideas) {
    localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(ideas));
  }

  getMembers(ideaId) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_MEMBERS) || '{}');
    return all[ideaId] || [];
  }

  setMembers(ideaId, members) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_MEMBERS) || '{}');
    all[ideaId] = members;
    localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(all));
  }

  getPosts(ideaId) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_POSTS) || '{}');
    return all[ideaId] || [];
  }

  setPosts(ideaId, posts) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY_POSTS) || '{}');
    all[ideaId] = posts;
    localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(all));
  }
}

export const localStore = new LocalStore();
