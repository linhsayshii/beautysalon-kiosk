import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { initWebSocketServer, broadcastToBranch } from './ws.js';

test('WebSocket server connects and broadcasts events by branch', async (t) => {
  const fakeServer = new EventEmitter();
  const wss = initWebSocketServer(fakeServer);

  // Mock a client joining branch 1
  const client1 = new EventEmitter();
  client1.readyState = WebSocket.OPEN;
  client1.branchId = 1;
  const received1 = [];
  client1.send = (msg) => received1.push(JSON.parse(msg.toString()));

  // Mock a client joining branch 2
  const client2 = new EventEmitter();
  client2.readyState = WebSocket.OPEN;
  client2.branchId = 2;
  const received2 = [];
  client2.send = (msg) => received2.push(JSON.parse(msg.toString()));

  wss.clients.add(client1);
  wss.clients.add(client2);

  // Broadcast event to branch 1
  broadcastToBranch(1, 'pos:order_created', { orderId: 99, total: 250000 });
  // Broadcast event to branch 2 (should not receive branch 1 events)
  broadcastToBranch(2, 'pos:order_created', { orderId: 100, total: 500000 });

  assert.equal(received1.length, 1);
  assert.equal(received1[0].event, 'pos:order_created');
  assert.equal(received1[0].data.orderId, 99);

  assert.equal(received2.length, 1);
  assert.equal(received2[0].event, 'pos:order_created');
  assert.equal(received2[0].data.orderId, 100);

  wss.close();
});
