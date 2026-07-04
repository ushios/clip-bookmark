import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

// 静的ファイルをコピーする簡易プラグイン
function copyManifestAndHtml() {
  return {
    name: 'copy-manifest-and-html',
    closeBundle() {
      // dist ディレクトリが存在することを確認
      if (!existsSync('dist')) {
        mkdirSync('dist');
      }

      // manifest.json をコピー
      if (existsSync('src/manifest.json')) {
        const manifest = readFileSync('src/manifest.json', 'utf-8');
        writeFileSync('dist/manifest.json', manifest);
      }

      // popup ディレクトリを作成して index.html をコピー
      if (!existsSync('dist/popup')) {
        mkdirSync('dist/popup');
      }
      if (existsSync('src/popup/index.html')) {
        let html = readFileSync('src/popup/index.html', 'utf-8');
        // JSの参照先をビルド後のパスに書き換える (index.ts -> index.js)
        html = html.replace('index.ts', 'index.js');
        writeFileSync('dist/popup/index.html', html);
      }

      // CSSファイルなども popup にコピー
      if (existsSync('src/popup/index.css')) {
        const css = readFileSync('src/popup/index.css', 'utf-8');
        writeFileSync('dist/popup/index.css', css);
      }
    }
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/index.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'popup/index.js';
          }
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      }
    }
  },
  plugins: [copyManifestAndHtml()],
});
