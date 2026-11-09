-- Tạo role và database cho môi trường dev trên một server PostgreSQL có sẵn.
-- Chạy bằng superuser, ví dụ:
--   docker exec -i shared-postgres psql -U postgres -v pw='mat-khau-dev' < scripts/dev-db-init.sql
-- Sau đó điền mật khẩu vào DATABASE_URL và DATABASE_URL_TEST trong .env.

CREATE ROLE my_credit LOGIN PASSWORD :'pw';
CREATE DATABASE my_credit OWNER my_credit;
CREATE DATABASE my_credit_test OWNER my_credit;
REVOKE ALL ON DATABASE my_credit, my_credit_test FROM PUBLIC;
