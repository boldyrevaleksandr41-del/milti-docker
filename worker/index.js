import { createClient } from 'redis';

import keys from './keys.js'

const redisClient = createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPort,
    reconnectStrategy: 1000
  }
});

const sub = redisClient.duplicate()

function fib(index) {
  if (index < 2) return 1
  return fib(index - 1) + fib(index - 2)
}

const connectRedis = async () => {
  try {
    await Promise.all([
      redisClient.connect(),
      sub.connect()
    ])

    await sub.subscribe('insert', (message) => {
      redisClient.hSet('values', message, fib(parseInt(message)))
    })

    console.log('Redis connected and subscribed to "insert" channel');
  } catch (err) {
    console.error('Redis connect failed from worker', err);
  }
}

async function closeGracefullyRedisClient(rClient, redisClienName) {
  try {
    // аккуратно закрываем: дождётся отправки/получения ответов
    await rClient.close()
    console.log(`Redis ${redisClienName} closed gracefully`)
  } catch (err) {
    console.error(`Error closing Redis in worker ${redisClienName} gracefully, destroying:`, err)
    // в крайнем случае — форсируем
    rClient.destroy()
  }
}

// Грейсфул-шутдаун
 async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`)

  try {
    // аккуратно закрываем: дождётся отправки/получения ответов
    await Promise.all([
      closeGracefullyRedisClient(redisClient, 'redisClient'),
      closeGracefullyRedisClient(sub, 'sub')
    ])
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// В случае критической ошибки — форсируем (не ждём)
process.on('uncaughtException', err => {
  console.error('uncaughtException', err);
  redisClient.destroy()
  sub.destroy()
  process.exit(1);
});


connectRedis()