import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Settings2,
  ChevronUp,
  ChevronDown,
  Wifi,
  Signal,
} from 'lucide-react';
import { usePlayerStore, Track } from '../store/player';
import clsx from 'clsx';

// Format time in mm:ss
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Player() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    quality,
    repeatMode,
    isShuffled,
    queue,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    setQuality,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrevious,
  } = usePlayerStore();

  // Handle progress bar click/drag
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seek(percent * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Quality icon
  const QualityIcon = quality === 'low' ? Signal : Wifi;

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      {/* Mini Player */}
      <div
        className={clsx(
          'fixed left-0 right-0 bg-surface-900/95 backdrop-blur-xl border-t border-surface-800 z-50 transition-all',
          isExpanded ? 'bottom-full' : 'bottom-16 lg:bottom-0'
        )}
      >
        {/* Progress bar (clickable) */}
        <div
          ref={progressRef}
          className="h-1 bg-surface-700 cursor-pointer group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 py-3">
          {/* Track Info */}
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left lg:w-1/4 lg:flex-none"
          >
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface-700 flex-shrink-0">
              {currentTrack.coverUrl || currentTrack.album?.coverUrl ? (
                <img
                  src={`/uploads/${currentTrack.coverUrl || currentTrack.album?.coverUrl}`}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{currentTrack.title}</p>
              <p className="text-sm text-surface-400 truncate">
                {currentTrack.artist.displayName || currentTrack.artist.username}
              </p>
            </div>
          </button>

          {/* Center Controls */}
          <div className="hidden lg:flex items-center gap-4 flex-1 justify-center">
            <button
              onClick={toggleShuffle}
              className={clsx(
                'p-2 rounded-full transition-colors',
                isShuffled
                  ? 'text-primary-400'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={playPrevious}
              className="p-2 text-surface-300 hover:text-white transition-colors"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="p-3 rounded-full bg-white text-surface-900 hover:scale-105 transition-transform disabled:opacity-50"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-2 text-surface-300 hover:text-white transition-colors"
            >
              <SkipForward className="w-6 h-6" />
            </button>

            <button
              onClick={() =>
                setRepeatMode(
                  repeatMode === 'off'
                    ? 'all'
                    : repeatMode === 'all'
                    ? 'one'
                    : 'off'
                )
              }
              className={clsx(
                'p-2 rounded-full transition-colors',
                repeatMode !== 'off'
                  ? 'text-primary-400'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Time display */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-surface-400 w-32">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Mobile play button */}
            <button
              onClick={togglePlay}
              className="lg:hidden p-2 rounded-full bg-white text-surface-900"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Volume (desktop) */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 text-surface-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24"
              />
            </div>

            {/* Quality indicator */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="hidden lg:flex items-center gap-1 px-2 py-1 rounded text-xs text-surface-400 hover:text-white transition-colors"
            >
              <QualityIcon className="w-4 h-4" />
              <span className="uppercase">{quality}</span>
            </button>

            {/* Queue */}
            <button
              onClick={() => setShowQueue(!showQueue)}
              className="hidden lg:block p-2 text-surface-400 hover:text-white transition-colors"
            >
              <ListMusic className="w-5 h-5" />
            </button>

            {/* Expand (mobile) */}
            <button
              onClick={() => setIsExpanded(true)}
              className="lg:hidden p-2 text-surface-400"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Player (Mobile) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 bg-gradient-to-b from-surface-800 to-surface-950 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 text-surface-400"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
              <span className="text-sm text-surface-400">Now Playing</span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-surface-400"
              >
                <Settings2 className="w-6 h-6" />
              </button>
            </div>

            {/* Album Art */}
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-2xl">
                {currentTrack.coverUrl || currentTrack.album?.coverUrl ? (
                  <img
                    src={`/uploads/${currentTrack.coverUrl || currentTrack.album?.coverUrl}`}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="px-8 text-center">
              <h2 className="text-2xl font-bold truncate">{currentTrack.title}</h2>
              <Link
                to={`/artist/${currentTrack.artist.username}`}
                onClick={() => setIsExpanded(false)}
                className="text-surface-400 hover:text-primary-400 transition-colors"
              >
                {currentTrack.artist.displayName || currentTrack.artist.username}
              </Link>
            </div>

            {/* Progress */}
            <div className="px-8 py-6">
              <div
                className="h-1 bg-surface-700 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seek(percent * duration);
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-surface-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 pb-8">
              <button
                onClick={toggleShuffle}
                className={clsx(
                  'p-3',
                  isShuffled ? 'text-primary-400' : 'text-surface-400'
                )}
              >
                <Shuffle className="w-6 h-6" />
              </button>

              <button onClick={playPrevious} className="p-3 text-white">
                <SkipBack className="w-8 h-8" />
              </button>

              <button
                onClick={togglePlay}
                className="p-4 rounded-full bg-white text-surface-900"
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10" />
                ) : (
                  <Play className="w-10 h-10 ml-1" />
                )}
              </button>

              <button onClick={playNext} className="p-3 text-white">
                <SkipForward className="w-8 h-8" />
              </button>

              <button
                onClick={() =>
                  setRepeatMode(
                    repeatMode === 'off'
                      ? 'all'
                      : repeatMode === 'all'
                      ? 'one'
                      : 'off'
                  )
                }
                className={clsx(
                  'p-3',
                  repeatMode !== 'off' ? 'text-primary-400' : 'text-surface-400'
                )}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-6 h-6" />
                ) : (
                  <Repeat className="w-6 h-6" />
                )}
              </button>
            </div>

            {/* Quality Settings Modal */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 flex items-end"
                  onClick={() => setShowSettings(false)}
                >
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    className="w-full bg-surface-800 rounded-t-2xl p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-bold mb-4">Streaming Quality</h3>
                    <p className="text-sm text-surface-400 mb-4">
                      Lower quality uses less data. Great for mobile!
                    </p>
                    <div className="space-y-2">
                      {[
                        { value: 'low', label: 'Low', desc: '64 kbps - Save data' },
                        { value: 'medium', label: 'Normal', desc: '128 kbps - Balanced' },
                        { value: 'high', label: 'High', desc: '256 kbps - Best quality' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setQuality(opt.value as 'low' | 'medium' | 'high');
                            setShowSettings(false);
                          }}
                          className={clsx(
                            'w-full flex items-center justify-between p-4 rounded-lg transition-colors',
                            quality === opt.value
                              ? 'bg-primary-500/20 text-primary-400'
                              : 'bg-surface-700 hover:bg-surface-600'
                          )}
                        >
                          <div className="text-left">
                            <p className="font-medium">{opt.label}</p>
                            <p className="text-sm text-surface-400">{opt.desc}</p>
                          </div>
                          {quality === opt.value && (
                            <div className="w-2 h-2 rounded-full bg-primary-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue Sidebar (Desktop) */}
      <AnimatePresence>
        {showQueue && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-20 w-80 bg-surface-900 border-l border-surface-800 z-40 hidden lg:block"
          >
            <div className="p-4 border-b border-surface-800 flex items-center justify-between">
              <h3 className="font-bold">Queue</h3>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1 text-surface-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto h-full pb-4">
              {queue.map((track, index) => (
                <QueueItem
                  key={`${track.id}-${index}`}
                  track={track}
                  isCurrentTrack={track.id === currentTrack?.id}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QueueItem({
  track,
  isCurrentTrack,
}: {
  track: Track;
  isCurrentTrack: boolean;
}) {
  const { play, queue } = usePlayerStore();

  return (
    <button
      onClick={() => play(track, queue)}
      className={clsx(
        'w-full flex items-center gap-3 p-3 hover:bg-surface-800 transition-colors text-left',
        isCurrentTrack && 'bg-surface-800'
      )}
    >
      <div className="w-10 h-10 rounded overflow-hidden bg-surface-700 flex-shrink-0">
        {track.coverUrl || track.album?.coverUrl ? (
          <img
            src={`/uploads/${track.coverUrl || track.album?.coverUrl}`}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'font-medium truncate text-sm',
            isCurrentTrack && 'text-primary-400'
          )}
        >
          {track.title}
        </p>
        <p className="text-xs text-surface-400 truncate">
          {track.artist.displayName || track.artist.username}
        </p>
      </div>
    </button>
  );
}
