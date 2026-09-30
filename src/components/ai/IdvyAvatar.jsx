import React from 'react';

export default function IdvyAvatar({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8 sm:w-9 sm:h-9',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12'
  };

  return (
    <div className={`relative flex-shrink-0 rounded-full overflow-hidden ring-2 ring-purple-400/80 shadow-xs shadow-purple-500/20 bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-500 p-0.5 ${sizeClasses[size] || sizeClasses.md} ${className}`}>
      <img
        src="/avatars/idvy-avatar.avif"
        alt="Idvy AI Collaborator"
        className="w-full h-full object-cover rounded-full"
      />
    </div>
  );
}
