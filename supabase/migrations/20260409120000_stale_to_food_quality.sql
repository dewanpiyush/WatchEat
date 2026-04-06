-- Rename legacy signal key `stale` → `food_quality` (reviews + aggregated signals).

-- reviews.signal_labels: replace element
update reviews
set signal_labels = array_replace(signal_labels, 'stale', 'food_quality')
where signal_labels is not null
  and 'stale' = any (signal_labels);

-- signals: merge stale row into existing food_quality for same restaurant, then drop stale
update signals as fq
set
  count = fq.count + s.count,
  last_detected = case
    when fq.last_detected is null then s.last_detected
    when s.last_detected is null then fq.last_detected
    when fq.last_detected >= s.last_detected then fq.last_detected
    else s.last_detected
  end,
  severity = case
    when fq.severity = 'high' or s.severity = 'high' then 'high'
    when fq.severity = 'medium' or s.severity = 'medium' then 'medium'
    else coalesce(fq.severity, s.severity)
  end
from signals s
where s.signal_type = 'stale'
  and fq.signal_type = 'food_quality'
  and fq.restaurant_slug = s.restaurant_slug;

delete from signals s
where s.signal_type = 'stale'
  and exists (
    select 1
    from signals fq
    where fq.restaurant_slug = s.restaurant_slug
      and fq.signal_type = 'food_quality'
  );

update signals
set signal_type = 'food_quality'
where signal_type = 'stale';
