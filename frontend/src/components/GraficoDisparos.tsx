import { useState } from "react";

export interface PontoHora {
  hora: number;
  enviados: number;
  falhas: number;
}

function proximoNumeroRedondo(valor: number): number {
  if (valor <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  for (const passo of [1, 2, 5, 10]) {
    const candidato = passo * magnitude;
    if (candidato >= valor) return candidato;
  }
  return 10 * magnitude;
}

function caminhoTopoArredondado(x: number, y: number, largura: number, altura: number, raio: number): string {
  const r = Math.max(0, Math.min(raio, altura, largura / 2));
  return `M${x},${y + altura} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + largura - r},${y} Q${x + largura},${y} ${x + largura},${y + r} L${x + largura},${y + altura} Z`;
}

const LARGURA = 960;
const ALTURA_PLOT = 180;
const MARGEM_ESQUERDA = 34;
const MARGEM_TOPO = 12;
const MARGEM_BAIXO = 22;

export function GraficoDisparos({ porHora }: { porHora: PontoHora[] }) {
  const [hover, setHover] = useState<PontoHora | null>(null);
  const [posHover, setPosHover] = useState<{ x: number; y: number } | null>(null);

  const totalDia = porHora.reduce((soma, h) => soma + h.enviados + h.falhas, 0);

  if (totalDia === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Disparos por hora (hoje)
        </h3>
        <p className="text-sm text-muted-foreground">
          Nenhum disparo hoje ainda — assim que o sistema enviar algo, o gráfico aparece aqui.
        </p>
      </div>
    );
  }

  const larguraPlot = LARGURA - MARGEM_ESQUERDA;
  const larguraSlot = larguraPlot / 24;
  const larguraBarra = Math.min(24, larguraSlot - 6);
  const maiorTotal = Math.max(...porHora.map((h) => h.enviados + h.falhas));
  const maximoEixo = proximoNumeroRedondo(maiorTotal);
  const escala = (valor: number) => (valor / maximoEixo) * ALTURA_PLOT;
  const baseY = MARGEM_TOPO + ALTURA_PLOT;

  return (
    <div className="relative rounded-lg border border-border bg-card p-5 shadow-soft">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Disparos por hora (hoje)
        </h3>
        <div className="flex gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-success" />
            Enviados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-destructive" />
            Falhas
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${LARGURA} ${MARGEM_TOPO + ALTURA_PLOT + MARGEM_BAIXO}`}
        className="block w-full"
        role="img"
        aria-label="Disparos por hora, enviados e falhas"
      >
        {[0, 0.5, 1].map((frac) => {
          const y = MARGEM_TOPO + ALTURA_PLOT - ALTURA_PLOT * frac;
          const valor = Math.round(maximoEixo * frac);
          return (
            <g key={frac}>
              <line x1={MARGEM_ESQUERDA} y1={y} x2={LARGURA} y2={y} className="stroke-border" strokeWidth={1} />
              <text x={MARGEM_ESQUERDA - 8} y={y + 4} className="fill-text-faint text-[10px]" textAnchor="end">
                {valor}
              </text>
            </g>
          );
        })}

        {porHora.map((h, i) => {
          const x = MARGEM_ESQUERDA + i * larguraSlot + (larguraSlot - larguraBarra) / 2;
          const alturaEnviados = escala(h.enviados);
          const alturaFalhas = escala(h.falhas);
          const GAP = 2;

          return (
            <g key={h.hora}>
              {h.falhas > 0 && (
                <path
                  d={caminhoTopoArredondado(
                    x,
                    baseY - alturaEnviados - alturaFalhas,
                    larguraBarra,
                    Math.max(0, h.enviados > 0 ? alturaFalhas - GAP : alturaFalhas),
                    4,
                  )}
                  className="fill-destructive"
                />
              )}
              {h.enviados > 0 &&
                (h.falhas === 0 ? (
                  <path
                    d={caminhoTopoArredondado(x, baseY - alturaEnviados, larguraBarra, alturaEnviados, 4)}
                    className="fill-success"
                  />
                ) : (
                  <rect x={x} y={baseY - alturaEnviados} width={larguraBarra} height={alturaEnviados} className="fill-success" />
                ))}

              {i % 3 === 0 && (
                <text
                  x={x + larguraBarra / 2}
                  y={MARGEM_TOPO + ALTURA_PLOT + 16}
                  className="fill-text-faint text-[10px]"
                  textAnchor="middle"
                >
                  {i}h
                </text>
              )}

              <rect
                x={MARGEM_ESQUERDA + i * larguraSlot}
                y={MARGEM_TOPO}
                width={larguraSlot}
                height={ALTURA_PLOT}
                tabIndex={0}
                fill="transparent"
                className="cursor-pointer outline-none hover:fill-primary/5 focus:fill-primary/5"
                onPointerEnter={(ev) => {
                  setHover(h);
                  const svg = (ev.target as SVGRectElement).ownerSVGElement!;
                  const retSvg = svg.getBoundingClientRect();
                  const retHit = (ev.target as SVGRectElement).getBoundingClientRect();
                  setPosHover({ x: retHit.left - retSvg.left + retHit.width / 2, y: retHit.top - retSvg.top });
                }}
                onPointerLeave={() => setHover(null)}
                onFocus={(ev) => {
                  setHover(h);
                  const svg = (ev.target as SVGRectElement).ownerSVGElement!;
                  const retSvg = svg.getBoundingClientRect();
                  const retHit = (ev.target as SVGRectElement).getBoundingClientRect();
                  setPosHover({ x: retHit.left - retSvg.left + retHit.width / 2, y: retHit.top - retSvg.top });
                }}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover && posHover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background shadow-md"
          style={{ left: posHover.x, top: posHover.y - 8 }}
        >
          <strong>{hover.hora}h</strong> — Enviados: {hover.enviados} · Falhas: {hover.falhas}
        </div>
      )}

      <details className="mt-2.5">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Ver como tabela</summary>
        <table className="mt-2.5 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-4 font-medium">Hora</th>
              <th className="py-1 pr-4 font-medium">Enviados</th>
              <th className="py-1 font-medium">Falhas</th>
            </tr>
          </thead>
          <tbody>
            {porHora
              .filter((h) => h.enviados > 0 || h.falhas > 0)
              .map((h) => (
                <tr key={h.hora} className="border-t">
                  <td className="py-1 pr-4">{h.hora}h</td>
                  <td className="py-1 pr-4">{h.enviados}</td>
                  <td className="py-1">{h.falhas}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
