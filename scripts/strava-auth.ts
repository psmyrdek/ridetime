// One-time helper that authorizes the Strava app and prints a refresh token for STRAVA_REFRESH_TOKEN.
//
// 1. Create an app at https://www.strava.com/settings/api with "Authorization Callback Domain" set to `localhost`.
// 2. STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... npm run strava:auth
// 3. Open the printed URL, approve access, and copy the refresh token from the terminal.

import { createServer } from 'node:http';

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
const PORT = 8787;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
  console.error('Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET first');
  process.exit(1);
}

const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
authorizeUrl.search = new URLSearchParams({
  client_id: STRAVA_CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  approval_prompt: 'force',
  scope: 'read,activity:read',
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT_URI);
  if (url.pathname !== '/callback') return res.writeHead(404).end();

  const code = url.searchParams.get('code');
  const scope = url.searchParams.get('scope') ?? '';
  if (!code || !scope.includes('activity:read')) {
    res.writeHead(400).end('Brak kodu albo nie zaznaczono dostępu do aktywności - spróbuj ponownie.');
    return;
  }

  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const token = await tokenRes.json();

  if (!tokenRes.ok) {
    res.writeHead(500).end('Wymiana kodu na token nie powiodła się - szczegóły w terminalu.');
    console.error(token);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Gotowe, możesz zamknąć kartę.');
    console.log(`\nAthlete: ${token.athlete?.firstname} ${token.athlete?.lastname} (${token.athlete?.id})`);
    console.log(`STRAVA_REFRESH_TOKEN=${token.refresh_token}\n`);
  }
  server.close();
});

server.listen(PORT, () => console.log(`Open this URL and approve access:\n\n${authorizeUrl}\n`));
