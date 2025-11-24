const path = require('path');
const fs = require('fs');

// Load .env.local if it exists
let envVars = { NODE_ENV: 'production' };
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

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
    env: envVars,
    error_file: '/home/ubuntu/crawler-app/logs/crawler-error.log',
    out_file: '/home/ubuntu/crawler-app/logs/crawler-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

