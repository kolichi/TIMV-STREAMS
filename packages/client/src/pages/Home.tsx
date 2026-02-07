import { useQuery } from '@tanstack/react-query';
import { tracksApi } from '../lib/api';
import { TrackCard, TrackListItem } from '../components/TrackCard';
import { ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Home() {
  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['tracks', 'trending'],
    queryFn: () => tracksApi.getTrending().then((res) => res.data),
  });

  const { data: newReleases, isLoading: newLoading } = useQuery({
    queryKey: ['tracks', 'new'],
    queryFn: () => tracksApi.getNew().then((res) => res.data),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-12 text-center py-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900/50 to-accent-900/50">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 gradient-text">
            Stream Music
          </h1>
          <p className="text-surface-300 text-lg mb-8 max-w-md mx-auto">
            Discover amazing artists. Stream in any quality. Save your data.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-surface-900 rounded-full font-semibold hover:scale-105 transition-transform"
          >
            Start Exploring
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Trending */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-primary-400" />
            <h2 className="text-2xl font-bold">Trending Now</h2>
          </div>
          <Link
            to="/search?filter=trending"
            className="text-sm text-surface-400 hover:text-white flex items-center gap-1"
          >
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {trendingLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-surface-800 rounded-xl p-4">
                <div className="aspect-square skeleton rounded-lg mb-3" />
                <div className="h-4 skeleton rounded mb-2" />
                <div className="h-3 skeleton rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {trending?.slice(0, 10).map((track: any) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </section>

      {/* New Releases */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-accent-400" />
            <h2 className="text-2xl font-bold">New Releases</h2>
          </div>
          <Link
            to="/search?filter=new"
            className="text-sm text-surface-400 hover:text-white flex items-center gap-1"
          >
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {newLoading ? (
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
        ) : (
          <div className="bg-surface-800/30 rounded-xl overflow-hidden">
            {newReleases?.slice(0, 10).map((track: any, index: number) => (
              <TrackListItem
                key={track.id}
                track={track}
                index={index + 1}
                queue={newReleases}
              />
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6 mb-12">
        {[
          {
            title: 'Data Saver Mode',
            description: 'Stream at 64kbps to save up to 75% on data',
            icon: '📱',
          },
          {
            title: 'Easy Uploads',
            description: 'Artists can upload tracks in seconds',
            icon: '🎵',
          },
          {
            title: 'Offline Mode',
            description: 'Download tracks for offline listening',
            icon: '💾',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="bg-surface-800/50 rounded-xl p-6 text-center"
          >
            <div className="text-4xl mb-4">{feature.icon}</div>
            <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
            <p className="text-surface-400 text-sm">{feature.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
