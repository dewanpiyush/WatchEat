alter table signals
add column if not exists last_detected timestamptz;
