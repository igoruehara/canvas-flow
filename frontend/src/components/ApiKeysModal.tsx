import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Loader2, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { canvasApi, hasCanvasFlowAuthToken } from '../lib/api';
import type { CanvasFlowApiKeyRecord, CreatedCanvasFlowApiKey } from '../types/flow';

type ApiKeyScope = 'global' | 'flow';

interface ApiKeysModalProps {
  flowId?: string;
  flowName: string;
  agentId?: string;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getKeyScopeLabel(key: CanvasFlowApiKeyRecord) {
  return key.flowId ? 'Fluxo' : 'Todos';
}

export function ApiKeysModal({ flowId, flowName, agentId }: ApiKeysModalProps) {
  const [keys, setKeys] = useState<CanvasFlowApiKeyRecord[]>([]);
  const [scope, setScope] = useState<ApiKeyScope>(flowId ? 'flow' : 'global');
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createdKey, setCreatedKey] = useState<CreatedCanvasFlowApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CanvasFlowApiKeyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaultName = useMemo(() => {
    if (scope === 'flow') return `Chave - ${flowName || 'fluxo'}`;
    return 'Chave global Canvas Flow';
  }, [flowName, scope]);

  const loadKeys = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await canvasApi.listApiKeys(flowId ? { flowId } : undefined);
      setKeys(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as chaves.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKeys();
  }, [flowId]);

  const createKey = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim() || defaultName,
        flowId: scope === 'flow' ? flowId : undefined,
        agentId: scope === 'flow' ? agentId : undefined,
        expiresAt: expiresAt || undefined,
      };
      const result = await canvasApi.createApiKey(payload);
      setCreatedKey(result);
      setName('');
      setExpiresAt('');
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a chave.');
    } finally {
      setSaving(false);
    }
  };

  const revokeKey = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await canvasApi.revokeApiKey(id);
      setRevokeTarget(null);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível revogar a chave.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="api-keys-shell">
      <div className="api-keys-intro">
        <div>
          <strong><ShieldCheck size={17} /> Chaves de consumo</strong>
          <p>Gere uma chave global ou limitada ao fluxo atual. Depois de criada, a chave completa aparece uma unica vez.</p>
        </div>
        <button type="button" onClick={() => void loadKeys()} disabled={loading}>
          {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
          Atualizar
        </button>
      </div>

      {!hasCanvasFlowAuthToken() && (
        <div className="api-keys-warning">
          Configure <code>VITE_CANVAS_FLOW_API_TOKEN</code> no frontend com o token master para gerenciar chaves por esta tela.
        </div>
      )}

      {error && <div className="api-keys-error">{error}</div>}

      {createdKey && (
        <div className="api-keys-created">
          <div>
            <strong><CheckCircle2 size={16} /> Chave criada</strong>
            <p>Guarde este valor agora. Depois ele não será exibido novamente.</p>
          </div>
          <div className="created-key-row">
            <code>{createdKey.token}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(createdKey.token)}>
              <Copy size={15} />
              Copiar
            </button>
          </div>
        </div>
      )}

      <div className="api-keys-create">
        <div className="api-key-form-grid">
          <label>
            Nome
            <input value={name} placeholder={defaultName} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Escopo
            <select value={scope} onChange={(event) => setScope(event.target.value as ApiKeyScope)}>
              <option value="global">Todos os fluxos</option>
              <option value="flow" disabled={!flowId}>Somente este fluxo</option>
            </select>
          </label>
          <label>
            Expira em
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </label>
        </div>
        {scope === 'flow' && !flowId && (
          <div className="api-keys-warning">Salve o fluxo antes de criar uma chave limitada a ele.</div>
        )}
        <button type="button" className="primary-button" onClick={createKey} disabled={saving || (scope === 'flow' && !flowId)}>
          {saving ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
          Gerar chave
        </button>
      </div>

      <div className="api-keys-list">
        <div className="api-keys-list-header">
          <strong>Chaves criadas</strong>
          <span>{keys.length}</span>
        </div>
        {loading && <div className="api-keys-empty">Carregando chaves...</div>}
        {!loading && !keys.length && <div className="api-keys-empty">Nenhuma chave criada ainda.</div>}
        {!loading && keys.map((key) => (
          <div className={`api-key-row ${key.active ? '' : 'api-key-row-disabled'}`} key={key._id}>
            <div className="api-key-row-main">
              <strong>{key.name}</strong>
              <span>
                {getKeyScopeLabel(key)} · {key.tokenPrefix}... · usos {key.totalUses || 0}
              </span>
              <small>
                Criada {formatDate(key.createdAt)} · Ultimo uso {formatDate(key.lastUsedAt)}
                {key.expiresAt ? ` · Expira ${formatDate(key.expiresAt)}` : ''}
              </small>
            </div>
            <div className="api-key-row-actions">
              <span className={key.active ? 'status-pill active' : 'status-pill revoked'}>
                {key.active ? 'Ativa' : 'Revogada'}
              </span>
              {key.active && (
                <button type="button" className="danger-button compact-danger-button" onClick={() => setRevokeTarget(key)} disabled={saving}>
                  <Trash2 size={14} />
                  Revogar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {revokeTarget && (
        <div className="api-keys-revoke-confirm">
          <div>
            <strong>Revogar chave?</strong>
            <p>A chave <b>{revokeTarget.name}</b> deixara de consumir qualquer fluxo imediatamente.</p>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setRevokeTarget(null)}>Cancelar</button>
            <button type="button" className="danger-button" onClick={() => void revokeKey(revokeTarget._id)} disabled={saving}>
              <Trash2 size={15} />
              Revogar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
