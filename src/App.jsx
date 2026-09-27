import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import MobileNav from './components/common/MobileNav';
import Dashboard from './pages/Dashboard';
import DiscussionView from './pages/DiscussionView';
import NewIdeaModal from './components/ideas/NewIdeaModal';
import AuthModal from './components/auth/AuthModal';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import EditIdeaModal from './components/ideas/EditIdeaModal';
import DeleteIdeaModal from './components/ideas/DeleteIdeaModal';
import AdminDashboard from './pages/AdminDashboard';
import { ideaService } from './services/ideaService';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { notificationService } from './services/notificationService';

import LoadingScreen from './components/common/LoadingScreen';

export default function App() {
  const { currentUser, loading } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [activeIdea, setActiveIdea] = useState(null);
  const [isNewIdeaOpen, setIsNewIdeaOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState('home');
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'

  const [editingIdea, setEditingIdea] = useState(null);
  const [deletingIdea, setDeletingIdea] = useState(null);

  const loadIdeas = async () => {
    try {
      const data = await ideaService.getIdeas('all', currentUser?.id);
      setIdeas(data);
    } catch (err) {
      console.error('Failed to load ideas', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadIdeas();
      notificationService.initRealtimeSubscription(currentUser.id);

      // Realtime subscription for instant multi-user updates (new ideas, added members)
      const channel = supabase
        .channel('realtime_ideas_and_members')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ideas' },
          () => {
            loadIdeas();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'idea_members' },
          () => {
            loadIdeas();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser?.id]);

  const handleSelectIdea = (idea) => {
    setActiveIdea(idea);
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsAdminOpen(false);
    if (currentUser?.id && idea?.id) {
      notificationService.markIdeaAsRead(currentUser.id, idea.id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAllIdeas = () => {
    setActiveIdea(null);
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsAdminOpen(false);
    setSearchQuery('');
  };

  const handleIdeaCreated = (newIdea) => {
    setIdeas(prev => [newIdea, ...prev]);
    setActiveIdea(newIdea);
    setIsNotificationsOpen(false);
    setIsProfileOpen(false);
  };

  const handleOpenEditIdea = (idea) => {
    setEditingIdea(idea);
  };

  const handleIdeaUpdated = (updated) => {
    setIdeas(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
    if (activeIdea?.id === updated.id) {
      setActiveIdea(prev => ({ ...prev, ...updated }));
    }
  };

  const handleOpenDeleteIdea = (idea) => {
    setDeletingIdea(idea);
  };

  const handleConfirmDeleteIdea = async (ideaId) => {
    try {
      await ideaService.deleteIdea(ideaId);
      setIdeas(prev => prev.filter(i => i.id !== ideaId));
      if (activeIdea?.id === ideaId) {
        setActiveIdea(null);
      }
    } catch (err) {
      alert('Failed to delete idea: ' + err.message);
    }
  };

  const handleUpdateIdeaStats = async (ideaId) => {
    loadIdeas();
    if (activeIdea?.id === ideaId) {
      const refreshed = await ideaService.getIdeaById(ideaId, currentUser?.id);
      if (refreshed) setActiveIdea(refreshed);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading Ideate..." />;
  }

  // Unauthenticated view: Sliding Glass Auth (Sign In & Sign Up)
  if (!currentUser) {
    return (
      <Auth
        initialMode={authView}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-row">
      {/* Sidebar (Desktop persistent + Mobile Drawer) */}
      <Sidebar
        ideas={ideas}
        activeIdeaId={activeIdea?.id}
        onSelectIdea={handleSelectIdea}
        onSelectAllIdeas={handleSelectAllIdeas}
        onOpenNewIdea={() => setIsNewIdeaOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenProfile={() => {
          setIsProfileOpen(true);
          setIsNotificationsOpen(false);
          setIsAdminOpen(false);
          setActiveIdea(null);
        }}
        onOpenNotifications={() => {
          setIsNotificationsOpen(true);
          setIsProfileOpen(false);
          setIsAdminOpen(false);
          setActiveIdea(null);
          setMobileTab('notifications');
        }}
        onOpenAdmin={() => {
          setIsAdminOpen(true);
          setIsProfileOpen(false);
          setIsNotificationsOpen(false);
          setActiveIdea(null);
        }}
        isAdminOpen={isAdminOpen}
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${activeIdea ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'pb-20 lg:pb-0'}`}>
        {/* Top Header */}
        <Header
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectAllIdeas={handleSelectAllIdeas}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenProfile={() => {
            setIsProfileOpen(true);
            setIsNotificationsOpen(false);
            setIsAdminOpen(false);
            setActiveIdea(null);
          }}
          onOpenNotifications={() => {
            setIsNotificationsOpen(true);
            setIsProfileOpen(false);
            setIsAdminOpen(false);
            setActiveIdea(null);
            setMobileTab('notifications');
          }}
          onOpenAdmin={() => {
            setIsAdminOpen(true);
            setIsProfileOpen(false);
            setIsNotificationsOpen(false);
            setActiveIdea(null);
          }}
        />

        {/* Dynamic Page Rendering */}
        <main className={`flex-1 flex flex-col ${activeIdea ? 'min-h-0 overflow-hidden' : ''}`}>
          {isAdminOpen ? (
            <AdminDashboard 
              onBack={() => setIsAdminOpen(false)} 
              onSelectIdea={(idea) => {
                setIsAdminOpen(false);
                handleSelectIdea(idea);
              }}
            />
          ) : isProfileOpen ? (
            <Profile onBack={() => setIsProfileOpen(false)} />
          ) : isNotificationsOpen ? (
            <Notifications 
              onBack={() => setIsNotificationsOpen(false)} 
              onSelectIdea={(idea) => {
                setIsNotificationsOpen(false);
                handleSelectIdea(idea);
              }}
            />
          ) : activeIdea ? (
            <DiscussionView
              idea={activeIdea}
              onBack={() => setActiveIdea(null)}
              onUpdateIdeaStats={handleUpdateIdeaStats}
              onEditIdea={handleOpenEditIdea}
              onDeleteIdea={handleOpenDeleteIdea}
            />
          ) : (
            <Dashboard
              ideas={ideas}
              onSelectIdea={handleSelectIdea}
              onOpenNewIdea={() => setIsNewIdeaOpen(true)}
              onDeleteIdea={handleOpenDeleteIdea}
              onEditIdea={handleOpenEditIdea}
              searchQuery={searchQuery}
            />
          )}
        </main>

        {/* Mobile Navigation */}
        {!activeIdea && (
          <MobileNav
            activeTab={mobileTab}
          onTabChange={(tab) => {
            setMobileTab(tab);
            if (tab === 'home') handleSelectAllIdeas();
            if (tab === 'notifications') {
              setIsNotificationsOpen(true);
              setIsProfileOpen(false);
              setIsAdminOpen(false);
              setActiveIdea(null);
            }
            if (tab === 'profile') {
              setIsProfileOpen(true);
              setIsNotificationsOpen(false);
              setIsAdminOpen(false);
              setActiveIdea(null);
            }
            if (tab === 'search') {
              setIsNotificationsOpen(false);
              setIsProfileOpen(false);
              setIsAdminOpen(false);
              const input = document.querySelector('input[placeholder="Search ideas..."]');
              input?.focus();
            }
          }}
          onOpenNewIdea={() => setIsNewIdeaOpen(true)}
        />
        )}

        {/* New Idea Modal */}
        <NewIdeaModal
          isOpen={isNewIdeaOpen}
          onClose={() => setIsNewIdeaOpen(false)}
          onIdeaCreated={handleIdeaCreated}
        />

        {/* Edit Idea Modal */}
        <EditIdeaModal
          isOpen={!!editingIdea}
          onClose={() => setEditingIdea(null)}
          idea={editingIdea}
          onIdeaUpdated={handleIdeaUpdated}
        />

        {/* Delete Idea Modal with "Think Again" & Math Puzzle */}
        <DeleteIdeaModal
          isOpen={!!deletingIdea}
          onClose={() => setDeletingIdea(null)}
          idea={deletingIdea}
          onConfirmDelete={handleConfirmDeleteIdea}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </div>
    </div>
  );
}
