import pytest

from src.enrichers.contact import (
    _normalize,  # type: ignore[attr-defined]
    classify_department_category,
    classify_position_category,
)


@pytest.mark.parametrize(
    "department, expected",
    [
        ("経営企画部", "経営"),
        ("CEO Office", "経営"),
        ("社長室", "経営"),
        ("常務取締役（システム部管掌）", "経営"),
        ("人事部", "人事・労務"),
        ("労務管理部", "人事・労務"),
        ("採用部", "人事・労務"),
        ("経理部", "経理・財務"),
        ("財務本部", "経理・財務"),
        ("ファイナンス部", "経理・財務"),
        ("法務部", "法務"),
        ("コンプライアンス部", "法務"),
        ("Legal Division", "法務"),
        ("購買部", "購買"),
        ("調達部", "購買"),
        ("資材部", "購買"),
        ("営業部", "営業"),
        ("インサイドセールス", "営業"),
        ("法人営業部", "営業"),
        ("営業本部", "営業"),
        ("営業統括部", "営業"),
        ("営業管理部", "営業"),
        ("国内営業部", "営業"),
        ("海外営業部", "営業"),
        ("営業技術部", "営業"),
        ("マーケティング部", "マーケティング"),
        ("プロモーション部", "マーケティング"),
        ("広報部", "マーケティング"),
        ("情報システム部", "情報システム"),
        ("情シス", "情報システム"),
        ("DX推進部", "情報システム"),
        ("システム部", "情報システム"),
        ("情報管理課", "情報システム"),
        ("IT統括部", "情報システム"),
        ("企画管理部 ITグループ長", "情報システム"),
    ],
)
def test_classify_department_category_matches_expected(department: str, expected: str) -> None:
    assert classify_department_category(department) == expected


@pytest.mark.parametrize("department", ["", "   ", "カスタマーサクセス部"])
def test_classify_department_category_falls_back_to_other(department: str) -> None:
    assert classify_department_category(department) == "その他"


def test_normalize_trims_and_unifies_symbols() -> None:
    # 全角・半角や末尾の「部」除去などを確認
    raw = " 情報システム／IT部 "
    assert _normalize(raw) == "情報システム/it"

    # 括弧内のノイズを除去できること
    assert _normalize("（記載）情報システム部") == "情報システム"


@pytest.mark.parametrize(
    "position, expected",
    [
        ("代表取締役", "経営"),
        ("CEO", "経営"),
        ("執行役員", "経営"),
        ("部長", "部長"),
        ("本部長", "部長"),
        ("Director", "部長"),
        ("室長", "部長"),
        ("センター長", "部長"),
        ("Head of Product Development", "部長"),
        ("課長", "次長・課長"),
        ("マネージャー", "次長・課長"),
        ("Manager", "次長・課長"),
        ("課長代理", "次長・課長"),
        ("リーダー補佐", "次長・課長"),
        ("次長", "次長・課長"),
        ("本部次長", "次長・課長"),
        ("主任", "主任"),
        ("チーフ", "主任"),
        ("係長", "主任"),
        ("副主任", "主任"),
        ("スタッフ", "担当者"),
        ("担当", "担当者"),
        ("メンバー", "担当者"),
    ],
)
def test_classify_position_category_matches_expected(position: str, expected: str) -> None:
    assert classify_position_category(position) == expected


@pytest.mark.parametrize("position", ["", "   ", "謎の肩書き"])
def test_classify_position_category_falls_back_to_other(position: str) -> None:
    assert classify_position_category(position) == "その他"
