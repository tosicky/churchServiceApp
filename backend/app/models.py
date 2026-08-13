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


class SendStageMessageRequest(BaseModel):
    text: str
    duration: Optional[int] = None  # seconds, or None for persist


class StageMessageModel(BaseModel):
    text: str
    expires_at: Optional[float] = None  # Unix timestamp, or None if persisting
    auto: bool = False  # True if auto-computed ("Coming Next: ..."), False if operator-authored
