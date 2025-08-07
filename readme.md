# Khabar Online Crawler

A Node.js web crawler for extracting news articles from Khabar Online (khabaronline.ir) using their sitemap structure. The crawler systematically processes articles by Jalaali (Persian) calendar dates and stores them in JSON format.

## Features

- **Date-based crawling**: Processes articles chronologically using Jalaali calendar
- **Duplicate prevention**: Tracks processed articles to avoid duplicates
- **Rate limiting**: Built-in delays and 429 error handling
- **Checkpoint system**: Resumes from last processed date
- **Comprehensive data extraction**: Extracts title, content, date, topic, publisher, and images
- **Robust error handling**: Graceful handling of network errors and parsing failures

## Installation

```bash
npm install
```

## Dependencies

- `axios` - HTTP client for API requests
- `cheerio` - Server-side HTML parsing
- `xml2js` - XML to JavaScript object converter
- `jalaali-js` - Jalaali (Persian) calendar conversion
- `fs` & `path` - File system operations

## Usage

```bash
node complete.js
```

The crawler will:
1. Load existing data and checkpoint (if available)
2. Start from the last processed date or default start date
3. Fetch sitemap for each date
4. Extract article data from each URL
5. Save progress continuously with checkpoints

## Configuration

Edit the following variables in `complete.js`:

```javascript
// Start date (if no checkpoint exists)
return { jy: 1388, jm: 2, jd: 31 };

// End date
const endDate = { jy: 1403, jm: 3, jd: 1 };

// Delay between requests (milliseconds)
function randomDelay(min = 200, max = 400)
```

## Data Structure

Articles are stored in `khabaronline_all.json` with the following structure:

```json
{
  "year": {
    "month": {
      "day": [
        {
          "id": "article_id",
          "url": "article_url",
          "title": "article_title",
          "content": "article_content",
          "date": {
            "year": "1403",
            "month": "فروردین",
            "day": "15",
            "time": "14:30"
          },
          "topic": {
            "maintopic": "سیاسی",
            "childnews": "اخبار داخلی"
          },
          "publisher": "publisher_name",
          "images": ["image_url1", "image_url2"]
        }
      ]
    }
  }
}
```

## Files

- `complete.js` - Main crawler script
- `khabaronline_all.json` - Extracted articles data
- `checkpoint.json` - Current processing position
- `package.json` - Project dependencies

## Rate Limiting

The crawler includes:
- Random delays between requests (200-400ms)
- Automatic retry with 30-minute wait on 429 errors
- Graceful error handling for network issues

## License

This project is for educational and research purposes only. Please respect the website's robots.txt and terms of service.