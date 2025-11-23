from __future__ import annotations

from typing import Optional
from urllib.parse import urlsplit

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, ConfigDict

from src.result import Result


class WebsiteSnapshot(BaseModel):
    """Fetched website response bundled for reuse across enrichers."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    normalized_url: str
    final_url: str
    html: str | None
    text: str | None
    soup: BeautifulSoup | None


def _normalize_website_url(raw_url: str) -> Result[str, Exception]:
    """website_url にプロトコルを補い、origin 部分のみの正規化 URL を返す。"""
    trimmed = (raw_url or "").strip()
    if not trimmed:
        return Result.err(ValueError("website_url is empty"))

    if not trimmed.startswith(("http://", "https://")):
        trimmed = f"https://{trimmed}"

    parsed = urlsplit(trimmed)
    hostname = parsed.hostname or parsed.netloc
    # ドメインっぽい文字列かを簡易チェック（最低1つのドットを含む）
    if not parsed.netloc or not hostname or "." not in hostname:
        return Result.err(ValueError(f"Invalid website_url: {raw_url!r}"))

    normalized = f"{parsed.scheme}://{parsed.netloc}"
    return Result.ok(normalized)


async def fetch_website_snapshot(
    website_url: str,
    client: httpx.AsyncClient,
) -> Result[WebsiteSnapshot, Exception]:
    """website_url を1回だけ取得し、HTML/Soup等をまとめて返す。"""
    normalized_result = _normalize_website_url(website_url)
    if normalized_result.is_err():
        return normalized_result  # type: ignore[return-value]

    normalized = normalized_result.unwrap()

    try:
        resp = await client.get(normalized, follow_redirects=True)
    except httpx.HTTPError as exc:
        return Result.err(exc)

    content_type = resp.headers.get("content-type", "").lower()
    html: Optional[str] = resp.text if "text/html" in content_type else None
    soup: BeautifulSoup | None = None
    text: Optional[str] = resp.text

    if html:
        try:
            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text(" ", strip=True)
        except Exception:
            soup = None

    snapshot = WebsiteSnapshot(
        normalized_url=normalized,
        final_url=str(resp.url),
        html=html,
        text=text,
        soup=soup,
    )
    return Result.ok(snapshot)
