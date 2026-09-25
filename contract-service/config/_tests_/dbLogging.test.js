import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import connectDB from '../db.js';

const originalUri = process.env.MONGO_URI;
beforeEach(() => {
  process.env.MONGO_URI = 'mongodb://synthetic-user:synthetic-password@invalid.example/test';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(process, 'exit').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalUri === undefined) delete process.env.MONGO_URI;
  else process.env.MONGO_URI = originalUri;
});

test('successful connection preserves configuration without logging its URI', async () => {
  jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
  await connectDB();
  expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URI);
  expect(console.log.mock.calls).toEqual([['MongoDB connected']]);
  expect(console.error).not.toHaveBeenCalled();
  expect(process.exit).not.toHaveBeenCalled();
});

test.each(['MongoServerSelectionError', 'mongodb://synthetic-user:synthetic-password@invalid.example'])('failure logs only a safe category (%s)', name => {
  jest.spyOn(mongoose, 'connect').mockRejectedValue(Object.assign(new Error(process.env.MONGO_URI), { name }));
  return connectDB().then(() => {
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error.mock.calls).toEqual([['MongoDB connection failed:', name === 'MongoServerSelectionError' ? name : 'ConnectionError']]);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
