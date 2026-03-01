const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadUploadPipelineWithTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ids-admin-upload-'));
  process.env.IDS_ADMIN_DATA_DIR = tempDir;

  const serverModulePath = path.resolve(__dirname, '../src/server.js');
  delete require.cache[serverModulePath];
  const server = require(serverModulePath);

  return {
    tempDir,
    processUploadMultipart: server.processUploadMultipart,
    MAX_UPLOAD_SIZE: server.MAX_UPLOAD_SIZE,
    UPLOAD_DIR: server.UPLOAD_DIR,
  };
}

function buildMultipartBody({ filename, mimeType, content }) {
  const boundary = '----idsBoundaryTest1234';
  const head = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n');

  const tail = `\r\n--${boundary}--\r\n`;

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    bodyBuffer: Buffer.concat([
      Buffer.from(head, 'utf8'),
      Buffer.isBuffer(content) ? content : Buffer.from(content),
      Buffer.from(tail, 'utf8'),
    ]),
  };
}

test('accepts valid image upload', () => {
  const { processUploadMultipart, UPLOAD_DIR } = loadUploadPipelineWithTempDir();

  const multipart = buildMultipartBody({
    filename: 'poster.png',
    mimeType: 'image/png',
    content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });

  const result = processUploadMultipart({
    bodyBuffer: multipart.bodyBuffer,
    contentType: multipart.contentType,
    reqLike: { headers: { host: '127.0.0.1:8081' } },
  });

  assert.equal(result.mimeType, 'image/png');
  assert.ok(result.filename.endsWith('.png'));
  assert.ok(result.url.includes('/media/'));
  assert.ok(fs.existsSync(path.join(UPLOAD_DIR, result.filename)));
});

test('rejects unsupported mime type', () => {
  const { processUploadMultipart } = loadUploadPipelineWithTempDir();

  const multipart = buildMultipartBody({
    filename: 'notes.txt',
    mimeType: 'text/plain',
    content: 'hello',
  });

  assert.throws(
    () => processUploadMultipart({ bodyBuffer: multipart.bodyBuffer, contentType: multipart.contentType }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.code === 'invalid_mime_type'),
  );
});

test('rejects oversized uploads', () => {
  const { processUploadMultipart, MAX_UPLOAD_SIZE } = loadUploadPipelineWithTempDir();

  const multipart = buildMultipartBody({
    filename: 'movie.mp4',
    mimeType: 'video/mp4',
    content: Buffer.alloc(MAX_UPLOAD_SIZE + 1, 0),
  });

  assert.throws(
    () => processUploadMultipart({ bodyBuffer: multipart.bodyBuffer, contentType: multipart.contentType }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.code === 'too_large'),
  );
});
