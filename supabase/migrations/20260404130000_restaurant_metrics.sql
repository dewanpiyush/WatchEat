create table if not exists restaurant_metrics (
  restaurant_slug text primary key,
  total_reviews integer not null default 0,
  reviews_with_signals integer not null default 0,
  clean_percentage double precision not null default 100
);
