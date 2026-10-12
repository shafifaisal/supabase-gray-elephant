import Image from "next/image";

import type { PublicMedia } from "@/lib/media/urls";
import { articleImageAlt } from "@/lib/seo/alt-text";

/**
 * A fixed 16:9 thumbnail for an article.
 *
 * Every thumbnail shares the same aspect ratio and uses `object-fit: cover`, so
 * cards line up regardless of the source image's proportions. When an article
 * has no featured image, an inline placeholder is shown instead — never a
 * broken-image icon. The wrapper reserves the space (aspect ratio) to prevent
 * layout shift while the image loads.
 */
export function ArticleThumbnail({
  image,
  title,
  className = "",
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  image: PublicMedia | null | undefined;
  title: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden bg-secondary ${className}`}
    >
      {image ? (
        <Image
          src={image.url}
          alt={articleImageAlt({ title, alt: image.alt })}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-muted-foreground"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 opacity-60"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </span>
      )}
    </div>
  );
}
