import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Heart, Share2, MoreHorizontal, Clock } from 'lucide-react';
import { tracksApi, getUploadUrl } from '../lib/api';
import { usePlayerStore } from '../store/player';
import { useAuthStore } from '../store/auth';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function Track() {
  const { trackId } = useParams<{ trackId: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayerStore();

  const { data: track, isLoading } = useQuery({
    queryKey: ['track', trackId],
    queryFn: () => tracksApi.getOne(trackId!).then((res) => res.data),
    enabled: !!trackId,
  });

  const likeMutation = useMutation({
    mutationFn: () => tracksApi.like(trackId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['track', trackId] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
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

  if (!track) {
    return (
      <div className="p-6 text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Track not found</h2>
        <p className="text-surface-400">This track doesn't exist or is private</p>
      </div>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (isCurrentTrack) {
      togglePlay();
    } else {
      play(track);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-96 bg-gradient-to-b from-primary-900/50 to-surface-950" />

        <div className="relative p-6 pt-12">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">
            {/* Cover */}
            <div className="w-60 h-60 md:w-72 md:h-72 rounded-xl overflow-hidden bg-surface-700 shadow-2xl flex-shrink-0">
              {track.coverUrl || track.album?.coverUrl ? (
                <img
                  src={getUploadUrl(track.coverUrl || track.album?.coverUrl})
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm font-medium uppercase tracking-wider mb-2">
                {track.isExplicit && (
                  <span className="inline-block px-1.5 py-0.5 bg-surface-700 rounded text-xs mr-2">
                    E
                  </span>
                )}
                Song
              </p>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">{track.title}</h1>
              <div className="flex items-center justify-center md:justify-start flex-wrap gap-2 text-sm">
                <Link
                  to={`/artist/${track.artist?.username})
                  className="flex items-center gap-2"
                >
                  {track.artist?.avatarUrl && (
                    <img
                      src={getUploadUrl(track.artist.avatarUrl})
                      alt={track.artist.displayName || track.artist.username}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="font-medium hover:underline">
                    {track.artist?.displayName || track.artist?.username}
                  </span>
                </Link>
                {track.album && (
                  <>
                    <span className="text-surface-400">•</span>
                    <Link
                      to={`/album/${track.album.id})
                      className="text-surface-400 hover:text-white hover:underline"
                    >
                      {track.album.title}
                    </Link>
                  </>
                )}
                <span className="text-surface-400">•</span>
                <span className="text-surface-400">{formatDuration(track.duration)}</span>
                <span className="text-surface-400">•</span>
                <span className="text-surface-400">
                  {track.playCount?.toLocaleString() || 0} plays
                </span>
              </div>
              {track.genre && (
                <span className="inline-block mt-3 px-3 py-1 bg-surface-700 rounded-full text-sm text-surface-300">
                  {track.genre}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-8">
            <button
              onClick={handlePlay}
              className="flex items-center gap-2 px-8 py-4 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors text-lg"
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
              {isCurrentTrack && isPlaying ? 'Pause' : 'Play'}
            </button>

            {isAuthenticated && (
              <button
                onClick={() => likeMutation.mutate()}
                disabled={likeMutation.isPending}
                className={clsx(
                  'p-4 rounded-full border transition-colors',
                  track.isLiked
                    ? 'border-red-500 text-red-500'
                    : 'border-surface-600 hover:border-white'
                )}
              >
                <Heart
                  className={clsx('w-6 h-6', track.isLiked && 'fill-current')}
                />
              </button>
            )}

            <button className="p-4 rounded-full border border-surface-600 hover:border-white transition-colors">
              <Share2 className="w-6 h-6" />
            </button>

            <button className="p-4 rounded-full border border-surface-600 hover:border-white transition-colors">
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-surface-800/50 rounded-xl p-6">
            <h3 className="font-bold mb-4">Track Info</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-surface-400">Duration</dt>
                <dd>{formatDuration(track.duration)}</dd>
              </div>
              {track.genre && (
                <div className="flex justify-between">
                  <dt className="text-surface-400">Genre</dt>
                  <dd>{track.genre}</dd>
                </div>
              )}
              {track.bitrate && (
                <div className="flex justify-between">
                  <dt className="text-surface-400">Bitrate</dt>
                  <dd>{track.bitrate} kbps</dd>
                </div>
              )}
              {track.sampleRate && (
                <div className="flex justify-between">
                  <dt className="text-surface-400">Sample Rate</dt>
                  <dd>{(track.sampleRate / 1000).toFixed(1)} kHz</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-surface-400">Likes</dt>
                <dd>{track._count?.likedBy?.toLocaleString() || 0}</dd>
              </div>
            </dl>
          </div>

          {/* Artist Card */}
          <Link
            to={`/artist/${track.artist?.username})
            className="bg-surface-800/50 rounded-xl p-6 hover:bg-surface-800 transition-colors block"
          >
            <h3 className="font-bold mb-4">Artist</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-700">
                {track.artist?.avatarUrl ? (
                  <img
                    src={getUploadUrl(track.artist.avatarUrl})
                    alt={track.artist.displayName || track.artist.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {(track.artist?.displayName || track.artist?.username)?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-lg">
                  {track.artist?.displayName || track.artist?.username}
                </p>
                <p className="text-surface-400 text-sm">
                  @{track.artist?.username}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
