from pydantic import BaseModel
from typing import Literal, Optional


class TimerStateModel(BaseModel):
    name: str
    duration: int  # planned duration in seconds
    remaining: int  # current remaining seconds (can be negative for overtime)
    status: Literal["idle", "running", "paused", "completed"]
    propresenter_connected: bool = False


class StartRequest(BaseModel):
    name: Optional[str] = None
    duration: Optional[int] = None
    unplanned: bool = False  # True for an ad-hoc segment started outside the queue
    # (Quick Start panel) - suppresses "Up Next" until the queue is resumed


class AdjustRequest(BaseModel):
    seconds: int


class SegmentRequest(BaseModel):
    name: str
    duration: int  # duration in seconds


class SettingsModel(BaseModel):
    propresenter_enabled: bool
    propresenter_host: str
    propresenter_port: int
    propresenter_timer_name: str
    server_address: str


class QueueModel(BaseModel):
    names: list[str]
    current_index: int = -1


class TemplateModel(BaseModel):
    name: str
    description: str = ""
    segment_names: list[str]


class ServiceCountdownModel(BaseModel):
    enabled: bool = False
    recurrence: Literal["once", "weekly"] = "once"
    target_time: Optional[str] = None  # "HH:MM" 24-hour. In "once" mode it's just for
    # redisplaying the picker; in "weekly" mode it's authoritative, interpreted in the
    # server's configured TZ (see docker-compose.yml) since there's no browser present
    # each week to compute it.
    target_timestamp: Optional[float] = None  # unix epoch seconds; authoritative for "once"
    # mode, computed by the operator's browser at save time so no server timezone is involved
    weekday: Optional[Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]] = None
    # used only in "weekly" mode


class SendStageMessageRequest(BaseModel):
    text: str
    duration: Optional[int] = None  # seconds, or None for persist


class StageMessageModel(BaseModel):
    text: str
    expires_at: Optional[float] = None  # Unix timestamp, or None if persisting
    auto: bool = False  # True if auto-computed ("Coming Next: ..."), False if operator-authored
