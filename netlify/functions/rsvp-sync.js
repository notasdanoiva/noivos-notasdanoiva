const APP_PRO_URL = 'https://dfyqmhwfhbzazfhyhjia.supabase.co';
const APP_PRO_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmeXFtaHdmaGJ6YXpmaHloamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzMwODIsImV4cCI6MjA5NDE0OTA4Mn0.fX3OmmZpPObWsNf_BcouFGRcVJNsMm20OXzvjFdDk0Y';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { action, pro_key } = JSON.parse(event.body);

    if (!pro_key) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'pro_key obrigatório' }) };
    }

    // ── BUSCAR CONVIDADOS DO APP PRO ──
    if (action === 'get_guests') {
      const res = await fetch(
        `${APP_PRO_URL}/rest/v1/guests?user_id=eq.${pro_key}&select=id,nome,convite,confirmado`,
        {
          headers: {
            'apikey': APP_PRO_KEY,
            'Authorization': `Bearer ${APP_PRO_KEY}`,
          }
        }
      );
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify({ guests: data }) };
    }

    // ── SINCRONIZAR CONFIRMAÇÕES DE VOLTA AO APP PRO ──
    if (action === 'sync_rsvp') {
      const { responses } = JSON.parse(event.body);
      const updates = responses.map(r =>
        fetch(`${APP_PRO_URL}/rest/v1/guests?id=eq.${r.guest_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': APP_PRO_KEY,
            'Authorization': `Bearer ${APP_PRO_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmado: r.confirmado }),
        })
      );
      await Promise.all(updates);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action inválida' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
