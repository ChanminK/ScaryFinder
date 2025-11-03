export type AnswerStr = 'Yes'|'Probably'|'Unknown'|'ProbablyNot'|'No';

type LikelihoodRow = {
  scareId: string;
  questionId: string;
  p_yes: number; p_prob_yes: number; p_unknown: number; p_prob_no: number; p_no: number;
};

type Question = { id: string; text: string; theme?: string };
type Scare = { id: string; title: string; category: string; intensity: number; tags?: string[] };

type Manifest = {
  scares: Scare[];
  questions?: Question[];
  likelihoods?: LikelihoodRow[];
  thresholds?: { guessProbability?: number; maxSteps?: number };
};

const ANSWER_KEY: Record<AnswerStr, keyof LikelihoodRow> = {
  Yes: 'p_yes',
  Probably: 'p_prob_yes',
  Unknown: 'p_unknown',
  ProbablyNot: 'p_prob_no',
  No: 'p_no',
};

export function normalize(beliefs: Map<string, number>) {
  let s = 0; for (const p of beliefs.values()) s += p;
  if (s <= 0) return;
  for (const [k, p] of beliefs) beliefs.set(k, p / s);
}

export function topK(beliefs: Map<string, number>, k = 5) {
  return [...beliefs.entries()]
    .map(([scareId, prob]) => ({ scareId, prob }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, k);
}

function likByQuestion(manifest: Manifest) {
  const map = new Map<string, LikelihoodRow[]>();
  for (const row of (manifest.likelihoods ?? [])) {
    const arr = map.get(row.questionId) ?? [];
    arr.push(row);
    map.set(row.questionId, arr);
  }
  return map;
}

export function updateBeliefs(
  beliefs: Map<string, number>,
  manifest: Manifest,
  questionId: string,
  answer: AnswerStr
) {
  const byQ = likByQuestion(manifest);
  const lk = byQ.get(questionId);
  if (!lk) return;
  const key = ANSWER_KEY[answer];

  for (const row of lk) {
    const cur = beliefs.get(row.scareId);
    if (cur != null) beliefs.set(row.scareId, cur * (row as any)[key]);
  }
  normalize(beliefs);
}

export function chooseNextQuestion(
  manifest: Manifest,
  session: { asked: Set<string> }
): string | null {
  const byQ = likByQuestion(manifest);
  for (const q of manifest.questions ?? []) {
    if (session.asked.has(q.id)) continue;
    if (byQ.has(q.id)) return q.id;
  }
  for (const q of manifest.questions ?? []) {
    if (!session.asked.has(q.id)) return q.id;
  }
  return null;
}

export const QUESTION_TAG_BOOSTS: Record<string, { yes?: string[]; no?: string[] }> = {
  q_real_life:       { yes: ['real_life'] },
  q_glitch:          { yes: ['glitch'] },
  q_dark_eyes:       { yes: ['dark_eyes'] },
  q_mirror:          { yes: ['mirror'] },
  q_surveillance:    { yes: ['surveillance','webcam_like','phone_ui'] },
  q_cringe:          { yes: ['cringe'] },
  q_noise_startle:   { yes: ['audio_jump'] },
  q_tension_vs_jump: { yes: ['tension_slow'], no: ['visual_jump'] },
};

const TAG_YES_MULT = 1.12;
const TAG_NO_MULT  = 0.96;

export function tagBoostUpdate(
  beliefs: Map<string, number>,
  scaresById: Map<string, { tags?: string[] }>,
  qid: string,
  answer: AnswerStr
) {
  const map = QUESTION_TAG_BOOSTS[qid];
  if (!map) return;

  const dir = (answer === 'Yes' || answer === 'Probably') ? 'yes'
           : (answer === 'No'  || answer === 'ProbablyNot') ? 'no'
           : 'unknown';

  let sum = 0;
  for (const [sid, p] of beliefs) {
    const scare = scaresById.get(sid);
    const tags = scare?.tags ?? [];
    let mult = 1;

    if (dir === 'yes' && map.yes) {
      const hits = tags.filter(t => map.yes!.includes(t)).length;
      if (hits > 0) mult *= Math.pow(TAG_YES_MULT, hits);
    } else if (dir === 'no' && map.no) {
      const hits = tags.filter(t => map.no!.includes(t)).length;
      if (hits > 0) mult *= Math.pow(TAG_NO_MULT, hits);
    }

    const np = p * mult;
    beliefs.set(sid, np);
    sum += np;
  }
  for (const [sid, p] of beliefs) beliefs.set(sid, p / sum);
}
