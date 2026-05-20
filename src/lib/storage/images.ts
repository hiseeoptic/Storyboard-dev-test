import { createAdminClient } from "@/lib/supabase/server";

export async function uploadImageFromUrl(
  imageUrl: string,
  bucket: string,
  path: string
): Promise<string> {
  const supabase = await createAdminClient();

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: blob.type || "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: publicUrl } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl.publicUrl;
}

export function getSceneImagePath(
  userId: string,
  projectId: string,
  sceneId: string
): string {
  return `${userId}/${projectId}/${sceneId}.png`;
}
