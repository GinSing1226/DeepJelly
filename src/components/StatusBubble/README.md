---
name: StatusBubble Component Documentation
description: Complete documentation for the StatusBubble component including usage examples and API reference.
---

# StatusBubble Component

A status bubble component that displays emoji and text status above the character's head. Uses Twemoji library for consistent emoji rendering across platforms.

## Features

- **Position Layout**: Fixed position above character's head with rounded rectangle design
- **Emoji + Text Rendering**: Uses Twemoji library for consistent emoji display
- **Preset Status Types**: Built-in support for common character states
- **Custom Status**: Support for custom emoji + text combinations
- **Duration Control**: Auto-hide after configurable display time
- **Smooth Animations**: Fade in/out animations for polished UX

## Installation

The component requires the `twemoji` package. Install it with:

```bash
npm install twemoji @types/twemoji
```

## Basic Usage

```tsx
import { StatusBubble, useStatusBubble, StatusType } from '@/components/StatusBubble';

function MyComponent() {
  const { status, statusType, setPresetStatus, setCustomStatus, clearStatus } = useStatusBubble();

  return (
    <div>
      <StatusBubble status={status} statusType={statusType} />

      <button onClick={() => setPresetStatus('thinking', 3000)}>
        Show Thinking Status
      </button>

      <button onClick={() => setCustomStatus('🎉', 'Custom!', 5000)}>
        Show Custom Status
      </button>

      <button onClick={clearStatus}>
        Clear Status
      </button>
    </div>
  );
}
```

## Preset Status Types

The component includes these preset status types:

| Status Type | Emoji | Text | Usage |
|------------|-------|------|-------|
| `idle` | 💤 | 空闲 | Character is idle/inactive |
| `listening` | 👂 | 倾听 | Character is listening to user |
| `thinking` | 🤔 | 思考 | Character is processing/thinking |
| `executing` | ⚙️ | 执行 | Character is executing a task |
| `speaking` | 💬 | 说话 | Character is speaking/responding |
| `network_error` | ❌ | 网络异常 | Network error occurred |

## API Reference

### StatusBubble Props

```typescript
interface StatusBubbleProps {
  /** Current status to display, null means no status */
  status: StatusData | null;
  /** Optional preset status type (overrides emoji/text in status if provided) */
  statusType?: StatusType;
}

interface StatusData {
  /** Optional emoji character (e.g., '😀', '🎉') */
  emoji?: string;
  /** Status text to display */
  text: string;
  /** Display duration in milliseconds, undefined means show indefinitely */
  duration?: number;
}
```

### useStatusBubble Hook

```typescript
function useStatusBubble(initialStatus?: StatusData): {
  /** Current status data */
  status: StatusData | null;
  /** Current preset status type */
  statusType: StatusType | undefined;
  /** Set status directly (use setPresetStatus or setCustomStatus instead) */
  setStatus: (status: StatusData | null) => void;
  /** Set preset status type */
  setStatusType: (type: StatusType | undefined) => void;
  /** Set a preset status type */
  setPresetStatus: (type: StatusType, duration?: number) => void;
  /** Set a custom status with emoji and text */
  setCustomStatus: (emoji: string, text: string, duration?: number) => void;
  /** Clear the current status */
  clearStatus: () => void;
}
```

## Examples

### Show Preset Status

```tsx
const { setPresetStatus } = useStatusBubble();

// Show thinking status for 3 seconds
setPresetStatus('thinking', 3000);

// Show idle status indefinitely
setPresetStatus('idle');
```

### Show Custom Status

```tsx
const { setCustomStatus } = useStatusBubble();

// Show custom status with emoji
setCustomStatus('🎉', '任务完成!', 3000);

// Show text-only status
setCustomStatus('', '处理中...', 5000);
```

### Clear Status

```tsx
const { clearStatus } = useStatusBubble();

// Immediately hide status bubble
clearStatus();
```

## Integration with CAP Protocol

To integrate with the brain layer via CAP protocol, handle status messages:

```tsx
useCAPMessage({
  onStatus: useCallback((payload) => {
    if (payload.status_type === 'preset') {
      setPresetStatus(
        payload.status_value as StatusType,
        payload.duration_ms
      );
    } else if (payload.status_type === 'custom') {
      setCustomStatus(
        payload.emoji || '',
        payload.text,
        payload.duration_ms
      );
    }
  }, [setPresetStatus, setCustomStatus]),
});
```

## Styling

The component uses CSS classes for styling:

- `.status-bubble` - Main container
- `.status-bubble-content` - Content container with gradient background
- `.status-bubble-emoji` - Emoji display
- `.status-bubble-text` - Text display
- `.status-bubble.status-{type}` - Type-specific styling (e.g., `.status-bubble.status-thinking`)

Customize styles by modifying `src/components/StatusBubble/styles.css`.

## Testing

Run tests with:

```bash
npm test StatusBubble
```

## Notes

- The status bubble is positioned below the thought bubble (thought bubble has z-index: 100, status bubble has z-index: 95)
- Duration is in milliseconds (e.g., 3000 = 3 seconds)
- If duration is not specified, the status remains visible until cleared or replaced
- The component gracefully falls back to native emoji rendering if Twemoji is not available
