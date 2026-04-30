import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// ─── Thoughts ────────────────────────────────────────────────────────────
export const thoughts = pgTable(
  "thoughts",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),

    // pgvector(1536) column added by setup-vectors.ts; we keep a JSON fallback here
    // for portability and tests.
    embedding: text("embedding"),
    embeddingModel: text("embedding_model"),

    weight: integer("weight").notNull().default(0),
    mentionCount: integer("mention_count").notNull().default(1),
    lastMentionedAt: timestamp("last_mentioned_at").notNull().defaultNow(),

    lastAccessedAt: timestamp("last_accessed_at"),
    accessCount: integer("access_count").notNull().default(0),

    isForgotten: boolean("is_forgotten").notNull().default(false),
    forgetReason: text("forget_reason"),

    containerTag: text("container_tag"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("thoughts_content_hash_idx").on(t.contentHash),
    index("thoughts_weight_idx").on(t.weight),
    index("thoughts_container_tag_idx").on(t.containerTag),
    index("thoughts_is_forgotten_idx").on(t.isForgotten),
    index("thoughts_last_mentioned_at_idx").on(t.lastMentionedAt),
  ],
)

// ─── Facts (memory_entries — simplified) ─────────────────────────────────
export const facts = pgTable(
  "memory_entries",
  {
    id: text("id").primaryKey(),
    statement: text("statement").notNull(),

    embedding: text("embedding"),
    embeddingModel: text("embedding_model"),

    isLatest: boolean("is_latest").notNull().default(true),
    parentFactId: text("parent_fact_id"),
    rootFactId: text("root_fact_id"),

    isForgotten: boolean("is_forgotten").notNull().default(false),
    forgetReason: text("forget_reason"),

    accessCount: integer("access_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at"),

    confidence: real("confidence"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("memory_entries_is_latest_idx").on(t.isLatest),
    index("memory_entries_parent_idx").on(t.parentFactId),
  ],
)

// ─── Documents ───────────────────────────────────────────────────────────
export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    content: text("content"),
    summary: text("summary"),
    url: text("url"),
    source: text("source"),
    contentHash: text("content_hash"),

    summaryEmbedding: text("summary_embedding"),
    summaryEmbeddingModel: text("summary_embedding_model"),

    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("documents_content_hash_idx").on(t.contentHash)],
)

// ─── Chunks ──────────────────────────────────────────────────────────────
export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    position: integer("position").notNull(),

    embedding: text("embedding"),
    embeddingModel: text("embedding_model"),

    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chunks_document_id_idx").on(t.documentId)],
)

// ─── Memory document sources ─────────────────────────────────────────────
export const factSources = pgTable(
  "memory_document_sources",
  {
    id: text("id").primaryKey(),
    factId: text("fact_id")
      .notNull()
      .references(() => facts.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    relevanceScore: real("relevance_score").notNull().default(1.0),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => [index("mds_fact_id_idx").on(t.factId), index("mds_doc_id_idx").on(t.documentId)],
)

// ─── Consolidation runs ──────────────────────────────────────────────────
export const consolidationRuns = pgTable("consolidation_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull().default("running"), // running | success | error
  candidatesCount: integer("candidates_count"),
  clustersCount: integer("clusters_count"),
  factsCreated: integer("facts_created"),
  thoughtsPruned: integer("thoughts_pruned"),
  errors: jsonb("errors"),
})

// ─── Embedding cache ─────────────────────────────────────────────────────
export const embeddingCache = pgTable("embedding_cache", {
  contentHash: text("content_hash").primaryKey(),
  embedding: text("embedding").notNull(), // JSON array of floats
  model: text("model").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
