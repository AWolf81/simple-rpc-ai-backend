import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApprovalPermission } from '../../../../../src/utils/settings-manager';
import type { ApprovalResponse, ApprovalRequest } from '../../../../../src/services/agents/skills/utils/approval-manager.ts';

vi.mock('../../../../../src/utils/settings-manager', () => {
  const mockSettingsManager = {
    getAllPermissions: vi.fn(() => []),
    hasApprovalPermission: vi.fn(() => undefined),
    addApprovalPermission: vi.fn(),
    evaluateFileSystemPermission: vi.fn(() => 'unknown')
  };

  const mockGetSettingsManager = vi.fn(() => mockSettingsManager);

  (globalThis as any).__settingsManagerMockStore = {
    mockSettingsManager,
    mockGetSettingsManager
  };

  return {
    getSettingsManager: mockGetSettingsManager,
    resetSettingsManager: vi.fn()
  };
});

const getSettingsManagerMocks = () => {
  const store = (globalThis as any).__settingsManagerMockStore as {
    mockSettingsManager: {
      getAllPermissions: ReturnType<typeof vi.fn>;
      hasApprovalPermission: ReturnType<typeof vi.fn>;
      addApprovalPermission: ReturnType<typeof vi.fn>;
      evaluateFileSystemPermission: ReturnType<typeof vi.fn>;
    };
    mockGetSettingsManager: ReturnType<typeof vi.fn>;
  } | undefined;
  if (!store) {
    throw new Error('Settings manager mock not initialized');
  }
  return store;
};

const getMockSettingsManager = () => getSettingsManagerMocks().mockSettingsManager;
const getMockGetSettingsManager = () => getSettingsManagerMocks().mockGetSettingsManager;

// Import after mocks are registered
// eslint-disable-next-line import/first
import { ApprovalManager } from '../../../../../src/services/agents/skills/utils/approval-manager.ts';

const baseSafetyValidation = {
  blocked: false,
  requiresApproval: true,
  reason: null,
  warnings: []
} as any;

describe('ApprovalManager remembered approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockSettingsManager = getMockSettingsManager();
    const mockGetSettingsManager = getMockGetSettingsManager();

    mockGetSettingsManager.mockReturnValue(mockSettingsManager);
    mockSettingsManager.getAllPermissions.mockReturnValue([]);
    mockSettingsManager.hasApprovalPermission.mockImplementation(() => undefined);
    mockSettingsManager.evaluateFileSystemPermission.mockReturnValue('unknown');
  });

  it('uses persisted allow without invoking approval callback', async () => {
    const persisted: ApprovalPermission = {
      skillName: 'skill.file_handling',
      scriptPath: 'scripts/delete.ts',
      args: ['/tmp/file.txt'],
      approved: true,
      timestamp: Date.now()
    };

    const mockSettingsManager = getMockSettingsManager();
    mockSettingsManager.getAllPermissions.mockReturnValue([persisted]);

    const approvalCallback = vi.fn(async () => ({
      requestId: 'should-not-run',
      approved: false,
      rememberChoice: false,
      timestamp: new Date()
    }));
    const manager = new ApprovalManager(undefined, approvalCallback);

    const approved = await manager.requestSkillExecutionApproval(
      'scripts/delete.ts',
      ['/tmp/file.txt'],
      baseSafetyValidation,
      '/tmp',
      'conv-123',
      'skill.file_handling'
    );

    expect(approved).toBe(true);
    expect(approvalCallback).not.toHaveBeenCalled();
  });

  it('uses persisted deny without invoking approval callback', async () => {
    const persisted: ApprovalPermission = {
      skillName: 'skill.file_handling',
      scriptPath: 'scripts/delete.ts',
      args: ['/tmp/protected.txt'],
      approved: false,
      timestamp: Date.now()
    };

    const mockSettingsManager = getMockSettingsManager();
    mockSettingsManager.getAllPermissions.mockReturnValue([persisted]);

    const approvalCallback = vi.fn(async () => ({
      requestId: 'should-not-run',
      approved: true,
      rememberChoice: false,
      timestamp: new Date()
    }));
    const manager = new ApprovalManager(undefined, approvalCallback);

    const approved = await manager.requestSkillExecutionApproval(
      'scripts/delete.ts',
      ['/tmp/protected.txt'],
      baseSafetyValidation,
      '/tmp',
      'conv-321',
      'skill.file_handling'
    );

    expect(approved).toBe(false);
    expect(approvalCallback).not.toHaveBeenCalled();
  });

  it('persists remember-all approvals and skips future callbacks', async () => {
    const approvalCallback = vi.fn(async () => ({
      requestId: 'approval-1',
      approved: true,
      rememberChoice: true,
      rememberScope: 'all' as const,
      timestamp: new Date()
    }));

    const manager = new ApprovalManager(undefined, approvalCallback);

    const first = await manager.requestSkillExecutionApproval(
      'scripts/delete.ts',
      ['/tmp/first.txt'],
      baseSafetyValidation,
      '/tmp',
      'conv-444',
      'skill.file_handling'
    );

    expect(first).toBe(true);
    expect(approvalCallback).toHaveBeenCalledTimes(1);
    const firstResponse = await approvalCallback.mock.results[0].value;
    expect(firstResponse.rememberScope).toBe('all');
    const mockSettingsManager = getMockSettingsManager();

    expect(mockSettingsManager.addApprovalPermission).toHaveBeenCalledWith(
      'skill.file_handling',
      'scripts/delete.ts',
      ['*'],
      true,
      undefined
    );

    approvalCallback.mockClear();

    const second = await manager.requestSkillExecutionApproval(
      'scripts/delete.ts',
      ['/tmp/another.txt'],
      baseSafetyValidation,
      '/tmp',
      'conv-445',
      'skill.file_handling'
    );

    expect(second).toBe(true);
    expect(approvalCallback).not.toHaveBeenCalled();
  });
});
