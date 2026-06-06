import { LangGraphRuntimeService } from './langgraph-runtime.service';

const createInitialState = () => ({
  runId: 'run-1',
  queue: [{ stepId: 'start', readyAt: 0, delayMs: 0 }],
  completed: [],
  visitCountByStep: {},
  waitingInput: '',
  ended: false,
  safety: 0,
  maxExecutionSteps: 10,
  maxStepVisits: 3,
  activeFlowId: 'flow-1',
  activeFlowName: 'Flow 1',
  clearConversationMemory: false,
  context: {},
  messages: [],
  trace: [],
  traceDropped: 0,
  checkpoints: 0,
  status: 'running' as const,
  updatedAt: new Date().toISOString(),
});

describe('LangGraphRuntimeService', () => {
  const createMongoNetworkError = () => Object.assign(new Error('read ECONNRESET'), { name: 'MongoNetworkError' });

  const createMongoService = (checkpointCreateIndex: jest.Mock) => {
    const writesCreateIndex = jest.fn().mockResolvedValue('writes-index');
    const collections = {
      canvas_langgraph_checkpoints: { createIndex: checkpointCreateIndex },
      canvas_langgraph_checkpoint_writes: { createIndex: writesCreateIndex },
    };
    const client = {
      appendMetadata: jest.fn(),
      db: jest.fn(() => ({
        collection: jest.fn((name: keyof typeof collections) => collections[name]),
      })),
    };
    const databaseConnection = {
      connection: {
        readyState: 1,
        db: { databaseName: 'canvas_flow' },
        getClient: jest.fn(() => client),
      },
    };
    const configService = {
      get: jest.fn((key: string) => ({
        CANVAS_FLOW_LANGGRAPH_CHECKPOINT_TTL_HOURS: '0',
        CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_ATTEMPTS: '2',
        CANVAS_FLOW_LANGGRAPH_CHECKPOINT_INDEX_RETRY_DELAY_MS: '0',
      })[key]),
    };
    return {
      service: new LangGraphRuntimeService(databaseConnection as any, configService as any),
      writesCreateIndex,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a stable isolated thread id for each conversation owner and conversation', () => {
    const service = new LangGraphRuntimeService();
    const scope = {
      organizationId: 'org-1',
      ownerId: 'user-1',
      agentId: 'agent-1',
      entryFlowId: 'flow-1',
      flowId: 'flow-1',
      conversationId: 'conversation-1',
    };

    expect(service.createThreadId(scope)).toBe(service.createThreadId(scope));
    expect(service.createThreadId(scope)).not.toBe(service.createThreadId({ ...scope, ownerId: 'user-2' }));
    expect(service.createThreadId(scope)).not.toBe(service.createThreadId({ ...scope, flowId: 'flow-2' }));
    expect(service.createThreadId(scope)).not.toBe(service.createThreadId({ ...scope, conversationId: 'conversation-2' }));
  });

  it('runs graph ticks with the in-memory fallback when Mongo is unavailable', async () => {
    const service = new LangGraphRuntimeService();
    const result = await service.run({
      threadId: service.createThreadId({
        organizationId: 'org-1',
        ownerId: 'user-1',
        agentId: 'agent-1',
        entryFlowId: 'flow-1',
        flowId: 'flow-1',
        conversationId: 'conversation-1',
      }),
      initialState: createInitialState(),
      executeTick: async (state) => ({
        ...state,
        queue: state.checkpoints === 0 ? [{ stepId: 'finish', readyAt: 0, delayMs: 0 }] : [],
        checkpoints: state.checkpoints + 1,
        status: state.checkpoints === 0 ? 'running' : 'completed',
      }),
    });

    expect(result.runtime).toMatchObject({
      engine: 'langgraph',
      durable: false,
      storage: 'memory',
      checkpoints: 2,
      status: 'completed',
    });
    expect(result.state.queue).toEqual([]);
  });

  it('retries Mongo checkpoint indexes after a transient network reset', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const checkpointCreateIndex = jest.fn()
      .mockRejectedValueOnce(createMongoNetworkError())
      .mockResolvedValue('checkpoint-index');
    const { service, writesCreateIndex } = createMongoService(checkpointCreateIndex);

    const checkpointer = await (service as any).resolveCheckpointer();

    expect(checkpointer).toMatchObject({
      storage: 'mongodb',
      durable: true,
    });
    expect(checkpointCreateIndex).toHaveBeenCalledTimes(2);
    expect(writesCreateIndex).toHaveBeenCalledTimes(2);
  });

  it('uses in-memory checkpoints for the current run when Mongo index retries are exhausted', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const checkpointCreateIndex = jest.fn().mockRejectedValue(createMongoNetworkError());
    const { service } = createMongoService(checkpointCreateIndex);

    const checkpointer = await (service as any).resolveCheckpointer();

    expect(checkpointer).toMatchObject({
      storage: 'memory',
      durable: false,
    });
    expect(checkpointCreateIndex).toHaveBeenCalledTimes(2);
  });
});
