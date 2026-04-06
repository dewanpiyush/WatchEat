-- Snippets explaining why a review was flagged (max 3 phrases in app layer)
alter table reviews
  add column if not exists evidence text[] default '{}';
