import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Heart, ListMusic, Clock, Plus } from 'lucide-react';
import { tracksApi, playlistsApi, getUploadUrl } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { TrackListItem } from '../components/TrackCard';
import { Link } from 'react-router-dom';

export function Library() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const { data: likedData, isLoading: likedLoading } = useQuery({
    queryKey: ['tracks', 'liked'],
    queryFn: () => tracksApi.getLiked(1, 10).then((res) => res.data),
    enabled: isAuthenticated,
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['playlists', user?.username],
    queryFn: () =>
      playlistsApi.getUserPlaylists(user!.username).then((res) => res.data),
    enabled: isAuthenticated && !!user?.username,
  });

  if (!isAuthenticated) {
    return (
      <div className="p-6 text-center py-20">
        <ListMusic className="w-16 h-16 text-surface-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to see your library</h2>
        <p className="text-surface-400 mb-6">
          Save your favorite tracks and create playlists
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  const likedTracks = likedData?.tracks || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Your Library</h1>

      {/* Liked Songs Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold">Liked Songs</h2>
          </div>
          {likedData?.pagination?.total > 10 && (
            <Link
              to="/library/liked"
              className="text-sm text-surface-400 hover:text-white"
            >
              See all ({likedData.pagination.total})
            </Link>
          )}
        </div>

        {likedLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="w-10 h-10 skeleton rounded" />
                <div className="flex-1">
                  <div className="h-4 skeleton rounded mb-2 w-1/3" />
                  <div className="h-3 skeleton rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : likedTracks.length === 0 ? (
          <div className="text-center py-8 bg-surface-800/30 rounded-xl">
            <Heart className="w-12 h-12 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400">No liked songs yet</p>
            <p className="text-surface-500 text-sm mt-1">
              Like songs to add them to your library
            </p>
          </div>
        ) : (
          <div className="bg-surface-800/30 rounded-xl overflow-hidden">
            {likedTracks.map((track: any, index: number) => (
              <TrackListItem
                key={track.id}
                track={track}
                index={index + 1}
                queue={likedTracks}
              />
            ))}
          </div>
        )}
      </section>

      {/* Playlists Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ListMusic className="w-6 h-6 text-primary-500" />
            <h2 className="text-xl font-bold">Your Playlists</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-800 rounded-full text-sm hover:bg-surface-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create Playlist
          </button>
        </div>

        {playlistsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-surface-800 rounded-xl p-4">
                <div className="aspect-square skeleton rounded-lg mb-3" />
                <div className="h-4 skeleton rounded mb-2" />
                <div className="h-3 skeleton rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : !playlists || playlists.length === 0 ? (
          <div className="text-center py-8 bg-surface-800/30 rounded-xl">
            <ListMusic className="w-12 h-12 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400">No playlists yet</p>
            <p className="text-surface-500 text-sm mt-1">
              Create a playlist to organize your music
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map((playlist: any) => (
              <Link
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className="group bg-surface-800/50 hover:bg-surface-800 rounded-xl p-4 transition-all"
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-surface-700">
                  {playlist.coverUrl ? (
                    <img
                      src={getUploadUrl(playlist.coverUrl)}
                      alt={playlist.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center">
                      <ListMusic className="w-12 h-12 text-white/50" />
                    </div>
                  )}
                </div>
                <p className="font-semibold truncate">{playlist.title}</p>
                <p className="text-sm text-surface-400">
                  {playlist._count?.tracks || 0} tracks
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
