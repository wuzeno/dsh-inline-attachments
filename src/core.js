/* Pure attachment marker codec. No receipt IDs, filesystem paths or executable HTML. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DshInlineAttachmentCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function validate(value) {
    if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.index) || value.index < 0 || value.index > 100000 || typeof value.name !== 'string' || value.name.length > 4096) return null;
    if (value.kind !== undefined && value.kind !== 'image' && value.kind !== 'file') return null;
    if (value.attachmentId !== undefined && (typeof value.attachmentId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.attachmentId))) return null;
    return { index: value.index, name: value.name, ...(value.kind ? {kind:value.kind} : {}), ...(value.attachmentId ? {attachmentId:value.attachmentId} : {}) };
  }
  function encodeMarker(value) {
    const marker = validate(value);
    if (!marker) throw new TypeError('Invalid inline attachment marker');
    const label = marker.name.replace(/[\[\]\r\n]/g, c => c === '[' ? '［' : c === ']' ? '］' : ' ') || '附件';
    return '@[' + label + '](dsh-attachment:v1:' + encodeURIComponent(JSON.stringify(marker)).replace(/[()]/g, c => c === '(' ? '%28' : '%29') + ')';
  }
  function parseMarkers(text) {
    text = String(text ?? '');
    const pattern = /@\[([^\]\r\n]*)\]\(dsh-attachment:v1:([^\s)]{1,65536})\)/g;
    const segments = []; let cursor = 0; let match;
    while ((match = pattern.exec(text))) {
      let marker;
      try { marker = validate(JSON.parse(decodeURIComponent(match[2]))); } catch (_) { marker = null; }
      if (!marker) continue;
      if (match.index > cursor) segments.push({type:'text', text:text.slice(cursor,match.index)});
      segments.push({type:'attachment', raw:match[0], ...marker});
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length || segments.length === 0) segments.push({type:'text',text:text.slice(cursor)});
    return segments;
  }
  function normalizeAttachment(value) {
    if (!value || typeof value !== 'object') return null;
    const kind = value.kind || value.type;
    if (kind === 'image') {
      const image = value.image || (value.attachment ? {attachment:value.attachment} : value.value);
      if (!image) return null;
      return {kind, attachment:image.attachment, image};
    }
    if (kind === 'file') {
      const attachment = value.file || value.attachment || value.value;
      if (!attachment) return null;
      return {kind, attachment};
    }
    return null;
  }
  function resolveMarker(marker, orderedAttachments) {
    if (!validate(marker) || !Array.isArray(orderedAttachments)) return null;
    const normalized = orderedAttachments.map(normalizeAttachment);
    let found;
    if (marker.attachmentId) {
      const matches = item => item?.attachment?.attachmentId === marker.attachmentId && (!marker.kind || item.kind === marker.kind);
      found = matches(normalized[marker.index]) ? normalized[marker.index] : normalized.find(matches);
    } else found = normalized[marker.index];
    if (!found || marker.kind && found.kind !== marker.kind) return null;
    return found;
  }
  function splitContent(content) {
    const text = []; const attachments = []; const rest = [];
    for (const part of Array.isArray(content) ? content : []) {
      if (part?.type === 'text' && typeof part.text === 'string') text.push(part.text);
      else if ((part?.type === 'image' || part?.type === 'file') && part.attachment) attachments.push(part.type === 'image' ? {type:'image',image:{attachment:part.attachment}} : {type:'file',file:part.attachment});
      else rest.push(part);
    }
    return {text:text.join(''),attachments,rest};
  }
  return Object.freeze({encodeMarker,parseMarkers,resolveMarker,splitContent,normalizeAttachment});
});
