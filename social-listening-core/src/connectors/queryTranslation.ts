import {
  WatchlistAST,
  WatchlistClause,
  WatchlistClauseType,
  WatchlistOperator,
} from '../watchlists/ast';

/**
 * A translated native query for a platform's search API.
 */
export interface NativeQuery {
  query: string;
  params?: Record<string, string>;
}

/**
 * Result of validating a WatchlistAST against a connector's capabilities.
 */
export interface AstValidationResult {
  valid: boolean;
  code?: 'UNSUPPORTED_QUERY_CLAUSE' | 'QUERY_TOO_LONG' | 'TOO_MANY_CLAUSES';
  offendingClause?: WatchlistClause;
  reason?: string;
  warnings?: string[];
}

/**
 * Per-connector translator conforming to ADR-0110.
 */
export interface ConnectorQueryTranslator {
  platformId: string;
  supportedClauses: WatchlistClauseType[];
  supportedOperators: WatchlistOperator[];
  maxClauseCount: number;
  maxQueryLength: number;
  translate(ast: WatchlistAST): NativeQuery | null;
  validate(ast: WatchlistAST): AstValidationResult;
}

type AuthorRenderMode = 'from' | 'author' | 'param:channelId';

type DateRenderMode = 'fromTo' | 'publishedAfterBefore';

type SourceRenderMode = 'site' | 'source';

interface ClauseRenderOptions {
  /** True to wrap phrase clauses in double quotes. */
  phrase: boolean;
  /** True to render hashtag clauses as `#value`. */
  hashtag: boolean;
  /** True to render mention clauses as `@value`. */
  mention: boolean;
  /** How to render an author clause, or false if unsupported. */
  author: AuthorRenderMode | false;
  /** How to render a non-platform source clause, or false if unsupported. */
  source: SourceRenderMode | false;
  /** How to map date clauses into params, or false if unsupported. */
  date: DateRenderMode | false;
}

interface TranslatorProfile {
  platformId: string;
  supportedClauses: WatchlistClauseType[];
  supportedOperators: WatchlistOperator[];
  maxClauseCount: number;
  maxQueryLength: number;
  renderOptions: ClauseRenderOptions;
}

function cleanHashTag(value: string): string {
  return value.replace(/^#+/, '');
}

function cleanMention(value: string): string {
  return value.replace(/^@+/, '');
}

function chooseDate(valueA: string | undefined, valueB: string, preferMax: boolean): string {
  if (valueA === undefined) return valueB;
  if (preferMax) {
    return valueA > valueB ? valueA : valueB;
  }
  return valueA < valueB ? valueA : valueB;
}

function setFromToParams(params: Record<string, string>, clause: WatchlistClause & { type: 'date' }): void {
  switch (clause.operator) {
    case '>=':
      params.from = chooseDate(params.from, clause.value, true);
      break;
    case '>':
      params.from = chooseDate(params.from, clause.value, true);
      break;
    case '<=':
      params.to = chooseDate(params.to, clause.value, false);
      break;
    case '<':
      params.to = chooseDate(params.to, clause.value, false);
      break;
    case '=':
      params.from = chooseDate(params.from, clause.value, true);
      params.to = chooseDate(params.to, clause.value, false);
      break;
    default:
      break;
  }
}

function setPublishedParams(params: Record<string, string>, clause: WatchlistClause & { type: 'date' }): void {
  switch (clause.operator) {
    case '>=':
      params.publishedAfter = chooseDate(params.publishedAfter, clause.value, true);
      break;
    case '>':
      params.publishedAfter = chooseDate(params.publishedAfter, clause.value, true);
      break;
    case '<=':
      params.publishedBefore = chooseDate(params.publishedBefore, clause.value, false);
      break;
    case '<':
      params.publishedBefore = chooseDate(params.publishedBefore, clause.value, false);
      break;
    case '=':
      params.publishedAfter = chooseDate(params.publishedAfter, clause.value, true);
      params.publishedBefore = chooseDate(params.publishedBefore, clause.value, false);
      break;
    default:
      break;
  }
}

function renderLeafClause(
  clause: WatchlistClause,
  platformId: string,
  params: Record<string, string>,
  options: ClauseRenderOptions
): string | undefined | null {
  switch (clause.type) {
    case 'keyword':
      return clause.value;

    case 'phrase':
      if (!options.phrase) return null;
      return `"${clause.value}"`;

    case 'hashtag':
      if (!options.hashtag) return null;
      return `#${cleanHashTag(clause.value)}`;

    case 'mention':
      if (!options.mention) return null;
      return `@${cleanMention(clause.value)}`;

    case 'author': {
      if (!options.author) return null;
      if (options.author === 'param:channelId') {
        params.channelId = clause.value;
        return undefined;
      }
      return `${options.author}:${clause.value}`;
    }

    case 'source': {
      if (!options.source) return null;
      if (clause.value.toLowerCase() === platformId) return undefined;
      const prefix = options.source === 'site' ? 'site' : 'source';
      return `${prefix}:${clause.value}`;
    }

    case 'date': {
      if (!options.date) return null;
      if (options.date === 'fromTo') {
        setFromToParams(params, clause as WatchlistClause & { type: 'date' });
      } else {
        setPublishedParams(params, clause as WatchlistClause & { type: 'date' });
      }
      return undefined;
    }

    case 'sentiment':
      return null;

    default:
      return null;
  }
}

function buildGroupQuery(
  operator: WatchlistOperator,
  clauses: WatchlistClause[],
  profile: TranslatorProfile,
  params: Record<string, string>
): string | null {
  const fragments: string[] = [];

  for (const clause of clauses) {
    let fragment: string | undefined | null;

    if (clause.type === 'nested') {
      fragment = buildGroupQuery(clause.operator, clause.clauses, profile, params);
    } else {
      fragment = renderLeafClause(clause, profile.platformId, params, profile.renderOptions);
    }

    if (fragment === null) {
      return null;
    }
    if (fragment !== undefined && fragment !== '') {
      fragments.push(fragment);
    }
  }

  if (fragments.length === 0) {
    return '';
  }

  if (operator === 'NOT') {
    if (fragments.length === 1) {
      return `NOT (${fragments[0]})`;
    }
    return `NOT (${fragments.join(' OR ')})`;
  }

  return fragments.join(` ${operator} `);
}

function buildNativeQuery(ast: WatchlistAST, profile: TranslatorProfile): NativeQuery | null {
  const params: Record<string, string> = {};
  const query = buildGroupQuery(ast.operator, ast.clauses, profile, params);
  if (query === null) return null;
  return {
    query,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

function createTranslator(profile: TranslatorProfile): ConnectorQueryTranslator {
  const supportedClauseSet = new Set<WatchlistClauseType>(profile.supportedClauses);
  const supportedOperatorSet = new Set<WatchlistOperator>(profile.supportedOperators);

  function validateClauses(clauses: WatchlistClause[], total: { count: number }): AstValidationResult | null {
    for (const clause of clauses) {
      total.count += 1;

      if (!supportedClauseSet.has(clause.type)) {
        return {
          valid: false,
          code: 'UNSUPPORTED_QUERY_CLAUSE',
          offendingClause: clause,
          reason: `Platform '${profile.platformId}' does not support clause type '${clause.type}'.`,
        };
      }

      if (clause.type === 'nested') {
        if (!supportedOperatorSet.has(clause.operator)) {
          return {
            valid: false,
            code: 'UNSUPPORTED_QUERY_CLAUSE',
            offendingClause: clause,
            reason: `Platform '${profile.platformId}' does not support nested operator '${clause.operator}'.`,
          };
        }
        const nested = validateClauses(clause.clauses, total);
        if (nested) return nested;
      }
    }
    return null;
  }

  return {
    platformId: profile.platformId,
    supportedClauses: profile.supportedClauses,
    supportedOperators: profile.supportedOperators,
    maxClauseCount: profile.maxClauseCount,
    maxQueryLength: profile.maxQueryLength,

    translate(ast: WatchlistAST): NativeQuery | null {
      return buildNativeQuery(ast, profile);
    },

    validate(ast: WatchlistAST): AstValidationResult {
      if (!supportedOperatorSet.has(ast.operator)) {
        return {
          valid: false,
          code: 'UNSUPPORTED_QUERY_CLAUSE',
          reason: `Platform '${profile.platformId}' does not support root operator '${ast.operator}'.`,
        };
      }

      const total = { count: 0 };
      const clauseError = validateClauses(ast.clauses, total);
      if (clauseError) return clauseError;

      if (total.count > profile.maxClauseCount) {
        return {
          valid: false,
          code: 'TOO_MANY_CLAUSES',
          reason: `Query exceeds maximum clause limit of ${profile.maxClauseCount} for platform '${profile.platformId}'.`,
        };
      }

      const native = buildNativeQuery(ast, profile);
      if (!native) {
        return {
          valid: false,
          code: 'UNSUPPORTED_QUERY_CLAUSE',
          reason: `Platform '${profile.platformId}' could not translate the query.`,
        };
      }

      if (native.query.length > profile.maxQueryLength) {
        return {
          valid: false,
          code: 'QUERY_TOO_LONG',
          reason: `Query exceeds maximum length of ${profile.maxQueryLength} for platform '${profile.platformId}'.`,
        };
      }

      return { valid: true, warnings: [] };
    },
  };
}

function newsRenderOptions(
  source: SourceRenderMode | false,
  date: DateRenderMode | false,
  author: AuthorRenderMode | false = false
): ClauseRenderOptions {
  return {
    phrase: true,
    hashtag: false,
    mention: false,
    author,
    source,
    date,
  };
}

function socialRenderOptions(options: Partial<ClauseRenderOptions>): ClauseRenderOptions {
  return {
    phrase: options.phrase ?? true,
    hashtag: options.hashtag ?? false,
    mention: options.mention ?? false,
    author: options.author ?? 'from',
    source: options.source ?? false,
    date: options.date ?? false,
  };
}

const TRANSLATOR_PROFILES: Record<string, TranslatorProfile> = {
  gnews: {
    platformId: 'gnews',
    supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 20,
    maxQueryLength: 500,
    renderOptions: newsRenderOptions('site', 'fromTo'),
  },
  newswire: {
    platformId: 'newswire',
    supportedClauses: ['keyword', 'phrase', 'author', 'source', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 25,
    maxQueryLength: 500,
    renderOptions: newsRenderOptions('source', 'fromTo', 'author'),
  },
  'brave-search': {
    platformId: 'brave-search',
    supportedClauses: ['keyword', 'phrase', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 15,
    maxQueryLength: 400,
    renderOptions: newsRenderOptions(false, 'fromTo'),
  },
  'bing-search': {
    platformId: 'bing-search',
    supportedClauses: ['keyword', 'phrase', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 15,
    maxQueryLength: 400,
    renderOptions: newsRenderOptions(false, 'fromTo'),
  },
  facebook: {
    platformId: 'facebook',
    supportedClauses: ['keyword', 'phrase', 'mention', 'author', 'nested'],
    supportedOperators: ['AND', 'OR'],
    maxClauseCount: 10,
    maxQueryLength: 300,
    renderOptions: socialRenderOptions({ phrase: true, mention: true, author: 'from' }),
  },
  instagram: {
    platformId: 'instagram',
    supportedClauses: ['keyword', 'hashtag', 'mention', 'author'],
    supportedOperators: ['AND', 'OR'],
    maxClauseCount: 10,
    maxQueryLength: 200,
    renderOptions: socialRenderOptions({
      phrase: false,
      hashtag: true,
      mention: true,
      author: 'from',
    }),
  },
  linkedin: {
    platformId: 'linkedin',
    supportedClauses: ['keyword', 'phrase', 'hashtag', 'mention', 'author', 'nested'],
    supportedOperators: ['AND', 'OR'],
    maxClauseCount: 10,
    maxQueryLength: 300,
    renderOptions: socialRenderOptions({
      phrase: true,
      hashtag: true,
      mention: true,
      author: 'from',
    }),
  },
  youtube: {
    platformId: 'youtube',
    supportedClauses: ['keyword', 'phrase', 'hashtag', 'author', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 20,
    maxQueryLength: 500,
    renderOptions: {
      phrase: true,
      hashtag: true,
      mention: false,
      author: 'param:channelId',
      source: false,
      date: 'publishedAfterBefore',
    },
  },
  wikipedia: {
    platformId: 'wikipedia',
    supportedClauses: ['keyword', 'phrase', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 20,
    maxQueryLength: 500,
    renderOptions: {
      phrase: true,
      hashtag: false,
      mention: false,
      author: false,
      source: false,
      date: false,
    },
  },
  'tenant-owned-feed': {
    platformId: 'tenant-owned-feed',
    supportedClauses: ['keyword', 'phrase', 'author', 'source', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    maxClauseCount: 20,
    maxQueryLength: 500,
    renderOptions: newsRenderOptions('source', 'fromTo', 'author'),
  },
};

const TRANSLATORS = new Map<string, ConnectorQueryTranslator>();
for (const [platformId, profile] of Object.entries(TRANSLATOR_PROFILES)) {
  TRANSLATORS.set(platformId, createTranslator(profile));
}

/**
 * Returns the ConnectorQueryTranslator for a platform, or null if unregistered.
 */
export function getConnectorQueryTranslator(platformId: string): ConnectorQueryTranslator | null {
  const normId = platformId.toLowerCase().trim();
  return TRANSLATORS.get(normId) ?? null;
}
