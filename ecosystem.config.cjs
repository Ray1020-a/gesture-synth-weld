// PM2 process config — serves the production build (dist/) on port 3007.
// .cjs (not .js): package.json is "type": "module", and PM2 loads ecosystem
// files with require().
//
// Deploy:
//   npm ci
//   npm run build
//   pm2 start ecosystem.config.cjs
//   pm2 save
module.exports = {
  apps: [
    {
      name: 'gesture-synth-weld',
      cwd: __dirname,
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 3007 --strictPort',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
