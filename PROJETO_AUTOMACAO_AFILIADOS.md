# Sistema de Automação para Afiliados — Especificação do Projeto

## 1. Objetivo

Construir um sistema que:

1. **Captura** produtos, promoções e cupons do Mercado Livre e Shopee (via API oficial de afiliados).
2. **Monitora** grupos de WhatsApp e canais/grupos de Telegram de terceiros, capturando links de produtos postados neles.
3. **Normaliza e deduplica** os produtos capturados.
4. **Gera o link de afiliado** próprio para cada produto.
5. **Gera uma arte/imagem** no formato de card promocional (imagem do produto + nome + preço + link).
6. **Dispara automaticamente** esse card para grupos do WhatsApp e canais do Telegram configurados pelo usuário, respeitando regras de filtro, horário e limite de frequência.

Referência visual do card final: imagem estilo "SEU CARRO CHEIROSO SEMPRE — kit com 3 200ml cada — Por: R$43 (14 CADA) — Link: https://meli.la/xxxx".

---

## 2. Arquitetura Geral

Pipeline orientado a eventos/filas — cada etapa é desacoplada da seguinte por uma fila, para que falha em um componente (ex. sessão do WhatsApp cair) não trave o resto do sistema.

```
[Captura] → [Parser/Normalização] → [Deduplicação] → [Geração de Link de Afiliado]
        → [Geração de Arte] → [Motor de Regras] → [Fila de Disparo] → [Canais de Saída]
```

### Stack recomendada

| Camada | Tecnologia |
|---|---|
| Linguagem principal | Node.js (TypeScript) |
| Fila / jobs | Redis + BullMQ |
| Banco relacional | PostgreSQL |
| Cache / deduplicação | Redis |
| Geração de imagem | Playwright (HTML/CSS → screenshot) |
| Bot Telegram | Telegram Bot API (node-telegram-bot-api ou grammY) |
| Escuta de grupos Telegram | MTProto via GramJS (para ler grupos onde a conta é apenas membro) |
| WhatsApp (envio e escuta) | Evolution API (self-hosted, camada REST/webhook sobre o protocolo do WhatsApp Web) |
| Observabilidade | Logs estruturados (pino/winston) + métricas (Prometheus opcional) |

> **Nota de engenharia importante:** priorizar sempre a API oficial quando ela existir (Mercado Livre e Shopee possuem programas de afiliados com API). A integração com WhatsApp será feita via **Evolution API** (self-hosted), que abstrai o protocolo não-oficial e expõe REST + webhooks. Ainda assim, por rodar sobre engenharia reversa do protocolo do WhatsApp, esse componente deve ser tratado como **instável por natureza**: isolado, com reconexão/resubscrição automática de sessão, nunca como dependência crítica do restante do pipeline.

---

## 3. Módulos do Sistema

### 3.1 Módulo de Captura

Cada fonte implementa a mesma interface, permitindo adicionar novas fontes sem alterar o resto do sistema:

```ts
interface FonteDeProdutos {
  nome: string;
  buscar(): Promise<ProdutoBruto[]>;
}
```

**Fontes a implementar:**

- `FonteMercadoLivre`: consome a API de afiliados do Mercado Livre (busca por categoria/palavra-chave/ofertas do dia).
- `FonteShopee`: consome a API de afiliados da Shopee.
- `FonteTelegramGrupos`: escuta mensagens novas em grupos/canais do Telegram (via MTProto, conta "ouvinte").
- `FonteWhatsAppGrupos`: recebe mensagens novas dos grupos do WhatsApp via **webhook da Evolution API** (evento `messages.upsert`), configurado para a instância/número ouvinte que participa desses grupos.

Cada fonte roda como um worker independente, publicando mensagens brutas em uma fila `captura.bruta`. No caso do WhatsApp, o próprio endpoint de webhook (um pequeno servidor HTTP) já publica direto na fila ao receber o evento — não há polling.

### 3.2 Parser / Normalização

Consome a fila `captura.bruta`. Responsabilidades:

1. Extrair URLs do texto bruto (regex).
2. Identificar a plataforma pelo domínio (mercadolivre.com.br, shopee.com.br, encurtadores como meli.la).
3. Resolver links encurtados seguindo redirects até a URL final do produto.
4. Extrair `titulo`, `preco_original`, `preco_promocional`, `cupom` do texto — usar um modelo de linguagem com prompt estruturado retornando JSON estrito para esse parsing quando o texto for livre/não estruturado.
5. Publicar o resultado normalizado na fila `produtos.normalizados`.

### 3.3 Deduplicação

Antes de seguir no pipeline, calcular um hash (`sha1(titulo + preco + url_produto)`) e verificar no Redis/Postgres se já foi processado nas últimas N horas. Produto duplicado é descartado (ou apenas tem contador de "visto em X grupos" incrementado, sem novo disparo).

### 3.4 Geração de Link de Afiliado

```ts
interface GeradorDeLinkAfiliado {
  plataforma: string;
  gerar(urlProduto: string): Promise<string>;
}
```

Implementações: `LinkMercadoLivre`, `LinkShopee`. Resultado cacheado — nunca gerar o mesmo link duas vezes.

### 3.5 Geração de Arte

Template HTML/CSS parametrizado com: imagem do produto, nome do canal/marca, título, descrição curta, preço, badge de desconto, link de afiliado. Renderizado com Playwright (`page.screenshot()`) gerando um PNG/JPEG pronto para envio.

### 3.6 Motor de Regras

Antes de entrar na fila de disparo, cada produto passa por filtros configuráveis por canal de destino:

- Categoria permitida
- Desconto mínimo (%)
- Horário permitido de disparo
- Intervalo mínimo entre disparos no mesmo canal (anti-spam / anti-banimento)

Tabela de configuração:

```sql
CREATE TABLE canais_destino (
  id SERIAL PRIMARY KEY,
  tipo TEXT CHECK (tipo IN ('whatsapp', 'telegram')),
  identificador_grupo TEXT NOT NULL,
  categorias_permitidas TEXT[],
  desconto_minimo NUMERIC DEFAULT 0,
  intervalo_minimo_minutos INTEGER DEFAULT 15,
  ativo BOOLEAN DEFAULT true
);
```

### 3.7 Fila de Disparo e Envio

- **Telegram**: envio via Bot API (`sendPhoto` + caption). Estável e dentro dos termos de uso.
- **WhatsApp**: envio via endpoint REST da Evolution API (`/message/sendMedia` ou equivalente da versão instalada), usando a instância configurada. Aplicar:
  - Intervalo aleatório entre mensagens (nunca fixo)
  - Rodízio de múltiplas instâncias/números na Evolution API se o volume for alto
  - Circuit breaker: pausar automaticamente o canal após N falhas consecutivas de envio (ex.: instância desconectada, número banido)
  - Monitorar o status da instância (endpoint de status/QR code da Evolution API) para detectar desconexão e disparar alerta/reconexão

### 3.8 Observabilidade

- Log estruturado por etapa (captura → parse → link → arte → envio), com IDs de correlação por produto.
- Métricas: produtos capturados/hora, taxa de erro de parsing, taxa de sucesso de envio, tempo médio de cada etapa.
- Alertas quando uma fonte para de retornar dados (ex.: sessão do WhatsApp caiu, grupo do Telegram ficou inacessível).

---

## 4. Modelo de Dados (núcleo)

```sql
CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  fonte TEXT NOT NULL,
  url_original TEXT NOT NULL,
  url_afiliado TEXT,
  titulo TEXT,
  preco_original NUMERIC,
  preco_promocional NUMERIC,
  imagem_url TEXT,
  cupom TEXT,
  hash_conteudo TEXT UNIQUE,
  status TEXT DEFAULT 'capturado', -- capturado | aprovado | agendado | enviado | expirado
  criado_em TIMESTAMP DEFAULT now()
);

CREATE TABLE disparos (
  id SERIAL PRIMARY KEY,
  produto_id INTEGER REFERENCES produtos(id),
  canal_id INTEGER REFERENCES canais_destino(id),
  status TEXT DEFAULT 'pendente', -- pendente | enviado | falhou
  enviado_em TIMESTAMP
);
```

---

## 5. Roadmap de Implementação (incremental, cada etapa já é utilizável)

1. **Fundação**: banco de dados (schema acima) + estrutura de filas (Redis/BullMQ).
2. **Captura oficial**: conector Mercado Livre + Shopee via API de afiliados (sem grupos ainda).
3. **Geração de link de afiliado** com cache.
4. **Geração de arte** (template HTML/CSS → screenshot via Playwright).
5. **Bot do Telegram** enviando para 1 canal de teste — nesse ponto já existe um MVP funcional ponta a ponta.
6. **Motor de regras** (filtros de categoria, desconto, horário, intervalo).
7. **Escuta de grupos do Telegram** (captura de terceiros).
8. **Integração com WhatsApp via Evolution API**: primeiro subir a instância (Docker) e validar envio manual para um grupo de teste; depois configurar o webhook de recebimento (`messages.upsert`) para captura de grupos de terceiros — deixar por último por ser a parte mais instável/sensível a bloqueio.
9. **Observabilidade** (logs, métricas, alertas) — deve evoluir junto com cada etapa acima, não só no final.

---

## 6. Riscos e Cuidados Técnicos

- **WhatsApp não possui API oficial para leitura/envio automatizado em grupos de terceiros.** A Evolution API roda sobre engenharia reversa do protocolo (via Baileys por baixo dos panos) e o uso foge dos termos de serviço da Meta, com risco real de banimento do número usado — isso não muda por estar atrás de uma API REST. Tratar como componente isolado e substituível, nunca como núcleo do sistema. Recomendado: usar números "descartáveis"/secundários para as instâncias de escuta e envio, nunca o número principal do negócio.
- **Infraestrutura própria**: a Evolution API precisa ser hospedada (Docker é o caminho mais simples) e cada instância mantém uma sessão de WhatsApp Web autenticada por QR code — planeje um processo (manual ou semi-automatizado) para reautenticação quando a sessão cair.
- **Rate limiting**: toda integração externa (APIs de afiliados, Telegram, WhatsApp) precisa de backoff exponencial e circuit breaker.
- **Deduplicação é obrigatória**: sem ela, o mesmo produto visto em vários grupos gera disparos repetidos e parece spam.
- **Separar ambiente de teste do de produção** antes de conectar contas reais de WhatsApp/Telegram aos grupos de clientes/uso real.

---

## 7. Instrução para o Claude Code

> Use este documento como especificação de referência. Comece pelo passo 1 do roadmap (seção 5), criando a estrutura de pastas do projeto, o schema do banco (seção 4) e a configuração de filas. Peça confirmação antes de avançar para a próxima etapa do roadmap. Priorize sempre as APIs oficiais do Mercado Livre e Shopee antes de qualquer scraping. Isole a integração com WhatsApp em um módulo separado e substituível, conforme a seção 6.
