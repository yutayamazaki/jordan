from __future__ import annotations

from typing import Generic, Protocol, TypeVar

from src.result import Result

T = TypeVar("T")


class Enricher(Generic[T], Protocol):
    """任意のエンティティに付加情報を与えるためのプロトコル。"""

    def enrich(self, item: T) -> Result[T, Exception]:
        ...
