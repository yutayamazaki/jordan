from __future__ import annotations

import re
from typing import Optional

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
            "fishing",
            "fishery",
            "seafood",
            "aquaculture",
            "farm",
            "farming",
            "agriculture",
            "agri",
            "forestry",
            "木材",
            "林業",
            "農業",
            "漁業",
        ),
    ),
    IndustryRule(
        label="鉱業",
        keywords=(
            "mining",
            "mine",
            "minerals",
            "ore",
            "coal",
            "lithium",
            "gold",
            "copper",
            "採掘",
            "鉱山",
        ),
    ),
    IndustryRule(
        label="建設業",
        keywords=(
            "construction",
            "building",
            "contractor",
            "civil",
            "architecture",
            "architect",
            "施工",
            "建設",
            "工務店",
            "ゼネコン",
        ),
    ),
    IndustryRule(
        label="食料品",
        keywords=(
            "food",
            "beverage",
            "drink",
            "食品",
            "飲料",
            "加工",
            "snack",
            "grocery",
            "meat",
            "dairy",
            "bread",
        ),
    ),
    IndustryRule(
        label="繊維製品",
        keywords=(
            "textile",
            "apparel",
            "clothing",
            "garment",
            "fabric",
            "fiber",
            "繊維",
            "衣料",
            "アパレル",
        ),
    ),
    IndustryRule(
        label="パルプ・紙",
        keywords=("pulp", "paper", "printing", "papermill", "製紙", "紙"),
    ),
    IndustryRule(
        label="化学",
        keywords=(
            "chemical",
            "chem",
            "chemistry",
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
            "pharma",
            "pharmaceutical",
            "drug",
            "medicine",
            "medication",
            "製薬",
            "医薬",
            "ワクチン",
        ),
    ),
    IndustryRule(
        label="石油・石炭製品",
        keywords=(
            "petroleum",
            "oil",
            "gasoline",
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
            "metalwork",
            "fabrication",
            "加工",
            "金属製品",
            "鋳造",
            "鍛造",
            "金物",
        ),
    ),
    IndustryRule(
        label="機械",
        keywords=("machinery", "machine", "equipment", "industrial machinery", "装置", "機械"),
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
        keywords=("consumer goods", "goods", "product", "製品", "雑貨", "日用品"),
    ),
    IndustryRule(
        label="電気・ガス業",
        keywords=(
            "electricity",
            "power",
            "utility",
            "gas",
            "energy supply",
            "電力",
            "ガス",
            "ユーティリティ",
        ),
    ),
    IndustryRule(
        label="陸運業",
        keywords=(
            "logistics",
            "delivery",
            "trucking",
            "freight",
            "transportation",
            "shipping",
            "陸運",
            "物流",
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
            "warehouse",
            "warehousing",
            "storage",
            "3pl",
            "fulfillment",
            "倉庫",
            "物流センター",
            "運輸",
        ),
    ),
    IndustryRule(
        label="情報・通信業",
        keywords=(
            "software",
            "saas",
            "internet",
            "telecom",
            "communication",
            "it",
            "cloud",
            "platform",
            "デジタル",
            "情報通信",
        ),
    ),
    IndustryRule(
        label="卸売業",
        keywords=("wholesale", "distributor", "distribution", "b2b sales", "卸売", "卸"),
    ),
    IndustryRule(
        label="小売業",
        keywords=(
            "retail",
            "store",
            "shop",
            "ecommerce",
            "ec",
            "mall",
            "supermarket",
            "小売",
            "販売",
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
            "real estate",
            "property",
            "housing",
            "apartment",
            "mortgage",
            "不動産",
            "賃貸",
            "開発",
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
    """指定サイトの HTML を取得し、テキストのみを抽出する。"""
    if snapshot and snapshot.text is not None:
        return Result.ok(snapshot.text)

    normalized_result = _normalize_website_url(website_url or "")
    if normalized_result.is_err():
        return normalized_result  # type: ignore[return-value]

    normalized = normalized_result.unwrap()

    try:
        resp = await client.get(normalized, follow_redirects=True)
    except httpx.HTTPError as exc:
        return Result.err(exc)

    content_type = resp.headers.get("content-type", "").lower()
    if "text/html" not in content_type:
        return Result.ok(resp.text)

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
        return Result.ok(soup.get_text(" ", strip=True))
    except Exception:
        # HTML パース失敗時はテキストそのまま返す
        return Result.ok(resp.text)


def _normalize_text(value: str) -> str:
    """英数字と日本語を残して小文字化する。"""
    lowered = value.lower()
    return re.sub(r"[^0-9a-zぁ-んァ-ン一-龠ー]+", " ", lowered)


def _score_rule(rule: IndustryRule, haystack: str) -> tuple[int, set[str]]:
    """テキスト中でルールのキーワードが何個ヒットするかを返す。"""
    hits: set[str] = set()
    for keyword in rule.keywords:
        if keyword in haystack:
            hits.add(keyword)
    return len(hits), hits
