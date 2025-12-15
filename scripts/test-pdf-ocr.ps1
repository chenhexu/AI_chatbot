# PowerShell wrapper script to test PDF OCR with UTF-8 encoding
# This ensures French accents display correctly in the terminal

# Set console output to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# Run the TypeScript test script
npm run test-pdf-ocr









