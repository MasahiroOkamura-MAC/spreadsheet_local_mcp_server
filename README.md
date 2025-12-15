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

## Google Cloud Credentials の取得方法

このサーバーを使用するには、Google Cloud Platform (GCP) でプロジェクトを作成し、OAuth 2.0 クライアント ID を取得する必要があります。

### 1. プロジェクトの作成と API の有効化

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスします。
2. 新しいプロジェクトを作成します（または既存のプロジェクトを選択します）。
3. 左側のメニューから「API とサービス」>「ライブラリ」を選択します。
4. 以下の API を検索し、それぞれ「有効にする」をクリックします。
   - **Google Sheets API**
   - **Google Drive API**

### 2. OAuth 同意画面の設定

1. 左側のメニューから「API とサービス」>「OAuth 同意画面」を選択します。
2. User Type で「外部」を選択し、「作成」をクリックします（テスト目的の場合は「外部」で自分のアカウントのみを許可するのが一般的です）。
3. アプリ情報（アプリ名、ユーザーサポートメールなど）を入力し、「保存して次へ」をクリックします。
4. 「スコープ」は今回は特に設定しなくても動作しますが、必要に応じて追加してください。「保存して次へ」をクリックします。
5. 「テストユーザー」で「ADD USERS」をクリックし、**自分の Google アカウント（メールアドレス）を追加**します。これを行わないと、認証時にエラーになります。
6. 「保存して次へ」をクリックし、最後に「ダッシュボードに戻る」をクリックします。

### 3. OAuth クライアント ID の作成

1. 左側のメニューから「API とサービス」>「認証情報」を選択します。
2. 上部の「認証情報を作成」をクリックし、「OAuth クライアント ID」を選択します。
3. アプリケーションの種類で「**ウェブ アプリケーション**」を選択します。
4. 名前を適当に入力します（例: "Local MCP Server"）。
5. **承認済みのリダイレクト URI** に以下の URL を追加します。
   - `http://localhost:8080/auth/callback`
6. 「作成」をクリックします。
7. 表示された **クライアント ID** と **クライアント シークレット** をコピーし、`.env` ファイルに設定します。

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

以下のコマンドでサーバーを起動してください。

```bash
npm run dev
# または
npm run build
npm start
```

MCP サーバーが起動すると、認証が必要な場合に自動的にローカルサーバー (`http://localhost:8080`) が立ち上がり、ブラウザが開きます。
もし自動で開かない場合は、ブラウザで `http://localhost:8080/auth/login` にアクセスし、Google アカウントでログインして権限を許可してください。
認証が完了すると、MCP サーバーとしての機能が利用可能になります。

> **注意**: すでに認証済み（`.tokens.json` が存在する）の場合、サーバーは MCP モード（Stdio）で起動し、コンソールには何も出力されず、Web サーバーも起動しません。これは正常な動作です。
> 再認証を行いたい場合は、`.tokens.json` を削除してからコマンドを実行してください。

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

