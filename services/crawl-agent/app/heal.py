"""Self-healing fallback: re-locates a single UI element whose selector
broke, instead of re-crawling the whole app.

This is deliberately a *different, smaller* operation than run_crawl in
agent.py — a scheduled/PR run hits this when one Playwright step fails
with a "locator resolved to 0 elements" style error, not when discovering
an app for the first time. Keeping it single-step (no multi-page
exploration, no vision) makes it cheap and fast enough to sit in the
critical path of a test run's retry loop.

Same agent-backend split as agent.py applies here: this assumes
self_hosted (browser-use's Agent run locally). A Cloud Agent API version
would replace _build_llm/Agent below with a call to that hosted REST
endpoint instead — not implemented, same as run_crawl's cloud_api branch.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from browser_use import Agent
from browser_use.llm.google.chat import ChatGoogle

from .config import settings

HEAL_TASK_TEMPLATE = """\
Go to {url}.

A test step that used to work is now failing because this description no
longer matches anything on the page: "{target_description}".
{previous_selector_note}

Find the single element on the page that best matches what this step is
trying to interact with. Do not click it or fill it in — only locate it
and report back a specific, stable CSS selector for it (prefer a
data-testid/id/name/aria-label attribute selector over a fragile
class-based one if the element has one).

Return your answer as the structured output schema provided. If you
cannot find a plausible match at all, set confidence to "low" and explain
why in notes.
"""


class HealResult(BaseModel):
    selector: str = Field(description="A CSS selector for the re-located element.")
    confidence: str = Field(description='One of "high", "medium", "low".')
    notes: str = Field(description="Brief explanation of what was found and why.")


def _build_llm() -> ChatGoogle:
    if not settings.google_api_key:
        raise RuntimeError(
            "Missing GOOGLE_API_KEY. Set it in services/crawl-agent/.env "
            "(or the repo root .env, which this service also reads)."
        )
    return ChatGoogle(model="gemini-flash-latest", api_key=settings.google_api_key)


async def heal_locator(
    url: str, target_description: str, previous_selector: str | None
) -> HealResult:
    if settings.is_cloud_backend:
        raise NotImplementedError(
            "CRAWL_AGENT_BACKEND=cloud_api is not yet wired for /heal — see README.md. "
            "Use self_hosted (the default) for now."
        )

    previous_selector_note = (
        f'The selector that stopped working was: "{previous_selector}".'
        if previous_selector
        else "No previous selector is on record for this step."
    )

    agent = Agent(
        task=HEAL_TASK_TEMPLATE.format(
            url=url,
            target_description=target_description,
            previous_selector_note=previous_selector_note,
        ),
        llm=_build_llm(),
        output_model_schema=HealResult,
        use_vision=False,
        llm_timeout=120,
    )
    # This is a single lookup, not an exploration — cap the step budget
    # so a confused agent fails fast instead of wandering the site
    # burning LLM calls looking for something that may no longer exist.
    history = await agent.run(max_steps=8)

    result = history.structured_output
    if result is None:
        raise RuntimeError("Agent finished without proposing a replacement selector.")
    return result
