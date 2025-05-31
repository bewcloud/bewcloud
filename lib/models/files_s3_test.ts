import { assert, assertEquals, assertRejects, assertFalse } from 'std/assert/mod.ts';
import { afterEach, beforeEach, describe, it } from 'std/testing/bdd.ts';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { mockClient, AwsStub } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest'; // Extends jest matchers, useful for `toHaveBeenCalledWith` etc.

import { FileModel, ensureUserPathIsValidAndSecurelyAccessible, deleteDirectoryOrFile, renameDirectoryOrFile } from './files.ts'; // Assuming deleteDirectoryOrFile and renameDirectoryOrFile are exported for direct testing if needed
import { AppConfig } from '../config.ts';
import { S3Config, User } from '../types.ts'; // S3Config might be needed for AppConfig mock
import { TRASH_PATH } from '../utils/files.ts';

describe('FileModel S3 Operations', () => {
  let s3Mock: AwsStub<any, any>;
  let originalEnvGet: (key: string) => string | undefined;

  const mockS3Config: S3Config = {
    bucket: 'test-bucket',
    region: 'test-region',
    accessKeyID: 'test-access-key-id',
    secretAccessKey: 'test-secret-access-key',
    endpoint: 'http://localhost:9000', // Example for MinIO or local S3
  };

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    hashed_password: 'hashedpassword',
    subscription: { external: {}, expires_at: new Date(Date.now() + 3600000).toISOString(), updated_at: new Date().toISOString() },
    status: 'active',
    extra: { is_email_verified: true },
    created_at: new Date(),
  };

  beforeEach(async () => {
    s3Mock = mockClient(S3Client);

    // Mock AppConfig.getS3Config() by mocking environment variables
    // Or, if AppConfig is more complex, consider stubbing getS3Config directly using sinon
    originalEnvGet = Deno.env.get;
    Deno.env.get = (key: string): string | undefined => {
      switch (key) {
        case 'S3_BUCKET': return mockS3Config.bucket;
        case 'S3_REGION': return mockS3Config.region;
        case 'S3_ACCESS_KEY_ID': return mockS3Config.accessKeyID;
        case 'S3_SECRET_ACCESS_KEY': return mockS3Config.secretAccessKey;
        case 'S3_ENDPOINT': return mockS3Config.endpoint;
        default: return originalEnvGet(key);
      }
    };
    // Reset AppConfig internal cache if it loads config only once
    // This might require a method in AppConfig to reset its loaded config, or more advanced mocking.
    // For now, assuming direct env var mocking is sufficient for AppConfig.getS3Config() to pick up test values.
    // If AppConfig.loadConfig() has been called, we might need to force a reload or mock AppConfig.getConfig()
    // A simple way for now is to ensure AppConfig is "fresh" or its config loading is influenced by these env vars.
    // Potentially, explicitly call AppConfig.getConfig() here if needed to ensure it loads with mocked envs.
    // Or better: directly mock AppConfig.getS3Config itself if sinon was fully integrated
    // For now, let's assume AppConfig.getS3Config() will re-evaluate Deno.env.get()
    await AppConfig.getS3Config(); // "Prime" it if it caches, or ensure it runs with new env mocks.
  });

  afterEach(() => {
    s3Mock.reset();
    Deno.env.get = originalEnvGet; // Restore original Deno.env.get
     // If AppConfig was directly mocked (e.g. with sinon), restore it here.
  });

  describe('FileModel.create', () => {
    it('should upload a file to S3 and return true on success', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const result = await FileModel.create(mockUser.id, '/test-path/', 'test-file.txt', 'file content');
      assertEquals(result, true);
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: mockS3Config.bucket,
        Key: `users/${mockUser.id}/test-path/test-file.txt`,
        Body: 'file content',
        ContentType: 'text/plain',
      });
    });

    it('should return false on S3 upload failure', async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 Upload Error'));
      const result = await FileModel.create(mockUser.id, '/test-path/', 'test-file.txt', 'file content');
      assertEquals(result, false);
    });

     it('should throw error if S3 config is missing', async () => {
      Deno.env.get = (key: string) => (key === 'S3_BUCKET' ? undefined : originalEnvGet(key)); // unset one S3 var
      // Need to ensure AppConfig re-reads, this is tricky without direct mock of AppConfig.getS3Config
      // Forcing a re-evaluation or specific mock setup for AppConfig.getS3Config would be better.
      // This test might be flaky depending on AppConfig's caching.
      await assertRejects(
        async () => {
          await FileModel.create(mockUser.id, '/test-path/', 'test-file.txt', 'file content');
        },
        Error,
        'S3 configuration is not available',
      );
    });
  });

  describe('FileModel.get', () => {
    const filePath = '/test-path/test-file.txt';
    const s3Key = `users/${mockUser.id}/test-path/test-file.txt`;

    it('should download a file from S3 and return its content and metadata', async () => {
      const mockFileContent = 'Hello S3!';
      const mockContentType = 'text/plain';
      const mockContentLength = mockFileContent.length;

      s3Mock.on(HeadObjectCommand, { Bucket: mockS3Config.bucket, Key: s3Key })
        .resolves({ ContentType: mockContentType, ContentLength: mockContentLength });

      // Mocking S3's GetObjectCommandOutput.Body (ReadableStream)
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockFileContent));
          controller.close();
        }
      });
      s3Mock.on(GetObjectCommand, { Bucket: mockS3Config.bucket, Key: s3Key })
        .resolves({ Body: stream });

      const result = await FileModel.get(mockUser.id, '/test-path/', 'test-file.txt');

      assertEquals(result.success, true);
      assertEquals(new TextDecoder().decode(result.contents), mockFileContent);
      assertEquals(result.contentType, mockContentType);
      assertEquals(result.byteSize, mockContentLength);
    });

    it('should return success: false if file not found in S3 (HeadObject fails)', async () => {
      s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' });
      const result = await FileModel.get(mockUser.id, '/test-path/', 'test-file.txt');
      assertEquals(result.success, false);
    });

    it('should return success: false if file not found in S3 (GetObject fails after HeadObject)', async () => {
      s3Mock.on(HeadObjectCommand).resolves({ ContentType: 'text/plain', ContentLength: 10 });
      s3Mock.on(GetObjectCommand).rejects({ name: 'NotFound' });
      const result = await FileModel.get(mockUser.id, '/test-path/', 'test-file.txt');
      assertEquals(result.success, false);
    });
  });

  // Note: FileModel.delete and FileModel.rename call helper functions.
  // It's often better to test the helper functions directly if they contain the core logic,
  // or test FileModel methods and ensure they call the helpers which in turn interact with S3.
  // For this example, we'll test the FileModel methods and mock S3 calls expected from helpers.

  describe('FileModel.delete (via deleteDirectoryOrFile)', () => {
    const fileName = 'file-to-delete.txt';
    const filePath = '/data/';
    const s3Key = `users/${mockUser.id}/data/${fileName}`;
    const trashS3Key = `users/${mockUser.id}/${TRASH_PATH.substring(1)}${fileName}`;

    it('should move a file to S3 trash and return true', async () => {
      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({}); // For deleting the original

      const result = await FileModel.delete(mockUser.id, filePath, fileName);
      assertEquals(result, true);
      expect(s3Mock).toHaveReceivedCommandWith(CopyObjectCommand, {
        Bucket: mockS3Config.bucket,
        CopySource: encodeURI(`${mockS3Config.bucket}/${s3Key}`),
        Key: trashS3Key,
      });
      expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
        Bucket: mockS3Config.bucket,
        Key: s3Key,
      });
    });

    it('should permanently delete a file from S3 trash and return true', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});
      const result = await FileModel.delete(mockUser.id, TRASH_PATH, fileName); // Path is TRASH_PATH
      assertEquals(result, true);
      expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
        Bucket: mockS3Config.bucket,
        Key: `users/${mockUser.id}/${TRASH_PATH.substring(1)}${fileName}`,
      });
    });
  });


  describe('FileModel.rename (via renameDirectoryOrFile)', () => {
    const oldName = 'old-name.txt';
    const newName = 'new-name.txt';
    const path = '/data/';
    const oldS3Key = `users/${mockUser.id}/data/${oldName}`;
    const newS3Key = `users/${mockUser.id}/data/${newName}`;

    it('should rename a file in S3 (copy then delete) and return true', async () => {
      s3Mock.on(CopyObjectCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});

      const result = await FileModel.rename(mockUser.id, path, path, oldName, newName);
      assertEquals(result, true);
      expect(s3Mock).toHaveReceivedCommandWith(CopyObjectCommand, {
        Bucket: mockS3Config.bucket,
        CopySource: encodeURI(`${mockS3Config.bucket}/${oldS3Key}`),
        Key: newS3Key,
      });
      expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
        Bucket: mockS3Config.bucket,
        Key: oldS3Key,
      });
    });
  });

  describe('FileModel.list', () => {
    const listPath = '/documents/';
    const s3Prefix = `users/${mockUser.id}/documents/`;

    it('should list files from S3 and return DirectoryFile array', async () => {
      s3Mock.on(ListObjectsV2Command, { Prefix: s3Prefix })
        .resolves({
          Contents: [
            { Key: `${s3Prefix}file1.txt`, Size: 100, LastModified: new Date() },
            { Key: `${s3Prefix}file2.pdf`, Size: 2000, LastModified: new Date() },
            { Key: `${s3Prefix}`, Size: 0 }, // Should be ignored (prefix itself)
            { Key: `${s3Prefix}subfolder/`, Size: 0 }, // Should be ignored (pseudo-directory)
            { Key: `${s3Prefix}subfolder/nestedfile.txt`, Size: 50 }, // Should be ignored (not immediate child)
          ],
        });

      const result = await FileModel.list(mockUser.id, listPath);
      assertEquals(result.length, 2);
      assertEquals(result[0].file_name, 'file1.txt');
      assertEquals(result[0].size_in_bytes, 100);
      assertEquals(result[1].file_name, 'file2.pdf');
      assertEquals(result[1].size_in_bytes, 2000);
    });

    it('should return an empty array for an empty S3 "directory"', async () => {
      s3Mock.on(ListObjectsV2Command, { Prefix: s3Prefix }).resolves({ Contents: [] });
      const result = await FileModel.list(mockUser.id, listPath);
      assertEquals(result.length, 0);
    });

    it('should handle pagination from S3', async () => {
      s3Mock.on(ListObjectsV2Command, { Prefix: s3Prefix, ContinuationToken: undefined })
        .resolvesOnce({
          Contents: [{ Key: `${s3Prefix}page1.txt`, Size: 10, LastModified: new Date() }],
          NextContinuationToken: 'next-token',
          IsTruncated: true,
        })
        .on(ListObjectsV2Command, { Prefix: s3Prefix, ContinuationToken: 'next-token' })
        .resolvesOnce({
          Contents: [{ Key: `${s3Prefix}page2.txt`, Size: 20, LastModified: new Date() }],
          IsTruncated: false,
        });

      const result = await FileModel.list(mockUser.id, listPath);
      assertEquals(result.length, 2);
      assertEquals(result.find(f => f.file_name === 'page1.txt')?.size_in_bytes, 10);
      assertEquals(result.find(f => f.file_name === 'page2.txt')?.size_in_bytes, 20);
    });
  });

  // Test for ensureUserPathIsValidAndSecurelyAccessible (already exists, but good to have a focused test)
  // This function does not directly interact with S3 but is critical for security.
  describe('ensureUserPathIsValidAndSecurelyAccessible', () => {
    const userId = 'test-user';
    // Mock AppConfig.getFilesRootPath for this specific test, as it's not S3 related
    let originalFilesRootPath: string | undefined;
    const MOCK_FILES_ROOT = 'mock_data_files_root';

    beforeEach(async () => {
      // Temporarily override getFilesRootPath or the env var it uses
      // This is a bit of a hack. A dedicated mock for AppConfig.getFilesRootPath would be cleaner.
      // For now, we assume getFilesRootPath relies on an env var we can mock or it's simple enough.
      // Let's assume AppConfig.getFilesRootPath() is something like:
      // static async getFilesRootPath(): Promise<string> { return Deno.env.get("FILES_ROOT_PATH") || "default_path"; }
      // So we mock Deno.env.get for 'FILES_ROOT_PATH'
      // This is a simplification. If AppConfig.getFilesRootPath is more complex, this won't work.

      // Storing and restoring Deno.env.get is already handled by the outer describe's beforeEach/afterEach
      // We just need to add the specific env var for this function if it's used by AppConfig.getFilesRootPath
      // For files.ts, AppConfig.getFilesRootPath() uses `this.config.files.rootPath`
      // which is loaded from bewcloud.config.ts or defaults.
      // So we need to ensure AppConfig.getConfig() returns a config where `files.rootPath` is known for the test.
      // The most robust way is to mock AppConfig.getFilesRootPath directly if possible with chosen mock framework.
      // Given current setup, we rely on the global Deno.env.get mock and AppConfig picking that up.
      // Let's assume the default 'data-files' is used if not overridden by bewcloud.config.ts
      // Or, we can try to make AppConfig use a specific root for tests:
      const originalGetConfig = AppConfig.getConfig;
      AppConfig.getConfig = async () => ({
        ...(await originalGetConfig()), // get other defaults
        files: { rootPath: MOCK_FILES_ROOT }
      });
      // this also means we need to restore it in afterEach
      (AppConfig.getConfig as any)._original = originalGetConfig;
    });

    afterEach(async () => {
       if ((AppConfig.getConfig as any)._original) {
         AppConfig.getConfig = (AppConfig.getConfig as any)._original;
       }
    });

    it('should resolve if path is valid and within user root', async () => {
      await assert(ensureUserPathIsValidAndSecurelyAccessible(userId, '/valid/path'));
      await assert(ensureUserPathIsValidAndSecurelyAccessible(userId, '/'));
    });

    it('should throw if path attempts to go outside user root (directory traversal)', async () => {
      await assertRejects(
        async () => {
          await ensureUserPathIsValidAndSecurelyAccessible(userId, '/../../etc/passwd');
        },
        Error,
        'Invalid file path',
      );
      await assertRejects(
        async () => {
          await ensureUserPathIsValidAndSecurelyAccessible(userId, '../outside.txt');
        },
        Error,
        'Invalid file path',
      );
    });
  });

});

// Helper to convert ReadableStream to string for easier assertion if needed elsewhere
// async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
//   const reader = stream.getReader();
//   const decoder = new TextDecoder();
//   let result = '';
//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;
//     if (value) result += decoder.decode(value, { stream: true });
//   }
//   result += decoder.decode(); // flush
//   return result;
// }
