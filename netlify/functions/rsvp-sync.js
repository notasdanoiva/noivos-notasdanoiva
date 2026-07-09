const APP_PRO_URL = 'https://dfyqmhwfhbzazfhyhjia.supabase.co';
// Service role: acessa app_data (estado completo do app) sem depender de RLS pública.
// Precisa ser configurada em Netlify → Site settings → Environment variables.
const APP_PRO_SERVICE_KEY = process.env.PRO_APP_SERVICE_ROLE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const sbHeaders = {
  apikey: APP_PRO_SERVICE_KEY,
  Authorization: `Bearer ${APP_PRO_SERVICE_KEY}`,
};

async function fetchAppState(pro_key) {
  const res = await fetch(
    `${APP_PRO_URL}/rest/v1/app_data?user_id=eq.${pro_key}&select=data`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return rows?.[0]?.data || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body);
    const { action, pro_key } = body;

    if (!pro_key) return { statusCode: 400, headers, body: JSON.stringify({ error: 'pro_key obrigatório' }) };

    // ── BUSCAR CONVIDADOS DO APP PRO ──
    // Lê direto de app_data.data.guests (todos os convites, mesmo sem link de confirmação gerado)
    if (action === 'get_guests') {
      const state = await fetchAppState(pro_key);
      const inviteList = Array.isArray(state?.guests) ? state.guests : [];

      const guests = [];
      inviteList.forEach(inv => {
        const convite = inv.nome || 'Convite';

        if (Array.isArray(inv.pessoas) && inv.pessoas.length > 0) {
          inv.pessoas.forEach(p => {
            const nomePessoa = typeof p === 'object' ? p.nome : p;
            const statusPro = typeof p === 'object' ? p.status : null;
            guests.push({
              id: `${inv.id}_${nomePessoa}`,
              nome: nomePessoa,
              convite,
              invite_id: inv.id,
              confirmado: statusPro === 'Confirmado' ? true : statusPro === 'Não vai' ? false : null,
            });
          });
        } else {
          // Sem pessoas cadastradas — usa nome do convite
          guests.push({
            id: `${inv.id}_${convite}`,
            nome: convite,
            convite,
            invite_id: inv.id,
            confirmado: null,
          });
        }
      });

      return { statusCode: 200, headers, body: JSON.stringify({ guests }) };
    }

    // ── SINCRONIZAR CONFIRMAÇÕES DE VOLTA AO APP PRO ──
    // Atualiza direto o status de cada pessoa em app_data.data.guests[].pessoas
    if (action === 'sync_rsvp') {
      const { responses } = body;

      const state = await fetchAppState(pro_key);
      if (!state || !Array.isArray(state.guests)) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      responses.forEach(r => {
        const invite_id = r.guest_id.split('_')[0];
        const inv = state.guests.find(g => String(g.id) === String(invite_id));
        if (!inv || !Array.isArray(inv.pessoas)) return;

        const pessoa = inv.pessoas.find(p => (typeof p === 'object' ? p.nome : p) === r.nome);
        if (pessoa && typeof pessoa === 'object') {
          pessoa.status = r.confirmado ? 'Confirmado' : 'Não vai';
        }
      });

      await fetch(`${APP_PRO_URL}/rest/v1/app_data?user_id=eq.${pro_key}`, {
        method: 'PATCH',
        headers: {
          ...sbHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ data: state, updated_at: new Date().toISOString() }),
      });

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action inválida' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
