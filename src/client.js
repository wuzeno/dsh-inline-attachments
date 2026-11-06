window.__ModuleLoader__.load({
  id: 'dsh-inline-attachments',
  factory(require) {
    'use strict';
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useRef, useState } = React;
    const core = globalThis.DshInlineAttachmentCore;
    const history = globalThis.DshInlineAttachmentHistory.create(React, core);
    const SOURCE = 'inline-attachment';
    const PREFIX = 'dsh-inline-draft:';
    const snapshots = new Map();
    const CSS = `${history.CSS}
.dshia-intake{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:4px 10px;color:var(--dsw-alias-label-secondary);font:12px/1.6 inherit}
.dshia-intake button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);padding:3px 8px}
.dshia-intake button:disabled{opacity:.5;cursor:default}.dshia-error{color:var(--dsw-alias-state-error-primary)}
.dshia-pop{position:fixed;z-index:10000;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px;box-shadow:0 8px 32px #0004;pointer-events:none;max-width:260px}
.dshia-pop img{display:block;max-width:240px;max-height:180px;object-fit:contain}
.dshia-dialog{position:fixed;inset:0;margin:auto;max-width:min(90vw,1000px);max-height:85vh;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshia-dialog::backdrop{background:#0009}.dshia-dialog img{display:block;max-width:80vw;max-height:65vh;object-fit:contain}.dshia-dialog pre{max-width:75vw;max-height:60vh;overflow:auto;white-space:pre-wrap}.dshia-dialog a{color:var(--dsw-alias-brand-primary)}
[data-composer-chip="inline-attachment"]{vertical-align:baseline}
`;
    function makeRef(sessionId, item) { return PREFIX + encodeURIComponent(JSON.stringify({ sessionId, draftId: item.id, name: item.file.name })); }
    function parseRef(ref) {
      try {
        if (!ref.startsWith(PREFIX)) return null;
        const value = JSON.parse(decodeURIComponent(ref.slice(PREFIX.length)));
        return typeof value.sessionId === 'string' && typeof value.draftId === 'string' ? value : null;
      } catch { return null; }
    }
    function DraftPreview({ item, close }) {
      const dialog = useRef(null);
      const [text, setText] = useState(null);
      const [url, setUrl] = useState('');
      useEffect(() => {
        const node = dialog.current;
        node.showModal();
        const objectUrl = URL.createObjectURL(item.file);
        setUrl(objectUrl);
        let active = true;
        const isText = /^(text\/|application\/(json|xml))/.test(item.file.type) || /\.(txt|md|csv|log|json|xml|ya?ml|[cm]?js|ts|py)$/i.test(item.file.name);
        if (isText && item.file.size <= 2 * 1024 * 1024) item.file.text().then(value => { if (active) setText(value); }, () => { if (active) setText('无法读取文件。'); });
        return () => { active = false; URL.revokeObjectURL(objectUrl); };
      }, [item]);
      return h('dialog', { ref: dialog, className: 'dshia-dialog', onCancel: close, onClick: e => { if (e.target === e.currentTarget) close(); } },
        h('div', null, h('strong', null, item.file.name), ' ', h('button', { type: 'button', onClick: close }, '关闭')),
        item.kind === 'image' ? h('img', { src: item.previewUrl || url, alt: item.file.name }) : text !== null ? h('pre', null, text) : h('p', null, '此格式暂不内嵌解析，可下载后用本机应用查看。'),
        h('a', { href: url || undefined, download: item.file.name }, '下载原文件'));
    }
    function Intake(props) {
      if (!props.sessionId || !props.useInput || !props.inputActions) return null;
      return h(LiveIntake, props);
    }
    function LiveIntake({ attachments = [], uploads = {}, canAcceptDrop, onAddFiles, onRemoveAttachment, onRetryFile, inputActions, useInput, sessionId, insertChip, registerPreview }) {
      const input = useInput(state => state);
      const root = useRef(null);
      const picker = useRef(null);
      const tracked = useRef(new Map());
      const reserved = useRef(null);
      const pickerSpan = useRef(null);
      const [error, setError] = useState('');
      const [preview, setPreview] = useState(null);
      const [hover, setHover] = useState(null);
      // The serializer is called synchronously before the native draft is detached.
      snapshots.set(sessionId, { attachments, uploads });
      registerPreview.current = id => {
        const item = snapshots.get(sessionId)?.attachments.find(a => a.id === id);
        if (!item) { setError('附件已失效，请删除标签并重新选择文件。'); return; }
        setPreview(item);
      };
      useEffect(() => () => { snapshots.delete(sessionId); registerPreview.current = null; }, [sessionId]);
      const add = (files, span) => {
        if (!files.length || !canAcceptDrop) return;
        reserved.current = span || inputActions.captureInsertion();
        const result = onAddFiles(files);
        if (result) { reserved.current = null; setError(String(result)); }
      };
      // Native file picker, paste and drag intake all converge on this list.
      useEffect(() => {
        let span = reserved.current;
        reserved.current = null;
        for (const item of attachments) {
          if (tracked.current.has(item.id)) continue;
          const ref = makeRef(sessionId, item);
          const alreadyPresent = (input.occurrences || []).some(o => o.source === SOURCE && o.ref === ref);
          const applied = alreadyPresent || insertChip({ source: SOURCE, ref, label: item.file.name || '未命名附件', appearance: item.kind === 'image' ? 'reference' : 'file', clipboardText: '[附件：' + (item.file.name || '未命名附件') + ']' }, span || inputActions.captureInsertion());
          tracked.current.set(item.id, { ref, applied, seen: false });
          span = null;
          if (!applied) setError('原插入位置已改变：附件仍保留，可点击“插入标签”放到当前光标处。');
        }
      }, [attachments, sessionId, inputActions, insertChip]);
      useEffect(() => {
        const present = new Set((input.occurrences || []).filter(o => o.source === SOURCE).map(o => o.ref));
        for (const item of attachments) {
          const record = tracked.current.get(item.id);
          if (!record) continue;
          if (present.has(record.ref)) { record.seen = true; record.applied = true; }
          else if (record.seen && input.phase !== 'submitting' && input.phase !== 'adjudicating') {
            record.seen = false;
            onRemoveAttachment(item.id);
          }
        }
        // Keep lightweight tombstones: failed-send restoration is not a fresh upload.
        for (const [id, record] of tracked.current) if (!attachments.some(item => item.id === id)) { record.seen = false; record.applied = false; }
      }, [input.draftRev, input.phase, attachments, onRemoveAttachment]);
      useEffect(() => {
        const card = root.current?.closest('[data-composer-card]');
        if (!card) return;
        const paste = e => {
          const files = Array.from(e.clipboardData?.files || []);
          if (!canAcceptDrop || !files.length) return;
          e.preventDefault(); e.stopPropagation(); add(files);
        };
        const drop = e => {
          const files = Array.from(e.dataTransfer?.files || []);
          if (!canAcceptDrop || !files.length) return;
          e.preventDefault(); e.stopPropagation(); add(files);
        };
        const over = e => { if (canAcceptDrop && Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault(); };
        const hoverIn = e => {
          const chip = e.target.closest?.('[data-composer-chip="inline-attachment"]');
          if (!chip || chip.contains(e.relatedTarget)) return;
          const nodes = Array.from(card.querySelectorAll('[data-composer-chip="inline-attachment"]'));
          const occurrence = (input.occurrences || []).filter(o => o.source === SOURCE)[nodes.indexOf(chip)];
          const ref = occurrence && parseRef(occurrence.ref);
          const item = attachments.find(a => a.id === ref?.draftId);
          if (item?.kind !== 'image') return;
          const bounds = chip.getBoundingClientRect();
          setHover({ item, left: Math.min(bounds.left, Math.max(4, innerWidth - 272)), top: Math.max(4, bounds.top - 220) });
        };
        const hoverOut = e => { if (e.target.closest?.('[data-composer-chip="inline-attachment"]') && !e.target.closest('[data-composer-chip]').contains(e.relatedTarget)) setHover(null); };
        card.addEventListener('paste', paste, true); card.addEventListener('drop', drop, true); card.addEventListener('dragover', over, true);
        card.addEventListener('mouseover', hoverIn); card.addEventListener('mouseout', hoverOut);
        return () => { card.removeEventListener('paste', paste, true); card.removeEventListener('drop', drop, true); card.removeEventListener('dragover', over, true); card.removeEventListener('mouseover', hoverIn); card.removeEventListener('mouseout', hoverOut); };
      }, [attachments, input.occurrences, canAcceptDrop]);
      const occurrences = new Set((input.occurrences || []).filter(o => o.source === SOURCE).map(o => o.ref));
      const missing = (input.occurrences || []).filter(o => o.source === SOURCE).map(o => parseRef(o.ref)).filter(ref => ref && !attachments.some(a => a.id === ref.draftId));
      return h(React.Fragment, null,
        h('div', { ref: root, className: 'dshia-intake', 'data-inline-attachment-intake': sessionId },
          h('button', { type: 'button', disabled: !canAcceptDrop, onMouseDown: e => { e.preventDefault(); pickerSpan.current = inputActions.captureInsertion(); }, onClick: () => { pickerSpan.current ||= inputActions.captureInsertion(); picker.current.click(); } }, '行内附件'),
          h('input', { ref: picker, type: 'file', multiple: true, hidden: true, onCancel: () => { pickerSpan.current = null; }, onChange: e => { const files = Array.from(e.target.files); e.target.value = ''; const span = pickerSpan.current; pickerSpan.current = null; add(files, span); } }),
          attachments.map(item => {
            const upload = uploads[item.id];
            const record = tracked.current.get(item.id);
            const bound = occurrences.has(makeRef(sessionId, item));
            return h('span', { key: item.id },
              !bound && h('button', { type: 'button', onMouseDown: e => e.preventDefault(), onClick: () => {
                const applied = insertChip({ source: SOURCE, ref: makeRef(sessionId, item), label: item.file.name || '附件', appearance: 'file', clipboardText: '[附件：' + (item.file.name || '未命名附件') + ']' }, inputActions.captureInsertion());
                if (record) { record.applied = applied; record.seen = false; }
                if (!applied) setError('当前不能插入，请点击输入框后重试。');
              } }, `插入标签：${item.file.name}`),
              upload?.status === 'uploading' && h('span', null, `${item.file.name} 上传中… `),
              upload?.status === 'error' && h('button', { type: 'button', onClick: () => onRetryFile(item.id), className: 'dshia-error' }, `${item.file.name} 上传失败，重试`),
              (!bound || upload?.status === 'error') && h('button', { type: 'button', onClick: () => onRemoveAttachment(item.id), 'aria-label': `移除 ${item.file.name}` }, '×'));
          }),
          missing.length > 0 && h('span', { className: 'dshia-error', role: 'alert' }, '部分标签对应文件已丢失，请删除失效标签后重新添加。'),
          error && h('button', { type: 'button', className: 'dshia-error', onClick: () => setError('') }, error)),
        hover && h('div', { className: 'dshia-pop', style: { left: hover.left, top: hover.top } }, h('img', { src: hover.item.previewUrl, alt: hover.item.file.name })),
        preview && h(DraftPreview, { item: preview, close: () => setPreview(null) }));
    }
    return {
      inject: ['slots', 'sessions', 'inputTriggers', 'uiConversation'],
      apply(ctx) {
        const previews = new Map();
        ctx.effect(() => {
          const tag = document.createElement('style'); tag.dataset.plugin = 'dsh-inline-attachments'; tag.textContent = CSS; document.head.appendChild(tag);
          return () => { tag.remove(); snapshots.clear(); previews.clear(); };
        });
        // Native transcript/queue/echo text must never expose encoded metadata.
        // This also supplies a readable fallback if a rich-body adapter is unavailable.
        ctx.effect(() => ctx.uiConversation.userText.register(history.markerRule));
        ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register({
          name: 'conversation.user.text.node', key: 'inline-attachment-token', priority: -100
        }, history.MarkerTextNode));
        ctx.effect(() => ctx.inputTriggers.registerSource({
          trigger: '@', name: SOURCE, async candidates() { return []; },
          codec: {
            clipboardText: ref => '[附件：' + (parseRef(ref)?.name || '需重新附加') + ']',
            serialize(ref) {
              const value = parseRef(ref);
              const snapshot = value && snapshots.get(value.sessionId);
              const index = snapshot?.attachments.findIndex(item => item.id === value.draftId) ?? -1;
              if (index < 0) throw new Error('行内附件已失效，请删除标签并重新添加文件。');
              const item = snapshot.attachments[index];
              const upload = snapshot.uploads[item.id];
              if (item.kind === 'file' && upload?.status !== 'ready') throw new Error('行内文件未完成上传，请等待或重试。');
              return Promise.resolve(core.encodeMarker({ index, kind: item.kind, name: item.file.name || '未命名附件', ...(item.kind === 'file' ? { attachmentId: upload.file.attachmentId } : {}) }));
            }
          },
          openReference(session, reference) {
            const value = parseRef(reference.ref);
            if (!value || value.sessionId !== session.sessionId) return false;
            const preview = previews.get(value.sessionId);
            preview?.current?.(value.draftId);
            return true;
          }
        }));
        ctx.slots.inject('conversation.input.attachments', () => ctx.slots.register({
          // The native composer rail defaults to priority 0 (unlike image slots at 100).
          // Lower numbers win: a positive priority silently leaves the native rail active.
          name: 'conversation.input.attachments', priority: -100,
          inject: sessionId => {
            if (!previews.has(sessionId)) previews.set(sessionId, { current: null });
            return { sessionId, registerPreview: previews.get(sessionId), insertChip: (reference, span) => {
              const binding = ctx.sessions.binding(sessionId);
              return binding?.ctx.bail(binding.ctx, 'slash/input-insert-reference', { reference, span }) === true;
            } };
          }
        }, Intake));
        const slotMirror = globalThis.DshInlineSlotMirror.create(React, ctx.slots);
        ctx.slots.inject('conversation.chat.node', () => {
          const installed = new Map();
          const ownComponents = new WeakSet();
          let busy = false;
          const reconcile = () => {
            if (busy) return;
            busy = true;
            try {
              for (const key of ['user', 'steering']) {
                const original = ctx.slots.entries('conversation.chat.node').find(entry => entry.options.key === key && !ownComponents.has(entry.component));
                const old = installed.get(key);
                if (old?.original === original) continue;
                old?.dispose(); installed.delete(key);
                if (!original) continue;
                const shadow = slotMirror.mount(original, {
                  name: 'conversation.chat.node', key,
                  priority: (original.options.priority ?? 0) - 1,
                  locale: original.locale ?? 'chat'
                }, history.createNodeWrapper);
                ownComponents.add(shadow.component);
                installed.set(key, { original, dispose: shadow.dispose });
              }
            } finally { busy = false; }
          };
          const unsubscribe = ctx.slots.subscribe('conversation.chat.node', reconcile);
          reconcile();
          return () => { unsubscribe(); for (const entry of installed.values()) entry.dispose(); installed.clear(); };
        });
      }
    };
  }
});
