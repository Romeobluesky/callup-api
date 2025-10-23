module.exports = {
  apps: [{
    name: 'callup-api',
    script: 'node_modules/.bin/next',
    args: 'start -H 0.0.0.0 -p 3020',
    cwd: '/home/callup-api',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3020
    },
    env_file: '/home/callup-api/.env',
    error_file: '/home/callup-api/logs/err.log',
    out_file: '/home/callup-api/logs/out.log',
    time: true
  }]
}
