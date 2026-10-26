"use client";

import { useEffect, useRef, useState } from "react";
import type { Viewer } from "@photo-sphere-viewer/core";
import type { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import { Spinner } from "@/components/ui";

export type PanoMarker = {
  id: string | number;
  label: string;
  yaw: number; // derajat
  pitch: number; // derajat
  targetId: number;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const toDeg = (rad: number) => (rad * 180) / Math.PI;

export default function PanoramaViewer({
  src,
  markers = [],
  onMarkerClick,
  onPick,
  className = "h-[60vh]",
}: {
  src: string;
  markers?: PanoMarker[];
  onMarkerClick?: (targetId: number) => void;
  onPick?: (yaw: number, pitch: number) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const pluginRef = useRef<MarkersPlugin | null>(null);
  const readyRef = useRef(false);
  const srcRef = useRef(src);
  const markersRef = useRef(markers);
  const cbRef = useRef({ onMarkerClick, onPick });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cbRef.current = { onMarkerClick, onPick };
    markersRef.current = markers;
  });

  const applyMarkers = () => {
    const plugin = pluginRef.current;
    if (!plugin || !readyRef.current) return;
    plugin.setMarkers(
      markersRef.current.map((m) => ({
        id: `m-${m.id}`,
        position: { yaw: `${m.yaw}deg`, pitch: `${m.pitch}deg` },
        html: `<div class="psv-hotspot"><span class="dot">➜</span>${esc(m.label)}</div>`,
        anchor: "center center",
        size: { width: 10, height: 10 },
        data: { targetId: m.targetId },
      })),
    );
  };

  // Inisialisasi viewer
  useEffect(() => {
    let disposed = false;
    let viewer: Viewer | undefined;
    (async () => {
      const [{ Viewer }, { MarkersPlugin }] = await Promise.all([
        import("@photo-sphere-viewer/core"),
        import("@photo-sphere-viewer/markers-plugin"),
      ]);
      if (disposed || !el.current) return;
      viewer = new Viewer({
        container: el.current,
        panorama: srcRef.current,
        plugins: [[MarkersPlugin, {}]],
        navbar: ["zoom", "move", "fullscreen"],
        loadingTxt: "Memuat panorama…",
        defaultZoomLvl: 20,
        mousewheelCtrlKey: false,
        touchmoveTwoFingers: false,
        lang: {
          zoom: "Zoom",
          zoomOut: "Perkecil",
          zoomIn: "Perbesar",
          moveUp: "Geser ke atas",
          moveDown: "Geser ke bawah",
          moveLeft: "Geser ke kiri",
          moveRight: "Geser ke kanan",
          download: "Unduh",
          fullscreen: "Layar penuh",
          menu: "Menu",
          twoFingers: "Gunakan dua jari untuk menggeser",
          ctrlZoom: "Gunakan ctrl + scroll untuk zoom",
          loadError: "Panorama tidak dapat dimuat",
        },
      });
      const plugin = viewer.getPlugin(MarkersPlugin) as MarkersPlugin;
      viewerRef.current = viewer;
      pluginRef.current = plugin;
      viewer.addEventListener(
        "ready",
        () => {
          readyRef.current = true;
          setLoading(false);
          applyMarkers();
        },
        { once: true },
      );
      plugin.addEventListener("select-marker", ({ marker }) => {
        const id = (marker.data as { targetId?: number } | undefined)?.targetId;
        if (id) cbRef.current.onMarkerClick?.(id);
      });
      viewer.addEventListener("click", ({ data }) => {
        if (data.rightclick) return;
        cbRef.current.onPick?.(
          Math.round(toDeg(data.yaw) * 10) / 10,
          Math.round(toDeg(data.pitch) * 10) / 10,
        );
      });
    })().catch(() => setFailed(true));
    return () => {
      disposed = true;
      readyRef.current = false;
      viewer?.destroy();
      viewerRef.current = null;
      pluginRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ganti panorama
  useEffect(() => {
    if (srcRef.current === src) return;
    srcRef.current = src;
    const viewer = viewerRef.current;
    if (!viewer || !readyRef.current) return;
    pluginRef.current?.clearMarkers();
    setLoading(true);
    viewer
      .setPanorama(src, { transition: true, showLoader: false })
      .then(() => setFailed(false))
      .catch(() => setFailed(true))
      .finally(() => {
        setLoading(false);
        applyMarkers();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Perbarui hotspot
  useEffect(() => {
    applyMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-forest-950 ${className}`}>
      <div ref={el} className="absolute inset-0" />
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-forest-950/60 text-white">
          <div className="flex items-center gap-2 text-sm">
            <Spinner className="size-5" /> Memuat panorama…
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-forest-950 p-6 text-center text-sm text-white/80">
          Panorama tidak dapat dimuat. Periksa URL gambar atau coba lagi.
        </div>
      )}
    </div>
  );
}
