'use client';

import { useState } from 'react';

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [stats, setStats] = useState<{ documents: number; chunks: number } | null>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/migrate');
      const data = await response.json();
      
      if (data.status === 'ready') {
        setStats({ documents: data.documents, chunks: data.chunks });
        setMessage(data.message);
      } else {
        setMessage(data.message || data.error || 'Unknown status');
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const runMigration = async (force: boolean = false) => {
    setStatus('loading');
    setMessage('Starting migration...');

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setStatus('success');
        setStats({ documents: data.documents, chunks: data.chunks });
        setMessage(data.message);
      } else if (data.status === 'already_migrated') {
        setStatus('idle');
        setStats({ documents: data.documents, chunks: data.chunks });
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Migration failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Database Migration</h1>
          <p className="text-gray-600 mb-6">
            Migrate documents from filesystem to PostgreSQL database
          </p>

          <div className="space-y-4">
            {/* Status Check */}
            <div className="flex gap-2">
              <button
                onClick={checkStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Check Status
              </button>
            </div>

            {/* Stats Display */}
            {stats && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Current Database Status:</p>
                <p className="text-lg font-semibold text-gray-800">
                  {stats.documents} documents, {stats.chunks} chunks
                </p>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div
                className={`rounded-lg p-4 ${
                  status === 'success'
                    ? 'bg-green-50 text-green-800'
                    : status === 'error'
                    ? 'bg-red-50 text-red-800'
                    : 'bg-blue-50 text-blue-800'
                }`}
              >
                {message}
              </div>
            )}

            {/* Migration Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => runMigration(false)}
                disabled={status === 'loading'}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Migrating...' : 'Run Migration'}
              </button>
              <button
                onClick={() => runMigration(true)}
                disabled={status === 'loading'}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Force Re-migrate
              </button>
            </div>

            {/* Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This migration runs on the Render server, so it will migrate
                data from the server's filesystem (if available) to the database. If you don't have
                data on the server, you'll need to upload it first or run the migration locally
                with access to your data folder.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

