import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload as UploadIcon, Music, X, Image, Loader2, CheckCircle } from 'lucide-react';
import { uploadApi, genresApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import clsx from 'clsx';

// Extended audio format support
const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.opus', '.webm', '.aiff', '.wma'
];

const SUPPORTED_AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
  'audio/ogg', 'audio/vorbis', 'audio/opus', 'audio/webm', 'audio/aiff',
  'audio/x-aiff', 'audio/x-ms-wma'
];

// Predefined genres
const PREDEFINED_GENRES = [
  'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical',
  'Country', 'Folk', 'Indie', 'Metal', 'Punk', 'Reggae', 'Latin',
  'World', 'Blues', 'Soul', 'Funk', 'Disco', 'House', 'Techno',
  'Dubstep', 'Drum & Bass', 'Trap', 'Lo-Fi', 'Ambient', 'Gospel',
  'Afrobeat', 'K-Pop', 'J-Pop', 'Dancehall', 'Ska', 'Grunge'
];

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  result?: any;
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:audio/mpeg;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Helper to get audio duration
const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.URL.revokeObjectURL(audio.src);
      resolve(Math.round(audio.duration));
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
};

export function Upload() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  
  // Form state for current file
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [showCustomGenreInput, setShowCustomGenreInput] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isExplicit, setIsExplicit] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  // Fetch custom genres
  const { data: genresData } = useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      try {
        const { data } = await genresApi.getAll();
        return data;
      } catch {
        return { predefined: [], custom: [] };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: {
      audio: string;
      audioMimeType: string;
      audioFileName: string;
      title: string;
      genre?: string;
      isPublic?: boolean;
      isExplicit?: boolean;
      coverUrl?: string;
      duration?: number;
    }) => {
      const { data: result } = await uploadApi.track(data);
      return result;
    },
    onSuccess: (data) => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === currentFileIndex
            ? { ...f, status: 'done', result: data }
            : f
        )
      );
      setUploadProgress('');
      
      // Move to next file or complete
      if (currentFileIndex < files.length - 1) {
        const nextIndex = currentFileIndex + 1;
        setCurrentFileIndex(nextIndex);
        prepareFormForFile(files[nextIndex].file);
      }
    },
    onError: (error: any) => {
      const errorData = error.response?.data;
      let errorMessage = errorData?.error || 'Upload failed';
      
      // Add tip if available
      if (errorData?.tip) {
        errorMessage += `. ${errorData.tip}`;
      }
      // Add size info if available
      if (errorData?.currentSizeMB && errorData?.maxSizeMB) {
        errorMessage += ` (Your file: ${errorData.currentSizeMB}MB, Max: ${errorData.maxSizeMB}MB)`;
      }
      
      setFiles((prev) =>
        prev.map((f, i) =>
          i === currentFileIndex
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      );
      setUploadProgress('');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('Files dropped:', acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    const audioFiles = acceptedFiles.filter((file) => {
      const mimeMatch = SUPPORTED_AUDIO_MIMES.includes(file.type);
      const extMatch = SUPPORTED_AUDIO_EXTENSIONS.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      console.log(`File ${file.name}: mimeMatch=${mimeMatch}, extMatch=${extMatch}, type=${file.type}`);
      return mimeMatch || extMatch;
    });
    
    console.log('Audio files after filter:', audioFiles.length);
    
    if (audioFiles.length === 0) {
      alert('No valid audio files found. Supported formats: MP3, WAV, FLAC, AAC, M4A, OGG');
      return;
    }
    
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
    setCustomGenre('');
    setShowCustomGenreInput(false);
    setIsPublic(true);
    setIsExplicit(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejectedFiles) => {
      console.log('Files rejected:', rejectedFiles);
      const reasons = rejectedFiles.map(f => 
        `${f.file.name}: ${f.errors.map(e => e.message).join(', ')}`
      ).join('\n');
      alert(`Some files were rejected:\n${reasons}`);
    },
    accept: {
      'audio/*': SUPPORTED_AUDIO_EXTENSIONS,
    },
    multiple: true,
    // No file size limit - self-hosted backend can handle large files
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
    
    const currentFile = files[currentFileIndex];
    
    setFiles((prev) =>
      prev.map((f, i) =>
        i === currentFileIndex ? { ...f, status: 'uploading' } : f
      )
    );
    
    try {
      setUploadProgress('Reading audio file...');
      
      // Convert audio to base64
      const audioBase64 = await fileToBase64(currentFile.file);
      
      setUploadProgress('Getting duration...');
      // Get audio duration
      const duration = await getAudioDuration(currentFile.file);
      
      // Upload cover if exists
      let coverUrl: string | undefined;
      if (coverFile) {
        setUploadProgress('Uploading cover art...');
        const coverBase64 = await fileToBase64(coverFile);
        const { data: coverData } = await uploadApi.cover({
          image: coverBase64,
          mimeType: coverFile.type,
        });
        coverUrl = coverData.coverUrl;
      }
      
      setUploadProgress('Uploading track...');
      
      // Determine the actual genre to use
      const finalGenre = showCustomGenreInput && customGenre.trim() 
        ? customGenre.trim() 
        : genre;
      
      // If it's a custom genre, create it first
      if (showCustomGenreInput && customGenre.trim()) {
        try {
          await genresApi.create(customGenre.trim());
        } catch {
          // Genre might already exist, that's ok
        }
      }
      
      // Upload track
      uploadMutation.mutate({
        audio: audioBase64,
        audioMimeType: currentFile.file.type || 'audio/mpeg',
        audioFileName: currentFile.file.name,
        title,
        genre: finalGenre || undefined,
        isPublic,
        isExplicit,
        coverUrl,
        duration,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === currentFileIndex
            ? { ...f, status: 'error', error: 'Failed to process file' }
            : f
        )
      );
      setUploadProgress('');
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (index === currentFileIndex && files.length > 1) {
      const newIndex = index === 0 ? 0 : index - 1;
      setCurrentFileIndex(newIndex);
      if (files[newIndex]) {
        prepareFormForFile(files[newIndex].file);
      }
    }
  };

  const handleGenreChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustomGenreInput(true);
      setGenre('');
    } else {
      setShowCustomGenreInput(false);
      setCustomGenre('');
      setGenre(value);
    }
  };

  // Combine predefined and custom genres
  const allGenres = [
    ...PREDEFINED_GENRES,
    ...(genresData?.custom?.map((g: any) => g.name) || [])
  ].filter((v, i, a) => a.indexOf(v) === i).sort();

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
      <h1 className="text-3xl font-bold mb-2">Upload Music</h1>
      <p className="text-surface-400 mb-8">
        Upload your music in any format • Supported: MP3, WAV, FLAC, AAC, M4A, OGG, AIFF, WMA
      </p>

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
          or click to browse • All major audio formats supported
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
                    ? 'Uploaded successfully!'
                    : file.status === 'uploading'
                    ? uploadProgress || 'Uploading...'
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
                Recommended: 500x500px • JPEG, PNG, WebP
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
                {!showCustomGenreInput ? (
                  <select
                    value={genre}
                    onChange={(e) => handleGenreChange(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select genre</option>
                    {allGenres.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    <option value="__custom__">➕ Add custom genre...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customGenre}
                      onChange={(e) => setCustomGenre(e.target.value)}
                      placeholder="Enter your genre name"
                      className="flex-1 px-4 py-3 bg-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setShowCustomGenreInput(false);
                        setCustomGenre('');
                      }}
                      className="px-4 py-3 bg-surface-600 rounded-lg hover:bg-surface-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-surface-400 mt-1">
                  Can't find your genre? Select "Add custom genre" to create your own!
                </p>
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
            disabled={!title || uploadMutation.isPending || files[currentFileIndex]?.status === 'uploading'}
            className="mt-6 w-full py-4 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadMutation.isPending || files[currentFileIndex]?.status === 'uploading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadProgress || 'Uploading...'}
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
            Your music is now live and ready to stream
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setFiles([]);
                setCurrentFileIndex(0);
                setTitle('');
                setGenre('');
                setCustomGenre('');
                setShowCustomGenreInput(false);
                setCoverFile(null);
                setCoverPreview(null);
              }}
              className="px-6 py-3 bg-surface-700 rounded-full font-semibold hover:bg-surface-600 transition-colors"
            >
              Upload More
            </button>
            <button
              onClick={() => navigate(`/artist/${user?.username}`)}
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
