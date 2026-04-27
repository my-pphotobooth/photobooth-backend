-- Up Migration

INSERT INTO frame_categories (id, name, sort_order) VALUES
  ('basic', '기본', 0),
  ('gyeongmin', '경민', 1);

INSERT INTO frames
  (id, name, category_id, background_color, text_color, footer_text, overlays, sort_order)
VALUES
  ('basic-white', '기본 화이트', 'basic', '#ffffff', '#1f2937', 'my-photobooth', NULL, 0),
  ('basic-black', '기본 블랙', 'basic', '#18181b', '#f4f4f5', 'my-photobooth', NULL, 1),
  ('with-me', 'with me', 'gyeongmin', '#ffffff', '#1f2937', 'my-photobooth',
    '[
      {"src":"/me/1.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/2.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/3.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/4.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/1.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/2.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/3.png","right":0,"bottom":0,"height":0.8},
      {"src":"/me/4.png","right":0,"bottom":0,"height":0.8}
    ]'::jsonb, 0);

-- Down Migration

DELETE FROM frames WHERE id IN ('basic-white', 'basic-black', 'with-me');
DELETE FROM frame_categories WHERE id IN ('basic', 'gyeongmin');
