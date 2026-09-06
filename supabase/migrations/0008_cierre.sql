-- Entrega 12 · Los dos últimos puntos de la especificación.

-- La devolución avisa, tal como pide el módulo 3. El aviso se crea desde el
-- mismo trigger que aplica la devolución, así que llega venga por donde venga.
alter type tipo_aviso add value if not exists 'pieza_devuelta';
