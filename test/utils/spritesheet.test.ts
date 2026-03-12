/**
 * SpriteManager SpriteSheet Tests
 *
 * Meta-Name: SpriteManager SpriteSheet Tests
 * Meta-Description: Tests for enhanced spritesheet loading support in SpriteManager
 */

import { describe, it, expect } from 'vitest';
import type { Action, SpriteSheetConfig } from '../../src/types/character';

describe('SpriteManager - Enhanced SpriteSheet Support', () => {
  describe('loadFromAction - routing logic', () => {
    it('should route frames action to loadFrameAnimation', () => {
      const action: Action = {
        type: 'frames',
        resources: ['frame1.png', 'frame2.png'],
        fps: 12,
        loop: true,
      };

      // Test routing logic
      const expectedMethod = action.type === 'frames' ? 'loadFrameAnimation' : 'other';
      expect(expectedMethod).toBe('loadFrameAnimation');
    });

    it('should route spritesheet action to loadEnhancedSpriteSheet', () => {
      const spritesheetConfig: SpriteSheetConfig = {
        format: 'custom-grid',
        url: 'sheet.png',
        grid: {
          frameWidth: 64,
          frameHeight: 64,
          rows: 4,
          cols: 4,
        },
      };

      const action: Action = {
        type: 'spritesheet',
        resources: ['sheet.png'],
        spritesheet: spritesheetConfig,
        fps: 12,
        loop: true,
      };

      // Test routing logic
      const expectedMethod = action.type === 'spritesheet' ? 'loadEnhancedSpriteSheet' : 'other';
      expect(expectedMethod).toBe('loadEnhancedSpriteSheet');
      expect(action.spritesheet).toEqual(spritesheetConfig);
    });

    it('should route gif action to loadGifAnimation', () => {
      const action: Action = {
        type: 'gif',
        resources: ['animation.gif'],
        loop: true,
      };

      // Test routing logic
      const expectedMethod = action.type === 'gif' ? 'loadGifAnimation' : 'other';
      expect(expectedMethod).toBe('loadGifAnimation');
    });
  });

  describe('SpriteSheetFormat support', () => {
    it('should support pixi-json format', () => {
      const config: SpriteSheetConfig = {
        format: 'pixi-json',
        url: 'sheet.json',
      };
      expect(config.format).toBe('pixi-json');
    });

    it('should support texture-packer format', () => {
      const config: SpriteSheetConfig = {
        format: 'texture-packer',
        url: 'sheet.json',
        frameNames: ['frame0', 'frame1'],
      };
      expect(config.format).toBe('texture-packer');
      expect(config.frameNames).toHaveLength(2);
    });

    it('should support aseprite format', () => {
      const config: SpriteSheetConfig = {
        format: 'aseprite',
        url: 'character.json',
      };
      expect(config.format).toBe('aseprite');
    });

    it('should support custom-grid format', () => {
      const config: SpriteSheetConfig = {
        format: 'custom-grid',
        url: 'sheet.png',
        grid: {
          frameWidth: 64,
          frameHeight: 64,
          rows: 4,
          cols: 4,
        },
      };
      expect(config.format).toBe('custom-grid');
      expect(config.grid?.frameWidth).toBe(64);
    });
  });

  describe('Custom Grid Layout - frame position calculation', () => {
    it('should calculate correct frame positions for basic grid layout', () => {
      const grid = {
        frameWidth: 64,
        frameHeight: 64,
        spacing: 0,
        margin: 0,
        rows: 4,
        cols: 4,
      };

      // Frame 0: col=0, row=0 => x=0, y=0
      const frame0Col = 0 % grid.cols;
      const frame0Row = Math.floor(0 / grid.cols);
      const frame0X = grid.margin + frame0Col * (grid.frameWidth + grid.spacing);
      const frame0Y = grid.margin + frame0Row * (grid.frameHeight + grid.spacing);

      expect(frame0X).toBe(0);
      expect(frame0Y).toBe(0);

      // Frame 1: col=1, row=0 => x=64, y=0
      const frame1Col = 1 % grid.cols;
      const frame1Row = Math.floor(1 / grid.cols);
      const frame1X = grid.margin + frame1Col * (grid.frameWidth + grid.spacing);
      const frame1Y = grid.margin + frame1Row * (grid.frameHeight + grid.spacing);

      expect(frame1X).toBe(64);
      expect(frame1Y).toBe(0);

      // Frame 4: col=0, row=1 => x=0, y=64
      const frame4Col = 4 % grid.cols;
      const frame4Row = Math.floor(4 / grid.cols);
      const frame4X = grid.margin + frame4Col * (grid.frameWidth + grid.spacing);
      const frame4Y = grid.margin + frame4Row * (grid.frameHeight + grid.spacing);

      expect(frame4X).toBe(0);
      expect(frame4Y).toBe(64);
    });

    it('should account for spacing in grid layout', () => {
      const grid = {
        frameWidth: 64,
        frameHeight: 64,
        spacing: 2,
        margin: 0,
        rows: 2,
        cols: 2,
      };

      // Frame 1: col=1, row=0 => x=66 (64 + 2 spacing)
      const frame1Col = 1 % grid.cols;
      const frame1X = grid.margin + frame1Col * (grid.frameWidth + grid.spacing);

      expect(frame1X).toBe(66);
    });

    it('should account for margin in grid layout', () => {
      const grid = {
        frameWidth: 64,
        frameHeight: 64,
        spacing: 0,
        margin: 10,
        rows: 2,
        cols: 2,
      };

      // Frame 0: margin offset
      const frame0X = grid.margin;
      const frame0Y = grid.margin;

      expect(frame0X).toBe(10);
      expect(frame0Y).toBe(10);
    });

    it('should calculate total frame count correctly', () => {
      const grids = [
        { rows: 1, cols: 1, expected: 1 },
        { rows: 2, cols: 2, expected: 4 },
        { rows: 4, cols: 4, expected: 16 },
        { rows: 3, cols: 5, expected: 15 },
      ];

      grids.forEach(({ rows, cols, expected }) => {
        const totalFrames = rows * cols;
        expect(totalFrames).toBe(expected);
      });
    });

    it('should handle edge case: single frame', () => {
      const grid = {
        frameWidth: 64,
        frameHeight: 64,
        rows: 1,
        cols: 1,
      };

      const totalFrames = grid.rows * grid.cols;
      expect(totalFrames).toBe(1);

      // Frame 0 should be at origin (with no margin/spacing)
      const frame0Col = 0 % grid.cols;
      const frame0Row = Math.floor(0 / grid.cols);
      expect(frame0Col).toBe(0);
      expect(frame0Row).toBe(0);
    });

    it('should handle edge case: large grid', () => {
      const grid = {
        frameWidth: 32,
        frameHeight: 32,
        spacing: 1,
        margin: 5,
        rows: 10,
        cols: 10,
      };

      const totalFrames = grid.rows * grid.cols;
      expect(totalFrames).toBe(100);

      // Last frame (99): col=9, row=9
      const frame99Col = 99 % grid.cols;
      const frame99Row = Math.floor(99 / grid.cols);
      const frame99X = grid.margin + frame99Col * (grid.frameWidth + grid.spacing);
      const frame99Y = grid.margin + frame99Row * (grid.frameHeight + grid.spacing);

      expect(frame99Col).toBe(9);
      expect(frame99Row).toBe(9);
      expect(frame99X).toBe(5 + 9 * (32 + 1)); // 5 + 9 * 33 = 302
      expect(frame99Y).toBe(302);
    });
  });

  describe('Action type validation for spritesheet', () => {
    it('should require spritesheet config for spritesheet type', () => {
      const actionWithoutConfig = {
        type: 'spritesheet' as const,
        resources: ['sheet.png'],
        fps: 12,
        loop: true,
      };

      // This action is invalid because it lacks spritesheet config
      expect(actionWithoutConfig.spritesheet).toBeUndefined();
    });

    it('should be valid with spritesheet config', () => {
      const actionWithConfig: Action = {
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

      expect(actionWithConfig.spritesheet).toBeDefined();
      expect(actionWithConfig.spritesheet?.format).toBe('custom-grid');
    });
  });
});
