/* Companion renderer factory: use as conversation.chat.user.content Factory. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DshInlineAttachmentHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CSS = '.dsh-inline-content{box-sizing:border-box;width:fit-content;max-width:100%;padding:12px 18px;border-radius:22px;background:var(--dsw-alias-bg-layer-1,transparent);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75}.dsh-inline-chip-wrap{display:inline-block;position:relative;vertical-align:baseline;white-space:normal}.dsh-inline-chip{display:inline-flex;align-items:center;gap:6px;max-width:min(440px,80vw);font:inherit;line-height:1.5;vertical-align:baseline;padding:1px 10px;margin:0 3px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:18px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#37bbc8) 13%,transparent);color:inherit;cursor:pointer}.dsh-inline-chip>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-inline-hover{position:absolute;z-index:100;bottom:calc(100% + 8px);left:0;width:min(320px,70vw);padding:6px;background:var(--dsw-alias-bg-layer-1,#202327);border:1px solid #8885;border-radius:10px;box-shadow:0 8px 30px #0004}.dsh-inline-hover img{display:block;width:100%;max-height:260px;object-fit:contain}.dsh-inline-modal{position:fixed;inset:20px;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#000d;border-radius:12px;white-space:normal}.dsh-inline-modal img{max-width:95%;max-height:92%;object-fit:contain}.dsh-inline-modal-close{position:absolute;right:12px;top:10px;font:inherit;font-size:24px;color:white;background:#333;border:1px solid #777;border-radius:8px;cursor:pointer}.dsh-inline-unused{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.dsh-inline-status{font-size:12px;opacity:.8}.dsh-inline-extras{white-space:pre-wrap;font-size:12px;overflow:auto;max-height:240px}';
  function create(React, core, options = {}) {
    const h = React.createElement;
    function Attachment({descriptor,marker,loadImage,interactive=true}) {
      const [hover,setHover] = React.useState(false);
      const [pinned,setPinned] = React.useState(false);
      const [url,setUrl] = React.useState(descriptor.image?.preview?.url || descriptor.image?.previewUrl || (descriptor.attachment && loadImage?.peek?.(descriptor.attachment)) || null);
      const [error,setError] = React.useState('');
      const label = descriptor.attachment?.name || descriptor.image?.preview?.name || descriptor.image?.name || marker?.name || '附件';
      const isImage = descriptor.kind === 'image';
      React.useEffect(() => {
        if (!isImage || !hover && !pinned || url || !loadImage || !descriptor.attachment) return;
        let live = true;
        Promise.resolve().then(() => loadImage(descriptor.attachment)).then(value => { if (live) { if (typeof value !== 'string') throw new Error('预览不可用'); setUrl(value); setError(''); } }).catch(() => { if (live) setError('图片加载失败，请重新打开'); });
        return () => { live = false; };
      },[isImage,hover,pinned,url,loadImage,descriptor.attachment]);
      React.useEffect(() => {
        if (!pinned) return;
        const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); setPinned(false); } };
        document.addEventListener('keydown',onKey,true);
        return () => document.removeEventListener('keydown',onKey,true);
      },[pinned]);
      const click = async () => {
        if (isImage) { setError(''); setPinned(true); }
        else if (options.openFile) { try { await options.openFile(descriptor.attachment,marker); } catch (cause) { setError(cause?.message || '文件预览失败'); } }
        else setError('当前宿主尚未提供上传文档预览入口');
      };
      const args = {descriptor,marker,loadImage,interactive};
      if (options.renderAttachment) return options.renderAttachment(args);
      return h('span',{className:'dsh-inline-chip-wrap',onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false)},
        h('button',{type:'button',className:'dsh-inline-chip',title:label,onClick:interactive ? click : undefined,onFocus:()=>setHover(true),onBlur:()=>setHover(false),'aria-label':(isImage?'预览图片：':'打开附件：')+label},h('span',{'aria-hidden':true},isImage?'▧':'▤'),h('span',null,label)),
        hover && isImage && !pinned && h('span',{className:'dsh-inline-hover',role:'tooltip'},url ? h('img',{src:url,alt:label}) : h('span',{className:'dsh-inline-status'},error || '正在加载预览…')),
        error && !isImage && h('span',{className:'dsh-inline-status',role:'status'},error),
        pinned && h('span',{className:'dsh-inline-modal',role:'dialog','aria-modal':true,'aria-label':label,onClick:()=>setPinned(false)},h('button',{type:'button',className:'dsh-inline-modal-close',onClick:()=>setPinned(false),'aria-label':'关闭图片预览'},'×'),url ? h('img',{src:url,alt:label,onClick:event=>event.stopPropagation()}) : h('span',{style:{color:'white'}},error || '正在加载预览…')));
    }
    function UserContent({content,facts={},loadImage,renderFactorySlot,interactive=false}) {
      const attachments = content.attachments || [];
      const used = new Set();
      const segments = core.parseMarkers(content.text || '');
      const children = segments.map((segment,index) => {
        if (segment.type === 'attachment') {
          const descriptor = core.resolveMarker(segment,attachments);
          if (descriptor) {
            const matches = value => { const entry=core.normalizeAttachment(value); return entry?.kind === descriptor.kind && (descriptor.attachment ? entry.attachment === descriptor.attachment : entry.image === descriptor.image); };
            // Equal/reused attachment objects can occur more than once in a message.
            // Consume the explicitly selected occurrence before falling back by identity.
            const foundIndex = matches(attachments[segment.index]) ? segment.index : attachments.findIndex(matches);
            if (foundIndex >= 0) used.add(foundIndex);
            return h(Attachment,{key:index,descriptor,marker:segment,loadImage,interactive});
          }
        }
        const text = segment.type === 'text' ? segment.text : segment.raw;
        // Splitting at markers must not turn interior spaces into trimmed edges.
        const edges = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
        const middle = edges[2];
        return h(React.Fragment,{key:index},edges[1],middle && (renderFactorySlot ? renderFactorySlot('conversation.user.text',{text:middle,facts,interactive}) : middle),edges[3]);
      });
      const unused = attachments.map((value,index) => {
        if (used.has(index)) return null;
        const descriptor=core.normalizeAttachment(value);
        return descriptor ? h(Attachment,{key:index,descriptor,marker:{name:descriptor.attachment?.name || descriptor.image?.name || '附件',index},loadImage,interactive}) : null;
      });
      return h('div',{className:'dsh-inline-content','data-message-bubble':'','data-text-interaction-source':''},h('span',null,children),unused.some(Boolean) && h('div',{className:'dsh-inline-unused'},unused),
        (content.extraBlocks || []).map((block,index)=>h('pre',{className:'dsh-inline-extras',key:'extra'+index},JSON.stringify(block,null,2))),
        content.referenceLabels?.length > 0 && h('div',{className:'dsh-inline-status'},'引用：'+content.referenceLabels.join('、')));
    }
    // Wrap the existing keyed node rather than replace its private action row.
    // Source entry can be read through the public slots.entries(key) surface.
    function createNodeWrapper(OriginalNode) {
      if (!OriginalNode) throw new TypeError('Original chat node component is required');
      function InlineAttachmentNode(props) {
        const nativeFactory = props.renderFactorySlot;
        const renderFactorySlot = (name,input,occurrenceOptions) => name === 'conversation.chat.user.content' && core.parseMarkers(input?.content?.text || '').some(segment => segment.type === 'attachment')
          ? h(UserContent,{...input,renderFactorySlot:nativeFactory})
          : nativeFactory(name,input,occurrenceOptions);
        return h(OriginalNode,{...props,renderFactorySlot});
      }
      return InlineAttachmentNode;
    }
    const markerRule = {
      id: 'inline-attachment-token', order: 0,
      match(text, from) {
        let cursor = 0;
        for (const segment of core.parseMarkers(text)) {
          const length = segment.type === 'text' ? segment.text.length : segment.raw.length;
          if (segment.type === 'attachment' && cursor >= from) return {
            id: 'inline-attachment-token', start: cursor, end: cursor + length,
            data: { marker: segment }
          };
          cursor += length;
        }
      }
    };
    function MarkerTextNode({node}) {
      const marker = node.data.marker;
      return h('span', {className:'dsh-inline-chip',style:{cursor:'default'},title:'附件引用（预览请点击原附件）：' + marker.name}, marker.kind === 'image' ? '▧ ' : '▤ ', marker.name || '附件');
    }
    return {UserContent,Attachment,CSS,createNodeWrapper,markerRule,MarkerTextNode};
  }
  return Object.freeze({create,CSS});
});
