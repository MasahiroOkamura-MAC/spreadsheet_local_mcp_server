# Local security boundary

This is a single-user, read-only stdio MCP server. The OAuth browser listener binds to 127.0.0.1 only, requires a loopback Host and same-origin form POST, and binds each short-lived OAuth state to the initiating browser cookie. It is not an authenticated multi-user web service; do not publish or tunnel its listener. Register `http://localhost:8080/auth/callback` in Google OAuth settings (adjust PORT if needed).

Tokens and OAuth client secrets are kept in ignored `.secret/tokens.json` (directory 700, file 600). The legacy `.tokens.json` is moved there on first use; symlinks and ambiguous stores are rejected. Keep `.secret/` on persistent local storage. Do not bake credentials into Docker images. API errors and document contents must not be logged.

Sheet contents are untrusted external data. Read-only scopes reduce action privileges but do not prevent an AI client from disclosing content through its other tools or answers. Configure the client to keep document data separate from instructions, restrict egress and other tools, and require explicit review before sending, deleting or changing access. Do not combine unrelated users' tokens or data in this single-user server.

Known remaining dependency work: npm's xlsx 0.18.5 is affected by GHSA-5pgg-2g8v-p4x9 and GHSA-4r6h-8v6p-xvw6 when parsing crafted workbooks. The official SheetJS fixed distribution (0.20.2 or later) must be retrieved and verified; the CDN returned 403 in this review. The download size limit is not a fix for parser vulnerabilities. Until a verified fixed parser is installed, use trusted files only and avoid Excel downloads from untrusted sources.

Run `npm ci --ignore-scripts`, then `npm test` on patched Node. Tests use only dummy tokens and loopback requests; no Google credentials are needed. Docker image builds require a running Docker daemon. Review newer advisories before deploying.
