import * as dotenv from 'dotenv';
import { FileProcessor } from './lib/documentProcessors/fileProcessor';

dotenv.config({ path: '.env.local' });

const scrapedDataFolder = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
const scrapedFiles = FileProcessor.getAvailableFiles(scrapedDataFolder);

console.log(`Found ${scrapedFiles.length} files total\n`);

const pages = scrapedFiles.filter(f => f.category === 'pages');
const pdfs = scrapedFiles.filter(f => f.category === 'pdfs');

console.log(`Pages: ${pages.length}`);
console.log(`PDFs: ${pdfs.length}\n`);

console.log('First 5 page files:');
pages.slice(0, 5).forEach(f => {
  console.log(`  - ${f.path} (category: ${f.category})`);
  console.log(`    ID would be: file://${f.path}`);
  console.log(`    Ends with .txt: ${f.path.endsWith('.txt')}`);
  console.log(`    Includes /pages/: ${f.path.includes('/pages/')}`);
  console.log(`    Includes \\pages\\: ${f.path.includes('\\pages\\')}`);
  console.log('');
});

