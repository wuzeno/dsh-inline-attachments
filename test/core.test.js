'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');
const history = require('../src/history.js');
const file = {attachmentId:'sha256:'+'a'.repeat(64),name:'报告.pdf',bytes:12};
const image = {attachmentId:'sha256:'+'b'.repeat(64),name:'图.png',mediaType:'image/png'};
const attachments = [{type:'file',file},{type:'image',image:{attachment:image}}];
test('roundtrip Chinese and punctuation without changing the surrounding sentence',()=>{
 const marker=core.encodeMarker({index:1,name:'图[样](一)\n.png',kind:'image'});
 const segments=core.parseMarkers('请看'+marker+'再修改。');
 assert.equal(segments.length,3); assert.equal(segments[0].text,'请看'); assert.equal(segments[1].name,'图[样](一)\n.png'); assert.equal(segments[2].text,'再修改。');
});
test('mixed file/image indices refer to one shared ordered array',()=>{
 assert.equal(core.resolveMarker({index:0,name:'report'},attachments).attachment,file);
 assert.equal(core.resolveMarker({index:1,name:'image'},attachments).attachment,image);
});
test('durable identity wins over a stale ordinal, but never resolves a foreign reference',()=>{
 assert.equal(core.resolveMarker({index:0,name:'image',attachmentId:image.attachmentId},attachments).attachment,image);
 assert.equal(core.resolveMarker({index:0,name:'unknown',attachmentId:'sha256:'+'c'.repeat(64)},attachments),null);
 assert.equal(core.resolveMarker({index:0,name:'wrong type',kind:'image'},attachments),null);
});
test('same bytes attached under different names retain the selected occurrence',()=>{
 const renamed={...file,name:'副本.pdf'};
 const repeated=[{type:'file',file},{type:'file',file:renamed}];
 assert.equal(core.resolveMarker({index:1,name:'副本.pdf',attachmentId:file.attachmentId},repeated).attachment,renamed);
});
test('bad and unsupported markers remain literal, never interpreted as HTML',()=>{
 const bad='@[x](dsh-attachment:v1:%7Bbad%7D)';
 assert.deepEqual(core.parseMarkers(bad),[{type:'text',text:bad}]);
 assert.deepEqual(core.parseMarkers('<script>x</script>'),[{type:'text',text:'<script>x</script>'}]);
 assert.throws(()=>core.encodeMarker({index:-1,name:'x'}));
 assert.throws(()=>core.encodeMarker({index:0,name:'x',attachmentId:'receipt-123'}));
});
test('valid markers do not swallow malformed adjacent text',()=>{
 const good=core.encodeMarker({index:0,name:'a'}),bad='@[x](dsh-attachment:v1:%FF)';
 const result=core.parseMarkers(bad+good+bad);
 assert.equal(result[0].text,bad); assert.equal(result[1].type,'attachment'); assert.equal(result[2].text,bad);
});
test('splitContent follows host joining and prepared attachment shape',()=>{
 const result=core.splitContent([{type:'text',text:'a'},{type:'image',attachment:image},{type:'file',attachment:file},{type:'text',text:'b'},{type:'json',value:5}]);
 assert.equal(result.text,'ab'); assert.equal(result.attachments.length,2); assert.equal(result.attachments[0].image.attachment,image); assert.equal(result.rest.length,1);
});
test('pending local image previews normalize without inventing durable ids',()=>{
 const preview={previewUrl:'blob:local',name:'new.png'};
 const pending=[{type:'image',value:preview}];
 assert.equal(core.resolveMarker({index:0,name:'new.png'},pending).image,preview);
});
test('history renderer retains unused attachments and delegates ordinary text to host',()=>{
 const calls=[];
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'};
 const {UserContent}=history.create(React,core);
 const marker=core.encodeMarker({index:1,name:'图.png'});
 const tree=UserContent({content:{text:'前'+marker+'后',attachments},interactive:true,renderFactorySlot:(name,input)=>{calls.push({name,input});return input.text;}});
 assert.deepEqual(calls.map(c=>c.input.text),['前','后']);
 const unused=tree.children.find(child=>child?.props?.className==='dsh-inline-unused');
 assert.ok(unused); assert.equal(unused.children[0].filter(Boolean).length,1); assert.equal(unused.children[0][0].props.descriptor.attachment,file);
});
test('node wrapper preserves original component, action props, and other factory calls',()=>{
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'};
 const api=history.create(React,core); const Original=()=>null;
 const node={data:{content:[]}},t=()=>'',calls=[];
 const native=(...args)=>{calls.push(args);return 'native';};
 const tree=api.createNodeWrapper(Original)({node,t,renderFactorySlot:native});
 assert.equal(tree.type,Original); assert.equal(tree.props.node,node); assert.equal(tree.props.t,t);
 const content={text:'hello '+core.encodeMarker({index:0,name:'a'}),attachments:[]};
 const body=tree.props.renderFactorySlot('conversation.chat.user.content',{content});
 assert.equal(body.type,api.UserContent); assert.equal(body.props.content,content); assert.equal(body.props.renderFactorySlot,native);
 assert.equal(tree.props.renderFactorySlot('other',{x:1},{id:'same'}),'native'); assert.equal(calls[0][2].id,'same');
 assert.equal(tree.props.renderFactorySlot('conversation.chat.user.content',{content:{text:'ordinary old message'}}),'native');
});
test('history keeps whitespace around markers while host receives untrimmed semantic runs',()=>{
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'};
 const calls=[]; const api=history.create(React,core);
 const tree=api.UserContent({content:{text:'前  '+core.encodeMarker({index:0,name:'a'})+'\n 后',attachments},renderFactorySlot:(name,input)=>{calls.push(input.text);return input.text;}});
 assert.deepEqual(calls,['前','后']);
 const runs=tree.children[0].children[0];
 assert.equal(runs[0].children[2],'  '); assert.equal(runs[2].children[0],'\n ');
});
test('history consumes the chosen occurrence when attachments reuse the same object',()=>{
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment'};
 const api=history.create(React,core);
 const shared={attachmentId:'sha256:'+'a'.repeat(64),name:'same.pdf'};
 const repeated=[{type:'file',file:shared},{type:'file',file:shared}];
 const text=core.encodeMarker({index:0,name:'first.pdf',kind:'file',attachmentId:shared.attachmentId})+' '+core.encodeMarker({index:1,name:'second.pdf',kind:'file',attachmentId:shared.attachmentId});
 const tree=api.UserContent({content:{text,attachments:repeated}});
 assert.ok(!tree.children.some(child=>child?.props?.className==='dsh-inline-unused'));
});
test('deterministic Unicode marker roundtrips preserve exact names and surrounding text',()=>{
 const alphabet=['中','猫','[',']','(',')',String.fromCharCode(10),String.fromCharCode(13),' ','%','<','>','&','é','😀',String.fromCharCode(0x2028),String.fromCharCode(9),'\\','"'];
 for(let sample=0;sample<256;sample++){
  let state=sample+1,name='';
  for(let at=0;at<17;at++){state=(state*1664525+1013904223)>>>0;name+=alphabet[state%alphabet.length];}
  const marker=core.encodeMarker({index:sample,name,kind:sample%2?'file':'image'});
  const parts=core.parseMarkers('before '+marker+' after');
  assert.equal(parts.length,3);assert.equal(parts[0].text,'before ');assert.equal(parts[1].name,name);assert.equal(parts[1].index,sample);assert.equal(parts[2].text,' after');
 }
});
