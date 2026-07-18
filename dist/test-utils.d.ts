/**
 * Normalize Lit's non-deterministic marker IDs in rendered HTML so snapshots
 * stay stable across module loads. Lit injects `<!--?lit$013215205$-->` and
 * binding IDs like `lit$013215205$` whose numbers change every run.
 */
export declare function snapHtml(html: string): string;
