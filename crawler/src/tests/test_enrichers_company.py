import pytest

from src.enrichers.company.logo import _build_favicon_candidates, _normalize_website_url


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("example.com", "https://example.com"),
        ("http://example.com", "http://example.com"),
        (" https://example.com/path ", "https://example.com"),
    ],
)
def test_normalize_website_url_success(raw: str, expected: str) -> None:
    result = _normalize_website_url(raw)
    assert result.is_ok()
    assert result.unwrap() == expected


@pytest.mark.parametrize("raw", ["", "   ", "not-a-url"])
def test_normalize_website_url_error(raw: str) -> None:
    result = _normalize_website_url(raw)
    assert result.is_err()


def test_build_favicon_candidates_unique_and_ordered() -> None:
    url = "https://example.com"
    candidates = _build_favicon_candidates(url)

    expected = [
        "https://example.com/favicon.ico",
        "https://example.com/favicon.png",
        "https://example.com/favicon.svg",
        "https://example.com/apple-touch-icon.png",
        "https://example.com/apple-touch-icon-precomposed.png",
    ]

    assert candidates == expected
    # 確実に重複がないことも確認
    assert len(candidates) == len(set(candidates))
