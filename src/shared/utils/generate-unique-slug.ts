import slugify from "./slugify.ts";

type SlugExistsFn = (slug: string) => Promise<boolean>;

export default async function generateUniqueSlug({
  currentSlug,
  text,
  exists,
}: {
  currentSlug?: string;
  text: string;
  exists: SlugExistsFn;
}): Promise<string> {
  const baseSlug = slugify(text);

  let slug = baseSlug;
  let counter = 1;

  while (slug !== currentSlug && (await exists(slug))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
