/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Post {
  id: string;
  source: 'twitter' | 'rss' | 'video' | 'news';
  author: {
    handle: string;
    name: string;
    avatarBg: string;
  };
  title: string;
  content: string;
  publishedAt: string; // ISO String
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -10 to +10 scale or similar
  sentimentAssignedBy: 'system' | 'user';
  keyPhrases: string[];
  location?: {
    countryId: string;
    countryName: string;
    city?: string;
    coordinates?: [number, number];
  };
  languageCode: string;
  languageName: string;
  activityType: 'post' | 'share' | 'reply';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface GroundingResult {
  explanation: string;
  sources: GroundingSource[];
}
