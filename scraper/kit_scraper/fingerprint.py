"""Stable hash of the schedule-relevant parts of an Event (content text excluded)."""
from __future__ import annotations

import hashlib
import json

from .models import Event


def fingerprint(e: Event) -> str:
    payload = {
        "slots": [s.to_json_dict() for s in e.slots],
        "sessions": [s.to_json_dict() for s in e.sessions],
        "lecturers": [l.name for l in e.lecturers],
        "moduleIds": e.module_ids,
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
