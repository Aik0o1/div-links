# Divulga Links

Sistema de automação para marketing de afiliados (Mercado Livre, por enquanto) — captura ofertas reais, gera link de afiliado e legenda, e dispara pra grupos/canais do Telegram e WhatsApp. Também monitora grupos de terceiros (cupons e produtos individuais) pra repassar automaticamente com o seu próprio link.

> Documentação completa das decisões técnicas, arquitetura e histórico do projeto: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md). Especificação original: [`PROJETO_AUTOMACAO_AFILIADOS.md`](./PROJETO_AUTOMACAO_AFILIADOS.md).

## O que o sistema faz

- **Captura ofertas reais do Mercado Livre** (aba Ofertas, por categoria/nicho configurável) e monta uma fila de produtos.
- **Gera link de afiliado real** (link curto oficial `meli.la`) e legenda (com preço, desconto e cupom) pra cada produto.
- **Dispara pro Telegram e WhatsApp** (Evolution API), manualmente ou automático, respeitando um intervalo mínimo por canal.
- **Monitora grupos de terceiros** (Telegram via MTProto/GramJS, WhatsApp via webhook da Evolution API) e repassa cupons e produtos individuais capturados de lá com o seu link — produtos de grupo monitorado furam a fila (chegam antes dos demais) e podem ser roteados por nicho.
- **Painel web** (`npm run ui`) pra configurar tudo: nichos, desconto mínimo, canais de destino, conexão do Mercado Livre/WhatsApp/Telegram, ver produtos capturados e disparar manualmente.

## Stack

Node.js + TypeScript, Express, PostgreSQL, Redis, GramJS (monitor de Telegram), Evolution API self-hosted (WhatsApp), Ollama local (geração opcional da "chamada" de cada produto). A captura e a geração de link do Mercado Livre são feitas via HTTP puro (cookie de sessão + `cheerio`) — **não precisa de Chrome nem de nenhum navegador rodando** pro sistema funcionar no dia a dia.

## Pré-requisitos

- Node.js 20+
- Docker (Postgres, Redis e Evolution API sobem via `docker compose`)
- Conta de afiliado aprovada no [programa de afiliados do Mercado Livre](https://www.mercadolivre.com.br/l/afiliados-home)
- Um navegador qualquer (Chrome, Firefox, o que preferir) — só pra pegar o cookie de sessão do Mercado Livre de vez em quando (ver passo 1 abaixo); não precisa ficar aberto rodando
- [Ollama](https://ollama.com) rodando localmente (opcional — só pra gerar a "chamada" de cada produto; sem ele o disparo segue normal, sem essa frase)

## Como rodar

```bash
npm install

cp .env.example .env
# preencha o .env com suas credenciais (ver seção abaixo)

docker compose up -d     # Postgres + Redis + Evolution API
npm run migrate          # cria o schema e o seed inicial
npm run ui               # sobe o painel em http://localhost:3400 (ou o valor de PORTA_UI)
```

Depois, ainda é preciso conectar as três integrações pelo painel (aba **Config. Afiliados** e aba **Status**) — dá pra fazer nessa ordem, sem precisar de terminal:

1. **Conectar o Mercado Livre** (aba Config. Afiliados → card "Mercado Livre" → "Conectar"): o próprio painel mostra um passo a passo com a tag de afiliado e o cookie de sessão (copiado do navegador, logado na sua conta). O cookie expira de tempos em tempos — quando parar de capturar produto novo, é só repetir esse passo com um cookie novo.
2. **Conectar o WhatsApp** (aba Status → "Conectar" → escanear o QR com o celular).
3. **Conectar o monitor de Telegram**, se for usar (aba Status → card do monitor → telefone → código → senha se tiver 2FA).

## Variáveis de ambiente

Veja [`.env.example`](./.env.example) — cada variável tem um comentário explicando de onde vem. Nichos, desconto mínimo e canais de destino **não** ficam no `.env`: são configurados pelo painel web e guardados no banco.

**Nunca** coloque valores reais de segredo no `.env.example` — só no `.env` (já ignorado pelo git).

## Comandos disponíveis

```bash
npm run docker:up / docker:down   # sobe/derruba Postgres + Redis + Evolution API
npm run migrate                   # aplica migrations pendentes
npm run ui                        # sobe o painel web
npm run capturar                  # equivalente de terminal do botão "Capturar agora"
```

## Status do projeto

Uso pessoal, em desenvolvimento ativo. Para o histórico completo de decisões e o que falta, veja [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).
