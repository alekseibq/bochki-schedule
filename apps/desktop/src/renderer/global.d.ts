import type { BochkiDesktopApi } from '../preload/index.js';

declare global {
  interface Window {
    bochki: BochkiDesktopApi;
  }
}

export {};
