import { DailyDigestData } from './dailyDigestBuilder';

export interface RenderedDailyDigest {
  subject: string;
  html: string;
  text: string;
}

export function renderDailyDigest(data: DailyDigestData): RenderedDailyDigest {
  const subject = `${data.tenantName} daily digest — ${data.dateRangeLabel}`;

  const totalSentiment =
    data.sentimentDistribution.positive +
    data.sentimentDistribution.neutral +
    data.sentimentDistribution.negative +
    data.sentimentDistribution.mixed || 1;

  const posPct = Math.round((data.sentimentDistribution.positive / totalSentiment) * 100);
  const neuPct = Math.round((data.sentimentDistribution.neutral / totalSentiment) * 100);
  const negPct = Math.round((data.sentimentDistribution.negative / totalSentiment) * 100);

  // HTML Email Layout
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px; }
    .greeting { font-size: 15px; margin-bottom: 20px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .metric-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .metric-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .metric-value.pos { color: #16a34a; }
    .metric-value.neu { color: #64748b; }
    .metric-value.neg { color: #dc2626; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin: 24px 0 12px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .ai-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .ai-title { font-size: 13px; font-weight: 700; color: #1d4ed8; margin-bottom: 6px; }
    .ai-narrative { font-size: 13px; line-height: 1.5; color: #1e3a8a; }
    .ai-themes { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
    .theme-chip { background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; }
    .post-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .post-header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .post-author { font-weight: 700; color: #0f172a; }
    .post-platform { font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569; }
    .post-excerpt { font-size: 13px; color: #334155; line-height: 1.4; }
    .post-footer { margin-top: 8px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.tenantName}</h1>
      <p>Daily Social Intelligence Digest • ${data.dateRangeLabel}</p>
    </div>
    <div class="content">
      <div class="greeting">
        Good morning <strong>${data.recipientName}</strong>, here is your 24-hour executive summary.
      </div>

      <!-- Quick Metrics -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <td width="25%" style="padding: 4px;">
            <div class="metric-card">
              <div class="metric-label">Mentions</div>
              <div class="metric-value">${data.totalMentions}</div>
            </div>
          </td>
          <td width="25%" style="padding: 4px;">
            <div class="metric-card">
              <div class="metric-label">Positive</div>
              <div class="metric-value pos">${posPct}%</div>
            </div>
          </td>
          <td width="25%" style="padding: 4px;">
            <div class="metric-card">
              <div class="metric-label">Neutral</div>
              <div class="metric-value neu">${neuPct}%</div>
            </div>
          </td>
          <td width="25%" style="padding: 4px;">
            <div class="metric-card">
              <div class="metric-label">Negative</div>
              <div class="metric-value neg">${negPct}%</div>
            </div>
          </td>
        </tr>
      </table>

      ${
        data.aiSummary
          ? `
      <!-- AI Executive Summary -->
      <div class="ai-box">
        <div class="ai-title">✨ AI Executive Summary</div>
        <div class="ai-narrative">${data.aiSummary.narrative}</div>
        <div class="ai-themes" style="margin-top: 8px;">
          ${data.aiSummary.keyThemes.map((t) => `<span class="theme-chip">${t}</span>`).join(' ')}
        </div>
      </div>`
          : ''
      }

      ${
        data.topTopics && data.topTopics.length > 0
          ? `
      <!-- Top Topics -->
      <div class="section-title">Trending Topics</div>
      <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
        ${data.topTopics
          .map(
            (t) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="font-weight: 600;">${t.topic}</td>
            <td align="right" style="color: #64748b;">${t.count} mentions</td>
          </tr>`
          )
          .join('')}
      </table>`
          : ''
      }

      ${
        data.notablePosts && data.notablePosts.length > 0
          ? `
      <!-- Notable Posts -->
      <div class="section-title">Notable High-Impact Posts</div>
      ${data.notablePosts
        .map(
          (p) => `
        <div class="post-card">
          <div class="post-header">
            <span class="post-author">${p.authorName} ${p.authorHandle ? `(@${p.authorHandle})` : ''}</span>
            <span class="post-platform">${p.platform}</span>
          </div>
          <div class="post-excerpt">"${p.excerpt}"</div>
          <div class="post-footer">
            <span>Impact Score: <strong>${p.impactScore}</strong></span>
            ${p.url ? `<a href="${p.url}" target="_blank" style="color: #2563eb; text-decoration: none;">View Post ↗</a>` : ''}
          </div>
        </div>`
        )
        .join('')}`
          : ''
      }
    </div>
    <div class="footer">
      <p>You received this digest according to your daily notification preferences for <strong>${data.tenantName}</strong>.</p>
      <p>
        <a href="https://socialengage.test:3000/tenant/settings/digest">Manage Preferences</a> • 
        <a href="${data.unsubscribeUrl}">One-Click Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  // Clean Plain-Text Layout
  let text = `${data.tenantName} — Daily Digest (${data.dateRangeLabel})\n`;
  text += `====================================================\n\n`;
  text += `Good morning ${data.recipientName},\n\n`;
  text += `24-HOUR SUMMARY:\n`;
  text += `- Total Mentions: ${data.totalMentions}\n`;
  text += `- Sentiment: Positive ${posPct}% | Neutral ${neuPct}% | Negative ${negPct}%\n\n`;

  if (data.aiSummary) {
    text += `AI EXECUTIVE SUMMARY:\n`;
    text += `${data.aiSummary.narrative}\n`;
    text += `Key Themes: ${data.aiSummary.keyThemes.join(', ')}\n\n`;
  }

  if (data.topTopics && data.topTopics.length > 0) {
    text += `TOP TOPICS:\n`;
    for (const topic of data.topTopics) {
      text += `- ${topic.topic}: ${topic.count} mentions\n`;
    }
    text += `\n`;
  }

  if (data.notablePosts && data.notablePosts.length > 0) {
    text += `NOTABLE POSTS:\n`;
    for (const post of data.notablePosts) {
      text += `[${post.platform}] ${post.authorName}: "${post.excerpt}" (Impact: ${post.impactScore})\n`;
      if (post.url) text += `Link: ${post.url}\n`;
    }
    text += `\n`;
  }

  text += `----------------------------------------------------\n`;
  text += `Manage preferences: https://socialengage.test:3000/tenant/settings/digest\n`;
  text += `Unsubscribe: ${data.unsubscribeUrl}\n`;

  return {
    subject,
    html,
    text,
  };
}
