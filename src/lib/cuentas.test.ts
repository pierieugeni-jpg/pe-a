import { describe, expect, it } from "vitest";
import { calcularCuentas, dividirMonto, sugerirTransferencias, type GastoInput, type PagoInput } from "./cuentas";
import { formatARS, parseMonto } from "./montos";
import { resumenWhatsApp } from "./resumen";

const juan = { id: "j", nombre: "Juan" };
const ana = { id: "a", nombre: "Ana" };
const pedro = { id: "p", nombre: "Pedro" };
const lucia = { id: "l", nombre: "Lucía" };
const martin = { id: "m", nombre: "Martín" };
const cinco = [juan, ana, pedro, lucia, martin];

const $ = (pesos: number) => pesos * 100;

const gastosEjemplo: GastoInput[] = [
  { id: "g1", monto_centavos: $(60000), pagado_por: "j", participantes: null },
  { id: "g2", monto_centavos: $(30000), pagado_por: "a", participantes: null },
  { id: "g3", monto_centavos: $(10000), pagado_por: "p", participantes: null },
];

function sumaSaldos(r: ReturnType<typeof calcularCuentas>) {
  return r.personas.reduce((s, p) => s + p.saldo, 0);
}

describe("calcularCuentas", () => {
  it("ejemplo del spec: tres transferencias exactas", () => {
    const r = calcularCuentas({ asistentes: cinco, gastos: gastosEjemplo, pagos: [] });
    expect(r.total).toBe($(100000));
    expect(r.costoPorPersona).toBe($(20000));
    const saldo = Object.fromEntries(r.personas.map((p) => [p.nombre, p.saldo]));
    expect(saldo).toEqual({ Juan: $(40000), Ana: $(10000), Pedro: $(-10000), Lucía: $(-20000), Martín: $(-20000) });
    expect(r.transferencias).toEqual([
      { de: "l", a: "j", monto: $(20000) },
      { de: "m", a: "j", monto: $(20000) },
      { de: "p", a: "a", monto: $(10000) },
    ]);
    expect(sumaSaldos(r)).toBe(0);
  });

  it("un asistente excluido de un gasto no paga nada de ese gasto", () => {
    const r = calcularCuentas({
      asistentes: [juan, ana, pedro],
      gastos: [{ id: "vino", monto_centavos: $(9000), pagado_por: "j", participantes: ["j", "a"] }],
      pagos: [],
    });
    const p = r.personas.find((x) => x.id === "p")!;
    expect(p.leToca).toBe(0);
    expect(p.saldo).toBe(0);
    expect(r.transferencias).toEqual([{ de: "a", a: "j", monto: $(4500) }]);
  });

  it("$100.000 entre 3 reparte 3.333.334 + 3.333.333 + 3.333.333 centavos y suma 0", () => {
    const partes = dividirMonto($(100000), [juan, ana, pedro]);
    // El centavo que sobra va al primero en orden alfabético (Ana).
    expect(partes.get("a")).toBe(3333334);
    expect(partes.get("j")).toBe(3333333);
    expect(partes.get("p")).toBe(3333333);
    const r = calcularCuentas({
      asistentes: [juan, ana, pedro],
      gastos: [{ id: "g", monto_centavos: $(100000), pagado_por: "j", participantes: null }],
      pagos: [],
    });
    expect(sumaSaldos(r)).toBe(0);
    expect(r.personas.map((p) => p.leToca).sort()).toEqual([3333333, 3333333, 3333334]);
  });

  it("la suma de saldos siempre da 0 (datos aleatorios)", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let caso = 0; caso < 300; caso++) {
      const gastos: GastoInput[] = Array.from({ length: 1 + Math.floor(rnd() * 15) }, (_, i) => {
        const part = cinco.filter(() => rnd() > 0.3).map((x) => x.id);
        return {
          id: `g${i}`,
          monto_centavos: 1 + Math.floor(rnd() * 5_000_000),
          pagado_por: cinco[Math.floor(rnd() * 5)].id,
          participantes: part.length ? part : null,
        };
      });
      const r = calcularCuentas({ asistentes: cinco, gastos, pagos: [] });
      expect(sumaSaldos(r)).toBe(0);
      expect(r.transferencias.length).toBeLessThanOrEqual(cinco.length - 1);
      // Aplicar las transferencias sugeridas deja todo saldado.
      const pagos: PagoInput[] = r.transferencias.map((t) => ({
        de_miembro_id: t.de,
        a_miembro_id: t.a,
        monto_centavos: t.monto,
      }));
      const r2 = calcularCuentas({ asistentes: cinco, gastos, pagos });
      expect(r2.saldado).toBe(true);
      expect(r2.personas.every((p) => p.pendiente === 0)).toBe(true);
    }
  });

  it("editar o borrar un gasto recalcula", () => {
    const sinCarbon = gastosEjemplo.filter((g) => g.id !== "g3");
    const r = calcularCuentas({ asistentes: cinco, gastos: sinCarbon, pagos: [] });
    expect(r.total).toBe($(90000));
    expect(sumaSaldos(r)).toBe(0);
    expect(r.personas.find((p) => p.id === "p")!.saldo).toBe($(-18000));
  });

  it("marcar un pago actualiza las pendientes y desmarcarlo vuelve atrás", () => {
    const pago: PagoInput = { de_miembro_id: "l", a_miembro_id: "j", monto_centavos: $(20000) };
    const con = calcularCuentas({ asistentes: cinco, gastos: gastosEjemplo, pagos: [pago] });
    expect(con.transferencias).toEqual([
      { de: "m", a: "j", monto: $(20000) },
      { de: "p", a: "a", monto: $(10000) },
    ]);
    expect(con.personas.find((p) => p.id === "l")!.pendiente).toBe(0);
    // El saldo original no cambia; solo lo pendiente.
    expect(con.personas.find((p) => p.id === "l")!.saldo).toBe($(-20000));
    const sin = calcularCuentas({ asistentes: cinco, gastos: gastosEjemplo, pagos: [] });
    expect(sin.transferencias).toHaveLength(3);
  });

  it("un pago marcado sigue contando si después se edita un gasto", () => {
    const pago: PagoInput = { de_miembro_id: "l", a_miembro_id: "j", monto_centavos: $(20000) };
    // Juan corrige la carne: eran $50.000 → total 90.000, 18.000 c/u.
    const gastos = gastosEjemplo.map((g) => (g.id === "g1" ? { ...g, monto_centavos: $(50000) } : g));
    const r = calcularCuentas({ asistentes: cinco, gastos, pagos: [pago] });
    // Lucía debía 18.000 y transfirió 20.000: ahora Juan le devuelve 2.000.
    expect(r.personas.find((p) => p.id === "l")!.pendiente).toBe($(2000));
    expect(r.personas.reduce((s, p) => s + p.pendiente, 0)).toBe(0);
  });

  it("usa el mínimo de transferencias aunque el greedy haga más", () => {
    const saldos = [
      { id: "a", nombre: "A", saldo: 4 },
      { id: "b", nombre: "B", saldo: 5 },
      { id: "c", nombre: "C", saldo: -4 },
      { id: "d", nombre: "D", saldo: -3 },
      { id: "e", nombre: "E", saldo: -3 },
      { id: "f", nombre: "F", saldo: 1 },
    ];
    // {A,C} y {B,D,E,F} → 1 + 3 = 4 transferencias; el greedy de antes daba 5.
    const t = sugerirTransferencias(saldos);
    expect(t).toHaveLength(4);
    const neto = new Map(saldos.map((s) => [s.id, s.saldo]));
    for (const x of t) {
      neto.set(x.de, neto.get(x.de)! + x.monto);
      neto.set(x.a, neto.get(x.a)! - x.monto);
    }
    expect([...neto.values()].every((v) => v === 0)).toBe(true);
  });

  it("nunca usa más transferencias que el mínimo por fuerza bruta (aleatorio)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let caso = 0; caso < 200; caso++) {
      const n = 2 + Math.floor(rnd() * 7);
      const vals = Array.from({ length: n - 1 }, () => Math.floor(rnd() * 9) - 4);
      vals.push(-vals.reduce((s, v) => s + v, 0));
      const saldos = vals.map((saldo, i) => ({ id: `p${i}`, nombre: `P${i}`, saldo }));
      const t = sugerirTransferencias(saldos);
      // Mínimo = (#no cero) − (máx. grupos que suman 0), calculado por fuerza bruta.
      const nz = vals.filter((v) => v !== 0);
      const memo = new Map<number, number>();
      const maxGrupos = (mask: number): number => {
        if (mask === 0) return 0;
        if (memo.has(mask)) return memo.get(mask)!;
        let best = 0;
        for (let sub = mask; sub; sub = (sub - 1) & mask) {
          if (!(sub & (mask & -mask))) continue;
          let s = 0;
          for (let i = 0; i < nz.length; i++) if (sub & (1 << i)) s += nz[i];
          if (s === 0) best = Math.max(best, 1 + maxGrupos(mask ^ sub));
        }
        memo.set(mask, best);
        return best;
      };
      expect(t).toHaveLength(nz.length - maxGrupos((1 << nz.length) - 1));
      const neto = new Map(saldos.map((s) => [s.id, s.saldo]));
      for (const x of t) {
        expect(x.monto).toBeGreaterThan(0);
        neto.set(x.de, neto.get(x.de)! + x.monto);
        neto.set(x.a, neto.get(x.a)! - x.monto);
      }
      expect([...neto.values()].every((v) => v === 0)).toBe(true);
    }
  });

  it("peña sin gastos está saldada", () => {
    const r = calcularCuentas({ asistentes: cinco, gastos: [], pagos: [] });
    expect(r.total).toBe(0);
    expect(r.saldado).toBe(true);
  });
});

describe("montos", () => {
  it("parsea formato es-AR", () => {
    expect(parseMonto("12.500,50")).toBe(1250050);
    expect(parseMonto("12500,5")).toBe(1250050);
    expect(parseMonto("12500")).toBe(1250000);
    expect(parseMonto("$ 12.500")).toBe(1250000);
    expect(parseMonto("12500.50")).toBe(1250050);
    expect(parseMonto("1.000.000")).toBe(100000000);
    expect(parseMonto("12,")).toBe(1200);
    expect(parseMonto("abc")).toBeNull();
    expect(parseMonto("1,2,3")).toBeNull();
    expect(parseMonto("12.50.0")).toBeNull();
    expect(parseMonto("")).toBeNull();
  });

  it("formatea pesos sin centavos cuando es redondo", () => {
    expect(formatARS(1250050)).toBe("$12.500,50");
    expect(formatARS(10000000)).toBe("$100.000");
    expect(formatARS(-1000000)).toBe("−$10.000");
    expect(formatARS(4000000, { signo: true })).toBe("+$40.000");
    expect(formatARS(5)).toBe("$0,05");
  });
});

describe("resumen WhatsApp", () => {
  it("arma el texto del ejemplo", () => {
    const r = calcularCuentas({ asistentes: cinco, gastos: gastosEjemplo, pagos: [] });
    const miembros = cinco.map((m) => ({
      ...m,
      alias_cbu: m.id === "j" ? "juan.mp" : m.id === "a" ? "ana.uala" : null,
    }));
    expect(resumenWhatsApp({ nombre: "", fecha: "2026-11-14" }, r, miembros)).toBe(
      "Peña 14/11 — Total $100.000, $20.000 c/u. Lucía → Juan $20.000 (juan.mp). " +
        "Martín → Juan $20.000 (juan.mp). Pedro → Ana $10.000 (ana.uala).",
    );
  });
});
