'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BigChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  size: number;
  sizeFormatted: string;
  sourceId: string;
  preview: string;
}

interface DbStats {
  documents: number;
  chunks: number;
  averageChunkSize: number;
  sizeDistribution: { range: string; count: number }[];
  biggestChunks: BigChunk[];
}

interface SkippedFile {
  file: string;
  reason: string;
  size: number;
}

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [stats, setStats] = useState<{ documents: number; chunks: number } | null>(null);
  const [dedupeStatus, setDedupeStatus] = useState<'idle' | 'checking' | 'removing' | 'success' | 'error'>('idle');
  const [dedupeMessage, setDedupeMessage] = useState<string>('');
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [clearStatus, setClearStatus] = useState<'idle' | 'clearing' | 'success' | 'error'>('idle');
  const [clearMessage, setClearMessage] = useState<string>('');
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [showBigChunks, setShowBigChunks] = useState(false);
  const [skippedFiles, setSkippedFiles] = useState<SkippedFile[]>([]);

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
      
      // Also check for duplicates
      checkDuplicates();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checkDuplicates = async () => {
    setDedupeStatus('checking');
    try {
      const response = await fetch('/api/deduplicate');
      const data = await response.json();
      
      if (data.status === 'ok') {
        setDuplicateCount(data.totalDuplicateDocuments || 0);
        setDedupeMessage(data.message);
        setDedupeStatus('idle');
      }
    } catch (error) {
      setDedupeMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setDedupeStatus('error');
    }
  };

  const runDeduplication = async () => {
    setDedupeStatus('removing');
    setDedupeMessage('Removing duplicates...');

    try {
      const response = await fetch('/api/deduplicate', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && (data.status === 'success' || data.status === 'no_duplicates')) {
        setDedupeStatus('success');
        setDuplicateCount(0);
        setDedupeMessage(data.message);
        // Refresh stats
        await checkStatus();
      } else {
        setDedupeStatus('error');
        setDedupeMessage(data.error || data.message || 'Deduplication failed');
      }
    } catch (error) {
      setDedupeStatus('error');
      setDedupeMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearDatabase = async () => {
    if (!confirm('⚠️ This will DELETE ALL documents and chunks from the database. Are you sure?')) {
      return;
    }
    
    setClearStatus('clearing');
    setClearMessage('Clearing database...');

    try {
      const response = await fetch('/api/clear-database', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setClearStatus('success');
        setClearMessage(data.message);
        setStats({ documents: 0, chunks: 0 });
        setDuplicateCount(0);
        setDbStats(null);
      } else {
        setClearStatus('error');
        setClearMessage(data.error || 'Failed to clear database');
      }
    } catch (error) {
      setClearStatus('error');
      setClearMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checkBiggestChunks = async () => {
    setShowBigChunks(true);
    try {
      const response = await fetch('/api/db-stats');
      const data = await response.json();
      
      if (data.status === 'ok') {
        setDbStats(data);
      }
    } catch (error) {
      console.error('Failed to get stats:', error);
    }
  };

  const runMigration = async (force: boolean = false) => {
    setStatus('loading');
    setMessage('Starting migration... (check Render logs for progress)');
    setSkippedFiles([]);

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
        if (data.skipped && data.skipped.length > 0) {
          setSkippedFiles(data.skipped);
        }
      } else if (data.status === 'already_migrated') {
        setStatus('idle');
        setStats({ documents: data.documents, chunks: data.chunks });
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Migration failed');
        if (data.skipped && data.skipped.length > 0) {
          setSkippedFiles(data.skipped);
        }
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-800">Database Management</h1>
            <Link 
              href="/admin/upload"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
            >
              📤 Go to Upload
            </Link>
          </div>
          <p className="text-gray-600 mb-6">
            Manage documents and chunks in PostgreSQL database
          </p>

          <div className="space-y-4">
            {/* Status Check */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={checkStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Check Status
              </button>
              <button
                onClick={checkDuplicates}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Check Duplicates
              </button>
              <button
                onClick={checkBiggestChunks}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
              >
                📊 Check Biggest Chunks
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

            {/* Biggest Chunks Display */}
            {showBigChunks && dbStats && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-teal-800 mb-2">📊 Chunk Statistics</h3>
                <p className="text-sm text-teal-700 mb-2">
                  Average chunk size: <strong>{dbStats.averageChunkSize.toLocaleString()} bytes</strong>
                </p>
                
                {/* Size Distribution */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-teal-600 mb-1">Size Distribution:</p>
                  <div className="flex flex-wrap gap-2">
                    {dbStats.sizeDistribution.map((d, i) => (
                      <span key={i} className="text-xs bg-teal-100 px-2 py-1 rounded">
                        {d.range}: {d.count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Biggest Chunks */}
                <p className="text-xs font-medium text-teal-600 mb-1">Top 5 Biggest Chunks:</p>
                <div className="space-y-2">
                  {dbStats.biggestChunks.map((chunk, i) => (
                    <div key={chunk.id} className="bg-white rounded p-2 text-xs border border-teal-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-teal-800">
                          #{i + 1}: {chunk.sizeFormatted}
                        </span>
                        <span className="text-teal-500">
                          Doc #{chunk.documentId}, Chunk #{chunk.chunkIndex}
                        </span>
                      </div>
                      <p className="text-gray-500 truncate" title={chunk.sourceId}>
                        Source: {chunk.sourceId.substring(0, 60)}...
                      </p>
                      <p className="text-gray-400 mt-1 truncate">
                        {chunk.preview}
                      </p>
                    </div>
                  ))}
                </div>
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
                    : status === 'loading'
                    ? 'bg-yellow-50 text-yellow-800'
                    : 'bg-blue-50 text-blue-800'
                }`}
              >
                {status === 'loading' && <span className="animate-pulse">⏳ </span>}
                {message}
              </div>
            )}

            {/* Skipped Files Display */}
            {skippedFiles.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-orange-800 mb-2">
                  ⚠️ Skipped {skippedFiles.length} file(s) due to size:
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {skippedFiles.map((f, i) => (
                    <div key={i} className="text-xs bg-white rounded p-2 border border-orange-100">
                      <span className="font-medium text-orange-700">{f.file.substring(0, 50)}...</span>
                      <span className="text-orange-500 ml-2">
                        ({(f.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <p className="text-orange-400 truncate">{f.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicate Detection */}
            {duplicateCount !== null && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-purple-800">
                    Duplicate Documents: {duplicateCount}
                  </p>
                  {duplicateCount > 0 && (
                    <button
                      onClick={runDeduplication}
                      disabled={dedupeStatus === 'removing' || dedupeStatus === 'checking'}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {dedupeStatus === 'removing' ? 'Removing...' : 'Remove Duplicates'}
                    </button>
                  )}
                </div>
                {dedupeMessage && (
                  <p className={`text-sm ${
                    dedupeStatus === 'success' ? 'text-green-700' :
                    dedupeStatus === 'error' ? 'text-red-700' :
                    'text-purple-700'
                  }`}>
                    {dedupeMessage}
                  </p>
                )}
              </div>
            )}

            {/* Clear Database */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-800">Clear Database</p>
                  <p className="text-xs text-red-600">Delete all documents and chunks</p>
                </div>
                <button
                  onClick={clearDatabase}
                  disabled={clearStatus === 'clearing'}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {clearStatus === 'clearing' ? 'Clearing...' : '🗑️ Clear Database'}
                </button>
              </div>
              {clearMessage && (
                <p className={`text-sm mt-2 ${
                  clearStatus === 'success' ? 'text-green-700' :
                  clearStatus === 'error' ? 'text-red-700' :
                  'text-red-600'
                }`}>
                  {clearMessage}
                </p>
              )}
            </div>

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
