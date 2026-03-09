---
name: ChatBubble Implementation
description: Complete implementation summary of the ChatBubble component
---

# ChatBubble Component Implementation

## Overview

The ChatBubble component is a comic-style speech bubble that displays chat messages above the character's head. It supports single/group chat differentiation, streaming text effects, message queuing, and click-to-open-dialog functionality.

## Files Created

1. **src/components/ChatBubble/index.tsx**
   - Main ChatBubble component implementation
   - Exports `ChatBubble`, `ChatBubbleProps`, `ChatMessage`, `ChatType`, `useChatBubble`

2. **src/components/ChatBubble/styles.css**
   - Comic-style bubble design with triangular pointer
   - Single/group chat type differentiation
   - Dark mode support
   - Responsive design adjustments
   - Animations for fade in/out and streaming cursor

3. **src/components/ChatBubble/example.tsx**
   - Example usage demonstrating all features
   - Interactive controls for testing

4. **src/components/ChatBubble/index.test.tsx**
   - Comprehensive unit tests
   - Covers all major functionality

## Features Implemented

### 1. Position Layout (位置布局) ✅
- Positioned at top-right angle above character (not centered)
- Comic-style triangular pointer pointing to character
- Z-index: 98 (between status bubble at 95 and thought bubble at 100)

### 2. Size Adaptation (尺寸自适应) ✅
- Minimum width: 120px
- Maximum width: 300px
- Auto-adjusts based on content length

### 3. Chat Type Differentiation (气泡类型区分) ✅
- Single chat: Light blue theme (`chat-single`)
- Group chat: Light green theme (`chat-group`)
- Group chat shows visual indicator badge
- Different colors for dark mode

### 4. Streaming Output (流式输出) ✅
- Support via `isStreaming` property
- Character-by-character display (30ms per character)
- Animated blinking cursor during streaming
- Adjusts display duration based on content length

### 5. Message Queue (消息队列) ✅
- Maximum configurable (default: 10 messages)
- Each message displays for configurable duration (default: 5000ms)
- Auto-advances through queue
- Fades out after last message
- Resets to beginning for next batch

### 6. Click to Open Dialog (点击打开对话框) ✅
- Click handler on entire bubble
- Calls `onOpenDialog` callback
- Visual hover feedback (scale effect)
- Title attribute for accessibility

## Integration

### CharacterWindow Integration

The ChatBubble is integrated into CharacterWindow:

```tsx
import { ChatBubble } from '@/components/ChatBubble';

// In JSX:
<ChatBubble onOpenDialog={handleOpenDialog} />
```

### MessageStore Integration

Updated messageStore to support chat properties:

```typescript
export interface Message {
  // ... existing properties
  chatType?: ChatType; // 'single' | 'group'
  isStreaming?: boolean;
}
```

## Usage Example

```tsx
import { ChatBubble } from '@/components/ChatBubble';
import { useMessageStore } from '@/stores/messageStore';

function MyComponent() {
  const addMessage = useMessageStore((s) => s.addMessage);

  const handleOpenDialog = () => {
    // Open dialog panel
  };

  // Add a message
  addMessage({
    content: 'Hello, world!',
    type: 'chat',
    sender: 'assistant',
    duration: 5000,
    chatType: 'single',
    isStreaming: true, // Enable streaming effect
  });

  return (
    <ChatBubble
      onOpenDialog={handleOpenDialog}
      maxQueueSize={10}
      messageDuration={5000}
    />
  );
}
```

## Styling Details

### Comic-Style Design
- Rounded rectangle body (border-radius: 16px)
- Bold border (2.5px) for comic feel
- Slight rotation (-3deg) for dynamic appearance
- Triangular pointer at bottom-right

### Colors
- **Single Chat (Light Mode)**: Light blue gradient (#e3f2fd to #bbdefb)
- **Group Chat (Light Mode)**: Light green gradient (#e8f5e9 to #c8e6c9)
- **Dark Mode**: Deeper color variants with white text

### Animations
- **Fade In**: 0.3s ease-out with slight rotation
- **Fade Out**: 0.2s ease-out
- **Hover**: Scale to 1.05
- **Streaming Cursor**: Blinking animation (0.8s cycle)

## Testing

Run tests with:
```bash
npm test src/components/ChatBubble
```

Test coverage includes:
- Rendering with/without messages
- Chat type differentiation
- Group indicator display
- Click handler
- Message queue advancement
- Title attribute
- Pointer element presence

## Browser Compatibility

- Modern browsers with CSS Grid/Flexbox support
- CSS custom properties for theming
- Backdrop-filter for glass effects (with fallback)

## Performance Considerations

- Uses React hooks for efficient updates
- Cleans up timers properly
- Minimal re-renders through proper dependency management
- Streaming effect uses setInterval for smooth character display

## Future Enhancements

Potential improvements for future iterations:
1. Sound effects for message arrival
2. Custom animation presets
3. Bubble direction (left/right based on sender)
4. Rich content support (images, emojis)
5. Message history navigation
6. Configurable bubble position

## Documentation References

- [Task 12: 3.3.2 聊天气泡](../../../docs/plans/task_1.md#3332-聊天气泡)
- [MessageStore](../../../src/stores/messageStore.ts)
- [CharacterWindow](../../../src/components/CharacterWindow/index.tsx)
