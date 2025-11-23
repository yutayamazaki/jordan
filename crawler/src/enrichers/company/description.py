from __future__ import annotations

from typing import Optional

import httpx
from bs4 import BeautifulSoup

from src.domains import Company
from src.result import Result

from ..base import FieldEnricher
from .common import WebsiteSnapshot, fetch_website_snapshot


def _extract_meta_description(soup: BeautifulSoup) -> Optional[str]:
    """meta description 系のタグを探して content を返す。"""
    description_keys = {"description", "og:description", "twitter:description"}
    for tag in soup.find_all("meta"):
        name = (tag.get("name") or tag.get("property") or "").lower()
        if name not in description_keys:
            continue
        content = tag.get("content")
        if content and content.strip():
            return content.strip()
    return None


class DescriptionFieldEnricher(FieldEnricher[Company, str, WebsiteSnapshot]):
    """meta description を取得し、description に設定する。"""

    field_name = "description"

    def __init__(self, client: httpx.AsyncClient, recompute_all: bool = False) -> None:
        self.client = client
        self.recompute_all = recompute_all

    async def compute(
        self, item: Company, context: WebsiteSnapshot | None = None
    ) -> Result[Optional[str], Exception]:
        if not self.recompute_all and item.description and str(item.description).strip():
            return Result.ok(None)

        if not item.website_url:
            return Result.ok(None)

        snapshot = context
        if snapshot is None:
            snapshot_result = await fetch_website_snapshot(item.website_url, self.client)
            if snapshot_result.is_err():
                return Result.err(snapshot_result.unwrap_err())
            snapshot = snapshot_result.unwrap()

        soup = snapshot.soup
        if soup is None and snapshot.html:
            try:
                soup = BeautifulSoup(snapshot.html, "html.parser")
            except Exception:
                soup = None

        if soup is None:
            return Result.ok(None)

        return Result.ok(_extract_meta_description(soup))
