"""Contact-related enrichers and helpers."""

from .enricher import (
    ContactEnricher,
    DEPARTMENT_CATEGORY_CHOICES,
    POSITION_CATEGORY_CHOICES,
    classify_department_category,
    classify_position_category,
)

__all__ = [
    "ContactEnricher",
    "DEPARTMENT_CATEGORY_CHOICES",
    "POSITION_CATEGORY_CHOICES",
    "classify_department_category",
    "classify_position_category",
]
