from __future__ import annotations

import os
from typing import Literal, Type, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from src.result import Result

TModel = TypeVar("TModel", bound=BaseModel)


def _get_openai_api_key() -> Result[str, Exception]:
    """環境変数 OPENAI_API_KEY を取得する。未設定なら Err を返す。"""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return Result.err(
            RuntimeError(
                "OPENAI_API_KEY is not set. Please set it in your environment "
                "before running this application."
            )
        )
    return Result.ok(api_key)


class StructuredOutputOptions(BaseModel):
    model: Literal["gpt-5-nano-2025-08-07", "gpt-5-mini-2025-08-07"] = "gpt-5-nano-2025-08-07"
    use_web_search: bool = False
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = "minimal"


async def create_structured_outputs(
    prompt: str,
    schema: Type[TModel],
    options: StructuredOutputOptions | None = None,
) -> Result[TModel, Exception]:
    """
    OpenAI Responses API で Structured Outputs を取得する。
    schema は pydantic BaseModel を渡す。
    """
    opts = options or StructuredOutputOptions()
    api_key_result = _get_openai_api_key()
    if api_key_result.is_err():
        return Result.err(api_key_result.unwrap_err())

    client = AsyncOpenAI(api_key=api_key_result.unwrap())

    try:
        resp = await client.responses.parse(
            model=opts.model,
            input=prompt,
            text_format=schema,
            tools=[{"type": "web_search"}] if opts.use_web_search else [],
            reasoning={"effort": opts.reasoning_effort},
        )
        parsed = resp.output_parsed
        if parsed is None:
            return Result.err(RuntimeError("Failed to parse the response."))
        if isinstance(parsed, schema):
            return Result.ok(parsed)
        if isinstance(parsed, dict):
            return Result.ok(schema.model_validate(parsed))
        return Result.ok(schema.model_validate(parsed))  # type: ignore[arg-type]
    except Exception as exc:  # noqa: BLE001
        return Result.err(exc)
