"""
Utility para Crear Clientes de Supabase con Configuración Optimizada
=====================================================================

Este módulo proporciona funciones para crear clientes de Supabase con
configuración optimizada de timeouts y manejo de conexiones.

Problemas que resuelve:
- WinError 10060 en Windows (timeout de conexión)
- Conexiones lentas o con firewall
- Timeouts prematuros en operaciones largas
- Manejo de reintentos automáticos

La configuración incluye:
- Timeouts aumentados para conexiones lentas
- Límites de conexiones concurrentes
- Reintentos automáticos
- Keep-alive para conexiones persistentes
"""

import os
from supabase import create_client, Client, ClientOptions
import httpx  # Cliente HTTP con mejor control de timeouts
from typing import Optional

def create_supabase_client(
    url: Optional[str] = None,
    key: Optional[str] = None,
    timeout: float = 30.0,
    max_retries: int = 3
) -> Client:
    """
    Crea un cliente de Supabase con configuración optimizada de timeouts.
    
    Args:
        url: URL de Supabase (por defecto: SUPABASE_URL del .env)
        key: Service key (por defecto: SUPABASE_SERVICE_KEY del .env)
        timeout: Timeout en segundos para las peticiones (default: 30s)
        max_retries: Número máximo de reintentos (default: 3)
    
    Returns:
        Cliente de Supabase configurado
    
    Raises:
        ValueError: Si no se encuentran las credenciales
    """
    # Obtener credenciales del entorno si no se proporcionan
    supabase_url = url or os.getenv("SUPABASE_URL")
    supabase_key = key or os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos")
    
    # Configurar httpx con timeouts apropiados y retry logic
    # Timeouts aumentados para conexiones lentas/firewalls de Windows
    timeout_config = httpx.Timeout(
        connect=60.0,      # Tiempo para establecer la conexión (aumentado para Windows)
        read=timeout,      # Tiempo para leer la respuesta
        write=timeout,     # Tiempo para escribir la petición
        pool=10.0          # Tiempo para obtener una conexión del pool
    )
    
    # Configurar límites de conexión
    limits = httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
        keepalive_expiry=30.0
    )
    
    # Crear transporte con retry logic
    transport = httpx.HTTPTransport(
        retries=max_retries,
        limits=limits
    )
    
    # Crear httpx client personalizado
    http_client = httpx.Client(
        timeout=timeout_config,
        transport=transport,
        follow_redirects=True
    )
    
    # Crear cliente de Supabase con httpx client personalizado
    try:
        # Crear opciones del cliente correctamente
        options = ClientOptions(
            schema="public",
            headers={},
            auto_refresh_token=True,
            persist_session=False
        )
        
        client = create_client(
            supabase_url,
            supabase_key,
            options=options
        )
        
        # Reemplazar el cliente HTTP interno con nuestra configuración
        # El cliente de supabase-py usa httpx internamente
        if hasattr(client, '_postgrest_client'):
            if hasattr(client._postgrest_client, 'session'):
                # Actualizar la sesión con nuestro cliente configurado
                client._postgrest_client.session = http_client
        
        # También actualizar el cliente de storage si existe
        if hasattr(client, '_storage_client'):
            if hasattr(client._storage_client, 'session'):
                client._storage_client.session = http_client
        
        return client
        
    except Exception as e:
        http_client.close()
        raise RuntimeError(f"Error creando cliente de Supabase: {str(e)}") from e


def get_supabase_client() -> Client:
    """
    Obtiene un cliente de Supabase con configuración por defecto.
    Útil para uso rápido sin configuración personalizada.
    
    Returns:
        Cliente de Supabase configurado
        
    Raises:
        ValueError: Si no se encuentran las credenciales
    """
    return create_supabase_client()

