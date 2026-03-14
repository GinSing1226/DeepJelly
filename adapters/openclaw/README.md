# DeepJelly OpenClaw Plugin

> Connects AI assistants from OpenClaw to desktop virtual characters in DeepJelly.

---

## Quick Installation

### Option 1: Automatic Installation (Recommended)

```bash
# Download plugin from GitHub Release
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip

# Extract to OpenClaw extensions directory
unzip deepjelly-openclaw-plugin.zip -d ~/.openclaw/extensions/

# Rename folder (if needed)
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly
```

**Windows (PowerShell)**:
```powershell
# Download plugin
Invoke-WebRequest -Uri "https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip" -OutFile "deepjelly-openclaw-plugin.zip"

# Extract
Expand-Archive -Path "deepjelly-openclaw-plugin.zip" -DestinationPath "$env:USERPROFILE\.openclaw\extensions\"

# Rename folder (if needed)
Rename-Item "$env:USERPROFILE\.openclaw\extensions\deepjelly-openclaw-plugin" "$env:USERPROFILE\.openclaw\extensions\deepjelly"
```

### Option 2: Manual Installation

```bash
# Clone DeepJelly repository (if not already cloned)
git clone https://github.com/GinSing1226/DeepJelly.git
cd DeepJelly

# Copy plugin files to OpenClaw extensions directory
cd adapters/openclaw
mkdir -p ~/.openclaw/extensions/deepjelly
cp -r src dist openclaw.plugin.json README.md ~/.openclaw/extensions/deepjelly/
```

**Windows (PowerShell)**:
```powershell
# Clone DeepJelly repository
git clone https://github.com/GinSing1226/DeepJelly.git
cd DeepJelly

# Copy plugin files
cd adapters\openclaw
mkdir ~/.openclaw/extensions/deepjelly -Force
copy src ~/.openclaw/extensions/deepjelly/src -Recurse
copy dist ~/.openclaw/extensions/deepjelly/dist -Recurse
copy openclaw.plugin.json ~/.openclaw/extensions/deepjelly/
copy README.md ~/.openclaw/extensions/deepjelly/
```

**Important Notes**:
- **No npm install needed** - This plugin only uses the `ws` dependency from OpenClaw's main dependencies
- **Restart OpenClaw Gateway** after installation

---

## Install DeepJelly Skills

### Step 1: Create Skills Directory

Create a `skills` folder in your OpenClaw root directory:

**Linux/macOS**:
```bash
mkdir -p /opt/openclaw/skills
```

**Windows**:
```powershell
mkdir C:\OpenClaw\skills
```

### Step 2: Download Skills

Download the following skill folders from [DeepJelly/skills](https://github.com/GinSing1226/DeepJelly/tree/main/skills):
- `deepjelly-integrate`
- `deepjelly-character`

Copy both folders to the `skills` directory created in Step 1.

### Step 3: Configure OpenClaw

Edit `openclaw.json` to add the skills loading path:

```json
{
  "skills": {
    "load": {
      "extraDirs": [
        "./skills"
      ],
      "watch": true
    }
  }
}
```

**Note**: Both relative and absolute paths are supported. Relative paths are recommended.

---

## Port Selection and Firewall Setup

### Step 1: Check Port Availability

Verify that the default port (18790) is available:

**Windows (PowerShell)**:
```powershell
netstat -ano | findstr :18790
```

**Linux/macOS**:
```bash
lsof -i :18790
# OR
netstat -tuln | grep 18790
```

If port 18790 is occupied, choose an alternative port (e.g., 18791, 18792).

### Step 2: Get Local LAN IP

For LAN deployment, get your machine's LAN IP address:

**Windows**:
```powershell
ipconfig
# Look for "IPv4 Address", e.g., 192.168.10.128
```

**Linux/macOS**:
```bash
ip addr show
# OR
hostname -I
```

### Step 3: Configure Firewall Rules

**Important**: Configure firewall rules to allow inbound connections.

**Windows (PowerShell - Run as Administrator)**:
```powershell
New-NetFirewallRule -DisplayName "DeepJelly OpenClaw" -Direction Inbound -LocalPort 18790 -Protocol TCP -Action Allow
```

**Linux (ufw)**:
```bash
sudo ufw allow 18790/tcp
```

**Linux (firewalld)**:
```bash
sudo firewall-cmd --permanent --add-port=18790/tcp
sudo firewall-cmd --reload
```

---

## Network Configuration

### Local Development (Same Machine)

**Firewall**: No configuration needed

**OpenClaw Configuration** (`openclaw.json`):
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "127.0.0.1",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
```

**DeepJelly Connection**: `ws://127.0.0.1:18790`

### LAN Deployment (Different Machines)

**Firewall**: Allow inbound connections on port 18790

**OpenClaw Configuration** (`openclaw.json`):
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "192.168.10.128",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
```

**DeepJelly Connection**: `ws://192.168.10.128:18790`

**Important**: For LAN deployment, use the **OpenClaw machine's LAN IP** (e.g., `192.168.10.128`), **NOT** `0.0.0.0` or `127.0.0.1`.

---

## Integration Guide

After installing the plugin and skills, follow these steps in DeepJelly:

### Step 1: Start DeepJelly

**Option A - Installed Application**:
```
Open the DeepJelly desktop application
```

**Option B - Development Environment**:
```bash
cd /path/to/DeepJelly
npm run tauri:dev
```

### Step 2: Enter Onboarding

1. First launch automatically shows onboarding
2. If skipped, go to **Settings → Integration Management → Add Integration**

### Step 3: Configure Connection

1. **Select Application Type**: Choose "OpenClaw"
2. **Fill Connection Information**:
   - **IP Address**: OpenClaw's LAN IP (e.g., `192.168.10.128`) or `127.0.0.1` for local
   - **Port**: Default `18790`
   - **Auth Token**: Optional, if OpenClaw requires authentication
3. **Click Connect** and wait for success

### Step 4: Configure Skills

After connection, DeepJelly will display configuration information:

1. **DeepJelly API Address**: e.g., `127.0.0.1`
2. **DeepJelly API Port**: e.g., `12261`
3. **DeepJelly API Token**: 32-character random string

Update these values in both skill config files:
- `skills/deepjelly-integrate/config.md`
- `skills/deepjelly-character/config.md`

### Step 5: Complete Integration

1. **Select Bindings** (in order): Agent ID → Session Key → Assistant ID → Character ID
2. **Choose Integration Method**:
   - **Auto Integration**: DeepJelly generates a prompt for OpenClaw AI
   - **Manual Integration**: Edit `openclaw.json` following the configuration below

---

## Auto Integration

When you select **Auto Integration**, DeepJelly generates a prompt. Send it to OpenClaw AI, which will automatically:

1. Configure channels module
2. Configure bindings module
3. Restart gateway after 20 seconds

**For AI Agents**: Refer to [README_AGENT.md](../../README_AGENT.md) for detailed installation instructions.

---

## Manual Configuration

If you selected manual integration, add the following to `openclaw.json`:

**Channels Configuration**:
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "127.0.0.1",
      "serverPort": 18790,
      "autoStart": true,
      "applicationId": "your_application_id_from_deepjelly",
      "accounts": {
        "agent:christina:main": {
          "assistantId": "work_assistant",
          "characterId": "char_feishu_private"
        }
      }
    }
  }
}
```

**Configuration Details**:
- **applicationId**: Get from DeepJelly onboarding page
- **accounts**: Mapping of sessions to assistants/characters
  - **Key**: sessionKey (e.g., `agent:christina:main`)
  - **assistantId**: DeepJelly assistant ID
  - **characterId**: DeepJelly character ID

**Bindings Configuration**:
```json
{
  "agentId": "christina",
  "match": {
    "channel": "deepjelly"
  }
}
```

---

## Verify Integration

After completing integration:

1. Restart OpenClaw Gateway
2. Send a message in Feishu, Telegram, or other integrated channels
3. The DeepJelly character should automatically respond

---

## Troubleshooting

### Port Already in Use
```bash
# Check port usage
lsof -i :18790  # Linux/macOS
netstat -ano | findstr :18790  # Windows

# Choose an alternative port (18791, 18792, etc.)
```

### Skills Not Loading
- Verify `skills.load.extraDirs` path is correct (relative or absolute)
- Check that skill folders contain `SKILL.md` and `config.md`
- Ensure paths use forward slashes `/` or double backslashes `\\`

### Connection Failed
- Confirm DeepJelly application is running
- Check firewall rules allow port 18790 inbound
- Verify IP address and port are correct
- Ensure OpenClaw Gateway is running

---

## Links

- **DeepJelly Project**: [https://github.com/GinSing1226/DeepJelly](https://github.com/GinSing1226/DeepJelly)
- **AI Installation Guide**: [README_AGENT.md](../../README_AGENT.md)
- **Issue Tracker**: [https://github.com/GinSing1226/DeepJelly/issues](https://github.com/GinSing1226/DeepJelly/issues)

---

## License

MIT
