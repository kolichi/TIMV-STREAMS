// PM2 Ecosystem Configuration for Izwei Music Backend
// This file configures PM2 process manager for production

module.exports = {
  apps: [
    {
      name: 'izwei-music-api',
      script: 'dist/index.js',
      cwd: '/opt/izwei-music',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      // Logs
      error_file: '/opt/izwei-music/logs/error.log',
      out_file: '/opt/izwei-music/logs/out.log',
      log_file: '/opt/izwei-music/logs/combined.log',
      time: true,
      
      // Auto-restart
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Health check
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
    },
  ],
};
