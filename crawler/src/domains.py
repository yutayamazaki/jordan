from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class JordanBaseModel(BaseModel):
    """Shared Pydantic settings for the crawler domain models."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class Company(JordanBaseModel):
    id: str
    name: str
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    employee_range: Optional[str] = None
    primary_domain_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class Domain(JordanBaseModel):
    id: str
    company_id: str
    domain: str
    disposable: bool = False
    webmail: bool = False
    accept_all: bool = False
    pattern: Optional[str] = None
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class Contact(JordanBaseModel):
    id: str
    company_id: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    position_category: Optional[str] = None
    department_category: Optional[str] = None
    seniority: Optional[str] = None
    city: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    phone_number: Optional[str] = None
    source_label: Optional[str] = None
    source_url: Optional[str] = None
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class Email(JordanBaseModel):
    id: str
    contact_id: Optional[str] = None
    domain_id: Optional[str] = None
    email: str
    kind: Optional[Literal["personal", "generic", "role", "unknown"]] = None
    source: Optional[str] = None
    status: Literal["pending", "Unverifiable", "Bad", "Ok"] = "pending"
    domain_country_code: Optional[Literal["US", "JP"]] = None
    mail_server_country_code: Optional[Literal["US", "JP"]] = None
    status_info: Optional[str] = None
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
