INSERT INTO nichos (id, nome, categoria_ids) VALUES ('maternidade', 'Maternidade', ARRAY['MLB1384'])
  ON CONFLICT (id) DO NOTHING;
INSERT INTO nichos (id, nome, categoria_ids) VALUES ('pet', 'Pet', ARRAY['MLB1071'])
  ON CONFLICT (id) DO NOTHING;
