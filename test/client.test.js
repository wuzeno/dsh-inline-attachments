'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function harness({ lateNative = false } = {}) {
  let plugin, source, component, slotConfig;
  const entries = [], listeners = new Set();
  // The shipped composer attachment entry has no explicit priority: it is 0.
  const composerEntries = [{ options: {}, component: function NativeAttachments() {} }];
  const notify = () => { for (const listener of listeners) listener(); };
  const registerNode = (options, comp) => {
    const entry = { options, component: comp, locale: options.locale };
    entries.push(entry); notify();
    return () => { const at = entries.indexOf(entry); if (at >= 0) { entries.splice(at, 1); notify(); } };
  };
  const nativeNodes = () => ['user', 'steering'].map(key => registerNode({ key, locale: 'chat' }, function NativeNode(props) { return props; }));
  if (!lateNative) nativeNodes();
  const cells = []; let cursor = 0; let effects = []; const disposers = [];
  const React = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useRef(initial) { const at = cursor++; return cells[at] ||= { current: initial }; },
    useState(initial) { const at = cursor++; if (!(at in cells)) cells[at] = initial; return [cells[at], value => { cells[at] = value; }]; },
    useEffect(effect, deps) {
      const at = cursor++; const prev = cells[at];
      if (!prev || deps.some((value, i) => value !== prev.deps[i])) {
        prev?.cleanup?.(); const entry = { deps }; cells[at] = entry;
        effects.push(() => { entry.cleanup = effect(); });
      }
    }
  };
  const context = vm.createContext({ console, URL, innerWidth: 1000, document: { createElement() { return { dataset: {}, remove() {} }; }, head: { appendChild() {} } }, window: { __ModuleLoader__: { load(def) { plugin = def.factory(() => React); } } } });
  for (const file of ['core.js', 'history.js', 'slot-mirror.js', 'client.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  const input = { occurrences: [], phase: 'plain', draftRev: 0 };
  let insertCount = 0; const removed = [];
  const ctx = {
    effect(fn) { disposers.push(fn()); },
    inputTriggers: { registerSource(value) { source = value; return () => {}; } },
    uiConversation: { userText: { register() { return () => {}; } } },
    sessions: { binding() { const binding = { ctx: { bail(_scope, name, value) {
      assert.equal(name, 'slash/input-insert-reference'); insertCount++;
      input.occurrences.push({ ...value.reference }); input.draftRev++; return true;
    } } }; return binding; } },
    slots: {
      inject(_name, fn) { disposers.push(fn()); },
      register(config, comp) { if (config.name === 'conversation.chat.node') return registerNode(config, comp); if (config.name === 'conversation.input.attachments') { slotConfig = config; component = comp; composerEntries.push({ options: config, component: comp }); } return () => {}; },
      registerFactory() { throw new Error('slot factory "conversation.chat.user.content" already has a definition'); },
      entries() { return [...entries].sort((a,b) => (a.options.priority ?? 0) - (b.options.priority ?? 0)); },
      subscribe(_name, fn) { listeners.add(fn); return () => listeners.delete(fn); }
    }
  };
  plugin.apply(ctx);
  const actions = { captureInsertion: () => ({ start: 5, end: 5, draftRev: input.draftRev }) };
  const attachments = [{ kind: 'image', id: 'draft-a', file: { name: '猫.png' }, previewUrl: 'blob:cat' }];
  const props = { ...slotConfig.inject('session-a'), inputActions: actions, useInput: selector => { assert.equal(typeof selector, 'function', 'DSH useInput requires a selector function'); return selector(input); }, attachments, uploads: {}, canAcceptDrop: true, onRemoveAttachment: id => removed.push(id) };
  function render() { cursor = 0; effects = []; let tree = component(props); if (typeof tree?.type === 'function') tree = tree.type(tree.props); for (const effect of effects) effect(); return tree; }
  return { source, render, input, props, removed, entries, nativeNodes, registerNode, inserts: () => insertCount, context, pluginComposer: component, activeComposer: () => [...composerEntries].sort((a,b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))[0].component };
}
test('inline composer wins against the shipped native attachment slot at priority zero', () => {
  const host = harness();
  assert.equal(host.activeComposer(), host.pluginComposer);
});
test('client registers native slots and one inline chip per real attachment', () => {
  const host = harness(); host.render(); host.render();
  assert.equal(host.inserts(), 1);
  assert.equal(host.input.occurrences[0].source, 'inline-attachment');
  assert.equal(host.entries.filter(entry => entry.options.priority === -1).length, 2);
  assert.equal(host.entries.length, 4);
});
test('native serializer replaces draft UUID with a same-message ordinal marker', async () => {
  const host = harness(); host.render(); host.render();
  const marker = await host.source.codec.serialize(host.input.occurrences[0].ref);
  assert.match(marker, /dsh-attachment:v1:/);
  assert.ok(!marker.includes('draft-a'));
  const [parsed] = host.context.DshInlineAttachmentCore.parseMarkers(marker);
  assert.equal(parsed.index, 0); assert.equal(parsed.name, '猫.png');
});
test('deleting a chip releases the native attachment after it was observed', () => {
  const host = harness(); host.render(); host.render();
  host.input.occurrences = []; host.input.draftRev++; host.render();
  assert.deepEqual(host.removed, ['draft-a']);
});
test('restored missing draft and incomplete file cannot serialize phantom attachment', () => {
  const host = harness(); host.render();
  const ref = host.input.occurrences[0].ref;
  host.props.attachments = []; host.render();
  assert.throws(() => host.source.codec.serialize(ref), /已失效/);
  host.props.attachments = [{ kind: 'file', id: 'draft-a', file: { name: '报告.pdf' } }]; host.render();
  assert.throws(() => host.source.codec.serialize(ref), /未完成上传/);
});
test('file marker uses durable attachmentId, never receiptId', async () => {
  const host = harness();
  host.props.attachments[0].kind = 'file';
  host.props.uploads = { 'draft-a': { status: 'ready', receiptId: 'private-receipt', file: { attachmentId: 'sha256:' + 'a'.repeat(64) } } };
  host.render();
  const marker = await host.source.codec.serialize(host.input.occurrences[0].ref);
  const [parsed] = host.context.DshInlineAttachmentCore.parseMarkers(marker);
  assert.equal(parsed.attachmentId, 'sha256:' + 'a'.repeat(64));
  assert.ok(!marker.includes('private-receipt'));
});
test('late native registrations and replacements reconcile without recursive registration', () => {
  const host = harness({ lateNative: true });
  assert.equal(host.entries.length, 0);
  const remove = host.nativeNodes();
  assert.equal(host.entries.length, 4);
  remove[0]();
  assert.equal(host.entries.length, 2);
  host.registerNode({ key: 'user', locale: 'chat' }, function NewNative() {});
  assert.equal(host.entries.length, 4);
  assert.equal(host.entries.filter(entry => entry.options.priority === -1).length, 2);
});
test('failed-send attachment restoration does not insert duplicate chips', () => {
  const host = harness(); host.render(); host.render();
  const originals = host.props.attachments;
  const references = host.input.occurrences;
  host.props.attachments = []; host.input.occurrences = []; host.input.draftRev++; host.render();
  host.props.attachments = originals; host.input.occurrences = references; host.input.draftRev++; host.render();
  assert.equal(host.inserts(), 1); assert.deepEqual(host.removed, []);
});
test('failed-send attachments do not contaminate a newer draft', () => {
  const host = harness(); host.render(); host.render();
  const originals = host.props.attachments;
  host.props.attachments = []; host.input.occurrences = []; host.input.draftRev++; host.render();
  host.props.attachments = originals; host.input.draftRev++; host.render();
  assert.equal(host.inserts(), 1); assert.deepEqual(host.removed, []);
});
test('plain clipboard text is readable and has no draft identifiers', () => {
  const host = harness(); host.render();
  const text = host.source.codec.clipboardText(host.input.occurrences[0].ref);
  assert.equal(text, '[附件：猫.png]'); assert.ok(!text.includes('session-a'));
});
test('composer without an active session renders safely', () => {
  const host = harness(); host.props.sessionId = null;
  assert.equal(host.render(), null);
});
