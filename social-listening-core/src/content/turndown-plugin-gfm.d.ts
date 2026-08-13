/**
 * turndown-plugin-gfm@1.0.2 ships no TypeScript types of its own and no
 * @types package exists for it (checked directly, ADR-0053) — this is a
 * minimal ambient declaration for the one named export this project uses.
 */
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';

  export function tables(turndownService: TurndownService): void;
  export function gfm(turndownService: TurndownService): void;
  export function strikethrough(turndownService: TurndownService): void;
  export function taskListItems(turndownService: TurndownService): void;
  export function highlightedCodeBlock(turndownService: TurndownService): void;
}
