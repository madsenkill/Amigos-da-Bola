# Pelada de Terça

Sistema web moderno de gerenciamento da pelada de futebol de terça-feira. Ranking individual, súmulas de rodada, financeiro e central de demandas da diretoria — tudo em Dark Mode elegante (dourado `#F59E0B` + verde neon `#10B981`).

![stack](https://img.shields.io/badge/HTML5-0F0F12?style=flat&logo=html5&logoColor=F59E0B) ![stack](https://img.shields.io/badge/TailwindCSS-0F0F12?style=flat&logo=tailwindcss&logoColor=10B981) ![stack](https://img.shields.io/badge/VanillaJS-0F0F12?style=flat&logo=javascript&logoColor=F59E0B) ![stack](https://img.shields.io/badge/Vite-0F0F12?style=flat&logo=vite&logoColor=10B981) ![stack](https://img.shields.io/badge/Supabase-0F0F12?style=flat&logo=supabase&logoColor=10B981)

---

## Funcionalidades

### Área pública (`/`)
- **Destaques da rodada**: Craque do Dia (dourado) e Bola Murcha (vermelho) da última terça.
- **Classificação Geral**: Posição, Pts (3/1/0), Jogos, V, E, D, Gols, Amarelos e Vermelhos — com destaque dourado para o líder.
- **Artilharia e ranking de cartões**: Top 3 do mês.
- **Filtro de mês/temporada**: alterne entre o mês corrente e o histórico.
- **Contador para a próxima terça-feira**.

### Painel admin (`/admin`)
1. **Lançar Rodada (Súmula)**: data da terça, montagem dos times com multi-select, placares por partida, **pontos automáticos** (Vitória 3 / Empate 1 / Derrota 0), gols e cartões individuais, votação de Craque e Bola Murcha. Rodadas podem ser editadas e excluídas.
2. **Gestão de Jogadores**: cadastro com nome, posição, foto (URL ou upload), telefone e **observações internas**; ativar/inativar e excluir.
3. **Financeiro & Caixa**: mensalidades com badge PAGO/PENDENTE e botão **Receber via PIX** (gera a entrada no caixa automaticamente), cards de resumo (arrecadado, gastos, saldo) e histórico de lançamentos.
4. **Central de Demandas**: kanban (Pendentes → Em andamento → Concluídas) com prioridades Alta/Média/Baixa e drag & drop.

## Modo de execução

O sistema tem **duas fontes de dados**:

| Modo | Quando | Onde os dados ficam |
|------|--------|---------------------|
| **DEMO** | `SUPABASE_URL` vazio | `localStorage` do navegador (dados de exemplo carregados automaticamente) |
| **SUPABASE** | `SUPABASE_URL` + `SUPABASE_ANON_KEY` preenchidos | Banco PostgreSQL na nuvem |

```bash
npm install
npm run dev     # http://localhost:5173
```

Para o modo Supabase:
1. Execute `sql/schema.sql` no SQL Editor do seu projeto Supabase.
2. Preencha as chaves em `src/config.js`.
3. Crie um usuário no Supabase Auth e faça login (necessário para as escritas via RLS).

## Deploy na Vercel

1. Suba este repositório para o GitHub.
2. Na Vercel, importe o projeto (detecta Vite automaticamente via `vercel.json`).
3. Build: `npm run build` → output `dist`. Zero configuração adicional.

> Observação: o frontend acessa o Supabase diretamente via anon key. Para produção, recomenda-se restringir a política RLS de leitura a usuários autenticados e proteger `/admin` com autenticação do Supabase Auth.

## Estrutura

```
├── index.html            # Área pública
├── admin.html            # Painel administrativo
├── sql/schema.sql        # Tabelas PostgreSQL (jogadores, rodadas, partidas,
│                         #  estatisticas_jogador, mensalidades, caixa, demandas)
└── src/
    ├── config.js         # Configuração (Supabase, regras do jogo)
    ├── db.js             # Camada de dados (Supabase ou localStorage)
    ├── seed.js           # Dados demo
    ├── ranking.js        # Lógica de pontuação individual
    ├── ui.js             # Componentes (modal, toast, avatar, multi-select)
    ├── utils.js          # Datas, moeda, helpers
    ├── public.js         # Lógica da área pública
    └── admin.js          # Lógica do painel
```

## Regras de pontuação

A pontuação é **individual**. A cada terça os times são montados de forma diferente; o jogador soma os pontos da partida do time em que esteve naquela data:

- Vitória = **3 pts**
- Empate = **1 pt**
- Derrota = **0 pts**
