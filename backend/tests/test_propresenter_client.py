import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from app.propresenter_client import ProPresenterClient
from app.config import Settings


@pytest.fixture
def settings_enabled():
    """Settings with ProPresenter enabled."""
    return Settings(
        propresenter_enabled=True,
        propresenter_host="localhost",
        propresenter_port=50001,
        propresenter_timer_name="Test Timer",
    )


@pytest.fixture
def settings_disabled():
    """Settings with ProPresenter disabled."""
    return Settings(propresenter_enabled=False)


@pytest.mark.asyncio
async def test_start_request_correct_format(settings_enabled):
    """Test start method builds correct HTTP request."""
    client = ProPresenterClient(settings_enabled)

    # Mock the httpx.AsyncClient
    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.put = AsyncMock(return_value=mock_response)

    await client.start(600)

    # Verify the PUT request was made with correct path and body
    expected_url = "http://localhost:50001/v1/timer/Test Timer/start"
    expected_body = {
        "id": {"name": "Test Timer"},
        "allows_overrun": True,
        "countdown": {"duration": 600},
    }

    client.client.put.assert_called_once_with(expected_url, json=expected_body)


@pytest.mark.asyncio
async def test_pause_request_correct_format(settings_enabled):
    """Test pause method builds correct HTTP request."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.put = AsyncMock(return_value=mock_response)

    await client.pause()

    expected_url = "http://localhost:50001/v1/timer/Test Timer/stop"
    client.client.put.assert_called_once_with(expected_url)


@pytest.mark.asyncio
async def test_reset_request_correct_format(settings_enabled):
    """Test reset method builds correct HTTP request."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.put = AsyncMock(return_value=mock_response)

    await client.reset(300)

    expected_url = "http://localhost:50001/v1/timer/Test Timer/reset"
    expected_body = {
        "id": {"name": "Test Timer"},
        "allows_overrun": True,
        "countdown": {"duration": 300},
    }

    client.client.put.assert_called_once_with(expected_url, json=expected_body)


@pytest.mark.asyncio
async def test_adjust_request_correct_format(settings_enabled):
    """Test adjust method builds correct HTTP request."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.get = AsyncMock(return_value=mock_response)

    result = await client.adjust(60)

    expected_url = "http://localhost:50001/v1/timer/Test Timer/increment/60"
    client.client.get.assert_called_once_with(expected_url)
    assert result is True


@pytest.mark.asyncio
async def test_adjust_negative_seconds(settings_enabled):
    """Test adjust with negative seconds."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.get = AsyncMock(return_value=mock_response)

    result = await client.adjust(-30)

    expected_url = "http://localhost:50001/v1/timer/Test Timer/increment/-30"
    client.client.get.assert_called_once_with(expected_url)
    assert result is True


@pytest.mark.asyncio
async def test_health_check_success(settings_enabled):
    """Test health check returns True on success."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.get = AsyncMock(return_value=mock_response)

    result = await client.health_check()

    expected_url = "http://localhost:50001/v1/timer/Test Timer"
    client.client.get.assert_called_once_with(expected_url)
    assert result is True


@pytest.mark.asyncio
async def test_health_check_failure(settings_enabled):
    """Test health check returns False on failure."""
    client = ProPresenterClient(settings_enabled)

    client.client.get = AsyncMock(side_effect=Exception("Connection failed"))

    result = await client.health_check()

    assert result is False


@pytest.mark.asyncio
async def test_exceptions_are_caught_not_raised(settings_enabled):
    """Test that exceptions are caught and logged, never raised."""
    client = ProPresenterClient(settings_enabled)

    # Mock an exception
    client.client.put = AsyncMock(side_effect=Exception("Connection error"))

    # Should not raise, just log
    try:
        await client.start(600)
        # If we got here, exception was handled
        assert True
    except Exception:
        pytest.fail("Exception should be caught and not raised")


@pytest.mark.asyncio
async def test_disabled_settings_noop(settings_disabled):
    """Test that all methods are no-ops when disabled."""
    client = ProPresenterClient(settings_disabled)

    # These should all complete without making any HTTP calls
    await client.start(600)
    await client.pause()
    await client.reset(600)
    result = await client.adjust(60)
    assert result is True  # adjust returns True when disabled


@pytest.mark.asyncio
async def test_sync_running_status(settings_enabled):
    """Test sync method dispatches correctly for running status."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.put = AsyncMock(return_value=mock_response)
    client.client.get = AsyncMock(return_value=mock_response)

    # Sync with running status and full duration (fresh start)
    await client.sync(name="Test", duration=600, remaining=600, status="running")

    # Should call start
    assert client.client.put.called


@pytest.mark.asyncio
async def test_sync_paused_status(settings_enabled):
    """Test sync method dispatches correctly for paused status."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.put = AsyncMock(return_value=mock_response)

    await client.sync(name="Test", duration=600, remaining=300, status="paused")

    # Should call pause
    assert client.client.put.called


@pytest.mark.asyncio
async def test_sync_idle_status(settings_enabled):
    """Test sync method dispatches correctly for idle status."""
    client = ProPresenterClient(settings_enabled)

    mock_response = AsyncMock()
    mock_response.raise_for_status = AsyncMock()
    client.client.put = AsyncMock(return_value=mock_response)

    await client.sync(name="Test", duration=600, remaining=0, status="idle")

    # Should call reset
    assert client.client.put.called
