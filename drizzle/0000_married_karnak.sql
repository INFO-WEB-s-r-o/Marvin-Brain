CREATE TABLE IF NOT EXISTS "chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"embedding" text,
	"embedding_model" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consolidation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" text DEFAULT 'running' NOT NULL,
	"candidates_count" integer,
	"clusters_count" integer,
	"facts_created" integer,
	"thoughts_pruned" integer,
	"errors" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"content" text,
	"summary" text,
	"url" text,
	"source" text,
	"content_hash" text,
	"summary_embedding" text,
	"summary_embedding_model" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embedding_cache" (
	"content_hash" text PRIMARY KEY NOT NULL,
	"embedding" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_document_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"fact_id" text NOT NULL,
	"document_id" text NOT NULL,
	"relevance_score" real DEFAULT 1 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"statement" text NOT NULL,
	"embedding" text,
	"embedding_model" text,
	"is_latest" boolean DEFAULT true NOT NULL,
	"parent_fact_id" text,
	"root_fact_id" text,
	"is_forgotten" boolean DEFAULT false NOT NULL,
	"forget_reason" text,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"confidence" real,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "thoughts" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" text,
	"embedding_model" text,
	"weight" integer DEFAULT 0 NOT NULL,
	"mention_count" integer DEFAULT 1 NOT NULL,
	"last_mentioned_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp,
	"access_count" integer DEFAULT 0 NOT NULL,
	"is_forgotten" boolean DEFAULT false NOT NULL,
	"forget_reason" text,
	"container_tag" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_document_sources" ADD CONSTRAINT "memory_document_sources_fact_id_memory_entries_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_document_sources" ADD CONSTRAINT "memory_document_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chunks_document_id_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_content_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mds_fact_id_idx" ON "memory_document_sources" USING btree ("fact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mds_doc_id_idx" ON "memory_document_sources" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_is_latest_idx" ON "memory_entries" USING btree ("is_latest");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_parent_idx" ON "memory_entries" USING btree ("parent_fact_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "thoughts_content_hash_idx" ON "thoughts" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thoughts_weight_idx" ON "thoughts" USING btree ("weight");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thoughts_container_tag_idx" ON "thoughts" USING btree ("container_tag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thoughts_is_forgotten_idx" ON "thoughts" USING btree ("is_forgotten");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thoughts_last_mentioned_at_idx" ON "thoughts" USING btree ("last_mentioned_at");