import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Users, 
  HardDrive, 
  Database, 
  MessageSquare, 
  Lightbulb, 
  RefreshCw, 
  Shield, 
  Search, 
  Image as ImageIcon, 
  Mic, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Layers,
  Trash2,
  ExternalLink,
  Edit2,
  X,
  Filter,
  Eye,
  Lock
} from 'lucide-react';
import { adminService } from '../services/adminService';
import { getRandomAvatar } from '../data/avatars';
import { getIdeaTheme } from '../data/themePalettes';
import LoadingScreen from '../components/common/LoadingScreen';

export default function AdminDashboard({ onBack, onSelectIdea }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'storage' | 'tables' | 'ideas'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete User Modal state
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Data Tables tab state
  const [selectedTable, setSelectedTable] = useState('profiles');
  const [tableRows, setTableRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);

  // Status message banner
  const [statusMessage, setStatusMessage] = useState(null);

  const loadStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await adminService.getAdminStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // When tables tab is active or selected table changes, fetch raw rows
  useEffect(() => {
    if (activeTab === 'tables') {
      loadTableRows(selectedTable);
    }
  }, [activeTab, selectedTable]);

  const loadTableRows = async (tableName) => {
    setTableLoading(true);
    try {
      const rows = await adminService.getTableRows(tableName, 60);
      setTableRows(rows || []);
    } catch (err) {
      console.error(`Failed to load ${tableName} rows:`, err);
    } finally {
      setTableLoading(false);
    }
  };

  const showNotification = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Handle Delete User
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await adminService.deleteUser(userToDelete.id);
      showNotification(`User "${userToDelete.display_name || userToDelete.email}" deleted successfully.`);
      setUserToDelete(null);
      await loadStats();
      if (activeTab === 'tables' && selectedTable === 'profiles') {
        loadTableRows('profiles');
      }
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Handle Delete Row from Data Tables
  const handleConfirmDeleteRow = async () => {
    if (!rowToDelete) return;
    try {
      await adminService.deleteTableRow(selectedTable, rowToDelete.id);
      showNotification(`Record deleted from "${selectedTable}".`);
      setRowToDelete(null);
      loadTableRows(selectedTable);
      loadStats();
    } catch (err) {
      alert('Failed to delete record: ' + err.message);
    }
  };

  // Handle Edit Row from Data Tables
  const handleOpenEditRow = (row) => {
    setEditingRow(row);
    // clone values excluding id & created_at
    const { id, created_at, ...editable } = row;
    setEditFormData(editable);
  };

  const handleSaveEditRow = async (e) => {
    e?.preventDefault();
    if (!editingRow) return;
    setIsSavingRow(true);
    try {
      await adminService.updateTableRow(selectedTable, editingRow.id, editFormData);
      showNotification(`Record in "${selectedTable}" updated successfully.`);
      setEditingRow(null);
      loadTableRows(selectedTable);
      loadStats();
    } catch (err) {
      alert('Failed to update record: ' + err.message);
    } finally {
      setIsSavingRow(false);
    }
  };

  // Filtered Users
  const filteredUsers = (stats?.users || []).filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q);
  });

  // Filtered Ideas
  const filteredIdeas = (stats?.ideas || []).filter(idea => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = idea.title?.toLowerCase().includes(q);
    const matchesDesc = idea.description?.toLowerCase().includes(q);
    const matchesOwner = idea.owner_name?.toLowerCase().includes(q) || idea.owner_email?.toLowerCase().includes(q);
    return matchesTitle || matchesDesc || matchesOwner;
  });

  // Filtered Table Rows
  const filteredTableRows = (tableRows || []).filter(row => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return Object.values(row).some(val => 
      String(val || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-16 overflow-y-auto">
      {/* Top Admin Header Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
              title="Return to Ideas"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Back to App</span>
            </button>
            <div className="h-4 w-px bg-slate-200 flex-shrink-0"></div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold flex-shrink-0 shadow-2xs">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="truncate">Admin Console</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex-shrink-0">
                    Live Control
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => loadStats(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-700 transition"
              title="Refresh database metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none border-t border-slate-100 pt-2 pb-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'users'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users ({stats?.users_count || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'storage'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage Monitor</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'tables'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Data Tables (View & Edit)</span>
          </button>

          <button
            onClick={() => setActiveTab('ideas')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === 'ideas'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>All Ideas by Users ({stats?.ideas_count || 0})</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-4 animate-slide-down">
          <div className={`p-3.5 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-sm ${
            statusMessage.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {loading ? (
          <LoadingScreen message="Gathering system data & storage metrics..." fullScreen={false} size="default" />
        ) : (
          <>
            {/* TAB 1: USERS */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-fade-in">
                {/* Metric Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Registered Users</div>
                    <div className="text-3xl font-extrabold text-slate-900">{stats?.users_count || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">Confirmed database accounts</div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Creators</div>
                    <div className="text-3xl font-extrabold text-blue-600">
                      {(stats?.users || []).filter(u => u.ideas_count > 0).length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Have created at least 1 idea space</div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Admin Accounts</div>
                    <div className="text-3xl font-extrabold text-purple-600">
                      {(stats?.users || []).filter(u => u.role === 'admin' || u.email === 'tushrahul58@gmail.com').length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Protected administrator credentials</div>
                  </div>
                </div>

                {/* Users Directory */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        <span>User Management Directory</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {filteredUsers.length} accounts
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage registered accounts, view engagement metrics, and delete users when necessary.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-3">User</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Ideas Created</th>
                          <th className="px-4 py-3">Posts Created</th>
                          <th className="px-4 py-3">Joined Date</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-5 py-10 text-center text-slate-400 italic">
                              No users found matching "{searchQuery}"
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => {
                            const isPrimaryAdmin = user.email === 'tushrahul58@gmail.com' || user.id === '79b19372-636a-493f-882c-81d6664de58e';
                            const isAdminRole = user.role === 'admin' || isPrimaryAdmin;

                            return (
                              <tr key={user.id} className="hover:bg-slate-50/80 transition-all duration-150 group">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3.5">
                                    <div className="relative flex-shrink-0">
                                      <img
                                        src={user.avatar_url || getRandomAvatar(user.email || user.display_name)}
                                        alt={user.display_name || 'User'}
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = getRandomAvatar(user.email || user.display_name);
                                        }}
                                        className="w-11 h-11 rounded-full object-cover ring-2 ring-purple-200/80 shadow-sm transition-transform duration-200 group-hover:scale-105 bg-slate-100"
                                      />
                                      {isAdminRole && (
                                        <span 
                                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center ring-2 ring-white shadow-2xs"
                                          title="Administrator"
                                        >
                                          <Shield className="w-2.5 h-2.5" />
                                        </span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-slate-900 truncate flex items-center gap-1.5 text-sm">
                                        <span>{user.display_name || 'Anonymous User'}</span>
                                        {isPrimaryAdmin && (
                                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 border border-purple-200/80 tracking-wide uppercase">
                                            Owner
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                        {user.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  {isAdminRole ? (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200/80 inline-flex items-center gap-1 shadow-2xs">
                                      <Shield className="w-3 h-3 text-purple-600" />
                                      <span>Admin</span>
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                      <Users className="w-3 h-3 text-slate-500" />
                                      <span>Member</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-slate-700 font-semibold">
                                  {user.ideas_count || 0}
                                </td>
                                <td className="px-4 py-3.5 text-slate-700 font-semibold">
                                  {user.posts_count || 0}
                                </td>
                                <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                                  {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  }) : 'Recently'}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  {isPrimaryAdmin ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded-lg">
                                      <Lock className="w-3 h-3" />
                                      <span>Protected</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setUserToDelete(user)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 text-xs font-semibold transition"
                                      title="Delete user and associated content"
                                    >
                                      <Trash2 className="w-3 h-3 text-rose-600" />
                                      <span>Delete</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STORAGE MONITOR */}
            {activeTab === 'storage' && (
              <div className="space-y-6 animate-fade-in">
                {/* Supabase Storage Limit Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                          Supabase Object Storage Utilization
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Tracks all uploaded images, voice recordings, and file attachments against your 1 GB Supabase limit.
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Free Tier Limit</div>
                      <div className="text-xl sm:text-2xl font-black text-slate-900">
                        {stats?.storage_mb_limit || '1024'} MB <span className="text-xs font-semibold text-slate-400">(1 GB)</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 font-bold">
                        {stats?.storage_mb_used || '0.00'} MB Used ({stats?.percentage_used?.toFixed(2) || '0.00'}%)
                      </span>
                      <span className="text-slate-400 font-mono">
                        {stats?.storage_remaining_mb || '1024.00'} MB Remaining
                      </span>
                    </div>

                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner flex">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(1, Math.min(100, stats?.percentage_used || 1))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                      <span>0 MB</span>
                      <span>256 MB</span>
                      <span>512 MB</span>
                      <span>768 MB</span>
                      <span>1,024 MB (1 GB)</span>
                    </div>
                  </div>

                  {/* Media Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                          <span>Images & Photos</span>
                        </span>
                        <span className="text-xs font-extrabold text-blue-600">
                          {stats?.images_mb || '0.00'} MB
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Cover art, thumbnails & shared visual ideas</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <Mic className="w-4 h-4 text-emerald-600" />
                          <span>Voice Notes & Audio</span>
                        </span>
                        <span className="text-xs font-extrabold text-emerald-600">
                          {stats?.audio_mb || '0.00'} MB
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Recorded discussions & voice memos</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <span>Documents & Files</span>
                        </span>
                        <span className="text-xs font-extrabold text-amber-600">
                          {stats?.doc_mb || '0.00'} MB
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">PDFs, code snippets & spreadsheets</p>
                    </div>
                  </div>
                </div>

                {/* Additional Storage Details */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Bucket Configuration & Health</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-slate-400">Active Bucket</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">attachments (public)</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Total Uploaded Files</div>
                      <div className="font-bold text-slate-800 mt-0.5">{stats?.storage_files_count || 0} files</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Bandwidth & Quota</div>
                      <div className="font-bold text-emerald-600 mt-0.5">Within Safe Limits (Healthy)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DATA TABLES (VIEW AND EDIT) */}
            {activeTab === 'tables' && (
              <div className="space-y-6 animate-fade-in">
                {/* Table Picker */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {(stats?.tables || [
                    { name: 'profiles', count: stats?.users_count || 0, description: 'User profiles' },
                    { name: 'ideas', count: stats?.ideas_count || 0, description: 'Idea spaces' },
                    { name: 'idea_members', count: stats?.members_count || 0, description: 'Idea collaborators' },
                    { name: 'posts', count: stats?.posts_count || 0, description: 'Discussion posts' },
                    { name: 'post_attachments', count: stats?.attachments_count || 0, description: 'Attachments' },
                    { name: 'notifications', count: 0, description: 'User notifications' }
                  ]).map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTable(t.name)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shadow-2xs ${
                        selectedTable === t.name
                          ? 'bg-purple-600 text-white shadow-purple-500/20'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>{t.name}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        selectedTable === t.name ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Table Viewer */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        <span>Table: public.{selectedTable}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {filteredTableRows.length} rows loaded
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Direct table viewer. Click "Edit" to modify columns or "Delete" to remove a record.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder={`Search ${selectedTable}...`}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                      />
                    </div>
                  </div>

                  {tableLoading ? (
                    <div className="py-12">
                      <LoadingScreen fullScreen={false} size="small" message={`Loading ${selectedTable} records...`} />
                    </div>
                  ) : filteredTableRows.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 italic text-xs">
                      No records found in table public.{selectedTable}
                    </div>
                  ) : selectedTable === 'profiles' ? (
                    /* Tailored Profiles Table with prominent Avatars and styling */
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider backdrop-blur-xs">
                          <tr>
                            <th className="px-6 py-4">Avatar & User Profile</th>
                            <th className="px-4 py-4">System Role</th>
                            <th className="px-4 py-4">Avatar Source</th>
                            <th className="px-4 py-4">Account ID</th>
                            <th className="px-4 py-4">Created Date</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTableRows.map((row) => {
                            const isPrimaryAdmin = row.email === 'tushrahul58@gmail.com' || row.id === '79b19372-636a-493f-882c-81d6664de58e';
                            const isAdminRole = row.role === 'admin' || isPrimaryAdmin;
                            const avatarSrc = row.avatar_url || getRandomAvatar(row.email || row.display_name);

                            return (
                              <tr key={row.id} className="hover:bg-purple-50/30 transition-all duration-150 group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3.5">
                                    <div className="relative flex-shrink-0">
                                      <img
                                        src={avatarSrc}
                                        alt={row.display_name || 'User'}
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = getRandomAvatar(row.email || row.display_name);
                                        }}
                                        className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-300/80 shadow-sm transition-transform duration-200 group-hover:scale-105 bg-slate-100"
                                      />
                                      {isAdminRole && (
                                        <span 
                                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center ring-2 ring-white shadow-2xs"
                                          title="Administrator"
                                        >
                                          <Shield className="w-2.5 h-2.5" />
                                        </span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-2">
                                        <span>{row.display_name || 'Anonymous User'}</span>
                                        {isPrimaryAdmin && (
                                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200/80 tracking-wide uppercase">
                                            Owner
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-500 font-mono truncate mt-0.5">
                                        {row.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  {isAdminRole ? (
                                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200/90 inline-flex items-center gap-1.5 shadow-2xs">
                                      <Shield className="w-3.5 h-3.5 text-purple-600" />
                                      <span>Admin</span>
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/80 inline-flex items-center gap-1">
                                      <Users className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Member</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2.5">
                                    <img
                                      src={avatarSrc}
                                      alt="Thumbnail"
                                      className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200 flex-shrink-0 shadow-2xs bg-slate-100"
                                    />
                                    <span className="font-mono text-[11px] text-slate-700 truncate max-w-[170px] bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/80" title={row.avatar_url || 'Random Avatar'}>
                                      {row.avatar_url || 'auto-generated'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80 inline-block" title={row.id}>
                                    {row.id ? `${row.id.slice(0, 8)}...${row.id.slice(-4)}` : '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-slate-500 text-xs">
                                  {row.created_at ? new Date(row.created_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  }) : 'Recently'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleOpenEditRow(row)}
                                      className="p-2 rounded-xl bg-blue-50/70 hover:bg-blue-100 text-blue-600 border border-blue-200/60 transition shadow-2xs"
                                      title="Edit profile fields"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    {!isPrimaryAdmin && (
                                      <button
                                        onClick={() => setRowToDelete(row)}
                                        className="p-2 rounded-xl bg-rose-50/70 hover:bg-rose-100 text-rose-600 border border-rose-200/60 transition shadow-2xs"
                                        title="Delete profile record"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* Generic Table with image rendering for any URL column */
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Actions</th>
                            {Object.keys(filteredTableRows[0] || {}).map((col) => (
                              <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {filteredTableRows.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-2.5 whitespace-nowrap font-sans">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditRow(row)}
                                    className="p-1 rounded-lg hover:bg-slate-100 text-blue-600 transition"
                                    title="Edit record"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setRowToDelete(row)}
                                    className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              {Object.entries(row).map(([col, val]) => {
                                const strVal = String(val ?? '');
                                const isImageUrl = (col.includes('url') || col.includes('avatar') || col.includes('cover')) && 
                                  (strVal.startsWith('/') || strVal.startsWith('http'));

                                return (
                                  <td key={col} className="px-4 py-2.5 whitespace-nowrap max-w-[240px] truncate text-slate-700">
                                    {isImageUrl ? (
                                      <div className="flex items-center gap-2">
                                        <img
                                          src={strVal}
                                          alt={col}
                                          className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200 flex-shrink-0 bg-slate-100"
                                        />
                                        <span className="truncate max-w-[150px] font-mono text-[10px] text-slate-500">
                                          {strVal}
                                        </span>
                                      </div>
                                    ) : typeof val === 'object' && val !== null ? (
                                      JSON.stringify(val)
                                    ) : (
                                      strVal
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: ALL IDEAS BY USERS */}
            {activeTab === 'ideas' && (
              <div className="space-y-6 animate-fade-in">
                {/* Search Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                      All Idea Spaces Across Platform
                    </h3>
                    <p className="text-xs text-slate-500">
                      As administrator, review every idea space, see who created it, inspect discussions, and moderate content.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ideas or creator..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Ideas Grid */}
                {filteredIdeas.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
                    <Lightbulb className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No ideas found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search query.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredIdeas.map((idea) => {
                      const theme = getIdeaTheme(idea.color_theme || 'blue');

                      return (
                        <div
                          key={idea.id}
                          className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
                        >
                          {/* Banner & Color Theme Thumbnail */}
                          <div className="h-32 w-full relative overflow-hidden bg-slate-900">
                            {idea.cover_url ? (
                              <img
                                src={idea.cover_url}
                                alt={idea.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center text-4xl font-black text-white/30"
                                style={{ backgroundColor: theme.hex }}
                              >
                                {idea.title?.charAt(0) || 'I'}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                            <div className="absolute top-3 left-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center gap-1.5 border border-white/20">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.hex }} />
                                <span>{theme.name.split(' ')[0]}</span>
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-base text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-1">
                                {idea.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {idea.description || 'No description provided.'}
                              </p>
                            </div>

                            {/* Creator Card Box (PROMINENT CREATOR DISPLAY) */}
                            <div className="mt-4 pt-3.5 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 p-4 rounded-b-3xl">
                              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                                Created By
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={idea.owner_avatar || getRandomAvatar(idea.owner_email || idea.owner_name)}
                                    alt={idea.owner_name}
                                    className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-2xs flex-shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-800 truncate">
                                      {idea.owner_name}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono truncate">
                                      {idea.owner_email}
                                    </div>
                                  </div>
                                </div>

                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {idea.created_at ? new Date(idea.created_at).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric'
                                  }) : 'Recently'}
                                </span>
                              </div>

                              {/* Stats and Action button */}
                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-3 text-slate-500 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{idea.members_count || 1}</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{idea.posts_count || 0}</span>
                                  </span>
                                </div>

                                {onSelectIdea && (
                                  <button
                                    onClick={() => onSelectIdea(idea)}
                                    className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs"
                                  >
                                    <span>Open Space</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-slide-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 text-center tracking-tight">
              Delete User Account?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-800">{userToDelete.display_name || userToDelete.email}</strong>?
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-rose-50/70 border border-rose-100 text-xs text-rose-800 space-y-1">
              <p className="font-bold">This action cannot be undone:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-700">
                <li>User's authentication account will be removed.</li>
                <li>All idea spaces owned by this user will be erased.</li>
                <li>All their discussion posts and attachments will be deleted.</li>
              </ul>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-rose-500/20"
              >
                {isDeletingUser ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Table Record Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-slide-up">
            <h3 className="text-base font-extrabold text-slate-900 text-center">
              Delete Record from {selectedTable}?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Record ID: <span className="font-mono text-slate-700 font-semibold">{rowToDelete.id}</span>
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => setRowToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRow}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Table Record Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Edit Record in {selectedTable}
                </h3>
                <p className="text-xs text-slate-400 font-mono">ID: {editingRow.id}</p>
              </div>
              <button onClick={() => setEditingRow(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRow} className="space-y-3 overflow-y-auto flex-1 pr-1">
              {Object.entries(editFormData).map(([field, val]) => (
                <div key={field}>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {field}
                  </label>
                  <input
                    type="text"
                    value={val ?? ''}
                    onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                  />
                </div>
              ))}

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  disabled={isSavingRow}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRow}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  {isSavingRow ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
