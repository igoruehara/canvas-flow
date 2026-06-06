import { useEffect, useState } from 'react';
import { Bot, Check, Copy, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import type { WebWidgetConfig, WidgetPosition } from '../types/flow';

interface WebWidgetPreviewModalProps {
  widget: WebWidgetConfig;
  embedCode: string;
  onChange: (patch: Partial<WebWidgetConfig>) => void;
  onClose: () => void;
}

function clampAvatarText(value: string) {
  return value.slice(0, 3).toUpperCase();
}

export function WebWidgetPreviewModal({ widget, embedCode, onChange, onClose }: WebWidgetPreviewModalProps) {
  const [previewOpen, setPreviewOpen] = useState(widget.openByDefault);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPreviewOpen(widget.openByDefault);
  }, [widget.openByDefault]);

  const update = (patch: Partial<WebWidgetConfig>) => onChange(patch);
  const sideClass = widget.position === 'left' ? 'left' : 'right';

  const copyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="widget-preview-shell">
      <div className="widget-controls">
        <div className="widget-embed-card">
          <div>
            <strong>Embed do widget</strong>
            <p>Copie o código com a configuração visual atual.</p>
          </div>
          <button className="primary-button" onClick={copyEmbed}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copiado' : 'Copiar embed'}
          </button>
        </div>

        <div className="widget-control-section">
          <strong>Aparencia</strong>
          <label>
            Cor principal
            <div className="widget-color-row">
              <input
                aria-label="Cor principal"
                type="color"
                value={widget.primaryColor}
                onChange={(event) => update({ primaryColor: event.target.value })}
              />
              <input value={widget.primaryColor} onChange={(event) => update({ primaryColor: event.target.value })} />
            </div>
          </label>
          <label>
            Cor de destaque
            <div className="widget-color-row">
              <input
                aria-label="Cor de destaque"
                type="color"
                value={widget.accentColor}
                onChange={(event) => update({ accentColor: event.target.value })}
              />
              <input value={widget.accentColor} onChange={(event) => update({ accentColor: event.target.value })} />
            </div>
          </label>
          <label>
            Posicao
            <select value={widget.position} onChange={(event) => update({ position: event.target.value as WidgetPosition })}>
              <option value="right">Direita</option>
              <option value="left">Esquerda</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={widget.openByDefault}
              onChange={(event) => update({ openByDefault: event.target.checked })}
            />
            <span>Manter aberto ao carregar</span>
          </label>
        </div>

        <div className="widget-control-section">
          <strong>Conteudo</strong>
          <label>
            Nome do assistente
            <input value={widget.assistantName} onChange={(event) => update({ assistantName: event.target.value })} />
          </label>
          <label>
            Subtítulo
            <input value={widget.subtitle} onChange={(event) => update({ subtitle: event.target.value })} />
          </label>
          <label>
            Mensagem inicial
            <textarea rows={3} value={widget.welcomeMessage} onChange={(event) => update({ welcomeMessage: event.target.value })} />
          </label>
          <label>
            Placeholder
            <input value={widget.placeholder} onChange={(event) => update({ placeholder: event.target.value })} />
          </label>
          <div className="widget-two-fields">
            <label>
              Balao
              <input value={widget.bubbleLabel} onChange={(event) => update({ bubbleLabel: event.target.value })} />
            </label>
            <label>
              Avatar
              <input
                value={widget.avatarText}
                onChange={(event) => update({ avatarText: clampAvatarText(event.target.value) })}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="widget-site-preview">
        <div className="widget-site-frame">
          <header className="widget-site-header">
            <div>
              <strong>Site do cliente</strong>
              <span>Preview responsiva do widget</span>
            </div>
            <nav>
              <span>Produtos</span>
              <span>Precos</span>
              <span>Contato</span>
            </nav>
          </header>
          <main className="widget-site-content">
            <section>
              <span>Atendimento</span>
              <h2>Experiência de conversa no site</h2>
              <p>Veja o estado inicial, abertura do chat, cores e microcopy como o visitante encontraria em producao.</p>
            </section>
            <div className="widget-site-card">
              <Sparkles size={18} />
              <strong>Widget configurado no fluxo</strong>
              <p>Canal Web Widget usa este visual quando publicado no site do cliente.</p>
            </div>
          </main>

          <div className={`web-widget-preview ${sideClass}`}>
            {previewOpen && (
              <div className="web-widget-window" style={{ ['--widget-primary' as string]: widget.primaryColor, ['--widget-accent' as string]: widget.accentColor }}>
                <div className="web-widget-header">
                  <div className="web-widget-avatar">{widget.avatarText || 'IA'}</div>
                  <div>
                    <strong>{widget.assistantName || 'Assistente IA'}</strong>
                    <span>{widget.subtitle || 'Online'}</span>
                  </div>
                  <button aria-label="Fechar preview" onClick={() => setPreviewOpen(false)}>
                    <X size={16} />
                  </button>
                </div>
                <div className="web-widget-messages">
                  <div className="web-widget-day">Hoje</div>
                  <div className="web-widget-bubble assistant">
                    <Bot size={14} />
                    <p>{widget.welcomeMessage || 'Ola! Como posso ajudar?'}</p>
                  </div>
                  <div className="web-widget-quick-replies">
                    <button>Falar com atendimento</button>
                    <button>Consultar pedido</button>
                  </div>
                  <div className="web-widget-bubble user">
                    <p>Quero tirar uma duvida.</p>
                  </div>
                  <div className="web-widget-bubble assistant compact">
                    <p>Claro. Me conte o que você precisa.</p>
                  </div>
                </div>
                <div className="web-widget-input">
                  <input value="" readOnly placeholder={widget.placeholder || 'Digite sua mensagem'} />
                  <button aria-label="Enviar preview">
                    <Send size={17} />
                  </button>
                </div>
              </div>
            )}

            <button
              className={`web-widget-launcher ${previewOpen ? 'open' : ''}`}
              style={{ ['--widget-primary' as string]: widget.primaryColor, ['--widget-accent' as string]: widget.accentColor }}
              onClick={() => setPreviewOpen((current) => !current)}
            >
              <MessageCircle size={22} />
              {!previewOpen && widget.bubbleLabel && <span>{widget.bubbleLabel}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="modal-actions widget-preview-actions">
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
