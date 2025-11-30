import express, { Router } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// TODO: Replace with Firestore
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

// Helper to load tokens
const loadTokens = (): Record<string, any> => {
  if (!fs.existsSync(TOKEN_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch (e) {
    console.error("Failed to load tokens", e);
    return {};
  }
};

// Helper to save tokens
const saveTokens = (tokens: Record<string, any>) => {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
};

export const setupAuthRoutes = (app: express.Application) => {
  const router = Router();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  router.get('/login', (req, res) => {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important for refresh token
      scope: scopes,
      prompt: 'consent' // Force consent to ensure we get a refresh token
    });

    res.redirect(url);
  });

  router.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).send('Invalid code');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      // oauth2Client.setCredentials(tokens);

      // Generate a session ID
      const sessionId = uuidv4();

      // Store tokens in file
      const allTokens = loadTokens();
      allTokens[sessionId] = tokens;
      saveTokens(allTokens);

      // Construct the connection URL for the user
      // Assuming the server is running on the same host
      const host = req.get('host');
      const protocol = req.protocol;
      const connectionUrl = `${protocol}://${host}/sse?session_id=${sessionId}`;

      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Successful</title>
    <style>
        :root {
            --bg-color: #0a0a0f;
            --card-bg: rgba(255, 255, 255, 0.03);
            --text-primary: #ffffff;
            --text-secondary: #8b9bb4;
            --accent-color: #00f0ff;
            --accent-glow: rgba(0, 240, 255, 0.2);
            --border-color: rgba(255, 255, 255, 0.1);
            --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
        }

        body {
            margin: 0;
            padding: 0;
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: var(--font-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
            background-image: 
                radial-gradient(circle at 50% 0%, #1a1a2e 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, #16213e 0%, transparent 40%);
        }

        .container {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 48px;
            width: 100%;
            max-width: 520px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            text-align: center;
            position: relative;
            animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .container::before {
            content: '';
            position: absolute;
            top: -1px;
            left: -1px;
            right: -1px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
            opacity: 0.5;
        }

        h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }

        p {
            color: var(--text-secondary);
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .url-box {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .url-box:hover {
            border-color: rgba(0, 240, 255, 0.3);
            box-shadow: 0 0 20px var(--accent-glow);
        }

        .url-label {
            display: block;
            text-align: left;
            font-size: 12px;
            color: var(--accent-color);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }

        pre {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 14px;
            color: #e2e8f0;
            white-space: pre-wrap;
            word-break: break-all;
            text-align: left;
        }

        .copy-hint {
            font-size: 13px;
            color: var(--text-secondary);
            opacity: 0.8;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .copy-hint svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(40px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Background decoration */
        .orb {
            position: absolute;
            width: 300px;
            height: 300px;
            border-radius: 50%;
            background: var(--accent-color);
            filter: blur(100px);
            opacity: 0.1;
            z-index: -1;
            animation: float 10s infinite ease-in-out;
        }
        .orb-1 { top: -100px; left: -100px; }
        .orb-2 { bottom: -100px; right: -100px; animation-delay: -5s; }

        @keyframes float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(30px, 50px); }
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
</head>
<body>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    
    <div class="container">
        <h1>System Connected</h1>
        <p>Authentication protocol established successfully.<br>Secure channel ready for initialization.</p>
        
        <div class="url-box">
            <span class="url-label">Connection Endpoint</span>
            <pre>${connectionUrl}</pre>
        </div>

        <div class="copy-hint">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            Copy this URL to your MCP client configuration
        </div>
    </div>
</body>
</html>
      `);

    } catch (error) {
      console.error('Error retrieving access token', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.use('/auth', router);
};

export const getAuthClient = (sessionId: string) => {
  const allTokens = loadTokens();
  const tokens = allTokens[sessionId];

  if (!tokens) {
    throw new Error("Session not found or expired");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
};
