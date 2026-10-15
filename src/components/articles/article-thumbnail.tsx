import Image from "next/image";

import type { PublicMedia } from "@/lib/media/urls";
import { articleImageAlt } from "@/lib/seo/alt-text";

/**
 * A fixed 16:9 thumbnail for an article.
 *
 * Every thumbnail shares the same aspect ratio, so cards line up across
 * desktop, tablet and mobile and the wrapper reserves its space up front (no
 * layout shift while the image loads).
 *
 * Inside that box the image fills the frame from edge to edge:
 *   * `fill` makes the <img> absolutely positioned at inset-0, and the explicit
 *     `h-full w-full` size it to 100% of the container in both axes.
 *   * `object-cover` scales the image proportionally until it covers the whole
 *     box, then crops the overflow centred via `object-center`.
 *   * `overflow-hidden` on the wrapper clips that overflow, so a mismatched
 *     aspect ratio is cropped rather than spilling outside the card.
 *
 * Because the scale is proportional the image is never stretched or distorted;
 * `object-fit: contain` was tried previously and rejected because it left
 * blank bars on the sides of every non-16:9 image.
 *
 * There is deliberately NO padding or margin on the image or the wrapper: any
 * internal spacing would stop the picture from reaching the four edges and
 * reintroduce the gap this component exists to avoid.
 *
 * When an article has no featured image, an inline placeholder is shown
 * instead — never a broken-image icon.
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
      className={`relative block aspect-video w-full overflow-hidden bg-secondary ${className}`}
    >
      {image ? (
        <Image
          src={image.url}
          alt={articleImageAlt({ title, alt: image.alt })}
          fill
          sizes={sizes}
          priority={priority}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
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
