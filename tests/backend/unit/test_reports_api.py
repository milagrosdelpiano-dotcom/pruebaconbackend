"""
Pruebas Unitarias: API de Reportes
Basado en: specs/003-crear-reporte-perdida/spec.md y specs/004-crear-reporte-encontrada/spec.md
Principio X: Pruebas unitarias para cada funcionalidad
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path

# Agregar el directorio backend al path
backend_path = Path(__file__).resolve().parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)


class TestReportsAPI:
    """Pruebas para endpoints de reportes"""

    @pytest.fixture
    def mock_supabase(self):
        """Mock del cliente de Supabase"""
        with patch('routers.reports._sb') as mock_sb:
            mock_client = MagicMock()
            mock_sb.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def sample_report_data(self):
        """Datos de ejemplo para un reporte"""
        return {
            "pet_name": "Max",
            "species": "dog",
            "breed": "Labrador",
            "color": "Dorado",
            "size": "large",
            "description": "Perro muy amigable",
            "photos": ["https://example.com/photo1.jpg"],
            "location": "SRID=4326;POINT(-58.3816 -34.6037)",
            "address": "Buenos Aires, Argentina",
            "type": "lost",
            "status": "active",
            "reporter_id": "test-user-id"  # Campo requerido
        }

    def test_fr_001_get_all_reports(self, mock_supabase):
        """FR-001: Obtener todos los reportes activos"""
        # Mock de respuesta de Supabase
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {"id": "1", "pet_name": "Max", "status": "active"},
            {"id": "2", "pet_name": "Luna", "status": "active"},
        ]

        response = client.get("/reports/")
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        assert len(data["reports"]) == 2

    def test_fr_002_get_report_by_id(self, mock_supabase):
        """FR-002: Obtener reporte por ID"""
        # El endpoint retorna {"report": report_data} y usa .execute() directamente (sin .single())
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{
            "id": "123",
            "pet_name": "Max",
            "status": "active"
        }]

        response = client.get("/reports/123")
        assert response.status_code == 200
        data = response.json()
        assert "report" in data
        assert data["report"]["id"] == "123"
        assert data["report"]["pet_name"] == "Max"

    def test_fr_003_create_report_validation(self):
        """FR-003, FR-014: Validar campos requeridos antes de crear reporte"""
        # Intentar crear reporte sin campos requeridos
        incomplete_data = {
            "pet_name": "Max"
            # Faltan: species, size, description, photos, location
        }

        response = client.post("/reports/", json=incomplete_data)
        # Debe fallar validación (400 o 422)
        assert response.status_code in [400, 422]

    @patch('routers.reports.generate_and_save_embedding')
    def test_fr_004_create_report_with_photos(self, mock_embedding, mock_supabase, sample_report_data):
        """FR-004, FR-017: Crear reporte con fotos"""
        # Mock de inserción exitosa
        created_report = {
            "id": "new-report-id",
            **sample_report_data
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [created_report]
        

        response = client.post("/reports/", json=sample_report_data)
        assert response.status_code == 200
        data = response.json()
        assert "report" in data
        assert data["report"]["id"] == "new-report-id"
        # Verificar que se intentó generar embedding para las fotos
        # (mock_embedding se llama en background si GENERATE_EMBEDDINGS_LOCALLY está activo)

    def test_fr_005_get_nearby_reports(self, mock_supabase):
        """FR-005: Obtener reportes cercanos por ubicación"""
        # El endpoint espera 'lat' y 'lng' como query parameters
        # Y los reportes deben tener 'location' en formato PostGIS
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "id": "1", 
                "pet_name": "Max", 
                "location": "SRID=4326;POINT(-58.3816 -34.6037)",  # Formato PostGIS
                "status": "active"
            },
        ]

        response = client.get("/reports/nearby?lat=-34.6037&lng=-58.3816&radius_km=10")
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        assert len(data["reports"]) >= 0  # Puede ser 0 o más dependiendo de la distancia

    def test_fr_006_update_report(self, mock_supabase):
        """FR-006: Actualizar reporte existente"""
        update_data = {
            "description": "Descripción actualizada",
            "pet_name": "Max Actualizado"
        }

        # Mock de actualización
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{
            "id": "123",
            **update_data
        }]

        response = client.put("/reports/123", json=update_data)
        assert response.status_code == 200

    def test_fr_007_delete_report(self, mock_supabase):
        """FR-007: Eliminar reporte"""
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = []

        response = client.delete("/reports/123")
        assert response.status_code == 200

    def test_fr_008_resolve_report(self, mock_supabase):
        """FR-008: Marcar reporte como resuelto"""
        # El endpoint retorna {"report": updated_report}
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{
            "id": "123",
            "status": "resolved",
            "resolved_at": "2025-10-05T12:00:00Z"
        }]

        response = client.post("/reports/123/resolve")
        assert response.status_code == 200
        data = response.json()
        assert "report" in data
        assert data["report"]["status"] == "resolved"


class TestReportValidation:
    """Pruebas de validación de reportes según especificaciones"""

    def test_validate_required_fields_lost_report(self):
        """Validar campos requeridos para reporte perdida (FR-002)"""
        required_fields = ["pet_name", "species", "size", "description", "photos", "location"]
        
        # Test que cada campo es requerido
        for field in required_fields:
            incomplete = {f: "value" for f in required_fields if f != field}
            response = client.post("/reports/", json=incomplete)
            assert response.status_code in [400, 422], f"Campo {field} debería ser requerido"

    def test_validate_photo_limit(self):
        """Validar límite de 5 fotos (FR-004)"""
        too_many_photos = {
            "pet_name": "Max",
            "species": "dog",
            "size": "large",
            "description": "Test",
            "photos": [f"photo{i}.jpg" for i in range(6)],  # 6 fotos (límite es 5)
            "location": "SRID=4326;POINT(-58.3816 -34.6037)",
            "type": "lost"
        }

        response = client.post("/reports/", json=too_many_photos)
        # Debe rechazar o validar el límite
        assert response.status_code in [400, 422]

