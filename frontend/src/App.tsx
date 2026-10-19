import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Boxes,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList,
  Fuel, Gauge, LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Settings,
  ShieldCheck, SlidersHorizontal, Sun, Truck, Wrench, X,
} from 'lucide-react'
const FleetCostChart = lazy(() => import('./FleetCostChart'))

const API = '/api/v1'
type User = { id: number; username: string; full_name: string; role: 'admin' | 'operator' }
type Item = { id: number; sku: string | null; name: string; category: string | null; unit: string; minimum_stock: number; current_unit_cost: number | null; last_supplier?: string | null; balance: number; low_stock: boolean }
type Vehicle = { id: number; name: string; plate: string; model: string | null; fuel_type: string | null; initial_odometer: number; is_active: boolean }
type PurchaseSchedule = { id: number; supplier_name: string; recurrence_days: number; next_due_date: string; last_completed_date: string | null; days_until_due: number; notes: string | null }
type Dashboard = { stock_alerts: { id: number; name: string; unit: string; balance: number; minimum_stock: number; shortage: number }[]; purchase_routines: PurchaseSchedule[]; active_vehicles: number }
type ReportRow = { vehicle_id: number; vehicle: string; plate: string; fuel_amount: number; liters: number; distance_km: number; maintenance_cost: number; total_cost: number; km_per_liter: number | null; cost_per_km: number | null; fuel_records: { id: number; occurred_on: string; liters: number; amount: number; odometer: number; km_per_liter: number | null; odometer_warning?: string | null }[] }

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail?.message || body?.detail || 'Não foi possível concluir a operação.')
  }
  return response.status === 204 ? undefined as T : response.json()
}

const money = (v: number | string | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
const number = (v: number | string | null | undefined, digits = 1) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(Number(v || 0))
const dateBR = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)) : '—'
const isoToday = () => new Date().toISOString().slice(0, 10)

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [setup, setSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(() => localStorage.getItem('cpdesk-theme') !== 'light')
  const [collapsed, setCollapsed] = useState(false)
  const [active, setActive] = useState('overview')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [query, setQuery] = useState('')
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('cpdesk-theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    api<{ needs_setup: boolean }>('/auth/setup-status').then(async result => {
      setSetup(result.needs_setup)
      if (!result.needs_setup) {
        try { setUser(await api<User>('/auth/me')) } catch { setUser(null) }
      }
    }).catch(() => setToast('API indisponível. Confirme se o backend está iniciado.')).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!user) return
    api<Dashboard>('/dashboard').then(data => setAlertCount(data.stock_alerts.length)).catch(() => setAlertCount(0))
  }, [user, refresh])
  useEffect(() => { if (toast) { const id = window.setTimeout(() => setToast(''), 4000); return () => window.clearTimeout(id) } }, [toast])

  const notify = useCallback((message: string) => setToast(message), [])
  const mutate = () => { setRefresh(v => v + 1); setModal('') }
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => undefined); setUser(null) }

  if (loading) return <div className="boot-screen"><div className="brand-mark"><Boxes size={22} /></div><span>Preparando seu espaço de trabalho…</span></div>
  if (!user) return <AuthScreen setup={setup} onLogin={u => { setUser(u); setSetup(false) }} notify={notify} />

  const pageTitles: Record<string, string> = { overview: 'Visão geral', stock: 'Estoque', purchases: 'Compras', fleet: 'Frota', reports: 'Relatórios' }
  return <div className={`app-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark"><Boxes size={21} /></div>{!collapsed && <div className="brand-word">cp<span>desk</span><small>GESTÃO OPERACIONAL</small></div>}<button className="icon-button collapse-button" onClick={() => setCollapsed(v => !v)} title="Recolher menu">{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button></div>
      <div className="workspace-switch"><div className="workspace-avatar">CP</div>{!collapsed && <><div className="workspace-label"><b>CPD Central</b><small>Espaço de trabalho</small></div><ChevronDown size={15} /></>}</div>
      <div className="nav-caption">{!collapsed && 'MENU PRINCIPAL'}</div>
      <nav className="main-nav">
        <NavButton active={active === 'overview'} icon={<LayoutDashboard size={18} />} label="Visão geral" collapsed={collapsed} onClick={() => setActive('overview')} />
      <div className="nav-section-label">{!collapsed && 'OPERAÇÃO'}</div>
        <NavButton active={active === 'stock'} icon={<Boxes size={18} />} label="Estoque" collapsed={collapsed} onClick={() => setActive('stock')} />
        <NavButton active={active === 'purchases'} icon={<ClipboardList size={18} />} label="Compras" collapsed={collapsed} onClick={() => setActive('purchases')} />
        <NavButton active={active === 'fleet'} icon={<Truck size={18} />} label="Frota" collapsed={collapsed} onClick={() => setActive('fleet')} />
        <div className="nav-section-label">{!collapsed && 'ANÁLISE'}</div>
        <NavButton active={active === 'reports'} icon={<Activity size={18} />} label="Relatórios" collapsed={collapsed} onClick={() => setActive('reports')} />
      </nav>
      <div className="sidebar-bottom">
        <div className="storage-card">{!collapsed && <><div className="storage-top"><span>Armazenamento local</span><ShieldCheck size={15} /></div><div className="storage-track"><i /></div><div className="storage-caption">Banco de dados protegido</div></>}</div>
        <button className="profile-row" onClick={() => setModal('profile')}><div className="profile-avatar">{user.full_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>{!collapsed && <><span className="profile-name"><b>{user.full_name}</b><small>{user.role === 'admin' ? 'Administrador' : 'Operador'}</small></span><Settings size={16} /></>}</button>
      </div>
    </aside>
    <main className="main-panel">
      <header className="topbar"><div className="crumb"><button className="mobile-menu icon-button"><Menu size={18} /></button><span className="crumb-muted">CPDesk</span><span className="crumb-separator">/</span><b>{pageTitles[active]}</b></div><div className="topbar-actions"><span className="today-pill"><span className="online-dot" /> Sistema online</span><button className="icon-button theme-toggle" onClick={() => setDark(v => !v)} title={dark ? 'Tema claro' : 'Tema escuro'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button notification-button" title="Notificações"><Bell size={18} />{alertCount > 0 && <i />}</button><div className="top-avatar">{user.full_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div></div></header>
      <section className="page-content">
        {active === 'overview' && <Overview key={refresh} onNavigate={setActive} onQuick={setModal} notify={notify} />}
        {active === 'stock' && <Stock key={refresh} query={query} setQuery={setQuery} onQuick={setModal} notify={notify} />}
        {active === 'purchases' && <Purchases key={refresh} query={query} setQuery={setQuery} onQuick={setModal} notify={notify} />}
        {active === 'fleet' && <Fleet key={refresh} query={query} setQuery={setQuery} onQuick={setModal} notify={notify} />}
        {active === 'reports' && <Reports key={refresh} notify={notify} />}
      </section>
    </main>
    {modal && <Modal title={modal === 'profile' ? 'Seu perfil' : modal === 'user' ? 'Adicionar operador' : modal === 'sector' ? 'Novo setor' : modal === 'item' ? 'Novo item no estoque' : modal === 'movement' ? 'Registrar movimentação' : modal === 'purchase' ? 'Nova rotina de compra' : modal === 'vehicle' ? 'Cadastrar veículo' : modal === 'fuel' ? 'Registrar abastecimento' : 'Registrar manutenção'} onClose={() => setModal('')}>
        {modal === 'profile' ? <div className="profile-detail"><div className="profile-avatar large">{user.full_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><h3>{user.full_name}</h3><p>{user.username} · {user.role === 'admin' ? 'Administrador' : 'Operador'}</p>{user.role === 'admin' && <button className="button button-secondary full-width profile-add-user" onClick={() => setModal('user')}><Plus size={15} /> Adicionar operador</button>}<button className="button button-secondary full-width" onClick={logout}><LogOut size={16} /> Sair da conta</button></div> : <ActionForm kind={modal} user={user} notify={notify} onDone={mutate} />}
    </Modal>}
    {toast && <div className="toast"><span className={toast.includes('sucesso') || toast.includes('registrad') || toast.includes('salv') ? 'toast-check' : 'toast-info'}>{toast.includes('sucesso') || toast.includes('registrad') || toast.includes('salv') ? <Check size={15} /> : <CircleHelp size={15} />}</span>{toast}<button onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>
}

function NavButton({ icon, label, active, collapsed, badge, onClick }: { icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; badge?: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}><span className="nav-icon">{icon}</span>{!collapsed && <><span>{label}</span>{badge && <em>{badge}</em>}</>}</button>
}

function AuthScreen({ setup, onLogin, notify }: { setup: boolean; onLogin: (u: User) => void; notify: (s: string) => void }) {
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    const data = new FormData(event.currentTarget)
    const payload = Object.fromEntries(data.entries())
    try {
      const result = await api<{ user: User }>(setup ? '/auth/setup' : '/auth/login', { method: 'POST', body: JSON.stringify(setup ? { ...payload, role: 'admin' } : payload) })
      onLogin(result.user)
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha ao entrar.') } finally { setBusy(false) }
  }
  return <div className="auth-screen"><div className="auth-decoration deco-one"/><div className="auth-decoration deco-two"/><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><Boxes size={23} /></div><div className="brand-word">cp<span>desk</span><small>GESTÃO OPERACIONAL</small></div></div><div className="auth-eyebrow">{setup ? 'PRIMEIRO ACESSO' : 'BEM-VINDO DE VOLTA'}</div><h1>{setup ? 'Vamos preparar seu espaço.' : 'Acesse sua conta.'}</h1><p className="auth-subtitle">{setup ? 'Crie o administrador para começar a organizar suas operações.' : 'Entre com suas credenciais para acessar o painel.'}</p><form onSubmit={submit} className="auth-form">{setup && <label>Nome completo<input name="full_name" autoComplete="name" placeholder="Como devemos chamar você?" required /></label>}<label>Usuário<input name="username" autoComplete="username" placeholder="seu.usuario" required minLength={3} /></label><label>Senha<input name="password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} placeholder={setup ? 'Mínimo de 10 caracteres' : 'Sua senha'} required minLength={setup ? 10 : 1} /></label><button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Aguarde…' : setup ? 'Criar espaço CPDesk' : 'Entrar no CPDesk'}<ChevronRight size={17} /></button></form><div className="auth-foot"><ShieldCheck size={14} /> Acesso protegido · Dados armazenados localmente</div></div><div className="auth-version">CPDESK <span>·</span> GESTÃO OPERACIONAL</div></div>
}

function PageHeading({ eyebrow, title, subtitle, action, actionText, actionIcon, onAction }: { eyebrow: string; title: string; subtitle: string; action?: boolean; actionText?: string; actionIcon?: React.ReactNode; onAction?: () => void }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="button button-primary" onClick={onAction}>{actionIcon || <Plus size={16} />}{actionText}</button>}</div>
}

function Overview({ onNavigate, onQuick, notify }: { onNavigate: (s: string) => void; onQuick: (s: string) => void; notify: (s: string) => void }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [report, setReport] = useState<ReportRow[]>([])
  useEffect(() => { Promise.all([api<Dashboard>('/dashboard'), api<Item[]>('/items'), api<ReportRow[]>('/reports/fleet')]).then(([d, i, r]) => { setData(d); setItems(i); setReport(r) }).catch(e => notify(String(e))) }, [notify])
  const stockAlerts = data?.stock_alerts || []
  const chart = report.map(row => ({ name: row.vehicle.split(' ')[0], gasto: Number(row.fuel_amount) + Number(row.maintenance_cost) }))
  const metrics = [
    { label: 'ITENS CADASTRADOS', value: number(items.length, 0), delta: 'na base de estoque', icon: <Boxes size={18} />, tone: 'blue' },
    { label: 'ALERTAS DE ESTOQUE', value: String(stockAlerts.length).padStart(2, '0'), delta: stockAlerts.length ? 'itens precisam de atenção' : 'tudo dentro do nível', icon: <AlertTriangle size={18} />, tone: stockAlerts.length ? 'amber' : 'green' },
    { label: 'ROTINAS DE COMPRA', value: String(data?.purchase_routines.length || 0).padStart(2, '0'), delta: 'fornecedores programados', icon: <CalendarDays size={18} />, tone: 'violet' },
    { label: 'VEÍCULOS ATIVOS', value: String(data?.active_vehicles || 0).padStart(2, '0'), delta: 'na frota operacional', icon: <Truck size={18} />, tone: 'teal' },
  ]
  return <>
    <PageHeading eyebrow={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toLocaleUpperCase('pt-BR')} title="Bom dia, vamos começar." subtitle="Aqui está o resumo das operações da sua equipe hoje." />
    <div className="metrics-grid">{metrics.map(metric => <div className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><i className={`metric-icon ${metric.tone}`}>{metric.icon}</i></div><div className="metric-value">{metric.value}</div><div className="metric-caption">{metric.delta}</div></div>)}</div>
    <div className="overview-grid">
      <section className="panel fleet-chart-panel"><div className="panel-heading"><div><h2>Custos da frota</h2><p>Resumo por veículo neste período</p></div><button className="select-button" onClick={() => onNavigate('reports')}>Ver relatórios <ChevronRight size={14} /></button></div>{chart.length ? <Suspense fallback={<div className="chart-area" />}><FleetCostChart data={chart} /></Suspense> : <Empty className="chart-empty" icon={<Activity size={22} />} title="Seu resumo de custos aparecerá aqui" text="Cadastre veículos e registre abastecimentos para visualizar os indicadores." />}<div className="chart-foot"><span><i className="legend-dot" /> Custo registrado</span><button onClick={() => onNavigate('fleet')}>Abrir frota <ArrowUpRight size={13} /></button></div></section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Acesso rápido</h2><p>Ações frequentes do seu dia</p></div><SlidersHorizontal size={17} className="panel-tool" /></div><div className="quick-list"><QuickAction icon={<ArrowDownLeft size={17} />} tone="blue" title="Registrar entrada" caption="Atualize o saldo de um item" onClick={() => onQuick('movement')} /><QuickAction icon={<ArrowUpRight size={17} />} tone="amber" title="Registrar consumo" caption="Lance uma saída do estoque" onClick={() => onQuick('movement')} /><QuickAction icon={<CalendarDays size={17} />} tone="violet" title="Planejar compra" caption="Adicione itens à agenda" onClick={() => onQuick('purchase')} /><QuickAction icon={<Fuel size={17} />} tone="teal" title="Novo abastecimento" caption="Registre na frota" onClick={() => onQuick('fuel')} /></div><div className="quick-footer"><button onClick={() => onNavigate('stock')}>Ver todos os módulos <ArrowUpRight size={14} /></button></div></section>
    </div>
    <div className="overview-lower">
      <section className="panel stock-alert-panel"><div className="panel-heading"><div><h2>Estoque em atenção <span className="heading-count">{stockAlerts.length}</span></h2><p>Itens abaixo ou no limite mínimo</p></div><button className="text-link" onClick={() => onNavigate('stock')}>Ver estoque <ChevronRight size={15} /></button></div>{stockAlerts.length ? <div className="alert-list">{stockAlerts.slice(0, 4).map(item => <div className="alert-row" key={item.id}><div className="item-dot">{item.name.slice(0, 1)}</div><div className="alert-item-name"><b>{item.name}</b><small>{number(item.balance)} {item.unit} disponíveis · mínimo {number(item.minimum_stock)} {item.unit}</small></div><span className="shortage-tag">-{number(item.shortage)} {item.unit}</span><button className="replenish-button" onClick={() => onQuick('purchase')}>Repor</button></div>)}</div> : <Empty icon={<Check size={20} />} title="Estoque em dia" text="Nenhum item atingiu o nível mínimo." />}</section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>Agenda de compras</h2><p>Próximas rotinas por fornecedor</p></div><button className="text-link" onClick={() => onNavigate('purchases')}>Ver agenda <ChevronRight size={15} /></button></div><div className="agenda-list">{(data?.purchase_routines || []).slice(0, 4).map(routine => <div className="agenda-row" key={`r${routine.id}`}><div className="agenda-date"><b>{dateBR(routine.next_due_date).split(' ')[0]}</b><small>{dateBR(routine.next_due_date).split(' ')[1]}</small></div><div><b>{routine.supplier_name}</b><small>Rotina a cada {routine.recurrence_days} dias</small></div><span className="agenda-dot blue" /></div>)}{!data?.purchase_routines.length && <Empty icon={<CalendarDays size={20} />} title="Agenda livre" text="Cadastre as rotinas recorrentes dos fornecedores." />}</div></section>
    </div>
    <div className="footer-note"><div className="footer-badge"><ShieldCheck size={15} /></div><span><b>Seus dados, sob seu controle.</b><small>Armazenados localmente e acessíveis apenas pela sua rede.</small></span><button onClick={() => notify('Backup local: configure CPDESK_DATABASE_URL para apontar para o volume de dados do servidor.')}>Sobre segurança <ArrowUpRight size={13} /></button></div>
  </>
}

function QuickAction({ icon, tone, title, caption, onClick }: { icon: React.ReactNode; tone: string; title: string; caption: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className={`quick-icon ${tone}`}>{icon}</span><span><b>{title}</b><small>{caption}</small></span><ChevronRight size={15} className="quick-chevron" /></button>
}

function Empty({ icon, title, text, className = '' }: { icon: React.ReactNode; title: string; text: string; className?: string }) {
  return <div className={`empty-state ${className}`}><div className="empty-icon">{icon}</div><b>{title}</b><span>{text}</span></div>
}

function Stock({ query, setQuery, onQuick, notify }: { query: string; setQuery: (s: string) => void; onQuick: (s: string) => void; notify: (s: string) => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [tab, setTab] = useState('items')
  const load = useCallback(() => Promise.all([api<Item[]>('/items'), api<any[]>('/stock/movements')]).then(([i, m]) => { setItems(i); setMovements(m) }).catch(e => notify(String(e))), [notify])
  useEffect(() => { load() }, [load])
  const filtered = items.filter(i => `${i.name} ${i.sku || ''} ${i.category || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const total = items.reduce((sum, i) => sum + Number(i.balance), 0)
  const low = items.filter(i => i.low_stock).length
  const movementLabel: Record<string, string> = { entry: 'Entrada', exit: 'Consumo', adjustment: 'Ajuste' }
  return <>
    <PageHeading eyebrow="OPERAÇÃO · CONTROLE DE MATERIAIS" title="Estoque" subtitle="Acompanhe saldos, movimentações e necessidades de reposição." action actionText="Novo item" actionIcon={<Plus size={16} />} onAction={() => onQuick('item')} />
    <div className="metrics-grid compact-metrics"><Metric label="ITENS CADASTRADOS" value={number(items.length, 0)} caption="produtos ativos" icon={<Boxes size={17} />} tone="blue" /><Metric label="SALDO TOTAL" value={number(total, 0)} caption="unidades somadas" icon={<Gauge size={17} />} tone="teal" /><Metric label="NO MÍNIMO" value={String(low).padStart(2, '0')} caption={low ? 'requerem reposição' : 'nenhum alerta ativo'} icon={<AlertTriangle size={17} />} tone={low ? 'amber' : 'green'} /><Metric label="MOVIMENTAÇÕES" value={number(movements.length, 0)} caption="lançamentos no histórico" icon={<ArrowLeftRight size={17} />} tone="violet" /></div>
    <div className="panel data-panel"><div className="toolbar"><div className="tab-group"><button className={tab === 'items' ? 'selected' : ''} onClick={() => setTab('items')}>Itens <span>{items.length}</span></button><button className={tab === 'history' ? 'selected' : ''} onClick={() => setTab('history')}>Movimentações <span>{movements.length}</span></button></div><div className="toolbar-actions"><div className="search-box"><Search size={15} /><input placeholder="Buscar item..." value={query} onChange={e => setQuery(e.target.value)} /></div><button className="button button-secondary small-button" onClick={() => onQuick('sector')}><Plus size={14} /> Setor</button><button className="button button-secondary small-button" onClick={() => onQuick('movement')}><ArrowLeftRight size={15} /> Movimentar</button></div></div>
      {tab === 'items' ? <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>CATEGORIA / FORNECEDOR</th><th>SALDO ATUAL</th><th>VALOR UNITÁRIO</th><th>ESTOQUE MÍNIMO</th><th>SITUAÇÃO</th><th></th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><div className="table-item"><span className="table-item-icon">{item.name.slice(0, 1)}</span><span><b>{item.name}</b><small>{item.sku || 'Sem código'} · {item.unit}</small></span></div></td><td>{item.category || '—'}<small className="muted">{item.last_supplier ? ` · ${item.last_supplier}` : ''}</small></td><td><b>{number(item.balance)} <small>{item.unit}</small></b></td><td>{money(item.current_unit_cost)}</td><td>{number(item.minimum_stock)} {item.unit}</td><td><span className={`status-tag ${item.low_stock ? 'warning' : 'good'}`}><i />{item.low_stock ? 'Repor' : 'Adequado'}</span></td><td><button className="row-more" onClick={() => onQuick('movement')}>＋</button></td></tr>)}</tbody></table>{!filtered.length && <Empty icon={<Boxes size={21} />} title="Nenhum item por aqui" text="Cadastre um produto para começar a controlar o estoque." />}</div> : <div className="table-wrap"><table><thead><tr><th>DATA</th><th>ITEM</th><th>TIPO</th><th>QUANTIDADE</th><th>MOTIVO / FORNECEDOR</th><th>SETOR</th><th>RESPONSÁVEL</th></tr></thead><tbody>{movements.map(m => <tr key={m.id}><td>{new Date(m.created_at).toLocaleDateString('pt-BR')}</td><td><b>{items.find(i => i.id === m.item_id)?.name || `Item #${m.item_id}`}</b></td><td><span className={`movement-pill ${m.movement_type}`}>{movementLabel[m.movement_type] || m.movement_type}</span></td><td>{m.signed_quantity > 0 ? '+' : ''}{number(m.signed_quantity)}</td><td>{m.reason}{m.supplier_name && <small className="muted"> · {m.supplier_name}{m.invoice_number ? ` · NF ${m.invoice_number}` : ''}</small>}</td><td>{m.sector_name || '—'}</td><td>{m.responsible_name || '—'}</td></tr>)}</tbody></table>{!movements.length && <Empty icon={<ArrowLeftRight size={21} />} title="Sem movimentações" text="Seus registros de entrada e consumo aparecerão aqui." />}</div>}
    </div><div className="page-footnote"><ShieldCheck size={15} /> O saldo é calculado pelo histórico de movimentações. Nenhum lançamento é apagado; correções são registradas como estornos.</div>
  </>
}

function Metric({ label, value, caption, icon, tone }: { label: string; value: string; caption: string; icon: React.ReactNode; tone: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><i className={`metric-icon ${tone}`}>{icon}</i></div><div className="metric-value">{value}</div><div className="metric-caption">{caption}</div></div>
}

function Purchases({ query, setQuery, onQuick, notify }: { query: string; setQuery: (s: string) => void; onQuick: (s: string) => void; notify: (s: string) => void }) {
  const [schedules, setSchedules] = useState<PurchaseSchedule[]>([])
  const load = useCallback(() => api<PurchaseSchedule[]>('/purchases').then(setSchedules).catch(e => notify(String(e))), [notify])
  useEffect(() => { load() }, [load])
  const today = isoToday()
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const filtered = schedules.filter(row => `${row.supplier_name} ${row.notes || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const dueToday = schedules.filter(row => row.next_due_date === today).length
  const nextSeven = schedules.filter(row => row.next_due_date >= today && row.next_due_date <= weekEnd).length
  async function complete(row: PurchaseSchedule) {
    try { await api(`/purchases/${row.id}/complete`, { method: 'POST', body: JSON.stringify({ completed_on: today }) }); notify('Rotina concluída e próxima data programada.'); load() } catch (e) { notify(String(e)) }
  }
  async function archive(row: PurchaseSchedule) {
    if (!window.confirm(`Arquivar a rotina de ${row.supplier_name}?`)) return
    try { await api(`/purchases/${row.id}/archive`, { method: 'POST' }); notify('Rotina arquivada.'); load() } catch (e) { notify(String(e)) }
  }
  return <>
    <PageHeading eyebrow="OPERAÇÃO · CALENDÁRIO DE FORNECEDORES" title="Compras" subtitle="Organize a frequência de compra e acompanhe as próximas datas por fornecedor." action actionText="Nova rotina" onAction={() => onQuick('purchase')} />
    <div className="metrics-grid compact-metrics"><Metric label="ROTINAS ATIVAS" value={number(schedules.length, 0)} caption="fornecedores programados" icon={<CalendarDays size={17} />} tone="violet" /><Metric label="PREVISTAS PARA HOJE" value={String(dueToday).padStart(2, '0')} caption="rotinas no calendário" icon={<ClipboardList size={17} />} tone="blue" /><Metric label="PRÓXIMOS 7 DIAS" value={String(nextSeven).padStart(2, '0')} caption="datas programadas" icon={<CalendarDays size={17} />} tone="teal" /><Metric label="PERIODICIDADE MÉDIA" value={schedules.length ? `${number(schedules.reduce((sum, row) => sum + row.recurrence_days, 0) / schedules.length, 0)} dias` : '—'} caption="entre fornecedores" icon={<Activity size={17} />} tone="amber" /></div>
    <div className="panel data-panel"><div className="toolbar"><div className="tab-group"><button className="selected">Agenda recorrente <span>{schedules.length}</span></button></div><div className="toolbar-actions"><div className="search-box"><Search size={15} /><input placeholder="Buscar fornecedor..." value={query} onChange={e => setQuery(e.target.value)} /></div></div></div><div className="table-wrap"><table><thead><tr><th>FORNECEDOR</th><th>FREQUÊNCIA</th><th>ÚLTIMA ROTINA</th><th>PRÓXIMA DATA</th><th></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><div className="table-item"><span className="supplier-avatar">{row.supplier_name.slice(0, 1)}</span><span><b>{row.supplier_name}</b><small>{row.notes || 'Compra recorrente'}</small></span></div></td><td>A cada {row.recurrence_days} dias</td><td>{dateBR(row.last_completed_date)}</td><td><b>{dateBR(row.next_due_date)}</b></td><td><div className="row-actions"><button className="mini-action primary-mini" onClick={() => complete(row)}>Registrar rotina</button><button className="mini-action" onClick={() => archive(row)}>Arquivar</button></div></td></tr>)}</tbody></table>{!filtered.length && <Empty icon={<CalendarDays size={21} />} title="Nenhuma rotina encontrada" text="Adicione fornecedores e sua periodicidade para começar a organizar as compras." />}</div></div>
    <div className="page-footnote"><CalendarDays size={15} /> Concluir uma rotina registra a data realizada e calcula automaticamente a próxima data programada.</div>
  </>
}

function Fleet({ query, setQuery, onQuick, notify }: { query: string; setQuery: (s: string) => void; onQuick: (s: string) => void; notify: (s: string) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const load = useCallback(() => Promise.all([api<Vehicle[]>('/vehicles'), api<ReportRow[]>('/reports/fleet')]).then(([v, r]) => { setVehicles(v); setReports(r); if (!selected && v.length) setSelected(v[0].id) }).catch(e => notify(String(e))), [notify, selected])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (selected) api<any[]>(`/vehicles/${selected}/fuel`).then(setHistory).catch(() => setHistory([])) }, [selected, vehicles])
  const filtered = vehicles.filter(v => `${v.name} ${v.plate} ${v.model || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const report = reports.find(r => r.vehicle_id === selected)
  return <>
    <PageHeading eyebrow="OPERAÇÃO · CONTROLE DA FROTA" title="Frota" subtitle="Abastecimentos, manutenção e custos dos veículos operacionais." action actionText="Novo veículo" onAction={() => onQuick('vehicle')} />
    <div className="metrics-grid compact-metrics"><Metric label="VEÍCULOS ATIVOS" value={number(vehicles.filter(v => v.is_active).length, 0)} caption="na frota operacional" icon={<Truck size={17} />} tone="blue" /><Metric label="CUSTO REGISTRADO" value={money(reports.reduce((s, r) => s + Number(r.total_cost), 0))} caption="combustível e manutenção" icon={<Activity size={17} />} tone="violet" /><Metric label="ABASTECIMENTOS" value={number(reports.reduce((s, r) => s + r.fuel_records.length, 0), 0)} caption="lançamentos registrados" icon={<Fuel size={17} />} tone="teal" /><Metric label="MANUTENÇÃO" value={money(reports.reduce((s, r) => s + Number(r.maintenance_cost), 0))} caption="despesas no histórico" icon={<Wrench size={17} />} tone="amber" /></div>
    <div className="fleet-layout"><section className="panel fleet-list-panel"><div className="panel-heading"><div><h2>Veículos</h2><p>Selecione um veículo para ver detalhes</p></div><button className="icon-button" onClick={() => onQuick('vehicle')}><Plus size={17} /></button></div><div className="search-box fleet-search"><Search size={15} /><input placeholder="Buscar veículo..." value={query} onChange={e => setQuery(e.target.value)} /></div><div className="vehicle-list">{filtered.map(v => { const r = reports.find(row => row.vehicle_id === v.id); return <button className={`vehicle-card ${selected === v.id ? 'selected' : ''}`} key={v.id} onClick={() => setSelected(v.id)}><span className="vehicle-icon"><Truck size={19} /></span><span className="vehicle-copy"><b>{v.name}</b><small>{v.plate} · {v.model || 'Modelo não informado'}</small></span><span className="vehicle-cost">{money(r?.total_cost)}<small>total</small></span></button> })}{!filtered.length && <Empty icon={<Truck size={20} />} title="Nenhum veículo" text="Cadastre um veículo para iniciar o controle da frota." />}</div></section>
      {report ? <section className="panel vehicle-detail-panel"><div className="vehicle-detail-head"><div className="vehicle-large-icon"><Truck size={23} /></div><div><div className="eyebrow">FICHA DO VEÍCULO</div><h2>{report.vehicle}</h2><span className="plate-tag">{report.plate}</span></div><div className="vehicle-detail-buttons"><button className="button button-secondary small-button" onClick={() => onQuick('fuel')}><Fuel size={15} /> Abastecer</button><button className="button button-secondary small-button" onClick={() => onQuick('maintenance')}><Wrench size={15} /> Manutenção</button></div></div><div className="vehicle-stats"><div><span>COMBUSTÍVEL</span><b>{money(report.fuel_amount)}</b></div><div><span>CONSUMO MÉDIO</span><b>{report.km_per_liter ? `${number(report.km_per_liter, 2)} <small>km/l</small>` : '—'}</b></div><div><span>DISTÂNCIA</span><b>{number(report.distance_km, 0)} <small>km</small></b></div><div><span>MANUTENÇÃO</span><b>{money(report.maintenance_cost)}</b></div></div><div className="detail-section-title"><div><h3>Histórico de abastecimento</h3><p>Registros de hodômetro e consumo</p></div><Gauge size={17} /></div><div className="fuel-history">{history.slice(-6).reverse().map(row => <div className="fuel-row" key={row.id}><div className="timeline-dot"><Fuel size={13} /></div><div className="fuel-row-main"><b>{dateBR(row.occurred_on)} · {number(row.odometer, 0)} km</b><small>{number(row.liters, 2)} litros{row.odometer_warning ? ` · Aviso: ${row.odometer_warning}` : ''}</small></div><div className="fuel-row-right"><b>{money(row.amount)}</b><small>{row.km_per_liter ? `${number(row.km_per_liter, 2)} km/l` : 'Completar intervalo'}</small></div></div>)}{!history.length && <Empty icon={<Fuel size={20} />} title="Sem abastecimentos" text="Os lançamentos deste veículo aparecerão aqui." />}</div><div className="vehicle-actions-bottom"><button onClick={() => onQuick('fuel')}><Plus size={14} /> Novo abastecimento</button><button onClick={() => onQuick('maintenance')}><Plus size={14} /> Registrar manutenção</button></div></section> : <section className="panel vehicle-detail-panel"><Empty icon={<Truck size={22} />} title="Selecione um veículo" text="Escolha um veículo ou cadastre um novo para acompanhar os detalhes." /></section>}</div>
  </>
}

function Reports({ notify }: { notify: (s: string) => void }) {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [consumption, setConsumption] = useState<any[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const load = useCallback(() => { const params = new URLSearchParams(); if (start) params.set('start', start); if (end) params.set('end', end); Promise.all([api<ReportRow[]>(`/reports/fleet?${params}`), api<any[]>(`/reports/stock-consumption?${params}`)]).then(([fleet, products]) => { setRows(fleet); setConsumption(products) }).catch(e => notify(String(e))) }, [start, end, notify])
  useEffect(() => { load() }, [load])
  const totals = rows.reduce((a, r) => ({ fuel: a.fuel + Number(r.fuel_amount), maintenance: a.maintenance + Number(r.maintenance_cost), total: a.total + Number(r.total_cost), distance: a.distance + Number(r.distance_km) }), { fuel: 0, maintenance: 0, total: 0, distance: 0 })
  function download(format: string) { const params = new URLSearchParams(); if (start) params.set('start', start); if (end) params.set('end', end); window.open(`${API}/reports/fleet.${format}?${params}`, '_blank', 'noopener') }
  function downloadStock(format: string) { const params = new URLSearchParams(); if (start) params.set('start', start); if (end) params.set('end', end); window.open(`${API}/reports/stock-consumption.${format}?${params}`, '_blank', 'noopener') }
  return <><PageHeading eyebrow="ANÁLISE · DESEMPENHO OPERACIONAL" title="Relatórios" subtitle="Acompanhe despesas da frota e consumo de produtos por setor." /><div className="report-controls panel"><div className="date-filter"><label>DE<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><span>—</span><label>ATÉ<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label><button className="button button-secondary small-button" onClick={load}><SlidersHorizontal size={14} /> Aplicar</button></div></div><div className="metrics-grid report-metrics"><Metric label="CUSTO TOTAL" value={money(totals.total)} caption="frota no período" icon={<Activity size={17} />} tone="violet" /><Metric label="COMBUSTÍVEL" value={money(totals.fuel)} caption="abastecimentos ativos" icon={<Fuel size={17} />} tone="blue" /><Metric label="MANUTENÇÃO" value={money(totals.maintenance)} caption="despesas registradas" icon={<Wrench size={17} />} tone="amber" /><Metric label="DISTÂNCIA" value={`${number(totals.distance, 0)} km`} caption="estimativa pelo hodômetro" icon={<Gauge size={17} />} tone="teal" /></div><div className="panel data-panel"><div className="panel-heading report-table-heading"><div><h2>Despesas por veículo</h2><p>Custos de combustível, manutenção e eficiência</p></div><div className="export-actions"><button className="button button-secondary small-button" onClick={() => download('csv')}>CSV</button><button className="button button-secondary small-button" onClick={() => download('pdf')}>PDF</button><button className="button button-primary small-button" onClick={() => download('xlsx')}>Excel</button></div></div><div className="table-wrap"><table><thead><tr><th>VEÍCULO</th><th>COMBUSTÍVEL</th><th>MANUTENÇÃO</th><th>DISTÂNCIA</th><th>CONSUMO</th><th>CUSTO TOTAL</th><th>R$/KM</th></tr></thead><tbody>{rows.map(row => <tr key={row.vehicle_id}><td><div className="report-vehicle"><span className="vehicle-mini-icon"><Truck size={15} /></span><span><b>{row.vehicle}</b><small>{row.plate}</small></span></div></td><td>{money(row.fuel_amount)}</td><td>{money(row.maintenance_cost)}</td><td>{number(row.distance_km, 0)} km</td><td>{row.km_per_liter ? `${number(row.km_per_liter, 2)} km/l` : '—'}</td><td><b>{money(row.total_cost)}</b></td><td>{row.cost_per_km ? money(row.cost_per_km) : '—'}</td></tr>)}</tbody></table>{!rows.length && <Empty icon={<Activity size={20} />} title="Relatório sem dados" text="Registre abastecimentos e manutenções para gerar indicadores." />}</div></div><div className="panel data-panel"><div className="panel-heading report-table-heading"><div><h2>Consumo de produtos</h2><p>Quantidade retirada, setor, responsável e custo estimado</p></div><div className="export-actions"><button className="button button-secondary small-button" onClick={() => downloadStock('pdf')}>PDF</button><button className="button button-primary small-button" onClick={() => downloadStock('xlsx')}>Excel</button></div></div><div className="table-wrap"><table><thead><tr><th>DATA</th><th>CÓDIGO</th><th>PRODUTO</th><th>SETOR</th><th>RESPONSÁVEL</th><th>QUANTIDADE</th><th>CUSTO ESTIMADO</th></tr></thead><tbody>{consumption.map(row => <tr key={row.movement_id}><td>{dateBR(row.date)}</td><td>{row.code || '—'}</td><td><b>{row.item}</b></td><td>{row.sector}</td><td>{row.responsible}</td><td>{number(row.quantity)} {row.unit}</td><td>{money(row.total_cost)}</td></tr>)}</tbody></table>{!consumption.length && <Empty icon={<Boxes size={20} />} title="Sem consumo no período" text="As saídas de estoque aparecerão neste relatório." />}</div></div><div className="page-footnote"><CircleHelp size={15} /> O consumo médio é calculado entre abastecimentos de tanque cheio; registros parciais entram no volume do intervalo. Inconsistências de hodômetro são excluídas do cálculo.</div></>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' } }, [onClose])
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="modal-card"><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></header>{children}</section></div>
}

function ActionForm({ kind, user, notify, onDone }: { kind: string; user: User; notify: (s: string) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [sectors, setSectors] = useState<{ id: number; name: string }[]>([])
  useEffect(() => { if (['movement', 'purchase'].includes(kind)) api<Item[]>('/items').then(setItems).catch(() => undefined); if (['fuel', 'maintenance'].includes(kind)) api<Vehicle[]>('/vehicles').then(setVehicles).catch(() => undefined); if (kind === 'movement') { api<User[]>('/users').then(setUsers).catch(() => undefined); api<{ id: number; name: string }[]>('/sectors').then(setSectors).catch(() => undefined) } }, [kind])
  const title = kind === 'user' ? 'Crie um acesso de operador para alguém da equipe.' : kind === 'sector' ? 'Cadastre um setor para identificar as saídas de estoque.' : kind === 'item' ? 'Cadastre o material para acompanhar saldo e reposição.' : kind === 'movement' ? 'Toda movimentação atualiza o histórico e o saldo do estoque.' : kind === 'purchase' ? 'Organize a frequência de compras de cada fornecedor.' : kind === 'vehicle' ? 'Inclua um veículo na sua frota operacional.' : kind === 'fuel' ? 'Informe os dados do comprovante de abastecimento.' : 'Registre o serviço e, se necessário, a próxima revisão.'
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    const form = new FormData(event.currentTarget)
    const raw = Object.fromEntries(form.entries()) as Record<string, string>
    const decimal = (v: string) => v ? Number(v.replace(',', '.')) : undefined
    try {
      if (kind === 'user') await api('/users', { method: 'POST', body: JSON.stringify({ username: raw.username, full_name: raw.full_name, password: raw.password, role: 'operator' }) })
      if (kind === 'sector') await api('/sectors', { method: 'POST', body: JSON.stringify({ name: raw.name }) })
      if (kind === 'item') await api('/items', { method: 'POST', body: JSON.stringify({ ...raw, minimum_stock: decimal(raw.minimum_stock) || 0, current_unit_cost: decimal(raw.current_unit_cost) }) })
      if (kind === 'movement') {
        const payload = { movement_type: raw.movement_type, quantity: decimal(raw.quantity), signed_quantity: raw.movement_type === 'adjustment' ? decimal(raw.signed_quantity) : undefined, reason: raw.reason, unit_cost: decimal(raw.unit_cost), invoice_total: decimal(raw.invoice_total), supplier_name: raw.supplier_name || null, invoice_number: raw.invoice_number || null, sector_id: raw.sector_id ? Number(raw.sector_id) : null, responsible_id: raw.responsible_id ? Number(raw.responsible_id) : (raw.movement_type === 'exit' ? user.id : null) }
        await api(`/items/${raw.item_id}/movements`, { method: 'POST', body: JSON.stringify(payload) })
      }
      if (kind === 'purchase') await api('/purchases', { method: 'POST', body: JSON.stringify({ supplier_name: raw.supplier_name, recurrence_days: Number(raw.recurrence_days), next_due_date: raw.next_due_date, notes: raw.notes || null }) })
      if (kind === 'vehicle') await api('/vehicles', { method: 'POST', body: JSON.stringify({ ...raw, initial_odometer: decimal(raw.initial_odometer) || 0 }) })
      if (kind === 'fuel') await api(`/vehicles/${raw.vehicle_id}/fuel`, { method: 'POST', body: JSON.stringify({ ...raw, occurred_on: raw.occurred_on || isoToday(), odometer: decimal(raw.odometer), liters: decimal(raw.liters), amount: decimal(raw.amount), full_tank: raw.full_tank === 'on' }) })
      if (kind === 'maintenance') await api(`/vehicles/${raw.vehicle_id}/maintenance`, { method: 'POST', body: JSON.stringify({ ...raw, occurred_on: raw.occurred_on || isoToday(), amount: decimal(raw.amount) || 0, odometer: decimal(raw.odometer), next_due_odometer: decimal(raw.next_due_odometer) }) })
      notify(kind === 'movement' ? 'Movimentação registrada com sucesso.' : kind === 'purchase' ? 'Rotina de compra cadastrada com sucesso.' : kind === 'fuel' ? 'Abastecimento registrado com sucesso.' : kind === 'maintenance' ? 'Manutenção registrada com sucesso.' : kind === 'user' ? 'Operador cadastrado com sucesso.' : kind === 'sector' ? 'Setor cadastrado com sucesso.' : 'Registro salvo com sucesso.')
      onDone()
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível salvar o registro.') } finally { setBusy(false) }
  }
  return <form className="action-form" onSubmit={submit}><p className="form-intro">{title}</p>
    {kind === 'user' && <><label>Nome completo<input name="full_name" placeholder="Nome da pessoa" required /></label><label>Usuário<input name="username" placeholder="nome.sobrenome" required minLength={3} /></label><label>Senha inicial<input name="password" type="password" placeholder="Mínimo de 10 caracteres" required minLength={10} /></label></>}
    {kind === 'sector' && <label>Nome do setor<input name="name" placeholder="Ex.: Suporte de TI" required autoFocus /></label>}
    {kind === 'item' && <><label>Descrição<input name="name" placeholder="Ex.: Cabo de rede CAT6" required autoFocus /></label><div className="form-row"><label>Código interno<input name="sku" placeholder="Opcional" /></label><label>Categoria<input name="category" placeholder="Ex.: Cabeamento" /></label></div><div className="form-row"><label>Unidade<select name="unit"><option value="un">Unidade (un)</option><option value="cx">Caixa (cx)</option><option value="m">Metro (m)</option><option value="kg">Quilograma (kg)</option><option value="l">Litro (L)</option><option value="par">Par</option></select></label><label>Estoque mínimo<input name="minimum_stock" type="number" min="0" step="0.001" defaultValue="0" required /></label></div><label>Valor unitário atual<input name="current_unit_cost" type="number" min="0" step="0.01" placeholder="0,00" /></label></>}
    {kind === 'movement' && <><label>Buscar item por código ou descrição<input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Digite o código ou nome do item" /></label><label>Item<select name="item_id" required defaultValue=""><option value="" disabled>Selecione um item</option>{items.filter(i => `${i.sku || ''} ${i.name}`.toLocaleLowerCase().includes(itemSearch.toLocaleLowerCase())).map(i => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} · ` : ''}{i.name} · saldo {number(i.balance)} {i.unit}</option>)}</select></label><div className="form-row"><label>Tipo de movimentação<select name="movement_type"><option value="entry">Entrada</option><option value="exit">Consumo / saída</option><option value="adjustment">Ajuste de saldo</option></select></label><label>Quantidade<input name="quantity" type="number" min="0.001" step="0.001" placeholder="0,00" required /></label></div><p className="field-hint">No ajuste, informe a quantidade absoluta da correção abaixo; use valor positivo para acréscimo e negativo para redução.</p><label>Diferença do ajuste<input name="signed_quantity" type="number" step="0.001" placeholder="Ex.: -2,5 ou 4" /></label><label>Motivo<input name="reason" placeholder="Descreva o motivo desta movimentação" required minLength={2} /></label><div className="form-row"><label>Setor<select name="sector_id" required><option value="">Selecione o setor</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Funcionário responsável<select name="responsible_id" required defaultValue={String(user.id)}>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label></div><div className="form-row"><label>Fornecedor (entrada)<input name="supplier_name" placeholder="Fornecedor" /></label><label>Nota fiscal (entrada)<input name="invoice_number" placeholder="Número opcional" /></label></div><div className="form-row"><label>Valor unitário<input name="unit_cost" type="number" min="0" step="0.0001" placeholder="0,00" /></label><label>Total da nota fiscal<input name="invoice_total" type="number" min="0" step="0.01" placeholder="0,00" /></label></div></>}
    {kind === 'purchase' && <><label>Fornecedor<input name="supplier_name" placeholder="Nome do fornecedor" required /></label><div className="form-row"><label>Periodicidade<select name="recurrence_days" defaultValue="30"><option value="7">Semanal</option><option value="15">A cada 15 dias</option><option value="30">Mensal</option><option value="60">A cada 2 meses</option><option value="90">Trimestral</option><option value="180">Semestral</option></select></label><label>Próxima data prevista<input name="next_due_date" type="date" defaultValue={isoToday()} required /></label></div><label>Observações<textarea name="notes" rows={2} placeholder="Notas sobre a rotina de compra" /></label></>}
    {kind === 'vehicle' && <><label>Nome / identificação<input name="name" placeholder="Ex.: Strada CPD" required /></label><div className="form-row"><label>Placa<input name="plate" placeholder="ABC1D23" required maxLength={10} /></label><label>Modelo<input name="model" placeholder="Marca e modelo" /></label></div><div className="form-row"><label>Combustível<select name="fuel_type"><option value="Flex">Flex</option><option value="Gasolina">Gasolina</option><option value="Diesel">Diesel</option><option value="Etanol">Etanol</option><option value="Elétrico">Elétrico</option></select></label><label>Hodômetro inicial (km)<input name="initial_odometer" type="number" min="0" step="0.1" defaultValue="0" /></label></div></>}
    {kind === 'fuel' && <><label>Veículo<select name="vehicle_id" required defaultValue=""><option value="" disabled>Selecione um veículo</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.name} · {v.plate}</option>)}</select></label><div className="form-row"><label>Data<input name="occurred_on" type="date" defaultValue={isoToday()} required /></label><label>Hodômetro (km)<input name="odometer" type="number" min="0" step="0.1" placeholder="0,0" required /></label></div><div className="form-row"><label>Litros<input name="liters" type="number" min="0.001" step="0.001" placeholder="0,000" required /></label><label>Valor total<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" required /></label></div><div className="form-row"><label>Combustível<input name="fuel_type" placeholder="Gasolina, diesel…" /></label><label>Posto<input name="station" placeholder="Nome do posto" /></label></div><label>Motorista / responsável<input name="driver" placeholder="Nome do motorista" /></label><label className="checkbox-field"><input name="full_tank" type="checkbox" defaultChecked /> Abastecimento completou o tanque</label><small>Hodômetros fora da sequência são aceitos e marcados com aviso.</small></>}
    {kind === 'maintenance' && <><label>Veículo<select name="vehicle_id" required defaultValue=""><option value="" disabled>Selecione um veículo</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.name} · {v.plate}</option>)}</select></label><label>Serviço / descrição<input name="description" placeholder="Ex.: Troca de óleo e filtros" required /></label><div className="form-row"><label>Data do serviço<input name="occurred_on" type="date" defaultValue={isoToday()} required /></label><label>Custo total<input name="amount" type="number" min="0" step="0.01" defaultValue="0" /></label></div><div className="form-row"><label>Hodômetro (km)<input name="odometer" type="number" min="0" step="0.1" /></label><label>Categoria<input name="category" defaultValue="maintenance" /></label></div><div className="section-divider">PRÓXIMA REVISÃO <span>opcional</span></div><div className="form-row"><label>Data prevista<input name="next_due_date" type="date" /></label><label>Hodômetro previsto<input name="next_due_odometer" type="number" min="0" step="0.1" placeholder="Km" /></label></div></>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={onDone}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar registro'}<ChevronRight size={16} /></button></div>
  </form>
}

export default App
