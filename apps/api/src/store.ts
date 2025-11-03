export type Session = {
  id: string;
  asked: Set<string>;
  beliefs: Map<string, number>;
  steps: number;
  scaredMeter?: { count: number; sum: number };
};

export const SESSIONS = new Map<string, Session>();


export let MANIFEST: any = null;
export let SCARES_BY_ID: Map<string, { tags: string[] }> = new Map();

export function setManifest(m: any, scaresById: Map<string, { tags: string[] }>) {
  MANIFEST = m;
  SCARES_BY_ID = scaresById;
}
