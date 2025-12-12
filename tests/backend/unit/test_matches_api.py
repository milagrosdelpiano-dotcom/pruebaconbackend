"""
Pruebas Unitarias: API de Matches
Basado en: Funcionalidad de coincidencias automáticas
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


class TestMatchesAPI:
    """Pruebas para endpoints de matches"""

    @pytest.fixture
    def mock_supabase(self):
        """Mock del cliente de Supabase"""
        with patch('routers.matches._sb') as mock_sb:
            mock_client = MagicMock()
            mock_sb.return_value = mock_client
            yield mock_client

    @pytest.fixture
    def sample_base_report(self):
        """Reporte base para matching"""
        return {
            "id": "base-report-123",
            "type": "lost",
            "species": "dog",
            "status": "active",
            "location": {
                "type": "Point",
                "coordinates": [-58.3816, -34.6037]  # Buenos Aires
            },
            "labels": {
                "labels": [
                    {"label": "dog", "description": "Golden Retriever"},
                    {"label": "animal", "description": "pet"}
                ]
            }
        }

    def test_auto_match_success(self, mock_supabase, sample_base_report):
        """Test: Auto-match debe encontrar coincidencias"""
        # Mock del reporte base
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = sample_base_report

        # Mock de candidatos
        candidates = [
            {
                "id": "candidate-1",
                "type": "found",
                "species": "dog",
                "status": "active",
                "pet_name": "Max",
                "color": "Golden",
                "location": {
                    "type": "Point",
                    "coordinates": [-58.3820, -34.6040]  # Cerca del base
                },
                "photos": ["https://example.com/photo1.jpg"],
                "labels": {
                    "labels": [
                        {"label": "dog", "description": "Golden Retriever"},
                        {"label": "animal", "description": "pet"}
                    ]
                }
            }
        ]

        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = candidates

        response = client.get("/matches/auto-match?report_id=base-report-123&radius_km=10&top_k=5")
        
        assert response.status_code == 200
        data = response.json()
        assert "report_id" in data
        assert "top_k" in data
        assert len(data["top_k"]) > 0

    def test_auto_match_no_candidates(self, mock_supabase, sample_base_report):
        """Test: Auto-match debe retornar lista vacía si no hay candidatos"""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = sample_base_report
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        response = client.get("/matches/auto-match?report_id=base-report-123&radius_km=10&top_k=5")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_candidates"] == 0
        assert len(data["top_k"]) == 0

    def test_auto_match_report_not_found(self, mock_supabase):
        """Test: Auto-match debe retornar 404 si el reporte no existe"""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

        response = client.get("/matches/auto-match?report_id=non-existent&radius_km=10&top_k=5")
        
        assert response.status_code == 404

    def test_auto_match_no_location(self, mock_supabase):
        """Test: Auto-match debe retornar 400 si el reporte no tiene location"""
        report_without_location = {
            "id": "base-report-123",
            "type": "lost",
            "species": "dog",
            "status": "active",
            "location": None
        }

        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = report_without_location

        response = client.get("/matches/auto-match?report_id=base-report-123&radius_km=10&top_k=5")
        
        assert response.status_code == 400

    def test_get_pending_matches(self, mock_supabase):
        """Test: Obtener matches pendientes"""
        mock_matches = [
            {
                "id": "match-1",
                "report_id": "report-1",
                "matched_report_id": "report-2",
                "status": "pending",
                "score": 85.5
            }
        ]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = mock_matches

        response = client.get("/matches/pending?user_id=user-123")
        
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data or isinstance(data, list)

    def test_get_pending_matches_by_report(self, mock_supabase):
        """Test: Obtener matches pendientes por reporte específico"""
        mock_matches = [
            {
                "id": "match-1",
                "report_id": "report-1",
                "matched_report_id": "report-2",
                "status": "pending"
            }
        ]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = mock_matches

        response = client.get("/matches/pending?report_id=report-1")
        
        assert response.status_code == 200


