"""Runs the actual crawl: browser-use autonomously explores `url` with the
goal of mapping every reachable page, form, and primary action, and returns
its findings shaped as a CrawlGraph.

Swap point for the Cloud Agent API: everything here assumes
settings.agent_backend == "self_hosted" (runs browser-use's Agent locally
via Playwright). If agent_backend == "cloud_api", this should instead call
browser-use's hosted Cloud Agent API REST endpoint with the same task
prompt and poll it for a result — not yet implemented (raises below).
"""

from __future__ import annotations

from browser_use import Agent
from browser_use.llm.google.chat import ChatGoogle

from .config import settings
from .graph import CrawlGraph

CRAWL_TASK_TEMPLATE = """\
Explore the web application starting at {url}.

Goal: map every reachable page, form, and primary action a user can take,
starting from the homepage and following links/navigation you find. Do not
submit forms with real data or perform destructive actions (delete,
purchase, etc.) — only observe what actions each page offers.

For each distinct page you visit, record:
- its URL and a short title
- a one- or two-sentence summary of what the page is for
- the primary actions available on it (buttons, links, forms) as
  plain-English descriptions — not CSS selectors
- the URLs it links to

Stop once you've covered the primary flows reachable within a few clicks
of the homepage (you don't need to exhaustively crawl every page on a large
site). Return your findings as the structured output schema provided.
"""


def _build_llm() -> ChatGoogle:
    if not settings.google_api_key:
        raise RuntimeError(
            "Missing GOOGLE_API_KEY. Set it in services/crawl-agent/.env "
            "(or the repo root .env, which this service also reads)."
        )
    return ChatGoogle(model="gemini-2.5-flash", api_key=settings.google_api_key)


async def run_crawl(url: str) -> CrawlGraph:
    if settings.is_cloud_backend:
        raise NotImplementedError(
            "CRAWL_AGENT_BACKEND=cloud_api is not yet wired — see README.md. "
            "Use self_hosted (the default) for now."
        )

    agent = Agent(
        task=CRAWL_TASK_TEMPLATE.format(url=url),
        llm=_build_llm(),
        output_model_schema=CrawlGraph,
    )
    history = await agent.run()

    graph = history.structured_output
    if graph is None:
        raise RuntimeError("Agent finished without producing a structured CrawlGraph result.")
    if not graph.root_url:
        graph = graph.model_copy(update={"root_url": url})
    return graph
