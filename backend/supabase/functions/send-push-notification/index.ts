import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

interface NotificationPayload {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url?: string;
  created_at: string;
}

interface PushToken {
  id: string;
  expo_token: string;
  platform: string;
}

interface DatabaseRecord {
  id: number;
  recipient_id: string;
  payload: NotificationPayload;
}

// Función para enviar notificaciones a Expo
async function sendExpoNotification(
  tokens: string[],
  payload: NotificationPayload,
  senderName: string
) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: `Nuevo mensaje de ${senderName}`,
    body: payload.content || "📷 Imagen",
    data: {
      message_id: payload.message_id,
      conversation_id: payload.conversation_id,
      sender_id: payload.sender_id,
      type: "new_message",
    },
    channelId: "default",
    priority: "high",
  }));

  try {
    const response = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`Expo API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Notificaciones enviadas:", result);
    return result;
  } catch (error) {
    console.error("❌ Error enviando a Expo:", error);
    throw error;
  }
}

// Función principal
serve(async (req) => {
  try {
    // Verificar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener notificaciones pendientes de la cola
    const { data: notifications, error: fetchError } = await supabase
      .from("message_notifications_queue")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(50); // Procesar hasta 50 notificaciones por invocación

    if (fetchError) {
      console.error("❌ Error obteniendo notificaciones:", fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log("ℹ️ No hay notificaciones pendientes");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No hay notificaciones pendientes",
          processed: 0 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 Procesando ${notifications.length} notificaciones...`);

    let successCount = 0;
    let errorCount = 0;

    // Procesar cada notificación
    for (const notification of notifications as DatabaseRecord[]) {
      try {
        const { recipient_id, payload, id } = notification;

        // Obtener tokens del destinatario
        const { data: tokens, error: tokensError } = await supabase
          .from("push_tokens")
          .select("id, expo_token, platform")
          .eq("user_id", recipient_id);

        if (tokensError) {
          console.error(`❌ Error obteniendo tokens para usuario ${recipient_id}:`, tokensError);
          errorCount++;
          continue;
        }

        if (!tokens || tokens.length === 0) {
          console.log(`⚠️ Usuario ${recipient_id} no tiene tokens registrados`);
          // Marcar como procesada aunque no se envió
          await supabase
            .from("message_notifications_queue")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", id);
          successCount++;
          continue;
        }

        // Obtener nombre del remitente
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", payload.sender_id)
          .single();

        const senderName = senderProfile?.full_name || 
                          senderProfile?.email?.split("@")[0] || 
                          "Alguien";

        // Enviar notificación push
        const expoTokens = (tokens as PushToken[]).map((t) => t.expo_token);
        await sendExpoNotification(expoTokens, payload, senderName);

        // Marcar como procesada
        const { error: updateError } = await supabase
          .from("message_notifications_queue")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", id);

        if (updateError) {
          console.error(`❌ Error marcando notificación ${id} como procesada:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Notificación ${id} procesada correctamente`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error procesando notificación:`, error);
        errorCount++;
      }
    }

    // Limpiar notificaciones antiguas (más de 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await supabase
      .from("message_notifications_queue")
      .delete()
      .not("processed_at", "is", null)
      .lt("processed_at", sevenDaysAgo.toISOString());

    console.log(`✅ Proceso completado: ${successCount} exitosas, ${errorCount} fallidas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: successCount,
        errors: errorCount,
        total: notifications.length
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error general:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error desconocido",
        success: false 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});




