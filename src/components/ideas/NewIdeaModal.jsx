import React, { useState, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Lightbulb, 
  Palette, 
  Image as ImageIcon, 
  Check, 
  Users, 
  MessageSquare,
  Search,
  Pipette
} from 'lucide-react';
import { COVERS_LIST, COVER_CATEGORIES } from '../../data/coverImages';
import { COVER_IMAGES } from '../../data/mockData';
import { THEME_PALETTES, getIdeaTheme } from '../../data/themePalettes';
import { useAuth } from '../../context/AuthContext';
import { ideaService } from '../../services/ideaService';
import { notificationService } from '../../services/notificationService';
import { getRandomAvatar } from '../../data/avatars';

// Helper to determine if a background hex color is dark
function isDarkColor(hexColor) {
  if (!hexColor || !hexColor.startsWith('#')) return false;
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.substr(0, 2), 16) || 0;
  const g = parseInt(hex.substr(2, 2), 16) || 0;
  const b = parseInt(hex.substr(4, 2), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 140;
}

export default function NewIdeaModal({ isOpen, onClose, onIdeaCreated }) {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCoverId, setSelectedCoverId] = useState('banner_autumn_landscape');
  const [selectedTheme, setSelectedTheme] = useState('blue');
  const [customColor, setCustomColor] = useState('#6366F1');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const customColorInputRef = useRef(null);

  if (!isOpen) return null;

  const activeTheme = getIdeaTheme(selectedTheme);
  const isCustomThemeActive = selectedTheme.startsWith('#') || selectedTheme === customColor;

  // Modal background is the selected custom color or preset light tint without any gradient effect
  const modalBgColor = isCustomThemeActive ? customColor : (activeTheme.lightHex || '#ffffff');
  const isDark = isDarkColor(modalBgColor);

  const filteredCovers = COVERS_LIST.filter(c => {
    const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
    const matchesSearch = !searchFilter.trim() || 
      c.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.category.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedCoverObj = COVERS_LIST.find(c => c.id === selectedCoverId) || COVERS_LIST[0];
  const activeCoverUrl = selectedCoverObj?.image || COVER_IMAGES.resume;

  const handleCustomColorChange = (newHex) => {
    setCustomColor(newHex);
    setSelectedTheme(newHex);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const created = await ideaService.createIdea({
        title: title.trim(),
        description: description.trim(),
        cover_url: activeCoverUrl,
        color_theme: selectedTheme
      }, currentUser);

      // Trigger notification and sound
      notificationService.addNotification({
        title: `Idea Created: "${created.title}" 💡`,
        message: 'Your idea space is ready. Invite collaborators or start a discussion.',
        type: 'idea',
        ideaId: created.id,
        playSound: true
      });

      onIdeaCreated(created);
      onClose();
      setTitle('');
      setDescription('');
      setSelectedTheme('blue');
      setSelectedCoverId('banner_autumn_landscape');
    } catch (err) {
      alert('Failed to create idea: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-5xl lg:max-w-6xl rounded-3xl p-5 sm:p-7 shadow-2xl border transition-colors duration-200 my-auto max-h-[94vh] flex flex-col overflow-hidden"
        style={{
          backgroundColor: modalBgColor,
          borderColor: isDark ? 'rgba(255,255,255,0.2)' : (activeTheme.borderHex || `${activeTheme.hex}40`)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className={`flex items-center justify-between pb-3.5 border-b flex-shrink-0 ${isDark ? 'border-white/15' : 'border-slate-200/80'}`}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-xs transition-colors flex-shrink-0"
              style={{ backgroundColor: activeTheme.hex }}
            >
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  New Idea Space
                </h3>
                <span 
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${
                    isDark ? 'bg-white/20 text-white border-white/30' : 'bg-white/90 text-slate-800 border-slate-200'
                  }`}
                >
                  {activeTheme.name}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
                Customize your space title, color palette, and high-res cover art
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
              isDark 
                ? 'border-white/20 text-white/80 hover:text-white hover:bg-white/15' 
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Wide Form Layout - Left Column Does NOT Scroll, Right Column ONLY Scrolls */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 py-3 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-stretch flex-1 min-h-0 overflow-hidden">
            
            {/* Left Column (5 cols): Unscrollable Inputs, Theme Palette, and Live Preview */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3 overflow-hidden flex-shrink-0">
              
              {/* Title input */}
              <div>
                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white/90' : 'text-slate-700'}`}>
                  Idea Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AI Product Designer, Autonomous Agent..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-500/15 focus:border-blue-500 transition shadow-2xs"
                  autoFocus
                />
              </div>

              {/* Description textarea */}
              <div>
                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white/90' : 'text-slate-700'}`}>
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What core challenge or opportunity does this address?"
                  className="w-full px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-500/15 focus:border-blue-500 transition resize-none shadow-2xs"
                />
              </div>

              {/* Theme Palette (10 Presets + Custom Color) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/90' : 'text-slate-700'}`}>
                    <Palette className="w-3.5 h-3.5 text-current opacity-70" />
                    <span>Color Palette & Custom Theme</span>
                  </label>
                  <span 
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white shadow-2xs"
                    style={{ color: activeTheme.hex }}
                  >
                    {activeTheme.name}
                  </span>
                </div>

                {/* Color Swatches Grid (10 Presets + 1 Custom Picker) */}
                <div className="grid grid-cols-6 gap-1.5 w-full">
                  {THEME_PALETTES.map((t) => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTheme(t.id)}
                        className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all text-center bg-white ${
                          isSelected
                            ? 'border-2 border-slate-900 ring-2 ring-slate-900/10 shadow-xs'
                            : 'border border-slate-200 hover:border-slate-300'
                        }`}
                        title={t.name}
                      >
                        <span 
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white shadow-2xs flex-shrink-0"
                          style={{ backgroundColor: t.hex }}
                        >
                          {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                        </span>
                        <span className="text-[9px] font-bold text-slate-700 truncate w-full mt-0.5">
                          {t.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}

                  {/* 11th Swatch: Custom Color Picker Option */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => customColorInputRef.current?.click()}
                      className={`w-full flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all text-center bg-white ${
                        isCustomThemeActive
                          ? 'border-2 border-slate-900 ring-2 ring-slate-900/10 shadow-xs'
                          : 'border border-slate-200 hover:border-slate-300'
                      }`}
                      title="Choose Custom Color"
                    >
                      <span 
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white shadow-2xs relative overflow-hidden flex-shrink-0"
                        style={{ 
                          background: isCustomThemeActive 
                            ? customColor 
                            : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' 
                        }}
                      >
                        {isCustomThemeActive ? (
                          <Check className="w-2 h-2 stroke-[3] drop-shadow-xs" />
                        ) : (
                          <Pipette className="w-2 h-2 text-white drop-shadow-xs" />
                        )}
                      </span>
                      <span className="text-[9px] font-bold text-slate-700 truncate w-full mt-0.5">
                        {isCustomThemeActive ? customColor : 'Custom'}
                      </span>
                    </button>

                    {/* Hidden Native Color Input */}
                    <input
                      ref={customColorInputRef}
                      type="color"
                      value={customColor}
                      onChange={(e) => handleCustomColorChange(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
                    Idea Space Preview
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-white/70' : 'text-slate-400'}`}>Dashboard appearance</span>
                </div>

                <div 
                  className="relative rounded-2xl overflow-hidden p-3.5 min-h-[145px] sm:min-h-[155px] flex flex-col justify-between shadow-md border transition-all duration-300"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.3)' : (activeTheme.borderHex || `${activeTheme.hex}40`)
                  }}
                >
                  {/* Blurred background cover image */}
                  <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-900 pointer-events-none">
                    <img 
                      src={activeCoverUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover blur-[2px] scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/40" />
                    <div 
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: activeTheme.hex }}
                    />
                  </div>

                  {/* Top Badge on Preview */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span 
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-black/40 backdrop-blur-md flex items-center gap-1.5 border border-white/20 text-white"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeTheme.hex }}></span>
                      <span>{activeTheme.name.split(' ')[0]}</span>
                    </span>

                    <div className="flex items-center gap-1 text-[10px] text-white/80 bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/10">
                      <img 
                        src={currentUser?.avatar_url || getRandomAvatar(currentUser?.email || 'User')} 
                        alt="Owner"
                        className="w-3 h-3 rounded-full object-cover" 
                      />
                      <span>{currentUser?.display_name || 'You'}</span>
                    </div>
                  </div>

                  {/* Text on Image */}
                  <div className="relative z-10 mt-auto pt-2">
                    <h4 className="text-sm font-extrabold text-white truncate drop-shadow-sm">
                      {title.trim() || 'Untitled Idea Space'}
                    </h4>
                    <p className="text-[11px] text-white/80 line-clamp-1 mt-0.5 drop-shadow-xs">
                      {description.trim() || 'Private collaborative discussion space for your breakthrough.'}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/15 text-[10px] text-white/70">
                      <span>1 member • 0 posts</span>
                      <span>Live preview</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (7 cols): Covers Library Grid with Full Height Banners, ONLY THIS SCROLLS */}
            <div className={`lg:col-span-7 flex flex-col min-h-0 lg:border-l lg:pl-6 pt-2 lg:pt-0 overflow-hidden ${isDark ? 'lg:border-white/15' : 'lg:border-slate-200/80'}`}>
              
              {/* Header & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 flex-shrink-0">
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-700'}`}>
                    <ImageIcon className="w-3.5 h-3.5 text-current opacity-70" />
                    <span>Choose Cover Art ({COVERS_LIST.length} Styles)</span>
                  </label>
                  <p className={`text-[11px] ${isDark ? 'text-white/70' : 'text-slate-500'}`}>
                    Full height banners • Scroll below for all styles
                  </p>
                </div>

                {/* Search Cover input */}
                <div className="relative w-full sm:w-44">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search covers..."
                    className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-900 shadow-2xs"
                  />
                </div>
              </div>

              {/* Category Filter Pills (Non-scrolling header) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 flex-shrink-0 scrollbar-none">
                {COVER_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition shadow-2xs ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white shadow-xs'
                        : isDark
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* ONLY THIS COVERS CONTAINER SCROLLS: Explicit full height (h-28 sm:h-32) so banners never collapse */}
              <div className="flex-1 min-h-[340px] max-h-[460px] overflow-y-auto pr-1.5 scrollbar-none">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredCovers.map((c) => {
                    const isSelected = selectedCoverId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCoverId(c.id)}
                        className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer text-left transition-all ${
                          isSelected
                            ? 'border-slate-900 ring-2 ring-slate-900/20 shadow-md scale-[1.02]'
                            : isDark
                              ? 'border-white/25 hover:border-white/50'
                              : 'border-slate-200/90 hover:border-slate-400 hover:shadow-xs'
                        }`}
                      >
                        {/* Rock-solid explicit height: 112px on sm/desktop, 96px on mobile */}
                        <div className="h-24 sm:h-28 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
                          <img 
                            src={c.image} 
                            alt={c.label} 
                            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300" 
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-85 group-hover:opacity-65 transition-opacity" />
                          
                          {/* Selected Check Badge */}
                          {isSelected && (
                            <div 
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-xs animate-scale-in"
                              style={{ backgroundColor: activeTheme.hex }}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}

                          {/* Category Tag */}
                          <span className="absolute top-1.5 left-1.5 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white">
                            {c.category}
                          </span>

                          {/* Title on cover */}
                          <div className="absolute bottom-1 left-1.5 right-1.5">
                            <p className="text-[10.5px] font-bold text-white truncate drop-shadow-xs">
                              {c.label}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </form>

        {/* Modal Bottom Actions */}
        <div className={`flex items-center justify-between pt-3 border-t flex-shrink-0 ${isDark ? 'border-white/15' : 'border-slate-200/80'}`}>
          <div className={`text-xs hidden sm:flex items-center gap-2 ${isDark ? 'text-white/80' : 'text-slate-600'}`}>
            <span>Cover: <strong>{selectedCoverObj?.label}</strong></span>
            <span>•</span>
            <span>Theme: <strong>{activeTheme.name}</strong></span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-2xs ${
                isDark 
                  ? 'bg-white/20 text-white hover:bg-white/30' 
                  : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !title.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              style={{ backgroundColor: activeTheme.hex }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Idea Space</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
