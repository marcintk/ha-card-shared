/**
 * Normalize Lit's non-deterministic marker IDs in rendered HTML so snapshots
 * stay stable across module loads. Lit injects `<!--?lit$013215205$-->` and
 * binding IDs like `lit$013215205$` whose numbers change every run.
 */
function snapHtml(html) {
    return html
        .replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->")
        .replace(/lit\$\d+\$/g, "lit$");
}

export { snapHtml };
