import fs from 'fs/promises';
import path from 'path';
import { AUTH_STATE_DIR, LOCAL_STORAGE } from './config.js';
import { logger } from './logger.js';

const FILE_NAME = 'outbound-deliveries.json';
const MAX_AGE_MS = 15 * 60 * 1000;
const queue = new Map();
let loaded = false;
let writeChain = Promise.resolve();

function queuePath() {
  return path.resolve(AUTH_STATE_DIR, FILE_NAME);
}

async function load() {
  if (loaded || !LOCAL_STORAGE) return;
  loaded = true;
  try {
    for (const item of JSON.parse(await fs.readFile(queuePath(), 'utf8'))) {
      if (item?.id && Date.now() - item.createdAt < MAX_AGE_MS) queue.set(item.id, item);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn({ error: error.message }, 'outbound_delivery.load_failed');
  }
}

function persist() {
  if (!LOCAL_STORAGE) return Promise.resolve();
  writeChain = writeChain.then(async () => {
    const target = queuePath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify([...queue.values()]), 'utf8');
    await fs.rename(temporary, target);
  }).catch((error) => logger.error({ error: error.message }, 'outbound_delivery.persist_failed'));
  return writeChain;
}

export async function enqueueOutbound(delivery) {
  await load();
  if (!queue.has(delivery.id)) {
    queue.set(delivery.id, { ...delivery, createdAt: Date.now(), attempts: 0, nextAttemptAt: Date.now() });
    await persist();
  }
  return queue.get(delivery.id);
}

export async function acknowledgeOutbound(id) {
  await load();
  if (queue.delete(id)) await persist();
}

export async function drainOutbound(phone, send) {
  await load();
  const due = [...queue.values()]
    .filter((item) => item.from === phone && item.nextAttemptAt <= Date.now())
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const item of due) {
    if (Date.now() - item.createdAt > MAX_AGE_MS) {
      queue.delete(item.id);
      continue;
    }
    try {
      await send(item);
      queue.delete(item.id);
      logger.info({ id: item.id, phone }, 'outbound_delivery.acknowledged');
    } catch (error) {
      item.attempts += 1;
      item.nextAttemptAt = Date.now() + Math.min(1000 * (2 ** Math.min(item.attempts, 6)), 60_000);
      item.lastError = error.message;
    }
  }
  await persist();
  return due.length;
}

export async function getOutboundDeliveryStats() {
  await load();
  return { queueDepth: queue.size, storage: LOCAL_STORAGE ? 'local-file' : 'memory' };
}
