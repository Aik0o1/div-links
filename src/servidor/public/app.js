// --- Navegação entre abas ---
// Cada aba recarrega os dados ao ser aberta, pra nunca mostrar informação desatualizada.
const recarregarPorAba = {
  status: () => {
    carregarStatus();
    carregarDisparoAutomatico();
  },
  nichos: () => carregarNichos(),
  configuracoes: () => carregarConfiguracoes(),
  canais: () => carregarCanais(),
  produtos: () => carregarProdutos(),
};

document.querySelectorAll("nav button").forEach((botao) => {
  botao.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("ativa"));
    document.querySelectorAll(".secao").forEach((s) => s.classList.remove("ativa"));
    botao.classList.add("ativa");
    document.getElementById(`secao-${botao.dataset.aba}`).classList.add("ativa");
    recarregarPorAba[botao.dataset.aba]?.();
  });
});

async function api(caminho, opcoes) {
  const resposta = await fetch(`/api${caminho}`, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.erro || `Erro ${resposta.status}`);
  }
  if (resposta.status === 204) return null;
  return resposta.json();
}

function formatarPreco(valor) {
  if (valor === null || valor === undefined) return "";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// --- Status ---
async function carregarStatus() {
  const cards = document.getElementById("cards-status");
  cards.innerHTML = "Carregando...";
  try {
    const s = await api("/status");
    const itens = [
      { titulo: "Banco de dados", ok: s.db, valor: s.db ? "conectado" : "falhou" },
      { titulo: "Redis", ok: s.redis, valor: s.redis ? "conectado" : "falhou" },
      {
        titulo: "Mercado Livre (OAuth)",
        ok: s.meli.conectado,
        valor: s.meli.conectado
          ? `token válido até ${new Date(s.meli.expiraEm).toLocaleString("pt-BR")}`
          : "não autorizado — rode npm run meli:autorizar",
      },
      {
        titulo: "Telegram",
        ok: s.telegram.configurado,
        valor: s.telegram.configurado ? "bot configurado" : "TELEGRAM_BOT_TOKEN ausente",
      },
    ];
    cards.innerHTML = itens
      .map(
        (i) => `
      <div class="card ${i.ok ? "ok" : "erro"}">
        <h3>${i.titulo}</h3>
        <p>${i.valor}</p>
      </div>`,
      )
      .join("");

    atualizarCardWhatsapp(s.whatsapp);
    atualizarCardChrome(s.chrome);
    atualizarCardTelegramListener(s.telegramListener);
  } catch (err) {
    cards.innerHTML = `<div class="card erro"><p>${err.message}</p></div>`;
  }
}
document.getElementById("btn-atualizar-status").addEventListener("click", carregarStatus);

// --- Chrome (gerador de link ML) ---
function atualizarCardChrome(chrome) {
  const card = document.getElementById("card-chrome");
  const texto = document.getElementById("texto-chrome");

  card.classList.toggle("rodando", !!chrome?.conectado);
  card.classList.toggle("pausado", !chrome?.conectado);

  texto.textContent = chrome?.conectado
    ? "Janela logada aberta."
    : "Não conectado — clique em Abrir Chrome e faça login manualmente (Google bloqueia login automatizado).";
}

document.getElementById("btn-abrir-chrome").addEventListener("click", async (ev) => {
  const botao = ev.target;
  botao.disabled = true;
  botao.textContent = "Abrindo...";
  try {
    await api("/status/abrir-chrome", { method: "POST" });
    alert(
      "Janela do Chrome deve abrir em instantes. Faça login (com Google) e deixe a janela aberta — a sessão não sobrevive fechar/reabrir.",
    );
  } catch (err) {
    alert(`Falha ao abrir o Chrome: ${err.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Abrir Chrome";
    setTimeout(carregarStatus, 5000);
  }
});

// --- WhatsApp (Evolution API) ---
function atualizarCardWhatsapp(whatsapp) {
  const card = document.getElementById("card-whatsapp");
  const texto = document.getElementById("texto-whatsapp");
  const btnConectar = document.getElementById("btn-conectar-whatsapp");

  card.classList.toggle("rodando", !!whatsapp?.conectado);
  card.classList.toggle("pausado", !whatsapp?.conectado);

  if (whatsapp?.conectado) {
    texto.textContent = "Conectado.";
    btnConectar.textContent = "Reconectar";
  } else if (whatsapp?.existe) {
    texto.textContent = `Instância criada, mas desconectada (estado: ${whatsapp.estado ?? "desconhecido"}).`;
    btnConectar.textContent = "Conectar";
  } else {
    texto.textContent = "Instância ainda não criada — clique em Conectar pra gerar o QR code.";
    btnConectar.textContent = "Conectar";
  }
}

let pollQrCode = null;
let renovarQrCode = null;

function fecharModalQrCode() {
  document.getElementById("modal-qrcode").style.display = "none";
  if (pollQrCode) {
    clearInterval(pollQrCode);
    pollQrCode = null;
  }
  if (renovarQrCode) {
    clearInterval(renovarQrCode);
    renovarQrCode = null;
  }
}

document.getElementById("btn-fechar-qrcode").addEventListener("click", fecharModalQrCode);

async function buscarEExibirQrCode() {
  const conteudo = document.getElementById("qrcode-conteudo");
  try {
    const qr = await api("/whatsapp/qrcode");
    if (qr.base64) {
      conteudo.innerHTML = `<img src="${qr.base64}" alt="QR code do WhatsApp" />`;
    } else {
      conteudo.innerHTML = "<p>Já conectado, ou QR indisponível no momento.</p>";
    }
  } catch (err) {
    conteudo.innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

document.getElementById("btn-conectar-whatsapp").addEventListener("click", async () => {
  const modal = document.getElementById("modal-qrcode");
  const conteudo = document.getElementById("qrcode-conteudo");
  modal.style.display = "flex";
  conteudo.innerHTML = "Gerando QR code...";

  await buscarEExibirQrCode();

  // O QR do WhatsApp expira rápido (~20-60s) — renova sozinho enquanto o modal estiver aberto.
  renovarQrCode = setInterval(buscarEExibirQrCode, 25000);

  pollQrCode = setInterval(async () => {
    const status = await api("/whatsapp/status").catch(() => null);
    if (status?.conectado) {
      fecharModalQrCode();
      carregarStatus();
    }
  }, 3000);
});

document.getElementById("btn-listar-grupos-whatsapp").addEventListener("click", async () => {
  const lista = document.getElementById("lista-grupos-whatsapp");
  if (lista.style.display !== "none") {
    lista.style.display = "none";
    return;
  }
  lista.style.display = "block";
  lista.innerHTML = "Carregando grupos...";
  try {
    const grupos = await api("/whatsapp/grupos");
    lista.innerHTML = grupos.length
      ? grupos
          .map(
            (g) => `
      <div class="grupo-linha">
        <span>${g.nome} — <code>${g.jid}</code></span>
        <button class="btn-copiar-jid secundario" data-jid="${g.jid}">Copiar JID</button>
      </div>`,
          )
          .join("")
      : "Nenhum grupo encontrado (conecte o WhatsApp e certifique-se de que ele já participa de algum grupo).";

    lista.querySelectorAll(".btn-copiar-jid").forEach((btn) => {
      btn.addEventListener("click", () => navigator.clipboard.writeText(btn.dataset.jid));
    });
  } catch (err) {
    lista.innerHTML = `Erro ao listar grupos: ${err.message}`;
  }
});

document.getElementById("btn-monitorar-grupos-whatsapp").addEventListener("click", async () => {
  const lista = document.getElementById("lista-monitorar-grupos-whatsapp");
  if (lista.style.display !== "none") {
    lista.style.display = "none";
    return;
  }
  lista.style.display = "block";
  const caixa = document.getElementById("checkboxes-grupos-whatsapp");
  caixa.innerHTML = "Carregando grupos...";
  try {
    const [grupos, monitoradosArr, nichos] = await Promise.all([
      api("/whatsapp/grupos"),
      api("/whatsapp/grupos-monitorados"),
      api("/nichos"),
    ]);
    const monitorados = new Map((monitoradosArr || []).map((g) => [g.id, g.nicho]));

    caixa.innerHTML = grupos.length
      ? grupos
          .map(
            (g) => `
      <label class="grupo-linha">
        <span><input type="checkbox" class="chk-grupo-whatsapp" value="${g.jid}" ${monitorados.has(g.jid) ? "checked" : ""} /> ${g.nome}</span>
        <select class="sel-nicho-grupo-whatsapp" data-id="${g.jid}">${opcoesNicho(nichos, monitorados.get(g.jid))}</select>
      </label>`,
          )
          .join("")
      : "Nenhum grupo encontrado (conecte o WhatsApp e certifique-se de que ele já participa de algum grupo).";
  } catch (err) {
    caixa.innerHTML = `Erro ao listar grupos: ${err.message}`;
  }
});

document.getElementById("btn-salvar-grupos-whatsapp").addEventListener("click", async (ev) => {
  const botao = ev.target;
  const grupos = Array.from(document.querySelectorAll(".chk-grupo-whatsapp:checked")).map((chk) => ({
    id: chk.value,
    nicho: document.querySelector(`.sel-nicho-grupo-whatsapp[data-id="${chk.value}"]`).value,
  }));
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    await api("/whatsapp/grupos-monitorados", {
      method: "POST",
      body: JSON.stringify({ grupos }),
    });
    document.getElementById("lista-monitorar-grupos-whatsapp").style.display = "none";
  } catch (err) {
    alert(`Falha ao salvar grupos monitorados: ${err.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar seleção";
  }
});

// --- Monitor de grupos do Telegram (cupons e produtos de terceiros, via conta pessoal / MTProto) ---
function atualizarCardTelegramListener(status) {
  const card = document.getElementById("card-telegram-listener");
  const texto = document.getElementById("texto-telegram-listener");
  const btnConectar = document.getElementById("btn-conectar-telegram-listener");
  const btnEscolherGrupo = document.getElementById("btn-escolher-grupo-telegram");

  const numGrupos = status?.gruposMonitorados?.length ?? 0;
  const ativo = !!status?.autenticado && numGrupos > 0;
  card.classList.toggle("rodando", ativo);
  card.classList.toggle("pausado", !ativo);
  btnEscolherGrupo.disabled = !status?.autenticado;

  if (ativo) {
    texto.textContent = `Monitorando ${numGrupos} grupo(s) — cupons e produtos novos são repassados automaticamente pros seus canais ativos.`;
    btnConectar.textContent = "Reconectar";
  } else if (status?.autenticado) {
    texto.textContent = "Conectado, mas nenhum grupo selecionado ainda — clique em Grupos monitorados.";
    btnConectar.textContent = "Reconectar";
  } else {
    texto.textContent = "Não conectado — clique em Conectar e faça login com o número que vai monitorar os grupos.";
    btnConectar.textContent = "Conectar";
  }
}

function resetarModalTelegramLogin() {
  document.getElementById("form-telegram-telefone").style.display = "flex";
  document.getElementById("form-telegram-codigo").style.display = "none";
  document.getElementById("form-telegram-senha").style.display = "none";
  document.getElementById("erro-telegram-login").textContent = "";
  document.getElementById("form-telegram-telefone").reset();
  document.getElementById("form-telegram-codigo").reset();
  document.getElementById("form-telegram-senha").reset();
}

function fecharModalTelegramLogin() {
  document.getElementById("modal-telegram-login").style.display = "none";
}

document.getElementById("btn-fechar-telegram-login").addEventListener("click", fecharModalTelegramLogin);

document.getElementById("btn-conectar-telegram-listener").addEventListener("click", () => {
  resetarModalTelegramLogin();
  document.getElementById("modal-telegram-login").style.display = "flex";
});

function travarFormulario(form, textoCarregando) {
  const botao = form.querySelector("button[type=submit]");
  botao.dataset.textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoCarregando;
}

function destravarFormulario(form) {
  const botao = form.querySelector("button[type=submit]");
  botao.disabled = false;
  botao.textContent = botao.dataset.textoOriginal;
}

document.getElementById("form-telegram-telefone").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const erro = document.getElementById("erro-telegram-login");
  erro.textContent = "";
  const telefone = new FormData(ev.target).get("telefone");
  travarFormulario(ev.target, "Enviando código...");
  try {
    await api("/telegram-listener/telefone", { method: "POST", body: JSON.stringify({ telefone }) });
    ev.target.style.display = "none";
    document.getElementById("form-telegram-codigo").style.display = "flex";
  } catch (err) {
    erro.textContent = err.message;
  } finally {
    destravarFormulario(ev.target);
  }
});

document.getElementById("form-telegram-codigo").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const erro = document.getElementById("erro-telegram-login");
  erro.textContent = "";
  const codigo = new FormData(ev.target).get("codigo");
  travarFormulario(ev.target, "Confirmando...");
  try {
    const { precisaSenha } = await api("/telegram-listener/codigo", {
      method: "POST",
      body: JSON.stringify({ codigo }),
    });
    if (precisaSenha) {
      ev.target.style.display = "none";
      document.getElementById("form-telegram-senha").style.display = "flex";
    } else {
      fecharModalTelegramLogin();
      carregarStatus();
    }
  } catch (err) {
    erro.textContent = err.message;
  } finally {
    destravarFormulario(ev.target);
  }
});

document.getElementById("form-telegram-senha").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const erro = document.getElementById("erro-telegram-login");
  erro.textContent = "";
  const senha = new FormData(ev.target).get("senha");
  travarFormulario(ev.target, "Confirmando...");
  try {
    await api("/telegram-listener/senha", { method: "POST", body: JSON.stringify({ senha }) });
    fecharModalTelegramLogin();
    carregarStatus();
  } catch (err) {
    erro.textContent = err.message;
  } finally {
    destravarFormulario(ev.target);
  }
});

// Monta as <option> de nicho reaproveitadas nas listas de grupo monitorado
// (Telegram e WhatsApp) — cada grupo manda produto pra um nicho diferente.
function opcoesNicho(nichos, nichoAtual) {
  return nichos
    .map((n) => `<option value="${n.id}" ${n.id === (nichoAtual || "geral") ? "selected" : ""}>${n.nome}</option>`)
    .join("");
}

document.getElementById("btn-escolher-grupo-telegram").addEventListener("click", async () => {
  const lista = document.getElementById("lista-grupos-telegram");
  if (lista.style.display !== "none") {
    lista.style.display = "none";
    return;
  }
  lista.style.display = "block";
  const caixa = document.getElementById("checkboxes-grupos-telegram");
  caixa.innerHTML = "Carregando grupos...";
  try {
    const [grupos, status, nichos] = await Promise.all([
      api("/telegram-listener/grupos"),
      api("/telegram-listener/status"),
      api("/nichos"),
    ]);
    const monitorados = new Map((status.gruposMonitorados || []).map((g) => [g.id, g.nicho]));

    caixa.innerHTML = grupos.length
      ? grupos
          .map(
            (g) => `
      <label class="grupo-linha">
        <span><input type="checkbox" class="chk-grupo-telegram" value="${g.id}" ${monitorados.has(g.id) ? "checked" : ""} /> ${g.nome}</span>
        <select class="sel-nicho-grupo-telegram" data-id="${g.id}">${opcoesNicho(nichos, monitorados.get(g.id))}</select>
      </label>`,
          )
          .join("")
      : "Nenhum grupo/canal encontrado nessa conta.";
  } catch (err) {
    caixa.innerHTML = `Erro ao listar grupos: ${err.message}`;
  }
});

document.getElementById("btn-salvar-grupos-telegram").addEventListener("click", async (ev) => {
  const botao = ev.target;
  const grupos = Array.from(document.querySelectorAll(".chk-grupo-telegram:checked")).map((chk) => ({
    id: chk.value,
    nicho: document.querySelector(`.sel-nicho-grupo-telegram[data-id="${chk.value}"]`).value,
  }));
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    await api("/telegram-listener/grupos-monitorados", {
      method: "POST",
      body: JSON.stringify({ grupos }),
    });
    document.getElementById("lista-grupos-telegram").style.display = "none";
    carregarStatus();
  } catch (err) {
    alert(`Falha ao salvar grupos monitorados: ${err.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar seleção";
  }
});

// --- Disparo automático (iniciar/pausar) ---
async function carregarDisparoAutomatico() {
  const { ativo } = await api("/disparo-automatico");
  const card = document.getElementById("card-disparo-automatico");
  const texto = document.getElementById("texto-disparo-automatico");
  card.classList.toggle("rodando", ativo);
  card.classList.toggle("pausado", !ativo);
  texto.textContent = ativo
    ? "Rodando — verificando os canais a cada 1 minuto e disparando sozinho."
    : "Pausado — nenhum disparo automático vai acontecer até você clicar em Iniciar.";
  document.getElementById("btn-iniciar-disparo").disabled = ativo;
  document.getElementById("btn-pausar-disparo").disabled = !ativo;
}

document.getElementById("btn-iniciar-disparo").addEventListener("click", async () => {
  await api("/disparo-automatico/iniciar", { method: "POST" });
  carregarDisparoAutomatico();
});

document.getElementById("btn-pausar-disparo").addEventListener("click", async () => {
  await api("/disparo-automatico/pausar", { method: "POST" });
  carregarDisparoAutomatico();
});

// --- Nichos ---
async function carregarNichos() {
  const nichos = await api("/nichos");
  const corpo = document.querySelector("#tabela-nichos tbody");
  corpo.innerHTML = nichos
    .map(
      (n) => `
    <tr data-id="${n.id}">
      <td><input type="checkbox" class="chk-ativo" ${n.ativo ? "checked" : ""} /></td>
      <td>${n.nome}</td>
      <td><input type="text" class="txt-categorias" value="${n.categoriaIds.join(", ")}" style="width: 100%" /></td>
      <td>
        <button class="btn-salvar-nicho">Salvar</button>
        <button class="perigo btn-remover-nicho">Remover</button>
      </td>
    </tr>`,
    )
    .join("");

  corpo.querySelectorAll("tr").forEach((linha) => {
    const id = linha.dataset.id;
    linha.querySelector(".btn-salvar-nicho").addEventListener("click", async () => {
      const ativo = linha.querySelector(".chk-ativo").checked;
      const categoriaIds = linha
        .querySelector(".txt-categorias")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api(`/nichos/${id}`, { method: "PUT", body: JSON.stringify({ ativo, categoriaIds }) });
      alert(`Nicho "${id}" salvo.`);
    });
    linha.querySelector(".btn-remover-nicho").addEventListener("click", async () => {
      if (!confirm(`Remover o nicho "${id}"?`)) return;
      await api(`/nichos/${id}`, { method: "DELETE" });
      carregarNichos();
    });
  });

  await popularFiltroNicho();
}

document.getElementById("form-novo-nicho").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const dados = Object.fromEntries(new FormData(ev.target));
  dados.categoriaIds = dados.categoriaIds.split(",").map((t) => t.trim()).filter(Boolean);
  await api("/nichos", { method: "POST", body: JSON.stringify(dados) });
  ev.target.reset();
  carregarNichos();
});

// --- Configurações ---
async function carregarConfiguracoes() {
  const config = await api("/configuracoes");
  document.querySelector('#form-config [name="descontoMinimo"]').value = config.descontoMinimo;
  document.querySelector('#form-config [name="linkCupomFixo"]').value = config.linkCupomFixo || "";
  atualizarCardChamadaIA(config.chamadaIAAtiva);
}

document.getElementById("form-config").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const dados = new FormData(ev.target);
  const descontoMinimo = Number(dados.get("descontoMinimo"));
  const linkCupomFixo = dados.get("linkCupomFixo");
  await api("/configuracoes", { method: "PUT", body: JSON.stringify({ descontoMinimo, linkCupomFixo }) });
  alert("Configuração salva.");
});

// --- Chamada por IA (liga/desliga geração automática da frase de efeito) ---
function atualizarCardChamadaIA(ativa) {
  const card = document.getElementById("card-chamada-ia");
  const texto = document.getElementById("texto-chamada-ia");
  card.classList.toggle("rodando", ativa);
  card.classList.toggle("pausado", !ativa);
  texto.textContent = ativa
    ? "Ativada — disparo (manual ou automático) gera a chamada via Ollama quando o produto não tiver uma."
    : "Desativada — disparo segue sem chamada (o botão \"Gerar com IA\" na aba Produtos continua funcionando normalmente, é só o disparo automático que não chama a IA sozinho).";
  document.getElementById("btn-ativar-chamada-ia").disabled = ativa;
  document.getElementById("btn-desativar-chamada-ia").disabled = !ativa;
}

document.getElementById("btn-ativar-chamada-ia").addEventListener("click", async () => {
  const { chamadaIAAtiva } = await api("/configuracoes/chamada-ia/ativar", { method: "POST" });
  atualizarCardChamadaIA(chamadaIAAtiva);
});

document.getElementById("btn-desativar-chamada-ia").addEventListener("click", async () => {
  const { chamadaIAAtiva } = await api("/configuracoes/chamada-ia/desativar", { method: "POST" });
  atualizarCardChamadaIA(chamadaIAAtiva);
});

// --- Canais ---
async function carregarCanais() {
  const canais = await api("/canais");
  const corpo = document.querySelector("#tabela-canais tbody");
  corpo.innerHTML = canais
    .map(
      (c) => `
    <tr data-id="${c.id}">
      <td><input type="checkbox" class="chk-ativo" ${c.ativo ? "checked" : ""} /></td>
      <td><input type="text" class="txt-nome" value="${(c.nome || "").replace(/"/g, "&quot;")}" placeholder="sem nome" style="width: 130px" /></td>
      <td>${c.tipo}</td>
      <td><input type="text" class="txt-identificador" value="${c.identificadorGrupo}" /></td>
      <td><input type="text" class="txt-categorias" value="${(c.categoriasPermitidas || []).join(", ")}" placeholder="todos" /></td>
      <td><input type="number" class="num-desconto" value="${c.descontoMinimo}" style="width: 70px" /></td>
      <td><input type="number" class="num-intervalo" value="${c.intervaloMinimoMinutos}" style="width: 70px" /></td>
      <td>
        <button class="btn-salvar-canal">Salvar</button>
        <button class="perigo btn-remover-canal">Remover</button>
      </td>
    </tr>`,
    )
    .join("");

  corpo.querySelectorAll("tr").forEach((linha) => {
    const id = linha.dataset.id;
    linha.querySelector(".btn-salvar-canal").addEventListener("click", async () => {
      const ativo = linha.querySelector(".chk-ativo").checked;
      const nome = linha.querySelector(".txt-nome").value;
      const identificadorGrupo = linha.querySelector(".txt-identificador").value;
      const categoriasTexto = linha.querySelector(".txt-categorias").value.trim();
      const categoriasPermitidas = categoriasTexto
        ? categoriasTexto.split(",").map((t) => t.trim()).filter(Boolean)
        : null;
      const descontoMinimo = Number(linha.querySelector(".num-desconto").value);
      const intervaloMinimoMinutos = Number(linha.querySelector(".num-intervalo").value);
      await api(`/canais/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ativo, nome, identificadorGrupo, categoriasPermitidas, descontoMinimo, intervaloMinimoMinutos }),
      });
      alert(`Canal #${id} salvo.`);
    });
    linha.querySelector(".btn-remover-canal").addEventListener("click", async () => {
      if (!confirm(`Remover o canal #${id}?`)) return;
      await api(`/canais/${id}`, { method: "DELETE" });
      carregarCanais();
    });
  });
}

document.getElementById("form-novo-canal").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const dados = Object.fromEntries(new FormData(ev.target));
  dados.categoriasPermitidas = dados.categoriasPermitidas
    ? dados.categoriasPermitidas.split(",").map((t) => t.trim()).filter(Boolean)
    : null;
  dados.descontoMinimo = Number(dados.descontoMinimo);
  dados.intervaloMinimoMinutos = Number(dados.intervaloMinimoMinutos);
  await api("/canais", { method: "POST", body: JSON.stringify(dados) });
  ev.target.reset();
  carregarCanais();
});

// --- Produtos ---
async function popularFiltroNicho() {
  const select = document.getElementById("filtro-nicho");
  const valorAtual = select.value;
  const nichos = await api("/nichos");
  select.innerHTML =
    `<option value="">Todos os nichos</option>` +
    nichos.map((n) => `<option value="${n.id}">${n.nome}</option>`).join("");
  select.value = valorAtual;
}

async function carregarProdutos() {
  const status = document.getElementById("filtro-status").value;
  const nicho = document.getElementById("filtro-nicho").value;
  const fonte = document.getElementById("filtro-fonte").value;
  const filtros = { ...(status && { status }), ...(nicho && { nicho }), ...(fonte && { fonte }) };
  const params = new URLSearchParams(filtros);
  const produtos = await api(`/produtos?${params}`);
  const lista = document.getElementById("lista-produtos");

  const ehMonitorado = (f) => f === "telegram_terceiros" || f === "whatsapp_terceiros";

  lista.innerHTML = produtos
    .map(
      (p) => `
    <div class="produto-card" data-id="${p.id}">
      <img src="${p.imagemUrl || ""}" alt="" />
      <div class="corpo">
        <div class="badges">
          <span class="badge">${p.nicho || "-"}</span>
          <span class="badge status-${p.status}">${p.status}</span>
          ${ehMonitorado(p.fonte) ? `<span class="badge badge-monitorado">${p.fonte === "telegram_terceiros" ? "Telegram" : "WhatsApp"}</span>` : ""}
        </div>
        <div class="titulo">${p.titulo || "(sem título)"}</div>
        <div class="precos">
          ${p.precoOriginal && p.precoPromocional && p.precoOriginal > p.precoPromocional ? `<span class="riscado">${formatarPreco(p.precoOriginal)}</span>` : ""}
          <span class="final">${formatarPreco(p.precoPromocional ?? p.precoOriginal)}</span>
        </div>
        <input type="text" class="txt-chamada" placeholder="Chamada (frase de efeito)" value="${(p.chamada || "").replace(/"/g, "&quot;")}" />
        <div class="botoes-chamada">
          <button class="btn-gerar-chamada secundario">Gerar com IA</button>
          <button class="btn-salvar-chamada">Salvar</button>
        </div>
        <button class="btn-ver-canais secundario">Ver canais elegíveis</button>
        <div class="canais-elegiveis" style="display:none"></div>
        <button class="btn-apagar-produto perigo">Apagar</button>
      </div>
    </div>`,
    )
    .join("");

  lista.querySelectorAll(".produto-card").forEach((card) => {
    const id = card.dataset.id;
    const inputChamada = card.querySelector(".txt-chamada");

    card.querySelector(".btn-gerar-chamada").addEventListener("click", async (ev) => {
      const botao = ev.target;
      botao.disabled = true;
      botao.textContent = "Gerando...";
      try {
        const { chamada } = await api(`/produtos/${id}/gerar-chamada`, { method: "POST" });
        inputChamada.value = chamada;
      } catch (err) {
        alert(`Falha ao gerar chamada: ${err.message}`);
      } finally {
        botao.disabled = false;
        botao.textContent = "Gerar com IA";
      }
    });

    card.querySelector(".btn-salvar-chamada").addEventListener("click", async () => {
      await api(`/produtos/${id}/chamada`, {
        method: "PUT",
        body: JSON.stringify({ chamada: inputChamada.value }),
      });
      alert("Chamada salva.");
    });

    const botao = card.querySelector(".btn-ver-canais");
    const painel = card.querySelector(".canais-elegiveis");

    botao.addEventListener("click", async () => {
      if (painel.style.display !== "none") {
        painel.style.display = "none";
        return;
      }
      painel.innerHTML = "Carregando...";
      painel.style.display = "block";
      const canais = await api(`/produtos/${id}/canais-elegiveis`);
      painel.innerHTML = canais
        .map(
          (c) => `
        <div class="canal-linha ${c.elegivel ? "" : "inelegivel"}">
          <span>#${c.id} ${c.nome ? `<strong>${c.nome}</strong> — ` : ""}${c.tipo} (${c.identificadorGrupo})${c.motivo ? " — " + c.motivo : ""}</span>
          ${c.elegivel ? `<button class="btn-disparar" data-canal="${c.id}">Disparar</button>` : ""}
        </div>`,
        )
        .join("");

      painel.querySelectorAll(".btn-disparar").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "Enviando...";
          try {
            await api(`/produtos/${id}/disparar/${btn.dataset.canal}`, { method: "POST" });
            alert("Disparado com sucesso!");
            carregarProdutos();
          } catch (err) {
            alert(`Falha ao disparar: ${err.message}`);
            btn.disabled = false;
            btn.textContent = "Disparar";
          }
        });
      });
    });

    card.querySelector(".btn-apagar-produto").addEventListener("click", async () => {
      if (!confirm("Apagar esse produto? Não pode ser desfeito.")) return;
      try {
        await api(`/produtos/${id}`, { method: "DELETE" });
        card.remove();
      } catch (err) {
        alert(`Falha ao apagar: ${err.message}`);
      }
    });
  });
}

document.getElementById("filtro-status").addEventListener("change", carregarProdutos);
document.getElementById("filtro-nicho").addEventListener("change", carregarProdutos);
document.getElementById("filtro-fonte").addEventListener("change", carregarProdutos);

document.getElementById("btn-capturar-agora").addEventListener("click", async () => {
  const botao = document.getElementById("btn-capturar-agora");
  const resultado = document.getElementById("resultado-captura");
  botao.disabled = true;
  botao.textContent = "Capturando...";
  resultado.textContent = "";
  try {
    const r = await api("/produtos/capturar", { method: "POST" });
    resultado.textContent = `${r.novos} produto(s) novo(s), ${r.duplicados} já existente(s), ${r.ignorados} ignorado(s) (sem nicho/desconto).`;
    carregarProdutos();
  } catch (err) {
    resultado.textContent = `Erro: ${err.message}`;
  } finally {
    botao.disabled = false;
    botao.textContent = "Capturar agora";
  }
});

document.getElementById("btn-limpar-produtos").addEventListener("click", async () => {
  if (!confirm("Apagar TODOS os produtos (inclusive já enviados e o histórico de disparos deles)? Essa ação não pode ser desfeita.")) {
    return;
  }
  const botao = document.getElementById("btn-limpar-produtos");
  const resultado = document.getElementById("resultado-captura");
  botao.disabled = true;
  botao.textContent = "Limpando...";
  try {
    await api("/produtos", { method: "DELETE" });
    resultado.textContent = "Produtos apagados.";
    carregarProdutos();
  } catch (err) {
    resultado.textContent = `Erro: ${err.message}`;
  } finally {
    botao.disabled = false;
    botao.textContent = "Limpar produtos";
  }
});

// --- Inicialização ---
carregarStatus();
carregarDisparoAutomatico();
carregarNichos();
carregarConfiguracoes();
carregarCanais();
carregarProdutos();
