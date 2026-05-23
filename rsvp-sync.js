// Integração RSVP → App PRO (Noiva Independente PRO)
// Quando um convidado confirma presença, atualiza a lista de convidados do app PRO
// Para ativar: descomentar o bloco de integração abaixo

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { guest_id, confirmado, wedding_site_id, nome, convite } = JSON.parse(event.body);

    // ─────────────────────────────────────────────────────────────
    // INTEGRAÇÃO COM APP PRO — descomente quando quiser ativar
    // ─────────────────────────────────────────────────────────────
    //
    // const APP_PRO_URL = process.env.APP_PRO_SUPABASE_URL;
    // const APP_PRO_KEY = process.env.APP_PRO_SUPABASE_KEY;
    //
    // await fetch(`${APP_PRO_URL}/rest/v1/guests?id=eq.${guest_id}`, {
    //   method: 'PATCH',
    //   headers: {
    //     'apikey': APP_PRO_KEY,
    //     'Authorization': `Bearer ${APP_PRO_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ confirmado, respondido_em: new Date().toISOString() }),
    // });
    // ─────────────────────────────────────────────────────────────

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
