/**
 * SpriteSheet Type Tests
 *
 * Meta-Name: SpriteSheet Type Tests
 * Meta-Description: Tests for spritesheet-related type definitions and validators
 */

import { describe, it, expect } from 'vitest';
import {
  actionTypeValues,
  isAction,
  isSpriteSheetConfig,
} from '../../src/types/character';
import type {
  ActionType,
  Action,
  SpriteSheetConfig,
  SpriteSheetFormat,
} from '../../src/types/character';

describe('ActionType - spritesheet support', () => {
  it('should include spritesheet in actionTypeValues', () => {
    expect(actionTypeValues).toContain('spritesheet');
  });

  it('should accept spritesheet as valid ActionType', () => {
    const type: ActionType = 'spritesheet';
    expect(type).toBe('spritesheet');
  });
});

describe('SpriteSheetConfig type validation', () => {
  const validPixiConfig: SpriteSheetConfig = {
    format: 'pixi-json',
    url: 'sheet.json',
  };

  const validTexturePackerConfig: SpriteSheetConfig = {
    format: 'texture-packer',
    url: 'sheet.json',
    frameNames: ['frame0', 'frame1', 'frame2'],
  };

  const validAsepriteConfig: SpriteSheetConfig = {
    format: 'aseprite',
    url: 'sheet.json',
  };

  const validGridConfig: SpriteSheetConfig = {
    format: 'custom-grid',
    url: 'sheet.png',
    grid: {
      frameWidth: 64,
      frameHeight: 64,
      rows: 4,
      cols: 4,
    },
  };

  it('should validate pixi-json format', () => {
    expect(isSpriteSheetConfig(validPixiConfig)).toBe(true);
  });

  it('should validate texture-packer format', () => {
    expect(isSpriteSheetConfig(validTexturePackerConfig)).toBe(true);
  });

  it('should validate aseprite format', () => {
    expect(isSpriteSheetConfig(validAsepriteConfig)).toBe(true);
  });

  it('should validate custom-grid format', () => {
    expect(isSpriteSheetConfig(validGridConfig)).toBe(true);
  });

  it('should reject invalid grid config (missing required fields)', () => {
    const invalidGrid = {
      format: 'custom-grid' as const,
      url: 'sheet.png',
      grid: {
        frameWidth: 64,
      } as Partial<{ frameWidth: number; frameHeight: number; rows: number; cols: number }>,
    };
    expect(isSpriteSheetConfig(invalidGrid)).toBe(false);
  });
});

describe('Action with spritesheet type', () => {
  it('should accept spritesheet action with custom-grid config', () => {
    const action: Action = {
      type: 'spritesheet',
      resources: ['sheet.png'],
      spritesheet: {
        format: 'custom-grid',
        url: 'sheet.png',
        grid: {
          frameWidth: 64,
          frameHeight: 64,
          rows: 4,
          cols: 4,
        },
      },
      fps: 12,
      loop: true,
    };

    expect(isAction(action)).toBe(true);
  });

  it('should accept spritesheet action with aseprite format', () => {
    const action: Action = {
      type: 'spritesheet',
      resources: ['character.json'],
      spritesheet: {
        format: 'aseprite',
        url: 'character.json',
      },
      fps: 24,
      loop: true,
    };

    expect(isAction(action)).toBe(true);
  });

  it('should reject spritesheet action without spritesheet config', () => {
    const action = {
      type: 'spritesheet' as const,
      resources: ['sheet.png'],
      fps: 12,
      loop: true,
    };

    // This should fail validation because spritesheet config is missing
    expect(isAction(action)).toBe(false);
  });
});

describe('SpriteSheetFormat type', () => {
  it('should support all expected formats', () => {
    const formats: SpriteSheetFormat[] = [
      'pixi-json',
      'texture-packer',
      'aseprite',
      'custom-grid',
    ];

    expect(formats).toHaveLength(4);
  });

  it('should allow format assignment', () => {
    const format1: SpriteSheetFormat = 'pixi-json';
    const format2: SpriteSheetFormat = 'texture-packer';
    const format3: SpriteSheetFormat = 'aseprite';
    const format4: SpriteSheetFormat = 'custom-grid';

    expect(format1).toBe('pixi-json');
    expect(format2).toBe('texture-packer');
    expect(format3).toBe('aseprite');
    expect(format4).toBe('custom-grid');
  });
});
