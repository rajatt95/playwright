/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { playwrightTest as test, expect } from '../config/browserTest';
import { execSync } from 'child_process';
import fs from 'fs';

test.slow();

test('should close the browser when the node process closes', async ({ startRemoteServer, isWindows, server }) => {
  const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE });
  if (isWindows)
    execSync(`taskkill /pid ${remoteServer.child().pid} /T /F`, { stdio: 'ignore' });
  else
    process.kill(remoteServer.child().pid);
  // We might not get browser exitCode in time when killing the parent node process,
  // so we don't check it here.
  expect(await remoteServer.childExitCode()).toBe(isWindows ? 1 : 0);
});

test.describe('signals', () => {
  test.skip(({ platform }) => platform === 'win32');

  test('should report browser close signal', async ({ startRemoteServer, server, headless }) => {
    test.skip(!headless, 'Wrong exit code in headed');

    const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE });
    const pid = await remoteServer.out('pid');
    process.kill(-pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGTERM');
    process.kill(remoteServer.child().pid);
    await remoteServer.childExitCode();
  });

  test('should report browser close signal 2', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE });
    const pid = await remoteServer.out('pid');
    process.kill(-pid, 'SIGKILL');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    process.kill(remoteServer.child().pid);
    await remoteServer.childExitCode();
  });

  test('should close the browser on SIGINT', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE });
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(130);
  });

  test('should close the browser on SIGTERM', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE });
    process.kill(remoteServer.child().pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  test('should close the browser on SIGHUP', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE });
    process.kill(remoteServer.child().pid, 'SIGHUP');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  test('should kill the browser on double SIGINT and remove temp dir', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ stallOnClose: true, url: server.EMPTY_PAGE });
    const tempDir = await remoteServer.out('tempDir');
    const before = fs.existsSync(tempDir);
    process.kill(remoteServer.child().pid, 'SIGINT');
    await remoteServer.out('stalled');
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    expect(await remoteServer.childExitCode()).toBe(130);
    const after = fs.existsSync(tempDir);
    expect(before).toBe(true);
    expect(after).toBe(false);
  });

  test('should remove temp dir on process.exit', async ({ startRemoteServer, server }, testInfo) => {
    const file = testInfo.outputPath('exit.file');
    const remoteServer = await startRemoteServer({ url: server.EMPTY_PAGE, exitOnFile: file });
    const tempDir = await remoteServer.out('tempDir');
    const before = fs.existsSync(tempDir);
    fs.writeFileSync(file, 'data', 'utf-8');
    expect(await remoteServer.childExitCode()).toBe(42);
    const after = fs.existsSync(tempDir);
    expect(before).toBe(true);
    expect(after).toBe(false);
  });

  test('should kill the browser on SIGINT + SIGTERM', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ stallOnClose: true, url: server.EMPTY_PAGE });
    process.kill(remoteServer.child().pid, 'SIGINT');
    await remoteServer.out('stalled');
    process.kill(remoteServer.child().pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  test('should kill the browser on SIGTERM + SIGINT', async ({ startRemoteServer, server }) => {
    const remoteServer = await startRemoteServer({ stallOnClose: true, url: server.EMPTY_PAGE });
    process.kill(remoteServer.child().pid, 'SIGTERM');
    await remoteServer.out('stalled');
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    expect(await remoteServer.childExitCode()).toBe(130);
  });
});
