export function snapHtml(html: string): string {
  return html.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->").replace(/lit\$\d+\$/g, "lit$");
}
