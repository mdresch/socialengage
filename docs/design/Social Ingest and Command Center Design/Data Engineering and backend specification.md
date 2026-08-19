Here is the complete data engineering and backend design specification required to move from the current in-memory mock dataset to a production-grade backend engine.
This specification details the ingestion pipeline, data cleansing rules, machine learning enrichments, and database aggregation formulas necessary to support the Social Ingest and Sentiment Command Center frontends.
1. Raw Ingestion Sources & Schema Taxonomy
The production backend must ingest raw, unstructured stream events from four primary external channels:
Twitter/X API: Raw tweet JSON payloads, retweets, and replies.
RSS / Blogs: XML feeds from company and industry blogs containing titles, body summaries, and publishing dates.
Video Platforms (YouTube/TikTok): Metadata, video descriptions, and transcribed subtitles.
Global News Aggregators: Rich HTML articles, publications, and publisher databases.
Raw Ingest Schema Requirement
To unify these channels, the ingestion service must map incoming payloads to a standardized Entity Record in the database before processing:
Field Path	Type	Description
id	UUID/String	Unique identifier generated upon receipt.
source	Enum	One of: twitter, rss, video, news.
author	Nested Object	{ handle: string, name: string, avatar_url: string }.
title	String	Raw header text (empty for tweets).
content	String	UTF-8 encoded text body containing up to 5,000 characters.
published_at	Timestamp	ISO 8601 UTC timestamp extracted from the source channel.
raw_location	Nested Object	{ city: string, country_code: string, coordinates: [float, float] } (Optional).
raw_language	String	Original ISO 639-1 language code (e.g., en, it).
activity_type	Enum	One of: post, share, reply.
2. Ingest Cleansing & Data Sanitization Rules
Raw social streams are notoriously noisy. Before storing records for analytical querying, the backend must execute an ETL Cleansing Module:
Duplicate Deduplication: Compute a SHA-256 hash of author.handle + content within a rolling 5-minute window to filter out bot spam or redundant API webhooks.
HTML/UTF Sanitization: Parse raw content to remove HTML tags, unescape UTF symbols, and strip out erratic tracking codes (e.g., UTM parameters).
Missing Field Imputation:
If author.name is missing, default to @ followed by their handle.
If published_at is empty or invalid, default to the database ingestion time.
PII Masking: Ensure any structural PII not related to the public post (such as phone numbers or email addresses in body texts) is masked using regex-based filters.
3. Transformation & Cognitive AI Enrichment (Gemini Pipeline)
Once sanitized, the raw text is pushed through a server-side AI Enrichment worker powered by Gemini:
Sentiment Classifier:
Analyze the content to output a classification of positive, neutral, or negative.
Generate a floating-point Sentiment Score ranging from -10.0 (critical detractor) to +10.0 (brand evangelist).
Keyphrase Extractor:
Analyze the body text to isolate up to 5 prominent keyphrases or topics (e.g., "knowledge management", "error code").
Strip out standard stop-words (e.g., "the", "and") to ensure high-value tag clouds.
Spatial & Language Resolution:
If coordinates are missing, resolve the city and country via IP mapping or the user profile's location description.
Validate the languageName (e.g., converting "en" to "English").
4. Backend Aggregation & Analytics Query Requirements
Rather than forcing the frontend to download thousands of raw records, the backend must expose high-performance aggregated endpoints. The frontend requires pre-calculated metrics grouped by Topic, Source, and Region.
Endpoint A: /api/analytics/sentiment
Returns overall volume statistics and time-series historical sentiment ratios.
Required Manipulations (Server-Side):
Group By: date_trunc('day', published_at).
Total Count: count(id).
Sentiment Segmentations:
count(id) FILTER (WHERE sentiment = 'positive') as positive_count.
count(id) FILTER (WHERE sentiment = 'negative') as negative_count.
Net Sentiment Index:

(Resulting value clamped between 
 and 
).
Endpoint B: /api/analytics/spatial
Supports spatial overlays and phrase distribution widgets.
Required Manipulations (Server-Side):
Group By: location.country_id.
Aggregation Math:
Calculate the average sentiment_score per country.
Calculate the total activity count per macro-region (e.g., europe, asia, north_america).
Tagger Phrase Distribution: Select top 15 keyphrases with a frequency count:
code
SQL
SELECT unnest(key_phrases) AS phrase, count(*) AS phrase_frequency 
FROM posts GROUP BY phrase ORDER BY phrase_frequency DESC LIMIT 15;
Endpoint C: /api/analytics/sources
Calculates volume and channel splits for the Sources tab.
Required Manipulations (Server-Side):
Group By: source.
Author Density: count(DISTINCT author.handle) per channel (to display Unique Authors metrics).
Action Splits: count(id) grouped by activity_type (post, share, reply).
