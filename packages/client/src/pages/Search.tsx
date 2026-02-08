import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, X, Mic } from 'lucide-react';
import { searchApi, tracksApi } from '../lib/api';
import { TrackCard } from '../components/TrackCard';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

type SearchType = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists';

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [type, setType] = useState<SearchType>(
    (searchParams.get('type') as SearchType) || 'all'
  );

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        setSearchParams({ q: query, type });
      } else {
        setSearchParams({});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type]);

  // Fetch all tracks when no search query (browse mode)
  const { data: allTracks, isLoading: allTracksLoading } = useQuery({
    queryKey: ['tracks', 'all'],
    queryFn: () => tracksApi.getNew().then((res) => res.data),
    enabled: !debouncedQuery,
  });

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, type],
    queryFn: () =>
      searchApi
        .search(debouncedQuery, type === 'all' ? undefined : type, 20)
        .then((res) => res.data),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['search', 'suggestions', query],
    queryFn: () => searchApi.suggestions(query).then((res) => res.data),
    enabled: query.length >= 2 && query !== debouncedQuery,
  });

  const tabs: { value: SearchType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'tracks', label: 'Tracks' },
    { value: 'artists', label: 'Artists' },
    { value: 'albums', label: 'Albums' },
    { value: 'playlists', label: 'Playlists' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Search Input */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for tracks, artists, albums..."
          className="w-full pl-12 pr-12 py-4 bg-surface-800 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setType(tab.value)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              type === tab.value
                ? 'bg-primary-500 text-white'
                : 'bg-surface-800 text-surface-300 hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {!debouncedQuery ? (
        // Browse mode - show all tracks
        <div>
          <h2 className="text-2xl font-bold mb-6">Browse All Tracks</h2>
          {allTracksLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-surface-800 rounded-xl p-4">
                  <div className="aspect-square skeleton rounded-lg mb-3" />
                  <div className="h-4 skeleton rounded mb-2" />
                  <div className="h-3 skeleton rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : allTracks?.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allTracks.map((track: any) => (
                <TrackCard key={track.id} track={track} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <SearchIcon className="w-16 h-16 text-surface-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">No tracks yet</h2>
              <p className="text-surface-400">
                Be the first to upload music!
              </p>
            </div>
          )}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-surface-800 rounded-xl p-4">
              <div className="aspect-square skeleton rounded-lg mb-3" />
              <div className="h-4 skeleton rounded mb-2" />
              <div className="h-3 skeleton rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tracks */}
          {(type === 'all' || type === 'tracks') && results?.tracks?.length > 0 && (
            <section>
              <h3 className="text-xl font-bold mb-4">Tracks</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.tracks.map((track: any) => (
                  <TrackCard key={track.id} track={track} />
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {(type === 'all' || type === 'artists') && results?.artists?.length > 0 && (
            <section>
              <h3 className="text-xl font-bold mb-4">Artists</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.artists.map((artist: any) => (
                  <Link
                    key={artist.id}
                    to={`/artist/${artist.username}`}
                    className="group text-center"
                  >
                    <div className="aspect-square rounded-full overflow-hidden mb-3 mx-auto w-32 bg-surface-700">
                      {artist.avatarUrl ? (
                        <img
                          src={`/uploads/${artist.avatarUrl}`}
                          alt={artist.displayName || artist.username}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                          <span className="text-4xl font-bold text-white">
                            {(artist.displayName || artist.username)[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="font-semibold truncate group-hover:text-primary-400 transition-colors">
                      {artist.displayName || artist.username}
                    </p>
                    <p className="text-sm text-surface-400">
                      {artist._count?.tracks || 0} tracks
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {(type === 'all' || type === 'albums') && results?.albums?.length > 0 && (
            <section>
              <h3 className="text-xl font-bold mb-4">Albums</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.albums.map((album: any) => (
                  <Link
                    key={album.id}
                    to={`/album/${album.id}`}
                    className="group bg-surface-800/50 hover:bg-surface-800 rounded-xl p-4 transition-all"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-surface-700">
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
                    <p className="font-semibold truncate">{album.title}</p>
                    <p className="text-sm text-surface-400 truncate">
                      {album.artist?.displayName || album.artist?.username}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Playlists */}
          {(type === 'all' || type === 'playlists') && results?.playlists?.length > 0 && (
            <section>
              <h3 className="text-xl font-bold mb-4">Playlists</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.playlists.map((playlist: any) => (
                  <Link
                    key={playlist.id}
                    to={`/playlist/${playlist.id}`}
                    className="group bg-surface-800/50 hover:bg-surface-800 rounded-xl p-4 transition-all"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-surface-700">
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
                    <p className="font-semibold truncate">{playlist.title}</p>
                    <p className="text-sm text-surface-400">
                      {playlist._count?.tracks || 0} tracks
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* No results */}
          {results &&
            !results.tracks?.length &&
            !results.artists?.length &&
            !results.albums?.length &&
            !results.playlists?.length && (
              <div className="text-center py-20">
                <h2 className="text-xl font-bold mb-2">No results found</h2>
                <p className="text-surface-400">
                  Try a different search term or filter
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
