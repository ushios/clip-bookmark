import { vi } from 'vitest';

// Chrome Extension API のグローバルモックオブジェクトの定義
const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: vi.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: vi.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
    },
    sync: {
      get: vi.fn((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: vi.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: vi.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
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
    query: vi.fn((queryInfo, callback) => {
      if (callback) callback([]);
    }),
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
