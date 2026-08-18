Frontend Design Specification: Location Tab to Spatial Intelligence Dashboard
This document details the frontend design specification, data ingestion pipeline, and enrichment processes required to transition a flat social feed into the high-fidelity LocationDashboardTab.tsx—a multi-dimensional spatial intelligence dashboard modeled after enterprise social monitoring portals.
1. Architectural Spatial Paradigm Shift
The location dashboard transforms plain-text social telemetry into interactive geographic intelligence. It shifts the analytical perspective:
From Text Strings to Spatial Coordinates: Instead of treating location as an optional metadata string, the system establishes a multi-tiered geographic hierarchy: Macro-Region (Continent) 
 Country 
 City / Centroid Coordinates.
From Binary Locations to Provenance Slices: It distinguishes how geographic data was obtained, categorizing provenance into explicit Post Coordinates (geotags), inferred Author Locations (user profile metadata), or Unknown fallbacks.
From Absolute Counts to Geo-Sentiment Indices: It correlates geographic distributions with sentiment values, allowing users to see not just where conversations occur, but how brand sentiment shifts across regional borders.
2. Layout & Visual Design Transformation
The interface employs a disciplined three-column layout (grid-cols-1 lg:grid-cols-12) designed to manage high cognitive loads through clean geometry and structured white space.
code
Code
+-------------------------------------------------------------------------------------------------------------------------+
|                                                   GLOBAL CONTROLS (Topic, Range)                                        |
+-------------------------------------------------------------------------------------------------------------------------+
|  COLUMN 1: SENTIMENT & GROUPS (3/12)    |  COLUMN 2: CENTRAL SPATIAL INTELLIGENCE (6/12)   | COLUMN 3: PROVENANCE & LANG (3/12) |
|                                         |                                                   |                                  |
|  [ Sentiment Gauge Card ]               |  [ Dynamic World Map Canvas ]                     |  [ Location Coverage Donut ]     |
|  - Overall score index, change, slider  |  - Landmass nodes, ocean text labels              |  - Slices: Author, Post, Unknown |
|                                         |  - Layered density clusters with spring tooltips  |                                  |
|  [ Sentiment by Region ]                |  - Interactive mode switchers (Buzz/Trend/Sent)   |  [ Phrases by Region ]           |
|  - Normalized regional score tracking   |                                                   |  - Region-specific keyphrases    |
|                                         |  [ Lower Split Grid ]                             |                                  |
|  [ Location Groups ]                    |  - Left: Countries progress bar list              |  [ Languages Distribution ]      |
|  - Macro-continental volume metrics     |  - Right: Top Cities absolute counts list         |  - Linguistic breakdown & trend  |
+-------------------------------------------------------------------------------------------------------------------------+
Visual Identity & Layout Geometry
The Spatial Canvas: The world map is rendered inside a bounded container (h-[320px]) utilizing high-contrast, professional styling: an ocean background (#B9CEEB or #E2EAF4) holding light slate landmasses (#F1F5F9) with thin, crisp borders (#CBD5E1).
Proportional Visual Anchors: The map markers are circular nodes. Sizing is dynamically proportional to posting volume, and fills indicate local sentiment or trend directions, styled with a distinct offset shadow.
Typographic Scale: Labels inside the map are styled with varied sizes to differentiate geographic layers:
Continents: Large (14px to 16px), uppercase tracking-wider labels in slate-500 (#64748B).
Water Bodies: Small (11px), italicized text in blue-500 (#3B82F6).
Interactive Transitions: Floating tooltips use spring physics (type: 'spring', damping: 22, stiffness: 350) to transition smoothly when hovering over hot spots, eliminating jarring visual state changes.
3. Data Ingestion, Enrichment, & Processing Pipeline
Displaying multi-tiered regional metrics requires a robust server-side processing pipeline to normalize and enrich messy raw metadata.
code
Code
+-----------------+      +---------------------+      +---------------------+      +----------------------+
| Raw Social Feed | ---> | Location Extraction | ---> | Geocoding & Lookup  | ---> | Aggregation Engine   |
| (Unstructured)  |      | (Geotags & Profile) |      | (Normalize Hierarchy|      | (Compute regional    |
+-----------------+      +---------------------+      +---------------------+      | indices and trends)  |
                                                                                   +----------------------+
A. Data Schema Definition
The post entity must be enriched with explicit geographic hierarchy, language identifiers, and data provenance metadata:
code
TypeScript
export interface LocationEnrichedPost {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  languageCode: string; // ISO 639-1 (e.g. "en", "it")
  
  locationMetadata: {
    // Provenance categorization
    provenance: 'post' | 'author' | 'unknown';
    
    // Extracted raw strings
    rawLocationString?: string; // e.g. "London, UK"
    
    // Normalized geographic resolution
    coordinates?: [number, number]; // [latitude, longitude]
    city?: string;                  // e.g. "London"
    countryId: string;              // ISO-3166 alpha-2 (e.g. "uk", "us", "it")
    countryName: string;            // e.g. "United Kingdom"
    macroRegion: string;            // e.g. "europe", "asia", "north_america"
  };
  
  keyPhrases: string[];
}
B. The Multi-Step Enrichment Process
Extraction & Provenance Classification:
Post Geotagging: If the post payload includes explicit GPS coordinates, assign provenance: 'post'.
Author Profile Parsing: If explicit coordinates are absent, read the user's raw profile location text (e.g. "Rome, Italy"). Classify as provenance: 'author'.
Fallback: If no location text is found, classify as provenance: 'unknown'.
Geocoding and Spatial Normalization:
Raw strings are parsed via a geocoding service (e.g., Google Maps Places or OpenStreetMap APIs) to map locations to a structured hierarchy:
"London" 
 City: London, Country: United Kingdom (uk), MacroRegion: europe.
Sentiment Mapping per Region:
Compute the average sentiment index for each country and macro-region using the normalized index formula (
):
Keyphrase Geographic Distribution:
Group extracted keyphrases by countryId to populate regional word clouds, highlighting what terms dominate in specific locations.
Linguistic Tagging:
Identify the post's text language using a natural language processor (NLP), mapping it to standard ISO codes.
4. Widget-by-Widget Specification
Below is the design specification for each of the seven components that form the dashboard.
code
TypeScript
// Complete preprocessed dataset required to drive the Location Dashboard
export interface LocationDashboardDataset {
  overallSentimentIndex: {
    score: number;          // e.g., 10.0
    changeDelta: number;    // e.g., 10.0
    trend: 'up' | 'down' | 'flat';
  };
  sentimentByRegion: {
    id: string;             // e.g., "uk"
    name: string;           // e.g., "United Kingdom"
    score: string;          // e.g., "+10"
    widthPercent: number;   // Visual bar scaling
    trend: 'up' | 'down' | 'flat';
  }[];
  locationGroups: {
    id: string;             // e.g., "europe"
    name: string;           // e.g., "EUROPE"
    count: number;          // Total volume
    widthPercent: number;   // Proportional bar scale
    trend: 'up' | 'down' | 'flat';
  }[];
  mapHotspots: {
    id: string;             // e.g., "uk"
    centroid: [number, number]; // SVG map overlay coordinates [x, y]
    count: number;          // Total posts clustered at centroid
    sentimentScore: number; // Regional sentiment score
    name: string;
  }[];
  countriesList: {
    id: string;
    name: string;
    count: number;
    widthPercent: number;
    trend: 'up' | 'down' | 'flat';
  }[];
  citiesList: {
    id: string;
    name: string;
    count: number;
    trend: 'up' | 'down' | 'flat';
  }[];
  locationCoverage: {
    authorPercent: number;  // e.g., 80.5
    unknownPercent: number; // e.g., 18.4
    postPercent: number;    // e.g., 1.1
  };
  phrasesByRegion: {
    countryId: string;
    countryName: string;
    phrases: { text: string; sizeClass: string }[];
  }[];
  languages: {
    id: string;
    name: string;
    count: number;
    widthPercent: number;
    trend: 'up' | 'down' | 'flat';
  }[];
}
Widget Specifications
Widget Name	Target Visualization	Required Data Attributes	Interactive Behavior
Sentiment Gauge	Clean semicircular dial showing overall brand health.	Composite sentiment score, rolling timeframe change delta, and direction.	Displays high-level sentiment context for the active geographical filters.
Sentiment by Country	Ranked horizontal list pairing country name, net sentiment label, and a proportional green bar.	Normalized sentiment score per country, scaled from -10 to +10.	Clicking a country isolates downstream panels (such as regional phrases and cities) to that country.
Location Groups	Bar list showing macro-volume by continent.	Count of posts grouped by continent classification, scaled proportionally.	Selecting a macro-region restricts the map and country lists to focus on that continent.
World Map Canvas	World SVG vector map rendering volume-scaled circle nodes at centroids.	Coordinates, density counts, regional sentiment, and country codes.	Hovering displays a floating spring-physics card showing exact metrics; clicking filters the entire page by that country.
Locations & Cities	Dual lists showing country counts and city-specific activity metrics.	Absolute frequency counts for countries and cities, calculated from structured geolocations.	Clicking a city filters the primary posts list to that specific municipality.
Location Coverage	Interactive pie chart and list showing data source provenance.	Ratio tracking of explicit post geotags vs. inferred profile locations vs. unknown values.	Clicking a slice filters metrics by data provenance, allowing users to isolate high-accuracy geotagged records.
Phrases by Region	Context matrix mapping popular words to regional groups.	High-frequency phrases extracted from posts within specific countries.	Selecting a phrase filters the main view to analyze posts containing that term within the chosen region.
Languages	Simple horizontal metrics showing linguistic splits.	Post count distribution categorized by identified language.	Selecting a language (e.g. "English") filters the feed to display only posts matching that language.
5. Client-Side Reactive Cross-Filtering Engine
The Location Dashboard relies on a fast, responsive cross-filtering engine. When a user clicks an interactive element (such as a map hotspot, macro-region bar, or language metric):
State Management: The dashboard updates local filters, such as activeRegionFilter, activeLanguageFilter, or activePhraseFilter.
In-Memory Transformations: Instead of sending fresh requests to the server, the component filters the pre-enriched LocationEnrichedPost[] dataset client-side:
code
TypeScript
const filteredPosts = useMemo(() => {
  return allPosts.filter(post => {
    const matchesRegion = !activeRegionFilter || 
      post.locationMetadata.countryId === activeRegionFilter ||
      post.locationMetadata.macroRegion === activeRegionFilter;
    
    const matchesLanguage = !activeLanguageFilter || 
      post.languageCode === activeLanguageFilter;
      
    return matchesRegion && matchesLanguage;
  });
}, [allPosts, activeRegionFilter, activeLanguageFilter]);
Unified State Redraw: All widgets immediately re-aggregate metrics from this filtered subset using client-side helpers. The entire dashboard—including map node sizes, phrase clouds, and sentiment gauges—updates instantly in response to user selections.