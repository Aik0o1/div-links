import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12; // recomendado pro GCM

/**
 * Criptografia em repouso pra config sensível guardada em `configuracoes`
 * (cookie de sessão do Mercado Livre, sessão MTProto do Telegram) — hoje
 * ficavam em texto puro no Postgres; um dump/vazamento do banco expunha
 * essas credenciais diretamente. AES-256-GCM (autenticado — detecta
 * adulteração, não só decifra) via `node:crypto`, sem dependência nova.
 *
 * Formato guardado: `iv.tag.cifrado`, cada parte em base64, separadas por
 * ponto (não aparece em base64 padrão, seguro como delimitador).
 */
function chave(): Buffer {
  const chaveHex = process.env.CONFIG_ENCRYPTION_KEY;
  if (!chaveHex) {
    throw new Error(
      "Variável de ambiente CONFIG_ENCRYPTION_KEY ausente — necessária pra criptografar/descriptografar cookie do ML e sessão do Telegram. Gere uma com `openssl rand -hex 32`.",
    );
  }
  const buffer = Buffer.from(chaveHex, "hex");
  if (buffer.length !== 32) {
    throw new Error("CONFIG_ENCRYPTION_KEY precisa ser uma chave hex de 32 bytes (64 caracteres) — gere com `openssl rand -hex 32`.");
  }
  return buffer;
}

export function criptografarConfig(textoPlano: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, cifrado].map((buf) => buf.toString("base64")).join(".");
}

function pareceValorCriptografado(valor: string): boolean {
  // iv em base64 (12 bytes) e tag em base64 (16 bytes) têm tamanho fixo —
  // usado só pra distinguir de um valor legado em texto puro (ver
  // descriptografarConfig), não é uma validação de segurança.
  const partes = valor.split(".");
  return partes.length === 3 && partes.every((p) => /^[A-Za-z0-9+/]+=*$/.test(p));
}

/**
 * Descriptografa um valor salvo por `criptografarConfig`. **Tolerante a
 * valor legado em texto puro** (mesmo padrão de auto-migração já usado em
 * `migrarGruposMonitorados`, configuracoes.ts): cookie/sessão salvos antes
 * dessa mudança continuam sendo lidos normalmente (como texto puro) até a
 * próxima vez que forem regravados — aí já saem criptografados. Sem
 * precisar de um script de migração one-off separado.
 */
export function descriptografarConfig(valorSalvo: string): string {
  if (!pareceValorCriptografado(valorSalvo)) return valorSalvo;

  try {
    const [ivB64, tagB64, cifradoB64] = valorSalvo.split(".");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const cifrado = Buffer.from(cifradoB64, "base64");
    const decipher = createDecipheriv(ALGORITMO, chave(), iv);
    decipher.setAuthTag(tag);
    const decifrado = Buffer.concat([decipher.update(cifrado), decipher.final()]);
    return decifrado.toString("utf8");
  } catch {
    // Formato bateu por coincidência (raro, mas um valor legado em texto
    // puro podia teoricamente ter 3 partes separadas por ponto, tudo
    // caracteres base64-like) — decifrar falhou, trata como texto puro.
    return valorSalvo;
  }
}
