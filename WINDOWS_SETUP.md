# Rodando no Windows (via WSL2)

O sistema abre o Chrome de verdade pra raspar o Mercado Livre chamando o
binário `google-chrome` — nome de comando do Linux, não existe no Windows.
Por isso, a forma recomendada de rodar no Windows é dentro do **WSL2**
(Windows Subsystem for Linux): roda tudo exatamente como já funciona hoje
(é Linux por baixo), sem precisar mexer em código.

## 1. Instalar o WSL2

No PowerShell, como administrador:

```powershell
wsl --install -d Ubuntu
```

Reinicia o PC quando pedir. Na primeira abertura do Ubuntu, cria seu
usuário/senha Linux.

## 2. Docker Desktop

Instala o [Docker Desktop pro Windows](https://www.docker.com/products/docker-desktop/),
abre ele, vai em **Settings → Resources → WSL Integration** e ativa a
integração com a distro Ubuntu.

## 3. Dentro do Ubuntu (WSL2) — instalar Node e Chrome

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o chrome.deb
sudo apt install -y ./chrome.deb
```

## 4. Clonar e configurar o projeto

```bash
git clone <url-do-seu-repo>
cd divulgalinks
npm install
npx playwright install chromium

cp .env.example .env
# preenche o .env com suas credenciais (Telegram, Evolution/WhatsApp, Shopee)
```

## 5. Subir tudo

```bash
docker compose up -d
npm run migrate
npm run ui
```

Painel em `http://localhost:3400` — acessível direto do navegador do
Windows, sem configuração extra (o WSL2 expõe as portas automaticamente).

## 6. Passos únicos (pelo painel, aba Status)

- **Abrir Chrome**: o Chrome abre como janela normal na sua área de
  trabalho do Windows (WSLg cuida disso automaticamente no Windows 11/10
  atualizado) — loga no Mercado Livre e deixa aberto.
- **Conectar WhatsApp**: escaneia o QR code.
- **Conectar Telegram** (se for usar grupos monitorados): telefone →
  código → senha (se tiver 2FA).

## Alternativa: Windows nativo (sem WSL2)

Mais fricção — precisa Docker Desktop, Node 20+ pro Windows, e o código
que abre o Chrome (`src/servidor/rotas/status.ts`) precisaria ser ajustado
pra funcionar sem WSL, já que hoje só reconhece o comando `google-chrome`
(no Windows seria o caminho completo do executável, tipo
`C:\Program Files\Google\Chrome\Application\chrome.exe`). Não recomendado
a menos que WSL2 não seja uma opção.
