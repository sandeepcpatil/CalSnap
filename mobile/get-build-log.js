const https = require('https');
const fs = require('fs');

const state = JSON.parse(fs.readFileSync(process.env.USERPROFILE + '\\.expo\\state.json', 'utf8'));
const token = state.auth.sessionSecret;
const buildId = process.argv[2];

// First get available fields
const introspect = JSON.stringify({
  query: '{ __type(name: "Build") { fields { name } } }'
});

function request(body, cb) {
  const req = https.request({
    hostname: 'api.expo.dev',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'expo-session': token,
      'Content-Length': Buffer.byteLength(body)
    }
  }, (r) => {
    let data = '';
    r.on('data', chunk => data += chunk);
    r.on('end', () => cb(JSON.parse(data)));
  });
  req.on('error', e => console.error(e));
  req.write(body);
  req.end();
}

request(introspect, (result) => {
  if (result.errors) {
    console.error('Introspection error:', JSON.stringify(result.errors));
    return;
  }
  const fields = result.data.__type.fields.map(f => f.name);
  console.log('Build fields:', fields.join(', '));

  // Now try to get logFiles
  const query = JSON.stringify({
    query: `{ builds { byId(buildId: "${buildId}") { id status error { message errorCode } logFiles } } }`
  });
  
  request(query, (r2) => {
    console.log('Build result:', JSON.stringify(r2, null, 2));
  });
});
