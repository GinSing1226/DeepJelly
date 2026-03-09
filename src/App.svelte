<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { settingsStore, initializeSettings, connectOpenClaw, checkOpenClawStatus } from "./stores/settings";
  import { characterStore } from "./stores/character";
  import { sessionStore } from "./stores/session";

  let appStatus = "connecting...";
  let version = "";
  let openclawStatus = "disconnected";

  onMount(async () => {
    // Check app health
    try {
      const result = await invoke<{ status: string; version: string }>("ping");
      appStatus = result.status;
      version = result.version;
    } catch (e) {
      appStatus = "error";
      console.error("Failed to connect to app:", e);
    }

    // Initialize settings and check OpenClaw
    try {
      await initializeSettings();
      openclawStatus = "connected";
    } catch (e) {
      openclawStatus = "disconnected";
      console.log("OpenClaw not available:", e);
    }
  });

  // Subscribe to stores
  $: settings = $settingsStore;
  $: character = $characterStore;
  $: session = $sessionStore;
</script>

<main>
  <div class="character-window">
    <!-- App Status -->
    {#if appStatus === "ok"}
      <div class="status connected">
        <span class="dot green"></span>
        <span>App Ready</span>
      </div>
      <p class="version">v{version}</p>
    {:else if appStatus === "connecting..."}
      <div class="status connecting">
        <span class="dot yellow"></span>
        <span>Starting...</span>
      </div>
    {:else}
      <div class="status error">
        <span class="dot red"></span>
        <span>Error</span>
      </div>
    {/if}

    <!-- OpenClaw Status -->
    <div class="openclaw-status">
      <span class="label">OpenClaw:</span>
      <span class="value {openclawStatus}">
        {openclawStatus === "connected" ? "Connected" : "Disconnected"}
      </span>
    </div>

    <!-- Character Info -->
    {#if character.currentCharacter}
      <div class="character-info">
        <p class="character-name">{character.currentCharacter.name}</p>
        <p class="animation">Animation: {character.currentAnimation}</p>
      </div>
    {:else}
      <p class="message">DeepJelly is ready!</p>
    {/if}

    <!-- Session Info -->
    {#if session.currentSession}
      <div class="session-info">
        <p>Session: {session.currentSession.title || "Untitled"}</p>
        <p>Messages: {session.messages.length}</p>
      </div>
    {/if}

    <!-- DND Mode Indicator -->
    {#if settings.dndMode}
      <div class="dnd-indicator">DND Mode</div>
    {/if}
  </div>
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    user-select: none;
  }

  .character-window {
    text-align: center;
    padding: 20px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    min-width: 200px;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    color: #333;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.green {
    background: #4ade80;
  }

  .dot.yellow {
    background: #fbbf24;
    animation: pulse 1s infinite;
  }

  .dot.red {
    background: #f87171;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .version {
    font-size: 12px;
    color: #666;
    margin: 8px 0;
  }

  .message {
    font-size: 16px;
    color: #333;
    margin: 8px 0;
  }

  .openclaw-status {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 12px;
  }

  .openclaw-status .label {
    color: #666;
  }

  .openclaw-status .value.connected {
    color: #4ade80;
  }

  .openclaw-status .value.disconnected {
    color: #f87171;
  }

  .character-info {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eee;
  }

  .character-name {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin: 0;
  }

  .animation {
    font-size: 12px;
    color: #666;
    margin: 4px 0 0 0;
  }

  .session-info {
    margin-top: 12px;
    font-size: 12px;
    color: #666;
  }

  .session-info p {
    margin: 4px 0;
  }

  .dnd-indicator {
    margin-top: 12px;
    padding: 4px 8px;
    background: #fbbf24;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #333;
  }
</style>
