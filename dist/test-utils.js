function snapHtml(html) {
    return html.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->").replace(/lit\$\d+\$/g, "lit$");
}

export { snapHtml };
