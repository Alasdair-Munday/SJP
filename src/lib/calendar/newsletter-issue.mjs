/**
 * Choose an approved thought from the selected Monday–Sunday issue week.
 * @template {{id:string, data:{published:boolean, body:string, issueDate:Date}}} T
 * @param {T[]} issues
 * @param {Date} start
 * @param {Date} end
 * @returns {T | undefined}
 */
export function selectNewsletterIssue(issues, start, end) {
  return issues.filter((entry) => entry.data.published && entry.data.body.trim()
    && entry.data.issueDate >= start && entry.data.issueDate < end)
    .sort((a, b) => +b.data.issueDate - +a.data.issueDate || a.id.localeCompare(b.id))[0];
}
