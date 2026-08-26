// ============================================================
//  src/ranking.js
//  Lógica de pontuação e classificação.
//
//  REGRA: a pontuação é INDIVIDUAL. A cada terça os times são
//  sorteados/montados de forma diferente. O jogador recebe os
//  pontos do time em que esteve naquela data:
//    Vitória = 3 pts | Empate = 1 pt | Derrota = 0 pts
// ============================================================
import { CONFIG } from './config.js'
import { mesDaData } from './utils.js'

/** Resultado de uma partida a partir do placar. */
export function resultadoDePlacar(golsA, golsB) {
  const ga = Number(golsA || 0)
  const gb = Number(golsB || 0)
  if (ga > gb) return { resultado: 'VITORIA', pontos: CONFIG.PONTOS_VITORIA }
  if (ga < gb) return { resultado: 'DERROTA', pontos: CONFIG.PONTOS_DERROTA }
  return { resultado: 'EMPATE', pontos: CONFIG.PONTOS_EMPATE }
}

/** Rótulos de resultado em pt-BR. */
export const RESULTADO_LABEL = {
  VITORIA: 'Vitória',
  EMPATE: 'Empate',
  DERROTA: 'Derrota',
}

/**
 * Soma as estatísticas individuais de todos os jogadores.
 * @param {Array} jogadores - lista de jogadores
 * @param {Array} rodadas  - rodadas com estatísticas aninhadas
 * @param {string|null} mes - filtro 'YYYY-MM' (null = todas)
 * @returns ranking ordenado (pontos, vitórias, gols)
 */
export function computarRanking(jogadores, rodadas, mes = null) {
  const linhas = {}

  for (const j of jogadores) {
    if (j.ativo === false) continue
    linhas[j.id] = {
      jogador: j,
      jogos: 0, vitorias: 0, empates: 0, derrotas: 0,
      gols: 0, amarelos: 0, vermelhos: 0, pontos: 0,
    }
  }

  for (const r of rodadas) {
    if (mes && mesDaData(r.data) !== mes) continue
    for (const e of r.estatisticas || []) {
      const linha = linhas[e.jogador_id]
      if (!linha) continue
      linha.jogos++
      if (e.resultado === 'VITORIA') linha.vitorias++
      else if (e.resultado === 'EMPATE') linha.empates++
      else linha.derrotas++
      linha.pontos += Number(e.pontos || 0)
      linha.gols += Number(e.gols || 0)
      linha.amarelos += Number(e.cartoes_amarelos || 0)
      linha.vermelhos += Number(e.cartoes_vermelhos || 0)
    }
  }

  return Object.values(linhas)
    .filter(l => l.jogos > 0)
    .sort((a, b) =>
      b.pontos - a.pontos ||
      b.vitorias - a.vitorias ||
      b.gols - a.gols ||
      a.jogador.nome.localeCompare(b.jogador.nome, 'pt-BR'))
}

/** Top artilheiros (ordenado por gols). */
export function topArtilheiros(ranking, n = 3) {
  return [...ranking].sort((a, b) => b.gols - a.gols || b.pontos - a.pontos).slice(0, n)
}

/** Top cartões (amarelo vale 1, vermelho vale 2). */
export function topCartoes(ranking, n = 3) {
  const peso = (l) => l.amarelos + l.vermelhos * 2
  return [...ranking].filter(l => peso(l) > 0).sort((a, b) => peso(b) - peso(a)).slice(0, n)
}

/** Craque do Dia da rodada mais recente dentro do filtro de mês. */
export function destaqueDaRodada(rodadas, mes, chave) {
  const filtradas = mes ? rodadas.filter(r => mesDaData(r.data) === mes) : rodadas
  for (let i = filtradas.length - 1; i >= 0; i--) {
    const r = filtradas[i]
    if (r[chave]) return r
  }
  return null
}

/** Busca o craque e a bola murcha da última rodada do filtro. */
export function destaquesDoMes(rodadas, mes) {
  const ultima = destaqueDaRodada(rodadas, mes, 'craque_id')
  return {
    rodada: ultima,
    craque: ultima ? ultima.craque_id : null,
    bolaMurcha: ultima ? ultima.bola_murcha_id : null,
  }
}
