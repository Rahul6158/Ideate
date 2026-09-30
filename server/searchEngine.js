// ==============================================================================
// Server-Side Search Engine Helper (DuckDuckGo HTML / Instant Answers Scraper)
// Used for /websearch, /research, and /validate external fact verification
// ==============================================================================

export async function performWebSearch(query, maxResults = 5) {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.trim();
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`DuckDuckGo returned status ${response.status}`);
      return [];
    }

    const html = await response.text();
    const results = [];

    // Parse DuckDuckGo standard HTML results
    // Results contain: <a class="result__snippet" ...> or <a class="result__url" ...>
    const resultBlocks = html.split('<div class="result results_links');

    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i];

      // Extract title and URL
      const linkMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                         block.match(/<a[^>]+class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                         block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

      // Extract title explicitly if separate
      const titleMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      // Extract snippet
      const snippetMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);

      let url = linkMatch ? linkMatch[1] : '';
      // Decode DuckDuckGo redirect url if needed (/l/?kh=-1&uddg=https%3A%2F%2F...)
      if (url.includes('uddg=')) {
        try {
          const parts = url.split('uddg=');
          url = decodeURIComponent(parts[1].split('&')[0]);
        } catch (_) {}
      }

      const rawTitle = titleMatch ? titleMatch[1] : (linkMatch ? linkMatch[2] : 'Web Result');
      const rawSnippet = snippetMatch ? snippetMatch[1] : '';

      const title = rawTitle.replace(/<[^>]+>/g, '').trim();
      const snippet = rawSnippet.replace(/<[^>]+>/g, '').trim();

      if (url && (title || snippet)) {
        results.push({
          title: title || 'Untitled Source',
          snippet: snippet || 'No snippet preview available.',
          url
        });
      }
    }

    return results;
  } catch (err) {
    console.warn('Web search error:', err.message);
    return [];
  }
}
