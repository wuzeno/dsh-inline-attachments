/* Public-slot adapter: preserve native entry-owned child authorization via aliases. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DshInlineSlotMirror = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function create(React, slots) {
    let sequence = 0;
    function mount(original, target, decorate, depth = 0) {
      if (depth > 12) throw new Error('Inline attachment slot tree is too deep');
      const aliases = Object.create(null), children = {};
      for (const [source, spec] of Object.entries(original.children || {})) {
        const alias = 'dsh-inline-attachments.alias.' + (++sequence);
        aliases[source] = alias;
        children[alias] = { ...spec };
      }
      function ForwardNative(props) {
        const forwarded = { ...props };
        for (const method of ['renderSlot', 'renderSlotChain']) {
          if (typeof props[method] === 'function' && Object.keys(aliases).length) {
            forwarded[method] = (name, ...args) => props[method](aliases[name] || name, ...args);
          }
        }
        return React.createElement(original.component, forwarded);
      }
      const component = decorate ? decorate(ForwardNative) : ForwardNative;
      const options = { ...original.options, ...target };
      // Keep native service/store/selector semantics; the new registration owns its registrant.
      for (const field of ['select', 'inject', 'locale', 'store']) if (original[field] !== undefined) options[field] = original[field];
      if (Object.keys(children).length) options.children = children;
      const disposeEntry = slots.register(options, component);
      const childDisposers = [];
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const child of childDisposers.reverse()) child();
        disposeEntry();
      };
      try {
        for (const [source, alias] of Object.entries(aliases)) childDisposers.push(mirror(source, alias, depth + 1));
      } catch (error) { dispose(); throw error; }
      return { component, dispose, aliases };
    }
    function mirror(source, alias, depth) {
      return slots.inject(source, () => {
        const members = new Map();
        let busy = false, disposed = false;
        const sync = () => {
          if (busy || disposed) return;
          busy = true;
          try {
            const entries = slots.entries(source);
            for (const [entry, value] of members) if (!entries.includes(entry)) { value.dispose(); members.delete(entry); }
            for (const entry of entries) if (!members.has(entry)) members.set(entry, mount(entry, { name: alias }, undefined, depth));
          } finally { busy = false; }
        };
        const unsubscribe = slots.subscribe(source, sync);
        const cleanup = () => {
          if (disposed) return;
          disposed = true;
          unsubscribe();
          for (const value of Array.from(members.values()).reverse()) value.dispose();
          members.clear();
        };
        try { sync(); } catch (error) { cleanup(); throw error; }
        return cleanup;
      });
    }
    return { mount };
  }
  return Object.freeze({ create });
});
