const crypto = require('crypto');

const memoryFiles = new Map();

function b2Config() {
  return {
    keyId: process.env.B2_KEY_ID || '',
    applicationKey: process.env.B2_APPLICATION_KEY || '',
    bucketId: process.env.B2_BUCKET_ID || '',
    bucketName: process.env.B2_BUCKET_NAME || ''
  };
}

function assertConfigured(config) {
  if (!config.keyId || !config.applicationKey || !config.bucketId || !config.bucketName) {
    const error = new Error('Backblaze B2 is not configured.');
    error.status = 503;
    error.code = 'B2_NOT_CONFIGURED';
    throw error;
  }
}

function memoryClient() {
  return {
    async upload({ fileName, body }) {
      const sha1 = crypto.createHash('sha1').update(body).digest('hex');
      const fileId = `test_${crypto.randomBytes(4).toString('hex')}`;
      memoryFiles.set(fileId, { body: Buffer.from(body), sha1, fileName });
      return { fileId, sha1, fileName };
    },
    async download(fileId) {
      const file = memoryFiles.get(fileId);
      if (!file) {
        const error = new Error('Backup file was not found.');
        error.status = 404;
        error.code = 'BACKUP_NOT_FOUND';
        throw error;
      }
      return file;
    }
  };
}

async function authorize(config) {
  const token = Buffer.from(`${config.keyId}:${config.applicationKey}`).toString('base64');
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${token}` }
  });
  if (!response.ok) {
    const error = new Error('Backblaze authorization failed.');
    error.status = 502;
    error.code = 'B2_UNAVAILABLE';
    throw error;
  }
  return response.json();
}

function liveClient(config) {
  return {
    async upload({ fileName, body }) {
      const auth = await authorize(config);
      const uploadResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketId: config.bucketId })
      });
      if (!uploadResponse.ok) {
        const error = new Error('Backblaze upload URL was not issued.');
        error.status = 502;
        error.code = 'B2_UNAVAILABLE';
        throw error;
      }
      const upload = await uploadResponse.json();
      const sha1 = crypto.createHash('sha1').update(body).digest('hex');
      const stored = await fetch(upload.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: upload.authorizationToken,
          'X-Bz-File-Name': encodeURI(fileName),
          'Content-Type': 'b2/x-auto',
          'Content-Length': String(body.length),
          'X-Bz-Content-Sha1': sha1
        },
        body
      });
      if (!stored.ok) {
        const error = new Error('Backblaze upload failed.');
        error.status = 502;
        error.code = 'B2_UNAVAILABLE';
        throw error;
      }
      const payload = await stored.json();
      return { fileId: payload.fileId, sha1, fileName: payload.fileName || fileName };
    },
    async download(fileId) {
      const auth = await authorize(config);
      const response = await fetch(
        `${auth.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${encodeURIComponent(fileId)}`,
        { headers: { Authorization: auth.authorizationToken } }
      );
      if (!response.ok) {
        const error = new Error('Backblaze download failed.');
        error.status = 502;
        error.code = 'B2_UNAVAILABLE';
        throw error;
      }
      const body = Buffer.from(await response.arrayBuffer());
      const sha1 = crypto.createHash('sha1').update(body).digest('hex');
      return { body, sha1, fileName: response.headers.get('x-bz-file-name') };
    }
  };
}

function client() {
  const config = b2Config();
  assertConfigured(config);
  if (config.keyId === 'test-key') return memoryClient();
  return liveClient(config);
}

module.exports = { client, b2Config };
