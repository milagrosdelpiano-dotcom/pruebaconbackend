"""
Configuración de pytest para pruebas del backend
"""

import pytest
import os
from unittest.mock import Mock, MagicMock, patch
from pathlib import Path

# Configurar variables de entorno para tests
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")
os.environ.setdefault("GENERATE_EMBEDDINGS_LOCALLY", "true")


@pytest.fixture
def mock_supabase_client():
    """Fixture para mockear el cliente de Supabase"""
    mock_client = MagicMock()
    return mock_client




@pytest.fixture
def sample_report_data():
    """Datos de ejemplo para reportes"""
    return {
        "id": "test-report-id",
        "pet_name": "Max",
        "species": "dog",
        "breed": "Labrador",
        "color": "Dorado",
        "size": "large",
        "description": "Perro muy amigable",
        "photos": ["https://example.com/photo1.jpg"],
        "location": {"type": "Point", "coordinates": [-58.3816, -34.6037]},
        "address": "Buenos Aires, Argentina",
        "type": "lost",
        "status": "active",
        "reporter_id": "test-user-id"
    }


