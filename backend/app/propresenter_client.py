import httpx
import json
import logging
from typing import Literal, Optional
from .config import Settings

logger = logging.getLogger(__name__)


class ProPresenterClient:
    """Best-effort HTTP adapter for ProPresenter 7.9+ REST API.

    All public methods catch exceptions internally and never raise,
    ensuring ProPresenter connection issues never block or delay the
    core timer application.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = httpx.AsyncClient(timeout=2.0)

    async def sync(
        self,
        name: str,
        duration: int,
        remaining: int,
        status: Literal["idle", "running", "paused", "completed"],
    ):
        """Sync timer state to ProPresenter using absolute values only (never relative adjustments).

        This method is idempotent and safe to call repeatedly — each call pushes the exact
        app state onto ProPresenter, never relying on ProPresenter's prior state. This eliminates
        double-counting bugs from relative adjustments and allows periodic defensive resync.
        """
        if not self.settings.propresenter_enabled:
            return

        try:
            if status == "running":
                # Tell ProPresenter to count down live from the exact remaining time, starting now
                await self.start(remaining)
            else:
                # idle, paused, completed -> static display at the exact remaining value
                await self.reset(remaining)
        except Exception as e:
            logger.warning(f"ProPresenter sync failed: {e}")

    async def start(self, duration: int):
        """Start/configure the ProPresenter timer."""
        if not self.settings.propresenter_enabled:
            return

        try:
            url = f"{self.settings.get_propresenter_base_url()}/v1/timer/{self.settings.propresenter_timer_name}/start"
            body = {
                "id": {"name": self.settings.propresenter_timer_name},
                "allows_overrun": True,
                "countdown": {"duration": duration},
            }
            response = await self.client.put(url, json=body)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"ProPresenter start failed: {e}")

    async def pause(self):
        """Pause the ProPresenter timer."""
        if not self.settings.propresenter_enabled:
            return

        try:
            url = f"{self.settings.get_propresenter_base_url()}/v1/timer/{self.settings.propresenter_timer_name}/stop"
            response = await self.client.put(url)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"ProPresenter pause failed: {e}")

    async def reset(self, duration: int):
        """Reset the ProPresenter timer to initial duration."""
        if not self.settings.propresenter_enabled:
            return

        try:
            url = f"{self.settings.get_propresenter_base_url()}/v1/timer/{self.settings.propresenter_timer_name}/reset"
            body = {
                "id": {"name": self.settings.propresenter_timer_name},
                "allows_overrun": True,
                "countdown": {"duration": duration},
            }
            response = await self.client.put(url, json=body)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"ProPresenter reset failed: {e}")

    async def adjust(self, seconds: int) -> bool:
        """Adjust the running ProPresenter timer by seconds (negative = subtract)."""
        if not self.settings.propresenter_enabled:
            return True

        try:
            url = f"{self.settings.get_propresenter_base_url()}/v1/timer/{self.settings.propresenter_timer_name}/increment/{seconds}"
            response = await self.client.get(url)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.warning(f"ProPresenter adjust failed: {e}")
            return False

    async def health_check(self) -> bool:
        """Check if ProPresenter timer is reachable."""
        if not self.settings.propresenter_enabled:
            return False

        try:
            url = f"{self.settings.get_propresenter_base_url()}/v1/timer/{self.settings.propresenter_timer_name}"
            response = await self.client.get(url)
            response.raise_for_status()
            return True
        except Exception:
            return False

    def update_settings(self, new_settings: dict):
        """Update ProPresenter connection settings (host, port, timer name, enabled flag)."""
        if "propresenter_enabled" in new_settings:
            self.settings.propresenter_enabled = new_settings["propresenter_enabled"]
        if "propresenter_host" in new_settings:
            self.settings.propresenter_host = new_settings["propresenter_host"]
        if "propresenter_port" in new_settings:
            self.settings.propresenter_port = new_settings["propresenter_port"]
        if "propresenter_timer_name" in new_settings:
            self.settings.propresenter_timer_name = new_settings["propresenter_timer_name"]

    async def send_stage_message(self, message_text: str):
        """Send a stage message to ProPresenter."""
        if not self.settings.propresenter_enabled:
            return

        try:
            url = f"{self.settings.get_propresenter_base_url()}/v1/stage/message"
            # ProPresenter expects a JSON string (quoted string), not an object
            json_string = json.dumps(message_text)
            response = await self.client.put(url, content=json_string, headers={"Content-Type": "application/json"})
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"ProPresenter stage message send failed: {e}")

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
