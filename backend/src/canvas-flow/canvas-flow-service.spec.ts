import { HttpException } from '@nestjs/common';
import { CanvasFlowService } from './canvas-flow-service';

const createService = () => new CanvasFlowService({} as any, {} as any, {} as any);

describe('CanvasFlowService version resolution', () => {
  it('uses the active version snapshot by default', () => {
    const service = createService();
    const flow = {
      config: { title: 'draft', steps: [{ id: 'draft' }], edges: [] },
      latestVersion: 2,
      activeVersion: 2,
      versions: [
        { version: 1, config: { title: 'v1', steps: [{ id: 'v1' }], edges: [] } },
        { version: 2, config: { title: 'v2', steps: [{ id: 'v2' }], edges: [] } },
      ],
    };

    const result = service.resolveFlowVersion(flow);

    expect(result.source).toBe('version');
    expect(result.version).toBe(2);
    expect(result.latestVersion).toBe(2);
    expect(result.config.title).toBe('v2');
  });

  it('allows the draft to be requested explicitly', () => {
    const service = createService();
    const flow = {
      config: { title: 'draft', steps: [{ id: 'draft' }], edges: [] },
      latestVersion: 1,
      activeVersion: 1,
      versions: [
        { version: 1, config: { title: 'v1', steps: [{ id: 'v1' }], edges: [] } },
      ],
    };

    const result = service.resolveFlowVersion(flow, 'draft');

    expect(result.source).toBe('draft');
    expect(result.version).toBeUndefined();
    expect(result.activeVersion).toBe(1);
    expect(result.config.title).toBe('draft');
  });

  it('throws when a requested version does not exist', () => {
    const service = createService();
    const flow = {
      config: { title: 'draft', steps: [], edges: [] },
      latestVersion: 1,
      activeVersion: 1,
      versions: [
        { version: 1, config: { title: 'v1', steps: [], edges: [] } },
      ],
    };

    expect(() => service.resolveFlowVersion(flow, 9)).toThrow(HttpException);
  });

  it('returns a cloned config so runtime edits do not mutate snapshots', () => {
    const service = createService();
    const flow = {
      config: { title: 'draft', nested: { value: 1 }, steps: [], edges: [] },
      versions: [],
    };

    const result = service.resolveFlowVersion(flow, 'draft');
    result.config.nested.value = 2;

    expect(flow.config.nested.value).toBe(1);
  });
});

describe('CanvasFlowService agent release snapshots', () => {
  const queryResult = (value: any) => {
    const chain: any = {};
    chain.select = jest.fn(() => chain);
    chain.lean = jest.fn(() => chain);
    chain.exec = jest.fn().mockResolvedValue(value);
    return chain;
  };

  it('returns the snapshot name for each flow version included in a package', async () => {
    const model = {
      find: jest.fn(() => queryResult([{ _id: 'flow-1' }])),
    };
    const agentModel = {
      findOne: jest.fn(() => queryResult({
        agentId: 'Teste_agente',
        organizationId: 'org-1',
        latestRelease: 2,
        releases: [{
          release: 2,
          name: 'Release 2',
          versions: { 'flow-1': 2 },
          flowNames: { 'flow-1': 'Fluxo IA Gen' },
        }],
      })),
    };
    const versionModel = {
      find: jest.fn(() => queryResult([{
        flowId: 'flow-1',
        version: 2,
        name: 'TestLangGraph',
      }])),
    };
    const service = new CanvasFlowService(model as any, agentModel as any, versionModel as any);

    const result = await service.getAgentReleases('Teste_agente', { organizationId: 'org-1' });

    expect(versionModel.find).toHaveBeenCalledWith({
      $or: [{ flowId: 'flow-1', version: 2 }],
      organizationId: 'org-1',
    });
    expect(result.releases[0]).toMatchObject({
      release: 2,
      versions: { 'flow-1': 2 },
      flowNames: { 'flow-1': 'Fluxo IA Gen' },
      versionNames: { 'flow-1': 'TestLangGraph' },
    });
  });
});
