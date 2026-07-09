const SUPABASE_URL = 'https://yqjgdbbapgsehakspuuh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxamdkYmJhcGdzZWhha3NwdXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDI4NjIsImV4cCI6MjA5NTA3ODg2Mn0.MdbACOUIHzc-roXrnbrJFkCEoPqNYUJBERb0k1ekJm8';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { access_token, mp_access_token } = JSON.parse(event.body);
    if (!access_token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Não autenticado' }) };

    // Valida a sessão e recupera o usuário logado
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão inválida' }) };
    const authUser = await userRes.json();

    // Busca o site desse usuário (só ele pode alterar seu próprio token)
    const siteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wedding_sites?user_id=eq.${authUser.id}&select=id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const sites = await siteRes.json();
    const site = sites?.[0];
    if (!site) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Site não encontrado' }) };

    const token = (mp_access_token || '').trim();

    if (token) {
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/payment_secrets`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          wedding_site_id: site.id,
          mp_access_token: token,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!upsertRes.ok) {
        const detail = await upsertRes.text();
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro ao salvar token', detail }) };
      }
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/payment_secrets?wedding_site_id=eq.${site.id}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/wedding_sites?id=eq.${site.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ mp_ativo: !!token }),
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mp_ativo: !!token }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
