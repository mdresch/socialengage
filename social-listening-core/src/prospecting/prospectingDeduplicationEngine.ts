import { ProspectingListEntry } from './prospectingListStore';
import { ProspectingListEntryPayload } from '../connectors/crm/types';

export interface MatchedHandle {
  platformId: string;
  handle: string;
  publicUrl?: string;
}

export interface DeduplicatedAuthorContact {
  canonicalName: string;
  matchedHandles: MatchedHandle[];
  bestEngagementScore: number;
  bestAuthenticityScore: number;
  bestInfluenceScore: number;
  bestReachScore: number;
  entryIds: string[];
  authorIds: string[];
  consolidatedNotes: string[];
  tags: string[];
  primaryEntry: ProspectingListEntry;
}

export function normalizeHandle(handle: string | null | undefined): string {
  if (!handle) return '';
  let h = handle.trim().toLowerCase();
  // Strip leading @
  if (h.startsWith('@')) {
    h = h.substring(1);
  }
  return h;
}

export function extractHandleFromPublicUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      return normalizeHandle(parts[parts.length - 1]);
    }
  } catch {
    // ignore invalid URLs
  }
  return '';
}

/**
 * Clusters prospecting list entries across social networks into deduplicated author contacts.
 * Matches entries by:
 * 1. Normalized author handle (case-insensitive, ignoring leading '@')
 * 2. URL-extracted handle or matching public profiles
 */
export function clusterDeduplicatedContacts(
  entries: ProspectingListEntry[],
  authorsMetadata: Record<string, { handle?: string; displayName?: string }> = {}
): DeduplicatedAuthorContact[] {
  const clusters: DeduplicatedAuthorContact[] = [];

  for (const entry of entries) {
    const authorMeta = authorsMetadata[entry.author_id];
    const rawHandle = authorMeta?.handle || '';
    const normHandle = normalizeHandle(rawHandle) || extractHandleFromPublicUrl(entry.public_url);

    // Try to find an existing cluster that matches handle
    let matchedCluster: DeduplicatedAuthorContact | undefined;
    if (normHandle && normHandle.length > 1) {
      matchedCluster = clusters.find((cluster) => {
        return cluster.matchedHandles.some(
          (mh) => normalizeHandle(mh.handle) === normHandle || normalizeHandle(mh.publicUrl) === normHandle
        );
      });
    }

    const currentHandleEntry: MatchedHandle = {
      platformId: entry.platform_id,
      handle: normHandle || rawHandle || entry.author_name || 'unknown',
      publicUrl: entry.public_url || undefined,
    };

    const entryEngagement = Number(entry.engagement_score) || 0;
    const entryAuthenticity = Number(entry.authenticity_score) || 0;
    const entryInfluence = Number(entry.influence_score) || 0;
    const entryReach = Number(entry.reach_score) || 0;

    if (matchedCluster) {
      // Merge into matched cluster
      matchedCluster.entryIds.push(entry.id);
      if (!matchedCluster.authorIds.includes(entry.author_id)) {
        matchedCluster.authorIds.push(entry.author_id);
      }
      matchedCluster.matchedHandles.push(currentHandleEntry);

      matchedCluster.bestEngagementScore = Math.max(matchedCluster.bestEngagementScore, entryEngagement);
      matchedCluster.bestAuthenticityScore = Math.max(matchedCluster.bestAuthenticityScore, entryAuthenticity);
      matchedCluster.bestInfluenceScore = Math.max(matchedCluster.bestInfluenceScore, entryInfluence);
      matchedCluster.bestReachScore = Math.max(matchedCluster.bestReachScore, entryReach);

      if (entry.notes && entry.notes.trim()) {
        matchedCluster.consolidatedNotes.push(entry.notes.trim());
      }
      if (entry.tags && Array.isArray(entry.tags)) {
        for (const tag of entry.tags) {
          if (!matchedCluster.tags.includes(tag)) {
            matchedCluster.tags.push(tag);
          }
        }
      }
    } else {
      // Create new cluster
      const notes: string[] = [];
      if (entry.notes && entry.notes.trim()) {
        notes.push(entry.notes.trim());
      }

      clusters.push({
        canonicalName: entry.author_name || authorMeta?.displayName || 'Unknown',
        matchedHandles: [currentHandleEntry],
        bestEngagementScore: entryEngagement,
        bestAuthenticityScore: entryAuthenticity,
        bestInfluenceScore: entryInfluence,
        bestReachScore: entryReach,
        entryIds: [entry.id],
        authorIds: [entry.author_id],
        consolidatedNotes: notes,
        tags: [...(entry.tags || [])],
        primaryEntry: entry,
      });
    }
  }

  return clusters;
}

export function deduplicatedContactToPayload(
  contact: DeduplicatedAuthorContact,
  customFields?: Record<string, any>
): ProspectingListEntryPayload {
  const primary = contact.primaryEntry;
  return {
    entryId: primary.id,
    authorId: primary.author_id,
    authorName: contact.canonicalName,
    platformId: primary.platform_id,
    publicUrl: primary.public_url || undefined,
    topic: primary.topic || '',
    engagementScore: contact.bestEngagementScore,
    authenticityScore: contact.bestAuthenticityScore,
    influenceScore: contact.bestInfluenceScore,
    relationshipStage: primary.relationship_stage,
    notes: contact.consolidatedNotes.join('\n\n'),
    tags: contact.tags,
    customFields,
    matchedHandles: contact.matchedHandles,
    entryIds: contact.entryIds,
  };
}
