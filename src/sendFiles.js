import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {
  API_URL,
  COMPANION_ID,
  COMPANION_SECRET,
} from './config.js';
import { assertSaveFileSize } from './uploadLimits.js';

function buildSignaturePayload(fileInfo, eventType, timestamp, nonce) {
  return [
    COMPANION_ID,
    timestamp,
    nonce,
    eventType,
    fileInfo.name,
    String(fileInfo.size),
    fileInfo.modifiedAt.toISOString(),
    fileInfo.hash,
  ].join('\n');
}

export async function syncSaveFileMetadata(fileInfo, eventType) {
  if (!COMPANION_SECRET) {
    throw new Error('FOXPILE_COMPANION_SECRET is missing');
  }

  assertSaveFileSize(fileInfo);

  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const payload = buildSignaturePayload(fileInfo, eventType, timestamp, nonce);
  const signature = crypto
    .createHmac('sha256', COMPANION_SECRET)
    .update(payload)
    .digest('hex');

  const formData = new FormData();
  const buffer = await fs.readFile(fileInfo.filePath);
  const file = new Blob([buffer]);

  formData.append('eventType', eventType);
  formData.append('name', fileInfo.name);
  formData.append('size', String(fileInfo.size));
  formData.append('modifiedAt', fileInfo.modifiedAt.toISOString());
  formData.append('hash', fileInfo.hash);
  formData.append('file', file, fileInfo.name);

  const response = await fetch(`${API_URL}/game/save-files`, {
    method: 'POST',
    headers: {
      'x-foxpile-companion-id': COMPANION_ID,
      'x-foxpile-timestamp': timestamp,
      'x-foxpile-nonce': nonce,
      'x-foxpile-signature': signature,
    },
    body: formData
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `API returned ${response.status} ${response.statusText}: ${errorBody.slice(0, 1000)}`
    );
  }
}
