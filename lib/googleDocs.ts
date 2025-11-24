import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';

interface DocumentContent {
  id: string;
  content: string;
}

/**
 * Initialize Google Docs API client using service account
 * Supports both file-based and environment variable-based service accounts
 */
function getGoogleDocsClient() {
  // Try environment variable first (for production deployments like Vercel)
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (serviceAccountJson) {
    try {
      const serviceAccount = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson)
        : serviceAccountJson;
      
      const auth = new google.auth.JWT(
        serviceAccount.client_email,
        undefined,
        serviceAccount.private_key,
        ['https://www.googleapis.com/auth/documents.readonly']
      );

      return google.docs({ version: 'v1', auth });
    } catch (error) {
      console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', error);
      throw new Error(`Failed to parse service account JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Fallback to file-based (for local development)
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountPath) {
    throw new Error('Either GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY environment variable must be set');
  }

  const fullPath = path.resolve(process.cwd(), serviceAccountPath);
  
  if (!fs.existsSync(fullPath)) {
    // Return a special error that can be caught gracefully
    const error = new Error(`Service account key file not found at: ${fullPath}`);
    (error as any).isMissingFile = true;
    throw error;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    undefined,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/documents.readonly']
  );

  return google.docs({ version: 'v1', auth });
}

/**
 * Fetch content from a Google Doc by ID
 */
export async function fetchGoogleDocContent(docId: string): Promise<string> {
  try {
    const docs = getGoogleDocsClient();
    const response = await docs.documents.get({
      documentId: docId,
    });

    const document = response.data;
    if (!document.body || !document.body.content) {
      return '';
    }

    // Extract text from document structure
    let text = '';
    
    function extractText(element: any): string {
      if (!element) return '';
      
      if (element.textRun) {
        return element.textRun.content || '';
      }
      
      if (element.paragraph) {
        if (element.paragraph.elements) {
          return element.paragraph.elements
            .map((el: any) => extractText(el))
            .join('');
        }
      }
      
      if (element.table) {
        // Handle tables - extract text from cells
        return element.table.tableRows
          .map((row: any) => 
            row.tableCells
              ?.map((cell: any) => 
                cell.content
                  ?.map((content: any) => extractText(content))
                  .join(' ') || ''
              )
              .join(' | ') || ''
          )
          .join('\n') || '';
      }
      
      if (element.elements) {
        return element.elements.map((el: any) => extractText(el)).join('');
      }
      
      return '';
    }

    text = document.body.content
      .map((element: any) => extractText(element))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();

    return text;
  } catch (error) {
    // Don't log here - let the processor handle it gracefully
    throw new Error(`Failed to fetch Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch content from all configured Google Docs
 */
export async function fetchAllSchoolDocuments(): Promise<DocumentContent[]> {
  const documents: DocumentContent[] = [];
  
  // Fetch full document (complete information)
  const fullDocId = process.env.GOOGLE_DOC_FULL_ID;
  if (fullDocId) {
    try {
      const content = await fetchGoogleDocContent(fullDocId);
      documents.push({ id: fullDocId, content });
      console.log(`Fetched full document (${content.length} chars)`);
    } catch (error) {
      console.error('Error fetching full document:', error);
    }
  }

  // Commented out - using full document instead
  // const feed2DocId = process.env.GOOGLE_DOC_FEED_2_ID;
  // if (feed2DocId) {
  //   try {
  //     const content = await fetchGoogleDocContent(feed2DocId);
  //     documents.push({ id: feed2DocId, content });
  //     console.log(`Fetched Information Feed 2 document (${content.length} chars)`);
  //   } catch (error) {
  //     console.error('Error fetching Information Feed 2 document:', error);
  //   }
  // }

  // Commented out test document - full document contains all this info
  // const testDocId = process.env.GOOGLE_DOC_TEST_ID;
  // if (testDocId) {
  //   try {
  //     const content = await fetchGoogleDocContent(testDocId);
  //     documents.push({ id: testDocId, content });
  //     console.log(`Fetched test document (${content.length} chars)`);
  //   } catch (error) {
  //     console.error('Error fetching test document:', error);
  //   }
  // }

  return documents;
}

