alter table signals
add constraint unique_signal_per_restaurant
unique (restaurant_slug, signal_type);
