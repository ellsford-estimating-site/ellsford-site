// Runs automatically every time a form on the site gets a real (non-spam) submission.
// Sends the lead to Telegram and/or WhatsApp. Set the keys in Netlify:
// Site configuration > Environment variables.
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID     (Telegram, reliable)
//   CALLMEBOT_PHONE, CALLMEBOT_APIKEY        (WhatsApp via CallMeBot, free but can pause)
// Any channel without its keys is skipped.

const FIELDS = [
  ['plan', 'Looking for'],
  ['name', 'Name'],
  ['company', 'Company'],
  ['email', 'Email'],
  ['trade', 'Trade'],
  ['bid_due', 'Bid due'],
  ['plans_link', 'Plans'],
  ['notes', 'Notes'],
  ['trial_agreement', 'Agreed to monthly trial'],
  ['source', 'Came from'],
];

function buildMessage(payload) {
  const d = payload.data || {};
  const form = payload.form_name || d['form-name'] || 'form';
  let title = 'New form submission';
  if (form === 'takeoff-request') {
    const plan = (d.plan || '').toLowerCase();
    title = plan.startsWith('monthly') ? 'FREE TAKEOFF REQUEST (monthly trial)'
          : plan.startsWith('one') ? 'PROJECT QUOTE REQUEST'
          : plan.startsWith('custom') ? 'CUSTOM / WHITE-LABEL REQUEST'
          : 'TAKEOFF REQUEST';
  } else if (form === 'work-inquiry') {
    title = 'NEW LEAD: interested in working together';
  }
  const lines = [title, ''];
  for (const [key, label] of FIELDS) {
    const v = d[key];
    if (v && String(v).trim()) lines.push(`${label}: ${String(v).trim()}`);
  }
  lines.push('', `Form: ${form}`, `Time: ${new Date(payload.created_at || Date.now()).toUTCString()}`);
  return lines.join('\n');
}

async function sendTelegram(text) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!token || !chat) return 'telegram: skipped';
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  return `telegram: ${r.status}`;
}

async function sendWhatsApp(text) {
  const { CALLMEBOT_PHONE: phone, CALLMEBOT_APIKEY: key } = process.env;
  if (!phone || !key) return 'whatsapp: skipped';
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(text)}`;
  const r = await fetch(url);
  return `whatsapp: ${r.status}`;
}

exports.handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body || '{}');
    if (!payload) return { statusCode: 400, body: 'no payload' };
    const text = buildMessage(payload);
    const results = await Promise.allSettled([sendTelegram(text), sendWhatsApp(text)]);
    const summary = results.map(r => (r.status === 'fulfilled' ? r.value : `error: ${r.reason}`)).join(', ');
    console.log(summary);
    return { statusCode: 200, body: summary };
  } catch (err) {
    console.error(err);
    return { statusCode: 200, body: 'notify failed, submission still saved' };
  }
};

exports.buildMessage = buildMessage;
