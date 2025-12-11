# Spreadsheet Remote MCP Server

Google Spreadsheet を操作するための Remote MCP (Model Context Protocol) サーバーです。
Claude Desktop などの MCP クライアントから、Google Spreadsheet の読み書きを行うことができます。

## 機能

- **Google 認証**: OAuth 2.0 を使用した安全な認証フロー
- **スプレッドシートの読み込み**: 指定した範囲のデータを読み込む
- **スプレッドシートへの書き込み**: 指定した範囲にデータを書き込む
- **スプレッドシートの作成**: 新しいスプレッドシートを作成する

## 前提条件

- Node.js (v18以上推奨)
- Google Cloud Platform プロジェクト
  - Google Sheets API が有効化されていること
  - OAuth 2.0 クライアント ID が作成されていること

## セットアップ

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd spreadsheet_remote_mcp
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
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:8080/auth/callback
   ```
   
   > **注意**: Google Cloud Console の OAuth 同意画面設定で、テストユーザーとして自分のメールアドレスを追加し、リダイレクト URI (`http://localhost:8080/auth/callback`) を許可済みリダイレクト URI に追加してください。

## 起動方法

### 開発モード
ホットリロード有効で起動します。
```bash
npm run dev
```

### プロダクションビルド & 実行
```bash
npm run build
npm start
```

## MCP クライアントの設定 (Claude Desktop)

Claude Desktop で使用するには、`claude_desktop_config.json` (通常 `~/Library/Application Support/Claude/claude_desktop_config.json` にあります) に以下を追加します。

このサーバーは SSE (Server-Sent Events) を使用する Remote MCP サーバーとして動作します。

```json
{
  "mcpServers": {
    "spreadsheet-remote": {
      "command": "node",
      "args": ["/path/to/spreadsheet_remote_mcp/dist/index.js"],
      "env": {
        "PORT": "8080",
        "GOOGLE_CLIENT_ID": "your_client_id",
        "GOOGLE_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_REDIRECT_URI": "http://localhost:8080/auth/callback"
      }
    }
  }
}
```

※ **注意**: 上記の設定は、ローカルで直接プロセスとして起動する場合の例です。
もし、すでに `npm run dev` や `npm start` でサーバーを立ち上げている場合（例: `http://localhost:8080` で稼働中）、Claude Desktop からは以下のように SSE 経由で接続することも可能です（クライアントが SSE 対応している場合）。

現状の構成では、MCP サーバー自体が Express サーバーとして立ち上がり、SSE エンドポイント (`/sse`) を提供する形になっています。

### 認証フロー

初回利用時やトークン期限切れ時は、認証が必要です。
サーバー起動後、ブラウザで `http://localhost:8080/auth/login` にアクセスし、Google アカウントでログインして権限を許可してください。

## 利用可能なツール

- `read_spreadsheet`: スプレッドシートからデータを読み込む
  - `spreadsheetId`: スプレッドシートID
  - `range`: 範囲 (例: "Sheet1!A1:B5")
- `write_spreadsheet`: スプレッドシートにデータを書き込む
  - `spreadsheetId`: スプレッドシートID
  - `range`: 範囲
  - `values`: 書き込むデータの2次元配列
- `create_spreadsheet`: 新しいスプレッドシートを作成する
  - `title`: タイトル

## ディレクトリ構成

- `src/index.ts`: エントリーポイント (Express サーバーの起動)
- `src/mcp.ts`: MCP サーバーの設定とツール定義
- `src/auth.ts`: Google OAuth 認証ロジック
- `src/sheets.ts`: Google Sheets API 操作ロジック
