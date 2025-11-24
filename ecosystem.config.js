module.exports = {
  apps: [{
    name: 'crawler',
    script: '/home/ubuntu/crawler-app/start-crawler.sh',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: '/home/ubuntu/crawler-app/logs/crawler-error.log',
    out_file: '/home/ubuntu/crawler-app/logs/crawler-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

