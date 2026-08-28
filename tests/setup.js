// Test setup file - runs before all tests
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value.toString();
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

// Mock Lucide icons
global.lucide = {
  createIcons: vi.fn(),
  icons: {},
};

// Mock Firebase
global.db = null;
global.auth = null;

// Mock audio context
global.AudioContext = vi.fn().mockImplementation(() => ({
  resume: vi.fn(),
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  }),
  destination: {},
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock URLSearchParams for tests
global.URLSearchParams = URLSearchParams;

// Mock Date.now for consistent testing
const MOCK_DATE = new Date('2026-01-15T10:00:00Z').getTime();
global.Date.now = vi.fn(() => MOCK_DATE);

console.log('Test setup complete');
