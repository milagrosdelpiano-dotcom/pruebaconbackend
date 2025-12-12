-- ==============================================
-- MIGRACIÓN 007: Módulo de Seguimiento Veterinario & Salud de Mascotas
-- ==============================================
-- Este script agrega las tablas necesarias para el seguimiento completo
-- de la salud de las mascotas: historial médico, vacunas, recordatorios, etc.

-- ==============================================
-- TABLA: historial_salud (Historial médico de la mascota)
-- ==============================================
CREATE TABLE IF NOT EXISTS historial_salud (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('enfermedad', 'cirugia', 'alergia', 'chequeo', 'otro')),
    descripcion TEXT NOT NULL,
    veterinario TEXT,
    notas TEXT,
    costo DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: vacunacion_tratamiento (Vacunas y tratamientos)
-- ==============================================
CREATE TABLE IF NOT EXISTS vacunacion_tratamiento (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('vacuna', 'tratamiento', 'desparasitacion', 'antiparasitario')),
    nombre TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_final DATE,
    proxima_fecha DATE,
    dosis TEXT,
    frecuencia TEXT,
    observaciones TEXT,
    veterinario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: medicamentos_activos (Medicamentos que está tomando la mascota)
-- ==============================================
CREATE TABLE IF NOT EXISTS medicamentos_activos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    dosis TEXT NOT NULL,
    frecuencia TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    motivo TEXT,
    veterinario TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: indicador_bienestar (Métricas de salud: peso, actividad, etc.)
-- ==============================================
CREATE TABLE IF NOT EXISTS indicador_bienestar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    peso DECIMAL(5, 2), -- en kg
    altura DECIMAL(5, 2), -- en cm
    actividad INTEGER, -- minutos de actividad o pasos
    horas_descanso DECIMAL(4, 2), -- horas de sueño/descanso
    temperatura DECIMAL(4, 2), -- temperatura corporal en °C
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: recordatorio (Recordatorios de vacunas, chequeos, etc.)
-- ==============================================
CREATE TABLE IF NOT EXISTS recordatorio (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('vacuna', 'chequeo', 'medicamento', 'desparasitacion', 'otro')),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_programada DATE NOT NULL,
    hora_programada TIME,
    repeticion TEXT CHECK (repeticion IN ('una_vez', 'diario', 'semanal', 'mensual', 'anual')),
    cumplido BOOLEAN DEFAULT FALSE,
    fecha_cumplido TIMESTAMP WITH TIME ZONE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: documento_medico (Documentos médicos: certificados, exámenes, etc.)
-- ==============================================
CREATE TABLE IF NOT EXISTS documento_medico (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('certificado_vacunacion', 'examen', 'receta', 'radiografia', 'analisis', 'otro')),
    nombre TEXT NOT NULL,
    archivo_url TEXT NOT NULL,
    descripcion TEXT,
    fecha_documento DATE,
    veterinario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: plan_cuidado (Planes de cuidado personalizados)
-- ==============================================
CREATE TABLE IF NOT EXISTS plan_cuidado (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_mascota UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo_plan TEXT CHECK (tipo_plan IN ('preventivo', 'tratamiento', 'recuperacion', 'mantenimiento')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    activo BOOLEAN DEFAULT TRUE,
    porcentaje_cumplimiento INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TABLA: checklist_cuidado (Items del plan de cuidado)
-- ==============================================
CREATE TABLE IF NOT EXISTS checklist_cuidado (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_plan UUID REFERENCES plan_cuidado(id) ON DELETE CASCADE NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_objetivo DATE,
    completado BOOLEAN DEFAULT FALSE,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_historial_salud_mascota ON historial_salud(id_mascota);
CREATE INDEX IF NOT EXISTS idx_historial_salud_fecha ON historial_salud(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_historial_salud_tipo ON historial_salud(tipo_evento);

CREATE INDEX IF NOT EXISTS idx_vacunacion_mascota ON vacunacion_tratamiento(id_mascota);
CREATE INDEX IF NOT EXISTS idx_vacunacion_fecha ON vacunacion_tratamiento(fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_vacunacion_proxima ON vacunacion_tratamiento(proxima_fecha) WHERE proxima_fecha IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medicamentos_mascota ON medicamentos_activos(id_mascota);
CREATE INDEX IF NOT EXISTS idx_medicamentos_activo ON medicamentos_activos(activo) WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_indicador_mascota ON indicador_bienestar(id_mascota);
CREATE INDEX IF NOT EXISTS idx_indicador_fecha ON indicador_bienestar(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_recordatorio_mascota ON recordatorio(id_mascota);
CREATE INDEX IF NOT EXISTS idx_recordatorio_fecha ON recordatorio(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_recordatorio_activo ON recordatorio(activo, fecha_programada) WHERE activo = TRUE AND cumplido = FALSE;

CREATE INDEX IF NOT EXISTS idx_documento_mascota ON documento_medico(id_mascota);
CREATE INDEX IF NOT EXISTS idx_documento_tipo ON documento_medico(tipo_documento);

CREATE INDEX IF NOT EXISTS idx_plan_mascota ON plan_cuidado(id_mascota);
CREATE INDEX IF NOT EXISTS idx_plan_activo ON plan_cuidado(activo) WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_checklist_plan ON checklist_cuidado(id_plan);

-- ==============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ==============================================

-- Habilitar RLS en todas las nuevas tablas
ALTER TABLE historial_salud ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacunacion_tratamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamentos_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicador_bienestar ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_medico ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cuidado ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_cuidado ENABLE ROW LEVEL SECURITY;

-- Políticas para historial_salud
CREATE POLICY "Users can view health history of own pets" ON historial_salud
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = historial_salud.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage health history of own pets" ON historial_salud
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = historial_salud.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para vacunacion_tratamiento
CREATE POLICY "Users can view vaccinations of own pets" ON vacunacion_tratamiento
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = vacunacion_tratamiento.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage vaccinations of own pets" ON vacunacion_tratamiento
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = vacunacion_tratamiento.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para medicamentos_activos
CREATE POLICY "Users can view medications of own pets" ON medicamentos_activos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = medicamentos_activos.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage medications of own pets" ON medicamentos_activos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = medicamentos_activos.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para indicador_bienestar
CREATE POLICY "Users can view wellness indicators of own pets" ON indicador_bienestar
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = indicador_bienestar.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage wellness indicators of own pets" ON indicador_bienestar
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = indicador_bienestar.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para recordatorio
CREATE POLICY "Users can view reminders of own pets" ON recordatorio
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = recordatorio.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage reminders of own pets" ON recordatorio
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = recordatorio.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para documento_medico
CREATE POLICY "Users can view medical documents of own pets" ON documento_medico
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = documento_medico.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage medical documents of own pets" ON documento_medico
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = documento_medico.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para plan_cuidado
CREATE POLICY "Users can view care plans of own pets" ON plan_cuidado
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = plan_cuidado.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage care plans of own pets" ON plan_cuidado
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = plan_cuidado.id_mascota 
            AND pets.owner_id = auth.uid()
        )
    );

-- Políticas para checklist_cuidado
CREATE POLICY "Users can view care checklists" ON checklist_cuidado
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plan_cuidado
            JOIN pets ON pets.id = plan_cuidado.id_mascota
            WHERE plan_cuidado.id = checklist_cuidado.id_plan
            AND pets.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage care checklists" ON checklist_cuidado
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM plan_cuidado
            JOIN pets ON pets.id = plan_cuidado.id_mascota
            WHERE plan_cuidado.id = checklist_cuidado.id_plan
            AND pets.owner_id = auth.uid()
        )
    );

-- ==============================================
-- TRIGGERS PARA updated_at
-- ==============================================

CREATE TRIGGER update_historial_salud_updated_at 
    BEFORE UPDATE ON historial_salud 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vacunacion_tratamiento_updated_at 
    BEFORE UPDATE ON vacunacion_tratamiento 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicamentos_activos_updated_at 
    BEFORE UPDATE ON medicamentos_activos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_indicador_bienestar_updated_at 
    BEFORE UPDATE ON indicador_bienestar 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordatorio_updated_at 
    BEFORE UPDATE ON recordatorio 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documento_medico_updated_at 
    BEFORE UPDATE ON documento_medico 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_cuidado_updated_at 
    BEFORE UPDATE ON plan_cuidado 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklist_cuidado_updated_at 
    BEFORE UPDATE ON checklist_cuidado 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- FUNCIONES AUXILIARES
-- ==============================================

-- Función para obtener el resumen de salud de una mascota
CREATE OR REPLACE FUNCTION obtener_resumen_salud_mascota(pet_id UUID)
RETURNS TABLE (
    ultimo_peso DECIMAL,
    ultima_fecha_peso DATE,
    proxima_vacuna DATE,
    proxima_vacuna_nombre TEXT,
    recordatorios_pendientes INTEGER,
    medicamentos_activos INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT peso FROM indicador_bienestar 
         WHERE id_mascota = pet_id 
         ORDER BY fecha DESC LIMIT 1) as ultimo_peso,
        (SELECT fecha FROM indicador_bienestar 
         WHERE id_mascota = pet_id 
         ORDER BY fecha DESC LIMIT 1) as ultima_fecha_peso,
        (SELECT proxima_fecha FROM vacunacion_tratamiento 
         WHERE id_mascota = pet_id 
         AND proxima_fecha >= CURRENT_DATE 
         ORDER BY proxima_fecha ASC LIMIT 1) as proxima_vacuna,
        (SELECT nombre FROM vacunacion_tratamiento 
         WHERE id_mascota = pet_id 
         AND proxima_fecha >= CURRENT_DATE 
         ORDER BY proxima_fecha ASC LIMIT 1) as proxima_vacuna_nombre,
        (SELECT COUNT(*)::INTEGER FROM recordatorio 
         WHERE id_mascota = pet_id 
         AND activo = TRUE 
         AND cumplido = FALSE 
         AND fecha_programada >= CURRENT_DATE) as recordatorios_pendientes,
        (SELECT COUNT(*)::INTEGER FROM medicamentos_activos 
         WHERE id_mascota = pet_id 
         AND activo = TRUE) as medicamentos_activos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


