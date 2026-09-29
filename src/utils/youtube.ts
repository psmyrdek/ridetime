import feed from '../data/youtube.json';

export interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
}

export const videos: Video[] = feed.videos;
export const shorts: Video[] = feed.shorts;

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const viewsFormat = new Intl.NumberFormat('pl-PL', { notation: 'compact', maximumFractionDigits: 1 });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatViews = (views: number) => `${viewsFormat.format(views)} wyświetleń`;

// Strips the trailing " | RideTime" suffix used in every video title.
export const cleanTitle = (title: string) => title.replace(/\s*\|\s*RideTime\s*$/i, '');
