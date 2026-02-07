import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Library } from './pages/Library';
import { Upload } from './pages/Upload';
import { Track } from './pages/Track';
import { Artist } from './pages/Artist';
import { Playlist } from './pages/Playlist';
import { Album } from './pages/Album';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="library" element={<Library />} />
        <Route path="upload" element={<Upload />} />
        <Route path="track/:trackId" element={<Track />} />
        <Route path="artist/:username" element={<Artist />} />
        <Route path="playlist/:playlistId" element={<Playlist />} />
        <Route path="album/:albumId" element={<Album />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
