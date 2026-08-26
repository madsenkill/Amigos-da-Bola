// ============================================================
//  src/utils.js
//  Funções utilitárias de datas, formatação e DOM.
// ============================================================
import { CONFIG } from './config.js'

/** Gera um id único (com fallback para browsers antigos). */
export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
}

/** Retorna a data de hoje no formato ISO (YYYY-MM-DD). */
export function hojeISO() {
  return toISODate(new Date())
}

/** Converte Date -> 'YYYY-MM-DD' (fuso local). */
export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Formata 'YYYY-MM-DD' -> 'ter, 25 de ago. de 2026'. */
export function formatarData(iso) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(d).replace(/\./g, '')
}

/** Formata 'YYYY-MM-DD' -> '25/08/2026'. */
export function formatarDataCurta(iso) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** 'YYYY-MM-DD' -> Date (interpretado como horário local). */
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Retorna 'YYYY-MM' do mês atual. */
export function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Extrai 'YYYY-MM' de uma data ISO. */
export function mesDaData(iso) {
  return (iso || '').slice(0, 7)
}

/** Formata 'YYYY-MM' -> 'Agosto de 2026'. */
export function formatarMes(mes) {
  if (!mes) return '—'
  const [y, m] = mes.split('-').map(Number)
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(y, m - 1, 1))
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${y}`
}

/** Formata número como moeda brasileira: 20 -> 'R$ 20,00'. */
export function formatarMoeda(v) {
  const n = Number(v || 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

/** 'R$ 20,00' -> 20 (ou 0 se inválido). */
export function parseMoeda(texto) {
  if (texto == null) return 0
  const n = parseFloat(String(texto).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

/** Iniciais para avatar de fallback: 'Rafael Souza' -> 'RS'. */
export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/)
  const p1 = partes[0] || '?'
  const p2 = partes[1] || ''
  return (p1[0] + (p2 ? p2[0] : '')).toUpperCase()
}

/** Gradiente determinístico a partir de um nome (para avatares). */
export function corDoNome(nome = '') {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  const paleta = [
    'linear-gradient(135deg,#F59E0B,#D97706)',
    'linear-gradient(135deg,#10B981,#059669)',
    'linear-gradient(135deg,#3B82F6,#2563EB)',
    'linear-gradient(135deg,#8B5CF6,#6D28D9)',
    'linear-gradient(135deg,#EC4899,#DB2777)',
    'linear-gradient(135deg,#06B6D4,#0891B2)',
  ]
  return paleta[Math.abs(hash) % paleta.length]
}

/** Escapa HTML para evitar XSS ao injetar nomes digitados pelo usuário. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Debounce simples para eventos de input/scroll. */
export function debounce(fn, ms = 250) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

/** Próxima data do dia da semana (ex.: próxima terça-feira). */
export function proximaDataDoDia(diaSemana, hoje = new Date()) {
  const d = new Date(hoje)
  let diff = (diaSemana - d.getDay() + 7) % 7
  if (diff === 0) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

/** Próxima terça-feira em ISO, usada como data padrão na súmula. */
export function proximaTercaISO() {
  return toISODate(proximaDataDoDia(CONFIG.DIA_DO_JOGO))
}

/** Lista de meses (YYYY-MM) que possuem rodadas, ordenada decrescente. */
export function mesesDeRodadas(rodadas) {
  const set = new Set()
  for (const r of rodadas) if (r && r.data) set.add(mesDaData(r.data))
  return [...set].sort().reverse()
}

/** Dias restantes até a próxima terça (0 = hoje). */
export function diasAteProximaTerca(hoje = new Date()) {
  const prox = proximaDataDoDia(CONFIG.DIA_DO_JOGO, hoje)
  const diff = Math.ceil((prox - hoje) / 86400000)
  return diff
}
