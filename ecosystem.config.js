module.exports = {
  apps: [{
    name: 'crawler',
    script: 'npx',
    args: 'tsx scripts/crawl-school-website.ts',
    cwd: '/home/ubuntu/crawler-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/home/ubuntu/crawler-app/logs/crawler-error.log',
    out_file: '/home/ubuntu/crawler-app/logs/crawler-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

