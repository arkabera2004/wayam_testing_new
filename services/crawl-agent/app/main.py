"""HTTP API: submit URL -> poll status -> receive page/action graph.

See README.md for the full contract. This file only wires HTTP to the
job store + agent; the actual crawl logic lives in agent.py.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

from . import store
from .agent import run_crawl
from .graph import CrawlJob
from .heal import HealResult, heal_locator

logger = logging.getLogger("crawl_agent")

app = FastAPI(title="Parikshan crawl-agent", version="0.1.0")


class CreateCrawlRequest(BaseModel):
    url: HttpUrl


@app.post("/crawls", status_code=202)
async def create_crawl(payload: CreateCrawlRequest) -> CrawlJob:
    job = store.create_job(str(payload.url))
    asyncio.create_task(_run_job(job.crawl_id, str(payload.url)))
    return job


@app.get("/crawls/{crawl_id}")
async def get_crawl(crawl_id: str) -> CrawlJob:
    job = store.get_job(crawl_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown crawl_id")
    return job


class HealRequest(BaseModel):
    url: HttpUrl
    target_description: str
    previous_selector: str | None = None


@app.post("/heal")
async def heal(payload: HealRequest) -> HealResult:
    """Synchronous by design (unlike /crawls): a single-element lookup is
    a fast, bounded operation, so there's no need for the queued/poll
    dance a full crawl needs. Callers should still apply their own
    timeout — see the main app's healLocatorFn."""
    try:
        return await heal_locator(
            str(payload.url), payload.target_description, payload.previous_selector
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure as a 502
        logger.exception("Heal request failed for %s", payload.url)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


async def _run_job(crawl_id: str, url: str) -> None:
    store.mark_running(crawl_id)
    try:
        graph = await run_crawl(url)
        store.mark_completed(crawl_id, graph)
    except Exception as exc:  # noqa: BLE001 - report any failure via job status
        logger.exception("Crawl %s failed", crawl_id)
        store.mark_failed(crawl_id, str(exc))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
