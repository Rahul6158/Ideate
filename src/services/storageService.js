import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const storageService = {
  async uploadFile(fileOrBlob, ideaId, type = 'file') {
    const fileName = fileOrBlob.name || `${type}_${Date.now()}.${type === 'audio' ? 'webm' : 'png'}`;

    if (isSupabaseConfigured) {
      try {
        const fileExt = fileName.split('.').pop();
        const filePath = `${ideaId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('idea-attachments')
          .upload(filePath, fileOrBlob);

        if (!error) {
          const { data: { publicUrl } } = supabase.storage
            .from('idea-attachments')
            .getPublicUrl(filePath);

          return {
            file_name: fileName,
            file_type: type,
            file_size: fileOrBlob.size,
            storage_path: publicUrl
          };
        }
      } catch (err) {
        console.warn('Supabase storage bucket idea-attachments not yet created or accessible, falling back to local data URL:', err.message);
      }
    }

    // Local / Offline mode: convert file/blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          file_name: fileName,
          file_type: type,
          file_size: fileOrBlob.size || 50000,
          storage_path: reader.result,
          duration_seconds: fileOrBlob.duration || (type === 'audio' ? 24 : undefined)
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }
};
