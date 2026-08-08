import pytest
import json
import asyncio
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


def test_get_timer_state(client):
    """Test GET /api/timer/state endpoint."""
    response = client.get("/api/timer/state")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "remaining" in data
    assert "duration" in data
    assert data["status"] == "idle"


def test_start_timer(client):
    """Test POST /api/timer/start endpoint."""
    response = client.post("/api/timer/start", json={"name": "Worship", "duration": 600})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Worship"
    assert data["duration"] == 600
    assert data["remaining"] == 600
    assert data["status"] == "running"


def test_pause_timer(client):
    """Test POST /api/timer/pause endpoint."""
    # Start timer
    client.post("/api/timer/start", json={"name": "Test", "duration": 60})

    # Pause it
    response = client.post("/api/timer/pause")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paused"


def test_reset_timer(client):
    """Test POST /api/timer/reset endpoint."""
    # Start timer
    client.post("/api/timer/start", json={"name": "Test", "duration": 60})

    # Reset it
    response = client.post("/api/timer/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "idle"
    assert data["remaining"] == 60


def test_add_time(client):
    """Test POST /api/timer/add endpoint."""
    # Start timer
    client.post("/api/timer/start", json={"name": "Test", "duration": 60})

    # Add 30 seconds
    response = client.post("/api/timer/add", json={"seconds": 30})
    assert response.status_code == 200
    data = response.json()
    # Remaining should be close to 90 (60 + 30)
    assert data["remaining"] > 85


def test_subtract_time(client):
    """Test POST /api/timer/subtract endpoint."""
    # Start timer
    client.post("/api/timer/start", json={"name": "Test", "duration": 60})

    # Subtract 20 seconds
    response = client.post("/api/timer/subtract", json={"seconds": 20})
    assert response.status_code == 200
    data = response.json()
    # Remaining should be close to 40 (60 - 20)
    assert data["remaining"] < 45


def test_websocket_connection_and_broadcast(client):
    """Test WebSocket connection receives state on connect and broadcasts."""
    with client.websocket_connect("/ws/timer") as websocket:
        # Should receive current state immediately
        data = websocket.receive_json()
        assert "status" in data
        assert data["status"] == "idle"

        # Now start the timer via REST
        response = client.post("/api/timer/start", json={"name": "Test", "duration": 60})
        assert response.status_code == 200

        # WebSocket should receive the broadcast
        data = websocket.receive_json()
        assert data["status"] == "running"
        assert data["name"] == "Test"


def test_multiple_websocket_clients_sync(client):
    """Test that multiple WebSocket clients receive the same broadcasts."""
    with client.websocket_connect("/ws/timer") as ws1:
        with client.websocket_connect("/ws/timer") as ws2:
            # Both get initial state
            data1 = ws1.receive_json()
            data2 = ws2.receive_json()
            assert data1["status"] == "idle"
            assert data2["status"] == "idle"

            # Start timer via REST
            response = client.post("/api/timer/start", json={"name": "Sermon", "duration": 300})
            assert response.status_code == 200

            # Both WebSockets should receive the same broadcast
            data1 = ws1.receive_json()
            data2 = ws2.receive_json()
            assert data1["status"] == "running"
            assert data2["status"] == "running"
            assert data1["name"] == "Sermon"
            assert data2["name"] == "Sermon"
            assert data1 == data2  # Exact same state


def test_websocket_receives_pause_broadcast(client):
    """Test WebSocket receives pause broadcast."""
    with client.websocket_connect("/ws/timer") as websocket:
        # Get initial state
        websocket.receive_json()

        # Start timer
        client.post("/api/timer/start", json={"name": "Test", "duration": 60})
        websocket.receive_json()  # Consume start broadcast

        # Pause timer
        response = client.post("/api/timer/pause")
        assert response.status_code == 200

        # WebSocket should receive pause broadcast
        data = websocket.receive_json()
        assert data["status"] == "paused"
