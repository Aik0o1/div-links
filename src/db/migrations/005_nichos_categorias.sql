ALTER TABLE nichos DROP COLUMN termos_busca;
ALTER TABLE nichos ADD COLUMN categoria_ids TEXT[] NOT NULL DEFAULT '{}';

UPDATE nichos SET categoria_ids = ARRAY['MLB1051','MLB1000','MLB1648'] WHERE id = 'tecnologia';
UPDATE nichos SET categoria_ids = ARRAY['MLB1246'] WHERE id = 'beleza';
UPDATE nichos SET categoria_ids = ARRAY['MLB1430','MLB3937'] WHERE id = 'moda';
UPDATE nichos SET categoria_ids = ARRAY['MLB1574','MLB5726'] WHERE id = 'casa';
UPDATE nichos SET categoria_ids = ARRAY['MLB1144'] WHERE id = 'gamer';
