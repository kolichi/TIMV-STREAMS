import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { User, Mail, Mic, LogOut, Trash2, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { usersApi, authApi } from '../lib/api';
import clsx from 'clsx';

export function Settings() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { displayName?: string; bio?: string }) =>
      usersApi.updateProfile(data).then((res) => res.data),
    onSuccess: (data) => {
      setUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleLogout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => {});
    }
    logout();
    navigate('/');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="p-6 text-center py-20">
        <User className="w-16 h-16 text-surface-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to access settings</h2>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Profile Section */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Profile</h2>
        <div className="bg-surface-800/50 rounded-xl p-6 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-700">
              {user.avatarUrl ? (
                <img
                  src={`/uploads/${user.avatarUrl}`}
                  alt={user.displayName || user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {(user.displayName || user.username)[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-lg">
                {user.displayName || user.username}
              </p>
              <p className="text-surface-400">@{user.username}</p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Your display name"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Tell us about yourself"
              rows={3}
              maxLength={500}
            />
          </div>

          <button
            onClick={() =>
              updateMutation.mutate({
                displayName: displayName || undefined,
                bio: bio || undefined,
              })
            }
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-primary-500 rounded-lg font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <Check className="w-5 h-5" />
            ) : null}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </section>

      {/* Account Info */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Account</h2>
        <div className="bg-surface-800/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-surface-700">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-surface-400" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-surface-400">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-surface-700">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-surface-400" />
              <div>
                <p className="font-medium">Username</p>
                <p className="text-sm text-surface-400">@{user.username}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-surface-400" />
              <div>
                <p className="font-medium">Account Type</p>
                <p className="text-sm text-surface-400">
                  {user.isArtist ? 'Artist' : 'Listener'}
                </p>
              </div>
            </div>
            {!user.isArtist && (
              <button className="px-4 py-2 text-sm bg-surface-700 rounded-lg hover:bg-surface-600 transition-colors">
                Upgrade to Artist
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-red-500">Danger Zone</h2>
        <div className="bg-surface-800/50 rounded-xl p-6 space-y-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-3 bg-surface-700 rounded-lg hover:bg-surface-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>

          <button className="flex items-center gap-2 w-full px-4 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors">
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>
      </section>
    </div>
  );
}
