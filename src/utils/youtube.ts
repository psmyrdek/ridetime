import { youtube_v3 } from '@googleapis/youtube';

const youtube = new youtube_v3.Youtube({
  auth: import.meta.env.YOUTUBE_API_KEY,
});

export interface VideoWithType extends youtube_v3.Schema$Video {
  isShort: boolean;
}

export async function getLatestVideosFromChannel(channelId: string, maxResults: number = 10): Promise<VideoWithType[]> {
  try {
    // First, get the upload playlist ID for the channel
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      id: [channelId],
    });

    const uploadPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadPlaylistId) {
      throw new Error('Unable to find upload playlist for the channel');
    }

    // Now, get the latest videos from the upload playlist
    const playlistItemsResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadPlaylistId,
      maxResults: maxResults,
    });

    // Extract video IDs from the playlist items
    const videoIds = playlistItemsResponse.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => !!id);

    if (!videoIds || videoIds.length === 0) {
      return [];
    }

    // Finally, get the full video details
    const videosResponse = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    // Process videos to determine if they are Shorts
    const processedVideos: VideoWithType[] = (videosResponse.data.items || []).map((video) => {
      const duration = video.contentDetails?.duration;
      const isShort = isYouTubeShort(duration, video.snippet?.title);
      return { ...video, isShort };
    });

    return processedVideos;
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}

function isYouTubeShort(duration: string | null | undefined, title: string | null | undefined): boolean {
  if (!duration) return false;

  // Parse duration (in ISO 8601 format)
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return false;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  // Check if duration is 60 seconds or less
  const isDurationShort = totalSeconds <= 90;

  // Check if title contains "#shorts" (case-insensitive)
  const isTitleShort = title ? /#shorts/i.test(title) : false;

  // Consider it a Short if either condition is true
  return isDurationShort || isTitleShort;
}
