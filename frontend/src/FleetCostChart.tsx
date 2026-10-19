import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = { data: { name: string; gasto: number }[] }

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export default function FleetCostChart({ data }: Props) {
  return <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5c74f7" stopOpacity={0.29} /><stop offset="100%" stopColor="#5c74f7" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={value => `R$${value}`} /><Tooltip formatter={value => money(Number(value))} contentStyle={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 12 }} /><Area type="monotone" dataKey="gasto" stroke="#6579ff" strokeWidth={2.5} fill="url(#costFill)" /></AreaChart></ResponsiveContainer></div>
}
