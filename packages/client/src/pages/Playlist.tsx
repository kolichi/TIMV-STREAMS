import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Heart, Share2, MoreHorizontal, Clock } from 'lucide-react';
import { playlistsApi, tracksApi } from '../lib/api';
import { usePlayerStore } from '../store/player';
import { useAuthStore } from '../store/auth';
import { TrackListItem } from '../components/TrackCard';

export function Playlist() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayerStore();

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => playlistsApi.getOne(playlistId!).then((res) => res.data),
    enabled: !!playlistId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start mb-8">
          <div className="w-60 h-60 skeleton rounded-xl" />
          <div className="flex-1">
            <div className="h-4 skeleton rounded w-20 mb-2" />
            <div className="h-10 skeleton rounded w-64 mb-4" />
            <div className="h-4 skeleton rounded w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-6 text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Playlist not found</h2>
        <p className="text-surface-400">This playlist doesn't exist or is private</p>
      </div>
    );
  }

  const tracks = playlist.tracks || [];
  const isOwner = user?.id === playlist.userId;
  const isPlayingPlaylist = currentTrack && tracks.some((t: any) => t.id === currentTrack.id);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    
    if (isPlayingPlaylist && isPlaying) {
      togglePlay();
    } else {
      play(tracks[0], tracks);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  return (
    <div>
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-80 bg-gradient-to-b from-accent-900/50 to-surface-950" />

        <div className="relative p-6 pt-12">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
            {/* Cover */}
            <div className="w-60 h-60 rounded-xl overflow-hidden bg-surface-700 shadow-2xl flex-shrink-0">
              {playlist.coverUrl ? (
                <img
                  src={`/uploads/${playlist.coverUrl}`}
                  alt={playlist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent-500 to-primary-500" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm font-medium uppercase tracking-wider mb-2">Playlist</p>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">{playlist.title}</h1>
              {playlist.description && (
                <p className="text-surface-300 mb-4">{playlist.description}</p>
              )}
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                <Link
                  to={`/artist/${playlist.user?.username}`}
                  className="font-medium hover:underline"
                >
                  {playlist.user?.displayName || playlist.user?.username}
                </Link>
                <span className="text-surface-400">•</span>
                <span className="text-surface-400">
                  {playlist._count?.tracks || tracks.length} songs
                </span>
                <span className="text-surface-400">•</span>
                <span className="text-surface-400">
                  {formatDuration(playlist.totalDuration || 0)}
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
                {isPlayingPlaylist && isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
                {isPlayingPlaylist && isPlaying ? 'Pause' : 'Play'}
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
        {tracks.length === 0 ? (
          <div className="text-center py-12 text-surface-400">
            <p>This playlist is empty</p>
          </div>
        ) : (
          <div className="bg-surface-800/30 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 border-b border-surface-700 text-sm text-surface-400">
              <div className="w-8">#</div>
              <div className="w-10" />
              <div className="flex-1">Title</div>
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
