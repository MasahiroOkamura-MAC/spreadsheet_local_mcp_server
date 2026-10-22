const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {createRequire} = require('node:module');
const {localRequestGuard, tokenStore, newBinding, equalBinding} = require('../dist/security');
const express = require('express');

test('token storage migrates legacy tokens and locks permissions', () => {
 const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
 try {
  fs.writeFileSync(path.join(base,'.tokens.json'), JSON.stringify({dummy:'not-a-real-token'}));
  const store=tokenStore(base);
  assert.equal(store.load().dummy,'not-a-real-token');
  assert.equal(fs.existsSync(path.join(base,'.tokens.json')),false);
  assert.equal(fs.statSync(path.join(base,'.secret')).mode & 0o777,0o700);
  assert.equal(fs.statSync(path.join(base,'.secret/tokens.json')).mode & 0o777,0o600);
  store.save({dummy:'updated'});
  assert.equal(store.load().dummy,'updated');
 } finally { fs.rmSync(base,{recursive:true,force:true}); }
});
test('token storage rejects symbolic links without changing their targets', () => {
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'mcp-test-'));
 try {
  const target=path.join(base,'external');fs.writeFileSync(target,'dummy');
  fs.symlinkSync(target,path.join(base,'.tokens.json'));
  assert.throws(()=>tokenStore(base).load(),/Unsafe credential storage/);
  assert.equal(fs.readFileSync(target,'utf8'),'dummy');
 } finally { fs.rmSync(base,{recursive:true,force:true}); }
});
test('bindings require a full cryptographic token', () => {
 const a=newBinding(), b=newBinding();
 assert.equal(equalBinding(a,a),true);assert.equal(equalBinding(a,b),false);
 assert.equal(equalBinding('', ''),false);assert.equal(equalBinding(undefined,a),false);
});
test('HTTP auth rejects DNS rebinding, cross-origin POST, missing CSRF, and wrong browser callback', async () => {
 const {setupAuthRoutes} = require('../dist/auth');
 const app=express();setupAuthRoutes(app);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;process.env.PORT=String(port);
 const url=`http://127.0.0.1:${port}`;
 const request=(route,options={})=>fetch(url+route,{redirect:'manual',...options});
 try {
  const rebindingStatus = await new Promise((resolve, reject) => {
   const req = require('node:http').get(url + '/auth/login', {headers:{host:`evil.invalid:${port}`}}, res => {res.resume();resolve(res.statusCode);});
   req.on('error', reject);
  });
  assert.equal(rebindingStatus,403);
  const login=await request('/auth/login');assert.equal(login.status,200);
  assert.equal(login.headers.get('cache-control'),'no-store');
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  const html=await login.text();const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const body=new URLSearchParams({clientId:'dummy-client',clientSecret:'dummy-secret',csrf});
  assert.equal((await request('/auth/start',{method:'POST',headers:{origin:'https://evil.invalid',cookie},body})).status,403);
  assert.equal((await request('/auth/start',{method:'POST',headers:{cookie},body})).status,403);
  assert.equal((await request('/auth/start',{method:'POST',headers:{origin:url},body})).status,403);
  const started=await request('/auth/start',{method:'POST',headers:{origin:url,cookie},body});
  assert.equal(started.status,302);
  const oauth=new URL(started.headers.get('location'));
  assert.equal(oauth.origin,'https://accounts.google.com');
  assert.equal(oauth.searchParams.get('redirect_uri'),`http://localhost:${port}/auth/callback`);
  const state=oauth.searchParams.get('state');
  // Invalid browser state must be rejected before any external token exchange.
  assert.equal((await request(`/auth/callback?code=dummy&state=${state}`)).status,400);
  assert.equal((await request('/auth/callback?code=dummy&state=unknown',{headers:{cookie}})).status,400);
 } finally {server.close();await once(server,'close');}
});
