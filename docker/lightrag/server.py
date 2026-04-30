"""
LightRAG sidecar — exposes /query, /index, /cleanup-deleted for marvin-brain.

Environment variables:
  OPENAI_API_KEY   — required for LightRAG LLM + embedding backend
  LIGHTRAG_DIR     — working directory for LightRAG graph files (default: /data)
  LLM_MODEL        — OpenAI model for LightRAG LLM (default: gpt-4o-mini)
  EMBED_MODEL      — OpenAI model for embeddings (default: text-embedding-3-small)

If OPENAI_API_KEY is absent the server starts in stub mode and returns empty
results. This matches the brain's graceful-degradation contract: recall falls
back to vector similarity only.
"""

import asyncio
import logging
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

# ── logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("lightrag-sidecar")

# ── config ───────────────────────────────────────────────────────────────────

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LIGHTRAG_DIR = os.getenv("LIGHTRAG_DIR", "/data")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")

STUB_MODE = not OPENAI_API_KEY

# ── LightRAG bootstrap ───────────────────────────────────────────────────────

rag_instance = None

if not STUB_MODE:
    try:
        import asyncio

        from lightrag import LightRAG, QueryParam
        from lightrag.llm import openai_complete_if_cache, openai_embedding
        from lightrag.utils import EmbeddingFunc
        import numpy as np

        async def llm_model_func(prompt, system_prompt=None, history_messages=[], **kwargs):
            return await openai_complete_if_cache(
                LLM_MODEL,
                prompt,
                system_prompt=system_prompt,
                history_messages=history_messages,
                api_key=OPENAI_API_KEY,
                **kwargs,
            )

        async def embedding_func(texts: list[str]) -> np.ndarray:
            return await openai_embedding(
                texts,
                model=EMBED_MODEL,
                api_key=OPENAI_API_KEY,
            )

        os.makedirs(LIGHTRAG_DIR, exist_ok=True)

        rag_instance = LightRAG(
            working_dir=LIGHTRAG_DIR,
            llm_model_func=llm_model_func,
            embedding_func=EmbeddingFunc(
                embedding_dim=1536,
                max_token_size=8192,
                func=embedding_func,
            ),
        )
        log.info("LightRAG initialised (model=%s, embed=%s, dir=%s)", LLM_MODEL, EMBED_MODEL, LIGHTRAG_DIR)
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to initialise LightRAG (%s) — falling back to stub mode", exc)
        rag_instance = None
        STUB_MODE = True
else:
    log.warning("OPENAI_API_KEY not set — running in stub mode (empty graph results)")

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="LightRAG sidecar", version="1.0.0")


# ── request / response models ─────────────────────────────────────────────────


class QueryReq(BaseModel):
    query: str
    mode: str = "hybrid"
    top_k: int = 10


class IndexReq(BaseModel):
    id: str
    content: str


class CleanupReq(BaseModel):
    thought_ids: list[str]


# ── helpers ───────────────────────────────────────────────────────────────────


def _parse_rag_result(raw: str) -> dict[str, Any]:
    """
    LightRAG returns a plain-text answer in its high-level query API.
    For the brain we only need the entities/relations extracted during indexing
    so we surface them as empty lists in the v1 shim and let the brain rely on
    vector similarity for ranking while still populating the graph on writes.
    The thought_ids / fact_ids fields are intentionally absent — the brain
    treats their absence as an empty list.
    """
    return {"entities": [], "relations": [], "thought_ids": [], "fact_ids": []}


# ── endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict[str, str]:
    mode = "stub" if STUB_MODE else "live"
    return {"status": "ok", "mode": mode}


@app.post("/query")
async def query(req: QueryReq) -> dict[str, Any]:
    if STUB_MODE or rag_instance is None:
        log.debug("query (stub): %s", req.query[:80])
        return {"entities": [], "relations": [], "thought_ids": [], "fact_ids": []}

    try:
        from lightrag import QueryParam

        raw = await asyncio.wait_for(
            rag_instance.aquery(
                req.query,
                param=QueryParam(mode=req.mode, top_k=req.top_k),
            ),
            timeout=30,
        )
        return _parse_rag_result(raw)
    except Exception as exc:  # noqa: BLE001
        log.warning("query failed: %s", exc)
        return {"entities": [], "relations": [], "thought_ids": [], "fact_ids": []}


@app.post("/index")
async def index(req: IndexReq) -> dict[str, str]:
    if STUB_MODE or rag_instance is None:
        log.debug("index (stub): id=%s", req.id)
        return {"status": "ok"}

    # Prefix content with the thought id so LightRAG can surface it in entity extraction
    tagged = f"[id:{req.id}]\n{req.content}"
    try:
        await asyncio.wait_for(
            rag_instance.ainsert(tagged),
            timeout=60,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("index failed for id=%s: %s", req.id, exc)
    return {"status": "ok"}


@app.post("/cleanup-deleted")
async def cleanup_deleted(req: CleanupReq) -> dict[str, str]:
    """
    Best-effort removal of thought nodes from the graph.

    LightRAG does not expose a first-class delete API in v1.x so we log the
    request and return ok. A future version can walk the graph storage and
    prune nodes whose text starts with [id:<thought_id>].
    """
    if req.thought_ids:
        log.info("cleanup-deleted: %d ids (best-effort, not yet implemented)", len(req.thought_ids))
    return {"status": "ok"}
