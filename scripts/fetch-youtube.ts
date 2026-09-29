// Pulls the latest RideTime uploads from YouTube's public RSS feeds and stores them in src/data/youtube.json.
// Runs daily in GitHub Actions (.github/workflows/youtube-feed.yml). No API key required.
//
// YouTube exposes per-channel playlists derived from the channel ID:
//   UULF<id> - long-form videos only
//   UUSH<id> - Shorts only
// Each feed returns the 15 most recent entries, so results are merged with the existing file to keep history.

import { readFile, writeFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? 'UCsSQIzYQZta2CF9Yy7RG7zQ';
const OUTPUT = new URL('../src/data/youtube.json', import.meta.url);
const MAX_PER_KIND = 30;

type Kind = 'videos' | 'shorts';

interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
}

type Feed = Record<Kind, Video[]>;

const channelSuffix = CHANNEL_ID.replace(/^UC/, '');
const PLAYLISTS: Record<Kind, string> = {
  videos: `UULF${channelSuffix}`,
  shorts: `UUSH${channelSuffix}`,
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

async function fetchPlaylist(playlistId: string): Promise<Video[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`);
  if (!res.ok) throw new Error(`Feed ${playlistId} responded with ${res.status}`);

  const xml = parser.parse(await res.text());
  const entries = [xml.feed?.entry ?? []].flat();

  return entries.map((entry: any) => {
    const group = entry['media:group'];
    const id = String(entry['yt:videoId']);
    return {
      id,
      title: String(entry.title),
      description: String(group?.['media:description'] ?? '')
        .split('\n')[0]
        .trim(),
      publishedAt: entry.published,
      thumbnail: `https://i.ytimg.com/vi/${id}/${playlistId.startsWith('UUSH') ? 'oar2' : 'hqdefault'}.jpg`,
      views: Number(group?.['media:community']?.['media:statistics']?.views ?? 0),
    };
  });
}

async function readExisting(): Promise<Feed> {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf8'));
  } catch {
    return { videos: [], shorts: [] };
  }
}

function merge(existing: Video[], fresh: Video[]): Video[] {
  const byId = new Map(existing.map((v) => [v.id, v]));
  for (const video of fresh) byId.set(video.id, video);
  return [...byId.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_PER_KIND);
}

const existing = await readExisting();
const [videos, shorts] = await Promise.all([fetchPlaylist(PLAYLISTS.videos), fetchPlaylist(PLAYLISTS.shorts)]);

if (videos.length === 0 && shorts.length === 0) {
  throw new Error('Both feeds came back empty - refusing to overwrite existing data');
}

const feed: Feed = {
  videos: merge(existing.videos, videos),
  shorts: merge(existing.shorts, shorts),
};

await writeFile(OUTPUT, JSON.stringify(feed, null, 2) + '\n');
console.log(`Saved ${feed.videos.length} videos and ${feed.shorts.length} shorts`);
