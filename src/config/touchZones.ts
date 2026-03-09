/**
 * DeepJelly Touch Zones Configuration
 *
 * Meta-Name: Character Touch Zones Configuration
 * Meta-Description: Defines touch-sensitive zones on the character with associated animations and responses.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TouchZone {
  name: string;
  boundingBox: BoundingBox;
  animation: string;
  responseText: string;
}

/**
 * Touch zones configuration for the 500x500 character
 * Zones are defined with relative coordinates to the character's top-left corner
 */
const TOUCH_ZONES: TouchZone[] = [
  {
    name: 'head',
    boundingBox: {
      x: 150, // Center horizontally (500 - 200) / 2
      y: 50, // Top area
      width: 200,
      height: 150,
    },
    animation: 'emotion.happy',
    responseText: 'Hehe~',
  },
  {
    name: 'body',
    boundingBox: {
      x: 125, // Center horizontally (500 - 250) / 2
      y: 200, // Center area
      width: 250,
      height: 200,
    },
    animation: 'emotion.laugh',
    responseText: 'That tickles!',
  },
  {
    name: 'hand',
    boundingBox: {
      x: 175, // Center horizontally (500 - 150) / 2
      y: 400, // Bottom area
      width: 150,
      height: 80,
    },
    animation: 'social.high_five',
    responseText: 'High five!',
  },
];

/**
 * Get all touch zones
 * @returns Array of all configured touch zones
 */
export function getTouchZones(): TouchZone[] {
  return [...TOUCH_ZONES];
}

/**
 * Get a specific zone by name
 * @param name - The name of the zone to retrieve
 * @returns The touch zone if found, undefined otherwise
 */
export function getZoneByName(name: string): TouchZone | undefined {
  return TOUCH_ZONES.find((zone) => zone.name === name);
}

/**
 * Get all zones that trigger a specific animation
 * @param animation - The animation name to filter by
 * @returns Array of zones that use the specified animation
 */
export function getZonesForAnimation(animation: string): TouchZone[] {
  return TOUCH_ZONES.filter((zone) => zone.animation === animation);
}
