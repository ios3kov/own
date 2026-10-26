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
// Verify the patched parser versions through their real consumers, not only direct imports.
const fs = require('node:fs');
const metroRoot = path.dirname(project.resolve('metro/package.json'));
const metroAssets = project(path.join(metroRoot, 'src/Assets.js'));
assert.deepEqual(metroAssets.getAssetSize('png', fs.readFileSync('ios/Own/Images.xcassets/AppIcon.appiconset/icon-60.png'), 'icon.png'), {width:60,height:60});
const xcode = project('xcode');
const parsedProject = xcode.project('ios/Own.xcodeproj/project.pbxproj');
parsedProject.parseSync();
assert.match(parsedProject.generateUuid(), /^[A-F0-9]{24}$/);
assert.match(parsedProject.writeSync(), /Own/);
const hooks = project('eslint-plugin-react-hooks');
assert.equal(typeof hooks.rules['rules-of-hooks'].create, 'function');
console.log('PASS: actual Metro image, Xcode UUID/project and ESLint consumer APIs');
// Metro also probes image paths during asset bundling; this differs from its buffer helper.
metroAssets.getAssetData(path.resolve('ios/Own/Images.xcassets/AppIcon.appiconset/icon-60.png'),'icon.png',[],null,'/assets')
  .then(asset=>{assert.equal(asset.width,60);assert.equal(asset.height,60);console.log('PASS: actual Metro file-path asset transform');})
  .catch(error=>{console.error(error);process.exitCode=1;});
