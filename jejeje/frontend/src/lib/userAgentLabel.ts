/**
 * A human-readable one-line label from a browser User-Agent. Full string kept for title/tooltip.
 */
export function deviceLabelFromUserAgent(
  userAgent: string | null | undefined,
  deviceName: string | null | undefined,
): { short: string; full: string } {
  const full = (userAgent ?? '').trim();
  const dn = (deviceName ?? '').trim();
  if (dn && !/^mozilla\/[\d.]+/i.test(dn) && !/^python-requests/i.test(dn)) {
    return { short: dn.slice(0, 80) + (dn.length > 80 ? '…' : ''), full: full || dn };
  }
  if (!full) {
    return { short: 'Dispositivo', full: '—' };
  }

  let browser = 'Navegador';
  if (/\bEdg\//i.test(full)) browser = 'Edge';
  else if (/\bOPR\/|Opera\//i.test(full)) browser = 'Opera';
  else if (/\bCriOS\//i.test(full)) browser = 'Chrome';
  else if (/\bChrome\//i.test(full) && !/Chromium/i.test(full)) browser = 'Chrome';
  else if (/\bVersion\/.*Safari/i.test(full) && /\bSafari\//i.test(full) && !/Chrome/i.test(full)) {
    browser = 'Safari';
  } else if (/\bFirefox\//i.test(full)) browser = 'Firefox';
  else if (/\bMSIE\b|\bTrident\//i.test(full)) browser = 'IE';

  let os = '';
  if (/\bWindows NT 10/i.test(full)) os = 'Windows 10/11';
  else if (/\bWindows/i.test(full)) os = 'Windows';
  else if (/\bMac OS X/i.test(full) || /Macintosh/i.test(full)) os = 'macOS';
  if (!os && /\bAndroid ([\d.]+)/i.test(full)) {
    const m = full.match(/\bAndroid ([\d.]+)/i);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (!os && (/CPU (iPhone|iPad)/i.test(full) || /iPhone|iPad|iPod/i.test(full))) {
    os = /iPad/i.test(full) ? 'iPadOS' : 'iOS';
  } else if (!os && /Linux|X11/i.test(full) && !/Android/i.test(full)) {
    os = 'Linux';
  }

  const short = [browser, os && `· ${os}`].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { short, full: full || short };
}
