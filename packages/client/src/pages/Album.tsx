import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, Share2, MoreHorizontal, Clock, Calendar } from 'lucide-react';
import { albumsApi } from '../lib/api';
import { usePlayerStore } from '../store/player';
import { TrackListItem } from '../components/TrackCard';

export function Album() {
  const { albumId } = useParams<{ albumId: string }>();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayerStore();

  const { data: album, isLoading } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.getOne(albumId!).then((res) => res.data),
    enabled: !!albumId,
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

  if (!album) {
    return (
      <div className="p-6 text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Album not found</h2>
        <p className="text-surface-400">This album doesn't exist or is private</p>
      </div>
    );
  }

  const tracks = album.tracks || [];
  const isPlayingAlbum = currentTrack && tracks.some((t: any) => t.id === currentTrack.id);
  
  const totalDuration = tracks.reduce((acc: number, t: any) => acc + t.duration, 0);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    
    if (isPlayingAlbum && isPlaying) {
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-80 bg-gradient-to-b from-primary-900/50 to-surface-950" />

        <div className="relative p-6 pt-12">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
            {/* Cover */}
            <div className="w-60 h-60 rounded-xl overflow-hidden bg-surface-700 shadow-2xl flex-shrink-0">
              {album.coverUrl ? (
                <img
                  src={`/uploads/${album.coverUrl}`}
                  alt={album.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm font-medium uppercase tracking-wider mb-2">
                {album.albumType || 'Album'}
              </p>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">{album.title}</h1>
              {album.description && (
                <p className="text-surface-300 mb-4">{album.description}</p>
              )}
              <div className="flex items-center justify-center md:justify-start flex-wrap gap-2 text-sm">
                <Link
                  to={`/artist/${album.artist?.username}`}
                  className="flex items-center gap-2"
                >
                  {album.artist?.avatarUrl && (
                    <img
                      src={`/uploads/${album.artist.avatarUrl}`}
                      alt={album.artist.displayName || album.artist.username}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="font-medium hover:underline">
                    {album.artist?.displayName || album.artist?.username}
                  </span>
                </Link>
                {album.releaseDate && (
                  <>
                    <span className="text-surface-400">•</span>
                    <span className="text-surface-400 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(album.releaseDate)}
                    </span>
                  </>
                )}
                <span className="text-surface-400">•</span>
                <span className="text-surface-400">{tracks.length} songs</span>
                <span className="text-surface-400">•</span>
                <span className="text-surface-400">{formatDuration(totalDuration)}</span>
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
                {isPlayingAlbum && isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
                {isPlayingAlbum && isPlaying ? 'Pause' : 'Play'}
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
            <p>No tracks in this album yet</p>
          </div>
        ) : (
          <div className="bg-surface-800/30 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 border-b border-surface-700 text-sm text-surface-400">
              <div className="w-8">#</div>
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
                track={{
                  ...track,
                  artist: album.artist,
                  album: { id: album.id, title: album.title, coverUrl: album.coverUrl },
                }}
                index={index + 1}
                showCover={false}
                queue={tracks.map((t: any) => ({
                  ...t,
                  artist: album.artist,
                  album: { id: album.id, title: album.title, coverUrl: album.coverUrl },
                }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
