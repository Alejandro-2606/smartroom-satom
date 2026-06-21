-- ============================================
-- SmartRoom / SATOM — Esquema de base de datos
-- Ejecutar en NeonTech (SQL Editor o psql)
-- ============================================

-- Extensión para generar UUIDs automáticamente
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------- Tabla: usuarios (para el login) -----------
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ----------- Tabla: salas -----------
CREATE TABLE IF NOT EXISTS salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL,
    piso INT NOT NULL,
    edificio VARCHAR(50) NOT NULL,
    aforo_max INT NOT NULL,
    ocupacion_actual INT NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
        CHECK (estado IN ('disponible', 'ocupada', 'llena')),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ----------- Tabla: eventos -----------
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id UUID NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    conteo_post INT NOT NULL,
    sensor_origen VARCHAR(50)
);

-- Índice para acelerar las consultas de historial por sala y fecha
CREATE INDEX IF NOT EXISTS idx_eventos_sala_timestamp
    ON eventos (sala_id, timestamp DESC);

-- ----------- Tabla: sensores -----------
CREATE TABLE IF NOT EXISTS sensores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id UUID NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,        -- ej: 'ToF_VL53L0X', 'Radar_LD2410C'
    modelo VARCHAR(50),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'calibrando', 'inactivo')),
    ultima_lectura TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- DATOS DE PRUEBA (opcional, para probar el sitio)
-- ============================================

INSERT INTO salas (nombre, piso, edificio, aforo_max, ocupacion_actual, estado)
VALUES
    ('Sala A-101', 1, 'A', 30, 9, 'disponible'),
    ('Sala A-204', 2, 'A', 40, 40, 'llena'),
    ('Sala B-301', 3, 'B', 25, 18, 'ocupada'),
    ('Sala C-102', 1, 'C', 20, 3, 'disponible')
ON CONFLICT DO NOTHING;

-- Sensores de ejemplo para la primera sala (ajusta el UUID después de insertar,
-- o usa la siguiente consulta dinámica):
INSERT INTO sensores (sala_id, tipo, modelo, estado)
SELECT id, 'ToF_VL53L0X', 'VL53L0X', 'activo' FROM salas WHERE nombre = 'Sala A-101'
UNION ALL
SELECT id, 'Radar_LD2410C', 'HLK-LD2410C', 'activo' FROM salas WHERE nombre = 'Sala A-101';

-- Un evento de ejemplo
INSERT INTO eventos (sala_id, tipo, conteo_post, sensor_origen)
SELECT id, 'entrada', 9, 'ToF_VL53L0X' FROM salas WHERE nombre = 'Sala A-101';
