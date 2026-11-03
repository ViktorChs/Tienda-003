-- ============================================================
--  PRUEBA DE AISLAMIENTO MULTI-TIENDA  (limpieza)
-- ============================================================
--  Borra la tienda de prueba y TODO lo suyo (cascada:
--  categorias, productos, temas, pedidos de esa tienda).
-- ============================================================

delete from public.stores where slug = 'tienda-test';
