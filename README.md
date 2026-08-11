# Divulga Links

Sistema de automação para marketing de afiliados (Mercado Livre, por enquanto) — captura ofertas reais, gera link de afiliado e legenda, e dispara pra grupos/canais do Telegram e WhatsApp. Também monitora grupos de terceiros (cupons e produtos individuais) pra repassar automaticamente com o seu próprio link.

> Documentação completa das decisões técnicas, arquitetura e histórico do projeto: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md). Especificação original: [`PROJETO_AUTOMACAO_AFILIADOS.md`](./PROJETO_AUTOMACAO_AFILIADOS.md).

## O que o sistema faz

- **Captura ofertas reais do Mercado Livre** (scraping da aba Ofertas, por categoria/nicho configurável) e monta uma fila de produtos.
- **Gera link de afiliado real** (via link builder oficial do ML) e legenda (com preço, desconto e cupom) pra cada produto.
- **Dispara pro Telegram e WhatsApp** (Evolution API), manualmente ou automático, respeitando um intervalo mínimo por canal.
- **Monitora grupos de terceiros** (Telegram via MTProto/GramJS, WhatsApp via webhook da Evolution API) e repassa cupons e produtos individuais capturados de lá com o seu link — produtos de grupo monitorado furam a fila (chegam antes dos demais) e podem ser roteados por nicho.
- **Painel web** (`npm run ui`) pra configurar tudo: nichos, desconto mínimo, canais de destino, conexão do WhatsApp/Telegram, ver produtos capturados e disparar manualmente.

## Stack

Node.js + TypeScript, Express, PostgreSQL, Redis, Playwright (conectado via CDP numa janela real do Chrome, pro scraping e link builder), GramJS (monitor de Telegram), Evolution API self-hosted (WhatsApp), Ollama local (geração opcional da "chamada" de cada produto).

## Pré-requisitos

- Node.js 20+
- Docker (Postgres, Redis e Evolution API sobem via `docker compose`)
- Google Chrome instalado localmente
- [Ollama](https://ollama.com) rodando localmente (opcional — só pra gerar a "chamada" de cada produto; sem ele o disparo segue normal, sem essa frase)
- Conta de afiliado aprovada no Mercado Livre + app OAuth em [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)

## Como rodar

```bash
npm install
npx playwright install chromium

cp .env.example .env
# preencha o .env com suas credenciais (ver seção abaixo)

docker compose up -d     # Postgres + Redis + Evolution API
npm run migrate          # cria o schema e o seed inicial
npm run ui               # sobe o painel em http://localhost:3400 (ou o valor de PORTA_UI)
```

Depois, ainda é preciso (uma vez cada, feito pelo painel ou terminal):

1. **Autorizar o Mercado Livre**: `npm run meli:autorizar` (abre uma URL, autoriza, cola o `?code=...` de volta no terminal).
2. **Abrir e logar o Chrome do link builder** (janela real, usada pra gerar links de afiliado e fazer scraping — cada captura abre sua própria aba em segundo plano *dentro* dessa janela, sem tirar o foco de você, mas **a janela em si não pode ficar minimizada**: o Chrome para de renderizar frames de janela minimizada/oculta, e a automação trava esperando um clique "estabilizar" que nunca chega):
   ```bash
   google-chrome --remote-debugging-port=9222 \
     --disable-backgrounding-occluded-windows \
     --disable-renderer-backgrounding \
     --user-data-dir="<caminho-do-projeto>/.playwright-ml-session" \
     "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub"
   ```
   Ou pelo próprio painel (aba Status → "Abrir Chrome"). Logue com sua conta do Mercado Livre e deixe a janela aberta e **não minimizada** (pode ficar atrás de outras, num monitor secundário, etc. — só não minimizada).
3. **Conectar o WhatsApp** (aba Status → "Conectar" → escanear o QR).
4. **Conectar o monitor de Telegram**, se for usar (aba Status → card do monitor → telefone → código → senha se tiver 2FA).

## Variáveis de ambiente

Veja [`.env.example`](./.env.example) — cada variável tem um comentário explicando de onde vem. Nichos, desconto mínimo e canais de destino **não** ficam no `.env`: são configurados pelo painel web e guardados no banco.

**Nunca** coloque valores reais de segredo no `.env.example` — só no `.env` (já ignorado pelo git).

## Comandos disponíveis

```bash
npm run docker:up / docker:down   # sobe/derruba Postgres + Redis + Evolution API
npm run migrate                   # aplica migrations pendentes
npm run meli:autorizar            # autoriza (ou renova) o OAuth do Mercado Livre
npm run ui                        # sobe o painel web
npm run capturar                  # equivalente de terminal do botão "Capturar agora"
```

## Status do projeto

Uso pessoal, em desenvolvimento ativo. Para o histórico completo de decisões e o que falta, veja [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).
