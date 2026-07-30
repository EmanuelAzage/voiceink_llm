export default {
  isAvailable: jest.fn(() => Promise.resolve(true)),
  requestPermissions: jest.fn(() => Promise.resolve('granted')),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve('')),
  cancel: jest.fn(() => Promise.resolve()),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
