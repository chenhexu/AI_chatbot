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
  chars?: number;
}

interface MigrationResult {
  skippedDocuments: SkippedFile[];
  skippedChunks: number;
  splitChunks: number;
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
  const [skippedChunksCount, setSkippedChunksCount] = useState<number>(0);
  const [splitChunksCount, setSplitChunksCount] = useState<number>(0);
  const [classifyStatus, setClassifyStatus] = useState<'idle' | 'checking' | 'classifying' | 'success' | 'error'>('idle');
  const [classifyMessage, setClassifyMessage] = useState<string>('');
  const [classifyStats, setClassifyStats] = useState<{ total: number; classified: number; unclassified: number; percentage: number } | null>(null);

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
      
      // Also check for duplicates and classification
      checkDuplicates();
      checkClassificationStatus();
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

  const checkClassificationStatus = async () => {
    setClassifyStatus('checking');
    try {
      const response = await fetch('/api/classify-chunks');
      const data = await response.json();
      
      if (data.status === 'ok') {
        setClassifyStats({
          total: data.total,
          classified: data.classified,
          unclassified: data.unclassified,
          percentage: data.percentage,
        });
        setClassifyMessage(`${data.classified}/${data.total} chunks classified (${data.percentage}%)`);
        setClassifyStatus('idle');
      } else {
        setClassifyStatus('error');
        setClassifyMessage(data.error || 'Failed to check status');
      }
    } catch (error) {
      setClassifyStatus('error');
      setClassifyMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const runClassification = async () => {
    setClassifyStatus('classifying');
    setClassifyMessage('Classifying chunks... (this may take a while)');

    try {
      const response = await fetch('/api/classify-chunks', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setClassifyStatus('success');
        setClassifyMessage(data.message);
        // Refresh status
        await checkClassificationStatus();
      } else {
        setClassifyStatus('error');
        setClassifyMessage(data.error || data.message || 'Classification failed');
      }
    } catch (error) {
      setClassifyStatus('error');
      setClassifyMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const runMigration = async (force: boolean = false) => {
    setStatus('loading');
    setMessage('Starting migration... (check Render logs for progress)');
    setSkippedFiles([]);
    setSkippedChunksCount(0);
    setSplitChunksCount(0);

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
        if (data.skippedDocuments && data.skippedDocuments.length > 0) {
          setSkippedFiles(data.skippedDocuments);
        }
        if (data.skippedChunks) {
          setSkippedChunksCount(data.skippedChunks);
        }
        if (data.splitChunks) {
          setSplitChunksCount(data.splitChunks);
        }
        // Check classification status after migration
        checkClassificationStatus();
      } else if (data.status === 'already_migrated') {
        setStatus('idle');
        setStats({ documents: data.documents, chunks: data.chunks });
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Migration failed');
        if (data.skippedDocuments && data.skippedDocuments.length > 0) {
          setSkippedFiles(data.skippedDocuments);
        }
        if (data.skippedChunks) {
          setSkippedChunksCount(data.skippedChunks);
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
              <button
                onClick={checkClassificationStatus}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
              >
                🧠 Check Classification
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
                          #{i + 1}: {chunk.size.toLocaleString()} characters
                        </span>
                        <span className="text-teal-500">
                          Doc #{chunk.documentId}, Chunk #{chunk.chunkIndex}
                        </span>
                      </div>
                      <p className="text-gray-600 break-all whitespace-normal">
                        <span className="text-gray-500">Source:</span> {chunk.sourceId}
                      </p>
                      <p className="text-gray-400 mt-1 break-words whitespace-normal">
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

            {/* Migration Stats Display */}
            {(skippedFiles.length > 0 || skippedChunksCount > 0 || splitChunksCount > 0) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-orange-800 mb-2">
                  📊 Migration Details:
                </p>
                
                {/* Summary stats */}
                <div className="flex flex-wrap gap-2 mb-2 text-xs">
                  {splitChunksCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      🔪 Split {splitChunksCount} large chunks
                    </span>
                  )}
                  {skippedChunksCount > 0 && (
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                      ⚠️ Skipped {skippedChunksCount} chunks (too large)
                    </span>
                  )}
                  {skippedFiles.length > 0 && (
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                      ❌ Failed {skippedFiles.length} documents
                    </span>
                  )}
                </div>
                
                {/* Failed documents list */}
                {skippedFiles.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
                    <p className="text-xs font-medium text-orange-600">Failed documents:</p>
                    {skippedFiles.map((f, i) => (
                      <div key={i} className="text-xs bg-white rounded p-2 border border-orange-100">
                        <span className="font-medium text-orange-700 break-all">{f.file}</span>
                        <span className="text-orange-500 ml-2">
                          ({(f.size / 1024 / 1024).toFixed(2)} MB{f.chars ? ` / ${f.chars.toLocaleString()} chars` : ''})
                        </span>
                        <p className="text-orange-400 truncate">{f.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
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

            {/* Chunk Classification */}
            {(classifyStats || classifyStatus !== 'idle') && (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-pink-800">
                      Chunk Classification
                    </p>
                    {classifyStats && (
                      <p className="text-xs text-pink-600 mt-1">
                        {classifyStats.classified}/{classifyStats.total} classified ({classifyStats.percentage}%)
                        {classifyStats.unclassified > 0 && ` - ${classifyStats.unclassified} remaining`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={runClassification}
                    disabled={classifyStatus === 'classifying' || classifyStatus === 'checking'}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {classifyStatus === 'classifying' ? 'Classifying...' : '🧠 Classify Chunks'}
                  </button>
                </div>
                {classifyMessage && (
                  <p className={`text-sm ${
                    classifyStatus === 'success' ? 'text-green-700' :
                    classifyStatus === 'error' ? 'text-red-700' :
                    'text-pink-700'
                  }`}>
                    {classifyMessage}
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
