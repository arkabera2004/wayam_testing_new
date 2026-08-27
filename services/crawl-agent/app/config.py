"""Environment-driven config for the crawl-agent service.

Kept as one small module (not scattered os.environ reads) so the
self-hosted vs. Cloud Agent API trade-off — and which env vars back it —
stays visible in one place.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load services/crawl-agent/.env if present, then fall back to the repo
# root .env so local dev can share one file.
_HERE = Path(__file__).resolve().parent.parent
load_dotenv(_HERE / ".env")
load_dotenv(_HERE.parent.parent / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    # "self_hosted": run the open-source browser-use library locally.
    # "cloud_api": NOT YET WIRED — reserved for browser-use's hosted
    # Cloud Agent API. See README.md#agent-backend-config.
    agent_backend: str
    google_api_key: str | None
    browser_use_cloud_api_key: str | None

    @property
    def is_cloud_backend(self) -> bool:
        return self.agent_backend == "cloud_api"


def load_settings() -> Settings:
    return Settings(
        agent_backend=os.environ.get("CRAWL_AGENT_BACKEND", "self_hosted"),
        google_api_key=os.environ.get("GOOGLE_API_KEY"),
        browser_use_cloud_api_key=os.environ.get("BROWSER_USE_CLOUD_API_KEY"),
    )


settings = load_settings()
