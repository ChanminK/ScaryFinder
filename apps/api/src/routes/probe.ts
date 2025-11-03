import { FastifyPluginAsync } from 'fastify';
import { SESSIONS } from '../store';

export const probeRoutes: FastifyPluginAsync = async (app) => {
  app.post('/probe', {
    schema: {
      body: {
        type: 'object',
        required: ['sessionId','scareId','rating'],
        properties: {
          sessionId: { type: 'string' },
          scareId:   { type: 'string' },
          rating:    { type: 'number', minimum: 1, maximum: 10 }
        }
      }
    }
  }, async (req, reply) => {
    const { sessionId, scareId, rating } = req.body as any;
    const s = SESSIONS.get(sessionId);
    if (!s) return reply.code(404).send({ error: 'bad session' });

    s.scaredMeter ??= { count: 0, sum: 0 };
    s.scaredMeter.count += 1;
    s.scaredMeter.sum += rating;

    const centered = (rating - 5) / 5;
    const K = 0.25;
    const mult = Math.exp(K * centered);

    let sum = 0;
    for (const [sid, p] of s.beliefs) {
      const newP = sid === scareId ? p * mult : p;
      s.beliefs.set(sid, newP);
      sum += newP;
    }
    for (const [sid, p] of s.beliefs) s.beliefs.set(sid, p / sum);

    return { ok: true, scaredMeterAvg: s.scaredMeter.sum / s.scaredMeter.count };
  });
};
