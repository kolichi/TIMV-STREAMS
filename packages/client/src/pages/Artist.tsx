import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Heart, Share2, MoreHorizontal, Clock } from 'lucide-react';
import { usersApi, tracksApi } from '../lib/api';
import { usePlayerStore } from '../store/player';
import { useAuthStore } from '../store/auth';
import { TrackListItem } from '../components/TrackCard';
import clsx from 'clsx';

export function Artist() {
  const { username } = useParams<{ username: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayerStore();

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ['artist', username],
    queryFn: () => usersApi.getProfile(username!).then((res) => res.data),
    enabled: !!username,
  });

  const { data: tracksData, isLoading: tracksLoading } = useQuery({
    queryKey: ['artist', username, 'tracks'],
    queryFn: () => usersApi.getTracks(username!, 1, 50).then((res) => res.data),
    enabled: !!username,
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.follow(username!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artist', username] });
    },
  });

  if (artistLoading) {
    return (
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start mb-8">
          <div className="w-40 h-40 skeleton rounded-full" />
          <div className="flex-1">
            <div className="h-8 skeleton rounded w-48 mb-2" />
            <div className="h-4 skeleton rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-6 text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Artist not found</h2>
        <p className="text-surface-400">This profile doesn't exist</p>
      </div>
    );
  }

  const tracks = tracksData?.tracks || [];
  const isOwnProfile = user?.username === username;
  const isPlayingArtist = currentTrack && tracks.some((t: any) => t.id === currentTrack.id);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    
    if (isPlayingArtist && isPlaying) {
      togglePlay();
    } else {
      play(tracks[0], tracks);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="relative">
        {/* Background */}
        <div className="absolute inset-0 h-80 bg-gradient-to-b from-primary-900/50 to-surface-950" />

        <div className="relative p-6 pt-12">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
            {/* Avatar */}
            <div className="w-40 h-40 md:w-52 md:h-52 rounded-full overflow-hidden bg-surface-700 shadow-2xl flex-shrink-0">
              {artist.avatarUrl ? (
                <img
                  src={`/uploads/${artist.avatarUrl}`}
                  alt={artist.displayName || artist.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <span className="text-6xl font-bold text-white">
                    {(artist.displayName || artist.username)[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              {artist.isVerified && (
                <div className="flex items-center justify-center md:justify-start gap-1 text-primary-400 text-sm mb-2">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  Verified Artist
                </div>
              )}
              <h1 className="text-4xl md:text-6xl font-bold mb-2">
                {artist.displayName || artist.username}
              </h1>
              <p className="text-surface-400 mb-4">@{artist.username}</p>
              {artist.bio && (
                <p className="text-surface-300 mb-4 max-w-2xl">{artist.bio}</p>
              )}
              <div className="flex items-center justify-center md:justify-start gap-6 text-sm">
                <span>
                  <strong>{artist._count?.tracks || 0}</strong>{' '}
                  <span className="text-surface-400">tracks</span>
                </span>
                <span>
                  <strong>{artist._count?.followers || 0}</strong>{' '}
                  <span className="text-surface-400">followers</span>
                </span>
                <span>
                  <strong>{artist._count?.following || 0}</strong>{' '}
                  <span className="text-surface-400">following</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-6">
            {tracks.length > 0 && (
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-6 py-3 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors"
              >
                {isPlayingArtist && isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
                {isPlayingArtist && isPlaying ? 'Pause' : 'Play'}
              </button>
            )}

            {!isOwnProfile && isAuthenticated && (
              <button
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                className={clsx(
                  'px-6 py-3 rounded-full font-semibold border transition-colors',
                  artist.isFollowing
                    ? 'border-primary-500 text-primary-400 hover:bg-primary-500/10'
                    : 'border-surface-500 hover:border-white'
                )}
              >
                {artist.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}

            <button className="p-3 rounded-full border border-surface-600 hover:border-white transition-colors">
              <Share2 className="w-5 h-5" />
            </button>

            <button className="p-3 rounded-full border border-surface-600 hover:border-white transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Tracks</h2>

        {tracksLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="w-8 h-4 skeleton rounded" />
                <div className="w-10 h-10 skeleton rounded" />
                <div className="flex-1">
                  <div className="h-4 skeleton rounded mb-2 w-1/3" />
                  <div className="h-3 skeleton rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-12 text-surface-400">
            <p>No tracks yet</p>
          </div>
        ) : (
          <div className="bg-surface-800/30 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-surface-700 text-sm text-surface-400">
              <div className="w-8">#</div>
              <div className="w-10" />
              <div className="flex-1">Title</div>
              <div className="hidden sm:block w-24 text-right">Plays</div>
              <div className="w-12 text-right">
                <Clock className="w-4 h-4 inline" />
              </div>
              <div className="w-20" />
            </div>

            {tracks.map((track: any, index: number) => (
              <TrackListItem
                key={track.id}
                track={track}
                index={index + 1}
                queue={tracks}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
