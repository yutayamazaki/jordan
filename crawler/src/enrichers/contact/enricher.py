from __future__ import annotations

import re
import unicodedata

from src.domains import Contact
from src.result import Result

from ..base import Enricher

DEPARTMENT_CATEGORY_CHOICES = [
    "経営",
    "人事・労務",
    "経理・財務",
    "法務",
    "購買",
    "営業",
    "マーケティング",
    "情報システム",
    "その他",
]

POSITION_CATEGORY_CHOICES = [
    "経営",
    "部長",
    "次長・課長",
    "主任",
    "担当者",
    "その他",
]


def _normalize(department: str) -> str:
    """ 部署名を正規化する """
    if not department:
        return ""
    # 全角→半角, 濁点結合などを正規化
    text = unicodedata.normalize("NFKC", department)
    # 括弧内の補足（「記載」「掲載」など）を除去
    text = re.sub(r"[（(].*?[)）]", "", text)
    # 空白類除去
    text = re.sub(r"\s+", "", text)
    # よくある区切り記号を統一（任意）
    text = text.replace("／", "/").replace("・", "")
    # 部署名の末尾に付くことが多い語句を削除
    text = re.sub(r"(部門?|課|室|本部|センター|グループ|局|庁|支店|支社|営業所)$", "", text)
    return text.lower()


def classify_department_category(department: str) -> str:
    normalized = _normalize(department or "")
    if not normalized:
        return "その他"

    if re.search(
        r"経営|経営企画|事業企画|企画室|社長|代表|取締役|president|ceo|coo|cxo",
        normalized,
    ):
        return "経営"

    if re.search(
        r"人事|労務|hr|タレントマネジメント|組織開発|人材開発|採用|リクルート",
        normalized,
    ):
        return "人事・労務"

    if re.search(
        r"財務|経理|ファイナンス|finance|管理会計|経営管理|会計|経営企画財務",
        normalized,
    ):
        return "経理・財務"

    if re.search(r"法務|legal|リーガル|コンプライアンス|規制|契約", normalized):
        return "法務"

    if re.search(r"購買|調達|資材|仕入|バイヤ|procurement|purchase", normalized):
        return "購買"

    if re.search(
        r"営業|営業本部|営業統括|営業管理|国内営業|海外営業|営業技術|セールス|sales|"
        r"アカウントマネージャ|アカウントマネジャ|インサイドセールス|フィールドセールス|"
        r"法人営業|ソリューション営業",
        normalized,
    ):
        return "営業"

    if re.search(
        r"マーケティング|マーケ|marketing|プロモーション|宣伝|広報|ブランド|brand",
        normalized,
    ):
        return "マーケティング"

    if re.search(
        r"情報システム|情シス|社内it|it基盤|インフラ|it企画|it推進|dx推進|デジタル推進|it戦略|"
        r"デジタル戦略|テクノロジー本部|テクノロジー部|cio|cto|システム|it統括|itソリューション|"
        r"情報管理|情報企画|情報統括|情報部|(?<![a-z])it(?![a-z])|ict",
        normalized,
    ):
        return "情報システム"

    return "その他"


def classify_position_category(position: str) -> str:
    normalized = _normalize(position or "")
    if not normalized:
        return "その他"

    # 経営層
    if re.search(
        r"代表取締役|取締役|社長|会長|president|経営|executive|役員|顧問|相談役|監査役|専務|常務|"
        r"(?<![a-z])c(?:eo|oo|fo|to|mo|xo)(?![a-z])",
        normalized,
    ):
        return "経営"

    # 部長クラス
    if re.search(
        r"部長|本部長|部門長|局長|室長|所長|センター長|支社長|支店長|工場長|ヘッド|head|"
        r"gm|generalmanager|ディレクター|director|マネージングディレクター|md|"
        r"vicepresident|vp|svp|evp",
        normalized,
    ):
        return "部長"

    # 次長・課長/マネージャクラス
    if re.search(
        r"次長|課長|マネージャ|mgr|manager|スーパーバイザ|supervisor|リーダー|lead|グループ長|チーム長|"
        r"課長代理|assistantmanager|assoc(?:iate)?manager|リーダ|リーダー補佐|サブマネージャ|副長",
        normalized,
    ):
        return "次長・課長"

    # 主任/係長/チーフ
    if re.search(r"主任|係長|チーフ|chief|sublead|副主任|サブリーダ|submanager|副主幹", normalized):
        return "主任"

    # 一般メンバー/担当
    if re.search(r"担当|メンバー|スタッフ|staff|アソシエイト|associate", normalized):
        return "担当者"

    return "その他"


class ContactEnricher(Enricher[Contact]):
    """部署名から department_category を推定する。"""

    def enrich(self, item: Contact) -> Result[Contact, Exception]:
        dept_category = classify_department_category(item.department or "")
        pos_category = classify_position_category(item.position or "")

        item.department_category = dept_category
        item.position_category = pos_category
        return Result.ok(item)
