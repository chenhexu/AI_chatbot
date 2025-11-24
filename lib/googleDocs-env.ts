// Alternative implementation that reads service account from environment variable
// Use this if you want to store the JSON as an environment variable instead of a file

import { google } from 'googleapis';

/**
 * Initialize Google Docs API client using service account from environment variable
 * Use this instead of getGoogleDocsClient() if storing JSON as env var
 */
export function getGoogleDocsClientFromEnv() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  let serviceAccount;
  try {
    // Try parsing as JSON string
    serviceAccount = typeof serviceAccountJson === 'string' 
      ? JSON.parse(serviceAccountJson)
      : serviceAccountJson;
  } catch (error) {
    throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    undefined,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/documents.readonly']
  );

  return google.docs({ version: 'v1', auth });
}

