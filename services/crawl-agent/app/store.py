"""In-process job store.

INTEGRATION POINT: fine for a single-instance scaffold; swap for real
persistence (Mongo/Postgres-backed queue) before running more than one
worker process, since jobs live only in this dict.
"""

from __future__ import annotations

import uuid
from threading import Lock

from .graph import CrawlGraph, CrawlJob, CrawlStatus

_jobs: dict[str, CrawlJob] = {}
_lock = Lock()


def create_job(url: str) -> CrawlJob:
    job = CrawlJob(crawl_id=str(uuid.uuid4()), url=url, status=CrawlStatus.QUEUED)
    with _lock:
        _jobs[job.crawl_id] = job
    return job


def get_job(crawl_id: str) -> CrawlJob | None:
    with _lock:
        return _jobs.get(crawl_id)


def mark_running(crawl_id: str) -> None:
    with _lock:
        job = _jobs[crawl_id]
        _jobs[crawl_id] = job.model_copy(update={"status": CrawlStatus.RUNNING})


def mark_completed(crawl_id: str, graph: CrawlGraph) -> None:
    with _lock:
        job = _jobs[crawl_id]
        _jobs[crawl_id] = job.model_copy(
            update={"status": CrawlStatus.COMPLETED, "graph": graph}
        )


def mark_failed(crawl_id: str, error: str) -> None:
    with _lock:
        job = _jobs[crawl_id]
        _jobs[crawl_id] = job.model_copy(update={"status": CrawlStatus.FAILED, "error": error})
