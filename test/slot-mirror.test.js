'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mirror = require('../src/slot-mirror.js');
const history = require('../src/history.js');
const core = require('../src/core.js');
const React = {createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'};
function registry() {
  const specs = new Map([['nodes',{kind:'keyed',scope:'session'}]]), rows = new Map(), listeners = new Map(), waits = new Map();
  const notify = name => { for (const fn of [...(listeners.get(name)||[])]) fn(); };
  const declare = (name,spec) => { assert.ok(!specs.has(name),'duplicate declaration: '+name); specs.set(name,spec); for(const wait of waits.get(name)||[]) wait.active=wait.fn(); };
  const undeclare = name => { for(const wait of waits.get(name)||[]){wait.active?.();wait.active=undefined;} specs.delete(name); rows.delete(name); };
  const slots = {
    entries:name=>rows.get(name)||[],
    subscribe(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name).delete(fn);},
    inject(name,fn){if(!waits.has(name))waits.set(name,new Set());const wait={fn};waits.get(name).add(wait);if(specs.has(name))wait.active=fn();return()=>{waits.get(name).delete(wait);wait.active?.();wait.active=undefined;};},
    register(config,component){
      assert.ok(specs.has(config.name),'undeclared slot: '+config.name);
      for(const name of Object.keys(config.children||{}))assert.ok(!specs.has(name),'duplicate declaration: '+name);
      const options={};for(const name of ['key','id','priority','order'])if(config[name]!==undefined)options[name]=config[name];
      const entry={options,component};for(const name of ['children','inject','select','locale','store'])if(config[name]!==undefined)entry[name]=config[name];
      const rowsHere=[...(rows.get(config.name)||[]),entry].sort((a,b)=>(a.options.priority??0)-(b.options.priority??0));rows.set(config.name,rowsHere);
      for(const [name,spec]of Object.entries(config.children||{}))declare(name,spec);
      notify(config.name);
      let disposed=false;
      return()=>{if(disposed)return;disposed=true;rows.set(config.name,(rows.get(config.name)||[]).filter(row=>row!==entry));for(const name of Object.keys(config.children||{}))undeclare(name);notify(config.name);};
    }
  };
  return {...slots,specs,listenerCount:()=>[...listeners.values()].reduce((sum,set)=>sum+set.size,0),waitCount:()=>[...waits.values()].reduce((sum,set)=>sum+set.size,0)};
}
function renderElement(tree){let limit=30;while(tree&&typeof tree.type==='function'&&limit-->0)tree=tree.type(tree.props);assert.ok(limit>0,'render loop');return tree;}
function kit(slots,entry){
 const props={renderFactorySlot:()=> 'native-body'};
 if(entry.children){
  for(const method of ['renderSlot','renderSlotChain'])props[method]=(name,owner)=>{
   assert.ok(entry.children[name],'slot ownership error: '+name);
   for(const child of slots.entries(name)){
    const matched=child.select?child.select(owner):undefined;
    if(child.select&&matched===null)continue;
    return renderElement(React.createElement(child.component,{...kit(slots,child),...owner,matched}));
   }
   return null;
  };
 }
 if(entry.store)props.actions=entry.store.actions;
 if(entry.locale)props.t=key=>entry.locale+':'+key;
 if(entry.inject)Object.assign(props,entry.inject('session-a',entry.store?.actions));
 return props;
}
test('native before-chain error is reproduced, then alias shadow preserves it without redeclaration',()=>{
 const slots=registry();
 const Native=props=>({before:props.renderSlotChain('native.before',{source:'quote'}),body:props.renderFactorySlot('other',{}),time:props.time});
 slots.register({name:'nodes',key:'user',locale:'chat',children:{'native.before':{kind:'chain',scope:'session'}}},Native);
 const original=slots.entries('nodes')[0];
 const actions={identity:true},store={actions};
 slots.register({name:'native.before',select:owner=>owner.source==='quote'?{quote:'Q'}:null,inject:(sid,gotActions)=>({sid,gotActions}),locale:'quotes',store},props=>({text:props.t('label'),sid:props.sid,actions:props.gotActions,matched:props.matched}));
 const api=history.create(React,core);
 assert.throws(()=>renderElement(React.createElement(api.createNodeWrapper(Native),{renderFactorySlot:()=>null})),/renderSlotChain/);
 const adapter=mirror.create(React,slots);
 const mounted=adapter.mount(original,{name:'nodes',key:'user',priority:-1},api.createNodeWrapper);
 const shadow=slots.entries('nodes').find(row=>row.component===mounted.component);
 const output=renderElement(React.createElement(shadow.component,{...kit(slots,shadow),time:123}));
 assert.equal(output.before.text,'quotes:label');assert.equal(output.before.sid,'session-a');assert.equal(output.before.actions,actions);assert.equal(output.before.matched.quote,'Q');assert.equal(output.body,'native-body');assert.equal(output.time,123);
 assert.ok(slots.specs.has('native.before'));
 mounted.dispose();assert.equal(slots.specs.size,2);assert.equal(slots.entries('native.before').length,1);assert.equal(slots.listenerCount(),0);assert.equal(slots.waitCount(),0);
});
test('nested child authorization and changing native members are mirrored and cleaned up',()=>{
 const slots=registry();
 slots.register({name:'nodes',key:'user',children:{'native.before':{kind:'chain',scope:'session'}}},props=>props.renderSlotChain('native.before',{}));
 const original=slots.entries('nodes')[0];
 const remove=slots.register({name:'native.before',select:()=>({}),children:{'native.nested':{kind:'single',scope:'session'}}},props=>props.renderSlot('native.nested',{}));
 slots.register({name:'native.nested'},()=> 'nested-value');
 const mounted=mirror.create(React,slots).mount(original,{name:'nodes',key:'user',priority:-1});
 const shadow=slots.entries('nodes').find(row=>row.component===mounted.component);
 const render=()=>renderElement(React.createElement(shadow.component,kit(slots,shadow)));
 assert.equal(render(),'nested-value');
 remove();assert.equal(render(),null);
 slots.register({name:'native.before',select:()=>({})},()=> 'replacement');assert.equal(render(),'replacement');
 mounted.dispose();assert.ok(![...slots.specs.keys()].some(name=>name.startsWith('dsh-inline-attachments.alias.')));assert.equal(slots.listenerCount(),0);assert.equal(slots.waitCount(),0);
});
test('steering shadow retains native injection that supplies the no-op before chain',()=>{
 const slots=registry();
 const inject=()=>({renderSlotChain:()=>null});
 slots.register({name:'nodes',key:'steering',inject},props=>props.renderSlotChain('native.before',{}));
 const original=slots.entries('nodes')[0],mounted=mirror.create(React,slots).mount(original,{name:'nodes',key:'steering',priority:-1});
 const shadow=slots.entries('nodes').find(row=>row.component===mounted.component);
 assert.equal(shadow.inject,inject);assert.equal(renderElement(React.createElement(shadow.component,kit(slots,shadow))),null);mounted.dispose();
});
test('text fallback replaces metadata with a short noninteractive filename',()=>{
 const api=history.create(React,core),raw=core.encodeMarker({index:0,name:'image.png',kind:'image'});
 const found=api.markerRule.match('比较 '+raw+' 的差异',0);
 assert.equal(found.start,3);assert.equal(found.end,3+raw.length);
 const rendered=api.MarkerTextNode({node:{data:found.data}});
 assert.ok(JSON.stringify(rendered).includes('image.png'));assert.ok(!JSON.stringify(rendered).includes('dsh-attachment:v1:'));assert.ok(!rendered.props.onClick);
 assert.equal(api.markerRule.match('比较 '+raw,found.end),undefined);
});
