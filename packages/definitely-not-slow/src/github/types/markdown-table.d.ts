declare module 'markdown-table' {
  export type ColumnAlignment = 'l' | 'r' | 'c' | '.' | '';
  export interface MarkdownTableOptions {
    /**
     * One style for all columns, or styles for their respective columns (`string` or `string[]`).
     * Each style is either `'l'` (left), `'r'` (right), `'c'` (centre), or `'.'` (dot). Other values are treated
     * as `''`, which doesn’t place the colon but does left align. Only the lowercased first character is
     * used, so Right is fine.
     */
    align?: ColumnAlignment | ColumnAlignment[];
    /**
     * Value to insert between cells (`string`, default: `' | '`). Careful, setting this to a non-pipe breaks GitHub
     * Flavoured Markdown.
     */
    delimiter?: string;
    /**
     * Value to insert at the beginning of every row (`string`, default: `'| '`).
     */
    start?: string;
    /**
     * Value to insert at the end of every row (`string`, default: `' |'`).
     */
    end?: string;
    /**
     * Whether to display a rule between the header and the body of the table (`boolean`, default: `true`).  Careful,
     * will break GitHub Flavoured Markdown when `false`.
     */
    rule?: boolean;
    /**
     * Method to detect the length of a cell (`Function`, default: `s => s.length`).
     *
     * ANSI-sequences mess up tables on terminals.  To fix this, you have to pass in a `stringLength` option to detect
     * the “visible” length of a cell.
     * 
     * @example
     * var strip = require('strip-ansi')
     * 
     * function stringLength(cell) {
     *   return strip(cell).length
     * }
     */
    stringLength?: (cellContents: string) => number;
    /**
     * Whether to pad the markdown for table cells to make them the same width (`boolean`, default: `true`).  Setting
     * this to false will cause the table rows to remain staggered.
     */
    pad?: boolean;
  }

  /**
   * Turns a given matrix of strings (an array of arrays of strings) into a table.
   */
  function table(rows: string[][], options?: MarkdownTableOptions): string;
  export = table;
}