export interface LightRAGEntity {
  id: string
  name: string
  type?: string
}

export interface LightRAGQueryResult {
  entities: LightRAGEntity[]
  relations: Array<{ from: string; to: string; type?: string }>
  thought_ids?: string[]
  fact_ids?: string[]
}

export interface LightRAGClient {
  query: (q: string, opts?: { topK?: number }) => Promise<LightRAGQueryResult>
  index: (id: string, content: string) => Promise<void>
  cleanupDeleted: (thoughtIds: string[]) => Promise<void>
}

export interface LightRAGClientOptions {
  baseUrl: string
  _fetch?: typeof fetch
}

export function createLightRAGClient(opts: LightRAGClientOptions): LightRAGClient {
  const f = opts._fetch ?? fetch
  return {
    async query(q, queryOpts) {
      const res = await f(`${opts.baseUrl}/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, mode: "hybrid", top_k: queryOpts?.topK ?? 10 }),
      })
      if (!res.ok) return { entities: [], relations: [] }
      return (await res.json()) as LightRAGQueryResult
    },
    async index(id, content) {
      try {
        await f(`${opts.baseUrl}/index`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, content }),
        })
      } catch {
        // never fail writes on graph indexing errors
      }
    },
    async cleanupDeleted(thoughtIds) {
      try {
        await f(`${opts.baseUrl}/cleanup-deleted`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ thought_ids: thoughtIds }),
        })
      } catch {
        // best-effort
      }
    },
  }
}
