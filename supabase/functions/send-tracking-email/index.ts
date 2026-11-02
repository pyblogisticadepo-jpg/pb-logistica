import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tracking_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    const trackingUrl = (Deno.env.get('APP_URL') ?? '') + '/tracking/' + tracking.token
    const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? ''
    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''

    const emailHtml = '<html><body style="background:#0f0f10;font-family:Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:40px;"><div style="text-align:center;"><div style="font-size:28px;font-weight:900;color:#fff;">PYB</div></div><div style="background:#18181b;border:1px solid #333;border-radius:4px;padding:28px;margin-top:24px;"><p style="color:#e4e4e7;">Tu pedido esta <strong style="color:#f59e0b;">en preparacion</strong>.</p><div style="text-align:center;margin:24px 0;"><a href="' + trackingUrl + '" style="background:#f59e0b;color:#000;font-weight:700;padding:14px 32px;text-decoration:none;border-radius:2px;display:inline-block;">VER ESTADO DEL PEDIDO</a></div></div></div></body></html>'

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: 'PYB Logistica <' + GMAIL_USER + '>',
      to: tracking.cliente_email,
      subject: 'Tu pedido esta en preparacion - PYB',
      html: emailHtml,
    })

    console.log('Email enviado OK a:', tracking.cliente_email)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
