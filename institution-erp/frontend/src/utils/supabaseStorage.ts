import { supabase } from './supabase';

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

export const supabaseStorage = {
  /**
   * Upload a file to a specific Supabase storage bucket
   * @param bucket Name of bucket (e.g. 'documents', 'avatars', 'notices')
   * @param path File path inside bucket (e.g. 'students/2026-CLS-0001/id-card.jpg')
   * @param file File object or Blob
   */
  async uploadFile(bucket: string, path: string, file: File | Blob): Promise<StorageUploadResult> {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  },

  /**
   * Retrieve the public URL of a file stored in Supabase
   */
  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Delete a file from Supabase storage
   */
  async deleteFile(bucket: string, paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      throw error;
    }
  },
};
