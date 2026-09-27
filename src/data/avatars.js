export const AVAILABLE_AVATARS = [
  { id: 'cat-hacker', name: 'Cat Hacker', src: '/avatars/cat-hacker.avif', category: 'Creative' },
  { id: 'dog-avatar', name: 'Dog Dev', src: '/avatars/dog-avatar.avif', category: 'Creative' },
  { id: 'shiba-avatar', name: 'Shiba Dev', src: '/avatars/shiba-avatar.avif', category: 'Creative' },
  { id: 'panda-hhacker', name: 'Panda Hacker', src: '/avatars/panda-hhacker.avif', category: 'Creative' },
  { id: 'fox-dev', name: 'Fox Dev', src: '/avatars/fox-dev.avif', category: 'Creative' },
  { id: 'fox-lovely-dev', name: 'Lovely Fox', src: '/avatars/fox-lovely-dev.avif', category: 'Creative' },
  { id: 'ninja-dev', name: 'Ninja Dev', src: '/avatars/ninja-dev.avif', category: 'Pro' },
  { id: 'astronaut-dev', name: 'Astronaut', src: '/avatars/astronaut-dev.avif', category: 'Pro' },
  { id: 'lovely-astronaut-dev', name: 'Space Explorer', src: '/avatars/lovely-astronaut-dev.avif', category: 'Pro' },
  { id: 'hacker-avatar', name: 'Hacker Pro', src: '/avatars/hacker-avatar.jpg', category: 'Pro' },
  { id: 'smart-dev', name: 'Tech Lead', src: '/avatars/smart-dev.jpg', category: 'Pro' },
  { id: 'excited-dev', name: 'Excited Dev', src: '/avatars/excited-dev.avif', category: 'Avatar' },
  { id: 'smart-boy-dev', name: 'Smart Dev', src: '/avatars/smart-boy-dev.avif', category: 'Avatar' },
  { id: 'cutie-boy-dev', name: 'Cutie Dev', src: '/avatars/cutie-boy-dev.avif', category: 'Avatar' },
  { id: 'cute-unc-dev', name: 'Mentor Dev', src: '/avatars/cute-unc-dev.avif', category: 'Avatar' },
  { id: 'boy-avatar', name: 'Boy Dev', src: '/avatars/boy-avatar.avif', category: 'Avatar' },
  { id: 'boy-teen', name: 'Teen Dev', src: '/avatars/boy-teen.avif', category: 'Avatar' },
  { id: 'nice-boy', name: 'Nice Boy', src: '/avatars/nice-boy.avif', category: 'Avatar' },
  { id: 'man-avatar', name: 'Man Dev', src: '/avatars/man-avatar.avif', category: 'Avatar' },
  { id: 'anime-girl', name: 'Anime Creator', src: '/avatars/anime-girl.avif', category: 'Avatar' },
  { id: 'girl-dev', name: 'Girl Dev', src: '/avatars/girl-dev.jpg', category: 'Avatar' },
  { id: 'boy-dev', name: 'Creator', src: '/avatars/boy-dev.jpg', category: 'Avatar' },
  { id: '3d-unc', name: '3D Guy', src: '/avatars/3d-unc.jpg', category: 'Avatar' },
  { id: 'atronaut-dev', name: 'Astronaut Classic', src: '/avatars/atronaut-dev.jpg', category: 'Pro' },
  { id: 'norm-man', name: 'Explorer', src: '/avatars/norm-man.jpg', category: 'Avatar' },
  { id: 'norm-man-1', name: 'Innovator', src: '/avatars/norm-man-1.jpg', category: 'Avatar' },
];

export function getRandomAvatar(seed = '') {
  if (!seed || typeof seed !== 'string') {
    const randomIndex = Math.floor(Math.random() * AVAILABLE_AVATARS.length);
    return AVAILABLE_AVATARS[randomIndex].src;
  }
  if (seed.toLowerCase().includes('admin') || seed.toLowerCase().includes('tushrahul58@gmail.com')) {
    return '/avatars/norm-man-1.jpg';
  }

  // Deterministic avatar index based on user seed (email or name)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVAILABLE_AVATARS.length;
  return AVAILABLE_AVATARS[index].src;
}
