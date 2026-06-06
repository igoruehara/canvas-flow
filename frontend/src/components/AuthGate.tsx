import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Building2, Loader2, LogIn, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react';
import { CANVAS_FLOW_LOGIN_REQUIRED, canvasApi, setCanvasFlowAuthToken } from '../lib/api';
import type { CanvasFlowAuthUser } from '../types/flow';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [loading, setLoading] = useState(true);
  const [loginRequired, setLoginRequired] = useState(CANVAS_FLOW_LOGIN_REQUIRED);
  const [hasUsers, setHasUsers] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'createOrg'>('login');
  const [user, setUser] = useState<CanvasFlowAuthUser | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [newUserMessage, setNewUserMessage] = useState('');
  const [newUserError, setNewUserError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgOwnerName, setNewOrgOwnerName] = useState('');
  const [newOrgOwnerEmail, setNewOrgOwnerEmail] = useState('');
  const [newOrgOwnerPassword, setNewOrgOwnerPassword] = useState('');
  const [newOrgError, setNewOrgError] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const config = await canvasApi.authConfig();
        if (!mounted) return;
        setLoginRequired(config.loginRequired);
        setHasUsers(config.hasUsers);
        setAuthMode(config.hasUsers ? 'login' : 'createOrg');
        if (!config.loginRequired) {
          setLoading(false);
          return;
        }
        try {
          const me = await canvasApi.me();
          if (mounted) setUser(me.user);
        } catch {
          setCanvasFlowAuthToken('');
        }
      } catch (err) {
        if (mounted) setError(err instanceof TypeError ? 'Nao foi possivel conectar ao backend.' : err instanceof Error ? err.message : 'Falha ao carregar login.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const creatingOrganization = !hasUsers || authMode === 'createOrg';
      const result = creatingOrganization
        ? hasUsers
          ? await canvasApi.createOrganization({ organizationName, organizationSlug, name, email, password })
          : await canvasApi.bootstrap({ organizationName, organizationSlug, name, email, password })
        : await canvasApi.login({ email, password, organizationSlug });
      setCanvasFlowAuthToken(result.token);
      setUser(result.user);
      setHasUsers(true);
      setAuthMode('login');
      setPassword('');
    } catch (err) {
      setError(err instanceof TypeError ? 'Nao foi possivel conectar ao backend.' : err instanceof Error ? err.message : 'Nao foi possivel entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    setCanvasFlowAuthToken('');
    setUser(null);
    setAccountOpen(false);
    setCreateUserOpen(false);
    setCreateOrgOpen(false);
    setAuthMode('login');
    setPassword('');
  };

  const switchOrganization = () => {
    logout();
    setOrganizationSlug('');
    setError('');
  };

  const openCreateOrganizationModal = () => {
    setAccountOpen(false);
    setNewOrgName('');
    setNewOrgSlug('');
    setNewOrgOwnerName(user?.name || '');
    setNewOrgOwnerEmail(user?.email || '');
    setNewOrgOwnerPassword('');
    setNewOrgError('');
    setCreateOrgOpen(true);
  };

  const submitNewOrganization = async (event: FormEvent) => {
    event.preventDefault();
    setCreatingOrg(true);
    setNewOrgError('');
    try {
      const result = await canvasApi.createOrganization({
        organizationName: newOrgName,
        organizationSlug: newOrgSlug,
        name: newOrgOwnerName,
        email: newOrgOwnerEmail,
        password: newOrgOwnerPassword,
      });
      setCanvasFlowAuthToken(result.token);
      setUser(result.user);
      setHasUsers(true);
      setCreateOrgOpen(false);
      setNewOrgOwnerPassword('');
    } catch (err) {
      setNewOrgError(err instanceof TypeError ? 'Nao foi possivel conectar ao backend.' : err instanceof Error ? err.message : 'Nao foi possivel criar a organizacao.');
    } finally {
      setCreatingOrg(false);
    }
  };

  const submitNewUser = async (event: FormEvent) => {
    event.preventDefault();
    setCreatingUser(true);
    setNewUserError('');
    setNewUserMessage('');
    try {
      const created = await canvasApi.createOrganizationUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('member');
      setNewUserMessage(`Usuario ${created.email} criado na organizacao.`);
    } catch (err) {
      setNewUserError(err instanceof Error ? err.message : 'Nao foi possivel criar o usuario.');
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-shell">
        <Loader2 className="spin" size={22} />
      </div>
    );
  }

  if (!loginRequired) return <>{children}</>;

  if (user) {
    const canCreateUsers = user.role === 'owner' || user.role === 'admin';
    return (
      <>
        {children}
        <div className="auth-session-menu" onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
            setAccountOpen(false);
          }
        }}>
          <button type="button" className="auth-session-button" onClick={() => setAccountOpen((open) => !open)}>
            <Building2 size={15} />
            <span>{user.organizationSlug || user.organizationName}</span>
          </button>
          {accountOpen && (
            <div className="auth-session-dropdown">
              <div className="auth-session-user">
                <strong>{user.name || user.email}</strong>
                <span>{user.email}</span>
                <small>{user.organizationName} - {user.role}</small>
              </div>
              <button type="button" onClick={openCreateOrganizationModal}>
                <Building2 size={15} />
                Nova organizacao
              </button>
              {canCreateUsers && (
                <button type="button" onClick={() => { setAccountOpen(false); setCreateUserOpen(true); }}>
                  <UserPlus size={15} />
                  Novo usuario
                </button>
              )}
              <button type="button" onClick={switchOrganization}>
                <Building2 size={15} />
                Trocar organizacao
              </button>
              <button type="button" className="danger-button" onClick={logout}>
                <LogOut size={15} />
                Sair
              </button>
            </div>
          )}
        </div>

        {createUserOpen && (
          <div className="modal-backdrop" onMouseDown={() => setCreateUserOpen(false)}>
            <form className="auth-user-modal" onSubmit={submitNewUser} onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Novo usuario</strong>
                  <span>{user.organizationName}</span>
                </div>
                <button type="button" onClick={() => setCreateUserOpen(false)}><X size={16} />Fechar</button>
              </div>
              <label>
                Nome
                <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} required />
              </label>
              <label>
                Email
                <input type="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} required />
              </label>
              <label>
                Senha
                <input type="password" minLength={8} value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} required />
              </label>
              <label>
                Perfil
                <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as 'admin' | 'member')}>
                  <option value="member">Membro</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {newUserError && <div className="auth-error">{newUserError}</div>}
              {newUserMessage && <div className="auth-success">{newUserMessage}</div>}
              <div className="modal-actions">
                <button type="button" onClick={() => setCreateUserOpen(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={creatingUser}>
                  {creatingUser ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />}
                  Criar usuario
                </button>
              </div>
            </form>
          </div>
        )}

        {createOrgOpen && (
          <div className="modal-backdrop" onMouseDown={() => setCreateOrgOpen(false)}>
            <form className="auth-user-modal" onSubmit={submitNewOrganization} onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Nova organizacao</strong>
                  <span>Voce entrara nela como owner.</span>
                </div>
                <button type="button" onClick={() => setCreateOrgOpen(false)}><X size={16} />Fechar</button>
              </div>
              <label>
                Organizacao
                <input value={newOrgName} onChange={(event) => setNewOrgName(event.target.value)} required />
              </label>
              <label>
              Identificador da organizacao
              <input value={newOrgSlug} onChange={(event) => setNewOrgSlug(event.target.value)} placeholder="minha-empresa" />
              <span className="auth-hint">Precisa ser unico. Use algo curto, como o nome da empresa.</span>
            </label>
              <label>
                Seu nome
                <input value={newOrgOwnerName} onChange={(event) => setNewOrgOwnerName(event.target.value)} required />
              </label>
              <label>
                Email
                <input type="email" value={newOrgOwnerEmail} onChange={(event) => setNewOrgOwnerEmail(event.target.value)} required />
              </label>
              <label>
                Senha
                <input type="password" minLength={8} value={newOrgOwnerPassword} onChange={(event) => setNewOrgOwnerPassword(event.target.value)} required />
              </label>
              {newOrgError && <div className="auth-error">{newOrgError}</div>}
              <div className="modal-actions">
                <button type="button" onClick={() => setCreateOrgOpen(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={creatingOrg}>
                  {creatingOrg ? <Loader2 size={15} className="spin" /> : <Building2 size={15} />}
                  Criar organizacao
                </button>
              </div>
            </form>
          </div>
        )}
      </>
    );
  }

  const isCreatingOrganization = !hasUsers || authMode === 'createOrg';

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-title">
          <ShieldCheck size={22} />
          <div>
            <strong>{isCreatingOrganization ? 'Criar organizacao' : 'Login Canvas Flow'}</strong>
            <span>{isCreatingOrganization ? 'Crie uma organizacao e entre como owner.' : 'Entre com seu usuario da organizacao.'}</span>
          </div>
        </div>
        {isCreatingOrganization && (
          <>
            <label>
              Organizacao
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
            </label>
            <label>
              Identificador da organizacao
              <input value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} placeholder="minha-empresa" />
              <span className="auth-hint">Precisa ser unico. Se ficar em branco, sera gerado pelo nome.</span>
            </label>
            <label>
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          </>
        )}
        {!isCreatingOrganization && (
          <label>
            Identificador da organizacao
            <input value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} placeholder="minha-empresa" />
            <span className="auth-hint">Use o identificador unico da organizacao, nao o nome fantasia. Obrigatorio quando seu email existe em mais de uma organizacao.</span>
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />}
          {isCreatingOrganization ? 'Criar e entrar' : 'Entrar'}
        </button>
        {hasUsers && (
          <button
            type="button"
            className="auth-link-button"
            onClick={() => {
              setError('');
              setAuthMode(isCreatingOrganization ? 'login' : 'createOrg');
            }}
          >
            {isCreatingOrganization ? 'Ja tenho uma organizacao' : 'Criar nova organizacao'}
          </button>
        )}
      </form>
    </div>
  );
}
