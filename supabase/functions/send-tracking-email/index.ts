import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tracking_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get tracking record
    const { data: tracking, error } = await supabase
      .from('pedido_tracking')
      .select('*')
      .eq('id', tracking_id)
      .single()

    if (error || !tracking) {
      return new Response(JSON.stringify({ error: 'Tracking no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!tracking.cliente_email) {
      return new Response(JSON.stringify({ ok: true, skipped: 'sin email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const trackingUrl = `${Deno.env.get('APP_URL')}/tracking/${tracking.token}`
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0f10;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">PYB</div>
      <div style="width:40px;height:1px;background:#f59e0b;margin:8px auto;"></div>
      <div style="font-size:11px;color:#666;letter-spacing:3px;text-transform:uppercase;">Seguimiento de pedido</div>
    </div>

    <!-- Card -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:4px;padding:28px;">
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px 0;">Hola,</p>
      <p style="color:#e4e4e7;font-size:15px;margin:0 0 24px 0;">
        Tu pedido está <strong style="color:#f59e0b;">en preparación</strong>.
        Podés seguir el estado en tiempo real desde el siguiente link:
      </p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${trackingUrl}"
           style="display:inline-block;background:#f59e0b;color:#0f0f10;font-weight:700;font-size:14px;
                  padding:14px 32px;text-decoration:none;border-radius:2px;letter-spacing:0.5px;">
          VER ESTADO DEL PEDIDO
        </a>
      </div>

      <p style="color:#52525b;font-size:12px;margin:24px 0 0 0;text-align:center;">
        O copiá este link: <span style="color:#a1a1aa;">${trackingUrl}</span>
      </p>
    </div>

    <!-- Footer -->
    <p style="color:#3f3f46;font-size:11px;text-align:center;margin-top:24px;">
      PYB Logística · Este link es personal para tu pedido
    </p>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PYB Logística <onboarding@resend.dev>',
        to: [tracking.cliente_email],
        subject: `Tu pedido está en preparación — PYB`,
        html: emailHtml,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      throw new Error(JSON.stringify(result))
    }

    return new Response(JSON.stringify({ ok: true, email_id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
