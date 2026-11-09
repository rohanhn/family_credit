-- Sổ cái chỉ ghi thêm (design D3, spec currency-ledger): chặn UPDATE, DELETE và TRUNCATE
-- trên transactions ở tầng database. Sửa sai bằng giao dịch điều chỉnh (kind = 'adjust').
CREATE FUNCTION transactions_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Sổ cái chỉ ghi thêm: không được % trên transactions', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER transactions_no_update_delete
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_append_only();
--> statement-breakpoint
CREATE TRIGGER transactions_no_truncate
  BEFORE TRUNCATE ON transactions
  FOR EACH STATEMENT EXECUTE FUNCTION transactions_append_only();
