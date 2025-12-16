'use client';

import { useState, useRef } from 'react';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [counts, setCounts] = useState<{ pdfTexts: number; pages: number; external: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/upload-data');
      const data = await response.json();
      
      if (data.status === 'ok') {
        setCounts({
          pdfTexts: data.counts.pdfTexts || 0,
          pages: data.counts.pages || 0,
          external: data.counts.external || 0,
          total: data.total || 0,
        });
        setMessage(`Found ${data.total} files on server`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select files to upload');
      return;
    }

    setStatus('uploading');
    setMessage(`Uploading ${files.length} file(s)...`);

    try {
      const formData = new FormData();

      // Organize files by type
      for (const file of files) {
        const fileName = file.name.toLowerCase();
        let folder = 'pages'; // default

        // Determine folder based on filename
        if (fileName.includes('pdf') && (fileName.endsWith('.txt') || fileName.match(/_[a-f0-9]+\.txt$/))) {
          folder = 'pdf-texts';
        } else if (fileName.includes('external') || fileName.includes('wp-content') || fileName.includes('http')) {
          folder = 'external';
        }

        // Use folder path as key
        formData.append(`${folder}/${file.name}`, file);
      }

      const response = await fetch('/api/upload-data', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message);
        setFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Refresh counts
        await checkStatus();
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Upload failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Upload Data Files</h1>
          <p className="text-gray-600 mb-6">
            Upload your scraped data files (pdf-texts, pages, external) to Render server
          </p>

          <div className="space-y-6">
            {/* Status Check */}
            <div className="flex gap-2">
              <button
                onClick={checkStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Check Current Files
              </button>
            </div>

            {/* Current Files Display */}
            {counts && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Files on Server:</p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">PDF Texts:</span> {counts.pdfTexts}
                  </div>
                  <div>
                    <span className="font-semibold">Pages:</span> {counts.pages}
                  </div>
                  <div>
                    <span className="font-semibold">External:</span> {counts.external}
                  </div>
                  <div>
                    <span className="font-semibold">Total:</span> {counts.total}
                  </div>
                </div>
              </div>
            )}

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                accept=".txt,.html,.json"
              />
              
              {files.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Selected {files.length} file(s):
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 max-h-40 overflow-y-auto">
                    {files.map((file, idx) => (
                      <li key={idx}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || status === 'uploading'}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {status === 'uploading' ? 'Uploading...' : `Upload ${files.length} File(s)`}
            </button>

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

            {/* Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Instructions:</strong>
              </p>
              <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                <li>Select files from your local <code className="bg-yellow-100 px-1 rounded">data/scraped/</code> folder</li>
                <li>Upload files from: <code className="bg-yellow-100 px-1 rounded">pdf-texts/</code>, <code className="bg-yellow-100 px-1 rounded">pages/</code>, and <code className="bg-yellow-100 px-1 rounded">external/</code></li>
                <li>Files are automatically organized into the correct folders</li>
                <li>After uploading, go to <a href="/admin/migrate" className="underline font-semibold">Migration Page</a> to migrate to database</li>
              </ul>
            </div>

            {/* Quick Links */}
            <div className="flex gap-2 pt-4 border-t">
              <a
                href="/admin/migrate"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Go to Migration →
              </a>
              <a
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Back to Chat
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

