'use client';

import { useState, useEffect } from 'react';

interface CrawlerStatus {
  isRunning: boolean;
  pagesCrawled: number;
  filesDownloaded: number;
  linksFound: number;
  errors: number;
  currentUrl?: string;
  queueLength?: number;
}

export default function CrawlerAdminPage() {
  const [status, setStatus] = useState<CrawlerStatus>({
    isRunning: false,
    pagesCrawled: 0,
    filesDownloaded: 0,
    linksFound: 0,
    errors: 0,
  });
  const [config, setConfig] = useState({
    maxPages: 2000,
    maxDepth: 8,
    rateLimitMs: 1000,
    skipCrawled: false,
  });
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Poll for status updates
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/crawler/status');
        const data = await res.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const startCrawler = async () => {
    try {
      const res = await fetch('/api/crawler/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(prev => ({ ...prev, isRunning: true }));
        setLogs(prev => [...prev, 'Crawler started']);
      } else {
        alert('Failed to start crawler: ' + data.error);
      }
    } catch (error) {
      alert('Error starting crawler: ' + error);
    }
  };

  const stopCrawler = async () => {
    try {
      const res = await fetch('/api/crawler/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus(prev => ({ ...prev, isRunning: false }));
        setLogs(prev => [...prev, 'Crawler stopped']);
      }
    } catch (error) {
      alert('Error stopping crawler: ' + error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Crawler Admin</h1>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Max Pages: {config.maxPages}
            </label>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={config.maxPages}
              onChange={(e) => setConfig({ ...config, maxPages: parseInt(e.target.value) })}
              className="w-full"
              disabled={status.isRunning}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Max Depth: {config.maxDepth}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={config.maxDepth}
              onChange={(e) => setConfig({ ...config, maxDepth: parseInt(e.target.value) })}
              className="w-full"
              disabled={status.isRunning}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Rate Limit: {config.rateLimitMs}ms ({1000 / config.rateLimitMs} req/sec)
            </label>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={config.rateLimitMs}
              onChange={(e) => setConfig({ ...config, rateLimitMs: parseInt(e.target.value) })}
              className="w-full"
              disabled={status.isRunning}
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="skipCrawled"
              checked={config.skipCrawled}
              onChange={(e) => setConfig({ ...config, skipCrawled: e.target.checked })}
              className="mr-2"
              disabled={status.isRunning}
            />
            <label htmlFor="skipCrawled" className="text-sm font-medium">
              Skip already-crawled pages
            </label>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-4">
          <button
            onClick={startCrawler}
            disabled={status.isRunning}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Start Crawler
          </button>
          <button
            onClick={stopCrawler}
            disabled={!status.isRunning}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Stop Crawler
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Status</div>
            <div className={`text-lg font-bold ${status.isRunning ? 'text-green-600' : 'text-gray-400'}`}>
              {status.isRunning ? 'Running' : 'Stopped'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Pages Crawled</div>
            <div className="text-lg font-bold">{status.pagesCrawled}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Files Downloaded</div>
            <div className="text-lg font-bold">{status.filesDownloaded}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Links Found</div>
            <div className="text-lg font-bold">{status.linksFound}</div>
          </div>
        </div>
        {status.currentUrl && (
          <div className="mt-4">
            <div className="text-sm text-gray-600">Current URL</div>
            <div className="text-sm font-mono break-all">{status.currentUrl}</div>
          </div>
        )}
        {status.queueLength !== undefined && (
          <div className="mt-2">
            <div className="text-sm text-gray-600">Queue Length</div>
            <div className="text-sm font-bold">{status.queueLength}</div>
          </div>
        )}
        {status.errors > 0 && (
          <div className="mt-2">
            <div className="text-sm text-red-600">Errors: {status.errors}</div>
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Logs</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}

