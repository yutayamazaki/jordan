from __future__ import annotations

import httpx

from src.domains import Company
from src.result import Result

from ..base import Enricher, FieldEnricher
from .industry import IndustryFieldEnricher
from .logo import LogoFieldEnricher


class CompanyEnricher(Enricher[Company]):
    """
    Company の website に基づいて各フィールドを更新する。
    FieldEnricher 単位で責務を分け、ここでは orchestration のみ行う。
    """

    def __init__(
        self,
        client: httpx.Client,
        recompute_all: bool = False,
        min_confidence: float = 0.1,
    ) -> None:
        self.client = client
        self.field_enrichers: tuple[FieldEnricher[Company, object], ...] = (
            LogoFieldEnricher(client, recompute_all=recompute_all),
            IndustryFieldEnricher(
                client,
                recompute_all=recompute_all,
                min_confidence=min_confidence,
            ),
        )

    def enrich(self, item: Company) -> Result[Company, Exception]:
        try:
            for enricher in self.field_enrichers:
                result = enricher.compute(item)
                if result.is_err():
                    return Result.err(result.unwrap_err())
                value = result.unwrap()
                if value is not None:
                    setattr(item, enricher.field_name, value)
            return Result.ok(item)
        except Exception as exc:  # pragma: no cover - defensive
            return Result.err(exc)
