# Church Service Timer

A minimal, production-quality countdown timer application for church services. One operator controls the timer from a dashboard; a dedicated TV/monitor displays the countdown, and ProPresenter's Stage Display shows the same timer in real time.

## Features

- **Single-screen control**: operator dashboard with simple name/duration/control buttons
- **Multi-screen display**: TV/monitor full-screen countdown + ProPresenter Stage Display integration
- **Real-time sync**: WebSocket-driven broadcast ensures all screens stay perfectly synchronized
- **Overtime support**: timer continues counting up with `+MM:SS` notation after planned time expires
- **Best-effort integration**: ProPresenter updates never block or slow the core app
- **Responsive design**: works on any screen size, optimized for touch and keyboard

## Architecture

```
                    Timer Controller UI
                    (Operator Dashboard)
                             |
                             |
                       REST + WebSocket API
                             |
                    Timer Backend Service (FastAPI)
                    /                 \
                   /                   \
        Full Screen Timer Display    ProPresenter Timer Control
        (TV/Monitor Web)             (REST API)
```

## Quick Start — Local Development

### Prerequisites
- Python 3.12+
- Node.js 18+ (for frontend development)
- ProPresenter 7.9+ (optional, for Stage Display integration)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

Run the backend:
```bash
uvicorn app.main:app --reload
```

The backend starts on `http://localhost:8000`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts on `http://localhost:5173`.

### Verify in Browser

1. **Controller**: [http://localhost:5173/](http://localhost:5173/)
   - Set segment name and duration
   - Click Start/Pause/Reset/+1/+5/-1 buttons
   
2. **Display**: [http://localhost:5173/display](http://localhost:5173/display)
   - Open in a second tab or window
   - Full-screen mode: press F11
   - Both tabs should countdown in lockstep

## Testing

### Backend Tests
```bash
cd backend
pytest -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Docker Deployment

Build and run locally with Docker Compose:

```bash
docker compose up --build
```

- **Controller UI**: [http://localhost/](http://localhost/)
- **Display Screen**: [http://localhost/display](http://localhost/display)
- **API**: [http://localhost/api/timer/state](http://localhost/api/timer/state)

To customize ProPresenter settings, edit `docker-compose.yml`:
```yaml
environment:
  - PROPRESENTER_ENABLED=true
  - PROPRESENTER_HOST=192.168.1.100
  - PROPRESENTER_PORT=50001
  - PROPRESENTER_TIMER_NAME=Service Timer
```

## Network Operations

### Recommended Setup: Laptop + External Monitor

This is the ideal setup for a single-operator service:

```
Laptop (Docker running)
├─ Browser Tab 1: http://localhost/ (Controller)
└─ Browser Tab 2: http://localhost/display (External Monitor via HDMI)
   
Both pages sync perfectly via WebSocket
```

**Setup Instructions:**
1. Start Docker: `docker compose up --build`
2. On **Laptop**: Open browser → `http://localhost/` (Controller page)
3. On **External Monitor**: Open browser → `http://localhost/display` (Full-screen countdown)
4. Both update in real-time from the same backend

### Multi-Device Access (Smartphone/Tablet)

Any device on your WiFi can access the app using the **laptop's static IP**.

#### Step 1: Set a Static IP on Your Laptop

**Windows:**
```
Settings → Network & Internet → WiFi → Advanced Options
→ IP assignment → Edit → Manual → Toggle IPv4
Enter: IP Address (e.g., 192.168.1.100), Subnet Mask (255.255.255.0), Gateway (192.168.1.1)
```

**macOS:**
```
System Settings → Network → WiFi (Connected Network) → Details
→ TCP/IP → Configure IPv4: Manually
Enter: IP Address (e.g., 192.168.1.100), Subnet Mask (255.255.255.0), Router (192.168.1.1)
```

**Linux:**
```bash
nmtui  # or edit /etc/netplan/00-installer-config.yaml
```

#### Step 2: Access from Multiple Devices

Once Docker is running on your laptop with a static IP (e.g., `192.168.1.100`):

| Device | Access URL | Role |
|--------|-----------|------|
| **Laptop Browser** | `http://localhost/` | Controller (full features) |
| **External Monitor** | `http://192.168.1.100/display` | Main display (full-screen) |
| **Tablet** | `http://192.168.1.100/display` | Stage/confidence monitor |
| **Phone** | `http://192.168.1.100/` | Backup controller or monitoring |
| **TV (standalone)** | `http://192.168.1.100/display` | Secondary display |

#### Step 3: Easy URL Sharing

The **Controller page displays your server IP** at the top with a "Copy" button:
- Shows current IP address
- Shows number of connected devices
- Easy to share with team members

### Alternative: Hostname Access (No Static IP Needed)

If your network supports mDNS (most do), use your laptop's hostname:

```bash
# Find your laptop's hostname
hostname  # macOS/Linux
# or Settings → System → About → Device name  # Windows

# Access from any device:
http://<your-laptop-name>.local/
http://<your-laptop-name>.local/display
```

**Pros:** No static IP configuration needed  
**Cons:** May not work on all networks; `.local` domains can be unreliable

### Network Architecture

```
Church WiFi Network (closed LAN)
├─ Laptop (192.168.1.100)
│  ├─ Backend (FastAPI, port 8000)
│  └─ Frontend (nginx, port 80)
│
├─ External Monitor → http://192.168.1.100/display
├─ Tablet (Stage) → http://192.168.1.100/display
├─ Phone (Backup) → http://192.168.1.100/
└─ Laptop Browser → http://localhost/ or http://192.168.1.100/
```

### Connection Status on Controller

The **Controller page shows:**
- 📡 **Server URL** with one-click copy button
- 🔗 **Connected Devices** count (updates every 5 seconds)
- 💡 Quick reference for all access methods

### Troubleshooting Network Access

**"Cannot reach http://192.168.x.x"**
- Confirm laptop is on same WiFi network
- Check firewall: port 80 should be open to LAN traffic
- Restart Docker: `docker compose down && docker compose up --build`
- Verify static IP is actually set on laptop

**"Connection keeps dropping"**
- WiFi signal strength: move closer or improve antenna
- Network congestion: use 5GHz WiFi if available
- Check Docker container health: `docker compose ps`

**"Different devices show different times"**
- All connected devices sync via WebSocket
- If out of sync, reconnect (refresh browser)
- Check WebSocket connection (see browser Console)

## Multi-Screen Setup

### TV/Monitor Display
1. Find the host machine's local IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
2. On the TV/monitor machine, open a browser to: `http://<HOST_IP>/display`
3. **Go fullscreen** (3 options):
   - Click the "⛶ Fullscreen" button (top-right corner of display)
   - Press `F` key
   - Press `F11` for native browser fullscreen
4. Press `ESC` or `F` to exit fullscreen

**Note:** The app fullscreen (⛶ button or `F` key) hides the browser chrome completely for a cleaner display. Native browser fullscreen (`F11`) works too but may show OS elements.

### ProPresenter Stage Display Integration

#### Setup (one-time)

1. **Enable ProPresenter's Network API**:
   - Open ProPresenter Settings → Network
   - Enable "Remote Control" (or ensure it's enabled)
   - Note the port (default: 50001)

2. **Create/configure the timer in ProPresenter**:
   - Add a new Timer (or use an existing one)
   - Name it exactly as you'll reference it (e.g., `"Service Timer"`)
   - Assign it to your Stage Display layout if needed

3. **Configure the backend**:
   - Set environment variables:
     ```bash
     export PROPRESENTER_ENABLED=true
     export PROPRESENTER_HOST=192.168.1.50  # IP of the machine running ProPresenter
     export PROPRESENTER_PORT=50001
     export PROPRESENTER_TIMER_NAME="Service Timer"
     ```
   - Or edit `docker-compose.yml` if using Docker

4. **Verify connection**:
   - Start the app
   - On the controller UI, look for the "PP Connected" badge
   - Green = connected; Orange = offline (app still works)

#### Using Docker on the Same Machine as ProPresenter

If ProPresenter and Docker Desktop run on the same machine, use `host.docker.internal`:
```yaml
environment:
  - PROPRESENTER_ENABLED=true
  - PROPRESENTER_HOST=host.docker.internal
  - PROPRESENTER_PORT=50001
  - PROPRESENTER_TIMER_NAME=Service Timer
```

#### Troubleshooting ProPresenter Connection

- **ProPresenter connection badge is offline (orange)**:
  - Verify ProPresenter's Network API is enabled
  - Confirm `PROPRESENTER_HOST` and `PROPRESENTER_PORT` match ProPresenter's settings
  - Test connectivity: `curl http://<PROPRESENTER_HOST>:<PROPRESENTER_PORT>/v1/timer/<TIMER_NAME>`
  - Check firewall: port 50001 must be open on the ProPresenter machine

- **Timer updates work locally but ProPresenter doesn't change**:
  - The app intentionally fails silently — ProPresenter issues never block the main timer
  - Check ProPresenter's own logs for API errors
  - Verify the timer name in `PROPRESENTER_TIMER_NAME` matches exactly

## API Reference

### REST Endpoints

All endpoints expect/return JSON with the timer state.

**Get current state:**
```http
GET /api/timer/state
```

**Start timer:**
```http
POST /api/timer/start
Content-Type: application/json

{
  "name": "Worship",
  "duration": 600
}
```

**Pause timer:**
```http
POST /api/timer/pause
```

**Reset timer:**
```http
POST /api/timer/reset
```

**Add time:**
```http
POST /api/timer/add
Content-Type: application/json

{"seconds": 60}
```

**Subtract time:**
```http
POST /api/timer/subtract
Content-Type: application/json

{"seconds": 60}
```

### WebSocket

Connect to `/ws/timer` for real-time state broadcasts:
```javascript
const ws = new WebSocket(`ws://${window.location.host}/ws/timer`);
ws.onmessage = (event) => {
  const state = JSON.parse(event.data);
  console.log(state);
  // {
  //   "name": "Worship",
  //   "duration": 600,
  //   "remaining": 345,
  //   "status": "running",
  //   "propresenter_connected": true
  // }
};
```

### State Model

```typescript
{
  "name": string,              // Segment name, e.g., "Worship"
  "duration": number,          // Planned duration in seconds
  "remaining": number,         // Current remaining seconds (negative = overtime)
  "status": "idle" | "running" | "paused" | "completed",
  "propresenter_connected": boolean
}
```

## Future Roadmap

### Phase 2 (Not Implemented)
- Multiple timers / agenda management
- Service templates and presets
- User authentication
- Timer history/logs

### Phase 3 (Not Implemented)
- OBS overlay integration
- Remote mobile controller
- Streaming overlay support

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, routes, WebSocket
│   │   ├── timer_engine.py      # Countdown logic
│   │   ├── connection_manager.py # WebSocket broadcast
│   │   ├── propresenter_client.py # ProPresenter REST adapter
│   │   ├── models.py            # Pydantic schemas
│   │   └── config.py            # Settings from env
│   ├── tests/
│   │   ├── test_timer_engine.py
│   │   ├── test_websocket.py
│   │   └── test_propresenter_client.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── pages/
│   │   │   ├── ControllerPage.tsx
│   │   │   └── DisplayPage.tsx
│   │   ├── components/
│   │   │   ├── TimerReadout.tsx
│   │   │   ├── ControlPanel.tsx
│   │   │   └── ConnectionBadge.tsx
│   │   ├── hooks/
│   │   │   └── useTimerSocket.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       ├── time.ts
│   │       └── time.test.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── index.html
├── docker-compose.yml
└── README.md
```

## Philosophy

- **One person controls**: the operator is the single source of truth
- **Every screen shows the same time**: WebSocket synchronization, monotonic clock accuracy
- **Never a church management system**: scope stays tight; no scheduling, auth, or media management
- **Best-effort reliability**: ProPresenter connection failures never impact the core timer

## License

MIT
