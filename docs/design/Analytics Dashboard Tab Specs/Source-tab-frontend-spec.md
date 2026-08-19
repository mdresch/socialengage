Frontend Design Specification: Sources Tab to Multidimensional Channel Analytics
This document details the frontend design specification, data ingestion schemas, and processing pipelines required to transition the simple, chart-based SourcesTab.tsx into the comprehensive, enterprise-grade SourcesDashboardTab.tsx—a visual command center that tracks channel volumes, comparative deltas, user activities, and linguistic profiles across ingested communication streams.
1. Architectural Analytics Philosophy
The Sources Dashboard moves beyond basic raw post counts per source to evaluate user behavior and channel dynamics:
From Volume Tallies to Behavioral Typing: Instead of merely grouping posts by connector (e.g., "Twitter"), the system analyzes the action types (Posts, Shares/Retweets, and Replies/Comments) to understand user engagement depth.
From Static Timelines to Anomaly/Spike Detection: The dashboard highlights volume anomalies—such as the major spike on September 8—by correlating sudden spikes with hot topics, keyphrases, and rapid language shifts.
From Siloed Metrics to Author Ownership: It tracks not just how much content is published, but how many unique creators are active on each platform, showing the ratio of content volume to publisher density (to identify bot activity or high-influence authors).
2. Interface Architecture & Visual Grid Design
The dashboard uses a structured two-tier grid layout to deliver deep multi-dimensional insights on a single screen without causing cognitive fatigue.
code
Code
+-------------------------------------------------------------------------------------------------------------------------+
|                                                   GLOBAL CONTROLS (Topic, Range)                                        |
+-------------------------------------------------------------------------------------------------------------------------+
|                                              Tiers 1 & 2: THE UPPER COMMAND ZONE                                        |
+-------------------------------------------------------------------------------------------------------------------------+
|  LEFT SIDEBAR (3/12)                    |  CENTRAL HISTORY TIMELINE (6/12)                 | RIGHT SIDEBAR (3/12)              |
|                                         |                                                   |                                  |
|  [ Sources by Sentiment ]               |  [ Sources History Timeline ]                     |  [ Activities Donut ]            |
|  - Channel index score, trend & progress|  - Multi-line tracking showing daily spikes       |  - Action: Posts, Shares, Replies|
|                                         |  - Custom point hovers with active badges         |                                  |
|  [ Location Insights Map ]              |                                                   |  [ Phrases by Sources ]          |
|  - Geographic density per platform      |                                                   |  - High-impact words per channel |
+-------------------------------------------------------------------------------------------------------------------------+
|                                              Tier 3: THE LOWER EXECUTIVE TRIPLE-TRACK                                   |
+-------------------------------------------------------------------------------------------------------------------------+
|  [ Authors by Source ] (25%)  |  [ Sources Breakdown ] (25%)  |  [ Volume Change Delta ] (25%)  |  [ Languages ] (25%)           |
|  - Segmented donut with inner |  - Core channel volumes and   |  - Period-over-period relative  |  - Active language profile and  |
|    silhouette & total counts  |    proportional progress bars |    growth & reduction offsets   |    trend indicators            |
+-------------------------------------------------------------------------------------------------------------------------+
Visual Identity & Styling Rules
Palette Standardization: To ensure instant visual recognition across all widgets, each data source is assigned a distinct semantic color:
Twitter / X: Sky Blue (#0EA5E9 / #0284C7)
Blogs / RSS: Energetic Orange (#F97316 / #EA580C)
Videos / YouTube: Crimson Rose (#BE123C / #F43F5E)
News / Media: Deep Royal Purple (#581C87 / #7E22CE)
Flattened Container System: Every widget card uses a clean white background, framed by a precise 1px gray border (#E2E8F0) with sharp, zero-radius or micro-radius (2px) corners.
Negative Space & Sizing Balance: Large, high-contrast, display-sized metrics (e.g., total authors or change percentages) use a lightweight font in slate-900 (#0F172A) paired with ample surrounding margins, ensuring key figures are easy to scan at a glance.
3. Data Ingestion, Processing, & Enrichment Pipeline
To feed these widgets, raw ingested records must go through a structured, multi-stage processing pipeline.
code
Code
+------------------+      +-------------------------+      +--------------------------+      +-------------------------+
| Raw Source Feeds | ---> | Activity Classification | ---> | Aggregates & Indexing   | ---> | Comparative Benchmarking|
| (API, RSS, Scra) |      | (Post, Reply, Share)    |      | (Sentiment index math)   |      | (Period-over-period YoY)|
+------------------+      +-------------------------+      +--------------------------+      +-------------------------+
A. Structured Data Schema
The post structure must be enriched to capture user action types, channel identities, unique author accounts, and language attributes:
code
TypeScript
export interface SourceEnrichedPost {
  id: string;
  title: string;
  content: string;
  publishedAt: string; // ISO 8601 Timestamp
  sentiment: 'positive' | 'neutral' | 'negative';
  languageCode: string; // e.g. "en"
  
  sourceMetadata: {
    channelId: 'twitter' | 'blogs' | 'videos' | 'news';
    channelLabel: string; // e.g., "Twitter/X", "News Media"
    
    // Activity categorization (Story 8.2)
    activityType: 'post' | 'reply' | 'share';
    
    authorId: string;     // Unique platform handle
    authorName: string;   // Display name
    rawEngagementScore?: number; // Shares/Replies/Likes
  };
  
  location?: {
    countryCode: string;
  };
  
  keyPhrases: string[];
}
B. The Enrichment Processes
Activity Classification:
Direct Ingestion Rule: Analyze platform-specific metadata to determine the action type:
An original tweet or article is tagged as activityType: 'post'.
A retweet, reblog, or native platform share is tagged as activityType: 'share'.
A comment, tweet reply, or discussion response is tagged as activityType: 'reply'.
Unique Author Extraction:
For the selected timeframe, the pipeline extracts and deduplicates the authorId strings within each channel, computing the ratio of total post volume to active publishers.
Cross-Source Sentiment Index Math:
The composite index is calculated for each channel to scale sentiment between 0.0 and 10.0 (where 5.0 is completely neutral):
Period-over-Period Delta Calculation:
The system compares active period volumes against preceding historical averages to determine the absolute volume change (e.g., 
 Twitter posts) and identify platform-specific growth trends.
Geographic Density Aggregation:
Resolves coordinates for each post, grouping them by channel to map platform-specific activity distributions.
4. Widget-by-Widget Specification
Each widget operates on pre-processed, grouped datasets generated from the parent data feed.
code
TypeScript
// Transformed dataset prepared for SourcesDashboardTab ingestion
export interface SourceDashboardDataset {
  sourcesBySentiment: {
    id: string;
    name: string;
    score: string;          // e.g. "8.8"
    numericScore: number;
    widthPercent: number;   // Visual progress track scale
    trend: 'up' | 'down' | 'flat';
  }[];
  sourcesHistory: {
    date: string;
    twitter: number;
    blogs: number;
    videos: number;
    news: number;
  }[];
  activities: {
    postsPercent: number;   // e.g. 83
    sharesPercent: number;  // e.g. 17
    repliesPercent: number; // e.g. 0
  };
  phrasesBySources: {
    sourceId: string;
    sourceName: string;
    phrases: { text: string; sizeClass: string }[];
  }[];
  authorsBySource: {
    totalActiveAuthors: number; // e.g., 3498
    slices: { name: string; value: number; color: string }[];
    items: { id: string; label: string; count: number; trend: string }[];
  };
  sourcesVolumeBreakdown: {
    id: string;
    name: string;
    countString: string;    // e.g., "5,682"
    widthPercent: number;
    barColor: string;
    trend: string;
  }[];
  volumeChangeDelta: {
    id: string;
    name: string;
    changeString: string;   // e.g., "+2,930"
    widthPercent: number;
    barColor: string;
    trend: string;
  }[];
  languages: {
    id: string;
    name: string;
    countString: string;
    widthPercent: number;
    barColor: string;
    trend: string;
  }[];
}
Component Details
Component Name	Visual Representation	Target Analytics Metric	Interactive Behavior
Sources by Sentiment	Ranked horizontal progress bars with source channel icons.	Relative sentiment health index (
 to 
) across platforms.	Clicking a channel filters all downstream widgets to focus exclusively on that platform.
Location Insights Map	Small continental SVG map featuring styled blue/orange markers.	Regional distribution density grouped by active source channel.	Clicking a continent or hotspot isolates geographic source activity.
Sources History	Multi-line line chart mapping timeline spikes, configured with interactive hovers and point badges.	Real-time posting volume over time across all monitored channels.	Clicking any coordinate point or legend element isolates the dataset to that day or channel.
Activities Donut	Sleek three-segment donut chart and percent-key list.	Relative distribution of actions (original posts vs. shares vs. comments).	Helps identify channel profiles (e.g., highly interactive chat platforms vs. broadcasting channels).
Phrases by Sources	Horizontal layout pairing channel icons with platform-specific keyphrase clouds.	Dominant keywords extracted from posts within specific channels.	Selecting a phrase filters the dashboard to analyze posts containing that term.
Authors by Source	Segmented ring chart with a user avatar silhouette in the center.	Count of unique active authors publishing on each platform.	Shows if activity is driven by a diverse group of users or a few high-volume accounts.
Sources Volume	Proportional bar charts tracking absolute post counts.	Overall post volumes grouped by channel.	Isolates high-volume channels for deeper analysis.
Volume Change Delta	Growth/reduction bars comparing current volumes to historical periods.	Relative period-over-period channel volume changes.	Highlights emerging growth trends or drop-offs in platform activity.
Languages	Progress track mapping linguistic splits.	Language distribution of ingested posts.	Helps identify geographic shifts or localized content trends.
5. Client-Side Reactive Cross-Filtering Engine
The interface acts as a fast, responsive client-side app. When a user interacts with a widget (such as clicking a channel legend, a day on the timeline, or an activity category):
State Management: The dashboard updates active filters, such as activeSourceFilter, activeLanguageFilter, or activePhraseFilter.
In-Memory Calculations: Instead of sending fresh requests to the server, the component filters the pre-enriched SourceEnrichedPost[] dataset client-side:
code
TypeScript
const filteredPosts = useMemo(() => {
  return allPosts.filter(post => {
    const matchesSource = !activeSourceFilter || 
      post.sourceMetadata.channelId === activeSourceFilter;
      
    const matchesLanguage = !activeLanguageFilter || 
      post.languageCode === activeLanguageFilter;
      
    return matchesSource && matchesLanguage;
  });
}, [allPosts, activeSourceFilter, activeLanguageFilter]);
Instant Visual Alignment: All widgets immediately re-aggregate metrics from this filtered subset using client-side helpers. The entire dashboard—including timeline points, author splits, activity donuts, and keyphrase clouds—updates instantly in response to user selections, delivering a seamless, high-performance exploration experience.