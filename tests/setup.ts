import { vi } from 'vitest';

// Chrome Extension API のグローバルモックオブジェクトの定義
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    id: 'mock-extension-id',
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// グローバルオブジェクトに chrome を設定
global.chrome = chromeMock as unknown as typeof chrome;

// テストごとにモックの呼び出し履歴をクリアする設定
beforeEach(() => {
  vi.clearAllMocks();
});
