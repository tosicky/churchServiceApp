from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application configuration from environment variables."""

    propresenter_enabled: bool = False
    propresenter_host: str = "localhost"
    propresenter_port: int = 50001
    propresenter_timer_name: str = "Service Timer"

    class Config:
        env_file = ".env"
        case_sensitive = False

    def get_propresenter_base_url(self) -> str:
        return f"http://{self.propresenter_host}:{self.propresenter_port}"


def get_settings() -> Settings:
    return Settings()
