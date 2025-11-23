from __future__ import annotations

from typing import Optional
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from src.domains import Company
from src.result import Result

from ..base import FieldEnricher
from .common import WebsiteSnapshot, _normalize_website_url


def _build_favicon_candidates(website_url: str) -> list[str]:
    """与えられた website の origin を元に、よくある favicon パスの候補を列挙する。"""
    parsed = urlsplit(website_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    paths = [
        "/favicon.ico",
        "/favicon.png",
        "/favicon.svg",
        "/apple-touch-icon.png",
        "/apple-touch-icon-precomposed.png",
    ]
    return list(dict.fromkeys(urljoin(origin, path) for path in paths))


async def _is_reachable(
    url: str,
    client: httpx.AsyncClient,
) -> bool:
    """HEAD→GET の順で疎通を確認し、2xx/3xx を reachable とみなす。"""
    if not url.lower().startswith(("http://", "https://")):
        return False

    async def _request(method: str) -> bool:
        try:
            resp = await client.request(method, url, follow_redirects=False)
            return 200 <= resp.status_code < 400
        except httpx.HTTPError:
            return False

    return await _request("HEAD") or await _request("GET")


def _extract_icon_from_soup(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """HTML の <link rel=icon> から favicon URL を解決する。"""
    icon_links = soup.find_all("link", rel=True)
    for link in icon_links:
        rels = [r.lower() for r in link.get("rel", [])]
        if any("icon" in r for r in rels):
            href = link.get("href")
            if href:
                resolved = urljoin(base_url, href)
                if resolved.lower().startswith(("http://", "https://")):
                    return resolved
    return None


async def _fetch_favicon_from_html(
    website_url: str,
    client: httpx.AsyncClient,
    snapshot: WebsiteSnapshot | None = None,
) -> Result[Optional[str], Exception]:
    """
    HTML を取得して <link rel=\"icon\"> 等を解決する。
    失敗時は None を返しフォールバックに任せる。
    """
    if snapshot and snapshot.soup:
        icon = _extract_icon_from_soup(snapshot.soup, snapshot.final_url or website_url)
        return Result.ok(icon)

    try:
        resp = await client.get(website_url, follow_redirects=True)
    except httpx.HTTPError:
        return Result.ok(None)

    content_type = resp.headers.get("content-type", "").lower()
    if "text/html" not in content_type:
        return Result.ok(None)

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:
        return Result.err(exc)

    return Result.ok(_extract_icon_from_soup(soup, str(resp.url)))


async def _choose_favicon_url(
    website_url: str,
    client: httpx.AsyncClient,
    snapshot: WebsiteSnapshot | None = None,
) -> Result[Optional[str], Exception]:
    """website_url から favicon URL を推定し、HTML 解析→既知パスの順で探索する。"""
    normalized_result = _normalize_website_url(website_url)
    if normalized_result.is_err():
        return normalized_result

    normalized = normalized_result.unwrap()

    # 1) HTML から <link rel=icon> 等を解析
    html_icon_result = await _fetch_favicon_from_html(normalized, client, snapshot=snapshot)
    if html_icon_result.is_err():
        return html_icon_result

    html_icon = html_icon_result.unwrap()
    if html_icon and await _is_reachable(html_icon, client):
        return Result.ok(html_icon)

    # 2) 代表的なパスを総当たり
    candidates = _build_favicon_candidates(normalized)
    for candidate in candidates:
        if await _is_reachable(candidate, client):
            return Result.ok(candidate)

    return Result.ok(None)


class LogoFieldEnricher(FieldEnricher[Company, str, WebsiteSnapshot]):
    """favicon を取得して logo_url に設定する。"""

    field_name = "logo_url"

    def __init__(self, client: httpx.AsyncClient, recompute_all: bool = False) -> None:
        self.client = client
        self.recompute_all = recompute_all

    async def compute(
        self, item: Company, context: WebsiteSnapshot | None = None
    ) -> Result[Optional[str], Exception]:
        if not self.recompute_all and item.logo_url:
            return Result.ok(None)

        if not item.website_url:
            return Result.ok(None)

        return await _choose_favicon_url(item.website_url, self.client, snapshot=context)
