import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Howl } from 'howler';
import { streamApi } from '../lib/api';

export interface Track {
  id: string;
  title: string;
  duration: number;
  coverUrl: string | null;
  artist: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  album?: {
    id: string;
    title: string;
    coverUrl: string | null;
  } | null;
}

type Quality = 'low' | 'medium' | 'high';
type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  // Current track & queue
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  // Settings
  quality: Quality;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  
  // Howler instance
  howl: Howl | null;
  
  // Actions
  play: (track: Track, queue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setQuality: (quality: Quality) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      quality: 'medium',
      repeatMode: 'off',
      isShuffled: false,
      howl: null,
      
      play: (track, queue = []) => {
        const { howl: oldHowl, quality, volume, isMuted } = get();
        
        // Stop and unload previous track
        if (oldHowl) {
          oldHowl.stop();
          oldHowl.unload();
        }
        
        set({ isLoading: true, currentTrack: track });
        
        const streamUrl = streamApi.getStreamUrl(track.id, quality);
        
        const howl = new Howl({
          src: [streamUrl],
          html5: true, // Enable streaming
          preload: true,
          volume: isMuted ? 0 : volume,
          onload: () => {
            set({
              isLoading: false,
              duration: howl.duration(),
            });
          },
          onplay: () => {
            set({ isPlaying: true });
            // Start progress update
            const updateProgress = () => {
              if (get().isPlaying) {
                set({ currentTime: howl.seek() as number });
                requestAnimationFrame(updateProgress);
              }
            };
            requestAnimationFrame(updateProgress);
          },
          onpause: () => set({ isPlaying: false }),
          onstop: () => set({ isPlaying: false, currentTime: 0 }),
          onend: () => {
            const { repeatMode, queue, queueIndex } = get();
            
            // Track completion for stats
            streamApi.complete(track.id, track.duration).catch(() => {});
            
            if (repeatMode === 'one') {
              howl.seek(0);
              howl.play();
            } else {
              get().playNext();
            }
          },
          onloaderror: (_, error) => {
            console.error('Audio load error:', error);
            set({ isLoading: false });
          },
        });
        
        // Set queue
        const queueIndex = queue.findIndex((t) => t.id === track.id);
        set({
          howl,
          queue: queue.length > 0 ? queue : [track],
          queueIndex: queueIndex >= 0 ? queueIndex : 0,
        });
        
        howl.play();
      },
      
      pause: () => {
        const { howl } = get();
        if (howl) {
          howl.pause();
        }
      },
      
      resume: () => {
        const { howl } = get();
        if (howl) {
          howl.play();
        }
      },
      
      togglePlay: () => {
        const { isPlaying, howl } = get();
        if (howl) {
          if (isPlaying) {
            howl.pause();
          } else {
            howl.play();
          }
        }
      },
      
      seek: (time) => {
        const { howl } = get();
        if (howl) {
          howl.seek(time);
          set({ currentTime: time });
        }
      },
      
      setVolume: (volume) => {
        const { howl } = get();
        set({ volume, isMuted: volume === 0 });
        if (howl) {
          howl.volume(volume);
        }
      },
      
      toggleMute: () => {
        const { howl, isMuted, volume } = get();
        set({ isMuted: !isMuted });
        if (howl) {
          howl.volume(isMuted ? volume : 0);
        }
      },
      
      setQuality: (quality) => {
        set({ quality });
        // If currently playing, reload with new quality
        const { currentTrack, isPlaying, currentTime } = get();
        if (currentTrack && isPlaying) {
          get().play(currentTrack, get().queue);
          // Seek to previous position after loading
          setTimeout(() => {
            get().seek(currentTime);
          }, 500);
        }
      },
      
      setRepeatMode: (mode) => set({ repeatMode: mode }),
      
      toggleShuffle: () => {
        const { isShuffled, queue, currentTrack } = get();
        if (!isShuffled && queue.length > 1) {
          // Shuffle queue but keep current track
          const otherTracks = queue.filter((t) => t.id !== currentTrack?.id);
          const shuffled = otherTracks.sort(() => Math.random() - 0.5);
          if (currentTrack) {
            shuffled.unshift(currentTrack);
          }
          set({ queue: shuffled, queueIndex: 0, isShuffled: true });
        } else {
          set({ isShuffled: false });
        }
      },
      
      playNext: () => {
        const { queue, queueIndex, repeatMode, isShuffled } = get();
        
        if (queue.length === 0) return;
        
        let nextIndex = queueIndex + 1;
        
        if (nextIndex >= queue.length) {
          if (repeatMode === 'all') {
            nextIndex = 0;
          } else {
            set({ isPlaying: false });
            return;
          }
        }
        
        const nextTrack = queue[nextIndex];
        if (nextTrack) {
          get().play(nextTrack, queue);
          set({ queueIndex: nextIndex });
        }
      },
      
      playPrevious: () => {
        const { queue, queueIndex, currentTime } = get();
        
        // If more than 3 seconds in, restart current track
        if (currentTime > 3) {
          get().seek(0);
          return;
        }
        
        if (queue.length === 0) return;
        
        let prevIndex = queueIndex - 1;
        if (prevIndex < 0) {
          prevIndex = queue.length - 1;
        }
        
        const prevTrack = queue[prevIndex];
        if (prevTrack) {
          get().play(prevTrack, queue);
          set({ queueIndex: prevIndex });
        }
      },
      
      addToQueue: (track) => {
        const { queue } = get();
        if (!queue.find((t) => t.id === track.id)) {
          set({ queue: [...queue, track] });
        }
      },
      
      clearQueue: () => {
        const { currentTrack } = get();
        set({ queue: currentTrack ? [currentTrack] : [], queueIndex: 0 });
      },
    }),
    {
      name: 'stream-player',
      partialize: (state) => ({
        volume: state.volume,
        quality: state.quality,
        repeatMode: state.repeatMode,
      }),
    }
  )
);
