#!/bin/bash
cd /home/ubuntu/crawler-app
source .env.local 2>/dev/null || true
npm run crawl

