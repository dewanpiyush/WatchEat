alter table signals
  add column if not exists severity text;

alter table signals
  drop constraint if exists signals_severity_check;

alter table signals
  add constraint signals_severity_check
  check (severity is null or severity in ('high', 'medium', 'low'));
