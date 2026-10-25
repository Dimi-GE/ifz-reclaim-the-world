/* Board logic: GitHub issue -> card. Pure functions, no DOM (browser: globals; Node: exports for tests). */
const BOARD_STATUS = {
  new: { text: "New", cls: "s-open" },
  todo: { text: "To do", cls: "s-planned" },
  progress: { text: "In progress", cls: "s-progress" },
  done: { text: "Done", cls: "s-done" },
};
const BOARD_TYPE = { bug: "Bug", idea: "Idea" };

function boardCard(issue) {
  if (issue.pull_request) return null;
  const closed = issue.state === "closed";
  if (closed && (issue.state_reason === "not_planned" || issue.state_reason === "duplicate")) return null;
  const labels = (issue.labels || []).map(l => String(l.name).trim().toLowerCase());
  const type = ["bug", "idea"].find(t => labels.includes(t)) || "";
  const status = closed ? "done"
    : labels.includes("in progress") ? "progress"
    : labels.includes("to do") ? "todo" : "new";
  const releases = labels.filter(l => /^r\d+$/.test(l)).sort((a, b) => a.slice(1) - b.slice(1)).map(l => l.toUpperCase());
  return { n: issue.number, url: issue.html_url, title: issue.title, type, status, releases };
}

function boardMatch(card, f) {
  return (f.type === "all" || card.type === f.type) && (f.status === "all" || card.status === f.status);
}

function boardEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function boardHtml(card) {
  const s = BOARD_STATUS[card.status], url = boardEsc(card.url);
  const meta = (BOARD_TYPE[card.type] ? boardEsc(BOARD_TYPE[card.type]) : "")
    + card.releases.map(r => `<span class="rel">${boardEsc(r)}</span>`).join("");
  return `<li class="issue">`
    + `<a class="issue-num" href="${url}">#${boardEsc(card.n)}</a>`
    + `<a class="issue-title" href="${url}">${boardEsc(card.title)}</a>`
    + `<span class="status ${s.cls}">${s.text}</span>`
    + `<span class="issue-cat">${meta}</span></li>`;
}

if (typeof module === "object") module.exports = { boardCard, boardMatch, boardHtml };
