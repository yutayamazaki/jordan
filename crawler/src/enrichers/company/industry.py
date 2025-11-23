from __future__ import annotations

import re
import unicodedata
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, ConfigDict

from src.domains import Company
from src.result import Result

from ..base import FieldEnricher
from .common import WebsiteSnapshot, _normalize_website_url


class IndustryRule(BaseModel):
    """業種名とキーワード群の簡易ルール。"""

    model_config = ConfigDict(frozen=True)

    label: str
    keywords: tuple[str, ...]

    @property
    def code(self) -> str:
        """label と同じ値で扱う。"""
        return self.label


# まずは人手で決め打ちしたキーワードのみを使った軽量ルールベース。
RULES: tuple[IndustryRule, ...] = (
    IndustryRule(
        label="水産・農林業",
        keywords=(
            "木材",
            "林業",
            "農業",
            "漁業",
        ),
    ),
    IndustryRule(
        label="鉱業",
        keywords=(
            "採掘",
            "鉱山",
        ),
    ),
    IndustryRule(
        label="建設業",
        keywords=(
            "施工",
            "建設",
            "工務店",
            "ゼネコン",
            "建築",
            "土木工事",
            "リフォーム",
            "設備工事",
            "電気工事",
            "解体工事",
            "リノベーション",
            "内装工事",
            "外壁工事",
        ),
    ),
    IndustryRule(
        label="食料品",
        keywords=(
            "食品",
            "飲料",
            "加工",
            "外食",
            "飲食店",
            "レストラン",
            "カフェ",
        ),
    ),
    IndustryRule(
        label="繊維製品",
        keywords=(
            "繊維",
            "衣料",
            "アパレル",
        ),
    ),
    IndustryRule(
        label="パルプ・紙",
        keywords=("製紙", "紙"),
    ),
    IndustryRule(
        label="化学",
        keywords=(
            "材料",
            "ケミカル",
            "化学",
            "合成",
            "resin",
            "polymer",
        ),
    ),
    IndustryRule(
        label="医薬品",
        keywords=(
            "製薬",
            "医薬",
            "ワクチン",
        ),
    ),
    IndustryRule(
        label="石油・石炭製品",
        keywords=(
            "oil",
            "fuel",
            "refinery",
            "石油",
            "原油",
            "石炭",
            "coal",
        ),
    ),
    IndustryRule(
        label="ゴム製品",
        keywords=("rubber", "tire", "ゴム", "タイヤ"),
    ),
    IndustryRule(
        label="ガラス・土石製品",
        keywords=(
            "glass",
            "ceramic",
            "ceramics",
            "cement",
            "concrete",
            "陶器",
            "土石",
            "ガラス",
        ),
    ),
    IndustryRule(
        label="鉄鋼",
        keywords=("steel", "iron", "ferrous", "鉄鋼", "製鉄"),
    ),
    IndustryRule(
        label="非鉄金属",
        keywords=(
            "nonferrous",
            "aluminum",
            "copper",
            "nickel",
            "zinc",
            "非鉄",
            "アルミ",
            "銅",
        ),
    ),
    IndustryRule(
        label="金属製品",
        keywords=(
            "metal",
            "加工",
            "金属製品",
            "鋳造",
            "鍛造",
            "金物",
        ),
    ),
    IndustryRule(
        label="機械",
        keywords=(
            "machinery",
            "industrial machinery",
            "装置",
            "機械",
            "製造装置",
            "工作機械",
        ),
    ),
    IndustryRule(
        label="電気機器",
        keywords=(
            "electrical",
            "electronics",
            "electric device",
            "electronic equipment",
            "半導体装置",
            "電気機器",
            "電子機器",
        ),
    ),
    IndustryRule(
        label="輸送用機器",
        keywords=(
            "automotive",
            "auto",
            "vehicle",
            "car",
            "truck",
            "bus",
            "rail",
            "train",
            "航空機部品",
            "transport equipment",
            "輸送機器",
        ),
    ),
    IndustryRule(
        label="精密機器",
        keywords=(
            "precision",
            "optics",
            "sensor",
            "measurement",
            "計測",
            "精密",
            "医療機器",
            "device",
        ),
    ),
    IndustryRule(
        label="その他製品",
        keywords=(
            "製品",
            "雑貨",
            "日用品",
            "oem",
            "odm",
            "製造",
            "工場",
        ),
    ),
    IndustryRule(
        label="電気・ガス業",
        keywords=(
            "gas",
            "電力",
            "ガス",
            "ユーティリティ",
        ),
    ),
    IndustryRule(
        label="陸運業",
        keywords=(
            "陸運",
            "物流",
            "配送",
            "宅配",
            "ラストワンマイル",
        ),
    ),
    IndustryRule(
        label="海運業",
        keywords=(
            "marine",
            "shipping",
            "ship",
            "vessel",
            "maritime",
            "ocean",
            "海運",
            "船",
        ),
    ),
    IndustryRule(
        label="空運業",
        keywords=(
            "airline",
            "airlines",
            "aviation",
            "air cargo",
            "air freight",
            "air transport",
            "空運",
            "航空",
        ),
    ),
    IndustryRule(
        label="倉庫・運輸関連業",
        keywords=(
            "倉庫",
            "物流センター",
            "運輸",
            "在庫管理",
            "保管",
        ),
    ),
    IndustryRule(
        label="情報・通信業",
        keywords=(
            "software",
            "saas",
            "it",
            "cloud",
            "platform",
            "デジタル",
            "情報通信",
            "システム開発",
            "受託開発",
            "web制作",
            "ウェブ制作",
            "itソリューション",
            "基幹システム",
            "業務システム",
            "ai開発",
            "sier",
            "システムインテグレーター",
            "ses",
            "itコンサル",
            "dx",
            "デジタルトランスフォーメーション",
            "基幹業務",
            "自社開発",
        ),
    ),
    IndustryRule(
        label="卸売業",
        keywords=(
            "卸売",
            "卸",
            "商社",
            "専門商社",
            "総合商社",
            "トレーディングカンパニー",
            "輸入販売",
            "輸出入",
            "輸入代行",
        ),
    ),
    IndustryRule(
        label="小売業",
        keywords=(
            "ec",
            "mall",
            "supermarket",
            "小売",
            "販売",
            "通販",
            "ネットショップ",
            "オンラインショップ",
            "ドラッグストア",
        ),
    ),
    IndustryRule(
        label="銀行業",
        keywords=("bank", "banking", "金融機関", "銀行"),
    ),
    IndustryRule(
        label="証券・商品先物取引業",
        keywords=(
            "securities",
            "brokerage",
            "trading",
            "stock",
            "investment bank",
            "broker",
            "証券",
            "先物",
            "トレーディング",
        ),
    ),
    IndustryRule(
        label="保険業",
        keywords=("insurance", "insurer", "insurtech", "保険"),
    ),
    IndustryRule(
        label="その他金融業",
        keywords=(
            "fintech",
            "finance",
            "loan",
            "credit",
            "card",
            "payment",
            "lending",
            "capital",
            "リース",
            "ファイナンス",
        ),
    ),
    IndustryRule(
        label="不動産業",
        keywords=(
            "不動産",
            "賃貸",
            "開発",
            "不動産仲介",
            "不動産管理",
            "マンション管理",
            "賃貸管理",
            "分譲住宅",
            "デベロッパー",
            "賃貸住宅",
            "テナント",
        ),
    ),
    IndustryRule(
        label="サービス業",
        keywords=(
            "service",
            "consulting",
            "outsourcing",
            "bpo",
            "support",
            "コンサル",
            "サービス",
            "人材派遣",
            "人材紹介",
            "アウトソーシング",
            "コールセンター",
            "学習塾",
            "予備校",
            "ホテル",
            "旅館",
            "クリーニング",
            "介護",
            "訪問介護",
            "保育",
            "保育園",
            "幼稚園",
            "フィットネス",
            "ジム",
            "エステ",
            "美容",
            "ブライダル",
            "結婚式場",
            "清掃",
            "ハウスクリーニング",
        ),
    ),
)


class IndustryFieldEnricher(FieldEnricher[Company, str, WebsiteSnapshot]):
    """Webサイトのテキストから業種を分類し、industry に設定する。"""

    field_name = "industry"

    def __init__(
        self,
        client: httpx.AsyncClient,
        recompute_all: bool = False,
        min_confidence: float = 0.1,
    ) -> None:
        self.client = client
        self.recompute_all = recompute_all
        self.min_confidence = min_confidence

    async def compute(
        self, item: Company, context: WebsiteSnapshot | None = None
    ) -> Result[Optional[str], Exception]:
        if not self.recompute_all and item.industry and str(item.industry).strip():
            return Result.ok(None)

        website_text_result = await _fetch_website_text(
            item.website_url, self.client, snapshot=context
        )
        if website_text_result.is_err():
            return Result.err(website_text_result.unwrap_err())

        website_text = website_text_result.unwrap()
        if not website_text:
            return Result.ok(None)

        haystack = _normalize_text(website_text)
        if not haystack.strip():
            return Result.ok(None)

        best_rule: IndustryRule | None = None
        best_score = 0
        best_confidence = 0.0
        for rule in RULES:
            score, hits = _score_rule(rule, haystack)
            if score == 0:
                continue
            denominator = max(len(rule.keywords), 1)
            confidence = round(score / denominator, 3)

            # スコア優先、同点なら高信頼度優先
            if score > best_score or (score == best_score and confidence > best_confidence):
                best_rule = rule
                best_score = score
                best_confidence = confidence

        if not best_rule or best_confidence < self.min_confidence:
            return Result.ok(None)

        return Result.ok(best_rule.label)


async def _fetch_website_text(
    website_url: str | None,
    client: httpx.AsyncClient,
    snapshot: WebsiteSnapshot | None = None,
) -> Result[Optional[str], Exception]:
    """指定サイトの HTML を取得し、業種に効きやすい箇所を重み付けしたテキストを返す。"""
    if snapshot and snapshot.text is not None:
        return Result.ok(snapshot.text)

    normalized_result = _normalize_website_url(website_url or "")
    if normalized_result.is_err():
        return normalized_result  # type: ignore[return-value]

    normalized = normalized_result.unwrap()

    texts: list[str] = []

    async def _fetch_html(url: str) -> Optional[str]:
        try:
            resp = await client.get(url, follow_redirects=True)
        except httpx.HTTPError:
            return None
        if resp.status_code >= 400:
            return None
        if "text/html" not in resp.headers.get("content-type", "").lower():
            return None
        return resp.text

    def _consume_html(html: str) -> None:
        try:
            soup = BeautifulSoup(html, "html.parser")
        except Exception:
            texts.append(html)
            return

        weighted = _extract_weighted_text(soup)
        if weighted:
            texts.append(weighted)

        business = _extract_business_section_text(soup)
        if business:
            texts.extend([business] * 4)

        body = soup.get_text(" ", strip=True)
        if body:
            texts.append(body)

    # main page
    main_html = await _fetch_html(normalized)
    if main_html:
        _consume_html(main_html)

    # /company, /about, /business から最大2ページ拾う
    extra_paths = ("/company", "/about", "/business")
    fetched_extra = 0
    for path in extra_paths:
        if fetched_extra >= 2:
            break
        target = urljoin(normalized + "/", path.lstrip("/"))
        extra_html = await _fetch_html(target)
        if not extra_html:
            continue
        _consume_html(extra_html)
        fetched_extra += 1

    if not texts and main_html is not None:
        return Result.ok(main_html)
    if not texts:
        return Result.ok(None)

    return Result.ok(" ".join(texts))


def _normalize_text(value: str) -> str:
    # 全角→半角、互換文字を統一
    value = unicodedata.normalize("NFKC", value)
    lowered = value.lower()
    # 英数字と日本語だけ残してスペースに
    return re.sub(r"[^0-9a-zぁ-んァ-ン一-龠ー]+", " ", lowered)


def _score_rule(rule: IndustryRule, haystack: str) -> tuple[int, set[str]]:
    """テキスト中でルールのキーワードが何個ヒットするかを返す。"""
    hits: set[str] = set()
    for keyword in rule.keywords:
        if keyword in haystack:
            hits.add(keyword)
    return len(hits), hits


def _extract_weighted_text(soup: BeautifulSoup) -> str:
    """title / description / h1 を増幅しつつ本文も含めたテキストを返す。"""
    parts: list[str] = []

    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    if title:
        parts.extend([title] * 3)

    desc_tag = soup.find("meta", attrs={"name": "description"})
    desc = desc_tag.get("content") if desc_tag else None
    if desc:
        parts.extend([desc.strip()] * 2)

    h1_texts = [h.get_text(" ", strip=True) for h in soup.find_all("h1")]
    for h1 in h1_texts:
        if h1:
            parts.extend([h1] * 2)

    body = soup.get_text(" ", strip=True)
    if body:
        parts.append(body)

    return " ".join(parts)


def _extract_business_section_text(soup: BeautifulSoup) -> str:
    """事業内容/業種テーブルや見出し周辺から事業テキストを抽出する。"""
    texts: list[str] = []

    for th in soup.find_all("th"):
        label = th.get_text(strip=True)
        if any(key in label for key in ["事業内容", "業種", "事業", "主な事業"]):
            td = th.find_next("td")
            if td:
                texts.append(td.get_text(" ", strip=True))

    for heading_tag in soup.find_all(["h1", "h2", "h3", "h4"]):
        heading = heading_tag.get_text(strip=True)
        if any(key in heading.lower() for key in ["事業内容", "事業案内", "business", "services"]):
            section_parts: list[str] = []
            sib = heading_tag.next_sibling
            steps = 0
            while sib is not None and steps < 5:
                get_text = getattr(sib, "get_text", None)
                if callable(get_text):
                    section_parts.append(get_text(" ", strip=True))
                sib = sib.next_sibling
                steps += 1
            if section_parts:
                texts.append(" ".join(section_parts))

    return " ".join(texts)
