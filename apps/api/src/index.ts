import fastify from 'fastify'
import cors from '@fastify/cors'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const MONO_ROOT = path.resolve(__dirname, '../../..')

// LOGGING JUST IN CASE
console.log('MONO_ROOT:', MONO_ROOT)

const app = fastify({ logger: true })
await app.register(cors as any, { origin: true })

app.get('/health', async () => ({ ok: true }))

app.get('/static/*', async (req, reply) => {
  const rel = (req.params as any)['*'] as string
  const file = path.resolve(MONO_ROOT, rel)
  if (!file.startsWith(MONO_ROOT)) return reply.code(400).send('Bad Path')
  if (!fs.existsSync(file)) return reply.code(404).send('Not Found')
  return reply.send(fs.createReadStream(file))
})

type AnswerStr = 'Yes'|'Probably'|'Unknown'|'ProbablyNot'|'No'

type Scare = {
  id: string
  title: string
  category: string
  intensity: number
  tags?: string[]
  media?: { image?: string; jump?: string; audio?: string }
}

type Question = { id: string; text: string; theme?: string }

type LikelihoodRow = {
  scareId: string
  questionId: string
  p_yes: number
  p_prob_yes: number
  p_unknown: number
  p_prob_no: number
  p_no: number
}

type Manifest = {
  scares: Scare[]
  questions?: Question[]
  likelihoods?: LikelihoodRow[]
  thresholds?: { guessProbability?: number; maxSteps?: number }
  meta?: { defaultAnswerSet?: AnswerStr[] }
}

function loadManifest(): Manifest {
  const p = path.join(MONO_ROOT, 'data', 'scaryfinder.manifest.json')
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

const MANIFEST = loadManifest()
const SCARES_BY_ID = new Map(MANIFEST.scares.map(s => [s.id, s]))
const LIK_BY_Q = new Map<string, LikelihoodRow[]>()
for (const row of (MANIFEST.likelihoods ?? [])) {
  const arr = LIK_BY_Q.get(row.questionId) ?? []
  arr.push(row)
  LIK_BY_Q.set(row.questionId, arr)
}

app.get('/manifest', async () => ({ count: MANIFEST.scares?.length ?? 0, manifest: MANIFEST }))

const ANSWER_KEY: Record<AnswerStr, keyof LikelihoodRow> = {
  Yes: 'p_yes',
  Probably: 'p_prob_yes',
  Unknown: 'p_unknown',
  ProbablyNot: 'p_prob_no',
  No: 'p_no',
}

function normalize(beliefs: Map<string, number>) {
  let s = 0
  for (const p of beliefs.values()) s += p
  if (s <= 0) return
  for (const [k, p] of beliefs) beliefs.set(k, p / s)
}

function topK(beliefs: Map<string, number>, k = 5) {
  return [...beliefs.entries()]
    .map(([scareId, prob]) => ({ scareId, prob }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, k)
}

function chooseNextQuestion(asked: Set<string>): Question | null {
  for (const q of MANIFEST.questions ?? []) {
    if (asked.has(q.id)) continue
    if (!LIK_BY_Q.has(q.id)) continue
    return q
  }
  for (const q of MANIFEST.questions ?? []) {
    if (!asked.has(q.id)) return q
  }
  return null
}

function bayesUpdate(beliefs: Map<string, number>, questionId: string, answer: AnswerStr) {
  const lk = LIK_BY_Q.get(questionId)
  if (!lk) return
  const key = ANSWER_KEY[answer]
  const w = new Map<string, number>()
  for (const row of lk) w.set(row.scareId, (row as any)[key] as number)

  for (const [sid, p] of beliefs) {
    const like = w.get(sid)
    if (like != null) beliefs.set(sid, p * like)
  }
  normalize(beliefs)
}

const QUESTION_TAG_BOOSTS: Record<string, { yes?: string[]; no?: string[] }> = {
  q_real_life:       { yes: ['real_life'] },
  q_glitch:          { yes: ['glitch'] },
  q_dark_eyes:       { yes: ['dark_eyes'] },
  q_mirror:          { yes: ['mirror'] },
  q_surveillance:    { yes: ['surveillance','webcam_like','phone_ui'] },
  q_cringe:          { yes: ['cringe'] },
  q_noise_startle:   { yes: ['audio_jump'] },
  q_tension_vs_jump: { yes: ['tension_slow'], no: ['visual_jump'] },
}

const TAG_YES_MULT = 1.12
const TAG_NO_MULT  = 0.96

function tagBoostUpdate(
  beliefs: Map<string, number>,
  qid: string,
  answer: AnswerStr
) {
  const map = QUESTION_TAG_BOOSTS[qid]
  if (!map) return

  const dir = (answer === 'Yes' || answer === 'Probably') ? 'yes'
           : (answer === 'No'  || answer === 'ProbablyNot') ? 'no'
           : 'unknown'

  let sum = 0
  for (const [sid, p] of beliefs) {
    const scare = SCARES_BY_ID.get(sid)
    if (!scare?.tags?.length) { sum += p; continue }

    let mult = 1
    if (dir === 'yes' && map.yes) {
      const hits = scare.tags.filter(t => map.yes!.includes(t)).length
      if (hits > 0) mult *= Math.pow(TAG_YES_MULT, hits)
    } else if (dir === 'no' && map.no) {
      const hits = scare.tags.filter(t => map.no!.includes(t)).length
      if (hits > 0) mult *= Math.pow(TAG_NO_MULT, hits)
    }
    const np = p * mult
    beliefs.set(sid, np)
    sum += np
  }
  for (const [sid, p] of beliefs) beliefs.set(sid, p / sum)
}

type Session = {
  id: string
  asked: Set<string>
  beliefs: Map<string, number>
  steps: number
  scaredMeter?: { count: number; sum: number }
}
const SESSIONS = new Map<string, Session>()

app.post('/session/start', async (req, reply) => {
  const id = crypto.randomUUID()
  const scares = MANIFEST.scares.map(s => s.id)
  const prior = 1 / Math.max(1, scares.length)
  const beliefs = new Map<string, number>(scares.map(sid => [sid, prior]))
  const s: Session = { id, asked: new Set(), beliefs, steps: 0 }
  SESSIONS.set(id, s)

  const q = chooseNextQuestion(s.asked)
  if (q) s.asked.add(q.id)

  return { sessionId: id, question: q ?? null, top: topK(beliefs) }
})

app.post('/answer', async (req, reply) => {
  const body = req.body as { sessionId: string; questionId: string; answer: AnswerStr }
  const s = SESSIONS.get(body.sessionId)
  if (!s) return reply.code(404).send({ error: 'bad session' })

  bayesUpdate(s.beliefs, body.questionId, body.answer)
  tagBoostUpdate(s.beliefs, body.questionId, body.answer)

  s.steps++

  const top1 = topK(s.beliefs, 1)[0]
  const done =
    s.steps >= (MANIFEST.thresholds?.maxSteps ?? 12) ||
    (!!top1 && top1.prob >= (MANIFEST.thresholds?.guessProbability ?? 0.82))

  let next: Question | null = null
  if (!done) {
    const q = chooseNextQuestion(s.asked)
    if (q) { s.asked.add(q.id); next = q }
  }

  return { next, top: topK(s.beliefs) }
})

app.post('/recommendation', async (req, reply) => {
  const body = req.body as { sessionId: string }
  const s = SESSIONS.get(body.sessionId)
  if (!s) return reply.code(404).send({ error: 'bad session' })
  const [best] = topK(s.beliefs, 1)
  if (!best) return { scare: null, prob: 0 }
  return { scare: SCARES_BY_ID.get(best.scareId), prob: best.prob }
})

app.post('/probe', async (req, reply) => {
  const body = req.body as { sessionId: string; scareId: string; rating: number }
  const s = SESSIONS.get(body.sessionId)
  if (!s) return reply.code(404).send({ error: 'bad session' })

  s.scaredMeter ??= { count: 0, sum: 0 }
  s.scaredMeter.count += 1
  s.scaredMeter.sum += body.rating

  const centered = (body.rating - 5) / 5
  const K = 0.25
  const mult = Math.exp(K * centered)

  let sum = 0
  for (const [sid, p] of s.beliefs) {
    const np = sid === body.scareId ? p * mult : p
    s.beliefs.set(sid, np)
    sum += np
  }
  for (const [sid, p] of s.beliefs) s.beliefs.set(sid, p / sum)

  return { ok: true, scaredMeterAvg: s.scaredMeter.sum / s.scaredMeter.count }
})

const PORT = Number(process.env.PORT || 8787)
app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => console.log(`API on http://localhost:${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1) })
