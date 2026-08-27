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
