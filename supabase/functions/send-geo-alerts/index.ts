/// <reference types="https://deno.land/x/deno@v1.28.0/lib/deno.d.ts" />
// @deno-types="https://deno.land/x/deno@v1.28.0/lib/deno.d.ts"

// =====================================================
// EDGE FUNCTION: Enviar Alertas Geográficas
// =====================================================
// Esta función procesa la cola de alertas geográficas
// y envía notificaciones push a usuarios cercanos

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

interface GeoAlert {
  id: string
  recipient_id: string
  report_id: string
  distance_meters: number
  notification_data: {
    report_id: string
    type: 'lost' | 'found'
    pet_name: string
    species: string
    breed?: string
    color?: string
    size?: string
    description?: string
    address?: string
    reporter_name: string
    photo?: string
    latitude: number
    longitude: number
  }
  created_at: string
}

interface PushToken {
  expo_token: string
  platform: string
}

interface ExpoMessage {
  to: string
  sound: string
  title: string
  body: string
  data: {
    type: string
    report_id: string
    distance_meters: number
    latitude: number
    longitude: number
  }
  channelId?: string
  priority?: string
}

serve(async (req: Request) => {
  try {
    console.log('🚀 Iniciando procesamiento de alertas geográficas...')

    // Crear cliente de Supabase con service_role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Obtener alertas pendientes (máximo 50 por invocación)
    const { data: alerts, error: alertsError } = await supabase
      .from('geo_alert_notifications_queue')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(50)

    if (alertsError) {
      console.error('❌ Error al obtener alertas:', alertsError)
      throw alertsError
    }

    if (!alerts || alerts.length === 0) {
      console.log('✅ No hay alertas pendientes')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay alertas pendientes',
          processed: 0 
        }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`📬 Procesando ${alerts.length} alertas...`)

    // 2. Procesar cada alerta
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const alert of alerts as GeoAlert[]) {
      try {
        console.log(`📍 Procesando alerta para usuario ${alert.recipient_id}`)
        
        // Obtener tokens del destinatario
        const { data: tokens, error: tokensError } = await supabase
          .from('push_tokens')
          .select('expo_token, platform')
          .eq('user_id', alert.recipient_id)

        if (tokensError) {
          console.error(`❌ Error al obtener tokens para ${alert.recipient_id}:`, tokensError)
          results.failed++
          results.errors.push(`Error tokens: ${tokensError.message}`)
          continue
        }

        if (!tokens || tokens.length === 0) {
          console.log(`⚠️  Usuario ${alert.recipient_id} no tiene tokens registrados`)
          // Marcar como procesada aunque no se envió
          await supabase
            .from('geo_alert_notifications_queue')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', alert.id)
          results.success++
          continue
        }

        // Construir mensaje de notificación
        const data = alert.notification_data
        const distanceKm = (alert.distance_meters / 1000).toFixed(1)
        
        const title = data.type === 'lost' 
          ? `🐾 Mascota perdida cerca de ti`
          : `🎉 Mascota encontrada cerca de ti`
        
        const petInfo = [data.pet_name, data.species, data.breed]
          .filter(Boolean)
          .join(' · ')
        
        const body = `${petInfo} a ${distanceKm}km. ${data.address || 'Ver ubicación'}`

        // Preparar mensajes para Expo
        const messages: ExpoMessage[] = (tokens as PushToken[]).map(tokenData => ({
          to: tokenData.expo_token,
          sound: 'default',
          title: title,
          body: body,
          data: {
            type: 'geo_alert',
            report_id: data.report_id,
            distance_meters: alert.distance_meters,
            latitude: data.latitude,
            longitude: data.longitude
          },
          // Configuración específica de Android
          ...(tokenData.platform === 'android' && {
            channelId: 'geo-alerts',
            priority: 'high'
          })
        }))

        console.log(`📤 Enviando ${messages.length} notificaciones a Expo...`)

        // Enviar a Expo Push API
        const expoResponse = await fetch(EXPO_PUSH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages)
        })

        if (!expoResponse.ok) {
          const errorText = await expoResponse.text()
          console.error(`❌ Error de Expo API:`, errorText)
          results.failed++
          results.errors.push(`Expo error: ${errorText}`)
          continue
        }

        const expoResult = await expoResponse.json()
        console.log(`✅ Respuesta de Expo:`, JSON.stringify(expoResult))

        // Marcar como procesada
        const { error: updateError } = await supabase
          .from('geo_alert_notifications_queue')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', alert.id)

        if (updateError) {
          console.error(`⚠️  Error al marcar alerta como procesada:`, updateError)
          results.errors.push(`Update error: ${updateError.message}`)
        }

        results.success++
        console.log(`✅ Alerta ${alert.id} procesada exitosamente`)

      } catch (error) {
        console.error(`❌ Error procesando alerta ${alert.id}:`, error)
        results.failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.errors.push(`Alert ${alert.id}: ${errorMessage}`)
      }
    }

    // 3. Limpiar alertas antiguas (mayores a 7 días)
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { error: cleanupError } = await supabase
        .from('geo_alert_notifications_queue')
        .delete()
        .not('processed_at', 'is', null)
        .lt('processed_at', sevenDaysAgo.toISOString())

      if (cleanupError) {
        console.error('⚠️  Error en limpieza:', cleanupError)
      } else {
        console.log('🧹 Alertas antiguas limpiadas')
      }
    } catch (error) {
      console.error('⚠️  Error en limpieza:', error)
    }

    // Resumen
    console.log('📊 RESUMEN:')
    console.log(`   ✅ Exitosas: ${results.success}`)
    console.log(`   ❌ Fallidas: ${results.failed}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.success + results.failed,
        successful: results.success,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('💥 Error fatal:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

