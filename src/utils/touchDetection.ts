/**
 * DeepJelly Touch Detection Utility
 *
 * Meta-Name: Touch Detection and Zone Identification
 * Meta-Description: Detects touch events and identifies which character zone is being touched.
 */

import type { TouchZone } from '@/config/touchZones';

/**
 * Touch detector for character interaction zones
 * Handles mouse/touch position tracking and zone detection
 */
export class TouchDetector {
  private zones: TouchZone[] = [];
  private characterWidth: number;
  private characterHeight: number;
  private hoveredZone: TouchZone | null = null;

  constructor(characterWidth: number, characterHeight: number) {
    this.characterWidth = characterWidth;
    this.characterHeight = characterHeight;
  }

  /**
   * Set the touch zones for detection
   * @param zones - Array of touch zones to use for detection
   */
  setZones(zones: TouchZone[]): void {
    this.zones = zones;
    this.hoveredZone = null;
  }

  /**
   * Detect which zone is at the given coordinates
   * @param x - X coordinate relative to character (0 to characterWidth)
   * @param y - Y coordinate relative to character (0 to characterHeight)
   * @returns The touched zone if found, undefined otherwise
   */
  detectZone(x: number, y: number): TouchZone | undefined {
    // Check if coordinates are within character bounds
    if (x < 0 || x > this.characterWidth || y < 0 || y > this.characterHeight) {
      return undefined;
    }

    // Find the first zone that contains the point
    return this.zones.find((zone) => this.isPointInZone(x, y, zone));
  }

  /**
   * Update the current mouse/touch position and detect zone
   * @param x - X coordinate relative to character
   * @param y - Y coordinate relative to character
   */
  updateMousePosition(x: number, y: number): void {
    this.hoveredZone = this.detectZone(x, y) || null;
  }

  /**
   * Get the currently hovered zone
   * @returns The hovered zone if any, null otherwise
   */
  getHoveredZone(): TouchZone | null {
    return this.hoveredZone;
  }

  /**
   * Check if a point is within a zone's bounding box
   * @param x - X coordinate to check
   * @param y - Y coordinate to check
   * @param zone - The zone to check against
   * @returns True if the point is within the zone, false otherwise
   */
  isPointInZone(x: number, y: number, zone: TouchZone): boolean {
    const box = zone.boundingBox;
    return (
      x >= box.x &&
      x <= box.x + box.width &&
      y >= box.y &&
      y <= box.y + box.height
    );
  }

  /**
   * Clear the currently hovered zone
   */
  clearHover(): void {
    this.hoveredZone = null;
  }

  /**
   * Get all configured zones
   * @returns Array of all touch zones
   */
  getZones(): TouchZone[] {
    return [...this.zones];
  }
}
