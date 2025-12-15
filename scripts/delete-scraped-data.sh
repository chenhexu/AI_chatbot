#!/bin/bash

# Script to delete all scraped data from the crawler
# This will delete all files in the data/scraped directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data/scraped"

echo "🗑️  Deleting all scraped data..."
echo "   Location: $DATA_DIR"
echo ""

# Check if directory exists
if [ ! -d "$DATA_DIR" ]; then
  echo "⚠️  Data directory does not exist: $DATA_DIR"
  echo "   Nothing to delete."
  exit 0
fi

# Count files before deletion
FILE_COUNT=$(find "$DATA_DIR" -type f | wc -l)
SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1)

echo "   Files to delete: $FILE_COUNT"
echo "   Total size: $SIZE"
echo ""
read -p "Are you sure you want to delete all scraped data? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Cancelled. No files deleted."
  exit 0
fi

# Delete all files and subdirectories
echo "   Deleting files..."
rm -rf "$DATA_DIR"/*

# Also delete subdirectories if they exist
rm -rf "$DATA_DIR"/pages 2>/dev/null
rm -rf "$DATA_DIR"/external 2>/dev/null
rm -rf "$DATA_DIR"/pdf 2>/dev/null
rm -rf "$DATA_DIR"/excel 2>/dev/null

# Delete index files
rm -f "$DATA_DIR"/crawl-index.json 2>/dev/null
rm -f "$DATA_DIR"/*.json 2>/dev/null

echo "✅ All scraped data deleted!"
echo "   The data directory structure will be recreated on next crawl."

