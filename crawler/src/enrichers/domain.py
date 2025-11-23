from __future__ import annotations

import re
from collections import Counter
from typing import Callable, Dict, Iterable, Optional

from pydantic import BaseModel

from src.domains import Domain
from src.result import Result

from .base import Enricher

# アプリで扱うメールパターンの候補一覧。
PATTERN_BUILDERS: Dict[str, Callable[[str, str], str]] = {
    "last": lambda first, last: last,
    "first.last": lambda first, last: f"{first}.{last}",
    "last.first": lambda first, last: f"{last}.{first}",
    "first-last": lambda first, last: f"{first}-{last}",
    "last-first": lambda first, last: f"{last}-{first}",
    "first_last": lambda first, last: f"{first}_{last}",
    "last_first": lambda first, last: f"{last}_{first}",
    "firstlast": lambda first, last: f"{first}{last}",
    "lastfirst": lambda first, last: f"{last}{first}",
    "f.last": lambda first, last: f"{first[0]}.{last}",
    "f-last": lambda first, last: f"{first[0]}-{last}",
    "f_last": lambda first, last: f"{first[0]}_{last}",
    "flast": lambda first, last: f"{first[0]}{last}",
}


class EmailEntry(BaseModel):
    """メールアドレスと紐づくコンタクト情報の行を表す。"""

    local: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: Optional[str] = None


def _normalize_token(token: str) -> str:
    """小文字化し英数字以外を除去して比較しやすい形に整える。"""
    return re.sub(r"[^a-z0-9]", "", token.lower())


def infer_pattern(local: str, first_name: Optional[str], last_name: Optional[str]) -> Optional[str]:
    """local-part と氏名からメールパターンを推定する。"""
    if not first_name or not last_name:
        return None

    first = _normalize_token(first_name)
    last = _normalize_token(last_name)
    if not first or not last:
        return None

    normalized_local = local.lower()
    for pattern, builder in PATTERN_BUILDERS.items():
        candidate = builder(first, last)
        if candidate == normalized_local:
            return pattern

    return None


class DomainEnricher(Enricher[Domain]):
    """既存メールから多数決で Domain.pattern を推定する。"""

    def __init__(self, emails_by_domain: Dict[str, Iterable[EmailEntry]]) -> None:
        self.emails_by_domain = emails_by_domain

    def enrich(self, domain: Domain) -> Result[Domain, Exception]:
        try:
            pattern = self._decide_pattern(domain.domain)
        except Exception as exc:  # pragma: no cover - defensive
            return Result.err(exc)

        if pattern:
            domain.pattern = pattern
        return Result.ok(domain)

    def _decide_pattern(self, domain_value: str) -> Optional[str]:
        emails = self.emails_by_domain.get(domain_value.lower())
        if not emails:
            return None

        counts: Counter[str] = Counter()
        for email in emails:
            if email.status and email.status.lower() == "verified_ng":
                continue

            pattern = infer_pattern(email.local, email.first_name, email.last_name)
            if pattern:
                counts[pattern] += 1

        if not counts:
            return None

        most_common = counts.most_common()
        top_count = most_common[0][1]
        top_patterns = [pattern for pattern, count in most_common if count == top_count]

        if len(top_patterns) != 1:
            return None

        return top_patterns[0]
