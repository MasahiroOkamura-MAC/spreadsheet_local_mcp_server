# Spreadsheet Local MCP Server

Google Spreadsheet / Google Drive からデータを取得するための Local MCP (Model Context Protocol) サーバーです。
Stdio を使用して通信し、Claude Desktop などの MCP クライアントから直接利用できます。

## 機能

- **データ取得**: Google Spreadsheet や Google Drive 上の Excel ファイルからデータを読み込みます。
  - Google Sheets API と Drive API を併用し、Excel ファイルもサポートしています。

## 前提条件

- Node.js (v18以上推奨)
- Google Cloud Platform プロジェクト
  - Google Sheets API が有効化されていること
  - Google Drive API が有効化されていること
  - OAuth 2.0 クライアント ID が作成されていること

## セットアップ

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd spreadsheet_local_mcp_server
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **環境変数の設定**
   `.env.example` をコピーして `.env` を作成し、必要な値を設定します。
   ```bash
   cp .env.example .env
   ```
   
   `.env` ファイルを編集:
   ```env
   PORT=8080
   GOOGLE_REDIRECT_URI=http://localhost:8080/auth/callback
   ```
   
   > **注意**: Google Cloud Console の OAuth 同意画面設定で、テストユーザーとして自分のメールアドレスを追加し、リダイレクト URI (`http://localhost:8080/auth/callback`) を許可済みリダイレクト URI に追加してください。

4. **ビルド**
   ```bash
   npm run build
   ```

## MCP クライアントの設定 (Claude Desktop)

Claude Desktop で使用するには、`claude_desktop_config.json` (通常 `~/Library/Application Support/Claude/claude_desktop_config.json` にあります) に以下を追加します。

```json
{
  "mcpServers": {
    "spreadsheet-local": {
      "command": "node",
      "args": ["/absolute/path/to/spreadsheet_local_mcp_server/dist/index.js"],
      "env": {
        "GOOGLE_REDIRECT_URI": "http://localhost:8080/auth/callback"
      }
    }
  }
}
```

※ `/absolute/path/to/...` の部分は、実際にリポジトリをクローンした絶対パスに置き換えてください。

## 認証フロー

初回利用時やトークン期限切れ時は、認証が必要です。
MCP サーバーが起動すると、認証が必要な場合に自動的にローカルサーバー (`http://localhost:8080`) が立ち上がり、ブラウザが開きます。
Google アカウントでログインして権限を許可してください。認証が完了すると、MCP サーバーとしての機能が利用可能になります。

## 利用可能なツール

### `get_data`
Google Spreadsheet または Google Drive 上のファイルからデータを取得します。

- **引数**:
  - `url` (string, 必須): Google Spreadsheet の URL または Google Drive のファイル URL
  - `sheetName` (string, オプション): シート名。省略時は最初のシートが使用されます。

## ディレクトリ構成

- `src/index.ts`: エントリーポイント。認証サーバーの起動制御と MCP サーバーの初期化を行います。
- `src/mcp.ts`: MCP サーバーの設定 (Stdio) とツール定義 (`get_data`)。
- `src/auth.ts`: Google OAuth 認証ロジック。
- `src/sheets.ts`: Google Sheets API 操作ロジック。
- `src/drive.ts`: Google Drive API 操作ロジック。

