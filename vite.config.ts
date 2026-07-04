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

      // icons ディレクトリを作成してコピー
      if (!existsSync('dist/icons')) {
        mkdirSync('dist/icons');
      }
      const iconSizes = [16, 32, 48, 128];
      iconSizes.forEach((size) => {
        const srcPath = `src/icons/icon${size}.png`;
        const destPath = `dist/icons/icon${size}.png`;
        if (existsSync(srcPath)) {
          const icon = readFileSync(srcPath);
          writeFileSync(destPath, icon);
        }
      });
    }
  };
}

const target = process.env.BUILD_TARGET || 'popup';

export default defineConfig(() => {
  if (target === 'background') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: true, // 最初のビルドで出力をクリアする
        lib: {
          entry: resolve(__dirname, 'src/background/index.ts'),
          formats: ['es'],
          fileName: () => 'background/index.js',
        },
        sourcemap: true,
      }
    };
  }

  if (target === 'content') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false, // 前の成果物を残す
        lib: {
          entry: resolve(__dirname, 'src/content/index.ts'),
          formats: ['iife'], // Content Script は IIFE 形式ですべての依存モジュールを自己完結インライン化する
          name: 'ContentScript',
          fileName: () => 'content/index.js',
        },
        sourcemap: true,
      }
    };
  }

  // デフォルト: popup
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/popup/index.ts'),
        formats: ['es'],
        fileName: () => 'popup/index.js',
      },
      sourcemap: true,
    },
    plugins: [copyManifestAndHtml()],
  };
});
