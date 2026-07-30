import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { requiredTelegramListenerConfig } from "../../config/env.js";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import type { GrupoMonitoradoConfig } from "../../repositorios/configuracoes.js";
import { logger } from "../../config/logger.js";

// Conta pessoal "ouvinte" via MTProto (não é bot — só assim dá pra ler grupos
// de terceiros onde não temos um bot admin). Ver PROJECT_STATUS.md seção 2.6.
let cliente: TelegramClient | null = null;
let loginEmAndamento: { telefone: string; phoneCodeHash: string } | null = null;

async function obterCliente(): Promise<TelegramClient> {
  if (cliente) return cliente;
  const { apiId, apiHash } = requiredTelegramListenerConfig();
  const sessaoSalva = await configuracoesRepo.obterTelegramListenerSessao();
  const session = new StringSession(sessaoSalva ?? "");
  cliente = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
  await cliente.connect();
  return cliente;
}

async function salvarSessao(c: TelegramClient): Promise<void> {
  // client.session é tipado como a interface abstrata Session (save(): void),
  // mas em tempo de execução é sempre a StringSession que construímos.
  const sessao = (c.session as StringSession).save();
  await configuracoesRepo.definirTelegramListenerSessao(sessao);
}

/**
 * `msg.text`/`msg.message` só trazem o texto visível — quando o link do
 * produto está embutido como hyperlink no próprio título (estilo comum em
 * canais de afiliado: "Cortina Blackout..." como texto clicável, sem a URL
 * aparecer solta), a URL não aparece em NENHUM dos dois, mesmo com o
 * `parseMode` padrão do GramJS (que só reconstrói negrito/itálico/strike em
 * markdown — não `MessageEntityTextUrl`, ver node_modules/telegram/client/messageParse.js).
 * Sem isso, mensagens só com link embutido (sem URL visível no texto) eram
 * descartadas silenciosamente por não terem nenhuma URL detectável.
 */
function extrairTextoComLinksOcultos(msg: Api.Message): string | undefined {
  const texto = msg.text || msg.message;
  if (!texto) return undefined;

  const linksOcultos = (msg.entities ?? [])
    .filter((e): e is Api.MessageEntityTextUrl => e instanceof Api.MessageEntityTextUrl)
    .map((e) => e.url);

  return linksOcultos.length > 0 ? `${texto}\n${linksOcultos.join("\n")}` : texto;
}

export interface StatusListener {
  autenticado: boolean;
  gruposMonitorados: GrupoMonitoradoConfig[];
}

export async function statusListener(): Promise<StatusListener> {
  try {
    const c = await obterCliente();
    const autenticado = await c.isUserAuthorized();
    const gruposMonitorados = await configuracoesRepo.obterTelegramListenerGrupos();
    return { autenticado, gruposMonitorados };
  } catch (err) {
    logger.warn({ err }, "falha ao checar status do listener do Telegram");
    return { autenticado: false, gruposMonitorados: [] };
  }
}

export async function iniciarLogin(telefone: string): Promise<void> {
  const { apiId, apiHash } = requiredTelegramListenerConfig();
  const c = await obterCliente();
  const { phoneCodeHash } = await c.sendCode({ apiId, apiHash }, telefone);
  loginEmAndamento = { telefone, phoneCodeHash };
}

/** @returns precisaSenha=true quando a conta tem 2FA — chamar confirmarSenha em seguida. */
export async function confirmarCodigo(codigo: string): Promise<{ precisaSenha: boolean }> {
  if (!loginEmAndamento) {
    throw new Error("Nenhum login em andamento — informe o telefone primeiro");
  }
  const c = await obterCliente();
  try {
    await c.invoke(
      new Api.auth.SignIn({
        phoneNumber: loginEmAndamento.telefone,
        phoneCodeHash: loginEmAndamento.phoneCodeHash,
        phoneCode: codigo,
      }),
    );
    await salvarSessao(c);
    loginEmAndamento = null;
    return { precisaSenha: false };
  } catch (err: any) {
    if (err?.errorMessage === "SESSION_PASSWORD_NEEDED") {
      return { precisaSenha: true };
    }
    throw err;
  }
}

export async function confirmarSenha(senha: string): Promise<void> {
  const { apiId, apiHash } = requiredTelegramListenerConfig();
  const c = await obterCliente();
  await c.signInWithPassword(
    { apiId, apiHash },
    { password: async () => senha, onError: async () => false },
  );
  await salvarSessao(c);
  loginEmAndamento = null;
}

export interface DialogoTelegram {
  id: string;
  nome: string;
}

export async function listarDialogos(): Promise<DialogoTelegram[]> {
  const c = await obterCliente();
  const dialogos = await c.getDialogs({});
  return dialogos
    .filter((d) => d.isGroup || d.isChannel)
    .map((d) => ({ id: d.id?.toString() ?? "", nome: d.title ?? d.name ?? "(sem nome)" }))
    .filter((d): d is DialogoTelegram => d.id !== "");
}

/** Busca as últimas mensagens de um grupo (histórico, não depende do polling). */
export async function buscarMensagensRecentes(grupoId: string, limite = 10): Promise<string[]> {
  const c = await obterCliente();
  const mensagens = await c.getMessages(grupoId, { limit: limite });
  return mensagens.map(extrairTextoComLinksOcultos).filter((texto): texto is string => !!texto);
}

/** Só persiste a seleção de grupos monitorados — o polling (verificarNovasMensagens) que lê isso a cada tick. */
export async function definirGruposMonitorados(grupos: GrupoMonitoradoConfig[]): Promise<void> {
  await configuracoesRepo.definirTelegramListenerGrupos(grupos);
}

// Mensagem mais velha que isso é ignorada (mas o cursor ainda avança até
// ela, nunca mais é reconsiderada). Sem isso: se o painel fica fora do ar
// por um tempo (ex.: de madrugada) e volta, `verificarNovasMensagens`
// processa TODO o histórico acumulado desde a última mensagem vista como se
// fosse novo — capturando produto/cupom postado horas atrás, já potencialmente
// vencido/desatualizado. Bug real reportado pelo usuário.
const IDADE_MAXIMA_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Checagem por polling (chamada periodicamente por um agendador, ver
 * servidor/agendadorMonitorTelegram.ts) — substituiu o listener de evento ao
 * vivo (`client.addEventHandler(NewMessage)`), que se mostrou não confiável
 * em teste real (client conectado, sem filtro nenhum, grupo postando a cada
 * 1-3min, zero eventos em 90s). `client.getMessages()` é confiável (testado
 * repetidas vezes), então buscamos mensagens novas por ID a cada tick.
 *
 * Na primeira vez que um grupo é visto, só grava o ID mais recente como
 * baseline, sem processar nada — mantém o comportamento de "não faz
 * backfill do histórico" que já era esperado no modelo antigo.
 */
export async function verificarNovasMensagens(
  aoReceberTexto: (texto: string, grupoId: string, nicho: string) => Promise<void>,
): Promise<void> {
  const grupos = await configuracoesRepo.obterTelegramListenerGrupos();
  if (grupos.length === 0) return;

  const c = await obterCliente();
  if (!(await c.isUserAuthorized())) return;

  const ultimosIds = await configuracoesRepo.obterTelegramUltimosIds();

  for (const grupo of grupos) {
    try {
      const ultimoId = ultimosIds[grupo.id];

      if (ultimoId === undefined) {
        const [maisRecente] = await c.getMessages(grupo.id, { limit: 1 });
        if (maisRecente) {
          await configuracoesRepo.definirTelegramUltimoId(grupo.id, maisRecente.id);
        }
        continue;
      }

      const novas = await c.getMessages(grupo.id, { minId: ultimoId, limit: 30 });
      if (novas.length === 0) continue;

      const novasEmOrdem = [...novas].reverse(); // getMessages devolve mais nova primeiro
      for (const msg of novasEmOrdem) {
        const idadeMs = Date.now() - msg.date * 1000;
        if (idadeMs > IDADE_MAXIMA_MS) {
          logger.debug(
            { grupoId: grupo.id, msgId: msg.id, idadeMinutos: Math.round(idadeMs / 60000) },
            "mensagem velha demais (sistema ficou fora do ar), ignorada sem processar",
          );
          continue;
        }

        const texto = extrairTextoComLinksOcultos(msg);
        if (texto) {
          try {
            await aoReceberTexto(texto, grupo.id, grupo.nicho);
          } catch (err) {
            logger.error({ err, grupoId: grupo.id }, "falha ao processar mensagem de grupo monitorado");
          }
        }
      }

      const maiorId = Math.max(...novas.map((m) => m.id));
      await configuracoesRepo.definirTelegramUltimoId(grupo.id, maiorId);
    } catch (err) {
      logger.error({ err, grupoId: grupo.id }, "falha ao verificar mensagens novas do grupo monitorado");
    }
  }
}
