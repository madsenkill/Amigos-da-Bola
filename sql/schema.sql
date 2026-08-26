-- ============================================================
--  Pelada de Terça - Schema PostgreSQL / Supabase
--  Execute este script no SQL Editor do seu projeto Supabase.
--  Depois preencha SUPABASE_URL e SUPABASE_ANON_KEY em src/config.js
-- ============================================================

-- Extensão para geração de UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- JOGADORES
-- ------------------------------------------------------------
create table if not exists public.jogadores (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  posicao      text,
  foto         text,
  telefone     text,
  observacoes  text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RODADAS (cada terça-feira)
-- ------------------------------------------------------------
create table if not exists public.rodadas (
  id                 uuid primary key default gen_random_uuid(),
  data               date not null unique,
  titulo             text,
  craque_id          uuid references public.jogadores(id) on delete set null,
  craque_motivo      text,
  bola_murcha_id     uuid references public.jogadores(id) on delete set null,
  bola_murcha_motivo text,
  criado_em          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PARTIDAS (jogos de uma rodada: Time A x Time B)
-- time_a_ids / time_b_ids guardam os ids dos jogadores de cada time
-- ------------------------------------------------------------
create table if not exists public.partidas (
  id          uuid primary key default gen_random_uuid(),
  rodada_id   uuid not null references public.rodadas(id) on delete cascade,
  nome        text,
  time_a_ids  uuid[] not null default '{}',
  time_b_ids  uuid[] not null default '{}',
  gols_a      integer not null default 0,
  gols_b      integer not null default 0
);

-- ------------------------------------------------------------
-- ESTATÍSTICAS INDIVIDUAIS (pontuação por jogador na rodada)
-- resultado: VITORIA | EMPATE | DERROTA
-- pontos:    Vitória = 3, Empate = 1, Derrota = 0
-- ------------------------------------------------------------
create table if not exists public.estatisticas_jogador (
  id                  uuid primary key default gen_random_uuid(),
  rodada_id           uuid not null references public.rodadas(id) on delete cascade,
  partida_id          uuid not null references public.partidas(id) on delete cascade,
  jogador_id          uuid not null references public.jogadores(id) on delete cascade,
  time                text not null check (time in ('A', 'B', 'C', 'D')),
  resultado           text not null check (resultado in ('VITORIA', 'EMPATE', 'DERROTA')),
  pontos              integer not null default 0,
  gols                integer not null default 0,
  cartoes_amarelos    integer not null default 0,
  cartoes_vermelhos   integer not null default 0
);

-- ------------------------------------------------------------
-- MENSALIDADES (status de pagamento por jogador e mês)
-- ------------------------------------------------------------
create table if not exists public.mensalidades (
  id           uuid primary key default gen_random_uuid(),
  jogador_id   uuid not null references public.jogadores(id) on delete cascade,
  mes          text not null,          -- formato 'YYYY-MM'
  valor        numeric(10,2) not null default 0,
  vencimento   date,
  pago         boolean not null default false,
  pago_em      timestamptz,
  unique (jogador_id, mes)
);

-- ------------------------------------------------------------
-- CAIXA (entradas e saídas financeiras)
-- tipo: entrada | saida | categoria: quadra, colete, bola, mensalidade, outros
-- ------------------------------------------------------------
create table if not exists public.caixa (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('entrada', 'saida')),
  categoria   text not null default 'outros',
  descricao   text not null,
  valor       numeric(10,2) not null default 0,
  jogador_id  uuid references public.jogadores(id) on delete set null,
  mes         text not null,           -- formato 'YYYY-MM'
  criado_em   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DEMANDAS (central de urgências da diretoria)
-- prioridade: alta | media | baixa | status: pendente | fazendo | concluida
-- ------------------------------------------------------------
create table if not exists public.demandas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descricao    text,
  prioridade   text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  status       text not null default 'pendente' check (status in ('pendente', 'fazendo', 'concluida')),
  criado_em    timestamptz not null default now(),
  concluida_em timestamptz
);

-- ------------------------------------------------------------
-- ÍNDICES
-- ------------------------------------------------------------
create index if not exists idx_rodadas_data          on public.rodadas (data desc);
create index if not exists idx_partidas_rodada       on public.partidas (rodada_id);
create index if not exists idx_stats_rodada          on public.estatisticas_jogador (rodada_id);
create index if not exists idx_stats_jogador         on public.estatisticas_jogador (jogador_id);
create index if not exists idx_mensalidades_jogador  on public.mensalidades (jogador_id, mes);
create index if not exists idx_caixa_mes             on public.caixa (mes);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (opção padrão sugerida)
-- Leitura pública e escrita autenticada.
-- Ajuste conforme a política da sua diretoria.
-- ------------------------------------------------------------
alter table public.jogadores            enable row level security;
alter table public.rodadas              enable row level security;
alter table public.partidas             enable row level security;
alter table public.estatisticas_jogador enable row level security;
alter table public.mensalidades         enable row level security;
alter table public.caixa                enable row level security;
alter table public.demandas             enable row level security;

-- Leitura para todos (anon + autenticado)
create policy "leitura publica jogadores"            on public.jogadores            for select using (true);
create policy "leitura publica rodadas"              on public.rodadas              for select using (true);
create policy "leitura publica partidas"             on public.partidas             for select using (true);
create policy "leitura publica estatisticas"         on public.estatisticas_jogador for select using (true);
create policy "leitura publica mensalidades"         on public.mensalidades         for select using (true);
create policy "leitura publica caixa"                on public.caixa                for select using (true);
create policy "leitura publica demandas"             on public.demandas             for select using (true);

-- Escrita apenas para usuários autenticados
create policy "escrita autenticada jogadores"            on public.jogadores            for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "escrita autenticada rodadas"              on public.rodadas              for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "escrita autenticada partidas"             on public.partidas             for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "escrita autenticada estatisticas"         on public.estatisticas_jogador for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "escrita autenticada mensalidades"         on public.mensalidades         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "escrita autenticada caixa"                on public.caixa                for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "escrita autenticada demandas"             on public.demandas             for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
