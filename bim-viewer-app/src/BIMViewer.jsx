import { useEffect, useRef, useState } from 'react';
import { Viewer } from '@xeokit/xeokit-sdk/src/viewer/Viewer';
import { XKTLoaderPlugin } from '@xeokit/xeokit-sdk/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin';
import { WebIFCLoaderPlugin } from '@xeokit/xeokit-sdk/src/plugins/WebIFCLoaderPlugin/WebIFCLoaderPlugin';
import { TreeViewPlugin } from '@xeokit/xeokit-sdk/src/plugins/TreeViewPlugin/TreeViewPlugin';
import { NavCubePlugin } from '@xeokit/xeokit-sdk/src/plugins/NavCubePlugin/NavCubePlugin';
import { SectionPlanesPlugin } from '@xeokit/xeokit-sdk/src/plugins/SectionPlanesPlugin/SectionPlanesPlugin';
import * as WebIFC from 'web-ifc';
import { Loader2, Eye, EyeOff, Scissors, Trash2, Plus, Box, Camera, X, Download, Clock, ChevronRight, Maximize, Minimize } from 'lucide-react';

const BIMViewer = ({ file, onDelete, onAdd }) => {
  const canvasRef = useRef(null);
  const treeContainerRef = useRef(null);
  const navCubeCanvasRef = useRef(null);
  
  const viewerRef = useRef(null);
  const loadersRef = useRef({});
  const sectionPlanesRef = useRef(null);
  const currentModelRef = useRef(null);
  const currentPlaneRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isXRay, setIsXRay] = useState(false);
  const [isClipping, setIsClipping] = useState(false);

  // Cloud Render & Timer State
  const [isRendering, setIsRendering] = useState(false);
  const [renderResult, setRenderResult] = useState(null);
  const [showRenderMenu, setShowRenderMenu] = useState(false);
  const [renderTime, setRenderTime] = useState(null);
  
  // Track if the render modal is fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const viewer = new Viewer({
      canvasElement: canvasRef.current,
      transparent: true,
      antialias: true,
    });

    viewer.camera.eye = [-3.93, 2.85, 27.01];
    viewer.camera.look = [4.4, 3.72, 8.89];
    viewer.camera.up = [-0.01, 0.99, 0.039];

    new TreeViewPlugin(viewer, {
      containerElement: treeContainerRef.current,
      autoExpandDepth: 2, 
      hierarchy: "containment" 
    });

    new NavCubePlugin(viewer, {
      canvasElement: navCubeCanvasRef.current,
      color: "#f8fafc",
      hoverColor: "#6366f1" 
    });

    sectionPlanesRef.current = new SectionPlanesPlugin(viewer);
    loadersRef.current.xkt = new XKTLoaderPlugin(viewer);
    
    const initializeIFCEngine = async () => {
      try {
        const ifcAPI = new WebIFC.IfcAPI();
        ifcAPI.SetWasmPath("/");
        await ifcAPI.Init(); 

        loadersRef.current.ifc = new WebIFCLoaderPlugin(viewer, {
          WebIFC: WebIFC,
          IfcAPI: ifcAPI 
        });
      } catch (error) {
        console.error("Failed to boot IFC Engine.", error);
      }
    };

    initializeIFCEngine();
    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (!file) {
      if (currentModelRef.current) {
        currentModelRef.current.destroy();
        currentModelRef.current = null;
      }
      if (isXRay) toggleXRay();
      if (isClipping) toggleClipping();
      return;
    }

    setIsLoading(true);
    if (isXRay) toggleXRay();
    if (isClipping) toggleClipping();

    if (currentModelRef.current) {
      currentModelRef.current.destroy();
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();
    let retries = 0;

    const loadModel = (buffer) => {
      if (fileExtension === 'ifc' && loadersRef.current.ifc) {
        currentModelRef.current = loadersRef.current.ifc.load({
          id: "uploadedIFC_" + Date.now(),
          ifc: buffer, 
          edges: true,
        });
      } else if (fileExtension === 'xkt' && loadersRef.current.xkt) {
        currentModelRef.current = loadersRef.current.xkt.load({
          id: "uploadedXKT_" + Date.now(),
          xkt: buffer, 
          edges: true,
        });
      } else if (retries < 50) {
        retries++;
        setTimeout(() => loadModel(buffer), 100);
        return; 
      } else {
        setIsLoading(false);
        return;
      }

      currentModelRef.current.on("loaded", () => {
        viewerRef.current.cameraFlight.flyTo(currentModelRef.current);
        setIsLoading(false); 
      });
    };

    const reader = new FileReader();
    reader.onload = (e) => loadModel(e.target.result); 
    reader.readAsArrayBuffer(file);

  }, [file]);

  const toggleXRay = () => {
    if (!viewerRef.current) return;
    const scene = viewerRef.current.scene;
    const nextState = !isXRay;
    scene.setObjectsXRayed(scene.objectIds, nextState);
    setIsXRay(nextState);
  };

  const toggleClipping = () => {
    if (!viewerRef.current || !sectionPlanesRef.current) return;
    const nextState = !isClipping;

    if (nextState) {
      const aabb = viewerRef.current.scene.getAABB();
      const center = [(aabb[0] + aabb[3])/2, (aabb[1] + aabb[4])/2, (aabb[2] + aabb[5])/2];
      currentPlaneRef.current = sectionPlanesRef.current.createSectionPlane({
        id: "activeSlice", pos: center, dir: [0, -1, 0] 
      });
      sectionPlanesRef.current.showControl("activeSlice");
    } else {
      if (currentPlaneRef.current) {
        currentPlaneRef.current.destroy();
        currentPlaneRef.current = null;
      }
    }
    setIsClipping(nextState);
  };

  const triggerCloudRender = async (angle = '360') => {
    if (!file) return;
    
    setIsRendering(true);
    setShowRenderMenu(false);
    setRenderTime(null);
    
    const startTime = Date.now(); 
    
    try {
      const formData = new FormData();
      formData.append('ifcFile', file);
      formData.append('angle', angle);

      const response = await fetch('http://localhost:3000/api/render', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Render failed');

      const data = await response.json(); 
      data.url = `${data.url}?t=${Date.now()}`;
      setRenderResult(data); 

    } catch (error) {
      console.error("Cloud Rendering Error:", error);
      alert("Render failed. Make sure your dynamic backend is running!");
    } finally {
      const endTime = Date.now();
      setRenderTime(((endTime - startTime) / 1000).toFixed(1));
      setIsRendering(false);
    }
  };

  return (
    <div className="flex w-full h-full pt-16 pb-12 bg-slate-100 dark:bg-[#0f1117] transition-colors duration-300 relative">
      
      {/* Sidebar Explorer */}
      <div className={`w-80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 overflow-y-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] flex-col hidden md:flex transition-all duration-500 ${file ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
        <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <Box className="w-4 h-4 text-indigo-500" />
            Model Explorer
          </h3>
        </div>
        <div ref={treeContainerRef} className="p-4 flex-1 text-sm text-slate-700 dark:text-slate-300" />
      </div>

      {/* 3D Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        
        {/* Empty State UI */}
        {!file && !isLoading && !isRendering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gradient-to-b from-transparent to-slate-200/50 dark:to-slate-900/50 animate-in fade-in duration-700">
            <div className="w-24 h-24 mb-6 rounded-3xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_60px_rgba(99,102,241,0.15)] relative group">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full group-hover:bg-indigo-500/30 transition-all duration-500"></div>
              <Box className="w-10 h-10 text-indigo-500 relative z-10" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">Workspace Empty</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm text-center mb-8">
              Upload an IFC or XKT model to begin analyzing geometry and spatial hierarchies.
            </p>
            <button 
              onClick={onAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-full font-semibold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transition-all transform hover:-translate-y-1 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add 3D Model
            </button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }} className={!file ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'} />
        
        <canvas id="myNavCubeCanvas" ref={navCubeCanvasRef} className={!file ? 'hidden' : 'block'} />
        
        {/* Professional Right-Aligned Vertical CAD Toolbar */}
        {file && (
          <div className="absolute top-1/2 right-6 -translate-y-1/2 flex flex-col items-center gap-3 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/60 shadow-2xl z-20 animate-in slide-in-from-right-8 duration-500">
            
            <button onClick={onAdd} title="Add New Model" className="p-3 rounded-xl text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm">
              <Plus className="w-5 h-5" />
            </button>

            <div className="h-px w-8 bg-slate-300 dark:bg-slate-700 my-1"></div>

            <button onClick={toggleXRay} title="Toggle X-Ray" className={`p-3 rounded-xl transition-all shadow-sm ${isXRay ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>
              {isXRay ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>

            <button onClick={toggleClipping} title="Section Slicer" className={`p-3 rounded-xl transition-all shadow-sm ${isClipping ? 'bg-cyan-500 text-white shadow-cyan-500/30' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>
              <Scissors className="w-5 h-5" />
            </button>

            <div className="relative flex items-center">
              {showRenderMenu && (
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 flex flex-col gap-2 bg-slate-900/95 backdrop-blur-xl p-3 rounded-2xl border border-slate-700/50 shadow-2xl animate-in fade-in slide-in-from-right-4 min-w-[180px]">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-2">Cloud Render</h4>
                  <button onClick={() => triggerCloudRender('360')} className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
                    Interactive 360° <ChevronRight className="w-4 h-4 opacity-50"/>
                  </button>
                  <button onClick={() => triggerCloudRender('top-front-right')} className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                    High-Res Image <ChevronRight className="w-4 h-4 opacity-50"/>
                  </button>
                </div>
              )}
              <button onClick={() => setShowRenderMenu(!showRenderMenu)} title="Generate HQ Cloud Render" className="p-3 rounded-xl text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all shadow-sm">
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="h-px w-8 bg-slate-300 dark:bg-slate-700 my-1"></div>

            <button onClick={onDelete} title="Delete Model" className="p-3 rounded-xl text-slate-600 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all shadow-sm">
              <Trash2 className="w-5 h-5" />
            </button>
            
          </div>
        )}

        {/* Loading Overlays */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative flex flex-col items-center">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full"></div>
              <div className="bg-white/10 dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-2xl flex flex-col items-center gap-5 relative z-10">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <p className="text-white font-medium tracking-wide">Processing Geometry...</p>
              </div>
            </div>
          </div>
        )}

        {isRendering && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 p-8 rounded-3xl border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col items-center gap-5 text-center relative z-10">
              <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
              <div>
                <h3 className="text-white font-bold text-lg">Autodesk Cloud Rendering</h3>
                <p className="text-amber-400/80 text-sm mt-1">Processing via 3ds Max Design Automation...</p>
              </div>
            </div>
          </div>
        )}

        {/* === UPDATED: True Fullscreen Render Modal === */}
        {renderResult && (
          // THE FIX: Changes from 'absolute' to 'fixed' when isFullscreen is true!
          <div className={`${isFullscreen ? 'fixed p-0' : 'absolute p-4 sm:p-8'} inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in zoom-in duration-300`}>
            
            <div className={`relative bg-[#0a0a0a] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.6)] flex flex-col transition-all duration-300 ${
              isFullscreen 
                ? 'w-full h-full rounded-none border-none' 
                : 'max-w-7xl w-full h-[90vh] rounded-3xl border border-slate-800'
            }`}>
              
              {/* Premium Header Window */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg leading-tight">Autodesk APS Output</h3>
                    <div className="flex items-center gap-2 text-slate-400 text-sm mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Processed in <strong className="text-emerald-400 font-mono">{renderTime}s</strong></span>
                      <span className="text-slate-600 px-1">•</span>
                      <span className="uppercase text-xs tracking-wider">{renderResult.type} Mode</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 z-10">
                  {renderResult.type === 'image' && (
                    <a href={renderResult.url} target="_blank" rel="noreferrer" download={`cloud-render-${Date.now()}.png`} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 font-medium text-sm">
                      <Download className="w-4 h-4" /> Download
                    </a>
                  )}
                  
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  
                  {/* Fullscreen Toggle Button */}
                  <button 
                    onClick={() => setIsFullscreen(!isFullscreen)} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors" 
                    title={isFullscreen ? "Restore View" : "Maximize View"}
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>

                  <button 
                    onClick={() => {
                      setRenderResult(null);
                      setIsFullscreen(false); 
                    }} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-rose-500/20 rounded-xl transition-colors" 
                    title="Close"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Viewer Area */}
              <div className="flex-1 relative bg-black/50">
                {renderResult.type === '360' ? (
                  <iframe 
                    src={renderResult.url} 
                    className="w-full h-full border-none" 
                    title="360 Interactive Viewer" 
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-8 bg-black">
                    <img src={renderResult.url} alt="HQ Render" className="w-full h-full object-contain drop-shadow-2xl" />
                  </div>
                )}
              </div>
              
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BIMViewer;