import express from 'express'
import cors from 'cors'
import { createClient } from 'redis';
import { Pool } from 'pg'

import keys from './keys.js'

// express app setup

const app = express()

app.use(cors())

app.use(express.json())

// express client setup
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
  ssl:
    process.env.NODE_ENV !== 'production'
      ? false
      : { rejectUnauthorized: false },
})

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.error(err));
});

const redisClient = createClient({
  socket: {
    host: keys.redisHost,
    port: keys.redisPort,
    reconnectStrategy: 1000
  }
});

const redisPublisher = redisClient.duplicate()

// Express route handler

app.get('/', (req, res) => {
  res.send('Hi')
})

app.get('/values/all', async (req, res) => {
  const values  =await pgClient.query('SELECT * from values')

  res.send(values.rows)
})

app.get('/values/current', async (req, res) => {
  const values = await redisClient.hGetAll('values')

  res.send(values)
})

app.post('/values', async (req, res) => {
  const index = req.body.index

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high')
  }

  redisClient.hSet('values', index, 'Nothing yet!')

  redisPublisher.publish('insert', index)

  pgClient.query('INSERT INTO values (number) VALUES ($1)', [index])

  res.send({ working: true })
})

const server = app.listen(5000, err => {
  console.log('Listening')
})

const connectRedis = async () => {
  try {
    await Promise.all([
      redisClient.connect(),
      redisPublisher.connect()
    ])

    console.log('redisClient connected and redisPublisher connected');
  } catch (err) {
    console.error('Redis connect failed from server', err);
  }
}

connectRedis()

async function closeGracefullyRedisClient(rClient, redisClienName) {
  try {
    // аккуратно закрываем: дождётся отправки/получения ответов
    await rClient.close()
    console.log(`Redis ${redisClienName} closed gracefully`)
  } catch (err) {
    console.error(`Error closing Redis in server ${redisClienName} gracefully, destroying:`, err)
    // в крайнем случае — форсируем
    rClient.destroy()
  }
}

// Грейсфул-шутдаун
 async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`)

  server.close(async (err) => {
    if (err) {
      console.error('Error closing HTTP server:', err)
      redisClient.destroy()
      redisPublisher.destroy()
      process.exit(1) // Exit with error if server closure fails
    }

    try {
      // аккуратно закрываем: дождётся отправки/получения ответов
      await Promise.all([
        closeGracefullyRedisClient(redisClient, 'redisClient'),
        closeGracefullyRedisClient(redisPublisher, 'redisPublisher')
      ])
    } finally {
      process.exit(0);
    }
  })
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// В случае критической ошибки — форсируем (не ждём)
process.on('uncaughtException', err => {
  console.error('uncaughtException', err);
  redisClient.destroy()
  redisPublisher.destroy()
  process.exit(1);
});