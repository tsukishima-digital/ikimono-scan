import { useEffect, useMemo, useRef, useState } from "react";

import { speciesPhotos, type SpeciesPhoto } from "../content/species-photos";
import type { ModelClass } from "../inference/types";
import { shouldDismissPhotoSheet } from "../photo-sheet-motion";

const GALLERY_BATCH_SIZE = 24;

interface SelectedSpecies {
  species: ModelClass;
  photo: SpeciesPhoto;
}

interface RevealRequest {
  id: string;
  sequence: number;
}

interface DragSample {
  position: number;
  time: number;
}

const MOBILE_SHEET_MEDIA = "(max-width: 620px)";

function matchesMedia(query: string) {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja")
    .replace(/[\u3041-\u3096]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) + 0x60),
    )
    .replace(/\s+/g, " ");
}

export function SpeciesGallery({ species }: { species: ModelClass[] }) {
  const [visibleCount, setVisibleCount] = useState(GALLERY_BATCH_SIZE);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [revealRequest, setRevealRequest] = useState<RevealRequest>();
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies>();
  const lastTrigger = useRef<HTMLElement | null>(null);
  const highlightedId = revealRequest?.id;

  const normalizedQuery = normalizeSearchText(query);
  const suggestions = useMemo(() => {
    if (!normalizedQuery) return [];
    return species
      .map((target, index) => {
        const commonName = normalizeSearchText(target.commonName ?? "");
        const scientificName = normalizeSearchText(target.scientificName);
        const rank =
          commonName === normalizedQuery
            ? 0
            : commonName.startsWith(normalizedQuery)
              ? 1
              : scientificName.startsWith(normalizedQuery)
                ? 2
                : `${commonName} ${scientificName}`.includes(normalizedQuery)
                  ? 3
                  : undefined;
        return { index, rank, target };
      })
      .filter(
        (
          result,
        ): result is typeof result & {
          rank: number;
        } => result.rank !== undefined,
      )
      .sort(
        (first, second) =>
          first.rank - second.rank || first.index - second.index,
      )
      .map(({ target }) => target)
      .slice(0, 8);
  }, [normalizedQuery, species]);

  useEffect(() => {
    if (!revealRequest) return;
    const card = document.getElementById(`species-${revealRequest.id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "auto", block: "center" });
    card.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [revealRequest, visibleCount]);

  function revealSpecies(target: ModelClass) {
    const targetIndex = species.findIndex(({ id }) => id === target.id);
    if (targetIndex < 0) return;
    setVisibleCount(
      Math.max(
        visibleCount,
        Math.ceil((targetIndex + 1) / GALLERY_BATCH_SIZE) * GALLERY_BATCH_SIZE,
      ),
    );
    setQuery(target.commonName || target.scientificName);
    setShowSuggestions(false);
    setRevealRequest((current) => ({
      id: target.id,
      sequence: (current?.sequence ?? 0) + 1,
    }));
  }

  function openPhoto(
    event: React.MouseEvent<HTMLButtonElement>,
    target: ModelClass,
    photo: SpeciesPhoto,
  ) {
    lastTrigger.current = event.currentTarget;
    setSelectedSpecies({ species: target, photo });
  }

  function closePhoto() {
    setSelectedSpecies(undefined);
    window.requestAnimationFrame(() => lastTrigger.current?.focus());
  }

  return (
    <>
      <div className="relative" data-testid="species-gallery">
        <p className="mt-8 mb-0 text-sm font-bold" id="species-search-label">
          生き物を検索
        </p>
        <div className="sticky top-[78px] z-20 -mx-2 mt-1 max-w-[696px] bg-paper/88 px-2 py-2 backdrop-blur-[18px] backdrop-saturate-150 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-paper/40 after:to-transparent after:content-[''] max-[720px]:top-[68px] [@media(prefers-contrast:more)]:bg-paper [@media(prefers-reduced-transparency:reduce)]:bg-paper [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
          <div
            className="relative max-w-[680px]"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setShowSuggestions(false);
              }
            }}
          >
            <input
              className="h-14 w-full rounded-[16px] border border-line bg-card px-5 text-base shadow-[0_8px_22px_rgb(20_38_26/7%)] outline-none transition-shadow focus:border-brand focus:ring-3 focus:ring-lime"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && suggestions[0]) {
                  event.preventDefault();
                  revealSpecies(suggestions[0]);
                }
              }}
              placeholder="和名または学名"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="species-search-suggestions"
              aria-expanded={showSuggestions && Boolean(normalizedQuery)}
              aria-labelledby="species-search-label"
            />
            {showSuggestions && normalizedQuery && (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-[16px] border border-line bg-card shadow-[0_18px_42px_rgb(20_38_26/16%)]">
                {suggestions.length > 0 ? (
                  <ul
                    id="species-search-suggestions"
                    className="m-0 max-h-[320px] list-none overflow-y-auto p-2"
                    aria-label="検索候補"
                  >
                    {suggestions.map((target) => (
                      <li key={target.id}>
                        <button
                          className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 rounded-[11px] border-0 bg-transparent px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-[#e8edde] active:bg-[#dce5d2] focus-visible:outline-3 focus-visible:outline-lime"
                          type="button"
                          onPointerDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => revealSpecies(target)}
                          aria-label={`${target.commonName || target.scientificName}を表示`}
                        >
                          <strong>{target.commonName || "和名なし"}</strong>
                          <i className="text-xs text-muted">
                            {target.scientificName}
                          </i>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 px-4 py-3 text-sm text-muted">
                    一致する生き物はありません。
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <ul
          className="mt-6 grid list-none grid-cols-4 gap-4 p-0 max-[900px]:grid-cols-3 max-[620px]:grid-cols-2 max-[620px]:gap-3"
          aria-label="判定できる生き物の一覧"
        >
          {species.slice(0, visibleCount).map((target) => {
            const photo = speciesPhotos[target.id];
            const name = target.commonName || "和名なし";
            return (
              <li
                className={`min-w-0 scroll-mt-28 rounded-[20px] outline-offset-4 transition-[outline-color,box-shadow] duration-200 ${
                  highlightedId === target.id
                    ? "outline-3 outline-lime shadow-[0_14px_36px_rgb(20_76_43/18%)]"
                    : "outline-3 outline-transparent"
                }`}
                id={`species-${target.id}`}
                key={target.id}
                aria-current={highlightedId === target.id ? "true" : undefined}
              >
                {photo ? (
                  <button
                    className="group block size-full cursor-zoom-in overflow-hidden rounded-[18px] border-0 bg-card p-0 text-left text-ink shadow-[0_10px_30px_rgb(20_38_26/9%)] transition-[transform,box-shadow] duration-100 ease-out hover:-translate-y-0.5 hover:shadow-[0_15px_34px_rgb(20_38_26/13%)] active:scale-[0.985] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
                    type="button"
                    aria-label={`${name}の写真を拡大`}
                    onClick={(event) => openPhoto(event, target, photo)}
                  >
                    <img
                      className="aspect-[4/3] w-full bg-[#dfe5d8] object-cover transition-transform duration-200 ease-out group-hover:scale-[1.025]"
                      src={photo.photoUrl}
                      alt={`${name}の写真`}
                      width={photo.width}
                      height={photo.height}
                      loading="lazy"
                      decoding="async"
                    />
                    <SpeciesCardCaption species={target} />
                  </button>
                ) : (
                  <div className="overflow-hidden rounded-[18px] bg-card shadow-[0_10px_30px_rgb(20_38_26/9%)]">
                    <div className="grid aspect-[4/3] place-items-center bg-[radial-gradient(circle_at_35%_30%,#d8ef70_0,#dce7c9_32%,#b9c9ae_100%)] text-[11px] font-bold text-brand/65">
                      写真なし
                    </div>
                    <SpeciesCardCaption species={target} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {visibleCount < species.length && (
          <div className="mt-10 flex justify-center">
            <button
              className="how-to-action"
              type="button"
              onClick={() =>
                setVisibleCount((count) => count + GALLERY_BATCH_SIZE)
              }
            >
              さらに表示
            </button>
          </div>
        )}
      </div>

      {selectedSpecies && (
        <PhotoDialog selected={selectedSpecies} onClose={closePhoto} />
      )}
    </>
  );
}

function SpeciesCardCaption({ species }: { species: ModelClass }) {
  return (
    <span className="block min-h-[92px] px-4 py-3.5 max-[620px]:min-h-[98px] max-[620px]:px-3">
      <strong
        className="line-clamp-2 text-[14px] leading-[1.55] max-[620px]:text-[13px]"
        data-testid="species-card-common-name"
      >
        {species.commonName || "和名なし"}
      </strong>
      <i className="mt-1.5 line-clamp-1 block text-[11px] text-muted">
        {species.scientificName}
      </i>
    </span>
  );
}

function PhotoDialog({
  selected,
  onClose,
}: {
  selected: SelectedSpecies;
  onClose: () => void;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const animationFrame = useRef<number | undefined>(undefined);
  const closing = useRef(false);
  const sheetOffset = useRef(0);
  const drag = useRef<
    | {
        active: boolean;
        offset: number;
        pointerId: number;
        samples: DragSample[];
        startOffset: number;
        startY: number;
      }
    | undefined
  >(undefined);
  const name = selected.species.commonName || "和名なし";

  function stopAnimation() {
    if (animationFrame.current !== undefined) {
      window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = undefined;
    }
  }

  function applySheetOffset(offset: number) {
    const sheet = dialog.current;
    if (!sheet) return;
    const clampedOffset = Math.max(0, offset);
    sheetOffset.current = clampedOffset;
    sheet.style.transform = `translate3d(0, ${clampedOffset}px, 0)`;
    const progress = Math.min(clampedOffset / (sheet.offsetHeight * 0.8), 1);
    if (scrim.current) scrim.current.style.opacity = `${1 - progress}`;
    if (backdrop.current) {
      backdrop.current.style.backdropFilter = `blur(${12 * (1 - progress)}px)`;
      backdrop.current.style.setProperty(
        "-webkit-backdrop-filter",
        `blur(${12 * (1 - progress)}px)`,
      );
    }
  }

  function animateSheet(
    target: number,
    initialVelocity: number,
    onComplete?: () => void,
  ) {
    const reduceMotion = matchesMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion) {
      applySheetOffset(target);
      onComplete?.();
      return;
    }

    stopAnimation();
    let position = sheetOffset.current;
    let velocity = initialVelocity;
    let previousTime = performance.now();
    const stiffness = 460;
    const damping = 38;

    const advance = (time: number) => {
      const elapsed = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration =
        -stiffness * (position - target) - damping * velocity;
      velocity += acceleration * elapsed;
      position += velocity * elapsed;
      if (target === 0) position = Math.max(0, position);
      if (drag.current) drag.current.offset = position;
      applySheetOffset(position);

      if (Math.abs(position - target) < 0.5 && Math.abs(velocity) < 5) {
        applySheetOffset(target);
        animationFrame.current = undefined;
        onComplete?.();
        return;
      }
      animationFrame.current = window.requestAnimationFrame(advance);
    };

    animationFrame.current = window.requestAnimationFrame(advance);
  }

  function dismissWithMotion(velocity = 0) {
    if (closing.current) return;
    if (!matchesMedia(MOBILE_SHEET_MEDIA) || !dialog.current) {
      onClose();
      return;
    }
    closing.current = true;
    const currentTransform = getComputedStyle(dialog.current).transform;
    sheetOffset.current =
      currentTransform === "none"
        ? sheetOffset.current
        : Math.max(0, new DOMMatrixReadOnly(currentTransform).m42);
    dialog.current.getAnimations().forEach((animation) => animation.cancel());
    applySheetOffset(sheetOffset.current);
    const target = window.innerHeight + 40;
    animateSheet(target, Math.max(velocity, 0), onClose);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      !matchesMedia(MOBILE_SHEET_MEDIA) ||
      !dialog.current
    ) {
      return;
    }

    closing.current = false;
    stopAnimation();
    const currentTransform = getComputedStyle(dialog.current).transform;
    const startOffset =
      currentTransform === "none"
        ? 0
        : Math.max(0, new DOMMatrixReadOnly(currentTransform).m42);
    dialog.current.getAnimations().forEach((animation) => animation.cancel());
    drag.current = {
      active: true,
      offset: startOffset,
      pointerId: event.pointerId,
      samples: [{ position: event.clientY, time: performance.now() }],
      startOffset,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    applySheetOffset(startOffset);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const currentDrag = drag.current;
    if (!currentDrag?.active || currentDrag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const distance = event.clientY - currentDrag.startY;
    const sheetHeight = dialog.current?.offsetHeight ?? window.innerHeight;
    const offset =
      distance >= 0
        ? currentDrag.startOffset + distance
        : currentDrag.startOffset -
          (Math.abs(distance) * sheetHeight * 0.18) /
            (sheetHeight + Math.abs(distance) * 0.18);
    currentDrag.offset = Math.max(0, offset);
    const sampleTime = performance.now();
    currentDrag.samples.push({
      position: event.clientY,
      time: sampleTime,
    });
    currentDrag.samples = currentDrag.samples.filter(
      ({ time }) => sampleTime - time <= 120,
    );
    applySheetOffset(currentDrag.offset);
  }

  function finishDrag(
    event: React.PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) {
    const currentDrag = drag.current;
    if (!currentDrag?.active || currentDrag.pointerId !== event.pointerId) {
      return;
    }
    currentDrag.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    currentDrag.samples.push({
      position: event.clientY,
      time: performance.now(),
    });
    const firstSample = currentDrag.samples[0];
    const lastSample = currentDrag.samples.at(-1) ?? firstSample;
    const elapsed = Math.max(lastSample.time - firstSample.time, 1);
    const velocity =
      ((lastSample.position - firstSample.position) / elapsed) * 1000;
    const sheetHeight = dialog.current?.offsetHeight ?? window.innerHeight;
    const shouldDismiss =
      !cancelled &&
      shouldDismissPhotoSheet({
        offset: currentDrag.offset,
        sheetHeight,
        velocity,
      });

    if (shouldDismiss) {
      dismissWithMotion(velocity);
    } else {
      animateSheet(0, velocity);
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeButton.current?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      stopAnimation();
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="photo-lightbox-backdrop fixed inset-0 z-50 grid cursor-zoom-out place-items-center p-6 backdrop-blur-md max-[620px]:items-end max-[620px]:p-0"
      ref={backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismissWithMotion();
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-ink/76"
        data-testid="species-photo-scrim"
        ref={scrim}
      />
      <section
        className="photo-lightbox-sheet animate-materialize relative grid h-[min(820px,calc(100dvh_-_48px))] max-h-[min(820px,calc(100dvh_-_48px))] w-[min(760px,100%)] cursor-auto grid-rows-[minmax(0,1fr)_180px] overflow-hidden rounded-[26px] bg-card shadow-[0_30px_80px_rgb(0_0_0/35%)] max-[620px]:h-[92dvh] max-[620px]:max-h-[92dvh] max-[620px]:w-full max-[620px]:grid-rows-[minmax(0,1fr)_210px] max-[620px]:rounded-t-[26px] max-[620px]:rounded-b-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="species-photo-title"
        ref={dialog}
      >
        <button
          className="absolute top-3 right-3 z-10 grid size-11 cursor-pointer place-items-center rounded-full border border-white/25 bg-ink/72 text-xl text-white backdrop-blur-lg transition-transform duration-100 active:scale-[0.94] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lime"
          type="button"
          aria-label="閉じる"
          onClick={() => dismissWithMotion()}
          ref={closeButton}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div
          className="photo-lightbox-drag-surface relative min-h-0 overflow-hidden bg-[#101813]"
          data-testid="species-photo-stage"
          onPointerCancel={(event) => finishDrag(event, true)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
        >
          <div
            className="pointer-events-none absolute top-2.5 left-1/2 z-10 hidden h-1.5 w-11 -translate-x-1/2 rounded-full bg-white/72 shadow-[0_1px_4px_rgb(0_0_0/25%)] max-[620px]:block"
            data-testid="species-photo-drag-handle"
            aria-hidden="true"
          />
          <img
            className="absolute inset-0 block size-full object-contain object-center"
            src={selected.photo.photoUrl}
            alt={`${name}の写真`}
            width={selected.photo.width}
            height={selected.photo.height}
            draggable={false}
          />
        </div>
        <div
          className="min-h-0 overflow-y-auto overscroll-contain p-6 max-[620px]:p-5"
          data-testid="species-photo-information"
        >
          <h3
            className="m-0 font-mincho text-[clamp(25px,4vw,34px)] font-semibold tracking-[-0.04em]"
            id="species-photo-title"
          >
            {name}
          </h3>
          <i className="mt-1.5 block text-sm text-muted">
            {selected.species.scientificName}
          </i>
          <p className="mt-4 mb-0 text-[11px] leading-[1.7] text-muted">
            写真: {selected.photo.attribution} /{" "}
            <a
              className="underline underline-offset-2"
              href={selected.photo.sourcePhotoUrl}
              target="_blank"
              rel="noreferrer"
            >
              iNaturalist
            </a>{" "}
            /{" "}
            <a
              className="underline underline-offset-2"
              href={selected.photo.licenseUrl}
              target="_blank"
              rel="noreferrer"
            >
              {selected.photo.license}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
