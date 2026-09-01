/**
 * YouTube Data API v3 Ingestion Connector types (ADR-0093).
 */

export interface YouTubeAuthor {
  channelId: string;
  channelTitle: string;
  avatarUrl?: string;
}

export interface YouTubeCommentThreadItem {
  id: string;
  snippet: {
    videoId: string;
    topLevelComment: {
      id: string;
      snippet: {
        authorDisplayName: string;
        authorChannelId?: { value: string };
        authorProfileImageUrl?: string;
        textDisplay: string;
        textOriginal: string;
        publishedAt: string;
        updatedAt: string;
        likeCount: number;
      };
    };
    totalReplyCount: number;
  };
}

export interface YouTubeSearchItem {
  id: {
    kind: string;
    videoId?: string;
    channelId?: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
}
