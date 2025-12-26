'use client';

import { useState, useEffect } from 'react';

interface EmbeddingStats {
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
}

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [stats, setStats] = useState<{ documents: number; chunks: number } | null>(null);
  const [dedupeStatus, setDedupeStatus] = useState<'idle' | 'checking' | 'removing' | 'success' | 'error'>('idle');
  const [dedupeMessage, setDedupeMessage] = useState<string>('');
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  
  // Embedding state
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle');
  const [embeddingMessage, setEmbeddingMessage] = useState<string>('');
  const [embeddingProgress, setEmbeddingProgress] = useState<{ processed: number; remaining: number } | null>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/migrate');
      const data = await response.json();
      console.log('Status response:', data); // Debug log
      
      if (data.status === 'ready') {
        setStats({ documents: data.documents, chunks: data.chunks });
        setMessage(data.message);
        
        // Update embedding stats - if stats are zeros but we have chunks, fix it
        if (data.embeddings) {
          const embStats = data.embeddings;
          // If total is 0 but we have chunks, use chunk count
          if (embStats.total === 0 && data.chunks > 0) {
            setEmbeddingStats({
              total: data.chunks,
              withEmbedding: 0,
              withoutEmbedding: data.chunks,
            });
          } else {
            setEmbeddingStats(embStats);
          }
        } else if (data.chunks > 0) {
          // No embedding stats but we have chunks - assume none have embeddings
          setEmbeddingStats({
            total: data.chunks,
            withEmbedding: 0,
            withoutEmbedding: data.chunks,
          });
        }
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

      if (response.ok && data.status === 'success') {
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

  const generateEmbeddings = async () => {
    setEmbeddingStatus('generating');
    setEmbeddingMessage('Generating embeddings...');

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'embeddings', batchSize: 10 }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmbeddingProgress({ processed: data.processed, remaining: data.remaining });
        setEmbeddingMessage(data.message);
        
        if (data.status === 'complete') {
          setEmbeddingStatus('complete');
          setEmbeddingStats({
            total: data.total,
            withEmbedding: data.total,
            withoutEmbedding: 0,
          });
        } else if (data.status === 'in_progress') {
          // Continue generating
          setEmbeddingStats({
            total: data.total,
            withEmbedding: data.withEmbedding,
            withoutEmbedding: data.remaining,
          });
          // Auto-continue after a short delay
          setTimeout(() => generateEmbeddings(), 500);
        } else {
          setEmbeddingStatus('error');
          setEmbeddingMessage(data.error || 'Embedding generation failed');
        }
      } else {
        setEmbeddingStatus('error');
        setEmbeddingMessage(data.error || data.message || 'Embedding generation failed');
      }
    } catch (error) {
      setEmbeddingStatus('error');
      setEmbeddingMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Auto-check status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const embeddingPercentage = embeddingStats && embeddingStats.total > 0
    ? Math.round((embeddingStats.withEmbedding / embeddingStats.total) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Database Migration</h1>
          <p className="text-gray-600 mb-6">
            Migrate documents from filesystem to PostgreSQL database and generate embeddings
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
              <button
                onClick={checkDuplicates}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Check Duplicates
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

            {/* Embedding Generation Section */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-teal-800 mb-2">🧠 Semantic Embeddings</h3>
              <p className="text-sm text-teal-700 mb-3">
                Generate embeddings for semantic search (required for accurate query matching)
              </p>
              
              {/* Embedding Stats */}
              {(embeddingStats || stats) && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-teal-700 mb-1">
                    <span>
                      Progress: {embeddingStats?.withEmbedding || 0} / {embeddingStats?.total || stats?.chunks || 0} chunks
                    </span>
                    <span>{embeddingPercentage}%</span>
                  </div>
                  <div className="w-full bg-teal-200 rounded-full h-2">
                    <div 
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${embeddingPercentage}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Embedding Message */}
              {embeddingMessage && (
                <p className={`text-sm mb-3 ${
                  embeddingStatus === 'complete' ? 'text-green-700' :
                  embeddingStatus === 'error' ? 'text-red-700' :
                  'text-teal-700'
                }`}>
                  {embeddingMessage}
                </p>
              )}
              
              {/* Generate Button */}
              <button
                onClick={generateEmbeddings}
                disabled={
                  embeddingStatus === 'generating' || 
                  (embeddingStats && embeddingStats.withoutEmbedding === 0 && embeddingStats.total > 0) ||
                  !stats || stats.chunks === 0
                }
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {embeddingStatus === 'generating' 
                  ? `Generating... (${embeddingProgress?.processed || 0} processed, ${embeddingProgress?.remaining || 0} remaining)` 
                  : embeddingStats && embeddingStats.withoutEmbedding === 0 && embeddingStats.total > 0
                    ? 'All Embeddings Generated ✓' 
                    : stats && stats.chunks > 0
                      ? `Generate Embeddings (${embeddingStats?.withoutEmbedding || stats.chunks} remaining)`
                      : 'No chunks to embed'}
              </button>
              
              {embeddingStats?.withoutEmbedding === 0 && embeddingStats.total > 0 && (
                <p className="text-sm text-green-700 mt-2">
                  ✅ Semantic search is ready! All {embeddingStats.total} chunks have embeddings.
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
                <strong>Note:</strong> After migration, click "Generate Embeddings" to enable semantic search.
                This allows the chatbot to understand questions even when they use different words than the documents.
                For example: "quand l'école est ouvert" will match "Il a ouvert ses portes à l'automne 1988".
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
