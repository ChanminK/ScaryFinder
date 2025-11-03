import { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  AnswerStr,
  updateBeliefs,
  topK,
  chooseNextQuestion,
  tagBoostUpdate,
} from '../engine';

type Manifest = {
  scares: { id: string; tags?: string[] }[];
  questions?: { id: string; text: string; theme?: string }[];
  likelihoods?: any[];
  thresholds?: { guessProbability?: number; maxSteps?: number };
};

const ROOT = process.cwd();
function loadManifest(): Manifest {
  const p = path.join(ROOT, 'data', 'scaryfinder.manifest.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export const SESSIONS = new Map<string, {
  id: string;
  asked: Set<string>;
  beliefs: Map<string, number>;
  steps: number;
}>();

export const gameRoutes: FastifyPluginAsync = async (app) => {
  app.get('/manifest', async () => {
    const m = loadManifest();
    return { count: m.scares?.length ?? 0, manifest: m };
  });

  app.post('/session/start', async (_req, _reply) => {
    const MANIFEST = loadManifest();
    const id = crypto.randomUUID();

    const scares = MANIFEST.scares.map((s: any) => s.id);
    const prior = 1 / Math.max(1, scares.length);
    const beliefs = new Map<string, number>(scares.map((sid: string) => [sid, prior]));

    const asked = new Set<string>();
    const s = { id, asked, beliefs, steps: 0 };
    SESSIONS.set(id, s);

    const qid = chooseNextQuestion(MANIFEST as any, s);
    if (qid) asked.add(qid);

    return {
      sessionId: id,
      question: (MANIFEST.questions ?? []).find((q: any) => q.id === qid) ?? null,
      top: topK(beliefs),
    };
  });

  app.post('/answer', async (req, reply) => {
    const { sessionId, questionId, answer } = req.body as {
      sessionId: string; questionId: string; answer: AnswerStr;
    };
    const s = SESSIONS.get(sessionId);
    if (!s) return reply.code(404).send({ error: 'bad session' });

    const MANIFEST = loadManifest();

    updateBeliefs(s.beliefs, MANIFEST as any, questionId, answer);

    const SCARES_BY_ID = new Map(MANIFEST.scares.map((x: any) => [x.id, x]));
    tagBoostUpdate(s.beliefs, SCARES_BY_ID, questionId, answer);

    s.steps++;

    const ranked = topK(s.beliefs, 1);
    const top1 = ranked[0];
    const done =
      s.steps >= (MANIFEST.thresholds?.maxSteps ?? 12) ||
      (top1 && top1.prob >= (MANIFEST.thresholds?.guessProbability ?? 0.82));

    let next = null as any;
    if (!done) {
      const qid = chooseNextQuestion(MANIFEST as any, s);
      if (qid) {
        s.asked.add(qid);
        next = (MANIFEST.questions ?? []).find((q: any) => q.id === qid) ?? null;
      }
    }

    return { next, top: topK(s.beliefs) };
  });

  app.post('/recommendation', async (req, reply) => {
    const { sessionId } = req.body as { sessionId: string };
    const s = SESSIONS.get(sessionId);
    if (!s) return reply.code(404).send({ error: 'bad session' });

    const MANIFEST = loadManifest();
    const SCARES_BY_ID = new Map(MANIFEST.scares.map((x: any) => [x.id, x]));

    const [best] = topK(s.beliefs, 1);
    if (!best) return { scare: null, prob: 0 };
    return { scare: SCARES_BY_ID.get(best.scareId), prob: best.prob };
  });
};
