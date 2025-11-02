import fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import fs from 'node:fs'

const app = fastify({ logger: true })

await app.register(cors as any, { origin: true })

app.get('/health', async () => ({ ok: true }))

const ROOT = process.cwd()

app.get('/static/*', async (require, reply) => {
  const rel = (require.params as any)['*'] as string
  const file = path.join(ROOT, rel)
  if (!file.startsWith(ROOT)) return reply.code(400).send('Bad Path')
  if (!fs.existsSync(file)) return reply.code(404).send('Not Found')
  return reply.send(fs.createReadStream(file))
})

type Scare = {
  id: string
  title: string
  category: string
  intensity: number
  tags?: string[]
  safetyFlags?: string[]
  media?: { poster?: string; image?: string; jump?: string; audio?: string }
  contentWarnings?: string[]
  rights?: Record<string, unknown>
}

type Manifest = {
  scares: Scare[]
  questions?: { id: string; text: string; theme?: string }[]
  likelihoods?: any[]
  thresholds?: { guessProbability?: number; maxSteps?: number }
}

function loadManifest(): Manifest {
  const p = path.join(ROOT, 'data', 'scaryfinder.manifest.json')
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

app.get('/manifest', async () => {
  const m = loadManifest()
  return { count: m.scares?.length ?? 0, manifest: m }
})

const PORT = Number(process.env.PORT || 8787)

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => console.log(`API on http://localhost:${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1) })


