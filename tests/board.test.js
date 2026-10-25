const test = require("node:test");
const assert = require("node:assert/strict");
const { boardCard, boardMatch, boardHtml } = require("../board.js");

const issue = (o = {}) => ({ number: 1, html_url: "https://x/1", title: "t", state: "open", labels: [], ...o });
const lab = (...names) => names.map(name => ({ name }));

test("boardCard: hidden issues", () => {
  assert.equal(boardCard(issue({ pull_request: {} })), null);
  assert.equal(boardCard(issue({ state: "closed", state_reason: "not_planned" })), null);
  assert.equal(boardCard(issue({ state: "closed", state_reason: "duplicate" })), null);
});

test("boardCard: type", () => {
  assert.equal(boardCard(issue()).type, "");
  assert.equal(boardCard(issue({ labels: lab("Bug") })).type, "bug");
  assert.equal(boardCard(issue({ labels: lab("idea", "bug") })).type, "bug");
  assert.equal(boardCard(issue({ labels: lab("feedback") })).type, "");
});

test("boardCard: status", () => {
  assert.equal(boardCard(issue()).status, "new");
  assert.equal(boardCard(issue({ labels: lab("to do") })).status, "todo");
  assert.equal(boardCard(issue({ labels: lab("to do", "in progress") })).status, "progress");
  assert.equal(boardCard(issue({ state: "closed", state_reason: "completed", labels: lab("in progress") })).status, "done");
});

test("boardCard: releases", () => {
  assert.deepEqual(boardCard(issue()).releases, []);
  assert.deepEqual(boardCard(issue({ labels: lab("r2", "R1", "R1x", "release 1") })).releases, ["R1", "R2"]);
  assert.deepEqual(boardCard(issue({ labels: lab("R10", "R2") })).releases, ["R2", "R10"]);
});

test("boardCard: fields", () => {
  const c = boardCard(issue({ number: 7, html_url: "u", title: "T" }));
  assert.deepEqual([c.n, c.url, c.title], [7, "u", "T"]);
});

test("boardMatch", () => {
  const c = { type: "bug", status: "new" };
  assert.equal(boardMatch(c, { type: "all", status: "all" }), true);
  assert.equal(boardMatch(c, { type: "idea", status: "all" }), false);
  assert.equal(boardMatch(c, { type: "all", status: "done" }), false);
  assert.equal(boardMatch(c, { type: "bug", status: "new" }), true);
});

test("boardHtml: escaping", () => {
  const h = boardHtml(boardCard(issue({ title: "<img src=x onerror=alert(1)>", html_url: 'u"x' })));
  assert.match(h, /&lt;img/);
  assert.doesNotMatch(h, /<img/);
  assert.match(h, /href="u&quot;x"/);
});

test("boardHtml: content", () => {
  const none = boardHtml(boardCard(issue()));
  assert.doesNotMatch(none, /Bug|Idea/);
  assert.match(none, /#1/);
  assert.match(none, /New/);
  assert.match(boardHtml(boardCard(issue({ labels: lab("idea") }))), /Idea/);
  const two = boardHtml(boardCard(issue({ labels: lab("R1", "R2") })));
  assert.equal(two.split('class="rel"').length - 1, 2);
});
