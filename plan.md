# Plan: Positions Redesign — Wheel Strategy Guide

## Archivos a modificar

1. **`src/app/positions/page.tsx`** — separar activas/historial, portfolio summary mejorado
2. **`src/components/PositionCard.tsx`** — rewrite completo, 4 estados con cost basis, P&L, CTAs
3. **`src/app/earn/page.tsx`** — leer `?side=buy|sell` de search params
4. **`src/components/v2/PriceMenuV2.tsx`** — aceptar `initialSide` prop

## Detalle por archivo

### 1. `positions/page.tsx`
- Separar posiciones en **activas** vs **historial** (settled)
- Portfolio summary con `font-mono`: Total Earned, Active Capital, Avg APR
- Activas arriba, historial abajo con header "History" colapsable o separado

### 2. `PositionCard.tsx` — 4 estados

**A) Activa (esperando expiry)**
- Premium ganado prominente en accent/mono
- Countdown: "3d left" o "Expires Mar 5"
- DistanceIndicator se mantiene
- Demo settle buttons se mantienen

**B) OTM settled (no trade, dinero regresa)**
- "You earned $350. Your money is back."
- APR logrado
- CTA: **"Earn again →"** → `/earn?side=buy` o `sell` (mismo lado)

**C) ITM settled — Put asignado (compraste ETH)** ← LA MÁS IMPORTANTE
- Badge: "Assigned" (no "Order filled")
- **Cost basis hero**: `strike - premium` en texto grande mono. Ej: "$2,983/ETH" — el número real
- **Unrealized P&L**: spot actual vs cost basis, en verde si ganancia, rojo si pérdida
  - "ETH now $3,500 → +$517/ETH (+17.3%)" actualizado con spot price
- Tono positivo: "You bought ETH below market and earned premium"
- **CTA prominente**: "Earn more — sell at a higher price →" → `/earn?side=sell`

**D) ITM settled — Call asignado (vendiste ETH)**
- "Sold {amount} ETH at ${strike}/ETH + kept ${premium}"
- Cost basis del ETH (si viene de un put previo: strike_put - premium_put)
- Profit summary: appreciation + all premiums
- CTA: "Start a new cycle →" → `/earn?side=buy`

### 3. `earn/page.tsx`
- Leer `?side=buy|sell` de `useSearchParams()`
- Pasar como `initialSide` a PriceMenuV2

### 4. `PriceMenuV2.tsx`
- Nueva prop `initialSide?: "buy" | "sell"`
- Usarla como valor inicial del `useState` de `side`

## Qué NO hacer
- No cambiar backend, no nuevos API calls
- No vincular posiciones put→call automáticamente (viene después, requiere backend)
- La card del call ITM (estado D) muestra solo su propia info por ahora — sin P&L combinado
- Mantener demo settle buttons (útiles para testing)
