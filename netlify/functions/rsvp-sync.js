const APP_PRO_URL = 'https://dfyqmhwfhbzazfhyhjia.supabase.co';
const APP_PRO_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmeXFtaHdmaGJ6YXpmaHloamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzMwODIsImV4cCI6MjA5NDE0OTA4Mn0.fX3OmmZpPObWsNf_BcouFGRcVJNsMm20OXzvjFdDk0Y';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body);
    const { action, pro_key } = body;

    if (!pro_key) return { statusCode: 400, headers, body: JSON.stringify({ error: 'pro_key obrigatório' }) };

    // ── BUSCAR CONVIDADOS DO APP PRO ──
    if (action === 'get_guests') {
      const res = await fetch(
        `${APP_PRO_URL}/rest/v1/confirmacoes?user_id=eq.${pro_key}&select=invite_id,invite_data`,
        { headers: { 'apikey': APP_PRO_KEY, 'Authorization': `Bearer ${APP_PRO_KEY}` } }
      );
      const rows = await res.json();
      if (!Array.isArray(rows)) return { statusCode: 200, headers, body: JSON.stringify({ guests: [] }) };

      const guests = [];
      rows.forEach(row => {
        const d = row.invite_data;
        if (!d) return;
        const convite = d.nome || 'Convite';

        if (Array.isArray(d.pessoas) && d.pessoas.length > 0) {
          // Usa cada pessoa do array
          d.pessoas.forEach(p => {
            const nomePessoa = typeof p === 'object' ? p.nome : p;
            const statusPro = typeof p === 'object' ? p.status : null;
            guests.push({
              id: `${row.invite_id}_${nomePessoa}`,
              nome: nomePessoa,
              convite: convite,
              invite_id: row.invite_id,
              // Preserva status já confirmado no app PRO
              confirmado: statusPro === 'Confirmado' ? true : statusPro === 'Recusado' ? false : null,
            });
          });
        } else {
          // Sem pessoas cadastradas — usa nome do convite
          guests.push({
            id: `${row.invite_id}_${convite}`,
            nome: convite,
            convite: convite,
            invite_id: row.invite_id,
            confirmado: null,
          });
        }
      });

      return { statusCode: 200, headers, body: JSON.stringify({ guests }) };
    }

    // ── SINCRONIZAR CONFIRMAÇÕES DE VOLTA AO APP PRO ──
    if (action === 'sync_rsvp') {
      const { responses } = body;

      // Agrupa confirmações por invite_id
      const byInvite = {};
      responses.forEach(r => {
        const invite_id = r.guest_id.split('_')[0];
        if (!byInvite[invite_id]) byInvite[invite_id] = [];
        byInvite[invite_id].push({ nome: r.nome, confirmado: r.confirmado });
      });

      // Busca invite_data atual e atualiza status de cada pessoa
      const updates = Object.entries(byInvite).map(async ([invite_id, confirmacoes]) => {
        const res = await fetch(
          `${APP_PRO_URL}/rest/v1/confirmacoes?invite_id=eq.${invite_id}&user_id=eq.${pro_key}&select=invite_data`,
          { headers: { 'apikey': APP_PRO_KEY, 'Authorization': `Bearer ${APP_PRO_KEY}` } }
        );
        const rows = await res.json();
        if (!rows?.[0]?.invite_data) return;

        const d = { ...rows[0].invite_data };
        if (Array.isArray(d.pessoas)) {
          d.pessoas = d.pessoas.map(p => {
            const match = confirmacoes.find(c => c.nome === (typeof p === 'object' ? p.nome : p));
            if (match) return { ...p, status: match.confirmado ? 'Confirmado' : 'Recusado' };
            return p;
          });
        }

        return fetch(
          `${APP_PRO_URL}/rest/v1/confirmacoes?invite_id=eq.${invite_id}&user_id=eq.${pro_key}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': APP_PRO_KEY,
              'Authorization': `Bearer ${APP_PRO_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ invite_data: d }),
          }
        );
      });

      await Promise.all(updates);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action inválida' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
