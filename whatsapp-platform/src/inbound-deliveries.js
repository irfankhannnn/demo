import fs from 'fs/promises';
import path from 'path';
import { AUTH_STATE_DIR, LOCAL_STORAGE } from './config.js';
import { logger } from './logger.js';

const FILE_NAME = 'inbound-deliveries.json';
const MAX_ATTEMPTS = 8;
const MAX_AGE_MS = 15 * 60 * 1000;

const memoryQueue = new Map();
let loaded = false;
let writeChain = Promise.resolve();

function storePath() {
  return path.resolve(AUTH_STATE_DIR, FILE_NAME);
}

async function load() {
  if (loaded || !LOCAL_STORAGE) return;
  loaded = true;
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    for (const delivery of JSON.parse(raw)) {
      if (delivery?.messageId && Date.now() - delivery.createdAt < MAX_AGE_MS) {
        memoryQueue.set(delivery.messageId, delivery);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn({ error: error.message }, 'inbound_delivery.load_failed');
    }
  }
}

function persist() {
  if (!LOCAL_STORAGE) return Promise.resolve();
  writeChain = writeChain.then(async () => {
    const target = storePath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify([...memoryQueue.values()]), 'utf8');
    await fs.rename(temporary, target);
  }).catch((error) => {
    logger.error({ error: error.message }, 'inbound_delivery.persist_failed');
  });
  return writeChain;
}

export async function enqueueInbound(payload) {
  await load();
  const existing = memoryQueue.get(payload.messageId);
  if (existing) return existing;
  const delivery = {
    ...payload,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
  memoryQueue.set(payload.messageId, delivery);
  await persist();
  logger.info({ messageId: payload.messageId, queueDepth: memoryQueue.size }, 'inbound_delivery.queued');
  return delivery;
}

export async function acknowledgeInbound(messageId) {
  await load();
  if (!memoryQueue.delete(messageId)) return;
  await persist();
  logger.info({ messageId, queueDepth: memoryQueue.size }, 'inbound_delivery.acknowledged');
}

export async function failInbound(messageId, error) {
  await load();
  const delivery = memoryQueue.get(messageId);
  if (!delivery) return;
  delivery.attempts += 1;
  const delay = Math.min(1000 * (2 ** Math.min(delivery.attempts, 6)), 60_000);
  delivery.nextAttemptAt = Date.now() + delay;
  delivery.lastError = error?.message || String(error);
  if (delivery.attempts >= MAX_ATTEMPTS || Date.now() - delivery.createdAt > MAX_AGE_MS) {
    memoryQueue.delete(messageId);
    logger.error({ messageId, attempts: delivery.attempts, error: delivery.lastError }, 'inbound_delivery.abandoned');
  } else {
    logger.warn({ messageId, attempts: delivery.attempts, delay, error: delivery.lastError }, 'inbound_delivery.retry_scheduled');
  }
  await persist();
}

export async function drainInbound(deliver) {
  await load();
  const due = [...memoryQueue.values()]
    .filter((delivery) => delivery.nextAttemptAt <= Date.now())
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const delivery of due) {
    try {
      await deliver(delivery);
      await acknowledgeInbound(delivery.messageId);
    } catch (error) {
      await failInbound(delivery.messageId, error);
    }
  }
  return due.length;
}

export async function getInboundDeliveryStats() {
  await load();
  return { queueDepth: memoryQueue.size, storage: LOCAL_STORAGE ? 'local-file' : 'memory' };
}
