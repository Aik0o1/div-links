-- Login com Google: conta pode não ter senha nenhuma (só Google), e
-- precisa de um jeito de achar o usuário pelo id estável do Google (o
-- "sub" do userinfo, não o email — email pode mudar de conta pra conta
-- em teoria, sub nunca muda pra uma mesma conta Google).
ALTER TABLE usuarios ALTER COLUMN senha_hash DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN google_id TEXT;

-- Parcial (só quando não nulo) — permite múltiplas contas antigas com
-- google_id NULL sem violar unicidade, mas nunca duas contas com o MESMO
-- google_id.
CREATE UNIQUE INDEX usuarios_google_id_idx ON usuarios (google_id) WHERE google_id IS NOT NULL;
