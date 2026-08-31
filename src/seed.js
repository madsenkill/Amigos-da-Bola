// ============================================================
//  src/seed.js
//  Dados de demonstração (usados no modo DEMO/localStorage).
//  Permitem ver o app funcionando imediatamente sem backend.
// ============================================================
import { CONFIG } from './config.js'
import { uid, mesAtual } from './utils.js'
import { resultadoDePlacar } from './ranking.js'

/** Cria a lista de jogadores demo. */
function jogadoresSeed() {
  const specs = [
    ['Rafael Andrade', 'Goleiro', '11 98888-0001', 'Excelente em reflexos, pega pênalti. Chega sempre atrasado.'],
    ['Thiago Melo', 'Goleiro', '11 98888-0002', 'Goleiro raiz, joga no gelo. Bom passe com os pés.'],
    ['Bruno Costa', 'Zagueiro', '11 98888-0003', 'Joga bem de zagueiro, chuta com a esquerda.'],
    ['Carlos Eduardo', 'Zagueiro', '11 98888-0004', 'Fortão, marca no corpo. Às vezes se perde na bola.'],
    ['Pedro Henrique', 'Zagueiro', '11 98888-0005', 'Sai jogando bem. Meio bicho-preguiça na corrida.'],
    ['Diego Lima', 'Lateral', '11 98888-0006', 'Apoia muito, sobe pra frente o tempo todo.'],
    ['Vinícius Ramos', 'Lateral', '11 98888-0007', 'Marcador raiz, não deixa o ponta nem respirar.'],
    ['Juliano Pires', 'Volante', '11 98888-0008', 'Cão de guarda, desarma tudo no meio.'],
    ['Fábio Nunes', 'Meia', '11 98888-0009', 'Cérebro do time, organiza o jogo. Cansa no segundo tempo.'],
    ['Gabriel Santos', 'Meia', '11 98888-0010', 'Driblador nato, faz fila na pelada.'],
    ['Lucas Freitas', 'Meia', '11 98888-0011', 'Chute forte de fora da área. Imprevisível.'],
    ['Henrique Dias', 'Atacante', '11 98888-0012', 'Matador, sempre na frente do gol.'],
    ['Igor Martins', 'Atacante', '11 98888-0013', 'Veloz, mata no contrapé. Vive em impedimento.'],
    ['Marcos Paulo', 'Atacante', '11 98888-0014', 'Guerreiro, se entrega até o fim. Perna de pau de vez em quando.'],
  ]
  return specs.map(([nome, posicao, telefone, observacoes]) => ({
    id: uid(),
    nome, posicao, foto: '', telefone, observacoes, ativo: true,
  }))
}

/** Distribui N gols entre os jogadores de um time (determinístico). */
function distribuirGols(ids, total) {
  const map = {}
  for (let i = 0; i < total; i++) {
    const id = ids[i % ids.length]
    map[id] = (map[id] || 0) + 1
  }
  return map
}

/**
 * Monta uma rodada completa a partir de uma configuração compacta.
 * @param {object} cfg { data, titulo, partidas, destaques }
 * @param {Array} jogadores - lista de jogadores (para referência)
 */
function buildRodada(cfg) {
  const rodada = {
    id: uid(),
    data: cfg.data,
    titulo: cfg.titulo || 'Rodada de Terça',
    partidas: [],
    estatisticas: [],
    craque_id: cfg.destaques?.craque || null,
    craque_motivo: cfg.destaques?.craque_motivo || '',
    bola_murcha_id: cfg.destaques?.murcha || null,
    bola_murcha_motivo: cfg.destaques?.murcha_motivo || '',
  }

  cfg.partidas.forEach((p, idx) => {
    const partida = {
      id: uid(),
      nome: p.nome || `Partida ${idx + 1}`,
      time_a: p.time_a,
      time_b: p.time_b,
      gols_a: p.gols_a,
      gols_b: p.gols_b,
    }
    rodada.partidas.push(partida)

    const golsA = distribuirGols(p.time_a, p.gols_a)
    const golsB = distribuirGols(p.time_b, p.gols_b)

    const resA = resultadoDePlacar(p.gols_a, p.gols_b)
    const resB = resultadoDePlacar(p.gols_b, p.gols_a)

    p.time_a.forEach((id) => {
      rodada.estatisticas.push({
        id: uid(),
        partida_id: partida.id,
        jogador_id: id,
        time: 'A',
        resultado: resA.resultado,
        pontos: resA.pontos,
        gols: golsA[id] || 0,
        cartoes_amarelos: p.amarelos?.includes(id) ? 1 : 0,
        cartoes_vermelhos: p.vermelhos?.includes(id) ? 1 : 0,
      })
    })
    p.time_b.forEach((id) => {
      rodada.estatisticas.push({
        id: uid(),
        partida_id: partida.id,
        jogador_id: id,
        time: 'B',
        resultado: resB.resultado,
        pontos: resB.pontos,
        gols: golsB[id] || 0,
        cartoes_amarelos: p.amarelos?.includes(id) ? 1 : 0,
        cartoes_vermelhos: p.vermelhos?.includes(id) ? 1 : 0,
      })
    })
  })
  return rodada
}

/** Gera mensalidades + caixa para o mês corrente. */
function financeiroSeed(jogadores, mes) {
  const valor = CONFIG.VALOR_MENSALIDADE
  const mensalidades = jogadores.map((j, i) => ({
    id: uid(),
    jogador_id: j.id,
    mes,
    valor,
    vencimento: `${mes}-10`,
    pago: i % 3 !== 0, // 2/3 dos jogadores já pagaram
  }))

  const caixa = []
  mensalidades.filter(m => m.pago).forEach(m => {
    const j = jogadores.find(x => x.id === m.jogador_id)
    caixa.push({
      id: uid(),
      tipo: 'entrada',
      categoria: 'mensalidade',
      descricao: `Mensalidade ${j.nome}`,
      valor,
      jogador_id: m.jogador_id,
      mes,
      criado_em: new Date().toISOString(),
    })
  })

  const despesas = [
    ['Aluguel da quadra (mensal)', 'quadra', 240],
    ['Custo do colete oficial', 'colete', 60],
    ['Compra de 2 bolas novas', 'bola', 180],
    ['Água e isotônico da rodada', 'outros', 35],
  ]
  despesas.forEach(([descricao, categoria, valor]) => {
    caixa.push({
      id: uid(), tipo: 'saida', categoria, descricao, valor,
      jogador_id: null, mes, criado_em: new Date().toISOString(),
    })
  })
  return { mensalidades, caixa }
}

/** Demandas da diretoria (demo). */
function demandasSeed() {
  const hoje = new Date().toISOString()
  return [
    { id: uid(), titulo: 'Comprar 2 bolas novas', descricao: 'As atuais estão murchando rápido. Modelo Penalty 8.0.', prioridade: 'alta', status: 'pendente', criado_em: hoje },
    { id: uid(), titulo: 'Reservar a quadra do mês que vem', descricao: 'Falar com o Zé na recepção e garantir as 4 terças.', prioridade: 'alta', status: 'fazendo', criado_em: hoje },
    { id: uid(), titulo: 'Cobrar PIX do Rafael', descricao: 'Mensalidade de agosto pendente. Já cobrar 2x.', prioridade: 'media', status: 'pendente', criado_em: hoje },
    { id: uid(), titulo: 'Atualizar o WhatsApp do grupo', descricao: 'Confirmar quem vai na próxima terça no fixado.', prioridade: 'media', status: 'fazendo', criado_em: hoje },
    { id: uid(), titulo: 'Lavar os coletes', descricao: 'Os coletes brancos estão sujos de barro.', prioridade: 'baixa', status: 'pendente', criado_em: hoje },
    { id: uid(), titulo: 'Criar troféu do mês', descricao: 'Caneca dourada com o nome do campeão do mês.', prioridade: 'baixa', status: 'concluida', criado_em: hoje },
  ]
}

/** Escalação com 4 jogadores por time (A e B) em cada partida. */
function rodadasSeed(jogadores) {
  const j = {}
  jogadores.forEach(x => { j[x.nome.split(' ')[0]] = x.id })
  const G = (nome) => j[nome]

  const cfg = [
    // ---------- JULHO ----------
    {
      data: '2026-07-07', titulo: 'Terça de Ajuste',
      partidas: [
        { time_a: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], time_b: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], gols_a: 2, gols_b: 2 },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Rafael'), G('Gabriel')], gols_a: 3, gols_b: 1, amarelos: [G('Vinícius')] },
      ],
      destaques: { craque: G('Henrique'), craque_motivo: 'Dois gols e uma assistência no empate do time A.', murcha: G('Thiago'), murcha_motivo: 'Tomou gol de cobertura de dentro da área, murchou na hora.' },
    },
    {
      data: '2026-07-14', titulo: 'Terça da Chuvinha',
      partidas: [
        { time_a: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], time_b: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], gols_a: 1, gols_b: 3 },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Gabriel'), G('Igor')], gols_a: 2, gols_b: 0, amarelos: [G('Juliano'), G('Vinícius')] },
      ],
      destaques: { craque: G('Henrique'), craque_motivo: 'De novo artilheiro da noite, imparável na área.', murcha: G('Vinícius'), murcha_motivo: 'Fez gol contra e ainda saiu com câimbra.' },
    },
    {
      data: '2026-07-21', titulo: 'Terça de Virada',
      partidas: [
        { time_a: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], time_b: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], gols_a: 0, gols_b: 4, amarelos: [G('Bruno')] },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Rafael'), G('Igor')], gols_a: 1, gols_b: 1, vermelhos: [G('Marcos')] },
      ],
      destaques: { craque: G('Igor'), craque_motivo: 'Dois gols e uma assistência, melhor da noite.', murcha: G('Rafael'), murcha_motivo: 'Levou 4 gols e sumiu no segundo tempo.' },
    },

    // ---------- AGOSTO ----------
    {
      data: '2026-08-04', titulo: 'Terça de Estreia',
      partidas: [
        { time_a: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], time_b: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], gols_a: 2, gols_b: 2 },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Gabriel'), G('Henrique')], gols_a: 3, gols_b: 1 },
      ],
      destaques: { craque: G('Gabriel'), craque_motivo: 'Meio-campo absurdo, marcou e distribuiu o jogo.', murcha: G('Vinícius'), murcha_motivo: 'Tentou o drible da vaca e caiu sozinho, virou meme.' },
    },
    {
      data: '2026-08-11', titulo: 'Terça do Clássico',
      partidas: [
        { time_a: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], time_b: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], gols_a: 1, gols_b: 3 },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Gabriel'), G('Igor')], gols_a: 2, gols_b: 2, amarelos: [G('Diego'), G('Marcos')] },
      ],
      destaques: { craque: G('Henrique'), craque_motivo: 'Mais uma atuação de craque, dois gols no clássico.', murcha: G('Thiago'), murcha_motivo: 'Bateu o tiro de meta na cabeça do próprio zagueiro.' },
    },
    {
      data: '2026-08-18', titulo: 'Terça do Mico',
      partidas: [
        { time_a: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], time_b: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], gols_a: 4, gols_b: 0, amarelos: [G('Gabriel')] },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Gabriel'), G('Igor')], gols_a: 0, gols_b: 2 },
      ],
      destaques: { craque: G('Bruno'), craque_motivo: 'Zagueiro invicto, não deixou nada passar e ainda marcou.', murcha: G('Marcos'), murcha_motivo: 'Perdeu gol sem goleiro no fim do jogo, o vestiário pegou no pé.' },
    },
    {
      data: '2026-08-25', titulo: 'Terça da Roda Fechada',
      partidas: [
        { time_a: [G('Thiago'), G('Carlos'), G('Gabriel'), G('Igor')], time_b: [G('Rafael'), G('Bruno'), G('Fábio'), G('Henrique')], gols_a: 2, gols_b: 2 },
        { time_a: [G('Pedro'), G('Diego'), G('Juliano'), G('Lucas')], time_b: [G('Vinícius'), G('Marcos'), G('Gabriel'), G('Henrique')], gols_a: 1, gols_b: 3, amarelos: [G('Diego')], vermelhos: [G('Pedro')] },
      ],
      destaques: { craque: G('Igor'), craque_motivo: 'Goleada com direito a bicicleta. Jogador do mês.', murcha: G('Diego'), murcha_motivo: 'Sumiu da partida, ninguém sabe para onde foi.' },
    },
  ]
  return cfg.map(c => buildRodada(c))
}

/**
 * Monta o objeto SEED completo (jogadores, rodadas, financeiro, demandas).
 *
 * Seed de demonstração esvaziado a pedido do usuário: o app agora inicia
 * sem dados de exemplo (cada lista começa vazia).
 * Para voltar a usar os dados demo, basta chamar as funções originais
 * abaixo (jogadoresSeed, rodadasSeed, financeiroSeed, demandasSeed)
 * e trocar o retorno por `{ jogadores, rodadas: rodadasSeed(jogadores), mensalidades, caixa, demandas: demandasSeed() }`.
 */
export function buildSeed() {
  return {
    jogadores: [],
    rodadas: [],
    mensalidades: [],
    caixa: [],
    demandas: [],
  }
}
