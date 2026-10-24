// Exercise the versions actually resolved by the rendering and build packages.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const project = createRequire(path.resolve(process.cwd(), 'package.json'));
const renderer = createRequire(project.resolve('@ronradtke/react-native-markdown-display/package.json'));
const MarkdownIt = renderer('markdown-it');
const md = new MarkdownIt({ html: false, linkify: true });
assert.match(md.render('# Title'), /<h1>Title<\/h1>/);
assert.match(md.render('**bold**'), /<strong>bold<\/strong>/);
assert.match(md.render('```js\nconst x=1\n```'), /language-js/);
assert.match(md.render('[site](https://example.com)'), /href="https:\/\/example.com"/);
assert.doesNotMatch(md.render('[bad](javascript:alert(1))'), /href=/);
assert.match(md.render('<script>alert(1)</script>'), /&lt;script&gt;/);
const plistModule = project('@expo/plist');
const plist = plistModule.default || plistModule;
const value = { name: 'Own', enabled: true, count: 3 };
assert.deepEqual(plist.parse(plist.build(value)), value);
project('xml2js').parseString('<root><name>Own</name></root>', (error, result) => {
  assert.ifError(error);
  assert.equal(result.root.name[0], 'Own');
});
assert.deepEqual(project('shell-quote').parse("echo 'Own test'"), ['echo', 'Own test']);
console.log('PASS: resolved Markdown safety/formatting and plist/XML/shell APIs');
