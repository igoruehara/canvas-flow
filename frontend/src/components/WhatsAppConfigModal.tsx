import { useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, Send } from 'lucide-react';
import type { WhatsappConfig, WhatsappDeliveryMode, WhatsappProvider } from '../types/flow';

interface WhatsAppConfigModalProps {
  whatsapp: WhatsappConfig;
  webhookUrl: string;
  flowSaved: boolean;
  onChange: (patch: Partial<WhatsappConfig>) => void;
  onClose: () => void;
}

function createToken() {
  return `canvas_flow_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function getProviderName(provider: WhatsappProvider) {
  if (provider === 'blip') return 'Blip';
  if (provider === 'sinch') return 'Sinch';
  return 'API Oficial Meta';
}

function getWebhookPostExample(provider: WhatsappProvider, webhookUrl: string) {
  const payload = provider === 'sinch'
    ? {
        message_inbound: {
          message_id: 'sinch-message-id',
          contact_id: 'sinch-contact-id',
          channel_identity: {
            channel: 'WHATSAPP',
            identity: '5511999999999',
          },
          message: {
            text_message: {
              text: 'Oi',
            },
          },
        },
      }
    : provider === 'blip'
      ? {
          message: {
            id: 'blip-message-id',
            from: '5511999999999@wa.gw.msging.net',
            to: 'bot@msging.net',
            type: 'text/plain',
            content: 'Oi',
          },
        }
      : {
          entry: [
            {
              changes: [
                {
                  value: {
                    metadata: {
                      phone_number_id: 'PHONE_NUMBER_ID',
                      display_phone_number: '5511999999999',
                    },
                    messages: [
                      {
                        from: '5511888888888',
                        id: 'wamid.EXAMPLE',
                        timestamp: '1710000000',
                        type: 'text',
                        text: {
                          body: 'Oi',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

  return [
    `POST ${webhookUrl}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

export function WhatsAppConfigModal({ whatsapp, webhookUrl, flowSaved, onChange, onClose }: WhatsAppConfigModalProps) {
  const [copied, setCopied] = useState('');
  const provider = whatsapp.provider || 'meta';
  const deliveryMode = whatsapp.deliveryMode || 'provider';
  const providerName = getProviderName(provider);
  const webhookPostExample = getWebhookPostExample(provider, webhookUrl);

  const changeProvider = (nextProvider: WhatsappProvider) => {
    onChange({
      provider: nextProvider,
      ...(deliveryMode === 'provider' ? { autoReply: true } : {}),
      ...(nextProvider === 'sinch' ? { sinchApiMode: deliveryMode === 'apiResponse' ? 'relay' : 'conversation' } : {}),
    });
  };

  const changeDeliveryMode = (nextMode: WhatsappDeliveryMode) => {
    onChange({
      deliveryMode: nextMode,
      ...(nextMode === 'provider' ? { autoReply: true } : {}),
      ...(provider === 'sinch' ? { sinchApiMode: nextMode === 'apiResponse' ? 'relay' : 'conversation' } : {}),
    });
  };

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="whatsapp-config">
      {!flowSaved && (
        <div className="api-warning">
          Salve o fluxo para gerar uma URL de webhook real. Enquanto isso o exemplo usa <code>&lt;FLOW_ID_SALVO&gt;</code>.
        </div>
      )}

      <section className="whatsapp-card highlight">
        <div className="whatsapp-card-title">
          <KeyRound size={18} />
          <div>
            <strong>Conexao do webhook</strong>
            <span>Use esta URL como entrada de mensagens do provedor escolhido.</span>
          </div>
        </div>

        <label>
          Provedor
          <select value={provider} onChange={(event) => changeProvider(event.target.value as WhatsappProvider)}>
            <option value="meta">API Oficial Meta</option>
            <option value="blip">Blip</option>
            <option value="sinch">Sinch</option>
          </select>
        </label>

        <label>
          Modo de resposta
          <select value={deliveryMode} onChange={(event) => changeDeliveryMode(event.target.value as WhatsappDeliveryMode)}>
            <option value="provider">Enviar direto pelo provedor</option>
            <option value="apiResponse">{provider === 'sinch' ? 'Enviar via API Sinch e retornar payload' : 'Retornar payload na resposta da API'}</option>
          </select>
        </label>

        {deliveryMode === 'apiResponse' && (
          <div className="filter-empty">
            {provider === 'sinch'
              ? 'Use quando o Canvas recebe o webhook e deve responder pela API Sinch usando o payload de repasse. O JSON da resposta tambem traz payload e resultado da entrega.'
              : 'Use quando outro orquestrador ja recebe o webhook. O Canvas Flow executa o fluxo e devolve os payloads prontos no JSON da resposta, sem chamar o provedor.'}
          </div>
        )}

        <label>
          URL de callback
          <div className="copy-field">
            <input value={webhookUrl} readOnly />
            <button onClick={() => copy('webhook', webhookUrl)}>
              {copied === 'webhook' ? <Check size={15} /> : <Copy size={15} />}
              {copied === 'webhook' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </label>

        <div className="webhook-post-disclaimer">
          <div className="webhook-post-header">
            <strong>POST do webhook</strong>
            <button onClick={() => copy('webhook-post', webhookPostExample)}>
              {copied === 'webhook-post' ? <Check size={15} /> : <Copy size={15} />}
              {copied === 'webhook-post' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <span>Envie um POST JSON para esta URL quando chegar mensagem do WhatsApp.</span>
          <pre>{webhookPostExample}</pre>
        </div>

        {provider === 'meta' && (
          <label>
            Palavra token de verificacao
            <div className="copy-field token-field">
              <input value={whatsapp.verifyToken} onChange={(event) => onChange({ verifyToken: event.target.value })} />
              <button onClick={() => onChange({ verifyToken: createToken() })}>
                <RefreshCw size={15} />
                Gerar
              </button>
              <button onClick={() => copy('token', whatsapp.verifyToken)}>
                {copied === 'token' ? <Check size={15} /> : <Copy size={15} />}
                {copied === 'token' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </label>
        )}
      </section>

      <section className="whatsapp-card">
        <div className="whatsapp-card-title">
          <Send size={18} />
          <div>
            <strong>Envio automatico de resposta</strong>
            <span>{providerName}</span>
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={whatsapp.autoReply}
            onChange={(event) => onChange({ autoReply: event.target.checked })}
            disabled={deliveryMode === 'apiResponse'}
          />
          <span>
            {deliveryMode === 'apiResponse'
              ? provider === 'sinch'
                ? 'Resposta sera enviada pela API Sinch e retornada no payload da API'
                : 'Payload de resposta sera retornado pela API'
              : 'Enviar resposta automaticamente pelo provedor selecionado'}
          </span>
        </label>

        {provider === 'meta' && (
          <>
            <label>
              WhatsApp Business Account ID
              <input
                value={whatsapp.businessAccountId || ''}
                placeholder="Ex: 123456789012345"
                onChange={(event) => onChange({ businessAccountId: event.target.value })}
              />
            </label>
            <label>
              Phone Number ID
              <input
                value={whatsapp.phoneNumberId}
                placeholder="Ex: 123456789012345"
                onChange={(event) => onChange({ phoneNumberId: event.target.value })}
              />
            </label>
            <label>
              Access token
              <input
                type="password"
                value={whatsapp.accessToken}
                placeholder="Token permanente ou temporario da Meta"
                onChange={(event) => onChange({ accessToken: event.target.value })}
              />
            </label>
            <label>
              Versao Graph API
              <input
                value={whatsapp.graphApiVersion}
                placeholder="v20.0"
                onChange={(event) => onChange({ graphApiVersion: event.target.value })}
              />
            </label>
          </>
        )}

        {provider === 'blip' && (
          <>
            <label>
              Contract ID
              <input
                value={whatsapp.blipContractId || ''}
                placeholder="Ex: minhaempresa"
                onChange={(event) => onChange({ blipContractId: event.target.value })}
              />
            </label>
            <label>
              Authorization key
              <input
                type="password"
                value={whatsapp.blipAuthorizationKey || ''}
                placeholder="Chave do BLiP HTTP API"
                onChange={(event) => onChange({ blipAuthorizationKey: event.target.value })}
              />
            </label>
          </>
        )}

        {provider === 'sinch' && (
          <>
            {deliveryMode === 'apiResponse' && (
              <>
                <div className="filter-empty">
                  Repasse Sinch: o Canvas recebe pelo webhook, executa o fluxo, monta destinations/message/headers e envia pela API Sinch. A resposta da API tambem retorna o payload usado na entrega.
                </div>
                <label>
                  Numero Sinch
                  <input
                    value={whatsapp.sinchServiceNumber || ''}
                    placeholder="Ex: 5511999999999"
                    onChange={(event) => onChange({ sinchServiceNumber: event.target.value, sinchApiMode: 'relay' })}
                  />
                </label>
                <label>
                  Username do usuario de servico
                  <input
                    value={whatsapp.sinchServiceUsername || ''}
                    placeholder="Usuario de servico Sinch"
                    onChange={(event) => onChange({ sinchServiceUsername: event.target.value, sinchApiMode: 'relay' })}
                  />
                </label>
                <label>
                  Token do usuario de servico
                  <input
                    type="password"
                    value={whatsapp.sinchServiceToken || ''}
                    placeholder="Token Sinch"
                    onChange={(event) => onChange({ sinchServiceToken: event.target.value, sinchApiMode: 'relay' })}
                  />
                </label>
              </>
            )}
            {deliveryMode === 'provider' && (
              <>
                <div className="filter-empty">
                  Envio direto pela Sinch Conversation API. Para repasse via webhook, troque o modo de resposta para retornar payload na API.
                </div>
                <label>
                  Project ID
                  <input
                    value={whatsapp.sinchProjectId || ''}
                    placeholder="Sinch project id"
                    onChange={(event) => onChange({ sinchProjectId: event.target.value, sinchApiMode: 'conversation' })}
                  />
                </label>
                <label>
                  App ID
                  <input
                    value={whatsapp.sinchAppId || ''}
                    placeholder="Conversation API app id"
                    onChange={(event) => onChange({ sinchAppId: event.target.value, sinchApiMode: 'conversation' })}
                  />
                </label>
                <label>
                  Region
                  <input
                    value={whatsapp.sinchRegion || ''}
                    placeholder="us, eu, br"
                    onChange={(event) => onChange({ sinchRegion: event.target.value, sinchApiMode: 'conversation' })}
                  />
                </label>
                <label>
                  Access token
                  <input
                    type="password"
                    value={whatsapp.sinchAccessToken || ''}
                    placeholder="Bearer token da Conversation API"
                    onChange={(event) => onChange({ sinchAccessToken: event.target.value, sinchApiMode: 'conversation' })}
                  />
                </label>
                <label>
                  Canal
                  <input
                    value={whatsapp.sinchChannel || ''}
                    placeholder="WHATSAPP"
                    onChange={(event) => onChange({ sinchChannel: event.target.value, sinchApiMode: 'conversation' })}
                  />
                </label>
              </>
            )}
          </>
        )}
      </section>

      <section className="whatsapp-card">
        <strong>Checklist {providerName}</strong>
        <ol className="whatsapp-steps">
          {provider === 'meta' && (
            <>
              <li>Em Webhooks, informe a URL de callback acima.</li>
              <li>Use a mesma palavra token configurada aqui.</li>
              <li>Assine o campo de mensagens do WhatsApp Business Account.</li>
            </>
          )}
          {provider === 'blip' && (
            <>
              <li>No Blip, configure a entrada HTTP ou webhook apontando para a URL de callback.</li>
              <li>Informe Contract ID e Authorization key para permitir resposta automatica.</li>
            </>
          )}
          {provider === 'sinch' && (
            <>
              <li>Na Sinch, configure inbound message webhooks para a URL de callback quando o Canvas receber direto.</li>
              <li>Use Conversation API para envio direto ou Retornar payload na API quando o cliente ja recebe o webhook e so precisa do repasse.</li>
            </>
          )}
          {deliveryMode === 'apiResponse' && (
            <li>
              {provider === 'sinch'
                ? 'Neste modo, o Canvas Flow envia pela API Sinch e retorna replyPayloads com o payload usado.'
                : 'Neste modo, seu orquestrador chama o Canvas Flow e usa o campo replyPayloads retornado para enviar ao cliente.'}
            </li>
          )}
          <li>Salve o fluxo para persistir a configuracao.</li>
        </ol>
      </section>

      <div className="modal-actions">
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
