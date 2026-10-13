/*
 * Extract Sheets to Rows (format conversion only - no business logic)
 *
 * Reads:   $workbook_file = output of Fetch Workbook (HTTP, response type Array Buffer), which Flowise passes
 *          as '{"type":"Buffer","data":[...]}'; base64 or a data: URL are accepted too.
 *          $workbook_url  = the form URL, used to download directly if $workbook_file is unusable.
 * Writes:  $flow.state.raw_sheets
 *
 * An LLM cannot read the binary .xlsx, so this node only unzips it (zlib) and emits every sheet as rows
 * of cached cell values. No validation, typing or cleaning - that is the Data Standardisation Agent's job.
 *
 * Returns (JSON string): { "source": {...}, "sheets": { "<sheet name>": [{ "row": <Excel row>, "cells": [...] }] } }
 */
const zlib = require('zlib');
const { Buffer } = require('buffer');

const isZip = (b) => b && b.length > 4 && b.readUInt32LE(0) === 0x04034b50;

function toBuffer(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
  let s = String(v).trim();
  if (!s || s.startsWith('{{')) return null;
  if (s.startsWith('{')) {
    try { return toBuffer(JSON.parse(s)); } catch (e) { return null; }
  }
  s = s.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=_-]+$/.test(s)) return null;
  return Buffer.from(s, 'base64');
}

let buf = toBuffer(typeof $workbook_file !== 'undefined' ? $workbook_file : null);
let via = 'Fetch Workbook node';
const url = typeof $workbook_url === 'string' ? $workbook_url.trim() : '';
if (!isZip(buf) && /^https?:\/\//i.test(url)) {
  const fetch = require('node-fetch');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download the workbook (' + res.status + ') from ' + url);
  buf = Buffer.from(await res.arrayBuffer());
  via = 'direct download';
}
if (!isZip(buf)) throw new Error('The workbook is not a valid .xlsx file (no zip signature).');

// ---- zip central directory
function unzip(b) {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('The workbook is not a valid .xlsx file (no zip directory).');
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const files = {};
  for (let k = 0; k < count; k++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip directory in the workbook.');
    const method = b.readUInt16LE(p + 10);
    const size = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28), extraLen = b.readUInt16LE(p + 30), commentLen = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(dataStart, dataStart + size);
    if (method === 8) files[name] = zlib.inflateRawSync(raw);
    else if (method === 0) files[name] = raw;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const files = unzip(buf);
const text = (name) => (files[name] ? files[name].toString('utf8') : '');
const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&');
const runs = (xml) => {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out += decode(m[1]);
  return out;
};
const attr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? m[1] : null; };
const colIndex = (ref) => { let n = 0; for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

const shared = [];
{
  const re = /<si>([\s\S]*?)<\/si>|<si\/>/g;
  let m;
  while ((m = re.exec(text('xl/sharedStrings.xml')))) shared.push(runs(m[1] || ''));
}
const rels = {};
{
  const re = /<Relationship\b[^>]*>/g;
  let m;
  while ((m = re.exec(text('xl/_rels/workbook.xml.rels')))) rels[attr(m[0], 'Id')] = attr(m[0], 'Target');
}

const sheets = {};
const re = /<sheet\b[^>]*>/g;
let sm;
while ((sm = re.exec(text('xl/workbook.xml')))) {
  const name = decode(attr(sm[0], 'name'));
  let target = (rels[attr(sm[0], 'r:id')] || '').replace(/^\//, '');
  if (!target.startsWith('xl/')) target = 'xl/' + target;
  const rows = [];
  // Rows may be self-closing (<row r="1" .../>) when empty; they carry no cells.
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  while ((rm = rowRe.exec(text(target)))) {
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[2] || ''))) {
      const ref = attr(cm[1], 'r');
      if (!ref) continue;
      const type = attr(cm[1], 't');
      const body = cm[2] || '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/);
      let val;
      if (type === 'inlineStr') val = runs(body);
      else if (!v) continue;
      else if (type === 's') val = shared[+v[1]];
      else if (type === 'str' || type === 'e') val = decode(v[1]);
      else if (type === 'b') val = v[1] === '1';
      else val = Number(v[1]);
      cells[colIndex(ref)] = val;
    }
    if (cells.length) {
      const row = [];
      for (let i = 0; i < cells.length; i++) row.push(cells[i] === undefined ? null : cells[i]);
      rows.push({ row: +(attr(rm[1], 'r') || rows.length + 1), cells: row });
    }
  }
  sheets[name] = rows;
}

return JSON.stringify({
  source: { file: url ? decodeURIComponent(url.split('/').pop().split('?')[0]) : 'workbook.xlsx', bytes: buf.length, via },
  sheets
});
