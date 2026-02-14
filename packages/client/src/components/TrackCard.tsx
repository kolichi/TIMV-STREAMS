import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, MoreHorizontal, Heart, Trash2, X } from 'lucide-react';
import { usePlayerStore, Track } from '../store/player';
import { getUploadUrl } from '../lib/api';
import clsx from 'clsx';

interface TrackCardProps {
  track: Track & { playCount?: number; isLiked?: boolean };
  showArtist?: boolean;
  onLike?: () => void;
}

export function TrackCard({ track, showArtist = true, onLike }: TrackCardProps) {
  const { play, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const isCurrentTrack = currentTrack?.id === track.id;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isCurrentTrack) {
      togglePlay();
    } else {
      play(track);
    }
  };

  return (
    <div className="group relative bg-surface-800/50 hover:bg-surface-800 rounded-xl p-4 transition-all">
      {/* Cover */}
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
        {track.coverUrl || track.album?.coverUrl ? (
          <img
            src={getUploadUrl(track.coverUrl || track.album?.coverUrl)}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
        )}

        {/* Play button overlay */}
        <button
          onClick={handlePlay}
          className={clsx(
            'absolute right-2 bottom-2 w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center shadow-xl transition-all',
            'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0',
            isCurrentTrack && 'opacity-100 translate-y-0'
          )}
        >
          {isCurrentTrack && isPlaying ? (
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-1 bg-white animate-pulse" style={{ height: '60%' }} />
              <span className="w-1 bg-white animate-pulse" style={{ height: '100%', animationDelay: '0.1s' }} />
              <span className="w-1 bg-white animate-pulse" style={{ height: '40%', animationDelay: '0.2s' }} />
            </div>
          ) : (
            <Play className="w-6 h-6 text-white ml-1" />
          )}
        </button>
      </div>

      {/* Info */}
      <Link to={`/track/${track.id}`} className="block">
        <h3 className="font-semibold truncate hover:underline">{track.title}</h3>
      </Link>

      {showArtist && track.artist && (
        <Link
          to={`/artist/${track.artist.username}`}
          className="text-sm text-surface-400 hover:text-white truncate block mt-1"
        >
          {track.artist.displayName || track.artist.username}
        </Link>
      )}

      {/* Play count */}
      {track.playCount !== undefined && (
        <p className="text-xs text-surface-500 mt-1">
          {track.playCount.toLocaleString()} plays
        </p>
      )}
    </div>
  );
}

interface TrackListItemProps {
  track: Track & { playCount?: number; isLiked?: boolean; artistId?: string };
  index?: number;
  showCover?: boolean;
  queue?: Track[];
  onLike?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

export function TrackListItem({
  track,
  index,
  showCover = true,
  queue = [],
  onLike,
  onDelete,
  canDelete = false,
}: TrackListItemProps) {
  const { play, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePlay = () => {
    if (isCurrentTrack) {
      togglePlay();
    } else {
      play(track, queue.length > 0 ? queue : [track]);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={clsx(
        'group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-surface-800 transition-colors cursor-pointer',
        isCurrentTrack && 'bg-surface-800'
      )}
      onClick={handlePlay}
    >
      {/* Index / Play button */}
      <div className="w-8 flex items-center justify-center">
        {index !== undefined && (
          <span
            className={clsx(
              'text-sm group-hover:hidden',
              isCurrentTrack ? 'text-primary-400' : 'text-surface-400'
            )}
          >
            {index}
          </span>
        )}
        <button className={clsx('hidden group-hover:block', index === undefined && 'block')}>
          {isCurrentTrack && isPlaying ? (
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-1 bg-primary-400 animate-pulse" style={{ height: '60%' }} />
              <span className="w-1 bg-primary-400 animate-pulse" style={{ height: '100%' }} />
              <span className="w-1 bg-primary-400 animate-pulse" style={{ height: '40%' }} />
            </div>
          ) : (
            <Play
              className={clsx(
                'w-4 h-4',
                isCurrentTrack ? 'text-primary-400' : 'text-white'
              )}
            />
          )}
        </button>
      </div>

      {/* Cover */}
      {showCover && (
        <div className="w-10 h-10 rounded overflow-hidden bg-surface-700 flex-shrink-0">
          {track.coverUrl || track.album?.coverUrl ? (
            <img
              src={getUploadUrl(track.coverUrl || track.album?.coverUrl)}
              alt={track.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'font-medium truncate',
            isCurrentTrack && 'text-primary-400'
          )}
        >
          {track.title}
        </p>
        {track.artist && (
          <Link
            to={`/artist/${track.artist.username}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-surface-400 hover:text-white hover:underline truncate block"
          >
            {track.artist.displayName || track.artist.username}
          </Link>
        )}
      </div>

      {/* Play count */}
      {track.playCount !== undefined && (
        <span className="text-sm text-surface-400 hidden sm:block">
          {track.playCount.toLocaleString()}
        </span>
      )}

      {/* Duration */}
      <span className="text-sm text-surface-400 w-12 text-right">
        {formatDuration(track.duration)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative">
        {onLike && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className="p-2 text-surface-400 hover:text-white"
          >
            <Heart
              className={clsx('w-4 h-4', track.isLiked && 'fill-red-500 text-red-500')}
            />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-2 text-surface-400 hover:text-white"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute right-0 top-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 min-w-[150px] py-1">
              {canDelete && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-surface-700 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Track
                </button>
              )}
              {!canDelete && (
                <p className="px-4 py-2 text-surface-400 text-sm">No actions</p>
              )}
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <>
            <div
              className="fixed inset-0 bg-black/60 z-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
            />
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-800 border border-surface-700 rounded-xl p-6 z-50 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Delete Track</h3>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="p-1 text-surface-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-surface-300 mb-6">
                Are you sure you want to delete "<strong>{track.title}</strong>"? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-surface-700 rounded-lg hover:bg-surface-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onDelete?.();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
