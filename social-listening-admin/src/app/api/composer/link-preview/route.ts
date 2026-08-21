import { NextResponse } from 'next/server';

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
  hostname: string;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Valid URL is required.' }, { status: 400 });
    }

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    // Fetch HTML with a lightweight timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      // Return basic fallback info if scraping fails or blocked
      return NextResponse.json({
        url,
        title: hostname,
        description: `External link to ${hostname}`,
        hostname,
      } satisfies LinkPreviewData);
    }

    const html = await response.text();

    // Extract OpenGraph / Meta tags
    const getMeta = (property: string, name?: string): string => {
      const propMatch = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (propMatch && propMatch[1]) return propMatch[1];

      if (name) {
        const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'));
        if (nameMatch && nameMatch[1]) return nameMatch[1];
      }
      return '';
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : '';

    const ogTitle = getMeta('og:title', 'twitter:title') || pageTitle || hostname;
    const ogDescription = getMeta('og:description', 'twitter:description') || getMeta('', 'description') || `View content on ${hostname}`;
    const ogImage = getMeta('og:image', 'twitter:image') || getMeta('og:image:url');
    const ogSiteName = getMeta('og:site_name') || hostname;

    const data: LinkPreviewData = {
      url,
      title: ogTitle,
      description: ogDescription,
      image: ogImage || undefined,
      siteName: ogSiteName,
      hostname,
    };

    return NextResponse.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Failed to fetch preview' }, { status: 500 });
  }
}
