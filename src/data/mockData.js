// Initial seed data replicating the attached Ideate UI design exactly

export const USERS = [
  {
    id: 'user-rahul',
    email: 'rahul@gmail.com',
    display_name: 'Rahul',
    avatar_url: '/avatars/smart-dev.jpg',
    role: 'Owner'
  },
  {
    id: 'user-arun',
    email: 'arun@gmail.com',
    display_name: 'Arun',
    avatar_url: '/avatars/boy-avatar.avif',
    role: 'Member'
  },
  {
    id: 'user-kiran',
    email: 'kiran@gmail.com',
    display_name: 'Kiran',
    avatar_url: '/avatars/astronaut-dev.avif',
    role: 'Member'
  },
  {
    id: 'user-priya',
    email: 'priya@gmail.com',
    display_name: 'Priya',
    avatar_url: '/avatars/girl-dev.jpg',
    role: 'Member'
  }
];

import { COVERS_MAP } from './coverImages';

// High-resolution graphics for cards with legacy fallbacks
export const COVER_IMAGES = {
  resume: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
  voice: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=80',
  pharma: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
  travel: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80',
  college: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
  startup: 'https://images.unsplash.com/photo-1517976487588-4682337d6e64?w=800&auto=format&fit=crop&q=80',
  ai_brain: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
  cyber_code: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
  crypto_fintech: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=80',
  design_studio: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80',
  green_eco: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',
  gaming_space: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800&auto=format&fit=crop&q=80',
  ...COVERS_MAP
};

// Architecture diagram SVG for Post 3
export const ARCHITECTURE_DIAGRAM_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 220" fill="none"><rect width="600" height="220" rx="12" fill="%23F8FAFC" stroke="%23E2E8F0"/><text x="24" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="%23334155">System Architecture</text><rect x="30" y="75" width="90" height="50" rx="8" fill="%23DBEAFE" stroke="%2393C5FD"/><text x="75" y="105" font-family="sans-serif" font-size="13" font-weight="500" fill="%231E40AF" text-anchor="middle">User</text><path d="M120 100h45" stroke="%2394A3B8" stroke-width="2" marker-end="url(%23arrow)"/><rect x="175" y="70" width="115" height="60" rx="8" fill="%23E0E7FF" stroke="%23A5B4FC"/><text x="232" y="98" font-family="sans-serif" font-size="13" font-weight="600" fill="%233730A3" text-anchor="middle">Frontend</text><text x="232" y="116" font-family="sans-serif" font-size="11" fill="%234F46E5" text-anchor="middle">(React)</text><path d="M290 100h45" stroke="%2394A3B8" stroke-width="2"/><rect x="345" y="70" width="115" height="60" rx="8" fill="%23DCFCE7" stroke="%2386EFAC"/><text x="402" y="98" font-family="sans-serif" font-size="13" font-weight="600" fill="%23166534" text-anchor="middle">Backend</text><text x="402" y="116" font-family="sans-serif" font-size="11" fill="%2315803D" text-anchor="middle">(Supabase)</text><path d="M460 85h45M460 115h45" stroke="%2394A3B8" stroke-width="2"/><rect x="515" y="65" width="70" height="32" rx="6" fill="%23E0F2FE" stroke="%237DD3FC"/><text x="550" y="86" font-family="sans-serif" font-size="11" font-weight="500" fill="%230369A1" text-anchor="middle">Database</text><rect x="515" y="105" width="70" height="32" rx="6" fill="%23FEF3C7" stroke="%23FCD34D"/><text x="550" y="126" font-family="sans-serif" font-size="11" font-weight="500" fill="%23B45309" text-anchor="middle">Storage</text></svg>`;

export const INITIAL_IDEAS = [];
export const INITIAL_MEMBERS = {};
export const INITIAL_POSTS = {};

