"""Data model mirroring spec §4. Python uses snake_case; JSON uses camelCase."""
from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any

KIT_BASE = "https://campus.studium.kit.edu/english/events/catalog.php#!campus/all/"
TERM_GUID = "0xD25DBD9C86874091993315DA11571AAF"
TERM = "WS 26/27"
SPO = "88-979-H-2025"


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(p.capitalize() for p in rest)


def _dump(value: Any) -> Any:
    if dataclasses.is_dataclass(value):
        return value.to_json_dict()
    if isinstance(value, list):
        return [_dump(v) for v in value]
    return value


class _Json:
    def to_json_dict(self) -> dict:
        return {_camel(f.name): _dump(getattr(self, f.name)) for f in dataclasses.fields(self)}

    @classmethod
    def _kwargs(cls, d: dict) -> dict:
        return {f.name: d.get(_camel(f.name), f.default if f.default is not dataclasses.MISSING else None)
                for f in dataclasses.fields(cls)}


@dataclass
class Lecturer(_Json):
    name: str
    unit: str


@dataclass
class Slot(_Json):
    day: str | None
    start: str | None
    end: str | None
    room: str | None
    rhythm: str
    first_date: str | None
    count: int | None


@dataclass
class Session(_Json):
    date: str
    start: str
    end: str
    room: str | None
    cancelled: bool


@dataclass
class Event(_Json):
    id: str
    number: str
    title: str
    type: str
    type_code: str
    language: str | None
    sws: float | None
    format: str | None
    content_text: str
    ilias_url: str | None
    kit_url: str
    catalog_paths: list[list[str]]
    lecturers: list[Lecturer]
    slots: list[Slot]
    sessions: list[Session]
    module_ids: list[str]
    fingerprint: str = ""

    @classmethod
    def from_json_dict(cls, d: dict) -> Event:
        kw = cls._kwargs(d)
        kw["lecturers"] = [Lecturer(**Lecturer._kwargs(x)) for x in d.get("lecturers", [])]
        kw["slots"] = [Slot(**Slot._kwargs(x)) for x in d.get("slots", [])]
        kw["sessions"] = [Session(**Session._kwargs(x)) for x in d.get("sessions", [])]
        return cls(**kw)


@dataclass
class ModuleDescription(_Json):
    objectives: str | None = None
    content: str | None = None
    prerequisites: str | None = None
    exam: str | None = None
    workload: str | None = None


@dataclass
class Brick(_Json):
    id: str
    title: str
    ects: float | None


@dataclass
class Module(_Json):
    id: str
    title: str
    ects: float | None
    recurrence: str | None
    language: str | None
    level: str | None
    assignment: str | None
    part: str | None
    fields: list[str]
    bricks: list[Brick]
    description: ModuleDescription
    kit_url: str

    @classmethod
    def from_json_dict(cls, d: dict) -> Module:
        kw = cls._kwargs(d)
        kw["bricks"] = [Brick(**Brick._kwargs(x)) for x in d.get("bricks", [])]
        kw["description"] = ModuleDescription(**ModuleDescription._kwargs(d.get("description") or {}))
        return cls(**kw)


@dataclass
class FieldNode(_Json):
    id: str
    title: str
    children: list[FieldNode] = field(default_factory=list)
    event_ids: list[str] = field(default_factory=list)


@dataclass
class Change(_Json):
    at: str
    event_id: str
    event_title: str
    kind: str
    summary: str
    before: Any = None
    after: Any = None

    def to_json_dict(self) -> dict:
        d = super().to_json_dict()
        for k in ("before", "after"):
            if d[k] is None:
                del d[k]
        return d

    @classmethod
    def from_json_dict(cls, d: dict) -> Change:
        return cls(**cls._kwargs(d))
