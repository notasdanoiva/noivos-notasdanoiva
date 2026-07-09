const SUPABASE_URL = 'https://yqjgdbbapgsehakspuuh.supabase.co';
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
    const { slug, gift_id } = JSON.parse(event.body);
    if (!slug || !gift_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Dados incompletos' }) };

    const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    const siteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wedding_sites?slug=eq.${encodeURIComponent(slug)}&select=id,mp_ativo,nome_noiva,nome_noivo`,
      { headers: sbHeaders }
    );
    const site = (await siteRes.json())?.[0];
    if (!site) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Site não encontrado' }) };
    if (!site.mp_ativo) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pagamento com cartão não configurado' }) };

    const giftRes = await fetch(
      `${SUPABASE_URL}/rest/v1/gift_list?id=eq.${gift_id}&wedding_site_id=eq.${site.id}&select=nome,valor`,
      { headers: sbHeaders }
    );
    const gift = (await giftRes.json())?.[0];
    if (!gift) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Presente não encontrado' }) };

    const secretRes = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_secrets?wedding_site_id=eq.${site.id}&select=mp_access_token`,
      { headers: sbHeaders }
    );
    const secret = (await secretRes.json())?.[0];
    if (!secret?.mp_access_token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token Mercado Pago não configurado' }) };

    const siteBase = `https://${event.headers.host}`;
    const descritor = `${site.nome_noiva || ''}${site.nome_noivo ? ' & ' + site.nome_noivo : ''}`.trim().slice(0, 22) || 'PRESENTE CASAMENTO';

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret.mp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ title: `Presente: ${gift.nome}`, quantity: 1, currency_id: 'BRL', unit_price: Number(gift.valor) }],
        back_urls: {
          success: `${siteBase}/${slug}`,
          failure: `${siteBase}/${slug}`,
          pending: `${siteBase}/${slug}`,
        },
        auto_return: 'approved',
        statement_descriptor: descritor,
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok || !mpData.init_point) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Erro ao gerar link de pagamento', detail: mpData }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ link: mpData.init_point }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
