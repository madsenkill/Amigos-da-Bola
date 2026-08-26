// ============================================================
//  src/db.js
//  Camada de dados da Pelada de Terça.
//
//  Duas fontes de dados, mesma interface assíncrona:
//   1. SUPABASE  -> se CONFIG.SUPABASE_URL + ANON_KEY preenchidos
//                   (usa as tabelas do script sql/schema.sql)
//   2. MODO DEMO -> localStorage com dados de seed (buildSeed)
//
//  Formato de dados usado pelo app (camelCase):
//    jogador     { id, nome, posicao, foto, telefone, observacoes, ativo }
//    rodada      { id, data, titulo, partidas[], estatisticas[], craque_id,
//                  craque_motivo, bola_murcha_id, bola_murcha_motivo }
//    partida     { id, nome, time_a[], time_b[], gols_a, gols_b }
//    estatistica { id, partida_id, jogador_id, time, resultado, pontos,
//                  gols, cartoes_amarelos, cartoes_vermelhos }
//    mensalidade { id, jogador_id, mes, valor, vencimento, pago }
//    caixa       { id, tipo, categoria, descricao, valor, jogador_id, mes, criado_em }
//    demanda     { id, titulo, descricao, prioridade, status, criado_em }
// ============================================================
import { CONFIG } from './config.js'
import { buildSeed } from './seed.js'

const LS = {
  jogadores: 'pelada.jogadores',
  rodadas: 'pelada.rodadas',
  mensalidades: 'pelada.mensalidades',
  caixa: 'pelada.caixa',
  demandas: 'pelada.demandas',
  meta: 'pelada.meta',
}

let mode = 'local'
let sb = null

/** Inicializa a camada de dados. Deve ser chamado antes de tudo. */
export async function initDB() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
    try {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
      mode = 'supabase'
      console.info('[db] Modo SUPABASE ativo')
    } catch (e) {
      console.warn('[db] Falha ao criar cliente Supabase, usando modo demo.', e)
      mode = 'local'
    }
  } else {
    mode = 'local'
  }

  if (mode === 'local' && !localStorage.getItem(LS.meta)) {
    const seed = buildSeed()
    localStorage.setItem(LS.jogadores, JSON.stringify(seed.jogadores))
    localStorage.setItem(LS.rodadas, JSON.stringify(seed.rodadas))
    localStorage.setItem(LS.mensalidades, JSON.stringify(seed.mensalidades))
    localStorage.setItem(LS.caixa, JSON.stringify(seed.caixa))
    localStorage.setItem(LS.demandas, JSON.stringify(seed.demandas))
    localStorage.setItem(LS.meta, JSON.stringify({ criado_em: new Date().toISOString() }))
    console.info('[db] Modo DEMO ativo - dados de exemplo carregados no localStorage')
  }
  return mode
}

export function getMode() { return mode }

/* ============================================================
   STORE LOCAL (localStorage)
============================================================ */
const local = {
  async read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch { return fallback }
  },
  async write(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  },

  // ---- jogadores ----
  async getJogadores() { return this.read(LS.jogadores, []) },
  async saveJogador(jogador) {
    const lista = await this.getJogadores()
    const idx = lista.findIndex(j => j.id === jogador.id)
    if (idx >= 0) lista[idx] = jogador
    else lista.push(jogador)
    await this.write(LS.jogadores, lista)
    return jogador
  },
  async deleteJogador(id) {
    const lista = await this.getJogadores()
    await this.write(LS.jogadores, lista.filter(j => j.id !== id))
  },

  // ---- rodadas ----
  async getRodadas() { return this.read(LS.rodadas, []) },
  async saveRodada(rodada) {
    const lista = await this.getRodadas()
    const idx = lista.findIndex(r => r.id === rodada.id)
    if (idx >= 0) lista[idx] = rodada
    else lista.push(rodada)
    lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    await this.write(LS.rodadas, lista)
    return rodada
  },
  async deleteRodada(id) {
    const lista = await this.getRodadas()
    await this.write(LS.rodadas, lista.filter(r => r.id !== id))
  },

  // ---- mensalidades ----
  async getMensalidades() { return this.read(LS.mensalidades, []) },
  async saveMensalidade(m) {
    const lista = await this.getMensalidades()
    const idx = lista.findIndex(x => x.id === m.id)
    if (idx >= 0) lista[idx] = m
    else lista.push(m)
    await this.write(LS.mensalidades, lista)
    return m
  },
  async deleteMensalidade(id) {
    const lista = await this.getMensalidades()
    await this.write(LS.mensalidades, lista.filter(x => x.id !== id))
  },

  // ---- caixa ----
  async getCaixa() { return this.read(LS.caixa, []) },
  async addCaixa(rec) {
    const lista = await this.getCaixa()
    lista.push(rec)
    await this.write(LS.caixa, lista)
    return rec
  },
  async deleteCaixa(id) {
    const lista = await this.getCaixa()
    await this.write(LS.caixa, lista.filter(x => x.id !== id))
  },

  // ---- demandas ----
  async getDemandas() { return this.read(LS.demandas, []) },
  async saveDemanda(d) {
    const lista = await this.getDemandas()
    const idx = lista.findIndex(x => x.id === d.id)
    if (idx >= 0) lista[idx] = d
    else lista.push(d)
    await this.write(LS.demandas, lista)
    return d
  },
  async deleteDemanda(id) {
    const lista = await this.getDemandas()
    await this.write(LS.demandas, lista.filter(x => x.id !== id))
  },
}

/* ============================================================
   STORE SUPABASE
   As consultas usam as colunas snake_case das tabelas SQL e
   convertem para o formato camelCase usado no app.
============================================================ */
const remapRodada = (r) => ({
  id: r.id,
  data: r.data,
  titulo: r.titulo,
  partidas: (r.partidas || []).map(p => ({
    id: p.id,
    nome: p.nome,
    time_a: p.time_a_ids || [],
    time_b: p.time_b_ids || [],
    gols_a: p.gols_a,
    gols_b: p.gols_b,
  })),
  estatisticas: (r.estatisticas || []).map(e => ({
    id: e.id,
    partida_id: e.partida_id,
    jogador_id: e.jogador_id,
    time: e.time,
    resultado: e.resultado,
    pontos: e.pontos,
    gols: e.gols,
    cartoes_amarelos: e.cartoes_amarelos,
    cartoes_vermelhos: e.cartoes_vermelhos,
  })),
  craque_id: r.craque_id,
  craque_motivo: r.craque_motivo,
  bola_murcha_id: r.bola_murcha_id,
  bola_murcha_motivo: r.bola_murcha_motivo,
})

const supabase = {
  // ---- jogadores ----
  async getJogadores() {
    const { data, error } = await sb.from('jogadores').select('*').order('nome')
    if (error) throw error
    return (data || []).map(j => ({
      id: j.id, nome: j.nome, posicao: j.posicao, foto: j.foto,
      telefone: j.telefone, observacoes: j.observacoes, ativo: j.ativo,
    }))
  },
  async saveJogador(jogador) {
    const { data, error } = await sb.from('jogadores').upsert({
      id: jogador.id, nome: jogador.nome, posicao: jogador.posicao, foto: jogador.foto,
      telefone: jogador.telefone, observacoes: jogador.observacoes, ativo: jogador.ativo,
    }).select().single()
    if (error) throw error
    return { id: data.id, ...jogador }
  },
  async deleteJogador(id) {
    const { error } = await sb.from('jogadores').delete().eq('id', id)
    if (error) throw error
  },

  // ---- rodadas (com partidas e estatísticas aninhadas) ----
  async getRodadas() {
    const { data, error } = await sb.from('rodadas').select('*').order('data')
    if (error) throw error
    const rodadas = data || []
    if (!rodadas.length) return []

    const ids = rodadas.map(r => r.id)
    const { data: partidas, error: e1 } = await sb.from('partidas').select('*').in('rodada_id', ids)
    if (e1) throw e1
    const { data: stats, error: e2 } = await sb.from('estatisticas_jogador').select('*').in('rodada_id', ids)
    if (e2) throw e2

    const partidasPorRodada = {}
    ;(partidas || []).forEach(p => { (partidasPorRodada[p.rodada_id] = partidasPorRodada[p.rodada_id] || []).push(p) })
    const statsPorRodada = {}
    ;(stats || []).forEach(s => { (statsPorRodada[s.rodada_id] = statsPorRodada[s.rodada_id] || []).push(s) })

    return rodadas.map(r => remapRodada({ ...r, partidas: partidasPorRodada[r.id] || [], estatisticas: statsPorRodada[r.id] || [] }))
  },
  async saveRodada(rodada) {
    const rodadaId = rodada.id
    // 1) upsert rodada
    const { error: eRodada } = await sb.from('rodadas').upsert({
      id: rodadaId, data: rodada.data, titulo: rodada.titulo,
      craque_id: rodada.craque_id, craque_motivo: rodada.craque_motivo,
      bola_murcha_id: rodada.bola_murcha_id, bola_murcha_motivo: rodada.bola_murcha_motivo,
    })
    if (eRodada) throw eRodada

    // 2) remove partidas e estatísticas antigas da rodada (substituição)
    const { error: eDelP } = await sb.from('partidas').delete().eq('rodada_id', rodadaId)
    if (eDelP) throw eDelP
    const { error: eDelS } = await sb.from('estatisticas_jogador').delete().eq('rodada_id', rodadaId)
    if (eDelS) throw eDelS

    // 3) insere as novas
    if (rodada.partidas.length) {
      const partidasRows = rodada.partidas.map(p => ({
        id: p.id, rodada_id: rodadaId, nome: p.nome,
        time_a_ids: p.time_a, time_b_ids: p.time_b,
        gols_a: p.gols_a, gols_b: p.gols_b,
      }))
      const { error: eInsP } = await sb.from('partidas').insert(partidasRows)
      if (eInsP) throw eInsP
    }
    if (rodada.estatisticas.length) {
      const statsRows = rodada.estatisticas.map(e => ({
        id: e.id, rodada_id: rodadaId, partida_id: e.partida_id,
        jogador_id: e.jogador_id, time: e.time, resultado: e.resultado,
        pontos: e.pontos, gols: e.gols,
        cartoes_amarelos: e.cartoes_amarelos, cartoes_vermelhos: e.cartoes_vermelhos,
      }))
      const { error: eInsS } = await sb.from('estatisticas_jogador').insert(statsRows)
      if (eInsS) throw eInsS
    }
    return rodada
  },
  async deleteRodada(id) {
    const { error } = await sb.from('rodadas').delete().eq('id', id)
    if (error) throw error
  },

  // ---- mensalidades ----
  async getMensalidades() {
    const { data, error } = await sb.from('mensalidades').select('*')
    if (error) throw error
    return (data || []).map(m => ({
      id: m.id, jogador_id: m.jogador_id, mes: m.mes,
      valor: m.valor, vencimento: m.vencimento, pago: m.pago,
    }))
  },
  async saveMensalidade(m) {
    const { error } = await sb.from('mensalidades').upsert({
      id: m.id, jogador_id: m.jogador_id, mes: m.mes,
      valor: m.valor, vencimento: m.vencimento, pago: m.pago,
    })
    if (error) throw error
    return m
  },
  async deleteMensalidade(id) {
    const { error } = await sb.from('mensalidades').delete().eq('id', id)
    if (error) throw error
  },

  // ---- caixa ----
  async getCaixa() {
    const { data, error } = await sb.from('caixa').select('*').order('criado_em', { ascending: false })
    if (error) throw error
    return (data || []).map(c => ({
      id: c.id, tipo: c.tipo, categoria: c.categoria, descricao: c.descricao,
      valor: c.valor, jogador_id: c.jogador_id, mes: c.mes, criado_em: c.criado_em,
    }))
  },
  async addCaixa(rec) {
    const { data, error } = await sb.from('caixa').insert({
      tipo: rec.tipo, categoria: rec.categoria, descricao: rec.descricao,
      valor: rec.valor, jogador_id: rec.jogador_id, mes: rec.mes, criado_em: rec.criado_em,
    }).select().single()
    if (error) throw error
    return { ...rec, id: data.id }
  },
  async deleteCaixa(id) {
    const { error } = await sb.from('caixa').delete().eq('id', id)
    if (error) throw error
  },

  // ---- demandas ----
  async getDemandas() {
    const { data, error } = await sb.from('demandas').select('*').order('criado_em')
    if (error) throw error
    return (data || []).map(d => ({
      id: d.id, titulo: d.titulo, descricao: d.descricao,
      prioridade: d.prioridade, status: d.status, criado_em: d.criado_em,
    }))
  },
  async saveDemanda(d) {
    const { error } = await sb.from('demandas').upsert({
      id: d.id, titulo: d.titulo, descricao: d.descricao,
      prioridade: d.prioridade, status: d.status, criado_em: d.criado_em,
    })
    if (error) throw error
    return d
  },
  async deleteDemanda(id) {
    const { error } = await sb.from('demandas').delete().eq('id', id)
    if (error) throw error
  },
}

/** Store ativo (local ou supabase). */
const store = new Proxy({}, {
  get(_, prop) {
    return mode === 'supabase' ? supabase[prop] : local[prop]
  },
})

/* ============================================================
   API EXPORTADA
============================================================ */
export const db = {
  // jogadores
  getJogadores: (...a) => store.getJogadores(...a),
  saveJogador: (...a) => store.saveJogador(...a),
  deleteJogador: (...a) => store.deleteJogador(...a),
  // rodadas
  getRodadas: (...a) => store.getRodadas(...a),
  saveRodada: (...a) => store.saveRodada(...a),
  deleteRodada: (...a) => store.deleteRodada(...a),
  // mensalidades
  getMensalidades: (...a) => store.getMensalidades(...a),
  saveMensalidade: (...a) => store.saveMensalidade(...a),
  deleteMensalidade: (...a) => store.deleteMensalidade(...a),
  // caixa
  getCaixa: (...a) => store.getCaixa(...a),
  addCaixa: (...a) => store.addCaixa(...a),
  deleteCaixa: (...a) => store.deleteCaixa(...a),
  // demandas
  getDemandas: (...a) => store.getDemandas(...a),
  saveDemanda: (...a) => store.saveDemanda(...a),
  deleteDemanda: (...a) => store.deleteDemanda(...a),
}
