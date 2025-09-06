import '@testing-library/jest-dom'

// Mock Worker for tests
global.Worker = class Worker {
  url: string | URL;
  options?: WorkerOptions | undefined;
  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
  }
  postMessage() {}
  terminate() {}
  addEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions) {}
  removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | EventListenerOptions) {}
  dispatchEvent(): boolean { return true; }
  onmessage = null;
  onmessageerror = null;
  onerror = null;
}

// Mock ResizeObserver if needed
global.ResizeObserver = class ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock URL.createObjectURL for worker tests
if (typeof URL.createObjectURL === 'undefined') {
  global.URL.createObjectURL = () => 'mock-url'
}