import React from 'react';

/**
 * Universal Loading Screen using public/loading.gif
 */
export default function LoadingScreen({ message = 'Loading...', fullScreen = true, size = 'default' }) {
  const imgSizes = {
    small: 'w-12 h-12',
    default: 'w-24 h-24 sm:w-28 sm:h-28',
    large: 'w-36 h-36'
  };

  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
      <div className="relative flex items-center justify-center">
        <img 
          src="/loading.gif" 
          alt="Loading animation" 
          className={`${imgSizes[size] || imgSizes.default} object-contain rounded-2xl drop-shadow-sm`}
        />
      </div>
      {message && (
        <p className="mt-4 text-xs sm:text-sm font-bold text-slate-700 tracking-wide uppercase">
          {message}
        </p>
      )}
    </div>
  );

  if (!fullScreen) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center">
      {content}
    </div>
  );
}
