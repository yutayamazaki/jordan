from __future__ import annotations

from typing import Generic, Protocol, TypeVar

from src.result import Result

T = TypeVar("T")
U = TypeVar("U")


class Enricher(Generic[T], Protocol):
    """任意のエンティティに付加情報を与えるためのプロトコル。"""

    def enrich(self, item: T) -> Result[T, Exception]:
        ...


class FieldEnricher(Protocol, Generic[T, U]):
    """テーブルのカラムに対して変更を与えるためのプロトコル。"""

    field_name: str

    def compute(self, item: T) -> Result[U | None, Exception]:
        """item に基づいて field_name に設定すべき値を計算する。"""
        ...
