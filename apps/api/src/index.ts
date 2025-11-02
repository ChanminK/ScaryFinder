import fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import fs from 'node:fs'

const app = fastify({ logger: true })
await app.register(cors as any, { origin: true })
app.get('/health', async () => ({ ok: true }))

const PORT = Number(process.env.PORT || 8787)
app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => console.log(`API on http://localhost:${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1) })

  const ROOT = process.cwd()

  
