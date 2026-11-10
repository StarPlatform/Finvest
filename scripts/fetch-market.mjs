// Mengambil data harga tertunda dan menulis data/market.json.
// Dijalankan oleh GitHub Actions (Node 20+, tanpa dependensi).
// Sumber: endpoint chart Yahoo Finance. Ini endpoint tidak resmi: bisa berubah atau diblokir sewaktu-waktu.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data', 'market.json');
const SOURCE = 'Yahoo Finance (tidak resmi), lewat GitHub Actions';

// id di Finvest -> simbol di Yahoo Finance
const SYMBOLS = {
  IHSG: '^JKSE',
  BBCA: 'BBCA.JK',
  BBRI: 'BBRI.JK',
  TLKM: 'TLKM.JK',
  ASII: 'ASII.JK',
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  USDIDR: 'USDIDR=X',
  SPX: '^GSPC',
  // saham Indonesia
  BMRI: 'BMRI.JK', BBNI: 'BBNI.JK', BRIS: 'BRIS.JK', GOTO: 'GOTO.JK', UNVR: 'UNVR.JK', ICBP: 'ICBP.JK',
  INDF: 'INDF.JK', KLBF: 'KLBF.JK', AMRT: 'AMRT.JK', CPIN: 'CPIN.JK', ANTM: 'ANTM.JK', ADRO: 'ADRO.JK',
  PTBA: 'PTBA.JK', MDKA: 'MDKA.JK', TOWR: 'TOWR.JK', EXCL: 'EXCL.JK', SMGR: 'SMGR.JK', PGAS: 'PGAS.JK',
  // saham AS
  AAPL: 'AAPL', MSFT: 'MSFT', NVDA: 'NVDA', GOOGL: 'GOOGL', AMZN: 'AMZN', META: 'META', TSLA: 'TSLA', JPM: 'JPM', KO: 'KO',
  // indeks
  NASDAQ: '^IXIC', DOW: '^DJI', NIKKEI: '^N225', HSI: '^HSI', FTSE: '^FTSE', STI: '^STI',
  // kripto
  BNB: 'BNB-USD', SOL: 'SOL-USD', XRP: 'XRP-USD', DOGE: 'DOGE-USD', ADA: 'ADA-USD',
  // kurs
  EURUSD: 'EURUSD=X', EURIDR: 'EURIDR=X', SGDIDR: 'SGDIDR=X', JPYIDR: 'JPYIDR=X',
  // komoditas (kontrak berjangka, USD)
  GOLDUSD: 'GC=F', SILVER: 'SI=F', WTI: 'CL=F', BRENT: 'BZ=F', NATGAS: 'NG=F', COPPER: 'HG=F'
};
const GOLD_USD_PER_OZ = 'GC=F'; // emas berjangka, USD per troy ounce
const FX = 'USDIDR=X';
const GRAMS_PER_OZ = 31.1035;

const UA = 'Mozilla/5.0 (compatible; FinvestBot/1.0; +https://github.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x) => Math.round(x * 100) / 100;

async function chart(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const r = json?.chart?.result?.[0];
      const ts = r?.timestamp;
      const close = r?.indicators?.quote?.[0]?.close;
      if (!ts || !close) throw new Error('respons tanpa data harga');
      const t = [];
      const v = [];
      for (let i = 0; i < ts.length; i++) {
        if (close[i] != null && Number.isFinite(close[i])) {
          t.push(ts[i] * 1000);
          v.push(close[i]);
        }
      }
      if (t.length < 2) throw new Error('data terlalu sedikit');
      return { t, v };
    } catch (e) {
      lastErr = e;
      await sleep(800 * attempt);
    }
  }
  throw new Error(`${symbol} ${range}/${interval}: ${lastErr.message}`);
}

function pack(series) {
  return { t: series.t, v: series.v.map(round) };
}

// nilai FX terakhir yang waktunya <= t
function fxAt(fx, t, state) {
  while (state.p + 1 < fx.t.length && fx.t[state.p + 1] <= t) state.p++;
  return fx.v[state.p];
}

async function main() {
  let previous = { assets: {} };
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    /* belum ada berkas sebelumnya */
  }

  const assets = { ...(previous.assets || {}) };
  const failures = [];
  let ok = 0;

  for (const [id, symbol] of Object.entries(SYMBOLS)) {
    try {
      const d = await chart(symbol, '1y', '1d');
      let i = null;
      try {
        i = await chart(symbol, '7d', '60m');
      } catch {
        /* data intraday opsional */
      }
      assets[id] = i ? { d: pack(d), i: pack(i) } : { d: pack(d) };
      ok++;
    } catch (e) {
      failures.push(`${id}: ${e.message}`);
    }
    await sleep(300);
  }

  // Emas: harga emas dunia (USD/oz) x kurs USD/IDR / gram per ounce. Bukan harga Antam.
  try {
    const [gold, fx] = await Promise.all([chart(GOLD_USD_PER_OZ, '1y', '1d'), chart(FX, '1y', '1d')]);
    const st = { p: 0 };
    const t = [];
    const v = [];
    for (let k = 0; k < gold.t.length; k++) {
      if (gold.t[k] < fx.t[0]) continue;
      t.push(gold.t[k]);
      v.push((gold.v[k] * fxAt(fx, gold.t[k], st)) / GRAMS_PER_OZ);
    }
    if (t.length < 2) throw new Error('data emas terlalu sedikit');
    assets.EMAS = { d: pack({ t, v }) };
    ok++;
  } catch (e) {
    failures.push(`EMAS: ${e.message}`);
  }

  if (ok === 0) {
    console.error('Semua pengambilan data gagal:\n' + failures.join('\n'));
    process.exit(1);
  }

  const out = { generated: new Date().toISOString(), source: SOURCE, assets };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out));
  console.log(`Berhasil ${ok} aset. Gagal ${failures.length}.`);
  failures.forEach((f) => console.warn('  - ' + f));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
