import express, { Router } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// TODO: Replace with Firestore
const TOKEN_FILE = path.join(__dirname, '../.tokens.json');

const logFile = path.join(__dirname, '../debug.log');
const log = (msg: string) => {
    try {
        fs.appendFileSync(logFile, `${new Date().toISOString()} [AUTH] ${msg}\n`);
    } catch (e) {
        // ignore
    }
};

log(`Auth module loaded. TOKEN_FILE: ${TOKEN_FILE}`);

// In-memory store for pending auth requests
// Map<state, { clientId, clientSecret }>
const pendingAuthRequests = new Map<string, { clientId: string; clientSecret: string }>();

// Helper to load tokens
const loadTokens = (): Record<string, any> => {
    log(`Loading tokens from: ${TOKEN_FILE}`);
    if (!fs.existsSync(TOKEN_FILE)) {
        log('Token file does not exist.');
        return {};
    }
    try {
        const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
        log(`Token file found. Size: ${data.length}`);
        return JSON.parse(data);
    } catch (e) {
        log(`Failed to load tokens: ${e}`);
        console.error("Failed to load tokens", e);
        return {};
    }
};

// Helper to save tokens
const saveTokens = (tokens: Record<string, any>) => {
    log(`Saving tokens to: ${TOKEN_FILE}`);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
};

export const setupAuthRoutes = (app: express.Application) => {
    const router = Router();

    // Middleware to parse form data for the login page
    router.use(express.urlencoded({ extended: true }));

    router.get('/login', (req, res) => {
        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}/auth/callback`;

        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connect Google Sheets</title>
    <style>
        :root {
            --bg-color: #0a0a0f;
            --card-bg: rgba(255, 255, 255, 0.03);
            --text-primary: #ffffff;
            --text-secondary: #8b9bb4;
            --accent-color: #00f0ff;
            --accent-glow: rgba(0, 240, 255, 0.2);
            --border-color: rgba(255, 255, 255, 0.1);
            --input-bg: rgba(0, 0, 0, 0.3);
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
            max-width: 480px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
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
            font-size: 28px;
            font-weight: 700;
            margin: 0 0 16px 0;
            background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
        }

        p {
            color: var(--text-secondary);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 32px;
            text-align: center;
        }

        .form-group {
            margin-bottom: 24px;
        }

        label {
            display: block;
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        input {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 16px;
            color: #fff;
            font-family: var(--font-mono);
            font-size: 14px;
            box-sizing: border-box;
            transition: all 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 15px var(--accent-glow);
        }

        button {
            width: 100%;
            background: linear-gradient(135deg, var(--accent-color) 0%, #00a8ff 100%);
            border: none;
            border-radius: 12px;
            padding: 16px;
            color: #000;
            font-weight: 700;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 8px;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px var(--accent-glow);
        }

        .redirect-info {
            margin-top: 32px;
            padding: 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        .redirect-url {
            display: block;
            margin-top: 8px;
            font-family: var(--font-mono);
            color: var(--accent-color);
            word-break: break-all;
            user-select: all;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Connect Google Sheets</h1>
        <p>Enter your Google Cloud credentials to authorize access.</p>
        
        <form action="/auth/start" method="POST">
            <div class="form-group">
                <label for="clientId">Client ID</label>
                <input type="text" id="clientId" name="clientId" required placeholder="xxx.apps.googleusercontent.com">
            </div>
            
            <div class="form-group">
                <label for="clientSecret">Client Secret</label>
                <input type="password" id="clientSecret" name="clientSecret" required placeholder="Your Client Secret">
            </div>

            <button type="submit">Authorize</button>
        </form>

        <div class="redirect-info">
            <strong>Important:</strong> Add this Redirect URI to your Google Cloud Console:
            <span class="redirect-url">${redirectUri}</span>
        </div>
    </div>
</body>
</html>
    `);
    });

    router.post('/start', (req, res) => {
        const { clientId, clientSecret } = req.body;

        if (!clientId || !clientSecret) {
            res.status(400).send('Client ID and Client Secret are required');
            return;
        }

        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}/auth/callback`;

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        // Generate a unique state for this auth request
        const state = uuidv4();

        // Store credentials temporarily
        pendingAuthRequests.set(state, { clientId, clientSecret });

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
            state: state
        });

        res.redirect(url);
    });

    router.get('/callback', async (req, res) => {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            res.status(400).send('Invalid code');
            return;
        }

        if (!state || typeof state !== 'string' || !pendingAuthRequests.has(state)) {
            res.status(400).send('Invalid or expired state');
            return;
        }

        const credentials = pendingAuthRequests.get(state)!;
        pendingAuthRequests.delete(state); // Clean up

        const host = req.get('host');
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${host}/auth/callback`;

        const oauth2Client = new google.auth.OAuth2(
            credentials.clientId,
            credentials.clientSecret,
            redirectUri
        );

        try {
            const { tokens } = await oauth2Client.getToken(code);

            // Use fixed session ID for Local MCP
            const sessionId = "local-user";

            // Store tokens AND credentials
            const allTokens = loadTokens();
            allTokens[sessionId] = {
                tokens,
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                redirectUri // Store this too just in case
            };
            saveTokens(allTokens);

            res.redirect(`/auth/connected`);

        } catch (error) {
            console.error('Error retrieving access token', error);
            res.status(500).send('Authentication failed');
        }
    });

    router.get('/connected', (req, res) => {
        // No session ID check needed for local single-user mode
        const allTokens = loadTokens();
        if (!allTokens["local-user"]) {
            res.status(404).send("Session not found. Please log in again.");
            return;
        }

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
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <h1>Authentication Successful</h1>
        <p>You can now close this window and use the Local MCP server.</p>
    </div>
</body>
</html>
    `);
    });

    app.use('/auth', router);
};

export const getAuthClient = (sessionId: string = "local-user") => {
    const allTokens = loadTokens();
    const sessionData = allTokens[sessionId];

    if (!sessionData) {
        throw new Error("Session not found or expired");
    }

    // Support both old format (just tokens) and new format (tokens + credentials)
    // If old format, we might fail if env vars are missing, but we are moving away from env vars.
    // For now, let's assume if clientId is missing, we try env vars (backward compatibility)
    const clientId = sessionData.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = sessionData.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = sessionData.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
        throw new Error("Missing Client ID or Client Secret for this session");
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    oauth2Client.setCredentials(sessionData.tokens || sessionData); // Handle old format where sessionData IS the tokens
    return oauth2Client;
};
