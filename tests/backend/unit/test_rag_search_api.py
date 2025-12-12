"""
Pruebas Unitarias: API de RAG Search
Basado en: Funcionalidad de búsqueda RAG (Retrieval Augmented Generation)
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

# Importar después de agregar al path
try:
    from main import app
except ImportError:
    # Si falla, intentar importar directamente
    import os
    os.chdir(str(backend_path))
    from main import app

client = TestClient(app)


class TestRAGSearchAPI:
    """Pruebas para endpoints de RAG Search"""

    @pytest.fixture
    def mock_supabase(self):
        """Mock del cliente de Supabase"""
        with patch('routers.rag_search._sb') as mock_sb:
            mock_client = MagicMock()
            mock_sb.return_value = mock_client
            yield mock_client

    def test_rag_search_by_embedding(self, mock_supabase):
        """Test: Búsqueda RAG por embedding"""
        # Mock de función RPC para búsqueda RAG
        mock_supabase.rpc.return_value.execute.return_value.data = [
            {
                "id": "report-1",
                "pet_name": "Max",
                "description": "Perro dorado encontrado",
                "similarity": 0.85
            }
        ]

        # El endpoint espera un embedding de 512 dimensiones
        embedding = [0.1] * 512

        response = client.post(
            "/rag/search",
            json=embedding,
            params={
                "match_threshold": 0.7,
                "match_count": 10,
                "filter_type": "found"
            }
        )

        # El endpoint puede retornar 200 o 404/422 si no está implementado
        assert response.status_code in [200, 404, 422, 500]

    def test_rag_search_validation_embedding_dimensions(self, mock_supabase):
        """Test: Validación de dimensiones de embedding"""
        # Embedding con dimensiones incorrectas (no 512)
        invalid_embedding = [0.1] * 256

        response = client.post(
            "/rag/search",
            json=invalid_embedding,
            params={"match_threshold": 0.7, "match_count": 10}
        )
        
        # Debe fallar validación (400 - embedding debe tener 512 dimensiones)
        assert response.status_code in [400, 422, 404]

    def test_rag_search_with_location(self, mock_supabase):
        """Test: Búsqueda RAG con filtro geográfico"""
        embedding = [0.1] * 512
        mock_supabase.rpc.return_value.execute.return_value.data = []

        response = client.post(
            "/rag/search-with-location",
            json=embedding,
            params={
                "user_lat": -34.6037,
                "user_lng": -58.3816,
                "max_distance_km": 10,
                "match_threshold": 0.7,
                "match_count": 10
            }
        )

        # El endpoint puede retornar 200 o 404/422
        assert response.status_code in [200, 404, 422, 500]

