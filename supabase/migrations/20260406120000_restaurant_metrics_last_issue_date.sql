alter table restaurant_metrics
  add column if not exists last_issue_date timestamptz;
