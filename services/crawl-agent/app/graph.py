"""The page/action graph contract.

This is the shape the frontend's test-planning stage expects (see the main
app's INTEGRATION POINT comments in src/lib/projects/functions.ts). Keeping
it here as the single source of truth means the crawl service and the
frontend agree on the contract without either importing the other.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class ActionKind(str, Enum):
    CLICK = "click"
    FILL = "fill"
    SUBMIT = "submit"
    NAVIGATE = "navigate"


class ActionNode(BaseModel):
    """One primary action a user can take on a page."""

    label: str = Field(description="Short human-readable name, e.g. 'Add todo item'")
    kind: ActionKind
    target_description: str = Field(
        description="Plain-English description of the element (no CSS selector — "
        "that's Playwright codegen's job downstream, once a scenario is accepted)."
    )


class PageNode(BaseModel):
    """One reachable page/screen discovered during the crawl."""

    url: str
    title: str
    summary: str = Field(description="One or two sentences on what this page is for.")
    actions: list[ActionNode] = Field(default_factory=list)
    links_to: list[str] = Field(
        default_factory=list, description="URLs this page navigates to."
    )


class CrawlGraph(BaseModel):
    root_url: str
    pages: list[PageNode]
    discovered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CrawlStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CrawlJob(BaseModel):
    crawl_id: str
    url: str
    status: CrawlStatus
    graph: CrawlGraph | None = None
    error: str | None = None
