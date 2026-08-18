Frontend Design Specification: Sentiment Tab to Executive Sentiment Dashboard
This document details the frontend design specification and data preparation blueprint required to transition the simple, flat-filtered SentimentTab.tsx into the high-fidelity, three-column SentimentDashboardTab.tsx (modeled after enterprise analytics portals such as Microsoft Social Engagement).
1. Architectural Paradigm Shift
The transition represents a fundamental shift in both user experience and data structure:
From Linear Filtering to Multi-Dimensional Intelligence: SentimentTab.tsx acts as a direct client-side search refiner. SentimentDashboardTab.tsx functions as an executive control room, delivering simultaneous geographic, historical, source-specific, and qualitative insights.
From Single-Facet Aggregates to Comparative Benchmarking: Instead of simply displaying current volumes, the dashboard visualizes trend indicators, rate-of-change deltas, baseline comparative metrics (e.g., Last Week), and data provenance statistics.
From Raw Counts to Computed Indexes: Absolute sentiment categories (positive, neutral, negative) are transformed into a normalized Sentiment Index ranging on a continuous scale (e.g., -10.0 to +10.0).
2. Layout & Visual Design Transformation
The interface must transition from a stacked linear flow to a disciplined, three-column responsive layout with carefully controlled visual hierarchy:
code
Code
+-------------------------------------------------------------------------------------------------------------------------+
|                                                   GLOBAL CONTROLS (Topic, Range)                                        |
+-------------------------------------------------------------------------------------------------------------------------+
|  COLUMN 1: LOCATION & ADVOCACY (3/12)   |  COLUMN 2: HISTORY, WORD CLOUDS, SOURCES (6/12)  | COLUMN 3: RATINGS & GAUGE (3/12) |
|                                         |                                                   |                                  |
|  [ Location Insights Map ]              |  [ Sentiment History Chart ]                      |  [ Sentiment Coverage Donut ]    |
|  - World landmass with sentiment nodes  |  - Dual bar + comparative benchmark line          |  - Provenance: System vs Manual  |
|                                         |                                                   |                                  |
|  [ Top Fans Widget ]                    |  [ Negative Phrases Word Cloud ]                  |  [ Sentiment Gauge Card ]        |
|  - High advocacy authors/scores         |  - Red typography, custom weights                 |  - Semi-circular smiley gauge    |
|                                         |                                                   |  - Slide-bar scale (-10 to +10)  |
|  [ Top Critics Widget ]                 |  [ Sources by Sentiment List ]                    |                                  |
|  - Low advocacy authors/scores          |  - Channel breakdown (Twitter vs. RSS/Blogs)     |  [ Positive Phrases Word Cloud ]  |
|                                         |                                                   |  - Green typography, weights     |
+-------------------------------------------------------------------------------------------------------------------------+
Visual Identity & Design Principles
Color Framework: Avoid artificial gradients. The color system uses high-contrast, professional, warm-neutral elements paired with strict semantic colors:
Positive Sentiment: Deep emerald green (#15803D, #16A34A).
Negative Sentiment: Crisp ruby red (#DC2626, #B91C1C).
Neutrals / Benchmarks: Safe slates and grays (#475569, #94A3B8, #E2E8F0).
Flattened Depth: Eliminate nested card-within-card structures. Containers are rendered on a clean white background (#FFFFFF) framed by precise 1px borders (#E2E8F0) with square or micro-rounded (no more than 4px) corners.
Typography Scale: Maintain a crisp typographic hierarchy using standard display/sans pairings.
Widget Labels: Small (11px), all-caps tracking-widest text in cool-gray (#64748B) to establish clean rhythm.
Primary Metrics: Tall, thin typography (3xl or 4xl, light weight) in slate-900 (#0F172A) for effortless scannability.
3. Data Pipeline & Schema Blueprint
To support these advanced visuals, the application's underlying data model must undergo substantial enrichment before hitting the React component.
A. Input Data Source & Normalization
The ingestion pipeline must consume unstructured social feeds, RSS entries, and platform-specific data streams, normalizing them into a unified format:
code
TypeScript
export interface NormalizedPost {
  id: string;
  source: 'twitter' | 'rss' | 'facebook' | 'forum';
  author: {
    handle: string;
    name: string;
    avatarBg?: string;
  };
  title: string;
  content: string;
  publishedAt: string; // ISO 8601 Timestamp
  location?: {
    countryCode: string; // ISO-3166 alpha-2 (e.g., "US", "DE")
    coordinates?: [number, number]; // [longitude, latitude]
  };
}
B. Enrichment Pipeline
Prior to dashboard presentation, raw posts pass through a server-side Enrichment Engine (leveraging Gemini API processes and GeoIP lookup utilities) to append semantic metadata:
code
TypeScript
export interface EnrichedPost extends NormalizedPost {
  enrichment: {
    // 1. AI-Driven Sentiment Evaluation
    sentimentScore: number;       // Direct output from -1.0 (extremely negative) to +1.0 (extremely positive)
    sentimentLabel: 'positive' | 'neutral' | 'negative';
    sentimentAssignedBy: 'system' | 'user'; // Track manual correction provenance
    
    // 2. Named Entity & Keyphrase Extraction
    keyPhrases: {
      phrase: string;
      sentimentLabel: 'positive' | 'neutral' | 'negative';
    }[];
    
    // 3. Geolocation Normalization (GeoIP / Profile location fallback)
    computedCountryCode?: string; 
  };
}
C. Multi-Dimensional Aggregation
A localized preprocessing engine groups the flat EnrichedPost[] array into consolidated models. This step converts absolute raw records into ready-to-render dashboard structures:
The composite Sentiment Index (
) maps the sentiment distribution onto a continuous scale from 
 to 
:
Where 
 represents the volume of positive posts, 
 represents the volume of negative posts, and 
 is the active subset total.
To show historical context, the pipeline generates a sliding window benchmark offset:
Active Window: Posts falling within the selected range (e.g., October 13 to October 19).
Comparative Window: Posts from the identical historical range immediately preceding the active window (e.g., October 6 to October 12).
4. Widget-by-Widget Specification
Each widget represents an isolated data consumer designed to operate on the transformed dataset.
code
TypeScript
// Completed client-side aggregated state sent directly to the SentimentDashboardTab
export interface DashboardPreparedData {
  locationInsights: LocationHotspot[];
  topFans: SentimentAdvocate[];
  topCritics: SentimentAdvocate[];
  sentimentHistory: SentimentHistoryNode[];
  negativePhrases: WeightedPhrase[];
  positivePhrases: WeightedPhrase[];
  sourcesBySentiment: SourceSentimentScore[];
  sentimentCoverage: {
    systemRatedCount: number;
    userEditedCount: number;
    coveragePercent: number;
  };
  sentimentIndex: {
    score: number;        // e.g. 9.4 (on a -10 to +10 scale)
    changeDelta: number;  // e.g. +0.5 compared to previous timeframe
    trendDirection: 'up' | 'down' | 'flat';
  };
}
Widget Details
Widget	Visual Presentation	Data Required (Extracted from Enriched Dataset)	Client-side Interaction
Location Insights	Monochrome map overlay featuring varying sizing, semi-transparent green hotspots.	Array of coordinates grouped by country code and matched against bounding box centroids.	Clicking a geographical hotspot filters the workspace to display posts specifically originating from that region.
Top Fans & Critics	Minimalist list items pairing platform identity indicators (Twitter logo, RSS icon) with absolute post counts.	Authors ranked by the absolute frequency of positive/negative post designations.	Selecting an author isolates their entire historical posting history in the slide-out drawer.
Sentiment History	Dual-Axis Composed Chart (positive/negative volume columns sharing the left axis; current/historical index lines on the right axis).	Aggregates of daily post volumes, partitioned by positive/negative labels, plus daily Sentiment Indexes.	Interactive column selection dynamically updates the rest of the dashboard components to reflect that specific day's records.
Phrase Clouds	Clean typographic grids displaying key phrases in semantic colors (red/green) with sizing based on frequency.	Unique phrase arrays sorted by frequency and sentiment labels.	Selecting a phrase filters all dashboard visualizations to evaluate records containing that specific text.
Sources by Sentiment	Multi-channel progress bars mapping source-specific sentiment indicators (scale of 0.0 to 10.0).	Post data grouped by source channels (e.g., rss, twitter), showing relative Sentiment Indexes.	Channel selection restricts current view analytics to the chosen medium.
Sentiment Coverage	Compact donut chart dividing automated vs. manually verified sentiment classifications.	Ratio tracking of posts where manual edits overrode machine-generated sentiments.	Displays data curation integrity and indicates where manual tuning has been active.
Sentiment Gauge	Numeric display with a semicircular smiley track, change delta indicators, and a primary scale slider.	Current average index (
), baseline offset calculation, and trend direction analysis.	Displays overall health at a glance.
5. Client-Side Reactive Pipeline
The system is designed for instant responsiveness. When a user clicks any item (such as an author, keyphrase, source channel, or date block):
Zero Network Overhead: Instead of making a round-trip database query, the frontend filters the raw EnrichedPost[] collection in-memory.
Pure Function Recalculation: The app passes this filtered subset through the exact same pure mathematical transformers used for the primary load.
Visual Alignment: All graphs, gauge dials, location coordinates, and word clouds instantly re-align to isolate the targeted facet, ensuring a unified, rapid analysis experience.