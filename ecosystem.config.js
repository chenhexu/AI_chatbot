module.exports = {
  apps: [{
    name: 'crawler',
    script: 'npm',
    args: 'run crawl',
    cwd: process.cwd(),
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/crawler-error.log',
    out_file: './logs/crawler-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

