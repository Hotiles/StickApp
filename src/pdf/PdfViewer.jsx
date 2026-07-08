import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BandOverlay from './BandOverlay.jsx';
import PageGallery from './PageGallery.jsx';
import Modal from '../ui/Modal.jsx';
import { stepBandFit, BAND_STEP_PT } from './bandFit.js';
import { cycleOrientation, normalizeBand, makeSecondBand, BAND_COLORS } from './bandState.js';

/*
 * Mönstervisaren: pdf.js-canvas med pinch-zoom, panorering, sidbläddring
 * (knappar + svep) och bandet som overlay i dokumentkoordinater.
 *
 * zoom = 1 betyder "sidan fyller skärmens bredd". Canvasen ritas om i skarp
 * upplösning när zoomen stannat (och CSS-skalas under själva gesten).
 */

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const MAX_CANVAS_PIXELS = 12_000_000; // säkerhetsmarginal för iOS-canvasgränser
const MAX_CANVAS_DIM = 4096;
const SWIPE_MIN_DX = 64;
const DEFAULT_BAND_POSITION = 0.25;
const MARKER_PT = 26; // ringmarkörens diameter i PDF-punkter (D3/M1)
const MARKER_BAR_PT = 22; // markeringsstapelns höjd i PDF-punkter (M2)
const MARKER_BAR_MIN_W = 0.02; // kortare svep än så räknas inte som en stapel
const MARKER_TAP_MOVE = 12; // rörelse under detta = tryck, inte panorering

export default function PdfViewer({
  doc,
  initialViewState,
  bandOpacity = 0.4,
  bandThickness = 24, // standardtjocklek i PDF-punkter (Inställningar)
  showBandControls = true,
  onStateChange, // (viewState) => void — anroparen sköter debounce/persistens
}) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);

  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [pageNum, setPageNum] = useState(() => clampPage(initialViewState?.page ?? 1, doc));
  const [pageInfo, setPageInfo] = useState(null); // { page, widthPt, heightPt }
  const [zoom, setZoom] = useState(initialViewState?.zoom ?? 1);
  const [scroll, setScroll] = useState({
    x: initialViewState?.scrollX ?? 0,
    y: initialViewState?.scrollY ?? 0,
  });
  const [settledZoom, setSettledZoom] = useState(initialViewState?.zoom ?? 1);
  // Riktningen kan vara 'horisontell', 'vertikal' eller 'båda' (två band
  // i kors). Äldre sparade lägen lyfts till dagens form (bandState.js).
  // Varje band bär nu sin egen färg och tjockleksöverride (D2/D6): finns
  // ingen override (null) gäller Inställningars standard — och standarden
  // fortsätter gälla tills användaren faktiskt passar in bandet.
  const [band, setBand] = useState(() => {
    const primary = normalizeBand(initialViewState?.band, BAND_COLORS[0]);
    // D6-arv: äldre projekt lade projekt-tjockleken i viewState.bandThickness.
    // Flytta in den på första bandet så att alla band följer samma modell.
    if (primary.thicknessPt == null && initialViewState?.bandThickness != null) {
      return { ...primary, thicknessPt: initialViewState.bandThickness };
    }
    return primary;
  });
  // Andra bandet (D2): opt-in, null tills användaren lägger till det.
  const [band2, setBand2] = useState(() =>
    initialViewState?.band2 ? normalizeBand(initialViewState.band2, BAND_COLORS[1]) : null
  );
  // Vilket band verktygsknapparna (synlighet, riktning, inpassning) styr.
  const [activeBandIndex, setActiveBandIndex] = useState(0);
  // Markörer (D3/M1/M2) per sida i dokumentkoordinater (0–1). Två former:
  // ring {type:'ring',x,y} (tryck) och stapel {type:'bar',x,y,w} (svep över
  // en instruktion). Äldre poster utan type läses som ring. Inget schemabyte —
  // saknas fältet läses det som tomt, precis som D7:s lastMovedPage.
  const [markers, setMarkers] = useState(() => initialViewState?.markers ?? {});
  const [markerMode, setMarkerMode] = useState(false);
  // Live-förhandsvisning av stapeln medan man sveper (M2); {x,y,w} eller null.
  const [markerDraft, setMarkerDraft] = useState(null);
  // Fler bandverktyg (D2/D3): opt-in-åtgärder i en liten sheet så att
  // verktygsraden håller sig till en rad på en smal telefon.
  const [toolsOpen, setToolsOpen] = useState(false);
  // Inpassningsläget (D6): verktygsraden byts mot −/+ som stegar tjockleken.
  const [fittingBand, setFittingBand] = useState(false);
  // Sidgalleriet (D7): rutnät med alla sidor för direkthopp.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [renderError, setRenderError] = useState(null);

  // Det aktiva bandet (och index) — bara band 2 om det finns.
  const activeIdx = band2 ? activeBandIndex : 0;
  const activeBand = activeIdx === 1 && band2 ? band2 : band;

  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const lastTapRef = useRef(null);
  const renderTaskRef = useRef(null);
  const scrollRestoredRef = useRef(false);

  // ---------- Rapportera state uppåt ----------
  const reportState = useCallback(
    (next = {}) => {
      if (!onStateChange) return;
      onStateChange({
        page: next.page ?? pageNumRef.current,
        zoom: next.zoom ?? zoomRef.current,
        scrollX: next.scrollX ?? scrollRef.current.x,
        scrollY: next.scrollY ?? scrollRef.current.y,
        band: next.band ?? bandRef.current,
        // band2 kan vara null (borttaget) — skilj "oförändrat" från "null"
        band2: next.band2 !== undefined ? next.band2 : band2Ref.current,
        markers: next.markers ?? markersRef.current,
      });
    },
    [onStateChange]
  );

  // Refs som speglar state så att reportState alltid ser färska värden
  const pageNumRef = useRef(pageNum);
  const zoomRef = useRef(zoom);
  const scrollRef = useRef(scroll);
  const bandRef = useRef(band);
  const band2Ref = useRef(band2);
  const markersRef = useRef(markers);
  const activeIdxRef = useRef(activeIdx);
  const markerModeRef = useRef(markerMode);
  const pageInfoRef = useRef(null);
  pageNumRef.current = pageNum;
  zoomRef.current = zoom;
  scrollRef.current = scroll;
  bandRef.current = band;
  band2Ref.current = band2;
  markersRef.current = markers;
  activeIdxRef.current = activeIdx;
  markerModeRef.current = markerMode;
  pageInfoRef.current = pageInfo;

  // ---------- Viewportstorlek ----------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setViewportSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---------- Ladda aktuell sida ----------
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc
      .getPage(pageNum)
      .then((page) => {
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1 });
        setPageInfo({ page, widthPt: vp.width, heightPt: vp.height });
        // Värm upp grannsidorna så bläddring känns snabb
        if (pageNum + 1 <= doc.numPages) doc.getPage(pageNum + 1).catch(() => {});
        if (pageNum - 1 >= 1) doc.getPage(pageNum - 1).catch(() => {});
      })
      .catch((err) => !cancelled && setRenderError(err));
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum]);

  // Sidans CSS-storlek vid zoom = 1 (fyller viewportens bredd)
  const baseCss = useMemo(() => {
    if (!pageInfo || !viewportSize.w) return null;
    const w = viewportSize.w;
    return { w, h: (w * pageInfo.heightPt) / pageInfo.widthPt };
  }, [pageInfo, viewportSize.w]);
  const baseCssRef = useRef(null);
  baseCssRef.current = baseCss;

  const clampOffsets = useCallback(
    (z, sx, sy) => {
      if (!baseCss) return { x: sx, y: sy };
      const w = baseCss.w * z;
      const h = baseCss.h * z;
      const { w: vw, h: vh } = viewportSize;
      const x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, sx));
      const y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, sy));
      return { x, y };
    },
    [baseCss, viewportSize]
  );

  // Återställ sparad scrollposition första gången sidan fått mått,
  // och håll offsets inom gränserna när storlekar ändras.
  useEffect(() => {
    if (!baseCss) return;
    if (!scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      setScroll(clampOffsets(zoomRef.current, scrollRef.current.x, scrollRef.current.y));
    } else {
      setScroll((s) => clampOffsets(zoomRef.current, s.x, s.y));
    }
  }, [baseCss, viewportSize, clampOffsets]);

  // ---------- Skarp omritning när zoomen stannat ----------
  useEffect(() => {
    const t = setTimeout(() => setSettledZoom(zoom), 300);
    return () => clearTimeout(t);
  }, [zoom]);

  useEffect(() => {
    if (!pageInfo || !baseCss || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let scale = (baseCss.w * settledZoom * dpr) / pageInfo.widthPt;
    const pxW = pageInfo.widthPt * scale;
    const pxH = pageInfo.heightPt * scale;
    const factor = Math.min(
      1,
      Math.sqrt(MAX_CANVAS_PIXELS / (pxW * pxH)),
      MAX_CANVAS_DIM / pxW,
      MAX_CANVAS_DIM / pxH
    );
    scale *= factor;

    const viewport = pageInfo.page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    if (renderTaskRef.current) renderTaskRef.current.cancel();
    const ctx = canvas.getContext('2d');
    const task = pageInfo.page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    task.promise
      .then(() => {
        renderTaskRef.current = null;
        setRenderError(null);
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException') setRenderError(err);
      });

    return () => {
      if (renderTaskRef.current === task) {
        task.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pageInfo, baseCss?.w, settledZoom]);

  // ---------- Sidbläddring ----------
  const goToPage = useCallback(
    (next) => {
      const clamped = clampPage(next, doc);
      if (clamped === pageNumRef.current) return;
      setPageNum(clamped);
      // Sidbyte lämnar inpassnings- och markörläget — man ska aldrig komma
      // tillbaka till ett beväpnat läge man glömt (stickning avbryts jämt).
      setFittingBand(false);
      setMarkerMode(false);
      const resetScroll = clampOffsets(zoomRef.current, 0, 0);
      setScroll(resetScroll);
      reportState({ page: clamped, scrollX: resetScroll.x, scrollY: resetScroll.y });
    },
    [doc, clampOffsets, reportState]
  );

  // ---------- Gester (pan, pinch, svep, dubbeltryck) ----------
  function handlePointerDown(e) {
    const el = viewportRef.current;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* pekaren kan redan vara borta */
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = [...pointersRef.current.values()];

    if (pointers.length === 1) {
      gestureRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startScroll: { ...scrollRef.current },
        totalDx: 0,
        totalDy: 0,
      };
    } else if (pointers.length === 2) {
      const [a, b] = pointers;
      gestureRef.current = {
        type: 'pinch',
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startZoom: zoomRef.current,
        startScroll: { ...scrollRef.current },
        startMid: midpoint(a, b, viewportRef.current),
      };
    }
  }

  function handlePointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.type === 'pan' && pointersRef.current.size === 1) {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      gesture.totalDx = dx;
      gesture.totalDy = dy;

      // Markörläget (M2): ett horisontellt svep målar en markeringsstapel i
      // stället för att panorera; ett vertikalt svep panorerar som vanligt så
      // man kan nå en annan rad när man zoomat in. Axeln låses när fingret
      // passerat tröskeln så gesten inte hoppar mellan lägena.
      if (markerModeRef.current) {
        if (gesture.markerAxis == null && Math.hypot(dx, dy) >= MARKER_TAP_MOVE) {
          gesture.markerAxis = Math.abs(dx) > Math.abs(dy) ? 'bar' : 'pan';
        }
        if (gesture.markerAxis === 'bar') {
          setMarkerDraft(draftBarFrom(gesture.startX, gesture.startY, e.clientX));
          return;
        }
      }

      setScroll(clampOffsets(zoomRef.current, gesture.startScroll.x + dx, gesture.startScroll.y + dy));
    } else if (gesture.type === 'pinch' && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.startDist < 10) return;
      const newZoom = clamp(gesture.startZoom * (dist / gesture.startDist), MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / gesture.startZoom;
      const mid = gesture.startMid;
      const sx = mid.x - (mid.x - gesture.startScroll.x) * ratio;
      const sy = mid.y - (mid.y - gesture.startScroll.y) * ratio;
      setZoom(newZoom);
      setScroll(clampOffsets(newZoom, sx, sy));
    }
  }

  function handlePointerUp(e) {
    pointersRef.current.delete(e.pointerId);
    const gesture = gestureRef.current;

    if (pointersRef.current.size === 0) {
      if (gesture?.type === 'pan') {
        const { totalDx, totalDy } = gesture;
        const moved = Math.hypot(totalDx, totalDy);

        // Markörläget (D3/M2): ett tryck ringar in (eller suddar); ett
        // horisontellt svep lägger en markeringsstapel. Sidbyte via svep och
        // dubbeltryck är avstängda så man aldrig råkar byta sida.
        if (markerModeRef.current) {
          if (gesture.markerAxis === 'bar') {
            // toggleMarkerAt/commitBar rapporterar själva de nya markörerna;
            // en ren (vertikal) panorering sparar i stället scrollpositionen.
            commitBar(gesture.startX, gesture.startY, e.clientX);
            setMarkerDraft(null);
          } else if (moved < MARKER_TAP_MOVE) {
            toggleMarkerAt(e.clientX, e.clientY);
          } else {
            reportState();
          }
          gestureRef.current = null;
          return;
        }

        // Svep byter sida när sidan fyller bredden (ingen horisontell pan möjlig)
        if (
          zoomRef.current <= 1.02 &&
          Math.abs(totalDx) > SWIPE_MIN_DX &&
          Math.abs(totalDx) > Math.abs(totalDy) * 1.5
        ) {
          goToPage(pageNumRef.current + (totalDx < 0 ? 1 : -1));
          gestureRef.current = null;
          return;
        }

        // Dubbeltryck: växla mellan översikt och inzoomat
        if (moved < 12 && e.pointerType !== 'mouse') {
          const nowTs = Date.now();
          const last = lastTapRef.current;
          if (last && nowTs - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40) {
            lastTapRef.current = null;
            toggleZoomAt(e.clientX, e.clientY);
          } else {
            lastTapRef.current = { t: nowTs, x: e.clientX, y: e.clientY };
          }
        }
      }
      gestureRef.current = null;
      reportState();
    } else if (pointersRef.current.size === 1) {
      // Från pinch till pan: starta om pan-gest med kvarvarande finger
      const [remaining] = [...pointersRef.current.values()];
      gestureRef.current = {
        type: 'pan',
        startX: remaining.x,
        startY: remaining.y,
        startScroll: { ...scrollRef.current },
        totalDx: 0,
        totalDy: 0,
      };
    }
  }

  function toggleZoomAt(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const mid = { x: clientX - rect.left, y: clientY - rect.top };
    const current = zoomRef.current;
    const target = current > 1.4 ? 1 : 2.5;
    const ratio = target / current;
    const sx = mid.x - (mid.x - scrollRef.current.x) * ratio;
    const sy = mid.y - (mid.y - scrollRef.current.y) * ratio;
    const clamped = clampOffsets(target, sx, sy);
    setZoom(target);
    setScroll(clamped);
    reportState({ zoom: target, scrollX: clamped.x, scrollY: clamped.y });
  }

  function handleDoubleClick(e) {
    if (markerModeRef.current) return; // markörläget äger trycket
    toggleZoomAt(e.clientX, e.clientY);
  }

  // Wheel kopplas manuellt med { passive: false } — React registrerar wheel
  // passivt, vilket gör preventDefault verkningslöst (webbläsaren skulle
  // annars zooma hela sidan vid ctrl+scroll).
  const handleWheelRef = useRef(null);
  handleWheelRef.current = handleWheel;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const listener = (e) => handleWheelRef.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, []);

  function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = viewportRef.current.getBoundingClientRect();
      const mid = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const newZoom = clamp(zoomRef.current * (e.deltaY < 0 ? 1.1 : 0.9), MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / zoomRef.current;
      const sx = mid.x - (mid.x - scrollRef.current.x) * ratio;
      const sy = mid.y - (mid.y - scrollRef.current.y) * ratio;
      const clamped = clampOffsets(newZoom, sx, sy);
      setZoom(newZoom);
      setScroll(clamped);
      reportState({ zoom: newZoom, scrollX: clamped.x, scrollY: clamped.y });
    } else {
      const clamped = clampOffsets(zoomRef.current, scrollRef.current.x - e.deltaX, scrollRef.current.y - e.deltaY);
      setScroll(clamped);
      reportState({ scrollX: clamped.x, scrollY: clamped.y });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(pageNumRef.current + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(pageNumRef.current - 1);
  }

  // ---------- Banden (D2: ett eller två) ----------
  // Tjockleken per band: egen override (pt) eller Inställningars standard.
  const bandThicknessOf = (b) => b.thicknessPt ?? bandThickness;

  // Sätter ett band vid index 0/1 och rapporterar rätt fält uppåt.
  function setBandAt(index, next) {
    if (index === 1) {
      setBand2(next);
      reportState({ band2: next });
    } else {
      setBand(next);
      reportState({ band: next });
    }
  }

  function updateBandAt(index, changes) {
    const current = index === 1 ? band2Ref.current : bandRef.current;
    if (!current) return;
    setBandAt(index, { ...current, ...changes });
  }

  function handleBandDragEnd(index, orientation, position) {
    const current = index === 1 ? band2Ref.current : bandRef.current;
    if (!current) return;
    const key = orientation === 'horisontell' ? 'positionByPage' : 'positionByPageV';
    setBandAt(index, {
      ...current,
      [key]: { ...current[key], [pageNumRef.current]: position },
      // "Här är du" i sidgalleriet (D7): bandets senaste flytt är ditt varv
      lastMovedPage: pageNumRef.current,
    });
  }

  function addSecondBand() {
    if (band2Ref.current) return;
    const next = makeSecondBand();
    setBand2(next);
    setActiveBandIndex(1); // hoppa direkt till det nya bandet man ska placera
    reportState({ band2: next });
  }

  function removeSecondBand() {
    setBand2(null);
    setActiveBandIndex(0);
    setFittingBand(false);
    reportState({ band2: null });
  }

  function cycleActiveBand() {
    setActiveBandIndex((i) => (i === 0 ? 1 : 0));
  }

  // D6: −/+ i inpassningsläget stegar det aktiva bandets tjocklek
  // kantförankrat (bandFit.js) och sparar den som bandets override. Vid
  // 'båda' stegas tjockleken en gång men positionerna räknas om var för
  // sig så att bägge kanterna behåller sin förankring.
  function stepBandThickness(deltaPt) {
    if (!pageInfo) return;
    const index = activeIdxRef.current;
    const current = index === 1 ? band2Ref.current : bandRef.current;
    if (!current) return;
    const page = pageNumRef.current;
    const parts = current.orientation === 'båda' ? ['horisontell', 'vertikal'] : [current.orientation];
    let thicknessPt = null;
    const nextBand = { ...current };
    for (const orientation of parts) {
      const horizontal = orientation === 'horisontell';
      const key = horizontal ? 'positionByPage' : 'positionByPageV';
      const next = stepBandFit({
        position: current[key][page] ?? DEFAULT_BAND_POSITION,
        thicknessPt: bandThicknessOf(current),
        deltaPt,
        spanPt: horizontal ? pageInfo.heightPt : pageInfo.widthPt,
      });
      if (!next) return;
      thicknessPt = next.thicknessPt;
      nextBand[key] = { ...current[key], [page]: next.position };
    }
    nextBand.lastMovedPage = page; // inpassning räknas också som "bandet är här"
    nextBand.thicknessPt = thicknessPt;
    if (navigator.vibrate) navigator.vibrate(8);
    setBandAt(index, nextBand);
  }

  // ---------- Markörer (D3/M1/M2) ----------
  // Allt lagras som andel (0–1) i dokumentkoordinater precis som bandet, så
  // markören sitter kvar på samma siffra/rad vid zoom och sidbyte.

  // Klient- → dokumentkoordinater. Delad av ring (tryck) och stapel (svep).
  function clientToDocFrac(clientX, clientY) {
    const base = baseCssRef.current;
    if (!base) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    const pageW = base.w * zoomRef.current;
    const pageH = base.h * zoomRef.current;
    return {
      fx: clamp01((clientX - rect.left - scrollRef.current.x) / pageW),
      fy: clamp01((clientY - rect.top - scrollRef.current.y) / pageH),
    };
  }

  // Träffprövning i punkter (zoomoberoende) för sudda-på-tryck. Ringen är en
  // cirkel kring (x,y); stapeln en rektangel (bredd w, höjd MARKER_BAR_PT).
  function markerHit(m, fx, fy, info) {
    if (m.type === 'bar') {
      const dxFrac = Math.abs(m.x - fx);
      const dyPt = Math.abs(m.y - fy) * info.heightPt;
      return dxFrac <= m.w / 2 && dyPt <= (MARKER_BAR_PT / 2) * 1.2;
    }
    const rPt = MARKER_PT / 2;
    const dxPt = (m.x - fx) * info.widthPt;
    const dyPt = (m.y - fy) * info.heightPt;
    return Math.hypot(dxPt, dyPt) <= rPt * 1.2;
  }

  function saveMarkers(page, nextList) {
    const nextMarkers = { ...markersRef.current };
    if (nextList.length) nextMarkers[page] = nextList;
    else delete nextMarkers[page];
    setMarkers(nextMarkers);
    reportState({ markers: nextMarkers });
  }

  // Ett tryck ringar in punkten; ett tryck på en befintlig markör (ring
  // eller stapel) suddar den.
  function toggleMarkerAt(clientX, clientY) {
    const info = pageInfoRef.current;
    const frac = clientToDocFrac(clientX, clientY);
    if (!info || !frac) return;
    const page = pageNumRef.current;
    const list = markersRef.current[page] || [];
    const hit = list.findIndex((m) => markerHit(m, frac.fx, frac.fy, info));
    const nextList =
      hit >= 0 ? list.filter((_, i) => i !== hit) : [...list, { type: 'ring', x: frac.fx, y: frac.fy }];
    if (navigator.vibrate) navigator.vibrate(hit >= 0 ? 4 : 8);
    saveMarkers(page, nextList);
  }

  // Räkna fram en stapel (mitt-x, y, bredd) från svepets start- och slut-x.
  // y tas från startpunkten så stapeln ligger vågrätt på raden man svepte.
  function draftBarFrom(startClientX, startClientY, endClientX) {
    const a = clientToDocFrac(startClientX, startClientY);
    const b = clientToDocFrac(endClientX, startClientY);
    if (!a || !b) return null;
    const x1 = Math.min(a.fx, b.fx);
    const x2 = Math.max(a.fx, b.fx);
    return { x: (x1 + x2) / 2, y: a.fy, w: x2 - x1 };
  }

  // Lägg stapeln på plats vid släpp; för korta svep ignoreras (var nog ett
  // tryck som gled). Rapporterar de nya markörerna.
  function commitBar(startClientX, startClientY, endClientX) {
    const bar = draftBarFrom(startClientX, startClientY, endClientX);
    if (!bar || bar.w < MARKER_BAR_MIN_W) return;
    const page = pageNumRef.current;
    const list = markersRef.current[page] || [];
    if (navigator.vibrate) navigator.vibrate(8);
    saveMarkers(page, [...list, { type: 'bar', ...bar }]);
  }

  // ---------- Render ----------
  const numPages = doc?.numPages ?? 0;
  const pageCssW = baseCss ? baseCss.w * zoom : 0;
  const pageCssH = baseCss ? baseCss.h * zoom : 0;
  const cssPerPt = pageInfo && pageCssW ? pageCssW / pageInfo.widthPt : 1;

  const bandList = band2 ? [band, band2] : [band];
  const pageMarkers = markers[pageNum] || [];
  const markerDiaCss = MARKER_PT * cssPerPt;
  const markerBarHCss = MARKER_BAR_PT * cssPerPt;

  return (
    <div className="pdf-container">
      <div
        className="pdf-viewport"
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={`Mönster, sida ${pageNum} av ${numPages}`}
      >
        {baseCss && (
          <div
            className="pdf-page"
            style={{
              width: `${pageCssW}px`,
              height: `${pageCssH}px`,
              transform: `translate(${scroll.x}px, ${scroll.y}px)`,
            }}
          >
            <canvas ref={canvasRef} className="pdf-canvas" />
            {bandList.map((b, i) => {
              const thicknessCss = bandThicknessOf(b) * cssPerPt;
              const fitting = fittingBand && i === activeIdx;
              return (
                <BandGroup
                  key={i}
                  band={b}
                  page={pageNum}
                  thicknessCss={thicknessCss}
                  opacity={bandOpacity}
                  pageCssWidth={pageCssW}
                  pageCssHeight={pageCssH}
                  fitting={fitting}
                  onDragEnd={(orientation, pos) => handleBandDragEnd(i, orientation, pos)}
                />
              );
            })}
            {pageMarkers.map((m, i) =>
              m.type === 'bar' ? (
                <div
                  key={i}
                  className={`marker marker-bar ${markerMode ? 'marker-editable' : ''}`}
                  style={{
                    left: `${(m.x - m.w / 2) * pageCssW}px`,
                    top: `${m.y * pageCssH - markerBarHCss / 2}px`,
                    width: `${m.w * pageCssW}px`,
                    height: `${markerBarHCss}px`,
                  }}
                  aria-hidden="true"
                />
              ) : (
                <div
                  key={i}
                  className={`marker marker-ring ${markerMode ? 'marker-editable' : ''}`}
                  style={{
                    left: `${m.x * pageCssW - markerDiaCss / 2}px`,
                    top: `${m.y * pageCssH - markerDiaCss / 2}px`,
                    width: `${markerDiaCss}px`,
                    height: `${markerDiaCss}px`,
                  }}
                  aria-hidden="true"
                />
              )
            )}
            {markerDraft && markerDraft.w > 0 && (
              <div
                className="marker marker-bar marker-draft"
                style={{
                  left: `${(markerDraft.x - markerDraft.w / 2) * pageCssW}px`,
                  top: `${markerDraft.y * pageCssH - markerBarHCss / 2}px`,
                  width: `${markerDraft.w * pageCssW}px`,
                  height: `${markerBarHCss}px`,
                }}
                aria-hidden="true"
              />
            )}
          </div>
        )}
        {!baseCss && !renderError && <div className="pdf-status">Laddar mönster …</div>}
        {renderError && (
          <div className="pdf-status pdf-error">Kunde inte visa sidan. Prova att öppna mönstret igen.</div>
        )}
      </div>

      <div className="pdf-toolbar">
        {fittingBand ? (
          <>
            <HoldStepButton
              ariaLabel="Minska bandets tjocklek"
              onStep={(steps) => stepBandThickness(-BAND_STEP_PT * steps)}
            >
              −
            </HoldStepButton>
            <span className="band-fit-label">
              {band2 ? `Band ${activeIdx + 1} – tjocklek` : 'Bandets tjocklek'}
            </span>
            <HoldStepButton
              ariaLabel="Öka bandets tjocklek"
              onStep={(steps) => stepBandThickness(BAND_STEP_PT * steps)}
            >
              +
            </HoldStepButton>
            <span className="pdf-toolbar-spacer" />
            <button className="band-fit-done" onClick={() => setFittingBand(false)}>
              Klar
            </button>
          </>
        ) : markerMode ? (
          <>
            <span className="band-fit-label">Tryck ringar in, svep markerar en rad – tryck igen för att sudda</span>
            <span className="pdf-toolbar-spacer" />
            <button className="band-fit-done" onClick={() => setMarkerMode(false)}>
              Klar
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-icon"
              onClick={() => goToPage(pageNum - 1)}
              disabled={pageNum <= 1}
              aria-label="Föregående sida"
            >
              ‹
            </button>
            <button
              className="pdf-pageinfo pdf-pageinfo-btn"
              onClick={() => setGalleryOpen(true)}
              disabled={numPages < 2}
              aria-label={`Sida ${pageNum} av ${numPages || 1} – visa alla sidor`}
              title="Visa alla sidor"
            >
              {pageNum} / {numPages || '–'}
            </button>
            <button
              className="btn-icon"
              onClick={() => goToPage(pageNum + 1)}
              disabled={pageNum >= numPages}
              aria-label="Nästa sida"
            >
              ›
            </button>
            {showBandControls && (
              <>
                <span className="pdf-toolbar-spacer" />
                {band2 && (
                  <button
                    className="btn-icon band-select"
                    onClick={cycleActiveBand}
                    aria-label={`Aktivt band ${activeIdx + 1} av 2 – växla`}
                    title="Välj vilket band knapparna styr"
                  >
                    <span
                      className="band-select-dot"
                      style={{ background: `rgb(${activeBand.color})` }}
                    />
                    {activeIdx + 1}
                  </button>
                )}
                <button
                  className={`btn-icon ${activeBand.visible ? 'btn-icon-active' : ''}`}
                  onClick={() => updateBandAt(activeIdx, { visible: !activeBand.visible })}
                  aria-label={activeBand.visible ? 'Dölj bandet' : 'Visa bandet'}
                  title={activeBand.visible ? 'Dölj bandet' : 'Visa bandet'}
                >
                  <BandIcon color={activeBand.color} />
                </button>
                {activeBand.visible && (
                  <>
                    <button
                      className="btn-icon"
                      onClick={() =>
                        updateBandAt(activeIdx, {
                          orientation: cycleOrientation(activeBand.orientation),
                        })
                      }
                      aria-label="Växla bandets riktning"
                      title="Bandets riktning: horisontell, vertikal eller båda"
                    >
                      {activeBand.orientation === 'horisontell' ? (
                        '↕'
                      ) : activeBand.orientation === 'vertikal' ? (
                        '↔'
                      ) : (
                        <BandBothIcon />
                      )}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => setFittingBand(true)}
                      aria-label="Passa in bandet"
                      title="Passa in bandets tjocklek mot en diagramrad"
                    >
                      <BandFitIcon />
                    </button>
                  </>
                )}
                <button
                  className="btn-icon"
                  onClick={() => setToolsOpen(true)}
                  aria-label="Fler bandverktyg"
                  title="Andra band och markör"
                >
                  <MoreIcon />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {toolsOpen && (
        <Modal title="Bandverktyg" onClose={() => setToolsOpen(false)}>
          <div className="menu-list">
            {band2 ? (
              <button
                className="menu-item"
                onClick={() => {
                  setToolsOpen(false);
                  removeSecondBand();
                }}
              >
                Ta bort andra bandet
                <span className="menu-item-meta">Behåll bara ett band</span>
              </button>
            ) : (
              <button
                className="menu-item"
                onClick={() => {
                  setToolsOpen(false);
                  addSecondBand();
                }}
              >
                Lägg till ett andra band
                <span className="menu-item-meta">
                  Följ t.ex. både diagramraden och den skrivna instruktionen
                </span>
              </button>
            )}
            <button
              className="menu-item"
              onClick={() => {
                setToolsOpen(false);
                setMarkerMode(true);
              }}
            >
              Markera
              <span className="menu-item-meta">
                Ringa in en siffra (t.ex. din storlek i ”56 (60, 64, 68)”) eller svep
                över en instruktion du vill hålla koll på – tryck igen för att sudda
              </span>
            </button>
          </div>
        </Modal>
      )}

      {galleryOpen && doc && (
        <PageGallery
          doc={doc}
          currentPage={pageNum}
          bandPage={band.lastMovedPage ?? null}
          onPick={(page) => {
            setGalleryOpen(false);
            goToPage(page);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}

/*
 * Ett band på sidan: horisontellt, vertikalt eller båda (kors). Samlar
 * de en–två BandOverlay som ett band består av så att PdfViewer kan mappa
 * över en lista av band utan att duplicera villkoren (D2).
 */
function BandGroup({ band, page, thicknessCss, opacity, pageCssWidth, pageCssHeight, fitting, onDragEnd }) {
  if (!band.visible) return null;
  const showH = band.orientation !== 'vertikal';
  const showV = band.orientation !== 'horisontell';
  const posH = band.positionByPage[page] ?? DEFAULT_BAND_POSITION;
  const posV = band.positionByPageV[page] ?? DEFAULT_BAND_POSITION;
  return (
    <>
      {showH && (
        <BandOverlay
          orientation="horisontell"
          position={posH}
          thicknessCss={thicknessCss}
          opacity={opacity}
          color={band.color}
          pageCssWidth={pageCssWidth}
          pageCssHeight={pageCssHeight}
          fitting={fitting}
          onDragEnd={(pos) => onDragEnd('horisontell', pos)}
        />
      )}
      {showV && (
        <BandOverlay
          orientation="vertikal"
          position={posV}
          thicknessCss={thicknessCss}
          opacity={opacity}
          color={band.color}
          pageCssWidth={pageCssWidth}
          pageCssHeight={pageCssHeight}
          fitting={fitting}
          onDragEnd={(pos) => onDragEnd('vertikal', pos)}
        />
      )}
    </>
  );
}

function BandIcon({ color = '244, 194, 219' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="8" width="16" height="5" rx="2" fill={`rgba(${color}, 0.9)`} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/*
 * Fler bandverktyg (D2/D3): ett litet band med en ring intill — antyder
 * "andra band + storleksmarkör" utan att krocka med topbarens ⋯-meny.
 */
function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="10" height="4" rx="1.5" fill="rgba(160,205,175,0.9)" stroke="currentColor" strokeWidth="1" />
      <circle cx="14.5" cy="13" r="3.5" stroke="#e08a2e" strokeWidth="1.8" />
    </svg>
  );
}

/** Fyrvägspil: horisontellt och vertikalt band samtidigt. */
function BandBothIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5v15M7.9 4.6 10 2.5l2.1 2.1M7.9 15.4 10 17.5l2.1-2.1M2.5 10h15M4.6 7.9 2.5 10l2.1 2.1M15.4 7.9 17.5 10l-2.1 2.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Band med pilar utåt: passa in tjockleken mot en diagramrad. */
function BandFitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="7.5" width="16" height="5" rx="2" fill="rgba(244,194,219,0.9)" stroke="currentColor" strokeWidth="1" />
      <path d="M10 5V1.5M8.4 3.1 10 1.5l1.6 1.6M10 15v3.5M8.4 16.9 10 18.5l1.6-1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/*
 * Stegknapp med håll-för-repetition: ett steg direkt vid tryck, sedan
 * repetition efter en kort fördröjning, och större kliv efter ~1,5 s så
 * att långa resor (24 → 90 pt) inte kräver trettio tryck. Tangentbord
 * ger alltid ett steg i taget (klick med detail 0).
 */
function HoldStepButton({ ariaLabel, onStep, children }) {
  const holdRef = useRef(null);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  function stop() {
    const hold = holdRef.current;
    if (!hold) return;
    clearTimeout(hold.timeout);
    clearInterval(hold.interval);
    holdRef.current = null;
  }

  useEffect(() => stop, []);

  function start(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pekaren kan redan vara borta */
    }
    stop();
    stepRef.current(1);
    const hold = { count: 0, interval: null };
    hold.timeout = setTimeout(() => {
      hold.interval = setInterval(() => {
        hold.count += 1;
        stepRef.current(hold.count > 12 ? 3 : 1);
      }, 110);
    }, 400);
    holdRef.current = hold;
  }

  return (
    <button
      className="btn-icon band-fit-step"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onClick={(e) => {
        // detail 0 = tangentbordsklick (Enter/mellanslag) — pekare hanteras ovan
        if (e.detail === 0) stepRef.current(1);
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function clampPage(page, doc) {
  const max = doc?.numPages ?? 1;
  return Math.min(Math.max(1, page || 1), max);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function midpoint(a, b, el) {
  const rect = el.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
}
