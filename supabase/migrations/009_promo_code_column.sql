-- ============================================================
-- BRUE · Migration 009 — promo_code column on orders
-- ============================================================
-- Stores which promo code was used on an order so admins + receipt
-- pages can show "BRUE15 — 15% off" instead of just a discount
-- amount. The discount itself already lives in orders.discount.
--
-- Idempotent. Safe to re-run.
-- ============================================================

begin;

alter table orders
  add column if not exists promo_code text;

create index if not exists orders_promo_code_idx on orders (promo_code)
  where promo_code is not null;

commit;
