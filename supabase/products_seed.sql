-- ============================================================
--  products_seed.sql  (GENERADO por supabase/migrate.js)
--  Ejecutar DESPUES de schema.sql. Idempotente.
--  Combos: 4   Productos: 25   Subcategorias: 23   Links combo: 3
-- ============================================================

-- ---------- Subcategorias ----------
insert into public.subcategories (category_id, name, position)
select c.id, x.subcat, x.pos
from (values
  ('Combos', 'PC de Escritorio', 0),
  ('Componentes', 'Tarjetas de Video', 1),
  ('Componentes', 'Procesadores', 2),
  ('Periféricos', 'Teclados', 3),
  ('Computadoras', 'Monitores', 4),
  ('Periféricos', 'Audífonos', 5),
  ('Componentes', 'Tarjetas Madre Intel', 6),
  ('Componentes', 'Memorias Ram DDR5', 7),
  ('Componentes', 'SSD M.2', 8),
  ('Componentes', 'Fuentes de Poder', 9),
  ('Componentes', 'Cases', 10),
  ('Componentes', 'Enfriamiento', 11),
  ('Periféricos', 'Mouses', 12),
  ('Periféricos', 'Sillas Gamer', 13),
  ('Laptops', 'Laptops', 14),
  ('Periféricos', 'Micrófonos', 15),
  ('Periféricos', 'Controles/Volantes', 16),
  ('Impresión', 'Router y Mesh', 17),
  ('Computadoras', 'UPS / Respaldo Eléctrico', 18),
  ('Periféricos', 'Webcam', 19),
  ('Impresión', 'Impresoras', 20),
  ('Impresión', 'Accesorios', 21),
  ('Laptops', 'Accesorios', 22)
) as x(cat, subcat, pos)
join public.categories c on c.name = x.cat
where not exists (select 1 from public.subcategories);

-- ---------- Productos y Combos ----------
insert into public.products
  (name, sub, price, badge, type, image, category_id, subcategory_id, includes, meta, position)
select x.name, x.sub, x.price, x.badge, x.type, x.image,
       (select id from public.categories c where c.name = x.cat),
       (select s.id from public.subcategories s
          join public.categories c2 on c2.id = s.category_id
         where s.name = x.subcat and c2.name = x.cat),
       x.includes::jsonb, x.meta::jsonb, x.pos
from (values
  ('Combo Gamer Intel i5', 'Equipo de entrada listo para jugar en 1080p.', 499, null, 'combo', 'assets/img/combos/case1.webp', 'Combos', 'PC de Escritorio', '["Gabinete Gamer","Procesador Intel Core i5 - 7Gen","Tarjeta madre compatible","Memoria 12GB DDR4","Almacenamiento 256GB SSD M.2","Gráfica GTX 1660 Super","Fuente de poder 500W","Refrigeración incluida"]', '{"cpu_line1":"Intel Core","cpu_line2":"i5 - 7Gen","tag":"Combo","card_specs":["12GB DDR4","256GB SSD M.2","GTX 1660 Super"],"extra_image":""}', 0),
  ('Combo Ryzen 5', 'Rendimiento sólido para eSports y 1080p.', 649, null, 'combo', 'assets/img/combos/case2.webp', 'Combos', 'PC de Escritorio', '["Gabinete Gamer","Procesador AMD Ryzen 5 - 5600G","Tarjeta madre AM4","Memoria 16GB DDR4","Almacenamiento 512GB SSD M.2","Gráfica RTX 3050","Fuente de poder 600W","Refrigeración incluida"]', '{"cpu_line1":"AMD Ryzen","cpu_line2":"5 - 5600G","tag":"Combo","card_specs":["16GB DDR4","512GB SSD M.2","RTX 3050"],"extra_image":""}', 1),
  ('Combo Intel i7 DDR5', 'Plataforma DDR5 pensada para 1440p.', 949, null, 'combo', 'assets/img/combos/case3.webp', 'Combos', 'PC de Escritorio', '["Gabinete Gamer","Procesador Intel Core i7 - 12Gen","Tarjeta madre DDR5","Memoria 16GB DDR5","Almacenamiento 1TB SSD M.2","Gráfica RTX 4060","Fuente de poder 700W","Refrigeración líquida AIO"]', '{"cpu_line1":"Intel Core","cpu_line2":"i7 - 12Gen","tag":"Combo","card_specs":["16GB DDR5","1TB SSD M.2","RTX 4060"],"extra_image":""}', 2),
  ('Combo Ryzen 7 Pro', 'Máximo rendimiento en 1440p/4K. Incluye monitor.', 1399, null, 'combo', 'assets/img/combos/case4.webp', 'Combos', 'PC de Escritorio', '["Gabinete Gamer","Procesador AMD Ryzen 7 - 7800X3D","Tarjeta madre AM5","Memoria 32GB DDR5","Almacenamiento 1TB SSD M.2","Gráfica RTX 4070 Super","Fuente de poder 850W 80+ Gold","Refrigeración líquida AIO","Monitor 24\" 165Hz"]', '{"cpu_line1":"AMD Ryzen","cpu_line2":"7 - 7800X3D","tag":"Combo","card_specs":["Monitor 24\" 165Hz","32GB DDR5","1TB SSD M.2","RTX 4070 Super"],"extra_image":"assets/img/products/p-4.webp"}', 3),
  ('Tarjeta Gráfica NVIDIA GeForce RTX 4070 Super 12GB GDDR6X Gaming', '12GB GDDR6X Gaming', 799, 'Top Ventas', 'product', 'assets/img/products/p-1.webp', 'Componentes', 'Tarjetas de Video', '[]', '{"alt":"Tarjeta Gráfica RTX 4070"}', 0),
  ('Procesador AMD Ryzen 7 7800X3D de 8 Núcleos 16 Hilos hasta 5.0GHz AM5', 'AM5 8 Nucleos 5.0GHz', 389, 'Destacado', 'product', 'assets/img/products/p-2.webp', 'Componentes', 'Procesadores', '[]', '{"alt":"Procesador AMD Ryzen 7"}', 1),
  ('Teclado Mecánico Gamer RGB Pro con Switches Red Hot-Swap y RGB por Tecla', 'Switches Red Hot-Swap', 79, 'Popular', 'product', 'assets/img/products/p-3.webp', 'Periféricos', 'Teclados', '[]', '{"alt":"Teclado Mecánico RGB Pro"}', 2),
  ('Monitor Gamer Curvo 27" Samsung Odyssey G5 180Hz QHD 2560x1440 1ms FreeSync Premium', 'IPS 1ms FreeSync Premium', 269, 'Oferta', 'product', 'assets/img/products/p-4.webp', 'Computadoras', 'Monitores', '[]', '{"alt":"Monitor Gamer Curvo 27"}', 3),
  ('Audífonos Gamer 7.1 Surround', 'RGB Micrófono Reducción Ruido', 65, 'Nuevo', 'product', 'assets/img/products/p-5.webp', 'Periféricos', 'Audífonos', '[]', '{"alt":"Audífonos Gamer 7.1"}', 4),
  ('Tarjeta Gráfica NVIDIA GeForce RTX 4060 Ti 8GB GDDR6 con DLSS 3 y Ray Tracing', '8GB GDDR6 DLSS 3', 399, null, 'product', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/ZOTAC_Gaming%27s_GeForce_RTX_50_Series_Graphics_Carda.jpg/500px-ZOTAC_Gaming%27s_GeForce_RTX_50_Series_Graphics_Carda.jpg', 'Componentes', 'Tarjetas de Video', '[]', '{"alt":"RTX 4060 Ti"}', 5),
  ('Procesador Intel Core i7-14700K de 20 Núcleos hasta 5.6GHz Socket LGA1700', 'LGA1700 20 Nucleos 5.6GHz', 409, null, 'product', 'assets/img/products/p-7.webp', 'Componentes', 'Procesadores', '[]', '{"alt":"Core i7-14700K"}', 6),
  ('Tarjeta Madre ASUS ROG Strix Z790-A Gaming WiFi DDR5 LGA1700 con Wi-Fi 6E', 'DDR5 Wi-Fi 6E LGA1700', 329, null, 'product', 'assets/img/products/p-8.webp', 'Componentes', 'Tarjetas Madre Intel', '[]', '{"alt":"Z790 Motherboard"}', 7),
  ('Memoria RAM Corsair Vengeance RGB 32GB DDR5 6000MHz CL30 Kit 2x16GB', 'Kit 2x16GB 6000MHz CL30', 119, null, 'product', 'assets/img/products/p-9.webp', 'Componentes', 'Memorias Ram DDR5', '[]', '{"alt":"RAM 32GB"}', 8),
  ('SSD M.2 NVMe Samsung 990 PRO 2TB PCIe 4.0 Lectura hasta 7450 MB/s', 'Lectura hasta 7450 MB/s', 179, null, 'product', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Samsung_980_PRO_PCIe_4.0_NVMe_SSD_1TB-top_PNr%C2%B00915.jpg/500px-Samsung_980_PRO_PCIe_4.0_NVMe_SSD_1TB-top_PNr%C2%B00915.jpg', 'Componentes', 'SSD M.2', '[]', '{"alt":"SSD 2TB"}', 9),
  ('Fuente de Poder Corsair RM850x 850W 80 Plus Gold Totalmente Modular', '80 Plus Gold Modular', 139, null, 'product', 'assets/img/products/p-11.webp', 'Componentes', 'Fuentes de Poder', '[]', '{"alt":"PSU 850W"}', 10),
  ('Gabinete Lian Li O11 Dynamic EVO con Vidrio Templado Dual Chamber', 'Vidrio Templado Dual Chamber', 169, null, 'product', 'assets/img/products/p-12.webp', 'Componentes', 'Cases', '[]', '{"alt":"Case Lian Li"}', 11),
  ('Refrigeración Líquida NZXT Kraken 360 RGB AIO para Procesador', 'RGB AIO Liquid Cooler', 189, null, 'product', 'assets/img/products/p-13.webp', 'Componentes', 'Enfriamiento', '[]', '{"alt":"Enfriamiento Líquido"}', 12),
  ('Mouse Inalámbrico Logitech G Pro X Superlight 2 de 63g con Sensor HERO', 'Mouse Inalámbrico 63g', 149, null, 'product', 'assets/img/products/p-14.webp', 'Periféricos', 'Mouses', '[]', '{"alt":"Mouse Superlight"}', 13),
  ('Silla Gamer Secretlab Titan Evo Ergonómica en Cuero PU Talla Regular', 'Ergonómica Cuero PU', 549, null, 'product', 'assets/img/products/p-15.webp', 'Periféricos', 'Sillas Gamer', '[]', '{"alt":"Silla Gamer"}', 14),
  ('Laptop Gamer ASUS ROG Strix G16 Intel Core i7 RTX 4060 Pantalla 16" 240Hz', 'i7 RTX 4060 16" 240Hz', 1399, null, 'product', 'assets/img/products/p-16.webp', 'Laptops', 'Laptops', '[]', '{"alt":"Laptop Gamer"}', 15),
  ('Monitor Gamer 24" AOC 24G2SPE 165Hz IPS FHD 1920x1080 1ms FreeSync', 'FHD 1ms FreeSync', 159, null, 'product', 'assets/img/products/p-17.webp', 'Computadoras', 'Monitores', '[]', '{"alt":"Monitor 24"}', 16),
  ('Micrófono HyperX QuadCast S USB Condensador con RGB y Antipop', 'USB Condensador RGB', 159, null, 'product', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Blue_Yeti_Blackout_USB_microphone_%2851844234538%29.jpg/500px-Blue_Yeti_Blackout_USB_microphone_%2851844234538%29.jpg', 'Periféricos', 'Micrófonos', '[]', '{"alt":"QuadCast S"}', 17),
  ('Control Inalámbrico Microsoft Xbox Series X Carbon Black para PC y Consola', 'Carbon Black PC / Console', 69, null, 'product', 'assets/img/products/p-19.webp', 'Periféricos', 'Controles/Volantes', '[]', '{"alt":"Control Xbox"}', 18),
  ('Router ASUS RT-AX82U WiFi 6 Gaming con Iluminación AURA RGB', 'Gaming Router AURA RGB', 199, null, 'product', 'assets/img/products/p-20.webp', 'Impresión', 'Router y Mesh', '[]', '{"alt":"Router WiFi 6"}', 19),
  ('UPS APC Back-UPS 1500VA de Respaldo Eléctrico Automático con Regulación', 'Respaldo Eléctrico Automático', 219, null, 'product', 'assets/img/products/p-21.webp', 'Computadoras', 'UPS / Respaldo Eléctrico', '[]', '{"alt":"UPS 1500VA"}', 20),
  ('Cámara Web Logitech C920 HD Pro 1080p con Micrófono Estéreo', '1080p Streaming & Calls', 79, null, 'product', 'assets/img/products/p-22.webp', 'Periféricos', 'Webcam', '[]', '{"alt":"Webcam C920"}', 21),
  ('Impresora Epson EcoTank L3250 Multifuncional WiFi con Botellas de Tinta', 'Multifuncional WiFi Botellas', 249, null, 'product', 'assets/img/products/p-23.webp', 'Impresión', 'Impresoras', '[]', '{"alt":"Impresora EcoTank"}', 22),
  ('Kit de Herramientas iFixit Pro Tech Toolkit para Reparación de PCs y Laptops', 'Reparación PCs y Laptops', 49, null, 'product', 'https://live.staticflickr.com/688/33264146426_fde684e26e_b.jpg', 'Impresión', 'Accesorios', '[]', '{"alt":"Kit iFixit"}', 23),
  ('Base Refrigerante para Laptop RGB 17" con Ventiladores Silenciosos', 'Ventiladores Silenciosos 17"', 35, null, 'product', 'assets/img/products/p-25.webp', 'Laptops', 'Accesorios', '[]', '{"alt":"Base Cooling"}', 24)
) as x(name, sub, price, badge, type, image, cat, subcat, includes, meta, pos)
where not exists (select 1 from public.products);

-- ---------- Combo -> Productos reales (auto-detectado por nombre) ----------
insert into public.combo_items (combo_id, product_id, qty, position)
select c.id, p.id, x.qty, x.pos
from (values
  ('Combo Intel i7 DDR5', 'Tarjeta Gráfica NVIDIA GeForce RTX 4060 Ti 8GB GDDR6 con DLSS 3 y Ray Tracing', 1, 5),
  ('Combo Ryzen 7 Pro', 'Procesador AMD Ryzen 7 7800X3D de 8 Núcleos 16 Hilos hasta 5.0GHz AM5', 1, 1),
  ('Combo Ryzen 7 Pro', 'Tarjeta Gráfica NVIDIA GeForce RTX 4070 Super 12GB GDDR6X Gaming', 1, 5)
) as x(combo_name, product_name, qty, pos)
join public.products c on c.name = x.combo_name
join public.products p on p.name = x.product_name
where not exists (select 1 from public.combo_items);
