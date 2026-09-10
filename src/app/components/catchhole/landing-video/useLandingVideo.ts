import { useEffect, useRef, useState, type RefObject } from 'react';
import { clamp, ease, geometryFor, smooth, toGlobal, toInternal } from './geometry';

type HeroMode = 'desktop' | 'mobile' | 'reduced';
type HeroState = {
  mode: HeroMode;
  scene: 'video' | 'manuscript' | 'settings';
  visibleMask: number;
  interactiveMask: number;
  confirmedMask: number;
  playing: boolean;
  ended: boolean;
  mediaError: boolean;
};
type Controls = { seek: (progress: number) => void; toggle: () => void; retry: () => void };
const groups = [
  { key: 'world', start: 12, end: 34, confirm: 78, x: 24, y: 160, width: 330, height: 512, originY: 332 },
  { key: 'character', start: 27, end: 46, confirm: 87, x: 1246, y: 185, width: 330, height: 272, originY: 453 },
  { key: 'magic', start: 41, end: 62, confirm: 96, x: 1246, y: 490, width: 330, height: 390, originY: 502 },
] as const;

function initialState(): HeroState {
  return {
    mode: typeof window !== 'undefined' && window.matchMedia('(max-width: 680px)').matches ? 'mobile' :
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'desktop',
    scene: 'video', visibleMask: 0, interactiveMask: 0, confirmedMask: 0,
    playing: false, ended: false, mediaError: false,
  };
}

export function useLandingVideo(scrollContainerRef: RefObject<HTMLDivElement>, headerRef: RefObject<HTMLElement>) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const [state, setState] = useState<HeroState>(initialState);

  useEffect(() => {
    const section = sectionRef.current, container = scrollContainerRef.current;
    const header = headerRef.current, video = videoRef.current;
    if (!section || !container || !header || !video) return;
    const find = <T extends Element>(selector: string) => section.querySelector<T>(selector)!;
    const sticky = find<HTMLDivElement>('.lvh-sticky');
    const story = find<HTMLDivElement>('.lvh-story');
    const viewport = find<HTMLDivElement>('.lvh-viewport');
    const canvas = find<HTMLDivElement>('.lvh-canvas');
    const film = find<HTMLDivElement>('.lvh-film');
    const freeze = find<HTMLImageElement>('.lvh-freeze');
    const foreground = find<HTMLDivElement>('.lvh-foreground');
    const editor = find<HTMLDivElement>('.lvh-editor');
    const copy = find<HTMLDivElement>('.lvh-copy');
    const shade = find<HTMLDivElement>('.lvh-shade');
    const cue = find<HTMLDivElement>('.lvh-cue');
    const heading = find<HTMLDivElement>('.lvh-scene-heading');
    const wires = find<SVGSVGElement>('.lvh-wires');
    const panels = groups.map(group => find<HTMLElement>(`[data-setting-group="${group.key}"]`));
    const panelHeights = groups.map(group => Number(group.height));
    const mobile = window.matchMedia('(max-width: 680px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const originalHeaderStyle = {
      opacity: header.style.opacity, transform: header.style.transform,
      visibility: header.style.visibility, pointerEvents: header.style.pointerEvents,
    };
    let disposed = false, renderFrame = 0, inertiaFrame = 0, sequenceFrame = 0, mode: HeroMode | '' = '';
    let progress = 0, staticProgress = 0, desiredTime = 0, suppressClickUntil = 0;
    let presentation = initialState();
    let drag: { id: number; startY: number; scroll: number; lastY: number; time: number; velocity: number; active: boolean } | null = null;

    const publish = (patch: Partial<HeroState>) => {
      presentation = { ...presentation, ...patch };
      const next = presentation;
      if (!disposed) setState(previous => (Object.keys(next) as (keyof HeroState)[])
        .every(key => previous[key] === next[key]) ? previous : next);
    };
    const inactive = () => Boolean(section.closest('[inert]'));
    const stopInertia = () => { cancelAnimationFrame(inertiaFrame); inertiaFrame = 0; };
    const pauseSequence = () => {
      cancelAnimationFrame(sequenceFrame);
      sequenceFrame = 0;
      if (mode === 'mobile' && staticProgress > 0) publish({ playing: false });
    };
    const scrollBounds = () => {
      const headerHeight = header.offsetHeight;
      const top = section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      return { start: Math.max(0, top - headerHeight), distance: Math.max(1, story.offsetHeight - container.clientHeight + headerHeight) };
    };
    const visible = (element: HTMLElement | SVGElement, opacity: number) => {
      element.style.opacity = String(opacity);
      element.style.visibility = opacity < .001 ? 'hidden' : 'visible';
      element.style.pointerEvents = opacity > .5 ? '' : 'none';
    };
    const requestRender = () => {
      if (renderFrame || disposed) return;
      renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
    };
    const syncMediaState = () => {
      if (mode === 'mobile' && staticProgress > 0) return;
      publish({ playing: !video.paused, ended: video.ended });
    };
    const playSequence = () => {
      if (inactive() || document.hidden || sequenceFrame || staticProgress >= 1) return;
      let previous = performance.now();
      publish({ playing: true });
      const advance = (now: number) => {
        if (disposed || mode !== 'mobile' || inactive() || document.hidden) { pauseSequence(); return; }
        // The mobile continuation runs on elapsed time, independently of page scrolling.
        staticProgress = clamp(staticProgress + Math.min(now - previous, 100) / 18000 * (1 - toGlobal(.6)));
        previous = now;
        render();
        if (staticProgress < 1) sequenceFrame = requestAnimationFrame(advance);
        else { sequenceFrame = 0; publish({ playing: false }); }
      };
      sequenceFrame = requestAnimationFrame(advance);
    };
    const onEnded = () => {
      syncMediaState();
      if (mode !== 'mobile' || !video.ended) return;
      staticProgress = toGlobal(reduce.matches ? .856 : .6);
      render();
      if (!reduce.matches) playSequence();
    };
    const startPlayback = () => {
      if (inactive()) return;
      const playbackMode = mode;
      void video.play().catch((error: unknown) => {
        if (disposed || playbackMode !== mode || mode === 'desktop' ||
          (error instanceof DOMException && error.name === 'AbortError')) return;
        video.controls = true;
        syncMediaState();
      });
    };
    const seekVideo = () => {
      if (mode !== 'desktop' || presentation.mediaError || video.readyState < 1 || video.seeking || inactive()) return;
      if (Math.abs(video.currentTime - desiredTime) > .035) {
        try { video.currentTime = desiredTime; } catch { /* Retry on the next media event. */ }
      }
    };
    const setProgress = (next: number) => {
      if (inactive()) return;
      stopInertia();
      pauseSequence();
      video.pause();
      if (mode === 'mobile') {
        staticProgress = clamp(next);
        if (next === 0) {
          video.currentTime = 0;
          publish({ ended: false, playing: false });
          if (!reduce.matches) startPlayback();
        }
        requestRender();
        return;
      }
      const { start, distance } = scrollBounds();
      if (mode === 'reduced') {
        staticProgress = clamp(next);
        if (next === 0) video.currentTime = 0;
        container.scrollTo({ top: start + (next > 0 ? header.offsetHeight : 0), behavior: 'instant' });
      } else container.scrollTo({ top: start + clamp(next) * distance, behavior: 'instant' });
      requestRender();
    };
    const setMode = () => {
      const next: HeroMode = mobile.matches ? 'mobile' : reduce.matches ? 'reduced' : 'desktop';
      if (next === mode) return;
      pauseSequence();
      mode = next;
      stopInertia();
      drag = null;
      viewport.classList.remove('is-dragging');
      video.pause();
      video.controls = false;
      staticProgress = 0;
      publish({ mode: next, scene: 'video', visibleMask: 0, interactiveMask: 0, confirmedMask: 0, ended: false, playing: false });
      section.dataset.mode = next;
      if (next !== 'desktop') {
        Object.assign(header.style, originalHeaderStyle);
        for (const element of [viewport, canvas, film, foreground]) {
          for (const property of ['left', 'top', 'width', 'height', 'transform', 'border-radius', 'opacity']) element.style.removeProperty(property);
        }
        sticky.style.top = '';
        if (next === 'mobile') {
          editor.removeAttribute('style');
          panels.forEach(panel => panel.removeAttribute('style'));
        }
        freeze.style.opacity = '0';
        foreground.style.opacity = '0';
        visible(copy, 1); visible(shade, 1); visible(cue, 0); visible(heading, 0);
        try { video.currentTime = 0; } catch { /* The initial poster is available before metadata. */ }
        if (next === 'mobile' && !reduce.matches) startPlayback();
      }
    };

    const render = () => {
      if (disposed) return;
      setMode();
      if (mode === 'mobile') {
        const ex = (toInternal(staticProgress) - .6) / .4 * 100;
        let visibleMask = 0, confirmedMask = 0;
        groups.forEach((group, index) => {
          if (ex >= group.start) visibleMask |= 1 << index;
          if (ex >= group.confirm) confirmedMask |= 1 << index;
        });
        section.dataset.progress = staticProgress.toFixed(4);
        editor.setAttribute('aria-hidden', String(staticProgress === 0));
        publish({ scene: staticProgress === 0 ? 'video' : visibleMask ? 'settings' : 'manuscript',
          visibleMask, interactiveMask: visibleMask, confirmedMask });
        return;
      }
      const { start, distance } = scrollBounds();
      const width = container.clientWidth, height = container.clientHeight, headerHeight = header.offsetHeight;
      progress = mode === 'reduced' ? staticProgress : clamp((container.scrollTop - start) / distance);
      const layout = geometryFor({ progress, width, height, headerHeight, reducedMotion: mode === 'reduced' });
      const { p, ex, morph, opening, viewport: rect, frameScale, sceneHeight, film: filmRect, editorRect } = layout;
      const compact = width < 1050;
      section.dataset.progress = progress.toFixed(4);
      sticky.style.top = (mode === 'reduced' ? 0 : headerHeight * (1 - opening)) + 'px';
      Object.assign(viewport.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`,
        borderRadius: `${40 * (1 - opening) * (1 - morph) + 12 * morph}px` });
      Object.assign(canvas.style, { width: '1600px', height: `${sceneHeight}px`, transform: `scale(${frameScale})` });
      canvas.style.setProperty('--lvh-target-size', `${44 / frameScale}px`);
      canvas.style.setProperty('--lvh-card-type', `${compact ? Math.max(20, 12.5 / frameScale) : 20}px`);
      canvas.style.setProperty('--lvh-card-name', `${compact ? Math.max(23, 14 / frameScale) : 23}px`);
      canvas.style.setProperty('--lvh-card-title', `${compact ? Math.max(20, 12.5 / frameScale) : 20}px`);
      canvas.style.setProperty('--lvh-card-status', `${compact ? Math.max(15, 11 / frameScale) : 15}px`);
      canvas.style.setProperty('--lvh-card-padding', `${compact ? Math.max(28, 12 / frameScale) : 28}px`);
      canvas.style.setProperty('--lvh-card-gap', `${compact ? 12 / frameScale : 20}px`);
      canvas.style.setProperty('--lvh-card-heading-gap', `${compact ? 12 / frameScale : 24}px`);
      canvas.style.setProperty('--lvh-card-value-gap', `${compact ? 4 / frameScale : 8}px`);
      canvas.style.setProperty('--lvh-card-button-gap', `${compact ? 12 / frameScale : 22}px`);
      canvas.style.setProperty('--lvh-character-name', `${compact ? Math.max(34, 20 / frameScale) : 34}px`);
      for (const element of [film, foreground]) Object.assign(element.style, {
        left: `${filmRect.x}px`, top: `${filmRect.y}px`, width: `${filmRect.width}px`, height: `${filmRect.height}px`,
      });
      film.style.opacity = String(mode === 'reduced' ? (p >= .6 ? 0 : 1) : 1 - smooth((p - .48) / .08));
      freeze.style.opacity = mode === 'desktop' && p >= .45 ? '1' : '0';
      foreground.style.opacity = mode === 'desktop' && p >= .45 ? String(1 - smooth((p - .474) / .006)) : '0';
      desiredTime = clamp(p / .45) * Math.min(7.35, Math.max(0, (video.duration || 7.375) - .025));
      seekVideo();
      editor.style.transform = layout.editorTransform;
      editor.style.opacity = String(mode === 'reduced' ? (p >= .6 ? 1 : 0) : smooth((p - .45) / .024));
      editor.style.setProperty('--lvh-screen-tint', String(mode === 'reduced' ? 0 : .7 * (1 - smooth((p - .48) / .1))));
      editor.style.borderRadius = p >= .6 ? '8px' : '0';
      editor.setAttribute('aria-hidden', String(p < .45));
      wires.setAttribute('viewBox', `0 0 1600 ${sceneHeight}`);
      wires.style.opacity = p >= .6 ? '1' : '0';
      let visibleMask = 0, interactiveMask = 0, confirmedMask = 0;
      let characterBottom = 0;
      groups.forEach((group, index) => {
        const panel = panels[index];
        const t = clamp((ex - group.start) / (group.end - group.start));
        const q = mode === 'reduced' ? (t > 0 ? 1 : 0) : ease(t);
        const confirmed = ex >= group.confirm;
        const panelWidth = compact ? Math.max(330, 194 / frameScale) : group.width;
        const panelX = index === 0 ? 24 : 1600 - panelWidth - 24;
        const panelY = compact ? (index === 0 ? 40 : index === 1 ? 60 : characterBottom + 50) : group.y;
        panel.style.width = `${panelWidth}px`;
        panel.style.left = `${panelX}px`;
        panel.style.top = `${panelY}px`;
        const panelHeight = panelHeights[index];
        if (index === 1) characterBottom = panelY + panelHeight;
        if (t > 0) visibleMask |= 1 << index;
        if (q > .95) interactiveMask |= 1 << index;
        if (confirmed) confirmedMask |= 1 << index;
        panel.style.opacity = String(q);
        panel.style.visibility = t > 0 ? 'visible' : 'hidden';
        panel.style.pointerEvents = q > .95 ? 'auto' : 'none';
        panel.style.transform = `translate(${(800 - panelX - panelWidth / 2) * (1 - q)}px,${(sceneHeight / 2 - panelY - panelHeight / 2) * (1 - q)}px) scale(${.88 + .12 * q})`;
        const left = index === 0, bend = left ? -44 : 44;
        const sx = left ? editorRect.x : editorRect.x + editorRect.width;
        const sy = editorRect.y + group.originY * editorRect.height / 1000;
        const endX = left ? panelX + panelWidth : panelX;
        const endY = panelY + panelHeight * (index === 2 ? .34 : .66);
        const line = find<SVGPathElement>(`[data-setting-wire="${group.key}"]`);
        line.setAttribute('d', `M ${sx} ${sy} C ${sx + bend} ${sy}, ${endX - bend} ${endY}, ${endX} ${endY}`);
        line.style.strokeDashoffset = String(1 - q);
        line.style.opacity = String(t <= 0 ? 0 : confirmed ? .28 : .85);
      });
      const copyOpacity = mode === 'reduced' ? (p < .6 ? 1 : 0) : 1 - smooth((p - .04) / .16);
      visible(copy, copyOpacity); visible(shade, copyOpacity);
      visible(cue, mode === 'reduced' ? 0 : 1 - smooth(progress / .025));
      visible(heading, mode === 'reduced' ? (p >= .6 ? 1 : 0) : smooth((p - .57) / .03));
      let headerOpacity = mode === 'reduced' ? 1 : Math.max(1 - opening, smooth((p - .55) / .05));
      if (header.contains(document.activeElement)) headerOpacity = 1;
      visible(header, headerOpacity);
      header.style.transform = `translateY(${-12 * (1 - headerOpacity)}px)`;
      publish({ scene: p < .6 ? 'video' : ex < 12 ? 'manuscript' : 'settings', visibleMask, interactiveMask, confirmedMask });
    };

    const onScroll = () => { if (mode === 'desktop') requestRender(); };
    const onModeChange = () => { mode = ''; requestRender(); };
    const onMediaReady = () => { publish({ mediaError: false }); requestRender(); };
    const onSeeked = () => { seekVideo(); };
    const onMediaError = () => { stopInertia(); publish({ mediaError: true, playing: false }); };
    const onKey = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stopInertia();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (mode !== 'desktop' || inactive() || event.pointerType !== 'mouse' || event.button !== 0 || toInternal(progress) >= .6 ||
        (event.target as Element).closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      stopInertia();
      drag = { id: event.pointerId, startY: event.clientY, scroll: container.scrollTop,
        lastY: event.clientY, time: event.timeStamp, velocity: 0, active: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId || inactive()) return;
      if (!drag.active && Math.abs(event.clientY - drag.startY) < 8) return;
      if (!drag.active) { drag.active = true; viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging'); }
      event.preventDefault();
      const velocity = (drag.lastY - event.clientY) * 1.6 / Math.max(1, event.timeStamp - drag.time);
      drag.velocity = Math.max(-2.5, Math.min(2.5, .6 * drag.velocity + .4 * velocity));
      drag.lastY = event.clientY; drag.time = event.timeStamp;
      const { start, distance } = scrollBounds();
      container.scrollTo({ top: Math.max(start, Math.min(start + distance, drag.scroll + (drag.startY - event.clientY) * 1.6)), behavior: 'instant' });
      requestRender();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const released = drag; drag = null;
      viewport.classList.remove('is-dragging');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (!released.active) return;
      suppressClickUntil = performance.now() + 100;
      if (event.type === 'pointercancel' || event.timeStamp - released.time > 90 || inactive()) return;
      let velocity = released.velocity, previous = performance.now();
      const coast = (now: number) => {
        if (disposed || inactive()) return;
        const elapsed = Math.min(32, now - previous); previous = now;
        const { start, distance } = scrollBounds();
        const next = Math.max(start, Math.min(start + distance, container.scrollTop + velocity * elapsed));
        container.scrollTo({ top: next, behavior: 'instant' });
        velocity *= Math.exp(-elapsed / 150);
        if (Math.abs(velocity) > .025 && next > start && next < start + distance) inertiaFrame = requestAnimationFrame(coast);
        else inertiaFrame = 0;
      };
      inertiaFrame = requestAnimationFrame(coast);
    };
    const onClick = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    };
    const preventNativeDrag = (event: DragEvent) => event.preventDefault();
    controlsRef.current = {
      seek: setProgress,
      toggle: () => {
        if (inactive() || mode === 'desktop') return;
        if (mode === 'mobile' && staticProgress > 0) {
          if (staticProgress >= toGlobal(.984)) setProgress(0);
          else if (sequenceFrame) pauseSequence();
          else playSequence();
          return;
        }
        if (!video.paused) video.pause();
        else { if (video.ended) video.currentTime = 0; startPlayback(); }
      },
      retry: () => { publish({ mediaError: false }); video.load(); if (mode === 'mobile' && !reduce.matches) startPlayback(); },
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', stopInertia, { passive: true });
    container.addEventListener('touchstart', stopInertia, { passive: true });
    container.addEventListener('keydown', onKey);
    header.addEventListener('focusin', requestRender);
    header.addEventListener('focusout', requestRender);
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('dragstart', preventNativeDrag);
    viewport.addEventListener('click', onClick, true);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    mobile.addEventListener('change', onModeChange);
    reduce.addEventListener('change', onModeChange);
    video.addEventListener('loadedmetadata', onMediaReady);
    video.addEventListener('loadeddata', onMediaReady);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', syncMediaState);
    video.addEventListener('pause', syncMediaState);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onMediaError);
    // Cache card measurements outside animation writes; scroll frames only read the viewport once.
    const resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const index = panels.indexOf(entry.target as HTMLElement);
        if (index >= 0) panelHeights[index] = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      });
      requestRender();
    });
    resizeObserver.observe(container); resizeObserver.observe(header);
    panels.forEach(panel => resizeObserver.observe(panel));
    const inertObserver = new MutationObserver(() => {
      if (!inactive()) return;
      stopInertia();
      pauseSequence();
      if (drag && viewport.hasPointerCapture(drag.id)) viewport.releasePointerCapture(drag.id);
      drag = null;
      viewport.classList.remove('is-dragging');
      video.pause();
    });
    let ancestor: HTMLElement | null = container.parentElement;
    while (ancestor) {
      inertObserver.observe(ancestor, { attributes: true, attributeFilter: ['inert'] });
      ancestor = ancestor.parentElement;
    }
    const onVisibilityChange = () => {
      if (document.hidden) { pauseSequence(); if (mode !== 'desktop') video.pause(); }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timeout = window.setTimeout(() => { if (video.readyState < 1) onMediaError(); }, 12000);
    render();

    return () => {
      disposed = true;
      controlsRef.current = null;
      cancelAnimationFrame(renderFrame); stopInertia(); pauseSequence(); window.clearTimeout(timeout);
      resizeObserver.disconnect();
      inertObserver.disconnect();
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', stopInertia);
      container.removeEventListener('touchstart', stopInertia);
      container.removeEventListener('keydown', onKey);
      header.removeEventListener('focusin', requestRender);
      header.removeEventListener('focusout', requestRender);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('dragstart', preventNativeDrag);
      viewport.removeEventListener('click', onClick, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      mobile.removeEventListener('change', onModeChange);
      reduce.removeEventListener('change', onModeChange);
      video.removeEventListener('loadedmetadata', onMediaReady);
      video.removeEventListener('loadeddata', onMediaReady);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', syncMediaState);
      video.removeEventListener('pause', syncMediaState);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onMediaError);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      video.pause();
      Object.assign(header.style, originalHeaderStyle);
    };
  }, [headerRef, scrollContainerRef]);

  return {
    sectionRef, videoRef, state,
    showSettings: () => controlsRef.current?.seek(toGlobal(.856)),
    showVideo: () => controlsRef.current?.seek(0),
    confirm: (index: number) => controlsRef.current?.seek(toGlobal(.6 + .4 * (groups[index].confirm + .05) / 100)),
    togglePlayback: () => controlsRef.current?.toggle(),
    retryVideo: () => controlsRef.current?.retry(),
  };
}
