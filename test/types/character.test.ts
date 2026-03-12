import {
  Assistant,
  Character,
  Appearance,
  Action,
  AppIntegration,
  CharacterIntegration,
  DisplaySlot,
  CreateAssistantDTO,
  CreateCharacterDTO,
  CreateAppearanceDTO,
  CreateActionDTO,
  UpdateAssistantDTO,
  UpdateCharacterDTO,
  UpdateAppearanceDTO,
  generateId,
  isValidCustomId,
  isAction,
  actionTypeValues,
  providerValues,
} from '../../src/types/character';

describe('Character Types - Core Interfaces', () => {
  describe('Action', () => {
    it('should accept valid action data', () => {
      const action: Action = {
        type: 'frames',
        resources: ['frame1.png', 'frame2.png'],
        fps: 24,
        loop: true,
        description: 'Test action',
      };
      expect(action.type).toBe('frames');
      expect(action.resources).toHaveLength(2);
    });

    it('should accept all action types', () => {
      const types: Action['type'][] = ['frames', 'gif', 'live2d', '3d', 'digital_human', 'spritesheet'];
      types.forEach((type) => {
        const action: Action = {
          type,
          resources: [],
          loop: false,
        };
        expect(action.type).toBe(type);
      });
    });

    it('should allow optional fps for non-frames types', () => {
      const action: Action = {
        type: 'gif',
        resources: ['animation.gif'],
        loop: true,
      };
      expect(action.fps).toBeUndefined();
    });

    it('should constrain fps to 1-60 range', () => {
      const validAction: Action = {
        type: 'frames',
        resources: [],
        fps: 30,
        loop: false,
      };
      expect(validAction.fps).toBeGreaterThanOrEqual(1);
      expect(validAction.fps).toBeLessThanOrEqual(60);
    });
  });

  describe('Appearance', () => {
    it('should accept valid appearance data', () => {
      const appearance: Appearance = {
        id: 'appr_casual',
        name: 'Casual',
        isDefault: true,
        description: 'Casual appearance',
        actions: {
          idle: {
            type: 'frames',
            resources: ['idle1.png'],
            loop: true,
          },
        },
      };
      expect(appearance.id).toBe('appr_casual');
      expect(appearance.isDefault).toBe(true);
      expect(Object.keys(appearance.actions)).toHaveLength(1);
    });

    it('should allow multiple actions', () => {
      const appearance: Appearance = {
        id: 'appr_work',
        name: 'Work',
        isDefault: false,
        actions: {
          idle: { type: 'frames', resources: [], loop: true },
          speak: { type: 'gif', resources: ['speak.gif'], loop: false },
        },
      };
      expect(Object.keys(appearance.actions)).toHaveLength(2);
    });
  });

  describe('Character', () => {
    it('should accept valid character data', () => {
      const character: Character = {
        id: 'char_feishu',
        name: 'Feishu Character',
        description: 'For Feishu',
        appearances: [
          {
            id: 'appr_casual',
            name: 'Casual',
            isDefault: true,
            actions: {
              idle: { type: 'frames', resources: [], loop: true },
            },
          },
        ],
      };
      expect(character.id).toBe('char_feishu');
      expect(character.appearances).toHaveLength(1);
    });

    it('should allow multiple appearances', () => {
      const character: Character = {
        id: 'char_work',
        name: 'Work Character',
        appearances: [
          {
            id: 'appr_casual',
            name: 'Casual',
            isDefault: true,
            actions: {},
          },
          {
            id: 'appr_formal',
            name: 'Formal',
            isDefault: false,
            actions: {},
          },
        ],
      };
      expect(character.appearances).toHaveLength(2);
    });
  });

  describe('Assistant', () => {
    it('should accept valid assistant data', () => {
      const assistant: Assistant = {
        id: 'work_assistant',
        name: 'Work Assistant',
        description: 'My work assistant',
        createdAt: Date.now(),
        characters: [
          {
            id: 'char_feishu',
            name: 'Feishu',
            appearances: [
              {
                id: 'appr_casual',
                name: 'Casual',
                isDefault: true,
                actions: {},
              },
            ],
          },
        ],
      };
      expect(assistant.id).toBe('work_assistant');
      expect(assistant.characters).toHaveLength(1);
    });

    it('should allow multiple characters', () => {
      const assistant: Assistant = {
        id: 'personal_assistant',
        name: 'Personal Assistant',
        characters: [
          {
            id: 'char_private',
            name: 'Private',
            appearances: [],
          },
          {
            id: 'char_work',
            name: 'Work',
            appearances: [],
          },
        ],
      };
      expect(assistant.characters).toHaveLength(2);
    });
  });
});

describe('Character Types - Integration Models', () => {
  describe('AppIntegration', () => {
    it('should accept valid app integration', () => {
      const integration: AppIntegration = {
        id: 'a1b2c3d4e5f6g7h8',
        applicationId: 'x9k2m4n6p8q1r3',
        provider: 'openclaw',
        name: 'OpenClaw Instance',
        description: 'Company OpenClaw',
        endpoint: 'ws://192.168.1.1:18790',
        authToken: 'token123',
        enabled: true,
        createdAt: Date.now(),
      };
      expect(integration.provider).toBe('openclaw');
      expect(integration.enabled).toBe(true);
    });

    it('should accept all provider types', () => {
      const providers: AppIntegration['provider'][] = ['openclaw', 'claude', 'chatgpt'];
      providers.forEach((provider) => {
        const integration: AppIntegration = {
          id: 'id12345678901234',
          applicationId: 'app1234567890123',
          provider,
          name: 'Test',
          endpoint: 'ws://localhost',
        };
        expect(integration.provider).toBe(provider);
      });
    });
  });

  describe('CharacterIntegration', () => {
    it('should accept valid character integration', () => {
      const integration: CharacterIntegration = {
        id: 'binding1234567890',
        characterId: 'char_feishu',
        characterName: 'Feishu',
        assistantId: 'work_assistant',
        assistantName: 'Work Assistant',
        integration: {
          integrationId: 'int1234567890123',
          provider: 'openclaw',
          applicationId: 'app1234567890123',
          agentId: 'christina',
          params: { sessionKey: 'key123' },
        },
        enabled: true,
        createdAt: Date.now(),
      };
      expect(integration.characterId).toBe('char_feishu');
      expect(integration.integration.provider).toBe('openclaw');
    });
  });

  describe('DisplaySlot', () => {
    it('should accept valid display slot', () => {
      const slot: DisplaySlot = {
        id: 'slot123456789012',
        assistantId: 'work_assistant',
        assistantName: 'Work Assistant',
        characterId: 'char_feishu',
        characterName: 'Feishu',
        appearanceId: 'appr_casual',
        appearanceName: 'Casual',
        windowId: 'window_001',
        visible: true,
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
      };
      expect(slot.visible).toBe(true);
      expect(slot.position?.x).toBe(100);
    });

    it('should allow optional fields', () => {
      const slot: DisplaySlot = {
        id: 'slot123456789012',
        assistantId: 'work_assistant',
        assistantName: 'Work Assistant',
        characterId: 'char_feishu',
        characterName: 'Feishu',
        appearanceId: 'appr_casual',
        appearanceName: 'Casual',
        visible: false,
      };
      expect(slot.windowId).toBeUndefined();
      expect(slot.position).toBeUndefined();
    });
  });
});

describe('Character Types - DTO Types', () => {
  describe('CreateActionDTO', () => {
    it('should accept valid create action data', () => {
      const dto: CreateActionDTO = {
        type: 'frames',
        resources: ['frame1.png'],
        fps: 24,
        loop: true,
        description: 'New action',
      };
      expect(dto.type).toBe('frames');
    });

    it('should make all fields optional except required ones', () => {
      const dto: CreateActionDTO = {
        type: 'gif',
        resources: ['anim.gif'],
        loop: false,
      };
      expect(dto.fps).toBeUndefined();
      expect(dto.description).toBeUndefined();
    });
  });

  describe('CreateAppearanceDTO', () => {
    it('should accept valid create appearance data', () => {
      const dto: CreateAppearanceDTO = {
        id: 'appr_new',
        name: 'New Appearance',
        isDefault: false,
        description: 'New appearance description',
        actions: {},
      };
      expect(dto.id).toBe('appr_new');
    });
  });

  describe('CreateCharacterDTO', () => {
    it('should accept valid create character data', () => {
      const dto: CreateCharacterDTO = {
        id: 'char_new',
        name: 'New Character',
        description: 'New character description',
      };
      expect(dto.id).toBe('char_new');
    });
  });

  describe('CreateAssistantDTO', () => {
    it('should accept valid create assistant data', () => {
      const dto: CreateAssistantDTO = {
        id: 'assist_new',
        name: 'New Assistant',
        description: 'New assistant description',
      };
      expect(dto.id).toBe('assist_new');
    });
  });

  describe('Update DTOs', () => {
    it('should make all fields optional in update DTOs', () => {
      const updateAssistant: UpdateAssistantDTO = {
        name: 'Updated Name',
      };
      expect(updateAssistant.description).toBeUndefined();

      const updateCharacter: UpdateCharacterDTO = {
        description: 'Updated description',
      };
      expect(updateCharacter.name).toBeUndefined();

      const updateAppearance: UpdateAppearanceDTO = {
        isDefault: true,
      };
      expect(updateAppearance.name).toBeUndefined();
    });
  });
});

describe('Character Types - Utility Functions', () => {
  describe('generateId', () => {
    it('should generate 16-character ID', () => {
      const id = generateId();
      expect(id).toHaveLength(16);
    });

    it('should exclude confusing characters (0OIl)', () => {
      const ids = Array.from({ length: 100 }, () => generateId());
      const allChars = ids.join('');
      expect(allChars).not.toContain('0');
      expect(allChars).not.toContain('O');
      expect(allChars).not.toContain('I');
      expect(allChars).not.toContain('l');
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
      expect(ids.size).toBe(1000);
    });

    it('should only contain alphanumeric characters', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-zA-Z0-9]{16}$/);
    });
  });

  describe('isValidCustomId', () => {
    it('should accept valid custom IDs', () => {
      const validIds = [
        'work_assistant',
        'char-feishu',
        'appr_casual',
        'abc123',
        'test-id_123',
      ];
      validIds.forEach((id) => {
        expect(isValidCustomId(id)).toBe(true);
      });
    });

    it('should reject invalid custom IDs', () => {
      const invalidIds = [
        '', // too short
        'ab', // too short
        'a'.repeat(31), // too long
        'test id', // contains space
        'test.id', // contains dot
        'test@id', // contains @
      ];
      invalidIds.forEach((id) => {
        expect(isValidCustomId(id)).toBe(false);
      });
    });

    it('should enforce minimum length of 3', () => {
      expect(isValidCustomId('ab')).toBe(false);
      expect(isValidCustomId('abc')).toBe(true);
    });

    it('should enforce maximum length of 30', () => {
      expect(isValidCustomId('a'.repeat(30))).toBe(true);
      expect(isValidCustomId('a'.repeat(31))).toBe(false);
    });
  });

  describe('isAction', () => {
    it('should return true for valid Action objects', () => {
      const validAction = {
        type: 'frames' as const,
        resources: ['frame1.png'],
        loop: true,
      };
      expect(isAction(validAction)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      const invalidObjects = [
        null,
        undefined,
        {},
        { type: 'frames' }, // missing required fields
        { type: 'invalid', resources: [], loop: false }, // invalid type
        { type: 'frames', resources: 'not-array', loop: false }, // wrong resources type
      ];
      invalidObjects.forEach((obj) => {
        expect(isAction(obj)).toBe(false);
      });
    });

    it('should accept all valid action types', () => {
      const types: Action['type'][] = ['frames', 'gif', 'live2d', '3d', 'digital_human', 'spritesheet'];
      types.forEach((type) => {
        const action = type === 'spritesheet'
          ? { type, resources: ['sheet.png'], loop: false, spritesheet: { format: 'pixi-json', url: 'sheet.json' } }
          : { type, resources: [], loop: false };
        expect(isAction(action)).toBe(true);
      });
    });
  });

  describe('Type Enums', () => {
    describe('actionTypeValues', () => {
      it('should contain all valid action types', () => {
        expect(actionTypeValues).toContain('frames');
        expect(actionTypeValues).toContain('gif');
        expect(actionTypeValues).toContain('live2d');
        expect(actionTypeValues).toContain('3d');
        expect(actionTypeValues).toContain('digital_human');
        expect(actionTypeValues).toContain('spritesheet');
      });

      it('should have exactly 6 types', () => {
        expect(actionTypeValues).toHaveLength(6);
      });
    });

    describe('providerValues', () => {
      it('should contain all valid provider types', () => {
        expect(providerValues).toContain('openclaw');
        expect(providerValues).toContain('claude');
        expect(providerValues).toContain('chatgpt');
      });

      it('should have exactly 3 providers', () => {
        expect(providerValues).toHaveLength(3);
      });
    });
  });
});
