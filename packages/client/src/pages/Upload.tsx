import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Upload as UploadIcon, Music, X, Image, Loader2, CheckCircle } from 'lucide-react';
import { uploadApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import clsx from 'clsx';

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  result?: any;
}

export function Upload() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  
  // Form state for current file
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isExplicit, setIsExplicit] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await uploadApi.track(formData);
      return data;
    },
    onSuccess: (data) => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === currentFileIndex
            ? { ...f, status: 'done', result: data }
            : f
        )
      );
      
      // Move to next file or complete
      if (currentFileIndex < files.length - 1) {
        const nextIndex = currentFileIndex + 1;
        setCurrentFileIndex(nextIndex);
        prepareFormForFile(files[nextIndex].file);
      }
    },
    onError: (error: any) => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === currentFileIndex
            ? { ...f, status: 'error', error: error.response?.data?.error || 'Upload failed' }
            : f
        )
      );
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const audioFiles = acceptedFiles.filter((file) =>
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name)
    );
    
    if (audioFiles.length === 0) return;
    
    const newFiles: UploadedFile[] = audioFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));
    
    setFiles((prev) => [...prev, ...newFiles]);
    
    // Prepare form for first file if this is the first upload
    if (files.length === 0 && newFiles.length > 0) {
      prepareFormForFile(newFiles[0].file);
    }
  }, [files.length]);

  const prepareFormForFile = (file: File) => {
    // Extract title from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setTitle(nameWithoutExt.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim());
    setGenre('');
    setIsPublic(true);
    setIsExplicit(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
    },
    multiple: true,
  });

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = () => setCoverPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !title) return;
    
    setFiles((prev) =>
      prev.map((f, i) =>
        i === currentFileIndex ? { ...f, status: 'uploading' } : f
      )
    );
    
    const formData = new FormData();
    formData.append('audio', files[currentFileIndex].file);
    formData.append('title', title);
    formData.append('genre', genre);
    formData.append('isPublic', String(isPublic));
    formData.append('isExplicit', String(isExplicit));
    
    if (coverFile) {
      // Upload cover first
      const coverFormData = new FormData();
      coverFormData.append('cover', coverFile);
      const { data: coverData } = await uploadApi.cover(coverFormData);
      formData.append('coverUrl', coverData.coverUrl);
    }
    
    uploadMutation.mutate(formData);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (index === currentFileIndex && files.length > 1) {
      const newIndex = index === 0 ? 0 : index - 1;
      setCurrentFileIndex(newIndex);
      prepareFormForFile(files[newIndex].file);
    }
  };

  // Auth check
  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <UploadIcon className="w-16 h-16 text-surface-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to upload</h2>
        <p className="text-surface-400 mb-6">
          Create an artist account to share your music with the world
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (!user?.isArtist) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <Music className="w-16 h-16 text-surface-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Become an Artist</h2>
        <p className="text-surface-400 mb-6">
          Upgrade to an artist account in settings to upload music
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="px-6 py-3 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  const allDone = files.length > 0 && files.every((f) => f.status === 'done');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Upload Music</h1>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-surface-600 hover:border-surface-500'
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className="w-12 h-12 text-surface-400 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">
          {isDragActive ? 'Drop your files here' : 'Drag & drop audio files'}
        </p>
        <p className="text-surface-400 text-sm">
          or click to browse • MP3, WAV, FLAC, AAC, OGG supported
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="font-bold text-lg">Files ({files.length})</h2>
          
          {files.map((file, index) => (
            <div
              key={index}
              className={clsx(
                'flex items-center gap-4 p-4 rounded-xl transition-colors',
                index === currentFileIndex
                  ? 'bg-surface-800 ring-2 ring-primary-500'
                  : 'bg-surface-800/50'
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center flex-shrink-0">
                {file.status === 'done' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : file.status === 'uploading' || file.status === 'processing' ? (
                  <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                ) : (
                  <Music className="w-5 h-5 text-surface-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.file.name}</p>
                <p className="text-sm text-surface-400">
                  {file.status === 'done'
                    ? 'Uploaded'
                    : file.status === 'uploading'
                    ? 'Uploading...'
                    : file.status === 'processing'
                    ? 'Processing audio...'
                    : file.status === 'error'
                    ? file.error
                    : `${(file.file.size / 1024 / 1024).toFixed(1)} MB`}
                </p>
              </div>
              
              {file.status === 'pending' && (
                <button
                  onClick={() => removeFile(index)}
                  className="p-2 text-surface-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Form */}
      {files.length > 0 && !allDone && (
        <div className="mt-8 bg-surface-800/50 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-6">
            Track Details ({currentFileIndex + 1} of {files.length})
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Cover Art */}
            <div>
              <label className="block text-sm font-medium mb-2">Cover Art</label>
              <label className="block aspect-square max-w-[200px] rounded-xl overflow-hidden bg-surface-700 cursor-pointer group relative">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                    <Image className="w-12 h-12 text-surface-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-sm font-medium">Change</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-surface-400 mt-2">
                Recommended: 500x500px
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Track title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select genre</option>
                  <option value="pop">Pop</option>
                  <option value="rock">Rock</option>
                  <option value="hip-hop">Hip Hop</option>
                  <option value="r&b">R&B</option>
                  <option value="electronic">Electronic</option>
                  <option value="jazz">Jazz</option>
                  <option value="classical">Classical</option>
                  <option value="country">Country</option>
                  <option value="folk">Folk</option>
                  <option value="indie">Indie</option>
                  <option value="metal">Metal</option>
                  <option value="punk">Punk</option>
                  <option value="reggae">Reggae</option>
                  <option value="latin">Latin</option>
                  <option value="world">World</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-5 h-5 rounded bg-surface-700 border-surface-600 text-primary-500 focus:ring-primary-500"
                  />
                  <span>Public</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExplicit}
                    onChange={(e) => setIsExplicit(e.target.checked)}
                    className="w-5 h-5 rounded bg-surface-700 border-surface-600 text-primary-500 focus:ring-primary-500"
                  />
                  <span>Explicit</span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!title || uploadMutation.isPending}
            className="mt-6 w-full py-4 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon className="w-5 h-5" />
                Upload Track
              </>
            )}
          </button>
        </div>
      )}

      {/* Success */}
      {allDone && (
        <div className="mt-8 text-center py-12 bg-surface-800/50 rounded-2xl">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">All tracks uploaded!</h2>
          <p className="text-surface-400 mb-6">
            Your music is being processed and will be available shortly
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setFiles([]);
                setCurrentFileIndex(0);
                setTitle('');
                setCoverFile(null);
                setCoverPreview(null);
              }}
              className="px-6 py-3 bg-surface-700 rounded-full font-semibold hover:bg-surface-600 transition-colors"
            >
              Upload More
            </button>
            <button
              onClick={() => navigate(`/artist/${user.username}`)}
              className="px-6 py-3 bg-primary-500 rounded-full font-semibold hover:bg-primary-600 transition-colors"
            >
              View Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
