import { getPool } from "./client"

const VECTOR_DIM = 1536

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS vector`,

  // thoughts.embedding → vector(1536)
  `ALTER TABLE thoughts
     ADD COLUMN IF NOT EXISTS embedding_vec vector(${VECTOR_DIM})`,
  `CREATE INDEX IF NOT EXISTS thoughts_embedding_hnsw_idx
     ON thoughts USING hnsw (embedding_vec vector_cosine_ops)`,

  // facts.embedding → vector(1536)
  `ALTER TABLE memory_entries
     ADD COLUMN IF NOT EXISTS embedding_vec vector(${VECTOR_DIM})`,
  `CREATE INDEX IF NOT EXISTS facts_embedding_hnsw_idx
     ON memory_entries USING hnsw (embedding_vec vector_cosine_ops)`,

  // chunks.embedding → vector(1536)
  `ALTER TABLE chunks
     ADD COLUMN IF NOT EXISTS embedding_vec vector(${VECTOR_DIM})`,
  `CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
     ON chunks USING hnsw (embedding_vec vector_cosine_ops)`,
]

async function main() {
  const sql = getPool()
  for (const stmt of STATEMENTS) {
    console.log(`>> ${stmt.split("\n")[0]}`)
    await sql.unsafe(stmt)
  }
  await sql.end()
  console.log("vector setup complete")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
