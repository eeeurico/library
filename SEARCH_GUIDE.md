# Book Search API Integration Guide

## Current Implementation

Your library app now includes:

- ✅ Google Books API integration
- ✅ Open Library API integration
- ✅ ISBN DB API (partial - needs API key)
- ✅ Search by title, author, ISBN, or general query
- ✅ Add books directly to Google Sheets from search results

## Additional APIs to Consider

### 1. WorldCat Search API (Recommended)

**Why**: Largest library catalog in the world
**Setup**:

1. Register at https://www.oclc.org/developer/develop/web-services/worldcat-search-api.en.html
2. Add to your `.env.local`:
   ```
   WORLDCAT_API_KEY=your_api_key_here
   ```
3. Add to search function in `sheets.ts`:
   ```typescript
   // WorldCat search
   const worldcat = await fetch(
     `https://www.worldcat.org/webservices/catalog/search/worldcat/opensearch?q=${query}&wskey=${process.env.WORLDCAT_API_KEY}&format=json`
   )
   ```

### 2. ISBN DB API (Enhance current implementation)

**Setup**:

1. Get API key from https://isbndb.com/
2. Add to `.env.local`:
   ```
   ISBN_DB_API_KEY=your_api_key_here
   ```
3. Already partially implemented in your search function

### 3. Library of Congress API

**Why**: Authoritative US library data
**Implementation**:

```typescript
const loc = await fetch(`https://www.loc.gov/books/?q=${query}&fo=json`)
```

### 4. BookBrainz API

**Why**: Open-source, community-driven
**Implementation**:

```typescript
const bookbrainz = await fetch(
  `https://bookbrainz.org/ws-js/search?q=${query}&type=work`
)
```

## Environment Variables Needed

Add these to your `.env.local` file:

```
# Required (you should already have these)
GOOGLE_CLIENT_EMAIL=your_google_service_account_email
GOOGLE_PRIVATE_KEY=your_google_private_key
SHEET_ID=your_google_sheet_id

# Optional API Keys for enhanced search
WORLDCAT_API_KEY=your_worldcat_key
ISBN_DB_API_KEY=your_isbndb_key
```

## Usage

1. Navigate to `/search` in your app
2. Enter a book title, author name, or ISBN
3. Select search type (general, title, author, or ISBN)
4. Click "Add to Library" for any book you want to save
5. Books are automatically added to your Google Sheet

## Search Tips

- Use **ISBN** search for exact matches
- Use **Title** search for specific books
- Use **Author** search to find all books by an author
- Use **General** search for broad queries

## Next Steps

1. Get API keys for WorldCat and ISBN DB for better coverage
2. Consider adding book ratings from external sources
3. Add book categories/genres to your sheet
4. Implement book status tracking (read, want to read, currently reading)
